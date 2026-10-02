import type {QuantizedGridScore} from '../../model/types';
import {systemTickRange,type JankoSystemLayout} from './engine';
import {gridTopY,gridBotY} from './elements/barlines';
import type {JankoSystemGeometry,ResolvedJankoLayoutOptions,ResolvedJankoTokens} from './types';
import {buildInkScene} from './ink-scene';
import {beamPieceBox} from './beam-scene';
import {soloBox} from './solo-scene';
import {chordBridgeBox,claspShellBox} from './connective-scene';
export interface RepeatSign {
 type:'repeat-start'|'repeat-end';tick:number;x:number;
 strokes:{x:number;y0:number;y1:number;width:number}[];
 dots:{cx:number;cy:number;r:number}[];
 x0:number;x1:number;y0:number;y1:number;svg:string;
}
const f=(n:number)=>n.toFixed(3);
export const repeatLeadingAir=(t:ResolvedJankoTokens)=>Math.max(4,t.noteheadRadius);
export function repeatReplacesBracket(score:QuantizedGridScore,g:JankoSystemGeometry,index:number,o:ResolvedJankoLayoutOptions,t:ResolvedJankoTokens):boolean{
 return !!score.writtenPresentation&&o.repeatTreatment==='single-rule'&&score.barlines.some(b=>b.type==='repeat-start'&&b.tick===systemTickRange(g,index,t)[0]);
}
/** Complete settled first attack: actual glyphs/halos, duration stems, rails,
 * flags, dots/rings and connective shells, plus the pitch symbol's reading
 * envelope. Source owners select the ink; grid guides carry no attack weight. */
export function repeatFirstAttackEnvelope(layout:JankoSystemLayout,tick:number,o:ResolvedJankoLayoutOptions,t:ResolvedJankoTokens){
 const next=layout.geometry.sourceBarTicks?.find(q=>q>tick)??tick+t.ticksPerMeasure;
 const notes=[...layout.notes,...layout.unisonVoices].filter(n=>n.note.startTick>=tick&&n.note.startTick<next);
 const first=Math.min(...notes.map(n=>n.note.startTick));if(!Number.isFinite(first))return undefined;
 const ids=new Set(notes.filter(n=>n.note.startTick===first).map(n=>n.note.id));
 for(const m of layout.unisonMerges)if(m.tick===first&&(ids.has(m.survivorId)||m.mergedIds.some(id=>ids.has(id))))for(const id of [m.survivorId,...m.mergedIds])ids.add(id);
 const scene=buildInkScene(layout,o,t,layout.scoreRevision),owns=(p:{ownerIds:readonly string[]})=>p.ownerIds.some(id=>ids.has(id));
 const boxes=[...[...scene.heads.values()].flat().filter(owns).map(p=>p.box),...scene.beams.flat().filter(owns).map(beamPieceBox),...[...scene.solos.values()].flat().filter(owns).map(soloBox),...scene.chordBridges.filter(owns).map(chordBridgeBox),...scene.claspShells.filter(owns).map(claspShellBox)];
 if(!boxes.length)return undefined;
 return {tick:first,ownerIds:[...ids],x0:Math.min(...boxes.map(b=>b.x0)),x1:Math.max(...boxes.map(b=>b.x1)),y0:Math.min(...boxes.map(b=>b.y0)),y1:Math.max(...boxes.map(b=>b.y1))};
}
export function repeatBoundaryTicks(score:QuantizedGridScore):Set<number>{
 return new Set(score.writtenPresentation?score.barlines.filter(b=>b.type==='repeat-start'||b.type==='repeat-end').map(b=>b.tick):[]);
}
/** Repeat starts belong to the following system, ends to the preceding one.
 * Existing protected start air and page margin seat the double rule; the
 * inward-facing dots occupy a separate, exact circle inventory. */
export function placeRepeatSigns(score:QuantizedGridScore,g:JankoSystemGeometry,index:number,o:ResolvedJankoLayoutOptions,t:ResolvedJankoTokens):RepeatSign[]{
 if(!score.writtenPresentation)return [];
 const [start,end]=systemTickRange(g,index,t);
 return score.barlines.filter(b=>(b.type==='repeat-start'?b.tick>=start&&b.tick<end:b.type==='repeat-end'&&b.tick>start&&b.tick<=end)).map(b=>{
  const local=score.sourceBarTicks!.indexOf(b.tick)-(g.firstBar??index*g.measuresPerSystem),x=g.measureEdges?.[local]??g.staffLeft+local*g.measureWidth;
  const type=b.type as RepeatSign['type'],isStart=type==='repeat-start',top=gridTopY(g,o,t),bottom=gridBotY(g,o,t);
  const single=o.repeatTreatment==='single-rule';
  const strokes=single?[{x,y0:top,y1:bottom,width:.9}]:isStart?[{x:x-4.3,y0:top,y1:bottom,width:.9},{x:x-1,y0:top,y1:bottom,width:.6}]:[{x:x-3.4,y0:top,y1:bottom,width:.6},{x,y0:top,y1:bottom,width:.9}];
  const dots=[-3.5,3.5].map(d=>({cx:x+(isStart?3.2:single?-3.2:-7),cy:g.middleCY+d,r:.9}));
  const x0=Math.min(...strokes.map(s=>s.x-s.width/2),...dots.map(d=>d.cx-d.r)),x1=Math.max(...strokes.map(s=>s.x+s.width/2),...dots.map(d=>d.cx+d.r));
  const svg=`<g class="janko-repeat" data-repeat="${type}" data-repeat-tick="${b.tick}"${single?' data-repeat-treatment="single-rule"':''}>`+strokes.map(s=>`<line class="janko-repeat-barline" x1="${f(s.x)}" y1="${f(s.y0)}" x2="${f(s.x)}" y2="${f(s.y1)}" stroke="#111111" stroke-width="${s.width}"/>`).join('')+dots.map(d=>`<circle class="janko-repeat-dot" cx="${f(d.cx)}" cy="${f(d.cy)}" r="${d.r}" fill="#111111"/>`).join('')+'</g>';
  return {type,tick:b.tick,x,strokes,dots,x0,x1,y0:top,y1:bottom,svg};
 });
}
export function repeatPhysicalBoxes(q:RepeatSign){return [...q.strokes.map(s=>({x0:s.x-s.width/2,x1:s.x+s.width/2,y0:s.y0,y1:s.y1})),...q.dots.map(d=>({x0:d.cx-d.r,x1:d.cx+d.r,y0:d.cy-d.r,y1:d.cy+d.r}))];}
export function repeatIntersectsBox(q:RepeatSign,b:{x0:number;x1:number;y0:number;y1:number}):boolean{
 return q.strokes.some(s=>s.x+s.width/2>b.x0&&s.x-s.width/2<b.x1&&s.y0<b.y1&&s.y1>b.y0)||q.dots.some(d=>{
  const x=Math.max(b.x0,Math.min(d.cx,b.x1)),y=Math.max(b.y0,Math.min(d.cy,b.y1));return (x-d.cx)**2+(y-d.cy)**2<d.r*d.r;
 });
}
