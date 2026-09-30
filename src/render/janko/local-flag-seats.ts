/* Whole classical-flag seating against final neighboring heads. The outline
 * is the real filled glyph; its projected extrema enclosure is conservative.
 * Side/tip seats are declared editorial departures, never source-value edits. */
import type { JankoRhythmNote } from './elements/rhythm';
import { getStemGeometry,subdivisionMarkCount } from './elements/rhythm';
import { projectedSoloFlagEnvelope,soloClassicalFlagPath } from './solo-scene';
import type { InkBox } from './ink-scene';
import type { ResolvedJankoTokens,JankoDurationGrammar } from './types';
const overlaps=(a:InkBox,b:InkBox)=>a.x0<b.x1+.5&&a.x1>b.x0-.5&&a.y0<b.y1+.5&&a.y1>b.y0-.5;
export function seatLocalFlags(notes:readonly JankoRhythmNote[],heads:readonly (InkBox&{id:string})[],survivor:(id:string)=>string,t:ResolvedJankoTokens,grammar:JankoDurationGrammar,equivalent:(a:string,b:string)=>boolean=()=>false):string[]{
 const seated:InkBox[]=[],refused:string[]=[],done=new Set<string>();
 const candidates=[...notes].filter(n=>subdivisionMarkCount(n.durationTicks,grammar)>0).sort((a,b)=>b.durationTicks-a.durationTicks||a.startTick-b.startTick||a.id.localeCompare(b.id));
 for(const note of candidates){if(done.has(note.id))continue;const peers=notes.filter(n=>equivalent(note.id,n.id));const marks=subdivisionMarkCount(note.durationTicks,grammar),base=note.stemLength??t.stemLength;
  let fitted=false;
  for(const length of [base,base+2,base+4,base+6,base+8,base+12,base+16,base+20]){
   for(const side of ['right','left'] as const){const trial={...note,stemLength:length,flagSide:side},s=getStemGeometry(trial,t),box=projectedSoloFlagEnvelope(soloClassicalFlagPath(s.stemX,s.stemEndY,s.direction,marks,side));
    const foreignStems=notes.filter(n=>n.id!==note.id&&!equivalent(note.id,n.id)).map(n=>{const q=getStemGeometry(n,t);return {x0:q.stemX-.45,x1:q.stemX+.45,y0:Math.min(q.stemStartY,q.stemEndY),y1:Math.max(q.stemStartY,q.stemEndY)};});
    const ownStem={x0:s.stemX-.45,x1:s.stemX+.45,y0:Math.min(s.stemStartY,s.stemEndY),y1:Math.max(s.stemStartY,s.stemEndY)};
    const foreignHeads=heads.filter(h=>h.id!==survivor(note.id));
    if([...foreignHeads,...seated,...foreignStems].some(h=>overlaps(box,h))||[...seated,...foreignHeads].some(b=>overlaps(ownStem,b)))continue;
    note.stemLength=length;note.flagSide=side;for(const peer of peers){peer.stemLength=length;peer.flagSide=side;done.add(peer.id);}done.add(note.id);seated.push(box);fitted=true;break;
   }if(fitted)break;
  }
  if(!fitted)refused.push(note.id);
 }
 return refused;
}
