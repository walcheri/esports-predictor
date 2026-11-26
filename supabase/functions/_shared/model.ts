import { type Match, utc } from './data.ts';
import { historical } from './statistics.ts';
export const MODEL_VERSION='series-elo-v1';
export type Forecast={status:'OK';probability:number;modelVersion:string;samples:[number,number];asOf:string}|{status:'INSUFFICIENT_DATA';reason:string;probability:null};
export type Options={minimumHistory?:number;maximumAgeDays?:number;allowSynthetic?:boolean};
export function predict(rows:Match[],event:Match,asOf:string,options:Options={}):Forecast{
 const t=Date.parse(utc(asOf));const missing=(reason:string):Forecast=>({status:'INSUFFICIENT_DATA',reason,probability:null});
 if(!event.team1 || !event.team2 || !event.bestOf || !event.startsAt || Date.parse(event.startsAt)<t)return missing('EVENT_METADATA_OR_PREMATCH_TIME');
 if(event.team1.id===event.team2.id)return missing('IDENTITY_CONFLICT');
 const past=historical(rows,event.game,asOf,options.allowSynthetic).filter(m=>m.id!==event.id && m.bestOf===event.bestOf);
 const ratings=new Map<string,number>(),counts=new Map<string,number>(),last=new Map<string,number>();
 // Equal end times are updated as one batch: stable ordering cannot leak same-time results.
 for(let i=0;i<past.length;){
  let j=i;const delta=new Map<string,number>();
  while(j<past.length && past[j].endedAt===past[i].endedAt){
   const m=past[j++],a=m.team1!.id,b=m.team2!.id,p=1/(1+10**(((ratings.get(b)??1500)-(ratings.get(a)??1500))/400));
   const d=24*(Number(m.winnerId===a)-p);delta.set(a,(delta.get(a)??0)+d);delta.set(b,(delta.get(b)??0)-d);
   for(const id of [a,b]){counts.set(id,(counts.get(id)??0)+1);last.set(id,Date.parse(m.endedAt!));}
  }
  for(const [id,d] of delta)ratings.set(id,(ratings.get(id)??1500)+d);i=j;
 }
 const a=event.team1.id,b=event.team2.id,ca=counts.get(a)??0,cb=counts.get(b)??0;
 if(ca<(options.minimumHistory??10)||cb<(options.minimumHistory??10))return missing('HISTORY_SAMPLE_TOO_SMALL');
 if([a,b].some(id=>t-(last.get(id)??0)>(options.maximumAgeDays??90)*86400000))return missing('STALE_HISTORY');
 return {status:'OK',probability:1/(1+10**(((ratings.get(b)??1500)-(ratings.get(a)??1500))/400)),modelVersion:MODEL_VERSION,samples:[ca,cb],asOf:utc(asOf)};
}
export type Observation={id:string;at:string;game:string;bestOf:number;p:number;y:number};
export function scores(rows:Observation[]){
 if(!rows.length)return {n:0,brier:null,logLoss:null,baselineBrier:null,baselineLogLoss:null,calibration:[]};
 const bins=Array.from({length:10},(_,i)=>{const r=rows.filter(x=>Math.min(9,Math.floor(x.p*10))===i);return {lower:i/10,n:r.length,predicted:r.length?r.reduce((a,b)=>a+b.p,0)/r.length:null,observed:r.length?r.reduce((a,b)=>a+b.y,0)/r.length:null};});
 return {n:rows.length,brier:rows.reduce((a,r)=>a+(r.p-r.y)**2,0)/rows.length,
 logLoss:-rows.reduce((a,r)=>{const p=Math.min(1-1e-12,Math.max(1e-12,r.p));return a+r.y*Math.log(p)+(1-r.y)*Math.log(1-p);},0)/rows.length,
 baselineBrier:0.25,baselineLogLoss:Math.log(2),calibration:bins};
}
export function temperature(p:number,t:number){return 1/(1+Math.exp(-Math.log(Math.max(1e-12,p)/Math.max(1e-12,1-p))/t));}
export function backtest(rows:Match[],calibrationStart:string,testStart:string,options:Options={}){
 const cal=Date.parse(utc(calibrationStart)),split=Date.parse(utc(testStart));if(cal>=split)throw new Error('INVALID_CHRONOLOGICAL_SPLIT');
 const observations:Observation[]=[];let eligible=0,abstained=0;
 // Quarantine conflicting records before selecting targets too.
 const targets=historical(rows,'cs2','9999-01-01T00:00:00Z',options.allowSynthetic)
 .concat(...(['dota2','lol','valorant'] as const).map(g=>historical(rows,g,'9999-01-01T00:00:00Z',options.allowSynthetic)));
 for(const m of targets){if(!m.startsAt || Date.parse(m.startsAt)<cal)continue;
  if(Date.parse(m.startsAt)>=split)eligible++;
  const f=predict(rows,m,m.startsAt,options);if(f.status!=='OK'){if(Date.parse(m.startsAt)>=split)abstained++;continue;}
  observations.push({id:m.id,at:m.startsAt,game:m.game,bestOf:m.bestOf!,p:f.probability,y:Number(m.winnerId===m.team1!.id)});
 }
 const calibration=observations.filter(r=>Date.parse(r.at)<split &&
  rows.some(m=>m.id===r.id && m.endedAt && Date.parse(m.endedAt)<split && Date.parse(m.provenance.availableAt)<split));
 // Only a predeclared finite grid fitted on a separate calibration period.
 let fitted=1;
 if(calibration.length>=30)fitted=[0.75,1,1.5,2].sort((a,b)=>scores(calibration.map(r=>({...r,p:temperature(r.p,a)}))).logLoss!-scores(calibration.map(r=>({...r,p:temperature(r.p,b)}))).logLoss!)[0];
 const test=observations.filter(r=>Date.parse(r.at)>=split),adjusted=test.map(r=>({...r,p:temperature(r.p,fitted)}));
 const groups=Object.fromEntries(['cs2','dota2','lol','valorant'].flatMap(g=>[1,3,5].map(bo=>[`${g}/BO${bo}`,scores(adjusted.filter(r=>r.game===g&&r.bestOf===bo))])));
 return {model:MODEL_VERSION,synthetic:options.allowSynthetic===true,eligible,abstained,coverage:eligible?test.length/eligible:null,
 calibrationSamples:calibration.length,temperature:fitted,calibrationFitted:calibration.length>=30,raw:scores(test),calibrated:scores(adjusted),groups,
 limitations:['Series Elo stratified by BO; no map-independence assumption','Roster/patch effects not modeled; research baseline only','No production quality approval implied']};
}
