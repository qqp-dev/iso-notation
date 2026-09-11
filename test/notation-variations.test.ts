import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  StaffStyle,
  NoteheadMorphology,
  ColorMode,
  DESIGN_PRESETS,
  normalizeStaffStyle,
  normalizeNoteheadMorphology,
  getStaffLineGeometry,
  getParityShape,
  getSubdivisionColor,
  getDurationClassColor,
  getLogarithmicDurationColor,
  RenderOptions,
  DUODECIMAL_DIGITS,
  getDuodecimalDigit,
} from '../src/render/types';
import { QuantizedNote, QuantizedGridScore } from '../src/model/types';
import { wholeToneParity, linearIndex } from '../src/model/pitch';
import { getNoteColor } from '../src/render/colors';
import { getCanonicalSyllable } from '../src/model/phonetics';
import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1';
import { calculateScoreDimensions, renderScoreToCanvas } from '../src/render/score-canvas';
import { renderColumnarScoreToSvg, computeColumnarLayout, renderAllPagesToSvg } from '../src/render/print-layout';

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
    assert.equal(geom0.lineWidth, 1.2);
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
    'ma', 'di', 'va', 'pi', 'la', 'ri',
    'na', 'ti', 'fa', 'bi', 'sa', 'ki'
  ];

  assert.equal(normalizeNoteheadMorphology('phonetic-tokens'), 'phonetic');
  assert.equal(normalizeNoteheadMorphology('phonetic'), 'phonetic');

  expectedSyllables.forEach((syl, pc) => {
    assert.equal(getCanonicalSyllable(pc), syl, `PC ${pc} must be ${syl}`);
    assert.equal(syl, syl.toLowerCase(), `Syllable ${syl} must be strictly lowercase`);
  });
});

test('Notehead Morphology: Canvas rendering of phonetic tokens uses strictly lowercase syllables', () => {
  const score = buildBachGoldbergVar1Score();
  const fills: { text: string; fillStyle: string; font: string }[] = [];
  let currentFillStyle = '';
  let currentFont = '';
  const mockCtx = {
    set fillStyle(val: string) { currentFillStyle = val; },
    get fillStyle() { return currentFillStyle; },
    set font(val: string) { currentFont = val; },
    get font() { return currentFont; },
    strokeStyle: '',
    lineWidth: 1,
    textAlign: '',
    textBaseline: '',
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    fill: () => {},
    fillRect: () => {},
    arc: () => {},
    ellipse: () => {},
    roundRect: () => {},
    fillText: (text: string) => {
      fills.push({ text, fillStyle: currentFillStyle, font: currentFont });
    },
    setLineDash: () => {},
  } as unknown as CanvasRenderingContext2D;

  renderScoreToCanvas(mockCtx, score, {
    orientation: 'vertical',
    staffStyle: '5-7-split',
    noteheadMorphology: 'phonetic',
    colorMode: 'duration-class',
    zoom: 1.0,
    pixelsPerTick: 2.0,
    pixelsPerSemitone: 14,
    showHandCrossings: false,
    showBarlines: false,
    showGridLines: true,
    currentTick: 0,
  });

  const validLowerSyllables = new Set(['ma', 'di', 'va', 'pi', 'la', 'ri', 'na', 'ti', 'fa', 'bi', 'sa', 'ki']);
  const renderedSyllables = fills.filter((f) => validLowerSyllables.has(f.text));
  assert.ok(renderedSyllables.length > 0, 'Must render phonetic tokens for notes');

  // Verify zero uppercase syllables rendered anywhere
  const uppercaseSyllables = ['Ma', 'Di', 'Va', 'Pi', 'La', 'Ri', 'Na', 'Ti', 'Fa', 'Bi', 'Sa', 'Ki'];
  for (const upper of uppercaseSyllables) {
    assert.ok(
      !fills.some((f) => f.text === upper),
      `Must not render uppercase syllable ${upper}`
    );
  }
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
  assert.deepEqual([...DUODECIMAL_DIGITS], ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b']);

  for (let pc = 0; pc < 12; pc++) {
    const digit = getDuodecimalDigit(pc);
    assert.equal(digit, DUODECIMAL_DIGITS[pc]);
    assert.equal(digit.length, 1, 'Strictly 1 character per pitch class');
    const isEven = pc % 2 === 0;
    if (isEven) {
      assert.match(digit, /^[02468a]$/, 'Row 0 must be even duodecimal digits');
    } else {
      assert.match(digit, /^[13579b]$/, 'Row 1 must be odd duodecimal digits');
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

  // SVG rendering test: duodecimal tokens in print layout
  const score = buildBachGoldbergVar1Score();
  const svg = renderColumnarScoreToSvg(score, 0, { noteheadMorphology: 'duodecimal' });
  assert.match(svg, />[0-9ab]<\/text>/, 'SVG must render duodecimal text tokens');
  // Check specifically for digits 7, 6, 2, 4, 9, b from mm. 1-4
  assert.match(svg, />7<\/text>/, 'Must render G as 7');
  assert.match(svg, />6<\/text>/, 'Must render F# as 6');
  assert.match(svg, />b<\/text>/, 'Must render B as b');
  assert.match(svg, />2<\/text>/, 'Must render D as 2');
  assert.match(svg, />4<\/text>/, 'Must render E as 4');

  // Standalone naked digits invariant:
  // Must render circular knockouts (r="4.20") and zero enclosing background tile rectangles
  assert.match(svg, /<circle cx="[0-9.]+" cy="[0-9.]+" r="4\.20" fill="#FFFFFF"\/>/, 'Must render circular line knockout');
  assert.doesNotMatch(svg, /<rect[^>]*rx="1\.5"[^>]*fill=/, 'Zero background box tiles around noteheads');

  // Broad-nib calligraphic chevrons for hand-crossing exceptions:
  // Measure 4 has RH crossing into bass (< 48) -> bold downstroke (1.15pt) upper arm and hairline (0.50pt) lower arm pointing right
  const rhUpperRegex = /<path d="M ([0-9.]+) ([0-9.]+) L ([0-9.]+) ([0-9.]+)" fill="none" stroke="([^"]+)" stroke-width="1\.15" stroke-linecap="round"\/>/g;
  const rhLowerRegex = /<path d="M ([0-9.]+) ([0-9.]+) L ([0-9.]+) ([0-9.]+)" fill="none" stroke="([^"]+)" stroke-width="0\.50" stroke-linecap="round"\/>/g;
  const rhUpperMatches = Array.from(svg.matchAll(rhUpperRegex));
  const rhLowerMatches = Array.from(svg.matchAll(rhLowerRegex));
  assert.ok(rhUpperMatches.length > 0, 'Must render broad-nib calligraphic upper downstroke (1.15pt) for RH');
  assert.ok(rhLowerMatches.length > 0, 'Must render broad-nib calligraphic lower hairline (0.50pt) for RH');

  const rhChevrons = rhUpperMatches.filter((m) => parseFloat(m[3]) > parseFloat(m[1]));
  assert.ok(rhChevrons.length > 0, 'RH crossing exceptions must have apex pointing right (apexX > baseX)');
  rhChevrons.forEach((m) => {
    const baseX = parseFloat(m[1]);
    const apexX = parseFloat(m[3]);
    assert.ok(apexX > baseX, 'RH chevron must point right');
  });

  // Page 4 contains measure 30 with LH crossing into treble (> 48) -> hairline (0.50pt) upper arm and bold downstroke (1.15pt) lower arm pointing left
  const page4Svg = renderColumnarScoreToSvg(score, 3, { noteheadMorphology: 'duodecimal' });
  const lhUpperMatches = Array.from(page4Svg.matchAll(rhLowerRegex)); // 0.50pt is upper arm for LH
  const lhLowerMatches = Array.from(page4Svg.matchAll(rhUpperRegex)); // 1.15pt is lower arm for LH
  const lhChevrons = lhUpperMatches.filter((m) => parseFloat(m[3]) < parseFloat(m[1]));
  assert.ok(lhChevrons.length > 0, 'LH crossing exceptions must have apex pointing left (apexX < baseX)');
  assert.ok(lhLowerMatches.length > 0, 'LH must have bold lower downstroke (1.15pt)');
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

test('Monochrome margin labels: pure grayscale with zero blue or pink tints', () => {
  const score = buildBachGoldbergVar1Score();
  const recordedFills: { text: string; fillStyle: string }[] = [];

  const mockCtx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    fill: () => {},
    fillRect: () => {},
    arc: () => {},
    ellipse: () => {},
    roundRect: () => {},
    fillText: (text: string) => {
      recordedFills.push({ text, fillStyle: String(mockCtx.fillStyle) });
    },
    setLineDash: () => {},
  } as unknown as CanvasRenderingContext2D;

  renderScoreToCanvas(mockCtx, score, {
    orientation: 'horizontal',
    staffStyle: 'tritone-split',
    noteheadMorphology: 'row-parity-shape',
    colorMode: 'monochrome',
    zoom: 1.0,
    pixelsPerTick: 2.0,
    pixelsPerSemitone: 14,
    showHandCrossings: false,
    showBarlines: false,
    showGridLines: true,
    currentTick: 0,
  });

  // Verify pitch coordinate labels (e.g. "m4", "6:4", "2:4")
  const marginLabels = recordedFills.filter((r) => /^m\d+$/.test(r.text) || /^\d+:\d+$/.test(r.text));
  assert.ok(marginLabels.length > 0, 'Must have rendered margin labels');

  marginLabels.forEach(({ text, fillStyle }) => {
    const isOctaveBoundary = /^m\d+$/.test(text);
    assert.doesNotMatch(fillStyle, /#60A5FA/i, `Margin label ${text} must not be blue`);
    assert.doesNotMatch(fillStyle, /#F472B6/i, `Margin label ${text} must not be pink`);
    if (isOctaveBoundary) {
      assert.equal(fillStyle, '#FFFFFF', `Octave boundary margin label must be #FFFFFF`);
    } else {
      assert.equal(fillStyle, '#666666', `Other PC margin label must be #666666`);
    }
  });
});

test('Lowercase \'m\' Octave Marker Invariant: score canvas margin indicators', () => {
  const score = buildBachGoldbergVar1Score();

  const createMockCtx = () => {
    const fills: { text: string; fillStyle: string; font: string }[] = [];
    let currentFillStyle = '';
    let currentFont = '';
    const ctx = {
      set fillStyle(val: string) { currentFillStyle = val; },
      get fillStyle() { return currentFillStyle; },
      set font(val: string) { currentFont = val; },
      get font() { return currentFont; },
      strokeStyle: '',
      lineWidth: 1,
      textAlign: '',
      textBaseline: '',
      save: () => {},
      restore: () => {},
      beginPath: () => {},
      closePath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      fill: () => {},
      fillRect: () => {},
      arc: () => {},
      ellipse: () => {},
      roundRect: () => {},
      fillText: (text: string) => {
        fills.push({ text, fillStyle: currentFillStyle, font: currentFont });
      },
      setLineDash: () => {},
    } as unknown as CanvasRenderingContext2D;
    return { ctx, fills };
  };

  // 1. Horizontal orientation
  const { ctx: horizCtx, fills: horizFills } = createMockCtx();
  renderScoreToCanvas(horizCtx, score, {
    orientation: 'horizontal',
    staffStyle: 'tritone-split',
    noteheadMorphology: 'row-parity-shape',
    colorMode: 'duration-class',
    zoom: 1.0,
    pixelsPerTick: 2.0,
    pixelsPerSemitone: 14,
    showHandCrossings: false,
    showBarlines: false,
    showGridLines: true,
    currentTick: 0,
  });

  const horizTexts = horizFills.map((f) => f.text);
  const horizMOctaves = horizTexts.filter((t) => /^m\d+$/.test(t));
  assert.ok(horizMOctaves.length > 0, 'Must render m${oct - 1} octave markers in horizontal orientation');
  assert.ok(horizMOctaves.includes('m2'), 'Should include m2 (C3)');
  assert.ok(horizMOctaves.includes('m3'), 'Should include m3 (Middle C, C4)');
  assert.ok(!horizTexts.some((t) => /^C\d+$/.test(t)), 'Must not render diatonic C${oct} labels');
  assert.ok(!horizTexts.some((t) => /^0:\d+$/.test(t)), 'Must not render 0:${oct} labels');

  // 2. Vertical orientation
  const { ctx: vertCtx, fills: vertFills } = createMockCtx();
  renderScoreToCanvas(vertCtx, score, {
    orientation: 'vertical',
    staffStyle: 'tritone-split',
    noteheadMorphology: 'row-parity-shape',
    colorMode: 'duration-class',
    zoom: 1.0,
    pixelsPerTick: 2.0,
    pixelsPerSemitone: 14,
    showHandCrossings: false,
    showBarlines: false,
    showGridLines: true,
    currentTick: 0,
  });

  const vertTexts = vertFills.map((f) => f.text);
  const vertMOctaves = vertTexts.filter((t) => /^m\d+$/.test(t));
  assert.ok(vertMOctaves.length > 0, 'Must render m${oct - 1} octave markers in vertical orientation');
  assert.ok(!vertMOctaves.includes('m2'), 'Must NOT include m2 (dropped)');
  assert.ok(vertMOctaves.includes('m3'), 'Should include m3 (Middle C, C4)');
  assert.ok(!vertMOctaves.includes('m4'), 'Must NOT include m4 (dropped)');
  assert.ok(!vertTexts.includes('0'), 'Must not render bare 0 at octave boundary in vertical orientation');
  assert.ok(!vertTexts.some((t) => /^C\d+$/.test(t)), 'Must not render diatonic C${oct} labels');
});

test('Tasteful Handedness Chevrons Invariant: open chevrons pointing Right for RH and Left for LH', () => {
  const score = buildBachGoldbergVar1Score();
  const recordedLines: { x1: number; y1: number; x2: number; y2: number; stroke: string }[] = [];
  let currentStroke = '';
  let currentPath: { x: number; y: number }[] = [];
  const chevrons: { baseX: number; apexX: number; topY: number; botY: number; apexY: number; stroke: string; hand: 'RH' | 'LH' }[] = [];
  const directionalNoteheads: { baseX: number; apexX: number; topY: number; botY: number; apexY: number; stroke: string; hand: 'RH' | 'LH' }[] = [];

  const mockCtx = {
    fillStyle: '',
    set strokeStyle(val: string) {
      currentStroke = val;
    },
    get strokeStyle() {
      return currentStroke;
    },
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    font: '',
    textAlign: '',
    textBaseline: '',
    save: () => {},
    restore: () => {},
    beginPath: () => {
      currentPath = [];
    },
    closePath: () => {},
    moveTo: (x: number, y: number) => {
      (mockCtx as any)._startX = x;
      (mockCtx as any)._startY = y;
      currentPath = [{ x, y }];
    },
    lineTo: (x: number, y: number) => {
      recordedLines.push({
        x1: (mockCtx as any)._startX,
        y1: (mockCtx as any)._startY,
        x2: x,
        y2: y,
        stroke: currentStroke,
      });
      (mockCtx as any)._startX = x;
      (mockCtx as any)._startY = y;
      currentPath.push({ x, y });
    },
    stroke: () => {
      if (currentPath.length === 3 && currentStroke !== '#000000') {
        const [p0, p1, p2] = currentPath;
        if (p0.x === p2.x && p1.x !== p0.x) {
          const hand = p1.x > p0.x ? 'RH' : 'LH';
          chevrons.push({
            baseX: p0.x,
            apexX: p1.x,
            topY: p0.y,
            apexY: p1.y,
            botY: p2.y,
            stroke: currentStroke,
            hand,
          });
        }
      }
      if (currentPath.length >= 5) {
        const p1 = currentPath[1];
        const p2 = currentPath[2];
        const p3 = currentPath[3];
        if (p1 && p2 && p3 && Math.abs(p1.x - p3.x) < 0.01 && p2.x !== p1.x) {
          const hand = p2.x > p1.x ? 'RH' : 'LH';
          directionalNoteheads.push({
            baseX: p1.x,
            apexX: p2.x,
            topY: p1.y,
            apexY: p2.y,
            botY: p3.y,
            stroke: currentStroke,
            hand,
          });
        }
      }
    },
    fill: () => {},
    fillRect: () => {},
    arc: () => {},
    ellipse: () => {},
    roundRect: () => {},
    fillText: () => {},
    setLineDash: () => {},
  } as unknown as CanvasRenderingContext2D;

  renderScoreToCanvas(mockCtx, score, {
    orientation: 'vertical',
    staffStyle: 'tritone-split',
    noteheadMorphology: 'row-parity-shape',
    colorMode: 'duration-class',
    zoom: 1.0,
    pixelsPerTick: 2.0,
    pixelsPerSemitone: 14,
    showHandCrossings: false,
    showBarlines: false,
    showGridLines: true,
    currentTick: 0,
  });

  // Zero straight lateral stems (y1 === y2, x1 !== x2, length >= 20)
  const lateralStems = recordedLines.filter((l) => l.y1 === l.y2 && l.x1 !== l.x2 && Math.abs(l.x2 - l.x1) >= 20 && Math.abs(l.x2 - l.x1) < 100);
  assert.equal(lateralStems.length, 0, 'Zero straight lateral stem lines rendered');

  // Zero standalone floating chevrons
  assert.equal(chevrons.length, 0, 'Zero standalone floating chevrons rendered');

  // In Bach Goldberg Var 1, keyboard symmetry around m3 (linear pitch 48) means:
  // - 488 notes in default territory (RH >= 48, LH <= 48, and both hands on 48) have standard noteheads
  // - Exactly 63 notes where hands cross m3 have directional noteheads:
  //   - 24 notes where RH crosses into bass (< 48) have right-pointing noteheads (apexX > baseX)
  //   - 39 notes where LH crosses into treble (> 48) have left-pointing noteheads (apexX < baseX)
  assert.equal(directionalNoteheads.length, 63, 'Must render directional noteheads ONLY for exceptions (63 in Goldberg Var 1)');

  const rhDirectional = directionalNoteheads.filter((s) => s.hand === 'RH');
  const lhDirectional = directionalNoteheads.filter((s) => s.hand === 'LH');

  assert.equal(rhDirectional.length, 24, '24 crossing notes must have right-pointing noteheads for RH in bass (< 48)');
  assert.equal(lhDirectional.length, 39, '39 crossing notes must have left-pointing noteheads for LH above m3 (> 48)');

  // Verify center alignment: notehead apex is at cy === y (paddingStart + startTick * pixelsPerTick)
  const firstExNote = score.notes.find((n) => (n.hand === 'RH' && linearIndex(n.pitch) < 48) || (n.hand === 'LH' && linearIndex(n.pitch) > 48))!;
  const firstDirectional = directionalNoteheads[0];
  const paddingStart = 60;
  const expectedY = paddingStart + firstExNote.startTick * 2.0;
  assert.equal(firstDirectional.apexY, expectedY, 'Notehead apex must be center-aligned at cy === y');
  assert.ok(Math.abs(firstDirectional.apexY - (firstDirectional.topY + firstDirectional.botY) / 2) < 0.05, 'Notehead apex must be vertically centered');

  // Assert notes on Middle C (lPitch === 48) have zero directional noteheads for both RH and LH
  const m3Notes = score.notes.filter((n) => linearIndex(n.pitch) === 48);
  assert.ok(m3Notes.length > 0, 'Score must contain notes on Middle C');
  m3Notes.forEach((m3) => {
    const yCoord = paddingStart + m3.startTick * 2.0;
    const hasDirectional = directionalNoteheads.some((s) => s.apexY === yCoord);
    assert.ok(!hasDirectional, `Note on Middle C (${m3.id}, hand: ${m3.hand}) must have zero directional noteheads`);
  });

  // Verify full m3 symmetry exception logic with both RH (<48) and LH (>48) crossings, and neutral Middle C (48):
  const symmetryTestScore: QuantizedGridScore = {
    id: 'handedness-symmetry-test',
    title: 'Handedness Symmetry Test',
    composer: 'Test',
    ticksPerBeat: 48,
    gridResolution: 12,
    totalTicks: 72,
    timeSignatures: [{ numerator: 4, denominator: 4, tick: 0 }],
    barlines: [],
    tempos: [],
    dynamics: [],
    pedals: [],
    notes: [
      { id: 'rh-m3', pitch: { pitchClass: 0, octave: 4 }, startTick: 0, durationTicks: 12, hand: 'RH', velocity: 90 }, // 48 -> neutral
      { id: 'lh-m3', pitch: { pitchClass: 0, octave: 4 }, startTick: 12, durationTicks: 12, hand: 'LH', velocity: 90 }, // 48 -> neutral
      { id: 'rh-default', pitch: { pitchClass: 7, octave: 4 }, startTick: 24, durationTicks: 12, hand: 'RH', velocity: 90 }, // 55 >= 48 -> default, no directional tip
      { id: 'lh-default', pitch: { pitchClass: 7, octave: 3 }, startTick: 36, durationTicks: 12, hand: 'LH', velocity: 90 }, // 43 <= 48 -> default, no directional tip
      { id: 'rh-exception', pitch: { pitchClass: 7, octave: 3 }, startTick: 48, durationTicks: 12, hand: 'RH', velocity: 90 }, // 43 < 48 -> exception, right tip
      { id: 'lh-exception', pitch: { pitchClass: 7, octave: 4 }, startTick: 60, durationTicks: 12, hand: 'LH', velocity: 90 }, // 55 > 48 -> exception, left tip
    ],
  };

  let symPath: { x: number; y: number }[] = [];
  const symChevrons: { baseX: number; apexX: number; hand: 'RH' | 'LH' }[] = [];
  const symDirectional: { baseX: number; apexX: number; hand: 'RH' | 'LH' }[] = [];
  const symCtx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
    save: () => {},
    restore: () => {},
    beginPath: () => {
      symPath = [];
    },
    closePath: () => {},
    moveTo: (x: number, y: number) => {
      symPath = [{ x, y }];
    },
    lineTo: (x: number, y: number) => {
      symPath.push({ x, y });
    },
    stroke: () => {
      if (symPath.length === 3 && String(symCtx.strokeStyle) !== '#000000') {
        const [p0, p1, p2] = symPath;
        if (p0.x === p2.x && p1.x !== p0.x) {
          symChevrons.push({
            baseX: p0.x,
            apexX: p1.x,
            hand: p1.x > p0.x ? 'RH' : 'LH',
          });
        }
      }
      if (symPath.length >= 5) {
        const p1 = symPath[1];
        const p2 = symPath[2];
        const p3 = symPath[3];
        if (p1 && p2 && p3 && Math.abs(p1.x - p3.x) < 0.01 && p2.x !== p1.x) {
          symDirectional.push({
            baseX: p1.x,
            apexX: p2.x,
            hand: p2.x > p1.x ? 'RH' : 'LH',
          });
        }
      }
    },
    fill: () => {},
    fillRect: () => {},
    arc: () => {},
    ellipse: () => {},
    roundRect: () => {},
    fillText: () => {},
    setLineDash: () => {},
  } as unknown as CanvasRenderingContext2D;

  renderScoreToCanvas(symCtx, symmetryTestScore, {
    orientation: 'vertical',
    staffStyle: 'tritone-split',
    noteheadMorphology: 'row-parity-shape',
    colorMode: 'duration-class',
    zoom: 1.0,
    pixelsPerTick: 2.0,
    pixelsPerSemitone: 14,
    showHandCrossings: false,
    showBarlines: false,
    showGridLines: false,
    currentTick: 0,
  });

  assert.equal(symChevrons.length, 0, 'Zero standalone floating chevrons in symmetry test');
  assert.equal(symDirectional.length, 2, 'Exactly 2 directional noteheads must be rendered for the 2 exception notes');

  const symRh = symDirectional.filter((s) => s.hand === 'RH');
  const symLh = symDirectional.filter((s) => s.hand === 'LH');
  assert.equal(symRh.length, 1, 'RH exception (< 48) must render right-pointing notehead');
  assert.equal(symLh.length, 1, 'LH exception (> 48) must render left-pointing notehead');
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

test('Solid Row-Parity Shapes Invariant: white noteheads with knockout, yellow highlight on active/selected', () => {
  const score = buildBachGoldbergVar1Score();
  const fills: string[] = [];
  const strokes: string[] = [];

  const mockCtx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {
      strokes.push(String(mockCtx.strokeStyle));
    },
    fill: () => {
      fills.push(String(mockCtx.fillStyle));
    },
    fillRect: () => {},
    arc: () => {},
    ellipse: () => {},
    roundRect: () => {},
    fillText: () => {},
    setLineDash: () => {},
  } as unknown as CanvasRenderingContext2D;

  // Render at tick 0 where the first note is active
  const firstNote = score.notes[0];
  renderScoreToCanvas(mockCtx, score, {
    orientation: 'horizontal',
    staffStyle: 'tritone-split',
    noteheadMorphology: 'row-parity-shape',
    colorMode: 'monochrome',
    zoom: 1.0,
    pixelsPerTick: 2.0,
    pixelsPerSemitone: 14,
    showHandCrossings: false,
    showBarlines: false,
    showGridLines: true,
    currentTick: firstNote.startTick,
  });

  // Black knockout fills must be present
  assert.ok(fills.includes('#000000'), 'Line knockout #000000 must be used');
  // Solid white noteheads for inactive notes in monochrome
  assert.ok(fills.includes('#FFFFFF'), 'Solid white #FFFFFF notehead fill must be present');
  // Yellow highlight for actively sounding note
  assert.ok(fills.includes('#FDE047'), 'Yellow highlight #FDE047 must be used for active note');
  assert.ok(strokes.includes('#FACC15'), 'Yellow stroke #FACC15 must be used for active note');
});

test('Horizontal Note Spacing Invariant: 16th notes breathing room and measure dimensions at default scale', () => {
  const score = buildBachGoldbergVar1Score();
  const options: RenderOptions = {
    orientation: 'horizontal',
    staffStyle: 'tritone-split',
    noteheadMorphology: 'row-parity-shape',
    colorMode: 'monochrome',
    zoom: 1.0,
    pixelsPerTick: 2.0,
    pixelsPerSemitone: 14,
    showHandCrossings: true,
    showBarlines: true,
    showGridLines: true,
    currentTick: 0,
  };

  // 1. Invariant: Default pixelsPerTick >= 2.0
  assert.ok(options.pixelsPerTick >= 2.0, 'Default pixelsPerTick must be >= 2.0');

  // 2. Invariant: 16th notes (12 ticks) have at least 24px between onsets (and >= 20px)
  const sixteenthNoteTicks = 12;
  const sixteenthSpacing = sixteenthNoteTicks * options.pixelsPerTick;
  assert.ok(
    sixteenthSpacing >= 24,
    `16th notes onset distance (${sixteenthSpacing}px) must be >= 24px`
  );
  assert.ok(
    sixteenthSpacing >= 20,
    `16th notes onset distance (${sixteenthSpacing}px) must be >= 20px`
  );

  // 3. Invariant: 3/4 measure of Bach (144 ticks) spans at least 288px
  const measureTicks = 144;
  const measureWidth = measureTicks * options.pixelsPerTick;
  assert.ok(
    measureWidth >= 288,
    `3/4 measure width (${measureWidth}px) must span at least 288px`
  );

  // 4. Invariant: Score dimensions accommodate expanded timeline
  const dims = calculateScoreDimensions(score, options);
  const expectedMinScoreLength = score.totalTicks * options.pixelsPerTick;
  assert.ok(
    dims.width >= expectedMinScoreLength,
    `Canvas width (${dims.width}px) must comfortably accommodate entire score length (${expectedMinScoreLength}px)`
  );

  // 5. Invariant: Consecutive 16th notes in Goldberg Var 1 have clear visual separation
  const rhNotes = score.notes
    .filter((n) => n.hand === 'RH')
    .sort((a, b) => a.startTick - b.startTick);

  for (let i = 0; i < rhNotes.length - 1; i++) {
    const cur = rhNotes[i];
    const nxt = rhNotes[i + 1];
    const deltaTicks = nxt.startTick - cur.startTick;
    if (deltaTicks === 12) {
      const deltaPx = deltaTicks * options.pixelsPerTick;
      assert.ok(
        deltaPx >= 20,
        `Consecutive 16th notes onset spacing (${deltaPx}px) must be at least 20px`
      );

      // Verify noteheads do not collide
      const curSpan = Math.max(10, cur.durationTicks * options.pixelsPerTick - 2);
      const nxtSpan = Math.max(10, nxt.durationTicks * options.pixelsPerTick - 2);
      const noteHeight = Math.max(8, options.pixelsPerSemitone - 3);
      const curAnchor = Math.min(curSpan / 2, Math.max(8, noteHeight * 0.65));
      const nxtAnchor = Math.min(nxtSpan / 2, Math.max(8, noteHeight * 0.65));
      const curCenterX = cur.startTick * options.pixelsPerTick + curAnchor;
      const nxtCenterX = nxt.startTick * options.pixelsPerTick + nxtAnchor;
      const centerDist = nxtCenterX - curCenterX;
      assert.ok(
        centerDist >= 20,
        `Notehead centers distance (${centerDist}px) must be >= 20px`
      );
    }
  }
});

test('Full canvas rendering matrix executes across all variations without error', () => {
  const score = buildBachGoldbergVar1Score();
  const staffStyles: StaffStyle[] = ['wholetone-uniform', 'tritone-split', 'augmented-3line', 'octave-ribbons'];
  const morphologies: NoteheadMorphology[] = ['classic-oval', 'row-parity-shape', 'phonetic', 'numerical', 'minimal-dot'];
  const orientations: ('horizontal' | 'vertical')[] = ['horizontal', 'vertical'];

  const createMockCtx = () => {
    const noop = () => {};
    return {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      font: '',
      textAlign: '',
      textBaseline: '',
      save: noop,
      restore: noop,
      beginPath: noop,
      closePath: noop,
      moveTo: noop,
      lineTo: noop,
      stroke: noop,
      fill: noop,
      fillRect: noop,
      arc: noop,
      ellipse: noop,
      roundRect: noop,
      fillText: noop,
      setLineDash: noop,
    } as unknown as CanvasRenderingContext2D;
  };

  const colorModes: ColorMode[] = [
    'duration-class',
    'wholetone-duality',
    'pitch-class-wheel',
    'voice-hand',
    'monochrome',
    'ddr-subdivision',
  ];

  for (const staffStyle of staffStyles) {
    for (const noteheadMorphology of morphologies) {
      for (const orientation of orientations) {
        for (const colorMode of colorModes) {
          const options: RenderOptions = {
            orientation,
            staffStyle,
            noteheadMorphology,
            colorMode,
            zoom: 1.0,
            pixelsPerTick: 2.0,
            pixelsPerSemitone: 14,
            showHandCrossings: true,
            showBarlines: true,
            showGridLines: true,
            currentTick: 144,
          };

          const dims = calculateScoreDimensions(score, options);
          assert.ok(dims.width > 0);
          assert.ok(dims.height > 0);

          const mockCtx = createMockCtx();
          renderScoreToCanvas(mockCtx, score, options);
        }
      }
    }
  }
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

test('Vertical Timeline Invariant: canvas coordinates, descending time flow, and vertical staff lines', () => {
  const score = buildBachGoldbergVar1Score();
  const options: RenderOptions = {
    orientation: 'vertical',
    staffStyle: 'tritone-split',
    noteheadMorphology: 'row-parity-shape',
    colorMode: 'ddr-subdivision',
    zoom: 1.0,
    pixelsPerTick: 2.0,
    pixelsPerSemitone: 14,
    showHandCrossings: true,
    showBarlines: true,
    showGridLines: true,
    currentTick: 0,
  };

  const dims = calculateScoreDimensions(score, options);
  assert.ok(dims.height > dims.width, 'Vertical score height (time) must exceed width (pitch breadth)');
  assert.ok(dims.height >= score.totalTicks * options.pixelsPerTick, 'Height must accommodate total score ticks');

  // Verify staff lines run vertically
  const verticalLines: { x: number; y1: number; y2: number; strokeStyle: string }[] = [];
  let lastMove: { x: number; y: number } | null = null;
  const mockCtx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: (x: number, y: number) => {
      lastMove = { x, y };
    },
    lineTo: (x: number, y: number) => {
      if (lastMove && lastMove.x === x && y > lastMove.y) {
        verticalLines.push({
          x,
          y1: lastMove.y,
          y2: y,
          strokeStyle: String(mockCtx.strokeStyle),
        });
      }
    },
    stroke: () => {},
    fill: () => {},
    fillRect: () => {},
    arc: () => {},
    ellipse: () => {},
    roundRect: () => {},
    fillText: () => {},
    setLineDash: () => {},
  } as unknown as CanvasRenderingContext2D;

  renderScoreToCanvas(mockCtx, score, options);
  assert.ok(verticalLines.length > 0, 'Vertical staff lines must be drawn across the score height');
});

test('Canvas Rendering with DDR Subdivision & Vertical Orientation: full rendering with active note glow', () => {
  const score = buildBachGoldbergVar1Score();
  const fills: string[] = [];
  const strokes: string[] = [];

  const mockCtx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {
      strokes.push(String(mockCtx.strokeStyle));
    },
    fill: () => {
      fills.push(String(mockCtx.fillStyle));
    },
    fillRect: () => {
      fills.push(String(mockCtx.fillStyle));
    },
    arc: () => {},
    ellipse: () => {},
    roundRect: () => {},
    fillText: () => {},
    setLineDash: () => {},
  } as unknown as CanvasRenderingContext2D;

  const firstNote = score.notes[0];
  renderScoreToCanvas(mockCtx, score, {
    orientation: 'vertical',
    staffStyle: 'tritone-split',
    noteheadMorphology: 'row-parity-shape',
    colorMode: 'ddr-subdivision',
    zoom: 1.0,
    pixelsPerTick: 2.0,
    pixelsPerSemitone: 14,
    showHandCrossings: true,
    showBarlines: true,
    showGridLines: true,
    currentTick: firstNote.startTick,
  });

  // Black line knockout
  assert.ok(fills.includes('#000000'), 'Line knockout #000000 must be present');
  // Beat onset (Red #EF4444)
  assert.ok(fills.includes('#EF4444'), 'Beat onset Red #EF4444 fill must be present');
  // 16th notes (Yellow #EAB308) in Bach Goldberg Var 1
  assert.ok(fills.includes('#EAB308'), '16th note Yellow #EAB308 fill must be present');
  // Active note glow (#FEF08A)
  assert.ok(fills.includes('#FEF08A'), 'Active note bright gold glow #FEF08A must be present');
  // Active note gold stroke (#FACC15)
  assert.ok(strokes.includes('#FACC15'), 'Active note gold border #FACC15 must be present');
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

test('Canvas Rendering with Duration-Class & Vertical Orientation: full rendering with active note glow', () => {
  const score = buildBachGoldbergVar1Score();
  const fills: string[] = [];
  const strokes: string[] = [];

  const mockCtx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {
      strokes.push(String(mockCtx.strokeStyle));
    },
    fill: () => {
      fills.push(String(mockCtx.fillStyle));
    },
    fillRect: () => {
      fills.push(String(mockCtx.fillStyle));
    },
    arc: () => {},
    ellipse: () => {},
    roundRect: () => {},
    fillText: () => {},
    setLineDash: () => {},
  } as unknown as CanvasRenderingContext2D;

  const firstNote = score.notes[0];
  renderScoreToCanvas(mockCtx, score, {
    orientation: 'vertical',
    staffStyle: 'tritone-split',
    noteheadMorphology: 'row-parity-shape',
    colorMode: 'duration-class',
    zoom: 1.0,
    pixelsPerTick: 2.0,
    pixelsPerSemitone: 14,
    showHandCrossings: true,
    showBarlines: true,
    showGridLines: true,
    currentTick: firstNote.startTick,
  });

  // Black line knockout
  assert.ok(fills.includes('#000000'), 'Line knockout #000000 must be present');
  // 16th notes (Silver #E2E8F0) in Bach Goldberg Var 1
  assert.ok(fills.includes('#E2E8F0'), '16th note Silver #E2E8F0 fill must be present');
  // 8th notes & Dotted 8th notes (Sky Blue #38BDF8) in Bach Goldberg Var 1
  assert.ok(fills.includes('#38BDF8'), '8th note Sky Blue #38BDF8 fill must be present');
  // Active note glow (#FEF08A)
  assert.ok(fills.includes('#FEF08A'), 'Active note bright gold glow #FEF08A must be present');
  // Active note gold stroke (#FACC15)
  assert.ok(strokes.includes('#FACC15'), 'Active note gold border #FACC15 must be present');
});

test('Unified Euclidean Duration Lattice: Pure Noteheads Invariant for Regular Notes (d <= ticksPerBeat)', () => {
  const score = buildBachGoldbergVar1Score();
  const ribbons: { x: number; y: number; w: number; h: number }[] = [];
  const arcCenters: { x: number; y: number }[] = [];
  const fills: string[] = [];
  const chevrons: { baseX: number; apexX: number; hand: 'RH' | 'LH' }[] = [];
  const directionalNoteheads: { baseX: number; apexX: number; topY: number; apexY: number; botY: number; hand: 'RH' | 'LH' }[] = [];

  let currentPath: { x: number; y: number }[] = [];

  const mockCtx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    font: '',
    textAlign: '',
    textBaseline: '',
    save: () => {},
    restore: () => {},
    beginPath: () => {
      currentPath = [];
    },
    closePath: () => {},
    moveTo: (x: number, y: number) => {
      currentPath = [{ x, y }];
    },
    lineTo: (x: number, y: number) => {
      currentPath.push({ x, y });
    },
    stroke: () => {
      if (currentPath.length === 3 && mockCtx.strokeStyle !== '#000000') {
        const [p0, p1, p2] = currentPath;
        if (p0.x === p2.x && p1.x !== p0.x) {
          chevrons.push({
            baseX: p0.x,
            apexX: p1.x,
            hand: p1.x > p0.x ? 'RH' : 'LH',
          });
        }
      }
      if (currentPath.length >= 5) {
        const p1 = currentPath[1];
        const p2 = currentPath[2];
        const p3 = currentPath[3];
        if (p1 && p2 && p3 && Math.abs(p1.x - p3.x) < 0.01 && p2.x !== p1.x) {
          directionalNoteheads.push({
            baseX: p1.x,
            apexX: p2.x,
            topY: p1.y,
            apexY: p2.y,
            botY: p3.y,
            hand: p2.x > p1.x ? 'RH' : 'LH',
          });
        }
      }
    },
    fill: () => {
      if (typeof mockCtx.fillStyle === 'string') {
        fills.push(mockCtx.fillStyle);
      }
    },
    fillRect: () => {
      if (typeof mockCtx.fillStyle === 'string') {
        fills.push(mockCtx.fillStyle);
      }
    },
    arc: (x: number, y: number) => {
      arcCenters.push({ x, y });
    },
    ellipse: (x: number, y: number) => {
      arcCenters.push({ x, y });
    },
    roundRect: (x: number, y: number, w: number, h: number) => {
      // Hold tails were thin (1.5px), notehead shapes are wider (> 4px)
      if (w <= 2.0 || h <= 2.0) {
        ribbons.push({ x, y, w, h });
      }
    },
    fillText: () => {},
    setLineDash: () => {},
  } as unknown as CanvasRenderingContext2D;

  const pixelsPerTick = 2.0;
  const pixelsPerSemitone = 14;
  const paddingStart = 60;
  const paddingPitch = 40;

  renderScoreToCanvas(mockCtx, score, {
    orientation: 'vertical',
    staffStyle: 'tritone-split',
    noteheadMorphology: 'row-parity-shape',
    colorMode: 'duration-class',
    zoom: 1.0,
    pixelsPerTick,
    pixelsPerSemitone,
    showHandCrossings: true,
    showBarlines: false,
    showGridLines: false,
    currentTick: 0,
  });

  const ticksPerBeat = score.ticksPerBeat || 48;
  const regularNotes = score.notes.filter((n) => n.durationTicks <= ticksPerBeat);
  const sixteenthNotes = score.notes.filter((n) => n.durationTicks <= 12);
  const eighthNotes = score.notes.filter((n) => n.durationTicks === 24);

  assert.ok(regularNotes.length > 500, 'Must have > 500 regular notes in Goldberg Var 1');
  assert.ok(sixteenthNotes.length > 100, 'Must have > 100 16th notes');
  assert.ok(eighthNotes.length > 50, 'Must have > 50 8th notes');

  // Zero hold ribbon rects for regular notes: pure noteheads
  assert.equal(
    ribbons.length,
    0,
    `Ribbon count (${ribbons.length}) must be 0 for all regular notes (pure noteheads with zero rod collisions)`
  );

  // Notehead colors strictly duration-coded by duration class:
  // 16th notes (Silver #E2E8F0)
  assert.ok(fills.includes('#E2E8F0'), '16th note Silver #E2E8F0 fill must be present');
  // 8th notes (Sky Blue #38BDF8)
  assert.ok(fills.includes('#38BDF8'), '8th note Sky Blue #38BDF8 fill must be present');
  // Quarter notes (Amber #F59E0B)
  assert.ok(fills.includes('#F59E0B'), 'Quarter note Amber #F59E0B fill must be present');

  // Handedness indicators: baked directional noteheads (< for LH, > for RH)
  // In Goldberg Var 1, 488 notes in default territory (RH >= 48, LH <= 48, and both hands on 48) have standard noteheads,
  // while the 63 notes where hands cross m3 (24 RH < 48, 39 LH > 48) have directional noteheads.
  assert.equal(chevrons.length, 0, 'Zero standalone chevrons rendered');
  assert.equal(directionalNoteheads.length, 63, 'Only hand crossing exception notes (63 in Var 1) render directional noteheads');

  // Notehead center for each 16th note on even PC (discs) must equal exact onset coordinate
  const indices = score.notes.map((n) => n.pitch.octave * 12 + n.pitch.pitchClass);
  let minPitch = Math.min(...indices) - 2;
  minPitch = Math.floor(minPitch / 2) * 2;

  sixteenthNotes
    .filter((n) => n.pitch.pitchClass % 2 === 0)
    .forEach((n) => {
      const lPitch = n.pitch.octave * 12 + n.pitch.pitchClass;
      const expectedX = paddingPitch + (lPitch - minPitch) * pixelsPerSemitone;
      const expectedY = paddingStart + n.startTick * pixelsPerTick;
      const hand = n.hand ?? (lPitch >= 48 ? 'RH' : 'LH');
      const isHandException = (hand === 'RH' && lPitch < 48) || (hand === 'LH' && lPitch > 48);
      if (isHandException) {
        // Hand-crossing exception notehead is a baked directional pentagon
        const found = directionalNoteheads.some((d) => Math.abs(d.apexY - expectedY) < 0.1 && d.hand === hand);
        assert.ok(found, `Note ${n.id} (16th note exception) must be centered at exact onset coordinate (${expectedX}, ${expectedY})`);
      } else {
        // Regular notehead on Row 0 is a standard disc / ellipse
        const found = arcCenters.some((c) => Math.abs(c.x - expectedX) < 0.1 && Math.abs(c.y - expectedY) < 0.1);
        assert.ok(found, `Note ${n.id} (16th note) must be centered at exact onset coordinate (${expectedX}, ${expectedY})`);
      }
    });

  // Verify canvas render executes cleanly with zero hand-crossing overlay fills
  assert.ok(
    !fills.includes('rgba(244, 114, 182, 0.12)'),
    'Must not render translucent pink hand-crossing overlay fill'
  );
});

test('Unified Euclidean Duration Lattice: Faint Dotted Continuation Trails for All Colored Notes with Continuous Uninterrupted Reference Lines', () => {
  const score = buildBachGoldbergVar1Score();

  type DottedTrail = {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    stroke: string;
    lineWidth: number;
    alpha: number;
    dash: number[];
  };

  type KnockoutLine = {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    lineWidth: number;
  };

  const createMock = (
    dottedTrails: DottedTrail[],
    ribbons: { x: number; y: number; w: number; h: number }[],
    textCalls: string[],
    knockoutLines: KnockoutLine[] = [],
    isVertical: boolean = true
  ) => {
    let pathPoints: { x: number; y: number }[] = [];
    let currentDash: number[] = [];
    let currentAlpha = 1.0;
    let currentStrokeStyle = '';
    let currentLineWidth = 1.0;

    const noop = () => {};
    const mock = {
      fillStyle: '',
      get strokeStyle() {
        return currentStrokeStyle;
      },
      set strokeStyle(v: string) {
        currentStrokeStyle = v;
      },
      get lineWidth() {
        return currentLineWidth;
      },
      set lineWidth(v: number) {
        currentLineWidth = v;
      },
      get globalAlpha() {
        return currentAlpha;
      },
      set globalAlpha(v: number) {
        currentAlpha = v;
      },
      font: '',
      textAlign: '',
      textBaseline: '',
      save: noop,
      restore: () => {
        currentDash = [];
        currentAlpha = 1.0;
      },
      beginPath: () => {
        pathPoints = [];
      },
      closePath: noop,
      moveTo: (x: number, y: number) => {
        pathPoints = [{ x, y }];
      },
      lineTo: (x: number, y: number) => {
        pathPoints.push({ x, y });
      },
      stroke: () => {
        if (pathPoints.length === 2) {
          const [p1, p2] = pathPoints;
          const isAligned = isVertical
            ? (p1.x === p2.x && p1.y !== p2.y)
            : (p1.y === p2.y && p1.x !== p2.x);
          if (
            isAligned &&
            currentDash.length === 0 &&
            (currentLineWidth === 0.8 || currentLineWidth === 1.0 || currentLineWidth === 1.35) &&
            currentStrokeStyle !== '#000000'
          ) {
            dottedTrails.push({
              x1: p1.x,
              y1: p1.y,
              x2: p2.x,
              y2: p2.y,
              stroke: currentStrokeStyle,
              lineWidth: currentLineWidth,
              alpha: currentAlpha,
              dash: [...currentDash],
            });
          } else if (
            isAligned &&
            currentStrokeStyle === '#000000' &&
            currentDash.length === 0 &&
            (currentLineWidth === 1.8 || currentLineWidth === 2.5)
          ) {
            knockoutLines.push({
              x1: p1.x,
              y1: p1.y,
              x2: p2.x,
              y2: p2.y,
              lineWidth: currentLineWidth,
            });
          }
        }
      },
      fill: noop,
      fillRect: noop,
      arc: noop,
      ellipse: noop,
      roundRect: (x: number, y: number, w: number, h: number) => {
        if (w <= 2.0 || h <= 2.0) {
          ribbons.push({ x, y, w, h });
        }
      },
      fillText: (text: string) => {
        textCalls.push(text);
      },
      setLineDash: (d: number[]) => {
        currentDash = [...d];
      },
    } as unknown as CanvasRenderingContext2D;

    return mock;
  };

  const pixelsPerTick = 2.0;
  const pixelsPerSemitone = 14;
  const paddingStart = 60;
  const paddingPitch = 40;

  const tauRef = score.gridResolution || 12;
  const coloredNotes = score.notes.filter((n) => n.durationTicks > tauRef);
  assert.equal(coloredNotes.length, 165, 'Goldberg Var 1 contains exactly 165 colored notes (d > tauRef)');
  const longNote = score.notes.find((n) => n.durationTicks === 108)!;

  const indices = score.notes.map((n) => n.pitch.octave * 12 + n.pitch.pitchClass);
  let minPitch = Math.min(...indices) - 2;
  minPitch = Math.floor(minPitch / 2) * 2;

  // 1. Vertical orientation
  const verticalDottedTrails: DottedTrail[] = [];
  const verticalKnockouts: KnockoutLine[] = [];
  const verticalRibbons: { x: number; y: number; w: number; h: number }[] = [];
  const verticalTexts: string[] = [];

  renderScoreToCanvas(createMock(verticalDottedTrails, verticalRibbons, verticalTexts, verticalKnockouts, true), score, {
    orientation: 'vertical',
    staffStyle: 'tritone-split',
    noteheadMorphology: 'row-parity-shape',
    colorMode: 'duration-class',
    zoom: 1.0,
    pixelsPerTick,
    pixelsPerSemitone,
    showHandCrossings: true,
    showBarlines: false,
    showGridLines: false,
    currentTick: 0,
  });

  // Zero hold ribbon rects
  assert.equal(verticalRibbons.length, 0, 'Vertical hold ribbons must be 0');

  // Solid thin hold lines rendered for all 165 colored notes
  assert.equal(
    verticalDottedTrails.length,
    165,
    'Must render exactly 165 solid thin hold lines for all colored notes in vertical orientation'
  );

  // Staff-line replacement knockout underlays for notes on staff lines
  assert.equal(
    verticalKnockouts.length,
    37,
    'Must render exactly 37 staff-line knockout lines in vertical orientation (line 8 dropped to lighten page)'
  );

  const vTrail = verticalDottedTrails.find((t) => t.stroke === '#F43F5E')!;
  assert.deepEqual(vTrail.dash, [], 'Hold line dash pattern must be empty (solid)');
  assert.equal(vTrail.lineWidth, 0.8, 'Hold line stroke width must be 0.8px for space notes');
  assert.equal(vTrail.alpha, 1.0, 'Hold line opacity must be 1.0');
  assert.equal(vTrail.stroke, '#F43F5E', 'Hold line stroke color must match duration class (#F43F5E for 108t)');

  // Coordinates:
  const lPitch = longNote.pitch.octave * 12 + longNote.pitch.pitchClass;
  const expectedCx = paddingPitch + (lPitch - minPitch) * pixelsPerSemitone;
  const expectedCy = paddingStart + longNote.startTick * pixelsPerTick;
  const noteHeight = Math.max(8, pixelsPerSemitone - 3); // 11px
  const expectedTrailStartY = expectedCy + noteHeight / 2 + 2; // expectedCy + 7.5
  const expectedTrailEndY = expectedCy + longNote.durationTicks * pixelsPerTick;

  assert.equal(vTrail.x1, expectedCx, 'Trail X must match notehead center cx');
  assert.equal(vTrail.x2, expectedCx, 'Trail must be vertically aligned');
  assert.equal(vTrail.y1, expectedTrailStartY, 'Trail must start below notehead bottom with optical stem clearance');
  assert.equal(vTrail.y2, expectedTrailEndY, 'Trail must cleanly terminate at release coordinate');
  assert.ok(
    vTrail.y1 > expectedCy,
    'Trail must start strictly below notehead center at expectedCy'
  );
  assert.equal(vTrail.y1 - expectedCy, noteHeight / 2 + 2, 'Optical gap must be exactly noteHeight / 2 + 2');

  // Clean staff-line replacement in Bar 6 (bach-var1-88, pitch 36, m2)
  const note88 = score.notes.find((n) => n.id === 'bach-var1-88')!;
  const note88LPitch = note88.pitch.octave * 12 + note88.pitch.pitchClass;
  const note88ExpectedCx = paddingPitch + (note88LPitch - minPitch) * pixelsPerSemitone;
  const note88ExpectedCy = paddingStart + note88.startTick * pixelsPerTick;
  const note88Trail = verticalDottedTrails.find(
    (t) => Math.abs(t.x1 - note88ExpectedCx) < 0.1 && Math.abs(t.y1 - (note88ExpectedCy + noteHeight / 2 + 2)) < 0.1
  );
  assert.ok(note88Trail, 'Must find hold line for bach-var1-88');
  assert.equal(note88Trail.lineWidth, 1.0, 'Bar 6 bach-var1-88 on m2 staff line must stroke at full staff-line width 1.0px');
  assert.equal(note88Trail.y2, note88ExpectedCy + note88.durationTicks * pixelsPerTick, 'bach-var1-88 must terminate cleanly at release');
  const note88Knockout = verticalKnockouts.find(
    (k) => Math.abs(k.x1 - note88ExpectedCx) < 0.1 && Math.abs(k.y1 - (note88ExpectedCy + noteHeight / 2)) < 0.1
  );
  assert.ok(note88Knockout, 'Must find staff-line knockout line for bach-var1-88');
  assert.equal(note88Knockout.lineWidth, 1.8, 'Bar 6 bach-var1-88 on m2 staff line must have 1.8px knockout underlay');

  // Measure 30 notes must cleanly terminate without extending past note release
  const m30Ids = ['bach-var1-501', 'bach-var1-504', 'bach-var1-507', 'bach-var1-510', 'bach-var1-513'];
  for (const nId of m30Ids) {
    const n = score.notes.find((x) => x.id === nId)!;
    const nLPitch = n.pitch.octave * 12 + n.pitch.pitchClass;
    const nCx = paddingPitch + (nLPitch - minPitch) * pixelsPerSemitone;
    const nCy = paddingStart + n.startTick * pixelsPerTick;
    const nReleaseY = nCy + n.durationTicks * pixelsPerTick;
    const nTrail = verticalDottedTrails.find(
      (t) => Math.abs(t.x1 - nCx) < 0.1 && Math.abs(t.y1 - (nCy + noteHeight / 2 + 2)) < 0.1
    );
    assert.ok(nTrail, `Must find hold line for ${nId}`);
    assert.ok(nTrail.y2 <= nReleaseY + 0.01, `${nId} hold line must not extend past release coordinate`);
  }

  // Hand-crossing text eliminated
  assert.ok(
    !verticalTexts.some((t) => t.includes('Cross')),
    'Must not render LH/RH Cross banners in canvas'
  );

  // 2. Horizontal orientation
  const horizontalDottedTrails: DottedTrail[] = [];
  const horizontalKnockouts: KnockoutLine[] = [];
  const horizontalRibbons: { x: number; y: number; w: number; h: number }[] = [];
  const horizontalTexts: string[] = [];

  renderScoreToCanvas(createMock(horizontalDottedTrails, horizontalRibbons, horizontalTexts, horizontalKnockouts, false), score, {
    orientation: 'horizontal',
    staffStyle: 'tritone-split',
    noteheadMorphology: 'row-parity-shape',
    colorMode: 'duration-class',
    zoom: 1.0,
    pixelsPerTick,
    pixelsPerSemitone,
    showHandCrossings: true,
    showBarlines: false,
    showGridLines: false,
    currentTick: 0,
  });

  assert.equal(horizontalRibbons.length, 0, 'Horizontal hold ribbons must be 0');
  assert.equal(
    horizontalDottedTrails.length,
    165,
    'Must render exactly 165 horizontal hold lines for all colored notes'
  );
  assert.equal(
    horizontalKnockouts.length,
    37,
    'Must render exactly 37 horizontal staff-line knockout lines (line 8 dropped to lighten page)'
  );

  const hTrail = horizontalDottedTrails.find((t) => t.stroke === '#F43F5E')!;
  assert.ok(hTrail, 'Must find horizontal trail for 108t pedal note');
  assert.deepEqual(hTrail.dash, [], 'Horizontal trail dash pattern must be empty');
  assert.equal(hTrail.lineWidth, 0.8, 'Horizontal trail stroke width must be 0.8px');
  assert.equal(hTrail.alpha, 1.0, 'Horizontal trail opacity must be 1.0');
  const hExpectedCx = paddingStart + longNote.startTick * pixelsPerTick;
  const hNoteWidth = Math.max(8, pixelsPerSemitone - 3);
  const expectedTrailStartX = hExpectedCx + hNoteWidth / 2 + 2;
  const expectedTrailEndX = hExpectedCx + longNote.durationTicks * pixelsPerTick;

  assert.equal(hTrail.y1, hTrail.y2, 'Horizontal trail must be horizontally aligned');
  assert.ok(hTrail.y1 > 0, 'Horizontal trail Y must be positive');
  assert.equal(hTrail.x1, expectedTrailStartX, 'Horizontal trail must start past notehead width with stem clearance');
  assert.equal(hTrail.x2, expectedTrailEndX, 'Horizontal trail must terminate cleanly at release coordinate');
  assert.ok(hTrail.x1 > hExpectedCx, 'trailStartX must be strictly past notehead center');
});

test('Full-Viewport Score Canvas & Decluttered UI Invariants', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const appTsxPath = path.resolve('src/ui/App.tsx');
  const appSrc = fs.readFileSync(appTsxPath, 'utf-8');

  // 1. Janko keyboard component is completely removed from main viewport
  assert.ok(!appSrc.includes('<JankoKeyboard'), 'App.tsx must not render <JankoKeyboard />');
  assert.ok(!appSrc.includes("import { JankoKeyboard } from './JankoKeyboard'"), 'App.tsx must not import JankoKeyboard');

  // 2. Full viewport canvas container with zero static top or bottom bars
  assert.ok(
    appSrc.includes('fixed inset-0 h-[100dvh] w-screen'),
    'Canvas container must span full viewport: fixed inset-0 h-[100dvh] w-screen'
  );
  assert.ok(!appSrc.includes('<header'), 'App.tsx must not have a static <header> banner');
  assert.ok(!appSrc.includes('h-12 bg-black border-b'), 'App.tsx must not have static 48px header bar');
  assert.ok(!appSrc.includes('h-9 bg-black border-b'), 'App.tsx must not have static 36px scrub header bar');
  assert.ok(!appSrc.includes('h-8 bg-neutral-950 border-b'), 'App.tsx must not have static 32px preset toolbar');
});

test('Floating Action Trigger ("Floaty Thing") Invariants', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const appTsxPath = path.resolve('src/ui/App.tsx');
  const appSrc = fs.readFileSync(appTsxPath, 'utf-8');

  // Floating trigger positioned over canvas
  assert.ok(
    appSrc.includes('fixed top-3 right-3 z-40'),
    'Floating action trigger must be positioned at top-3 right-3 with z-40'
  );

  // Quick Play/Pause toggle
  assert.ok(appSrc.includes('handleTogglePlay'), 'Floating trigger must include Play/Pause handler');
  assert.ok(appSrc.includes("isPlaying ? '⏸' : '▶'"), 'Floating trigger must display Play/Pause icon');

  // Measure and beat badge
  assert.ok(appSrc.includes('M{measure}'), 'Floating trigger must display measure indicator M{measure}');
  assert.ok(appSrc.includes('B{beat}'), 'Floating trigger must display beat indicator B{beat}');

  // Sidebar controls trigger
  assert.ok(appSrc.includes('setIsDrawerOpen'), 'Floating trigger must toggle drawer state');
  assert.ok(appSrc.includes('⚙'), 'Floating trigger must have settings/controls icon');
});

test('Complete Sidebar Controls & Drawer Integration Invariants', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const drawerTsxPath = path.resolve('src/ui/ControlsDrawer.tsx');
  const drawerSrc = fs.readFileSync(drawerTsxPath, 'utf-8');

  // Slide-out drawer container
  assert.ok(
    drawerSrc.includes('fixed inset-y-0 right-0 w-80'),
    'ControlsDrawer must be a fixed slide-out drawer on right edge'
  );
  assert.ok(
    drawerSrc.includes("isOpen ? 'translate-x-0' : 'translate-x-full'"),
    'ControlsDrawer must slide smoothly in and out via translate-x'
  );

  // Playback transport with scrub slider and measure counter
  assert.ok(
    drawerSrc.includes('aria-label="Timeline scrubber"'),
    'ControlsDrawer must contain a scrub slider with timeline scrubber aria-label'
  );
  assert.ok(
    drawerSrc.includes('M{measure}') && drawerSrc.includes('B{beat}'),
    'ControlsDrawer must display measure and beat counter'
  );
  assert.ok(
    drawerSrc.includes('tempoMultiplier') && drawerSrc.includes('onTempoMultiplierChange'),
    'ControlsDrawer must include tempo multiplier controls'
  );

  // Definitive Design Architecture, Timeline Orientation, Color Mode
  assert.ok(drawerSrc.includes('Definitive Iso-Notation'), 'Must contain Definitive Iso-Notation section');
  assert.ok(drawerSrc.includes('Timeline Orientation'), 'Must contain Timeline Orientation toggle');
  assert.ok(drawerSrc.includes('Color Spectrum'), 'Must contain Color Mode dropdown');
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

  const score = buildBachGoldbergVar1Score();
  let squareCount = 0;
  let fullSquareCount = 0;
  let emptySquareCount = 0;
  let nonSquareCount = 0;
  let ellipseCount = 0;

  let currentFill = '';
  let currentLineWidth = 1;
  let currentAlpha = 1.0;
  const alphaStack: number[] = [];
  let tintFillCount = 0;
  let voidFillCount = 0;

  const mockCtx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    get globalAlpha() {
      return currentAlpha;
    },
    set globalAlpha(v: number) {
      currentAlpha = v;
    },
    font: '',
    textAlign: '',
    textBaseline: '',
    save: () => {
      alphaStack.push(currentAlpha);
    },
    restore: () => {
      currentAlpha = alphaStack.pop() ?? 1.0;
    },
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {
      if (mockCtx.lineWidth === 1.8) {
        emptySquareCount++;
      } else if (mockCtx.lineWidth === 1.2) {
        fullSquareCount++;
      }
    },
    fill: () => {
      currentFill = mockCtx.fillStyle as string;
      if (Math.abs(currentAlpha - 0.18) < 0.01) {
        tintFillCount++;
      } else if (mockCtx.fillStyle === '#000000') {
        voidFillCount++;
      }
    },
    fillRect: () => {},
    arc: () => {},
    ellipse: () => {
      ellipseCount++;
    },
    roundRect: (x: number, y: number, w: number, h: number) => {
      if (w >= 10.0 && h >= 7.5) {
        squareCount++;
      }
    },
    fillText: () => {},
    setLineDash: () => {},
  } as unknown as CanvasRenderingContext2D;

  renderScoreToCanvas(mockCtx, score, {
    orientation: 'vertical',
    staffStyle: 'tritone-split',
    noteheadMorphology: 'rectangle-square',
    colorMode: 'duration-class',
    zoom: 1.0,
    pixelsPerTick: 2.0,
    pixelsPerSemitone: 11,
    showHandCrossings: false,
    showBarlines: false,
    showGridLines: true,
    currentTick: 0,
  });

  assert.ok(squareCount > 0, 'Must render squished square noteheads');
  assert.ok(fullSquareCount > 0, 'Must render full squares for Row 0 notes');
  assert.ok(emptySquareCount > 0, 'Must render empty squares for Row 1 notes');
  assert.equal(tintFillCount, 0, 'Must have zero faint tint (globalAlpha = 0.18) fills; all Row 1 hollow noteheads maintain pure void fill');
  assert.ok(voidFillCount > 0, 'Must render pure void black inside 16th note hollow noteheads');
  assert.equal(ellipseCount, 0, 'Must render zero ellipses');

  // Explicitly assert duration-class color behavior on Canvas: Blue (8th), Orange (quarter), and Red (half note) all maintain void fill (zero tint)
  const canvasDurationScore: QuantizedGridScore = {
    id: 'canvas-duration-test',
    title: 'Canvas Duration Test',
    composer: 'Test',
    ticksPerBeat: 48,
    gridResolution: 12,
    totalTicks: 192,
    timeSignatures: [{ numerator: 4, denominator: 4, tick: 0 }],
    barlines: [],
    tempos: [],
    dynamics: [],
    pedals: [],
    notes: [
      { id: 'c-8th', pitch: { pitchClass: 1, octave: 4 }, startTick: 0, durationTicks: 24, hand: 'RH', velocity: 90 }, // Blue 8th -> void
      { id: 'c-quarter', pitch: { pitchClass: 1, octave: 4 }, startTick: 48, durationTicks: 48, hand: 'RH', velocity: 90 }, // Orange Quarter -> void
      { id: 'c-half', pitch: { pitchClass: 1, octave: 4 }, startTick: 96, durationTicks: 96, hand: 'RH', velocity: 90 }, // Red Half -> void (no tint 0.18)
    ],
  };

  const alphaAtFill: number[] = [];
  let cAlpha = 1.0;
  const cStack: number[] = [];
  const cCtx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    get globalAlpha() {
      return cAlpha;
    },
    set globalAlpha(v: number) {
      cAlpha = v;
    },
    font: '',
    textAlign: '',
    textBaseline: '',
    save: () => {
      cStack.push(cAlpha);
    },
    restore: () => {
      cAlpha = cStack.pop() ?? 1.0;
    },
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    fill: () => {
      alphaAtFill.push(cAlpha);
    },
    fillRect: () => {},
    arc: () => {},
    ellipse: () => {},
    roundRect: () => {},
    fillText: () => {},
    setLineDash: () => {},
  } as unknown as CanvasRenderingContext2D;

  renderScoreToCanvas(cCtx, canvasDurationScore, {
    orientation: 'vertical',
    staffStyle: 'tritone-split',
    noteheadMorphology: 'rectangle-square',
    colorMode: 'duration-class',
    zoom: 1.0,
    pixelsPerTick: 2.0,
    pixelsPerSemitone: 11,
    showHandCrossings: false,
    showBarlines: false,
    showGridLines: false,
    currentTick: 0,
  });

  const tintFills = alphaAtFill.filter((a) => Math.abs(a - 0.18) < 0.01);
  assert.equal(tintFills.length, 0, 'Canvas must render zero faint tint (globalAlpha = 0.18); Red notes maintain pure void fill');
});

test('Piano Roll View: 1:1 Geometric Equivalence & Chromatic DAW Alignment', () => {
  const score = buildBachGoldbergVar1Score();
  const options = {
    orientation: 'vertical' as const,
    staffStyle: 'tritone-split' as const,
    noteheadMorphology: 'rectangle-square' as const,
    colorMode: 'duration-class' as const,
    zoom: 1.0,
    pixelsPerTick: 2.0,
    pixelsPerSemitone: 11,
    showHandCrossings: false,
    showBarlines: true,
    showGridLines: true,
    currentTick: 96,
  };

  // Dimensions must be 100% identical between Isomorphic and Piano Roll
  const isoDims = calculateScoreDimensions(score, { ...options, viewMode: 'isomorphic' });
  const rollDims = calculateScoreDimensions(score, { ...options, viewMode: 'pianoroll' });

  assert.equal(isoDims.width, rollDims.width, 'Width must be identical across view modes');
  assert.equal(isoDims.height, rollDims.height, 'Height must be identical across view modes');
  assert.equal(isoDims.minPitch, rollDims.minPitch, 'Pitch bounds must be identical');
  assert.equal(isoDims.maxPitch, rollDims.maxPitch, 'Pitch bounds must be identical');

  // Verify Canvas renders piano roll note blocks and piano keyboard
  let filledRects = 0;
  const mockCtx = {
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    fill: () => {},
    fillRect: () => { filledRects++; },
    strokeRect: () => {},
    roundRect: () => {},
    fillText: () => {},
    setLineDash: () => {},
  } as unknown as CanvasRenderingContext2D;

  renderScoreToCanvas(mockCtx, score, { ...options, viewMode: 'pianoroll' });

  // Each note renders at least 2 fillRects (body + onset accent) plus keyboard and lanes
  assert.ok(filledRects >= score.notes.length * 2, 'Every note must be rendered as a fast fillRect duration block');
});


test('Option 1: Klavarskribo Beat Grid renders horizontal pulse lines in canvas and SVG', () => {
  const score = buildBachGoldbergVar1Score();

  // Test SVG Print Layout
  const layout = computeColumnarLayout(score, {
    showBeatGrid: true,
    showGutterBrackets: false,
  });
  const svgs = renderAllPagesToSvg(layout);
  const page1 = svgs[0];

  assert.ok(page1.includes('Klavarskribo Beat Grid'), 'SVG must include Klavarskribo Beat Grid comments');
  assert.ok(page1.includes('stroke-dasharray="2,3"'), 'SVG beat grid must use dashed line styling');
  assert.ok(page1.includes('Beat 2'), 'SVG must render Beat 2 pulse line');
  assert.ok(page1.includes('Beat 3'), 'SVG must render Beat 3 pulse line');

  // Test Canvas Rendering
  let setLineDashCalledWith: number[] | null = null;
  const recordedLines: { x1: number; y1: number; x2: number; y2: number; stroke: string }[] = [];
  const mockCtx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: (x: number, y: number) => {
      (mockCtx as any)._startX = x;
      (mockCtx as any)._startY = y;
    },
    lineTo: (x: number, y: number) => {
      recordedLines.push({
        x1: (mockCtx as any)._startX,
        y1: (mockCtx as any)._startY,
        x2: x,
        y2: y,
        stroke: String(mockCtx.strokeStyle),
      });
    },
    stroke: () => {},
    fill: () => {},
    fillRect: () => {},
    arc: () => {},
    ellipse: () => {},
    roundRect: () => {},
    fillText: () => {},
    setLineDash: (arr: number[]) => {
      if (arr.length === 2 && arr[0] === 2 && arr[1] === 3) {
        setLineDashCalledWith = arr;
      }
    },
  } as unknown as CanvasRenderingContext2D;

  renderScoreToCanvas(mockCtx, score, {
    orientation: 'vertical',
    staffStyle: 'tritone-split',
    noteheadMorphology: 'rectangle-square',
    colorMode: 'duration-class',
    zoom: 1.0,
    pixelsPerTick: 2.0,
    pixelsPerSemitone: 14,
    showHandCrossings: false,
    showBarlines: true,
    showGridLines: true,
    showBeatGrid: true,
    currentTick: 0,
  });

  assert.deepEqual(setLineDashCalledWith, [2, 3], 'Canvas must configure dotted line dash for beat grid');
  // Horizontal lines across staff (y1 === y2)
  const horizontalGridLines = recordedLines.filter(l => l.y1 === l.y2 && l.x1 !== l.x2);
  assert.ok(horizontalGridLines.length > 32, 'Canvas must render horizontal beat grid pulse lines across measures');
});

test('Option 2: Gutter Beat Brackets renders margin brackets in canvas and SVG with active playback glow', () => {
  const score = buildBachGoldbergVar1Score();

  // Test SVG Print Layout
  const layout = computeColumnarLayout(score, {
    showBeatGrid: false,
    showGutterBrackets: true,
  });
  const svgs = renderAllPagesToSvg(layout);
  const page1 = svgs[0];

  assert.ok(page1.includes('LH Gutter Bracket'), 'SVG must include LH Gutter Brackets in left margin');
  assert.ok(page1.includes('RH Gutter Bracket'), 'SVG must include RH Gutter Brackets in right margin');
  assert.ok(page1.includes('fill="none" stroke="#6B7280"'), 'SVG must render bracket stroke');

  // Test Canvas Rendering with Active Playback Glow
  const filledTexts: { text: string; fillStyle: string; x: number; y: number }[] = [];
  const strokes: { strokeStyle: string; lineWidth: number }[] = [];
  const mockCtx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {
      strokes.push({ strokeStyle: String(mockCtx.strokeStyle), lineWidth: mockCtx.lineWidth });
    },
    fill: () => {},
    fillRect: () => {},
    arc: () => {},
    ellipse: () => {},
    roundRect: () => {},
    fillText: (text: string, x: number, y: number) => {
      filledTexts.push({ text, fillStyle: String(mockCtx.fillStyle), x, y });
    },
    setLineDash: () => {},
  } as unknown as CanvasRenderingContext2D;

  renderScoreToCanvas(mockCtx, score, {
    orientation: 'vertical',
    staffStyle: 'tritone-split',
    noteheadMorphology: 'rectangle-square',
    colorMode: 'duration-class',
    zoom: 1.0,
    pixelsPerTick: 2.0,
    pixelsPerSemitone: 14,
    showHandCrossings: false,
    showBarlines: false,
    showGridLines: true,
    showBeatGrid: false,
    showGutterBrackets: true,
    currentTick: 0,
  });

  // Active bracket at currentTick 0 must glow gold #FACC15
  const activeStrokes = strokes.filter(s => s.strokeStyle === '#FACC15' && s.lineWidth === 2.0);
  assert.ok(activeStrokes.length > 0, 'Active gutter bracket must glow with gold #FACC15 during playback');

  // Beat numbers in gutter
  const beatLabels = filledTexts.filter(t => t.text === '1' || t.text === '2' || t.text === '3');
  assert.ok(beatLabels.length > 0, 'Canvas must render beat numbers in outer margins');
  const activeLabels = beatLabels.filter(t => t.fillStyle === '#FACC15');
  assert.ok(activeLabels.length > 0, 'Active beat label must glow with gold #FACC15');
});

test('Comparative Combinations: Beat Grid and Gutter Brackets toggle independently', () => {
  const score = buildBachGoldbergVar1Score();

  // Both enabled simultaneously
  const layoutBoth = computeColumnarLayout(score, {
    showBeatGrid: true,
    showGutterBrackets: true,
  });
  const svgBoth = renderAllPagesToSvg(layoutBoth)[0];
  assert.ok(svgBoth.includes('Klavarskribo Beat Grid'), 'Beat Grid present when enabled');
  assert.ok(svgBoth.includes('Gutter Bracket'), 'Brackets present when enabled');

  // Only Beat Grid (pure Klavarskribo philosophy)
  const layoutKlavarOnly = computeColumnarLayout(score, {
    showBeatGrid: true,
    showGutterBrackets: false,
  });
  const svgKlavar = renderAllPagesToSvg(layoutKlavarOnly)[0];
  assert.ok(svgKlavar.includes('Klavarskribo Beat Grid'), 'Beat Grid present');
  assert.ok(!svgKlavar.includes('Gutter Bracket'), 'Brackets absent');

  // Only Gutter Brackets (pure pitch space)
  const layoutBracketsOnly = computeColumnarLayout(score, {
    showBeatGrid: false,
    showGutterBrackets: true,
  });
  const svgBrackets = renderAllPagesToSvg(layoutBracketsOnly)[0];
  assert.ok(!svgBrackets.includes('Klavarskribo Beat Grid'), 'Beat Grid absent');
  assert.ok(svgBrackets.includes('Gutter Bracket'), 'Brackets present');
});

test('Staff-Bounded Barline Invariant: barlines strictly span [staffMin, staffMax] with zero overhang and authoritative contrast', () => {
  const score = buildBachGoldbergVar1Score();
  const recordedLines: { x1: number; y1: number; x2: number; y2: number; stroke: string; width: number }[] = [];
  const recordedTexts: { text: string; x: number; y: number }[] = [];
  let currentStroke = '';
  let currentWidth = 1;

  const mockCtx = {
    fillStyle: '',
    set strokeStyle(val: string) {
      currentStroke = val;
    },
    get strokeStyle() {
      return currentStroke;
    },
    set lineWidth(val: number) {
      currentWidth = val;
    },
    get lineWidth() {
      return currentWidth;
    },
    font: '',
    textAlign: '',
    textBaseline: '',
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: (x: number, y: number) => {
      (mockCtx as any)._startX = x;
      (mockCtx as any)._startY = y;
    },
    lineTo: (x: number, y: number) => {
      recordedLines.push({
        x1: (mockCtx as any)._startX,
        y1: (mockCtx as any)._startY,
        x2: x,
        y2: y,
        stroke: currentStroke,
        width: currentWidth,
      });
    },
    stroke: () => {},
    fill: () => {},
    fillRect: () => {},
    arc: () => {},
    ellipse: () => {},
    roundRect: () => {},
    fillText: (text: string, x: number, y: number) => {
      recordedTexts.push({ text: String(text), x, y });
    },
    setLineDash: () => {},
  } as unknown as CanvasRenderingContext2D;

  const paddingPitch = 40;
  const pixelsPerSemitone = 14;

  const renderOpts = {
    orientation: 'vertical' as const,
    staffStyle: 'tritone-split' as const,
    noteheadMorphology: 'rectangle-square' as const,
    colorMode: 'duration-class' as const,
    zoom: 1.0,
    pixelsPerTick: 2.0,
    pixelsPerSemitone,
    showHandCrossings: false,
    showBarlines: true,
    showGridLines: true,
    showBeatGrid: false,
    currentTick: 0,
  };

  const vertDims = calculateScoreDimensions(score, renderOpts);
  const staffMinX = paddingPitch;
  const staffMaxX = paddingPitch + (vertDims.maxPitch - vertDims.minPitch) * pixelsPerSemitone;

  renderScoreToCanvas(mockCtx, score, renderOpts);

  // Filter barlines: horizontal lines with stroke rgba(255, 255, 255, 0.55) or rgba(255, 255, 255, 0.85)
  const barlines = recordedLines.filter(
    (l) => l.y1 === l.y2 && (l.stroke.includes('0.55') || l.stroke.includes('0.85'))
  );

  assert.ok(barlines.length >= 32, 'Must render at least 32 barlines for Goldberg Var 1');

  // Verify bounded coordinates: x1 === staffMinX and x2 === staffMaxX (zero overhang)
  for (const bar of barlines) {
    assert.equal(bar.x1, staffMinX, `Barline x1 must strictly equal staffMinX (${staffMinX})`);
    assert.equal(bar.x2, staffMaxX, `Barline x2 must strictly equal staffMaxX (${staffMaxX})`);
  }

  // Verify zero lines spill to margins 15 or width - 15
  const sprawlingLines = recordedLines.filter((l) => l.x1 === 15 || l.x2 === 15);
  assert.equal(sprawlingLines.length, 0, 'Zero barlines should spill into canvas margin 15');

  // Verify clean measure numbering: no 'M' prefix, discrete measure numbers (e.g. 1, 5, 9)
  const measureLabels = recordedTexts.filter((t) => /^\d+$/.test(t.text));
  assert.ok(measureLabels.length > 0, 'Discrete measure numbers must be rendered');
  const clunkyLabels = recordedTexts.filter((t) => /^M\d+$/.test(t.text));
  assert.equal(clunkyLabels.length, 0, 'Zero repetitive M{barNumber} labels should be rendered');

  // Also verify horizontal canvas
  recordedLines.length = 0;
  renderScoreToCanvas(mockCtx, score, {
    orientation: 'horizontal',
    staffStyle: 'tritone-split',
    noteheadMorphology: 'rectangle-square',
    colorMode: 'duration-class',
    zoom: 1.0,
    pixelsPerTick: 2.0,
    pixelsPerSemitone,
    showHandCrossings: false,
    showBarlines: true,
    showGridLines: true,
    showBeatGrid: false,
    currentTick: 0,
  });

  const dims = calculateScoreDimensions(score, {
    orientation: 'horizontal',
    staffStyle: 'tritone-split',
    noteheadMorphology: 'rectangle-square',
    colorMode: 'duration-class',
    zoom: 1.0,
    pixelsPerTick: 2.0,
    pixelsPerSemitone,
    showHandCrossings: false,
    showBarlines: true,
    showGridLines: true,
    currentTick: 0,
  });

  const staffMinY = dims.height - paddingPitch - (dims.maxPitch - dims.minPitch) * pixelsPerSemitone;
  const staffMaxY = dims.height - paddingPitch;

  const horizBarlines = recordedLines.filter(
    (l) => l.x1 === l.x2 && (l.stroke.includes('0.55') || l.stroke.includes('0.85'))
  );
  assert.ok(horizBarlines.length >= 32, 'Must render at least 32 barlines in horizontal orientation');
  for (const bar of horizBarlines) {
    assert.equal(bar.y1, staffMinY, `Horizontal barline y1 must strictly equal staffMinY (${staffMinY})`);
    assert.equal(bar.y2, staffMaxY, `Horizontal barline y2 must strictly equal staffMaxY (${staffMaxY})`);
  }
});

test('Left-Gutter Beat Counter Invariant: beats 1, 2, 3 align with pulse lines in vertical canvas and SVG print layout', () => {
  const score = buildBachGoldbergVar1Score();

  // 1. Canvas Left-Gutter Beat Counter verification
  const recordedTexts: { text: string; x: number; y: number }[] = [];
  const mockCtx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    fill: () => {},
    fillRect: () => {},
    arc: () => {},
    ellipse: () => {},
    roundRect: () => {},
    fillText: (text: string, x: number, y: number) => {
      recordedTexts.push({ text: String(text), x, y });
    },
    setLineDash: () => {},
  } as unknown as CanvasRenderingContext2D;

  const paddingPitch = 40;
  const staffMinX = paddingPitch;

  renderScoreToCanvas(mockCtx, score, {
    orientation: 'vertical',
    staffStyle: 'tritone-split',
    noteheadMorphology: 'rectangle-square',
    colorMode: 'duration-class',
    zoom: 1.0,
    pixelsPerTick: 2.0,
    pixelsPerSemitone: 14,
    showHandCrossings: false,
    showBarlines: true,
    showGridLines: true,
    showBeatGrid: true,
    currentTick: 0,
  });

  // Find beat counter texts positioned at staffMinX - 10
  const gutterBeatCounts = recordedTexts.filter((t) => t.x === staffMinX - 10);
  assert.ok(gutterBeatCounts.length > 0, 'Canvas must render beat counts along left margin at staffMinX - 10');

  const count1 = gutterBeatCounts.filter((t) => t.text === '1');
  const count2 = gutterBeatCounts.filter((t) => t.text === '2');
  const count3 = gutterBeatCounts.filter((t) => t.text === '3');

  assert.ok(count1.length >= 32, 'Must render Beat 1 aligned with solid barline for each measure');
  assert.ok(count2.length >= 32, 'Must render Beat 2 aligned with pulse line for each measure');
  assert.ok(count3.length >= 32, 'Must render Beat 3 aligned with pulse line for each measure');

  // 2. SVG Print Layout Left-Gutter Beat Counter verification
  const layout = computeColumnarLayout(score, {
    showBeatGrid: true,
    showGutterBrackets: false,
  });
  const svgs = renderAllPagesToSvg(layout);
  const page1 = svgs[0];

  assert.doesNotMatch(page1, /class="beat-counter"/, 'SVG must NOT include beat-counter text');
  assert.match(page1, /stroke-dasharray="2,3"/, 'SVG must include dashed pulse lines for beat subdivisions');
});

test('Beams Abandonment in Toggle UI Invariant: UI excludes Beams toggle and defaults to independent Klavar lateral stems', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');

  // App.tsx verification
  const appTsxPath = path.resolve('src/ui/App.tsx');
  const appSrc = fs.readFileSync(appTsxPath, 'utf-8');
  assert.ok(!appSrc.includes('Toggle Beams'), 'App.tsx must not have Beams quick-toggle button');
  assert.ok(!appSrc.includes('<span>🎶</span>'), 'App.tsx must not contain Beams quick toggle icon');

  // ControlsDrawer.tsx verification
  const drawerTsxPath = path.resolve('src/ui/ControlsDrawer.tsx');
  const drawerSrc = fs.readFileSync(drawerTsxPath, 'utf-8');
  assert.ok(!drawerSrc.includes('Elaine Gould Beams'), 'ControlsDrawer.tsx must not have Elaine Gould Beams checkbox');

  // Default option verification: showBeamGrouping completely removed
  const { computeColumnarLayout } = await import('../src/render/print-layout');
  const score = buildBachGoldbergVar1Score();
  const defaultLayout = computeColumnarLayout(score);
  assert.ok(!('showBeamGrouping' in defaultLayout.options), 'showBeamGrouping must be completely removed from options');
});

test('No-Toggle Clean UI Invariant: UI excludes rhythmic toggles, showGutterBrackets removed, and showBeatGrid defaults to true', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');

  // App.tsx verification: floating toolbar renders without the rhythmic toggle buttons
  const appTsxPath = path.resolve('src/ui/App.tsx');
  const appSrc = fs.readFileSync(appTsxPath, 'utf-8');
  assert.ok(!appSrc.includes('Toggle Beat Grid'), 'App.tsx must not have Beat Grid quick-toggle button');
  assert.ok(!appSrc.includes('Toggle Gutter Brackets'), 'App.tsx must not have Gutter Brackets quick-toggle button');
  assert.ok(!appSrc.includes('Quick Metric & Rhythmic Legibility Toggles'), 'App.tsx must not contain metric toggle group in floating toolbar');
  assert.ok(appSrc.includes('showBeatGrid: true'), 'App.tsx must default showBeatGrid to true');

  // ControlsDrawer.tsx verification: showGutterBrackets checkbox removed
  const drawerTsxPath = path.resolve('src/ui/ControlsDrawer.tsx');
  const drawerSrc = fs.readFileSync(drawerTsxPath, 'utf-8');
  assert.ok(!drawerSrc.includes('showGutterBrackets'), 'ControlsDrawer.tsx must not have showGutterBrackets checkbox');

  // Default layout options
  const { computeColumnarLayout } = await import('../src/render/print-layout');
  const score = buildBachGoldbergVar1Score();
  const defaultLayout = computeColumnarLayout(score);
  assert.equal(defaultLayout.options.showBeatGrid, true, 'Default showBeatGrid must be true');
  assert.equal(defaultLayout.options.showGutterBrackets, false, 'Default showGutterBrackets must be false');
  assert.equal(defaultLayout.options.octaveExtensionMode, 'spillover', 'Default octaveExtensionMode must be spillover');
});

test('Canvas Local Dashed Outlier Lines and Urtext Typography Invariants', () => {
  const score = buildBachGoldbergVar1Score();
  const recordedLines: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    stroke: string;
    width: number;
    dash: number[];
  }[] = [];
  const recordedTexts: { text: string; x: number; y: number; font: string }[] = [];

  let currentStroke = '';
  let currentWidth = 1;
  let currentDash: number[] = [];
  let currentFont = '';

  const mockCtx = {
    fillStyle: '',
    set strokeStyle(val: string) {
      currentStroke = val;
    },
    get strokeStyle() {
      return currentStroke;
    },
    set lineWidth(val: number) {
      currentWidth = val;
    },
    get lineWidth() {
      return currentWidth;
    },
    set font(val: string) {
      currentFont = val;
    },
    get font() {
      return currentFont;
    },
    textAlign: '',
    textBaseline: '',
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: (x: number, y: number) => {
      (mockCtx as any)._startX = x;
      (mockCtx as any)._startY = y;
    },
    lineTo: (x: number, y: number) => {
      recordedLines.push({
        x1: (mockCtx as any)._startX,
        y1: (mockCtx as any)._startY,
        x2: x,
        y2: y,
        stroke: currentStroke,
        width: currentWidth,
        dash: [...currentDash],
      });
    },
    stroke: () => {},
    fill: () => {},
    fillRect: () => {},
    arc: () => {},
    ellipse: () => {},
    roundRect: () => {},
    fillText: (text: string, x: number, y: number) => {
      recordedTexts.push({ text: String(text), x, y, font: currentFont });
    },
    setLineDash: (segments: number[]) => {
      currentDash = [...segments];
    },
  } as unknown as CanvasRenderingContext2D;

  const paddingPitch = 40;
  const pixelsPerSemitone = 14;

  const renderOpts = {
    orientation: 'vertical' as const,
    staffStyle: 'tritone-split' as const,
    noteheadMorphology: 'rectangle-square' as const,
    colorMode: 'duration-class' as const,
    zoom: 1.0,
    pixelsPerTick: 2.0,
    pixelsPerSemitone,
    showHandCrossings: false,
    showBarlines: true,
    showGridLines: true,
    showBeatGrid: false,
    currentTick: 0,
  };

  const vertDims = calculateScoreDimensions(score, renderOpts);
  assert.equal(vertDims.minPitch, 24, 'minPitch must be 24 (m1)');
  assert.equal(vertDims.maxPitch, 72, 'maxPitch must be 72 (m5)');

  renderScoreToCanvas(mockCtx, score, renderOpts);

  // 1. Local Dashed Outlier Line Invariant:
  // Landmark 5 at pitch 76 (E6): x = 40 + (76 - 24) * 14 = 768.
  const pitch76X = paddingPitch + (76 - vertDims.minPitch) * pixelsPerSemitone;
  const outlierLines76 = recordedLines.filter((l) => l.x1 === pitch76X && l.x2 === pitch76X);

  // Must render for mm. 29 and 30 (2 segments), and zero for mm. 1-28
  assert.equal(outlierLines76.length, 2, 'Must render exactly 2 segments for mm. 29 and 30 at pitch 76');

  // Verify dashed pattern [5, 2.5]
  for (const seg of outlierLines76) {
    assert.deepEqual(seg.dash, [5, 2.5], 'Outlier Landmark 5 line must be dashed with [5, 2.5]');
  }

  // Ticks for mm. 29 and 30
  // m29: tick 4032..4176, y: 60 + 4032*2 = 8124 to 60 + 4176*2 = 8412
  // m30: tick 4176..4320, y: 60 + 4176*2 = 8412 to 60 + 4320*2 = 8700
  assert.equal(outlierLines76[0].y1, 60 + 4032 * 2);
  assert.equal(outlierLines76[0].y2, 60 + 4176 * 2);
  assert.equal(outlierLines76[1].y1, 60 + 4176 * 2);
  assert.equal(outlierLines76[1].y2, 60 + 4320 * 2);

  // Verify mm. 1-28 have ZERO lines at pitch 76
  const earlyLines76 = outlierLines76.filter((l) => l.y1 < 60 + 4032 * 2);
  assert.equal(earlyLines76.length, 0, 'No outlier staff lines should be rendered before m. 29');

  // 2. Urtext Typography Invariant:
  // Octave markers (m1, m3, m5)
  const m1Label = recordedTexts.find((t) => t.text === 'm1');
  const m3Label = recordedTexts.find((t) => t.text === 'm3');
  const m5Label = recordedTexts.find((t) => t.text === 'm5');
  assert.ok(m1Label, 'm1 label must be rendered');
  assert.ok(m3Label, 'm3 label must be rendered');
  assert.ok(m5Label, 'm5 label must be rendered');
  assert.equal(m1Label.font, 'italic bold 11px "Century Schoolbook", "Baskerville", "Liberation Serif", serif');
  assert.equal(m3Label.font, 'italic bold 11px "Century Schoolbook", "Baskerville", "Liberation Serif", serif');
  assert.equal(m5Label.font, 'italic bold 11px "Century Schoolbook", "Baskerville", "Liberation Serif", serif');

  // Measure numbers (e.g. 1, 5, 9, etc.)
  const measureLabels = recordedTexts.filter((t) => /^\d+$/.test(t.text) && t.x === 14);
  assert.ok(measureLabels.length > 0, 'Discrete measure numbers must be rendered');
  for (const mLabel of measureLabels) {
    assert.equal(mLabel.font, 'italic 11px "Century Schoolbook", "Baskerville", "Liberation Serif", serif');
  }
});





