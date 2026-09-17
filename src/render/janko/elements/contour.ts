/**
 * Pitch-contour ink (the contour round)
 * =====================================
 *
 * The twin whole-tone rows destroy absolute pitch contour: within an octave,
 * stepwise motion reads flat (the two rows interleave in pitch), and at the
 * octave wrap it reads backwards (the row resets to the bottom while the
 * pitch rises). Measured on the Goldberg: only 51% of the right hand's
 * melodic motion reads true, 39% reads flat, 10% reads backwards.
 *
 * This module engraves the three contour paradigms as pure functions of
 * `(score, layout)` — no layout changes, no signature changes, gated behind
 * options that default off, so the golden master is bit-for-bit untouched:
 *
 * - **Thread** (`contourThread`): a hairline melodic thread woven *beneath*
 *   the noteheads at true pitch height (middle C the note sits exactly on
 *   the Middle C line, `contourThreadScale` pt per semitone). Straight attack-to-attack
 *   segments — angular, so the thread never overshoots an extreme the way a
 *   spline would, and never confuses with a future smooth phrase arc.
 * - **Ticks** (`contourTicks`): every melody notehead carries a tiny slash
 *   on its outer side showing where the line goes next — `/` up, `\` down,
 *   `–` same pitch, `°` breath (a beat or more of silence follows). Steps
 *   are short, leaps (a 3rd or more) are long. Odd rank rides above, even
 *   rank below — always into the inter-octave lane, away from the head's
 *   own equator rule. Ticks stand right of the head; when a barline or beat
 *   pulse blocks the right, the tick mirrors to the left (the mirror rule)
 *   — the *shape* still points forward, and the *side* redundantly encodes
 *   the row.
 * - **Strip** (`contourStrip`): a narrow absolute-pitch graph below each
 *   system, x-aligned with the music on one fixed global scale (solid = RH,
 *   dashed = LH), with faint octave gridlines and a C4 landmark.
 *
 * Shared doctrine:
 *
 * - The melody of a hand at one attack is its **top pitch** (the highest
 *   sounding note, never the highest-drawn digit — the zigzag can disagree).
 *   Cross-hand unisons ride in `layout.unisonVoices` at the survivor's
 *   column, so both hands' lines touch the one shared digit.
 * - The pen lifts (thread and strip break, ticks show `°`) across a silence
 *   of **a beat or more** (`ticksPerBeat`). Sounding durations never break
 *   the line: a legato quarter bridges its full value. Sub-beat breaths are
 *   articulation, not phrase breaks.
 * - Departure is global: the last attack of a system still shows where the
 *   line goes next (a preview of the next line's first step), while thread
 *   and strip segments never span a system break.
 */

import type {
  Hand,
  PitchCoordinate,
  QuantizedGridScore,
} from '../../../model/types';
import type { JankoSystemLayout } from '../engine';
import { CONTINUOUS_PITCH_ANCHOR_LIN } from '../geometry';
import {
  ResolvedJankoLayoutOptions,
  ResolvedJankoTokens,
  getClusterSpacingPreset,
} from '../types';
import { resolveBeatPulseXs } from './barlines';
import { URTEXT_SERIF, f } from './style';

/**
 * Linear pitch of the staff's Middle C line: middle C the note. Single
 * source in {@link CONTINUOUS_PITCH_ANCHOR_LIN} — the thread and the grid
 * agree absolutely by construction.
 */
export const CONTOUR_MIDDLE_C_LIN = CONTINUOUS_PITCH_ANCHOR_LIN;

/** Linear pitch of middle C the note (model octave 4, pitch class 0). */
export const CONTOUR_C4_LIN = 48;

/**
 * Step/leap boundary in semitones: a 2nd (1–2 st) is a step, a 3rd or more
 * (≥ 3 st) is a leap.
 */
export const CONTOUR_LEAP_SEMITONES = 3;

/** House ink, shared with every other engraved stroke. */
const CONTOUR_INK = '#111111';

/** Linear 12-TET pitch: C4 = 60. */
export function linearPitch(pitch: PitchCoordinate): number {
  return pitch.octave * 12 + pitch.pitchClass;
}

// ---------------------------------------------------------------------------
// Melody sequences
// ---------------------------------------------------------------------------

/** One hand's melody attack: top pitch per tick, layout-free. */
export interface ContourGlobalAttack {
  tick: number;
  lin: number;
  durationTicks: number;
}

/**
 * One hand's whole-score melody: the top pitch of every attack tick, in time
 * order. Departure, silence and pen lifts all read from this sequence, so a
 * system boundary never changes what a tick says.
 */
export function contourGlobalSequence(
  score: QuantizedGridScore,
  hand: Hand
): ContourGlobalAttack[] {
  const byTick = new Map<number, ContourGlobalAttack>();
  for (const n of score.notes) {
    if (n.hand !== hand) continue;
    const lin = linearPitch(n.pitch);
    const cur = byTick.get(n.startTick);
    if (!cur || lin > cur.lin) {
      byTick.set(n.startTick, { tick: n.startTick, lin, durationTicks: n.durationTicks });
    }
  }
  return [...byTick.values()].sort((a, b) => a.tick - b.tick);
}

/** Absolute pitch range of the whole score (the strip's fixed global scale). */
export function contourPieceRange(score: QuantizedGridScore): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const n of score.notes) {
    const lin = linearPitch(n.pitch);
    if (lin < min) min = lin;
    if (lin > max) max = lin;
  }
  return { min, max };
}

/**
 * Attack-tick span of one system. Mirrors `layoutJankoSystem`'s own note
 * selection exactly (including the anacrusis system's zero-based start).
 */
export function contourSystemTickSpan(
  systemIndex: number,
  measuresPerSystem: number,
  t: ResolvedJankoTokens
): { startTick: number; endTick: number } {
  const anacrusis = t.anacrusisTicks ?? 0;
  return {
    startTick:
      systemIndex === 0 ? 0 : anacrusis + systemIndex * measuresPerSystem * t.ticksPerMeasure,
    endTick: anacrusis + (systemIndex + 1) * measuresPerSystem * t.ticksPerMeasure,
  };
}

/** One hand's melody attack on one system, with its laid-out head position. */
export interface ContourAttack extends ContourGlobalAttack {
  hand: Hand;
  x: number;
  y: number;
  /** Pitch class: the tick side follows whole-tone rank (odd above, even below). */
  pitchClass: number;
  /** Engine-resolved augmentation-dot x (dotted values only, may be undefined). */
  dotX?: number;
}

/**
 * One hand's melody attacks on one system, in time order. Heads come from
 * both `layout.notes` and `layout.unisonVoices` (a merged mixed-duration
 * voice already rides at its survivor's solved column) — and a same-duration
 * unison loser, which the layout absorbs without a trace, is patched back
 * from the global sequence at its survivor's painted head: the hand still
 * sounds that digit, so its line still touches it.
 */
export function contourSystemAttacks(
  score: QuantizedGridScore,
  layout: JankoSystemLayout,
  hand: Hand,
  t: ResolvedJankoTokens
): ContourAttack[] {
  const byTick = new Map<number, ContourAttack>();
  const heads = [...layout.notes, ...layout.unisonVoices];
  const survivorAt = new Map<number, { x: number; y: number; dotX?: number }>();
  for (const p of layout.notes) {
    if (!survivorAt.has(p.note.startTick)) {
      survivorAt.set(p.note.startTick, { x: p.x, y: p.y, dotX: p.rhythm.dotX });
    }
  }
  for (const p of heads) {
    if (p.note.hand !== hand) continue;
    const lin = linearPitch(p.note.pitch);
    const cur = byTick.get(p.note.startTick);
    if (!cur || lin > cur.lin) {
      byTick.set(p.note.startTick, {
        tick: p.note.startTick,
        lin,
        durationTicks: p.note.durationTicks,
        hand,
        x: p.x,
        y: p.y,
        pitchClass: p.note.pitch.pitchClass,
        dotX: p.rhythm.dotX,
      });
    }
  }
  // Same-duration unison losers: the score sounds them, the layout hides
  // them — the survivor's head (same tick, same pitch, same row) stands in.
  const { startTick, endTick } = contourSystemTickSpan(
    layout.index,
    layout.geometry.measuresPerSystem,
    t
  );
  for (const g of contourGlobalSequence(score, hand)) {
    if (g.tick < startTick || g.tick >= endTick || byTick.has(g.tick)) continue;
    const s = survivorAt.get(g.tick);
    if (!s) continue;
    byTick.set(g.tick, {
      tick: g.tick,
      lin: g.lin,
      durationTicks: g.durationTicks,
      hand,
      x: s.x,
      y: s.y,
      pitchClass: g.lin % 12,
      dotX: s.dotX,
    });
  }
  return [...byTick.values()].sort((a, b) => a.tick - b.tick);
}

/**
 * Silence (ticks) between the end of one attack and the start of the next.
 * Non-positive when the next attack overlaps (legato chains never lift).
 */
export function contourSilence(cur: ContourGlobalAttack, next: ContourGlobalAttack): number {
  return next.tick - (cur.tick + cur.durationTicks);
}

/** True when a silence lifts the pen: a beat or more of rest. */
export function contourPenLifts(silenceTicks: number, t: ResolvedJankoTokens): boolean {
  return silenceTicks >= (t.ticksPerBeat ?? 48);
}

// ---------------------------------------------------------------------------
// Thread
// ---------------------------------------------------------------------------

/** Thread height of one linear pitch on one system. */
export function contourThreadY(middleCY: number, lin: number, scale: number): number {
  return middleCY - (lin - CONTOUR_MIDDLE_C_LIN) * scale;
}

/** One unbroken thread run: straight attack-to-attack segments. */
export interface ContourThreadRun {
  hand: Hand;
  ticks: number[];
  points: Array<{ x: number; y: number }>;
}

/**
 * Thread runs of one hand on one system. Vertices stand at exact attack
 * columns; the thread breaks wherever the pen lifts, and always at the
 * system break (runs never span systems).
 */
export function buildContourThreads(
  attacks: readonly ContourAttack[],
  middleCY: number,
  scale: number,
  hand: Hand,
  t: ResolvedJankoTokens
): ContourThreadRun[] {
  const runs: ContourThreadRun[] = [];
  let cur: ContourThreadRun | null = null;
  for (let i = 0; i < attacks.length; i++) {
    const a = attacks[i];
    const prev = i > 0 ? attacks[i - 1] : null;
    if (prev && contourPenLifts(contourSilence(prev, a), t)) cur = null;
    if (!cur) {
      cur = { hand, ticks: [], points: [] };
      runs.push(cur);
    }
    cur.ticks.push(a.tick);
    cur.points.push({ x: a.x, y: contourThreadY(middleCY, a.lin, scale) });
  }
  return runs;
}

// ---------------------------------------------------------------------------
// Ticks
// ---------------------------------------------------------------------------

/** Departure legend: where the line goes next from this attack. */
export type ContourTickKind =
  | 'up-step'
  | 'up-leap'
  | 'down-step'
  | 'down-leap'
  | 'same'
  | 'breathe';

/** Classify one departure: interval direction and weight, or a pen lift. */
export function contourTickKind(
  deltaSemitones: number,
  silenceTicks: number,
  t: ResolvedJankoTokens
): ContourTickKind {
  if (contourPenLifts(silenceTicks, t)) return 'breathe';
  if (deltaSemitones === 0) return 'same';
  if (deltaSemitones > 0) {
    return deltaSemitones < CONTOUR_LEAP_SEMITONES ? 'up-step' : 'up-leap';
  }
  return deltaSemitones > -CONTOUR_LEAP_SEMITONES ? 'down-step' : 'down-leap';
}

/** Slash length (pt) of each tick kind; the ring and dash are fixed glyphs. */
const TICK_SLASH: Record<ContourTickKind, number> = {
  'up-step': 3.5,
  'up-leap': 5.5,
  'down-step': 3.5,
  'down-leap': 5.5,
  same: 3.0,
  breathe: 3.2,
};

/**
 * Air (pt) between a tick's glyph and its own head. The 2.0pt stand-off keeps
 * the glyph clear even of a neighbour's *tall* knockout (a foreign stem
 * stretches a mask 1.0pt toward the tick band) with 0.5pt to spare.
 */
const TICK_HEAD_AIR = 2.0;

/** Air (pt) between a tick and a blocking barline / beat pulse. */
const TICK_BARLINE_AIR = 1.0;
const TICK_PULSE_AIR = 0.5;

/** One painted departure tick, with its audited ink box. */
export interface ContourTick {
  tick: number;
  hand: Hand;
  kind: ContourTickKind;
  /** True when the mirror rule placed the tick below-left instead of below-right. */
  mirrored: boolean;
  /** Slash endpoints (slash and dash kinds). */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Ring centre and radius (breathe kind; endpoints unused). */
  cx: number;
  cy: number;
  r: number;
  /** Audited ink box (page pt, stroke included via `pad`). */
  box: { x0: number; y0: number; x1: number; y1: number };
}

/**
 * Internal barline columns of one system (page pt). The opening edge carries
 * no barline (every intermediate system opens from the bare margin) and the
 * closing edge only on the final system — a tick's right side is only ever
 * blocked from *inside* the system, so the mirror rule only ever fires there.
 */
export function contourBarlineXs(
  layout: JankoSystemLayout,
  o: ResolvedJankoLayoutOptions,
  t: ResolvedJankoTokens
): number[] {
  const geo = layout.geometry;
  const anacrusis = t.anacrusisTicks ?? 0;
  const upbeat =
    layout.index === 0 && anacrusis > 0
      ? (anacrusis / t.ticksPerMeasure) * geo.measureWidth
      : 0;
  const xs: number[] = [];
  for (let k = 1; k < o.measuresPerSystem; k++) {
    xs.push(geo.staffLeft + upbeat + k * geo.measureWidth);
  }
  if (layout.isFinalSystem) xs.push(geo.staffRight);
  return xs;
}

/** Vertical blockers of one system: internal barlines plus beat pulses. */
export function contourTickBlockers(
  layout: JankoSystemLayout,
  o: ResolvedJankoLayoutOptions,
  t: ResolvedJankoTokens
): Array<{ x: number; air: number }> {
  const blockers = contourBarlineXs(layout, o, t).map((x) => ({ x, air: TICK_BARLINE_AIR }));
  for (const x of resolveBeatPulseXs(layout.geometry, layout.index, o, t, layout.columns)) {
    blockers.push({ x, air: TICK_PULSE_AIR });
  }
  return blockers.sort((a, b) => a.x - b.x);
}

/**
 * Departure ticks of one hand on one system. Departure reads from the
 * *global* sequence, so the last attack of a system previews the next line's
 * first step; only the score's final attack of the hand carries no tick.
 */
export function buildContourTicks(
  attacks: readonly ContourAttack[],
  global: readonly ContourGlobalAttack[],
  layout: JankoSystemLayout,
  o: ResolvedJankoLayoutOptions,
  t: ResolvedJankoTokens
): ContourTick[] {
  const preset = getClusterSpacingPreset(o.clusterSpacing);
  const blockers = contourTickBlockers(layout, o, t);
  const globalAt = new Map(global.map((g, i) => [g.tick, i]));
  const out: ContourTick[] = [];
  for (const a of attacks) {
    const gi = globalAt.get(a.tick);
    const next = gi === undefined ? undefined : global[gi + 1];
    if (!next) continue;
    const kind = contourTickKind(next.lin - a.lin, contourSilence(a, next), t);
    out.push(placeContourTick(a, kind, preset.wx, preset.hy, blockers, t));
  }
  return out;
}

/**
 * Place one tick on its head's outer side — odd rank above, even rank below —
 * always into the inter-octave lane, away from the head's own equator rule
 * (a below-side tick under an upper-row head would plant itself on that
 * rule). The tick rides at exactly `TICK_HEAD_AIR` from the mask — unless a
 * barline or pulse blocks the rightward span, in which case the mirror rule
 * places it on the left at the same air. The glyph *shape* always points
 * forward (`/` rises to the right), whichever side it stands on; the *side*
 * redundantly encodes the row, reinforcing row reading.
 *
 * A dotted head's augmentation dot owns the upper-right corner, so an
 * above-side tick starts right of the dot lane instead of under it.
 */
export function placeContourTick(
  attack: ContourAttack,
  kind: ContourTickKind,
  maskWx: number,
  maskHy: number,
  blockers: ReadonlyArray<{ x: number; air: number }>,
  t: ResolvedJankoTokens
): ContourTick {
  const len = TICK_SLASH[kind];
  const diag = kind === 'same' || kind === 'breathe' ? 0 : len / Math.SQRT2;
  const width = kind === 'same' || kind === 'breathe' ? len : diag;
  const above = attack.pitchClass % 2 === 1;
  // Outward = away from the head: up for odd rank, down for even rank.
  const dir = above ? -1 : 1;
  const edge = attack.y + dir * (maskHy + TICK_HEAD_AIR);
  let rightX0 = attack.x + maskWx + TICK_HEAD_AIR;
  const dotted = attack.durationTicks > 26 && attack.durationTicks <= 38;
  if (above && dotted && attack.dotX !== undefined) {
    rightX0 = Math.max(rightX0, attack.dotX + t.augmentationDotRadius + 1.0);
  }
  const rightEnd = rightX0 + width;
  // A blocker inside the rightward span (with its air) mirrors the tick.
  const blocked = blockers.some((b) => b.x > rightX0 && b.x < rightEnd + b.air);
  const mirrored = blocked;
  const x0 = mirrored ? attack.x - maskWx - TICK_HEAD_AIR - width : rightX0;
  const base: ContourTick = {
    tick: attack.tick,
    hand: attack.hand,
    kind,
    mirrored,
    x1: 0,
    y1: 0,
    x2: 0,
    y2: 0,
    cx: 0,
    cy: 0,
    r: 0,
    box: { x0, y0: edge, x1: x0 + width, y1: edge },
  };
  // Ink box pad: stroke + round-cap overhang, covered faithfully (crop air is
  // added explicitly at the bounds, not here). The box is the audited claim —
  // the linter requires it clear every mask at floor 0.
  const pad = 0.5;
  const outer = (d: number): number => edge + dir * d;
  if (kind === 'breathe') {
    const r = 1.3;
    base.cx = x0 + width / 2;
    base.cy = outer(2.0);
    base.r = r;
    base.box = { x0: base.cx - r - pad, y0: base.cy - r - pad, x1: base.cx + r + pad, y1: base.cy + r + pad };
    return base;
  }
  if (kind === 'same') {
    const y = outer(1.2);
    base.x1 = x0;
    base.y1 = y;
    base.x2 = x0 + width;
    base.y2 = y;
    base.box = { x0: x0 - pad, y0: y - pad, x1: x0 + width + pad, y1: y + pad };
    return base;
  }
  const up = kind === 'up-step' || kind === 'up-leap';
  base.x1 = x0;
  base.y1 = up ? outer(diag) : edge;
  base.x2 = x0 + diag;
  base.y2 = up ? edge : outer(diag);
  const y0 = Math.min(edge, outer(diag));
  const y1 = Math.max(edge, outer(diag));
  base.box = { x0: x0 - pad, y0: y0 - pad, x1: x0 + diag + pad, y1: y1 + pad };
  return base;
}

// ---------------------------------------------------------------------------
// Strip
// ---------------------------------------------------------------------------

/**
 * Lowest painted ink of one system (page pt): heads, analytic stems, beams,
 * ledger stacks and clasp brackets. Rests hang from in-staff phrase rows and
 * never leave the staff, so they cannot move this bound.
 */
export function contourSystemInkBottom(
  layout: JankoSystemLayout,
  t: ResolvedJankoTokens
): number {
  let bottom = layout.geometry.staffBotY;
  const r = t.noteheadRadius;
  for (const p of layout.notes) {
    const dir = p.note.hand === 'RH' ? -1 : 1;
    if (p.y + r > bottom) bottom = p.y + r;
    const tip = p.y + dir * t.stemLength;
    if (tip > bottom) bottom = tip;
    for (const ledgerY of p.coord.ledgerYs) {
      const edge = layout.geometry.middleCY + ledgerY + r;
      if (edge > bottom) bottom = edge;
    }
  }
  for (const beam of layout.beams) {
    for (const c of [beam.primary, beam.secondary]) {
      if (!c) continue;
      if (c.y1 > bottom) bottom = c.y1;
      if (c.y2 > bottom) bottom = c.y2;
    }
  }
  for (const clasp of layout.clasps) {
    if (clasp.botY > bottom) bottom = clasp.botY;
  }
  return bottom;
}

/** One hand's strip curve: pen-lifted runs of absolute-pitch vertices. */
export interface ContourStripCurve {
  hand: Hand;
  runs: Array<Array<{ x: number; y: number }>>;
}

/** The absolute-pitch graph below one system. */
export interface ContourStrip {
  /** Strip top (page pt): lowest ink plus air, never above the staff. */
  top: number;
  height: number;
  /** Fixed global scale (pt per semitone) — identical on every system. */
  k: number;
  rangeMin: number;
  rangeMax: number;
  /** C-gridlines (linear pitches) inside the range. */
  gridCs: number[];
  curves: ContourStripCurve[];
}

/**
 * Build the strip of one system, or null when neither hand attacks on it.
 * The pitch→y mapping is fixed by the *score's* range, so C5 sits at the
 * same height above every system's strip top; only the strip's offset below
 * the staff adapts (to the system's own lowest ink).
 */
export function buildContourStrip(
  score: QuantizedGridScore,
  layout: JankoSystemLayout,
  t: ResolvedJankoTokens
): ContourStrip | null {
  const hands: Hand[] = ['RH', 'LH'];
  const attacks = new Map<Hand, ContourAttack[]>();
  for (const hand of hands) {
    const seq = contourSystemAttacks(score, layout, hand, t);
    if (seq.length > 0) attacks.set(hand, seq);
  }
  if (attacks.size === 0) return null;
  const { min, max } = contourPieceRange(score);
  const height = t.contourStripHeight;
  const span = Math.max(1, max - min);
  const k = height / span;
  const air = t.contourStripAir;
  const top = Math.max(
    layout.geometry.staffBotY + air,
    contourSystemInkBottom(layout, t) + air
  );
  const y = (lin: number): number => contourStripY(top, height, min, max, lin);
  const gridCs: number[] = [];
  for (let c = Math.ceil(min / 12) * 12; c <= max; c += 12) gridCs.push(c);
  const curves: ContourStripCurve[] = [];
  for (const [hand, seq] of attacks) {
    const runs: Array<Array<{ x: number; y: number }>> = [];
    let cur: Array<{ x: number; y: number }> | null = null;
    for (let i = 0; i < seq.length; i++) {
      if (i > 0 && contourPenLifts(contourSilence(seq[i - 1], seq[i]), t)) cur = null;
      if (!cur) {
        cur = [];
        runs.push(cur);
      }
      cur.push({ x: seq[i].x, y: y(seq[i].lin) });
    }
    curves.push({ hand, runs });
  }
  return { top, height, k, rangeMin: min, rangeMax: max, gridCs, curves };
}

/** Strip height of one linear pitch (the inverse of the fixed scale). */
export function contourStripY(
  top: number,
  height: number,
  rangeMin: number,
  rangeMax: number,
  lin: number
): number {
  const span = Math.max(1, rangeMax - rangeMin);
  return top + height - ((lin - rangeMin) / span) * height;
}

// ---------------------------------------------------------------------------
// Renderers
// ---------------------------------------------------------------------------

function contourLine(
  cls: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  stroke: string,
  width: number,
  extra = ''
): string {
  return (
    `<line class="${cls}" x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" ` +
    `stroke="${stroke}" stroke-width="${f(width)}" stroke-linecap="round"${extra}/>`
  );
}

function contourPath(
  cls: string,
  points: ReadonlyArray<{ x: number; y: number }>,
  stroke: string,
  width: number,
  extra = ''
): string {
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${f(p.x)} ${f(p.y)}`).join(' ');
  return (
    `<path class="${cls}" d="${d}" fill="none" stroke="${stroke}" ` +
    `stroke-width="${f(width)}" stroke-linejoin="round" stroke-linecap="round"${extra}/>`
  );
}

/**
 * Paint one system's thread runs (one path per unbroken run; lone attacks
 * carry no segment and paint nothing).
 */
export function renderContourThreads(
  runs: readonly ContourThreadRun[],
  t: ResolvedJankoTokens
): string {
  const paths = runs
    .filter((run) => run.points.length >= 2)
    .map((run) =>
      contourPath(
        `janko-contour-thread janko-contour-thread-${run.hand.toLowerCase()}`,
        run.points,
        CONTOUR_INK,
        t.contourThreadStroke
      )
    );
  if (paths.length === 0) return '';
  return ['    <g class="janko-contour-thread">', ...paths.map((p) => `      ${p}`), '    </g>'].join(
    '\n'
  );
}

/** Paint one system's departure ticks (slashes as lines, breaths as rings). */
export function renderContourTicks(
  ticks: readonly ContourTick[],
  t: ResolvedJankoTokens
): string {
  if (ticks.length === 0) return '';
  const els = ticks.map((tick) =>
    tick.kind === 'breathe'
      ? `      <circle class="janko-contour-tick janko-contour-tick-breathe" cx="${f(tick.cx)}" cy="${f(
          tick.cy
        )}" r="${f(tick.r)}" fill="none" stroke="${CONTOUR_INK}" stroke-width="0.60"/>`
      : `      ${contourLine(
          `janko-contour-tick janko-contour-tick-${tick.kind}`,
          tick.x1,
          tick.y1,
          tick.x2,
          tick.y2,
          CONTOUR_INK,
          t.contourTickStroke
        )}`
  );
  return ['    <g class="janko-contour-ticks">', ...els, '    </g>'].join('\n');
}

/** Paint one system's absolute-pitch strip below the staff. */
export function renderContourStrip(strip: ContourStrip, layout: JankoSystemLayout): string {
  const geo = layout.geometry;
  const els: string[] = [
    `    ${contourLine('janko-contour-strip-frame', geo.staffLeft, strip.top, geo.staffRight, strip.top, CONTOUR_INK, 0.4)}`,
    `    ${contourLine('janko-contour-strip-frame', geo.staffLeft, strip.top + strip.height, geo.staffRight, strip.top + strip.height, CONTOUR_INK, 0.4)}`,
  ];
  for (const c of strip.gridCs) {
    const y = contourStripY(strip.top, strip.height, strip.rangeMin, strip.rangeMax, c);
    // A C on the data edge would double the frame: the frame already says it.
    if (Math.min(Math.abs(y - strip.top), Math.abs(y - strip.top - strip.height)) < 0.5) continue;
    const isC4 = c === CONTOUR_C4_LIN;
    els.push(
      `    ${contourLine(
        `janko-contour-strip-grid${isC4 ? ' janko-contour-strip-c4' : ''}`,
        geo.staffLeft,
        y,
        geo.staffRight,
        y,
        isC4 ? '#555555' : '#999999',
        isC4 ? 0.5 : 0.25
      )}`
    );
  }
  if (strip.gridCs.includes(CONTOUR_C4_LIN)) {
    const y = contourStripY(strip.top, strip.height, strip.rangeMin, strip.rangeMax, CONTOUR_C4_LIN);
    els.push(
      `    <text class="janko-contour-c4" x="${f(geo.staffLeft - 4)}" y="${f(y + 1.9)}" ` +
        `text-anchor="end" font-family='${URTEXT_SERIF}' font-style="italic" font-size="5.5" fill="#555555">C4</text>`
    );
  }
  for (const curve of strip.curves) {
    const dashed = curve.hand === 'LH';
    for (const run of curve.runs) {
      if (run.length < 2) continue;
      els.push(
        `    ${contourPath(
          `janko-contour-strip-curve janko-contour-strip-${curve.hand.toLowerCase()}`,
          run,
          CONTOUR_INK,
          dashed ? 0.55 : 0.7,
          dashed ? ' stroke-dasharray="3 1.8"' : ''
        )}`
      );
    }
  }
  return ['  <g class="janko-contour-strip">', ...els, '  </g>'].join('\n');
}

// ---------------------------------------------------------------------------
// System orchestrator
// ---------------------------------------------------------------------------

/** All contour ink of one system, keyed by paint layer ('' when off). */
export interface SystemContourInk {
  /** Thread group: painted first in the notes layer, beneath everything. */
  thread: string;
  /** Tick group: painted last in the notes layer, above the heads. */
  ticks: string;
  /** Strip group: painted after the notes layer, below the staff. */
  strip: string;
}

/** Hands the thread voices under one option value. */
export function contourThreadHands(o: ResolvedJankoLayoutOptions): Hand[] {
  if (o.contourThread === 'none') return [];
  return o.contourThread === 'rh' ? ['RH'] : ['RH', 'LH'];
}

/** Build every contour layer of one system (pure function of score+layout). */
export function buildSystemContour(
  score: QuantizedGridScore,
  layout: JankoSystemLayout,
  o: ResolvedJankoLayoutOptions,
  t: ResolvedJankoTokens
): SystemContourInk {
  const ink: SystemContourInk = { thread: '', ticks: '', strip: '' };
  const hands = contourThreadHands(o);
  if (hands.length > 0) {
    const runs: ContourThreadRun[] = [];
    for (const hand of hands) {
      runs.push(
        ...buildContourThreads(
          contourSystemAttacks(score, layout, hand, t),
          layout.geometry.middleCY,
          t.contourThreadScale,
          hand,
          t
        )
      );
    }
    ink.thread = renderContourThreads(runs, t);
  }
  if (o.contourTicks) {
    const ticks: ContourTick[] = [];
    for (const hand of ['RH', 'LH'] as const) {
      ticks.push(
        ...buildContourTicks(
          contourSystemAttacks(score, layout, hand, t),
          contourGlobalSequence(score, hand),
          layout,
          o,
          t
        )
      );
    }
    ink.ticks = renderContourTicks(ticks, t);
  }
  if (o.contourStrip) {
    const strip = buildContourStrip(score, layout, t);
    if (strip) ink.strip = renderContourStrip(strip, layout);
  }
  return ink;
}

/**
 * Painted vertical extent of one system's contour ink (null when the options
 * paint nothing). The single source for crop extents: the renderer and the
 * crop box measure the same geometry.
 */
export function contourSystemInkBounds(
  score: QuantizedGridScore,
  layout: JankoSystemLayout,
  o: ResolvedJankoLayoutOptions,
  t: ResolvedJankoTokens
): { top: number; bottom: number } | null {
  const hands = contourThreadHands(o);
  if (hands.length === 0 && !o.contourTicks && !o.contourStrip) return null;
  let top = Infinity;
  let bottom = -Infinity;
  const eat = (y0: number, y1: number): void => {
    if (y0 < top) top = y0;
    if (y1 > bottom) bottom = y1;
  };
  for (const hand of hands) {
    for (const run of buildContourThreads(
      contourSystemAttacks(score, layout, hand, t),
      layout.geometry.middleCY,
      t.contourThreadScale,
      hand,
      t
    )) {
      for (const p of run.points) eat(p.y - 2.5, p.y + 2.5);
    }
  }
  if (o.contourTicks) {
    for (const hand of ['RH', 'LH'] as const) {
      for (const tick of buildContourTicks(
        contourSystemAttacks(score, layout, hand, t),
        contourGlobalSequence(score, hand),
        layout,
        o,
        t
      )) {
        eat(tick.box.y0 - 1.5, tick.box.y1 + 1.5);
      }
    }
  }
  if (o.contourStrip) {
    const strip = buildContourStrip(score, layout, t);
    if (strip) eat(strip.top - 2.0, strip.top + strip.height + 2.0);
  }
  if (!Number.isFinite(top) || !Number.isFinite(bottom)) return null;
  return { top, bottom };
}
