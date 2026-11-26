import { secure, json, GateError } from '../_shared/security.ts';
import { runtime } from '../_shared/runtime.ts';
import { object, sourceId } from '../_shared/data.ts';
// Client-supplied statistics are never a trusted model input. No approved server-side
// historical dataset/model manifest exists yet. Keep Groq recovery helper unchanged.
Deno.serve(secure('groq',async(body)=>{
  const input=object(body);
  if(Object.keys(input).some(k=>k!=='matchId'))throw new GateError(400,'UNTRUSTED_PREDICTION_INPUT');
  sourceId(typeof input.matchId==='string'?input.matchId.replace(/^pandascore:/,''):input.matchId);
  return json({status:'INSUFFICIENT_DATA',reason:'VERIFIED_HISTORICAL_DATASET_AND_MODEL_REQUIRED',probability:null});
},runtime(key=>Deno.env.get(key))));
