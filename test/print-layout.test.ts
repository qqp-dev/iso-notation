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
  ACCOLADE_WIDTH_PT,
  ACCOLADE_GAP_PT,
  ACCOLADE_THICKNESS_PT,
  NOTEHEAD_KNOCKOUT_RADIUS_PT,
  OPENING_HALO_RADIUS_PT,
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
import { getPrintDurationColor } from '../src/render/types';
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
      /<path class="hand-chevron chevron-(up|down)" d="M ([-\d.]+) ([-\d.]+) L ([-\d.]+) ([-\d.]+) L ([-\d.]+) ([-\d.]+)" fill="none" stroke="([^"]+)" stroke-width="1\.20"/g
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
      new RegExp(`<circle cx="([\\d.]+)" cy="([\\d.]+)" r="${OPENING_HALO_RADIUS_PT.toFixed(2)}" fill="none" stroke="([^"]+)" stroke-width="0\\.75"\\/>`, 'g')
    )
  ).map((m) => ({ cx: parseFloat(m[1]), cy: parseFloat(m[2]), stroke: m[3] }));
}

test('Landscape 2-System Horizontal Engraving Invariant: 4-page spread for Bach Goldberg Var 1', () => {
  const score = buildBachGoldbergVar1Score();
  const layout = computeColumnarLayout(score);

  assert.equal(layout.totalMeasures, 32, 'Goldberg Var 1 has 32 measures');
  assert.equal(layout.ticksPerMeasure, TICKS_PER_MEASURE, '3/4 meter at 48 tpb = 144 ticks/measure');
  assert.equal(layout.options.orientation, 'landscape', 'Default engraving orientation is landscape');
  assert.equal(layout.measuresPerSystem, 4, 'Four measures per horizontal system');
  assert.equal(layout.systemsPerPage, 2, 'Two horizontal systems per landscape page');
  assert.equal(layout.systems.length, 8, '32 measures / 4 per system = 8 systems');
  assert.equal(layout.pages.length, 4, 'Exactly 4 pages (ceil(8 / 2) = 4)');

  // Page 1 contains Measures 1–8 across 2 systems
  assert.deepEqual(
    layout.pages[0].systems.map((s) => s.sysStartMeasure),
    [1, 5],
    'Page 1 system start measures must be [1, 5]'
  );
  // Page 2 contains Measures 9–16 across 2 systems
  assert.deepEqual(
    layout.pages[1].systems.map((s) => s.sysStartMeasure),
    [9, 13],
    'Page 2 system start measures must be [9, 13]'
  );
  // Page 3 contains Measures 17–24 across 2 systems
  assert.deepEqual(
    layout.pages[2].systems.map((s) => s.sysStartMeasure),
    [17, 21],
    'Page 3 system start measures must be [17, 21]'
  );
  // Page 4 contains Measures 25–32 across the final 2 systems
  assert.deepEqual(
    layout.pages[3].systems.map((s) => s.sysStartMeasure),
    [25, 29],
    'Page 4 system start measures must be [25, 29]'
  );

  assert.deepEqual(layout.pages[0].systems.map((s) => s.endMeasure), [4, 8]);
  assert.deepEqual(layout.pages[1].systems.map((s) => s.endMeasure), [12, 16]);
  assert.deepEqual(layout.pages[2].systems.map((s) => s.endMeasure), [20, 24]);
  assert.deepEqual(layout.pages[3].systems.map((s) => s.endMeasure), [28, 32]);

  for (const system of layout.systems) {
    assert.equal(system.endMeasure - system.startMeasure + 1, 4, 'Every system spans 4 measures');
    assert.equal(system.startTick, (system.startMeasure - 1) * TICKS_PER_MEASURE);
    assert.equal(system.endTick, system.endMeasure * TICKS_PER_MEASURE);
    assert.equal(system.sysStartMeasure, system.startMeasure);
    assert.equal(system.systemOnPageIndex, system.systemIndex % 2);
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
  assert.match(layout.pages[0].sectionName, /Section A.*1.*8/);
  assert.match(layout.pages[1].sectionName, /Section B.*9.*16/);
  assert.match(layout.pages[2].sectionName, /Section C.*17.*24/);
  assert.match(layout.pages[3].sectionName, /Section D.*25.*32/);

  // All 4 pages render as standalone landscape SVGs
  const svgs = renderAllPagesToSvg(layout);
  assert.equal(svgs.length, 4, 'renderAllPagesToSvg must produce exactly 4 pages');
  for (const svg of svgs) {
    assert.match(svg, /<rect[^>]*width="100%"[^>]*height="100%"[^>]*fill="#FFFFFF"/);
    // Zero footer fluff
    assert.doesNotMatch(svg, /<g id="page-footer">/);
  }

  // A4 Landscape geometry: 841.89pt × 595.28pt with 2 un-cramped systems (staffHeight 204pt)
  assert.ok(Math.abs(layout.pageDimensions.widthPt - A4_HEIGHT_PT) < 0.01);
  assert.ok(Math.abs(layout.pageDimensions.heightPt - A4_WIDTH_PT) < 0.01);
  assert.ok(Math.abs(layout.systemDimensions.staffHeightPt - 48 * layout.ptPerSemitone) < 0.01);
  assert.ok(Math.abs(layout.ptPerSemitone - 4.25) < 0.01, `Pitch lane height must be 4.25pt (got ${layout.ptPerSemitone})`);
  assert.ok(
    layout.systemDimensions.measureWidthPt > 180 && layout.systemDimensions.measureWidthPt < 205,
    'Each of the 4 landscape measures spans ~184pt'
  );
});

test('Classical Vertical Accolade Invariant: 14pt curly brace clasping o1–o5 on the left margin', () => {
  const score = buildBachGoldbergVar1Score();
  const layout = computeColumnarLayout(score);
  const svgs = renderAllPagesToSvg(layout);

  // Classical curly brace proportions: 14.0pt reach, 1.45pt swell, 34.0pt margin gap
  assert.equal(ACCOLADE_WIDTH_PT, 14.0, 'Accolade reach must be 14.0pt');
  assert.equal(ACCOLADE_THICKNESS_PT, 1.45, 'Accolade swell must be 1.45pt');
  assert.equal(ACCOLADE_GAP_PT, 34.0, 'Accolade gap must be 34.0pt');

  // The exported path generator is deterministic and spans the requested vertical range
  const direct = getVerticalAccoladePath(65.0, 106.35, 231.15, 8.0, 14.0, 1.45);
  assert.match(direct, /^M [\d.]+ [\d.]+ C /);
  assert.match(direct, / Z$/);
  const directPoints = parsePathPoints(direct);
  assert.ok(Math.abs(Math.min(...directPoints.map((p) => p.y)) - 106.35) < 0.01);
  assert.ok(Math.abs(Math.max(...directPoints.map((p) => p.y)) - 231.15) < 0.01);
  const directWidth = Math.max(...directPoints.map((p) => p.x)) - Math.min(...directPoints.map((p) => p.x));
  assert.ok(directWidth <= 15, `Classical accolade width must be <= 15pt (got ${directWidth})`);

  const marginPt = layout.options.pageMarginMm * MM_TO_PT;

  for (let pageIndex = 0; pageIndex < layout.pages.length; pageIndex++) {
    const systemCount = layout.pages[pageIndex].systems.length;
    const accolades = extractAccolades(svgs[pageIndex]);
    assert.equal(accolades.length, systemCount, `Page ${pageIndex + 1} must render one accolade per system`);

    for (let s = 0; s < systemCount; s++) {
      const geo = getSystemGeometry(layout, pageIndex, s);
      const path = accolades[s];
      assert.match(path, /^M [\d.]+ [\d.]+ C [^"]+ Z$/, 'Accolade must be a closed sculptural path');
      assert.equal(
        path,
        getVerticalAccoladePath(geo.staffLeftPt, geo.staffTopY, geo.staffBotY, 8.0, ACCOLADE_WIDTH_PT, ACCOLADE_THICKNESS_PT),
        'Rendered accolade must use the classical 14.0pt / 1.45pt curly brace geometry'
      );

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
        Math.abs(geo.staffBotY - geo.staffTopY - geo.staffHeightPt) < 0.01,
        'Accolade must span the full 4-octave staff (o1 → o5)'
      );

      // The central cusp is the leftmost point of the brace and points into Middle C
      const y48 = geo.yForPitch(48);
      const cuspPoints = points.filter((p) => Math.abs(p.x - minX) < 0.01);
      assert.ok(
        cuspPoints.some((p) => Math.abs(p.y - y48) < 0.01),
        `Accolade cusp must point at Middle C y(48) = ${y48.toFixed(2)}`
      );
      assert.ok(
        Math.abs(y48 - (geo.staffTopY + geo.staffBotY) / 2) < 0.01,
        'Middle C must sit dead-center of the 4-octave staff'
      );

      // Brace tips clasp the open staff at staffLeftPt
      assert.ok(Math.abs(maxX - geo.staffLeftPt) < 0.01, 'Accolade tips must clasp the staff at staffLeft');
      assert.ok(minX > 0, 'Accolade must remain inside the paper');
      assert.ok(
        Math.abs(geo.staffLeftPt - (marginPt + ACCOLADE_WIDTH_PT + ACCOLADE_GAP_PT)) < 0.01,
        'The staff must open exactly one accolade + gap from the margin'
      );

      // Classical curly brace aspect ratio (~1:14 to 1:20)
      const width = maxX - minX;
      const aspect = (geo.staffBotY - geo.staffTopY) / width;
      assert.ok(aspect > 10 && aspect < 30, `Accolade aspect ratio must be elegant (got 1:${aspect.toFixed(1)})`);
    }
  }
});

test('Horizontal Staff Topography Invariant: Middle C spine, octave lines, landmark dashes, vertical barlines & beat grid', () => {
  const score = buildBachGoldbergVar1Score();
  const layout = computeColumnarLayout(score);
  const page1 = renderPageToSvg(layout, 0);
  const lines = extractLines(page1);
  const round2 = (v: number) => parseFloat(v.toFixed(2));

  for (let s = 0; s < layout.pages[0].systems.length; s++) {
    const geo = getSystemGeometry(layout, 0, s);
    const staffTop = round2(geo.staffTopY);
    const staffBot = round2(geo.staffBotY);

    // 1. Middle C (p = 48): bold horizontal center spine (1.35pt, #000000)
    const spineLines = lines.filter(
      (l) => l.y1 === l.y2 && l.stroke === '#000000' && l.width === '1.35' && round2(l.y1) === round2(geo.yForPitch(48))
    );
    assert.equal(spineLines.length, 1, `System ${s + 1} must render one 1.35pt Middle C spine`);
    assert.ok(Math.abs(spineLines[0].x1 - geo.staffLeftPt) < 0.01, 'Spine must emerge cleanly from the accolade at the staff head');
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

    // 5. Zero Starting System Barline: the staff emerges openly from the accolade,
    //    with no heavy 1.2pt vertical staff-bounding line at the head of the system
    const openingBarlines = lines.filter(
      (l) =>
        l.x1 === l.x2 &&
        l.width === '1.2' &&
        round2(l.x1) === round2(geo.staffLeftPt) &&
        round2(l.y1) === staffTop &&
        round2(l.y2) === staffBot
    );
    assert.equal(openingBarlines.length, 0, `System ${s + 1} must NOT open with a staff-bounding barline`);
    assert.ok(
      !page1.includes(`<line x1="${geo.staffLeftPt.toFixed(2)}" y1="${staffTop.toFixed(2)}" x2="${geo.staffLeftPt.toFixed(2)}" y2="${staffBot.toFixed(2)}" stroke="#111827" stroke-width="1.2"/>`),
      'Page SVG must not contain the abandoned 1.2pt starting barline'
    );

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

  // 7. System-Start-Only Urtext measure numbering: one numeral per system only
  const measureNumbers = Array.from(page1.matchAll(/class="measure-num">(\d+)<\/text>/g)).map((m) => Number(m[1]));
  assert.deepEqual(
    measureNumbers,
    [1, 5],
    'Page 1 must number only the first measure of each system (m. 1, 5)'
  );
  for (const internal of [2, 3, 4, 6, 7, 8]) {
    assert.ok(
      !page1.includes(`class="measure-num">${internal}</text>`),
      `Internal measure ${internal} must NOT render a measure counter`
    );
  }

  // 8. Authentic Urtext Middle C badge (o3) and octave boundary indicators (o1, o5)
  assert.match(page1, />o1</);
  assert.match(page1, />o3</);
  assert.match(page1, />o5</);
  assert.match(page1, /class="octave-badge-text"/);
  assert.match(page1, /class="octave-boundary-text"/);
  assert.doesNotMatch(page1, /class="pitch-label"/);
  assert.doesNotMatch(page1, /class="time-sig"/);
  assert.doesNotMatch(page1, /class="beat-counter"/);
});

test('Authoritative Up/Down Handedness Chevron Invariant: 4.2 × 2.8pt chevrons at 1.20pt stroke', () => {
  const score = buildBachGoldbergVar1Score();
  const layout = computeColumnarLayout(score);
  const pages = renderAllPagesToSvg(layout);
  const page1Chevrons = extractChevrons(pages[0]);
  const page4Chevrons = extractChevrons(pages[3]);
  const allChevrons = pages.flatMap((svg) => extractChevrons(svg));
  const round2 = (v: number) => parseFloat(v.toFixed(2));

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

    // Authoritative scale: 4.2pt wide, 2.8pt tall, centered 2.0pt clear of the knockout
    assert.equal(round2(Math.abs(chevron.rightX - chevron.leftX)), 4.2, 'Chevron width must be 4.2pt');
    assert.equal(round2(chevron.baseY1 - chevron.apexY), 2.8, 'Chevron height must be 2.8pt');
  }

  // Measure 30 (system 2 of page 4): LH crossing into the treble
  const geo30 = getSystemGeometry(layout, 3, 1);
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
    const cDx = note.id === 'bach-var1-510' ? -4.2 : 0;
    const nx = parseFloat((geo30.xForTick(note.startTick) + cDx).toFixed(2));
    const ny = parseFloat(geo30.yForPitch(linearIndex(note.pitch)).toFixed(2));
    const chevron = page4Chevrons.find(
      (c) => c.direction === 'down' && Math.abs(c.apexX - nx) < 0.01 && Math.abs(c.apexY - ny) < 20
    );
    assert.ok(chevron, `Measure 30 note ${note.id} (p=${linearIndex(note.pitch)}) must render a downward chevron`);
    assert.ok(chevron.apexY > chevron.baseY1, 'Downward chevron must have its apex below the base (∨)');
    assert.ok(chevron.apexY > ny, 'Downward chevron must sit below the notehead');
    assert.ok(Math.abs(chevron.apexX - nx) < 0.01, 'Chevron must be horizontally centered on the notehead');
    assert.equal(round2(Math.abs(chevron.rightX - chevron.leftX)), 4.2, 'Chevron width must be 4.2pt');
    assert.equal(round2(chevron.apexY - chevron.baseY1), 2.8, 'Chevron height must be 2.8pt');
  }

  // Every chevron is rendered with the authoritative 1.20pt round-capped stroke and protective shield
  const authoritativeChevrons = pages.flatMap((svg) =>
    Array.from(
      svg.matchAll(
        /<path class="hand-chevron chevron-(?:up|down)" d="M [-\d.]+ [-\d.]+ L [-\d.]+ [-\d.]+ L [-\d.]+ [-\d.]+" fill="none" stroke="[^"]+" stroke-width="1\.20" stroke-linecap="round" stroke-linejoin="round"\/>/g
      )
    )
  );
  assert.equal(authoritativeChevrons.length, allChevrons.length, 'Every chevron must use the 1.20pt round stroke');

  const shields = pages.flatMap((svg) =>
    Array.from(
      svg.matchAll(
        /<path class="hand-chevron-shield" d="M [-\d.]+ [-\d.]+ L [-\d.]+ [-\d.]+ L [-\d.]+ [-\d.]+ Z" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="2\.20" stroke-linecap="round" stroke-linejoin="round"\/>/g
      )
    )
  );
  assert.equal(shields.length, allChevrons.length, 'Every chevron must have a protective shield from staff lines');

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

test('Flush Duration Hold Lines & Subsequent Note Clipping Invariant', () => {
  const score = buildBachGoldbergVar1Score();
  const layout = computeColumnarLayout(score);
  const svgs = renderAllPagesToSvg(layout);
  const tauRef = score.gridResolution || 12;
  const round2 = (v: number) => parseFloat(v.toFixed(2));
  const pc12 = (p: number) => ((p % 12) + 12) % 12;

  const holdLines = svgs.flatMap((svg) =>
    extractLines(svg).filter(
      (l) => DURATION_COLORS.includes(l.stroke) && (l.cap === 'butt' || l.cap === 'round')
    )
  );
  assert.ok(holdLines.length > 0, 'Must render duration hold lines');

  // Reconstruct the exact expected trail geometry from the engraving rules:
  // flush against the effective circular boundary, clipped clear of the next
  // same-pitch onset, butt-capped on staff lines, round-capped + 0.4pt in open space.
  const expectedTrails = layout.systems.flatMap((system) => {
    const geo = getSystemGeometry(layout, system.pageIndex, system.systemOnPageIndex);
    const notesByTickInSys = new Map<number, QuantizedNote[]>();
    for (const note of system.notes) {
      if (!notesByTickInSys.has(note.startTick)) notesByTickInSys.set(note.startTick, []);
      notesByTickInSys.get(note.startTick)!.push(note);
    }
    const clusterOffsetMap = new Map<string, number>();
    for (const [, tickNotes] of notesByTickInSys.entries()) {
      if (tickNotes.length <= 1) continue;
      tickNotes.sort((a, b) => linearIndex(a.pitch) - linearIndex(b.pitch));
      for (let i = 0; i < tickNotes.length - 1; i++) {
        const p1 = linearIndex(tickNotes[i].pitch);
        const p2 = linearIndex(tickNotes[i + 1].pitch);
        if (p2 - p1 <= 3) {
          clusterOffsetMap.set(tickNotes[i].id, -4.2);
          clusterOffsetMap.set(tickNotes[i + 1].id, 4.2);
        }
      }
    }

    const trails: { x1: number; x2: number; y: number; stroke: string; width: string; cap: string }[] = [];
    for (const note of system.notes) {
      if (note.durationTicks <= tauRef) continue;
      const lp = linearIndex(note.pitch);
      const cDx = clusterOffsetMap.get(note.id) ?? 0;
      const nx = geo.xForTick(note.startTick) + cDx;
      const ny = geo.yForPitch(lp);
      const effectiveRadius = note.startTick === 0 ? OPENING_HALO_RADIUS_PT : NOTEHEAD_KNOCKOUT_RADIUS_PT;
      let holdStartX = nx + effectiveRadius;
      let holdEndX = Math.min(nx + note.durationTicks * geo.ptPerTick, geo.staffRightPt);

      let nextOnsetTick: number | null = null;
      for (const other of system.notes) {
        if (linearIndex(other.pitch) !== lp || other.startTick <= note.startTick) continue;
        if (nextOnsetTick === null || other.startTick < nextOnsetTick) nextOnsetTick = other.startTick;
      }
      if (nextOnsetTick !== null) {
        const otherDx = clusterOffsetMap.get(system.notes.find(o => linearIndex(o.pitch) === lp && o.startTick === nextOnsetTick)?.id ?? '') ?? 0;
        holdEndX = Math.min(holdEndX, geo.xForTick(nextOnsetTick) + otherDx - NOTEHEAD_KNOCKOUT_RADIUS_PT - 1.0);
      }

      if (pc12(lp) === 0) {
        if (holdEndX - holdStartX < 1.5) continue;
        trails.push({
          x1: round2(holdStartX),
          x2: round2(holdEndX),
          y: round2(ny),
          stroke: getPrintDurationColor(note.durationTicks, tauRef),
          width: lp === 48 ? '1.35' : '0.65',
          cap: 'butt',
        });
      } else {
        holdStartX = nx + effectiveRadius + 0.4;
        if (holdEndX - holdStartX < 1.5) continue;
        trails.push({
          x1: round2(holdStartX),
          x2: round2(holdEndX),
          y: round2(ny),
          stroke: getPrintDurationColor(note.durationTicks, tauRef),
          width: '0.80',
          cap: 'round',
        });
      }
    }
    return trails;
  });

  // Every colored note (duration > tauRef) is represented by exactly one flush trail
  const coloredNotes = score.notes.filter((n) => n.durationTicks > tauRef);
  assert.equal(coloredNotes.length, 165, 'Goldberg Var 1 has exactly 165 colored (8th+) notes');
  assert.equal(holdLines.length, coloredNotes.length, 'Every colored note must render one hold line');
  assert.equal(expectedTrails.length, holdLines.length, 'Every trail must obey the flush/clipping geometry');

  for (const expected of expectedTrails) {
    const match = holdLines.find(
      (l) =>
        round2(l.x1) === expected.x1 &&
        round2(l.x2) === expected.x2 &&
        round2(l.y1) === expected.y &&
        l.stroke === expected.stroke &&
        l.width === expected.width &&
        l.cap === expected.cap
    );
    assert.ok(
      match,
      `Missing flush trail x1=${expected.x1} x2=${expected.x2} y=${expected.y} ${expected.width}pt ${expected.cap}`
    );
    assert.equal(match.y1, match.y2, 'Duration trails must extend horizontally (y1 === y2)');
    assert.ok(match.x2 > match.x1, 'Duration trails must extend to the right (x2 > x1)');
  }

  // Every trail stays inside the staff bounds of its own system
  for (const line of holdLines) {
    assert.ok(line.x1 >= 0, 'Trails must begin inside the paper');
    assert.ok(line.x2 <= layout.pageDimensions.widthPt, 'Trails must stay inside the page');
  }

  // Zero vertical trails from the defunct columnar layout
  const verticalColoredLines = svgs.flatMap((svg) =>
    extractLines(svg).filter((l) => DURATION_COLORS.includes(l.stroke) && l.x1 === l.x2)
  );
  assert.equal(verticalColoredLines.length, 0, 'Must render zero vertical duration trails');

  // Bar 6 Middle C note bach-var1-97 (tick 816, dur 24): starts flush at the
  // 4.80pt knockout, and is clipped clear of note 99 (same pitch, tick 840)
  const geo97 = getSystemGeometry(layout, 0, 1); // mm. 5–8 system
  const note97 = score.notes.find((n) => n.id === 'bach-var1-97')!;
  assert.equal(linearIndex(note97.pitch), 48, 'Note 97 must sit on Middle C');
  const cDx97 = 4.2; // shifted right by cluster collision with note 96 at tick 816
  const nx97 = geo97.xForTick(note97.startTick) + cDx97;
  const ny97 = geo97.yForPitch(48);
  const expectedHoldStartX = round2(nx97 + NOTEHEAD_KNOCKOUT_RADIUS_PT);
  const nextNx97 = geo97.xForTick(note97.startTick + note97.durationTicks);
  const expectedHoldEndX = round2(nextNx97 - NOTEHEAD_KNOCKOUT_RADIUS_PT - 1.0);
  assert.ok(expectedHoldEndX < round2(nextNx97), 'The m. 6 Middle C tail must stop short of the next note');

  assert.match(
    renderPageToSvg(layout, 0),
    new RegExp(
      `<line x1="${expectedHoldStartX.toFixed(2)}" y1="${ny97.toFixed(2)}" x2="${expectedHoldEndX.toFixed(2)}" y2="${ny97.toFixed(2)}" stroke="#1D4ED8" stroke-width="1.35" stroke-linecap="butt"/>`
    ),
    'Bar 6 Middle C note 97 must render a continuous Royal Blue hold line flush to its knockout'
  );

  // The m. 6 pitch-48 trail clears note 99's knockout circle entirely
  const note99 = score.notes.find((n) => n.id === 'bach-var1-99')!;
  assert.equal(linearIndex(note99.pitch), 48, 'Note 99 must also sit on Middle C');
  const note99KnockoutLeftX = geo97.xForTick(note99.startTick) - NOTEHEAD_KNOCKOUT_RADIUS_PT;
  assert.ok(
    expectedHoldEndX < note99KnockoutLeftX,
    'The m. 6 Middle C tail must not cut into the following note knockout'
  );

  // The opening tick-0 note starts flush at the 5.80pt halo ring (+0.4pt round cap)
  const openingColored = score.notes.find((n) => n.startTick === 0 && n.durationTicks > tauRef)!;
  const geoOpening = getSystemGeometry(layout, 0, 0);
  const openingLp = linearIndex(openingColored.pitch);
  const openingStartX = round2(geoOpening.xForTick(0) + OPENING_HALO_RADIUS_PT + 0.4);
  const openingTrail = holdLines.find(
    (l) => round2(l.x1) === openingStartX && round2(l.y1) === round2(geoOpening.yForPitch(openingLp))
  );
  assert.ok(openingTrail, 'The opening tick-0 sound must start flush at the halo ring');
  assert.equal(openingTrail.cap, 'round', 'Opening halo trail uses the round cap');
  assert.equal(openingTrail.width, '0.80', 'Opening halo trail is a thin 0.80pt line');

  // Open-space trails are thin and round-capped; staff-line trails are butt-capped
  const spaceTrails = holdLines.filter((l) => l.cap === 'round');
  const lineTrails = holdLines.filter((l) => l.cap === 'butt');
  assert.ok(spaceTrails.length > 0, 'Open-space trails must use round line caps');
  assert.ok(lineTrails.length > 0, 'Staff-line trails must use butt line caps');
  for (const trail of spaceTrails) assert.equal(trail.width, '0.80', 'Open-space trails are 0.80pt');
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
      new RegExp(`<circle cx="${halo.cx.toFixed(2)}" cy="${halo.cy.toFixed(2)}" r="${NOTEHEAD_KNOCKOUT_RADIUS_PT.toFixed(2)}" fill="#FFFFFF"/>`),
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
  const pages = renderAllPagesToSvg(layout);

  // Pages 1, 2, 3 (mm. 1–24) stay within the 4-octave core: no outlier lines above o5
  for (let p = 0; p < 3; p++) {
    const pageSvg = pages[p];
    for (let s = 0; s < layout.pages[p].systems.length; s++) {
      const geo = getSystemGeometry(layout, p, s);
      const y76 = parseFloat(geo.yForPitch(76).toFixed(2));
      const aboveStaff = extractLines(pageSvg).filter(
        (l) => l.dash === '5,2.5' && parseFloat(l.y1.toFixed(2)) === y76
      );
      assert.equal(aboveStaff.length, 0, `Page ${p + 1} system ${s + 1} must not render outlier lines above o5`);
    }
  }

  // Page 4 system 1 (mm. 25–28) also stays within the core
  const geoM25 = getSystemGeometry(layout, 3, 0);
  const y76M25 = parseFloat(geoM25.yForPitch(76).toFixed(2));
  assert.equal(
    extractLines(pages[3]).filter((l) => l.dash === '5,2.5' && parseFloat(l.y1.toFixed(2)) === y76M25).length,
    0,
    'Page 4 system 1 (mm. 25–28) must not render outlier lines above o5'
  );

  // Page 4 system 2 (mm. 29–32) contains D6 (pitch 74) in mm. 29–30 → local dashed line at pitch 76.
  const geoLast = getSystemGeometry(layout, 3, 1);
  const y76 = parseFloat(geoLast.yForPitch(76).toFixed(2));
  const outlierLines = extractLines(pages[3]).filter(
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
  assert.match(
    svgs[0],
    new RegExp(`<circle cx="[\\d.]+" cy="[\\d.]+" r="${NOTEHEAD_KNOCKOUT_RADIUS_PT.toFixed(2)}" fill="#FFFFFF"\\/>`)
  );
  assert.match(svgs[0], />7<\/text>/, 'Must render G as 7');
  assert.match(svgs[0], />B<\/text>/, 'Must render B as B');
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

test('A4 & Letter Landscape Print Dimensions Invariant', () => {
  const score = buildBachGoldbergVar1Score();
  const layout = computeColumnarLayout(score, { pageMarginMm: 10 });

  // A4 landscape point dimensions: 841.89 pt × 595.28 pt
  assert.equal(Math.round(layout.pageDimensions.widthPt * 100) / 100, Math.round(A4_HEIGHT_PT * 100) / 100);
  assert.equal(Math.round(layout.pageDimensions.heightPt * 100) / 100, Math.round(A4_WIDTH_PT * 100) / 100);
  assert.equal(layout.options.orientation, 'landscape');

  const marginPt = 10 * MM_TO_PT;
  const printableWidth = A4_HEIGHT_PT - 2 * marginPt;
  assert.ok(printableWidth > 780 && printableWidth < 790);

  // The system staff spans the printable width minus the accolade margin (7pt + 7pt)
  const expectedStaffWidth = printableWidth - ACCOLADE_WIDTH_PT - ACCOLADE_GAP_PT;
  assert.ok(
    Math.abs(layout.systemDimensions.widthPt - expectedStaffWidth) < 0.01,
    `Horizontal system width must claim the printable width (got ${layout.systemDimensions.widthPt})`
  );
  assert.ok(
    Math.abs(layout.systemDimensions.measureWidthPt - expectedStaffWidth / 4) < 0.01,
    'Landscape measures must claim ~192pt each'
  );

  // Letter landscape forms a 4-page spread (2 systems per page)
  const letterLayout = computeColumnarLayout(score, { paperSize: 'letter' });
  assert.equal(letterLayout.pageDimensions.widthPt, LETTER_HEIGHT_PT);
  assert.equal(letterLayout.pageDimensions.heightPt, LETTER_WIDTH_PT);
  assert.equal(letterLayout.pages.length, 4);
  assert.equal(letterLayout.pages[0].systems.length, 2);
  assert.equal(letterLayout.pages[3].systems.length, 2);
  const letterGeo = getSystemGeometry(letterLayout, 0, 0);
  assert.ok(letterGeo.staffBotY < LETTER_WIDTH_PT - 17.0, 'Last system must stay inside the printable letter page');
  assert.ok(letterGeo.staffTopY > 17.0 + 18.0);
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

test('Network Laser Printing Pipeline: 4-page landscape PostScript & PJL wrapping', async () => {
  // Test generating vector PostScript from benchmark score (defaulting to Letter for US printer tray)
  const { psBuffer, layout } = await generateScorePostscript('bach-goldberg-var1');

  assert.equal(layout.pageDimensions.widthPt, 792, 'Letter landscape width must be 792 pt');
  assert.equal(layout.pageDimensions.heightPt, 612, 'Letter landscape height must be 612 pt');
  assert.equal(layout.pages.length, 4, 'Horizontal landscape engraving must yield a 4-page spread');

  assert.ok(psBuffer.length > 10000, 'PostScript buffer must be generated and non-trivial');
  const psText = psBuffer.toString('binary', 0, 1000);
  assert.match(psText, /%!PS-Adobe/);

  // Check multi-page emission (%%Pages: 4)
  const fullPs = psBuffer.toString('binary');
  assert.match(fullPs, /%%Pages:\s*4/);

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

  // Title block uses single-line layout with title and composer
  assert.ok(page1Svg.includes('>Goldberg Variations, BWV 988 · Variatio 1. a 1 Clav.</text>'));
  assert.ok(page1Svg.includes('>Johann Sebastian Bach</text>'));
});

test('Clean Urtext Header & Footer Invariant: pure white breathing room, zero tacky rules, zero footer fluff', () => {
  const score = buildBachGoldbergVar1Score();
  const layout = computeColumnarLayout(score);
  const pages = renderAllPagesToSvg(layout);
  const marginPt = layout.options.pageMarginMm * MM_TO_PT;

  for (let p = 0; p < pages.length; p++) {
    const svg = pages[p];

    // No corporate header divider and zero footer element
    assert.doesNotMatch(svg, /<line[^>]*stroke="#CCCCCC"/, `Page ${p + 1} must not contain the #CCCCCC header rule`);
    assert.doesNotMatch(svg, /<line[^>]*stroke="#E5E7EB"/, `Page ${p + 1} must not contain the #E5E7EB footer rule`);
    assert.doesNotMatch(svg, /<g id="page-footer">/, `Page ${p + 1} must not contain any page footer element`);
    assert.doesNotMatch(svg, /Page \d+ of \d+/, `Page ${p + 1} must have zero footer page numbering`);

    // Single-line header: left-aligned title/subtitle and right-aligned composer/section
    if (p === 0) {
      assert.match(svg, new RegExp(`<text x="${marginPt.toFixed(2)}"[^>]*class="title">Goldberg Variations`));
      assert.match(svg, new RegExp(`<text x="${(layout.pageDimensions.widthPt - marginPt).toFixed(2)}"[^>]*class="meta" text-anchor="end">Johann Sebastian Bach</text>`));
    } else {
      assert.match(svg, new RegExp(`<text x="${marginPt.toFixed(2)}"[^>]*class="subtitle">`));
      assert.match(svg, new RegExp(`<text x="${(layout.pageDimensions.widthPt - marginPt).toFixed(2)}"[^>]*class="section-header" text-anchor="end">`));
    }
  }
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
  assert.equal(layout.pages.length, 4, 'Four pages for 32 measures with 2 systems per page');
  assert.deepEqual(layout.pages[0].systems.map((s) => s.sysStartMeasure), [1, 5]);
  assert.deepEqual(layout.pages[1].systems.map((s) => s.sysStartMeasure), [9, 13]);
  assert.deepEqual(layout.pages[2].systems.map((s) => s.sysStartMeasure), [17, 21]);
  assert.deepEqual(layout.pages[3].systems.map((s) => s.sysStartMeasure), [25, 29]);

  // 4/4 → three vertical pulse lines per measure (beats 2, 3, 4) on every system
  const page1 = renderPageToSvg(layout, 0);
  const page1Lines = extractLines(page1);
  for (let s = 0; s < layout.pages[0].systems.length; s++) {
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
  assert.equal(svgs.length, 4);
});
