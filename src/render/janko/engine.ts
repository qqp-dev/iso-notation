/**
 * Jánko Two-Row Engraving Engine
 * ==============================
 *
 * Deterministic, modular engraving of the *Jánko Two-Row Equator* grand staff.
 * The engine is split into a pure geometry core (`geometry.ts`), pluggable
 * element renderers (`elements/*`) and this page/crop/comparison composition
 * layer. No coordinate math or SVG template lives in the export scripts.
 *
 * Public entry points
 * -------------------
 * - {@link renderJankoPage}               — full A4 page (3 systems, 12 mm.)
 * - {@link renderJankoCrop}               — targeted macro crop of N measures
 * - {@link renderJankoVariantComparison}  — side-by-side variant contact sheet
 */

import { Hand, QuantizedGridScore, QuantizedNote } from '../../model/types';
import {
  JankoPitchCoordinate,
  getEquatorYForOctave,
  getPitchCoordinate,
  getTickX,
  splitTick,
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
  JankoRhythmNote,
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
 * The Middle C spine is centred in the `interStaffGap` channel between the RH
 * inner equator (o4) and the LH inner equator (o3); every hand's lattice then
 * extends by `octaveStep` per octave (see `geometry.getEquatorYForOctave`).
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
// Note positioning
// ---------------------------------------------------------------------------

/** One positioned note with its resolved geometry and rhythm payload. */
export interface PositionedJankoNote {
  note: QuantizedNote;
  coord: JankoPitchCoordinate;
  x: number;
  y: number;
  rhythm: JankoRhythmNote;
}

function handForNote(note: QuantizedNote): Hand {
  return note.hand ?? (note.pitch.octave >= 4 ? 'RH' : 'LH');
}

function positionNote(
  note: QuantizedNote,
  geo: JankoSystemGeometry,
  systemIndex: number,
  o: ResolvedJankoLayoutOptions,
  t: ResolvedJankoTokens
): PositionedJankoNote {
  const { measureOffset, tickInMeasure } = splitTick(note.startTick, t);
  const measureIdx = measureOffset - systemIndex * geo.measuresPerSystem;
  const isOpeningMeasure = systemIndex === 0 && measureIdx === 0;
  const insets =
    isOpeningMeasure && o.showTimeSignature && o.timeSignatureWidth > 0
      ? { left: t.measureInset + o.timeSignatureWidth, right: t.measureInset }
      : undefined;

  const x =
    geo.staffLeft +
    getTickX(note.startTick, measureIdx, tickInMeasure, geo.measureWidth, t, insets);
  const hand = handForNote(note);
  const coord = getPitchCoordinate(note.pitch.pitchClass, note.pitch.octave, hand, t, o);
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
// System rendering
// ---------------------------------------------------------------------------

function renderNotesLayer(
  positioned: PositionedJankoNote[],
  geo: JankoSystemGeometry,
  o: ResolvedJankoLayoutOptions,
  t: ResolvedJankoTokens
): string {
  const out: string[] = ['  <g class="janko-notes">'];
  const rhythmNotes: JankoRhythmNote[] = [];

  for (const p of positioned) {
    // 1. Dynamic ledger equators for out-of-staff octaves.
    for (const ledgerY of p.coord.ledgerYs) {
      out.push(renderLedgerEquator(p.x, geo.middleCY + ledgerY, t));
    }
    // 2. Position of Honor halo + white knockout + duodecimal digit.
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
    // 3. Rhythm (the beamed dialect renders its stems group-wise below).
    rhythmNotes.push(p.rhythm);
    if (o.rhythmStyle !== 'beamed') {
      out.push(renderRhythm(p.rhythm, o.rhythmStyle, t));
    }
  }

  if (o.rhythmStyle === 'beamed') {
    const { groups, ungrouped } = partitionBeamGroups(rhythmNotes, t);
    for (const group of groups) out.push(renderBeamGroup(group, t));
    for (const n of ungrouped) out.push(renderRhythm(n, 'beamed', t));
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
  tokens?: Partial<JankoTokens> | null
): string {
  const o = resolveJankoOptions(options);
  const t = resolveJankoTokens(tokens);
  const mps = geo.measuresPerSystem;
  const startMeasureOffset = systemIndex * mps;
  const startTick = startMeasureOffset * t.ticksPerMeasure;
  const endTick = startTick + mps * t.ticksPerMeasure;
  const sysNotes = score.notes
    .filter((n) => n.startTick >= startTick && n.startTick < endTick)
    .sort((a, b) => a.startTick - b.startTick || a.pitch.pitchClass - b.pitch.pitchClass);

  const positioned = sysNotes.map((n) => positionNote(n, geo, systemIndex, o, t));

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
  out.push(renderNotesLayer(positioned, geo, o, t));
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
  for (let s = Math.max(0, firstSystem); s <= lastSystem && s < geo.systems.length; s++) {
    out.push(renderSystem(score, geo.systems[s], s, o, t));
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
  for (let s = firstSystem; s < firstSystem + geo.systemsPerPage; s++) {
    if (s >= geo.systems.length) break;
    body.push(renderSystem(score, geo.systems[s], s, o, t));
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

/**
 * Compute the macro-crop box for `measureCount` measures from `measureStart`.
 * `includeCaptionBand` reserves the strip above the staff used by
 * {@link renderJankoCrop} for its caption (comparison panels omit it).
 */
export function computeCropBox(
  geo: JankoPageGeometry,
  measureStart: number,
  measureCount: number,
  includeCaptionBand: boolean = true
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
  for (let s = firstSystem; s <= lastSystem && s < geo.systems.length; s++) {
    staffTop = Math.min(staffTop, geo.systems[s].staffTopY);
    staffBottom = Math.max(staffBottom, geo.systems[s].staffBotY);
  }
  if (!Number.isFinite(staffTop)) {
    staffTop = geo.systems[0].staffTopY;
    staffBottom = geo.systems[0].staffBotY;
  }

  const captionHeight = includeCaptionBand ? CROP_CAPTION_HEIGHT : 0;
  const y0 = staffTop - CROP_PAD_TOP - captionHeight;
  const y1 = staffBottom + CROP_PAD_BOTTOM;
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
 * An optional `caption` is appended to the auto measure-range label.
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
  const box = computeCropBox(geo, measureStart, measureCount);

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
