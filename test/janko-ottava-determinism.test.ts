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
  renderJankoPage,
} from '../src/render/janko/engine';
import { toMidi, linearIndex } from '../src/model/pitch';
import { continuousPitchY } from '../src/render/janko/geometry';

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
          // 8vb / 15mb: bracket is below note
          assert.ok(
            matchingBracket.lineY >= p.y + r + t.ottavaClearance - 0.01,
            `bracket lineY (${matchingBracket.lineY}) clears note bottom (${p.y + r})`
          );
        } else {
          // 8va / 15ma: bracket is above note
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
