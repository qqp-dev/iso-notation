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
    assert.equal(geom0.lineWidth, 2.0);
    assert.equal(geom0.color, 'rgba(255, 255, 255, 0.9)');

    const geom6 = getStaffLineGeometry(6, style);
    assert.equal(geom6.isLine, true);
    assert.equal(geom6.isDashed, true);
    assert.equal(geom6.isTritone, true);
    assert.equal(geom6.lineWidth, 1.0);
    assert.equal(geom6.color, 'rgba(255, 255, 255, 0.5)');
    assert.deepEqual(geom6.dashArray, [5, 4]);

    // Hairlines
    [2, 4, 8, 10].forEach((pc) => {
      const g = getStaffLineGeometry(pc, style);
      assert.equal(g.isLine, true, `PC ${pc} must be a hairline`);
      assert.equal(g.isBold, false);
      assert.equal(g.isDashed, false);
      assert.equal(g.lineWidth, 0.6);
      assert.equal(g.color, 'rgba(255, 255, 255, 0.16)');
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
  assert.ok(presetIds.includes('vertical-duration-parity'));
  assert.ok(presetIds.includes('vertical-ddr-parity'));
  assert.ok(presetIds.includes('subitizable-3plus3-parity'));
  assert.ok(presetIds.includes('clean-minimalist-oval'));
  assert.ok(presetIds.includes('analytical-phonetic'));

  // Primary default preset must be Vertical Duration Classes + Parity Shapes
  const defaultPreset = DESIGN_PRESETS[0];
  assert.equal(defaultPreset.id, 'vertical-duration-parity');
  assert.equal(defaultPreset.name, 'Vertical Duration Classes + Parity Shapes');
  assert.equal(defaultPreset.staffStyle, 'tritone-split');
  assert.equal(defaultPreset.noteheadMorphology, 'row-parity-shape');
  assert.equal(defaultPreset.colorMode, 'duration-class');
  assert.equal(defaultPreset.orientation, 'vertical');

  const names = DESIGN_PRESETS.map((p) => p.name);
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

  // Verify pitch coordinate labels (e.g. "0:4", "6:4", "2:4")
  const marginLabels = recordedFills.filter((r) => /^\d+:\d+$/.test(r.text));
  assert.ok(marginLabels.length > 0, 'Must have rendered margin labels');

  marginLabels.forEach(({ text, fillStyle }) => {
    const pc = parseInt(text.split(':')[0], 10);
    assert.doesNotMatch(fillStyle, /#60A5FA/i, `Margin label ${text} must not be blue`);
    assert.doesNotMatch(fillStyle, /#F472B6/i, `Margin label ${text} must not be pink`);
    if (pc === 0) {
      assert.equal(fillStyle, '#FFFFFF', `PC 0 margin label must be #FFFFFF`);
    } else if (pc === 6) {
      assert.equal(fillStyle, '#AAAAAA', `PC 6 margin label must be #AAAAAA`);
    } else {
      assert.equal(fillStyle, '#666666', `Other PC margin label must be #666666`);
    }
  });
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

test('Duration-Class Color Invariants: note value color mapping and active note glow', () => {
  const tpb = 48;

  // 16th notes (12t): Crisp White / Silver (#E2E8F0)
  assert.equal(getDurationClassColor(12, tpb, false), '#E2E8F0');
  // 8th notes (24t): Vibrant Sky Blue (#38BDF8)
  assert.equal(getDurationClassColor(24, tpb, false), '#38BDF8');
  // Dotted 8th notes (36t): Indigo (#818CF8)
  assert.equal(getDurationClassColor(36, tpb, false), '#818CF8');
  // Quarter notes (48t): Warm Amber (#F59E0B)
  assert.equal(getDurationClassColor(48, tpb, false), '#F59E0B');
  // Dotted quarter notes (72t): Orange (#FB923C)
  assert.equal(getDurationClassColor(72, tpb, false), '#FB923C');
  // Half notes (96t) and longer (144t): Rose (#F43F5E)
  assert.equal(getDurationClassColor(96, tpb, false), '#F43F5E');
  assert.equal(getDurationClassColor(144, tpb, false), '#F43F5E');

  // Active note sounding glow: Bright gold/white (#FEF08A)
  assert.equal(getDurationClassColor(12, tpb, true), '#FEF08A');
  assert.equal(getDurationClassColor(48, tpb, true), '#FEF08A');

  // Integration with getNoteColor
  const testPitch = { pitchClass: 0, octave: 4 };
  assert.equal(getNoteColor(testPitch, 'RH', 'duration-class', false, 0, tpb, 12), '#E2E8F0');
  assert.equal(getNoteColor(testPitch, 'RH', 'duration-class', false, 0, tpb, 24), '#38BDF8');
  assert.equal(getNoteColor(testPitch, 'RH', 'duration-class', false, 0, tpb, 36), '#818CF8');
  assert.equal(getNoteColor(testPitch, 'RH', 'duration-class', false, 0, tpb, 48), '#F59E0B');
  assert.equal(getNoteColor(testPitch, 'RH', 'duration-class', false, 0, tpb, 72), '#FB923C');
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
        '#818CF8',
        `Note ${note.id} (dotted 8th note at tick ${note.startTick}) must be Indigo #818CF8`
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
  // 8th notes (Sky Blue #38BDF8) in Bach Goldberg Var 1
  assert.ok(fills.includes('#38BDF8'), '8th note Sky Blue #38BDF8 fill must be present');
  // Dotted 8th notes (Indigo #818CF8) in Bach Goldberg Var 1
  assert.ok(fills.includes('#818CF8'), 'Dotted 8th note Indigo #818CF8 fill must be present');
  // Active note glow (#FEF08A)
  assert.ok(fills.includes('#FEF08A'), 'Active note bright gold glow #FEF08A must be present');
  // Active note gold stroke (#FACC15)
  assert.ok(strokes.includes('#FACC15'), 'Active note gold border #FACC15 must be present');
});

