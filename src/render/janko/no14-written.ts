import type {QuantizedGridScore} from '../../model/types';
import {SCHUMANN_NO14_APPROVED_SHA256,schumannNo14WrittenFacts} from '../../scores/schumann-no14-draft';
import {no14PracticeScore} from './no14-practice';
export const NO14_WRITTEN_SCORE_ID='schumann-op68-no14-written-practice';
const fields=['notes','dynamics','pedals','phrases','sourceSilences'] as const;
type Field=typeof fields[number];
const sourceId=(id:string)=>id.replace(/:\d+$/,':1');
/** Normalize only unfolded clock/occurrence identity. All pitches, values,
 * voices, hands, source locations and other musical fields remain comparable. */
function equivalent(value:unknown,offset:number,key=''):unknown{
 if(Array.isArray(value))return value.map(v=>equivalent(v,offset,key));
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,equivalent(v,offset,k)]));
 if(typeof value==='number'&&['tick','startTick','endTick'].includes(key))return value-offset;
 if(key==='occurrence')return 1;
 if(typeof value==='string'&&['id','fromNoteIds','toNoteIds'].includes(key))return sourceId(value);
 return value;
}
export function projectNo14Written(performed:QuantizedGridScore=no14PracticeScore()){
 const facts=schumannNo14WrittenFacts;
 if(facts.sourceHash!==SCHUMANN_NO14_APPROVED_SHA256||facts.bars.length!==64||facts.occurrences.length!==96||facts.repeats.length!==1||facts.repeats[0].start!==32||facts.repeats[0].end!==63||facts.repeats[0].alternatives.length)throw Error('Unsupported No14 written repeat graph');
 if(performed.totalTicks!==13824||performed.notes.length!==574||performed.tieChains?.length||performed.graceGroups?.length)throw Error('Unsupported No14 performed inventory');
 const occurrences=facts.occurrences.map((q,i)=>({performedBar:i+1,writtenBar:q.sourceBar+1,pass:q.pass,performedTick:performed.sourceBarTicks![i],writtenTick:q.sourceBar*144}));
 const score=structuredClone(performed),events:NonNullable<QuantizedGridScore['writtenPresentation']>['events']={};
 for(const field of fields){
  const original=(performed[field]??[]) as unknown as Record<string,unknown>[];
  const clock=(q:Record<string,unknown>)=>Number(q.startTick??q.tick);
  const selected=original.filter(q=>occurrences[Math.floor(clock(q)/144)]?.pass===1);
  const first=selected.filter(q=>clock(q)>=4608),second=original.filter(q=>clock(q)>=9216);
  if(JSON.stringify(first.map(q=>equivalent(q,0)))!==JSON.stringify(second.map(q=>equivalent(q,4608))))throw Error(`No14 repeat collapse refused: ${field} changes between passes`);
  (score as unknown as Record<string,unknown>)[field]=structuredClone(selected);
  events[field]=original.map((q,performedIndex)=>{
   const o=occurrences[Math.floor(clock(q)/144)];if(!o)throw Error(`No14 ${field} has unsupported boundary event`);
   const normalized=JSON.stringify(equivalent(q,o.performedTick-o.writtenTick));
   const writtenIndex=selected.findIndex(w=>JSON.stringify(equivalent(w,0))===normalized);if(writtenIndex<0)throw Error(`No14 ${field} has no exact written owner`);
   const w=selected[writtenIndex],overrides=Object.fromEntries(Object.entries(q).filter(([k,v])=>JSON.stringify(v)!==JSON.stringify(w[k])));
   return {writtenIndex,performedIndex,overrides};
  });
 }
 score.id=NO14_WRITTEN_SCORE_ID;score.totalTicks=9216;score.sourceBarTicks=performed.sourceBarTicks!.slice(0,65);
 score.barlines=score.sourceBarTicks.slice(1).map((tick,i)=>({barNumber:i+1,tick,type:tick===4608?'repeat-start':tick===9216?'repeat-end':'regular'}));
 // Source metadata for tempos/meters is not repeated in this corpus.
 if(score.tempos.some(q=>q.tick>=9216)||score.timeSignatures.some(q=>q.tick>=9216))throw Error('Unsupported repeated tempo/meter metadata');
 score.writtenPresentation={sourceScoreId:performed.id,sourceHash:SCHUMANN_NO14_APPROVED_SHA256,performedTotalTicks:performed.totalTicks,writtenBars:64,performedBars:96,
  repeats:[{startBar:33,endBar:64,times:2}],occurrences,events};
 if(score.notes.length!==383||score.notes.filter(q=>q.durationTicks===72).length!==4||score.phrases?.length!==64||score.pedals.some(q=>q.tick>=9216))throw Error('No14 written projection inventory differs');
 return {score,performed};
}
/** Rebuild exact performed identities, clocks and provenance from written
 * statements and occurrence overrides; no second copy of musical values. */
export function reconstructNo14Performed(p:ReturnType<typeof projectNo14Written>):QuantizedGridScore{
 const result=structuredClone(p.performed),mapping=p.score.writtenPresentation!;
 for(const field of fields){const written=(p.score[field]??[]) as unknown as Record<string,unknown>[];
  (result as unknown as Record<string,unknown>)[field]=(mapping.events[field]??[]).map(q=>({...structuredClone(written[q.writtenIndex]),...structuredClone(q.overrides)}));
 }
 return result;
}
