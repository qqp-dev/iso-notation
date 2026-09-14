/**
 * Rest Duration Specimen — the Round 15 demonstration window, extended by
 * **Round 20** with the whole-bar context.
 *
 * Rounds 12–14 settled *where* a voice rest stands (the beat column of the
 * silence's onset), *how high* it sits (the phrase row of the surrounding
 * notes) and *how* it is seated. Round 20 seats the glyph by its **ink
 * centroid** and re-cuts every value against the classical standard, and adds
 * the one duration the corpus never stated: the **whole bar** (192 ticks, one
 * complete measure).
 *
 * This curated score isolates the question. Six 4/4 measures, one genuine
 * silence per standard value, each opening on the measure's third 16th (rel.
 * tick 24) inside a stepwise right-hand line that falls silent for exactly that
 * value:
 *
 * | measure | value    | ticks | restTick |
 * | ------- | -------- | ----- | -------- |
 * | 1       | 16th     | 12    | 24       |
 * | 2       | 8th      | 24    | 216      |
 * | 3       | quarter  | 48    | 408      |
 * | 4       | half     | 96    | 600      |
 * | 5       | whole    | 192   | 768      |
 * | 6       | —        | —     | resume   |
 *
 * The whole bar is the classical sign for a wholly silent measure, so its
 * context is one: m. 5 is the right hand's silent measure — the hand releases
 * exactly on its downbeat (768) and resumes exactly one measure later (960) —
 * and the engine states the whole form there (see `isWholeBarSilence`).
 *
 * **The free-column guarantee.** The left hand keeps a sparse I–vi–IV–V
 * accompaniment that touches only each measure's downbeat and its third beat;
 * every short rest opens on rel. 24 and resumes 12 ticks later, so the nearest
 * foreign onset to any rest column is a full 24 ticks away (17.1pt even at the
 * four-measures-per-system crop, more than the 9.6pt notehead diameter plus the
 * seating air). No left-hand head can ever share a rest's column, and each rest
 * is therefore read against its own hand's contour alone.
 *
 * The right hand is otherwise **contiguous**: every note releases exactly on the
 * next onset, so each measure holds exactly one standard-value gap — the
 * demonstrated silence — and nothing else. All six rests are genuine silences
 * `computeJankoRestLayer` writes, none is a refusal, and the score engraves
 * clean (zero violations, zero warnings) under the golden options.
 */

import { QuantizedGridScore, QuantizedNote } from '../model/types';
import { JankoRestValue } from '../render/janko/elements/rests';
import {
  DEFAULT_JANKO_OPTIONS,
  DEFAULT_JANKO_TOKENS,
  JankoLayoutOptions,
  JankoTokens,
} from '../render/janko/types';

/** Quarter-note resolution shared with the rest of the repository. */
const TICKS_PER_BEAT = 48;
/** One 4/4 measure — the meter that can state a 192-tick whole bar. */
export const REST_DURATION_SPECIMEN_TICKS_PER_MEASURE = 192;
/**
 * Measures engraved in the specimen.
 *
 * Round 21 §E completes the working set: the five original windows (mm. 1–5),
 * the whole bar's resume measure (m. 6), and the two values the corpus never
 * states — the **32nd** (m. 7) and the **64th** (m. 8) — so the specimen walks
 * the whole `64th … whole` taxonomy.
 */
export const REST_DURATION_SPECIMEN_MEASURES = 8;
/** Total length of the specimen score. */
export const REST_DURATION_SPECIMEN_TOTAL_TICKS =
  REST_DURATION_SPECIMEN_MEASURES * REST_DURATION_SPECIMEN_TICKS_PER_MEASURE;

/**
 * Tick inside its own measure at which every **short** demonstrated silence
 * opens: the measure's third 16th. Holding the column constant across the four
 * short windows is the point of the specimen — the dialects are compared at one
 * and the same page position, never at four different ones.
 */
const REST_TICK_IN_MEASURE = 24;

/** Every demonstrated value, shortest first, one per measure. */
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
  {
    label: 'whole',
    value: 'whole',
    durationTicks: 192,
    // The whole bar opens on its own measure's downbeat and covers the measure.
    restTick: 4 * REST_DURATION_SPECIMEN_TICKS_PER_MEASURE,
    measure: 5,
  },
  // Round 21 §E — the two values the corpus never states. Both open on the
  // measure's third 16th, exactly like the four short windows, so the cut is
  // compared at one and the same page position.
  {
    label: '32nd',
    value: 'thirty-second',
    durationTicks: 6,
    restTick: 6 * REST_DURATION_SPECIMEN_TICKS_PER_MEASURE + REST_TICK_IN_MEASURE,
    measure: 7,
  },
  {
    label: '64th',
    value: 'sixty-fourth',
    durationTicks: 3,
    restTick: 7 * REST_DURATION_SPECIMEN_TICKS_PER_MEASURE + REST_TICK_IN_MEASURE,
    measure: 8,
  },
];

/**
 * Jánko layout options for this specimen: the 4/4 measure a whole bar needs,
 * three measures per system — the same horizontal density as the Round 15
 * three-beat specimen, so every rest is read at the same macro scale.
 * The whole-bar silence of m. 5 must not open a system: a silence is stated
 * only where its hand owns the releasing onset too, exactly like every other
 * voice rest.
 */
export const REST_DURATION_SPECIMEN_JANKO_OPTIONS: Partial<JankoLayoutOptions> = {
  ...DEFAULT_JANKO_OPTIONS,
  core: 'adaptive',
  ticksPerMeasure: REST_DURATION_SPECIMEN_TICKS_PER_MEASURE,
  // Three per system, unchanged: every rest is read at the same macro scale as
  // the original five windows (the Round 21 windows simply extend the run).
  measuresPerSystem: 3,
  title: 'Rest Duration Specimen',
  subtitle: 'one silence per value, 16th … whole bar',
  composer: 'Jánko Engraving Harness',
};

/** Micro-typography of the specimen: the 4/4 grid, golden tokens otherwise. */
export const REST_DURATION_SPECIMEN_JANKO_TOKENS: Partial<JankoTokens> = {
  ...DEFAULT_JANKO_TOKENS,
  ticksPerMeasure: REST_DURATION_SPECIMEN_TICKS_PER_MEASURE,
};

/** One voice row: `[startTick, pitchClass, octave, durationTicks]`. */
type SpecimenRow = readonly [number, number, number, number];

/**
 * The right-hand line: one stepwise o4 melody through all six measures.
 * Consecutive 16ths always cross the E/F whole-tone boundary, so no two heads
 * of a 12-tick pair share a row; every other step is a full 24 ticks. Each of
 * the first five measures holds exactly one silence — the demonstrated value,
 * opening on rel. 24 (mm. 1–4) or on the downbeat (m. 5) — and m. 6 resumes.
 */
const RH_LINE: ReadonlyArray<SpecimenRow> = [
  // m. 1 — 16th silence between F4 and G4.
  [0, 4, 4, 12], // E4
  [12, 5, 4, 12], // F4 → releases on the rest
  [36, 7, 4, 24], // G4 resumes
  [60, 9, 4, 24], // A4
  [84, 11, 4, 24], // B4
  [108, 9, 4, 24], // A4
  [132, 7, 4, 24], // G4
  [156, 5, 4, 36], // F4 → releases on the next downbeat
  // m. 2 — 8th silence between F4 and D4.
  [192, 4, 4, 12], // E4
  [204, 5, 4, 12], // F4 → releases on the rest
  [240, 2, 4, 24], // D4 resumes
  [264, 4, 4, 24], // E4
  [288, 5, 4, 24], // F4
  [312, 7, 4, 24], // G4
  [336, 9, 4, 48], // A4 → releases on the next downbeat
  // m. 3 — quarter silence between E4 and D4.
  [384, 5, 4, 12], // F4
  [396, 4, 4, 12], // E4 → releases on the rest
  [456, 2, 4, 24], // D4 resumes
  [480, 4, 4, 24], // E4
  [504, 5, 4, 24], // F4
  [528, 7, 4, 48], // G4 → releases on the next downbeat
  // m. 4 — half silence between E4 and D4.
  [576, 5, 4, 12], // F4
  [588, 4, 4, 12], // E4 → releases on the rest
  [696, 2, 4, 24], // D4 resumes
  [720, 4, 4, 24], // E4
  [744, 5, 4, 24], // F4 → releases on the next downbeat
  // m. 5 — the whole bar: the hand is silent, then resumes on m. 6's downbeat.
  // m. 6 — the closing gesture.
  [960, 7, 4, 48], // G4
  [1008, 9, 4, 48], // A4
  [1056, 11, 4, 48], // B4
  [1104, 7, 4, 48], // G4
  // m. 7 — 32nd silence between F4 and G4.
  [1152, 4, 4, 12], // E4
  [1164, 5, 4, 12], // F4 → releases on the rest
  [1182, 8, 4, 6], // G#4 resumes (a 32nd) on the *other* row, so the rest's phrase
  //                 row is not the row the 6-tick neighbour sits on
  [1188, 7, 4, 24], // G4
  [1212, 11, 4, 24], // B4
  [1236, 9, 4, 24], // A4
  [1260, 7, 4, 24], // G4
  [1284, 5, 4, 60], // F4 → releases on the next downbeat
  // m. 8 — 64th silence between F4 and G4.
  [1344, 4, 4, 12], // E4
  [1356, 5, 4, 12], // F4 → releases on the rest
  [1371, 8, 4, 3], // G#4 resumes (a 64th) on the other row, so the 3-tick
  //                 neighbour never shares the rest's row
  [1374, 7, 4, 24], // G4
  [1398, 9, 4, 18], // A4
  [1416, 11, 4, 24], // B4
  [1440, 9, 4, 24], // A4
  [1464, 7, 4, 36], // G4
  [1500, 5, 4, 36], // F4 → releases on the closing barline
];

/**
 * The left hand: a sparse accompaniment confined to each measure's downbeat and
 * third beat. Its gaps are 72 ticks or 0 — never a standard rest value — so the
 * specimen writes no accidental left-hand silence, and no onset can share a
 * rest's column (the nearest is 24 ticks away). In m. 5 the hand moves off the
 * downbeat so the whole-bar rest owns its measure's opening column.
 */
const LH_LINE: ReadonlyArray<SpecimenRow> = [
  [0, 0, 3, 24], // C3 · m. 1 downbeat
  [96, 7, 2, 96], // G2 · m. 1 beat 3
  [192, 9, 2, 24], // A2
  [288, 5, 2, 96], // F2
  [384, 0, 3, 24], // C3
  [480, 7, 2, 96], // G2
  [576, 2, 3, 24], // D3
  [672, 9, 2, 144], // A2 → releases on m. 5's off-downbeat entry
  [816, 4, 3, 48], // E3 · m. 5, clear of the whole-bar rest's column
  [864, 0, 3, 96], // C3
  [960, 5, 3, 24], // F3 · m. 6 downbeat
  [1056, 7, 3, 96], // G3
  [1152, 0, 3, 24], // C3 · m. 7 downbeat
  [1248, 7, 2, 96], // G2 · m. 7 beat 3
  [1344, 2, 3, 24], // D3 · m. 8 downbeat
  [1440, 9, 2, 96], // A2 · m. 8 beat 3
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
    // Round 21 §E: the specimen now states 64th silences (3 ticks), so the
    // score's grid resolution is their GCD, not a half-beat.
    gridResolution: 3,
    totalTicks: REST_DURATION_SPECIMEN_TOTAL_TICKS,
    timeSignatures: [{ tick: 0, numerator: 4, denominator: 4 }],
    barlines,
    tempos: [],
    dynamics: [],
    pedals: [],
    notes: [...specimenVoice('RH', RH_LINE), ...specimenVoice('LH', LH_LINE)],
  };
}
