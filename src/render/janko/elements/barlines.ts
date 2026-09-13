/**
 * Barlines: internal measure barlines and system boundaries.
 *
 * Each hand keeps its own classical barline segment (RH: o5..o4, LH: o3..o2),
 * preserving the "two independent grand-staff halves" reading of the Jánko
 * Two-Row Equator system. The system end is drawn as a final boundary.
 */

import {
  JankoLayoutOptions,
  JankoSystemGeometry,
  JankoTokens,
  resolveJankoOptions,
  resolveJankoTokens,
} from '../types';
import { getTickX } from '../geometry';
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
 * All internal measure barlines of one system, plus the closing system
 * boundary. Measure numbers are the caller's responsibility (see engine).
 *
 * Round 7 lightens the measure barlines to 0.60pt and opens the intermediate
 * systems at their right edge: only the **final measure of the final system**
 * (`isFinalScoreMeasure`) draws the closing vertical barline. Every other
 * system simply stops in open negative space, matching its open left start.
 *
 * Round 10 gives that closing boundary two paradigms
 * ({@link JankoLayoutOptions.finalBarlineStyle}): `'unified'` (the default)
 * draws one continuous double barline from `rhTop` down to `lhBot`, sealing the
 * Middle C corridor; `'split-corridor'` keeps the two independent hand
 * segments and leaves the corridor open.
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

  const rhTop = geo.equatorY('RH', 5) - 12;
  const rhBot = geo.equatorY('RH', 4) + 12;
  const lhTop = geo.equatorY('LH', 3) - 12;
  const lhBot = geo.equatorY('LH', 2) + 12;

  /** The authoritative final boundary of the score. */
  const pushFinal = (x: number): void => {
    if (o.finalBarlineStyle === 'split-corridor') {
      out.push(renderStaffBarline(x, rhTop, rhBot, 1.05));
      out.push(renderStaffBarline(x, lhTop, lhBot, 1.05));
      return;
    }
    out.push(renderStaffBarline(x, rhTop, lhBot, 1.05));
  };

  const anacrusis = t.anacrusisTicks ?? 0;
  if (geo.index === 0 && anacrusis > 0) {
    const upbeatWidth = (anacrusis / t.ticksPerMeasure) * geo.measureWidth;
    // 1. Barline ending the upbeat
    out.push(renderStaffBarline(geo.staffLeft + upbeatWidth, rhTop, rhBot, 0.60));
    out.push(renderStaffBarline(geo.staffLeft + upbeatWidth, lhTop, lhBot, 0.60));

    // 2. Measure barlines for mm. 1..measuresPerSystem
    for (let m = 1; m <= o.measuresPerSystem; m++) {
      const isSystemEnd = m === o.measuresPerSystem;
      if (isSystemEnd && !isFinalScoreMeasure) continue;
      const x = geo.staffLeft + upbeatWidth + m * geo.measureWidth;
      if (isSystemEnd) {
        pushFinal(x);
        continue;
      }
      out.push(renderStaffBarline(x, rhTop, rhBot, 0.60));
      out.push(renderStaffBarline(x, lhTop, lhBot, 0.60));
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
      out.push(renderStaffBarline(x, rhTop, rhBot, 0.60));
      out.push(renderStaffBarline(x, lhTop, lhBot, 0.60));
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
 */
export function renderBeatGrid(
  geo: JankoSystemGeometry,
  systemIndex: number,
  options?: Partial<JankoLayoutOptions> | null,
  tokens?: Partial<JankoTokens> | null
): string {
  const o = resolveJankoOptions(options);
  const t = resolveJankoTokens(tokens);
  if (!o.showBeatGrid) return '';

  const beatsPerMeasure = Math.max(1, Math.round(t.ticksPerMeasure / t.ticksPerBeat));
  if (beatsPerMeasure <= 1) return '';

  const out: string[] = ['  <g class="janko-beat-grid">'];
  const rhTop = geo.equatorY('RH', 5) - 12;
  const rhBot = geo.equatorY('RH', 4) + 12;
  const lhTop = geo.equatorY('LH', 3) - 12;
  const lhBot = geo.equatorY('LH', 2) + 12;

  const anacrusis = t.anacrusisTicks ?? 0;
  const isSys0Anacrusis = systemIndex === 0 && anacrusis > 0;
  const upbeatWidth = isSys0Anacrusis ? (anacrusis / t.ticksPerMeasure) * geo.measureWidth : 0;

  for (let m = 0; m < o.measuresPerSystem; m++) {
    const isOpeningMeasure = systemIndex === 0 && m === 0;
    const insets =
      isOpeningMeasure && o.showTimeSignature && o.timeSignatureWidth > 0
        ? { left: t.measureInset + o.timeSignatureWidth, right: t.measureInset }
        : undefined;

    const measureLeft = isSys0Anacrusis
      ? geo.staffLeft + upbeatWidth + m * geo.measureWidth
      : geo.staffLeft + m * geo.measureWidth;

    const left = insets?.left ?? t.measureInset;
    const right = insets?.right ?? t.measureInset;
    const available = Math.max(0, geo.measureWidth - left - right);

    for (let b = 1; b < beatsPerMeasure; b++) {
      const frac = b / beatsPerMeasure;
      const x = measureLeft + left + frac * available;
      out.push(
        `    <line class="janko-beat-line" x1="${f(x)}" y1="${f(rhTop)}" x2="${f(x)}" y2="${f(rhBot)}" stroke="#9CA3AF" stroke-width="0.70" stroke-dasharray="2,3"/>`
      );
      out.push(
        `    <line class="janko-beat-line" x1="${f(x)}" y1="${f(lhTop)}" x2="${f(x)}" y2="${f(lhBot)}" stroke="#9CA3AF" stroke-width="0.70" stroke-dasharray="2,3"/>`
      );
    }
  }

  out.push('  </g>');
  return out.join('\n');
}
