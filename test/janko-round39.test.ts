import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ABSTRACT_BASE_SET,
  ABSTRACT_DENSITY_SAMPLES,
  ABSTRACT_GEOMETRY_SPECS,
  ABSTRACT_LADDER_OCTAVE_PROBE_SAMPLES,
  ABSTRACT_NEAR_NEIGHBOUR_SAMPLES,
  computeTranspositionSet,
  formatDuodecimalDigit,
  formatPitchClassSet,
  getDialSiteCoordinates,
  getLadderSiteCoordinates,
  getRosetteSiteCoordinates,
  lintAbstractGeometry,
  renderAbstractDensityBatterySvg,
  renderAbstractKeySvg,
  renderAbstractLadderOctaveProbeSvg,
  renderAbstractNearNeighboursBatterySvg,
  renderAbstractTranspositionBatterySvg,
} from '../src/render/janko/elements/abstract-geometry.js';

import {
  CURRENT_CANDIDATES,
  CURRENT_ROUND_METADATA,
} from '../src/render/janko/candidates.js';

import {
  ROUND_38_METADATA,
  ROUND_38_CANDIDATES,
} from './janko-round38.test.js';

import {
  createStudioConfig,
  renderCandidatesView,
  renderReferenceView,
} from '../src/render/janko/studio.js';
import { DEFAULT_JANKO_OPTIONS, resolveJankoOptions } from '../src/render/janko/types.js';
import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1.js';

// ---------------------------------------------------------------------------
// 1. Geometry truth (Ladder, Dial, Rosette)
// ---------------------------------------------------------------------------

test('Ladder geometry: 12 sites with pitch classes 0..b and upward y ordering', () => {
  const sites = getLadderSiteCoordinates(12);
  assert.equal(sites.length, 12, 'exactly 12 sites');

  // Verify coordinates for pitch classes 0..11
  for (let p = 0; p < 12; p++) {
    const s = sites[p];

    // Stagger: even pitches at -sqrt(3), odd pitches at +sqrt(3)
    const expectedX = (p % 2 === 0 ? -1 : 1) * Math.sqrt(3);
    assert.ok(
      Math.abs(s.x - expectedX) < 1e-9,
      `p=${p}: x should be ${expectedX}, got ${s.x}`
    );

    // Height: y(p) = 11 - 2p => higher pitch has smaller y (SVG y points downward)
    const expectedY = 11 - 2 * p;
    assert.ok(
      Math.abs(s.y - expectedY) < 1e-9,
      `p=${p}: y should be ${expectedY}, got ${s.y}`
    );
  }

  // Verify that y is strictly decreasing with pitch class (upward motion)
  for (let p = 0; p < 11; p++) {
    assert.ok(
      sites[p + 1].y < sites[p].y,
      `p=${p + 1} y=${sites[p + 1].y} should be above p=${p} y=${sites[p].y}`
    );
  }
});

test('Ladder geometry: adjacent center-to-center separation is exactly 4.0pt >= 3.0pt', () => {
  const sites = getLadderSiteCoordinates(12);
  for (let p = 0; p < 11; p++) {
    const dx = sites[p + 1].x - sites[p].x;
    const dy = sites[p + 1].y - sites[p].y;
    const dist = Math.hypot(dx, dy);
    // dx = 2*sqrt(3), dy = -2 => dist = sqrt(12 + 4) = 4.0
    assert.ok(
      Math.abs(dist - 4.0) < 1e-9,
      `p=${p} to p=${p + 1}: distance should be 4.0pt, got ${dist}`
    );
  }
});

test('Ladder geometry: ink bounds and bounding box match specification', () => {
  const spec = ABSTRACT_GEOMETRY_SPECS.ladder;
  // Width: 2 * sqrt(3) + 2 * 0.55 = 3.4641016... + 1.1 = 4.5641016...
  // Height: 22 + 2 * 0.55 = 23.1
  assert.ok(
    Math.abs(spec.nominalWidth - 4.5641) < 0.001,
    `Ladder width ${spec.nominalWidth} should match 4.5641 within 0.001`
  );
  assert.ok(
    Math.abs(spec.nominalHeight - 23.1) < 0.001,
    `Ladder height ${spec.nominalHeight} should match 23.1000 within 0.001`
  );
});

test('Dial and Rosette site coordinates and geometry specs are unchanged', () => {
  const dialSites = getDialSiteCoordinates();
  assert.equal(dialSites.length, 12);
  assert.equal(ABSTRACT_GEOMETRY_SPECS.dial.nominalWidth, 16.5548);
  assert.equal(ABSTRACT_GEOMETRY_SPECS.dial.nominalHeight, 16.5548);

  const rosetteSites = getRosetteSiteCoordinates();
  assert.equal(rosetteSites.length, 12);
  assert.equal(ABSTRACT_GEOMETRY_SPECS.rosette.nominalWidth, 13.1);
  assert.equal(ABSTRACT_GEOMETRY_SPECS.rosette.nominalHeight, 14.9564);
});

// ---------------------------------------------------------------------------
// 2. Transformational truth
// ---------------------------------------------------------------------------

test('Transform truth: all 12 transpositions of S={0,3,7,a} yield correct modulo-12 sets', () => {
  const expectedTranspositions: Array<{ t: number; set: number[] }> = [
    { t: 0, set: [0, 3, 7, 10] },
    { t: 1, set: [1, 4, 8, 11] },
    { t: 2, set: [0, 2, 5, 9] },
    { t: 3, set: [1, 3, 6, 10] },
    { t: 4, set: [2, 4, 7, 11] },
    { t: 5, set: [0, 3, 5, 8] },
    { t: 6, set: [1, 4, 6, 9] },
    { t: 7, set: [2, 5, 7, 10] },
    { t: 8, set: [3, 6, 8, 11] },
    { t: 9, set: [0, 4, 7, 9] },
    { t: 10, set: [1, 5, 8, 10] },
    { t: 11, set: [2, 6, 9, 11] },
  ];

  for (const { t, set } of expectedTranspositions) {
    const computed = computeTranspositionSet(ABSTRACT_BASE_SET, t);
    assert.deepEqual(
      computed,
      set,
      `T_${formatDuodecimalDigit(t)}(S) should be [${set.map(formatDuodecimalDigit).join(',')}], got [${computed.map(formatDuodecimalDigit).join(',')}]`
    );
  }
});

test('Transform truth: Dial exhibits exact rigid rotational covariance', () => {
  const dialSites = getDialSiteCoordinates();
  // On the dial, site p is at angle p * 30 degrees clockwise from top.
  // Transposition by t rotates pitch p to (p + t) mod 12, which corresponds to
  // rotating the entire constellation clockwise by t * 30 degrees.
  for (let t = 0; t < 12; t++) {
    const originalSet = ABSTRACT_BASE_SET;
    const transposedSet = computeTranspositionSet(originalSet, t);

    // Each note p in originalSet should map to note (p + t) % 12 in transposedSet
    for (const p of originalSet) {
      const targetP = (p + t) % 12;
      assert.ok(transposedSet.includes(targetP));

      const origCoord = dialSites[p];
      const targetCoord = dialSites[targetP];

      // Clockwise rotation of origCoord around origin by t * 30 degrees in SVG coords
      const angleRad = (t * Math.PI) / 6;
      const rotX = origCoord.x * Math.cos(angleRad) - origCoord.y * Math.sin(angleRad);
      const rotY = origCoord.x * Math.sin(angleRad) + origCoord.y * Math.cos(angleRad);

      assert.ok(
        Math.abs(rotX - targetCoord.x) < 1e-6,
        `Dial T_${t} rotation X mismatch: rotX=${rotX}, targetCoord.x=${targetCoord.x}`
      );
      assert.ok(
        Math.abs(rotY - targetCoord.y) < 1e-6,
        `Dial T_${t} rotation Y mismatch: rotY=${rotY}, targetCoord.y=${targetCoord.y}`
      );
    }
  }
});

test('Transform truth: Rosette exhibits radial-swap parity under odd transpositions', () => {
  const rosetteSites = getRosetteSiteCoordinates();
  // In rosette, outer ring sites have radius 4√3 ≈ 6.9282pt (even pitch classes 0, 2, 4, 6, 8, 10),
  // inner ring sites have radius 4.0pt (odd pitch classes 1, 3, 5, 7, 9, 11).
  for (let p = 0; p < 12; p++) {
    const s = rosetteSites[p];
    const r = Math.hypot(s.x, s.y);
    if (p % 2 === 0) {
      assert.ok(Math.abs(r - 4 * Math.sqrt(3)) < 1e-4, `Even pitch ${p} should have outer radius 4√3, got ${r}`);
    } else {
      assert.ok(Math.abs(r - 4.0) < 1e-4, `Odd pitch ${p} should have inner radius 4.0, got ${r}`);
    }
  }

  // Under even transposition (e.g. t=2), outer stay outer, inner stay inner
  const t2 = computeTranspositionSet(ABSTRACT_BASE_SET, 2);
  for (const p of t2) {
    const origEquiv = (p - 2 + 12) % 12;
    const origIsOuter = origEquiv % 2 === 0;
    const newIsOuter = p % 2 === 0;
    assert.equal(origIsOuter, newIsOuter, `Even t=2 preserves radial tier for pitch ${p}`);
  }

  // Under odd transposition (e.g. t=1, t=3), outer swap to inner and inner swap to outer
  for (const oddT of [1, 3, 5, 7, 9, 11]) {
    const tOdd = computeTranspositionSet(ABSTRACT_BASE_SET, oddT);
    for (const p of tOdd) {
      const origEquiv = (p - oddT + 12) % 12;
      const origIsOuter = origEquiv % 2 === 0;
      const newIsOuter = p % 2 === 0;
      assert.notEqual(
        origIsOuter,
        newIsOuter,
        `Odd t=${oddT} swaps radial tier for pitch ${p}`
      );
    }
  }
});

test('Transform truth: Ladder exhibits vertical translation, horizontal parity reflection, and folded boundary', () => {
  const ladderSites = getLadderSiteCoordinates(14);

  // Unfolded translation for S={0, 3, 7, 10} under t=3:
  // Unfolded pitches are {3, 6, 10, 13}.
  // In duodecimal, 13 is formatted as '11'.
  assert.equal(formatDuodecimalDigit(13), '11');

  // Verify site 13 coordinates
  const site13 = ladderSites[13];
  // 13 is odd => x = +sqrt(3)
  assert.ok(Math.abs(site13.x - Math.sqrt(3)) < 1e-9);
  // y = 11 - 2*13 = -15
  assert.equal(site13.y, -15);

  // Compare unfolded S+3 vs folded S+3
  // Folded wraps 13 mod 12 = 1.
  const site1 = ladderSites[1];
  assert.equal(site1.y, 9);
  assert.notEqual(site1.y, site13.y);
  assert.ok(site13.y < site1.y, 'Site 13 is physically far above Site 1');
});

// ---------------------------------------------------------------------------
// 3. Rendered SVG fidelity & structural invariants
// ---------------------------------------------------------------------------

test('Rendered SVG fidelity: key SVGs for Dial, Rosette, and Ladder', () => {
  for (const id of ['dial', 'rosette', 'ladder'] as const) {
    const svg = renderAbstractKeySvg(id);
    assert.ok(svg.includes('<svg'), `${id} renders valid SVG root`);
    assert.ok(svg.includes('</svg>'), `${id} closes SVG tag`);

    // In key view, 0 circle elements exist: key labels replace rather than compete with node dots.
    const circleCount = (svg.match(/<circle /g) ?? []).length;
    assert.equal(circleCount, 0, `${id} key view has zero circle elements`);

    // All 12 pitch-class labels (0..b) are rendered
    for (let p = 0; p < 12; p++) {
      const digit = formatDuodecimalDigit(p);
      assert.ok(
        svg.includes(`>${digit}</text>`),
        `${id} key view renders label ${digit}`
      );
    }
  }
});

test('Rendered SVG fidelity: transposition battery has identical cell pitch, 48 selected noteheads', () => {
  for (const id of ['dial', 'rosette', 'ladder'] as const) {
    const svg = renderAbstractTranspositionBatterySvg(id);
    assert.ok(svg.includes('data-specimen="t-0"'));
    assert.ok(svg.includes('viewBox="0 0 324.00 108.00"'), 'viewBox pins 324.00x108.00 pt');

    // 12 cells * 4 selected notes = 48 filled circles
    const filledCircles = (svg.match(/<circle /g) ?? []).length;
    assert.equal(
      filledCircles,
      48,
      `${id} transposition battery has exactly 48 selected noteheads`
    );

    // 12 transposition captions: t=0 through t=b
    for (let t = 0; t < 12; t++) {
      const caption = `t=${formatDuodecimalDigit(t)}`;
      assert.ok(
        svg.includes(caption),
        `${id} transposition battery contains caption ${caption}`
      );
    }
  }
});

test('Rendered SVG fidelity: near neighbours battery has 4 samples with explicit distance captions', () => {
  for (const id of ['dial', 'rosette', 'ladder'] as const) {
    const svg = renderAbstractNearNeighboursBatterySvg(id);
    assert.ok(svg.includes('data-specimen="near-base"'));
    assert.ok(svg.includes('viewBox="0 0 324.00 54.00"'));

    // 4 cells * 4 selected notes = 16 filled circles
    const filledCircles = (svg.match(/<circle /g) ?? []).length;
    assert.equal(
      filledCircles,
      16,
      `${id} near neighbours battery has exactly 16 selected noteheads`
    );

    // Captions verify base, 1-st change, 2-st change
    assert.ok(svg.includes('Base S'));
    assert.ok(svg.includes('3→4 (1 semitone)'));
    assert.ok(svg.includes('3→5 (2 semitones)'));
    assert.ok(svg.includes('a→b (1 semitone)'));
  }
});

test('Rendered SVG fidelity: density battery has 5 samples with explicit counts (2, 3, 6, 9, 11)', () => {
  for (const id of ['dial', 'rosette', 'ladder'] as const) {
    const svg = renderAbstractDensityBatterySvg(id);
    assert.ok(svg.includes('data-specimen="density-2"'));
    assert.ok(svg.includes('viewBox="0 0 324.00 54.00"'));

    // Total filled circles: 2 + 3 + 6 + 9 + 11 = 31
    const filledCircles = (svg.match(/<circle /g) ?? []).length;
    assert.equal(
      filledCircles,
      31,
      `${id} density battery has exactly 31 selected noteheads`
    );

    // Captions verify density counts
    assert.ok(svg.includes('2 sites'));
    assert.ok(svg.includes('3 sites'));
    assert.ok(svg.includes('6 sites'));
    assert.ok(svg.includes('9 sites'));
    assert.ok(svg.includes('11 sites'));
  }
});

test('Rendered SVG fidelity: ladder octave probe renders 3 cells, accommodates site 13, honest bounds', () => {
  const svg = renderAbstractLadderOctaveProbeSvg();
  assert.ok(svg.includes('data-specimen="probe-unfolded-s"'));
  assert.ok(svg.includes('data-specimen="probe-unfolded-s-plus-3"'));
  assert.ok(svg.includes('data-specimen="probe-folded-s-plus-3"'));
  assert.ok(svg.includes('viewBox="0 0 324.00 82.00"'), 'viewBox pins 324.00x82.00 pt');

  // Total filled circles: 4 + 4 + 4 = 12
  const filledCircles = (svg.match(/<circle /g) ?? []).length;
  assert.equal(filledCircles, 12, 'Octave probe has 12 selected noteheads across 3 cells');

  // Captions
  assert.ok(svg.includes('Original unfolded S'));
  assert.ok(svg.includes('Unfolded S+3'));
  assert.ok(svg.includes('Folded S+3 (modulo 12)'));
  assert.ok(svg.includes('4.5641 × 21.1000pt'));
  assert.ok(svg.includes('4.5641 × 19.1000pt'));
});

// ---------------------------------------------------------------------------
// 4. Candidate Registry & Round 39 metadata
// ---------------------------------------------------------------------------

test('Candidate registry: exactly 3 cards (Dial, Rosette, Ladder), asymmetric absent', () => {
  assert.equal(CURRENT_CANDIDATES.length, 3);
  const ids = CURRENT_CANDIDATES.map((c) => c.id);
  assert.deepEqual(ids, ['dial', 'rosette', 'ladder']);
  assert.ok(!ids.includes('asymmetric'), 'asymmetric constellation is dropped from active cards');
});

test('Round 39 metadata: Round 39 title and one open axis', () => {
  assert.equal(CURRENT_ROUND_METADATA.round, 39);
  assert.equal(
    CURRENT_ROUND_METADATA.title,
    'Twelve-site alphabets under strain — Round 39'
  );
  assert.deepEqual(CURRENT_ROUND_METADATA.openAxes, ['arrangement']);
});

test('Round 38 parked record: R38 metadata and candidates are preserved', () => {
  assert.equal(ROUND_38_METADATA.round, 38);
  assert.match(ROUND_38_METADATA.title, /Twelve-site spatial alphabet/);
  assert.deepEqual(
    ROUND_38_CANDIDATES.map((c) => c.id),
    ['dial', 'rosette', 'asymmetric']
  );
});

test('Studio candidate windows: Dial (4) + Rosette (4) + Ladder (5) = 13 total windows', () => {
  const dial = CURRENT_CANDIDATES.find((c) => c.id === 'dial')!;
  const rosette = CURRENT_CANDIDATES.find((c) => c.id === 'rosette')!;
  const ladder = CURRENT_CANDIDATES.find((c) => c.id === 'ladder')!;

  assert.deepEqual(
    dial.windows!.map((w: any) => w.specimenType),
    ['key', 'transposition', 'near-neighbours', 'density']
  );
  assert.deepEqual(
    rosette.windows!.map((w: any) => w.specimenType),
    ['key', 'transposition', 'near-neighbours', 'density']
  );
  assert.deepEqual(
    ladder.windows!.map((w: any) => w.specimenType),
    ['key', 'transposition', 'near-neighbours', 'density', 'octave-probe']
  );

  const totalWindows = dial.windows!.length + rosette.windows!.length + ladder.windows!.length;
  assert.equal(totalWindows, 13);
});

// ---------------------------------------------------------------------------
// 5. Abstract Geometry Diagnostics
// ---------------------------------------------------------------------------

test('Abstract geometry diagnostics: Dial, Rosette, and Ladder all pass cleanly', () => {
  for (const id of ['dial', 'rosette', 'ladder'] as const) {
    const report = lintAbstractGeometry(id);
    assert.equal(report.ok, true, `${id} report should be ok`);
    assert.equal(report.violations.length, 0, `${id} has 0 violations`);
    assert.equal(report.checks, 4, `${id} executed 4 checks`);
    for (const check of report.details) {
      assert.equal(check.passed, true, `${id} check ${check.code} passed`);
    }
  }
});

// ---------------------------------------------------------------------------
// 6. Canonical reference regression (Bach / Brahms untouched)
// ---------------------------------------------------------------------------

test('Canonical reference regression: Reference view renders golden master cleanly', () => {
  const golden = resolveJankoOptions(DEFAULT_JANKO_OPTIONS);
  assert.equal(golden.clusterSpacing, 'tight');
  assert.equal(golden.restStyle, 'classical-urtext');
  assert.equal(golden.subdivisionStyle, 'classical-urtext');
  assert.equal(golden.gridWritingPolicy, 'overlaid-beat-grid');

  const config = createStudioConfig({ score: buildBachGoldbergVar1Score() });
  const refHtml = renderReferenceView(config);

  assert.ok(refHtml.includes('id="view-reference"'));
  assert.ok(refHtml.includes('data-view="reference"'));
  assert.ok(refHtml.includes('data-score="brahms-op118-no1"'));
  assert.ok(refHtml.includes('data-score="primary"'));
});

// ---------------------------------------------------------------------------
// 7. Visual cues & handoff validation
// ---------------------------------------------------------------------------

test('Studio view markup: renders Round 39 headline and all 13 window containers', () => {
  const config = createStudioConfig({ score: buildBachGoldbergVar1Score() });
  const html = renderCandidatesView(config);

  assert.match(html, /Twelve-site alphabets under strain — Round 39/);
  assert.match(html, /Round 39/);
  assert.match(html, /data-candidate-count="3"/);
  assert.match(html, /data-window-count="13"/);

  // Confirm that every window is rendered with its respective SVG
  assert.ok(html.includes('data-window="dial:key"'));
  assert.ok(html.includes('data-window="dial:transposition"'));
  assert.ok(html.includes('data-window="dial:near-neighbours"'));
  assert.ok(html.includes('data-window="dial:density"'));
  assert.ok(html.includes('data-window="rosette:key"'));
  assert.ok(html.includes('data-window="rosette:transposition"'));
  assert.ok(html.includes('data-window="rosette:near-neighbours"'));
  assert.ok(html.includes('data-window="rosette:density"'));
  assert.ok(html.includes('data-window="ladder:key"'));
  assert.ok(html.includes('data-window="ladder:transposition"'));
  assert.ok(html.includes('data-window="ladder:near-neighbours"'));
  assert.ok(html.includes('data-window="ladder:density"'));
  assert.ok(html.includes('data-window="ladder:octave-probe"'));
});
