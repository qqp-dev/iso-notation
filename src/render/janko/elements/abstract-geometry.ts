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

export type AbstractGeometryId = 'dial' | 'rosette' | 'asymmetric';

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
 * 3. Asymmetric constellation coordinates in pt:
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
    description: 'Circular 12-gon dial, site 0 at top, clockwise order. R = 2 / sin(π/12) ≈ 7.7274pt.',
  },
  rosette: {
    id: 'rosette',
    name: 'Rosette',
    nominalWidth: 13.1,
    nominalHeight: 14.9564,
    boundsString: '13.1000 × 14.9564pt',
    description: 'Alternating rosette, radii 4√3 (even) and 4 (odd). Sites only, no star or polygon drawn.',
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
