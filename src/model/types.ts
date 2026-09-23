/**
 * 12-TET Pitch Coordinate System
 *
 * Zero-based pitch coordinates: (pitchClass: 0..11, octave: 0..N)
 * where Octave 0 is the lowest octave on an 88-key piano (A0, Bb0, B0),
 * with linear index octave * 12 + pitchClass.
 */
export interface PitchCoordinate {
  /** Pitch class in 12-TET: 0 = C, 1 = C#/Db, 2 = D, ..., 11 = B */
  pitchClass: number; // 0..11
  /** Octave index: 0 = lowest octave (A0..B0), 1 = C1..B1, ..., 8 = C8 */
  octave: number;
}

export type Hand = 'RH' | 'LH';

export type ArticulationType = 'staccato' | 'tenuto' | 'accent' | 'fermata' | 'marcato';

export type DynamicMark = 'ppp' | 'pp' | 'p' | 'mp' | 'mf' | 'f' | 'ff' | 'fff' | 'sf' | 'sfz';

/**
 * Round 48 — **source-voice provenance of one sounding event** (import layer).
 *
 * The hand a *note is displayed in* is the performance/notation reading (the
 * committed hand corrections, the staff destination); the hand the **source
 * parts assign it** is a different fact, and the two disagree wherever repeats
 * unfold to a different performed staff than the printed one. The engine may
 * not invent a hand-rest from a staff or track label alone, so the import layer
 * carries the source fact explicitly: which source voices state the event, on
 * which source staves, and which hand the source's own part grouping assigns
 * (see `brahms-source-fidelity.BRAHMS_VOICE_HAND`, cited there). Display
 * metadata only: nothing here sounds, and no displayed hand is rewritten.
 */
export interface NoteSourceProvenance {
  /** Source voices that state this sounding event, sorted. */
  voices: string[];
  /** Source staves those voices print on, sorted. */
  staves: string[];
  /**
   * Hand(s) the source parts assign this event, sorted — `leftHand*` → LH,
   * `rightHand*` → RH. A cross-voice unison can be stated by voices of both
   * hands (the m. 61 E2 is written in `leftHandLower` *and* `rightHandUpper`),
   * and then **both** hands really sound: the list keeps that fact instead of
   * collapsing it to one hand.
   */
  hands: Hand[];
  /** True when more than one source voice states the same event. */
  unison: boolean;
}

export interface QuantizedNote {
  id: string;
  pitch: PitchCoordinate;
  startTick: number;
  durationTicks: number;
  hand: Hand;
  voice?: number;
  velocity?: number; // 0..127
  dynamicMark?: DynamicMark;
  articulation?: ArticulationType;
  tieStart?: boolean;
  tieEnd?: boolean;
  /** Round 48: committed source-voice provenance (absent when the score has none). */
  sourceProvenance?: NoteSourceProvenance;
  /**
   * Round 49 §4 — **explicit editorial hand authority** on this event, when an
   * authorized correction record assigns its hand (absent on every uncorrected
   * event). This is the *auditable resolution*: which record authorized it and
   * whether the record flipped the hand or only confirmed it under guard. The
   * engine reads it for authoritative occupancy, rest inference and conflict
   * decisions; the raw `sourceProvenance` beside it is never mutated — the
   * source's own voice/staff/hand facts stay exactly as imported.
   */
  editorialHand?: EditorialHandResolution;
}

/**
 * Round 49 §4 — the audit record of one editorial hand assignment.
 *
 * `kind: 'flip'` — the authority *changed* the displayed hand (the source
 * label is overruled for every downstream decision). `kind: 'confirm'` — the
 * authority *confirmed* the already-displayed hand under the same musical-key
 * guard, so a future source change fails closed instead of silently keeping
 * the hand; confirmed events resolve their authoritative hand the same way
 * flipped ones do. `authorityId` names the correction record for audit.
 */
export interface EditorialHandResolution {
  /** The authoritative hand for occupancy, rest inference and conflict decisions. */
  hand: Hand;
  /** How the authority acts: a hand change, or a guarded confirmation. */
  kind: 'flip' | 'confirm';
  /** The authorized correction record id. */
  authorityId: string;
}

/**
 * Round 48 — **one authored source silence**: a written rest (`r`/`R`) or an
 * invisible spacer (`\skip`/`s`), read from the pinned source by the exporter.
 *
 * The two are different facts and are preserved as different facts: a written
 * rest states that the *voice* is silent, a spacer states only that the voice
 * occupies time. Neither is whole-hand silence — the engine's rest layer checks
 * the hand that actually sounds before painting anything.
 */
export interface VoiceSilence {
  /** Source voice the silence is written in. */
  voice: string;
  /** Hand the source parts assign that voice. */
  hand: Hand;
  /** Absolute tick the silence opens on. */
  startTick: number;
  /** Length of the silence (ticks). */
  durationTicks: number;
  /** `'rest'` = a written rest; `'skip'` = a spacer (`\skip` / `s`). */
  kind: 'rest' | 'skip';
  /** Source staff the voice prints on. */
  staff: string;
  /** Source file (relative to the vendored source root). */
  file: string;
  /** Source line and column of the written silence. */
  line: number;
  col: number;
  /** Source bar number as the compiler reported it. */
  bar: number;
  /** Occurrence of that exact origin in the unfolded performance (1-based). */
  occurrence: number;
}

export interface TimeSignatureOverlay {
  tick: number;
  numerator: number;
  denominator: number;
}

export type BarlineType = 'regular' | 'double' | 'repeat-start' | 'repeat-end' | 'final';

export interface BarlineOverlay {
  barNumber: number;
  tick: number;
  type: BarlineType;
}

export interface TempoOverlay {
  tick: number;
  bpm: number;
  description?: string;
}

export interface ExpressionProvenance {
  file: string;
  line: number;
  col: number;
  bar: number;
  context: string;
  occurrence: number;
  /** Exact whole-note rational from the LilyPond listener. */
  time: string;
  order: number;
}

export interface DynamicOverlay {
  tick: number;
  mark: DynamicMark | 'crescendo' | 'decrescendo';
  durationTicks?: number; // for hairpins
  /** Source-only: independent of a note onset. */
  kind?: 'mark' | 'hairpin' | 'text-cresc';
  origin?: ExpressionProvenance;
}

export type PedalType = 'sustain-down' | 'sustain-up' | 'sustain-change' | 'una-corda';

export interface PedalOverlay {
  tick: number;
  type: PedalType;
  origin?: ExpressionProvenance;
  order?: number;
  /** Compiler off/on origins of a genuine layout change, in that order. */
  changeOrigins?: [ExpressionProvenance, ExpressionProvenance];
}

export interface HandCrossingEvent {
  tick: number;
  durationTicks: number;
  higherHand: Hand;
  description?: string;
}

/**
 * One **written component** of a sounding event (Round 46 display metadata).
 *
 * A tie (or a `tieWaitForNote` carry) splits one sounding note into written
 * components: each is a real statement of the source, the last one carrying the
 * release. Nothing here changes the sounding event — its pitch, onset and total
 * duration stay exactly as the importer produced them.
 */
export interface WrittenTieComponent {
  /** Onset tick of the component (the sounding onset for the first one). */
  startTick: number;
  /** Written value of the component in ticks. */
  durationTicks: number;
  /** Outgoing written tie on this component (source `~`). */
  tieForward: boolean;
  /** This component sits under the source's `\set tieWaitForNote = ##t`. */
  tieWait: boolean;
  /** Source voice name the component was written in. */
  voice: string;
}

/**
 * Round 46 — the **written tie chain of one sounding event**, derived from the
 * committed source provenance (`src/scores/brahms-source-fidelity.ts`) and
 * attached by the score builder. Display metadata only: it is never sounded,
 * never counted as a note, and never replaces the event key bijection the
 * written-duration fixture validates.
 */
export interface WrittenTieChain {
  /** Id of the sounding note the chain belongs to. */
  noteId: string;
  /** Ordered written components (first = the attack statement). */
  components: WrittenTieComponent[];
  /** The sounding total (ticks) of the event — unchanged source data. */
  soundingTicks: number;
  /** Source voice the chain was written in (the dominant one when several). */
  voice: string;
}

export interface QuantizedGridScore {
  id: string;
  title: string;
  composer: string;
  opus?: string;
  ticksPerBeat: number; // e.g. 48 ticks per quarter note
  totalTicks: number;
  timeSignatures: TimeSignatureOverlay[];
  barlines: BarlineOverlay[];
  tempos: TempoOverlay[];
  dynamics: DynamicOverlay[];
  pedals: PedalOverlay[];
  notes: QuantizedNote[];
  handCrossings?: HandCrossingEvent[];
  gridResolution?: number;
  /**
   * Round 46: committed written tie chains, one per sounding event that the
   * source writes as more than one tied component. Omitted entirely when the
   * score has no such provenance.
   */
  tieChains?: WrittenTieChain[];
  /**
   * Round 48: the source's **authored silences** (written rests and spacers),
   * in source order. Omitted entirely when the score has no such provenance, so
   * every pre-Round-48 surface and score is untouched.
   */
  sourceSilences?: VoiceSilence[];
}

export type JankoRowIndex = 0 | 1;

export interface JankoKey {
  row: JankoRowIndex;
  column: number; // Whole-tone key column
  pitch: PitchCoordinate;
  linearIndex: number;
  wholeToneSet: 0 | 1; // 0 = Row 0 (Even: 0, 2, 4, 6, 8, 10), 1 = Row 1 (Odd: 1, 3, 5, 7, 9, 11)
  x: number; // Normalized horizontal position in key units
  y: number; // Normalized vertical position (row index)
}

export interface ChordShapePoint {
  key: JankoKey;
  linearIndex: number;
  x: number;
  y: number;
}

export interface ChordShapeVerification {
  name: string;
  rootPitchClass: number;
  intervals: number[]; // semitone offsets from root, e.g. [0, 4, 7] for Major triad
  points: ChordShapePoint[];
  normalizedVectorSignature: [number, number][]; // Relative (dx, dy) offsets verifying isomorphism
}
