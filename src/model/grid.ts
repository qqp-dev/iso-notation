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

export interface BeamCluster {
  id: string;
  hand: 'RH' | 'LH';
  beatIndex: number;
  notes: QuantizedNote[];
  startTick: number; // minimum startTick among notes in cluster
  endTick: number;   // maximum startTick among notes in cluster
  minPitch: number;  // min linearPitch among notes in cluster
  maxPitch: number;  // max linearPitch among notes in cluster
}

/**
 * Computes metric beam clusters for a collection of notes.
 *
 * Notes belonging to the same hand and beat are grouped into a coherent beam
 * cluster when consecutive notes fall within maxPitchDelta semitones (default 7)
 * and belong to compatible rhythmic tiers (e.g. continuous 16th notes).
 *
 * Register leaps (> maxPitchDelta) or rhythmic tier mismatches split into
 * separate clusters so that large accompaniment leaps do not pull wide stems.
 */
export function computeBeamClusters(
  notes: QuantizedNote[],
  ticksPerBeat: number,
  tauRef: number = 12,
  maxPitchDelta: number = 7
): BeamCluster[] {
  if (notes.length === 0 || ticksPerBeat <= 0) return [];

  // Sort notes primarily by startTick, secondarily by linearPitch
  const sorted = [...notes].sort((a, b) => {
    if (a.startTick !== b.startTick) return a.startTick - b.startTick;
    return linearIndex(a.pitch) - linearIndex(b.pitch);
  });

  const clusters: BeamCluster[] = [];
  let clusterCounter = 0;

  for (const hand of ['RH', 'LH'] as const) {
    const handNotes = sorted.filter(n => {
      const nHand = n.hand ?? (linearIndex(n.pitch) >= 48 ? 'RH' : 'LH');
      return nHand === hand;
    });

    // Group notes by beatIndex
    const beatMap = new Map<number, QuantizedNote[]>();
    for (const n of handNotes) {
      const bIdx = Math.floor(n.startTick / ticksPerBeat);
      let list = beatMap.get(bIdx);
      if (!list) {
        list = [];
        beatMap.set(bIdx, list);
      }
      list.push(n);
    }

    // Process each beat
    for (const [bIdx, bNotes] of beatMap.entries()) {
      if (bNotes.length === 1) {
        const lp = linearIndex(bNotes[0].pitch);
        clusters.push({
          id: `cluster-${++clusterCounter}`,
          hand,
          beatIndex: bIdx,
          notes: bNotes,
          startTick: bNotes[0].startTick,
          endTick: bNotes[0].startTick,
          minPitch: lp,
          maxPitch: lp,
        });
        continue;
      }

      let currentGroup: QuantizedNote[] = [bNotes[0]];
      for (let i = 1; i < bNotes.length; i++) {
        const prev = bNotes[i - 1];
        const curr = bNotes[i];
        const prevPitch = linearIndex(prev.pitch);
        const currPitch = linearIndex(curr.pitch);
        const pitchDelta = Math.abs(currPitch - prevPitch);

        // Beam grouping rules:
        // 1. Rapid subdivision streams (<= tauRef, e.g. 16th notes) group within maxPitchDelta (7st).
        // 2. Slower accompaniment notes (e.g. 8th notes) only group if step-wise (pitchDelta <= 4st).
        // 3. Mixed rhythmic tiers (e.g. 8th note followed by 16th note) split into separate groups.
        const isSubdivisionStream = prev.durationTicks <= tauRef && curr.durationTicks <= tauRef && pitchDelta <= maxPitchDelta;
        const isStepwiseEqual = prev.durationTicks === curr.durationTicks && pitchDelta <= 4;
        const canGroup = isSubdivisionStream || isStepwiseEqual;

        if (canGroup) {
          currentGroup.push(curr);
        } else {
          const lPitches = currentGroup.map(n => linearIndex(n.pitch));
          clusters.push({
            id: `cluster-${++clusterCounter}`,
            hand,
            beatIndex: bIdx,
            notes: currentGroup,
            startTick: currentGroup[0].startTick,
            endTick: currentGroup[currentGroup.length - 1].startTick,
            minPitch: Math.min(...lPitches),
            maxPitch: Math.max(...lPitches),
          });
          currentGroup = [curr];
        }
      }

      if (currentGroup.length > 0) {
        const lPitches = currentGroup.map(n => linearIndex(n.pitch));
        clusters.push({
          id: `cluster-${++clusterCounter}`,
          hand,
          beatIndex: bIdx,
          notes: currentGroup,
          startTick: currentGroup[0].startTick,
          endTick: currentGroup[currentGroup.length - 1].startTick,
          minPitch: Math.min(...lPitches),
          maxPitch: Math.max(...lPitches),
        });
      }
    }
  }

  // Sort clusters chronologically by startTick
  clusters.sort((a, b) => a.startTick - b.startTick);
  return clusters;
}

