/**
 * Chord Duration Specimen — the Round 9 demonstration window.
 *
 * Round 8's Brahms mm. 7–8 window carried only quarter-and-longer clasp values,
 * so the midpoint duration marks were never on screen and the round could not
 * be judged. This curated two-measure score puts one three-voice right-hand
 * chord on each value of the duration taxonomy, in order and side by side:
 *
 * | onset (ticks) | value          | ticks | expected midpoint ink           |
 * | ------------- | -------------- | ----- | ------------------------------- |
 * | 12            | half           | 96    | the open ring (pip)             |
 * | 60            | quarter        | 48    | the plain bracket               |
 * | 108           | dotted quarter | 72    | plain bracket + 0.75pt dot      |
 * | 156           | 8th            | 24    | one duration mark               |
 * | 204           | 16th           | 12    | two mirrored duration marks     |
 *
 * Every chord is `[0, 2, 5]` in octave 4: two whole-tone Set A tones share the
 * even row, so the onset is a row-snapped hand cluster (and a three-note chord),
 * i.e. exactly the sonority the per-hand clasp brackets. The opening onset
 * deliberately steps off tick 0, so the specimen stays clean under every
 * chord-grouping paradigm (no Position-of-Honor halo for a neighbouring row
 * partner's stem to graze).
 */

import { QuantizedGridScore, QuantizedNote } from '../model/types';

/** Quarter-note resolution shared with the rest of the repository. */
const TICKS_PER_BEAT = 48;
/** One 3/4 measure, exactly as in the canonical Jánko layout. */
export const CHORD_DURATION_SPECIMEN_TICKS_PER_MEASURE = 144;
/** Measures engraved in the specimen. */
export const CHORD_DURATION_SPECIMEN_MEASURES = 2;
/** Total length of the specimen score. */
export const CHORD_DURATION_SPECIMEN_TOTAL_TICKS =
  CHORD_DURATION_SPECIMEN_MEASURES * CHORD_DURATION_SPECIMEN_TICKS_PER_MEASURE;

/** The five demonstrated values, longest first, with the onset of each. */
export const CHORD_DURATION_SPECIMEN_VALUES: ReadonlyArray<{
  label: string;
  durationTicks: number;
  startTick: number;
}> = [
  { label: 'half', durationTicks: 96, startTick: 12 },
  { label: 'quarter', durationTicks: 48, startTick: 60 },
  { label: 'dotted quarter', durationTicks: 72, startTick: 108 },
  { label: '8th', durationTicks: 24, startTick: 156 },
  { label: '16th', durationTicks: 12, startTick: 204 },
];

/** The shared three-voice specimen chord: pc 0 + 2 share the even row, pc 5 the odd one. */
const SPECIMEN_CHORD: ReadonlyArray<readonly [number, number]> = [
  [0, 4],
  [2, 4],
  [5, 4],
];

/** Build the curated multi-duration chord specimen score. */
export function buildChordDurationSpecimenScore(): QuantizedGridScore {
  const notes: QuantizedNote[] = [];
  for (const value of CHORD_DURATION_SPECIMEN_VALUES) {
    for (const [pitchClass, octave] of SPECIMEN_CHORD) {
      notes.push({
        id: `specimen-${value.label.replace(/\s+/g, '-')}-${pitchClass}`,
        pitch: { pitchClass, octave },
        startTick: value.startTick,
        durationTicks: value.durationTicks,
        hand: 'RH',
        velocity: 84,
      });
    }
  }

  const barlines: QuantizedGridScore['barlines'] = [];
  for (let m = 0; m <= CHORD_DURATION_SPECIMEN_MEASURES; m++) {
    barlines.push({
      barNumber: m + 1,
      tick: m * CHORD_DURATION_SPECIMEN_TICKS_PER_MEASURE,
      type: (m === CHORD_DURATION_SPECIMEN_MEASURES ? 'final' : 'regular') as
        | 'final'
        | 'regular',
    });
  }

  return {
    id: 'chord-duration-specimen',
    title: 'Chord Duration Specimen',
    composer: 'Jánko Engraving Harness',
    ticksPerBeat: TICKS_PER_BEAT,
    gridResolution: TICKS_PER_BEAT / 2,
    totalTicks: CHORD_DURATION_SPECIMEN_TOTAL_TICKS,
    timeSignatures: [{ tick: 0, numerator: 3, denominator: 4 }],
    barlines,
    tempos: [],
    dynamics: [],
    pedals: [],
    notes,
  };
}
