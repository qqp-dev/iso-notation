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
  RenderOptions,
} from '../src/render/types';
import { wholeToneParity } from '../src/model/pitch';
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

test('Staff Topography: tritone-split-3plus3 subitizable partitioning invariants', () => {
  const styles: StaffStyle[] = ['tritone-split-3plus3', 'tritone-split'];
  for (const style of styles) {
    assert.equal(normalizeStaffStyle(style), 'tritone-split');

    // Group A: 0, 2, 4. Group B: 6, 8, 10.
    // PC 0 is bold/double (octave boundary).
    // PC 6 is dashed (tritone landmark).
    // PC 2, 4, 8, 10 are hairlines.
    // Odd PCs (1, 3, 5, 7, 9, 11) are spaces.
    const geom0 = getStaffLineGeometry(0, style);
    assert.equal(geom0.isLine, true);
    assert.equal(geom0.isBold, true);
    assert.ok(geom0.lineWidth >= 1.8);

    const geom6 = getStaffLineGeometry(6, style);
    assert.equal(geom6.isLine, true);
    assert.equal(geom6.isDashed, true);
    assert.equal(geom6.isTritone, true);
    assert.ok(Array.isArray(geom6.dashArray) && geom6.dashArray.length > 0);

    // Hairlines
    [2, 4, 8, 10].forEach((pc) => {
      const g = getStaffLineGeometry(pc, style);
      assert.equal(g.isLine, true, `PC ${pc} must be a hairline`);
      assert.equal(g.isBold, false);
      assert.equal(g.isDashed, false);
      assert.ok(g.lineWidth <= 0.8);
    });

    // Spaces
    [1, 3, 5, 7, 9, 11].forEach((pc) => {
      const g = getStaffLineGeometry(pc, style);
      assert.equal(g.isLine, false, `PC ${pc} must be a space`);
    });

    // Subitizability verification: two 3-line clusters separated by landmark
    const cluster1 = [0, 2, 4].filter((pc) => getStaffLineGeometry(pc, style).isLine);
    const cluster2 = [6, 8, 10].filter((pc) => getStaffLineGeometry(pc, style).isLine);
    assert.equal(cluster1.length, 3, 'First triplet cluster must contain exactly 3 lines');
    assert.equal(cluster2.length, 3, 'Second triplet cluster must contain exactly 3 lines');
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
    'Ma', 'Di', 'Va', 'Pi', 'La', 'Ri',
    'Na', 'Ti', 'Fa', 'Bi', 'Sa', 'Ki'
  ];

  assert.equal(normalizeNoteheadMorphology('phonetic-tokens'), 'phonetic');
  assert.equal(normalizeNoteheadMorphology('phonetic'), 'phonetic');

  expectedSyllables.forEach((syl, pc) => {
    assert.equal(getCanonicalSyllable(pc), syl, `PC ${pc} must be ${syl}`);
  });
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
  assert.ok(presetIds.includes('subitizable-3plus3-parity'));
  assert.ok(presetIds.includes('clean-minimalist-oval'));
  assert.ok(presetIds.includes('analytical-phonetic'));

  const names = DESIGN_PRESETS.map((p) => p.name);
  assert.ok(names.includes('Subitizable 3+3 + Parity Shapes'));
  assert.ok(names.includes('Clean Minimalist Oval'));
  assert.ok(names.includes('Analytical Phonetic'));

  DESIGN_PRESETS.forEach((p) => {
    assert.ok(normalizeStaffStyle(p.staffStyle), `Preset ${p.id} has valid staffStyle`);
    assert.ok(normalizeNoteheadMorphology(p.noteheadMorphology), `Preset ${p.id} has valid noteheadMorphology`);
  });
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

  for (const staffStyle of staffStyles) {
    for (const noteheadMorphology of morphologies) {
      for (const orientation of orientations) {
        const options: RenderOptions = {
          orientation,
          staffStyle,
          noteheadMorphology,
          colorMode: 'wholetone-duality',
          zoom: 1.0,
          pixelsPerTick: 0.35,
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
});
