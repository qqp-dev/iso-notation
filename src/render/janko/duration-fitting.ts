import {getStemGeometry,subdivisionMarkCount,type JankoRhythmNote,type JankoBeamGroupGeometry} from './elements/rhythm';
import {soloRhythmPaint,projectedSoloFlagEnvelope} from './solo-scene';
import {placedBeamGroup,beamPieceIntersectsBox} from './beam-scene';
import type {ResolvedJankoTokens,ResolvedJankoLayoutOptions} from './types';
import {analyzeNotatedDuration} from './elements/duration';
import {JANKO_STEM_STROKE_WIDTH} from './elements/rhythm';

/** Fit a whole flag, never a stem-only aperture. Conservative glyph admission
 * against the actual rail polygon proves clearance without claiming that a
 * flag enclosure is filled ink. The resulting note drives every later layer. */
export function fitCompleteSoloFlags(notes:readonly JankoRhythmNote[],beams:readonly JankoBeamGroupGeometry[],heads:readonly {id:string;ownerIds:readonly string[];x0:number;x1:number;y0:number;y1:number}[],o:ResolvedJankoLayoutOptions,t:ResolvedJankoTokens):string[]{
 const rails=beams.flatMap(b=>placedBeamGroup(b,t,o.durationGrammar,0,0)).filter(p=>p.shape.kind==='rail');
 const refused:string[]=[];
 for(const note of notes){
  if(!subdivisionMarkCount(note.durationTicks,o.durationGrammar)||o.subdivisionStyle!=='classical-urtext')continue;
  const original=note.stemLength??t.stemLength,side=note.flagSide??'right';let found=false;
  for(let lift=0;lift<=24&&!found;lift+=.5)for(const flagSide of [side,side==='right'?'left' as const:'right' as const]){
   const candidate={...note,stemLength:original+lift,flagSide};
   const flags=soloRhythmPaint(candidate,t,o.subdivisionStyle,o.durationGrammar).filter(p=>p.shape.kind==='flag');
   const clear=flags.every(p=>{
    if(p.shape.kind!=='flag')return true;
    const b=projectedSoloFlagEnvelope(p.shape.d),box={x0:b.x0-.6,x1:b.x1+.6,y0:b.y0-.6,y1:b.y1+.6};
    return !rails.some(r=>!r.ownerIds.includes(note.id)&&beamPieceIntersectsBox(r,box))&&
     !heads.some(h=>!h.ownerIds.includes(note.id)&&Math.min(h.x1,box.x1)>Math.max(h.x0,box.x0)&&Math.min(h.y1,box.y1)>Math.max(h.y0,box.y0));
   });
   if(clear){note.stemLength=candidate.stemLength;note.flagSide=flagSide;found=true;break;}
  }
  if(!found)refused.push(note.id);
 }
 return refused;
}

/** Same written quarter branch, two explicitly reviewable physical endings.
 * Separation comes from existing duration/clearance tokens, not measure IDs. */
export function fitSharedBareTerminals(notes:readonly JankoRhythmNote[],beams:readonly JankoBeamGroupGeometry[],merges:readonly {exact:boolean;survivorId:string;mergedIds:string[]}[],variant:'short'|'long',t:ResolvedJankoTokens,dot?:'exposed-stem'|'head-adjacent'):void {
 for(const merge of merges.filter(m=>!m.exact)){
  const owners=new Set([merge.survivorId,...merge.mergedIds]),grouped=beams.filter(b=>b.notes.some(n=>owners.has(n.id)));
  for(const note of notes.filter(n=>owners.has(n.id)&&(n.durationTicks===t.ticksPerBeat||dot&&analyzeNotatedDuration(n.durationTicks).base===t.ticksPerBeat))){
   const stem=getStemGeometry(note,t),companions=grouped.filter(b=>b.direction===stem.direction);
   if(!companions.length)continue;
   const ends=companions.map(b=>b.beamY(stem.stemX)),tip=variant==='short'?(stem.direction===1?Math.min(...ends):Math.max(...ends)):(stem.direction===1?Math.max(...ends):Math.min(...ends));
   const separation=t.beamThickness+t.flagSpacing,target=tip+stem.direction*(variant==='short'?-separation:separation);
   const minimum=Math.abs(stem.stemStartY-note.y)+Math.max(t.minStemClearance,t.flagSpacing);
   note.stemLength=Math.max(minimum,stem.direction*(target-note.y));
   if(dot==='exposed-stem' && variant==='long' && analyzeNotatedDuration(note.durationTicks).dots){
    // The exposed branch is its own duration indicator. The dot keeps its
    // normal right-side relationship with that indicator, above/below the
    // shorter carrier, with actual painted air to both rather than extra
    // horizontal stem spread. Position within the exposed part, not beyond it.
    const settled=getStemGeometry(note,t);
    note.dotX=settled.stemX+JANKO_STEM_STROKE_WIDTH/2+t.augmentationDotRadius+t.augmentationDotGap;
    note.dotY=settled.stemEndY-stem.direction*t.augmentationDotRadius;
   }
  }
 }
}
