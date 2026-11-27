import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  readFileSync,
  unlinkSync,
  rmdirSync,
  writeFileSync,
  readdirSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  checkApproval,
  ProbeLedger,
  type Approval,
} from "../scripts/lib/probe-budget.ts";
import {
  runProbe,
  mockTransport,
  assertProbeUrl,
} from "../scripts/lib/probe.ts";
import { sha256 } from "../scripts/lib/dataset.ts";
const now = new Date("2026-11-27T10:00:00Z");
const approval: Approval = {
  schemaVersion: "predictor-probe-approval-v1",
  approvedByOwner: true,
  approvalReference: "synthetic-test-approval",
  provider: "pandascore",
  game: "cs2",
  plan: "synthetic-free",
  documentationReviewed: true,
  tariffLimitsVerified: true,
  storageAllowed: true,
  backtestAllowed: true,
  purpose: "closed-noncommercial",
  noOtherClients: true,
  expiresAt: "2026-11-27T11:00:00Z",
  licenseExpiresAt: null,
  quotaAssessedAt: now.toISOString(),
  dailyAttemptBudget: 100,
  minuteAttemptBudget: 5,
  maxExperimentAttempts: 40,
  initialDailyUsed: 0,
  initialMonthlyCostMicroUsd: 0,
  attemptCostMicroUsd: 0,
  dailyCostMicroUsd: 0,
  monthlyCostMicroUsd: 0,
};
const digest = sha256(JSON.stringify(approval));
function scratch(fn: (file: string, dir: string) => void) {
  const dir = mkdtempSync(join(tmpdir(), "probe-test-"));
  try {
    fn(join(dir, "ledger.jsonl"), dir);
  } finally {
    for (const name of readdirSync(dir)) unlinkSync(join(dir, name));
    rmdirSync(dir);
  }
}
test("live gate rejects missing approval, digest, stale quota, expired license and exceeded reserve", () => {
  for (const bad of [
    { ...approval, approvedByOwner: false },
    { ...approval, quotaAssessedAt: "2026-11-26T10:00:00Z" },
    { ...approval, licenseExpiresAt: "2026-11-26T10:00:00Z" },
    { ...approval, initialDailyUsed: 80 },
  ])
    assert.throws(() => checkApproval(bad, digest, digest, now));
  assert.throws(() => checkApproval(approval, "0".repeat(64), digest, now));
  assert.equal(checkApproval(approval, digest, digest, now).game, "cs2");
});
test("ledger survives instances, retains uncertain attempts, locks and prevents run replay", () =>
  scratch((file) => {
    const ledger = new ProbeLedger(file, approval, digest, "run", () => now);
    ledger.begin();
    ledger.reserve();
    assert.throws(() =>
      new ProbeLedger(file, approval, digest, "run", () => now).begin(),
    );
    const next = new ProbeLedger(file, approval, digest, "next", () => now);
    next.begin();
    for (let i = 0; i < 4; i++) next.reserve();
    assert.throws(() => next.reserve());
    assert.equal(
      readFileSync(file, "utf8")
        .split("\n")
        .filter((s) => s.includes('"kind":"attempt"')).length,
      5,
    );
    writeFileSync(file + ".lock", "");
    assert.throws(() => next.reserve());
    unlinkSync(file + ".lock");
    unlinkSync(file);
    assert.throws(() =>
      new ProbeLedger(file, approval, digest, "lost", () => now).begin(),
    );
  }));
test("daily 20 percent reserve and monetary limits cannot be spent", () =>
  scratch((file) => {
    const ledger = new ProbeLedger(
      file,
      { ...approval, initialDailyUsed: 79 },
      digest,
      "one",
      () => now,
    );
    ledger.begin();
    ledger.reserve();
    assert.throws(() => ledger.reserve());
  }));
test("cost and experiment caps include every retry attempt", () =>
  scratch((file) => {
    const ledger = new ProbeLedger(
      file,
      {
        ...approval,
        maxExperimentAttempts: 2,
        attemptCostMicroUsd: 10,
        dailyCostMicroUsd: 20,
        monthlyCostMicroUsd: 20,
      },
      digest,
      "cost",
      () => now,
    );
    ledger.begin();
    ledger.reserve();
    ledger.reserve();
    assert.throws(() => ledger.reserve());
  }));
test("rolling minute includes attempts immediately before UTC midnight", () =>
  scratch((file) => {
    let clock = new Date("2026-11-27T23:59:58Z");
    const a = {
      ...approval,
      quotaAssessedAt: clock.toISOString(),
      expiresAt: "2026-11-28T00:30:00Z",
    };
    const first = new ProbeLedger(file, a, digest, "before", () => clock);
    first.begin();
    for (let i = 0; i < 5; i++) first.reserve();
    clock = new Date("2026-11-28T00:00:02Z");
    const second = new ProbeLedger(
      file,
      { ...a, quotaAssessedAt: clock.toISOString() },
      "1".repeat(64),
      "after",
      () => clock,
    );
    second.begin();
    assert.throws(() => second.reserve());
  }));
test("mock probe normalizes only minimal fields and honestly has no PIT/roster coverage", async () => {
  let reserved = 0;
  const r = await runProbe({
    transport: mockTransport(() => now),
    reserve: () => {
      reserved++;
    },
    now: () => now,
    token: "test-only",
    maxRequests: 3,
    synthetic: true,
    legalReference: "synthetic-test",
  });
  assert.equal(reserved, 2);
  assert.equal(r.report.networkRequests, 0);
  assert.equal(r.report.mode, "DRY_RUN_SYNTHETIC");
  assert.equal(r.report.stopReason, "PLAN_COMPLETE");
  assert.doesNotMatch(JSON.stringify(r), /SYNTHETIC A|test-only/);
  assert.equal(r.report.fieldCompleteness.ready, false);
});
test("401, 403 and 429 stop after one metered attempt and never log response bodies", async () => {
  for (const status of [401, 403, 429]) {
    let calls = 0;
    const r = await runProbe({
      transport: async () => {
        calls++;
        return Response.json({ secret: "DO_NOT_LOG" }, { status });
      },
      reserve: () => {},
      now: () => now,
      token: "private-token",
      maxRequests: 40,
      synthetic: true,
      legalReference: "synthetic-test",
    });
    assert.equal(calls, 1);
    assert.equal(r.report.stopReason, "AUTH_OR_RATE_STOP");
    assert.doesNotMatch(JSON.stringify(r), /DO_NOT_LOG|private-token/);
  }
});
test("retry reserves again, body cap stops, allowlist rejects redirects/other hosts", async () => {
  let calls = 0,
    charges = 0;
  const r = await runProbe({
    transport: async (_url, init) => {
      calls++;
      assert.equal(init?.redirect, "error");
      assert.ok(init?.signal);
      return new Response("", { status: 503 });
    },
    reserve: () => {
      charges++;
    },
    now: () => now,
    token: "test-only",
    maxRequests: 3,
    synthetic: true,
    legalReference: "synthetic-test",
  });
  assert.equal(calls, 2);
  assert.equal(charges, 2);
  assert.equal(r.report.stopReason, "HTTP_ERROR");
  const huge = await runProbe({
    transport: async () => new Response("x".repeat(1000001)),
    reserve: () => {},
    now: () => now,
    token: "test-only",
    maxRequests: 3,
    synthetic: true,
    legalReference: "synthetic-test",
  });
  assert.equal(huge.report.stopReason, "BODY_OR_SCHEMA_REJECTED");
  for (const url of [
    "https://evil.invalid/csgo/matches/upcoming",
    "https://api.pandascore.co/csgo/matches/upcoming?token=secret",
    "https://u:p@api.pandascore.co/csgo/matches/upcoming",
  ])
    assert.throws(() => assertProbeUrl(url));
});
test("reserve failure prevents transport and corrupt ledger fails closed", async () => {
  let calls = 0;
  const r = await runProbe({
    transport: async () => {
      calls++;
      return Response.json([]);
    },
    reserve: () => {
      throw new Error("limit");
    },
    now: () => now,
    token: "test-only",
    maxRequests: 3,
    synthetic: true,
    legalReference: "synthetic-test",
  });
  assert.equal(calls, 0);
  assert.equal(r.report.stopReason, "LEDGER_OR_QUOTA_STOP");
  scratch((file) => {
    writeFileSync(file, '{"bad":');
    assert.throws(() =>
      new ProbeLedger(file, approval, digest, "bad", () => now).begin(),
    );
  });
});
