/**
 * Hold Endpoint Specimen — the Round 41 synthetic fixture.
 * =======================================================
 *
 * The authentic corpus states most of the exceptional-duration situations the
 * round judges (Brahms Op. 118 No. 1 mm. 8, 9–10 and 22 carry an early
 * exception beside a full-size symbol, two late exceptions released on a
 * barline, a release between beat pulses over a coincident staff rule). Three
 * situations are *not* in the corpus, and this registered real score states
 * them on clean material so the three endpoint candidates can be compared on
 * them without a toy renderer:
 *
 * | measure | what it states |
 * | ------- | -------------- |
 * | m. 1 | one chord with **three distinct member durations** (48 / 96 / 120): the carried duration is the hand's mode (48), so two members are exceptions of *different* values — generic per-member ownership, not "the longest note". Its longer exception sits on **C5 = pitch 60, an octave-line row**, so the connector is coincident with a painted staff rule and must isolate that rule locally with the white underlay. |
 * | m. 1 | a **release with no attack at that tick** (B5 releases at tick 168 — nothing attacks there, so the terminal is anchored by the laid-out linear time map, not by another note's column) and a **same-pitch reattack** (the C5 exception releases at 144 exactly where C5 is struck again). |
 * | m. 2 | a **genuine system-boundary continuation**: C6 opens on m. 2's last beat and releases at tick 408, past this system's last tick (384) — the connector runs to the line edge and carries **no terminal**, because a line break is not a release. |
 * | m. 3 | a mid-system exception (120 against a carried 48) released cleanly between onsets. |
 * | m. 4 | a release on the **final barline** (tick 768), seated clear of the barline's own ink. |
 *
 * The left hand is a single-note bass line on half notes: one note per onset, so
 * it never forms a same-hand co-onset group, never states an exception of its
 * own, and cannot share an exception's column with a foreign symbol. The
 * specimen is engraved two measures per system so the m. 2 → m. 3 line break is
 * a real one.
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
/** One 4/4 measure — every situation here is stated in common time. */
export const HOLD_ENDPOINT_SPECIMEN_TICKS_PER_MEASURE = 192;
/** Measures engraved in the specimen (two systems of two). */
export const HOLD_ENDPOINT_SPECIMEN_MEASURES = 4;
/** Total length of the specimen. */
export const HOLD_ENDPOINT_SPECIMEN_TOTAL_TICKS =
  HOLD_ENDPOINT_SPECIMEN_MEASURES * HOLD_ENDPOINT_SPECIMEN_TICKS_PER_MEASURE;
/** Measures per system: two, so m. 2 ends a line and m. 3 opens the next. */
export const HOLD_ENDPOINT_SPECIMEN_MEASURES_PER_SYSTEM = 2;

/**
 * The release ticks the specimen exists to demonstrate, with the reason each is
 * here. Tests read this table instead of restating literals.
 */
export const HOLD_ENDPOINT_SPECIMEN_CASES: ReadonlyArray<{
  label: string;
  noteId: string;
  startTick: number;
  releaseTick: number;
  reason: string;
}> = [
  {
    label: 'rule-row exception',
    noteId: 'hold-endpoint-specimen-rh-48-0_5',
    startTick: 48,
    releaseTick: 144,
    reason: 'C5 (pitch 60, octave line) is an exception inside a three-duration chord',
  },
  {
    label: 'second exception of the same chord',
    noteId: 'hold-endpoint-specimen-rh-48-11_5',
    startTick: 48,
    releaseTick: 168,
    reason: 'B5 carries a different exception value (120) than C5 (96) in the same group',
  },
  {
    label: 'system-boundary continuation',
    noteId: 'hold-endpoint-specimen-rh-288-0_6',
    startTick: 288,
    releaseTick: 408,
    reason: 'the release lies past this system\u2019s last tick (384): line edge, no terminal',
  },
  {
    label: 'mid-system release between onsets',
    noteId: 'hold-endpoint-specimen-rh-432-7_5',
    startTick: 432,
    releaseTick: 552,
    reason: 'a clean mid-measure release with no foreign ink at the anchor',
  },
  {
    label: 'final-barline release',
    noteId: 'hold-endpoint-specimen-rh-672-7_5',
    startTick: 672,
    releaseTick: 768,
    reason: 'the release is the score\u2019s final barline: the terminal seats clear of it',
  },
];

/** One voice row: `[startTick, pitchClass, octave, durationTicks]`. */
type SpecimenRow = readonly [number, number, number, number];

/**
 * Right hand: one chord per beat group. `c5`/`e5`/`g5`/`b5` at tick 0 is the
 * three-duration chord (48 / 96 / 120) whose exceptions are C5 and B5.
 */
const RH_LINE: ReadonlyArray<SpecimenRow> = [
  // m. 1 — a lone opening note (the Position of Honor), the three-duration
  // chord whose longer exception sits on the C5 octave line, then the chord
  // that reattacks C5 exactly where that exception releases.
  [0, 7, 4, 48], // G4 · lone opening sound
  [48, 0, 5, 96], // C5 · octave-line row, exception 96 against the carried 48
  [48, 4, 5, 48], // E5 · carried value
  [48, 7, 5, 48], // G5 · carried value
  [48, 11, 5, 120], // B5 · second exception of the same chord, a different value
  [144, 0, 5, 48], // C5 reattacks exactly where the exception above releases
  [144, 4, 5, 48], // E5
  [144, 7, 5, 48], // G5
  // m. 2 — then the line-crossing continuation.
  [240, 7, 5, 48], // G5
  [240, 11, 5, 48], // B5
  [240, 2, 6, 48], // D6
  [288, 4, 5, 48], // E5
  [288, 7, 5, 48], // G5
  [288, 0, 6, 120], // C6 · exception 120 against 48; releases at 408, past the line
  // m. 3 — clean mid-system release.
  [384, 5, 4, 48], // F4
  [384, 9, 4, 48], // A4
  [384, 2, 5, 48], // D5
  [432, 0, 5, 48], // C5
  [432, 4, 5, 48], // E5
  [432, 7, 5, 120], // G5 · exception released at 552, between onsets
  // m. 4 — release on the final barline.
  [576, 5, 4, 48], // F4
  [576, 9, 4, 48], // A4
  [576, 2, 5, 48], // D5
  [672, 0, 5, 48], // C5
  [672, 4, 5, 48], // E5
  [672, 7, 5, 96], // G5 · exception released on the final barline (tick 768)
];

/**
 * Left hand: single half notes on each beat pair — one note per onset, so the
 * bass never forms a co-onset group and never states an exception of its own.
 * The line is contiguous, so it adds no rests to the specimen.
 */
const LH_LINE: ReadonlyArray<SpecimenRow> = [
  [0, 0, 3, 96], // C3
  [96, 7, 2, 96], // G2
  [192, 0, 3, 96], // C3
  [288, 7, 2, 96], // G2
  [384, 5, 2, 96], // F2
  [480, 0, 3, 96], // C3
  [576, 5, 2, 96], // F2
  [672, 7, 2, 96], // G2
];

/** Jánko layout options for this specimen: 4/4, two measures per system. */
export const HOLD_ENDPOINT_SPECIMEN_JANKO_OPTIONS: Partial<JankoLayoutOptions> = {
  ...DEFAULT_JANKO_OPTIONS,
  ticksPerMeasure: HOLD_ENDPOINT_SPECIMEN_TICKS_PER_MEASURE,
  measuresPerSystem: HOLD_ENDPOINT_SPECIMEN_MEASURES_PER_SYSTEM,
  title: 'Hold Endpoint Specimen',
  subtitle: 'rule-row and off-beat releases, line-crossing continuation',
  composer: 'Jánko Engraving Harness',
};

/** Micro-typography of the specimen: the 4/4 grid, golden tokens otherwise. */
export const HOLD_ENDPOINT_SPECIMEN_JANKO_TOKENS: Partial<JankoTokens> = {
  ...DEFAULT_JANKO_TOKENS,
  ticksPerMeasure: HOLD_ENDPOINT_SPECIMEN_TICKS_PER_MEASURE,
};

/** One exception member of the specimen, spelled for the tests. */
export interface HoldEndpointSpecimenNote {
  id: string;
  pitchClass: number;
  octave: number;
  startTick: number;
  durationTicks: number;
}

/** One authored voice of the specimen. */
function specimenVoice(hand: 'RH' | 'LH', line: ReadonlyArray<SpecimenRow>): QuantizedNote[] {
  return line.map(([startTick, pitchClass, octave, durationTicks]) => ({
    id: `hold-endpoint-specimen-${hand.toLowerCase()}-${startTick}-${pitchClass}_${octave}`,
    pitch: { pitchClass, octave },
    startTick,
    durationTicks,
    hand,
    velocity: 84,
  }));
}

/** Build the registered Round 41 hold-endpoint specimen score. */
export function buildHoldEndpointSpecimenScore(): QuantizedGridScore {
  const barlines: QuantizedGridScore['barlines'] = [];
  for (let m = 0; m <= HOLD_ENDPOINT_SPECIMEN_MEASURES; m++) {
    barlines.push({
      barNumber: m + 1,
      tick: m * HOLD_ENDPOINT_SPECIMEN_TICKS_PER_MEASURE,
      type: (m === HOLD_ENDPOINT_SPECIMEN_MEASURES ? 'final' : 'regular') as
        | 'final'
        | 'regular',
    });
  }

  return {
    id: 'hold-endpoint-specimen',
    title: 'Hold Endpoint Specimen',
    composer: 'Jánko Engraving Harness',
    ticksPerBeat: TICKS_PER_BEAT,
    gridResolution: 24,
    totalTicks: HOLD_ENDPOINT_SPECIMEN_TOTAL_TICKS,
    timeSignatures: [{ tick: 0, numerator: 4, denominator: 4 }],
    barlines,
    tempos: [],
    dynamics: [],
    pedals: [],
    notes: [...specimenVoice('RH', RH_LINE), ...specimenVoice('LH', LH_LINE)],
  };
}
