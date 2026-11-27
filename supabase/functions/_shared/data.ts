export type Discipline = "cs2" | "dota2" | "lol" | "valorant";
export type Provider = "pandascore" | "opendota" | "grid";
export type Provenance = {
  provider: Provider;
  sourceId: string;
  obtainedAt: string;
  availableAt: string;
  verification: "provider_observed" | "synthetic" | "conflict";
  completeness: "complete" | "partial";
  sampleSize: number;
};
export type Team = { id: string; name: string; logo: string | null };
export type GameResult = {
  id: string;
  map: string | null;
  winnerId: string;
  endedAt: string;
};
export type Match = {
  id: string;
  providerId: string;
  game: Discipline;
  team1: Team | null;
  team2: Team | null;
  tournament: string | null;
  tournamentId: string | null;
  startsAt: string | null;
  endedAt: string | null;
  bestOf: 1 | 3 | 5 | null;
  status: "upcoming" | "live" | "finished" | "cancelled" | "unknown";
  winnerId: string | null;
  games: GameResult[];
  provenance: Provenance;
};
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("SCHEMA_OBJECT");
  return value as Record<string, unknown>;
}
export function sourceId(value: unknown): string {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0)
    return String(value);
  if (typeof value === "string" && /^[1-9]\d{0,18}$/.test(value)) return value;
  throw new Error("SCHEMA_ID");
}
export function utc(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.test(
      value,
    ) ||
    !Number.isFinite(Date.parse(value))
  )
    throw new Error("SCHEMA_UTC");
  // Detect calendar rollover rather than accepting e.g. February 30.
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > new Date(Date.UTC(y, m, 0)).getUTCDate())
    throw new Error("SCHEMA_DATE");
  return new Date(value).toISOString();
}
export function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() && value.length <= 256
    ? value.trim()
    : null;
}
function image(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password
      ? u.href
      : null;
  } catch {
    return null;
  }
}
const slugs: Record<string, Discipline> = {
  csgo: "cs2",
  cs2: "cs2",
  dota2: "dota2",
  lol: "lol",
  valorant: "valorant",
};
export function normalizePanda(raw: unknown, obtainedAt: string): Match {
  const row = object(raw),
    id = sourceId(row.id),
    vg = object(row.videogame);
  const game =
    typeof vg.slug === "string" && Object.hasOwn(slugs, vg.slug)
      ? slugs[vg.slug]
      : undefined;
  if (!game) throw new Error("UNSUPPORTED_DISCIPLINE");
  const opponents = Array.isArray(row.opponents) ? row.opponents : [];
  if (opponents.length > 2) throw new Error("UNSUPPORTED_PARTICIPANTS");
  const team = (entry: unknown): Team | null => {
    if (!entry) return null;
    const opponent = object(object(entry).opponent),
      name = text(opponent.name);
    if (!name) return null;
    return {
      id: `pandascore:${sourceId(opponent.id)}`,
      name,
      logo: image(opponent.image_url),
    };
  };
  const team1 = team(opponents[0]),
    team2 = team(opponents[1]);
  if (team1 && team2 && team1.id === team2.id)
    throw new Error("DUPLICATE_TEAM");
  const states: Record<string, Match["status"]> = {
    not_started: "upcoming",
    running: "live",
    finished: "finished",
    canceled: "cancelled",
  };
  const status =
    typeof row.status === "string"
      ? Object.hasOwn(states, row.status)
        ? states[row.status]
        : "unknown"
      : "unknown";
  const time = utc(obtainedAt);
  const startsAt =
    row.scheduled_at || row.begin_at
      ? utc(row.scheduled_at || row.begin_at)
      : null;
  const endedAt = row.end_at ? utc(row.end_at) : null;
  const bestOf =
    [1, 3, 5].includes(Number(row.number_of_games)) &&
    typeof row.number_of_games === "number"
      ? (row.number_of_games as 1 | 3 | 5)
      : null;
  const tournament = row.tournament ? object(row.tournament) : null;
  const candidate =
    row.winner_id == null ? null : `pandascore:${sourceId(row.winner_id)}`;
  if (candidate && candidate !== team1?.id && candidate !== team2?.id)
    throw new Error("WINNER_ID_CONFLICT");
  if (endedAt && startsAt && endedAt < startsAt)
    throw new Error("RESULT_TIME_CONFLICT");
  if (endedAt && endedAt > time) throw new Error("FUTURE_RESULT");
  // Only verified finished outcomes, never classify unknown/draw as away win.
  const winnerId =
    status === "finished" && endedAt && candidate && row.forfeit !== true
      ? candidate
      : null;
  return {
    id: `pandascore:${id}`,
    providerId: id,
    game,
    team1,
    team2,
    tournament: tournament ? text(tournament.name) : null,
    tournamentId:
      tournament?.id == null ? null : `pandascore:${sourceId(tournament.id)}`,
    startsAt,
    endedAt,
    bestOf,
    status,
    winnerId,
    games: [],
    provenance: {
      provider: "pandascore",
      sourceId: id,
      obtainedAt: time,
      availableAt: time,
      verification: "provider_observed",
      completeness: "partial",
      sampleSize: 1,
    },
  };
}
export function normalizePage(rows: unknown, at: string) {
  if (!Array.isArray(rows)) throw new Error("SCHEMA_ARRAY");
  const byId = new Map<string, Match>(),
    conflicts = new Set<string>();
  let rejected = 0;
  for (const row of rows) {
    try {
      const match = normalizePanda(row, at),
        prior = byId.get(match.id);
      if (prior && JSON.stringify(prior) !== JSON.stringify(match))
        conflicts.add(match.id);
      else byId.set(match.id, match);
    } catch {
      rejected++;
    }
  }
  for (const id of conflicts) byId.delete(id);
  return { matches: [...byId.values()], rejected, conflicts: conflicts.size };
}
