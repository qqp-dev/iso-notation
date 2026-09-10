import { QuantizedGridScore, QuantizedNote, HandCrossingEvent, PitchCoordinate } from './types';
import { linearIndex, fromLinearIndex } from './pitch';

/**
 * Standard Euclidean Greatest Common Divisor
 */
export function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x;
}

/**
 * GCD over an array of integers
 */
export function multiGcd(values: number[]): number {
  if (values.length === 0) return 1;
  return values.reduce((acc, curr) => gcd(acc, curr));
}

/**
 * Calculates the minimal grid interval Delta t (GCD) required to losslessly map
 * every onset and duration in the notes collection.
 */
export function computeOptimalGridResolution(notes: QuantizedNote[]): number {
  const intervals: number[] = [];
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i];
    if (n.durationTicks > 0) {
      intervals.push(n.durationTicks);
    }
    if (n.startTick > 0) {
      intervals.push(n.startTick);
    }
  }
  return intervals.length > 0 ? multiGcd(intervals) : 1;
}

/**
 * Invariant verification: ensures that all note onsets and durations are non-negative,
 * positive durations, and align cleanly with the time grid.
 */
export function verifyLosslessGrid(score: QuantizedGridScore): { lossless: boolean; errors: string[] } {
  const errors: string[] = [];
  if (score.ticksPerBeat <= 0) {
    errors.push(`ticksPerBeat must be positive; got ${score.ticksPerBeat}`);
  }

  for (const note of score.notes) {
    if (note.startTick < 0) {
      errors.push(`Note ${note.id} has negative startTick ${note.startTick}`);
    }
    if (note.durationTicks <= 0) {
      errors.push(`Note ${note.id} has non-positive durationTicks ${note.durationTicks}`);
    }
    if (note.pitch.pitchClass < 0 || note.pitch.pitchClass > 11) {
      errors.push(`Note ${note.id} has invalid pitchClass ${note.pitch.pitchClass}`);
    }
    if (note.pitch.octave < 0) {
      errors.push(`Note ${note.id} has negative octave ${note.pitch.octave}`);
    }
  }

  return {
    lossless: errors.length === 0,
    errors,
  };
}

/**
 * Returns all notes sounding at a given tick (startTick <= tick < startTick + durationTicks)
 */
export function getActiveNotesAtTick(score: QuantizedGridScore, tick: number): QuantizedNote[] {
  return score.notes.filter(n => tick >= n.startTick && tick < n.startTick + n.durationTicks);
}

/**
 * Finds bounding pitch range of the score
 */
export function getScorePitchRange(score: QuantizedGridScore): {
  minLinear: number;
  maxLinear: number;
  minPitch: PitchCoordinate;
  maxPitch: PitchCoordinate;
} {
  if (score.notes.length === 0) {
    return {
      minLinear: 48,
      maxLinear: 60,
      minPitch: fromLinearIndex(48),
      maxPitch: fromLinearIndex(60),
    };
  }

  let minLinear = Infinity;
  let maxLinear = -Infinity;

  for (const n of score.notes) {
    const idx = linearIndex(n.pitch);
    if (idx < minLinear) minLinear = idx;
    if (idx > maxLinear) maxLinear = idx;
  }

  return {
    minLinear,
    maxLinear,
    minPitch: fromLinearIndex(minLinear),
    maxPitch: fromLinearIndex(maxLinear),
  };
}

/**
 * Dynamically computes hand crossings across the timeline.
 * A hand crossing occurs when Left Hand pitch is higher than Right Hand pitch.
 */
export function detectHandCrossings(score: QuantizedGridScore): HandCrossingEvent[] {
  const events: HandCrossingEvent[] = [];
  const sortedNotes = [...score.notes].sort((a, b) => a.startTick - b.startTick);
  if (sortedNotes.length === 0) return events;

  const maxTick = score.totalTicks;
  let inCrossing = false;
  let crossingStartTick = 0;
  let currentHigherHand: 'LH' | 'RH' = 'LH';

  // Sample along grid points
  const delta = Math.max(1, Math.floor(score.ticksPerBeat / 4)); // 16th note resolution
  for (let t = 0; t <= maxTick; t += delta) {
    const active = getActiveNotesAtTick(score, t);
    const rh = active.filter(n => n.hand === 'RH');
    const lh = active.filter(n => n.hand === 'LH');

    if (rh.length > 0 && lh.length > 0) {
      const maxLh = Math.max(...lh.map(n => linearIndex(n.pitch)));
      const minRh = Math.min(...rh.map(n => linearIndex(n.pitch)));

      if (maxLh > minRh) {
        // LH is physically higher than RH! Hand crossing.
        if (!inCrossing) {
          inCrossing = true;
          crossingStartTick = t;
          currentHigherHand = 'LH';
        }
      } else {
        if (inCrossing) {
          events.push({
            tick: crossingStartTick,
            durationTicks: Math.max(delta, t - crossingStartTick),
            higherHand: currentHigherHand,
            description: 'LH crosses above RH',
          });
          inCrossing = false;
        }
      }
    } else {
      if (inCrossing) {
        events.push({
          tick: crossingStartTick,
          durationTicks: Math.max(delta, t - crossingStartTick),
          higherHand: currentHigherHand,
          description: 'LH crosses above RH',
        });
        inCrossing = false;
      }
    }
  }

  if (inCrossing) {
    events.push({
      tick: crossingStartTick,
      durationTicks: Math.max(delta, maxTick - crossingStartTick),
      higherHand: currentHigherHand,
      description: 'LH crosses above RH',
    });
  }

  return events;
}

/**
 * Maps a tick to measure, beat, and tick-in-beat
 */
export function tickToMeasureBeat(
  tick: number,
  score: QuantizedGridScore
): { measure: number; beat: number; tickInBeat: number } {
  // Find applicable time signature
  let numerator = 4;
  let denominator = 4;
  for (const ts of score.timeSignatures) {
    if (tick >= ts.tick) {
      numerator = ts.numerator;
      denominator = ts.denominator;
    }
  }

  const ticksPerBeat = score.ticksPerBeat * (4 / denominator);
  const ticksPerMeasure = ticksPerBeat * numerator;

  const measure = Math.floor(tick / ticksPerMeasure) + 1;
  const tickInMeasure = tick % ticksPerMeasure;
  const beat = Math.floor(tickInMeasure / ticksPerBeat) + 1;
  const tickInBeat = tickInMeasure % ticksPerBeat;

  return { measure, beat, tickInBeat };
}
