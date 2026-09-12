import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DUODECIMAL_SOLFEGE,
  getDuodecimalSolfege,
  getDuodecimalSyllable,
  duodecimalSolfegeSequence,
  duodecimalSolfegeString,
  pitchClassFromDuodecimalSyllable,
  getCanonicalSyllable,
  solfegeSequence,
  solfegeString,
  pitchClassFromSyllable,
} from '../src/model/phonetics';
import { pitchClassLabel, pitchLabel } from '../src/model/pitch';

test('Definitive Duodecimal Solfege: 12 monosyllabic tokens and bijection', () => {
  assert.equal(DUODECIMAL_SOLFEGE.length, 12);
  const syllables = DUODECIMAL_SOLFEGE.map((e) => e.syllable);
  const expectedSyllables = ['o', 'wa', 'tu', 'ti', 'fo', 'fa', 'si', 'se', 'e', 'na', 'a', 'bi'];
  assert.deepEqual(syllables, expectedSyllables);

  // Each pitch class 0..11 is represented exactly once
  const pcs = DUODECIMAL_SOLFEGE.map((e) => e.pitchClass).sort((a, b) => a - b);
  assert.deepEqual(pcs, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);

  // Digits match '0'..'9', 'A', 'B'
  const digits = DUODECIMAL_SOLFEGE.map((e) => e.digit);
  assert.deepEqual(digits, ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B']);
});

test('Jánko Row Parity Invariant: Evens are Row 0, Odds are Row 1', () => {
  DUODECIMAL_SOLFEGE.forEach((entry) => {
    if (entry.pitchClass % 2 === 0) {
      assert.equal(entry.row, 0, `Even pitch class ${entry.pitchClass} (${entry.syllable}) must belong to Row 0`);
    } else {
      assert.equal(entry.row, 1, `Odd pitch class ${entry.pitchClass} (${entry.syllable}) must belong to Row 1`);
    }
  });

  const row0Syllables = DUODECIMAL_SOLFEGE.filter((e) => e.row === 0).map((e) => e.syllable);
  const row1Syllables = DUODECIMAL_SOLFEGE.filter((e) => e.row === 1).map((e) => e.syllable);

  assert.deepEqual(row0Syllables, ['o', 'tu', 'fo', 'si', 'e', 'a']);
  assert.deepEqual(row1Syllables, ['wa', 'ti', 'fa', 'se', 'na', 'bi']);
});

test('Interval Parity Geometry: Semitones alternate parity, Whole tones preserve parity', () => {
  for (let pc = 0; pc < 12; pc++) {
    const current = getDuodecimalSolfege(pc);
    const semitoneUp = getDuodecimalSolfege((pc + 1) % 12);
    const wholetoneUp = getDuodecimalSolfege((pc + 2) % 12);

    // Semitone step strictly flips row parity (0 <-> 1)
    assert.notEqual(current.row, semitoneUp.row, `Semitone step ${current.syllable} -> ${semitoneUp.syllable} must flip parity`);

    // Whole-tone step strictly preserves row parity
    assert.equal(current.row, wholetoneUp.row, `Whole tone step ${current.syllable} -> ${wholetoneUp.syllable} must preserve parity`);
  }
});

test('String formatting and melodic solfege sequences', () => {
  // Major triad (0 - 4 - 7): o - fo - se
  const triad = [0, 4, 7];
  assert.deepEqual(solfegeSequence(triad), ['o', 'fo', 'se']);
  assert.equal(solfegeString(triad), 'o-fo-se');
  assert.equal(solfegeString(triad, ' '), 'o fo se');

  // Tritone axis (0 - 6): o - si
  assert.equal(solfegeString([0, 6]), 'o-si');

  // Perfect fifth (0 - 7): o - se
  assert.equal(solfegeString([0, 7]), 'o-se');

  // Bach Goldberg Variation 1 theme mm. 1-2
  const bachTheme = [7, 6, 7, 2, 4, 6, 7, 9, 11, 13, 14, 13, 14];
  assert.equal(
    solfegeString(bachTheme),
    'se-si-se-tu-fo-si-se-na-bi-wa-tu-wa-tu'
  );
});

test('Pitch label integration with duodecimal solfege formatting', () => {
  assert.equal(pitchClassLabel(0, 'phonetic'), 'o');
  assert.equal(pitchClassLabel(7, 'phonetic'), 'se');
  assert.equal(pitchClassLabel(11, 'phonetic'), 'bi');

  // Octave formatting
  assert.equal(pitchLabel({ pitchClass: 0, octave: 4 }, 'phonetic'), 'o3');
  assert.equal(pitchLabel({ pitchClass: 7, octave: 5 }, 'phonetic'), 'se4');
  assert.equal(pitchLabel({ pitchClass: 9, octave: 0 }, 'phonetic'), 'na0');
  assert.equal(pitchLabel({ pitchClass: 11, octave: 0 }, 'phonetic'), 'bi0');
  assert.equal(pitchLabel({ pitchClass: 0, octave: 1 }, 'phonetic'), 'o0');
});

test('Reverse lookup from syllable and digit to pitch class', () => {
  assert.equal(pitchClassFromSyllable('o'), 0);
  assert.equal(pitchClassFromSyllable('wa'), 1);
  assert.equal(pitchClassFromSyllable('tu'), 2);
  assert.equal(pitchClassFromSyllable('ti'), 3);
  assert.equal(pitchClassFromSyllable('fo'), 4);
  assert.equal(pitchClassFromSyllable('fa'), 5);
  assert.equal(pitchClassFromSyllable('si'), 6);
  assert.equal(pitchClassFromSyllable('se'), 7);
  assert.equal(pitchClassFromSyllable('e'), 8);
  assert.equal(pitchClassFromSyllable('na'), 9);
  assert.equal(pitchClassFromSyllable('a'), 10);
  assert.equal(pitchClassFromSyllable('bi'), 11);

  // Digits reverse lookup
  assert.equal(pitchClassFromSyllable('0'), 0);
  assert.equal(pitchClassFromSyllable('7'), 7);
  assert.equal(pitchClassFromSyllable('b'), 11);
});
