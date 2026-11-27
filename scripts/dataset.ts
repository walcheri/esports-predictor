import { readdirSync } from "node:fs";
import { parseArgs } from "node:util";
import { join } from "node:path";
import { validateDataset, sha256 } from "./lib/dataset.ts";
import { localDir, readBoundedJson, writeNew } from "./lib/local.ts";
import { syntheticDataset } from "./lib/synthetic.ts";
import { backtest } from "../supabase/functions/_shared/model.ts";
try {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      input: { type: "string" },
      out: { type: "string" },
      "calibration-start": { type: "string" },
      "test-start": { type: "string" },
    },
  });
  const command = positionals[0];
  if (
    positionals.length !== 1 ||
    !["example", "validate-dataset", "convert", "backtest"].includes(command) ||
    !values.out
  )
    throw new Error("USAGE");
  const dir = localDir(values.out);
  if (readdirSync(dir).length) throw new Error("FRESH_OUTPUT_REQUIRED");
  if (command === "example") {
    writeNew(join(dir, "synthetic.json"), syntheticDataset());
    console.log(
      JSON.stringify({
        synthetic: true,
        networkRequests: 0,
        status: "EXAMPLE_CREATED",
      }),
    );
  } else {
    if (!values.input) throw new Error("INPUT_REQUIRED");
    const result = validateDataset(readBoundedJson(values.input));
    const manifest = {
      ...result.manifest,
      convertedSha256: result.converted
        ? sha256(JSON.stringify(result.converted))
        : null,
    };
    writeNew(join(dir, "manifest.json"), manifest);
    writeNew(join(dir, "quarantine.json"), result.quarantine);
    if (!result.converted) {
      process.exitCode = 2;
      console.log(
        JSON.stringify({
          status: "INSUFFICIENT_DATA",
          manifestReady: false,
          networkRequests: 0,
        }),
      );
    } else {
      if (command !== "validate-dataset")
        writeNew(join(dir, "converted.json"), result.converted);
      let status = "VALIDATED";
      if (command === "backtest") {
        if (!values["calibration-start"] || !values["test-start"])
          throw new Error("SPLIT_REQUIRED");
        const d = result.converted,
          r = backtest(
            d.matches,
            values["calibration-start"],
            values["test-start"],
            {
              eventSnapshots: d.eventSnapshots,
              rosters: d.rosters,
              allowSynthetic: d.synthetic,
            },
          );
        status =
          r.raw.n >= 30 && r.calibrationFitted
            ? "OFFLINE_EVALUATION_COMPLETE"
            : "INSUFFICIENT_DATA";
        writeNew(join(dir, "backtest.json"), {
          ...r,
          status,
          datasetSha256: d.inputSha256,
          productionApproved: false,
          minimumHeldOutSamples: 30,
        });
        if (status === "INSUFFICIENT_DATA") process.exitCode = 2;
      }
      console.log(
        JSON.stringify({
          status,
          synthetic: result.converted.synthetic,
          networkRequests: 0,
          productionApproved: false,
        }),
      );
    }
  }
} catch {
  console.error(
    JSON.stringify({
      error: "DATASET_COMMAND_REJECTED",
      hint: "Check schema, arguments, local paths and fresh output directory; input contents redacted.",
      networkRequests: 0,
    }),
  );
  process.exitCode = 1;
}
