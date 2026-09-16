/**
 * Legitimate onset shifts (defect fix for the STOP-state 1+14).
 *
 * Bracketed slots desire {-G,0} relative to the nominal beat column; an
 * unbracketed pair desires {0,+G} (lowest ON the column). A downbeat group
 * whose nominal sits on its cell edge desires one slot past the edge (and,
 * at a measure opening, onto its barline). Retiring the old fan's
 * mirror/shrink without any rigid translation left honest residue that the
 * linter correctly flagged (1 grid crossing on Bach, 9 barline collisions
 * + 2 stem-through + 1 grid crossing on Brahms adaptive, plus the m.37
 * clasp demotion).
 *
 * The fix is the ticket's legitimate common-onset spacing translation: the
 * whole onset steps rigidly — never sheared, gaps never shrunk — by the
 * minimal shift that brings every head inside the measure band and the beat
 * cell. Shifts apply before clasp admission so brackets are judged where
 * they paint; Phase 2 refines them against neighbours and time order.
 * Demands stay reported in clusterDiagnostics; the ink fits.
 *
 *  - Bach t1632 (m.12 joint pair): lower ON the column, upper one slot
 *    right, both inside their cell with no demand at all, zero crossings
 *    (also pinned via the Pairs/Pin suites relative to the solved column).
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
import {
  checkGridCrossingOffset,
  lintJankoScore,
  type LintViolation,
} from '../src/render/janko/linter';

const BACH = buildBachGoldbergVar1Score();
const BRAHMS = buildBrahmsOp118No1Score();
const O_BACH = resolveJankoOptions(DEFAULT_JANKO_OPTIONS);
const T_BACH = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
const O_ADAPTIVE = resolveJankoOptions({ ...BRAHMS_OP118_NO1_JANKO_OPTIONS, core: 'adaptive' });
const T_BRAHMS = resolveJankoTokens(BRAHMS_OP118_NO1_JANKO_TOKENS);
const G = getClusterSpacingPreset('tight').pairGap;

test('legitimate shifts: Bach t1632 lower ON column, both fit, zero crossings', () => {
  const layouts = layoutJankoScore(BACH, O_BACH, T_BACH);
  const pair = layouts.flatMap((l) => l.notes).filter((p) => p.note.startTick === 1632);
  assert.equal(pair.length, 2, 'the m.12 joint pair');
  assert.ok(Math.abs(Math.abs(pair[0].x - pair[1].x) - G) < 0.1, 'the pair keeps the judged gap');
  // One note per hand: no bracket qualifies, so the lower head sits ON the
  // solved column and the upper one slot right — no inward demand exists to
  // report, and both heads fit their beat cell with no shift at all.
  const column = layouts.find((l) => l.columns.has(1632))!.columns.get(1632)!;
  const xs = pair.map((p) => p.x).sort((a, b) => a - b);
  assert.ok(Math.abs(xs[0] - column) < 0.1, 'lower head ON the solved column');
  assert.ok(Math.abs(xs[1] - (column + G)) < 0.1, 'upper head one slot right');
  for (const p of pair) {
    assert.ok(
      p.x >= (p.beatCell?.left ?? 0) - 1e-9 && p.x <= (p.beatCell?.right ?? 0) + 1e-9,
      `${p.note.id} stays inside its beat cell`
    );
  }
  const diag = layouts.flatMap((l) => l.clusterDiagnostics ?? []).find((d) => d.tick === 1632);
  assert.equal(diag, undefined, 'no demand: both heads desire inside their cell');
  const report = lintJankoScore(BACH, O_BACH, T_BACH);
  assert.equal(
    report.violations.filter((v) => v.code === 'grid-crossing-offset').length,
    0,
    'zero grid crossings on Goldberg'
  );
});

test('legitimate shifts: downbeat barline triples clear their barlines, zero collisions', () => {
  const layouts = layoutJankoScore(BRAHMS, O_ADAPTIVE, T_BRAHMS);
  // Repaired anchoring (§2 line 18): each triple's joint bucket is led by its
  // unbracketed lone head (17/152/436), so the lowest sits ON the column and
  // nothing leaves the beat cell — the retired any-qualified inward rule used
  // to manufacture a barline-side demand here; zero demand is the honest
  // report now. The triples' brackets stay honestly bare on both rules: the
  // pip ring meets a same-onset head at dx 4.10 (rigid-invariant, HEAD-bare
  // too), and every fallback is finding-clean.
  for (const [tick, lowestId] of [
    [240, 'brahms-op118-no1-17'],
    [2160, 'brahms-op118-no1-152'],
    [6000, 'brahms-op118-no1-436'],
  ] as const) {
    const diag = layouts.flatMap((l) => l.clusterDiagnostics ?? []).find((d) => d.tick === tick);
    assert.equal(diag, undefined, `t${tick}: no demand — the unbracketed lowest holds the column`);
    const sys = layouts.find((l) => l.notes.some((p) => p.note.startTick === tick))!;
    const column = sys.columns.get(tick)!;
    const lowest = sys.notes.find((p) => p.note.id === lowestId)!;
    assert.ok(Math.abs(lowest.x - column) < 0.1, `t${tick}: ${lowestId} ON the solved column`);
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

test('grid audit: unchanged heads but pulse moved to the upper head MUST fail', () => {
  // The §5 false-green killer: the m.12 pair stands (486.70, 492.16) with
  // its true column/pulse at the lower head (486.70). Move the declared
  // column — the pulse follows it — to the upper head (492.16) while the
  // heads stay byte-identical: the lower head now stands outside its final
  // beat cell and the audit must name it. The cached pre-shift cell cannot
  // see this (both heads sit inside the nominal span either way).
  const layouts = layoutJankoScore(BACH, O_BACH, T_BACH);
  const sys = layouts.find((l) => l.columns.has(1632))!;
  const pair = sys.notes
    .filter((p) => p.note.startTick === 1632)
    .sort((a, b) => a.x - b.x);
  assert.equal(pair.length, 2);
  assert.equal(pair[0].x.toFixed(2), '486.70', 'lower head on the true column');
  assert.equal(pair[1].x.toFixed(2), '492.16', 'upper head one slot right');
  const hacked = { ...sys, columns: new Map([...sys.columns, [1632, pair[1].x] as const]) };
  const out: LintViolation[] = [];
  checkGridCrossingOffset(hacked, O_BACH, T_BACH, out);
  const hits = out.filter(
    (v) => v.code === 'grid-crossing-offset' && (v.noteIds ?? []).includes(pair[0].note.id)
  );
  assert.equal(hits.length, 1, 'the lower head fails its moved cell');
  assert.match(hits[0].message, /preceding beat's territory/);
  // And the unmoved layout is silent.
  const clean: LintViolation[] = [];
  checkGridCrossingOffset(sys, O_BACH, T_BACH, clean);
  assert.deepEqual(
    clean.filter((v) => v.code === 'grid-crossing-offset'),
    [],
    'the true column/pulse audits clean'
  );
});

test('grid audit: zero crossings on the canonical fixed-3 Brahms', () => {
  const O_FIXED3 = resolveJankoOptions({ ...BRAHMS_OP118_NO1_JANKO_OPTIONS, core: 'fixed-3' });
  const report = lintJankoScore(BRAHMS, O_FIXED3, T_BRAHMS);
  assert.equal(
    report.violations.filter((v) => v.code === 'grid-crossing-offset').length,
    0,
    'zero grid crossings on canonical Brahms'
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
