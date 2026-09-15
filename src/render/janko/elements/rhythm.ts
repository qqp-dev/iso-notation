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
  JankoClaspDurationStyle,
  JankoLayoutOptions,
  JankoRhythmStyle,
  JankoSubdivisionStyle,
  JankoTokens,
  ResolvedJankoTokens,
  getClusterSpacingPreset,
  resolveJankoOptions,
  resolveJankoTokens,
} from '../types';
import { isPositionOfHonor } from './notehead';
import { f } from './style';
import { URTEXT_FLAGS_DOWN, URTEXT_FLAGS_UP } from './urtext-paths';

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
  const { hy } = getClusterSpacingPreset(resolveJankoOptions(layoutOptions).clusterSpacing);
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
 */
export function subdivisionMarkCount(durationTicks: number): number {
  if (durationTicks <= 3) return 4; // 64th
  if (durationTicks <= 6) return 3; // 32nd
  if (durationTicks <= 14) return 2; // 16th
  if (durationTicks <= 38) return 1; // 8th (plain or dotted)
  return 0;
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
 */
export function beamLevel(durationTicks: number): number {
  return Math.max(1, subdivisionMarkCount(durationTicks));
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
function verbatimFlagPath(stemX: number, tipY: number, direction: -1 | 1, marks: number): string {
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
 * Solitary / unbeamed short note: bare stem plus duration ink plus the
 * augmentation dot for dotted values. Crescent dialects stack one mark per
 * subdivision at the stem tip within the tokenised reach; `'classical-urtext'`
 * paints one transcribed Bravura glyph per note (see `verbatimFlagPath`) at
 * the baked extents. Neither grammar crosses the stem.
 */
export function renderFlags(
  note: JankoRhythmNote,
  tokens?: Partial<JankoTokens> | null,
  style: JankoSubdivisionStyle = 'classical-urtext'
): string {
  const t = resolveJankoTokens(tokens);
  const s = getStemGeometry(note, t);
  const parts: string[] = [renderStem(note, t)];

  const marks = subdivisionMarkCount(note.durationTicks);
  if (style === 'classical-urtext') {
    if (marks >= 1) parts.push(verbatimFlagPath(s.stemX, s.stemEndY, s.direction, marks));
  } else {
    for (let i = 1; i <= marks; i++) {
      parts.push(renderSubdivisionMark(s.stemX, s.stemEndY, s.direction, i, style, t));
    }
  }
  if (note.durationTicks > 26 && note.durationTicks <= 38) {
    parts.push(renderAugmentationDot(note, t));
  }
  return parts.join('\n');
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
 * - the shared **half / whole** mark is a clean open white circular ring
 *   (`R = 3.0pt`, stroke `1.0pt`) whose interior knocks the spine out — zero
 *   crosshairs, under every paradigm;
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
/** Shared open white ring of a half / whole value (R = 3.0pt, stroke 1.0pt). */
export const CLASP_RING_RADIUS = 3.0;
export const CLASP_RING_STROKE = 1.0;
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
}

/** A duration-ink group the caller asks for (unresolved: value + spine y). */
export interface JankoClaspDurationInk {
  /** Absolute y of the group's centre on the spine. */
  centerY: number;
  /** The value the group carries (ticks). */
  durationTicks: number;
}

/** Resolve one requested duration-ink group into its painted mark grammar. */
export function resolveClaspInk(ink: JankoClaspDurationInk): ResolvedJankoClaspInk {
  const duration = claspDurationClass(ink.durationTicks);
  return {
    centerY: ink.centerY,
    durationTicks: ink.durationTicks,
    duration,
    flags: duration === 'spire-two-flags' ? 2 : duration === 'spire-one-flag' ? 1 : 0,
    pips: duration === 'double-pip' ? 2 : duration === 'pip' ? 1 : 0,
    dotted: claspDurationDotted(ink.durationTicks),
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
  /** Shortest member value — the duration the clasp carries. */
  durationTicks: number;
  /** Resolved duration grammar. */
  duration: JankoClaspDuration;
  /** Round 11: the light transverse duration paradigm the bracket paints. */
  durationStyle: JankoClaspDurationStyle;
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
   * Round 19: explicit duration-ink groups (value + spine y) for a **unified**
   * cross-hand bracket, which paints one group per hand. Omitted for a classic
   * bracket, whose single group sits at its own midpoint and carries the
   * carried value.
   */
  durationInk?: JankoClaspDurationInk[];
}

/** The bracket `[` path: cap → spine → cap. */
function claspBracketPath(claspX: number, topY: number, botY: number, cap: number): string {
  return (
    `M ${f(claspX + cap)} ${f(topY)} L ${f(claspX)} ${f(topY)} ` +
    `L ${f(claspX)} ${f(botY)} L ${f(claspX + cap)} ${f(botY)}`
  );
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
  const durationInk = (
    options?.durationInk && options.durationInk.length > 0
      ? options.durationInk
      : [{ centerY: (topY + botY) / 2, durationTicks }]
  ).map(resolveClaspInk);
  // `durationTicks` stays the **carried value** — the shortest member value,
  // which is what the cluster's first voice moves on, unified bracket or not.
  // The scalar mark fields mirror the bracket's primary ink group (the first
  // entry): for a classic bracket the only group, for a unified cross-hand
  // bracket its open half/whole group.
  const primary = durationInk[0];
  const cap = t.claspWidth;
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
    durationTicks,
    duration: claspDurationClass(durationTicks),
    durationStyle: options?.claspDurationStyle ?? 'kinetic-cross-slashes',
    flags: primary.flags,
    pips: primary.pips,
    dotted: primary.dotted,
    durationInk,
    durationDots: [],
    path: claspBracketPath(claspX, topY, botY, cap),
  };
  // Round 20: the augmentation dot of every dotted group is resolved here, once,
  // against the group's own mark ink and member discs.
  geometry.durationDots = durationInk.map((ink) =>
    ink.dotted ? claspDotCenter(geometry, ink, t) : null
  );
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
    path: claspBracketPath(group.claspX, railY, group.botY, group.capWidth),
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
 * Half-extents of the shared open (half / whole) mark: one clean white ring,
 * or two stacked rings for a whole note.
 */
function claspOpenMark(count: number): JankoClaspMarkExtents {
  const r = CLASP_RING_RADIUS + CLASP_RING_STROKE / 2;
  return {
    halfWidth: r,
    halfHeight: r,
    stack: count <= 1 ? 0 : CLASP_RING_RADIUS + CLASP_MARK_STACK_GAP,
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

/** Air (pt) the dot's ink at `(x, y)` keeps from all of its own mark's ink. */
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
  for (const cy of claspMarkCenters(group, ink, t.maxBeamSlope)) {
    if (ink.pips > 0) {
      air = Math.min(
        air,
        Math.hypot(x - group.claspX, y - cy) - (CLASP_RING_RADIUS + CLASP_RING_STROKE / 2) - r
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
 * - **hug air from every neighbour ink box** — in practice the cluster's own
 *   member discs, which the bracket's fit rule exempts but the notehead
 *   knockout would erase.
 *
 * The search is deterministic: a fan of directions from 45° (the classical
 * up-and-right satellite) to nearly vertical — and, for a cluster whose upper
 * channel is walled by its own heads, the free lower channel as the last
 * resort — and along each direction the nearest point that clears the mark. Of
 * every candidate that also clears each member disc by the hug, the one
 * **nearest its mark** wins (so the dot always hugs its own ink); if none does
 * — never on the corpus, and the linter's `clasp-dot-fusion` would say so — the
 * best-clearing candidate is returned rather than shrinking the air silently.
 */
export function claspDotCenter(
  group: JankoClaspGroupGeometry,
  ink: ResolvedJankoClaspInk,
  tokens?: Partial<JankoTokens> | null
): { x: number; y: number } {
  const t = resolveJankoTokens(tokens);
  const hug = t.augmentationDotGap;
  const r = t.augmentationDotRadius;
  const discAir = (x: number, y: number): number =>
    group.notes.length === 0
      ? Number.POSITIVE_INFINITY
      : Math.min(...group.notes.map((n) => Math.hypot(x - n.x, y - n.y) - t.noteheadRadius - r));
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
      const air = discAir(x, y);
      if (best === null || air > best.air) best = { x, y, air };
      if (air >= hug - 1e-9 && (clean === null || d < clean.d - 1e-9)) clean = { x, y, d };
      break;
    }
  }
  if (clean) return { x: clean.x, y: clean.y };
  return best ?? { x: group.claspX + CLASP_DOT_OFFSET, y: ink.centerY - CLASP_DOT_OFFSET };
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
    const open = ink.pips > 0;
    const hasMark = open || ink.flags > 0;
    const mark = open
      ? claspOpenMark(ink.pips)
      : claspFlagMark(group.durationStyle, ink.flags, rake);
    const centers = mark.stack === 0 ? [yMid] : [yMid - mark.stack, yMid + mark.stack];

    for (const cy of hasMark ? centers : []) {
      if (open) {
        // Every paradigm shares the clean open white ring: its 100% white
        // interior knocks the spine out with zero crosshairs.
        out.push(
          `    <circle class="janko-clasp-ring" cx="${f(claspX)}" cy="${f(cy)}" r="${f(CLASP_RING_RADIUS)}" fill="#FFFFFF" stroke="#111111" stroke-width="${CLASP_RING_STROKE.toFixed(2)}"/>`
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

    // A dotted value adds the canonical 0.75pt augmentation dot as a clean
    // satellite of the mark (Round 20), painted last so a white knockout can
    // never erase it. The resolved dot centre is the geometry's own datum.
    if (ink.dotted) {
      const dot = group.durationDots?.[index] ?? claspDotCenter(group, ink, t);
      out.push(
        `    <circle class="janko-clasp-dot" cx="${f(dot.x)}" cy="${f(dot.y)}" r="${f(t.augmentationDotRadius)}" fill="#111111"/>`
      );
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
    if (ink.pips > 0 || ink.flags > 0) {
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
    }
  }
  return { x0, y0, x1, y1 };
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
  const ids = group.notes.map((n) => n.id).join(',');
  const parts: string[] = [
    `  <g class="janko-clasp-group" data-clasp-tick="${group.tick}" data-clasp-duration="${group.duration}" data-clasp-duration-style="${group.durationStyle}" data-clasp-notes="${ids}">`,
    `    <path class="janko-clasp" d="${group.path}" fill="none" stroke="#111111" stroke-width="${group.strokeWidth.toFixed(2)}" stroke-linejoin="miter" stroke-linecap="butt"/>`,
  ];
  parts.push(...renderClaspDurationInk(group, t));
  parts.push('  </g>');
  return parts.join('\n');
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
  tokens?: Partial<JankoTokens> | null
): string {
  if (groups.length === 0 && rails.length === 0) return '';
  const t = resolveJankoTokens(tokens);
  const parts: string[] = ['  <g class="janko-clasp-layer">'];
  for (const group of groups) parts.push(renderChordClasp(group, t));
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
 */
export const CHORD_BRIDGE_MIN_GAP = 20.0;
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
 * - every adjacent pair closer than {@link CHORD_BRIDGE_MIN_GAP} is a tight
 *   cluster — its internal connecting stem is **suppressed**, so nothing
 *   daggers the neighbouring notehead;
 * - every adjacent pair further apart is a wide leap — an intentional
 *   {@link JankoChordBridge} line connects the two heads and unifies the hand's
 *   reach;
 * - the **outer extremity** of the group (topmost head for an up-stem hand,
 *   bottommost for a down-stem hand) carries the group's rhythmic duration —
 *   its stem, plus one mark per 8th/16th/32nd level of the hand's shortest
 *   member value.
 */
export interface JankoVerticalChordGroup {
  /** The head that carries the whole hand's duration, at the group's extremity. */
  carrier: JankoRhythmNote;
  /** Duration (ticks) the carrier draws — the hand's shortest member value. */
  durationTicks: number;
  /** Ids of the interior heads whose own stems are suppressed. */
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
  tokens?: Partial<JankoTokens> | null
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
  const suppressedIds = sorted.filter((n) => n.id !== carrier.id).map((n) => n.id);
  const bridges: JankoChordBridge[] = [];
  for (let i = 0; i + 1 < sorted.length; i++) {
    const upper = sorted[i];
    const lower = sorted[i + 1];
    if (lower.y - upper.y <= CHORD_BRIDGE_MIN_GAP) continue;
    bridges.push({
      x: upper.x,
      y1: upper.y + t.noteheadRadius + CHORD_BRIDGE_DISC_AIR,
      y2: lower.y - t.noteheadRadius - CHORD_BRIDGE_DISC_AIR,
      noteIds: [upper.id, lower.id],
    });
  }
  return {
    carrier,
    durationTicks: Math.min(...notes.map((n) => n.durationTicks)),
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
  if (bridges.length === 0) return '';
  const parts: string[] = ['    <g class="janko-chord-bridges">'];
  for (const b of bridges) {
    parts.push(
      `      <line class="janko-chord-bridge" data-bridge-notes="${b.noteIds.join(',')}" x1="${f(b.x)}" y1="${f(b.y1)}" x2="${f(b.x)}" y2="${f(b.y2)}" stroke="#111111" stroke-width="${strokeWidth.toFixed(2)}" stroke-linecap="butt"/>`
    );
  }
  parts.push('    </g>');
  return parts.join('\n');
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
 */
export function computeBeamGroupGeometry(
  group: JankoRhythmNote[],
  tokens?: Partial<JankoTokens> | null,
  obstacles?: readonly JankoRhythmNote[] | null,
  spineY?: number | null,
  restInk?: readonly JankoBeamRestObstacle[] | null
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
  const noteLevels = sorted.map((n) => beamLevel(n.durationTicks));
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
 */
export function renderBeamGroup(
  group: JankoRhythmNote[],
  tokens?: Partial<JankoTokens> | null,
  geometry?: JankoBeamGroupGeometry | null,
  subdivisionStyle: JankoSubdivisionStyle = 'classical-urtext'
): string {
  const t = resolveJankoTokens(tokens);
  if (group.length === 0) return '';
  if (group.length === 1) {
    // A solitary short note is flagged, never crossbarred.
    return renderFlags(group[0], t, subdivisionStyle);
  }

  const beam = geometry ?? computeBeamGroupGeometry(group, t);
  if (!beam) return '';
  const { notes: sorted, stems, primary, direction } = beam;

  const parts: string[] = ['  <g class="janko-beam-group">'];

  // Every stem grows from its notehead to the (clamped) beam centerline.
  for (const s of stems) {
    parts.push(`    <line class="janko-stem" x1="${f(s.stemX)}" y1="${f(s.stemStartY)}" x2="${f(s.stemX)}" y2="${f(beam.beamY(s.stemX))}" stroke="#111111" stroke-width="${JANKO_STEM_STROKE_WIDTH.toFixed(2)}"/>`);
  }

  // Primary beam: clamped straight connector across the stem tips, painted as
  // a stem-flush filled rail (beamRailPathD) rather than a stroked line.
  parts.push(
    `    <path class="janko-beam" d="${beamRailPathD(primary.x1, primary.y1, primary.x2, primary.y2, t.beamThickness)}" fill="#111111"/>`
  );

  // Every higher beam level, closer to the noteheads: the 16th secondary, the
  // 32nd tertiary and the 64th quaternary all come from the same generic run
  // rule, and a single-note run paints a Gould partial beam. Level 2 keeps its
  // historical `janko-beam-secondary` class; the deeper levels name themselves.
  const LEVEL_CLASS: Readonly<Record<number, string>> = {
    2: 'janko-beam-secondary',
    3: 'janko-beam-tertiary',
    4: 'janko-beam-quaternary',
  };
  for (const strip of beam.levels) {
    if (strip.level < 2) continue;
    const cls = strip.stub
      ? `${LEVEL_CLASS[strip.level] ?? 'janko-beam-secondary'} janko-beam-stub`
      : (LEVEL_CLASS[strip.level] ?? 'janko-beam-secondary');
    const c = strip.connector;
    parts.push(
      `    <path class="${cls}" data-beam-level="${strip.level}"${strip.stub ? ' data-beam-stub="1"' : ''} d="${beamRailPathD(c.x1, c.y1, c.x2, c.y2, t.beamThickness)}" fill="#111111"/>`
    );
  }

  void direction;
  for (const n of sorted) {
    if (n.durationTicks > 26 && n.durationTicks <= 38) {
      parts.push(renderAugmentationDot(n, t));
    }
  }

  parts.push('  </g>');
  return parts.join('\n');
}

/** Dispatch one note to its selected rhythm dialect. */
export function renderRhythm(
  note: JankoRhythmNote,
  style: JankoRhythmStyle,
  tokens?: Partial<JankoTokens> | null,
  subdivisionStyle: JankoSubdivisionStyle = 'classical-urtext'
): string {
  switch (style) {
    case 'horizontal-ticks':
      return renderHorizontalTicks(note, tokens);
    case 'beamed':
      // Standalone (unbeamable) notes carry standard flags, not crossbars.
      return renderFlags(note, tokens, subdivisionStyle);
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
