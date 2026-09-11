import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  linearIndex,
  fromLinearIndex,
  toMidi,
  fromMidi,
  toFrequency,
  wholeToneParity,
  jankoRowsForPitch,
  pitchClassLabel,
  pitchLabel,
} from '../src/model/pitch';

test('linear pitch coordinates for standard 88-key piano', () => {
  // Octave 0 lowest notes: A0, Bb0, B0
  assert.equal(linearIndex({ pitchClass: 9, octave: 0 }), 9);
  assert.equal(linearIndex({ pitchClass: 10, octave: 0 }), 10);
  assert.equal(linearIndex({ pitchClass: 11, octave: 0 }), 11);

  // C1 starts Octave 1
  assert.equal(linearIndex({ pitchClass: 0, octave: 1 }), 12);

  // Middle C (C4)
  assert.equal(linearIndex({ pitchClass: 0, octave: 4 }), 48);

  // Concert A4 (440 Hz)
  assert.equal(linearIndex({ pitchClass: 9, octave: 4 }), 57);

  // C8 (highest key on 88-key piano)
  assert.equal(linearIndex({ pitchClass: 0, octave: 8 }), 96);
});

test('bijective recovery from linear index', () => {
  for (let l = 0; l <= 127; l++) {
    const coord = fromLinearIndex(l);
    assert.equal(linearIndex(coord), l);
    assert.ok(coord.pitchClass >= 0 && coord.pitchClass <= 11);
  }
});

test('MIDI conversion alignment', () => {
  // A0 is MIDI 21 -> linear 9
  assert.equal(toMidi({ pitchClass: 9, octave: 0 }), 21);
  assert.deepEqual(fromMidi(21), { pitchClass: 9, octave: 0 });

  // Middle C is MIDI 60 -> linear 48
  assert.equal(toMidi({ pitchClass: 0, octave: 4 }), 60);
  assert.deepEqual(fromMidi(60), { pitchClass: 0, octave: 4 });

  // Concert A4 is MIDI 69 -> linear 57
  assert.equal(toMidi({ pitchClass: 9, octave: 4 }), 69);
  assert.deepEqual(fromMidi(69), { pitchClass: 9, octave: 4 });
});

test('Acoustic frequency calculations', () => {
  // A4 = 440 Hz
  const fA4 = toFrequency({ pitchClass: 9, octave: 4 });
  assert.ok(Math.abs(fA4 - 440.0) < 0.001);

  // A0 = 27.5 Hz
  const fA0 = toFrequency({ pitchClass: 9, octave: 0 });
  assert.ok(Math.abs(fA0 - 27.5) < 0.001);

  // Middle C (C4) ~ 261.63 Hz
  const fC4 = toFrequency({ pitchClass: 0, octave: 4 });
  assert.ok(Math.abs(fC4 - 261.625) < 0.01);
});

test('Whole-tone parity and Janko row assignments', () => {
  // Row 0 (Even: 0, 2, 4, 6, 8, 10) -> Row 0
  const wtEvenPitches = [0, 2, 4, 6, 8, 10];
  wtEvenPitches.forEach((pc) => {
    assert.equal(wholeToneParity({ pitchClass: pc, octave: 4 }), 0);
    assert.deepEqual(jankoRowsForPitch({ pitchClass: pc, octave: 4 }), [0]);
  });

  // Row 1 (Odd: 1, 3, 5, 7, 9, 11) -> Row 1
  const wtOddPitches = [1, 3, 5, 7, 9, 11];
  wtOddPitches.forEach((pc) => {
    assert.equal(wholeToneParity({ pitchClass: pc, octave: 4 }), 1);
    assert.deepEqual(jankoRowsForPitch({ pitchClass: pc, octave: 4 }), [1]);
  });
});

test('Pitch labels formatting', () => {
  // 1-based note numbers (1..12)
  assert.equal(pitchClassLabel(0), '1');
  assert.equal(pitchClassLabel(1), '2');
  assert.equal(pitchClassLabel(11), '12');
  assert.equal(pitchLabel({ pitchClass: 0, octave: 4 }), '1:3');
  assert.equal(pitchLabel({ pitchClass: 1, octave: 5 }), '2:4');
  assert.equal(pitchLabel({ pitchClass: 6, octave: 3 }), '7:2');

  // Phonetic format (strictly lowercase, b0 ... m0, next b1, m marks octaves)
  assert.equal(pitchClassLabel(0, 'phonetic'), 'o');
  assert.equal(pitchClassLabel(1, 'phonetic'), 'wa');
  assert.equal(pitchClassLabel(7, 'phonetic'), 'se');
  assert.equal(pitchLabel({ pitchClass: 0, octave: 4 }, 'phonetic'), 'o3');
  assert.equal(pitchLabel({ pitchClass: 1, octave: 5 }, 'phonetic'), 'wa4');
  assert.equal(pitchLabel({ pitchClass: 6, octave: 3 }, 'phonetic'), 'si2');

  // Octave system: b0 ... m0, next b1
  // First notes on piano: A0 is na0, Bb0 is a0, B0 is bi0
  assert.equal(pitchLabel({ pitchClass: 9, octave: 0 }), '10:0');
  assert.equal(pitchLabel({ pitchClass: 9, octave: 0 }, 'phonetic'), 'na0');
  assert.equal(pitchLabel({ pitchClass: 10, octave: 0 }), '11:0');
  assert.equal(pitchLabel({ pitchClass: 10, octave: 0 }, 'phonetic'), 'a0');
  assert.equal(pitchLabel({ pitchClass: 11, octave: 0 }), '12:0');
  assert.equal(pitchLabel({ pitchClass: 11, octave: 0 }, 'phonetic'), 'bi0');

  // First C on piano (C1) is octave 0 (m0 -> o0)
  assert.equal(pitchLabel({ pitchClass: 0, octave: 1 }), '1:0');
  assert.equal(pitchLabel({ pitchClass: 0, octave: 1 }, 'phonetic'), 'o0');

  // Next A on piano (A1) is na1
  assert.equal(pitchLabel({ pitchClass: 9, octave: 1 }), '10:1');
  assert.equal(pitchLabel({ pitchClass: 9, octave: 1 }, 'phonetic'), 'na1');

  // Next C on piano (C2) is o1
  assert.equal(pitchLabel({ pitchClass: 0, octave: 2 }), '1:1');
  assert.equal(pitchLabel({ pitchClass: 0, octave: 2 }, 'phonetic'), 'o1');

  // Concert A4 (440 Hz) is na4
  assert.equal(pitchLabel({ pitchClass: 9, octave: 4 }), '10:4');
  assert.equal(pitchLabel({ pitchClass: 9, octave: 4 }, 'phonetic'), 'na4');
});
