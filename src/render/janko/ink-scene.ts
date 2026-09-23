/* Ordered, deliberately PARTIAL placed ink scene. Never use this as global occupancy:
 * ledger/rhythm/holds/rests/ottava/furniture/contour/compression are not covered.
 * No cache: key contains the full source and placed layout, not system count.
 */
import type { QuantizedGridScore } from '../../model/types';
import { getDuodecimalDigit } from '../types';
import type { JankoSystemLayout } from './engine';
import { DEFAULT_JANKO_TOKENS } from './types';
import type { ResolvedJankoLayoutOptions, ResolvedJankoTokens } from './types';
import { pitchGridRules } from './elements/staff';
import { barlineStrokes, beatGridStrokes } from './elements/barlines';
import { f } from './elements/style';
import type { VerticalGridStroke } from './elements/barlines';
import { getScaledKnockoutMetrics, digitBaselineOffset, JANKO_USER_UNITS_PER_PT, JANKO_HALO_STROKE_WIDTH } from './elements/notehead';
import type { JankoNoteheadSpec } from './elements/notehead';
import { GOTHIC_DEMI_GLYPHS } from './gothic-glyphs';

export const SCENE_VERSION = 1;
export const SCENE_FONT = 'public/fonts/URWGothic-Demi.otf:sha256:5b009410cf5231dcb1e45b155c1afedcfc63d82042fd8c414d0dd7705c9fbbae:1000upm';
export const SCENE_COVERAGE = {
  migrated: ['pitch-grid', 'measure-barlines', 'beat-pulses', 'ordinary-noteheads'] as const,
  legacyBroadBounds: ['ledger', 'stems', 'beams', 'rests', 'brackets', 'ties', 'holds', 'duration', 'ottava', 'measure-furniture', 'handprint', 'compressed-cluster', 'contour', 'guidelines', 'middle-c-spine', 'page-policy'] as const,
} as const;
export type InkBox = { x0: number; y0: number; x1: number; y1: number };
export type InkPrimitive =
  | { kind: 'stroke'; x1: number; y1: number; x2: number; y2: number; width: number; cap: 'butt'; dash?: string }
  | { kind: 'ring'; cx: number; cy: number; radius: number; width: number }
  | { kind: 'glyph'; digit: string; x: number; baseline: number; em: number; face: typeof SCENE_FONT }
  | { kind: 'erase'; box: InkBox; protects: 'own-digit' | 'strict-grid-air'; stroke?: Extract<InkPrimitive,{kind:'stroke'}> };
export interface InkPiece {
  id: string;
  family: typeof SCENE_COVERAGE.migrated[number];
  ownerIds: readonly string[];
  structuralOwner?: string;
  tick?: number;
  span?: readonly [number, number];
  system: number;
  pagePiece: number;
  layer: 'pitch' | 'ordinary-grid' | 'strict-grid' | 'head';
  primitive: InkPrimitive;
  /** Broad phase ONLY; mask is never occupied ink. */
  box: InkBox;
  /** Non-geometric paint style; geometry is exclusively in primitive. */
  paint: { cls: string; color?: string };
  readonly svg: string;
}
/** Serialize the stored primitive, never the constructor input or a cached SVG. */
export function serializeInkPiece(piece: InkPiece): string {
  const p=piece.primitive,{cls,color}=piece.paint;
  if(p.kind==='ring')return `    <circle class="${cls}" cx="${f(p.cx)}" cy="${f(p.cy)}" r="${f(p.radius)}" fill="none" stroke="${color}" stroke-width="${p.width.toFixed(2)}"/>`;
  if(p.kind==='glyph'){
    requirePinnedFace(p);
    const size=p.em/JANKO_USER_UNITS_PER_PT;
    const sizeStr=size%1===0?size.toFixed(1):Number(size.toFixed(3));
    return `    <text class="${cls}" x="${f(p.x)}" y="${f(p.baseline)}" font-weight="700" font-size="${sizeStr}pt" fill="${color}">${p.digit}</text>`;
  }
  if(p.kind==='erase'&&!p.stroke){
    const b=p.box;
    return `    <rect class="${cls}" x="${f(b.x0)}" y="${f(b.y0)}" width="${f(b.x1-b.x0)}" height="${f(b.y1-b.y0)}" fill="${color}"/>`;
  }
  const s=p.kind==='erase'?p.stroke!:p;
  const dash=s.dash?` stroke-dasharray="${s.dash}"`:'';
  return `    <line class="${cls}" x1="${f(s.x1)}" y1="${f(s.y1)}" x2="${f(s.x2)}" y2="${f(s.y2)}" stroke="${color}" stroke-width="${s.width.toFixed(2)}"${dash}/>`;
}
function inkPiece(data:Omit<InkPiece,'svg'>):InkPiece {
  return Object.defineProperty(data,'svg',{get(this:InkPiece){return serializeInkPiece(this);},enumerable:true}) as InkPiece;
}
function primitiveBox(p:InkPrimitive):InkBox {
  if(p.kind==='erase')return p.stroke?strokeBox(p.stroke):p.box;
  if(p.kind==='stroke')return strokeBox(p);
  if(p.kind==='glyph')return glyphBox(p);
  return box(p.cx-p.radius-p.width/2,p.cy-p.radius-p.width/2,p.cx+p.radius+p.width/2,p.cy+p.radius+p.width/2);
}
export interface InkScene {
  version: typeof SCENE_VERSION;
  /** Complete content and final placed geometry. Not a layout-cache key. */
  key: string;
  coverage: typeof SCENE_COVERAGE;
  pitch: readonly InkPiece[];
  beat: readonly InkPiece[];
  barlines: readonly InkPiece[];
  heads: ReadonlyMap<string, readonly InkPiece[]>;
  /** Finite physical broad-phase boxes after earlier strokes are clipped. */
  physical: readonly (InkBox & {what:string})[];
}
const revisionString=(value:unknown):string=>JSON.stringify(value,(_key,entry:unknown)=>
  entry instanceof Map?{mapEntries:[...entry.entries()]}:
  entry instanceof Set?{setMembers:[...entry.values()]}:entry);
const box = (x0: number, y0: number, x1: number, y1: number): InkBox => ({ x0: Math.min(x0,x1), y0: Math.min(y0,y1), x1: Math.max(x0,x1), y1: Math.max(y0,y1) });
function strokeBox(p: Extract<InkPrimitive,{kind:'stroke'}>): InkBox {
  const h = p.width / 2;
  if(p.x1===p.x2)return box(p.x1-h,p.y1,p.x2+h,p.y2);
  if(p.y1===p.y2)return box(p.x1,p.y1-h,p.x2,p.y2+h);
  return box(p.x1-h,p.y1-h,p.x2+h,p.y2+h);
}
function strokePiece(s: VerticalGridStroke, family: InkPiece['family'], order: number, system: number, pagePiece: number, layer: InkPiece['layer']): InkPiece {
  const stroke: Extract<InkPrimitive,{kind:'stroke'}> = {kind:'stroke',x1:s.x,y1:s.y1,x2:s.x,y2:s.y2,width:s.width,cap:'butt',dash:s.dash};
  const primitive: InkPrimitive = s.erase
    ? {kind:'erase',box:strokeBox(stroke),protects:'strict-grid-air',stroke}
    : stroke;
  return inkPiece({ id:`s${system}:${family}:${order}`,family,ownerIds:[],structuralOwner:family,tick:s.tick,system,pagePiece,layer,primitive,box:primitiveBox(primitive),paint:{cls:s.cls,color:s.stroke} });
}
function requirePinnedFace(p:Extract<InkPrimitive,{kind:'glyph'}>):void {
  if(p.face!==SCENE_FONT)throw new Error(`Measured ink unavailable for digit face: ${p.face}`);
}
function glyphBox(p: Extract<InkPrimitive,{kind:'glyph'}>): InkBox {
  requirePinnedFace(p);
  const g = GOTHIC_DEMI_GLYPHS[p.digit];
  if (!g) throw new Error(`Unsupported painted-ink glyph ${p.digit}`);
  const points = g.contours.flat();
  return box(p.x+(Math.min(...points.map(pt=>pt[0]))-g.advance/2)*p.em/1000,
    p.baseline-Math.max(...points.map(pt=>pt[1]))*p.em/1000,
    p.x+(Math.max(...points.map(pt=>pt[0]))-g.advance/2)*p.em/1000,
    p.baseline-Math.min(...points.map(pt=>pt[1]))*p.em/1000);
}
function headPieces(spec: JankoNoteheadSpec, id: string, tick: number, system: number, pagePiece: number, o: ResolvedJankoLayoutOptions, t: ResolvedJankoTokens, owners: readonly string[]): InkPiece[] {
  const scale=spec.symbolScale??1;
  const metrics=getScaledKnockoutMetrics(o,t,scale,spec.chordMember===true);
  const hy=metrics.hy+(spec.tallKnockout?t.stemAttachmentAir:0);
  const digit=spec.digit??getDuodecimalDigit(spec.pitchClass);
  const glyph: InkPrimitive={kind:'glyph',digit,x:spec.x,baseline:spec.y+digitBaselineOffset(t.digitFontSize*scale),em:t.digitFontSize*scale*JANKO_USER_UNITS_PER_PT,face:SCENE_FONT};
  const make=(suffix:string,primitive:InkPrimitive,cls:string,color:string): InkPiece => inkPiece({id:`s${system}:head:${id}:${suffix}`,family:'ordinary-noteheads',ownerIds:owners,tick,system,pagePiece,layer:'head',primitive,box:primitiveBox(primitive),paint:{cls,color}});
  const out:InkPiece[]=[];
  if(spec.isPositionOfHonor){
    const r=t.haloRadius,w=JANKO_HALO_STROKE_WIDTH;
    out.push(make('halo',{kind:'ring',cx:spec.x,cy:spec.y,radius:r,width:w},'janko-halo','#111111'));
  }
  const mask=box(spec.x-metrics.wx,spec.y-hy,spec.x+metrics.wx,spec.y+hy);
  out.push(make('mask',{kind:'erase',box:mask,protects:'own-digit'},'janko-knockout','#FFFFFF'));
  out.push(make('digit',glyph,'janko-digit','#111111'));
  return out;
}
/** This constructor runs AFTER final page shifts/re-layout. Preliminary seat queries
 * use the SAME pitchGridRules constructor with then-known geometry, never this
 * final-placement bundle. All source/editorial identities are part of key. */
export function buildInkScene(layout:JankoSystemLayout,o:ResolvedJankoLayoutOptions,t:ResolvedJankoTokens,score?:QuantizedGridScore):InkScene {
  if (t.fontFamily !== DEFAULT_JANKO_TOKENS.fontFamily) {
    throw new Error(`Measured ink unavailable for custom digit face: ${t.fontFamily}`);
  }
  const source=score??layout.scoreRevision;
  if(!source)throw new Error('Placed ink scene requires complete score/source/editorial revision');
  if(score&&layout.scoreRevision&&score!==layout.scoreRevision&&
    revisionString(score)!==revisionString(layout.scoreRevision)) {
    throw new Error('Placed ink scene refuses a layout from a different score/source/editorial revision');
  }
  const g=layout.geometry,system=layout.index;
  const pagePiece=Math.floor(system/Math.max(1,o.systemsPerPage));
  const pitch:InkPiece[]=pitchGridRules(g,o,t).map((r,i)=>{
    const primitive:InkPrimitive={kind:'stroke',x1:r.x1,y1:r.y,x2:r.x2,y2:r.y,width:r.width,cap:'butt'};
    return inkPiece({id:`s${system}:pitch:${i}`,family:'pitch-grid',structuralOwner:'staff-rule',ownerIds:[],span:[r.x1,r.x2] as const,system,pagePiece,layer:'pitch',primitive,box:strokeBox(primitive),paint:{cls:r.cls,color:r.ink}});
  });
  const gridLayer=o.gridWritingPolicy==='strict-protected-grid'?'strict-grid':'ordinary-grid';
  const beat=beatGridStrokes(g,system,o,t,layout.columns).map((s,i)=>strokePiece(s,'beat-pulses',i,system,pagePiece,gridLayer));
  const barlines=barlineStrokes(g,o,t,layout.isFinalSystem).map((s,i)=>strokePiece(s,'measure-barlines',i,system,pagePiece,gridLayer));
  const heads=new Map<string,readonly InkPiece[]>();
  for(const p of layout.notes){
    if(layout.compressedCopyIds?.has(p.note.id)||layout.handprintNoteIds?.has(p.note.id)) continue;
    // Merged contributors disappear from layout.notes, including exact voices
    // which also disappear from unisonVoices. The merge ledger owns them all.
    const contributors=[p.note.id,...layout.unisonMerges.filter(m=>m.survivorId===p.note.id).flatMap(m=>m.mergedIds)];
    heads.set(p.note.id,headPieces({x:p.x,y:p.y,pitchClass:p.coord.pitchClass,hand:p.coord.hand,isPositionOfHonor:p.note.startTick===0&&o.showHonorHalo,tallKnockout:p.tallKnockout===true,symbolScale:p.symbolScale,chordMember:p.symbolChord},p.note.id,p.note.startTick,system,pagePiece,o,t,contributors));
  }
  const {scoreRevision: _source, ...placed} = layout;
  const scene:InkScene={version:SCENE_VERSION,key:revisionString({version:SCENE_VERSION,score:source,layout:placed,options:o,tokens:t,font:SCENE_FONT}),coverage:SCENE_COVERAGE,pitch,beat,barlines,heads,physical:[]};
  return {...scene,physical:scenePhysicalBoxes(scene)};
}
export function scenePhysicalBoxes(scene:InkScene):Array<InkBox & {what:string}> {
  // An inventory of visible stroke intervals, not a grid envelope and not
  // knockout rectangles. Broad glyph/ring boxes still require sceneInkAt for
  // narrow phase: the hollow regions of these boxes are not obstacles.
  const ordered=[...scene.pitch,...scene.beat,...scene.barlines,...scene.heads.values()].flat() as InkPiece[];
  const result:Array<InkBox & {what:string}>=[];
  for(let i=0;i<ordered.length;i++){
    const piece=ordered[i],p=piece.primitive;
    if(p.kind==='erase')continue;
    if(p.kind==='glyph'||p.kind==='ring'){
      result.push({...primitiveBox(p),what:`visible ${p.kind} ${piece.id}`});
      continue;
    }
    const length=Math.hypot(p.x2-p.x1,p.y2-p.y1);
    if(length<=0)continue;
    const vertical=p.x1===p.x2,horizontal=p.y1===p.y2;
    // For non-axis strokes, retain their conservative broad box rather than
    // pretend axis-aligned rectangle subtraction describes their outline.
    if(!vertical&&!horizontal){result.push({...primitiveBox(p),what:`visible stroke ${piece.id}`});continue;}
    // Dash phase starts at the first SVG endpoint, even when the segment runs
    // towards decreasing x/y. Using the minimum coordinate invents blockers
    // in gaps and omits painted dashes for reversed strokes.
    let visible=strokeDashBoxes(p);
    for(const later of ordered.slice(i+1)){
      if(later.primitive.kind!=='erase')continue;
      for(const cut of eraseBoxes(later.primitive))visible=visible.flatMap(b=>subtractBox(b,cut));
    }
    for(const b of visible)result.push({...b,what:`visible stroke ${piece.id}`});
  }
  return result;
}

// Split BOTH axes: clipping a stroke's central/lower half must not discard
// the surviving upper half. Zero-area seams are not physical obstacles.
function subtractBox(b:InkBox,c:InkBox):InkBox[] {
  const x0=Math.max(b.x0,c.x0),x1=Math.min(b.x1,c.x1);
  const y0=Math.max(b.y0,c.y0),y1=Math.min(b.y1,c.y1);
  if(x0>=x1||y0>=y1)return [b];
  return [box(b.x0,b.y0,x0,b.y1),box(x1,b.y0,b.x1,b.y1),
    box(x0,b.y0,x1,y0),box(x0,y1,x1,b.y1)].filter(v=>v.x1>v.x0&&v.y1>v.y0);
}

export function sceneGridSvg(pieces:readonly InkPiece[],cls:string,emptyGroup:boolean):string {
  if(!emptyGroup&&pieces.length===0)return '';
  return [`  <g class="${cls}">`,...pieces.map(p=>p.svg),'  </g>'].join('\n');
}
export function sceneHeadSvg(scene:InkScene,id:string):string {
  const pieces=scene.heads.get(id);
  if(!pieces)throw new Error(`Missing scene notehead ${id}`);
  return pieces.map(p=>p.svg).join('\n');
}
/** Explicit partial-coverage guard for callers needing other families. */
export function requireSceneCoverage(scene:InkScene,family:string):void {
  if(!(scene.coverage.migrated as readonly string[]).includes(family))throw new Error(`InkScene v${scene.version} does not cover ${family}; use labelled legacy consumer`);
}
/** An actual x-bounded structural rule, never a fallback to a distant rule. */
export function sceneStaffRules(scene:InkScene,x:number):readonly InkPiece[] {
  return scene.pitch.filter(p=>p.primitive.kind==='stroke' &&
    sceneInkAt(scene,x,p.primitive.y1).includes(p));
}
/** Preliminary structural rules for the pre-layout solver. */
export function preliminaryStaffRules(geo:JankoSystemLayout['geometry'],o:ResolvedJankoLayoutOptions,t:ResolvedJankoTokens,x?:number):Array<{y:number;half:number;x1:number;x2:number}> {
  return pitchGridRules(geo,o,t).filter(p=>x===undefined||(p.x1<=x&&x<=p.x2)).map(p=>({y:p.y,half:p.width/2,x1:p.x1,x2:p.x2}));
}
/** The physical inventory is incomplete; broad boxes are NOT collision queries.
 * Clipping and detailed mark intersection are performed by sceneInkAt below. */
export function sceneInkAt(scene:InkScene,x:number,y:number):readonly InkPiece[] {
  const painted:InkPiece[]=[];
  const ordered=[...scene.pitch,...scene.beat,...scene.barlines,...scene.heads.values()].flat() as InkPiece[];
  for(const p of ordered){
    if(p.primitive.kind==='erase'){
      if(inBox(primitiveBox(p.primitive),x,y)&&(!p.primitive.stroke||primitiveInkAt(p.primitive.stroke,x,y)))painted.length=0;
    }else if(inBox(primitiveBox(p.primitive),x,y)&&primitiveInkAt(p.primitive,x,y))painted.push(p);
  }
  return painted;
}
const inBox=(b:InkBox,x:number,y:number)=>x>=b.x0&&x<=b.x1&&y>=b.y0&&y<=b.y1;
/** SVG dash phases measured from the segment start; whitespace is not a mask. */
function strokeIntervals(length:number,dash?:string):Array<[number,number]> {
  if(!dash)return [[0,length]];
  const phases=dash.split(',').map(Number),out:Array<[number,number]>=[];
  for(let at=0,k=0;at<length;k++){
    const duration=phases[k%phases.length];
    if(k%2===0&&duration>0)out.push([at,Math.min(length,at+duration)]);
    at+=duration;
  }
  return out;
}
function strokeDashBoxes(s:Extract<InkPrimitive,{kind:'stroke'}>):InkBox[] {
  const length=Math.hypot(s.x2-s.x1,s.y2-s.y1);
  if(!length)return [];
  return strokeIntervals(length,s.dash).map(([a,z])=>{
    const x0=s.x1+(s.x2-s.x1)*a/length,y0=s.y1+(s.y2-s.y1)*a/length;
    const x1=s.x1+(s.x2-s.x1)*z/length,y1=s.y1+(s.y2-s.y1)*z/length;
    return s.x1===s.x2?box(x0-s.width/2,y0,x1+s.width/2,y1):box(x0,y0-s.width/2,x1,y1+s.width/2);
  });
}
function eraseBoxes(p:Extract<InkPrimitive,{kind:'erase'}>):InkBox[] {
  if(!p.stroke)return [p.box];
  const s=p.stroke,length=Math.hypot(s.x2-s.x1,s.y2-s.y1);
  // Non-axis aligned strokes are left broad rather than falsely clipped.
  if(!length||s.x1!==s.x2&&s.y1!==s.y2)return [];
  return strokeDashBoxes(s);
}
function primitiveInkAt(p:Exclude<InkPrimitive,{kind:'erase'}>,x:number,y:number):boolean {
  if(p.kind==='ring'){
    const d=Math.hypot(x-p.cx,y-p.cy);return Math.abs(d-p.radius)<=p.width/2;
  }
  if(p.kind==='glyph'){
    requirePinnedFace(p);
    const g=GOTHIC_DEMI_GLYPHS[p.digit];if(!g)throw new Error(`Unsupported painted-ink glyph ${p.digit}`);
    const u=(x-p.x)*1000/p.em+g.advance/2,v=(p.baseline-y)*1000/p.em;
    // Even-odd across contours: hollow counters remain empty.
    let inside=false;
    for(const contour of g.contours){for(let i=0,j=contour.length-1;i<contour.length;j=i++){
      const a=contour[i],b=contour[j];
      if((a[1]>v)!==(b[1]>v)&&u<(b[0]-a[0])*(v-a[1])/(b[1]-a[1])+a[0])inside=!inside;
    }}return inside;
  }
  const dx=p.x2-p.x1,dy=p.y2-p.y1,len=dx*dx+dy*dy;
  const u=len===0?0:((x-p.x1)*dx+(y-p.y1)*dy)/len;
  if(u<0||u>1)return false; // butt caps do not extend beyond endpoints
  if(Math.hypot(x-p.x1-u*dx,y-p.y1-u*dy)>p.width/2)return false;
  if(!p.dash)return true;
  const parts=p.dash.split(',').map(Number),period=parts.reduce((a,b)=>a+b,0);
  let pos=(u*Math.sqrt(len))%period;
  for(let i=0;i<parts.length;i++){if(pos<parts[i])return i%2===0;pos-=parts[i];}
  return false;
}
