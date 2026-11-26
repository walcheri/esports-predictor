import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePanda } from '../supabase/functions/_shared/data.ts';
import { statistics, historical, rosterAt } from '../supabase/functions/_shared/statistics.ts';
const at='2026-01-05T00:00:00Z';
function match(id=1){return normalizePanda({id,videogame:{slug:'dota2'},opponents:[{opponent:{id:1,name:'A'}},{opponent:{id:2,name:'B'}}],status:'finished',winner_id:1,scheduled_at:'2026-01-01T00:00:00Z',end_at:'2026-01-01T01:00:00Z',number_of_games:3},'2026-01-02T00:00:00Z');}
test('series rate never becomes map rate; unknown metrics remain null',()=>{
 const s=statistics([match()],'pandascore:1','pandascore:2','dota2',at);
 assert.equal(s.series.rate,1);assert.deepEqual(s.maps,{});assert.equal(s.playerRatings,null);
 assert.equal(statistics([],'a','b','dota2',at).series.rate,null);
});
test('future results, unavailable observations, wrong discipline and conflicting duplicates excluded',()=>{
 const m=match();assert.equal(historical([m],'dota2','2026-01-01T00:30:00Z').length,0);
 assert.equal(historical([m],'dota2','2026-01-01T02:00:00Z').length,0);
 assert.equal(historical([m],'cs2',at).length,0);
 assert.equal(historical([m,{...m,winnerId:'pandascore:2'}],'dota2',at).length,0);
 assert.equal(historical([m,m],'dota2',at).length,1);
});
test('H2H uses exact identities; last five counts only five matches',()=>{
 const rows=Array.from({length:10},(_,i)=>match(i+1));
 const s=statistics(rows,'pandascore:1','pandascore:22','dota2',at);
 assert.equal(s.h2h.observations,0);assert.equal(s.last5.observations,5);assert.equal(s.last10.observations,10);
});
test('historical roster cannot use current or conflicting assignment',()=>{
 const r={teamId:'a',game:'dota2' as const,players:['p'],effectiveFrom:'2026-01-01T00:00:00Z',effectiveTo:null,availableAt:'2026-01-02T00:00:00Z',sourceId:'r',verified:true};
 assert.equal(rosterAt([r],'a','dota2','2025-01-01T00:00:00Z'),null);
 assert.equal(rosterAt([r,{...r,sourceId:'other'}],'a','dota2',at),null);
 assert.equal(rosterAt([r],'a','dota2',at)?.sourceId,'r');
});
