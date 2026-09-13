/**
 * Rest Duration Specimen — the Round 15 demonstration window.
 *
 * Rounds 12–14 settled *where* a voice rest stands (the beat column of the
 * silence's onset), *how high* it sits (the voice contour of the surrounding
 * notes) and *how* it is seated (the nearest guaranteed-clear pocket). Every
 * rest in the canonical corpus, however, is the same single case: a 16th inside
 * a dense Bach run, always beside the other hand's entry — material on which the
 * five symbol dialects can never be compared without asking whether a difference
 * is the glyph or the neighbouring ink.
 *
 * This curated four-measure score isolates the question. Each standard rest
 * value gets its own 3/4 measure, opened at the same column (the measure's third
 * 16th, rel. tick 24), inside a stepwise right-hand line that falls silent for
 * exactly that value:
 *
 * | measure | value    | ticks | restTick |
 * | ------- | -------- | ----- | -------- |
 * | 1       | 16th     | 12    | 24       |
 * | 2       | 8th      | 24    | 168      |
 * | 3       | quarter  | 48    | 312      |
 * | 4       | half     | 96    | 456      |
 *
 * **The free-column guarantee.** The left hand keeps a sparse I–vi–IV–V
 * accompaniment that touches only the measure's downbeat (rel. 0) and beat 3
 * (rel. 96); every rest opens on rel. 24 and resumes 12 ticks later, so the
 * nearest foreign onset to any rest column is a full 24 ticks away — ≥ 20.8pt
 * even at the tightest four-measures-per-system crop, more than twice the 9.6pt
 * notehead diameter. No left-hand head can ever share a rest's column, and each
 * rest is therefore read against its own hand's contour alone.
 *
 * The right hand is otherwise **contiguous**: every note releases exactly on the
 * next onset, so each measure holds exactly one standard-value gap — the
 * demonstrated silence — and nothing else. All four rests are genuine silences
 * `computeJankoRestLayer` writes, none is a refusal, and the score engraves
 * clean (zero violations, zero warnings) under the golden options.
 */

import { QuantizedGridScore, QuantizedNote } from '../model/types';
import { JankoRestValue } from '../render/janko/elements/rests';

/** Quarter-note resolution shared with the rest of the repository. */
const TICKS_PER_BEAT = 48;
/** One 3/4 measure, exactly as in the canonical Jánko layout. */
export const REST_DURATION_SPECIMEN_TICKS_PER_MEASURE = 144;
/** Measures engraved in the specimen. */
export const REST_DURATION_SPECIMEN_MEASURES = 4;
/** Total length of the specimen score. */
export const REST_DURATION_SPECIMEN_TOTAL_TICKS =
  REST_DURATION_SPECIMEN_MEASURES * REST_DURATION_SPECIMEN_TICKS_PER_MEASURE;

/**
 * Tick inside its own measure at which every demonstrated silence opens: the
 * measure's third 16th. Holding the column constant across the four windows is
 * the point of the specimen — the dialects are compared at one and the same
 * page position, never at four different ones.
 */
const REST_TICK_IN_MEASURE = 24;

/** The four demonstrated values, shortest first, one per measure. */
export const REST_DURATION_SPECIMEN_VALUES: ReadonlyArray<{
  label: string;
  value: JankoRestValue;
  durationTicks: number;
  restTick: number;
  measure: number;
}> = [
  {
    label: '16th',
    value: 'sixteenth',
    durationTicks: 12,
    restTick: 0 * REST_DURATION_SPECIMEN_TICKS_PER_MEASURE + REST_TICK_IN_MEASURE,
    measure: 1,
  },
  {
    label: '8th',
    value: 'eighth',
    durationTicks: 24,
    restTick: 1 * REST_DURATION_SPECIMEN_TICKS_PER_MEASURE + REST_TICK_IN_MEASURE,
    measure: 2,
  },
  {
    label: 'quarter',
    value: 'quarter',
    durationTicks: 48,
    restTick: 2 * REST_DURATION_SPECIMEN_TICKS_PER_MEASURE + REST_TICK_IN_MEASURE,
    measure: 3,
  },
  {
    label: 'half',
    value: 'half',
    durationTicks: 96,
    restTick: 3 * REST_DURATION_SPECIMEN_TICKS_PER_MEASURE + REST_TICK_IN_MEASURE,
    measure: 4,
  },
];

/** One voice row: `[startTick, pitchClass, octave, durationTicks]`. */
type SpecimenRow = readonly [number, number, number, number];

/**
 * The right-hand line: one stepwise o4 melody through all four measures.
 * Consecutive 16ths always cross the E/F whole-tone boundary, so no two heads
 * of a 12-tick pair share a row; every other step is a full 24 ticks. Each
 * measure's only silence is the demonstrated value, opening on rel. 24.
 */
const RH_LINE: ReadonlyArray<SpecimenRow> = [
  // m. 1 — 16th silence between F4 and G4.
  [0, 4, 4, 12], // E4
  [12, 5, 4, 12], // F4 → releases on the rest
  [36, 7, 4, 24], // G4 resumes
  [60, 9, 4, 24], // A4
  [84, 11, 4, 24], // B4
  [108, 9, 4, 24], // A4
  [132, 7, 4, 12], // G4
  // m. 2 — 8th silence between E4 and D4.
  [144, 5, 4, 12], // F4
  [156, 4, 4, 12], // E4 → releases on the rest
  [192, 2, 4, 24], // D4 resumes
  [216, 4, 4, 24], // E4
  [240, 5, 4, 24], // F4
  [264, 7, 4, 24], // G4
  // m. 3 — quarter silence between E4 and D4.
  [288, 5, 4, 12], // F4
  [300, 4, 4, 12], // E4 → releases on the rest
  [360, 2, 4, 24], // D4 resumes
  [384, 4, 4, 24], // E4
  [408, 5, 4, 24], // F4
  // m. 4 — half silence between E4 and D4.
  [432, 4, 4, 24], // E4 → releases on the rest
  [552, 2, 4, 24], // D4 resumes
];

/**
 * The left hand: a sparse accompaniment confined to the measure's downbeat
 * (rel. 0) and beat 3 (rel. 96) — never rel. 24, never anywhere near a rest
 * column. The 8th + quarter pair releases on the next measure's downbeat, so
 * the hand's own gaps (72 and 0 ticks) are never standard rest values and the
 * specimen writes no accidental left-hand silence.
 */
const LH_LINE: ReadonlyArray<SpecimenRow> = [
  [0, 0, 3, 24], // C3 · m. 1 downbeat
  [96, 7, 2, 48], // G2 · m. 1 beat 3
  [144, 9, 2, 24], // A2
  [240, 4, 3, 48], // E3
  [288, 5, 2, 24], // F2
  [384, 0, 3, 48], // C3
  [432, 7, 2, 24], // G2
  [528, 2, 3, 48], // D3
];

/** One authored voice of the specimen, in engraving order. */
function specimenVoice(hand: 'RH' | 'LH', line: ReadonlyArray<SpecimenRow>): QuantizedNote[] {
  return line.map(([startTick, pitchClass, octave, durationTicks]) => ({
    id: `rest-specimen-${hand.toLowerCase()}-${startTick}`,
    pitch: { pitchClass, octave },
    startTick,
    durationTicks,
    hand,
    velocity: 84,
  }));
}

/** Build the curated one-rest-per-value duration specimen score. */
export function buildRestDurationSpecimenScore(): QuantizedGridScore {
  const barlines: QuantizedGridScore['barlines'] = [];
  for (let m = 0; m <= REST_DURATION_SPECIMEN_MEASURES; m++) {
    barlines.push({
      barNumber: m + 1,
      tick: m * REST_DURATION_SPECIMEN_TICKS_PER_MEASURE,
      type: (m === REST_DURATION_SPECIMEN_MEASURES ? 'final' : 'regular') as
        | 'final'
        | 'regular',
    });
  }

  return {
    id: 'rest-duration-specimen',
    title: 'Rest Duration Specimen',
    composer: 'Jánko Engraving Harness',
    ticksPerBeat: TICKS_PER_BEAT,
    gridResolution: TICKS_PER_BEAT / 2,
    totalTicks: REST_DURATION_SPECIMEN_TOTAL_TICKS,
    timeSignatures: [{ tick: 0, numerator: 3, denominator: 4 }],
    barlines,
    tempos: [],
    dynamics: [],
    pedals: [],
    notes: [...specimenVoice('RH', RH_LINE), ...specimenVoice('LH', LH_LINE)],
  };
}
