import { QuantizedGridScore, QuantizedNote, HandCrossingEvent } from '../model/types';
import { linearIndex, wholeToneParity } from '../model/pitch';
import { getCanonicalSyllable } from '../model/phonetics';
import { detectHandCrossings, computeBeamClusters } from '../model/grid';
import { StaffStyle, NoteheadMorphology, normalizeStaffStyle, normalizeNoteheadMorphology, getPrintDurationColor, getStaffLineGeometry } from './types';

export const URTEXT_SERIF = '"Century Schoolbook", "Baskerville", "Liberation Serif", "DejaVu Serif", "Times New Roman", Georgia, serif';

export const A4_WIDTH_PT = 595.28; // 210mm in PostScript points (72 pt/inch)
export const A4_HEIGHT_PT = 841.89; // 297mm in PostScript points
export const MM_TO_PT = 72 / 25.4; // 2.834645669...
export const PT_TO_MM = 25.4 / 72;

export interface PrintLayoutOptions {
  paperSize?: 'A4' | 'A3';
  orientation?: 'portrait' | 'landscape';
  measuresPerColumn?: number; // default: 8
  columnsPerPage?: number; // default: 2
  pageMarginMm?: number; // default: 10mm
  columnGapMm?: number; // default: 8mm
  staffStyle?: StaffStyle; // default: 'tritone-split'
  noteheadMorphology?: NoteheadMorphology; // default: 'row-parity-shape'
  holdRibbonWidthPt?: number; // default: 4pt
  minPitch?: number; // optional manual pitch bounds
  maxPitch?: number;
  pixelsPerTick?: number; // optional scale overrides
  pixelsPerSemitone?: number;
  octaveExtensionMode?: 'badge' | 'spillover' | 'auto';
  showBeamGrouping?: boolean; // default: false
  showBeatGrid?: boolean; // default: false
  showGutterBrackets?: boolean; // default: false
}

export interface ColumnSlice {
  columnIndex: number; // 0..N
  pageIndex: number; // 0..P
  columnOnPageIndex: number; // 0..(columnsPerPage - 1)
  startMeasure: number; // 1-indexed inclusive (e.g. 1, 9, 17, 25)
  endMeasure: number; // 1-indexed inclusive (e.g. 8, 16, 24, 32)
  startTick: number; // exact start tick in score
  endTick: number; // exact end tick in score
  notes: QuantizedNote[];
  handCrossings: HandCrossingEvent[];
}

export interface PageLayout {
  pageIndex: number;
  pageNumber: number; // 1-indexed
  totalPages: number;
  sectionName: string; // e.g. "Section A (mm. 1–16)"
  columns: ColumnSlice[];
}

export interface ColumnarScoreLayout {
  score: QuantizedGridScore;
  options: Required<PrintLayoutOptions>;
  totalMeasures: number;
  ticksPerMeasure: number;
  ticksPerBeat: number;
  columns: ColumnSlice[];
  pages: PageLayout[];
  pageDimensions: {
    widthPt: number;
    heightPt: number;
    widthMm: number;
    heightMm: number;
  };
  columnDimensions: {
    widthPt: number;
    heightPt: number;
    contentHeightPt: number;
  };
  minPitch: number;
  maxPitch: number;
  pitchSpan: number;
  ptPerSemitone: number;
  ptPerTick: number;
}

const HEADER_HEIGHT_PT = 44;
const FOOTER_HEIGHT_PT = 32;
const COL_HEADER_HEIGHT_PT = 16;

const DEFAULT_OPTIONS: Required<PrintLayoutOptions> = {
  paperSize: 'A4',
  orientation: 'portrait',
  measuresPerColumn: 4,
  columnsPerPage: 2,
  pageMarginMm: 10,
  columnGapMm: 8,
  staffStyle: 'tritone-split',
  noteheadMorphology: 'row-parity-shape',
  holdRibbonWidthPt: 4,
  minPitch: 0,
  maxPitch: 127,
  pixelsPerTick: 0,
  pixelsPerSemitone: 0,
  octaveExtensionMode: 'spillover',
  showBeamGrouping: false,
  showBeatGrid: true,
  showGutterBrackets: false,
};

/**
 * Computes columnar pagination and geometry for a score.
 * Slices the score by measure count into columns, groups columns into pages,
 * and calculates exact point coordinates for print engraving.
 */
export function computeColumnarLayout(
  score: QuantizedGridScore,
  userOptions?: Partial<PrintLayoutOptions>
): ColumnarScoreLayout {
  const options: Required<PrintLayoutOptions> = {
    ...DEFAULT_OPTIONS,
    ...userOptions,
  };

  // Determine meter and measure length
  let numerator = 4;
  let denominator = 4;
  if (score.timeSignatures && score.timeSignatures.length > 0) {
    numerator = score.timeSignatures[0].numerator;
    denominator = score.timeSignatures[0].denominator;
  }
  const ticksPerBeat = score.ticksPerBeat * (4 / denominator);
  const ticksPerMeasure = Math.round(ticksPerBeat * numerator);

  const totalMeasures = ticksPerMeasure > 0
    ? Math.max(1, Math.ceil(score.totalTicks / ticksPerMeasure))
    : 1;

  // Pitch range bounding: Anchored around the middle of keyboard to 4 octaves:
  // m1 (24, C2) to m5 (72, C6), with Middle C (m3, 48) dead-center.
  let minPitch = options.minPitch > 0 ? options.minPitch : 24;
  let maxPitch = options.maxPitch < 127 ? options.maxPitch : 72;

  if (minPitch >= maxPitch) {
    minPitch = 24;
    maxPitch = 72;
  }

  // Ensure whole-tone alignment for clean staff presentation
  minPitch = Math.floor(minPitch / 2) * 2;
  maxPitch = Math.ceil(maxPitch / 2) * 2;
  const pitchSpan = Math.max(12, maxPitch - minPitch);

  // Physical page dimensions
  const isA3 = options.paperSize === 'A3';
  const isLandscape = options.orientation === 'landscape';
  let baseWidthPt = isA3 ? A4_HEIGHT_PT * Math.SQRT2 : A4_WIDTH_PT;
  let baseHeightPt = isA3 ? A4_WIDTH_PT * 2 : A4_HEIGHT_PT;
  if (isLandscape) {
    const tmp = baseWidthPt;
    baseWidthPt = baseHeightPt;
    baseHeightPt = tmp;
  }
  const widthPt = baseWidthPt;
  const heightPt = baseHeightPt;
  const widthMm = widthPt * PT_TO_MM;
  const heightMm = heightPt * PT_TO_MM;

  const marginPt = options.pageMarginMm * MM_TO_PT;
  const columnGapPt = options.columnGapMm * MM_TO_PT;

  const printableWidthPt = widthPt - 2 * marginPt;
  const printableHeightPt = heightPt - 2 * marginPt;

  // Header and footer reservations
  const headerHeightPt = 44;
  const footerHeightPt = 32;
  const bodyHeightPt = printableHeightPt - headerHeightPt - footerHeightPt;

  const colsPerPage = Math.max(1, options.columnsPerPage);
  const totalGaps = colsPerPage - 1;
  const columnWidthPt = (printableWidthPt - totalGaps * columnGapPt) / colsPerPage;

  // Column internal geometry
  const colHeaderHeightPt = 16;
  const contentHeightPt = bodyHeightPt - colHeaderHeightPt;

  // Slicing into columns
  const measuresPerCol = Math.max(1, options.measuresPerColumn);
  const numColumns = Math.ceil(totalMeasures / measuresPerCol);

  const allHandCrossings = score.handCrossings && score.handCrossings.length > 0
    ? score.handCrossings
    : detectHandCrossings(score);

  const columns: ColumnSlice[] = [];
  for (let c = 0; c < numColumns; c++) {
    const startMeasure = c * measuresPerCol + 1;
    const endMeasure = Math.min(totalMeasures, (c + 1) * measuresPerCol);
    const startTick = (startMeasure - 1) * ticksPerMeasure;
    const endTick = endMeasure * ticksPerMeasure;

    const pageIndex = Math.floor(c / colsPerPage);
    const columnOnPageIndex = c % colsPerPage;

    const notesInCol = score.notes.filter(
      n => n.startTick >= startTick && n.startTick < endTick
    );

    const hcInCol = allHandCrossings.filter(
      hc => (hc.tick + hc.durationTicks) > startTick && hc.tick < endTick
    );

    columns.push({
      columnIndex: c,
      pageIndex,
      columnOnPageIndex,
      startMeasure,
      endMeasure,
      startTick,
      endTick,
      notes: notesInCol,
      handCrossings: hcInCol,
    });
  }

  // Group columns into pages
  const totalPages = Math.max(1, Math.ceil(numColumns / colsPerPage));
  const pages: PageLayout[] = [];

  for (let p = 0; p < totalPages; p++) {
    const pageCols = columns.filter(c => c.pageIndex === p);
    const firstCol = pageCols[0];
    const lastCol = pageCols[pageCols.length - 1];
    const sMeasure = firstCol ? firstCol.startMeasure : 1;
    const eMeasure = lastCol ? lastCol.endMeasure : totalMeasures;

    // Designate sections (e.g. Page 1: Section A · Part 1 mm. 1–8, Page 2: Section A · Part 2 mm. 9–16)
    let sectionName: string;
    if (totalPages === 4 && totalMeasures >= 24) {
      const half = Math.ceil(totalMeasures / 2);
      const isPart2 = sMeasure > half;
      const secLetter = isPart2 ? 'B' : 'A';
      const partNum = (p % 2) + 1;
      sectionName = `Section ${secLetter} · Part ${partNum} (mm. ${sMeasure}–${eMeasure})`;
    } else if (totalPages === 2) {
      const secLetter = p === 0 ? 'A' : 'B';
      sectionName = `Section ${secLetter} (mm. ${sMeasure}–${eMeasure})`;
    } else {
      const sectionLetter = String.fromCharCode(65 + (p % 26));
      sectionName = `Section ${sectionLetter} (mm. ${sMeasure}–${eMeasure})`;
    }

    pages.push({
      pageIndex: p,
      pageNumber: p + 1,
      totalPages,
      sectionName,
      columns: pageCols,
    });
  }

  // Calculate scales
  const columnMarginLeftPt = 16; // Gutter for measure number labels
  const bufferMarginPt = 15; // Symmetrical margin buffer for extra notes left of m1 and right of m5
  const usablePitchWidthPt = Math.max(50, columnWidthPt - columnMarginLeftPt - 2 * bufferMarginPt);

  const ptPerSemitone = options.pixelsPerSemitone > 0
    ? options.pixelsPerSemitone
    : usablePitchWidthPt / pitchSpan;

  const ticksPerCol = measuresPerCol * ticksPerMeasure;
  const ptPerTick = options.pixelsPerTick > 0
    ? options.pixelsPerTick
    : contentHeightPt / Math.max(1, ticksPerCol);

  return {
    score,
    options,
    totalMeasures,
    ticksPerMeasure,
    ticksPerBeat,
    columns,
    pages,
    pageDimensions: {
      widthPt,
      heightPt,
      widthMm,
      heightMm,
    },
    columnDimensions: {
      widthPt: columnWidthPt,
      heightPt: bodyHeightPt,
      contentHeightPt,
    },
    minPitch,
    maxPitch,
    pitchSpan,
    ptPerSemitone,
    ptPerTick,
  };
}

/**
 * Generates clean, standalone vector SVG for an individual A4 page of the columnar score.
 */
export function renderPageToSvg(
  layout: ColumnarScoreLayout,
  pageIndex: number
): string {
  const page = layout.pages[pageIndex] || layout.pages[0];
  if (!page) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${layout.pageDimensions.widthPt} ${layout.pageDimensions.heightPt}"><rect width="100%" height="100%" fill="#FFFFFF"/></svg>`;
  }

  const { score, options, minPitch, maxPitch, ptPerSemitone, ptPerTick, ticksPerMeasure, ticksPerBeat } = layout;
  const { widthPt, heightPt, widthMm, heightMm } = layout.pageDimensions;
  const marginPt = options.pageMarginMm * MM_TO_PT;
  const columnGapPt = options.columnGapMm * MM_TO_PT;
  const colWidthPt = layout.columnDimensions.widthPt;

  const headerHeightPt = 42;
  const footerHeightPt = 22;
  const colHeaderHeightPt = 16;
  const colTopPt = marginPt + headerHeightPt;

  const colMarginLeftPt = 16;
  const bufferMarginPt = 15;

  const normStaffStyle = normalizeStaffStyle(options.staffStyle);
  const tauRef = score.gridResolution || 12;
  const holdRibbonWidth = options.holdRibbonWidthPt || 4;

  const svgParts: string[] = [];

  // 1. Root SVG with pure white paper background
  svgParts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${widthPt.toFixed(2)} ${heightPt.toFixed(2)}" width="${widthMm.toFixed(1)}mm" height="${heightMm.toFixed(1)}mm" style="display: block; width: 100%; height: auto;">`
  );
  svgParts.push(`  <defs>`);
  svgParts.push(`    <style>`);
  svgParts.push(`      .title { font-family: ${URTEXT_SERIF}; font-weight: 600; font-size: 11pt; letter-spacing: 0.3px; fill: #111111; }
      .subtitle { font-family: ${URTEXT_SERIF}; font-style: italic; font-size: 8.5pt; fill: #333333; }
      .meta { font-family: ${URTEXT_SERIF}; font-style: italic; font-size: 8pt; fill: #222222; }
      .section-header { font-family: ${URTEXT_SERIF}; font-style: italic; font-size: 8pt; fill: #222222; }
      .measure-num { font-family: ${URTEXT_SERIF}; font-style: italic; font-weight: normal; font-size: 7.5pt; fill: #444444; text-anchor: end; }
      .beat-counter { font-family: ${URTEXT_SERIF}; font-style: normal; font-size: 6.5pt; fill: #6B7280; text-anchor: end; }
      .pitch-label { font-family: ${URTEXT_SERIF}; font-style: italic; font-weight: bold; font-size: 7pt; fill: #333333; text-anchor: middle; }
      .cross-label { font-family: "DejaVu Sans Mono", "Liberation Mono", monospace; font-size: 6pt; fill: #888888; font-weight: bold; text-anchor: end; }`);
  svgParts.push(`    </style>`);
  svgParts.push(`  </defs>`);

  // Background rect
  svgParts.push(`  <!-- Paper Background -->`);
  svgParts.push(`  <rect width="100%" height="100%" fill="#FFFFFF"/>`);

  // 2. Page Header
  const title = score.title || 'Isomorphic Score';
  const composer = score.composer || '';
  svgParts.push(`  <!-- Page Header -->`);
  svgParts.push(`  <g id="page-header">`);
  svgParts.push(`    <text x="${marginPt.toFixed(2)}" y="${(marginPt + 14).toFixed(2)}" class="title">${escapeXml(title)}</text>`);
  svgParts.push(`    <text x="${marginPt.toFixed(2)}" y="${(marginPt + 27).toFixed(2)}" class="subtitle">${escapeXml(composer)}</text>`);
  svgParts.push(`    <text x="${(widthPt - marginPt).toFixed(2)}" y="${(marginPt + 27).toFixed(2)}" class="section-header" text-anchor="end">${escapeXml(page.sectionName)}</text>`);
  svgParts.push(`    <line x1="${marginPt.toFixed(2)}" y1="${(marginPt + 34).toFixed(2)}" x2="${(widthPt - marginPt).toFixed(2)}" y2="${(marginPt + 34).toFixed(2)}" stroke="#CCCCCC" stroke-width="0.75"/>`);
  svgParts.push(`  </g>`);

  // 3. Render Columns
  for (const col of page.columns) {
    const colLeftPt = marginPt + col.columnOnPageIndex * (colWidthPt + columnGapPt);
    const colStaffLeftPt = colLeftPt + colMarginLeftPt + bufferMarginPt;
    const colTicks = (col.endMeasure - col.startMeasure + 1) * ticksPerMeasure;
    const colStaffHeightPt = colTicks * ptPerTick;

    svgParts.push(`  <!-- Column ${col.columnIndex} (mm. ${col.startMeasure}–${col.endMeasure}) -->`);
    svgParts.push(`  <g id="column-${col.columnIndex}">`);

    // Subtle column frame separator
    svgParts.push(`    <line x1="${colLeftPt.toFixed(2)}" y1="${colTopPt.toFixed(2)}" x2="${colLeftPt.toFixed(2)}" y2="${(colTopPt + colHeaderHeightPt + colStaffHeightPt).toFixed(2)}" stroke="#E5E7EB" stroke-width="0.5"/>`);

    // Pitch Header Labels at column top: m1..m5 (strictly anchored to 4 octaves)
    for (let p = minPitch; p <= maxPitch; p++) {
      const pc = ((p % 12) + 12) % 12;
      const oct = Math.floor(p / 12);
      const px = colStaffLeftPt + (p - minPitch) * ptPerSemitone;
      if (pc === 0) {
        const displayOct = Math.max(0, oct - 1);
        if (displayOct === 2 || displayOct === 4) {
          continue;
        }
        const isCenter = displayOct === 3;
        if (isCenter) {
          // Tasteful center anchor badge for m3
          svgParts.push(`    <rect x="${(px - 9.5).toFixed(2)}" y="${(colTopPt + 2.5).toFixed(2)}" width="19" height="9.5" rx="2" fill="#111827"/>`);
          svgParts.push(`    <text x="${px.toFixed(2)}" y="${(colTopPt + 9.5).toFixed(2)}" font-family='${URTEXT_SERIF}' font-style="italic" font-weight="bold" font-size="6.5pt" fill="#FFFFFF" text-anchor="middle">m3</text>`);
          svgParts.push(`    <line x1="${px.toFixed(2)}" y1="${(colTopPt + 12).toFixed(2)}" x2="${px.toFixed(2)}" y2="${(colTopPt + colHeaderHeightPt).toFixed(2)}" stroke="#111827" stroke-width="1.25"/>`);
        } else {
          svgParts.push(`    <text x="${px.toFixed(2)}" y="${(colTopPt + 10).toFixed(2)}" class="pitch-label" font-weight="bold">m${displayOct}</text>`);
          svgParts.push(`    <line x1="${px.toFixed(2)}" y1="${(colTopPt + 12).toFixed(2)}" x2="${px.toFixed(2)}" y2="${(colTopPt + colHeaderHeightPt).toFixed(2)}" stroke="#888888" stroke-width="0.6"/>`);
        }
      }
    }

    const staffOriginY = colTopPt + colHeaderHeightPt;
    const staffEndY = staffOriginY + colStaffHeightPt;

    // Staff Lines (1-5-9 Symmetric 3-Line Topography with m3 Center Spine)
    // - m3 (Center Axis, Middle C): authoritative bold central spine (1.35pt, #000000)
    // - m1, m2, m4, m5 (Octave Boundaries): same uniform thickness (1.0pt, #000000), visibly thicker than line 9
    // - Landmark 5 (PC 4): small dashes (0.6pt, #444444, [5, 2.5])
    // - Landmark 9 (PC 8): thin straight solid line (0.6pt, #555555)
    for (let p = minPitch; p <= maxPitch; p++) {
      const pc = ((p % 12) + 12) % 12;
      const px = colStaffLeftPt + (p - minPitch) * ptPerSemitone;
      const oct = Math.floor(p / 12);
      const displayOct = Math.max(0, oct - 1);

      if (normStaffStyle === 'tritone-split') {
        if (pc === 0) {
          if (displayOct === 3) {
            // m3: authoritative central spine (1.35pt)
            svgParts.push(`    <line x1="${px.toFixed(2)}" y1="${staffOriginY.toFixed(2)}" x2="${px.toFixed(2)}" y2="${staffEndY.toFixed(2)}" stroke="#000000" stroke-width="1.35"/>`);
          } else {
            // m1, m2, m4, m5: uniform octave line (1.0pt), visibly thicker than line 9 (0.6pt)
            svgParts.push(`    <line x1="${px.toFixed(2)}" y1="${staffOriginY.toFixed(2)}" x2="${px.toFixed(2)}" y2="${staffEndY.toFixed(2)}" stroke="#000000" stroke-width="1.0"/>`);
          }
        } else if (pc === 4) {
          // Landmark 5 small dashes
          svgParts.push(`    <line x1="${px.toFixed(2)}" y1="${staffOriginY.toFixed(2)}" x2="${px.toFixed(2)}" y2="${staffEndY.toFixed(2)}" stroke="#444444" stroke-width="0.6" stroke-dasharray="5,2.5"/>`);
        } else if (pc === 8) {
          // Landmark 9 thin straight line
          svgParts.push(`    <line x1="${px.toFixed(2)}" y1="${staffOriginY.toFixed(2)}" x2="${px.toFixed(2)}" y2="${staffEndY.toFixed(2)}" stroke="#555555" stroke-width="0.6"/>`);
        }
      } else {
        // Fallback whole-tone uniform
        if (pc % 2 === 0) {
          const isOct = pc === 0;
          const isCenter = isOct && displayOct === 3;
          const strokeW = isCenter ? '1.35' : isOct ? '1.0' : '0.6';
          svgParts.push(`    <line x1="${px.toFixed(2)}" y1="${staffOriginY.toFixed(2)}" x2="${px.toFixed(2)}" y2="${staffEndY.toFixed(2)}" stroke="#000000" stroke-width="${strokeW}"/>`);
        }
      }
    }

    const numMeasuresInCol = col.endMeasure - col.startMeasure + 1;

    // Local Dashed Outlier Staff Lines for notes extending past octave boundaries
    for (let m = 0; m < numMeasuresInCol; m++) {
      const mStartTick = (col.startMeasure - 1 + m) * ticksPerMeasure;
      const mEndTick = mStartTick + ticksPerMeasure;
      const measureStartY = staffOriginY + m * ticksPerMeasure * ptPerTick;
      const measureEndY = staffOriginY + (m + 1) * ticksPerMeasure * ptPerTick;

      const measureNotes = col.notes.filter(
        n => n.startTick >= mStartTick && n.startTick < mEndTick
      );

      const outlierNotesHigh = measureNotes.filter(
        n => linearIndex(n.pitch) > maxPitch
      );
      if (outlierNotesHigh.length > 0) {
        const maxOutlierPitch = Math.max(...outlierNotesHigh.map(n => linearIndex(n.pitch)));
        for (let p = maxPitch + 1; ; p++) {
          const pc = ((p % 12) + 12) % 12;
          const geom = getStaffLineGeometry(p, normStaffStyle);
          if (geom.isLine) {
            const lineX = (colStaffLeftPt + (p - minPitch) * ptPerSemitone).toFixed(2);
            if (geom.isDashed && geom.dashArray) {
              svgParts.push(`    <line x1="${lineX}" y1="${measureStartY.toFixed(2)}" x2="${lineX}" y2="${measureEndY.toFixed(2)}" stroke="#444444" stroke-width="0.6" stroke-dasharray="${geom.dashArray.join(',')}"/>`);
            } else if (pc === 0) {
              svgParts.push(`    <line x1="${lineX}" y1="${measureStartY.toFixed(2)}" x2="${lineX}" y2="${measureEndY.toFixed(2)}" stroke="#000000" stroke-width="1.0"/>`);
            } else {
              svgParts.push(`    <line x1="${lineX}" y1="${measureStartY.toFixed(2)}" x2="${lineX}" y2="${measureEndY.toFixed(2)}" stroke="#555555" stroke-width="0.6"/>`);
            }
            if (p >= maxOutlierPitch) break;
          }
        }
      }

      const outlierNotesLow = measureNotes.filter(
        n => linearIndex(n.pitch) < minPitch
      );
      if (outlierNotesLow.length > 0) {
        const minOutlierPitch = Math.min(...outlierNotesLow.map(n => linearIndex(n.pitch)));
        for (let p = minPitch - 1; ; p--) {
          const pc = ((p % 12) + 12) % 12;
          const geom = getStaffLineGeometry(p, normStaffStyle);
          if (geom.isLine) {
            const lineX = (colStaffLeftPt + (p - minPitch) * ptPerSemitone).toFixed(2);
            if (geom.isDashed && geom.dashArray) {
              svgParts.push(`    <line x1="${lineX}" y1="${measureStartY.toFixed(2)}" x2="${lineX}" y2="${measureEndY.toFixed(2)}" stroke="#444444" stroke-width="0.6" stroke-dasharray="${geom.dashArray.join(',')}"/>`);
            } else if (pc === 0) {
              svgParts.push(`    <line x1="${lineX}" y1="${measureStartY.toFixed(2)}" x2="${lineX}" y2="${measureEndY.toFixed(2)}" stroke="#000000" stroke-width="1.0"/>`);
            } else {
              svgParts.push(`    <line x1="${lineX}" y1="${measureStartY.toFixed(2)}" x2="${lineX}" y2="${measureEndY.toFixed(2)}" stroke="#555555" stroke-width="0.6"/>`);
            }
            if (p <= minOutlierPitch) break;
          }
        }
      }
    }

    // Barlines and Measure Numbers
    const rightStaffBound = colStaffLeftPt + (maxPitch - minPitch) * ptPerSemitone;

    for (let m = 0; m <= numMeasuresInCol; m++) {
      const barY = staffOriginY + m * ticksPerMeasure * ptPerTick;

      // Barline across staff
      svgParts.push(`    <line x1="${colStaffLeftPt.toFixed(2)}" y1="${barY.toFixed(2)}" x2="${rightStaffBound.toFixed(2)}" y2="${barY.toFixed(2)}" stroke="#333333" stroke-width="0.75"/>`);

      // Measure number label: only for the first bar of each column, plain number in gutter
      if (m === 0) {
        svgParts.push(`    <text x="${(colStaffLeftPt - bufferMarginPt - 4).toFixed(2)}" y="${(barY + 9).toFixed(2)}" class="measure-num">${col.startMeasure}</text>`);
      }
    }

    // Option 1: Klavarskribo Beat Grid (Horizontal pulse lines for Beat 2, Beat 3, etc. and left gutter beat counter)
    if (layout.options.showBeatGrid) {
      const numBeats = score.timeSignatures?.[0]?.numerator || 3;
      for (let m = 0; m < numMeasuresInCol; m++) {
        const mStartTick = (col.startMeasure - 1 + m) * ticksPerMeasure;

        // Beat 1 Left-Gutter Beat Counter (aligned with solid barline)
        if (mStartTick >= col.startTick && mStartTick < col.endTick) {
          const barY = staffOriginY + (mStartTick - col.startTick) * ptPerTick;
          svgParts.push(`    <!-- Klavarskribo Beat Counter (Beat 1) -->`);
          svgParts.push(`    <text x="${(colStaffLeftPt - 6).toFixed(2)}" y="${(barY + 2.5).toFixed(2)}" class="beat-counter">1</text>`);
        }

        // Beats 2, 3... pulse lines and beat counters
        for (let b = 1; b < numBeats; b++) {
          const bTick = mStartTick + b * ticksPerBeat;
          if (bTick >= col.startTick && bTick < col.endTick) {
            const beatY = staffOriginY + (bTick - col.startTick) * ptPerTick;
            svgParts.push(`    <!-- Klavarskribo Beat Grid (Beat ${b + 1}) -->`);
            svgParts.push(`    <line x1="${colStaffLeftPt.toFixed(2)}" y1="${beatY.toFixed(2)}" x2="${rightStaffBound.toFixed(2)}" y2="${beatY.toFixed(2)}" stroke="#9CA3AF" stroke-width="0.5" stroke-dasharray="2,3" opacity="0.45"/>`);
            svgParts.push(`    <!-- Klavarskribo Beat Counter (Beat ${b + 1}) -->`);
            svgParts.push(`    <text x="${(colStaffLeftPt - 6).toFixed(2)}" y="${(beatY + 2.5).toFixed(2)}" class="beat-counter">${b + 1}</text>`);
          }
        }
      }
    }

    // Option 2: Gutter Beat Brackets (Outer margin beat grouping framing)
    if (layout.options.showGutterBrackets) {
      const numBeats = score.timeSignatures?.[0]?.numerator || 3;
      const lhBeats = new Set<number>();
      const rhBeats = new Set<number>();

      for (const n of col.notes) {
        const bIdx = Math.floor(n.startTick / ticksPerBeat);
        const hand = n.hand ?? (linearIndex(n.pitch) >= 60 ? 'RH' : 'LH');
        if (hand === 'RH') {
          rhBeats.add(bIdx);
        } else {
          lhBeats.add(bIdx);
        }
      }

      const startBIdx = Math.floor(col.startTick / ticksPerBeat);
      const endBIdx = Math.ceil(col.endTick / ticksPerBeat);

      for (let bIdx = startBIdx; bIdx < endBIdx; bIdx++) {
        const bStart = bIdx * ticksPerBeat;
        const bEnd = bStart + ticksPerBeat;
        if (bStart >= col.endTick || bEnd <= col.startTick) continue;

        const effectiveStart = Math.max(col.startTick, bStart);
        const effectiveEnd = Math.min(col.endTick, bEnd);
        const y1 = staffOriginY + (effectiveStart - col.startTick) * ptPerTick + 1.2;
        const y2 = staffOriginY + (effectiveEnd - col.startTick) * ptPerTick - 1.2;
        if (y2 <= y1) continue;

        const beatNum = (bIdx % numBeats) + 1;

        // LH Gutter Bracket (Left margin)
        if (lhBeats.has(bIdx)) {
          const lhRailX = colStaffLeftPt - 8;
          const capLen = 3.5;
          svgParts.push(`    <!-- LH Gutter Bracket (Beat ${beatNum}) -->`);
          svgParts.push(`    <path d="M ${(lhRailX - capLen).toFixed(2)} ${y1.toFixed(2)} L ${lhRailX.toFixed(2)} ${y1.toFixed(2)} L ${lhRailX.toFixed(2)} ${y2.toFixed(2)} L ${(lhRailX - capLen).toFixed(2)} ${y2.toFixed(2)}" fill="none" stroke="#6B7280" stroke-width="0.8" stroke-linecap="round"/>`);
          svgParts.push(`    <text x="${(lhRailX - capLen - 2).toFixed(2)}" y="${(y1 + 6.5).toFixed(2)}" text-anchor="end" font-family="monospace" font-size="7" font-weight="bold" fill="#6B7280">${beatNum}</text>`);
        }

        // RH Gutter Bracket (Right margin)
        if (rhBeats.has(bIdx)) {
          const rhRailX = rightStaffBound + 8;
          const capLen = 3.5;
          svgParts.push(`    <!-- RH Gutter Bracket (Beat ${beatNum}) -->`);
          svgParts.push(`    <path d="M ${(rhRailX + capLen).toFixed(2)} ${y1.toFixed(2)} L ${rhRailX.toFixed(2)} ${y1.toFixed(2)} L ${rhRailX.toFixed(2)} ${y2.toFixed(2)} L ${(rhRailX + capLen).toFixed(2)} ${y2.toFixed(2)}" fill="none" stroke="#6B7280" stroke-width="0.8" stroke-linecap="round"/>`);
          svgParts.push(`    <text x="${(rhRailX + capLen + 2).toFixed(2)}" y="${(y1 + 6.5).toFixed(2)}" text-anchor="start" font-family="monospace" font-size="7" font-weight="bold" fill="#6B7280">${beatNum}</text>`);
        }
      }
    }

    const octaveMode = layout.options.octaveExtensionMode || 'spillover';
    const morph = normalizeNoteheadMorphology(layout.options.noteheadMorphology);
    const stemLength = 16.0;

    // Precalculate display pitches and coordinates for all notes in this column
    const displayPitchMap = new Map<string, number>();
    const noteCoordMap = new Map<string, { nx: number; ny: number; badgeText: string | null; badgeDirection: 'up' | 'down' | null }>();

    for (const note of col.notes) {
      const rawLPitch = linearIndex(note.pitch);
      let lPitch = rawLPitch;
      let badgeText: string | null = null;
      let badgeDirection: 'up' | 'down' | null = null;

      if (octaveMode === 'badge') {
        if (rawLPitch > maxPitch) {
          const shift = Math.ceil((rawLPitch - maxPitch) / 12);
          lPitch = rawLPitch - shift * 12;
          badgeText = shift === 1 ? '↑8' : `↑${8 * shift}`;
          badgeDirection = 'up';
        } else if (rawLPitch < minPitch) {
          const shift = Math.ceil((minPitch - rawLPitch) / 12);
          lPitch = rawLPitch + shift * 12;
          badgeText = shift === 1 ? '↓8' : `↓${8 * shift}`;
          badgeDirection = 'down';
        }
      } else if (octaveMode === 'auto') {
        // If outside the 3-semitone symmetrical margin buffer, fold with badge
        if (rawLPitch > maxPitch + 3) {
          const shift = Math.ceil((rawLPitch - maxPitch) / 12);
          lPitch = rawLPitch - shift * 12;
          badgeText = shift === 1 ? '↑8' : `↑${8 * shift}`;
          badgeDirection = 'up';
        } else if (rawLPitch < minPitch - 3) {
          const shift = Math.ceil((minPitch - rawLPitch) / 12);
          lPitch = rawLPitch + shift * 12;
          badgeText = shift === 1 ? '↓8' : `↓${8 * shift}`;
          badgeDirection = 'down';
        }
      }

      displayPitchMap.set(note.id, lPitch);
      const nx = colStaffLeftPt + (lPitch - minPitch) * ptPerSemitone;
      const ny = staffOriginY + (note.startTick - col.startTick) * ptPerTick;
      noteCoordMap.set(note.id, { nx, ny, badgeText, badgeDirection });
    }

    // Notes: Faint Dotted Continuation Trails for Long Notes (d >= ticksPerBeat with concurrent onsets)
    for (const note of col.notes) {
      const showTrail =
        note.durationTicks >= ticksPerBeat &&
        score.notes.some(
          other =>
            other.id !== note.id &&
            other.startTick > note.startTick &&
            other.startTick < note.startTick + note.durationTicks
        );

      if (showTrail) {
        const { nx, ny } = noteCoordMap.get(note.id)!;
        const lPitch = displayPitchMap.get(note.id)!;
        const isEven = wholeToneParity(lPitch) === 0;
        const noteHeight = morph === 'phonetic' ? 8.5 : (morph === 'rectangle-square' || morph === 'square-ellipse' || morph === 'square-triangle') ? 5.6 : (isEven ? 6.0 : 5.8);
        const trailStartY = ny + noteHeight / 2 + 2;
        const rawReleaseY = ny + note.durationTicks * ptPerTick;
        const trailEndY = Math.min(rawReleaseY, staffEndY);
        const noteColor = getPrintDurationColor(note.durationTicks, tauRef);

        if (trailEndY > trailStartY) {
          svgParts.push(`    <line x1="${nx.toFixed(2)}" y1="${trailStartY.toFixed(2)}" x2="${nx.toFixed(2)}" y2="${trailEndY.toFixed(2)}" stroke="${noteColor}" stroke-width="0.75" stroke-dasharray="2,3" opacity="0.45"/>`);
        }
      }
    }

    // Elaine Gould Angled Beam Engraving & Uniform Lateral Stems
    const stemEndMap = new Map<string, number>();

    if (layout.options.showBeamGrouping === true) {
      const clusters = computeBeamClusters(col.notes, ticksPerBeat, tauRef, 7);
      const MAX_SLANT_PT = 16.0;

      for (const cluster of clusters) {
        if (cluster.notes.length >= 2 && cluster.endTick > cluster.startTick) {
          const cNotes = cluster.notes;
          const nxArr = cNotes.map(n => noteCoordMap.get(n.id)!.nx);
          const nyArr = cNotes.map(n => noteCoordMap.get(n.id)!.ny);

          const y1 = nyArr[0];
          const yK = nyArr[nyArr.length - 1];
          const totalDy = yK - y1;

          // Raw pitch delta from first to last note
          const rawDx = nxArr[nxArr.length - 1] - nxArr[0];

          // Gould slope capping: slant follows rawDx with capped magnitude
          const slantSign = Math.sign(rawDx);
          const rawSlantMagnitude = Math.abs(rawDx) * 0.65;
          const cappedSlant = slantSign * Math.min(rawSlantMagnitude, MAX_SLANT_PT);
          const slope = cappedSlant / totalDy;

          // Anchor beam so that minimum stem length is exactly stemLength (12pt)
          let X0: number;
          if (cluster.hand === 'RH') {
            const maxReq = Math.max(...nxArr.map((nx, i) => nx - slope * (nyArr[i] - y1)));
            X0 = maxReq + stemLength;
          } else {
            const minReq = Math.min(...nxArr.map((nx, i) => nx - slope * (nyArr[i] - y1)));
            X0 = minReq - stemLength;
          }

          const beamX1 = X0;
          const beamXK = X0 + slope * totalDy;

          svgParts.push(`    <!-- Elaine Gould Angled Beam (${cluster.hand}, beat ${cluster.beatIndex + 1}) -->`);
          svgParts.push(`    <line x1="${beamX1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${beamXK.toFixed(2)}" y2="${yK.toFixed(2)}" stroke="#111827" stroke-width="2.0" stroke-linecap="round"/>`);

          for (let i = 0; i < cNotes.length; i++) {
            const note = cNotes[i];
            const endX = X0 + slope * (nyArr[i] - y1);
            stemEndMap.set(note.id, endX);
          }
        }
      }
    }

    for (const note of col.notes) {
      const rawLPitch = linearIndex(note.pitch);
      const { nx, ny, badgeText, badgeDirection } = noteCoordMap.get(note.id)!;
      const lPitch = displayPitchMap.get(note.id)!;
      const isEven = wholeToneParity(lPitch) === 0;
      const nh = morph === 'phonetic' ? 8.5 : (morph === 'rectangle-square' || morph === 'square-ellipse' || morph === 'square-triangle') ? 5.6 : (isEven ? 6.0 : 5.8);
      const noteColor = getPrintDurationColor(note.durationTicks, tauRef);
      const hand = note.hand ?? (rawLPitch >= 60 ? 'RH' : 'LH');
      const isStemException = (hand === 'RH' && rawLPitch < 60) || (hand === 'LH' && rawLPitch >= 60);

      // Klavar lateral stem: symmetry around m3 (indicate only exceptions)
      if (isStemException) {
        const defaultStemEndX = hand === 'RH' ? nx + stemLength : nx - stemLength;
        const stemEndX = stemEndMap.get(note.id) ?? defaultStemEndX;
        svgParts.push(`    <line x1="${nx.toFixed(2)}" y1="${ny.toFixed(2)}" x2="${stemEndX.toFixed(2)}" y2="${ny.toFixed(2)}" stroke="${noteColor}" stroke-width="0.6" stroke-linecap="round"/>`);
      }

      if (morph === 'phonetic') {
        const pc = ((lPitch % 12) + 12) % 12;
        const syllable = getCanonicalSyllable(pc);
        const pw = 15.0;
        const ph = 8.5;
        // White knockout pill
        svgParts.push(`    <rect x="${(nx - (pw + 2) / 2).toFixed(2)}" y="${(ny - (ph + 2) / 2).toFixed(2)}" width="${(pw + 2).toFixed(2)}" height="${(ph + 2).toFixed(2)}" rx="2.5" fill="#FFFFFF"/>`);
        // Notehead pill
        svgParts.push(`    <rect x="${(nx - pw / 2).toFixed(2)}" y="${(ny - ph / 2).toFixed(2)}" width="${pw.toFixed(2)}" height="${ph.toFixed(2)}" rx="2" fill="${noteColor}"/>`);
        // Lowercase syllable text
        svgParts.push(`    <text x="${nx.toFixed(2)}" y="${(ny + 2.5).toFixed(2)}" font-family="monospace" font-weight="bold" font-size="5.5pt" fill="#FFFFFF" text-anchor="middle">${syllable}</text>`);
      } else if (
        morph === 'rectangle-square' ||
        morph === 'square-ellipse' ||
        morph === 'square-triangle'
      ) {
        const isRow0 = isEven;
        // Vertically squished squares: width fills semitone lane for cluster tiling, height squished vertically
        const nw = 7.5;
        const nh = 5.6;
        const bx = nx - nw / 2;
        const by = ny - nh / 2;
        svgParts.push(`    <rect x="${bx.toFixed(2)}" y="${(by - 0.5).toFixed(2)}" width="${nw.toFixed(2)}" height="${(nh + 1.0).toFixed(2)}" rx="1.5" fill="#FFFFFF"/>`);
        if (isRow0) {
          // Row 0: Full (Solid) squished square (sitting on staff lines 1, 5, 9)
          svgParts.push(`    <rect x="${bx.toFixed(2)}" y="${by.toFixed(2)}" width="${nw.toFixed(2)}" height="${nh.toFixed(2)}" rx="1.5" fill="${noteColor}"/>`);
        } else {
          // Row 1: Empty (Hollow) squished square (in whole-tone spaces)
          if (note.durationTicks > tauRef) {
            // Colored note: faint wash (~18% opacity) inside hollow notehead
            svgParts.push(`    <rect x="${bx.toFixed(2)}" y="${by.toFixed(2)}" width="${nw.toFixed(2)}" height="${nh.toFixed(2)}" rx="1.5" fill="${noteColor}" fill-opacity="0.18" stroke="${noteColor}" stroke-width="1.3"/>`);
          } else {
            // 16th note (d <= tauRef): 100% void / transparent interior
            svgParts.push(`    <rect x="${bx.toFixed(2)}" y="${by.toFixed(2)}" width="${nw.toFixed(2)}" height="${nh.toFixed(2)}" rx="1.5" fill="#FFFFFF" stroke="${noteColor}" stroke-width="1.3"/>`);
          }
        }
      } else {
        const rx = 5.2;
        const ry = 3.0;
        const bw = 8.6;
        const bh = 5.8;

        if (isEven) {
          // Row 0 (Lines): Solid Oval extending into adjacent spaces, cleanly sitting on staff line
          svgParts.push(`    <ellipse cx="${nx.toFixed(2)}" cy="${ny.toFixed(2)}" rx="${rx.toFixed(2)}" ry="${ry.toFixed(2)}" fill="${noteColor}"/>`);
        } else {
          // Row 1 (Spaces): Solid Crisp Brick completely filling the whole-tone slot line-to-line
          const bx = nx - bw / 2;
          const by = ny - bh / 2;
          svgParts.push(`    <rect x="${bx.toFixed(2)}" y="${by.toFixed(2)}" width="${bw.toFixed(2)}" height="${bh.toFixed(2)}" rx="1.2" fill="${noteColor}"/>`);
        }
      }

      // Clean Thin Vector Octave Indicator (delicate vector text, zero heavy black blob rectangle)
      if (badgeText) {
        const badgeY = badgeDirection === 'up' ? ny - 5.0 : ny + 9.0;
        svgParts.push(`    <!-- Thin Vector Octave Indicator -->`);
        svgParts.push(`    <text x="${nx.toFixed(2)}" y="${badgeY.toFixed(2)}" font-family="system-ui, -apple-system, sans-serif" font-weight="bold" font-size="6pt" fill="#111827" text-anchor="middle">${badgeText}</text>`);
      }

      // Articulations
      if (note.articulation === 'staccato') {
        svgParts.push(`    <circle cx="${(nx + 6).toFixed(2)}" cy="${ny.toFixed(2)}" r="1.5" fill="${noteColor}"/>`);
      } else if (note.articulation === 'accent') {
        svgParts.push(`    <text x="${(nx + 6).toFixed(2)}" y="${(ny + 3).toFixed(2)}" font-family="sans-serif" font-weight="bold" font-size="7pt" fill="${noteColor}">&gt;</text>`);
      }
    }

    svgParts.push(`  </g>`);
  }

  // 4. Page Footer
  svgParts.push(`  <!-- Page Footer -->`);
  svgParts.push(`  <g id="page-footer">`);
  svgParts.push(`    <line x1="${marginPt.toFixed(2)}" y1="${(heightPt - marginPt - 16).toFixed(2)}" x2="${(widthPt - marginPt).toFixed(2)}" y2="${(heightPt - marginPt - 16).toFixed(2)}" stroke="#E5E7EB" stroke-width="0.75"/>`);
  svgParts.push(`    <text x="${marginPt.toFixed(2)}" y="${(heightPt - marginPt - 4).toFixed(2)}" class="meta">Pure 12-TET Columnar Engraving</text>`);
  svgParts.push(`    <text x="${(widthPt - marginPt).toFixed(2)}" y="${(heightPt - marginPt - 4).toFixed(2)}" class="meta" text-anchor="end" font-weight="bold">Page ${page.pageNumber} of ${page.totalPages}</text>`);
  svgParts.push(`  </g>`);

  svgParts.push(`</svg>`);

  return svgParts.join('\n');
}

/**
 * Returns an array of standalone SVGs for all pages in the layout.
 */
export function renderAllPagesToSvg(layout: ColumnarScoreLayout): string[] {
  return layout.pages.map((_, idx) => renderPageToSvg(layout, idx));
}

/**
 * Unified SVG generator:
 * - If called as (score, pageIndex, options) -> returns SVG of specific page.
 * - If called as (score, options) -> returns SVG of page 0.
 * - If called as (score) -> returns SVG of page 0.
 */
export function renderColumnarScoreToSvg(
  score: QuantizedGridScore,
  pageIndexOrOptions?: number | Partial<PrintLayoutOptions>,
  maybeOptions?: Partial<PrintLayoutOptions>
): string {
  let pageIndex = 0;
  let options: Partial<PrintLayoutOptions> | undefined;

  if (typeof pageIndexOrOptions === 'number') {
    pageIndex = pageIndexOrOptions;
    options = maybeOptions;
  } else if (typeof pageIndexOrOptions === 'object') {
    options = pageIndexOrOptions;
  }

  const layout = computeColumnarLayout(score, options);
  return renderPageToSvg(layout, pageIndex);
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
