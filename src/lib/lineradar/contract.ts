/**
 * Offline-only schema for a future private LineRadar в†’ predictor bridge.
 * This does not authorize publication or access any network/service.
 */
import { z } from "zod";

// Accept explicit offsets at the boundary; compare canonical UTC instants.
const utcDate = z.string().datetime({ offset: true })
  .refine((value) => Number.isFinite(Date.parse(value)), "Invalid timestamp")
  .transform((value) => new Date(value).toISOString());
const identity = z.string().min(1).max(128).refine((value) => value.trim() === value);
const discipline = z.enum(["cs2", "dota2", "lol"]);
const bestOf = z.union([z.literal(1), z.literal(3), z.literal(5)]);

export const lineRadarSignalSchema = z.object({
  schemaVersion: z.literal(1),
  signalId: z.string().min(8).max(128),
  source: z.literal("lineradar"),
  provider: z.literal("api-sport"),
  sport: z.literal("esports"),
  discipline,
  providerEventId: identity,
  providerTournamentId: identity,
  homeProviderTeamId: identity,
  awayProviderTeamId: identity,
  startsAt: utcDate,
  bestOf,
  market: z.literal("series_winner"),
  bookmaker: z.enum(["pari", "betboom", "melbet", "marathon", "pinnacle"]),
  outcome: z.enum(["home", "away"]),
  baselinePrice: z.number().finite().gt(1.01),
  currentPrice: z.number().finite().gt(1.01),
  changePercent: z.number().finite().min(-100).max(10000),
  baselineAt: utcDate,
  sourceUpdatedAt: utcDate,
  observedAt: utcDate,
  expiresAt: utcDate,
}).strict().superRefine((s, context) => {
  const baseline = Date.parse(s.baselineAt);
  const source = Date.parse(s.sourceUpdatedAt);
  const observed = Date.parse(s.observedAt);
  const expires = Date.parse(s.expiresAt);
  const starts = Date.parse(s.startsAt);
  if ([baseline, source, observed, expires, starts].some((t) => !Number.isFinite(t)) ||
      baseline > observed || source > observed || observed >= expires || observed >= starts || expires > starts) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid evidence timestamps" });
  }
  if (s.homeProviderTeamId === s.awayProviderTeamId) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Distinct teams required" });
  }
  const calculated = (s.currentPrice / s.baselinePrice - 1) * 100;
  if (Math.abs(calculated - s.changePercent) > 0.05) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Inconsistent changePercent" });
  }
});

export type LineRadarSignal = z.infer<typeof lineRadarSignalSchema>;

export const verifiedMatchLinkSchema = z.object({
  providerEventId: identity,
  pandaScoreMatchId: identity,
  providerTournamentId: identity,
  discipline,
  homeProviderTeamId: identity,
  awayProviderTeamId: identity,
  startsAt: utcDate,
  bestOf,
  verifiedAt: utcDate,
  evidenceRef: z.string().min(1).max(256),
  status: z.literal("verified"),
}).strict().refine((link) => link.homeProviderTeamId !== link.awayProviderTeamId, {
  message: "Distinct teams required",
});

export type VerifiedMatchLink = z.infer<typeof verifiedMatchLinkSchema>;

/** Server-side only: no fuzzy matching, no match on names alone. */
export function resolveVerifiedMatch(
  signal: LineRadarSignal, links: readonly VerifiedMatchLink[],
): string | null {
  // Types alone do not validate an untrusted future ingest/registry boundary.
  const parsedSignal = lineRadarSignalSchema.safeParse(signal);
  const parsedLinks = z.array(verifiedMatchLinkSchema).safeParse(links);
  if (!parsedSignal.success || !parsedLinks.success) return null;
  const event = parsedSignal.data;
  const matches = parsedLinks.data.filter((link) =>
    link.status === "verified" &&
    link.providerEventId === event.providerEventId &&
    link.providerTournamentId === event.providerTournamentId &&
    link.discipline === event.discipline &&
    link.homeProviderTeamId === event.homeProviderTeamId &&
    link.awayProviderTeamId === event.awayProviderTeamId &&
    link.startsAt === event.startsAt &&
    link.bestOf === event.bestOf
  );
  return matches.length === 1 ? matches[0].pandaScoreMatchId : null;
}
