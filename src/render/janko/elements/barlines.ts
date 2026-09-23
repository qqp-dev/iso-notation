/**
 * Barlines: internal measure barlines and system boundaries.
 *
 * Round 12 unifies the vertical grid: every measure barline and every dashed
 * beat pulse runs **continuously** from the top of Octave 5 (`rhTop ≈ −57.0`)
 * down to the bottom of Octave 2 (`lhBot ≈ +57.0`), straight across the Middle
 * C corridor. The Round 7–11 split hand segments (with their arbitrary 24pt
 * gap) are gone: the grid is one absolute coordinate system, exactly like the
 * horizontal octave lattice it crosses. Only the score's closing boundary still
 * offers the `'split-corridor'` opt-out.
 *
 * The `gridWritingPolicy` decides how that grid meets the music:
 * `'overlaid-beat-grid'` (default) keeps the barlines' protected air while the
 * beat pulses pass behind the noteheads; `'strict-protected-grid'` paints every
 * grid line through a dedicated white **air channel** so the grid is never
 * written over; `'unified-transparent-grid'` lets the music use the full
 * measure width and knocks the grid out with the circular glyph masks.
 */

import {
  JankoLayoutOptions,
  JankoSystemGeometry,
  JankoTokens,
  ResolvedJankoLayoutOptions,
  ResolvedJankoTokens,
  channelsGridInk,
  getGridNoteInset,
  resolveJankoOptions,
  resolveJankoTokens,
} from '../types';
import { continuousPitchY, getTickX } from '../geometry';
import { getBarStaffSegments } from './staff';
import { f } from './style';

/** One hand's barline segment at x, from its top rule to its bottom rule. */
export function renderStaffBarline(
  x: number,
  yTop: number,
  yBot: number,
  strokeWidth: number = 0.60,
  stroke: string = '#111111'
): string {
  return `    <line class="janko-barline" x1="${f(x)}" y1="${f(yTop)}" x2="${f(x)}" y2="${f(yBot)}" stroke="${stroke}" stroke-width="${strokeWidth.toFixed(2)}"/>`;
}

/**
 * Absolute y of the continuous grid's top tip.
 * Symmetric-6 golden span: stands off the outer-row level by exactly `t.measureInset` (6.0pt).
 * Top tip = outerTopY + 6.0 (fixed-3: lin 69.6; fixed-4: 77.5 + 6.0).
 */
export function gridTopY(
  geo: JankoSystemGeometry,
  options?: Partial<JankoLayoutOptions> | null,
  tokens?: Partial<JankoTokens> | null
): number {
  const o = resolveJankoOptions(options);
  const t = resolveJankoTokens(tokens);
  if (o.core !== 'fixed-3' && o.core !== 'fixed-4') {
    return geo.equatorY('RH', 5) - 12;
  }
  const isFixed3 = o.core === 'fixed-3';
  const topExtLin = isFixed3 ? 72 : 77.5;
  const outerTopY = geo.middleCY + continuousPitchY(topExtLin, t.semitoneScale);
  return outerTopY + t.measureInset;
}

/**
 * Absolute y of the continuous grid's bottom tip.
 * Symmetric-6 golden span: stands off the outer-row level by exactly `t.measureInset` (6.0pt).
 * Bottom tip = outerBotY - 6.0 (fixed-3: lin 26.4; fixed-4: 17.5 - 6.0).
 */
export function gridBotY(
  geo: JankoSystemGeometry,
  options?: Partial<JankoLayoutOptions> | null,
  tokens?: Partial<JankoTokens> | null
): number {
  const o = resolveJankoOptions(options);
  const t = resolveJankoTokens(tokens);
  if (o.core !== 'fixed-3' && o.core !== 'fixed-4') {
    return geo.equatorY('LH', 2) + 12;
  }
  const isFixed3 = o.core === 'fixed-3';
  const botExtLin = isFixed3 ? 24 : 17.5;
  const outerBotY = geo.middleCY + continuousPitchY(botExtLin, t.semitoneScale);
  return outerBotY - t.measureInset;
}

/**
 * Round 12 dedicated **air channel**: the white casing a grid line paints
 * beneath itself under `'strict-protected-grid'`, so a stem or beam crossing the
 * grid is cut by clean air instead of overwriting it. The circular notehead
 * masks are painted after the grid and still knock it out — the glyph always
 * wins inside its own disc.
 */
export const GRID_CHANNEL_BARLINE = 2.6;
export const GRID_CHANNEL_BEAT = 3.2;

function gridChannel(
  x: number,
  yTop: number,
  yBot: number,
  width: number,
  cls: string,
  dash?: string
): string {
  const dashAttr = dash ? ` stroke-dasharray="${dash}"` : '';
  return `    <line class="${cls}" x1="${f(x)}" y1="${f(yTop)}" x2="${f(x)}" y2="${f(yBot)}" stroke="#FFFFFF" stroke-width="${width.toFixed(2)}"${dashAttr}/>`;
}

/**
 * All internal measure barlines of one system, plus the closing system
 * boundary. Measure numbers are the caller's responsibility (see engine).
 *
 * Round 7 lightens the measure barlines to 0.60pt and opens the intermediate
 * systems at their right edge: only the **final measure of the final system**
 * (`isFinalScoreMeasure`) draws the closing vertical barline. Every other
 * system simply stops in open negative space, matching its open left start.
 *
 * Round 12 makes every painted internal barline continuous across the Middle C
 * corridor (see the module header). Round 10's `finalBarlineStyle` still
 * selects the closing boundary: `'unified'` (the default) is the same
 * continuous rule, `'split-corridor'` restores the two hand halves.
 */
export interface VerticalGridStroke {
  x: number;
  y1: number;
  y2: number;
  width: number;
  stroke: string;
  cls: 'janko-grid-channel' | 'janko-barline' | 'janko-beat-line';
  dash?: string;
  /** The white air channel erases rhythm ink; it is not physical ink. */
  erase: boolean;
  tick?: number;
}

/** Authoritative placed vertical strokes, in their exact painter order. */
export function barlineStrokes(
  geo: JankoSystemGeometry,
  options?: Partial<JankoLayoutOptions> | null,
  tokens?: Partial<JankoTokens> | null,
  isFinalScoreMeasure: boolean = true
): VerticalGridStroke[] {
  const o = resolveJankoOptions(options);
  const t = resolveJankoTokens(tokens);
  const out: VerticalGridStroke[] = [];
  const channelled = channelsGridInk(o.gridWritingPolicy);

  const rhTop = gridTopY(geo, o, t);
  const rhBot = geo.equatorY('RH', 4) + 12;
  const lhTop = geo.equatorY('LH', 3) - 12;
  const lhBot = gridBotY(geo, o, t);

  const isFixed3 = o.core === 'fixed-3';
  const topExtLin = isFixed3 ? 72 : 77.5;
  const botExtLin = isFixed3 ? 24 : 17.5;
  const outerTopY = geo.middleCY + continuousPitchY(topExtLin, t.semitoneScale);
  const outerBotY = geo.middleCY + continuousPitchY(botExtLin, t.semitoneScale);
  const conjoin = o.extensionJunction === 'conjoin' && (o.core === 'fixed-3' || o.core === 'fixed-4');

  const measureTop = conjoin ? outerTopY : rhTop;
  const measureBot = conjoin ? outerBotY : lhBot;

  // Finale exception (last measure of the score only): extension rows drawn there run
  // flush INTO the final barline (no gap), and the final vertical extends to exactly meet
  // the outermost drawn extension row(s) — no overshoot. If the last bar draws no
  // extension rows, the final barline height is unchanged.
  // Under conjoin (Card A), all barlines including the final barline span outerTopY..outerBotY.
  let finalTop = measureTop;
  let finalBot = measureBot;
  if (!conjoin && isFinalScoreMeasure && (o.core === 'fixed-3' || o.core === 'fixed-4')) {
    const finalMIdx =
      geo.index === 0 && (t.anacrusisTicks ?? 0) > 0
        ? o.measuresPerSystem
        : o.measuresPerSystem - 1;
    const segs = getBarStaffSegments(geo, finalMIdx);
    if (segs.some((s) => s.lin === topExtLin)) {
      finalTop = outerTopY;
    }
    if (segs.some((s) => s.lin === botExtLin)) {
      finalBot = outerBotY;
    }
  }

  /** Push one internal measure barline: continuous across the corridor. */
  const pushMeasure = (x: number, strokeWidth: number = 0.60): void => {
    if (channelled) out.push({ x, y1: measureTop, y2: measureBot, width: GRID_CHANNEL_BARLINE, stroke: '#FFFFFF', cls: 'janko-grid-channel', erase: true });
    out.push({ x, y1: measureTop, y2: measureBot, width: strokeWidth, stroke: '#111111', cls: 'janko-barline', erase: false });
  };

  /** The authoritative final boundary of the score (stroke: 0.90pt). */
  const pushFinal = (x: number): void => {
    if (o.finalBarlineStyle === 'split-corridor') {
      if (channelled) out.push({ x, y1: finalTop, y2: rhBot, width: GRID_CHANNEL_BARLINE, stroke: '#FFFFFF', cls: 'janko-grid-channel', erase: true });
      out.push({ x, y1: finalTop, y2: rhBot, width: 0.90, stroke: '#111111', cls: 'janko-barline', erase: false });
      if (channelled) out.push({ x, y1: lhTop, y2: finalBot, width: GRID_CHANNEL_BARLINE, stroke: '#FFFFFF', cls: 'janko-grid-channel', erase: true });
      out.push({ x, y1: lhTop, y2: finalBot, width: 0.90, stroke: '#111111', cls: 'janko-barline', erase: false });
      return;
    }
    if (channelled) out.push({ x, y1: finalTop, y2: finalBot, width: GRID_CHANNEL_BARLINE, stroke: '#FFFFFF', cls: 'janko-grid-channel', erase: true });
    out.push({ x, y1: finalTop, y2: finalBot, width: 0.90, stroke: '#111111', cls: 'janko-barline', erase: false });
  };

  const anacrusis = t.anacrusisTicks ?? 0;
  if (geo.index === 0 && anacrusis > 0) {
    const upbeatWidth = (anacrusis / t.ticksPerMeasure) * geo.measureWidth;
    // 1. Barline ending the upbeat
    pushMeasure(geo.staffLeft + upbeatWidth);

    // 2. Measure barlines for mm. 1..measuresPerSystem
    for (let m = 1; m <= o.measuresPerSystem; m++) {
      const isSystemEnd = m === o.measuresPerSystem;
      if (isSystemEnd && !isFinalScoreMeasure) continue;
      const x = geo.staffLeft + upbeatWidth + m * geo.measureWidth;
      if (isSystemEnd) {
        pushFinal(x);
        continue;
      }
      pushMeasure(x);
    }
  } else {
    // Internal boundaries: every measure end; the system end only closes the
    // score.
    for (let m = 0; m < o.measuresPerSystem; m++) {
      const isSystemEnd = m === o.measuresPerSystem - 1;
      if (isSystemEnd && !isFinalScoreMeasure) continue;
      const x = geo.staffLeft + (m + 1) * geo.measureWidth;
      if (isSystemEnd) {
        pushFinal(x);
        continue;
      }
      pushMeasure(x);
    }
  }

  const anacrusisTicks = t.anacrusisTicks ?? 0;
  const upbeatWidth = geo.index === 0 && anacrusisTicks > 0
    ? anacrusisTicks / t.ticksPerMeasure * geo.measureWidth : 0;
  return out.map(s => ({ ...s, tick: anacrusisTicks +
    (geo.index * o.measuresPerSystem + Math.round((s.x - geo.staffLeft - upbeatWidth) / geo.measureWidth))
    * t.ticksPerMeasure }));
}

/** Serialize the placed barline scene without deriving any geometry here. */
export function renderBarlines(
  geo: JankoSystemGeometry,
  options?: Partial<JankoLayoutOptions> | null,
  tokens?: Partial<JankoTokens> | null,
  isFinalScoreMeasure: boolean = true
): string {
  return ['  <g class="janko-barlines">',
    ...barlineStrokes(geo, options, tokens, isFinalScoreMeasure).map(serializeVerticalGridStroke),
    '  </g>'].join('\n');
}

/** Vertical clearance (pt) a measure numeral keeps above the staff's top rule. */
export const MEASURE_NUMBER_CLEARANCE = 3.0;

/**
 * Horizontal offset (pt) of a measure numeral left of the staff column
 * (Round 11): `x = staffLeft − 10.0`, right-aligned into the true left margin
 * (Henle / Bärenreiter practice). The engine's margin-furniture box shares the
 * same anchor, so the reserved ink and the painted ink can never drift.
 */
export const MEASURE_NUMBER_LEFT_OFFSET = 10.0;

/**
 * Baseline y of a system's measure numeral.
 *
 * Round 11 sets the numeral snug just above the top staff rule
 * (`staffTopY − 3.0`): pushed into the left margin it clears high Octave 6
 * notes in m. 29 while still reading naturally at m. 5. The engine's
 * margin-furniture box (which the linter audits) shares this function, so the
 * reserved ink and the painted ink can never drift apart.
 */
export function getMeasureNumberBaselineY(geo: JankoSystemGeometry): number {
  return geo.staffTopY - MEASURE_NUMBER_CLEARANCE;
}

/**
 * A measure number in the left margin above the first measure of a system
 * (Round 11): `x = staffLeft − 10.0pt`, `text-anchor="end"`,
 * `y = staffTopY − 3.0pt`.
 */
export function renderMeasureNumber(
  geo: JankoSystemGeometry,
  measureNumber: number,
  tokens?: Partial<JankoTokens> | null
): string {
  void tokens;
  const x = geo.staffLeft - MEASURE_NUMBER_LEFT_OFFSET;
  const y = getMeasureNumberBaselineY(geo);
  return `    <text class="janko-measure-num" x="${f(x)}" y="${f(y)}" text-anchor="end">${measureNumber}</text>`;
}

/**
 * Vertical dashed pulse lines for beats 2, 3, … (Klavarskribo beat grid).
 * Replaces the heavy time signature numerals with subtle subdivision guidance.
 * Round 7 steps the grid up to 0.70pt `#9CA3AF`: the beat pulses stay clearly
 * subordinate to the music but now read as a real structural layer above the
 * lightened staff rules.
 *
 * Round 12 makes each pulse one **continuous** rule from `rhTop` down to
 * `lhBot` across the Middle C corridor, matching the measure barlines, and
 * honours the active `gridWritingPolicy`: the strict policy gives every pulse a
 * white air channel (painted above the rhythm layer by the engine, so no stem
 * may cross it), while the transparent policy lets the note field use the full
 * measure width and knocks the pulse out with the circular glyph mask.
 */
/**
 * X position of every dashed beat pulse of one system, in painting order
 * (measure by measure, beat by beat).
 *
 * Round 19: a beat that **carries an onset** is painted through that onset's
 * **laid-out column** (`columns`, the solve's rigidly translated beat x). The
 * proportional grid starts at the measure's grid inset and steps by the free
 * width, while the note columns start `claspInset` further in and step tighter,
 * so the two axes drift apart by up to ~8.5pt on the corpus (Brahms m. 3: the
 * dotted quarter lines sat 8.51 / 7.67 / 6.84pt left of their own note columns,
 * and the m. 3 pair's bracket spine landed 0.76pt from its pulse). Beats with
 * no onset keep the proportional line.
 */
export function resolveBeatPulseXs(
  geo: JankoSystemGeometry,
  systemIndex: number,
  o: ResolvedJankoLayoutOptions,
  t: ResolvedJankoTokens,
  columns?: ReadonlyMap<number, number> | null
): number[] {
  return resolveBeatPulses(geo, systemIndex, o, t, columns).map((p) => p.x);
}

/**
 * Every painted dashed beat pulse of one system with its absolute beat tick:
 * the same candidates {@link resolveBeatPulseXs} paints (occupied beats at
 * their laid-out columns, unoccupied beats proportional, `gridPulseFilter`
 * applied), as `{ tick, x }` pairs for audits that must know which beat line
 * brackets an onset.
 */
export function resolveBeatPulses(
  geo: JankoSystemGeometry,
  systemIndex: number,
  o: ResolvedJankoLayoutOptions,
  t: ResolvedJankoTokens,
  columns?: ReadonlyMap<number, number> | null
): Array<{ tick: number; x: number }> {
  if (!o.showBeatGrid) return [];
  const beatsPerMeasure = Math.max(1, Math.round(t.ticksPerMeasure / t.ticksPerBeat));
  if (beatsPerMeasure <= 1) return [];

  const baseInset = getGridNoteInset(o, t);
  const anacrusis = t.anacrusisTicks ?? 0;
  const isSys0Anacrusis = systemIndex === 0 && anacrusis > 0;
  const upbeatWidth = isSys0Anacrusis ? (anacrusis / t.ticksPerMeasure) * geo.measureWidth : 0;
  const out: Array<{ tick: number; x: number }> = [];

  for (let m = 0; m < o.measuresPerSystem; m++) {
    const isOpeningMeasure = systemIndex === 0 && m === 0;
    const insets =
      isOpeningMeasure && o.showTimeSignature && o.timeSignatureWidth > 0
        ? { left: baseInset + o.timeSignatureWidth, right: baseInset }
        : undefined;
    const measureLeft = isSys0Anacrusis
      ? geo.staffLeft + upbeatWidth + m * geo.measureWidth
      : geo.staffLeft + m * geo.measureWidth;
    const left = insets?.left ?? baseInset;
    const right = insets?.right ?? baseInset;
    const available = Math.max(0, geo.measureWidth - left - right);
    // The absolute tick of this loop cell's first beat. The anacrusis system's
    // opening cell is the first *full* measure (measure index 1, starting at
    // the anacrusis); every other cell follows the ordinary measure grid.
    const measureStartTick = isSys0Anacrusis
      ? anacrusis + m * t.ticksPerMeasure
      : anacrusis + (systemIndex * o.measuresPerSystem + m) * t.ticksPerMeasure;
    // Round 33 `none`: no interior pulse paints at all (barlines always do).
    if (o.gridPulseFilter === 'none') continue;
    for (let b = 1; b < beatsPerMeasure; b++) {
      // Round 32 `midpoint-only`: a filter over the existing candidates —
      // retain the pulse iff its tick offset is exactly half a measure.
      // Odd subdivisions with no existing midpoint retain nothing here.
      if (
        o.gridPulseFilter === 'midpoint-only' &&
        b * t.ticksPerBeat * 2 !== t.ticksPerMeasure
      ) {
        continue;
      }
      const tick = measureStartTick + b * t.ticksPerBeat;
      out.push({ tick, x: columns?.get(tick) ?? measureLeft + left + (b / beatsPerMeasure) * available });
    }
  }
  return out;
}

/**
 * Vertical dashed pulse lines for beats 2, 3, … (Klavarskribo beat grid).
 * Replaces the heavy time signature numerals with subtle subdivision guidance.
 * Round 7 steps the grid up to 0.70pt `#9CA3AF`: the beat pulses stay clearly
 * subordinate to the music but now read as a real structural layer above the
 * lightened staff rules.
 *
 * Round 12 makes each pulse one **continuous** rule from `rhTop` down to
 * `lhBot` across the Middle C corridor, matching the measure barlines, and
 * honours the active `gridWritingPolicy`: the strict policy gives every pulse a
 * white air channel (painted above the rhythm layer by the engine, so no stem
 * may cross it), while the transparent policy lets the note field use the full
 * measure width and knocks the pulse out with the circular glyph mask.
 *
 * Round 19 makes each **occupied** beat's pulse follow its onset's laid-out
 * column (see {@link resolveBeatPulseXs}).
 */
export function renderBeatGrid(
  geo: JankoSystemGeometry,
  systemIndex: number,
  options?: Partial<JankoLayoutOptions> | null,
  tokens?: Partial<JankoTokens> | null,
  columns?: ReadonlyMap<number, number> | null
): string {
  const o = resolveJankoOptions(options);
  const t = resolveJankoTokens(tokens);
  if (!o.showBeatGrid) return '';

  const strokes = beatGridStrokes(geo, systemIndex, o, t, columns);
  if (strokes.length === 0) return '';
  return ['  <g class="janko-beat-grid">', ...strokes.map(serializeVerticalGridStroke), '  </g>'].join('\n');
}

/** Beat pulses include the resolved tick, even for proportional empty beats. */
export function beatGridStrokes(
  geo: JankoSystemGeometry,
  systemIndex: number,
  o: ResolvedJankoLayoutOptions,
  t: ResolvedJankoTokens,
  columns?: ReadonlyMap<number, number> | null
): VerticalGridStroke[] {
  const pulses = resolveBeatPulses(geo, systemIndex, o, t, columns);
  const top = gridTopY(geo, o, t);
  const bot = gridBotY(geo, o, t);
  const out: VerticalGridStroke[] = [];
  for (const { x, tick } of pulses) {
    if (channelsGridInk(o.gridWritingPolicy)) {
      out.push({ x, y1: top, y2: bot, width: GRID_CHANNEL_BEAT, stroke: '#FFFFFF', cls: 'janko-grid-channel', dash: '2,3', erase: true, tick });
    }
    out.push({ x, y1: top, y2: bot, width: 0.70, stroke: '#9CA3AF', cls: 'janko-beat-line', dash: '2,3', erase: false, tick });
  }
  return out;
}

export function serializeVerticalGridStroke(s: VerticalGridStroke): string {
  if (s.erase) return gridChannel(s.x, s.y1, s.y2, s.width, s.cls, s.dash);
  if (s.cls === 'janko-barline') return renderStaffBarline(s.x, s.y1, s.y2, s.width, s.stroke);
  return `    <line class="janko-beat-line" x1="${f(s.x)}" y1="${f(s.y1)}" x2="${f(s.x)}" y2="${f(s.y2)}" stroke="${s.stroke}" stroke-width="${s.width.toFixed(2)}" stroke-dasharray="${s.dash}"/>`;
}
