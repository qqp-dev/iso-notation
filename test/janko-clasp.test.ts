/**
 * Round 5 — Left Clasp / Bracket Duration Carrier (refined through Round 9).
 *
 * The round replaces the long vertical stems that used to run through
 * multi-note chords with an **external bracket on the left of the cluster** that
 * simultaneously groups the vertical sonority and carries its duration. This
 * suite covers, in order:
 *
 *  1. the token grammar (clasp width / stroke / offset / barline air) and the
 *     Round 14 golden-master default (`chordGrouping: 'per-hand-clasp'`);
 *  2. the duration grammar (pip, notch counts, the dotted-value dot);
 *  3. the bracket geometry — `claspX = minX − r − claspOffset`,
 *     `topY = minY − r`, `botY = maxY + r`, caps of `claspWidth`;
 *  4. the fit rule: a lone melodic note is never clasped, and a bracket that
 *     cannot stand clear of a barline, a foreign disc or the margin furniture
 *     is not engraved at all;
 *  5. the downbeat barline clearance (`claspX − barlineX ≥ 4.0pt`) and the
 *     measure-inset budget that pays for it without distorting the note grid;
 *  6. the beamed-clasp rail: contiguous clasps of one measure joined at the
 *     extended spine tops, strictly terminating inside the measure;
 *  7. engine integrity: a real 16th-note beam is never cut by a clasp, and both
 *     benchmark scores engrave every clasp mode with zero diagnostics;
 *  8. the Round 6 per-hand refinement, the Round 8 bracketing scope (a
 *     horizontally displaced cluster **or** a 3-or-more-note vertical chord; a
 *     clean 2-note column stays unbracketed) and the four **scaled** midpoint
 *     duration paradigms of Round 10, whose marks cut symmetrically across the
 *     bracket spine at 2–3× the Round 9 size.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1';
import {
  BRAHMS_OP118_NO1_JANKO_OPTIONS,
  BRAHMS_OP118_NO1_JANKO_TOKENS,
  buildBrahmsOp118No1Score,
} from '../src/scores/brahms-op118-no1';
import {
  DEFAULT_JANKO_OPTIONS,
  DEFAULT_JANKO_TOKENS,
  JANKO_CHORD_GROUPINGS,
  JANKO_CHORD_GROUPING_LABELS,
  JANKO_CLASP_DURATION_STYLES,
  JANKO_CLASP_DURATION_STYLE_LABELS,
  JankoChordGrouping,
  resolveJankoOptions,
  resolveJankoTokens,
} from '../src/render/janko/types';
import { QuantizedGridScore } from '../src/model/types';
import { splitTick } from '../src/render/janko/geometry';
import {
  CLASP_NOTEHEAD_AIR,
  collectClaspClusters,
  computeClaspInsetMap,
  computePageGeometry,
  getClaspDownbeatInset,
  getMeasureOpeningBarlineX,
  getSystemGeometry,
  layoutJankoScore,
  measuresWithColumnCollisions,
  railClearsLayout,
  renderJankoCrop,
} from '../src/render/janko/engine';
import {
  CHORD_BRIDGE_DISC_AIR,
  CHORD_BRIDGE_MIN_GAP,
  CLASP_CROSS_SPACING,
  CLASP_DOT_OFFSET,
  CLASP_MARK_REACH,
  CLASP_MARK_STACK_GAP,
  CLASP_MIN_HORIZONTAL_SPREAD,
  CLASP_MIN_VERTICAL_CHORD,
  CLASP_RING_RADIUS,
  CLASP_RING_STROKE,
  CLASP_TRANSVERSE_STROKE,
  CLASP_TRANSVERSE_WIDTH,
  JankoRhythmNote,
  claspDurationClass,
  claspDurationDotted,
  claspInkBox,
  claspQualifies,
  computeClaspGeometry,
  computeVerticalChordGroup,
  renderChordClasp,
} from '../src/render/janko/elements/rhythm';
import { JANKO_LINT_CHECKS, lintJankoScore, systemBarlines } from '../src/render/janko/linter';

const BACH = buildBachGoldbergVar1Score();
const BRAHMS = buildBrahmsOp118No1Score();
const T = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
const BRAHMS_T = resolveJankoTokens(BRAHMS_OP118_NO1_JANKO_TOKENS);

/** A positioned-looking rhythm note for the pure geometry tests. */
function rn(
  id: string,
  x: number,
  y: number,
  durationTicks: number,
  startTick: number = 0
): JankoRhythmNote {
  return { id, x, y, durationTicks, startTick, hand: 'RH' };
}

/** Layout a benchmark under one chord-grouping paradigm. */
function layouts(
  mode: JankoChordGrouping,
  score = BACH,
  base: Partial<typeof DEFAULT_JANKO_OPTIONS> = DEFAULT_JANKO_OPTIONS,
  tokens = T
) {
  return layoutJankoScore(score, { ...base, chordGrouping: mode }, tokens);
}

// ---------------------------------------------------------------------------
// 1. Tokens & options
// ---------------------------------------------------------------------------

test('Clasp tokens: geometry lands on the ticket defaults, and Round 14 restores the per-hand clasp', () => {
  assert.equal(DEFAULT_JANKO_TOKENS.claspWidth, 2.2, 'cap reach');
  assert.equal(DEFAULT_JANKO_TOKENS.claspStrokeWidth, 0.85, 'bracket stroke');
  assert.equal(DEFAULT_JANKO_TOKENS.claspOffset, 2.8, 'disc-to-spine air');
  assert.equal(DEFAULT_JANKO_TOKENS.claspMinBarlineAir, 4.0, 'downbeat barline air');
  assert.equal(
    DEFAULT_JANKO_OPTIONS.chordGrouping,
    'per-hand-clasp',
    'the golden master groups every hand simultaneity so no stem can cut a chord tone'
  );
  assert.equal(
    DEFAULT_JANKO_OPTIONS.claspDurationStyle,
    'kinetic-cross-slashes',
    'Round 12 standardizes the up-raked 12.4° kinetic clasp'
  );
  assert.deepEqual(
    [...JANKO_CHORD_GROUPINGS],
    ['none', 'left-clasp-spire', 'beamed-clasp-rail', 'bounding-phrase', 'per-hand-clasp'],
    'the five paradigms in exploration order'
  );
  assert.deepEqual(
    [...JANKO_CLASP_DURATION_STYLES],
    [
      'transverse-cross-bars',
      'kinetic-cross-slashes',
      'down-raked-slashes',
      'cross-hatch-stitches',
    ],
    'the four light transverse duration paradigms in exploration order'
  );
  for (const mode of JANKO_CHORD_GROUPINGS) {
    assert.ok(JANKO_CHORD_GROUPING_LABELS[mode].length > 0, `${mode} is labelled`);
  }
  for (const style of JANKO_CLASP_DURATION_STYLES) {
    assert.ok(JANKO_CLASP_DURATION_STYLE_LABELS[style].length > 0, `${style} is labelled`);
  }
  // A downbeat clasp needs `r + claspOffset + CLASP_MARK_REACH +
  // claspMinBarlineAir` from the measure's left edge — 15.35pt with the
  // canonical tokens, because a 7.5pt cut reaches 3.75pt left of the spine.
  assert.equal(getClaspDownbeatInset(T), 4.8 + 2.8 + CLASP_MARK_REACH + 4.0);
  assert.equal(CLASP_MARK_REACH, CLASP_TRANSVERSE_WIDTH / 2, 'the widest cut is the 7.5pt rung');
  assert.equal(CLASP_TRANSVERSE_STROKE, 1.0, 'every transverse cut is a 1.0pt line');
  assert.equal(CLASP_RING_STROKE, 1.0, 'the shared open half ring is a 1.0pt stroke');
  assert.equal(resolveJankoOptions({ chordGrouping: 'left-clasp-spire' }).chordGrouping, 'left-clasp-spire');
  assert.equal(resolveJankoOptions({ chordGrouping: 'per-hand-clasp' }).chordGrouping, 'per-hand-clasp');
});

// ---------------------------------------------------------------------------
// 2. Duration grammar
// ---------------------------------------------------------------------------

test('Clasp duration grammar: pip for halves/wholes, notches for 8ths/16ths, a bare quarter', () => {
  assert.equal(claspDurationClass(384), 'double-pip', 'whole note');
  assert.equal(claspDurationClass(192), 'double-pip');
  assert.equal(claspDurationClass(96), 'pip', 'half note');
  assert.equal(claspDurationClass(168), 'pip', 'Brahms dotted half');
  assert.equal(claspDurationClass(48), 'spire', 'quarter note — a bare bracket');
  assert.equal(claspDurationClass(84), 'spire', 'Brahms long value');
  assert.equal(claspDurationClass(39), 'spire');
  assert.equal(claspDurationClass(38), 'spire-one-flag', 'dotted 8th');
  assert.equal(claspDurationClass(24), 'spire-one-flag', '8th note');
  assert.equal(claspDurationClass(15), 'spire-one-flag');
  assert.equal(claspDurationClass(14), 'spire-two-flags', '16th note');
  assert.equal(claspDurationClass(12), 'spire-two-flags');

  const pip = computeClaspGeometry([rn('a', 100, 100, 96), rn('b', 100, 130, 96)], T)!;
  assert.equal(pip.duration, 'pip');
  assert.equal(pip.durationStyle, 'kinetic-cross-slashes', 'the standardized midpoint paradigm');
  assert.equal(pip.pips, 1);
  assert.equal(pip.flags, 0);
  assert.equal(pip.dotted, false);

  const whole = computeClaspGeometry([rn('a', 100, 100, 384), rn('b', 100, 130, 384)], T)!;
  assert.equal(whole.pips, 2, 'a whole note doubles the pip');

  const eighth = computeClaspGeometry([rn('a', 100, 100, 24), rn('b', 100, 130, 24)], T)!;
  assert.equal(eighth.flags, 1, 'an 8th carries one duration notch');

  const sixteenth = computeClaspGeometry([rn('a', 100, 100, 12), rn('b', 100, 130, 12)], T)!;
  assert.equal(sixteenth.flags, 2, 'a 16th carries two duration notches');

  // Round 9: a dotted value is exactly 1.5× a plain one and adds the canonical
  // augmentation dot at the midpoint; the odd Brahms values are not dotted.
  assert.equal(claspDurationDotted(72), true, 'dotted quarter');
  assert.equal(claspDurationDotted(36), true, 'dotted 8th');
  assert.equal(claspDurationDotted(144), true, 'dotted half');
  assert.equal(claspDurationDotted(48), false, 'plain quarter');
  assert.equal(claspDurationDotted(96), false, 'plain half');
  assert.equal(claspDurationDotted(42), false, 'the odd Brahms 42-tick value is not dotted');
  const dottedQuarter = computeClaspGeometry([rn('a', 100, 100, 72), rn('b', 100, 130, 72)], T)!;
  assert.equal(dottedQuarter.duration, 'spire', 'a dotted quarter keeps the plain bracket class');
  assert.equal(dottedQuarter.flags, 0);
  assert.equal(dottedQuarter.dotted, true, 'and adds the dot');

  // The clasp carries the **shortest** member value: the point at which the
  // cluster's first voice moves on.
  const mixed = computeClaspGeometry([rn('a', 100, 100, 12), rn('b', 100, 130, 96)], T)!;
  assert.equal(mixed.durationTicks, 12);
  assert.equal(mixed.duration, 'spire-two-flags');
  // …unless the caller overrides it (the phrase paradigm carries its opening value).
  const phrase = computeClaspGeometry(
    [rn('a', 100, 100, 12), rn('b', 100, 130, 96)],
    T,
    { durationTicks: 96 }
  )!;
  assert.equal(phrase.duration, 'pip');
});

// ---------------------------------------------------------------------------
// 3. Bracket geometry
// ---------------------------------------------------------------------------

test('Clasp geometry: the bracket is drawn outside the cluster and bounds every disc', () => {
  const notes = [rn('top', 120, 40, 12), rn('bottom', 110, 100, 12)];
  const clasp = computeClaspGeometry(notes, T)!;
  assert.equal(clasp.minX, 110, 'leftmost head');
  assert.equal(clasp.maxX, 120);
  assert.equal(clasp.minY, 40);
  assert.equal(clasp.maxY, 100);
  assert.equal(clasp.claspX, 110 - 4.8 - 2.8, 'claspX = minX − r − claspOffset');
  assert.equal(clasp.topY, 40 - 4.8, 'topY = minY − r');
  assert.equal(clasp.botY, 100 + 4.8, 'botY = maxY + r');
  assert.equal(clasp.capWidth, T.claspWidth);
  assert.equal(clasp.strokeWidth, T.claspStrokeWidth);
  assert.equal(
    clasp.path,
    'M 104.60 35.20 L 102.40 35.20 L 102.40 104.80 L 104.60 104.80',
    'cap → spine → cap'
  );
  // Members are sorted top-to-bottom so the geometry is order-independent.
  assert.deepEqual(clasp.notes.map((n) => n.id), ['top', 'bottom']);

  // The bracket's ink never crosses the discs it clasps: the caps stop
  // `r + claspOffset − capW` short of the outermost head, i.e. 0.6pt clear of
  // the knockout, and every duration paradigm stays inside that footprint.
  const ink = claspInkBox(clasp, T);
  assert.equal(
    ink.x0,
    clasp.claspX - CLASP_TRANSVERSE_WIDTH / 2,
    'a 16th cross-bar straddles the spine by its half-width'
  );
  assert.equal(ink.y0, clasp.topY, 'a 16th cross-bar rides the spine, never above it');
  assert.equal(ink.y1, clasp.botY);
  assert.ok(
    clasp.claspX + clasp.capWidth <= clasp.minX - T.noteheadRadius - 0.6 + 1e-9,
    'the caps stop clear of the disc'
  );
  assert.equal(computeClaspGeometry([rn('solo', 100, 100, 12)], T), null, 'a lone note is never clasped');
});

test('Round 11 light paradigms paint four distinct line-based brackets cutting across the spine', () => {
  const quarter = () => computeClaspGeometry([rn('a', 100, 100, 48), rn('b', 100, 130, 48)], T)!;
  const eighth = () => computeClaspGeometry([rn('a', 100, 100, 24), rn('b', 100, 130, 24)], T)!;
  const sixteenth = () => computeClaspGeometry([rn('a', 100, 100, 12), rn('b', 100, 130, 12)], T)!;
  const half = () => computeClaspGeometry([rn('a', 100, 100, 96), rn('b', 100, 130, 96)], T)!;
  const whole = () => computeClaspGeometry([rn('a', 100, 100, 384), rn('b', 100, 130, 384)], T)!;
  const dottedQuarter = () =>
    computeClaspGeometry([rn('a', 100, 100, 72), rn('b', 100, 130, 72)], T)!;
  type Group = ReturnType<typeof quarter>;
  type Style = (typeof JANKO_CLASP_DURATION_STYLES)[number];
  const style = (group: Group, s: Style): string =>
    renderChordClasp({ ...group, durationStyle: s }, T);
  const yMid = (group: Group): number => (group.topY + group.botY) / 2;
  const docs = (markup: string): string => markup.replace(/data-clasp-[a-z-]+="[^"]*"/g, '');

  /** The cut class and the per-value mark counts of each paradigm. */
  const INK: Record<Style, { klass: string; eighth: number; sixteenth: number }> = {
    'transverse-cross-bars': { klass: 'bar', eighth: 1, sixteenth: 2 },
    'kinetic-cross-slashes': { klass: 'slash', eighth: 1, sixteenth: 2 },
    'down-raked-slashes': { klass: 'slash', eighth: 1, sixteenth: 2 },
    'cross-hatch-stitches': { klass: 'stitch', eighth: 1, sixteenth: 2 },
  };
  const MARKS = '(?:ring|bar|slash|stitch)';
  /** Every y coordinate the paradigm's duration ink paints. */
  const markYs = (markup: string): number[] => {
    const ys: number[] = [];
    for (const element of markup.matchAll(
      new RegExp(`<(?:line|circle|path) class="janko-clasp-${MARKS}"[^>]*>`, 'g')
    )) {
      const tag = element[0];
      for (const attr of tag.matchAll(/(?:y1|y2|cy)="([\d.-]+)"/g)) ys.push(Number(attr[1]));
      const path = / d="([^"]+)"/.exec(tag);
      if (path) {
        [...path[1].matchAll(/-?\d+(?:\.\d+)?/g)]
          .map((n) => Number(n[0]))
          .forEach((value, index) => {
            if (index % 2 === 1) ys.push(value);
          });
      }
    }
    return ys;
  };
  /** Every x coordinate the paradigm's duration ink paints. */
  const markXs = (markup: string): number[] => {
    const xs: number[] = [];
    for (const element of markup.matchAll(
      new RegExp(`class="janko-clasp-${MARKS}"[^>]*`, 'g')
    )) {
      const tag = element[0];
      for (const attr of tag.matchAll(/(?:x1|x2|cx)="([\d.-]+)"/g)) xs.push(Number(attr[1]));
      const circle = / cx="([\d.-]+)" cy="[\d.-]+" r="([\d.-]+)"/.exec(tag);
      if (circle) {
        xs.push(Number(circle[1]) - Number(circle[2]), Number(circle[1]) + Number(circle[2]));
      }
      const path = / d="([^"]+)"/.exec(tag);
      if (path) {
        [...path[1].matchAll(/-?\d+(?:\.\d+)?/g)]
          .map((n) => Number(n[0]))
          .forEach((value, index) => {
            if (index % 2 === 0) xs.push(value);
          });
      }
    }
    return xs;
  };

  for (const s of JANKO_CLASP_DURATION_STYLES) {
    // The bracket stays a pure symmetrical `[`; the lopsided Round 7 spire and
    // the subdivision dialect are never borrowed.
    for (const group of [quarter(), eighth(), sixteenth(), half()]) {
      const markup = style(group, s);
      assert.ok(markup.includes(`d="${group.path}"`), `${s} keeps the pure bracket path`);
      assert.ok(!markup.includes('janko-clasp-spire'), `${s} never paints the lopsided spire`);
      assert.ok(!markup.includes('janko-flag'), `${s} never borrows the subdivision dialect`);
    }

    // Quarter: the continuous solid spine — zero duration ink of any kind.
    const plain = style(quarter(), s);
    assert.ok(
      !new RegExp(`janko-clasp-(${MARKS}|dot|pip)`).test(plain),
      `${s} leaves a quarter as a continuous solid spine`
    );

    // The shared half / whole mark is the clean open white ring (zero
    // crosshairs) under every paradigm.
    const opened = style(half(), s);
    assert.equal(
      (opened.match(/janko-clasp-ring/g) ?? []).length,
      1,
      `${s} half: one open white ring`
    );
    assert.match(
      opened,
      new RegExp(
        `class="janko-clasp-ring" cx="[\\d.-]+" cy="${yMid(half()).toFixed(2)}" ` +
          `r="${CLASP_RING_RADIUS.toFixed(2)}" fill="#FFFFFF" stroke="#111111" ` +
          `stroke-width="${CLASP_RING_STROKE.toFixed(2)}"`
      ),
      `${s} half ring is R = 3.0pt at 1.0pt with a 100% white interior`
    );
    const wholeMarkup = style(whole(), s);
    assert.equal(
      (wholeMarkup.match(/janko-clasp-ring/g) ?? []).length,
      2,
      `${s} whole: a stacked pair of rings`
    );
    const wholeYs = markYs(wholeMarkup).sort((a, b) => a - b);
    assert.deepEqual(
      wholeYs,
      [yMid(whole()) - (CLASP_RING_RADIUS + CLASP_MARK_STACK_GAP), yMid(whole()) + (CLASP_RING_RADIUS + CLASP_MARK_STACK_GAP)],
      `${s} whole rings mirror about the bracket midpoint`
    );

    // 8th / 16th: one cut, then two parallel cuts, all symmetric about the
    // spine's exact midpoint.
    const { klass, eighth: one, sixteenth: two } = INK[s];
    const eight = style(eighth(), s);
    const sixteen = style(sixteenth(), s);
    assert.equal((eight.match(new RegExp(`janko-clasp-${klass}`, 'g')) ?? []).length, one, `${s} 8th: one cut`);
    assert.equal(
      (sixteen.match(new RegExp(`janko-clasp-${klass}`, 'g')) ?? []).length,
      two,
      `${s} 16th: two cuts`
    );
    const anchor = yMid(eighth());
    const marks = markYs(eight);
    assert.ok(marks.length > 0, `${s} paints its 8th ink`);
    assert.ok(
      Math.abs(marks.reduce((a, b) => a + b, 0) / marks.length - anchor) < 1e-9,
      `${s} anchors its 8th mark on the spine midpoint`
    );
    const ys = markYs(sixteen);
    assert.ok(ys.length >= 2, `${s} paints both 16th marks`);
    for (const y of ys) {
      assert.ok(
        ys.some((other) => Math.abs(y + other - 2 * yMid(sixteenth())) < 0.011),
        `${s} mirrors every 16th mark about the midpoint (y=${y})`
      );
    }

    // Every cut is the 7.5pt transverse line: it reaches 3.75pt on each side
    // of the spine.
    const reach = Math.max(...markXs(eight).map((x) => Math.abs(x - eighth().claspX)));
    assert.ok(
      reach >= CLASP_TRANSVERSE_WIDTH / 2 - 1e-9,
      `${s} 8th cut reaches ${reach.toFixed(2)}pt across the spine`
    );

    // Dotted quarter: the plain spine plus the 0.75pt augmentation dot, which
    // keeps a real ≥ 2.0pt clearance from the spine's own ink.
    const dotted = style(dottedQuarter(), s);
    const group = dottedQuarter();
    assert.equal((dotted.match(/janko-clasp-dot/g) ?? []).length, 1, `${s} dotted: one dot`);
    assert.ok(
      dotted.includes(
        `class="janko-clasp-dot" cx="${(group.claspX + CLASP_DOT_OFFSET).toFixed(2)}" cy="${yMid(group).toFixed(2)}" r="${T.augmentationDotRadius.toFixed(2)}"`
      ),
      `${s} dot is the canonical 0.75pt token at the midpoint`
    );
    assert.ok(
      CLASP_DOT_OFFSET - group.strokeWidth / 2 - T.augmentationDotRadius >= 2.0 - 1e-9,
      `${s} dot keeps ≥ 2.0pt clear of the spine ink`
    );
    assert.ok(
      !new RegExp(`janko-clasp-${klass}`).test(dotted),
      `${s} keeps a dotted quarter plain apart from its dot`
    );

    // The audited ink box covers every mark the paradigm paints.
    const ink = claspInkBox({ ...sixteenth(), durationStyle: s }, T);
    for (const x of markXs(sixteen)) {
      assert.ok(x >= ink.x0 - 1e-9 && x <= ink.x1 + 1e-9, `${s} ink box covers x=${x}`);
    }
    for (const y of ys) {
      assert.ok(y >= ink.y0 - 1e-9 && y <= ink.y1 + 1e-9, `${s} ink box covers y=${y}`);
    }
    const openInk = claspInkBox({ ...half(), durationStyle: s }, T);
    for (const x of markXs(opened)) {
      assert.ok(x >= openInk.x0 - 1e-9 && x <= openInk.x1 + 1e-9, `${s} half ink box covers x=${x}`);
    }
    for (const y of markYs(opened)) {
      assert.ok(y >= openInk.y0 - 1e-9 && y <= openInk.y1 + 1e-9, `${s} half ink box covers y=${y}`);
    }
  }

  // The paradigms really are four different engravings of the same value.
  const documents = new Set(JANKO_CLASP_DURATION_STYLES.map((s) => docs(style(sixteenth(), s))));
  assert.equal(documents.size, 4, 'each paradigm is visually distinct');

  // The rakes are mirrored at the score's own beam slope: Candidate B rises
  // left-to-right (`y1 > y2`), Candidate C falls (`y1 < y2`).
  const rakeLine = (s: Style): { y1: number; y2: number; x1: number; x2: number } => {
    const m = /class="janko-clasp-slash" x1="([\d.-]+)" y1="([\d.-]+)" x2="([\d.-]+)" y2="([\d.-]+)"/.exec(
      style(eighth(), s)
    )!;
    return { x1: Number(m[1]), y1: Number(m[2]), x2: Number(m[3]), y2: Number(m[4]) };
  };
  const up = rakeLine('kinetic-cross-slashes');
  const down = rakeLine('down-raked-slashes');
  assert.ok(up.y1 > up.y2, 'the kinetic slash rises to the right');
  assert.ok(down.y1 < down.y2, 'the down-raked slash falls to the right');
  assert.ok(
    Math.abs(Math.abs(up.y1 - up.y2) / (up.x2 - up.x1) - T.maxBeamSlope) < 5e-3,
    'the kinetic slash rakes at the score’s own beam slope'
  );
  assert.ok(
    Math.abs(Math.abs(down.y2 - down.y1) / (down.x2 - down.x1) - T.maxBeamSlope) < 5e-3,
    'the down-raked slash mirrors the same beam slope'
  );
  for (const rake of [up, down]) {
    assert.ok(
      Math.abs(rake.x2 - rake.x1 - CLASP_TRANSVERSE_WIDTH) < 1e-9,
      'the slash is the 7.5pt transverse mark'
    );
  }

  // The stitch is a symmetrical `×`: two strokes of the 7.5pt cut crossing on
  // the spine's own centreline within one path.
  const stitch = style(eighth(), 'cross-hatch-stitches');
  const stitchPath = /class="janko-clasp-stitch" d="M ([\d.-]+) ([\d.-]+) L ([\d.-]+) ([\d.-]+) M ([\d.-]+) ([\d.-]+) L ([\d.-]+) ([\d.-]+)"/.exec(
    stitch
  )!;
  const [sx1, sy1, sx2, sy2, tx1, ty1, tx2, ty2] = stitchPath.slice(1).map(Number);
  assert.equal(sx1, tx1, 'both stitch strokes open on the same left column');
  assert.equal(sx2, tx2, 'both stitch strokes close on the same right column');
  assert.ok(Math.abs(sy1 - ty2) < 1e-9 && Math.abs(sy2 - ty1) < 1e-9, 'the two strokes mirror');
  assert.ok(sy1 > sy2 && ty1 < ty2, 'the stitch crosses an up-rake with a down-rake');
  const stitchMid = (sy1 + sy2) / 2;
  assert.ok(Math.abs(stitchMid - yMid(eighth())) < 1e-9, 'the `×` is centred on the spine midpoint');
  assert.ok(
    Math.abs(sx2 - sx1 - CLASP_TRANSVERSE_WIDTH) < 1e-9,
    'the stitch spans the 7.5pt transverse width'
  );

  // Each paradigm's named geometry is exactly the ticket's.
  assert.ok(
    style(eighth(), 'transverse-cross-bars').includes(
      `x1="${(eighth().claspX - CLASP_TRANSVERSE_WIDTH / 2).toFixed(2)}"`
    ),
    'the cross-rung straddles the spine by 7.5 / 2'
  );
  assert.ok(
    style(sixteenth(), 'transverse-cross-bars').includes(
      `y1="${(yMid(sixteenth()) - CLASP_CROSS_SPACING / 2).toFixed(2)}"`
    ),
    'the 16th rungs are a parallel pair at the 2.5pt spacing'
  );
});

test('renderChordClasp paints the symmetrical bracket and its light duration paradigm', () => {
  const markup = renderChordClasp(
    computeClaspGeometry([rn('a', 100, 100, 48), rn('b', 100, 130, 48)], T)!,
    T
  );
  assert.match(
    markup,
    /class="janko-clasp-group" data-clasp-tick="0" data-clasp-duration="spire" data-clasp-duration-style="kinetic-cross-slashes"/
  );
  assert.match(markup, /class="janko-clasp" d="M 94\.60 95\.20 L 92\.40 95\.20 L 92\.40 134\.80 L 94\.60 134\.80"/);
  assert.match(markup, /stroke-width="0\.85"/);
  assert.ok(!markup.includes('janko-clasp-spire'), 'the lopsided spire is never painted');
  assert.ok(!markup.includes('janko-flag'), 'the clasp carries no subdivision flags');
  assert.ok(!/janko-clasp-(ring|bar|slash|stitch|dot|pip)/.test(markup), 'a quarter is a bare spine');

  const eighthGroup = computeClaspGeometry([rn('a', 100, 100, 24), rn('b', 100, 130, 24)], T)!;
  const eighth = renderChordClasp(eighthGroup, T);
  const yMid = (eighthGroup.topY + eighthGroup.botY) / 2;
  assert.equal((eighth.match(/janko-clasp-slash/g) ?? []).length, 1, '8th: one up-raked slash');
  const eighthSlash =
    /class="janko-clasp-slash" x1="([\d.-]+)" y1="([\d.-]+)" x2="([\d.-]+)" y2="([\d.-]+)"/.exec(eighth)!;
  const eighthHalf = CLASP_TRANSVERSE_WIDTH / 2;
  const eighthRake = eighthHalf * T.maxBeamSlope;
  assert.equal(
    eighthSlash[1],
    (eighthGroup.claspX - eighthHalf).toFixed(2),
    'the slash spans the 7.5pt transverse width'
  );
  assert.ok(
    Math.abs((Number(eighthSlash[2]) + Number(eighthSlash[4])) / 2 - yMid) < 0.01,
    'the slash is centred on the spine midpoint'
  );
  assert.ok(
    Math.abs(Number(eighthSlash[2]) - (yMid + eighthRake)) < 0.01 &&
      Math.abs(Number(eighthSlash[4]) - (yMid - eighthRake)) < 0.01,
    'the slash rakes up at the beam-harmonized 12.4°'
  );

  const sixteenth = renderChordClasp(
    computeClaspGeometry([rn('a', 100, 100, 12), rn('b', 100, 130, 12)], T)!,
    T
  );
  assert.equal((sixteenth.match(/janko-clasp-slash/g) ?? []).length, 2, '16th: two parallel slashes');
  const slashMids = [
    ...sixteenth.matchAll(
      /class="janko-clasp-slash" x1="[\d.-]+" y1="([\d.-]+)" x2="[\d.-]+" y2="([\d.-]+)"/g
    ),
  ].map((m) => (Number(m[1]) + Number(m[2])) / 2);
  for (const [i, slashMid] of slashMids.entries()) {
    const expected = i === 0 ? yMid - CLASP_CROSS_SPACING / 2 : yMid + CLASP_CROSS_SPACING / 2;
    assert.ok(
      Math.abs(slashMid - expected) < 0.01,
      'the 16th pair straddles the midpoint at the 2.5pt spacing'
    );
  }

  // The half note knocks the spine out with the shared open white ring; a whole
  // note stacks a mirrored pair.
  const halfGroup = computeClaspGeometry([rn('a', 100, 100, 96), rn('b', 100, 130, 96)], T)!;
  const half = renderChordClasp(halfGroup, T);
  const halfMid = (halfGroup.topY + halfGroup.botY) / 2;
  assert.equal((half.match(/janko-clasp-ring/g) ?? []).length, 1, 'half: one open white ring');
  assert.ok(
    half.includes(
      `class="janko-clasp-ring" cx="${halfGroup.claspX.toFixed(2)}" cy="${halfMid.toFixed(2)}" ` +
        `r="${CLASP_RING_RADIUS.toFixed(2)}" fill="#FFFFFF" stroke="#111111" ` +
        `stroke-width="${CLASP_RING_STROKE.toFixed(2)}"`
    ),
    'the ring is R = 3.0pt at 1.0pt with a 100% white knockout interior'
  );
  assert.ok(!half.includes('janko-clasp-slash'), 'a half note carries no transverse slash');

  const whole = renderChordClasp(
    computeClaspGeometry([rn('a', 100, 100, 384), rn('b', 100, 130, 384)], T)!,
    T
  );
  assert.equal((whole.match(/janko-clasp-ring/g) ?? []).length, 2, 'whole: a stacked ring pair');
  const wholeYs = [...whole.matchAll(/class="janko-clasp-ring" cx="[\d.-]+" cy="([\d.-]+)"/g)].map(
    (m) => Number(m[1])
  );
  assert.deepEqual(
    wholeYs,
    [halfMid - (CLASP_RING_RADIUS + CLASP_MARK_STACK_GAP), halfMid + (CLASP_RING_RADIUS + CLASP_MARK_STACK_GAP)],
    'the whole-note rings mirror about the midpoint'
  );

  // The same three subdivisions under the other three paradigms: an up-raked
  // slash, its down-raked mirror, and a symmetrical cross-stitch.
  const subdivisions = (s: 'kinetic-cross-slashes' | 'down-raked-slashes' | 'cross-hatch-stitches'): string =>
    renderChordClasp({ ...eighthGroup, durationStyle: s }, T);
  const up = /class="janko-clasp-slash" x1="[\d.-]+" y1="([\d.-]+)" x2="[\d.-]+" y2="([\d.-]+)"/.exec(
    subdivisions('kinetic-cross-slashes')
  )!;
  const down = /class="janko-clasp-slash" x1="[\d.-]+" y1="([\d.-]+)" x2="[\d.-]+" y2="([\d.-]+)"/.exec(
    subdivisions('down-raked-slashes')
  )!;
  assert.ok(Number(up[1]) > Number(up[2]), 'Candidate B rakes upward');
  assert.ok(Number(down[1]) < Number(down[2]), 'Candidate C rakes downward');
  const stitch = subdivisions('cross-hatch-stitches');
  assert.equal((stitch.match(/janko-clasp-stitch/g) ?? []).length, 1, 'Candidate D paints one `×`');
  assert.match(stitch, /class="janko-clasp-stitch" d="M [\d.-]+ [\d.-]+ L [\d.-]+ [\d.-]+ M [\d.-]+ [\d.-]+ L [\d.-]+ [\d.-]+"/);
});

// ---------------------------------------------------------------------------
// 4. Fit rule
// ---------------------------------------------------------------------------

test('The fit rule: only actual chords are clasped, and only where the bracket stands clear', () => {
  // Bach Var. 1 is a two-voice 16th-note texture: its measure-opening dyads are
  // clasped, while an interior dyad — whose predecessor sits exactly one disc
  // away — cannot host a 7.6pt bracket and keeps its traditional stems. Round 10
  // scales the duration marks to a 4pt reach across the spine, so a downbeat
  // bracket now needs 15.6pt of opening air; m. 3's dyad no longer fits and its
  // cluster keeps its traditional stems instead of colliding.
  const system0 = layouts('left-clasp-spire')[0];
  const ticks = system0.clasps.map((c) => c.tick);
  assert.deepEqual(
    ticks,
    [0, 144, 168, 240, 408, 432, 504, 528],
    'measure downbeats and the interior dyads with room'
  );
  assert.ok(!ticks.includes(24), 'the 16th-grid dyad at tick 24 is not clasped');
  for (const clasp of system0.clasps) {
    assert.ok(clasp.notes.length >= 2, 'a clasp always groups a vertical simultaneity');
  }
  // Every clasp clears every foreign disc and its opening barline.
  for (const layout of layouts('left-clasp-spire')) {
    for (const clasp of layout.clasps) {
      const ink = claspInkBox(clasp, T);
      const own = new Set(clasp.notes.map((n) => n.id));
      for (const p of layout.notes) {
        if (own.has(p.note.id)) continue;
        const dx = Math.max(ink.x0 - p.x, 0, p.x - ink.x1);
        const dy = Math.max(ink.y0 - p.y, 0, p.y - ink.y1);
        assert.ok(
          Math.hypot(dx, dy) >= T.noteheadRadius + CLASP_NOTEHEAD_AIR - 1e-6,
          `clasp at tick ${clasp.tick} clears ${p.note.id}`
        );
      }
      let leftBarline: number | null = null;
      for (const b of systemBarlines(layout, resolveJankoOptions({ ...DEFAULT_JANKO_OPTIONS, chordGrouping: 'left-clasp-spire' }), T)) {
        if (b.x <= clasp.claspX + 1e-6 && (leftBarline === null || b.x > leftBarline)) leftBarline = b.x;
      }
      if (leftBarline !== null) {
        assert.ok(
          clasp.claspX - leftBarline >= T.claspMinBarlineAir - 1e-6,
          `clasp at tick ${clasp.tick} keeps ${T.claspMinBarlineAir}pt of barline air`
        );
      }
    }
  }
  // A system whose clasp positions cannot stand are simply left unclasped: the
  // engine never paints a bracket the linter would have to report.
  const report = lintJankoScore(BACH, { ...DEFAULT_JANKO_OPTIONS, chordGrouping: 'left-clasp-spire' }, T);
  assert.equal(report.violations.length, 0);
  assert.equal(report.warnings.length, 0);
});

// ---------------------------------------------------------------------------
// 4b. Round 6/8 — the per-hand bracket scope
// ---------------------------------------------------------------------------

test('Round 8 bracket scope: spread clusters and 3-note chords qualify, 2-note columns do not', () => {
  // A clean 2-note vertical column of one hand is never grouped…
  assert.equal(
    computeClaspGeometry(
      [rn('a', 100, 100, 24), rn('b', 100, 130, 24)],
      T,
      { requireBracketScope: true }
    ),
    null,
    'a clean 2-note vertical column keeps its stems'
  );
  // …and neither is a lone note, however it sits on the row grid.
  assert.equal(
    computeClaspGeometry([rn('solo', 100, 100, 24)], T, { requireBracketScope: true }),
    null
  );
  // A row-snapped pair is exactly what the bracket exists for.
  const pair = computeClaspGeometry(
    [rn('a', 94.5, 100, 24), rn('b', 105.5, 130, 24)],
    T,
    { requireBracketScope: true }
  )!;
  assert.ok(pair.maxX - pair.minX > CLASP_MIN_HORIZONTAL_SPREAD);
  assert.equal(pair.topY, 100 - T.noteheadRadius, 'topY = min(y) − r of the hand');
  assert.equal(pair.botY, 130 + T.noteheadRadius, 'botY = max(y) + r of the hand');
  // Round 8: a vertical chord of three heads qualifies even without any
  // horizontal displacement (the ticket's `B - 4 - 7`).
  const chord = computeClaspGeometry(
    [rn('top', 100, 100, 48), rn('mid', 100, 130, 48), rn('low', 100, 160, 48)],
    T,
    { requireBracketScope: true }
  )!;
  assert.equal(chord.notes.length, CLASP_MIN_VERTICAL_CHORD);
  assert.equal(chord.claspX, 100 - T.noteheadRadius - T.claspOffset);

  // The scope predicate itself: 2 heads need spread; 3 heads never do.
  const two = [rn('a', 100, 100, 24), rn('b', 100, 130, 24)];
  assert.equal(claspQualifies(two), false, 'a 2-note column is left unbracketed');
  assert.equal(claspQualifies([...two, rn('c', 100, 160, 24)]), true, 'a 3-note column qualifies');
  assert.equal(
    claspQualifies([rn('a', 94.5, 100, 24), rn('b', 105.5, 130, 24)]),
    true,
    'a horizontal spread qualifies at any size'
  );

  // Bach's simultaneities are cross-hand vertical columns, so the refined
  // paradigm never merges them into a grand-staff mega-bracket …
  const bach = layouts('per-hand-clasp');
  assert.equal(
    bach.reduce((n, l) => n + l.clasps.length, 0),
    0,
    'no bracket on the cross-hand Bach columns'
  );

  // … while the dense Brahms writing carries the row-snapped hand clusters the
  // round targets (the 2-5-9 sonority among them).
  const o = resolveJankoOptions({
    ...BRAHMS_OP118_NO1_JANKO_OPTIONS,
    chordGrouping: 'per-hand-clasp',
  });
  const brahms = layoutJankoScore(BRAHMS, o, BRAHMS_T);
  const clasps = brahms.flatMap((l) => l.clasps);
  assert.ok(clasps.length >= 3, `Brahms hand clusters are clasped (${clasps.length})`);
  const r = BRAHMS_T.noteheadRadius;
  for (const clasp of clasps) {
    assert.equal(
      new Set(clasp.notes.map((n) => n.hand)).size,
      1,
      'a bracket never spans both hands'
    );
    assert.ok(
      claspQualifies(clasp.notes),
      'every bracket is either row-snapped or a 3-or-more-note vertical chord'
    );
    const xs = clasp.notes.map((n) => n.x);
    const spread = Math.max(...xs) - Math.min(...xs) > CLASP_MIN_HORIZONTAL_SPREAD;
    assert.ok(
      spread || clasp.notes.length >= CLASP_MIN_VERTICAL_CHORD,
      'the bracket scope holds after the column solve'
    );
    assert.equal(clasp.topY, Math.min(...clasp.notes.map((n) => n.y)) - r);
    assert.equal(clasp.botY, Math.max(...clasp.notes.map((n) => n.y)) + r);
    // Duration ownership: the bracket carries the shortest member value.
    assert.equal(
      clasp.durationTicks,
      Math.min(...clasp.notes.map((n) => n.durationTicks)),
      'the clasp carries the cluster duration on its spine'
    );
    // A downbeat bracket keeps its barline air (≥ 3.5pt; the token holds 4.0).
    const layout = brahms.find((l) => l.clasps.includes(clasp))!;
    const leftBarline = systemBarlines(layout, o, BRAHMS_T).reduce(
      (best, b) => (b.x <= clasp.claspX + 1e-6 && b.x > best ? b.x : best),
      Number.NEGATIVE_INFINITY
    );
    if (Number.isFinite(leftBarline)) {
      assert.ok(
        clasp.claspX - leftBarline >= BRAHMS_T.claspMinBarlineAir - 1e-6,
        `clasp at tick ${clasp.tick} keeps ${BRAHMS_T.claspMinBarlineAir}pt of barline air`
      );
      assert.ok(BRAHMS_T.claspMinBarlineAir >= 3.5, 'the ticket floor is 3.5pt');
    }
  }
  // Duration ownership: a member whose stem is not part of a real beam loses its
  // standalone stem, because the bracket now carries the value.
  const beamed = new Set(
    brahms.flatMap((l) => l.beams.flatMap((b) => b.notes.map((n) => n.id)))
  );
  for (const layout of brahms) {
    for (const id of layout.claspedStems) {
      assert.ok(!beamed.has(id), `${id} is not inside a beam`);
      assert.ok(
        clasps.some((c) => c.notes.some((n) => n.id === id)),
        `${id} belongs to a per-hand clasp`
      );
    }
    for (const clasp of layout.clasps) {
      if (clasp.notes.some((n) => beamed.has(n.id))) continue;
      for (const n of clasp.notes) {
        assert.ok(layout.claspedStems.includes(n.id), `${n.id} loses its standalone stem`);
      }
    }
  }
  assert.ok(
    clasps.some((c) => c.notes.every((n) => !beamed.has(n.id))),
    'the Brahms clasps really replace standalone stems'
  );
  // The mm. 7–8 window's 2-5-9 sonority is clasped as one right-hand bracket
  // whose vertical reach spans the hand's full (corridor-crossing) stretch.
  const target = clasps.find((c) => c.tick === 1200);
  assert.ok(target, 'the 2-5-9 sonority is clasped');
  const onset = BRAHMS.notes.filter((n) => n.startTick === 1200 && n.hand === 'RH');
  const classes = onset.map((n) => n.pitch.pitchClass);
  assert.ok([2, 5, 9].every((pc) => classes.includes(pc)), 'the ticket’s 2-5-9 sonority');
  assert.equal(target!.notes.length, onset.length, 'the bracket groups the whole hand onset');
  assert.equal(
    new Set(target!.notes.map((n) => n.x)).size > 1,
    true,
    'the bracket exists because the hand cluster is row-snapped'
  );

  const report = lintJankoScore(
    BRAHMS,
    { ...BRAHMS_OP118_NO1_JANKO_OPTIONS, chordGrouping: 'per-hand-clasp' },
    BRAHMS_T
  );
  assert.equal(report.ok, true);
  assert.equal(report.warnings.length, 0, 'the per-hand refinement adds no warning');
});

// ---------------------------------------------------------------------------
// 4c. Round 7/8 — the B - 2 - 8 clasp and the B - 4 - 7 3-note bracket
// ---------------------------------------------------------------------------

test('Round 7 Option 3 grammar: tight pairs stay silent, a wide leap gets its bridge', () => {
  // A 2-note vertical column of one hand: Δy = 30pt is a wide leap.
  const group = computeVerticalChordGroup(
    [rn('top', 100, 605.76, 48), rn('low', 100, 661.76, 84)],
    T
  )!;
  assert.equal(group.carrier.id, 'top', 'an up-stem hand hands its duration to the topmost head');
  assert.equal(group.durationTicks, 48, 'the carrier draws the hand’s shortest member value');
  assert.deepEqual(group.suppressedIds, ['low'], 'the interior head draws no stem');
  assert.equal(group.bridges.length, 1, 'the wide leap earns a bridge');
  const bridge = group.bridges[0];
  assert.equal(bridge.x, 100, 'the bridge runs on the shared column');
  assert.equal(bridge.y1, 605.76 + T.noteheadRadius + CHORD_BRIDGE_DISC_AIR);
  assert.equal(bridge.y2, 661.76 - T.noteheadRadius - CHORD_BRIDGE_DISC_AIR);
  assert.ok(
    bridge.y2 - bridge.y1 > CHORD_BRIDGE_MIN_GAP - 2 * T.noteheadRadius,
    'the bridge spans the leap, not just the discs'
  );
  assert.deepEqual(bridge.noteIds, ['top', 'low']);

  // A tight pair (Δy = 15pt) draws no connecting ink at all.
  const tight = computeVerticalChordGroup(
    [rn('t', 100, 100, 24), rn('b', 100, 115, 24)],
    T
  )!;
  assert.equal(tight.bridges.length, 0, 'a tight pair stays silent');

  // A down-stem (LH) hand mirrors the grammar: the bottommost head carries it.
  const lh = computeVerticalChordGroup(
    [
      { ...rn('lh-top', 100, 700, 24), hand: 'LH' as const },
      { ...rn('lh-bot', 100, 730, 24), hand: 'LH' as const },
    ],
    T
  )!;
  assert.equal(lh.carrier.id, 'lh-bot');
  assert.deepEqual(lh.suppressedIds, ['lh-top']);
  assert.equal(lh.bridges.length, 1, 'Δy = 30pt is a wide leap');

  // Vertical only: a row-snapped cluster belongs to the external clasp instead.
  assert.equal(
    computeVerticalChordGroup([rn('a', 94.5, 100, 24), rn('b', 105.5, 130, 24)], T),
    null,
    'a horizontally spread hand cluster is never gap-gated'
  );
});

test('Round 8: B - 2 - 8 keeps its clasp, and B - 4 - 7 becomes a 3-note bracket', () => {
  const o = resolveJankoOptions({
    ...BRAHMS_OP118_NO1_JANKO_OPTIONS,
    chordGrouping: 'per-hand-clasp',
  });
  const systems = layoutJankoScore(BRAHMS, o, BRAHMS_T);

  // B - 2 - 8 (m. 7, tick 1296): the RH cluster is row-snapped while its LH
  // partner shares one whole-tone row. The same-onset partner travels with the
  // solved column, so the bracket is admitted instead of silently dropped.
  const b28 = systems.flatMap((l) => l.clasps).find((c) => c.tick === 1296);
  assert.ok(b28, 'the B - 2 - 8 cluster carries its clasp');
  assert.equal(new Set(b28!.notes.map((n) => n.hand)).size, 1, 'strictly one hand');
  assert.ok(
    new Set(b28!.notes.map((n) => n.x)).size > 1,
    'the B - 2 - 8 bracket is the row-snapped hand cluster'
  );
  assert.ok(
    BRAHMS.notes.some((n) => n.startTick === 1296 && n.hand === 'LH'),
    'the concurrent LH partner is present'
  );

  // B - 4 - 7 (m. 8, tick 1488): one vertical RH column of three heads. Round 8
  // widens the bracket scope to 3-note chords, so it is bracketed — and, being
  // bracketed, it is never also gap-gated by Option 3.
  const system2 = systems[2];
  const chord = system2.clasps.find((c) => c.tick === 1488);
  assert.ok(chord, 'the B - 4 - 7 vertical hand chord carries a bracket');
  assert.equal(chord!.notes.length, CLASP_MIN_VERTICAL_CHORD, 'three heads in one hand');
  assert.equal(new Set(chord!.notes.map((n) => n.hand)).size, 1, 'strictly one hand');
  assert.equal(
    new Set(chord!.notes.map((n) => n.x)).size,
    1,
    'the bracket exists although the column is clean and vertical'
  );
  assert.ok(
    !system2.verticalChords.some((c) => c.carrier.startTick === 1488),
    'a bracketed chord is never double-encoded by Option 3'
  );
  // The 2-note columns of the earlier systems stay with Option 3.
  const optionThree = systems.flatMap((l) => l.verticalChords);
  assert.ok(optionThree.length > 0, 'clean 2-note columns keep the gap-gated grammar');
  for (const group of optionThree) {
    assert.equal(group.suppressedIds.length, 1, 'Option 3 now handles 2-note columns only');
  }

  const svg = renderJankoCrop(BRAHMS, 8, 1, o, BRAHMS_T);
  assert.match(svg, /class="janko-clasp-group"[^>]*data-clasp-tick="1488"/, 'the bracket is painted');
  for (const n of chord!.notes) {
    assert.ok(system2.claspedStems.includes(n.id), `${n.id} hands its duration to the bracket`);
  }
  assert.equal(
    (svg.match(/class="janko-chord-bridge"/g) ?? []).length,
    0,
    'no bridge is drawn inside the bracketed chord'
  );
  assert.equal(
    (svg.match(/class="janko-clasp-band"/g) ?? []).length,
    0,
    'the default paradigm is not the diamond band'
  );
  assert.ok(
    svg.includes('data-clasp-duration-style="kinetic-cross-slashes"'),
    'the standardized up-raked 12.4° duration paradigm'
  );
});

// ---------------------------------------------------------------------------
// 5. Barline clearance & the inset budget
// ---------------------------------------------------------------------------

test('Downbeat clasps keep their barline air — the measure pays for it out of its closing margin', () => {
  const o = resolveJankoOptions({ ...DEFAULT_JANKO_OPTIONS, chordGrouping: 'left-clasp-spire' });
  const geo = computePageGeometry(o, T);
  const system0 = getSystemGeometry(geo, 0);
  const insets = computeClaspInsetMap(BACH, system0, 0, o, T);
  assert.ok(insets.size > 0, 'Bach opens chords on measure downbeats');
  for (const [measureIdx, required] of insets) {
    assert.equal(required, getClaspDownbeatInset(T), `measure ${measureIdx} reserves the clasp inset`);
  }

  // The budget rule: `left + right` stays at `2 × measureInset` while the air a
  // downbeat bracket needs fits inside that budget. Round 10's scaled marks
  // reach 4pt across the spine, so a downbeat clasp asks for 15.6pt — more than
  // the canonical 12pt budget — and the opening measure's field is *uniformly*
  // scaled by the shortfall instead of shearing any single beat.
  const canonical = getMeasureOpeningBarlineX(1, system0, 0, T)! - system0.staffLeft;
  assert.equal(canonical, system0.measureWidth, 'measure 2 opens one measure width in');
  const layoutsWithClasps = layouts('left-clasp-spire');
  const measureWidth = system0.measureWidth;
  const widths = new Set<number>();
  for (const layout of layoutsWithClasps) {
    for (const p of layout.notes) {
      const m = Math.floor((p.note.startTick % (4 * o.ticksPerMeasure)) / o.ticksPerMeasure);
      const left = getMeasureOpeningBarlineX(m, layout.geometry, layout.index, T);
      if (left === null) continue;
      widths.add(Number((p.x - left).toFixed(6)));
    }
  }
  // Every note still starts at least `measureInset` inside its measure, and the
  // downsweep of the 16th grid is identical to the golden master's.
  const gilt = layouts('none');
  const goldenGrid = gilt[0].notes
    .filter((p) => p.note.startTick < o.ticksPerMeasure)
    .sort((a, b) => a.note.startTick - b.note.startTick)
    .map((p, i, all) => (i === 0 ? 0 : p.x - all[i - 1].x));
  const claspGrid = layoutsWithClasps[0].notes
    .filter((p) => p.note.startTick < o.ticksPerMeasure)
    .sort((a, b) => a.note.startTick - b.note.startTick)
    .map((p, i, all) => (i === 0 ? 0 : p.x - all[i - 1].x));
  const ratios = claspGrid
    .map((v, i) => (goldenGrid[i] === 0 ? null : v / goldenGrid[i]))
    .filter((v): v is number => v !== null);
  assert.ok(ratios.length > 0, 'the measure really carries a grid');
  for (const ratio of ratios) {
    assert.ok(
      Math.abs(ratio - ratios[0]) < 1e-9,
      'the measure keeps a proportional (uniformly scaled) grid, never a sheared one'
    );
  }
  assert.ok(ratios[0] <= 1 + 1e-9, 'the scaled marks never stretch the measure');
  assert.ok(
    ratios[0] >= 0.9,
    `the scaled marks cost at most the budget shortfall (scale ${ratios[0].toFixed(4)})`
  );
  assert.ok(measureWidth > 0);
  assert.ok(widths.size > 0);
});

test('The admission loop demotes a measure whose own content cannot absorb the shift', () => {
  const o = resolveJankoOptions({ ...DEFAULT_JANKO_OPTIONS, chordGrouping: 'left-clasp-spire' });
  const geo = computePageGeometry(o, T);
  const system0 = getSystemGeometry(geo, 0);
  const insets = computeClaspInsetMap(BACH, system0, 0, o, T);
  assert.ok(insets.has(2), 'm. 3 opens on a chord and asks for the inset');
  // m. 3's row-snapped pair on beat 3 leaves no room for the widening: the
  // engine withdraws the inset, so m. 3 keeps the canonical margins. Round 7
  // then steps the clasped column right until the bracket clears the barline,
  // so the bracket survives the demotion instead of being dropped with it.
  const layout = layouts('left-clasp-spire')[0];
  const m3 = layout.clasps.filter((c) => c.tick >= 288 && c.tick < 432);
  assert.ok(m3.length >= 1, 'm. 3 keeps its bracket through the column shift');
  const opening = getMeasureOpeningBarlineX(2, system0, 0, T);
  assert.ok(opening !== null, 'm. 3 follows a barline');
  for (const clasp of m3) {
    assert.ok(
      claspInkBox(clasp, T).x0 - opening! >= T.claspMinBarlineAir - 1e-6,
      'the shifted bracket keeps its full barline air'
    );
  }
  const collisions = measuresWithColumnCollisions(
    layout.notes,
    layout.geometry,
    layout.index,
    T
  );
  assert.deepEqual([...collisions], [], 'no measure breaks a hard column rule');
  const barlines = systemBarlines(layout, o, T);
  for (const p of layout.notes) {
    for (const b of barlines) {
      const verticalGap = Math.max(b.top - p.y, 0, p.y - b.bottom);
      if (verticalGap > T.noteheadRadius) continue;
      assert.ok(
        Math.abs(p.x - b.x) - T.noteheadRadius >= 1.0 - 1e-6,
        `${p.note.id} keeps barline air`
      );
    }
  }
});

test('A measure that cannot host the bracket loses it instead of colliding (edge case)', () => {
  // A synthetic two-measure score whose second measure carries a note one tick
  // before its barline: the budget shift would drive that head into the closing
  // barline, so the admission loop withdraws the widening (and the bracket) for
  // that measure and the engraving stays clean.
  const edge: QuantizedGridScore = {
    id: 'clasp-edge-case',
    title: 'Clasp edge case',
    totalTicks: 288,
    notes: (
      [
        [0, 0, 4, 'RH'],
        [0, 4, 4, 'RH'],
        [143, 7, 4, 'RH'],
        [144, 2, 4, 'RH'],
        [144, 6, 4, 'RH'],
        [287, 9, 4, 'RH'],
      ] as Array<[number, number, number, 'RH' | 'LH']>
    ).map(([startTick, pitchClass, octave, hand], i) => ({
      id: `edge-${i}`,
      pitch: { pitchClass, octave },
      startTick,
      durationTicks: 24,
      hand,
      velocity: 90,
    })),
  } as QuantizedGridScore;

  for (const mode of ['left-clasp-spire', 'beamed-clasp-rail', 'bounding-phrase'] as const) {
    const options = resolveJankoOptions({
      ...DEFAULT_JANKO_OPTIONS,
      chordGrouping: mode,
      measuresPerSystem: 2,
      systemsPerPage: 1,
    });
    const report = lintJankoScore(edge, options, T);
    assert.deepEqual(
      report.diagnostics.map((d) => `${d.code}: ${d.message}`),
      [],
      `${mode} demotes the cramped measure instead of colliding`
    );
    const layouts = layoutJankoScore(edge, options, T);
    assert.ok(
      layouts.reduce((n, l) => n + l.clasps.length, 0) >= 1,
      `${mode} still clasps the measure that can host a bracket`
    );
    // The demoted measure is the one with the pre-barline 16th (m. 2).
    const demoted = layouts[0].clasps.every((c) => c.tick < 144);
    assert.equal(demoted, true, `${mode} engraves no bracket in the cramped measure`);
  }
});

// ---------------------------------------------------------------------------
// 6. The beamed-clasp rail
// ---------------------------------------------------------------------------

test('Beamed clasp rail: contiguous clasps of one measure join at the spines, inside the measure', () => {
  const railed = layouts('beamed-clasp-rail', BRAHMS, BRAHMS_OP118_NO1_JANKO_OPTIONS, BRAHMS_T);
  const plain = layouts('left-clasp-spire', BRAHMS, BRAHMS_OP118_NO1_JANKO_OPTIONS, BRAHMS_T);
  const total = railed.reduce((n, l) => n + l.claspRails.length, 0);
  assert.ok(total >= 2, `Brahms chord sequences produce rails (${total})`);
  assert.equal(
    railed.reduce((n, l) => n + l.clasps.length, 0),
    plain.reduce((n, l) => n + l.clasps.length, 0),
    'the rail paradigm clasps exactly the same clusters'
  );

  const o = resolveJankoOptions({ ...BRAHMS_OP118_NO1_JANKO_OPTIONS, chordGrouping: 'beamed-clasp-rail' });
  for (const layout of railed) {
    const barlines = systemBarlines(layout, o, BRAHMS_T);
    const railedTicks = new Set<number>();
    for (const rail of layout.claspRails) {
      assert.ok(rail.x2 > rail.x1, 'a rail always spans at least two spine columns');
      assert.equal(rail.level, 1, 'every joined run carries the primary rail');
      assert.ok(rail.noteIds.length >= 4, 'at least two clasps (two notes each) per rail');
      for (const b of barlines) {
        assert.ok(
          rail.x1 - 1.0 >= b.x || b.x >= rail.x2 + 1.0,
          `rail ${rail.x1.toFixed(2)}..${rail.x2.toFixed(2)} terminates inside its measure`
        );
      }
      assert.ok(railClearsLayout(rail, layout.notes, BRAHMS_T), 'the rail clears every foreign disc');
      // The rail sits exactly on the topmost extended spine top of the run.
      const joined = layout.clasps.filter((c) => c.notes.every((n) => rail.noteIds.includes(n.id)));
      assert.ok(joined.length >= 2, 'a rail joins at least two clasps');
      for (const clasp of joined) {
        assert.equal(clasp.topY, rail.y, 'every joined bracket spine is extended up to the rail');
        assert.equal(clasp.flags, 0, 'the rail replaces the duration notches');
        railedTicks.add(clasp.tick);
      }
    }
    // A run is measure-bounded: no rail may join clasps of two measures
    // (`splitTick` resolves the cut-time upbeat's 48-tick anacrusis).
    for (const rail of layout.claspRails) {
      const measures = new Set(
        layout.clasps
          .filter((c) => rail.noteIds.includes(c.notes[0].id))
          .map((c) => splitTick(c.tick, BRAHMS_T).measureOffset)
      );
      assert.equal(measures.size, 1, 'one rail, one measure');
    }
  }

  // Every clasp that is NOT part of a run keeps its duration notches.
  const railedClaspTicks = new Set(
    railed.flatMap((l) => l.claspRails.flatMap((r) => l.clasps.filter((c) => r.noteIds.includes(c.notes[0].id)).map((c) => c.tick)))
  );
  for (const layout of railed) {
    for (const clasp of layout.clasps) {
      if (!railedClaspTicks.has(clasp.tick)) continue;
      assert.equal(clasp.flags, 0);
    }
  }
  const report = lintJankoScore(
    BRAHMS,
    { ...BRAHMS_OP118_NO1_JANKO_OPTIONS, chordGrouping: 'beamed-clasp-rail' },
    BRAHMS_T
  );
  assert.deepEqual(report.diagnostics, [], 'the railed engraving is completely clean');
});

// ---------------------------------------------------------------------------
// 7. Engine integrity & full-score cleanliness
// ---------------------------------------------------------------------------

test('Engine integrity: a real 16th-note beam is never cut, only standalone chord stems are replaced', () => {
  // The unclasped paradigm is the historical baseline of this comparison, not
  // the golden master any more (Round 14 restored the per-hand clasp).
  const unclasped = layouts('none');
  for (const mode of ['left-clasp-spire', 'beamed-clasp-rail', 'bounding-phrase'] as const) {
    const withClasps = layouts(mode);
    // Beams are byte-identical in count and geometry: the clasp groups clusters,
    // it never re-partitions melodic writing.
    assert.deepEqual(
      withClasps.map((l) => l.beams.map((b) => b.notes.map((n) => n.id).join(','))),
      unclasped.map((l) => l.beams.map((b) => b.notes.map((n) => n.id).join(','))),
      `${mode} keeps every beam group`
    );
    // Only notes that are NOT part of a beam may lose their standalone stem, and
    // every suppressed stem belongs to a clasp.
    const beamed = new Set(withClasps.flatMap((l) => l.beams.flatMap((b) => b.notes.map((n) => n.id))));
    const clasped = new Set(withClasps.flatMap((l) => l.clasps.flatMap((c) => c.notes.map((n) => n.id))));
    for (const id of withClasps.flatMap((l) => l.claspedStems)) {
      assert.ok(!beamed.has(id), `${mode}: ${id} is not inside a beam`);
      assert.ok(clasped.has(id), `${mode}: ${id} belongs to a clasp`);
    }
    // Every clasp whose members are all unbeamed actually replaces their stems.
    for (const layout of withClasps) {
      for (const clasp of layout.clasps) {
        if (clasp.notes.some((n) => beamed.has(n.id))) continue;
        for (const n of clasp.notes) {
          assert.ok(layout.claspedStems.includes(n.id), `${n.id} loses its standalone stem`);
        }
      }
    }
  }
  // The unclasped paradigm replaces nothing (and paints every stem straight
  // through its chord tones — the defect `stem-through-simultaneity` names).
  assert.deepEqual(unclasped.flatMap((l) => l.claspedStems), []);
  assert.deepEqual(unclasped.flatMap((l) => l.clasps), []);
});

test('Every clasping paradigm engraves both benchmarks with zero diagnostics', () => {
  for (const mode of JANKO_CHORD_GROUPINGS) {
    const bach = lintJankoScore(BACH, { ...DEFAULT_JANKO_OPTIONS, chordGrouping: mode }, T);
    assert.deepEqual(
      bach.diagnostics.map((d) => `${d.code}: ${d.message}`),
      [],
      `Bach · ${mode}`
    );
    const brahms = lintJankoScore(
      BRAHMS,
      { ...BRAHMS_OP118_NO1_JANKO_OPTIONS, chordGrouping: mode },
      BRAHMS_T
    );
    if (mode === 'none') {
      // Round 14: the unclasped paradigm is exactly the regression the new
      // simultaneity audit exists to catch — it paints one full-length stem per
      // chord tone, straight through the discs of its own simultaneity. It is
      // the only diagnostic the unclasped rendering may produce.
      assert.ok(brahms.diagnostics.length > 0, 'Brahms · none trips the simultaneity audit');
      assert.deepEqual(
        [...new Set(brahms.diagnostics.map((d) => d.code))],
        ['stem-through-simultaneity'],
        'the unclasped paradigm fails on nothing but the stems through its chord tones'
      );
      assert.ok(
        brahms.diagnostics.every((d) => d.severity === 'error'),
        'a painted stem through a chord tone is a violation, never a warning'
      );
      continue;
    }
    assert.deepEqual(
      brahms.diagnostics.map((d) => `${d.code}: ${d.message}`),
      [],
      `Brahms · ${mode}`
    );
  }
  assert.ok(
    JANKO_LINT_CHECKS.includes('clasp-clearance'),
    'the clasp audit is part of the published check list'
  );
  assert.ok(
    JANKO_LINT_CHECKS.includes('stem-simultaneity'),
    'the Round 14 simultaneity audit is part of the published check list'
  );
});

test('The bounding-phrase paradigm groups whole measures, not single simultaneities', () => {
  const phrase = layouts('bounding-phrase');
  for (const layout of phrase) {
    const measures = new Map<number, number>();
    for (const clasp of layout.clasps) {
      const m = Math.floor(clasp.tick / resolveJankoOptions(DEFAULT_JANKO_OPTIONS).ticksPerMeasure);
      measures.set(m, (measures.get(m) ?? 0) + 1);
    }
    for (const [m, count] of measures) {
      assert.equal(count, 1, `measure ${m + 1} carries exactly one phrase bracket`);
    }
    for (const clasp of layout.clasps) {
      const members = new Set(clasp.notes.map((n) => n.id));
      const m = Math.floor(clasp.tick / resolveJankoOptions(DEFAULT_JANKO_OPTIONS).ticksPerMeasure);
      const measureNotes = layout.notes.filter(
        (p) => Math.floor(p.note.startTick / resolveJankoOptions(DEFAULT_JANKO_OPTIONS).ticksPerMeasure) === m
      );
      assert.equal(members.size, measureNotes.length, 'the bracket bounds every note of its measure');
    }
  }
  // The phrase bracket still carries the measure's opening duration at its tip.
  const first = phrase[0].clasps[0];
  assert.ok(['pip', 'double-pip', 'spire', 'spire-one-flag', 'spire-two-flags'].includes(first.duration));
  const report = lintJankoScore(BACH, { ...DEFAULT_JANKO_OPTIONS, chordGrouping: 'bounding-phrase' }, T);
  assert.equal(report.ok, true);
});

test('Clasp clusters are collected per onset, inside their measure, and deterministic', () => {
  const o = resolveJankoOptions({ ...DEFAULT_JANKO_OPTIONS, chordGrouping: 'left-clasp-spire' });
  const system0 = layouts('left-clasp-spire')[0];
  const clusters = collectClaspClusters(system0.notes, system0.geometry, 0, o, T, null);
  assert.ok(clusters.length > 0);
  for (const cluster of clusters) {
    assert.ok(cluster.notes.length >= 2, 'a cluster is a vertical simultaneity');
    assert.equal(new Set(cluster.notes.map((p) => p.note.startTick)).size, 1, 'one onset per cluster');
    assert.ok(
      cluster.measureIdx >= 0 && cluster.measureIdx < o.measuresPerSystem,
      'every cluster belongs to a measure of its own system'
    );
  }
  // The solve is a pure function of the score: two runs agree bit for bit.
  const options = { ...DEFAULT_JANKO_OPTIONS, chordGrouping: 'left-clasp-spire' as const };
  assert.equal(renderJankoCrop(BACH, 1, 2, options, T), renderJankoCrop(BACH, 1, 2, options, T));

  // A cluster's onset column is the beat column the row-snapped solver resolved:
  // the clasp spine therefore sits exactly `r + claspOffset` left of the
  // leftmost member head.
  for (const clasp of system0.clasps) {
    const leftmost = Math.min(...clasp.notes.map((n) => n.x));
    assert.equal(clasp.claspX, leftmost - T.noteheadRadius - T.claspOffset);
  }
});
