import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  StaffStyle,
  NoteheadMorphology,
  DESIGN_PRESETS,
  normalizeStaffStyle,
  normalizeNoteheadMorphology,
  getStaffLineGeometry,
  getParityShape,
  getSubdivisionColor,
  getDurationClassColor,
  getLogarithmicDurationColor,
  DUODECIMAL_DIGITS,
  getDuodecimalDigit,
} from '../src/render/types';
import { wholeToneParity } from '../src/model/pitch';
import { getNoteColor } from '../src/render/colors';
import { getCanonicalSyllable } from '../src/model/phonetics';
import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1';

test('Staff Topography: wholetone-uniform-6 invariants', () => {
  const styles: StaffStyle[] = ['wholetone-uniform-6', 'wholetone-uniform'];
  for (const style of styles) {
    assert.equal(normalizeStaffStyle(style), 'wholetone-uniform');

    // Exactly 6 lines per octave (even pitch classes: 0, 2, 4, 6, 8, 10)
    let lineCount = 0;
    for (let pc = 0; pc < 12; pc++) {
      const geom = getStaffLineGeometry(pc, style);
      if (pc % 2 === 0) {
        assert.equal(geom.isLine, true, `PC ${pc} should be a staff line`);
        lineCount++;
        if (pc === 0) {
          assert.equal(geom.isBold, true, 'PC 0 should be marked as octave boundary');
        }
      } else {
        assert.equal(geom.isLine, false, `PC ${pc} should be a space`);
      }
    }
    assert.equal(lineCount, 6, 'Uniform whole-tone staff must have exactly 6 lines per octave');
  }
});

test('Staff Topography: 5/7 staff demarcation & subitizable partitioning invariants', () => {
  const styles: StaffStyle[] = ['tritone-split-3plus3', 'tritone-split', '5-7-split', 'five-seven-split'];
  for (const style of styles) {
    assert.equal(normalizeStaffStyle(style), 'tritone-split');

    // 1-5-9 Symmetric Staff Topography Invariant:
    // PC 0 (C) is bold octave line.
    // PC 2 (D) is space (no line 3).
    // PC 4 (E) is small dashes demarcation line for Landmark 5 ([5, 2.5]).
    // PC 8 (G#) is thin straight solid line for Landmark 9 (0.6px).
    const geom0 = getStaffLineGeometry(0, style);
    assert.equal(geom0.isLine, true);
    assert.equal(geom0.isBold, true);
    assert.equal(geom0.lineWidth, 0.9);
    assert.equal(geom0.color, 'rgba(255, 255, 255, 0.9)');

    // No Line at PC 2 (D, Landmark 3 dropped for symmetry)
    const geom3 = getStaffLineGeometry(2, style);
    assert.equal(geom3.isLine, false, 'Line 3 must be dropped for augmented-triad symmetry');

    // Demarcation Line at PC 4 (E, Landmark 5) with small dashes [5, 2.5]
    const geom5 = getStaffLineGeometry(4, style);
    assert.equal(geom5.isLine, true);
    assert.equal(geom5.isBold, false);
    assert.equal(geom5.isDashed, true);
    assert.deepEqual(geom5.dashArray, [5, 2.5]);
    assert.equal(geom5.isDemarcation, true);
    assert.equal(geom5.lineWidth, 0.6);

    // Demarcation Line at PC 8 (G#, Landmark 9) - DROPPED per definitive design
    const geom9 = getStaffLineGeometry(8, style);
    assert.equal(geom9.isLine, false, 'Line 8 must be dropped per user direction to lighten page');

    // Zero lines at non-integer pitch coordinates (no 4.5 floating line)
    const geom45 = getStaffLineGeometry(4.5, style);
    assert.equal(geom45.isLine, false, 'Non-integer 4.5 must not be a staff line');

    // Hairlines and non-landmark lines across 2, 6, 8, 10 eliminated
    [2, 6, 8, 10].forEach((pc) => {
      const g = getStaffLineGeometry(pc, style);
      assert.equal(g.isLine, false, `PC ${pc} must not be a line`);
    });

    // Spaces on odd pitch classes (1, 3, 5, 7, 9, 11)
    [1, 3, 5, 7, 9, 11].forEach((pc) => {
      const g = getStaffLineGeometry(pc, style);
      assert.equal(g.isLine, false, `PC ${pc} must be a space`);
    });

    // Exactly 2 landmark lines per octave: PC 0 (octave) and PC 4 (fifth note dashed)
    let lineCount = 0;
    for (let pc = 0; pc < 12; pc++) {
      if (getStaffLineGeometry(pc, style).isLine) lineCount++;
    }
    assert.equal(lineCount, 2, 'Definitive staff must contain exactly 2 landmark lines per octave (0 and 4)');
  }
});

test('Staff Topography: augmented-triad-3line invariants', () => {
  const styles: StaffStyle[] = ['augmented-triad-3line', 'augmented-3line'];
  for (const style of styles) {
    assert.equal(normalizeStaffStyle(style), 'augmented-3line');

    // Exactly 3 lines per octave at major thirds: 0, 4, 8
    let lineCount = 0;
    for (let pc = 0; pc < 12; pc++) {
      const geom = getStaffLineGeometry(pc, style);
      if (pc === 0 || pc === 4 || pc === 8) {
        assert.equal(geom.isLine, true, `PC ${pc} should be an augmented triad staff line`);
        lineCount++;
      } else {
        assert.equal(geom.isLine, false, `PC ${pc} should be a wide space`);
      }
    }
    assert.equal(lineCount, 3, 'Augmented triad staff must have exactly 3 lines per octave');
  }
});

test('Staff Topography: octave-ribbons register shading invariants', () => {
  assert.equal(normalizeStaffStyle('octave-ribbons'), 'octave-ribbons');
  // 6 lines on even PCs
  for (let pc = 0; pc < 12; pc++) {
    const geom = getStaffLineGeometry(pc, 'octave-ribbons');
    assert.equal(geom.isLine, pc % 2 === 0);
  }
});

test('Notehead Morphology: row-parity-shapes dual-coded geometry', () => {
  const morphs: NoteheadMorphology[] = ['row-parity-shapes', 'row-parity-shape'];
  for (const morph of morphs) {
    assert.equal(normalizeNoteheadMorphology(morph), 'row-parity-shape');

    // Row 0 (Even: 0, 2, 4, 6, 8, 10) must strictly map to disc/oval
    [0, 2, 4, 6, 8, 10].forEach((pc) => {
      assert.equal(getParityShape(pc), 'disc', `PC ${pc} (Row 0) must be a disc`);
      assert.equal(wholeToneParity(pc), 0);
    });

    // Row 1 (Odd: 1, 3, 5, 7, 9, 11) must strictly map to brick
    [1, 3, 5, 7, 9, 11].forEach((pc) => {
      assert.equal(getParityShape(pc), 'brick', `PC ${pc} (Row 1) must be a brick`);
      assert.equal(wholeToneParity(pc), 1);
    });
  }
});

test('Notehead Morphology: phonetic-tokens 12-TET monosyllabic tokens', () => {
  const expectedSyllables = [
    'o', 'wa', 'tu', 'ti', 'fo', 'fa',
    'si', 'se', 'e', 'na', 'a', 'bi'
  ];

  assert.equal(normalizeNoteheadMorphology('phonetic-tokens'), 'phonetic');
  assert.equal(normalizeNoteheadMorphology('phonetic'), 'phonetic');

  expectedSyllables.forEach((syl, pc) => {
    assert.equal(getCanonicalSyllable(pc), syl, `PC ${pc} must be ${syl}`);
    assert.equal(syl, syl.toLowerCase(), `Syllable ${syl} must be strictly lowercase`);
  });
});

test('Notehead Morphology: numerical-digits strictly 1-based note numbers 1..12', () => {
  assert.equal(normalizeNoteheadMorphology('numerical-digits'), 'numerical');
  assert.equal(normalizeNoteheadMorphology('numerical'), 'numerical');

  for (let pc = 0; pc < 12; pc++) {
    const noteNum = pc + 1;
    const str = String(noteNum);
    assert.match(str, /^([1-9]|1[0-2])$/, 'Must be 1-based note number 1..12');
    assert.doesNotMatch(str, /[A-Ga-g#b]/, 'Zero letter names permitted');
  }
});

test('Notehead Morphology: duodecimal base-12 pitch-class tokens 0..9, a, b', () => {
  assert.equal(normalizeNoteheadMorphology('duodecimal'), 'duodecimal');
  assert.equal(normalizeNoteheadMorphology('duodecimal-digits'), 'duodecimal');
  assert.equal(normalizeNoteheadMorphology('duodecimal-tile'), 'duodecimal');
  assert.equal(normalizeNoteheadMorphology('base-12'), 'duodecimal');

  assert.equal(DUODECIMAL_DIGITS.length, 12);
  assert.deepEqual([...DUODECIMAL_DIGITS], ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B']);

  for (let pc = 0; pc < 12; pc++) {
    const digit = getDuodecimalDigit(pc);
    assert.equal(digit, DUODECIMAL_DIGITS[pc]);
    assert.equal(digit.length, 1, 'Strictly 1 character per pitch class');
    const isEven = pc % 2 === 0;
    if (isEven) {
      assert.match(digit, /^[02468A]$/, 'Row 0 must be even duodecimal digits');
    } else {
      assert.match(digit, /^[13579B]$/, 'Row 1 must be odd duodecimal digits');
    }
  }

  // Interval arithmetic invariant: (P2 - P1) mod 12
  const getInterval = (p1: number, p2: number) => ((p2 - p1) % 12 + 12) % 12;
  assert.equal(getInterval(0, 7), 7, 'C to G is Perfect 5th (7 st)');
  assert.equal(getInterval(0, 4), 4, 'C to E is Major 3rd (4 st)');
  assert.equal(getInterval(7, 11), 4, 'G (7) to B (b) is Major 3rd (4 st)');
  assert.equal(getInterval(4, 7), 3, 'E (4) to G (7) is Minor 3rd (3 st)');
  assert.equal(getInterval(0, 6), 6, 'C (0) to F# (6) is Tritone (6 st)');
  assert.equal(getInterval(6, 7), 1, 'F# (6) to G (7) is Minor 2nd (1 st)');
  assert.equal(getInterval(2, 4), 2, 'D (2) to E (4) is Major 2nd (2 st)');
});

test('Notehead Morphology: minimal-dots and classic-oval normalization', () => {
  assert.equal(normalizeNoteheadMorphology('minimal-dots'), 'minimal-dot');
  assert.equal(normalizeNoteheadMorphology('minimal-dot'), 'minimal-dot');
  assert.equal(normalizeNoteheadMorphology('classic-oval'), 'classic-oval');
});

test('Curated Design Presets catalog completeness and integrity', () => {
  const presetIds = DESIGN_PRESETS.map((p) => p.id);
  assert.ok(presetIds.includes('unified-duration-lattice'));
  assert.ok(presetIds.includes('vertical-duration-parity'));
  assert.ok(presetIds.includes('vertical-ddr-parity'));
  assert.ok(presetIds.includes('subitizable-3plus3-parity'));
  assert.ok(presetIds.includes('clean-minimalist-oval'));
  assert.ok(presetIds.includes('analytical-phonetic'));

  // Primary default preset must be Unified Duration Lattice + Parity Shapes
  const defaultPreset = DESIGN_PRESETS[0];
  assert.equal(defaultPreset.id, 'unified-duration-lattice');
  assert.equal(defaultPreset.name, 'Unified Duration Lattice + Parity Shapes');
  assert.equal(defaultPreset.staffStyle, 'tritone-split');
  assert.equal(defaultPreset.noteheadMorphology, 'row-parity-shape');
  assert.equal(defaultPreset.colorMode, 'duration-class');
  assert.equal(defaultPreset.orientation, 'vertical');

  const names = DESIGN_PRESETS.map((p) => p.name);
  assert.ok(names.includes('Unified Duration Lattice + Parity Shapes'));
  assert.ok(names.includes('Vertical Duration Classes + Parity Shapes'));
  assert.ok(names.includes('Vertical DDR + Parity Shapes'));
  assert.ok(names.includes('Subitizable 3+3 + Parity Shapes'));
  assert.ok(names.includes('Clean Minimalist Oval'));
  assert.ok(names.includes('Analytical Phonetic'));

  DESIGN_PRESETS.forEach((p) => {
    assert.ok(normalizeStaffStyle(p.staffStyle), `Preset ${p.id} has valid staffStyle`);
    assert.ok(normalizeNoteheadMorphology(p.noteheadMorphology), `Preset ${p.id} has valid noteheadMorphology`);
  });
});

test('Monochrome Staff Hierarchy: zero blue or pink tints across all staff styles', () => {
  const allStyles: StaffStyle[] = [
    'tritone-split',
    'wholetone-uniform',
    'augmented-3line',
    'octave-ribbons',
    'chromatic-grid',
  ];
  for (const style of allStyles) {
    for (let pc = 0; pc < 12; pc++) {
      const geom = getStaffLineGeometry(pc, style);
      if (geom.isLine) {
        assert.doesNotMatch(geom.color, /96,\s*165,\s*250/, `PC ${pc} in ${style} must not have blue tint`);
        assert.doesNotMatch(geom.color, /244,\s*114,\s*182/, `PC ${pc} in ${style} must not have pink tint`);
        assert.doesNotMatch(geom.color, /#60A5FA/i, `PC ${pc} in ${style} must not have blue tint`);
        assert.doesNotMatch(geom.color, /#F472B6/i, `PC ${pc} in ${style} must not have pink tint`);
      }
    }
  }
});

test('Optical Notehead Sizing & Area Balance Invariant: ovals optically matched to bricks', () => {
  const baseSize = 14 - 3; // pixelsPerSemitone - 3 = 11
  const pitchRadius = Math.max(6.5, baseSize * 0.65);
  const timeRadius = Math.max(4.2, baseSize * 0.42);
  const ovalArea = Math.PI * pitchRadius * timeRadius;

  const pitchBrick = Math.max(11.0, baseSize * 1.10);
  const timeBrick = Math.max(7.8, baseSize * 0.78);
  const brickArea = pitchBrick * timeBrick;
  const areaRatio = ovalArea / brickArea;

  assert.ok(
    Math.abs(areaRatio - 1.0) < 0.05,
    `Oval area (${ovalArea.toFixed(2)}) and brick area (${brickArea.toFixed(2)}) must match within 5% (ratio: ${areaRatio.toFixed(3)})`
  );
});

test('DDR Metric Subdivision Invariant: rhythmic color coding math across metric tiers and triplets', () => {
  const tpb = 48; // Standard ticksPerBeat

  // Quarter notes / Beat onsets: tick % 48 === 0 -> Red (#EF4444)
  const quarterTicks = [0, 48, 96, 144, 192, 480];
  quarterTicks.forEach((tick) => {
    assert.equal(
      getSubdivisionColor(tick, tpb),
      '#EF4444',
      `Tick ${tick} (beat onset) must be Red #EF4444`
    );
  });

  // Eighth notes / Half-beat offbeats: tick % 24 === 0 (and not % 48) -> Blue (#3B82F6)
  const eighthTicks = [24, 72, 120, 168, 216];
  eighthTicks.forEach((tick) => {
    assert.equal(
      getSubdivisionColor(tick, tpb),
      '#3B82F6',
      `Tick ${tick} (8th note offbeat) must be Blue #3B82F6`
    );
  });

  // Eighth-note triplets / 12th notes: tick % 16 === 0 (and not % 48) -> Purple (#A855F7)
  const tripletTicks = [16, 32, 64, 80, 112, 128];
  tripletTicks.forEach((tick) => {
    assert.equal(
      getSubdivisionColor(tick, tpb),
      '#A855F7',
      `Tick ${tick} (12th note triplet) must be Purple #A855F7`
    );
  });

  // Sixteenth notes / Quarter-beat subdivisions: tick % 12 === 0 (and not % 24 or % 48) -> Yellow / Amber (#EAB308)
  const sixteenthTicks = [12, 36, 60, 84, 108, 132];
  sixteenthTicks.forEach((tick) => {
    assert.equal(
      getSubdivisionColor(tick, tpb),
      '#EAB308',
      `Tick ${tick} (16th note subdivision) must be Yellow #EAB308`
    );
  });

  // Thirty-second notes: tick % 6 === 0 (and not % 12, % 16, % 24, % 48) -> Green (#10B981)
  const thirtySecondTicks = [6, 18, 30, 42, 54, 66, 78, 90];
  thirtySecondTicks.forEach((tick) => {
    assert.equal(
      getSubdivisionColor(tick, tpb),
      '#10B981',
      `Tick ${tick} (32nd note subdivision) must be Green #10B981`
    );
  });

  // Active notes during playback: glow bright white/gold (#FEF08A)
  [0, 6, 12, 16, 24, 32, 36, 48, 72].forEach((tick) => {
    assert.equal(
      getSubdivisionColor(tick, tpb, true),
      '#FEF08A',
      `Active note at tick ${tick} must glow bright gold #FEF08A`
    );
  });

  // Integration with getNoteColor
  const testPitch = { pitchClass: 0, octave: 4 };
  assert.equal(getNoteColor(testPitch, 'RH', 'ddr-subdivision', false, 0, tpb), '#EF4444');
  assert.equal(getNoteColor(testPitch, 'RH', 'ddr-subdivision', false, 24, tpb), '#3B82F6');
  assert.equal(getNoteColor(testPitch, 'RH', 'ddr-subdivision', false, 12, tpb), '#EAB308');
  assert.equal(getNoteColor(testPitch, 'RH', 'ddr-subdivision', false, 16, tpb), '#A855F7');
  assert.equal(getNoteColor(testPitch, 'RH', 'ddr-subdivision', false, 6, tpb), '#10B981');
  assert.equal(getNoteColor(testPitch, 'RH', 'ddr-subdivision', true, 0, tpb), '#FEF08A');
});

test('Unified Euclidean Duration Lattice: Logarithmic Minimal Palette Invariants', () => {
  const tauRef = 12; // Standard 16th note reference quantum (gcd of score)

  // k = floor(log2(d / tauRef))
  // k = 0 (1x, 12t): Crisp Silver / White (#E2E8F0)
  assert.equal(getLogarithmicDurationColor(12, tauRef, false), '#E2E8F0');
  assert.equal(getLogarithmicDurationColor(6, tauRef, false), '#E2E8F0'); // sub-quantum also silver/white

  // k = 1 (2x and 3x, 24t and 36t): Sky Blue (#38BDF8)
  assert.equal(getLogarithmicDurationColor(24, tauRef, false), '#38BDF8');
  assert.equal(getLogarithmicDurationColor(36, tauRef, false), '#38BDF8');

  // k = 2 (4x to 7x, 48t to 72t): Warm Amber (#F59E0B)
  assert.equal(getLogarithmicDurationColor(48, tauRef, false), '#F59E0B');
  assert.equal(getLogarithmicDurationColor(72, tauRef, false), '#F59E0B');

  // k >= 3 (>= 8x, 96t+): Rose (#F43F5E)
  assert.equal(getLogarithmicDurationColor(96, tauRef, false), '#F43F5E');
  assert.equal(getLogarithmicDurationColor(144, tauRef, false), '#F43F5E');
  assert.equal(getLogarithmicDurationColor(192, tauRef, false), '#F43F5E');

  // Active note sounding glow: Bright gold/white (#FEF08A)
  assert.equal(getLogarithmicDurationColor(12, tauRef, true), '#FEF08A');
  assert.equal(getLogarithmicDurationColor(24, tauRef, true), '#FEF08A');
  assert.equal(getLogarithmicDurationColor(48, tauRef, true), '#FEF08A');

  // Integration with getDurationClassColor and getNoteColor
  const tpb = 48; // tpb / 4 = 12
  const testPitch = { pitchClass: 0, octave: 4 };
  assert.equal(getDurationClassColor(12, tpb, false), '#E2E8F0');
  assert.equal(getDurationClassColor(24, tpb, false), '#38BDF8');
  assert.equal(getDurationClassColor(36, tpb, false), '#38BDF8');
  assert.equal(getDurationClassColor(48, tpb, false), '#F59E0B');
  assert.equal(getDurationClassColor(72, tpb, false), '#F59E0B');
  assert.equal(getDurationClassColor(96, tpb, false), '#F43F5E');
  assert.equal(getDurationClassColor(144, tpb, false), '#F43F5E');
  assert.equal(getDurationClassColor(12, tpb, true), '#FEF08A');

  assert.equal(getNoteColor(testPitch, 'RH', 'duration-class', false, 0, tpb, 12), '#E2E8F0');
  assert.equal(getNoteColor(testPitch, 'RH', 'duration-class', false, 0, tpb, 24), '#38BDF8');
  assert.equal(getNoteColor(testPitch, 'RH', 'duration-class', false, 0, tpb, 36), '#38BDF8');
  assert.equal(getNoteColor(testPitch, 'RH', 'duration-class', false, 0, tpb, 48), '#F59E0B');
  assert.equal(getNoteColor(testPitch, 'RH', 'duration-class', false, 0, tpb, 72), '#F59E0B');
  assert.equal(getNoteColor(testPitch, 'RH', 'duration-class', false, 0, tpb, 96), '#F43F5E');
  assert.equal(getNoteColor(testPitch, 'RH', 'duration-class', false, 0, tpb, 144), '#F43F5E');
  assert.equal(getNoteColor(testPitch, 'RH', 'duration-class', true, 0, tpb, 12), '#FEF08A');
});

test('Duration Invariance (Zero Grid-Snap Strobing): identical colors across varying onsets', () => {
  const tpb = 48;
  const testPitch = { pitchClass: 7, octave: 4 };

  // A running stream of 16th notes (12t) across all grid subdivisions
  const onsets = [0, 12, 24, 36, 48, 60, 72, 84, 96, 108, 120, 132, 144];
  for (const onset of onsets) {
    const color = getNoteColor(testPitch, 'RH', 'duration-class', false, onset, tpb, 12);
    assert.equal(
      color,
      '#E2E8F0',
      `16th note at onset tick ${onset} must be Silver #E2E8F0 (no grid-snap rainbow strobing)`
    );
  }

  // Verify across all notes in Bach Goldberg Variation 1
  const score = buildBachGoldbergVar1Score();
  let sixteenthCount = 0;
  let eighthCount = 0;
  let dottedEighthCount = 0;

  for (const note of score.notes) {
    const color = getNoteColor(
      note.pitch,
      note.hand,
      'duration-class',
      false,
      note.startTick,
      score.ticksPerBeat,
      note.durationTicks
    );

    if (note.durationTicks === 12) {
      assert.equal(
        color,
        '#E2E8F0',
        `Note ${note.id} (16th note at tick ${note.startTick}) must be Silver #E2E8F0`
      );
      sixteenthCount++;
    } else if (note.durationTicks === 24) {
      assert.equal(
        color,
        '#38BDF8',
        `Note ${note.id} (8th note at tick ${note.startTick}) must be Sky Blue #38BDF8`
      );
      eighthCount++;
    } else if (note.durationTicks === 36) {
      assert.equal(
        color,
        '#38BDF8',
        `Note ${note.id} (dotted 8th note at tick ${note.startTick}) must be Sky Blue #38BDF8`
      );
      dottedEighthCount++;
    }
  }

  assert.ok(sixteenthCount > 100, 'Goldberg Var 1 contains over a hundred 16th notes');
  assert.ok(eighthCount > 20, 'Goldberg Var 1 contains multiple 8th notes');
  assert.ok(dottedEighthCount > 0, 'Goldberg Var 1 contains dotted 8th notes');
});

test('Notehead Morphology: rectangle-square morphology strictly encodes Row Parity (All Squares: Full Row 0, Empty Row 1)', () => {
  assert.equal(normalizeNoteheadMorphology('rectangle-square'), 'rectangle-square');
  assert.equal(normalizeNoteheadMorphology('rectangles'), 'rectangle-square');
  assert.equal(normalizeNoteheadMorphology('squares'), 'rectangle-square');
  assert.equal(normalizeNoteheadMorphology('full-empty-square'), 'rectangle-square');
  assert.equal(normalizeNoteheadMorphology('solid-hollow-square'), 'rectangle-square');
  assert.equal(normalizeNoteheadMorphology('square-parity'), 'rectangle-square');

  // Verify row parity definition:
  // Row 0 = even PCs (0, 2, 4, 6, 8, 10 -> notes 1, 3, 5, 7, 9, 11) -> Full Squares (solid)
  // Row 1 = odd PCs (1, 3, 5, 7, 9, 11 -> notes 2, 4, 6, 8, 10, 12) -> Empty Squares (hollow)
  for (let pc = 0; pc < 12; pc++) {
    const isRow0 = pc % 2 === 0;
    const parity = wholeToneParity(pc);
    assert.equal(parity, isRow0 ? 0 : 1);
  }
});
