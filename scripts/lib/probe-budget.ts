import { z } from "zod";
import {
  openSync,
  closeSync,
  writeSync,
  fsyncSync,
  readFileSync,
  existsSync,
  unlinkSync,
  statSync,
} from "node:fs";
import { reference } from "./dataset.ts";
export const approvalSchema = z
  .object({
    schemaVersion: z.literal("predictor-probe-approval-v1"),
    approvedByOwner: z.literal(true),
    approvalReference: reference,
    provider: z.literal("pandascore"),
    game: z.literal("cs2"),
    plan: reference,
    documentationReviewed: z.literal(true),
    tariffLimitsVerified: z.literal(true),
    storageAllowed: z.literal(true),
    backtestAllowed: z.literal(true),
    purpose: z.literal("closed-noncommercial"),
    noOtherClients: z.literal(true),
    expiresAt: z.string().datetime(),
    licenseExpiresAt: z.string().datetime().nullable(),
    quotaAssessedAt: z.string().datetime(),
    dailyAttemptBudget: z.number().int().min(1).max(50000),
    minuteAttemptBudget: z.number().int().min(1).max(5),
    maxExperimentAttempts: z.number().int().min(1).max(40),
    initialDailyUsed: z.number().int().nonnegative(),
    initialMonthlyCostMicroUsd: z.number().int().nonnegative(),
    attemptCostMicroUsd: z.number().int().nonnegative(),
    dailyCostMicroUsd: z.number().int().nonnegative(),
    monthlyCostMicroUsd: z.number().int().nonnegative(),
  })
  .strict();
export type Approval = z.infer<typeof approvalSchema>;
export function checkApproval(
  input: unknown,
  expected: string,
  actual: string,
  now: Date,
): Approval {
  if (!/^[a-f0-9]{64}$/.test(expected) || expected !== actual)
    throw new Error("APPROVAL_DIGEST_MISMATCH");
  const a = approvalSchema.parse(input),
    t = +now,
    assessed = Date.parse(a.quotaAssessedAt),
    expiry = Date.parse(a.expiresAt);
  if (
    (a.licenseExpiresAt && Date.parse(a.licenseExpiresAt) <= t) ||
    assessed > t ||
    t - assessed > 15 * 60000 ||
    expiry <= t ||
    expiry - t > 24 * 3600000 ||
    a.quotaAssessedAt.slice(0, 10) !== now.toISOString().slice(0, 10)
  )
    throw new Error("STALE_APPROVAL_OR_QUOTA");
  if (a.initialDailyUsed >= Math.floor(a.dailyAttemptBudget * 0.8))
    throw new Error("QUOTA_RESERVE_REACHED");
  return a;
}
type Entry = {
  kind: "baseline" | "run" | "attempt";
  at: string;
  approval: string;
  runId: string;
  used?: number;
  monthlyCost?: number;
  cost?: number;
};
/** Append+fsync before HTTP. A crash leaves an exclusive lock: manual inspection, never auto-reset. */
export class ProbeLedger {
  constructor(
    private path: string,
    private approval: Approval,
    private digest: string,
    private runId: string,
    private now: () => Date = () => new Date(),
  ) {}
  private transaction<T>(
    fn: (rows: Entry[], append: (e: Entry) => void) => T,
  ): T {
    const lock = openSync(this.path + ".lock", "wx", 0o600);
    try {
      if (existsSync(this.path + ".initialized") !== existsSync(this.path))
        throw new Error("MISSING_DURABLE_LEDGER");
      if (existsSync(this.path) && statSync(this.path).size > 10000000)
        throw new Error("LEDGER_SIZE_LIMIT");
      const rows: Entry[] = existsSync(this.path)
        ? readFileSync(this.path, "utf8")
            .split("\n")
            .filter(Boolean)
            .map((s) => JSON.parse(s))
        : [];
      if (existsSync(this.path + ".initialized") && rows.length === 0)
        throw new Error("EMPTY_INITIALIZED_LEDGER");
      if (
        rows.some(
          (r) =>
            !["baseline", "run", "attempt"].includes(r.kind) ||
            !Number.isFinite(Date.parse(r.at)) ||
            typeof r.approval !== "string" ||
            typeof r.runId !== "string" ||
            (r.kind === "baseline" &&
              (!Number.isSafeInteger(r.used) ||
                r.used! < 0 ||
                !Number.isSafeInteger(r.monthlyCost) ||
                r.monthlyCost! < 0)) ||
            (r.kind === "attempt" &&
              (!Number.isSafeInteger(r.cost) || r.cost! < 0)),
        )
      )
        throw new Error("CORRUPT_LEDGER");
      if (rows.some((r) => Date.parse(r.at) > +this.now()))
        throw new Error("CLOCK_ROLLBACK");
      const append = (e: Entry) => {
        const fd = openSync(this.path, "a", 0o600);
        try {
          writeSync(fd, JSON.stringify(e) + "\n");
          fsyncSync(fd);
        } finally {
          closeSync(fd);
        }
        rows.push(e);
      };
      return fn(rows, append);
    } finally {
      closeSync(lock);
      unlinkSync(this.path + ".lock");
    }
  }
  begin() {
    return this.transaction((rows, append) => {
      if (rows.some((r) => r.kind === "run" && r.runId === this.runId))
        throw new Error("RUN_ALREADY_STARTED");
      const at = this.now().toISOString();
      if (!existsSync(this.path + ".initialized")) {
        const marker = openSync(this.path + ".initialized", "wx", 0o600);
        closeSync(marker);
      }
      if (
        !rows.some(
          (r) => r.kind === "baseline" && r.at.slice(0, 10) === at.slice(0, 10),
        )
      )
        append({
          kind: "baseline",
          at,
          approval: this.digest,
          runId: this.runId,
          used: this.approval.initialDailyUsed,
          monthlyCost: this.approval.initialMonthlyCostMicroUsd,
        });
      append({ kind: "run", at, approval: this.digest, runId: this.runId });
    });
  }
  reserve() {
    return this.transaction((rows, append) => {
      const now = this.now(),
        at = now.toISOString(),
        a = this.approval;
      if (
        (a.licenseExpiresAt && +now >= Date.parse(a.licenseExpiresAt)) ||
        +now >= Date.parse(a.expiresAt) ||
        a.quotaAssessedAt.slice(0, 10) !== at.slice(0, 10)
      )
        throw new Error("APPROVAL_EXPIRED");
      const day = rows.filter((r) => r.at.slice(0, 10) === at.slice(0, 10)),
        attempts = day.filter((r) => r.kind === "attempt"),
        baseline = day.find((r) => r.kind === "baseline");
      if (
        !baseline ||
        !Number.isSafeInteger(baseline.used) ||
        !Number.isSafeInteger(baseline.monthlyCost) ||
        !rows.some((r) => r.kind === "run" && r.runId === this.runId)
      )
        throw new Error("INVALID_LEDGER_BASELINE");
      const cost = attempts.reduce((n, r) => n + r.cost!, 0),
        month = rows
          .filter(
            (r) => r.kind === "attempt" && r.at.slice(0, 7) === at.slice(0, 7),
          )
          .reduce((n, r) => n + r.cost!, 0);
      const monthlyBase = Math.max(
        a.initialMonthlyCostMicroUsd,
        ...rows
          .filter(
            (r) => r.kind === "baseline" && r.at.slice(0, 7) === at.slice(0, 7),
          )
          .map((r) => r.monthlyCost ?? 0),
      );
      if (
        Math.max(baseline.used!, a.initialDailyUsed) + attempts.length + 1 >
          Math.floor(a.dailyAttemptBudget * 0.8) ||
        cost + a.attemptCostMicroUsd > a.dailyCostMicroUsd ||
        monthlyBase + month + a.attemptCostMicroUsd > a.monthlyCostMicroUsd
      )
        throw new Error("QUOTA_RESERVE_REACHED");
      if (
        rows.filter((r) => r.kind === "attempt" && r.approval === this.digest)
          .length >= a.maxExperimentAttempts
      )
        throw new Error("EXPERIMENT_BUDGET_EXHAUSTED");
      if (
        rows.filter(
          (r) => r.kind === "attempt" && +now - Date.parse(r.at) < 60000,
        ).length >= a.minuteAttemptBudget
      )
        throw new Error("MINUTE_LIMIT_STOP");
      append({
        kind: "attempt",
        at,
        approval: this.digest,
        runId: this.runId,
        cost: a.attemptCostMicroUsd,
      });
    });
  }
}
