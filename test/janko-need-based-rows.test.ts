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
  computePageGeometry,
  computeSystemStaffSegments,
  countJankoSystems,
  getBarStaffRows,
  getBarStaffSegments,
  getSystemGeometry,
  getTickColumnX,
  layoutJankoScore,
  layoutJankoSystem,
  renderSystem,
} from '../src/render/janko/engine';
import { gridBotY, gridTopY } from '../src/render/janko/elements/barlines';
import { continuousPitchY } from '../src/render/janko/geometry';
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

test('Bar-4 Pin: Bach Var. 1 Bar 4 renders EXACTLY rows {3, 1} (lin 36, 48)', () => {
  const o = resolveJankoOptions(DEFAULT_JANKO_OPTIONS);
  const t = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
  const layouts = layoutJankoScore(BACH, o, t);

  // System 0 contains bars 1..4 (system-local measure indices 0..3)
  const sys0 = layouts[0];
  const bar4Index = 3; // 0-based index of Bar 4 in System 0

  const rows = getBarStaffRows(sys0.geometry, bar4Index);
  // Row IDs: 1 (lin 48), 3 (lin 36)
  assert.deepEqual(rows, [1, 3], 'Bar 4 must render exactly rows {1, 3}');

  const segments = getBarStaffSegments(sys0.geometry, bar4Index);
  const lins = segments.map((s) => s.lin).sort((a, b) => a - b);
  assert.deepEqual(lins, [36, 48], 'Bar 4 must draw lines strictly at lin 36, 48');

  // Verify that row 2 (lin 60), row 4 (lin 72), and row 5 (lin 24) are silent in Bar 4
  assert.ok(!rows.includes(2), 'Row 2 (above, 0/5) must be silent in Bar 4');
  assert.ok(!rows.includes(4), 'Row 4 (outer-above, 0/6) must be silent in Bar 4');
  assert.ok(!rows.includes(5), 'Row 5 (outer-below, 0/2) must be silent in Bar 4');
});

// ---------------------------------------------------------------------------
// 2. Bar-3 Pin
// ---------------------------------------------------------------------------

test('Bar-3 Pin: Bach Var. 1 Bar 3 renders EXACTLY rows {1, 2, 3} (lin 36, 48, 60)', () => {
  const o = resolveJankoOptions(DEFAULT_JANKO_OPTIONS);
  const t = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
  const layouts = layoutJankoScore(BACH, o, t);

  // System 0 contains bars 1..4 (system-local measure indices 0..3)
  const sys0 = layouts[0];
  const bar3Index = 2; // 0-based index of Bar 3 in System 0

  const rows = getBarStaffRows(sys0.geometry, bar3Index);
  // Extremes 7/5=67 (>= 60, < 72), 4/2=28 (<= 36, > 24) -> {0/3, 0/4, 0/5}
  assert.deepEqual(rows, [1, 2, 3], 'Bar 3 must render exactly rows {1, 2, 3}');

  const segments = getBarStaffSegments(sys0.geometry, bar3Index);
  const lins = segments.map((s) => s.lin).sort((a, b) => a - b);
  assert.deepEqual(lins, [36, 48, 60], 'Bar 3 must draw lines strictly at lin 36, 48, 60');

  // Both outer rows are gone under strict thresholds
  assert.ok(!rows.includes(4), 'Row 4 (outer-above, 0/6) must be silent in Bar 3');
  assert.ok(!rows.includes(5), 'Row 5 (outer-below, 0/2) must be silent in Bar 3');
});

// ---------------------------------------------------------------------------
// 3. Strict Row Boundary Pins
// ---------------------------------------------------------------------------

test('Strict Row Boundary Pins: inclusive fire at 60, 36, 72, 24; single line inside (36, 60); fixed-4 analogue', () => {
  // Fixed-3:
  // Row 2 (60, 0/5) fires iff max >= 60:
  assert.deepEqual(computeBarStaffRows([59], 'fixed-3').rowIds, [1], 'lin 59 does NOT fire row 2');
  assert.deepEqual(computeBarStaffRows([60], 'fixed-3').rowIds, [1, 2], 'lin 60 fires row 2');

  // Row 3 (36, 0/3) fires iff min <= 36:
  assert.deepEqual(computeBarStaffRows([37], 'fixed-3').rowIds, [1], 'lin 37 does NOT fire row 3');
  assert.deepEqual(computeBarStaffRows([36], 'fixed-3').rowIds, [1, 3], 'lin 36 fires row 3');

  // Row 4 (72, 0/6) fires iff max >= 72:
  assert.deepEqual(computeBarStaffRows([71], 'fixed-3').rowIds, [1, 2], 'lin 71 does NOT fire row 4');
  assert.deepEqual(computeBarStaffRows([72], 'fixed-3').rowIds, [1, 2, 4], 'lin 72 fires row 4');

  // Row 5 (24, 0/2) fires iff min <= 24:
  assert.deepEqual(computeBarStaffRows([25], 'fixed-3').rowIds, [1, 3], 'lin 25 does NOT fire row 5');
  assert.deepEqual(computeBarStaffRows([24], 'fixed-3').rowIds, [1, 3, 5], 'lin 24 fires row 5');

  // Single-line bar case: all notes strictly inside (0/3, 0/5) -> anchor only
  assert.deepEqual(computeBarStaffRows([40, 50], 'fixed-3').rowIds, [1], 'notes strictly between 36 and 60 draw center 0/4 alone');
  assert.deepEqual(computeBarStaffRows([48], 'fixed-3').rowIds, [1], 'single Middle C note draws center 0/4 alone');
  assert.deepEqual(computeBarStaffRows([37, 59], 'fixed-3').rowIds, [1], 'notes at 37 and 59 draw center 0/4 alone');

  // Fixed-4 analogue boundaries:
  // Row 3 (outer-above, lin 65.5): max >= 65.5
  assert.deepEqual(computeBarStaffRows([65], 'fixed-4').rowIds, [1, 2], 'lin 65 does NOT fire row 3');
  assert.deepEqual(computeBarStaffRows([66], 'fixed-4').rowIds, [1, 2, 3], 'lin 66 fires row 3');

  // Row 4 (outer-below, lin 29.5): min <= 29.5
  assert.deepEqual(computeBarStaffRows([30], 'fixed-4').rowIds, [1, 2], 'lin 30 does NOT fire row 4');
  assert.deepEqual(computeBarStaffRows([29], 'fixed-4').rowIds, [1, 2, 4], 'lin 29 fires row 4');

  // Row 5 (extension-above, lin 77.5): max >= 77.5
  assert.deepEqual(computeBarStaffRows([77], 'fixed-4').rowIds, [1, 2, 3], 'lin 77 does NOT fire row 5');
  assert.deepEqual(computeBarStaffRows([78], 'fixed-4').rowIds, [1, 2, 3, 5], 'lin 78 fires row 5');

  // Row 6 (extension-below, lin 17.5): min <= 17.5
  assert.deepEqual(computeBarStaffRows([18], 'fixed-4').rowIds, [1, 2, 4], 'lin 18 does NOT fire row 6');
  assert.deepEqual(computeBarStaffRows([17], 'fixed-4').rowIds, [1, 2, 4, 6], 'lin 17 fires row 6');
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

// ---------------------------------------------------------------------------
// 8. Guest Gaps: extension-segment terminals at interior barlines stand off 6.0pt
// ---------------------------------------------------------------------------

test('Guest Gaps: extension rows (0/6, 0/2) stand off 6.0pt at interior barlines; system edges and inner rows flush', () => {
  // Use Brahms fixed-3, which has extension rows in middle measures.
  // In the final system of Brahms:
  // Bar 0 has row 5 (lin 24) ending at barline 1;
  // Bar 1 has row 4 (lin 72) starting at barline 1 and ending at barline 2.
  const t = resolveJankoTokens(BRAHMS_OP118_NO1_JANKO_TOKENS);
  const o = resolveJankoOptions({ ...BRAHMS_OP118_NO1_JANKO_OPTIONS, core: 'fixed-3' });
  const layouts = layoutJankoScore(BRAHMS, o, t);
  const lastSys = layouts[layouts.length - 1];
  const geo = lastSys.geometry;
  const segs = geo.staffSegments ?? [];

  const barline1X = Number((geo.staffLeft + geo.measureWidth).toFixed(2));
  const barline2X = Number((geo.staffLeft + 2 * geo.measureWidth).toFixed(2));

  // Row 5 (0/2, lin 24, bar 0): starts at system left edge, ends at barline 1
  const row5 = segs.find((s) => s.rowId === 5);
  assert.ok(row5, 'Row 5 (0/2) segment found');
  assert.equal(row5.x1, geo.staffLeft, 'Row 5 is flush at system left edge');
  assert.equal(Number(row5.x2.toFixed(2)), Number((barline1X - t.measureInset).toFixed(2)), 'Row 5 stands off 6.0pt before interior barline 1');

  // Row 3 (0/3, lin 36, bar 0): inner conditional row terminates FLUSH at barline 1
  const row3 = segs.find((s) => s.rowId === 3);
  assert.ok(row3, 'Row 3 (0/3) segment found');
  assert.equal(row3.x1, geo.staffLeft, 'Row 3 is flush at system left edge');
  assert.equal(Number(row3.x2.toFixed(2)), barline1X, 'Row 3 terminates flush at barline 1 (normal-row treatment)');

  // Row 4 (0/6, lin 72, bar 1): starts after barline 1, ends before barline 2
  const row4 = segs.find((s) => s.rowId === 4);
  assert.ok(row4, 'Row 4 (0/6) segment found');
  assert.equal(Number(row4.x1.toFixed(2)), Number((barline1X + t.measureInset).toFixed(2)), 'Row 4 stands off 6.0pt after interior barline 1');
  assert.equal(Number(row4.x2.toFixed(2)), Number((barline2X - t.measureInset).toFixed(2)), 'Row 4 stands off 6.0pt before interior barline 2');

  // Row 2 (0/5, lin 60, bar 1): inner conditional row terminates FLUSH at both barlines
  const row2 = segs.find((s) => s.rowId === 2);
  assert.ok(row2, 'Row 2 (0/5) segment found');
  assert.equal(Number(row2.x1.toFixed(2)), barline1X, 'Row 2 is flush at barline 1 (normal-row treatment)');
  assert.equal(Number(row2.x2.toFixed(2)), barline2X, 'Row 2 is flush at barline 2 (normal-row treatment)');

  // System edges: always flush, no exceptions
  const row1 = segs.find((s) => s.rowId === 1);
  assert.ok(row1, 'Row 1 constitutional anchor spans system');
  assert.equal(row1.x1, geo.staffLeft, 'System left edge is flush');
  assert.equal(row1.x2, geo.staffRight, 'System right edge is flush');
});

// ---------------------------------------------------------------------------
// 9. Finale Conjoin: final barline extends to outermost extension rows
// ---------------------------------------------------------------------------

test('Finale Conjoin: final barline extends to outermost extension rows; flush conjoin in last bar', () => {
  // Synthetic score where the final measure draws outer rows 0/6 (lin 72) and 0/2 (lin 24)
  const finaleScore: QuantizedGridScore = {
    id: 'synthetic-finale-outer',
    title: 'synthetic-finale-outer',
    composer: 'test',
    ticksPerBeat: 48,
    totalTicks: 192 * 2,
    timeSignatures: [{ tick: 0, numerator: 4, denominator: 4 }],
    barlines: [],
    tempos: [], dynamics: [], pedals: [],
    notes: [
      makeNote('n0', 0, 4, 0, 96),     // C4 in bar 0
      makeNote('n1', 0, 6, 192, 96),   // C6 (lin 72) in final bar 1
      makeNote('n2', 0, 2, 192, 96, 'LH'), // C2 (lin 24) in final bar 1
    ],
  };

  const o = resolveJankoOptions({ ...DEFAULT_JANKO_OPTIONS, core: 'fixed-3', measuresPerSystem: 2, ticksPerMeasure: 192 });
  const t = resolveJankoTokens({ ticksPerMeasure: 192 });
  const page = computePageGeometry(o, t, finaleScore);
  const geo = getSystemGeometry(page, 0);

  // In the final bar, extension rows run flush into the final barline (x2 === geo.staffRight)
  const segs = geo.staffSegments ?? [];
  const row4 = segs.find((s) => s.rowId === 4 && s.mStart === 1);
  const row5 = segs.find((s) => s.rowId === 5 && s.mStart === 1);
  assert.ok(row4, 'Row 4 segment present in final bar');
  assert.ok(row5, 'Row 5 segment present in final bar');
  assert.equal(row4.x2, geo.staffRight, 'Row 4 runs flush into final barline at staffRight');
  assert.equal(row5.x2, geo.staffRight, 'Row 5 runs flush into final barline at staffRight');

  // Interior barline standoff remains 6.0pt
  const barline1X = geo.staffLeft + geo.measureWidth;
  assert.equal(row4.x1, barline1X + t.measureInset, 'Row 4 stands off 6.0pt at interior barline');
  assert.equal(row5.x1, barline1X + t.measureInset, 'Row 5 stands off 6.0pt at interior barline');

  // SVG inspection: final barline extends to exactly meet lin 72 and lin 24
  const svg = renderSystem(finaleScore, geo, 0, o, t);
  const finalTopY = (geo.middleCY + continuousPitchY(72, t.semitoneScale)).toFixed(2);
  const finalBotY = (geo.middleCY + continuousPitchY(24, t.semitoneScale)).toFixed(2);
  const finalBarlineRegex = new RegExp(
    `<line class="janko-barline" x1="${geo.staffRight.toFixed(2)}" y1="${finalTopY}" x2="${geo.staffRight.toFixed(2)}" y2="${finalBotY}" stroke="#111111" stroke-width="0.90"/>`
  );
  assert.match(svg, finalBarlineRegex, 'final barline spans from lin 72 to lin 24 at 0.90pt weight');

  // Conversely, when last bar draws no extension rows (e.g. Bach Goldberg Var. 1),
  // the final barline height is unchanged (top at gridTopY, bot at gridBotY)
  const bachOpts = resolveJankoOptions(DEFAULT_JANKO_OPTIONS);
  const bachTokens = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
  const bachPage = computePageGeometry(bachOpts, bachTokens, BACH);
  const bachLastSysIdx = countJankoSystems(BACH, bachOpts, bachTokens) - 1;
  const bachLastGeo = getSystemGeometry(bachPage, bachLastSysIdx);
  const bachSvg = renderSystem(BACH, bachLastGeo, bachLastSysIdx, bachOpts, bachTokens);
  const expectedBachTop = gridTopY(bachLastGeo).toFixed(2);
  const expectedBachBot = gridBotY(bachLastGeo).toFixed(2);
  const bachFinalBarlineRegex = new RegExp(
    `<line class="janko-barline" x1="${bachLastGeo.staffRight.toFixed(2)}" y1="${expectedBachTop}" x2="${bachLastGeo.staffRight.toFixed(2)}" y2="${expectedBachBot}" stroke="#111111" stroke-width="0.90"/>`
  );
  assert.match(bachSvg, bachFinalBarlineRegex, 'Bach final barline maintains standard height when no extension rows in last bar');
});

// ---------------------------------------------------------------------------
// 10. Bach m.4 Rest Placement and Displacement Stats
// ---------------------------------------------------------------------------

test('Bach m.4 Rest: placed strictly between RH 9 and RH 0, zero unwritten across Bach and Brahms', () => {
  const o = resolveJankoOptions(DEFAULT_JANKO_OPTIONS);
  const t = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
  const bachLayouts = layoutJankoScore(BACH, o, t);
  const sys0 = bachLayouts[0];

  // Notes around tick 552:
  // RH 9 at tick 540 (x = 538.3125)
  // LH 2 at tick 552 (x = 548.635)
  // RH 0 at tick 564 (x = 558.9575)
  const rh9 = sys0.notes.find((n) => n.note.startTick === 540 && n.note.pitch.pitchClass === 9);
  const rh0 = sys0.notes.find((n) => n.note.startTick === 564 && n.note.pitch.pitchClass === 0);
  const rest552 = sys0.rests.find((r) => r.tick === 552);

  assert.ok(rh9, 'RH 9 note found');
  assert.ok(rh0, 'RH 0 note found');
  assert.ok(rest552, 'RH tick 552 rest found');

  // Rest x strictly between the 9 head x and the 0 head x, inside its inter-onset gap
  assert.ok(rest552.x > rh9.x, `Rest x (${rest552.x}) must be to the right of RH 9 (${rh9.x})`);
  assert.ok(rest552.x < rh0.x, `Rest x (${rest552.x}) must be to the left of RH 0 (${rh0.x})`);

  // Canonical column alignment: aligns with tick 552 column (sharing beat with LH 2)
  const canonicalColX = getTickColumnX(552, sys0.geometry, 0, o, t);
  assert.equal(rest552.x, canonicalColX, 'Rest x aligns with canonical column x');

  // Seats on Middle C drawn line
  const middleCLineY = sys0.geometry.middleCY;
  assert.ok(Math.abs(rest552.y - middleCLineY) < 1e-6, 'Rest seats on Middle C line (lin 48)');

  // Unwritten rest count across Bach and Brahms: 0
  const bachUnwritten = bachLayouts.flatMap((s) => s.unwrittenRests ?? []);
  assert.equal(bachUnwritten.length, 0, 'Bach has 0 unwritten rests');

  const brahmsOpts = resolveJankoOptions(BRAHMS_OP118_NO1_JANKO_OPTIONS);
  const brahmsTokens = resolveJankoTokens(BRAHMS_OP118_NO1_JANKO_TOKENS);
  const brahmsLayouts = layoutJankoScore(BRAHMS, brahmsOpts, brahmsTokens);
  const brahmsUnwritten = brahmsLayouts.flatMap((s) => s.unwrittenRests ?? []);
  assert.equal(brahmsUnwritten.length, 0, 'Brahms has 0 unwritten rests');

  // Displacement stats: Bach max = 0.000, mean = 0.000
  const bachDisplacements = bachLayouts.flatMap((s) =>
    s.rests.filter((r) => r.value !== 'whole').map((r) => Math.abs(r.x - getTickColumnX(r.tick, s.geometry, s.index, o, t)))
  );
  const bachMaxDisp = Math.max(0, ...bachDisplacements);
  const bachMeanDisp = bachDisplacements.reduce((a, b) => a + b, 0) / bachDisplacements.length;
  assert.equal(bachMaxDisp, 0, 'Bach rest displacement max is exactly 0.000');
  assert.equal(bachMeanDisp, 0, 'Bach rest displacement mean is exactly 0.000');
});

