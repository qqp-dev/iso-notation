import { normalizePedalEvents } from '../../../model/expressions';
/** Source-timed expression ink in Janko coordinates. No sounding durations are altered. */
import type { QuantizedGridScore } from '../../../model/types';
import { DYNAMIC_PATHS } from './dynamic-paths';
import {DYNAMIC_FAMILIES,dynamicFamilyInk,type DynamicFamily,type DynamicFamilyInk} from './dynamic-families';
import type {PedalTextFamily} from './paired-typography-paths';
import {pedalStartInk,type PedalStartInk,type PedalStartStyle} from './pedal-starts';
import { taperedSpanPath, type TaperedSpanProfile } from '../ties';
import { routeLocalPhrases } from '../phrase-routing';
import { routeBalancedPhrases } from '../balanced-phrases';
import {routeOpticalPhrases} from '../optical-phrases';
import type {OpticalPhraseDomain} from '../optical-phrase-domain';

export interface ExpressionInk {
  kind: 'dynamic' | 'hairpin' | 'pedal' | 'phrase';
  id: string;
  x0: number; x1: number; y0: number; y1: number;
  startTick: number; endTick: number;
  continuationStart: boolean; continuationEnd: boolean;
  endpointIds?: [string[], string[]];
  svg: string;
  /** Filled contour, not its (mostly empty) bounding rectangle. */
  contour?: {xStart:number;xEnd:number;yStart:number;yEnd:number;side:-1|1;depth:number;thickness:number;indent:number} & TaperedSpanProfile;
  gridKnockout?: boolean;
  routingIssue?: string;
  /** Settled butt-capped line ink, including its actual painted width. */
  strokeSegments?: {x0:number;y0:number;x1:number;y1:number;width:number}[];
  pedalStartInk?:PedalStartInk;
  dynamicFamilyInk?:DynamicFamilyInk;
}
export interface ExpressionPlacement {
  /** Display-field membership only; original source arrays remain untouched. */
  include?: (kind:ExpressionInk['kind'],id:string)=>boolean;
  start: number; end: number; left: number; right: number;
  top: number; bottom: number;
  x: (tick: number) => number;
  endpointX: (ids: string[], tick: number) => number;
  endpointEnvelope?: (ids: string[], tick: number) => {top:number;bottom:number;hand:'RH'|'LH'} | undefined;
  obstacles?: readonly {x0:number;x1:number;y0:number;y1:number}[];
  /** Real musical ink for weak phrase-side balance; exclude guide lines and
   * conservative head-clearance masks from this visual weight estimate. */
  balanceObstacles?: readonly {x0:number;x1:number;y0:number;y1:number}[];
  clarity?: boolean;
  dynamicScale?: number;
  dynamicFamily?:DynamicFamily;
  contourThickness?: number;
  phraseRouting?: 'local' | 'balanced' | 'optical-gesture' | 'optical-fitted' | 'optical-breathing' | 'optical-silhouette' | 'optical-open';
  phraseTaper?: 'gentle' | 'pointed';
  phrasePlacement?: 'preferred-side' | 'gesture-contour' | 'above-diagnostic';
  hairpinStrokeWidth?: number;
  pedalStart?:PedalStartStyle;
  pedalTextFamily?:PedalTextFamily;
  opticalDomain?: (id:string)=>OpticalPhraseDomain|undefined;
  /** Derived once from actual source expression/hold presence in this system;
   * only the successor route uses the existing lower-floor consequence. */
  expressionFloorActive?:boolean;
}
const f = (n: number) => n.toFixed(3);
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&apos;' }[c]!));
const line = (d: string, cls: string, width=.65) => `<path class="janko-${cls}" d="${d}" fill="none" stroke="#111111" stroke-width="${width}"/>`;

/** Pair pedal state without manufacturing releases at bars, systems or pages. */
export function pedalIntervals(score: Pick<QuantizedGridScore, 'pedals' | 'totalTicks'>) {
  const intervals: { start: number; end: number; changes: number[]; release: boolean }[] = [];
  let active: { start: number; changes: number[] } | undefined;
  for (const e of normalizePedalEvents([...(score.pedals ?? [])].sort((a,b) => a.tick - b.tick || (a.order ?? 0) - (b.order ?? 0)))) {
    if (e.type === 'una-corda') continue;
    if (e.type === 'sustain-down') {
      if (active) active.changes.push(e.tick);
      else active = { start: e.tick, changes: [] };
    } else if (e.type === 'sustain-change') {
      if (!active) throw Error('Pedal change without depression');
      active.changes.push(e.tick);
    } else if (active) {
      intervals.push({ ...active, end: e.tick, release: true }); active = undefined;
    }
  }
  if (active) intervals.push({ ...active, end: score.totalTicks, release: false });
  return intervals;
}

export function placeExpressions(score: QuantizedGridScore, p: ExpressionPlacement): ExpressionInk[] {
  const out: ExpressionInk[] = [];
  const x = (tick: number) => tick <= p.start ? p.left : tick >= p.end ? p.right : p.x(tick);
  const add = (ink: ExpressionInk) => {
    if (![ink.x0,ink.x1,ink.y0,ink.y1].every(Number.isFinite) || ink.x1 <= ink.x0 || ink.y1 <= ink.y0)
      throw Error(`Invalid expression geometry: ${ink.id}`);
    out.push(ink);
  };
  // Phrasing retains its associated source columns, with locally earned
  // endpoint height and collision-tested side/depth. The historical system-air
  // axis remains available only for the real-engine pre-pass comparison.
  const phraseLanes: { x0: number; x1: number; lane: number }[] = [];
  for (const phrase of score.phrases ?? []) {
    if(p.include&&!p.include('phrase',phrase.id))continue;
    if (phrase.endTick < p.start || phrase.startTick >= p.end) continue;
    const cs = phrase.startTick < p.start, ce = phrase.endTick >= p.end;
    const startX = cs ? p.left : p.endpointX(phrase.fromNoteIds, phrase.startTick);
    const endX = ce ? p.right : p.endpointX(phrase.toNoteIds, phrase.endTick);
    const local = !!p.clarity || !!phrase.sourceSide;
    const sourceSide = phrase.sourceSide === 'above' ? -1 : phrase.sourceSide === 'below' ? 1 : undefined;
    const air = local ? Math.min(3.6,(endX-startX)/8) : 0;
    const x0=startX+(cs?0:air), x1=endX-(ce?0:air);
    if (x1 <= x0) throw Error(`Nonpositive phrase span ${phrase.id}`);
    let lane = 0;
    while (phraseLanes.some(q => q.lane === lane && q.x0 < x1 + 2 && q.x1 > x0 - 2)) lane++;
    phraseLanes.push({x0,x1,lane});
    const a = p.endpointEnvelope?.(phrase.fromNoteIds,phrase.startTick);
    const b = p.endpointEnvelope?.(phrase.toNoteIds,phrase.endTick);
    let side: -1|1 = sourceSide ?? -1;
    let y0 = side === -1 ? p.top-6-lane*9 : p.bottom+6+lane*9, y1=y0, depth=5;
    const thickness = p.contourThickness ?? .45;
    if (!p.phraseRouting && local && (a || b)) {
      const preferred = sourceSide ?? ((a ?? b)!.hand === 'LH' ? 1 : -1);
      let best = Infinity;
      // Candidate depth and lift do not change sampled x. Reuse the exact
      // occupied intervals there instead of repeatedly inverting prior curves.
      const previous=out.filter(q=>q.kind==='phrase');
      const samples=Array.from({length:129},(_,i)=>{
        const u=i/128,v=1-u,cx=x0+(x1-x0)*(3*v*v*u*.21+3*v*u*u*.79+u*u*u);
        const occupied=(p.obstacles??[]).filter(q=>cx>q.x0-1.2&&cx<q.x1+1.2).map(q=>[q.y0-1.2,q.y1+1.2]);
        for(const q of previous){const slice=expressionSliceAtX(q,cx);if(slice)occupied.push([slice[0]-1.2,slice[1]+1.2]);}
        return {u,v,occupied};
      });
      // Explicit source direction is a constraint. Undirected phrases retain
      // the existing hand preference and may earn either local corridor.
      const sides: (-1|1)[] = sourceSide === undefined ? [preferred, -preferred as -1|1] : [sourceSide];
      for (const s of sides) for (const lift of [0,2,4,6,8,12,16,24,32,48,64]) {
        const quietEndpoint=(cx:number,y:number)=>{
          // Endpoints earn only the local quiet corridor at their associated
          // column; a foreign rail in that column is real ink, not staff air.
          for(let pass=0;pass<8;pass++){
            const prior=y;
            for(const q of p.obstacles ?? []) if(cx>q.x0-1.2 && cx<q.x1+1.2 && y>q.y0-1.2 && y<q.y1+1.2)
              y=s===-1?q.y0-1.3:q.y1+1.3;
            if(y===prior)break;
          }
          return y;
        };
        const ay = quietEndpoint(x0,(a ? (s===-1?a.top-2:a.bottom+2) : (b ? (s===-1?b.top-2:b.bottom+2) : p.top-6))+s*lift);
        const by = quietEndpoint(x1,b ? (s===-1?b.top-2:b.bottom+2)+s*lift : ay);
        for (let d=3;d<=Math.max(24,Math.min(100,(x1-x0)*.8));d+=2) {
          let hits=0;
          for (const {u,v,occupied} of samples) {
            const cy=ay*v*v*v+3*v*v*u*(ay+s*d/.75)+3*v*u*u*(by+s*d/.75)+by*u*u*u;
            if (occupied.some(q=>cy>q[0]&&cy<q[1])) hits++;
          }
          // A sampled centerline can miss a narrow stem or a crossing between
          // samples. Admit a clear candidate only against its filled ribbon.
          if(hits*1000+d+lift*2+(s===preferred?0:2)<best) {
            const contour={xStart:x0,xEnd:x1,yStart:ay,yEnd:by,side:s,depth:d,thickness,indent:(x1-x0)*.21};
            const candidate:ExpressionInk={kind:'phrase',id:phrase.id,x0:x0-.6,x1:x1+.6,
              y0:Math.min(ay,by)+Math.min(0,s*d/.75)-.6,y1:Math.max(ay,by)+Math.max(0,s*d/.75)+.6,
              startTick:phrase.startTick,endTick:phrase.endTick,continuationStart:cs,continuationEnd:ce,svg:'',contour};
            hits+=(p.obstacles??[]).filter(q=>expressionIntersectsBox(candidate,{x0:q.x0-.6,x1:q.x1+.6,y0:q.y0-.6,y1:q.y1+.6})).length;
            hits+=previous.filter(q=>expressionsOverlap(candidate,q)).length;
          }
          const cost=hits*1000+d+lift*2+(s===preferred?0:2);
          if(cost<best){best=cost;y0=ay;y1=by;side=s;depth=d;}
          if(hits===0) break;
        }
      }
    }
    const dx=(x1-x0)/3;
    const d = local ? taperedSpanPath(x0,y0,x1,y1,side,depth,thickness,(x1-x0)*.21) :
      `M${f(x0)} ${f(y0)} C${f(x0+dx)} ${f(y0-5)} ${f(x1-dx)} ${f(y1-5)} ${f(x1)} ${f(y1)} C${f(x1-dx)} ${f(y1-5-.85)} ${f(x0+dx)} ${f(y0-5-.85)} ${f(x0)} ${f(y0)}Z`;
    const controlLo=Math.min(y0,y1)+Math.min(0,side*depth/.75);
    const controlHi=Math.max(y0,y1)+Math.max(0,side*depth/.75);
    add({kind:'phrase', id:phrase.id, x0:x0-(local ? .6 : 0),x1:x1+(local ? .6 : 0),y0:controlLo-.6,y1:controlHi+.6,
      contour:{xStart:x0,xEnd:x1,yStart:y0,yEnd:y1,side,depth,thickness,indent:(x1-x0)*.21},startTick:phrase.startTick,endTick:phrase.endTick,
      continuationStart:cs,continuationEnd:ce,endpointIds:[phrase.fromNoteIds,phrase.toNoteIds],gridKnockout:local,
      svg:(local?`<path class="janko-phrase-grid-knockout" d="${d}" fill="white" stroke="white" stroke-width="1.2" stroke-linejoin="round"/>`:'')+
        `<path class="janko-phrase" data-phrase="${esc(phrase.id)}" d="${d}" fill="#111111"/>`});
  }
  if(p.phraseRouting==='local')out.splice(0,out.length,...routeLocalPhrases(score,p,out));
  if(p.phraseRouting==='balanced')out.splice(0,out.length,...routeBalancedPhrases(score,p,out));
  if(p.phraseRouting==='optical-gesture'||p.phraseRouting==='optical-fitted'||p.phraseRouting==='optical-breathing'||p.phraseRouting==='optical-silhouette'||p.phraseRouting==='optical-open')out.splice(0,out.length,...routeOpticalPhrases(score,p,out));
  const dynamicLanes: { x0: number; x1: number; lane: number }[] = [];
  for (const [index,e] of (score.dynamics ?? []).entries()) {
    const hairpin = e.kind === 'hairpin' || (!e.kind && ['crescendo','decrescendo'].includes(e.mark) && !!e.durationTicks);
    if(p.include&&!p.include(hairpin?'hairpin':'dynamic',`dynamic-${index}`))continue;
    const end = hairpin ? e.tick + (e.durationTicks ?? 0) : e.tick;
    if (hairpin ? end <= p.start || e.tick >= p.end : e.tick < p.start || e.tick >= p.end) continue;
    const cs = e.tick < p.start, ce = end > p.end;
    let x0 = hairpin ? x(Math.max(p.start,e.tick)) : p.x(e.tick);
    let x1: number, svg: (y: number) => string, height: number,dynamicInk:((y:number)=>DynamicFamilyInk)|undefined;
    let hairpinA=0,hairpinB=0;
    if (hairpin) {
      if (end <= e.tick) throw Error('Nonpositive source hairpin');
      x1 = x(Math.min(p.end,end)); height = 6;
      const aperture = (tick: number) => 2.5 * (e.mark === 'crescendo' ? (tick-e.tick)/(end-e.tick) : (end-tick)/(end-e.tick));
      const a = hairpinA=aperture(Math.max(p.start,e.tick)), b = hairpinB=aperture(Math.min(p.end,end));
      const width=p.hairpinStrokeWidth??.65;
      if(!Number.isFinite(width)||width<=0)throw Error('Invalid hairpin stroke width');
      svg = y => line(`M${f(x0)} ${f(y+3-a)}L${f(x1)} ${f(y+3-b)}M${f(x0)} ${f(y+3+a)}L${f(x1)} ${f(y+3+b)}`, 'hairpin',width);
    } else if (e.kind === 'text-cresc' || e.text) {
      const text = e.text ?? (e.mark === 'decrescendo' ? 'diminuendo' : 'cresc.');
      const width = text.length * 4.4; height = 10;
      x0 = Math.max(p.left,Math.min(x0,p.right-width)); x1=x0+width;
      svg = y => `<text class="janko-expression-text" x="${f(x0)}" y="${f(y+8)}" font-family="Century Schoolbook,serif" font-size="8.5" font-style="italic">${esc(text)}</text>`;
    } else {
      const glyph = p.dynamicFamily?(DYNAMIC_FAMILIES[p.dynamicFamily].marks as Record<string,{path:string;bounds:readonly number[]}>)[e.mark]:DYNAMIC_PATHS[e.mark]; if (!glyph) throw Error(`Unsupported dynamic glyph ${e.mark}`);
      const [loX,loY,hiX,hiY] = glyph.bounds, scale=p.dynamicScale ?? .016, pad=e.parenthesized?4:0;
      const width=(hiX-loX)*scale+2*pad; height=Math.max((hiY-loY)*scale,e.parenthesized?10:0);
      x0=Math.max(p.left,Math.min(x0-width/2,p.right-width)); x1=x0+width;
      if(p.dynamicFamily)dynamicInk=y=>dynamicFamilyInk(p.dynamicFamily!,e.mark,x0+pad-loX*scale,y+hiY*scale,scale);
      svg = y => `<g class="janko-dynamic"${p.dynamicFamily?` data-dynamic-family="${p.dynamicFamily}"`:''} aria-label="${esc(e.parenthesized ? `(${e.mark})` : e.mark)}">`+
        `<path d="${glyph.path}" transform="translate(${f(x0+pad-loX*scale)} ${f(y+hiY*scale)}) scale(${scale} ${-scale})" fill="#111111"/>`+
        (e.parenthesized ? `<text x="${f(x0)}" y="${f(y+height*.85)}" font-family="serif" font-size="10">(</text><text x="${f(x1-4)}" y="${f(y+height*.85)}" font-family="serif" font-size="10">)</text>` : '')+'</g>';
    }
    let lane=0; while(dynamicLanes.some(q => q.lane===lane && q.x0<x1+3 && q.x1>x0-3)) lane++;
    dynamicLanes.push({x0,x1,lane}); const y=Math.max(p.bottom,...out.filter(q=>q.kind==='phrase').map(q=>q.y1))+8+lane*14;
    // Retain historical admission padding at0.65pt. Opted-in widths expand
    // that same conservative frame; physical queries use the painted lines.
    const pad=hairpin&&p.hairpinStrokeWidth!==undefined?p.hairpinStrokeWidth/2+.025:.35;
    const strokeSegments=hairpin&&p.hairpinStrokeWidth!==undefined?[-1,1].map(side=>({x0:Number(f(x0)),x1:Number(f(x1)),y0:Number(f(y+3+side*hairpinA)),y1:Number(f(y+3+side*hairpinB)),width:p.hairpinStrokeWidth!})):undefined;
    add({kind:hairpin?'hairpin':'dynamic',id:`dynamic-${index}`,x0:x0-pad,x1:x1+pad,y0:y-pad,y1:y+height+pad,
      startTick:e.tick,endTick:end,continuationStart:cs,continuationEnd:ce,svg:svg(y),...(strokeSegments?{strokeSegments}:{}),...(dynamicInk?{dynamicFamilyInk:dynamicInk(y)}:{})});
  }
  const dynamicBottom=Math.max(p.bottom,...out.map(q=>q.y1));
  const pedalY=dynamicBottom+12;
  for (const [i,interval] of pedalIntervals(score).entries()) {
    if(p.include&&!p.include('pedal',`pedal-${i}`))continue;
    if(interval.end<=p.start || interval.start>=p.end) continue;
    const cs=interval.start<p.start, ce=interval.end>p.end || !interval.release;
    const x0=x(interval.start),x1=x(interval.end),y=pedalY;
    if(p.pedalStart){
      const start=cs?undefined:pedalStartInk(p.pedalStart,interval.start,`pedal-${i}`,x0,y,7.2,p.pedalTextFamily),lineStart=start?(start.holdX??start.x1+.8):x0;
      if(lineStart>=x1)throw Error(`Pedal start glyph does not fit source interval pedal-${i}`);
      let d=`M${f(lineStart)} ${f(y)}`,atX=lineStart,atY=y;
      const strokeSegments:NonNullable<ExpressionInk['strokeSegments']>=[];
      const to=(px:number,py:number)=>{strokeSegments.push({x0:Number(f(atX)),y0:Number(f(atY)),x1:Number(f(px)),y1:Number(f(py)),width:.65});atX=px;atY=py;};
      for(const tick of interval.changes.filter(t=>t>=p.start&&t<p.end)){
        const cx=Math.max(lineStart+2,x(tick)),half=Math.min(2,(cx-lineStart)/2,(x1-cx)/2);
        d+=`H${f(cx-half)}L${f(cx)} ${f(y-3)}L${f(cx+half)} ${f(y)}`;to(cx-half,y);to(cx,y-3);to(cx+half,y);
      }
      d+=`H${f(x1)}`;to(x1,y);if(!ce){d+=`V${f(y-4)}`;to(x1,y-4);}
      const bounds=strokeSegments.map(expressionStrokeBounds);
      add({kind:'pedal',id:`pedal-${i}`,x0:Math.min(start?.x0??lineStart,...bounds.map(b=>b.x0))-.025,x1:Math.max(start?.x1??lineStart,...bounds.map(b=>b.x1))+.025,
        y0:Math.min(start?.y0??y,...bounds.map(b=>b.y0))-.025,y1:Math.max(start?.y1??y,...bounds.map(b=>b.y1))+.025,
        startTick:interval.start,endTick:interval.end,continuationStart:cs,continuationEnd:ce,strokeSegments,...(start?{pedalStartInk:start}:{}),svg:(start?.svg??'')+line(d,'pedal')});
      continue;
    }
    let d=cs?`M${f(x0)} ${f(y)}`:`M${f(x0)} ${f(y-4)}V${f(y)}`;
    for(const tick of interval.changes.filter(t=>t>=p.start && t<p.end)) {
      const cx=Math.max(x0+2,x(tick)), half=Math.min(2,(cx-x0)/2,(x1-cx)/2);
      d+=`H${f(cx-half)}L${f(cx)} ${f(y-3)}L${f(cx+half)} ${f(y)}`;
    }
    d+=`H${f(x1)}`; if(!ce)d+=`V${f(y-4)}`;
    add({kind:'pedal',id:`pedal-${i}`,x0:x0-.35,x1:x1+.35,y0:y-4.35,y1:y+.35,startTick:interval.start,endTick:interval.end,
      continuationStart:cs,continuationEnd:ce,svg:line(d,'pedal')});
  }
  return out;
}
/** Vertical interval occupied by a monotone two-cubic contour at page x. */
export function expressionSliceAtX(q:ExpressionInk,x:number):[number,number]|undefined {
  if(!q.contour)return undefined;
  const u=expressionContourParameterAtX(q.contour,x);
  return u===undefined?undefined:expressionSliceAtParameter(q.contour,x,u);
}
/** Exact 32-step inverse. A caller may reuse u only for identical x controls
 * and query x; y, depth, side and taper do not enter this calculation. */
export function expressionContourParameterAtX(c:NonNullable<ExpressionInk['contour']>,x:number):number|undefined {
  if(x<=c.xStart || x>=c.xEnd)return undefined;
  const x0=c.xStart,x1=c.xEnd,ax=x0+(c.startIndent??c.indent),bx=x1-(c.endIndent??c.indent);
  let lo=0,hi=1;
  for(let i=0;i<32;i++){const u=(lo+hi)/2,v=1-u;
    const cx=v*v*v*x0+3*v*v*u*ax+3*v*u*u*bx+u*u*u*x1;if(cx<x)lo=u;else hi=u;}
  return (lo+hi)/2;
}
/** Evaluate at an exact inverse supplied by the dependency-scoped caller.
 * Arithmetic order matches expressionSliceAtX's original calculation. */
export function expressionSliceAtParameter(c:NonNullable<ExpressionInk['contour']>,x:number,u:number):[number,number] {
  const x0=c.xStart,x1=c.xEnd,v=1-u,axis=c.chordAligned?c.yStart+(c.yEnd-c.yStart)*(x-x0)/(x1-x0):c.yStart*(v*v*v+3*v*v*u)+c.yEnd*(3*v*u*u+u*u*u);
  const start=c.startDepth??c.depth,end=c.endDepth??c.depth;
  const outer=axis+c.side*(3*v*v*u*start+3*v*u*u*end)/.75;
  const inner=c.tipThickness===undefined?axis+c.side*(3*v*v*u*Math.max(0,start-c.thickness)+3*v*u*u*Math.max(0,end-c.thickness))/.75:
    outer-c.side*(c.tipThickness+(c.thickness-c.tipThickness)*4*u*v);
  return [Math.min(outer,inner),Math.max(outer,inner)];
}
export function expressionsOverlap(a:ExpressionInk,b:ExpressionInk):boolean {
  if(!a.contour || !b.contour)return expressionIntersectsBox(a,b)&&expressionIntersectsBox(b,a);
  const left=Math.max(a.contour.xStart,b.contour.xStart),right=Math.min(a.contour.xEnd,b.contour.xEnd);if(right<=left)return false;
  let previous:number|undefined;
  for(let i=1;i<256;i++){
    const x=left+(right-left)*i/256,aa=expressionSliceAtX(a,x)!,bb=expressionSliceAtX(b,x)!;
    if(Math.min(aa[1],bb[1])>Math.max(aa[0],bb[0]))return true;
    const difference=(aa[0]+aa[1]-bb[0]-bb[1])/2;
    if(previous!==undefined && previous*difference<0)return true;previous=difference;
  }
  return false;
}

/** Positive-area query of the actual tapered ribbon. Cubic boundaries are
 * flattened densely; unlike enclosure overlap, this never treats the air
 * under a local phrase as painted ink. */
export function expressionIntersectsBox(q: ExpressionInk,b:{x0:number;x1:number;y0:number;y1:number}):boolean {
  if(q.x0>=b.x1||q.x1<=b.x0||q.y0>=b.y1||q.y1<=b.y0)return false;
  if(q.strokeSegments)return q.strokeSegments.some(s=>polygonIntersectsBox(strokeSegmentPolygon(s),b))||!!q.pedalStartInk?.polygons.some(p=>polygonIntersectsBox(p,b));
  // Parentheses retain their existing separate text frame. Otherwise the
  // opt-in dynamic queries its measured outlined contours, not empty air.
  if(q.dynamicFamilyInk&&!q.svg.includes('<text'))return q.dynamicFamilyInk.polygons.some(p=>polygonIntersectsBox(p,b));
  if(!q.contour)return true;
  return contourPolygonIntersectsBox(preparedContourPolygon(q.contour),b);
}
type Contour=NonNullable<ExpressionInk['contour']>;
type PreparedContourPolygon={scalars:Contour;points:number[];scratch:[number[],number[]];monotoneX:boolean};
// Contours are sometimes translated or deliberately mutated by audits. Key
// identity alone is insufficient: every scalar used by sampling is checked.
const contourPolygons=new WeakMap<Contour,PreparedContourPolygon>();
function sameContour(a:Contour,b:Contour):boolean {
  return a.xStart===b.xStart&&a.xEnd===b.xEnd&&a.yStart===b.yStart&&a.yEnd===b.yEnd&&a.side===b.side&&
    a.depth===b.depth&&a.thickness===b.thickness&&a.indent===b.indent&&a.startIndent===b.startIndent&&a.endIndent===b.endIndent&&
    a.startDepth===b.startDepth&&a.endDepth===b.endDepth&&a.chordAligned===b.chordAligned&&a.tipThickness===b.tipThickness;
}
function preparedContourPolygon(c:Contour):PreparedContourPolygon {
  const previous=contourPolygons.get(c);
  if(previous&&sameContour(previous.scalars,c))return previous;
  const points:number[]=[];
  const ax=c.xStart+(c.startIndent??c.indent),bx=c.xEnd-(c.endIndent??c.indent);
  const ay=c.chordAligned?c.yStart+(c.yEnd-c.yStart)*(ax-c.xStart)/(c.xEnd-c.xStart):c.yStart;
  const by=c.chordAligned?c.yStart+(c.yEnd-c.yStart)*(bx-c.xStart)/(c.xEnd-c.xStart):c.yEnd;
  const sample=(u:number,inner:boolean)=>{
    const v=1-u;
    const a=c.side*Math.max(0,(c.startDepth??c.depth)-(inner?c.thickness:0))/.75;
    const b=c.side*Math.max(0,(c.endDepth??c.depth)-(inner?c.thickness:0))/.75;
    const outer=v*v*v*c.yStart+3*v*v*u*(ay+c.side*(c.startDepth??c.depth)/.75)+3*v*u*u*(by+c.side*(c.endDepth??c.depth)/.75)+u*u*u*c.yEnd;
    const cy=inner&&c.tipThickness!==undefined?outer-c.side*(c.tipThickness+(c.thickness-c.tipThickness)*4*u*v):
      v*v*v*c.yStart+3*v*v*u*(ay+a)+3*v*u*u*(by+b)+u*u*u*c.yEnd;
    points.push(v*v*v*c.xStart+3*v*v*u*ax+3*v*u*u*bx+u*u*u*c.xEnd,cy);
  };
  for(let i=0;i<=128;i++)sample(i/128,false);
  for(let i=128;i>=0;i--)sample(i/128,true);
  let monotoneX=Number.isFinite(points[0]);
  for(let i=2;i<=256;i+=2)if(!Number.isFinite(points[i])||points[i]<points[i-2])monotoneX=false;
  const prepared:PreparedContourPolygon={scalars:{...c},points,scratch:previous?.scratch??[[],[]],monotoneX};
  contourPolygons.set(c,prepared);return prepared;
}
/** Joint outward translation that places the complete dense ribbon beyond
 * every box over its full x interval. Clipped linear-edge endpoints and all
 * intervening vertices are the exact extrema of the same 129 + 129 polygon
 * used by physical admission. This is not bisection of a union-of-boxes
 * collision predicate: a translation cannot clear one box by entering another.
 * Callers still perform the independent positive-area query after fitting. */
export interface ExpressionOutwardFit {
 xStart:number;xEnd:number;startIndent:number;endIndent:number;
 boxes:readonly {x0:number;x1:number;y0:number;y1:number}[];
 samples:{x0:number;x1:number;y0:number;y1:number;first:number;last:number;leftU:number;rightU:number}[];
}
/** Only x controls and box bounds enter this preparation. The returned plan
 * is local to one placement; the fit validates every dependency on reuse. */
export function prepareExpressionOutwardFit(c:Contour,boxes:ExpressionOutwardFit['boxes']):ExpressionOutwardFit {
 const points=preparedContourPolygon(c).points,x=(i:number)=>points[i*2];
 const floor=(value:number)=>{let lo=0,hi=128;while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(x(mid)<=value)lo=mid;else hi=mid-1;}return lo;};
 const samples=boxes.map(b=>{
  const left=Math.max(c.xStart,b.x0),right=Math.min(c.xEnd,b.x1),first=floor(left),last=floor(right);
  return {...b,first,last,leftU:first===128?0:(left-x(first))/(x(first+1)-x(first)),rightU:last===128?0:(right-x(last))/(x(last+1)-x(last))};
 });
 return {xStart:c.xStart,xEnd:c.xEnd,startIndent:c.startIndent??c.indent,endIndent:c.endIndent??c.indent,boxes,samples};
}
export function expressionContourOutwardShift(c:Contour,boxes:ExpressionOutwardFit['boxes'],prepared?:ExpressionOutwardFit):number {
 let fit=prepared;
 if(!fit||fit.xStart!==c.xStart||fit.xEnd!==c.xEnd||fit.startIndent!==(c.startIndent??c.indent)||fit.endIndent!==(c.endIndent??c.indent)||fit.boxes!==boxes||fit.samples.length!==boxes.length||
  fit.samples.some((s,i)=>s.x0!==boxes[i].x0||s.x1!==boxes[i].x1||s.y0!==boxes[i].y0||s.y1!==boxes[i].y1))fit=prepareExpressionOutwardFit(c,boxes);
 const points=preparedContourPolygon(c).points;
 let shift=0;
 for(const s of fit.samples){
  if(Math.min(c.xEnd,s.x1)<=Math.max(c.xStart,s.x0))continue;
  let near=c.side===-1?-Infinity:Infinity;
  for(let edge=0;edge<2;edge++){
   const first=edge?257-s.first:s.first,last=edge?257-s.last:s.last,step=edge?-1:1;
   const left=points[first*2+1]+(s.first===128?0:s.leftU*(points[(first+step)*2+1]-points[first*2+1]));
   const right=points[last*2+1]+(s.last===128?0:s.rightU*(points[(last+step)*2+1]-points[last*2+1]));
   near=c.side===-1?Math.max(near,left,right):Math.min(near,left,right);
   for(let i=s.first+1;i<=s.last;i++){const y=points[(edge?257-i:i)*2+1];near=c.side===-1?Math.max(near,y):Math.min(near,y);}
  }
  shift=Math.max(shift,c.side===-1?near-s.y0:s.y1-near);
 }
 return shift;
}
/** Locate the one inside/outside transition on a monotone ribbon boundary.
 * Equality belongs to the inside, exactly as in the original clipping loop. */
function contourXTransition(input:number[],start:number,end:number,bound:number,upper:boolean,left:boolean):number {
  let lo=start,hi=end;
  while(lo<hi){const mid=(lo+hi)>>>1,x=input[mid*2];
    if(upper?(left?x<bound:x<=bound):(left?x>=bound:x>bound))lo=mid+1;else hi=mid;
  }
  return lo;
}
/** Same ordered vertices, interpolation arithmetic, four Sutherland–Hodgman
 * clips and positive-area threshold as the reference query. The two sampled
 * x-monotone boundaries let the x clips omit outside/outside edges. The first
 * clip also retains just one original vertex beyond each later right crossing;
 * all omitted vertices are strictly outside that second clip, so its ordered
 * crossings still interpolate the identical original adjacent endpoints.
 * Non-monotone/non-finite x samples retain the complete original scan. Scratch
 * buffers belong to this exact scalar-validated contour, never a page cache. */
function contourPolygonIntersectsBox(prepared:PreparedContourPolygon,b:{x0:number;x1:number;y0:number;y1:number}):boolean {
  let input=prepared.points,inputLength=input.length,split=129;
  for(let pass=0;pass<4;pass++){
    if(inputLength===0)return false;
    // Keep capacity: assigning length=0 makes V8 discard the backing store.
    // Only this query's occupied prefix participates in the next clip.
    const output=prepared.scratch[pass%2];let outputLength=0;
    const axis=pass<2?0:1,bound=pass===0?b.x0:pass===1?b.x1:pass===2?b.y0:b.y1,sign=pass%2===0?1:-1;
    const window=prepared.monotoneX&&pass<2,left=pass===0;
    const upper=window?contourXTransition(input,0,split,bound,true,left):0;
    const lower=window?contourXTransition(input,split,inputLength/2,bound,false,left):0;
    const limit=window&&left&&b.x0<=b.x1;
    const upperLast=limit?Math.min(split,contourXTransition(input,0,split,b.x1,true,false)+1):split;
    const lowerFirst=limit?Math.max(split,contourXTransition(input,split,inputLength/2,b.x1,false,false)-1):split;
    let nextSplit=0;
    for(let run=0;run<(window?2:1);run++){
      const first=!window?0:run===0?(left?Math.max(0,upper-1):0):(left?lowerFirst:Math.max(split,lower-1));
      const last=!window?inputLength/2:run===0?(left?upperLast:Math.min(split,upper+1)):(left?Math.min(inputLength/2,lower+1):inputLength/2);
      for(let i=first*2;i<last*2;i+=2){
        const j=i+2===inputLength?0:i+2,da=sign*(input[i+axis]-bound),dz=sign*(input[j+axis]-bound);
        if(da>=0){output[outputLength++]=input[i];output[outputLength++]=input[i+1];}
        if((da<0&&dz>0)||(da>0&&dz<0)){const u=da/(da-dz);output[outputLength++]=input[i]+u*(input[j]-input[i]);output[outputLength++]=input[i+1]+u*(input[j+1]-input[i+1]);}
      }
      if(run===0)nextSplit=outputLength/2;
    }
    input=output;inputLength=outputLength;split=nextSplit;
  }
  let area=0;for(let i=0;i<inputLength;i+=2){const j=(i+2)%inputLength;area+=(input[i]-b.x0)*(input[j+1]-b.y0)-(input[j]-b.x0)*(input[i+1]-b.y0);}
  return Math.abs(area)>1e-9;
}
function strokeSegmentPolygon(s:NonNullable<ExpressionInk['strokeSegments']>[number]):number[][]{
 const length=Math.hypot(s.x1-s.x0,s.y1-s.y0)||1,dx=-(s.y1-s.y0)*s.width/(2*length),dy=(s.x1-s.x0)*s.width/(2*length);
 return [[s.x0+dx,s.y0+dy],[s.x1+dx,s.y1+dy],[s.x1-dx,s.y1-dy],[s.x0-dx,s.y0-dy]];
}
export function expressionStrokeBounds(s:NonNullable<ExpressionInk['strokeSegments']>[number]){
 const points=strokeSegmentPolygon(s);return {x0:Math.min(...points.map(p=>p[0])),x1:Math.max(...points.map(p=>p[0])),y0:Math.min(...points.map(p=>p[1])),y1:Math.max(...points.map(p=>p[1]))};
}
function polygonIntersectsBox(points:number[][],b:{x0:number;x1:number;y0:number;y1:number}):boolean{
  let poly=points;
  const clip=(axis:number,bound:number,sign:number)=>{
    const input=poly;poly=[];
    for(let i=0;i<input.length;i++){
      const a=input[i],z=input[(i+1)%input.length],da=sign*(a[axis]-bound),dz=sign*(z[axis]-bound);
      if(da>=0)poly.push(a);
      if((da<0&&dz>0)||(da>0&&dz<0)){const u=da/(da-dz);poly.push([a[0]+u*(z[0]-a[0]),a[1]+u*(z[1]-a[1])]);}
    }
  };
  clip(0,b.x0,1);clip(0,b.x1,-1);clip(1,b.y0,1);clip(1,b.y1,-1);
  let area=0;for(let i=0;i<poly.length;i++){const a=poly[i],z=poly[(i+1)%poly.length];area+=(a[0]-b.x0)*(z[1]-b.y0)-(z[0]-b.x0)*(a[1]-b.y0);}
  return Math.abs(area)>1e-9;
}

export const expressionsSvg = (ink: readonly ExpressionInk[]) => ink.length ? `<g class="janko-expressions">${ink.map(i=>i.svg).join('')}</g>` : '';
