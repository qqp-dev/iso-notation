/* Fresh real-engine coordinate fields, not translated glyphs or altered scores.
 * Production admission and common clocks come from the complete source system;
 * each display field re-solves heads BEFORE rhythm/tie/grace/expression geometry.
 * Unsupported cross-field phrasing/ties are refused, not approximated. */
import type { QuantizedGridScore } from '../../model/types';
import { layoutJankoVoiceField,voiceFieldKey,getTieDisplayPlan,systemTickRange,type JankoSystemLayout } from './engine';
import type { JankoPageGeometry,ResolvedJankoLayoutOptions,ResolvedJankoTokens } from './types';
import { pedalIntervals } from './elements/expressions';
export interface VoiceField { label:string; layout:JankoSystemLayout; sourceIds:string[] }
export function projectVoiceFields(base:JankoSystemLayout,score:QuantizedGridScore,o:ResolvedJankoLayoutOptions,t:ResolvedJankoTokens,page:JankoPageGeometry):VoiceField[]{
 const sources=new Map([...score.notes,...getTieDisplayPlan(score).heads].map(n=>[n.id,n]));
 const ownerField=(id:string)=>{const n=sources.get(id);if(!n)throw Error(`Voice-field owner missing: ${id}`);return voiceFieldKey(n);};
 const keys=['RH:0','RH:1','LH:0','LH:1'].filter(key=>[...base.notes,...base.unisonVoices].some(p=>voiceFieldKey(p.note)===key)||base.unisonMerges.some(m=>m.mergedIds.some(id=>ownerField(id)===key)));
 const expressionFields=new Map<string,string>();
 const [start,end]=systemTickRange(base.geometry,base.index,t);
 for(const e of score.phrases??[]){
  if(e.endTick<start||e.startTick>=end)continue;
  const fields=[...new Set([...e.fromNoteIds,...e.toNoteIds].map(ownerField))];if(fields.length!==1)throw Error(`Voice fields refuse cross-field expression ${e.id}`);expressionFields.set(e.id,fields[0]);
 }
 for(const [index,e] of (score.dynamics??[]).entries()){
  const hairpin=e.kind==='hairpin'||(!e.kind&&!!e.durationTicks&&['crescendo','decrescendo'].includes(e.mark)),stop=hairpin?e.tick+(e.durationTicks??0):e.tick;
  if(hairpin?stop<=start||e.tick>=end:e.tick<start||e.tick>=end)continue;
  expressionFields.set(`dynamic-${index}`,keys.at(-1)!); // common row, ALL hands
 }
 for(const [index,e] of pedalIntervals(score).entries())if(e.end>start&&e.start<end)expressionFields.set(`pedal-${index}`,keys.at(-1)!);
 const out=keys.map(key=>{
  const expressionScope=[...expressionFields].filter(([,field])=>field===key).map(([id])=>id);
  const layout=layoutJankoVoiceField(score,page,base,o,t,{key,columns:base.columns,expressionScope,includeExpression:(_kind,id)=>expressionFields.get(id)===key});
  const sourceIds=[...layout.notes.map(p=>p.note.id),...layout.unisonMerges.flatMap(m=>m.mergedIds)];
  return {label:`${key.slice(0,2)} · ${key.endsWith('1')?'Voice 2':'Voice 1 / solo'}`,layout,sourceIds};
 });
 const represented=out.flatMap(f=>f.sourceIds),expected=[...base.notes.map(p=>p.note.id),...base.unisonMerges.flatMap(m=>m.mergedIds)];
 if(represented.length!==new Set(represented).size||expected.some(id=>!represented.includes(id))||represented.some(id=>!expected.includes(id)))throw Error('Voice fields lost or duplicated a musical identity');
 const expressionIds=out.flatMap(f=>(f.layout.expressions??[]).map(e=>e.id));
 if(expressionIds.length!==expressionFields.size||expressionIds.some(id=>!expressionFields.has(id)))throw Error('Voice fields lost or duplicated expression ownership');
 return out;
}
