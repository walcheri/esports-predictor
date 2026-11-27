import test from "node:test";
import assert from "node:assert/strict";
import { validateDataset, type Observation } from "../scripts/lib/dataset.ts";
import { syntheticDataset } from "../scripts/lib/synthetic.ts";
const now = new Date("2026-04-02T00:00:00Z");
const validate = (d: unknown) => validateDataset(d, now);
const row = (d: ReturnType<typeof syntheticDataset>, i = 0) =>
  d.observations[i] as Observation;
test("valid synthetic PIT export converts without names and preserves unknown publication", () => {
  const r = validate(syntheticDataset());
  assert.equal(r.manifest.ready, true);
  assert.equal(r.converted?.matches.length, 80);
  assert.equal(r.converted?.eventSnapshots.length, 80);
  assert.equal(r.converted?.matches[0].provenance.verification, "synthetic");
  assert.match(r.converted!.matches[0].team1!.name, /^pandascore:team:/);
  assert.ok("fieldsMissing" in r.manifest);
  assert.equal(r.manifest.fieldsMissing.availableAt, 160);
});
test("post-match information and future prematch observations are quarantined", () => {
  for (const change of [
    { winnerId: "pandascore:team:1" },
    { endedAt: "2026-01-01T00:01:00Z" },
    { obtainedAt: "2026-01-02T00:00:00Z" },
    { availableAt: "2026-01-02T00:00:00Z" },
  ]) {
    const d = syntheticDataset();
    Object.assign(row(d), change);
    const r = validate(d);
    assert.ok(r.quarantine.some((x) => x.reason === "PREMATCH_LEAKAGE"));
    assert.ok(!r.converted?.matches.some((m) => m.id === "pandascore:match:1"));
  }
});
test("late result publication is knowledge time, never result date", () => {
  const d = syntheticDataset();
  row(d, 1).availableAt = "2026-01-05T00:00:00Z";
  const r = validate(d);
  assert.equal(
    r.converted?.matches.find((m) => m.id === "pandascore:match:1")?.provenance
      .availableAt,
    "2026-01-05T00:00:00.000Z",
  );
});
test("same-day roster change uses exact intervals; current snapshot cannot impersonate historical", () => {
  const d = syntheticDataset();
  const original = d.rosters[0] as Record<string, unknown>;
  original.effectiveTo = "2026-01-20T12:00:00Z";
  d.rosters.push({
    ...original,
    recordId: "new-roster",
    effectiveFrom: "2026-01-20T12:00:00Z",
    effectiveTo: null,
    obtainedAt: "2026-01-20T12:00:00Z",
    players: [101, 102, 103, 104, 105].map((id) => `pandascore:player:${id}`),
  });
  const accepted = validate(d);
  assert.equal(accepted.converted?.rosters.length, 3);
  (d.rosters[0] as Record<string, unknown>).basis = "current_snapshot";
  const rejected = validate(d);
  assert.ok(
    rejected.quarantine.some(
      (q) => q.reason === "CURRENT_ROSTER_NOT_HISTORICAL",
    ),
  );
});
test("a roster obtained today cannot supply historical PIT coverage", () => {
  const d = syntheticDataset();
  for (const r of d.rosters as Record<string, unknown>[]) {
    r.obtainedAt = d.collectedAt;
    r.availableAt = "2025-12-01T00:00:00Z";
  }
  const r = validate(d);
  assert.equal(r.manifest.ready, false);
  assert.ok("rosterCoverage" in r.manifest);
  assert.equal(r.manifest.rosterCoverage, 0);
});
test("map/series mix, wrong discipline and invalid UTC do not enter the model", () => {
  for (const change of [
    { level: "map" },
    { game: "dota2" },
    { startsAt: "2026-02-30T00:00:00Z" },
  ]) {
    const d = syntheticDataset();
    Object.assign(row(d), change);
    const r = validate(d);
    assert.ok(r.quarantine.length > 0);
    assert.ok(
      !r.converted?.eventSnapshots.some((m) => m.id === "pandascore:match:1"),
    );
  }
});
test("duplicates deduplicate; conflicting IDs across events quarantine both", () => {
  const d = syntheticDataset();
  d.observations.push(structuredClone(row(d)));
  assert.equal(validate(d).converted?.eventSnapshots.length, 80);
  row(d, 2).recordId = row(d, 0).recordId;
  const r = validate(d);
  assert.ok(
    !r.converted?.matches.some((m) =>
      ["pandascore:match:1", "pandascore:match:2"].includes(m.id),
    ),
  );
});
test("401/429 partial acquisition and absent license are hard gates", () => {
  for (const status of [401, 403, 429]) {
    const d = syntheticDataset();
    d.acquisition.httpStatuses.push(status);
    assert.equal(validate(d).converted, null);
  }
  const d = syntheticDataset();
  d.license.approved = false;
  assert.equal(validate(d).converted, null);
});
test("cancellation removes the event and changed participants/BO are not silently reconciled", () => {
  const d = syntheticDataset();
  d.observations.push({
    ...row(d),
    recordId: "cancel",
    phase: "cancellation",
    obtainedAt: "2026-01-01T02:00:00Z",
  });
  const r = validate(d);
  assert.ok(!r.converted?.matches.some((m) => m.id === "pandascore:match:1"));
  const changed = syntheticDataset();
  row(changed, 1).bestOf = 5;
  assert.ok(
    validate(changed).quarantine.some((q) => q.reason === "QUARANTINED_EVENT"),
  );
});
test("small samples abstain, shuffled input is deterministic, zero is distinct from unknown", () => {
  assert.equal(validate(syntheticDataset(2)).converted, null);
  const d = syntheticDataset();
  const a = validate(d);
  d.observations.reverse();
  const b = validate(d);
  assert.deepEqual(a.converted?.matches, b.converted?.matches);
  const empty = validate(syntheticDataset(0));
  assert.ok("pitCoverage" in empty.manifest);
  assert.equal(empty.manifest.pitCoverage, null);
  const noPre = syntheticDataset();
  noPre.observations = noPre.observations.filter((_, i) => i % 2 === 1);
  const none = validate(noPre);
  assert.ok("pitCoverage" in none.manifest);
  assert.equal(none.manifest.pitCoverage, 0);
});
test("missing known fields remain null and output quarantine never copies payload", () => {
  const d = syntheticDataset();
  row(d).tournamentId = null;
  d.observations.push({ secret: "DO_NOT_OUTPUT_RAW" });
  const r = validate(d);
  assert.doesNotMatch(JSON.stringify(r.quarantine), /DO_NOT_OUTPUT_RAW/);
  assert.ok(r.quarantine.some((q) => q.reason === "OBSERVATION_SCHEMA"));
});
test("conflicting roster IDs cannot be reused across non-overlapping assignments", () => {
  const d = syntheticDataset();
  const original = d.rosters[0] as Record<string, unknown>;
  original.effectiveTo = "2026-02-01T00:00:00Z";
  d.rosters.push({
    ...original,
    effectiveFrom: "2026-02-01T00:00:00Z",
    effectiveTo: null,
  });
  const r = validate(d);
  assert.equal(r.manifest.ready, false);
  assert.ok("ROSTER_ID_CONFLICT" in r.manifest.reasons);
  assert.equal(r.manifest.reasons.ROSTER_ID_CONFLICT, 2);
});
test("malformed revision poisons an identifiable event instead of retaining a convenient result", () => {
  const d = syntheticDataset();
  d.observations.push({ ...row(d), bestOf: 99 });
  const r = validate(d);
  assert.ok(!r.converted!.matches.some((m) => m.id === row(d).eventId));
});
