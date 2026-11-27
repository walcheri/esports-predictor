import { normalizePanda } from "../../supabase/functions/_shared/data.ts";
import type { Dataset, Observation } from "./dataset.ts";
import { sha256, validateDataset } from "./dataset.ts";
export const routes = ["upcoming", "past"] as const;
export function probeUrl(route: (typeof routes)[number]) {
  if (!routes.includes(route)) throw new Error("ROUTE_REJECTED");
  return `https://api.pandascore.co/csgo/matches/${route}?per_page=50&page=1`;
}
export function assertProbeUrl(value: string) {
  const u = new URL(value);
  if (
    u.origin !== "https://api.pandascore.co" ||
    u.username ||
    u.password ||
    !routes.some((r) => probeUrl(r) === u.href)
  )
    throw new Error("DESTINATION_REJECTED");
}
export type ProbeRequest = {
  route: (typeof routes)[number];
  status: number | null;
  receivedAt: string;
  code: string;
  rows: number;
  rejected: number;
};
async function bounded(response: Response) {
  if (!response.body) throw new Error("EMPTY_BODY");
  const reader = response.body.getReader();
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 1000000) {
      await reader.cancel();
      throw new Error("BODY_LIMIT");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.length;
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}
export function minimalObservation(
  raw: unknown,
  receivedAt: string,
): Observation {
  const m = normalizePanda(raw, receivedAt);
  if (
    m.game !== "cs2" ||
    !["upcoming", "finished", "cancelled"].includes(m.status)
  )
    throw new Error("UNSUPPORTED_OBSERVATION");
  const qualified = (kind: string, v: string | null) =>
    v ? `pandascore:${kind}:${v.split(":").at(-1)}` : null;
  const eventId = `pandascore:match:${m.providerId}`,
    phase =
      m.status === "upcoming"
        ? "prematch"
        : m.status === "finished"
          ? "result"
          : "cancellation";
  const projected = {
    eventId,
    seriesId: eventId,
    level: "series" as const,
    game: m.game,
    phase,
    team1Id: qualified("team", m.team1?.id ?? null),
    team2Id: qualified("team", m.team2?.id ?? null),
    tournamentId: qualified("tournament", m.tournamentId),
    bestOf: m.bestOf,
    startsAt: m.startsAt,
    endedAt: m.endedAt,
    winnerId: qualified("team", m.winnerId),
    obtainedAt: receivedAt,
    availableAt: null,
  };
  return {
    ...projected,
    phase: phase as Observation["phase"],
    recordId: sha256(JSON.stringify(projected)),
  };
}
export async function runProbe(deps: {
  transport: typeof fetch;
  reserve: () => void;
  now: () => Date;
  record?: (r: ProbeRequest) => void;
  token: string;
  maxRequests: number;
  synthetic: boolean;
  legalReference: string;
  licenseExpiresAt?: string | null;
}) {
  if (
    !Number.isInteger(deps.maxRequests) ||
    deps.maxRequests < 1 ||
    deps.maxRequests > 40
  )
    throw new Error("INVALID_ATTEMPT_CAP");
  const requests: ProbeRequest[] = [],
    observations: Observation[] = [];
  let attempts = 0,
    stopReason = "PLAN_COMPLETE";
  outer: for (const route of routes) {
    for (let retry = 0; retry < 2; retry++) {
      if (attempts >= deps.maxRequests) {
        stopReason = "ATTEMPT_CAP";
        break outer;
      }
      try {
        deps.reserve();
      } catch {
        stopReason = "LEDGER_OR_QUOTA_STOP";
        break outer;
      }
      attempts++;
      let status: number | null = null,
        rows = 0,
        rejected = 0,
        code = "NETWORK_OR_TIMEOUT",
        receivedAt: string | null = null;
      try {
        const url = probeUrl(route);
        assertProbeUrl(url);
        const response = await deps.transport(url, {
          headers: {
            Authorization: `Bearer ${deps.token}`,
            Accept: "application/json",
          },
          redirect: "error",
          signal: AbortSignal.timeout(8000),
        });
        status = response.status;
        if (status !== 200) {
          await response.body?.cancel();
          code = [401, 403, 429].includes(status)
            ? "AUTH_OR_RATE_STOP"
            : "HTTP_ERROR";
        } else {
          const raw = await bounded(response);
          receivedAt = deps.now().toISOString();
          if (!Array.isArray(raw) || raw.length > 100)
            throw new Error("SCHEMA");
          rows = raw.length;
          for (const item of raw) {
            try {
              observations.push(minimalObservation(item, receivedAt));
            } catch {
              rejected++;
            }
          }
          code = rejected ? "SCHEMA_REJECTED" : "OK";
        }
      } catch {
        code =
          status === 200 ? "BODY_OR_SCHEMA_REJECTED" : "NETWORK_OR_TIMEOUT";
      }
      const entry = {
        route,
        status,
        receivedAt: receivedAt ?? deps.now().toISOString(),
        code,
        rows,
        rejected,
      };
      requests.push(entry);
      deps.record?.(entry);
      if (code === "OK") break;
      if (
        status === 401 ||
        status === 403 ||
        status === 429 ||
        status === 200 ||
        retry === 1 ||
        (status !== null && status < 500)
      ) {
        stopReason = code;
        break outer;
      }
    }
  }
  const dataset: Dataset = {
    schemaVersion: "predictor-pit-v1",
    synthetic: deps.synthetic,
    provider: "pandascore",
    game: "cs2",
    collectedAt: deps.now().toISOString(),
    license: {
      approved: true,
      reference: deps.legalReference,
      purpose: "closed-noncommercial",
      storageAllowed: true,
      backtestAllowed: true,
      expiresAt: deps.licenseExpiresAt ?? null,
    },
    acquisition: {
      scope: "bounded-sample",
      completedPlan: stopReason === "PLAN_COMPLETE",
      httpStatuses: requests.flatMap((r) =>
        r.status === null ? [599] : [r.status],
      ),
    },
    observations,
    rosters: [],
  };
  const validation = validateDataset(dataset, deps.now());
  return {
    dataset,
    report: {
      mode: deps.synthetic ? "DRY_RUN_SYNTHETIC" : "LIVE_APPROVED",
      networkRequests: deps.synthetic ? 0 : attempts,
      transportAttempts: attempts,
      stopReason,
      requests,
      sourceCoverageVerified: false,
      productionApproved: false,
      fieldCompleteness: validation.manifest,
    },
    quarantine: validation.quarantine,
  };
}
export function mockTransport(now: () => Date): typeof fetch {
  return async (input) => {
    const future = String(input).includes("/upcoming"),
      start = new Date(+now() + (future ? 3600000 : -7200000)).toISOString();
    return Response.json([
      {
        id: future ? 1 : 2,
        videogame: { slug: "csgo" },
        status: future ? "not_started" : "finished",
        scheduled_at: start,
        end_at: future ? null : new Date(+now() - 3600000).toISOString(),
        winner_id: future ? null : 1,
        number_of_games: 3,
        tournament: { id: 1, name: "SYNTHETIC" },
        opponents: [
          { opponent: { id: 1, name: "SYNTHETIC A" } },
          { opponent: { id: 2, name: "SYNTHETIC B" } },
        ],
      },
    ]);
  };
}
