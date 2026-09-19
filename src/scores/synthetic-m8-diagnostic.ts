/**
 * Synthetic m.8 Diagnostic Specimen (Round 37).
 *
 * Demonstrates real-engine disambiguation of the inner G3→A3 perturbation
 * with identical outer span (14 semitones), note count (5 notes), and parities
 * (all odd).
 */

import { QuantizedGridScore, QuantizedNote } from '../model/types';
import { detectHandCrossings } from '../model/grid';
import {
  BRAHMS_OP118_NO1_ANACRUSIS_TICKS,
  BRAHMS_OP118_NO1_TICKS_PER_MEASURE,
  buildBrahmsOp118No1Score,
} from './brahms-op118-no1';

/**
 * Build the synthetic m.8 diagnostic score (Round 37).
 * Extracts Brahms m.8 and perturbs inner G3 (lin 43) to A3 (lin 45) at tick 0.
 */
export function buildSyntheticM8DiagnosticScore(): QuantizedGridScore {
  const brahms = buildBrahmsOp118No1Score();
  const m8Start = BRAHMS_OP118_NO1_ANACRUSIS_TICKS + 7 * BRAHMS_OP118_NO1_TICKS_PER_MEASURE; // 1392
  const m8End = m8Start + BRAHMS_OP118_NO1_TICKS_PER_MEASURE; // 1584
  const notes: QuantizedNote[] = brahms.notes
    .filter((n) => n.startTick >= m8Start && n.startTick < m8End)
    .map((n) => {
      const shifted: QuantizedNote = {
        ...n,
        id: `synth-${n.id}`,
        startTick: n.startTick - m8Start,
      };
      // Perturb inner G3 (pc 7, oct 3) -> A3 (pc 9, oct 3) at tick 0 (m.8 beat 1)
      if (
        n.hand === 'RH' &&
        n.startTick === m8Start &&
        n.pitch.pitchClass === 7 &&
        n.pitch.octave === 3
      ) {
        return {
          ...shifted,
          pitch: { pitchClass: 9, octave: 3 },
        };
      }
      return shifted;
    });

  const barlines: QuantizedGridScore['barlines'] = [
    { barNumber: 1, tick: 0, type: 'regular' },
    { barNumber: 2, tick: BRAHMS_OP118_NO1_TICKS_PER_MEASURE, type: 'final' },
  ];

  const score: QuantizedGridScore = {
    id: 'synthetic-m8-diagnostic',
    title: 'Synthetic Diagnostic · Brahms Op. 118 No. 1 m.8 inner G3→A3 perturbation',
    composer: 'Johannes Brahms (Diagnostic)',
    opus: 'Op. 118',
    ticksPerBeat: brahms.ticksPerBeat,
    gridResolution: brahms.gridResolution,
    totalTicks: BRAHMS_OP118_NO1_TICKS_PER_MEASURE,
    timeSignatures: [{ tick: 0, numerator: 2, denominator: 2 }],
    barlines,
    tempos: [{ tick: 0, bpm: 88, description: 'Allegro non assai, ma molto appassionato' }],
    dynamics: [],
    pedals: [],
    notes,
  };

  score.handCrossings = detectHandCrossings(score);
  return score;
}
