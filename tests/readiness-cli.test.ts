import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
const root = ".local/cli-test-" + randomUUID();
function cli(script: string, args: string[], exit = 0) {
  const r = spawnSync(
    process.execPath,
    ["node_modules/tsx/dist/cli.mjs", script, ...args],
    { encoding: "utf8", timeout: 30000 },
  );
  assert.equal(r.status, exit, r.stdout + r.stderr);
  assert.doesNotMatch(r.stdout + r.stderr, /Bearer /);
  return r.stdout;
}
test("offline CLI example, validation, conversion and chronological backtest end to end", () => {
  cli("scripts/dataset.ts", ["example", "--out", root + "/example"]);
  const input = root + "/example/synthetic.json";
  cli("scripts/dataset.ts", [
    "validate-dataset",
    "--input",
    input,
    "--out",
    root + "/validation",
  ]);
  cli("scripts/dataset.ts", [
    "convert",
    "--input",
    input,
    "--out",
    root + "/conversion",
  ]);
  cli("scripts/dataset.ts", [
    "backtest",
    "--input",
    input,
    "--out",
    root + "/evaluation",
    "--calibration-start",
    "2026-01-11T00:00:00Z",
    "--test-start",
    "2026-02-15T00:00:00Z",
  ]);
  const r = JSON.parse(
    readFileSync(root + "/evaluation/backtest.json", "utf8"),
  );
  assert.equal(r.status, "OFFLINE_EVALUATION_COMPLETE");
  assert.equal(r.productionApproved, false);
  cli(
    "scripts/dataset.ts",
    ["convert", "--input", input, "--out", root + "/conversion"],
    1,
  );
});
test("default probe never needs secrets and its insufficient sample fails downstream validation", () => {
  const output = cli("scripts/probe.ts", ["--out", root + "/probe"]);
  assert.equal(JSON.parse(output).networkRequests, 0);
  cli(
    "scripts/dataset.ts",
    [
      "validate-dataset",
      "--input",
      root + "/probe/sample.json",
      "--out",
      root + "/probe-validation",
    ],
    2,
  );
  cli("scripts/probe.ts", ["--out", root + "/probe"], 1);
});
