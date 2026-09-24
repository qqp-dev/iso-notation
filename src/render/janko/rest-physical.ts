/* Certified, rest-local pre-head-knockout paint queries. This deliberately does
 * not extend global InkScene coverage: unsupported cuts refuse the WHOLE rest.
 * Sunset: extend the bounded cubic hull to positive winding/box/curve overlap,
 * then certify strokes/polygons, rounded/dashed outlines, ellipses and ordered
 * erasures before promoting rest-family global scene coverage. Clear-only cubic
 * decisions do not grant global free space or prove painted occupancy.
 */
import { f } from './elements/style';
import type { PlacedRestPaint } from './elements/rests';

export type RestPhysicalResult =
  | { kind: 'ink'; pieceId: string; witness: { distance: number } }
  | { kind: 'clear'; certificate: { distance: number; pieceIds: readonly string[] } }
  | { kind: 'unknown'; pieceId: string; shape: string; reason: string };
type Rect = { x0: number; y0: number; x1: number; y1: number; id: string };
type Point = { x: number; y: number };
type Cubic = { id: string; hull: readonly Point[] };
export type PreparedRestPaint =
  | { kind: 'rects'; rects: Rect[] }
  | { kind: 'cubic'; cubic: Cubic }
  | { kind: 'unknown'; result: RestPhysicalResult };
type RestSource = readonly PlacedRestPaint[] | PreparedRestPaint;
export type RestBox = { x0: number; y0: number; x1: number; y1: number };
// Rounded output lives on a 0.01pt lattice. Refuse undecidable contacts instead
// of declaring free paper at a floating-point boundary.
const uncertain = 1e-8;
const emitted = (n: number): number => Number(f(n));
const unknown = (id: string, shape: string, reason: string): RestPhysicalResult =>
  ({ kind: 'unknown', pieceId: id, shape, reason });

function certified(records: readonly PlacedRestPaint[]): Rect[] | RestPhysicalResult {
  if (!records.length) return unknown('rest', 'empty', 'no stored paint');
  const first = records[0];
  const rects: Rect[] = [];
  for (const p of records) {
    const item = p.primitive;
    if (p.system !== first.system || p.order !== first.order || p.tick !== first.tick || p.hand !== first.hand)
      return unknown(p.id, item.kind, 'mixed rest owners');
    if (item.kind !== 'rect') return unknown(p.id, item.kind, 'shape not certified');
    const expectedClass = p.style === 'classical-urtext' ? 'janko-rest-block'
      : p.style === 'kinetic-monoline'
        ? p.value === 'whole' ? 'janko-rest-slab janko-rest-slab-whole' : 'janko-rest-slab'
        : undefined;
    if (!['half','whole'].includes(p.value) || !expectedClass || item.cls !== expectedClass ||
        item.attrs || item.rx !== undefined || item.dash || item.stroke !== null ||
        !['#111111', '#1A1A1A'].includes(item.fill ?? '') ||
        ![item.x,item.y,item.w,item.h].every(Number.isFinite))
      return unknown(p.id, item.kind, 'unsupported rectangle paint, erasure or attributes');
    // SVG numeric grammar and the finite emitted edges must both survive the
    // projection; toFixed uses exponent notation beyond 1e21.
    if (![item.x,item.y,item.w,item.h].every(n => /^-?\d+\.\d{2}$/.test(f(n))))
      return unknown(p.id, item.kind, 'unsupported emitted coordinates');
    const x = emitted(item.x), y = emitted(item.y), w = emitted(item.w), h = emitted(item.h);
    if (w <= 0 || h <= 0 || !Number.isFinite(x+w) || !Number.isFinite(y+h))
      return unknown(p.id, item.kind, 'nonpositive or nonfinite emitted rectangle');
    rects.push({ id: p.id, x0: x, y0: y, x1: x+w, y1: y+h });
  }
  return rects;
}

// Cubic Bézier segments and their closing edges lie in the convex hull of
// their SVG-effective M/C control and end points. This is ONLY an outer bound:
// a hull hit says nothing about winding or actual ink. The serializer uses f()
// for every coordinate; integers below are exactly the emitted 0.01pt lattice.
// Refuse coordinates outside ±10000pt: orientation products stay < 8e12,
// below Number.MAX_SAFE_INTEGER, even with subtraction of two products.
const MAX_PT = 10000;
const ERROR_PT = 0.0001; // > floating distance error over this bounded range
const HEAD_CENTER_AIR = 0.008; // emitted head centre may differ by √2 * 0.005pt
const HEAD_RADIUS_AIR = 0.008; // SVG radius ≤0.005pt; halo radius + half-stroke ≤0.0075pt
function svgPoint(p: Point): Point | undefined {
  if (!p || ![p.x,p.y].every(n => Number.isFinite(n) && Math.abs(n) <= MAX_PT && /^-?\d+\.\d{2}$/.test(f(n)))) return;
  return { x: Math.round(Number(f(p.x)) * 100), y: Math.round(Number(f(p.y)) * 100) };
}
const cross = (a: Point, b: Point, c: Point) => (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
function hull(points: Point[]): Point[] {
  const sorted = points.sort((a,b) => a.x-b.x || a.y-b.y);
  const half = (items: Point[]): Point[] => {
    const out: Point[] = [];
    for (const p of items) {
      while (out.length >= 2 && cross(out[out.length-2],out[out.length-1],p) <= 0) out.pop();
      out.push(p);
    }
    return out;
  };
  return [...half(sorted).slice(0,-1),...half([...sorted].reverse()).slice(0,-1)];
}
/** Call once per placed rest; no hidden geometry authority or stale global cache. */
export function prepareRestPaint(records: readonly PlacedRestPaint[]): PreparedRestPaint {
  const p = records[0], item = p?.primitive;
  if (records.length === 1 && item?.kind === 'path') {
    if (p.layer !== 'rest' || p.groupClass !== 'janko-rest-group' ||
        !['RH','LH'].includes(p.hand) || !Number.isFinite(p.tick) ||
        p.style !== 'classical-urtext' || !['eighth','quarter','sixteenth'].includes(p.value) ||
        item.cls !== 'janko-rest-verbatim' || item.attrs !== ` data-verbatim-rest="${p.value}"` ||
        item.fill !== '#1A1A1A' || item.stroke !== null || item.close !== true ||
        !Array.isArray(item.segments) || !item.segments.length ||
        item.segments.some(seg => !Array.isArray(seg) || seg.length !== 3) ||
        Object.keys(item).some(key => !['kind','cls','attrs','fill','stroke','close','start','segments'].includes(key)))
      return { kind: 'unknown', result: unknown(p.id,'path','unsupported cubic paint or attributes') };
    const points = [item.start,...item.segments.flatMap(seg=>seg)];
    const projected = points.map(svgPoint);
    if (projected.some(q=>!q))
      return { kind: 'unknown', result: unknown(p.id,'path','invalid emitted cubic coordinates') };
    const shape = hull(projected as Point[]);
    if (shape.length < 3 || shape.some(q=>Math.abs(q.x)>MAX_PT*100 || Math.abs(q.y)>MAX_PT*100))
      return { kind: 'unknown', result: unknown(p.id,'path','degenerate or unsafe cubic hull') };
    return { kind: 'cubic', cubic: { id: p.id, hull: shape } };
  }
  const rects = certified(records);
  return Array.isArray(rects) ? { kind: 'rects', rects } : { kind: 'unknown', result: rects };
}
const prepared = (source: RestSource): PreparedRestPaint => Array.isArray(source)
  ? prepareRestPaint(source as readonly PlacedRestPaint[]) : source as PreparedRestPaint;
const sourceId = (source: RestSource): string => Array.isArray(source)
  ? (source as readonly PlacedRestPaint[])[0]?.id ?? 'rest' : 'rest';
function validBox(b: RestBox): boolean {
  return [b.x0,b.y0,b.x1,b.y1].every(Number.isFinite) && b.x0 < b.x1 && b.y0 < b.y1;
}
function segmentDistance(p: Point, a: Point, b: Point): number {
  const dx=b.x-a.x, dy=b.y-a.y;
  const u=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));
  return Math.hypot(p.x-a.x-u*dx,p.y-a.y-u*dy);
}
function inside(p: Point, h: readonly Point[]): boolean {
  return h.every((v,i)=>cross(v,h[(i+1)%h.length],p)>=0);
}
function pointDistance(p: Point, h: readonly Point[]): number {
  return inside(p,h) ? 0 : Math.min(...h.map((v,i)=>segmentDistance(p,v,h[(i+1)%h.length])));
}
function boxDistance(b: RestBox, h: readonly Point[]): number {
  const corners: Point[]=[{x:b.x0,y:b.y0},{x:b.x1,y:b.y0},{x:b.x1,y:b.y1},{x:b.x0,y:b.y1}];
  // Convex polygon SAT: no strict separating axis means overlap or touch.
  const separated = [...h,...corners].some((v,i,all)=>{
    const w = i<h.length ? h[(i+1)%h.length] : corners[(i-h.length+1)%4];
    const nx=w.y-v.y, ny=v.x-w.x;
    const hs=h.map(p=>p.x*nx+p.y*ny), bs=corners.map(p=>p.x*nx+p.y*ny);
    return Math.max(...hs)<Math.min(...bs) || Math.max(...bs)<Math.min(...hs);
  });
  if (!separated) return 0;
  return Math.min(
    ...corners.map(p=>pointDistance(p,h)),
    ...h.map(p=>Math.hypot(Math.max(b.x0-p.x,0,p.x-b.x1),Math.max(b.y0-p.y,0,p.y-b.y1)))
  );
}
function cubicResult(shape: Cubic, distance: number, threshold: number): RestPhysicalResult {
  // Converted distances are conservative lower bounds. No hull hit is ink.
  const lower = distance/100 - ERROR_PT;
  return Number.isFinite(lower) && lower > threshold + ERROR_PT
    ? { kind: 'clear', certificate: { distance: lower, pieceIds: [shape.id] } }
    : unknown(shape.id,'cubic','hull intersects or clearance unresolved');
}
function classified(rects: Rect[], distance: (r: Rect) => number,
  shape: string, contact: boolean): RestPhysicalResult {
  let closest = Infinity, pieceId = rects[0].id;
  for (const r of rects) {
    const d = distance(r);
    if (!Number.isFinite(d)) return unknown(r.id, shape, 'unresolved distance');
    if (d < closest) { closest = d; pieceId = r.id; }
  }
  if (Math.abs(closest) <= uncertain && contact) return unknown(pieceId, shape, 'boundary contact');
  return closest < 0
    ? { kind: 'ink', pieceId, witness: { distance: 0 } }
    : { kind: 'clear', certificate: { distance: closest, pieceIds: rects.map(r => r.id) } };
}
/** Closed finite point. An exact/near rectangle boundary is undecidable. */
export function restInkAt(source: RestSource, x: number, y: number): RestPhysicalResult {
  if (![x,y].every(Number.isFinite)) return unknown(sourceId(source),'point','invalid point');
  const state=prepared(source);
  if (state.kind==='unknown') return state.result;
  if (state.kind==='cubic') {
    if (Math.abs(x)>MAX_PT || Math.abs(y)>MAX_PT) return unknown(state.cubic.id,'point','outside safe range');
    return cubicResult(state.cubic,pointDistance({x:x*100,y:y*100},state.cubic.hull),0);
  }
  return classified(state.rects, r => {
    const dx = Math.max(r.x0-x, 0, x-r.x1), dy = Math.max(r.y0-y, 0, y-r.y1);
    return dx || dy ? Math.hypot(dx,dy) : -Math.min(x-r.x0,r.x1-x,y-r.y0,r.y1-y);
  }, 'point', true);
}
/** Closed positive-area finite box. Edge-only grazing is unknown, never clear. */
export function restInkInBox(source: RestSource, b: RestBox): RestPhysicalResult {
  if (!validBox(b)) return unknown(sourceId(source),'box','invalid or zero-area box');
  const state=prepared(source);
  if (state.kind==='unknown') return state.result;
  if (state.kind==='cubic') {
    if ([b.x0,b.y0,b.x1,b.y1].some(n=>Math.abs(n)>MAX_PT)) return unknown(state.cubic.id,'box','outside safe range');
    return cubicResult(state.cubic,boxDistance({x0:b.x0*100,y0:b.y0*100,x1:b.x1*100,y1:b.y1*100},state.cubic.hull),0);
  }
  return classified(state.rects, r => {
    const dx = Math.max(r.x0-b.x1, b.x0-r.x1, 0), dy = Math.max(r.y0-b.y1, b.y0-r.y1, 0);
    return dx || dy ? Math.hypot(dx,dy) : -Math.min(r.x1-b.x0,b.x1-r.x0,r.y1-b.y0,b.y1-r.y0);
  }, 'box', true);
}
/** Pre-head-knockout disc: rectangle ink has positive/negative decisions;
 * cubic hull can certify only disjointness with specified readability air.
 * A hull contact cannot witness painted ink. Tangency refuses. */
export function restDiscClearance(source: RestSource, x: number, y: number, radius: number, air = 0): RestPhysicalResult {
  if (![x,y,radius,air].every(Number.isFinite) || radius <= 0 || air < 0)
    return unknown(sourceId(source),'disc','invalid disc');
  const state=prepared(source);
  if (state.kind==='unknown') return state.result;
  if (state.kind==='cubic') {
    if (Math.max(Math.abs(x),Math.abs(y),radius,air)>MAX_PT)
      return unknown(state.cubic.id,'disc','outside safe range');
    // Rest coordinates are SVG-effective; the head is painted at rounded SVG
    // coordinates. Bound centre displacement and emitted disc/halo radius.
    return cubicResult(state.cubic,pointDistance({x:x*100,y:y*100},state.cubic.hull),radius+air+HEAD_CENTER_AIR+HEAD_RADIUS_AIR);
  }
  const rects = state.rects;
  let best = Infinity, pieceId = rects[0].id;
  for (const r of rects) {
    const d = Math.hypot(Math.max(r.x0-x,0,x-r.x1),Math.max(r.y0-y,0,y-r.y1));
    if (d < best) { best = d; pieceId = r.id; }
  }
  if (!Number.isFinite(best) || Math.abs(best-radius) <= uncertain)
    return unknown(pieceId,'disc','unresolved tangency');
  return best < radius
    ? { kind: 'ink', pieceId, witness: { distance: best } }
    : { kind: 'clear', certificate: { distance: best, pieceIds: rects.map(r=>r.id) } };
}
