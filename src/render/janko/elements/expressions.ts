import { normalizePedalEvents } from '../../../model/expressions';
/** Source-timed expression ink in Janko coordinates. No sounding durations are altered. */
import type { QuantizedGridScore } from '../../../model/types';
import { DYNAMIC_PATHS } from './dynamic-paths';
import { taperedSpanPath } from '../ties';

export interface ExpressionInk {
  kind: 'dynamic' | 'hairpin' | 'pedal' | 'phrase';
  id: string;
  x0: number; x1: number; y0: number; y1: number;
  startTick: number; endTick: number;
  continuationStart: boolean; continuationEnd: boolean;
  endpointIds?: [string[], string[]];
  svg: string;
  /** Filled contour, not its (mostly empty) bounding rectangle. */
  contour?: {xStart:number;xEnd:number;yStart:number;yEnd:number;side:-1|1;depth:number;thickness:number;indent:number};
  gridKnockout?: boolean;
}
interface Placement {
  /** Display-field membership only; original source arrays remain untouched. */
  include?: (kind:ExpressionInk['kind'],id:string)=>boolean;
  start: number; end: number; left: number; right: number;
  top: number; bottom: number;
  x: (tick: number) => number;
  endpointX: (ids: string[], tick: number) => number;
  endpointEnvelope?: (ids: string[], tick: number) => {top:number;bottom:number;hand:'RH'|'LH'} | undefined;
  obstacles?: readonly {x0:number;x1:number;y0:number;y1:number}[];
  clarity?: boolean;
  dynamicScale?: number;
  contourThickness?: number;
}
const f = (n: number) => n.toFixed(3);
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&apos;' }[c]!));
const line = (d: string, cls: string) => `<path class="janko-${cls}" d="${d}" fill="none" stroke="#111111" stroke-width="0.65"/>`;

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

export function placeExpressions(score: QuantizedGridScore, p: Placement): ExpressionInk[] {
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
    const air = p.clarity ? Math.min(3.6,(endX-startX)/8) : 0;
    const x0=startX+(cs?0:air), x1=endX-(ce?0:air);
    if (x1 <= x0) throw Error(`Nonpositive phrase span ${phrase.id}`);
    let lane = 0;
    while (phraseLanes.some(q => q.lane === lane && q.x0 < x1 + 2 && q.x1 > x0 - 2)) lane++;
    phraseLanes.push({x0,x1,lane});
    const a = p.endpointEnvelope?.(phrase.fromNoteIds,phrase.startTick);
    const b = p.endpointEnvelope?.(phrase.toNoteIds,phrase.endTick);
    let y0 = p.top-6-lane*9, y1=y0, side: -1|1=-1, depth=5;
    const thickness = p.contourThickness ?? .45;
    if (p.clarity && (a || b)) {
      const preferred = (a ?? b)!.hand === 'LH' ? 1 : -1;
      let best = Infinity;
      // Evaluate BOTH local sides against painted ink. The endpoints stay at
      // their associated envelopes; collision avoidance earns depth, never a
      // detached whole-system endpoint axis copied from source staff layout.
      for (const s of [preferred,-preferred] as (-1|1)[]) for (const lift of [0,2,4,6,8,12,16,24]) {
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
          for (let i=0;i<=128;i++) {
            const u=i/128,v=1-u;
            const cx=x0+(x1-x0)*(3*v*v*u*.21+3*v*u*u*.79+u*u*u);
            const cy=ay*v*v*v+3*v*v*u*(ay+s*d/.75)+3*v*u*u*(by+s*d/.75)+by*u*u*u;
            if ((p.obstacles ?? []).some(q=>cx>q.x0-1.2 && cx<q.x1+1.2 && cy>q.y0-1.2 && cy<q.y1+1.2) ||
                out.filter(q=>q.kind==='phrase').some(q=>{const slice=expressionSliceAtX(q,cx);return slice && cy>slice[0]-1.2 && cy<slice[1]+1.2;})) hits++;
          }
          const cost=hits*1000+d+lift*2+(s===preferred?0:2);
          if(cost<best){best=cost;y0=ay;y1=by;side=s;depth=d;}
          if(hits===0) break;
        }
      }
    }
    const dx=(x1-x0)/3;
    const d = p.clarity ? taperedSpanPath(x0,y0,x1,y1,side,depth,thickness,(x1-x0)*.21) :
      `M${f(x0)} ${f(y0)} C${f(x0+dx)} ${f(y0-5)} ${f(x1-dx)} ${f(y1-5)} ${f(x1)} ${f(y1)} C${f(x1-dx)} ${f(y1-5-.85)} ${f(x0+dx)} ${f(y0-5-.85)} ${f(x0)} ${f(y0)}Z`;
    const controlLo=Math.min(y0,y1)+Math.min(0,side*depth/.75);
    const controlHi=Math.max(y0,y1)+Math.max(0,side*depth/.75);
    add({kind:'phrase', id:phrase.id, x0:x0-(p.clarity ? .6 : 0),x1:x1+(p.clarity ? .6 : 0),y0:controlLo-.6,y1:controlHi+.6,
      contour:{xStart:x0,xEnd:x1,yStart:y0,yEnd:y1,side,depth,thickness,indent:(x1-x0)*.21},startTick:phrase.startTick,endTick:phrase.endTick,
      continuationStart:cs,continuationEnd:ce,endpointIds:[phrase.fromNoteIds,phrase.toNoteIds],gridKnockout:!!p.clarity,
      svg:(p.clarity?`<path class="janko-phrase-grid-knockout" d="${d}" fill="white" stroke="white" stroke-width="1.2" stroke-linejoin="round"/>`:'')+
        `<path class="janko-phrase" data-phrase="${esc(phrase.id)}" d="${d}" fill="#111111"/>`});
  }
  const dynamicLanes: { x0: number; x1: number; lane: number }[] = [];
  for (const [index,e] of (score.dynamics ?? []).entries()) {
    const hairpin = e.kind === 'hairpin' || (!e.kind && ['crescendo','decrescendo'].includes(e.mark) && !!e.durationTicks);
    if(p.include&&!p.include(hairpin?'hairpin':'dynamic',`dynamic-${index}`))continue;
    const end = hairpin ? e.tick + (e.durationTicks ?? 0) : e.tick;
    if (hairpin ? end <= p.start || e.tick >= p.end : e.tick < p.start || e.tick >= p.end) continue;
    const cs = e.tick < p.start, ce = end > p.end;
    let x0 = hairpin ? x(Math.max(p.start,e.tick)) : p.x(e.tick);
    let x1: number, svg: (y: number) => string, height: number;
    if (hairpin) {
      if (end <= e.tick) throw Error('Nonpositive source hairpin');
      x1 = x(Math.min(p.end,end)); height = 6;
      const aperture = (tick: number) => 2.5 * (e.mark === 'crescendo' ? (tick-e.tick)/(end-e.tick) : (end-tick)/(end-e.tick));
      const a = aperture(Math.max(p.start,e.tick)), b = aperture(Math.min(p.end,end));
      svg = y => line(`M${f(x0)} ${f(y+3-a)}L${f(x1)} ${f(y+3-b)}M${f(x0)} ${f(y+3+a)}L${f(x1)} ${f(y+3+b)}`, 'hairpin');
    } else if (e.kind === 'text-cresc' || e.text) {
      const text = e.text ?? (e.mark === 'decrescendo' ? 'diminuendo' : 'cresc.');
      const width = text.length * 4.4; height = 10;
      x0 = Math.max(p.left,Math.min(x0,p.right-width)); x1=x0+width;
      svg = y => `<text class="janko-expression-text" x="${f(x0)}" y="${f(y+8)}" font-family="Century Schoolbook,serif" font-size="8.5" font-style="italic">${esc(text)}</text>`;
    } else {
      const glyph = DYNAMIC_PATHS[e.mark]; if (!glyph) throw Error(`Unsupported dynamic glyph ${e.mark}`);
      const [loX,loY,hiX,hiY] = glyph.bounds, scale=p.dynamicScale ?? .016, pad=e.parenthesized?4:0;
      const width=(hiX-loX)*scale+2*pad; height=Math.max((hiY-loY)*scale,e.parenthesized?10:0);
      x0=Math.max(p.left,Math.min(x0-width/2,p.right-width)); x1=x0+width;
      svg = y => `<g class="janko-dynamic" aria-label="${esc(e.parenthesized ? `(${e.mark})` : e.mark)}">`+
        `<path d="${glyph.path}" transform="translate(${f(x0+pad-loX*scale)} ${f(y+hiY*scale)}) scale(${scale} ${-scale})" fill="#111111"/>`+
        (e.parenthesized ? `<text x="${f(x0)}" y="${f(y+height*.85)}" font-family="serif" font-size="10">(</text><text x="${f(x1-4)}" y="${f(y+height*.85)}" font-family="serif" font-size="10">)</text>` : '')+'</g>';
    }
    let lane=0; while(dynamicLanes.some(q => q.lane===lane && q.x0<x1+3 && q.x1>x0-3)) lane++;
    dynamicLanes.push({x0,x1,lane}); const y=Math.max(p.bottom,...out.filter(q=>q.kind==='phrase').map(q=>q.y1))+8+lane*14;
    add({kind:hairpin?'hairpin':'dynamic',id:`dynamic-${index}`,x0:x0-.35,x1:x1+.35,y0:y-.35,y1:y+height+.35,
      startTick:e.tick,endTick:end,continuationStart:cs,continuationEnd:ce,svg:svg(y)});
  }
  const dynamicBottom=Math.max(p.bottom,...out.map(q=>q.y1));
  const pedalY=dynamicBottom+12;
  for (const [i,interval] of pedalIntervals(score).entries()) {
    if(p.include&&!p.include('pedal',`pedal-${i}`))continue;
    if(interval.end<=p.start || interval.start>=p.end) continue;
    const cs=interval.start<p.start, ce=interval.end>p.end || !interval.release;
    const x0=x(interval.start),x1=x(interval.end),y=pedalY;
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
  if(!q.contour || x<=q.contour.xStart || x>=q.contour.xEnd)return undefined;
  const c=q.contour,x0=c.xStart,x1=c.xEnd,ax=x0+c.indent,bx=x1-c.indent;
  let lo=0,hi=1;
  for(let i=0;i<32;i++){const u=(lo+hi)/2,v=1-u;
    const cx=v*v*v*x0+3*v*v*u*ax+3*v*u*u*bx+u*u*u*x1;if(cx<x)lo=u;else hi=u;}
  const u=(lo+hi)/2,v=1-u,axis=c.yStart*(v*v*v+3*v*v*u)+c.yEnd*(3*v*u*u+u*u*u);
  const bulge=3*v*u/.75,outer=axis+c.side*c.depth*bulge,inner=axis+c.side*Math.max(0,c.depth-c.thickness)*bulge;
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
  if(!q.contour)return true;
  const c=q.contour, points:number[][]=[];
  const sample=(u:number,offset:number)=>{
    const v=1-u,ax=c.xStart+c.indent,bx=c.xEnd-c.indent;
    return [v*v*v*c.xStart+3*v*v*u*ax+3*v*u*u*bx+u*u*u*c.xEnd,
      v*v*v*c.yStart+3*v*v*u*(c.yStart+offset)+3*v*u*u*(c.yEnd+offset)+u*u*u*c.yEnd];
  };
  for(let i=0;i<=128;i++)points.push(sample(i/128,c.side*c.depth/.75));
  for(let i=128;i>=0;i--)points.push(sample(i/128,c.side*Math.max(0,c.depth-c.thickness)/.75));
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
