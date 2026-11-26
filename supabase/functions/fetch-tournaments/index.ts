import { secure, json } from "../_shared/security.ts";
import { runtime } from "../_shared/runtime.ts";
import { catalogue, catalogueUrl, BoundedCache, type Catalogue } from "../_shared/providers.ts";
const cache=new BoundedCache<Catalogue>();
// Tournament choices reflect only this bounded catalogue, not a complete league feed.
Deno.serve(secure("pandascore",async(body,paidFetch,userId)=>{
  const page=await cache.get(userId+":"+catalogueUrl(body),()=>catalogue(body,Deno.env.get("PANDA_SCORE_TOKEN")??"",paidFetch));
  const tournaments=[...new Map(page.matches.filter(m=>m.tournamentId&&m.tournament)
    .map(m=>[m.tournamentId,{id:m.tournamentId,name:m.tournament}])).values()];
  return json({tournaments,partial:true});
},runtime(key=>Deno.env.get(key))));
