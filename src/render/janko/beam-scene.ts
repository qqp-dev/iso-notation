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
import { overpassRailFragments } from './layered-routes';
import { profileDepthRoutes, type DepthProfile, type DepthRoute } from './depth-profile';

const n = (value:number):number => Number(f(value));
export type BeamShape =
  | {kind:'stem'; x:number; y1:number; y2:number; width:number; double?:true; gaps?:readonly {y0:number;y1:number}[]}
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
export function doubleStemSvg(s:{x:number;y1:number;y2:number}):string {
  const d=[-.45,.45].map(dx=>`M ${f(s.x+dx)} ${f(s.y1)} L ${f(s.x+dx)} ${f(s.y2)}`).join(' ');
  return `    <path class="janko-stem janko-source-voice-two" data-source-stream="v2" d="${d}" fill="none" stroke="#111111" stroke-width="0.40" stroke-linecap="butt"/>`;
}
export function serializeBeamPiece(piece:BeamPiece):string {
  const p=piece.shape;
  if(p.kind==='stem') {
    if(p.double){if(p.gaps?.length)throw Error('Shared voice channel refuses underpass fragments');return doubleStemSvg(p);}
    if(p.gaps?.length){
      const d=beamStemBoxes(piece).map(b=>`M ${f(p.x)} ${f(b.y0)} L ${f(p.x)} ${f(b.y1)}`).join(' ');
      return `    <path class="${piece.cls} janko-voice-underpass" d="${d}" fill="none" stroke="#111111" stroke-width="${p.width.toFixed(2)}" stroke-linecap="butt"/>`;
    }
    return `    <line class="${piece.cls}" x1="${f(p.x)}" y1="${f(p.y1)}" x2="${f(p.x)}" y2="${f(p.y2)}" stroke="#111111" stroke-width="${p.width.toFixed(2)}"/>`;
  }
  if(p.kind==='dot')return `    <circle class="${piece.cls}"${piece.dot===2?' data-dot="2"':''} cx="${f(p.cx)}" cy="${f(p.cy)}" r="${f(p.r)}" fill="#111111"/>`;
  const [a,...rest]=p.points;
  const path=`M ${f(a[0])} ${f(a[1])}${rest.map(b=>` L ${f(b[0])} ${f(b[1])}`).join('')} Z`;
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
    add({kind:'stem',x:n(s.stemX),y1:n(s.stemStartY),y2:n(beam.beamY(s.stemX)),width:notes[i].doubleStem?1.3:JANKO_STEM_STROKE_WIDTH,...(notes[i].doubleStem?{double:true as const}:{})},'janko-stem',contributors(notes[i].id));
  }
  const names:Record<number,string>={1:'janko-beam',2:'janko-beam-secondary',3:'janko-beam-tertiary',4:'janko-beam-quaternary'};
  for(const [index,strip] of beam.levels.entries()){
    if(beam.contourRails){const rail=beam.contourRails[index];if(!rail||rail.level!==strip.level||rail.points.length<4)throw Error('Incomplete bent ribbon levels');
      add({kind:'rail',points:rail.points.map(p=>[n(p[0]),n(p[1])] as [number,number])},names[strip.level]+(strip.stub?' janko-beam-stub':''),owners,{level:strip.level,stub:strip.stub});continue;}
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
/** Exact visible intervals of one logical stem, including non-fusing
 * underpasses. Root and beam endpoint remain the original beamY geometry. */
export function beamStemBoxes(piece:Pick<BeamPiece,'shape'>):InkBox[] {
  const s=piece.shape;if(s.kind!=='stem')return [];
  const top=Math.min(s.y1,s.y2),bottom=Math.max(s.y1,s.y2);let cursor=top;
  const out:InkBox[]=[];
  for(const gap of s.gaps??[]){
    if(gap.y0>cursor)out.push({x0:s.x-s.width/2,x1:s.x+s.width/2,y0:cursor,y1:Math.min(bottom,gap.y0)});
    cursor=Math.max(cursor,gap.y1);
  }
  if(cursor<bottom)out.push({x0:s.x-s.width/2,x1:s.x+s.width/2,y0:cursor,y1:bottom});
  const intervals=out.filter(b=>b.y1>b.y0);
  return s.double?intervals.flatMap(b=>[-.45,.45].map(dx=>({...b,x0:n(s.x+dx)-.2,x1:n(s.x+dx)+.2}))):intervals;
}

/** Genuine crossing voices cannot always be planar while retaining performing-
 * hand stem direction. Keep distinct rails and give the foreign stem a local
 * underpass: no false junction, no changed hand, onset, head or beam obligation.
 * The omitted interval is published paint geometry, not a white overpainting
 * that can erase an unrelated head. */
export function routeVoiceUnderpasses(groups:BeamPiece[][],beams:readonly JankoBeamGroupGeometry[],t:ResolvedJankoTokens,
  solos:readonly {shape:Extract<BeamShape,{kind:'stem'}>;hand:QuantizedNote['hand'];sourceVoice?:string;ownerIds?:readonly string[];extendTip?:boolean}[]=[]):void {
  const rails=groups.flatMap((pieces,i)=>pieces.filter(p=>p.shape.kind==='rail').map(p=>({p,beam:beams[i]})));
  const stems=groups.flatMap((pieces,i)=>pieces.flatMap(p=>p.shape.kind==='stem'
    ?[{shape:p.shape,groupId:p.groupId,ownerIds:p.ownerIds,extendTip:false,hand:beams[i].notes[0].hand,sourceVoice:beams[i].notes[0].sourceVoice}] : []));
  for(const stem of [...stems,...solos.map(s=>({...s,groupId:undefined}))]){
    const s=stem.shape, own=stem;
    for(let pass=0;pass<=rails.length;pass++){
      const gaps:{y0:number;y1:number}[]=[];
    for(const {p:rail,beam} of rails){
      if(rail.groupId===stem.groupId || rail.ownerIds.some(id=>stem.ownerIds?.includes(id)) ||
        own.hand===beam.notes[0].hand && own.sourceVoice===beam.notes[0].sourceVoice || rail.shape.kind!=='rail')continue;
      const box={x0:s.x-s.width/2,x1:s.x+s.width/2,y0:Math.min(s.y1,s.y2),y1:Math.max(s.y1,s.y2)};
      if(!beamPieceIntersectsBox(rail,box))continue;
      // Clip the actual polygon to this stem's horizontal strip, not the
      // rail's large empty bounding corners. The rake is already f-rounded.
      const ys:number[]=[];const points=rail.shape.points;
      for(let k=0;k<points.length;k++){
        const a=points[k],b=points[(k+1)%points.length];
        if(a[0]>=box.x0&&a[0]<=box.x1)ys.push(a[1]);
        if(a[0]!==b[0])for(const x of [box.x0,box.x1])if(x>=Math.min(a[0],b[0])&&x<=Math.max(a[0],b[0]))
          ys.push(a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]));
      }
      if(ys.length)gaps.push({y0:n(Math.min(...ys)-t.voiceCrossingAir),y1:n(Math.max(...ys)+t.voiceCrossingAir)});
    }
    gaps.sort((a,b)=>a.y0-b.y0);const joined:{y0:number;y1:number}[]=[];
    for(const gap of gaps){const last=joined.at(-1);if(last&&gap.y0<=last.y1)last.y1=Math.max(last.y1,gap.y1);else joined.push({...gap});}
    s.gaps=joined;
    const tip=joined.find(g=>s.y2>=g.y0&&s.y2<=g.y1);
    if(!stem.extendTip||!tip)break;
    // Tip fitting is opt-in in the PRE-INK solve. The resulting rhythm-note
    // length drives flags/rings, anchors and bounds together. Final paint
    // never moves a tip, and grouped beam endpoints are never extended here.
    const visible=Math.max(t.minStemClearance,2*JANKO_STEM_STROKE_WIDTH);
    s.y2=n(s.y2>s.y1?tip.y1+visible:tip.y0-visible);
    }
  }
}

export function routeVoiceOverpasses(groups:BeamPiece[][],beams:readonly JankoBeamGroupGeometry[],t:ResolvedJankoTokens,
 solos:readonly {id?:string;shape:Extract<BeamShape,{kind:'stem'}>;hand:QuantizedNote['hand'];sourceVoice?:string;ownerIds?:readonly string[]}[]=[],profile?:DepthProfile):DepthRoute[] {
  if(profile)return profileDepthRoutes(groups,beams,solos,profile,piece);
  overpassRailFragments(groups,beams,solos,piece);
  return [];
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
  if(s.kind==='stem')return beamStemBoxes(p).some(b=>contains(b,x,y));
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
  if(s.kind==='stem')return beamStemBoxes(p).some(v=>Math.max(b.x0,v.x0)<Math.min(b.x1,v.x1)&&Math.max(b.y0,v.y0)<Math.min(b.y1,v.y1));
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
