/**
 * Ottava Determinism & Golden Byte Stability
 * ==========================================
 *
 * Durable maintained test suite verifying:
 *  1. Triple-lock invariant: folded SVG y + bracket extent + exported MIDI pitch
 *     agree (sounding pitch = written pitch - ottavaShift).
 *  2. Default golden master SVG byte stability: renders zero ottava brackets
 *     and is byte-stable.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1';
import {
  buildBrahmsOp118No1Score,
  BRAHMS_OP118_NO1_JANKO_OPTIONS,
  BRAHMS_OP118_NO1_JANKO_TOKENS,
} from '../src/scores/brahms-op118-no1';
import {
  DEFAULT_JANKO_OPTIONS,
  DEFAULT_JANKO_TOKENS,
  resolveJankoOptions,
  resolveJankoTokens,
} from '../src/render/janko/types';
import {
  layoutJankoScore,
  renderSystem,
  computePageGeometry,
  getSystemGeometry,
  renderJankoCrop,
  renderJankoPage,
} from '../src/render/janko/engine';
import { toMidi, linearIndex } from '../src/model/pitch';
import { getCanonicalSyllable } from '../src/model/phonetics';
import { continuousPitchY } from '../src/render/janko/geometry';
import {
  collectOttavaContextInk,
  ottavaLabelBox,
} from '../src/render/janko/elements/ottava';
import {
  checkOttavaClearance,
  DEFAULT_JANKO_LINT_OPTIONS,
  resolveAllocatedPageSlots,
  systemInkExtents,
} from '../src/render/janko/linter';

const BRAHMS = buildBrahmsOp118No1Score();
const BACH = buildBachGoldbergVar1Score();

// ---------------------------------------------------------------------------
// 1. Triple-Lock Determinism: SVG y + Bracket + MIDI pitch
// ---------------------------------------------------------------------------

test('Triple-lock determinism: folded SVG y + bracket extent + MIDI pitch agree', () => {
  const t = resolveJankoTokens(BRAHMS_OP118_NO1_JANKO_TOKENS);

  for (const core of ['fixed-3', 'fixed-4'] as const) {
    const o = resolveJankoOptions({ ...BRAHMS_OP118_NO1_JANKO_OPTIONS, core });
    const layouts = layoutJankoScore(BRAHMS, o, t);

    for (const sys of layouts) {
      const brackets = sys.ottavaBrackets ?? [];
      const foldedNotes = sys.notes.filter((n) => n.ottavaShift !== undefined && n.ottavaShift !== 0);

      for (const p of foldedNotes) {
        const shift = p.ottavaShift!;
        assert.ok(shift !== 0, `note ${p.note.id} has non-zero shift`);

        // Lock 1: Sounding MIDI pitch matches original note pitch, unshifted
        const midiPitch = toMidi(p.note.pitch);
        const origLin = linearIndex(p.note.pitch);
        assert.equal(midiPitch, origLin + 12, `MIDI pitch is sounding pitch (${midiPitch})`);

        // Lock 2: Written linear pitch equals origLin + shift
        const writtenLin = p.writtenLin!;
        assert.equal(writtenLin, origLin + shift, `writtenLin = origLin + shift`);
        assert.equal(origLin, writtenLin - shift, `sounding = written - shift`);

        // SVG Y position is placed at writtenLin height
        const expectedRelY = continuousPitchY(writtenLin, t.semitoneScale);
        const actualRelY = p.y - sys.geometry.middleCY;
        assert.ok(
          Math.abs(actualRelY - expectedRelY) < 1e-4,
          `SVG notehead y (${p.y}) reflects written lin height`
        );

        // Lock 3: Bracket covers the note and agrees on the shift
        const matchingBracket = brackets.find((b) => b.noteIds.includes(p.note.id));
        assert.ok(matchingBracket, `note ${p.note.id} is covered by an ottava bracket`);
        assert.equal(matchingBracket.shift, shift, `bracket shift matches note shift`);

        // Bracket horizontally encloses the notehead
        const r = t.noteheadRadius;
        assert.ok(matchingBracket.x0 <= p.x + r + 0.1, `bracket x0 covers notehead`);
        assert.ok(matchingBracket.x1 >= p.x - r - 0.1, `bracket x1 covers notehead`);

        // Bracket lineY maintains clear air outside notehead
        if (shift > 0) {
          // down10 / down20: bracket is below note
          assert.ok(
            matchingBracket.lineY >= p.y + r + t.ottavaClearance - 0.01,
            `bracket lineY (${matchingBracket.lineY}) clears note bottom (${p.y + r})`
          );
        } else {
          // up10 / up20: bracket is above note
          assert.ok(
            matchingBracket.lineY <= p.y - r - t.ottavaClearance + 0.01,
            `bracket lineY (${matchingBracket.lineY}) clears note top (${p.y - r})`
          );
        }
      }
    }
  }
});

// ---------------------------------------------------------------------------
// 2. Default Golden Master Renders Zero Brackets & Is Byte-Stable
// ---------------------------------------------------------------------------

test('Default golden master renders zero brackets (byte-stable)', () => {
  const o = resolveJankoOptions(DEFAULT_JANKO_OPTIONS);
  const t = resolveJankoTokens(DEFAULT_JANKO_TOKENS);

  const layouts = layoutJankoScore(BACH, o, t);
  for (const sys of layouts) {
    assert.equal(
      sys.ottavaBrackets.length,
      0,
      `golden system ${sys.index + 1} has zero ottava brackets`
    );
    const foldedNotes = sys.notes.filter((n) => n.ottavaShift !== undefined);
    assert.equal(
      foldedNotes.length,
      0,
      `golden system ${sys.index + 1} has zero folded notes`
    );
  }

  // Render full page 0 twice and assert byte-identical output
  const svg1 = renderJankoPage(BACH, 0, o, t);
  const svg2 = renderJankoPage(BACH, 0, o, t);
  assert.equal(svg1, svg2, 'golden page 0 render is deterministic');
  assert.ok(!svg1.includes('janko-ottava'), 'golden master SVG contains zero ottava elements');
});

// ---------------------------------------------------------------------------
// 3. §5 complete-ink ottava: the m.69 collision, resolved
// ---------------------------------------------------------------------------

const BRAHMS_O = resolveJankoOptions({
  ...DEFAULT_JANKO_OPTIONS,
  ...BRAHMS_OP118_NO1_JANKO_OPTIONS,
});
const BRAHMS_T = resolveJankoTokens({
  ...DEFAULT_JANKO_TOKENS,
  ...BRAHMS_OP118_NO1_JANKO_TOKENS,
});
const BRAHMS_LAYOUTS = layoutJankoScore(BRAHMS, BRAHMS_O, BRAHMS_T);

test('§5 m.69: the spanner drops exactly 1.60 and the label clears beam ink by 1.20', () => {
  // The judged defect: the down10 label box top (431.70) overlapped the
  // downward beam ink bottom (432.10) by 0.40pt. The resolver seats the
  // label top exactly one air (1.2) below the beam ink, dropping the whole
  // spanner by 0.40 + 1.20 = 1.60 — line, label, and hook ride rigidly.
  // (Content-aware page 5 seats sys17 8.26pt higher than slots; the
  // within-system drop is unchanged.)
  const l = BRAHMS_LAYOUTS[17];
  assert.equal(l.ottavaBrackets.length, 1, 'sys17 carries the m.69 spanner');
  const b = l.ottavaBrackets[0];
  assert.equal(Number(b.lineY.toFixed(2)), 438.8, 'line resolved at 438.80 (content-aware page 5)');
  assert.equal(Number((b.lineY - 437.2).toFixed(2)), 1.6, 'exactly overlap + air above the moved frame');
  assert.equal(Number(b.x0.toFixed(2)), 40.95, 'span start');
  assert.equal(Number(b.x1.toFixed(2)), 62.45, 'span end');
  const label = ottavaLabelBox(b, BRAHMS_T);
  assert.deepEqual(
    [label.x0, label.y0, label.x1, label.y1].map((v) => Number(v.toFixed(2))),
[40.95, 433.3, 51.45, 439.3],
    'label box rides the line'
  );
  // Complete music ink over the span, from the shared collector (the same
  // boxes the resolver seats from): the binding ink below the label is the
  // downward beam strip.
  const ink = collectOttavaContextInk(
    {
      beams: l.beams ?? [],
      ungrouped: l.ungrouped ?? [],
      suppressedStemIds: new Set([
        ...(l.claspedStems ?? []),
        ...(l.verticalChords ?? []).flatMap((chord) => chord.suppressedIds),
        ...(l.sharedStems ?? []).flatMap((group) => group.suppressedIds),
      ]),
      clasps: l.clasps ?? [],
      rests: l.rests ?? [],
      outlierRules: [],
      options: BRAHMS_O,
    },
    BRAHMS_T
  );
  const overSpan = ink.filter((box) => box.x1 >= b.x0 && box.x0 <= b.x1 && box.y1 <= label.y0);
  const beamBottom = Math.max(...overSpan.map((box) => box.y1));
  assert.equal(Number(beamBottom.toFixed(2)), 432.1, 'downward beam ink bottom');
  assert.ok(
    Math.abs(label.y0 - beamBottom - 1.2) < 1e-6,
    `label clears beam ink by exactly the air (${(label.y0 - beamBottom).toFixed(4)})`
  );
  // The hook paints: upward 4pt return at the span end.
  assert.equal(b.hookDirection, -1, 'hook returns upward');
  assert.equal(b.hookLength, 4, 'hook length');
  // The extreme folded pitch (A0, lin 9) is the covered note.
  assert.deepEqual(b.noteIds, ['brahms-op118-no1-938'], 'the m.69 A0');
  const a0 = BRAHMS.notes.find((n) => n.id === 'brahms-op118-no1-938')!;
  assert.equal(a0.pitch.octave * 12 + a0.pitch.pitchClass, 9, 'lin 9 extreme');
});

test('§5 the old notehead-only criterion was blind to m.69; complete ink was not', () => {
  // At the judged line (437.20 in the content-aware frame) the lowest
  // notehead bottom over the span clears by 17.20pt — the retired 6pt
  // check passes with room, blind to the beam the label actually hits.
  // Complete ink names the 0.40 overlap.
  const l = BRAHMS_LAYOUTS[17];
  const b = l.ottavaBrackets[0];
  const r = BRAHMS_T.noteheadRadius;
  const lowestBottom = Math.max(
    ...l.notes.filter((p) => p.x + r >= b.x0 && p.x - r <= b.x1).map((p) => p.y + r)
  );
  assert.equal(Number(lowestBottom.toFixed(2)), 420.0, 'lowest notehead bottom over span');
  assert.ok(437.2 - lowestBottom >= 6.0, 'the retired check passes (blind)');
  // The old label top (rigidly 1.60 above today's) sat inside the beam ink.
  const label = ottavaLabelBox(b, BRAHMS_T);
  const oldLabelTop = label.y0 - 1.6;
  assert.equal(Number(oldLabelTop.toFixed(2)), 431.7, 'judged label top');
  assert.ok(oldLabelTop < 432.1, 'old label top inside the 432.10 beam ink (0.40 overlap)');
});

test('§5 all nine spanners clear complete ink: the audit is silent score-wide', () => {
  let brackets = 0;
  for (const l of BRAHMS_LAYOUTS) {
    brackets += l.ottavaBrackets.length;
    const out: Parameters<typeof checkOttavaClearance>[3] = [];
    checkOttavaClearance(l, BRAHMS_O, BRAHMS_T, out);
    assert.deepEqual(out, [], `system ${l.index}: line, label, and hook clear`);
  }
  assert.equal(brackets, 9, 'nine literal runs, all resolved');
});

test('§5 slot, page, and crop agree on the resolved sys17 ink', () => {
  // The resolved label bottom (439.30) is the system's bottom ink: it fits
  // the nominal slot (445.94) because content-aware page 5 seats sys17
  // from ink — no trailing-space extension needed. The audit that gates
  // the page measures the ALLOCATION, never the nominal frame.
  const page = computePageGeometry(BRAHMS_O, BRAHMS_T, BRAHMS);
  const slots = resolveAllocatedPageSlots(
    BRAHMS_LAYOUTS,
    page,
    BRAHMS_T,
    DEFAULT_JANKO_LINT_OPTIONS,
    BRAHMS_O
  );
  const sys17 = slots.find((s) => s.index === 17)!;
  const ink = systemInkExtents(BRAHMS_LAYOUTS[17], BRAHMS_T, DEFAULT_JANKO_LINT_OPTIONS, BRAHMS_O);
  assert.equal(Number(ink.bottom.toFixed(2)), 439.3, 'label bottom is bottom ink');
  assert.equal(Number(sys17.nominalBottom.toFixed(2)), 445.94, 'nominal slot bound');
  assert.ok(ink.bottom <= sys17.nominalBottom, 'content-aware fits the nominal frame');
  assert.equal(Number(sys17.bottom.toFixed(2)), 445.94, 'allocated stays nominal (no extension)');
  // Page and crop render the resolved spanner alike.
  const sheet = renderJankoPage(BRAHMS, 4, BRAHMS_O, BRAHMS_T);
  assert.ok(sheet.includes('janko-ottava'), 'final page carries the spanner');
  const crop = renderJankoCrop(BRAHMS, 69, 1, BRAHMS_O, BRAHMS_T);
  assert.ok(/ottava/i.test(crop), 'the m.69 crop frames the resolved spanner');
});

test('Solf remains absolute: folding keeps every pitch-class syllable', () => {
  // Folding transposes by whole octaves (±12/±24), so sounding pitch class
  // — and its dozenal solfège — is invariant under the bracket.
  const layouts = layoutJankoScore(BRAHMS, BRAHMS_O, BRAHMS_T);
  const folded = layouts.flatMap((l) => l.notes).filter((p) => (p.ottavaShift ?? 0) !== 0);
  assert.equal(folded.length, 9, 'nine folded notes under fixed-3');
  for (const p of folded) {
    const soundingPc = ((p.note.pitch.pitchClass % 12) + 12) % 12;
    const writtenLin = p.writtenLin ?? p.note.pitch.octave * 12 + soundingPc;
    const writtenPc = ((writtenLin % 12) + 12) % 12;
    assert.equal(writtenPc, soundingPc, `${p.note.id} keeps its pitch class`);
    assert.equal(
      getCanonicalSyllable(writtenPc),
      getCanonicalSyllable(soundingPc),
      `${p.note.id} keeps its solfège`
    );
  }
});
