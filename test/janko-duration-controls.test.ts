import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { baseline, activeDurationVariants, executeHandCommand, inspectDurationCandidate, readCandidate, SEMANTIC_SCORE, BACH_SCORE, type HandIntent } from '../src/render/janko/semantic-hand';
import { generatePreparedStudio, type PreparedStaticCache } from '../src/render/janko/prepared/generate';
import type { DurationIntent } from '../src/render/janko/duration-rig';
import { buildBrahmsOp118No1Score, BRAHMS_OP118_NO1_JANKO_OPTIONS, BRAHMS_OP118_NO1_JANKO_TOKENS } from '../src/scores/brahms-op118-no1';
import { layoutJankoScore, renderJankoPage, countJankoPages } from '../src/render/janko/engine';

const root = process.cwd();
function request(score: typeof SEMANTIC_SCORE | typeof BACH_SCORE, base: string, id: string): DurationIntent {
  return { schema: 1, intent: 'engrave-duration', score, base, variantId: id,
    tokens: { halfRingGap: 0.15 }, windows: [{ measureStart: 1, measureCount: 2 }] };
}

test('duration intent is distinct, guarded on both registered scores and undo restores the variant projection', () => {
  const dir = mkdtempSync(join(tmpdir(), 'duration-controls-'));
  try {
    for (const score of [SEMANTIC_SCORE, BACH_SCORE] as const) {
      const path = join(dir, `${score}.json`), base = baseline(root, score);
      const first = executeHandCommand({ action: 'change', request: request(score, base, 'incumbent') }, root, path, undefined, score);
      assert.equal(activeDurationVariants(readCandidate(root, path, score)).length, 1);
      const bytes = readFileSync(path);
      assert.throws(() => executeHandCommand({ action: 'change', request: request(score, base, 'stale') }, root, path, undefined, score), /stale/);
      assert.deepEqual(readFileSync(path), bytes);
      assert.throws(() => executeHandCommand({ action: 'change', request: request(score === BACH_SCORE ? SEMANTIC_SCORE : BACH_SCORE, first.revision, 'wrong') }, root, path, undefined, score), /cross-score/);
      assert.deepEqual(readFileSync(path), bytes);
      assert.throws(() => executeHandCommand({ action: 'change', request: { ...request(score, first.revision, 'bad'), tokens: { halfRingGap: 0.1, ticksPerMeasure: 1 } } as unknown as DurationIntent }, root, path, undefined, score), /unsupported/);
      assert.deepEqual(readFileSync(path), bytes);
      const second = executeHandCommand({ action: 'change', request: { ...request(score, first.revision, 'alternate'), tokens: { halfRingGap: 0.35 } } }, root, path, undefined, score);
      assert.deepEqual(activeDurationVariants(readCandidate(root, path, score)).map(v => v.id), ['incumbent', 'alternate']);
      executeHandCommand({ action: 'undo', base: second.revision, revision: second.revision }, root, path, undefined, score);
      assert.deepEqual(activeDurationVariants(readCandidate(root, path, score)).map(v => v.id), ['incumbent']);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// #118 has editable Brahms hand provenance; its hand change alters the actual
// shared-mark ownership. Both orders must be independently exercised even while red.
const score = SEMANTIC_SCORE;
const note = buildBrahmsOp118No1Score().notes.find(n => n.id === 'brahms-op118-no1-118')!;
const inspectedTarget = inspectDurationCandidate(score, 9, 1584).find(m => m.target.ownerIds.includes(note.id))!.target;
assert.equal(inspectedTarget.family, 'ring', 'm. 9 fixture is the shared full ring');
const target = { ...inspectedTarget, family: 'ring' as const };
const hand = (base: string): HandIntent => ({ schema: 1, intent: 'assign-hand', score, base,
  scope: 'this' as const, target: note.hand === 'RH' ? 'LH' as const : 'RH' as const,
  selected: [{ id: note.id, pitchClass: note.pitch.pitchClass, octave: note.pitch.octave,
    tick: note.startTick, expectedHand: note.hand }] });
const beside = (base: string): DurationIntent => ({ ...request(score, base, 'beside'),
  placements: [{ target, preference: 'beside' }], windows: [{ measureStart: 9, measureCount: 4 }] });

test('hand-first inspect describes projected shared ownership under the saved revision', () => {
  const dir = mkdtempSync(join(tmpdir(), 'duration-hand-inspect-'));
  try {
    const path = join(dir, 'candidate.json');
    const handResult = executeHandCommand({ action: 'change', request: hand(baseline(root, score)) }, root, path, undefined, score);
    const inspected = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/semantic-hand.ts', 'inspect-duration',
      '--state', path, '--score', score, '--measure', '9', '--tick', '1584'], { cwd: root, encoding: 'utf8', timeout: 120000 });
    assert.equal(inspected.status, 0, inspected.stderr);
    const view = JSON.parse(inspected.stdout);
    assert.equal(view.revision, handResult.revision);
    assert.ok(!view.marks.some((m: { mount: string; target: { ownerIds: string[] } }) =>
      m.mount === 'carrier' && JSON.stringify(m.target.ownerIds) === JSON.stringify(target.ownerIds)),
      'inspect must describe projected candidate ink rather than canonical shared carrier under its saved revision');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('hand-first placement rejects the canonical shared target atomically after owner projection', () => {
  const dir = mkdtempSync(join(tmpdir(), 'duration-hand-first-'));
  try {
    const path = join(dir, 'candidate.json');
    const handResult = executeHandCommand({ action: 'change', request: hand(baseline(root, score)) }, root, path, undefined, score);
    const before = readFileSync(path);
    assert.throws(() => executeHandCommand({ action: 'change', request: beside(handResult.revision) }, root, path, undefined, score), /owner|seat|changed/i);
    assert.deepEqual(readFileSync(path), before, 'a canonical carrier target must not be applied to a projected bracket');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('duration-first hand change revalidates existing placement against projected ownership atomically', () => {
  const dir = mkdtempSync(join(tmpdir(), 'duration-duration-first-'));
  try {
    const path = join(dir, 'candidate.json');
    const saved = executeHandCommand({ action: 'change', request: beside(baseline(root, score)) }, root, path, undefined, score);
    const before = readFileSync(path);
    assert.throws(() => executeHandCommand({ action: 'change', request: hand(saved.revision) }, root, path, undefined, score), /owner|seat|changed/i);
    assert.deepEqual(readFileSync(path), before, 'a hand change must not leave a saved carrier preference on a projected bracket');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('refused beside seat with detached rule-wide mount does not silently split a shared statement', () => {
  const score = buildBrahmsOp118No1Score();
  const inspectedTarget = inspectDurationCandidate(SEMANTIC_SCORE, 9, 1584).find(m =>
    m.target.ownerIds.includes('brahms-op118-no1-117'))!.target;
  assert.equal(inspectedTarget.family, 'ring', 'm. 9 fixture is the shared full ring');
  const target = { ...inspectedTarget, family: 'ring' as const };
  const dir = mkdtempSync(join(tmpdir(), 'duration-combined-'));
  try {
    const path = join(dir, 'candidate.json');
    const requested: DurationIntent = { ...request(SEMANTIC_SCORE, baseline(root, SEMANTIC_SCORE), 'combined'),
      options: { exceptionCarrier: 'symbol' }, placements: [{ target, preference: 'beside' }],
      windows: [{ measureStart: 9, measureCount: 4 }] };
    try {
      executeHandCommand({ action: 'change', request: requested }, root, path, undefined, SEMANTIC_SCORE);
    } catch (error) {
      assert.match(String(error), /unsupported|symbol|mount|preference|seat/i);
      assert.equal(readCandidate(root, path, SEMANTIC_SCORE).records.length, 0, 'an unsupported combination must be rejected before history is written');
      return;
    }
    // If the combined mode is supported, an out-of-bounds engine fit probe must
    // publish refusal and retain the shared horizontal statement. The large
    // synthetic air is deliberately outside the guarded CLI range.
    const layouts = layoutJankoScore(score, { ...BRAHMS_OP118_NO1_JANKO_OPTIONS,
      exceptionCarrier: 'symbol', durationSeatPreferences: [{ tick: target.tick, family: target.family,
        ownerIds: target.ownerIds, seat: 'beside' }] },
      { ...BRAHMS_OP118_NO1_JANKO_TOKENS, detachedSymbolAir: 1000 });
    const refused = layouts.flatMap(l => l.durationSeatRefusals).find(r => r.tick === target.tick &&
      target.ownerIds.every(id => r.ownerIds.includes(id)) && r.ownerIds.length === target.ownerIds.length);
    assert.ok(refused, 'the deliberately out-of-bounds requested seat must report its refusal');
    const statements = layouts.flatMap(l => l.durationInkOwners).filter(m => m.tick === target.tick &&
      target.ownerIds.some(id => m.ownerIds.includes(id)));
    assert.ok(statements.some(m => m.mount === 'carrier' &&
      JSON.stringify([...m.ownerIds].sort()) === JSON.stringify(target.ownerIds)),
      'an accepted combined mode must keep the shared statement on fit refusal');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('full-owner shared placement fits or explicitly refuses; changed owner set never writes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'duration-shared-'));
  try {
    const path = join(dir, 'candidate.json'), score: typeof SEMANTIC_SCORE = SEMANTIC_SCORE;
    const mark = inspectDurationCandidate(score, 9, 1584).find(m => m.target.ownerIds.includes('brahms-op118-no1-117'))!;
    assert.deepEqual(mark.target.ownerIds, ['brahms-op118-no1-117', 'brahms-op118-no1-118']);
    assert.equal(mark.target.family, 'ring');
    const target = { ...mark.target, family: 'ring' as const };
    const requested = { ...request(score, baseline(root, score), 'beside'), placements: [{ target, preference: 'beside' as const }], windows: [{ measureStart: 9, measureCount: 4 }] };
    const wrong = { ...requested, placements: [{ target: { ...target, ownerIds: [target.ownerIds[0]] }, preference: 'beside' as const }] };
    assert.throws(() => executeHandCommand({ action: 'change', request: wrong }, root, path, undefined, score), /owner/);
    const result = executeHandCommand({ action: 'change', request: requested }, root, path, undefined, score);
    const variant = activeDurationVariants(readCandidate(root, path, score))[0];
    assert.equal(result.revision.length, 64);
    assert.equal(variant.refusals.length, 0, 'literal m. 9 has a legal fitted shared seat');
    assert.equal(variant.lint.newViolations.length, 0);
    const cache: PreparedStaticCache = {};
    const prepared = generatePreparedStudio({}, root, path, cache);
    assert.match(prepared.artifacts.candidates, /data-candidate="duration-beside"/);
    // A requested parallel variant is an entire score, not a hand-picked pair
    // of diagnostic crops. Compare every served page to the real engine.
    const card = prepared.artifacts.candidates.split('data-candidate="duration-beside"')[1]?.split('</article>')[0];
    assert.ok(card, 'the optional variant has its own isolated card');
    const projected = buildBrahmsOp118No1Score();
    const variantOptions = { ...BRAHMS_OP118_NO1_JANKO_OPTIONS,
      durationSeatPreferences: variant.placements.map(p => ({ tick: p.target.tick, ownerIds: p.target.ownerIds,
        family: p.target.family, seat: p.preference })) , ...variant.options };
    const variantTokens = { ...BRAHMS_OP118_NO1_JANKO_TOKENS, ...variant.tokens };
    const pageCount = countJankoPages(projected, variantOptions, variantTokens);
    assert.equal(pageCount, 6, 'Brahms complete spread is six pages');
    const servedPages = [...card.matchAll(/<figure class="page-card" data-page="(\d+)">[\s\S]*?<svg\b[\s\S]*?<\/svg>/g)];
    assert.equal(servedPages.length, pageCount, 'variant card contains every full real page');
    for (let page = 0; page < pageCount; page++) {
      assert.equal(Number(servedPages[page][1]), page + 1);
      assert.ok(servedPages[page][0].includes(renderJankoPage(projected, page, variantOptions, variantTokens)
        .replace('<svg ', '<svg class="janko-svg" ')), `page ${page + 1} uses real variant ink`);
    }
    assert.equal(prepared.variantId, 'beside');
    assert.equal(prepared.candidateRevision, result.revision);
    const reference = prepared.artifacts.reference;
    const cached = generatePreparedStudio({}, root, path, cache);
    assert.equal(cached.artifacts.reference, reference);
    assert.equal(cached.artifactHashes.reference, prepared.artifactHashes.reference);
    assert.equal(cached.artifacts.candidates, prepared.artifacts.candidates);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
