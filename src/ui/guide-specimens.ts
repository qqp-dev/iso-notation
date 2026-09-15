/**
 * Player's Guide specimens — minimal real scores through the real engine.
 *
 * Every notational example in the Guide tab is engraved from one of these
 * scores (or the Bach benchmark itself) with the golden-master options, via
 * `renderJankoCrop` / `renderJankoPage`. Nothing is hand-drawn: what the
 * player sees in the guide is byte-identical grammar to the Play view.
 *
 * The digit/syllable strings beside the examples are derived live from the
 * encoded scores plus `src/model/phonetics.ts` (see `handThread`); the
 * companion test file pins them against the models so a future engraving
 * change that invalidates the guide fails `npm test`.
 */

import {
  Hand,
  QuantizedGridScore,
  QuantizedNote,
} from '../model/types';
import { getDuodecimalSyllable } from '../model/phonetics';
import { getDuodecimalDigit } from '../render/types';
import {
  DEFAULT_JANKO_OPTIONS,
  DEFAULT_JANKO_TOKENS,
  JankoLayoutOptions,
  JankoTokens,
} from '../render/janko/types';

/** Quarter-note resolution shared with the rest of the repository. */
export const GUIDE_TICKS_PER_BEAT = 48;
/** One 3/4 measure under the golden defaults. */
export const GUIDE_TICKS_PER_MEASURE = 144;

type SpecimenRow = readonly [
  startTick: number,
  pitchClass: number,
  octave: number,
  durationTicks: number,
];

function specimenVoice(
  idPrefix: string,
  hand: Hand,
  line: ReadonlyArray<SpecimenRow>,
  velocity = 84
): QuantizedNote[] {
  return line.map(([startTick, pitchClass, octave, durationTicks]) => ({
    id: `${idPrefix}-${hand.toLowerCase()}-${startTick}-${pitchClass}`,
    pitch: { pitchClass, octave },
    startTick,
    durationTicks,
    hand,
    velocity,
  }));
}

function specimenScore(
  id: string,
  title: string,
  measures: number,
  voices: QuantizedNote[]
): QuantizedGridScore {
  const barlines: QuantizedGridScore['barlines'] = [];
  for (let m = 0; m <= measures; m++) {
    barlines.push({
      barNumber: m + 1,
      tick: m * GUIDE_TICKS_PER_MEASURE,
      type: m === measures ? 'final' : 'regular',
    });
  }
  return {
    id,
    title,
    composer: 'Guide Specimens',
    ticksPerBeat: GUIDE_TICKS_PER_BEAT,
    gridResolution: 1,
    totalTicks: measures * GUIDE_TICKS_PER_MEASURE,
    timeSignatures: [{ tick: 0, numerator: 3, denominator: 4 }],
    barlines,
    tempos: [],
    dynamics: [],
    pedals: [],
    notes: voices,
  };
}

/**
 * Pitch specimen — one measure: the right hand climbs the chromatic octave
 * C4–B4 in twelve 16ths (one semitone per onset, one height per semitone)
 * while the left hand marks C3 on each beat. Teaches continuous heights,
 * the three C-lines and the duodecimal digits.
 */
export function buildGuidePitchSpecimen(): QuantizedGridScore {
  const rh: SpecimenRow[] = [];
  for (let pc = 0; pc < 12; pc++) {
    rh.push([pc * 12, pc, 4, 12]);
  }
  const lh: SpecimenRow[] = [
    [0, 0, 3, 48],
    [48, 0, 3, 48],
    [96, 0, 3, 48],
  ];
  return specimenScore('guide-pitch', 'Guide Pitch Specimen', 1, [
    ...specimenVoice('guide-pitch', 'RH', rh),
    ...specimenVoice('guide-pitch', 'LH', lh),
  ]);
}

/**
 * Rhythm specimen — one measure: beat 1 beams four 16ths, beat 2 pairs a
 * flagged dotted 8th with its 16th, beat 3 states a bare-stem quarter. The
 * left hand keeps beat-quarters so the measure stays active without
 * contributing its own rhythm lesson.
 */
export function buildGuideRhythmSpecimen(): QuantizedGridScore {
  const rh: SpecimenRow[] = [
    [0, 0, 4, 12],
    [12, 2, 4, 12],
    [24, 4, 4, 12],
    [36, 5, 4, 12],
    [48, 7, 4, 36],
    [84, 9, 4, 12],
    [96, 11, 4, 48],
  ];
  const lh: SpecimenRow[] = [
    [0, 0, 3, 48],
    [48, 4, 3, 48],
    [96, 7, 3, 48],
  ];
  return specimenScore('guide-rhythm', 'Guide Rhythm Specimen', 1, [
    ...specimenVoice('guide-rhythm', 'RH', rh),
    ...specimenVoice('guide-rhythm', 'LH', lh),
  ]);
}

/**
 * Hands specimen — one measure, one lesson per beat: beat 1 puts the hands
 * at opposite ends of the staff (opposed stems), beat 2 gives the right
 * hand a three-note chord (the per-hand clasp bracket), beat 3 plays the
 * same G4 in both hands at once (the merged unison digit). The chord sits
 * off the tick-0 column so the opening-knockout extent cannot join the
 * lesson.
 */
export function buildGuideHandsSpecimen(): QuantizedGridScore {
  const rh: SpecimenRow[] = [
    [0, 7, 5, 48],
    [48, 0, 4, 48],
    [48, 4, 4, 48],
    [48, 7, 4, 48],
    [96, 7, 4, 48],
  ];
  const lh: SpecimenRow[] = [
    [0, 0, 3, 48],
    [96, 7, 4, 48],
  ];
  return specimenScore('guide-hands', 'Guide Hands Specimen', 1, [
    ...specimenVoice('guide-hands', 'RH', rh),
    ...specimenVoice('guide-hands', 'LH', lh),
  ]);
}

/**
 * Rest specimen — five 4/4 measures, one silence family per measure: a
 * quarter rest (m. 1, silent second beat), a half rest (m. 2, silent first
 * half), a whole-bar rest (m. 3, the hand releases on the downbeat and
 * resumes a measure later), an 8th rest (m. 4) and a 16th rest (m. 5). The
 * 4/4 meter is load-bearing: the whole-bar form states a 192-tick silence,
 * which a 3/4 measure cannot hold (`isWholeBarSilence`). Every gap opens
 * and closes inside one system, the way the per-system rest layer reads
 * them. The left hand plays unbroken beat-quarters throughout, so every
 * rest in the figure belongs to the right hand's demonstrated gaps.
 */
export const GUIDE_REST_TICKS_PER_MEASURE = 192;
export const GUIDE_REST_MEASURES = 5;

/**
 * Layout for the rest specimen: golden options with the 4/4 measure the
 * whole bar needs — the same override pattern as the shipped specimens.
 */
export const GUIDE_REST_JANKO_OPTIONS: Partial<JankoLayoutOptions> = {
  ...DEFAULT_JANKO_OPTIONS,
  ticksPerMeasure: GUIDE_REST_TICKS_PER_MEASURE,
  title: 'Guide Rest Specimen',
  subtitle: 'one silence per value, quarter … whole bar',
  composer: 'Guide Specimens',
};

/** Micro-typography of the rest specimen: the 4/4 grid, golden otherwise. */
export const GUIDE_REST_JANKO_TOKENS: Partial<JankoTokens> = {
  ...DEFAULT_JANKO_TOKENS,
  ticksPerMeasure: GUIDE_REST_TICKS_PER_MEASURE,
};

export function buildGuideRestSpecimen(): QuantizedGridScore {
  const M = GUIDE_REST_TICKS_PER_MEASURE;
  const rh: SpecimenRow[] = [
    // m. 1 — quarter, silent beat 2, quarter, quarter.
    [0, 7, 4, 48],
    [96, 9, 4, 48],
    [144, 7, 4, 48],
    // m. 2 — silent beats 1–2, quarter, quarter.
    [M + 96, 7, 4, 48],
    [M + 144, 9, 4, 48],
    // m. 3 — wholly silent (whole bar); m. 4 — resume, then an 8th rest.
    [3 * M + 0, 7, 4, 48],
    [3 * M + 48, 9, 4, 24],
    [3 * M + 96, 7, 4, 48],
    [3 * M + 144, 9, 4, 48],
    // m. 5 — 16th, 16th-rest, 16th, 16th, then quarters to the end.
    [4 * M + 0, 7, 4, 12],
    [4 * M + 24, 9, 4, 12],
    [4 * M + 36, 7, 4, 12],
    [4 * M + 48, 9, 4, 48],
    [4 * M + 96, 7, 4, 48],
    [4 * M + 144, 9, 4, 48],
  ];
  const lh: SpecimenRow[] = [];
  const lhPcs = [0, 4, 7, 0];
  const lhOcts = [3, 3, 3, 4];
  for (let m = 0; m < GUIDE_REST_MEASURES; m++) {
    for (let b = 0; b < 4; b++) {
      lh.push([m * M + b * 48, lhPcs[b], lhOcts[b], 48]);
    }
  }
  const barlines: QuantizedGridScore['barlines'] = [];
  for (let m = 0; m <= GUIDE_REST_MEASURES; m++) {
    barlines.push({
      barNumber: m + 1,
      tick: m * GUIDE_REST_TICKS_PER_MEASURE,
      type: m === GUIDE_REST_MEASURES ? 'final' : 'regular',
    });
  }
  return {
    id: 'guide-rests',
    title: 'Guide Rest Specimen',
    composer: 'Guide Specimens',
    ticksPerBeat: GUIDE_TICKS_PER_BEAT,
    gridResolution: 1,
    totalTicks: GUIDE_REST_MEASURES * GUIDE_REST_TICKS_PER_MEASURE,
    timeSignatures: [{ tick: 0, numerator: 4, denominator: 4 }],
    barlines,
    tempos: [],
    dynamics: [],
    pedals: [],
    notes: [
      ...specimenVoice('guide-rests', 'RH', rh),
      ...specimenVoice('guide-rests', 'LH', lh),
    ],
  };
}

/** One sounding of a hand's thread through a measure, display-ready. */
export interface GuideThreadNote {
  startTick: number;
  durationTicks: number;
  pitchClass: number;
  octave: number;
  digit: string;
  syllable: string;
}

/**
 * Live derivation: one hand's note thread through one measure (0-based),
 * in score order. Displayed digit/syllable strings in the guide come from
 * here — computed from the encoded score at render time, so they cannot rot.
 */
export function handThread(
  score: QuantizedGridScore,
  measureIndex: number,
  hand: Hand,
  ticksPerMeasure: number = GUIDE_TICKS_PER_MEASURE
): GuideThreadNote[] {
  const start = measureIndex * ticksPerMeasure;
  const end = start + ticksPerMeasure;
  return score.notes
    .filter(
      (n) => n.hand === hand && n.startTick >= start && n.startTick < end
    )
    .sort((a, b) => a.startTick - b.startTick)
    .map((n) => {
      const pitchClass = ((n.pitch.pitchClass % 12) + 12) % 12;
      return {
        startTick: n.startTick,
        durationTicks: n.durationTicks,
        pitchClass,
        octave: n.pitch.octave,
        digit: getDuodecimalDigit(pitchClass),
        syllable: getDuodecimalSyllable(pitchClass),
      };
    });
}

/** Display string for a thread's digits: `7 6 7 2 …`. */
export function threadDigitString(thread: readonly GuideThreadNote[]): string {
  return thread.map((n) => n.digit).join(' ');
}

/** Display string for a thread's syllables: `se si se tu …`. */
export function threadSyllableString(
  thread: readonly GuideThreadNote[]
): string {
  return thread.map((n) => n.syllable).join(' ');
}
