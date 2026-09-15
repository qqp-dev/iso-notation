/**
 * Round 20 — the four settled changes, audited on the engraving itself.
 *
 *  1. **Optical rest seats**: the painted ink centroid stands on the seat point
 *     (the beat column, and the phrase row / the bar forms' own seat line). The
 *     centroid here is recomputed **from the emitted SVG primitives**, so the
 *     test never trusts the model that placed the glyph.
 *  2. **The urtext re-cut + the whole bar**: the classical cut's proportions,
 *     the half slab atop its row, the whole slab hanging below its own.
 *  3. **The unison merge**: one onset + one pitch = one digit, with every
 *     mixed-duration rhythm voice intact, and a violation fixture proving the
 *     `unison-double-digit` defect class can never return silently.
 *  4. **The clasp nib**: every dotted clasp's dot is a clean satellite of its
 *     mark, the note dots never moved, and the retired fused geometry is caught
 *     by `clasp-dot-fusion`.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1';
import {
  BRAHMS_OP118_NO1_JANKO_OPTIONS,
  BRAHMS_OP118_NO1_JANKO_TOKENS,
  buildBrahmsOp118No1Score,
} from '../src/scores/brahms-op118-no1';
import {
  REST_DURATION_SPECIMEN_JANKO_OPTIONS,
  REST_DURATION_SPECIMEN_JANKO_TOKENS,
  buildRestDurationSpecimenScore,
} from '../src/scores/rest-duration-specimen';
import {
  DEFAULT_JANKO_OPTIONS,
  DEFAULT_JANKO_TOKENS,
  JANKO_REST_STYLES,
  resolveJankoOptions,
  resolveJankoTokens,
} from '../src/render/janko/types';
import {
  JankoRestGeometry,
  JANKO_REST_VALUES,
  renderRest,
  restInkBox,
  restSeatOffsetY,
} from '../src/render/janko/elements/rests';
import {
  checkClaspDotFusion,
  checkRestSeat,
  checkUnisonDigits,
  lintJankoScore,
} from '../src/render/janko/linter';
import { DEFAULT_JANKO_LINT_OPTIONS, JankoLintOptions, LintViolation } from '../src/render/janko/linter';
import {
  getStemGeometry,
  getSubdivisionGlyphBBox,
  subdivisionMarkCount,
} from '../src/render/janko/elements/rhythm';
import { JankoSystemLayout, layoutJankoScore, renderSystem } from '../src/render/janko/engine';

const T = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
const BACH = buildBachGoldbergVar1Score();
const BRAHMS = buildBrahmsOp118No1Score();
const REST_SPECIMEN = buildRestDurationSpecimenScore();
const LINT: JankoLintOptions = DEFAULT_JANKO_LINT_OPTIONS;

/** Numeric attribute of one SVG tag. */
function num(tag: string, key: string): number {
  const m = new RegExp(`${key}="(-?[\\d.]+)"`).exec(tag);
  assert.ok(m, `${key} present in ${tag.slice(0, 60)}`);
  return Number(m![1]);
}

/** Every `x y` pair of a path's `d`, control points included. */
function pathPoints(d: string): Array<[number, number]> {
  return [...d.matchAll(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)].map((m) => [
    Number(m[1]),
    Number(m[2]),
  ]);
}

/** Sample one cubic segment into `steps` spans. */
function sampleCubic(
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
  steps = 32
): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    out.push([
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ]);
  }
  return out;
}

/**
 * The ink centroid of one rendered rest group, **independently** recomputed
 * from its SVG primitives: strokes weigh their sampled length times their
 * width, fills their polygon area, and a rect / ellipse centres on itself.
 */
function paintedCentroid(groupSvg: string): { x: number; y: number } {
  let weight = 0;
  let sx = 0;
  let sy = 0;
  const add = (x: number, y: number, w: number): void => {
    if (!(w > 1e-9)) return;
    weight += w;
    sx += x * w;
    sy += y * w;
  };
  const lineCentroid = (pts: Array<[number, number]>): { x: number; y: number; length: number } => {
    let length = 0;
    let lx = 0;
    let ly = 0;
    for (let i = 1; i < pts.length; i++) {
      const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      length += l;
      lx += ((pts[i][0] + pts[i - 1][0]) / 2) * l;
      ly += ((pts[i][1] + pts[i - 1][1]) / 2) * l;
    }
    return length > 0 ? { x: lx / length, y: ly / length, length } : { x: 0, y: 0, length: 0 };
  };
  const polygonCentroid = (pts: Array<[number, number]>): { x: number; y: number; area: number } => {
    let area = 0;
    let cx = 0;
    let cy = 0;
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i];
      const [bx, by] = pts[(i + 1) % pts.length];
      const cross = ax * by - bx * ay;
      area += cross;
      cx += (ax + bx) * cross;
      cy += (ay + by) * cross;
    }
    area /= 2;
    if (Math.abs(area) < 1e-12) return { x: 0, y: 0, area: 0 };
    return { x: cx / (6 * area), y: cy / (6 * area), area: Math.abs(area) };
  };

  for (const element of groupSvg.matchAll(/<(line|path|rect|ellipse)\b[^>]*\/>/g)) {
    const tag = element[0];
    if (tag.startsWith('<line')) {
      const a: [number, number] = [num(tag, 'x1'), num(tag, 'y1')];
      const b: [number, number] = [num(tag, 'x2'), num(tag, 'y2')];
      const { x, y, length } = lineCentroid([a, b]);
      add(x, y, length * num(tag, 'stroke-width'));
      continue;
    }
    if (tag.startsWith('<rect')) {
      const w = num(tag, 'width');
      const h = num(tag, 'height');
      const weight = /fill="#(111111|1A1A1A)"/.test(tag) ? w * h : 2 * (w + h) * num(tag, 'stroke-width');
      add(num(tag, 'x') + w / 2, num(tag, 'y') + h / 2, weight);
      continue;
    }
    if (tag.startsWith('<ellipse')) {
      const rx = num(tag, 'rx');
      const ry = num(tag, 'ry');
      const weight = /fill="#(111111|1A1A1A)"/.test(tag)
        ? Math.PI * rx * ry
        : Math.PI * (rx + ry) * num(tag, 'stroke-width');
      add(num(tag, 'cx'), num(tag, 'cy'), weight);
      continue;
    }
    const d = / d="([^"]+)"/.exec(tag)![1];
    const filled = /fill="#(111111|1A1A1A)"/.test(tag);
    const width = /stroke-width/.test(tag) ? num(tag, 'stroke-width') : 0;
    const tokens = d.match(/[MCLZ][^MCLZ]*/g) ?? [];
    const points: Array<[number, number]> = [];
    let cursor: [number, number] = [0, 0];
    for (const token of tokens) {
      const coords = pathPoints(token);
      if (token.startsWith('M')) {
        cursor = coords[0];
        points.push(cursor);
      } else if (token.startsWith('L')) {
        points.push(coords[0]);
        cursor = coords[0];
      } else if (token.startsWith('C')) {
        const sampled = sampleCubic(cursor, coords[0], coords[1], coords[2]);
        points.push(...sampled.slice(1));
        cursor = coords[2];
      }
    }
    const closed = /Z\s*$/.test(d);
    if (filled && closed) {
      const { x, y, area } = polygonCentroid(points);
      add(x, y, area);
    } else {
      const polyline = closed ? [...points, points[0]] : points;
      const { x, y, length } = lineCentroid(polyline);
      add(x, y, length * width);
    }
  }
  assert.ok(weight > 0, 'the glyph paints real ink');
  return { x: sx / weight, y: sy / weight };
}

/** The `<g class="janko-rest-group" …>…</g>` markup of one rendered rest. */
function restGroupSvg(rest: JankoRestGeometry, tokens = T): string {
  const svg = renderRest(rest, tokens);
  const at = svg.indexOf('<g class="janko-rest-group"');
  const end = svg.indexOf('</g>', at);
  return svg.slice(at, end);
}

// ---------------------------------------------------------------------------
// 1. Optical seats
// ---------------------------------------------------------------------------

test('Optical seats: the painted centroid stands on the seat point — every value, every dialect', () => {
  for (const style of JANKO_REST_STYLES) {
    for (const value of JANKO_REST_VALUES) {
      const rest: JankoRestGeometry = {
        tick: 552,
        durationTicks: value === 'whole' ? 192 : value === 'half' ? 96 : 12,
        hand: 'RH',
        x: 200,
        y: 300,
        value,
        style,
      };
      const centroid = paintedCentroid(restGroupSvg(rest));
      // The SVG prints two decimals, so the pin is that resolution.
      assert.ok(
        Math.abs(centroid.x - rest.x) < 0.02,
        `${style} · ${value}: centroid x ${centroid.x.toFixed(3)} on the seat column ${rest.x}`
      );
      if (value === 'half' || value === 'whole') {
        // Round 21 §C: a bar form is seated by its **contact edge** on a drawn
        // staff rule, so its centroid deliberately stands half a slab off the
        // seat point (above for the half, below for the whole). The contact
        // edge itself is the pin.
        // The pin belongs to the **classical cuts**: their slab is a plain
        // filled bar drawn with its contact edge exactly on the line. A
        // demonstrator bar (the geometric capsule, the bauhaus hairline box, the
        // phantom's dashed bar) carries strokes and other ink of its own, so its
        // box edge is not the contact edge and only the seat itself is pinned.
        if (style === 'kinetic-monoline' || style === 'classical-urtext') {
          const box = restInkBox(rest);
          const edge = value === 'half' ? box.y1 : box.y0;
          assert.ok(
            Math.abs(edge - rest.y) < 0.02,
            `${style} · ${value}: the contact edge ${edge.toFixed(3)} sits on the seat line ${rest.y}`
          );
        }
        continue;
      }
      assert.ok(
        Math.abs(centroid.y - rest.y) < 0.02,
        `${style} · ${value}: centroid y ${centroid.y.toFixed(3)} on the seat point ${rest.y}`
      );
    }
  }
});

test('Corpus seats: every engraved rest paints its centroid on the seat point and its row', () => {
  const cases = [
    ['Bach', BACH, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS],
    ['Brahms', BRAHMS, BRAHMS_OP118_NO1_JANKO_OPTIONS, BRAHMS_OP118_NO1_JANKO_TOKENS],
    [
      'RestSpec',
      REST_SPECIMEN,
      REST_DURATION_SPECIMEN_JANKO_OPTIONS,
      REST_DURATION_SPECIMEN_JANKO_TOKENS,
    ],
  ] as const;
  let painted = 0;
  for (const [label, score, options, tokens] of cases) {
    const t = resolveJankoTokens(tokens);
    for (const layout of layoutJankoScore(score, resolveJankoOptions(options), t)) {
      for (const rest of layout.rests) {
        const centroid = paintedCentroid(restGroupSvg(rest, t));
        assert.ok(
          Math.abs(centroid.x - rest.x) < 0.02,
          `${label} t${rest.tick}: the painted centroid is on the seat column`
        );
        if (rest.value === 'half' || rest.value === 'whole') {
          // Round 21 §C: a bar form's seat point is the drawn staff rule its
          // **contact edge** touches; its centroid stands half a slab off it.
          const box = restInkBox(rest, t);
          const edge = rest.value === 'half' ? box.y1 : box.y0;
          assert.ok(
            Math.abs(edge - rest.y) < 0.02,
            `${label} t${rest.tick}: the ${rest.value} slab touches its drawn line`
          );
        } else {
          assert.ok(
            Math.abs(centroid.y - rest.y) < 0.02,
            `${label} t${rest.tick}: the painted centroid is the seat point`
          );
          // … and the seat's row is a real whole-tone row of the lattice.
          const row = rest.y - restSeatOffsetY(rest.value, rest.style, t);
          const snapped =
            Math.round((row - layout.geometry.middleCY) / (t.rowHeight / 2)) * (t.rowHeight / 2);
          assert.ok(
            Math.abs(row - layout.geometry.middleCY - snapped) < t.rowHeight / 4 + 1e-6,
            `${label} t${rest.tick}: the seat line sits on the lattice`
          );
        }
        painted++;
      }
    }
  }
  assert.ok(painted >= 17, `every corpus rest is audited (saw ${painted})`);
});

test('Violation fixture: a rest seated off the lattice is caught by rest-centroid-off-row', () => {
  const layout = layoutJankoScore(BACH, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS)[0];
  const clean: LintViolation[] = [];
  checkRestSeat(layout, resolveJankoOptions(DEFAULT_JANKO_OPTIONS), DEFAULT_JANKO_TOKENS, clean);
  assert.deepEqual(clean, [], 'the golden seat is on the lattice');
  // The defect the round kills: the glyph floats 1.4pt off its phrase row.
  const index = 0;
  const drifted = {
    ...layout,
    rests: layout.rests.map((r, i) => (i === index ? { ...r, y: r.y + 1.4 } : r)),
  };
  const out: LintViolation[] = [];
  checkRestSeat(drifted, resolveJankoOptions(DEFAULT_JANKO_OPTIONS), DEFAULT_JANKO_TOKENS, out);
  assert.equal(out.length, 1, 'the off-row seat is named');
  assert.equal(out[0].code, 'rest-centroid-off-row');
  assert.equal(out[0].severity, 'error');
  assert.ok(out[0].metrics!.offRow > 1, 'with the measured drift');
});

test('The bar pair: the half slab sits atop its row, the whole slab hangs below its own', () => {
  const t = resolveJankoTokens(REST_DURATION_SPECIMEN_JANKO_TOKENS);
  const rests = layoutJankoScore(
    REST_SPECIMEN,
    resolveJankoOptions(REST_DURATION_SPECIMEN_JANKO_OPTIONS),
    t
  ).flatMap((l) => l.rests);
  const half = rests.find((r) => r.value === 'half')!;
  const whole = rests.find((r) => r.value === 'whole')!;
  assert.ok(half && whole, 'the specimen states both bar forms');

  const halfRow = half.y - restSeatOffsetY('half', half.style, t);
  const wholeRow = whole.y - restSeatOffsetY('whole', whole.style, t);
  const halfBox = restInkBox(half, t);
  const wholeBox = restInkBox(whole, t);
  assert.ok(halfBox.y1 <= halfRow + 1e-9, `the half slab sits atop its row (base ${halfBox.y1} ≤ ${halfRow})`);
  assert.ok(halfBox.y0 < halfRow, 'and carries its ink above it');
  assert.ok(wholeBox.y0 >= wholeRow - 1e-9, `the whole slab hangs below its row (top ${wholeBox.y0} ≥ ${wholeRow})`);
  assert.ok(wholeBox.y1 > wholeRow, 'and carries its ink below it');
  // Two clearly different readings: the slabs are mirror images about their rows.
  assert.ok(Math.abs(half.y - whole.y) < 1e-9 || Math.abs(half.y - whole.y) > 0, 'distinct seats');
  assert.equal(whole.durationTicks, 192, 'the whole bar is the 192-tick silence');
});

test('The whole bar is stated exactly once on the specimen, on its measure’s downbeat', () => {
  const rests = layoutJankoScore(
    REST_SPECIMEN,
    resolveJankoOptions(REST_DURATION_SPECIMEN_JANKO_OPTIONS),
    resolveJankoTokens(REST_DURATION_SPECIMEN_JANKO_TOKENS)
  ).flatMap((l) => l.rests);
  const whole = rests.filter((r) => r.value === 'whole');
  assert.equal(whole.length, 1, 'exactly one whole bar');
  assert.equal(whole[0].tick, 4 * 192, 'opening on the fifth measure’s downbeat');
  assert.equal(whole[0].hand, 'RH');
});

// ---------------------------------------------------------------------------
// 2. The unison merge
// ---------------------------------------------------------------------------

test('Bach’s final bar paints one seven: 550/551 merge to a single digit', () => {
  const layouts = layoutJankoScore(BACH, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
  const final = layouts[layouts.length - 1];
  const merge = final.unisonMerges.find((m) => m.tick === 4560)!;
  assert.ok(merge, 'the final-bar unison is merged');
  // Round 21 §D: the **lower voice** (LH, id 551) keeps the digit.
  assert.deepEqual(merge.mergedIds, ['bach-var1-550']);
  assert.equal(merge.survivorId, 'bach-var1-551');
  assert.equal(merge.exact, true, 'the two voices are exact duplicates');
  assert.equal(
    final.notes.filter((p) => p.note.startTick === 4560).length,
    1,
    'one painted head at the final onset'
  );
  const svg = renderSystem(BACH, final.geometry, final.index, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS, final);
  const survivor = final.notes.find((p) => p.note.id === merge.survivorId)!;
  const column = survivor.x.toFixed(2);
  const digits = [...svg.matchAll(/class="janko-digit" x="([\d.]+)"[^>]*>(\d)</g)].filter(
    (m) => m[1] === column
  );
  assert.deepEqual(digits.map((m) => m[2]), ['7'], 'a single seven on the final column');
  const report = lintJankoScore(BACH, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
  assert.equal(report.violations.filter((v) => v.code === 'unison-double-digit').length, 0);
});

test('All seven Brahms unisons paint one digit with every rhythm voice intact', () => {
  const options = resolveJankoOptions(BRAHMS_OP118_NO1_JANKO_OPTIONS);
  const tokens = resolveJankoTokens(BRAHMS_OP118_NO1_JANKO_TOKENS);
  const layouts = layoutJankoScore(BRAHMS, options, tokens);
  const merges = layouts.flatMap((l) => l.unisonMerges);
  assert.equal(merges.length, 7, 'the complete Brahms unison census');
  assert.deepEqual(
    merges.map((m) => m.tick),
    [11376, 11472, 12336, 12360, 12384, 12552, 12576]
  );
  assert.equal(merges.filter((m) => m.exact).length, 1, 'the 21/21 pair is the one exact duplicate');
  assert.deepEqual(
    merges.filter((m) => !m.exact).map((m) => m.tick),
    [11376, 11472, 12360, 12384, 12552, 12576],
    'the six mixed-duration unisons'
  );
  for (const layout of layouts) {
    const beatIds = new Set(layout.beams.flatMap((b) => b.notes.map((n) => n.id)));
    for (const merge of layout.unisonMerges) {
      const heads = layout.notes.filter((p) => p.note.startTick === merge.tick);
      assert.equal(
        heads.filter((p) => merge.mergedIds.includes(p.note.id)).length,
        0,
        `t${merge.tick}: no merged duplicate is painted`
      );
      const voices = layout.unisonVoices.filter((v) => v.unisonSurvivorId === merge.survivorId);
      if (merge.exact) {
        assert.equal(voices.length, 0, `t${merge.tick}: identical voices need no second rhythm statement`);
        continue;
      }
      // Mixed durations: every voice keeps its own rhythm statement, standing on
      // the merged head's column — a beam keeps its member, a flag its stem.
      assert.ok(voices.length >= 1, `t${merge.tick}: the mixed-duration voices survive`);
      const survivor = layout.notes.find((p) => p.note.id === merge.survivorId)!;
      for (const voice of voices) {
        assert.equal(voice.rhythm.x, survivor.x, `t${merge.tick}: the voice stands on the one head`);
        assert.ok(
          beatIds.has(voice.note.id) ||
            mergedOrUngrouped(layout, voice.note.id) ||
            voice.note.durationTicks > 38,
          `t${merge.tick}: ${voice.note.id} keeps its beam/flag or is a plain long stem`
        );
      }
    }
  }
  const report = lintJankoScore(BRAHMS, options, tokens);
  assert.equal(report.violations.filter((v) => v.code === 'unison-double-digit').length, 0);
});

/** Is this note one of the system's standalone flagged/plain stems? */
function mergedOrUngrouped(layout: JankoSystemLayout, id: string): boolean {
  return layout.ungrouped.some((n) => n.id === id);
}

test('Violation fixture: two digits on one sound report unison-double-digit', () => {
  const layouts = layoutJankoScore(BACH, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
  const final = layouts[layouts.length - 1];
  // The defect the round kills: the merged LH voice painted as its own digit,
  // fanned aside exactly as it was before the merge.
  const survivor = final.notes.find((p) => p.note.startTick === 4560)!;
  const duplicate = {
    ...survivor,
    note: BACH.notes.find((n) => n.id === 'bach-var1-550')!,
    x: survivor.x + 5.46,
  };
  const broken: JankoSystemLayout = { ...final, notes: [...final.notes, duplicate] };
  const out: LintViolation[] = [];
  checkUnisonDigits(BACH, broken, DEFAULT_JANKO_TOKENS, out);
  assert.equal(out.length, 1, 'the doubling is named');
  assert.equal(out[0].code, 'unison-double-digit');
  assert.equal(out[0].severity, 'error');
  assert.deepEqual([...out[0].noteIds!].sort(), ['bach-var1-550', 'bach-var1-551']);
  // The clean layout reports nothing.
  const clean: LintViolation[] = [];
  checkUnisonDigits(BACH, final, DEFAULT_JANKO_TOKENS, clean);
  assert.deepEqual(clean, []);
});

// ---------------------------------------------------------------------------
// 3. The clasp nib
// ---------------------------------------------------------------------------

test('The nib: every dotted clasp’s dot is a clean satellite of its mark', () => {
  const options = resolveJankoOptions(BRAHMS_OP118_NO1_JANKO_OPTIONS);
  const tokens = resolveJankoTokens(BRAHMS_OP118_NO1_JANKO_TOKENS);
  const layouts = layoutJankoScore(BRAHMS, options, tokens);
  const hug = tokens.augmentationDotGap;
  const r = tokens.augmentationDotRadius;
  let dots = 0;
  let worstMark = Number.POSITIVE_INFINITY;
  let worstNeighbour = Number.POSITIVE_INFINITY;
  for (const layout of layouts) {
    for (const clasp of layout.clasps) {
      clasp.durationInk.forEach((ink, index) => {
        if (!ink.dotted) return;
        const dot = clasp.durationDots[index];
        assert.ok(dot, `t${clasp.tick}: a dotted group carries a resolved dot`);
        dots++;
        // Daylight from the dot's ink to the mark's own ink, measured on the
        // painted primitives of the bracket's duration ink.
        const ringAir = ink.pips > 0
          ? Math.hypot(dot!.x - clasp.claspX, dot!.y - ink.centerY) - 3.5 - r
          : Number.POSITIVE_INFINITY;
        const spineAir = Math.abs(dot!.x - clasp.claspX) - clasp.strokeWidth / 2 - r;
        worstMark = Math.min(worstMark, ringAir, spineAir);
        assert.ok(
          Math.min(ringAir, spineAir) >= hug - 1e-9,
          `t${clasp.tick}: the dot keeps ${hug}pt from its own mark`
        );
        // … and from every member disc the knockout would erase it with.
        for (const n of clasp.notes) {
          const air = Math.hypot(dot!.x - n.x, dot!.y - n.y) - tokens.noteheadRadius - r;
          worstNeighbour = Math.min(worstNeighbour, air);
          assert.ok(air >= hug - 1e-9, `t${clasp.tick}: the dot keeps ${hug}pt from member ${n.id}`);
        }
      });
    }
  }
  assert.equal(dots, 12, 'the complete Brahms dotted-clasp census');
  assert.ok(worstMark >= hug - 1e-9, `worst mark daylight ${worstMark.toFixed(3)}pt`);
  assert.ok(worstNeighbour >= hug - 1e-9, `worst neighbour daylight ${worstNeighbour.toFixed(3)}pt`);

  const report = lintJankoScore(BRAHMS, options, tokens);
  assert.equal(report.diagnostics.filter((d) => d.code === 'clasp-dot-fusion').length, 0);
});

test('The nib: m. 3’s tick-432 dot is the case window, clean by every measure', () => {
  const options = resolveJankoOptions(BRAHMS_OP118_NO1_JANKO_OPTIONS);
  const tokens = resolveJankoTokens(BRAHMS_OP118_NO1_JANKO_TOKENS);
  const layouts = layoutJankoScore(BRAHMS, options, tokens);
  const clasp = layouts.flatMap((l) => l.clasps).find((c) => c.tick === 432)!;
  assert.ok(clasp.dotted, 'the tick-432 bracket carries a dotted value');
  assert.equal(clasp.durationTicks, 144, 'a dotted half');
  assert.equal(clasp.pips, 1, '… as an open ring');
  const dot = clasp.durationDots[0]!;
  const yMid = (clasp.topY + clasp.botY) / 2;
  // The retired placement sat at (+3.2, yMid) — inside the ring's 3.5pt stroke
  // (~1.05pt of fusion). The new dot is up-and-right of the ring, outside it.
  const legacy = Math.hypot(clasp.claspX + 3.2 - clasp.claspX, 0) - 3.5 - tokens.augmentationDotRadius;
  assert.ok(legacy < 0, `the retired placement overlapped the ring (${legacy.toFixed(2)}pt)`);
  assert.ok(
    Math.hypot(dot.x - clasp.claspX, dot.y - yMid) - 3.5 - tokens.augmentationDotRadius >=
      tokens.augmentationDotGap - 1e-9,
    'the painted dot keeps the full hug from the ring'
  );
  assert.ok(dot.y < yMid, 'and sits above the mark, as the satellite rule prefers');
});

test('Violation fixture: the retired fused geometry is caught by clasp-dot-fusion', () => {
  const options = resolveJankoOptions(BRAHMS_OP118_NO1_JANKO_OPTIONS);
  const tokens = resolveJankoTokens(BRAHMS_OP118_NO1_JANKO_TOKENS);
  const layout = layoutJankoScore(BRAHMS, options, tokens).find((l) =>
    l.clasps.some((c) => c.tick === 432)
  )!;
  const index = layout.clasps.findIndex((c) => c.tick === 432);
  const clasp = layout.clasps[index];
  const yMid = (clasp.topY + clasp.botY) / 2;
  // The defect: the dot wedged at the spine's midpoint, inside the ring stroke.
  const fused = {
    ...clasp,
    durationDots: [{ x: clasp.claspX + 3.2, y: yMid }],
  };
  const broken: JankoSystemLayout = {
    ...layout,
    clasps: layout.clasps.map((c, i) => (i === index ? fused : c)),
  };
  const out: LintViolation[] = [];
  checkClaspDotFusion(broken, tokens, LINT, out);
  assert.equal(out.length, 1, 'the fusion is named');
  assert.equal(out[0].code, 'clasp-dot-fusion');
  assert.equal(out[0].severity, 'error');
  assert.ok(out[0].metrics!.markAir < tokens.augmentationDotGap, 'with the measured fusion');
});

test('Note-dot no-move guard: the augmentation dots are byte-identical', () => {
  // The clasp-dot fix must never touch a note's own dot: the system's three
  // solitary dotted 8ths keep their judged flag-clearance escape (right off
  // the mask hug onto exactly 1.2pt of true flag air, same lane height), and
  // the painted coordinates are pinned to the pixel.
  const layout = layoutJankoScore(BACH, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS)[0];
  const dotted = layout.ungrouped.filter((n) => n.durationTicks > 26 && n.durationTicks <= 38);
  assert.deepEqual(dotted.map((n) => n.startTick), [24, 168, 312], 'the system’s solitary dotted 8ths');
  const svg = renderSystem(BACH, layout.geometry, 0, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS, layout);
  for (const note of dotted) {
    const dotX = (note.dotX ?? -1).toFixed(2);
    const dotY = (note.dotY ?? note.y).toFixed(2);
    assert.ok(
      svg.includes(
        `class="janko-augmentation-dot" cx="${dotX}" cy="${dotY}" r="${T.augmentationDotRadius.toFixed(2)}"`
      ),
      `t${note.startTick}: the note dot is painted at its judged lane (${dotX}, ${dotY})`
    );
    // The judged relation: the dot escapes RIGHT off its mask hug onto exactly
    // the house gap of true verbatim flag air, keeping the hug lane height.
    const s = getStemGeometry(note, T);
    const bbox = getSubdivisionGlyphBBox(
      DEFAULT_JANKO_OPTIONS.subdivisionStyle,
      s.direction,
      subdivisionMarkCount(note.durationTicks),
      T
    );
    assert.equal(
      note.dotX,
      s.stemX + bbox.x1 + T.augmentationDotRadius + T.augmentationDotGap,
      `t${note.startTick}: the dot escapes right onto 1.2pt of flag air`
    );
    assert.equal(
      note.dotY,
      note.y - T.augmentationDotRowOffset,
      `t${note.startTick}: the dot keeps the hug lane height`
    );
  }
});
