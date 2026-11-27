import { parseArgs } from "node:util";
import { join } from "node:path";
import { readFileSync, appendFileSync, readdirSync } from "node:fs";
import { sha256 } from "./lib/dataset.ts";
import { localDir, readBoundedJson, writeNew } from "./lib/local.ts";
import { checkApproval, ProbeLedger } from "./lib/probe-budget.ts";
import { runProbe, mockTransport } from "./lib/probe.ts";
try {
  const { values } = parseArgs({
    options: {
      live: { type: "boolean", default: false },
      provider: { type: "string", default: "pandascore" },
      game: { type: "string", default: "cs2" },
      out: { type: "string" },
      approval: { type: "string" },
      "approval-sha256": { type: "string" },
      "run-id": { type: "string" },
      "max-requests": { type: "string", default: "3" },
    },
  });
  if (values.provider !== "pandascore" || values.game !== "cs2" || !values.out)
    throw new Error("UNSUPPORTED_PROBE_SCOPE");
  const maxRequests = Number(values["max-requests"]);
  if (!Number.isInteger(maxRequests) || maxRequests < 1 || maxRequests > 40)
    throw new Error("INVALID_CAP");
  const now = () => new Date();
  let token = "SYNTHETIC-NOT-A-KEY",
    reserve = () => {},
    reference = "synthetic-owned-fixture",
    licenseExpiresAt: string | null = null;
  if (values.live) {
    if (
      !values.approval ||
      !values["approval-sha256"] ||
      !values["run-id"] ||
      !/^[-a-zA-Z0-9_]{1,64}$/.test(values["run-id"])
    )
      throw new Error("EXPLICIT_APPROVAL_REQUIRED");
    const approval = checkApproval(
      readBoundedJson(values.approval, 32000),
      values["approval-sha256"].toLowerCase(),
      sha256(readFileSync(values.approval)),
      now(),
    );
    if (maxRequests > approval.maxExperimentAttempts)
      throw new Error("CAP_EXCEEDS_APPROVAL");
    token = process.env.PANDASCORE_PROBE_TOKEN ?? "";
    if (token.length < 16 || token.length > 4096 || /\s/.test(token))
      throw new Error("APPROVED_SERVER_SECRET_REQUIRED");
    const ledger = new ProbeLedger(
      join(localDir(".local/probe-state"), "pandascore.jsonl"),
      approval,
      values["approval-sha256"].toLowerCase(),
      values["run-id"],
      now,
    );
    // Validate output before a durable run claim. A failed output cannot spend quota.
    const dest = localDir(values.out);
    if (readdirSync(dest).length) throw new Error("FRESH_OUTPUT_REQUIRED");
    ledger.begin();
    reserve = () => ledger.reserve();
    reference = approval.approvalReference;
    licenseExpiresAt = approval.licenseExpiresAt;
  }
  const dir = localDir(values.out);
  if (readdirSync(dir).length) throw new Error("FRESH_OUTPUT_REQUIRED");
  writeNew(join(dir, "run.json"), {
    mode: values.live ? "LIVE_APPROVED" : "DRY_RUN_SYNTHETIC",
    startedAt: now().toISOString(),
  });
  const result = await runProbe({
    transport: values.live ? fetch : mockTransport(now),
    reserve,
    now,
    token,
    maxRequests,
    synthetic: !values.live,
    legalReference: reference,
    licenseExpiresAt,
    record: (r) =>
      appendFileSync(join(dir, "requests.jsonl"), JSON.stringify(r) + "\n", {
        mode: 0o600,
      }),
  });
  writeNew(join(dir, "sample.json"), result.dataset);
  writeNew(join(dir, "report.json"), result.report);
  writeNew(join(dir, "quarantine.json"), result.quarantine);
  console.log(
    JSON.stringify({
      mode: result.report.mode,
      networkRequests: result.report.networkRequests,
      transportAttempts: result.report.transportAttempts,
      stopReason: result.report.stopReason,
      productionApproved: false,
    }),
  );
  if (result.report.stopReason !== "PLAN_COMPLETE") process.exitCode = 2;
} catch {
  console.error(
    JSON.stringify({
      error: "PROBE_REJECTED",
      hint: "Check explicit approval, secret configuration, ledger and fresh local output; no secret/error bodies printed.",
    }),
  );
  process.exitCode = 1;
}
