import { QuantizedGridScore, QuantizedNote, HandCrossingEvent } from '../model/types';
import { linearIndex, wholeToneParity } from '../model/pitch';
import { getCanonicalSyllable } from '../model/phonetics';
import { detectHandCrossings } from '../model/grid';
import { StaffStyle, NoteheadMorphology, normalizeStaffStyle, normalizeNoteheadMorphology, getPrintDurationColor } from './types';

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

const DEFAULT_OPTIONS: Required<PrintLayoutOptions> = {
  paperSize: 'A4',
  orientation: 'portrait',
  measuresPerColumn: 8,
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

  // Pitch range bounding
  let minPitch = options.minPitch > 0 ? options.minPitch : 127;
  let maxPitch = options.maxPitch < 127 ? options.maxPitch : 0;

  if (score.notes.length > 0 && (options.minPitch === 0 || options.maxPitch === 127)) {
    const indices = score.notes.map(n => linearIndex(n.pitch));
    const dataMin = Math.min(...indices);
    const dataMax = Math.max(...indices);
    minPitch = Math.floor((dataMin - 2) / 2) * 2; // snap to whole tone
    maxPitch = Math.ceil((dataMax + 2) / 2) * 2;
  } else if (minPitch >= maxPitch) {
    minPitch = 36; // C2
    maxPitch = 76; // E5
  }

  // Ensure whole-tone alignment for clean staff presentation
  minPitch = Math.floor(minPitch / 2) * 2;
  maxPitch = Math.ceil(maxPitch / 2) * 2;
  const pitchSpan = Math.max(12, maxPitch - minPitch + 1);

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
  const headerHeightPt = 42;
  const footerHeightPt = 22;
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

    // Designate sections (e.g. Page 1: Section A mm. 1–16, Page 2: Section B mm. 17–32)
    const sectionLetter = String.fromCharCode(65 + p); // 'A', 'B', etc.
    const sectionName = `Section ${sectionLetter} (mm. ${sMeasure}–${eMeasure})`;

    pages.push({
      pageIndex: p,
      pageNumber: p + 1,
      totalPages,
      sectionName,
      columns: pageCols,
    });
  }

  // Calculate scales
  const columnMarginLeftPt = 22; // For measure number labels
  const columnMarginRightPt = 10;
  const usablePitchWidthPt = Math.max(50, columnWidthPt - columnMarginLeftPt - columnMarginRightPt);

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

  const { score, options, minPitch, maxPitch, ptPerSemitone, ptPerTick, ticksPerMeasure } = layout;
  const { widthPt, heightPt, widthMm, heightMm } = layout.pageDimensions;
  const marginPt = options.pageMarginMm * MM_TO_PT;
  const columnGapPt = options.columnGapMm * MM_TO_PT;
  const colWidthPt = layout.columnDimensions.widthPt;

  const headerHeightPt = 42;
  const footerHeightPt = 22;
  const colHeaderHeightPt = 16;
  const colTopPt = marginPt + headerHeightPt;

  const colMarginLeftPt = 22;
  const colMarginRightPt = 10;

  const normStaffStyle = normalizeStaffStyle(options.staffStyle);
  const tauRef = score.gridResolution || 12;
  const holdRibbonWidth = options.holdRibbonWidthPt || 4;

  const svgParts: string[] = [];

  // 1. Root SVG with pure white paper background
  svgParts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${widthPt.toFixed(2)} ${heightPt.toFixed(2)}" width="${widthMm.toFixed(1)}mm" height="${heightMm.toFixed(1)}mm">`
  );
  svgParts.push(`  <defs>`);
  svgParts.push(`    <style>`);
  svgParts.push(`      .title { font-family: system-ui, -apple-system, sans-serif; font-weight: bold; font-size: 13pt; fill: #000000; }`);
  svgParts.push(`      .subtitle { font-family: system-ui, -apple-system, sans-serif; font-size: 8.5pt; fill: #444444; }`);
  svgParts.push(`      .meta { font-family: system-ui, -apple-system, monospace; font-size: 7.5pt; fill: #666666; }`);
  svgParts.push(`      .measure-num { font-family: monospace; font-weight: bold; font-size: 7pt; fill: #444444; text-anchor: end; }`);
  svgParts.push(`      .pitch-label { font-family: monospace; font-size: 6.5pt; fill: #555555; text-anchor: middle; }`);
  svgParts.push(`      .cross-label { font-family: monospace; font-size: 6pt; fill: #888888; font-weight: bold; text-anchor: end; }`);
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
  svgParts.push(`    <text x="${marginPt.toFixed(2)}" y="${(marginPt + 27).toFixed(2)}" class="subtitle">${escapeXml(composer)} — <tspan font-weight="bold" fill="#000000">${escapeXml(page.sectionName)}</tspan></text>`);
  svgParts.push(`    <text x="${(widthPt - marginPt).toFixed(2)}" y="${(marginPt + 14).toFixed(2)}" class="meta" text-anchor="end">Vertical Isomorphic Notation</text>`);
  svgParts.push(`    <text x="${(widthPt - marginPt).toFixed(2)}" y="${(marginPt + 27).toFixed(2)}" class="meta" text-anchor="end">5/7 Demarcated Staff • Klavar Lateral Stems</text>`);
  svgParts.push(`    <line x1="${marginPt.toFixed(2)}" y1="${(marginPt + 34).toFixed(2)}" x2="${(widthPt - marginPt).toFixed(2)}" y2="${(marginPt + 34).toFixed(2)}" stroke="#CCCCCC" stroke-width="0.75"/>`);
  svgParts.push(`  </g>`);

  // 3. Render Columns
  for (const col of page.columns) {
    const colLeftPt = marginPt + col.columnOnPageIndex * (colWidthPt + columnGapPt);
    const colStaffLeftPt = colLeftPt + colMarginLeftPt;
    const colTicks = (col.endMeasure - col.startMeasure + 1) * ticksPerMeasure;
    const colStaffHeightPt = colTicks * ptPerTick;

    svgParts.push(`  <!-- Column ${col.columnIndex} (mm. ${col.startMeasure}–${col.endMeasure}) -->`);
    svgParts.push(`  <g id="column-${col.columnIndex}">`);

    // Subtle column frame separator
    svgParts.push(`    <line x1="${colLeftPt.toFixed(2)}" y1="${colTopPt.toFixed(2)}" x2="${colLeftPt.toFixed(2)}" y2="${(colTopPt + colHeaderHeightPt + colStaffHeightPt).toFixed(2)}" stroke="#E5E7EB" stroke-width="0.5"/>`);

    // Pitch Header Labels at column top
    for (let p = minPitch; p <= maxPitch; p++) {
      const pc = ((p % 12) + 12) % 12;
      const oct = Math.floor(p / 12);
      const px = colStaffLeftPt + (p - minPitch) * ptPerSemitone;
      if (pc === 0) {
        const displayOct = Math.max(0, oct - 1);
        svgParts.push(`    <text x="${px.toFixed(2)}" y="${(colTopPt + 10).toFixed(2)}" class="pitch-label" font-weight="bold">m${displayOct}</text>`);
        svgParts.push(`    <line x1="${px.toFixed(2)}" y1="${(colTopPt + 12).toFixed(2)}" x2="${px.toFixed(2)}" y2="${(colTopPt + colHeaderHeightPt).toFixed(2)}" stroke="#000000" stroke-width="1.0"/>`);
      } else if (pc === 4 && normStaffStyle === 'tritone-split') {
        svgParts.push(`    <text x="${px.toFixed(2)}" y="${(colTopPt + 10).toFixed(2)}" class="pitch-label" font-size="6pt">5|7</text>`);
        svgParts.push(`    <line x1="${px.toFixed(2)}" y1="${(colTopPt + 12).toFixed(2)}" x2="${px.toFixed(2)}" y2="${(colTopPt + colHeaderHeightPt).toFixed(2)}" stroke="#555555" stroke-width="0.6" stroke-dasharray="12,4"/>`);
      }
    }

    const staffOriginY = colTopPt + colHeaderHeightPt;
    const staffEndY = staffOriginY + colStaffHeightPt;

    // Staff Lines (5/7 Staff Topography)
    // PC 0: bold octave (1.5pt)
    // PC 4: 5/7 Demarcation thin long line (0.6pt, Klavarscribo-style [12, 4])
    // PC 2, 6, 8, 10: hairlines (0.5pt)
    // Odd PCs: spaces
    for (let p = minPitch; p <= maxPitch; p++) {
      const pc = ((p % 12) + 12) % 12;
      const px = colStaffLeftPt + (p - minPitch) * ptPerSemitone;

      if (normStaffStyle === 'tritone-split') {
        if (pc === 0) {
          // Bold octave boundary
          svgParts.push(`    <line x1="${px.toFixed(2)}" y1="${staffOriginY.toFixed(2)}" x2="${px.toFixed(2)}" y2="${staffEndY.toFixed(2)}" stroke="#000000" stroke-width="1.5"/>`);
        } else if (pc === 4) {
          // 5/7 Demarcation thin long Klavar-style line
          svgParts.push(`    <line x1="${px.toFixed(2)}" y1="${staffOriginY.toFixed(2)}" x2="${px.toFixed(2)}" y2="${staffEndY.toFixed(2)}" stroke="#333333" stroke-width="0.6" stroke-dasharray="12,4"/>`);
        } else if (pc === 2 || pc === 6 || pc === 8 || pc === 10) {
          // Hairlines
          svgParts.push(`    <line x1="${px.toFixed(2)}" y1="${staffOriginY.toFixed(2)}" x2="${px.toFixed(2)}" y2="${staffEndY.toFixed(2)}" stroke="#888888" stroke-width="0.5"/>`);
        }
      } else {
        // Fallback whole-tone uniform
        if (pc % 2 === 0) {
          const isOct = pc === 0;
          svgParts.push(`    <line x1="${px.toFixed(2)}" y1="${staffOriginY.toFixed(2)}" x2="${px.toFixed(2)}" y2="${staffEndY.toFixed(2)}" stroke="#000000" stroke-width="${isOct ? '1.5' : '0.6'}"/>`);
        }
      }
    }

    // Barlines and Measure Numbers
    const numMeasuresInCol = col.endMeasure - col.startMeasure + 1;
    const rightStaffBound = colStaffLeftPt + (maxPitch - minPitch) * ptPerSemitone;

    for (let m = 0; m <= numMeasuresInCol; m++) {
      const barY = staffOriginY + m * ticksPerMeasure * ptPerTick;
      const currentMNum = col.startMeasure + m;

      // Barline across staff
      svgParts.push(`    <line x1="${(colStaffLeftPt - 4).toFixed(2)}" y1="${barY.toFixed(2)}" x2="${(rightStaffBound + 4).toFixed(2)}" y2="${barY.toFixed(2)}" stroke="#333333" stroke-width="0.75"/>`);

      // Measure number label (only for measures starting inside column)
      if (m < numMeasuresInCol) {
        svgParts.push(`    <text x="${(colStaffLeftPt - 6).toFixed(2)}" y="${(barY + 9).toFixed(2)}" class="measure-num">M${currentMNum}</text>`);
      }
    }

    // Hand Crossings Overlay in Column
    for (const hc of col.handCrossings) {
      const hcStartTick = Math.max(col.startTick, hc.tick);
      const hcEndTick = Math.min(col.endTick, hc.tick + hc.durationTicks);
      if (hcEndTick > hcStartTick) {
        const hcY1 = staffOriginY + (hcStartTick - col.startTick) * ptPerTick;
        const hcY2 = staffOriginY + (hcEndTick - col.startTick) * ptPerTick;
        const hcHeight = Math.max(2, hcY2 - hcY1);

        svgParts.push(`    <!-- Hand Crossing Overlay -->`);
        svgParts.push(`    <rect x="${(colStaffLeftPt - 2).toFixed(2)}" y="${hcY1.toFixed(2)}" width="${(rightStaffBound - colStaffLeftPt + 4).toFixed(2)}" height="${hcHeight.toFixed(2)}" fill="#F3F4F6" opacity="0.6"/>`);
        svgParts.push(`    <text x="${(colLeftPt + colWidthPt - 4).toFixed(2)}" y="${(hcY1 + 8).toFixed(2)}" class="cross-label">LH/RH Cross</text>`);
      }
    }

    // Notes: First Hold Ribbons (for d > tauRef)
    for (const note of col.notes) {
      if (note.durationTicks > tauRef) {
        const lPitch = linearIndex(note.pitch);
        const nx = colStaffLeftPt + (lPitch - minPitch) * ptPerSemitone;
        const ny = staffOriginY + (note.startTick - col.startTick) * ptPerTick;
        const ribbonHeight = note.durationTicks * ptPerTick;
        const noteColor = getPrintDurationColor(note.durationTicks, tauRef);

        svgParts.push(`    <rect x="${(nx - holdRibbonWidth / 2).toFixed(2)}" y="${ny.toFixed(2)}" width="${holdRibbonWidth.toFixed(2)}" height="${ribbonHeight.toFixed(2)}" rx="2" fill="${noteColor}"/>`);
      }
    }

    // Notes: Klavar Lateral Stems & Solid Row-Parity / Phonetic Noteheads with White Halo Knockout
    const morph = normalizeNoteheadMorphology(layout.options.noteheadMorphology);
    for (const note of col.notes) {
      const lPitch = linearIndex(note.pitch);
      const nx = colStaffLeftPt + (lPitch - minPitch) * ptPerSemitone;
      const ny = staffOriginY + (note.startTick - col.startTick) * ptPerTick;
      const isEven = wholeToneParity(note.pitch) === 0;
      const noteColor = getPrintDurationColor(note.durationTicks, tauRef);
      const hand = note.hand ?? (lPitch >= 60 ? 'RH' : 'LH');

      // Klavar lateral stem:
      // Right Hand (RH) -> horizontal stem pointing Right
      // Left Hand (LH) -> horizontal stem pointing Left
      const stemLength = 12.0;
      const stemEndX = hand === 'RH' ? nx + stemLength : nx - stemLength;
      svgParts.push(`    <line x1="${nx.toFixed(2)}" y1="${ny.toFixed(2)}" x2="${stemEndX.toFixed(2)}" y2="${ny.toFixed(2)}" stroke="${noteColor}" stroke-width="0.6" stroke-linecap="round"/>`);

      if (morph === 'phonetic') {
        // Phonetic tokens strictly lowercase (ma, di, va, pi, la, ri, na, ti, fa, bi, sa, ki)
        const syllable = getCanonicalSyllable(note.pitch.pitchClass);
        const pw = 15.0;
        const ph = 8.5;
        // White knockout pill
        svgParts.push(`    <rect x="${(nx - (pw + 2) / 2).toFixed(2)}" y="${(ny - (ph + 2) / 2).toFixed(2)}" width="${(pw + 2).toFixed(2)}" height="${(ph + 2).toFixed(2)}" rx="2.5" fill="#FFFFFF"/>`);
        // Notehead pill
        svgParts.push(`    <rect x="${(nx - pw / 2).toFixed(2)}" y="${(ny - ph / 2).toFixed(2)}" width="${pw.toFixed(2)}" height="${ph.toFixed(2)}" rx="2" fill="${noteColor}"/>`);
        // Lowercase syllable text
        svgParts.push(`    <text x="${nx.toFixed(2)}" y="${(ny + 2.5).toFixed(2)}" font-family="monospace" font-weight="bold" font-size="5.5pt" fill="#FFFFFF" text-anchor="middle">${syllable}</text>`);
      } else {
        // Optical Notehead Balance Invariant:
        // Diamond d = 4.0pt, Circle r = 3.2pt
        // Circle area: pi * 3.2^2 ≈ 32.17 pt^2
        // Diamond area: 2 * 4.0^2 = 32.00 pt^2 (matched within 0.5%)
        const r = 3.2;
        const d = 4.0;

        if (isEven) {
          // Row 0 (Lines): Solid Disc with White Halo Knockout
          svgParts.push(`    <circle cx="${nx.toFixed(2)}" cy="${ny.toFixed(2)}" r="${r}" fill="${noteColor}" stroke="#FFFFFF" stroke-width="2"/>`);
        } else {
          // Row 1 (Spaces): Solid Diamond with White Halo Knockout
          const pts = `${nx.toFixed(2)},${(ny - d).toFixed(2)} ${(nx + d).toFixed(2)},${ny.toFixed(2)} ${nx.toFixed(2)},${(ny + d).toFixed(2)} ${(nx - d).toFixed(2)},${ny.toFixed(2)}`;
          svgParts.push(`    <polygon points="${pts}" fill="${noteColor}" stroke="#FFFFFF" stroke-width="2"/>`);
        }
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
  svgParts.push(`    <line x1="${marginPt.toFixed(2)}" y1="${(heightPt - marginPt - 14).toFixed(2)}" x2="${(widthPt - marginPt).toFixed(2)}" y2="${(heightPt - marginPt - 14).toFixed(2)}" stroke="#E5E7EB" stroke-width="0.75"/>`);
  svgParts.push(`    <text x="${marginPt.toFixed(2)}" y="${(heightPt - marginPt - 4).toFixed(2)}" class="meta">Pure 12-TET Columnar Engraving • Zero Page Turns Across Sections</text>`);
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
