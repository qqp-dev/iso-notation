import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generatePreparedStudio, staticInputKey, type PreparedStaticCache } from '../src/render/janko/prepared/generate';
import { fingerprintInputs, snapshotKey } from '../src/render/janko/prepared/seam';
import { DEFAULT_JANKO_OPTIONS } from '../src/render/janko/types';

test('static reuse is byte-identical to cold real engraving, and state is excluded only from static identity', () => {
  const root = process.cwd(), state = `/tmp/janko-cache-absent-${process.pid}.json`;
  const snapshot = fingerprintInputs(root);
  const original = staticInputKey(snapshot, state);
  const entries = new Map(snapshot.entries);
  entries.set(state, 'changed candidate');
  assert.equal(staticInputKey({ entries }, state), original);
  for (const file of ['src/render/janko/engine.ts', 'src/render/janko/types.ts', 'src/scores/brahms-op118-no1.ts', 'src/scores/data/brahms-op118-no1-written-durations.json', 'public/fonts/URWGothic-Book.otf']) {
    const changed = new Map(entries);
    changed.set(`${root}/${file}`, 'drift');
    assert.notEqual(staticInputKey({ entries: changed }, state), original, `${file} invalidates static engraving`);
  }
  const cache: PreparedStaticCache = {};
  const cold = generatePreparedStudio({}, root, state, cache);
  assert.equal(cache.key, original);
  const warm = generatePreparedStudio({}, root, state, cache);
  const uncached = generatePreparedStudio({}, root, state);
  for (const result of [warm, uncached]) {
    assert.deepEqual(result.artifacts, cold.artifacts);
    assert.deepEqual(result.artifactHashes, cold.artifactHashes);
    assert.equal(result.generation, cold.generation);
    assert.deepEqual(result.status.ok, cold.status.ok);
  }
  // Explicit options do not reuse the default's canonical fragments.
  const altered = generatePreparedStudio({ options: { ...DEFAULT_JANKO_OPTIONS, showBeatGrid: !DEFAULT_JANKO_OPTIONS.showBeatGrid } }, root, state, cache);
  assert.equal(cache.key, original);
  assert.notEqual(altered.artifactHashes.reference, cold.artifactHashes.reference);
});

test('binary font and MIDI byte changes invalidate coherent snapshots and static reuse even when UTF-8 decoding aliases', () => {
  const root = mkdtempSync(join(tmpdir(), 'janko-binary-fingerprint-'));
  try {
    const font = join(root, 'public/fonts/fixture.otf');
    const midi = join(root, 'public/midi/fixture.mid');
    const text = join(root, 'src/fixture.ts');
    for (const dir of ['public/fonts', 'public/midi', 'src']) mkdirSync(join(root, dir), { recursive: true });
    writeFileSync(font, Buffer.from([0x00, 0x80, 0xff]));
    writeFileSync(midi, Buffer.from([0x4d, 0x54, 0x81]));
    writeFileSync(text, 'export const fixture = 1;\n');
    const first = fingerprintInputs(root);
    const stateFile = join(root, '.semantic-candidate.local');
    const cache: PreparedStaticCache = { key: staticInputKey(first, stateFile) };

    for (const [file, original, replacement] of [
      [font, Buffer.from([0x00, 0x80, 0xff]), Buffer.from([0x00, 0x81, 0xff])],
      [midi, Buffer.from([0x4d, 0x54, 0x81]), Buffer.from([0x4d, 0x54, 0x82])],
    ] as const) {
      assert.notDeepEqual(original, replacement);
      assert.equal(original.toString('utf8'), replacement.toString('utf8'), 'decoded text aliases despite distinct bytes');
      const before = fingerprintInputs(root);
      writeFileSync(file, replacement);
      const after = fingerprintInputs(root);
      assert.notEqual(after.entries.get(file), before.entries.get(file), `${file} hashes its binary bytes`);
      assert.notEqual(snapshotKey(after), snapshotKey(before), `${file} invalidates coherence`);
      assert.notEqual(staticInputKey(after, stateFile), staticInputKey(before, stateFile), `${file} invalidates static engraving reuse`);
      assert.notEqual(staticInputKey(after, stateFile), cache.key, `${file} cannot hit the original cache`);
      writeFileSync(file, original);
    }
    assert.equal(snapshotKey(fingerprintInputs(root)), snapshotKey(first), 'restoring bytes restores the snapshot');
    writeFileSync(text, 'export const fixture = 2;\n');
    const changedText = fingerprintInputs(root);
    assert.notEqual(changedText.entries.get(text), first.entries.get(text), 'text changes still move their digest');
    assert.notEqual(staticInputKey(changedText, stateFile), cache.key, 'text inputs still invalidate static reuse');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
