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
 * - {@link renderJankoPage}               — full A4 page (3 systems, 12 mm.)
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
  JankoTokens,
  JankoVariant,
  JankoVariantSpec,
  ResolvedJankoLayoutOptions,
  ResolvedJankoTokens,
  resolveJankoOptions,
  resolveJankoTokens,
} from './types';
import { renderJankoStyleDefs, f } from './elements/style';
import {
  renderHandLabels,
  renderLedgerEquator,
  renderOctaveLabels,
  renderStaffLines,
  renderTimeSignature,
} from './elements/staff';
import { renderNotehead } from './elements/notehead';
import {
  JankoBeamGroupGeometry,
  JankoClaspGroupGeometry,
  JankoClaspRailGeometry,
  JankoRhythmNote,
  claspInkBox,
  computeBeamGroupGeometry,
  computeClaspGeometry,
  partitionBeamGroups,
  renderBeamGroup,
  renderClaspGroup,
  renderRhythm,
  withClaspRail,
} from './elements/rhythm';
import { renderAccolade, renderCaptionLines, wrapCaptionText } from './elements/accolade';
import { renderBarlines, renderBeatGrid, renderMeasureNumber } from './elements/barlines';

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

function renderPageHeader(geo: JankoPageGeometry, pageIndex: number, totalPages: number): string {
  const o = geo.options;
  void pageIndex;
  void totalPages;
  const y = geo.margin;
  const cx = geo.pageWidth / 2;
  return [
    '  <g id="page-header">',
    `    <text x="${f(cx)}" y="${f(y + 14)}" class="janko-title" text-anchor="middle">${o.title}</text>`,
    `    <text x="${f(cx)}" y="${f(y + 27)}" class="janko-subtitle" text-anchor="middle">${o.subtitle}</text>`,
    `    <text x="${f(geo.pageWidth - geo.margin)}" y="${f(y + 27)}" class="janko-meta" text-anchor="end">${o.composer}</text>`,
    '  </g>',
  ].join('\n');
}

function renderPageFooter(geo: JankoPageGeometry, pageIndex: number, totalPages: number): string {
  const y = geo.pageHeight - geo.margin + 12;
  return [
    '  <g id="page-footer">',
    `    <text x="${f(geo.margin)}" y="${f(y)}" class="janko-meta">Pure 12-TET Jánko Two-Row Grand Staff</text>`,
    `    <text x="${f(geo.pageWidth - geo.margin)}" y="${f(y)}" class="janko-meta" text-anchor="end" font-weight="bold">Page ${pageIndex + 1} of ${totalPages}</text>`,
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
 */
export function measuresWithColumnCollisions(
  notes: readonly PositionedJankoNote[],
  geo: JankoSystemGeometry,
  systemIndex: number,
  t: ResolvedJankoTokens
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
export const MARGIN_NUMERAL_FONT_SIZE = 8.5;

/**
 * Boxes of the left-margin furniture of one system: the measure numeral and the
 * accolade. Shared by the engine's clasp fit rule and the visual linter's
 * `measure-numeral-clearance` / `accolade-clearance` audits, so a bracket can
 * never be admitted into furniture the linter would report — and the audits can
 * never drift from the geometry the engine reserved.
 */
export function getMarginFurniture(
  geometry: JankoSystemGeometry,
  t: ResolvedJankoTokens,
  measureNumber: number,
  digitAdvance: number = MARGIN_DIGIT_ADVANCE
): { numeral: JankoBox; accolade: JankoBox } {
  const numeralX = geometry.staffLeft - 2;
  const numeralBaseline = geometry.staffTopY - 6;
  const numeral: JankoBox = {
    x0: numeralX,
    y0: numeralBaseline - t.digitFontSize * 1.2,
    // The numeral is set on an alphabetic baseline and figures carry no
    // descender: the ink stops at the baseline.
    x1: numeralX + String(measureNumber).length * MARGIN_NUMERAL_FONT_SIZE * digitAdvance * 1.5,
    y1: numeralBaseline,
  };
  const accolade: JankoBox = {
    x0: geometry.staffLeft - t.accoladeGap - t.accoladeWidth,
    y0: geometry.staffTopY,
    x1: geometry.staffLeft - t.accoladeGap,
    y1: geometry.staffBotY,
  };
  return { numeral, accolade };
}

/**
 * Every left-margin furniture box painted in one system (the accolade always,
 * the measure numeral only where the engine draws it), in the order the linter
 * audits them.
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
    systemIndex * o.measuresPerSystem + 1
  );
  const boxes: JankoBox[] = [accolade];
  if (o.showMeasureNumbers && (systemIndex > 0 || anacrusis === 0)) boxes.push(numeral);
  return boxes;
}

/** Do two boxes overlap (or come closer than `clearance`)? */
export function boxesWithin(a: JankoBox, b: JankoBox, clearance: number = 0): boolean {
  return a.x0 - clearance < b.x1 && b.x0 - clearance < a.x1 && a.y0 - clearance < b.y1 && b.y0 - clearance < a.y1;
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
    if (Math.hypot(dx, dy) < t.noteheadRadius + CLASP_NOTEHEAD_AIR - CLASP_EPS) return false;
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
 * Join the spire tips of contiguous clasps with a horizontal rail
 * (`'beamed-clasp-rail'`).
 *
 * Two clasps are *contiguous* when they are consecutive clasps of one measure —
 * the measure is the phrase unit of this notation, so the rail is always a
 * measure-bounded beam: it spans only its own measure's spire columns and
 * therefore can never approach, let alone cross, a barline. The primary rail
 * runs at the **topmost** tip, so every joined spire is extended up to it (the
 * run's beam); flag hooks are dropped exactly as a traditional beam replaces
 * them. A second rail `flagSpacing` below carries the 16th-note level whenever
 * the run holds two or more 16th-class clasps. A half/whole clasp carries a pip
 * rather than a spire and never joins a run.
 *
 * `verdict`, when supplied, sees the tentatively railed run — extended spires
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
    if (resolved[index].spireTipY === null) return;
    const bucket = buckets.get(cluster.measureIdx);
    if (bucket) bucket.push(index);
    else buckets.set(cluster.measureIdx, [index]);
  });

  for (const bucket of buckets.values()) {
    if (bucket.length < 2) continue;
    const run = bucket.sort((a, b) => resolved[a].tick - resolved[b].tick);
    const railY = Math.min(...run.map((i) => resolved[i].spireTipY as number));
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
  /** Absolute page geometry of the system's slot. */
  geometry: JankoSystemGeometry;
  /** Notes of this system, in engraving order (tick, then pitch class). */
  notes: PositionedJankoNote[];
  /** Beamed groups with fully resolved beam/stem geometry ([] when unbeamed). */
  beams: JankoBeamGroupGeometry[];
  /** Short notes engraved with a standalone tick instead of a beam. */
  ungrouped: JankoRhythmNote[];
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
}

function handForNote(note: QuantizedNote): Hand {
  return getNoteHand(note.hand, note.pitch.octave);
}

/**
 * Left inset (pt) a measure must reserve when its **downbeat** carries a left
 * clasp: `claspX = noteLeft − r − claspOffset` has to keep
 * `claspMinBarlineAir` clear of the measure's opening barline, so
 * `noteLeft ≥ r + claspOffset + claspMinBarlineAir` (11.6pt with the canonical
 * tokens — nearly twice the 6pt measure inset).
 */
export function getClaspDownbeatInset(tokens?: Partial<JankoTokens> | null): number {
  const t = resolveJankoTokens(tokens);
  return t.noteheadRadius + t.claspOffset + t.claspMinBarlineAir;
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
 * simply stands a little further right of its barline.
 */
export function getMeasureInsets(
  systemIndex: number,
  measureIdx: number,
  o: ResolvedJankoLayoutOptions,
  t: ResolvedJankoTokens,
  claspLeftInset: number = 0
): JankoTickInsets {
  const isOpeningMeasure = systemIndex === 0 && measureIdx === 0;
  const base =
    isOpeningMeasure && o.showTimeSignature && o.timeSignatureWidth > 0
      ? { left: t.measureInset + o.timeSignatureWidth, right: t.measureInset }
      : { left: t.measureInset, right: t.measureInset };
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
  const claspInset = (measureIdx: number): number => claspInsets?.get(measureIdx) ?? 0;
  const anacrusis = t.anacrusisTicks ?? 0;
  if (systemIndex === 0 && anacrusis > 0) {
    const upbeatWidth = (anacrusis / t.ticksPerMeasure) * geo.measureWidth;
    if (note.startTick < anacrusis) {
      const insets = getMeasureInsets(0, 0, o, t, claspInset(0));
      const left = insets.left ?? t.measureInset;
      const right = insets.right ?? t.measureInset;
      const available = Math.max(0, upbeatWidth - left - right);
      return geo.staffLeft + left + (note.startTick / anacrusis) * available;
    }
    const elapsed = note.startTick - anacrusis;
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
    const elapsed = note.startTick - anacrusis;
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

  const { tickInMeasure } = splitTick(note.startTick, t);
  const measureIdx = getMeasureIndexOfTick(note, geo, systemIndex, t);
  return (
    geo.staffLeft +
    getTickX(
      note.startTick,
      measureIdx,
      tickInMeasure,
      geo.measureWidth,
      t,
      getMeasureInsets(systemIndex, measureIdx, o, t, claspInset(measureIdx))
    )
  );
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
    },
  };
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
  /** Half the horizontal span the displaced heads occupy (`(K-1)·Δx / 2`). */
  halfSpan: number;
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
  /** Absolute x of the measure's left edge (its opening barline, when any). */
  measureLeft: number;
  /** True when this onset carries an external left clasp (chord grouping). */
  clasp: boolean;
  /** Distance (pt) from the unit's leftmost head centre to the clasp spine. */
  claspReach: number;
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

  // Every onset of the system, bucketed by its system-local measure index.
  const byMeasure = new Map<number, Map<number, number>>();
  for (const note of score.notes) {
    if (note.startTick < startTick || note.startTick >= endTick) continue;
    const measureIdx = getMeasureIndexOfTick(note, geo, systemIndex, t);
    let ticks = byMeasure.get(measureIdx);
    if (!ticks) {
      ticks = new Map<number, number>();
      byMeasure.set(measureIdx, ticks);
    }
    ticks.set(note.startTick, (ticks.get(note.startTick) ?? 0) + 1);
  }

  for (const [measureIdx, ticks] of byMeasure) {
    const firstTick = Math.min(...ticks.keys());
    if ((ticks.get(firstTick) ?? 0) < 2) continue;
    // Only a true downbeat can drive the clasp onto the opening barline.
    if (splitTick(firstTick, t).tickInMeasure !== 0) continue;
    map.set(measureIdx, getClaspDownbeatInset(t));
  }
  return map;
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
  const claspReach = t.noteheadRadius + t.claspOffset;

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
      unit = {
        tick: p.note.startTick,
        nominalX: p.x,
        measureIdx,
        rows: [],
        shift: 0,
        spread: false,
        bandLeft: measureLeft + (insets.left ?? t.measureInset),
        bandRight: measureLeft + mWidth - (insets.right ?? t.measureInset),
        measureLeft,
        clasp: false,
        claspReach,
        claspTop: p.y - t.noteheadRadius,
        claspBot: p.y + t.noteheadRadius,
      };
      unitByTick.set(p.note.startTick, unit);
    }
    const rowKey = (p.y + 0).toFixed(3);
    let cluster = clusterByRow.get(`${p.note.startTick}|${rowKey}`);
    if (!cluster) {
      cluster = { y: p.y, key: rowKey, notes: [], halfSpan: 0 };
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
    cluster.halfSpan = ((cluster.notes.length - 1) * delta) / 2;
  }
  const units = [...unitByTick.values()];
  for (const unit of units) {
    unit.spread = unit.rows.some((cluster) => cluster.halfSpan > 0);
    // A chord/cluster (two or more simultaneous heads) is clasped; a lone
    // melodic note never is.
    const size = unit.rows.reduce((sum, cluster) => sum + cluster.notes.length, 0);
    unit.clasp = claspsActive && size >= 2;
    if (unit.clasp) {
      unit.claspTop = unit.rows.reduce((min, c) => Math.min(min, c.y), Infinity) - t.noteheadRadius;
      unit.claspBot = unit.rows.reduce((max, c) => Math.max(max, c.y), -Infinity) + t.noteheadRadius;
    }
  }

  // -------------------------------------------------------------------------
  // 1b. Fit rule. An external bracket protrudes `r + claspOffset` (7.6pt) to
  //     the left of its cluster, which a continuous 16th-note grid — whose
  //     columns sit exactly one disc diameter apart — cannot host. A clasp is
  //     therefore engraved only where it stands clear of every foreign disc by
  //     `CLASP_NOTEHEAD_AIR` and of its opening barline by `claspMinBarlineAir`;
  //     everywhere else the cluster keeps its traditional stems. This is what
  //     "only actual chords receive clasps, never feathers" means in practice.
  // -------------------------------------------------------------------------
  const claspFits = (unit: OnsetUnit): boolean => {
    const members = unit.rows.flatMap((cluster) => cluster.notes);
    const geometry = computeClaspGeometry(
      members.map((p) => p.rhythm),
      t
    );
    if (!geometry) return false;
    const disk = claspInkBox(geometry, t);
    // Slot 0 of a system opens from the left margin: there is no barline to
    // clear, only the accolade (which the fit test below covers as a foreign
    // glyph-free zone).
    if (unit.measureIdx > 0 && disk.x0 - unit.measureLeft < t.claspMinBarlineAir - CLASP_EPS) {
      return false;
    }
    for (const other of units) {
      if (other === unit) continue;
      for (const cluster of other.rows) {
        for (const p of cluster.notes) {
          const dx = Math.max(disk.x0 - p.x, 0, p.x - disk.x1);
          const dy = Math.max(disk.y0 - p.y, 0, p.y - disk.y1);
          if (Math.hypot(dx, dy) < t.noteheadRadius + CLASP_NOTEHEAD_AIR) return false;
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
  // move a single column, so the whole solve is skipped.
  if (!units.some((unit) => unit.spread || unit.clasp)) {
    return { notes: [...notes], claspTicks: new Set<number>() };
  }

  const r = t.noteheadRadius;
  const maxHalfSpan = units.reduce(
    (acc, unit) => unit.rows.reduce((a, c) => Math.max(a, c.halfSpan), acc),
    0
  );
  /** Columns further apart than this can never touch, whatever their rows. */
  const reach =
    2 * maxHalfSpan + 2 * r + delta + (hasClasp ? claspReach + CLASP_NOTEHEAD_AIR : 0);

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
          ? columnX(unit) -
            cluster.halfSpan -
            (columnX(other) + theirs.halfSpan)
          : columnX(other) -
            theirs.halfSpan -
            (columnX(unit) + cluster.halfSpan);
        const shortfall = Math.max(0, needed - gap) * (otherIsLeft ? 1 : -1);
        if (Math.abs(shortfall) > Math.abs(worst)) worst = shortfall;
      }
    }
    return worst;
  };

  const unitHalfSpan = (u: OnsetUnit): number =>
    u.rows.reduce((acc, c) => Math.max(acc, c.halfSpan), 0);
  const MIN_TIME_AIR = 1.0;

  /** Legal translation window of one column against the *current* neighbours. */
  const windowOf = (unit: OnsetUnit): { lo: number; hi: number } => {
    let lo = Number.NEGATIVE_INFINITY;
    let hi = Number.POSITIVE_INFINITY;
    const myH = unitHalfSpan(unit);

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
          const rightEdge = columnX(other) + cluster.halfSpan;
          lo = Math.max(
            lo,
            rightEdge + r + CLASP_NOTEHEAD_AIR + myH + unit.claspReach - unit.nominalX
          );
        }
      }
    }

    // Strict horizontal time monotonicity: a note at a later onset must never be placed to the left of an earlier onset
    for (const prev of ordered) {
      if (prev.tick >= unit.tick) break;
      const prevH = unitHalfSpan(prev);
      const prevXRight = columnX(prev) + prevH;
      lo = Math.max(lo, prevXRight + MIN_TIME_AIR + myH - unit.nominalX);
    }
    for (let i = ordered.length - 1; i >= 0; i--) {
      const next = ordered[i];
      if (next.tick <= unit.tick) break;
      if (next.spread || next.clasp) {
        const nextH = unitHalfSpan(next);
        const nextXLeft = columnX(next) - nextH;
        hi = Math.min(hi, nextXLeft - MIN_TIME_AIR - myH - unit.nominalX);
      }
    }

    // The measure band is structural: a spread downbeat chord may never be
    // driven onto the preceding barline.
    for (const cluster of unit.rows) {
      lo = Math.max(lo, unit.bandLeft + cluster.halfSpan - unit.nominalX);
      hi = Math.min(hi, unit.bandRight - cluster.halfSpan - unit.nominalX);
    }
    return { lo, hi: Math.max(lo, hi) };
  };

  const ordered = [...units].sort((a, b) => a.tick - b.tick);

  // -------------------------------------------------------------------------
  // 2. Spread and clasped columns first: keep the symmetric placement whenever
  //    it is legal.
  // -------------------------------------------------------------------------
  for (const unit of ordered) {
    if (!unit.spread && !unit.clasp) continue;
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
        const prevH = unitHalfSpan(prev);
        const myH = unitHalfSpan(unit);
        const prevXRight = columnX(prev) + prevH;
        const timeShortfall = prevXRight + MIN_TIME_AIR + myH - columnX(unit);
        if (timeShortfall > 0) {
          pushRight = Math.max(pushRight, timeShortfall);
        }
      }

      if (pushRight <= 0 && pushLeft <= 0) continue;
      // Step away from violation: rightward yield takes precedence to preserve time flow
      const step = pushRight > 0 ? pushRight : -pushLeft;
      if (step === 0) continue;
      const maxH = unitHalfSpan(unit);
      const clamped = Math.max(
        unit.bandLeft + maxH - unit.nominalX,
        Math.min(unit.bandRight - maxH - unit.nominalX, unit.shift + step)
      );
      if (clamped !== unit.shift) {
        unit.shift = clamped;
        moved = true;
      }
    }
    if (!moved) break;
  }

  // -------------------------------------------------------------------------
  // 4. Apply: the column translation first, then the symmetric row spread.
  // -------------------------------------------------------------------------
  const resolved = new Map<string, number>();
  for (const unit of ordered) {
    for (const cluster of unit.rows) {
      const k = cluster.notes.length;
      cluster.notes.forEach((p, i) => {
        resolved.set(p.note.id, unit.nominalX + unit.shift + (i - (k - 1) / 2) * delta);
      });
    }
  }

  return {
    notes: notes.map((p) => {
      const x = resolved.get(p.note.id);
      if (x === undefined || x === p.x) return p;
      return { ...p, x, rhythm: { ...p.rhythm, x } };
    }),
    claspTicks: new Set(ordered.filter((unit) => unit.clasp).map((unit) => unit.tick)),
  };
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
      t
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
        cluster.durationTicks === undefined ? undefined : { durationTicks: cluster.durationTicks }
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
        getMeasureOpeningBarlineX(entry.cluster.measureIdx, geometry, systemIndex, t),
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

  return {
    index: systemIndex,
    geometry,
    notes,
    beams,
    ungrouped,
    clasps,
    claspRails,
    claspedStems,
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
  t: ResolvedJankoTokens
): string {
  const out: string[] = ['  <g class="janko-notes">'];

  // 1. Dynamic ledger equators for out-of-staff octaves. They form their own
  //    layer so a later note's ledger can never cut through an earlier note's
  //    white knockout (see the linter's knockout pass-through audit).
  const ledgers: string[] = [];
  for (const p of layout.notes) {
    for (const ledgerY of p.coord.ledgerYs) {
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
  //    beam, so those standalone stems are replaced by the bracket.
  const clasped = new Set(layout.claspedStems);
  if (o.rhythmStyle === 'beamed') {
    for (const beam of layout.beams) {
      out.push(renderBeamGroup(beam.notes, t, beam));
    }
    for (const n of layout.ungrouped) {
      if (clasped.has(n.id)) continue;
      out.push(renderRhythm(n, 'beamed', t));
    }
  } else {
    for (const p of layout.notes) {
      if (clasped.has(p.rhythm.id)) continue;
      out.push(renderRhythm(p.rhythm, o.rhythmStyle, t));
    }
  }

  // 2b. External left clasps + their rails (Round 5), painted above the stems
  //     they replace and beneath the noteheads they must never touch.
  if (layout.clasps.length > 0 || layout.claspRails.length > 0) {
    out.push(renderClaspGroup(layout.clasps, layout.claspRails, t));
  }

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
  out.push(renderAccolade(geo, o, t));
  if (systemIndex === 0) {
    out.push(renderHandLabels(geo, o, t));
    out.push(renderTimeSignature(geo, o, t));
  }
  out.push(renderOctaveLabels(geo, o, t));
  out.push(renderStaffLines(geo, o, t));
  out.push(renderBeatGrid(geo, systemIndex, o, t));
  out.push(renderBarlines(geo, o, t));
  out.push(renderNotesLayer(resolved, o, t));
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

  const anacrusis = geo.tokens.anacrusisTicks ?? 0;
  const sysGeo = getSystemGeometry(geo, firstSystem);
  const isSys0Anacrusis = firstSystem === 0 && anacrusis > 0;
  const upbeatWidth = isSys0Anacrusis
    ? (anacrusis / geo.tokens.ticksPerMeasure) * sysGeo.measureWidth
    : 0;

  const x0 =
    startMIdx === 0
      ? geo.margin - CROP_PAD_X
      : geo.staffLeft + upbeatWidth + startMIdx * sysGeo.measureWidth - CROP_PAD_X;
  const x1 = geo.staffLeft + upbeatWidth + (endMIdx + 1) * sysGeo.measureWidth + CROP_PAD_X;

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
      `    <text x="${f(pad + 6)}" y="${f(top + 11)}" class="janko-caption">${panel.variant.label}</text>`
    );
    out.push(
      `    <text x="${f(pad + contentW - 6)}" y="${f(top + 11)}" class="janko-caption-sub" text-anchor="end">mm. ${panel.box.firstMeasure}–${panel.box.lastMeasure} · ${panel.variant.options.rhythmStyle}</text>`
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
