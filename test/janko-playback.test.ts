import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1';
import { QuantizedGridScore } from '../src/model/types';
import { computePageGeometry } from '../src/render/janko/engine';
import {
  DEFAULT_JANKO_OPTIONS,
  DEFAULT_JANKO_TOKENS,
} from '../src/render/janko/types';
import {
  checkMidiReadiness,
  locateTick,
  tickAtPoint,
} from '../src/ui/playhead';

const GEO = computePageGeometry(DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
const SYS0 = GEO.systems[0];

test('locateTick: tick 0 opens the first system on the first beat column', () => {
  const score = buildBachGoldbergVar1Score();
  const pos = locateTick(score, 0);
  assert.equal(pos.page, 0);
  assert.equal(pos.system, 0);
  // Staff column + the default left measure inset, exactly the note column.
  assert.ok(Math.abs(pos.x - (SYS0.staffLeft + 6.0)) < 1e-9);
  assert.ok(pos.topY < pos.botY);
  assert.ok(Math.abs(pos.topY - (SYS0.staffTopY - 3)) < 1e-9);
  assert.ok(Math.abs(pos.botY - (SYS0.staffBotY + 3)) < 1e-9);
});

test('locateTick: later ticks walk measures, systems and pages', () => {
  const score = buildBachGoldbergVar1Score();
  // Last tick of m. 1 stays in system 0, inside the last measure slot.
  const end1 = locateTick(score, 143);
  assert.equal(end1.system, 0);
  assert.ok(end1.x > SYS0.staffLeft);
  assert.ok(end1.x < SYS0.staffLeft + SYS0.measureWidth);
  // m. 2 downbeat opens the second slot of system 0.
  const m2 = locateTick(score, 144);
  assert.equal(m2.system, 0);
  assert.ok(
    Math.abs(m2.x - (SYS0.staffLeft + SYS0.measureWidth + 6.0)) < 1e-9
  );
  // m. 5 downbeat (tick 576) opens system 1.
  const m5 = locateTick(score, 576);
  assert.equal(m5.system, 1);
  assert.equal(m5.page, 0);
  assert.equal(m5.systemInPage, 1);
  // m. 17 downbeat opens system 4: the first system of page 2.
  const m17 = locateTick(score, 16 * 144);
  assert.equal(m17.system, 4);
  assert.equal(m17.page, 1);
  assert.equal(m17.systemInPage, 0);
});

test('locateTick: out-of-range ticks clamp to the score ends', () => {
  const score = buildBachGoldbergVar1Score();
  const neg = locateTick(score, -50);
  assert.equal(neg.system, 0);
  assert.ok(Math.abs(neg.x - (SYS0.staffLeft + 6.0)) < 1e-9);
  const past = locateTick(score, score.totalTicks + 1000);
  assert.equal(past.system, 7);
  assert.equal(past.page, 1);
});

test('tickAtPoint: clicks resolve to measure downbeats', () => {
  const score = buildBachGoldbergVar1Score();
  const midSlot0 = SYS0.staffLeft + SYS0.measureWidth / 2;
  const midY = (SYS0.slotTopY + SYS0.staffBotY) / 2;
  assert.equal(tickAtPoint(score, 0, midSlot0, midY), 0);
  // Second measure slot of system 0 seeks to the m. 2 downbeat.
  assert.equal(
    tickAtPoint(score, 0, SYS0.staffLeft + 1.5 * SYS0.measureWidth, midY),
    144
  );
  // A click in system 1's band seeks into the second system.
  const sys1 = GEO.systems[1];
  const sys1Y = (sys1.slotTopY + sys1.staffBotY) / 2;
  assert.equal(tickAtPoint(score, 0, midSlot0, sys1Y), 576);
  // Page 2, first system: m. 17.
  assert.equal(tickAtPoint(score, 1, midSlot0, midY), 16 * 144);
  // Far outside clamps to the score ends.
  assert.equal(tickAtPoint(score, 0, -1000, -1000), 0);
  assert.equal(
    tickAtPoint(score, 9, 1e6, 1e6),
    score.totalTicks - (score.totalTicks % 144 || 144)
  );
});

test('checkMidiReadiness: the Bach benchmark is the golden v1 score', () => {
  assert.deepEqual(checkMidiReadiness(buildBachGoldbergVar1Score()), { ok: true });
});

function synthetic(overrides: Partial<QuantizedGridScore>): QuantizedGridScore {
  return {
    id: 'synthetic',
    title: 'Synthetic',
    composer: 'Test',
    ticksPerBeat: 48,
    totalTicks: 144,
    timeSignatures: [{ tick: 0, numerator: 3, denominator: 4 }],
    barlines: [],
    tempos: [{ tick: 0, bpm: 100 }],
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
    ...overrides,
  };
}

test('checkMidiReadiness: off-grid and oversized scores are refused with reasons', () => {
  const empty = checkMidiReadiness(synthetic({ notes: [] }));
  assert.equal(empty.ok, false);
  assert.match((empty as { reasons: string[] }).reasons.join(';'), /no notes/);

  const coarse = checkMidiReadiness(synthetic({ ticksPerBeat: 480 }));
  assert.equal(coarse.ok, false);
  assert.match(
    (coarse as { reasons: string[] }).reasons.join(';'),
    /timing grid of 480/
  );

  const fourFour = checkMidiReadiness(
    synthetic({ timeSignatures: [{ tick: 0, numerator: 4, denominator: 4 }] })
  );
  assert.equal(fourFour.ok, false);
  assert.match(
    (fourFour as { reasons: string[] }).reasons.join(';'),
    /meter 4\/4/
  );

  const huge = checkMidiReadiness(
    synthetic({
      notes: Array.from({ length: 6001 }, (_, i) => ({
        id: `n${i}`,
        pitch: { pitchClass: 0, octave: 4 },
        startTick: 0,
        durationTicks: 48,
        hand: 'RH' as const,
      })),
    })
  );
  assert.equal(huge.ok, false);
  assert.match((huge as { reasons: string[] }).reasons.join(';'), /too large/);
});
