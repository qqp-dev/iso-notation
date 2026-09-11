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

    // 3. Klavar Lateral Stems Invariant
    // - Horizontal lateral stems for hand assignment with stroke-width 0.6pt
    assert.match(svg, /<line[^>]*stroke-width="0\.6"[^>]*stroke-linecap="round"/, 'Must render Klavar lateral stems');

    // 4. Solid row-parity noteheads with zero disruptive shield and duration colors
    // - Ovals on lines (Row 0): horizontal ellipse rx="5.20" ry="3.00" sitting cleanly on line
    assert.match(svg, /<ellipse[^>]*rx="5\.20"[^>]*ry="3\.00"/, 'Must render Row 0 ovals with 5.20pt/3.00pt radii');
    // - Bricks in spaces (Row 1): crisp rectangular brick with width="8.60" height="5.80" rx="1.2" filling the slot
    assert.match(svg, /<rect[^>]*width="8\.60"[^>]*height="5\.80"[^>]*rx="1\.2"/, 'Must render Row 1 crisp bricks filling whole slot');
    // - Zero disruptive white halo shield
    assert.doesNotMatch(svg, /<ellipse[^>]*stroke="#FFFFFF"/, 'Must not have disruptive white shield on ovals');
    assert.doesNotMatch(svg, /<rect[^>]*stroke="#FFFFFF"/, 'Must not have disruptive white shield on bricks');

    // 5. Color Palette Invariant in Print Engine & Thin Hold Lines
    // - 16th notes (d <= 12t): unextended noteheads in dark slate/graphite (#1E293B)
    assert.match(svg, /fill="#1E293B"/, 'Must render 16th notes in dark slate/graphite (#1E293B)');
    // - 8th notes (d = 24t): Royal Blue (#1D4ED8) with thin hold line
    assert.match(svg, /<line[^>]*stroke="#1D4ED8"[^>]*stroke-width="1\.2"/, 'Must render 8th note thin hold lines in Royal Blue (#1D4ED8)');

    // 6. Measure numbers: plain number on first bar of column, zero 'M' prefixes
    assert.match(svg, /class="measure-num">\d+<\/text>/, 'Must render measure number on first bar of column');
    assert.doesNotMatch(svg, /class="measure-num">M/, 'Must not prefix measure numbers with M');
  }

  // Across the full document, verify quarter note thin hold lines in Amber/Gold (#D97706)
  const fullScoreSvg = svgs.join('\n');
  assert.match(fullScoreSvg, /<line[^>]*stroke="#D97706"[^>]*stroke-width="1\.2"/, 'Must render quarter note thin hold lines in Amber/Gold (#D97706)');

  // Verify renderColumnarScoreToSvg helper
  const page0Svg = renderColumnarScoreToSvg(score, 0);
  assert.equal(page0Svg, svgs[0]);
  const defaultSvg = renderColumnarScoreToSvg(score);
  assert.equal(defaultSvg, svgs[0]);
});

test('Optical Notehead Sizing & Thin Long Stems in SVG Print Engine', () => {
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

  // Klavar Lateral Stems Invariant:
  // RH notes have stems pointing right (x2 > x1), LH notes have stems pointing left (x2 < x1)
  // Lateral stems are center-aligned with notehead (y1 === ny and y2 === ny) with length >= 16pt
  const stemMatches = Array.from(svg.matchAll(/<line x1="([\d\.]+)" y1="([\d\.]+)" x2="([\d\.]+)" y2="([\d\.]+)" stroke="[^"]+" stroke-width="0\.6" stroke-linecap="round"/g));
  assert.ok(stemMatches.length > 0, 'Must find lateral stems in SVG');

  stemMatches.forEach((m) => {
    const len = Math.abs(Number(m[3]) - Number(m[1]));
    assert.ok(Math.round(len * 10) / 10 >= 16.0, 'Lateral stem length must be >= 16pt');
    assert.equal(Number(m[2]), Number(m[4]), 'Lateral stem must be horizontal (y1 === y2)');
  });

  // Verify center alignment with notehead center coordinate (y1 === ny)
  const firstNote = layout.columns[0].notes[0];
  const firstNoteStaffOriginY = 10 * (72 / 25.4) + 42 + 16;
  const firstNoteExpectedNy = firstNoteStaffOriginY + (firstNote.startTick - layout.columns[0].startTick) * layout.ptPerTick;
  const firstStem = stemMatches[0];
  assert.equal(Number(firstStem[2]), Number(firstNoteExpectedNy.toFixed(2)), 'Lateral stem must originate at center ny');

  const rhStems = stemMatches.filter((m) => Number(m[3]) > Number(m[1]));
  const lhStems = stemMatches.filter((m) => Number(m[3]) < Number(m[1]));

  assert.ok(rhStems.length > 0, 'SVG must contain right-pointing lateral stems for RH notes');
  assert.ok(lhStems.length > 0, 'SVG must contain left-pointing lateral stems for LH notes');
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
  const m5RightColX = 551.93; // colStaffLeftPt (339.98) + 48 * 4.4156
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

  // Empty Squished Squares for Row 1 (width="7.50" height="5.60" fill="#FFFFFF" with stroke)
  assert.match(svg, /<rect[^>]*width="7\.50"[^>]*height="5\.60"[^>]*fill="#FFFFFF"[^>]*stroke=/, 'Must render empty hollow squished square noteheads for Row 1');

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
  const colStaffLeftPt = colLeftPt + 16 + 15;
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
    const colStaffLeftPt = colLeftPt + 16 + 15;
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
      const colStaffLeftPt = colLeftPt + 16 + 15;
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
  const col0StaffLeftPt = col0LeftPt + 16 + 15;
  const col0Line76X = (col0StaffLeftPt + (76 - layout.minPitch) * layout.ptPerSemitone).toFixed(2);
  assert.ok(
    !page4Svg.includes(`x1="${col0Line76X}"`),
    `Page 4 Col 0 (mm. 25-28) must NOT contain any dashed outlier staff line at pitch 76`
  );

  const col1 = layout.pages[3].columns[1]; // mm 29-32
  const colLeftPt = marginPt + col1.columnOnPageIndex * (layout.columnDimensions.widthPt + gapPt);
  const colStaffLeftPt = colLeftPt + 16 + 15;
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
  assert.ok(page1Svg.includes(`.measure-num { font-family: ${URTEXT_SERIF}; font-style: italic; font-weight: normal; font-size: 7.5pt; fill: #444444; text-anchor: end; }`));
  assert.ok(page1Svg.includes(`.beat-counter { font-family: ${URTEXT_SERIF}; font-style: normal; font-size: 6.5pt; fill: #6B7280; text-anchor: end; }`));
  assert.ok(page1Svg.includes(`.pitch-label { font-family: ${URTEXT_SERIF}; font-style: italic; font-weight: bold; font-size: 7pt; fill: #333333; text-anchor: middle; }`));

  // Verify Middle C m3 header badge uses URTEXT_SERIF with italic
  assert.ok(page1Svg.includes(`font-family='${URTEXT_SERIF}' font-style="italic" font-weight="bold" font-size="6.5pt" fill="#FFFFFF" text-anchor="middle">m3</text>`));
});

