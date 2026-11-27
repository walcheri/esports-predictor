import { createHash } from "node:crypto";
import { z } from "zod";
import { utc, type Match } from "../../supabase/functions/_shared/data.ts";
import {
  rosterAt,
  type Roster,
} from "../../supabase/functions/_shared/statistics.ts";
export const sha256 = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");
const time = z.string().transform((v, ctx) => {
  try {
    return utc(v);
  } catch {
    ctx.addIssue({ code: "custom", message: "INVALID_UTC" });
    return z.NEVER;
  }
});
export const reference = z
  .string()
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]{2,199}$/);
const game = z.enum(["cs2", "dota2", "lol", "valorant"]);
const id = (kind: string) =>
  z.string().regex(new RegExp(`^pandascore:${kind}:[1-9][0-9]{0,18}$`));
export const observationSchema = z
  .object({
    recordId: z.string().regex(/^[A-Za-z0-9:_-]{1,120}$/),
    eventId: id("match"),
    seriesId: id("match"),
    level: z.enum(["series", "map"]),
    game,
    phase: z.enum(["prematch", "result", "cancellation"]),
    team1Id: id("team").nullable(),
    team2Id: id("team").nullable(),
    tournamentId: id("tournament").nullable(),
    bestOf: z.union([z.literal(1), z.literal(3), z.literal(5)]).nullable(),
    startsAt: time.nullable(),
    endedAt: time.nullable(),
    winnerId: id("team").nullable(),
    obtainedAt: time,
    availableAt: time.nullable(),
  })
  .strict();
const rosterSchema = z
  .object({
    recordId: z.string().regex(/^[A-Za-z0-9:_-]{1,120}$/),
    teamId: id("team"),
    game,
    players: z.array(id("player")).max(20).nullable(),
    effectiveFrom: time,
    effectiveTo: time.nullable(),
    obtainedAt: time,
    availableAt: time.nullable(),
    basis: z.enum(["historical_observation", "current_snapshot"]),
    evidenceReference: reference,
  })
  .strict();
export const datasetSchema = z
  .object({
    schemaVersion: z.literal("predictor-pit-v1"),
    synthetic: z.boolean(),
    provider: z.literal("pandascore"),
    game,
    collectedAt: time,
    license: z
      .object({
        approved: z.boolean(),
        reference,
        purpose: z.literal("closed-noncommercial"),
        storageAllowed: z.boolean(),
        backtestAllowed: z.boolean(),
        expiresAt: time.nullable(),
      })
      .strict(),
    acquisition: z
      .object({
        scope: z.literal("bounded-sample"),
        completedPlan: z.boolean(),
        httpStatuses: z.array(z.number().int().min(100).max(599)).max(10000),
      })
      .strict(),
    observations: z.array(z.unknown()).max(10000),
    rosters: z.array(z.unknown()).max(10000),
  })
  .strict();
export type Observation = z.infer<typeof observationSchema>;
export type Dataset = z.infer<typeof datasetSchema>;
export type Converted = {
  schemaVersion: "predictor-converted-v1";
  synthetic: boolean;
  inputSha256: string;
  matches: Match[];
  eventSnapshots: Match[];
  rosters: Roster[];
};
const knowledge = (received: string, published: string | null) =>
  published && published > received ? published : received;
export function validateDataset(
  input: unknown,
  now = new Date(),
  minimumEvents = 30,
) {
  if (!Number.isInteger(minimumEvents) || minimumEvents < 1)
    throw new Error("INVALID_SAMPLE_THRESHOLD");
  const hash = sha256(JSON.stringify(input) ?? "null"),
    parsed = datasetSchema.safeParse(input);
  const reasons: Record<string, number> = {},
    missing: Record<string, number> = {};
  const quarantine: {
    section: string;
    index: number;
    digest: string;
    reason: string;
  }[] = [];
  const count = (reason: string) => {
    reasons[reason] = (reasons[reason] ?? 0) + 1;
  };
  const reject = (
    section: string,
    index: number,
    value: unknown,
    reason: string,
  ) => {
    count(reason);
    quarantine.push({
      section,
      index,
      digest: sha256(JSON.stringify(value) ?? "null"),
      reason,
    });
  };
  if (!parsed.success)
    return {
      manifest: {
        schemaVersion: "predictor-manifest-v1",
        inputSha256: hash,
        ready: false,
        reasons: { ROOT_SCHEMA_INVALID: 1 },
      },
      quarantine,
      converted: null,
    };
  const d = parsed.data,
    t = now.toISOString();
  const blockers: string[] = [];
  if (
    !d.license.approved ||
    !d.license.storageAllowed ||
    !d.license.backtestAllowed ||
    (d.license.expiresAt && d.license.expiresAt <= t)
  )
    blockers.push("LICENSE_NOT_APPROVED");
  if (d.collectedAt > t) blockers.push("COLLECTION_IN_FUTURE");
  if (
    !d.acquisition.completedPlan ||
    d.acquisition.httpStatuses.some((s) => s !== 200)
  )
    blockers.push("INCOMPLETE_ACQUISITION");
  const rows: { m: Observation; index: number }[] = [];
  let duplicates = 0;
  const seen = new Set<string>(),
    records = new Map<string, { digest: string; eventId: string }>(),
    badEvents = new Set<string>();
  for (const [index, value] of d.observations.entries()) {
    const p = observationSchema.safeParse(value);
    if (!p.success) {
      reject("observations", index, value, "OBSERVATION_SCHEMA");
      if (
        value &&
        typeof value === "object" &&
        "eventId" in value &&
        id("match").safeParse(value.eventId).success
      )
        badEvents.add(String(value.eventId));
      continue;
    }
    const m = p.data;
    let problem: string | null = null;
    if (m.game !== d.game) problem = "WRONG_DISCIPLINE";
    else if (m.level !== "series" || m.eventId !== m.seriesId)
      problem = "MAP_SERIES_MIX";
    else if (
      m.obtainedAt > d.collectedAt ||
      m.obtainedAt > t ||
      (m.availableAt && m.availableAt > d.collectedAt)
    )
      problem = "FUTURE_OBSERVATION";
    else if (m.team1Id && m.team1Id === m.team2Id)
      problem = "PARTICIPANT_CONFLICT";
    else if (
      m.phase === "prematch" &&
      (m.winnerId ||
        m.endedAt ||
        !m.startsAt ||
        knowledge(m.obtainedAt, m.availableAt) >= m.startsAt)
    )
      problem = "PREMATCH_LEAKAGE";
    else if (
      m.phase === "result" &&
      (!m.startsAt ||
        !m.endedAt ||
        m.endedAt < m.startsAt ||
        m.endedAt > m.obtainedAt ||
        !m.winnerId ||
        ![m.team1Id, m.team2Id].includes(m.winnerId))
    )
      problem = "INVALID_RESULT";
    else if (m.phase === "cancellation" && (m.winnerId || m.endedAt))
      problem = "CANCELLATION_RESULT_CONFLICT";
    if (problem) {
      reject("observations", index, value, problem);
      badEvents.add(m.eventId);
      continue;
    }
    for (const key of [
      "team1Id",
      "team2Id",
      "tournamentId",
      "bestOf",
      "startsAt",
      "availableAt",
    ] as const)
      if (m[key] === null) missing[key] = (missing[key] ?? 0) + 1;
    const { recordId, ...semantic } = m;
    const digest = sha256(JSON.stringify(semantic));
    if (records.has(recordId) && records.get(recordId)!.digest !== digest) {
      badEvents.add(m.eventId);
      badEvents.add(records.get(recordId)!.eventId);
      count("DUPLICATE_ID_CONFLICT");
    }
    records.set(recordId, { digest, eventId: m.eventId });
    if (seen.has(digest)) {
      duplicates++;
      continue;
    }
    seen.add(digest);
    rows.push({ m, index });
  }
  // Changed identity/schedule/BO or contradictory final labels cannot be repaired by choosing a convenient version.
  const families = new Map<string, Observation[]>();
  for (const { m } of rows) {
    const f = families.get(m.eventId) ?? [];
    f.push(m);
    families.set(m.eventId, f);
  }
  let cancellations = 0;
  for (const [event, f] of families) {
    if (f.some((m) => m.phase === "cancellation")) {
      badEvents.add(event);
      cancellations++;
      count("CANCELLED_EVENT");
      continue;
    }
    const identity = new Set(
      f.map((m) =>
        JSON.stringify([
          m.game,
          m.team1Id,
          m.team2Id,
          m.bestOf,
          m.startsAt,
          m.tournamentId,
        ]),
      ),
    );
    const labels = new Set(
      f
        .filter((m) => m.phase === "result")
        .map((m) => JSON.stringify([m.winnerId, m.endedAt])),
    );
    if (identity.size > 1 || labels.size > 1) {
      badEvents.add(event);
      count("EVENT_REVISION_CONFLICT");
    }
  }
  const accepted = rows.filter(({ m, index }) => {
    if (!badEvents.has(m.eventId)) return true;
    reject("observations", index, m, "QUARANTINED_EVENT");
    return false;
  });
  const rosterRows: { r: z.infer<typeof rosterSchema>; index: number }[] = [];
  const rosterSeen = new Set<string>();
  const rosterRecords = new Map<string, string>(),
    badRosterRecords = new Set<string>();
  for (const [index, value] of d.rosters.entries()) {
    const p = rosterSchema.safeParse(value);
    if (!p.success) {
      reject("rosters", index, value, "ROSTER_SCHEMA");
      continue;
    }
    const r = p.data;
    let problem: string | null = null;
    if (r.game !== d.game) problem = "WRONG_DISCIPLINE";
    else if (r.basis !== "historical_observation")
      problem = "CURRENT_ROSTER_NOT_HISTORICAL";
    else if (
      r.obtainedAt > d.collectedAt ||
      r.obtainedAt > t ||
      (r.availableAt && r.availableAt > d.collectedAt)
    )
      problem = "FUTURE_ROSTER";
    else if (r.effectiveTo && r.effectiveTo <= r.effectiveFrom)
      problem = "INVALID_ROSTER_INTERVAL";
    else if (
      !r.players ||
      r.players.length !== 5 ||
      new Set(r.players).size !== 5
    )
      problem = "UNKNOWN_OR_INCOMPLETE_ROSTER";
    if (problem) {
      reject("rosters", index, value, problem);
      continue;
    }
    const { recordId, ...rest } = r;
    const digest = sha256(JSON.stringify(rest));
    if (rosterRecords.has(recordId) && rosterRecords.get(recordId) !== digest)
      badRosterRecords.add(recordId);
    rosterRecords.set(recordId, digest);
    if (rosterSeen.has(digest)) {
      duplicates++;
      continue;
    }
    rosterSeen.add(digest);
    rosterRows.push({ r, index });
  }
  const overlapping = new Set<number>();
  for (let i = 0; i < rosterRows.length; i++)
    for (let j = i + 1; j < rosterRows.length; j++) {
      const a = rosterRows[i].r,
        b = rosterRows[j].r;
      if (
        a.teamId === b.teamId &&
        a.effectiveFrom < (b.effectiveTo ?? "9999") &&
        b.effectiveFrom < (a.effectiveTo ?? "9999")
      ) {
        overlapping.add(i);
        overlapping.add(j);
      }
    }
  const rosters: Roster[] = rosterRows.flatMap(({ r, index }, i) => {
    if (badRosterRecords.has(r.recordId)) {
      reject("rosters", index, r, "ROSTER_ID_CONFLICT");
      return [];
    }
    if (overlapping.has(i)) {
      reject("rosters", index, r, "OVERLAPPING_ROSTERS");
      return [];
    }
    return [
      {
        teamId: r.teamId,
        game: r.game,
        players: r.players!,
        effectiveFrom: r.effectiveFrom,
        effectiveTo: r.effectiveTo,
        availableAt: knowledge(r.obtainedAt, r.availableAt),
        sourceId: r.recordId,
        verified: true,
      },
    ];
  });
  const convert = (m: Observation): Match => ({
    id: m.eventId,
    providerId: m.eventId.split(":").at(-1)!,
    game: m.game,
    team1: m.team1Id ? { id: m.team1Id, name: m.team1Id, logo: null } : null,
    team2: m.team2Id ? { id: m.team2Id, name: m.team2Id, logo: null } : null,
    tournament: m.tournamentId,
    tournamentId: m.tournamentId,
    startsAt: m.startsAt,
    endedAt: m.endedAt,
    bestOf: m.bestOf,
    status: m.phase === "prematch" ? "upcoming" : "finished",
    winnerId: m.winnerId,
    games: [],
    provenance: {
      provider: "pandascore",
      sourceId: m.recordId,
      obtainedAt: m.obtainedAt,
      availableAt: knowledge(m.obtainedAt, m.availableAt),
      verification: d.synthetic ? "synthetic" : "provider_observed",
      completeness: "partial",
      sampleSize: 1,
    },
  });
  const ordered = accepted
    .map((x) => x.m)
    .sort(
      (a, b) =>
        knowledge(a.obtainedAt, a.availableAt).localeCompare(
          knowledge(b.obtainedAt, b.availableAt),
        ) ||
        a.eventId.localeCompare(b.eventId) ||
        a.recordId.localeCompare(b.recordId),
    );
  const earliest = new Map<string, Match>();
  for (const m of ordered)
    if (m.phase === "result" && !earliest.has(m.eventId))
      earliest.set(m.eventId, convert(m));
  const matches = [...earliest.values()],
    eventSnapshots = ordered.filter((m) => m.phase === "prematch").map(convert);
  const pit = matches.filter((m) => eventSnapshots.some((e) => e.id === m.id));
  const eligible = pit.filter(
    (m) =>
      m.startsAt &&
      m.team1 &&
      m.team2 &&
      [m.team1.id, m.team2.id].every(
        (id) => rosterAt(rosters, id, m.game, m.startsAt!) !== null,
      ),
  );
  if (eligible.length < minimumEvents) blockers.push("SAMPLE_TOO_SMALL");
  const converted: Converted = {
    schemaVersion: "predictor-converted-v1",
    synthetic: d.synthetic,
    inputSha256: hash,
    matches,
    eventSnapshots,
    rosters,
  };
  const manifest = {
    schemaVersion: "predictor-manifest-v1",
    inputSha256: hash,
    source: d.provider,
    game: d.game,
    synthetic: d.synthetic,
    legalReferenceSha256: sha256(d.license.reference),
    collectedAt: d.collectedAt,
    validatedAt: t,
    scope: d.acquisition.scope,
    partial:
      !d.acquisition.completedPlan ||
      d.acquisition.httpStatuses.some((s) => s !== 200),
    ready: blockers.length === 0,
    blockers,
    minimumEvents,
    sampleCounts: {
      inputObservations: d.observations.length,
      acceptedObservations: accepted.length,
      results: matches.length,
      prematch: eventSnapshots.length,
      rosters: rosters.length,
      eligibleEvents: eligible.length,
      duplicates,
      cancellations,
      quarantined: quarantine.length,
    },
    eventCoverage: {
      observed: new Set(rows.map((x) => x.m.eventId)).size,
      accepted: matches.length,
    },
    pitCoverage: matches.length ? pit.length / matches.length : null,
    rosterCoverage: pit.length ? eligible.length / pit.length : null,
    fieldsMissing: missing,
    reasons,
    productionApproved: false,
  };
  return {
    manifest,
    quarantine,
    converted: blockers.length === 0 ? converted : null,
  };
}
