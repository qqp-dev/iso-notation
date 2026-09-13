/**
 * Jánko Two-Row Engraving Engine
 * ==============================
 *
 * Deterministic, modular engraving of the *Jánko Two-Row Equator* grand staff.
 * The engine is split into a pure geometry core (`geometry.ts`), pluggable
 * element renderers (`elements/*`) and this page/crop/comparison composition
 * layer. No coordinate math or SVG template lives in the export scripts.
 *
 * Row-Snapped Parity Offset (Approach 2)
 * --------------------------------------
 * A whole-tone row is shared by six pitch classes, so a chord regularly puts
 * two of its tones on one row of one octave (C major `[0, 4, 7]`, G7
 * `[7, 11, 2, 5]`, …). Every head keeps its **true row** — the row is the
 * instrument's physical row and may never be re-spelled — and the collision is
 * resolved *horizontally*: heads that share an onset, an octave and a row are
 * sorted by pitch and spread symmetrically around the beat column by
 * `tokens.chordalOffset` (see {@link resolveRowSnappedChordOffsets}). Heads on
 * *different* rows stay vertically aligned on the nominal beat column, so the
 * isomorphic ∇ / Δ hand shapes survive untouched.
 *
 * Public entry points
 * -------------------
 * - {@link renderJankoPage}               — full A4 page (4 systems, 16 mm.)
 * - {@link renderJankoCrop}               — targeted macro crop of N measures
 * - {@link renderJankoVariantComparison}  — side-by-side variant contact sheet
 */

import { Hand, QuantizedGridScore, QuantizedNote } from '../../model/types';
import {
  JankoChannelFlank,
  JankoPitchCoordinate,
  JankoTickInsets,
  getEquatorYForOctave,
  getNoteHand,
  getPitchCoordinate,
  getTickX,
  resolveChannelFlanks,
  splitTick,
  usesContourFlanks,
} from './geometry';
import {
  DEFAULT_JANKO_VARIANTS,
  JANKO_RHYTHM_STYLE_LABELS,
  JankoChordGrouping,
  JankoLayoutOptions,
  JankoPageGeometry,
  JankoRhythmStyle,
  JankoSystemGeometry,
  JankoSystemStartStyle,
  JankoTokens,
  JankoVariant,
  JankoVariantSpec,
  ResolvedJankoLayoutOptions,
  ResolvedJankoTokens,
  channelsGridInk,
  getGridNoteInset,
  protectsBarlineInk,
  resolveJankoOptions,
  resolveJankoTokens,
} from './types';
import { renderJankoStyleDefs, f } from './elements/style';
import {
  renderHandLabels,
  renderLedgerEquator,
  renderOctaveLabels,
  renderOutlierRule,
  renderStaffLines,
  renderTimeSignature,
  getEquatorRuleYs,
} from './elements/staff';
import { JANKO_HALO_STROKE_WIDTH, isPositionOfHonor, renderNotehead } from './elements/notehead';
import {
  JankoBeamGroupGeometry,
  JankoChordBridge,
  JankoClaspGroupGeometry,
  JankoClaspRailGeometry,
  JankoRhythmNote,
  JankoVerticalChordGroup,
  CLASP_MARK_REACH,
  CLASP_MIN_VERTICAL_CHORD,
  JANKO_STEM_STAGGER,
  claspInkBox,
  claspQualifies,
  computeBeamGroupGeometry,
  computeClaspGeometry,
  computeVerticalChordGroup,
  getStemAttachmentRadius,
  partitionBeamGroups,
  renderBeamGroup,
  renderChordBridges,
  renderClaspGroup,
  renderRhythm,
  withClaspRail,
} from './elements/rhythm';
import {
  ARCHITECTURAL_BRACKET_SPUR,
  ARCHITECTURAL_BRACKET_STROKE,
  CLEF_PILLAR_STROKE,
  CLEF_PILLAR_TICK,
  DELICATE_BRACKET_SPUR,
  DELICATE_BRACKET_STROKE,
  DOUBLE_HAIRLINE_INNER_STROKE,
  DOUBLE_HAIRLINE_OUTER_STROKE,
  DOUBLE_HAIRLINE_SPACING,
  renderAccolade,
  renderCaptionLines,
  wrapCaptionText,
} from './elements/accolade';
import {
  MEASURE_NUMBER_LEFT_OFFSET,
  getMeasureNumberBaselineY,
  renderBarlines,
  renderBeatGrid,
  renderMeasureNumber,
} from './elements/barlines';
import {
  JankoRestGeometry,
  isStandardRestValue,
  renderRest,
  restInkBox,
  restValueForTicks,
} from './elements/rests';

/** Vertical reserve above a crop for its caption band (pt). */
const CROP_CAPTION_HEIGHT = 15.0;
/** Horizontal breathing room on both sides of a crop (pt). */
const CROP_PAD_X = 8.0;
/** Vertical breathing room above/below a crop's staff (pt). */
const CROP_PAD_TOP = 16.0;
const CROP_PAD_BOTTOM = 10.0;

/** A rectangle in page pt coordinates. */
export interface SvgBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

// ---------------------------------------------------------------------------
// Page geometry
// ---------------------------------------------------------------------------

/**
 * Resolve the absolute A4 page geometry for a Jánko Two-Row page.
 *
 * The Middle C spine is centred in the `interStaffGap` channel between the two
 * inner staff equators (o4 and o3); the unified lattice then extends by
 * `octaveStep` per octave in both directions (see
 * `geometry.getEquatorYForOctave`), identically for both hands.
 */
export function computePageGeometry(
  options?: Partial<JankoLayoutOptions> | null,
  tokens?: Partial<JankoTokens> | null
): JankoPageGeometry {
  const o = resolveJankoOptions(options);
  const t = resolveJankoTokens(tokens);

  const margin = o.pageMargin;
  const printableHeight = o.pageHeight - 2 * margin;
  const bodyHeight = printableHeight - o.headerHeight - o.footerHeight;
  const systemsPerPage = Math.max(1, Math.round(o.systemsPerPage));
  const measuresPerSystem = Math.max(1, Math.round(o.measuresPerSystem));
  const slotHeight = bodyHeight / systemsPerPage;

  const staffLeft = margin + t.accoladeWidth + t.accoladeGap;
  const staffRight = o.pageWidth - margin;
  const staffWidth = staffRight - staffLeft;
  const measureWidth = staffWidth / measuresPerSystem;

  const systems: JankoSystemGeometry[] = [];
  for (let s = 0; s < systemsPerPage; s++) {
    const slotTopY = margin + o.headerHeight + s * slotHeight;
    const systemTopY = slotTopY + 12.0;
    const middleCY = systemTopY + 22.0 + t.octaveStep + o.interStaffGap / 2;
    const equatorY = (hand: Hand, octave: number): number =>
      middleCY + getEquatorYForOctave(octave, hand, t, o);
    const isSys0Anacrusis = s === 0 && (t.anacrusisTicks ?? 0) > 0;
    const effectiveMeasures = isSys0Anacrusis
      ? measuresPerSystem + t.anacrusisTicks! / t.ticksPerMeasure
      : measuresPerSystem;
    const sysMeasureWidth = staffWidth / effectiveMeasures;
    systems.push({
      index: s,
      measuresPerSystem,
      slotTopY,
      systemTopY,
      middleCY,
      staffTopY: equatorY('RH', 5) - 16.0,
      staffBotY: equatorY('LH', 2) + 16.0,
      staffLeft,
      staffRight,
      measureWidth: sysMeasureWidth,
      equatorY,
    });
  }

  return {
    options: o,
    tokens: t,
    pageWidth: o.pageWidth,
    pageHeight: o.pageHeight,
    margin,
    headerHeight: o.headerHeight,
    footerHeight: o.footerHeight,
    bodyHeight,
    slotHeight,
    systemsPerPage,
    measuresPerSystem,
    staffLeft,
    staffRight,
    staffWidth,
    measureWidth,
    systems,
  };
}

// ---------------------------------------------------------------------------
// SVG scaffolding
// ---------------------------------------------------------------------------

function svgOpen(box: SvgBox): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(box.x)} ${f(box.y)} ${f(box.w)} ${f(box.h)}" width="${f(box.w)}pt" height="${f(box.h)}pt" style="background:#FFFFFF;">`;
}

/**
 * Page header (Round 10): classical Urtext practice. Page 1 carries the full
 * title, subtitle and composer block; every later page carries only a discreet
 * running header at `margin + 10` (`composer · title · subtitle`, 7.0pt serif
 * italic `#555555`) and reclaims the vertical space the title block used.
 */
function renderPageHeader(geo: JankoPageGeometry, pageIndex: number, totalPages: number): string {
  const o = geo.options;
  void totalPages;
  const y = geo.margin;
  if (pageIndex === 0) {
    const cx = geo.pageWidth / 2;
    return [
      '  <g id="page-header">',
      `    <text x="${f(cx)}" y="${f(y + 14)}" class="janko-title" text-anchor="middle">${o.title}</text>`,
      `    <text x="${f(cx)}" y="${f(y + 27)}" class="janko-subtitle" text-anchor="middle">${o.subtitle}</text>`,
      `    <text x="${f(geo.pageWidth - geo.margin)}" y="${f(y + 27)}" class="janko-meta" text-anchor="end">${o.composer}</text>`,
      '  </g>',
    ].join('\n');
  }
  const running = [o.composer, o.title, o.subtitle].filter((part) => part.length > 0).join(' · ');
  return [
    '  <g id="page-header">',
    `    <text x="${f(geo.margin)}" y="${f(y + 10)}" class="janko-running-head">${running}</text>`,
    '  </g>',
  ].join('\n');
}

/**
 * Page footer (Round 10): the page numbering alone, at normal weight. The
 * repetitive "Pure 12-TET Jánko Two-Row Grand Staff" slogan is gone.
 */
function renderPageFooter(geo: JankoPageGeometry, pageIndex: number, totalPages: number): string {
  const y = geo.pageHeight - geo.margin + 12;
  return [
    '  <g id="page-footer">',
    `    <text x="${f(geo.pageWidth - geo.margin)}" y="${f(y)}" class="janko-page-num" text-anchor="end">Page ${pageIndex + 1} of ${totalPages}</text>`,
    '  </g>',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Layout model (shared by the renderers, the visual linter and the studio)
// ---------------------------------------------------------------------------

/**
 * System geometry for a **global** system index.
 *
 * Every page reuses the same vertical slot rhythm, so the geometry of system
 * `n` (0-based, across the whole score) is the geometry of slot
 * `n % systemsPerPage` on its page. This is what lets pages 2, 3, … and macro
 * crops of late measures render correctly instead of silently collapsing to an
 * empty page.
 */
export function getSystemGeometry(
  geo: JankoPageGeometry,
  systemIndex: number
): JankoSystemGeometry {
  const perPage = Math.max(1, geo.systemsPerPage);
  const slot = ((systemIndex % perPage) + perPage) % perPage;
  return geo.systems[slot];
}

/** Total horizontal systems engraved for a score. */
export function countJankoSystems(
  score: QuantizedGridScore,
  options?: Partial<JankoLayoutOptions> | null,
  tokens?: Partial<JankoTokens> | null
): number {
  const o = resolveJankoOptions(options);
  const t = resolveJankoTokens(tokens);
  const anacrusis = t.anacrusisTicks ?? 0;
  const totalTicks = score.totalTicks || 0;
  const ticks = Math.max(0, totalTicks - anacrusis);
  const measuresTotal = Math.max(1, Math.ceil(ticks / t.ticksPerMeasure));
  return Math.max(1, Math.ceil(measuresTotal / Math.max(1, o.measuresPerSystem)));
}

/** One positioned note with its resolved geometry and rhythm payload. */
export interface PositionedJankoNote {
  note: QuantizedNote;
  coord: JankoPitchCoordinate;
  x: number;
  y: number;
  rhythm: JankoRhythmNote;
  /**
   * Round 15: the note's un-displaced beat column (page pt), recorded by the
   * chord-column solve so the linter can prove no head left the **beat cell**
   * of its own column (`grid-crossing-offset`).
   */
  nominalX?: number;
  /**
   * Round 15: the painted grid-line span of that beat cell
   * (`[left, right]`, page pt) — a barline or a dashed beat pulse at each edge.
   */
  beatCell?: { left: number; right: number };
}

/** One clasp cluster of a system: the notes a single bracket groups. */
export interface JankoClaspCluster {
  /** Member notes of the cluster. */
  notes: PositionedJankoNote[];
  /** Measure index inside the system (drives the rail grouping). */
  measureIdx: number;
  /**
   * Duration the clasp carries, when it is not simply the shortest member
   * value (the `'bounding-phrase'` paradigm carries its opening value).
   */
  durationTicks?: number;
}

/**
 * Collect the chord/cluster groups of one system.
 *
 * - `'left-clasp-spire'` / `'beamed-clasp-rail'`: one group per onset carrying
 *   **two or more** simultaneous heads — the vertical simultaneity a two-row
 *   whole-tone staff spreads over several rows. A lone melodic note is never
 *   grouped, so running 16th-note writing keeps its stems and beams untouched.
 *   `claspTicks`, when supplied, keeps only the onsets the fit rule accepted.
 * - `'bounding-phrase'`: one group per measure that contains a chord, bounding
 *   **every** note of the measure. The bracket carries the measure's opening
 *   duration.
 * - `'per-hand-clasp'` (Round 6, widened by Round 8): the grouping unit is the
 *   **hand** — never the grand staff. A hand's onset is grouped when it carries
 *   two or more heads that are horizontally displaced by the row-snapped parity
 *   offset, **or** when it is a vertical chord of three or more heads; a clean
 *   2-note column and a lone melodic note keep their stems. A hand cluster that
 *   crosses Middle C is grouped across the corridor, because the bracket spans
 *   that hand's own full reach.
 */
export function collectClaspClusters(
  notes: readonly PositionedJankoNote[],
  geo: JankoSystemGeometry,
  systemIndex: number,
  o: ResolvedJankoLayoutOptions,
  t: ResolvedJankoTokens,
  claspTicks?: ReadonlySet<number> | null
): JankoClaspCluster[] {
  if (!usesChordClasps(o.chordGrouping)) return [];
  const byTick = new Map<number, PositionedJankoNote[]>();
  for (const p of notes) {
    const bucket = byTick.get(p.note.startTick);
    if (bucket) bucket.push(p);
    else byTick.set(p.note.startTick, [p]);
  }
  const onsets = [...byTick.entries()]
    .filter(([, group]) => group.length >= 2)
    .sort((a, b) => a[0] - b[0]);
  const measureOf = (p: PositionedJankoNote): number =>
    getMeasureIndexOfTick(p.note, geo, systemIndex, t);

  if (o.chordGrouping === 'per-hand-clasp') {
    const groups: JankoClaspCluster[] = [];
    for (const [tick, onset] of onsets) {
      if (claspTicks && !claspTicks.has(tick)) continue;
      for (const hand of ['RH', 'LH'] as const) {
        const members = onset.filter((p) => p.rhythm.hand === hand);
        // Round 8 scope: a horizontally spread hand cluster or a vertical chord
        // of three or more heads qualifies; a 2-note column does not.
        if (!claspQualifies(members.map((p) => p.rhythm))) continue;
        groups.push({ notes: members, measureIdx: measureOf(members[0]) });
      }
    }
    return groups;
  }

  if (o.chordGrouping !== 'bounding-phrase') {
    return onsets
      .filter(([tick]) => !claspTicks || claspTicks.has(tick))
      .map(([, group]) => ({ notes: group, measureIdx: measureOf(group[0]) }));
  }

  // The phrase bracket sits at the measure's opening edge, where the air is a
  // property of the measure itself, not of the chord that provoked it: every
  // measure carrying a simultaneity is a candidate, and the fit rule below
  // decides whether its bracket can stand.
  const chordMeasures = new Set(onsets.map(([, group]) => measureOf(group[0])));
  const byMeasure = new Map<number, PositionedJankoNote[]>();
  for (const p of notes) {
    const m = measureOf(p);
    const bucket = byMeasure.get(m);
    if (bucket) bucket.push(p);
    else byMeasure.set(m, [p]);
  }
  return [...byMeasure.entries()]
    .filter(([m, group]) => chordMeasures.has(m) && group.length >= 2)
    .sort((a, b) => a[0] - b[0])
    .map(([measureIdx, group]) => {
      const firstTick = Math.min(...group.map((p) => p.note.startTick));
      const opening = group.filter((p) => p.note.startTick === firstTick);
      return {
        notes: group,
        measureIdx,
        durationTicks: Math.min(...opening.map((p) => p.note.durationTicks)),
      };
    });
}

/**
 * Absolute x of the barline that opens a measure — the closing barline of the
 * measure (or upbeat) before it — or null when the measure opens its system.
 * The staff lines of a system emerge openly from the left margin, so a bracket
 * there has no barline to clear.
 */
export function getMeasureOpeningBarlineX(
  measureIdx: number,
  geo: JankoSystemGeometry,
  systemIndex: number,
  t: ResolvedJankoTokens
): number | null {
  if (measureIdx <= 0) return null;
  const anacrusis = t.anacrusisTicks ?? 0;
  const upbeatSystem0 = systemIndex === 0 && anacrusis > 0;
  const firstMeasureLeft = upbeatSystem0
    ? geo.staffLeft + (anacrusis / t.ticksPerMeasure) * geo.measureWidth
    : geo.staffLeft;
  const offset = upbeatSystem0 ? measureIdx - 1 : measureIdx;
  return firstMeasureLeft + offset * geo.measureWidth;
}

/** Absolute x of the barline that closes a measure (always painted). */
export function getMeasureClosingBarlineX(
  measureIdx: number,
  geo: JankoSystemGeometry,
  systemIndex: number,
  t: ResolvedJankoTokens
): number {
  const anacrusis = t.anacrusisTicks ?? 0;
  const upbeatSystem0 = systemIndex === 0 && anacrusis > 0;
  const upbeatWidth = upbeatSystem0 ? (anacrusis / t.ticksPerMeasure) * geo.measureWidth : 0;
  if (upbeatSystem0 && measureIdx === 0) return geo.staffLeft + upbeatWidth;
  const offset = upbeatSystem0 ? measureIdx - 1 : measureIdx;
  return geo.staffLeft + upbeatWidth + (offset + 1) * geo.measureWidth;
}

/**
 * Air (pt) a notehead keeps from a barline. Mirrors
 * `DEFAULT_JANKO_LINT_OPTIONS.minClearance`, so the engine's own admission test
 * agrees with the visual linter.
 */
export const COLUMN_BARLINE_AIR = 1.0;

/**
 * Measures of a solved system whose columns break a hard rule: two noteheads of
 * different onsets closer than one disc diameter, or a notehead driven into its
 * closing barline.
 *
 * A measure that carries a downbeat clasp stands further right of its barline
 * (see {@link getMeasureInsets}); where the measure's own content is too dense
 * to absorb that shift, this test is what demotes it — and with it the bracket —
 * back to the canonical margins instead of letting the engraving collide.
 *
 * Round 12: under the `'unified-transparent-grid'` policy the barline carries no
 * protected air at all — the music uses the full measure width and the circular
 * knockout erases whatever it crosses — so only the disc-to-disc rule remains.
 */
export function measuresWithColumnCollisions(
  notes: readonly PositionedJankoNote[],
  geo: JankoSystemGeometry,
  systemIndex: number,
  t: ResolvedJankoTokens,
  protectBarlines: boolean = true
): Set<number> {
  const bad = new Set<number>();
  const r = t.noteheadRadius;
  const measureOf = (p: PositionedJankoNote): number =>
    getMeasureIndexOfTick(p.note, geo, systemIndex, t);
  const sorted = [...notes].sort((a, b) => a.x - b.x);
  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    for (let j = i + 1; j < sorted.length; j++) {
      const b = sorted[j];
      if (b.x - a.x >= 2 * r) break;
      if (a.note.startTick === b.note.startTick) continue;
      if (Math.hypot(b.x - a.x, b.y - a.y) < 2 * r - EPS) {
        bad.add(measureOf(a));
        bad.add(measureOf(b));
      }
    }
  }
  if (!protectBarlines) return bad;
  for (const p of notes) {
    const m = measureOf(p);
    const barlineX = getMeasureClosingBarlineX(m, geo, systemIndex, t);
    if (Math.abs(p.x - barlineX) - r < COLUMN_BARLINE_AIR - EPS) bad.add(m);
  }
  return bad;
}

/** A rectangle in page pt coordinates, in box (min/max) form. */
export interface JankoBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Approximate advance width of a measure numeral as a fraction of its font
 * size. Mirrors `DEFAULT_JANKO_LINT_OPTIONS.digitAdvance`, so the engine's clasp
 * fit rule and the linter's furniture audit agree on the same box.
 */
export const MARGIN_DIGIT_ADVANCE = 0.35;

/** Font size (pt) of the measure numeral (see `elements/barlines`). */
export const MARGIN_NUMERAL_FONT_SIZE = 7.0;

/**
 * Does a system-start style paint any margin ink? `'open-halo'` and `'none'`
 * leave the margin empty, so nothing is painted — and nothing is reserved —
 * for them. The golden master's `'architectural-bracket'` does paint (and
 * reserve) the flared 0.65pt rule.
 */
export function paintsSystemStartInk(style: JankoSystemStartStyle): boolean {
  return (
    style === 'architectural-bracket' ||
    style === 'delicate-bracket' ||
    style === 'clef-pillar' ||
    style === 'double-hairline'
  );
}

/**
 * Boxes of the left-margin furniture of one system: the measure numeral and the
 * system-start mark (Round 10: the copperplate accolade is retired, so the
 * accolade box is `null` unless a ruled system-start style is active). Shared
 * by the engine's clasp fit rule and the visual linter's
 * `measure-numeral-clearance` / `accolade-clearance` audits, so a bracket can
 * never be admitted into furniture the linter would report — and the audits can
 * never drift from the geometry the engine reserved.
 */
export function getMarginFurniture(
  geometry: JankoSystemGeometry,
  t: ResolvedJankoTokens,
  measureNumber: number,
  digitAdvance: number = MARGIN_DIGIT_ADVANCE,
  systemStartStyle: JankoSystemStartStyle = 'architectural-bracket'
): { numeral: JankoBox; accolade: JankoBox | null } {
  // Round 11: the numeral moves into the true left margin
  // (`x = staffLeft − 10.0pt`) and is set flush right against the staff column,
  // so its reserved box opens to the left of the anchor.
  const numeralX = geometry.staffLeft - MEASURE_NUMBER_LEFT_OFFSET;
  const numeralBaseline = getMeasureNumberBaselineY(geometry);
  const numeralWidth =
    String(measureNumber).length * MARGIN_NUMERAL_FONT_SIZE * digitAdvance * 1.5;
  const numeral: JankoBox = {
    x0: numeralX - numeralWidth,
    y0: numeralBaseline - MARGIN_NUMERAL_FONT_SIZE * 1.2,
    // The numeral is set on an alphabetic baseline and figures carry no
    // descender: the ink stops at the baseline.
    x1: numeralX,
    y1: numeralBaseline,
  };
  let accolade: JankoBox | null = null;
  if (paintsSystemStartInk(systemStartStyle)) {
    const x = geometry.staffLeft - t.accoladeGap - t.accoladeWidth;
    const top = geometry.equatorY('RH', 5);
    const bot = geometry.equatorY('LH', 2);
    let x0 = x;
    let x1 = x;
    if (systemStartStyle === 'architectural-bracket') {
      const half = ARCHITECTURAL_BRACKET_STROKE / 2;
      x0 = x - half;
      x1 = x + ARCHITECTURAL_BRACKET_SPUR + half;
    } else if (systemStartStyle === 'delicate-bracket') {
      const half = DELICATE_BRACKET_STROKE / 2;
      x0 = x - half;
      x1 = x + DELICATE_BRACKET_SPUR + half;
    } else if (systemStartStyle === 'clef-pillar') {
      const half = CLEF_PILLAR_STROKE / 2;
      x0 = x - half;
      x1 = x + CLEF_PILLAR_TICK + half;
    } else {
      x0 = x - DOUBLE_HAIRLINE_OUTER_STROKE / 2;
      x1 = x + DOUBLE_HAIRLINE_SPACING + DOUBLE_HAIRLINE_INNER_STROKE / 2;
    }
    accolade = { x0, y0: top, x1, y1: bot };
  }
  return { numeral, accolade };
}

/**
 * Every left-margin furniture box painted in one system (the system-start mark
 * only at the start of the piece, the measure numeral only where the engine
 * draws it), in the order the linter audits them.
 *
 * Round 7 draws the accolade **strictly at the start of the piece**
 * (`systemIndex === 0`); an intermediate system opens from the bare left
 * margin, so it neither paints nor reserves a system-start box. Round 10
 * retires the copperplate accolade; Round 14 settles the flared
 * `'architectural-bracket'` as the golden system start, so System 1 normally
 * reserves (and paints) the 0.65pt rule.
 */
export function systemFurniture(
  geometry: JankoSystemGeometry,
  o: ResolvedJankoLayoutOptions,
  t: ResolvedJankoTokens,
  systemIndex: number
): JankoBox[] {
  const anacrusis = t.anacrusisTicks ?? 0;
  const { numeral, accolade } = getMarginFurniture(
    geometry,
    t,
    systemIndex * o.measuresPerSystem + 1,
    MARGIN_DIGIT_ADVANCE,
    o.systemStartStyle
  );
  const boxes: JankoBox[] = systemIndex === 0 && accolade ? [accolade] : [];
  if (o.showMeasureNumbers && (systemIndex > 0 || anacrusis === 0)) boxes.push(numeral);
  return boxes;
}

/** Do two boxes overlap (or come closer than `clearance`)? */
export function boxesWithin(a: JankoBox, b: JankoBox, clearance: number = 0): boolean {
  return a.x0 - clearance < b.x1 && b.x0 - clearance < a.x1 && a.y0 - clearance < b.y1 && b.y0 - clearance < a.y1;
}

/**
 * Air (pt) a *foreign* head must keep from a clasp's ink box.
 *
 * A head of the **other hand on the clasp's own onset** travels with the same
 * solved column and is therefore not foreign ink at all: it only has to stay
 * clear of the bracket's actual spine and caps (zero nominal air, i.e. no
 * overlap). A head of any other onset — including the preceding LH 16ths — is
 * real foreign ink and keeps the full {@link CLASP_NOTEHEAD_AIR}.
 *
 * Round 7: measuring the same-onset hand partner with the full air used to
 * silently drop the `B - 2 - 8` bracket of Brahms m. 7, whose LH head shares a
 * whole-tone row with an RH member of the same onset.
 */
export function claspForeignAir(group: JankoClaspGroupGeometry, startTick: number): number {
  return startTick === group.tick ? 0 : CLASP_NOTEHEAD_AIR;
}

/**
 * Does a resolved clasp stand clear of its opening barline, of every foreign
 * disc and of the left-margin furniture? The engine's fit rule (see
 * {@link resolveChordColumns}) and the visual linter's `clasp-clearance` audit
 * share this predicate, so a bracket that the engine engraves can never be
 * reported as a collision.
 */
export function claspClearsLayout(
  geometry: JankoClaspGroupGeometry,
  barlineX: number | null,
  notes: readonly PositionedJankoNote[],
  t: ResolvedJankoTokens,
  furniture: readonly JankoBox[] = []
): boolean {
  const disk = claspInkBox(geometry, t);
  if (barlineX !== null && disk.x0 - barlineX < t.claspMinBarlineAir - CLASP_EPS) return false;
  for (const box of furniture) {
    if (boxesWithin(disk, box, CLASP_NOTEHEAD_AIR)) return false;
  }
  const own = new Set(geometry.notes.map((n) => n.id));
  for (const p of notes) {
    if (own.has(p.note.id)) continue;
    const dx = Math.max(disk.x0 - p.x, 0, p.x - disk.x1);
    const dy = Math.max(disk.y0 - p.y, 0, p.y - disk.y1);
    const air = claspForeignAir(geometry, p.note.startTick);
    if (Math.hypot(dx, dy) < t.noteheadRadius + air - CLASP_EPS) return false;
  }
  return true;
}

/** One candidate rail run, offered to the caller's verdict before it is engraved. */
export interface JankoClaspRailRun {
  /** Indices into the `groups` array {@link computeClaspRails} received. */
  indexes: number[];
  /** The run's railed clasps, in onset order. */
  groups: JankoClaspGroupGeometry[];
  /** The rails that would join them. */
  rails: JankoClaspRailGeometry[];
}

/** Verdict on one candidate rail run (`false` leaves the clasps unrailed). */
export type JankoClaspRailVerdict = (run: JankoClaspRailRun) => boolean;

/**
 * Join the extended spine tops of contiguous clasps with a horizontal rail
 * (`'beamed-clasp-rail'`).
 *
 * Two clasps are *contiguous* when they are consecutive clasps of one measure —
 * the measure is the phrase unit of this notation, so the rail is always a
 * measure-bounded beam: it spans only its own measure's spine columns and
 * therefore can never approach, let alone cross, a barline. The primary rail
 * runs at the **topmost** extended spine top, so every joined bracket reaches it
 * (Round 8 removed the lopsided spire: the spine itself is extended); duration
 * notches are dropped exactly as a traditional beam replaces them. A second rail
 * `flagSpacing` below carries the 16th-note level whenever the run holds two or
 * more 16th-class clasps. A half/whole clasp carries an open knockout mark
 * rather than a transverse subdivision mark and never joins a run.
 *
 * `verdict`, when supplied, sees the tentatively railed run — extended spines
 * and rails — and may reject it; the clasps are then engraved unrailed rather
 * than letting a rail cut through a foreign glyph.
 */
export function computeClaspRails(
  groups: readonly JankoClaspGroupGeometry[],
  clusters: readonly JankoClaspCluster[],
  t: ResolvedJankoTokens,
  verdict?: JankoClaspRailVerdict
): { groups: JankoClaspGroupGeometry[]; rails: JankoClaspRailGeometry[] } {
  const resolved = [...groups];
  const rails: JankoClaspRailGeometry[] = [];
  if (groups.length === 0 || clusters.length !== groups.length) {
    return { groups: resolved, rails };
  }
  const buckets = new Map<number, number[]>();
  clusters.forEach((cluster, index) => {
    if (resolved[index].pips > 0) return;
    const bucket = buckets.get(cluster.measureIdx);
    if (bucket) bucket.push(index);
    else buckets.set(cluster.measureIdx, [index]);
  });

  for (const bucket of buckets.values()) {
    if (bucket.length < 2) continue;
    const run = bucket.sort((a, b) => resolved[a].tick - resolved[b].tick);
    const railY = Math.min(...run.map((i) => resolved[i].topY));
    const railed = run.map((i) => withClaspRail(resolved[i], railY));
    const ids = (indexes: readonly number[]): string[] =>
      indexes.flatMap((i) => resolved[i].notes.map((n) => n.id));
    const railsFor = (indexes: readonly number[], level: 1 | 2): JankoClaspRailGeometry => ({
      x1: Math.min(...indexes.map((i) => resolved[i].claspX)),
      x2: Math.max(...indexes.map((i) => resolved[i].claspX)),
      y: level === 1 ? railY : railY + t.flagSpacing,
      thickness: t.beamThickness,
      level,
      noteIds: ids(indexes),
    });
    const candidate: JankoClaspRailRun = {
      indexes: [...run],
      groups: railed,
      rails: [railsFor(run, 1)],
    };
    const sixteenths = run.filter((i) => resolved[i].duration === 'spire-two-flags');
    if (sixteenths.length >= 2) candidate.rails.push(railsFor(sixteenths, 2));
    if (verdict && !verdict(candidate)) continue;
    run.forEach((i, k) => {
      resolved[i] = railed[k];
    });
    rails.push(...candidate.rails);
  }
  return { groups: resolved, rails };
}

/**
 * Does a rail stand clear of every foreign disc? A rail is a beam: it may pass
 * over the cluster it joins, but never through another glyph.
 */
export function railClearsLayout(
  rail: JankoClaspRailGeometry,
  notes: readonly PositionedJankoNote[],
  t: ResolvedJankoTokens
): boolean {
  const joined = new Set(rail.noteIds);
  const half = rail.thickness / 2;
  for (const p of notes) {
    if (joined.has(p.note.id)) continue;
    const dx = Math.max(rail.x1 - p.x, 0, p.x - rail.x2);
    const dy = Math.max(rail.y - half - p.y, 0, p.y - (rail.y + half));
    if (Math.hypot(dx, dy) < t.noteheadRadius + CLASP_NOTEHEAD_AIR - CLASP_EPS) return false;
  }
  return true;
}

/** Every geometric fact one engraved system is built from. */
export interface JankoSystemLayout {
  /** Zero-based global system index. */
  index: number;
  /**
   * True for the last system of the score. Round 7 opens every intermediate
   * system at its right edge, so only the final system paints the closing
   * vertical barline (see `elements/barlines.renderBarlines`).
   */
  isFinalSystem: boolean;
  /** Absolute page geometry of the system's slot. */
  geometry: JankoSystemGeometry;
  /** Notes of this system, in engraving order (tick, then pitch class). */
  notes: PositionedJankoNote[];
  /** Beamed groups with fully resolved beam/stem geometry ([] when unbeamed). */
  beams: JankoBeamGroupGeometry[];
  /** Short notes engraved with a standalone tick instead of a beam. */
  ungrouped: JankoRhythmNote[];
  /**
   * Round 12 voice rests: the written silences of this system, one per inactive
   * span of a hand inside a measure that hand is active in (see
   * {@link computeJankoRestLayer}).
   */
  rests: JankoRestGeometry[];
  /**
   * Round 14: silences the rest fit rule **refused to write**, each with its
   * reason. The linter republishes them as `rest-unwritable` diagnostics, so a
   * refused rest is never a silent omission.
   */
  unwrittenRests: JankoUnwrittenRest[];
  /** External left clasps of the chord-grouping paradigm ([] for `'none'`). */
  clasps: JankoClaspGroupGeometry[];
  /** Rails joining contiguous clasps (`'beamed-clasp-rail'` only). */
  claspRails: JankoClaspRailGeometry[];
  /**
   * Note ids whose standalone stem the clasp replaces. A clasp member that
   * belongs to a beam group keeps its stem: a real 16th-note beam is never cut
   * to pieces by a grouping bracket.
   */
  claspedStems: string[];
  /**
   * Round 7 (Option 3): the hand's vertically aligned chords. The interior
   * heads of each group draw no stem of their own, the wide leaps carry an
   * intentional bridge, and the group's outer extremity carries the duration.
   */
  verticalChords: JankoVerticalChordGroup[];
  /** Round 7 (Option 3): every intentional bridge line of the system. */
  chordBridges: JankoChordBridge[];
}

function handForNote(note: QuantizedNote): Hand {
  return getNoteHand(note.hand, note.pitch.octave);
}

/**
 * Left inset (pt) a measure must reserve when its **downbeat** carries a left
 * clasp: `claspX = noteLeft − r − claspOffset` has to keep
 * `claspMinBarlineAir` clear of the measure's opening barline, and Round 10's
 * scaled marks reach {@link CLASP_MARK_REACH} further left of the spine, so
 * `noteLeft ≥ r + claspOffset + CLASP_MARK_REACH + claspMinBarlineAir` (15.6pt
 * with the canonical tokens). The budget is deliberately conservative — the
 * widest mark is the 8pt diamond band — so no paradigm's mark can be driven
 * into the barline it follows.
 */
export function getClaspDownbeatInset(tokens?: Partial<JankoTokens> | null): number {
  const t = resolveJankoTokens(tokens);
  return t.noteheadRadius + t.claspOffset + CLASP_MARK_REACH + t.claspMinBarlineAir;
}

/**
 * Required absolute left inset (pt) per **system-local measure index** when a
 * downbeat clasp widens the measure's opening margin. Measures without a
 * downbeat clasp are absent from the map (and keep `tokens.measureInset`).
 */
export type JankoClaspInsetMap = ReadonlyMap<number, number>;

/**
 * Horizontal insets of one measure of a system: the canonical
 * `tokens.measureInset` on both sides, widened on the left of the very first
 * measure of the page when a time signature has to be cleared, and widened
 * again when the measure's downbeat carries a left clasp
 * (`claspLeftInset`, see {@link getClaspDownbeatInset}).
 *
 * The two side margins form a **fixed budget**: the air a downbeat bracket
 * needs is taken from the measure's closing margin, so the note field keeps its
 * canonical width and every downstream beat keeps its natural proportional
 * spacing. Nothing is compressed, nothing is distorted — the whole measure
 * simply stands a little further right of its barline. When the air a bracket
 * needs exceeds the whole canonical budget (`2 × measureInset`), as Round 10's
 * scaled marks can on a downbeat (15.6pt against a 12pt budget), the closing
 * margin is already zero and the field is **uniformly scaled** by the remaining
 * shortfall: the proportional grid is compressed, never sheared.
 */
export function getMeasureInsets(
  systemIndex: number,
  measureIdx: number,
  o: ResolvedJankoLayoutOptions,
  t: ResolvedJankoTokens,
  claspLeftInset: number = 0
): JankoTickInsets {
  const isOpeningMeasure = systemIndex === 0 && measureIdx === 0;
  // Round 12: the transparent grid withdraws the canonical measure inset, so
  // the music uses the full measure width and a downbeat column stands exactly
  // on the barline, where its circular knockout erases it.
  const inset = getGridNoteInset(o, t);
  const base =
    isOpeningMeasure && o.showTimeSignature && o.timeSignatureWidth > 0
      ? { left: inset + o.timeSignatureWidth, right: inset }
      : { left: inset, right: inset };
  const extra = Math.max(0, claspLeftInset - base.left);
  return { left: base.left + extra, right: Math.max(0, base.right - extra) };
}

/** Does this chord-grouping mode draw an external left clasp at all? */
export function usesChordClasps(mode: JankoChordGrouping): boolean {
  return mode !== 'none';
}

/** Measure index (inside its system) of a note's onset. */
export function getMeasureIndexOfTick(
  note: QuantizedNote,
  geo: JankoSystemGeometry,
  systemIndex: number,
  t: ResolvedJankoTokens
): number {
  const anacrusis = t.anacrusisTicks ?? 0;
  if (anacrusis > 0) {
    if (systemIndex === 0) {
      if (note.startTick < anacrusis) return 0;
      const elapsed = note.startTick - anacrusis;
      return 1 + Math.floor(elapsed / t.ticksPerMeasure);
    }
    const elapsed = note.startTick - anacrusis;
    const measureOffset = Math.floor(elapsed / t.ticksPerMeasure);
    return measureOffset - systemIndex * geo.measuresPerSystem;
  }
  const { measureOffset } = splitTick(note.startTick, t);
  return measureOffset - systemIndex * geo.measuresPerSystem;
}

/** Beat column of one note inside its system (page pt, before any chord offset). */
function getNominalNoteX(
  note: QuantizedNote,
  geo: JankoSystemGeometry,
  systemIndex: number,
  o: ResolvedJankoLayoutOptions,
  t: ResolvedJankoTokens,
  claspInsets?: JankoClaspInsetMap | null
): number {
  return getTickColumnX(note.startTick, geo, systemIndex, o, t, claspInsets);
}

/**
 * Beat column of one **tick** inside its system (page pt). The notes and the
 * Round 12 voice rests share this one function, so a rest stands on exactly the
 * proportional grid the surrounding writing uses — never on an ad-hoc offset.
 */
function getTickColumnX(
  tick: number,
  geo: JankoSystemGeometry,
  systemIndex: number,
  o: ResolvedJankoLayoutOptions,
  t: ResolvedJankoTokens,
  claspInsets?: JankoClaspInsetMap | null
): number {
  const claspInset = (measureIdx: number): number => claspInsets?.get(measureIdx) ?? 0;
  const anacrusis = t.anacrusisTicks ?? 0;
  if (systemIndex === 0 && anacrusis > 0) {
    const upbeatWidth = (anacrusis / t.ticksPerMeasure) * geo.measureWidth;
    if (tick < anacrusis) {
      const insets = getMeasureInsets(0, 0, o, t, claspInset(0));
      const left = insets.left ?? t.measureInset;
      const right = insets.right ?? t.measureInset;
      const available = Math.max(0, upbeatWidth - left - right);
      return geo.staffLeft + left + (tick / anacrusis) * available;
    }
    const elapsed = tick - anacrusis;
    const m = Math.floor(elapsed / t.ticksPerMeasure);
    const tickInMeasure = elapsed % t.ticksPerMeasure;
    const insets = getMeasureInsets(0, m + 1, o, t, claspInset(m + 1));
    const left = insets.left ?? t.measureInset;
    const right = insets.right ?? t.measureInset;
    const available = Math.max(0, geo.measureWidth - left - right);
    const measureLeft = geo.staffLeft + upbeatWidth + m * geo.measureWidth;
    return measureLeft + left + (tickInMeasure / t.ticksPerMeasure) * available;
  }

  if (anacrusis > 0) {
    const elapsed = tick - anacrusis;
    const measureOffset = Math.floor(elapsed / t.ticksPerMeasure);
    const m = measureOffset - systemIndex * geo.measuresPerSystem;
    const tickInMeasure = elapsed % t.ticksPerMeasure;
    const insets = getMeasureInsets(systemIndex, m, o, t, claspInset(m));
    const left = insets.left ?? t.measureInset;
    const right = insets.right ?? t.measureInset;
    const available = Math.max(0, geo.measureWidth - left - right);
    const measureLeft = geo.staffLeft + m * geo.measureWidth;
    return measureLeft + left + (tickInMeasure / t.ticksPerMeasure) * available;
  }

  const { measureOffset, tickInMeasure } = splitTick(tick, t);
  const measureIdx = measureOffset - systemIndex * geo.measuresPerSystem;
  return (
    geo.staffLeft +
    getTickX(
      tick,
      measureIdx,
      tickInMeasure,
      geo.measureWidth,
      t,
      getMeasureInsets(systemIndex, measureIdx, o, t, claspInset(measureIdx))
    )
  );
}

/**
 * Round 15 augmentation-dot lane: the page y of the dot that belongs to a
 * notehead at `y` whose own octave equator is `equatorY`.
 *
 * The dot always moves **off its own row** into inter-row space, on the side
 * away from the nearer staff rule: a Set A note (below its equator) dots
 * downward, a Set B note (above it) dots upward. The nearest painted rule is
 * therefore half an octave away (`rowHeight`), and the dot lands in the lane
 * between two rows where a 16th-note grid's neighbouring discs cannot reach it.
 *
 * Deterministic tie-breaks, documented once:
 * - a row exactly **on** a rule (`'on-the-line'`, `'single-line-3row'` Set A,
 *   `'bounded-channel'` Set A) dots **downward**;
 * - a row exactly midway between two rules (a contour-resolved flank) resolves
 *   against its **own octave's** equator, so the choice is a pure function of
 *   the pitch.
 *
 * Where the canonical lane would still graze a painted rule (the bounded
 * channel's `equator ± channelHalfWidth` pair), the dot steps just far enough
 * off the rule to keep `dotRadius + halfStroke + 0.25pt` of air.
 */
function resolveAugmentationDotY(
  y: number,
  equatorY: number,
  geo: JankoSystemGeometry,
  hand: Hand,
  o: ResolvedJankoLayoutOptions,
  t: ResolvedJankoTokens
): number {
  const dir = y > equatorY + EPS ? 1 : y < equatorY - EPS ? -1 : 1;
  let dotY = y + dir * t.augmentationDotRowOffset;
  const clearance = t.augmentationDotRadius + 0.375 + 0.25;
  for (let octave = 0; octave <= 8; octave++) {
    const base = geo.middleCY + getEquatorYForOctave(octave, hand, t, o);
    for (const ruleY of getEquatorRuleYs(base, o, t)) {
      const delta = dotY - ruleY;
      if (Math.abs(delta) < clearance) {
        dotY = ruleY + (delta >= 0 ? clearance : -clearance);
      }
    }
  }
  return dotY;
}

/**
 * Round 15 hard barrier: the **beat cell** of an onset — the span between the
 * two painted grid lines that bracket its nominal beat (`[pulse_i,
 * pulse_{i+1})`, with the barline at the measure's edges and the anacrusis as
 * one upbeat cell). The crowded-column policies resolve every head inside this
 * cell, so no displaced head can cross a beat pulse or a barline into another
 * beat's territory (the Round 14 bar-12 defect).
 */
function tickBeatCell(
  tick: number,
  geo: JankoSystemGeometry,
  systemIndex: number,
  o: ResolvedJankoLayoutOptions,
  t: ResolvedJankoTokens,
  measureLeft: number,
  measureWidth: number,
  claspInsets?: JankoClaspInsetMap | null
): { left: number; right: number } {
  const anacrusis = t.anacrusisTicks ?? 0;
  if (systemIndex === 0 && anacrusis > 0 && tick < anacrusis) {
    return { left: measureLeft, right: measureLeft + measureWidth };
  }
  const { tickInMeasure } = splitTick(tick, t);
  const beatTicks = Math.max(1, Math.round(t.ticksPerBeat));
  const beatIndex = Math.floor(tickInMeasure / beatTicks);
  const base = tick - tickInMeasure;
  const cellEnd = Math.min((beatIndex + 1) * beatTicks, t.ticksPerMeasure);
  return {
    // The cell's outer edges are the *grid* lines, not the note columns: a
    // measure opens on its barline and closes on the next one.
    left:
      beatIndex === 0
        ? measureLeft
        : getTickColumnX(base + beatIndex * beatTicks, geo, systemIndex, o, t, claspInsets),
    right:
      cellEnd >= t.ticksPerMeasure
        ? measureLeft + measureWidth
        : getTickColumnX(base + cellEnd, geo, systemIndex, o, t, claspInsets),
  };
}

/**
 * Position a single note inside one system (page pt coordinates).
 *
 * `flank` carries the contour-resolved side of a Set B note under a dynamic
 * layout (see `geometry.resolveChannelFlanks`); it is ignored by the two static
 * layouts (`'single-equator'`, `'on-the-line'`) and by Set A notes.
 */
export function positionJankoNote(
  note: QuantizedNote,
  geo: JankoSystemGeometry,
  systemIndex: number,
  o: ResolvedJankoLayoutOptions,
  t: ResolvedJankoTokens,
  flank?: JankoChannelFlank | null,
  claspInsets?: JankoClaspInsetMap | null
): PositionedJankoNote {
  const x = getNominalNoteX(note, geo, systemIndex, o, t, claspInsets);
  const hand = handForNote(note);
  const coord = getPitchCoordinate(
    note.pitch.pitchClass,
    note.pitch.octave,
    hand,
    t,
    o,
    flank ?? null
  );
  const y = geo.middleCY + coord.y;
  const equatorY = geo.middleCY + getEquatorYForOctave(note.pitch.octave, hand, t, o);
  return {
    note,
    coord,
    x,
    y,
    rhythm: {
      id: note.id,
      startTick: note.startTick,
      durationTicks: note.durationTicks,
      hand,
      x,
      y,
      dotY: resolveAugmentationDotY(y, equatorY, geo, hand, o, t),
    },
  };
}

// ---------------------------------------------------------------------------
// Round 12 — voice rests for the inactive spans of an active hand
// ---------------------------------------------------------------------------

/**
 * Air (pt) a rest's ink box keeps from a foreign notehead disc. Mirrors
 * `DEFAULT_JANKO_LINT_OPTIONS.minClearance` and the clasp fit rule, so a rest the
 * engine admits can never be a surprise collision.
 */
export const REST_NOTEHEAD_AIR = 1.0;

/**
 * Round 14 **guaranteed pocket air** (pt): the air the fit solver reserves
 * between a rest's ink box and every foreign notehead disc.
 *
 * `REST_NOTEHEAD_AIR` is the linter's *hard floor* — the clearance below which
 * a painted rest is a violation. Seating a rest exactly on that floor is what
 * produced the Round 13 "slid into an unreadable spot" defect: the ink grazed
 * the disc it had been pushed against. The solver therefore seats a rest in a
 * **pocket** whose air is `2 × minClearance +` the rest stroke's half-width
 * (`2.0 + 0.45 ≈ 2.4pt`), so the silence reads as its own written sign and not
 * as a hairline touch on the head it stands beside. The linter's floor is
 * unchanged — a pocket fit always satisfies it with room to spare.
 */
export const REST_POCKET_AIR = 2.4;

/**
 * Effective clearance radius (pt) the rest fit keeps around one notehead: the
 * notehead disc — or the wider Position of Honor halo ring for the tick-0
 * opening sounds, exactly as `checkRestClearance` measures it — plus the
 * guaranteed {@link REST_POCKET_AIR} and the float-safety
 * {@link REST_FIT_MARGIN}.
 */
function restClearanceRadius(
  p: PositionedJankoNote,
  t: ResolvedJankoTokens
): number {
  const glyph = isPositionOfHonor(p.note.startTick)
    ? Math.max(t.noteheadRadius, t.haloRadius + JANKO_HALO_STROKE_WIDTH / 2)
    : t.noteheadRadius;
  return glyph + REST_POCKET_AIR + REST_FIT_MARGIN;
}

/**
 * System-local measure index of an absolute tick (mirrors
 * {@link getMeasureIndexOfTick}, which needs a note).
 */
function measureIndexOfTick(
  tick: number,
  geo: JankoSystemGeometry,
  systemIndex: number,
  t: ResolvedJankoTokens
): number {
  const anacrusis = t.anacrusisTicks ?? 0;
  if (anacrusis > 0) {
    if (tick < anacrusis) return systemIndex === 0 ? 0 : -1;
    return Math.floor((tick - anacrusis) / t.ticksPerMeasure) - systemIndex * geo.measuresPerSystem;
  }
  return splitTick(tick, t).measureOffset - systemIndex * geo.measuresPerSystem;
}

/**
 * Does a rest's ink stand clear of every foreign glyph of its system?
 *
 * The rest layer is painted beneath the noteheads, so an overlap would be
 * silently half-erased rather than reported; the engine therefore admits a rest
 * only where its own {@link restInkBox} keeps {@link REST_NOTEHEAD_AIR} from
 * every notehead disc — of **both** hands, because the other hand is exactly
 * what is playing while this one is silent.
 */
export function restClearsLayout(
  rest: JankoRestGeometry,
  notes: readonly PositionedJankoNote[],
  t: ResolvedJankoTokens
): boolean {
  const box = restInkBox(rest, t);
  for (const p of notes) {
    const dx = Math.max(box.x0 - p.x, 0, p.x - box.x1);
    const dy = Math.max(box.y0 - p.y, 0, p.y - box.y1);
    if (Math.hypot(dx, dy) < t.noteheadRadius + REST_NOTEHEAD_AIR - EPS) return false;
  }
  return true;
}

/**
 * Round 13 voice contour: the page-y an onset of one hand occupies.
 *
 * A chord's tones are one vertical gesture, so their **mean** y is the voice's
 * centre at that onset; a single note is exact. `null` means the hand does not
 * sound there at all (the silence opens before the hand's first note or runs
 * past its last).
 */
function voiceYAt(
  notes: readonly PositionedJankoNote[],
  hand: Hand,
  tick: number
): number | null {
  let sum = 0;
  let count = 0;
  for (const p of notes) {
    if (p.note.startTick !== tick || handForNote(p.note) !== hand) continue;
    sum += p.y;
    count++;
  }
  return count > 0 ? sum / count : null;
}

/**
 * The **active octave equator** nearest a contour y — the register landmark a
 * one-sided rest snaps to. Octaves are walked over the full lattice (0…8), not
 * just the four staff rules, so a rest in a ledger register snaps to its own
 * ledger equator.
 */
function snapToOctaveEquator(
  y: number,
  geo: JankoSystemGeometry,
  t: ResolvedJankoTokens,
  o: ResolvedJankoLayoutOptions
): number {
  let best = y;
  let bestDistance = Infinity;
  for (let octave = 0; octave <= 8; octave++) {
    const equator = geo.middleCY + getEquatorYForOctave(octave, 'RH', t, o);
    const distance = Math.abs(equator - y);
    if (distance < bestDistance - EPS) {
      bestDistance = distance;
      best = equator;
    }
  }
  return best;
}

/**
 * Round 13: the vertical **voice contour** anchor of one rest, in page pt.
 *
 * The rest belongs to the melodic line of its own hand, so it is anchored
 * between the note that released it and the note that resumes it:
 * `y = (y_prev + y_next) / 2`. With only one neighbour (a silence that opens
 * the hand's system or closes it) the neighbour's own register speaks instead:
 * the rest snaps to its **active octave equator**. With no neighbour at all the
 * hand's canonical voice equator (RH Octave 4, LH Octave 3) is the last
 * reserve. Every value is a *target* — {@link resolveRestY} then fits it.
 */
function voiceContourTargetY(
  hand: Hand,
  releaseOnsetTick: number,
  resumeTick: number,
  notes: readonly PositionedJankoNote[],
  geo: JankoSystemGeometry,
  t: ResolvedJankoTokens,
  o: ResolvedJankoLayoutOptions
): number {
  const prevY = voiceYAt(notes, hand, releaseOnsetTick);
  const nextY = voiceYAt(notes, hand, resumeTick);
  if (prevY !== null && nextY !== null) return (prevY + nextY) / 2;
  const single = prevY ?? nextY;
  if (single !== null) return snapToOctaveEquator(single, geo, t, o);
  return geo.middleCY + getEquatorYForOctave(hand === 'RH' ? 4 : 3, hand, t, o);
}

/**
 * Extra air (pt) the fit solver keeps beyond the guaranteed
 * {@link REST_POCKET_AIR}, so a solved position can never be reported by the
 * linter's float-exact `rest-clearance` audit.
 */
export const REST_FIT_MARGIN = 0.02;

/**
 * Round 14 rest fit: seat the contour anchor in the **nearest clear pocket**.
 *
 * The ink box of a dialect is a fixed rectangle translated vertically with the
 * rest, so a notehead at `(px, py)` forbids exactly the y-interval in which the
 * box comes closer than {@link restClearanceRadius} — the glyph radius plus the
 * guaranteed {@link REST_POCKET_AIR}. The solver collects those intervals (only
 * the notes whose disc reaches the box's column band can contribute), merges
 * them and returns the legal y nearest the contour target — never the
 * sky-floating equator of Round 12, never an arbitrary snap, and never a
 * hairline graze of the very disc the pocket was carved around. Positions
 * outside the grand staff are refused, so a rest can only slide within the
 * staff it belongs to (unless its own voice sings outside it); `null` means the
 * column is walled in on both sides and the rest is **named** as unwritable
 * rather than silently dropped or slid into a collision (see
 * {@link computeJankoRestLayer}).
 */
export function resolveRestY(
  rest: JankoRestGeometry,
  notes: readonly PositionedJankoNote[],
  geo: JankoSystemGeometry,
  t: ResolvedJankoTokens
): number | null {
  const target = rest.y;
  const probe = restInkBox(rest, t);

  // Forbidden y-windows, relative to the target.
  const forbidden: Array<[number, number]> = [];
  for (const p of notes) {
    const radius = restClearanceRadius(p, t);
    const reach = p.x < probe.x0 ? probe.x0 - p.x : p.x > probe.x1 ? p.x - probe.x1 : 0;
    if (reach >= radius) continue;
    const half = Math.sqrt(Math.max(0, radius * radius - reach * reach));
    forbidden.push([p.y - half - probe.y1, p.y + half - probe.y0]);
  }
  if (forbidden.length === 0) return target;
  forbidden.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const [lo, hi] of forbidden) {
    const last = merged[merged.length - 1];
    if (last && lo <= last[1]) last[1] = Math.max(last[1], hi);
    else merged.push([lo, hi]);
  }

  // The legal set is the complement of the merged windows: choose its point
  // nearest the contour target (0 in relative coordinates), clamped to the
  // grand staff so a rest never migrates out of its own staff — unless the
  // voice itself sings outside it, in which case the contour stays reachable.
  const bandLo = Math.min(geo.staffTopY, target) - target;
  const bandHi = Math.max(geo.staffBotY, target) - target;
  const segments: Array<[number, number]> = [];
  let cursor = bandLo;
  for (const [lo, hi] of merged) {
    if (hi <= cursor) continue;
    if (lo >= bandHi) break;
    if (lo > cursor + EPS) segments.push([cursor, Math.min(lo, bandHi)]);
    cursor = Math.max(cursor, hi);
  }
  if (cursor < bandHi - EPS) segments.push([cursor, bandHi]);

  let best: number | null = null;
  for (const [a, b] of segments) {
    const candidate = a > 0 ? a : b < 0 ? b : 0;
    if (best === null || Math.abs(candidate) < Math.abs(best) - EPS) best = candidate;
  }
  if (best === null) return null;
  return target + best;
}

/**
 * One silence the engine **refused to write**, with the exact reason. Round 14:
 * a rest is never silently dropped any more — the refusal is a named
 * diagnostic the linter republishes as `rest-unwritable`, so a designer always
 * sees why a hand's silence carries no sign.
 */
export interface JankoUnwrittenRest {
  /** Absolute tick the silence opens on. */
  tick: number;
  /** Duration (ticks) of the silence. */
  durationTicks: number;
  /** Hand the silence belongs to. */
  hand: Hand;
  /** Standard value the silence has. */
  value: JankoRestGeometry['value'];
  /** Canonical beat column of the silence (page pt). */
  x: number;
  /** The voice-contour target the pocket could not honour (page pt). */
  targetY: number;
  /**
   * Why the silence is unwritten: the column is walled in on both sides
   * (`'no-pocket'`), or it opens exactly on a barline the active grid policy
   * protects (`'protected-barline'`).
   */
  reason: 'no-pocket' | 'protected-barline';
}

/** The written silences of one system plus every silence the fit rule refused. */
export interface JankoRestLayer {
  /** The rests actually painted, in engraving order. */
  rests: JankoRestGeometry[];
  /** The silences refused by the fit rule, with the reason for each. */
  unwritten: JankoUnwrittenRest[];
}

/**
 * Round 12 voice rests, anchored on the Round 13 **voice contour** and seated
 * by the Round 14 **pocket** fit.
 *
 * A hand's **inactive span inside an active measure** is written with the active
 * rest dialect: the engine walks one hand's onsets in the system, and wherever
 * the next onset starts strictly after the previous note's release *and* the
 * silence is exactly one standard rest value (`isStandardRestValue`), a rest is
 * placed on the beat column of the release — the very column the silent voice
 * would have occupied. The column is the **canonical** proportional grid column
 * (`getTickColumnX` without a clasp inset), exactly like the dashed beat pulse
 * it stands beside: the Round 5 clasp-inset widening shifts a measure's note
 * field, never the absolute grid the rest belongs to.
 *
 * - Bach Goldberg Var. 1 m. 4 is the canonical case: the RH plays 16ths up to
 *   tick 540 (digit `9`, `y = 158.5pt`), releases at 552 and resumes at 564
 *   (digit `0`, `y = 173.5pt`), while the LH enters at 552 — so a **16th rest**
 *   stands in the Right Hand at `x ≈ 545.0pt` (the tick-552 beat column) on the
 *   Octave 3 voice contour (`(158.5 + 173.5) / 2 = 166.0pt`), seated by
 *   {@link resolveRestY} in the clear pocket above the LH D3 head that shares
 *   its column, with the guaranteed {@link REST_POCKET_AIR} of air.
 * - A silence that is not a standard value (a 2.5-beat gap, a tie artefact) is
 *   left unwritten rather than approximated — that is a **non-silence**, not a
 *   refusal, so it is not reported.
 * - A rest whose ink cannot clear the noteheads of the system (either hand) in
 *   any pocket inside the staff is returned in `unwritten` by
 *   {@link resolveRestY}, exactly like a bracket the fit rule refuses.
 */
export function computeJankoRestLayer(
  score: QuantizedGridScore,
  geo: JankoSystemGeometry,
  systemIndex: number,
  o: ResolvedJankoLayoutOptions,
  t: ResolvedJankoTokens,
  notes: readonly PositionedJankoNote[]
): JankoRestLayer {
  const anacrusis = t.anacrusisTicks ?? 0;
  const startTick =
    systemIndex === 0 ? 0 : anacrusis + systemIndex * geo.measuresPerSystem * t.ticksPerMeasure;
  const endTick = anacrusis + (systemIndex + 1) * geo.measuresPerSystem * t.ticksPerMeasure;
  const sysNotes = score.notes.filter((n) => n.startTick >= startTick && n.startTick < endTick);
  const out: JankoRestGeometry[] = [];
  const unwritten: JankoUnwrittenRest[] = [];

  for (const hand of ['RH', 'LH'] as const) {
    // One release per onset: a chord is silent only when every member is.
    const release = new Map<number, number>();
    for (const n of sysNotes) {
      if (handForNote(n) !== hand) continue;
      release.set(n.startTick, Math.max(release.get(n.startTick) ?? 0, n.startTick + n.durationTicks));
    }
    const ticks = [...release.keys()].sort((a, b) => a - b);
    if (ticks.length === 0) continue;
    const activeMeasures = new Set(ticks.map((tick) => measureIndexOfTick(tick, geo, systemIndex, t)));

    for (let i = 0; i < ticks.length - 1; i++) {
      const releaseTick = release.get(ticks[i])!;
      const gap = ticks[i + 1] - releaseTick;
      if (gap <= 0 || !isStandardRestValue(gap)) continue;
      const measureIdx = measureIndexOfTick(releaseTick, geo, systemIndex, t);
      // The rest belongs to an *active* measure of this hand: the hand must own
      // at least one onset inside the measure the silence opens in.
      if (measureIdx < 0 || measureIdx >= o.measuresPerSystem) continue;
      if (!activeMeasures.has(measureIdx)) continue;
      const candidate: JankoRestGeometry = {
        tick: releaseTick,
        durationTicks: gap,
        hand,
        x: getTickColumnX(releaseTick, geo, systemIndex, o, t),
        y: voiceContourTargetY(hand, ticks[i], ticks[i + 1], notes, geo, t, o),
        value: restValueForTicks(gap),
        style: o.restStyle,
      };
      const refused = (reason: JankoUnwrittenRest['reason']): void => {
        unwritten.push({
          tick: candidate.tick,
          durationTicks: candidate.durationTicks,
          hand: candidate.hand,
          value: candidate.value,
          x: candidate.x,
          targetY: candidate.y,
          reason,
        });
      };
      // A rest never straddles a protected barline: when a silence opens exactly
      // on a measure boundary, that column belongs to the grid. The transparent
      // policy reserves nothing, so there the rest is admitted like any glyph.
      if (protectsBarlineInk(o.gridWritingPolicy)) {
        const opening = getMeasureOpeningBarlineX(measureIdx, geo, systemIndex, t);
        if (opening !== null && Math.abs(candidate.x - opening) < t.noteheadRadius + REST_NOTEHEAD_AIR) {
          refused('protected-barline');
          continue;
        }
      }
      // Round 14: the contour target is the *musical* anchor; the pocket solver
      // seats it in the nearest guaranteed-clear pocket along that voice, or
      // names the column unwritable when it is walled in on both sides.
      const y = resolveRestY(candidate, notes, geo, t);
      if (y === null) {
        refused('no-pocket');
        continue;
      }
      candidate.y = y;
      out.push(candidate);
    }
  }

  return {
    rests: out.sort((a, b) => a.tick - b.tick || (a.hand < b.hand ? -1 : 1)),
    unwritten: unwritten.sort((a, b) => a.tick - b.tick || (a.hand < b.hand ? -1 : 1)),
  };
}

/**
 * The written silences of one system (the `rests` half of
 * {@link computeJankoRestLayer}). Kept as the ergonomic read-only entry point
 * for callers that only need the painted ink.
 */
export function computeJankoRests(
  score: QuantizedGridScore,
  geo: JankoSystemGeometry,
  systemIndex: number,
  o: ResolvedJankoLayoutOptions,
  t: ResolvedJankoTokens,
  notes: readonly PositionedJankoNote[]
): JankoRestGeometry[] {
  return computeJankoRestLayer(score, geo, systemIndex, o, t, notes).rests;
}

// ---------------------------------------------------------------------------
// Row-Snapped Parity Offset (Approach 2)
// ---------------------------------------------------------------------------

/** Vertical tolerance (pt) of the exact-row and disc-clearance tests. */
const EPS = 1e-6;

/**
 * Extra air (pt) a row-displaced chord tone keeps beyond the neighbouring
 * notehead disc: `Δx ≥ 2r + 1.2pt`, i.e. 10.8pt for the canonical 4.8pt mask.
 */
export const CHORDAL_OFFSET_AIR = 1.2;

/**
 * Air (pt) a row-snapped head keeps from the nearest head of a *different*
 * onset on its own row: exactly one notehead diameter, the hard rule the
 * visual linter audits (`dx >= 2r`). It is deliberately not inflated — a dense
 * 16th grid whose columns already sit at `2r + ε` must not be nudged by a
 * solver that thinks it is 0.05pt short.
 */
export const CHORDAL_NEIGHBOUR_AIR = 0;

/**
 * Round 15 extra air (pt) of the minimal **asymmetric** crowded flank: the
 * displaced head stands `2r + 0.4pt` from the head that keeps the column, so a
 * colliding pair discloses 10.0pt in total instead of the Round 14 symmetric
 * 11.0pt — the smallest honest fan that still clears the two discs.
 */
export const CROWDED_MICRO_AIR = 0.4;

/**
 * Round 15 minimum asymmetry (pt) of an `'asymmetric-micro'` flank: even when
 * both sides are equally roomy, the cluster slides by at least this much toward
 * the deterministic right-hand side, so the policy is **never symmetric by
 * default** (the Round 14 spread it exists to replace).
 */
export const CROWDED_MIN_BIAS = 0.5;

/**
 * Round 15 cap (pt) on that slide. The bias is a *micro*-offset: it spends the
 * spare asymmetry of the two sides without eating a neighbour's column, because
 * the neighbour relief (Phase 3 of the chord-column solve) has to absorb the
 * rest of the displaced head's reach.
 */
export const CROWDED_MICRO_BIAS = 1.0;

/**
 * Effective horizontal displacement (pt) between two same-row chord tones of
 * one onset.
 *
 * `tokens.chordalOffset` (11.0pt by default) is authoritative, but it is never
 * allowed to fall below `2 * noteheadRadius + 1.2pt`: a designer who enlarges
 * the knockout disc must not silently re-open the collision the offset exists
 * to remove.
 */
export function getChordalOffset(tokens?: Partial<JankoTokens> | null): number {
  const t = resolveJankoTokens(tokens);
  return Math.max(t.chordalOffset, 2 * t.noteheadRadius + CHORDAL_OFFSET_AIR);
}

/** One whole-tone row of one onset: the heads that must share a horizontal slot. */
interface RowCluster {
  /** Exact notehead-centre y of the row. */
  y: number;
  /** Row key (`y` to 1e-3 pt) used by the neighbour chains. */
  key: string;
  /** The heads of this onset sitting on that row, pitch ascending. */
  notes: PositionedJankoNote[];
  /**
   * Resolved horizontal offsets (page pt, signed) of this row's heads from the
   * onset column: the symmetric `±(K-1)·Δx/2` fan under
   * `'symmetric-spread'`, the policy's asymmetric flank under the two Round 15
   * crowded-column policies (see {@link resolveCrowdedRowOffsets}).
   */
  minOffset: number;
  maxOffset: number;
}

/** Every head of one onset, grouped by the whole-tone row it occupies. */
interface OnsetUnit {
  tick: number;
  /** Beat column before the row-snapped pass (page pt). */
  nominalX: number;
  /** Measure index inside the system, for the measure's inset band. */
  measureIdx: number;
  rows: RowCluster[];
  /** Resolved translation of the whole column (page pt, 0 = on the beat). */
  shift: number;
  /** True when at least one row of this onset carries a displaced pair. */
  spread: boolean;
  /** Left/right edge (page pt) the column's heads must stay inside. */
  bandLeft: number;
  bandRight: number;
  /**
   * Round 15 hard barrier: the **beat cell** of this onset — the span between
   * the two painted grid lines that bracket its nominal beat (`[pulse_i,
   * pulse_{i+1})`, a barline at the measure edges). No head of the unit may
   * leave this cell, so a displaced head can never cross a beat pulse or a
   * barline into another beat's territory.
   */
  cellLeft: number;
  cellRight: number;
  /** Absolute x of the measure's left edge (its opening barline, when any). */
  measureLeft: number;
  /** True when this onset carries an external left clasp (chord grouping). */
  clasp: boolean;
  /** Distance (pt) from the unit's leftmost head centre to the clasp spine. */
  claspReach: number;
  /**
   * Offset (pt) from the onset's column to the left edge of the clasp's ink box
   * (`claspInkBox.x0 − columnX`): the barline-air constraint of
   * {@link windowOf} steps the column right by exactly this much.
   */
  claspInkLeft: number;
  /** Top edge (page pt) of the clasp bracket. */
  claspTop: number;
  /** Bottom edge (page pt) of the clasp bracket. */
  claspBot: number;
}

/**
 * Air (pt) a clasp spine keeps from a foreign notehead disc. Greater than the
 * linter's `minClearance`, so every layout the solver settles is also
 * linter-clean.
 */
export const CLASP_NOTEHEAD_AIR = 1.2;

/** Floating-point tolerance (pt) of the clasp's barline-air tests. */
export const CLASP_EPS = 1e-6;

/**
 * Measures whose **downbeat onset** carries a chord/cluster reserve a wider
 * left inset, so the external clasp of that downbeat keeps
 * `tokens.claspMinBarlineAir` of air from the barline it follows
 * (`claspX ≥ measureLeft + claspMinBarlineAir`).
 *
 * The reservation is **per paradigm**: the union paradigms
 * (`'left-clasp-spire'` / `'beamed-clasp-rail'` / `'bounding-phrase'`) bracket
 * the whole onset, so any two simultaneous heads drive it; the Round 6
 * `'per-hand-clasp'` brackets **one hand's** qualifying group, so a cross-hand
 * downbeat — the ordinary two-voice opening of a measure — reserves nothing.
 * Counting the cross-hand pair would shift the whole measure right for a
 * bracket that is never engraved (the Round 14 golden-master defect this
 * predicate exists to prevent).
 *
 * The map is keyed by the system-local measure index used by
 * {@link getMeasureIndexOfTick} (0-based, except on an anacrusis system where
 * the upbeat occupies slot 0 and the first full measure slot 1).
 */
export function computeClaspInsetMap(
  score: QuantizedGridScore,
  geo: JankoSystemGeometry,
  systemIndex: number,
  o: ResolvedJankoLayoutOptions,
  t: ResolvedJankoTokens
): JankoClaspInsetMap {
  const map = new Map<number, number>();
  if (!usesChordClasps(o.chordGrouping)) return map;
  const anacrusis = t.anacrusisTicks ?? 0;
  const startTick =
    systemIndex === 0 ? 0 : anacrusis + systemIndex * geo.measuresPerSystem * t.ticksPerMeasure;
  const endTick = anacrusis + (systemIndex + 1) * geo.measuresPerSystem * t.ticksPerMeasure;
  const perHand = o.chordGrouping === 'per-hand-clasp';

  // Every onset of the system, bucketed by its system-local measure index.
  const byMeasure = new Map<number, Map<number, QuantizedNote[]>>();
  for (const note of score.notes) {
    if (note.startTick < startTick || note.startTick >= endTick) continue;
    const measureIdx = getMeasureIndexOfTick(note, geo, systemIndex, t);
    let ticks = byMeasure.get(measureIdx);
    if (!ticks) {
      ticks = new Map<number, QuantizedNote[]>();
      byMeasure.set(measureIdx, ticks);
    }
    const bucket = ticks.get(note.startTick);
    if (bucket) bucket.push(note);
    else ticks.set(note.startTick, [note]);
  }

  for (const [measureIdx, ticks] of byMeasure) {
    const firstTick = Math.min(...ticks.keys());
    const onset = ticks.get(firstTick) ?? [];
    const qualifies = perHand
      ? perHandDownbeatQualifies(onset)
      : onset.length >= 2;
    if (!qualifies) continue;
    // Only a true downbeat can drive the clasp onto the opening barline.
    if (splitTick(firstTick, t).tickInMeasure !== 0) continue;
    map.set(measureIdx, getClaspDownbeatInset(t));
  }
  return map;
}

/**
 * Does one hand of this downbeat onset qualify for a
 * `'per-hand-clasp'` bracket — the same predicate `handClaspGroups` applies
 * after the row-snapped solve, evaluated on the raw score: a hand's group needs
 * {@link CLASP_MIN_VERTICAL_CHORD} heads, or two heads sharing one whole-tone
 * row (which the parity offset will spread, making the bracket reach for the
 * displaced pair). A clean two-note vertical stack and a lone melodic note
 * never qualify.
 */
function perHandDownbeatQualifies(notes: readonly QuantizedNote[]): boolean {
  const byHand = new Map<Hand, QuantizedNote[]>();
  for (const note of notes) {
    const hand = handForNote(note);
    const bucket = byHand.get(hand);
    if (bucket) bucket.push(note);
    else byHand.set(hand, [note]);
  }
  for (const group of byHand.values()) {
    if (group.length >= CLASP_MIN_VERTICAL_CHORD) return true;
    // Two heads share a whole-tone row iff they share the octave and the
    // pitch-class parity (the row's `(octave, rank)` identity).
    const rows = new Set(group.map((n) => `${n.pitch.octave}|${n.pitch.pitchClass % 2}`));
    if (rows.size < group.length) return true;
  }
  return false;
}

/**
 * Row-Snapped Parity Offset of one system (Approach 2).
 *
 * **The rule.** Two heads at the same `startTick` that resolve to the same
 * `(octave, rank)` share one lattice point: the same `y` by construction, and —
 * before this pass — the same `x` as well, so the later white knockout erases
 * the earlier digit. Every such group of `K ≥ 2` heads is sorted by pitch
 * ascending and spread symmetrically around its onset's column:
 *
 * ```
 * x_i = x_onset + (i - (K - 1) / 2) · Δx_chord,   Δx_chord = getChordalOffset(tokens)
 * ```
 *
 * So a two-note collision becomes the symmetric pair `x ∓ Δx/2` and a three-note
 * collision the triplet `x − Δx, x, x + Δx`. Heads on **different** rows of the
 * same onset keep one shared column, which is what preserves the isomorphic
 * ∇ / Δ hand shapes of the staff.
 *
 * **The column solve.** A displaced head claims real horizontal room, and in
 * dense writing the neighbouring onset of its own row is only one 16th away.
 * The onset is therefore treated as one unit whose column may be translated as
 * a whole — never sheared, so the chord keeps its shape — in two phases:
 *
 * 1. **Spread columns** place themselves against the *nominal* beat grid: the
 *    symmetric placement is kept (`shift = 0`) whenever every head still clears
 *    its row neighbours by `2r` and stays inside the measure's `measureInset`
 *    band; otherwise the column slides to the nearest legal position. In
 *    practice this makes a crowded chord take the air from whichever side has
 *    it (a spreading downbeat chord slides right, off the barline).
 * 2. **Plain columns** that the spread ones have crowded step away by exactly
 *    the missing air — the local spacing relief a real engraver applies around
 *    a displaced second.
 *
 * Every step is one-directional (a column only ever moves away from a
 * violation), so the pass is deterministic, order-stable and terminating.
 * Whatever still cannot fit — a three-note row cluster squeezed between two
 * 16ths that are themselves out of room — is left for the visual linter to
 * name (`chordal-overlap` / `notehead-overlap`) instead of being hidden.
 *
 * Round 5 adds a third kind of column: a **clasped** cluster (two or more
 * simultaneous heads) claims the `r + claspOffset` its external bracket needs on
 * the left, and the fit rule (see {@link resolveChordColumns}) drops any bracket
 * that cannot stand clear of its neighbours.
 */
export function resolveRowSnappedChordOffsets(
  notes: readonly PositionedJankoNote[],
  geo: JankoSystemGeometry,
  systemIndex: number,
  o: ResolvedJankoLayoutOptions,
  t: ResolvedJankoTokens,
  claspInsets?: JankoClaspInsetMap | null
): PositionedJankoNote[] {
  return resolveChordColumns(notes, geo, systemIndex, o, t, claspInsets).notes;
}

/** Result of the chord-column solve: the notes plus the clasps that survived. */
export interface JankoChordColumnResolution {
  /** Notes with their final horizontal positions. */
  notes: PositionedJankoNote[];
  /** Ticks of the onsets whose cluster carries a left clasp after the fit rule. */
  claspTicks: ReadonlySet<number>;
}

/** Full result of the chord-column solve (see {@link resolveRowSnappedChordOffsets}). */
export function resolveChordColumns(
  notes: readonly PositionedJankoNote[],
  geo: JankoSystemGeometry,
  systemIndex: number,
  o: ResolvedJankoLayoutOptions,
  t: ResolvedJankoTokens,
  claspInsets?: JankoClaspInsetMap | null
): JankoChordColumnResolution {
  const delta = getChordalOffset(t);
  const gap = 2 * t.noteheadRadius + CHORDAL_NEIGHBOUR_AIR;
  const claspsActive = usesChordClasps(o.chordGrouping);
  const perHandClasps = o.chordGrouping === 'per-hand-clasp';
  const claspReach = t.noteheadRadius + t.claspOffset;
  // Round 15 crowded-column grammar (see `JankoCrowdedColumnPolicy`).
  const asymmetricCrowding = o.crowdedColumn !== 'symmetric-spread';
  const stemAnchored = o.crowdedColumn === 'stem-anchored';
  const microGap = 2 * t.noteheadRadius + CROWDED_MICRO_AIR;

  // -------------------------------------------------------------------------
  // 1. Partition the system into onset units, each split into row clusters.
  // -------------------------------------------------------------------------
  const unitByTick = new Map<number, OnsetUnit>();
  const clusterByRow = new Map<string, RowCluster>();
  for (const p of notes) {
    let unit = unitByTick.get(p.note.startTick);
    if (!unit) {
      const measureIdx = getMeasureIndexOfTick(p.note, geo, systemIndex, t);
      const insets = getMeasureInsets(
        systemIndex,
        measureIdx,
        o,
        t,
        claspInsets?.get(measureIdx) ?? 0
      );
      const anacrusis = t.anacrusisTicks ?? 0;
      let measureLeft = geo.staffLeft + measureIdx * geo.measureWidth;
      let mWidth = geo.measureWidth;
      if (systemIndex === 0 && anacrusis > 0) {
        const upbeatWidth = (anacrusis / t.ticksPerMeasure) * geo.measureWidth;
        if (p.note.startTick < anacrusis) {
          measureLeft = geo.staffLeft;
          mWidth = upbeatWidth;
        } else {
          const m = measureIdx - 1;
          measureLeft = geo.staffLeft + upbeatWidth + m * geo.measureWidth;
        }
      }
      const cell = tickBeatCell(
        p.note.startTick,
        geo,
        systemIndex,
        o,
        t,
        measureLeft,
        mWidth,
        claspInsets
      );
      unit = {
        tick: p.note.startTick,
        nominalX: p.x,
        measureIdx,
        rows: [],
        shift: 0,
        spread: false,
        bandLeft: measureLeft + (insets.left ?? t.measureInset),
        bandRight: measureLeft + mWidth - (insets.right ?? t.measureInset),
        cellLeft: cell.left,
        cellRight: cell.right,
        measureLeft,
        clasp: false,
        claspReach,
        claspInkLeft: -claspReach,
        claspTop: p.y - t.noteheadRadius,
        claspBot: p.y + t.noteheadRadius,
      };
      unitByTick.set(p.note.startTick, unit);
    }
    const rowKey = (p.y + 0).toFixed(3);
    let cluster = clusterByRow.get(`${p.note.startTick}|${rowKey}`);
    if (!cluster) {
      cluster = { y: p.y, key: rowKey, notes: [], minOffset: 0, maxOffset: 0 };
      clusterByRow.set(`${p.note.startTick}|${rowKey}`, cluster);
      unit.rows.push(cluster);
    }
    cluster.notes.push(p);
  }

  // Pitch ascending inside every cluster; the id breaks exact unisons
  // deterministically, so the engraving stays a pure function of the score.
  for (const cluster of clusterByRow.values()) {
    cluster.notes.sort(
      (a, b) =>
        a.coord.octave * 12 + a.coord.pitchClass - (b.coord.octave * 12 + b.coord.pitchClass) ||
        (a.note.id < b.note.id ? -1 : a.note.id > b.note.id ? 1 : 0)
    );
  }
  const units = [...unitByTick.values()];

  // -------------------------------------------------------------------------
  // 1a. Round 15 crowded-column placement.
  //
  //     A row that carries two heads of one onset must fan them out. Three
  //     policies answer how (see `JankoCrowdedColumnPolicy`):
  //
  //     * `'symmetric-spread'` — the Round 14 control: the heads straddle the
  //       column at `∓Δx/2` and the whole column translates until they fit;
  //     * `'stem-anchored'` — the RH head (when the row is mixed-hand) keeps
  //       the nominal beat-x, the displaced head takes the roomier side at the
  //       minimal `2r + 0.4pt` flank, and the column itself never translates:
  //       a neighbour yields instead;
  //     * `'asymmetric-micro'` — the same minimal flank, slid toward the roomy
  //       side by a micro-bias (never symmetric by default); the column may
  //       still take a small residual shift.
  //
  //     Hard barriers (both Round 15 policies): every head stays inside its
  //     own **beat cell** — the span between the two neighbouring painted grid
  //     lines — so a displaced head can never cross a beat pulse or a barline
  //     into another beat's territory.
  // -------------------------------------------------------------------------
  const offsetsById = new Map<string, number>();
  const byX = [...units].sort((a, b) => a.nominalX - b.nominalX || a.tick - b.tick);
  byX.forEach((unit, index) => {
    const prevX = index > 0 ? byX[index - 1].nominalX : Number.NEGATIVE_INFINITY;
    const nextX = index + 1 < byX.length ? byX[index + 1].nominalX : Number.POSITIVE_INFINITY;
    const leftReach = Math.min(unit.nominalX - prevX, unit.nominalX - unit.cellLeft);
    const rightReach = Math.min(nextX - unit.nominalX, unit.cellRight - unit.nominalX);
    for (const cluster of unit.rows) {
      const k = cluster.notes.length;
      if (k < 2) {
        cluster.minOffset = 0;
        cluster.maxOffset = 0;
        offsetsById.set(cluster.notes[0].note.id, 0);
        continue;
      }
      let offsets: number[];
      if (!asymmetricCrowding) {
        offsets = cluster.notes.map((_, i) => (i - (k - 1) / 2) * delta);
      } else {
        // The head that keeps the nominal beat-x: an RH tone when the row is
        // mixed-hand under `'stem-anchored'`, otherwise the middle head.
        let anchor = Math.floor((k - 1) / 2);
        if (stemAnchored) {
          const rh = cluster.notes.findIndex((p) => p.rhythm.hand === 'RH');
          if (rh >= 0) anchor = rh;
        }
        // The flank must clear whatever glyph the heads actually wear: a tick-0
        // sound carries the wider Position of Honor ring, and two rings may
        // never cut into each other's knockout either.
        const glyphRadius = (p: PositionedJankoNote): number =>
          isPositionOfHonor(p.note.startTick)
            ? Math.max(t.noteheadRadius, t.haloRadius + JANKO_HALO_STROKE_WIDTH / 2)
            : t.noteheadRadius;
        let clusterGap = microGap;
        for (let i = 1; i < k; i++) {
          clusterGap = Math.max(
            clusterGap,
            glyphRadius(cluster.notes[i - 1]) + glyphRadius(cluster.notes[i]) + CROWDED_MICRO_AIR
          );
        }
        // The fan extends toward the roomier side. When the anchor sits right of
        // the cluster's centre the direction must mirror, so the *bulk* of the
        // heads — not the raw index order — leans into the open space.
        const roomier: 1 | -1 = rightReach >= leftReach ? 1 : -1;
        const anchorLean = Math.sign((k - 1) / 2 - anchor);
        let dir: 1 | -1 = anchorLean < 0 ? (-roomier as 1 | -1) : roomier;
        let bias = 0;
        if (!stemAnchored) {
          bias = (rightReach - leftReach) / 2;
          bias = Math.max(-CROWDED_MICRO_BIAS, Math.min(CROWDED_MICRO_BIAS, bias));
          if (Math.abs(bias) < CROWDED_MIN_BIAS) bias = CROWDED_MIN_BIAS * roomier;
        }
        const fan = (d: 1 | -1, b: number): number[] =>
          cluster.notes.map((_, i) => (i - anchor) * clusterGap * d + b);
        offsets = fan(dir, bias);
        // Hard barrier: mirror first (the exact fan about the anchor, so the
        // anchored head keeps the column), then slide, then centre — never a
        // head outside the beat cell.
        const cellLo = unit.cellLeft - unit.nominalX;
        const cellHi = unit.cellRight - unit.nominalX;
        const lo = Math.min(...offsets);
        const hi = Math.max(...offsets);
        if (lo < cellLo - EPS || hi > cellHi + EPS) {
          const mirrored = fan(-dir as 1 | -1, -bias);
          const fLo = Math.min(...mirrored);
          const fHi = Math.max(...mirrored);
          if (fLo >= cellLo - EPS && fHi <= cellHi + EPS) {
            offsets = mirrored;
            dir = -dir as 1 | -1;
          } else {
            const width = hi - lo;
            const room = cellHi - cellLo;
            const target =
              room >= width
                ? Math.max(cellLo - lo, Math.min(cellHi - hi, 0))
                : (room - width) / 2 - lo;
            offsets = offsets.map((o) => o + target);
          }
        }
      }
      cluster.minOffset = Math.min(...offsets);
      cluster.maxOffset = Math.max(...offsets);
      cluster.notes.forEach((p, i) => offsetsById.set(p.note.id, offsets[i]));
    }
  });

  /** Row-snapped horizontal offset (page pt) of every head of one onset unit. */
  const rowOffsetOf = (unit: OnsetUnit): Map<string, number> => {
    const offsets = new Map<string, number>();
    for (const cluster of unit.rows) {
      for (const p of cluster.notes) offsets.set(p.note.id, offsetsById.get(p.note.id) ?? 0);
    }
    return offsets;
  };

  /**
   * Round 6/8 — the hand groups of one onset that qualify for a per-hand clasp:
   * two or more heads of **one** hand, either horizontally displaced by the
   * row-snapped parity offset or forming a vertical chord of three or more.
   * A clean 2-note vertical column is never grouped, and the two hands of the
   * grand staff are never merged into one bracket.
   */
  const handClaspGroups = (unit: OnsetUnit): PositionedJankoNote[][] => {
    const offsets = rowOffsetOf(unit);
    const byHand = new Map<Hand, PositionedJankoNote[]>();
    for (const cluster of unit.rows) {
      for (const p of cluster.notes) {
        const group = byHand.get(p.rhythm.hand);
        if (group) group.push(p);
        else byHand.set(p.rhythm.hand, [p]);
      }
    }
    const qualified: PositionedJankoNote[][] = [];
    for (const group of byHand.values()) {
      const displaced = group.map((p) => ({ ...p.rhythm, x: offsets.get(p.note.id) ?? 0 }));
      if (claspQualifies(displaced)) qualified.push(group);
    }
    return qualified;
  };

  for (const unit of units) {
    unit.spread = unit.rows.some((cluster) => cluster.maxOffset > cluster.minOffset + EPS);
    if (perHandClasps) {
      const groups = handClaspGroups(unit);
      unit.clasp = claspsActive && groups.length > 0;
      if (unit.clasp) {
        const members = groups.flat();
        unit.claspTop = Math.min(...members.map((p) => p.y)) - t.noteheadRadius;
        unit.claspBot = Math.max(...members.map((p) => p.y)) + t.noteheadRadius;
        const offsets = rowOffsetOf(unit);
        for (const group of groups) {
          const geometry = computeClaspGeometry(
            group.map((p) => ({ ...p.rhythm, x: p.x + (offsets.get(p.note.id) ?? 0) })),
            t,
            { claspDurationStyle: o.claspDurationStyle }
          );
          if (geometry) {
            unit.claspInkLeft = Math.min(
              unit.claspInkLeft,
              claspInkBox(geometry, t).x0 - unit.nominalX
            );
          }
        }
      }
      continue;
    }
    // A chord/cluster (two or more simultaneous heads) is clasped; a lone
    // melodic note never is.
    const size = unit.rows.reduce((sum, cluster) => sum + cluster.notes.length, 0);
    unit.clasp = claspsActive && size >= 2;
    if (unit.clasp) {
      unit.claspTop = unit.rows.reduce((min, c) => Math.min(min, c.y), Infinity) - t.noteheadRadius;
      unit.claspBot = unit.rows.reduce((max, c) => Math.max(max, c.y), -Infinity) + t.noteheadRadius;
      const geometry = computeClaspGeometry(
        unit.rows.flatMap((cluster) => cluster.notes.map((p) => p.rhythm)),
        t,
        { claspDurationStyle: o.claspDurationStyle }
      );
      if (geometry) unit.claspInkLeft = claspInkBox(geometry, t).x0 - unit.nominalX;
    }
  }

  // -------------------------------------------------------------------------
  // 1b. Fit rule. An external bracket protrudes `r + claspOffset` (7.6pt) to
  //     the left of its cluster, which a continuous 16th-note grid — whose
  //     columns sit exactly one disc diameter apart — cannot host. A clasp is
  //     therefore engraved only where it stands clear of every foreign disc and
  //     of its opening barline; everywhere else the cluster keeps its
  //     traditional stems. This is what "only actual chords receive clasps,
  //     never feathers" means in practice.
  //
  //     Round 7 refines two points:
  //     * the bracket's barline air is a **column constraint**, not a veto — a
  //       downbeat clasp whose measure inset had to be withdrawn steps its whole
  //       column right (see `windowOf`) instead of silently losing the bracket;
  //     * the other hand's heads **of the same onset** travel with that column
  //       and are not foreign ink: they only have to stay clear of the bracket
  //       (no overlap, see `claspForeignAir`).
  // -------------------------------------------------------------------------
  const claspFits = (unit: OnsetUnit): boolean => {
    // The Round 6 per-hand paradigm audits each hand's own bracket — a bracket
    // never spans the grand staff — while the Round 5 paradigms audit the one
    // union bracket of the onset.
    const groups = perHandClasps
      ? handClaspGroups(unit)
      : [unit.rows.flatMap((cluster) => cluster.notes)];
    const offsets = perHandClasps ? rowOffsetOf(unit) : null;
    /** A head of this onset as the row-snapped column will place it. */
    const displacedX = (p: PositionedJankoNote): number =>
      p.x + (offsets?.get(p.note.id) ?? 0);
    for (const members of groups) {
      // `handClaspGroups` has already accepted only horizontally displaced hand
      // clusters (in row-offset space; the heads still share their nominal
      // column here, before the solve).
      const geometry = computeClaspGeometry(
        members.map((p) => p.rhythm),
        t,
        { claspDurationStyle: o.claspDurationStyle }
      );
      if (!geometry) return false;
      // Disc clearance is relative ink: every head of one onset moves with the
      // same column shift, so the row-snapped spread is measured directly.
      const spreadGeometry =
        offsets === null
          ? geometry
          : computeClaspGeometry(
              members.map((p) => ({ ...p.rhythm, x: displacedX(p) })),
              t,
              { claspDurationStyle: o.claspDurationStyle }
            );
      const disk = claspInkBox(spreadGeometry ?? geometry, t);
      for (const other of units) {
        for (const cluster of other.rows) {
          for (const p of cluster.notes) {
            // A per-hand bracket treats the other hand's heads of its own onset
            // as positioned ink that travels with the column, never as a
            // foreign collision (unless the discs actually overlap).
            if (other === unit && members.includes(p)) continue;
            const px = other === unit ? displacedX(p) : p.x;
            const dx = Math.max(disk.x0 - px, 0, px - disk.x1);
            const dy = Math.max(disk.y0 - p.y, 0, p.y - disk.y1);
            const air = other === unit ? 0 : CLASP_NOTEHEAD_AIR;
            if (Math.hypot(dx, dy) < t.noteheadRadius + air - CLASP_EPS) return false;
          }
        }
      }
    }
    return true;
  };
  if (units.some((unit) => unit.clasp)) {
    for (const unit of units) {
      if (unit.clasp && !claspFits(unit)) unit.clasp = false;
    }
  }
  const hasClasp = units.some((unit) => unit.clasp);
  // Fast path: a system with neither a same-row chord tone nor a clasp cannot
  // move a single column, so the whole column solve is skipped. The Round 15
  // stem-fusion guard still runs: a cross-hand pair may share its column
  // without any row collision at all (the Round 14 bars 13/14 defect).
  if (!units.some((unit) => unit.spread || unit.clasp)) {
    const untouched = notes.map((p) => {
      const unit = unitByTick.get(p.note.startTick);
      return unit
        ? {
            ...p,
            nominalX: unit.nominalX,
            beatCell: { left: unit.cellLeft, right: unit.cellRight },
          }
        : p;
    });
    if (asymmetricCrowding) applyStemFusionStagger(untouched, t);
    return { notes: untouched, claspTicks: new Set<number>() };
  }

  const r = t.noteheadRadius;
  const maxAbsOffset = units.reduce(
    (acc, unit) =>
      unit.rows.reduce((a, c) => Math.max(a, -c.minOffset, c.maxOffset), acc),
    0
  );
  /** Columns further apart than this can never touch, whatever their rows. */
  const reach =
    2 * maxAbsOffset + 2 * r + delta + (hasClasp ? claspReach + CLASP_NOTEHEAD_AIR : 0);

  /**
   * Horizontal air two clusters owe each other: `2r` when they share a row,
   * less when their rows are close but distinct (the bounded channel puts two
   * flanks only 4pt apart), and no constraint at all once the rows are a full
   * disc apart — vertical separation alone then keeps the glyphs clear.
   */
  const separation = (a: RowCluster, b: RowCluster): number | null => {
    const dy = Math.abs(a.y - b.y);
    if (dy >= 2 * r - EPS) return null;
    return Math.sqrt(Math.max(0, 4 * r * r - dy * dy)) + CHORDAL_NEIGHBOUR_AIR;
  };

  /**
   * Onsets whose columns are close enough to interact. The columns are sorted
   * once by beat position and each unit only walks the neighbours inside
   * `reach`, so the map costs `O(n · k)` instead of a full pairwise scan.
   */
  const byBeat = [...units].sort((a, b) => a.nominalX - b.nominalX || a.tick - b.tick);
  const neighboursByUnit = new Map<OnsetUnit, OnsetUnit[]>();
  for (let i = 0; i < byBeat.length; i++) {
    const unit = byBeat[i];
    const list: OnsetUnit[] = [];
    for (let j = i - 1; j >= 0 && unit.nominalX - byBeat[j].nominalX <= reach; j--) {
      list.push(byBeat[j]);
    }
    for (let j = i + 1; j < byBeat.length && byBeat[j].nominalX - unit.nominalX <= reach; j++) {
      list.push(byBeat[j]);
    }
    neighboursByUnit.set(unit, list);
  }

  const columnX = (unit: OnsetUnit): number => unit.nominalX + unit.shift;

  /**
   * Air this column is missing against one neighbour, signed: `> 0` when the
   * column must step right (the neighbour is on its left), `< 0` when it must
   * step left, `0` when the two already clear each other. The worst (largest
   * magnitude) row pair of the two onsets wins.
   */
  const shortfallFrom = (unit: OnsetUnit, other: OnsetUnit): number => {
    let worst = 0;
    const otherIsLeft = other.nominalX < unit.nominalX;
    for (const cluster of unit.rows) {
      for (const theirs of other.rows) {
        const needed = separation(cluster, theirs);
        if (needed === null) continue;
        const gap = otherIsLeft
          ? columnX(unit) +
            cluster.minOffset -
            (columnX(other) + theirs.maxOffset)
          : columnX(other) +
            theirs.minOffset -
            (columnX(unit) + cluster.maxOffset);
        const shortfall = Math.max(0, needed - gap) * (otherIsLeft ? 1 : -1);
        if (Math.abs(shortfall) > Math.abs(worst)) worst = shortfall;
      }
    }
    return worst;
  };

  /** Extreme resolved offsets of one unit's heads (page pt, signed). */
  const unitMinOffset = (u: OnsetUnit): number =>
    u.rows.reduce((acc, c) => Math.min(acc, c.minOffset), 0);
  const unitMaxOffset = (u: OnsetUnit): number =>
    u.rows.reduce((acc, c) => Math.max(acc, c.maxOffset), 0);
  const MIN_TIME_AIR = 1.0;

  /** Legal translation window of one column against the *current* neighbours. */
  const windowOf = (unit: OnsetUnit): { lo: number; hi: number } => {
    let lo = Number.NEGATIVE_INFINITY;
    let hi = Number.POSITIVE_INFINITY;
    const myMin = unitMinOffset(unit);
    const myMax = unitMaxOffset(unit);

    for (const other of neighboursByUnit.get(unit)!) {
      const shortfall = shortfallFrom(unit, other);
      if (shortfall > 0) {
        lo = Math.max(lo, unit.shift + shortfall);
      } else if (shortfall < 0) {
        // A plain column on the right yields rightward in Phase 3; only another spread column caps hi
        if (other.spread || other.nominalX < unit.nominalX) {
          hi = Math.min(hi, unit.shift + shortfall);
        }
      }
    }

    // The external clasp hangs left of this cluster: its spine must clear every
    // glyph of a left-hand column that shares the clasp's vertical band. The
    // whole column then steps right just far enough to give the bracket air —
    // the same one-directional relief a row-snapped pair receives.
    if (unit.clasp) {
      for (const other of neighboursByUnit.get(unit)!) {
        if (other.nominalX >= unit.nominalX) continue;
        for (const cluster of other.rows) {
          if (cluster.y + r < unit.claspTop || cluster.y - r > unit.claspBot) continue;
          const rightEdge = columnX(other) + cluster.maxOffset;
          lo = Math.max(
            lo,
            rightEdge + r + CLASP_NOTEHEAD_AIR + myMax + unit.claspReach - unit.nominalX
          );
        }
      }
      // Round 7: the bracket's own barline air is a column constraint too. When
      // a downbeat clasp could not keep its measure inset (the demotion loop in
      // `layoutJankoSystem` withdrew the widening), the column steps right just
      // far enough for the spine to clear the opening barline instead of the
      // bracket being silently dropped.
      if (unit.measureIdx > 0) {
        lo = Math.max(
          lo,
          unit.measureLeft + t.claspMinBarlineAir - (unit.nominalX + unit.claspInkLeft)
        );
      }
    }

    // Strict horizontal time monotonicity: a note at a later onset must never be placed to the left of an earlier onset
    for (const prev of ordered) {
      if (prev.tick >= unit.tick) break;
      const prevXRight = columnX(prev) + unitMaxOffset(prev);
      lo = Math.max(lo, prevXRight + MIN_TIME_AIR - myMin - unit.nominalX);
    }
    for (let i = ordered.length - 1; i >= 0; i--) {
      const next = ordered[i];
      if (next.tick <= unit.tick) break;
      if (next.spread || next.clasp) {
        const nextXLeft = columnX(next) + unitMinOffset(next);
        hi = Math.min(hi, nextXLeft - MIN_TIME_AIR - myMax - unit.nominalX);
      }
    }

    // The measure band and — under the two Round 15 policies — the beat cell
    // are structural: a spread downbeat chord may never be driven onto the
    // preceding barline, and no head may leave the beat cell of its own column.
    // The `'symmetric-spread'` control keeps the Round 14 window verbatim so it
    // stays the honest baseline the new checks exist to measure.
    for (const cluster of unit.rows) {
      lo = Math.max(lo, unit.bandLeft - cluster.minOffset - unit.nominalX);
      hi = Math.min(hi, unit.bandRight - cluster.maxOffset - unit.nominalX);
      if (asymmetricCrowding) {
        lo = Math.max(lo, unit.cellLeft - cluster.minOffset - unit.nominalX);
        hi = Math.min(hi, unit.cellRight - cluster.maxOffset - unit.nominalX);
      }
    }
    return { lo, hi: Math.max(lo, hi) };
  };

  const ordered = [...units].sort((a, b) => a.tick - b.tick);

  // -------------------------------------------------------------------------
  // 2. Spread and clasped columns first: keep the resolved placement whenever
  //    it is legal. Under `'stem-anchored'` a spread column never translates —
  //    the beat-x spine is the policy's whole point — while a clasped column
  //    still takes the air its bracket needs.
  // -------------------------------------------------------------------------
  for (const unit of ordered) {
    if (!unit.spread && !unit.clasp) continue;
    if (stemAnchored && !unit.clasp) continue;
    const { lo, hi } = windowOf(unit);
    if (lo <= 0 && 0 <= hi) continue;
    // Over-constrained: split the residual displacement evenly rather than
    // dumping it all on one side.
    unit.shift = lo <= hi ? Math.max(lo, Math.min(hi, 0)) : lo;
  }

  // -------------------------------------------------------------------------
  // 3. Plain columns yield the air a spread or clasped neighbour needs. A
  //    column only ever steps *away* from a violation, so this cannot
  //    oscillate; a clasped column was already placed against its bracket air
  //    in Phase 2 and is never nudged back onto a glyph.
  // -------------------------------------------------------------------------
  for (let pass = 0; pass < 5; pass++) {
    let moved = false;
    for (const unit of ordered) {
      if (unit.spread || unit.clasp) continue;
      let pushRight = 0;
      let pushLeft = 0;
      for (const other of neighboursByUnit.get(unit)!) {
        const shortfall = shortfallFrom(unit, other);
        if (shortfall > 0) pushRight = Math.max(pushRight, shortfall);
        else if (shortfall < 0) pushLeft = Math.max(pushLeft, -shortfall);
      }

      // Enforce chronological monotonicity: unit must clear any earlier onset
      for (const prev of ordered) {
        if (prev.tick >= unit.tick) break;
        const prevXRight = columnX(prev) + unitMaxOffset(prev);
        const timeShortfall = prevXRight + MIN_TIME_AIR - unitMinOffset(unit) - columnX(unit);
        if (timeShortfall > 0) {
          pushRight = Math.max(pushRight, timeShortfall);
        }
      }

      if (pushRight <= 0 && pushLeft <= 0) continue;
      // Step away from violation: rightward yield takes precedence to preserve time flow
      const step = pushRight > 0 ? pushRight : -pushLeft;
      if (step === 0) continue;
      const maxOff = unitMaxOffset(unit);
      const minOff = unitMinOffset(unit);
      const bandLo = Math.max(
        unit.bandLeft - minOff - unit.nominalX,
        asymmetricCrowding ? unit.cellLeft - minOff - unit.nominalX : Number.NEGATIVE_INFINITY
      );
      const bandHi = Math.min(
        unit.bandRight - maxOff - unit.nominalX,
        asymmetricCrowding ? unit.cellRight - maxOff - unit.nominalX : Number.POSITIVE_INFINITY
      );
      const clamped = Math.max(bandLo, Math.min(bandHi, unit.shift + step));
      if (clamped !== unit.shift) {
        unit.shift = clamped;
        moved = true;
      }
    }
    if (!moved) break;
  }

  // -------------------------------------------------------------------------
  // 4. Apply: the column translation first, then the resolved row fan.
  // -------------------------------------------------------------------------
  const resolved = new Map<string, number>();
  for (const unit of ordered) {
    for (const cluster of unit.rows) {
      for (const p of cluster.notes) {
        resolved.set(
          p.note.id,
          unit.nominalX + unit.shift + (offsetsById.get(p.note.id) ?? 0)
        );
      }
    }
  }

  const placed = notes.map((p) => {
    const x = resolved.get(p.note.id);
    const unit = unitByTick.get(p.note.startTick);
    const cell = unit ? { left: unit.cellLeft, right: unit.cellRight } : undefined;
    if (x === undefined) return unit ? { ...p, nominalX: unit.nominalX, beatCell: cell } : p;
    const rhythm = x === p.x ? p.rhythm : { ...p.rhythm, x };
    return {
      ...p,
      x,
      rhythm,
      ...(unit ? { nominalX: unit.nominalX, beatCell: cell } : {}),
    };
  });

  // -------------------------------------------------------------------------
  // 5. Round 15: no two opposing stems may fuse into one continuous rule.
  //    Where the two hands still share a stem column and their spans overlap
  //    (the Round 14 bars 13/14 defect), the RH stem steps left and the LH stem
  //    right by the fixed `JANKO_STEM_STAGGER`, so the column reads as two
  //    voices instead of one head-to-head connector. The control policy keeps
  //    the Round 11 centerline doctrine verbatim.
  // -------------------------------------------------------------------------
  if (asymmetricCrowding) {
    applyStemFusionStagger(placed, t);
  }

  return {
    notes: placed,
    claspTicks: new Set(ordered.filter((unit) => unit.clasp).map((unit) => unit.tick)),
  };
}

/**
 * Round 15 stem-fusion guard: stagger the two stems of any **opposing-hand**
 * pair that shares one column with touching or overlapping vertical spans.
 *
 * `'stem-anchored'` and `'asymmetric-micro'` both call this, so the Round 14
 * bars 13/14 defect (two heads 15–30pt apart joined by one uninterrupted
 * vertical line) cannot survive the round. Heads further apart than two stem
 * lengths already point their stems away from each other and are untouched.
 */
export function applyStemFusionStagger(
  notes: readonly PositionedJankoNote[],
  tokens?: Partial<JankoTokens> | null
): void {
  const t = resolveJankoTokens(tokens);
  const byX = new Map<string, PositionedJankoNote[]>();
  for (const p of notes) {
    const key = p.x.toFixed(3);
    const bucket = byX.get(key);
    if (bucket) bucket.push(p);
    else byX.set(key, [p]);
  }
  for (const bucket of byX.values()) {
    if (bucket.length < 2) continue;
    const span = (r: JankoRhythmNote): { lo: number; hi: number } => {
      const dir = r.hand === 'RH' ? -1 : 1;
      const attach = getStemAttachmentRadius(r, t);
      const a = r.y + dir * attach;
      const b = r.y + dir * t.stemLength;
      return { lo: Math.min(a, b), hi: Math.max(a, b) };
    };
    for (let i = 0; i < bucket.length; i++) {
      for (let j = i + 1; j < bucket.length; j++) {
        const a = bucket[i];
        const b = bucket[j];
        if (a.rhythm.hand === b.rhythm.hand) continue;
        const ra = a.rhythm;
        const rb = b.rhythm;
        const sa = span(ra);
        const sb = span(rb);
        // Pointing away (or clear) — the pair already reads as two voices.
        if (sa.hi < sb.lo - EPS || sb.hi < sa.lo - EPS) continue;
        a.rhythm = {
          ...ra,
          stemDx: ra.hand === 'RH' ? -JANKO_STEM_STAGGER : JANKO_STEM_STAGGER,
        };
        b.rhythm = {
          ...rb,
          stemDx: rb.hand === 'RH' ? -JANKO_STEM_STAGGER : JANKO_STEM_STAGGER,
        };
      }
    }
  }
}

/** Position every note of one system, in engraving order. */
export function layoutJankoSystem(
  score: QuantizedGridScore,
  geo: JankoPageGeometry,
  systemIndex: number,
  options?: Partial<JankoLayoutOptions> | null,
  tokens?: Partial<JankoTokens> | null
): JankoSystemLayout {
  const o = resolveJankoOptions(options);
  const t = resolveJankoTokens(tokens);
  const geometry = getSystemGeometry(geo, systemIndex);
  const mps = geometry.measuresPerSystem;
  const anacrusis = t.anacrusisTicks ?? 0;
  const startTick =
    systemIndex === 0 ? 0 : anacrusis + systemIndex * mps * t.ticksPerMeasure;
  const endTick = anacrusis + (systemIndex + 1) * mps * t.ticksPerMeasure;
  const sysNotes = score.notes
    .filter((n) => n.startTick >= startTick && n.startTick < endTick)
    .sort((a, b) => a.startTick - b.startTick || a.pitch.pitchClass - b.pitch.pitchClass);
  // The two dynamic layouts resolve each Set B flank against the *whole*
  // voice, so the contour is continuous across system and page breaks.
  const flanks = usesContourFlanks(o.channelLayout)
    ? resolveChannelFlanks(score.notes, o, t)
    : null;
  // A measure whose downbeat carries a chord reserves the air its external
  // clasp needs from the opening barline (Round 5). Where a measure is too
  // dense to absorb that shift, the widening — and with it the bracket — is
  // withdrawn until the engraving is collision-free.
  const claspInsets = new Map(computeClaspInsetMap(score, geometry, systemIndex, o, t));
  let positioned: PositionedJankoNote[] = [];
  let chordColumns: JankoChordColumnResolution = { notes: [], claspTicks: new Set<number>() };
  for (let attempt = 0; ; attempt++) {
    positioned = sysNotes.map((n) =>
      positionJankoNote(n, geometry, systemIndex, o, t, flanks?.get(n.id) ?? null, claspInsets)
    );
    // Approach 2: heads that share an onset, an octave and a whole-tone row are
    // spread horizontally around the beat column instead of being merged. A
    // clasped column additionally claims the air its bracket needs on the left.
    chordColumns = resolveChordColumns(positioned, geometry, systemIndex, o, t, claspInsets);
    if (claspInsets.size === 0 || attempt > geometry.measuresPerSystem) break;
    const colliding = measuresWithColumnCollisions(
      chordColumns.notes,
      geometry,
      systemIndex,
      t,
      protectsBarlineInk(o.gridWritingPolicy)
    );
    const demoted = [...claspInsets.keys()].filter((m) => colliding.has(m));
    if (demoted.length === 0) break;
    for (const m of demoted) claspInsets.delete(m);
  }
  const notes = chordColumns.notes;

  let beams: JankoBeamGroupGeometry[] = [];
  let ungrouped: JankoRhythmNote[] = [];
  if (o.rhythmStyle === 'beamed') {
    // Every notehead of the system is an obstacle for every beam group: the
    // shared lattice lets one hand's beam cross the other hand's staff lines.
    // The Middle C spine is handed to the solver as well, so no connector can
    // ever slice across the corridor.
    const rhythmNotes = notes.map((p) => p.rhythm);
    const partition = partitionBeamGroups(rhythmNotes, t, geometry.middleCY);
    beams = partition.groups
      .map((group) => computeBeamGroupGeometry(group, t, rhythmNotes, geometry.middleCY))
      .filter((g): g is JankoBeamGroupGeometry => g !== null);
    ungrouped = partition.ungrouped;
  }

  // Round 5: external left clasps group every vertical simultaneity and carry
  // its duration. A clasp member that is part of a beam keeps its stem, so no
  // real 16th-note beam is ever broken by the grouping. Every bracket is
  // re-audited against the *solved* columns: a clasp the engine cannot engrave
  // cleanly is dropped and its cluster falls back to traditional stems.
  const clusters = collectClaspClusters(
    notes,
    geometry,
    systemIndex,
    o,
    t,
    o.chordGrouping === 'bounding-phrase' ? null : chordColumns.claspTicks
  )
    .map((cluster) => ({
      cluster,
      geometry: computeClaspGeometry(
        cluster.notes.map((p) => p.rhythm),
        t,
        {
          ...(cluster.durationTicks === undefined ? {} : { durationTicks: cluster.durationTicks }),
          // Round 6/8: a per-hand clasp exists only for a horizontally displaced
          // cluster or a vertical chord of three or more heads; a clean 2-note
          // vertical column keeps its stems.
          requireBracketScope: o.chordGrouping === 'per-hand-clasp',
          claspDurationStyle: o.claspDurationStyle,
        }
      ),
    }))
    .filter(
      (entry): entry is { cluster: JankoClaspCluster; geometry: JankoClaspGroupGeometry } =>
        entry.geometry !== null
    );
  const furnitureLaid = clusters.length > 0 ? systemFurniture(geometry, o, t, systemIndex) : [];
  let clasps: JankoClaspGroupGeometry[] = clusters
    .filter((entry) =>
      claspClearsLayout(
        entry.geometry,
        // Round 12: the transparent grid reserves no barline air, so a bracket
        // is judged against the glyphs alone (its barline is knocked out).
        protectsBarlineInk(o.gridWritingPolicy)
          ? getMeasureOpeningBarlineX(entry.cluster.measureIdx, geometry, systemIndex, t)
          : null,
        notes,
        t,
        furnitureLaid
      )
    )
    .map((entry) => entry.geometry);
  let claspRails: JankoClaspRailGeometry[] = [];
  if (o.chordGrouping === 'beamed-clasp-rail') {
    const clusterList = clusters.map((entry) => entry.cluster);
    const barlineOf = (measureIdx: number): number | null =>
      getMeasureOpeningBarlineX(measureIdx, geometry, systemIndex, t);
    const railed = computeClaspRails(clasps, clusterList, t, (run) => {
      for (let i = 0; i < run.groups.length; i++) {
        const cluster = clusterList[run.indexes[i]];
        if (
          !claspClearsLayout(run.groups[i], barlineOf(cluster.measureIdx), notes, t, furnitureLaid)
        ) {
          return false;
        }
      }
      for (const rail of run.rails) {
        if (!railClearsLayout(rail, notes, t)) return false;
      }
      return true;
    });
    clasps = railed.groups;
    claspRails = railed.rails;
  }
  const beamedIds = new Set(beams.flatMap((beam) => beam.notes.map((n) => n.id)));
  const claspedStems = clasps
    .flatMap((clasp) => clasp.notes.map((n) => n.id))
    .filter((id) => !beamedIds.has(id));

  // Round 7 (Option 3): gap-gated vertical chording. Under the per-hand clasp
  // paradigm a horizontally spread hand cluster takes the external bracket,
  // while a clean vertical column of one hand — which `computeClaspGeometry`
  // refuses — is unified by the gap-gated stem grammar instead: a tight pair
  // draws no internal stem, a wide leap gets an explicit bridge, and the outer
  // extremity carries the hand's duration. A head that belongs to a real beam
  // keeps its stem and is left untouched.
  //
  // Round 8 adds the three-or-more-note vertical chord to the bracket's own
  // scope, so an onset that actually carries a bracket is excluded here: the
  // bracket already replaces those stems and carries their duration, and the
  // two grammars must never double-encode one sonority.
  const verticalChords: JankoVerticalChordGroup[] = [];
  const chordBridges: JankoChordBridge[] = [];
  if (o.chordGrouping === 'per-hand-clasp') {
    const bracketedHandOnsets = new Set(
      clasps.map((clasp) => `${clasp.tick}|${clasp.notes[0].hand}`)
    );
    const byHandOnset = new Map<string, PositionedJankoNote[]>();
    for (const p of notes) {
      const key = `${p.note.startTick}|${p.rhythm.hand}`;
      const bucket = byHandOnset.get(key);
      if (bucket) bucket.push(p);
      else byHandOnset.set(key, [p]);
    }
    for (const [key, group] of byHandOnset.entries()) {
      if (group.length < 2) continue;
      if (bracketedHandOnsets.has(key)) continue;
      const standalone = group.filter((p) => !beamedIds.has(p.note.id));
      if (standalone.length < 2) continue;
      const resolved = computeVerticalChordGroup(
        standalone.map((p) => p.rhythm),
        t
      );
      if (!resolved) continue;
      verticalChords.push(resolved);
      chordBridges.push(...resolved.bridges);
    }
  }

  const restLayer = computeJankoRestLayer(score, geometry, systemIndex, o, t, notes);

  return {
    index: systemIndex,
    isFinalSystem: systemIndex >= countJankoSystems(score, o, t) - 1,
    geometry,
    notes,
    beams,
    ungrouped,
    rests: restLayer.rests,
    unwrittenRests: restLayer.unwritten,
    clasps,
    claspRails,
    claspedStems,
    verticalChords,
    chordBridges,
  };
}

/** Position every system of a score (used by the linter and the studio). */
export function layoutJankoScore(
  score: QuantizedGridScore,
  options?: Partial<JankoLayoutOptions> | null,
  tokens?: Partial<JankoTokens> | null
): JankoSystemLayout[] {
  const o = resolveJankoOptions(options);
  const t = resolveJankoTokens(tokens);
  const geo = computePageGeometry(o, t);
  const total = countJankoSystems(score, o, t);
  const out: JankoSystemLayout[] = [];
  for (let s = 0; s < total; s++) out.push(layoutJankoSystem(score, geo, s, o, t));
  return out;
}

// ---------------------------------------------------------------------------
// System rendering
// ---------------------------------------------------------------------------

function renderNotesLayer(
  layout: JankoSystemLayout,
  o: ResolvedJankoLayoutOptions,
  t: ResolvedJankoTokens,
  gridInk: string = ''
): string {
  const out: string[] = ['  <g class="janko-notes">'];

  // 1. Dynamic ledger equators for out-of-staff octaves. They form their own
  //    layer so a later note's ledger can never cut through an earlier note's
  //    white knockout (see the linter's knockout pass-through audit).
  //
  //    Round 11: when successive measures share the **Octave 6** outlier
  //    equator (Bach Var. 1 climbs into Octave 6 across mm. 29–30), the choppy
  //    notehead-centred dashes are suppressed in favour of one continuous
  //    outlier rule spanning those measures edge to edge.
  const ledgers: string[] = [];
  const spans = new Map<number, { first: number; last: number }>();
  for (const p of layout.notes) {
    if (p.coord.octave <= 5) continue;
    const m = getMeasureIndexOfTick(p.note, layout.geometry, layout.index, t);
    for (const ledgerY of p.coord.ledgerYs) {
      const key = Math.round(ledgerY * 100);
      const span = spans.get(key);
      if (!span) spans.set(key, { first: m, last: m });
      else {
        span.first = Math.min(span.first, m);
        span.last = Math.max(span.last, m);
      }
    }
  }
  const anacrusisTicks = t.anacrusisTicks ?? 0;
  const upbeatWidth =
    layout.index === 0 && anacrusisTicks > 0
      ? (anacrusisTicks / t.ticksPerMeasure) * layout.geometry.measureWidth
      : 0;
  const continuous = new Map<number, { x1: number; x2: number }>();
  for (const [key, span] of spans) {
    if (span.last <= span.first) continue;
    const x1 = layout.geometry.staffLeft + upbeatWidth + span.first * layout.geometry.measureWidth;
    const x2 = layout.geometry.staffLeft + upbeatWidth + (span.last + 1) * layout.geometry.measureWidth;
    continuous.set(key, { x1, x2 });
    ledgers.push(renderOutlierRule(x1, x2, layout.geometry.middleCY + key / 100));
  }
  for (const p of layout.notes) {
    for (const ledgerY of p.coord.ledgerYs) {
      const key = Math.round(ledgerY * 100);
      if (continuous.has(key)) continue;
      ledgers.push(renderLedgerEquator(p.x, layout.geometry.middleCY + ledgerY, t, o));
    }
  }
  if (ledgers.length > 0) {
    out.push('    <g class="janko-ledger-layer">');
    out.push(...ledgers);
    out.push('    </g>');
  }

  // 2. Rhythm layer (the beamed dialect renders its stems group-wise). It is
  //    painted *beneath* the noteheads so the white knockouts erase whatever
  //    stem or beam passes behind a glyph — the invariant the linter audits.
  //    A clasp owns the duration of every member whose stem is not part of a
  //    beam, so those standalone stems are replaced by the bracket. Option 3
  //    suppresses the interior stems of a vertical hand chord the same way: the
  //    group's outer extremity carries the whole hand's duration.
  const clasped = new Set(layout.claspedStems);
  const suppressed = new Set(layout.verticalChords.flatMap((chord) => chord.suppressedIds));
  const carrierDurations = new Map(
    layout.verticalChords.map((chord) => [chord.carrier.id, chord.durationTicks])
  );
  /** The rhythm note as engraved: the carrier draws its group's duration. */
  const asEngraved = (n: JankoRhythmNote): JankoRhythmNote => {
    const durationTicks = carrierDurations.get(n.id);
    return durationTicks === undefined || durationTicks === n.durationTicks
      ? n
      : { ...n, durationTicks };
  };
  if (o.rhythmStyle === 'beamed') {
    for (const beam of layout.beams) {
      out.push(renderBeamGroup(beam.notes, t, beam, o.subdivisionStyle));
    }
    for (const n of layout.ungrouped) {
      if (clasped.has(n.id) || suppressed.has(n.id)) continue;
      out.push(renderRhythm(asEngraved(n), 'beamed', t, o.subdivisionStyle));
    }
  } else {
    for (const p of layout.notes) {
      if (clasped.has(p.rhythm.id) || suppressed.has(p.rhythm.id)) continue;
      out.push(renderRhythm(asEngraved(p.rhythm), o.rhythmStyle, t, o.subdivisionStyle));
    }
  }

  // 2a. Option 3 bridge lines: the intentional vertical ink across a hand's
  //     wide leaps, painted with the rhythm layer and beneath the noteheads.
  if (layout.chordBridges.length > 0) out.push(renderChordBridges(layout.chordBridges));

  // 2b. External left clasps + their rails (Round 5), painted above the stems
  //     they replace and beneath the noteheads they must never touch. Round 8
  //     carries each bracket's symmetrical duration paradigm on its geometry.
  if (layout.clasps.length > 0 || layout.claspRails.length > 0) {
    out.push(renderClaspGroup(layout.clasps, layout.claspRails, t));
  }

  // 2c. Round 12 voice rests: the written silences of an inactive hand span,
  //     painted above the rhythm layer they interrupt and beneath the noteheads,
  //     so a glyph mask always erases whatever a rest should never have touched.
  for (const rest of layout.rests) out.push(renderRest(rest, t));

  // 2d. Round 12 `'strict-protected-grid'`: the continuous vertical grid is
  //     painted here, on its dedicated white air channels, *above* the rhythm
  //     layer — so no stem or beam may ever overwrite it — while the circular
  //     notehead masks painted in step 3 still knock it out inside their disc.
  if (gridInk.length > 0) out.push(gridInk);

  // 3. Position of Honor halo + white knockout + duodecimal digit, last.
  for (const p of layout.notes) {
    out.push(
      renderNotehead(
        {
          x: p.x,
          y: p.y,
          pitchClass: p.coord.pitchClass,
          hand: p.coord.hand,
          isPositionOfHonor: p.note.startTick === 0,
        },
        t
      )
    );
  }

  out.push('  </g>');
  return out.join('\n');
}

/**
 * Render one horizontal system in absolute page coordinates.
 * `systemIndex` is the global system index on the score (0-based).
 */
export function renderSystem(
  score: QuantizedGridScore,
  geo: JankoSystemGeometry,
  systemIndex: number,
  options?: Partial<JankoLayoutOptions> | null,
  tokens?: Partial<JankoTokens> | null,
  layout?: JankoSystemLayout
): string {
  const o = resolveJankoOptions(options);
  const t = resolveJankoTokens(tokens);
  const resolved =
    layout ?? layoutJankoSystem(score, computePageGeometry(o, t), systemIndex, o, t);
  const startMeasureOffset = systemIndex * geo.measuresPerSystem;

  const out: string[] = [];
  out.push(`  <g id="system-${systemIndex + 1}">`);
  const anacrusis = t.anacrusisTicks ?? 0;
  if (o.showMeasureNumbers && (systemIndex > 0 || anacrusis === 0)) {
    out.push(renderMeasureNumber(geo, startMeasureOffset + 1, t));
  }
  // Round 7: the system-start mark is drawn strictly at the start of the piece.
  // Every intermediate system opens from the bare left margin with no bounding
  // barline. Round 10 retires the copperplate accolade; Round 14 settles the
  // flared 0.65pt architectural bracket as the golden System 1 start.
  if (systemIndex === 0) {
    const systemStart = renderAccolade(geo, o, t);
    if (systemStart.length > 0) out.push(systemStart);
    out.push(renderHandLabels(geo, o, t));
    out.push(renderTimeSignature(geo, o, t));
  }
  out.push(renderOctaveLabels(geo, o, t));
  out.push(renderStaffLines(geo, o, t));
  // Round 12: the continuous vertical grid (measure barlines + dashed beat
  // pulses). Under `'strict-protected-grid'` it is handed to the notes layer and
  // painted above the rhythm ink on its own white air channels; every other
  // policy paints it first, as the transparent structural background it is.
  const gridInk = [
    renderBeatGrid(geo, systemIndex, o, t),
    renderBarlines(geo, o, t, resolved.isFinalSystem),
  ].join('\n');
  if (channelsGridInk(o.gridWritingPolicy)) {
    out.push(renderNotesLayer(resolved, o, t, gridInk));
  } else {
    out.push(gridInk);
    out.push(renderNotesLayer(resolved, o, t));
  }
  out.push('  </g>');
  return out.join('\n');
}

/** Render a contiguous run of global systems in absolute page coordinates. */
export function renderSystemsBody(
  score: QuantizedGridScore,
  geo: JankoPageGeometry,
  firstSystem: number,
  lastSystem: number,
  options?: Partial<JankoLayoutOptions> | null,
  tokens?: Partial<JankoTokens> | null
): string {
  const o = resolveJankoOptions(options);
  const t = resolveJankoTokens(tokens);
  const out: string[] = [];
  const total = countJankoSystems(score, o, t);
  const last = Math.min(lastSystem, total - 1);
  for (let s = Math.max(0, firstSystem); s <= last; s++) {
    out.push(renderSystem(score, getSystemGeometry(geo, s), s, o, t));
  }
  return out.join('\n');
}

// ---------------------------------------------------------------------------
// Public renderers
// ---------------------------------------------------------------------------

/** Total pages produced for a score with the current layout options. */
export function countJankoPages(
  score: QuantizedGridScore,
  options?: Partial<JankoLayoutOptions> | null,
  tokens?: Partial<JankoTokens> | null
): number {
  const o = resolveJankoOptions(options);
  const t = resolveJankoTokens(tokens);
  const totalTicks = score.totalTicks || 0;
  const measuresTotal = Math.max(1, Math.ceil(totalTicks / t.ticksPerMeasure));
  const perPage = o.measuresPerSystem * Math.max(1, o.systemsPerPage);
  return Math.max(1, Math.ceil(measuresTotal / perPage));
}

/** Full A4 page of the Jánko Two-Row grand staff. */
export function renderJankoPage(
  score: QuantizedGridScore,
  pageIndex: number = 0,
  options?: Partial<JankoLayoutOptions> | null,
  tokens?: Partial<JankoTokens> | null
): string {
  const o = resolveJankoOptions(options);
  const t = resolveJankoTokens(tokens);
  const geo = computePageGeometry(o, t);
  const totalPages = countJankoPages(score, o, t);
  const firstSystem = pageIndex * geo.systemsPerPage;

  const body: string[] = [];
  const totalSystems = countJankoSystems(score, o, t);
  for (let s = firstSystem; s < firstSystem + geo.systemsPerPage; s++) {
    if (s >= totalSystems) break;
    body.push(renderSystem(score, getSystemGeometry(geo, s), s, o, t));
  }

  return [
    svgOpen({ x: 0, y: 0, w: geo.pageWidth, h: geo.pageHeight }),
    renderJankoStyleDefs(t),
    '  <rect width="100%" height="100%" fill="#FFFFFF"/>',
    renderPageHeader(geo, pageIndex, totalPages),
    ...body,
    renderPageFooter(geo, pageIndex, totalPages),
    '</svg>',
  ].join('\n');
}

/** Crop box (page pt) tightly bounding a run of measures. */
export interface JankoCropBox extends SvgBox {
  firstSystem: number;
  lastSystem: number;
  firstMeasure: number;
  lastMeasure: number;
}

/** Extra vertical room (pt) a crop reserves above and below the staff rules. */
export interface JankoCropExtents {
  /** Extra pt above the top staff rule (ledger stacks of high octaves). */
  top: number;
  /** Extra pt below the bottom staff rule (ledger stacks of low octaves). */
  bottom: number;
}

/**
 * Vertical room a crop owes the music that reaches outside the grand staff.
 *
 * The canonical crop padding (`CROP_PAD_TOP` / `CROP_PAD_BOTTOM`) is sized for
 * the in-staff octaves 2–5, whose stems stay inside it. A score that walks down
 * to octave 1 (Brahms's sweeping bass arpeggios) or up to octave 6 adds a
 * dynamic ledger equator, a notehead disc and a stem *beyond* that padding, and
 * a flat crop would slice them off. This measures the true extent of every
 * ledger, head and stem in the covered measures, relative to the staff rules.
 *
 * The result is `0 / 0` for any music inside the staff, so existing crops are
 * bit-for-bit unchanged.
 */
export function computeCropExtents(
  score: QuantizedGridScore,
  geo: JankoPageGeometry,
  measureStart: number,
  measureCount: number,
  options?: Partial<JankoLayoutOptions> | null,
  tokens?: Partial<JankoTokens> | null
): JankoCropExtents {
  const o = resolveJankoOptions(options);
  const t = resolveJankoTokens(tokens);
  const startIdx = Math.max(0, Math.floor(measureStart) - 1);
  const count = Math.max(1, Math.floor(measureCount));
  const anacrusis = t.anacrusisTicks ?? 0;
  const startTick = startIdx === 0 ? 0 : anacrusis + startIdx * t.ticksPerMeasure;
  const endTick = anacrusis + (startIdx + count) * t.ticksPerMeasure;
  const reference = geo.systems[0];
  const staffTop = reference.staffTopY - reference.middleCY;
  const staffBottom = reference.staffBotY - reference.middleCY;
  const flanks = usesContourFlanks(o.channelLayout)
    ? resolveChannelFlanks(score.notes, o, t)
    : null;

  let top = 0;
  let bottom = 0;
  for (const note of score.notes) {
    if (note.startTick < startTick || note.startTick >= endTick) continue;
    const hand = getNoteHand(note.hand, note.pitch.octave);
    const coord = getPitchCoordinate(
      note.pitch.pitchClass,
      note.pitch.octave,
      hand,
      t,
      o,
      flanks?.get(note.id) ?? null
    );
    // A RH stem grows upward, a LH stem downward; both are `stemLength` long.
    const stemTip = coord.y + (hand === 'RH' ? -t.stemLength : t.stemLength);
    const r = t.noteheadRadius;
    const ys = [coord.y - r, coord.y + r, stemTip];
    for (const ledgerY of coord.ledgerYs) ys.push(ledgerY - r, ledgerY + r);
    const highest = Math.min(...ys);
    const lowest = Math.max(...ys);
    top = Math.max(top, staffTop - CROP_PAD_TOP - highest);
    bottom = Math.max(bottom, lowest - (staffBottom + CROP_PAD_BOTTOM));
  }
  return { top: Math.max(0, top), bottom: Math.max(0, bottom) };
}

/**
 * Compute the macro-crop box for `measureCount` measures from `measureStart`.
 * `includeCaptionBand` reserves the strip above the staff used by
 * {@link renderJankoCrop} for its caption (comparison panels omit it), and
 * `extents` (see {@link computeCropExtents}) widens the box for music that
 * leaves the grand staff.
 *
 * Round 13 fixes the multi-system crop: a window that crosses a system break
 * (e.g. mm. 27–29 with four measures per system) has a *first* measure in one
 * system and a *last* measure in the next, so the two measure-relative x
 * anchors belong to different columns — subtracting them produced a negative
 * width clamped to the 1pt minimum, i.e. an empty white page. A system-spanning
 * window is therefore anchored on the **staff column itself**
 * (`margin − CROP_PAD_X … staffRight + CROP_PAD_X`), exactly like a window that
 * opens on a measure 1.
 */
export function computeCropBox(
  geo: JankoPageGeometry,
  measureStart: number,
  measureCount: number,
  includeCaptionBand: boolean = true,
  extents?: Partial<JankoCropExtents> | null
): JankoCropBox {
  const mps = geo.measuresPerSystem;
  const startIdx = Math.max(0, Math.floor(measureStart) - 1);
  const count = Math.max(1, Math.floor(measureCount));
  const endIdx = startIdx + count;
  const firstSystem = Math.floor(startIdx / mps);
  const lastSystem = Math.floor((endIdx - 1) / mps);
  const startMIdx = startIdx % mps;
  const endMIdx = (endIdx - 1) % mps;
  const spansSystems = firstSystem !== lastSystem;

  const anacrusis = geo.tokens.anacrusisTicks ?? 0;
  const sysGeo = getSystemGeometry(geo, firstSystem);
  const isSys0Anacrusis = firstSystem === 0 && anacrusis > 0;
  const upbeatWidth = isSys0Anacrusis
    ? (anacrusis / geo.tokens.ticksPerMeasure) * sysGeo.measureWidth
    : 0;

  const x0 =
    spansSystems || startMIdx === 0
      ? geo.margin - CROP_PAD_X
      : geo.staffLeft + upbeatWidth + startMIdx * sysGeo.measureWidth - CROP_PAD_X;
  const x1 = spansSystems
    ? geo.staffRight + CROP_PAD_X
    : geo.staffLeft + upbeatWidth + (endMIdx + 1) * sysGeo.measureWidth + CROP_PAD_X;

  let staffTop = Infinity;
  let staffBottom = -Infinity;
  for (let s = firstSystem; s <= lastSystem; s++) {
    const sys = getSystemGeometry(geo, s);
    staffTop = Math.min(staffTop, sys.staffTopY);
    staffBottom = Math.max(staffBottom, sys.staffBotY);
  }
  if (!Number.isFinite(staffTop)) {
    staffTop = geo.systems[0].staffTopY;
    staffBottom = geo.systems[0].staffBotY;
  }

  const captionHeight = includeCaptionBand ? CROP_CAPTION_HEIGHT : 0;
  const y0 = staffTop - CROP_PAD_TOP - captionHeight - (extents?.top ?? 0);
  const y1 = staffBottom + CROP_PAD_BOTTOM + (extents?.bottom ?? 0);
  return {
    x: x0,
    y: y0,
    w: Math.max(1, x1 - x0),
    h: Math.max(1, y1 - y0),
    firstSystem,
    lastSystem,
    firstMeasure: startIdx + 1,
    lastMeasure: endIdx,
  };
}

/**
 * Targeted macro crop of `measureCount` measures starting at `measureStart`
 * (1-based). The glyph work is identical to the full page — only the viewBox
 * is narrowed — so crops are pixel-identical to the corresponding page region.
 * The box grows just enough to keep out-of-staff ledger stacks, heads and
 * stems whole (see {@link computeCropExtents}). An optional `caption` is
 * appended to the auto measure-range label.
 */
export function renderJankoCrop(
  score: QuantizedGridScore,
  measureStart: number,
  measureCount: number,
  options?: Partial<JankoLayoutOptions> | null,
  tokens?: Partial<JankoTokens> | null,
  caption?: string
): string {
  const o = resolveJankoOptions(options);
  const t = resolveJankoTokens(tokens);
  const geo = computePageGeometry(o, t);
  const box = computeCropBox(
    geo,
    measureStart,
    measureCount,
    true,
    computeCropExtents(score, geo, measureStart, measureCount, o, t)
  );

  // Wrap the caption so even a single-measure crop keeps a fully visible label.
  const CAPTION_FONT_SIZE = 7;
  const CAPTION_LINE_HEIGHT = 9;
  const range =
    box.firstMeasure === box.lastMeasure
      ? `m. ${box.firstMeasure}`
      : `mm. ${box.firstMeasure}–${box.lastMeasure}`;
  const captionWidth = box.w - 12;
  const singleLine = wrapCaptionText(
    caption ? `${range} — ${caption}` : range,
    captionWidth,
    CAPTION_FONT_SIZE
  );
  // Narrow crops put the measure range on its own title line and wrap the
  // descriptive caption beneath it, instead of orphaning a separator.
  const captionLines =
    singleLine.length > 1 && caption
      ? [range, ...wrapCaptionText(caption, captionWidth, CAPTION_FONT_SIZE)]
      : singleLine;
  if (captionLines.length > 1) {
    const extra = (captionLines.length - 1) * CAPTION_LINE_HEIGHT;
    box.y -= extra;
    box.h += extra;
  }

  const systems = renderSystemsBody(score, geo, box.firstSystem, box.lastSystem, o, t);

  return [
    svgOpen(box),
    renderJankoStyleDefs(t),
    `  <rect x="${f(box.x)}" y="${f(box.y)}" width="${f(box.w)}" height="${f(box.h)}" fill="#FFFFFF"/>`,
    renderCaptionLines(
      box.x + 6,
      box.y + 10.5,
      captionLines,
      CAPTION_FONT_SIZE,
      CAPTION_LINE_HEIGHT
    ),
    '  <g class="janko-crop-body">',
    systems,
    '  </g>',
    '</svg>',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Variant comparison sheet
// ---------------------------------------------------------------------------

/** Normalize any accepted variant spec into a fully resolved variant. */
export function normalizeJankoVariant(
  spec: JankoVariantSpec,
  index: number,
  base?: Partial<JankoLayoutOptions> | null
): JankoVariant {
  const letter = String.fromCharCode(65 + (index % 26));
  if (typeof spec === 'string') {
    const style = spec as JankoRhythmStyle;
    return {
      id: style,
      label: `Variant ${letter}: ${JANKO_RHYTHM_STYLE_LABELS[style] ?? style}`,
      options: resolveJankoOptions({ ...(base ?? {}), rhythmStyle: style }),
    };
  }
  const def = spec as Record<string, unknown>;
  const isDefinition =
    'options' in def ||
    'rhythmStyle' in def ||
    'label' in def ||
    'name' in def ||
    'title' in def ||
    'id' in def;
  if (isDefinition) {
    const style =
      (def.rhythmStyle as JankoRhythmStyle | undefined) ?? resolveJankoOptions(base).rhythmStyle;
    const options = resolveJankoOptions({
      ...(base ?? {}),
      ...((def.options as Partial<JankoLayoutOptions> | undefined) ?? {}),
      rhythmStyle: style,
    });
    const label =
      (def.label as string | undefined) ??
      (def.name as string | undefined) ??
      (def.title as string | undefined) ??
      `Variant ${letter}: ${JANKO_RHYTHM_STYLE_LABELS[style] ?? style}`;
    return {
      id: (def.id as string | undefined) ?? `variant-${index + 1}`,
      label,
      options,
    };
  }
  const options = resolveJankoOptions({
    ...(base ?? {}),
    ...(spec as Partial<JankoLayoutOptions>),
  });
  return {
    id: `variant-${index + 1}`,
    label: `Variant ${letter}: ${
      JANKO_RHYTHM_STYLE_LABELS[options.rhythmStyle] ?? options.rhythmStyle
    }`,
    options,
  };
}

/** Escape text for an SVG `<text>` node (a label may carry `&`, `<` or `>`). */
function escapeXmlText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Multi-variant comparative contact sheet: every variant engraves the exact
 * same measures, stacked vertically with an identifying label. The default
 * variants are A: Angled Cuts, B: Traditional Beams, C: Unified Continuous
 * Lattice.
 */
export function renderJankoVariantComparison(
  score: QuantizedGridScore,
  variants?: JankoVariantSpec[] | null,
  measureStart: number = 1,
  measureCount: number = 4,
  baseOptions?: Partial<JankoLayoutOptions> | null,
  tokens?: Partial<JankoTokens> | null
): string {
  const o = resolveJankoOptions(baseOptions);
  const t = resolveJankoTokens(tokens);
  const specs = variants && variants.length > 0 ? variants : DEFAULT_JANKO_VARIANTS;
  const resolved = specs.map((spec, i) => normalizeJankoVariant(spec, i, o));

  const panels = resolved.map((variant) => {
    const geo = computePageGeometry(variant.options, t);
    const box = computeCropBox(geo, measureStart, measureCount, false);
    const body = renderSystemsBody(score, geo, box.firstSystem, box.lastSystem, variant.options, t);
    return { variant, box, body };
  });

  const pad = 10;
  const labelBand = 16;
  const gap = 12;
  const contentW = Math.max(...panels.map((p) => p.box.w));
  const contentH = Math.max(...panels.map((p) => p.box.h));
  const panelH = labelBand + contentH;
  const totalW = contentW + 2 * pad;
  const totalH = pad + panels.length * panelH + (panels.length - 1) * gap + pad;

  const out: string[] = [
    svgOpen({ x: 0, y: 0, w: totalW, h: totalH }),
    renderJankoStyleDefs(t),
    '  <rect width="100%" height="100%" fill="#FFFFFF"/>',
  ];

  panels.forEach((panel, i) => {
    const top = pad + i * (panelH + gap);
    out.push(`  <g class="janko-variant-panel" data-variant="${panel.variant.id}">`);
    out.push(
      `    <rect x="${f(pad)}" y="${f(top)}" width="${f(contentW)}" height="${f(panelH)}" fill="#FFFFFF" stroke="#E5E7EB" stroke-width="0.60"/>`
    );
    out.push(
      `    <text x="${f(pad + 6)}" y="${f(top + 11)}" class="janko-caption">${escapeXmlText(panel.variant.label)}</text>`
    );
    out.push(
      `    <text x="${f(pad + contentW - 6)}" y="${f(top + 11)}" class="janko-caption-sub" text-anchor="end">mm. ${panel.box.firstMeasure}–${panel.box.lastMeasure} · ${escapeXmlText(panel.variant.options.rhythmStyle)}</text>`
    );
    out.push(`    <clipPath id="janko-panel-clip-${i}">`);
    out.push(
      `      <rect x="${f(pad)}" y="${f(top + labelBand)}" width="${f(contentW)}" height="${f(contentH)}"/>`
    );
    out.push('    </clipPath>');
    // The clip lives on an untransformed wrapper so its rectangle stays in
    // sheet coordinates; the inner group carries the crop registration.
    out.push(`    <g clip-path="url(#janko-panel-clip-${i})">`);
    out.push(
      `      <g transform="translate(${f(pad - panel.box.x)}, ${f(top + labelBand - panel.box.y)})">`
    );
    out.push(
      `        <rect x="${f(panel.box.x)}" y="${f(panel.box.y)}" width="${f(panel.box.w)}" height="${f(panel.box.h)}" fill="#FFFFFF"/>`
    );
    out.push(panel.body);
    out.push('      </g>');
    out.push('    </g>');
    out.push('  </g>');
  });

  out.push('</svg>');
  return out.join('\n');
}
