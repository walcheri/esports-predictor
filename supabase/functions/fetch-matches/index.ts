import { secure, json } from "../_shared/security.ts";
import { runtime } from "../_shared/runtime.ts";
import { catalogue, catalogueUrl, BoundedCache, type Catalogue } from "../_shared/providers.ts";
const cache=new BoundedCache<Catalogue>();
Deno.serve(secure("pandascore",async(body,paidFetch,userId)=>{
  const key=userId+":"+catalogueUrl(body);
  return json(await cache.get(key,()=>catalogue(body,Deno.env.get("PANDA_SCORE_TOKEN")??"",paidFetch)));
},runtime(key=>Deno.env.get(key))));
