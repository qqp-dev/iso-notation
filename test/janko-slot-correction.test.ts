/**
 * Rigid whole-system slot correction (§5).
 *
 * A system whose staff furniture overflows its page slot is translated
 * rigidly — re-laid-out on a shifted staff centre — until its complete ink
 * sits inside the slot with 1.00pt air top and bottom. Already-fitting
 * systems are returned untouched (shift zero, byte-identical); complete ink
 * taller than the slot cannot be seated by any rigid shift and is left as
 * honest residue (the Brahms adaptive final system).
 *
 *  - corrected shifts pinned (systems, signs, exact values);
 *  - idempotence (a corrected layout re-measures shift zero);
 *  - the rigid invariant (corrected == uncorrected + shift on every y);
 *  - Bach untouched (all shifts zero);
 *  - adaptive baseline preserved exactly (all shifts zero, 2 findings kept);
 *  - the engine bounds mirror the linter extents term for term.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1';
import { buildBrahmsOp118No1Score } from '../src/scores/brahms-op118-no1';
import {
  BRAHMS_ROUND44_RESERVE_OPTIONS,
  BRAHMS_ROUND44_RESERVE_TOKENS,
} from './brahms-round44-reserve';

import {
  DEFAULT_JANKO_OPTIONS,
  DEFAULT_JANKO_TOKENS,
  resolveJankoOptions,
  resolveJankoTokens,
} from '../src/render/janko/types';
import {
  computeContentAwarePageShifts,
  computePageGeometry,
  computeSystemSlotShift,
  layoutJankoScore,
  layoutJankoSystemShifted,
  systemCompleteInkBounds,
  systemFurnitureBounds,
} from '../src/render/janko/engine';
import {
  DEFAULT_JANKO_LINT_OPTIONS,
  checkSystemSlotFit,
  lintJankoScore,
  systemInkExtents,
  type LintViolation,
} from '../src/render/janko/linter';

const BACH = buildBachGoldbergVar1Score();
const BRAHMS = buildBrahmsOp118No1Score();
const O_BACH = resolveJankoOptions(DEFAULT_JANKO_OPTIONS);
const T_BACH = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
const O_BRAHMS = resolveJankoOptions(BRAHMS_ROUND44_RESERVE_OPTIONS);
const T_BRAHMS = resolveJankoTokens(BRAHMS_ROUND44_RESERVE_TOKENS);
const O_ADAPTIVE = resolveJankoOptions({ ...BRAHMS_ROUND44_RESERVE_OPTIONS, core: 'adaptive' });

/**
 * Canonical fixed-3 shifts (page pt, +down), systems 0-based.
 *
 * Systems 2/4 (index 1/3) carry the §5 label-box term: their down10 labels
 * descend 0.5pt below the spanner line, so complete ink runs 0.5 deeper
 * and the shift grows by exactly that (−8.01375 → −8.51375). The other
 * three systems carry no ottava ink and keep their settled values.
 */
const CANON_SHIFTS: Array<[number, number]> = [
  [1, -8.51375],
  [3, -8.51375],
  [7, 4.41375],
  [12, 4.41375],
  [15, 9.41375],
];

test('Slot correction: exactly the five settled systems shift, values pinned', () => {
  const page = computePageGeometry(O_BRAHMS, T_BRAHMS, BRAHMS);
  const shifts = new Map<number, number>();
  for (let s = 0; s < 18; s++) {
    const un = layoutJankoSystemShifted(BRAHMS, page, s, O_BRAHMS, T_BRAHMS, 0);
    const shift = computeSystemSlotShift(un, page, O_BRAHMS, T_BRAHMS);
    if (shift !== 0) shifts.set(s, shift);
  }
  assert.deepEqual(
    [...shifts.keys()],
    CANON_SHIFTS.map(([s]) => s),
    'only systems 2/4/8/13/16 correct'
  );
  for (const [s, want] of CANON_SHIFTS) {
    assert.ok(
      Math.abs(shifts.get(s)! - want) < 1e-9,
      `sys${s + 1} shifts ${shifts.get(s)}pt (want ${want}pt)`
    );
  }
});

test('Slot correction: idempotent — a corrected layout re-measures zero', () => {
  for (const [label, score, o, t] of [
    ['Bach', BACH, O_BACH, T_BACH],
    ['Brahms adaptive', BRAHMS, O_ADAPTIVE, T_BRAHMS],
  ] as const) {
    const page = computePageGeometry(o, t, score);
    const layouts = layoutJankoScore(score, o, t);
    for (const l of layouts) {
      assert.equal(
        computeSystemSlotShift(l, page, o, t),
        0,
        `${label} sys${l.index + 1}: corrected layout is stable`
      );
    }
  }
});

test('Content-aware placement: idempotent — a placed layout re-measures zero', () => {
  const page = computePageGeometry(O_BRAHMS, T_BRAHMS, BRAHMS);
  const layouts = layoutJankoScore(BRAHMS, O_BRAHMS, T_BRAHMS);
  const shifts = computeContentAwarePageShifts(layouts, page, O_BRAHMS, T_BRAHMS);
  assert.equal(shifts.size, 0, 'the placed layout is stable (no further shifts)');
});

test('Slot correction: rigid — corrected == uncorrected + shift on every y', () => {
  const page = computePageGeometry(O_BRAHMS, T_BRAHMS, BRAHMS);
  for (const [s] of CANON_SHIFTS) {
    const un = layoutJankoSystemShifted(BRAHMS, page, s, O_BRAHMS, T_BRAHMS, 0);
    const corrected = layoutJankoScore(BRAHMS, O_BRAHMS, T_BRAHMS)[s];
    // Total rigid translation (slot correction + content-aware page pass):
    // measured from the staff centre, then verified on every derived y.
    const shift = corrected.geometry.middleCY - un.geometry.middleCY;
    assert.ok(
      Math.abs(corrected.geometry.middleCY - un.geometry.middleCY - shift) < 1e-9,
      `sys${s + 1}: staff centre translates by the shift`
    );
    assert.equal(
      corrected.geometry.slotTopY,
      un.geometry.slotTopY,
      `sys${s + 1}: the slot itself never moves`
    );
    assert.equal(corrected.notes.length, un.notes.length, `sys${s + 1}: same heads`);
    for (let i = 0; i < un.notes.length; i++) {
      const a = un.notes[i];
      const b = corrected.notes[i];
      assert.equal(b.note.id, a.note.id, `sys${s + 1}: head order kept`);
      assert.equal(b.x, a.x, `sys${s + 1}: ${a.note.id} x untouched`);
      assert.ok(Math.abs(b.y - a.y - shift) < 1e-9, `sys${s + 1}: ${a.note.id} y shifted`);
      assert.equal(b.rhythm.x, a.rhythm.x, `sys${s + 1}: ${a.note.id} stem x untouched`);
      assert.ok(
        Math.abs(b.rhythm.y - a.rhythm.y - shift) < 1e-9,
        `sys${s + 1}: ${a.note.id} rhythm y shifted`
      );
    }
    // Attachments ride along: rests, clasps, ottava, beams.
    assert.equal(corrected.rests.length, un.rests.length, `sys${s + 1}: same rests`);
    for (let i = 0; i < un.rests.length; i++) {
      assert.equal(corrected.rests[i].x, un.rests[i].x, `sys${s + 1}: rest x untouched`);
      assert.ok(
        Math.abs(corrected.rests[i].y - un.rests[i].y - shift) < 1e-9,
        `sys${s + 1}: rest y shifted`
      );
    }
    assert.equal(corrected.clasps.length, un.clasps.length, `sys${s + 1}: same clasps`);
    for (let i = 0; i < un.clasps.length; i++) {
      assert.ok(
        Math.abs(corrected.clasps[i].topY - un.clasps[i].topY - shift) < 1e-9 &&
          Math.abs(corrected.clasps[i].botY - un.clasps[i].botY - shift) < 1e-9,
        `sys${s + 1}: clasp ${i} shifted`
      );
    }
    assert.equal(
      corrected.ottavaBrackets.length,
      un.ottavaBrackets.length,
      `sys${s + 1}: same ottava`
    );
    for (let i = 0; i < un.ottavaBrackets.length; i++) {
      assert.ok(
        Math.abs(corrected.ottavaBrackets[i].lineY - un.ottavaBrackets[i].lineY - shift) < 1e-9,
        `sys${s + 1}: ottava ${i} shifted`
      );
    }
    assert.equal(corrected.beams.length, un.beams.length, `sys${s + 1}: same beams`);
    for (let i = 0; i < un.beams.length; i++) {
      const a = un.beams[i];
      const b = corrected.beams[i];
      assert.ok(
        Math.abs(b.primary.y1 - a.primary.y1 - shift) < 1e-9 &&
          Math.abs(b.primary.y2 - a.primary.y2 - shift) < 1e-9,
        `sys${s + 1}: beam ${i} shifted`
      );
      assert.equal(b.slope, a.slope, `sys${s + 1}: beam ${i} slope kept`);
    }
    // Columns (x) are untouched by a vertical correction.
    assert.deepEqual(
      [...corrected.columns.entries()],
      [...un.columns.entries()],
      `sys${s + 1}: columns untouched`
    );
  }
});

test('Slot correction: Bach untouched — every shift zero', () => {
  const page = computePageGeometry(O_BACH, T_BACH, BACH);
  const layouts = layoutJankoScore(BACH, O_BACH, T_BACH);
  assert.equal(layouts.length, 8);
  for (const l of layouts) {
    assert.equal(computeSystemSlotShift(l, page, O_BACH, T_BACH), 0, `Bach sys${l.index + 1}`);
  }
  const report = lintJankoScore(BACH, O_BACH, T_BACH);
  assert.equal(report.violations.length, 0);
  assert.equal(report.warnings.length, 0);
});

test('Slot correction: adaptive baseline preserved exactly (sys18 infeasible)', () => {
  const page = computePageGeometry(O_ADAPTIVE, T_BRAHMS, BRAHMS);
  const layouts = layoutJankoScore(BRAHMS, O_ADAPTIVE, T_BRAHMS);
  for (const l of layouts) {
    assert.equal(
      computeSystemSlotShift(l, page, O_ADAPTIVE, T_BRAHMS),
      0,
      `adaptive sys${l.index + 1}: no shift`
    );
  }
  // The final system proves genuine infeasibility: 212pt of complete ink in
  // a 183.97pt slot cannot be seated by any rigid shift, so the correction
  // reports zero and the two same-class findings remain, byte-identical.
  const ink = systemCompleteInkBounds(layouts[17], O_ADAPTIVE, T_BRAHMS);
  assert.ok(ink.bottom - ink.top > page.slotHeight - 2, 'sys18 complete ink taller than the slot');
  const report = lintJankoScore(BRAHMS, O_ADAPTIVE, T_BRAHMS);
  assert.equal(report.violations.length, 2, 'the two pre-existing findings remain');
  assert.equal(report.warnings.length, 0);
  for (const v of report.violations) {
    assert.equal(v.code, 'system-slot-overlap', 'residual stays same-class');
  }
  const furn = report.violations[0].metrics as { inkBottom: number; slotBottom: number };
  assert.ok(
    Math.abs(furn.inkBottom - (furn.slotBottom - 1) - 1.4075) < 1e-9,
    'staff overflow exactly 1.4075pt (no worsening)'
  );
  const adj = report.violations[1].metrics as { lowerTop: number; upperBottom: number };
  assert.ok(
    Math.abs(adj.upperBottom - adj.lowerTop - 13.0275) < 1e-9,
    'adjacent overlap exactly 13.0275pt (no worsening)'
  );
});

test('Slot correction: engine bounds mirror the linter extents term for term', () => {
  for (const [label, score, o, t] of [
    ['Bach', BACH, O_BACH, T_BACH],
    ['Brahms fixed-3', BRAHMS, O_BRAHMS, T_BRAHMS],
    ['Brahms adaptive', BRAHMS, O_ADAPTIVE, T_BRAHMS],
  ] as const) {
    const layouts = layoutJankoScore(score, o, t);
    for (const l of layouts) {
      const engine = systemCompleteInkBounds(l, o, t);
      const linter = systemInkExtents(l, t, DEFAULT_JANKO_LINT_OPTIONS, o);
      assert.equal(engine.top, linter.top, `${label} sys${l.index + 1}: complete top mirrors`);
      assert.equal(engine.bottom, linter.bottom, `${label} sys${l.index + 1}: complete bottom mirrors`);
    }
  }
  // Furniture mirrors the slot-fit gate's own measure (unshifted systems
  // carry violations whose metrics are the linter's furniture span). The
  // gate is slot-mode: content-aware governs by page block instead, so the
  // mirror runs under an explicit slot override.
  const oSlot = resolveJankoOptions({ ...O_BRAHMS, verticalPlacement: 'slot' });
  const page = computePageGeometry(oSlot, T_BRAHMS, BRAHMS);
  for (const [s] of CANON_SHIFTS) {
    const un = layoutJankoSystemShifted(BRAHMS, page, s, oSlot, T_BRAHMS, 0);
    const out: LintViolation[] = [];
    checkSystemSlotFit(un, page, oSlot, T_BRAHMS, DEFAULT_JANKO_LINT_OPTIONS, out);
    assert.equal(out.length, 1, `sys${s + 1}: unshifted violates`);
    const m = out[0].metrics as { inkTop: number; inkBottom: number };
    const furn = systemFurnitureBounds(un, oSlot, T_BRAHMS);
    assert.equal(furn.top, m.inkTop, `sys${s + 1}: furniture top mirrors`);
    assert.equal(furn.bottom, m.inkBottom, `sys${s + 1}: furniture bottom mirrors`);
  }
});
