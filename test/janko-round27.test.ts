/**
 * Round 27: Fixed Cores 3-vs-4 on Brahms with Ottava
 * ===================================================
 *
 * Durable maintained test suite verifying:
 *  1. Registry purity: exactly 2 cards, control = fixed-4, contender = fixed-3,
 *     single open axis ('core'), candidate deltas strictly on the open axis.
 *  2. Brahms fold counts: exactly 9 folded under fixed-3, 1 under fixed-4,
 *     0 on Bach golden master.
 *  3. Bracket coverage: every folded note is covered by exactly one bracket,
 *     and every bracketed note is folded.
 *  4. Densest macro (mm. 33–34) contains folded bass under fixed-3.
 *  5. Candidate captions match rendered fold counts.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1';
import {
  buildBrahmsOp118No1Score,
  BRAHMS_OP118_NO1_JANKO_OPTIONS,
  BRAHMS_OP118_NO1_JANKO_TOKENS,
} from '../src/scores/brahms-op118-no1';
import {
  CURRENT_CANDIDATES,
  CURRENT_ROUND_METADATA,
  getCandidate,
  resolveCandidate,
  candidateBadges,
  BRAHMS_STUDIO_SCORE_ID,
} from '../src/render/janko/candidates';
import {
  DEFAULT_JANKO_OPTIONS,
  DEFAULT_JANKO_TOKENS,
  resolveJankoOptions,
  resolveJankoTokens,
} from '../src/render/janko/types';
import { layoutJankoScore } from '../src/render/janko/engine';
import { checkOttavaCoverage } from '../src/render/janko/linter';

const BRAHMS = buildBrahmsOp118No1Score();
const BACH = buildBachGoldbergVar1Score();

// ---------------------------------------------------------------------------
// 1. Registry purity
// ---------------------------------------------------------------------------

test('Round 27 registry purity: exactly 2 cards, control = fixed-4, single open axis', () => {
  assert.equal(CURRENT_ROUND_METADATA.round, 27);
  assert.match(CURRENT_ROUND_METADATA.title, /Fixed Cores/);
  assert.deepEqual(CURRENT_ROUND_METADATA.openAxes, ['core'], 'only core is an open axis');

  assert.equal(CURRENT_CANDIDATES.length, 2, 'exactly two cards');
  const [control, contender] = CURRENT_CANDIDATES;

  assert.equal(control.id, 'core-fixed-4');
  assert.match(control.label, /Control/);
  assert.equal(control.axis, 'core');
  assert.deepEqual(control.options, { core: 'fixed-4' });

  assert.equal(contender.id, 'core-fixed-3');
  assert.match(contender.label, /Contender/);
  assert.equal(contender.axis, 'core');
  assert.deepEqual(contender.options, { core: 'fixed-3' });

  // Candidate discipline: each card differs only on 'core'
  const golden = resolveJankoOptions(DEFAULT_JANKO_OPTIONS);
  for (const card of CURRENT_CANDIDATES) {
    const resolved = resolveCandidate(card);
    for (const [k, v] of Object.entries(resolved.options)) {
      if (k === 'core') {
        if (card.id === 'core-fixed-4') {
          assert.notEqual(v, golden.core, `${card.id} departs from golden core`);
        } else {
          assert.equal(v, golden.core, `${card.id} matches new golden core`);
        }
      } else {
        assert.deepEqual(v, (golden as any)[k], `${card.id} leaves ${k} locked to golden`);
      }
    }
  }
});

// ---------------------------------------------------------------------------
// 2. Fold counts on Brahms and Bach
// ---------------------------------------------------------------------------

test('Brahms fold counts: exactly 9 under fixed-3, 1 under fixed-4, 0 on Bach golden', () => {
  const t = resolveJankoTokens(BRAHMS_OP118_NO1_JANKO_TOKENS);

  // Fixed-3 on Brahms: exactly 9 folded notes
  const f3Opts = resolveJankoOptions({ ...BRAHMS_OP118_NO1_JANKO_OPTIONS, core: 'fixed-3' });
  const f3Layouts = layoutJankoScore(BRAHMS, f3Opts, t);
  const f3Folded = f3Layouts.flatMap((s) => s.notes).filter((n) => n.ottavaShift !== undefined);
  assert.equal(f3Folded.length, 9, 'fixed-3 on Brahms has exactly 9 folded notes');
  for (const n of f3Folded) {
    assert.equal(n.ottavaShift, 12, 'all folded notes in Brahms are 8vb (shift = +12)');
  }

  // Fixed-4 on Brahms: exactly 1 folded note (m. 69, A0, lin 9)
  const f4Opts = resolveJankoOptions({ ...BRAHMS_OP118_NO1_JANKO_OPTIONS, core: 'fixed-4' });
  const f4Layouts = layoutJankoScore(BRAHMS, f4Opts, t);
  const f4Folded = f4Layouts.flatMap((s) => s.notes).filter((n) => n.ottavaShift !== undefined);
  assert.equal(f4Folded.length, 1, 'fixed-4 on Brahms has exactly 1 folded note');
  assert.equal(f4Folded[0].ottavaShift, 12, 'm. 69 A0 folded note is 8vb (shift = +12)');
  assert.equal(f4Folded[0].note.pitch.octave * 12 + f4Folded[0].note.pitch.pitchClass, 9, 'm. 69 note is A0 (lin 9)');

  // Bach golden: 0 folded notes
  const bachLayouts = layoutJankoScore(BACH, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
  const bachFolded = bachLayouts.flatMap((s) => s.notes).filter((n) => n.ottavaShift !== undefined);
  assert.equal(bachFolded.length, 0, 'Bach golden master has zero folded notes');
  const bachBrackets = bachLayouts.flatMap((s) => s.ottavaBrackets ?? []);
  assert.equal(bachBrackets.length, 0, 'Bach golden master renders zero ottava brackets');
});

// ---------------------------------------------------------------------------
// 3. Bracket coverage
// ---------------------------------------------------------------------------

test('Every folded note is covered by exactly one bracket', () => {
  const t = resolveJankoTokens(BRAHMS_OP118_NO1_JANKO_TOKENS);

  for (const core of ['fixed-3', 'fixed-4'] as const) {
    const opts = resolveJankoOptions({ ...BRAHMS_OP118_NO1_JANKO_OPTIONS, core });
    const layouts = layoutJankoScore(BRAHMS, opts, t);

    let totalFolded = 0;
    let totalBrackets = 0;
    const coveredNoteIds = new Set<string>();

    for (const sys of layouts) {
      const violations: any[] = [];
      checkOttavaCoverage(sys, violations);
      assert.deepEqual(violations, [], `system ${sys.index + 1} has zero ottava coverage violations under ${core}`);

      const folded = sys.notes.filter((n) => n.ottavaShift !== undefined);
      totalFolded += folded.length;

      const brackets = sys.ottavaBrackets ?? [];
      totalBrackets += brackets.length;

      for (const b of brackets) {
        for (const id of b.noteIds) {
          assert.ok(!coveredNoteIds.has(id), `note ${id} covered by only one bracket`);
          coveredNoteIds.add(id);
        }
      }
    }

    assert.equal(coveredNoteIds.size, totalFolded, `every folded note covered under ${core}`);

    if (core === 'fixed-3') {
      // 7 singletons in mm. 5, 15, 23, 33, 43, 53, 67 + 1 run of 2 notes in m. 69 = 8 brackets
      assert.equal(totalBrackets, 8, 'fixed-3 renders exactly 8 brackets covering 9 folded notes');
    } else {
      // 1 singleton in m. 69 = 1 bracket
      assert.equal(totalBrackets, 1, 'fixed-4 renders exactly 1 bracket covering 1 folded note');
    }
  }
});

// ---------------------------------------------------------------------------
// 4. Densest macro contains folded bass under fixed-3
// ---------------------------------------------------------------------------

test('Densest macro window (mm. 33–34) contains folded bass under fixed-3', () => {
  const strip = CURRENT_ROUND_METADATA.compareStrip;
  assert.ok(strip, 'compare strip is declared');
  assert.equal(strip.scoreId, BRAHMS_STUDIO_SCORE_ID);
  assert.equal(strip.measureStart, 33);
  assert.equal(strip.measureCount, 2);

  const t = resolveJankoTokens(BRAHMS_OP118_NO1_JANKO_TOKENS);
  const f3Opts = resolveJankoOptions({ ...BRAHMS_OP118_NO1_JANKO_OPTIONS, core: 'fixed-3' });
  const f3Layouts = layoutJankoScore(BRAHMS, f3Opts, t);

  // m. 33 start tick: cut time = 192 ticks/measure, anacrusis = 48
  // m. 1 = 0..239 (anacrusis 48 + 192), m. 33 starts at 48 + 32 * 192 = 6192
  const m33Notes = f3Layouts.flatMap((s) => s.notes).filter((n) => n.note.startTick >= 6192 && n.note.startTick < 6192 + 192 * 2);
  const foldedInMacro = m33Notes.filter((n) => n.ottavaShift !== undefined);
  assert.ok(foldedInMacro.length >= 1, 'mm. 33–34 contains folded bass under fixed-3');
  const e1 = foldedInMacro.find((n) => n.note.pitch.octave === 1 && n.note.pitch.pitchClass === 4);
  assert.ok(e1, 'folded note is E1 (lin 16)');
  assert.equal(e1.writtenLin, 28, 'written lin is 16 + 12 = 28 (E2 written height)');
});

// ---------------------------------------------------------------------------
// 5. Captions match rendered fold counts
// ---------------------------------------------------------------------------

test('Candidate captions match rendered fold counts', () => {
  const control = getCandidate('core-fixed-4')!;
  const contender = getCandidate('core-fixed-3')!;

  assert.match(control.description ?? '', /1 folded note/);
  assert.match(contender.description ?? '', /9 folded notes/);
});

// ---------------------------------------------------------------------------
// 6. New-golden regression pins (R27 verdict enacted)
// ---------------------------------------------------------------------------

test('New-golden pins: fixed-3 default, zero folds/brackets on Bach, C6 on Bach and C2 on Brahms fire', () => {
  assert.equal(DEFAULT_JANKO_OPTIONS.core, 'fixed-3', 'golden default core is fixed-3');

  const layouts = layoutJankoScore(BACH, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
  const folded = layouts.flatMap((s) => s.notes).filter((n) => n.ottavaShift !== undefined);
  assert.equal(folded.length, 0, 'Bach golden renders 0 folded notes');
  const brackets = layouts.flatMap((s) => s.ottavaBrackets ?? []);
  assert.equal(brackets.length, 0, 'Bach golden renders 0 ottava brackets');

  // Extension rule visibly working under strict rows:
  // Bach's minimum note is lin 26 (D2 > 24), so Bach golden does NOT fire C2 extension (lin 24)
  const bachC2Systems = layouts.filter((s) => (s.geometry.extensionLines ?? []).includes(24));
  assert.equal(bachC2Systems.length, 0, 'Bach golden min note (26 > 24) correctly does not fire C2 extension');

  // C6 extension (lin 72) fires on at least one high system (lin 72–74 notes in mm. 29–30)
  const c6Systems = layouts.filter((s) => (s.geometry.extensionLines ?? []).includes(72));
  assert.ok(c6Systems.length >= 1, 'Bach golden fires C6 extension on at least one high system');

  // Brahms fixed-3 reaches lin 9 (<= 24), firing C2 extension on low systems
  const brahmsLayouts = layoutJankoScore(
    BRAHMS,
    resolveJankoOptions({ ...BRAHMS_OP118_NO1_JANKO_OPTIONS, core: 'fixed-3' }),
    resolveJankoTokens(BRAHMS_OP118_NO1_JANKO_TOKENS)
  );
  const brahmsC2Systems = brahmsLayouts.filter((s) => (s.geometry.extensionLines ?? []).includes(24));
  assert.ok(brahmsC2Systems.length >= 1, 'Brahms fixed-3 fires C2 extension on low systems');
});
