/* Final placed beamed-solo paint. Coordinates are the emitted SVG coordinates;
 * broad flag control hulls certify clearance, never positive cubic ink. */
import type { QuantizedNote } from '../../model/types';
import type { JankoRhythmNote } from './elements/rhythm';
import { getStemGeometry, JANKO_STEM_STROKE_WIDTH, CLASP_RING_RADIUS, CLASP_RING_STROKE,
  stemRingCenters, subdivisionMarkCount, renderSubdivisionMark, verbatimFlagPath } from './elements/rhythm';
import { durationDotCount } from './elements/duration';
import type { JankoDurationGrammar, JankoSubdivisionStyle, ResolvedJankoTokens } from './types';
import { getClusterSpacingPreset } from './types';
import { f } from './elements/style';
import type { InkBox } from './ink-scene';

const n=(v:number)=>Number(f(v));
export type SoloShape =
  | {kind:'stem';x:number;y1:number;y2:number;width:number}
  | {kind:'ring';cx:number;cy:number;r:number;width:number}
  | {kind:'flag';d:string;stemX:number;index:number;count?:number;style:JankoSubdivisionStyle}
  | {kind:'dot';cx:number;cy:number;r:number;index:1|2};
export interface SoloPiece {
  id:string; noteId:string; ownerIds:readonly string[];
  sourceContributors:readonly Pick<QuantizedNote,'id'|'sourceProvenance'|'editorialHand'>[];
  tick:number; durationTicks:number; grammar:JankoDurationGrammar; system:number; pagePiece:number;
  layer:'rhythm'; shape:SoloShape; readonly svg:string;
}
export function serializeSoloPiece(p:SoloPiece):string {
  const s=p.shape;
  if(s.kind==='stem')return `    <line class="janko-stem" x1="${f(s.x)}" y1="${f(s.y1)}" x2="${f(s.x)}" y2="${f(s.y2)}" stroke="#111111" stroke-width="${s.width.toFixed(2)}"/>`;
  if(s.kind==='ring')return `    <circle class="janko-stem-ring" cx="${f(s.cx)}" cy="${f(s.cy)}" r="${f(s.r)}" fill="#FFFFFF" stroke="#111111" stroke-width="${s.width.toFixed(2)}"/>`;
  if(s.kind==='dot')return `    <circle class="janko-augmentation-dot"${s.index===2?' data-dot="2"':''} cx="${f(s.cx)}" cy="${f(s.cy)}" r="${f(s.r)}" fill="#111111"/>`;
  if(s.count!==undefined)return `    <path class="janko-flag" data-stem-x="${f(s.stemX)}" data-flag-count="${s.count}" d="${s.d}" fill="#111111" stroke="none" fill-rule="evenodd" data-subdivision-style="classical-urtext"/>`;
  return `    <path class="janko-flag" data-stem-x="${f(s.stemX)}" data-flag-index="${s.index}" d="${s.d}" fill="#111111" stroke="none" data-subdivision-style="${s.style}"/>`;
}
function piece(data:Omit<SoloPiece,'svg'>):SoloPiece {
  return Object.defineProperty(data,'svg',{get(this:SoloPiece){return serializeSoloPiece(this);},enumerable:true}) as SoloPiece;
}
/** Same constructor for fixed-core final placement and direct standalone calls. */
export function soloRhythmPaint(note:JankoRhythmNote,t:ResolvedJankoTokens,style:JankoSubdivisionStyle,grammar:JankoDurationGrammar,
  system=0,pagePiece=0,owners:readonly string[]=[note.id],sources:ReadonlyMap<string,QuantizedNote>=new Map()):SoloPiece[] {
  const out:SoloPiece[]=[],s=getStemGeometry(note,t);
  const add=(shape:SoloShape)=>out.push(piece({id:`s${system}:solo:${note.id}:${out.length}`,noteId:note.id,ownerIds:owners,
    sourceContributors:owners.flatMap(id=>{const source=sources.get(id);return source?[{id,sourceProvenance:source.sourceProvenance,editorialHand:source.editorialHand}]:[];}),
    tick:note.startTick,durationTicks:note.durationTicks,grammar,system,pagePiece,layer:'rhythm',shape}));
  add({kind:'stem',x:n(s.stemX),y1:n(s.stemStartY),y2:n(s.stemEndY),width:JANKO_STEM_STROKE_WIDTH});
  for(const c of stemRingCenters(note,t,grammar))add({kind:'ring',cx:n(c.x),cy:n(c.y),r:n(CLASP_RING_RADIUS),width:CLASP_RING_STROKE});
  const marks=subdivisionMarkCount(note.durationTicks,grammar);
  if(style==='classical-urtext') {
    if(marks>=1){
      const svg=verbatimFlagPath(s.stemX,s.stemEndY,s.direction,marks);
      const d=svg.match(/\bd="([^"]+)"/)?.[1];
      if(!d)throw new Error('Unsupported solo flag path');
      add({kind:'flag',d,stemX:n(s.stemX),index:1,count:marks,style});
    }
  } else for(let i=1;i<=marks;i++){
    const svg=renderSubdivisionMark(s.stemX,s.stemEndY,s.direction,i,style,t);
    const d=svg.match(/\bd="([^"]+)"/)?.[1];
    if(!d)throw new Error('Unsupported solo crescent path');
    add({kind:'flag',d,stemX:n(s.stemX),index:i,style});
  }
  const dots=durationDotCount(note.durationTicks,grammar),r=n(t.augmentationDotRadius);
  const cx=note.dotX??note.x+getClusterSpacingPreset().wx+t.augmentationDotGap,cy=note.dotY??note.y;
  if(dots>=1)add({kind:'dot',cx:n(cx),cy:n(cy),r,index:1});
  if(dots>=2)add({kind:'dot',cx:n(note.dot2X??cx+2*t.augmentationDotRadius+t.augmentationDotGap),cy:n(note.dot2Y??cy),r,index:2});
  return out;
}
export function soloSvg(group:readonly SoloPiece[]):string{return group.map(p=>p.svg).join('\n');}
/** Conservative outward control-coordinate hull (including every closed subpath).
 * A Bezier lies in its controls' convex hull; this AABB may include counters. */
export function soloBox(p:SoloPiece):InkBox {
  const s=p.shape;
  if(s.kind==='stem')return {x0:s.x-s.width/2,x1:s.x+s.width/2,y0:Math.min(s.y1,s.y2),y1:Math.max(s.y1,s.y2)};
  if(s.kind==='dot')return {x0:s.cx-s.r,x1:s.cx+s.r,y0:s.cy-s.r,y1:s.cy+s.r};
  if(s.kind==='ring'){const r=s.r+s.width/2;return {x0:s.cx-r,x1:s.cx+r,y0:s.cy-r,y1:s.cy+r};}
  // Only M/C/Z commands are admitted; closure joins already present endpoints.
  const commands=s.d.replace(/-?\d+(?:\.\d+)?/g,'').replace(/[\s,]/g,'');
  const values=s.d.match(/-?\d+(?:\.\d+)?/g)?.map(Number)??[];
  if(!/^[MCZ]+$/.test(commands)||values.length<2||values.length%2||values.some(v=>!Number.isFinite(v)))
    throw new Error('Unsupported solo cubic control hull');
  const xs=values.filter((_,i)=>i%2===0),ys=values.filter((_,i)=>i%2===1);
  const margin=1e-9; // outward, including rounded SVG-coordinate tangencies
  return {x0:Math.min(...xs)-margin,x1:Math.max(...xs)+margin,y0:Math.min(...ys)-margin,y1:Math.max(...ys)+margin};
}
export type SoloPhysicalResult = {status:'ink'|'clear'|'unknown';piece?:SoloPiece;reason?:string};
/** Shape-local point: flags intentionally never certify ink or counter clearance. */
export function soloPieceAt(p:SoloPiece,x:number,y:number):SoloPhysicalResult {
  if(!Number.isFinite(x)||!Number.isFinite(y))return {status:'unknown',piece:p,reason:'nonfinite point'};
  const b=soloBox(p),s=p.shape;
  if(x<b.x0||x>b.x1||y<b.y0||y>b.y1)return {status:'clear'};
  if(s.kind==='flag')return {status:'unknown',piece:p,reason:'filled cubic/evenodd unresolved'};
  if(s.kind==='stem'){
    if(Math.abs(Math.abs(x-s.x)-s.width/2)<1e-9||Math.abs(y-s.y1)<1e-9||Math.abs(y-s.y2)<1e-9)
      return {status:'unknown',piece:p,reason:'emitted boundary/tangent'};
    return {status:x>s.x-s.width/2&&x<s.x+s.width/2&&y>Math.min(s.y1,s.y2)&&y<Math.max(s.y1,s.y2)?'ink':'clear',piece:p};
  }
  const d=Math.hypot(x-s.cx,y-s.cy);
  if(s.kind==='ring'){
    if(Math.abs(Math.abs(d-s.r)-s.width/2)<1e-9)return {status:'unknown',piece:p,reason:'annular tangent'};
    return {status:Math.abs(d-s.r)<s.width/2?'ink':'clear',piece:p};
  }
  if(Math.abs(d-s.r)<1e-9)return {status:'unknown',piece:p,reason:'disc tangent'};
  return {status:d<s.r?'ink':'clear',piece:p};
}
/** Exact positive-area test for discs/rims versus a closed finite box; touching
 * boundaries do not prove positive overlap. Cubic intersection remains unknown. */
export function soloPieceBoxAt(p:SoloPiece,b:InkBox):SoloPhysicalResult {
  if(![b.x0,b.x1,b.y0,b.y1].every(Number.isFinite)||b.x0>=b.x1||b.y0>=b.y1)
    return {status:'unknown',piece:p,reason:'box requires finite positive area'};
  const h=soloBox(p),s=p.shape;
  if(b.x1<h.x0||b.x0>h.x1||b.y1<h.y0||b.y0>h.y1)return {status:'clear'};
  if(s.kind==='flag')return {status:'unknown',piece:p,reason:'filled cubic/evenodd unresolved'};
  if(b.x1<=h.x0||b.x0>=h.x1||b.y1<=h.y0||b.y0>=h.y1)return {status:'unknown',piece:p,reason:'box boundary tangent'};
  if(s.kind==='stem')return {status:'ink',piece:p};
  const near=Math.hypot(Math.max(b.x0-s.cx,0,s.cx-b.x1),Math.max(b.y0-s.cy,0,s.cy-b.y1));
  const far=Math.hypot(Math.max(Math.abs(b.x0-s.cx),Math.abs(b.x1-s.cx)),Math.max(Math.abs(b.y0-s.cy),Math.abs(b.y1-s.cy)));
  const inner=s.kind==='ring'?s.r-s.width/2:0,outer=s.kind==='ring'?s.r+s.width/2:s.r;
  if(Math.abs(near-outer)<1e-9||s.kind==='ring'&&Math.abs(far-inner)<1e-9)
    return {status:'unknown',piece:p,reason:'disc/annulus box tangent'};
  return {status:near<outer&&far>inner?'ink':'clear',piece:p};
}
