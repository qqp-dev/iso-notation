import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1';
import { verifyLosslessGrid, computeOptimalGridResolution } from '../src/model/grid';
import { parseMidiToScore } from '../src/model/midi';
import { linearIndex } from '../src/model/pitch';

test('Bach Goldberg Variation 1 canonical benchmark verification', () => {
  const score = buildBachGoldbergVar1Score();

  // Invariant verification
  const verification = verifyLosslessGrid(score);
  assert.equal(verification.lossless, true, `Errors: ${verification.errors.join(', ')}`);

  // Assert authentic Urtext score dimensions: 32 measures of 3/4
  assert.equal(score.id, 'bach-goldberg-var1');
  assert.equal(score.ticksPerBeat, 48);
  assert.equal(score.totalTicks, 4608); // 32 measures * 144 ticks
  assert.equal(score.notes.length, 551);

  // Minimal GCD resolution: 16th notes = 12 ticks
  const gcdRes = computeOptimalGridResolution(score.notes);
  assert.equal(gcdRes, 12);

  // Verify Hand Crossings detection
  assert.ok(score.handCrossings && score.handCrossings.length > 0, 'Should detect hand crossings');
});

test('Deterministic MIDI ingestion pipeline parses .mid losslessly into quantized fence', () => {
  const midiBuffer = fs.readFileSync('public/midi/bach-goldberg-var1.mid');
  const parsedScore = parseMidiToScore(midiBuffer, {
    id: 'bach-goldberg-var1',
    title: 'Goldberg Variations, BWV 988: Variatio 1. a 1 Clav.',
    composer: 'Johann Sebastian Bach',
  });

  const verification = verifyLosslessGrid(parsedScore);
  assert.equal(verification.lossless, true, `MIDI ingest errors: ${verification.errors.join(', ')}`);

  assert.equal(parsedScore.ticksPerBeat, 48);
  assert.equal(parsedScore.totalTicks, 4608);
  assert.equal(parsedScore.notes.length, 551);
  assert.equal(computeOptimalGridResolution(parsedScore.notes), 12);

  // Assert pure numerical pitch coordinates on all notes
  for (const note of parsedScore.notes) {
    assert.ok(note.pitch.pitchClass >= 0 && note.pitch.pitchClass <= 11);
    assert.ok(note.pitch.octave >= 0);
    assert.ok(Number.isInteger(note.startTick));
    assert.ok(Number.isInteger(note.durationTicks));
    assert.ok(note.durationTicks > 0);
  }
});

test('Authentic Hand Attribution Invariants: BWV 988 mm. 4 & 24 and playable hand spans', () => {
  const score = buildBachGoldbergVar1Score();

  // In Measure 4:
  // Ticks 504, 516, 528, 540, 564, 576, 588 (the 7 sixteenth notes: A3, G3, F#3, A3, C3, B2, A2) must have hand === 'RH'.
  const m4RhSixteenthTicks = [504, 516, 528, 540, 564, 576, 588];
  for (const tick of m4RhSixteenthTicks) {
    const rhNotes = score.notes.filter((n) => n.startTick === tick && n.durationTicks === 12);
    assert.equal(rhNotes.length, 1, `Expected 1 sixteenth note at tick ${tick}`);
    assert.equal(rhNotes[0].hand, 'RH', `Sixteenth note at tick ${tick} must be assigned to RH`);
  }

  // Ticks 504 (D3), 528 (D2), 552 (D3), and 600 (B2) must have hand === 'LH'.
  const m4LhTicks = [504, 528, 552, 600];
  for (const tick of m4LhTicks) {
    const lhNotes = score.notes.filter((n) => n.startTick === tick && n.hand === 'LH');
    assert.ok(lhNotes.length >= 1, `Expected LH note at tick ${tick}`);
  }

  // In Measure 24:
  // Ticks 3384, 3396, 3408, 3420, 3444 (the 5 sixteenth notes: B3, A3, G3, B3, D3) must have hand === 'RH'.
  const m24RhSixteenthTicks = [3384, 3396, 3408, 3420, 3444];
  for (const tick of m24RhSixteenthTicks) {
    const rhNotes = score.notes.filter((n) => n.startTick === tick && n.durationTicks === 12);
    assert.equal(rhNotes.length, 1, `Expected 1 sixteenth note at tick ${tick}`);
    assert.equal(rhNotes[0].hand, 'RH', `Sixteenth note at tick ${tick} must be assigned to RH`);
  }

  // Ticks 3384 (E3), 3408 (E2), 3432 (E3) must have hand === 'LH'.
  const m24LhTicks = [3384, 3408, 3432];
  for (const tick of m24LhTicks) {
    const lhNotes = score.notes.filter((n) => n.startTick === tick && n.hand === 'LH');
    assert.ok(lhNotes.length >= 1, `Expected LH note at tick ${tick}`);
  }

  // Across all 32 measures of the score, no single hand plays simultaneous onsets spanning > 12 semitones.
  const onsetsByHandAndTick = new Map<string, number[]>();
  for (const note of score.notes) {
    const key = `${note.hand}-${note.startTick}`;
    const list = onsetsByHandAndTick.get(key) || [];
    list.push(linearIndex(note.pitch));
    onsetsByHandAndTick.set(key, list);
  }
  for (const [key, pitches] of onsetsByHandAndTick.entries()) {
    if (pitches.length > 1) {
      const minP = Math.min(...pitches);
      const maxP = Math.max(...pitches);
      const span = maxP - minP;
      assert.ok(span <= 12, `Hand onset ${key} has unplayable simultaneous span of ${span} semitones > 12`);
    }
  }

  // verifyLosslessGrid(score) passes.
  const verification = verifyLosslessGrid(score);
  assert.equal(verification.lossless, true, `Errors: ${verification.errors.join(', ')}`);
});
