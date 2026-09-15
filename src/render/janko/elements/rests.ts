/**
 * Rest symbols — the Round 12 question (how a hand's **silent span inside an
 * active measure** is written), carried through Rounds 13–20 and **cut to the
 * measured numbers by Round 21**.
 *
 * Round 21 changes three things:
 *
 * 1. **Nothing is hand-drawn any more.** Every constant of every rest cut
 *    traces to the Round 21 measurement table below: outlines extracted from
 *    **Bravura** (the SMuFL reference font, OFL, v1.482, sha256 cdf0f893…)
 *    with fontTools, corroborated against **Noto Music** (Google Fonts, OFL,
 *    v2.003, sha256 e913be26…) — the repo's original reference. Both files are
 *    the same *shape family* (Noto Music is Bravura-derived) but they place the
 *    glyphs on different origins and, in the slab pair, disagree on width; the
 *    cut follows **Bravura**, the SMuFL reference, and records Noto beside it.
 * 2. **The scale is explicit.** {@link REST_SPACE_PT} is the one mapping from
 *    SMuFL staff spaces to page points; every measured dimension is written as
 *    `u(units)` so the tracing is textual, never silent.
 * 3. **The working set is complete `whole → 64th`** (operator ruling: this is a
 *    notation *system*, not two pieces): the 32nd and 64th rests join the five
 *    values, and every dialect states seven silences.
 *
 * Round 22 keeps the table and the scale but stops redrawing: the
 * `'classical-urtext'` hooked rests and quarter are the Bravura contours
 * transcribed verbatim (`urtext-paths.ts`, OFL — R21's redraw had mirrored
 * the quarter and flipped the hooks). The kinetic cut below still consumes
 * the measured numbers; only the classical cut is a transplant.
 *
 * ## Round 21 measurement table (Bravura v1.482, upm 1000, 1 space = 250u)
 *
 * | glyph            | code   | bbox (u)          | W (sp) | H (sp) | notes |
 * | ---------------- | ------ | ----------------- | ------ | ------ | ----- |
 * | `restQuarter`    | U+E4E5 | (1,−375)-(270,373)| 1.076  | 2.992  | 1 contour; thin stroke 28.8u, thick 165u (p90) / 262u (max) |
 * | `rest8th`        | U+E4E6 | (0,−251)-(247,174)| 0.988  | 1.700  | 1 lobe + tapered stem; stem 65u → 53u; lean dx/dy ≈ 0.31 |
 * | `rest16th`       | U+E4E7 | (0,−500)-(320,179)| 1.280  | 2.716  | 2 lobes; lobe pitch 249u |
 * | `rest32nd`       | U+E4E8 | (0,−500)-(363,426)| 1.452  | 3.704  | 3 lobes; lobe pitch 251/249u |
 * | `rest64th`       | U+E4E9 | (0,−753)-(423,430)| 1.692  | 4.732  | 4 lobes; lobe pitch 255/246/247u |
 * | `restHalf`       | U+E4E4 | (0,−2)-(282,142)  | 1.128  | 0.576  | solid rect, W/H = 1.96 |
 * | `restWhole`      | U+E4E3 | (0,−135)-(282,9)  | 1.128  | 0.576  | solid rect, W/H = 1.96 |
 * | `augmentationDot`| U+E1E7 | (0,−50)-(100,50)  | 0.400  | 0.400  | r = 50u = 0.200sp |
 * | `noteheadBlack`  | U+E0A4 | (0,−125)-(295,125)| 1.180  | 1.000  | weight reference (1.000sp tall) |
 * | `stem`           | U+E210 | (−15,0)-(15,875)  | 0.120  | 3.500  | **3.5sp = one octave**; weight reference |
 * | `flag8thUp`      | U+E240 | (0,−810)-(264,9)  | 1.056  | 3.276  | reach/drop aspect 0.322 (Noto 0.365) |
 * | `flag16thUp`     | U+E242 | (0,−813)-(279,2)  | 1.116  | 3.260  | 2 contours; stack step 147u |
 * | `flag32ndUp`     | U+E244 | (0,−812)-(261,149)| 1.044  | 3.844  | 3 contours; stack step 198u |
 * | `flag64thUp`     | U+E246 | (0,−812)-(261,347)| 1.044  | 4.636  | 4 contours |
 * | `flag8thDown`    | U+E241 | (0,−14)-(306,808) | 1.224  | 3.288  | mirror of the up flag |
 * | `flag64thDown`   | U+E247 | (0,−376)-(273,812)| 1.092  | 4.752  | 4 contours |
 *
 * Measured shape laws the cut obeys:
 *
 * - **lobe radius** `r = 65u` and **lobe pitch** `p = 249u` (every hooked rest
 *   stacks its lobes at the same measured step: 249 / 251 / 246 / 247u);
 * - **lobe reach** left of the stem centreline `= 157u` (measured 155–177u);
 * - **stem** width `65u` at the foot tapering to `46u` near the tip and to a
 *   point at the tip — the classical wedge, never a monoline rule;
 * - **extremes**: the topmost lobe's crown is the glyph's top, the stem's tip
 *   its right extreme, the stem's foot its bottom.
 *
 * Two deviations are recorded rather than papered over (the ticket's
 * "adjust IFF off"): the **flag taper** (root ÷ drop = 0.136 measured 0.159 —
 * within 15%, so the R20 crescent stands unchanged) and the **flag aspect**
 * (0.606 against the measured 0.322), which follows from the house stem being
 * 16pt where the reference octave stem is 875u = 30pt at this scale; §B does
 * not re-cut stems, so the flag keeps its house drop and its shape is not
 * stretched to a foreign proportion.
 *
 * The **whole-bar form** (`'whole'`, exactly one measure): the half slab *sits
 * on* a drawn staff rule, the whole slab *hangs from* one — the classical pair,
 * and the only way to tell the two silences apart (Round 21 §C).
 *
 * The engine's `computeJankoRestLayer` decides *where* a rest belongs (a clean
 * standard-value silence of one hand in a measure that hand is active in),
 * seats it on its phrase row and nudges it along the row inside its beat cell;
 * a rest with no clear slot is a named unwritten diagnostic, never a silent
 * overlap. This module paints what it is handed, and is the single source of
 * truth for both the ink and its gravity point.
 */

import { Hand } from '../../../model/types';
import {
  JankoRestStyle,
  JankoTokens,
  ResolvedJankoTokens,
  resolveJankoTokens,
} from '../types';
import { f } from './style';
import { URTEXT_RESTS } from './urtext-paths';

/**
 * The seven duration classes every dialect states — the Round 21 working set,
 * `whole → 64th` complete (operator ruling: a notation *system*, not two
 * pieces). 128th and beyond stay out: past the working set.
 */
export type JankoRestValue =
  | 'sixty-fourth'
  | 'thirty-second'
  | 'sixteenth'
  | 'eighth'
  | 'quarter'
  | 'half'
  | 'whole';

/** Every rest value, shortest first, in the canonical order. */
export const JANKO_REST_VALUES: readonly JankoRestValue[] = [
  'sixty-fourth',
  'thirty-second',
  'sixteenth',
  'eighth',
  'quarter',
  'half',
  'whole',
];

/**
 * Round 21 **duration grammar**: the number of hooks a value grows out of its
 * stem — the measured lobe counts (8th = 1, 16th = 2, 32nd = 3, 64th = 4). The
 * quarter and the bar pair grow none.
 */
export const REST_MARK_COUNT: Readonly<Record<JankoRestValue, number>> = {
  'sixty-fourth': 4,
  'thirty-second': 3,
  sixteenth: 2,
  eighth: 1,
  quarter: 0,
  half: 0,
  whole: 0,
};

/**
 * The live rest family's uniform geometric scale: the five verbatim Bravura
 * glyphs (quarter, 8th, 16th, 32nd, 64th) and the whole/half block all render
 * at 0.85 of their baked envelopes. Rests are the only solid ink on the page
 * (noteheads are hollow rings); the scale quiets the ink area (~28%) while
 * every contour stays the reference outline's. Applied at render about the
 * glyph origin, so all placement math (seats, centroids, contact edges) is
 * untouched — and so the linter's shared ink model resolves scaled extents.
 * The verbatim constants in `urtext-paths.ts` stay byte-identical; dormant
 * dialects never read this constant.
 */
export const REST_SCALE = 0.85;

/**
 * The live rest family's ink: 90% black. Dims the solid interior while edges
 * stay crisp (~14:1 vs white). Only the live path (verbatim glyphs + block)
 * reads this constant; dormant dialects keep `#111111`.
 */
export const REST_INK = '#1A1A1A';

// ---------------------------------------------------------------------------
// Round 21 §A — the one explicit space → point mapping
// ---------------------------------------------------------------------------

/** Bravura / Noto Music units per em. */
export const SMUFL_UPM = 1000;
/** SMuFL defines one staff space as `upm / 4` — 250 units here. */
export const SMUFL_SPACE_UNITS = 250;

/**
 * **The Round 21 scale: 1 SMuFL staff space = {@link REST_SPACE_PT} page
 * points.**
 *
 * The crux of the round, so it is *derived from two measured facts and one
 * measured constraint*, never chosen by eye:
 *
 * 1. **Reference envelope.** The working set's tallest glyph is the 64th rest:
 *    Bravura `rest64th` measures **1183u = 4.732 staff spaces** tall.
 * 2. **Lattice headroom.** A rest is a *vertical* sign seated on a whole-tone
 *    row. Its neighbour rows stand `rowHeight` away and their noteheads wear a
 *    disc of `noteheadRadius`; the visual linter's hard floor is
 *    `minClearance` of air between rest ink and any disc. The room a glyph has
 *    symmetrically about its seat row is therefore
 *    `2 × (rowHeight − noteheadRadius − minClearance)` = `2 × (15 − 4.8 − 1)`
 *    = **18.4pt** — measured from the canonical lattice, not invented.
 * 3. **The scale.** `1 space = 18.4pt / 4.732 = 3.8884pt`.
 *
 * The mapping therefore says: *the complete working set fits the lattice at the
 * reference font's own proportions, and nothing is scaled to taste.* Three
 * independent house tokens corroborate it within 8% and are recorded rather
 * than averaged:
 *
 * | token | measured (sp) | at this scale | house value |
 * | ----- | ------------- | ------------- | ----------- |
 * | augmentation dot radius | 0.200 | 0.778pt | 0.75pt |
 * | flag reach (`flagWidth`) | 1.056 | 4.11pt | 4.0pt |
 * | beam thickness | 0.500 | 1.94pt | 1.80pt |
 *
 * The two house dimensions that do **not** follow are recorded as the round's
 * boundaries, not as errors: the notehead knockout disc is 9.6pt where a
 * classical notehead would be 3.89pt (the disc carries the digit — a deliberate
 * house decision), and the note stem's 0.90pt is 0.23sp where the reference
 * stem is 0.12sp (the house monoline weight; §B keeps stems verify-only).
 */
export const REST_SPACE_PT = 18.4 / (1183 / SMUFL_SPACE_UNITS);

/** One measured Bravura dimension (font units) in page points. */
function u(units: number): number {
  return (units / SMUFL_SPACE_UNITS) * REST_SPACE_PT;
}

/**
 * Round 16 linear rest-ink scale, kept as the recorded history of the
 * pre-Round-21 demonstrator cuts (the geometric / bauhaus / phantom shapes
 * below are still declared as their Round 15 value times this factor). The
 * Round 21 classical cut no longer uses it: every dimension now comes from the
 * measurement table through {@link u}.
 */
export const REST_LINEAR_SCALE = 0.575;

// --- measured glyph envelopes (Bravura bbox, in pt) ------------------------

/** `restQuarter` U+E4E5: 269 × 748u. */
export const REST_QUARTER_WIDTH = u(269);
export const REST_QUARTER_HEIGHT = u(748);
/** `rest8th` U+E4E6: 247 × 425u. */
export const REST_EIGHTH_WIDTH = u(247);
export const REST_EIGHTH_HEIGHT = u(425);
/** `rest16th` U+E4E7: 320 × 679u. */
export const REST_SIXTEENTH_WIDTH = u(320);
export const REST_SIXTEENTH_HEIGHT = u(679);
/** `rest32nd` U+E4E8: 363 × 926u. */
export const REST_THIRTY_SECOND_WIDTH = u(363);
export const REST_THIRTY_SECOND_HEIGHT = u(926);
/** `rest64th` U+E4E9: 423 × 1183u. */
export const REST_SIXTY_FOURTH_WIDTH = u(423);
export const REST_SIXTY_FOURTH_HEIGHT = u(1183);

/** Measured envelope of one hooked value, in page pt. */
export interface JankoRestMeasure {
  width: number;
  height: number;
}

/** The measured envelope of every hooked value (`REST_MARK_COUNT` > 0). */
export const REST_HOOKED_MEASURES: Readonly<Record<string, JankoRestMeasure>> = {
  eighth: { width: REST_EIGHTH_WIDTH, height: REST_EIGHTH_HEIGHT },
  sixteenth: { width: REST_SIXTEENTH_WIDTH, height: REST_SIXTEENTH_HEIGHT },
  'thirty-second': { width: REST_THIRTY_SECOND_WIDTH, height: REST_THIRTY_SECOND_HEIGHT },
  'sixty-fourth': { width: REST_SIXTY_FOURTH_WIDTH, height: REST_SIXTY_FOURTH_HEIGHT },
};

// --- measured hooked-rest shape laws ---------------------------------------

/** Lobe radius: measured 126–130u across every hooked rest. */
export const REST_LOBE_RADIUS = u(65);
/**
 * Lobe *vertical* radius: the reference lobe is wider than it is tall
 * (130 × 100u), and its crown is the glyph's top edge.
 */
export const REST_LOBE_RY = u(50);
/** Top-lobe centre inset from the glyph's top edge: measured 50–51u. */
export const REST_LOBE_TOP_INSET = REST_LOBE_RY;
/** Lobe pitch: the measured lobe-to-lobe step (249 / 251 / 246 / 247u). */
export const REST_LOBE_PITCH = u(249);
/** Lobe centre's offset left of the stem spine (measured 128 / 143u). */
export const REST_LOBE_OFFSET = u(128);
/** Stem thickness at the foot and near the tip: the classical wedge. */
export const REST_STEM_FOOT_WIDTH = u(65);
export const REST_STEM_TIP_WIDTH = u(46);
/** Stem-tip inset from the glyph's top edge (measured 22–23u). */
export const REST_STEM_TIP_INSET = u(22);

/** Vertical rest-stem height (pt) of the classical cut: the 8th rest's height. */
export const REST_STEM_HEIGHT = REST_EIGHTH_HEIGHT;
/**
 * Stroke (pt) of every remaining monoline rest element (the clasp rings, the
 * geometric/bauhaus/phantom dialects) — exactly the note stem stroke. It is
 * also the measured *thin* end of the calligraphic cut: the quarter's hairline
 * measures 28.8u = 0.99pt.
 */
export const REST_STROKE = 0.9;
/**
 * Lean (pt) of the classical slanted stem over the 8th rest's height — the
 * measured dx/dy 0.31 of `rest8th`, kept as the single lean figure the urtext
 * demonstrator scales.
 */
export const REST_STEM_LEAN = 0.31 * REST_STEM_HEIGHT;
/** Pullback (pt) of the stem's foot, so the cut never reads as a rule. */
export const REST_STEM_FOOT = u(0);
/** Reach (pt) of a hook, left of the stem it leaves: the measured lobe reach. */
export const REST_HOOK_REACH = REST_LOBE_OFFSET + REST_LOBE_RADIUS;
/** Drop (pt) of a hook below the stem point it leaves: the measured lobe radius. */
export const REST_HOOK_DROP = REST_LOBE_RADIUS;
/** Half-axes (pt) of the hook's terminal lobe — the classical blob. */
export const REST_HEAD_RX = REST_LOBE_RADIUS;
export const REST_HEAD_RY = REST_LOBE_RADIUS;
/** Wide solid slab of the half / whole bar rests: measured 282 × 144u. */
export const REST_SLAB_WIDTH = u(282);
export const REST_SLAB_HEIGHT = u(144);
/** Hollow half/whole bar of the urtext dialect: `W × H` in pt (slab envelope). */
export const REST_BLOCK_WIDTH = u(282);
export const REST_BLOCK_HEIGHT = u(144);
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
 * Round 21 extends the grammar to the complete working set: ≥ 192 ticks is the
 * whole-bar mark, ≥ 96 the half-bar mark, a quarter is anything over 38, an 8th
 * over 14, a 16th over 6, a 32nd over 3, and everything shorter is a 64th.
 * Only the exact standard values below ever reach a painted glyph — the class
 * function is total so a caller can always name a class.
 */
export function restValueForTicks(durationTicks: number): JankoRestValue {
  if (durationTicks >= 192) return 'whole';
  if (durationTicks >= 96) return 'half';
  if (durationTicks > 38) return 'quarter';
  if (durationTicks > 14) return 'eighth';
  if (durationTicks > 6) return 'sixteenth';
  if (durationTicks > 3) return 'thirty-second';
  return 'sixty-fourth';
}

/**
 * Plain note values (ticks) a rest may state exactly: 64th … whole. A silence
 * that is not one of them (a 2.5-beat gap, a 27-tick tie artefact) is left
 * unwritten rather than approximated, so a painted rest never lies about the
 * duration it covers. 64th = 3 ticks, 32nd = 6, 16th = 12 … whole = 192.
 */
const REST_STANDARD_VALUES: readonly number[] = [3, 6, 12, 24, 48, 96, 192];

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
      /**
       * Round 21 **filled calligraphic outline**: a closed cubic contour with
       * variable width — the only primitive that can carry the measured
       * contrast of the classical rest cuts (the serpentine's thick belly and
       * hairline neck, the hooked wedge). Weighed by area, exactly like a
       * closed `poly`.
       */
      kind: 'path';
      cls: string;
      start: JankoInkPoint;
      segments: ReadonlyArray<readonly [JankoInkPoint, JankoInkPoint, JankoInkPoint]>;
      close: boolean;
      stroke: number | null;
      fill: string | null;
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

/** Sample one filled cubic path (`'path'` ink) into a closed polygon. */
function samplePath(item: {
  start: JankoInkPoint;
  segments: ReadonlyArray<readonly [JankoInkPoint, JankoInkPoint, JankoInkPoint]>;
  close: boolean;
}): JankoInkPoint[] {
  const pts: JankoInkPoint[] = [item.start];
  let cursor = item.start;
  for (const [c1, c2, end] of item.segments) {
    pts.push(...sampleCubic(cursor, c1, c2, end, CURVE_SAMPLES));
    cursor = end;
  }
  if (
    item.close &&
    pts.length > 1 &&
    Math.abs(pts[0].x - pts[pts.length - 1].x) < 1e-9 &&
    Math.abs(pts[0].y - pts[pts.length - 1].y) < 1e-9
  ) {
    // Only a contour that literally returns to its start (the spine cut) closes
    // with a duplicate point; a traced lobe is closed by the implicit `Z` edge,
    // and dropping its last point would weigh a different polygon than the one
    // the renderer paints.
    pts.pop();
  }
  return pts;
}

/** Length-weighted centroid of one sampled polyline. */function polylineCentroid(pts: readonly JankoInkPoint[]): {
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
      case 'path': {
        const sampled = samplePath(item);
        if (item.fill !== null && item.fill !== 'none') {
          const { centroid, area } = polygonCentroid(sampled);
          add(centroid, area);
        }
        if (item.stroke !== null) {
          const { centroid, length } = polylineCentroid(sampled);
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
      case 'path': {
        const pts: JankoInkPoint[] = [item.start];
        let cursor = item.start;
        for (const [c1, c2, end] of item.segments) {
          pts.push(...sampleCubic(cursor, c1, c2, end, CURVE_SAMPLES));
          cursor = end;
        }
        const [mnX, mnY, mxX, mxY] = bbox(pts);
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
    case 'path': {
      const d =
        `M ${f(item.start.x)} ${f(item.start.y)} ` +
        item.segments
          .map(
            ([c1, c2, end]) =>
              `C ${f(c1.x)} ${f(c1.y)} ${f(c2.x)} ${f(c2.y)} ${f(end.x)} ${f(end.y)}`
          )
          .join(' ') +
        (item.close ? ' Z' : '');
      const fill = item.fill ?? 'none';
      const stroke = item.stroke === null ? 'none' : '#111111';
      const width = item.stroke === null ? '' : ` stroke-width="${item.stroke.toFixed(2)}"`;
      return (
        `    <path class="${item.cls}" d="${d}" fill="${fill}" stroke="${stroke}"${width} ` +
        `stroke-linecap="butt" stroke-linejoin="miter"${attrs}/>`
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

// ---------------------------------------------------------------------------
// Round 21 §B — the measured cut
//
// Every number below is the §A measurement through `u(...)`. The two golden
// calligraphic glyphs (the serpentine quarter and the hooked rests) are **one
// closed filled contour each**, because the classical cut's whole character is
// its contrast — a monoline stroke can only ever draw the lightning bolt the
// operator rejected.
// ---------------------------------------------------------------------------

/** Squared distance helper for the spine offsetter. */
function norm(dx: number, dy: number): { x: number; y: number } {
  const l = Math.hypot(dx, dy);
  return l > 1e-9 ? { x: dx / l, y: dy / l } : { x: 0, y: 0 };
}

/**
 * **Spine → outline**: turn a centreline with a per-point width into the closed
 * cubic contour of the inked stroke (left flank forward, right flank back).
 *
 * This is the whole cut for the serpentine quarter: the mid-line and the width
 * profile are the measured ones, so the contrast (hairline neck at 28.8u,
 * 165u belly at the p90 run) is reproduced rather than drawn by eye. The flanks
 * are emitted as smooth cubics through the offset points, Catmull-Rom style, so
 * the contour has no visible faceting.
 */
function spineOutline(
  pts: readonly JankoInkPoint[],
  widths: readonly number[]
): { start: JankoInkPoint; segments: Array<[JankoInkPoint, JankoInkPoint, JankoInkPoint]> } {
  const n = pts.length;
  const dirs: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    dirs.push(norm(b.x - a.x, b.y - a.y));
  }
  const left: JankoInkPoint[] = [];
  const right: JankoInkPoint[] = [];
  for (let i = 0; i < n; i++) {
    const nx = -dirs[i].y;
    const ny = dirs[i].x;
    const h = widths[i] / 2;
    left.push({ x: pts[i].x + nx * h, y: pts[i].y + ny * h });
    right.push({ x: pts[i].x - nx * h, y: pts[i].y - ny * h });
  }
  return smoothRing([...left, ...right.slice().reverse()]);
}

/**
 * **Closed Catmull-Rom ring → cubic contour.** The one smoother every filled
 * cut shares, so a traced measured outline, a spine/width stroke and a lobe all
 * come out as the same primitive with the same look.
 */
function smoothRing(ring: readonly JankoInkPoint[]): {
  start: JankoInkPoint;
  segments: Array<[JankoInkPoint, JankoInkPoint, JankoInkPoint]>;
} {
  const m = ring.length;
  const at = (i: number): JankoInkPoint => ring[((i % m) + m) % m];
  const segments: Array<[JankoInkPoint, JankoInkPoint, JankoInkPoint]> = [];
  for (let i = 0; i < m; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    segments.push([
      { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 },
      { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 },
      p2,
    ]);
  }
  return { start: at(0), segments };
}

/** One filled closed contour primitive. */
function filledPath(
  cls: string,
  outline: { start: JankoInkPoint; segments: Array<[JankoInkPoint, JankoInkPoint, JankoInkPoint]> },
  attrs = ''
): JankoRestInk {
  return {
    kind: 'path',
    cls,
    start: outline.start,
    segments: outline.segments,
    close: true,
    stroke: null,
    fill: '#111111',
    attrs,
  };
}

/**
 * The **measured serpentine quarter**: the reference contour itself
 * (`restQuarter` U+E4E5, one closed contour), traced with fontTools and
 * resampled by arc length to 44 points in units relative to the glyph's bbox
 * centre. The cut is the measurement — the calligraphic contrast (hairline neck
 * 28.8u, 165u p90 belly), the two tapered hooks, the three crossings and the
 * blob's white counter are all in the contour, so the monoline lightning
 * polyline of Round 20 has nothing left to say.
 *
 * Sampled extremes: x ∈ [−134.5, 128.4]u against the reference [−134.5, 134.5]u,
 * y ∈ [−373.9, 366.4]u against [−374.0, 374.0]u (resampling residual ≤ 2%).
 */
export const QUARTER_CONTOUR: ReadonlyArray<readonly [number, number]> = [
  [-57.5, -37.0],
  [-29.7, -73.9],
  [-9.0, -114.2],
  [-52.4, -114.0],
  [-95.3, -128.9],
  [-124.2, -164.4],
  [-134.5, -209.1],
  [-123.9, -253.6],
  [-98.4, -292.0],
  [-66.3, -325.3],
  [-31.1, -355.2],
  [9.8, -373.9],
  [12.6, -340.7],
  [-15.8, -306.8],
  [-20.5, -261.3],
  [-2.6, -219.3],
  [38.5, -202.0],
  [84.2, -208.0],
  [128.4, -221.0],
  [116.9, -184.0],
  [87.7, -148.1],
  [59.6, -111.5],
  [37.6, -70.9],
  [28.6, -25.8],
  [33.9, 20.0],
  [49.9, 63.3],
  [72.7, 103.5],
  [97.3, 142.6],
  [85.8, 184.5],
  [56.0, 219.8],
  [26.2, 255.1],
  [-3.8, 290.3],
  [-33.8, 325.5],
  [-64.2, 360.3],
  [-103.4, 366.4],
  [-94.7, 324.5],
  [-67.8, 286.9],
  [-48.9, 244.9],
  [-42.6, 199.3],
  [-51.3, 154.1],
  [-72.4, 113.1],
  [-101.4, 77.2],
  [-114.3, 35.7],
  [-86.7, -1.2],
];

/**
 * Number of sampled points on the measured serpentine contour — the cut's own
 * arity, and the pin a future re-trace would have to restate.
 */
export const QUARTER_CONTOUR_POINTS = QUARTER_CONTOUR.length;

/** The measured serpentine, drawn about `o`. */
function serpentine(o: JankoInkPoint, cls = 'janko-rest-lightning'): JankoRestInk {
  const ring = QUARTER_CONTOUR.map(([x, y]) => ({ x: o.x + u(x), y: o.y + u(y) }));
  return filledPath(cls, smoothRing(ring));
}

/**
 * One measured hooked cut (Bravura units → pt through {@link u}).
 *
 * `foot` / `shoulder` / `tip` are the **measured stem spine**: the reference
 * stem is a straight slanted band from the foot to the shoulder and then a
 * rightward curl to the tip (the classical hook), so it is tabulated as three
 * measured anchors per value, never fitted. `lobe0Y` is the measured top-lobe
 * centre (`H/2 − 50u` on every value), and the lobe pitch is the measured 249u.
 */
interface JankoHookedCut {
  width: number;
  height: number;
  foot: JankoInkPoint;
  shoulder: JankoInkPoint;
  tipInset: number;
}

/** Measured stem anchors, relative to the glyph's bbox centre, in units. */
const HOOKED_CUTS: Readonly<Record<string, JankoHookedCut>> = {
  eighth: {
    width: REST_EIGHTH_WIDTH,
    height: REST_EIGHTH_HEIGHT,
    foot: { x: u(-22.5), y: -REST_EIGHTH_HEIGHT / 2 },
    shoulder: { x: u(68.7), y: u(85.0) },
    tipInset: REST_STEM_TIP_INSET,
  },
  sixteenth: {
    width: REST_SIXTEENTH_WIDTH,
    height: REST_SIXTEENTH_HEIGHT,
    foot: { x: u(-64.7), y: -REST_SIXTEENTH_HEIGHT / 2 },
    shoulder: { x: u(103.4), y: u(203.7) },
    tipInset: REST_STEM_TIP_INSET,
  },
  'thirty-second': {
    width: REST_THIRTY_SECOND_WIDTH,
    height: REST_THIRTY_SECOND_HEIGHT,
    foot: { x: u(-52.6), y: -REST_THIRTY_SECOND_HEIGHT / 2 },
    shoulder: { x: u(127.5), y: u(324.1) },
    tipInset: REST_STEM_TIP_INSET,
  },
  'sixty-fourth': {
    width: REST_SIXTY_FOURTH_WIDTH,
    height: REST_SIXTY_FOURTH_HEIGHT,
    foot: { x: u(-91.7), y: -REST_SIXTY_FOURTH_HEIGHT / 2 },
    shoulder: { x: u(156.0), y: u(443.6) },
    tipInset: REST_STEM_TIP_INSET,
  },
};

/** Cubic through `a` → `b` with the two control points pulled toward `c`. */
function bend(
  a: JankoInkPoint,
  b: JankoInkPoint,
  c: JankoInkPoint
): [JankoInkPoint, JankoInkPoint] {
  return [
    { x: a.x + (c.x - a.x) * 0.55, y: a.y + (c.y - a.y) * 0.55 },
    { x: b.x + (c.x - b.x) * 0.18, y: b.y + (c.y - b.y) * 0.18 },
  ];
}

/**
 * **The measured hooked rest** (8th / 16th / 32nd / 64th): filled calligraphic
 * contours, never a monoline stick with an oval pushed onto its end.
 *
 * The cut is the reference's own construction: a **tapered wedge stem** that
 * runs from the glyph's foot to the measured shoulder and curls right to a
 * point at the glyph's top-right, and `marks` **lobes** grown out of the stem's
 * left flank at the measured 249u pitch. Each lobe's contour starts and ends
 * **on the stem's own spine**, so lobe and stem are one seamless form by
 * construction — the hook is grown from the stem.
 *
 * Measured laws (Bravura): lobe 130 × 100u, first lobe crown on the glyph's
 * top edge, lobe left edge on the glyph's left edge, stem 65u at the foot →
 * 46u at the shoulder → a point at the tip, tip 22u below the top edge.
 */
function hookedRest(
  o: JankoInkPoint,
  value: JankoRestValue,
  cls: { stem: string; lobe: string },
  hookAttrs?: (index: number) => string
): JankoRestInk[] {
  const cut = HOOKED_CUTS[value];
  const marks = REST_MARK_COUNT[value];
  const w2 = cut.width / 2;
  const h2 = cut.height / 2;
  const tip = { x: w2, y: h2 - cut.tipInset };
  const foot = cut.foot;
  const shoulder = cut.shoulder;
  const at = (p: JankoInkPoint): JankoInkPoint => ({ x: o.x + p.x, y: o.y + p.y });
  const out: JankoRestInk[] = [];
  // --- the stem: straight measured band from the foot to the shoulder, then
  //     the measured curl to the tip, tapering to a point.
  const [c1, c2] = bend(at(shoulder), at(tip), {
    x: o.x + shoulder.x * 0.72,
    y: o.y + (tip.y + shoulder.y) / 2,
  });
  const spinePts: JankoInkPoint[] = [];
  const spineWidths: number[] = [];
  const STRAIGHT = 6;
  for (let i = 0; i <= STRAIGHT; i++) {
    const t = i / STRAIGHT;
    spinePts.push(at({ x: foot.x + (shoulder.x - foot.x) * t, y: foot.y + (shoulder.y - foot.y) * t }));
    spineWidths.push(
      REST_STEM_FOOT_WIDTH + (REST_STEM_TIP_WIDTH - REST_STEM_FOOT_WIDTH) * t
    );
  }
  const CURL = 6;
  let cursor = at(shoulder);
  for (let i = 1; i <= CURL; i++) {
    const t = i / CURL;
    const u1 = 1 - t;
    const px =
      u1 * u1 * u1 * cursor.x + 3 * u1 * u1 * t * c1.x + 3 * u1 * t * t * c2.x + t * t * t * at(tip).x;
    const py =
      u1 * u1 * u1 * cursor.y + 3 * u1 * u1 * t * c1.y + 3 * u1 * t * t * c2.y + t * t * t * at(tip).y;
    spinePts.push({ x: px, y: py });
    spineWidths.push(Math.max(0, REST_STEM_TIP_WIDTH * (1 - t) ** 1.2));
    cursor = { x: px, y: py };
  }
  out.push(filledPath(cls.stem, spineOutline(spinePts, spineWidths)));
  // --- the lobes, top first, at the measured pitch. Each is a teardrop whose
  //     left extreme is the glyph's left edge and whose neck lands on the stem
  //     spine, so the union reads as one grown form.
  const rx = REST_LOBE_RADIUS;
  const ry = REST_LOBE_RY;
  for (let i = 1; i <= marks; i++) {
    const cy = h2 - REST_LOBE_TOP_INSET - (i - 1) * REST_LOBE_PITCH - ry;
    const cx = -w2 + rx;
    // The stem spine's x at the neck heights: solve the same piecewise spine.
    const neckY = (t: number): number => cy + ry * t;
    const neckX = (y: number): number => {
      const span = shoulder.y - foot.y;
      if (span > 0 && y <= shoulder.y) {
        const t = (y - foot.y) / span;
        return foot.x + (shoulder.x - foot.x) * t;
      }
      // On the curl: walk the sampled spine to the nearest point.
      let best = tip.x;
      let bestD = Infinity;
      for (let k = 0; k < spinePts.length; k++) {
        const d = Math.abs(spinePts[k].y - o.y - y);
        if (d < bestD) {
          bestD = d;
          best = spinePts[k].x - o.x;
        }
      }
      return best;
    };
    const k = 0.5523;
    const top = at({ x: neckX(neckY(0.86)), y: neckY(0.86) });
    const bot = at({ x: neckX(neckY(-0.86)), y: neckY(-0.86) });
    const c = at({ x: cx, y: cy });
    out.push(
      filledPath(
        cls.lobe,
        {
          start: top,
          segments: [
            [
              { x: c.x + rx * 0.35, y: c.y + ry },
              { x: c.x - rx * 0.72, y: c.y + ry },
              { x: c.x - rx, y: c.y },
            ],
            [
              { x: c.x - rx, y: c.y - ry * k },
              { x: c.x - rx * k, y: c.y - ry },
              { x: c.x, y: c.y - ry },
            ],
            [
              { x: c.x + rx * k, y: c.y - ry },
              { x: c.x + rx, y: c.y - ry * k },
              { x: c.x + rx, y: c.y },
            ],
            [
              { x: c.x + rx, y: c.y + ry * 0.55 },
              { x: c.x + rx * 0.4, y: c.y + ry * 0.9 },
              bot,
            ],
          ] as Array<[JankoInkPoint, JankoInkPoint, JankoInkPoint]>,
        },
        hookAttrs ? hookAttrs(i) : ''
      )
    );
  }
  return out;
}

/** The golden `'kinetic-monoline'` cut: the measured classical cut, Round 21. */
function kineticInk(o: JankoInkPoint, value: JankoRestValue, t: ResolvedJankoTokens): JankoRestInk[] {
  void t;
  if (isBarRestValue(value)) {
    // Wide solid slab: the half sits atop its seat line, the whole hangs below.
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
  if (value === 'quarter') return [serpentine(o)];
  return hookedRest(o, value, { stem: 'janko-rest-stem', lobe: 'janko-rest-hook' }, (i) => {
    return ` data-rest-hook="${i}"`;
  });
}

/**
 * Round 22: one transcribed Bravura contour as a filled `path` primitive.
 * The constants carry every contour point; this only translates by the draw
 * origin — no measurement, no re-authorship. All five hooked/serpentine
 * rests are single-contour solids, so one item each; the centroid/box
 * machinery weighs exactly this paint.
 */
function verbatimRestGlyph(o: JankoInkPoint, value: JankoRestValue): JankoRestInk {
  // Bars return early in `urtextInk`, so the key always names a hooked value.
  const g = URTEXT_RESTS[value as keyof typeof URTEXT_RESTS];
  const c = g.contours[0];
  const pt = (p: readonly [number, number]): JankoInkPoint => ({
    x: o.x + p[0] * REST_SCALE,
    y: o.y + p[1] * REST_SCALE,
  });
  return {
    kind: 'path',
    cls: 'janko-rest-verbatim',
    start: pt(c.start),
    segments: c.segments.map(
      ([a, b, e]) => [pt(a), pt(b), pt(e)] as [JankoInkPoint, JankoInkPoint, JankoInkPoint]
    ),
    close: true,
    stroke: null,
    fill: REST_INK,
    attrs: ` data-verbatim-rest="${value}"`,
  };
}

/** The `'classical-urtext'` cut: Bravura outlines transcribed verbatim. */
function urtextInk(o: JankoInkPoint, value: JankoRestValue, t: ResolvedJankoTokens): JankoRestInk[] {
  void t;
  if (isBarRestValue(value)) {
    // The authentic half rest **sits on** its line, the whole rest hangs below.
    // Scaled about the origin: the contact edge stays exactly on it.
    const w = REST_BLOCK_WIDTH * REST_SCALE;
    const h = REST_BLOCK_HEIGHT * REST_SCALE;
    return [
      {
        kind: 'rect',
        cls: 'janko-rest-block',
        x: o.x - w / 2,
        y: value === 'half' ? o.y - h : o.y,
        w,
        h,
        stroke: null,
        fill: REST_INK,
      },
    ];
  }
  return [verbatimRestGlyph(o, value)];
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
  // Round 21: the phantom dialect grows one ray-flag per marked value, so the
  // whole working set (8th … 64th) is stated in every dialect.
  const flags = REST_MARK_COUNT[value];
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
  // Round 21: `REST_MARK_COUNT` rays, alternating sides about the node, so the
  // demonstrator states 8th (1) … 64th (4) in its own diamond-and-ray language.
  const rays = REST_MARK_COUNT[value];
  for (let i = 0; i < rays; i++) {
    const s: -1 | 1 = i % 2 === 0 ? -1 : 1;
    const tilt = REST_NODE_HOLLOW_HALF * (1 - i);
    out.push({
      kind: 'line',
      cls: 'janko-rest-ray',
      a: { x: o.x + s * (REST_NODE_HOLLOW_HALF + REST_RAY_GAP), y: o.y + tilt },
      b: { x: o.x + s * REST_RAY_REACH, y: o.y + tilt },
      width: REST_STROKE,
      cap: 'butt',
    });
  }
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
  // Round 21: `REST_MARK_COUNT` wings, alternating sides, so the demonstrator
  // states 8th (1) … 64th (4) in its slash-and-wing language.
  const wings = REST_MARK_COUNT[value];
  for (let i = 0; i < wings; i++) {
    const s = i % 2 === 0 ? -1 : 1;
    out.push(
      beveledSlash(
        { x: o.x + s * REST_WING_OFFSET, y: o.y + REST_SLASH_HALF * 0.5 * (1 - i) },
        REST_SLASH_HALF * 0.6,
        'janko-rest-wing'
      )
    );
  }
  return out;
}

/**
 * Round 21 §E: the **beam level** a mark count stands for. Kept here beside the
 * duration grammar so the rest cut and the beam cut read the same table.
 */
export function beamLevelOf(marks: number): number {
  return Math.max(1, marks);
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
  const key = `${value}|${style}|${t.flagSpacing}`;
  const hit = centroidCache.get(key);
  if (hit) return hit;
  const offset = centroidOfInk(restInk({ x: 0, y: 0 }, value, style, t));
  centroidCache.set(key, offset);
  return offset;
}

/**
 * The glyph's **relative ink box**: {@link extentsOfInk} of the glyph drawn at
 * the origin, so an absolute box is one translation away. Cached with the
 * centroid — Round 21's calligraphic cuts carry hundreds of sampled contour
 * points, and the seat solver asks for the same shape many times per layout.
 */
const RELATIVE_BOX_CACHE = new Map<string, { x0: number; y0: number; x1: number; y1: number }>();
/** Centroid cache, keyed by value, dialect and the only token the ink reads. */
const centroidCache = new Map<string, JankoInkPoint>();

function relativeRestInkBox(
  value: JankoRestValue,
  style: JankoRestStyle,
  t: ResolvedJankoTokens
): { x0: number; y0: number; x1: number; y1: number } {
  const key = `${value}|${style}|${t.flagSpacing}`;
  const hit = RELATIVE_BOX_CACHE.get(key);
  if (hit) return hit;
  const box = extentsOfInk(restInk({ x: 0, y: 0 }, value, style, t));
  RELATIVE_BOX_CACHE.set(key, box);
  return box;
}

/**
 * The glyph's draw origin for a rest whose seat point is `(rest.x, rest.y)`.
 *
 * - A **hanging glyph** (64th … quarter) is seated by its **ink centroid**: the
 *   origin is shifted so the painted centroid lands exactly on the seat point.
 * - A **bar form** (half / whole) is seated by its **contact edge**, because
 *   Round 21 §C seats it on a *drawn staff rule*: the dialect painters already
 *   draw the half slab with its bottom edge on the origin and the whole slab
 *   with its top edge on it, so the origin **is** the contact line and no
 *   centroid shift may be applied.
 */
export function restGlyphOrigin(
  rest: JankoRestGeometry,
  tokens?: Partial<JankoTokens> | null
): JankoInkPoint {
  if (isBarRestValue(rest.value)) return { x: rest.x, y: rest.y };
  const c = restInkCentroidOffset(rest.value, rest.style, tokens);
  return { x: rest.x - c.x, y: rest.y - c.y };
}

/**
 * Offset (pt) of the seat point from the phrase row, per value.
 *
 * Round 21 §C: **zero for every value**. A hanging glyph's seat point *is* its
 * phrase row (the centroid stands on it), and a bar form's seat point is the
 * drawn staff rule it touches — not a row at all — so nothing is carried here
 * any more. The function survives as the recorded statement of that fact and as
 * the single place a future value could declare a seat offset.
 */
export function restSeatOffsetY(
  value: JankoRestValue,
  style: JankoRestStyle,
  tokens?: Partial<JankoTokens> | null
): number {
  void value;
  void style;
  void tokens;
  return 0;
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
  const rel = relativeRestInkBox(rest.value, rest.style, t);
  return { x0: rel.x0 + o.x, y0: rel.y0 + o.y, x1: rel.x1 + o.x, y1: rel.y1 + o.y };
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
