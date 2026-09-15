/**
 * Golden Refinements: Durable Test Suite
 * =======================================
 *
 * Verifies the locked golden master refinements:
 *  1. Start bracket marks the C3–C5 core triple across all systems
 *     (identical vertical pitch extent across 2-line, 3-line, 4-line, and 5-line systems).
 *  2. System 1 bracket renders with grander metrics (stroke 0.90pt, +0.25pt delta,
 *     spur reach +0.50pt) while systems 2+ render the base 0.65pt mark.
 *  3. C4 octave line equalized to 0.50pt core hairlines (PITCH_GRID_OCTAVE_STROKE)
 *     wherever drawn (fixed-3, adaptive equal-boundaries), and no C4 line is drawn under fixed-4.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1';
import { buildBrahmsOp118No1Score } from '../src/scores/brahms-op118-no1';
import {
  computePageGeometry,
  getSystemGeometry,
  layoutJankoSystem,
  renderSystem,
} from '../src/render/janko/engine';
import {
  ARCHITECTURAL_BRACKET_FLARE_DEGREES,
  ARCHITECTURAL_BRACKET_FLARE_TAN,
  ARCHITECTURAL_BRACKET_SPUR,
  ARCHITECTURAL_BRACKET_STROKE,
  SYSTEM_1_ARCHITECTURAL_BRACKET_SPUR,
  SYSTEM_1_ARCHITECTURAL_BRACKET_STROKE,
  SYSTEM_1_BRACKET_SPUR_DELTA,
  SYSTEM_1_BRACKET_STROKE_DELTA,
} from '../src/render/janko/elements/accolade';
import {
  PITCH_GRID_C4_STROKE,
  PITCH_GRID_OCTAVE_STROKE,
  getBarStaffRows,
  getBarStaffSegments,
  pitchGridRules,
} from '../src/render/janko/elements/staff';
import { continuousPitchY } from '../src/render/janko/geometry';
import {
  DEFAULT_JANKO_OPTIONS,
  DEFAULT_JANKO_TOKENS,
  resolveJankoOptions,
  resolveJankoTokens,
} from '../src/render/janko/types';

const BACH = buildBachGoldbergVar1Score();
const BRAHMS = buildBrahmsOp118No1Score();
const TOKENS = resolveJankoTokens(DEFAULT_JANKO_TOKENS);

function parseBracket(svg: string): {
  tipX: number;
  tipY: number;
  xTop: number;
  yTop: number;
  xBot: number;
  yBot: number;
  footX: number;
  footY: number;
  stroke: number;
} {
  const match =
    /class="janko-system-bracket" d="M ([\d.-]+) ([\d.-]+) L ([\d.-]+) ([\d.-]+) L ([\d.-]+) ([\d.-]+) L ([\d.-]+) ([\d.-]+)"[^>]*stroke-width="([\d.]+)"/.exec(
      svg
    );
  assert.ok(match, 'system bracket path must be present');
  return {
    tipX: Number(match[1]),
    tipY: Number(match[2]),
    xTop: Number(match[3]),
    yTop: Number(match[4]),
    xBot: Number(match[5]),
    yBot: Number(match[6]),
    footX: Number(match[7]),
    footY: Number(match[8]),
    stroke: Number(match[9]),
  };
}

// ---------------------------------------------------------------------------
// 1. Bracket span pins
// ---------------------------------------------------------------------------

test('Bracket span pin: vertical extent equals C3–C5 pitch extent identically across 3-, 4-, and 5-line systems', () => {
  // Under lock-three core, Bach Var. 1 has a core floor of 3 lines {1, 2, 3} (lin 36, 48, 60).
  // Brahms fixed-3 contains 4-line bars (sys 3 bar 0: rows {1, 2, 3, 5}) and 5-line bars (sys 0 bar 0: rows {1..5}).
  const bachOpts = resolveJankoOptions({ ...DEFAULT_JANKO_OPTIONS, measuresPerSystem: 2 });
  const bachPage = computePageGeometry(bachOpts, TOKENS, BACH);

  const brahmsOpts = resolveJankoOptions({ ...DEFAULT_JANKO_OPTIONS, core: 'fixed-3', measuresPerSystem: 1 });
  const brahmsPage = computePageGeometry(brahmsOpts, TOKENS, BRAHMS);

  const cases = [
    { score: BACH, page: bachPage, sysIndex: 3, opts: bachOpts, expectedRows: [1, 2, 3], expectedLins: [36, 48, 60], label: '3-line (m.7)' },
    { score: BACH, page: bachPage, sysIndex: 0, opts: bachOpts, expectedRows: [1, 2, 3], expectedLins: [36, 48, 60], label: '3-line (m.1)' },
    { score: BRAHMS, page: brahmsPage, sysIndex: 3, opts: brahmsOpts, expectedRows: [1, 2, 3, 5], expectedLins: [24, 36, 48, 60], label: '4-line' },
    { score: BRAHMS, page: brahmsPage, sysIndex: 0, opts: brahmsOpts, expectedRows: [1, 2, 3, 4, 5], expectedLins: [24, 36, 48, 60, 72], label: '5-line' },
  ];

  const expectedPitchExtent = 24 * TOKENS.semitoneScale; // 60.0pt (C3 lin 36 to C5 lin 60)

  for (const sample of cases) {
    const geo = getSystemGeometry(sample.page, sample.sysIndex);
    const bar0Rows = getBarStaffRows(geo, 0);
    const bar0Segs = getBarStaffSegments(geo, 0);
    const bar0Lins = bar0Segs.map((seg) => seg.lin).sort((a, b) => a - b);

    assert.deepEqual(bar0Rows, sample.expectedRows, `${sample.label} bar rows match`);
    assert.deepEqual(bar0Lins, sample.expectedLins, `${sample.label} bar lines match`);

    const svg = renderSystem(sample.score, geo, sample.sysIndex, sample.opts, TOKENS);
    const b = parseBracket(svg);

    const c5LineY = geo.middleCY + continuousPitchY(60, TOKENS.semitoneScale);
    const c3LineY = geo.middleCY + continuousPitchY(36, TOKENS.semitoneScale);

    // Spine anchors exactly to C5 and C3 pitch coordinates (within SVG rounding)
    assert.ok(
      Math.abs(b.yTop - c5LineY) < 0.015,
      `${sample.label} (system ${sample.sysIndex + 1}): top rule meets C5 line y`
    );
    assert.ok(
      Math.abs(b.yBot - c3LineY) < 0.015,
      `${sample.label} (system ${sample.sysIndex + 1}): bottom rule meets C3 line y`
    );

    const pitchExtent = b.yBot - b.yTop;
    assert.ok(
      Math.abs(pitchExtent - expectedPitchExtent) < 0.015,
      `${sample.label} (system ${sample.sysIndex + 1}): vertical extent equals exactly C3–C5 pitch extent (${expectedPitchExtent}pt)`
    );

    // Cap idiom: spurs flare diagonally outward by spur * tan(13°)
    const spur = sample.sysIndex === 0 ? SYSTEM_1_ARCHITECTURAL_BRACKET_SPUR : ARCHITECTURAL_BRACKET_SPUR;
    const expectedFlare = spur * ARCHITECTURAL_BRACKET_FLARE_TAN;
    assert.ok(
      Math.abs((b.yTop - b.tipY) - expectedFlare) < 0.015,
      `${sample.label} (system ${sample.sysIndex + 1}): top spur flares upward beyond C5`
    );
    assert.ok(
      Math.abs((b.footY - b.yBot) - expectedFlare) < 0.015,
      `${sample.label} (system ${sample.sysIndex + 1}): bottom spur flares downward beyond C3`
    );
  }
});

// ---------------------------------------------------------------------------
// 2. System-1 grandeur pin
// ---------------------------------------------------------------------------

test('System-1 grandeur pin: System 1 bracket metrics exceed systems 2+ by the exact implemented delta', () => {
  const pageGeo = computePageGeometry(DEFAULT_JANKO_OPTIONS, TOKENS, BACH);
  const sys1Geo = getSystemGeometry(pageGeo, 0);
  const sys2Geo = getSystemGeometry(pageGeo, 1);

  const sys1Svg = renderSystem(BACH, sys1Geo, 0, DEFAULT_JANKO_OPTIONS, TOKENS);
  const sys2Svg = renderSystem(BACH, sys2Geo, 1, DEFAULT_JANKO_OPTIONS, TOKENS);

  const b1 = parseBracket(sys1Svg);
  const b2 = parseBracket(sys2Svg);

  const sys1Spur = b1.tipX - b1.xTop;
  const sys2Spur = b2.tipX - b2.xTop;

  // System 1 metrics
  assert.equal(b1.stroke, SYSTEM_1_ARCHITECTURAL_BRACKET_STROKE, 'System 1 stroke matches constant');
  assert.equal(b1.stroke, 0.90, 'System 1 renders at 0.90pt stroke');
  assert.ok(Math.abs(sys1Spur - SYSTEM_1_ARCHITECTURAL_BRACKET_SPUR) < 0.015, 'System 1 reach matches constant');
  assert.ok(Math.abs(sys1Spur - 3.5) < 0.015, 'System 1 reach is 3.5pt');

  // Systems 2+ metrics
  assert.equal(b2.stroke, ARCHITECTURAL_BRACKET_STROKE, 'System 2 stroke matches base constant');
  assert.equal(b2.stroke, 0.65, 'System 2 renders at 0.65pt base stroke');
  assert.ok(Math.abs(sys2Spur - ARCHITECTURAL_BRACKET_SPUR) < 0.015, 'System 2 reach matches base constant');
  assert.ok(Math.abs(sys2Spur - 3.0) < 0.015, 'System 2 reach is 3.0pt');

  // Assert exact deltas
  const strokeDelta = Number((b1.stroke - b2.stroke).toFixed(4));
  const spurDelta = Number((sys1Spur - sys2Spur).toFixed(4));
  assert.equal(strokeDelta, SYSTEM_1_BRACKET_STROKE_DELTA, 'stroke exceeds systems 2+ by delta (0.25pt)');
  assert.equal(SYSTEM_1_BRACKET_STROKE_DELTA, 0.25, 'delta constant is 0.25pt');
  assert.equal(spurDelta, SYSTEM_1_BRACKET_SPUR_DELTA, 'spur reach exceeds systems 2+ by delta (0.50pt)');

  // All intermediate systems 2..8 render the base metrics
  for (let s = 1; s < 8; s++) {
    const geo = getSystemGeometry(pageGeo, s);
    const svg = renderSystem(BACH, geo, s, DEFAULT_JANKO_OPTIONS, TOKENS);
    const b = parseBracket(svg);
    assert.equal(b.stroke, 0.65, `system ${s + 1} stroke is 0.65pt`);
    const spur = b.tipX - b.xTop;
    assert.ok(Math.abs(spur - 3.0) < 0.015, `system ${s + 1} reach is 3.0pt`);
  }
});

// ---------------------------------------------------------------------------
// 3. C4 weight pin
// ---------------------------------------------------------------------------

test('C4 weight pin: C4 line renders at 0.50pt equalized with core lines', () => {
  // 1. Under default fixed-3 golden (segmented semantics)
  const pageGeo = computePageGeometry(DEFAULT_JANKO_OPTIONS, TOKENS, BACH);
  const geo = getSystemGeometry(pageGeo, 0);

  // In segmented semantics, staff lines are queried via getBarStaffSegments:
  // C4 is constitutional anchor row 1 (lin 48)
  const bar0Segments = getBarStaffSegments(geo, 0);
  const c4Seg = bar0Segments.find((s) => s.lin === 48);
  assert.ok(c4Seg, 'C4 segment must be found in bar 0 via getBarStaffSegments');
  assert.equal(c4Seg.rowId, 1, 'C4 segment corresponds to constitutional anchor row 1');

  const rules = pitchGridRules(geo, DEFAULT_JANKO_OPTIONS, TOKENS);
  const c4 = geo.middleCY + continuousPitchY(48, TOKENS.semitoneScale);

  const c4Rules = rules.filter((r) => Math.abs(r.y - c4) < 1e-6);
  assert.ok(c4Rules.length > 0, 'C4 segment rule(s) must be present in fixed-3 grid');
  for (const c4Rule of c4Rules) {
    assert.equal(c4Rule.width, PITCH_GRID_C4_STROKE, 'C4 segment rule width matches PITCH_GRID_C4_STROKE');
    assert.equal(c4Rule.width, 0.50, 'C4 segment renders at locked 0.50pt weight');
  }

  const otherRules = rules.filter((r) => Math.abs(r.y - c4) >= 1e-6);
  assert.ok(otherRules.length >= 2, 'other staff line segments are present');
  for (const r of otherRules) {
    assert.equal(r.width, PITCH_GRID_OCTAVE_STROKE, 'other core lines and extensions render at 0.50pt');
    assert.equal(r.width, 0.50, 'other line segments are 0.50pt hairlines');
  }

  // 2. Under fixed-4: no C4 segment is drawn; all lines/segments are 0.50pt
  const f4Opts = resolveJankoOptions({ ...DEFAULT_JANKO_OPTIONS, core: 'fixed-4' });
  const f4PageGeo = computePageGeometry(f4Opts, TOKENS, BACH);
  const f4Geo = getSystemGeometry(f4PageGeo, 0);
  const f4Bar0Segments = getBarStaffSegments(f4Geo, 0);
  assert.ok(
    !f4Bar0Segments.some((s) => s.lin === 48),
    'fixed-4 has an open middle — no C4 segment is queried'
  );
  const f4Rules = pitchGridRules(f4Geo, f4Opts, TOKENS);
  assert.ok(
    !f4Rules.some((r) => Math.abs(r.y - (f4Geo.middleCY + continuousPitchY(48, TOKENS.semitoneScale))) < 1e-6),
    'fixed-4 has an open middle — no C4 line is drawn'
  );
  for (const r of f4Rules) {
    assert.equal(r.width, 0.50, 'all fixed-4 lines render at 0.50pt');
  }

  // 3. Under adaptive equal-boundaries: C4 line renders at 0.50pt, equalized with other boundaries
  const boundOpts = resolveJankoOptions({
    ...DEFAULT_JANKO_OPTIONS,
    core: 'adaptive',
    pitchMapping: 'continuous',
    octaveLineScheme: 'equal-boundaries',
  });
  const boundPageGeo = computePageGeometry(boundOpts, TOKENS, BACH);
  const boundGeo = getSystemGeometry(boundPageGeo, 0);
  const boundRules = pitchGridRules(boundGeo, boundOpts, TOKENS);
  const boundC4 = boundRules.find((r) => Math.abs(r.y - (boundGeo.middleCY + continuousPitchY(48, TOKENS.semitoneScale))) < 1e-6);
  assert.ok(boundC4, 'equal-boundaries draws C4');
  assert.equal(boundC4.width, 0.50, 'equal-boundaries weights C4 at 0.50pt');
  for (const r of boundRules.filter((r) => Math.abs(r.y - (boundGeo.middleCY + continuousPitchY(48, TOKENS.semitoneScale))) >= 1e-6)) {
    assert.equal(r.width, 0.50, 'other equal-boundaries lines render at 0.50pt');
  }
});

// ---------------------------------------------------------------------------
// 4. Weights constants pin
// ---------------------------------------------------------------------------

test('Weights constants: barline balance (0.90), System-1 bracket (0.90), System 2+ bracket (0.65), C4 weight (0.50)', () => {
  assert.equal(SYSTEM_1_ARCHITECTURAL_BRACKET_STROKE, 0.90, 'System 1 bracket is 0.90pt');
  assert.equal(ARCHITECTURAL_BRACKET_STROKE, 0.65, 'Systems 2+ bracket is 0.65pt');
  assert.equal(SYSTEM_1_BRACKET_STROKE_DELTA, 0.25, 'System 1 bracket delta is 0.25pt');
  assert.equal(PITCH_GRID_C4_STROKE, 0.50, 'C4 stroke is 0.50pt');
  assert.equal(PITCH_GRID_OCTAVE_STROKE, 0.50, 'Octave stroke is 0.50pt');
});

