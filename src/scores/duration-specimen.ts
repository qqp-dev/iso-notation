/**
 * Duration Working-Set Specimen — the Round 21 §E window.
 *
 * The corpus states no 32nds and no 64ths (Bach's shortest value is a 16th, so
 * do the Brahms bars), and the repo therefore had no specimen that rendered
 * them either: the working set `64th … whole` was complete on paper only. Round
 * 21 constructs the missing specimens — the RestSpec precedent, no unproven
 * parts — and this score is the **rhythm** half of that construction:
 *
 * | measure | material | what it proves |
 * | ------- | -------- | -------------- |
 * | 1 | eight 32nds in one beat | **tertiary** beam level (level 3) over a run |
 * | 2 | eight 64ths in one beat | **quaternary** beam level (level 4) over a run |
 * | 3 | 8th + 16ths + 32nds + 8th in one beat | the levels **nest generically** (1-2-3 strips, partial inner spans) |
 * | 4 | two lone 16ths in 8th groups | Gould **partial beams**: backward at the end of a group, forward at its start |
 * | 5 | a solo 32nd and a solo 64th | solitary **triple and quad flags** (`subdivisionMarkCount` 3 and 4) |
 *
 * Every short run alternates `pc 7 / pc 8`, so consecutive 3-tick and 6-tick
 * onsets stand on **different whole-tone rows** — the one arrangement in which
 * this lattice can hold them without a mask collision (a 64th's proportional
 * column step, ≈2.8pt at this density, is narrower than one notehead mask). The
 * left hand keeps a sparse accompaniment on each measure's downbeat and third
 * beat, so no foreign head can enter a short run's beat.
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
/** One 4/4 measure. */
export const DURATION_SPECIMEN_TICKS_PER_MEASURE = 192;
/** Measures engraved in the specimen: the five material windows above. */
export const DURATION_SPECIMEN_MEASURES = 5;
/** Total length of the specimen. */
export const DURATION_SPECIMEN_TOTAL_TICKS =
  DURATION_SPECIMEN_MEASURES * DURATION_SPECIMEN_TICKS_PER_MEASURE;

/**
 * Jánko layout for this specimen: 4/4, three measures per system — the same
 * macro density as the rest specimen, so a 32nd run is read at the same scale
 * as the 32nd rest.
 */
export const DURATION_SPECIMEN_JANKO_OPTIONS: Partial<JankoLayoutOptions> = {
  ...DEFAULT_JANKO_OPTIONS,
  ticksPerMeasure: DURATION_SPECIMEN_TICKS_PER_MEASURE,
  measuresPerSystem: 3,
  title: 'Duration Working-Set Specimen',
  subtitle: '32nds, 64ths, mixed levels, lone partial beams, solo flags',
  composer: 'Jánko Engraving Harness',
};

/** Micro-typography of the specimen: the 4/4 grid, golden tokens otherwise. */
export const DURATION_SPECIMEN_JANKO_TOKENS: Partial<JankoTokens> = {
  ...DEFAULT_JANKO_TOKENS,
  ticksPerMeasure: DURATION_SPECIMEN_TICKS_PER_MEASURE,
};

/** One voice row: `[startTick, pitchClass, octave, durationTicks]`. */
type SpecimenRow = readonly [number, number, number, number];

/** A run of `count` notes of `dur` ticks, alternating the two row parities. */
function alternatingRun(
  startTick: number,
  count: number,
  dur: number,
  evenPc: number,
  oddPc: number
): SpecimenRow[] {
  const out: SpecimenRow[] = [];
  for (let i = 0; i < count; i++) {
    // Even pitch classes sit on the lower whole-tone row, odd ones above: the
    // alternation is what keeps two 3-tick onsets off one another's masks.
    out.push([startTick + i * dur, i % 2 === 0 ? evenPc : oddPc, 4, dur]);
  }
  return out;
}

const RH_LINE: ReadonlyArray<SpecimenRow> = [
  // m. 1 — the 32nd run (one beat), then a quarter-note gesture.
  ...alternatingRun(0, 8, 6, 6, 7),
  [48, 8, 4, 48],
  [96, 9, 4, 48],
  [144, 10, 4, 48],
  // m. 2 — the 64th run (half a beat), then 8ths.
  ...alternatingRun(192, 8, 3, 6, 7),
  [216, 8, 4, 24],
  [240, 9, 4, 24],
  [264, 10, 4, 24],
  [288, 11, 4, 24],
  [312, 12, 4, 72],
  // m. 3 — mixed levels inside one beat: 8th, 16ths, 32nds, 8th.
  [384, 7, 4, 24],
  [408, 8, 4, 12],
  [420, 9, 4, 12],
  [432, 10, 4, 6],
  [438, 11, 4, 6],
  [444, 12, 4, 6],
  [450, 13, 4, 6],
  [456, 14, 4, 24],
  [480, 15, 4, 96],
  // m. 4 — lone partial beams: a 16th at the end of an 8th group (backward
  // stub) and one at the start of the next (forward stub).
  [576, 7, 4, 24],
  [600, 8, 4, 24],
  [624, 9, 4, 24],
  [648, 10, 4, 12],
  [672, 11, 4, 12],
  [684, 12, 4, 24],
  [708, 13, 4, 24],
  [732, 14, 4, 36],
  // m. 5 — solo short values: a 32nd alone in beat 1, a 64th alone in beat 2.
  [768, 7, 4, 6],
  [792, 8, 4, 3],
  [816, 9, 4, 24],
  [840, 10, 4, 24],
  [864, 11, 4, 96],
];

/** The left hand: one downbeat and one third-beat anchor per measure. */
const LH_LINE: ReadonlyArray<SpecimenRow> = [
  [0, 0, 3, 48],
  [96, 7, 2, 96],
  [192, 2, 3, 48],
  [288, 9, 2, 96],
  [384, 4, 3, 48],
  [480, 11, 2, 96],
  [576, 5, 3, 48],
  [672, 0, 2, 96],
  [768, 7, 3, 48],
  [864, 2, 2, 96],
];

/** One authored voice of the specimen, in engraving order. */
function specimenVoice(hand: 'RH' | 'LH', line: ReadonlyArray<SpecimenRow>): QuantizedNote[] {
  return line.map(([startTick, pitchClass, octave, durationTicks]) => ({
    id: `duration-specimen-${hand.toLowerCase()}-${startTick}`,
    pitch: { pitchClass, octave },
    startTick,
    durationTicks,
    hand,
    velocity: 84,
  }));
}

/** Build the curated working-set rhythm specimen score. */
export function buildDurationSpecimenScore(): QuantizedGridScore {
  const barlines: QuantizedGridScore['barlines'] = [];
  for (let m = 0; m <= DURATION_SPECIMEN_MEASURES; m++) {
    barlines.push({
      barNumber: m + 1,
      tick: m * DURATION_SPECIMEN_TICKS_PER_MEASURE,
      type: (m === DURATION_SPECIMEN_MEASURES ? 'final' : 'regular') as 'final' | 'regular',
    });
  }

  return {
    id: 'duration-specimen',
    title: 'Duration Working-Set Specimen',
    composer: 'Jánko Engraving Harness',
    ticksPerBeat: TICKS_PER_BEAT,
    // The shortest stated value is a 64th (3 ticks).
    gridResolution: 3,
    totalTicks: DURATION_SPECIMEN_TOTAL_TICKS,
    timeSignatures: [{ tick: 0, numerator: 4, denominator: 4 }],
    barlines,
    tempos: [],
    dynamics: [],
    pedals: [],
    notes: [...specimenVoice('RH', RH_LINE), ...specimenVoice('LH', LH_LINE)],
  };
}
