/**
 * Pluggable rhythm renderers for the Jánko Two-Row staff.
 *
 * Three engraving dialects are provided, selectable through
 * `JankoLayoutOptions.rhythmStyle`:
 *
 * - `angled-cuts`      — 35° slash cuts on the stem (default, Jánko dialect)
 * - `horizontal-ticks` — neutral horizontal duration ticks (unified lattice)
 * - `beamed`           — traditional connected beams inside each beat
 *
 * Duration mapping (48 ticks per quarter note):
 *   12 ticks = 16th (two cuts / two ticks), 24 = 8th (one cut / one tick),
 *   36 = dotted 8th (one cut + augmentation dot), 48 = quarter (bare stem).
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
  stemX: number;
  stemStartY: number;
  stemEndY: number;
  /** -1 for RH (up), +1 for LH (down). */
  direction: -1 | 1;
}

function stemDirection(hand: Hand): -1 | 1 {
  return hand === 'RH' ? -1 : 1;
}

/** Pure stem geometry (RH stems up, LH stems down). */
export function getStemGeometry(
  note: JankoRhythmNote,
  tokens?: Partial<JankoTokens> | null
): JankoStemGeometry {
  const t = resolveJankoTokens(tokens);
  const dir = stemDirection(note.hand);
  const stemX = dir === -1 ? note.x + t.noteheadRadius - 0.4 : note.x - t.noteheadRadius + 0.4;
  return {
    stemX,
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

/** Traditional connected beam over one beat-sized group of 8ths/16ths. */
export function renderBeamGroup(
  group: JankoRhythmNote[],
  tokens?: Partial<JankoTokens> | null
): string {
  const t = resolveJankoTokens(tokens);
  if (group.length === 0) return '';
  if (group.length === 1) {
    // A solitary short note keeps a single neutral tick instead of a beam.
    return renderHorizontalTicks(group[0], t);
  }

  const sorted = [...group].sort((a, b) => a.startTick - b.startTick);
  const stems = sorted.map((n) => getStemGeometry(n, t));
  const dir = stems[0].direction;
  const parts: string[] = ['  <g class="janko-beam-group">'];

  // Traditional engraving clamps the beam slope so wide leaps do not produce
  // runaway diagonal beams; every stem then grows to meet the beam line.
  const first = stems[0];
  const last = stems[stems.length - 1];
  const dx = last.stemX - first.stemX;
  const rawSlope = dx !== 0 ? (last.stemEndY - first.stemEndY) / dx : 0;
  const MAX_BEAM_SLOPE = 0.22;
  const slope = Math.max(-MAX_BEAM_SLOPE, Math.min(MAX_BEAM_SLOPE, rawSlope));
  const beamY = (x: number): number => first.stemEndY + slope * (x - first.stemX);

  for (const s of stems) {
    parts.push(`    <line class="janko-stem" x1="${f(s.stemX)}" y1="${f(s.stemStartY)}" x2="${f(s.stemX)}" y2="${f(beamY(s.stemX))}" stroke="#111111" stroke-width="0.90"/>`);
  }

  // Primary beam: clamped straight connector across the stem tips.
  parts.push(
    `    <line class="janko-beam" x1="${f(first.stemX)}" y1="${f(beamY(first.stemX))}" x2="${f(last.stemX)}" y2="${f(beamY(last.stemX))}" stroke="#111111" stroke-width="${t.beamThickness.toFixed(2)}" stroke-linecap="butt"/>`
  );

  // Secondary beam: spans the consecutive 16th notes, closer to the noteheads.
  const sixteenths = sorted.filter((n) => n.durationTicks <= 14);
  if (sixteenths.length >= 2) {
    const s0 = getStemGeometry(sixteenths[0], t);
    const s1 = getStemGeometry(sixteenths[sixteenths.length - 1], t);
    const offset = -dir * (t.beamThickness + 1.6);
    parts.push(
      `    <line class="janko-beam-secondary" x1="${f(s0.stemX)}" y1="${f(beamY(s0.stemX) + offset)}" x2="${f(s1.stemX)}" y2="${f(beamY(s1.stemX) + offset)}" stroke="#111111" stroke-width="${t.beamThickness.toFixed(2)}" stroke-linecap="butt"/>`
    );
  }

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
      // Standalone (unbeamable) notes fall back to a neutral single tick.
      return renderHorizontalTicks(note, tokens);
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
 * as ungrouped so the engine can render a neutral standalone rhythm.
 */
export function partitionBeamGroups(
  notes: JankoRhythmNote[],
  tokens?: Partial<JankoTokens> | null
): JankoBeamPartition {
  const t = resolveJankoTokens(tokens);
  const buckets = new Map<string, JankoRhythmNote[]>();
  for (const n of notes) {
    if (n.durationTicks > t.ticksPerBeat / 2) continue;
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
      if (prev && n.startTick - prev.startTick > t.ticksPerBeat / 2) flush();
      run.push(n);
    }
    flush();
  }
  for (const n of notes) {
    if (!grouped.has(n.id)) ungrouped.push(n);
  }
  return { groups, ungrouped };
}
