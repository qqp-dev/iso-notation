import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  computeColumnarLayout,
  renderPageToSvg,
  renderAllPagesToSvg,
  renderColumnarScoreToSvg,
  getSystemGeometry,
  getVerticalAccoladePath,
  A4_WIDTH_PT,
  A4_HEIGHT_PT,
  LETTER_WIDTH_PT,
  LETTER_HEIGHT_PT,
  MM_TO_PT,
  URTEXT_SERIF,
} from '../src/render/print-layout';
import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1';
import { QuantizedGridScore, QuantizedNote } from '../src/model/types';
import { linearIndex } from '../src/model/pitch';
import { wrapInPjl, generateScorePostscript } from '../scripts/print-score';

const TICKS_PER_MEASURE = 144;
const DURATION_COLORS = ['#1E293B', '#1D4ED8', '#D97706', '#BE123C'];

interface SvgLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke: string;
  width: string;
  dash: string | undefined;
  cap: string | undefined;
}

/** Extracts every straight <line> element emitted by the print engine. */
function extractLines(svg: string): SvgLine[] {
  return Array.from(
    svg.matchAll(
      /<line x1="([-\d.]+)" y1="([-\d.]+)" x2="([-\d.]+)" y2="([-\d.]+)" stroke="([^"]+)" stroke-width="([^"]+)"(?: stroke-dasharray="([^"]+)")?(?: stroke-linecap="([^"]+)")?\/>/g
    )
  ).map((m) => ({
    x1: parseFloat(m[1]),
    y1: parseFloat(m[2]),
    x2: parseFloat(m[3]),
    y2: parseFloat(m[4]),
    stroke: m[5],
    width: m[6],
    dash: m[7],
    cap: m[8],
  }));
}

interface SvgChevron {
  direction: 'up' | 'down';
  leftX: number;
  baseY1: number;
  apexX: number;
  apexY: number;
  rightX: number;
  baseY2: number;
  stroke: string;
}

/** Extracts the intuitive up/down handedness chevrons. */
function extractChevrons(svg: string): SvgChevron[] {
  return Array.from(
    svg.matchAll(
      /<path class="hand-chevron chevron-(up|down)" d="M ([-\d.]+) ([-\d.]+) L ([-\d.]+) ([-\d.]+) L ([-\d.]+) ([-\d.]+)" fill="none" stroke="([^"]+)" stroke-width="0\.80"/g
    )
  ).map((m) => ({
    direction: m[1] as 'up' | 'down',
    leftX: parseFloat(m[2]),
    baseY1: parseFloat(m[3]),
    apexX: parseFloat(m[4]),
    apexY: parseFloat(m[5]),
    rightX: parseFloat(m[6]),
    baseY2: parseFloat(m[7]),
    stroke: m[8],
  }));
}

/** Extracts the vertical copperplate accolade paths in document order. */
function extractAccolades(svg: string): string[] {
  return Array.from(svg.matchAll(/<path d="(M [^"]+ Z)" fill="#111827"\/>/g)).map((m) => m[1]);
}

/** All (x, y) coordinate pairs of an absolute-coordinate SVG path. */
function parsePathPoints(d: string): { x: number; y: number }[] {
  const nums = (d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    points.push({ x: nums[i], y: nums[i + 1] });
  }
  return points;
}

function extractHaloRings(svg: string) {
  return Array.from(
    svg.matchAll(
      /<circle cx="([\d.]+)" cy="([\d.]+)" r="5\.80" fill="none" stroke="([^"]+)" stroke-width="0\.75"\/>/g
    )
  ).map((m) => ({ cx: parseFloat(m[1]), cy: parseFloat(m[2]), stroke: m[3] }));
}

test('Horizontal System Layout Invariant: 2-page zero-turn spread for Bach Goldberg Var 1', () => {
  const score = buildBachGoldbergVar1Score();
  const layout = computeColumnarLayout(score);

  assert.equal(layout.totalMeasures, 32, 'Goldberg Var 1 has 32 measures');
  assert.equal(layout.ticksPerMeasure, TICKS_PER_MEASURE, '3/4 meter at 48 tpb = 144 ticks/measure');
  assert.equal(layout.measuresPerSystem, 4, 'Four measures per horizontal system');
  assert.equal(layout.systemsPerPage, 4, 'Four horizontal systems per portrait page');
  assert.equal(layout.systems.length, 8, '32 measures / 4 per system = 8 systems');
  assert.equal(layout.pages.length, 2, 'Exactly 2 pages (ceil(32 / 16) = 2)');

  // Page 1 contains Measures 1–16 across 4 systems
  assert.deepEqual(
    layout.pages[0].systems.map((s) => s.sysStartMeasure),
    [1, 5, 9, 13],
    'Page 1 system start measures must be [1, 5, 9, 13]'
  );
  // Page 2 contains Measures 17–32 across 4 systems
  assert.deepEqual(
    layout.pages[1].systems.map((s) => s.sysStartMeasure),
    [17, 21, 25, 29],
    'Page 2 system start measures must be [17, 21, 25, 29]'
  );

  assert.deepEqual(layout.pages[0].systems.map((s) => s.endMeasure), [4, 8, 12, 16]);
  assert.deepEqual(layout.pages[1].systems.map((s) => s.endMeasure), [20, 24, 28, 32]);

  for (const system of layout.systems) {
    assert.equal(system.endMeasure - system.startMeasure + 1, 4, 'Every system spans 4 measures');
    assert.equal(system.startTick, (system.startMeasure - 1) * TICKS_PER_MEASURE);
    assert.equal(system.endTick, system.endMeasure * TICKS_PER_MEASURE);
    assert.equal(system.sysStartMeasure, system.startMeasure);
    assert.equal(system.systemOnPageIndex, system.systemIndex % 4);
    assert.ok(system.notes.length > 0, `System ${system.systemIndex + 1} must own notes`);
  }

  // Note partitioning: every note lives in exactly one system
  const partitioned = layout.systems.reduce((sum, s) => sum + s.notes.length, 0);
  assert.equal(partitioned, score.notes.length, 'Every note must be present in exactly one system');
  for (const system of layout.systems) {
    for (const note of system.notes) {
      assert.ok(note.startTick >= system.startTick && note.startTick < system.endTick);
    }
  }

  // Section names
  assert.match(layout.pages[0].sectionName, /Section A.*1.*16/);
  assert.match(layout.pages[1].sectionName, /Section B.*17.*32/);

  // Both pages render as standalone portrait SVGs
  const svgs = renderAllPagesToSvg(layout);
  assert.equal(svgs.length, 2, 'renderAllPagesToSvg must produce exactly 2 pages');
  for (const svg of svgs) {
    assert.match(svg, /<rect[^>]*width="100%"[^>]*height="100%"[^>]*fill="#FFFFFF"/);
    assert.match(svg, /Page \d of 2/);
  }

  // Portrait A4 geometry: 4 stacked 124.8pt systems with generous breathing room
  assert.ok(Math.abs(layout.pageDimensions.widthPt - A4_WIDTH_PT) < 0.01);
  assert.ok(Math.abs(layout.pageDimensions.heightPt - A4_HEIGHT_PT) < 0.01);
  assert.ok(Math.abs(layout.systemDimensions.staffHeightPt - 48 * 2.6) < 0.01, 'System height must be 124.8pt');
  assert.ok(
    layout.systemDimensions.slotHeightPt > 170 && layout.systemDimensions.slotHeightPt < 185,
    `System slot height must leave ~50pt of breathing room (got ${layout.systemDimensions.slotHeightPt})`
  );
  assert.ok(
    layout.systemDimensions.measureWidthPt > 125 && layout.systemDimensions.measureWidthPt < 135,
    'Each of the 4 measures spans ~130pt'
  );
  assert.ok(Math.abs(layout.ptPerSemitone - 2.6) < 1e-9, 'Pitch lane height must be 2.60pt');
});

test('Classical Vertical Accolade Invariant: copperplate brace clasping o1–o5 on the left margin', () => {
  const score = buildBachGoldbergVar1Score();
  const layout = computeColumnarLayout(score);
  const svgs = renderAllPagesToSvg(layout);

  // The exported path generator is deterministic and spans the requested vertical range
  const direct = getVerticalAccoladePath(30.35, 106.35, 231.15, 10, 1.25);
  assert.match(direct, /^M [\d.]+ [\d.]+ C /);
  assert.match(direct, / Z$/);
  const directPoints = parsePathPoints(direct);
  assert.ok(Math.abs(Math.min(...directPoints.map((p) => p.y)) - 106.35) < 0.01);
  assert.ok(Math.abs(Math.max(...directPoints.map((p) => p.y)) - 231.15) < 0.01);

  for (let pageIndex = 0; pageIndex < 2; pageIndex++) {
    const accolades = extractAccolades(svgs[pageIndex]);
    assert.equal(accolades.length, 4, `Page ${pageIndex + 1} must render one accolade per system`);

    for (let s = 0; s < 4; s++) {
      const geo = getSystemGeometry(layout, pageIndex, s);
      const path = accolades[s];
      assert.match(path, /^M [\d.]+ [\d.]+ C [^"]+ Z$/, 'Accolade must be a closed sculptural path');

      const points = parsePathPoints(path);
      const xs = points.map((p) => p.x);
      const ys = points.map((p) => p.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);

      assert.ok(
        Math.abs(Math.min(...ys) - geo.staffTopY) < 0.01,
        'Accolade must clasp the top of the staff (o5)'
      );
      assert.ok(
        Math.abs(Math.max(...ys) - geo.staffBotY) < 0.01,
        'Accolade must clasp the bottom of the staff (o1)'
      );
      assert.ok(
        Math.abs(geo.staffBotY - geo.staffTopY - 124.8) < 0.01,
        'Accolade must span the full 4-octave staff (o1 → o5)'
      );

      // The central cusp is the rightmost point of the brace and points into Middle C
      const y48 = geo.yForPitch(48);
      const cuspPoints = points.filter((p) => Math.abs(p.x - maxX) < 0.01);
      assert.ok(
        cuspPoints.some((p) => Math.abs(p.y - y48) < 0.01),
        `Accolade cusp must point at Middle C y(48) = ${y48.toFixed(2)}`
      );
      assert.ok(
        Math.abs(y48 - (geo.staffTopY + geo.staffBotY) / 2) < 0.01,
        'Middle C must sit dead-center of the 4-octave staff'
      );

      // Brace lives on the left margin, left of the opening barline
      assert.ok(maxX < geo.staffLeftPt, 'Accolade must sit in the left margin, clear of the staff');
      assert.ok(minX > 0, 'Accolade must remain inside the paper');

      // Authentic copperplate proportions: ~1:10 (height : width)
      const width = maxX - minX;
      const aspect = (geo.staffBotY - geo.staffTopY) / width;
      assert.ok(aspect > 8 && aspect < 15, `Accolade aspect ratio must be ~1:10 (got 1:${aspect.toFixed(1)})`);
    }
  }
});

test('Horizontal Staff Topography Invariant: Middle C spine, octave lines, landmark dashes, vertical barlines & beat grid', () => {
  const score = buildBachGoldbergVar1Score();
  const layout = computeColumnarLayout(score);
  const page1 = renderPageToSvg(layout, 0);
  const lines = extractLines(page1);
  const round2 = (v: number) => parseFloat(v.toFixed(2));

  for (let s = 0; s < 4; s++) {
    const geo = getSystemGeometry(layout, 0, s);
    const staffTop = round2(geo.staffTopY);
    const staffBot = round2(geo.staffBotY);

    // 1. Middle C (p = 48): bold horizontal center spine (1.35pt, #000000)
    const spineLines = lines.filter(
      (l) => l.y1 === l.y2 && l.stroke === '#000000' && l.width === '1.35' && round2(l.y1) === round2(geo.yForPitch(48))
    );
    assert.equal(spineLines.length, 1, `System ${s + 1} must render one 1.35pt Middle C spine`);
    assert.ok(Math.abs(spineLines[0].x1 - geo.staffLeftPt) < 0.01, 'Spine must start at the opening barline');
    assert.ok(Math.abs(spineLines[0].x2 - geo.staffRightPt) < 0.01, 'Spine must run to the page margin');

    // 2. Octaves (p = 24, 36, 60, 72): solid horizontal lines (0.65pt, #000000)
    for (const octavePitch of [24, 36, 60, 72]) {
      const y = round2(geo.yForPitch(octavePitch));
      const octaveLines = lines.filter(
        (l) => l.y1 === l.y2 && l.stroke === '#000000' && l.width === '0.65' && round2(l.y1) === y
      );
      assert.equal(octaveLines.length, 1, `System ${s + 1} octave line p=${octavePitch} must be horizontal`);
    }

    // 3. Landmark 4 (p = 28, 40, 52, 64): small horizontal dashed lines (0.6pt, #444444, [5, 2.5])
    for (const landmarkPitch of [28, 40, 52, 64]) {
      const y = round2(geo.yForPitch(landmarkPitch));
      const landmarkLines = lines.filter(
        (l) =>
          l.y1 === l.y2 &&
          l.stroke === '#444444' &&
          l.width === '0.6' &&
          l.dash === '5,2.5' &&
          round2(l.y1) === y
      );
      assert.equal(landmarkLines.length, 1, `System ${s + 1} landmark dashed line p=${landmarkPitch} must be horizontal`);
    }

    // 4. Barlines are vertical across the staff (y1 = staffTopY, y2 = staffBotY)
    const barlines = lines.filter(
      (l) => l.x1 === l.x2 && l.width === '0.75' && round2(l.y1) === staffTop && round2(l.y2) === staffBot
    );
    assert.equal(barlines.length, 4, `System ${s + 1} must render exactly 4 vertical measure barlines`);
    const expectedBarX = [1, 2, 3, 4].map((m) => {
      const endTick = (s * 4 + m) * TICKS_PER_MEASURE;
      const spec = (score.barlines || []).find((b) => b.tick === endTick);
      const x = geo.staffLeftPt + m * geo.measureWidthPt;
      // Double/final barlines place their thin stroke just inside the boundary
      return round2(spec && (spec.type === 'double' || spec.type === 'final') ? x - 3.2 : x);
    });
    assert.deepEqual(
      barlines.map((l) => round2(l.x1)).sort((a, b) => a - b),
      expectedBarX.slice().sort((a, b) => a - b),
      'Barlines must stand at exact measure boundaries'
    );

    // 5. Authoritative initial vertical barline at the head of every system (1.2pt)
    const openingBarlines = lines.filter(
      (l) =>
        l.x1 === l.x2 &&
        l.width === '1.2' &&
        round2(l.x1) === round2(geo.staffLeftPt) &&
        round2(l.y1) === staffTop &&
        round2(l.y2) === staffBot
    );
    assert.equal(openingBarlines.length, 1, `System ${s + 1} must open with a 1.2pt vertical barline after the accolade`);

    // 6. Beat grid pulse lines for beats 2 and 3: vertical dashed lines (#D1D5DB, 0.5pt, [2, 3])
    const beatLines = lines.filter(
      (l) =>
        l.stroke === '#D1D5DB' &&
        l.width === '0.5' &&
        l.dash === '2,3' &&
        round2(l.y1) === staffTop &&
        round2(l.y2) === staffBot
    );
    assert.equal(beatLines.length, 8, `System ${s + 1} must render 2 vertical pulse lines per measure × 4 measures`);
    for (const line of beatLines) {
      assert.equal(line.x1, line.x2, 'Beat grid pulse lines must be perfectly vertical');
    }
  }

  // 7. Clean Urtext measure numbering: 1..16 once each, above the measure start lines
  const measureNumbers = Array.from(page1.matchAll(/class="measure-num">(\d+)<\/text>/g)).map((m) => Number(m[1]));
  assert.deepEqual(
    measureNumbers,
    Array.from({ length: 16 }, (_, i) => i + 1),
    'Page 1 must number measures 1–16 above their opening barlines'
  );

  // 8. Zero confusing margin numeral stacks and column-top octave badges
  assert.doesNotMatch(page1, />o1</);
  assert.doesNotMatch(page1, />o3</);
  assert.doesNotMatch(page1, />o5</);
  assert.doesNotMatch(page1, /class="pitch-label"/);
  assert.doesNotMatch(page1, /class="time-sig"/);
  assert.doesNotMatch(page1, /class="beat-counter"/);
});

test('Intuitive Up/Down Handedness Chevron Invariant: RH below Middle C points up, LH above Middle C points down', () => {
  const score = buildBachGoldbergVar1Score();
  const layout = computeColumnarLayout(score);
  const page1 = renderPageToSvg(layout, 0);
  const page2 = renderPageToSvg(layout, 1);
  const page1Chevrons = extractChevrons(page1);
  const page2Chevrons = extractChevrons(page2);
  const allChevrons = [...page1Chevrons, ...page2Chevrons];

  // Measure 4 (system 1 of page 1): RH crossing into the bass
  const geo4 = getSystemGeometry(layout, 0, 0);
  const m4Notes = score.notes.filter(
    (n) => n.startTick >= 3 * TICKS_PER_MEASURE && n.startTick < 4 * TICKS_PER_MEASURE
  );
  const m4Exceptions = m4Notes.filter((n) => n.hand === 'RH' && linearIndex(n.pitch) < 48);
  assert.deepEqual(
    [...new Set(m4Exceptions.map((n) => linearIndex(n.pitch)))].sort((a, b) => a - b),
    [36, 42, 43, 45],
    'Measure 4 RH exceptions must include pitches 45, 43, 42 and 36'
  );

  for (const note of m4Exceptions) {
    const nx = parseFloat(geo4.xForTick(note.startTick).toFixed(2));
    const ny = parseFloat(geo4.yForPitch(linearIndex(note.pitch)).toFixed(2));
    const chevron = page1Chevrons.find(
      (c) => c.direction === 'up' && Math.abs(c.apexX - nx) < 0.01 && Math.abs(c.apexY - ny) < 20
    );
    assert.ok(chevron, `Measure 4 note ${note.id} (p=${linearIndex(note.pitch)}) must render an upward chevron`);
    assert.ok(chevron.apexY < chevron.baseY1, 'Upward chevron must have its apex above the base (∧)');
    assert.ok(chevron.baseY1 < ny, 'Upward chevron must sit above the notehead');
    assert.ok(Math.abs(chevron.apexX - nx) < 0.01, 'Chevron must be horizontally centered on the notehead');
  }

  // Measure 30 (system 8 of page 2): LH crossing into the treble
  const geo30 = getSystemGeometry(layout, 1, 3);
  const m30Notes = score.notes.filter(
    (n) => n.startTick >= 29 * TICKS_PER_MEASURE && n.startTick < 30 * TICKS_PER_MEASURE
  );
  const m30Exceptions = m30Notes.filter((n) => n.hand === 'LH' && linearIndex(n.pitch) > 48);
  assert.deepEqual(
    [...new Set(m30Exceptions.map((n) => linearIndex(n.pitch)))].sort((a, b) => a - b),
    [52, 54, 55, 56, 57],
    'Measure 30 LH exceptions must include pitches 52, 54, 56, 57 and 55'
  );

  for (const note of m30Exceptions) {
    const nx = parseFloat(geo30.xForTick(note.startTick).toFixed(2));
    const ny = parseFloat(geo30.yForPitch(linearIndex(note.pitch)).toFixed(2));
    const chevron = page2Chevrons.find(
      (c) => c.direction === 'down' && Math.abs(c.apexX - nx) < 0.01 && Math.abs(c.apexY - ny) < 20
    );
    assert.ok(chevron, `Measure 30 note ${note.id} (p=${linearIndex(note.pitch)}) must render a downward chevron`);
    assert.ok(chevron.apexY > chevron.baseY1, 'Downward chevron must have its apex below the base (∨)');
    assert.ok(chevron.apexY > ny, 'Downward chevron must sit below the notehead');
    assert.ok(Math.abs(chevron.apexX - nx) < 0.01, 'Chevron must be horizontally centered on the notehead');
  }

  // Handedness totals across the whole movement: 24 RH exceptions + 39 LH exceptions
  const upChevrons = allChevrons.filter((c) => c.direction === 'up');
  const downChevrons = allChevrons.filter((c) => c.direction === 'down');
  assert.equal(upChevrons.length, 24, '24 RH crossing notes must render upward chevrons');
  assert.equal(downChevrons.length, 39, '39 LH crossing notes must render downward chevrons');

  // Register default notes (RH above Middle C, LH below) render zero chevrons
  const defaultRhPitch = linearIndex({ pitchClass: 7, octave: 4 }); // G4 = 55
  const geoAny = geo4;
  const defaultUpAnchors = upChevrons.filter((c) => Math.abs(c.apexY - geoAny.yForPitch(defaultRhPitch)) < 0.01);
  assert.equal(defaultUpAnchors.length, 0, 'Default RH register notes must not render chevrons');
});

test('Horizontal Hold Lines & Middle C Continuity Invariant', () => {
  const score = buildBachGoldbergVar1Score();
  const layout = computeColumnarLayout(score);
  const svgs = renderAllPagesToSvg(layout);
  const tauRef = score.gridResolution || 12;

  const holdLines = svgs.flatMap((svg) =>
    extractLines(svg).filter(
      (l) => DURATION_COLORS.includes(l.stroke) && (l.cap === 'butt' || l.cap === 'round')
    )
  );
  assert.ok(holdLines.length > 0, 'Must render duration hold lines');

  const geo97 = getSystemGeometry(layout, 0, 1); // mm. 5–8 system

  // Every trail extends horizontally to the right and stays inside the staff bounds
  for (const line of holdLines) {
    assert.equal(line.y1, line.y2, 'Duration trails must extend horizontally (y1 === y2)');
    assert.ok(line.x2 > line.x1, 'Duration trails must extend to the right (x2 > x1)');
    assert.ok(line.x1 >= geo97.staffLeftPt - 0.01, 'Trails must begin inside the staff');
    assert.ok(line.x2 <= geo97.staffRightPt + 0.01, 'Trails must be clamped to the right staff bound');
  }

  // Zero vertical trails from the defunct columnar layout
  const verticalColoredLines = svgs.flatMap((svg) =>
    extractLines(svg).filter((l) => DURATION_COLORS.includes(l.stroke) && l.x1 === l.x2)
  );
  assert.equal(verticalColoredLines.length, 0, 'Must render zero vertical duration trails');

  // Every colored note (duration > tauRef) is represented by exactly one trail
  const coloredNotes = score.notes.filter((n) => n.durationTicks > tauRef);
  assert.equal(coloredNotes.length, 165, 'Goldberg Var 1 has exactly 165 colored (8th+) notes');
  assert.equal(holdLines.length, coloredNotes.length, 'Every colored note must render one hold line');

  // Bar 6 Middle C note bach-var1-97 (tick 816, dur 24): continuous Royal Blue trail on the bold spine
  const note97 = score.notes.find((n) => n.id === 'bach-var1-97')!;
  assert.equal(linearIndex(note97.pitch), 48, 'Note 97 must sit on Middle C');
  const nx97 = geo97.xForTick(note97.startTick);
  const ny97 = geo97.yForPitch(48);
  const expectedHoldStartX = nx97 + 4.8;
  const expectedHoldEndX = geo97.xForTick(note97.startTick + note97.durationTicks);

  assert.match(
    renderPageToSvg(layout, 0),
    new RegExp(
      `<line x1="${expectedHoldStartX.toFixed(2)}" y1="${ny97.toFixed(2)}" x2="${expectedHoldEndX.toFixed(2)}" y2="${ny97.toFixed(2)}" stroke="#1D4ED8" stroke-width="1.35" stroke-linecap="butt"/>`
    ),
    'Bar 6 Middle C note 97 must render a continuous Royal Blue hold line matching the 1.35pt spine'
  );

  // Open-space trails are thin and round-capped; staff-line trails are butt-capped
  const spaceTrails = holdLines.filter((l) => l.cap === 'round');
  const lineTrails = holdLines.filter((l) => l.cap === 'butt');
  assert.ok(spaceTrails.length > 0, 'Open-space trails must use round line caps');
  assert.ok(lineTrails.length > 0, 'Staff-line trails must use butt line caps');
  for (const trail of spaceTrails) assert.equal(trail.width, '0.8', 'Open-space trails are 0.8pt');
  const round2 = (v: number) => parseFloat(v.toFixed(2));
  const middleCYs = new Set<number>();
  const octaveYs = new Set<number>();
  for (let s = 0; s < layout.systems.length; s++) {
    const geo = getSystemGeometry(layout, Math.floor(s / layout.systemsPerPage), s % layout.systemsPerPage);
    middleCYs.add(round2(geo.yForPitch(48)));
    for (const p of [24, 36, 60, 72]) octaveYs.add(round2(geo.yForPitch(p)));
  }
  for (const trail of lineTrails) {
    assert.ok(trail.width === '0.65' || trail.width === '1.35', 'Staff-line trails match staff line width');
    if (trail.width === '1.35') {
      assert.ok(middleCYs.has(round2(trail.y1)), 'Middle C trails must render at 1.35pt on the bold spine');
    } else {
      assert.ok(octaveYs.has(round2(trail.y1)), 'Other staff-line trails must render at 0.65pt on octave lines');
    }
  }

  // Notes at or below the 16th-note resolution stay pure noteheads with zero trails
  const regularNotes = score.notes.filter((n) => n.durationTicks <= tauRef);
  assert.ok(regularNotes.length > 0);
  for (const note of regularNotes) {
    assert.ok(note.durationTicks <= 12);
  }
});

test('Opening Sound Position of Honor: concentric noble halo ring for tick 0 notes of Measure 1', () => {
  const score = buildBachGoldbergVar1Score();
  const layout = computeColumnarLayout(score);
  const page1 = renderPageToSvg(layout, 0);
  const geo = getSystemGeometry(layout, 0, 0);

  const halos = extractHaloRings(page1);
  assert.equal(halos.length, 2, 'Exactly the two opening sounds at tick 0 must receive a halo ring');

  const openingNotes = score.notes.filter((n) => n.startTick === 0);
  assert.equal(openingNotes.length, 2, 'Goldberg Var 1 opens with two sounds (LH + RH)');
  const nx = geo.xForTick(0);
  for (const note of openingNotes) {
    const ny = geo.yForPitch(linearIndex(note.pitch));
    assert.ok(
      halos.some((h) => Math.abs(h.cx - nx) < 0.01 && Math.abs(h.cy - ny) < 0.01),
      `Opening note ${note.id} (p=${linearIndex(note.pitch)}) must be framed by a concentric halo ring`
    );
  }

  // The halo is concentric with the circular knockout that protects the digit
  for (const halo of halos) {
    assert.match(
      page1,
      new RegExp(`<circle cx="${halo.cx.toFixed(2)}" cy="${halo.cy.toFixed(2)}" r="4\\.80" fill="#FFFFFF"/>`),
      'Halo ring must be concentric with the notehead knockout'
    );
  }

  // No later note in the movement receives the position-of-honor halo
  const laterHalos = renderAllPagesToSvg(layout)
    .slice(0, 1)
    .flatMap((svg) => extractHaloRings(svg))
    .filter((h) => Math.abs(h.cx - nx) > 0.01);
  assert.equal(laterHalos.length, 0, 'Only tick 0 sounds receive the halo');
});

test('Local Dashed Outlier Staff Line Invariant: pitch 76 rendered strictly for mm. 29–30', () => {
  const score = buildBachGoldbergVar1Score();
  const layout = computeColumnarLayout(score);
  const page1 = renderPageToSvg(layout, 0);
  const page2 = renderPageToSvg(layout, 1);

  // No page-1 system (mm. 1–16) contains notes above o5, so no outlier line may appear there
  for (let s = 0; s < 4; s++) {
    const geo = getSystemGeometry(layout, 0, s);
    const y76 = parseFloat(geo.yForPitch(76).toFixed(2));
    const aboveStaff = extractLines(page1).filter(
      (l) => l.dash === '5,2.5' && parseFloat(l.y1.toFixed(2)) === y76
    );
    assert.equal(aboveStaff.length, 0, `Page 1 system ${s + 1} must not render outlier lines above o5`);
  }

  // Page 2 system 4 (mm. 29–32) contains D6 (pitch 74) in mm. 29–30 → local dashed line at pitch 76.
  // Systems 1–3 of page 2 (mm. 17–28) stay within the 4-octave core.
  for (let s = 0; s < 3; s++) {
    const geo = getSystemGeometry(layout, 1, s);
    const y76 = parseFloat(geo.yForPitch(76).toFixed(2));
    const aboveStaff = extractLines(page2).filter(
      (l) => l.dash === '5,2.5' && parseFloat(l.y1.toFixed(2)) === y76
    );
    assert.equal(aboveStaff.length, 0, `Page 2 system ${s + 1} must not render outlier lines above o5`);
  }

  const geoLast = getSystemGeometry(layout, 1, 3);
  const y76 = parseFloat(geoLast.yForPitch(76).toFixed(2));
  const outlierLines = extractLines(page2).filter(
    (l) => l.y1 === l.y2 && l.dash === '5,2.5' && parseFloat(l.y1.toFixed(2)) === y76
  );
  assert.equal(outlierLines.length, 2, 'Exactly two local dashed outlier segments (mm. 29 and 30)');
  assert.ok(y76 < geoLast.staffTopY, 'The pitch 76 outlier line must sit above the o5 staff line');

  const m29StartX = parseFloat(geoLast.xForMeasureStart(0).toFixed(2));
  const m30StartX = parseFloat(geoLast.xForMeasureStart(1).toFixed(2));
  const m31StartX = parseFloat(geoLast.xForMeasureStart(2).toFixed(2));
  const segments = outlierLines.map((l) => [parseFloat(l.x1.toFixed(2)), parseFloat(l.x2.toFixed(2))]);
  assert.deepEqual(segments, [[m29StartX, m30StartX], [m30StartX, m31StartX]], 'Outlier segments must cover mm. 29 and 30 only');
});

test('Horizontal Engraving API, Morphology & Legacy Alias Regression', () => {
  const score = buildBachGoldbergVar1Score();
  const layout = computeColumnarLayout(score);
  const svgs = renderAllPagesToSvg(layout);

  // renderColumnarScoreToSvg helper mirrors renderPageToSvg
  assert.equal(renderColumnarScoreToSvg(score, 0), svgs[0]);
  assert.equal(renderColumnarScoreToSvg(score), svgs[0]);
  assert.equal(renderColumnarScoreToSvg(score, 1), svgs[1]);
  assert.match(svgs[0], /<svg[^>]*style="[^"]*width:\s*100%[^"]*height:\s*auto[^"]*"/);

  // Duodecimal default: naked digits protected by circular knockouts
  assert.match(svgs[0], /class="duo-digit"/);
  assert.match(svgs[0], /<circle cx="[\d.]+" cy="[\d.]+" r="4\.80" fill="#FFFFFF"\/>/);
  assert.match(svgs[0], />7<\/text>/, 'Must render G as 7');
  assert.match(svgs[0], />b<\/text>/, 'Must render B as b');
  assert.doesNotMatch(svgs[0], /<rect[^>]*rx="1\.5"[^>]*fill=/, 'Zero background box tiles around duodecimal noteheads');

  // Phonetic morphology keeps lowercase syllables in the horizontal systems
  const phoneticSvg = renderColumnarScoreToSvg(score, { noteheadMorphology: 'phonetic' });
  assert.match(phoneticSvg, /<text[^>]*font-family="monospace"[^>]*>(?:o|wa|tu|ti|fo|fa|si|se|e|na|a|bi)<\/text>/);

  // Rectangle / square morphology: solid Row 0 squares, hollow Row 1 squares
  const rectSvg = renderColumnarScoreToSvg(score, { noteheadMorphology: 'rectangle-square' });
  assert.match(rectSvg, /<rect[^>]*width="7\.50"[^>]*height="5\.60"[^>]*rx="1\.5" fill="(?!#FFFFFF)/);
  assert.match(rectSvg, /<rect[^>]*width="6\.20"[^>]*height="4\.30"[^>]*fill="#FFFFFF"[^>]*stroke-width="1\.3"/);
  assert.doesNotMatch(rectSvg, /<ellipse/);

  // Row-parity morphology: oval on lines, brick in spaces
  const paritySvg = renderColumnarScoreToSvg(score, { noteheadMorphology: 'row-parity-shape' });
  assert.match(paritySvg, /<ellipse[^>]*rx="5\.20"[^>]*ry="3\.00"/);
  assert.match(paritySvg, /<rect[^>]*width="8\.60"[^>]*height="5\.80"[^>]*rx="1\.2"/);

  // Legacy columnar option aliases still resolve onto the horizontal system engine
  const legacy = computeColumnarLayout(score, { measuresPerColumn: 2, columnsPerPage: 2 });
  assert.equal(legacy.measuresPerSystem, 2);
  assert.equal(legacy.systemsPerPage, 2);
  assert.equal(legacy.systems.length, 16);
  assert.equal(legacy.pages.length, 8);
  assert.equal(legacy.columns.length, legacy.systems.length, 'columns alias must mirror systems');
  assert.equal(legacy.pages[0].columns.length, legacy.pages[0].systems.length);

  // Defaults remain intact for the UI
  assert.equal(layout.options.showBeatGrid, true);
  assert.equal(layout.options.showGutterBrackets, false);
  assert.equal(layout.options.octaveExtensionMode, 'spillover');
  assert.ok(!('showBeamGrouping' in layout.options));
});

test('Optional Gutter Beat Brackets adapt to horizontal systems (RH above, LH below)', () => {
  const score = buildBachGoldbergVar1Score();
  const layout = computeColumnarLayout(score, { showBeatGrid: false, showGutterBrackets: true });
  const page1 = renderPageToSvg(layout, 0);

  assert.ok(page1.includes('LH Gutter Bracket'), 'Must render LH gutter brackets below the staff');
  assert.ok(page1.includes('RH Gutter Bracket'), 'Must render RH gutter brackets above the staff');
  assert.ok(page1.includes('fill="none" stroke="#6B7280"'), 'Brackets must use the gutter stroke');
  assert.ok(!page1.includes('Klavarskribo Beat Grid'), 'Beat grid must be absent when disabled');
});

test('A4 & Letter Portrait Print Dimensions Invariant', () => {
  const score = buildBachGoldbergVar1Score();
  const layout = computeColumnarLayout(score, { pageMarginMm: 10 });

  // A4 point dimensions: 595.28 pt × 841.89 pt
  assert.equal(Math.round(layout.pageDimensions.widthPt * 100) / 100, Math.round(A4_WIDTH_PT * 100) / 100);
  assert.equal(Math.round(layout.pageDimensions.heightPt * 100) / 100, Math.round(A4_HEIGHT_PT * 100) / 100);

  const marginPt = 10 * MM_TO_PT;
  const printableWidth = A4_WIDTH_PT - 2 * marginPt;
  assert.ok(printableWidth > 530 && printableWidth < 540);

  // The system staff spans the printable width minus the accolade margin
  const expectedStaffWidth = printableWidth - 10 - 8;
  assert.ok(
    Math.abs(layout.systemDimensions.widthPt - expectedStaffWidth) < 0.01,
    `Horizontal system width must claim the printable width (got ${layout.systemDimensions.widthPt})`
  );

  // Letter portrait still forms the same 2-page spread
  const letterLayout = computeColumnarLayout(score, { paperSize: 'letter' });
  assert.equal(letterLayout.pageDimensions.widthPt, LETTER_WIDTH_PT);
  assert.equal(letterLayout.pageDimensions.heightPt, LETTER_HEIGHT_PT);
  assert.equal(letterLayout.pages.length, 2);
  assert.equal(letterLayout.pages[0].systems.length, 4);
  const letterGeo = getSystemGeometry(letterLayout, 0, 0);
  assert.ok(letterGeo.staffBotY < LETTER_HEIGHT_PT - 28.35, 'Last system must stay inside the printable letter page');
  assert.ok(letterGeo.staffTopY > 28.35 + 44);
});

test('Web Print CSS & @media print Invariants', () => {
  const cssPath = path.join(process.cwd(), 'src/index.css');
  const css = fs.readFileSync(cssPath, 'utf-8');

  // Must define @page { size: A4 portrait; margin: 0; }
  assert.match(css, /@page\s*\{\s*size:\s*A4\s*portrait;\s*margin:\s*0;\s*\}/i);

  // Must define @media print with .no-print and .print-only
  assert.match(css, /@media\s*print/);
  assert.match(css, /\.no-print\s*\{\s*display:\s*none\s*!important;\s*\}/);
  assert.match(css, /\.print-page\s*\{[^}]*width:\s*210mm\s*!important/);
  assert.match(css, /\.print-page\s*\{[^}]*height:\s*297mm\s*!important/);
  assert.match(css, /\.print-page\s*\{[^}]*overflow:\s*hidden\s*!important/);
  assert.match(css, /\.print-page\s*\{[^}]*break-after:\s*page/);
  assert.match(css, /\.print-preview-card\s*svg\s*\{[^}]*width:\s*100%\s*!important/);
});

test('Network Laser Printing Pipeline: 2-page PostScript & PJL wrapping', async () => {
  // Test generating vector PostScript from benchmark score (defaulting to Letter for US printer tray)
  const { psBuffer, layout } = await generateScorePostscript('bach-goldberg-var1');

  assert.equal(layout.pageDimensions.widthPt, 612, 'Letter width must be 612 pt');
  assert.equal(layout.pageDimensions.heightPt, 792, 'Letter height must be 792 pt');
  assert.equal(layout.pages.length, 2, 'Horizontal portrait engraving must yield a 2-page spread');

  assert.ok(psBuffer.length > 10000, 'PostScript buffer must be generated and non-trivial');
  const psText = psBuffer.toString('binary', 0, 1000);
  assert.match(psText, /%!PS-Adobe/);

  // Check multi-page emission (%%Pages: 2)
  const fullPs = psBuffer.toString('binary');
  assert.match(fullPs, /%%Pages:\s*2/);

  // Strictly enforce 100% vector output: zero raster image operator calls
  assert.doesNotMatch(fullPs, /\nimage\n/, 'PostScript must contain zero raster bitmap calls');

  // Test PJL wrapper with Letter paper setting
  const wrapped = wrapInPjl(psBuffer, 'Bach Goldberg Var 1', 'letter');
  const wrappedHead = wrapped.toString('binary', 0, 300);
  const wrappedTail = wrapped.toString('binary', wrapped.length - 100);

  assert.match(wrappedHead, /@PJL JOB NAME = "Bach Goldberg Var 1"/);
  assert.match(wrappedHead, /@PJL SET PAPER = LETTER/);
  assert.match(wrappedHead, /@PJL SET RENDERMODE = COLOR/);
  assert.match(wrappedHead, /@PJL SET COLORMODE = COLOR/);
  assert.match(wrappedHead, /@PJL ENTER LANGUAGE = POSTSCRIPT/);
  assert.match(wrappedTail, /@PJL EOJ/);
});

test('Urtext Classical Serif Typography Invariant: refined font stack and italic styling', () => {
  const score = buildBachGoldbergVar1Score();
  const layout = computeColumnarLayout(score);
  const page1Svg = renderPageToSvg(layout, 0);

  // Verify font stack constant
  assert.ok(URTEXT_SERIF.includes('Century Schoolbook'), 'URTEXT_SERIF contains Century Schoolbook');
  assert.ok(URTEXT_SERIF.includes('Baskerville'), 'URTEXT_SERIF contains Baskerville');
  assert.ok(URTEXT_SERIF.includes('Liberation Serif'), 'URTEXT_SERIF contains Liberation Serif');

  // Verify <style> block includes URTEXT_SERIF for classes
  assert.ok(page1Svg.includes(`.title { font-family: ${URTEXT_SERIF}; font-weight: 600; font-size: 11pt; letter-spacing: 0.3px; fill: #111111; }`));
  assert.ok(page1Svg.includes(`.subtitle { font-family: ${URTEXT_SERIF}; font-style: italic; font-size: 8.5pt; fill: #333333; }`));
  assert.ok(page1Svg.includes(`.meta { font-family: ${URTEXT_SERIF}; font-style: italic; font-size: 8pt; fill: #222222; }`));
  assert.ok(page1Svg.includes(`.section-header { font-family: ${URTEXT_SERIF}; font-style: italic; font-size: 8pt; fill: #222222; }`));
  assert.ok(page1Svg.includes(`.measure-num { font-family: ${URTEXT_SERIF}; font-style: italic; font-size: 8pt; fill: #444444; }`));
  assert.ok(!page1Svg.includes('.beat-counter'), 'Must not include .beat-counter style');

  // Title block splits the score title on ':' into main title + movement subtitle
  assert.ok(page1Svg.includes('>Goldberg Variations, BWV 988</text>'));
  assert.ok(page1Svg.includes('>Variatio 1. a 1 Clav.</text>'));
  assert.ok(page1Svg.includes('>Johann Sebastian Bach</text>'));
});

test('Deterministic horizontal layout for synthetic 32-measure score with 48 ticks/measure', () => {
  const notes: QuantizedNote[] = [];
  for (let m = 0; m < 32; m++) {
    notes.push({
      id: `test-note-${m}`,
      pitch: { pitchClass: (m * 2) % 12, octave: 4 },
      startTick: m * 48,
      durationTicks: 12,
      hand: 'RH',
    });
  }

  const score: QuantizedGridScore = {
    id: 'test-32-bar',
    title: 'Test 32 Measures Score',
    composer: 'Test Composer',
    ticksPerBeat: 12,
    totalTicks: 32 * 48,
    timeSignatures: [{ tick: 0, numerator: 4, denominator: 4 }],
    barlines: [],
    tempos: [{ tick: 0, bpm: 120 }],
    dynamics: [],
    pedals: [],
    notes,
    gridResolution: 12,
  };

  const layout = computeColumnarLayout(score);

  assert.equal(layout.totalMeasures, 32);
  assert.equal(layout.ticksPerMeasure, 48);
  assert.equal(layout.pages.length, 2, 'Two pages regardless of meter');
  assert.deepEqual(layout.pages[0].systems.map((s) => s.sysStartMeasure), [1, 5, 9, 13]);
  assert.deepEqual(layout.pages[1].systems.map((s) => s.sysStartMeasure), [17, 21, 25, 29]);

  // 4/4 → three vertical pulse lines per measure (beats 2, 3, 4) on every system
  const page1 = renderPageToSvg(layout, 0);
  const page1Lines = extractLines(page1);
  for (let s = 0; s < 4; s++) {
    const geo = getSystemGeometry(layout, 0, s);
    const staffTop = parseFloat(geo.staffTopY.toFixed(2));
    const staffBot = parseFloat(geo.staffBotY.toFixed(2));
    const beatLines = page1Lines.filter(
      (l) =>
        l.dash === '2,3' &&
        parseFloat(l.y1.toFixed(2)) === staffTop &&
        parseFloat(l.y2.toFixed(2)) === staffBot
    );
    assert.equal(beatLines.length, 12, '4/4 meter renders three vertical pulse lines per measure');
    for (const line of beatLines) assert.equal(line.x1, line.x2);
  }

  const svgs = renderAllPagesToSvg(layout);
  assert.equal(svgs.length, 2);
});
