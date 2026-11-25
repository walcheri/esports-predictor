import { describe, it } from "node:test";
import assert from "node:assert/strict";

function each<T>(values: readonly T[]) {
  return (name: string, check: (value: T) => void) => {
    for (const value of values) it(`${name}: ${JSON.stringify(value)}`, () => check(value));
  };
}
import {
  lineRadarSignalSchema, verifiedMatchLinkSchema, resolveVerifiedMatch,
  type LineRadarSignal, type VerifiedMatchLink,
} from "./contract";

// All IDs and prices are synthetic, not captured from a provider.
const signal: LineRadarSignal = {
  schemaVersion: 1, signalId: "synthetic-signal-001", source: "lineradar",
  provider: "api-sport", sport: "esports", discipline: "cs2",
  providerEventId: "synthetic-event", providerTournamentId: "synthetic-tournament",
  homeProviderTeamId: "synthetic-home", awayProviderTeamId: "synthetic-away",
  startsAt: "2030-01-02T12:00:00Z", bestOf: 3, market: "series_winner",
  bookmaker: "pari", outcome: "home", baselinePrice: 2, currentPrice: 1.8,
  changePercent: -10, baselineAt: "2030-01-02T10:00:00Z",
  sourceUpdatedAt: "2030-01-02T10:01:00Z", observedAt: "2030-01-02T10:02:00Z",
  expiresAt: "2030-01-02T10:03:00Z",
};
const link: VerifiedMatchLink = {
  providerEventId: signal.providerEventId, providerTournamentId: signal.providerTournamentId,
  pandaScoreMatchId: "synthetic-catalog-match", discipline: "cs2",
  homeProviderTeamId: signal.homeProviderTeamId, awayProviderTeamId: signal.awayProviderTeamId,
  startsAt: signal.startsAt, bestOf: 3, verifiedAt: "2030-01-02T09:00:00Z",
  evidenceRef: "synthetic-review-001", status: "verified",
};

describe("offline signal boundary", () => {
  it("accepts valid evidence and normalizes explicit offsets to UTC", () => {
    assert.equal(lineRadarSignalSchema.parse(signal).startsAt, "2030-01-02T12:00:00.000Z");
    assert.equal(resolveVerifiedMatch(signal, [{ ...link, startsAt: "2030-01-02T15:00:00+03:00" }]), link.pandaScoreMatchId);
  });
  each(["garbage", "2030-01-02T10:00:00", "2030-02-30T10:00:00Z", "2030-13-01T00:00:00Z", "2030-01-02T12:00:00+99:99"])("rejects malformed timestamps: %s", (value) => {
      assert.equal(lineRadarSignalSchema.safeParse({ ...signal, observedAt: value }).success, false);
      assert.equal(verifiedMatchLinkSchema.safeParse({ ...link, verifiedAt: value }).success, false);
    });
  each([
    { baselineAt: "2030-01-02T10:03:00Z" },
    { sourceUpdatedAt: "2030-01-02T10:03:00Z" },
    { expiresAt: signal.observedAt }, { startsAt: signal.observedAt },
    { expiresAt: "2030-01-02T12:00:01Z" },
  ])("rejects inconsistent time ordering %j", (change) => {
    assert.equal(lineRadarSignalSchema.safeParse({ ...signal, ...change }).success, false);
  });
  each([0, -1, 1, 1.01, NaN, Infinity, -Infinity, "2"])("rejects invalid odds %s", (price) => {
    for (const field of ["baselinePrice", "currentPrice"]) {
      assert.equal(lineRadarSignalSchema.safeParse({ ...signal, [field]: price }).success, false);
    }
  });
  it("rejects inconsistent changes, permits rounding and positive changes", () => {
    assert.equal(lineRadarSignalSchema.safeParse({ ...signal, changePercent: 10 }).success, false);
    assert.equal(lineRadarSignalSchema.safeParse({ ...signal, changePercent: -10.01 }).success, true);
    assert.equal(lineRadarSignalSchema.safeParse({ ...signal, currentPrice: 2.2, changePercent: 10 }).success, true);
  });
  each([
    { market: "map_winner" }, { sport: "football" }, { bestOf: 2 },
    { homeProviderTeamId: signal.awayProviderTeamId }, { providerEventId: " " },
    { rawResponse: "not allowed" },
  ])("rejects unsupported semantics and extra data %j", (change) => {
    assert.equal(lineRadarSignalSchema.safeParse({ ...signal, ...change }).success, false);
  });
});

describe("verified registry resolution", () => {
  it("resolves exactly one verified match", () => {
    assert.equal(resolveVerifiedMatch(signal, [link]), link.pandaScoreMatchId);
  });
  it("quarantines absent and ambiguous matches, including duplicate records", () => {
    assert.equal(resolveVerifiedMatch(signal, []), null);
    assert.equal(resolveVerifiedMatch(signal, [link, link]), null);
    assert.equal(resolveVerifiedMatch(signal, [link, { ...link, pandaScoreMatchId: "synthetic-other" }]), null);
  });
  each([
    { providerEventId: "other" }, { providerTournamentId: "other" },
    { discipline: "lol" as const }, { homeProviderTeamId: "other" },
    { awayProviderTeamId: "other" }, { bestOf: 5 as const },
    { startsAt: "2030-01-02T12:01:00Z" },
    { homeProviderTeamId: link.awayProviderTeamId, awayProviderTeamId: link.homeProviderTeamId },
  ])("does not guess mismatched identity %j", (change) => {
    assert.equal(resolveVerifiedMatch(signal, [{ ...link, ...change }]), null);
  });
  it("revalidates runtime input rather than trusting TypeScript types", () => {
    assert.equal(resolveVerifiedMatch(signal, [{ ...link, status: "pending" } as unknown as VerifiedMatchLink]), null);
    assert.equal(resolveVerifiedMatch({ ...signal, currentPrice: 0 }, [link]), null);
    assert.equal(resolveVerifiedMatch(signal, [{ ...link, evidenceRef: "" }]), null);
  });
});
