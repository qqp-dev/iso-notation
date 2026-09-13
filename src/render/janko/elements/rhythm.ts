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
 * note column regardless of hand.
 */

import { Hand } from '../../../model/types';
import {
  JankoRhythmStyle,
  JankoSubdivisionStyle,
  JankoTokens,
  ResolvedJankoTokens,
  resolveJankoTokens,
} from '../types';
import { isPositionOfHonor } from './notehead';
import { f } from './style';

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
}

/** Resolved stem geometry for one note. */
export interface JankoStemGeometry {
  /** Stem column: always the notehead's vertical centreline (`stemX === note.x`). */
  stemX: number;
  stemStartY: number;
  stemEndY: number;
  /** -1 for RH (up), +1 for LH (down). */
  direction: -1 | 1;
}

function stemDirection(hand: Hand): -1 | 1 {
  return hand === 'RH' ? -1 : 1;
}

/** Air (pt) between a regular knockout disc and its stem start. */
export const STEM_ATTACHMENT_AIR = 0.2;
/** Air (pt) between the Position of Honor halo ring and its stem start. */
export const HONOR_STEM_ATTACHMENT_AIR = 0.4;

/** Canonical stem attachment radii (regular heads, tick-0 honor sounds). */
export function getStemAttachmentRadii(tokens?: Partial<JankoTokens> | null): {
  regular: number;
  honor: number;
} {
  const t = resolveJankoTokens(tokens);
  return {
    regular: t.noteheadRadius + STEM_ATTACHMENT_AIR,
    honor: t.haloRadius + HONOR_STEM_ATTACHMENT_AIR,
  };
}

/**
 * Distance (pt) from the notehead centre at which its stem begins.
 *
 * A stem starts flush on the **outside** of the glyph's own circle: the wider
 * Position of Honor halo ring for the tick-0 opening sounds, the white knockout
 * disc otherwise. The stem can therefore never cut through the halo ring, and
 * it never emerges inside the mask where it would crowd the duodecimal digit.
 */
export function getStemAttachmentRadius(
  note: JankoRhythmNote,
  tokens?: Partial<JankoTokens> | null
): number {
  const radii = getStemAttachmentRadii(tokens);
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
 * outer edge of the knockout disc (or of the halo ring at tick 0) — and runs to
 * the canonical `stemLength` measured from the notehead centre, so the visible
 * stem stays substantial while never touching the glyph or the halo.
 */
export function getStemGeometry(
  note: JankoRhythmNote,
  tokens?: Partial<JankoTokens> | null
): JankoStemGeometry {
  const t = resolveJankoTokens(tokens);
  const dir = stemDirection(note.hand);
  return {
    stemX: note.x,
    stemStartY: note.y + dir * getStemAttachmentRadius(note, t),
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
  return `    <line class="janko-stem" x1="${f(s.stemX)}" y1="${f(s.stemStartY)}" x2="${f(s.stemX)}" y2="${f(s.stemEndY)}" stroke="#111111" stroke-width="0.90"/>`;
}

/** Augmentation dot for dotted durations. */
function renderAugmentationDot(note: JankoRhythmNote, tokens: ResolvedJankoTokens): string {
  const dir = stemDirection(note.hand);
  const cx = dir === -1 ? note.x + tokens.noteheadRadius + 3.2 : note.x - tokens.noteheadRadius - 3.2;
  return `    <circle class="janko-augmentation-dot" cx="${f(cx)}" cy="${f(note.y)}" r="${f(tokens.augmentationDotRadius)}" fill="#111111"/>`;
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

/** Thickness (pt) of the kinetic monoline tabs (`'kinetic-tab-30'`/`-45'`). */
export const SUBDIVISION_TAB_THICKNESS = 1.1;
/** Optical taper (pt) of `'kinetic-tab-tapered'`: root at the stem → tip. */
export const SUBDIVISION_TAPER_ROOT = 1.4;
export const SUBDIVISION_TAPER_TIP = 0.8;
/** Tangent of the 30° kinetic rake (the 45° tab rakes at exactly 1). */
export const SUBDIVISION_TAB_30_TAN = Math.tan(Math.PI / 6);

/**
 * Number of subdivision marks stacked at a stem tip: three for a 32nd, two for
 * a 16th, one for an 8th (dotted or plain) and none for a quarter or longer.
 * Stacks are spaced by `tokens.flagSpacing`, so every dialect stacks alike.
 */
export function subdivisionMarkCount(durationTicks: number): number {
  if (durationTicks <= 7) return 3;
  if (durationTicks <= 14) return 2;
  if (durationTicks <= 38) return 1;
  return 0;
}

/**
 * Paint one subdivision mark latched to a stem tip, in the active Round 7
 * dialect. `stemX`/`tipY` are the stem column and anchor, `direction` the stem
 * direction (−1 up, +1 down) and `index` the 1-based stack position: mark `k`
 * sits `(k − 1) · flagSpacing` further along the flag drop (`−direction`).
 *
 * **Kinetic direction.** The tab rakes diagonally *with* the stem's motion:
 * a lower stem (going down from its note) draws its tab angled **upward**, an
 * upper stem (going up) draws it angled **downward** — the shared
 * `sign = −direction` rake. Every dialect reaches at most `flagWidth` right of
 * the stem, and a single mark never drops further than `flagHeight`, so the
 * shared `claspInkBox` audit covers all four without a per-style box:
 *
 * - `kinetic-tab-30`     30° diagonal tab, 1.1pt monoline
 * - `kinetic-tab-45`     45° diagonal tab, 1.1pt monoline (chevron rake)
 * - `kinetic-tab-tapered` 30° diagonal tab, 1.4pt root tapering to 0.8pt tip
 * - `classical-urtext`   refined numeral-balanced urtext flag
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
  switch (style) {
    case 'kinetic-tab-30':
    case 'kinetic-tab-45': {
      const rake = style === 'kinetic-tab-45' ? 1 : SUBDIVISION_TAB_30_TAN;
      return (
        `    <line ${head} x1="${f(stemX)}" y1="${f(cy)}" ` +
        `x2="${f(stemX + w)}" y2="${f(cy + sign * w * rake)}" stroke="#111111" ` +
        `stroke-width="${SUBDIVISION_TAB_THICKNESS.toFixed(2)}" stroke-linecap="butt"${tail}/>`
      );
    }
    case 'kinetic-tab-tapered': {
      // The same 30° rake, drawn as a filled quad whose thickness tapers
      // perpendicular to its own axis: a 1.4pt root at the stem narrowing to a
      // 0.8pt tip. The tip is pulled in by its own normal half-extent so the
      // dialect still reaches exactly `flagWidth` right of the stem.
      const angle = Math.atan(SUBDIVISION_TAB_30_TAN);
      const nx = -sign * Math.sin(angle);
      const ny = Math.cos(angle);
      const tip = SUBDIVISION_TAPER_TIP / 2;
      const root = SUBDIVISION_TAPER_ROOT / 2;
      const reach = w - tip * Math.abs(nx);
      const tipX = stemX + reach;
      const tabTipY = cy + sign * reach * SUBDIVISION_TAB_30_TAN;
      const d =
        `M ${f(stemX + root * nx)} ${f(cy + root * ny)} ` +
        `L ${f(tipX + tip * nx)} ${f(tabTipY + tip * ny)} ` +
        `L ${f(tipX - tip * nx)} ${f(tabTipY - tip * ny)} ` +
        `L ${f(stemX - root * nx)} ${f(cy - root * ny)} Z`;
      return `    <path ${head} d="${d}" fill="#111111" stroke="none"${tail}/>`;
    }
    case 'classical-urtext':
    default: {
      const d =
        `M ${f(stemX)} ${f(cy)} ` +
        `C ${f(stemX + 0.55 * w)} ${f(cy + sign * 0.10 * h)} ${f(stemX + w)} ` +
        `${f(cy + sign * 0.62 * h)} ${f(stemX + 0.42 * w)} ${f(cy + sign * h)} ` +
        `C ${f(stemX + 0.30 * w)} ${f(cy + sign * 0.66 * h)} ${f(stemX + 0.14 * w)} ` +
        `${f(cy + sign * 0.70 * h)} ${f(stemX)} ${f(cy + sign * 0.52 * h)} Z`;
      return `    <path ${head} d="${d}" fill="#111111" stroke="none"${tail}/>`;
    }
  }
}

/**
 * Solitary / unbeamed short note: bare stem plus the active subdivision style
 * (see {@link renderSubdivisionMark}) and the augmentation dot for dotted
 * values. Every dialect latches onto the stem tip and reaches no further right
 * than `flagWidth`, so the duration grammar replaces the neutral perpendicular
 * tick used by the `horizontal-ticks` lattice dialect without ever crossing the
 * stem.
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
  for (let i = 1; i <= marks; i++) {
    parts.push(renderSubdivisionMark(s.stemX, s.stemEndY, s.direction, i, style, t));
  }
  if (note.durationTicks > 26 && note.durationTicks <= 38) {
    parts.push(renderAugmentationDot(note, t));
  }
  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Round 5 — the external left clasp: cluster bracket + duration carrier
// ---------------------------------------------------------------------------

/** Length (pt) of a quarter-note clasp spire, measured up from the top corner. */
export const CLASP_SPIRE_LENGTH = 8.5;
/** Radius (pt) of the open pip a half/whole-note clasp carries. */
export const CLASP_PIP_RADIUS = 1.5;
/** Vertical gap (pt) between the two pips of a whole-note clasp. */
export const CLASP_PIP_GAP = 1.0;
/**
 * Minimum horizontal spread (pt) that makes an onset a *horizontally displaced*
 * cluster (Round 6). Heads that share one clean vertical column spread by 0pt
 * and are never clasped: the clasp exists solely to unify row-snapped heads.
 */
export const CLASP_MIN_HORIZONTAL_SPREAD = 1.0;

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
 * Duration grammar of a clasp tip.
 *
 * | class               | value            | ink at the clasp corner          |
 * | ------------------- | ---------------- | -------------------------------- |
 * | `'double-pip'`      | whole (≥ 192 t)  | two stacked open circles          |
 * | `'pip'`             | half (≥ 96 t)    | one open circle                   |
 * | `'spire'`           | quarter (≥ 39 t) | clean vertical spire, 8.5pt       |
 * | `'spire-one-flag'`  | 8th (15–38 t)    | spire + one flag hook             |
 * | `'spire-two-flags'` | 16th (≤ 14 t)    | spire + two flag hooks            |
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

/** Classify a duration into the clasp tip grammar (see {@link JankoClaspDuration}). */
export function claspDurationClass(durationTicks: number): JankoClaspDuration {
  if (durationTicks >= 192) return 'double-pip';
  if (durationTicks >= 96) return 'pip';
  if (durationTicks > 38) return 'spire';
  if (durationTicks > 14) return 'spire-one-flag';
  return 'spire-two-flags';
}

/** One resolved left clasp: bracket geometry plus its duration tip. */
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
  /** Stroke thickness of the bracket and spire (token `claspStrokeWidth`). */
  strokeWidth: number;
  /** Shortest member value — the duration the clasp carries. */
  durationTicks: number;
  /** Resolved tip grammar. */
  duration: JankoClaspDuration;
  /** Flag hooks (0–2) drawn at the spire tip. */
  flags: number;
  /** Open pips (0–2) drawn at the top corner. */
  pips: number;
  /** Spire tip y, or null when the clasp carries a pip instead. */
  spireTipY: number | null;
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
   * Round 6: reject a purely vertical cluster. `'per-hand-clasp'` passes `true`
   * so a hand's clean column keeps its traditional stems; the Round 5 paradigms
   * leave it off and clasp every simultaneity.
   */
  requireHorizontalSpread?: boolean;
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
 * Returns null for a lone note, and (with `requireHorizontalSpread`) for a
 * cluster whose heads share one vertical column: a clasp groups a
 * horizontally displaced simultaneity, so melodic writing and clean columns are
 * never touched.
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
  if (options?.requireHorizontalSpread && !claspNotesHorizontallySpread(notes)) return null;
  const minY = sorted[0].y;
  const maxY = sorted[sorted.length - 1].y;
  const r = t.noteheadRadius;
  const claspX = minX - r - t.claspOffset;
  const topY = minY - r;
  const botY = maxY + r;
  const durationTicks = options?.durationTicks ?? Math.min(...notes.map((n) => n.durationTicks));
  const duration = claspDurationClass(durationTicks);
  const flags =
    duration === 'spire-two-flags' ? 2 : duration === 'spire-one-flag' ? 1 : 0;
  const pips = duration === 'double-pip' ? 2 : duration === 'pip' ? 1 : 0;
  const spireTipY = flags > 0 || duration === 'spire' ? topY - CLASP_SPIRE_LENGTH : null;
  const cap = t.claspWidth;
  const path =
    `M ${f(claspX + cap)} ${f(topY)} L ${f(claspX)} ${f(topY)} ` +
    `L ${f(claspX)} ${f(botY)} L ${f(claspX + cap)} ${f(botY)}`;
  return {
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
    duration,
    flags,
    pips,
    spireTipY,
    path,
  };
}

/** Stretch a clasp's spire so its tip lands on a rail at `railY`. */
export function withClaspRail(
  group: JankoClaspGroupGeometry,
  railY: number
): JankoClaspGroupGeometry {
  if (group.spireTipY === null) return group;
  return { ...group, spireTipY: railY, flags: 0 };
}

/**
 * Axis-aligned ink box of one clasp: spine, caps, spire, flag hooks and pips.
 * Shared by the visual linter and the rail solver, so the audited box can never
 * drift from the painted ink.
 */
export function claspInkBox(
  group: JankoClaspGroupGeometry,
  tokens?: Partial<JankoTokens> | null
): { x0: number; y0: number; x1: number; y1: number } {
  const t = resolveJankoTokens(tokens);
  const pipTop = group.pips > 0 ? group.topY - CLASP_PIP_RADIUS - (group.pips - 1) * (2 * CLASP_PIP_RADIUS + CLASP_PIP_GAP) : group.topY;
  const tip = group.spireTipY ?? group.topY;
  const flagReach = group.flags > 0 ? t.flagWidth : 0;
  const flagDrop = group.flags > 0 ? t.flagHeight + (group.flags - 1) * t.flagSpacing : 0;
  const reach = Math.max(group.capWidth, flagReach, group.pips > 0 ? CLASP_PIP_RADIUS : 0);
  return {
    x0: group.claspX - (group.pips > 0 ? CLASP_PIP_RADIUS : 0),
    y0: Math.min(pipTop, tip),
    x1: group.claspX + reach,
    y1: Math.max(group.botY, tip + flagDrop),
  };
}

/**
 * Paint one left clasp: the bracket, its duration spire, subdivision marks or
 * pips. The group is engraved in the rhythm layer (beneath the noteheads), so a
 * knockout always erases whatever a clasp should never have touched. The tip
 * draws its 8th/16th marks in the active `subdivisionStyle` (Round 7), so a
 * clasped cluster and a flagged stem of the same value can never disagree.
 */
export function renderChordClasp(
  group: JankoClaspGroupGeometry,
  tokens?: Partial<JankoTokens> | null,
  subdivisionStyle: JankoSubdivisionStyle = 'classical-urtext'
): string {
  const t = resolveJankoTokens(tokens);
  const ids = group.notes.map((n) => n.id).join(',');
  const parts: string[] = [
    `  <g class="janko-clasp-group" data-clasp-tick="${group.tick}" data-clasp-duration="${group.duration}" data-clasp-notes="${ids}">`,
    `    <path class="janko-clasp" d="${group.path}" fill="none" stroke="#111111" stroke-width="${group.strokeWidth.toFixed(2)}" stroke-linejoin="miter" stroke-linecap="butt"/>`,
  ];
  if (group.spireTipY !== null) {
    parts.push(
      `    <line class="janko-clasp-spire" x1="${f(group.claspX)}" y1="${f(group.topY)}" x2="${f(group.claspX)}" y2="${f(group.spireTipY)}" stroke="#111111" stroke-width="${group.strokeWidth.toFixed(2)}" stroke-linecap="butt"/>`
    );
  }
  for (let i = 1; i <= group.flags; i++) {
    parts.push(
      renderSubdivisionMark(
        group.claspX,
        group.spireTipY ?? group.topY,
        -1,
        i,
        subdivisionStyle,
        t,
        'janko-clasp-flag'
      )
    );
  }
  for (let i = 0; i < group.pips; i++) {
    const cy = group.topY - CLASP_PIP_RADIUS - i * (2 * CLASP_PIP_RADIUS + CLASP_PIP_GAP);
    parts.push(
      `    <circle class="janko-clasp-pip" cx="${f(group.claspX)}" cy="${f(cy)}" r="${f(CLASP_PIP_RADIUS)}" fill="none" stroke="#111111" stroke-width="${group.strokeWidth.toFixed(2)}"/>`
    );
  }
  parts.push('  </g>');
  return parts.join('\n');
}

/** One horizontal rail joining the spire tips of contiguous clasps. */
export interface JankoClaspRailGeometry {
  /** Leftmost spire column of the joined run. */
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
 * `'beamed-clasp-rail'` (which are painted after the spires they join).
 */
export function renderClaspGroup(
  groups: readonly JankoClaspGroupGeometry[],
  rails: readonly JankoClaspRailGeometry[] = [],
  tokens?: Partial<JankoTokens> | null,
  subdivisionStyle: JankoSubdivisionStyle = 'classical-urtext'
): string {
  if (groups.length === 0 && rails.length === 0) return '';
  const t = resolveJankoTokens(tokens);
  const parts: string[] = ['  <g class="janko-clasp-layer">'];
  for (const group of groups) parts.push(renderChordClasp(group, t, subdivisionStyle));
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
  /** Secondary 16th connector, or null when fewer than two 16ths. */
  secondary: JankoBeamConnector | null;
  /** Beam centerline y at an absolute x. */
  beamY(x: number): number;
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

/**
 * Resolve the beam geometry of a group. Returns null for groups shorter than
 * two notes (a solitary short note is engraved with standard flags instead).
 *
 * @param obstacles other noteheads of the system the connector must avoid
 * @param spineY    absolute y of the Middle C spine, when the corridor is a
 *                  declared no-fly line for beams
 */
export function computeBeamGroupGeometry(
  group: JankoRhythmNote[],
  tokens?: Partial<JankoTokens> | null,
  obstacles?: readonly JankoRhythmNote[] | null,
  spineY?: number | null
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

  const sixteenths = sorted.filter((n) => n.durationTicks <= 14);
  const secondaryOffset = -direction * (t.beamThickness + SECONDARY_BEAM_GAP);
  const hasSecondary = sixteenths.length >= 2;
  // The secondary connector's columns do not depend on the anchor, so they are
  // resolved once instead of inside every relaxation pass.
  const secondarySpan = hasSecondary
    ? span(sixteenths.map((n) => getStemGeometry(n, t)))
    : null;

  // Minimum stem length: the canonical stem, but never less than the notehead
  // disc plus the required air — counting the 16th secondary beam, which sits
  // `beamThickness + gap` closer to the heads than the primary connector.
  // It is measured from the notehead centre (the beam anchor below), so the
  // *visible* stem between the disc perimeter and the beam is
  // `minStemLength - getStemAttachmentRadius(note)` and stays substantial.
  const secondaryDepth = hasSecondary ? t.beamThickness + SECONDARY_BEAM_GAP : 0;
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

  /** The two connectors (primary + optional 16th secondary) for one anchor. */
  const connectorsAt = (a: number): JankoBeamConnector[] => {
    const list: JankoBeamConnector[] = [
      {
        x1: lo.stemX,
        y1: a,
        x2: hi.stemX,
        y2: a + slope * (hi.stemX - lo.stemX),
      },
    ];
    if (hasSecondary && secondarySpan) {
      list.push({
        x1: secondarySpan.lo.stemX,
        y1: a + slope * (secondarySpan.lo.stemX - beamX0) + secondaryOffset,
        x2: secondarySpan.hi.stemX,
        y2: a + slope * (secondarySpan.hi.stemX - beamX0) + secondaryOffset,
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
      push = Math.max(push, spinePush(line));
    }
    if (push <= 0) break;
    anchor += direction * push;
  }

  const beamY = (x: number): number => anchor + slope * (x - beamX0);
  const [primary, secondary] = connectorsAt(anchor);

  return {
    notes: sorted,
    stems,
    direction,
    rawSlope,
    slope,
    minStemLength,
    thickness: t.beamThickness,
    primary,
    secondary: hasSecondary ? (secondary ?? null) : null,
    beamY,
  };
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
  const { notes: sorted, stems, primary, secondary, direction } = beam;

  const parts: string[] = ['  <g class="janko-beam-group">'];

  // Every stem grows from its notehead to the (clamped) beam centerline.
  for (const s of stems) {
    parts.push(`    <line class="janko-stem" x1="${f(s.stemX)}" y1="${f(s.stemStartY)}" x2="${f(s.stemX)}" y2="${f(beam.beamY(s.stemX))}" stroke="#111111" stroke-width="0.90"/>`);
  }

  // Primary beam: clamped straight connector across the stem tips.
  parts.push(
    `    <line class="janko-beam" x1="${f(primary.x1)}" y1="${f(primary.y1)}" x2="${f(primary.x2)}" y2="${f(primary.y2)}" stroke="#111111" stroke-width="${t.beamThickness.toFixed(2)}" stroke-linecap="butt"/>`
  );

  // Secondary beam: spans the consecutive 16th notes, closer to the noteheads.
  if (secondary) {
    parts.push(
      `    <line class="janko-beam-secondary" x1="${f(secondary.x1)}" y1="${f(secondary.y1)}" x2="${f(secondary.x2)}" y2="${f(secondary.y2)}" stroke="#111111" stroke-width="${t.beamThickness.toFixed(2)}" stroke-linecap="butt"/>`
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
 */
export function partitionBeamGroups(
  notes: JankoRhythmNote[],
  tokens?: Partial<JankoTokens> | null,
  middleCY?: number | null
): JankoBeamPartition {
  const t = resolveJankoTokens(tokens);

  // Fallback middleCY if not provided
  let refMiddleCY = middleCY ?? null;
  if (refMiddleCY === null && notes.length > 0) {
    const rhYs = notes.filter((n) => n.hand === 'RH').map((n) => n.y);
    const lhYs = notes.filter((n) => n.hand === 'LH').map((n) => n.y);
    if (rhYs.length > 0 && lhYs.length > 0) {
      refMiddleCY = (Math.max(...rhYs) + Math.min(...lhYs)) / 2;
    }
  }

  // Precompute which notes form mixed-hand clusters (same tick, different hands, close vertically)
  const mixedHandClusterNotes = new Set<string>();
  for (const a of notes) {
    for (const b of notes) {
      if (a.id !== b.id && a.hand !== b.hand && a.startTick === b.startTick) {
        if (Math.abs(a.y - b.y) <= 2 * t.rowHeight + 1e-3) {
          mixedHandClusterNotes.add(a.id);
          mixedHandClusterNotes.add(b.id);
        }
      }
    }
  }

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
    for (const n of sorted) {
      const prev = run[run.length - 1];
      if (prev) {
        const gap = n.startTick - prev.startTick > t.ticksPerBeat / 2;
        const straddled = (unbeamable.get(n.hand) ?? []).some(
          (b) => b.startTick > prev.startTick && b.startTick < n.startTick
        );

        // Break beam runs when an octave leap crosses the Middle C corridor into the opposite hand's register,
        // or when a note coincides temporally with notes in the other hand to form a mixed-hand cluster.
        let crossRegisterBreak = false;
        if (refMiddleCY !== null) {
          const prevDy = prev.y - refMiddleCY;
          const nDy = n.y - refMiddleCY;
          const crossesCorridor = prevDy * nDy < 0;
          const isOctaveLeap = Math.abs(prev.y - n.y) >= t.octaveStep - 1e-3;
          const isOppositeRegister = (n.hand === 'LH' && nDy < 0) || (n.hand === 'RH' && nDy > 0);
          const prevOppositeRegister = (prev.hand === 'LH' && prevDy < 0) || (prev.hand === 'RH' && prevDy > 0);

          if (crossesCorridor && isOctaveLeap && (isOppositeRegister || prevOppositeRegister)) {
            crossRegisterBreak = true;
          } else if (
            (isOppositeRegister && mixedHandClusterNotes.has(n.id)) ||
            (prevOppositeRegister && mixedHandClusterNotes.has(prev.id))
          ) {
            crossRegisterBreak = true;
          }
        }

        if (gap || straddled || crossRegisterBreak) flush();
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
