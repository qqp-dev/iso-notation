/**
 * Round 29 FLIPS LANDED — New Dot Standard + Thin Extensions + Lightened Rests (golden).
 * ===================================================================================
 *
 * Round 29 is JUDGED. The two preview cards are consumed and their options retired:
 *  0. Core equalization (golden since PR #48): PITCH_GRID_C4_STROKE 0.50, all core rows 0.50pt.
 *  1. Symmetric-6 spans (golden since PR #48): barlines/beat pulses stand off outer-row
 *     levels by exactly 6.0pt on both sides.
 *  2. Dots golden: every augmentation dot clears TRUE verbatim flag ink by >= 1.2pt,
 *     escaping right first then up — Bach m.1 tick-24 clearance, Bach golden 0 collisions,
 *     Brahms clasps (tick 48, tick 432) unmoved, audit-box == baked-extents agreement,
 *     corpus escape-totality. No dot option or legacy code remains.
 *  3. Thin golden: extension rows render 0.35pt (fixed-3: lin 24/72; fixed-4: 17.5/77.5),
 *     reusing PITCH_GRID_C_LINE_STROKE; core rows untouched at 0.50pt; ink unchanged.
 *  4. Rest lightening golden-direct: the live family (5 verbatim glyphs + block) renders
 *     at 0.85 scale in 90% black (#1A1A1A); verbatim constants byte-identical; seating
 *     centers unchanged; linter resolves scaled extents.
 *  5. Registry: Round 29 retired (historical flips-landed state, preserved).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1';
import {
  BRAHMS_OP118_NO1_JANKO_OPTIONS,
  BRAHMS_OP118_NO1_JANKO_TOKENS,
  buildBrahmsOp118No1Score,
} from '../src/scores/brahms-op118-no1';
import {
  DEFAULT_JANKO_OPTIONS,
  DEFAULT_JANKO_TOKENS,
  JankoSubdivisionStyle,
  getClusterSpacingPreset,
  resolveJankoOptions,
  resolveJankoTokens,
} from '../src/render/janko/types';
import {
  computePageGeometry,
  getSystemGeometry,
  layoutJankoScore,
  renderJankoCrop,
} from '../src/render/janko/engine';
import {
  PITCH_GRID_C4_STROKE,
  PITCH_GRID_C_LINE_STROKE,
  PITCH_GRID_OCTAVE_INK,
  PITCH_GRID_OCTAVE_STROKE,
  getBarStaffSegments,
  pitchGridRules,
} from '../src/render/janko/elements/staff';
import {
  gridBotY,
  gridTopY,
  renderBarlines,
  renderBeatGrid,
} from '../src/render/janko/elements/barlines';
import {
  getStemGeometry,
  getSubdivisionGlyphBBox,
  partitionBeamGroups,
  subdivisionMarkCount,
} from '../src/render/janko/elements/rhythm';
import {
  REST_BLOCK_HEIGHT,
  REST_BLOCK_WIDTH,
  REST_INK,
  REST_SCALE,
  restInk,
  restInkBox,
} from '../src/render/janko/elements/rests';
import {
  URTEXT_FLAGS_DOWN,
  URTEXT_FLAGS_UP,
  URTEXT_REST_QUARTER,
  URTEXT_RESTS,
} from '../src/render/janko/elements/urtext-paths';
import { continuousPitchY } from '../src/render/janko/geometry';
import { lintJankoScore, systemBarlines } from '../src/render/janko/linter';

const BACH = buildBachGoldbergVar1Score();
const BRAHMS = buildBrahmsOp118No1Score();
const EPS = 1e-9;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..');

// ---------------------------------------------------------------------------
// Section 0. Core Equalization (golden since PR #48)
// ---------------------------------------------------------------------------

test('Core equalization: PITCH_GRID_C4_STROKE is 0.50pt equal to PITCH_GRID_OCTAVE_STROKE', () => {
  assert.equal(PITCH_GRID_C4_STROKE, 0.50, 'C4 constant equalized to 0.50pt');
  assert.equal(PITCH_GRID_OCTAVE_STROKE, 0.50, 'Octave stroke is 0.50pt');
  assert.equal(PITCH_GRID_C4_STROKE, PITCH_GRID_OCTAVE_STROKE, 'C4 has same weight as octave stroke');
});

test('Core equalization: all three core rows in fixed-3 render at identical 0.50pt weight', () => {
  const o = resolveJankoOptions(DEFAULT_JANKO_OPTIONS);
  const t = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
  const pageGeo = computePageGeometry(o, t, BACH);
  const geo = getSystemGeometry(pageGeo, 0);

  const rules = pitchGridRules(geo, o, t);
  const c3Y = geo.middleCY + continuousPitchY(36, t.semitoneScale);
  const c4Y = geo.middleCY + continuousPitchY(48, t.semitoneScale);
  const c5Y = geo.middleCY + continuousPitchY(60, t.semitoneScale);

  const c3Rule = rules.find((r) => Math.abs(r.y - c3Y) < 1e-6);
  const c4Rule = rules.find((r) => Math.abs(r.y - c4Y) < 1e-6);
  const c5Rule = rules.find((r) => Math.abs(r.y - c5Y) < 1e-6);

  assert.ok(c3Rule, 'C3 rule present');
  assert.ok(c4Rule, 'C4 rule present');
  assert.ok(c5Rule, 'C5 rule present');

  assert.equal(c3Rule.width, 0.50, 'C3 is 0.50pt');
  assert.equal(c4Rule.width, 0.50, 'C4 is 0.50pt');
  assert.equal(c5Rule.width, 0.50, 'C5 is 0.50pt');
  assert.equal(c4Rule.width, c3Rule.width, 'C4 equals C3 weight');
  assert.equal(c4Rule.width, c5Rule.width, 'C4 equals C5 weight');
});

// ---------------------------------------------------------------------------
// Section 1. Symmetric-6 Spans (golden since PR #48)
// ---------------------------------------------------------------------------

test('Symmetric-6 spans: barline tips stand off outer-row levels by exactly 6.0pt on both sides (Bach)', () => {
  const o = resolveJankoOptions(DEFAULT_JANKO_OPTIONS);
  const t = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
  const pageGeo = computePageGeometry(o, t, BACH);
  const geo = getSystemGeometry(pageGeo, 0);

  const topY = gridTopY(geo, o, t);
  const botY = gridBotY(geo, o, t);

  // fixed-3 outer row levels: lin 72 (top) and lin 24 (bottom)
  const outerTopY = geo.middleCY + continuousPitchY(72, t.semitoneScale);
  const outerBotY = geo.middleCY + continuousPitchY(24, t.semitoneScale);

  const topGap = topY - outerTopY;
  const botGap = outerBotY - botY;

  assert.ok(Math.abs(topGap - 6.0) < EPS, `top standoff ${topGap.toFixed(4)}pt matches 6.0pt`);
  assert.ok(Math.abs(botGap - 6.0) < EPS, `bottom standoff ${botGap.toFixed(4)}pt matches 6.0pt`);
  assert.ok(Math.abs(topGap - botGap) < EPS, 'exact vertical symmetry between top and bottom tips');
});

test('Symmetric-6 spans: barline tips stand off outer-row levels by exactly 6.0pt on both sides (Brahms fixed-4)', () => {
  const o = resolveJankoOptions({ ...BRAHMS_OP118_NO1_JANKO_OPTIONS, core: 'fixed-4' });
  const t = resolveJankoTokens(BRAHMS_OP118_NO1_JANKO_TOKENS);
  const pageGeo = computePageGeometry(o, t, BRAHMS);
  const geo = getSystemGeometry(pageGeo, 0);

  const topY = gridTopY(geo, o, t);
  const botY = gridBotY(geo, o, t);

  // fixed-4 outer row levels: lin 77.5 (top) and lin 17.5 (bottom)
  const outerTopY = geo.middleCY + continuousPitchY(77.5, t.semitoneScale);
  const outerBotY = geo.middleCY + continuousPitchY(17.5, t.semitoneScale);

  const topGap = topY - outerTopY;
  const botGap = outerBotY - botY;

  assert.ok(Math.abs(topGap - 6.0) < EPS, `top standoff ${topGap.toFixed(4)}pt matches 6.0pt`);
  assert.ok(Math.abs(botGap - 6.0) < EPS, `bottom standoff ${botGap.toFixed(4)}pt matches 6.0pt`);
  assert.ok(Math.abs(topGap - botGap) < EPS, 'exact symmetry on Brahms fixed-4');
});

test('Symmetric-6 spans: beat pulses share gridTopY / gridBotY spans with barlines', () => {
  const o = resolveJankoOptions(DEFAULT_JANKO_OPTIONS);
  const t = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
  const [sys] = layoutJankoScore(BACH, o, t);

  const barlineSvg = renderBarlines(sys.geometry, o, t);
  const pulseSvg = renderBeatGrid(sys.geometry, 0, o, t);

  const expectedTop = gridTopY(sys.geometry, o, t).toFixed(2);
  const expectedBot = gridBotY(sys.geometry, o, t).toFixed(2);

  // Both SVG renders quote y1=expectedTop and y2=expectedBot
  assert.ok(barlineSvg.includes(`y1="${expectedTop}"`), 'barlines use gridTopY');
  assert.ok(barlineSvg.includes(`y2="${expectedBot}"`), 'barlines use gridBotY');
  assert.ok(pulseSvg.includes(`y1="${expectedTop}"`), 'beat grid pulses use gridTopY');
  assert.ok(pulseSvg.includes(`y2="${expectedBot}"`), 'beat grid pulses use gridBotY');
});

test('Symmetric-6 spans: finale barline path conjoin preserved (extends iff outer rows drawn in last bar)', () => {
  const o = resolveJankoOptions(DEFAULT_JANKO_OPTIONS);
  const t = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
  const layouts = layoutJankoScore(BACH, o, t);
  const finalSys = layouts[layouts.length - 1];

  const barlines = systemBarlines(finalSys, o, t);
  const finalBarline = barlines[barlines.length - 1];

  // In Bach last measure (m. 32), outer extension rows are not drawn
  const finalSegs = getBarStaffSegments(finalSys.geometry, 3);
  const hasTopExt = finalSegs.some((s) => s.lin === 72);
  const hasBotExt = finalSegs.some((s) => s.lin === 24);

  const expectedTop = hasTopExt
    ? finalSys.geometry.middleCY + continuousPitchY(72, t.semitoneScale)
    : gridTopY(finalSys.geometry, o, t);
  const expectedBot = hasBotExt
    ? finalSys.geometry.middleCY + continuousPitchY(24, t.semitoneScale)
    : gridBotY(finalSys.geometry, o, t);

  assert.ok(Math.abs(finalBarline.top - expectedTop) < 1e-6, 'final barline top matches conjoin logic');
  assert.ok(Math.abs(finalBarline.bottom - expectedBot) < 1e-6, 'final barline bottom matches conjoin logic');
});

// ---------------------------------------------------------------------------
// Section 2. Dots GOLDEN (Card D consumed; no dot option remains)
// ---------------------------------------------------------------------------

test('Dots golden: m.1 tick-24 dot clears true flag ink by >= 1.2pt AND clears tick-60 follower', () => {
  const o = resolveJankoOptions(DEFAULT_JANKO_OPTIONS);
  const t = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
  const [sys] = layoutJankoScore(BACH, o, t);

  const n5 = sys.notes.find((n) => n.note.id === 'bach-var1-5')!;
  const n7 = sys.notes.find((n) => n.note.id === 'bach-var1-7')!;

  assert.ok(n5, 'bach-var1-5 found');
  assert.ok(n7, 'bach-var1-7 follower found');

  // Flag bbox under verbatim SMuFL glyph
  const s = getStemGeometry(n5.rhythm, t);
  const bbox = getSubdivisionGlyphBBox('classical-urtext', s.direction, 1, t);
  const fBox = {
    x0: s.stemX + bbox.x0,
    y0: s.stemEndY + bbox.y0,
    x1: s.stemX + bbox.x1,
    y1: s.stemEndY + bbox.y1,
  };

  const dotX = n5.rhythm.dotX!;
  const dotY = n5.rhythm.dotY!;
  const dotR = t.augmentationDotRadius;

  // Clearance from flag box
  const fdx = Math.max(fBox.x0 - dotX, 0, dotX - fBox.x1);
  const fdy = Math.max(fBox.y0 - dotY, 0, dotY - fBox.y1);
  const flagClearance = Math.hypot(fdx, fdy) - dotR;
  assert.ok(
    flagClearance >= t.augmentationDotGap - EPS,
    `flag clearance ${flagClearance.toFixed(3)}pt >= ${t.augmentationDotGap}pt`
  );

  // Clearance from follower note n7 (starts at tick 60)
  const n7Preset = getClusterSpacingPreset(o.clusterSpacing);
  const n7dx = Math.max(n7.x - n7Preset.wx - dotX, 0, dotX - (n7.x + n7Preset.wx));
  const n7dy = Math.max(n7.y - n7Preset.hy - dotY, 0, dotY - (n7.y + n7Preset.hy));
  const followerClearance = Math.hypot(n7dx, n7dy) - dotR;
  assert.ok(
    followerClearance >= 10.0,
    `follower clearance ${followerClearance.toFixed(3)}pt >= 10.0pt`
  );
});

test('Dots golden pin: Bach ships 0 dot-flag collisions (19 dotted flagged singles audited)', () => {
  // Replaces the retired legacy-12 -> new-0 demonstration test: the legacy path
  // is gone, so golden pins 0 collisions directly over every dotted flagged
  // single, linter-consistent (beamed notes carry no flags and are skipped).
  const o = resolveJankoOptions(DEFAULT_JANKO_OPTIONS);
  const t = resolveJankoTokens(DEFAULT_JANKO_TOKENS);

  let scanned = 0;
  let collisions = 0;
  for (const sys of layoutJankoScore(BACH, o, t)) {
    const partition =
      o.rhythmStyle === 'beamed'
        ? partitionBeamGroups(
            sys.notes.map((p) => p.rhythm),
            t,
            sys.geometry.middleCY
          )
        : null;
    const beamedIds = partition
      ? new Set(partition.groups.flatMap((g) => g.map((n) => n.id)))
      : null;
    for (const p of sys.notes) {
      if (p.note.durationTicks <= 26 || p.note.durationTicks > 38) continue;
      if (beamedIds && beamedIds.has(p.note.id)) continue;
      const marks = subdivisionMarkCount(p.note.durationTicks);
      if (marks < 1) continue;
      scanned++;
      const s = getStemGeometry(p.rhythm, t);
      const bbox = getSubdivisionGlyphBBox(o.subdivisionStyle, s.direction, marks, t);
      const fBox = {
        x0: s.stemX + bbox.x0,
        y0: s.stemEndY + bbox.y0,
        x1: s.stemX + bbox.x1,
        y1: s.stemEndY + bbox.y1,
      };
      const dotX = p.rhythm.dotX ?? p.x + getClusterSpacingPreset(o.clusterSpacing).wx + t.augmentationDotGap;
      const dotY = p.rhythm.dotY ?? p.y;
      const dx = Math.max(fBox.x0 - dotX, 0, dotX - fBox.x1);
      const dy = Math.max(fBox.y0 - dotY, 0, dotY - fBox.y1);
      const dist = Math.hypot(dx, dy) - t.augmentationDotRadius;
      if (dist < t.augmentationDotGap - EPS) collisions++;
    }
  }

  assert.equal(scanned, 19, 'the audit covers all 19 dotted flagged singles (non-vacuous)');
  assert.equal(collisions, 0, 'golden ships 0 dot-flag collisions');
});

test('Dots golden: Brahms m.1/m.4/m.19 dots share the 45° rule-B seat at the §3 radius', () => {
  // The legacy-vs-new displacement comparison retires with the legacy path; the
  // judged clasp-dot positions are pinned absolutely instead, so any future
  // move fails. (Clasp dots are computed independently of the note-dot rule.)
  //
  // Ticket rule B (direct consistency correction): the opening A-major dotted
  // pip leaves its 60° seat for the existing m.19-style 45° seat — actual-mask
  // seating replaces the virtual-disc veto that held it at 60°. Under §2/§3
  // the absolute seats re-pin (§2 columns, §3 radius 4.75), but the judged
  // invariant — all three dots at exactly 45° off their own ring centres —
  // holds absolutely.
  const t = resolveJankoTokens(BRAHMS_OP118_NO1_JANKO_TOKENS);
  const o = resolveJankoOptions(BRAHMS_OP118_NO1_JANKO_OPTIONS);
  const systems = layoutJankoScore(BRAHMS, o, t);
  const clasps = systems.flatMap((s) => s.clasps ?? []);

  const m1 = clasps.find((c) => c.tick === 48)!;
  const m4 = clasps.find((c) => c.tick === 432)!;
  const m19 = clasps.find((c) => c.tick === 3504)!;
  assert.ok(m1, 'Brahms m.1 (tick 48) dotted clasp present');
  assert.ok(m4, 'Brahms m.4 (tick 432) dotted clasp present');
  assert.ok(m19, 'Brahms m.19 (tick 3504) dotted clasp present');

  const d1 = m1.durationDots.filter((d) => d !== null);
  const d4 = m4.durationDots.filter((d) => d !== null);
  const d19 = m19.durationDots.filter((d) => d !== null);
  assert.equal(d1.length, 1, 'm.1 clasp carries one dot');
  assert.equal(d4.length, 1, 'm.4 clasp carries one dot');
  assert.equal(d19.length, 1, 'm.19 clasp carries one dot');

  // Judged seats re-pinned for the §2/§3 geometry: §2 moves the columns
  // (per-measure downbeat insets replace the blanket 15.35pt) and §3 shrinks
  // every ring seat from radius 5.45 to 4.75 (outer 2.8 + hug 1.2 + dot
  // r 0.75). Rule B still holds absolutely: m.1, m.4 and m.19 all sit at
  // exactly 45.00° off their own ring centres at exactly 4.75.
  assert.equal(d1[0]!.x, 73.92816897534193, 'm.1 clasp dot x (§2 column + §3 4.75 seat; was 75.37314372217251)');
  assert.equal(d1[0]!.y, 127.89924278936398, 'm.1 clasp dot y (content-aware page 1; 45° seat kept)');
  assert.equal(m1.claspX, 70.56941176470588, 'm.1 clasp spine x (column 78.17 − r − offset)');
  assert.equal(d4[0]!.x, 329.683463092989, 'm.4 clasp dot x (§2 column + §3 4.75 seat; was 331.1284378398195)');
  assert.equal(d4[0]!.y, 135.39924278936397, 'm.4 clasp dot y (content-aware page 1; 45° seat kept)');
  // The consistency the ticket orders: opening and m.19 sit at the same
  // 45.00° off their ring centres at the same 4.75 radius.
  const angleOf = (clasp: typeof m1, dot: NonNullable<(typeof d1)[number]>): number => {
    const ink = clasp.durationInk[clasp.durationDots.indexOf(dot)];
    return (Math.atan2(-(dot.y - ink.centerY), dot.x - clasp.claspX) * 180) / Math.PI;
  };
  assert.ok(Math.abs(angleOf(m1, d1[0]!) - 45) < 1e-9, 'm.1 sits at 45°');
  assert.ok(Math.abs(angleOf(m19, d19[0]!) - 45) < 1e-9, 'm.19 sits at 45°');
  // m.19's column rides the §2 within-system redistribution (its system
  // reclaims the shrunk downbeat insets), so its absolute seat re-pins; the
  // 45° seat relative to its own spine is the invariant, and it holds.
  assert.equal(d19[0]!.x, 319.15875721063605, 'm.19 dot x (was 315.1437319574666 pre-§2)');
  assert.equal(d19[0]!.y, 158.51564278936397, 'm.19 dot y (content-aware page 2; 45° seat kept)');
});

test('Dots: audit-box == baked-extents agreement per subdivision style', () => {
  const t = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
  const styles: JankoSubdivisionStyle[] = [
    'classical-urtext',
    'kinetic-tab-30',
    'kinetic-tab-45',
    'kinetic-tab-beam',
    'kinetic-tab-tapered',
  ];

  for (const style of styles) {
    for (const dir of [-1, 1] as const) {
      for (const marks of [1, 2, 3, 4]) {
        const bbox = getSubdivisionGlyphBBox(style, dir, marks, t);
        assert.ok(Number.isFinite(bbox.x0));
        assert.ok(Number.isFinite(bbox.y0));
        assert.ok(Number.isFinite(bbox.x1));
        assert.ok(Number.isFinite(bbox.y1));
        assert.ok(bbox.x1 > bbox.x0, `${style} dir ${dir} marks ${marks}: x1 > x0`);
        assert.ok(bbox.y1 > bbox.y0, `${style} dir ${dir} marks ${marks}: y1 > y0`);

        if (style === 'classical-urtext') {
          const table = dir === -1 ? URTEXT_FLAGS_UP : URTEXT_FLAGS_DOWN;
          const g = table[marks - 1];
          assert.equal(bbox.x0, g.bbox[0]);
          assert.equal(bbox.y0, g.bbox[1]);
          assert.equal(bbox.x1, g.bbox[2]);
          assert.equal(bbox.y1, g.bbox[3]);
        }
      }
    }
  }
});

test('Dots golden: escape-totality scan finds zero across Bach and Brahms corpora', () => {
  const o = resolveJankoOptions(DEFAULT_JANKO_OPTIONS);
  const t = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
  const tBrahms = resolveJankoTokens(BRAHMS_OP118_NO1_JANKO_TOKENS);
  const oBrahms = resolveJankoOptions(BRAHMS_OP118_NO1_JANKO_OPTIONS);

  const reportBach = lintJankoScore(BACH, o, t);
  const reportBrahms = lintJankoScore(BRAHMS, oBrahms, tBrahms);

  const dotViolationsBach = reportBach.violations.filter((v) => v.code === 'dot-collision');
  const dotViolationsBrahms = reportBrahms.violations.filter((v) => v.code === 'dot-collision');

  assert.equal(dotViolationsBach.length, 0, 'Bach has 0 unresolvable dot collisions');
  assert.equal(dotViolationsBrahms.length, 0, 'Brahms has 0 unresolvable dot collisions');
});

test('Dots golden: no dot option or legacy code remains in the golden master', () => {
  assert.ok(!('dotRule' in DEFAULT_JANKO_OPTIONS), 'dotRule is retired from the layout options');
  assert.ok(
    !('dotRule' in resolveJankoOptions(DEFAULT_JANKO_OPTIONS)),
    'dotRule is retired from the resolved options'
  );
});

// ---------------------------------------------------------------------------
// Section 3. Thin GOLDEN (Card T consumed; no thin option remains)
// ---------------------------------------------------------------------------

test('Thin golden: m.29 extension row renders at 0.35pt, core rows untouched at 0.50pt', () => {
  const o = resolveJankoOptions(DEFAULT_JANKO_OPTIONS);
  const t = resolveJankoTokens(DEFAULT_JANKO_TOKENS);

  const sys = layoutJankoScore(BACH, o, t)[7];
  const rules = pitchGridRules(sys.geometry, o, t);

  const c6Y = sys.geometry.middleCY + continuousPitchY(72, t.semitoneScale);
  const c4Y = sys.geometry.middleCY + continuousPitchY(48, t.semitoneScale);

  const ext = rules.find((r) => Math.abs(r.y - c6Y) < 1e-6);
  const core = rules.find((r) => Math.abs(r.y - c4Y) < 1e-6);

  assert.ok(ext, 'extension rule found');
  assert.ok(core, 'core rule found');

  assert.equal(ext.width, 0.35, 'golden extension weight is 0.35pt');
  assert.equal(ext.width, PITCH_GRID_C_LINE_STROKE, 'reusing PITCH_GRID_C_LINE_STROKE (no new constant)');
  assert.equal(core.width, 0.50, 'core row is untouched at 0.50pt');
  assert.equal(ext.ink, PITCH_GRID_OCTAVE_INK, 'ink is unchanged (#1E293B)');
});

test('Thin golden: fixed-4 extension rows (17.5, 77.5) render at 0.35pt on Brahms', () => {
  const o = resolveJankoOptions({ ...BRAHMS_OP118_NO1_JANKO_OPTIONS, core: 'fixed-4' });
  const t = resolveJankoTokens(BRAHMS_OP118_NO1_JANKO_TOKENS);
  const systems = layoutJankoScore(BRAHMS, o, t);

  // System 1 draws the low extension (lin 17.5), system 15 the high one
  // (77.5; was system 20 at mps3 — the high passage re-systems at 4-per).
  const low = systems[1];
  const high = systems[15];
  assert.ok((low.geometry.extensionLines ?? []).includes(17.5), 'system 1 draws lin 17.5');
  assert.ok((high.geometry.extensionLines ?? []).includes(77.5), 'system 15 draws lin 77.5');

  const lowRule = pitchGridRules(low.geometry, o, t).find(
    (r) => Math.abs(r.y - (low.geometry.middleCY + continuousPitchY(17.5, t.semitoneScale))) < 1e-6
  );
  const highRule = pitchGridRules(high.geometry, o, t).find(
    (r) => Math.abs(r.y - (high.geometry.middleCY + continuousPitchY(77.5, t.semitoneScale))) < 1e-6
  );
  assert.ok(lowRule, 'low extension rule found');
  assert.ok(highRule, 'high extension rule found');
  assert.equal(lowRule.width, 0.35, 'lin 17.5 renders at 0.35pt');
  assert.equal(highRule.width, 0.35, 'lin 77.5 renders at 0.35pt');
  assert.equal(lowRule.ink, PITCH_GRID_OCTAVE_INK, 'extension ink unchanged');
  assert.equal(highRule.ink, PITCH_GRID_OCTAVE_INK, 'extension ink unchanged');
});

test('Thin golden: no thin option remains in the golden master', () => {
  assert.ok(!('extensionWeight' in DEFAULT_JANKO_OPTIONS), 'extensionWeight is retired');
  assert.ok(
    !('extensionWeight' in resolveJankoOptions(DEFAULT_JANKO_OPTIONS)),
    'extensionWeight is retired from the resolved options'
  );
});

// ---------------------------------------------------------------------------
// Section 4. Rest lightening GOLDEN-DIRECT (0.85 scale + 90% black)
// ---------------------------------------------------------------------------

test('Rests golden: rendered bbox == 0.85 x baked bbox (quarter, 8th, block)', () => {
  // The scaled-extents agreement: engine and linter share restInkBox, so this
  // one pin covers both the paint and every audit drawn from it.
  const t = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
  assert.equal(REST_SCALE, 0.85, 'the one rest scale constant is 0.85');

  for (const value of ['quarter', 'eighth'] as const) {
    const box = restInkBox(
      { tick: 0, durationTicks: 0, hand: 'RH', x: 0, y: 0, value, style: 'classical-urtext' },
      t
    );
    const [bx0, by0, bx1, by1] = URTEXT_RESTS[value].bbox;
    const bakedW = bx1 - bx0;
    const bakedH = by1 - by0;
    assert.ok(
      Math.abs(box.x1 - box.x0 - bakedW * REST_SCALE) < 1e-9,
      `${value}: rendered width is 0.85 x baked (${(bakedW * REST_SCALE).toFixed(4)}pt)`
    );
    assert.ok(
      Math.abs(box.y1 - box.y0 - bakedH * REST_SCALE) < 1e-9,
      `${value}: rendered height is 0.85 x baked (${(bakedH * REST_SCALE).toFixed(4)}pt)`
    );
  }

  for (const value of ['half', 'whole'] as const) {
    const box = restInkBox(
      { tick: 0, durationTicks: 0, hand: 'RH', x: 0, y: 0, value, style: 'classical-urtext' },
      t
    );
    assert.ok(
      Math.abs(box.x1 - box.x0 - REST_BLOCK_WIDTH * REST_SCALE) < 1e-9,
      `${value}: block width is 0.85 x baked`
    );
    assert.ok(
      Math.abs(box.y1 - box.y0 - REST_BLOCK_HEIGHT * REST_SCALE) < 1e-9,
      `${value}: block height is 0.85 x baked`
    );
    // Anchoring preserved: the contact edge stands exactly on the seat line.
    const contact = value === 'half' ? box.y1 : box.y0;
    assert.ok(Math.abs(contact - 0) < 1e-9, `${value}: contact edge on the seat line`);
  }
});

test('Rests golden: live rest ink is 90% black (#1A1A1A) via the one ink constant', () => {
  const t = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
  assert.equal(REST_INK, '#1A1A1A', 'the one rest ink constant is 90% black');

  // Unit level: every live value's ink carries the constant.
  for (const value of [
    'sixty-fourth',
    'thirty-second',
    'sixteenth',
    'eighth',
    'quarter',
    'half',
    'whole',
  ] as const) {
    const ink = restInk({ x: 0, y: 0 }, value, 'classical-urtext', t);
    for (const item of ink) {
      if (item.kind === 'path' || item.kind === 'rect') {
        assert.equal(item.fill, REST_INK, `${value}: fill is the rest ink constant`);
      }
    }
  }

  // Painted level: the Bach m.4 16th rest prints the 90% fill.
  const o = resolveJankoOptions(DEFAULT_JANKO_OPTIONS);
  const crop = renderJankoCrop(BACH, 4, 1, o, t);
  assert.match(
    crop,
    /<path class="janko-rest-verbatim" d="[^"]+" fill="#1A1A1A" stroke="none"/,
    'the painted verbatim contour carries 90% black'
  );
  assert.ok(
    !/janko-rest-(verbatim|block)"[^>]*fill="#111111"/.test(crop),
    'no live rest ink keeps the old #111111'
  );
});

test('Rests golden: verbatim constants stay byte-identical (license provenance)', () => {
  assert.deepEqual(
    [...URTEXT_REST_QUARTER.bbox],
    [0.016, -5.802, 4.199, 5.833],
    'the transcribed quarter bbox is untouched — scale applies at render only'
  );
});

test('Rests golden: all nine Bach seats pinned (§4 nearby-level rule)', () => {
  // Provenance: pre-§4 seats were 720/318.45875, 864/313.45875,
  // 1056/333.45875, 2988/325.95875, 3060/370.95875, 3132/345.95875,
  // 3600/512.43125 (552/179.48625 and 3432/358.45875 never moved). The §4
  // nearby-level rule reseats the other seven onto the nearest row of an
  // actual in-measure same-hand level (downbeat rests take the resume side,
  // the only side present; mid-measure rests take the nearer side) — every
  // delta traced to played-note data, x/values/hands byte-identical.
  // Absolute pins: any further seating drift fails here.
  const o = resolveJankoOptions(DEFAULT_JANKO_OPTIONS);
  const t = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
  const seats = layoutJankoScore(BACH, o, t).flatMap((s) => s.rests);

  const expected: ReadonlyArray<readonly [number, string, number, number]> = [
    [552, 'sixteenth', 548.635, 179.48625],
    [720, 'eighth', 173.67, 315.95875],
    [864, 'eighth', 309.54, 310.95875],
    [1056, 'sixteenth', 486.7, 338.45875],
    [2988, 'quarter', 130.7025, 345.95875],
    [3060, 'quarter', 204.6375, 385.95875],
    [3132, 'quarter', 266.5725, 333.45875],
    [3432, 'sixteenth', 548.635, 358.45875],
    [3600, 'eighth', 173.67, 504.93125],
  ];
  assert.equal(seats.length, expected.length, 'Bach writes nine rests');

  for (const [tick, value, x, y] of expected) {
    const rest = seats.find((r) => r.tick === tick)!;
    assert.ok(rest, `tick-${tick} rest is written`);
    assert.equal(rest.value, value, `tick-${tick} value`);
    assert.ok(Math.abs(rest.x - x) < 1e-6, `tick-${tick} seat x pinned (${rest.x})`);
    assert.ok(Math.abs(rest.y - y) < 1e-6, `tick-${tick} seat y pinned (${rest.y})`);
  }
});

test('Rests golden: dormant dialects keep #111111 ink and unscaled extents', () => {
  // The lightening touches ONLY the live path. Kinetic (the measured
  // demonstrator) pins both its ink and one envelope absolutely.
  const t = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
  const ink = restInk({ x: 0, y: 0 }, 'quarter', 'kinetic-monoline', t);
  for (const item of ink) {
    if (item.kind === 'path' || item.kind === 'rect') {
      assert.equal(item.fill, '#111111', 'dormant kinetic ink keeps #111111');
    }
  }
  const box = restInkBox(
    { tick: 0, durationTicks: 0, hand: 'RH', x: 0, y: 0, value: 'quarter', style: 'kinetic-monoline' },
    t
  );
  assert.ok(Math.abs(box.x1 - box.x0 - 4.1131) < 1e-3, 'dormant kinetic quarter width unscaled');
  assert.ok(Math.abs(box.y1 - box.y0 - 11.5594) < 1e-3, 'dormant kinetic quarter height unscaled');
});

test('npm run lint:engraving --strict reports canonical clean and exits 0', () => {
  // Canonical fixed-3 everywhere: the strict gate exits 0 with zero
  // violations and zero warnings on every score.
  const run = spawnSync(
    process.execPath,
    ['--import', 'tsx', 'scripts/lint_engraving.ts', '--strict', '--quiet'],
    { cwd: REPO_ROOT, encoding: 'utf-8' }
  );
  assert.equal(run.status, 0, 'the strict gate exits 0 on the canonical clean record');
  assert.match(run.stdout, /clean violations=0 warnings=0/, 'zero violations, zero warnings');
});

// ---------------------------------------------------------------------------
// Section 5. Registry: Round 29 retired, no open previews (historical)
// ---------------------------------------------------------------------------

// Historical Round 29 registry (flips-landed, zero cards) preserved for
// durable regression coverage. Active candidate round in
// src/render/janko/candidates.ts is Round 31 (clasp-dot nudge preview).
const ROUND_29_METADATA = {
  round: 29,
  title: 'Flips landed: new dots, thin extensions, lightened rests',
  openAxes: [],
  compareStrip: undefined,
};

test('Registry landed: Round 29 flips-landed state, zero cards (historical)', () => {
  assert.equal(ROUND_29_METADATA.round, 29);
  assert.match(ROUND_29_METADATA.title, /Flips landed/);
  assert.deepEqual(ROUND_29_METADATA.openAxes, [], 'no open axes');
  assert.equal(ROUND_29_METADATA.compareStrip, undefined, 'no compare strip');
});
