/**
 * Pluggable rhythm renderers for the Jánko Two-Row staff.
 *
 * Three engraving dialects are provided, selectable through
 * `JankoLayoutOptions.rhythmStyle`:
 *
 * - `angled-cuts`      — 35° slash cuts on the stem (default, Jánko dialect)
 * - `horizontal-ticks` — neutral horizontal duration ticks (unified lattice)
 * - `beamed`           — traditional connected beams inside each beat, with
 *                        pluggable subdivision marks (Round 7) for solitary /
 *                        unbeamed notes
 *
 * Duration mapping (48 ticks per quarter note):
 *   12 ticks = 16th (two cuts / two ticks / two flags), 24 = 8th (one),
 *   36 = dotted 8th (one + augmentation dot), 48 = quarter (bare stem).
 *
 * Every stem is engraved on the notehead's vertical centreline
 * (`stemX === note.x`), so a duration indicator always starts exactly on the
 * note column regardless of hand. Round 16 shares one stem per same-duration
 * stack on the nominal column (standard chord rule) and requires stacked
 * voices of mixed durations to coincide there — the Round 15 anti-fusion
 * stagger is deleted, and two stems of one onset column at different x are a
 * `split-stack-stems` violation.
 */

import { Hand } from '../../../model/types';
import {
  JankoBracketDurationGrammar,
  JankoClaspDotNudge,
  JankoClaspDurationStyle,
  JankoClusterSpacing,
  JankoDurationGrammar,
  JankoLayoutOptions,
  JankoLongDurationStyle,
  JankoRhythmStyle,
  JankoSubdivisionStyle,
  JankoTokens,
  ResolvedJankoTokens,
  getClusterSpacingPreset,
  isResolvedJankoTokens,
  resolveJankoOptions,
  resolveJankoTokens,
} from '../types';
import { analyzeNotatedDuration, durationDotCount, durationFlagCount, durationRingCount } from './duration';
import { JANKO_HALO_STROKE_WIDTH, isPositionOfHonor, getKnockoutMetrics } from './notehead';
import { f } from './style';
import { URTEXT_FLAGS_DOWN, URTEXT_FLAGS_UP } from './urtext-paths';
import { soloRhythmPaint } from '../solo-scene';
import { chordBridgesSvg, placedChordBridges, placedClaspShell, claspShellSvg } from '../connective-scene';
import type { PlacedClaspShell } from '../connective-scene';

/** One note as seen by the rhythm renderers (already positioned in page pt). */
export interface JankoRhythmNote {
  id: string;
  /** Absolute score tick. */
  startTick: number;
  durationTicks: number;
  hand: Hand;
  /** Notehead centre x. */
  x: number;
  /** Notehead centre y. */
  y: number;
  /**
   * Round 17: page x of this note's **augmentation dot**, hugging its mask's
   * top-right corner (`note.x + wx + augmentationDotGap`). Resolved by the
   * engine, which knows the active cluster-spacing preset; the rhythm
   * renderers only paint it. Callers that build a rhythm note by hand fall
   * back to the golden `note.x + wx + augmentationDotGap`.
   */
  dotX?: number;
  /**
   * Page y of this note's **augmentation dot**: the hug lane above the head
   * (see `JankoTokens.augmentationDotRowOffset`), or the high lane when a
   * same-row neighbour sits inside the mask band. Resolved by the engine,
   * which knows the staff rules the dot must clear; the rhythm renderers only
   * paint it.
   */
  dotY?: number;
  /**
   * Round 30: page x/y of this note's **second augmentation dot** (a
   * double-dotted value under the complete grammar). Resolved by the engine
   * further along the escape — right of the first dot first, then up — and
   * painted only when the active grammar reads two dots; absent otherwise.
   * Callers that build a rhythm note by hand fall back to the canonical
   * horizontal pair (`dotX + 2r + gap`, same height).
   */
  dot2X?: number;
  /**
   * Round 30: page y of this note's **second augmentation dot** (see
   * {@link JankoRhythmNote.dot2X}).
   */
  dot2Y?: number;
  /**
   * Round 17: distance (pt) from the notehead centre at which this note's stem
   * begins — flush on the mask edge (`hy + 0.2`) or on the halo ring
   * (`haloRadius + 0.4`) for a tick-0 honour sound. Resolved by the engine,
   * which knows the active cluster-spacing preset; callers that build a
   * rhythm note by hand fall back to the golden preset.
   */
  stemAttachR?: number;
}

/** Resolved stem geometry for one note. */
export interface JankoStemGeometry {
  /** Stem column: the notehead's vertical centreline (`stemX === note.x`). */
  stemX: number;
  stemStartY: number;
  stemEndY: number;
  /** -1 for RH (up), +1 for LH (down). */
  direction: -1 | 1;
}

/**
 * Voice-based stem direction: RH up (−1), LH down (+1).
 *
 * Round 11 pins this as the counterpoint rule that keeps a cross-hand
 * simultaneity legible: at Bach Var. 1 m. 31 tick 4344 the LH `2` (octave 4,
 * row 0) and the RH `b` (octave 4, row 1) sound on one beat column, and the
 * opposing directions send the two stems away from each other instead of into a
 * single dark vertical line.
 */
export function stemDirection(hand: Hand): -1 | 1 {
  return hand === 'RH' ? -1 : 1;
}

/** Air (pt) between the Position of Honor halo ring and its stem start. */
export const HONOR_STEM_ATTACHMENT_AIR = 0.4;

/**
 * Painted stem stroke width (pt). The stem-vs-digit audits measure from the
 * stem's ink edge, so they share this constant instead of restating it.
 */
export const JANKO_STEM_STROKE_WIDTH = 0.9;

/**
 * Canonical stem attachment radii (regular heads, tick-0 honor sounds).
 *
 * A regular stem starts outside the mask edge: the preset's
 * `hy + stemAttachmentAir` (`hy + 0.2` at the golden default). The layout
 * options select the preset, defaulting to golden.
 */
export function getStemAttachmentRadii(
  tokens?: Partial<JankoTokens> | null,
  layoutOptions?: Partial<JankoLayoutOptions> | null
): {
  regular: number;
  honor: number;
} {
  const t = resolveJankoTokens(tokens);
  const { hy } = getKnockoutMetrics(layoutOptions, tokens);
  return {
    regular: hy + t.stemAttachmentAir,
    honor: t.haloRadius + HONOR_STEM_ATTACHMENT_AIR,
  };
}

/**
 * Distance (pt) from the notehead centre at which its stem begins.
 *
 * A stem starts on the **outside** of its glyph: the wider Position of
 * Honor halo ring for the tick-0 opening sounds, the rectangular mask edge
 * (`hy + stemAttachmentAir`) otherwise. The stem can therefore never cut through the halo
 * ring, and it never emerges inside the mask where it would crowd the
 * duodecimal digit. The engine resolves the preset-correct radius onto every
 * rhythm note it positions; hand-built notes fall back to the golden preset.
 */
export function getStemAttachmentRadius(
  note: JankoRhythmNote,
  tokens?: Partial<JankoTokens> | null,
  layoutOptions?: Partial<JankoLayoutOptions> | null
): number {
  if (note.stemAttachR !== undefined) return note.stemAttachR;
  const radii = getStemAttachmentRadii(tokens, layoutOptions);
  return isPositionOfHonor(note.startTick) ? radii.honor : radii.regular;
}

/**
 * Pure stem geometry (RH stems up, LH stems down).
 *
 * The stem is engraved on the notehead's vertical centreline (`stemX = note.x`)
 * rather than on the round-notehead perimeter: duration indicators then begin
 * exactly on the note column for both hands, instead of staggering left of the
 * duodecimal digit for the LH and right of it for the RH.
 *
 * Vertically the stem starts at `note.y + dir * effectiveRadius` — flush on the
 * outer edge of the rectangular mask (or of the halo ring at tick 0) — and
 * runs to the canonical `stemLength` measured from the notehead centre, so the
 * visible stem stays substantial while never touching the glyph or the halo.
 */
export function getStemGeometry(
  note: JankoRhythmNote,
  tokens?: Partial<JankoTokens> | null
): JankoStemGeometry {
  const t = resolveJankoTokens(tokens);
  const dir = stemDirection(note.hand);
  const attachR = getStemAttachmentRadius(note, t);
  return {
    stemX: note.x,
    stemStartY: note.y + dir * attachR,
    stemEndY: note.y + dir * t.stemLength,
    direction: dir,
  };
}

/** Bare stem (shared by every rhythm style). */
export function renderStem(
  note: JankoRhythmNote,
  tokens?: Partial<JankoTokens> | null
): string {
  const s = getStemGeometry(note, tokens);
  return `    <line class="janko-stem" x1="${f(s.stemX)}" y1="${f(s.stemStartY)}" x2="${f(s.stemX)}" y2="${f(s.stemEndY)}" stroke="#111111" stroke-width="${JANKO_STEM_STROKE_WIDTH.toFixed(2)}"/>`;
}

/**
 * Augmentation dot for dotted durations (Round 17 hug fit).
 *
 * The dot is **always right of its own head**, for both hands, hugging the
 * mask's top-right corner (`note.dotX = note.x + wx + augmentationDotGap`,
 * `note.dotY` in the hug lane above the head — both resolved by the engine).
 * Falls back to the head row and the golden mask offset for callers that build
 * a `JankoRhythmNote` by hand.
 */
function renderAugmentationDot(note: JankoRhythmNote, tokens: ResolvedJankoTokens): string {
  const cx = note.dotX ?? note.x + getClusterSpacingPreset().wx + tokens.augmentationDotGap;
  const cy = note.dotY ?? note.y;
  return `    <circle class="janko-augmentation-dot" cx="${f(cx)}" cy="${f(cy)}" r="${f(tokens.augmentationDotRadius)}" fill="#111111"/>`;
}

/**
 * Jánko dialect: elegant angled 35° cuts.
 * 16th => two cuts, 8th => one cut, dotted 8th => one cut + dot.
 */
export function renderAngledCuts(
  note: JankoRhythmNote,
  tokens?: Partial<JankoTokens> | null
): string {
  const t = resolveJankoTokens(tokens);
  const s = getStemGeometry(note, t);
  const parts: string[] = [renderStem(note, t)];
  const slash = (cy: number): string =>
    `    <line class="janko-cut" x1="${f(s.stemX - t.slashDx)}" y1="${f(cy - t.slashDy)}" x2="${f(s.stemX + t.slashDx)}" y2="${f(cy + t.slashDy)}" stroke="#111111" stroke-width="1.15"/>`;

  const dur = note.durationTicks;
  if (dur <= 14) {
    parts.push(slash(s.stemEndY - s.direction * 2.2));
    parts.push(slash(s.stemEndY - s.direction * 5.6));
  } else if (dur <= 26) {
    parts.push(slash(s.stemEndY - s.direction * 3.5));
  } else if (dur <= 38) {
    parts.push(slash(s.stemEndY - s.direction * 3.5));
    parts.push(renderAugmentationDot(note, t));
  }
  return parts.join('\n');
}

/**
 * Unified continuous lattice: neutral horizontal ticks crossing the stem.
 * Same duration grammar as the angled dialect, zero calligraphic flourish.
 */
export function renderHorizontalTicks(
  note: JankoRhythmNote,
  tokens?: Partial<JankoTokens> | null
): string {
  const t = resolveJankoTokens(tokens);
  const s = getStemGeometry(note, t);
  const parts: string[] = [renderStem(note, t)];
  const half = t.slashDx + 0.6;
  const tick = (cy: number): string =>
    `    <line class="janko-tick" x1="${f(s.stemX - half)}" y1="${f(cy)}" x2="${f(s.stemX + half)}" y2="${f(cy)}" stroke="#111111" stroke-width="1.05"/>`;

  const dur = note.durationTicks;
  if (dur <= 14) {
    parts.push(tick(s.stemEndY - s.direction * 2.2));
    parts.push(tick(s.stemEndY - s.direction * 5.6));
  } else if (dur <= 26) {
    parts.push(tick(s.stemEndY - s.direction * 3.5));
  } else if (dur <= 38) {
    parts.push(tick(s.stemEndY - s.direction * 3.5));
    parts.push(renderAugmentationDot(note, t));
  }
  return parts.join('\n');
}

/** A straight connector in page pt coordinates. */
export interface JankoBeamConnector {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

// ---------------------------------------------------------------------------
// Round 7 — single-note subdivision grammar (kinetic tabs + urtext flag)
// ---------------------------------------------------------------------------

/** Thickness (pt) of the kinetic monoline tabs (`'kinetic-tab-30'`/`-45'`/`-beam'`). */
export const SUBDIVISION_TAB_THICKNESS = 1.1;
/** Root weight (pt) of the `'kinetic-tab-tapered'` demonstrator's cut. */
export const SUBDIVISION_TAPER_ROOT = 1.4;
/** Stroke weight (pt) of the slender `'classical-urtext'` cut. */
export const SUBDIVISION_URTEXT_STROKE = 0.9;

/**
 * Number of subdivision marks stacked at a stem tip: three for a 32nd, two for
 * a 16th, one for an 8th (dotted or plain) and none for a quarter or longer.
 * Stacks are spaced by `tokens.flagSpacing`, so every dialect stacks alike.
 *
 * Round 30: under the complete grammar the count derives from the NOTATED
 * base value (a double-dotted 16th carries two, a double-dotted 8th one);
 * out-of-grammar durations keep these legacy thresholds.
 */
export function subdivisionMarkCount(
  durationTicks: number,
  grammar: JankoDurationGrammar = 'golden'
): number {
  return durationFlagCount(durationTicks, grammar);
}

/**
 * Round 21 — the **beam level** of a duration: the number of beam strips the
 * note needs, counted from the primary connector outward. `level = f(duration)`
 * and nothing else, so the tertiary and quaternary levels are *data*, not a
 * forked code path — a 128th would only add a row to this function.
 *
 * The thresholds mirror {@link subdivisionMarkCount}, so a beamed note and a
 * flagged note of the same value can never disagree about how many marks they
 * carry: 8th = 1 (primary), 16th = 2, 32nd = 3, 64th = 4.
 *
 * Round 30: under the complete grammar the level derives from the NOTATED
 * base value (see {@link subdivisionMarkCount}).
 */
export function beamLevel(
  durationTicks: number,
  grammar: JankoDurationGrammar = 'golden'
): number {
  return Math.max(1, subdivisionMarkCount(durationTicks, grammar));
}

/**
 * Length (pt) of a **partial beam** (beamlet / stub): the LilyPond/Gould
 * fractional-beam length of about one staff space, taken here from the measured
 * flag reach (`flagWidth` = 1.056sp at the Round 21 scale), capped at the
 * distance to the neighbouring stem it points toward.
 */
export const BEAM_STUB_FALLBACK = 4.0;

/**
 * Round 20 — **the classical flag**.
 *
 * Every subdivision mark the renderer paints is one cut: the classical flag
 * hook (U+1D160-class taper). It leaves the stem at the style's root
 * thickness, sweeps right and down, and tapers to a point that curls back
 * toward the stem — the shape a burin actually cuts, not a straight tab. The
 * exploratory rake dialects (`'kinetic-tab-30'`/`-45'`/`-beam'`) and the
 * tapered/hairline cuts survive as **style keys** (they still tag their ink and
 * pick their root weight), so the recorded Round 7–9 axis is not erased from
 * the option surface, but the hook itself is the one classical curve. The
 * reach stays inside `flagWidth` and the drop inside `flagHeight`, so the
 * shared clearance audit covers every style without a per-style box.
 */
const SUBDIVISION_ROOT: Record<JankoSubdivisionStyle, number> = {
  'kinetic-tab-30': SUBDIVISION_TAB_THICKNESS,
  'kinetic-tab-45': SUBDIVISION_TAB_THICKNESS,
  'kinetic-tab-beam': SUBDIVISION_TAB_THICKNESS,
  'kinetic-tab-tapered': SUBDIVISION_TAPER_ROOT,
  'classical-urtext': SUBDIVISION_URTEXT_STROKE,
};

/**
 * The classical tapered hook, in page pt: a filled crescent from `stemX`/`cy`
 * toward `sign` (the stem's own sweep side), reaching at most `0.75 · w` right
 * of the stem and `h` along the drop.
 */
export function classicalFlagPath(
  stemX: number,
  cy: number,
  sign: number,
  w: number,
  h: number,
  root: number
): string {
  const r = root / (2 * h);
  const p = (dx: number, dy: number): string =>
    `${f(stemX + dx * w)} ${f(cy + sign * dy * h)}`;
  return (
    `M ${p(0, -r)} ` +
    `C ${p(0.5, 0.02 - r)} ${p(1.0, 0.46)} ${p(0.62, 0.88)} ` +
    `C ${p(0.4, 0.8)} ${p(0.16, 0.34)} ${p(0, r)} Z`
  );
}

/**
 * Paint one subdivision mark latched to a stem tip, in the active Round 7
 * dialect. `stemX`/`tipY` are the stem column and anchor, `direction` the stem
 * direction (−1 up, +1 down) and `index` the 1-based stack position: mark `k`
 * sits `(k − 1) · flagSpacing` further along the flag drop (`−direction`).
 *
 * **Kinetic direction.** The hook sweeps *with* the stem's motion: a lower stem
 * (going down from its note) draws its hook sweeping **upward**, an upper stem
 * (going up) sweeps it **downward** — the shared `sign = −direction` sweep.
 * Every style reaches at most `flagWidth` right of the stem and drops at most
 * `flagHeight`, so the shared `claspInkBox` audit covers all of them without a
 * per-style box.
 */
export function renderSubdivisionMark(
  stemX: number,
  tipY: number,
  direction: -1 | 1,
  index: number,
  style: JankoSubdivisionStyle,
  tokens?: Partial<JankoTokens> | null,
  cls = 'janko-flag'
): string {
  const t = resolveJankoTokens(tokens);
  const sign = -direction;
  const cy = tipY + sign * (index - 1) * t.flagSpacing;
  const w = t.flagWidth;
  const h = t.flagHeight;
  const head = `class="${cls}" data-stem-x="${f(stemX)}" data-flag-index="${index}"`;
  const tail = ` data-subdivision-style="${style}"`;
  const d = classicalFlagPath(stemX, cy, sign, w, h, SUBDIVISION_ROOT[style]);
  return `    <path ${head} d="${d}" fill="#111111" stroke="none"${tail}/>`;
}

export interface SubdivisionBBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Baked bounding box of a subdivision flag mark / glyph relative to the stem tip (stemX, tipY).
 * For `'classical-urtext'`, uses the baked SMuFL/Bravura verbatim glyph bbox.
 * For the crescent styles, uses the classicalFlagPath extents.
 */
export function getSubdivisionGlyphBBox(
  style: JankoSubdivisionStyle = 'classical-urtext',
  direction: -1 | 1 = -1,
  marks: number = 1,
  tokens?: Partial<JankoTokens> | null
): SubdivisionBBox {
  const t = resolveJankoTokens(tokens);
  if (style === 'classical-urtext') {
    const table = direction === -1 ? URTEXT_FLAGS_UP : URTEXT_FLAGS_DOWN;
    const g = table[Math.min(Math.max(marks, 1), 4) - 1];
    return {
      x0: g.bbox[0],
      y0: g.bbox[1],
      x1: g.bbox[2],
      y1: g.bbox[3],
    };
  }
  const w = t.flagWidth;
  const h = t.flagHeight;
  const root = SUBDIVISION_ROOT[style];
  const r = root / 2;
  const sign = -direction;
  if (sign === 1) {
    return {
      x0: 0,
      y0: -r,
      x1: w,
      y1: (marks - 1) * t.flagSpacing + 0.88 * h,
    };
  }
  return {
    x0: 0,
    y0: -(marks - 1) * t.flagSpacing - 0.88 * h,
    x1: w,
    y1: r,
  };
}

/**
 * Round 22: one transcribed Bravura flag glyph at the stem tip. Bravura nests
 * inner flags inside a single sweep with open counters, so one glyph per note
 * (selected by mark count and stem direction) — never a stack. The glyph
 * origin is the SMuFL stem-tip attach point, placed exactly on
 * (`stemX`, `tipY`); all contours share one path with `evenodd` counters.
 */
export function verbatimFlagPath(stemX: number, tipY: number, direction: -1 | 1, marks: number): string {
  const table = direction === -1 ? URTEXT_FLAGS_UP : URTEXT_FLAGS_DOWN;
  const g = table[Math.min(Math.max(marks, 1), 4) - 1];
  const p = (q: readonly [number, number]): string => `${f(stemX + q[0])} ${f(tipY + q[1])}`;
  const d = g.contours
    .map(
      (c) =>
        `M ${p(c.start)} ` +
        c.segments.map(([a, b, e]) => `C ${p(a)} ${p(b)} ${p(e)}`).join(' ') +
        ' Z'
    )
    .join(' ');
  return (
    `    <path class="janko-flag" data-stem-x="${f(stemX)}" data-flag-count="${marks}" ` +
    `d="${d}" fill="#111111" stroke="none" fill-rule="evenodd" data-subdivision-style="classical-urtext"/>`
  );
}

/**
 * Round 30: centres (page pt) of the open stem rings a lone long paints —
 * the standalone rings (`CLASP_RING_*`: R = 3.0pt, stroke 1.0pt, unchanged
 * by the bracket-circle scale), stem-mounted at the stem midpoint, two
 * stacked about it for a whole (`±(R + CLASP_MARK_STACK_GAP)`).
 * Empty under the golden grammar and for out-of-grammar durations. Shared by
 * the renderer and the linter's ring audit, so the audited centres can never
 * drift from the painted ink.
 */
export function stemRingCenters(
  note: JankoRhythmNote,
  tokens?: Partial<JankoTokens> | null,
  grammar: JankoDurationGrammar = 'golden'
): Array<{ x: number; y: number }> {
  const rings = durationRingCount(note.durationTicks, grammar);
  if (rings === 0) return [];
  const s = getStemGeometry(note, tokens);
  const midY = (s.stemStartY + s.stemEndY) / 2;
  if (rings === 1) return [{ x: s.stemX, y: midY }];
  const stack = CLASP_RING_RADIUS + CLASP_MARK_STACK_GAP;
  return [
    { x: s.stemX, y: midY - stack },
    { x: s.stemX, y: midY + stack },
  ];
}

/**
 * Solitary / unbeamed short note: bare stem plus duration ink plus the
 * augmentation dot for dotted values. Crescent dialects stack one mark per
 * subdivision at the stem tip within the tokenised reach; `'classical-urtext'`
 * paints one transcribed Bravura glyph per note (see `verbatimFlagPath`) at
 * the baked extents. Neither grammar crosses the stem.
 *
 * Round 30: under the complete grammar the flags derive from the NOTATED
 * base value, every dotted value dots (doubly dotted doubly), and lone
 * longs ring (see {@link durationDotCount}, {@link durationFlagCount},
 * {@link durationRingCount}). The golden grammar renders byte-identically to
 * before. A clasp member's kept stem is rendered with the golden grammar by
 * the engine — the bracket owns the member's duration — so this function
 * never suppresses member ink itself.
 */
export function renderFlags(
  note: JankoRhythmNote,
  tokens?: Partial<JankoTokens> | null,
  style: JankoSubdivisionStyle = 'classical-urtext',
  grammar: JankoDurationGrammar = 'golden'
): string {
  // Standalone/non-fixed adapter; fixed-core paint uses the stored scene.
  return soloRhythmPaint(note, resolveJankoTokens(tokens), style, grammar).map(p => p.svg).join('\n');
}

// ---------------------------------------------------------------------------
// Round 5 — the external left clasp: cluster bracket + duration carrier
// ---------------------------------------------------------------------------

/**
 * Round 11 light transverse duration ink (`elements/rhythm.renderClaspDurationInk`).
 * Every paradigm anchors on the spine's exact midpoint `yMid` and cuts
 * *symmetrically across* the spine with line-based marks, so the bracket stays
 * a mirror-symmetrical `[` whatever value it carries. Heavy solid beads and
 * solid diamond blocks are eliminated:
 *
 * - the bracket's **half / whole** mark is a clean open white circular ring
 *   (`R = 2.4pt`, stroke `0.8pt` at bracket-circle scale 0.80) whose interior
 *   knocks the spine out — zero crosshairs, under every paradigm;
 * - the **quarter** note is the continuous solid bracket `[` alone;
 * - a **dotted** value keeps that plain bracket and adds the 0.75pt dot;
 * - **subdivisions** explore light transverse line cuts across the spine:
 *   `'transverse-cross-bars'` draws horizontal rungs, `'kinetic-cross-slashes'`
 *   rakes them up at the score's own beam-harmonized 12.4°, `'down-raked-slashes'`
 *   mirrors that rake downward, and `'cross-hatch-stitches'` crosses both
 *   strokes into a symmetrical `×`. One cut carries an 8th, two parallel cuts
 *   carry a 16th.
 */
/** Width (pt) of a transverse line cut (cross-bar / slash / stitch). */
export const CLASP_TRANSVERSE_WIDTH = 7.5;
/** Stroke thickness (pt) of every Round 11 midpoint mark. */
export const CLASP_TRANSVERSE_STROKE = 1.0;
/** Vertical spacing (pt) between the two parallel bars/slashes of a 16th. */
export const CLASP_CROSS_SPACING = 2.5;
/** Standalone open stem ring of a lone half / whole (R = 3.0pt, stroke 1.0pt). Unchanged by the bracket-circle scale. */
export const CLASP_RING_RADIUS = 3.0;
export const CLASP_RING_STROKE = 1.0;
/**
 * Bracket-circle family scale (first operator-review value 0.80): the
 * bracket's own half/whole rings render at R = 2.4pt, stroke 0.8pt
 * (outer diameter 5.6pt), isolated from standalone stem rings, transverse
 * marks, pitch glyphs and the bracket spine. Single scale control; the
 * baked radius/stroke derive from it so render and geometry cannot drift.
 */
export const BRACKET_CIRCLE_SCALE = 0.8;
/** Rounded to 0.01pt so scaled geometry stays exact (no FP dust in SVG bytes). */
const bracketScale = (v: number): number => Math.round(v * BRACKET_CIRCLE_SCALE * 100) / 100;
export const BRACKET_RING_RADIUS = bracketScale(CLASP_RING_RADIUS);
export const BRACKET_RING_STROKE = bracketScale(CLASP_RING_STROKE);
/** Outer edge of a bracket ring (R + stroke/2 = 2.8pt at scale 0.80). */
export const BRACKET_RING_OUTER =
  Math.round((BRACKET_RING_RADIUS + BRACKET_RING_STROKE / 2) * 100) / 100;
/** Air (pt) between the two stacked marks of a doubled (whole / 16th) value. */
export const CLASP_MARK_STACK_GAP = 0.5;
/**
 * Fallback up-and-right offset (pt) of a dotted value's dot from the clasp
 * spine, used only by the degenerate empty-cluster case of
 * {@link claspDotCenter}; the painted dot is the resolved `durationDots` datum.
 */
export const CLASP_DOT_OFFSET = 3.2;
/**
 * Widest horizontal reach (pt) any Round 11 mark paints on either side of the
 * spine. The engine's downbeat-inset budget reserves it, so a transverse cut
 * can never be driven into the barline it follows.
 */
export const CLASP_MARK_REACH = CLASP_TRANSVERSE_WIDTH / 2;
/**
 * Plain note values (ticks) of the duration grammar: 16th … double whole. A
 * value of exactly 1.5× one of them is *dotted* and carries the shared
 * augmentation dot beside the spine (see {@link claspDurationDotted}).
 */
const CLASP_PLAIN_VALUES: readonly number[] = [12, 24, 48, 96, 192, 384];
/**
 * Minimum horizontal spread (pt) that makes an onset a *horizontally displaced*
 * cluster (Round 6). Heads that share one clean vertical column spread by 0pt
 * and the bracket exists solely to unify row-snapped heads.
 */
export const CLASP_MIN_HORIZONTAL_SPREAD = 1.0;
/**
 * Round 8 bracketing scope: a vertical hand chord of this many heads or more
 * also qualifies for a bracket (e.g. `B - 4 - 7`), while a clean 2-note column
 * stays unbracketed — proximity already communicates the grouping.
 */
export const CLASP_MIN_VERTICAL_CHORD = 3;

/**
 * Are two or more of these heads horizontally displaced by more than
 * {@link CLASP_MIN_HORIZONTAL_SPREAD}? A clean vertical column (and a lone
 * melodic note) is not.
 */
export function claspNotesHorizontallySpread(
  notes: readonly JankoRhythmNote[]
): boolean {
  if (notes.length < 2) return false;
  const xs = notes.map((n) => n.x);
  return Math.max(...xs) - Math.min(...xs) > CLASP_MIN_HORIZONTAL_SPREAD;
}

/**
 * Round 8 bracketing scope: does this hand's onset qualify for a bracket?
 *
 * - any horizontally spread cluster (≥ 2 heads displaced by the row-parity
 *   offset) **does** — the bracket exists to unify the displaced voices;
 * - any vertical chord of {@link CLASP_MIN_VERTICAL_CHORD} or more notes **does**
 *   — a three-voice column (like `B - 4 - 7`) reads as one sonority;
 * - a simple 2-note vertical stack **does not** — proximity already
 *   communicates the grouping, and a bracket there would only add ink.
 */
export function claspQualifies(
  notes: readonly JankoRhythmNote[],
  minVerticalChordSize: number = CLASP_MIN_VERTICAL_CHORD
): boolean {
  if (notes.length < 2) return false;
  return claspNotesHorizontallySpread(notes) || notes.length >= minVerticalChordSize;
}

/**
 * Duration grammar of a clasp — the value the bracket carries. Round 11 keeps
 * the Round 8 classes (they are *mark counts*, not a lopsided spire: the
 * bracket paints every duration at its own spine midpoint).
 *
 * | class               | value            | ink                                      |
 * | ------------------- | ---------------- | ---------------------------------------- |
 * | `'double-pip'`      | whole (≥ 192 t)  | two open knockout marks at the midpoint  |
 * | `'pip'`             | half (≥ 96 t)    | one open knockout mark at the midpoint   |
 * | `'spire'`           | quarter (≥ 39 t) | bare bracket (no duration mark)          |
 * | `'spire-one-flag'`  | 8th (15–38 t)    | one transverse mark                      |
 * | `'spire-two-flags'` | 16th (≤ 14 t)    | two parallel transverse marks            |
 *
 * The thresholds mirror the flag grammar of {@link renderFlags}, so a clasped
 * cluster and a flagged stem of the same value can never disagree.
 */
export type JankoClaspDuration =
  | 'double-pip'
  | 'pip'
  | 'spire'
  | 'spire-one-flag'
  | 'spire-two-flags';

/** Classify a duration into the clasp duration grammar (see {@link JankoClaspDuration}). */
export function claspDurationClass(durationTicks: number): JankoClaspDuration {
  if (durationTicks >= 192) return 'double-pip';
  if (durationTicks >= 96) return 'pip';
  if (durationTicks > 38) return 'spire';
  if (durationTicks > 14) return 'spire-one-flag';
  return 'spire-two-flags';
}

/**
 * The duration a bracket carries: the **mode** of its members' values, ties
 * broken toward the **longest**. The shortest member no longer dictates the
 * bracket's reading — members that differ from the carried value keep their
 * own exact duration statement (see the engine's exception suppression).
 * Deterministic: first-maximum wins under the (count, duration) order, so
 * the result depends only on the multiset of values, never their order.
 */
export function bracketModeDuration(durations: readonly number[]): number {
  const counts = new Map<number, number>();
  for (const d of durations) counts.set(d, (counts.get(d) ?? 0) + 1);
  let best = durations[0];
  for (const d of durations) {
    const c = counts.get(d)!;
    const b = counts.get(best)!;
    if (c > b || (c === b && d > best)) best = d;
  }
  return best;
}

/**
 * Is a clasp's carried value **dotted** — exactly 1.5× a plain note value?
 * (72 = dotted quarter, 36 = dotted 8th, 144 = dotted half …). A dotted value
 * keeps its plain paradigm's midpoint ink and adds the canonical
 * {@link JankoTokens.augmentationDotRadius} dot beside the spine, so a dotted
 * quarter reads as "plain bracket + dot" under every Round 11 paradigm.
 */
export function claspDurationDotted(durationTicks: number): boolean {
  const plain = durationTicks / 1.5;
  return Number.isInteger(plain) && CLASP_PLAIN_VALUES.includes(plain);
}

/**
 * Round 42 (Phase 3 study) — the **compact** duration-mark reading of one
 * notated value, the study's proposed vocabulary.
 *
 * | plain value       | ticks | compact ink                          |
 * | ----------------- | ----- | ------------------------------------ |
 * | 64th              | 3     | 4 cuts                               |
 * | 32nd              | 6     | 3 cuts                               |
 * | 16th              | 12    | 2 cuts                               |
 * | 8th               | 24    | 1 cut                                |
 * | quarter           | 48    | bare (no mark)                       |
 * | half              | 96    | 1 ring                               |
 * | whole             | 192   | 2 rings                              |
 * | double-whole      | 384   | 3 rings                              |
 *
 * Dots read exactly from {@link analyzeNotatedDuration} (single/double), shared
 * across the vocabularies. A value with no exact plain/dotted/double-dotted
 * reading (a tie, tuplet or MIDI hold) cannot be stated in this alphabet and
 * reports `inGrammar: false` with **zero** marks — it is never rounded into a
 * neighbouring value. Experimental candidate vocabulary, never canonical.
 */
export interface CompactDurationMarks {
  /** Short transverse cuts along the carrier (0–4). */
  cuts: number;
  /** Elongation ring marks along the mount (0–3; Round 46 midpoint: 0–2). */
  rings: number;
  /**
   * Round 46 (midpoint family): the single ring mark of this run is a
   * **half-ring** (96 ticks = one half of a full 192-tick ring). Always false
   * for the compact family and for every multi-ring run.
   */
  halfRing: boolean;
  /** Augmentation dots (shared with every vocabulary). */
  dots: 0 | 1 | 2;
  /** False when the value has no exact plain/dotted/double-dotted reading. */
  inGrammar: boolean;
  /**
   * Round 47: the analysed **base value** of the reading (`0` when out of
   * grammar) — `3 / 6 / 12 / 24 / 48 / 96 / 192 / 384`. The long-value family
   * of one mark is selected from this base, never from the dotted total, so a
   * dotted half states the half's symbol plus its own dot.
   */
  base: number;
}

/**
 * Read one duration in a mark vocabulary (see {@link CompactDurationMarks}).
 *
 * Round 46 splits the two long-value readings:
 *
 * - `'compact'` (the Round 42 study family, and the default so every
 *   pre-Round-46 pin keeps its exact numbers): `96 → 1 ring`, `192 → 2 rings`,
 *   `384 → 3 rings`.
 * - `'midpoint'` (the active family on the Round 46 Brahms Reference and its
 *   candidates): `96 → half-ring`, `192 → one full ring`, `384 → two full
 *   rings` — the mnemonic is exact (one ring = one whole = 192, half ring =
 *   half of it, two rings = breve) and **three-ring stacks no longer exist in
 *   the active family**. Dots and cuts are unchanged, and `48` stays bare.
 */
export function compactDurationMarks(
  durationTicks: number,
  grammar: JankoBracketDurationGrammar = 'compact',
  longStyle: JankoLongDurationStyle = 'midpoint'
): CompactDurationMarks {
  const { base, dots, inGrammar } = analyzeNotatedDuration(durationTicks);
  const long =
    grammar === 'midpoint'
      ? longStyle === 'open-oval'
        ? // Round 47 `'open-oval'`: one mark per long value — the oval carries
          // the value, the breve's flanks are that oval's own decoration, so a
          // three-mark stack cannot exist.
          { 96: { rings: 1, halfRing: false }, 192: { rings: 1, halfRing: false }, 384: { rings: 1, halfRing: false } }
        : { 96: { rings: 1, halfRing: true }, 192: { rings: 1, halfRing: false }, 384: { rings: 2, halfRing: false } }
      : { 96: { rings: 1, halfRing: false }, 192: { rings: 2, halfRing: false }, 384: { rings: 3, halfRing: false } };
  const mark = (cuts: number, rings: number, halfRing = false): CompactDurationMarks => ({
    cuts,
    rings,
    halfRing,
    dots,
    inGrammar: true,
    base,
  });
  if (!inGrammar) return { cuts: 0, rings: 0, halfRing: false, dots: 0, inGrammar: false, base: 0 };
  switch (base) {
    case 3:
      return mark(4, 0);
    case 6:
      return mark(3, 0);
    case 12:
      return mark(2, 0);
    case 24:
      return mark(1, 0);
    case 48:
      return mark(0, 0);
    case 96:
      return mark(0, long[96].rings, long[96].halfRing);
    case 192:
      return mark(0, long[192].rings, long[192].halfRing);
    case 384:
      return mark(0, long[384].rings, long[384].halfRing);
    default:
      return { cuts: 0, rings: 0, halfRing: false, dots: 0, inGrammar: false, base: 0 };
  }
}

/**
 * Round 46: the **maximum ring count of one mount's long-value run**. The
 * midpoint family's largest long value (384 = breve) states two full rings;
 * the compact family keeps its three. A run longer than this can never be
 * painted, so it is the one number the carrier length and every ink box share.
 */
export const MIDPOINT_MAX_RINGS = 2;
/** Round 42/compact family maximum ring count (three-ring whole-note stack). */
export const COMPACT_MAX_RINGS = 3;

/** Ring count of the largest long value of one mark family. */
export function maxRingCount(grammar: JankoBracketDurationGrammar): number {
  return grammar === 'midpoint' ? MIDPOINT_MAX_RINGS : COMPACT_MAX_RINGS;
}

/**
 * Round 47 — one **single long-mark shape**. The `'midpoint'` family has two
 * primitives (the half-ring and the full ring, the 384-tick run stacking two
 * rings); the `'open-oval'` family distinguishes the three values by shape:
 * 96 a compact tilted oval, 192 a measurably broader horizontal oval, 384 that
 * oval with the breve's two short flank strokes.
 */
export type JankoLongMarkKind = 'half-ring' | 'ring' | 'oval-narrow' | 'oval-broad' | 'oval-breve';

/**
 * Round 47 — the family-level **name of one value's long ink** on a mount or a
 * detached seat. It names the *run* (`'two-rings'` is the 384-tick midpoint
 * run's two stacked rings; the open-oval family names single shapes only), so
 * the diagnostic, the test and the paint all state the same word for the value
 * the operator reads.
 */
export type JankoLongRunName =
  | 'half-ring'
  | 'ring'
  | 'two-rings'
  | 'oval-narrow'
  | 'oval-broad'
  | 'oval-breve';

/**
 * The single mark shape one in-grammar **base value** paints in `style`, or
 * `null` for a value the family does not state with a long mark (48 and the
 * cut values).
 */
export function longMarkKindForBase(
  base: number,
  style: JankoLongDurationStyle = 'midpoint'
): JankoLongMarkKind | null {
  if (style === 'open-oval') {
    return base === 96 ? 'oval-narrow' : base === 192 ? 'oval-broad' : base === 384 ? 'oval-breve' : null;
  }
  return base === 96 ? 'half-ring' : base === 192 || base === 384 ? 'ring' : null;
}

/** The run name of one in-grammar base value in `style` (see {@link JankoLongRunName}). */
export function longRunName(
  base: number,
  style: JankoLongDurationStyle = 'midpoint'
): JankoLongRunName | null {
  if (style === 'midpoint') {
    return base === 96 ? 'half-ring' : base === 192 ? 'ring' : base === 384 ? 'two-rings' : null;
  }
  const kind = longMarkKindForBase(base, style);
  return kind === null ? null : (kind as JankoLongRunName);
}

/** True when `style` states the value `base` with the long (ring/oval) family. */
export function isLongValueBase(base: number, style: JankoLongDurationStyle = 'midpoint'): boolean {
  return longMarkKindForBase(base, style) !== null;
}

/**
 * Round 47 — the **flat face** of a half-mark: the interval of the mount line
 * the mark interrupts, plus the air the operator asked for at each end. A
 * closed mark (ring, oval) has no flat face and claims no gap.
 */
export interface JankoMountGap {
  /** Axis the mount runs along: `'y'` on the vertical bracket spine, `'x'` on a horizontal mount. */
  axis: 'x' | 'y';
  /** The chord's own extent along that axis (pt) — the mark's real ink line. */
  chordFrom: number;
  chordTo: number;
  /** The interrupted interval (pt): the chord expanded by the gap air at both ends. */
  from: number;
  to: number;
}

/** One painted long-value mark: its ink, its audited box and its flat-face claim. */
export interface JankoLongValueMark {
  /** The single primitive this mark paints (see {@link JankoLongMarkKind}). */
  kind: JankoLongMarkKind;
  /** SVG elements, each already indented and newline-free. */
  svg: string[];
  /** Axis-aligned ink box of this mark alone (pt), stroke-padded. */
  box: { x0: number; y0: number; x1: number; y1: number };
  /** The mount interval this mark's flat face interrupts (half-marks only). */
  gap?: JankoMountGap;
}

/**
 * Round 47 — the geometry of one **open oval** on one mount.
 *
 * The family is derived from the mount's own ring metrics (radius and stroke,
 * so the bracket's larger mount policy carries over unchanged) and the token
 * ratios: one height for every value, two breadths (the 96-tick oval is
 * `openOvalNarrowFactor` wide and tilted `openOvalTiltDegrees`; the 192/384
 * oval is `openOvalBroadFactor` wide and horizontal), and — for the breve — two
 * short vertical flank strokes standing `openOvalFlankGap` clear of the oval's
 * vertices.
 */
export interface JankoOpenOvalShape {
  /** Semi-major axis (pt) before rotation — the oval's own long axis. */
  rx: number;
  /** Semi-minor axis (pt) — the family's one height. */
  ry: number;
  /** Clockwise tilt (radians); `0` for the 192/384 horizontal oval. */
  tilt: number;
  /** Stroke width (pt) of the oval and of its flank strokes. */
  stroke: number;
  /** True when the breve's two flank strokes paint. */
  flanks: boolean;
  /** Half-length (pt) of one flank stroke. */
  flankHalf: number;
  /** Centre distance (pt) from the oval centre to a flank stroke's centreline. */
  flankOffset: number;
  /** Axis-aligned ink half-extents of the whole mark (oval plus flanks). */
  halfX: number;
  halfY: number;
}

/** The open-oval geometry of one mark shape on one mount (see {@link JankoOpenOvalShape}). */
export function openOvalShape(
  kind: JankoLongMarkKind,
  mount: 'bracket' | 'carrier',
  m: JankoMidpointMetrics,
  t: ResolvedJankoTokens
): JankoOpenOvalShape {
  const radius = mount === 'bracket' ? m.bracketRingRadius : m.ringRadius;
  const stroke = mount === 'bracket' ? m.bracketRingStroke : m.ringStroke;
  const narrow = kind === 'oval-narrow';
  const rx = (narrow ? t.openOvalNarrowFactor : t.openOvalBroadFactor) * radius;
  const ry = t.openOvalHeightFactor * radius;
  const tilt = narrow ? (t.openOvalTiltDegrees * Math.PI) / 180 : 0;
  const flanks = kind === 'oval-breve';
  const flankHalf = t.openOvalFlankFactor * ry;
  const flankOffset = rx + t.openOvalFlankGap * radius;
  // Rotated-ellipse bounding half-extents, plus the stroke's own half-width.
  const cos = Math.abs(Math.cos(tilt));
  const sin = Math.abs(Math.sin(tilt));
  const ovalX = Math.hypot(rx * cos, ry * sin) + stroke / 2;
  const ovalY = Math.hypot(rx * sin, ry * cos) + stroke / 2;
  const halfX = flanks ? Math.max(ovalX, flankOffset + stroke / 2) : ovalX;
  const halfY = flanks ? Math.max(ovalY, flankHalf + stroke / 2) : ovalY;
  return { rx, ry, tilt, stroke, flanks, flankHalf, flankOffset, halfX, halfY };
}

/**
 * Round 47 — paint the long-value mark of the active family at `(cx, cy)`.
 *
 * `fill` is the closed marks' interior: `'#FFFFFF'` on a **mount** (the white
 * interior knocks the mount line out locally, exactly as the full ring always
 * has), `'none'` on a **detached seat** (a detached mark is seated clear of
 * every other ink, so it must never erase anything at all). Half-marks are
 * always `fill="none"` — their chord *is* the line their endpoints stand on,
 * and the interruption is declared through {@link JankoLongValueMark.gap}
 * instead of being faked with a mask. Every number comes from the shared
 * {@link JankoMidpointMetrics} / {@link JankoOpenOvalShape}, so the paint, the
 * box, the fit and the linter can never drift.
 */
export function longValueMark(
  kind: JankoLongMarkKind,
  mount: 'bracket' | 'carrier',
  m: JankoMidpointMetrics,
  t: ResolvedJankoTokens,
  cx: number,
  cy: number,
  className: string,
  halfRingGap: number = 0,
  fill: '#FFFFFF' | 'none' = '#FFFFFF'
): JankoLongValueMark {
  if (kind === 'half-ring' || kind === 'ring') {
    const box = midpointRingInkBox(mount, m, cx, cy, kind === 'half-ring');
    const mark: JankoLongValueMark = {
      kind,
      svg: [midpointRingSvg(mount, m, cx, cy, kind === 'half-ring', className, fill)],
      box,
    };
    if (kind === 'half-ring') {
      const r = mount === 'bracket' ? m.bracketRingRadius : m.ringRadius;
      mark.gap =
        mount === 'bracket'
          ? {
              axis: 'y',
              chordFrom: cy - r,
              chordTo: cy + r,
              from: cy - r - halfRingGap,
              to: cy + r + halfRingGap,
            }
          : {
              axis: 'x',
              chordFrom: cx - r,
              chordTo: cx + r,
              from: cx - r - halfRingGap,
              to: cx + r + halfRingGap,
            };
    }
    return mark;
  }
  const shape = openOvalShape(kind, mount, m, t);
  const tiltDegrees = (shape.tilt * 180) / Math.PI;
  const svg = [
    `    <ellipse class="${className}" data-open-oval="${kind}" cx="${f(cx)}" cy="${f(cy)}" rx="${f(shape.rx)}" ry="${f(shape.ry)}"${shape.tilt === 0 ? '' : ` transform="rotate(${f(tiltDegrees)} ${f(cx)} ${f(cy)})"`} fill="${fill}" stroke="#111111" stroke-width="${shape.stroke.toFixed(2)}"/>`,
  ];
  if (shape.flanks) {
    for (const side of [-1, 1]) {
      const fx = cx + side * shape.flankOffset;
      svg.push(
        `    <line class="janko-open-oval-flank" data-open-oval-flank="${side < 0 ? 'left' : 'right'}" x1="${f(fx)}" y1="${f(cy - shape.flankHalf)}" x2="${f(fx)}" y2="${f(cy + shape.flankHalf)}" stroke="#111111" stroke-width="${shape.stroke.toFixed(2)}" stroke-linecap="butt"/>`
      );
    }
  }
  return {
    kind,
    svg,
    box: { x0: cx - shape.halfX, y0: cy - shape.halfY, x1: cx + shape.halfX, y1: cy + shape.halfY },
  };
}

/** One long-value mark of an in-grammar `base` value, or `null` for other values. */
export function longValueMarkForBase(
  base: number,
  style: JankoLongDurationStyle,
  mount: 'bracket' | 'carrier',
  m: JankoMidpointMetrics,
  t: ResolvedJankoTokens,
  cx: number,
  cy: number,
  className: string,
  halfRingGap: number = 0,
  fill: '#FFFFFF' | 'none' = '#FFFFFF'
): JankoLongValueMark | null {
  const kind = longMarkKindForBase(base, style);
  return kind === null ? null : longValueMark(kind, mount, m, t, cx, cy, className, halfRingGap, fill);
}

/** Half-extents (pt) of one compact mark primitive, from the token set. */
function compactMarkHalfExtents(
  t: ResolvedJankoTokens,
  kind: 'cut' | 'ring'
): { hw: number; hh: number } {
  if (kind === 'cut') {
    return { hw: t.compactCutLength / 2, hh: t.compactMarkStroke / 2 };
  }
  const outer = t.compactRingRadius + t.compactRingStroke / 2;
  return { hw: outer, hh: outer };
}

/**
 * Longitudinal half-span (pt) of `count` marks stacked at
 * {@link JankoTokens.compactMarkSpacing} centre-to-centre about a centre: the
 * end-to-end centre distance is `(count − 1) · spacing`.
 */
function compactStackCentreSpan(t: ResolvedJankoTokens, count: number): number {
  return count <= 1 ? 0 : ((count - 1) / 2) * t.compactMarkSpacing;
}

/** Mark centres (pt offsets from the group centre) of one compact mark run. */
function compactMarkOffsets(t: ResolvedJankoTokens, count: number): number[] {
  if (count <= 0) return [];
  const span = compactStackCentreSpan(t, count);
  const step = count <= 1 ? 0 : t.compactMarkSpacing;
  const out: number[] = [];
  for (let i = 0; i < count; i++) out.push(-span + i * step);
  return out;
}

/**
 * Round 43 (midpoint study) / Round 44 — the **one 45-degree slash** mark
 * metric, scaled by the admitted cluster's symbol scale `s`.
 *
 * One mark primitive is used for every midpoint cut — a single
 * **page-oriented positive-45-degree** slash rising left→right, with the
 * **pre-change physical centreline length preserved**:
 * `L0 = hypot(midpointSlashLength, midpointSlashLength · midpointSlashSlope)`
 * (4.95pt × 0.22 → `L0 = 5.0683745915pt`); each axis component is
 * `L0 / √2 · s`, so the cut rises exactly as far as it runs — increasing the
 * rake no longer lengthens the slash. One ring
 * (`midpointRingRadius · s` / `midpointRingStroke · s`) completes the family.
 * The **same ink** is painted on both mounts; only the stacking direction
 * differs (the bracket stacks marks vertically along its spine, the
 * horizontal exception carrier stacks them along its own axis).
 *
 * Every number the paint, the layout, the fit and the linter read is derived
 * here from the emitted endpoints and stroke width, so they can never drift.
 * For a butt-ended 45-degree segment the projected ink extent along **either**
 * page axis is `component + stroke/√2`, so an axis-aligned ink half-extent is
 * half of that. Two parallel cuts one above the other keep true *stroke*
 * clearance when their centre pitch is `√2 · (stroke + g)` — the
 * perpendicular distance between the 45-degree centrelines. A ring's ink
 * half-extent is `r + stroke/2` on both axes and its centre pitch is the
 * outer diameter plus `g`. The fixed carrier length is the largest supported
 * run (four cuts, or three rings) plus one `g` margin at each end; the
 * vertical bracket keeps its chord-connecting extent but carries the *same*
 * mark unit and stack bounds.
 */
export interface JankoMidpointMetrics {
  /** Admitted cluster symbol scale the metric was resolved for. */
  scale: number;
  /** Pre-change slash centreline length (pt, scale-free source `L0`). */
  slashCenterline: number;
  /** Round 45: painted centreline multiplier (`1` = the Round 43/44 family). */
  slashLengthFactor: number;
  /** Painted slash centreline length (pt, scale-free): `L0 · slashLengthFactor`. */
  paintedCenterline: number;
  /** Transverse (x) component of one slash (pt): `L0·factor/√2 · s`. */
  slashDx: number;
  /** Rise of one slash (pt): `L0/√2 · s` — the 45-degree page orientation. */
  slashDy: number;
  /** Slash stroke width (pt) — `midpointSlashStroke · s`. */
  slashStroke: number;
  /** Slash rise/run — exactly 1 (the page-oriented positive 45 degrees). */
  slashSlope: number;
  /** Axis-aligned ink half-width of one slash (pt). */
  slashHalfX: number;
  /** Axis-aligned ink half-height of one slash (pt). */
  slashHalfY: number;
  /** Round 45: ring radius *and* stroke multiplier on the carrier mount. */
  ringScale: number;
  /**
   * Round 46: the **bracket mount's** extra ring multiplier on top of
   * {@link JankoMidpointMetrics.ringScale} (`1` = both mounts equal). The
   * bracket's ring/half-ring grow by it; the carrier's do not.
   */
  bracketRingScale: number;
  /** Carrier ring centreline radius (pt) — `midpointRingRadius · ringScale · s`. */
  ringRadius: number;
  /** Carrier ring stroke width (pt) — `midpointRingStroke · ringScale · s`. */
  ringStroke: number;
  /** Carrier ring axis-aligned ink half-extent (pt) — `ringRadius + ringStroke/2`. */
  ringHalf: number;
  /** Bracket ring centreline radius (pt) — `ringRadius · bracketRingScale`. */
  bracketRingRadius: number;
  /** Bracket ring stroke width (pt) — `ringStroke · bracketRingScale`. */
  bracketRingStroke: number;
  /** Bracket ring ink half-extent (pt) — `bracketRingRadius + bracketRingStroke/2`. */
  bracketRingHalf: number;
  /** Minimum clear ink gap `g` between two marks (pt) — `CLASP_MARK_STACK_GAP · s`. */
  gap: number;
  /**
   * Round 45/46: **cut** centre-spacing multiplier (`1` = the Round 43/44
   * family). Round 46's value re-derives the Round 45 `7/6` so the 95 %
   * working scale gains a further 0.20pt of cut centre pitch.
   */
  spacingFactor: number;
  /**
   * Identical cut centre pitch along either mount (pt) —
   * `√2 · (stroke + g) · spacingFactor`. At factor 1 this is exactly the
   * Round 43/44 pitch (true stroke clearance between the parallel cuts); the
   * multiplier only *adds* clear air, it never steals any.
   */
  cutSpacing: number;
  /** Carrier ring centre pitch along the mount (pt) — outer Ø + `g`. */
  ringSpacing: number;
  /** Bracket ring centre pitch along the spine (pt) — bracket outer Ø + `g`. */
  bracketRingSpacing: number;
  /** Full four-cut run along its mount (pt), end of ink to end of ink. */
  cutsRun: number;
  /** Full carrier ring run of the family's largest value (pt) — Round 46: two rings. */
  ringsRun: number;
  /** Full bracket ring run of the family's largest value (pt) — Round 46: two rings. */
  bracketRingsRun: number;
  /** A lone half-ring's along-mount ink span (pt) — its chord plus the stroke. */
  halfRingRun: number;
  /** Fixed carrier length (pt): the largest run plus `g` at each end. */
  carrierLength: number;
  /** Bracket (vertical stacking) centre pitch of cuts (pt) — identical. */
  bracketCutSpacing: number;
  /** Bracket (vertical stacking) centre pitch of rings (pt). */
  bracketRingPitch: number;
  /** Carrier (horizontal stacking) centre pitch of cuts (pt) — identical. */
  carrierCutSpacing: number;
  /** Carrier (horizontal stacking) centre pitch of rings (pt). */
  carrierRingSpacing: number;
}

/**
 * One metric for the midpoint family, from the token set and the **admitted
 * cluster symbol scale** `s` (paint · layout · fit · lint).
 *
 * `s` is the actual scale the admitted cluster's symbols are engraved at
 * (`chordSymbolScale` for an admitted bracket member, 1 for canonical ink), so
 * a reduced cluster's duration ink shrinks with its numerals instead of
 * staying full size on smaller symbols.
 *
 * Round 46 rounds the family off:
 *
 * - **long values** — `96 → one half-ring`, `192 → one full ring`,
 *   `384 → two full rings` (no three-ring stack exists in this family);
 * - **mount-specific ring size** — the bracket's ring and half-ring are
 *   `midpointBracketRingScale` (1.20 on the Round 46 Reference) larger than the
 *   carrier's, which keeps the Round 45 size; the *shared meaning* is the
 *   value, not the physical size;
 * - **fixed carrier length** — re-derived from the largest run the new
 *   vocabulary can paint (two carrier rings, a four-cut run, or a lone
 *   half-ring), so the length still states nothing about release or duration.
 */
/**
 * Round 46 performance guard: `midpointMetrics` is a pure function of one
 * **resolved** token set and the scale, but it sits inside the dot-seat search
 * (every candidate position of every dotted mark re-measures the mark's own
 * ink) and is therefore called millions of times per engraving. Resolved token
 * sets are read-only by contract ({@link isResolvedJankoTokens}), so the value
 * is memoized per token-set identity and scale; caller-owned partials never
 * enter the cache and always take the full fresh path (so a mutated partial
 * keeps its exact previous semantics).
 */
const MIDPOINT_METRICS_CACHE = new WeakMap<ResolvedJankoTokens, Map<number, JankoMidpointMetrics>>();

function computeMidpointMetrics(t: ResolvedJankoTokens, scale: number): JankoMidpointMetrics {
  const s = scale;
  // The pre-change centreline length is the SOURCE constant: the old
  // `midpointSlashLength` run and its `midpointSlashSlope` rise. The 45-degree
  // orientation splits that physical length into two equal components, so the
  // slash never grows longer merely because it rises.
  const slashCenterline = Math.hypot(
    t.midpointSlashLength,
    t.midpointSlashLength * t.midpointSlashSlope
  );
  // Round 45/46 readability ratios: the length and the ring grow for countable
  // ink, and the cut pitch gains clear air. The length and the base ring scale
  // are no-ops at `1`, so the Round 43/44 family is untouched; the bracket's
  // extra ring factor is a Round 46 mount policy.
  const slashLengthFactor = t.midpointSlashLengthFactor ?? 1;
  const ringScale = t.midpointRingScale ?? 1;
  const bracketRingScale = t.midpointBracketRingScale ?? 1;
  const spacingFactor = t.midpointSpacingFactor ?? 1;
  const paintedCenterline = slashCenterline * slashLengthFactor;
  const component = (paintedCenterline / Math.SQRT2) * s;
  const slashStroke = t.midpointSlashStroke * s;
  const slashHalf = (component + slashStroke / Math.SQRT2) / 2;
  const ringRadius = t.midpointRingRadius * ringScale * s;
  const ringStroke = t.midpointRingStroke * ringScale * s;
  const ringHalf = ringRadius + ringStroke / 2;
  const bracketRingRadius = t.midpointRingRadius * ringScale * bracketRingScale * s;
  const bracketRingStroke = t.midpointRingStroke * ringScale * bracketRingScale * s;
  const bracketRingHalf = bracketRingRadius + bracketRingStroke / 2;
  const gap = CLASP_MARK_STACK_GAP * s;
  // True stroke clearance between parallel 45-degree cuts, and ring-ink
  // clearance: one pitch along either mount.
  const cutSpacing = Math.SQRT2 * (slashStroke + gap) * spacingFactor;
  const ringSpacing = 2 * ringHalf + gap;
  const bracketRingSpacing = 2 * bracketRingHalf + gap;
  const cutsRun = 3 * cutSpacing + 2 * slashHalf;
  const rings = MIDPOINT_MAX_RINGS;
  const ringsRun = (rings - 1) * ringSpacing + 2 * ringHalf;
  const bracketRingsRun = (rings - 1) * bracketRingSpacing + 2 * bracketRingHalf;
  const halfRingRun = 2 * ringHalf;
  const carrierLength = Math.max(cutsRun, ringsRun, halfRingRun) + 2 * gap;
  return {
    scale: s,
    slashCenterline,
    slashLengthFactor,
    paintedCenterline,
    slashDx: component,
    slashDy: component,
    slashStroke,
    slashSlope: 1,
    slashHalfX: slashHalf,
    slashHalfY: slashHalf,
    ringScale,
    bracketRingScale,
    ringRadius,
    ringStroke,
    ringHalf,
    bracketRingRadius,
    bracketRingStroke,
    bracketRingHalf,
    gap,
    spacingFactor,
    cutSpacing,
    ringSpacing,
    bracketRingSpacing,
    cutsRun,
    ringsRun,
    bracketRingsRun,
    halfRingRun,
    carrierLength,
    bracketCutSpacing: cutSpacing,
    bracketRingPitch: bracketRingSpacing,
    carrierCutSpacing: cutSpacing,
    carrierRingSpacing: ringSpacing,
  };
}

/** Memoized façade over {@link computeMidpointMetrics} (see the cache note). */
export function midpointMetrics(
  tokens?: Partial<JankoTokens> | null,
  scale: number = 1
): JankoMidpointMetrics {
  if (isResolvedJankoTokens(tokens)) {
    let byScale = MIDPOINT_METRICS_CACHE.get(tokens);
    if (!byScale) {
      byScale = new Map();
      MIDPOINT_METRICS_CACHE.set(tokens, byScale);
    }
    const hit = byScale.get(scale);
    if (hit) return hit;
    const value = computeMidpointMetrics(tokens, scale);
    byScale.set(scale, value);
    return value;
  }
  return computeMidpointMetrics(resolveJankoTokens(tokens), scale);
}

/**
 * Round 46 — the **ink box of one ring mark on a mount**, shared by the
 * renderer, the fit rule and the linter.
 *
 * A full ring is a disc of outer radius `half` about its centre. A **half-ring**
 * keeps its diameter (chord) on the mount axis and bulges perpendicular to it —
 * left on the vertical bracket spine, up on the horizontal carrier (the
 * intentional mount rotation, half-rings only) — so its ink is one-sided: the
 * box is the full box on the bulge axis and the stroke's own half-width on the
 * chord axis.
 */
export function midpointRingInkBox(
  mount: 'bracket' | 'carrier',
  m: JankoMidpointMetrics,
  cx: number,
  cy: number,
  halfRing: boolean
): { x0: number; y0: number; x1: number; y1: number } {
  const half = mount === 'bracket' ? m.bracketRingHalf : m.ringHalf;
  const strokeHalf = (mount === 'bracket' ? m.bracketRingStroke : m.ringStroke) / 2;
  if (!halfRing) return { x0: cx - half, y0: cy - half, x1: cx + half, y1: cy + half };
  if (mount === 'bracket') {
    // Chord on the spine, bulge left: ink reaches `half` to the left and only
    // the stroke's own half-width to the right.
    return { x0: cx - half, y0: cy - half, x1: cx + strokeHalf, y1: cy + half };
  }
  // Chord on the carrier, bulge up: ink reaches `half` upward and only the
  // stroke's own half-width below the carrier axis.
  return { x0: cx - half, y0: cy - half, x1: cx + half, y1: cy + strokeHalf };
}

/**
 * Round 46 — paint one ring/half-ring mark. The full ring keeps its white fill
 * (its interior knocks the mount line out); the **half-ring is `fill="none"`**
 * — its chord *is* the mount line, so a white fill would erase the very line
 * the endpoints stand on.
 */
export function midpointRingSvg(
  mount: 'bracket' | 'carrier',
  m: JankoMidpointMetrics,
  cx: number,
  cy: number,
  halfRing: boolean,
  className: string,
  /**
   * Round 47: the closed ring's interior. `'#FFFFFF'` (default: the canonical
   * engraving, byte-identical) knocks the mount line out under the ring; a
   * detached seat passes `'none'`, because a mark that stands on no mount must
   * never erase anything. Half-rings are always `fill="none"`.
   */
  fill: '#FFFFFF' | 'none' = '#FFFFFF'
): string {
  if (mount === 'bracket') {
    if (!halfRing) {
      return `    <circle class="${className}" cx="${f(cx)}" cy="${f(cy)}" r="${f(m.bracketRingRadius)}" fill="${fill}" stroke="#111111" stroke-width="${m.bracketRingStroke.toFixed(2)}"/>`;
    }
    const r = m.bracketRingRadius;
    // Left semicircle: from the top of the chord, `sweep-flag 0` (the screen
    // anticlockwise direction) bulges toward the left, away from the spine.
    return `    <path class="${className}" data-half-ring="true" d="M ${f(cx)} ${f(cy - r)} A ${f(r)} ${f(r)} 0 0 0 ${f(cx)} ${f(cy + r)}" fill="none" stroke="#111111" stroke-width="${m.bracketRingStroke.toFixed(2)}"/>`;
  }
  if (!halfRing) {
    return `    <circle class="${className}" cx="${f(cx)}" cy="${f(cy)}" r="${f(m.ringRadius)}" fill="${fill}" stroke="#111111" stroke-width="${m.ringStroke.toFixed(2)}"/>`;
  }
  const r = m.ringRadius;
  // Upper semicircle: from the left end of the chord, `sweep-flag 1` (the
  // screen clockwise direction) bulges upward, away from the carrier line.
  return `    <path class="${className}" data-half-ring="true" d="M ${f(cx - r)} ${f(cy)} A ${f(r)} ${f(r)} 0 0 1 ${f(cx + r)} ${f(cy)}" fill="none" stroke="#111111" stroke-width="${m.ringStroke.toFixed(2)}"/>`;
}

export function effectiveExceptionCarrierLength(
  grammar: JankoBracketDurationGrammar,
  t: ResolvedJankoTokens,
  scale: number = 1
): number {
  return grammar === 'midpoint'
    ? midpointMetrics(t, scale).carrierLength
    : t.exceptionCarrierLength;
}

/**
 * Centre-to-centre pitch (pt) of one midpoint mark run on its mount. Round 44:
 * the 45-degree family has **one** pitch per mark family — the bracket's
 * vertical stack and the carrier's horizontal stack are identical, so the two
 * mounts cannot diverge. The `mount` argument is retained (and read) so the
 * shared metric still names the mount it is asked about.
 */
function midpointSpacingFor(
  m: JankoMidpointMetrics,
  mount: 'bracket' | 'carrier',
  kind: 'cut' | 'ring'
): number {
  if (mount === 'bracket') return kind === 'cut' ? m.bracketCutSpacing : m.bracketRingPitch;
  return kind === 'cut' ? m.carrierCutSpacing : m.carrierRingSpacing;
}

/** Mark centres (pt offsets about the run centre) of one midpoint mark run. */
export function midpointMarkOffsets(
  m: JankoMidpointMetrics,
  mount: 'bracket' | 'carrier',
  kind: 'cut' | 'ring',
  count: number
): number[] {
  if (count <= 0) return [];
  const step = midpointSpacingFor(m, mount, kind);
  const span = count <= 1 ? 0 : ((count - 1) / 2) * step;
  const out: number[] = [];
  for (let i = 0; i < count; i++) out.push(-span + i * step);
  return out;
}

/**
 * One **duration-ink group** of a clasp: a value painted at one point on the
 * bracket spine (Round 19).
 *
 * A classic per-hand bracket carries exactly one group, at its own midpoint
 * (`yMid`). A **unified** cross-hand bracket (see the engine's
 * `resolveOnsetClaspGroups`) carries one group per hand, so each hand's value
 * survives the unification: the open half/whole marks sit at the bracket's own
 * midpoint (they read as the bracket's value), while the transverse
 * subdivision marks stay at their own hand's vertical centre.
 */
export interface ResolvedJankoClaspInk {
  /** Absolute y of the group's centre on the spine. */
  centerY: number;
  /** The value this group carries (ticks). */
  durationTicks: number;
  /** Resolved duration grammar of that value. */
  duration: JankoClaspDuration;
  /** Duration notches (0 = quarter, 1 = 8th, 2 = 16th). */
  flags: number;
  /** Open knockout marks (0–2) painted at the spine midpoint. */
  pips: number;
  /** A dotted value adds the 0.75pt augmentation dot beside the mark. */
  dotted: boolean;
  /**
   * Round 30: augmentation dots the group paints (0–2). The complete grammar
   * reads it from the notated value; the golden grammar reads 0/1 from
   * {@link claspDurationDotted}.
   */
  dots: 0 | 1 | 2;
  /**
   * Round 42 study: cuts this group paints in the compact family (0 = none).
   * Zero under the canonical `'golden'` bracket grammar.
   */
  compactCuts: number;
  /** Round 42 study: compact elongation rings this group paints (0 = none). */
  compactRings: number;
  /**
   * Round 46: the single ring mark of this run is a **half-ring** (midpoint
   * family, 96 ticks). Always false when {@link ResolvedJankoClaspInk.compactRings}
   * is 0 or 2, and false for the compact family.
   */
  compactHalfRing: boolean;
  /**
   * Round 47: the analysed **base value** of this group's statement (`0` out of
   * grammar) — the value whose long mark shape the active
   * {@link JankoLongDurationStyle} selects (half-ring / ring, or the narrow /
   * broad / breve open oval).
   */
  compactBase: number;
  /** Round 47: the long-value symbol family this group's marks belong to. */
  longStyle: JankoLongDurationStyle;
  /** Round 42 study: the active bracket duration grammar of this group. */
  bracketGrammar: JankoBracketDurationGrammar;
}

/** A duration-ink group the caller asks for (unresolved: value + spine y). */
export interface JankoClaspDurationInk {
  /** Absolute y of the group's centre on the spine. */
  centerY: number;
  /** The value the group carries (ticks). */
  durationTicks: number;
}

/**
 * Resolve one requested duration-ink group into its painted mark grammar.
 *
 * Round 30: under the complete grammar the dot count is the NOTATED count
 * (a double-dotted carried value dots twice); `dotted` stays the
 * "dots ≥ 1" shorthand, so golden callers read it unchanged.
 */
export function resolveClaspInk(
  ink: JankoClaspDurationInk,
  grammar: JankoDurationGrammar = 'golden',
  bracketGrammar: JankoBracketDurationGrammar = 'golden',
  /**
   * Round 47: the long-value symbol family of the marks resolved here. The
   * golden / compact grammars ignore it (their ring counts are untouched);
   * under `'midpoint'` it selects the ring family or the experimental
   * open-oval family (see {@link JankoLongDurationStyle}).
   */
  longStyle: JankoLongDurationStyle = 'midpoint'
): ResolvedJankoClaspInk {
  const duration = claspDurationClass(ink.durationTicks);
  // Round 42 study: under the compact bracket family the dots read exactly from
  // the notated value (single/double), shared with the horizontal carrier; the
  // canonical dots stay byte-identical.
  const dots =
    bracketGrammar === 'compact' || bracketGrammar === 'midpoint'
      ? compactDurationMarks(ink.durationTicks, bracketGrammar, longStyle).dots
      : grammar === 'complete'
        ? durationDotCount(ink.durationTicks, grammar)
        : claspDurationDotted(ink.durationTicks)
          ? 1
          : 0;
  const compact =
    bracketGrammar === 'compact' || bracketGrammar === 'midpoint'
      ? compactDurationMarks(ink.durationTicks, bracketGrammar, longStyle)
      : { cuts: 0, rings: 0, halfRing: false, base: 0 };
  return {
    centerY: ink.centerY,
    durationTicks: ink.durationTicks,
    duration,
    // The compact family is a different primitive set, so it never reports the
    // golden flags/pips (they would paint the wrong ink).
    flags:
      bracketGrammar === 'compact'
        ? 0
        : duration === 'spire-two-flags'
          ? 2
          : duration === 'spire-one-flag'
            ? 1
            : 0,
    pips:
      bracketGrammar === 'compact'
        ? 0
        : duration === 'double-pip'
          ? 2
          : duration === 'pip'
            ? 1
            : 0,
    dotted: dots >= 1,
    dots,
    compactCuts: compact.cuts,
    compactRings: compact.rings,
    compactHalfRing: 'halfRing' in compact ? compact.halfRing : false,
    compactBase: 'base' in compact ? compact.base : 0,
    longStyle,
    bracketGrammar,
  };
}

/** One resolved left clasp: bracket geometry plus its symmetrical duration ink. */
export interface JankoClaspGroupGeometry {
  /** Onset tick shared by every member of the cluster. */
  tick: number;
  /** Cluster members, sorted by page y (top to bottom). */
  notes: JankoRhythmNote[];
  /** Extents of the member notehead centres (page pt). */
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  /** Absolute x of the clasp spine, left of the outermost disc. */
  claspX: number;
  /** Top corner of the bracket (`minY − r`). */
  topY: number;
  /** Bottom corner of the bracket (`maxY + r`). */
  botY: number;
  /** Horizontal reach of both caps (token `claspWidth`). */
  capWidth: number;
  /** Stroke thickness of the bracket and its duration ink (token `claspStrokeWidth`). */
  strokeWidth: number;
  /**
   * Round 44: the **admitted cluster symbol scale** every midpoint mark of this
   * bracket is engraved at (`chordSymbolScale` for an admitted, reduced
   * bracket; 1 for canonical ink). The bracket's mark unit, its stack pitch
   * and the fixed carrier length all scale coherently with it, so a reduced
   * cluster's duration ink never stays full size on smaller numerals.
   */
  durationScale: number;
  /** Shortest member value — the duration the clasp carries. */
  durationTicks: number;
  /** Resolved duration grammar. */
  duration: JankoClaspDuration;
  /** Round 11: the light transverse duration paradigm the bracket paints. */
  durationStyle: JankoClaspDurationStyle;
  /** Round 42 study: the bracket's duration mark family (golden | compact). */
  bracketGrammar: JankoBracketDurationGrammar;
  /** Round 47: the long-value symbol family of this bracket's marks. */
  longDurationStyle: JankoLongDurationStyle;
  /**
   * Round 47: the air (pt) this bracket cuts out of its spine across a
   * half-ring's chord. Read by the mark paint and by the ink box, so the two
   * can never disagree about the flat face; `0` is the incumbent unbroken
   * spine.
   */
  halfRingGap: number;
  /**
   * Round 47: the spine intervals this bracket's half-rings interrupt — the
   * chord plus {@link JankoClaspGroupGeometry.halfRingGap} at each end. Empty
   * whenever the gap is 0 or the group paints no half-ring, so the incumbent
   * path is byte-identical.
   */
  spineGaps: Array<{ from: number; to: number }>;
  /** Duration notches (0 = quarter, 1 = 8th, 2 = 16th). */
  flags: number;
  /** Open knockout marks (0–2) painted at the spine midpoint. */
  pips: number;
  /** Round 11: a dotted value adds the 0.75pt augmentation dot at the midpoint. */
  dotted: boolean;
  /**
   * Round 19: every duration-ink group this bracket paints, in paint order. A
   * classic per-hand bracket has exactly one (at its own midpoint); a unified
   * cross-hand bracket has one per hand. The scalar `duration` / `flags` /
   * `pips` / `dotted` fields mirror the bracket's **primary** group (the first
   * entry), which is all a classic bracket ever has.
   */
  durationInk: ResolvedJankoClaspInk[];
  /**
   * Round 20: the resolved centre of each group's augmentation dot, aligned
   * with {@link durationInk} (`null` for a group that is not dotted). Painted,
   * audited and boxed from this one datum, so the dot's satellite seat can
   * never drift between the renderer, the fit rule and the linter.
   */
  durationDots: Array<{ x: number; y: number } | null>;
  /**
   * Round 30: the resolved centre of each group's SECOND augmentation dot,
   * aligned with {@link durationInk} (`null` unless the group dots twice
   * under the complete grammar). The same single-datum rule as
   * {@link durationDots}.
   */
  durationSecondDots: Array<{ x: number; y: number } | null>;
  /** The bracket itself: `M cap topY L claspX topY L claspX botY L cap botY`. */
  path: string;
}

/** Overrides accepted by {@link computeClaspGeometry}. */
export interface JankoClaspOptions {
  /**
   * Duration (ticks) the clasp carries. Defaults to the **shortest** member
   * value — the point at which the cluster's first voice moves on.
   */
  durationTicks?: number;
  /**
   * Round 6/8: admit only an onset that {@link claspQualifies} — a horizontally
   * displaced (row-snapped) cluster or a vertical chord of three or more heads.
   * `'per-hand-clasp'` passes `true` so a clean 2-note column keeps its
   * traditional stems; the Round 5 paradigms leave it off.
   */
  requireBracketScope?: boolean;
  /**
   * Round 11: the light transverse duration paradigm the bracket paints.
   * Defaults to the settled `'kinetic-cross-slashes'`.
   */
  claspDurationStyle?: JankoClaspDurationStyle;
  /**
   * Round 42 study: the bracket's duration **mark family** (golden | compact).
   * Defaults to the canonical `'golden'`.
   */
  bracketGrammar?: JankoBracketDurationGrammar;
  /**
   * Round 19: explicit duration-ink groups (value + spine y) for a **unified**
   * cross-hand bracket, which paints one group per hand. Omitted for a classic
   * bracket, whose single group sits at its own midpoint and carries the
   * carried value.
   */
  durationInk?: JankoClaspDurationInk[];
  /**
   * Round 30: duration grammar the bracket's dots derive from. The complete
   * grammar dots a double-dotted carried value twice; the golden grammar
   * keeps the legacy single dot. Defaults to `'golden'`.
   */
  durationGrammar?: JankoDurationGrammar;
  /**
   * Round 31: situational clasp-dot translation — a rigid `[dx, dy]` shift
   * applied to every resolved bracket dot (first and second alike) after the
   * seat solver runs. Defaults to `[0, 0]` (judged seats, byte-identical).
   */
  claspDotNudge?: JankoClaspDotNudge;
  /**
   * Round 44: the admitted cluster's symbol scale the duration ink is engraved
   * at (see {@link JankoClaspGroupGeometry.durationScale}). Defaults to 1
   * (canonical ink).
   */
  durationScale?: number;
  /**
   * Permanent dot-consistency rule: the active cluster-spacing preset, whose
   * rectangular knockout half-extents are the actual member geometry the dot
   * seat clears. Defaults to the golden `'tight'`.
   */
  clusterSpacing?: JankoClusterSpacing;
  /**
   * Permanent dot-consistency rule: whether Position-of-Honor halos paint, in
   * which case a tick-0 member's mask grows to its halo ring's outer edge
   * exactly as the knockout does. Defaults to `false`.
   */
  honorHalo?: boolean;
  /**
   * Round 47: the long-value symbol family of the bracket's marks (see
   * {@link JankoLongDurationStyle}). Defaults to the incumbent `'midpoint'`.
   */
  longDurationStyle?: JankoLongDurationStyle;
  /**
   * Round 47: the air (pt) cut out of the bracket spine across a half-ring's
   * chord (see {@link JankoTokens.halfRingGap}). Defaults to 0 (the incumbent
   * unbroken spine, byte-identical).
   */
  halfRingGap?: number;
}

/**
 * The bracket `[` path: cap → spine → cap.
 *
 * Round 47: `gaps` interrupts the **spine only** — each interval removes the
 * spine segment it covers (plus the declared air) and the path is emitted as
 * several subpaths, so the flat face of a half-ring reads as a deliberate
 * break. The caps always paint, nothing is drawn across a gap, and no mask or
 * erasure is ever involved. An empty `gaps` returns the canonical single
 * subpath byte-for-byte.
 */
function claspBracketPath(
  claspX: number,
  topY: number,
  botY: number,
  cap: number,
  gaps: readonly { from: number; to: number }[] = []
): string {
  const cuts = gaps
    .map((gap) => ({ from: Math.max(topY, gap.from), to: Math.min(botY, gap.to) }))
    .filter((gap) => gap.to > gap.from + 1e-9)
    .sort((a, b) => a.from - b.from);
  if (cuts.length === 0) {
    return (
      `M ${f(claspX + cap)} ${f(topY)} L ${f(claspX)} ${f(topY)} ` +
      `L ${f(claspX)} ${f(botY)} L ${f(claspX + cap)} ${f(botY)}`
    );
  }
  const parts: string[] = [];
  let cursor = topY;
  for (const cut of cuts) {
    const from = Math.max(cursor, cut.from);
    parts.push(
      cursor === topY
        ? `M ${f(claspX + cap)} ${f(topY)} L ${f(claspX)} ${f(topY)} L ${f(claspX)} ${f(from)}`
        : `M ${f(claspX)} ${f(cursor)} L ${f(claspX)} ${f(from)}`
    );
    cursor = Math.max(cursor, cut.to);
  }
  parts.push(
    cursor === topY
      ? `M ${f(claspX + cap)} ${f(topY)} L ${f(claspX)} ${f(topY)} L ${f(claspX)} ${f(botY)} L ${f(claspX + cap)} ${f(botY)}`
      : `M ${f(claspX)} ${f(cursor)} L ${f(claspX)} ${f(botY)} L ${f(claspX + cap)} ${f(botY)}`
  );
  return parts.join(' ');
}

/**
 * Resolve the left clasp of one chord / cluster.
 *
 * The bracket is drawn **outside** the cluster — `claspX = minX − r −
 * claspOffset`, `topY = minY − r`, `botY = maxY + r` — so the vertical extent
 * bounds every member disc and the spine never crosses a glyph. The duration
 * carried is the **shortest** member value (or the override the caller
 * supplies); under `'per-hand-clasp'` the caller hands in one hand's notes, so
 * the bracket spans that hand's full reach — across Middle C when the hand
 * crosses it — and never the grand staff.
 *
 * Returns null for a lone note, and (with `requireBracketScope`) for a cluster
 * that neither spreads horizontally nor holds three heads: melodic writing and
 * clean 2-note columns are never touched.
 */
export function computeClaspGeometry(
  notes: readonly JankoRhythmNote[],
  tokens?: Partial<JankoTokens> | null,
  options?: JankoClaspOptions
): JankoClaspGroupGeometry | null {
  const t = resolveJankoTokens(tokens);
  if (notes.length < 2) return null;
  const sorted = [...notes].sort((a, b) => a.y - b.y || a.x - b.x);
  const sortX = [...notes].sort((a, b) => a.x - b.x);
  const minX = sortX[0].x;
  const maxX = sortX[sortX.length - 1].x;
  if (options?.requireBracketScope && !claspQualifies(notes)) return null;
  const minY = sorted[0].y;
  const maxY = sorted[sorted.length - 1].y;
  const r = t.noteheadRadius;
  const claspX = minX - r - t.claspOffset;
  const topY = minY - r;
  const botY = maxY + r;
  const durationTicks = options?.durationTicks ?? Math.min(...notes.map((n) => n.durationTicks));
  const grammar = options?.durationGrammar ?? 'golden';
  const bracketGrammar = options?.bracketGrammar ?? 'golden';
  const longStyle = options?.longDurationStyle ?? 'midpoint';
  const halfRingGap = options?.halfRingGap ?? 0;
  const durationScale = options?.durationScale ?? 1;
  const durationInk = (
    options?.durationInk && options.durationInk.length > 0
      ? options.durationInk
      : [{ centerY: (topY + botY) / 2, durationTicks }]
  ).map((ink) => resolveClaspInk(ink, grammar, bracketGrammar, longStyle));
  // `durationTicks` stays the **carried value** — the shortest member value,
  // which is what the cluster's first voice moves on, unified bracket or not.
  // The scalar mark fields mirror the bracket's primary ink group (the first
  // entry): for a classic bracket the only group, for a unified cross-hand
  // bracket its open half/whole group.
  const primary = durationInk[0];
  const cap = t.claspWidth;
  // Round 47: every half-ring the bracket carries claims a break in the spine
  // across its chord (plus the declared air at both ends). Resolved here, once,
  // from the same mark metric the paint, the box and the linter read — the
  // bracket path and the mark can therefore never disagree about where the
  // flat face is.
  const spineGaps =
    halfRingGap > 0 && longStyle === 'midpoint'
      ? durationInk
          .filter((ink) => ink.compactHalfRing)
          .map((ink) => {
            const radius = midpointMetrics(t, durationScale).bracketRingRadius;
            return {
              from: ink.centerY - radius - halfRingGap,
              to: ink.centerY + radius + halfRingGap,
            };
          })
      : [];
  const geometry: JankoClaspGroupGeometry = {
    tick: notes[0].startTick,
    notes: sorted,
    minX,
    maxX,
    minY,
    maxY,
    claspX,
    topY,
    botY,
    capWidth: cap,
    strokeWidth: t.claspStrokeWidth,
    durationScale,
    durationTicks,
    duration: claspDurationClass(durationTicks),
    durationStyle: options?.claspDurationStyle ?? 'kinetic-cross-slashes',
    bracketGrammar,
    flags: primary.flags,
    pips: primary.pips,
    dotted: primary.dotted,
    durationInk,
    durationDots: [],
    durationSecondDots: [],
    longDurationStyle: longStyle,
    halfRingGap,
    spineGaps,
    path: claspBracketPath(claspX, topY, botY, cap, spineGaps),
  };
  // Round 20: the augmentation dot of every dotted group is resolved here, once,
  // against the group's own mark ink and member masks.
  const dotOptions: JankoClaspDotSeatOptions = {
    clusterSpacing: options?.clusterSpacing,
    honorHalo: options?.honorHalo,
  };
  geometry.durationDots = durationInk.map((ink) =>
    ink.dotted ? claspDotCenter(geometry, ink, t, dotOptions) : null
  );
  // Round 30: the second dot of every doubly dotted group, further along the
  // same up-right fan — resolved from the first dot, never guessed twice.
  geometry.durationSecondDots = durationInk.map((ink, index) => {
    const first = geometry.durationDots[index];
    return ink.dots >= 2 && first ? claspSecondDotCenter(geometry, ink, first, t, dotOptions) : null;
  });
  // Round 31: the situational nudge translates the RESOLVED seats rigidly, so
  // the renderer, the fit rule, the ink box and the linter all read the moved
  // dot from this one datum. Note dots are never touched.
  const [nudgeDx, nudgeDy] = options?.claspDotNudge ?? [0, 0];
  if (nudgeDx !== 0 || nudgeDy !== 0) {
    const nudge = (dot: { x: number; y: number } | null): { x: number; y: number } | null =>
      dot === null ? null : { x: dot.x + nudgeDx, y: dot.y + nudgeDy };
    geometry.durationDots = geometry.durationDots.map(nudge);
    geometry.durationSecondDots = geometry.durationSecondDots.map(nudge);
  }
  return geometry;
}

/**
 * Extend a clasp's spine up to a rail at `railY` (`'beamed-clasp-rail'`).
 *
 * Round 8 removed the lopsided spire from the bracket: the rail is now the
 * extension of the bracket's own spine, so the shape stays a pure `[` and the
 * ridge that joins a run of clasps is the rail alone. The rail replaces the
 * duration notches exactly as a traditional beam replaces a flag.
 */
export function withClaspRail(
  group: JankoClaspGroupGeometry,
  railY: number
): JankoClaspGroupGeometry {
  if (railY >= group.topY) return { ...group, flags: 0 };
  return {
    ...group,
    topY: railY,
    path: claspBracketPath(group.claspX, railY, group.botY, group.capWidth, group.spineGaps),
    flags: 0,
  };
}

/**
 * Extents of one Round 11 midpoint mark, measured from its own centre:
 * `halfWidth`/`halfHeight` bound the painted ink, `stack` is the distance of
 * the mark's centre from the bracket midpoint (`0` for a single mark, the
 * mirrored offset for the two marks of a whole / 16th value).
 */
interface JankoClaspMarkExtents {
  halfWidth: number;
  halfHeight: number;
  stack: number;
}

/**
 * Half-extents of the bracket's open (half / whole) mark: one clean white
 * ring, or two stacked rings for a whole note. Uses the isolated
 * bracket-circle family (scale 0.80), not the standalone stem-ring constants.
 */
function claspOpenMark(count: number): JankoClaspMarkExtents {
  const r = BRACKET_RING_OUTER;
  return {
    halfWidth: r,
    halfHeight: r,
    stack: count <= 1 ? 0 : BRACKET_RING_RADIUS + CLASP_MARK_STACK_GAP,
  };
}

/**
 * Half-extents of one transverse subdivision mark (8th / 16th): a horizontal
 * rung, an up/down-raked slash, or a symmetrical cross-stitch.
 */
function claspFlagMark(
  style: JankoClaspDurationStyle,
  count: number,
  rake: number
): JankoClaspMarkExtents {
  const half = CLASP_TRANSVERSE_WIDTH / 2;
  const stroke = CLASP_TRANSVERSE_STROKE / 2;
  switch (style) {
    case 'kinetic-cross-slashes':
    case 'down-raked-slashes':
      return {
        halfWidth: half,
        halfHeight: half * rake + stroke,
        stack: count <= 1 ? 0 : CLASP_CROSS_SPACING / 2,
      };
    case 'cross-hatch-stitches': {
      // Each `×` spans the full rake vertically; stacked pairs therefore sit
      // `halfHeight + gap` from the midpoint so the two crosses stay distinct.
      const halfHeight = half * rake + stroke;
      return {
        halfWidth: half,
        halfHeight,
        stack: count <= 1 ? 0 : halfHeight + CLASP_MARK_STACK_GAP,
      };
    }
    case 'transverse-cross-bars':
    default:
      return {
        halfWidth: half,
        halfHeight: stroke,
        stack: count <= 1 ? 0 : CLASP_CROSS_SPACING / 2,
      };
  }
}

/**
 * One straight duration-mark segment of a clasp, in page pt.
 */
interface ClaspMarkSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** The spine y of every mark one duration-ink group paints (1 or 2, stacked). */
function claspMarkCenters(
  group: JankoClaspGroupGeometry,
  ink: ResolvedJankoClaspInk,
  rake: number
): number[] {
  const mark =
    ink.pips > 0
      ? claspOpenMark(ink.pips)
      : claspFlagMark(group.durationStyle, ink.flags, rake);
  return mark.stack === 0 ? [ink.centerY] : [ink.centerY - mark.stack, ink.centerY + mark.stack];
}

/** The straight segments one duration-ink group paints at `cy` ([] for a ring). */
function claspMarkSegments(
  group: JankoClaspGroupGeometry,
  cy: number,
  rake: number
): ClaspMarkSegment[] {
  const half = CLASP_TRANSVERSE_WIDTH / 2;
  const dy = half * rake;
  const x = group.claspX;
  switch (group.durationStyle) {
    case 'down-raked-slashes':
      return [{ x1: x - half, y1: cy - dy, x2: x + half, y2: cy + dy }];
    case 'cross-hatch-stitches':
      return [
        { x1: x - half, y1: cy + dy, x2: x + half, y2: cy - dy },
        { x1: x - half, y1: cy - dy, x2: x + half, y2: cy + dy },
      ];
    case 'transverse-cross-bars':
      return [{ x1: x - half, y1: cy, x2: x + half, y2: cy }];
    case 'kinetic-cross-slashes':
    default:
      return [{ x1: x - half, y1: cy + dy, x2: x + half, y2: cy - dy }];
  }
}

/** Distance (pt) from a point to one segment. */
function pointToSegment(x: number, y: number, s: ClaspMarkSegment): number {
  const dx = s.x2 - s.x1;
  const dy = s.y2 - s.y1;
  const length2 = dx * dx + dy * dy;
  const u =
    length2 <= 0 ? 0 : Math.max(0, Math.min(1, ((x - s.x1) * dx + (y - s.y1) * dy) / length2));
  return Math.hypot(x - (s.x1 + u * dx), y - (s.y1 + u * dy));
}

/**
 * Round 46 performance guard: the midpoint mark's **daylight primitives** —
 * the fixed cut segments and ring descriptors of one ink chip on one mount.
 *
 * The dot seat search evaluates {@link claspMarkDaylight} at every candidate
 * position of every dotted mark (~5.7M calls on the Brahms Reference), and the
 * primitives depend only on the ink chip, the group's mount x/scale and the
 * token set — never on the point being tested. They are therefore derived once
 * per ink chip (weakly, so nothing is retained) and the per-call work is the
 * same arithmetic the previous code did, without re-deriving the metrics or
 * re-allocating the mark-offset arrays.
 */
interface ClaspDaylightPrimitives {
  claspX: number;
  strokeWidth: number;
  durationScale: number;
  t: ResolvedJankoTokens;
  /** 45-degree cut strokes: centre y plus the fixed slash vector/half-width. */
  cuts: number[];
  slashDx: number;
  slashDy: number;
  slashStrokeHalf: number;
  /** Rings: centre y, centreline radius and stroke half-width. */
  rings: { cy: number; radius: number; strokeHalf: number; halfRing: boolean }[];
}

const CLASP_DAYLIGHT_PRIMITIVES = new WeakMap<ResolvedJankoClaspInk, ClaspDaylightPrimitives>();

function claspDaylightPrimitives(
  group: JankoClaspGroupGeometry,
  ink: ResolvedJankoClaspInk,
  t: ResolvedJankoTokens
): ClaspDaylightPrimitives {
  const cached = CLASP_DAYLIGHT_PRIMITIVES.get(ink);
  if (
    cached &&
    cached.claspX === group.claspX &&
    cached.strokeWidth === group.strokeWidth &&
    cached.durationScale === group.durationScale &&
    cached.t === t
  ) {
    return cached;
  }
  const m = midpointMetrics(t, group.durationScale);
  const cuts = midpointMarkOffsets(m, 'bracket', 'cut', ink.compactCuts).map((dy) => ink.centerY + dy);
  const rings = midpointMarkOffsets(m, 'bracket', 'ring', ink.compactRings).map((dy) => ({
    cy: ink.centerY + dy,
    radius: m.bracketRingRadius,
    strokeHalf: m.bracketRingStroke / 2,
    halfRing: ink.compactHalfRing,
  }));
  const primitives: ClaspDaylightPrimitives = {
    claspX: group.claspX,
    strokeWidth: group.strokeWidth,
    durationScale: group.durationScale,
    t,
    cuts,
    slashDx: m.slashDx,
    slashDy: m.slashDy,
    slashStrokeHalf: m.slashStroke / 2,
    rings,
  };
  CLASP_DAYLIGHT_PRIMITIVES.set(ink, primitives);
  return primitives;
}

/**
 * Air (pt) the dot's ink at `(x, y)` keeps from all of its own mark's ink.
 *
 * The midpoint branch measures the **actual** family ink: the cuts' 45-degree
 * strokes, the full ring's annulus, and the half-ring's **one-sided** arc (its
 * chord is the spine, so a dot on the right of the spine only has the stroke's
 * own half-width to clear).
 */
export function claspMarkDaylight(
  group: JankoClaspGroupGeometry,
  ink: ResolvedJankoClaspInk,
  x: number,
  y: number,
  t: ResolvedJankoTokens
): number {
  const r = t.augmentationDotRadius;
  const half = group.strokeWidth / 2;
  let air = Math.abs(x - group.claspX) - half - r;
  if (ink.bracketGrammar === 'midpoint') {
    const c = claspDaylightPrimitives(group, ink, t);
    const { claspX } = c;
    for (const cy of c.cuts) {
      air = Math.min(
        air,
        pointToSegment(x, y, {
          x1: claspX - c.slashDx / 2,
          y1: cy + c.slashDy / 2,
          x2: claspX + c.slashDx / 2,
          y2: cy - c.slashDy / 2,
        }) -
          c.slashStrokeHalf -
          r
      );
    }
    for (const ring of c.rings) {
      const dx = x - claspX;
      const dyy = y - ring.cy;
      if (!ring.halfRing) {
        air = Math.min(
          air,
          Math.abs(Math.hypot(dx, dyy) - ring.radius) - ring.strokeHalf - r
        );
        continue;
      }
      // Half-ring (left bulge): the arc's ink only exists for dx <= 0.
      const onArc = dx <= 1e-9;
      const d = onArc
        ? Math.abs(Math.hypot(dx, dyy) - ring.radius)
        : Math.hypot(Math.max(dx, 0), Math.max(Math.abs(dyy) - ring.radius, 0));
      air = Math.min(air, d - ring.strokeHalf - r);
    }
    return air;
  }
  for (const cy of claspMarkCenters(group, ink, t.maxBeamSlope)) {
    if (ink.pips > 0) {
      air = Math.min(
        air,
        Math.hypot(x - group.claspX, y - cy) - BRACKET_RING_OUTER - r
      );
      continue;
    }
    // A plain spire (a quarter) paints the bracket alone: no transverse ink.
    if (ink.flags === 0) continue;
    for (const segment of claspMarkSegments(group, cy, t.maxBeamSlope)) {
      air = Math.min(air, pointToSegment(x, y, segment) - CLASP_TRANSVERSE_STROKE / 2 - r);
    }
  }
  return air;
}

/**
 * The direction fan the dot is placed along, shallowest first (degrees above
 * +x): the classical up-and-right satellite first, then the free lower channel
 * as the last resort for a cluster whose upper channel is walled by its own
 * heads.
 */
const CLASP_DOT_ANGLES: readonly number[] = [
  45, 50, 55, 60, 65, 70, 75, 80, 85, -45, -55, -65, -75, -85,
];

/** 2D distance from a point to an axis-aligned rectangle (0 inside). */
function pointToRect(
  px: number,
  py: number,
  rx0: number,
  ry0: number,
  rx1: number,
  ry1: number
): number {
  const dx = Math.max(rx0 - px, 0, px - rx1);
  const dy = Math.max(ry0 - py, 0, py - ry1);
  return Math.hypot(dx, dy);
}

/** True when the segment touches or crosses the rectangle. */
function segmentHitsRect(
  s: ClaspMarkSegment,
  rx0: number,
  ry0: number,
  rx1: number,
  ry1: number
): boolean {
  if (
    (s.x1 >= rx0 && s.x1 <= rx1 && s.y1 >= ry0 && s.y1 <= ry1) ||
    (s.x2 >= rx0 && s.x2 <= rx1 && s.y2 >= ry0 && s.y2 <= ry1)
  ) {
    return true;
  }
  const edges: ClaspMarkSegment[] = [
    { x1: rx0, y1: ry0, x2: rx1, y2: ry0 },
    { x1: rx1, y1: ry0, x2: rx1, y2: ry1 },
    { x1: rx1, y1: ry1, x2: rx0, y2: ry1 },
    { x1: rx0, y1: ry1, x2: rx0, y2: ry0 },
  ];
  const orient = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number =>
    (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  for (const e of edges) {
    const d1 = orient(e.x1, e.y1, e.x2, e.y2, s.x1, s.y1);
    const d2 = orient(e.x1, e.y1, e.x2, e.y2, s.x2, s.y2);
    const d3 = orient(s.x1, s.y1, s.x2, s.y2, e.x1, e.y1);
    const d4 = orient(s.x1, s.y1, s.x2, s.y2, e.x2, e.y2);
    if ((d1 > 0) !== (d2 > 0) && (d3 > 0) !== (d4 > 0)) return true;
    if (d1 === 0 || d2 === 0 || d3 === 0 || d4 === 0) {
      // Collinear touch: fall back to endpoint proximity (exact collinear
      // overlap is measure-zero for engraved geometry; proximity decides).
      if (
        pointToSegment(s.x1, s.y1, e) < 1e-9 ||
        pointToSegment(s.x2, s.y2, e) < 1e-9 ||
        pointToSegment(e.x1, e.y1, s) < 1e-9 ||
        pointToSegment(e.x2, e.y2, s) < 1e-9
      ) {
        return true;
      }
    }
  }
  return false;
}

/** 2D distance from a segment to an axis-aligned rectangle (0 on contact). */
function segmentToRect(
  s: ClaspMarkSegment,
  rx0: number,
  ry0: number,
  rx1: number,
  ry1: number
): number {
  if (segmentHitsRect(s, rx0, ry0, rx1, ry1)) return 0;
  return Math.min(
    pointToRect(s.x1, s.y1, rx0, ry0, rx1, ry1),
    pointToRect(s.x2, s.y2, rx0, ry0, rx1, ry1),
    pointToSegment(rx0, ry0, s),
    pointToSegment(rx1, ry0, s),
    pointToSegment(rx1, ry1, s),
    pointToSegment(rx0, ry1, s)
  );
}

/**
 * Permanent rule — **own-member bracket daylight** (pt): the minimum 2D
 * daylight from one member's actual mask rectangle to the bracket's own ink —
 * the spine, both caps and every duration mark (open rings, transverse cuts).
 * Positive means the bracket clears its own heads; zero or negative is real
 * ink cutting a member (the fit rule's own-member skip assumes this never
 * happens — the linter's `clasp-collision` audit now verifies it instead of
 * trusting it). Augmentation dots are excluded: the `clasp-dot-fusion` audit
 * owns their hug metric.
 */
export function claspOwnMemberAir(
  group: JankoClaspGroupGeometry,
  memberX: number,
  memberY: number,
  maskWx: number,
  maskHy: number,
  t: ResolvedJankoTokens
): number {
  const rx0 = memberX - maskWx;
  const ry0 = memberY - maskHy;
  const rx1 = memberX + maskWx;
  const ry1 = memberY + maskHy;
  const half = group.strokeWidth / 2;
  let air = segmentToRect(
    { x1: group.claspX, y1: group.topY, x2: group.claspX, y2: group.botY },
    rx0,
    ry0,
    rx1,
    ry1
  ) - half;
  for (const capY of [group.topY, group.botY]) {
    air = Math.min(
      air,
      segmentToRect(
        { x1: group.claspX, y1: capY, x2: group.claspX + group.capWidth, y2: capY },
        rx0,
        ry0,
        rx1,
        ry1
      ) - half
    );
  }
  const rake = t.maxBeamSlope;
  for (const ink of group.durationInk ?? []) {
    for (const cy of claspMarkCenters(group, ink, rake)) {
      if (ink.pips > 0) {
        const ringOuter = BRACKET_RING_OUTER;
        const dx = Math.max(rx0 - group.claspX, 0, group.claspX - rx1);
        const dy = Math.max(ry0 - cy, 0, cy - ry1);
        air = Math.min(air, Math.hypot(dx, dy) - ringOuter);
        continue;
      }
      if (ink.flags === 0) continue;
      for (const segment of claspMarkSegments(group, cy, rake)) {
        air = Math.min(air, segmentToRect(segment, rx0, ry0, rx1, ry1) - CLASP_TRANSVERSE_STROKE / 2);
      }
    }
  }
  return air;
}

/**
 * Permanent dot-consistency rule — **actual member-mask daylight** (pt) of a
 * dot's disc at `(x, y)`: the minimum over the bracket's own members of the 2D
 * distance from the dot centre to the member's painted knockout rectangle
 * minus the dot radius. The rectangle is the active cluster-spacing preset's
 * `wx × hy`, grown to the halo ring's outer edge for a tick-0 member exactly
 * when honor halos paint (mirroring the knockout). Positive means the dot
 * clears actual ink; zero or negative is a real erasure collision. The retired
 * virtual 4.8pt-disc hug vetoed seats (the Brahms m.1 opening dot sat at 60°)
 * whose actual ink clears (m.19's 45° seat) — that false veto is deleted.
 */
export function claspDotMemberAir(
  x: number,
  y: number,
  group: JankoClaspGroupGeometry,
  t: ResolvedJankoTokens,
  spacing?: JankoClusterSpacing | null,
  honorHalo?: boolean
): number {
  if (group.notes.length === 0) return Number.POSITIVE_INFINITY;
  const preset = getClusterSpacingPreset(spacing);
  const r = t.augmentationDotRadius;
  const haloEdge = t.haloRadius + JANKO_HALO_STROKE_WIDTH / 2;
  return Math.min(
    ...group.notes.map((n) => {
      const grown = honorHalo === true && isPositionOfHonor(n.startTick);
      const wx = grown ? Math.max(preset.wx, haloEdge) : preset.wx;
      const hy = grown ? Math.max(preset.hy, haloEdge) : preset.hy;
      const dx = Math.max(Math.abs(x - n.x) - wx, 0);
      const dy = Math.max(Math.abs(y - n.y) - hy, 0);
      return Math.hypot(dx, dy) - r;
    })
  );
}

/** Member-geometry options accepted by the dot seat solvers. */
export interface JankoClaspDotSeatOptions {
  clusterSpacing?: JankoClusterSpacing | null;
  honorHalo?: boolean;
}

/**
 * Round 20 — **the clasp dot as a clean satellite of its mark**.
 *
 * The dot is placed up-and-right of its mark, tracking the mark's own edge, so
 * it reads as an augmentation dot and never fuses with the ink it belongs to.
 * Two constraints are absolute:
 *
 * - **hug air from the mark** — the dot's 0.75pt disc keeps the house dot hug
 *   (`tokens.augmentationDotGap`) from the spine, from the open ring(s) and
 *   from every transverse cut, in 2D. The retired `yMid` wedge sat inside the
 *   ring's own stroke *and* inside a middle member's knockout — that channel is
 *   infeasible, which is exactly why it is rejected;
 * - **actual clearance from every member mask** — the dot must not overlap the
 *   cluster's own painted knockout rectangles (which the bracket's fit rule
 *   exempts, but the notehead knockout would erase). Measured by
 *   {@link claspDotMemberAir}: positive actual daylight passes, an actual
 *   collision vetoes. The retired virtual-disc hug is deleted — it vetoed the
 *   Brahms m.1 opening seat at 45° (virtual −0.18pt) although its actual ink
 *   clears (+0.53pt), while the same dotted-pip type sits at 45° in m.19.
 *
 * The search is deterministic: a fan of directions from 45° (the classical
 * up-and-right satellite) to nearly vertical — and, for a cluster whose upper
 * channel is walled by its own heads, the free lower channel as the last
 * resort — and along each direction the nearest point that clears the mark. Of
 * every candidate that also clears each member mask, the one **nearest its
 * mark** wins (so the dot always hugs its own ink); if none does — never on
 * the corpus, and the linter's `clasp-dot-fusion` would say so — the
 * best-clearing candidate is returned rather than shrinking the air silently.
 */
export function claspDotCenter(
  group: JankoClaspGroupGeometry,
  ink: ResolvedJankoClaspInk,
  tokens?: Partial<JankoTokens> | null,
  dotOptions?: JankoClaspDotSeatOptions | null
): { x: number; y: number } {
  const t = resolveJankoTokens(tokens);
  const hug = t.augmentationDotGap;
  const memberAir = (x: number, y: number): number =>
    claspDotMemberAir(x, y, group, t, dotOptions?.clusterSpacing, dotOptions?.honorHalo);
  let clean: { x: number; y: number; d: number } | null = null;
  let best: { x: number; y: number; air: number } | null = null;
  for (const degrees of CLASP_DOT_ANGLES) {
    const angle = (degrees * Math.PI) / 180;
    const ux = Math.cos(angle);
    const uy = -Math.sin(angle);
    for (let d = 0; d <= 24; d += 0.01) {
      const x = group.claspX + d * ux;
      const y = ink.centerY + d * uy;
      if (claspMarkDaylight(group, ink, x, y, t) < hug - 1e-9) continue;
      const air = memberAir(x, y);
      if (best === null || air > best.air) best = { x, y, air };
      if (air >= -1e-9 && (clean === null || d < clean.d - 1e-9)) clean = { x, y, d };
      break;
    }
  }
  if (clean) return { x: clean.x, y: clean.y };
  return best ?? { x: group.claspX + CLASP_DOT_OFFSET, y: ink.centerY - CLASP_DOT_OFFSET };
}

/**
 * Round 30 — **the bracket's second dot**.
 *
 * A doubly dotted carried value dots twice: the second dot continues the
 * first dot's escape further along the same up-right fan, keeping the house
 * hug from the mark and from its own sibling dot (edge to edge) and actual
 * clearance from every member mask. The search mirrors {@link claspDotCenter}
 * — the same direction fan, nearest-to-the-mark wins — but measures distance
 * from the FIRST dot, so the pair reads as one classical double-dot satellite.
 * The linter's `clasp-dot-fusion` audits the same three airs.
 */
export function claspSecondDotCenter(
  group: JankoClaspGroupGeometry,
  ink: ResolvedJankoClaspInk,
  first: { x: number; y: number },
  tokens?: Partial<JankoTokens> | null,
  dotOptions?: JankoClaspDotSeatOptions | null
): { x: number; y: number } {
  const t = resolveJankoTokens(tokens);
  const hug = t.augmentationDotGap;
  const r = t.augmentationDotRadius;
  const siblingGap = 2 * r + hug;
  const memberAir = (x: number, y: number): number =>
    claspDotMemberAir(x, y, group, t, dotOptions?.clusterSpacing, dotOptions?.honorHalo);
  let clean: { x: number; y: number; d: number } | null = null;
  let best: { x: number; y: number; air: number } | null = null;
  for (const degrees of CLASP_DOT_ANGLES) {
    const angle = (degrees * Math.PI) / 180;
    const ux = Math.cos(angle);
    const uy = -Math.sin(angle);
    for (let d = 0; d <= 24; d += 0.01) {
      const x = first.x + d * ux;
      const y = first.y + d * uy;
      // The sibling dot is the first obstacle: the pair starts one full
      // sibling gap apart and only ever spreads from there.
      if (Math.hypot(x - first.x, y - first.y) < siblingGap - 1e-9) continue;
      if (claspMarkDaylight(group, ink, x, y, t) < hug - 1e-9) continue;
      const air = memberAir(x, y);
      if (best === null || air > best.air) best = { x, y, air };
      if (air >= -1e-9 && (clean === null || d < clean.d - 1e-9)) clean = { x, y, d };
      break;
    }
  }
  if (clean) return { x: clean.x, y: clean.y };
  return (
    best ?? {
      x: first.x + siblingGap,
      y: first.y,
    }
  );
}

/**
 * The duration ink of one clasp in the active Round 11 midpoint paradigm. Every
 * mark is anchored on `yMid = (topY + botY) / 2` and cuts symmetrically across
 * the spine, so the bracket stays a mirror-symmetrical `[` whatever value it
 * carries. The rendered marks and {@link claspInkBox} share the same mark
 * geometry, so the audited box can never drift from the painted ink.
 *
 * | value        | ink                                                      |
 * | ------------ | -------------------------------------------------------- |
 * | half / whole | 1 / 2 open white rings across the spine                   |
 * | quarter      | the plain bracket (a continuous solid spine)              |
 * | dotted       | + the 0.75pt augmentation dot, a satellite of the mark     |
 * | 8th          | 1 light transverse cut (rung / slash / stitch)            |
 * | 16th         | 2 parallel cuts, mirrored about the midpoint              |
 */
function renderClaspDurationInk(
  group: JankoClaspGroupGeometry,
  t: ResolvedJankoTokens
): string[] {
  const out: string[] = [];
  const claspX = group.claspX;
  const stroke = CLASP_TRANSVERSE_STROKE.toFixed(2);
  const rake = t.maxBeamSlope;
  const groups =
    group.durationInk && group.durationInk.length > 0
      ? group.durationInk
      : [resolveClaspInk({ centerY: (group.topY + group.botY) / 2, durationTicks: group.durationTicks })];

  for (const [index, ink] of groups.entries()) {
    const yMid = ink.centerY;
    if (ink.bracketGrammar === 'midpoint') {
      // Round 43 study / Round 44: the one 45-degree family paints 1-4
      // page-oriented positive-45-degree slashes (stacked vertically) and 1-3
      // rings, centred on the spine's midpoint — at the admitted cluster's own
      // symbol scale. Every dimension comes from {@link midpointMetrics}, the
      // one metric the renderer, the ink box, the fit rule and the linter share.
      const m = midpointMetrics(t, group.durationScale);
      const sx = m.slashDx / 2;
      const sy = m.slashDy / 2;
      const stroke = m.slashStroke.toFixed(2);
      for (const dy of midpointMarkOffsets(m, 'bracket', 'cut', ink.compactCuts)) {
        out.push(
          `    <line class="janko-clasp-cut" x1="${f(claspX - sx)}" y1="${f(yMid + dy + sy)}" x2="${f(claspX + sx)}" y2="${f(yMid + dy - sy)}" stroke="#111111" stroke-width="${stroke}" stroke-linecap="butt"/>`
        );
      }
      // Round 46: the bracket mount's ring/half-ring is the larger one
      // (`midpointBracketRingScale`); a lone half-ring bulges LEFT, its chord
      // resting on the spine. Round 47: the mount's own long-value family
      // paints the mark (the same ring/half-ring pair, or the open ovals), and
      // a half-ring's flat face is declared as a spine interruption
      // (`group.spineGaps`) instead of being closed by the spine line.
      for (const dy of midpointMarkOffsets(m, 'bracket', 'ring', ink.compactRings)) {
        const mark = longValueMarkForBase(
          ink.compactBase,
          group.longDurationStyle,
          'bracket',
          m,
          t,
          claspX,
          yMid + dy,
          'janko-clasp-compact-ring',
          group.halfRingGap
        );
        if (mark) out.push(...mark.svg);
      }
    } else if (ink.bracketGrammar === 'compact') {
      // Round 42 study: the compact family paints 1-4 short cuts (transverse,
      // stacked vertically at compactMarkSpacing) and 1-3 open elongation
      // rings; both centred on the spine's midpoint, so the bracket stays a
      // mirror-symmetrical `[`. The geometry is shared with onBracketCompactBox
      // below (one metric), so render and audit can never drift.
      const cutHalf = t.compactCutLength / 2;
      const cutStroke = t.compactMarkStroke.toFixed(2);
      for (const dy of compactMarkOffsets(t, ink.compactCuts)) {
        out.push(
          `    <line class="janko-clasp-cut" x1="${f(claspX - cutHalf)}" y1="${f(yMid + dy)}" x2="${f(claspX + cutHalf)}" y2="${f(yMid + dy)}" stroke="#111111" stroke-width="${cutStroke}" stroke-linecap="butt"/>`
        );
      }
      for (const dy of compactMarkOffsets(t, ink.compactRings)) {
        out.push(
          `    <circle class="janko-clasp-compact-ring" cx="${f(claspX)}" cy="${f(yMid + dy)}" r="${f(t.compactRingRadius)}" fill="#FFFFFF" stroke="#111111" stroke-width="${t.compactRingStroke.toFixed(2)}"/>`
        );
      }
    } else {
      const open = ink.pips > 0;
      const hasMark = open || ink.flags > 0;
      const mark = open
        ? claspOpenMark(ink.pips)
        : claspFlagMark(group.durationStyle, ink.flags, rake);
      const centers = mark.stack === 0 ? [yMid] : [yMid - mark.stack, yMid + mark.stack];

      for (const cy of hasMark ? centers : []) {
        if (open) {
          // Every paradigm shares the clean open white ring: its 100% white
          // interior knocks the spine out with zero crosshairs. Bracket-circle
          // family (scale 0.80), isolated from standalone stem rings.
          out.push(
            `    <circle class="janko-clasp-ring" cx="${f(claspX)}" cy="${f(cy)}" r="${f(BRACKET_RING_RADIUS)}" fill="#FFFFFF" stroke="#111111" stroke-width="${BRACKET_RING_STROKE.toFixed(2)}"/>`
          );
          continue;
        }

        const half = CLASP_TRANSVERSE_WIDTH / 2;
        const dy = half * rake;
        switch (group.durationStyle) {
          case 'kinetic-cross-slashes':
            // Up-raked: the cut rises from left to right.
            out.push(
              `    <line class="janko-clasp-slash" x1="${f(claspX - half)}" y1="${f(cy + dy)}" x2="${f(claspX + half)}" y2="${f(cy - dy)}" stroke="#111111" stroke-width="${stroke}" stroke-linecap="butt"/>`
            );
            break;
          case 'down-raked-slashes':
            // Down-raked: the mirrored cut falls from left to right.
            out.push(
              `    <line class="janko-clasp-slash" x1="${f(claspX - half)}" y1="${f(cy - dy)}" x2="${f(claspX + half)}" y2="${f(cy + dy)}" stroke="#111111" stroke-width="${stroke}" stroke-linecap="butt"/>`
            );
            break;
          case 'cross-hatch-stitches':
            // A symmetrical `×`: both rakes cross on the spine's own centreline.
            out.push(
              `    <path class="janko-clasp-stitch" d="M ${f(claspX - half)} ${f(cy + dy)} L ${f(claspX + half)} ${f(cy - dy)} M ${f(claspX - half)} ${f(cy - dy)} L ${f(claspX + half)} ${f(cy + dy)}" fill="none" stroke="#111111" stroke-width="${stroke}" stroke-linecap="butt"/>`
            );
            break;
          case 'transverse-cross-bars':
          default:
            out.push(
              `    <line class="janko-clasp-bar" x1="${f(claspX - half)}" y1="${f(cy)}" x2="${f(claspX + half)}" y2="${f(cy)}" stroke="#111111" stroke-width="${stroke}" stroke-linecap="butt"/>`
            );
            break;
        }
      }
    }

    // A dotted value adds the canonical 0.75pt augmentation dot as a clean
    // satellite of the mark (Round 20), painted last so a white knockout can
    // never erase it. The resolved dot centre is the geometry's own datum.
    if (ink.dotted) {
      const dot = group.durationDots?.[index] ?? claspDotCenter(group, ink, t);
      out.push(
        `    <circle class="janko-clasp-dot" cx="${f(dot.x)}" cy="${f(dot.y)}" r="${f(t.augmentationDotRadius)}" fill="#111111"/>`
      );
      // Round 30: a doubly dotted carried value dots twice — the second dot
      // further along the same escape, tagged `data-dot="2"` so the pair
      // counts honestly. First dots keep their exact golden markup.
      if (ink.dots >= 2) {
        const dot2 =
          group.durationSecondDots?.[index] ?? claspSecondDotCenter(group, ink, dot, t);
        out.push(
          `    <circle class="janko-clasp-dot" data-dot="2" cx="${f(dot2.x)}" cy="${f(dot2.y)}" r="${f(t.augmentationDotRadius)}" fill="#111111"/>`
        );
      }
    }
  }
  return out;
}

/**
 * Axis-aligned ink box of one clasp: spine, caps and the active paradigm's
 * duration ink. Shared by the visual linter and the column solver, so the
 * audited box can never drift from the painted ink.
 */
export function claspInkBox(
  group: JankoClaspGroupGeometry,
  tokens?: Partial<JankoTokens> | null
): { x0: number; y0: number; x1: number; y1: number } {
  const t = resolveJankoTokens(tokens);
  let x0 = group.claspX;
  let x1 = group.claspX + group.capWidth;
  let y0 = group.topY;
  let y1 = group.botY;

  // Round 19: every duration-ink group of the bracket, not just the primary
  // one, so a unified bracket's per-hand marks are covered by the audited box.
  const inks =
    group.durationInk && group.durationInk.length > 0
      ? group.durationInk
      : [resolveClaspInk({ centerY: (group.topY + group.botY) / 2, durationTicks: group.durationTicks })];
  for (const [index, ink] of inks.entries()) {
    const yMid = ink.centerY;
    if (ink.bracketGrammar === 'midpoint') {
      // Round 43 study / Round 44: the same 45-degree mark geometry the
      // renderer paints, from the shared {@link midpointMetrics} at the
      // bracket's own admitted cluster scale. Every cut offset is a vertical
      // stacking offset; the ink box spans the largest run half-span plus the
      // mark's own along-axis half-extent.
      const m = midpointMetrics(t, group.durationScale);
      const cutSpan =
        ink.compactCuts > 0
          ? (midpointMarkOffsets(m, 'bracket', 'cut', ink.compactCuts).at(-1) ?? 0)
          : 0;
      const ringSpan =
        ink.compactRings > 0
          ? (midpointMarkOffsets(m, 'bracket', 'ring', ink.compactRings).at(-1) ?? 0)
          : 0;
      let hw = m.slashHalfX;
      let hh = m.slashHalfY;
      let leftReach = m.slashHalfX;
      if (ink.compactRings > 0) {
        // Round 46/47: the bracket mount's own (larger) mark box — a half-ring
        // reaches only to its chord on the right, an open oval reaches both
        // ways and adds its breve flanks. Read from the same
        // {@link longValueMark} the renderer paints.
        for (const dy of midpointMarkOffsets(m, 'bracket', 'ring', ink.compactRings)) {
          const mark = longValueMarkForBase(
            ink.compactBase,
            group.longDurationStyle,
            'bracket',
            m,
            t,
            group.claspX,
            yMid + dy,
            'janko-clasp-compact-ring',
            group.halfRingGap
          );
          if (!mark) continue;
          hw = Math.max(hw, mark.box.x1 - group.claspX);
          hh = Math.max(hh, (mark.box.y1 - mark.box.y0) / 2);
          leftReach = Math.max(leftReach, group.claspX - mark.box.x0);
        }
      }
      if (ink.compactCuts > 0 || ink.compactRings > 0) {
        x0 = Math.min(x0, group.claspX - leftReach);
        x1 = Math.max(x1, group.claspX + hw);
        y0 = Math.min(y0, yMid - Math.max(cutSpan, ringSpan) - hh);
        y1 = Math.max(y1, yMid + Math.max(cutSpan, ringSpan) + hh);
      }
    } else if (ink.bracketGrammar === 'compact') {
      // Round 42 study: the same compact-mark geometry the renderer paints.
      const span = Math.max(
        compactStackCentreSpan(t, ink.compactCuts),
        compactStackCentreSpan(t, ink.compactRings)
      );
      let hw = 0;
      let hh = 0;
      if (ink.compactCuts > 0) {
        const e = compactMarkHalfExtents(t, 'cut');
        hw = Math.max(hw, e.hw);
        hh = Math.max(hh, e.hh);
      }
      if (ink.compactRings > 0) {
        const e = compactMarkHalfExtents(t, 'ring');
        hw = Math.max(hw, e.hw);
        hh = Math.max(hh, e.hh);
      }
      if (hw > 0 || hh > 0) {
        x0 = Math.min(x0, group.claspX - hw);
        x1 = Math.max(x1, group.claspX + hw);
        y0 = Math.min(y0, yMid - span - hh);
        y1 = Math.max(y1, yMid + span + hh);
      }
    } else if (ink.pips > 0 || ink.flags > 0) {
      const mark =
        ink.pips > 0
          ? claspOpenMark(ink.pips)
          : claspFlagMark(group.durationStyle, ink.flags, t.maxBeamSlope);
      x0 = Math.min(x0, group.claspX - mark.halfWidth);
      x1 = Math.max(x1, group.claspX + mark.halfWidth);
      y0 = Math.min(y0, yMid - mark.stack - mark.halfHeight);
      y1 = Math.max(y1, yMid + mark.stack + mark.halfHeight);
    }
    if (ink.dotted) {
      // Round 20: the dot is a satellite of its mark, so the audited box
      // follows the painted dot exactly — on every side it can now reach.
      const dot = group.durationDots?.[index] ?? claspDotCenter(group, ink, t);
      x0 = Math.min(x0, dot.x - t.augmentationDotRadius);
      x1 = Math.max(x1, dot.x + t.augmentationDotRadius);
      y0 = Math.min(y0, dot.y - t.augmentationDotRadius);
      y1 = Math.max(y1, dot.y + t.augmentationDotRadius);
      // Round 30: the second dot of a doubly dotted group rides the same box.
      if (ink.dots >= 2) {
        const dot2 =
          group.durationSecondDots?.[index] ?? claspSecondDotCenter(group, ink, dot, t);
        x0 = Math.min(x0, dot2.x - t.augmentationDotRadius);
        x1 = Math.max(x1, dot2.x + t.augmentationDotRadius);
        y0 = Math.min(y0, dot2.y - t.augmentationDotRadius);
        y1 = Math.max(y1, dot2.y + t.augmentationDotRadius);
      }
    }
  }
  return { x0, y0, x1, y1 };
}

/**
 * Round 42 study — one **horizontal exception carrier**.
 *
 * When a shared-duration bracket carries one value and one of its admitted
 * members states a *different* one, that member is an **exception**. Under the
 * study's `exceptionCarrier: 'horizontal'` the member gives up its own
 * stem/flag ink for a **fixed-length** horizontal carrier at its true pitch y,
 * painted with the member's own compact marks arranged **along** it. The
 * carrier's length is a typographic token ({@link JankoTokens.exceptionCarrierLength}),
 * **independent of the member's duration and of its release** — so it can never
 * be misread as a release instant.
 */
export interface JankoExceptionCarrierGeometry {
  /** Source note id that owns the carrier (single-note ownership). */
  noteId: string;
  /**
   * Round 46: the **second owner** of a shared indicator. Two same-hand,
   * same-onset, exactly-equal-duration 2-span neighbours may share one
   * horizontal indicator (centred on their painted columns) instead of
   * painting two parallel carriers for one shared value; the carrier then owns
   * both members' duration statements.
   */
  partnerId?: string;
  /** Onset tick of the owning member. */
  tick: number;
  /** True pitch y of the owning member (the pitch symbol is never moved). */
  y: number;
  /** Left attachment edge (pt): the member's protected mask right edge + air. */
  x0: number;
  /** Right edge (pt) — `x0 + t.exceptionCarrierLength`, value-independent. */
  x1: number;
  /** The member's own stated duration (ticks). */
  durationTicks: number;
  /** Compact cuts along the carrier (0–4). */
  cuts: number;
  /** Elongation rings along the carrier (0–2 in the Round 46 midpoint family). */
  rings: number;
  /** Round 46: the single ring mark of this run is a half-ring (bulge up). */
  halfRing: boolean;
  /** Augmentation dots of the member's own value. */
  dots: 0 | 1 | 2;
  /** False when the member's value has no exact reading (never faked). */
  inGrammar: boolean;
  /**
   * Round 44: the admitted cluster's **symbol scale** the carrier's ink is
   * engraved at — the member's own reduced scale, so the duration ink shrinks
   * with its numerals. The carrier stroke, every mark and the fixed length all
   * scale coherently with it.
   */
  scale: number;
  /** Carrier stroke width (pt) — the family weight at the admitted scale. */
  stroke: number;
  /** The active bracket/mark family (`'compact'` or `'midpoint'`). */
  grammar: JankoBracketDurationGrammar;
  /**
   * Round 47: the analysed **base value** of the member's own statement (`0`
   * out of grammar) — the value that selects the long mark shape of the active
   * {@link JankoLongDurationStyle}.
   */
  base: number;
  /** Round 47: the long-value symbol family this carrier's marks belong to. */
  longStyle: JankoLongDurationStyle;
  /**
   * Round 47: the air (pt) the horizontal mount is interrupted by across a
   * half-ring's chord (`halfRingGap`). `0` keeps the incumbent unbroken
   * carrier line.
   */
  halfRingGap: number;
}

/**
 * The marks of one compact run, centred on the carrier midpoint: the end-to-end
 * centre distance is `(count − 1) · compactMarkSpacing`. Shared by the renderer
 * and {@link exceptionCarrierInkBox}, so the audited box can never drift from
 * the painted marks.
 */
function exceptionCarrierMarkCentres(
  g: JankoExceptionCarrierGeometry,
  t: ResolvedJankoTokens
): { cuts: number[]; rings: number[] } {
  const xm = (g.x0 + g.x1) / 2;
  if (g.grammar === 'midpoint') {
    const m = midpointMetrics(t, g.scale);
    return {
      cuts: midpointMarkOffsets(m, 'carrier', 'cut', g.cuts).map((dx) => xm + dx),
      rings: midpointMarkOffsets(m, 'carrier', 'ring', g.rings).map((dx) => xm + dx),
    };
  }
  return {
    cuts: compactMarkOffsets(t, g.cuts).map((dx) => xm + dx),
    rings: compactMarkOffsets(t, g.rings).map((dx) => xm + dx),
  };
}

/** Paint one horizontal exception carrier (Round 42 study). */
export function renderExceptionCarrier(
  g: JankoExceptionCarrierGeometry,
  tokens?: Partial<JankoTokens> | null
): string {
  const t = resolveJankoTokens(tokens);
  const out: string[] = [
    `  <g class="janko-exception-carrier" data-exception-note="${g.noteId}"${g.partnerId ? ` data-exception-partner="${g.partnerId}"` : ''} data-exception-ticks="${g.durationTicks}" data-exception-cuts="${g.cuts}" data-exception-rings="${g.rings}" data-exception-dots="${g.dots}" data-exception-in-grammar="${g.inGrammar}"${g.longStyle === 'open-oval' ? ` data-exception-long-style="open-oval" data-exception-base="${g.base}"` : ''}>`,
  ];
  const centres = exceptionCarrierMarkCentres(g, t);
  // Round 47: a half-ring's flat face interrupts the **carrier's own line**.
  // The carrier is emitted as the line's own intervals (nothing is masked and
  // no glyph ink is touched); an empty gap list is the canonical single line,
  // byte-for-byte.
  const mounts =
    g.grammar === 'midpoint' && g.halfRingGap > 0 && g.halfRing && centres.rings.length === 1
      ? (() => {
          const radius = midpointMetrics(t, g.scale).ringRadius;
          const chord = centres.rings[0];
          return [
            { x1: g.x0, x2: chord - radius - g.halfRingGap },
            { x1: chord + radius + g.halfRingGap, x2: g.x1 },
          ].filter((segment) => segment.x2 > segment.x1 + 1e-9);
        })()
      : [{ x1: g.x0, x2: g.x1 }];
  for (const segment of mounts) {
    out.push(
      `    <line class="janko-exception-carrier-line" x1="${f(segment.x1)}" y1="${f(g.y)}" x2="${f(segment.x2)}" y2="${f(g.y)}" stroke="#111111" stroke-width="${g.stroke.toFixed(2)}" stroke-linecap="butt"/>`
    );
  }
  if (g.grammar === 'midpoint') {
    // Round 43 study / Round 44: the SAME page-oriented positive-45-degree
    // slash and ring the bracket paints — at the SAME admitted symbol scale —
    // here stacked along the carrier. Every number is the shared
    // {@link midpointMetrics} value, so the two mounts cannot diverge.
    const m = midpointMetrics(t, g.scale);
    const sx = m.slashDx / 2;
    const sy = m.slashDy / 2;
    for (const cx of centres.cuts) {
      out.push(
        `    <line class="janko-exception-cut" x1="${f(cx - sx)}" y1="${f(g.y + sy)}" x2="${f(cx + sx)}" y2="${f(g.y - sy)}" stroke="#111111" stroke-width="${m.slashStroke.toFixed(2)}" stroke-linecap="butt"/>`
      );
    }
    // Round 46: the horizontal mount keeps the Round 45 ring size (the 20 %
    // enlargement is bracket-only) and a lone half-ring bulges UP, its
    // endpoints on the carrier line, painted `fill="none"` so the line it
    // stands on survives. Round 47: the mount's own long-value family paints
    // the mark, and the line is cut at the flat face.
    for (const cx of centres.rings) {
      const mark = longValueMarkForBase(
        g.base,
        g.longStyle,
        'carrier',
        m,
        t,
        cx,
        g.y,
        'janko-exception-ring',
        g.halfRingGap
      );
      if (mark) out.push(...mark.svg);
    }
  } else {
    const cutHalf = t.compactCutLength / 2;
    const cutStroke = t.compactMarkStroke.toFixed(2);
    for (const cx of centres.cuts) {
      out.push(
        `    <line class="janko-exception-cut" x1="${f(cx)}" y1="${f(g.y - cutHalf)}" x2="${f(cx)}" y2="${f(g.y + cutHalf)}" stroke="#111111" stroke-width="${cutStroke}" stroke-linecap="butt"/>`
      );
    }
    for (const cx of centres.rings) {
      out.push(
        `    <circle class="janko-exception-ring" cx="${f(cx)}" cy="${f(g.y)}" r="${f(t.compactRingRadius)}" fill="#FFFFFF" stroke="#111111" stroke-width="${t.compactRingStroke.toFixed(2)}"/>`
      );
    }
  }
  // The augmentation dot is the shared satellite of the run's right end.
  if (g.dots >= 1) {
    const dotX = g.x1 + t.augmentationDotGap + t.augmentationDotRadius;
    out.push(
      `    <circle class="janko-exception-dot" cx="${f(dotX)}" cy="${f(g.y)}" r="${f(t.augmentationDotRadius)}" fill="#111111"/>`
    );
    if (g.dots >= 2) {
      const dot2X = dotX + 2 * t.augmentationDotRadius + t.augmentationDotGap;
      out.push(
        `    <circle class="janko-exception-dot" data-dot="2" cx="${f(dot2X)}" cy="${f(g.y)}" r="${f(t.augmentationDotRadius)}" fill="#111111"/>`
      );
    }
  }
  out.push('  </g>');
  return out.join('\n');
}

/** Axis-aligned ink box of one horizontal exception carrier (shared metric). */
export function exceptionCarrierInkBox(
  g: JankoExceptionCarrierGeometry,
  tokens?: Partial<JankoTokens> | null
): { x0: number; y0: number; x1: number; y1: number } {
  const t = resolveJankoTokens(tokens);
  const mm = g.grammar === 'midpoint' ? midpointMetrics(t, g.scale) : null;
  const cut = mm
    ? { hw: mm.slashHalfX, hh: mm.slashHalfY }
    : compactMarkHalfExtents(t, 'cut');
  const ring = mm
    ? { hw: mm.ringHalf, hh: mm.ringHalf }
    : compactMarkHalfExtents(t, 'ring');
  const stateHalf = Math.max(g.cuts > 0 ? cut.hh : 0, g.rings > 0 ? ring.hh : 0, g.stroke / 2);
  let x0 = g.x0;
  let x1 = g.x1;
  let y0 = g.y - stateHalf;
  let y1 = g.y + stateHalf;
  if (g.cuts > 0) {
    const cs = exceptionCarrierMarkCentres(g, t).cuts;
    x0 = Math.min(x0, cs[0] - cut.hw);
    x1 = Math.max(x1, cs[cs.length - 1] + cut.hw);
  }
  if (g.rings > 0) {
    const rs = exceptionCarrierMarkCentres(g, t).rings;
    if (mm) {
      const first =
        longValueMarkForBase(g.base, g.longStyle, 'carrier', mm, t, rs[0], g.y, 'janko-exception-ring', g.halfRingGap)?.box ??
        midpointRingInkBox('carrier', mm, rs[0], g.y, g.halfRing);
      const last =
        longValueMarkForBase(g.base, g.longStyle, 'carrier', mm, t, rs[rs.length - 1], g.y, 'janko-exception-ring', g.halfRingGap)?.box ??
        midpointRingInkBox('carrier', mm, rs[rs.length - 1], g.y, g.halfRing);
      x0 = Math.min(x0, first.x0);
      x1 = Math.max(x1, last.x1);
      y0 = Math.min(y0, first.y0);
      y1 = Math.max(y1, last.y1);
    } else {
      x0 = Math.min(x0, rs[0] - ring.hw);
      x1 = Math.max(x1, rs[rs.length - 1] + ring.hw);
    }
  }
  if (g.dots >= 1) {
    const dotX = g.x1 + t.augmentationDotGap + t.augmentationDotRadius;
    x1 = Math.max(x1, dotX + t.augmentationDotRadius);
    y0 = Math.min(y0, g.y - t.augmentationDotRadius);
    y1 = Math.max(y1, g.y + t.augmentationDotRadius);
    if (g.dots >= 2) {
      const dot2X = dotX + 2 * t.augmentationDotRadius + t.augmentationDotGap;
      x1 = Math.max(x1, dot2X + t.augmentationDotRadius);
    }
  }
  return { x0, y0, x1, y1 };
}

/**
 * Round 43 repair — **one audited mark** of a horizontal exception carrier.
 *
 * The occlusion audit below needs the *individual* mark boxes, not just the
 * whole-carrier union: a fixed carrier can be far too long for the next onset
 * and lose a whole ring while its outer box still "fits". This is the same
 * geometry {@link renderExceptionCarrier} paints and {@link exceptionCarrierInkBox}
 * bounds — one metric, so an audit can never drift from the ink.
 */
export interface JankoExceptionCarrierMarkBox {
  /** Which mark primitive the box belongs to. */
  kind: 'cut' | 'ring' | 'dot';
  /** Zero-based index of the mark in its own run (dots: 0 / 1). */
  index: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Axis-aligned ink box of every mark one horizontal exception carrier paints —
 * the union of these boxes is exactly {@link exceptionCarrierInkBox}. Reused by
 * the engine's carrier-mark occlusion audit (Round 43 repair), so the check is
 * bounded to the symbolic carrier ink and never to a coarse whole-run box.
 */
export function exceptionCarrierMarkBoxes(
  g: JankoExceptionCarrierGeometry,
  tokens?: Partial<JankoTokens> | null
): JankoExceptionCarrierMarkBox[] {
  const t = resolveJankoTokens(tokens);
  const mm = g.grammar === 'midpoint' ? midpointMetrics(t, g.scale) : null;
  const cut = mm ? { hw: mm.slashHalfX, hh: mm.slashHalfY } : compactMarkHalfExtents(t, 'cut');
  const ring = mm ? { hw: mm.ringHalf, hh: mm.ringHalf } : compactMarkHalfExtents(t, 'ring');
  const centres = exceptionCarrierMarkCentres(g, t);
  const boxes: JankoExceptionCarrierMarkBox[] = [];
  centres.cuts.forEach((cx, index) =>
    boxes.push({ kind: 'cut', index, x0: cx - cut.hw, y0: g.y - cut.hh, x1: cx + cut.hw, y1: g.y + cut.hh })
  );
  centres.rings.forEach((cx, index) => {
    if (mm) {
      const box =
        longValueMarkForBase(g.base, g.longStyle, 'carrier', mm, t, cx, g.y, 'janko-exception-ring', g.halfRingGap)?.box ??
        midpointRingInkBox('carrier', mm, cx, g.y, g.halfRing);
      boxes.push({ kind: 'ring', index, ...box });
      return;
    }
    boxes.push({ kind: 'ring', index, x0: cx - ring.hw, y0: g.y - ring.hh, x1: cx + ring.hw, y1: g.y + ring.hh });
  });
  if (g.dots >= 1) {
    const r = t.augmentationDotRadius;
    const dotX = g.x1 + t.augmentationDotGap + r;
    boxes.push({ kind: 'dot', index: 0, x0: dotX - r, y0: g.y - r, x1: dotX + r, y1: g.y + r });
    if (g.dots >= 2) {
      const dot2X = dotX + 2 * r + t.augmentationDotGap;
      boxes.push({ kind: 'dot', index: 1, x0: dot2X - r, y0: g.y - r, x1: dot2X + r, y1: g.y + r });
    }
  }
  return boxes;
}


/**
 * Round 47 — one **detached long-value symbol** (`exceptionCarrier: 'symbol'`).
 *
 * The Round 46 doctrine placed a long value on a **fixed-length horizontal
 * arm**: the marks sat along a line whose length is a typographic constant, so
 * the statement always read as one wide gesture. This mount keeps the mark and
 * drops the arm: the member's own long ink (half-ring / ring / two rings, or
 * the open-oval family) is seated as a **pure symbol run** directly beside the
 * head (or the pair) it belongs to, at the nearest legal seat the collision
 * solve finds — never at a distant arm endpoint, never over foreign ink and
 * never on a drawn staff rule (a seat whose chord band crosses a rule is
 * rejected, so a half-ring's flat face is always legible). Everything else is
 * the member's own exact statement: the run's mark count and the augmentation
 * dots are the value's, and the seat is published with its distance.
 *
 * The member keeps **no** arm: `renderDetachedSymbol` paints marks and dots
 * only, with `fill="none"` — a detached statement erases nothing at all.
 */
export type JankoDetachedSeatKind = 'right' | 'left' | 'above' | 'below' | 'pair-channel';

/** One placed detached long-value symbol. */
export interface JankoDetachedSymbolGeometry {
  /** Source note id that owns the symbol (single-note ownership). */
  noteId: string;
  /**
   * Round 47: the second owner of a **shared** detached symbol — the same
   * same-hand / same-onset / exact-duration 2-span pair the Round 46 shared
   * indicator serves, which needs one statement, not two.
   */
  partnerId?: string;
  /** Onset tick of the owning member. */
  tick: number;
  /** The member's own stated duration (ticks). */
  durationTicks: number;
  /** Analysed base value of that statement (`0` out of grammar). */
  base: number;
  /** Long marks in the run (2 only for the midpoint 384 = two rings). */
  rings: number;
  /** Augmentation dots of the member's own value (0–2, exact). */
  dots: 0 | 1 | 2;
  /** False when the member's value has no exact reading (never seated). */
  inGrammar: boolean;
  /** Admitted cluster symbol scale the symbol ink is engraved at. */
  scale: number;
  /** Mark stroke width (pt) at that scale. */
  stroke: number;
  /** Active bracket/mark family of the run. */
  grammar: JankoBracketDurationGrammar;
  /** Round 47: the long-value symbol family of the run. */
  longStyle: JankoLongDurationStyle;
  /** Round 47: the air kept from a drawn rule under a half-ring's flat face. */
  halfRingGap: number;
  /** Mark-run centre (pt): the run is centred here, marks stacked along x. */
  x: number;
  /** True pitch y of the owning member (the run's own axis, never moved). */
  y: number;
  /** Which candidate seat was taken. */
  seat: JankoDetachedSeatKind;
  /**
   * Distance (pt) from the owning head's centre to the symbol's ink box — the
   * "nearest legal seat" the seat was chosen by, published rather than implied.
   */
  distance: number;
  /**
   * Round 48: the drawn staff rule(s) this seat paints **locally out of the
   * closed ring's hollow interior** (pt, page y — empty when the seat crosses
   * no rule). A staff line is not a placement obstacle for a hollow duration
   * circle: the ring keeps its consistent right seat and its interior is
   * cleaned of the line it stands on, exactly the way a notehead knockout
   * cleans the line behind its glyph. The list is part of the geometry, so the
   * seat test, the paint and the linter read one number; only the rule band
   * inside the interior is erased — never a tie, hold, head, stem, bracket or
   * sibling symbol.
   */
  ruleKnockouts: Array<{ y: number; half: number }>;
}

/**
 * Round 48: the metric set a **detached** seat paints with. The closed
 * carrier ring is the only primitive the round re-sizes
 * ({@link JankoTokens.detachedRingScale}): radius, stroke, ink half-extent and
 * the stack pitch between two rings all scale together, so a two-ring run stays
 * one coherent statement; the half-ring, the slash family and the compact
 * family are returned untouched. One function for the seat box, the paint, the
 * interior and the linter, so the four can never disagree.
 */
export function detachedMetrics(
  g: JankoDetachedSymbolGeometry,
  t: ResolvedJankoTokens
): JankoMidpointMetrics {
  const m = midpointMetrics(t, g.scale);
  // Scope: the **closed ring** only. A half-ring keeps its shape and size by the
  // operator's direction (it receives the increased spacing alone), and the
  // open-oval family states its own geometry.
  const closedRing = g.grammar === 'midpoint' && longMarkKindForBase(g.base, g.longStyle) === 'ring';
  const factor = closedRing ? t.detachedRingScale : 1;
  if (factor === 1) return m;
  const r = m.ringRadius * factor;
  const stroke = m.ringStroke * factor;
  return {
    ...m,
    ringRadius: r,
    ringStroke: stroke,
    ringHalf: r + stroke / 2,
    ringSpacing: m.ringSpacing * factor,
    carrierRingSpacing: m.carrierRingSpacing * factor,
    ringsRun: m.ringsRun * factor,
    carrierLength: m.carrierLength,
  };
}

/** Mark centres of one detached symbol run (the carrier run's own geometry). */
function detachedSymbolMarkCentres(
  g: JankoDetachedSymbolGeometry,
  t: ResolvedJankoTokens
): number[] {
  if (g.grammar === 'midpoint') {
    const m = detachedMetrics(g, t);
    return midpointMarkOffsets(m, 'carrier', 'ring', g.rings).map((dx) => g.x + dx);
  }
  return compactMarkOffsets(t, g.rings).map((dx) => g.x + dx);
}

/**
 * Round 48: the **hollow interiors** of a detached symbol's closed rings (pt
 * boxes): the region a rule knockout may clean. Empty for a half-ring (a
 * semicircle has no interior to clean: its flat face must stay unbroken, which
 * the seat test keeps refusing), for the compact family (no closed ring in the
 * detached vocabulary) and out of the open-oval family (an oval's counter is
 * not a circle the rule band is cut from).
 */
export function detachedSymbolInteriors(
  g: JankoDetachedSymbolGeometry,
  t: ResolvedJankoTokens
): Array<{ cx: number; cy: number; r: number }> {
  if (g.grammar !== 'midpoint') return [];
  const kind = longMarkKindForBase(g.base, g.longStyle);
  if (kind === null || kind === 'half-ring') return [];
  const m = detachedMetrics(g, t);
  const out: Array<{ cx: number; cy: number; r: number }> = [];
  if (kind === 'ring') {
    const inner = m.ringRadius - m.ringStroke / 2;
    if (inner <= 0) return [];
    for (const cx of detachedSymbolMarkCentres(g, t)) out.push({ cx, cy: g.y, r: inner });
    return out;
  }
  // The open-oval family's counters are ellipses; the **inscribed circle** is
  // the region a rule band may be cleaned from, so an erasure can never reach
  // outside the counter (the 96 oval is tilted, which only makes the inscribed
  // circle the safer bound).
  const shape = openOvalShape(kind, 'carrier', m, t);
  const inner = Math.min(shape.rx, shape.ry) - shape.stroke / 2;
  if (inner <= 0) return [];
  for (const cx of detachedSymbolMarkCentres(g, t)) out.push({ cx, cy: g.y, r: inner });
  return out;
}

/**
 * Round 48: the exact **eraser bands** of one detached symbol — for every rule
 * the seat recorded, the widest rectangle that still lies inside that rule's
 * interior circle. Seat test, paint and linter all call this one function, so
 * the erased rectangle can never exceed the hollow counter it cleans and the
 * band always covers the rule's own ink (`rule.half`) plus the declared air
 * (`tokens.staffRuleKnockoutHalfHeight`).
 */
export function detachedRuleKnockoutBands(
  g: JankoDetachedSymbolGeometry,
  tokens?: Partial<JankoTokens> | null
): Array<{ ruleY: number; x0: number; x1: number; y0: number; y1: number }> {
  const t = resolveJankoTokens(tokens);
  const interiors = detachedSymbolInteriors(g, t);
  if (interiors.length === 0) return [];
  const out: Array<{ ruleY: number; x0: number; x1: number; y0: number; y1: number }> = [];
  for (const rule of g.ruleKnockouts) {
    const half = rule.half + t.staffRuleKnockoutHalfHeight;
    for (const interior of interiors) {
      const dy = Math.abs(rule.y - interior.cy);
      if (dy + half >= interior.r - 1e-9) continue;
      const dx = Math.sqrt(interior.r * interior.r - (dy + half) * (dy + half));
      out.push({
        ruleY: rule.y,
        x0: interior.cx - dx,
        x1: interior.cx + dx,
        y0: rule.y - half,
        y1: rule.y + half,
      });
    }
  }
  return out;
}

/** The class one detached mark paints with (shared by paint, box and audit). */
const DETACHED_MARK_CLASS = 'janko-detached-mark';

/** One detached mark's own ink box, from the same geometry the paint uses. */
function detachedMarkBox(
  g: JankoDetachedSymbolGeometry,
  t: ResolvedJankoTokens,
  cx: number
): { x0: number; y0: number; x1: number; y1: number } {
  if (g.grammar === 'midpoint') {
    const m = detachedMetrics(g, t);
    const kind = longMarkKindForBase(g.base, g.longStyle);
    if (kind === null) return { x0: cx, y0: g.y, x1: cx, y1: g.y };
    return longValueMark(kind, 'carrier', m, t, cx, g.y, DETACHED_MARK_CLASS, g.halfRingGap, 'none').box;
  }
  const outer = t.compactRingRadius + t.compactRingStroke / 2;
  return { x0: cx - outer, y0: g.y - outer, x1: cx + outer, y1: g.y + outer };
}

/** Right ink edge of one detached run (the augmentation dots' anchor). */
function detachedRunRight(g: JankoDetachedSymbolGeometry, t: ResolvedJankoTokens): number {
  let right = g.x;
  for (const cx of detachedSymbolMarkCentres(g, t)) {
    right = Math.max(right, detachedMarkBox(g, t, cx).x1);
  }
  return right;
}

/** The augmentation-dot centres of one detached run (exact dots / double dots). */
function detachedSymbolDotCentres(
  g: JankoDetachedSymbolGeometry,
  t: ResolvedJankoTokens
): number[] {
  if (g.dots < 1) return [];
  const right = detachedRunRight(g, t);
  const first = right + t.augmentationDotGap + t.augmentationDotRadius;
  return g.dots >= 2
    ? [first, first + 2 * t.augmentationDotRadius + t.augmentationDotGap]
    : [first];
}

/** Axis-aligned ink box of one detached symbol — pure symbol ink, dots included. */
export function detachedSymbolInkBox(
  g: JankoDetachedSymbolGeometry,
  tokens?: Partial<JankoTokens> | null
): { x0: number; y0: number; x1: number; y1: number } {
  const t = resolveJankoTokens(tokens);
  let x0 = g.x;
  let x1 = g.x;
  let y0 = g.y;
  let y1 = g.y;
  for (const cx of detachedSymbolMarkCentres(g, t)) {
    const box = detachedMarkBox(g, t, cx);
    x0 = Math.min(x0, box.x0);
    x1 = Math.max(x1, box.x1);
    y0 = Math.min(y0, box.y0);
    y1 = Math.max(y1, box.y1);
  }
  for (const cx of detachedSymbolDotCentres(g, t)) {
    x0 = Math.min(x0, cx - t.augmentationDotRadius);
    x1 = Math.max(x1, cx + t.augmentationDotRadius);
    y0 = Math.min(y0, g.y - t.augmentationDotRadius);
    y1 = Math.max(y1, g.y + t.augmentationDotRadius);
  }
  return { x0, y0, x1, y1 };
}

/**
 * Round 48 — the **local rule knockout** of one detached symbol: for every rule
 * recorded on {@link JankoDetachedSymbolGeometry.ruleKnockouts}, one white band
 * inside the closed ring's hollow interior, at the rule's own ink height. It is
 * painted on its own layer band **before** the written tie arcs and every
 * carrier mark, so it can only ever clean the staff rule it names: a tie, hold,
 * head, stem, bracket or sibling symbol that crosses the interior paints after
 * it and stays unbroken. Together with `renderDetachedSymbol` it is the whole
 * ink of a detached statement — the ring keeps its consistent right seat
 * instead of being displaced to a bare lane above the note.
 */
export function renderDetachedRuleKnockout(
  g: JankoDetachedSymbolGeometry,
  tokens?: Partial<JankoTokens> | null
): string {
  const bands = detachedRuleKnockoutBands(g, tokens);
  if (bands.length === 0) return '';
  return bands
    .map(
      (band) =>
        `    <rect class="janko-detached-rule-knockout" data-symbol-note="${g.noteId}" ` +
        `data-rule-y="${f(band.ruleY)}" x="${f(band.x0)}" y="${f(band.y0)}" ` +
        `width="${f(band.x1 - band.x0)}" height="${f(band.y1 - band.y0)}" fill="#FFFFFF"/>`
    )
    .join('\n');
}

/**
 * Paint one detached long-value symbol: the member's own mark run and its
 * augmentation dots, and **nothing else** — no arm, no line, no mask. The
 * Round 48 rule knockout, when the seat recorded one, is a separate band
 * ({@link renderDetachedRuleKnockout}).
 */
export function renderDetachedSymbol(
  g: JankoDetachedSymbolGeometry,
  tokens?: Partial<JankoTokens> | null
): string {
  const t = resolveJankoTokens(tokens);
  const run = longRunName(g.base, g.longStyle) ?? 'ring';
  const out: string[] = [
    `  <g class="janko-detached-symbol" data-symbol-note="${g.noteId}"${g.partnerId ? ` data-symbol-partner="${g.partnerId}"` : ''} data-symbol-seat="${g.seat}" data-symbol-ticks="${g.durationTicks}" data-symbol-base="${g.base}" data-symbol-run="${run}" data-symbol-marks="${g.rings}" data-symbol-dots="${g.dots}" data-symbol-distance="${g.distance.toFixed(2)}">`,
  ];
  const centres = detachedSymbolMarkCentres(g, t);
  if (g.grammar === 'midpoint') {
    const m = detachedMetrics(g, t);
    const kind = longMarkKindForBase(g.base, g.longStyle);
    if (kind) {
      for (const cx of centres) {
        out.push(...longValueMark(kind, 'carrier', m, t, cx, g.y, DETACHED_MARK_CLASS, g.halfRingGap, 'none').svg);
      }
    }
  } else {
    for (const cx of centres) {
      out.push(
        `    <circle class="${DETACHED_MARK_CLASS}" cx="${f(cx)}" cy="${f(g.y)}" r="${f(t.compactRingRadius)}" fill="none" stroke="#111111" stroke-width="${t.compactRingStroke.toFixed(2)}"/>`
      );
    }
  }
  for (const cx of detachedSymbolDotCentres(g, t)) {
    out.push(
      `    <circle class="janko-detached-dot" cx="${f(cx)}" cy="${f(g.y)}" r="${f(t.augmentationDotRadius)}" fill="#111111"/>`
    );
  }
  out.push('  </g>');
  return out.join('\n');
}

/**
 * Paint one left clasp: the symmetrical `[` bracket plus the duration ink of the
 * active `claspDurationStyle` (Round 11). The group is engraved in the rhythm
 * layer (beneath the noteheads), so a knockout always erases whatever a clasp
 * should never have touched.
 */
export function renderChordClasp(
  group: JankoClaspGroupGeometry,
  tokens?: Partial<JankoTokens> | null
): string {
  const t = resolveJankoTokens(tokens);
  return serializeClaspGroup(group, placedClaspShell(group), t);
}

/** A single shell authority for fixed-core stored paint and direct adapters.
 * Duration marks remain the legacy painter and never repaint the shell. */
export function serializeClaspGroup(
  group:JankoClaspGroupGeometry, shell:ReturnType<typeof placedClaspShell>, t:ResolvedJankoTokens
):string {
  const ids=group.notes.map(n=>n.id).join(',');
  return [
    `  <g class="janko-clasp-group" data-clasp-tick="${group.tick}" data-clasp-duration="${group.duration}" data-clasp-duration-style="${group.durationStyle}" data-clasp-notes="${ids}">`,
    claspShellSvg(shell),...renderClaspDurationInk(group,t),'  </g>'
  ].join('\n');
}

/** One horizontal rail joining the extended spine tops of contiguous clasps. */
export interface JankoClaspRailGeometry {
  /** Leftmost spine column of the joined run. */
  x1: number;
  /** Rightmost spire column of the joined run. */
  x2: number;
  /** Rail centreline y. */
  y: number;
  /** Rail thickness (token `beamThickness`). */
  thickness: number;
  /** 1 = primary (8th) level, 2 = 16th level. */
  level: 1 | 2;
  /** Ids of every note of the joined clasps. */
  noteIds: string[];
}

/** Paint one clasp rail (a measure-bounded horizontal connector). */
export function renderClaspRail(
  rail: JankoClaspRailGeometry,
  tokens?: Partial<JankoTokens> | null
): string {
  const t = resolveJankoTokens(tokens);
  const cls = rail.level === 2 ? 'janko-clasp-rail janko-clasp-rail-secondary' : 'janko-clasp-rail';
  return `    <line class="${cls}" data-rail-level="${rail.level}" data-rail-notes="${rail.noteIds.join(',')}" x1="${f(rail.x1)}" y1="${f(rail.y)}" x2="${f(rail.x2)}" y2="${f(rail.y)}" stroke="#111111" stroke-width="${t.beamThickness.toFixed(2)}" stroke-linecap="butt"/>`;
}

/**
 * Paint a whole clasp layer: every bracket, then the rails of
 * `'beamed-clasp-rail'` (which are painted after the spines they join).
 * Round 11 carries the duration paradigm on each resolved group, so the layer
 * needs no extra style parameter.
 */
export function renderClaspGroup(
  groups: readonly JankoClaspGroupGeometry[],
  rails: readonly JankoClaspRailGeometry[] = [],
  tokens?: Partial<JankoTokens> | null,
  shells?: readonly PlacedClaspShell[]
): string {
  if (groups.length === 0 && rails.length === 0) return '';
  if(shells && shells.length!==groups.length)throw new Error('Placed clasp shell/group mismatch');
  const t = resolveJankoTokens(tokens);
  const parts: string[] = ['  <g class="janko-clasp-layer">'];
  for (const [i,group] of groups.entries()) parts.push(shells
    ? serializeClaspGroup(group,shells[i],t) : renderChordClasp(group,t));
  for (const rail of rails) parts.push(renderClaspRail(rail, t));
  parts.push('  </g>');
  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Round 7 — Option 3: gap-gated vertical chording
// ---------------------------------------------------------------------------

/**
 * Vertical distance (pt) at or below which two adjacent heads of one hand form
 * a **tight cluster**: no connecting ink is drawn between them, because a stem
 * there would only dagger the neighbouring notehead.
 *
 * The threshold is three ordinary protected-head vertical heights — the digit
 * ink box plus its protective margin on both sides (`2 * hy` per head, from
 * the active cluster-spacing preset, whose `hy` is the digit half-height plus
 * the style margin) — so it follows the active style and scale instead of a
 * fixed constant. Tight: `3 * 6.92 = 20.76pt`. The comparison is strictly
 * greater-than: a gap of exactly three head heights stays unbridged.
 */
export function chordBridgeThreshold(spacing?: JankoClusterSpacing | null): number {
  return 3 * (2 * getClusterSpacingPreset(spacing).hy);
}
/** Air (pt) a bridge line keeps from the two discs it connects. */
export const CHORD_BRIDGE_DISC_AIR = 0.2;

/** One intentional vertical bridge unifying a wide leap inside one hand. */
export interface JankoChordBridge {
  /** Column of the two heads (identical by definition). */
  x: number;
  /** Upper end of the bridge (below the upper disc). */
  y1: number;
  /** Lower end of the bridge (above the lower disc). */
  y2: number;
  /** Ids of the two heads the bridge unifies. */
  noteIds: string[];
}

/**
 * One hand's vertically aligned chord, resolved by Option 3.
 *
 * The hand's heads share a single column, so the external clasp refuses them
 * (`claspNotesHorizontallySpread` is false). Option 3 instead gives the column
 * a gap-gated stem grammar:
 *
 * - every adjacent pair at or below {@link chordBridgeThreshold} (three
 *   ordinary protected-head heights) is a tight cluster — its internal
 *   connecting stem is **suppressed**, so nothing daggers the neighbouring
 *   notehead; strictly above it is a wide leap — an intentional
 *   {@link JankoChordBridge} line connects the two heads and unifies the
 *   hand's reach;
 * - the **outer extremity** of the group (topmost head for an up-stem hand,
 *   bottommost for a down-stem hand) carries the group's rhythmic duration —
 *   its stem, plus one mark per 8th/16th/32nd level of the hand's shortest
 *   member value. Members that match the carried value are suppressed into
 *   the carrier's stem; members with any other duration keep their own exact
 *   statement (exception stems).
 */
export interface JankoVerticalChordGroup {
  /** The head that carries the whole hand's duration, at the group's extremity. */
  carrier: JankoRhythmNote;
  /** Duration (ticks) the carrier draws — the hand's shortest member value. */
  durationTicks: number;
  /** Ids of the interior heads whose own stems are suppressed (carried-value matches only). */
  suppressedIds: string[];
  /** Intentional bridge lines across the group's wide leaps, top to bottom. */
  bridges: JankoChordBridge[];
}

/**
 * Resolve Option 3 for one hand's vertical cluster: two or more heads of the
 * same hand sharing one column. Returns null for a lone note and for a
 * horizontally spread (row-snapped) cluster, which the per-hand clasp groups
 * instead.
 */
export function computeVerticalChordGroup(
  notes: readonly JankoRhythmNote[],
  tokens?: Partial<JankoTokens> | null,
  spacing?: JankoClusterSpacing | null
): JankoVerticalChordGroup | null {
  const t = resolveJankoTokens(tokens);
  if (notes.length < 2) return null;
  if (claspNotesHorizontallySpread(notes)) return null;
  const sorted = [...notes].sort(
    (a, b) => a.y - b.y || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
  const direction = stemDirection(sorted[0].hand);
  // The extremity in the stem direction carries the duration: an up-stem hand
  // (RH) hands it to its topmost head, a down-stem hand (LH) to its bottommost.
  const carrier = direction === -1 ? sorted[0] : sorted[sorted.length - 1];
  const durationTicks = Math.min(...notes.map((n) => n.durationTicks));
  // Exception members (a duration other than the carried min) keep their own
  // exact duration statement — only members that match the carried value are
  // suppressed into the carrier's stem. The carried value itself stays the
  // actual min (shortest) for the extant patterns.
  const suppressedIds = sorted
    .filter((n) => n.id !== carrier.id && n.durationTicks === durationTicks)
    .map((n) => n.id);
  const bridges: JankoChordBridge[] = [];
  const bridgeThreshold = chordBridgeThreshold(spacing);
  for (let i = 0; i + 1 < sorted.length; i++) {
    const upper = sorted[i];
    const lower = sorted[i + 1];
    if (lower.y - upper.y <= bridgeThreshold) continue;
    bridges.push({
      x: upper.x,
      y1: upper.y + t.noteheadRadius + CHORD_BRIDGE_DISC_AIR,
      y2: lower.y - t.noteheadRadius - CHORD_BRIDGE_DISC_AIR,
      noteIds: [upper.id, lower.id],
    });
  }
  return {
    carrier,
    durationTicks,
    suppressedIds,
    bridges,
  };
}

/**
 * Paint the bridge lines of every gap-gated vertical chord. They are engraved
 * in the rhythm layer — beneath the noteheads — so a white knockout always
 * erases any overlap with a glyph, and they keep
 * {@link CHORD_BRIDGE_DISC_AIR} of air from the two discs they connect.
 */
export function renderChordBridges(
  bridges: readonly JankoChordBridge[],
  strokeWidth: number = 0.90
): string {
  // Direct/nonfixed compatibility; fixed cores emit stored final-layout strokes.
  return chordBridgesSvg(placedChordBridges(bridges, -1, -1, new Map(), strokeWidth));
}

/**
 * Pure geometry of one beamed group.
 *
 * The primary connector is clamped to ±`tokens.maxBeamSlope` so wide leaps do
 * up-stems) or *depressed* (LH down-stems) until the extreme notehead of the
 * group — in the stem direction — keeps at least a full stem length, so no
 * beam can ever cut through an intermediate notehead of an ascending or
 * descending run. Renderers and the visual linter share this function, so the
 * geometry can never drift between the two.
 *
 * The connector spans the **outermost stem columns** (`min … max` of the
 * group's `stemX`), not the first and last note in tick order. The two agree
 * for every group engraved on the plain beat grid, but a row-snapped chord
 * translates a whole onset column sideways (see
 * `engine.resolveRowSnappedChordOffsets`), which can put a later onset a
 * fraction of a point left of its predecessor. Spanning the extremes keeps
 * every stem attached to its beam — the invariant the linter audits as
 * `beam-stem-gap`.
 *
 * `obstacles` are the other noteheads of the system. The grand staff is one
 * shared lattice, so a hand-crossing run can put its beam straight through a
 * foreign head (e.g. an LH beam descending across the RH's octave-3 line in
 * mm. 13–14). The connector is pushed uniformly further away from its own
 * heads — preserving the clamped slope exactly — until every foreign head
 * keeps `noteheadRadius + minStemClearance` of air from the primary and the
 * 16th secondary connector.
 *
 * `spineY`, when supplied, declares the Middle C corridor a no-fly line: a
 * connector that would slice across it is pushed the same way (away from its
 * own heads) until it clears the spine by {@link BEAM_SPINE_CLEARANCE}. Both
 * constraints push along the stem direction, so a single bounded loop settles
 * them together.
 *
 * `restInk`, when supplied, hands the solver the system's printed rest ink
 * boxes: a Round 17B bridged beam continues across the rest it spans, so the
 * connector must clear that ink by `minStemClearance` (see
 * `checkBeamRestClearance`).
 */
export interface JankoBeamGroupGeometry {
  /** Group notes sorted by start tick. */
  notes: JankoRhythmNote[];
  /** One resolved stem per note (same order as `notes`). */
  stems: JankoStemGeometry[];
  /** -1 for RH (up), +1 for LH (down). */
  direction: -1 | 1;
  /** Slope measured between the outer stem tips, before clamping. */
  rawSlope: number;
  /** Clamped slope actually engraved. */
  slope: number;
  /** Vertical distance (pt) from the extreme notehead centre to the beam centreline. */
  minStemLength: number;
  /** Primary beam thickness. */
  thickness: number;
  /** Primary connector across the stem tips. */
  primary: JankoBeamConnector;
  /**
   * Round 21 — **every** beam strip, primary first: level 2 (16ths), level 3
   * (32nds) and level 4 (64ths) are produced by one generic rule (maximal runs
   * of notes at or above the level), so the higher levels are data. A run of a
   * single note becomes a Gould **partial beam** (stub) instead of a connector.
   */
  levels: JankoBeamLevel[];
  /**
   * The level-2 connector when the group has exactly one, non-stub 16th run —
   * the shape every Round 7–20 case carries. Kept as the named accessor for the
   * existing audits; `null` when there is none, or when the 16ths are split
   * into stubs.
   */
  secondary: JankoBeamConnector | null;
  /** Beam centerline y at an absolute x. */
  beamY(x: number): number;
}

/** One beam strip: its level (1 = 8th/primary) and its painted connector. */
export interface JankoBeamLevel {
  /** 1 = primary, 2 = 16th, 3 = 32nd, 4 = 64th. */
  level: number;
  connector: JankoBeamConnector;
  /**
   * True for a **partial beam**: the connector starts at its own stem and ends
   * in mid-air, because its level holds exactly one note in the group.
   */
  stub: boolean;
}

/** Gap (pt) between the primary beam and the 16th secondary beam. */
const SECONDARY_BEAM_GAP = 1.6;
/** Extra air (pt) the obstacle pass keeps beyond the required clearance. */
const OBSTACLE_AIR_MARGIN = 0.02;
/**
 * Air (pt) a beam connector keeps from the Middle C spine when the corridor is
 * declared as a no-fly line (see {@link computeBeamGroupGeometry}). Matches the
 * linter's `corridorClearance`, so a beam that satisfies the solver always
 * satisfies the structural corridor audit.
 */
export const BEAM_SPINE_CLEARANCE = 2.0;

/** Distance from a point to a line segment. */
function pointToSegmentDistance(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const vx = x2 - x1;
  const vy = y2 - y1;
  const len2 = vx * vx + vy * vy;
  if (len2 === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * vx + (py - y1) * vy) / len2));
  return Math.hypot(px - (x1 + t * vx), py - (y1 + t * vy));
}

/** Distance from a point to an axis-aligned box (0 when inside). */
function pointToRestBoxDistance(
  px: number,
  py: number,
  b: JankoBeamRestObstacle
): number {
  const dx = Math.max(b.x0 - px, 0, px - b.x1);
  const dy = Math.max(b.y0 - py, 0, py - b.y1);
  return Math.hypot(dx, dy);
}

/** True when two line segments intersect (proper crossing, excl. parallel). */
function restSegmentsIntersect(
  p1x: number,
  p1y: number,
  p2x: number,
  p2y: number,
  p3x: number,
  p3y: number,
  p4x: number,
  p4y: number
): boolean {
  const d = (p2x - p1x) * (p4y - p3y) - (p2y - p1y) * (p4x - p3x);
  if (Math.abs(d) < 1e-12) return false;
  const t = ((p3x - p1x) * (p4y - p3y) - (p3y - p1y) * (p4x - p3x)) / d;
  const u = ((p3x - p1x) * (p2y - p1y) - (p3y - p1y) * (p2x - p1x)) / d;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

/** Distance from a line segment to an axis-aligned rest ink box (0 on touch). */
function segmentToRestBoxDistance(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  b: JankoBeamRestObstacle
): number {
  if (pointToRestBoxDistance(x1, y1, b) === 0 || pointToRestBoxDistance(x2, y2, b) === 0) {
    return 0;
  }
  const edges: Array<[number, number, number, number]> = [
    [b.x0, b.y0, b.x1, b.y0],
    [b.x1, b.y0, b.x1, b.y1],
    [b.x1, b.y1, b.x0, b.y1],
    [b.x0, b.y1, b.x0, b.y0],
  ];
  for (const [ex1, ey1, ex2, ey2] of edges) {
    if (restSegmentsIntersect(x1, y1, x2, y2, ex1, ey1, ex2, ey2)) return 0;
  }
  let best = Math.min(
    pointToRestBoxDistance(x1, y1, b),
    pointToRestBoxDistance(x2, y2, b)
  );
  for (const [cx, cy] of [
    [b.x0, b.y0],
    [b.x1, b.y0],
    [b.x1, b.y1],
    [b.x0, b.y1],
  ]) {
    best = Math.min(best, pointToSegmentDistance(cx, cy, x1, y1, x2, y2));
  }
  return best;
}

/**
 * One printed rest's ink box as seen by the beam solver: a bridged beam must
 * clear the rest it continues across. Structural on purpose — `restInkBox`
 * satisfies it — so the rhythm layer never imports the rest painter.
 */
export interface JankoBeamRestObstacle {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Resolve the beam geometry of a group. Returns null for groups shorter than
 * two notes (a solitary short note is engraved with standard flags instead).
 *
 * @param obstacles other noteheads of the system the connector must avoid
 * @param spineY    absolute y of the Middle C spine, when the corridor is a
 *                  declared no-fly line for beams
 * @param restInk   printed rest ink boxes of the system the connector clears
 * @param grammar   Round 30 duration grammar: beam levels derive from the
 *                  notated base value under `'complete'` (a double-dotted
 *                  16th beams at level 2), from raw thresholds otherwise
 */
export function computeBeamGroupGeometry(
  group: JankoRhythmNote[],
  tokens?: Partial<JankoTokens> | null,
  obstacles?: readonly JankoRhythmNote[] | null,
  spineY?: number | null,
  restInk?: readonly JankoBeamRestObstacle[] | null,
  grammar: JankoDurationGrammar = 'golden'
): JankoBeamGroupGeometry | null {
  const t = resolveJankoTokens(tokens);
  if (group.length < 2) return null;

  const sorted = [...group].sort((a, b) => a.startTick - b.startTick);
  const stems = sorted.map((n) => getStemGeometry(n, t));
  const direction = stems[0].direction;

  /** Stem columns of a run: the two the beam is fitted through, and the span. */
  const span = (list: JankoStemGeometry[]): { lo: JankoStemGeometry; hi: JankoStemGeometry } => {
    let lo = list[0];
    let hi = list[0];
    for (const s of list) {
      if (s.stemX < lo.stemX) lo = s;
      if (s.stemX > hi.stemX) hi = s;
    }
    return { lo, hi };
  };

  const { lo, hi } = span(stems);
  const dx = hi.stemX - lo.stemX;
  const rawSlope = dx !== 0 ? (hi.stemEndY - lo.stemEndY) / dx : 0;
  const limit = t.maxBeamSlope;
  const slope = Math.max(-limit, Math.min(limit, rawSlope));
  const beamX0 = lo.stemX;

  // --- Round 21: the beam levels are one generic rule -----------------------
  const noteLevels = sorted.map((n) => beamLevel(n.durationTicks, grammar));
  const maxLevel = Math.max(...noteLevels);
  /** Offset (pt) of level `L`'s centerline from the primary connector. */
  const levelOffset = (level: number): number =>
    -direction * (level - 1) * (t.beamThickness + SECONDARY_BEAM_GAP);
  /**
   * One **run** per maximal stretch of consecutive notes at or above a level —
   * the same rule for 16ths, 32nds and 64ths. A run of one note is a Gould
   * partial beam. The run's columns do not depend on the anchor, so they are
   * resolved once, outside every relaxation pass.
   */
  interface BeamRun {
    level: number;
    stems: JankoStemGeometry[];
    /** Index in `sorted` of the run's only note (a partial beam). */
    loneIndex: number | null;
  }
  const beamRuns: BeamRun[] = [];
  for (let level = 2; level <= maxLevel; level++) {
    let indices: number[] = [];
    const flush = (): void => {
      if (indices.length === 0) return;
      beamRuns.push({
        level,
        stems: indices.map((i) => stems[i]),
        loneIndex: indices.length === 1 ? indices[0] : null,
      });
      indices = [];
    };
    for (let i = 0; i <= noteLevels.length; i++) {
      if (i < noteLevels.length && noteLevels[i] >= level) indices.push(i);
      else flush();
    }
  }
  const level2Runs = beamRuns.filter((r) => r.level === 2 && r.loneIndex === null);
  const hasSecondary = level2Runs.length === 1;

  // Minimum stem length: the canonical stem, but never less than the notehead
  // disc plus the required air — counting the *deepest* beam level, which sits
  // `(L − 1) · (beamThickness + gap)` closer to the heads than the primary.
  // It is measured from the notehead centre (the beam anchor below), so the
  // *visible* stem between the disc perimeter and the beam is
  // `minStemLength - getStemAttachmentRadius(note)` and stays substantial.
  const secondaryDepth = maxLevel >= 2 ? (maxLevel - 1) * (t.beamThickness + SECONDARY_BEAM_GAP) : 0;
  const minStemLength = Math.max(
    t.stemLength,
    t.noteheadRadius + t.minStemClearance + secondaryDepth
  );

  // Elevate (up-stems) or depress (down-stems) the clamped baseline until the
  // extreme notehead in the stem direction is exactly `minStemLength` away;
  // every other stem in the group is then automatically longer. Because the
  // shift is uniform it preserves the clamped slope exactly.
  let anchor = direction === -1 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
  for (let i = 0; i < sorted.length; i++) {
    const limitY = sorted[i].y + direction * minStemLength - slope * (stems[i].stemX - beamX0);
    anchor = direction === -1 ? Math.min(anchor, limitY) : Math.max(anchor, limitY);
  }

  /**
   * Every beam strip (primary + one per level run) for one anchor. A run of a
   * single note is a **partial beam**: it starts at that note's own stem and
   * ends in mid-air, pointing *toward the group it is beamed with* — backward
   * (toward the preceding note) whenever the group has one, forward only when
   * the lone note opens the group. That is the Gould fractional-beam rule: the
   * stub belongs to the group, never to the empty side of it.
   */
  const connectorsAt = (a: number): JankoBeamConnector[] => {
    const list: JankoBeamConnector[] = [
      {
        x1: lo.stemX,
        y1: a,
        x2: hi.stemX,
        y2: a + slope * (hi.stemX - lo.stemX),
      },
    ];
    for (const run of beamRuns) {
      const off = levelOffset(run.level);
      if (run.loneIndex !== null) {
        const here = stems[run.loneIndex];
        const neighbour =
          run.loneIndex > 0 ? stems[run.loneIndex - 1] : stems[run.loneIndex + 1];
        const toward = run.loneIndex > 0 ? -1 : 1;
        const reach = neighbour ? Math.abs(neighbour.stemX - here.stemX) : 0;
        const len = Math.min(t.flagWidth > 0 ? t.flagWidth : BEAM_STUB_FALLBACK, reach);
        if (!(len > 2 * t.beamThickness)) continue;
        const y = a + slope * (here.stemX - beamX0) + off;
        list.push({
          x1: here.stemX,
          y1: y,
          x2: here.stemX + toward * len,
          y2: y + slope * toward * len,
        });
        continue;
      }
      const { lo: rlo, hi: rhi } = span(run.stems);
      list.push({
        x1: rlo.stemX,
        y1: a + slope * (rlo.stemX - beamX0) + off,
        x2: rhi.stemX,
        y2: a + slope * (rhi.stemX - beamX0) + off,
      });
    }
    return list;
  };

  // Cross-hand obstacle avoidance and Middle C corridor protection. The staff
  // is shared, so a foreign notehead may sit on (or beside) the connector, and
  // the corridor is structural negative space. Push the whole beam uniformly
  // away from its own heads — past every obstacle and clear of the spine —
  // until both constraints hold. Every push runs along the stem direction, so
  // the bounded loop always terminates.
  const required = t.noteheadRadius + t.minStemClearance;
  const own = new Set(sorted.map((n) => n.id));
  const foreign = obstacles && obstacles.length > 0 ? obstacles.filter((o) => !own.has(o.id)) : [];
  // Round 17B: a bridged beam continues across its printed rest, so the rest's
  // own ink box is an obstacle too (air measured from the ink itself).
  const restAir = t.minStemClearance;
  const restBoxes = restInk ?? [];
  const cos = 1 / Math.sqrt(1 + slope * slope);
  const spine = typeof spineY === 'number' && Number.isFinite(spineY) ? spineY : null;
  /** Amount (pt) the spine forces the anchor to move along the stem direction. */
  const spinePush = (line: JankoBeamConnector): number => {
    if (spine === null) return 0;
    const lo = Math.min(line.y1, line.y2);
    const hi = Math.max(line.y1, line.y2);
    // Only a connector that actually crosses the spine is displaced; a beam
    // that merely runs parallel beside the corridor is legal.
    if (lo > spine || hi < spine) return 0;
    return direction === -1
      ? hi - (spine - BEAM_SPINE_CLEARANCE)
      : spine + BEAM_SPINE_CLEARANCE - lo;
  };
  for (let pass = 0; pass < 16; pass++) {
    let push = 0;
    for (const line of connectorsAt(anchor)) {
      const run = line.x2 - line.x1;
      const lo = Math.min(line.x1, line.x2) - required;
      const hi = Math.max(line.x1, line.x2) + required;
      for (const o of foreign) {
        if (o.x < lo || o.x > hi) continue;
        const distance = pointToSegmentDistance(o.x, o.y, line.x1, line.y1, line.x2, line.y2);
        if (distance >= required) continue;
        const yAtX = run === 0 ? line.y1 : line.y1 + ((o.x - line.x1) / run) * (line.y2 - line.y1);
        // Push just past the obstacle (its signed vertical offset + the
        // perpendicular requirement), with a conservative fallback for
        // obstacles that only graze a connector endpoint.
        const need = direction * (o.y - yAtX) + (required + OBSTACLE_AIR_MARGIN) / cos;
        push = Math.max(push, need, required - distance + OBSTACLE_AIR_MARGIN);
      }
      for (const ink of restBoxes) {
        if (ink.x1 < lo || ink.x0 > hi) continue;
        const gap = segmentToRestBoxDistance(line.x1, line.y1, line.x2, line.y2, ink);
        if (gap >= restAir) continue;
        const spanLo = Math.min(line.x1, line.x2);
        const spanHi = Math.max(line.x1, line.x2);
        const cx = Math.max(spanLo, Math.min((ink.x0 + ink.x1) / 2, spanHi));
        const restYAtX = run === 0 ? line.y1 : line.y1 + ((cx - line.x1) / run) * (line.y2 - line.y1);
        const cy = (ink.y0 + ink.y1) / 2;
        const need = direction * (cy - restYAtX) + (restAir + OBSTACLE_AIR_MARGIN) / cos;
        push = Math.max(push, need, restAir - gap + OBSTACLE_AIR_MARGIN);
      }
      push = Math.max(push, spinePush(line));
    }
    if (push <= 0) break;
    anchor += direction * push;
  }

  const beamY = (x: number): number => anchor + slope * (x - beamX0);
  const list = connectorsAt(anchor);
  const primary = list[0];
  // The level-2 accessor: exactly one full 16th run, and no 16th stub beside it.
  const secondary =
    hasSecondary && beamRuns.filter((r) => r.level === 2).length === 1 && list[1]
      ? list[1]
      : null;
  const levels: JankoBeamLevel[] = [{ level: 1, connector: primary, stub: false }];
  beamRuns.forEach((run, i) => {
    const connector = list[i + 1];
    if (connector) levels.push({ level: run.level, connector, stub: run.loneIndex !== null });
  });

  return {
    notes: sorted,
    stems,
    direction,
    rawSlope,
    slope,
    minStemLength,
    thickness: t.beamThickness,
    primary,
    levels,
    secondary,
    beamY,
  };
}

/**
 * Filled beam-rail path with vertical end faces.
 *
 * A stroked `<line>` ends in a butt cap perpendicular to the rail direction,
 * so on a sloped beam the end face is slanted and the rail's top corner stops
 * mid-stem. The Urtext rail is a filled parallelogram instead: the connector
 * runs stem-centre to stem-centre, extended here by one stem half-width at
 * each end along the beam slope (so the rail angle is unchanged), and the end
 * faces are vertical, coinciding with the outer edges of the end stems. A stub
 * end floating in mid-air grows by the same half-width so every rail shares
 * one rule. Corner order is `M ax ayT L bx byT L bx byB L ax ayB Z`.
 */
export function beamRailPathD(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  thickness: number,
): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ex = (dx / len) * (JANKO_STEM_STROKE_WIDTH / 2);
  const ey = (dy / len) * (JANKO_STEM_STROKE_WIDTH / 2);
  const ax = x1 - ex;
  const ay = y1 - ey;
  const bx = x2 + ex;
  const by = y2 + ey;
  const half = thickness / 2;
  return (
    `M ${f(ax)} ${f(ay - half)} L ${f(bx)} ${f(by - half)} ` +
    `L ${f(bx)} ${f(by + half)} L ${f(ax)} ${f(ay + half)} Z`
  );
}

/**
 * Traditional connected beam over one beat-sized group of 8ths/16ths.
 *
 * `geometry` is the group's already resolved beam (as carried by the system
 * layout). Supplying it guarantees the painted connector is byte-for-byte the
 * geometry the solver resolved against the foreign noteheads and the Middle C
 * corridor — and the one the visual linter audits.
 *
 * Round 30: under the complete grammar every dotted member dots (doubly
 * dotted doubly, from the engine's resolved `dot2X`/`dot2Y`); beamed members
 * are onset-alone by construction (Round 11), hence never clasped, so no
 * member ink is ever suppressed here.
 */
import { placedBeamGroup, beamGroupSvg } from '../beam-scene';

/** Sunset adapter for standalone/non-fixed callers; fixed-core uses stored scene. */
export function renderBeamGroup(
  group: JankoRhythmNote[],
  tokens?: Partial<JankoTokens> | null,
  geometry?: JankoBeamGroupGeometry | null,
  subdivisionStyle: JankoSubdivisionStyle = 'classical-urtext',
  grammar: JankoDurationGrammar = 'golden'
): string {
  const t = resolveJankoTokens(tokens);
  if (group.length === 0) return '';
  if (group.length === 1) {
    // A solitary short note is flagged, never crossbarred.
    return renderFlags(group[0], t, subdivisionStyle, grammar);
  }

  const beam = geometry ?? computeBeamGroupGeometry(group, t, null, null, null, grammar);
  if (!beam) return '';
  return beamGroupSvg(placedBeamGroup(beam, t, grammar, 0, 0));
}

/**
 * Dispatch one note to its selected rhythm dialect.
 *
 * Round 30: the complete grammar threads through the beamed dialect only;
 * the retired display dialects (`angled-cuts`, `horizontal-ticks`) keep
 * their legacy gates under every grammar.
 */
export function renderRhythm(
  note: JankoRhythmNote,
  style: JankoRhythmStyle,
  tokens?: Partial<JankoTokens> | null,
  subdivisionStyle: JankoSubdivisionStyle = 'classical-urtext',
  grammar: JankoDurationGrammar = 'golden'
): string {
  switch (style) {
    case 'horizontal-ticks':
      return renderHorizontalTicks(note, tokens);
    case 'beamed':
      // Standalone (unbeamable) notes carry standard flags, not crossbars.
      return renderFlags(note, tokens, subdivisionStyle, grammar);
    case 'angled-cuts':
    default:
      return renderAngledCuts(note, tokens);
  }
}

/** Result of partitioning a system's notes into beam groups. */
export interface JankoBeamPartition {
  groups: JankoRhythmNote[][];
  ungrouped: JankoRhythmNote[];
}

/**
 * Partition notes into beat-sized beam groups (same hand, same measure, same
 * beat, consecutive 8th-or-shorter durations). Groups of one note are returned
 * as ungrouped so the engine renders standard flags for them.
 *
 * A longer value of the same hand (dotted 8th or more) interrupts a run even
 * though it is not itself beamable: a beam may never straddle a notehead that
 * is not part of it, or the connector would cut through that glyph.
 *
 * Round 10 removed the brittle *cross-register* heuristic that used to sever a
 * run whenever it leapt an octave across Middle C while the other hand sounded
 * a temporally coincident note. It orphaned authentic gestures — the Bach
 * Goldberg Var. 1 m. 4 RH descent `6 4 2 1 2 6 9 7 6 9 0` lost its `9 7 6`
 * tail to solitary flags — and it is unnecessary: the 16-pass obstacle solver
 * of {@link computeBeamGroupGeometry} already pushes every connector clear of
 * foreign noteheads and of the Middle C corridor, so a run beams continuously
 * across the spine as one musical gesture.
 *
 * Round 11 fixes the simultaneity defect: several heads sharing one `startTick`
 * are a **chord**, never a melodic run. They used to be grouped into a
 * zero-width beam whose vertical stem sliced through every notehead of the
 * cluster. Every note that stands alone on its onset beams normally, while
 * notes sharing an onset are left to their clasp brackets (the sole grouping
 * and duration carrier of a simultaneity) and receive no melodic beam.
 *
 * Round 13 closes the rest-bridging defect: a run is **contiguous** only while
 * every onset falls exactly on the previous note's release
 * (`n.startTick ≤ prev.startTick + prev.durationTicks`). The old
 * `> ticksPerBeat / 2` spacing test admitted a one-16th hole — Bach Var. 1
 * m. 4 beamed `528 540 564` straight across the tick-552 rest, because
 * `564 − 540 = 24` was not *greater* than 24. The rest at 552 now splits the
 * beat into a `528 540` two-note beam and an independent flagged 16th at 564.
 *
 * `middleCY` is kept for call-site compatibility; the corridor is protected by
 * the beam solver, not by the partition.
 *
 * Round 17B re-joins exactly the single-16th-rest boundaries through the
 * post-merge {@link bridgeBeamGroupsAcrossRests} (standard beam bridging); the
 * partition itself still splits at every hole.
 */
export function partitionBeamGroups(
  notes: JankoRhythmNote[],
  tokens?: Partial<JankoTokens> | null,
  middleCY?: number | null
): JankoBeamPartition {
  const t = resolveJankoTokens(tokens);
  void middleCY;

  const buckets = new Map<string, JankoRhythmNote[]>();
  const unbeamable = new Map<Hand, JankoRhythmNote[]>();
  for (const n of notes) {
    if (n.durationTicks > t.ticksPerBeat / 2) {
      const blockers = unbeamable.get(n.hand);
      if (blockers) blockers.push(n);
      else unbeamable.set(n.hand, [n]);
      continue;
    }
    const measure = Math.floor(n.startTick / t.ticksPerMeasure);
    const beat = Math.floor((n.startTick % t.ticksPerMeasure) / t.ticksPerBeat);
    const key = `${n.hand}|${measure}|${beat}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(n);
    else buckets.set(key, [n]);
  }

  const groups: JankoRhythmNote[][] = [];
  const ungrouped: JankoRhythmNote[] = [];
  const grouped = new Set<string>();
  for (const bucket of buckets.values()) {
    const sorted = [...bucket].sort((a, b) => a.startTick - b.startTick);
    // A simultaneity is never a melodic beam: notes sharing an onset stay out
    // of every run (their clasp bracket carries the duration).
    const onsets = new Map<number, number>();
    for (const n of sorted) onsets.set(n.startTick, (onsets.get(n.startTick) ?? 0) + 1);
    const melodic = sorted.filter((n) => onsets.get(n.startTick) === 1);
    // Only contiguous 8ths/16ths beam together; rests and longer values break
    // the beam, so split the bucket into maximal contiguous runs.
    let run: JankoRhythmNote[] = [];
    const flush = (): void => {
      if (run.length >= 2) {
        groups.push(run);
        for (const n of run) grouped.add(n.id);
      }
      run = [];
    };
    for (const n of melodic) {
      const prev = run[run.length - 1];
      if (prev) {
        const gap = n.startTick - prev.startTick > t.ticksPerBeat / 2;
        // Round 13: a beam is a **continuous** gesture. A rest (or any silence)
        // in this hand's voice breaks it, so the connector may never bridge a
        // gap: the next onset must fall exactly on the previous note's release.
        const discontinuous = n.startTick > prev.startTick + prev.durationTicks;
        const straddled = (unbeamable.get(n.hand) ?? []).some(
          (b) => b.startTick > prev.startTick && b.startTick < n.startTick
        );
        if (gap || discontinuous || straddled) flush();
      }
      run.push(n);
    }
    flush();
  }
  for (const n of notes) {
    if (!grouped.has(n.id)) ungrouped.push(n);
  }
  return { groups, ungrouped };
}

/**
 * A printed rest as seen by the beam bridge: the musical span a beam run may
 * continue across. Structural on purpose — `JankoRestGeometry` satisfies it —
 * so the rhythm layer never imports the rest painter.
 */
export interface JankoBeamBridgeRest {
  /** Absolute onset tick of the silence. */
  tick: number;
  /** Length of the silence (ticks). */
  durationTicks: number;
  /** Hand whose voice is silent. */
  hand: Hand;
}

/**
 * Round 17B beam bridging: post-merge the Round 13 partition across a single
 * printed 16th rest strictly inside one beat.
 *
 * Standard practice beams together across a short silence: Bach Var. 1 m. 4
 * beat 3 plays `6 9 rest 0`, and the run is one gesture, not two notes plus
 * an orphan. The partition above still splits at every hole (Round 13
 * contiguity stands — a silence is never silently absorbed); this pass then
 * re-joins exactly the boundaries where ALL hold:
 *
 * - the rest lasts at most a 16th (`durationTicks ≤ ticksPerBeat / 4`);
 * - the rest sits strictly inside one beat window shared with both flanking
 *   beamable notes (same hand, same measure, same beat bucket, and
 *   `beatStart < rest.tick` with `rest end < beatEnd`);
 * - the flank is otherwise contiguous: the previous note releases exactly on
 *   the rest (`prev.release == rest.tick`), the rest ends exactly on the next
 *   onset (`rest end == next.startTick`), and no other note of the hand starts
 *   strictly between the flanks.
 *
 * Single rests only — no chains: the two equalities admit exactly one rest
 * record spanning the boundary, so two consecutive rests (or a rest plus any
 * other silence) never bridge. Rests of an 8th or more, and any cross-beat
 * gap, still break the run. Merged notes leave `ungrouped` (their flags are
 * gone — the beam carries them); every other note keeps its partition side.
 */
export function bridgeBeamGroupsAcrossRests(
  partition: JankoBeamPartition,
  rests: readonly JankoBeamBridgeRest[],
  tokens?: Partial<JankoTokens> | null
): JankoBeamPartition {
  const t = resolveJankoTokens(tokens);
  const beat = t.ticksPerBeat;
  const measure = t.ticksPerMeasure;
  const restMax = beat / 4;
  // The partition's own bucket math, matched exactly (no anacrusis shift).
  const bucketOf = (startTick: number, hand: Hand): string =>
    `${hand}|${Math.floor(startTick / measure)}|${Math.floor((startTick % measure) / beat)}`;

  const all = [...partition.groups.flat(), ...partition.ungrouped];
  const onsetCount = new Map<string, number>();
  for (const n of all) {
    const key = `${n.hand}|${n.startTick}`;
    onsetCount.set(key, (onsetCount.get(key) ?? 0) + 1);
  }
  // Only a melodic beamable note may flank a bridge: a simultaneity keeps its
  // clasp (Round 11) and a longer value breaks the run (Round 13).
  const melodic = (n: JankoRhythmNote): boolean =>
    n.durationTicks <= beat / 2 && onsetCount.get(`${n.hand}|${n.startTick}`) === 1;

  // One run id per partition group plus one per melodic single; union-find
  // joins the runs a printed rest bridges.
  const runOf = new Map<string, number>();
  partition.groups.forEach((group, i) => {
    for (const n of group) runOf.set(n.id, i);
  });
  let nextRun = partition.groups.length;
  for (const n of partition.ungrouped) {
    if (melodic(n) && !runOf.has(n.id)) runOf.set(n.id, nextRun++);
  }
  const parent = new Map<number, number>();
  const find = (r: number): number => {
    let root = r;
    while (parent.get(root) !== undefined) root = parent.get(root)!;
    let cursor = r;
    while (cursor !== root) {
      const next = parent.get(cursor)!;
      parent.set(cursor, root);
      cursor = next;
    }
    return root;
  };
  const union = (a: number, b: number): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(Math.max(ra, rb), Math.min(ra, rb));
  };

  const byId = new Map(all.map((n) => [n.id, n]));
  const buckets = new Map<string, JankoRhythmNote[]>();
  for (const n of all) {
    if (!melodic(n)) continue;
    const key = bucketOf(n.startTick, n.hand);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(n);
    else buckets.set(key, [n]);
  }
  // Same-hand onset ticks, for the otherwise-contiguous flank check.
  const handTicks = new Map<Hand, number[]>();
  for (const n of all) {
    const list = handTicks.get(n.hand);
    if (list) list.push(n.startTick);
    else handTicks.set(n.hand, [n.startTick]);
  }
  for (const list of handTicks.values()) list.sort((a, b) => a - b);

  const bridges = (a: JankoRhythmNote, b: JankoRhythmNote, key: string): boolean => {
    const release = a.startTick + a.durationTicks;
    const [, m, beatIdx] = key.split('|').map(Number);
    const beatStart = m * measure + beatIdx * beat;
    const beatEnd = beatStart + beat;
    const spanned = rests.some(
      (r) =>
        r.hand === a.hand &&
        // Round 21: exactly a 16th bridges. The working set now also states
        // 32nds and 64ths, and `<= restMax` would have silently re-beamed every
        // beam that happens to span one of the new short rests — a move this
        // round does not prescribe.
        r.durationTicks === restMax &&
        r.tick === release &&
        r.tick + r.durationTicks === b.startTick &&
        r.tick > beatStart &&
        r.tick + r.durationTicks < beatEnd
    );
    if (!spanned) return false;
    return !(handTicks.get(a.hand) ?? []).some(
      (tick) => tick > a.startTick && tick < b.startTick
    );
  };

  for (const [key, bucket] of buckets) {
    const ordered = [...bucket].sort((a, b) => a.startTick - b.startTick);
    for (let i = 1; i < ordered.length; i++) {
      const a = ordered[i - 1];
      const b = ordered[i];
      const ra = runOf.get(a.id)!;
      const rb = runOf.get(b.id)!;
      if (ra === rb || find(ra) === find(rb)) continue;
      if (bridges(a, b, key)) union(ra, rb);
    }
  }

  // Rebuild: every merged run of two or more notes beams; each original group
  // keeps its position (replaced in place by its merged run) and all-single
  // merges append in tick order. Ungrouped keeps partition order minus the
  // notes the bridges carried into beams.
  const members = new Map<number, JankoRhythmNote[]>();
  for (const [id, run] of runOf) {
    const root = find(run);
    const list = members.get(root);
    const note = byId.get(id)!;
    if (list) list.push(note);
    else members.set(root, [note]);
  }
  for (const list of members.values()) list.sort((a, b) => a.startTick - b.startTick);
  const emitted = new Set<number>();
  const groups: JankoRhythmNote[][] = [];
  for (const group of partition.groups) {
    const root = find(runOf.get(group[0].id)!);
    if (emitted.has(root)) continue;
    emitted.add(root);
    const run = members.get(root)!;
    if (run.length >= 2) groups.push(run);
  }
  const singleMerges = [...members.entries()]
    .filter(([root, run]) => !emitted.has(root) && run.length >= 2)
    .map(([, run]) => run)
    .sort((a, b) => a[0].startTick - b[0].startTick);
  groups.push(...singleMerges);
  const beamed = new Set(groups.flat().map((n) => n.id));
  const ungrouped = partition.ungrouped.filter((n) => !beamed.has(n.id));
  return { groups, ungrouped };
}
