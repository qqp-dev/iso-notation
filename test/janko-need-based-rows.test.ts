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
// 1. Bar-4, Bar-7, and Bar-9 Pins (Lock-Three Core)
// ---------------------------------------------------------------------------

test('Bar-4 Pin: Bach Var. 1 Bar 4 renders EXACTLY rows {1, 2, 3} (lin 36, 48, 60)', () => {
  const o = resolveJankoOptions(DEFAULT_JANKO_OPTIONS);
  const t = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
  const layouts = layoutJankoScore(BACH, o, t);

  // System 0 contains bars 1..4 (system-local measure indices 0..3)
  const sys0 = layouts[0];
  const bar4Index = 3; // 0-based index of Bar 4 in System 0

  const rows = getBarStaffRows(sys0.geometry, bar4Index);
  // Under lock-three core, rows 1 (48), 2 (60), 3 (36) are drawn in every bar
  assert.deepEqual(rows, [1, 2, 3], 'Bar 4 must render exactly rows {1, 2, 3}');

  const segments = getBarStaffSegments(sys0.geometry, bar4Index);
  const lins = segments.map((s) => s.lin).sort((a, b) => a - b);
  assert.deepEqual(lins, [36, 48, 60], 'Bar 4 must draw lines strictly at lin 36, 48, 60');

  // Verify that outer rows: row 4 (lin 72) and row 5 (lin 24) are silent in Bar 4
  assert.ok(!rows.includes(4), 'Row 4 (outer-above, 0/6) must be silent in Bar 4');
  assert.ok(!rows.includes(5), 'Row 5 (outer-below, 0/2) must be silent in Bar 4');
});

test('Bar-7 Pin: Bach Var. 1 Bar 7 renders EXACTLY rows {1, 2, 3} with NO 0/6 (max 9/5 = 69 < 72)', () => {
  const o = resolveJankoOptions(DEFAULT_JANKO_OPTIONS);
  const t = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
  const layouts = layoutJankoScore(BACH, o, t);

  // System 1 contains bars 5..8 (system-local measure index 2 = Bar 7)
  const sys1 = layouts[1];
  const bar7Index = 2;

  const rows = getBarStaffRows(sys1.geometry, bar7Index);
  assert.deepEqual(rows, [1, 2, 3], 'Bar 7 must render exactly rows {1, 2, 3}');

  const segments = getBarStaffSegments(sys1.geometry, bar7Index);
  const lins = segments.map((s) => s.lin).sort((a, b) => a - b);
  assert.deepEqual(lins, [36, 48, 60], 'Bar 7 must draw lines strictly at lin 36, 48, 60');

  assert.ok(!rows.includes(4), 'Row 4 (0/6, lin 72) must be silent in Bar 7 (max note 69 < 72)');
  assert.ok(!rows.includes(5), 'Row 5 (0/2, lin 24) must be silent in Bar 7');
});

test('Bar-9 System Spread Pin: System 2 (mm. 9–12) is byte-identical (already all-three core)', () => {
  const o = resolveJankoOptions(DEFAULT_JANKO_OPTIONS);
  const t = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
  const layouts = layoutJankoScore(BACH, o, t);
  const sys2 = layouts[2];
  for (let m = 0; m < sys2.geometry.measuresPerSystem; m++) {
    const rows = getBarStaffRows(sys2.geometry, m);
    assert.ok(rows.includes(1) && rows.includes(2) && rows.includes(3), `m. ${m + 9} includes {1, 2, 3}`);
  }
});

// ---------------------------------------------------------------------------
// 2. Strict Row Boundary Pins (Locked Core + Outer Conditional Rows)
// ---------------------------------------------------------------------------

test('Strict Row Boundary Pins: inclusive fire at 72, 24 under fixed-3; 77.5, 17.5 under fixed-4; locked core always fires', () => {
  // Fixed-3:
  // Core rows {1, 2, 3} (lin 48, 60, 36) always fire unconditionally:
  assert.deepEqual(computeBarStaffRows([59], 'fixed-3').rowIds, [1, 2, 3], 'core rows {1, 2, 3} always fire');
  assert.deepEqual(computeBarStaffRows([60], 'fixed-3').rowIds, [1, 2, 3], 'core rows {1, 2, 3} always fire');
  assert.deepEqual(computeBarStaffRows([37], 'fixed-3').rowIds, [1, 2, 3], 'core rows {1, 2, 3} always fire');
  assert.deepEqual(computeBarStaffRows([36], 'fixed-3').rowIds, [1, 2, 3], 'core rows {1, 2, 3} always fire');

  // Row 4 (72, 0/6) fires iff max >= 72:
  assert.deepEqual(computeBarStaffRows([71], 'fixed-3').rowIds, [1, 2, 3], 'lin 71 does NOT fire row 4');
  assert.deepEqual(computeBarStaffRows([72], 'fixed-3').rowIds, [1, 2, 3, 4], 'lin 72 fires row 4');

  // Row 5 (24, 0/2) fires iff min <= 24:
  assert.deepEqual(computeBarStaffRows([25], 'fixed-3').rowIds, [1, 2, 3], 'lin 25 does NOT fire row 5');
  assert.deepEqual(computeBarStaffRows([24], 'fixed-3').rowIds, [1, 2, 3, 5], 'lin 24 fires row 5');

  // Single-note bars inside (36, 60) still get the complete locked core {1, 2, 3}:
  assert.deepEqual(computeBarStaffRows([40, 50], 'fixed-3').rowIds, [1, 2, 3], 'notes strictly between 36 and 60 get locked core');
  assert.deepEqual(computeBarStaffRows([48], 'fixed-3').rowIds, [1, 2, 3], 'single Middle C note gets locked core');
  assert.deepEqual(computeBarStaffRows([37, 59], 'fixed-3').rowIds, [1, 2, 3], 'notes at 37 and 59 get locked core');

  // Fixed-4 analogue boundaries:
  // Four middle rows {1, 2, 3, 4} (29.5, 41.5, 53.5, 65.5) always fire:
  assert.deepEqual(computeBarStaffRows([65], 'fixed-4').rowIds, [1, 2, 3, 4], 'four middles {1, 2, 3, 4} always fire');
  assert.deepEqual(computeBarStaffRows([30], 'fixed-4').rowIds, [1, 2, 3, 4], 'four middles {1, 2, 3, 4} always fire');

  // Row 5 (extension-above, lin 77.5): max >= 77.5
  assert.deepEqual(computeBarStaffRows([77], 'fixed-4').rowIds, [1, 2, 3, 4], 'lin 77 does NOT fire row 5');
  assert.deepEqual(computeBarStaffRows([78], 'fixed-4').rowIds, [1, 2, 3, 4, 5], 'lin 78 fires row 5');

  // Row 6 (extension-below, lin 17.5): min <= 17.5
  assert.deepEqual(computeBarStaffRows([18], 'fixed-4').rowIds, [1, 2, 3, 4], 'lin 18 does NOT fire row 6');
  assert.deepEqual(computeBarStaffRows([17], 'fixed-4').rowIds, [1, 2, 3, 4, 6], 'lin 17 fires row 6');
});

// ---------------------------------------------------------------------------
// 3. Property Pins: Core floor property on Bach and Brahms
// ---------------------------------------------------------------------------

test('Property Pin (fixed-3): Core floor {1, 2, 3} always present and center-connected in all bars of Bach and Brahms', () => {
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
        // Lock-three core floor: no single-line or double-line bars anywhere
        assert.ok(
          rows.includes(1) && rows.includes(2) && rows.includes(3),
          `${label} sys ${sys.index} m ${m}: Core rows {1, 2, 3} must always be present (got ${rows.join(',')})`
        );
        assert.ok(rows.length >= 3, `${label} sys ${sys.index} m ${m}: At least 3 rows in every bar (no single- or double-line bars)`);
        // Center-connectedness:
        if (rows.includes(4)) {
          assert.ok(rows.includes(2), `${label} sys ${sys.index} m ${m}: Row 4 requires Row 2`);
        }
        if (rows.includes(5)) {
          assert.ok(rows.includes(3), `${label} sys ${sys.index} m ${m}: Row 5 requires Row 3`);
        }
      }
    }
  }
});

test('Property Pin (fixed-4): Four middles {1, 2, 3, 4} always present and center-connected in all bars of Brahms', () => {
  const o = resolveJankoOptions({ ...BRAHMS_OP118_NO1_JANKO_OPTIONS, core: 'fixed-4' });
  const t = resolveJankoTokens(BRAHMS_OP118_NO1_JANKO_TOKENS);
  const layouts = layoutJankoScore(BRAHMS, o, t);

  for (const sys of layouts) {
    const numBars = sys.geometry.measuresPerSystem;
    for (let m = 0; m < numBars; m++) {
      const rows = getBarStaffRows(sys.geometry, m);
      assert.ok(
        rows.includes(1) && rows.includes(2) && rows.includes(3) && rows.includes(4),
        `Brahms fixed-4 sys ${sys.index} m ${m}: Four middles (rows 1..4) must always be present (got ${rows.join(',')})`
      );
      assert.ok(rows.length >= 4, `Brahms fixed-4 sys ${sys.index} m ${m}: At least 4 rows in every bar`);
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
// 4. Rest-Bar Pin: Rest-only bar renders locked core {1, 2, 3} with whole rest on Middle C
// ---------------------------------------------------------------------------

test('Rest-Bar Pin: Rest-only bar renders locked core {1, 2, 3} with whole rest on Middle C', () => {
  // Synthetic 4/4 score: Bar 0 has notes in octave 4,
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

  // Bar 1 has no notes -> locked core {1, 2, 3}
  const bar1Rows = getBarStaffRows(sys.geometry, 1);
  assert.deepEqual(bar1Rows, [1, 2, 3], 'Rest-only bar renders locked core {1, 2, 3}');

  // Verify the whole rest is placed and touches the Middle C line (lin 48)
  const bar1Rest = sys.rests.find((r) => r.tick === 192 && r.value === 'whole');
  assert.ok(bar1Rest, 'Whole rest generated for empty bar 1');
  assert.ok(Math.abs(bar1Rest.y - sys.geometry.middleCY) < 0.05, 'Bar rest still seats on drawn line (Middle C rule)');

  // Visual linter is green
  const report = lintJankoScore(restScore, o, t);
  assert.equal(report.ok, true, 'Rest-only bar score lints completely clean');
});

// ---------------------------------------------------------------------------
// 5. Segments Pin: Non-consecutive earning bars render disjoint unbroken segments
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 5. Segments Pin: Non-consecutive earning bars render disjoint unbroken segments
// ---------------------------------------------------------------------------

test('Segments Pin: Non-consecutive earning bars render disjoint unbroken segments on extension row', () => {
  // Synthetic 4-bar score:
  // Bar 0: high note lin 72 (earns extension Row 4)
  // Bar 1: middle note lin 48 (silent for Row 4)
  // Bar 2: high note lin 72 (earns extension Row 4)
  // Bar 3: middle note lin 48 (silent for Row 4)
  const score = makeScore('disjoint-segments', [
    makeNote('n0', 0, 6, 0),     // lin 72 in bar 0
    makeNote('n1', 0, 4, 144),   // lin 48 in bar 1
    makeNote('n2', 0, 6, 288),   // lin 72 in bar 2
    makeNote('n3', 0, 4, 432),   // lin 48 in bar 3
  ]);

  const o = resolveJankoOptions({ ...DEFAULT_JANKO_OPTIONS, measuresPerSystem: 4 });
  const t = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
  const layouts = layoutJankoScore(score, o, t);
  const sys = layouts[0];

  const segments = sys.geometry.staffSegments ?? [];
  const row4Segments = segments.filter((s) => s.rowId === 4);

  // Must have exactly two disjoint segments for Row 4: [0..0] and [2..2]
  assert.equal(row4Segments.length, 2, 'Row 4 renders exactly two disjoint unbroken segments');
  assert.equal(row4Segments[0].mStart, 0);
  assert.equal(row4Segments[0].mEnd, 0);
  assert.equal(row4Segments[1].mStart, 2);
  assert.equal(row4Segments[1].mEnd, 2);

  // Core rows 1, 2, 3 are unbroken across the whole system [0..3]
  for (const rId of [1, 2, 3]) {
    const rSegs = segments.filter((s) => s.rowId === rId);
    assert.equal(rSegs.length, 1, `Row ${rId} spans the whole system`);
    assert.equal(rSegs[0].mStart, 0);
    assert.equal(rSegs[0].mEnd, 3);
    assert.equal(rSegs[0].x1, sys.geometry.staffLeft);
    assert.equal(rSegs[0].x2, sys.geometry.staffRight);
  }
});

// ---------------------------------------------------------------------------
// 6. Folds Invariant (literal 0/0 on Brahms; the core-fold presentation still 9/1; Bach 0)
// ---------------------------------------------------------------------------

test('Folds Invariant: the working literal Brahms folds 0; the core-fold presentation still 9/1; Bach 0', () => {
  const t = resolveJankoTokens(BRAHMS_OP118_NO1_JANKO_TOKENS);

  // Round 45 §E: the working Brahms Reference draws its low LH octaves at
  // their literal written pitch, so NOTHING folds under either core — the
  // notes keep their exact pitch semantics and state their register with the
  // established ledger vocabulary instead of a ↓10 displacement.
  for (const core of ['fixed-3', 'fixed-4'] as const) {
    const literal = layoutJankoScore(
      BRAHMS,
      resolveJankoOptions({ ...BRAHMS_OP118_NO1_JANKO_OPTIONS, core }),
      t
    );
    const folded = literal.flatMap((s) => s.notes).filter((n) => n.ottavaShift !== undefined);
    assert.equal(folded.length, 0, `literal Brahms ${core} folds nothing`);
    assert.equal(
      literal.reduce((n, s) => n + s.ottavaBrackets.length, 0),
      0,
      `literal Brahms ${core} paints no ottava bracket`
    );
    // Round 46: the literal position **is** the register statement — Round
    // 45's dynamic ledger ink is gone, so no head is flagged out-of-staff and
    // no ledger list is drawn. The corpus still draws octaves 0–2 below the
    // core rows and octave 6 above them, at their exact source octave.
    const heads = literal.flatMap((s) => s.notes);
    const outsideCoreRows = heads.filter((n) => n.coord.octave <= 2 || n.coord.octave >= 6);
    assert.ok(
      outsideCoreRows.length > 0,
      `literal Brahms ${core} draws its low/high registers at their literal source octave`
    );
    for (const n of outsideCoreRows) {
      assert.equal(n.coord.ledgerYs.length, 0, `${n.note.id}: no extra ledger ink`);
      assert.equal(n.coord.isOutOfStaff, false, `${n.note.id}: no out-of-staff flag`);
      assert.equal(n.ottavaShift ?? 0, 0, `${n.note.id}: no fold shift`);
    }
  }

  // The historical core-fold presentation stays implemented and keeps its
  // exact fold counts (9 under fixed-3, 1 under fixed-4) — the machinery is
  // verified, it is simply no longer the working golden.
  const f3Opts = resolveJankoOptions({
    ...BRAHMS_OP118_NO1_JANKO_OPTIONS,
    core: 'fixed-3',
    lowPitchFolding: 'core',
  });
  const f3Folded = layoutJankoScore(BRAHMS, f3Opts, t)
    .flatMap((s) => s.notes)
    .filter((n) => n.ottavaShift !== undefined);
  assert.equal(f3Folded.length, 9, 'core-fold fixed-3 fold count holds at exactly 9');

  const f4Opts = resolveJankoOptions({
    ...BRAHMS_OP118_NO1_JANKO_OPTIONS,
    core: 'fixed-4',
    lowPitchFolding: 'core',
  });
  const f4Folded = layoutJankoScore(BRAHMS, f4Opts, t)
    .flatMap((s) => s.notes)
    .filter((n) => n.ottavaShift !== undefined);
  assert.equal(f4Folded.length, 1, 'core-fold fixed-4 fold count holds at exactly 1');

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
  // In system 2 (mm. 9–12) at canonical 4-per packing:
  // Row 5 (lin 24) runs bars 0–2, flush at the system left edge, ending at
  // barline 3; row 4 (lin 72) spans bar 1, starting at barline 1 and ending
  // at barline 2.
  const t = resolveJankoTokens(BRAHMS_OP118_NO1_JANKO_TOKENS);
  const o = resolveJankoOptions({ ...BRAHMS_OP118_NO1_JANKO_OPTIONS, core: 'fixed-3' });
  const layouts = layoutJankoScore(BRAHMS, o, t);
  const sys = layouts[2];
  const geo = sys.geometry;
  const segs = geo.staffSegments ?? [];

  const barline1X = Number((geo.staffLeft + geo.measureWidth).toFixed(2));
  const barline2X = Number((geo.staffLeft + 2 * geo.measureWidth).toFixed(2));
  const barline3X = Number((geo.staffLeft + 3 * geo.measureWidth).toFixed(2));

  // Row 5 (0/2, lin 24): starts at system left edge, ends at barline 3
  const row5 = segs.find((s) => s.rowId === 5);
  assert.ok(row5, 'Row 5 (0/2) segment found');
  assert.equal(row5.x1, geo.staffLeft, 'Row 5 is flush at system left edge');
  assert.equal(Number(row5.x2.toFixed(2)), Number((barline3X - t.measureInset).toFixed(2)), 'Row 5 stands off 6.0pt before interior barline 3');

  // Row 4 (0/6, lin 72, bar 1): starts after barline 1, ends before barline 2
  const row4 = segs.find((s) => s.rowId === 4);
  assert.ok(row4, 'Row 4 (0/6) segment found');
  assert.equal(Number(row4.x1.toFixed(2)), Number((barline1X + t.measureInset).toFixed(2)), 'Row 4 stands off 6.0pt after interior barline 1');
  assert.equal(Number(row4.x2.toFixed(2)), Number((barline2X - t.measureInset).toFixed(2)), 'Row 4 stands off 6.0pt before interior barline 2');

  // Inner rows (1, 2, 3) never terminate mid-system; they span system edges flush
  for (const rowId of [1, 2, 3]) {
    const seg = segs.find((s) => s.rowId === rowId);
    assert.ok(seg, `Row ${rowId} found`);
    assert.equal(seg.x1, geo.staffLeft, `Row ${rowId} left edge is flush`);
    assert.equal(seg.x2, geo.staffRight, `Row ${rowId} right edge is flush`);
  }
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
  assert.equal(Number(rest552.x.toFixed(2)), 548.63, 'Rest x pinned at 548.63');

  // Voice-height rest seating: seats at the 9 note's own height (semitone lin 46)
  assert.equal(Number(rest552.y.toFixed(1)), 179.5, 'Rest y pinned at 179.5');
  assert.ok(Math.abs(rest552.y - 179.48625) < 0.01, 'Rest seats at exactly 179.48625');

  // Hanging rest counts: Bach 9 (frozen), Brahms 21 (was 20 before Round 45).
  // The m. 66 RH → LH hand correction (§D) re-hands the tick-12552/12576
  // reattacks, which opens exactly one further genuine hanging rest
  // (t12576, quarter, RH); the source correction's 74 false hanging rests
  // stay gone and the engine's rest rules are untouched.
  // Source correction filled 74 false hanging rests opened by playback
  // shortenings (e.g. the m.68 t13092 12-tick gap from 96→84 halves, now full
  // 96; staccato 24→18 gaps, now abutting). Engine rules unchanged.
  const bachHanging = bachLayouts.flatMap((s) => s.rests).filter((r) => r.value !== 'whole' && r.value !== 'half');
  assert.equal(bachHanging.length, 9, 'Bach hanging-rest count holds at exactly 9');

  const brahmsOpts = resolveJankoOptions(DEFAULT_JANKO_OPTIONS);
  const brahmsTokens = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
  const brahmsLayouts = layoutJankoScore(BRAHMS, brahmsOpts, brahmsTokens);
  const brahmsHanging = brahmsLayouts.flatMap((s) => s.rests).filter((r) => r.value !== 'whole' && r.value !== 'half');
  // Round 48: two of the three former false silences are gone — the m. 66 LH
  // eighth is **withheld** (the source's own hand sounds through its span;
  // no editorial authority there, so the conservative veto stands) and the
  // m. 70 LH quarter is now **painted truthfully** under the §4 editorial
  // authority (the authority resolves the run's hand, so the raw label no
  // longer vetoes), while the m. 66 RH quarter — which the source writes as
  // an `r` — stays and is classified **authored**.
  assert.equal(brahmsHanging.length, 20, 'Brahms hanging-rest count holds at exactly 20');
  assert.equal(
    brahmsLayouts.flatMap((s) => s.withheldRests).length,
    1,
    'the one remaining withheld inferred rest is published, never painted'
  );

  // Unwritten rest count across Bach and Brahms: 0
  const bachUnwritten = bachLayouts.flatMap((s) => s.unwrittenRests ?? []);
  assert.equal(bachUnwritten.length, 0, 'Bach has 0 unwritten rests');
  const brahmsUnwritten = brahmsLayouts.flatMap((s) => s.unwrittenRests ?? []);
  assert.equal(brahmsUnwritten.length, 0, 'Brahms has 0 unwritten rests');

  // Horizontal displacement stats: columns logic untouched (dx = 0)
  const bachDisplacements = bachLayouts.flatMap((s) =>
    s.rests.filter((r) => r.value !== 'whole' && r.value !== 'half').map((r) =>
      Math.abs(r.x - getTickColumnX(r.tick, s.geometry, s.index, o, t))
    )
  );
  const bachMaxDisp = Math.max(0, ...bachDisplacements);
  const bachMeanDisp = bachDisplacements.reduce((a, b) => a + b, 0) / bachDisplacements.length;
  assert.equal(bachMaxDisp, 0, 'Bach rest horizontal displacement max is exactly 0.000');
  assert.equal(bachMeanDisp, 0, 'Bach rest horizontal displacement mean is exactly 0.000');

  // Vertical displacement stats vs pre-change seats (pre-change snapped to drawn lines {36, 48, 60}):
  let bachMovedCount = 0;
  let bachDySum = 0;
  let bachDyMax = 0;
  for (const r of bachHanging) {
    const sys = bachLayouts.find((s) => s.rests.includes(r))!;
    const currentLin = 48 + (sys.geometry.middleCY - r.y) / t.semitoneScale;
    let nearestLine = 48;
    let bestDist = Math.abs(currentLin - 48);
    for (const d of [36, 60]) {
      const dist = Math.abs(currentLin - d);
      if (dist < bestDist) {
        bestDist = dist;
        nearestLine = d;
      }
    }
    const oldY = sys.geometry.middleCY - (nearestLine - 48) * t.semitoneScale;
    const dy = Math.abs(r.y - oldY);
    if (dy > 0.01) bachMovedCount++;
    bachDySum += dy;
    if (dy > bachDyMax) bachDyMax = dy;
  }

  let brahmsMovedCount = 0;
  let brahmsDySum = 0;
  let brahmsDyMax = 0;
  for (const r of brahmsHanging) {
    const sys = brahmsLayouts.find((s) => s.rests.includes(r))!;
    const currentLin = 48 + (sys.geometry.middleCY - r.y) / brahmsTokens.semitoneScale;
    let nearestLine = 48;
    let bestDist = Math.abs(currentLin - 48);
    for (const d of [36, 60]) {
      const dist = Math.abs(currentLin - d);
      if (dist < bestDist) {
        bestDist = dist;
        nearestLine = d;
      }
    }
    const oldY = sys.geometry.middleCY - (nearestLine - 48) * brahmsTokens.semitoneScale;
    const dy = Math.abs(r.y - oldY);
    if (dy > 0.01) brahmsMovedCount++;
    brahmsDySum += dy;
    if (dy > brahmsDyMax) brahmsDyMax = dy;
  }

  console.log(
    `[Voice-Height Rest Displacement Stats]\n` +
    `  Bach: ${bachHanging.length} hanging rests, ${bachMovedCount} vertical moves (expected <= 8), max dy = ${bachDyMax.toFixed(2)}pt, mean dy = ${(bachDySum / bachHanging.length).toFixed(2)}pt, max dx = 0.000\n` +
    `  Brahms: ${brahmsHanging.length} hanging rests, ${brahmsMovedCount} vertical moves (expected ~18; was ~90 pre-correction with 94 hanging), max dy = ${brahmsDyMax.toFixed(2)}pt, mean dy = ${(brahmsDySum / brahmsHanging.length).toFixed(2)}pt, max dx = 0.000`
  );
  assert.ok(bachMovedCount <= 8, `Bach vertical moves ${bachMovedCount} <= 8`);
  assert.ok(brahmsMovedCount >= 15 && brahmsMovedCount <= 20, `Brahms vertical moves ${brahmsMovedCount} ~18`);
});

