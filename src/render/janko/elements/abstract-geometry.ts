/**
 * Twelve-Site Spatial Alphabet — Abstract Geometry Elements
 * ==========================================================
 *
 * Implements candidate geometries for the 12-site spatial alphabet comparison:
 * 1. Dial: regular 12-gon circle, R = 2 / sin(π/12) ≈ 7.7274pt.
 * 2. Rosette: alternating 12-site star pattern, radii 4√3 (even) and 4 (odd).
 * 3. Asymmetric constellation: planar arrangement on 4pt coordinate steps.
 *
 * Rules:
 * - Common node radius: 0.55pt.
 * - Minimum centre separation: ≥ 4.0pt across all candidate pairs.
 * - SVG coordinate system: x right, y down.
 * - Site labels: 0..11 correspond to '0'..'b'.
 * - Key enlarged 3×: site labels replace node dots (no competing dots).
 * - Subset samples: contain ONLY four identical filled circles ({0,3,7,a} or {0,5,7,a}).
 *   No connectors, ghosts, enclosing shape, internal scale, anchor decoration or inactive sites.
 * - Viewports: common equal viewport and scale across cards for honest footprint comparison.
 */

import { f } from './style';

/** Common node radius in pt for all twelve-site candidate arrangements. */
export const ABSTRACT_NODE_RADIUS = 0.55;

/** Minimum centre separation in pt between any two sites in a configuration. */
export const ABSTRACT_MIN_SEPARATION = 4.0;

/** Magnification factor of the labelled twelve-site key relative to subset specimens. */
export const ABSTRACT_KEY_SCALE = 3.0;

/** Site label identities for indices 0..11 (0..b). */
export const ABSTRACT_SITE_LABELS = [
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  'a',
  'b',
] as const;

export type AbstractSiteLabel = (typeof ABSTRACT_SITE_LABELS)[number];

export type AbstractGeometryId = 'dial' | 'rosette' | 'ladder' | 'asymmetric';

export interface Point2D {
  readonly x: number;
  readonly y: number;
}

export interface RectBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
  readonly width: number;
  readonly height: number;
}

export interface ViewportBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Common equal specimen viewport for all 1:1 four-site subset samples.
 * Centered at configuration origin (0, 0) to preserve honest footprint comparison.
 */
export const ABSTRACT_SUBSET_VIEWPORT: ViewportBox = {
  x: -14,
  y: -14,
  width: 28,
  height: 28,
};

/**
 * Common equal specimen viewport for the 3× enlarged twelve-site key.
 * Exactly 3× the dimension of the subset viewport (84 = 3 * 28), centered at (0, 0).
 */
export const ABSTRACT_KEY_VIEWPORT: ViewportBox = {
  x: -42,
  y: -42,
  width: 84,
  height: 84,
};

/**
 * Common font family for key labels, matching Jánko duodecimal digit typography.
 */
export const ABSTRACT_KEY_FONT_FAMILY =
  '"URW Gothic", "Century Gothic", "ITC Avant Garde Gothic", "Avant Garde", sans-serif';

/** Font size in pt for 3× enlarged key labels. */
export const ABSTRACT_KEY_FONT_SIZE_PT = 7.0;

/** The first four-site subset sample {0, 3, 7, a}. */
export const ABSTRACT_SUBSET_1 = [0, 3, 7, 10] as const;

/** The second four-site subset sample {0, 5, 7, a}. Changed site is 3 to 5. */
export const ABSTRACT_SUBSET_2 = [0, 5, 7, 10] as const;

/** Shared base set S = {0, 3, 7, a} for the common stress battery. */
export const ABSTRACT_BASE_SET = [0, 3, 7, 10] as const;

/** Common cell dimensions across all three common stress batteries (Transposition, Near Neighbours, Density). */
export const ABSTRACT_CELL_WIDTH = 54;
export const ABSTRACT_CELL_HEIGHT = 54;
export const ABSTRACT_BATTERY_VIEWPORT_WIDTH = 324;

/** Format an integer in single-character or dozenal duodecimal notation (0..9, a, b, 10, 11, etc.). */
export function formatDuodecimalDigit(n: number): string {
  if (n < 0) return '-' + formatDuodecimalDigit(-n);
  if (n < 10) return String(n);
  if (n === 10) return 'a';
  if (n === 11) return 'b';
  return n.toString(12);
}

/** Format a sorted pitch-class set in duodecimal notation, e.g. {0,3,7,a}. */
export function formatPitchClassSet(pitches: readonly number[]): string {
  const sorted = [...new Set(pitches)].sort((a, b) => a - b);
  return '{' + sorted.map(formatDuodecimalDigit).join(',') + '}';
}

/** Compute transposed pitch classes modulo 12: T+t(S), sorted. */
export function computeTranspositionSet(base: readonly number[], t: number): number[] {
  return [...new Set(base.map((p) => (((p + t) % 12) + 12) % 12))].sort((a, b) => a - b);
}

/** The four near-neighbour test samples on base S = {0, 3, 7, a}. */
export const ABSTRACT_NEAR_NEIGHBOUR_SAMPLES = [
  {
    id: 'near-base',
    title: 'Base S',
    caption: '{0,3,7,a} · base set',
    changeDescription: 'base set S',
    subset: [0, 3, 7, 10] as const,
  },
  {
    id: 'near-3to4',
    title: '3→4 (1 semitone)',
    caption: '{0,4,7,a} · 3→4 (1-semitone change)',
    changeDescription: '3→4 (1-semitone change)',
    subset: [0, 4, 7, 10] as const,
  },
  {
    id: 'near-3to5',
    title: '3→5 (2 semitones)',
    caption: '{0,5,7,a} · 3→5 (2-semitone change)',
    changeDescription: '3→5 (2-semitone change)',
    subset: [0, 5, 7, 10] as const,
  },
  {
    id: 'near-atob',
    title: 'a→b (1 semitone)',
    caption: '{0,3,7,b} · a→b (1-semitone change)',
    changeDescription: 'a→b (1-semitone change)',
    subset: [0, 3, 7, 11] as const,
  },
] as const;

/** The five density test samples (2, 3, 6, 9, 11 selected sites). */
export const ABSTRACT_DENSITY_SAMPLES = [
  {
    id: 'density-2',
    title: '2 sites',
    caption: '2 selected sites · {0,7}',
    siteCount: 2,
    subset: [0, 7] as const,
  },
  {
    id: 'density-3',
    title: '3 sites',
    caption: '3 selected sites · {0,4,7}',
    siteCount: 3,
    subset: [0, 4, 7] as const,
  },
  {
    id: 'density-6',
    title: '6 sites',
    caption: '6 selected sites · {0,1,2,3,4,5}',
    siteCount: 6,
    subset: [0, 1, 2, 3, 4, 5] as const,
  },
  {
    id: 'density-9',
    title: '9 sites',
    caption: '9 selected sites · {0,1,2,3,4,5,6,7,8}',
    siteCount: 9,
    subset: [0, 1, 2, 3, 4, 5, 6, 7, 8] as const,
  },
  {
    id: 'density-11',
    title: '11 sites',
    caption: '11 selected sites · {0,1,2,3,4,5,6,7,8,9,a}',
    siteCount: 11,
    subset: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const,
  },
] as const;

/** The three ladder octave-boundary probe specimens. */
export const ABSTRACT_LADDER_OCTAVE_PROBE_SAMPLES = [
  {
    id: 'probe-unfolded-s',
    title: 'Original unfolded S',
    caption: 'Unfolded S = {0,3,7,a} · 4.5641 × 21.1000pt',
    description: 'Original unfolded S = {0,3,7,a}',
    pitches: [0, 3, 7, 10] as const,
    subset: [0, 3, 7, 10] as const,
    dimensionsString: '4.5641 × 21.1000pt',
  },
  {
    id: 'probe-unfolded-s-plus-3',
    title: 'Unfolded S+3',
    caption: 'Unfolded S+3 = {3,6,a,11} (decimal 3,6,10,13) · 4.5641 × 21.1000pt',
    description: 'Unfolded S+3 = {3,6,a,11} in duodecimal (decimal 3,6,10,13)',
    pitches: [3, 6, 10, 13] as const,
    subset: [3, 6, 10, 13] as const,
    dimensionsString: '4.5641 × 21.1000pt',
  },
  {
    id: 'probe-folded-s-plus-3',
    title: 'Folded S+3 (modulo 12)',
    caption: 'Folded version = {1,3,6,a} · 4.5641 × 19.1000pt',
    description: 'Folded version (same pitch classes as common T+3) = {1,3,6,a}',
    pitches: [1, 3, 6, 10] as const,
    subset: [1, 3, 6, 10] as const,
    dimensionsString: '4.5641 × 19.1000pt',
  },
] as const;

/**
 * 1. Dial coordinates:
 * theta = i * π / 6; R = 2 / sin(π/12); (x, y) = (R * sin(theta), -R * cos(theta)).
 * Site 0 at top (0, -R), clockwise order.
 * Full ink bounds: 16.5548 by 16.5548pt.
 */
export function getDialSiteCoordinates(): Point2D[] {
  const R = 2 / Math.sin(Math.PI / 12);
  return Array.from({ length: 12 }, (_, i) => {
    const theta = (i * Math.PI) / 6;
    return {
      x: R * Math.sin(theta),
      y: -R * Math.cos(theta),
    };
  });
}

/**
 * 2. Rosette coordinates:
 * Same angular rule (theta = i * π / 6); radius 4√3 for even i, 4 for odd i.
 * (x, y) = (r * sin(theta), -r * cos(theta)).
 * Full ink bounds: 13.1000 by 14.9564pt. Draw sites only, NOT hexagons or a star.
 */
export function getRosetteSiteCoordinates(): Point2D[] {
  return Array.from({ length: 12 }, (_, i) => {
    const theta = (i * Math.PI) / 6;
    const r = i % 2 === 0 ? 4 * Math.sqrt(3) : 4;
    return {
      x: r * Math.sin(theta),
      y: -r * Math.cos(theta),
    };
  });
}

/**
 * 3. Staggered pitch ladder coordinates:
 * Two staggered columns with upward pitch:
 * For integer pitch index p, x(p) = -√3pt if p even, +√3pt if p odd; y(p) = 11 - 2p pt (SVG downward y).
 * Full ink bounds for p=0..11: (2√3 + 1.1) × 23.1pt ≈ 4.5641 × 23.1000pt.
 * Minimum center separation: 4.0pt. Sites only, no rails or connector lines drawn.
 */
export function getLadderSiteCoordinates(pitchCount = 12): Point2D[] {
  return Array.from({ length: pitchCount }, (_, p) => ({
    x: p % 2 === 0 ? -Math.sqrt(3) : Math.sqrt(3),
    y: 11 - 2 * p,
  }));
}

/**
 * 4. Asymmetric constellation coordinates in pt:
 * 0=(-8,-8), 1=(0,-8), 2=(4,-8), 3=(8,-8),
 * 4=(-8,0),  5=(0,0),  6=(-8,4), 7=(4,4),
 * 8=(8,4),   9=(-8,8), a=(4,8),  b=(8,8).
 * Full ink bounds: 17.1000 by 17.1000pt. No grid drawn.
 */
export function getAsymmetricSiteCoordinates(): Point2D[] {
  return [
    { x: -8, y: -8 }, // 0
    { x: 0, y: -8 },  // 1
    { x: 4, y: -8 },  // 2
    { x: 8, y: -8 },  // 3
    { x: -8, y: 0 },  // 4
    { x: 0, y: 0 },   // 5
    { x: -8, y: 4 },  // 6
    { x: 4, y: 4 },   // 7
    { x: 8, y: 4 },   // 8
    { x: -8, y: 8 },  // 9
    { x: 4, y: 8 },   // a (10)
    { x: 8, y: 8 },   // b (11)
  ];
}

/** Look up site coordinates for a given abstract geometry arrangement. */
export function getAbstractSiteCoordinates(id: AbstractGeometryId): Point2D[] {
  switch (id) {
    case 'dial':
      return getDialSiteCoordinates();
    case 'rosette':
      return getRosetteSiteCoordinates();
    case 'ladder':
      return getLadderSiteCoordinates(12);
    case 'asymmetric':
      return getAsymmetricSiteCoordinates();
  }
}

/** Compute center bounds and full ink bounds (accounting for node radius) of a coordinate set. */
export function computeInkBounds(coords: readonly Point2D[], nodeRadius = ABSTRACT_NODE_RADIUS): RectBounds {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of coords) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return {
    minX: minX - nodeRadius,
    maxX: maxX + nodeRadius,
    minY: minY - nodeRadius,
    maxY: maxY + nodeRadius,
    width: maxX - minX + 2 * nodeRadius,
    height: maxY - minY + 2 * nodeRadius,
  };
}

/** Minimum Euclidean center separation between any two distinct sites. */
export function computeMinimumSeparation(coords: readonly Point2D[]): number {
  let minSep = Infinity;
  for (let i = 0; i < coords.length; i++) {
    for (let j = i + 1; j < coords.length; j++) {
      const dist = Math.hypot(coords[i].x - coords[j].x, coords[i].y - coords[j].y);
      if (dist < minSep) minSep = dist;
    }
  }
  return minSep;
}

export interface AbstractGeometrySpec {
  readonly id: AbstractGeometryId;
  readonly name: string;
  readonly nominalWidth: number;
  readonly nominalHeight: number;
  readonly boundsString: string;
  readonly description: string;
}

export const ABSTRACT_GEOMETRY_SPECS: Record<AbstractGeometryId, AbstractGeometrySpec> = {
  dial: {
    id: 'dial',
    name: 'Dial',
    nominalWidth: 16.5548,
    nominalHeight: 16.5548,
    boundsString: '16.5548 × 16.5548pt',
    description: 'Circular 12-gon dial, site 0 at top, clockwise order. R = 2 / sin(π/12) ≈ 7.7274pt. Modulo-12 transposition is rigid rotation.',
  },
  rosette: {
    id: 'rosette',
    name: 'Rosette',
    nominalWidth: 13.1,
    nominalHeight: 14.9564,
    boundsString: '13.1000 × 14.9564pt',
    description: 'Alternating rosette, radii 4√3 (even) and 4 (odd). Even transpositions rotate; odd transpositions exchange tiers.',
  },
  ladder: {
    id: 'ladder',
    name: 'Staggered pitch ladder',
    nominalWidth: 2 * Math.sqrt(3) + 1.1,
    nominalHeight: 23.1,
    boundsString: '4.5641 × 23.1000pt',
    description: 'Two staggered columns with upward pitch: x = ±√3pt (even/odd), y = 11 - 2p pt (p=0..11). Unfolded shifts translate/reflect; folded shifts wrap at octave.',
  },
  asymmetric: {
    id: 'asymmetric',
    name: 'Asymmetric constellation',
    nominalWidth: 17.1,
    nominalHeight: 17.1,
    boundsString: '17.1000 × 17.1000pt',
    description: 'Planar constellation on 4pt coordinate steps. Sites only, no grid drawn.',
  },
};

/**
 * Render the enlarged labelled twelve-site key (3×).
 * Key labels replace rather than compete with node dots (no circles).
 */
export function renderAbstractKeySvg(
  geometryId: AbstractGeometryId,
  viewport: ViewportBox = ABSTRACT_KEY_VIEWPORT
): string {
  const coords = getAbstractSiteCoordinates(geometryId);
  const scale = ABSTRACT_KEY_SCALE;
  const labels = coords
    .map((p, i) => {
      const x = p.x * scale;
      const y = p.y * scale;
      const label = ABSTRACT_SITE_LABELS[i];
      return `  <text x="${f(x)}" y="${f(y)}" text-anchor="middle" dominant-baseline="central" font-family=${ABSTRACT_KEY_FONT_FAMILY} font-size="${f(ABSTRACT_KEY_FONT_SIZE_PT)}pt" font-weight="bold" fill="#111111">${label}</text>`;
    })
    .join('\n');

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(viewport.x)} ${f(viewport.y)} ${f(viewport.width)} ${f(viewport.height)}" width="${f(viewport.width)}pt" height="${f(viewport.height)}pt">`,
    labels,
    '</svg>',
  ].join('\n');
}

/**
 * Render a four-site subset sample (1:1 scale).
 * Subset samples contain ONLY four identical filled circles:
 * no connectors, ghosts, enclosing shape, internal scale, anchor decoration or inactive sites.
 */
export function renderAbstractSubsetSvg(
  geometryId: AbstractGeometryId,
  subsetIndices: readonly number[],
  viewport: ViewportBox = ABSTRACT_SUBSET_VIEWPORT
): string {
  const coords = getAbstractSiteCoordinates(geometryId);
  const circles = subsetIndices
    .map((idx) => {
      const p = coords[idx];
      return `  <circle cx="${f(p.x)}" cy="${f(p.y)}" r="${f(ABSTRACT_NODE_RADIUS)}" fill="#111111" />`;
    })
    .join('\n');

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(viewport.x)} ${f(viewport.y)} ${f(viewport.width)} ${f(viewport.height)}" width="${f(viewport.width)}pt" height="${f(viewport.height)}pt">`,
    circles,
    '</svg>',
  ].join('\n');
}

/**
 * Render the 12-sample transposition battery SVG.
 * S = {0,3,7,a}, transposed modulo 12 for t=0..b.
 * Laid out in 2 rows of 6 columns (cell 54 × 54pt).
 * Total dimensions: 324 × 108pt.
 * Native scale (radius 0.55pt, 4pt min separation), common origin in each cell.
 */
export function renderAbstractTranspositionBatterySvg(geometryId: AbstractGeometryId): string {
  const coords = getAbstractSiteCoordinates(geometryId);
  const cellWidth = ABSTRACT_CELL_WIDTH;
  const cellHeight = ABSTRACT_CELL_HEIGHT;
  const totalWidth = ABSTRACT_BATTERY_VIEWPORT_WIDTH;
  const totalHeight = cellHeight * 2;

  const cells: string[] = [];
  for (let t = 0; t < 12; t++) {
    const col = t % 6;
    const row = Math.floor(t / 6);
    const cellX = col * cellWidth;
    const cellY = row * cellHeight;
    const originX = cellX + cellWidth / 2;
    const originY = cellY + 15;
    const subset = computeTranspositionSet(ABSTRACT_BASE_SET, t);
    const duodT = formatDuodecimalDigit(t);
    const setStr = formatPitchClassSet(subset);

    const dots = subset
      .map((idx) => {
        const p = coords[idx];
        return `    <circle cx="${f(originX + p.x)}" cy="${f(originY + p.y)}" r="${f(ABSTRACT_NODE_RADIUS)}" fill="#111111" />`;
      })
      .join('\n');

    const labelT = `    <text x="${f(originX)}" y="${f(cellY + 35)}" text-anchor="middle" font-family=${ABSTRACT_KEY_FONT_FAMILY} font-size="5.5pt" font-weight="bold" fill="#111111">t=${duodT}</text>`;
    const labelSet = `    <text x="${f(originX)}" y="${f(cellY + 44)}" text-anchor="middle" font-family=${ABSTRACT_KEY_FONT_FAMILY} font-size="5.0pt" fill="#475569">${setStr}</text>`;

    cells.push(
      [
        `  <g class="abstract-specimen" data-specimen="t-${duodT}">`,
        dots,
        labelT,
        labelSet,
        `  </g>`,
      ].join('\n')
    );
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f(totalWidth)} ${f(totalHeight)}" width="${f(totalWidth)}pt" height="${f(totalHeight)}pt">`,
    cells.join('\n'),
    '</svg>',
  ].join('\n');
}

/**
 * Render the 4-sample near-neighbours battery SVG.
 * Samples: S, {0,4,7,a} (3→4), {0,5,7,a} (3→5), {0,3,7,b} (a→b).
 * Explicit captions distinguish 1-semitone from 2-semitone changes.
 * Total dimensions: 324 × 54pt (4 cells centered, pitch 54pt).
 */
export function renderAbstractNearNeighboursBatterySvg(geometryId: AbstractGeometryId): string {
  const coords = getAbstractSiteCoordinates(geometryId);
  const cellWidth = ABSTRACT_CELL_WIDTH;
  const totalWidth = ABSTRACT_BATTERY_VIEWPORT_WIDTH;
  const totalHeight = ABSTRACT_CELL_HEIGHT;
  const startX = (totalWidth - 4 * cellWidth) / 2;

  const cells: string[] = [];
  for (let i = 0; i < ABSTRACT_NEAR_NEIGHBOUR_SAMPLES.length; i++) {
    const sample = ABSTRACT_NEAR_NEIGHBOUR_SAMPLES[i];
    const cellX = startX + i * cellWidth;
    const originX = cellX + cellWidth / 2;
    const originY = 15;
    const setStr = formatPitchClassSet(sample.subset);

    const dots = sample.subset
      .map((idx) => {
        const p = coords[idx];
        return `    <circle cx="${f(originX + p.x)}" cy="${f(originY + p.y)}" r="${f(ABSTRACT_NODE_RADIUS)}" fill="#111111" />`;
      })
      .join('\n');

    const labelTitle = `    <text x="${f(originX)}" y="35" text-anchor="middle" font-family=${ABSTRACT_KEY_FONT_FAMILY} font-size="5.0pt" font-weight="bold" fill="#111111">${sample.title}</text>`;
    const labelSet = `    <text x="${f(originX)}" y="44" text-anchor="middle" font-family=${ABSTRACT_KEY_FONT_FAMILY} font-size="5.0pt" fill="#475569">${setStr}</text>`;

    cells.push(
      [
        `  <g class="abstract-specimen" data-specimen="${sample.id}">`,
        dots,
        labelTitle,
        labelSet,
        `  </g>`,
      ].join('\n')
    );
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f(totalWidth)} ${f(totalHeight)}" width="${f(totalWidth)}pt" height="${f(totalHeight)}pt">`,
    cells.join('\n'),
    '</svg>',
  ].join('\n');
}

/**
 * Render the 5-sample density battery SVG.
 * Samples: {0,7}, {0,4,7}, {0,1,2,3,4,5}, {0,1,2,3,4,5,6,7,8}, {0,1,2,3,4,5,6,7,8,9,a}.
 * Total dimensions: 324 × 54pt (5 cells centered, pitch 54pt).
 */
export function renderAbstractDensityBatterySvg(geometryId: AbstractGeometryId): string {
  const coords = getAbstractSiteCoordinates(geometryId);
  const cellWidth = ABSTRACT_CELL_WIDTH;
  const totalWidth = ABSTRACT_BATTERY_VIEWPORT_WIDTH;
  const totalHeight = ABSTRACT_CELL_HEIGHT;
  const startX = (totalWidth - 5 * cellWidth) / 2;

  const cells: string[] = [];
  for (let i = 0; i < ABSTRACT_DENSITY_SAMPLES.length; i++) {
    const sample = ABSTRACT_DENSITY_SAMPLES[i];
    const cellX = startX + i * cellWidth;
    const originX = cellX + cellWidth / 2;
    const originY = 15;

    const dots = sample.subset
      .map((idx) => {
        const p = coords[idx];
        return `    <circle cx="${f(originX + p.x)}" cy="${f(originY + p.y)}" r="${f(ABSTRACT_NODE_RADIUS)}" fill="#111111" />`;
      })
      .join('\n');

    let textLabels: string;
    if (sample.siteCount <= 6) {
      const setStr = formatPitchClassSet(sample.subset);
      textLabels = [
        `    <text x="${f(originX)}" y="35" text-anchor="middle" font-family=${ABSTRACT_KEY_FONT_FAMILY} font-size="5.0pt" font-weight="bold" fill="#111111">${sample.siteCount} sites</text>`,
        `    <text x="${f(originX)}" y="44" text-anchor="middle" font-family=${ABSTRACT_KEY_FONT_FAMILY} font-size="5.0pt" fill="#475569">${setStr}</text>`,
      ].join('\n');
    } else if (sample.siteCount === 9) {
      textLabels = [
        `    <text x="${f(originX)}" y="33" text-anchor="middle" font-family=${ABSTRACT_KEY_FONT_FAMILY} font-size="5.0pt" font-weight="bold" fill="#111111">9 sites</text>`,
        `    <text x="${f(originX)}" y="40.5" text-anchor="middle" font-family=${ABSTRACT_KEY_FONT_FAMILY} font-size="4.8pt" fill="#475569">{0,1,2,3,4,</text>`,
        `    <text x="${f(originX)}" y="48" text-anchor="middle" font-family=${ABSTRACT_KEY_FONT_FAMILY} font-size="4.8pt" fill="#475569">5,6,7,8}</text>`,
      ].join('\n');
    } else {
      textLabels = [
        `    <text x="${f(originX)}" y="33" text-anchor="middle" font-family=${ABSTRACT_KEY_FONT_FAMILY} font-size="5.0pt" font-weight="bold" fill="#111111">11 sites</text>`,
        `    <text x="${f(originX)}" y="40.5" text-anchor="middle" font-family=${ABSTRACT_KEY_FONT_FAMILY} font-size="4.8pt" fill="#475569">{0,1,2,3,4,5,</text>`,
        `    <text x="${f(originX)}" y="48" text-anchor="middle" font-family=${ABSTRACT_KEY_FONT_FAMILY} font-size="4.8pt" fill="#475569">6,7,8,9,a}</text>`,
      ].join('\n');
    }

    cells.push(
      [
        `  <g class="abstract-specimen" data-specimen="${sample.id}">`,
        dots,
        textLabels,
        `  </g>`,
      ].join('\n')
    );
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f(totalWidth)} ${f(totalHeight)}" width="${f(totalWidth)}pt" height="${f(totalHeight)}pt">`,
    cells.join('\n'),
    '</svg>',
  ].join('\n');
}

/**
 * Render the Ladder Octave-Boundary Probe SVG.
 * Compares:
 * 1. Original unfolded S = {0,3,7,a}
 * 2. Unfolded S+3 = {3,6,a,11} (decimal 3,6,10,13)
 * 3. Folded version (T+3) = {1,3,6,a}
 * Absolute coordinates, common scale, shared viewport accommodating p=13.
 * Total dimensions: 324 × 82pt.
 */
export function renderAbstractLadderOctaveProbeSvg(): string {
  const totalWidth = ABSTRACT_BATTERY_VIEWPORT_WIDTH;
  const totalHeight = 82;
  const cellWidth = 72;
  const startX = (totalWidth - 3 * cellWidth) / 2;
  const originY = 20;

  const cells: string[] = [];
  for (let i = 0; i < ABSTRACT_LADDER_OCTAVE_PROBE_SAMPLES.length; i++) {
    const sample = ABSTRACT_LADDER_OCTAVE_PROBE_SAMPLES[i];
    const cellX = startX + i * cellWidth;
    const originX = cellX + cellWidth / 2;

    const dots = sample.pitches
      .map((p) => {
        const x = originX + (p % 2 === 0 ? -Math.sqrt(3) : Math.sqrt(3));
        const y = originY + (11 - 2 * p);
        return `    <circle cx="${f(x)}" cy="${f(y)}" r="${f(ABSTRACT_NODE_RADIUS)}" fill="#111111" />`;
      })
      .join('\n');

    const setStr = formatPitchClassSet(sample.subset);
    const labelTitle = `    <text x="${f(originX)}" y="40" text-anchor="middle" font-family=${ABSTRACT_KEY_FONT_FAMILY} font-size="5.2pt" font-weight="bold" fill="#111111">${sample.title}</text>`;
    const labelSet = `    <text x="${f(originX)}" y="48" text-anchor="middle" font-family=${ABSTRACT_KEY_FONT_FAMILY} font-size="4.8pt" fill="#475569">${setStr}</text>`;
    const labelDims = `    <text x="${f(originX)}" y="56" text-anchor="middle" font-family=${ABSTRACT_KEY_FONT_FAMILY} font-size="4.8pt" fill="#64748b">${sample.dimensionsString}</text>`;

    cells.push(
      [
        `  <g class="abstract-specimen" data-specimen="${sample.id}">`,
        dots,
        labelTitle,
        labelSet,
        labelDims,
        `  </g>`,
      ].join('\n')
    );
  }

  const footer = `  <text x="${f(totalWidth / 2)}" y="74" text-anchor="middle" font-family=${ABSTRACT_KEY_FONT_FAMILY} font-size="5.0pt" fill="#64748b">Unfolded: translation + reflection; folded into twelve sites: shape breaks. Continuing pitch vertically costs height.</text>`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f(totalWidth)} ${f(totalHeight)}" width="${f(totalWidth)}pt" height="${f(totalHeight)}pt">`,
    cells.join('\n'),
    footer,
    '</svg>',
  ].join('\n');
}

/**
 * Bounded geometry check report for an abstract candidate.
 * Abstract cards verify real geometry constraints rather than fabricating a score LintReport.
 */
export interface AbstractGeometryLintCheck {
  readonly code: string;
  readonly message: string;
  readonly passed: boolean;
}

export interface AbstractGeometryLintReport {
  readonly ok: boolean;
  readonly checks: number;
  readonly violations: string[];
  readonly details: readonly AbstractGeometryLintCheck[];
}

/** Run bounded geometry audit on an abstract candidate arrangement. */
export function lintAbstractGeometry(geometryId: AbstractGeometryId): AbstractGeometryLintReport {
  const coords = getAbstractSiteCoordinates(geometryId);
  const spec = ABSTRACT_GEOMETRY_SPECS[geometryId];
  const checks: AbstractGeometryLintCheck[] = [];

  // Check 1: Exactly 12 sites
  const countPassed = coords.length === 12;
  checks.push({
    code: 'SITE_COUNT',
    message: `Declared exactly 12 sites (found ${coords.length})`,
    passed: countPassed,
  });

  // Check 2: Minimum separation >= 4.0pt
  const minSep = computeMinimumSeparation(coords);
  const sepPassed = minSep >= ABSTRACT_MIN_SEPARATION - 1e-4;
  checks.push({
    code: 'MIN_SEPARATION',
    message: `Minimum center separation ${minSep.toFixed(4)}pt >= 4.0pt`,
    passed: sepPassed,
  });

  // Check 3: Full ink bounds match nominal spec within numerical tolerance (1e-3 pt)
  const bounds = computeInkBounds(coords);
  const boundsPassed =
    Math.abs(bounds.width - spec.nominalWidth) < 1e-3 &&
    Math.abs(bounds.height - spec.nominalHeight) < 1e-3;
  checks.push({
    code: 'INK_BOUNDS',
    message: `Ink bounds ${bounds.width.toFixed(4)} × ${bounds.height.toFixed(4)}pt match nominal ${spec.nominalWidth.toFixed(4)} × ${spec.nominalHeight.toFixed(4)}pt`,
    passed: boundsPassed,
  });

  // Check 4: Key label clearance (enlarged 3×, min center separation >= 12.0pt)
  const keyMinSep = minSep * ABSTRACT_KEY_SCALE;
  const labelClearancePassed = keyMinSep >= 12.0 - 1e-4;
  checks.push({
    code: 'LABEL_CLEARANCE',
    message: `Key label center separation ${keyMinSep.toFixed(4)}pt >= 12.0pt ensures clear air`,
    passed: labelClearancePassed,
  });

  const violations = checks.filter((c) => !c.passed).map((c) => `${c.code}: ${c.message}`);
  return {
    ok: violations.length === 0,
    checks: checks.length,
    violations,
    details: checks,
  };
}
