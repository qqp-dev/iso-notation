import { PitchCoordinate, JankoRowIndex } from './types';

const PITCH_CLASS_NAMES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
const PITCH_CLASS_NAMES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const;
const PITCH_CLASS_NAMES_BOTH = ['C', 'C#/Db', 'D', 'D#/Eb', 'E', 'F', 'F#/Gb', 'G', 'G#/Ab', 'A', 'A#/Bb', 'B'] as const;

/**
 * Computes linear index: octave * 12 + pitchClass
 * For Octave 0:
 * A0 = 0 * 12 + 9 = 9
 * Bb0 = 0 * 12 + 10 = 10
 * B0 = 0 * 12 + 11 = 11
 * C1 = 1 * 12 + 0 = 12
 * C4 (Middle C) = 4 * 12 + 0 = 48
 */
export function linearIndex(pitch: PitchCoordinate): number {
  return pitch.octave * 12 + pitch.pitchClass;
}

/**
 * Recovers (pitchClass, octave) from linear index
 */
export function fromLinearIndex(index: number): PitchCoordinate {
  const octave = Math.floor(index / 12);
  const pitchClass = ((index % 12) + 12) % 12;
  return { pitchClass, octave };
}

/**
 * Converts PitchCoordinate to standard MIDI note number
 * MIDI = linearIndex + 12
 * e.g. A0 (linear 9) -> MIDI 21
 *      C1 (linear 12) -> MIDI 24
 *      C4 (linear 48) -> MIDI 60
 *      A4 (linear 57) -> MIDI 69 (440 Hz)
 */
export function toMidi(pitch: PitchCoordinate): number {
  return linearIndex(pitch) + 12;
}

/**
 * Converts standard MIDI note number to PitchCoordinate
 */
export function fromMidi(midi: number): PitchCoordinate {
  return fromLinearIndex(midi - 12);
}

/**
 * Calculates equal-tempered frequency in Hertz (A4 = 440 Hz)
 */
export function toFrequency(pitch: PitchCoordinate): number {
  const midi = toMidi(pitch);
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Determines whole-tone parity:
 * 0 = Whole-Tone Set A (C, D, E, F#, G#, A#) -> Janko Rows 1 & 3
 * 1 = Whole-Tone Set B (C#, D#, F, G, A, B)   -> Janko Rows 2 & 4
 */
export function wholeToneParity(input: PitchCoordinate | number): 0 | 1 {
  const pc = typeof input === 'number' ? ((input % 12) + 12) % 12 : input.pitchClass;
  return (pc % 2) as 0 | 1;
}

/**
 * Human-readable label for a pitch class (0..11)
 */
export function pitchClassLabel(
  pitchClass: number,
  format: 'sharp' | 'flat' | 'numeric' | 'both' = 'sharp'
): string {
  const pc = ((pitchClass % 12) + 12) % 12;
  if (format === 'numeric') return String(pc);
  if (format === 'flat') return PITCH_CLASS_NAMES_FLAT[pc];
  if (format === 'both') return PITCH_CLASS_NAMES_BOTH[pc];
  return PITCH_CLASS_NAMES_SHARP[pc];
}

/**
 * Full scientific pitch name (e.g. "C4", "G#3", "0:4")
 */
export function pitchLabel(
  pitch: PitchCoordinate,
  format: 'sharp' | 'flat' | 'numeric' = 'sharp'
): string {
  if (format === 'numeric') {
    return `${pitch.pitchClass}:${pitch.octave}`;
  }
  return `${pitchClassLabel(pitch.pitchClass, format)}${pitch.octave}`;
}

/**
 * Returns available Janko rows for a given pitch.
 * Even pitch classes (WT-A) -> rows 1 and 3.
 * Odd pitch classes (WT-B) -> rows 2 and 4.
 */
export function jankoRowsForPitch(pitch: PitchCoordinate): [JankoRowIndex, JankoRowIndex] {
  return wholeToneParity(pitch) === 0 ? [1, 3] : [2, 4];
}

/**
 * Computes signed semitone difference between two pitches (p2 - p1)
 */
export function semitoneInterval(p1: PitchCoordinate, p2: PitchCoordinate): number {
  return linearIndex(p2) - linearIndex(p1);
}

/**
 * Checks if two pitch coordinates represent the same pitch
 */
export function isSamePitch(p1: PitchCoordinate, p2: PitchCoordinate): boolean {
  return p1.pitchClass === p2.pitchClass && p1.octave === p2.octave;
}
