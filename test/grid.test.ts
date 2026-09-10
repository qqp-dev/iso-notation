import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  gcd,
  multiGcd,
  computeOptimalGridResolution,
  verifyLosslessGrid,
  tickToMeasureBeat,
  getActiveNotesAtTick,
} from '../src/model/grid';
import { QuantizedGridScore, QuantizedNote } from '../src/model/types';

test('Euclidean GCD arithmetic', () => {
  assert.equal(gcd(48, 12), 12);
  assert.equal(gcd(12, 16), 4);
  assert.equal(gcd(0, 24), 24);
  assert.equal(multiGcd([48, 24, 12, 6]), 6);
  assert.equal(multiGcd([48, 36, 24]), 12);
});

test('Minimal grid resolution GCD computation for note collections', () => {
  const notes: QuantizedNote[] = [
    {
      id: '1',
      pitch: { pitchClass: 0, octave: 4 },
      startTick: 0,
      durationTicks: 48,
      hand: 'RH',
    },
    {
      id: '2',
      pitch: { pitchClass: 7, octave: 4 },
      startTick: 48,
      durationTicks: 24,
      hand: 'RH',
    },
    {
      id: '3',
      pitch: { pitchClass: 4, octave: 4 },
      startTick: 72,
      durationTicks: 12,
      hand: 'RH',
    },
  ];

  const optimalGcd = computeOptimalGridResolution(notes);
  assert.equal(optimalGcd, 12); // GCD of 48, 24, 12, 72 is 12
});

test('Lossless grid verification invariants', () => {
  const validScore: QuantizedGridScore = {
    id: 'test-score',
    title: 'Test',
    composer: 'Tester',
    ticksPerBeat: 48,
    totalTicks: 192,
    timeSignatures: [{ tick: 0, numerator: 4, denominator: 4 }],
    barlines: [],
    tempos: [{ tick: 0, bpm: 120 }],
    dynamics: [],
    pedals: [],
    notes: [
      {
        id: 'n1',
        pitch: { pitchClass: 0, octave: 4 },
        startTick: 0,
        durationTicks: 48,
        hand: 'RH',
      },
    ],
  };

  const res = verifyLosslessGrid(validScore);
  assert.equal(res.lossless, true);
  assert.equal(res.errors.length, 0);

  // Invalid pitchClass
  const invalidScore: QuantizedGridScore = {
    ...validScore,
    notes: [
      {
        id: 'bad-1',
        pitch: { pitchClass: 13, octave: 4 },
        startTick: 0,
        durationTicks: 48,
        hand: 'RH',
      },
    ],
  };
  const badRes = verifyLosslessGrid(invalidScore);
  assert.equal(badRes.lossless, false);
  assert.ok(badRes.errors[0].includes('invalid pitchClass'));
});

test('Measure and beat coordinate mapping', () => {
  const score: QuantizedGridScore = {
    id: 'm-score',
    title: 'Meter',
    composer: 'Test',
    ticksPerBeat: 48,
    totalTicks: 576,
    timeSignatures: [{ tick: 0, numerator: 3, denominator: 4 }],
    barlines: [],
    tempos: [],
    dynamics: [],
    pedals: [],
    notes: [],
  };

  // In 3/4 with 48 ticks/beat, 1 measure = 144 ticks
  assert.deepEqual(tickToMeasureBeat(0, score), { measure: 1, beat: 1, tickInBeat: 0 });
  assert.deepEqual(tickToMeasureBeat(48, score), { measure: 1, beat: 2, tickInBeat: 0 });
  assert.deepEqual(tickToMeasureBeat(144, score), { measure: 2, beat: 1, tickInBeat: 0 });
  assert.deepEqual(tickToMeasureBeat(156, score), { measure: 2, beat: 1, tickInBeat: 12 });
});

test('Active notes temporal query', () => {
  const score: QuantizedGridScore = {
    id: 'active-score',
    title: 'Active',
    composer: 'Test',
    ticksPerBeat: 48,
    totalTicks: 200,
    timeSignatures: [],
    barlines: [],
    tempos: [],
    dynamics: [],
    pedals: [],
    notes: [
      {
        id: 'n1',
        pitch: { pitchClass: 0, octave: 4 },
        startTick: 0,
        durationTicks: 48,
        hand: 'RH',
      },
      {
        id: 'n2',
        pitch: { pitchClass: 7, octave: 4 },
        startTick: 24,
        durationTicks: 48,
        hand: 'LH',
      },
    ],
  };

  // At tick 10: only n1
  const t10 = getActiveNotesAtTick(score, 10);
  assert.equal(t10.length, 1);
  assert.equal(t10[0].id, 'n1');

  // At tick 30: both n1 and n2
  const t30 = getActiveNotesAtTick(score, 30);
  assert.equal(t30.length, 2);

  // At tick 60: only n2
  const t60 = getActiveNotesAtTick(score, 60);
  assert.equal(t60.length, 1);
  assert.equal(t60[0].id, 'n2');

  // At tick 100: none
  const t100 = getActiveNotesAtTick(score, 100);
  assert.equal(t100.length, 0);
});
