import type {QuantizedGridScore} from '../../model/types';
import {systemTickRange,type JankoSystemLayout} from './engine';
import type {ResolvedJankoLayoutOptions,ResolvedJankoTokens} from './types';
export interface OpticalPhraseDomain {
 start:{x:number;y:number;x0:number;x1:number;y0:number;y1:number};
 end:{x:number;y:number;x0:number;x1:number;y0:number;y1:number};
 span:number;pitchRange:number;
}
/** Independent source admission: clocks and identities earn local head seats;
 * adjacent onset midpoints limit inward x shortening, and the gesture's span
 * and pitch range bound floating tips. Printed parser contexts are irrelevant.
 * This domain does not depend on whichever bow the router eventually chooses. */
export function sourceOpticalPhraseDomain(score:QuantizedGridScore,layout:JankoSystemLayout,
 phrase:NonNullable<QuantizedGridScore['phrases']>[number],_o:ResolvedJankoLayoutOptions,t:ResolvedJankoTokens):OpticalPhraseDomain|undefined{
 const all=[...layout.notes,...layout.unisonVoices],[begin,end]=systemTickRange(layout.geometry,layout.index,t);
 const seat=(ids:readonly string[],tick:number)=>{
  const owners=new Set(ids);
  for(const chain of layout.tieChains??[])if(owners.has(chain.noteId))for(const q of chain.components)if(q.startTick===tick)owners.add(q.headId);
  for(const m of layout.unisonMerges)if(m.mergedIds.some(id=>owners.has(id)))owners.add(m.survivorId);
  let ns=all.filter(n=>owners.has(n.note.id)&&n.note.startTick===tick);
  const continuation=tick<begin||tick>=end;
  if(!ns.length&&continuation){
   const voices=new Set(score.notes.filter(n=>ids.includes(n.id)).flatMap(n=>n.sourceProvenance?.voices??[]));
   const local=all.filter(n=>n.rhythm.sourceVoice&&voices.has(n.rhythm.sourceVoice));
   const nearest=Math.min(...local.map(n=>Math.abs(n.note.startTick-tick)));
   ns=local.filter(n=>Math.abs(n.note.startTick-tick)===nearest);
  }
  if(!ns.length)return undefined;
  return {x:continuation?(tick<begin?layout.geometry.staffLeft:layout.geometry.staffRight):ns[0].x,y:ns.reduce((s,n)=>s+n.y,0)/ns.length};
 };
 const a=seat(phrase.fromNoteIds,phrase.startTick),b=seat(phrase.toNoteIds,phrase.endTick);if(!a||!b||b.x<=a.x)return undefined;
 const gesture=all.filter(n=>n.note.startTick>=Math.max(begin,phrase.startTick)&&n.note.startTick<=Math.min(end,phrase.endTick));
 const ys=gesture.map(n=>n.y),pitchRange=ys.length?Math.max(...ys)-Math.min(...ys):Math.abs(b.y-a.y),span=b.x-a.x;
 const budget=Math.max(16,Math.min(84,.4*span+.5*pitchRange+14));
 const next=all.filter(n=>n.note.startTick>phrase.startTick&&n.note.startTick<=phrase.endTick).sort((a,b)=>a.note.startTick-b.note.startTick)[0];
 const previous=all.filter(n=>n.note.startTick<phrase.endTick&&n.note.startTick>=phrase.startTick).sort((a,b)=>b.note.startTick-a.note.startTick)[0];
 return {start:{...a,x0:a.x,x1:phrase.startTick<begin?a.x:Math.max(a.x,Math.min(a.x+span*.2,(a.x+(next?.x??b.x))/2)),y0:a.y-budget,y1:a.y+budget},
  end:{...b,x0:phrase.endTick>=end?b.x:Math.min(b.x,Math.max(b.x-span*.2,((previous?.x??a.x)+b.x)/2)),x1:b.x,y0:b.y-budget,y1:b.y+budget},span,pitchRange};
}
