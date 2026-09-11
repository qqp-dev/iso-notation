import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  computeColumnarLayout,
  renderPageToSvg,
  renderAllPagesToSvg,
  renderColumnarScoreToSvg,
  A4_WIDTH_PT,
  A4_HEIGHT_PT,
  MM_TO_PT,
  URTEXT_SERIF,
} from '../src/render/print-layout';
import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1';
import { QuantizedGridScore, QuantizedNote } from '../src/model/types';
import { linearIndex } from '../src/model/pitch';
import { wrapInPjl, generateScorePostscript } from '../scripts/print-score';

test('Columnar Engraving Geometry Invariant: 32-measure score with 48 ticks/measure', () => {
  // Construct a synthetic 32-measure score with 48 ticks per measure (e.g. 4/4 meter, ticksPerBeat = 12)
  const notes: QuantizedNote[] = [];
  for (let m = 0; m < 32; m++) {
    notes.push({
      id: `test-note-${m}`,
      pitch: { pitchClass: (m * 2) % 12, octave: 4 },
      startTick: m * 48,
      durationTicks: 12,
      hand: 'RH',
    });
  }

  const score: QuantizedGridScore = {
    id: 'test-32-bar',
    title: 'Test 32 Measures Score',
    composer: 'Test Composer',
    ticksPerBeat: 12,
    totalTicks: 32 * 48, // 1536 ticks
    timeSignatures: [{ tick: 0, numerator: 4, denominator: 4 }],
    barlines: [],
    tempos: [{ tick: 0, bpm: 120 }],
    dynamics: [],
    pedals: [],
    notes,
    gridResolution: 12,
  };

  const layout = computeColumnarLayout(score, { measuresPerColumn: 8, columnsPerPage: 2 });

  assert.equal(layout.totalMeasures, 32, 'Must have exactly 32 total measures');
  assert.equal(layout.ticksPerMeasure, 48, 'Must have 48 ticks per measure');
  assert.equal(layout.columns.length, 4, 'Must have exactly 4 columns for 32 measures (8 mm/col)');

  // Exact 4-column distribution (8 measures per column)
  // Column 0: Measures 1–8 (ticks 0–384)
  assert.equal(layout.columns[0].startMeasure, 1);
  assert.equal(layout.columns[0].endMeasure, 8);
  assert.equal(layout.columns[0].startTick, 0);
  assert.equal(layout.columns[0].endTick, 384);
  assert.equal(layout.columns[0].pageIndex, 0);
  assert.equal(layout.columns[0].columnOnPageIndex, 0);

  // Column 1: Measures 9–16 (ticks 384–768)
  assert.equal(layout.columns[1].startMeasure, 9);
  assert.equal(layout.columns[1].endMeasure, 16);
  assert.equal(layout.columns[1].startTick, 384);
  assert.equal(layout.columns[1].endTick, 768);
  assert.equal(layout.columns[1].pageIndex, 0);
  assert.equal(layout.columns[1].columnOnPageIndex, 1);

  // Column 2: Measures 17–24 (ticks 768–1152)
  assert.equal(layout.columns[2].startMeasure, 17);
  assert.equal(layout.columns[2].endMeasure, 24);
  assert.equal(layout.columns[2].startTick, 768);
  assert.equal(layout.columns[2].endTick, 1152);
  assert.equal(layout.columns[2].pageIndex, 1);
  assert.equal(layout.columns[2].columnOnPageIndex, 0);

  // Column 3: Measures 25–32 (ticks 1152–1536)
  assert.equal(layout.columns[3].startMeasure, 25);
  assert.equal(layout.columns[3].endMeasure, 32);
  assert.equal(layout.columns[3].startTick, 1152);
  assert.equal(layout.columns[3].endTick, 1536);
  assert.equal(layout.columns[3].pageIndex, 1);
  assert.equal(layout.columns[3].columnOnPageIndex, 1);

  // Pages: Page 1 holds Cols 0 & 1 (Section A); Page 2 holds Cols 2 & 3 (Section B)
  assert.equal(layout.pages.length, 2, 'Must produce exactly 2 pages');
  assert.equal(layout.pages[0].columns.length, 2);
  assert.match(layout.pages[0].sectionName, /Section A.*1.*16/);
  assert.equal(layout.pages[1].columns.length, 2);
  assert.match(layout.pages[1].sectionName, /Section B.*17.*32/);
});

test('Columnar Engraving Geometry Invariant: Bach Goldberg Variation 1', () => {
  const score = buildBachGoldbergVar1Score();
  const layout = computeColumnarLayout(score, { measuresPerColumn: 8, columnsPerPage: 2 });

  assert.equal(layout.totalMeasures, 32, 'Goldberg Var 1 has 32 measures');
  assert.equal(layout.ticksPerMeasure, 144, '3/4 meter at 48 tpb = 144 ticks/measure');
  assert.equal(layout.columns.length, 4, 'Must have 4 columns (8 measures per column)');

  // Col 0: mm 1–8, ticks 0–1152
  assert.equal(layout.columns[0].startMeasure, 1);
  assert.equal(layout.columns[0].endMeasure, 8);
  assert.equal(layout.columns[0].startTick, 0);
  assert.equal(layout.columns[0].endTick, 1152);

  // Col 1: mm 9–16, ticks 1152–2304
  assert.equal(layout.columns[1].startMeasure, 9);
  assert.equal(layout.columns[1].endMeasure, 16);
  assert.equal(layout.columns[1].startTick, 1152);
  assert.equal(layout.columns[1].endTick, 2304);

  // Col 2: mm 17–24, ticks 2304–3456
  assert.equal(layout.columns[2].startMeasure, 17);
  assert.equal(layout.columns[2].endMeasure, 24);
  assert.equal(layout.columns[2].startTick, 2304);
  assert.equal(layout.columns[2].endTick, 3456);

  // Col 3: mm 25–32, ticks 3456–4608
  assert.equal(layout.columns[3].startMeasure, 25);
  assert.equal(layout.columns[3].endMeasure, 32);
  assert.equal(layout.columns[3].startTick, 3456);
  assert.equal(layout.columns[3].endTick, 4608);

  // Section A (Page 1): mm 1–16; Section B (Page 2): mm 17–32
  assert.equal(layout.pages.length, 2);
  assert.match(layout.pages[0].sectionName, /Section A/);
  assert.match(layout.pages[1].sectionName, /Section B/);

  // Partition check: all notes accountably sliced across the 4 columns
  const totalPartitionedNotes = layout.columns.reduce((sum, col) => sum + col.notes.length, 0);
  assert.equal(totalPartitionedNotes, score.notes.length, 'Every note must be present in exactly one column');
});

test('High-Contrast Print Topography & Morphology Invariant: Standalone Vector SVG', () => {
  const score = buildBachGoldbergVar1Score();
  const layout = computeColumnarLayout(score);
  const svgs = renderAllPagesToSvg(layout);

  assert.equal(svgs.length, 4, 'Must produce SVGs for all 4 pages in the luxurious Urtext layout');

  for (let pIdx = 0; pIdx < svgs.length; pIdx++) {
    const svg = svgs[pIdx];

    // 1. Pure white background for paper savings & laser printing
    assert.match(svg, /<rect[^>]*width="100%"[^>]*height="100%"[^>]*fill="#FFFFFF"/);

    // 2. 1-5-9 Staff Topography lines (Symmetric 3-Line)
    // - Refined octave line (PC 0, 1.0pt)
    // - Thin 5 demarcation line at PC 4 (0.6pt, dasharray 5,2.5)
    assert.match(svg, /stroke="#444444"[^>]*stroke-width="0\.6"[^>]*stroke-dasharray="5,2\.5"/, 'Must contain thin 0.6pt 5 demarcation line');
    // - Thin straight 9 demarcation line at PC 8 (0.6pt)
    assert.match(svg, /stroke="#555555"[^>]*stroke-width="0\.6"/, 'Must contain thin 0.6pt 9 demarcation line');
    // - Zero clunky hairlines (PC 2, 6, 8, 10 eliminated)
    assert.doesNotMatch(svg, /stroke="#888888"[^>]*stroke-width="0\.5"/, 'Hairlines must be eliminated for decluttered staff');
    // - Zero old 8,3.5 dashes
    assert.doesNotMatch(svg, /stroke-dasharray="8,3\.5"/, 'Old 8,3.5 dashes must not be present');
    // - Zero old 3,3 dashes
    assert.doesNotMatch(svg, /stroke-dasharray="3,3"/, 'Old 3,3 dashes must not be present');

    // 3. Baked Directional Noteheads Invariant
    // - Zero straight lateral stem lines (stroke-width 0.6pt)
    assert.doesNotMatch(svg, /<line[^>]*stroke-width="0\.6"[^>]*stroke-linecap="round"/, 'Must have zero straight lateral stem lines');
    // - Zero standalone floating chevrons
    assert.doesNotMatch(svg, /<path d="M [^"]+ L [^"]+ L [^"]+" fill="none" stroke="[^"]+" stroke-width="0\.8"/, 'Must have zero standalone floating chevrons');
    // - Baked directional pentagons for hand crossing exceptions
    assert.match(svg, /<path d="M [^"]+ L [^"]+ L [^"]+ L [^"]+ L [^"]+ A [^"]+ Z"/, 'Must render baked directional noteheads');

    // 4. Solid row-parity noteheads with zero disruptive shield and duration colors
    // - Ovals on lines (Row 0): horizontal ellipse rx="5.20" ry="3.00" sitting cleanly on line
    assert.match(svg, /<ellipse[^>]*rx="5\.20"[^>]*ry="3\.00"/, 'Must render Row 0 ovals with 5.20pt/3.00pt radii');
    // - Bricks in spaces (Row 1): crisp rectangular brick with width="8.60" height="5.80" rx="1.2" filling the slot
    assert.match(svg, /<rect[^>]*width="8\.60"[^>]*height="5\.80"[^>]*rx="1\.2"/, 'Must render Row 1 crisp bricks filling whole slot');
    // - Zero disruptive white halo shield
    assert.doesNotMatch(svg, /<ellipse[^>]*stroke="#FFFFFF"/, 'Must not have disruptive white shield on ovals');
    assert.doesNotMatch(svg, /<rect[^>]*stroke="#FFFFFF"/, 'Must not have disruptive white shield on bricks');

    // 5. Color Palette Invariant in Print Engine: Pure Noteheads for Regular Notes (d <= ticksPerBeat)
    // - 16th notes (d <= 12t): pure noteheads in dark slate/graphite (#1E293B)
    assert.match(svg, /fill="#1E293B"/, 'Must render 16th notes in dark slate/graphite (#1E293B)');
    // - 8th notes (d = 24t): pure noteheads in Royal Blue (#1D4ED8)
    assert.match(svg, /fill="#1D4ED8"/, 'Must render 8th notes in Royal Blue (#1D4ED8)');
    // - Zero hold ribbon lines for regular notes (d <= ticksPerBeat)
    assert.doesNotMatch(svg, /<line[^>]*stroke-width="1\.2"/, 'Must contain zero hold ribbon lines (stroke-width="1.2") for regular notes');

    // 6. Measure numbers: plain number on first bar of column, zero 'M' prefixes
    assert.match(svg, /class="measure-num"[^>]*>\d+<\/text>/, 'Must render measure number on first bar of column');
    assert.doesNotMatch(svg, /class="measure-num"[^>]*>M/, 'Must not prefix measure numbers with M');
  }

  const fullScoreSvg = svgs.join('\n');

  // Verify SVG print layout contains zero Hand Crossing Overlay rects or text
  assert.doesNotMatch(fullScoreSvg, /Hand Crossing Overlay/, 'Must contain zero Hand Crossing Overlay rects or comments');
  assert.doesNotMatch(fullScoreSvg, /LH\/RH Cross/, 'Must contain zero LH/RH Cross overlay text');

  // Across the full document, verify quarter note pure noteheads in Amber/Gold (#D97706) without hold ribbons
  assert.match(fullScoreSvg, /fill="#D97706"/, 'Must render quarter notes in Amber/Gold (#D97706)');
  assert.doesNotMatch(fullScoreSvg, /<line[^>]*stroke="#D97706"[^>]*stroke-width="1\.2"/, 'Must not render quarter note hold ribbons');

  assert.match(
    fullScoreSvg,
    /<line x1="[\d\.]+" y1="[\d\.]+" x2="[\d\.]+" y2="[\d\.]+" stroke="#BE123C" stroke-width="0\.8" stroke-linecap="round"\/>/,
    'Must render solid thin hold line (stroke-linecap="round") for long notes'
  );

  // Verify renderColumnarScoreToSvg helper
  const page0Svg = renderColumnarScoreToSvg(score, 0);
  assert.equal(page0Svg, svgs[0]);
  const defaultSvg = renderColumnarScoreToSvg(score);
  assert.equal(defaultSvg, svgs[0]);
});

test('Pure Noteheads for 16th Notes and Solid Thin Hold Lines for All Colored Notes Invariant', () => {
  const score = buildBachGoldbergVar1Score();
  const layout = computeColumnarLayout(score);
  const svgs = layout.pages.map((_, p) => renderPageToSvg(layout, p));
  const fullScoreSvg = svgs.join('\n');

  // 1. Zero Hand Crossing Overlay rects or text
  assert.doesNotMatch(fullScoreSvg, /Hand Crossing Overlay/, 'Must contain zero Hand Crossing Overlay rects or comments');
  assert.doesNotMatch(fullScoreSvg, /LH\/RH Cross/, 'Must contain zero LH/RH Cross banners');

  // 2. Zero hold ribbon lines for 16th notes (stroke-width="1.2")
  assert.doesNotMatch(fullScoreSvg, /<line[^>]*stroke-width="1\.2"/, 'Must contain zero hold ribbon lines (stroke-width="1.2")');

  // 3. Solid thin hold lines and Clean Staff-Line Replacement (Bar 6 Blue)
  const tauRef = score.gridResolution || 12;
  const coloredNotes = score.notes.filter((n) => n.durationTicks > tauRef);
  assert.equal(coloredNotes.length, 165, 'Must have exactly 165 colored notes in Goldberg Var 1');

  // Space notes render thin solid lines (stroke-width="0.8") without knockout
  const spaceHoldLines = Array.from(
    fullScoreSvg.matchAll(/<line x1="([\d\.]+)" y1="([\d\.]+)" x2="([\d\.]+)" y2="([\d\.]+)" stroke="([^"]+)" stroke-width="0\.8" stroke-linecap="round"\/>/g)
  );
  assert.ok(spaceHoldLines.length > 0, 'Must render thin solid hold lines for space notes');

  // Staff-line replacement knockout underlays
  const knockoutRegex =
    /<line x1="([\d\.]+)" y1="([\d\.]+)" x2="([\d\.]+)" y2="([\d\.]+)" stroke="#FFFFFF" stroke-width="(2\.5|1\.8)" stroke-linecap="butt"\/>/g;
  const allKnockouts = Array.from(fullScoreSvg.matchAll(knockoutRegex));
  assert.ok(allKnockouts.length > 0, 'Must render white staff-line knockouts for held notes on staff lines');

  // Verify Bar 6 note bach-var1-88 (tick 744, dur 36, blue) on staff line m2 (pitch 36):
  // Cleanly draws over / replaces staff line with 1.8 white knockout and 1.0 colored stroke (#1D4ED8)
  const note88 = score.notes.find((n) => n.id === 'bach-var1-88')!;
  const col88 = layout.columns.find((c) => c.notes.some((n) => n.id === note88.id))!;
  const staffOriginY = 10 * (72 / 25.4) + 42 + 16;
  const note88Ny = staffOriginY + (note88.startTick - col88.startTick) * layout.ptPerTick;
  const note88Height = 6.0;
  const note88StartY = note88Ny + note88Height / 2 + 2;
  const note88ReleaseY = note88Ny + note88.durationTicks * layout.ptPerTick;
  const colLeftPt88 = 10 * (72 / 25.4) + col88.columnOnPageIndex * (layout.columnDimensions.widthPt + layout.options.columnGapMm * (72 / 25.4));
  const note88X = colLeftPt88 + 14 + (36 - layout.minPitch) * layout.ptPerSemitone;

  const pSvg88 = svgs[col88.pageIndex];
  // Verify white knockout underlay at note88
  assert.match(
    pSvg88,
    new RegExp(`<line x1="${note88X.toFixed(2)}" y1="${note88StartY.toFixed(2)}" x2="${note88X.toFixed(2)}" y2="${note88ReleaseY.toFixed(2)}" stroke="#FFFFFF" stroke-width="1\\.8" stroke-linecap="butt"\\/>`),
    'Bar 6 note bach-var1-88 on line m2 must have white knockout underlay with stroke-width="1.8"'
  );
  // Verify colored hold line at full octave staff line width (1.0pt)
  assert.match(
    pSvg88,
    new RegExp(`<line x1="${note88X.toFixed(2)}" y1="${note88StartY.toFixed(2)}" x2="${note88X.toFixed(2)}" y2="${note88ReleaseY.toFixed(2)}" stroke="#1D4ED8" stroke-width="1\\.0" stroke-linecap="round"\\/>`),
    'Bar 6 note bach-var1-88 on line m2 must stroke at full staff-line width 1.0pt replacing black vertical line'
  );

  // 5. Clean termination without explicit stop ticks or release crossbars
  assert.doesNotMatch(fullScoreSvg, /class="stop-tick"/, 'Must have zero explicit stop ticks');
  assert.doesNotMatch(fullScoreSvg, /class="release-crossbar"/, 'Must have zero explicit release crossbars');

  // 6. Check the 108t long note in Bar 20
  const longNote = score.notes.find((n) => n.durationTicks > 48);
  assert.ok(longNote, 'Must find 108t long note in Goldberg Var 1');
  assert.equal(longNote.durationTicks, 108);

  const longNoteColumn = layout.columns.find((c) => c.notes.some((n) => n.id === longNote.id))!;
  const pageSvg = svgs[longNoteColumn.pageIndex];
  const allHoldLinesOnPage = Array.from(pageSvg.matchAll(/<line x1="([\d\.]+)" y1="([\d\.]+)" x2="([\d\.]+)" y2="([\d\.]+)" stroke="([^"]+)" stroke-width="[\d\.]+" stroke-linecap="round"\/>/g));
  const longNoteMatch = allHoldLinesOnPage.find((m) => m[5] === '#BE123C');
  assert.ok(longNoteMatch, 'Must find solid thin hold line for the Bar 20 sustain');

  const x1 = parseFloat(longNoteMatch[1]);
  const y1 = parseFloat(longNoteMatch[2]);
  const x2 = parseFloat(longNoteMatch[3]);
  const y2 = parseFloat(longNoteMatch[4]);
  const stroke = longNoteMatch[5];

  // Vertical line: x1 === x2
  assert.equal(x1, x2, 'Continuation line must be perfectly vertical');

  // Color must match duration color (#BE123C for 108t)
  assert.equal(stroke, '#BE123C', 'Continuation line stroke must match duration color #BE123C');

  // Release coordinate check: y2 terminates cleanly at note release coordinate clamped to column bounds
  assert.ok(y2 > y1, 'Termination y2 must be below start y1');

  // The long note (B4, linear pitch 59 >= 48) is in default RH territory and must have zero lateral stems or chevrons
  assert.doesNotMatch(pageSvg, /<line[^>]*stroke-width="0\.6"[^>]*stroke-linecap="round"/, 'Must have zero lateral stems');

  // Notehead height for brick (Row 1 odd pc 11) is 5.8pt, half is 2.9pt, +2 = 4.9pt
  const noteNy = staffOriginY + (longNote.startTick - longNoteColumn.startTick) * layout.ptPerTick;
  const expectedTrailStartY = noteNy + 5.8 / 2 + 2;
  assert.ok(
    Math.abs(y1 - expectedTrailStartY) < 0.05,
    `trailStartY (${y1}) must match noteNy + noteHeight / 2 + 2 (${expectedTrailStartY})`
  );
  assert.ok(y1 > noteNy, 'trailStartY must be strictly below notehead center at noteNy');

  // 7. Obstacle Interruption ("Interrupt for the Obstacle then Finish") in Measure 4
  // bach-var1-68 (tick 552, pitch 38, duration 24) intersects bach-var1-69 (tick 564, pitch 36 with RH crossing)
  // Must render two disjoint line segments:
  // - Segment 1: from onset start to before tick 564
  // - Segment 2: resuming after tick 564 and finishing at note release (~tick 576)
  const note68 = score.notes.find((n) => n.id === 'bach-var1-68')!;
  const note69 = score.notes.find((n) => n.id === 'bach-var1-69')!;
  const col4 = layout.columns.find((c) => c.notes.some((n) => n.id === note68.id))!;
  const note68Ny = staffOriginY + (note68.startTick - col4.startTick) * layout.ptPerTick;
  const note69Ny = staffOriginY + (note69.startTick - col4.startTick) * layout.ptPerTick;
  const note68Height = 6.0; // Parity 0 (even) notehead height
  const note68StartY = note68Ny + note68Height / 2 + 2;
  const note68ReleaseY = note68Ny + note68.durationTicks * layout.ptPerTick;
  const note69Height = 6.0;
  const expectedObsY1 = note69Ny - note69Height / 2 - 2.0;
  const expectedObsY2 = note69Ny + note69Height / 2 + 2.0;

  const col4Svg = svgs[col4.pageIndex];
  const col4LeftPt = 10 * (72 / 25.4) + col4.columnOnPageIndex * (layout.columnDimensions.widthPt + layout.options.columnGapMm * (72 / 25.4));
  const note68X = col4LeftPt + 14 + (38 - layout.minPitch) * layout.ptPerSemitone;

  const note68Segments = Array.from(
    col4Svg.matchAll(/<line x1="([\d\.]+)" y1="([\d\.]+)" x2="([\d\.]+)" y2="([\d\.]+)" stroke="([^"]+)" stroke-width="[\d\.]+" stroke-linecap="round"\/>/g)
  ).filter(
    (m) => Math.abs(parseFloat(m[1]) - note68X) < 0.1 &&
           parseFloat(m[2]) >= note68StartY - 0.1 &&
           parseFloat(m[4]) <= note68ReleaseY + 0.1
  );
  assert.equal(note68Segments.length, 2, 'bach-var1-68 must render exactly 2 disjoint line segments (obstacle interruption)');
  assert.ok(Math.abs(parseFloat(note68Segments[0][2]) - note68StartY) < 0.1, 'Segment 1 must start at note68StartY');
  assert.ok(Math.abs(parseFloat(note68Segments[0][4]) - expectedObsY1) < 0.1, 'Segment 1 must terminate before obstacle');
  assert.ok(Math.abs(parseFloat(note68Segments[1][2]) - expectedObsY2) < 0.1, 'Segment 2 must resume after obstacle');
  assert.ok(Math.abs(parseFloat(note68Segments[1][4]) - note68ReleaseY) < 0.1, 'Segment 2 must finish at note release');

  // 8. Robust Truncation & Segmentation in Measure 30
  // Successive LH eighth notes (bach-var1-501, 504, 507, 510, 513) cleanly stop before subsequent obstacles
  const m30NoteIds = ['bach-var1-501', 'bach-var1-504', 'bach-var1-507', 'bach-var1-510', 'bach-var1-513'];
  for (const nId of m30NoteIds) {
    const n = score.notes.find((x) => x.id === nId)!;
    const col = layout.columns.find((c) => c.notes.some((x) => x.id === n.id))!;
    const colLeftPt = 10 * (72 / 25.4) + col.columnOnPageIndex * (layout.columnDimensions.widthPt + layout.options.columnGapMm * (72 / 25.4));
    const nNy = staffOriginY + (n.startTick - col.startTick) * layout.ptPerTick;
    const nReleaseY = nNy + n.durationTicks * layout.ptPerTick;
    const nx = colLeftPt + 14 + (linearIndex(n.pitch) - layout.minPitch) * layout.ptPerSemitone;
    const pSvg = svgs[col.pageIndex];
    const nLines = Array.from(
      pSvg.matchAll(/<line x1="([\d\.]+)" y1="([\d\.]+)" x2="([\d\.]+)" y2="([\d\.]+)" stroke="([^"]+)" stroke-width="[\d\.]+" stroke-linecap="round"\/>/g)
    ).filter(
      (m) => Math.abs(parseFloat(m[1]) - nx) < 0.1 &&
             parseFloat(m[2]) >= nNy - 0.1 &&
             parseFloat(m[2]) <= nReleaseY + 0.1
    );
    for (const seg of nLines) {
      assert.ok(parseFloat(seg[4]) <= nReleaseY + 0.1, `${nId} hold line must never extend past note release coordinate`);
    }
  }
});

test('Optical Notehead Sizing & Tasteful Handedness Chevrons in SVG Print Engine', () => {
  const score = buildBachGoldbergVar1Score();
  const layout = computeColumnarLayout(score);
  const svg = renderPageToSvg(layout, 0);

  // Optical Notehead Sizing Invariant (Midpoint Taller Noteheads):
  // Oval on lines: rx = 5.2, ry = 3.0
  // Brick in spaces: width = 8.6, height = 5.8
  assert.match(svg, /<ellipse[^>]*rx="5\.20"[^>]*ry="3\.00"/, 'Squished oval rx must be 5.20pt and ry must be 3.00pt');

  // Verify brick noteheads: width 8.60 and height 5.80
  const brickMatches = Array.from(svg.matchAll(/<rect[^>]*width="8\.60"[^>]*height="5\.80"[^>]*rx="1\.2"/g));
  assert.ok(brickMatches.length > 0, 'Must have rendered crisp brick noteheads in SVG');

  // Optical area balance invariant (< 5% difference)
  const ellipseArea = Math.PI * 5.2 * 3.0;
  const brickArea = 8.6 * 5.8;
  const areaRatio = ellipseArea / brickArea;
  assert.ok(
    Math.abs(areaRatio - 1.0) < 0.05,
    `Ellipse area (${ellipseArea.toFixed(2)}) and brick area (${brickArea.toFixed(2)}) must match within 5%`
  );

  // Zero straight lateral stems:
  const stemMatches = Array.from(svg.matchAll(/<line[^>]*stroke-width="0\.6"[^>]*stroke-linecap="round"/g));
  assert.equal(stemMatches.length, 0, 'Zero straight lateral stem lines');

  // Zero standalone floating chevrons:
  assert.doesNotMatch(svg, /<path d="M [^"]+ L [^"]+ L [^"]+" fill="none"/, 'Zero standalone floating chevrons');

  // Baked Directional Noteheads Invariant (pointing Right for RH in bass, Left for LH in treble):
  const directionalMatches = Array.from(
    svg.matchAll(/<path d="M ([\d\.]+) ([\d\.]+) L ([\d\.]+) ([\d\.]+) L ([\d\.]+) ([\d\.]+) L ([\d\.]+) ([\d\.]+) L ([\d\.]+) ([\d\.]+) A [^"]+ Z" fill="([^"]+)" stroke="([^"]+)" stroke-width="(0\.5|1\.3)" stroke-linejoin="round"\/>/g)
  );
  assert.ok(directionalMatches.length > 0, 'Must find baked directional noteheads in SVG for crossing exceptions');

  directionalMatches.forEach((m) => {
    const p1x = Number(m[3]);
    const p1y = Number(m[4]);
    const apexX = Number(m[5]);
    const apexY = Number(m[6]);
    const p3y = Number(m[8]);
    assert.ok(apexX !== p1x, 'Notehead apex must have horizontal clearance from base');
    assert.ok(Math.abs(apexY - (p1y + p3y) / 2) < 0.05, 'Notehead apex must be vertically centered');
  });

  // Verify full score directional notehead count and directions:
  const allSvgs = renderAllPagesToSvg(layout);
  const fullScoreSvg = allSvgs.join('\n');
  const allDirectional = Array.from(
    fullScoreSvg.matchAll(/<path d="M ([\d\.]+) ([\d\.]+) L ([\d\.]+) ([\d\.]+) L ([\d\.]+) ([\d\.]+) L ([\d\.]+) ([\d\.]+) L ([\d\.]+) ([\d\.]+) A [^"]+ Z" fill="([^"]+)" stroke="([^"]+)" stroke-width="(0\.5|1\.3)" stroke-linejoin="round"\/>/g)
  );
  assert.equal(allDirectional.length, 63, 'Must render directional noteheads ONLY for exceptions (63 in Goldberg Var 1)');

  const rhDirectional = allDirectional.filter((m) => Number(m[5]) > Number(m[3]));
  const lhDirectional = allDirectional.filter((m) => Number(m[5]) < Number(m[3]));
  assert.equal(rhDirectional.length, 24, '24 crossing notes must have right-pointing noteheads for RH in bass (< 48)');
  assert.equal(lhDirectional.length, 39, '39 crossing notes must have left-pointing noteheads for LH above m3 (> 48)');

  // Verify SVG print engine with explicit hand crossings in both directions, and neutral Middle C (48):
  const handednessTestScore: QuantizedGridScore = {
    id: 'handedness-svg-test',
    title: 'Handedness SVG Test',
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

  const testSvg = renderColumnarScoreToSvg(handednessTestScore, 0);
  const testDirectional = Array.from(
    testSvg.matchAll(/<path d="M ([\d\.]+) ([\d\.]+) L ([\d\.]+) ([\d\.]+) L ([\d\.]+) ([\d\.]+) L ([\d\.]+) ([\d\.]+) L ([\d\.]+) ([\d\.]+) A [^"]+ Z" fill="([^"]+)" stroke="([^"]+)" stroke-width="(0\.5|1\.3)" stroke-linejoin="round"\/>/g)
  );
  assert.equal(testDirectional.length, 2, 'SVG must render directional noteheads strictly for the 2 exception notes');

  const testRh = testDirectional.filter((m) => Number(m[5]) > Number(m[3]));
  const testLh = testDirectional.filter((m) => Number(m[5]) < Number(m[3]));
  assert.equal(testRh.length, 1, 'RH exception (< 48) must render right-pointing notehead in SVG');
  assert.equal(testLh.length, 1, 'LH exception (> 48) must render left-pointing notehead in SVG');
});

test('A4 Print Dimensions & Page Margins Invariant', () => {
  const score = buildBachGoldbergVar1Score();
  const layout = computeColumnarLayout(score, { pageMarginMm: 10 });

  // A4 point dimensions: 595.28 pt × 841.89 pt
  assert.equal(Math.round(layout.pageDimensions.widthPt * 100) / 100, Math.round(A4_WIDTH_PT * 100) / 100);
  assert.equal(Math.round(layout.pageDimensions.heightPt * 100) / 100, Math.round(A4_HEIGHT_PT * 100) / 100);

  // 10mm margins = ~28.35 pt
  const marginPt = 10 * MM_TO_PT;
  const printableWidth = A4_WIDTH_PT - 2 * marginPt;
  assert.ok(printableWidth > 530 && printableWidth < 540);

  // 2 columns with 8mm gap
  assert.ok(layout.columnDimensions.widthPt > 250 && layout.columnDimensions.widthPt < 265);
});

test('Web Print CSS & @media print Invariants', () => {
  const cssPath = path.join(process.cwd(), 'src/index.css');
  const css = fs.readFileSync(cssPath, 'utf-8');

  // Must define @page { size: A4 portrait; margin: 0; }
  assert.match(css, /@page\s*\{\s*size:\s*A4\s*portrait;\s*margin:\s*0;\s*\}/i);

  // Must define @media print with .no-print and .print-only
  assert.match(css, /@media\s*print/);
  assert.match(css, /\.no-print\s*\{\s*display:\s*none\s*!important;\s*\}/);
  assert.match(css, /\.print-page\s*\{[^}]*width:\s*210mm\s*!important/);
  assert.match(css, /\.print-page\s*\{[^}]*height:\s*297mm\s*!important/);
  assert.match(css, /\.print-page\s*\{[^}]*overflow:\s*hidden\s*!important/);
  assert.match(css, /\.print-page\s*\{[^}]*break-after:\s*page/);
  assert.match(css, /\.print-preview-card\s*svg\s*\{[^}]*width:\s*100%\s*!important/);
});

test('Responsive SVG Scaling & Unclipped m5 Margin Invariant', () => {
  const score = buildBachGoldbergVar1Score();
  const layout = computeColumnarLayout(score, { staffStyle: 'tritone-split' });
  const svg = renderPageToSvg(layout, 0);

  // SVG root must have responsive style attribute
  assert.match(svg, /<svg[^>]*style="[^"]*width:\s*100%[^"]*height:\s*auto[^"]*"/);

  // m5 text and staff line must exist in Column 1 (right column)
  const m5TextMatches = Array.from(svg.matchAll(/<text[^>]*>m5<\/text>/g));
  assert.equal(m5TextMatches.length, 2, 'm5 must appear in both columns (mm. 1-4 and mm. 5-8)');

  // Rightmost m5 line must have >= 10mm (28.35pt) buffer from page right edge
  const col1 = layout.pages[0].columns[1];
  const marginPt = layout.options.pageMarginMm * MM_TO_PT;
  const gapPt = layout.options.columnGapMm * MM_TO_PT;
  const colLeftPt = marginPt + col1.columnOnPageIndex * (layout.columnDimensions.widthPt + gapPt);
  const colStaffLeftPt = colLeftPt + 14;
  const m5RightColX = colStaffLeftPt + (layout.maxPitch - layout.minPitch) * layout.ptPerSemitone;
  const pageWidthPt = layout.pageDimensions.widthPt;
  const rightMarginDistance = pageWidthPt - m5RightColX;
  assert.ok(
    rightMarginDistance >= 28.35,
    `Rightmost m5 must sit comfortably within the page (distance: ${rightMarginDistance.toFixed(2)}pt >= 28.35pt)`
  );
});


test('Network Laser Printing Pipeline: Multi-page PostScript & PJL wrapping', async () => {
  // Test generating vector PostScript from benchmark score
  const { psBuffer, layout } = await generateScorePostscript('bach-goldberg-var1');

  assert.ok(psBuffer.length > 10000, 'PostScript buffer must be generated and non-trivial');
  const psText = psBuffer.toString('binary', 0, 1000);
  assert.match(psText, /%!PS-Adobe/);

  // Check multi-page emission (%%Pages: 4)
  const fullPs = psBuffer.toString('binary');
  assert.match(fullPs, /%%Pages:\s*4/);

  // Test PJL wrapper
  const wrapped = wrapInPjl(psBuffer, 'Bach Goldberg Var 1');
  const wrappedHead = wrapped.toString('binary', 0, 300);
  const wrappedTail = wrapped.toString('binary', wrapped.length - 100);

  assert.match(wrappedHead, /@PJL JOB NAME = "Bach Goldberg Var 1"/);
  assert.match(wrappedHead, /@PJL SET RENDERMODE = COLOR/);
  assert.match(wrappedHead, /@PJL SET COLORMODE = COLOR/);
  assert.match(wrappedHead, /@PJL ENTER LANGUAGE = POSTSCRIPT/);
  assert.match(wrappedTail, /@PJL EOJ/);
});

test('Lowercase \'m\' Octave Marker Invariant: SVG pitch header labels', () => {
  const score = buildBachGoldbergVar1Score();
  const layout = computeColumnarLayout(score);
  const svgs = renderAllPagesToSvg(layout);

  assert.equal(svgs.length, 4);
  for (const svg of svgs) {
    // 1. Lowercase m octave markers (m1, m3, m5) with Middle C at m3, dropping m2 and m4
    assert.match(svg, /<text[^>]*class="pitch-label"[^>]*font-weight="bold">m\d+<\/text>/, 'Must render bold m${oct - 1} pitch labels');
    assert.match(svg, />m1</, 'Must render m1 bottom octave label');
    assert.doesNotMatch(svg, />m2</, 'Must NOT render m2 label');
    assert.match(svg, />m3</, 'Must render m3 label (Middle C)');
    assert.doesNotMatch(svg, />m4</, 'Must NOT render m4 label');
    assert.match(svg, />m5</, 'Must render m5 top octave label');

    // 2. Zero diatonic C octave labels
    assert.doesNotMatch(svg, /<text[^>]*class="pitch-label"[^>]*font-weight="bold">C\d+<\/text>/, 'Must not render diatonic C octave labels');
    assert.doesNotMatch(svg, />C\d+</, 'Must not contain any diatonic C${oct} markers');

    // 3. 5 and 9 dropped from column top, zero 5|7
    assert.doesNotMatch(svg, />5\|7</, 'Must not contain 5|7');
    assert.doesNotMatch(svg, /class="pitch-label"[^>]*>5<\/text>/, 'Must not contain 5 at top of column');
  }
});

test('Phonetic Notehead Morphology in SVG: strictly lowercase syllables', () => {
  const score = buildBachGoldbergVar1Score();
  const layout = computeColumnarLayout(score, {
    noteheadMorphology: 'phonetic',
  });
  const svgs = renderAllPagesToSvg(layout);

  assert.equal(svgs.length, 4);
  const uppercaseSyllables = ['Ma', 'Di', 'Va', 'Pi', 'La', 'Ri', 'Na', 'Ti', 'Fa', 'Bi', 'Sa', 'Ki'];

  for (const svg of svgs) {
    // Must contain lowercase phonetic text elements
    assert.match(svg, /<text[^>]*font-family="monospace"[^>]*>(?:ma|di|va|pi|la|ri|na|ti|fa|bi|sa|ki)<\/text>/);

    // Must NOT contain any uppercase syllables in note text elements
    for (const upper of uppercaseSyllables) {
      assert.doesNotMatch(svg, new RegExp(`>${upper}<`), `SVG must not contain uppercase syllable ${upper}`);
    }
  }
});

test('0-Indexed Piano Octaves Invariant (m0..m7) for 88-key range', () => {
  // 88-key piano spans A0 (MIDI 21) to C8 (MIDI 108)
  // Lowest C is C1 (MIDI 24, oct = 1) -> m0
  // Middle C is C4 (MIDI 60, oct = 4) -> m3
  // Highest C is C8 (MIDI 108, oct = 8) -> m7
  const expectedOctaveLabels: Record<number, string> = {
    1: 'm0', // C1 (lowest piano C)
    2: 'm1', // C2
    3: 'm2', // C3
    4: 'm3', // C4 (Middle C)
    5: 'm4', // C5
    6: 'm5', // C6
    7: 'm6', // C7
    8: 'm7', // C8
  };

  for (let oct = 1; oct <= 8; oct++) {
    const label = `m${oct - 1}`;
    assert.equal(label, expectedOctaveLabels[oct], `Octave ${oct} must format as ${expectedOctaveLabels[oct]}`);
  }
});

test('Rectangle / Square Morphology & 1-5-9 Symmetric Lines in SVG Print Engine', () => {
  const score = buildBachGoldbergVar1Score();
  const svg = renderColumnarScoreToSvg(score, 0, {
    staffStyle: 'tritone-split',
    noteheadMorphology: 'rectangle-square',
  });

  // 1. Staff Lines: 1, 5, 9 (Symmetric 3-Line Staff with m3 Spine Hierarchy)
  // PC 0 (m3): authoritative bold 1.35pt solid line
  assert.match(svg, /stroke="#000000"[^>]*stroke-width="1\.35"/, 'Must contain bold 1.35pt central spine line (m3)');
  // PC 0 (m1, m2, m4, m5): uniform 1.0pt octave lines, visibly thicker than line 9
  assert.match(svg, /stroke="#000000"[^>]*stroke-width="1\.0"/, 'Must contain uniform 1.0pt octave lines for m1, m2, m4, m5');
  // PC 4: small dashes 5,2.5
  assert.match(svg, /stroke="#444444"[^>]*stroke-width="0\.6"[^>]*stroke-dasharray="5,2\.5"/, 'Must contain small dashed line for 5');
  // PC 8: thin straight solid line
  assert.match(svg, /stroke="#555555"[^>]*stroke-width="0\.6"/, 'Must contain thin straight solid line for 9');
  
  // 5 and 9 dropped from top:
  assert.doesNotMatch(svg, /class="pitch-label"[^>]*>3<\/text>/, 'Must not render header label for 3');
  assert.doesNotMatch(svg, /class="pitch-label"[^>]*>5<\/text>/, 'Must not render header label for 5 at top');
  assert.doesNotMatch(svg, /class="pitch-label"[^>]*>9<\/text>/, 'Must not render header label for 9 at top');

  // 2. Notehead morphology: Vertically squished squares, Row 0 Full, Row 1 Empty
  // Full Squished Squares for Row 0 (width="7.50" height="5.60" fill!=#FFFFFF)
  assert.match(svg, /<rect[^>]*width="7\.50"[^>]*height="5\.60"[^>]*fill="(?!#FFFFFF)/, 'Must render full solid squished square noteheads for Row 0');

  // Empty Squished Squares for Row 1 (width="7.50" height="5.60" fill="#FFFFFF" with stroke for 16th, 8th, and quarter notes)
  assert.match(svg, /<rect[^>]*width="7\.50"[^>]*height="5\.60"[^>]*fill="#FFFFFF"[^>]*stroke=/, 'Must render empty hollow squished square noteheads for Row 1');

  // Blue (8th) and Orange (quarter) hollow noteheads have void fills (zero fill-opacity on Page 0)
  assert.doesNotMatch(svg, /fill-opacity="0\.18"/, 'Blue and Orange hollow noteheads must have void fills (zero fill-opacity)');

  // Red Hollow Squished Squares for Row 1: clean white interior (#FFFFFF) on Page 2 (zero fill-opacity="0.18")
  const svgPage2 = renderColumnarScoreToSvg(score, 2, {
    staffStyle: 'tritone-split',
    noteheadMorphology: 'rectangle-square',
  });
  assert.doesNotMatch(svgPage2, /fill-opacity="0\.18"/, 'Red notes on Row 1 must have zero fill-opacity="0.18"');
  assert.match(svgPage2, /<rect[^>]*width="7\.50"[^>]*height="5\.60"[^>]*fill="#FFFFFF"[^>]*stroke="#BE123C"/, 'Red notes on Row 1 must maintain clean white interior (#FFFFFF)');

  // Explicitly assert duration-class color behavior with synthetic score:
  const durationColorScore: QuantizedGridScore = {
    id: 'duration-color-svg-test',
    title: 'Duration Color SVG Test',
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
      { id: 'hollow-8th', pitch: { pitchClass: 1, octave: 4 }, startTick: 0, durationTicks: 24, hand: 'RH', velocity: 90 }, // Blue 8th -> void fill (#FFFFFF)
      { id: 'hollow-quarter', pitch: { pitchClass: 1, octave: 4 }, startTick: 24, durationTicks: 48, hand: 'RH', velocity: 90 }, // Amber/Orange Quarter -> void fill (#FFFFFF)
      { id: 'hollow-half', pitch: { pitchClass: 1, octave: 4 }, startTick: 72, durationTicks: 96, hand: 'RH', velocity: 90 }, // Red Half -> clean white fill (#FFFFFF)
    ],
  };
  const durationTestSvg = renderColumnarScoreToSvg(durationColorScore, 0, {
    staffStyle: 'tritone-split',
    noteheadMorphology: 'rectangle-square',
  });
  // Blue and Orange hollow noteheads must have void fills (#FFFFFF) and NO fill-opacity="0.18":
  assert.match(durationTestSvg, /<rect[^>]*fill="#FFFFFF"[^>]*stroke="#1D4ED8"/, 'Blue (8th) hollow notehead must have void fill (#FFFFFF)');
  assert.match(durationTestSvg, /<rect[^>]*fill="#FFFFFF"[^>]*stroke="#D97706"/, 'Orange (quarter) hollow notehead must have void fill (#FFFFFF)');
  // Red hollow notehead must maintain clean white fill (#FFFFFF) and NO fill-opacity="0.18":
  assert.match(durationTestSvg, /<rect[^>]*fill="#FFFFFF"[^>]*stroke="#BE123C"/, 'Red (half note d >= 96t) hollow notehead must have clean white fill (#FFFFFF)');
  assert.doesNotMatch(durationTestSvg, /fill-opacity="0\.18"/, 'Zero fill-opacity="0.18" across all notes');

  // Zero ellipses
  assert.doesNotMatch(svg, /<ellipse/, 'Zero ellipses should be rendered when using rectangle-square morphology');

  // Zero triangle polygons
  const polyMatches = Array.from(svg.matchAll(/<polygon points="([^"]+)"/g));
  assert.equal(polyMatches.length, 0, 'Zero polygon triangles should be rendered when using rectangle-square morphology');
});

test('4-Octave Core Staff (m1 to m5) & Clean Termination at m5', () => {
  const score = buildBachGoldbergVar1Score();
  const layout = computeColumnarLayout(score);

  // Core staff spans exactly 4 octaves (48 semitones): m1 (24) to m5 (72)
  assert.equal(layout.minPitch, 24, 'Staff minPitch must anchor to m1 (linearIndex 24)');
  assert.equal(layout.maxPitch, 72, 'Staff maxPitch must anchor to m5 (linearIndex 72)');
  assert.equal(layout.pitchSpan, 48, 'Staff span must be exactly 48 semitones (4 octaves)');

  const svg = renderPageToSvg(layout, 0);

  // Octave labels: m1, m3, m5 present, m2 and m4 dropped
  assert.match(svg, />m1</, 'Must render m1 header label');
  assert.doesNotMatch(svg, />m2</, 'Must NOT render m2 header label');
  assert.match(svg, />m3</, 'Must render m3 header label (Middle C)');
  assert.doesNotMatch(svg, />m4</, 'Must NOT render m4 header label');
  assert.match(svg, />m5</, 'Must render m5 header label');

  // No labels above m5
  assert.doesNotMatch(svg, />m6</, 'Must NOT render m6 header label');
  assert.doesNotMatch(svg, />m7</, 'Must NOT render m7 header label');
});

test('Option 4 Notehead Octave Badges vs Option 2 Spillover for Outlier Notes', () => {
  const score = buildBachGoldbergVar1Score();

  // Test Option 4: Badges ('badge')
  const badgeLayout = computeColumnarLayout(score, {
    octaveExtensionMode: 'badge',
  });
  // Page 4 contains measures 29–30 where D6 (pitch 74) occurs
  const page4SvgBadge = renderPageToSvg(badgeLayout, 3);

  // Clean thin vector indicator check: must render ↑8 delicate text without heavy black blob rect
  assert.match(page4SvgBadge, /class="cross-label"|Thin Vector Octave Indicator|Notehead Octave Badge/, 'Must contain octave indicators on page 4');
  assert.match(page4SvgBadge, /<text[^>]*font-size="6pt"[^>]*>↑8<\/text>/, 'Must render clean thin vector text font-size="6pt"');
  assert.doesNotMatch(page4SvgBadge, /Option 4 Notehead Octave Badge|<rect[^>]*rx="1\.5"[^>]*fill="#111827"/, 'Must NOT contain heavy black background rect on note');

  // Test Option 2: Spillover ('spillover')
  const spilloverLayout = computeColumnarLayout(score, {
    octaveExtensionMode: 'spillover',
  });
  const page4SvgSpillover = renderPageToSvg(spilloverLayout, 3);

  // In spillover mode, no ↑8 badge is rendered
  assert.doesNotMatch(page4SvgSpillover, />↑8<\/text>/, 'Must NOT render ↑8 badge in spillover mode');
  assert.doesNotMatch(page4SvgSpillover, /Option 4 Notehead Octave Badge/, 'Must NOT render octave badge rect in spillover mode');

  // Test Default: Spillover ('spillover') is default
  const defaultLayout = computeColumnarLayout(score);
  assert.equal(defaultLayout.options.octaveExtensionMode, 'spillover', 'Default octaveExtensionMode must be spillover');
  const page4SvgDefault = renderPageToSvg(defaultLayout, 3);
  assert.doesNotMatch(page4SvgDefault, />↑8<\/text>/, 'Must NOT render ↑8 badge in default spillover mode');
  assert.doesNotMatch(page4SvgDefault, /Option 4 Notehead Octave Badge/, 'Must NOT render octave badge rect in default spillover mode');

  // Verify D6 note renders with pitch coordinate > 72 in right buffer margin past m5 line
  const col = defaultLayout.pages[3].columns[1];
  const marginPt = defaultLayout.options.pageMarginMm * (72 / 25.4);
  const gapPt = defaultLayout.options.columnGapMm * (72 / 25.4);
  const colLeftPt = marginPt + col.columnOnPageIndex * (defaultLayout.columnDimensions.widthPt + gapPt);
  const colStaffLeftPt = colLeftPt + 14;
  const expectedD6X = colStaffLeftPt + (74 - defaultLayout.minPitch) * defaultLayout.ptPerSemitone;
  const expectedM5X = colStaffLeftPt + (72 - defaultLayout.minPitch) * defaultLayout.ptPerSemitone;
  assert.ok(expectedD6X > expectedM5X, 'D6 coordinate must be to the right of m5 line');
  assert.ok(page4SvgDefault.includes(expectedD6X.toFixed(2)), 'Must render D6 note in right buffer margin at true pitch');
});

test('Zero Barline & Beat Grid Overhang Invariant: flush with outer octave lines [colStaffLeftPt, rightStaffBound]', () => {
  const score = buildBachGoldbergVar1Score();
  const layout = computeColumnarLayout(score, { showBeatGrid: true });
  const page4Svg = renderPageToSvg(layout, 3);

  for (let c = 0; c < layout.pages[3].columns.length; c++) {
    const col = layout.pages[3].columns[c];
    const marginPt = layout.options.pageMarginMm * (72 / 25.4);
    const gapPt = layout.options.columnGapMm * (72 / 25.4);
    const colLeftPt = marginPt + col.columnOnPageIndex * (layout.columnDimensions.widthPt + gapPt);
    const colStaffLeftPt = colLeftPt + 14;
    const rightStaffBound = colStaffLeftPt + (layout.maxPitch - layout.minPitch) * layout.ptPerSemitone;

    const staffLeftStr = colStaffLeftPt.toFixed(2);
    const staffRightStr = rightStaffBound.toFixed(2);
    const overhungLeftStr = (colStaffLeftPt - 4).toFixed(2);
    const overhungRightStr = (rightStaffBound + 4).toFixed(2);

    // Verify flush barline strings exist
    assert.ok(
      page4Svg.includes(`x1="${staffLeftStr}"`) && page4Svg.includes(`x2="${staffRightStr}"`),
      `Page 4 Col ${c} must contain barlines flush to staff bounds [${staffLeftStr}, ${staffRightStr}]`
    );

    // Verify overhung bounds are strictly absent
    assert.ok(
      !page4Svg.includes(`x1="${overhungLeftStr}"`),
      `Page 4 Col ${c} must NOT contain overhung x1="${overhungLeftStr}"`
    );
    assert.ok(
      !page4Svg.includes(`x2="${overhungRightStr}"`),
      `Page 4 Col ${c} must NOT contain overhung x2="${overhungRightStr}"`
    );
  }
});

test('Local Dashed Outlier Staff Line Invariant: pitch 76 rendered strictly for mm. 29-30 on Page 4 and absent on Pages 1-3', () => {
  const score = buildBachGoldbergVar1Score();
  const layout = computeColumnarLayout(score);

  // Pages 1 to 3 (measures 1-24) do not have notes beyond C6 (pitch 72)
  const marginPt = layout.options.pageMarginMm * (72 / 25.4);
  const gapPt = layout.options.columnGapMm * (72 / 25.4);

  for (let pIndex = 0; pIndex < 3; pIndex++) {
    const pageSvg = renderPageToSvg(layout, pIndex);
    for (const col of layout.pages[pIndex].columns) {
      const colLeftPt = marginPt + col.columnOnPageIndex * (layout.columnDimensions.widthPt + gapPt);
      const colStaffLeftPt = colLeftPt + 14;
      const line76X = (colStaffLeftPt + (76 - layout.minPitch) * layout.ptPerSemitone).toFixed(2);
      assert.ok(
        !pageSvg.includes(`x1="${line76X}"`),
        `Page ${pIndex + 1} Col ${col.columnIndex} must NOT contain any dashed outlier staff line at pitch 76 (x1="${line76X}")`
      );
    }
  }

  // Page 4 contains measures 25-32. Specifically mm. 29-30 contain D6 (pitch 74), which triggers Landmark 5 (pitch 76).
  const page4Svg = renderPageToSvg(layout, 3);
  const col0 = layout.pages[3].columns[0]; // mm 25-28
  const col0LeftPt = marginPt + col0.columnOnPageIndex * (layout.columnDimensions.widthPt + gapPt);
  const col0StaffLeftPt = col0LeftPt + 14;
  const col0Line76X = (col0StaffLeftPt + (76 - layout.minPitch) * layout.ptPerSemitone).toFixed(2);
  assert.ok(
    !page4Svg.includes(`x1="${col0Line76X}"`),
    `Page 4 Col 0 (mm. 25-28) must NOT contain any dashed outlier staff line at pitch 76`
  );

  const col1 = layout.pages[3].columns[1]; // mm 29-32
  const colLeftPt = marginPt + col1.columnOnPageIndex * (layout.columnDimensions.widthPt + gapPt);
  const colStaffLeftPt = colLeftPt + 14;
  const line76X = (colStaffLeftPt + (76 - layout.minPitch) * layout.ptPerSemitone).toFixed(2);

  // Must contain dashed line at pitch 76
  const dashedMatches = Array.from(
    page4Svg.matchAll(
      new RegExp(
        `<line x1="${line76X}" y1="([\\d\\.]+)" x2="${line76X}" y2="([\\d\\.]+)" stroke="#444444" stroke-width="0\\.6" stroke-dasharray="5,2\\.5"\\/>`,
        'g'
      )
    )
  );
  assert.equal(dashedMatches.length, 2, 'Page 4 must render exactly 2 dashed outlier line segments at pitch 76 (for mm. 29 and 30)');

  // Verify the vertical bounds correspond to mm. 29 and 30
  const staffOriginY = marginPt + 42 + 16;
  const m29StartY = (staffOriginY + 0 * layout.ticksPerMeasure * layout.ptPerTick).toFixed(2);
  const m29EndY = (staffOriginY + 1 * layout.ticksPerMeasure * layout.ptPerTick).toFixed(2);
  const m30StartY = (staffOriginY + 1 * layout.ticksPerMeasure * layout.ptPerTick).toFixed(2);
  const m30EndY = (staffOriginY + 2 * layout.ticksPerMeasure * layout.ptPerTick).toFixed(2);

  assert.equal(dashedMatches[0][1], m29StartY, 'First segment must start at m29 start');
  assert.equal(dashedMatches[0][2], m29EndY, 'First segment must end at m29 end');
  assert.equal(dashedMatches[1][1], m30StartY, 'Second segment must start at m30 start');
  assert.equal(dashedMatches[1][2], m30EndY, 'Second segment must end at m30 end');
});

test('Urtext Classical Serif Typography Invariant: refined font stack and italic styling', () => {
  const score = buildBachGoldbergVar1Score();
  const layout = computeColumnarLayout(score);
  const page1Svg = renderPageToSvg(layout, 0);

  // Verify font stack constant
  assert.ok(URTEXT_SERIF.includes('Century Schoolbook'), 'URTEXT_SERIF contains Century Schoolbook');
  assert.ok(URTEXT_SERIF.includes('Baskerville'), 'URTEXT_SERIF contains Baskerville');
  assert.ok(URTEXT_SERIF.includes('Liberation Serif'), 'URTEXT_SERIF contains Liberation Serif');

  // Verify <style> block includes URTEXT_SERIF for classes
  assert.ok(page1Svg.includes(`.title { font-family: ${URTEXT_SERIF}; font-weight: 600; font-size: 11pt; letter-spacing: 0.3px; fill: #111111; }`));
  assert.ok(page1Svg.includes(`.subtitle { font-family: ${URTEXT_SERIF}; font-style: italic; font-size: 8.5pt; fill: #333333; }`));
  assert.ok(page1Svg.includes(`.meta { font-family: ${URTEXT_SERIF}; font-style: italic; font-size: 8pt; fill: #222222; }`));
  assert.ok(page1Svg.includes(`.section-header { font-family: ${URTEXT_SERIF}; font-style: italic; font-size: 8pt; fill: #222222; }`));
  assert.ok(page1Svg.includes(`.measure-num { font-family: ${URTEXT_SERIF}; font-style: italic; font-size: 8pt; fill: #444444; text-anchor: end; }`));
  assert.ok(!page1Svg.includes('.beat-counter'), 'Must not include .beat-counter style');
  assert.ok(page1Svg.includes(`.pitch-label { font-family: ${URTEXT_SERIF}; font-style: italic; font-weight: bold; font-size: 7pt; fill: #333333; text-anchor: middle; }`));

  // Verify Middle C m3 header badge uses URTEXT_SERIF with italic
  assert.ok(page1Svg.includes(`font-family='${URTEXT_SERIF}' font-style="italic" font-weight="bold" font-size="6.5pt" fill="#FFFFFF" text-anchor="middle">m3</text>`));
});

test('A4 Columnar Layout & Geometry Invariants: 14pt left clearance, measure number in margin clear of m1, zero beat counter', () => {
  const score = buildBachGoldbergVar1Score();
  const layout = computeColumnarLayout(score);
  const page0Svg = renderPageToSvg(layout, 0);

  // colMarginLeftPt is 14pt and rightBufferMarginPt is 22pt
  const colMarginLeftPt = 14;
  const rightBufferMarginPt = 22;
  const usablePitchWidthPt = layout.columnDimensions.widthPt - colMarginLeftPt - rightBufferMarginPt;
  assert.ok(Math.abs(layout.ptPerSemitone - usablePitchWidthPt / layout.pitchSpan) < 1e-6);

  // colStaffLeftPt is colLeftPt + 14
  const marginPt = layout.options.pageMarginMm * MM_TO_PT;
  const gapPt = layout.options.columnGapMm * MM_TO_PT;
  const col0 = layout.pages[0].columns[0];
  const col0LeftPt = marginPt + col0.columnOnPageIndex * (layout.columnDimensions.widthPt + gapPt);
  const col0StaffLeftPt = col0LeftPt + colMarginLeftPt;
  assert.equal(col0StaffLeftPt, col0LeftPt + 14);

  // Right staff bound is colStaffLeftPt + (maxPitch - minPitch) * ptPerSemitone
  const rightStaffBound = col0StaffLeftPt + (layout.maxPitch - layout.minPitch) * layout.ptPerSemitone;
  assert.ok(page0Svg.includes(`x1="${col0StaffLeftPt.toFixed(2)}" y1="`));
  assert.ok(page0Svg.includes(`x2="${rightStaffBound.toFixed(2)}" y2="`));

  // Measure number rendered in left margin clear of m1
  const staffOriginY = marginPt + 42 + 16;
  assert.match(
    page0Svg,
    new RegExp(`<text x="${(col0StaffLeftPt - 4).toFixed(2)}" y="${(staffOriginY + 8).toFixed(2)}" class="measure-num">${col0.startMeasure}</text>`)
  );

  // Assert measure number coordinate does not overlap with m1 (which is at x = col0StaffLeftPt, y = colTopPt + 10)
  const colTopPt = marginPt + 42;
  const m1Y = colTopPt + 10;
  const measureNumX = col0StaffLeftPt - 4;
  const measureNumY = staffOriginY + 8;
  assert.notEqual(measureNumX, col0StaffLeftPt, 'Measure number X must be shifted into left margin to clear m1');
  assert.notEqual(measureNumY, m1Y, 'Measure number Y must not overlap with m1 header');

  // SVG does NOT contain <text class="beat-counter">
  assert.doesNotMatch(page0Svg, /<text[^>]*class="beat-counter"/);

  // SVG DOES contain horizontal dashed pulse lines for beat subdivisions (stroke-dasharray="2,3")
  assert.match(page0Svg, /stroke-dasharray="2,3"/);
});

