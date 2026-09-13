/**
 * Chord Duration Specimen — the Round 10 demonstration window.
 *
 * Round 9 proved the midpoint duration taxonomy on tight three-note triads, but
 * its chords spanned barely one octave, so the brackets (and the scaled marks
 * they now carry) were never evaluated on the tall brackets real piano writing
 * produces. This curated two-measure score puts one **wide-span** right-hand
 * chord on each value of the duration taxonomy, in order and side by side:
 *
 * | onset (ticks) | value          | ticks | expected midpoint ink            |
 * | ------------- | -------------- | ----- | -------------------------------- |
 * | 12            | half           | 96    | the open knockout mark / gap      |
 * | 60            | quarter        | 48    | the plain bracket                 |
 * | 108           | dotted quarter | 72    | plain bracket + 0.75pt dot        |
 * | 156           | 8th            | 24    | one transverse mark               |
 * | 204           | 16th           | 12    | two parallel transverse marks     |
 *
 * Every chord is a four-voice close-position stack `[even, odd, even, odd]`
 * spread over octaves 4–5: one voice on each whole-tone row, so the four heads
 * form a clean vertical column and the bracket spans a full **45pt (1.5
 * octaves)** — the realistic tall bracket the scaled marks are judged on. The
 * opening onset deliberately steps off tick 0, so the specimen stays clean under
 * every chord-grouping paradigm (no Position-of-Honor halo for a neighbouring
 * row partner's stem to graze).
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

/**
 * The five wide-span specimen chords, in onset order: one voice per whole-tone
 * row of octaves 4–5 (even rank in octave 4, odd rank in octave 4, even rank in
 * octave 5, odd rank in octave 5). Every chord therefore spans exactly 45pt —
 * 1.5 octaves — and qualifies for the per-hand bracket as a four-voice column.
 */
const SPECIMEN_CHORDS: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  // half — pcs 0 (o4) · 7 (o4) · 2 (o5) · 9 (o5)
  [
    [0, 4],
    [7, 4],
    [2, 5],
    [9, 5],
  ],
  // quarter — pcs 4 (o4) · 11 (o4) · 6 (o5) · 1 (o5)
  [
    [4, 4],
    [11, 4],
    [6, 5],
    [1, 5],
  ],
  // dotted quarter — pcs 2 (o4) · 9 (o4) · 4 (o5) · 11 (o5)
  [
    [2, 4],
    [9, 4],
    [4, 5],
    [11, 5],
  ],
  // 8th — pcs 6 (o4) · 1 (o4) · 8 (o5) · 3 (o5)
  [
    [6, 4],
    [1, 4],
    [8, 5],
    [3, 5],
  ],
  // 16th — pcs 8 (o4) · 3 (o4) · 10 (o5) · 5 (o5)
  [
    [8, 4],
    [3, 4],
    [10, 5],
    [5, 5],
  ],
];

/** Build the curated multi-duration wide-span chord specimen score. */
export function buildChordDurationSpecimenScore(): QuantizedGridScore {
  const notes: QuantizedNote[] = [];
  CHORD_DURATION_SPECIMEN_VALUES.forEach((value, index) => {
    for (const [pitchClass, octave] of SPECIMEN_CHORDS[index]) {
      notes.push({
        id: `specimen-${value.label.replace(/\s+/g, '-')}-${pitchClass}-${octave}`,
        pitch: { pitchClass, octave },
        startTick: value.startTick,
        durationTicks: value.durationTicks,
        hand: 'RH',
        velocity: 84,
      });
    }
  });

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
    title: 'Wide-Span Chord Duration Specimen',
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
