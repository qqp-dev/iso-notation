/**
 * Duration Vocabulary Specimen — the Phase-3 (Round 42) synthetic fixture.
 * ======================================================================
 *
 * One registered, real score that states every plain notated value on both
 * carriers the study compares, so the four candidate columns can be judged on
 * identical rows through the real engraving engine (no toy renderer):
 *
 * | band | measures | what it states |
 * | ---- | -------- | -------------- |
 * | **O — ordinary lone** | 1–8 | one lone right-hand note per plain value (3/6/12/24/48/96/192/384) — the ordinary stem/flag vocabulary (3 and 6 DO show their 4/3 flags). |
 * | **A — augmentation** | 9–14 | single-dotted (36/72/144/288) and double-dotted (42/84) lone notes — the shared augmentation dot. |
 * | **D — beamed ordinary** | 15–16 | real beam groups (four 16ths in one beat; four 8ths across two beats) — the actual current beamed symbol set, never replaced by flags. |
 * | **B — shared bracket** | 17–24 | a three-note right-hand chord per plain value, every member carrying that value — the shared-duration bracket vocabulary. |
 * | **C — exception** | 25–32 | a three-note right-hand chord per plain value whose carried (mode) value is a *different* duration, so the top member is a genuine **exception** in every row. |
 *
 * **Isolation.** Each row is one **384-tick measure** (8/4 at 48 ticks/quarter)
 * and its event starts on the measure's **downbeat** (tick 0 of the measure).
 * A 384-tick value therefore ends exactly on its own barline: `onset +
 * duration = 384 ≤ ticksPerMeasure` for every row, so no row sustains into the
 * next (the phase-2 `4/2` measure with an onset of 48 could not hold a 384 — the
 * trap this specimen corrects, without changing any note duration). Sparse
 * measures paint no rests (verified), so a row is only its own event.
 *
 * **Composites** (108/120/504) are *not* engraved as fake glyphs and are not
 * rounded into a neighbouring value; the study states them as a documented
 * limitation with their exact decompositions (see {@link DURATION_VOCABULARY_COMPOSITES}).
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
/** One fixture row — every row is (and must hold) a 384-tick measure. */
export const DURATION_VOCABULARY_TICKS_PER_MEASURE = 384;
/** Measures per system (rows per line). */
export const DURATION_VOCABULARY_MEASURES_PER_SYSTEM = 4;

/** The eight plain notated values, low rank → high rank. */
export const DURATION_VOCABULARY_PLAIN_VALUES: readonly number[] = [3, 6, 12, 24, 48, 96, 192, 384];

/** Single- and double-dotted lone values of the augmentation band. */
export const DURATION_VOCABULARY_AUGMENT_VALUES: readonly number[] = [36, 72, 144, 288, 42, 84];

/** The carried (mode) value of each exception row, keyed by the exception value. */
export const DURATION_VOCABULARY_EXCEPTION_CARRIED: ReadonlyMap<number, number> = new Map(
  DURATION_VOCABULARY_PLAIN_VALUES.map((v) => [v, v === 96 ? 48 : 96])
);

/**
 * Out-of-grammar composites the study refuses to fake: each is stated as a
 * caption with its exact written decomposition (never rounded into a plain or
 * dotted value, never drawn as an invented glyph).
 */
export const DURATION_VOCABULARY_COMPOSITES: ReadonlyArray<{ ticks: number; decomposition: string }> = [
  { ticks: 108, decomposition: '108 = 96 + 12 (half + 16th)' },
  { ticks: 120, decomposition: '120 = 96 + 24 (half + 8th)' },
  { ticks: 504, decomposition: '504 = 192 + 192 + 96 + 24 (whole + whole + half + 8th)' },
];

/** Band boundaries, in 1-based measure numbers (inclusive). */
export const DURATION_VOCABULARY_BANDS = {
  ordinary: { first: 1, last: 8 },
  augmentation: { first: 9, last: 14 },
  beamed: { first: 15, last: 16 },
  bracket: { first: 17, last: 24 },
  exception: { first: 25, last: 32 },
  stress: { first: 33, last: 34 },
} as const;

/** Total measures of the specimen. */
export const DURATION_VOCABULARY_MEASURES = 34;
/** Total length of the specimen. */
export const DURATION_VOCABULARY_TOTAL_TICKS =
  DURATION_VOCABULARY_MEASURES * DURATION_VOCABULARY_TICKS_PER_MEASURE;

/** One row: `[measure(1-based), pitchClass, octave, durationTicks, offsetTicks?]`. */
type Row = readonly [number, number, number, number, number?];

const measureTick = (measure: number): number =>
  (measure - 1) * DURATION_VOCABULARY_TICKS_PER_MEASURE;

/** Band O — one lone right-hand note per plain value. */
const ORDINARY_ROWS: readonly Row[] = DURATION_VOCABULARY_PLAIN_VALUES.map(
  (d, i) => [1 + i, 0, 5, d] as const
);

/** Band A — dotted and double-dotted lone notes. */
const AUGMENT_ROWS: readonly Row[] = DURATION_VOCABULARY_AUGMENT_VALUES.map(
  (d, i) => [9 + i, 0, 5, d] as const
);

/** Band D — real beam groups: four 16ths inside one beat, then four 8ths. */
const BEAMED_ROWS: readonly Row[] = [
  [15, 0, 5, 12, 0],
  [15, 4, 5, 12, 12],
  [15, 7, 5, 12, 24],
  [15, 0, 6, 12, 36],
  [16, 0, 5, 24, 0],
  [16, 4, 5, 24, 24],
  [16, 7, 5, 24, 48],
  [16, 0, 6, 24, 72],
];

/**
 * Band S — stress rows. Two rows state the situations the clean, single-value
 * rows never do, at the same physical scale as every other band:
 *
 * - **S1 (m. 33)** — an admitted bracket whose **top** exception (192 against a
 *   carried 96) sits at the highest pitch, so its own stem never crosses a
 *   member; a **full-size, unbracketed two-note dyad** attacks on the very
 *   **next onset** (a 16th later) and re-takes the exception's own pitch. The
 *   dyad is a **2-span same-column neighbour pair** (two whole-tone-neighbour
 *   pitches in one parity column) and the chord also carries a **staggered
 *   opposite-parity neighbour** (the even-parity member sits on the column
 *   while the odd-parity members stagger right). The fixed 9pt carrier has no
 *   room before that mask, so its shortfall is **published**, never clipped.
 * - **S2 (m. 34)** — **two exceptions of different values in one chord**
 *   (192 and 6 against a carried 96). The 192 exception is the chord's top
 *   member *and* sits exactly on a **staff rule** (the lin-60 octave line), so
 *   its carrier coincides with that rule; the 6 exception is placed in the
 *   **opposite parity column** (staggered), where its own stem clears the
 *   column. Single-note ownership is therefore exercised twice in one group.
 */
const STRESS_ROWS: readonly Row[] = [
  // S1 (m. 33): top exception 192 vs carried 96; next-onset full-size dyad that
  // re-takes the exception's pitch (a 2-span same-column neighbour pair).
  [33, 4, 5, 96, 0],
  [33, 7, 5, 96, 0],
  [33, 9, 5, 192, 0],
  [33, 9, 5, 24, 12],
  [33, 7, 5, 24, 12],
  // S2 (m. 34): two exceptions of different values in one chord — the 192
  // exception is the even column's top member and sits exactly on the lin-60
  // staff rule; the 6 exception is the odd column's top member (a 10-span
  // above), so neither own-stem crosses a column member.
  [34, 0, 5, 192, 0],
  [34, 4, 4, 96, 0],
  [34, 7, 4, 96, 0],
  [34, 11, 5, 6, 0],
];

/**
 * Band B — a three-note right-hand chord per plain value, every member stating
 * that value, so the bracket carries it with no exception.
 */
const BRACKET_ROWS: readonly Row[] = DURATION_VOCABULARY_PLAIN_VALUES.flatMap((d, i) => {
  const m = 17 + i;
  return [
    [m, 0, 5, d] as const,
    [m, 4, 5, d] as const,
    [m, 7, 5, d] as const,
  ];
});

/**
 * Band C — a three-note right-hand chord per plain value whose carried (mode)
 * value is a different duration, so the **top** member is a genuine exception
 * in every row (`own duration ≠ carried mode`).
 */
const EXCEPTION_ROWS: readonly Row[] = DURATION_VOCABULARY_PLAIN_VALUES.flatMap((d, i) => {
  const m = 25 + i;
  const carried = DURATION_VOCABULARY_EXCEPTION_CARRIED.get(d)!;
  return [
    [m, 0, 5, carried] as const,
    [m, 4, 5, carried] as const,
    [m, 7, 5, d] as const,
  ];
});

const ALL_ROWS: readonly Row[] = [
  ...ORDINARY_ROWS,
  ...AUGMENT_ROWS,
  ...BEAMED_ROWS,
  ...BRACKET_ROWS,
  ...EXCEPTION_ROWS,
  ...STRESS_ROWS,
];

/** One authored sound of the specimen. */
export interface DurationVocabularyNote {
  /** Source note id (band prefix, tick, pitch). */
  id: string;
  band: 'ordinary' | 'augmentation' | 'beamed' | 'bracket' | 'exception' | 'stress';
  measure: number;
  pitchClass: number;
  octave: number;
  startTick: number;
  durationTicks: number;
}

/** The band a measure belongs to. */
function bandOf(measure: number): DurationVocabularyNote['band'] {
  if (measure <= DURATION_VOCABULARY_BANDS.ordinary.last) return 'ordinary';
  if (measure <= DURATION_VOCABULARY_BANDS.augmentation.last) return 'augmentation';
  if (measure <= DURATION_VOCABULARY_BANDS.beamed.last) return 'beamed';
  if (measure <= DURATION_VOCABULARY_BANDS.bracket.last) return 'bracket';
  if (measure <= DURATION_VOCABULARY_BANDS.exception.last) return 'exception';
  return 'stress';
}

/** Every note of the specimen, spelled for the tests. */
export const DURATION_VOCABULARY_NOTES: readonly DurationVocabularyNote[] = ALL_ROWS.map(
  ([measure, pitchClass, octave, durationTicks, offsetTicks]) => {
    const startTick = measureTick(measure) + (offsetTicks ?? 0);
    const band = bandOf(measure);
    return {
      id: `dvs-${band}-${startTick}-${pitchClass}_${octave}`,
      band,
      measure,
      pitchClass,
      octave,
      startTick,
      durationTicks,
    };
  }
);

function specimenVoice(rows: readonly DurationVocabularyNote[]): QuantizedNote[] {
  return rows.map((r) => ({
    id: r.id,
    pitch: { pitchClass: r.pitchClass, octave: r.octave },
    startTick: r.startTick,
    durationTicks: r.durationTicks,
    hand: 'RH' as const,
    velocity: 84,
  }));
}

/**
 * Jánko layout options for this specimen: 8/4 rows, four rows per system, and
 * the shared **parity-column** pitch placement every study column engraves
 * under — so the four cards differ only in their duration vocabulary, never in
 * where a pitch sits. (Canonical `DEFAULT_JANKO_OPTIONS` is untouched.)
 */
export const DURATION_VOCABULARY_SPECIMEN_JANKO_OPTIONS: Partial<JankoLayoutOptions> = {
  ...DEFAULT_JANKO_OPTIONS,
  ticksPerMeasure: DURATION_VOCABULARY_TICKS_PER_MEASURE,
  measuresPerSystem: DURATION_VOCABULARY_MEASURES_PER_SYSTEM,
  pitchPlacement: 'parity-columns',
  title: 'Duration Vocabulary Specimen',
  subtitle: 'plain values on the ordinary, bracket and exception carriers',
  composer: 'Jánko Engraving Harness',
};

/** Micro-typography of the specimen: the 384-tick row grid, golden tokens. */
export const DURATION_VOCABULARY_SPECIMEN_JANKO_TOKENS: Partial<JankoTokens> = {
  ...DEFAULT_JANKO_TOKENS,
  ticksPerMeasure: DURATION_VOCABULARY_TICKS_PER_MEASURE,
};

/** Build the registered Phase-3 duration-vocabulary specimen score. */
export function buildDurationVocabularySpecimenScore(): QuantizedGridScore {
  const barlines: QuantizedGridScore['barlines'] = [];
  for (let m = 0; m <= DURATION_VOCABULARY_MEASURES; m++) {
    barlines.push({
      barNumber: m + 1,
      tick: m * DURATION_VOCABULARY_TICKS_PER_MEASURE,
      type: (m === DURATION_VOCABULARY_MEASURES ? 'final' : 'regular') as 'final' | 'regular',
    });
  }
  return {
    id: 'duration-vocabulary-specimen',
    title: 'Duration Vocabulary Specimen',
    composer: 'Jánko Engraving Harness',
    ticksPerBeat: TICKS_PER_BEAT,
    gridResolution: 24,
    totalTicks: DURATION_VOCABULARY_TOTAL_TICKS,
    timeSignatures: [{ tick: 0, numerator: 8, denominator: 4 }],
    barlines,
    tempos: [],
    dynamics: [],
    pedals: [],
    notes: specimenVoice(DURATION_VOCABULARY_NOTES),
  };
}
