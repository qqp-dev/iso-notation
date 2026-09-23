import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, rmSync, writeFileSync, mkdtempSync, mkdirSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { buildBrahmsOp118No1Score } from '../src/scores/brahms-op118-no1';
import { baseline, candidateHealth, candidateScore, executeHandCommand, head, readCandidate, recoverHandCandidate, resolveLinkedOccurrences, SEMANTIC_STATE, type HandIntent } from '../src/render/janko/semantic-hand';
import { createStudioConfig, renderCandidatesView, renderReferenceView } from '../src/render/janko/studio';
import { generatePreparedStudio } from '../src/render/janko/prepared/generate';
import { fingerprintInputs, isWatchedInput, snapshotKey } from '../src/render/janko/prepared/seam';
import { BRAHMS_CURRENT_PAGES } from './support/brahms-current';
import provenance from '../src/scores/data/brahms-op118-no1-written-durations.provenance.json' with { type: 'json' };
import { renderJankoPage } from '../src/render/janko/engine';
import { spawnSync } from 'node:child_process';
import { BRAHMS_OP118_NO1_JANKO_OPTIONS, BRAHMS_OP118_NO1_JANKO_TOKENS } from '../src/scores/brahms-op118-no1';
const root = process.cwd();
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const statePath = `.semantic-test-${process.pid}.local`;
const stateFile = `${root}/${statePath}`;
const clean = () => { rmSync(stateFile, { force: true }); rmSync(`${stateFile}.lock`, { force: true }); };
const request = (base: string, scope: HandIntent['scope'] = 'source-linked'): HandIntent => ({ schema: 1, score: 'brahms-op118-no1', base, intent: 'assign-hand', target: 'LH', scope,
  selected: [{ id: 'brahms-op118-no1-17', pitchClass: 0, octave: 4, tick: 240, expectedHand: 'RH' }] });
const change = (intent: HandIntent) => executeHandCommand({ action: 'change', request: intent }, root, statePath);

test('guarded source-linked edit derives two rests/crossings, preserves source, affected page and Reference, then undo exactly restores', () => {
  clean();
  try {
    const source = buildBrahmsOp118No1Score();
    const sourceBytes = JSON.stringify(source);
    const originalReference = renderReferenceView(createStudioConfig());
    const saved = change(request(baseline(root)));
    assert.equal(saved.replay, false);
    assert.deepEqual(saved.effects.selected.map(a => [a.id, a.citation.includes('occurrence 2')]), [['brahms-op118-no1-17',false],['brahms-op118-no1-152',true]]);
    assert.deepEqual(saved.effects.crossings, [11,9]);
    assert.deepEqual(saved.effects.rests, [23,25]);
    assert.deepEqual(saved.effects.changedPages, [1]);
    assert.deepEqual(saved.effects.changedSystems, [1,3]);
    assert.equal(saved.effects.unchangedSystems.length, 16);
    assert.deepEqual(saved.effects.unchangedPages, [2,3,4,5]);
    assert.deepEqual(saved.effects.tieOwnerChanges, { added: [], removed: [] });
    assert.equal(saved.effects.durationOwnerChanges.added.length, 2);
    assert.equal(saved.effects.durationOwnerChanges.removed.length, 2);
    assert.deepEqual(saved.effects.changedCrops, ['mm.1–4','mm.9–12']);
    assert.deepEqual(saved.effects.reviewWindows.map(w => [w.measureStart,w.measureCount]), [[1,4],[9,4]]);
    const state = readCandidate(root, statePath), projected = candidateScore(state);
    assert.equal(head(state, root), saved.revision);
    assert.equal(JSON.stringify(buildBrahmsOp118No1Score()), sourceBytes);
    assert.deepEqual(projected.notes.map(n => ({ id: n.id, pitch: n.pitch, startTick: n.startTick, durationTicks: n.durationTicks, sourceProvenance: n.sourceProvenance })), source.notes.map(n => ({ id: n.id, pitch: n.pitch, startTick: n.startTick, durationTicks: n.durationTicks, sourceProvenance: n.sourceProvenance })));
    assert.equal(renderReferenceView(createStudioConfig({ semanticCandidate: { score: projected, revision: saved.revision, reviewWindows: saved.effects.reviewWindows } })), originalReference);
    const config = createStudioConfig({ semanticCandidate: { score: projected, revision: saved.revision, reviewWindows: saved.effects.reviewWindows } });
    const html = renderCandidatesView(config);
    assert.match(html, /data-candidate="semantic-hand"/);
    assert.match(html, /brahms-op118-no1:1-4/);
    assert.match(html, /brahms-op118-no1:9-12/);
    assert.equal(sha(renderJankoPage(source, 0, BRAHMS_OP118_NO1_JANKO_OPTIONS, BRAHMS_OP118_NO1_JANKO_TOKENS)), BRAHMS_CURRENT_PAGES[0]);
    assert.notEqual(sha(renderJankoPage(projected, 0, BRAHMS_OP118_NO1_JANKO_OPTIONS, BRAHMS_OP118_NO1_JANKO_TOKENS)), BRAHMS_CURRENT_PAGES[0]);
    for (let page = 1; page < 5; page++) assert.equal(sha(renderJankoPage(projected, page, BRAHMS_OP118_NO1_JANKO_OPTIONS, BRAHMS_OP118_NO1_JANKO_TOKENS)), BRAHMS_CURRENT_PAGES[page]);
    const undone = executeHandCommand({ action: 'undo', base: saved.revision, revision: saved.revision }, root, statePath);
    assert.deepEqual(candidateScore(readCandidate(root, statePath)), source);
    assert.equal(readCandidate(root, statePath).records.length, 2);
    assert.deepEqual(undone.effects.changedPages, [1]);
    assert.throws(() => executeHandCommand({ action: 'undo', base: saved.revision, revision: saved.revision }, root, statePath), /stale/);
  } finally { clean(); }
});

test('non-sample and multi-region edits publish exactly compared crops, with unchanged Reference', () => {
  clean();
  try {
    const reference = renderReferenceView(createStudioConfig());
    const later = { id: 'brahms-op118-no1-436', pitchClass: 0, octave: 4, tick: 6000, expectedHand: 'RH' as const };
    const saved = change({ ...request(baseline(root), 'this'), selected: [later] });
    assert.deepEqual(saved.effects.changedPages, [2]);
    assert.deepEqual(saved.effects.changedSystems, [8]);
    assert.deepEqual(saved.effects.changedCrops, ['mm.29–32']);
    assert.deepEqual(saved.effects.reviewWindows, [{ measureStart: 29, measureCount: 4, changed: true }]);
    const config = createStudioConfig({ semanticCandidate: { score: candidateScore(readCandidate(root,statePath)), revision: saved.revision, reviewWindows: saved.effects.reviewWindows } });
    const html = renderCandidatesView(config);
    assert.match(html, /data-window="brahms-op118-no1:29-32"/);
    assert.doesNotMatch(html.slice(html.indexOf('data-candidate="semantic-hand"')), /data-window="brahms-op118-no1:1-3"/);
    assert.equal(renderReferenceView(config), reference);
    const prepared = generatePreparedStudio({}, root, statePath);
    assert.equal(prepared.candidateRevision, saved.revision);
    assert.equal(prepared.artifacts.candidates, html);
    assert.match(prepared.artifacts.candidates, /data-window="brahms-op118-no1:29-32"/);
    assert.equal(prepared.artifacts.reference, reference);
    const multi = change({ ...request(saved.revision, 'set'), selected: [request(saved.revision).selected[0], { ...later, expectedHand: 'LH' }] });
    assert.deepEqual(multi.effects.changedSystems, [1]);
    assert.deepEqual(multi.effects.reviewWindows.map(w => [w.measureStart,w.changed]), [[1,true],[29,false]]);
    assert.deepEqual(multi.effects.changedCrops, ['mm.1–4']);
    assert.deepEqual(multi.effects.unchangedCrops, ['mm.29–32']);
    const multiConfig = createStudioConfig({ semanticCandidate: { score: candidateScore(readCandidate(root,statePath)), revision: multi.revision, reviewWindows: multi.effects.reviewWindows } });
    const multiHtml = renderCandidatesView(multiConfig);
    assert.match(multiHtml, /data-window="brahms-op118-no1:29-32"/);
    assert.match(multiHtml, /data-window="brahms-op118-no1:1-4"/);
    assert.equal(renderReferenceView(multiConfig), reference);
    const third = change({ ...request(multi.revision, 'this'), selected: [{ ...later, expectedHand: 'LH' }] });
    assert.deepEqual(third.effects.changedSystems, []);
    assert.deepEqual(third.effects.reviewWindows.map(w => w.measureStart), [1,29]); // retained earlier edited region
  } finally { clean(); }
});

test('one explicit set spanning nonadjacent pages renders both affected regions', () => {
  clean();
  try {
    const saved = change({ ...request(baseline(root), 'set'), selected: [request(baseline(root)).selected[0],
      { id: 'brahms-op118-no1-436', pitchClass: 0, octave: 4, tick: 6000, expectedHand: 'RH' }] });
    assert.deepEqual(saved.effects.changedSystems, [1,8]);
    assert.deepEqual(saved.effects.changedCrops, ['mm.1–4','mm.29–32']);
    const config = createStudioConfig({ semanticCandidate: { score: candidateScore(readCandidate(root,statePath)), revision: saved.revision, reviewWindows: saved.effects.reviewWindows } });
    const card = renderCandidatesView(config).split('data-candidate="semantic-hand"')[1];
    assert.match(card, /data-window="brahms-op118-no1:1-4"/);
    assert.match(card, /data-window="brahms-op118-no1:29-32"/);
  } finally { clean(); }
});

test('atomic guards, explicit set, this occurrence, source ambiguity and replay', () => {
  clean();
  try {
    const base = baseline(root);
    assert.throws(() => change({ ...request(base), target: 'XX' as 'LH' }), /invalid/);
    assert.throws(() => change({ ...request(base), intent: 'paint-expression' as 'assign-hand' }), /invalid/);
    assert.throws(() => change({ ...request(base), base: 'stale' }), /stale/);
    assert.throws(() => change({ ...request(base), selected: [{ ...request(base).selected[0], expectedHand: 'LH' }] }), /guard mismatch/);
    assert.throws(() => change({ ...request(base), selected: [{ ...request(base).selected[0], id: 'no-such-id' }] }), /guard mismatch/);
    const multi = buildBrahmsOp118No1Score().notes.find(n => n.sourceProvenance?.unison)!;
    assert.ok(multi);
    assert.throws(() => change({ ...request(base), selected: [{ id: multi.id, pitchClass: multi.pitch.pitchClass, octave: multi.pitch.octave, tick: multi.startTick, expectedHand: multi.hand }] }), /ambiguous/);
    assert.equal(existsSync(stateFile), false);
    const single = change(request(base, 'this'));
    assert.equal(candidateScore(readCandidate(root,statePath)).notes.find(n => n.id === 'brahms-op118-no1-152')!.hand, 'RH');
    assert.throws(() => change(request(base)), /stale/);
    const replay = change({ ...request(single.revision, 'this'), selected: [{ ...request(base).selected[0], expectedHand: 'LH' }] });
    assert.equal(replay.replay, true);
    assert.equal(readCandidate(root,statePath).records.length, 1);
    const explicit = change({ ...request(single.revision, 'set'), selected: [{ ...request(base).selected[0], expectedHand: 'LH' }, { id: 'brahms-op118-no1-152', pitchClass: 0, octave: 4, tick: 2160, expectedHand: 'RH' }] });
    assert.deepEqual(explicit.effects.selected.map(a => a.id), ['brahms-op118-no1-17','brahms-op118-no1-152']);
    const stored = readFileSync(stateFile,'utf8');
    writeFileSync(stateFile, stored.replace('occurrence 2','occurrence X'));
    assert.throws(() => readCandidate(root,statePath), /fingerprint mismatch/);
  } finally { clean(); }
});

test('source-linked resolver refuses macro/source identity collisions and duplicate occurrence without mutation', () => {
  const origin = provenance.events.find(e => e.startTick === 240 && e.pitchClass === 0 && e.octave === 4)!;
  const score = buildBrahmsOp118No1Score();
  const second = provenance.events.find(e => e.startTick === 2160 && e.pitchClass === 0 && e.octave === 4)!;
  assert.deepEqual(resolveLinkedOccurrences(origin, score, [origin, second]).map(n => n.id), ['brahms-op118-no1-17','brahms-op118-no1-152']);
  assert.throws(() => resolveLinkedOccurrences(origin, score, [origin, { ...second, pitchClass: 1, segments: [{ ...second.segments[0], midi: 61 }] }]), /collision/);
  assert.throws(() => resolveLinkedOccurrences(origin, score, [origin, { ...second, segments: [{ ...second.segments[0], occurrence: 1 }] }]), /ambiguous/);
  assert.throws(() => resolveLinkedOccurrences(origin, score, []), /ambiguous/);
});

test('authoritative confirm with no painted difference reports NO_VISIBLE_EFFECT, not option-badge change', () => {
  clean();
  try {
    const before = buildBrahmsOp118No1Score();
    const result = change({ schema: 1, score: 'brahms-op118-no1', base: baseline(root), intent: 'assign-hand', target: 'RH', scope: 'this',
      selected: [{ id: 'brahms-op118-no1-1', pitchClass: 0, octave: 5, tick: 0, expectedHand: 'RH' }] });
    assert.equal(result.effects.visible, 'NO_VISIBLE_EFFECT');
    assert.deepEqual(result.effects.changedPages, []);
    assert.equal(JSON.stringify(buildBrahmsOp118No1Score()), JSON.stringify(before));
  } finally { clean(); }
});

test('stale default-path source/engine drift refuses replay, keeps Reference and archives old history byte-for-byte before a new ready candidate', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'semantic-recover-'));
  const inputs = [
    'src/scores/data/brahms-op118-no1-written-durations.provenance.json',
    'src/scores/data/brahms-op118-no1-written-durations.json',
    'data/sources/brahms-op118-no1/includes/intermezzo-op118-no1-parts.ily',
    'public/midi/brahms-op118-no1.mid',
    'src/scores/data/brahms-op118-no1-source-silences.json',
    'src/scores/data/brahms-op118-no1-expressions.json',
    'src/scores/brahms-op118-no1.ts', 'src/scores/brahms-hand-corrections.ts', 'src/model/grid.ts',
    'src/model/semantic-identity.ts', 'src/scores/brahms-semantic-index.ts',
  ];
  const cli = (action: string, input?: unknown) => {
    const run = spawnSync(process.execPath, ['--import', join(root, 'node_modules/tsx/dist/loader.mjs'), join(root, 'scripts/semantic-hand.ts'), action, '--wait-ms', '0'],
      { cwd: fixture, encoding: 'utf8', input: input ? JSON.stringify(input) : undefined, timeout: 120000 });
    return { code: run.status, result: JSON.parse(run.status === 0 ? run.stdout : run.stderr) };
  };
  try {
    for (const file of inputs) { mkdirSync(dirname(join(fixture, file)), { recursive: true }); cpSync(join(root, file), join(fixture, file)); }
    cpSync(join(root, 'src/render/janko'), join(fixture, 'src/render/janko'), { recursive: true });
    const plain = generatePreparedStudio({}, fixture);
    // Follow the documented clean-start status → JSON-file change flow, with no saved state.
    const cleanStatus = cli('status');
    assert.equal(cleanStatus.code, 0);
    assert.equal(cleanStatus.result.state, 'current');
    assert.equal(cleanStatus.result.revision, cleanStatus.result.baseline);
    assert.equal(cleanStatus.result.saved, false);
    const requestFile = join(fixture, 'first-hand-request.json');
    writeFileSync(requestFile, JSON.stringify(request(cleanStatus.result.revision)));
    const firstChange = spawnSync(process.execPath, ['--import', join(root, 'node_modules/tsx/dist/loader.mjs'), join(root, 'scripts/semantic-hand.ts'), 'change', '--json', requestFile, '--wait-ms', '0'],
      { cwd: fixture, encoding: 'utf8', timeout: 120000 });
    assert.equal(firstChange.status, 0, firstChange.stderr);
    const initial = { code: firstChange.status, result: JSON.parse(firstChange.stdout) };
    assert.equal(initial.code, 0);
    assert.equal(cli('status').result.revision, initial.result.revision);
    assert.equal(initial.result.publication.state, 'pending');
    const savedRevision = initial.result.revision;
    const archiveBytes = readFileSync(join(fixture, SEMANTIC_STATE));
    const changed = generatePreparedStudio({}, fixture);
    assert.equal(changed.candidateRevision, savedRevision);
    assert.equal(changed.artifactHashes.reference, plain.artifactHashes.reference);
    const sourceFile = join(fixture, inputs[0]);
    writeFileSync(sourceFile, readFileSync(sourceFile, 'utf8') + '\n');
    const staleSource = candidateHealth(fixture);
    assert.equal(staleSource.state, 'stale');
    assert.match(staleSource.diagnostic!, /source mismatch/);
    const status = cli('status');
    assert.equal(status.code, 0);
    assert.equal(status.result.state, 'stale');
    assert.match(status.result.recovery, /recover --json/);
    assert.notEqual(status.result.baseline, savedRevision);
    assert.equal(cli('change', request(status.result.baseline)).code, 1);
    assert.equal(cli('undo', { base: savedRevision, revision: savedRevision }).code, 1);
    const stale = generatePreparedStudio({}, fixture);
    assert.equal(stale.candidateRevision, undefined);
    assert.match(stale.candidateError!, /source mismatch/);
    assert.match(stale.artifacts.candidates, /data-candidate="semantic-hand-stale"/);
    assert.match(stale.artifacts.candidates, /not applied/);
    assert.doesNotMatch(stale.artifacts.candidates, /data-candidate="semantic-hand"/);
    assert.equal(stale.artifacts.reference, plain.artifacts.reference);
    assert.equal(stale.artifactHashes.reference, plain.artifactHashes.reference);
    assert.equal(cli('recover', request('incorrect')).code, 1);
    assert.deepEqual(readFileSync(join(fixture, SEMANTIC_STATE)), archiveBytes);
    const pinnedFile = join(fixture, inputs[2]);
    const pinnedBytes = readFileSync(pinnedFile);
    try {
      writeFileSync(pinnedFile, Buffer.concat([pinnedBytes, Buffer.from('\n')]));
      assert.equal(cli('recover', request(cli('status').result.baseline)).code, 1, 'source drift cannot be recovered by silently reusing old provenance');
      assert.deepEqual(readFileSync(join(fixture, SEMANTIC_STATE)), archiveBytes);
    } finally { writeFileSync(pinnedFile, pinnedBytes); }
    const sourceBytes = readFileSync(sourceFile);
    try {
      const changedProvenance = JSON.parse(sourceBytes.toString());
      const c4 = changedProvenance.events.find((e: { startTick: number; pitchClass: number; octave: number }) =>
        e.startTick === 240 && e.pitchClass === 0 && e.octave === 4);
      c4.segments[0].voice = 'rightHandUpper'; // event/score retain leftHandUpper
      writeFileSync(sourceFile, JSON.stringify(changedProvenance));
      assert.equal(cli('recover', request(cli('status').result.baseline)).code, 1);
      assert.deepEqual(readFileSync(join(fixture, SEMANTIC_STATE)), archiveBytes, 'invalid source witness never archives/mutates candidate');
    } finally { writeFileSync(sourceFile, sourceBytes); }
    const recovery = cli('recover', request(status.result.baseline));
    assert.equal(recovery.code, 0);
    assert.equal(recovery.result.publication.state, 'pending');
    assert.deepEqual(readFileSync(recovery.result.archive), archiveBytes);
    assert.equal(recovery.result.archiveSha256, createHash('sha256').update(archiveBytes).digest('hex'));
    assert.notEqual(recovery.result.revision, savedRevision);
    const ready = generatePreparedStudio({}, fixture);
    assert.equal(ready.candidateRevision, recovery.result.revision);
    assert.equal(ready.candidateError, undefined);
    assert.equal(ready.artifacts.reference, plain.artifacts.reference);
    const undone = cli('undo', { base: recovery.result.revision, revision: recovery.result.revision });
    assert.equal(undone.code, 0);
    assert.deepEqual(candidateScore(readCandidate(fixture)), buildBrahmsOp118No1Score());
    const engineFile = join(fixture, 'src/model/grid.ts');
    writeFileSync(engineFile, readFileSync(engineFile, 'utf8') + '\n');
    assert.match(candidateHealth(fixture).diagnostic!, /engine mismatch/);
    assert.equal(cli('change', request(undone.result.revision)).code, 1);
    assert.equal(generatePreparedStudio({}, fixture).artifacts.reference, plain.artifacts.reference);
    assert.deepEqual(readFileSync(recovery.result.archive), archiveBytes);
  } finally { rmSync(fixture, { recursive: true, force: true }); }
});

test('prepared real-engine candidate generation carries exact revision, identical Reference, watched invalidation; build default excludes local candidate', () => {
  clean();
  const watchRoot = mkdtempSync(join(tmpdir(), 'semantic-watch-'));
  try {
    const snapshot = snapshotKey(fingerprintInputs(watchRoot));
    const watchFile = join(watchRoot, SEMANTIC_STATE);
    assert.equal(isWatchedInput(watchFile, watchRoot), true);
    writeFileSync(watchFile, '{"schema":1}');
    assert.notEqual(snapshotKey(fingerprintInputs(watchRoot)), snapshot);
    const plain = generatePreparedStudio();
    assert.equal(plain.candidateRevision, undefined);
    const saved = change(request(baseline(root)));
    const prepared = generatePreparedStudio({}, root, statePath);
    assert.equal(prepared.candidateRevision, saved.revision);
    assert.equal(prepared.artifactHashes.reference, plain.artifactHashes.reference);
    assert.notEqual(prepared.artifactHashes.candidates, plain.artifactHashes.candidates);
    const config = createStudioConfig({ semanticCandidate: { score: candidateScore(readCandidate(root,statePath)), revision: saved.revision, reviewWindows: saved.effects.reviewWindows } });
    assert.equal(prepared.artifacts.candidates, renderCandidatesView(config));
    assert.equal(prepared.artifacts.reference, renderReferenceView(config));
    assert.equal(generatePreparedStudio().artifactHashes.candidates, plain.artifactHashes.candidates);
  } finally { rmSync(watchRoot, { recursive: true, force: true }); clean(); }
});
