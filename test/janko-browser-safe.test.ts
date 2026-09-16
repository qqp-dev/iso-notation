/**
 * Browser-safe debug probe — `resolveChordColumns` must not crash where
 * `process` is undefined (browsers).
 *
 * Round 33 preview startup crashed with `TypeError: Cannot read properties of
 * undefined (reading 'env')` at the direct `process.env.JANKO_DEBUG_JOINT`
 * read in `resolveChordColumns` (engine.ts). The Bach Goldberg Var. 1 layout
 * hits that joint-residual path, so laying it out with `process` hidden is a
 * faithful browser reproduction.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1';
import { layoutJankoScore } from '../src/render/janko/engine';

test('layoutJankoScore does not throw when global process is undefined (browser)', () => {
  const saved = (globalThis as { process?: unknown }).process;
  (globalThis as { process?: unknown }).process = undefined;
  try {
    const score = buildBachGoldbergVar1Score();
    const layouts = layoutJankoScore(score);
    assert.ok(layouts.length > 0, 'expected at least one system layout');
  } finally {
    (globalThis as { process?: unknown }).process = saved;
  }
});
