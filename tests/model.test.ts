import test from "node:test";
import assert from "node:assert/strict";
import { normalizePanda } from "../supabase/functions/_shared/data.ts";
import {
  predict as rawPredict,
  backtest as rawBacktest,
  scores,
  type Options,
} from "../supabase/functions/_shared/model.ts";
const rosters = [1, 2].map((id) => ({
  teamId: `pandascore:${id}`,
  game: "cs2" as const,
  players: Array.from({ length: 5 }, (_, i) => `${id}:${i}`),
  effectiveFrom: "2025-01-01T00:00:00Z",
  effectiveTo: null,
  availableAt: "2025-01-01T00:00:00Z",
  sourceId: `synthetic:${id}`,
  verified: true,
}));
const predict = (
  rows: Parameters<typeof rawPredict>[0],
  event: Parameters<typeof rawPredict>[1],
  at: string,
  options: Options = {},
) => rawPredict(rows, event, at, { rosters, ...options });
const backtest = (
  rows: Parameters<typeof rawBacktest>[0],
  cal: string,
  split: string,
  options: Options = {},
) => rawBacktest(rows, cal, split, { rosters, ...options });
function fixture(id: number, day: number) {
  const d = new Date(Date.UTC(2026, 0, day));
  const end = new Date(+d + 3600000).toISOString();
  return normalizePanda(
    {
      id,
      videogame: { slug: "csgo" },
      opponents: [
        { opponent: { id: 1, name: "A" } },
        { opponent: { id: 2, name: "B" } },
      ],
      status: "finished",
      winner_id: id % 3 === 0 ? 2 : 1,
      scheduled_at: d.toISOString(),
      end_at: end,
      number_of_games: 3,
    },
    end,
  );
}
function before(m: ReturnType<typeof fixture>) {
  return {
    ...m,
    status: "upcoming" as const,
    winnerId: null,
    endedAt: null,
    provenance: {
      ...m.provenance,
      obtainedAt: m.startsAt!,
      availableAt: m.startsAt!,
    },
  };
}
const rows = Array.from({ length: 80 }, (_, i) => fixture(i + 1, i + 1));
test("abstains on inadequate or stale history and unknown BO", () => {
  const e = before(fixture(99, 100));
  assert.equal(predict([], e, e.startsAt!).status, "INSUFFICIENT_DATA");
  assert.equal(
    predict(rows, { ...e, bestOf: null }, e.startsAt!).status,
    "INSUFFICIENT_DATA",
  );
  const late = before(fixture(999, 300));
  assert.equal(predict(rows, late, late.startsAt!).status, "INSUFFICIENT_DATA");
});
test("future results cannot alter a historical prediction; deterministic team reversal", () => {
  const e = before(rows[30]),
    p = predict(rows, e, e.startsAt!);
  assert.deepEqual(p, predict(rows.slice(0, 30), e, e.startsAt!));
  const q = predict(
    rows,
    { ...e, team1: e.team2, team2: e.team1 },
    e.startsAt!,
  );
  assert.equal(p.status, "OK");
  if (p.status === "OK" && q.status === "OK")
    assert.ok(Math.abs(p.probability + q.probability - 1) < 1e-12);
});
test("Brier and log loss known reference; empty sample unknown", () => {
  const m = scores([{ id: "a", at: "", game: "cs2", bestOf: 3, p: 0.5, y: 1 }]);
  assert.equal(m.brier, 0.25);
  assert.equal(m.logLoss, Math.log(2));
  assert.equal(scores([]).brier, null);
});
test("chronological held-out report and no false calibration claim for small data", () => {
  const r = backtest(rows, "2026-01-20T00:00:00Z", "2026-02-01T00:00:00Z", {
    eventSnapshots: rows.map(before),
  });
  assert.equal(r.calibrationFitted, false);
  assert.equal(r.temperature, 1);
  assert.equal(r.groups["dota2/BO1"].n, 0);
  assert.ok(r.raw.n > 0);
  assert.throws(() =>
    backtest(rows, "2026-02-01T00:00:00Z", "2026-01-01T00:00:00Z"),
  );
});

test("retrospective event metadata is not a prematch observation", () => {
  const e = rows[30];
  assert.equal(predict(rows, e, e.startsAt!).status, "INSUFFICIENT_DATA");
  const r = backtest(rows, "2026-01-20T00:00:00Z", "2026-02-01T00:00:00Z");
  assert.equal(r.raw.n, 0);
  assert.equal(r.abstained, r.eligible);
});

test("unknown roster or a fresh roster change abstains instead of reusing old team strength", () => {
  const e = before(rows[30]);
  assert.equal(
    predict(rows, e, e.startsAt!, { rosters: [] }).status,
    "INSUFFICIENT_DATA",
  );
  const changed = [
    { ...rosters[0], effectiveTo: e.startsAt },
    {
      ...rosters[0],
      players: ["new1", "new2", "new3", "new4", "new5"],
      effectiveFrom: e.startsAt!,
      availableAt: e.startsAt!,
      sourceId: "change",
    },
    rosters[1],
  ];
  assert.equal(
    predict(rows, e, e.startsAt!, { rosters: changed }).status,
    "INSUFFICIENT_DATA",
  );
});
test("late result observation and BO isolation reduce usable history", () => {
  const e = before(rows[30]);
  const delayed = rows.map((r) => ({
    ...r,
    provenance: { ...r.provenance, availableAt: "2028-01-01T00:00:00Z" },
  }));
  assert.equal(predict(delayed, e, e.startsAt!).status, "INSUFFICIENT_DATA");
  assert.equal(
    predict(rows, { ...e, bestOf: 1 }, e.startsAt!).status,
    "INSUFFICIENT_DATA",
  );
});

test("calibration fits only a separate sufficiently large prefix; invalid probabilities rejected", () => {
  const r = backtest(rows, "2026-01-11T00:00:00Z", "2026-02-15T00:00:00Z", {
    eventSnapshots: rows.map(before),
  });
  assert.equal(r.calibrationFitted, true);
  assert.ok(r.calibrationSamples >= 30);
  assert.throws(() =>
    scores([{ id: "bad", at: "", game: "cs2", bestOf: 3, p: NaN, y: 1 }]),
  );
});

test("calibration excludes labels fetched after test start even if published earlier", () => {
  const late = rows.map((m, i) =>
    i >= 10 && i < 45
      ? {
          ...m,
          provenance: { ...m.provenance, obtainedAt: "2028-01-01T00:00:00Z" },
        }
      : m,
  );
  const report = backtest(
    late,
    "2026-01-11T00:00:00Z",
    "2026-02-15T00:00:00Z",
    { eventSnapshots: rows.map(before) },
  );
  assert.equal(report.calibrationSamples, 0);
  assert.equal(report.calibrationFitted, false);
});
