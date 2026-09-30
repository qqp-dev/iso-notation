import { normalizePedalEvents } from '../../../model/expressions';
/** Source-timed expression ink in Janko coordinates. No sounding durations are altered. */
import type { QuantizedGridScore } from '../../../model/types';
import { DYNAMIC_PATHS } from './dynamic-paths';

export interface ExpressionInk {
  kind: 'dynamic' | 'hairpin' | 'pedal' | 'phrase';
  id: string;
  x0: number; x1: number; y0: number; y1: number;
  startTick: number; endTick: number;
  continuationStart: boolean; continuationEnd: boolean;
  endpointIds?: [string[], string[]];
  svg: string;
}
interface Placement {
  start: number; end: number; left: number; right: number;
  top: number; bottom: number;
  x: (tick: number) => number;
  endpointX: (ids: string[], tick: number) => number;
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
  // Source phrases inhabit quiet upper air, above ALL actual music ink.
  // Separate intersecting spans occupy separate lanes; endpoints keep their
  // exact solved note columns (including cross-hand and alternative routes).
  const phraseLanes: { x0: number; x1: number; lane: number }[] = [];
  for (const phrase of score.phrases ?? []) {
    if (phrase.endTick < p.start || phrase.startTick >= p.end) continue;
    const cs = phrase.startTick < p.start, ce = phrase.endTick >= p.end;
    const x0 = cs ? p.left : p.endpointX(phrase.fromNoteIds, phrase.startTick);
    const x1 = ce ? p.right : p.endpointX(phrase.toNoteIds, phrase.endTick);
    if (x1 <= x0) throw Error(`Nonpositive phrase span ${phrase.id}`);
    let lane = 0;
    while (phraseLanes.some(q => q.lane === lane && q.x0 < x1 + 2 && q.x1 > x0 - 2)) lane++;
    phraseLanes.push({x0,x1,lane});
    const y = p.top - 6 - lane * 9, rise = 5, dx = (x1-x0)/3;
    // Two cubics form a slender tapered ribbon, 0 at the tips, 0.65pt at crown.
    const d = `M${f(x0)} ${f(y)} C${f(x0+dx)} ${f(y-rise)} ${f(x1-dx)} ${f(y-rise)} ${f(x1)} ${f(y)} C${f(x1-dx)} ${f(y-rise-.85)} ${f(x0+dx)} ${f(y-rise-.85)} ${f(x0)} ${f(y)}Z`;
    add({kind:'phrase', id:phrase.id, x0,x1,y0:y-rise-.85,y1:y+.01,startTick:phrase.startTick,endTick:phrase.endTick,
      continuationStart:cs,continuationEnd:ce,endpointIds:[phrase.fromNoteIds,phrase.toNoteIds],
      svg:`<path class="janko-phrase" data-phrase="${esc(phrase.id)}" d="${d}" fill="#111111"/>`});
  }
  const dynamicLanes: { x0: number; x1: number; lane: number }[] = [];
  for (const [index,e] of (score.dynamics ?? []).entries()) {
    const hairpin = e.kind === 'hairpin' || (!e.kind && ['crescendo','decrescendo'].includes(e.mark) && !!e.durationTicks);
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
      const [loX,loY,hiX,hiY] = glyph.bounds, scale=.018, pad=e.parenthesized?4:0;
      const width=(hiX-loX)*scale+2*pad; height=Math.max((hiY-loY)*scale,e.parenthesized?10:0);
      x0=Math.max(p.left,Math.min(x0-width/2,p.right-width)); x1=x0+width;
      svg = y => `<g class="janko-dynamic" aria-label="${esc(e.parenthesized ? `(${e.mark})` : e.mark)}">`+
        `<path d="${glyph.path}" transform="translate(${f(x0+pad-loX*scale)} ${f(y+hiY*scale)}) scale(${scale} ${-scale})" fill="#111111"/>`+
        (e.parenthesized ? `<text x="${f(x0)}" y="${f(y+height*.85)}" font-family="serif" font-size="10">(</text><text x="${f(x1-4)}" y="${f(y+height*.85)}" font-family="serif" font-size="10">)</text>` : '')+'</g>';
    }
    let lane=0; while(dynamicLanes.some(q => q.lane===lane && q.x0<x1+3 && q.x1>x0-3)) lane++;
    dynamicLanes.push({x0,x1,lane}); const y=p.bottom+8+lane*14;
    add({kind:hairpin?'hairpin':'dynamic',id:`dynamic-${index}`,x0:x0-.35,x1:x1+.35,y0:y-.35,y1:y+height+.35,
      startTick:e.tick,endTick:end,continuationStart:cs,continuationEnd:ce,svg:svg(y)});
  }
  const dynamicBottom=Math.max(p.bottom,...out.filter(q => q.kind==='dynamic'||q.kind==='hairpin').map(q=>q.y1));
  const pedalY=dynamicBottom+12;
  for (const [i,interval] of pedalIntervals(score).entries()) {
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
export const expressionsSvg = (ink: readonly ExpressionInk[]) => ink.length ? `<g class="janko-expressions">${ink.map(i=>i.svg).join('')}</g>` : '';
