import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePanda } from '../supabase/functions/_shared/data.ts';
import { predict, backtest, scores } from '../supabase/functions/_shared/model.ts';
function fixture(id:number,day:number){const d=new Date(Date.UTC(2026,0,day));const end=new Date(+d+3600000).toISOString();return normalizePanda({id,videogame:{slug:'csgo'},opponents:[{opponent:{id:1,name:'A'}},{opponent:{id:2,name:'B'}}],status:'finished',winner_id:id%3===0?2:1,scheduled_at:d.toISOString(),end_at:end,number_of_games:3},end);}
const rows=Array.from({length:80},(_,i)=>fixture(i+1,i+1));
test('abstains on inadequate or stale history and unknown BO',()=>{
 const e=fixture(99,100);assert.equal(predict([],e,e.startsAt!).status,'INSUFFICIENT_DATA');
 assert.equal(predict(rows,{...e,bestOf:null},e.startsAt!).status,'INSUFFICIENT_DATA');
 const late=fixture(999,300);assert.equal(predict(rows,late,late.startsAt!).status,'INSUFFICIENT_DATA');
});
test('future results cannot alter a historical prediction; deterministic team reversal',()=>{
 const e=rows[30],p=predict(rows,e,e.startsAt!);assert.deepEqual(p,predict(rows.slice(0,30),e,e.startsAt!));
 const q=predict(rows,{...e,team1:e.team2,team2:e.team1},e.startsAt!);
 assert.equal(p.status,'OK');if(p.status==='OK'&&q.status==='OK')assert.ok(Math.abs(p.probability+q.probability-1)<1e-12);
});
test('Brier and log loss known reference; empty sample unknown',()=>{
 const m=scores([{id:'a',at:'',game:'cs2',bestOf:3,p:0.5,y:1}]);assert.equal(m.brier,0.25);assert.equal(m.logLoss,Math.log(2));assert.equal(scores([]).brier,null);
});
test('chronological held-out report and no false calibration claim for small data',()=>{
 const r=backtest(rows,'2026-01-20T00:00:00Z','2026-02-01T00:00:00Z');
 assert.equal(r.calibrationFitted,false);assert.equal(r.temperature,1);assert.equal(r.groups['dota2/BO1'].n,0);assert.ok(r.raw.n>0);
 assert.throws(()=>backtest(rows,'2026-02-01T00:00:00Z','2026-01-01T00:00:00Z'));
});
