import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizePanda, normalizePage, utc } from "../supabase/functions/_shared/data.ts";
import { BoundedCache, catalogueUrl, details } from "../supabase/functions/_shared/providers.ts";
export const at="2030-01-01T00:00:00.000Z";
export const raw={id:1,videogame:{slug:"csgo"},status:"not_started",scheduled_at:"2030-01-02T00:00:00Z",
  number_of_games:3,tournament:{id:8,name:"Synthetic cup"},opponents:[
    {opponent:{id:2,name:"Synthetic A"}},{opponent:{id:3,name:"Synthetic B"}},
  ]};
test("canonical provider identities and UTC preserved, no invented roster/maps",()=>{
  const m=normalizePanda(raw,at); assert.equal(m.id,"pandascore:1");assert.equal(m.game,"cs2");
  assert.equal(m.startsAt,"2030-01-02T00:00:00.000Z");assert.equal(m.winnerId,null);assert.deepEqual(m.games,[]);
});
test("missing teams/BO remain unknown; unsupported discipline never becomes CS2",()=>{
  const m=normalizePanda({...raw,opponents:[],number_of_games:null},at);
  assert.equal(m.team1,null);assert.equal(m.bestOf,null);
  assert.throws(()=>normalizePanda({...raw,videogame:{slug:"unknown"}},at));
});
test("calendar rollover and ambiguous dates rejected",()=>{
  for(const d of ["2030-02-30T00:00:00Z","01.02 12:30","2030-01-01T00:00:00"])assert.throws(()=>utc(d));
});
test("contradictory snapshots quarantine the event; exact duplicates deduplicate",()=>{
  assert.equal(normalizePage([raw,raw],at).matches.length,1);
  const result=normalizePage([raw,{...raw,number_of_games:5}],at);
  assert.equal(result.matches.length,0);assert.equal(result.conflicts,1);
});
test("missing winner never becomes away win",()=>{
  assert.equal(normalizePanda({...raw,status:"finished",end_at:"2030-01-02T01:00:00Z"},at).winnerId,null);
  assert.throws(()=>normalizePanda({...raw,winner_id:999},at));
});
test("query always applies requested date/status and bounds pagination",()=>{
  const u=new URL(catalogueUrl({game:"cs2",status:"upcoming",date:"today"},new Date(at)));
  assert.ok(u.searchParams.has("range[scheduled_at]"));assert.equal(u.searchParams.get("per_page"),"100");
  assert.throws(()=>catalogueUrl({game:"bogus"}));assert.throws(()=>catalogueUrl({arbitrary:"data"}));
});
test("cache deduplicates concurrent load, expires, never caches failure",async()=>{
  let clock=0,calls=0;const cache=new BoundedCache<number>(10,2,()=>clock);
  const load=async()=>{calls++;return 7;};
  assert.deepEqual(await Promise.all([cache.get("x",load),cache.get("x",load)]),[7,7]);assert.equal(calls,1);
  clock=11;await cache.get("x",load);assert.equal(calls,2);
  await assert.rejects(cache.get("y",async()=>{throw Error("offline");}));
  assert.equal(await cache.get("y",load),7);
});
test("detail response must retain requested ID; errors do not leak provider text",async()=>{
  const fetcher:typeof fetch=async()=>Response.json({...raw,id:99});
  await assert.rejects(details({matchId:"pandascore:1"},"synthetic",fetcher),/EVENT_ID_CONFLICT/);
});
