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
 * Builds the geometric key layout for a 4-row Janko keyboard.
 * Rows are numbered 1 to 4 from bottom to top:
 * Row 4 (top):       WT-B (C#, D#, F, G, A, B)  - staggered +0.5
 * Row 3 (upper-mid): WT-A (C, D, E, F#, G#, A#) - aligned with Row 1
 * Row 2 (lower-mid): WT-B (C#, D#, F, G, A, B)  - staggered +0.5
 * Row 1 (bottom):    WT-A (C, D, E, F#, G#, A#) - whole-tone A
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

    // WT-A Pitch Classes: 0, 2, 4, 6, 8, 10
    const wtA = [0, 2, 4, 6, 8, 10];
    wtA.forEach((pc, idx) => {
      const col = octColOffset + idx;
      const pitch: PitchCoordinate = { pitchClass: pc, octave: oct };
      const lIdx = linearIndex(pitch);

      // Row 1 (bottom)
      keys.push({
        row: 1,
        column: col,
        pitch,
        linearIndex: lIdx,
        wholeToneSet: 0,
        x: col * keyWidth,
        y: 3 * (keyHeight + rowGap), // Row 1 at bottom
      });

      // Row 3 (upper-mid duplicate)
      keys.push({
        row: 3,
        column: col,
        pitch,
        linearIndex: lIdx,
        wholeToneSet: 0,
        x: col * keyWidth,
        y: 1 * (keyHeight + rowGap), // Row 3
      });
    });

    // WT-B Pitch Classes: 1, 3, 5, 7, 9, 11
    const wtB = [1, 3, 5, 7, 9, 11];
    wtB.forEach((pc, idx) => {
      const col = octColOffset + idx;
      const pitch: PitchCoordinate = { pitchClass: pc, octave: oct };
      const lIdx = linearIndex(pitch);
      const staggeredX = (col + 0.5) * keyWidth;

      // Row 2 (lower-mid)
      keys.push({
        row: 2,
        column: col,
        pitch,
        linearIndex: lIdx,
        wholeToneSet: 1,
        x: staggeredX,
        y: 2 * (keyHeight + rowGap), // Row 2
      });

      // Row 4 (top duplicate)
      keys.push({
        row: 4,
        column: col,
        pitch,
        linearIndex: lIdx,
        wholeToneSet: 1,
        x: staggeredX,
        y: 0 * (keyHeight + rowGap), // Row 4 at top
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
 * Computes optimal physical hand shape points on the 4-row Janko keyboard
 * for any given chord voicing and transpositions, proving spatial hand-shape isomorphism.
 */
export function computeChordShapeVerification(
  chordName: string,
  rootPitchClass: number,
  octave: number = 4
): ChordShapeVerification {
  const intervals = CHORD_DEFINITIONS[chordName] || [0, 4, 7];
  const points: ChordShapePoint[] = [];

  // If root is WT-A (even), root starts on Row 1.
  // If root is WT-B (odd), root starts on Row 2.
  const rootParity = rootPitchClass % 2;
  const baseRow = rootParity === 0 ? 1 : 2;

  // Root Key position
  const rootCol = octave * 6 + Math.floor(rootPitchClass / 2);
  const rootX = (rootCol + (rootParity === 1 ? 0.5 : 0));
  const rootY = baseRow;

  intervals.forEach(semi => {
    const targetPc = (rootPitchClass + semi) % 12;
    const targetOct = octave + Math.floor((rootPitchClass + semi) / 12);
    const targetParity = targetPc % 2;

    // Choose row:
    // If parity is same as baseRow parity, use baseRow or baseRow+2
    // If parity is opposite, use baseRow+1
    let row: JankoRowIndex = baseRow as JankoRowIndex;
    if (targetParity === rootParity) {
      row = (baseRow + (semi >= 12 ? 2 : 0)) as JankoRowIndex;
      if (row > 4) row = 4;
    } else {
      row = ((baseRow === 1 ? 2 : 3)) as JankoRowIndex;
    }

    const col = targetOct * 6 + Math.floor(targetPc / 2);
    const x = col + (targetParity === 1 ? 0.5 : 0);
    const y = row;

    const dummyKey: JankoKey = {
      row,
      column: col,
      pitch: { pitchClass: targetPc, octave: targetOct },
      linearIndex: targetOct * 12 + targetPc,
      wholeToneSet: targetParity as 0 | 1,
      x: x * 36,
      y: (4 - row) * 46,
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
