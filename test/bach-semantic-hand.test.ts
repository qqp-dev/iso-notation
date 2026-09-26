import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1';
import { buildBrahmsOp118No1Score } from '../src/scores/brahms-op118-no1';
import { generatePreparedStudio } from '../src/render/janko/prepared/generate';
import { createStudioConfig, renderCandidatesView, renderReferenceView } from '../src/render/janko/studio';
import { renderJankoCrop } from '../src/render/janko/engine';
import { DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS } from '../src/render/janko/types';
import { lintJankoScore } from '../src/render/janko/linter';

const root = process.cwd();
const bach = 'bach-goldberg-var1';
const brahms = 'brahms-op118-no1';
const hash = (bytes: string) => createHash('sha256').update(bytes).digest('hex');
const guard = (id: string, pc: number, tick: number, hand: 'LH' | 'RH' = 'LH') =>
  ({ id, pitchClass: pc, octave: 2, tick, expectedHand: hand });
const intent = (base: string, scope: 'this' | 'set' | 'source-linked', selected = [guard('bach-var1-70', 11, 576)]) =>
  ({ schema: 1, score: bach, base, intent: 'assign-hand', target: 'RH', scope, selected });

// These subprocesses use only private state paths, never the operator-owned candidate or server.
function command(action: string, state: string, score: string, input?: unknown, explicitScore = true) {
  const args = ['--import', join(root, 'node_modules/tsx/dist/loader.mjs'), join(root, 'scripts/semantic-hand.ts'), action,
    '--state', state, '--wait-ms', '0', ...(explicitScore ? ['--score', score] : [])];
  const run = spawnSync(process.execPath, args, {
    cwd: root, encoding: 'utf8', input: input === undefined ? undefined : JSON.stringify(input), timeout: 120000,
  });
  assert.equal(run.error, undefined, `semantic hand command infrastructure: ${run.error}`);
  const output = run.status === 0 ? run.stdout : run.stderr;
  let result: Record<string, any>;
  try { result = JSON.parse(output); } catch { assert.fail(`semantic hand ${action} did not emit JSON: ${output}`); }
  return { code: run.status, result };
}

function isolated(fn: (file: string) => void) {
  const dir = mkdtempSync(join(tmpdir(), 'bach-hand-test-'));
  try { fn(join(dir, 'candidate.json')); } finally { rmSync(dir, { recursive: true, force: true }); }
}

test('Bach this/set are guarded score-selected edits; undo appends and the canonical scores remain untouched', () => isolated(file => {
  const canonical = buildBachGoldbergVar1Score();
  const untouchedBrahms = JSON.stringify(buildBrahmsOp118No1Score());
  const start = command('status', file, bach);
  assert.equal(start.code, 0);
  const one = command('change', file, bach, intent(start.result.revision, 'this'));
  assert.equal(one.code, 0, JSON.stringify(one.result));
  assert.equal(one.result.replay, false);
  assert.deepEqual(one.result.effects.selected.map((a: { id: string }) => a.id), ['bach-var1-70']);
  assert.match(one.result.effects.selected[0].citation, /bach|builder|corpus/i);
  assert.doesNotMatch(one.result.effects.selected[0].citation, /\.ily|occurrence|MIDI track/i);
  assert.ok(one.result.effects.reviewWindows.some((w: { measureStart: number; measureCount: number }) =>
    w.measureStart <= 5 && w.measureStart + w.measureCount > 5), 'the affected m. 5 is reviewable');
  assert.equal(command('status', file, bach).result.revision, one.result.revision);
  const two = command('change', file, bach, intent(one.result.revision, 'set', [
    guard('bach-var1-70', 11, 576, 'RH'), guard('bach-var1-71', 9, 588),
  ]));
  assert.equal(two.code, 0, JSON.stringify(two.result));
  assert.notEqual(two.result.revision, one.result.revision);
  assert.deepEqual(two.result.effects.selected.map((a: { id: string }) => a.id).sort(), ['bach-var1-70', 'bach-var1-71']);
  const explained = command('explain', file, bach);
  assert.equal(explained.code, 0);
  assert.equal(explained.result.revision, two.result.revision);
  assert.deepEqual(explained.result.reviewWindows, two.result.effects.reviewWindows);
  const saved = JSON.parse(readFileSync(file, 'utf8'));
  assert.equal(saved.records.length, 2);
  const undone = command('undo', file, bach, { base: two.result.revision, revision: two.result.revision });
  assert.equal(undone.code, 0, JSON.stringify(undone.result));
  assert.notEqual(undone.result.revision, one.result.revision, 'undo appends, never rewinds history');
  assert.equal(JSON.parse(readFileSync(file, 'utf8')).records.length, 3);
  assert.equal(command('undo', file, bach, { base: two.result.revision, revision: two.result.revision }).code, 1);
  assert.deepEqual(buildBachGoldbergVar1Score(), canonical);
  assert.equal(JSON.stringify(buildBrahmsOp118No1Score()), untouchedBrahms);
}));

test('unknown score, cross-score guards/history/undo, stale or false guards, and unsupported Bach provenance fail without mutation', () => isolated(file => {
  const status = command('status', file, bach);
  assert.equal(status.code, 0);
  const base = status.result.revision;
  for (const invalid of [
    intent(base, 'source-linked'),
    intent(base, 'this', [guard('bach-var1-70', 11, 576, 'RH')]),
    intent(base, 'this', [guard('bach-var1-70', 9, 576)]),
    intent(base, 'this', [guard('brahms-op118-no1-17', 11, 576)]),
    intent('stale', 'this'),
  ]) {
    assert.equal(command('change', file, bach, invalid).code, 1, JSON.stringify(invalid));
    assert.equal(existsSync(file), false, 'invalid request does not create a history');
  }
  assert.equal(command('status', file, 'not-a-score').code, 1);
  assert.equal(command('change', file, 'not-a-score', { ...intent(base, 'this'), score: 'not-a-score' }).code, 1);
  const first = command('change', file, bach, intent(base, 'this'));
  assert.equal(first.code, 0, JSON.stringify(first.result));
  const snapshot = readFileSync(file);
  assert.equal(command('change', file, brahms, { ...intent(first.result.revision, 'this'), score: brahms }).code, 1);
  assert.equal(command('undo', file, brahms, { base: first.result.revision, revision: first.result.revision }).code, 1);
  assert.equal(command('explain', file, brahms).code, 1);
  assert.deepEqual(readFileSync(file), snapshot, 'cross-score requests never retarget or mutate saved history');
}));

test('legacy default Brahms remains usable, while selecting Bach never silently retargets it', () => isolated(file => {
  const legacy = command('status', file, brahms, undefined, false);
  assert.equal(legacy.code, 0);
  const explicit = command('status', file, brahms);
  assert.equal(explicit.code, 0);
  assert.equal(explicit.result.revision, legacy.result.revision);
  const request = { schema: 1, score: brahms, base: legacy.result.revision, intent: 'assign-hand', target: 'LH', scope: 'this',
    selected: [{ id: 'brahms-op118-no1-17', pitchClass: 0, octave: 4, tick: 240, expectedHand: 'RH' }] };
  const saved = command('change', file, brahms, request, false);
  assert.equal(saved.code, 0, JSON.stringify(saved.result));
  const bytes = readFileSync(file);
  const bachView = command('status', file, bach);
  assert.ok(bachView.code !== 0 || bachView.result.state === 'stale', 'Brahms state cannot be presented as a current Bach revision');
  assert.deepEqual(readFileSync(file), bytes);
  assert.equal(command('status', file, brahms, undefined, false).result.revision, saved.result.revision);
}));

test('the settled Bach m. 5 hand judgment remains in the real canonical score when a new round opens', () => {
  const score = buildBachGoldbergVar1Score();
  for (const [id, tick] of [['bach-var1-70', 576], ['bach-var1-71', 588]] as const) {
    const note = score.notes.find(n => n.id === id);
    assert.equal(note?.startTick, tick);
    assert.equal(note?.hand, 'LH', `${id} retains the judged LH reading`);
  }
  assert.match(renderJankoCrop(score, 5, 4, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS), /<svg/);
});

test('real-engine Bach Candidate identifies exact saved revision and m. 5 crop; both References stay canonical', () => isolated(file => {
  const reference = renderReferenceView(createStudioConfig());
  assert.ok(reference.includes('data-score="primary"'), 'Bach GOLD is the primary Reference');
  assert.ok(reference.includes('data-score="brahms-op118-no1"'), 'Brahms BRONZE remains in Reference');
  const canonical = buildBachGoldbergVar1Score();
  assert.equal(lintJankoScore(canonical, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS).violations.length, 0);
  const crop = renderJankoCrop(canonical, 5, 4, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
  assert.match(crop, /<svg/);
  const plain = generatePreparedStudio({}, root, file);
  const status = command('status', file, bach);
  assert.equal(status.code, 0);
  const saved = command('change', file, bach, intent(status.result.revision, 'this'));
  assert.equal(saved.code, 0, JSON.stringify(saved.result));
  const prepared = generatePreparedStudio({}, root, file);
  assert.equal(prepared.candidateRevision, saved.result.revision);
  assert.match(prepared.artifacts.candidates, /data-candidate="semantic-hand"/);
  assert.match(prepared.artifacts.candidates, /data-window="bach-goldberg-var1:5-8"/);
  assert.equal(prepared.artifacts.reference, reference);
  assert.equal(prepared.artifactHashes.reference, plain.artifactHashes.reference);
  assert.notEqual(prepared.artifactHashes.candidates, plain.artifactHashes.candidates);
  assert.equal(prepared.artifactHashes.candidates, hash(prepared.artifacts.candidates));
  assert.equal(prepared.generation.length, 64);
  assert.equal(renderReferenceView(createStudioConfig()), reference);
  assert.notEqual(renderCandidatesView(createStudioConfig()), prepared.artifacts.candidates);
}));
