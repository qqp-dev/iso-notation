import { JankoKey, JankoRowIndex, PitchCoordinate, ChordShapeVerification, ChordShapePoint } from '../model/types';
import { linearIndex, wholeToneParity } from '../model/pitch';

export interface JankoKeyboardLayout {
  keys: JankoKey[];
  minOctave: number;
  maxOctave: number;
  totalColumns: number;
  keyWidth: number;
  keyHeight: number;
  rowGap: number;
}

/**
 * Builds the geometric key layout for a strict 2-row Janko keyboard.
 * Exactly two non-redundant whole-tone basis rows:
 * Row 1 (top):    Odd pitch classes (1, 3, 5, 7, 9, 11)  - staggered +0.5
 * Row 0 (bottom): Even pitch classes (0, 2, 4, 6, 8, 10) - base alignment
 */
export function buildJankoLayout(
  minOctave: number = 1,
  maxOctave: number = 7,
  keyWidth: number = 36,
  keyHeight: number = 42,
  rowGap: number = 4
): JankoKeyboardLayout {
  const keys: JankoKey[] = [];
  const totalColumns = (maxOctave - minOctave + 1) * 6;

  for (let oct = minOctave; oct <= maxOctave; oct++) {
    const octColOffset = (oct - minOctave) * 6;

    // Row 0: Even Pitch Classes: 0, 2, 4, 6, 8, 10
    const wtEven = [0, 2, 4, 6, 8, 10];
    wtEven.forEach((pc, idx) => {
      const col = octColOffset + idx;
      const pitch: PitchCoordinate = { pitchClass: pc, octave: oct };
      const lIdx = linearIndex(pitch);

      keys.push({
        row: 0,
        column: col,
        pitch,
        linearIndex: lIdx,
        wholeToneSet: 0,
        x: col * keyWidth,
        y: keyHeight + rowGap, // Row 0 at bottom
      });
    });

    // Row 1: Odd Pitch Classes: 1, 3, 5, 7, 9, 11
    const wtOdd = [1, 3, 5, 7, 9, 11];
    wtOdd.forEach((pc, idx) => {
      const col = octColOffset + idx;
      const pitch: PitchCoordinate = { pitchClass: pc, octave: oct };
      const lIdx = linearIndex(pitch);
      const staggeredX = (col + 0.5) * keyWidth;

      keys.push({
        row: 1,
        column: col,
        pitch,
        linearIndex: lIdx,
        wholeToneSet: 1,
        x: staggeredX,
        y: 0, // Row 1 at top
      });
    });
  }

  return {
    keys,
    minOctave,
    maxOctave,
    totalColumns,
    keyWidth,
    keyHeight,
    rowGap,
  };
}

export const CHORD_DEFINITIONS: Record<string, number[]> = {
  'Major Triad': [0, 4, 7],
  'Minor Triad': [0, 3, 7],
  'Dominant 7th': [0, 4, 7, 10],
  'Major 7th': [0, 4, 7, 11],
  'Minor 7th': [0, 3, 7, 10],
  'Diminished 7th': [0, 3, 6, 9],
  'Augmented Triad': [0, 4, 8],
  'Minor 9th': [0, 3, 7, 10, 14],
};

/**
 * Computes spatial hand shape points on the 2-row Janko keyboard
 * for any given chord voicing and transpositions, verifying whole-tone isomorphism.
 */
export function computeChordShapeVerification(
  chordName: string,
  rootPitchClass: number,
  octave: number = 4
): ChordShapeVerification {
  const intervals = CHORD_DEFINITIONS[chordName] || [0, 4, 7];
  const points: ChordShapePoint[] = [];

  const rootParity = (rootPitchClass % 2) as 0 | 1;
  const rootCol = octave * 6 + Math.floor(rootPitchClass / 2);
  const rootX = rootCol + (rootParity === 1 ? 0.5 : 0);
  const rootY = rootParity;

  intervals.forEach(semi => {
    const totalPc = rootPitchClass + semi;
    const targetPc = totalPc % 12;
    const targetOct = octave + Math.floor(totalPc / 12);
    const targetParity = (targetPc % 2) as 0 | 1;

    const col = targetOct * 6 + Math.floor(targetPc / 2);
    const x = col + (targetParity === 1 ? 0.5 : 0);
    const y = targetParity;

    const dummyKey: JankoKey = {
      row: targetParity,
      column: col,
      pitch: { pitchClass: targetPc, octave: targetOct },
      linearIndex: targetOct * 12 + targetPc,
      wholeToneSet: targetParity,
      x: x * 36,
      y: targetParity === 0 ? 46 : 0,
    };

    points.push({
      key: dummyKey,
      linearIndex: dummyKey.linearIndex,
      x,
      y,
    });
  });

  // Normalized relative vector signature: (dx, dy) relative to root
  const normalizedVectorSignature: [number, number][] = points.map(p => [
    p.x - rootX,
    p.y - rootY,
  ]);

  return {
    name: chordName,
    rootPitchClass,
    intervals,
    points,
    normalizedVectorSignature,
  };
}
