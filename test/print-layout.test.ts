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

  assert.equal(svgs.length, 2, 'Must produce SVGs for both Page 1 and Page 2');

  for (let pIdx = 0; pIdx < svgs.length; pIdx++) {
    const svg = svgs[pIdx];

    // 1. Pure white background for paper savings & laser printing
    assert.match(svg, /<rect[^>]*width="100%"[^>]*height="100%"[^>]*fill="#FFFFFF"/);

    // 2. 5/7 Staff Topography lines
    // - Bold octave (PC 0, 1.5pt)
    assert.match(svg, /stroke="#000000"[^>]*stroke-width="1\.5"/, 'Must contain bold 1.5pt octave line');
    // - Dashed 5/7 demarcation line (1.0pt, dash 3 3)
    assert.match(svg, /stroke-dasharray="3,3"/, 'Must contain dashed 5/7 demarcation line (dash 3 3)');
    assert.match(svg, /stroke-width="1\.0"/, 'Must contain 1.0pt stroke width for demarcation');
    // - Hairlines (PC 2, 4, 6, 8, 10, 0.5pt)
    assert.match(svg, /stroke-width="0\.5"/, 'Must contain 0.5pt hairlines');

    // 3. Klavar Lateral Stems Invariant
    // - Horizontal lateral stems for hand assignment with stroke-width 1.2pt
    assert.match(svg, /<line[^>]*stroke-width="1\.2"[^>]*stroke-linecap="round"/, 'Must render Klavar lateral stems');

    // 4. Solid row-parity noteheads with white halo knockout and duration colors
    // - Discs on lines (Row 0): circle with stroke="#FFFFFF" and stroke-width="2"
    assert.match(svg, /<circle[^>]*stroke="#FFFFFF"[^>]*stroke-width="2"/, 'Must render Row 0 discs with white halo knockout');
    // - Diamonds in spaces (Row 1): polygon with stroke="#FFFFFF" and stroke-width="2"
    assert.match(svg, /<polygon[^>]*stroke="#FFFFFF"[^>]*stroke-width="2"/, 'Must render Row 1 diamonds with white halo knockout');

    // 5. Color Palette Invariant in Print Engine & Hold Ribbons
    // - 16th notes (d <= 12t): unextended noteheads in dark slate/graphite (#1E293B)
    assert.match(svg, /fill="#1E293B"/, 'Must render 16th notes in dark slate/graphite (#1E293B)');
    // - 8th notes (d = 24t): Royal Blue (#1D4ED8) with hold ribbon
    assert.match(svg, /<rect[^>]*width="4\.00"[^>]*fill="#1D4ED8"/, 'Must render 8th note hold ribbons in Royal Blue (#1D4ED8)');
    // - Quarter notes (d = 48t): Amber/Gold (#D97706) with hold ribbon
    assert.match(svg, /<rect[^>]*width="4\.00"[^>]*fill="#D97706"/, 'Must render quarter note hold ribbons in Amber/Gold (#D97706)');
  }

  // Verify renderColumnarScoreToSvg helper
  const page0Svg = renderColumnarScoreToSvg(score, 0);
  assert.equal(page0Svg, svgs[0]);
  const defaultSvg = renderColumnarScoreToSvg(score);
  assert.equal(defaultSvg, svgs[0]);
});

test('Klavar Lateral Stems & Geometric Diamond Alignment in SVG Print Engine', () => {
  const score = buildBachGoldbergVar1Score();
  const layout = computeColumnarLayout(score);
  const svg = renderPageToSvg(layout, 0);

  // Geometric Diamond Alignment Invariant:
  // Circle radius r = 3.5, Diamond vertical half-height d = r = 3.5
  assert.match(svg, /<circle[^>]*r="3\.5"/, 'Circle radius must be 3.5pt');

  // Verify diamond coordinates: top ny - 3.5 and bottom ny + 3.5 match circle vertical extent
  const diamondMatches = Array.from(svg.matchAll(/<polygon points="([^"]+)"/g));
  assert.ok(diamondMatches.length > 0, 'Must have rendered diamond noteheads in SVG');

  for (const match of diamondMatches) {
    const pts = match[1].split(' ').map((p) => p.split(',').map(Number));
    assert.equal(pts.length, 4, 'Diamond must have 4 points');
    const [top, right, bottom, left] = pts;
    const verticalHeight = Math.round((bottom[1] - top[1]) * 100) / 100;
    assert.equal(verticalHeight, 7.0, 'Diamond total vertical height must exactly equal 2 * r = 7.0pt (d = r = 3.5)');
  }

  // Klavar Lateral Stems Invariant:
  // RH notes have stems pointing right (x2 > x1), LH notes have stems pointing left (x2 < x1)
  const stemMatches = Array.from(svg.matchAll(/<line x1="([\d\.]+)" y1="([\d\.]+)" x2="([\d\.]+)" y2="([\d\.]+)" stroke="[^"]+" stroke-width="1\.2"/g));
  assert.ok(stemMatches.length > 0, 'Must find lateral stems in SVG');

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

  // Must define @page { size: A4 portrait; margin: 10mm; }
  assert.match(css, /@page\s*\{\s*size:\s*A4\s*portrait;\s*margin:\s*10mm;\s*\}/i);

  // Must define @media print with .no-print and .print-only
  assert.match(css, /@media\s*print/);
  assert.match(css, /\.no-print\s*\{\s*display:\s*none\s*!important;\s*\}/);
  assert.match(css, /\.print-page\s*\{[^}]*break-after:\s*page/);
});

test('Network Laser Printing Pipeline: Multi-page PostScript & PJL wrapping', async () => {
  // Test generating vector PostScript from benchmark score
  const { psBuffer, layout } = await generateScorePostscript('bach-goldberg-var1');

  assert.ok(psBuffer.length > 10000, 'PostScript buffer must be generated and non-trivial');
  const psText = psBuffer.toString('binary', 0, 1000);
  assert.match(psText, /%!PS-Adobe/);

  // Check multi-page emission (%%Pages: 2)
  const fullPs = psBuffer.toString('binary');
  assert.match(fullPs, /%%Pages:\s*2/);

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
