/* Placed grouped rhythm paint. This family is not a preliminary beam solver or
 * a page-slot reservation. All coordinates below are SVG-effective (f-rounded). */
import type { JankoBeamGroupGeometry } from './elements/rhythm';
import { beamRailPathD, JANKO_STEM_STROKE_WIDTH } from './elements/rhythm';
import { durationDotCount } from './elements/duration';
import { getClusterSpacingPreset } from './types';
import { f } from './elements/style';
import type { JankoDurationGrammar, ResolvedJankoTokens } from './types';
import type { InkBox } from './ink-scene';
import type { QuantizedNote } from '../../model/types';

const n = (value:number):number => Number(f(value));
export type BeamShape =
  | {kind:'stem'; x:number; y1:number; y2:number; width:number}
  | {kind:'rail'; points:readonly [number,number][]}
  | {kind:'dot'; cx:number; cy:number; r:number};
export interface BeamPiece {
  id:string; groupId:string; ownerIds:readonly string[];
  /** Score event IDs identify unfolded occurrences; preserve authored source
   * voices and editorial hand authority rather than fabricating source positions. */
  sourceContributors:readonly Pick<QuantizedNote,'id'|'sourceProvenance'|'editorialHand'>[];
  tick:number;
  span:readonly [number,number]; system:number; pagePiece:number; layer:'rhythm';
  shape:BeamShape; cls:string; level?:number; stub?:boolean; dot?:number;
  readonly svg:string;
}
export function serializeBeamPiece(piece:BeamPiece):string {
  const p=piece.shape;
  if(p.kind==='stem')return `    <line class="${piece.cls}" x1="${f(p.x)}" y1="${f(p.y1)}" x2="${f(p.x)}" y2="${f(p.y2)}" stroke="#111111" stroke-width="${p.width.toFixed(2)}"/>`;
  if(p.kind==='dot')return `    <circle class="${piece.cls}"${piece.dot===2?' data-dot="2"':''} cx="${f(p.cx)}" cy="${f(p.cy)}" r="${f(p.r)}" fill="#111111"/>`;
  const [a,b,c,d]=p.points;
  const path=`M ${f(a[0])} ${f(a[1])} L ${f(b[0])} ${f(b[1])} L ${f(c[0])} ${f(c[1])} L ${f(d[0])} ${f(d[1])} Z`;
  return `    <path class="${piece.cls}"${piece.level&&piece.level>1?` data-beam-level="${piece.level}"`:''}${piece.stub?' data-beam-stub="1"':''} d="${path}" fill="#111111"/>`;
}
function piece(data:Omit<BeamPiece,'svg'>):BeamPiece {
  return Object.defineProperty(data,'svg',{get(this:BeamPiece){return serializeBeamPiece(this);},enumerable:true}) as BeamPiece;
}
export function placedBeamGroup(beam:JankoBeamGroupGeometry,t:ResolvedJankoTokens,grammar:JankoDurationGrammar,system:number,pagePiece:number,contributors:(id:string)=>readonly string[] = id=>[id],sources:ReadonlyMap<string,QuantizedNote> = new Map()):BeamPiece[] {
  if(beam.notes.length<2 || beam.notes.length!==beam.stems.length || beam.levels.length<1 || beam.levels[0].level!==1 || beam.levels[0].connector!==beam.primary || beam.levels.some(l=>l.level<1||l.level>4))
    throw new Error('Unsupported grouped-beam geometry: incomplete or nonstandard levels/stems');
  const notes=beam.notes, owners=notes.flatMap(note=>contributors(note.id));
  const tick=notes[0].startTick,span=[tick,Math.max(...notes.map(note=>note.startTick+note.durationTicks))] as const;
  const groupId=`s${system}:beam:${tick}:${notes.map(note=>note.id).join(',')}`;
  const out:BeamPiece[]=[];
  const add=(shape:BeamShape,cls:string,ids:readonly string[],extra:Partial<Pick<BeamPiece,'level'|'stub'|'dot'>>={})=>out.push(piece({id:`${groupId}:${out.length}`,groupId,ownerIds:ids,
    sourceContributors:ids.flatMap(id=>{const source=sources.get(id);return source?[{id,sourceProvenance:source.sourceProvenance,editorialHand:source.editorialHand}]:[];}),
    tick,span,system,pagePiece,layer:'rhythm',shape,cls,...extra}));
  for(let i=0;i<beam.stems.length;i++){
    const s=beam.stems[i];
    add({kind:'stem',x:n(s.stemX),y1:n(s.stemStartY),y2:n(beam.beamY(s.stemX)),width:JANKO_STEM_STROKE_WIDTH},'janko-stem',contributors(notes[i].id));
  }
  const names:Record<number,string>={1:'janko-beam',2:'janko-beam-secondary',3:'janko-beam-tertiary',4:'janko-beam-quaternary'};
  for(const strip of beam.levels){
    const c=strip.connector;
    // Use the actual path formatter: its four rounded vertices are the SVG polygon,
    // including the slope-dependent half-stem extensions and vertical faces.
    const values=beamRailPathD(c.x1,c.y1,c.x2,c.y2,t.beamThickness).match(/-?\d+(?:\.\d+)?/g)?.map(Number);
    if(!values||values.length!==8||values.some(v=>!Number.isFinite(v)))throw new Error('Unsupported grouped-beam rail path');
    add({kind:'rail',points:[[values[0],values[1]],[values[2],values[3]],[values[4],values[5]],[values[6],values[7]]]},names[strip.level]+(strip.stub?' janko-beam-stub':''),owners,{level:strip.level,stub:strip.stub});
  }
  for(const note of notes){
    const count=durationDotCount(note.durationTicks,grammar),r=n(t.augmentationDotRadius);
    if(count>2)throw new Error('Unsupported grouped-beam augmentation count');
    const cx=note.dotX??note.x+getClusterSpacingPreset().wx+t.augmentationDotGap,cy=note.dotY??note.y;
    if(count>=1)add({kind:'dot',cx:n(cx),cy:n(cy),r},'janko-augmentation-dot',contributors(note.id),{dot:1});
    if(count>=2)add({kind:'dot',cx:n(note.dot2X??cx+2*t.augmentationDotRadius+t.augmentationDotGap),cy:n(note.dot2Y??cy),r},'janko-augmentation-dot',contributors(note.id),{dot:2});
  }
  return out;
}
export const beamGroupSvg=(pieces:readonly BeamPiece[]):string=>['  <g class="janko-beam-group">',...pieces.map(p=>p.svg),'  </g>'].join('\n');
export function beamPieceBox(p:BeamPiece):InkBox {
  const s=p.shape;
  if(s.kind==='stem')return {x0:s.x-s.width/2,x1:s.x+s.width/2,y0:Math.min(s.y1,s.y2),y1:Math.max(s.y1,s.y2)};
  if(s.kind==='dot')return {x0:s.cx-s.r,x1:s.cx+s.r,y0:s.cy-s.r,y1:s.cy+s.r};
  return {x0:Math.min(...s.points.map(v=>v[0])),x1:Math.max(...s.points.map(v=>v[0])),y0:Math.min(...s.points.map(v=>v[1])),y1:Math.max(...s.points.map(v=>v[1]))};
}
function contains(b:InkBox,x:number,y:number):boolean{return x>=b.x0&&x<=b.x1&&y>=b.y0&&y<=b.y1;}
export function beamPieceAt(p:BeamPiece,x:number,y:number):boolean {
  if(!Number.isFinite(x)||!Number.isFinite(y))throw new Error('Grouped-beam point query requires finite coordinates');
  const s=p.shape;
  if(!contains(beamPieceBox(p),x,y))return false;
  if(s.kind==='stem')return true;
  if(s.kind==='dot')return (x-s.cx)**2+(y-s.cy)**2<=s.r*s.r;
  let inside=false;
  for(let i=0,j=s.points.length-1;i<s.points.length;j=i++){
    const a=s.points[i],b=s.points[j];
    const cross=(x-a[0])*(b[1]-a[1])-(y-a[1])*(b[0]-a[0]);
    if(Math.abs(cross)<1e-9&&x>=Math.min(a[0],b[0])&&x<=Math.max(a[0],b[0])&&y>=Math.min(a[1],b[1])&&y<=Math.max(a[1],b[1]))return true;
    if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}
/* Positive-area box query: clip the filled polygon against the box, rather
 * than accepting empty corners of its bounding rectangle as collisions. */
export function beamPieceIntersectsBox(p:BeamPiece,b:InkBox):boolean {
  if(![b.x0,b.x1,b.y0,b.y1].every(Number.isFinite)||b.x1<=b.x0||b.y1<=b.y0)
    throw new Error('Grouped-beam box query requires a finite positive-area box');
  const s=p.shape,bb=beamPieceBox(p);
  if(Math.max(b.x0,bb.x0)>=Math.min(b.x1,bb.x1)||Math.max(b.y0,bb.y0)>=Math.min(b.y1,bb.y1))return false;
  if(s.kind==='stem')return true;
  if(s.kind==='dot'){
    const x=Math.max(b.x0,Math.min(s.cx,b.x1)),y=Math.max(b.y0,Math.min(s.cy,b.y1));
    return (x-s.cx)**2+(y-s.cy)**2<s.r*s.r;
  }
  let poly=s.points.map(v=>[...v]);
  const clip=(axis:number,bound:number,sign:number)=>{
    const input=poly;poly=[];
    for(let i=0;i<input.length;i++){
      const a=input[i],z=input[(i+1)%input.length],da=sign*(a[axis]-bound),dz=sign*(z[axis]-bound);
      if(da>=0)poly.push(a);
      if((da<0&&dz>0)||(da>0&&dz<0)){
        const u=da/(da-dz);poly.push([a[0]+u*(z[0]-a[0]),a[1]+u*(z[1]-a[1])]);
      }
    }
  };
  clip(0,b.x0,1);clip(0,b.x1,-1);clip(1,b.y0,1);clip(1,b.y1,-1);
  // Translate before shoelace: page coordinates are large compared with
  // narrow grazing boxes, so unshifted products can cancel tiny real ink.
  let area=0;for(let i=0;i<poly.length;i++){
    const a=poly[i],z=poly[(i+1)%poly.length];
    area+=(a[0]-b.x0)*(z[1]-b.y0)-(z[0]-b.x0)*(a[1]-b.y0);
  }
  return Math.abs(area)>0;
}
