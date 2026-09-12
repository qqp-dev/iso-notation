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
  JankoRhythmNote,
  computeBeamGroupGeometry,
  partitionBeamGroups,
  renderBeamGroup,
  renderRhythm,
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
      measureWidth,
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
  const totalTicks = score.totalTicks || 0;
  const measuresTotal = Math.max(1, Math.ceil(totalTicks / t.ticksPerMeasure));
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
}

function handForNote(note: QuantizedNote): Hand {
  return getNoteHand(note.hand, note.pitch.octave);
}

/**
 * Horizontal insets of one measure of a system: the canonical
 * `tokens.measureInset` on both sides, widened on the left of the very first
 * measure of the page when a time signature has to be cleared.
 */
export function getMeasureInsets(
  systemIndex: number,
  measureIdx: number,
  o: ResolvedJankoLayoutOptions,
  t: ResolvedJankoTokens
): JankoTickInsets {
  const isOpeningMeasure = systemIndex === 0 && measureIdx === 0;
  return isOpeningMeasure && o.showTimeSignature && o.timeSignatureWidth > 0
    ? { left: t.measureInset + o.timeSignatureWidth, right: t.measureInset }
    : { left: t.measureInset, right: t.measureInset };
}

/** Measure index (inside its system) of a note's onset. */
export function getMeasureIndexOfTick(
  note: QuantizedNote,
  geo: JankoSystemGeometry,
  systemIndex: number,
  t: ResolvedJankoTokens
): number {
  const { measureOffset } = splitTick(note.startTick, t);
  return measureOffset - systemIndex * geo.measuresPerSystem;
}

/** Beat column of one note inside its system (page pt, before any chord offset). */
function getNominalNoteX(
  note: QuantizedNote,
  geo: JankoSystemGeometry,
  systemIndex: number,
  o: ResolvedJankoLayoutOptions,
  t: ResolvedJankoTokens
): number {
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
      getMeasureInsets(systemIndex, measureIdx, o, t)
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
  flank?: JankoChannelFlank | null
): PositionedJankoNote {
  const x = getNominalNoteX(note, geo, systemIndex, o, t);
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
 */
export function resolveRowSnappedChordOffsets(
  notes: readonly PositionedJankoNote[],
  geo: JankoSystemGeometry,
  systemIndex: number,
  o: ResolvedJankoLayoutOptions,
  t: ResolvedJankoTokens
): PositionedJankoNote[] {
  const delta = getChordalOffset(t);
  const gap = 2 * t.noteheadRadius + CHORDAL_NEIGHBOUR_AIR;

  // -------------------------------------------------------------------------
  // 1. Partition the system into onset units, each split into row clusters.
  // -------------------------------------------------------------------------
  const unitByTick = new Map<number, OnsetUnit>();
  const clusterByRow = new Map<string, RowCluster>();
  for (const p of notes) {
    let unit = unitByTick.get(p.note.startTick);
    if (!unit) {
      const measureIdx = getMeasureIndexOfTick(p.note, geo, systemIndex, t);
      const insets = getMeasureInsets(systemIndex, measureIdx, o, t);
      const measureLeft = geo.staffLeft + measureIdx * geo.measureWidth;
      unit = {
        tick: p.note.startTick,
        nominalX: p.x,
        measureIdx,
        rows: [],
        shift: 0,
        spread: false,
        bandLeft: measureLeft + (insets.left ?? t.measureInset),
        bandRight: measureLeft + geo.measureWidth - (insets.right ?? t.measureInset),
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
  }
  // Fast path: a system with no same-row chord tone anywhere cannot move a
  // single column, so the whole solve is skipped.
  if (!units.some((unit) => unit.spread)) return [...notes];

  const r = t.noteheadRadius;
  const maxHalfSpan = units.reduce(
    (acc, unit) => unit.rows.reduce((a, c) => Math.max(a, c.halfSpan), acc),
    0
  );
  /** Columns further apart than this can never touch, whatever their rows. */
  const reach = 2 * maxHalfSpan + 2 * r + delta;

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

  /** Legal translation window of one column against the *current* neighbours. */
  const windowOf = (unit: OnsetUnit): { lo: number; hi: number } => {
    let lo = Number.NEGATIVE_INFINITY;
    let hi = Number.POSITIVE_INFINITY;
    for (const other of neighboursByUnit.get(unit)!) {
      const shortfall = shortfallFrom(unit, other);
      if (shortfall > 0) lo = Math.max(lo, unit.shift + shortfall);
      else if (shortfall < 0) hi = Math.min(hi, unit.shift + shortfall);
    }
    // The measure band is structural: a spread downbeat chord may never be
    // driven onto the preceding barline.
    for (const cluster of unit.rows) {
      lo = Math.max(lo, unit.bandLeft + cluster.halfSpan - unit.nominalX);
      hi = Math.min(hi, unit.bandRight - cluster.halfSpan - unit.nominalX);
    }
    return { lo, hi };
  };

  const ordered = [...units].sort((a, b) => a.tick - b.tick);

  // -------------------------------------------------------------------------
  // 2. Spread columns first: keep the symmetric placement whenever it is legal.
  // -------------------------------------------------------------------------
  for (const unit of ordered) {
    if (!unit.spread) continue;
    const { lo, hi } = windowOf(unit);
    if (lo <= 0 && 0 <= hi) continue;
    // Over-constrained: split the residual displacement evenly rather than
    // dumping it all on one side.
    unit.shift = lo <= hi ? Math.max(lo, Math.min(hi, 0)) : (lo + hi) / 2;
  }

  // -------------------------------------------------------------------------
  // 3. Plain columns yield the air a spread neighbour needs. A column only ever
  //    steps *away* from a violation, so this cannot oscillate.
  // -------------------------------------------------------------------------
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (const unit of ordered) {
      if (unit.spread) continue;
      let pushRight = 0;
      let pushLeft = 0;
      for (const other of neighboursByUnit.get(unit)!) {
        const shortfall = shortfallFrom(unit, other);
        if (shortfall > 0) pushRight = Math.max(pushRight, shortfall);
        else if (shortfall < 0) pushLeft = Math.max(pushLeft, -shortfall);
      }
      if (pushRight <= 0 && pushLeft <= 0) continue;
      // A column squeezed from both sides stays put: moving would only trade
      // one collision for the other, and the linter reports the squeeze.
      const step = pushRight > 0 && pushLeft > 0 ? 0 : pushRight > 0 ? pushRight : -pushLeft;
      if (step === 0) continue;
      const halfSpans = unit.rows.map((cluster) => cluster.halfSpan);
      const clamped = Math.max(
        unit.bandLeft + Math.max(...halfSpans) - unit.nominalX,
        Math.min(unit.bandRight - Math.max(...halfSpans) - unit.nominalX, unit.shift + step)
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

  return notes.map((p) => {
    const x = resolved.get(p.note.id);
    if (x === undefined || x === p.x) return p;
    return { ...p, x, rhythm: { ...p.rhythm, x } };
  });
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
  const startTick = systemIndex * mps * t.ticksPerMeasure;
  const endTick = startTick + mps * t.ticksPerMeasure;
  const sysNotes = score.notes
    .filter((n) => n.startTick >= startTick && n.startTick < endTick)
    .sort((a, b) => a.startTick - b.startTick || a.pitch.pitchClass - b.pitch.pitchClass);
  // The two dynamic layouts resolve each Set B flank against the *whole*
  // voice, so the contour is continuous across system and page breaks.
  const flanks = usesContourFlanks(o.channelLayout)
    ? resolveChannelFlanks(score.notes, o, t)
    : null;
  const positioned = sysNotes.map((n) =>
    positionJankoNote(n, geometry, systemIndex, o, t, flanks?.get(n.id) ?? null)
  );
  // Approach 2: heads that share an onset, an octave and a whole-tone row are
  // spread horizontally around the beat column instead of being merged.
  const notes = resolveRowSnappedChordOffsets(positioned, geometry, systemIndex, o, t);

  let beams: JankoBeamGroupGeometry[] = [];
  let ungrouped: JankoRhythmNote[] = [];
  if (o.rhythmStyle === 'beamed') {
    // Every notehead of the system is an obstacle for every beam group: the
    // shared lattice lets one hand's beam cross the other hand's staff lines.
    // The Middle C spine is handed to the solver as well, so no connector can
    // ever slice across the corridor.
    const rhythmNotes = notes.map((p) => p.rhythm);
    const partition = partitionBeamGroups(rhythmNotes, t);
    beams = partition.groups
      .map((group) => computeBeamGroupGeometry(group, t, rhythmNotes, geometry.middleCY))
      .filter((g): g is JankoBeamGroupGeometry => g !== null);
    ungrouped = partition.ungrouped;
  }

  return { index: systemIndex, geometry, notes, beams, ungrouped };
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
  if (o.rhythmStyle === 'beamed') {
    for (const beam of layout.beams) {
      out.push(renderBeamGroup(beam.notes, t, beam));
    }
    for (const n of layout.ungrouped) out.push(renderRhythm(n, 'beamed', t));
  } else {
    for (const p of layout.notes) out.push(renderRhythm(p.rhythm, o.rhythmStyle, t));
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
  if (o.showMeasureNumbers) {
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
  const startTick = startIdx * t.ticksPerMeasure;
  const endTick = (startIdx + count) * t.ticksPerMeasure;
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

  const x0 =
    startMIdx === 0
      ? geo.margin - CROP_PAD_X
      : geo.staffLeft + startMIdx * geo.measureWidth - CROP_PAD_X;
  const x1 = geo.staffLeft + (endMIdx + 1) * geo.measureWidth + CROP_PAD_X;

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
