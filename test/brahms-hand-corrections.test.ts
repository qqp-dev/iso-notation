/**
 * Bounded source-informed hand corrections (ticket §4, operator amendment and
 * the Round 45 §D m. 66 correction).
 *
 * Fifteen authorized retargetings: the ten LH → RH corrections — the six
 * descending-line eighths of mm. 23/43 plus the four phrase-continuation notes
 * of mm. 24/44 — and the five RH → LH corrections of performed m. 66, where
 * the printed (linear) reading of bar 37 / second ending puts the low A2/D3
 * reattacks and the tied F3 in the left hand, so the “9222” column reads
 * two-handed. All fifteen are applied as a declarative score-layer table AFTER
 * the validated written-duration overlay (original MIDI-track keys) and BEFORE
 * hand-crossing computation. Source cross-staff movement never forces a hand
 * change by itself; only this table retargets, with exact guards, and
 * whole-piece hand fidelity remains uncertified (notably the mm. 61–62
 * cross-voice unison).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseMidiToScore } from '../src/model/midi';
import { applyWrittenDurations } from '../src/scores/brahms-source-fidelity';
import {
  BRAHMS_OP118_NO1_JANKO_OPTIONS,
  BRAHMS_OP118_NO1_JANKO_TOKENS,
  BRAHMS_OP118_NO1_TOTAL_TICKS,
  buildBrahmsOp118No1Score,
  getBrahmsMidiData,
} from '../src/scores/brahms-op118-no1';
import {
  applyBrahmsHandCorrections,
  BRAHMS_HAND_CORRECTIONS,
  BRAHMS_HAND_CORRECTIONS_VERSION,
} from '../src/scores/brahms-hand-corrections';
import {
  DEFAULT_JANKO_OPTIONS,
  DEFAULT_JANKO_TOKENS,
  resolveJankoOptions,
  resolveJankoTokens,
} from '../src/render/janko/types';
import {
  layoutJankoScore,
  renderJankoPage,
  suppressedStemIds,
} from '../src/render/janko/engine';
const REPO_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const FIXTURE_PATH = path.join(REPO_ROOT, 'src', 'scores', 'data', 'brahms-op118-no1-written-durations.json');

type FixtureDoc = { durations: DurEntry[] };
const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8')) as FixtureDoc;

const SCORE = buildBrahmsOp118No1Score();
const O = resolveJankoOptions({ ...DEFAULT_JANKO_OPTIONS, ...BRAHMS_OP118_NO1_JANKO_OPTIONS });
const T = resolveJankoTokens({ ...DEFAULT_JANKO_TOKENS, ...BRAHMS_OP118_NO1_JANKO_TOKENS });

/** Reconstruct pre-overlay MIDI notes (IDs/order as the builder assigns). */
function buildPreOverlayNotes() {
  const parsed = parseMidiToScore(getBrahmsMidiData(), {
    id: 'brahms-op118-no1',
    title: 'Intermezzo in A minor, Op. 118 No. 1',
    composer: 'Johannes Brahms',
  });
  return parsed.notes
    .filter((n) => n.startTick < BRAHMS_OP118_NO1_TOTAL_TICKS)
    .map((n, idx) => ({ ...n, id: `brahms-op118-no1-${idx + 1}` }));
}

type DurEntry = {
  pitchClass: number;
  octave: number;
  startTick: number;
  hand: 'RH' | 'LH';
  durationTicks: number;
};

/** The duration-overlay boundary: pre-hand-correction, original track keys. */
function buildPreCorrectionNotes() {
  return applyWrittenDurations(buildPreOverlayNotes(), fixture.durations);
}

/** The ten original LH → RH targets: id → [pitchClass, octave, startTick, duration]. */
const TEN: ReadonlyMap<string, readonly [number, number, number, number]> = new Map([
  ['brahms-op118-no1-315', [0, 4, 4392, 24]],
  ['brahms-op118-no1-317', [9, 3, 4416, 24]],
  ['brahms-op118-no1-319', [6, 3, 4440, 24]],
  ['brahms-op118-no1-321', [3, 3, 4464, 96]],
  ['brahms-op118-no1-326', [4, 3, 4560, 48]],
  ['brahms-op118-no1-601', [0, 4, 8232, 24]],
  ['brahms-op118-no1-603', [9, 3, 8256, 24]],
  ['brahms-op118-no1-605', [6, 3, 8280, 24]],
  ['brahms-op118-no1-607', [3, 3, 8304, 96]],
  ['brahms-op118-no1-612', [4, 3, 8400, 48]],
]);

/**
 * Round 45 §D — the five RH → LH corrections of performed m. 66: the two
 * low-staff reattacks, the tied F3 and the two low heads of the tick-12624
 * “9222” column. Same tuple-guard convention as the original ten.
 */
const M66: ReadonlyMap<string, readonly [number, number, number, number]> = new Map([
  ['brahms-op118-no1-908', [9, 2, 12552, 24]],
  ['brahms-op118-no1-910', [2, 3, 12576, 24]],
  ['brahms-op118-no1-912', [5, 3, 12600, 120]],
  ['brahms-op118-no1-913', [9, 2, 12624, 96]],
  ['brahms-op118-no1-914', [2, 3, 12624, 96]],
]);

test('Table v3 carries exactly the fifteen authorized corrections, direction faithful', () => {
  assert.equal(BRAHMS_HAND_CORRECTIONS_VERSION, 3, 'amendment version');
  assert.equal(BRAHMS_HAND_CORRECTIONS.length, 15, 'fifteen records, no more');
  const ids = BRAHMS_HAND_CORRECTIONS.map((c) => c.expectedId);
  assert.deepEqual(
    [...ids].sort(),
    [...TEN.keys(), ...M66.keys()].sort(),
    'exactly the fifteen targets (ten mm. 23/43 + five m. 66)'
  );
  for (const c of BRAHMS_HAND_CORRECTIONS) {
    const m66 = M66.get(c.expectedId);
    const [pc, oct, tick, dur] = m66 ?? TEN.get(c.expectedId)!;
    assert.equal(c.pitchClass, pc, `${c.expectedId}: pitch class`);
    assert.equal(c.octave, oct, `${c.expectedId}: octave`);
    assert.equal(c.startTick, tick, `${c.expectedId}: onset`);
    assert.equal(c.durationTicks, dur, `${c.expectedId}: written duration`);
    if (m66) {
      assert.equal(c.expectedOriginalHand, 'RH', `${c.expectedId}: original RH (m. 66)`);
      assert.equal(c.correctedHand, 'LH', `${c.expectedId}: corrected LH (m. 66)`);
      assert.ok(c.logicalPart.includes('leftHandUpper'), `${c.expectedId}: LH part`);
    } else {
      assert.equal(c.expectedOriginalHand, 'LH', `${c.expectedId}: original LH`);
      assert.equal(c.correctedHand, 'RH', `${c.expectedId}: corrected RH`);
      assert.ok(c.logicalPart.includes('rightHandUpper'), `${c.expectedId}: RH part`);
    }
    assert.ok(c.sourceFile.endsWith('.ily'), `${c.expectedId}: source file`);
    assert.ok(c.sourceLines.length > 0, `${c.expectedId}: source lines`);
    assert.ok(c.performedOccurrence.length > 0, `${c.expectedId}: occurrence`);
  }
  // Onset order, deterministic.
  const ticks = BRAHMS_HAND_CORRECTIONS.map((c) => c.startTick);
  assert.deepEqual([...ticks].sort((a, b) => a - b), ticks, 'ordered by onset');
});

test('Fifteen and only fifteen hand changes; every other field of all 964 preserved', () => {
  const pre = buildPreCorrectionNotes();
  assert.equal(pre.length, 964);
  assert.equal(SCORE.notes.length, 964);
  const changed: string[] = [];
  const lhToRh: string[] = [];
  const rhToLh: string[] = [];
  for (let i = 0; i < 964; i++) {
    const a = pre[i];
    const b = SCORE.notes[i];
    assert.equal(b.id, a.id, `order kept at index ${i}`);
    assert.deepEqual(b.pitch, a.pitch, `${a.id}: pitch`);
    assert.equal(b.startTick, a.startTick, `${a.id}: onset`);
    assert.equal(b.durationTicks, a.durationTicks, `${a.id}: written duration`);
    assert.equal(b.velocity, a.velocity, `${a.id}: velocity`);
    if (a.hand !== b.hand) {
      changed.push(a.id);
      // Direction is guarded per record: the ten mm. 23/43 corrections are
      // LH → RH, the five m. 66 corrections are RH → LH. Nothing else moves.
      const isM66 = M66.has(a.id);
      assert.equal(a.hand, isM66 ? 'RH' : 'LH', `${a.id}: original hand`);
      assert.equal(b.hand, isM66 ? 'LH' : 'RH', `${a.id}: corrected hand`);
      (isM66 ? rhToLh : lhToRh).push(a.id);
    }
  }
  assert.deepEqual(changed.sort(), [...TEN.keys(), ...M66.keys()].sort(), 'exactly the fifteen retargets');
  assert.deepEqual(lhToRh.sort(), [...TEN.keys()].sort(), 'ten LH → RH (mm. 23/43)');
  assert.deepEqual(rhToLh.sort(), [...M66.keys()].sort(), 'five RH → LH (m. 66)');
});

test('Cross-staff never forces a hand: the overlay preserves staff-track LH', () => {
  // The approved passage sits cross-staff in the source (rightHandUpper
  // staffDown), yet the duration overlay keeps all ten targets LH — the
  // staff destination is the track label, not a hand change. Only the
  // correction table retargets, afterwards.
  const pre = buildPreCorrectionNotes();
  for (const id of TEN.keys()) {
    const n = pre.find((x) => x.id === id)!;
    assert.equal(n.hand, 'LH', `${id}: pre-correction track hand stays LH`);
  }
  const corrected = applyBrahmsHandCorrections(pre);
  for (const id of TEN.keys()) {
    assert.equal(corrected.find((x) => x.id === id)!.hand, 'RH', `${id}: table retargets RH`);
  }
  // The table is the builder's table: applying it reproduces the score hands.
  assert.deepEqual(
    corrected.map((n) => n.hand),
    SCORE.notes.map((n) => n.hand),
    'score hands equal overlay + table, nothing else'
  );
});

test('Guards fail closed: missing/duplicate/mismatched targets throw', () => {
  const pre = buildPreCorrectionNotes();
  // Intended table passes.
  assert.equal(applyBrahmsHandCorrections(pre).length, 964);
  // Missing target.
  const missing = BRAHMS_HAND_CORRECTIONS.map((c, i) =>
    i === 0 ? { ...c, startTick: c.startTick + 1 } : c
  );
  assert.throws(() => applyBrahmsHandCorrections(pre, missing), /no score note matches/);
  // Duplicate correction.
  assert.throws(
    () => applyBrahmsHandCorrections(pre, [...BRAHMS_HAND_CORRECTIONS, BRAHMS_HAND_CORRECTIONS[0]]),
    /duplicate correction/
  );
  // Unexpected original hand.
  const wrongHand = BRAHMS_HAND_CORRECTIONS.map((c, i) =>
    i === 0 ? { ...c, expectedOriginalHand: 'RH' as const } : c
  );
  assert.throws(() => applyBrahmsHandCorrections(pre, wrongHand), /no score note matches/);
  // Unexpected duration.
  const wrongDur = BRAHMS_HAND_CORRECTIONS.map((c, i) =>
    i === 0 ? { ...c, durationTicks: c.durationTicks + 1 } : c
  );
  assert.throws(() => applyBrahmsHandCorrections(pre, wrongDur), /has duration/);
  // Unexpected id.
  const wrongId = BRAHMS_HAND_CORRECTIONS.map((c, i) =>
    i === 0 ? { ...c, expectedId: 'brahms-op118-no1-9999' } : c
  );
  assert.throws(() => applyBrahmsHandCorrections(pre, wrongId), /expected brahms-op118-no1-9999/);
  // Missing source correspondence.
  const noSource = BRAHMS_HAND_CORRECTIONS.map((c, i) =>
    i === 0 ? { ...c, sourceLines: '' } : c
  );
  assert.throws(() => applyBrahmsHandCorrections(pre, noSource), /lacks source correspondence/);
});

test('Literal m.23/m.43: full RH run over LH bass; the four bridges dissolve', () => {
  for (const [run, bass] of [
    [
      ['brahms-op118-no1-315', 'brahms-op118-no1-317', 'brahms-op118-no1-319'],
      ['brahms-op118-no1-314', 'brahms-op118-no1-316', 'brahms-op118-no1-318'],
    ],
    [
      ['brahms-op118-no1-601', 'brahms-op118-no1-603', 'brahms-op118-no1-605'],
      ['brahms-op118-no1-600', 'brahms-op118-no1-602', 'brahms-op118-no1-604'],
    ],
  ] as const) {
    for (const id of run) {
      const n = SCORE.notes.find((x) => x.id === id)!;
      assert.equal(n.hand, 'RH', `${id}: descending line is RH`);
      assert.equal(n.durationTicks, 24, `${id}: eighth kept`);
    }
    for (const id of bass) {
      const n = SCORE.notes.find((x) => x.id === id)!;
      assert.equal(n.hand, 'LH', `${id}: bass stays LH`);
    }
  }
  // The four painted bridges (39 → 35) dissolve through the UNCHANGED
  // same-hand grouping rule — no renderer exception, no threshold change —
  // and no vertical chord touches a corrected note anymore.
  let bridges = 0;
  for (let p = 0; p < 5; p++) {
    bridges += (renderJankoPage(SCORE, p, O, T).match(/class="janko-chord-bridge"/g) ?? []).length;
  }
  // Round 45 adds one more: the m. 66 hand correction removes a fifth bridge
  // (39 → 38), through the same unchanged same-hand grouping rule.
  assert.equal(bridges, 38, 'five bridges gone (was 39)');
  const layouts = layoutJankoScore(SCORE, O, T);
  const touched = layouts
    .flatMap((l) => l.verticalChords ?? [])
    .filter((c) => [c.carrier.id, ...c.suppressedIds].some((id) => TEN.has(id)));
  assert.deepEqual(touched, [], 'no chord groups a corrected note');
});

test('Corrected notes keep complete duration statements: beamed eighths, own stems, no orphans', () => {
  const layouts = layoutJankoScore(SCORE, O, T);
  const beams = layouts.flatMap((l) => l.beams ?? []);
  // The six eighths ride their RH beam runs with painted stems.
  for (const id of [
    'brahms-op118-no1-315',
    'brahms-op118-no1-317',
    'brahms-op118-no1-319',
    'brahms-op118-no1-601',
    'brahms-op118-no1-603',
    'brahms-op118-no1-605',
  ]) {
    assert.ok(
      beams.some((b) => b.notes.some((n) => n.id === id)),
      `${id}: beamed eighth keeps its run`
    );
  }
  // Every corrected note paints its own stem: unbracketed, unsuppressed,
  // un-beamed ones (321/326/607/612) carry full standalone statements.
  for (const id of TEN.keys()) {
    const l = layouts.find((x) => x.notes.some((p) => p.note.id === id))!;
    assert.ok(!suppressedStemIds(l).has(id), `${id}: stem paints (no orphan)`);
  }
  // The phrase tails keep their exact long values (half / quarter).
  assert.equal(SCORE.notes.find((n) => n.id === 'brahms-op118-no1-321')!.durationTicks, 96);
  assert.equal(SCORE.notes.find((n) => n.id === 'brahms-op118-no1-326')!.durationTicks, 48);
  assert.equal(SCORE.notes.find((n) => n.id === 'brahms-op118-no1-607')!.durationTicks, 96);
  assert.equal(SCORE.notes.find((n) => n.id === 'brahms-op118-no1-612')!.durationTicks, 48);
});

test('Uncertified territory untouched: mm.61–62 unison and all other hands', () => {
  // The cross-voice unison projection (single max-duration survivor) keeps
  // its LH track hand: expressly NOT reinterpreted by this ticket.
  const pre = buildPreCorrectionNotes();
  const at = (tick: number): string[] =>
    SCORE.notes.filter((n) => n.startTick === tick).map((n) => `${n.id}:${n.hand}`);
  const preAt = (tick: number): string[] =>
    pre.filter((n) => n.startTick === tick).map((n) => `${n.id}:${n.hand}`);
  assert.deepEqual(at(11568), preAt(11568), 'tick-11568 unison hands byte-identical');
  assert.deepEqual(at(11568), ['brahms-op118-no1-858:LH'], 'the LH survivor stands');
  // Every untargeted hand on the whole score matches the track baseline.
  for (const n of SCORE.notes) {
    if (TEN.has(n.id) || M66.has(n.id)) continue;
    assert.equal(n.hand, pre.find((x) => x.id === n.id)!.hand, `${n.id}: hand untouched`);
  }
});
