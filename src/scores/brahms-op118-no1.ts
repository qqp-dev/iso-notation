import { QuantizedGridScore, QuantizedNote } from '../model/types';
import { detectHandCrossings } from '../model/grid';
import {
  DEFAULT_JANKO_OPTIONS,
  DEFAULT_JANKO_TOKENS,
  JankoLayoutOptions,
  JankoTokens,
} from '../render/janko/types';

/**
 * Johannes Brahms: Intermezzo in A minor, Op. 118 No. 1
 * *Allegro non assai, ma molto appassionato* — mm. 1–9
 *
 * Why this score exists
 * ---------------------
 * The Goldberg Variation is single-line counterpoint: at any instant it writes
 * at most two voices, so a two-row whole-tone staff almost never has to place
 * two heads on one row of one octave. Brahms's Op. 118 No. 1 is the opposite
 * stress case, and it is the score the operator asked to continue testing
 * with:
 *
 * - **Sweeping four-octave arpeggios.** The left hand's eighth-note broken
 *   chords travel from the very bottom of the keyboard to above the melody
 *   (m. 1 A1 → m. 2 A5 is exactly four octaves), so the staff is exercised
 *   across octaves 1–5 and through the dynamic ledger equators.
 * - **Massive five-voice chords.** mm. 7–8 hold
 *   ⟨A3, B3, D4, F4, A4⟩ and ⟨F3, G3, B3, F4, G4⟩. Their rows collide
 *   head-on — `A3`/`B3` and `F4`/`A4` share row 1 of their octave in m. 7, and
 *   m. 8 stacks *three* heads (`F3`, `G3`, `B3`) on row 1 of octave 3 — which
 *   is precisely the Row-Collision Dilemma that Approach 2 (Row-Snapped Parity
 *   Offset) exists to solve.
 *
 * Transcription basis (mm. 1–9)
 * -----------------------------
 * The engraving is a faithful keyboard reduction of the published text:
 *
 * - Meter and tempo: **cut time (2/2)**, *Allegro non assai, ma molto
 *   appassionato*.
 * - mm. 1–4: the descending four-note melody (Kopfton **c**, then b♭, a, and a
 *   final note taken by the left hand), stated twice with the second statement
 *   a third lower; the left hand sweeps A1 → A5 underneath and above it. The
 *   opening harmony is the tonic **six-three chord** (C–E–A) whose seventh
 *   scale degree is withheld — the B♭ is the Phrygian second over A, exactly
 *   the reading Schenker's analyses argue about.
 * - m. 5: the melody's third statement, ♭–e–d♯ (F–E–D♯) over an F bass — the
 *   diminished third that finally fixes A minor.
 * - m. 6: the E♭ over an F♯ bass (vii°7 of V) turning the music towards C
 *   major; the middle voice begins its f–f♯–a–a♭ uncoiling.
 * - mm. 7–8: the two five-voice chords above, ♯iiø4/2 → V4/2 of C major.
 * - m. 9: the resolution onto C major with the Kopfton restored.
 *
 * The left-hand arpeggios keep the published harmonic rhythm and the four
 * octaves of the model's sweep; inner voices are given to the arpeggio rather
 * than duplicated inside the held chords, so the two hands never write the
 * same pitch twice at the same instant.
 *
 * Orientation
 * -----------
 * A 2/2 measure is **192 ticks** (four quarters at the repository's canonical
 * 48 ticks per quarter), so the score must be engraved with
 * {@link BRAHMS_OP118_NO1_JANKO_OPTIONS} / {@link BRAHMS_OP118_NO1_JANKO_TOKENS},
 * which set the Jánko `ticksPerMeasure` token to 192.
 */

/** Quarter-note resolution shared with the rest of the repository. */
const TICKS_PER_BEAT = 48;
/** Cut time: two half-note beats = four quarters. */
export const BRAHMS_OP118_NO1_TICKS_PER_MEASURE = 192;
/** Eighth note, the resolution of every arpeggio in the piece. */
const EIGHTH = TICKS_PER_BEAT / 2;
const QUARTER = TICKS_PER_BEAT;
const HALF = TICKS_PER_BEAT * 2;
/** Measures engraved (mm. 1–9). */
export const BRAHMS_OP118_NO1_MEASURES = 9;

/**
 * Jánko layout options for this score: the canonical golden master except for
 * the cut-time measure length. The default `ticksPerMeasure` (144) belongs to
 * the Goldberg Variation's 3/4 and would break every barline here.
 */
export const BRAHMS_OP118_NO1_JANKO_OPTIONS: Partial<JankoLayoutOptions> = {
  ...DEFAULT_JANKO_OPTIONS,
  ticksPerMeasure: BRAHMS_OP118_NO1_TICKS_PER_MEASURE,
  measuresPerSystem: 3,
  title: 'J. Brahms: 6 Klavierstücke, Op. 118',
  subtitle: 'No. 1. Intermezzo in A minor — Allegro non assai, ma molto appassionato',
  composer: 'Johannes Brahms',
};

/** Jánko micro-typography for this score (cut-time measure length only). */
export const BRAHMS_OP118_NO1_JANKO_TOKENS: Partial<JankoTokens> = {
  ...DEFAULT_JANKO_TOKENS,
  ticksPerMeasure: BRAHMS_OP118_NO1_TICKS_PER_MEASURE,
};

let noteIdCounter = 0;

function createNote(
  pitchClass: number,
  octave: number,
  startTick: number,
  durationTicks: number,
  hand: 'RH' | 'LH',
  velocity: number = 92
): QuantizedNote {
  return {
    id: `brahms-118-1-${++noteIdCounter}`,
    pitch: { pitchClass, octave },
    startTick,
    durationTicks,
    hand,
    velocity,
  };
}

/** Absolute tick of `offset` eighths into measure `measure` (1-based). */
function at(measure: number, eighth: number): number {
  return (measure - 1) * BRAHMS_OP118_NO1_TICKS_PER_MEASURE + eighth * EIGHTH;
}

/** The left hand's eighth-note broken chord of one measure. */
function arpeggio(measure: number, pitches: ReadonlyArray<readonly [number, number]>): QuantizedNote[] {
  return pitches.map(([pc, octave], i) => createNote(pc, octave, at(measure, i), EIGHTH, 'LH'));
}

/** A right-hand chord: every voice enters at `eighth` and is held alike. */
function chord(
  measure: number,
  eighth: number,
  duration: number,
  voices: ReadonlyArray<readonly [number, number]>
): QuantizedNote[] {
  return voices.map(([pc, octave]) => createNote(pc, octave, at(measure, eighth), duration, 'RH'));
}

export function buildBrahmsOp118No1Score(): QuantizedGridScore {
  noteIdCounter = 0;

  const notes: QuantizedNote[] = [
    // -----------------------------------------------------------------------
    // m. 1 — i6 (C–E–A), Kopfton c doubled in octaves; the B♭ Phrygian second
    // over the A answers it. The left hand climbs three octaves out of the bass.
    //
    // The tick-0 voices are C5 / C4+E4: the Position of Honor halo (R = 6.2pt)
    // of an opening sound is pierced by any stem that passes within 6.6pt of
    // it, and one whole-tone row is only 15pt away, so the opening sonority
    // keeps its voices at least two rows (30pt) apart. The A that completes the
    // six-three chord is in the left hand's bass, exactly as the published
    // voicing spreads it.
    // -----------------------------------------------------------------------
    ...chord(1, 0, HALF, [
      [0, 5],
      [4, 4],
      [0, 4],
    ]),
    ...chord(1, 4, HALF, [
      [11, 4],
      [5, 4],
      [2, 4],
      [11, 3],
    ]),
    ...arpeggio(1, [
      [9, 1],
      [4, 2],
      [9, 2],
      [0, 3],
      [4, 3],
      [9, 3],
      [0, 4],
      [9, 4],
    ]),

    // -----------------------------------------------------------------------
    // m. 2 — the melody reaches a (third note) and the left hand takes the
    // fourth note E: its sweep tops out on A5 — four octaves above the A1 of
    // m. 1 — and plunges back to the goal.
    // -----------------------------------------------------------------------
    ...chord(2, 0, HALF, [
      [9, 4],
      [4, 4],
      [0, 4],
      [9, 3],
    ]),
    ...chord(2, 4, HALF, [
      [4, 3],
      [8, 3],
      [11, 3],
    ]),
    ...arpeggio(2, [
      [0, 5],
      [4, 5],
      [9, 5],
      [4, 5],
      [0, 5],
      [9, 4],
      [4, 4],
      [4, 3],
    ]),

    // -----------------------------------------------------------------------
    // m. 3 — second statement of the melody, a third lower (a → g) over
    // F major → C major.
    // -----------------------------------------------------------------------
    ...chord(3, 0, HALF, [
      [9, 4],
      [5, 4],
      [0, 4],
      [9, 3],
    ]),
    ...chord(3, 4, HALF, [
      [7, 4],
      [4, 4],
      [0, 4],
      [7, 3],
    ]),
    ...arpeggio(3, [
      [5, 2],
      [9, 2],
      [0, 3],
      [5, 3],
      [0, 3],
      [4, 3],
      [7, 3],
      [0, 4],
    ]),

    // -----------------------------------------------------------------------
    // m. 4 — the statement closes on f (over D minor) and the left hand takes
    // the goal note C, the third scale degree in the obligatory register.
    // -----------------------------------------------------------------------
    ...chord(4, 0, HALF, [
      [5, 4],
      [2, 4],
      [9, 3],
      [5, 3],
    ]),
    ...chord(4, 4, HALF, [
      [4, 4],
      [0, 4],
      [9, 3],
    ]),
    ...arpeggio(4, [
      [2, 2],
      [5, 2],
      [9, 2],
      [2, 3],
      [9, 2],
      [0, 3],
      [4, 3],
      [0, 4],
    ]),

    // -----------------------------------------------------------------------
    // m. 5 — the third statement of the third-motive, f–e–d♯ over the F bass:
    // the diminished third that fixes A minor (F major → C major → B major).
    // -----------------------------------------------------------------------
    ...chord(5, 0, HALF, [
      [5, 4],
      [0, 4],
      [9, 3],
      [5, 3],
    ]),
    ...chord(5, 4, QUARTER, [
      [4, 4],
      [0, 4],
      [7, 3],
    ]),
    ...chord(5, 6, QUARTER, [
      [3, 4],
      [11, 3],
      [6, 3],
      [3, 3],
    ]),
    ...arpeggio(5, [
      [5, 2],
      [9, 2],
      [0, 3],
      [5, 3],
      [4, 3],
      [7, 3],
      [0, 4],
      [4, 4],
    ]),

    // -----------------------------------------------------------------------
    // m. 6 — the E♭ over an F♯ bass (vii°7 of V) turns the music towards C
    // major; the middle voice starts uncoiling f–f♯–a–a♭.
    // -----------------------------------------------------------------------
    ...chord(6, 0, HALF, [
      [3, 4],
      [0, 4],
      [9, 3],
      [6, 3],
    ]),
    ...chord(6, 4, HALF, [
      [2, 4],
      [9, 3],
      [6, 3],
    ]),
    ...arpeggio(6, [
      [6, 2],
      [9, 2],
      [0, 3],
      [6, 3],
      [2, 2],
      [6, 2],
      [9, 2],
      [2, 3],
    ]),

    // -----------------------------------------------------------------------
    // m. 7 — the first five-voice chord, ⟨A3, B3, D4, F4, A4⟩: ♯iiø4/2 of C.
    // A3/B3 share row 1 of octave 3 and F4/A4 share row 1 of octave 4 — the
    // two row-snapped pairs of the Row-Collision Dilemma.
    // -----------------------------------------------------------------------
    ...chord(7, 0, HALF, [
      [9, 3],
      [11, 3],
      [2, 4],
      [5, 4],
      [9, 4],
    ]),
    ...chord(7, 4, HALF, [
      [9, 3],
      [11, 3],
      [2, 4],
      [5, 4],
      [9, 4],
    ]),
    ...arpeggio(7, [
      [9, 1],
      [11, 1],
      [2, 2],
      [5, 2],
      [9, 2],
      [5, 2],
      [2, 2],
      [11, 1],
    ]),

    // -----------------------------------------------------------------------
    // m. 8 — the second five-voice chord, ⟨F3, G3, B3, F4, G4⟩: V4/2 of C.
    // Three heads (F3, G3, B3) land on row 1 of octave 3 — the three-note
    // cluster the offset has to spread.
    // -----------------------------------------------------------------------
    ...chord(8, 0, HALF, [
      [5, 3],
      [7, 3],
      [11, 3],
      [5, 4],
      [7, 4],
    ]),
    ...chord(8, 4, HALF, [
      [5, 3],
      [7, 3],
      [11, 3],
      [5, 4],
      [7, 4],
    ]),
    ...arpeggio(8, [
      [5, 1],
      [11, 1],
      [2, 2],
      [7, 2],
      [5, 2],
      [2, 2],
      [11, 1],
      [7, 1],
    ]),

    // -----------------------------------------------------------------------
    // m. 9 — the resolution: C major with the Kopfton restored on top.
    // -----------------------------------------------------------------------
    ...chord(9, 0, HALF, [
      [0, 5],
      [7, 4],
      [4, 4],
      [0, 4],
    ]),
    ...chord(9, 4, HALF, [
      [7, 4],
      [4, 4],
      [0, 4],
      [7, 3],
    ]),
    ...arpeggio(9, [
      [0, 2],
      [7, 2],
      [0, 3],
      [4, 3],
      [7, 2],
      [0, 3],
      [4, 3],
      [7, 3],
    ]),
  ];

  const totalTicks = BRAHMS_OP118_NO1_MEASURES * BRAHMS_OP118_NO1_TICKS_PER_MEASURE;
  const barlines = [];
  for (let m = 1; m <= BRAHMS_OP118_NO1_MEASURES + 1; m++) {
    barlines.push({
      barNumber: m,
      tick: (m - 1) * BRAHMS_OP118_NO1_TICKS_PER_MEASURE,
      type: (m === BRAHMS_OP118_NO1_MEASURES + 1 ? 'final' : 'regular') as 'final' | 'regular',
    });
  }

  const score: QuantizedGridScore = {
    id: 'brahms-op118-no1',
    title: 'Intermezzo in A minor, Op. 118 No. 1',
    composer: 'Johannes Brahms',
    opus: 'Op. 118',
    ticksPerBeat: TICKS_PER_BEAT,
    gridResolution: EIGHTH,
    totalTicks,
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
