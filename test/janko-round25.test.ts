/**
 * Octave-line schemes (Round 25): the grand grid's minimal staff.
 * ================================================================
 *
 * Pins the two equal line schemes against the shipped divider grid:
 *
 * - scheme geometry (centers at 12N+5.5, boundaries at 12N, divider set),
 * - no-privilege (every equal-scheme line shares one ink and one weight),
 * - the painter (classes, strokes, divider presence/absence per scheme),
 * - the margin labels (bare octave digits on centers, C-labels elsewhere),
 * - the drawn-rule mirror (`drawnStaffRuleYs` equals the painter's set),
 * - paint truth (the linter audits the lines the SVG actually shows),
 * - the linter verdict (every Round 25 card clean on the full score).
 *
 * Corpus pins use the Bach Goldberg Var. 1 benchmark; the rest-duration
 * specimen pins the slab audits where Bach has no bar rest to offer.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1';
import { buildRestDurationSpecimenScore } from '../src/scores/rest-duration-specimen';
import {
  computePageGeometry,
  drawnStaffRuleYs,
  getSystemGeometry,
  layoutJankoSystem,
  renderSystem,
} from '../src/render/janko/engine';
import {
  PITCH_GRID_C_LINE_INK,
  PITCH_GRID_C_LINE_STROKE,
  PITCH_GRID_DIVIDER_INK,
  PITCH_GRID_DIVIDER_STROKE,
  PITCH_GRID_OCTAVE_INK,
  PITCH_GRID_OCTAVE_STROKE,
  PITCH_GRID_C4_STROKE,
  PitchGridRule,
  pitchGridRules,
  renderPitchLabels,
} from '../src/render/janko/elements/staff';
import { lintJankoScore } from '../src/render/janko/linter';
import { DEFAULT_PITCH_WINDOW, continuousPitchY } from '../src/render/janko/geometry';
import {
  DEFAULT_JANKO_OPTIONS,
  DEFAULT_JANKO_TOKENS,
  JANKO_OCTAVE_LINE_SCHEMES,
  JankoOctaveLineScheme,
  resolveJankoOptions,
  resolveJankoTokens,
} from '../src/render/janko/types';

const SCORE = buildBachGoldbergVar1Score();

function continuousOptions(scheme: JankoOctaveLineScheme) {
  return resolveJankoOptions({ ...DEFAULT_JANKO_OPTIONS, core: 'adaptive', pitchMapping: 'continuous', octaveLineScheme: scheme });
}

function systemZero(scheme: JankoOctaveLineScheme) {
  const o = continuousOptions(scheme);
  const t = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
  return { o, t, geo: getSystemGeometry(computePageGeometry(o, t, SCORE), 0) };
}

/** Painted pitch-grid lines of one system render: class, y, ink, width. */
function paintedGridLines(svg: string): Array<{ cls: string; y: number; ink: string; width: number }> {
  const out: Array<{ cls: string; y: number; ink: string; width: number }> = [];
  const re =
    /<line class="([^"]*)" x1="[\d.]+" y1="([\d.]+)"[^>]*stroke="([^"]*)" stroke-width="([\d.]+)"\/>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(svg)) !== null) {
    if (!match[1].includes('janko-pitch-')) continue;
    out.push({ cls: match[1], y: Number(match[2]), ink: match[3], width: Number(match[4]) });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 1. Scheme geometry
// ---------------------------------------------------------------------------

test('The scheme enum carries the divider grid, the equal schemes, and the clef tick', () => {
  assert.deepEqual(
    [...JANKO_OCTAVE_LINE_SCHEMES],
    ['grand-divider', 'equal-centers', 'equal-boundaries', 'clef-marker'],
    'canonical exploration order'
  );
  assert.equal(
    resolveJankoOptions(DEFAULT_JANKO_OPTIONS).octaveLineScheme,
    'grand-divider',
    'the divider grid is the default scheme'
  );
});

test('Twin rows have no pitch-grid rules: the equators are not grid lines', () => {
  const o = resolveJankoOptions({ ...DEFAULT_JANKO_OPTIONS, core: 'adaptive' });
  const t = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
  const geo = getSystemGeometry(computePageGeometry(o, t, SCORE), 0);
  assert.deepEqual(pitchGridRules(geo, o, t), [], 'empty under twin-rows');
});

test('Grand divider: the dark spine first, then ascending faint C-lines', () => {
  const { o, t, geo } = systemZero('grand-divider');
  const rules = pitchGridRules(geo, o, t);
  assert.ok(rules.length >= 2, 'divider plus at least one C-line');
  const [divider, ...clines] = rules;
  assert.equal(divider.y, geo.middleCY, 'the divider sits exactly on Middle C');
  assert.equal(divider.width, PITCH_GRID_DIVIDER_STROKE, '0.65pt anchor');
  assert.equal(divider.ink, PITCH_GRID_DIVIDER_INK, 'dark spine ink');
  assert.equal(divider.cls, 'janko-pitch-divider', 'divider class');
  const window = geo.pitchWindow ?? DEFAULT_PITCH_WINDOW;
  const expected = [];
  for (let lin = window.min; lin <= window.max; lin++) {
    if (lin % 12 !== 0) continue;
    const y = geo.middleCY + continuousPitchY(lin, t.semitoneScale);
    if (Math.abs(y - geo.middleCY) < 2.0) continue;
    expected.push(y);
  }
  assert.deepEqual(
    clines.map((r) => r.y),
    expected,
    'one C-line per in-window C outside the divider exclusion'
  );
  for (const cline of clines) {
    assert.equal(cline.width, PITCH_GRID_C_LINE_STROKE, '0.35pt C-lines');
    assert.equal(cline.ink, PITCH_GRID_C_LINE_INK, 'faint C-line ink');
    assert.equal(cline.cls, 'janko-pitch-lane janko-pitch-clane', 'C-lane classes');
  }
  assert.ok(
    !rules.some((r) => r.cls !== 'janko-pitch-divider' && Math.abs(r.y - geo.middleCY) < 2.0),
    'no other rule enters the divider exclusion'
  );
});

test('Equal centers: golden hairlines at the octave middles, no divider', () => {
  const { o, t, geo } = systemZero('equal-centers');
  const rules = pitchGridRules(geo, o, t);
  assert.ok(rules.length >= 2, 'at least two octave middles');
  const window = geo.pitchWindow ?? DEFAULT_PITCH_WINDOW;
  const expected: number[] = [];
  for (let n = Math.floor(window.min / 12); n <= Math.floor(window.max / 12); n++) {
    const c = n * 12 + 5.5;
    if (c < window.min || c > window.max) continue;
    expected.push(geo.middleCY + continuousPitchY(c, t.semitoneScale));
  }
  assert.deepEqual(
    rules.map((r) => r.y),
    expected,
    'one middle per in-window octave, ascending'
  );
  for (const rule of rules) {
    assert.equal(rule.width, PITCH_GRID_OCTAVE_STROKE, '0.50pt golden weight');
    assert.equal(rule.ink, PITCH_GRID_OCTAVE_INK, 'golden equator ink');
    assert.equal(rule.cls, 'janko-pitch-octave', 'octave class');
  }
  assert.ok(!rules.some((r) => Math.abs(r.y - geo.middleCY) < 1e-9), 'no divider drawn');
});

test('Equal boundaries: golden hairlines at the C boundaries, C4 included', () => {
  const { o, t, geo } = systemZero('equal-boundaries');
  const rules = pitchGridRules(geo, o, t);
  assert.ok(rules.length >= 2, 'at least two C boundaries');
  const window = geo.pitchWindow ?? DEFAULT_PITCH_WINDOW;
  const expected: number[] = [];
  for (let c = Math.ceil(window.min / 12) * 12; c <= window.max; c += 12) {
    expected.push(geo.middleCY + continuousPitchY(c, t.semitoneScale));
  }
  assert.deepEqual(
    rules.map((r) => r.y),
    expected,
    'one boundary per in-window C, ascending'
  );
  const c4 = geo.middleCY + continuousPitchY(48, t.semitoneScale);
  for (const rule of rules) {
    const isC4 = Math.abs(rule.y - c4) < 1e-9;
    assert.equal(
      rule.width,
      isC4 ? PITCH_GRID_C4_STROKE : PITCH_GRID_OCTAVE_STROKE,
      isC4 ? '0.65pt C4 anchor weight' : '0.50pt golden weight'
    );
    assert.equal(rule.ink, PITCH_GRID_OCTAVE_INK, 'golden equator ink');
    assert.equal(rule.cls, 'janko-pitch-lane janko-pitch-clane', 'C-lane classes');
  }
  assert.ok(
    rules.some((r) => Math.abs(r.y - c4) < 1e-9),
    'the C4 line stands — with no divider there is nothing to defer to'
  );
  assert.equal(c4, geo.middleCY, 'the C4 line stands exactly on Middle C');
  assert.ok(
    !rules.some((r) => r.cls === 'janko-pitch-divider'),
    'no divider drawn'
  );
});

test('Weights: centers keep one weight; boundaries weight C4 at 0.65pt', () => {
  const centers = systemZero('equal-centers');
  const centerRules = pitchGridRules(centers.geo, centers.o, centers.t);
  assert.deepEqual(
    [...new Set(centerRules.map((r) => r.width))],
    [PITCH_GRID_OCTAVE_STROKE],
    'equal-centers: one weight'
  );
  assert.deepEqual(
    [...new Set(centerRules.map((r) => r.ink))],
    [PITCH_GRID_OCTAVE_INK],
    'equal-centers: one ink'
  );

  const boundaries = systemZero('equal-boundaries');
  const boundaryRules = pitchGridRules(boundaries.geo, boundaries.o, boundaries.t);
  assert.deepEqual(
    [...new Set(boundaryRules.map((r) => r.width))].sort(),
    [...new Set([PITCH_GRID_OCTAVE_STROKE, PITCH_GRID_C4_STROKE])].sort(),
    'equal-boundaries: 0.50pt hairlines with equalized C4 anchor'
  );
  assert.deepEqual(
    [...new Set(boundaryRules.map((r) => r.ink))],
    [PITCH_GRID_OCTAVE_INK],
    'equal-boundaries: one ink'
  );
});

// ---------------------------------------------------------------------------
// 2. Labels
// ---------------------------------------------------------------------------

test('Centers carry bare octave digits; every other grid carries C-labels', () => {
  const centers = systemZero('equal-centers');
  const labels = renderPitchLabels(centers.geo, centers.o, centers.t);
  const window = centers.geo.pitchWindow ?? DEFAULT_PITCH_WINDOW;
  const octaves: number[] = [];
  for (let n = Math.floor(window.min / 12); n <= Math.floor(window.max / 12); n++) {
    const c = n * 12 + 5.5;
    if (c < window.min || c > window.max) continue;
    octaves.push(n);
  }
  for (const n of octaves) {
    assert.match(labels, new RegExp(`>${n}<`), `octave ${n} is labelled with its digit`);
  }
  assert.ok(!labels.includes('>C'), 'no C-label under equal-centers');
  for (const scheme of ['grand-divider', 'equal-boundaries', 'clef-marker'] as const) {
    const s = systemZero(scheme);
    const clabels = renderPitchLabels(s.geo, s.o, s.t);
    assert.match(clabels, />C\d</, `${scheme} labels its C boundaries`);
  }
  const boundaries = systemZero('equal-boundaries');
  assert.match(
    renderPitchLabels(boundaries.geo, boundaries.o, boundaries.t),
    />C4</,
    'the C4 landmark stands under equal-boundaries'
  );
});

// ---------------------------------------------------------------------------
// 3. The drawn-rule mirror and paint truth
// ---------------------------------------------------------------------------

test('drawnStaffRuleYs equals the painter’s own line set under every scheme', () => {
  for (const scheme of JANKO_OCTAVE_LINE_SCHEMES) {
    const { o, t, geo } = systemZero(scheme);
    assert.deepEqual(
      drawnStaffRuleYs(geo, o, t),
      pitchGridRules(geo, o, t)
        .map((r) => r.y)
        .sort((a, b) => a - b),
      `${scheme}: the mirror cannot drift`
    );
  }
});

test('Paint truth: the linter audits the lines the SVG actually shows', () => {
  for (const scheme of JANKO_OCTAVE_LINE_SCHEMES) {
    const o = continuousOptions(scheme);
    const t = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
    const page = computePageGeometry(o, t, SCORE);
    const geo = getSystemGeometry(page, 0);
    const svg = renderSystem(SCORE, geo, 0, o, t);
    const painted = paintedGridLines(svg);
    const rules: PitchGridRule[] = pitchGridRules(geo, o, t);
    assert.equal(painted.length, rules.length, `${scheme}: every rule is painted, none extra`);
    for (let i = 0; i < rules.length; i++) {
      assert.equal(painted[i].cls, rules[i].cls, `${scheme} rule ${i}: class`);
      assert.ok(Math.abs(painted[i].y - rules[i].y) < 0.015, `${scheme} rule ${i}: y`);
      assert.equal(painted[i].ink, rules[i].ink, `${scheme} rule ${i}: ink`);
      assert.ok(Math.abs(painted[i].width - rules[i].width) < 1e-9, `${scheme} rule ${i}: width`);
    }
  }
});

test('The equal schemes paint no divider anywhere in the system', () => {
  for (const scheme of ['equal-centers', 'equal-boundaries'] as const) {
    const o = continuousOptions(scheme);
    const t = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
    const page = computePageGeometry(o, t, SCORE);
    const svg = renderSystem(SCORE, getSystemGeometry(page, 0), 0, o, t);
    assert.ok(!svg.includes('janko-pitch-divider'), `${scheme}: no divider class in the ink`);
  }
  const control = continuousOptions('grand-divider');
  const tc = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
  const svg = renderSystem(SCORE, getSystemGeometry(computePageGeometry(control, tc, SCORE), 0), 0, control, tc);
  assert.ok(svg.includes('janko-pitch-divider'), 'the control keeps its divider');
});

// ---------------------------------------------------------------------------
// 4. The linter verdict
// ---------------------------------------------------------------------------

test('Every Round 25 card is clean on the full Bach score', () => {
  for (const scheme of JANKO_OCTAVE_LINE_SCHEMES) {
    const report = lintJankoScore(SCORE, continuousOptions(scheme), DEFAULT_JANKO_TOKENS);
    assert.equal(report.violations.length, 0, `${scheme}: zero violations`);
    assert.equal(report.warnings.length, 0, `${scheme}: zero warnings`);
    assert.ok(report.ok, `${scheme}: the chip reads clean`);
  }
});

test('Corridor honesty: the middle’s own rule is the spine, whatever it is', () => {
  // Under equal-boundaries the C4 line stands exactly on Middle C; the audit
  // reads it as the middle's own rule and clears the rest. Under
  // equal-centers no rule stands at the middle, so there is no corridor.
  // Either way a phantom rule-set would flag an intrusion.
  for (const scheme of ['equal-boundaries', 'equal-centers', 'clef-marker'] as const) {
    const report = lintJankoScore(SCORE, continuousOptions(scheme), DEFAULT_JANKO_TOKENS);
    assert.ok(
      !report.violations.some((v) => v.code === 'corridor-intrusion'),
      `${scheme}: the middle reads clean`
    );
  }
});

test('Slab honesty: grand bar rests touch drawn lines exactly', () => {
  const specimen = buildRestDurationSpecimenScore();
  for (const scheme of JANKO_OCTAVE_LINE_SCHEMES) {
    const report = lintJankoScore(specimen, continuousOptions(scheme), DEFAULT_JANKO_TOKENS);
    assert.ok(
      !report.violations.some((v) => v.code === 'rest-slab-off-line'),
      `${scheme}: every slab touches its drawn line`
    );
  }
});

test('Bar-4 regression: the tick-552 rest seats on the Middle C line between the 9 and the 0, not mid-air', () => {
  const o = continuousOptions('grand-divider');
  const t = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
  const page = computePageGeometry(o, t, SCORE);
  const layout = layoutJankoSystem(SCORE, page, 0, o, t);
  const rest = layout.rests.find((r) => r.tick === 552)!;
  const geo = getSystemGeometry(page, 0);
  const rules = drawnStaffRuleYs(geo, o, t);
  assert.ok(rules.includes(rest.y), 'the seat is a drawn line');
  const c4 = geo.middleCY + continuousPitchY(48, t.semitoneScale);
  assert.ok(Math.abs(rest.y - c4) < 1e-9, `the seat is the Middle C line (y=${rest.y.toFixed(2)})`);
});

