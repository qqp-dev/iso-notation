/**
 * Rest symbols — the Round 12 question (how a hand's **silent span inside an
 * active measure** is written), carried through Rounds 13–17B and re-cut by
 * **Round 20**.
 *
 * Round 20 changes two things at once:
 *
 * 1. **Optical seats.** A rest is seated by its **ink centroid**, not by the
 *    near edge of its geometric ink box: the engine places the glyph so that
 *    `(centroid.x, centroid.y)` lands on the seat point — the beat column and
 *    the phrase row (see the engine's `computeJankoRestLayer`). The centroid is
 *    **data derived from the glyph's own ink** ({@link restInkCentroidOffset}),
 *    computed from the very primitives the renderer paints, never from the
 *    bounding box. The linter audits the seat
 *    (`rest-centroid-off-row`).
 * 2. **The classical re-cut.** Every glyph is cut against the classical
 *    standard (U+1D13B–U+1D140-class proportions): a **slanted stem with oval
 *    heads** for the 8th/16th, a **true serpentine** quarter, and **wide solid
 *    slabs** for the half / whole bar rests. `REST_STROKE` stays the house
 *    0.90pt monoline weight, and every extent keeps the Round 16 linear scale.
 *
 * The **whole-bar form is new** (`'whole'`, exactly 192 ticks = one whole
 * measure): the half slab *sits atop* its phrase row, the whole slab *hangs
 * below* it — the classical pair, and the only way to tell the two silences
 * apart. A 96-tick silence is a half bar, a 192-tick silence a whole bar; the
 * engine only states the whole form where the silence covers one complete
 * measure (see `computeJankoRestLayer`).
 *
 * | style                | 16th                    | 8th                   | quarter                  | half / whole               |
 * | -------------------- | ----------------------- | --------------------- | ------------------------ | -------------------------- |
 * | `'kinetic-monoline'` | slanted stem + two oval-headed hooks | stem + one hook | true serpentine | wide solid slab (atop / below) |
 * | `'classical-urtext'` | two calligraphic hooks  | one calligraphic hook | serpentine lightning     | solid block (atop / below) |
 * | `'geometric-node'`   | hollow diamond + 2 rays | hollow diamond + 1 ray| solid diamond (2.9 × 2.9pt)| open capsule (atop / below)|
 * | `'bauhaus-slash'`    | 45° slash + two wings   | 45° slash + one wing  | minimalist reversed-Z    | thin hairline box          |
 * | `'phantom-notehead'` | dashed head + stem + two downward hooks | dashed head + stem + one hook | dashed head + bare stem | dashed head + hollow bar |
 *
 * The engine's `computeJankoRestLayer` decides *where* a rest belongs (a clean
 * standard-value silence of one hand in a measure that hand is active in),
 * seats it on its phrase row and nudges it along the row inside its beat
 * cell; a rest with no clear slot is a named unwritten diagnostic, never a
 * silent overlap. This module paints what it is handed, and is the single
 * source of truth for both the ink and its gravity point.
 */

import { Hand } from '../../../model/types';
import {
  JankoRestStyle,
  JankoTokens,
  ResolvedJankoTokens,
  resolveJankoTokens,
} from '../types';
import { f } from './style';

/** The five duration classes every dialect states. */
export type JankoRestValue = 'sixteenth' | 'eighth' | 'quarter' | 'half' | 'whole';

/** Every rest value, shortest first, in the canonical order. */
export const JANKO_REST_VALUES: readonly JankoRestValue[] = [
  'sixteenth',
  'eighth',
  'quarter',
  'half',
  'whole',
];

/**
 * Round 16 linear rest-ink scale: every rest constant is its Round 15 value
 * times this factor, so each dialect keeps its exact shape language at ~55–60%
 * linear size (smaller ink on standard-like proportions, not head-sized).
 */
export const REST_LINEAR_SCALE = 0.575;

/** Vertical rest-stem height (pt) of the classical cut. */
export const REST_STEM_HEIGHT = 12.0 * REST_LINEAR_SCALE;
/**
 * Stroke (pt) of every monoline rest element — exactly the note stem stroke
 * (Round 17B), the weight the Round 20 re-cut keeps.
 */
export const REST_STROKE = 0.9;
/** Lean (pt) of the classical slanted stem: the top leans right of the foot. */
export const REST_STEM_LEAN = 1.4 * REST_LINEAR_SCALE;
/** Pullback (pt) of the stem's foot, so the cut never reads as a rule. */
export const REST_STEM_FOOT = 0.6 * REST_LINEAR_SCALE;
/** Reach (pt) of a hook, left of the stem it leaves. */
export const REST_HOOK_REACH = 4.4 * REST_LINEAR_SCALE;
/** Drop (pt) of a hook below the stem point it leaves. */
export const REST_HOOK_DROP = 2.6 * REST_LINEAR_SCALE;
/** Half-axes (pt) of the hook's terminal oval head — the classical blob. */
export const REST_HEAD_RX = 1.8 * REST_LINEAR_SCALE;
export const REST_HEAD_RY = 1.2 * REST_LINEAR_SCALE;
/** Wide solid slab of the half / whole bar rests: `W × H` in pt. */
export const REST_SLAB_WIDTH = 9.0 * REST_LINEAR_SCALE;
export const REST_SLAB_HEIGHT = 2.4 * REST_LINEAR_SCALE;
/** Hollow half/whole bar of the urtext dialect: `W × H` in pt. */
export const REST_BLOCK_WIDTH = 6.0 * REST_LINEAR_SCALE;
export const REST_BLOCK_HEIGHT = 2.5 * REST_LINEAR_SCALE;
/** Half-diagonal (pt) of the geometric node diamonds. */
export const REST_NODE_HOLLOW_HALF = 2.0 * REST_LINEAR_SCALE;
export const REST_NODE_SOLID_HALF = 2.5 * REST_LINEAR_SCALE;
/** Horizontal reach (pt) of a geometric node's lateral tick ray. */
export const REST_RAY_REACH = 4.2 * REST_LINEAR_SCALE;
/** Air (pt) between a hollow node and its lateral tick ray. */
export const REST_RAY_GAP = 0.4 * REST_LINEAR_SCALE;
/** Capsule height (pt) of the geometric half/whole bar, per side of its seat. */
export const REST_CAPSULE_HEIGHT = 2.2 * REST_LINEAR_SCALE;
/** Half-extent (pt) of the bauhaus slash and its parallel wings. */
export const REST_SLASH_HALF = 3.5 * REST_LINEAR_SCALE;
export const REST_WING_OFFSET = 2.2 * REST_LINEAR_SCALE;
/** Half-height (pt) of the bauhaus quarter reversed-Z. */
export const REST_Z_HALF = 3.4 * REST_LINEAR_SCALE;
/** Half-height (pt) of the bauhaus half/whole hairline box, per side of its seat. */
export const REST_BOX_HALF = 1.5 * REST_LINEAR_SCALE;
/** Stroke (pt) of the bauhaus hairline box (Round 17B: pre-scale 0.6pt). */
export const REST_BOX_STROKE = 0.6;
/**
 * Round 13 phantom-notehead dialect: radius (pt) of the dashed open head that
 * stands where the unvoiced notehead would have been.
 */
export const REST_PHANTOM_HEAD_RADIUS = 3.0 * REST_LINEAR_SCALE;
/** Stroke (pt) of the phantom head's dashed outline and of its bare stem. */
export const REST_PHANTOM_HEAD_STROKE = 0.8;
/** Dash pattern (pt) of the phantom head — an open, unwritten notehead. */
export const REST_PHANTOM_DASH = `${(1.8 * REST_LINEAR_SCALE).toFixed(2)},${(1.5 * REST_LINEAR_SCALE).toFixed(2)}`;
/** Horizontal reach (pt) of a phantom flag hook, right of its stem. */
export const REST_PHANTOM_FLAG_REACH = 4.2 * REST_LINEAR_SCALE;
/** Drop (pt) of a phantom flag hook below the stem point it leaves. */
export const REST_PHANTOM_FLAG_DROP = 2.4 * REST_LINEAR_SCALE;
/** Hollow half/whole bar of the phantom dialect: `W × H` in pt, per side of its seat. */
export const REST_PHANTOM_BAR_WIDTH = 7.0 * REST_LINEAR_SCALE;
export const REST_PHANTOM_BAR_HEIGHT = 1.2 * REST_LINEAR_SCALE;
/** Calligraphic hooks of the urtext dialect: reach, drop and bulb radius (pt). */
export const REST_URTEXT_STEM_SLANT = 1.6 * REST_LINEAR_SCALE;
export const REST_URTEXT_STEM_FOOT = 0.6 * REST_LINEAR_SCALE;
export const REST_URTEXT_HOOK_REACH = 4.4 * REST_LINEAR_SCALE;
export const REST_URTEXT_HOOK_DROP = 2.6 * REST_LINEAR_SCALE;
export const REST_URTEXT_BULB_RADIUS = 0.7 * REST_LINEAR_SCALE;
/** Half-extents (pt) of the urtext quarter serpentine around the rest centre. */
export const REST_URTEXT_LIGHTNING_HALF_WIDTH = 2.6 * REST_LINEAR_SCALE;
export const REST_URTEXT_LIGHTNING_TOP = 5.4 * REST_LINEAR_SCALE;
export const REST_URTEXT_LIGHTNING_BOTTOM = 5.8 * REST_LINEAR_SCALE;

/**
 * Duration class of a silence.
 *
 * The thresholds mirror the clasp duration grammar
 * (`rhythm.claspDurationClass`), so a rest and a clasped cluster of the same
 * value can never disagree: ≥ 192 ticks is the whole-bar mark, ≥ 96 the
 * half-bar mark, a quarter is anything over 38, an 8th over 14, and everything
 * shorter is a 16th.
 */
export function restValueForTicks(durationTicks: number): JankoRestValue {
  if (durationTicks >= 192) return 'whole';
  if (durationTicks >= 96) return 'half';
  if (durationTicks > 38) return 'quarter';
  if (durationTicks > 14) return 'eighth';
  return 'sixteenth';
}

/**
 * Plain note values (ticks) a rest may state exactly: 16th … whole. A silence
 * that is not one of them (a 2.5-beat gap, a 27-tick tie artefact) is left
 * unwritten rather than approximated, so a painted rest never lies about the
 * duration it covers.
 */
const REST_STANDARD_VALUES: readonly number[] = [12, 24, 48, 96, 192];

/** Is this silence exactly one standard rest value? */
export function isStandardRestValue(durationTicks: number): boolean {
  return REST_STANDARD_VALUES.includes(durationTicks);
}

/** Is this rest value one of the two bar forms (the slab pair)? */
export function isBarRestValue(value: JankoRestValue): boolean {
  return value === 'half' || value === 'whole';
}

// ---------------------------------------------------------------------------
// The ink model: one glyph = a list of primitives, painted and weighed alike
// ---------------------------------------------------------------------------

/** One point in page pt coordinates. */
export interface JankoInkPoint {
  x: number;
  y: number;
}

/**
 * One primitive of a rest glyph, in page pt coordinates. The renderer paints
 * exactly these primitives and {@link centroidOfInk} weighs exactly the same
 * list, so the gravity point can never drift from the paint.
 */
export type JankoRestInk =
  | {
      kind: 'line';
      cls: string;
      a: JankoInkPoint;
      b: JankoInkPoint;
      width: number;
      cap?: 'butt' | 'round';
      attrs?: string;
    }
  | {
      kind: 'curve';
      cls: string;
      start: JankoInkPoint;
      segments: ReadonlyArray<readonly [JankoInkPoint, JankoInkPoint, JankoInkPoint]>;
      width: number;
      cap?: 'butt' | 'round';
      attrs?: string;
    }
  | {
      kind: 'poly';
      cls: string;
      pts: readonly JankoInkPoint[];
      close: boolean;
      stroke: number | null;
      fill: string | null;
      cap?: 'butt' | 'round';
      attrs?: string;
    }
  | {
      kind: 'rect';
      cls: string;
      x: number;
      y: number;
      w: number;
      h: number;
      rx?: number;
      stroke: number | null;
      fill: string | null;
      dash?: string;
      attrs?: string;
    }
  | {
      kind: 'ellipse';
      cls: string;
      c: JankoInkPoint;
      rx: number;
      ry: number;
      stroke: number | null;
      fill: string | null;
      dash?: string;
      attrs?: string;
    };

/** Number of samples used to weigh one cubic segment (deterministic). */
const CURVE_SAMPLES = 32;

/** Sample one cubic Bézier segment. */
function sampleCubic(
  p0: JankoInkPoint,
  p1: JankoInkPoint,
  p2: JankoInkPoint,
  p3: JankoInkPoint,
  steps: number
): JankoInkPoint[] {
  const out: JankoInkPoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    out.push({
      x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
      y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
    });
  }
  return out;
}

/** Length-weighted centroid of one sampled polyline. */
function polylineCentroid(pts: readonly JankoInkPoint[]): {
  centroid: JankoInkPoint;
  length: number;
} {
  let length = 0;
  let sx = 0;
  let sy = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const l = Math.hypot(b.x - a.x, b.y - a.y);
    length += l;
    sx += ((a.x + b.x) / 2) * l;
    sy += ((a.y + b.y) / 2) * l;
  }
  return length > 0
    ? { centroid: { x: sx / length, y: sy / length }, length }
    : { centroid: pts[0] ?? { x: 0, y: 0 }, length: 0 };
}

/** Area centroid of one closed polygon (shoelace). */
function polygonCentroid(pts: readonly JankoInkPoint[]): {
  centroid: JankoInkPoint;
  area: number;
} {
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const cross = a.x * b.y - b.x * a.y;
    area += cross;
    cx += (a.x + b.x) * cross;
    cy += (a.y + b.y) * cross;
  }
  area /= 2;
  if (Math.abs(area) < 1e-12) {
    return { centroid: pts[0] ?? { x: 0, y: 0 }, area: 0 };
  }
  return { centroid: { x: cx / (6 * area), y: cy / (6 * area) }, area: Math.abs(area) };
}

/**
 * The ink centroid of one primitive list — the glyph's **gravity point**, in
 * the same coordinates as the primitives. Strokes weigh their length times
 * their width, fills their area; a rectangle, an ellipse and a symmetric
 * outline all centre on their own middle, which is exactly how the eye reads
 * them.
 */
export function centroidOfInk(items: readonly JankoRestInk[]): JankoInkPoint {
  let weight = 0;
  let sx = 0;
  let sy = 0;
  const add = (c: JankoInkPoint, w: number): void => {
    if (!(w > 1e-9)) return;
    weight += w;
    sx += c.x * w;
    sy += c.y * w;
  };
  for (const item of items) {
    switch (item.kind) {
      case 'line': {
        const l = Math.hypot(item.b.x - item.a.x, item.b.y - item.a.y);
        add({ x: (item.a.x + item.b.x) / 2, y: (item.a.y + item.b.y) / 2 }, l * item.width);
        break;
      }
      case 'curve': {
        let cursor = item.start;
        for (const [c1, c2, end] of item.segments) {
          const sampled = sampleCubic(cursor, c1, c2, end, CURVE_SAMPLES);
          const { centroid, length } = polylineCentroid(sampled);
          add(centroid, length * item.width);
          cursor = end;
        }
        break;
      }
      case 'poly': {
        const closed = item.close
          ? item.pts
          : [...item.pts, item.pts[0] ?? { x: 0, y: 0 }];
        // `'none'` is a hollow outline: only real paint weighs in.
        if (item.fill !== null && item.fill !== 'none') {
          const { centroid, area } = polygonCentroid(closed);
          add(centroid, area);
        }
        if (item.stroke !== null) {
          const { centroid, length } = polylineCentroid(
            item.close ? [...item.pts, item.pts[0]] : item.pts
          );
          add(centroid, length * item.stroke);
        }
        break;
      }
      case 'rect': {
        const center = { x: item.x + item.w / 2, y: item.y + item.h / 2 };
        const filled = item.fill !== null && item.fill !== 'none';
        const w =
          (filled ? item.w * item.h : 0) +
          (item.stroke !== null ? 2 * (item.w + item.h) * item.stroke : 0);
        add(center, w);
        break;
      }
      case 'ellipse': {
        const filled = item.fill !== null && item.fill !== 'none';
        const w =
          (filled ? Math.PI * item.rx * item.ry : 0) +
          (item.stroke !== null ? Math.PI * (item.rx + item.ry) * item.stroke : 0);
        add(item.c, w);
        break;
      }
    }
  }
  return weight > 0 ? { x: sx / weight, y: sy / weight } : { x: 0, y: 0 };
}

/**
 * Axis-aligned ink extents of one primitive list — the conservative box every
 * clearance rule measures foreign glyphs against. A stroked primitive grows by
 * half its stroke on every side (butt and round caps alike), a fill by nothing.
 */
export function extentsOfInk(items: readonly JankoRestInk[]): {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
} {
  let x0 = Number.POSITIVE_INFINITY;
  let y0 = Number.POSITIVE_INFINITY;
  let x1 = Number.NEGATIVE_INFINITY;
  let y1 = Number.NEGATIVE_INFINITY;
  const grow = (
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
    pad: number
  ): void => {
    x0 = Math.min(x0, minX - pad);
    y0 = Math.min(y0, minY - pad);
    x1 = Math.max(x1, maxX + pad);
    y1 = Math.max(y1, maxY + pad);
  };
  const bbox = (pts: readonly JankoInkPoint[]): [number, number, number, number] => {
    let mnX = Number.POSITIVE_INFINITY;
    let mnY = Number.POSITIVE_INFINITY;
    let mxX = Number.NEGATIVE_INFINITY;
    let mxY = Number.NEGATIVE_INFINITY;
    for (const p of pts) {
      mnX = Math.min(mnX, p.x);
      mnY = Math.min(mnY, p.y);
      mxX = Math.max(mxX, p.x);
      mxY = Math.max(mxY, p.y);
    }
    return [mnX, mnY, mxX, mxY];
  };
  for (const item of items) {
    switch (item.kind) {
      case 'line':
        grow(...bbox([item.a, item.b]), item.width / 2);
        break;
      case 'curve': {
        const pts: JankoInkPoint[] = [item.start];
        let cursor = item.start;
        for (const [c1, c2, end] of item.segments) {
          pts.push(...sampleCubic(cursor, c1, c2, end, CURVE_SAMPLES));
          cursor = end;
        }
        grow(...bbox(pts), item.width / 2);
        break;
      }
      case 'poly': {
        const [mnX, mnY, mxX, mxY] = bbox(item.pts);
        if (item.fill !== null) grow(mnX, mnY, mxX, mxY, 0);
        if (item.stroke !== null) grow(mnX, mnY, mxX, mxY, item.stroke / 2);
        break;
      }
      case 'rect':
        grow(item.x, item.y, item.x + item.w, item.y + item.h, (item.stroke ?? 0) / 2);
        break;
      case 'ellipse':
        grow(
          item.c.x - item.rx,
          item.c.y - item.ry,
          item.c.x + item.rx,
          item.c.y + item.ry,
          (item.stroke ?? 0) / 2
        );
        break;
    }
  }
  return { x0, y0, x1, y1 };
}

/** Serialize one primitive as SVG. */
function inkToSvg(item: JankoRestInk): string {
  const attrs = item.attrs ?? '';
  switch (item.kind) {
    case 'line':
      return (
        `    <line class="${item.cls}" x1="${f(item.a.x)}" y1="${f(item.a.y)}" ` +
        `x2="${f(item.b.x)}" y2="${f(item.b.y)}" stroke="#111111" ` +
        `stroke-width="${item.width.toFixed(2)}" stroke-linecap="${item.cap ?? 'butt'}"${attrs}/>`
      );
    case 'curve': {
      const d = [
        `M ${f(item.start.x)} ${f(item.start.y)}`,
        ...item.segments.map(
          ([c1, c2, end]) => `C ${f(c1.x)} ${f(c1.y)} ${f(c2.x)} ${f(c2.y)} ${f(end.x)} ${f(end.y)}`
        ),
      ].join(' ');
      return (
        `    <path class="${item.cls}" d="${d}" fill="none" stroke="#111111" ` +
        `stroke-width="${item.width.toFixed(2)}" stroke-linecap="${item.cap ?? 'round'}" ` +
        `stroke-linejoin="round"${attrs}/>`
      );
    }
    case 'poly': {
      const d =
        `M ${item.pts.map((p) => `${f(p.x)} ${f(p.y)}`).join(' L ')}` + (item.close ? ' Z' : '');
      const fill = item.fill ?? 'none';
      const stroke = item.stroke === null ? 'none' : '#111111';
      const width = item.stroke === null ? '' : ` stroke-width="${item.stroke.toFixed(2)}"`;
      return (
        `    <path class="${item.cls}" d="${d}" fill="${fill}" stroke="${stroke}"${width} ` +
        `stroke-linecap="${item.cap ?? 'butt'}" stroke-linejoin="miter"${attrs}/>`
      );
    }
    case 'rect': {
      const rx = item.rx === undefined ? '' : ` rx="${f(item.rx)}" ry="${f(item.rx)}"`;
      const stroke = item.stroke === null ? 'none' : '#111111';
      const width = item.stroke === null ? '' : ` stroke-width="${item.stroke.toFixed(2)}"`;
      const dash = item.dash ? ` stroke-dasharray="${item.dash}"` : '';
      return (
        `    <rect class="${item.cls}" x="${f(item.x)}" y="${f(item.y)}" ` +
        `width="${f(item.w)}" height="${f(item.h)}"${rx} fill="${item.fill ?? 'none'}" ` +
        `stroke="${stroke}"${width}${dash}${attrs}/>`
      );
    }
    case 'ellipse': {
      const stroke = item.stroke === null ? 'none' : '#111111';
      const width = item.stroke === null ? '' : ` stroke-width="${item.stroke.toFixed(2)}"`;
      const dash = item.dash ? ` stroke-dasharray="${item.dash}"` : '';
      return (
        `    <ellipse class="${item.cls}" cx="${f(item.c.x)}" cy="${f(item.c.y)}" ` +
        `rx="${f(item.rx)}" ry="${f(item.ry)}" fill="${item.fill ?? 'none'}" ` +
        `stroke="${stroke}"${width}${dash}${attrs}/>`
      );
    }
  }
}

/** Paint one primitive list. */
export function renderInk(items: readonly JankoRestInk[]): string[] {
  return items.map(inkToSvg);
}

// ---------------------------------------------------------------------------
// Per-dialect cuts. Every builder draws about the glyph origin `o` (page pt).
// The bar forms draw with their **near edge on the origin** — the half slab
// sits atop it, the whole slab hangs below it — so the origin is exactly the
// phrase row and the seat offset is the glyph's own gravity offset.
// ---------------------------------------------------------------------------

/** The classical slanted stem: top leaning right, foot stopping short. */
function classicalStem(
  o: JankoInkPoint,
  width: number,
  cls: string,
  lean: number = REST_STEM_LEAN
): JankoRestInk {
  const half = REST_STEM_HEIGHT / 2;
  return {
    kind: 'line',
    cls,
    a: { x: o.x + lean / 2, y: o.y - half },
    b: { x: o.x - lean / 2, y: o.y + half - REST_STEM_FOOT },
    width,
    cap: 'butt',
  };
}

/** The stem's x at a height between its top and its foot (shared by the hooks). */
function stemXAt(o: JankoInkPoint, y: number, lean: number = REST_STEM_LEAN): number {
  const half = REST_STEM_HEIGHT / 2;
  const topY = o.y - half;
  const botY = o.y + half - REST_STEM_FOOT;
  const t = (y - topY) / (botY - topY);
  return o.x + lean / 2 + t * -lean;
}

/** Slanted stem + `marks` oval-headed classical hooks (the golden re-cut). */
function classicalHookedInk(
  o: JankoInkPoint,
  marks: number,
  t: ResolvedJankoTokens,
  opts: {
    stemCls: string;
    hookCls: string;
    headCls: string;
    head: 'oval' | 'bulb';
    hookReach: number;
    hookDrop: number;
    stroke: number;
    lean?: number;
    hookAttrs?: (index: number) => string;
  }
): JankoRestInk[] {
  const lean = opts.lean ?? REST_STEM_LEAN;
  const out: JankoRestInk[] = [classicalStem(o, opts.stroke, opts.stemCls, lean)];
  const topY = o.y - REST_STEM_HEIGHT / 2;
  for (let i = 1; i <= marks; i++) {
    const cy = topY + (i - 1) * t.flagSpacing;
    const sx = stemXAt(o, cy, lean);
    const head = { x: sx - opts.hookReach, y: cy + opts.hookDrop };
    out.push({
      kind: 'curve',
      cls: opts.hookCls,
      start: { x: sx, y: cy },
      segments: [
        [
          { x: sx - opts.hookReach * 0.45, y: cy + opts.hookDrop * 0.06 },
          { x: sx - opts.hookReach * 0.92, y: cy + opts.hookDrop * 0.52 },
          head,
        ],
      ],
      width: opts.stroke,
      cap: 'round',
      ...(opts.hookAttrs ? { attrs: opts.hookAttrs(i) } : {}),
    });
    out.push(
      opts.head === 'oval'
        ? {
            kind: 'ellipse',
            cls: opts.headCls,
            c: head,
            rx: REST_HEAD_RX,
            ry: REST_HEAD_RY,
            stroke: null,
            fill: '#111111',
            attrs: opts.hookAttrs ? ` data-rest-hook-head="${i}"` : '',
          }
        : {
            kind: 'ellipse',
            cls: opts.headCls,
            c: head,
            rx: REST_URTEXT_BULB_RADIUS,
            ry: REST_URTEXT_BULB_RADIUS,
            stroke: null,
            fill: '#111111',
          }
    );
  }
  return out;
}

/**
 * The **true serpentine** quarter: the classical zigzag, monoline at the house
 * 0.90pt weight, four calligraphic segments from the upper left to the long
 * lower tail.
 */
function serpentine(o: JankoInkPoint, s: number, width: number, cls: string): JankoRestInk {
  const p = (dx: number, dy: number): JankoInkPoint => ({ x: o.x + dx * s, y: o.y + dy * s });
  return {
    kind: 'curve',
    cls,
    start: p(-2.3, -4.9),
    segments: [
      [p(-0.7, -4.4), p(1.3, -3.5), p(2.2, -2.5)],
      [p(0.6, -1.8), p(-1.6, -1.1), p(-2.2, -0.3)],
      [p(-0.5, 0.4), p(1.2, 1.2), p(2.0, 2.2)],
      [p(0.4, 3.4), p(-1.5, 4.5), p(-2.6, 5.3)],
    ],
    width,
    cap: 'round',
  };
}

/** The golden `'kinetic-monoline'` cut: classical monoline, Round 20. */
function kineticInk(o: JankoInkPoint, value: JankoRestValue, t: ResolvedJankoTokens): JankoRestInk[] {
  if (isBarRestValue(value)) {
    // Wide solid slab: the half sits atop its seat row, the whole hangs below.
    return [
      {
        kind: 'rect',
        cls: value === 'half' ? 'janko-rest-slab' : 'janko-rest-slab janko-rest-slab-whole',
        x: o.x - REST_SLAB_WIDTH / 2,
        y: value === 'half' ? o.y - REST_SLAB_HEIGHT : o.y,
        w: REST_SLAB_WIDTH,
        h: REST_SLAB_HEIGHT,
        stroke: null,
        fill: '#111111',
      },
    ];
  }
  if (value === 'quarter') {
    return [serpentine(o, REST_LINEAR_SCALE, REST_STROKE, 'janko-rest-lightning')];
  }
  return classicalHookedInk(o, value === 'sixteenth' ? 2 : 1, t, {
    stemCls: 'janko-rest-stem',
    hookCls: 'janko-rest-hook',
    headCls: 'janko-rest-hook-head',
    head: 'oval',
    hookReach: REST_HOOK_REACH,
    hookDrop: REST_HOOK_DROP,
    stroke: REST_STROKE,
    hookAttrs: (i) => ` data-rest-hook="${i}"`,
  });
}

/** The `'classical-urtext'` cut: calligraphic hooks, serpentine, solid block. */
function urtextInk(o: JankoInkPoint, value: JankoRestValue, t: ResolvedJankoTokens): JankoRestInk[] {
  if (isBarRestValue(value)) {
    // The authentic half rest **sits on** its line, the whole rest hangs below.
    return [
      {
        kind: 'rect',
        cls: 'janko-rest-block',
        x: o.x - REST_BLOCK_WIDTH / 2,
        y: value === 'half' ? o.y - REST_BLOCK_HEIGHT : o.y,
        w: REST_BLOCK_WIDTH,
        h: REST_BLOCK_HEIGHT,
        stroke: null,
        fill: '#111111',
      },
    ];
  }
  if (value === 'quarter') {
    return [serpentine(o, REST_LINEAR_SCALE, REST_STROKE, 'janko-rest-lightning')];
  }
  return classicalHookedInk(o, value === 'sixteenth' ? 2 : 1, t, {
    stemCls: 'janko-rest-stem-line',
    hookCls: 'janko-rest-hook',
    headCls: 'janko-rest-hook-bulb',
    head: 'bulb',
    hookReach: REST_URTEXT_HOOK_REACH,
    hookDrop: REST_URTEXT_HOOK_DROP,
    stroke: REST_STROKE,
    lean: REST_URTEXT_STEM_SLANT,
  });
}

/** The `'phantom-notehead'` cut: an open dashed head where the note would be. */
function phantomInk(
  o: JankoInkPoint,
  value: JankoRestValue,
  t: ResolvedJankoTokens
): JankoRestInk[] {
  const stroke = REST_PHANTOM_HEAD_STROKE;
  const half = REST_STEM_HEIGHT / 2;
  const out: JankoRestInk[] = [
    {
      kind: 'ellipse',
      cls: 'janko-rest-phantom-head',
      c: o,
      rx: REST_PHANTOM_HEAD_RADIUS,
      ry: REST_PHANTOM_HEAD_RADIUS,
      stroke,
      fill: 'none',
      dash: REST_PHANTOM_DASH,
    },
  ];
  if (isBarRestValue(value)) {
    out.push({
      kind: 'rect',
      cls: 'janko-rest-phantom-bar',
      x: o.x - REST_PHANTOM_BAR_WIDTH / 2,
      y: value === 'half' ? o.y - REST_PHANTOM_BAR_HEIGHT : o.y,
      w: REST_PHANTOM_BAR_WIDTH,
      h: REST_PHANTOM_BAR_HEIGHT,
      stroke,
      fill: 'none',
      dash: REST_PHANTOM_DASH,
    });
    return out;
  }
  out.push({
    kind: 'line',
    cls: 'janko-rest-phantom-stem',
    a: { x: o.x, y: o.y - half },
    b: { x: o.x, y: o.y + half },
    width: stroke,
    cap: 'butt',
  });
  if (value === 'quarter') return out;
  const flags = value === 'sixteenth' ? 2 : 1;
  for (let i = 1; i <= flags; i++) {
    const cy = o.y - half + (i - 1) * t.flagSpacing;
    out.push({
      kind: 'curve',
      cls: 'janko-rest-phantom-flag',
      start: { x: o.x, y: cy },
      segments: [
        [
          { x: o.x + REST_PHANTOM_FLAG_REACH * 0.6, y: cy + REST_PHANTOM_FLAG_DROP * 0.12 },
          { x: o.x + REST_PHANTOM_FLAG_REACH * 0.95, y: cy + REST_PHANTOM_FLAG_DROP * 0.62 },
          { x: o.x + REST_PHANTOM_FLAG_REACH, y: cy + REST_PHANTOM_FLAG_DROP },
        ],
      ],
      width: stroke,
      cap: 'round',
      attrs: ` data-rest-flag="${i}"`,
    });
  }
  return out;
}

/** One open diamond (hollow node). */
function diamond(o: JankoInkPoint, half: number, cls: string, stroke: number | null): JankoRestInk {
  return {
    kind: 'poly',
    cls,
    pts: [
      { x: o.x, y: o.y - half },
      { x: o.x + half, y: o.y },
      { x: o.x, y: o.y + half },
      { x: o.x - half, y: o.y },
    ],
    close: true,
    stroke,
    fill: stroke === null ? '#111111' : 'none',
  };
}

/** The `'geometric-node'` cut: hollow/solid diamonds, rays, open capsule. */
function geometricInk(o: JankoInkPoint, value: JankoRestValue): JankoRestInk[] {
  if (isBarRestValue(value)) {
    return [
      {
        kind: 'rect',
        cls: 'janko-rest-capsule',
        x: o.x - REST_SLAB_WIDTH / 2,
        y: value === 'half' ? o.y - REST_CAPSULE_HEIGHT * 2 : o.y,
        w: REST_SLAB_WIDTH,
        h: REST_CAPSULE_HEIGHT * 2,
        rx: REST_CAPSULE_HEIGHT,
        stroke: REST_STROKE,
        fill: 'none',
      },
    ];
  }
  if (value === 'quarter') {
    return [diamond(o, REST_NODE_SOLID_HALF, 'janko-rest-node janko-rest-node-solid', null)];
  }
  const out: JankoRestInk[] = [diamond(o, REST_NODE_HOLLOW_HALF, 'janko-rest-node', REST_STROKE)];
  const side = (s: -1 | 1): JankoRestInk => ({
    kind: 'line',
    cls: 'janko-rest-ray',
    a: { x: o.x + s * (REST_NODE_HOLLOW_HALF + REST_RAY_GAP), y: o.y },
    b: { x: o.x + s * REST_RAY_REACH, y: o.y },
    width: REST_STROKE,
    cap: 'butt',
  });
  out.push(side(-1));
  if (value === 'sixteenth') out.push(side(1));
  return out;
}

/** One 45° beveled slash (or wing) rising left to right. */
function beveledSlash(o: JankoInkPoint, half: number, cls: string): JankoRestInk {
  return {
    kind: 'line',
    cls,
    a: { x: o.x - half, y: o.y + half },
    b: { x: o.x + half, y: o.y - half },
    width: REST_STROKE,
    cap: 'butt',
  };
}

/** The `'bauhaus-slash'` cut: beveled slashes, reversed-Z, hairline box. */
function bauhausInk(o: JankoInkPoint, value: JankoRestValue): JankoRestInk[] {
  if (isBarRestValue(value)) {
    return [
      {
        kind: 'rect',
        cls: 'janko-rest-box',
        x: o.x - REST_SLAB_WIDTH / 2,
        y: value === 'half' ? o.y - REST_BOX_HALF * 2 : o.y,
        w: REST_SLAB_WIDTH,
        h: REST_BOX_HALF * 2,
        stroke: REST_BOX_STROKE,
        fill: 'none',
      },
    ];
  }
  if (value === 'quarter') {
    const h = REST_Z_HALF;
    return [
      {
        kind: 'poly',
        cls: 'janko-rest-z',
        pts: [
          { x: o.x + h * 0.82, y: o.y + h },
          { x: o.x - h * 0.82, y: o.y + h },
          { x: o.x + h * 0.82, y: o.y - h },
          { x: o.x - h * 0.82, y: o.y - h },
        ],
        close: false,
        stroke: REST_STROKE,
        fill: null,
      },
    ];
  }
  const out: JankoRestInk[] = [beveledSlash(o, REST_SLASH_HALF, 'janko-rest-slash')];
  out.push(
    beveledSlash(
      { x: o.x - REST_WING_OFFSET, y: o.y },
      REST_SLASH_HALF * 0.6,
      'janko-rest-wing'
    )
  );
  if (value === 'sixteenth') {
    out.push(
      beveledSlash(
        { x: o.x + REST_WING_OFFSET, y: o.y },
        REST_SLASH_HALF * 0.6,
        'janko-rest-wing'
      )
    );
  }
  return out;
}

/** The primitive list of one rest glyph, drawn about its origin `o`. */
export function restInk(
  o: JankoInkPoint,
  value: JankoRestValue,
  style: JankoRestStyle,
  t: ResolvedJankoTokens
): JankoRestInk[] {
  switch (style) {
    case 'classical-urtext':
      return urtextInk(o, value, t);
    case 'geometric-node':
      return geometricInk(o, value);
    case 'bauhaus-slash':
      return bauhausInk(o, value);
    case 'phantom-notehead':
      return phantomInk(o, value, t);
    case 'kinetic-monoline':
    default:
      return kineticInk(o, value, t);
  }
}

/** One resolved rest: where it stands, how long it is silent and in which dialect. */
export interface JankoRestGeometry {
  /** Absolute onset tick of the silence. */
  tick: number;
  /** Length of the silence (ticks). */
  durationTicks: number;
  /** Hand whose voice is silent. */
  hand: Hand;
  /**
   * Optical seat point x (page pt): the glyph is placed so that its ink
   * centroid stands exactly on this column.
   */
  x: number;
  /** Optical seat point y (page pt): the ink centroid (and the bar forms' row). */
  y: number;
  /** Duration class painted. */
  value: JankoRestValue;
  /** Active dialect. */
  style: JankoRestStyle;
}

/**
 * The glyph's **gravity offset**: the ink centroid of one rest glyph drawn
 * about the origin, so the painted centroid of a rest whose seat point is
 * `(x, y)` is exactly `(x, y)` — see {@link restGlyphOrigin}.
 */
export function restInkCentroidOffset(
  value: JankoRestValue,
  style: JankoRestStyle,
  tokens?: Partial<JankoTokens> | null
): JankoInkPoint {
  const t = resolveJankoTokens(tokens);
  return centroidOfInk(restInk({ x: 0, y: 0 }, value, style, t));
}

/**
 * The glyph's draw origin for a rest whose optical seat point is
 * `(rest.x, rest.y)`: the origin the dialect painters draw about, shifted so
 * that the painted ink centroid lands exactly on the seat point.
 */
export function restGlyphOrigin(
  rest: JankoRestGeometry,
  tokens?: Partial<JankoTokens> | null
): JankoInkPoint {
  const c = restInkCentroidOffset(rest.value, rest.style, tokens);
  return { x: rest.x - c.x, y: rest.y - c.y };
}

/**
 * Extra offset (pt) of the phrase row above/below the seat point, for the two
 * **bar forms**: a bar glyph is drawn with its near edge on the origin, so the
 * half slab's gravity point sits half a slab above its row and the whole
 * slab's half a slab below it. Every other value's centroid *is* the seat
 * point, so its offset is 0.
 */
export function restSeatOffsetY(
  value: JankoRestValue,
  style: JankoRestStyle,
  tokens?: Partial<JankoTokens> | null
): number {
  if (!isBarRestValue(value)) return 0;
  return restInkCentroidOffset(value, style, tokens).y;
}

/**
 * Axis-aligned ink box of one rest, in the active dialect, at the glyph's
 * optical origin. The engine's fit rule measures foreign notehead discs
 * against this same box, so a painted rest can never be a surprise collision —
 * the box and the ink are defined together.
 */
export function restInkBox(
  rest: JankoRestGeometry,
  tokens?: Partial<JankoTokens> | null
): { x0: number; y0: number; x1: number; y1: number } {
  const t = resolveJankoTokens(tokens);
  const o = restGlyphOrigin(rest, t);
  return extentsOfInk(restInk(o, rest.value, rest.style, t));
}

/**
 * Paint one rest in the active dialect, at its optical seat. The group carries
 * the rest's musical identity as data attributes (`data-rest-tick`, `-value`,
 * `-hand`, `-style`), so the studio, the tests and a future audition pass can
 * address it without parsing coordinates.
 */
export function renderRest(
  rest: JankoRestGeometry,
  tokens?: Partial<JankoTokens> | null
): string {
  const t = resolveJankoTokens(tokens);
  const o = restGlyphOrigin(rest, t);
  const ink = renderInk(restInk(o, rest.value, rest.style, t));
  return [
    `    <g class="janko-rest-group" data-rest-tick="${rest.tick}" data-rest-value="${rest.value}" data-rest-hand="${rest.hand}" data-rest-style="${rest.style}">`,
    ...ink,
    '    </g>',
  ].join('\n');
}
