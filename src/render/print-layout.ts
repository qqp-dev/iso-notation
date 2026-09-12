import { QuantizedGridScore, QuantizedNote, HandCrossingEvent } from '../model/types';
import { linearIndex, wholeToneParity } from '../model/pitch';
import { getCanonicalSyllable } from '../model/phonetics';
import { detectHandCrossings } from '../model/grid';
import {
  StaffStyle,
  NoteheadMorphology,
  normalizeStaffStyle,
  normalizeNoteheadMorphology,
  getPrintDurationColor,
  getStaffLineGeometry,
  DUODECIMAL_DIGITS,
} from './types';

export const URTEXT_SERIF = '"Century Schoolbook", "Baskerville", "Liberation Serif", "DejaVu Serif", "Times New Roman", Georgia, serif';

export const A4_WIDTH_PT = 595.28; // 210mm in PostScript points (72 pt/inch)
export const A4_HEIGHT_PT = 841.89; // 297mm in PostScript points
export const LETTER_WIDTH_PT = 612.0; // 8.5 in * 72 pt/in (US Letter)
export const LETTER_HEIGHT_PT = 792.0; // 11.0 in * 72 pt/in (US Letter)
export const MM_TO_PT = 72 / 25.4; // 2.834645669...
export const PT_TO_MM = 25.4 / 72;

/**
 * Horizontal isomorphic staff bounds: o1 (C2, linear 24) → o5 (C6, linear 72).
 * Pitch rises vertically (o1 at the bottom, o5 at the top) while time flows left → right.
 */
export const STAFF_MIN_PITCH = 24;
export const STAFF_MAX_PITCH = 72;
/** One semitone lane = 4.35pt, so the 4-octave staff is 208.8pt tall. */
export const DEFAULT_PT_PER_SEMITONE = 4.35;
/** Breathing room before the first onset of every measure (keeps tick-0 noteheads clear of the opening barline). */
export const MEASURE_INSET_PT = 6;
/** Circular white knockout radius around every duodecimal notehead. */
export const NOTEHEAD_KNOCKOUT_RADIUS_PT = 3.65;
/** Noble concentric halo ring around the opening sound(s) at tick 0 in Measure 1. */
export const OPENING_HALO_RADIUS_PT = 4.75;
/** Noble Urtext Gold stroke for the opening sound position of honor halo ring. */
export const OPENING_HALO_STROKE = '#D4AF37';
/** Classical architectural reach of the vertical accolade cusp from the staff edge. */
export const ACCOLADE_WIDTH_PT = 7.5;
/** Delicate margin offset giving breathing gap between accolade tips and staff lines. */
export const ACCOLADE_OFFSET_LEFT_PT = 4.5;
/** Margin breathing gap accommodating the classical accolade on System 1. */
export const ACCOLADE_GAP_PT = 8.0;
/** Delicate calligraphic swell of the accolade in its lobe bellies. */
export const ACCOLADE_THICKNESS_PT = 1.9;

const HEADER_HEIGHT_PT = 18;
const FOOTER_HEIGHT_PT = 0;
/** Reserved strip above each system for clean Urtext measure numerals. */
const SYSTEM_LABEL_HEIGHT_PT = 8;
const MEASURES_PER_SYSTEM_DEFAULT = 4;
const SYSTEMS_PER_PAGE_DEFAULT = 2;

const pc12 = (p: number): number => ((p % 12) + 12) % 12;

/**
 * Subtracts interval [sub1, sub2] from an array of disjoint intervals.
 */
export function subtractInterval(
  intervals: [number, number][],
  sub1: number,
  sub2: number
): [number, number][] {
  const result: [number, number][] = [];
  for (const [start, end] of intervals) {
    if (sub2 <= start || sub1 >= end) {
      result.push([start, end]);
    } else {
      if (sub1 > start) {
        result.push([start, sub1]);
      }
      if (sub2 < end) {
        result.push([sub2, end]);
      }
    }
  }
  return result;
}

/**
 * Generates an SVG path string for a directional baked notehead pentagon.
 * Retained for backward compatibility with the canvas engraver / legacy callers.
 */
export function getBakedPath(
  bx: number,
  by: number,
  nw: number,
  nh: number,
  ny: number,
  hand: 'RH' | 'LH',
  tip: number = 2.4,
  rx: number = 1.2
): string {
  if (hand === 'LH') {
    // Pointing left: flat back on right (bx + nw)
    const rightX = bx + nw;
    const apexX = bx - tip;
    return `M ${(rightX - rx).toFixed(2)} ${by.toFixed(2)} ` +
      `L ${bx.toFixed(2)} ${by.toFixed(2)} ` +
      `L ${apexX.toFixed(2)} ${ny.toFixed(2)} ` +
      `L ${bx.toFixed(2)} ${(by + nh).toFixed(2)} ` +
      `L ${(rightX - rx).toFixed(2)} ${(by + nh).toFixed(2)} ` +
      `A ${rx} ${rx} 0 0 0 ${rightX.toFixed(2)} ${(by + nh - rx).toFixed(2)} ` +
      `L ${rightX.toFixed(2)} ${(by + rx).toFixed(2)} ` +
      `A ${rx} ${rx} 0 0 0 ${(rightX - rx).toFixed(2)} ${by.toFixed(2)} Z`;
  } else {
    // Pointing right: flat back on left (bx)
    const rightX = bx + nw;
    const apexX = rightX + tip;
    return `M ${(bx + rx).toFixed(2)} ${by.toFixed(2)} ` +
      `L ${rightX.toFixed(2)} ${by.toFixed(2)} ` +
      `L ${apexX.toFixed(2)} ${ny.toFixed(2)} ` +
      `L ${rightX.toFixed(2)} ${(by + nh).toFixed(2)} ` +
      `L ${(bx + rx).toFixed(2)} ${(by + nh).toFixed(2)} ` +
      `A ${rx} ${rx} 0 0 1 ${bx.toFixed(2)} ${(by + nh - rx).toFixed(2)} ` +
      `L ${bx.toFixed(2)} ${(by + rx).toFixed(2)} ` +
      `A ${rx} ${rx} 0 0 1 ${(bx + rx).toFixed(2)} ${by.toFixed(2)} Z`;
  }
}

/**
 * Legacy horizontal Grand Staff Accolade (curly brace) spanning x1 → x2.
 * Superseded by the authentic vertical accolade of the horizontal system layout.
 * @deprecated Use {@link getVerticalAccoladePath} for horizontal systems.
 */
export function getClassicalAccoladePath(
  x1: number,
  x2: number,
  y: number,
  h: number = 4.2,
  thick: number = 1.25
): string {
  const xm = (x1 + x2) / 2;
  const hw = (x2 - x1) / 2;
  return [
    `M ${x1.toFixed(2)} ${(y + 3).toFixed(2)}`,
    `C ${(x1 + 4).toFixed(2)} ${(y + 0.5).toFixed(2)}, ${(x1 + hw * 0.35).toFixed(2)} ${y.toFixed(2)}, ${(xm - hw * 0.25).toFixed(2)} ${y.toFixed(2)}`,
    `C ${(xm - hw * 0.08).toFixed(2)} ${y.toFixed(2)}, ${(xm - 2).toFixed(2)} ${(y - 0.5).toFixed(2)}, ${xm.toFixed(2)} ${(y - h).toFixed(2)}`,
    `C ${(xm + 2).toFixed(2)} ${(y - 0.5).toFixed(2)}, ${(xm + hw * 0.08).toFixed(2)} ${y.toFixed(2)}, ${(xm + hw * 0.25).toFixed(2)} ${y.toFixed(2)}`,
    `C ${(x2 - hw * 0.35).toFixed(2)} ${y.toFixed(2)}, ${(x2 - 4).toFixed(2)} ${(y + 0.5).toFixed(2)}, ${x2.toFixed(2)} ${(y + 3).toFixed(2)}`,
    `C ${(x2 - 4).toFixed(2)} ${(y + 0.5 + thick * 0.4).toFixed(2)}, ${(x2 - hw * 0.35).toFixed(2)} ${(y + thick).toFixed(2)}, ${(xm + hw * 0.25).toFixed(2)} ${(y + thick * 0.9).toFixed(2)}`,
    `C ${(xm + hw * 0.08).toFixed(2)} ${(y + thick * 0.6).toFixed(2)}, ${(xm + 1.8).toFixed(2)} ${(y - 0.5 + thick * 0.3).toFixed(2)}, ${xm.toFixed(2)} ${(y - h + 0.6).toFixed(2)}`,
    `C ${(xm - 1.8).toFixed(2)} ${(y - 0.5 + thick * 0.3).toFixed(2)}, ${(xm - hw * 0.08).toFixed(2)} ${(y + thick * 0.6).toFixed(2)}, ${(xm - hw * 0.25).toFixed(2)} ${(y + thick * 0.9).toFixed(2)}`,
    `C ${(x1 + hw * 0.35).toFixed(2)} ${(y + thick).toFixed(2)}, ${(x1 + 4).toFixed(2)} ${(y + 0.5 + thick * 0.4).toFixed(2)}, ${x1.toFixed(2)} ${(y + 3).toFixed(2)}`,
    `Z`
  ].join(' ');
}

/**
/**
 * Classical LilyPond/Emmentaler brace outline command table.
 * 15 cubic Bézier segments derived from authentic master music engraving (brace396).
 */
const LILY_BRACE_CMDS: Array<{ type: 'M' | 'c' | 's'; args: number[] }> = [
  { type: 'M', args: [-133, -1078] },
  { type: 'c', args: [0, 721, -287, 1064, -287, 1078] },
  { type: 'c', args: [0, 35, 287, 329, 287, 1078] },
  { type: 'c', args: [0, 756, -266, 1463, -266, 2324] },
  { type: 'c', args: [0, 504, 98, 994, 378, 1414] },
  { type: 'c', args: [21, 28, 63, -7, 42, -35] },
  { type: 'c', args: [-217, -322, -287, -686, -287, -1071] },
  { type: 'c', args: [0, -749, 259, -1449, 259, -2296] },
  { type: 'c', args: [0, -504, -91, -994, -371, -1414] },
  { type: 'c', args: [280, -420, 371, -910, 371, -1414] },
  { type: 'c', args: [0, -847, -259, -1547, -259, -2296] },
  { type: 'c', args: [0, -385, 70, -749, 287, -1071] },
  { type: 'c', args: [21, -28, -21, -63, -42, -35] },
  { type: 'c', args: [-280, 420, -378, 910, -378, 1414] },
  { type: 'c', args: [0, 861, 266, 1568, 266, 2324] },
];

/**
 * Authentic classical vertical accolade (curly brace) for the left margin of a
 * horizontal system. It clasps the full 4-octave staff from yTop (o5) to yBot (o1)
 * with its central cusp pointing directly horizontally into the Middle C spine at y(48).
 *
 * Implements the definitive Emmentaler/LilyPond master-engraved brace geometry:
 * - Razor-sharp horizontal beak cusp at yMid pointing leftward into the margin
 * - Delicate, graceful waist inflections
 * - Sculptural, organic swelling bellies
 * - Feather-tapered tips clasping the staff edges at staffLeft
 */
export function getVerticalAccoladePath(
  staffLeft: number,
  yTop: number,
  yBot: number,
  reachOrBelly: number = ACCOLADE_WIDTH_PT,
  cuspOrThick: number = ACCOLADE_THICKNESS_PT,
  maybeThick?: number
): string {
  let reach = ACCOLADE_WIDTH_PT;

  if (maybeThick !== undefined) {
    reach = cuspOrThick;
  } else if (reachOrBelly > 0) {
    reach = reachOrBelly;
  }

  const ym = (yTop + yBot) / 2;
  const h = yBot - yTop;
  const FONT_MAX_Y = 4844.0;
  const FONT_MIN_X = -420.0;
  const FONT_MAX_X = 42.0;

  const scaleY = (h / 2) / FONT_MAX_Y;
  const scaleX = reach / (FONT_MAX_X - FONT_MIN_X);

  const toS = (x: number, y: number): string =>
    `${(staffLeft + (x - FONT_MAX_X) * scaleX).toFixed(2)} ${(ym - y * scaleY).toFixed(2)}`;

  let curr: [number, number] = [LILY_BRACE_CMDS[0].args[0], LILY_BRACE_CMDS[0].args[1]];
  let prevCp: [number, number] = [curr[0], curr[1]];
  const parts = [`M ${toS(curr[0], curr[1])}`];

  for (let i = 1; i < LILY_BRACE_CMDS.length; i++) {
    const cmd = LILY_BRACE_CMDS[i];
    let p1: [number, number];
    let p2: [number, number];
    let p3: [number, number];

    if (cmd.type === 'c') {
      p1 = [curr[0] + cmd.args[0], curr[1] + cmd.args[1]];
      p2 = [curr[0] + cmd.args[2], curr[1] + cmd.args[3]];
      p3 = [curr[0] + cmd.args[4], curr[1] + cmd.args[5]];
    } else {
      p1 = [2 * curr[0] - prevCp[0], 2 * curr[1] - prevCp[1]];
      p2 = [curr[0] + cmd.args[0], curr[1] + cmd.args[1]];
      p3 = [curr[0] + cmd.args[2], curr[1] + cmd.args[3]];
    }
    parts.push(`C ${toS(p1[0], p1[1])}, ${toS(p2[0], p2[1])}, ${toS(p3[0], p3[1])}`);
    prevCp = p2;
    curr = p3;
  }
  parts.push('Z');
  return parts.join(' ');
}

export interface PrintLayoutOptions {
  paperSize?: 'A4' | 'A3' | 'letter';
  orientation?: 'portrait' | 'landscape';
  /** Measures engraved in each horizontal system (default: 4). */
  measuresPerSystem?: number;
  /** @deprecated Legacy alias of measuresPerSystem. */
  measuresPerColumn?: number;
  /** Horizontal systems stacked on each page (default: 3). */
  systemsPerPage?: number;
  /** @deprecated Legacy alias of systemsPerPage. */
  columnsPerPage?: number;
  pageMarginMm?: number; // default: 10mm
  /** @deprecated Retained for API compatibility; horizontal systems span the full printable width. */
  columnGapMm?: number;
  staffStyle?: StaffStyle; // default: 'tritone-split'
  noteheadMorphology?: NoteheadMorphology; // default: 'duodecimal'
  holdRibbonWidthPt?: number; // default: 4pt
  minPitch?: number; // optional manual pitch bounds
  maxPitch?: number;
  pixelsPerTick?: number; // optional scale overrides
  pixelsPerSemitone?: number;
  /** Retained for API compatibility: horizontal systems always render true-pitch spillover. */
  octaveExtensionMode?: 'badge' | 'spillover' | 'auto';
  showBeatGrid?: boolean; // default: true
  showGutterBrackets?: boolean; // default: false
}

export interface ResolvedPrintLayoutOptions {
  paperSize: 'A4' | 'A3' | 'letter';
  orientation: 'portrait' | 'landscape';
  measuresPerSystem: number;
  measuresPerColumn: number;
  systemsPerPage: number;
  columnsPerPage: number;
  pageMarginMm: number;
  columnGapMm: number;
  staffStyle: StaffStyle;
  noteheadMorphology: NoteheadMorphology;
  holdRibbonWidthPt: number;
  minPitch: number;
  maxPitch: number;
  pixelsPerTick: number;
  pixelsPerSemitone: number;
  octaveExtensionMode: 'badge' | 'spillover' | 'auto';
  showBeatGrid: boolean;
  showGutterBrackets: boolean;
}

/** One horizontal system: a left-to-right run of measures on a single 4-octave staff. */
export interface SystemSlice {
  systemIndex: number; // 0..N
  pageIndex: number; // 0..P
  systemOnPageIndex: number; // 0..(systemsPerPage - 1)
  startMeasure: number; // 1-indexed inclusive (e.g. 1, 5, 9, 13)
  endMeasure: number; // 1-indexed inclusive (e.g. 4, 8, 12, 16)
  /** Explicit system-start measure alias, mirroring startMeasure. */
  sysStartMeasure: number;
  startTick: number; // exact start tick in score
  endTick: number; // exact end tick in score
  notes: QuantizedNote[];
  handCrossings: HandCrossingEvent[];
}

/** @deprecated Legacy alias kept for callers of the former columnar layout. */
export type ColumnSlice = SystemSlice;

export interface PageLayout {
  pageIndex: number;
  pageNumber: number; // 1-indexed
  totalPages: number;
  sectionName: string; // e.g. "Section A (mm. 1–16)"
  systems: SystemSlice[];
  /** @deprecated Legacy alias of systems. */
  columns: SystemSlice[];
}

export interface SystemDimensions {
  widthPt: number; // horizontal span of one system (4 measures)
  heightPt: number; // staff height (4 octaves)
  staffHeightPt: number;
  slotHeightPt: number; // full vertical slot allotted to a system (incl. measure-number strip)
  measureWidthPt: number;
  contentHeightPt: number;
}

/** @deprecated Legacy alias of SystemDimensions. */
export type ColumnDimensions = SystemDimensions;

export interface ColumnarScoreLayout {
  score: QuantizedGridScore;
  options: ResolvedPrintLayoutOptions;
  totalMeasures: number;
  ticksPerMeasure: number;
  ticksPerBeat: number;
  measuresPerSystem: number;
  systemsPerPage: number;
  systems: SystemSlice[];
  /** @deprecated Legacy alias of systems. */
  columns: SystemSlice[];
  pages: PageLayout[];
  pageDimensions: {
    widthPt: number;
    heightPt: number;
    widthMm: number;
    heightMm: number;
  };
  systemDimensions: SystemDimensions;
  /** @deprecated Legacy alias of systemDimensions. */
  columnDimensions: SystemDimensions;
  minPitch: number;
  maxPitch: number;
  pitchSpan: number;
  ptPerSemitone: number;
  ptPerTick: number;
}

const DEFAULT_OPTIONS: ResolvedPrintLayoutOptions = {
  paperSize: 'A4',
  orientation: 'landscape',
  measuresPerSystem: MEASURES_PER_SYSTEM_DEFAULT,
  measuresPerColumn: MEASURES_PER_SYSTEM_DEFAULT,
  systemsPerPage: SYSTEMS_PER_PAGE_DEFAULT,
  columnsPerPage: SYSTEMS_PER_PAGE_DEFAULT,
  pageMarginMm: 6,
  columnGapMm: 8,
  staffStyle: 'tritone-split',
  noteheadMorphology: 'duodecimal',
  holdRibbonWidthPt: 4,
  minPitch: 0,
  maxPitch: 127,
  pixelsPerTick: 0,
  pixelsPerSemitone: 0,
  octaveExtensionMode: 'spillover',
  showBeatGrid: true,
  showGutterBrackets: false,
};

export function resolveLayoutOptions(
  userOptions?: Partial<PrintLayoutOptions>
): ResolvedPrintLayoutOptions {
  const measuresPerSystem =
    userOptions?.measuresPerSystem ?? userOptions?.measuresPerColumn ?? DEFAULT_OPTIONS.measuresPerSystem;
  const systemsPerPage =
    userOptions?.systemsPerPage ?? userOptions?.columnsPerPage ?? DEFAULT_OPTIONS.systemsPerPage;

  return {
    ...DEFAULT_OPTIONS,
    ...userOptions,
    measuresPerSystem: Math.max(1, measuresPerSystem),
    measuresPerColumn: Math.max(1, measuresPerSystem),
    systemsPerPage: Math.max(1, systemsPerPage),
    columnsPerPage: Math.max(1, systemsPerPage),
  };
}

/**
 * Computes pagination and geometry for the horizontal system layout:
 * measures flow left → right within a system, systems stack top → bottom on landscape pages.
 *
 * Default invariant for a 32-measure movement: 4 measures/system × 3 systems/page = 12
 * measures/page → exactly 3 pages.
 */
export function computeColumnarLayout(
  score: QuantizedGridScore,
  userOptions?: Partial<PrintLayoutOptions>
): ColumnarScoreLayout {
  const options = resolveLayoutOptions(userOptions);

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

  // Pitch range bounding: Anchored around the middle of the keyboard to 4 octaves:
  // o1 (24, C2) to o5 (72, C6), with Middle C (o3, 48) dead-center.
  let minPitch = options.minPitch > 0 ? options.minPitch : STAFF_MIN_PITCH;
  let maxPitch = options.maxPitch < 127 ? options.maxPitch : STAFF_MAX_PITCH;

  if (minPitch >= maxPitch) {
    minPitch = STAFF_MIN_PITCH;
    maxPitch = STAFF_MAX_PITCH;
  }

  // Ensure whole-tone alignment for clean staff presentation
  minPitch = Math.floor(minPitch / 2) * 2;
  maxPitch = Math.ceil(maxPitch / 2) * 2;
  const pitchSpan = Math.max(12, maxPitch - minPitch);

  // Physical page dimensions
  const isA3 = options.paperSize === 'A3';
  const isLetter = options.paperSize === 'letter';
  const isLandscape = options.orientation === 'landscape';
  let baseWidthPt = isA3 ? A4_HEIGHT_PT * Math.SQRT2 : isLetter ? LETTER_WIDTH_PT : A4_WIDTH_PT;
  let baseHeightPt = isA3 ? A4_WIDTH_PT * 2 : isLetter ? LETTER_HEIGHT_PT : A4_HEIGHT_PT;
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
  const printableWidthPt = widthPt - 2 * marginPt;
  const printableHeightPt = heightPt - 2 * marginPt;

  // Header (title block) and footer reservations are identical on every page so that
  // systems remain geometrically uniform across the whole print run.
  const bodyHeightPt = printableHeightPt - HEADER_HEIGHT_PT - FOOTER_HEIGHT_PT;
  const systemsPerPage = options.systemsPerPage;
  const slotHeightPt = bodyHeightPt / systemsPerPage;

  // Horizontal system geometry: accolade on the left margin, four measures across the staff
  const staffLeftPt = marginPt + ACCOLADE_WIDTH_PT + ACCOLADE_GAP_PT;
  const staffRightPt = widthPt - marginPt;
  const staffWidthPt = Math.max(80, staffRightPt - staffLeftPt);
  const measuresPerSystem = options.measuresPerSystem;
  const measureWidthPt = staffWidthPt / measuresPerSystem;

  // Vertical scale: definitive 2.60pt per semitone (124.8pt staff). If a paper format
  // cannot fit the staff inside its system slot, scale down gracefully.
  let ptPerSemitone = options.pixelsPerSemitone > 0
    ? options.pixelsPerSemitone
    : DEFAULT_PT_PER_SEMITONE;
  const maxFittingPtPerSemitone = (slotHeightPt - SYSTEM_LABEL_HEIGHT_PT) / pitchSpan;
  if (maxFittingPtPerSemitone > 0 && ptPerSemitone > maxFittingPtPerSemitone) {
    ptPerSemitone = maxFittingPtPerSemitone;
  }
  const staffHeightPt = pitchSpan * ptPerSemitone;

  const ptPerTick = options.pixelsPerTick > 0
    ? options.pixelsPerTick
    : measureWidthPt / ticksPerMeasure;

  // Slice the score into horizontal systems
  const numSystems = Math.ceil(totalMeasures / measuresPerSystem);

  const allHandCrossings = score.handCrossings && score.handCrossings.length > 0
    ? score.handCrossings
    : detectHandCrossings(score);

  const systems: SystemSlice[] = [];
  for (let s = 0; s < numSystems; s++) {
    const startMeasure = s * measuresPerSystem + 1;
    const endMeasure = Math.min(totalMeasures, (s + 1) * measuresPerSystem);
    const startTick = (startMeasure - 1) * ticksPerMeasure;
    const endTick = endMeasure * ticksPerMeasure;

    const pageIndex = Math.floor(s / systemsPerPage);
    const systemOnPageIndex = s % systemsPerPage;

    const notesInSystem = score.notes.filter(
      n => n.startTick >= startTick && n.startTick < endTick
    );

    const hcInSystem = allHandCrossings.filter(
      hc => (hc.tick + hc.durationTicks) > startTick && hc.tick < endTick
    );

    systems.push({
      systemIndex: s,
      pageIndex,
      systemOnPageIndex,
      startMeasure,
      endMeasure,
      sysStartMeasure: startMeasure,
      startTick,
      endTick,
      notes: notesInSystem,
      handCrossings: hcInSystem,
    });
  }

  // Group systems into pages
  const totalPages = Math.max(1, Math.ceil(numSystems / systemsPerPage));
  const pages: PageLayout[] = [];

  for (let p = 0; p < totalPages; p++) {
    const pageSystems = systems.filter(s => s.pageIndex === p);
    const firstSystem = pageSystems[0];
    const lastSystem = pageSystems[pageSystems.length - 1];
    const sMeasure = firstSystem ? firstSystem.startMeasure : 1;
    const eMeasure = lastSystem ? lastSystem.endMeasure : totalMeasures;

    const sectionLetter = totalPages === 2
      ? (p === 0 ? 'A' : 'B')
      : String.fromCharCode(65 + (p % 26));
    const sectionName = `Section ${sectionLetter} (mm. ${sMeasure}–${eMeasure})`;

    pages.push({
      pageIndex: p,
      pageNumber: p + 1,
      totalPages,
      sectionName,
      systems: pageSystems,
      columns: pageSystems,
    });
  }

  const systemDimensions: SystemDimensions = {
    widthPt: staffWidthPt,
    heightPt: staffHeightPt,
    staffHeightPt,
    slotHeightPt,
    measureWidthPt,
    contentHeightPt: staffHeightPt,
  };

  return {
    score,
    options,
    totalMeasures,
    ticksPerMeasure,
    ticksPerBeat,
    measuresPerSystem,
    systemsPerPage,
    systems,
    columns: systems,
    pages,
    pageDimensions: {
      widthPt,
      heightPt,
      widthMm,
      heightMm,
    },
    systemDimensions,
    columnDimensions: systemDimensions,
    minPitch,
    maxPitch,
    pitchSpan,
    ptPerSemitone,
    ptPerTick,
  };
}

export interface SystemGeometry {
  systemIndex: number;
  systemOnPageIndex: number;
  staffLeftPt: number;
  staffRightPt: number;
  staffWidthPt: number;
  staffTopY: number;
  staffBotY: number;
  staffHeightPt: number;
  slotHeightPt: number;
  measureWidthPt: number;
  ptPerTick: number;
  ptPerSemitone: number;
  minPitch: number;
  /** Vertical coordinate of a linear pitch: o1 at the bottom, o5 at the top. */
  yForPitch: (pitch: number) => number;
  /** Horizontal coordinate of a tick, honouring the per-measure onset inset. */
  xForTick: (tick: number) => number;
  /** Horizontal coordinate of a measure's opening barline. */
  xForMeasureStart: (measureIndexOnSystem: number) => number;
}

/**
 * Exact engraving geometry of one system on one page. Shared by the renderer and
 * by consumers/tests that need to reason about note coordinates.
 */
export function getSystemGeometry(
  layout: ColumnarScoreLayout,
  pageIndex: number,
  systemOnPageIndex: number
): SystemGeometry {
  const page = layout.pages[pageIndex] ?? layout.pages[0];
  const system = page.systems[systemOnPageIndex] ?? page.systems[0];
  const { options, minPitch, ptPerSemitone, ptPerTick, ticksPerMeasure } = layout;

  const marginPt = options.pageMarginMm * MM_TO_PT;
  const slotHeightPt = layout.systemDimensions.slotHeightPt;
  const staffHeightPt = layout.systemDimensions.staffHeightPt;
  const staffLeftPt = marginPt + ACCOLADE_WIDTH_PT + ACCOLADE_GAP_PT;
  const staffRightPt = layout.pageDimensions.widthPt - marginPt;
  const staffWidthPt = Math.max(80, staffRightPt - staffLeftPt);
  const measureWidthPt = staffWidthPt / layout.measuresPerSystem;

  const systemTopY = marginPt + HEADER_HEIGHT_PT + systemOnPageIndex * slotHeightPt;
  const staffTopY =
    systemTopY + SYSTEM_LABEL_HEIGHT_PT + Math.max(0, (slotHeightPt - SYSTEM_LABEL_HEIGHT_PT - staffHeightPt) / 2);
  const staffBotY = staffTopY + staffHeightPt;

  const spanTicks = (system.endMeasure - system.startMeasure + 1) * ticksPerMeasure;

  const yForPitch = (pitch: number): number =>
    staffBotY - (pitch - minPitch) * ptPerSemitone;

  const subdivisionTicks = (layout.score?.gridResolution && layout.score.gridResolution > 0)
    ? layout.score.gridResolution
    : (layout.ticksPerBeat > 0 ? layout.ticksPerBeat / 4 : 12);
  const measureInsetPt = (subdivisionTicks / 2) * ptPerTick;

  const xForMeasureStart = (measureIndexOnSystem: number): number =>
    staffLeftPt + measureIndexOnSystem * measureWidthPt;

  const xForTick = (tick: number): number => {
    const rel = tick - system.startTick;
    if (rel <= 0) return staffLeftPt + measureInsetPt;
    if (rel >= spanTicks) return staffRightPt;
    const measureIdx = Math.floor(rel / ticksPerMeasure);
    const localTicks = rel - measureIdx * ticksPerMeasure;
    return xForMeasureStart(measureIdx) + measureInsetPt + localTicks * ptPerTick;
  };

  return {
    systemIndex: system.systemIndex,
    systemOnPageIndex,
    staffLeftPt,
    staffRightPt,
    staffWidthPt,
    staffTopY,
    staffBotY,
    staffHeightPt,
    slotHeightPt,
    measureWidthPt,
    ptPerTick,
    ptPerSemitone,
    minPitch,
    yForPitch,
    xForTick,
    xForMeasureStart,
  };
}

interface HorizontalStaffLine {
  stroke: string;
  width: number;
  dashArray?: string;
  isSpine: boolean;
}

/**
 * Horizontal staff topography for a linear pitch:
 * - Middle C (p = 48): bold center spine (1.05pt, #000000)
 * - Octaves (p = 24, 36, 60, 72): solid lines (0.65pt, #000000)
 * - Landmark 4 (p = 28, 40, 52, 64): small dashed lines (0.6pt, #444444, [5, 2.5])
 */
function getHorizontalStaffLine(p: number, normStyle: StaffStyle): HorizontalStaffLine | null {
  const pc = pc12(p);

  if (normStyle === 'tritone-split') {
    if (pc === 0) {
      if (p === 48) return { stroke: '#000000', width: 1.05, isSpine: true };
      if (p <= 24 || p >= 72) return { stroke: '#000000', width: 0.70, isSpine: false };
      return { stroke: '#000000', width: 0.60, isSpine: false };
    }
    if (pc === 4) {
      return { stroke: '#444444', width: 0.6, dashArray: '5,2.5', isSpine: false };
    }
    return null;
  }

  const geom = getStaffLineGeometry(pc, normStyle);
  if (!geom.isLine) return null;
  if (geom.isDashed && geom.dashArray && geom.dashArray.length > 0) {
    return { stroke: '#444444', width: 0.6, dashArray: geom.dashArray.join(','), isSpine: false };
  }
  if (p === 48) return { stroke: '#000000', width: 1.05, isSpine: true };
  if (pc === 0) {
    if (p <= 24 || p >= 72) return { stroke: '#000000', width: 0.70, isSpine: false };
    return { stroke: '#000000', width: 0.60, isSpine: false };
  }
  return { stroke: '#555555', width: 0.6, isSpine: false };
}

/** Nearest engraving landmark line above `p` (search window limited to a tritone). */
function nextLandmarkAbove(p: number, normStyle: StaffStyle): number | null {
  for (let q = p + 1; q <= p + 6; q++) {
    if (getHorizontalStaffLine(q, normStyle)) return q;
  }
  return null;
}

/** Nearest engraving landmark line below `p` (search window limited to a tritone). */
function nextLandmarkBelow(p: number, normStyle: StaffStyle): number | null {
  for (let q = p - 1; q >= p - 6; q--) {
    if (getHorizontalStaffLine(q, normStyle)) return q;
  }
  return null;
}

/**
 * Generates clean, standalone vector SVG for one landscape page of the horizontal score:
 * 3 systems per page, each clasped by a slender copperplate vertical accolade with time
 * flowing left → right.
 */
export function renderPageToSvg(
  layout: ColumnarScoreLayout,
  pageIndex: number
): string {
  const page = layout.pages[pageIndex] || layout.pages[0];
  if (!page) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${layout.pageDimensions.widthPt} ${layout.pageDimensions.heightPt}"><rect width="100%" height="100%" fill="#FFFFFF"/></svg>`;
  }

  const { score, options, minPitch, maxPitch, ticksPerMeasure, ticksPerBeat } = layout;
  const { widthPt, heightPt } = layout.pageDimensions;
  const marginPt = options.pageMarginMm * MM_TO_PT;

  const normStaffStyle = normalizeStaffStyle(options.staffStyle);
  const morph = normalizeNoteheadMorphology(options.noteheadMorphology);
  const tauRef = score.gridResolution || 12;

  let beatsPerMeasure = 4;
  if (score.timeSignatures && score.timeSignatures.length > 0) {
    beatsPerMeasure = score.timeSignatures[0].numerator;
  }
  if (beatsPerMeasure < 1) beatsPerMeasure = 4;

  const svgParts: string[] = [];

  // 1. Root SVG with pure white paper background
  svgParts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${widthPt.toFixed(2)} ${heightPt.toFixed(2)}" width="${widthPt.toFixed(2)}pt" height="${heightPt.toFixed(2)}pt" style="display: block; width: 100%; height: auto;">`
  );
  svgParts.push(`  <defs>`);
  svgParts.push(`    <style>`);
  svgParts.push(`      .title { font-family: ${URTEXT_SERIF}; font-weight: 600; font-size: 11.5pt; letter-spacing: 0.8px; fill: #111111; }
      .subtitle { font-family: ${URTEXT_SERIF}; font-style: italic; font-size: 8.5pt; letter-spacing: 0.2px; fill: #333333; }
      .meta { font-family: ${URTEXT_SERIF}; font-style: italic; font-size: 8.5pt; letter-spacing: 0.2px; fill: #222222; }
      .section-header { font-family: ${URTEXT_SERIF}; font-style: italic; font-size: 8.5pt; fill: #222222; }
      .measure-num { font-family: ${URTEXT_SERIF}; font-style: italic; font-size: 8pt; fill: #444444; }
      .duo-digit { font-family: "URW Gothic", "Century Gothic", "ITC Avant Garde Gothic", "Avant Garde", sans-serif; text-anchor: middle; dominant-baseline: central; font-weight: bold; }`);
  svgParts.push(`    </style>`);
  svgParts.push(`  </defs>`);

  svgParts.push(`  <!-- Paper Background -->`);
  svgParts.push(`  <rect width="100%" height="100%" fill="#FFFFFF"/>`);

  // 2. Page header: majestic classical Urtext title block on page 1, running header on later pages
  const titleParts = (score.title || 'Isomorphic Score').split(':');
  const titleMain = titleParts[0].trim();
  const titleSub = titleParts.slice(1).join(':').trim();

  svgParts.push(`  <!-- Page Header -->`);
  svgParts.push(`  <g id="page-header">`);
  if (page.pageIndex === 0) {
    const centerTitle = titleSub ? titleSub.replace(/\.\s+a\b/, ' · a') : titleMain;
    const leftTitle = titleSub ? titleMain : (score.opus || '');
    if (leftTitle) {
      svgParts.push(`    <text x="${marginPt.toFixed(2)}" y="${(marginPt + 11).toFixed(2)}" class="subtitle">${escapeXml(leftTitle)}</text>`);
    }
    svgParts.push(`    <text x="${(widthPt / 2).toFixed(2)}" y="${(marginPt + 11).toFixed(2)}" class="title" text-anchor="middle">${escapeXml(centerTitle)}</text>`);
    if (score.composer) {
      svgParts.push(`    <text x="${(widthPt - marginPt).toFixed(2)}" y="${(marginPt + 11).toFixed(2)}" class="meta" text-anchor="end">${escapeXml(score.composer)}</text>`);
    }
  } else {
    svgParts.push(`    <text x="${marginPt.toFixed(2)}" y="${(marginPt + 11).toFixed(2)}" class="subtitle">${escapeXml(titleMain)}</text>`);
    if (titleSub) {
      const runningSub = titleSub.replace(/\.\s+a\b/, ' · a');
      svgParts.push(`    <text x="${(widthPt / 2).toFixed(2)}" y="${(marginPt + 11).toFixed(2)}" class="title" font-size="9pt" text-anchor="middle">${escapeXml(runningSub)}</text>`);
    }
    svgParts.push(`    <text x="${(widthPt - marginPt).toFixed(2)}" y="${(marginPt + 11).toFixed(2)}" class="section-header" text-anchor="end">${escapeXml(page.sectionName)}</text>`);
  }
  svgParts.push(`  </g>`);

  // 3. Render each horizontal system
  for (let s = 0; s < page.systems.length; s++) {
    const system = page.systems[s];
    const geo = getSystemGeometry(layout, page.pageIndex, s);
    const staffLeft = geo.staffLeftPt;
    const staffRight = geo.staffRightPt;
    const staffTop = geo.staffTopY;
    const staffBot = geo.staffBotY;
    const numMeasures = system.endMeasure - system.startMeasure + 1;
    const systemNotes = system.notes;

    svgParts.push(`  <!-- System ${system.systemIndex + 1} (mm. ${system.startMeasure}–${system.endMeasure}) -->`);
    svgParts.push(`  <g id="system-${system.systemIndex + 1}">`);

    // 3a. System Start:
    // System 1 (start of the piece) receives the classical calligraphic vertical accolade (curly brace).
    // Subsequent systems use a regular open start without an accolade.
    // Zero starting vertical line: staff lines emerge openly and freely from staffLeft across the system.
    if (system.systemIndex === 0) {
      // Dedicated measure number in the left margin clear of the accolade
      svgParts.push(`    <!-- Urtext Measure Number in Dedicated Left Margin -->`);
      svgParts.push(`    <text x="${marginPt.toFixed(2)}" y="${(staffTop - 8).toFixed(2)}" class="measure-num">${system.startMeasure}</text>`);

      // Authentic Classical Accolade Curly Brace clasping o5 to o1
      svgParts.push(`    <!-- Classical Vertical Accolade (Curly Brace) clasping o1 to o5 -->`);
      svgParts.push(`    <path class="accolade" d="${getVerticalAccoladePath(staffLeft - ACCOLADE_OFFSET_LEFT_PT, staffTop, staffBot, ACCOLADE_WIDTH_PT, ACCOLADE_THICKNESS_PT)}" fill="#111827"/>`);
    } else {
      // Regular start for subsequent systems
      svgParts.push(`    <!-- Urtext Measure Number in Dedicated Left Margin -->`);
      svgParts.push(`    <text x="${(staffLeft - 10).toFixed(2)}" y="${(staffTop - 8).toFixed(2)}" text-anchor="end" class="measure-num">${system.startMeasure}</text>`);
    }

    // 3b. Horizontal staff topography
    for (let p = minPitch; p <= maxPitch; p++) {
      const line = getHorizontalStaffLine(p, normStaffStyle);
      if (!line) continue;
      const y = geo.yForPitch(p).toFixed(2);
      const dash = line.dashArray ? ` stroke-dasharray="${line.dashArray}"` : '';
      svgParts.push(`    <line x1="${staffLeft.toFixed(2)}" y1="${y}" x2="${staffRight.toFixed(2)}" y2="${y}" stroke="${line.stroke}" stroke-width="${line.width}"${dash}/>`);
    }

    // 3c. Local dashed outlier lines for notes escaping the 4-octave core
    for (let m = 0; m < numMeasures; m++) {
      const mStartTick = (system.startMeasure - 1 + m) * ticksPerMeasure;
      const mEndTick = mStartTick + ticksPerMeasure;
      const mStartX = geo.xForMeasureStart(m);
      const mEndX = mStartX + geo.measureWidthPt;
      const measureNotes = systemNotes.filter(
        n => n.startTick >= mStartTick && n.startTick < mEndTick
      );

      const highOutliers = measureNotes.filter(n => linearIndex(n.pitch) > maxPitch);
      if (highOutliers.length > 0) {
        const topOutlier = Math.max(...highOutliers.map(n => linearIndex(n.pitch)));
        const linePitch = nextLandmarkAbove(maxPitch, normStaffStyle);
        if (linePitch !== null && topOutlier > maxPitch) {
          const y = geo.yForPitch(linePitch).toFixed(2);
          svgParts.push(`    <line x1="${mStartX.toFixed(2)}" y1="${y}" x2="${mEndX.toFixed(2)}" y2="${y}" stroke="#444444" stroke-width="0.6" stroke-dasharray="5,2.5"/>`);
        }
      }

      const lowOutliers = measureNotes.filter(n => linearIndex(n.pitch) < minPitch);
      if (lowOutliers.length > 0) {
        const linePitch = nextLandmarkBelow(minPitch, normStaffStyle);
        if (linePitch !== null) {
          const y = geo.yForPitch(linePitch).toFixed(2);
          svgParts.push(`    <line x1="${mStartX.toFixed(2)}" y1="${y}" x2="${mEndX.toFixed(2)}" y2="${y}" stroke="#444444" stroke-width="0.6" stroke-dasharray="5,2.5"/>`);
        }
      }
    }

    // 3e. Measure numbers, vertical barlines and the vertical beat-grid pulse lines
    for (let m = 0; m < numMeasures; m++) {
      const mNum = system.startMeasure + m;
      const mStartX = geo.xForMeasureStart(m);
      const mEndX = mStartX + geo.measureWidthPt;
      const mStartTick = (mNum - 1) * ticksPerMeasure;

      // Note: Measure number is rendered in dedicated left margin in 3a above.

      // Vertical dashed pulse lines for beats 2, 3, … (Klavarskribo beat grid)
      if (options.showBeatGrid) {
        for (let b = 1; b < beatsPerMeasure; b++) {
          const beatTick = mStartTick + b * ticksPerBeat;
          if (beatTick >= system.endTick) continue;
          const beatX = geo.xForTick(beatTick);
          svgParts.push(`    <!-- Klavarskribo Beat Grid (Beat ${b + 1}) -->`);
          svgParts.push(`    <line x1="${beatX.toFixed(2)}" y1="${staffTop.toFixed(2)}" x2="${beatX.toFixed(2)}" y2="${staffBot.toFixed(2)}" stroke="#D1D5DB" stroke-width="0.5" stroke-dasharray="2,3"/>`);
        }
      }

      // Vertical barline at the measure boundary
      const endTick = mNum * ticksPerMeasure;
      const barSpec = (score.barlines || []).find(b => b.tick === endTick);
      const isFinal = barSpec?.type === 'final' || mNum >= layout.totalMeasures;
      const isDouble = barSpec?.type === 'double';
      const isSystemEnd = (m === numMeasures - 1);

      if (isSystemEnd && !isFinal) {
        // System ends are dropped; staff lines float openly into the right margin
      } else if (isDouble || isFinal) {
        const innerX = mEndX - 3.2;
        svgParts.push(`    <line x1="${innerX.toFixed(2)}" y1="${staffTop.toFixed(2)}" x2="${innerX.toFixed(2)}" y2="${staffBot.toFixed(2)}" stroke="#333333" stroke-width="0.45"/>`);
        svgParts.push(`    <line x1="${mEndX.toFixed(2)}" y1="${staffTop.toFixed(2)}" x2="${mEndX.toFixed(2)}" y2="${staffBot.toFixed(2)}" stroke="#111827" stroke-width="${isFinal ? '1.8' : '1.0'}"/>`);
      } else {
        svgParts.push(`    <line x1="${mEndX.toFixed(2)}" y1="${staffTop.toFixed(2)}" x2="${mEndX.toFixed(2)}" y2="${staffBot.toFixed(2)}" stroke="#333333" stroke-width="0.45"/>`);
      }
    }

    // 3f. Optional gutter beat brackets: RH above the staff, LH below the staff
    if (options.showGutterBrackets) {
      const handOf = (n: QuantizedNote): 'RH' | 'LH' =>
        n.hand ?? (linearIndex(n.pitch) >= 48 ? 'RH' : 'LH');

      for (let m = 0; m < numMeasures; m++) {
        const mNum = system.startMeasure + m;
        const mStartTick = (mNum - 1) * ticksPerMeasure;
        for (let b = 0; b < beatsPerMeasure; b++) {
          const beatStartTick = mStartTick + b * ticksPerBeat;
          const beatEndTick = beatStartTick + ticksPerBeat;
          if (beatStartTick >= system.endTick) continue;
          const beatNotes = systemNotes.filter(
            n => n.startTick >= beatStartTick && n.startTick < beatEndTick
          );
          if (beatNotes.length === 0) continue;

          const x1 = geo.xForTick(beatStartTick) + 1.5;
          const x2 = Math.max(x1 + 2, geo.xForTick(Math.min(beatEndTick, system.endTick)) - 1.5);
          const hasRH = beatNotes.some(n => handOf(n) === 'RH');
          const hasLH = beatNotes.some(n => handOf(n) === 'LH');

          if (hasLH) {
            const railY = staffBot + 10;
            svgParts.push(`    <!-- LH Gutter Bracket (Beat ${b + 1}) -->`);
            svgParts.push(`    <path d="M ${x1.toFixed(2)} ${(railY - 3.5).toFixed(2)} L ${x1.toFixed(2)} ${railY.toFixed(2)} L ${x2.toFixed(2)} ${railY.toFixed(2)} L ${x2.toFixed(2)} ${(railY - 3.5).toFixed(2)}" fill="none" stroke="#6B7280" stroke-width="0.8" stroke-linecap="round"/>`);
            svgParts.push(`    <text x="${x1.toFixed(2)}" y="${(railY + 8).toFixed(2)}" text-anchor="start" font-family="monospace" font-size="7" font-weight="bold" fill="#6B7280">${b + 1}</text>`);
          }
          if (hasRH) {
            const railY = staffTop - 24;
            svgParts.push(`    <!-- RH Gutter Bracket (Beat ${b + 1}) -->`);
            svgParts.push(`    <path d="M ${x1.toFixed(2)} ${(railY + 3.5).toFixed(2)} L ${x1.toFixed(2)} ${railY.toFixed(2)} L ${x2.toFixed(2)} ${railY.toFixed(2)} L ${x2.toFixed(2)} ${(railY + 3.5).toFixed(2)}" fill="none" stroke="#6B7280" stroke-width="0.8" stroke-linecap="round"/>`);
            svgParts.push(`    <text x="${x1.toFixed(2)}" y="${(railY - 3).toFixed(2)}" text-anchor="start" font-family="monospace" font-size="7" font-weight="bold" fill="#6B7280">${b + 1}</text>`);
          }
        }
      }
    }

    // 3g. Pre-calculate cluster offsets for harmonic intervals at the same onset
    // (e.g. seconds and thirds) so white circular knockouts never erase neighboring digits.
    const notesByTickInSys = new Map<number, QuantizedNote[]>();
    for (const note of systemNotes) {
      if (!notesByTickInSys.has(note.startTick)) notesByTickInSys.set(note.startTick, []);
      notesByTickInSys.get(note.startTick)!.push(note);
    }
    const clusterOffsetMap = new Map<string, number>();
    for (const [, tickNotes] of notesByTickInSys.entries()) {
      if (tickNotes.length <= 1) continue;
      tickNotes.sort((a, b) => linearIndex(a.pitch) - linearIndex(b.pitch));
      for (let i = 0; i < tickNotes.length - 1; i++) {
        const p1 = linearIndex(tickNotes[i].pitch);
        const p2 = linearIndex(tickNotes[i + 1].pitch);
        if (p2 - p1 <= 3) {
          clusterOffsetMap.set(tickNotes[i].id, -4.2);
          clusterOffsetMap.set(tickNotes[i + 1].id, 4.2);
        }
      }
    }

    // 3g. Horizontal duration hold lines (pass 1, beneath the noteheads).
    for (const note of systemNotes) {
      if (note.durationTicks <= tauRef) continue; // regular notes stay pure noteheads
      const lp = linearIndex(note.pitch);
      const cDx = clusterOffsetMap.get(note.id) ?? 0;
      const nx = geo.xForTick(note.startTick) + cDx;
      const ny = geo.yForPitch(lp);
      const noteColor = getPrintDurationColor(note.durationTicks, tauRef);
      const effectiveRadius = note.startTick === 0 ? OPENING_HALO_RADIUS_PT : NOTEHEAD_KNOCKOUT_RADIUS_PT;
      let holdStartX = nx + effectiveRadius;
      let holdEndX = Math.min(nx + note.durationTicks * geo.ptPerTick, staffRight);

      // Clip the tail before the next onset on the same pitch within this system
      let nextOnsetTick: number | null = null;
      for (const other of systemNotes) {
        if (linearIndex(other.pitch) !== lp || other.startTick <= note.startTick) continue;
        if (nextOnsetTick === null || other.startTick < nextOnsetTick) nextOnsetTick = other.startTick;
      }
      if (nextOnsetTick !== null) {
        const otherDx = clusterOffsetMap.get(systemNotes.find(o => linearIndex(o.pitch) === lp && o.startTick === nextOnsetTick)?.id ?? '') ?? 0;
        const nextNx = geo.xForTick(nextOnsetTick) + otherDx;
        holdEndX = Math.min(holdEndX, nextNx - NOTEHEAD_KNOCKOUT_RADIUS_PT - 1.0);
      }

      if (pc12(lp) === 0) {
        if (holdEndX - holdStartX < 1.5) continue;
        const strokeW = lp === 48 ? '1.05' : (lp <= 24 || lp >= 72 ? '0.7' : '0.6');
        svgParts.push(`    <line x1="${holdStartX.toFixed(2)}" y1="${ny.toFixed(2)}" x2="${holdEndX.toFixed(2)}" y2="${ny.toFixed(2)}" stroke="${noteColor}" stroke-width="${strokeW}" stroke-linecap="butt"/>`);
      } else {
        holdStartX = nx + effectiveRadius + 0.4;
        if (holdEndX - holdStartX < 1.5) continue;
        svgParts.push(`    <line x1="${holdStartX.toFixed(2)}" y1="${ny.toFixed(2)}" x2="${holdEndX.toFixed(2)}" y2="${ny.toFixed(2)}" stroke="${noteColor}" stroke-width="0.80" stroke-linecap="round"/>`);
      }
    }

    // 3h. Noteheads (pass 2): first render all circular knockouts, then all glyphs
    const handOf = (n: QuantizedNote, lp: number): 'RH' | 'LH' =>
      n.hand ?? (lp >= 48 ? 'RH' : 'LH');
    const isHandException = (n: QuantizedNote, lp: number): boolean => {
      const hand = handOf(n, lp);
      return (hand === 'RH' && lp < 48) || (hand === 'LH' && lp > 48);
    };

    const exceptionKeys = new Set<string>();
    for (const note of systemNotes) {
      const lp = linearIndex(note.pitch);
      if (isHandException(note, lp)) {
        exceptionKeys.add(`${lp}-${note.startTick}`);
      }
    }

    const renderedNoteheadKeys = new Set<string>();
    for (const note of systemNotes) {
      const lp = linearIndex(note.pitch);
      const cDx = clusterOffsetMap.get(note.id) ?? 0;
      const nx = geo.xForTick(note.startTick) + cDx;
      const ny = geo.yForPitch(lp);
      const noteColor = getPrintDurationColor(note.durationTicks, tauRef);
      const hand = handOf(note, lp);
      const isException = isHandException(note, lp);
      const unisonKey = `${lp}-${note.startTick}`;

      if (!isException && exceptionKeys.has(unisonKey)) continue;
      if (renderedNoteheadKeys.has(unisonKey)) continue;
      renderedNoteheadKeys.add(unisonKey);

      const r = NOTEHEAD_KNOCKOUT_RADIUS_PT;
      const isEven = wholeToneParity(lp) === 0;

      if (morph === 'duodecimal') {
        const digit = DUODECIMAL_DIGITS[pc12(lp)];

        if (note.startTick === 0) {
          svgParts.push(`    <circle cx="${nx.toFixed(2)}" cy="${ny.toFixed(2)}" r="${OPENING_HALO_RADIUS_PT.toFixed(2)}" fill="none" stroke="${OPENING_HALO_STROKE}" stroke-width="0.85"/>`);
        }

        svgParts.push(`    <circle cx="${nx.toFixed(2)}" cy="${ny.toFixed(2)}" r="${r.toFixed(2)}" fill="#FFFFFF"/>`);
        const weight = isEven ? '800' : '700';
        svgParts.push(`    <text x="${nx.toFixed(2)}" y="${(ny + 0.65).toFixed(2)}" class="duo-digit" font-weight="${weight}" font-size="5.4pt" fill="${noteColor}">${digit}</text>`);
      } else if (morph === 'phonetic') {
        const syllable = getCanonicalSyllable(pc12(lp));
        const pw = 15.0;
        const ph = 8.5;
        svgParts.push(`    <rect x="${(nx - (pw + 2) / 2).toFixed(2)}" y="${(ny - (ph + 2) / 2).toFixed(2)}" width="${(pw + 2).toFixed(2)}" height="${(ph + 2).toFixed(2)}" rx="2.5" fill="#FFFFFF"/>`);
        svgParts.push(`    <rect x="${(nx - pw / 2).toFixed(2)}" y="${(ny - ph / 2).toFixed(2)}" width="${pw.toFixed(2)}" height="${ph.toFixed(2)}" rx="2" fill="${noteColor}"/>`);
        svgParts.push(`    <text x="${nx.toFixed(2)}" y="${(ny + 2.5).toFixed(2)}" font-family="monospace" font-weight="bold" font-size="5.5pt" fill="#FFFFFF" text-anchor="middle">${syllable}</text>`);
      } else if (
        morph === 'rectangle-square' ||
        morph === 'square-ellipse' ||
        morph === 'square-triangle'
      ) {
        const nw = 7.5;
        const nh = 5.6;
        const bx = nx - nw / 2;
        const by = ny - nh / 2;
        svgParts.push(`    <rect x="${bx.toFixed(2)}" y="${(by - 0.5).toFixed(2)}" width="${nw.toFixed(2)}" height="${(nh + 1.0).toFixed(2)}" rx="1.5" fill="#FFFFFF"/>`);
        if (isEven) {
          svgParts.push(`    <rect x="${bx.toFixed(2)}" y="${by.toFixed(2)}" width="${nw.toFixed(2)}" height="${nh.toFixed(2)}" rx="1.5" fill="${noteColor}"/>`);
        } else {
          const sw = 1.3;
          const halfSw = sw / 2;
          svgParts.push(`    <rect x="${(bx + halfSw).toFixed(2)}" y="${(by + halfSw).toFixed(2)}" width="${(nw - sw).toFixed(2)}" height="${(nh - sw).toFixed(2)}" rx="${Math.max(0.5, 1.5 - halfSw).toFixed(2)}" fill="#FFFFFF" stroke="${noteColor}" stroke-width="${sw}"/>`);
        }
      } else {
        if (isEven) {
          svgParts.push(`    <ellipse cx="${nx.toFixed(2)}" cy="${ny.toFixed(2)}" rx="5.20" ry="3.00" fill="${noteColor}"/>`);
        } else {
          const bw = 8.6;
          const bh = 5.8;
          svgParts.push(`    <rect x="${(nx - bw / 2).toFixed(2)}" y="${(ny - bh / 2).toFixed(2)}" width="${bw.toFixed(2)}" height="${bh.toFixed(2)}" rx="1.2" fill="${noteColor}"/>`);
        }
      }

      if (isException) {
        const chW = 4.2;
        const chH = 2.8;
        const clearance = 2.2;
        const leftX = nx - chW / 2;
        const rightX = nx + chW / 2;
        if (hand === 'RH') {
          const cy = ny - (r + clearance);
          const baseY = cy + chH / 2;
          const apexY = cy - chH / 2;
          svgParts.push(`    <path class="hand-chevron-shield" d="M ${leftX.toFixed(2)} ${baseY.toFixed(2)} L ${nx.toFixed(2)} ${apexY.toFixed(2)} L ${rightX.toFixed(2)} ${baseY.toFixed(2)} Z" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="1.80" stroke-linecap="round" stroke-linejoin="round"/>`);
          svgParts.push(`    <path class="hand-chevron chevron-up" d="M ${leftX.toFixed(2)} ${baseY.toFixed(2)} L ${nx.toFixed(2)} ${apexY.toFixed(2)} L ${rightX.toFixed(2)} ${baseY.toFixed(2)}" fill="none" stroke="${noteColor}" stroke-width="0.80" stroke-linecap="round" stroke-linejoin="round"/>`);
        } else {
          const cy = ny + (r + clearance);
          const baseY = cy - chH / 2;
          const apexY = cy + chH / 2;
          svgParts.push(`    <path class="hand-chevron-shield" d="M ${leftX.toFixed(2)} ${baseY.toFixed(2)} L ${nx.toFixed(2)} ${apexY.toFixed(2)} L ${rightX.toFixed(2)} ${baseY.toFixed(2)} Z" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="1.80" stroke-linecap="round" stroke-linejoin="round"/>`);
          svgParts.push(`    <path class="hand-chevron chevron-down" d="M ${leftX.toFixed(2)} ${baseY.toFixed(2)} L ${nx.toFixed(2)} ${apexY.toFixed(2)} L ${rightX.toFixed(2)} ${baseY.toFixed(2)}" fill="none" stroke="${noteColor}" stroke-width="0.80" stroke-linecap="round" stroke-linejoin="round"/>`);
        }
      }
    }

    svgParts.push(`  </g>`);
  }

  // 4. Page footer removed per definitive engraving (clean Urtext, zero footer fluff)

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
