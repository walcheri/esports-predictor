import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { normalizePanda, object, utc } from '../supabase/functions/_shared/data.ts';
import { backtest } from '../supabase/functions/_shared/model.ts';
// Local-only input: {licenseConfirmed:true, observations:[{raw,obtainedAt}]}. Never fetches.
const [file,calibrationStart,testStart]=process.argv.slice(2);
if(!file || !calibrationStart || !testStart)throw new Error('Usage: npx tsx scripts/backtest.ts LOCAL.json CALIBRATION_UTC TEST_UTC');
const bytes=readFileSync(file);if(bytes.length>20_000_000)throw new Error('DATASET_TOO_LARGE');
const input=object(JSON.parse(bytes.toString('utf8')));
if(input.licenseConfirmed!==true || !Array.isArray(input.observations))throw new Error('LICENSE_AND_OBSERVATIONS_REQUIRED');
const rows=input.observations.map(value=>{const row=object(value);return normalizePanda(row.raw,utc(row.obtainedAt));});
console.log(JSON.stringify({datasetSha256:createHash('sha256').update(bytes).digest('hex'),observations:rows.length,
 ...backtest(rows,calibrationStart,testStart),productionApproved:false},null,2));
