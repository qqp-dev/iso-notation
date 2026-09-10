import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1';
import { buildKapustinOp40No7Score } from '../src/scores/kapustin-op40-no7';
import { verifyLosslessGrid, computeOptimalGridResolution } from '../src/model/grid';
import { parseMidiToScore } from '../src/model/midi';

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

test('Kapustin Op. 40 No. 7 Intermezzo canonical benchmark verification', () => {
  const score = buildKapustinOp40No7Score();

  const verification = verifyLosslessGrid(score);
  assert.equal(verification.lossless, true, `Errors: ${verification.errors.join(', ')}`);

  assert.equal(score.id, 'kapustin-op40-no7');
  assert.equal(score.ticksPerBeat, 48);
  assert.equal(score.totalTicks, 1152); // 6 measures * 192 ticks
  assert.ok(score.notes.length >= 50, `Expected at least 50 notes, got ${score.notes.length}`);

  // Pedaling overlays exist
  assert.ok(score.pedals.length >= 6, 'Expected sustain pedaling markings');

  // Verify syncopation: check presence of dotted eighth syncopated onsets (e.g. tick % 48 !== 0)
  const syncopatedNotes = score.notes.filter(n => n.startTick % 48 !== 0);
  assert.ok(syncopatedNotes.length > 10, 'Expected multiple syncopated offbeat notes in Kapustin Intermezzo');
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
