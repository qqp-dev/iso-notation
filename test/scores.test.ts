import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1';
import { buildKapustinOp40No7Score } from '../src/scores/kapustin-op40-no7';
import { verifyLosslessGrid, computeOptimalGridResolution } from '../src/model/grid';

test('Bach Goldberg Variation 1 canonical benchmark verification', () => {
  const score = buildBachGoldbergVar1Score();

  // Invariant verification
  const verification = verifyLosslessGrid(score);
  assert.equal(verification.lossless, true, `Errors: ${verification.errors.join(', ')}`);

  // Assert basic score dimensions
  assert.equal(score.id, 'bach-goldberg-var1');
  assert.equal(score.ticksPerBeat, 48);
  assert.equal(score.totalTicks, 1152); // 8 measures * 144 ticks
  assert.ok(score.notes.length >= 100, `Expected at least 100 notes, got ${score.notes.length}`);

  // Minimal GCD resolution: 16th notes = 12 ticks
  const gcdRes = computeOptimalGridResolution(score.notes);
  assert.equal(gcdRes, 12);

  // Verify Hand Crossings detection
  assert.ok(score.handCrossings && score.handCrossings.length > 0, 'Should detect hand crossings');
  // Specifically, Measure 2 (tick 144), Measure 4 (tick 432), Measure 6 (tick 720) have LH crossing high
  const hasM2Crossing = score.handCrossings?.some(hc => hc.tick >= 144 && hc.tick < 288 && hc.higherHand === 'LH');
  const hasM4Crossing = score.handCrossings?.some(hc => hc.tick >= 432 && hc.tick < 576 && hc.higherHand === 'LH');
  const hasM6Crossing = score.handCrossings?.some(hc => hc.tick >= 720 && hc.tick < 864 && hc.higherHand === 'LH');

  assert.ok(hasM2Crossing, 'Measure 2 LH hand-crossing should be detected');
  assert.ok(hasM4Crossing, 'Measure 4 LH hand-crossing should be detected');
  assert.ok(hasM6Crossing, 'Measure 6 LH hand-crossing should be detected');
});

test('Kapustin Op. 40 No. 7 Intermezzo canonical benchmark verification', () => {
  const score = buildKapustinOp40No7Score();

  const verification = verifyLosslessGrid(score);
  assert.equal(verification.lossless, true, `Errors: ${verification.errors.join(', ')}`);

  assert.equal(score.id, 'kapustin-op40-no7');
  assert.equal(score.ticksPerBeat, 48);
  assert.equal(score.totalTicks, 1536); // 8 measures * 192 ticks
  assert.ok(score.notes.length >= 50, `Expected at least 50 notes, got ${score.notes.length}`);

  // Pedaling overlays exist
  assert.ok(score.pedals.length >= 8, 'Expected sustain pedaling markings');

  // Verify syncopation: check presence of dotted eighth syncopated onsets (e.g. tick % 48 !== 0)
  const syncopatedNotes = score.notes.filter(n => n.startTick % 48 !== 0);
  assert.ok(syncopatedNotes.length > 10, 'Expected multiple syncopated offbeat notes in Kapustin Intermezzo');
});
