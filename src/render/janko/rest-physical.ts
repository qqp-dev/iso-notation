/* Certified, rest-local pre-head-knockout paint queries. This deliberately does
 * not extend global InkScene coverage: unsupported cuts refuse the WHOLE rest.
 * Sunset: extend to strokes/polygons, rounded/dashed outlines, curves/ellipses,
 * fill winding and ordered erasures before promoting rest-family coverage.
 */
import { f } from './elements/style';
import type { PlacedRestPaint } from './elements/rests';

export type RestPhysicalResult =
  | { kind: 'ink'; pieceId: string; witness: { distance: number } }
  | { kind: 'clear'; certificate: { distance: number; pieceIds: readonly string[] } }
  | { kind: 'unknown'; pieceId: string; shape: string; reason: string };
type Rect = { x0: number; y0: number; x1: number; y1: number; id: string };
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
function validBox(b: RestBox): boolean {
  return [b.x0,b.y0,b.x1,b.y1].every(Number.isFinite) && b.x0 < b.x1 && b.y0 < b.y1;
}
function classified(records: readonly PlacedRestPaint[], distance: (r: Rect) => number,
  shape: string, contact: boolean): RestPhysicalResult {
  const rects = certified(records);
  if (!Array.isArray(rects)) return rects;
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
export function restInkAt(records: readonly PlacedRestPaint[], x: number, y: number): RestPhysicalResult {
  if (![x,y].every(Number.isFinite)) return unknown(records[0]?.id ?? 'rest','point','invalid point');
  return classified(records, r => {
    const dx = Math.max(r.x0-x, 0, x-r.x1), dy = Math.max(r.y0-y, 0, y-r.y1);
    return dx || dy ? Math.hypot(dx,dy) : -Math.min(x-r.x0,r.x1-x,y-r.y0,r.y1-y);
  }, 'point', true);
}
/** Closed positive-area finite box. Edge-only grazing is unknown, never clear. */
export function restInkInBox(records: readonly PlacedRestPaint[], b: RestBox): RestPhysicalResult {
  if (!validBox(b)) return unknown(records[0]?.id ?? 'rest','box','invalid or zero-area box');
  return classified(records, r => {
    const dx = Math.max(r.x0-b.x1, b.x0-r.x1, 0), dy = Math.max(r.y0-b.y1, b.y0-r.y1, 0);
    return dx || dy ? Math.hypot(dx,dy) : -Math.min(r.x1-b.x0,b.x1-r.x0,r.y1-b.y0,b.y1-r.y0);
  }, 'box', true);
}
/** Pre-head-knockout disc: distance to actual rectangle, NOT admission bounds.
 * Ink witness and clear certificate both carry centre-to-ink distance for the
 * separately named minimum-readability-air rule. Tangency refuses. */
export function restDiscClearance(records: readonly PlacedRestPaint[], x: number, y: number, radius: number): RestPhysicalResult {
  if (![x,y,radius].every(Number.isFinite) || radius <= 0)
    return unknown(records[0]?.id ?? 'rest','disc','invalid disc');
  const rects = certified(records);
  if (!Array.isArray(rects)) return rects;
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
