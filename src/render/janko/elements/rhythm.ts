/**
 * Pluggable rhythm renderers for the Jánko Two-Row staff.
 *
 * Three engraving dialects are provided, selectable through
 * `JankoLayoutOptions.rhythmStyle`:
 *
 * - `angled-cuts`      — 35° slash cuts on the stem (default, Jánko dialect)
 * - `horizontal-ticks` — neutral horizontal duration ticks (unified lattice)
 * - `beamed`           — traditional connected beams inside each beat, with
 *                        standard flags for solitary / unbeamed notes
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
import { JankoRhythmStyle, JankoTokens, ResolvedJankoTokens, resolveJankoTokens } from '../types';
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

/**
 * Pure stem geometry (RH stems up, LH stems down).
 *
 * The stem is engraved on the notehead's vertical centreline (`stemX = note.x`)
 * rather than on the round-notehead perimeter: duration indicators then begin
 * exactly on the note column for both hands, instead of staggering left of the
 * duodecimal digit for the LH and right of it for the RH.
 */
export function getStemGeometry(
  note: JankoRhythmNote,
  tokens?: Partial<JankoTokens> | null
): JankoStemGeometry {
  const t = resolveJankoTokens(tokens);
  const dir = stemDirection(note.hand);
  return {
    stemX: note.x,
    stemStartY: note.y + dir * 1.5,
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

/**
 * One standard musical flag hook latched to a stem tip.
 *
 * The stroke starts exactly on the stem (`x = stemX`), sweeps to the right and
 * curls back toward the stem as it drops, so **every sample of the hook stays
 * strictly right of the stem** (`x >= stemX`). Unlike a perpendicular duration
 * tick, a flag can therefore never draw a cross/dagger over its own notehead.
 */
function renderFlagHook(
  stemX: number,
  tipY: number,
  direction: -1 | 1,
  index: number,
  t: ResolvedJankoTokens
): string {
  const w = t.flagWidth;
  const h = t.flagHeight;
  // Up-stems (direction -1) hang their flags downward (+y); down-stems mirror.
  const sign = -direction;
  const y = (k: number): number => tipY + sign * k * h;
  const d =
    `M ${f(stemX)} ${f(tipY)} ` +
    `C ${f(stemX + 0.55 * w)} ${f(y(0.12))} ${f(stemX + w)} ${f(y(0.62))} ` +
    `${f(stemX + 0.45 * w)} ${f(y(1))}`;
  return (
    `    <path class="janko-flag" data-stem-x="${f(stemX)}" data-flag-index="${index}" ` +
    `d="${d}" fill="none" stroke="#111111" stroke-width="1.05" stroke-linecap="round"/>`
  );
}

/**
 * Solitary / unbeamed short note: bare stem plus standard musical flags
 * (two for 16ths and shorter, one for 8ths) and the augmentation dot for dotted
 * values. Nothing crosses the stem — the flag grammar replaces the neutral
 * perpendicular tick used by the `horizontal-ticks` lattice dialect.
 */
export function renderFlags(
  note: JankoRhythmNote,
  tokens?: Partial<JankoTokens> | null
): string {
  const t = resolveJankoTokens(tokens);
  const s = getStemGeometry(note, t);
  const parts: string[] = [renderStem(note, t)];

  const dur = note.durationTicks;
  if (dur <= 14) {
    parts.push(renderFlagHook(s.stemX, s.stemEndY, s.direction, 1, t));
    parts.push(
      renderFlagHook(s.stemX, s.stemEndY - s.direction * t.flagSpacing, s.direction, 2, t)
    );
  } else if (dur <= 26) {
    parts.push(renderFlagHook(s.stemX, s.stemEndY, s.direction, 1, t));
  } else if (dur <= 38) {
    parts.push(renderFlagHook(s.stemX, s.stemEndY, s.direction, 1, t));
    parts.push(renderAugmentationDot(note, t));
  }
  return parts.join('\n');
}

/**
 * Pure geometry of one beamed group.
 *
 * The primary connector is clamped to ±`tokens.maxBeamSlope` so wide leaps do
 * not produce runaway diagonals. The clamped line is then *elevated* (RH
 * up-stems) or *depressed* (LH down-stems) until the extreme notehead of the
 * group — in the stem direction — keeps at least a full stem length, so no
 * beam can ever cut through an intermediate notehead of an ascending or
 * descending run. Renderers and the visual linter share this function, so the
 * geometry can never drift between the two.
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

/**
 * Resolve the beam geometry of a group. Returns null for groups shorter than
 * two notes (a solitary short note is engraved with standard flags instead).
 */
export function computeBeamGroupGeometry(
  group: JankoRhythmNote[],
  tokens?: Partial<JankoTokens> | null
): JankoBeamGroupGeometry | null {
  const t = resolveJankoTokens(tokens);
  if (group.length < 2) return null;

  const sorted = [...group].sort((a, b) => a.startTick - b.startTick);
  const stems = sorted.map((n) => getStemGeometry(n, t));
  const first = stems[0];
  const last = stems[stems.length - 1];
  const direction = first.direction;
  const dx = last.stemX - first.stemX;
  const rawSlope = dx !== 0 ? (last.stemEndY - first.stemEndY) / dx : 0;
  const limit = t.maxBeamSlope;
  const slope = Math.max(-limit, Math.min(limit, rawSlope));

  const sixteenths = sorted.filter((n) => n.durationTicks <= 14);
  const secondaryOffset = -direction * (t.beamThickness + SECONDARY_BEAM_GAP);
  const hasSecondary = sixteenths.length >= 2;

  // Minimum stem length: the canonical stem, but never less than the notehead
  // disc plus the required air — counting the 16th secondary beam, which sits
  // `beamThickness + gap` closer to the heads than the primary connector.
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
    const limitY = sorted[i].y + direction * minStemLength - slope * (stems[i].stemX - first.stemX);
    anchor = direction === -1 ? Math.min(anchor, limitY) : Math.max(anchor, limitY);
  }
  const beamY = (x: number): number => anchor + slope * (x - first.stemX);

  let secondary: JankoBeamConnector | null = null;
  if (hasSecondary) {
    const s0 = getStemGeometry(sixteenths[0], t);
    const s1 = getStemGeometry(sixteenths[sixteenths.length - 1], t);
    secondary = {
      x1: s0.stemX,
      y1: beamY(s0.stemX) + secondaryOffset,
      x2: s1.stemX,
      y2: beamY(s1.stemX) + secondaryOffset,
    };
  }

  return {
    notes: sorted,
    stems,
    direction,
    rawSlope,
    slope,
    minStemLength,
    thickness: t.beamThickness,
    primary: {
      x1: first.stemX,
      y1: beamY(first.stemX),
      x2: last.stemX,
      y2: beamY(last.stemX),
    },
    secondary,
    beamY,
  };
}

/** Traditional connected beam over one beat-sized group of 8ths/16ths. */
export function renderBeamGroup(
  group: JankoRhythmNote[],
  tokens?: Partial<JankoTokens> | null
): string {
  const t = resolveJankoTokens(tokens);
  if (group.length === 0) return '';
  if (group.length === 1) {
    // A solitary short note is flagged, never crossbarred.
    return renderFlags(group[0], t);
  }

  const beam = computeBeamGroupGeometry(group, t);
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
  tokens?: Partial<JankoTokens> | null
): string {
  switch (style) {
    case 'horizontal-ticks':
      return renderHorizontalTicks(note, tokens);
    case 'beamed':
      // Standalone (unbeamable) notes carry standard flags, not crossbars.
      return renderFlags(note, tokens);
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
  tokens?: Partial<JankoTokens> | null
): JankoBeamPartition {
  const t = resolveJankoTokens(tokens);
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
        if (gap || straddled) flush();
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
