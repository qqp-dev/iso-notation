/**
 * Need-Based Rows — Per-Bar Line Sets with Row-1 Anchor (Round 27 Generalization)
 * ==============================================================================
 *
 * Durable maintained test suite verifying:
 *  1. Bar-4 pin: Bach Goldberg Var. 1 Bar 4 renders EXACTLY rows {5, 3, 1} (lin 24, 36, 48).
 *     Row 2 is silent because its max note is 6/4 (54), which ties inward (54 > 54 is false).
 *  2. Midpoint tie-break fixtures: notes at 54, 42, 66, 30 break strictly inward.
 *  3. Property pins: for all bars of Bach and Brahms under fixed-3, Row 1 is always present,
 *     and line sets are center-connected with zero gaps. Under fixed-4, the central pair
 *     is always present and line sets are center-connected.
 *  4. Rest-bar pin: a rest-only bar renders Row 1 alone with the rest on Middle C.
 *  5. Segments pin: non-consecutive earning bars render disjoint unbroken segments.
 *  6. Folds invariant: Brahms 9 under fixed-3, 1 under fixed-4, Bach 0.
 *  7. Byte-identity: janko.html <-> public/janko.html.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1';
import {
  buildBrahmsOp118No1Score,
  BRAHMS_OP118_NO1_JANKO_OPTIONS,
  BRAHMS_OP118_NO1_JANKO_TOKENS,
} from '../src/scores/brahms-op118-no1';
import {
  DEFAULT_JANKO_OPTIONS,
  DEFAULT_JANKO_TOKENS,
  resolveJankoOptions,
  resolveJankoTokens,
} from '../src/render/janko/types';
import {
  computeBarStaffRows,
  computeSystemStaffSegments,
  getBarStaffRows,
  getBarStaffSegments,
  layoutJankoScore,
} from '../src/render/janko/engine';
import { lintJankoScore } from '../src/render/janko/linter';
import { QuantizedGridScore, QuantizedNote } from '../src/model/types';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..');

const BACH = buildBachGoldbergVar1Score();
const BRAHMS = buildBrahmsOp118No1Score();

function makeNote(
  id: string,
  pitchClass: number,
  octave: number,
  startTick: number,
  durationTicks: number = 48,
  hand: 'RH' | 'LH' = 'RH'
): QuantizedNote {
  return { id, pitch: { pitchClass, octave }, startTick, durationTicks, hand };
}

function makeScore(id: string, notes: QuantizedNote[], ticksPerMeasure = 144): QuantizedGridScore {
  return {
    id,
    title: id,
    composer: 'test',
    ticksPerBeat: 48,
    totalTicks: ticksPerMeasure * 4,
    timeSignatures: [{ tick: 0, numerator: 3, denominator: 4 }],
    barlines: [],
    tempos: [],
    dynamics: [],
    pedals: [],
    notes,
  };
}

// ---------------------------------------------------------------------------
// 1. Bar-4 Pin
// ---------------------------------------------------------------------------

test('Bar-4 Pin: Bach Var. 1 Bar 4 renders EXACTLY rows {5, 3, 1} (lin 24, 36, 48)', () => {
  const o = resolveJankoOptions(DEFAULT_JANKO_OPTIONS);
  const t = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
  const layouts = layoutJankoScore(BACH, o, t);

  // System 0 contains bars 1..4 (system-local measure indices 0..3)
  const sys0 = layouts[0];
  const bar4Index = 3; // 0-based index of Bar 4 in System 0

  const rows = getBarStaffRows(sys0.geometry, bar4Index);
  // Row IDs: 1 (lin 48), 3 (lin 36), 5 (lin 24)
  assert.deepEqual(rows, [1, 3, 5], 'Bar 4 must render exactly rows {1, 3, 5}');

  const segments = getBarStaffSegments(sys0.geometry, bar4Index);
  const lins = segments.map((s) => s.lin).sort((a, b) => a - b);
  assert.deepEqual(lins, [24, 36, 48], 'Bar 4 must draw lines strictly at lin 24, 36, 48');

  // Verify that row 2 (lin 60) and row 4 (lin 72) are silent in Bar 4
  assert.ok(!rows.includes(2), 'Row 2 (above, 0/5) must be silent in Bar 4');
  assert.ok(!rows.includes(4), 'Row 4 (outer-above, 0/6) must be silent in Bar 4');
});

// ---------------------------------------------------------------------------
// 2. Midpoint Tie-Break Fixtures
// ---------------------------------------------------------------------------

test('Midpoint Tie-Break Fixtures: notes at 54, 42, 66, 30 break strictly inward', () => {
  // Fixed-3:
  // Row 2 (60) fires iff lin > 54:
  assert.deepEqual(computeBarStaffRows([54], 'fixed-3').rowIds, [1], 'lin 54 (6/4) does NOT fire row 2');
  assert.deepEqual(computeBarStaffRows([55], 'fixed-3').rowIds, [1, 2], 'lin 55 fires row 2');

  // Row 3 (36) fires iff lin < 42:
  assert.deepEqual(computeBarStaffRows([42], 'fixed-3').rowIds, [1], 'lin 42 (6/3) does NOT fire row 3');
  assert.deepEqual(computeBarStaffRows([41], 'fixed-3').rowIds, [1, 3], 'lin 41 fires row 3');

  // Row 4 (72) fires iff lin > 66:
  assert.deepEqual(computeBarStaffRows([66], 'fixed-3').rowIds, [1, 2], 'lin 66 (6/5) fires row 2 but NOT row 4');
  assert.deepEqual(computeBarStaffRows([67], 'fixed-3').rowIds, [1, 2, 4], 'lin 67 fires rows 2 and 4');

  // Row 5 (24) fires iff lin < 30:
  assert.deepEqual(computeBarStaffRows([30], 'fixed-3').rowIds, [1, 3], 'lin 30 (6/2) fires row 3 but NOT row 5');
  assert.deepEqual(computeBarStaffRows([29], 'fixed-3').rowIds, [1, 3, 5], 'lin 29 fires rows 3 and 5');
});

// ---------------------------------------------------------------------------
// 3. Property Pins: All bars in Bach and Brahms are anchor-anchored & center-connected
// ---------------------------------------------------------------------------

test('Property Pin (fixed-3): Row 1 always present and sets are center-connected in all bars of Bach and Brahms', () => {
  for (const [score, options, tokens, label] of [
    [BACH, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS, 'Bach'],
    [BRAHMS, { ...BRAHMS_OP118_NO1_JANKO_OPTIONS, core: 'fixed-3' as const }, BRAHMS_OP118_NO1_JANKO_TOKENS, 'Brahms'],
  ] as const) {
    const o = resolveJankoOptions(options);
    const t = resolveJankoTokens(tokens);
    const layouts = layoutJankoScore(score, o, t);

    for (const sys of layouts) {
      const numBars = sys.geometry.measuresPerSystem;
      for (let m = 0; m < numBars; m++) {
        const rows = getBarStaffRows(sys.geometry, m);
        assert.ok(
          rows.includes(1),
          `${label} sys ${sys.index} m ${m}: Row 1 (Middle C) must always be present (got ${rows.join(',')})`
        );
        // Center-connectedness:
        // row 4 requires row 2
        if (rows.includes(4)) {
          assert.ok(rows.includes(2), `${label} sys ${sys.index} m ${m}: Row 4 requires Row 2`);
        }
        // row 5 requires row 3
        if (rows.includes(5)) {
          assert.ok(rows.includes(3), `${label} sys ${sys.index} m ${m}: Row 5 requires Row 3`);
        }
      }
    }
  }
});

test('Property Pin (fixed-4): Central pair always present and sets are center-connected in all bars of Brahms', () => {
  const o = resolveJankoOptions({ ...BRAHMS_OP118_NO1_JANKO_OPTIONS, core: 'fixed-4' });
  const t = resolveJankoTokens(BRAHMS_OP118_NO1_JANKO_TOKENS);
  const layouts = layoutJankoScore(BRAHMS, o, t);

  for (const sys of layouts) {
    const numBars = sys.geometry.measuresPerSystem;
    for (let m = 0; m < numBars; m++) {
      const rows = getBarStaffRows(sys.geometry, m);
      assert.ok(
        rows.includes(1) && rows.includes(2),
        `Brahms fixed-4 sys ${sys.index} m ${m}: Central pair (rows 1 & 2) must always be present (got ${rows.join(',')})`
      );
      // Center-connectedness:
      if (rows.includes(5)) {
        assert.ok(rows.includes(3), `Brahms fixed-4 sys ${sys.index} m ${m}: Row 5 requires Row 3`);
      }
      if (rows.includes(6)) {
        assert.ok(rows.includes(4), `Brahms fixed-4 sys ${sys.index} m ${m}: Row 6 requires Row 4`);
      }
    }
  }
});

// ---------------------------------------------------------------------------
// 4. Rest-Bar Pin: Rest-only bar renders Row 1 alone with rest on Middle C
// ---------------------------------------------------------------------------

test('Rest-Bar Pin: Rest-only bar renders Row 1 alone with rest on Middle C', () => {
  // Synthetic 4/4 score: Bar 0 has notes in octave 4 (within 6/3..6/4, so row 1 alone),
  // Bar 1 is completely silent (whole-bar rest of 192 ticks),
  // Bar 2 resumes with a note in octave 4.
  const restScore: QuantizedGridScore = {
    id: 'synthetic-rest-bar',
    title: 'synthetic-rest-bar',
    composer: 'test',
    ticksPerBeat: 48,
    totalTicks: 192 * 3,
    timeSignatures: [{ tick: 0, numerator: 4, denominator: 4 }],
    barlines: [],
    tempos: [],
    dynamics: [],
    pedals: [],
    notes: [
      makeNote('n1', 0, 4, 0, 192),    // C4 (lin 48) covering Bar 0
      makeNote('n2', 4, 4, 384, 192),  // E4 (lin 52) in Bar 2
    ],
  };

  const o = resolveJankoOptions({ ...DEFAULT_JANKO_OPTIONS, core: 'fixed-3', ticksPerMeasure: 192, measuresPerSystem: 3 });
  const t = resolveJankoTokens({ ticksPerMeasure: 192 });
  const layouts = layoutJankoScore(restScore, o, t);
  const sys = layouts[0];

  // Bar 1 has no notes -> row 1 alone
  const bar1Rows = getBarStaffRows(sys.geometry, 1);
  assert.deepEqual(bar1Rows, [1], 'Rest-only bar renders Row 1 alone');

  // Verify the whole rest is placed and touches the Middle C line
  const bar1Rest = sys.rests.find((r) => r.tick === 192 && r.value === 'whole');
  assert.ok(bar1Rest, 'Whole rest generated for empty bar 1');
  assert.ok(Math.abs(bar1Rest.y - sys.geometry.middleCY) < 0.05, 'Rest seats on Middle C rule');

  // Visual linter is green
  const report = lintJankoScore(restScore, o, t);
  assert.equal(report.ok, true, 'Rest-only bar score lints completely clean');
});

// ---------------------------------------------------------------------------
// 5. Segments Pin: Non-consecutive earning bars render disjoint unbroken segments
// ---------------------------------------------------------------------------

test('Segments Pin: Non-consecutive earning bars render disjoint unbroken segments', () => {
  // Synthetic 4-bar score:
  // Bar 0: high note lin 70 (earns Row 2)
  // Bar 1: middle note lin 48 (silent for Row 2)
  // Bar 2: high note lin 70 (earns Row 2)
  // Bar 3: middle note lin 48 (silent for Row 2)
  const score = makeScore('disjoint-segments', [
    makeNote('n0', 10, 5, 0),    // lin 70 in bar 0
    makeNote('n1', 0, 4, 144),   // lin 48 in bar 1
    makeNote('n2', 10, 5, 288),  // lin 70 in bar 2
    makeNote('n3', 0, 4, 432),   // lin 48 in bar 3
  ]);

  const o = resolveJankoOptions({ ...DEFAULT_JANKO_OPTIONS, measuresPerSystem: 4 });
  const t = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
  const layouts = layoutJankoScore(score, o, t);
  const sys = layouts[0];

  const segments = sys.geometry.staffSegments ?? [];
  const row2Segments = segments.filter((s) => s.rowId === 2);

  // Must have exactly two disjoint segments for Row 2: [0..0] and [2..2]
  assert.equal(row2Segments.length, 2, 'Row 2 renders exactly two disjoint unbroken segments');
  assert.equal(row2Segments[0].mStart, 0);
  assert.equal(row2Segments[0].mEnd, 0);
  assert.equal(row2Segments[1].mStart, 2);
  assert.equal(row2Segments[1].mEnd, 2);

  // Row 1 is unbroken across the whole system [0..3]
  const row1Segments = segments.filter((s) => s.rowId === 1);
  assert.equal(row1Segments.length, 1, 'Row 1 is constitutional anchor spanning the whole system');
  assert.equal(row1Segments[0].mStart, 0);
  assert.equal(row1Segments[0].mEnd, 3);
  assert.equal(row1Segments[0].x1, sys.geometry.staffLeft);
  assert.equal(row1Segments[0].x2, sys.geometry.staffRight);
});

// ---------------------------------------------------------------------------
// 6. Folds Invariant (9/1 on Brahms, 0 on Bach)
// ---------------------------------------------------------------------------

test('Folds Invariant: Brahms 9 under fixed-3, 1 under fixed-4, Bach 0', () => {
  const t = resolveJankoTokens(BRAHMS_OP118_NO1_JANKO_TOKENS);

  const f3Opts = resolveJankoOptions({ ...BRAHMS_OP118_NO1_JANKO_OPTIONS, core: 'fixed-3' });
  const f3Brahms = layoutJankoScore(BRAHMS, f3Opts, t);
  const f3Folded = f3Brahms.flatMap((s) => s.notes).filter((n) => n.ottavaShift !== undefined);
  assert.equal(f3Folded.length, 9, 'Brahms fixed-3 fold count holds at exactly 9');

  const f4Opts = resolveJankoOptions({ ...BRAHMS_OP118_NO1_JANKO_OPTIONS, core: 'fixed-4' });
  const f4Brahms = layoutJankoScore(BRAHMS, f4Opts, t);
  const f4Folded = f4Brahms.flatMap((s) => s.notes).filter((n) => n.ottavaShift !== undefined);
  assert.equal(f4Folded.length, 1, 'Brahms fixed-4 fold count holds at exactly 1');

  const bachLayouts = layoutJankoScore(BACH, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
  const bachFolded = bachLayouts.flatMap((s) => s.notes).filter((n) => n.ottavaShift !== undefined);
  assert.equal(bachFolded.length, 0, 'Bach fold count holds at 0');
});

// ---------------------------------------------------------------------------
// 7. Byte-identity between janko.html and public/janko.html
// ---------------------------------------------------------------------------

test('janko.html <-> public/janko.html byte-identical', () => {
  const rootHtml = fs.readFileSync(path.join(REPO_ROOT, 'janko.html'));
  const pubHtml = fs.readFileSync(path.join(REPO_ROOT, 'public/janko.html'));
  assert.ok(rootHtml.equals(pubHtml), 'janko.html and public/janko.html must be byte-identical');
});
