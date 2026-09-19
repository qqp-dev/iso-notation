/**
 * Round 38 — Twelve-site spatial alphabet: three abstract candidates.
 *
 * Acceptance test suite for .architect/ticket.md:
 * 1. Exactly three abstract cards (Dial, Rosette, Asymmetric constellation), each
 *    with twelve key identities (0–b) and the two correct four-site samples
 *    {0,3,7,a} and {0,5,7,a}. Short captions explicitly identify changed site 3 to 5.
 * 2. Coordinate/index rules, minimum separation (≥ 4pt), and full ink bounds
 *    verified with numerical tolerance (Dial 16.5548×16.5548pt, Rosette 13.1000×14.9564pt,
 *    Asymmetric 17.1000×17.1000pt).
 * 3. Actual SVG samples contain ONLY the declared four marks (no connectors, ghosts,
 *    enclosing shapes, internal scale, anchor decoration, or inactive sites).
 *    Key labels replace rather than compete with node dots (zero circles in Key).
 * 4. Label clearances (≥ 12pt center separation) and common viewport/scale verified;
 *    no per-subset fit or rotation.
 * 5. Actual studio dispatch renders abstract specimens without fake score lookup
 *    or fabricated lint success. Real bounded geometry checks shown, score lint
 *    explicitly labeled n/a.
 * 6. Canonical/reference output and layout-reuse regressions remain unchanged.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  abstractKeyWindow,
  abstractSubsetWindow,
  candidateBadges,
  resolveCandidate,
  isAbstractCandidateWindow,
  type JankoCandidate,
  type JankoCandidateRound,
  type JankoAbstractCandidateWindow,
} from '../src/render/janko/candidates';
import {
  createStudioConfig,
  renderCandidatesView,
  renderReferenceView,
} from '../src/render/janko/studio';
import {
  ABSTRACT_NODE_RADIUS,
  ABSTRACT_MIN_SEPARATION,
  ABSTRACT_KEY_SCALE,
  ABSTRACT_SITE_LABELS,
  ABSTRACT_SUBSET_1,
  ABSTRACT_SUBSET_2,
  ABSTRACT_SUBSET_VIEWPORT,
  ABSTRACT_KEY_VIEWPORT,
  ABSTRACT_GEOMETRY_SPECS,
  getDialSiteCoordinates,
  getRosetteSiteCoordinates,
  getAsymmetricSiteCoordinates,
  getAbstractSiteCoordinates,
  computeInkBounds,
  computeMinimumSeparation,
  renderAbstractKeySvg,
  renderAbstractSubsetSvg,
  lintAbstractGeometry,
  type AbstractGeometryId,
  type Point2D,
} from '../src/render/janko/elements/abstract-geometry';
import {
  layoutJankoScore,
  setLayoutJankoScoreObserver,
} from '../src/render/janko/engine';
import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1';
import { buildBrahmsOp118No1Score } from '../src/scores/brahms-op118-no1';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..');

/** Historical Round 38 metadata (parked). */
export const ROUND_38_METADATA: JankoCandidateRound = {
  round: 38,
  title: 'Twelve-site spatial alphabet — three abstract candidates',
  description:
    'Which compact twelve-site arrangement makes selected subsets distinguishable and learnable with the least visual noise? No optimality or human-readability claim. Site labels are identities for this geometry study, not an adopted pitch/interval convention. Evaluates Dial, Rosette, and Asymmetric constellation across identical keys and {0,3,7,a} vs {0,5,7,a} subsets.',
  openAxes: ['arrangement'],
};

/** Historical Round 38 candidates (parked). */
export const ROUND_38_CANDIDATES: JankoCandidate[] = [
  {
    id: 'dial',
    label: 'Dial',
    description:
      'Regular 12-gon circular dial. R = 2 / sin(π/12) ≈ 7.7274pt, site 0 at top, clockwise order. Nominal full ink bounds 16.5548 × 16.5548pt, min separation 4.0pt.',
    kind: 'abstract',
    abstractGeometry: 'dial',
    axis: 'arrangement',
    windows: [
      abstractKeyWindow(
        'dial',
        'Twelve-site key (3×)',
        'Full configuration (0–b) · 16.5548 × 16.5548pt nominal ink bounds (enlarged 3×)'
      ),
      abstractSubsetWindow(
        'dial',
        'subset-1',
        'Subset {0,3,7,a}',
        'Four sites · changed site 3 · 16.5548 × 16.5548pt nominal footprint'
      ),
      abstractSubsetWindow(
        'dial',
        'subset-2',
        'Subset {0,5,7,a}',
        'Four sites · changed site 3 to 5 · 16.5548 × 16.5548pt nominal footprint'
      ),
    ],
    tags: ['abstract', 'dial'],
  },
  {
    id: 'rosette',
    label: 'Rosette',
    description:
      'Alternating rosette. Radii 4√3 ≈ 6.9282pt for even i, 4.0pt for odd i. Angular step π/6, site 0 at top. Nominal full ink bounds 13.1000 × 14.9564pt, min separation 4.0pt. Sites only, no star or polygon drawn.',
    kind: 'abstract',
    abstractGeometry: 'rosette',
    axis: 'arrangement',
    windows: [
      abstractKeyWindow(
        'rosette',
        'Twelve-site key (3×)',
        'Full configuration (0–b) · 13.1000 × 14.9564pt nominal ink bounds (enlarged 3×)'
      ),
      abstractSubsetWindow(
        'rosette',
        'subset-1',
        'Subset {0,3,7,a}',
        'Four sites · changed site 3 · 13.1000 × 14.9564pt nominal footprint'
      ),
      abstractSubsetWindow(
        'rosette',
        'subset-2',
        'Subset {0,5,7,a}',
        'Four sites · changed site 3 to 5 · 13.1000 × 14.9564pt nominal footprint'
      ),
    ],
    tags: ['abstract', 'rosette'],
  },
  {
    id: 'asymmetric',
    label: 'Asymmetric constellation',
    description:
      'Planar constellation on 4pt coordinate steps. Nominal full ink bounds 17.1000 × 17.1000pt, min separation 4.0pt. No grid drawn.',
    kind: 'abstract',
    abstractGeometry: 'asymmetric',
    axis: 'arrangement',
    windows: [
      abstractKeyWindow(
        'asymmetric',
        'Twelve-site key (3×)',
        'Full configuration (0–b) · 17.1000 × 17.1000pt nominal ink bounds (enlarged 3×)'
      ),
      abstractSubsetWindow(
        'asymmetric',
        'subset-1',
        'Subset {0,3,7,a}',
        'Four sites · changed site 3 · 17.1000 × 17.1000pt nominal footprint'
      ),
      abstractSubsetWindow(
        'asymmetric',
        'subset-2',
        'Subset {0,5,7,a}',
        'Four sites · changed site 3 to 5 · 17.1000 × 17.1000pt nominal footprint'
      ),
    ],
    tags: ['abstract', 'asymmetric'],
  },
];

// ---------------------------------------------------------------------------
// 1. Candidate Registry: Exactly Three Abstract Cards
// ---------------------------------------------------------------------------

test('Criterion 1: Exactly three abstract cards in candidate registry', () => {
  assert.equal(ROUND_38_METADATA.round, 38);
  assert.match(ROUND_38_METADATA.title, /Twelve-site spatial alphabet/i);
  assert.deepEqual(ROUND_38_METADATA.openAxes, ['arrangement']);
  assert.equal(ROUND_38_CANDIDATES.length, 3, 'exactly three cards');

  const ids = ROUND_38_CANDIDATES.map((c) => c.id);
  assert.deepEqual(ids, ['dial', 'rosette', 'asymmetric']);

  const labels = ROUND_38_CANDIDATES.map((c) => c.label);
  assert.deepEqual(labels, ['Dial', 'Rosette', 'Asymmetric constellation']);

  for (const c of ROUND_38_CANDIDATES) {
    assert.equal(c.kind, 'abstract');
    assert.equal(c.axis, 'arrangement');
    assert.ok(c.abstractGeometry, `${c.id} has abstractGeometry`);
  }
});

test('Criterion 1: Each card has one enlarged key (3×) and the same two four-site subsets', () => {
  for (const c of ROUND_38_CANDIDATES) {
    const resolved = resolveCandidate(c);
    assert.equal(resolved.windows.length, 3, `${c.id} has exactly three windows`);

    const [keyWin, sub1Win, sub2Win] = resolved.windows as JankoAbstractCandidateWindow[];

    // Key window
    assert.equal(keyWin.kind, 'abstract');
    assert.equal(keyWin.specimenType, 'key');
    assert.match(keyWin.title, /Twelve-site key \(3×\)/i);
    assert.match(keyWin.caption ?? '', /enlarged 3×/i);
    assert.match(keyWin.caption ?? '', /nominal.*bounds/i);

    // Subset 1 window: {0,3,7,a}
    assert.equal(sub1Win.kind, 'abstract');
    assert.equal(sub1Win.specimenType, 'subset-1');
    assert.match(sub1Win.title, /\{0,3,7,a\}/);
    assert.deepEqual(sub1Win.subset, [0, 3, 7, 10]);

    // Subset 2 window: {0,5,7,a}
    assert.equal(sub2Win.kind, 'abstract');
    assert.equal(sub2Win.specimenType, 'subset-2');
    assert.match(sub2Win.title, /\{0,5,7,a\}/);
    assert.deepEqual(sub2Win.subset, [0, 5, 7, 10]);

    // Short caption explicitly identifies changed site 3 to 5
    assert.match(
      sub2Win.caption ?? '',
      /changed site 3 to 5/i,
      `${c.id} subset-2 caption identifies changed site 3 to 5`
    );

    // Captions give nominal ink dimensions
    const spec = ABSTRACT_GEOMETRY_SPECS[c.abstractGeometry as AbstractGeometryId];
    assert.ok(
      (keyWin.caption ?? '').includes(spec.boundsString),
      `${c.id} key caption includes nominal bounds ${spec.boundsString}`
    );
    assert.ok(
      (sub1Win.caption ?? '').includes(spec.boundsString),
      `${c.id} subset-1 caption includes nominal bounds ${spec.boundsString}`
    );
    assert.ok(
      (sub2Win.caption ?? '').includes(spec.boundsString),
      `${c.id} subset-2 caption includes nominal bounds ${spec.boundsString}`
    );
  }
});

// ---------------------------------------------------------------------------
// 2. Exact Geometry: Coordinates, Minimum Separation, and Ink Bounds
// ---------------------------------------------------------------------------

test('Criterion 2: Dial exact geometry, minimum separation, and ink bounds', () => {
  const coords = getDialSiteCoordinates();
  assert.equal(coords.length, 12, 'Dial has exactly 12 sites');

  const R = 2 / Math.sin(Math.PI / 12);
  assert.ok(Math.abs(R - 7.7274066) < 1e-4, 'Dial R = 2 / sin(pi/12) ≈ 7.7274pt');

  // Site 0 at top (x=0, y=-R)
  assert.ok(Math.abs(coords[0].x - 0) < 1e-9, 'site 0 x is 0');
  assert.ok(Math.abs(coords[0].y - (-R)) < 1e-9, 'site 0 y is -R (top in SVG)');

  // Clockwise order
  assert.ok(coords[1].x > 0 && coords[1].y > -R, 'site 1 is clockwise (right, down)');
  assert.ok(Math.abs(coords[3].x - R) < 1e-9 && Math.abs(coords[3].y - 0) < 1e-9, 'site 3 is right');
  assert.ok(Math.abs(coords[6].x - 0) < 1e-9 && Math.abs(coords[6].y - R) < 1e-9, 'site 6 is bottom');
  assert.ok(Math.abs(coords[9].x - (-R)) < 1e-9 && Math.abs(coords[9].y - 0) < 1e-9, 'site 9 is left');

  // Adjacent separation is exactly 4.0pt
  for (let i = 0; i < 12; i++) {
    const next = (i + 1) % 12;
    const d = Math.hypot(coords[i].x - coords[next].x, coords[i].y - coords[next].y);
    assert.ok(Math.abs(d - 4.0) < 1e-4, `Dial chord length between site ${i} and ${next} is 4.0pt`);
  }

  // Minimum separation overall >= 4.0pt
  const minSep = computeMinimumSeparation(coords);
  assert.ok(minSep >= 4.0 - 1e-6, 'Dial min separation >= 4.0pt');

  // Full ink bounds: 16.5548 by 16.5548pt (2*R + 2*0.55)
  const bounds = computeInkBounds(coords, ABSTRACT_NODE_RADIUS);
  assert.ok(
    Math.abs(bounds.width - 16.5548) < 1e-4,
    `Dial ink width ${bounds.width.toFixed(4)} matches 16.5548pt`
  );
  assert.ok(
    Math.abs(bounds.height - 16.5548) < 1e-4,
    `Dial ink height ${bounds.height.toFixed(4)} matches 16.5548pt`
  );
});

test('Criterion 2: Rosette exact geometry, minimum separation, and ink bounds', () => {
  const coords = getRosetteSiteCoordinates();
  assert.equal(coords.length, 12, 'Rosette has exactly 12 sites');

  // Even i: radius 4*sqrt(3) ≈ 6.9282; Odd i: radius 4
  for (let i = 0; i < 12; i++) {
    const r = Math.hypot(coords[i].x, coords[i].y);
    const expectedR = i % 2 === 0 ? 4 * Math.sqrt(3) : 4.0;
    assert.ok(
      Math.abs(r - expectedR) < 1e-6,
      `Rosette site ${i} radius ${r.toFixed(4)} matches ${expectedR.toFixed(4)}`
    );
  }

  // Adjacent separation is exactly 4.0pt
  for (let i = 0; i < 12; i++) {
    const next = (i + 1) % 12;
    const d = Math.hypot(coords[i].x - coords[next].x, coords[i].y - coords[next].y);
    assert.ok(Math.abs(d - 4.0) < 1e-4, `Rosette chord length between site ${i} and ${next} is 4.0pt`);
  }

  const minSep = computeMinimumSeparation(coords);
  assert.ok(minSep >= 4.0 - 1e-6, 'Rosette min separation >= 4.0pt');

  // Full ink bounds: 13.1000 by 14.9564pt (12 + 1.10 by 8√3 + 1.10)
  const bounds = computeInkBounds(coords, ABSTRACT_NODE_RADIUS);
  assert.ok(
    Math.abs(bounds.width - 13.1) < 1e-4,
    `Rosette ink width ${bounds.width.toFixed(4)} matches 13.1000pt`
  );
  assert.ok(
    Math.abs(bounds.height - 14.9564) < 1e-4,
    `Rosette ink height ${bounds.height.toFixed(4)} matches 14.9564pt`
  );
});

test('Criterion 2: Asymmetric constellation exact coordinates, minimum separation, and ink bounds', () => {
  const coords = getAsymmetricSiteCoordinates();
  assert.equal(coords.length, 12, 'Asymmetric constellation has exactly 12 sites');

  const expected: Point2D[] = [
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
    { x: 4, y: 8 },   // a
    { x: 8, y: 8 },   // b
  ];

  for (let i = 0; i < 12; i++) {
    assert.equal(coords[i].x, expected[i].x, `site ${i} x coordinate`);
    assert.equal(coords[i].y, expected[i].y, `site ${i} y coordinate`);
  }

  // Minimum separation between any distinct pair >= 4.0pt
  const minSep = computeMinimumSeparation(coords);
  assert.ok(minSep >= 4.0 - 1e-6, 'Asymmetric constellation min separation >= 4.0pt');

  // Full ink bounds: 17.1000 by 17.1000pt (16 + 1.10 by 16 + 1.10)
  const bounds = computeInkBounds(coords, ABSTRACT_NODE_RADIUS);
  assert.ok(
    Math.abs(bounds.width - 17.1) < 1e-4,
    `Asymmetric ink width ${bounds.width.toFixed(4)} matches 17.1000pt`
  );
  assert.ok(
    Math.abs(bounds.height - 17.1) < 1e-4,
    `Asymmetric ink height ${bounds.height.toFixed(4)} matches 17.1000pt`
  );
});

// ---------------------------------------------------------------------------
// 3. Mark Purity: SVG Samples Contain ONLY the Declared Marks
// ---------------------------------------------------------------------------

test('Criterion 3: Subset samples contain ONLY four identical filled circles', () => {
  const geometries: AbstractGeometryId[] = ['dial', 'rosette', 'asymmetric'];
  const subsets = [ABSTRACT_SUBSET_1, ABSTRACT_SUBSET_2];

  for (const geom of geometries) {
    for (const subset of subsets) {
      const svg = renderAbstractSubsetSvg(geom, subset);

      // Exactly four circle elements
      const circleMatches = svg.match(/<circle\b[^>]*>/g) || [];
      assert.equal(
        circleMatches.length,
        4,
        `${geom} subset has exactly 4 circle elements`
      );

      // All four circles have radius 0.55 and filled #111111
      for (const circle of circleMatches) {
        assert.match(circle, /r="0\.55"/, 'circle has radius 0.55pt');
        assert.match(circle, /fill="#111111"/, 'circle has fill #111111');
      }

      // No connectors, ghosts, enclosing shape, internal scale, anchor decoration or text
      assert.ok(!svg.includes('<text'), `${geom} subset contains no text`);
      assert.ok(!svg.includes('<path'), `${geom} subset contains no paths / connectors`);
      assert.ok(!svg.includes('<line'), `${geom} subset contains no lines`);
      assert.ok(!svg.includes('<rect'), `${geom} subset contains no rects`);
      assert.ok(!svg.includes('<polygon'), `${geom} subset contains no polygons`);
      assert.ok(!svg.includes('<ellipse'), `${geom} subset contains no ellipses`);
      assert.ok(!svg.includes('<g'), `${geom} subset contains no grouping wrappers`);
    }
  }
});

test('Criterion 3: Key labels replace rather than compete with node dots (zero circles)', () => {
  const geometries: AbstractGeometryId[] = ['dial', 'rosette', 'asymmetric'];

  for (const geom of geometries) {
    const svg = renderAbstractKeySvg(geom);

    // Zero circle elements (labels replace node dots)
    const circleMatches = svg.match(/<circle\b[^>]*>/g) || [];
    assert.equal(circleMatches.length, 0, `${geom} key contains ZERO circle dots`);

    // Exactly 12 text elements
    const textMatches = svg.match(/<text\b[^>]*>(.*?)<\/text>/g) || [];
    assert.equal(textMatches.length, 12, `${geom} key contains exactly 12 text labels`);

    // The text labels correspond to 0..b
    const labelsExtracted = textMatches.map((t) => t.replace(/<text[^>]*>|<\/text>/g, '').trim());
    assert.deepEqual(
      labelsExtracted,
      [...ABSTRACT_SITE_LABELS],
      `${geom} key text labels match 0..b in order`
    );
  }
});

// ---------------------------------------------------------------------------
// 4. Viewport and Label Clearance Verification
// ---------------------------------------------------------------------------

test('Criterion 4: Label clearances in enlarged 3× key are strictly positive', () => {
  const geometries: AbstractGeometryId[] = ['dial', 'rosette', 'asymmetric'];

  for (const geom of geometries) {
    const coords = getAbstractSiteCoordinates(geom);
    // At 3× scale, center distance between any two labels is ≥ 3 * 4 = 12pt
    let minKeySep = Infinity;
    for (let i = 0; i < coords.length; i++) {
      for (let j = i + 1; j < coords.length; j++) {
        const d = Math.hypot(
          (coords[i].x - coords[j].x) * ABSTRACT_KEY_SCALE,
          (coords[i].y - coords[j].y) * ABSTRACT_KEY_SCALE
        );
        if (d < minKeySep) minKeySep = d;
      }
    }
    assert.ok(
      minKeySep >= 12.0 - 1e-6,
      `${geom} key label center separation ${minKeySep.toFixed(4)}pt >= 12.0pt`
    );

    // With font size 7pt, half-extents are at most 2.5pt horizontally and 3.0pt vertically.
    // Minimum clearance between label bounds is at least 12.0 - 6.0 = 6.0pt > 0
    assert.ok(minKeySep - 6.0 > 0, `${geom} key labels have ample clearance`);
  }
});

test('Criterion 4: Common equal specimen viewports across all cards and subsets', () => {
  const geometries: AbstractGeometryId[] = ['dial', 'rosette', 'asymmetric'];
  const subsetSvgs: string[] = [];

  for (const geom of geometries) {
    for (const subset of [ABSTRACT_SUBSET_1, ABSTRACT_SUBSET_2]) {
      const svg = renderAbstractSubsetSvg(geom, subset);
      subsetSvgs.push(svg);

      // Verify viewBox attribute is identical across all samples
      assert.match(
        svg,
        /viewBox="-14\.00 -14\.00 28\.00 28\.00"/,
        `${geom} subset uses common equal viewport`
      );
      assert.match(
        svg,
        /width="28\.00pt" height="28\.00pt"/,
        `${geom} subset uses common width/height`
      );
      assert.ok(!svg.includes('rotate('), `${geom} subset has fixed orientation, no rotation`);
    }
  }

  // All 6 subset SVGs share identical viewBox definition
  const viewBoxes = subsetSvgs.map((s) => s.match(/viewBox="([^"]+)"/)?.[1]);
  assert.equal(new Set(viewBoxes).size, 1, 'all subset SVGs share the exact same viewBox');
});

// ---------------------------------------------------------------------------
// 5. Studio Dispatch: Real Geometry Lint, No Fabricated Score Lint
// ---------------------------------------------------------------------------

test('Criterion 5: lintAbstractGeometry validates bounded geometry checks', () => {
  for (const geom of ['dial', 'rosette', 'asymmetric'] as const) {
    const report = lintAbstractGeometry(geom);
    assert.equal(report.ok, true, `${geom} bounded geometry audit passes`);
    assert.equal(report.checks, 4, `${geom} executes 4 bounded geometry checks`);
    assert.equal(report.violations.length, 0, `${geom} has 0 violations`);
    assert.deepEqual(
      report.details.map((d) => d.code),
      ['SITE_COUNT', 'MIN_SEPARATION', 'INK_BOUNDS', 'LABEL_CLEARANCE']
    );
  }
});

test('Criterion 5: Studio candidates view dispatches abstract specimens without fake score lookup', () => {
  let scoreLayoutCalls = 0;
  setLayoutJankoScoreObserver(() => {
    scoreLayoutCalls++;
  });

  try {
    const config = createStudioConfig({
      candidates: ROUND_38_CANDIDATES,
      round: ROUND_38_METADATA,
    });
    scoreLayoutCalls = 0;
    const viewHtml = renderCandidatesView(config);

    // ZERO score layout calls made for abstract candidates
    assert.equal(
      scoreLayoutCalls,
      0,
      'renderCandidatesView makes zero score layout calls for abstract candidates'
    );

    // Contains all three candidate cards
    assert.ok(viewHtml.includes('data-candidate="dial"'));
    assert.ok(viewHtml.includes('data-candidate="rosette"'));
    assert.ok(viewHtml.includes('data-candidate="asymmetric"'));

    // Renders exactly 9 candidate windows (3 cards * 3 windows)
    const windowMatches = viewHtml.match(/class="candidate-window"/g) || [];
    assert.equal(windowMatches.length, 9, 'renders exactly 9 candidate windows');

    // Data-window attributes use abstract geometry identifiers
    assert.ok(viewHtml.includes('data-window="dial:key"'));
    assert.ok(viewHtml.includes('data-window="dial:subset-1"'));
    assert.ok(viewHtml.includes('data-window="dial:subset-2"'));
    assert.ok(viewHtml.includes('data-window="rosette:key"'));
    assert.ok(viewHtml.includes('data-window="asymmetric:key"'));

    // Shows actual bounded geometry checks passed
    assert.ok(
      viewHtml.includes('✓ geometry valid (4 checks)'),
      'shows bounded geometry check count'
    );

    // Explicitly labels score engraving lint not applicable
    assert.ok(
      viewHtml.includes('score lint n/a'),
      'explicitly labels score engraving lint not applicable'
    );

    // Facts footer shows nominal dimensions and un-fabricated status
    assert.ok(viewHtml.includes('bounded geometry verified'));
    assert.ok(viewHtml.includes('score engraving lint not applicable'));

    // Badges report arrangement as round open axis
    for (const c of ROUND_38_CANDIDATES) {
      const badges = candidateBadges(c, ROUND_38_METADATA);
      const axisBadge = badges.find((b) => b.key === 'arrangement');
      assert.ok(axisBadge, `${c.id} has arrangement badge`);
      assert.equal(axisBadge.axis, true, 'arrangement is marked as active open axis');
    }
  } finally {
    setLayoutJankoScoreObserver(null);
  }
});

// ---------------------------------------------------------------------------
// 6. Regressions: Golden Master & Reference Views Untouched
// ---------------------------------------------------------------------------

test('Criterion 6: Canonical Reference view (Bach & Brahms) remains unchanged', () => {
  const config = createStudioConfig();
  const refHtml = renderReferenceView(config);

  // Brahms BRONZE and Bach GOLD blocks are present and clean
  assert.ok(refHtml.includes('data-score="brahms-op118-no1"'));
  assert.ok(refHtml.includes('data-score="primary"'));
  assert.ok(refHtml.includes('BRONZE · active surface'));
  assert.ok(refHtml.includes('GOLD · frozen standard'));
  assert.ok(refHtml.includes('Goldberg Variations, BWV 988'));
  assert.ok(refHtml.includes('Intermezzo in A minor, Op. 118 No. 1'));
});

test('R38 parked by convention: historical consts parked, live registry moved to Round 39', () => {
  assert.equal(ROUND_38_METADATA.round, 38);
  assert.equal(ROUND_38_CANDIDATES.length, 3);
  const candFile = fs.readFileSync(path.join(REPO_ROOT, 'src/render/janko/candidates.ts'), 'utf-8');
  assert.match(candFile, /Round 38 opens the twelve-site spatial alphabet/);
  assert.match(candFile, /Round 39 opens the twelve-site alphabets under strain/);
});
