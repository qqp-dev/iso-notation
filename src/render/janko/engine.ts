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
 * fanned out asymmetrically toward the roomier side at the active
 * cluster-spacing preset (`2wx + air` per step — 5.46pt on the golden
 * `'tight'`), the pinned head keeping its column, behind the hard beat-cell
 * barriers (see {@link resolveRowSnappedChordOffsets}). The v2 solver then
 * centres each spread unit in its free space, shrinks the fan pin-preservingly
 * where room runs short, redistributes disturbed local groups and **tucks** an
 * uneven multi-row onset symmetrically (Round 19): every row narrower than the
 * widest one is re-centred on the widest row's own middle, so the cluster
 * mirrors about its centre (m. 46) while an even cluster stays exactly as the
 * fan placed it.
 *
 * Shared stems (Round 16): one onset's same-duration voices share a single
 * stem object nearest the nominal column (standard chord rule); mixed-duration
 * stacks coincide there with each voice's beam/flag at its own end. Same-row
 * seconds of mixed hands or mixed durations keep two stems at head-x.
 *
 * Public entry points
 * -------------------
 * - {@link renderJankoPage}               — full A4 page (4 systems, 16 mm.)
 * - {@link renderJankoCrop}               — targeted macro crop of N measures
 */

import { Hand, QuantizedGridScore, QuantizedNote } from '../../model/types';
import {
  CONTINUOUS_PITCH_ANCHOR_LIN,
  DEFAULT_PITCH_WINDOW,
  JankoChannelFlank,
  JankoPitchCoordinate,
  JankoTickInsets,
  computeFoldShift,
  continuousPitchY,
  getEquatorYForOctave,
  getMeasureIndexOfTick,
  getNoteHand,
  getPitchCoordinate,
  getTickX,
  pitchWindowForScore,
  resolveChannelFlanks,
  splitTick,
  usesContourFlanks,
} from './geometry';
import {
  JANKO_RHYTHM_STYLE_LABELS,
  JankoChordGrouping,
  JankoLayoutOptions,
  JankoOttavaBracket,
  JankoPageGeometry,
  JankoRhythmStyle,
  JankoSystemGeometry,
  JankoSystemStartStyle,
  JankoTokens,
  ResolvedJankoLayoutOptions,
  ResolvedJankoTokens,
  channelsGridInk,
  getClusterSpacingPreset,
  getGridNoteInset,
  protectsBarlineInk,
  resolveJankoOptions,
  resolveJankoTokens,
} from './types';
import {
  buildSystemOttavaBrackets,
  renderOttavaBrackets,
} from './elements/ottava';
import { renderJankoStyleDefs, f } from './elements/style';
import {
  renderHandLabels,
  renderLedgerEquator,
  renderOctaveLabels,
  renderOutlierRule,
  renderStaffLines,
  renderTimeSignature,
  getEquatorRuleYs,
  pitchGridRules,
  computeBarStaffRows,
  computeSystemStaffSegments,
  getBarStaffSegments,
  getBarStaffRows,
} from './elements/staff';
import { JANKO_HALO_STROKE_WIDTH, isPositionOfHonor, renderNotehead } from './elements/notehead';
import {
  JankoBeamGroupGeometry,
  JankoChordBridge,
  JankoClaspDurationInk,
  JankoClaspGroupGeometry,
  JankoClaspRailGeometry,
  JankoRhythmNote,
  JankoVerticalChordGroup,
  CLASP_MARK_REACH,
  CLASP_MIN_VERTICAL_CHORD,
  CLASP_TRANSVERSE_WIDTH,
  HONOR_STEM_ATTACHMENT_AIR,
  JANKO_STEM_STROKE_WIDTH,
  bridgeBeamGroupsAcrossRests,
  claspDurationClass,
  claspInkBox,
  claspQualifies,
  computeBeamGroupGeometry,
  computeClaspGeometry,
  computeVerticalChordGroup,
  getSubdivisionGlyphBBox,
  getStemAttachmentRadius,
  getStemGeometry,
  partitionBeamGroups,
  renderBeamGroup,
  renderChordBridges,
  renderClaspGroup,
  renderRhythm,
  stemDirection,
  subdivisionMarkCount,
  withClaspRail,
} from './elements/rhythm';
import { durationDotCount } from './elements/duration';
import {
  ARCHITECTURAL_BRACKET_SPUR,
  ARCHITECTURAL_BRACKET_STROKE,
  SYSTEM_1_ARCHITECTURAL_BRACKET_SPUR,
  SYSTEM_1_ARCHITECTURAL_BRACKET_STROKE,
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
import { buildSystemContour, contourSystemInkBounds } from './elements/contour';
import {
  JankoRestGeometry,
  isBarRestValue,
  isStandardRestValue,
  renderRest,
  restInkBox,
  restSeatOffsetY,
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
  tokens?: Partial<JankoTokens> | null,
  score?: QuantizedGridScore | null
): JankoPageGeometry {
  const o = resolveJankoOptions(options);
  const t = resolveJankoTokens(tokens);

  const margin = o.pageMargin;
  const marginLeft = o.pageMarginLeft ?? margin;
  const marginRight = o.pageMarginRight ?? margin;
  const marginTop = o.pageMarginTop ?? margin;
  const marginBottom = o.pageMarginBottom ?? margin;
  const printableHeight = o.pageHeight - marginTop - marginBottom;
  const bodyHeight = printableHeight - o.headerHeight - o.footerHeight;
  const systemsPerPage = Math.max(1, Math.round(o.systemsPerPage));
  const measuresPerSystem = Math.max(1, Math.round(o.measuresPerSystem));
  const slotHeight = bodyHeight / systemsPerPage;

  const staffLeft = marginLeft + t.accoladeWidth + t.accoladeGap;
  const staffRight = o.pageWidth - marginRight;
  const staffWidth = staffRight - staffLeft;
  const measureWidth = staffWidth / measuresPerSystem;

  // The continuous window: the score's own range (every system shares one
  // absolute grid), or the four-octave fallback when no score is given.
  const isFixedCore = o.core === 'fixed-3' || o.core === 'fixed-4';
  const continuous = o.pitchMapping !== 'twin-rows' || isFixedCore;
  const pitchWindow = continuous && !isFixedCore
    ? score
      ? pitchWindowForScore(score)
      : { ...DEFAULT_PITCH_WINDOW }
    : null;

  const systems: JankoSystemGeometry[] = [];
  for (let s = 0; s < systemsPerPage; s++) {
    const slotTopY = marginTop + o.headerHeight + s * slotHeight;
    if (isFixedCore) {
      const scale = t.semitoneScale;
      const slotCenterY = slotTopY + slotHeight / 2;
      const middleCY = o.core === 'fixed-3' ? slotCenterY + 2.0 : slotCenterY - 0.5 * scale;

      const anacrusis = t.anacrusisTicks ?? 0;
      const startTick = s === 0 ? 0 : anacrusis + s * measuresPerSystem * t.ticksPerMeasure;
      const endTick = anacrusis + (s + 1) * measuresPerSystem * t.ticksPerMeasure;
      const sysNotes = score
        ? score.notes.filter((n) => n.startTick >= startTick && n.startTick < endTick)
        : [];

      const isSys0Anacrusis = s === 0 && (t.anacrusisTicks ?? 0) > 0;
      const effectiveMeasures = isSys0Anacrusis
        ? measuresPerSystem + t.anacrusisTicks! / t.ticksPerMeasure
        : measuresPerSystem;
      const measureWidth = staffWidth / effectiveMeasures;

      const {
        segments: staffSegments,
        staffLines,
        coreLines,
        extensionLines,
      } = computeSystemStaffSegments(
        sysNotes,
        s,
        measuresPerSystem,
        staffLeft,
        staffRight,
        measureWidth,
        o.core,
        t,
        o.extensionJunction
      );

      const writtenLins: number[] = [];
      for (const n of sysNotes) {
        const pc = ((n.pitch.pitchClass % 12) + 12) % 12;
        const lin = n.pitch.octave * 12 + pc;
        const shift = computeFoldShift(lin, o.core);
        writtenLins.push(lin + shift);
      }

      const allLins = [...coreLines, ...staffLines, ...writtenLins];
      const effMin = Math.min(...allLins);
      const effMax = Math.max(...allLins);
      const staffTopY = middleCY + continuousPitchY(effMax, scale) - 16.0;
      const staffBotY = middleCY + continuousPitchY(effMin, scale) + 16.0;

      const equatorY = (hand: Hand, octave: number): number =>
        middleCY + getEquatorYForOctave(octave, hand, t, o);

      systems.push({
        index: s,
        measuresPerSystem,
        slotTopY,
        systemTopY: staffTopY + 7.0,
        middleCY,
        staffTopY,
        staffBotY,
        staffLeft,
        staffRight,
        measureWidth,
        equatorY,
        pitchWindow: { min: effMin, max: effMax },
        coreLines,
        extensionLines,
        staffLines,
        staffSegments,
      });
      continue;
    }
    if (continuous && pitchWindow) {
      // The window box (lanes plus the golden 16pt of stem/beam air each
      // side) is centred in the slot; the Middle C line lands where the
      // anchor says. A window taller than the slot still renders — centred
      // and overflowing — and the linter names it (`system-slot-overlap`).
      const scale = t.semitoneScale;
      const topSpan = (pitchWindow.max - CONTINUOUS_PITCH_ANCHOR_LIN) * scale;
      const botSpan = (CONTINUOUS_PITCH_ANCHOR_LIN - pitchWindow.min) * scale;
      const boxH = topSpan + botSpan + 32.0;
      const slack = Math.max(0, (slotHeight - boxH) / 2);
      const staffTopY = slotTopY + slack;
      const staffBotY = staffTopY + boxH;
      const middleCY = staffTopY + 16.0 + topSpan;
      const equatorY = (hand: Hand, octave: number): number =>
        middleCY + getEquatorYForOctave(octave, hand, t, o);
      const isSys0Anacrusis = s === 0 && (t.anacrusisTicks ?? 0) > 0;
      const effectiveMeasures = isSys0Anacrusis
        ? measuresPerSystem + t.anacrusisTicks! / t.ticksPerMeasure
        : measuresPerSystem;
      systems.push({
        index: s,
        measuresPerSystem,
        slotTopY,
        systemTopY: staffTopY + 7.0,
        middleCY,
        staffTopY,
        staffBotY,
        staffLeft,
        staffRight,
        measureWidth: staffWidth / effectiveMeasures,
        equatorY,
        pitchWindow: { ...pitchWindow },
      });
      continue;
    }
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
    marginLeft,
    marginRight,
    marginTop,
    marginBottom,
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
    ...(pitchWindow ? { pitchWindow: { ...pitchWindow } } : {}),
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
  const y = geo.marginTop;
  if (pageIndex === 0) {
    const cx = geo.pageWidth / 2;
    return [
      '  <g id="page-header">',
      `    <text x="${f(cx)}" y="${f(y + 14)}" class="janko-title" text-anchor="middle">${o.title}</text>`,
      `    <text x="${f(cx)}" y="${f(y + 27)}" class="janko-subtitle" text-anchor="middle">${o.subtitle}</text>`,
      `    <text x="${f(geo.pageWidth - geo.marginRight)}" y="${f(y + 27)}" class="janko-meta" text-anchor="end">${o.composer}</text>`,
      '  </g>',
    ].join('\n');
  }
  const running = [o.composer, o.title, o.subtitle].filter((part) => part.length > 0).join(' · ');
  return [
    '  <g id="page-header">',
    `    <text x="${f(geo.marginLeft)}" y="${f(y + 10)}" class="janko-running-head">${running}</text>`,
    '  </g>',
  ].join('\n');
}

/**
 * Page footer (Round 10): the page numbering alone, at normal weight. The
 * repetitive "Pure 12-TET Jánko Two-Row Grand Staff" slogan is gone.
 */
function renderPageFooter(geo: JankoPageGeometry, pageIndex: number, totalPages: number): string {
  // Pinned 12pt above the paper edge (identical to `pageHeight - margin + 12`
  // at the golden 24pt margin), independent of the bottom margin override.
  const y = geo.pageHeight - 12;
  return [
    '  <g id="page-footer">',
    `    <text x="${f(geo.pageWidth - geo.marginRight)}" y="${f(y)}" class="janko-page-num" text-anchor="end">Page ${pageIndex + 1} of ${totalPages}</text>`,
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
 *
 * Round 32 (opt-in `correctPageTopAnacrusisMeasureWidth`): slot 0 carries
 * system 0's pickup-reduced denominator, so later page-top systems
 * (`systemIndex > 0`, `slot === 0`) inherit a narrowed measure width with a
 * blank tail. When the correction is enabled, those systems use the normal
 * full-measure width (`geo.measureWidth`) instead — every vertical/slot
 * property, staff margin and normal-system behavior is preserved; system 0
 * keeps its pickup geometry and no-pickup scores are unchanged. The flag is
 * read from the explicit `options` override when given, else `geo.options`.
 */
export function getSystemGeometry(
  geo: JankoPageGeometry,
  systemIndex: number,
  options?: Partial<JankoLayoutOptions> | null
): JankoSystemGeometry {
  const perPage = Math.max(1, geo.systemsPerPage);
  const slot = ((systemIndex % perPage) + perPage) % perPage;
  const base = geo.systems[slot];
  const correction =
    options?.correctPageTopAnacrusisMeasureWidth ??
    geo.options.correctPageTopAnacrusisMeasureWidth ??
    false;
  const anacrusis = geo.tokens.anacrusisTicks ?? 0;
  if (!correction || anacrusis <= 0 || systemIndex <= 0 || slot !== 0) {
    return base;
  }
  if (base.measureWidth === geo.measureWidth) return base;
  return { ...base, measureWidth: geo.measureWidth };
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
  /**
   * Round 20: for a rhythm voice merged into a cross-hand unison, the id of the
   * head that keeps the digit — the voice follows that head's solved column so
   * its stem leaves the merged notehead.
   */
  unisonSurvivorId?: string;
  /**
   * Round 23: a foreign stem crosses this note, so its knockout paints tall
   * (`hy + stemAttachmentAir`) and the stem resumes with the same breathing
   * room as an own-stem attachment. Paint-only: the head never moves.
   */
  tallKnockout?: boolean;
  /**
   * Round 27: Ottava octave fold shift in semitones (-12, +12, -24, +24) applied to written pitch.
   */
  ottavaShift?: number;
  /**
   * Round 27: Written linear pitch after fold shift is applied.
   */
  writtenLin?: number;
}

/**
 * Round 20 — one merged cross-hand unison: **one onset + one pitch = one sound
 * event = one digit**, always.
 */
export interface JankoUnisonMerge {
  /** Onset tick of the merged sound. */
  tick: number;
  /** Pitch class of the merged sound. */
  pitchClass: number;
  /** Octave of the merged sound. */
  octave: number;
  /** The head that keeps the digit — the lower voice (the Round 21 anchor rule). */
  survivorId: string;
  /** Heads merged into it; their digits are never painted. */
  mergedIds: string[];
  /**
   * True when every merged voice carried the same duration: the voices are
   * identical, so the sound carries **one** rhythm statement. A mixed-duration
   * unison keeps every voice's own stem/beam/flag (the existing mixed-duration
   * machinery), so its merged voices ride in {@link JankoSystemLayout.unisonVoices}.
   */
  exact: boolean;
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
  /**
   * Round 19: true when this cluster is the **unified** bracket of an onset
   * whose two hands' spans overlap or touch. The bracket then spans every head
   * of the onset and paints one duration group per hand (see
   * {@link JankoClaspDurationInk}): the open half/whole marks at the bracket's
   * own midpoint, the transverse subdivision marks at their hand's centre.
   */
  unified?: boolean;
}

/**
 * Round 6/8/19 — the clasp groups of **one onset** under the
 * `'per-hand-clasp'` paradigm.
 *
 * Round 6/8 rule (unchanged): the grouping unit is the **hand**. A hand's
 * onset is grouped when it carries two or more heads that are horizontally
 * displaced (row-snapped parity offset), or when it is a vertical chord of
 * three or more heads; a clean 2-note column and a lone melodic note are never
 * grouped.
 *
 * Round 19 **overlap-conditional unification**: when *both* hands of the onset
 * produce a qualifying group and their vertical spans (member heads grown by
 * the notehead disc) overlap or touch, the two per-hand brackets would sit on
 * top of one another and the onset is grouped as **one** bracket spanning every
 * head of the onset (m. 46: RH 93.7–148.3 + LH 138.7–178.3 → one 93.7–178.3
 * bracket). Disjoint spans keep the Round 6 per-hand brackets unchanged — the
 * m. 3 downbeat regression guard, whose 90pt hand gap must stay split.
 *
 * `spreadX` supplies the x the qualification test measures (the pre-solve
 * row-snapped **offset** inside the column solve, the final page x once the
 * columns are solved).
 */
export function resolveOnsetClaspGroups(
  onset: readonly PositionedJankoNote[],
  t: ResolvedJankoTokens,
  spreadX: (p: PositionedJankoNote) => number
): PositionedJankoNote[][] {
  const byHand = new Map<Hand, PositionedJankoNote[]>();
  for (const p of onset) {
    const bucket = byHand.get(p.rhythm.hand);
    if (bucket) bucket.push(p);
    else byHand.set(p.rhythm.hand, [p]);
  }
  const groups: PositionedJankoNote[][] = [];
  for (const hand of ['RH', 'LH'] as const) {
    const group = byHand.get(hand);
    if (!group || group.length < 2) continue;
    const displaced = group.map((p) => ({ ...p.rhythm, x: spreadX(p) }));
    if (claspQualifies(displaced)) groups.push(group);
  }
  if (groups.length < 2) return groups;
  /** Vertical span of one group's heads, disc included. */
  const span = (group: readonly PositionedJankoNote[]): { top: number; bot: number } => ({
    top: Math.min(...group.map((p) => p.y)) - t.noteheadRadius,
    bot: Math.max(...group.map((p) => p.y)) + t.noteheadRadius,
  });
  const [a, b] = [span(groups[0]), span(groups[1])];
  const disjoint = a.bot < b.top - EPS || b.bot < a.top - EPS;
  if (disjoint) return groups;
  return [[...onset].sort((p, q) => p.y - q.y || p.x - q.x)];
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
      // Round 6/8 scope per hand (a spread cluster or a 3+ head vertical
      // chord), unified into one cross-hand bracket by Round 19 when the two
      // hands' spans overlap or touch.
      const handGroups = resolveOnsetClaspGroups(onset, t, (p) => p.rhythm.x);
      const unified = handGroups.length === 1 && handGroups[0].length === onset.length;
      for (const members of handGroups) {
        groups.push({
          notes: members,
          measureIdx: measureOf(members[0]),
          ...(unified ? { unified: true } : {}),
        });
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
 * protected air at all — the music uses the full measure width and the
 * elliptical knockout erases whatever it crosses — so only the disc-to-disc
 * rule remains.
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
  systemStartStyle: JankoSystemStartStyle = 'architectural-bracket',
  isSystem1: boolean = true
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
    const top = geometry.middleCY + continuousPitchY(60, t.semitoneScale);
    const bot = geometry.middleCY + continuousPitchY(36, t.semitoneScale);
    let x0 = x;
    let x1 = x;
    if (systemStartStyle === 'architectural-bracket') {
      const spur = isSystem1 ? SYSTEM_1_ARCHITECTURAL_BRACKET_SPUR : ARCHITECTURAL_BRACKET_SPUR;
      const stroke = isSystem1 ? SYSTEM_1_ARCHITECTURAL_BRACKET_STROKE : ARCHITECTURAL_BRACKET_STROKE;
      const half = stroke / 2;
      x0 = x - half;
      x1 = x + spur + half;
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
 * on every system, the measure numeral only where the engine draws it), in the
 * order the linter audits them.
 */
export function systemFurniture(
  geometry: JankoSystemGeometry,
  o: ResolvedJankoLayoutOptions,
  t: ResolvedJankoTokens,
  systemIndex: number
): JankoBox[] {
  const anacrusis = t.anacrusisTicks ?? 0;
  const isSystem1 = systemIndex === 0;
  const { numeral, accolade } = getMarginFurniture(
    geometry,
    t,
    systemIndex * o.measuresPerSystem + 1,
    MARGIN_DIGIT_ADVANCE,
    o.systemStartStyle,
    isSystem1
  );
  const boxes: JankoBox[] = accolade ? [accolade] : [];
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
   * to pieces by a grouping bracket. A clasp member that carries its cluster's
   * Round 16 shared stem likewise keeps it (see {@link JankoSharedStemGroup}).
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
  /**
   * Round 16 shared stems: one hand's same-duration voices of one onset share
   * a single stem object on the nominal column (standard chord rule) — stacked
   * or flanked, clasped or bare. Mixed-duration and cross-hand clusters keep
   * their per-voice stems (coincident on the column for stacks, at head-x for
   * flanked seconds).
   */
  sharedStems: JankoSharedStemGroup[];
  /**
   * Round 19: the **laid-out column** (page pt) of every onset of the system —
   * the beat's true x after the column solve's rigid translation. The beat grid
   * paints its dotted quarter lines through these columns where a beat carries
   * an onset (see `renderBeatGrid`), so the pulse and the music share one axis.
   */
  columns: ReadonlyMap<number, number>;
  /**
   * Round 20: every cross-hand unison of the system, merged to one digit (see
   * {@link JankoUnisonMerge}). The linter audits the same list
   * (`unison-double-digit`), so the defect class can never return silently.
   */
  unisonMerges: JankoUnisonMerge[];
  /**
   * Round 20: the rhythm voices of **mixed-duration** merged unisons. Each
   * voice keeps its own stem/beam/flag — the existing mixed-duration machinery,
   * which never assumed a single hand — and stands on the merged head's column.
   */
  unisonVoices: PositionedJankoNote[];
  /** Round 27: Gould-compliant ottava spanner brackets rendered for this system. */
  ottavaBrackets: JankoOttavaBracket[];
}

/**
 * Round 16: one hand's same-duration voices of one onset, unified under one
 * stem object.
 *
 * The carrier stands on (or nearest) the nominal column, at the extremity in
 * stem direction, and draws the shared duration; the members draw no stem of
 * their own. A stacked onset and a flanked row cluster share the rule — the
 * Brahms held-chord triples take one shared stem each exactly like a vertical
 * chord does — and a clasped group keeps its bracket: the clasp still owns the
 * cluster's duration paradigm, the shared stem is the one stem the bracket
 * does not replace.
 */
export interface JankoSharedStemGroup {
  /** Onset tick of the shared voices. */
  tick: number;
  /** Hand the shared stem belongs to. */
  hand: Hand;
  /** Id of the head that carries the shared stem. */
  carrierId: string;
  /** Ids of the member heads whose own stems are suppressed. */
  suppressedIds: string[];
}

/**
 * Every note id whose standalone stem is **not** painted: clasp-replaced stems,
 * gap-gated vertical-chord interiors, and Round 16 shared-stem members. One
 * helper so the renderer and the linter always agree on which stems exist.
 */
export function suppressedStemIds(layout: JankoSystemLayout): Set<string> {
  return new Set([
    ...layout.claspedStems,
    ...layout.verticalChords.flatMap((chord) => chord.suppressedIds),
    ...layout.sharedStems.flatMap((group) => group.suppressedIds),
  ]);
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
  // on the barline, where its rectangular mask erases it.
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
export function getTickColumnX(
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
 * Round 17 augmentation-dot lane: the page y of the dot that belongs to a
 * notehead at `y`.
 *
 * The dot hugs its mask's top-right corner in the low lane
 * (`augmentationDotRowOffset`, 3.5pt above the head), always right of its head
 * with a uniform sign (`dotY < head`), every bar. The high lane (half a
 * whole-tone row up) survives only as the fallback when a same-row neighbour
 * sits inside the mask band (see {@link resolveDotHighLane}).
 *
 * Where the canonical lane would still graze a painted rule (a lane that
 * coincides with an equator rule, or the bounded channel's
 * `equator ± channelHalfWidth` pair), the dot steps just far enough off the
 * rule to keep `dotRadius + halfStroke + 0.25pt` of air — staying above its
 * head throughout.
 */
function resolveAugmentationDotY(
  y: number,
  geo: JankoSystemGeometry,
  hand: Hand,
  o: ResolvedJankoLayoutOptions,
  t: ResolvedJankoTokens,
  highLane: boolean = false
): number {
  let dotY = y - (highLane ? t.rowHeight / 2 : t.augmentationDotRowOffset);
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
  // Structural uniform sign: the rule-graze steps fit the dot around painted
  // rules, but the result may never drop to (or below) the head row itself.
  return Math.min(dotY, y - EPS);
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
  const preset = getClusterSpacingPreset(o.clusterSpacing);
  const honor = isPositionOfHonor(note.startTick) && o.showHonorHalo;
  const pc = ((note.pitch.pitchClass % 12) + 12) % 12;
  const origLin = note.pitch.octave * 12 + pc;
  const shift = computeFoldShift(origLin, o.core);
  const writtenLin = origLin + shift;
  return {
    note,
    coord,
    x,
    y,
    ottavaShift: shift !== 0 ? shift : undefined,
    writtenLin,
    rhythm: {
      id: note.id,
      startTick: note.startTick,
      durationTicks: note.durationTicks,
      hand,
      x,
      y,
      dotX: x + preset.wx + t.augmentationDotGap,
      dotY: resolveAugmentationDotY(y, geo, hand, o, t),
      stemAttachR: honor
        ? t.haloRadius + HONOR_STEM_ATTACHMENT_AIR
        : preset.hy + t.stemAttachmentAir,
    },
  };
}

/**
 * Round 17 dot high-lane fallback: after the chord-column solve, a dotted head
 * whose low-lane dot would sit inside a same-row neighbour's mask (grown by
 * the dot radius) is lifted to the high lane. Vacuous on Bach's 19 dots —
 * every same-row neighbour stands at least a 16th column (10.2pt) away — but
 * the fallback keeps a crowded same-row onset honest instead of painting a
 * dot-collision.
 */
export function resolveDotHighLane(
  notes: readonly PositionedJankoNote[],
  geo: JankoSystemGeometry,
  o: ResolvedJankoLayoutOptions,
  t: ResolvedJankoTokens
): PositionedJankoNote[] {
  const dotR = t.augmentationDotRadius;
  return notes.map((p) => {
    const dur = p.note.durationTicks;
    if (durationDotCount(dur, o.durationGrammar) < 1) return p;
    const dotX = p.rhythm.dotX ?? p.x + getClusterSpacingPreset(o.clusterSpacing).wx;
    const dotY = p.rhythm.dotY ?? p.y;
    for (const q of notes) {
      if (q === p || Math.abs(q.y - p.y) >= EPS) continue;
      const { wx, hy } = knockoutHalfExtents(o, t, q.note.startTick);
      const dx = Math.max(q.x - wx - dotX, 0, dotX - (q.x + wx));
      const dy = Math.max(q.y - hy - dotY, 0, dotY - (q.y + hy));
      if (Math.hypot(dx, dy) >= dotR - EPS) continue;
      return {
        ...p,
        rhythm: {
          ...p.rhythm,
          dotY: resolveAugmentationDotY(p.y, geo, p.rhythm.hand, o, t, true),
        },
      };
    }
    return p;
  });
}

/**
 * **Augmentation dot flag clearance** (the Round 29 standard, now the golden rule).
 *
 * A dotted note's augmentation dot must clear its true verbatim flag ink box
 * by at least `augmentationDotGap` (1.2pt), escaping RIGHT first (preserving
 * height-meaning), then UP, never left or down.
 */
export function resolveDotFlagClearance(
  notes: readonly PositionedJankoNote[],
  geo: JankoSystemGeometry,
  o: ResolvedJankoLayoutOptions,
  t: ResolvedJankoTokens
): PositionedJankoNote[] {
  const dotR = t.augmentationDotRadius;
  const gap = t.augmentationDotGap;
  const haloOuter = t.haloRadius + JANKO_HALO_STROKE_WIDTH / 2;

  // Standalone/unbeamable notes with marks carry flags.
  const rhythmNotes = notes.map((p) => p.rhythm);
  const partition =
    o.rhythmStyle === 'beamed' ? partitionBeamGroups(rhythmNotes, t, geo.middleCY) : null;
  const beamedIds = partition
    ? new Set(partition.groups.flatMap((g) => g.map((n) => n.id)))
    : null;

  return notes.map((p) => {
    const dur = p.note.durationTicks;
    if (durationDotCount(dur, o.durationGrammar) < 1) return p;
    if (beamedIds && beamedIds.has(p.note.id)) return p;
    // Round 30: the escape clears the TRUE flag ink — under the complete
    // grammar a double-dotted 16th's two-mark glyph, not the legacy one.
    const marks = subdivisionMarkCount(dur, o.durationGrammar);
    if (marks < 1) return p;

    const s = getStemGeometry(p.rhythm, t);
    const bbox = getSubdivisionGlyphBBox(o.subdivisionStyle, s.direction, marks, t);
    const fBox = {
      x0: s.stemX + bbox.x0,
      y0: s.stemEndY + bbox.y0,
      x1: s.stemX + bbox.x1,
      y1: s.stemEndY + bbox.y1,
    };

    const curX =
      p.rhythm.dotX ?? p.x + getClusterSpacingPreset(o.clusterSpacing).wx + gap;
    const curY = p.rhythm.dotY ?? p.y;

    const dx = Math.max(fBox.x0 - curX, 0, curX - fBox.x1);
    const dy = Math.max(fBox.y0 - curY, 0, curY - fBox.y1);
    const distToFlag = Math.hypot(dx, dy) - dotR;
    if (distToFlag >= gap - 1e-9) return p;

    // Must escape!
    // Try escaping RIGHT first (preserves height-meaning)
    const rightX = fBox.x1 + dotR + gap;
    let rightBlocked = false;
    for (const q of notes) {
      if (q === p) continue;
      const { wx, hy } = knockoutHalfExtents(o, t, q.note.startTick);
      const qdx = Math.max(q.x - wx - rightX, 0, rightX - (q.x + wx));
      const qdy = Math.max(q.y - hy - curY, 0, curY - (q.y + hy));
      const d = isPositionOfHonor(q.note.startTick)
        ? Math.hypot(rightX - q.x, curY - q.y) - haloOuter
        : Math.hypot(qdx, qdy);
      if (d < dotR - EPS) {
        rightBlocked = true;
        break;
      }
    }

    if (!rightBlocked) {
      return {
        ...p,
        rhythm: {
          ...p.rhythm,
          dotX: rightX,
          dotY: curY,
        },
      };
    }

    // Try escaping UP
    const upY = fBox.y0 - dotR - gap;
    let upBlocked = false;
    for (const q of notes) {
      if (q === p) continue;
      const { wx, hy } = knockoutHalfExtents(o, t, q.note.startTick);
      const qdx = Math.max(q.x - wx - curX, 0, curX - (q.x + wx));
      const qdy = Math.max(q.y - hy - upY, 0, upY - (q.y + hy));
      const d = isPositionOfHonor(q.note.startTick)
        ? Math.hypot(curX - q.x, upY - q.y) - haloOuter
        : Math.hypot(qdx, qdy);
      if (d < dotR - EPS) {
        upBlocked = true;
        break;
      }
    }

    if (!upBlocked) {
      return {
        ...p,
        rhythm: {
          ...p.rhythm,
          dotX: curX,
          dotY: upY,
        },
      };
    }

    // Escape totality: dots are mandatory ink (no refusal path)
    return {
      ...p,
      rhythm: {
        ...p.rhythm,
        dotX: rightX,
        dotY: curY,
      },
    };
  });
}

/**
 * Round 30 — **the second augmentation dot** (complete grammar only).
 *
 * A double-dotted value dots twice: the second dot continues the first
 * dot's escape further along the same right-then-up priority, keeping the
 * house hug (`augmentationDotGap`, 1.2pt) from its sibling dot, from every
 * notehead mask, and from its own true flag ink, plus the staff-rule air
 * the first-dot lane keeps. The search is deterministic: angles from pure
 * right (0°) up to vertical, distance-major — the canonical horizontal pair
 * (`dotX + 2r + gap`, same height) wins whenever it clears, so the pair
 * reads as one classical double dot and only rises when blocked. Barlines
 * and beat pulses are backstopped by the linter (the corpus clears them by
 * 11pt and 5pt respectively at the naive seat).
 *
 * Golden grammar: a no-op returning its input untouched (no `dot2X` is ever
 * resolved, so golden layouts compare deep-equal).
 */
export function resolveSecondDots(
  notes: readonly PositionedJankoNote[],
  geo: JankoSystemGeometry,
  o: ResolvedJankoLayoutOptions,
  t: ResolvedJankoTokens
): PositionedJankoNote[] {
  if (o.durationGrammar !== 'complete') return [...notes];
  const dotR = t.augmentationDotRadius;
  const gap = t.augmentationDotGap;
  const siblingGap = 2 * dotR + gap;
  const haloOuter = t.haloRadius + JANKO_HALO_STROKE_WIDTH / 2;
  const preset = getClusterSpacingPreset(o.clusterSpacing);

  const rhythmNotes = notes.map((p) => p.rhythm);
  const partition =
    o.rhythmStyle === 'beamed' ? partitionBeamGroups(rhythmNotes, t, geo.middleCY) : null;
  const beamedIds = partition
    ? new Set(partition.groups.flatMap((g) => g.map((n) => n.id)))
    : null;

  // Staff rules the dot must clear, exactly as the first-dot lane fits them.
  const rules: Array<{ y: number; clearance: number }> = [];
  for (let octave = 0; octave <= 8; octave++) {
    for (const hand of ['RH', 'LH'] as const) {
      const base = geo.middleCY + getEquatorYForOctave(octave, hand, t, o);
      for (const ruleY of getEquatorRuleYs(base, o, t)) {
        rules.push({ y: ruleY, clearance: dotR + 0.375 + 0.25 });
      }
    }
  }

  return notes.map((p) => {
    const dur = p.note.durationTicks;
    if (durationDotCount(dur, o.durationGrammar) < 2) return p;
    const firstX = p.rhythm.dotX ?? p.x + preset.wx + gap;
    const firstY = p.rhythm.dotY ?? p.y;

    // The note's own true flag ink box (unbeamed flagged notes only), under
    // the complete grammar's mark count.
    let flagBox: { x0: number; y0: number; x1: number; y1: number } | null = null;
    if (!beamedIds || !beamedIds.has(p.note.id)) {
      const marks = subdivisionMarkCount(dur, o.durationGrammar);
      if (marks >= 1) {
        const s = getStemGeometry(p.rhythm, t);
        const bbox = getSubdivisionGlyphBBox(o.subdivisionStyle, s.direction, marks, t);
        flagBox = {
          x0: s.stemX + bbox.x0,
          y0: s.stemEndY + bbox.y0,
          x1: s.stemX + bbox.x1,
          y1: s.stemEndY + bbox.y1,
        };
      }
    }

    /** Edge air the dot's ink at `(x, y)` keeps from the glyph obstacles. */
    const edgeAir = (x: number, y: number): number => {
      let air = Math.hypot(x - firstX, y - firstY) - 2 * dotR;
      for (const q of notes) {
        if (q === p) continue;
        if (isPositionOfHonor(q.note.startTick)) {
          air = Math.min(air, Math.hypot(x - q.x, y - q.y) - haloOuter - dotR);
          continue;
        }
        const { wx, hy } = knockoutHalfExtents(o, t, q.note.startTick);
        const dx = Math.max(q.x - wx - x, 0, x - (q.x + wx));
        const dy = Math.max(q.y - hy - y, 0, y - (q.y + hy));
        air = Math.min(air, Math.hypot(dx, dy) - dotR);
      }
      if (flagBox) {
        const dx = Math.max(flagBox.x0 - x, 0, x - flagBox.x1);
        const dy = Math.max(flagBox.y0 - y, 0, y - flagBox.y1);
        air = Math.min(air, Math.hypot(dx, dy) - dotR);
      }
      return air;
    };
    /** Excess beyond the first-dot lane's staff-rule air (≥ 0 clears). */
    const ruleExcess = (y: number): number => {
      let excess = Number.POSITIVE_INFINITY;
      for (const rule of rules) {
        excess = Math.min(excess, Math.abs(y - rule.y) - rule.clearance);
      }
      return excess;
    };

    // Distance-major over the right-then-up fan: the horizontal pair first.
    const ANGLES = [0, 15, 30, 45, 60, 75, 90];
    for (let d = siblingGap; d <= siblingGap + 24; d += 0.25) {
      for (const degrees of ANGLES) {
        const angle = (degrees * Math.PI) / 180;
        const x = firstX + d * Math.cos(angle);
        const y = firstY - d * Math.sin(angle);
        if (edgeAir(x, y) >= gap - 1e-9 && ruleExcess(y) >= -1e-9) {
          // Snap the canonical seat exactly: float dust must never move a
          // dot that sits precisely on the horizontal pair.
          const exact =
            degrees === 0 && Math.abs(d - siblingGap) < 1e-9
              ? { x: firstX + siblingGap, y: firstY }
              : { x, y };
          return { ...p, rhythm: { ...p.rhythm, dot2X: exact.x, dot2Y: exact.y } };
        }
      }
    }
    // Escape totality: the horizontal pair, exactly as the renderer falls
    // back to it (the linter names the collision if one survives).
    return {
      ...p,
      rhythm: { ...p.rhythm, dot2X: firstX + siblingGap, dot2Y: firstY },
    };
  });
}

// ---------------------------------------------------------------------------
// Round 12 — voice rests for the inactive spans of an active hand
// (Round 17B: phrase-row hang with an along-the-row slot search and an
// adjacent-row vertical fallback)
// ---------------------------------------------------------------------------

/**
 * Air (pt) a rest's ink box keeps from a foreign notehead disc. Mirrors
 * `DEFAULT_JANKO_LINT_OPTIONS.minClearance` and the clasp fit rule, so a rest the
 * engine admits can never be a surprise collision.
 */
export const REST_NOTEHEAD_AIR = 1.0;

/**
 * Round 16 **guaranteed seating air** (pt): the air the slot solver reserves
 * between a rest's ink box and every foreign notehead disc.
 *
 * `REST_NOTEHEAD_AIR` is the linter's *hard floor* — the clearance below which
 * a painted rest is a violation. Seating a rest exactly on that floor is what
 * produced the Round 13 "slid into an unreadable spot" defect: the ink grazed
 * the disc it had been pushed against. The solver therefore seats a rest with
 * `2 × minClearance +` the rest stroke's half-width (`2.0 + 0.45 ≈ 2.4pt`) of
 * air, so the silence reads as its own written sign and not as a hairline
 * touch on the head it stands beside. The linter's floor is unchanged — a
 * seated fit always satisfies it with room to spare.
 */
export const REST_SEAT_AIR = 2.4;

/**
 * Effective clearance radius (pt) the rest fit keeps around one notehead: the
 * notehead disc — or the wider Position of Honor halo ring for the tick-0
 * opening sounds, exactly as `checkRestClearance` measures it — plus the
 * guaranteed {@link REST_SEAT_AIR} and the float-safety
 * {@link REST_FIT_MARGIN}. Deliberately circular (conservative): the linter
 * audits rests against the same circular bound.
 */
function restClearanceRadius(
  p: PositionedJankoNote,
  t: ResolvedJankoTokens
): number {
  const glyph = isPositionOfHonor(p.note.startTick)
    ? Math.max(t.noteheadRadius, t.haloRadius + JANKO_HALO_STROKE_WIDTH / 2)
    : t.noteheadRadius;
  return glyph + REST_SEAT_AIR + REST_FIT_MARGIN;
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
 * Signed offsets from an octave equator that are **real note positions** under
 * the active channel layout — the whole-tone rows a rest may hang from
 * ("actual places": a row is where a note would go).
 */
export function wholeToneRowOffsets(
  o: ResolvedJankoLayoutOptions,
  t: ResolvedJankoTokens
): number[] {
  if (o.channelLayout === 'on-the-line') return [0, -t.rowHeight];
  if (o.channelLayout === 'single-line-3row') return [0, -t.rowHeight, t.rowHeight];
  if (o.channelLayout === 'bounded-channel') {
    return [0, -t.channelFlankOffset, t.channelFlankOffset];
  }
  return [t.rowHeight / 2, -t.rowHeight / 2];
}

/**
 * The rest-seating tie-break: nearer the query wins; an exact tie prefers the
 * candidate nearer Middle C, then the upper candidate. Deterministic, so the
 * same voice always seats the same row.
 */
function prefersRowCandidate(
  candidate: number,
  best: number,
  query: number,
  middleCY: number
): boolean {
  const distance = Math.abs(candidate - query);
  const bestDistance = Math.abs(best - query);
  if (distance < bestDistance - EPS) return true;
  if (Math.abs(distance - bestDistance) > EPS) return false;
  const corridor = Math.abs(candidate - middleCY);
  const bestCorridor = Math.abs(best - middleCY);
  if (corridor < bestCorridor - EPS) return true;
  if (Math.abs(corridor - bestCorridor) > EPS) return false;
  return candidate < best - EPS;
}

/**
 * Round 17B: the **phrase-row reference** of one rest — the nearest whole-tone
 * row of the phrase octave, and the corridor side the glyph extends toward.
 *
 * The voice query is the melodic register of the rest's own hand at the gap:
 * the mean of the releasing and resuming rows, the single neighbour's exact
 * row when the silence opens or closes the hand's system, or the hand's
 * canonical voice equator (RH Octave 4, LH Octave 3) with no neighbour at all.
 * The phrase octave is the octave whose equator stands nearest that query, and
 * the reference row is the nearest whole-tone row of that octave (staff
 * octaves 2…5 plus the ledger registers 0, 1 and 6…8) — a real note position,
 * never a rule between rows. Precedence is row over corridor: the phrase row
 * decides the seat, the corridor only the hang side. Same voice, same row,
 * every bar.
 */
function restPhraseRowReference(
  hand: Hand,
  releaseOnsetTick: number,
  resumeTick: number,
  notes: readonly PositionedJankoNote[],
  geo: JankoSystemGeometry,
  t: ResolvedJankoTokens,
  o: ResolvedJankoLayoutOptions
): { rowY: number; dir: 1 | -1 } {
  const prevY = voiceYAt(notes, hand, releaseOnsetTick);
  const nextY = voiceYAt(notes, hand, resumeTick);
  const query =
    prevY !== null && nextY !== null
      ? (prevY + nextY) / 2
      : (prevY ?? nextY ?? geo.middleCY + getEquatorYForOctave(hand === 'RH' ? 4 : 3, hand, t, o));
  // Continuous mappings snap to drawn lines: semitone lanes on the Klavar
  // grid, the scheme's octave lines on the grand grid.
  const window = geo.pitchWindow ?? DEFAULT_PITCH_WINDOW;
  if (o.pitchMapping === 'chromatic-lanes') {
    let rowY = geo.middleCY + continuousPitchY(window.min, t.semitoneScale);
    for (let lin = window.min; lin <= window.max; lin++) {
      const candidate = geo.middleCY + continuousPitchY(lin, t.semitoneScale);
      if (prefersRowCandidate(candidate, rowY, query, geo.middleCY)) rowY = candidate;
    }
    const dir: 1 | -1 = rowY > geo.middleCY + EPS ? -1 : 1;
    return { rowY, dir };
  }
  if (o.pitchMapping === 'continuous' || o.core === 'fixed-3' || o.core === 'fixed-4') {
    const rowY = nearestLatticeRow(query, geo, t, o);
    const dir: 1 | -1 = rowY > geo.middleCY + EPS ? -1 : 1;
    return { rowY, dir };
  }
  let phraseEquator = geo.middleCY + getEquatorYForOctave(0, 'RH', t, o);
  for (let octave = 0; octave <= 8; octave++) {
    const candidate = geo.middleCY + getEquatorYForOctave(octave, 'RH', t, o);
    if (prefersRowCandidate(candidate, phraseEquator, query, geo.middleCY)) {
      phraseEquator = candidate;
    }
  }
  const offsets = wholeToneRowOffsets(o, t);
  let rowY = phraseEquator + offsets[0];
  for (const offset of offsets) {
    const candidate = phraseEquator + offset;
    if (prefersRowCandidate(candidate, rowY, query, geo.middleCY)) rowY = candidate;
  }
  const dir: 1 | -1 = rowY > geo.middleCY + EPS ? -1 : 1;
  return { rowY, dir };
}

/**
 * Round 17B: snap an absolute y to the nearest whole-tone row of the lattice
 * (same tie-breaks as the phrase reference) — the vertical fallback seats the
 * adjacent row toward the corridor through this snap. Round 20 exports it: the
 * linter's `rest-centroid-off-row` audit measures the same lattice.
 */
export function nearestLatticeRow(
  y: number,
  geo: JankoSystemGeometry,
  t: ResolvedJankoTokens,
  o: ResolvedJankoLayoutOptions
): number {
  if (o.pitchMapping === 'chromatic-lanes') {
    const window = geo.pitchWindow ?? DEFAULT_PITCH_WINDOW;
    let best = geo.middleCY + continuousPitchY(window.min, t.semitoneScale);
    for (let lin = window.min; lin <= window.max; lin++) {
      const candidate = geo.middleCY + continuousPitchY(lin, t.semitoneScale);
      if (prefersRowCandidate(candidate, best, y, geo.middleCY)) best = candidate;
    }
    return best;
  }
  // Under fixed cores (fixed-3 / fixed-4), candidate rows snap to SEMITONES, not drawn lines:
  // Nearest semitone = nearest integer lin to the query.
  if (o.core === 'fixed-3' || o.core === 'fixed-4') {
    const rawLin = 48 + (geo.middleCY - y) / t.semitoneScale;
    const floorLin = Math.floor(rawLin);
    const ceilLin = Math.ceil(rawLin);
    if (floorLin === ceilLin) {
      return geo.middleCY + continuousPitchY(floorLin, t.semitoneScale);
    }
    const candFloor = geo.middleCY + continuousPitchY(floorLin, t.semitoneScale);
    const candCeil = geo.middleCY + continuousPitchY(ceilLin, t.semitoneScale);
    return prefersRowCandidate(candCeil, candFloor, y, geo.middleCY) ? candCeil : candFloor;
  }
  // The grand grid snaps to its drawn lines (the only shared heights): the
  // divider grid to C-lines and divider, the equal schemes to their octave
  // lines. A window with no drawn line keeps the exact seat.
  if (o.pitchMapping === 'continuous') {
    const rules = pitchGridRules(geo, o, t);
    if (rules.length === 0) return y;
    let best = rules[0].y;
    for (const rule of rules) {
      if (prefersRowCandidate(rule.y, best, y, geo.middleCY)) best = rule.y;
    }
    return best;
  }
  const offsets = wholeToneRowOffsets(o, t);
  let best = geo.middleCY + getEquatorYForOctave(0, 'RH', t, o) + offsets[0];
  for (let octave = 0; octave <= 8; octave++) {
    const base = geo.middleCY + getEquatorYForOctave(octave, 'RH', t, o);
    for (const offset of offsets) {
      const candidate = base + offset;
      if (prefersRowCandidate(candidate, best, y, geo.middleCY)) best = candidate;
    }
  }
  return best;
}

/**
 * Round 21 §C — the **drawn staff rules** a bar rest may sit on: exactly the
 * four octave equators the staff paints (paired boundary rules under
 * `'bounded-channel'`, one rule each otherwise), through the same
 * `getEquatorRuleYs` the renderer uses — or the continuous grids' own line
 * set through `pitchGridRules` — so "a drawn line" can never mean something
 * the page does not show.
 */
export function drawnStaffRuleYs(
  geo: JankoSystemGeometry,
  o: ResolvedJankoLayoutOptions,
  t: ResolvedJankoTokens,
  x?: number
): number[] {
  const out: number[] = [];
  // The truthful drawn-lines list under each mapping: the continuous grids
  // read the painter's own line set (every lane on the Klavar grid, the
  // scheme's lines on the grand grid), so the list cannot drift from the ink.
  if (o.pitchMapping !== 'twin-rows' || o.core === 'fixed-3' || o.core === 'fixed-4') {
    const allRules = pitchGridRules(geo, o, t);
    const rules =
      x !== undefined
        ? allRules.filter((r) => r.x1 <= x + 0.01 && x <= r.x2 + 0.01)
        : allRules;
    const pool = rules.length > 0 ? rules : allRules;
    return pool
      .map((rule) => rule.y)
      .sort((a, b) => a - b);
  }
  for (const [hand, octave] of [
    ['RH', 5],
    ['LH', 2],
    ['RH', 4],
    ['LH', 3],
  ] as const) {
    out.push(...getEquatorRuleYs(geo.equatorY(hand, octave), o, t));
  }
  return out.sort((a, b) => a - b);
}

/**
 * The drawn staff rule nearest `y`; an exact tie goes to the rule **nearer
 * Middle C** (and then to the upper rule), exactly as §C specifies.
 */
export function nearestDrawnStaffRule(
  y: number,
  geo: JankoSystemGeometry,
  o: ResolvedJankoLayoutOptions,
  t: ResolvedJankoTokens,
  x?: number
): number {
  const rules = drawnStaffRuleYs(geo, o, t, x);
  let best = rules[0];
  for (const rule of rules) {
    const d = Math.abs(rule - y);
    const bd = Math.abs(best - y);
    if (d < bd - EPS) {
      best = rule;
      continue;
    }
    if (Math.abs(d - bd) > EPS) continue;
    const corridor = Math.abs(rule - geo.middleCY);
    const bestCorridor = Math.abs(best - geo.middleCY);
    if (corridor < bestCorridor - EPS || (Math.abs(corridor - bestCorridor) <= EPS && rule < best)) {
      best = rule;
    }
  }
  return best;
}

/**
 * Round 20 **optical seat**, Round 21 §C **bar seats on drawn lines**.
 *
 * A hanging glyph (64th … quarter) is placed so that its **ink centroid**
 * stands exactly on the seat point (see `rests.restGlyphOrigin`), so the row
 * the eye reads is the row the engine chose.
 *
 * The two bar forms are the classical exception, and Round 21 makes it literal:
 * a bar rest derives its *meaning* from touching a line, so its seat point is
 * not a phrase row at all but the nearest **drawn staff rule**
 * ({@link nearestDrawnStaffRule}) — the **half slab sits on** that rule (its
 * bottom edge on the line), the **whole slab hangs from** it (its top edge on
 * the line). `restSeatOffsetY` is therefore zero for every value.
 */
function restSeatY(
  rowY: number,
  style: JankoRestGeometry['style'],
  value: JankoRestGeometry['value'],
  t: ResolvedJankoTokens,
  geo: JankoSystemGeometry,
  o: ResolvedJankoLayoutOptions,
  x?: number
): number {
  if (isBarRestValue(value)) {
    // Every mapping snaps slabs to drawn lines: bar rests are measure
    // furniture, seated on landmarks rather than tracing the voice.
    return nearestDrawnStaffRule(rowY, geo, o, t, x);
  }
  return rowY + restSeatOffsetY(value, style, t);
}

/**
 * Round 20: does a silence state exactly one complete measure — the only shape
 * the **whole-bar** form may ever carry?
 *
 * The whole rest is the classical sign for a wholly silent bar, so it is
 * stated only where the silence opens on a measure downbeat and covers the
 * measure exactly; a 192-tick silence opening mid-measure is not a
 * standard-value silence *in context* and stays unwritten (a non-silence, never
 * a refusal — the same rule that leaves a 2.5-beat gap unpainted).
 */
export function isWholeBarSilence(
  releaseTick: number,
  durationTicks: number,
  t: ResolvedJankoTokens
): boolean {
  if (durationTicks !== t.ticksPerMeasure) return false;
  const anacrusis = t.anacrusisTicks ?? 0;
  if (releaseTick < anacrusis) return false;
  return (releaseTick - anacrusis) % t.ticksPerMeasure === 0;
}

/**
 * Extra air (pt) the fit solver keeps beyond the guaranteed
 * {@link REST_SEAT_AIR}, so a solved position can never be reported by the
 * linter's float-exact `rest-clearance` audit.
 */
export const REST_FIT_MARGIN = 0.02;

/**
 * Rest fit: nudge the hung rest **along its row** inside its beat cell until
 * its ink box stands clear.
 *
 * The ink box of a dialect is a fixed rectangle translated horizontally with
 * the rest, so a notehead at `(px, py)` forbids exactly the x-interval in which
 * the box comes closer than {@link restClearanceRadius} — the glyph radius plus
 * the guaranteed {@link REST_SEAT_AIR}. The solver collects those intervals
 * (only the notes whose disc reaches the box's row band can contribute), merges
 * them, adds the measure-edge windows the linter's barline audit would check
 * (conservative: the rest keeps the linter's floor from any edge that could
 * carry ink, under every grid policy), and returns the legal x nearest the
 * canonical beat column — tie-break: the earlier slot, so the choice is a pure
 * function of the layout. `null` means the cell offers no clear slot at this
 * height: the caller falls back to the adjacent row before the rest is
 * **named** as unwritable rather than silently dropped or slid into a
 * collision (see {@link computeJankoRestLayer}).
 */
export function resolveRestX(
  rest: JankoRestGeometry,
  notes: readonly PositionedJankoNote[],
  geo: JankoSystemGeometry,
  systemIndex: number,
  measureIdx: number,
  cell: { left: number; right: number },
  t: ResolvedJankoTokens
): number | null {
  const target = rest.x;
  const probe = restInkBox(rest, t);
  const relX0 = probe.x0 - rest.x;
  const relX1 = probe.x1 - rest.x;

  // Forbidden x-windows for the rest centre, relative to the canonical column
  // (0 = the target): a notehead at `p.x` forbids exactly the centres whose
  // box comes closer than the clearance radius.
  const forbidden: Array<[number, number]> = [];
  for (const p of notes) {
    const radius = restClearanceRadius(p, t);
    const reach = p.y < probe.y0 ? probe.y0 - p.y : p.y > probe.y1 ? p.y - probe.y1 : 0;
    if (reach >= radius) continue;
    const half = Math.sqrt(Math.max(0, radius * radius - reach * reach));
    forbidden.push([p.x - half - relX1 - target, p.x + half - relX0 - target]);
  }
  // Measure edges: the rest never straddles barline ink, so the box keeps the
  // linter's floor from either edge of its measure (the edges are probed
  // without a grid policy — conservative under `transparent`, where the linter
  // only pushes a hairline the rest itself queues).
  const barAir = REST_NOTEHEAD_AIR + REST_FIT_MARGIN;
  for (const edge of [
    getMeasureOpeningBarlineX(measureIdx, geo, systemIndex, t),
    getMeasureClosingBarlineX(measureIdx, geo, systemIndex, t),
  ]) {
    if (edge === null) continue;
    forbidden.push([edge - barAir - relX1 - target, edge + barAir - relX0 - target]);
  }
  forbidden.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const [lo, hi] of forbidden) {
    const last = merged[merged.length - 1];
    if (last && lo <= last[1]) last[1] = Math.max(last[1], hi);
    else merged.push([lo, hi]);
  }

  // The legal set is the complement of the merged windows inside the beat
  // cell: choose its point nearest the canonical column (0 in relative
  // coordinates), the earlier slot on an exact tie.
  const bandLo = cell.left - target;
  const bandHi = cell.right - target;
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
 * The beat cell of a rest's silence: the span between the two neighbouring
 * painted grid lines on the **canonical** proportional grid (no clasp inset —
 * the Round 5 widening shifts a measure's note field, never the absolute grid
 * the rest belongs to). The along-the-row nudge may never leave it.
 */
function restBeatCell(
  tick: number,
  measureIdx: number,
  geo: JankoSystemGeometry,
  systemIndex: number,
  o: ResolvedJankoLayoutOptions,
  t: ResolvedJankoTokens
): { left: number; right: number } {
  const anacrusis = t.anacrusisTicks ?? 0;
  let measureLeft = geo.staffLeft + measureIdx * geo.measureWidth;
  let mWidth = geo.measureWidth;
  if (systemIndex === 0 && anacrusis > 0) {
    const upbeatWidth = (anacrusis / t.ticksPerMeasure) * geo.measureWidth;
    if (tick < anacrusis) {
      measureLeft = geo.staffLeft;
      mWidth = upbeatWidth;
    } else {
      // Round 21 fix: `measureIdx` already counts the anacrusis measure as 0,
      // so the measure that follows the upbeat starts exactly one upbeat-width
      // into the staff — `measureIdx - 1` threw the cell a whole measure left
      // and inverted it (`left > right`), which silently refused every rest of
      // a system's first measure.
      measureLeft = geo.staffLeft + upbeatWidth + measureIdx * geo.measureWidth;
    }
  }
  return tickBeatCell(tick, geo, systemIndex, o, t, measureLeft, mWidth, null);
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
  /** The phrase-row hang centre the slot search could not honour (page pt). */
  targetY: number;
  /**
   * Why the silence is unwritten: the beat cell offers no clear slot along the
   * row (`'no-slot'`), or the silence opens on a barline the active grid
   * policy protects and the nudge cannot escape it (`'protected-barline'`).
   */
  reason: 'no-slot' | 'protected-barline';
}

/** The written silences of one system plus every silence the fit rule refused. */
export interface JankoRestLayer {
  /** The rests actually painted, in engraving order. */
  rests: JankoRestGeometry[];
  /** The silences refused by the fit rule, with the reason for each. */
  unwritten: JankoUnwrittenRest[];
}

/**
 * Round 12 voice rests, hung by the Round 17B **phrase row** and seated by the
 * along-the-row slot search with an adjacent-row vertical fallback.
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
 * Vertically the rest is **optically seated** on the nearest whole-tone row of
 * its phrase octave ({@link restPhraseRowReference}): the glyph's ink centroid
 * stands exactly on the row (`rests.restGlyphOrigin`), so the row the eye reads
 * is the row the engine chose — same voice, same place, every bar. The two bar
 * forms carry their classical seat as data: the **half** slab sits atop the
 * row, the **whole** slab hangs below it ({@link restSeatOffsetY}). Horizontally
 * {@link resolveRestX} nudges the glyph along the row inside its beat cell until
 * its ink stands clear of every notehead disc (either hand) with the guaranteed
 * {@link REST_SEAT_AIR}; when the reference row offers no clear slot, the
 * adjacent row toward the corridor gets its own in-cell solve before the
 * silence is named unwritable.
 *
 * - Bach Goldberg Var. 1 m. 4 is the canonical case: the RH plays 16ths up to
 *   tick 540 (digit `9`, `y = 158.5pt`), releases at 552 and resumes at 564
 *   (digit `0`, `y = 173.5pt`), while the LH enters at 552 — so a **16th rest**
 *   stands in the Right Hand at the tick-552 beat column, its ink centroid on
 *   the digit `9` phrase row (`158.5pt`), clearing the LH D3 head that shares
 *   its column with room to spare.
 * - The **whole-bar** form (`'whole'`, 192 ticks) is stated only where the
 *   silence opens on a measure downbeat and covers that measure exactly
 *   ({@link isWholeBarSilence}) — the classical sign for a wholly silent bar.
 * - A silence that is not a standard value (a 2.5-beat gap, a tie artefact) is
 *   left unwritten rather than approximated — that is a **non-silence**, not a
 *   refusal, so it is not reported.
 * - A rest whose ink cannot clear the noteheads of the system (either hand) in
 *   any slot inside its beat cell, on either the reference row or the adjacent
 *   fallback row, is returned in `unwritten`, exactly like a bracket the fit
 *   rule refuses.
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
      const value = restValueForTicks(gap);
      // Round 20: the whole-bar form states exactly one complete measure. A
      // 192-tick silence opening mid-measure is not a standard-value silence in
      // context — it is left unwritten exactly like any other non-standard gap.
      if (value === 'whole' && !isWholeBarSilence(releaseTick, gap, t)) continue;
      const measureIdx = measureIndexOfTick(releaseTick, geo, systemIndex, t);
      // The rest belongs to an *active* measure of this hand: the hand must own
      // at least one onset inside the measure the silence opens in. A whole-bar
      // silence is the one exception by definition — the measure it states is
      // the measure the hand is silent in.
      if (measureIdx < 0 || measureIdx >= o.measuresPerSystem) continue;
      if (value !== 'whole' && !activeMeasures.has(measureIdx)) continue;
      const { rowY, dir } = restPhraseRowReference(hand, ticks[i], ticks[i + 1], notes, geo, t, o);
      const colX = getTickColumnX(releaseTick, geo, systemIndex, o, t);
      const open = value === 'whole' ? getMeasureOpeningBarlineX(measureIdx, geo, systemIndex, t) : null;
      const close = value === 'whole' ? getMeasureClosingBarlineX(measureIdx, geo, systemIndex, t) : null;
      const restX = value === 'whole' && open !== null && close !== null ? (open + close) / 2 : colX;
      const targetY = restSeatY(rowY, o.restStyle, value, t, geo, o, restX);
      const candidate: JankoRestGeometry = {
        tick: releaseTick,
        durationTicks: gap,
        hand,
        x: restX,
        y: targetY,
        value,
        style: o.restStyle,
      };
      const refused = (reason: JankoUnwrittenRest['reason']): void => {
        unwritten.push({
          tick: candidate.tick,
          durationTicks: candidate.durationTicks,
          hand: candidate.hand,
          value: candidate.value,
          x: candidate.x,
          targetY,
          reason,
        });
      };
      // The phrase-row seat is the *musical* anchor; the slot solver nudges it
      // along the row inside its beat cell, or names the silence unwritable
      // when the cell offers no clear slot. A silence that opens on a barline
      // the active grid policy protects — and whose nudge cannot escape it —
      // is named `'protected-barline'` rather than `'no-slot'`, so the grid
      // refusal stays distinguishable from a wall of heads.
      const cell = restBeatCell(releaseTick, measureIdx, geo, systemIndex, o, t);
      const solveAt = (y: number): number | null => {
        candidate.y = y;
        return resolveRestX(candidate, notes, geo, systemIndex, measureIdx, cell, t);
      };
      // Round 21 §C — **the whole bar is centred in its measure** (Gould /
      // LilyPond NR §§2.2.1, 2.2.3: "Whole measure rests, centered in the
      // middle of the measure"). A centred whole deliberately stands outside
      // its onset beat cell, so it is exempt from the along-the-row nudge: the
      // slab holds the barline midpoint and the linter *confirms* the
      // clearance there — it is never shifted to dodge a neighbour.
      if (value === 'whole') {
        if (open !== null && close !== null) {
          candidate.x = restX;
          candidate.y = targetY;
          out.push(candidate);
          continue;
        }
      }

      // Direction (a): inter-onset gap bounds. A rest must stay inside its inter-onset gap
      // and never slide past a neighboring onset's column.
      const colPrev = getTickColumnX(ticks[i], geo, systemIndex, o, t);
      const colNext = getTickColumnX(ticks[i + 1], geo, systemIndex, o, t);
      const probe = restInkBox(candidate, t);
      const leftW = candidate.x - probe.x0;
      const rightW = probe.x1 - candidate.x;
      const gapLeft = Math.max(cell.left, colPrev + leftW);
      const gapRight = Math.min(cell.right, colNext - rightW);
      const gapCell = gapLeft < gapRight ? { left: gapLeft, right: gapRight } : cell;

      // Direction (b): candidate rows include phrase row, neighbor rows (releasing and resuming),
      // and corridor fallback row.
      const prevY = voiceYAt(notes, hand, ticks[i]);
      const nextY = voiceYAt(notes, hand, ticks[i + 1]);
      const voiceCandidateRows: number[] = [];
      const addVoiceRow = (r: number | null): void => {
        if (r === null) return;
        if (!voiceCandidateRows.some((cr) => Math.abs(cr - r) < EPS)) {
          voiceCandidateRows.push(r);
        }
      };
      addVoiceRow(rowY);
      if (prevY !== null) {
        addVoiceRow(nearestLatticeRow(prevY, geo, t, o));
      }
      if (nextY !== null) {
        addVoiceRow(nearestLatticeRow(nextY, geo, t, o));
      }

      // Vertical fallback row toward the corridor
      let fallbackRow: number | null = null;
      if (o.pitchMapping === 'continuous') {
        const rules = drawnStaffRuleYs(geo, o, t, candidate.x);
        const neighbor =
          dir === -1
            ? [...rules].filter((r) => r < rowY - EPS).pop()
            : rules.find((r) => r > rowY + EPS);
        fallbackRow = neighbor ?? null;
      } else {
        const step = o.pitchMapping === 'twin-rows' ? t.rowHeight : t.semitoneScale;
        fallbackRow = nearestLatticeRow(rowY + dir * step, geo, t, o);
      }
      if (fallbackRow !== null && Math.abs(fallbackRow - rowY) <= EPS) {
        fallbackRow = null;
      }

      // Pass 1: Try voice candidate rows at/near the canonical column before any horizontal slide
      let chosenX: number | null = null;
      let chosenY: number = targetY;
      let bestNearDisp = Infinity;

      const nearCell = {
        left: Math.max(gapCell.left, colX - 1.5),
        right: Math.min(gapCell.right, colX + 1.5),
      };
      if (nearCell.left <= nearCell.right) {
        for (const r of voiceCandidateRows) {
          const y = restSeatY(r, o.restStyle, value, t, geo, o, candidate.x);
          candidate.y = y;
          const x = resolveRestX(candidate, notes, geo, systemIndex, measureIdx, nearCell, t);
          if (x !== null) {
            const disp = Math.abs(x - colX);
            if (disp < bestNearDisp - EPS) {
              bestNearDisp = disp;
              chosenX = x;
              chosenY = y;
            }
          }
        }
      }

      // Pass 2: If no slot near canonical column, slide voice candidate rows inside the inter-onset gap
      if (chosenX === null) {
        let bestGapDisp = Infinity;
        for (const r of voiceCandidateRows) {
          const y = restSeatY(r, o.restStyle, value, t, geo, o, candidate.x);
          candidate.y = y;
          const x = resolveRestX(candidate, notes, geo, systemIndex, measureIdx, gapCell, t);
          if (x !== null) {
            const disp = Math.abs(x - colX);
            if (disp < bestGapDisp - EPS) {
              bestGapDisp = disp;
              chosenX = x;
              chosenY = y;
            }
          }
        }
      }

      // Pass 3: Fallback to beat cell for voice rows if inter-onset gap offered no slot
      if (chosenX === null) {
        let bestCellDisp = Infinity;
        for (const r of voiceCandidateRows) {
          const y = restSeatY(r, o.restStyle, value, t, geo, o, candidate.x);
          candidate.y = y;
          const x = resolveRestX(candidate, notes, geo, systemIndex, measureIdx, cell, t);
          if (x !== null) {
            const disp = Math.abs(x - colX);
            if (disp < bestCellDisp - EPS) {
              bestCellDisp = disp;
              chosenX = x;
              chosenY = y;
            }
          }
        }
      }

      // Pass 4: Fallback row toward the corridor if voice candidate rows could not find a slot
      if (chosenX === null && fallbackRow !== null) {
        const y = restSeatY(fallbackRow, o.restStyle, value, t, geo, o, candidate.x);
        candidate.y = y;
        const x = resolveRestX(candidate, notes, geo, systemIndex, measureIdx, cell, t);
        if (x !== null) {
          chosenX = x;
          chosenY = y;
        }
      }

      if (chosenX === null) {
        // A silence that opens within a head's air of a protected barline
        // opened on the grid: it is named `'protected-barline'` rather than
        // `'no-slot'`, so the grid refusal stays distinguishable from a wall
        // of heads (the same threshold the Round 12 pre-check refused by).
        const onGrid =
          protectsBarlineInk(o.gridWritingPolicy) &&
          [getMeasureOpeningBarlineX(measureIdx, geo, systemIndex, t)].some(
            (edge) => edge !== null && Math.abs(candidate.x - edge) < t.noteheadRadius + REST_NOTEHEAD_AIR
          );
        refused(onGrid ? 'protected-barline' : 'no-slot');
        continue;
      }
      candidate.x = chosenX;
      candidate.y = chosenY;
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
 * Air (pt) a row-snapped head keeps from the nearest head of a *different*
 * onset on its own row beyond touching masks: exactly zero, the hard box rule
 * the visual linter audits (mask boxes may touch, never overlap). It is
 * deliberately not inflated — a dense 16th grid whose columns already clear
 * must not be nudged by a solver that thinks it is 0.05pt short. Same-onset
 * same-row pairs instead stand at the active cluster-spacing preset
 * (`2wx + air`).
 */
export const CHORDAL_NEIGHBOUR_AIR = 0;

/**
 * Round 17 redistribution gate (pt): a four-onset window whose head gaps
 * already spread within this amount is left on its proportional columns —
 * only a real disturbance (a fanned pair crowding its neighbours past the
 * gate) earns redistribution. Undisturbed ink, and the rests seated beside
 * it, never moves.
 */
export const RELAX_DISTURBANCE_GATE = 4.0;
/** Damping of one redistribution sweep (half the spring correction). */
export const RELAX_DAMPING = 0.5;
/** Redistribution sweeps before the pass settles unconditionally. */
export const RELAX_MAX_SWEEPS = 8;
/** Largest single shift (pt) below which redistribution stops early. */
export const RELAX_SETTLE = 0.005;

/**
 * Rectangular mask half-extents (pt) of one head under the active spacing
 * preset — the halo-aware box every Round 17 clearance test shares.
 *
 * A regular head owns exactly its preset box (`wx × hy`); a tick-0 Position of
 * Honor sound owns the box grown to its halo ring's outer edge on both axes
 * (the ring is drawn ink, so two rings may never cut into each other's box).
 */
export function knockoutHalfExtents(
  o: ResolvedJankoLayoutOptions,
  t: ResolvedJankoTokens,
  startTick?: number
): { wx: number; hy: number } {
  const preset = getClusterSpacingPreset(o.clusterSpacing);
  if (startTick !== undefined && isPositionOfHonor(startTick)) {
    const halo = t.haloRadius + JANKO_HALO_STROKE_WIDTH / 2;
    return { wx: Math.max(preset.wx, halo), hy: Math.max(preset.hy, halo) };
  }
  return { wx: preset.wx, hy: preset.hy };
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
   * onset column: the single standard grammar's asymmetric fan — one head on
   * the column, the rest stepping toward the roomier side at `2wx + air` per
   * step — plus the Round 19 symmetric tuck that re-centres a row narrower
   * than the onset's widest one (see {@link resolveChordColumns}).
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
 * ascending and fanned out asymmetrically around its onset's column: one head
 * keeps the nominal beat-x and the rest step toward the roomier side at the
 * active cluster-spacing preset:
 *
 * ```
 * x_i = x_onset + (i - anchor) · pairGap · d,   pairGap = 2wx + air
 * ```
 *
 * So a two-note collision becomes the pair `x, x + pairGap·d` (5.46pt apart on
 * the golden `'tight'`) and a three-note collision the triplet
 * `x − pairGap, x, x + pairGap`. Round 19 then **tucks** the rows of an uneven
 * onset: every row narrower than the widest one is re-centred on the widest
 * row's middle (m. 46), while rows of equal count stay exactly as the fan
 * placed them.
 *
 * **The column solve.** A displaced head claims real horizontal room, and in
 * dense writing the neighbouring onset of its own row is only one 16th away.
 * The onset is therefore treated as one unit whose column may be translated as
 * a whole — never sheared, so the chord keeps its shape:
 *
 * 1. **Spread columns** centre their mask bbox in the free space between
 *    their fixed nominal neighbours (clipped to the beat cell), holding the
 *    column only where the bbox refuses the space — the pin. A **clasped**
 *    column instead steps right for the air its bracket needs, keeping its
 *    anchor on the shifted column.
 * 2. **Plain columns** inside a disturbed four-onset window ease toward equal
 *    head gaps (local redistribution); undisturbed windows stay exactly on
 *    their proportional columns.
 * 3. **Plain columns** that the spread ones have crowded step away by exactly
 *    the missing air — the local spacing relief a real engraver applies around
 *    a displaced second.
 *
 * Every step is one-directional (a column only ever moves away from a
 * violation) or damped and bounded, so the pass is deterministic, order-stable
 * and terminating. Whatever still cannot fit — a three-note row cluster
 * squeezed between two 16ths that are themselves out of room — is left for
 * the visual linter to name (`chordal-overlap` / `notehead-overlap`) instead
 * of being hidden.
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
  /**
   * Round 19: the **laid-out column** (page pt) of every onset of the system —
   * the unit's proportional beat column after the whole rigid translation the
   * solve applied (`nominalX + shift`). The column solve moves a unit as one
   * piece, so this is the beat's true x: the beat grid follows it (see
   * `renderBeatGrid`), and the Round 16 shared stem stands on it.
   */
  columns: ReadonlyMap<number, number>;
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
  const spacing = getClusterSpacingPreset(o.clusterSpacing);
  const { wx, hy, air: presetAir, pairGap } = spacing;
  const claspsActive = usesChordClasps(o.chordGrouping);
  const perHandClasps = o.chordGrouping === 'per-hand-clasp';
  const claspReach = t.noteheadRadius + t.claspOffset;

  // -------------------------------------------------------------------------
  // 1. Partition the system into onset units, each split into row clusters.
  // -------------------------------------------------------------------------
  const unitByTick = new Map<number, OnsetUnit>();
  const clusterByRow = new Map<string, RowCluster>();
  const membersByTick = new Map<number, PositionedJankoNote[]>();
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
    const members = membersByTick.get(p.note.startTick);
    if (members) members.push(p);
    else membersByTick.set(p.note.startTick, [p]);
  }

  // Cluster each onset's heads: exact rows under the twin rows, vertical mask
  // overlap chains under the continuous mappings (no rows — seconds fan
  // exactly like crowded rows do). Everything downstream (fan, tuck, clasps)
  // is geometric over `unit.rows` and runs unchanged.
  const overlapGrouping = o.pitchMapping !== 'twin-rows' || o.core === 'fixed-3' || o.core === 'fixed-4';
  for (const unit of unitByTick.values()) {
    const stored = membersByTick.get(unit.tick) ?? [];
    // Twin rows keep score order (bit-identical rows); overlap chains need
    // height order for adjacency.
    const members = overlapGrouping ? [...stored].sort((a, b) => a.y - b.y) : stored;
    if (!overlapGrouping) {
      for (const p of members) {
        const rowKey = (p.y + 0).toFixed(3);
        let cluster = clusterByRow.get(`${unit.tick}|${rowKey}`);
        if (!cluster) {
          cluster = { y: p.y, key: rowKey, notes: [], minOffset: 0, maxOffset: 0 };
          clusterByRow.set(`${unit.tick}|${rowKey}`, cluster);
          unit.rows.push(cluster);
        }
        cluster.notes.push(p);
      }
      continue;
    }
    let cluster: RowCluster | null = null;
    for (const p of members) {
      const prevY = cluster ? cluster.notes[cluster.notes.length - 1].y : null;
      if (!cluster || prevY === null || Math.abs(p.y - prevY) >= 2 * hy - 0.01) {
        const key = (p.y + 0).toFixed(3);
        cluster = { y: p.y, key, notes: [], minOffset: 0, maxOffset: 0 };
        clusterByRow.set(`${unit.tick}|${key}`, cluster);
        unit.rows.push(cluster);
      }
      cluster.notes.push(p);
    }
    for (const c of unit.rows) {
      c.y = c.notes.reduce((acc, q) => acc + q.y, 0) / c.notes.length;
    }
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

  /**
   * Barline air (pt) each beat-cell edge of one unit carries: a cell edge that
   * carries barline ink also carries the linter's floor, measured from the
   * disc edge — the edge is inset by the head radius plus COLUMN_BARLINE_AIR
   * plus the float-safety solver margin, so a downbeat fan holds right of its
   * barline instead of painting a mask over it.
   */
  const barlineInset = t.noteheadRadius + COLUMN_BARLINE_AIR + REST_FIT_MARGIN;
  const cellAirs = (unit: OnsetUnit): { loAir: number; hiAir: number } => {
    const openBarlineX = getMeasureOpeningBarlineX(unit.measureIdx, geo, systemIndex, t);
    const closeBarlineX = getMeasureClosingBarlineX(unit.measureIdx, geo, systemIndex, t);
    return {
      loAir:
        openBarlineX !== null && Math.abs(unit.cellLeft - openBarlineX) < 1e-6 ? barlineInset : 0,
      hiAir: Math.abs(unit.cellRight - closeBarlineX) < 1e-6 ? barlineInset : 0,
    };
  };

  // -------------------------------------------------------------------------
  // 1a. Crowded-row placement (single standard grammar, Round 17).
  //
  //     A row that carries two or more heads of one onset fans them out
  //     asymmetrically: the pinned head keeps its column (the RH tone when
  //     the row is mixed-hand, the middle head otherwise) and the rest step
  //     toward the roomier neighbour at the preset `2wx + air` per step, so a
  //     pair spans exactly the judged pair gap (5.46pt on the golden `'tight'`)
  //     and a triple twice it.
  //
  //     Pin-preserving shrink: the fan takes the full judged gap whenever
  //     either side fits it (mirroring keeps the anchor), and only when
  //     neither side fits does the gap shrink to the roomier side's free
  //     room — `min(G, room)` — floored at touching masks. The pinned head
  //     holds its column throughout: the Round 16 slide/centre backstop,
  //     which dragged the anchor off its column to hide an overflow, is
  //     deleted — whatever still overflows is honest residue for the linter.
  //
  //     Hard barriers: beat and measure lines stay firm — no head may leave
  //     its own **beat cell**, the span between the two neighbouring painted
  //     grid lines, so a displaced head can never cross a beat pulse or a
  //     barline into another beat's territory.
  // -------------------------------------------------------------------------
  const offsetsById = new Map<string, number>();
  const byX = [...units].sort((a, b) => a.nominalX - b.nominalX || a.tick - b.tick);
  byX.forEach((unit, index) => {
    const prevX = index > 0 ? byX[index - 1].nominalX : Number.NEGATIVE_INFINITY;
    const nextX = index + 1 < byX.length ? byX[index + 1].nominalX : Number.POSITIVE_INFINITY;
    const leftReach = Math.min(unit.nominalX - prevX, unit.nominalX - unit.cellLeft);
    const rightReach = Math.min(nextX - unit.nominalX, unit.cellRight - unit.nominalX);
    const { loAir, hiAir } = cellAirs(unit);
    /**
     * Free room (pt) for the fan's outermost head centre in direction `d`:
     * the nearer of the nominal neighbour column and the beat-cell edge,
     * minus the neighbour's mask half-width — or the barline inset the edge
     * carries. Columnar and uniform: the fan head's centre always clears
     * fixed ink, and mask-vs-mask separation stays the column solver's job.
     */
    const roomFor = (d: 1 | -1): number => {
      const toCellEdge =
        d > 0 ? unit.cellRight - unit.nominalX : unit.nominalX - unit.cellLeft;
      const toNeighbour = d > 0 ? nextX - unit.nominalX : unit.nominalX - prevX;
      if (toCellEdge <= toNeighbour) return toCellEdge - (d > 0 ? hiAir : loAir);
      return toNeighbour - wx;
    };
    for (const cluster of unit.rows) {
      const k = cluster.notes.length;
      if (k < 2) {
        cluster.minOffset = 0;
        cluster.maxOffset = 0;
        offsetsById.set(cluster.notes[0].note.id, 0);
        continue;
      }
      // The head that keeps its column — the **lower-first** rule (Round 21),
      // now the only rule: on a mixed-hand row the **lowest-pitched** head holds
      // the column, on a single-hand row the middle head does. `cluster.notes`
      // is sorted pitch-ascending, so the lowest head is index 0 and the rule is
      // one line. The Round 19 `'rh'` anchor is **retired** (mirror of R20's
      // retirement of `'lower-first'`): a rule, not an option. A cross-hand
      // unison never reaches this fan — the two hands' one sound is merged to
      // one head before the solve — so the tie the rule cannot break by pitch
      // is broken once, in `mergeUnisonHeads`, by taking the lower voice.
      let anchor = Math.floor((k - 1) / 2);
      const hands = new Set(cluster.notes.map((p) => p.rhythm.hand));
      if (hands.size > 1) anchor = 0;
      // The flank must clear whatever glyph the heads actually wear: a tick-0
      // sound carries the wider halo box, and two rings may never cut into
      // each other's box either. Box half-widths — the fan is a horizontal
      // question; regular heads step exactly pairGap.
      let clusterGap = pairGap;
      for (let i = 1; i < k; i++) {
        clusterGap = Math.max(
          clusterGap,
          knockoutHalfExtents(o, t, cluster.notes[i - 1].note.startTick).wx +
            knockoutHalfExtents(o, t, cluster.notes[i].note.startTick).wx +
            presetAir
        );
      }
      // The fan extends toward the roomier side. When the anchor sits right of
      // the cluster's centre the direction must mirror, so the *bulk* of the
      // heads — not the raw index order — leans into the open space.
      const roomier: 1 | -1 = rightReach >= leftReach ? 1 : -1;
      const anchorLean = Math.sign((k - 1) / 2 - anchor);
      const dir: 1 | -1 = anchorLean < 0 ? (-roomier as 1 | -1) : roomier;
      const fan = (d: 1 | -1, gap: number): number[] =>
        cluster.notes.map((_, i) => (i - anchor) * gap * d);
      // Fan steps reaching toward each side for one fan direction (a
      // middle-anchored triple reaches one step each way; an end-anchored pair
      // reaches one way only — and mirroring swaps the two reaches).
      const stepsToward = (u: 1 | -1, side: 1 | -1): number =>
        u === side ? k - 1 - anchor : anchor;
      const fits = (u: 1 | -1, gap: number): boolean =>
        (stepsToward(u, 1) === 0 || roomFor(1) + EPS >= stepsToward(u, 1) * gap) &&
        (stepsToward(u, -1) === 0 || roomFor(-1) + EPS >= stepsToward(u, -1) * gap);
      let useDir = dir;
      let gap = clusterGap;
      if (!fits(dir, clusterGap)) {
        if (fits((-dir as 1 | -1), clusterGap)) {
          // Mirror: the exact fan about the anchor on the other side, so the
          // judged gap survives where the roomier side cannot host it.
          useDir = -dir as 1 | -1;
        } else {
          // Pin-preserving shrink: narrow the gap to the roomier side's free
          // room, the pinned head holding its column while the free side
          // walks in. Floored at touching masks; whatever still overflows is
          // honest residue for the linter.
          const fitGap = Math.min(
            stepsToward(dir, 1) === 0 ? Infinity : roomFor(1) / stepsToward(dir, 1),
            stepsToward(dir, -1) === 0 ? Infinity : roomFor(-1) / stepsToward(dir, -1)
          );
          gap = Math.min(clusterGap, fitGap);
          if (!(gap >= 2 * wx)) gap = 2 * wx;
        }
      }
      const offsets = fan(useDir, gap);
      cluster.minOffset = Math.min(...offsets);
      cluster.maxOffset = Math.max(...offsets);
      cluster.notes.forEach((p, i) => offsetsById.set(p.note.id, offsets[i]));
    }
  });

  // -------------------------------------------------------------------------
  // 1a2. Symmetric tuck (Round 19): one onset whose rows carry *different*
  //      head counts is re-centred instead of interleaved. The widest row(s)
  //      keep the fan of 1a — they define the onset's middle — and every
  //      smaller row shifts so that its **own middle** lands on the widest
  //      row's middle, making the whole cluster mirror-symmetric about it
  //      (m. 46: F5/D3 tucked to the pair columns' midpoint 53.88, the pair
  //      rows holding 51.15 / 56.61). The shift is
  //      `(maxCount − rowCount) · (pairGap / 2) · d` wherever the widest row
  //      fans from a head at its end (the m. 46 pairs); a middle-anchored
  //      widest row is already symmetric about the column, so its smaller rows
  //      do not move at all. Rows of equal count never shift, so an even
  //      cluster (1+1, 2+2+2, 3+3) stays exactly as the fan placed it. A tuck
  //      that would leave the beat cell is skipped — the tuck never buys
  //      symmetry with a grid crossing.
  // -------------------------------------------------------------------------
  for (const unit of units) {
    const maxCount = unit.rows.reduce((acc, c) => Math.max(acc, c.notes.length), 0);
    if (maxCount < 2) continue;
    const widest = unit.rows.find((c) => c.notes.length === maxCount);
    if (!widest) continue;
    const middle = (widest.minOffset + widest.maxOffset) / 2;
    const idx = byX.indexOf(unit);
    const { loAir, hiAir } = cellAirs(unit);
    const cellLo = unit.cellLeft + loAir - unit.nominalX;
    const cellHi = unit.cellRight - hiAir - unit.nominalX;
    for (const row of unit.rows) {
      if (row.notes.length === maxCount) continue;
      const shift = middle - (row.minOffset + row.maxOffset) / 2;
      if (shift === 0) continue;
      const lo = row.minOffset + shift;
      const hi = row.maxOffset + shift;
      if (lo < cellLo - EPS || hi > cellHi + EPS) continue;
      row.minOffset = lo;
      row.maxOffset = hi;
      for (const p of row.notes) {
        offsetsById.set(p.note.id, (offsetsById.get(p.note.id) ?? 0) + shift);
      }
    }
  }

  /** Row-snapped horizontal offset (page pt) of every head of one onset unit. */
  const rowOffsetOf = (unit: OnsetUnit): Map<string, number> => {
    const offsets = new Map<string, number>();
    for (const cluster of unit.rows) {
      for (const p of cluster.notes) offsets.set(p.note.id, offsetsById.get(p.note.id) ?? 0);
    }
    return offsets;
  };

  /**
   * Round 6/8/19 — the clasp groups of one onset that qualify under the
   * per-hand paradigm, unified into one cross-hand bracket where the hands'
   * spans overlap (see {@link resolveOnsetClaspGroups}). Qualification is
   * measured in row-offset space here: the heads still share their nominal
   * column, before the solve.
   */
  const handClaspGroups = (unit: OnsetUnit): PositionedJankoNote[][] => {
    const offsets = rowOffsetOf(unit);
    const onset = unit.rows
      .flatMap((cluster) => cluster.notes)
      .sort((a, b) => a.y - b.y || a.x - b.x);
    return resolveOnsetClaspGroups(onset, t, (p) => offsets.get(p.note.id) ?? 0);
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
            {
              claspDurationStyle: o.claspDurationStyle,
              durationGrammar: o.durationGrammar,
              claspDotNudge: o.claspDotNudge,
            }
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
        {
          claspDurationStyle: o.claspDurationStyle,
          durationGrammar: o.durationGrammar,
          claspDotNudge: o.claspDotNudge,
        }
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
        {
          claspDurationStyle: o.claspDurationStyle,
          durationGrammar: o.durationGrammar,
          claspDotNudge: o.claspDotNudge,
        }
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
              {
                claspDurationStyle: o.claspDurationStyle,
                durationGrammar: o.durationGrammar,
                claspDotNudge: o.claspDotNudge,
              }
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
  // move a single column, so the whole column solve is skipped. Coincidence on
  // the nominal column is the doctrine now — cross-hand pairs share their
  // column with no stagger, and the linter's `split-stack-stems` names any
  // regression.
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
    return {
      notes: untouched,
      claspTicks: new Set<number>(),
      columns: new Map(units.map((unit) => [unit.tick, unit.nominalX + unit.shift])),
    };
  }

  /** Extreme resolved offsets of one unit's heads (page pt, signed). */
  const unitMinOffset = (u: OnsetUnit): number =>
    u.rows.reduce((acc, c) => Math.min(acc, c.minOffset), 0);
  const unitMaxOffset = (u: OnsetUnit): number =>
    u.rows.reduce((acc, c) => Math.max(acc, c.maxOffset), 0);
  /** Halo-aware mask half-extents of one unit's widest/tallest member. */
  const unitMaskWX = (u: OnsetUnit): number =>
    Math.max(
      ...u.rows.flatMap((c) => c.notes.map((p) => knockoutHalfExtents(o, t, p.note.startTick).wx))
    );
  const unitMaskHY = (u: OnsetUnit): number =>
    Math.max(
      ...u.rows.flatMap((c) => c.notes.map((p) => knockoutHalfExtents(o, t, p.note.startTick).hy))
    );
  const ordered = [...units].sort((a, b) => a.tick - b.tick);
  /** Minimum head-to-head air (pt) two consecutive onsets keep in time order. */
  const MIN_TIME_AIR = 1.0;

  // -------------------------------------------------------------------------
  // 1b. Unit centering: after fanning, a spread (non-clasped) unit's mask bbox
  //     is centred in the free space between its fixed nominal neighbours,
  //     clipped to the beat cell. Centring needs two bounds: a unit with fewer
  //     than two neighbours, or whose bbox does not fit the clipped space,
  //     holds its column — the pin (m12: the pulse-edge pair's bbox refuses
  //     the clipped space, so the 9 holds while the 7 walks in beside it).
  //     Brackets extend left from their clasped unit, so a unit immediately
  //     left of one holds whenever centring would enter the bracket zone —
  //     the bracket air the clasp was admitted with survives the solve and no
  //     clasp is ever demoted by spacing. Motion right of a clasp is
  //     bracket-safe (its own heads block the way, and the column solver caps
  //     the clasp's shift against spread neighbours).
  // -------------------------------------------------------------------------
  /**
   * Rightmost page x a unit immediately left of the clasped `clasp` may place
   * its heads: the bracket's worst-case ink edge (spine plus the widest
   * duration mark) minus the foreign-head air the clears predicate demands.
   * The bound assumes the clasp holds its column; clasp shifts are
   * right-or-zero on the corpus (bracket air pushes right), so any shift only
   * moves the bracket further from the neighbour.
   */
  const bracketSafeBound = (clasp: OnsetUnit): number =>
    clasp.nominalX +
    unitMinOffset(clasp) -
    (t.noteheadRadius +
      t.claspOffset +
      CLASP_TRANSVERSE_WIDTH / 2 +
      t.noteheadRadius +
      CLASP_NOTEHEAD_AIR);
  /** The clasped unit immediately right of `unit` in nominal order, if any. */
  const claspedRightOf = (unit: OnsetUnit): OnsetUnit | null => {
    const at = byX.indexOf(unit);
    return at + 1 < byX.length && byX[at + 1].clasp ? byX[at + 1] : null;
  };
  for (const unit of units) {
    if (!unit.spread || unit.clasp) continue;
    const at = byX.indexOf(unit);
    if (at <= 0 || at + 1 >= byX.length) continue;
    const prev = byX[at - 1];
    const next = byX[at + 1];
    const { loAir, hiAir } = cellAirs(unit);
    const spaceLo = Math.max(
      prev.nominalX + unitMaxOffset(prev) + unitMaskWX(prev),
      unit.cellLeft + loAir
    );
    const spaceHi = Math.min(
      next.nominalX + unitMinOffset(next) - unitMaskWX(next),
      unit.cellRight - hiAir
    );
    const w = unitMaskWX(unit);
    const bboxLo = unit.nominalX + unitMinOffset(unit) - w;
    const bboxHi = unit.nominalX + unitMaxOffset(unit) + w;
    if (bboxHi - bboxLo > spaceHi - spaceLo + EPS) continue;
    const shift = (spaceLo + spaceHi) / 2 - (bboxLo + bboxHi) / 2;
    const clasp = claspedRightOf(unit);
    if (clasp !== null && unit.nominalX + shift + unitMaxOffset(unit) > bracketSafeBound(clasp)) {
      continue;
    }
    unit.shift = shift;
  }

  // -------------------------------------------------------------------------
  // 1c. Local redistribution: spring-relaxation over a sliding four-onset
  //     window — never whole-measure, or proportional rhythm dies. Only a
  //     window that holds a spread or clasped unit (a real disturbance, not
  //     rhythmic unevenness like a dotted value) and whose gaps spread past
  //     the gate earns redistribution. Spread and clasped units are
  //     placed-and-pinned (centering is their placement); the plain interior
  //     units of each disturbed window ease toward equal head gaps. Every
  //     other window stays exactly on its proportional columns, so
  //     undisturbed ink — and the rests seated beside it — never moves. Cells
  //     are hard clamps and time order is never crossed. Pass order pinned:
  //     place units first, then relax — damped and bounded, so the pass
  //     cannot oscillate.
  // -------------------------------------------------------------------------
  const minHead = (u: OnsetUnit): number => u.nominalX + u.shift + unitMinOffset(u);
  const maxHead = (u: OnsetUnit): number => u.nominalX + u.shift + unitMaxOffset(u);
  const disturbed: OnsetUnit[][] = [];
  for (let i = 0; i + 3 < ordered.length; i++) {
    const w = ordered.slice(i, i + 4);
    if (!w.some((u) => u.spread || u.clasp)) continue;
    const gaps = [minHead(w[1]) - maxHead(w[0]), minHead(w[2]) - maxHead(w[1]), minHead(w[3]) - maxHead(w[2])];
    // A window earns redistribution when its gaps are both uneven (past the
    // disturbance gate) and crowded (some gap narrower than one judged pair
    // gap): a merely wide gap is structure — an inset jump, a dotted value —
    // never a disturbance, and evening one would fight the grid that built it.
    if (Math.max(...gaps) - Math.min(...gaps) <= RELAX_DISTURBANCE_GATE) continue;
    if (Math.min(...gaps) >= pairGap) continue;
    disturbed.push(w);
  }
  for (let sweep = 0; sweep < RELAX_MAX_SWEEPS; sweep++) {
    let moved = 0;
    for (const w of disturbed) {
      const middles: Array<{ u: OnsetUnit; left: OnsetUnit; right: OnsetUnit }> = [
        { u: w[1], left: w[0], right: w[2] },
        { u: w[2], left: w[1], right: w[3] },
      ];
      for (const { u, left, right } of middles) {
        if (u.spread || u.clasp) continue;
        const gapLeft = minHead(u) - maxHead(left);
        const gapRight = minHead(right) - maxHead(u);
        const step = ((gapRight - gapLeft) / 2) * RELAX_DAMPING;
        if (step === 0) continue;
        // Hard clamps: the beat cell (barline-aware, like the fan), strict
        // time order against both neighbours — and the bracket zone of a
        // clasped right neighbour, so relaxation never demotes a clasp.
        const { loAir, hiAir } = cellAirs(u);
        const clasp = claspedRightOf(u);
        const lo =
          Math.max(u.cellLeft + loAir - unitMinOffset(u), maxHead(left) + MIN_TIME_AIR - unitMinOffset(u)) -
          u.nominalX;
        let hi =
          Math.min(u.cellRight - hiAir - unitMaxOffset(u), minHead(right) - MIN_TIME_AIR - unitMaxOffset(u)) -
          u.nominalX;
        if (clasp !== null) {
          hi = Math.min(hi, bracketSafeBound(clasp) - unitMaxOffset(u) - u.nominalX);
        }
        const clamped = Math.max(lo, Math.min(hi, u.shift + step));
        moved = Math.max(moved, Math.abs(clamped - u.shift));
        u.shift = clamped;
      }
    }
    if (moved < RELAX_SETTLE) break;
  }

  const r = t.noteheadRadius;
  const maxAbsOffset = units.reduce(
    (acc, unit) =>
      unit.rows.reduce((a, c) => Math.max(a, -c.minOffset, c.maxOffset), acc),
    0
  );
  /** Columns further apart than this can never touch, whatever their rows. */
  const maxHalf = units.reduce(
    (acc, unit) => Math.max(acc, unitMaskWX(unit), unitMaskHY(unit)),
    0
  );
  const reach =
    2 * maxAbsOffset + 2 * maxHalf + 2 * pairGap + (hasClasp ? claspReach + CLASP_NOTEHEAD_AIR : 0);

  /** Halo-aware mask half-extents of one row's widest/tallest member. */
  const rowBox = (c: RowCluster): { wx: number; hy: number } => {
    let wx = 0;
    let hy = 0;
    for (const p of c.notes) {
      const e = knockoutHalfExtents(o, t, p.note.startTick);
      wx = Math.max(wx, e.wx);
      hy = Math.max(hy, e.hy);
    }
    return { wx, hy };
  };

  /**
   * Horizontal air two clusters of *different* onsets owe each other, box to
   * box: `wxA + wxB` while their rows' mask bands still overlap vertically,
   * and no constraint at all once vertical separation alone keeps the glyphs
   * clear. The visual linter audits different-onset neighbours against these
   * same boxes, so the solver must seat them there. Same-onset pairs instead
   * stand at the preset `2wx + air` fan built in Phase 1a.
   */
  const separation = (a: RowCluster, b: RowCluster): number | null => {
    const A = rowBox(a);
    const B = rowBox(b);
    const dy = Math.abs(a.y - b.y);
    if (dy + EPS >= A.hy + B.hy) return null;
    return A.wx + B.wx + CHORDAL_NEIGHBOUR_AIR;
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

    // The measure band and the beat cell are structural: a spread downbeat
    // chord may never be driven onto the preceding barline, and no head may
    // leave the beat cell of its own column.
    for (const cluster of unit.rows) {
      lo = Math.max(lo, unit.bandLeft - cluster.minOffset - unit.nominalX);
      hi = Math.min(hi, unit.bandRight - cluster.maxOffset - unit.nominalX);
      lo = Math.max(lo, unit.cellLeft - cluster.minOffset - unit.nominalX);
      hi = Math.min(hi, unit.cellRight - cluster.maxOffset - unit.nominalX);
    }
    return { lo, hi: Math.max(lo, hi) };
  };

  // -------------------------------------------------------------------------
  // 2. Spread and clasped columns first: keep the resolved placement whenever
  //    it is legal. A spread column keeps its centring shift — the placed
  //    position is the grammar's whole point — while a clasped column still
  //    takes the air its bracket needs (clasp-shifted columns keep their
  //    anchor on the shifted column).
  // -------------------------------------------------------------------------
  for (const unit of ordered) {
    if (!unit.spread && !unit.clasp) continue;
    if (!unit.clasp) continue;
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
        unit.cellLeft - minOff - unit.nominalX
      );
      const bandHi = Math.min(
        unit.bandRight - maxOff - unit.nominalX,
        unit.cellRight - maxOff - unit.nominalX
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
    // A moved head carries its rhythm stem and its augmentation dot with it:
    // the dot stays hugging the rectangular mask (`x + wx + gap`).
    const rhythm =
      x === p.x ? p.rhythm : { ...p.rhythm, x, dotX: x + wx + t.augmentationDotGap };
    return {
      ...p,
      x,
      rhythm,
      ...(unit ? { nominalX: unit.nominalX, beatCell: cell } : {}),
    };
  });

  return {
    notes: placed,
    claspTicks: new Set(ordered.filter((unit) => unit.clasp).map((unit) => unit.tick)),
    // Round 19: the beat's laid-out x — the unit's column after its rigid
    // translation, which is what the beat grid and the shared stem follow.
    columns: new Map(ordered.map((unit) => [unit.tick, unit.nominalX + unit.shift])),
  };
}

/** Position every note of one system, in engraving order. */
/**
 * Round 20 — **one sound, one digit**; Round 21 — the **lower head** keeps it.
 *
 * Two hands sounding the same pitch at the same onset produce one sound event
 * (a piano can only strike it once; no notation draws it twice), so the two
 * heads merge into **one** notehead at the anchor-winner's column — and since
 * Round 21's anchor rule is **lower-first**, the winner is the **lower voice**,
 * the Left Hand (Round 20 had given it to the RH tone).
 *
 * The merged duplicates leave the painted head list (so nothing measures or
 * fans them twice) and keep their **rhythm voice**:
 *
 * - **mixed durations** — every voice keeps its own stem, beam and flag (each
 *   voice's duration statement at its own end: the existing mixed-duration
 *   machinery, which never assumed a single hand);
 * - **exact duplicates** — the voices are identical, so the sound carries one
 *   rhythm statement and the duplicate voice is dropped whole.
 *
 * The returned voices are positioned on the survivor's solved column by
 * {@link layoutJankoSystem} once the column solve has settled.
 */
function mergeUnisonHeads(positioned: readonly PositionedJankoNote[]): {
  notes: PositionedJankoNote[];
  voices: PositionedJankoNote[];
  merges: JankoUnisonMerge[];
} {
  const groups = new Map<string, PositionedJankoNote[]>();
  for (const p of positioned) {
    const key = `${p.note.startTick}|${p.note.pitch.pitchClass}|${p.note.pitch.octave}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(p);
    else groups.set(key, [p]);
  }
  const notes: PositionedJankoNote[] = [];
  const voices: PositionedJankoNote[] = [];
  const merges: JankoUnisonMerge[] = [];
  for (const group of groups.values()) {
    const hands = new Set(group.map((p) => p.rhythm.hand));
    if (group.length < 2 || hands.size < 2) {
      notes.push(...group);
      continue;
    }
    // Lower-first: a cross-hand unison ties on pitch, so the *lower voice*
    // (LH) keeps the column and the digit.
    const survivor = group.find((p) => p.rhythm.hand === 'LH') ?? group[0];
    const others = group.filter((p) => p !== survivor);
    const exact = others.every((p) => p.note.durationTicks === survivor.note.durationTicks);
    notes.push(survivor);
    for (const p of others) {
      if (!exact) voices.push({ ...p, unisonSurvivorId: survivor.note.id });
    }
    merges.push({
      tick: survivor.note.startTick,
      pitchClass: survivor.note.pitch.pitchClass,
      octave: survivor.note.pitch.octave,
      survivorId: survivor.note.id,
      mergedIds: others.map((p) => p.note.id),
      exact,
    });
  }
  return { notes, voices, merges };
}

/** One stem-vs-foreign-digit breathing-room violation (Round 23). */
export interface JankoStemDigitCrossing {
  /** Id of the note (or merged voice) whose stem crosses. */
  stemNoteId: string;
  /** Id of the note whose digit is crossed. */
  digitNoteId: string;
  /** Penetration (pt) into the air-padded knockout. */
  shortfall: number;
}

/**
 * Every painted stem that reaches a foreign digit's air.
 *
 * Own stems start outside their own air by construction; a *foreign* stem —
 * typically one hand's beam-extended stem driving past the other hand's digit
 * in a shared column — has no such protection, and the standard knockout lets
 * it resume with less breathing room than an own-stem attachment. This finds
 * those crossings on final (beam-extended) extents so the crossed notes can
 * paint tall knockouts; columns never move.
 *
 * Only painted stems are tested: ids in `suppressed` (clasp-replaced,
 * vertical-chord interior, shared-stem members) are skipped. Knockout
 * geometry is paint truth (the preset rect the renderer erases), never the
 * halo-inflated audit box.
 */
export function detectStemDigitCrossings(
  notes: readonly PositionedJankoNote[],
  beams: readonly JankoBeamGroupGeometry[],
  ungrouped: readonly JankoRhythmNote[],
  o: ResolvedJankoLayoutOptions,
  t: ResolvedJankoTokens,
  suppressed?: ReadonlySet<string> | null
): JankoStemDigitCrossing[] {
  const air = t.stemAttachmentAir;
  const halfStem = JANKO_STEM_STROKE_WIDTH / 2;
  const preset = getClusterSpacingPreset(o.clusterSpacing);

  interface StemSeg {
    id: string;
    x: number;
    y0: number;
    y1: number;
  }
  const segs = new Map<string, StemSeg>();
  for (const beam of beams) {
    beam.notes.forEach((n, i) => {
      if (suppressed?.has(n.id)) return;
      const s = beam.stems[i];
      const yEnd = beam.beamY(s.stemX);
      segs.set(n.id, {
        id: n.id,
        x: s.stemX,
        y0: Math.min(s.stemStartY, yEnd),
        y1: Math.max(s.stemStartY, yEnd),
      });
    });
  }
  for (const n of ungrouped) {
    if (segs.has(n.id) || suppressed?.has(n.id)) continue;
    const s = getStemGeometry(n, t);
    segs.set(n.id, {
      id: n.id,
      x: s.stemX,
      y0: Math.min(s.stemStartY, s.stemEndY),
      y1: Math.max(s.stemStartY, s.stemEndY),
    });
  }

  const out: JankoStemDigitCrossing[] = [];
  for (const seg of segs.values()) {
    for (const q of notes) {
      if (q.note.id === seg.id) continue;
      const x0 = q.x - preset.wx - air;
      const x1 = q.x + preset.wx + air;
      if (seg.x + halfStem <= x0 + EPS || seg.x - halfStem >= x1 - EPS) continue;
      const y0 = q.y - preset.hy - air;
      const y1 = q.y + preset.hy + air;
      if (seg.y1 <= y0 + EPS || seg.y0 >= y1 - EPS) continue;
      const shortfall = Math.min(seg.x + halfStem - x0, x1 - (seg.x - halfStem));
      out.push({ stemNoteId: seg.id, digitNoteId: q.note.id, shortfall });
    }
  }
  return out;
}

export function layoutJankoSystem(
  score: QuantizedGridScore,
  geo: JankoPageGeometry,
  systemIndex: number,
  options?: Partial<JankoLayoutOptions> | null,
  tokens?: Partial<JankoTokens> | null
): JankoSystemLayout {
  const o = resolveJankoOptions(options);
  const t = resolveJankoTokens(tokens);
  const geometryRaw = getSystemGeometry(geo, systemIndex, o);
  const mps = geometryRaw.measuresPerSystem;
  const anacrusis = t.anacrusisTicks ?? 0;
  const startTick =
    systemIndex === 0 ? 0 : anacrusis + systemIndex * mps * t.ticksPerMeasure;
  const endTick = anacrusis + (systemIndex + 1) * mps * t.ticksPerMeasure;
  const sysNotes = score.notes
    .filter((n) => n.startTick >= startTick && n.startTick < endTick)
    .sort((a, b) => a.startTick - b.startTick || a.pitch.pitchClass - b.pitch.pitchClass);

  let geometry = geometryRaw;
  if (o.core === 'fixed-3' || o.core === 'fixed-4') {
    const scale = t.semitoneScale;
    const {
      segments: staffSegments,
      staffLines,
      coreLines,
      extensionLines,
    } = computeSystemStaffSegments(
      sysNotes,
      systemIndex,
      geometry.measuresPerSystem,
      geometry.staffLeft,
      geometry.staffRight,
      geometry.measureWidth,
      o.core,
      t,
      o.extensionJunction
    );

    const writtenLins: number[] = [];
    for (const n of sysNotes) {
      const pc = ((n.pitch.pitchClass % 12) + 12) % 12;
      const lin = n.pitch.octave * 12 + pc;
      const shift = computeFoldShift(lin, o.core);
      writtenLins.push(lin + shift);
    }

    const allLins = [...coreLines, ...staffLines, ...writtenLins];
    const effMin = Math.min(...allLins);
    const effMax = Math.max(...allLins);
    const staffTopY = geometry.middleCY + continuousPitchY(effMax, scale) - 16.0;
    const staffBotY = geometry.middleCY + continuousPitchY(effMin, scale) + 16.0;

    geometry = {
      ...geometry,
      index: systemIndex,
      staffTopY,
      staffBotY,
      systemTopY: staffTopY + 7.0,
      pitchWindow: { min: effMin, max: effMax },
      coreLines,
      extensionLines,
      staffLines,
      staffSegments,
    };
  }
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
  let mergedVoices: PositionedJankoNote[] = [];
  let unisonMerges: JankoUnisonMerge[] = [];
  let chordColumns: JankoChordColumnResolution = {
    notes: [],
    claspTicks: new Set<number>(),
    columns: new Map<number, number>(),
  };
  for (let attempt = 0; ; attempt++) {
    const raw = sysNotes.map((n) =>
      positionJankoNote(n, geometry, systemIndex, o, t, flanks?.get(n.id) ?? null, claspInsets)
    );
    // Round 20: one sound, one digit — cross-hand unisons merge before the
    // column solve, so the survivor keeps its column with no fan.
    const merged = mergeUnisonHeads(raw);
    positioned = merged.notes;
    mergedVoices = merged.voices;
    unisonMerges = merged.merges;
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
  // Round 17: the dot high-lane fallback resolves on the solved columns, where
  // same-row neighbours sit at their final x.
  const notesAfterHighLane = resolveDotHighLane(chordColumns.notes, geometry, o, t);
  // Round 29: dot flag-clearance standard escapes flagged singles right then up
  const notesAfterFlagClearance = resolveDotFlagClearance(notesAfterHighLane, geometry, o, t);
  // Round 30: the second dot of every double-dotted value (complete grammar
  // only — golden returns its input untouched).
  const notes = resolveSecondDots(notesAfterFlagClearance, geometry, o, t);
  // Round 20: a merged mixed-duration voice follows its survivor's solved
  // column, so its stem/beam/flag leaves the one painted head.
  const solvedById = new Map(notes.map((p) => [p.note.id, p]));
  const unisonVoices = mergedVoices.map((voice) => {
    const survivor = solvedById.get(voice.unisonSurvivorId ?? '');
    if (!survivor) return voice;
    return {
      ...voice,
      x: survivor.x,
      nominalX: survivor.nominalX,
      rhythm: {
        ...voice.rhythm,
        x: survivor.x,
        ...(voice.rhythm.dotX === undefined
          ? {}
          : {
              dotX:
                survivor.rhythm.dotX ??
                survivor.x +
                getClusterSpacingPreset(o.clusterSpacing).wx +
                t.augmentationDotGap,
              dotY: survivor.rhythm.dotY,
            }),
      },
    };
  });

  // Round 17B: rests resolve before beams — bridging re-joins runs across the
  // admitted printed rests, and every connector clears their ink.
  const restLayer = computeJankoRestLayer(score, geometry, systemIndex, o, t, notes);

  let beams: JankoBeamGroupGeometry[] = [];
  let ungrouped: JankoRhythmNote[] = [];
  if (o.rhythmStyle === 'beamed') {
    // Every notehead of the system is an obstacle for every beam group: the
    // shared lattice lets one hand's beam cross the other hand's staff lines.
    // The Middle C spine is handed to the solver as well, so no connector can
    // ever slice across the corridor — and the printed rest ink boxes join
    // the obstacles, so a bridged beam clears the rest it spans. Round 20: a
    // merged unison's mixed-duration voices join the partition, so a voice that
    // belongs to a beam keeps its beam.
    const rhythmNotes = [...notes, ...unisonVoices].map((p) => p.rhythm);
    const partition = bridgeBeamGroupsAcrossRests(
      partitionBeamGroups(rhythmNotes, t, geometry.middleCY),
      restLayer.rests,
      t
    );
    const restInk = restLayer.rests.map((r) => restInkBox(r, t));
    beams = partition.groups
      .map((group) =>
        computeBeamGroupGeometry(group, t, rhythmNotes, geometry.middleCY, restInk, o.durationGrammar)
      )
      .filter((g): g is JankoBeamGroupGeometry => g !== null);
    ungrouped = partition.ungrouped;
  }

  // Round 5: external left clasps group every vertical simultaneity and carry
  // its duration. A clasp member that is part of a beam keeps its stem, so no
  // real 16th-note beam is ever broken by the grouping. Every bracket is
  // re-audited against the *solved* columns: a clasp the engine cannot engrave
  // cleanly is dropped and its cluster falls back to traditional stems.
  //
  // Round 19: a **unified** cross-hand bracket (both hands' spans overlap) keeps
  // both hands' duration information — one ink group per hand. The open
  // half/whole marks read as the bracket's own value and sit at its midpoint;
  // each hand's transverse subdivision marks stay at that hand's vertical
  // centre.
  const unifiedClaspInk = (
    cluster: JankoClaspCluster
  ): JankoClaspDurationInk[] | undefined => {
    if (!cluster.unified) return undefined;
    const handY = (members: readonly PositionedJankoNote[]): number =>
      (Math.min(...members.map((p) => p.y)) + Math.max(...members.map((p) => p.y))) / 2;
    const byHand = new Map<Hand, PositionedJankoNote[]>();
    for (const p of cluster.notes) {
      const bucket = byHand.get(p.rhythm.hand);
      if (bucket) bucket.push(p);
      else byHand.set(p.rhythm.hand, [p]);
    }
    const open: number[] = [];
    const transverse: JankoClaspDurationInk[] = [];
    for (const members of byHand.values()) {
      const value = Math.min(...members.map((p) => p.note.durationTicks));
      const cls = claspDurationClass(value);
      if (cls === 'pip' || cls === 'double-pip') open.push(value);
      else if (cls === 'spire-one-flag' || cls === 'spire-two-flags') {
        transverse.push({ centerY: handY(members), durationTicks: value });
      }
    }
    const midY =
      (Math.min(...cluster.notes.map((p) => p.y)) +
        Math.max(...cluster.notes.map((p) => p.y))) /
      2; // the bracket's midpoint (the disc radius cancels out)
    const ink: JankoClaspDurationInk[] = [];
    if (open.length > 0) ink.push({ centerY: midY, durationTicks: Math.min(...open) });
    ink.push(...transverse);
    return ink.length > 0 ? ink : undefined;
  };
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
          // Round 30: the bracket's dots derive from the active grammar
          // (a double-dotted carried value dots twice under complete).
          durationGrammar: o.durationGrammar,
          // Round 31: the situational dot translation (default [0, 0]).
          claspDotNudge: o.claspDotNudge,
          ...(() => {
            const ink = unifiedClaspInk(cluster);
            return ink ? { durationInk: ink } : {};
          })(),
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
  let claspedStems = clasps
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

  // Round 16 shared stems (standard chord rule), under the same per-hand-clasp
  // gate as the vertical chords: one hand's same-duration voices of one onset —
  // stacked or flanked, clasped or bare — share a single stem object on the
  // nominal column. A hand-onset already unified by a vertical chord is left to
  // that grammar (identical outcome); mixed durations keep their per-voice
  // stems (each voice's beam/flag at its own end), and a clasped mixed stack
  // stays fully bracketed. The carrier stands on the column at the extremity
  // in stem direction, so its stem always leaves outward and can never be
  // painted through a fellow member's head (the `stem-through-simultaneity`
  // defect). A clasped carrier keeps its stem — the one stem the bracket does
  // not replace.
  const sharedStems: JankoSharedStemGroup[] = [];
  if (o.chordGrouping === 'per-hand-clasp') {
    const chordedIds = new Set(
      verticalChords.flatMap((chord) => [chord.carrier.id, ...chord.suppressedIds])
    );
    const byHandOnset = new Map<string, PositionedJankoNote[]>();
    for (const p of notes) {
      const key = `${p.note.startTick}|${p.rhythm.hand}`;
      const bucket = byHandOnset.get(key);
      if (bucket) bucket.push(p);
      else byHandOnset.set(key, [p]);
    }
    for (const group of byHandOnset.values()) {
      if (group.length < 2) continue;
      if (group.every((p) => chordedIds.has(p.note.id))) continue;
      if (group.some((p) => beamedIds.has(p.note.id))) continue;
      if (!group.every((p) => p.note.durationTicks === group[0].note.durationTicks)) continue;
      const hand = group[0].rhythm.hand;
      const dir = stemDirection(hand);
      // The unit's **laid-out** column (Round 19): the column solve translates
      // the whole onset rigidly, so the axis every member of this hand is
      // fanned around is `nominalX + shift`, not the un-shifted proportional
      // beat column. The symmetric tuck can leave a displaced head sitting on
      // the *old* nominal x while the row anchors moved off it — ranking by
      // that stale x is what handed the shared stem to a tucked interior head
      // whose stem then pierced the anchor's disc (Brahms m. 17).
      const nominal =
        chordColumns.columns.get(group[0].note.startTick) ??
        group[0].nominalX ??
        group.reduce((acc, p) => acc + p.x, 0) / group.length;
      // Nearest the column first, then the extremity in stem direction
      // (topmost for RH, bottommost for LH), then id: deterministic, on-column
      // whenever any member kept the column, and always outward-facing.
      const rank = (p: PositionedJankoNote): [number, number, string] => [
        Math.abs(p.x - nominal),
        dir < 0 ? p.y : -p.y,
        p.note.id,
      ];
      let carrier = group[0];
      let best = rank(carrier);
      for (const p of group) {
        const r = rank(p);
        if (
          r[0] < best[0] - EPS ||
          (Math.abs(r[0] - best[0]) <= EPS &&
            (r[1] < best[1] - EPS ||
              (Math.abs(r[1] - best[1]) <= EPS && r[2] < best[2])))
        ) {
          carrier = p;
          best = r;
        }
      }
      sharedStems.push({
        tick: group[0].note.startTick,
        hand,
        carrierId: carrier.note.id,
        suppressedIds: group.map((p) => p.note.id).filter((id) => id !== carrier.note.id),
      });
    }
  }
  if (sharedStems.length > 0) {
    const carrierIds = new Set(sharedStems.map((group) => group.carrierId));
    claspedStems = claspedStems.filter((id) => !carrierIds.has(id));
  }

  // Round 23: flag crossed notes for tall knockouts. Paint-only — every head
  // keeps its column; the erasure grows to the stem-start line instead.
  const suppressed = new Set<string>([
    ...claspedStems,
    ...verticalChords.flatMap((chord) => chord.suppressedIds),
    ...sharedStems.flatMap((group) => group.suppressedIds),
  ]);
  const crossed = new Set(
    detectStemDigitCrossings(notes, beams, ungrouped, o, t, suppressed).map((c) => c.digitNoteId)
  );
  const flaggedNotes =
    crossed.size === 0
      ? notes
      : notes.map((p) => (crossed.has(p.note.id) ? { ...p, tallKnockout: true } : p));

  const ottavaBrackets = buildSystemOttavaBrackets(
    flaggedNotes,
    geometry,
    o,
    t,
    unisonMerges
  );

  return {
    index: systemIndex,
    isFinalSystem: systemIndex >= countJankoSystems(score, o, t) - 1,
    geometry,
    notes: flaggedNotes,
    beams,
    ungrouped,
    rests: restLayer.rests,
    unwrittenRests: restLayer.unwritten,
    clasps,
    claspRails,
    claspedStems,
    verticalChords,
    chordBridges,
    sharedStems,
    columns: chordColumns.columns,
    unisonMerges,
    unisonVoices,
    ottavaBrackets,
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
  const geo = computePageGeometry(o, t, score);
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
  gridInk: string = '',
  threadInk: string = '',
  tickInk: string = ''
): string {
  const out: string[] = ['  <g class="janko-notes">'];

  // 0. Contour thread (the contour round): the true-pitch hairline is painted
  //    first, beneath every ledger, stem, beam and head, so the notehead
  //    knockouts weave it under the digits — visible in the gaps, tucked
  //    under the glyphs. Empty unless `contourThread` voices a hand.
  if (threadInk.length > 0) out.push(threadInk);

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
  //    group's outer extremity carries the whole hand's duration. Round 16
  //    shared stems suppress every member but the carrier the same way again.
  const suppressed = suppressedStemIds(layout);
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
      out.push(renderBeamGroup(beam.notes, t, beam, o.subdivisionStyle, o.durationGrammar));
    }
    // Round 30: a clasp member's kept stem renders with the golden grammar —
    // the bracket owns the member's duration, so the stem carries no
    // preview ink of its own (no double dots, no member rings).
    const claspedIds = new Set(layout.clasps.flatMap((c) => c.notes.map((n) => n.id)));
    for (const n of layout.ungrouped) {
      if (suppressed.has(n.id)) continue;
      const grammar = claspedIds.has(n.id) ? 'golden' : o.durationGrammar;
      out.push(renderRhythm(asEngraved(n), 'beamed', t, o.subdivisionStyle, grammar));
    }
  } else {
    for (const p of layout.notes) {
      if (suppressed.has(p.rhythm.id)) continue;
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
  //     layer — so no stem or beam may ever overwrite it — while the
  //     rectangular notehead masks painted in step 3 still knock it out inside
  //     their mask.
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
          isPositionOfHonor: p.note.startTick === 0 && o.showHonorHalo,
          tallKnockout: p.tallKnockout === true,
        },
        t,
        o
      )
    );
  }

  // 4. Contour departure ticks (the contour round): head-adjacent articulation
  //    painted last, like augmentation dots — each tick clears every mask by
  //    construction (see `elements/contour.placeContourTick`). Empty unless
  //    `contourTicks` is on.
  if (tickInk.length > 0) out.push(tickInk);

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
    layout ?? layoutJankoSystem(score, computePageGeometry(o, t, score), systemIndex, o, t);
  const sysGeo = resolved.geometry;
  const startMeasureOffset = systemIndex * sysGeo.measuresPerSystem;

  const out: string[] = [];
  out.push(`  <g id="system-${systemIndex + 1}">`);
  const anacrusis = t.anacrusisTicks ?? 0;
  if (o.showMeasureNumbers && (systemIndex > 0 || anacrusis === 0)) {
    out.push(renderMeasureNumber(sysGeo, startMeasureOffset + 1, t));
  }
  // The start bracket marks the core triple across every system. System 1
  // (page 1 opening) renders the bracket at slightly grander metrics.
  // Hand labels and time signature remain strictly at System 1.
  const systemStart = renderAccolade(sysGeo, o, t, systemIndex);
  if (systemStart.length > 0) out.push(systemStart);
  if (systemIndex === 0) {
    out.push(renderHandLabels(sysGeo, o, t));
    out.push(renderTimeSignature(sysGeo, o, t));
  }
  out.push(renderOctaveLabels(sysGeo, o, t));
  out.push(renderStaffLines(sysGeo, o, t));
  // Round 12: the continuous vertical grid (measure barlines + dashed beat
  // pulses). Under `'strict-protected-grid'` it is handed to the notes layer and
  // painted above the rhythm ink on its own white air channels; every other
  // policy paints it first, as the transparent structural background it is.
  const gridInk = [
    renderBeatGrid(sysGeo, systemIndex, o, t, resolved.columns),
    renderBarlines(sysGeo, o, t, resolved.isFinalSystem),
  ].join('\n');
  // The contour round: all three paradigms are pure functions of
  // (score, layout) — every layer is '' when its option is off, so the
  // golden master never sees this code path.
  const contour = buildSystemContour(score, resolved, o, t);
  if (channelsGridInk(o.gridWritingPolicy)) {
    out.push(renderNotesLayer(resolved, o, t, gridInk, contour.thread, contour.ticks));
  } else {
    out.push(gridInk);
    out.push(renderNotesLayer(resolved, o, t, '', contour.thread, contour.ticks));
  }
  const ottavaSvg = renderOttavaBrackets(resolved.ottavaBrackets, t);
  if (ottavaSvg.length > 0) out.push(ottavaSvg);
  // The contour strip lives below the staff in the inter-system air.
  if (contour.strip.length > 0) out.push(contour.strip);
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
  const geo = computePageGeometry(o, t, score);
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
  // The contour round: thread, ticks and strip are measured from the same
  // builders the renderer paints, converted to staff-relative coordinates —
  // so a crop never slices contour ink. Untouched when the options are off.
  if (o.contourThread !== 'none' || o.contourTicks || o.contourStrip) {
    const mps = geo.measuresPerSystem;
    const firstSystem = Math.floor(startIdx / mps);
    const lastSystem = Math.floor((startIdx + count - 1) / mps);
    const total = countJankoSystems(score, o, t);
    for (let s = firstSystem; s <= Math.min(lastSystem, total - 1); s++) {
      const layout = layoutJankoSystem(score, geo, s, o, t);
      const bounds = contourSystemInkBounds(score, layout, o, t);
      if (!bounds) continue;
      const middleCY = layout.geometry.middleCY;
      top = Math.max(top, staffTop - CROP_PAD_TOP - (bounds.top - middleCY));
      bottom = Math.max(bottom, bounds.bottom - middleCY - (staffBottom + CROP_PAD_BOTTOM));
    }
  }
  const mps = geo.measuresPerSystem;
  const firstSystem = Math.floor(startIdx / mps);
  const lastSystem = Math.floor((startIdx + count - 1) / mps);
  const total = countJankoSystems(score, o, t);
  for (let s = firstSystem; s <= Math.min(lastSystem, total - 1); s++) {
    const layout = layoutJankoSystem(score, geo, s, o, t);
    if (layout.ottavaBrackets && layout.ottavaBrackets.length > 0) {
      const middleCY = layout.geometry.middleCY;
      for (const b of layout.ottavaBrackets) {
        const hookY = b.lineY + (b.hookDirection === -1 ? -b.hookLength : b.hookLength);
        const bTop = Math.min(b.lineY, hookY) - middleCY;
        const bBot = Math.max(b.lineY, hookY) - middleCY;
        top = Math.max(top, staffTop - CROP_PAD_TOP - bTop);
        bottom = Math.max(bottom, bBot - (staffBottom + CROP_PAD_BOTTOM));
      }
    }
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
      ? geo.marginLeft - CROP_PAD_X
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
  const geo = computePageGeometry(o, t, score);
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

export {
  computeBarStaffRows,
  computeSystemStaffSegments,
  getBarStaffSegments,
  getBarStaffRows,
};

