/**
 * Legitimate onset shifts (defect fix for the STOP-state 1+14).
 *
 * The permanent lowest-inward slots desire {-G,0} relative to the nominal
 * beat column. A downbeat pair whose nominal sits on its cell edge desires
 * one slot past the edge (and, at a measure opening, onto its barline).
 * Retiring the old fan's mirror/shrink without any rigid translation left
 * honest residue that the linter correctly flagged (1 grid crossing on Bach,
 * 9 barline collisions + 2 stem-through + 1 grid crossing on Brahms adaptive,
 * plus the m.37 clasp demotion).
 *
 * The fix is the ticket's legitimate common-onset spacing translation: the
 * whole onset steps rigidly — never sheared, gaps never shrunk — by the
 * minimal shift that brings every head inside the measure band and the beat
 * cell. Shifts apply before clasp admission so brackets are judged where
 * they paint; Phase 2 refines them against neighbours and time order.
 * Demands stay reported in clusterDiagnostics; the ink fits.
 *
 *  - Bach t1632 (m.12 joint pair): demand reported, shift restores the
 *    pre-change absolute pair, zero crossings (also pinned via the Pairs/Pin
 *    suites relative to the solved column).
 *  - Brahms downbeat barline triples t240/t2160/t6000 (mm.2/12/32): demand
 *    reported, shifts clear the measure-edge barlines, zero collisions.
 *  - Brahms t7056 (m.37): demand reported, shift fits, the clasp re-admits
 *    (no demotion), zero stem-through/grid-crossing.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1';
import {
  BRAHMS_OP118_NO1_JANKO_OPTIONS,
  BRAHMS_OP118_NO1_JANKO_TOKENS,
  buildBrahmsOp118No1Score,
} from '../src/scores/brahms-op118-no1';
import {
  DEFAULT_JANKO_OPTIONS,
  DEFAULT_JANKO_TOKENS,
  getClusterSpacingPreset,
  resolveJankoOptions,
  resolveJankoTokens,
} from '../src/render/janko/types';
import { layoutJankoScore } from '../src/render/janko/engine';
import { lintJankoScore } from '../src/render/janko/linter';

const BACH = buildBachGoldbergVar1Score();
const BRAHMS = buildBrahmsOp118No1Score();
const O_BACH = resolveJankoOptions(DEFAULT_JANKO_OPTIONS);
const T_BACH = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
const O_ADAPTIVE = resolveJankoOptions({ ...BRAHMS_OP118_NO1_JANKO_OPTIONS, core: 'adaptive' });
const T_BRAHMS = resolveJankoTokens(BRAHMS_OP118_NO1_JANKO_TOKENS);
const G = getClusterSpacingPreset('tight').pairGap;

test('legitimate shifts: Bach t1632 demand reported, shift fits, zero crossings', () => {
  const layouts = layoutJankoScore(BACH, O_BACH, T_BACH);
  const pair = layouts.flatMap((l) => l.notes).filter((p) => p.note.startTick === 1632);
  assert.equal(pair.length, 2, 'the m.12 joint pair');
  assert.ok(Math.abs(Math.abs(pair[0].x - pair[1].x) - G) < 0.1, 'the pair keeps the judged gap');
  const column = layouts.find((l) => l.columns.has(1632))!.columns.get(1632)!;
  const xs = pair.map((p) => p.x).sort((a, b) => a - b);
  assert.ok(Math.abs(xs[0] - (column - G)) < 0.1, 'lower head one slot inward of the solved column');
  assert.ok(Math.abs(xs[1] - column) < 0.1, 'upper head on the solved column');
  for (const p of pair) {
    assert.ok(
      p.x >= (p.beatCell?.left ?? 0) - 1e-9 && p.x <= (p.beatCell?.right ?? 0) + 1e-9,
      `${p.note.id} stays inside its beat cell`
    );
  }
  const diag = layouts.flatMap((l) => l.clusterDiagnostics ?? []).find((d) => d.tick === 1632);
  assert.ok(diag, 'the inward demand is reported');
  assert.deepEqual(diag!.memberIds, ['bach-var1-198'], 'the diagnostic names the leaving member');
  const report = lintJankoScore(BACH, O_BACH, T_BACH);
  assert.equal(
    report.violations.filter((v) => v.code === 'grid-crossing-offset').length,
    0,
    'zero grid crossings on Goldberg'
  );
});

test('legitimate shifts: downbeat barline triples clear their barlines, zero collisions', () => {
  const layouts = layoutJankoScore(BRAHMS, O_ADAPTIVE, T_BRAHMS);
  for (const [tick, inwardId] of [
    [240, 'brahms-op118-no1-17'],
    [2160, 'brahms-op118-no1-152'],
    [6000, 'brahms-op118-no1-436'],
  ] as const) {
    const diag = layouts.flatMap((l) => l.clusterDiagnostics ?? []).find((d) => d.tick === tick);
    assert.ok(diag, `t${tick}: the barline-side demand is reported`);
    assert.ok(diag!.memberIds.includes(inwardId), `t${tick}: the diagnostic names ${inwardId}`);
  }
  const report = lintJankoScore(BRAHMS, O_ADAPTIVE, T_BRAHMS);
  assert.equal(
    report.violations.filter((v) => v.code === 'barline-collision').length,
    0,
    'zero barline collisions on Brahms adaptive'
  );
  assert.equal(
    report.violations.filter((v) => v.code === 'grid-crossing-offset').length,
    0,
    'zero grid crossings on Brahms adaptive'
  );
});

test('legitimate shifts: m.37 keeps its clasp, zero stem-through', () => {
  const layouts = layoutJankoScore(BRAHMS, O_ADAPTIVE, T_BRAHMS);
  const sys = layouts.find((l) => l.notes.some((p) => p.note.startTick === 7056))!;
  assert.ok(sys.clasps.some((c) => c.tick === 7056), 'the m.37 onset keeps its bracket (no demotion)');
  const diag = (sys.clusterDiagnostics ?? []).find((d) => d.tick === 7056);
  assert.ok(diag, 'the inward demand is reported');
  assert.deepEqual(diag!.memberIds, ['brahms-op118-no1-515'], 'the diagnostic names the leaving member');
  const report = lintJankoScore(BRAHMS, O_ADAPTIVE, T_BRAHMS);
  const m37 = report.violations.filter((v) => v.measure === 37);
  assert.deepEqual(
    m37.map((v) => v.code).sort(),
    [],
    'm.37 carries no finding (clasp stands, slots fit)'
  );
});
