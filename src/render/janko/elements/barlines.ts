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

/** Absolute y of the continuous grid's top (`rhTop`, Octave 5 + 12pt). */
export function gridTopY(geo: JankoSystemGeometry): number {
  return geo.equatorY('RH', 5) - 12;
}

/** Absolute y of the continuous grid's bottom (`lhBot`, Octave 2 + 12pt). */
export function gridBotY(geo: JankoSystemGeometry): number {
  return geo.equatorY('LH', 2) + 12;
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
export function renderBarlines(
  geo: JankoSystemGeometry,
  options?: Partial<JankoLayoutOptions> | null,
  tokens?: Partial<JankoTokens> | null,
  isFinalScoreMeasure: boolean = true
): string {
  const o = resolveJankoOptions(options);
  const t = resolveJankoTokens(tokens);
  const out: string[] = ['  <g class="janko-barlines">'];
  const channelled = channelsGridInk(o.gridWritingPolicy);

  const rhTop = gridTopY(geo);
  const rhBot = geo.equatorY('RH', 4) + 12;
  const lhTop = geo.equatorY('LH', 3) - 12;
  const lhBot = gridBotY(geo);

  // Finale exception (last measure of the score only): extension rows drawn there run
  // flush INTO the final barline (no gap), and the final vertical extends to exactly meet
  // the outermost drawn extension row(s) — no overshoot. If the last bar draws no
  // extension rows, the final barline height is unchanged.
  let finalTop = rhTop;
  let finalBot = lhBot;
  if (isFinalScoreMeasure && (o.core === 'fixed-3' || o.core === 'fixed-4')) {
    const finalMIdx =
      geo.index === 0 && (t.anacrusisTicks ?? 0) > 0
        ? o.measuresPerSystem
        : o.measuresPerSystem - 1;
    const segs = getBarStaffSegments(geo, finalMIdx);
    const isFixed3 = o.core === 'fixed-3';
    const topExtLin = isFixed3 ? 72 : 77.5;
    const botExtLin = isFixed3 ? 24 : 17.5;
    if (segs.some((s) => s.lin === topExtLin)) {
      finalTop = geo.middleCY + continuousPitchY(topExtLin, t.semitoneScale);
    }
    if (segs.some((s) => s.lin === botExtLin)) {
      finalBot = geo.middleCY + continuousPitchY(botExtLin, t.semitoneScale);
    }
  }

  /** Push one internal measure barline: continuous across the corridor. */
  const pushMeasure = (x: number, strokeWidth: number = 0.60): void => {
    if (channelled) out.push(gridChannel(x, rhTop, lhBot, GRID_CHANNEL_BARLINE, 'janko-grid-channel'));
    out.push(renderStaffBarline(x, rhTop, lhBot, strokeWidth));
  };

  /** The authoritative final boundary of the score (stroke: 0.90pt). */
  const pushFinal = (x: number): void => {
    if (o.finalBarlineStyle === 'split-corridor') {
      if (channelled) out.push(gridChannel(x, finalTop, rhBot, GRID_CHANNEL_BARLINE, 'janko-grid-channel'));
      out.push(renderStaffBarline(x, finalTop, rhBot, 0.90));
      if (channelled) out.push(gridChannel(x, lhTop, finalBot, GRID_CHANNEL_BARLINE, 'janko-grid-channel'));
      out.push(renderStaffBarline(x, lhTop, finalBot, 0.90));
      return;
    }
    if (channelled) out.push(gridChannel(x, finalTop, finalBot, GRID_CHANNEL_BARLINE, 'janko-grid-channel'));
    out.push(renderStaffBarline(x, finalTop, finalBot, 0.90));
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

  out.push('  </g>');
  return out.join('\n');
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
  if (!o.showBeatGrid) return [];
  const beatsPerMeasure = Math.max(1, Math.round(t.ticksPerMeasure / t.ticksPerBeat));
  if (beatsPerMeasure <= 1) return [];

  const baseInset = getGridNoteInset(o, t);
  const anacrusis = t.anacrusisTicks ?? 0;
  const isSys0Anacrusis = systemIndex === 0 && anacrusis > 0;
  const upbeatWidth = isSys0Anacrusis ? (anacrusis / t.ticksPerMeasure) * geo.measureWidth : 0;
  const xs: number[] = [];

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
    for (let b = 1; b < beatsPerMeasure; b++) {
      const tick = measureStartTick + b * t.ticksPerBeat;
      xs.push(columns?.get(tick) ?? measureLeft + left + (b / beatsPerMeasure) * available);
    }
  }
  return xs;
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

  const pulses = resolveBeatPulseXs(geo, systemIndex, o, t, columns);
  if (pulses.length === 0) return '';

  const out: string[] = ['  <g class="janko-beat-grid">'];
  const rhTop = gridTopY(geo);
  const lhBot = gridBotY(geo);
  const channelled = channelsGridInk(o.gridWritingPolicy);

  for (const x of pulses) {
    if (channelled) {
      out.push(gridChannel(x, rhTop, lhBot, GRID_CHANNEL_BEAT, 'janko-grid-channel', '2,3'));
    }
    out.push(
      `    <line class="janko-beat-line" x1="${f(x)}" y1="${f(rhTop)}" x2="${f(x)}" y2="${f(lhBot)}" stroke="#9CA3AF" stroke-width="0.70" stroke-dasharray="2,3"/>`
    );
  }

  out.push('  </g>');
  return out.join('\n');
}
