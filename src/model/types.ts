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

export type DynamicMark = 'ppp' | 'pp' | 'p' | 'mp' | 'mf' | 'f' | 'ff' | 'fff' | 'sfz';

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

export interface DynamicOverlay {
  tick: number;
  mark: DynamicMark | 'crescendo' | 'decrescendo';
  durationTicks?: number; // for hairpins
}

export type PedalType = 'sustain-down' | 'sustain-up' | 'sustain-change' | 'una-corda';

export interface PedalOverlay {
  tick: number;
  type: PedalType;
}

export interface HandCrossingEvent {
  tick: number;
  durationTicks: number;
  higherHand: Hand;
  description?: string;
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
