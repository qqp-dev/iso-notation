import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildJankoLayout,
  CHORD_DEFINITIONS,
  computeChordShapeVerification,
} from '../src/render/janko-model';
import { linearIndex, wholeToneParity } from '../src/model/pitch';

test('Janko keyboard 2-row layout geometry verification', () => {
  const layout = buildJankoLayout(1, 7, 36, 42, 4);

  // Total columns = 7 octaves * 6 whole-tone columns = 42 columns
  assert.equal(layout.totalColumns, 42);

  // Exactly two rows: 42 * 2 = 84 keys
  assert.equal(layout.keys.length, 42 * 2);

  const row0Keys = layout.keys.filter(k => k.row === 0);
  const row1Keys = layout.keys.filter(k => k.row === 1);
  assert.equal(row0Keys.length, 42);
  assert.equal(row1Keys.length, 42);

  // Verify Row 0 parity (Even: 0, 2, 4, 6, 8, 10)
  for (const k of row0Keys) {
    assert.equal(k.wholeToneSet, 0, 'Row 0 must belong to Whole-Tone Set 0 (Even)');
    assert.equal(wholeToneParity(k.pitch), 0);
    assert.ok([0, 2, 4, 6, 8, 10].includes(k.pitch.pitchClass));
    assert.equal(k.x, k.column * layout.keyWidth);
  }

  // Verify Row 1 parity (Odd: 1, 3, 5, 7, 9, 11) and +0.5 stagger
  for (const k of row1Keys) {
    assert.equal(k.wholeToneSet, 1, 'Row 1 must belong to Whole-Tone Set 1 (Odd)');
    assert.equal(wholeToneParity(k.pitch), 1);
    assert.ok([1, 3, 5, 7, 9, 11].includes(k.pitch.pitchClass));
    assert.equal(k.x, (k.column + 0.5) * layout.keyWidth);
  }
});

test('Hand-shape isomorphism invariant across all 12 transpositions', () => {
  const chords = ['Major Triad', 'Minor Triad', 'Dominant 7th', 'Diminished 7th'];

  for (const chordName of chords) {
    // Transpose across all 12 root pitch classes (0 to 11)
    const signaturesByRoot: Record<number, string> = {};

    for (let rootPc = 0; rootPc < 12; rootPc++) {
      const ver = computeChordShapeVerification(chordName, rootPc, 4);
      signaturesByRoot[rootPc] = JSON.stringify(ver.normalizedVectorSignature);
    }

    // Roots with the same whole-tone parity have 100% identical relative vector displacement:
    // All even roots (0, 2, 4, 6, 8, 10)
    const evenSig = signaturesByRoot[0];
    [2, 4, 6, 8, 10].forEach(r => {
      assert.equal(
        signaturesByRoot[r],
        evenSig,
        `Chord ${chordName} root ${r} must match root 0 vector signature`
      );
    });

    // All odd roots (1, 3, 5, 7, 9, 11)
    const oddSig = signaturesByRoot[1];
    [3, 5, 7, 9, 11].forEach(r => {
      assert.equal(
        signaturesByRoot[r],
        oddSig,
        `Chord ${chordName} root ${r} must match root 1 vector signature`
      );
    });
  }
});
