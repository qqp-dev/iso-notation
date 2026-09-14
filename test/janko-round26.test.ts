/**
 * The 0-line decision (Round 26): anchor, tick, or nothing.
 * ===========================================================
 *
 * Pins the corrected anchor geometry and the fourth scheme:
 *
 * - the anchor on middle C (C4 pierced, B3 a semitone clear, 2x weights),
 * - the clef tick (short anchor, divider C-lines, minimal pair with control),
 * - the margin-label gate (off by default, opt-in per scheme),
 * - paint truth with x-spans (the tick is short, everything else full width),
 * - the linter verdict (every Round 26 card clean on the full score).
 *
 * Corpus pins use the Bach Goldberg Var. 1 benchmark.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1';
import {
  computePageGeometry,
  getSystemGeometry,
  knockoutHalfExtents,
  renderSystem,
} from '../src/render/janko/engine';
import {
  PITCH_GRID_C_LINE_STROKE,
  PITCH_GRID_DIVIDER_INK,
  PITCH_GRID_DIVIDER_STROKE,
  PITCH_GRID_MARKER_LENGTH,
  PitchGridRule,
  pitchGridRules,
  renderOctaveLabels,
} from '../src/render/janko/elements/staff';
import { lintJankoScore } from '../src/render/janko/linter';
import { CONTINUOUS_PITCH_ANCHOR_LIN, continuousPitchY } from '../src/render/janko/geometry';
import {
  DEFAULT_JANKO_OPTIONS,
  DEFAULT_JANKO_TOKENS,
  JankoOctaveLineScheme,
  resolveJankoOptions,
  resolveJankoTokens,
} from '../src/render/janko/types';

const SCORE = buildBachGoldbergVar1Score();

function continuousOptions(scheme: JankoOctaveLineScheme, extra?: object) {
  return resolveJankoOptions({
    ...DEFAULT_JANKO_OPTIONS,
    core: 'adaptive',
    pitchMapping: 'continuous',
    octaveLineScheme: scheme,
    ...(extra ?? {}),
  });
}

function systemZero(scheme: JankoOctaveLineScheme, extra?: object) {
  const o = continuousOptions(scheme, extra);
  const t = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
  return { o, t, geo: getSystemGeometry(computePageGeometry(o, t, SCORE), 0) };
}

/** Painted pitch-grid lines of one system render, with x-spans. */
function paintedGridLines(
  svg: string
): Array<{ cls: string; x1: number; x2: number; y: number; ink: string; width: number }> {
  const out: Array<{ cls: string; x1: number; x2: number; y: number; ink: string; width: number }> = [];
  const re =
    /<line class="([^"]*)" x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)" stroke="([^"]*)" stroke-width="([\d.]+)"\/>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(svg)) !== null) {
    if (!match[1].includes('janko-pitch-')) continue;
    out.push({
      cls: match[1],
      x1: Number(match[2]),
      y: Number(match[3]),
      x2: Number(match[4]),
      ink: match[6],
      width: Number(match[7]),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 1. The anchor on middle C
// ---------------------------------------------------------------------------

test('The grid anchor is middle C the note, not the boundary below it', () => {
  assert.equal(CONTINUOUS_PITCH_ANCHOR_LIN, 48);
  assert.ok(Math.abs(continuousPitchY(48, 2.5)) < 1e-9, 'C4 maps exactly onto Middle C');
  assert.equal(continuousPitchY(47, 2.5), 2.5, 'B3 stands a full semitone below');
});

test('The divider runs through middle C at 2x the faint lines', () => {
  const { o, t, geo } = systemZero('grand-divider');
  const [divider, ...clines] = pitchGridRules(geo, o, t);
  assert.equal(divider.y, geo.middleCY, 'the anchor sits on Middle C');
  assert.equal(divider.width, PITCH_GRID_DIVIDER_STROKE, '0.65pt anchor');
  assert.equal(divider.ink, PITCH_GRID_DIVIDER_INK, 'dark anchor ink');
  assert.equal(divider.width, 0.65, 'the locked anchor weight');
  assert.equal(PITCH_GRID_C_LINE_STROKE, 0.35, 'the locked faint weight');
  assert.ok(
    Math.abs(divider.width / PITCH_GRID_C_LINE_STROKE - 2) < 0.2,
    'the anchor reads ~2x the faint lines'
  );
  assert.ok(clines.length >= 1, 'faint C-lines accompany the anchor');
  assert.ok(
    !clines.some((r) => Math.abs(r.y - geo.middleCY) < 2.0),
    'no C-line doubles the anchor slot'
  );
});

test('C4 heads are pierced by the anchor with knockout holes', () => {
  // A C4 head centers exactly on the anchor, so its mask must cross the
  // anchor line — the standard middle-C ledger behavior. The mask half-height
  // (3.46pt on `tight`) exceeds the zero offset by construction.
  const { o, t, geo } = systemZero('grand-divider');
  const c4y = geo.middleCY + continuousPitchY(48, t.semitoneScale);
  assert.equal(c4y, geo.middleCY, 'C4 height is the anchor height');
  const mask = knockoutHalfExtents(o, t, 99);
  assert.ok(mask.hy > 0, 'the mask reaches across the anchor');
});

// ---------------------------------------------------------------------------
// 2. The clef tick
// ---------------------------------------------------------------------------

test('Clef marker: a short anchor tick plus the divider’s own C-lines', () => {
  const clef = systemZero('clef-marker');
  const control = systemZero('grand-divider');
  const [tick, ...clines] = pitchGridRules(clef.geo, clef.o, clef.t);
  const [, ...controlClines] = pitchGridRules(control.geo, control.o, control.t);
  assert.equal(tick.cls, 'janko-pitch-marker', 'marker class');
  assert.equal(tick.y, clef.geo.middleCY, 'the tick marks Middle C');
  assert.equal(tick.x1, clef.geo.staffLeft, 'the tick starts at the staff edge');
  assert.ok(
    Math.abs(tick.x2 - tick.x1 - PITCH_GRID_MARKER_LENGTH) < 1e-9,
    'the tick runs 20pt'
  );
  assert.equal(tick.width, PITCH_GRID_DIVIDER_STROKE, 'the tick carries anchor weight');
  assert.equal(tick.ink, PITCH_GRID_DIVIDER_INK, 'the tick carries anchor ink');
  assert.deepEqual(
    clines.map((r) => [r.y, r.x1, r.x2, r.ink, r.width, r.cls]),
    controlClines.map((r) => [r.y, r.x1, r.x2, r.ink, r.width, r.cls]),
    'the C-lines match the control exactly: the tick is the only delta'
  );
});

test('Paint truth with x-spans: the tick is short, everything else full width', () => {
  const o = continuousOptions('clef-marker');
  const t = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
  const page = computePageGeometry(o, t, SCORE);
  const geo = getSystemGeometry(page, 0);
  const svg = renderSystem(SCORE, geo, 0, o, t);
  const painted = paintedGridLines(svg);
  const rules: PitchGridRule[] = pitchGridRules(geo, o, t);
  assert.equal(painted.length, rules.length, 'every rule is painted, none extra');
  for (let i = 0; i < rules.length; i++) {
    assert.equal(painted[i].cls, rules[i].cls, `rule ${i}: class`);
    assert.ok(Math.abs(painted[i].x1 - rules[i].x1) < 0.015, `rule ${i}: x1`);
    assert.ok(Math.abs(painted[i].x2 - rules[i].x2) < 0.015, `rule ${i}: x2`);
    assert.ok(Math.abs(painted[i].y - rules[i].y) < 0.015, `rule ${i}: y`);
  }
  const tick = painted.find((p) => p.cls === 'janko-pitch-marker')!;
  assert.ok(tick.x2 - tick.x1 < 21, 'the painted tick is short');
  for (const p of painted.filter((p) => p.cls !== 'janko-pitch-marker')) {
    assert.ok(p.x2 - p.x1 > 100, `${p.cls} spans the staff`);
  }
});

// ---------------------------------------------------------------------------
// 3. The margin-label gate
// ---------------------------------------------------------------------------

test('Margin landmarks stay off by default and return on request', () => {
  const off = systemZero('grand-divider');
  assert.equal(renderOctaveLabels(off.geo, off.o, off.t), '', 'off by default');
  const on = systemZero('grand-divider', { showPitchLabels: true });
  assert.match(renderOctaveLabels(on.geo, on.o, on.t), />C\d</, 'C-labels on request');
  const centers = systemZero('equal-centers', { showPitchLabels: true });
  const digits = renderOctaveLabels(centers.geo, centers.o, centers.t);
  assert.ok(!digits.includes('>C'), 'centers keep digits, never C-labels');
  assert.match(digits, />[2-6]</, 'centers label octave middles');
});

// ---------------------------------------------------------------------------
// 4. The linter verdict
// ---------------------------------------------------------------------------

test('Every Round 26 card is clean on the full Bach score', () => {
  for (const scheme of ['grand-divider', 'equal-centers', 'equal-boundaries', 'clef-marker'] as const) {
    const report = lintJankoScore(SCORE, continuousOptions(scheme), DEFAULT_JANKO_TOKENS);
    assert.equal(report.violations.length, 0, `${scheme}: zero violations`);
    assert.equal(report.warnings.length, 0, `${scheme}: zero warnings`);
    assert.ok(report.ok, `${scheme}: the chip reads clean`);
  }
});
