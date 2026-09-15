/**
 * Round 29: Preview Round — New Dot Standard + Thin Extensions; Symmetric-6 Barlines Golden-Immediate
 * ===================================================================================================
 *
 * Durable maintained test suite verifying:
 *  0. Core equalization GOLDEN-IMMEDIATE: PITCH_GRID_C4_STROKE 0.70 -> 0.50 (equalized
 *     to PITCH_GRID_OCTAVE_STROKE); all three core rows identical at 0.50pt.
 *  1. Symmetric-6 spans GOLDEN-IMMEDIATE: measure barlines and beat pulses stand off outer-row
 *     levels by exactly measureInset (6.0pt) on both sides (|top gap - 6| and |bottom gap - 6| < EPS);
 *     shared span functions move both; finale path extends iff outer rows drawn.
 *  2. Dots preview card (option dotRule: 'legacy' default vs 'flag-clearance'/'new'):
 *     - Note dot clears true verbatim flag ink by >= augmentationDotGap (1.2pt), escaping right then up.
 *     - Bach m.1 tick 24 dot clears true flag ink and clears tick 60 follower.
 *     - Legacy-12 -> new-0 demonstration test across Bach.
 *     - Brahms clasp displacement exactly 0 (both tick 48 and tick 432 instances).
 *     - Audit-box == baked-extents agreement per subdivision style.
 *     - Corpus scan finds zero unresolvable cases.
 *  3. Thin preview card (option extensionWeight: default 0.50 vs 0.35):
 *     - Extension rows render at 0.35pt reusing PITCH_GRID_C_LINE_STROKE, same ink (#1E293B).
 *     - Core rows untouched at 0.50pt.
 *  4. Round 29 registry:
 *     - Exactly two cards, NO control card, one delta per card.
 *     - Windows resolve (Card D: Bach m.1, Brahms m.1; Card T: Bach mm. 29–30).
 *     - Captions match rendered counts.
 *     - Both cards lint-clean (chips green).
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
  BRAHMS_STUDIO_SCORE_ID,
  CURRENT_CANDIDATES,
  CURRENT_ROUND_METADATA,
  DEFAULT_STUDIO_SCORE_ID,
  candidateBadges,
  getCandidate,
  resolveCandidate,
} from '../src/render/janko/candidates';
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
  resolveBeatPulseXs,
} from '../src/render/janko/elements/barlines';
import {
  getStemGeometry,
  getSubdivisionGlyphBBox,
  subdivisionMarkCount,
} from '../src/render/janko/elements/rhythm';
import { URTEXT_FLAGS_DOWN, URTEXT_FLAGS_UP } from '../src/render/janko/elements/urtext-paths';
import { continuousPitchY } from '../src/render/janko/geometry';
import {
  LintViolation,
  checkDotCollision,
  lintJankoScore,
  systemBarlines,
} from '../src/render/janko/linter';

const BACH = buildBachGoldbergVar1Score();
const BRAHMS = buildBrahmsOp118No1Score();
const EPS = 1e-9;

// ---------------------------------------------------------------------------
// Section 0. Core Equalization GOLDEN-IMMEDIATE
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
// Section 1. Symmetric-6 Spans GOLDEN-IMMEDIATE
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
// Section 2. Dots Preview Card
// ---------------------------------------------------------------------------

test('Dots: m.1 tick-24 dot clears true flag ink by >= 1.2pt AND clears tick-60 follower', () => {
  const oNew = resolveJankoOptions({ ...DEFAULT_JANKO_OPTIONS, dotRule: 'flag-clearance' });
  const t = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
  const [sys] = layoutJankoScore(BACH, oNew, t);

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
  const n7Preset = getClusterSpacingPreset(oNew.clusterSpacing);
  const n7dx = Math.max(n7.x - n7Preset.wx - dotX, 0, dotX - (n7.x + n7Preset.wx));
  const n7dy = Math.max(n7.y - n7Preset.hy - dotY, 0, dotY - (n7.y + n7Preset.hy));
  const followerClearance = Math.hypot(n7dx, n7dy) - dotR;
  assert.ok(
    followerClearance >= 10.0,
    `follower clearance ${followerClearance.toFixed(3)}pt >= 10.0pt`
  );
});

test('Dots demonstration test: legacy-12 -> new-0 flag collisions on Bach', () => {
  const t = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
  const oLegacy = resolveJankoOptions({ ...DEFAULT_JANKO_OPTIONS, dotRule: 'legacy' });
  const oNew = resolveJankoOptions({ ...DEFAULT_JANKO_OPTIONS, dotRule: 'flag-clearance' });

  const countFlagCollisions = (layouts: ReturnType<typeof layoutJankoScore>): number => {
    let count = 0;
    for (const sys of layouts) {
      for (const p of sys.notes) {
        if (p.note.durationTicks <= 26 || p.note.durationTicks > 38) continue;
        const s = getStemGeometry(p.rhythm, t);
        const marks = subdivisionMarkCount(p.note.durationTicks);
        if (marks < 1) continue;
        const bbox = getSubdivisionGlyphBBox('classical-urtext', s.direction, marks, t);
        const fBox = {
          x0: s.stemX + bbox.x0,
          y0: s.stemEndY + bbox.y0,
          x1: s.stemX + bbox.x1,
          y1: s.stemEndY + bbox.y1,
        };
        const dotX = p.rhythm.dotX ?? p.x + getClusterSpacingPreset('tight').wx + t.augmentationDotGap;
        const dotY = p.rhythm.dotY ?? p.y;
        const dx = Math.max(fBox.x0 - dotX, 0, dotX - fBox.x1);
        const dy = Math.max(fBox.y0 - dotY, 0, dotY - fBox.y1);
        const dist = Math.hypot(dx, dy) - t.augmentationDotRadius;
        if (dist < t.augmentationDotGap - EPS) {
          count++;
        }
      }
    }
    return count;
  };

  const legacyCollisions = countFlagCollisions(layoutJankoScore(BACH, oLegacy, t));
  const newCollisions = countFlagCollisions(layoutJankoScore(BACH, oNew, t));

  assert.equal(legacyCollisions, 12, 'exactly 12 dotted notes violate flag clearance under legacy');
  assert.equal(newCollisions, 0, 'exactly 0 flag collisions under new dot standard');
});

test('Dots: Brahms clasp dot displacement exactly 0 (both m.1 tick 48 and m.4 tick 432 instances)', () => {
  // Brahms m.1 probe outcome: Following onset tick 72 is at x=107.94, >23pt to the right,
  // and down in the bass staff; it does not constrain the clasp dot. Brahms m.1 literal window
  // resolves cleanly, showing the clasp dot unmoved (displacement 0).
  const t = resolveJankoTokens(BRAHMS_OP118_NO1_JANKO_TOKENS);
  const oLegacy = resolveJankoOptions({ ...BRAHMS_OP118_NO1_JANKO_OPTIONS, dotRule: 'legacy' });
  const oNew = resolveJankoOptions({ ...BRAHMS_OP118_NO1_JANKO_OPTIONS, dotRule: 'flag-clearance' });

  const sysLegacy = layoutJankoScore(BRAHMS, oLegacy, t);
  const sysNew = layoutJankoScore(BRAHMS, oNew, t);

  const getDottedClasps = (systems: typeof sysLegacy) =>
    systems.flatMap((s) => s.clasps ?? []).filter((c) => c.durationInk.some((ink) => ink.dotted));

  const claspsLegacy = getDottedClasps(sysLegacy);
  const claspsNew = getDottedClasps(sysNew);

  assert.equal(claspsLegacy.length, claspsNew.length);
  assert.ok(claspsLegacy.length >= 2, 'Brahms contains >= 2 dotted clasps');

  for (let i = 0; i < claspsLegacy.length; i++) {
    const cl = claspsLegacy[i];
    const cn = claspsNew[i];
    for (let j = 0; j < cl.durationDots.length; j++) {
      const dl = cl.durationDots[j];
      const dn = cn.durationDots[j];
      if (!dl && !dn) continue;
      assert.ok(dl && dn, 'both dots defined');
      const displacement = Math.hypot(dn.x - dl.x, dn.y - dl.y);
      assert.equal(displacement, 0, `clasp dot at index ${i}.${j} has displacement exactly 0`);
    }
  }
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

test('Dots: unresolvable-case scan finds zero across Bach and Brahms corpora', () => {
  const oNew = resolveJankoOptions({ ...DEFAULT_JANKO_OPTIONS, dotRule: 'flag-clearance' });
  const t = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
  const bachSystems = layoutJankoScore(BACH, oNew, t);

  const tBrahms = resolveJankoTokens(BRAHMS_OP118_NO1_JANKO_TOKENS);
  const oBrahmsNew = resolveJankoOptions({ ...BRAHMS_OP118_NO1_JANKO_OPTIONS, dotRule: 'flag-clearance' });
  const brahmsSystems = layoutJankoScore(BRAHMS, oBrahmsNew, tBrahms);

  const reportBach = lintJankoScore(BACH, oNew, t);
  const reportBrahms = lintJankoScore(BRAHMS, oBrahmsNew, tBrahms);

  const dotViolationsBach = reportBach.violations.filter((v) => v.code === 'dot-collision');
  const dotViolationsBrahms = reportBrahms.violations.filter((v) => v.code === 'dot-collision');

  assert.equal(dotViolationsBach.length, 0, 'Bach has 0 unresolvable dot collisions');
  assert.equal(dotViolationsBrahms.length, 0, 'Brahms has 0 unresolvable dot collisions');
});

// ---------------------------------------------------------------------------
// Section 3. Thin Preview Card
// ---------------------------------------------------------------------------

test('Thin preview: m.29 outer row renders at 0.35pt under card T, 0.50pt under golden; core rows 0.50pt', () => {
  const oDefault = resolveJankoOptions(DEFAULT_JANKO_OPTIONS);
  const oThin = resolveJankoOptions({ ...DEFAULT_JANKO_OPTIONS, extensionWeight: 0.35 });
  const t = resolveJankoTokens(DEFAULT_JANKO_TOKENS);

  const sysDefault = layoutJankoScore(BACH, oDefault, t)[7];
  const sysThin = layoutJankoScore(BACH, oThin, t)[7];

  const rulesDefault = pitchGridRules(sysDefault.geometry, oDefault, t);
  const rulesThin = pitchGridRules(sysThin.geometry, oThin, t);

  const c6Y = sysDefault.geometry.middleCY + continuousPitchY(72, t.semitoneScale);
  const c4Y = sysDefault.geometry.middleCY + continuousPitchY(48, t.semitoneScale);

  const extDefault = rulesDefault.find((r) => Math.abs(r.y - c6Y) < 1e-6);
  const extThin = rulesThin.find((r) => Math.abs(r.y - c6Y) < 1e-6);
  const coreDefault = rulesDefault.find((r) => Math.abs(r.y - c4Y) < 1e-6);
  const coreThin = rulesThin.find((r) => Math.abs(r.y - c4Y) < 1e-6);

  assert.ok(extDefault, 'default extension rule found');
  assert.ok(extThin, 'thin extension rule found');
  assert.ok(coreDefault, 'default core rule found');
  assert.ok(coreThin, 'thin core rule found');

  assert.equal(extDefault.width, 0.50, 'golden extension weight is 0.50pt');
  assert.equal(extThin.width, 0.35, 'Card T extension weight is 0.35pt (PITCH_GRID_C_LINE_STROKE)');
  assert.equal(extThin.width, PITCH_GRID_C_LINE_STROKE, 'reusing PITCH_GRID_C_LINE_STROKE');
  assert.equal(coreDefault.width, 0.50, 'core row under golden is 0.50pt');
  assert.equal(coreThin.width, 0.50, 'core row under Card T is untouched at 0.50pt');
  assert.equal(extThin.ink, PITCH_GRID_OCTAVE_INK, 'ink is unchanged (#1E293B)');
});

// ---------------------------------------------------------------------------
// Section 4. Round 29 Registry Purity & Gates
// ---------------------------------------------------------------------------

test('Round 29 registry purity: exactly 2 cards, NO control card, one delta per card', () => {
  assert.equal(CURRENT_ROUND_METADATA.round, 29);
  assert.match(CURRENT_ROUND_METADATA.title, /New Dot Standard/);
  assert.deepEqual(
    CURRENT_ROUND_METADATA.openAxes,
    ['dotRule', 'extensionWeight'],
    'two axes, two cards'
  );
  assert.equal(CURRENT_CANDIDATES.length, 2, 'two contenders (no control card)');

  const [cardD, cardT] = CURRENT_CANDIDATES;
  assert.equal(cardD.id, 'dots-new');
  assert.equal(cardD.axis, 'dotRule');
  assert.deepEqual(cardD.options, { dotRule: 'flag-clearance' });

  assert.equal(cardT.id, 'extensions-thin');
  assert.equal(cardT.axis, 'extensionWeight');
  assert.deepEqual(cardT.options, { extensionWeight: 0.35 });

  const badgesD = candidateBadges(cardD);
  assert.equal(badgesD.length, 1);
  assert.equal(badgesD[0].key, 'dotRule');

  const badgesT = candidateBadges(cardT);
  assert.equal(badgesT.length, 1);
  assert.equal(badgesT[0].key, 'extensionWeight');
});

test('Round 29 windows resolve and captions match rendered counts', () => {
  const cardD = getCandidate('dots-new')!;
  const cardT = getCandidate('extensions-thin')!;

  const resD = resolveCandidate(cardD);
  const resT = resolveCandidate(cardT);

  // Card D windows: Bach m.1 and Brahms m.1
  assert.equal(resD.windows.length, 2);
  assert.equal(resD.windows[0].scoreId, DEFAULT_STUDIO_SCORE_ID);
  assert.equal(resD.windows[0].measureStart, 1);
  assert.equal(resD.windows[0].measureCount, 1);
  assert.equal(resD.windows[1].scoreId, BRAHMS_STUDIO_SCORE_ID);
  assert.equal(resD.windows[1].measureStart, 1);
  assert.equal(resD.windows[1].measureCount, 1);

  // Card T windows: Bach mm. 29–30
  assert.equal(resT.windows.length, 1);
  assert.equal(resT.windows[0].scoreId, DEFAULT_STUDIO_SCORE_ID);
  assert.equal(resT.windows[0].measureStart, 29);
  assert.equal(resT.windows[0].measureCount, 2);

  // Captions match: 12 flag-colliding dots move, 0 blocked; 0.35pt extension stroke
  assert.match(cardD.description ?? '', /12 flag-colliding dots move; 0 blocked/);
  assert.match(cardT.description ?? '', /0\.35pt/);
});

test('Round 29 linter cleanliness: both cards lint clean (chips green)', () => {
  const t = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
  for (const card of CURRENT_CANDIDATES) {
    const o = resolveJankoOptions({ ...DEFAULT_JANKO_OPTIONS, ...(card.options ?? {}) });
    const report = lintJankoScore(BACH, o, t);
    assert.equal(report.ok, true, `${card.id} lints clean on Bach`);
    assert.equal(report.violations.length, 0, `${card.id} has 0 violations`);
    assert.equal(report.warnings.length, 0, `${card.id} has 0 warnings`);
  }
});
