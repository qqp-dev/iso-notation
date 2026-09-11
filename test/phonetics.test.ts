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
  const expectedConsonants = ['b', 'd', 'f', 'k', 'l', 'm', 'n', 'p', 'r', 's', 't', 'v'].sort();
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
    assert.equal(entry.consonant, entry.consonant.toLowerCase(), 'Consonants must be strictly lowercase');
    assert.equal(entry.syllable, entry.syllable.toLowerCase(), 'Syllables must be strictly lowercase');
  });
});

test('Tritone Polar Twin Pairing: 100% of the 6 pairs satisfied across Delta = 6', () => {
  const expectedPairs: Array<[string, string]> = [
    ['ma', 'na'], // 0 <-> 6 (Nasals: lips vs ridge)
    ['di', 'ti'], // 1 <-> 7 (Dental stops: voiced vs voiceless)
    ['va', 'fa'], // 2 <-> 8 (Labiodental fricatives: voiced vs voiceless)
    ['pi', 'bi'], // 3 <-> 9 (Bilabial stops: voiceless vs voiced)
    ['la', 'sa'], // 4 <-> 10 (Ridge: liquid vs sibilant)
    ['ri', 'ki'], // 5 <-> 11 (Mid-palatal liquid vs velar stop)
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
  // Triangle A {1, 5, 9} -> di, ri, bi must all be voiced
  ROW1_AUGMENTED_TRIANGLES.voiced.forEach((pc) => {
    const entry = getCanonicalPhonetic(pc);
    assert.equal(entry.voiced, true, `Pitch ${pc} (${entry.syllable}) must be voiced`);
  });

  // Triangle B {3, 7, 11} -> pi, ti, ki must all be voiceless
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
  assert.deepEqual(collisionPairs, ['na <-> ti']);

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
  assert.deepEqual(collisionPairs, ['na <-> di']);
});

test('Solfege formatting and reverse lookup', () => {
  // Single pitch class
  assert.equal(getCanonicalSyllable(0), 'ma');
  assert.equal(getCanonicalSyllable(7), 'ti');
  assert.equal(getCanonicalSyllable(12), 'ma'); // octave wrap

  // Reverse lookup
  assert.equal(pitchClassFromSyllable('Ma'), 0);
  assert.equal(pitchClassFromSyllable('ma'), 0);
  assert.equal(pitchClassFromSyllable('m'), 0);
  assert.equal(pitchClassFromSyllable('di'), 1);
  assert.equal(pitchClassFromSyllable('d'), 1);
  assert.equal(pitchClassFromSyllable('TI'), 7);
  assert.equal(pitchClassFromSyllable('ti'), 7);
  assert.equal(pitchClassFromSyllable('t'), 7);
  assert.equal(pitchClassFromSyllable('nonexistent'), undefined);

  // Solfege sequence
  const triad = [0, 4, 7];
  assert.deepEqual(solfegeSequence(triad), ['ma', 'la', 'ti']);
  assert.equal(solfegeString(triad), 'ma-la-ti');
  assert.equal(solfegeString(triad, ' '), 'ma la ti');

  // Bach Goldberg Variation 1 theme mm. 1-2
  const bachTheme = [7, 6, 7, 2, 4, 6, 7, 9, 11, 13, 14, 13, 14];
  assert.equal(
    solfegeString(bachTheme),
    'ti-na-ti-va-la-na-ti-bi-ki-di-va-di-va'
  );
});

test('Pitch label integration with phonetic formatting', () => {
  assert.equal(pitchClassLabel(0, 'phonetic'), 'ma');
  assert.equal(pitchClassLabel(7, 'phonetic'), 'ti');
  assert.equal(pitchClassLabel(11, 'phonetic'), 'ki');
  // Middle C is m3 -> ma3
  assert.equal(pitchLabel({ pitchClass: 0, octave: 4 }, 'phonetic'), 'ma3');
  assert.equal(pitchLabel({ pitchClass: 7, octave: 5 }, 'phonetic'), 'ti4');
  // First C on piano (C1) is m0 -> ma0
  assert.equal(pitchLabel({ pitchClass: 0, octave: 1 }, 'phonetic'), 'ma0');
  // Lowest notes on 88-key piano: A0 is b0 -> bi0, Bb0 is sa0, B0 is ki0
  assert.equal(pitchLabel({ pitchClass: 9, octave: 0 }, 'phonetic'), 'bi0');
  assert.equal(pitchLabel({ pitchClass: 10, octave: 0 }, 'phonetic'), 'sa0');
  assert.equal(pitchLabel({ pitchClass: 11, octave: 0 }, 'phonetic'), 'ki0');
  // Next A on piano (A1) is b1 -> bi1
  assert.equal(pitchLabel({ pitchClass: 9, octave: 1 }, 'phonetic'), 'bi1');
  // Next C on piano (C2) is m1 -> ma1
  assert.equal(pitchLabel({ pitchClass: 0, octave: 2 }, 'phonetic'), 'ma1');
  // Concert A4 (440 Hz) is b4 -> bi4
  assert.equal(pitchLabel({ pitchClass: 9, octave: 4 }, 'phonetic'), 'bi4');
});
