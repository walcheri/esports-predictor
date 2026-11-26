import { secure, json, GateError } from "../_shared/security.ts";
import { runtime } from "../_shared/runtime.ts";
import { details, BoundedCache } from "../_shared/providers.ts";
import { object, sourceId, type Match } from "../_shared/data.ts";
const cache=new BoundedCache<Match>();
Deno.serve(secure("pandascore",async(body,paidFetch,userId)=>{
  const input=object(body);
  if(Object.keys(input).some(k=>k!=="matchId")) throw new GateError(400,"UNKNOWN_FIELD");
  const raw=input.matchId;
  const id=sourceId(typeof raw==="string"?raw.replace(/^pandascore:/,""):raw);
  const match=await cache.get(userId+":"+id,()=>details(body,Deno.env.get("PANDA_SCORE_TOKEN")??"",paidFetch));
  return json({match});
},runtime(key=>Deno.env.get(key))));
