import { QuantizedGridScore, QuantizedNote, ArticulationType } from '../model/types';
import { detectHandCrossings } from '../model/grid';

/**
 * J.S. Bach: Goldberg Variations, BWV 988
 * Variation 1. a 1 Clav.
 *
 * Characteristics:
 * - Meter: 3/4
 * - Continuous flowing 16th-note motoric motion
 * - Dynamic two-part hand-crossing counterpoint
 * - Wide register leaps across the manual
 */

const TICKS_PER_BEAT = 48; // Quarter note = 48 ticks
const SIXTEENTH = 12;      // 16th note = 12 ticks
const EIGHTH = 24;         // 8th note = 24 ticks
const QUARTER = 48;        // Quarter note = 48 ticks
const DOTTED_HALF = 144;   // Full 3/4 measure = 144 ticks

let noteIdCounter = 0;
function createNote(
  pitchClass: number,
  octave: number,
  startTick: number,
  durationTicks: number,
  hand: 'RH' | 'LH',
  dynamicMark: 'f' | 'mf' | 'p' = 'mf',
  articulation?: ArticulationType
): QuantizedNote {
  return {
    id: `bach-var1-${++noteIdCounter}`,
    pitch: { pitchClass, octave },
    startTick,
    durationTicks,
    hand,
    velocity: hand === 'RH' ? 88 : 82,
    dynamicMark,
    articulation,
  };
}

export function buildBachGoldbergVar1Score(): QuantizedGridScore {
  noteIdCounter = 0;
  const notes: QuantizedNote[] = [];

  // Pitch Classes: C=0, C#=1, D=2, D#=3, E=4, F=5, F#=6, G=7, G#=8, A=9, A#=10, B=11

  // ==========================================
  // MEASURE 1 (ticks 0 .. 144)
  // RH: Continuous 16ths in G major: G4, A4, B4, C5, B4, A4, B4, G4, D5, C5, B4, A4
  // LH: Bass foundation G2 (dotted half) and tenor chord G3, D4
  // ==========================================
  const m1 = 0;
  // LH Accompaniment
  notes.push(createNote(7, 2, m1, DOTTED_HALF, 'LH', 'mf', 'tenuto')); // G2
  notes.push(createNote(7, 3, m1, QUARTER, 'LH', 'p'));               // G3
  notes.push(createNote(11, 3, m1 + QUARTER, QUARTER, 'LH', 'p'));      // B3
  notes.push(createNote(2, 4, m1 + QUARTER * 2, QUARTER, 'LH', 'p'));  // D4

  // RH 16th-note motor
  const rhM1Pitches = [
    [7, 4], [9, 4], [11, 4], [0, 5],
    [11, 4], [9, 4], [11, 4], [7, 4],
    [2, 5], [0, 5], [11, 4], [9, 4],
  ];
  rhM1Pitches.forEach(([pc, oct], i) => {
    notes.push(createNote(pc, oct, m1 + i * SIXTEENTH, SIXTEENTH, 'RH', 'mf'));
  });

  // ==========================================
  // MEASURE 2 (ticks 144 .. 288)
  // HAND CROSSING 1:
  // LH leaps high above RH to take the 16th stream!
  // LH: B4, C5, D5, E5, D5, C5, D5, B4, G5, F#5, E5, D5
  // RH: Accompanies below: B3, G3, D4
  // ==========================================
  const m2 = 144;
  // RH Accompaniment (below)
  notes.push(createNote(11, 3, m2, QUARTER, 'RH', 'p'));               // B3
  notes.push(createNote(7, 3, m2 + QUARTER, QUARTER, 'RH', 'p'));       // G3
  notes.push(createNote(2, 4, m2 + QUARTER * 2, QUARTER, 'RH', 'p'));  // D4

  // LH 16th-note motor crossing HIGH above RH
  const lhM2Pitches = [
    [11, 4], [0, 5], [2, 5], [4, 5],
    [2, 5], [0, 5], [2, 5], [11, 4],
    [7, 5], [6, 5], [4, 5], [2, 5],
  ];
  lhM2Pitches.forEach(([pc, oct], i) => {
    notes.push(createNote(pc, oct, m2 + i * SIXTEENTH, SIXTEENTH, 'LH', 'f', i === 8 ? 'accent' : undefined));
  });

  // ==========================================
  // MEASURE 3 (ticks 288 .. 432)
  // RH returns to lead 16ths: E5, D5, C5, B4, C5, A4, F#4, G4, A4, B4, C5, D5
  // LH accompanies: C3, E3, A2
  // ==========================================
  const m3 = 288;
  notes.push(createNote(0, 3, m3, QUARTER, 'LH', 'mf'));               // C3
  notes.push(createNote(4, 3, m3 + QUARTER, QUARTER, 'LH', 'mf'));      // E3
  notes.push(createNote(9, 2, m3 + QUARTER * 2, QUARTER, 'LH', 'mf'));  // A2

  const rhM3Pitches = [
    [4, 5], [2, 5], [0, 5], [11, 4],
    [0, 5], [9, 4], [6, 4], [7, 4],
    [9, 4], [11, 4], [0, 5], [2, 5],
  ];
  rhM3Pitches.forEach(([pc, oct], i) => {
    notes.push(createNote(pc, oct, m3 + i * SIXTEENTH, SIXTEENTH, 'RH', 'mf'));
  });

  // ==========================================
  // MEASURE 4 (ticks 432 .. 576)
  // HAND CROSSING 2:
  // LH crosses high again: D5, C5, B4, A4, B4, G4, E4, F#4, G4, A4, B4, C5
  // RH accompanies below: D4, F#4, G4
  // ==========================================
  const m4 = 432;
  notes.push(createNote(2, 4, m4, QUARTER, 'RH', 'p'));               // D4
  notes.push(createNote(6, 4, m4 + QUARTER, QUARTER, 'RH', 'p'));      // F#4
  notes.push(createNote(7, 4, m4 + QUARTER * 2, QUARTER, 'RH', 'p'));  // G4

  const lhM4Pitches = [
    [2, 5], [0, 5], [11, 4], [9, 4],
    [11, 4], [7, 4], [4, 4], [6, 4],
    [7, 4], [9, 4], [11, 4], [0, 5],
  ];
  lhM4Pitches.forEach(([pc, oct], i) => {
    notes.push(createNote(pc, oct, m4 + i * SIXTEENTH, SIXTEENTH, 'LH', 'f'));
  });

  // ==========================================
  // MEASURE 5 (ticks 576 .. 720)
  // Modulation toward D major
  // RH: B4, A4, G4, F#4, G4, E4, C#4, D4, E4, F#4, G4, A4
  // LH: G2, B2, E3
  // ==========================================
  const m5 = 576;
  notes.push(createNote(7, 2, m5, QUARTER, 'LH', 'mf'));
  notes.push(createNote(11, 2, m5 + QUARTER, QUARTER, 'LH', 'mf'));
  notes.push(createNote(4, 3, m5 + QUARTER * 2, QUARTER, 'LH', 'mf'));

  const rhM5Pitches = [
    [11, 4], [9, 4], [7, 4], [6, 4],
    [7, 4], [4, 4], [1, 4], [2, 4],
    [4, 4], [6, 4], [7, 4], [9, 4],
  ];
  rhM5Pitches.forEach(([pc, oct], i) => {
    notes.push(createNote(pc, oct, m5 + i * SIXTEENTH, SIXTEENTH, 'RH', 'mf'));
  });

  // ==========================================
  // MEASURE 6 (ticks 720 .. 864)
  // HAND CROSSING 3:
  // LH leaps high: F#4, E4, D4, C#4, D4, B3, G#3, A3, B3, C#4, D4, E4
  // RH: F#3, A3, D4
  // ==========================================
  const m6 = 720;
  notes.push(createNote(6, 3, m6, QUARTER, 'RH', 'p'));
  notes.push(createNote(9, 3, m6 + QUARTER, QUARTER, 'RH', 'p'));
  notes.push(createNote(2, 4, m6 + QUARTER * 2, QUARTER, 'RH', 'p'));

  const lhM6Pitches = [
    [6, 4], [4, 4], [2, 4], [1, 4],
    [2, 4], [11, 3], [8, 3], [9, 3],
    [11, 3], [1, 4], [2, 4], [4, 4],
  ];
  lhM6Pitches.forEach(([pc, oct], i) => {
    notes.push(createNote(pc, oct, m6 + i * SIXTEENTH, SIXTEENTH, 'LH', 'f'));
  });

  // ==========================================
  // MEASURE 7 (ticks 864 .. 1008)
  // RH: C#5, B4, A4, G4, A4, F#4, D4, E4, F#4, G4, A4, B4
  // LH: A2, C#3, G3
  // ==========================================
  const m7 = 864;
  notes.push(createNote(9, 2, m7, QUARTER, 'LH', 'mf'));
  notes.push(createNote(1, 3, m7 + QUARTER, QUARTER, 'LH', 'mf'));
  notes.push(createNote(7, 3, m7 + QUARTER * 2, QUARTER, 'LH', 'mf'));

  const rhM7Pitches = [
    [1, 5], [11, 4], [9, 4], [7, 4],
    [9, 4], [6, 4], [2, 4], [4, 4],
    [6, 4], [7, 4], [9, 4], [11, 4],
  ];
  rhM7Pitches.forEach(([pc, oct], i) => {
    notes.push(createNote(pc, oct, m7 + i * SIXTEENTH, SIXTEENTH, 'RH', 'mf'));
  });

  // ==========================================
  // MEASURE 8 (ticks 1008 .. 1152)
  // Section Cadence in D major
  // LH: F#4, E4, D4, C#4, D4, A3, F#3, G3, A3, D3
  // RH: D4 (half), C#4 (quarter) -> resolution D4 chord
  // ==========================================
  const m8 = 1008;
  notes.push(createNote(2, 4, m8, QUARTER * 2, 'RH', 'f', 'tenuto'));
  notes.push(createNote(1, 4, m8 + QUARTER * 2, QUARTER, 'RH', 'mf'));

  const lhM8Pitches = [
    [6, 4], [4, 4], [2, 4], [1, 4],
    [2, 4], [9, 3], [6, 3], [7, 3],
    [9, 3], [2, 3], [9, 2], [2, 3],
  ];
  lhM8Pitches.forEach(([pc, oct], i) => {
    notes.push(createNote(pc, oct, m8 + i * SIXTEENTH, SIXTEENTH, 'LH', 'f', i === 11 ? 'tenuto' : undefined));
  });

  const totalTicks = 1152;

  const score: QuantizedGridScore = {
    id: 'bach-goldberg-var1',
    title: 'Goldberg Variations, BWV 988: Variatio 1. a 1 Clav.',
    composer: 'Johann Sebastian Bach',
    opus: 'BWV 988',
    ticksPerBeat: TICKS_PER_BEAT,
    totalTicks,
    timeSignatures: [{ tick: 0, numerator: 3, denominator: 4 }],
    barlines: [
      { barNumber: 1, tick: 0, type: 'regular' },
      { barNumber: 2, tick: 144, type: 'regular' },
      { barNumber: 3, tick: 288, type: 'regular' },
      { barNumber: 4, tick: 432, type: 'regular' },
      { barNumber: 5, tick: 576, type: 'regular' },
      { barNumber: 6, tick: 720, type: 'regular' },
      { barNumber: 7, tick: 864, type: 'regular' },
      { barNumber: 8, tick: 1008, type: 'regular' },
      { barNumber: 9, tick: 1152, type: 'double' },
    ],
    tempos: [{ tick: 0, bpm: 96, description: 'Allegro moderato' }],
    dynamics: [
      { tick: 0, mark: 'mf' },
      { tick: 144, mark: 'f' },
      { tick: 288, mark: 'mf' },
      { tick: 432, mark: 'f' },
      { tick: 576, mark: 'mf' },
      { tick: 720, mark: 'f' },
      { tick: 864, mark: 'mf' },
      { tick: 1008, mark: 'f' },
    ],
    pedals: [],
    notes,
  };

  score.handCrossings = detectHandCrossings(score);
  return score;
}
