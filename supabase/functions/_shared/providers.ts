import { GateError } from "./security.ts";
import {
  normalizePage,
  normalizePanda,
  object,
  sourceId,
  type Discipline,
  type Match,
} from "./data.ts";

export class BoundedCache<T> {
  private values = new Map<string, { expires: number; value: T }>();
  private pending = new Map<string, Promise<T>>();
  constructor(
    private ttl = 30000,
    private maximum = 100,
    private now = Date.now,
  ) {}
  async get(key: string, load: () => Promise<T>): Promise<T> {
    const entry = this.values.get(key);
    if (entry && entry.expires > this.now()) return entry.value;
    const pending = this.pending.get(key);
    if (pending) return pending;
    if (this.pending.size >= this.maximum)
      throw new GateError(503, "CACHE_CAPACITY");
    const task = load()
      .then((value) => {
        this.values.delete(key);
        if (this.values.size >= this.maximum)
          this.values.delete(this.values.keys().next().value!);
        this.values.set(key, { value, expires: this.now() + this.ttl });
        return value;
      })
      .finally(() => this.pending.delete(key));
    this.pending.set(key, task);
    return task;
  }
}
export type Catalogue = {
  matches: Match[];
  partial: true;
  rejected: number;
  conflicts: number;
  obtainedAt: string;
};
const games: Record<Discipline, string> = {
  cs2: "csgo",
  dota2: "dota2",
  lol: "lol",
  valorant: "valorant",
};
export function catalogueUrl(body: unknown, now = new Date()): string {
  const q = object(body);
  if (
    Object.keys(q).some(
      (k) => !["game", "status", "date", "leagueId"].includes(k),
    )
  )
    throw new GateError(400, "UNKNOWN_FILTER");
  const game = q.game ?? "all",
    status = q.status ?? "upcoming",
    date = q.date ?? "all";
  if (
    typeof game !== "string" ||
    (game !== "all" && !Object.hasOwn(games, game)) ||
    !["upcoming", "live", "all"].includes(String(status)) ||
    !["all", "today", "tomorrow", "week", "48h"].includes(String(date))
  ) {
    throw new GateError(400, "INVALID_FILTER");
  }
  const url = new URL(
    `https://api.pandascore.co/${game === "all" ? "" : games[game as Discipline] + "/"}matches`,
  );
  url.searchParams.set(
    "filter[status]",
    status === "live"
      ? "running"
      : status === "upcoming"
        ? "not_started"
        : "not_started,running",
  );
  url.searchParams.set("per_page", "100");
  url.searchParams.set("page", "1");
  url.searchParams.set("sort", "scheduled_at");
  if (q.leagueId && q.leagueId !== "all")
    url.searchParams.set("filter[league_id]", sourceId(q.leagueId));
  if (date !== "all" && status !== "live") {
    const start = new Date(now);
    start.setUTCHours(0, 0, 0, 0);
    if (date === "tomorrow") start.setUTCDate(start.getUTCDate() + 1);
    const end = new Date(start);
    end.setUTCDate(
      end.getUTCDate() + (date === "week" ? 7 : date === "48h" ? 2 : 1),
    );
    end.setTime(end.getTime() - 1);
    url.searchParams.set(
      "range[scheduled_at]",
      `${start.toISOString()},${end.toISOString()}`,
    );
  }
  return url.href;
}
export async function providerJson(
  url: string,
  token: string,
  fetcher: typeof fetch,
): Promise<unknown> {
  if (!token) throw new GateError(503, "PROVIDER_NOT_CONFIGURED");
  const r = await fetcher(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!r.ok)
    throw new GateError(r.status === 429 ? 429 : 503, "PROVIDER_UNAVAILABLE");
  if (!r.body) throw new GateError(502, "EMPTY_PROVIDER_BODY");
  const reader = r.body.getReader();
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 2_000_000) {
      await reader.cancel();
      throw new GateError(502, "PROVIDER_BODY_TOO_LARGE");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new GateError(502, "PROVIDER_SCHEMA_INVALID");
  }
}
export async function catalogue(
  body: unknown,
  token: string,
  fetcher: typeof fetch,
  now = new Date(),
): Promise<Catalogue> {
  const rows = await providerJson(catalogueUrl(body, now), token, fetcher);
  return {
    ...normalizePage(rows, now.toISOString()),
    partial: true,
    obtainedAt: now.toISOString(),
  };
}
export async function details(
  body: unknown,
  token: string,
  fetcher: typeof fetch,
  now = new Date(),
): Promise<Match> {
  const query = object(body);
  if (Object.keys(query).some((k) => k !== "matchId"))
    throw new GateError(400, "UNKNOWN_FIELD");
  const id = sourceId(
    typeof query.matchId === "string"
      ? query.matchId.replace(/^pandascore:/, "")
      : query.matchId,
  );
  const raw = await providerJson(
    `https://api.pandascore.co/matches/${id}`,
    token,
    fetcher,
  );
  const match = normalizePanda(raw, now.toISOString());
  if (match.providerId !== id) throw new GateError(502, "EVENT_ID_CONFLICT");
  return match;
}
