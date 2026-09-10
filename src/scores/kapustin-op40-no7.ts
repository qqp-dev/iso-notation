import { QuantizedGridScore, QuantizedNote, ArticulationType } from '../model/types';
import { detectHandCrossings } from '../model/grid';

/**
 * Nikolai Kapustin: Eight Concert Études, Op. 40
 * No. 7 "Intermezzo" (Allegretto)
 *
 * Characteristics:
 * - Meter: 4/4
 * - Rich jazz harmony (Dbmaj9, Eb9, Ab13, Bbm9, chromatic passing chords)
 * - Subtle jazz syncopations and anticipations
 * - Layered swing counterpoint between stride bass and syncopated chord stabs
 */

const TICKS_PER_BEAT = 48; // Quarter note = 48 ticks
const SIXTEENTH = 12;      // 16th = 12 ticks
const EIGHTH = 24;         // 8th = 24 ticks
const DOTTED_EIGHTH = 36;  // 36 ticks
const QUARTER = 48;        // Quarter = 48 ticks
const HALF = 96;           // Half = 96 ticks
const MEASURE = 192;       // 4/4 measure = 192 ticks

let noteIdCounter = 0;
function createNote(
  pitchClass: number,
  octave: number,
  startTick: number,
  durationTicks: number,
  hand: 'RH' | 'LH',
  velocity: number = 85,
  dynamicMark?: 'f' | 'mf' | 'p' | 'ff',
  articulation?: ArticulationType
): QuantizedNote {
  return {
    id: `kapustin-op40no7-${++noteIdCounter}`,
    pitch: { pitchClass, octave },
    startTick,
    durationTicks,
    hand,
    velocity,
    dynamicMark,
    articulation,
  };
}

export function buildKapustinOp40No7Score(): QuantizedGridScore {
  noteIdCounter = 0;
  const notes: QuantizedNote[] = [];

  // Pitch Classes:
  // C=0, Db=1, D=2, Eb=3, E=4, F=5, Gb=6, G=7, Ab=8, A=9, Bb=10, B=11

  // ========================================================
  // MEASURE 1 (ticks 0 .. 192) - Main Theme Introduction (Db major)
  // LH: Stride bass Db2 on beat 1, Eb3-Ab3-C4 tenor shell on beat 2 (& offbeat)
  // RH: Syncopated melody & upper extensions: F4-Ab4-C5-Eb5 (Dbmaj9)
  // ========================================================
  const m1 = 0;
  // LH Bass
  notes.push(createNote(1, 2, m1, QUARTER, 'LH', 92, 'mf', 'accent'));        // Db2
  notes.push(createNote(3, 3, m1 + EIGHTH, EIGHTH, 'LH', 74, 'p', 'staccato')); // Eb3
  notes.push(createNote(8, 3, m1 + EIGHTH, EIGHTH, 'LH', 74, 'p', 'staccato')); // Ab3
  notes.push(createNote(0, 4, m1 + EIGHTH, EIGHTH, 'LH', 74, 'p', 'staccato')); // C4
  notes.push(createNote(8, 2, m1 + HALF, QUARTER, 'LH', 88, 'mf', 'tenuto'));  // Ab2 (fifth in bass)
  notes.push(createNote(5, 3, m1 + HALF + QUARTER, QUARTER, 'LH', 76, 'p'));  // F3
  notes.push(createNote(1, 4, m1 + HALF + QUARTER, QUARTER, 'LH', 76, 'p'));  // Db4

  // RH Melody & Syncopated Chord
  // Beat 1: Anticipated upbeat into melody: F4 -> Ab4
  notes.push(createNote(5, 4, m1, EIGHTH, 'RH', 86, 'mf'));                   // F4
  notes.push(createNote(8, 4, m1 + EIGHTH, EIGHTH, 'RH', 90, 'mf'));          // Ab4
  // Offbeat stab at tick 36 (dotted 8th syncopation)
  notes.push(createNote(0, 5, m1 + DOTTED_EIGHTH, EIGHTH, 'RH', 96, 'f', 'accent')); // C5 (maj7)
  notes.push(createNote(3, 5, m1 + DOTTED_EIGHTH, EIGHTH, 'RH', 96, 'f', 'accent')); // Eb5 (9th)
  // Beat 3 melody continuation: F5 -> Eb5 -> Db5
  notes.push(createNote(5, 5, m1 + HALF, EIGHTH, 'RH', 88, 'mf'));             // F5
  notes.push(createNote(3, 5, m1 + HALF + EIGHTH, EIGHTH, 'RH', 84, 'mf'));    // Eb5
  notes.push(createNote(1, 5, m1 + HALF + QUARTER, QUARTER, 'RH', 92, 'mf', 'tenuto')); // Db5

  // ========================================================
  // MEASURE 2 (ticks 192 .. 384) - Chromatic Step: Ddim7 -> Ebm9
  // LH: D2 passing bass -> Eb2 on beat 2
  // RH: Interlocking jazz syncopated chords
  // ========================================================
  const m2 = 192;
  // LH Chromatic Passing
  notes.push(createNote(2, 2, m2, QUARTER, 'LH', 85, 'mf'));                  // D2
  notes.push(createNote(6, 3, m2, QUARTER, 'LH', 75, 'p'));                   // Gb3
  notes.push(createNote(0, 4, m2, QUARTER, 'LH', 75, 'p'));                   // C4
  notes.push(createNote(3, 2, m2 + QUARTER, QUARTER, 'LH', 94, 'mf', 'accent')); // Eb2
  notes.push(createNote(10, 2, m2 + HALF, QUARTER, 'LH', 84, 'mf'));          // Bb2
  notes.push(createNote(6, 3, m2 + HALF + QUARTER, QUARTER, 'LH', 80, 'p'));  // Gb3
  notes.push(createNote(1, 4, m2 + HALF + QUARTER, QUARTER, 'LH', 80, 'p'));  // Db4

  // RH Syncopated Response: Ebm9 voicing (F4 - Bb4 - Db5 - F5)
  notes.push(createNote(5, 4, m2 + EIGHTH, EIGHTH, 'RH', 90, 'f', 'accent')); // F4 (9th)
  notes.push(createNote(10, 4, m2 + EIGHTH, EIGHTH, 'RH', 90, 'f', 'accent')); // Bb4
  notes.push(createNote(1, 5, m2 + EIGHTH, EIGHTH, 'RH', 92, 'f', 'accent'));  // Db5
  // Run descending swing 8ths
  notes.push(createNote(5, 5, m2 + HALF, EIGHTH, 'RH', 88, 'mf'));             // F5
  notes.push(createNote(3, 5, m2 + HALF + EIGHTH, EIGHTH, 'RH', 85, 'mf'));    // Eb5
  notes.push(createNote(1, 5, m2 + HALF + QUARTER, EIGHTH, 'RH', 82, 'mf'));   // Db5
  notes.push(createNote(10, 4, m2 + HALF + QUARTER + EIGHTH, EIGHTH, 'RH', 86, 'mf')); // Bb4

  // ========================================================
  // MEASURE 3 (ticks 384 .. 576) - Ab13(b9) Dominant Alteration
  // LH: Ab1 bass pedal, G3-Gb3 tritone shell
  // RH: Extended altered chord voicing: C4-Gb4-Bb4-Db5-F5
  // ========================================================
  const m3 = 384;
  notes.push(createNote(8, 1, m3, HALF, 'LH', 96, 'f', 'tenuto'));            // Ab1
  notes.push(createNote(6, 3, m3 + EIGHTH, EIGHTH, 'LH', 78, 'p', 'staccato')); // Gb3
  notes.push(createNote(0, 4, m3 + EIGHTH, EIGHTH, 'LH', 78, 'p', 'staccato')); // C4
  notes.push(createNote(8, 2, m3 + HALF, QUARTER, 'LH', 88, 'mf'));           // Ab2
  notes.push(createNote(5, 3, m3 + HALF + QUARTER, QUARTER, 'LH', 80, 'p'));  // F3

  // RH Altered stabs & blues ornament
  notes.push(createNote(10, 4, m3, SIXTEENTH, 'RH', 85, 'mf'));               // Bb4
  notes.push(createNote(11, 4, m3 + SIXTEENTH, EIGHTH, 'RH', 95, 'f', 'accent')); // B4 (blue note / #9)
  notes.push(createNote(0, 5, m3 + DOTTED_EIGHTH, EIGHTH, 'RH', 90, 'mf'));    // C5
  notes.push(createNote(5, 5, m3 + HALF, QUARTER, 'RH', 94, 'f', 'tenuto'));   // F5 (13th)
  notes.push(createNote(1, 5, m3 + HALF + QUARTER, EIGHTH, 'RH', 86, 'mf'));   // Db5 (b9)
  notes.push(createNote(0, 5, m3 + HALF + QUARTER + EIGHTH, EIGHTH, 'RH', 84, 'mf')); // C5

  // ========================================================
  // MEASURE 4 (ticks 576 .. 768) - Resolution to Dbmaj7(#11)
  // ========================================================
  const m4 = 576;
  notes.push(createNote(1, 2, m4, HALF, 'LH', 92, 'f'));                      // Db2
  notes.push(createNote(8, 2, m4 + QUARTER, QUARTER, 'LH', 82, 'p'));         // Ab2
  notes.push(createNote(5, 3, m4 + HALF, QUARTER, 'LH', 85, 'mf'));           // F3
  notes.push(createNote(1, 3, m4 + HALF + QUARTER, QUARTER, 'LH', 80, 'p'));  // Db3

  // RH Lydian #11 color (G4) with rich maj9
  notes.push(createNote(7, 4, m4, QUARTER, 'RH', 92, 'mf', 'tenuto'));         // G4 (#11)
  notes.push(createNote(0, 5, m4, QUARTER, 'RH', 92, 'mf', 'tenuto'));         // C5 (maj7)
  notes.push(createNote(3, 5, m4, QUARTER, 'RH', 92, 'mf', 'tenuto'));         // Eb5 (9th)
  // Arpeggiated flourish
  notes.push(createNote(5, 5, m4 + QUARTER, SIXTEENTH, 'RH', 86, 'mf'));       // F5
  notes.push(createNote(7, 5, m4 + QUARTER + SIXTEENTH, SIXTEENTH, 'RH', 88, 'mf')); // G5
  notes.push(createNote(8, 5, m4 + HALF, EIGHTH, 'RH', 94, 'f', 'accent'));   // Ab5
  notes.push(createNote(5, 5, m4 + HALF + EIGHTH, EIGHTH, 'RH', 86, 'mf'));    // F5
  notes.push(createNote(3, 5, m4 + HALF + QUARTER, QUARTER, 'RH', 88, 'mf', 'tenuto')); // Eb5

  // ========================================================
  // MEASURES 5-8: Secondary Jazz Counterpoint (Bbm9 -> Eb13 -> Ebm9/Ab -> Db6/9)
  // ========================================================
  const m5 = 768;
  notes.push(createNote(10, 1, m5, QUARTER, 'LH', 90, 'mf'));                 // Bb1
  notes.push(createNote(1, 3, m5 + EIGHTH, EIGHTH, 'LH', 78, 'p'));           // Db3
  notes.push(createNote(8, 3, m5 + EIGHTH, EIGHTH, 'LH', 78, 'p'));           // Ab3
  notes.push(createNote(0, 4, m5 + EIGHTH, EIGHTH, 'LH', 82, 'mf'));          // C4
  notes.push(createNote(5, 2, m5 + HALF, QUARTER, 'LH', 85, 'mf'));           // F2
  notes.push(createNote(10, 2, m5 + HALF + QUARTER, QUARTER, 'LH', 80, 'p')); // Bb2

  notes.push(createNote(1, 5, m5, EIGHTH, 'RH', 88, 'mf'));                   // Db5
  notes.push(createNote(3, 5, m5 + EIGHTH, EIGHTH, 'RH', 92, 'f', 'accent')); // Eb5
  notes.push(createNote(5, 5, m5 + QUARTER, EIGHTH, 'RH', 88, 'mf'));         // F5
  notes.push(createNote(8, 5, m5 + DOTTED_EIGHTH, EIGHTH, 'RH', 96, 'f', 'accent')); // Ab5
  notes.push(createNote(10, 5, m5 + HALF, QUARTER, 'RH', 90, 'mf', 'tenuto'));// Bb5
  notes.push(createNote(8, 5, m5 + HALF + QUARTER, EIGHTH, 'RH', 86, 'mf'));  // Ab5
  notes.push(createNote(5, 5, m5 + HALF + QUARTER + EIGHTH, EIGHTH, 'RH', 84, 'mf')); // F5

  const m6 = 960;
  notes.push(createNote(3, 2, m6, QUARTER, 'LH', 92, 'mf'));                  // Eb2
  notes.push(createNote(10, 2, m6 + QUARTER, QUARTER, 'LH', 80, 'p'));        // Bb2
  notes.push(createNote(1, 3, m6 + HALF, QUARTER, 'LH', 82, 'mf'));           // Db3
  notes.push(createNote(7, 3, m6 + HALF + QUARTER, QUARTER, 'LH', 85, 'p'));  // G3

  notes.push(createNote(7, 4, m6, EIGHTH, 'RH', 86, 'mf'));                   // G4
  notes.push(createNote(1, 5, m6 + EIGHTH, EIGHTH, 'RH', 90, 'f', 'accent')); // Db5
  notes.push(createNote(5, 5, m6 + QUARTER, EIGHTH, 'RH', 94, 'f'));          // F5
  notes.push(createNote(3, 5, m6 + DOTTED_EIGHTH, EIGHTH, 'RH', 88, 'mf'));   // Eb5
  notes.push(createNote(0, 5, m6 + HALF, QUARTER, 'RH', 92, 'mf', 'tenuto')); // C5
  notes.push(createNote(10, 4, m6 + HALF + QUARTER, QUARTER, 'RH', 86, 'mf'));// Bb4

  const m7 = 1152;
  notes.push(createNote(8, 1, m7, HALF, 'LH', 94, 'f', 'tenuto'));            // Ab1
  notes.push(createNote(6, 3, m7 + EIGHTH, EIGHTH, 'LH', 80, 'p'));           // Gb3
  notes.push(createNote(1, 4, m7 + EIGHTH, EIGHTH, 'LH', 80, 'p'));           // Db4
  notes.push(createNote(3, 4, m7 + EIGHTH, EIGHTH, 'LH', 84, 'mf'));          // Eb4
  notes.push(createNote(8, 2, m7 + HALF, QUARTER, 'LH', 88, 'mf'));           // Ab2

  notes.push(createNote(6, 4, m7, SIXTEENTH, 'RH', 84, 'mf'));                // Gb4
  notes.push(createNote(8, 4, m7 + SIXTEENTH, SIXTEENTH, 'RH', 86, 'mf'));    // Ab4
  notes.push(createNote(10, 4, m7 + EIGHTH, EIGHTH, 'RH', 90, 'mf'));         // Bb4
  notes.push(createNote(0, 5, m7 + DOTTED_EIGHTH, EIGHTH, 'RH', 94, 'f', 'accent')); // C5
  notes.push(createNote(3, 5, m7 + HALF, EIGHTH, 'RH', 92, 'mf'));            // Eb5
  notes.push(createNote(5, 5, m7 + HALF + EIGHTH, EIGHTH, 'RH', 96, 'f', 'accent')); // F5
  notes.push(createNote(8, 5, m7 + HALF + QUARTER, QUARTER, 'RH', 98, 'ff', 'tenuto')); // Ab5

  const m8 = 1344;
  // Final Cadence: Db6/9 full chord
  notes.push(createNote(1, 1, m8, MEASURE, 'LH', 96, 'f', 'tenuto'));         // Db1
  notes.push(createNote(8, 2, m8, MEASURE, 'LH', 88, 'mf', 'tenuto'));        // Ab2
  notes.push(createNote(5, 3, m8, MEASURE, 'LH', 84, 'mf', 'tenuto'));        // F3

  notes.push(createNote(10, 3, m8, MEASURE, 'RH', 88, 'mf', 'tenuto'));       // Bb3 (6th)
  notes.push(createNote(0, 4, m8, MEASURE, 'RH', 92, 'f', 'tenuto'));         // C4 (maj7)
  notes.push(createNote(3, 4, m8, MEASURE, 'RH', 94, 'f', 'tenuto'));         // Eb4 (9th)
  notes.push(createNote(5, 4, m8, MEASURE, 'RH', 94, 'f', 'tenuto'));         // F4
  notes.push(createNote(1, 5, m8, MEASURE, 'RH', 98, 'ff', 'fermata'));       // Db5 (top voice)

  const totalTicks = 1536; // 8 measures * 192 ticks

  const score: QuantizedGridScore = {
    id: 'kapustin-op40-no7',
    title: 'Eight Concert Études, Op. 40: No. 7 "Intermezzo"',
    composer: 'Nikolai Kapustin',
    opus: 'Op. 40, No. 7',
    ticksPerBeat: TICKS_PER_BEAT,
    totalTicks,
    timeSignatures: [{ tick: 0, numerator: 4, denominator: 4 }],
    barlines: [
      { barNumber: 1, tick: 0, type: 'regular' },
      { barNumber: 2, tick: 192, type: 'regular' },
      { barNumber: 3, tick: 384, type: 'regular' },
      { barNumber: 4, tick: 576, type: 'regular' },
      { barNumber: 5, tick: 768, type: 'regular' },
      { barNumber: 6, tick: 960, type: 'regular' },
      { barNumber: 7, tick: 1152, type: 'regular' },
      { barNumber: 8, tick: 1344, type: 'regular' },
      { barNumber: 9, tick: 1536, type: 'final' },
    ],
    tempos: [{ tick: 0, bpm: 104, description: 'Allegretto (with swing)' }],
    dynamics: [
      { tick: 0, mark: 'mf' },
      { tick: 384, mark: 'f' },
      { tick: 576, mark: 'mf' },
      { tick: 1152, mark: 'f' },
      { tick: 1344, mark: 'ff' },
    ],
    pedals: [
      { tick: 0, type: 'sustain-down' },
      { tick: 192, type: 'sustain-change' },
      { tick: 384, type: 'sustain-change' },
      { tick: 576, type: 'sustain-change' },
      { tick: 768, type: 'sustain-change' },
      { tick: 960, type: 'sustain-change' },
      { tick: 1152, type: 'sustain-change' },
      { tick: 1344, type: 'sustain-down' },
      { tick: 1536, type: 'sustain-up' },
    ],
    notes,
  };

  score.handCrossings = detectHandCrossings(score);
  return score;
}
