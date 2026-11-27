import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  normalizePanda,
  object,
  utc,
} from "../supabase/functions/_shared/data.ts";
import { z } from "zod";
import { backtest } from "../supabase/functions/_shared/model.ts";
// Local-only input: {licenseConfirmed:true, observations:[{raw,obtainedAt}]}. Never fetches.
const [file, calibrationStart, testStart] = process.argv.slice(2);
if (!file || !calibrationStart || !testStart)
  throw new Error(
    "Usage: npx tsx scripts/backtest.ts LOCAL.json CALIBRATION_UTC TEST_UTC",
  );
const bytes = readFileSync(file);
if (bytes.length > 20_000_000) throw new Error("DATASET_TOO_LARGE");
const input = object(JSON.parse(bytes.toString("utf8")));
if (input.licenseConfirmed !== true || !Array.isArray(input.observations))
  throw new Error("LICENSE_AND_OBSERVATIONS_REQUIRED");
if (typeof input.synthetic !== "boolean")
  throw new Error("EXPLICIT_SYNTHETIC_CLASSIFICATION_REQUIRED");
if(input.synthetic!==true)throw new Error("REAL_DATA_REQUIRES_VALIDATED_DATASET_PIPELINE");
const classify = (m: ReturnType<typeof normalizePanda>) =>
  input.synthetic
    ? {
        ...m,
        provenance: { ...m.provenance, verification: "synthetic" as const },
      }
    : m;
const rows = input.observations.map((value) => {
  const row = object(value);
  return classify(normalizePanda(row.raw, utc(row.obtainedAt)));
});
const eventSnapshots = Array.isArray(input.prematchObservations)
  ? input.prematchObservations.map((value) => {
      const row = object(value);
      return classify(normalizePanda(row.raw, utc(row.obtainedAt)));
    })
  : [];
const rosterSchema = z.object({
  teamId: z.string().min(1),
  game: z.enum(["cs2", "dota2", "lol", "valorant"]),
  players: z.array(z.string().min(1)),
  effectiveFrom: z.string().datetime(),
  effectiveTo: z.string().datetime().nullable(),
  availableAt: z.string().datetime(),
  sourceId: z.string().min(1),
  verified: z.boolean(),
});
const rosters = z.array(rosterSchema).parse(input.rosters ?? []);
console.log(
  JSON.stringify(
    {
      datasetSha256: createHash("sha256").update(bytes).digest("hex"),
      observations: rows.length,
      ...backtest(rows, calibrationStart, testStart, {
        eventSnapshots,
        rosters,
        allowSynthetic: input.synthetic,
      }),
      productionApproved: false,
    },
    null,
    2,
  ),
);
