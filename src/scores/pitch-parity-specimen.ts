/**
 * Pitch Parity Specimen — the Round 43 pitch-readability fixture.
 * ==============================================================
 *
 * The corpus never states the two smallest pitch gaps on clean material, so this
 * registered, real score states them at one physical scale under the study's
 * two-column **whole-tone parity** placement (`pitchPlacement: 'parity-columns'`:
 * the even absolute-pitch family on the left, the odd family on the right):
 *
 * | measure | states | the rule it proves |
 * | ------- | ------ | ------------------ |
 * | 1 | a lone opening `0/4` (the Position of Honor, one head) then a **1-span** pair `4/4 · 5/4` | a 1-semitone pair is one even + one odd → **opposite** parity columns. Placed off the honor tick so the halo cannot fan it off its nominal rail. |
 * | 2 | a **2-span** pair `4/4 · 6/4` | a whole-tone pair is both even → **one** parity column, 5.0pt apart, fanned full size. |
 * | 3 | a 1-span pair `4/4 · 5/4` plus its **10-span repeat** `4/5` | an octave repeat re-takes the *same* parity column (30.0pt away). |
 * | 4 | a 1-span dyad, then a single note on the **next onset** | a true close **full-size, unbracketed** neighbour under next-onset pressure. |
 *
 * Every row is a plain **2-span-maximum** chord whose member durations are equal,
 * so the pitch columns are judged without any duration-grammar exception. The
 * study's 75 % size is reserved for **genuinely admitted** bracket members:
 *
 * - a **1-span** pair lands in **opposite** parity columns, so it is horizontally
 *   spread and the established scope rule admits it to a bracket → its two heads
 *   take 0.75;
 * - a **2-span** pair stays in **one** parity column (a clean two-note column,
 *   below `CLASP_MIN_VERTICAL_CHORD = 3` and not spread), so it is **not**
 *   admitted → both heads stay full size, with the established collision fan.
 *
 * The specimen's own options pin the parity placement; the candidate windows add
 * the duration grammar. Canonical `DEFAULT_JANKO_OPTIONS` is untouched.
 */

import { QuantizedGridScore, QuantizedNote } from '../model/types';
import {
  DEFAULT_JANKO_OPTIONS,
  DEFAULT_JANKO_TOKENS,
  JankoLayoutOptions,
  JankoTokens,
} from '../render/janko/types';

/** Quarter-note resolution shared with the rest of the repository. */
const TICKS_PER_BEAT = 48;
/** One fixture measure (4/4). */
export const PITCH_PARITY_TICKS_PER_MEASURE = 192;
/** Measures per system (rows per line). */
export const PITCH_PARITY_MEASURES_PER_SYSTEM = 4;

/** One row: `[measure(1-based), pitchClass, octave, durationTicks, offsetTicks?]`. */
type Row = readonly [number, number, number, number, number?];

/** The four authored measures. */
export const PITCH_PARITY_ROWS: readonly Row[] = [
  // m.1 — a lone opening note on the Position of Honor (one head, clean), then
  // a 1-span pair (one even + one odd) → opposite parity columns at their
  // nominal `pairGap`, off the honor tick so no halo fans it.
  [1, 0, 4, 96, 0],
  [1, 4, 4, 96, 96],
  [1, 5, 4, 96, 96],
  // m.2 — a 2-span pair (both even) → one parity column, 5.0pt apart.
  [2, 4, 4, 96, 0],
  [2, 6, 4, 96, 0],
  // m.3 — a 1-span pair plus its 10-span (octave) repeat; 4/4 and 4/5 share a
  // column, 5/4 sits in the other.
  [3, 4, 4, 96, 0],
  [3, 5, 4, 96, 0],
  [3, 4, 5, 96, 0],
  // m.4 — a 1-span dyad, then a single note on the very next onset.
  [4, 4, 4, 48, 0],
  [4, 5, 4, 48, 0],
  [4, 7, 4, 48, 48],
];

/** Total measures of the specimen. */
export const PITCH_PARITY_MEASURES = 4;
/** Total length of the specimen (ticks). */
export const PITCH_PARITY_TOTAL_TICKS = PITCH_PARITY_MEASURES * PITCH_PARITY_TICKS_PER_MEASURE;

/** One authored sound of the specimen, spelled for the tests. */
export interface PitchParityNote {
  id: string;
  measure: number;
  pitchClass: number;
  octave: number;
  startTick: number;
  durationTicks: number;
}

/** Every note of the specimen. */
export const PITCH_PARITY_NOTES: readonly PitchParityNote[] = PITCH_PARITY_ROWS.map(
  ([measure, pitchClass, octave, durationTicks, offsetTicks]) => {
    const startTick = (measure - 1) * PITCH_PARITY_TICKS_PER_MEASURE + (offsetTicks ?? 0);
    return {
      id: `pps-${startTick}-${pitchClass}_${octave}`,
      measure,
      pitchClass,
      octave,
      startTick,
      durationTicks,
    };
  }
);

function specimenVoice(rows: readonly PitchParityNote[]): QuantizedNote[] {
  return rows.map((r) => ({
    id: r.id,
    pitch: { pitchClass: r.pitchClass, octave: r.octave },
    startTick: r.startTick,
    durationTicks: r.durationTicks,
    hand: 'RH' as const,
    velocity: 84,
  }));
}

/** Jánko layout options: 4/4 rows, four per system, two-column parity placement. */
export const PITCH_PARITY_SPECIMEN_JANKO_OPTIONS: Partial<JankoLayoutOptions> = {
  ...DEFAULT_JANKO_OPTIONS,
  ticksPerMeasure: PITCH_PARITY_TICKS_PER_MEASURE,
  measuresPerSystem: PITCH_PARITY_MEASURES_PER_SYSTEM,
  pitchPlacement: 'parity-columns',
  title: 'Pitch Parity Specimen',
  subtitle: '1-span and 2-span pairs, octave repeats (two-column parity)',
  composer: 'Jánko Engraving Harness',
};

/** Micro-typography of the specimen: the 192-tick row grid, golden tokens. */
export const PITCH_PARITY_SPECIMEN_JANKO_TOKENS: Partial<JankoTokens> = {
  ...DEFAULT_JANKO_TOKENS,
  ticksPerMeasure: PITCH_PARITY_TICKS_PER_MEASURE,
};

/** Build the registered Round-43 pitch-parity specimen score. */
export function buildPitchParitySpecimenScore(): QuantizedGridScore {
  const barlines: QuantizedGridScore['barlines'] = [];
  for (let m = 0; m <= PITCH_PARITY_MEASURES; m++) {
    barlines.push({
      barNumber: m + 1,
      tick: m * PITCH_PARITY_TICKS_PER_MEASURE,
      type: (m === PITCH_PARITY_MEASURES ? 'final' : 'regular') as 'final' | 'regular',
    });
  }
  return {
    id: 'pitch-parity-specimen',
    title: 'Pitch Parity Specimen',
    composer: 'Jánko Engraving Harness',
    ticksPerBeat: TICKS_PER_BEAT,
    gridResolution: 24,
    totalTicks: PITCH_PARITY_TOTAL_TICKS,
    timeSignatures: [{ tick: 0, numerator: 4, denominator: 4 }],
    barlines,
    tempos: [],
    dynamics: [],
    pedals: [],
    notes: specimenVoice(PITCH_PARITY_NOTES),
  };
}
