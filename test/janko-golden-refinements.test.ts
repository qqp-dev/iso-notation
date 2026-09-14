/**
 * Golden Refinements: Durable Test Suite
 * =======================================
 *
 * Verifies the three locked golden master refinements:
 *  1. Start bracket marks the C3–C5 core triple across all systems
 *     (identical vertical pitch extent across 3-line, 4-line, and 5-line systems).
 *  2. System 1 bracket renders with slightly grander metrics (stroke +0.10pt,
 *     spur reach +0.50pt) while systems 2+ render the base 0.65pt mark.
 *  3. C4 octave line renders at 0.65pt against 0.50pt core hairlines wherever
 *     drawn (fixed-3, adaptive equal-boundaries), and no C4 line is drawn under fixed-4.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1';
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
  // Under measuresPerSystem: 2, Bach Goldberg Var. 1 contains systems with 3-line, 4-line, and 5-line bars
  const opts = resolveJankoOptions({ ...DEFAULT_JANKO_OPTIONS, measuresPerSystem: 2 });
  const pageGeo = computePageGeometry(opts, TOKENS, BACH);

  let sys3: { index: number; rows: number[]; lins: number[] } | null = null;
  let sys4: { index: number; rows: number[]; lins: number[] } | null = null;
  let sys5: { index: number; rows: number[]; lins: number[] } | null = null;

  for (let s = 0; s < 16; s++) {
    const geo = getSystemGeometry(pageGeo, s);
    const bar0Rows = getBarStaffRows(geo, 0);
    const bar0Segs = getBarStaffSegments(geo, 0);
    const bar0Lins = bar0Segs.map((seg) => seg.lin).sort((a, b) => a - b);
    if (bar0Rows.length === 3 && !sys3) sys3 = { index: s, rows: bar0Rows, lins: bar0Lins };
    if (bar0Rows.length === 4 && !sys4) sys4 = { index: s, rows: bar0Rows, lins: bar0Lins };
    if (bar0Rows.length === 5 && !sys5) sys5 = { index: s, rows: bar0Rows, lins: bar0Lins };
  }

  assert.ok(sys3, 'found sample 3-line bar Bach system');
  assert.ok(sys4, 'found sample 4-line bar Bach system');
  assert.ok(sys5, 'found sample 5-line bar Bach system');

  assert.deepEqual(sys3.rows, [1, 2, 3], '3-case bar: core rows {1, 2, 3}');
  assert.deepEqual(sys4.rows, [1, 2, 3, 4], '4-case bar: core rows plus row 4 (C6)');
  assert.deepEqual(sys5.rows, [1, 2, 3, 4, 5], '5-case bar: rows 1..5 (C2..C6)');

  assert.deepEqual(sys3.lins, [36, 48, 60], '3-case: core lines C3, C4, C5');
  assert.deepEqual(sys4.lins, [36, 48, 60, 72], '4-case: core lines plus C6 extension');
  assert.deepEqual(sys5.lins, [24, 36, 48, 60, 72], '5-case: C2 and C6 extensions');

  const expectedPitchExtent = 24 * TOKENS.semitoneScale; // 60.0pt (C3 lin 36 to C5 lin 60)

  for (const sample of [sys3, sys4, sys5]) {
    const geo = getSystemGeometry(pageGeo, sample.index);
    const svg = renderSystem(BACH, geo, sample.index, opts, TOKENS);
    const b = parseBracket(svg);

    const c5LineY = geo.middleCY + continuousPitchY(60, TOKENS.semitoneScale);
    const c3LineY = geo.middleCY + continuousPitchY(36, TOKENS.semitoneScale);

    // Spine anchors exactly to C5 and C3 pitch coordinates (within SVG rounding)
    assert.ok(
      Math.abs(b.yTop - c5LineY) < 0.015,
      `system ${sample.index + 1} (${sample.rows.length} rows in bar 0): top rule meets C5 line y`
    );
    assert.ok(
      Math.abs(b.yBot - c3LineY) < 0.015,
      `system ${sample.index + 1} (${sample.rows.length} rows in bar 0): bottom rule meets C3 line y`
    );

    const pitchExtent = b.yBot - b.yTop;
    assert.ok(
      Math.abs(pitchExtent - expectedPitchExtent) < 0.015,
      `system ${sample.index + 1} (${sample.rows.length} rows in bar 0): vertical extent equals exactly C3–C5 pitch extent (${expectedPitchExtent}pt)`
    );

    // Cap idiom: spurs flare diagonally outward by spur * tan(13°)
    const spur = sample.index === 0 ? SYSTEM_1_ARCHITECTURAL_BRACKET_SPUR : ARCHITECTURAL_BRACKET_SPUR;
    const expectedFlare = spur * ARCHITECTURAL_BRACKET_FLARE_TAN;
    assert.ok(
      Math.abs((b.yTop - b.tipY) - expectedFlare) < 0.015,
      `system ${sample.index + 1}: top spur flares upward beyond C5`
    );
    assert.ok(
      Math.abs((b.footY - b.yBot) - expectedFlare) < 0.015,
      `system ${sample.index + 1}: bottom spur flares downward beyond C3`
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
  assert.equal(b1.stroke, 0.75, 'System 1 renders at 0.75pt stroke');
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
  assert.equal(strokeDelta, SYSTEM_1_BRACKET_STROKE_DELTA, 'stroke exceeds systems 2+ by delta (0.10pt)');
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

test('C4 weight pin: C4 line renders at 0.65pt; other core lines at 0.50pt', () => {
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
    assert.equal(c4Rule.width, 0.65, 'C4 segment renders at locked 0.65pt weight');
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

  // 3. Under adaptive equal-boundaries: C4 line renders at 0.65pt, other boundaries at 0.50pt
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
  assert.equal(boundC4.width, 0.65, 'equal-boundaries weights C4 at 0.65pt');
  for (const r of boundRules.filter((r) => Math.abs(r.y - (boundGeo.middleCY + continuousPitchY(48, TOKENS.semitoneScale))) >= 1e-6)) {
    assert.equal(r.width, 0.50, 'other equal-boundaries lines render at 0.50pt');
  }
});
