/**
 * Staff elements: octave equator lines, Middle C spine, subtle row guides and
 * dynamic ledger equators.
 *
 * Every octave is one **absolute, hand-independent** lattice: the four staff
 * equators (o5/o4/o3/o2) are continuous rules shared by both hands, spaced by
 * `octaveStep` (2h = 30pt) above and below Middle C — Round 11 equalizes
 * `interStaffGap` to that same 30pt, so the corridor carries exactly one
 * octave step of negative breathing space with **no** spine by default. Only
 * octaves outside the staff span emit dynamic ledger equators. Horizontal
 * dotted row guidelines and the dashed Middle C spine are opt-in; the only
 * dotted lines in the canonical engraving are the vertical beat-grid pulses.
 *
 * Under `channelLayout: 'bounded-channel'` every equator is drawn as **two**
 * boundary rules at `equator ± channelHalfWidth`, opening the channel that
 * holds whole-tone Set A; the other three layouts (`'single-equator'`,
 * `'on-the-line'`, `'single-line-3row'`) draw one rule per equator. The same
 * pairing is applied to dynamic ledgers so an out-of-staff octave keeps its
 * center row open too.
 */

import {
  JankoLayoutOptions,
  JankoSystemGeometry,
  JankoTokens,
  resolveJankoOptions,
  resolveJankoTokens,
} from '../types';
import { DEFAULT_PITCH_WINDOW, continuousPitchY } from '../geometry';
import { f } from './style';

type Hand = 'RH' | 'LH';

/** Render one horizontal rule. */
export function renderRule(
  x1: number,
  x2: number,
  y: number,
  stroke: string,
  strokeWidth: number,
  dashArray?: string
): string {
  const dash = dashArray ? ` stroke-dasharray="${dashArray}"` : '';
  return `    <line x1="${f(x1)}" y1="${f(y)}" x2="${f(x2)}" y2="${f(y)}" stroke="${stroke}" stroke-width="${strokeWidth.toFixed(2)}"${dash}/>`;
}

/**
 * Absolute ys of the horizontal rules that frame one octave equator.
 *
 * `'single-equator'`, `'on-the-line'` and `'single-line-3row'` paint exactly
 * one rule, on the equator (4 across the staff). Only
 * `'bounded-channel'` paints two, at `equator ± channelHalfWidth`, so the
 * whole-tone Set A row sits in the open negative space between them (8 across
 * the staff).
 */
export function getEquatorRuleYs(
  equatorY: number,
  options?: Partial<JankoLayoutOptions> | null,
  tokens?: Partial<JankoTokens> | null
): number[] {
  const o = resolveJankoOptions(options);
  if (o.channelLayout !== 'bounded-channel') return [equatorY];
  const t = resolveJankoTokens(tokens);
  return [equatorY - t.channelHalfWidth, equatorY + t.channelHalfWidth];
}

/**
 * The four staff octave equators (o5, o4, o3, o2), shared by both hands, plus
 * the opt-in Middle C spine and row guidelines of every staff lane.
 */
export function renderStaffLines(
  geo: JankoSystemGeometry,
  options?: Partial<JankoLayoutOptions> | null,
  tokens?: Partial<JankoTokens> | null
): string {
  const o = resolveJankoOptions(options);
  const t = resolveJankoTokens(tokens);
  if (o.pitchMapping !== 'twin-rows') return renderPitchGrid(geo, o, t);
  const out: string[] = ['  <g class="janko-staff-lines">'];

  // Round 8 uniformizes the hierarchy: all four octave equators (RH 5, LH 2,
  // RH 4, LH 3) are one identical 0.50pt `#1E293B` hairline, so no octave line
  // competes with another and the staff reads as four quiet, equal rules.
  const equators: Array<[Hand, number, string, number]> = [
    ['RH', 5, '#1E293B', 0.50],
    ['LH', 2, '#1E293B', 0.50],
    ['RH', 4, '#1E293B', 0.50],
    ['LH', 3, '#1E293B', 0.50],
  ];
  for (const [hand, oct, stroke, width] of equators) {
    for (const y of getEquatorRuleYs(geo.equatorY(hand, oct), o, t)) {
      out.push(renderRule(geo.staffLeft, geo.staffRight, y, stroke, width));
    }
  }

  out.push('  </g>');
  // Both are opt-in and resolve to the empty string when disabled, so no empty
  // <g> wrapper ever reaches the document.
  const guidelines = renderRowGuidelines(geo, o, t);
  if (guidelines) out.push(guidelines);
  const spine = renderMiddleCSpine(geo, o, t);
  if (spine) out.push(spine);

  return out.join('\n');
}

/** Ink of the Middle C divider (the landscape benchmark's dark spine). */
export const PITCH_GRID_DIVIDER_INK = '#0F172A';
/** Weight of the Middle C divider: firm, not bold (2x the faint C-lines). */
export const PITCH_GRID_DIVIDER_STROKE = 0.65;
/** Ink of the grand grid's faint C-lines. */
export const PITCH_GRID_C_LINE_INK = '#64748B';
/** Weight of the grand grid's faint C-lines. */
export const PITCH_GRID_C_LINE_STROKE = 0.35;
/** Ink of the lanes' strengthened C-lanes. */
export const PITCH_GRID_C_LANE_INK = '#334155';
/** Weight of the lanes' strengthened C-lanes. */
export const PITCH_GRID_C_LANE_STROKE = 0.6;
/** Ink of the lanes' semitone hairlines. */
export const PITCH_GRID_LANE_INK = '#94A3B8';
/** Weight of the lanes' semitone hairlines. */
export const PITCH_GRID_LANE_STROKE = 0.3;
/** Ink of the equal-scheme octave lines: the golden equator spec, exactly. */
export const PITCH_GRID_OCTAVE_INK = '#1E293B';
/** Weight of the equal-scheme octave lines: the golden equator spec, exactly. */
export const PITCH_GRID_OCTAVE_STROKE = 0.5;
/** Length (pt) of the clef-marker anchor tick at each system start. */
export const PITCH_GRID_MARKER_LENGTH = 20;

/** One horizontal rule of a continuous pitch grid, paint-ready. */
export interface PitchGridRule {
  /** Absolute page y of the rule. */
  y: number;
  /** Absolute page x where the rule starts. */
  x1: number;
  /** Absolute page x where the rule ends. */
  x2: number;
  /** Stroke ink. */
  ink: string;
  /** Stroke width (pt). */
  width: number;
  /** SVG class list (without the `class=""` wrapper). */
  cls: string;
}

/**
 * The line set of a continuous pitch grid, in paint order (the divider first,
 * then ascending pitch) — the single source the painter, the engine's drawn
 * rule list and the linter all read, so "a drawn line" can never mean
 * something the page does not show. Empty under `'twin-rows'` (the equators
 * are not pitch-grid rules).
 *
 * The grand grid draws one faint C-line per octave plus the middle-C
 * anchor; the chromatic lanes one lane per semitone (C-lanes strengthened)
 * plus the divider — lines within 2pt of the middle are omitted, since the
 * anchor owns it. The equal schemes draw no anchor at all: golden-weight
 * hairlines at the octave middles (`'equal-centers'`) or at the C boundaries
 * (`'equal-boundaries'`, the C4 line included — with no anchor there is
 * nothing to defer to). `'clef-marker'` keeps the divider grid's C-lines
 * with a short anchor tick at each system start instead of the full rule.
 */
export function pitchGridRules(
  geo: JankoSystemGeometry,
  options?: Partial<JankoLayoutOptions> | null,
  tokens?: Partial<JankoTokens> | null
): PitchGridRule[] {
  const o = resolveJankoOptions(options);
  const t = resolveJankoTokens(tokens);
  if (o.pitchMapping === 'twin-rows') return [];
  const window = geo.pitchWindow ?? DEFAULT_PITCH_WINDOW;
  const yOf = (lin: number): number => geo.middleCY + continuousPitchY(lin, t.semitoneScale);
  const x1 = geo.staffLeft;
  const x2 = geo.staffRight;
  if (o.pitchMapping === 'chromatic-lanes') {
    const out: PitchGridRule[] = [
      {
        y: geo.middleCY,
        x1,
        x2,
        ink: PITCH_GRID_DIVIDER_INK,
        width: PITCH_GRID_DIVIDER_STROKE,
        cls: 'janko-pitch-divider',
      },
    ];
    for (let lin = window.min; lin <= window.max; lin++) {
      const y = yOf(lin);
      if (Math.abs(y - geo.middleCY) < 2.0) continue;
      const isC = ((lin % 12) + 12) % 12 === 0;
      out.push({
        y,
        x1,
        x2,
        ink: isC ? PITCH_GRID_C_LANE_INK : PITCH_GRID_LANE_INK,
        width: isC ? PITCH_GRID_C_LANE_STROKE : PITCH_GRID_LANE_STROKE,
        cls: `janko-pitch-lane${isC ? ' janko-pitch-clane' : ''}`,
      });
    }
    return out;
  }
  if (o.octaveLineScheme === 'equal-centers') {
    const out: PitchGridRule[] = [];
    for (let n = Math.floor(window.min / 12); n <= Math.floor(window.max / 12); n++) {
      const c = n * 12 + 5.5;
      if (c < window.min || c > window.max) continue;
      out.push({
        y: yOf(c),
        x1,
        x2,
        ink: PITCH_GRID_OCTAVE_INK,
        width: PITCH_GRID_OCTAVE_STROKE,
        cls: 'janko-pitch-octave',
      });
    }
    return out;
  }
  if (o.octaveLineScheme === 'equal-boundaries') {
    const out: PitchGridRule[] = [];
    for (let c = Math.ceil(window.min / 12) * 12; c <= window.max; c += 12) {
      out.push({
        y: yOf(c),
        x1,
        x2,
        ink: PITCH_GRID_OCTAVE_INK,
        width: PITCH_GRID_OCTAVE_STROKE,
        cls: 'janko-pitch-lane janko-pitch-clane',
      });
    }
    return out;
  }
  const clines: PitchGridRule[] = [];
  for (let lin = window.min; lin <= window.max; lin++) {
    const isC = ((lin % 12) + 12) % 12 === 0;
    if (!isC) continue;
    const y = yOf(lin);
    if (Math.abs(y - geo.middleCY) < 2.0) continue;
    clines.push({
      y,
      x1,
      x2,
      ink: PITCH_GRID_C_LINE_INK,
      width: PITCH_GRID_C_LINE_STROKE,
      cls: 'janko-pitch-lane janko-pitch-clane',
    });
  }
  if (o.octaveLineScheme === 'clef-marker') {
    return [
      {
        y: geo.middleCY,
        x1,
        x2: x1 + PITCH_GRID_MARKER_LENGTH,
        ink: PITCH_GRID_DIVIDER_INK,
        width: PITCH_GRID_DIVIDER_STROKE,
        cls: 'janko-pitch-marker',
      },
      ...clines,
    ];
  }
  return [
    {
      y: geo.middleCY,
      x1,
      x2,
      ink: PITCH_GRID_DIVIDER_INK,
      width: PITCH_GRID_DIVIDER_STROKE,
      cls: 'janko-pitch-divider',
    },
    ...clines,
  ];
}

/**
 * The continuous pitch grid (the pitch-mapping round): every rule of
 * {@link pitchGridRules} in paint order. Notehead knockouts cut the rules
 * cleanly behind heads.
 */
export function renderPitchGrid(
  geo: JankoSystemGeometry,
  options?: Partial<JankoLayoutOptions> | null,
  tokens?: Partial<JankoTokens> | null
): string {
  const out: string[] = ['  <g class="janko-pitch-grid">'];
  for (const rule of pitchGridRules(geo, options, tokens)) {
    out.push(
      renderRule(rule.x1, rule.x2, rule.y, rule.ink, rule.width).replace(
        '<line',
        `<line class="${rule.cls}"`
      )
    );
  }
  out.push('  </g>');
  return out.join('\n');
}

/**
 * Subtle dashed guidelines showing the two whole-tone row lanes (odd rank
 * above / even rank below each staff equator). They are intentionally faint:
 * pure registration aids, never musical content — and **off by default**, so
 * the score keeps zero horizontal dotted lines. Under the continuous mappings
 * there are no rows, so there is nothing to guide.
 */
export function renderRowGuidelines(
  geo: JankoSystemGeometry,
  options?: Partial<JankoLayoutOptions> | null,
  tokens?: Partial<JankoTokens> | null
): string {
  const o = resolveJankoOptions(options);
  if (!o.showRowGuidelines) return '';
  if (o.pitchMapping !== 'twin-rows') return '';
  const t = resolveJankoTokens(tokens);
  const halfRow = t.rowHeight / 2;
  const out: string[] = ['  <g class="janko-row-guidelines" opacity="0.45">'];
  const x1 = geo.staffLeft + o.measureInset;
  const x2 = geo.staffRight - o.measureInset;
  const staffEquators: Array<[Hand, number]> = [
    ['RH', 5],
    ['RH', 4],
    ['LH', 3],
    ['LH', 2],
  ];
  for (const [hand, oct] of staffEquators) {
    const eq = geo.equatorY(hand, oct);
    out.push(renderRule(x1, x2, eq - halfRow, '#CBD5E1', 0.45, '3,3'));
    out.push(renderRule(x1, x2, eq + halfRow, '#CBD5E1', 0.45, '3,3'));
  }
  out.push('  </g>');
  return out.join('\n');
}

/**
 * The Middle C spine between the two hands (`dashed` | `double` | `continuous`
 * | `none`). `'none'` is the canonical treatment: the corridor is held open by
 * the negative space of `interStaffGap` alone, with nothing dividing the hands.
 */
export function renderMiddleCSpine(
  geo: JankoSystemGeometry,
  options?: Partial<JankoLayoutOptions> | null,
  tokens?: Partial<JankoTokens> | null
): string {
  const o = resolveJankoOptions(options);
  if (o.middleCSpine === 'none') return '';
  // Under the continuous mappings the grid's own divider owns the middle.
  if (o.pitchMapping !== 'twin-rows') return '';
  const t = resolveJankoTokens(tokens);
  const y = geo.middleCY;
  const x1 = geo.staffLeft + t.measureInset;
  const x2 = geo.staffRight - t.measureInset;
  const out: string[] = ['  <g class="janko-middle-c-spine">'];

  if (o.middleCSpine === 'double') {
    out.push(renderRule(x1, x2, y - 1.1, '#94A3B8', 0.55));
    out.push(renderRule(x1, x2, y + 1.1, '#94A3B8', 0.55));
  } else if (o.middleCSpine === 'continuous') {
    out.push(renderRule(x1, x2, y, '#94A3B8', 0.65));
  } else {
    out.push(renderRule(x1, x2, y, '#E2E8F0', 0.65, '4,4'));
  }

  out.push('  </g>');
  return out.join('\n');
}

/**
 * One dynamic ledger equator segment, centred on a notehead whose octave lies
 * outside the grand staff (`octave < 2` or `octave > 5`). The bounded center
 * channel emits the same pair of boundary rules as the staff equators, so an
 * out-of-staff octave keeps its center row open as well.
 */
export function renderLedgerEquator(
  x: number,
  y: number,
  tokens?: Partial<JankoTokens> | null,
  options?: Partial<JankoLayoutOptions> | null
): string {
  const t = resolveJankoTokens(tokens);
  const hw = t.ledgerHalfWidth;
  return getEquatorRuleYs(y, options, t)
    .map(
      (ruleY) =>
        `    <line class="janko-ledger" x1="${f(x - hw)}" y1="${f(ruleY)}" x2="${f(x + hw)}" y2="${f(ruleY)}" stroke="#334155" stroke-width="0.75"/>`
    )
    .join('\n');
}

/**
 * One **continuous outlier rule** (Round 11) at `y`, spanning `x1 … x2`.
 *
 * When successive measures share an out-of-staff ledger equator — Bach Var. 1
 * climbs into Octave 6 across mm. 29–30 — the choppy notehead-centred ledger
 * dashes are replaced by a single unbroken staff rule from the first measure's
 * opening edge to the last measure's closing edge.
 */
export function renderOutlierRule(x1: number, x2: number, y: number): string {
  return `    <line class="janko-outlier-rule" x1="${f(x1)}" y1="${f(y)}" x2="${f(x2)}" y2="${f(y)}" stroke="#334155" stroke-width="0.75"/>`;
}

/** Left-margin octave labels for the four staff equators. */
export function renderOctaveLabels(
  geo: JankoSystemGeometry,
  options?: Partial<JankoLayoutOptions> | null,
  _tokens?: Partial<JankoTokens> | null
): string {
  const o = resolveJankoOptions(options);
  // The continuous grids read by shape and position; their margin landmarks
  // are opt-in, like the twin octave labels.
  if (o.pitchMapping !== 'twin-rows') {
    return o.showPitchLabels ? renderPitchLabels(geo, o, _tokens) : '';
  }
  if (!o.showOctaveLabels) return '';
  const x = geo.staffLeft - 5;
  const out: string[] = ['  <g class="janko-octave-labels">'];
  const staffEquators: Array<[Hand, number]> = [
    ['RH', 5],
    ['RH', 4],
    ['LH', 3],
    ['LH', 2],
  ];
  for (const [hand, oct] of staffEquators) {
    out.push(
      `    <text x="${f(x)}" y="${f(geo.equatorY(hand, oct) + 2.5)}" class="janko-octave-label" text-anchor="end">${oct}</text>`
    );
  }
  out.push('  </g>');
  return out.join('\n');
}

/**
 * Left-margin pitch landmarks for the continuous grids, ending left of the
 * system-1 bracket's outer rule. Opt-in (`showPitchLabels`): one small serif
 * `C` label per C in the window (`C3` … `C6`) — except under
 * `'equal-centers'`, where the lines mark octave middles, so each line
 * carries its bare octave digit (the twin equator labels reborn).
 */
export function renderPitchLabels(
  geo: JankoSystemGeometry,
  options?: Partial<JankoLayoutOptions> | null,
  tokens?: Partial<JankoTokens> | null
): string {
  const o = resolveJankoOptions(options);
  const t = resolveJankoTokens(tokens);
  const window = geo.pitchWindow ?? DEFAULT_PITCH_WINDOW;
  const x = geo.staffLeft - 13.5;
  const out: string[] = ['  <g class="janko-pitch-labels">'];
  if (o.pitchMapping === 'continuous' && o.octaveLineScheme === 'equal-centers') {
    for (let n = Math.floor(window.min / 12); n <= Math.floor(window.max / 12); n++) {
      const c = n * 12 + 5.5;
      if (c < window.min || c > window.max) continue;
      const y = geo.middleCY + continuousPitchY(c, t.semitoneScale);
      out.push(
        `    <text x="${f(x)}" y="${f(y + 1.75)}" class="janko-pitch-label" text-anchor="end">${n}</text>`
      );
    }
    out.push('  </g>');
    return out.join('\n');
  }
  for (let c = Math.ceil(window.min / 12) * 12; c <= window.max; c += 12) {
    const y = geo.middleCY + continuousPitchY(c, t.semitoneScale);
    out.push(
      `    <text x="${f(x)}" y="${f(y + 1.75)}" class="janko-pitch-label" text-anchor="end">C${c / 12}</text>`
    );
  }
  out.push('  </g>');
  return out.join('\n');
}

/** m.d. (RH) / m.s. (LH) hand designations, rendered once on the first system. */
export function renderHandLabels(
  geo: JankoSystemGeometry,
  options?: Partial<JankoLayoutOptions> | null,
  _tokens?: Partial<JankoTokens> | null
): string {
  const o = resolveJankoOptions(options);
  if (!o.showHandLabels) return '';
  return [
    '  <g class="janko-hand-labels">',
    `    <text x="${f(geo.staffLeft)}" y="${f(geo.staffTopY + 2)}" class="janko-hand-label">m.d. (RH)</text>`,
    `    <text x="${f(geo.staffLeft)}" y="${f(geo.middleCY - 3)}" class="janko-hand-label">m.s. (LH)</text>`,
    '  </g>',
  ].join('\n');
}

/** 3/4 time signature, aligned on the inner equators of both hands. */
export function renderTimeSignature(
  geo: JankoSystemGeometry,
  options?: Partial<JankoLayoutOptions> | null,
  tokens?: Partial<JankoTokens> | null
): string {
  const o = resolveJankoOptions(options);
  if (!o.showTimeSignature) return '';
  const t = resolveJankoTokens(tokens);
  const tsx = geo.staffLeft + t.measureInset + 4;
  const out: string[] = ['  <g class="janko-time-signature">'];
  const anchors: Array<[Hand, number]> = [
    ['RH', 4],
    ['LH', 3],
  ];
  for (const [hand, oct] of anchors) {
    const y = geo.equatorY(hand, oct);
    out.push(`    <g transform="translate(${f(tsx)}, ${f(y)})">`);
    out.push('      <text x="0" y="-4" class="janko-ts-num">3</text>');
    out.push('      <text x="0" y="11" class="janko-ts-num">4</text>');
    out.push('    </g>');
  }
  out.push('  </g>');
  return out.join('\n');
}
