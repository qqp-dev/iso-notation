/**
 * Bounded source-informed hand corrections (ticket §4, operator amendment,
 * the Round 45 §D m. 66 correction and the Round 49 §4 m70 editorial hands).
 *
 * Twenty authorized records: the ten LH → RH corrections — the six
 * descending-line eighths of mm. 23/43 plus the four phrase-continuation notes
 * of mm. 24/44 — and the five RH → LH corrections of performed m. 66, where
 * the printed (linear) reading of bar 37 / second ending puts the low A2/D3
 * reattacks and the tied F3 in the left hand, so the “9222” column reads
 * two-handed — plus the five m70 editorial records of performed m. 70
 * (three flips, two confirm-only). All twenty are applied as a declarative
 * score-layer table AFTER the validated written-duration overlay (original
 * MIDI-track keys) and BEFORE hand-crossing computation. Source cross-staff
 * movement never forces a hand change by itself; only this table retargets,
 * with exact guards, and whole-piece hand fidelity remains uncertified
 * (notably the mm. 61–62 cross-voice unison).
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

/**
 * Round 49 §4 — the m70 editorial hands in performed m. 70: three flips
 * (953/954 LH → RH, 955 RH → LH) plus two confirm-only records (956/957 stay
 * RH). Same tuple-guard convention: [pitchClass, octave, startTick, duration].
 * A confirm-only record pins the musical identity without changing the hand,
 * so a future track-label change fails closed instead of silently moving it.
 */
const M70_FLIP: ReadonlyMap<string, readonly [number, number, number, number]> = new Map([
  ['brahms-op118-no1-953', [1, 3, 13392, 24]],
  ['brahms-op118-no1-954', [9, 3, 13416, 24]],
  ['brahms-op118-no1-955', [9, 1, 13440, 48]],
]);
const M70_CONFIRM: ReadonlyMap<string, readonly [number, number, number, number]> = new Map([
  ['brahms-op118-no1-956', [1, 4, 13440, 24]],
  ['brahms-op118-no1-957', [9, 4, 13464, 24]],
]);

test('Table v4 carries exactly the twenty authorized corrections, direction faithful', () => {
  assert.equal(BRAHMS_HAND_CORRECTIONS_VERSION, 4, 'amendment version');
  assert.equal(BRAHMS_HAND_CORRECTIONS.length, 20, 'twenty records, no more');
  const ids = BRAHMS_HAND_CORRECTIONS.map((c) => c.expectedId);
  assert.deepEqual(
    [...ids].sort(),
    [...TEN.keys(), ...M66.keys(), ...M70_FLIP.keys(), ...M70_CONFIRM.keys()].sort(),
    'exactly the twenty targets (ten mm. 23/43 + five m. 66 + five m. 70)'
  );
  for (const c of BRAHMS_HAND_CORRECTIONS) {
    const flip = M70_FLIP.get(c.expectedId);
    const confirm = M70_CONFIRM.get(c.expectedId);
    const m66 = M66.get(c.expectedId);
    const [pc, oct, tick, dur] = flip ?? confirm ?? m66 ?? TEN.get(c.expectedId)!;
    assert.equal(c.pitchClass, pc, `${c.expectedId}: pitch class`);
    assert.equal(c.octave, oct, `${c.expectedId}: octave`);
    assert.equal(c.startTick, tick, `${c.expectedId}: onset`);
    assert.equal(c.durationTicks, dur, `${c.expectedId}: written duration`);
    if (flip) {
      // Round 49 §4 flips: 953/954 LH → RH, 955 RH → LH.
      assert.equal(
        `${c.expectedOriginalHand}->${c.correctedHand}`,
        c.expectedId === 'brahms-op118-no1-955' ? 'RH->LH' : 'LH->RH',
        `${c.expectedId}: flip direction`
      );
    } else if (confirm) {
      assert.equal(c.expectedOriginalHand, 'RH', `${c.expectedId}: original RH (m. 70 confirm)`);
      assert.equal(c.correctedHand, 'RH', `${c.expectedId}: confirmed RH (no change)`);
    } else if (m66) {
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

test('Twenty and only twenty hand changes; every other field of all 964 preserved', () => {
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
      // LH → RH, the five m. 66 corrections are RH → LH, the three m. 70
      // flips follow the operator's §4 prescription. Nothing else moves.
      // Confirm-only records (956/957) change no hand and never appear here.
      const isM66 = M66.has(a.id);
      const isM70Flip = M70_FLIP.has(a.id);
      assert.ok(isM66 || isM70Flip || TEN.has(a.id), `${a.id}: a guarded correction target`);
      if (isM66) {
        assert.equal(a.hand, 'RH', `${a.id}: original hand`);
        assert.equal(b.hand, 'LH', `${a.id}: corrected hand`);
        rhToLh.push(a.id);
      } else if (isM70Flip) {
        const want = a.id === 'brahms-op118-no1-955' ? ['RH', 'LH'] : ['LH', 'RH'];
        assert.equal(a.hand, want[0], `${a.id}: original hand`);
        assert.equal(b.hand, want[1], `${a.id}: corrected hand`);
        (want[1] === 'RH' ? lhToRh : rhToLh).push(a.id);
      } else {
        assert.equal(a.hand, 'LH', `${a.id}: original hand`);
        assert.equal(b.hand, 'RH', `${a.id}: corrected hand`);
        lhToRh.push(a.id);
      }
    }
  }
  assert.deepEqual(changed.sort(), [...TEN.keys(), ...M66.keys(), ...M70_FLIP.keys()].sort(), 'exactly the eighteen retargets (confirms change nothing)');
  assert.deepEqual(lhToRh.sort(), [...TEN.keys(), 'brahms-op118-no1-953', 'brahms-op118-no1-954'].sort(), 'twelve LH → RH (mm. 23/43 + m. 70 run)');
  assert.deepEqual(rhToLh.sort(), [...M66.keys(), 'brahms-op118-no1-955'].sort(), 'six RH → LH (m. 66 + m. 70 bass)');
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
  // The painted bridges dissolve through the UNCHANGED same-hand grouping
  // rule — no renderer exception, no threshold change — and no vertical chord
  // touches a corrected note anymore. Round 49 §1 renders every authenticated
  // written chain, so the newly revealed continuation heads join same-hand
  // runs and re-group a few bridges back (13 → 29 heads): 38 → 33 net is the
  // intentional recount of the same rule on the fuller written surface.
  let bridges = 0;
  for (let p = 0; p < 5; p++) {
    bridges += (renderJankoPage(SCORE, p, O, T).match(/class="janko-chord-bridge"/g) ?? []).length;
  }
  // Round 45 adds one more: the m. 66 hand correction removes a fifth bridge
  // (39 → 38), through the same unchanged same-hand grouping rule.
  assert.equal(bridges, 33, 'the bridges regroup under the Round 49 §1 written chains (was 38)');
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
  // Confirm-only records are targets too: their hands must equal the baseline.
  for (const n of SCORE.notes) {
    if (TEN.has(n.id) || M66.has(n.id) || M70_FLIP.has(n.id) || M70_CONFIRM.has(n.id)) continue;
    assert.equal(n.hand, pre.find((x) => x.id === n.id)!.hand, `${n.id}: hand untouched`);
  }
});

test('m70 editorial hands: exact flips, confirms, raw provenance and occupancy', () => {
  // §4 prescription, verbatim: first four of the run LH, next four RH,
  // separate low bass LH; 953/954 flip, 956/957 confirm, 955 flips to LH.
  const want: ReadonlyMap<string, 'LH' | 'RH'> = new Map([
    ['brahms-op118-no1-949', 'LH'],
    ['brahms-op118-no1-950', 'LH'],
    ['brahms-op118-no1-951', 'LH'],
    ['brahms-op118-no1-952', 'LH'],
    ['brahms-op118-no1-953', 'RH'],
    ['brahms-op118-no1-954', 'RH'],
    ['brahms-op118-no1-955', 'LH'],
    ['brahms-op118-no1-956', 'RH'],
    ['brahms-op118-no1-957', 'RH'],
  ]);
  for (const [id, hand] of want) {
    assert.equal(SCORE.notes.find((x) => x.id === id)!.hand, hand, `${id}: editorial display hand`);
  }
  // Raw source provenance is retained on every m70 record: the flipped run
  // halves stay leftHandLower (lower staff), the bass stays leftHandUpper.
  const src: ReadonlyMap<string, [string, string]> = new Map([
    ['brahms-op118-no1-953', ['leftHandLower', 'lower']],
    ['brahms-op118-no1-954', ['leftHandLower', 'lower']],
    ['brahms-op118-no1-955', ['leftHandUpper', 'upper']],
    ['brahms-op118-no1-956', ['leftHandLower', 'upper']],
    ['brahms-op118-no1-957', ['leftHandLower', 'upper']],
  ]);
  for (const [id, [voice, staff]] of src) {
    const n = SCORE.notes.find((x) => x.id === id)!;
    assert.ok(n.sourceProvenance?.voices.includes(voice), `${id}: source voice ${voice} retained`);
    assert.ok(n.sourceProvenance?.staves.includes(staff), `${id}: source staff ${staff} retained`);
    assert.ok(n.sourceProvenance?.hands.includes('LH'), `${id}: source hand LH retained`);
  }
  // Authoritative occupancy including sustained voices: the displayed LH is
  // silent across 13392–13440 (no LH ink), the LH bass 955 sounds through
  // 13440–13488, and the RH upper chord sustains across the whole window.
  const handOf = (id: string): 'LH' | 'RH' => SCORE.notes.find((x) => x.id === id)!.hand;
  const sounds = (tick: number, dur: number, hand: 'LH' | 'RH'): string[] =>
    SCORE.notes
      .filter((n) => handOf(n.id) === hand && n.startTick < tick + dur - 1e-9 && n.startTick + n.durationTicks > tick + 1e-9)
      .map((n) => n.id);
  assert.deepEqual(sounds(13392, 24, 'LH'), [], 'displayed LH silent at 13392');
  assert.deepEqual(sounds(13416, 24, 'LH'), [], 'displayed LH silent at 13416');
  assert.ok(sounds(13440, 48, 'LH').includes('brahms-op118-no1-955'), 'LH bass 955 sounds at 13440');
  assert.ok(sounds(13464, 24, 'LH').includes('brahms-op118-no1-955'), 'LH bass 955 sustains at 13464');
  for (const id of ['brahms-op118-no1-939', 'brahms-op118-no1-940', 'brahms-op118-no1-941']) {
    assert.ok(sounds(13392, 24, 'RH').includes(id), `${id}: RH upper chord sustains at 13392`);
    assert.ok(sounds(13440, 48, 'RH').includes(id), `${id}: RH upper chord sustains at 13440`);
  }
  // The editorial hands regroup the beams: 953+954 beam RH, 956+957 stay RH.
  const layouts = layoutJankoScore(SCORE, O, T);
  const beamOf = (id: string): string[] => {
    const beam = layouts.flatMap((l) => l.beams).find((b) => b.notes.some((n) => n.id === id))!;
    assert.ok(beam, `${id}: beamed`);
    return beam.notes.map((n) => `${n.id}:${n.hand}`);
  };
  assert.deepEqual(beamOf('brahms-op118-no1-953'), ['brahms-op118-no1-953:RH', 'brahms-op118-no1-954:RH'], '953+954 beam RH');
  assert.deepEqual(beamOf('brahms-op118-no1-956'), ['brahms-op118-no1-956:RH', 'brahms-op118-no1-957:RH'], '956+957 beam RH');
  // Guard failures stay fail-closed for the new records.
  const pre = buildPreCorrectionNotes();
  const badHand = BRAHMS_HAND_CORRECTIONS.map((c) =>
    c.expectedId === 'brahms-op118-no1-953' ? { ...c, expectedOriginalHand: 'RH' as const } : c
  );
  assert.throws(() => applyBrahmsHandCorrections(pre, badHand), /no score note matches/);
  const badDur = BRAHMS_HAND_CORRECTIONS.map((c) =>
    c.expectedId === 'brahms-op118-no1-955' ? { ...c, durationTicks: c.durationTicks + 1 } : c
  );
  assert.throws(() => applyBrahmsHandCorrections(pre, badDur), /has duration/);
});

test('Round 49 §4 authority: every correction carries an auditable resolution, and the resolution governs inference', () => {
  // The audit record: every corrected note states which record authorized it
  // and whether the record flipped the hand or only confirmed it. The raw
  // sourceProvenance beside it is never mutated.
  const kinds: ReadonlyMap<string, 'flip' | 'confirm'> = new Map([
    ['brahms-op118-no1-953', 'flip'],
    ['brahms-op118-no1-954', 'flip'],
    ['brahms-op118-no1-955', 'flip'],
    ['brahms-op118-no1-956', 'confirm'],
    ['brahms-op118-no1-957', 'confirm'],
  ]);
  for (const c of BRAHMS_HAND_CORRECTIONS) {
    const n = SCORE.notes.find((x) => x.id === c.expectedId)!;
    assert.ok(n.editorialHand, `${c.expectedId}: carries an editorial resolution`);
    assert.equal(n.editorialHand!.hand, c.correctedHand, `${c.expectedId}: the resolved hand`);
    assert.equal(n.editorialHand!.authorityId, c.expectedId, `${c.expectedId}: the audit trail names the record`);
    assert.equal(
      n.editorialHand!.kind,
      kinds.get(c.expectedId) ?? 'flip',
      `${c.expectedId}: flip vs confirm exactly as the table declares`
    );
  }
  // Only corrected events carry authority; an uncorrected neighbour does not.
  assert.equal(
    SCORE.notes.filter((n) => n.editorialHand).length,
    BRAHMS_HAND_CORRECTIONS.length,
    'authority exists on exactly the authorized events'
  );
  // The resolution *governs the rest inference* — the assertion that fails
  // under the display-only implementation, where the raw source label
  // (leftHandLower) vetoed the inference through the withheld path:
  const layouts = layoutJankoScore(SCORE, O, T);
  const painted = layouts.flatMap((l) => l.rests).filter((r) => r.tick === 13392 && r.hand === 'LH');
  assert.equal(painted.length, 1, 'the truthful LH quarter rest at 13392 is painted');
  assert.equal(painted[0]!.authored, false, 'derived from occupancy, not from a source-written rest');
  const withheldHere = layouts
    .flatMap((l) => l.withheldRests)
    .filter((w) => w.tick >= 13392 && w.hand === 'LH');
  assert.deepEqual(
    withheldHere.map((w) => w.tick),
    [],
    'no withheld veto at 13392 or later: the resolved hand decides, the raw label does not'
  );
  // Conservatism survives elsewhere: m. 66 (no authority) still withholds.
  const withheld66 = layouts.flatMap((l) => l.withheldRests).filter((w) => w.tick === 12528);
  assert.equal(withheld66.length, 1, 'the unresolved m. 66 case keeps the conservative source veto');
});
