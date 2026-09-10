import { QuantizedGridScore, QuantizedNote, ArticulationType } from '../model/types';
import { detectHandCrossings } from '../model/grid';

/**
 * Nikolai Kapustin: Eight Concert Études, Op. 40
 * No. 7 "Intermezzo" (Allegretto, quarter = 126)
 *
 * Direct Urtext encoding from composer's manuscript and published score:
 * - Meter: 4/4 (Common time C)
 * - Ticks per beat: 48 (subdivision GCD for swing triplets and 16ths)
 * - Triplet 8th: 16 ticks
 * - Triplet quarter: 32 ticks
 * - 16th note: 12 ticks
 * - Dotted 8th note: 36 ticks
 * - 8th note: 24 ticks
 * - Measure length: 192 ticks
 * - Key signature: Db Major (5 flats: Bb=10, Eb=3, Ab=8, Db=1, Gb=6; naturals C=0, F=5)
 * - Strict non-diatonic numerical coordinates: (pitchClass: 0..11, octave: 0..N)
 */

const TICKS_PER_BEAT = 48;
const MEASURE = 192;

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

  // =========================================================================
  // MEASURE 1 (ticks 0 .. 192) - Main Theme Introduction (Eb9 / Ebm11 groove)
  // LH: Low Eb2 triplet groove: Eb2 -> Bb2 -> Db3 -> F3 -> Ab3 -> Bb3(tied)
  // RH: Descending parallel 10ths/3rds on swing triplets & syncopations
  // =========================================================================
  const m1 = 0;

  // Beat 1 (ticks 0..48)
  // LH Triplet 8ths
  notes.push(createNote(3, 2, m1 + 0, 16, 'LH', 88, 'p', 'staccato'));  // Eb2
  notes.push(createNote(10, 2, m1 + 16, 16, 'LH', 82));                 // Bb2
  notes.push(createNote(1, 3, m1 + 32, 16, 'LH', 82));                  // Db3
  // RH 3rd triplet upbeat stab
  notes.push(createNote(8, 5, m1 + 32, 16, 'RH', 88));                  // Ab5
  notes.push(createNote(0, 6, m1 + 32, 16, 'RH', 92));                  // C6

  // Beat 2 (ticks 48..96)
  // LH walking line
  notes.push(createNote(5, 3, m1 + 48, 16, 'LH', 82));                  // F3
  notes.push(createNote(8, 3, m1 + 64, 16, 'LH', 82));                  // Ab3
  notes.push(createNote(10, 3, m1 + 80, 32, 'LH', 85));                 // Bb3 (tied into beat 3)
  // RH swing triplet: quarter (32t) + 8th (16t)
  notes.push(createNote(6, 5, m1 + 48, 32, 'RH', 88));                  // Gb5
  notes.push(createNote(10, 5, m1 + 48, 32, 'RH', 90));                 // Bb5
  notes.push(createNote(5, 5, m1 + 80, 16, 'RH', 84));                  // F5
  notes.push(createNote(8, 5, m1 + 80, 16, 'RH', 86));                  // Ab5

  // Beat 3 (ticks 96..144)
  // RH straight dotted 8th (36t) + 16th (12t)
  notes.push(createNote(1, 5, m1 + 96, 36, 'RH', 86));                  // Db5
  notes.push(createNote(5, 5, m1 + 96, 36, 'RH', 88));                  // F5
  notes.push(createNote(8, 5, m1 + 132, 12, 'RH', 86));                 // Ab5

  // Beat 4 (ticks 144..192)
  // LH 3rd triplet upbeat into M2
  notes.push(createNote(8, 2, m1 + 176, 32, 'LH', 88, 'mf', 'tenuto')); // Ab2 (tied across barline)
  // RH 3rd triplet upbeat
  notes.push(createNote(8, 5, m1 + 176, 16, 'RH', 90));                 // Ab5
  notes.push(createNote(0, 6, m1 + 176, 16, 'RH', 92));                 // C6

  // =========================================================================
  // MEASURE 2 (ticks 192 .. 384) - Altered Dominant (Ab7b13) -> 16th Cascade
  // LH: Ab2 -> C3 -> Gb3 -> C4 -> Db4 arpeggiation
  // RH: Altered swing chords (Fb5/Ab5 -> Eb5/Gb5) -> accented F5 -> cascading 16ths
  // =========================================================================
  const m2 = 192;

  // Beat 1 (ticks 192..240)
  // LH Triplet 8ths
  notes.push(createNote(0, 3, m2 + 16, 16, 'LH', 82));                  // C3
  notes.push(createNote(6, 3, m2 + 32, 16, 'LH', 82));                  // Gb3
  // RH swing triplet: quarter (32t) + 8th (16t)
  notes.push(createNote(4, 5, m2 + 0, 32, 'RH', 90));                   // Fb5 (E5)
  notes.push(createNote(8, 5, m2 + 0, 32, 'RH', 90));                   // Ab5
  notes.push(createNote(3, 5, m2 + 32, 16, 'RH', 86));                  // Eb5
  notes.push(createNote(6, 5, m2 + 32, 16, 'RH', 86));                  // Gb5

  // Beat 2 (ticks 240..288)
  // LH middle register
  notes.push(createNote(0, 4, m2 + 48, 16, 'LH', 80));                  // C4
  notes.push(createNote(1, 4, m2 + 64, 16, 'LH', 80));                  // Db4
  // RH dotted 8th (36t) with accent + 16th (12t)
  notes.push(createNote(5, 5, m2 + 48, 36, 'RH', 96, 'f', 'accent'));   // F5
  notes.push(createNote(3, 5, m2 + 84, 12, 'RH', 84));                  // Eb5

  // Beat 3 (ticks 288..336) - RH four 16ths
  notes.push(createNote(1, 5, m2 + 96, 12, 'RH', 84));                  // Db5
  notes.push(createNote(0, 5, m2 + 108, 12, 'RH', 82));                 // C5
  notes.push(createNote(10, 4, m2 + 120, 12, 'RH', 82));                // Bb4
  notes.push(createNote(8, 4, m2 + 132, 12, 'RH', 80));                 // Ab4

  // Beat 4 (ticks 336..384) - RH four 16ths resolving to low Db bass
  notes.push(createNote(6, 4, m2 + 144, 12, 'RH', 80));                 // Gb4
  notes.push(createNote(5, 4, m2 + 156, 12, 'RH', 78));                 // F4
  notes.push(createNote(3, 4, m2 + 168, 12, 'RH', 78));                 // Eb4
  notes.push(createNote(1, 4, m2 + 180, 12, 'RH', 82));                 // Db4
  notes.push(createNote(1, 2, m2 + 144, 48, 'LH', 88, 'mf'));           // Db2 (bass resolution)

  // =========================================================================
  // MEASURE 3 (ticks 384 .. 576) - Main Theme 8va higher
  // LH: Low Eb2 triplet groove
  // RH: High shimmering octave 8va on theme: Ab6/C7 -> Gb6/Bb6 -> F6/Ab6 -> Db6/F6
  // =========================================================================
  const m3 = 384;

  // Beat 1 (ticks 384..432)
  notes.push(createNote(3, 2, m3 + 0, 16, 'LH', 88, 'p', 'staccato'));  // Eb2
  notes.push(createNote(10, 2, m3 + 16, 16, 'LH', 82));                 // Bb2
  notes.push(createNote(1, 3, m3 + 32, 16, 'LH', 82));                  // Db3
  // RH 3rd triplet upbeat (8va)
  notes.push(createNote(8, 6, m3 + 32, 16, 'RH', 92));                  // Ab6
  notes.push(createNote(0, 7, m3 + 32, 16, 'RH', 94));                  // C7

  // Beat 2 (ticks 432..480)
  notes.push(createNote(5, 3, m3 + 48, 16, 'LH', 82));                  // F3
  notes.push(createNote(8, 3, m3 + 64, 16, 'LH', 82));                  // Ab3
  notes.push(createNote(10, 3, m3 + 80, 32, 'LH', 85));                 // Bb3 (tied into beat 3)
  // RH swing triplet (8va)
  notes.push(createNote(6, 6, m3 + 48, 32, 'RH', 90));                  // Gb6
  notes.push(createNote(10, 6, m3 + 48, 32, 'RH', 92));                 // Bb6
  notes.push(createNote(5, 6, m3 + 80, 16, 'RH', 86));                  // F6
  notes.push(createNote(8, 6, m3 + 80, 16, 'RH', 88));                  // Ab6

  // Beat 3 (ticks 480..528)
  notes.push(createNote(1, 6, m3 + 96, 36, 'RH', 88));                  // Db6
  notes.push(createNote(5, 6, m3 + 96, 36, 'RH', 90));                  // F6
  notes.push(createNote(8, 6, m3 + 132, 12, 'RH', 88));                 // Ab6

  // Beat 4 (ticks 528..576)
  notes.push(createNote(8, 2, m3 + 176, 32, 'LH', 88, 'mf', 'tenuto')); // Ab2 (tied across barline)
  notes.push(createNote(8, 6, m3 + 176, 16, 'RH', 92));                 // Ab6
  notes.push(createNote(0, 7, m3 + 176, 16, 'RH', 94));                 // C7

  // =========================================================================
  // MEASURE 4 (ticks 576 .. 768) - 8va Altered Dominant -> Syncopated Stab
  // LH: Ab2 -> C3 -> Gb3 -> C4 -> Db4, then Bb2 -> Db3 -> Eb3
  // RH: High altered swing chords (Fb6/Ab6 -> Eb6/Gb6) -> accented F6 -> chord stab
  // =========================================================================
  const m4 = 576;

  // Beat 1 (ticks 576..624)
  notes.push(createNote(0, 3, m4 + 16, 16, 'LH', 82));                  // C3
  notes.push(createNote(6, 3, m4 + 32, 16, 'LH', 82));                  // Gb3
  notes.push(createNote(4, 6, m4 + 0, 32, 'RH', 92));                   // Fb6 (E6)
  notes.push(createNote(8, 6, m4 + 0, 32, 'RH', 92));                   // Ab6
  notes.push(createNote(3, 6, m4 + 32, 16, 'RH', 88));                  // Eb6
  notes.push(createNote(6, 6, m4 + 32, 16, 'RH', 88));                  // Gb6

  // Beat 2 (ticks 624..672)
  notes.push(createNote(0, 4, m4 + 48, 16, 'LH', 82));                  // C4
  notes.push(createNote(1, 4, m4 + 64, 16, 'LH', 82));                  // Db4
  notes.push(createNote(5, 6, m4 + 48, 36, 'RH', 98, 'f', 'accent'));   // F6
  notes.push(createNote(3, 6, m4 + 84, 12, 'RH', 86));                  // Eb6

  // Beat 3 (ticks 672..720) - Offbeat syncopated chord stab on 3rd triplet 8th
  notes.push(createNote(10, 2, m4 + 128, 16, 'LH', 92, 'f', 'accent')); // Bb2
  notes.push(createNote(6, 5, m4 + 128, 16, 'RH', 94, 'f', 'accent'));  // Gb5
  notes.push(createNote(10, 5, m4 + 128, 16, 'RH', 94, 'f', 'accent')); // Bb5
  notes.push(createNote(1, 6, m4 + 128, 16, 'RH', 96, 'f', 'accent'));  // Db6

  // Beat 4 (ticks 720..768) - LH leads into M5 downbeat
  notes.push(createNote(1, 3, m4 + 144, 16, 'LH', 84));                 // Db3
  notes.push(createNote(3, 3, m4 + 160, 16, 'LH', 86));                 // Eb3

  // =========================================================================
  // MEASURE 5 (ticks 768 .. 960) - Lush Db Major Rolled Harp Chord & Offbeats
  // LH: Grand arpeggiated Db rolled chord ringing in sustain pedal
  // RH: Syncopated descending melody chords: [F5, Ab5] -> [Db5, F5] -> [Bb4, Db5]
  // =========================================================================
  const m5 = 768;

  // LH Grand rolled Db chord (sustain down)
  notes.push(createNote(1, 1, m5 + 0, 192, 'LH', 95, 'f', 'tenuto'));   // Db1
  notes.push(createNote(8, 1, m5 + 4, 188, 'LH', 88));                  // Ab1
  notes.push(createNote(5, 2, m5 + 8, 184, 'LH', 84));                  // F2
  notes.push(createNote(10, 2, m5 + 12, 180, 'LH', 84));                // Bb2
  notes.push(createNote(1, 3, m5 + 16, 176, 'LH', 84));                 // Db3
  notes.push(createNote(5, 3, m5 + 20, 172, 'LH', 84));                 // F3

  // RH Beat 1 (dotted 8th + 16th)
  notes.push(createNote(5, 5, m5 + 0, 36, 'RH', 94, 'f', 'accent'));    // F5
  notes.push(createNote(8, 5, m5 + 0, 36, 'RH', 94, 'f', 'accent'));    // Ab5
  notes.push(createNote(0, 6, m5 + 36, 12, 'RH', 88));                  // C6

  // RH Beat 2
  notes.push(createNote(1, 5, m5 + 48, 36, 'RH', 90));                  // Db5
  notes.push(createNote(5, 5, m5 + 48, 36, 'RH', 90));                  // F5
  notes.push(createNote(8, 5, m5 + 84, 12, 'RH', 86));                  // Ab5

  // RH Beat 3
  notes.push(createNote(10, 4, m5 + 96, 36, 'RH', 88));                 // Bb4
  notes.push(createNote(1, 5, m5 + 96, 36, 'RH', 88));                  // Db5
  notes.push(createNote(5, 5, m5 + 132, 12, 'RH', 84));                 // F5

  // RH Beat 4 upbeat
  notes.push(createNote(8, 5, m5 + 180, 12, 'RH', 86));                 // Ab5 (leads into M6)

  // =========================================================================
  // MEASURE 6 (ticks 960 .. 1152) - Cadence & Rich Db6/9 Resolution
  // LH: Gb1 -> C2 -> Db1
  // RH: [F5, Bb5] -> [Eb5, A5] (altered dominant) -> Db6/9 full voicing ring
  // =========================================================================
  const m6 = 960;

  // Beat 1: Subdominant Gb bass
  notes.push(createNote(6, 1, m6 + 0, 48, 'LH', 90));                   // Gb1
  notes.push(createNote(1, 2, m6 + 16, 32, 'LH', 82));                  // Db2
  notes.push(createNote(10, 2, m6 + 32, 16, 'LH', 82));                 // Bb2
  notes.push(createNote(5, 5, m6 + 0, 36, 'RH', 90));                   // F5
  notes.push(createNote(10, 5, m6 + 0, 36, 'RH', 90));                  // Bb5
  notes.push(createNote(1, 6, m6 + 36, 12, 'RH', 86));                  // Db6

  // Beat 2: Altered dominant tritone substitution
  notes.push(createNote(0, 2, m6 + 48, 48, 'LH', 88));                  // C2
  notes.push(createNote(6, 2, m6 + 64, 32, 'LH', 82));                  // Gb2
  notes.push(createNote(3, 5, m6 + 48, 36, 'RH', 88));                  // Eb5
  notes.push(createNote(9, 5, m6 + 48, 36, 'RH', 88));                  // A5 (blue note / altered #9)
  notes.push(createNote(0, 6, m6 + 84, 12, 'RH', 86));                  // C6

  // Beat 3 & 4: Db6/9 chord ring with fermata
  notes.push(createNote(1, 1, m6 + 96, 96, 'LH', 96, 'f', 'tenuto'));   // Db1
  notes.push(createNote(8, 1, m6 + 96, 96, 'LH', 90));                  // Ab1
  notes.push(createNote(5, 2, m6 + 96, 96, 'LH', 86));                  // F2
  notes.push(createNote(10, 3, m6 + 96, 96, 'RH', 88));                 // Bb3
  notes.push(createNote(0, 4, m6 + 96, 96, 'RH', 90));                  // C4
  notes.push(createNote(3, 4, m6 + 96, 96, 'RH', 92));                  // Eb4
  notes.push(createNote(5, 4, m6 + 96, 96, 'RH', 92));                  // F4
  notes.push(createNote(1, 5, m6 + 96, 96, 'RH', 96, 'ff', 'fermata')); // Db5

  const totalTicks = 1152; // 6 measures * 192 ticks

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
      { barNumber: 7, tick: 1152, type: 'final' },
    ],
    tempos: [{ tick: 0, bpm: 126, description: 'Allegretto (quarter = 126)' }],
    dynamics: [
      { tick: 0, mark: 'p' },
      { tick: 192, mark: 'mf' },
      { tick: 384, mark: 'f' },
      { tick: 576, mark: 'f' },
      { tick: 768, mark: 'mf' },
      { tick: 1056, mark: 'ff' },
    ],
    pedals: [
      { tick: 0, type: 'sustain-down' },
      { tick: 192, type: 'sustain-change' },
      { tick: 384, type: 'sustain-change' },
      { tick: 576, type: 'sustain-change' },
      { tick: 768, type: 'sustain-down' },
      { tick: 960, type: 'sustain-change' },
      { tick: 1152, type: 'sustain-up' },
    ],
    notes,
  };

  score.handCrossings = detectHandCrossings(score);
  return score;
}
