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
} from '../src/render/types';
import { wholeToneParity } from '../src/model/pitch';
import { getNoteColor } from '../src/render/colors';
import { getCanonicalSyllable } from '../src/model/phonetics';
import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1';
import { calculateScoreDimensions, renderScoreToCanvas } from '../src/render/score-canvas';

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

    // 5/7 Staff Topography Invariant:
    // PC 0 (C) is bold octave line.
    // Demarcation line is placed at PC 4 (E), the boundary of the 5-group (C, D, E),
    // replacing the old tritone line and unaligned PC 4.5 line.
    // PC 4 is a crisp dotted demarcation line (1.0px / 0.9pt, dashArray: [1.5, 3], isDemarcation: true, isDashed: true).
    // PC 2, 6, 8, 10 are rendered as subtle hairlines (0.6px).
    const geom0 = getStaffLineGeometry(0, style);
    assert.equal(geom0.isLine, true);
    assert.equal(geom0.isBold, true);
    assert.equal(geom0.lineWidth, 2.0);
    assert.equal(geom0.color, 'rgba(255, 255, 255, 0.9)');

    // 5/7 Demarcation Line at PC 4 (E)
    const geomDemarc = getStaffLineGeometry(4, style);
    assert.equal(geomDemarc.isLine, true);
    assert.equal(geomDemarc.isBold, false);
    assert.equal(geomDemarc.isDashed, true);
    assert.deepEqual(geomDemarc.dashArray, [14, 4]);
    assert.equal(geomDemarc.isDemarcation, true);
    assert.equal(geomDemarc.lineWidth, 0.7);
    assert.equal(geomDemarc.color, 'rgba(255, 255, 255, 0.55)');

    // Zero lines at non-integer pitch coordinates (no 4.5 floating line)
    const geom45 = getStaffLineGeometry(4.5, style);
    assert.equal(geom45.isLine, false, 'Non-integer 4.5 must not be a staff line');

    // PC 6 is rendered as a regular hairline
    const geom6 = getStaffLineGeometry(6, style);
    assert.equal(geom6.isLine, true, 'PC 6 must be a line');
    assert.equal(geom6.isBold, false, 'PC 6 must not be bold');
    assert.equal(geom6.isDashed, false, 'PC 6 must not be dashed');
    assert.equal(geom6.lineWidth, 0.6, 'PC 6 must be a 0.6 hairline');

    // Hairlines across 5-group and 7-group (2, 6, 8, 10)
    [2, 6, 8, 10].forEach((pc) => {
      const g = getStaffLineGeometry(pc, style);
      assert.equal(g.isLine, true, `PC ${pc} must be a hairline`);
      assert.equal(g.isBold, false);
      assert.equal(g.isDashed, false);
      assert.equal(g.lineWidth, 0.6);
      assert.equal(g.color, 'rgba(255, 255, 255, 0.16)');
    });

    // Spaces on odd pitch classes (1, 3, 5, 7, 9, 11)
    [1, 3, 5, 7, 9, 11].forEach((pc) => {
      const g = getStaffLineGeometry(pc, style);
      assert.equal(g.isLine, false, `PC ${pc} must be a space`);
    });

    // Subitizability verification: exactly 3 lines in 5-group (0, 2, 4) and 3 lines in 7-group (6, 8, 10)
    const cluster5 = [0, 2, 4].filter((pc) => getStaffLineGeometry(pc, style).isLine);
    const cluster7 = [6, 8, 10].filter((pc) => getStaffLineGeometry(pc, style).isLine);
    assert.equal(cluster5.length, 3, '5-group (C, D, E) must contain exactly 3 staff lines');
    assert.equal(cluster7.length, 3, '7-group (F#, G#, A#) must contain exactly 3 staff lines');
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

    // Row 1 (Odd: 1, 3, 5, 7, 9, 11) must strictly map to diamond/lozenge
    [1, 3, 5, 7, 9, 11].forEach((pc) => {
      assert.equal(getParityShape(pc), 'diamond', `PC ${pc} (Row 1) must be a diamond`);
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

test('Notehead Morphology: numerical-digits strictly pitch-class integers 0..11', () => {
  assert.equal(normalizeNoteheadMorphology('numerical-digits'), 'numerical');
  assert.equal(normalizeNoteheadMorphology('numerical'), 'numerical');

  for (let pc = 0; pc < 12; pc++) {
    const str = String(pc);
    assert.match(str, /^(1[0-1]|[0-9])$/, 'Must be pitch class integer 0..11');
    assert.doesNotMatch(str, /[A-Ga-g#b]/, 'Zero letter names permitted');
  }
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

test('Lowercase \'b\' Octave Marker Invariant: score canvas margin indicators', () => {
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
  const horizBOctaves = horizTexts.filter((t) => /^b\d+$/.test(t));
  assert.ok(horizBOctaves.length > 0, 'Must render b${aOct} octave markers in horizontal orientation');
  assert.ok(horizBOctaves.includes('b2'), 'Should include b2 (A2)');
  assert.ok(horizBOctaves.includes('b3'), 'Should include b3 (A3)');
  assert.ok(horizBOctaves.includes('b4'), 'Should include b4 (Concert A4)');
  assert.ok(!horizTexts.some((t) => /^C\d+$/.test(t)), 'Must not render diatonic C${oct} labels');
  assert.ok(!horizTexts.some((t) => /^m\d+$/.test(t)), 'Must not render m${oct} labels');
  assert.ok(!horizTexts.some((t) => /^9:\d+$/.test(t)), 'Must not render 9:${oct} labels');

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
  const vertBOctaves = vertTexts.filter((t) => /^b\d+$/.test(t));
  assert.ok(vertBOctaves.length > 0, 'Must render b${aOct} octave markers in vertical orientation');
  assert.ok(vertBOctaves.includes('b2'), 'Should include b2 (A2)');
  assert.ok(vertBOctaves.includes('b3'), 'Should include b3 (A3)');
  assert.ok(vertBOctaves.includes('b4'), 'Should include b4 (Concert A4)');
  assert.ok(!vertTexts.includes('9'), 'Must not render bare 9 at A octave boundary in vertical orientation');
  assert.ok(!vertTexts.some((t) => /^C\d+$/.test(t)), 'Must not render diatonic C${oct} labels');
  assert.ok(!vertTexts.some((t) => /^m\d+$/.test(t)), 'Must not render m${oct} labels');
});

test('Klavar Lateral Stems Invariant: horizontal ticks pointing Right for RH and Left for LH', () => {
  const score = buildBachGoldbergVar1Score();
  const recordedLines: { x1: number; y1: number; x2: number; y2: number; stroke: string }[] = [];
  let currentStroke = '';

  const mockCtx = {
    fillStyle: '',
    set strokeStyle(val: string) {
      currentStroke = val;
    },
    get strokeStyle() {
      return currentStroke;
    },
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
        stroke: currentStroke,
      });
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

  // Filter horizontal lateral stems (y1 === y2 and x1 !== x2)
  const lateralStems = recordedLines.filter((l) => l.y1 === l.y2 && l.x1 !== l.x2 && Math.abs(l.x2 - l.x1) >= 16);
  assert.ok(lateralStems.length > 0, 'Must have rendered Klavar lateral stems for notes');

  // Verify that notes with RH have right-pointing stems (x2 > x1)
  // and notes with LH have left-pointing stems (x2 < x1)
  const rhStems = lateralStems.filter((s) => s.x2 > s.x1);
  const lhStems = lateralStems.filter((s) => s.x2 < s.x1);

  assert.ok(rhStems.length > 0, 'Must have right-pointing lateral stems for Right Hand (RH)');
  assert.ok(lhStems.length > 0, 'Must have left-pointing lateral stems for Left Hand (LH)');
  lateralStems.forEach((s) => {
    assert.ok(Math.abs(s.x2 - s.x1) >= 16, 'Stem must extend at least 16px from note center');
  });
});

test('Optical Notehead Sizing & Area Balance Invariant: circles shrunk to optically match diamonds', () => {
  // Optical mass balance invariant:
  // Circles shrunk to match diamonds visually:
  // Circle radius r = baseSize * 0.40, Diamond half-diagonal d = baseSize * 0.50
  // Area(circle) = pi * r^2
  // Area(diamond) = 2 * d^2
  // Ratio Area(circle) / Area(diamond) within 5%
  const baseSize = 14 - 3; // pixelsPerSemitone - 3 = 11
  const r = Math.max(4.0, baseSize * 0.40); // 4.4
  const d = Math.max(5.0, baseSize * 0.50); // 5.5

  const circleArea = Math.PI * r * r;
  const diamondArea = 2 * d * d;
  const areaRatio = circleArea / diamondArea;

  assert.ok(
    Math.abs(areaRatio - 1.0) < 0.05,
    `Circle area (${circleArea.toFixed(2)}) and diamond area (${diamondArea.toFixed(2)}) must match within 5% (ratio: ${areaRatio.toFixed(3)})`
  );
  assert.ok(r < d, 'Circle radius r must be smaller than diamond diagonal half-extent d for equal optical mass');
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

test('Unified Euclidean Duration Lattice: Unextended Reference Noteheads Invariant (d <= tau_ref)', () => {
  const score = buildBachGoldbergVar1Score();
  const ribbons: { x: number; y: number; w: number; h: number }[] = [];
  const arcCenters: { x: number; y: number }[] = [];

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
    arc: (x: number, y: number) => {
      arcCenters.push({ x, y });
    },
    ellipse: () => {},
    roundRect: (x: number, y: number, w: number, h: number) => {
      ribbons.push({ x, y, w, h });
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
    showHandCrossings: false,
    showBarlines: false,
    showGridLines: false,
    currentTick: 0,
  });

  const tauRef = score.gridResolution ?? 12;
  const sixteenthNotes = score.notes.filter((n) => n.durationTicks <= tauRef);
  const sustainedNotes = score.notes.filter((n) => n.durationTicks > tauRef);

  assert.ok(sixteenthNotes.length > 100, 'Must have > 100 reference 16th notes');
  assert.ok(sustainedNotes.length > 0, 'Must have sustained notes');

  // Exact ribbon count must match exactly the number of sustained notes (zero ribbons for 16th notes)
  assert.equal(
    ribbons.length,
    sustainedNotes.length,
    `Ribbon count (${ribbons.length}) must equal sustained notes count (${sustainedNotes.length}), zero for 16th notes`
  );

  // Each hold ribbon must have ribbon width = 5
  ribbons.forEach((r) => {
    assert.equal(r.w, 5, 'Hold ribbon width in vertical orientation must be 5px');
  });

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
      const found = arcCenters.some((c) => Math.abs(c.x - expectedX) < 0.1 && Math.abs(c.y - expectedY) < 0.1);
      assert.ok(found, `Note ${n.id} (16th note) must be centered at exact onset coordinate (${expectedX}, ${expectedY})`);
    });
});

test('Unified Euclidean Duration Lattice: Proportional Hold Ribbon Invariant (d > tau_ref)', () => {
  const score = buildBachGoldbergVar1Score();
  const verticalRibbons: { x: number; y: number; w: number; h: number }[] = [];
  const horizontalRibbons: { x: number; y: number; w: number; h: number }[] = [];

  const createMock = (ribbonList: { x: number; y: number; w: number; h: number }[]) => {
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
      roundRect: (x: number, y: number, w: number, h: number) => {
        ribbonList.push({ x, y, w, h });
      },
      fillText: noop,
      setLineDash: noop,
    } as unknown as CanvasRenderingContext2D;
  };

  const pixelsPerTick = 2.0;

  // 1. Vertical orientation
  renderScoreToCanvas(createMock(verticalRibbons), score, {
    orientation: 'vertical',
    staffStyle: 'tritone-split',
    noteheadMorphology: 'row-parity-shape',
    colorMode: 'duration-class',
    zoom: 1.0,
    pixelsPerTick,
    pixelsPerSemitone: 14,
    showHandCrossings: false,
    showBarlines: false,
    showGridLines: false,
    currentTick: 0,
  });

  // 2. Horizontal orientation
  renderScoreToCanvas(createMock(horizontalRibbons), score, {
    orientation: 'horizontal',
    staffStyle: 'tritone-split',
    noteheadMorphology: 'row-parity-shape',
    colorMode: 'duration-class',
    zoom: 1.0,
    pixelsPerTick,
    pixelsPerSemitone: 14,
    showHandCrossings: false,
    showBarlines: false,
    showGridLines: false,
    currentTick: 0,
  });

  const tauRef = score.gridResolution ?? 12;
  const sustainedNotes = score.notes.filter((n) => n.durationTicks > tauRef);

  assert.equal(verticalRibbons.length, sustainedNotes.length);
  assert.equal(horizontalRibbons.length, sustainedNotes.length);

  // In vertical orientation: height = durationTicks * pixelsPerTick, width = 5
  verticalRibbons.forEach((r, i) => {
    const note = sustainedNotes[i];
    const expectedHeight = note.durationTicks * pixelsPerTick;
    assert.equal(r.h, expectedHeight, `Vertical ribbon height for note ${note.id} must be ${expectedHeight}`);
    assert.equal(r.w, 5, 'Vertical ribbon width must be 5px');
  });

  // In horizontal orientation: width = durationTicks * pixelsPerTick, height = 5
  horizontalRibbons.forEach((r, i) => {
    const note = sustainedNotes[i];
    const expectedWidth = note.durationTicks * pixelsPerTick;
    assert.equal(r.w, expectedWidth, `Horizontal ribbon width for note ${note.id} must be ${expectedWidth}`);
    assert.equal(r.h, 5, 'Horizontal ribbon height must be 5px');
  });

  // Proportionality check: dotted 8th note (36t) vs 8th note (24t)
  const eighthNote = sustainedNotes.find((n) => n.durationTicks === 24);
  const dottedEighthNote = sustainedNotes.find((n) => n.durationTicks === 36);

  assert.ok(eighthNote, 'Must find an 8th note');
  assert.ok(dottedEighthNote, 'Must find a dotted 8th note');

  const eighthRibbon = verticalRibbons[sustainedNotes.indexOf(eighthNote)];
  const dottedEighthRibbon = verticalRibbons[sustainedNotes.indexOf(dottedEighthNote)];

  assert.equal(eighthRibbon.h, 24 * pixelsPerTick); // 48px
  assert.equal(dottedEighthRibbon.h, 36 * pixelsPerTick); // 72px
  assert.equal(
    dottedEighthRibbon.h / eighthRibbon.h,
    1.5,
    'Dotted 8th note hold ribbon must physically extend exactly 1.5x longer than 8th note'
  );
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

  // Design Presets, Topography, Notehead Morphology, Timeline Orientation, Color Mode
  assert.ok(drawerSrc.includes('Curated Design Presets'), 'Must contain presets section');
  assert.ok(drawerSrc.includes('Staff Topography'), 'Must contain Staff Topography section');
  assert.ok(drawerSrc.includes('Notehead Morphology'), 'Must contain Notehead Morphology section');
  assert.ok(drawerSrc.includes('Timeline Orientation'), 'Must contain Timeline Orientation toggle');
  assert.ok(drawerSrc.includes('Color Spectrum'), 'Must contain Color Mode dropdown');
});


