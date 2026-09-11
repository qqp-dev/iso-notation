import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CANONICAL_PHONETICS,
  TRITONE_TWIN_PAIRS,
  ROW1_AUGMENTED_TRIANGLES,
  getCanonicalPhonetic,
  getCanonicalSyllable,
  solfegeSequence,
  solfegeString,
  pitchClassFromSyllable,
} from '../src/model/phonetics';
import { pitchClassLabel, pitchLabel } from '../src/model/pitch';

test('12-TET Canonical Phonetics: 12 unique consonants and bijection', () => {
  assert.equal(CANONICAL_PHONETICS.length, 12);
  const consonants = CANONICAL_PHONETICS.map((e) => e.consonant).sort();
  const expectedConsonants = ['B', 'D', 'F', 'K', 'L', 'M', 'N', 'P', 'R', 'S', 'T', 'V'].sort();
  assert.deepEqual(consonants, expectedConsonants);

  // Each pitch class 0..11 is represented exactly once
  const pcs = CANONICAL_PHONETICS.map((e) => e.pitchClass).sort((a, b) => a - b);
  assert.deepEqual(pcs, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
});

test('Jánko Row Vowel Invariant: Row 0 is -a, Row 1 is -i', () => {
  CANONICAL_PHONETICS.forEach((entry) => {
    if (entry.row === 0) {
      assert.equal(entry.vowel, 'a', `Pitch ${entry.pitchClass} on Row 0 must use vowel 'a'`);
      assert.ok(entry.pitchClass % 2 === 0, `Row 0 pitches must be even`);
    } else {
      assert.equal(entry.vowel, 'i', `Pitch ${entry.pitchClass} on Row 1 must use vowel 'i'`);
      assert.ok(entry.pitchClass % 2 === 1, `Row 1 pitches must be odd`);
    }
    assert.equal(entry.syllable, `${entry.consonant}${entry.vowel}`);
  });
});

test('Tritone Polar Twin Pairing: 100% of the 6 pairs satisfied across Delta = 6', () => {
  const expectedPairs: Array<[string, string]> = [
    ['Ma', 'Na'], // 0 <-> 6 (Nasals: lips vs ridge)
    ['Di', 'Ti'], // 1 <-> 7 (Dental stops: voiced vs voiceless)
    ['Va', 'Fa'], // 2 <-> 8 (Labiodental fricatives: voiced vs voiceless)
    ['Pi', 'Bi'], // 3 <-> 9 (Bilabial stops: voiceless vs voiced)
    ['La', 'Sa'], // 4 <-> 10 (Ridge: liquid vs sibilant)
    ['Ri', 'Ki'], // 5 <-> 11 (Mid-palatal liquid vs velar stop)
  ];

  TRITONE_TWIN_PAIRS.forEach(([p1, p2], idx) => {
    assert.equal(Math.abs(p2 - p1), 6, 'Tritone must be distance 6');
    const s1 = getCanonicalSyllable(p1);
    const s2 = getCanonicalSyllable(p2);
    const expected = expectedPairs[idx];
    assert.deepEqual([s1, s2].sort(), [...expected].sort());
  });
});

test('Augmented Triad Voicing Coherence on Row 1', () => {
  // Triangle A {1, 5, 9} -> Di, Ri, Bi must all be voiced
  ROW1_AUGMENTED_TRIANGLES.voiced.forEach((pc) => {
    const entry = getCanonicalPhonetic(pc);
    assert.equal(entry.voiced, true, `Pitch ${pc} (${entry.syllable}) must be voiced`);
  });

  // Triangle B {3, 7, 11} -> Pi, Ti, Ki must all be voiceless
  ROW1_AUGMENTED_TRIANGLES.voiceless.forEach((pc) => {
    const entry = getCanonicalPhonetic(pc);
    assert.equal(entry.voiced, false, `Pitch ${pc} (${entry.syllable}) must be voiceless`);
  });
});

test('Semitone Muscle Diversity: Exactly 1 place collision (11/12 distinct)', () => {
  let collisions = 0;
  const collisionPairs: string[] = [];

  for (let i = 0; i < 12; i++) {
    const current = getCanonicalPhonetic(i);
    const next = getCanonicalPhonetic((i + 1) % 12);
    if (current.organ.split(' ')[0] === next.organ.split(' ')[0]) {
      collisions++;
      collisionPairs.push(`${current.syllable} <-> ${next.syllable}`);
    }
  }

  // Guaranteed theoretical optimum: 1 collision
  assert.equal(collisions, 1);
  assert.deepEqual(collisionPairs, ['Na <-> Ti']);

  // Verify the solitary collision pairs different manners (nasal vs stop)
  const na = getCanonicalPhonetic(6);
  const ti = getCanonicalPhonetic(7);
  assert.equal(na.manner, 'nasal');
  assert.equal(ti.manner, 'stop');
});

test('Circle of Fifths Harmonic Cadence: Exactly 1 place collision (11/12 distinct)', () => {
  const fifthOrder = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5];
  let collisions = 0;
  const collisionPairs: string[] = [];

  for (let i = 0; i < 12; i++) {
    const current = getCanonicalPhonetic(fifthOrder[i]);
    const next = getCanonicalPhonetic(fifthOrder[(i + 1) % 12]);
    if (current.organ.split(' ')[0] === next.organ.split(' ')[0]) {
      collisions++;
      collisionPairs.push(`${current.syllable} <-> ${next.syllable}`);
    }
  }

  assert.equal(collisions, 1);
  assert.deepEqual(collisionPairs, ['Na <-> Di']);
});

test('Solfege formatting and reverse lookup', () => {
  // Single pitch class
  assert.equal(getCanonicalSyllable(0), 'Ma');
  assert.equal(getCanonicalSyllable(7), 'Ti');
  assert.equal(getCanonicalSyllable(12), 'Ma'); // octave wrap

  // Reverse lookup
  assert.equal(pitchClassFromSyllable('Ma'), 0);
  assert.equal(pitchClassFromSyllable('di'), 1);
  assert.equal(pitchClassFromSyllable('TI'), 7);
  assert.equal(pitchClassFromSyllable('nonexistent'), undefined);

  // Solfege sequence
  const triad = [0, 4, 7];
  assert.deepEqual(solfegeSequence(triad), ['Ma', 'La', 'Ti']);
  assert.equal(solfegeString(triad), 'Ma-La-Ti');
  assert.equal(solfegeString(triad, ' '), 'Ma La Ti');

  // Bach Goldberg Variation 1 theme mm. 1-2
  const bachTheme = [7, 6, 7, 2, 4, 6, 7, 9, 11, 13, 14, 13, 14];
  assert.equal(
    solfegeString(bachTheme),
    'Ti-Na-Ti-Va-La-Na-Ti-Bi-Ki-Di-Va-Di-Va'
  );
});

test('Pitch label integration with phonetic formatting', () => {
  assert.equal(pitchClassLabel(0, 'phonetic'), 'Ma');
  assert.equal(pitchClassLabel(7, 'phonetic'), 'Ti');
  assert.equal(pitchClassLabel(11, 'phonetic'), 'Ki');
  assert.equal(pitchLabel({ pitchClass: 0, octave: 4 }, 'phonetic'), 'Ma4');
  assert.equal(pitchLabel({ pitchClass: 7, octave: 5 }, 'phonetic'), 'Ti5');
});
