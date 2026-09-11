import { PitchCoordinate, JankoRowIndex } from './types';

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
 * 0 = Whole-Tone Row 0 (Even: 0, 2, 4, 6, 8, 10)
 * 1 = Whole-Tone Row 1 (Odd: 1, 3, 5, 7, 9, 11)
 */
export function wholeToneParity(input: PitchCoordinate | number): 0 | 1 {
  const pc = typeof input === 'number' ? ((input % 12) + 12) % 12 : input.pitchClass;
  return (pc % 2) as 0 | 1;
}

export * from './phonetics';
import { getCanonicalSyllable } from './phonetics';

/**
 * Human-readable label for a pitch class (0..11).
 * Supports numeric ('0') or canonical phonetic solfege ('ma').
 */
export function pitchClassLabel(
  pitchClass: number,
  format: 'numeric' | 'phonetic' | 'sharp' | 'flat' | 'both' = 'numeric'
): string {
  const pc = ((pitchClass % 12) + 12) % 12;
  if (format === 'phonetic') {
    return getCanonicalSyllable(pc);
  }
  return String(pc);
}

/**
 * Full pitch name as pure (pitchClass:octave), e.g. "9:0", "0:3", or phonetic "bi0", "ma3".
 * Uses 0-indexed octaves anchored on A (pitch class 9, consonant 'b', syllable 'bi'):
 * A is the reference pitch and lowest note on an 88-key piano (A0).
 * - A0 (lowest piano key) is b0 (bi0, linear index 9)
 * - Middle C is ma3 (linear index 48)
 * - Concert A (440 Hz) is b4 (bi4, linear index 57)
 * - Highest A on piano is b7 (bi7, linear index 93)
 */
export function pitchLabel(
  pitch: PitchCoordinate,
  format: 'numeric' | 'phonetic' | 'sharp' | 'flat' = 'numeric'
): string {
  const l = linearIndex(pitch);
  const aOct = Math.max(0, Math.floor((l - 9) / 12));
  if (format === 'phonetic') {
    return `${getCanonicalSyllable(pitch.pitchClass)}${aOct}`;
  }
  return `${pitch.pitchClass}:${aOct}`;
}

/**
 * Returns the Janko row for a given pitch on the strict 2-row layout:
 * Even pitch classes -> Row 0
 * Odd pitch classes  -> Row 1
 */
export function jankoRowForPitch(pitch: PitchCoordinate | number): JankoRowIndex {
  return wholeToneParity(pitch);
}

/**
 * Returns available Janko row as array for compatibility.
 */
export function jankoRowsForPitch(pitch: PitchCoordinate): [JankoRowIndex] {
  return [jankoRowForPitch(pitch)];
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
