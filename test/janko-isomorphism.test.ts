import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildJankoLayout,
  CHORD_DEFINITIONS,
  computeChordShapeVerification,
} from '../src/render/janko-model';
import { linearIndex, wholeToneParity } from '../src/model/pitch';

test('Janko keyboard 4-row layout geometry verification', () => {
  const layout = buildJankoLayout(1, 7, 36, 42, 4);

  // Total columns = 7 octaves * 6 whole-tone columns = 42 columns
  assert.equal(layout.totalColumns, 42);

  // Each column has 4 keys (Row 1, 2, 3, 4) -> 42 * 4 = 168 keys
  assert.equal(layout.keys.length, 42 * 4);

  // Verify row parity
  for (const k of layout.keys) {
    if (k.row === 1 || k.row === 3) {
      assert.equal(k.wholeToneSet, 0, 'Rows 1 & 3 must belong to WT-A');
      assert.equal(wholeToneParity(k.pitch), 0);
    } else {
      assert.equal(k.wholeToneSet, 1, 'Rows 2 & 4 must belong to WT-B');
      assert.equal(wholeToneParity(k.pitch), 1);
    }
  }

  // Verify mechanical coupling: Row 3 duplicates Row 1
  const row1Keys = layout.keys.filter(k => k.row === 1);
  const row3Keys = layout.keys.filter(k => k.row === 3);
  assert.equal(row1Keys.length, row3Keys.length);
  for (let i = 0; i < row1Keys.length; i++) {
    assert.equal(row1Keys[i].linearIndex, row3Keys[i].linearIndex);
    assert.equal(row1Keys[i].column, row3Keys[i].column);
  }

  // Verify mechanical coupling: Row 4 duplicates Row 2
  const row2Keys = layout.keys.filter(k => k.row === 2);
  const row4Keys = layout.keys.filter(k => k.row === 4);
  assert.equal(row2Keys.length, row4Keys.length);
  for (let i = 0; i < row2Keys.length; i++) {
    assert.equal(row2Keys[i].linearIndex, row4Keys[i].linearIndex);
    assert.equal(row2Keys[i].column, row4Keys[i].column);
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
    // All even roots (0, 2, 4, 6, 8, 10): C, D, E, F#, G#, A#
    const evenSig = signaturesByRoot[0];
    [2, 4, 6, 8, 10].forEach(r => {
      assert.equal(
        signaturesByRoot[r],
        evenSig,
        `Chord ${chordName} root ${r} must match root 0 vector signature`
      );
    });

    // All odd roots (1, 3, 5, 7, 9, 11): C#, D#, F, G, A, B
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
