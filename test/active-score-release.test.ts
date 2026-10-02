import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, openSync, closeSync, cpSync, mkdirSync, symlinkSync, chmodSync, existsSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initialActiveData, resolveActiveScore, type ActiveData } from '../src/scores/active';
import { baseline, executeHandCommand } from '../src/render/janko/semantic-hand';
import type { DurationIntent } from '../src/render/janko/duration-rig';
import { prepareCanonicalChange, executeCanonicalCommand, validateCanonicalTransition, type CanonicalHandIntent } from '../src/render/janko/active-transaction';
import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1';
import { renderJankoPage, countJankoPages } from '../src/render/janko/engine';
import { DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS } from '../src/render/janko/types';
import { DEFAULT_JANKO_OPTIONS as PRE_CLARITY_OPTIONS, DEFAULT_JANKO_TOKENS as PRE_CLARITY_TOKENS } from './pre-clarity-rules';
import { fetchVerifiedRelease, watchDeployedRelease, type DeployedRelease } from '../src/render/janko/prepared/deployed';
import { buildIdentity } from '../src/render/janko/prepared/seam';
import { fingerprintPdf } from './support/pdf-fingerprint';

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const sha = (x: string | Uint8Array) => createHash('sha256').update(x).digest('hex');
const bach = 'bach-goldberg-var1' as const;
function intent(data: ActiveData): CanonicalHandIntent {
  const note = resolveActiveScore(bach, data).score.notes.find(n => n.hand === 'LH' && n.id !== 'bach-var1-282')!;
  return { schema: 1, intent: 'assign-hand', score: bach, base: data.scores[bach].revision,
    target: 'RH', scope: 'this', selected: [{ id: note.id, tick: note.startTick,
      pitchClass: note.pitch.pitchClass, octave: note.pitch.octave, expectedHand: note.hand }] };
}

// Immutable PR114 source-commit witness, measured from the git-object engine at
// 8fd1e4f3b071fec30496164754c1bce0ab4bfc06 in an isolated archive. Not
// calculated from the new resolver or copied from the current expected output.
// Guard the independently delivered PR114 git-object PDF bytes, then compare
// semantic fingerprints: pdfunite regenerates random /ID bytes without any
// changed geometry, fonts, text, page count/size or raster content.
test('PR114 immutable source/hand witness and explicit pre-clarity engraving remain reproducible', () => {
  const builder = buildBachGoldbergVar1Score();
  assert.equal(builder.notes.length, 551);
  assert.equal(sha(JSON.stringify(builder.notes.map(({ hand, ...note }) => note))),
    'd0d6479399ec8b317c0dc081f95d84f66d2f2aff5614107ebef8bfffed84a965');
  assert.equal(sha(JSON.stringify(builder.notes.map(note => [note.id, note.hand]))),
    '52fd507f7f356eeb329d7495e0db6aed0d329cef0b9a45b570ca07a66f80b0de');
  assert.equal(builder.notes.filter(note => note.hand === 'RH').length, 297);
  // PR114's sixteen approved changes, relative to the independent PR112
  // witness; the all-551 hand digest above also guards the other 535.
  const approved: Record<string, 'RH' | 'LH'> = {
    'bach-var1-68': 'RH', 'bach-var1-69': 'LH',
    'bach-var1-348': 'LH', 'bach-var1-349': 'LH', 'bach-var1-350': 'LH', 'bach-var1-351': 'LH',
    'bach-var1-354': 'LH', 'bach-var1-355': 'LH',
    'bach-var1-360': 'RH', 'bach-var1-361': 'RH',
    'bach-var1-366': 'LH', 'bach-var1-367': 'LH',
    'bach-var1-372': 'RH', 'bach-var1-373': 'RH',
    'bach-var1-408': 'RH', 'bach-var1-409': 'LH',
  };
  for (const [id, hand] of Object.entries(approved))
    assert.equal(builder.notes.find(note => note.id === id)?.hand, hand, id);
  assert.equal(builder.notes.filter(note => note.id === 'bach-var1-282').length, 1);
  const a = builder.notes.find(note => note.id === 'bach-var1-550')!;
  const b = builder.notes.find(note => note.id === 'bach-var1-551')!;
  assert.deepEqual([a.startTick, a.pitch], [b.startTick, b.pitch]);
  assert.notEqual(a.hand, b.hand);
  const active = resolveActiveScore(bach);
  const pages = Array.from({ length: 2 }, (_, page) => renderJankoPage(builder, page, PRE_CLARITY_OPTIONS, PRE_CLARITY_TOKENS));
  assert.equal(sha(pages[0]), '01a555eb2cc892d30f32905b01bfc3a4550ae68562ffd49584f03c1fdb1c55a6');
  assert.equal(sha(pages[1]), '47c7f22994296b6fd4968a2e806f87e6a75ae7eeec0428e5f6a09daff3a908f4');
  assert.equal(sha(pages.join('\n')), '78cf5cac97b63387a74f9230d205f9ed083c20d57aad9a4ecdb50df3a073c250',
    'approved PR114 real-engine SVG source for the two-page PDF');
  if (active.revision === 'pr114-8fd1e4f3b071fec30496164754c1bce0ab4bfc06') {
    assert.deepEqual(active.score.notes, builder.notes, 'initial active revision must remain PR114');
    assert.deepEqual(active.score.handCrossings, builder.handCrossings);
    const witness = execFileSync('git', ['show', '8fd1e4f3b071fec30496164754c1bce0ab4bfc06:public/goldberg-variation-1.pdf']);
    assert.equal(sha(witness),'b039d2c188adb02d67fa1b220631dfe13bcf092688ef493b642b8c4b631fbf65',
      'independently delivered PR114 witness stays immutable');
    const dir = mkdtempSync(join(tmpdir(),'pr114-pdf-witness-'));
    try {
      const original = join(dir,'original.pdf'); writeFileSync(original,witness);
      assert.notDeepEqual(fingerprintPdf('public/goldberg-variation-1.pdf'),fingerprintPdf(original),
        'approved shared clarity changes painted geometry, not PR114 source/hand identity; current semantic freshness is gated by janko-pdf.test.ts');
    } finally { rmSync(dir,{recursive:true,force:true}); }
  }
  assert.equal(countJankoPages(builder, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS), 2);
  assert.throws(() => resolveActiveScore('unsupported-score'), /unknown canonical score/);
});

test('guarded canonical change isolates scores, refuses semantic extras and stale or false guards without modifying input', () => {
  const old = clone(initialActiveData), command = intent(old);
  const result = prepareCanonicalChange(old, command);
  assert.equal(result.replay, false);
  assert.deepEqual(old, initialActiveData);
  assert.deepEqual(result.data.scores['brahms-op118-no1'], old.scores['brahms-op118-no1']);
  assert.equal(resolveActiveScore(bach, result.data).score.notes.find(n => n.id === command.selected[0].id)?.hand, 'RH');
  assert.throws(() => prepareCanonicalChange(result.data, command), /stale canonical parent/);
  assert.equal(prepareCanonicalChange(old, { ...command, target: command.selected[0].expectedHand }).replay, true,
    'a guarded same-hand request does not manufacture a new revision');
  assert.throws(() => prepareCanonicalChange(old, { ...command, selected: [{ ...command.selected[0], tick: -1 }] }), /guard mismatch/);
  const unrelated = clone(result.data);
  unrelated.scores['brahms-op118-no1'].revision = 'tampered';
  assert.throws(() => validateCanonicalTransition(old, unrelated, bach), /unrelated score/);
  const extra = clone(result.data) as ActiveData & { injected?: boolean };
  extra.injected = true;
  assert.throws(() => validateCanonicalTransition(old, extra, bach), /unsupported canonical data field/);
  const bad = clone(result.data);
  bad.scores[bach].assignments[0].tick = -1;
  assert.throws(() => validateCanonicalTransition(old, bad, bach), /fingerprint mismatch|guard mismatch/);
});

test('isolated local writer locks, appends undo as a new revision, retries exactly once and refuses wrong-engine history', () => {
  const dir = mkdtempSync(join(tmpdir(), 'canonical-owner-'));
  const dataFile = 'active.json', historyFile = 'history.json';
  const path = join(dir, dataFile), archive = join(dir, historyFile);
  try {
    writeFileSync(path, JSON.stringify(initialActiveData));
    const command = intent(initialActiveData);
    const lock = openSync(`${path}.lock`, 'wx');
    try { assert.throws(() => executeCanonicalCommand('change', bach, command, dir, dataFile, historyFile), /busy/); }
    finally { closeSync(lock); rmSync(`${path}.lock`); }
    const first = executeCanonicalCommand('change', bach, command, dir, dataFile, historyFile);
    assert.equal(first.replay, false);
    assert.equal(executeCanonicalCommand('change', bach, command, dir, dataFile, historyFile).replay, true);
    assert.equal(JSON.parse(readFileSync(archive, 'utf8')).records.length, 1);
    assert.throws(() => executeCanonicalCommand('change', 'brahms-op118-no1', command, dir, dataFile, historyFile), /cross-score/);
    assert.throws(() => executeCanonicalCommand('undo', bach, { base: 'wrong', revision: first.revision }, dir, dataFile, historyFile), /stale/);
    const undo = executeCanonicalCommand('undo', bach, { base: first.revision, revision: first.revision }, dir, dataFile, historyFile);
    assert.notEqual(undo.revision, command.base);
    assert.deepEqual(resolveActiveScore(bach, JSON.parse(readFileSync(path, 'utf8'))).score.notes, buildBachGoldbergVar1Score().notes);
    const before = readFileSync(path, 'utf8');
    const history = JSON.parse(readFileSync(archive, 'utf8'));
    history.records.at(-1).engineIdentity = 'wrong-engine';
    writeFileSync(archive, JSON.stringify(history));
    assert.throws(() => executeCanonicalCommand('change', bach, { ...command, base: undo.revision }, dir, dataFile, historyFile), /engine identity mismatch/);
    assert.equal(readFileSync(path, 'utf8'), before, 'refused writer never changes active data');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// This repository is a disposable, local-only Git fixture. The classifier is
// run as shipped (including the real engine and PDF export), never against
// origin, the parked checkout, or the operator's GOLD revision.
test('trusted release gate accepts immediate edit undo but refuses forged older-state undo', () => {
  const dir = mkdtempSync(join(tmpdir(), 'janko-release-git-'));
  const source = process.cwd();
  const git = (...args: string[]) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim();
  const dataPath = join(dir, 'src/scores/data/active-scores.json');
  const metaPath = join(dir, 'data/active-release.json');
  const pdfPath = join(dir, 'public/goldberg-variation-1.pdf');
  const run = (script: string, ...args: string[]) => {
    const result = spawnSync(process.execPath, ['--import', 'tsx', script, ...args], { cwd: dir, encoding: 'utf8', timeout: 120_000 });
    assert.equal(result.error, undefined, String(result.error));
    return result;
  };
  try {
    for (const name of ['src', 'scripts', 'public', 'data']) cpSync(join(source, name), join(dir, name), { recursive: true });
    for (const name of ['package.json', 'package-lock.json', 'vite.config.ts', 'tsconfig.json', 'janko.html', 'index.html'])
      cpSync(join(source, name), join(dir, name));
    mkdirSync(join(dir, '.github/workflows'), { recursive: true });
    cpSync(join(source, '.github/workflows/deploy.yml'), join(dir, '.github/workflows/deploy.yml'));
    symlinkSync(join(source, 'node_modules'), join(dir, 'node_modules'), 'dir');
    git('init', '-q', '-b', 'main');
    git('config', 'user.email', 'owner@example.invalid');
    git('config', 'user.name', 'Isolated test owner');
    git('add', '--', 'src', 'scripts', 'public', 'data', 'package.json', 'package-lock.json', 'vite.config.ts', 'tsconfig.json', 'janko.html', 'index.html', '.github');
    git('commit', '-qm', 'reviewed software baseline');
    let data = clone(initialActiveData);
    const original = clone(data);
    const pdfSource = (active: ActiveData) => {
      const resolved = resolveActiveScore(bach, active);
      return Array.from({ length: countJankoPages(resolved.score, resolved.options, resolved.tokens) }, (_, page) =>
        renderJankoPage(resolved.score, page, resolved.options, resolved.tokens)).join('\n');
    };
    const publish = (next: ActiveData, operation: 'change' | 'undo', request: unknown, undoTargetRevision?: string) => {
      const score = bach;
      writeFileSync(dataPath, JSON.stringify(next, null, 2) + '\n');
      assert.equal(run('scripts/export-pdf.ts', '--out', pdfPath).status, 0, 'real PDF export succeeds in isolated fixture');
      writeFileSync(metaPath, JSON.stringify({ schema: 1, score, parent: data.scores[score].revision,
        revision: next.scores[score].revision, operation, request,
        ...(undoTargetRevision ? { undoTargetRevision } : {}),
        pdfSha256: sha(readFileSync(pdfPath)), engineIdentity: buildIdentity(dir), sourceHash: sha(pdfSource(next)) }, null, 2));
      git('add', '--', 'src/scores/data/active-scores.json', 'public/goldberg-variation-1.pdf', 'data/active-release.json');
      git('commit', '-qm', `${operation} ${next.scores[score].revision.slice(0, 12)}`);
      const verdict = run('scripts/verify-data-release.ts');
      data = next;
      return verdict;
    };
    const firstRequest = intent(data);
    const first = prepareCanonicalChange(data, firstRequest).data;
    const acceptedFirst = publish(first, 'change', firstRequest);
    assert.equal(acceptedFirst.status, 0, `first guarded edit must qualify as data-only release: ${acceptedFirst.stderr}`);
    const secondRequest = intent(data);
    const second = prepareCanonicalChange(data, secondRequest).data;
    const acceptedSecond = publish(second, 'change', secondRequest);
    assert.equal(acceptedSecond.status, 0, `second guarded edit must qualify as data-only release: ${acceptedSecond.stderr}`);
    const secondCommit = git('rev-parse', 'HEAD');
    git('checkout', '-q', '-b', 'forged');
    const forged = clone(second);
    forged.scores[bach] = { ...clone(original.scores[bach]), parent: second.scores[bach].revision, revision: '' };
    const forgedState = forged.scores[bach];
    forgedState.revision = sha(JSON.stringify({ score: bach, parent: forgedState.parent,
      assignments: forgedState.assignments, duration: forgedState.duration }));
    const refused = publish(forged, 'undo', { base: second.scores[bach].revision, revision: second.scores[bach].revision }, original.scores[bach].revision);
    assert.notEqual(refused.status, 0, 'an arbitrary earlier state is not the preceding approved EDIT state');
    assert.match(refused.stderr, /undo|previous|provenance|release refused/i);
    git('checkout', '-q', 'main');
    assert.equal(git('rev-parse', 'HEAD'), secondCommit);
    data = second;
    const immediate = clone(second);
    immediate.scores[bach] = { ...clone(first.scores[bach]), parent: second.scores[bach].revision, revision: '' };
    // The revision is independently computed using the same documented revision formula,
    // not copied from the earlier state: undo always appends a new identity.
    const state = immediate.scores[bach];
    state.revision = sha(JSON.stringify({ score: bach, parent: state.parent, assignments: state.assignments, duration: state.duration }));
    assert.notEqual(state.revision, first.scores[bach].revision);
    const undoRequest = { base: second.scores[bach].revision, revision: second.scores[bach].revision };
    const acceptedUndo = publish(immediate, 'undo', undoRequest, first.scores[bach].revision);
    assert.equal(acceptedUndo.status, 0, `authenticated immediate undo appends a new release revision: ${acceptedUndo.stderr}`);

    // Publisher failure is exercised against a local bare remote with a
    // rejecting hook. No origin, Pages URL, protected checkout or public GOLD
    // score is mutated. The remote's last deployed score/PDF remain a pair.
    const remote = join(dir, 'isolated-remote.git');
    execFileSync('git', ['init', '--bare', '-q', remote], { cwd: dir });
    git('remote', 'add', 'origin', remote);
    git('push', '-q', 'origin', 'HEAD:main');
    const deployedHead = git('rev-parse', 'HEAD');
    const deployedPdfSha = sha(readFileSync(pdfPath));
    const hook = join(remote, 'hooks/pre-receive');
    writeFileSync(hook, '#!/bin/sh\nexit 1\n');
    chmodSync(hook, 0o755);
    const pending = executeCanonicalCommand('change', bach, intent(data), dir);
    assert.equal(pending.publication, 'pending');
    const failed = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/publish-active.ts'], {
      cwd: dir, encoding: 'utf8', timeout: 120_000, env: { ...process.env, JANKO_DEPLOY_CHECKOUT: dir },
    });
    assert.equal(failed.error, undefined, String(failed.error));
    assert.notEqual(failed.status, 0, 'rejected local push must fail publication');
    assert.equal(git('ls-remote', 'origin', 'refs/heads/main').split(/\s+/)[0], deployedHead);
    assert.equal(sha(execFileSync('git', ['show', `${deployedHead}:public/goldberg-variation-1.pdf`], { cwd: dir })),
      deployedPdfSha, 'deployed PDF remains paired with the old deployed score');
    assert.equal(JSON.parse(git('show', `${deployedHead}:src/scores/data/active-scores.json`)).scores[bach].revision,
      immediate.scores[bach].revision, 'the old deployed score remains visible on push failure');
    const local = JSON.parse(readFileSync(join(dir, '.canonical-publication.local'), 'utf8'));
    assert.equal(local.scores[bach].revision, pending.revision);
    assert.equal(local.scores[bach].state, 'failed');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// Run the real migration against two entirely disposable checkouts. The old
// checkout's authenticated eight-record chain is generated by the guarded
// writer, never copied from private operator history or the protected studio.
// The old SVGs are rendered by that checkout's real engine during migration.
test('legacy full-score migration classifies harmless SVG serialization separately from changed ink', () => {
  const dir = mkdtempSync(join(tmpdir(), 'janko-legacy-parity-'));
  const oldRoot = join(dir, 'original');
  const source = process.cwd();
  const git = (...args: string[]) => execFileSync('git', args, { cwd: oldRoot, encoding: 'utf8' }).trim();
  const copyEngine = (dest: string) => {
    for (const name of ['src', 'scripts', 'data', 'public']) cpSync(join(source, name), join(dest, name), { recursive: true });
    for (const name of ['package.json', 'package-lock.json', 'tsconfig.json']) cpSync(join(source, name), join(dest, name));
    symlinkSync(join(source, 'node_modules'), join(dest, 'node_modules'), 'dir');
    // Observe only this disposable engine. The original renderer still owns
    // its verifier, layout and every SVG; no current-engine proof substitutes.
    const path = join(dest, 'src/render/janko/engine.ts');
    const observerAnchor = '  layoutJankoScoreObserver?.(score, o, t);';
    const engine = readFileSync(path, 'utf8');
    assert.ok(engine.includes(observerAnchor));
    writeFileSync(path, "import { appendFileSync as recordFixtureSolve } from 'node:fs';\n" + engine.replace(observerAnchor,
      `${observerAnchor}\n  if (new Error().stack?.includes('at pages ')) recordFixtureSolve(${JSON.stringify(join(dest, 'page-solves.jsonl'))}, JSON.stringify({score:score.id,options:o,tokens:t})+'\\n');`));
  };
  const enginePath = (dest: string) => join(dest, 'src/render/janko/engine.ts');
  const serializationAnchor = "    renderPageFooter(geo, pageIndex, totalPages),\n    '</svg>',";
  try {
    mkdirSync(oldRoot);
    copyEngine(oldRoot);
    git('init', '-q', '-b', 'main');
    git('config', 'user.email', 'parity@example.invalid');
    git('config', 'user.name', 'Parity fixture');
    git('add', '--', 'src', 'scripts', 'data', 'public', 'package.json', 'package-lock.json', 'tsconfig.json');
    git('commit', '-qm', 'isolated original real engine');
    const score = 'brahms-op118-no1' as const;
    let revision = baseline(oldRoot, score);
    for (let i = 0; i < 8; i++) {
      const request: DurationIntent = { schema: 1, intent: 'engrave-duration', score,
        base: revision, variantId: `private-${i % 4}`, tokens: { halfRingGap: 0.15 + 0.01 * i },
        windows: [{ measureStart: 1, measureCount: 2 }] };
      revision = executeHandCommand({ action: 'change', request }, oldRoot, undefined, undefined, score).revision;
    }
    const oldBytes = readFileSync(join(oldRoot, '.semantic-candidate.local'));
    for (const [label, replacement, accepts] of [
      ['serialization', "    renderPageFooter(geo, pageIndex, totalPages),\n    '<!-- serialization-only marker -->',\n    '</svg>',", true],
      ['ink', "    renderPageFooter(geo, pageIndex, totalPages),\n    '<rect x=\"1\" y=\"1\" width=\"2\" height=\"2\" fill=\"#000000\"/>',\n    '</svg>',", false],
    ] as const) {
      const dest = join(dir, label);
      mkdirSync(dest);
      copyEngine(dest);
      const engine = readFileSync(enginePath(dest), 'utf8');
      assert.ok(engine.includes(serializationAnchor), 'fixture changes only real page SVG serialization');
      writeFileSync(enginePath(dest), engine.replace(serializationAnchor, replacement));
      // Shared-host gate measurements hit the old 180s child cap (also in a
      // selected-file run); allow 300s without changing any parity assertions.
      const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/migrate-legacy-candidates.ts', '--old-root', oldRoot],
        { cwd: dest, encoding: 'utf8', timeout: 300_000, env: { ...process.env, JANKO_DEPLOY_CHECKOUT: dest } });
      assert.equal(result.error, undefined, String(result.error));
      const solveOwners = (root: string) => readFileSync(join(root, 'page-solves.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line));
      const originalSolves = solveOwners(oldRoot), destinationSolves = solveOwners(dest);
      assert.equal(originalSolves.length, 5, 'original engine settles canonical and four independently controlled profiles once each');
      assert.equal(new Set(originalSolves.map(row => JSON.stringify(row.tokens))).size, 5, 'different original token owners never share settlement');
      assert.equal(destinationSolves.length, accepts ? 5 : 1, 'new engine settles only its own admitted profiles, once each');
      rmSync(join(oldRoot, 'page-solves.jsonl'));
      if (accepts) {
        assert.equal(result.status, 0, `serialization-only difference is not changed music/ink: ${result.stderr}`);
        const migration = JSON.parse(result.stdout);
        assert.deepEqual(migration.variants, ['private-0', 'private-1', 'private-2', 'private-3']);
        assert.deepEqual(readFileSync(join(migration.archive, 'original-history.json')), oldBytes);
        assert.equal(migration.migratedRecords, 4);
        assert.ok(existsSync(join(dest, '.semantic-candidate.local')));
      } else {
        assert.notEqual(result.status, 0, 'real added ink must stop live migration');
        assert.match(result.stderr, /geometry|ink|difference|parity/i);
        assert.equal(existsSync(join(dest, '.semantic-candidate.local')), false,
          'rejected geometry cannot install new active candidate history');
      }
    }
    assert.deepEqual(readFileSync(join(oldRoot, '.semantic-candidate.local')), oldBytes,
      'migration never modifies the protected original bytes');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// A fake transport exercises the real static Pages verification seam without a browser, server or protected live port.
test('static release fetch verifies all four assets and both score revisions before exposing a bundle', async () => {
  const url = 'https://example.test/iso-notation/active-release.json';
  const data = JSON.stringify(initialActiveData), pdf = '%PDF-1.7\n', candidates = '<section data-view="candidates"></section>', reference = '<section data-view="reference"></section>';
  const assets = [data, pdf, candidates, reference];
  const makeAsset = (body: string, ext: string) => ({ url: `janko-release/${sha(body)}.${ext}`, sha256: sha(body) });
  const manifest: DeployedRelease = { schema: 1, generation: sha('release-1'), engineIdentity: sha('engine'),
    canonicalRevisions: { [bach]: initialActiveData.scores[bach].revision, 'brahms-op118-no1': initialActiveData.scores['brahms-op118-no1'].revision },
    status: { ok: true, violations: 0, warnings: 0, systems: 1, notes: 1, lintMs: 0 },
    data: makeAsset(data, 'json'), pdf: makeAsset(pdf, 'pdf'),
    artifacts: { candidates: makeAsset(candidates, 'html'), reference: makeAsset(reference, 'html') } };
  const assetUrls = [manifest.data, manifest.pdf, manifest.artifacts.candidates, manifest.artifacts.reference].map(a => new URL(a.url, url).href);
  function transport(overrides: Partial<Record<string, string>> = {}, missing = ''): typeof fetch {
    return (async (requestUrl: string) => {
      if (requestUrl === url) return new Response(JSON.stringify(manifest), { status: 200 });
      if (requestUrl === missing) return new Response('missing', { status: 404 });
      const i = assetUrls.indexOf(requestUrl);
      return new Response(overrides[requestUrl] ?? assets[i], { status: i < 0 ? 404 : 200 });
    }) as typeof fetch;
  }
  const first = await fetchVerifiedRelease(url, transport());
  const reopened = await fetchVerifiedRelease(url, transport());
  assert.equal(first.manifest.generation, reopened.manifest.generation);
  assert.deepEqual(JSON.parse(first.data), initialActiveData);
  assert.equal(first.pdfUrl, assetUrls[1]);
  for (const i of [0, 1, 2, 3]) {
    await assert.rejects(fetchVerifiedRelease(url, transport({ [assetUrls[i]]: 'stale-or-torn' })), /hash mismatch/);
    await assert.rejects(fetchVerifiedRelease(url, transport({}, assetUrls[i])), /release asset 404/);
  }
  const foreignData = JSON.stringify({ ...initialActiveData, scores: { ...initialActiveData.scores,
    [bach]: { ...initialActiveData.scores[bach], revision: 'different-but-hashed' } } });
  const validHashWrongRevision = { ...manifest, data: makeAsset(foreignData, 'json') };
  await assert.rejects(fetchVerifiedRelease(url, (async (requested: string) => {
    if (requested === url) return new Response(JSON.stringify(validHashWrongRevision));
    if (requested === new URL(validHashWrongRevision.data.url, url).href) return new Response(foreignData);
    const i = assetUrls.indexOf(requested);
    return new Response(assets[i], { status: i < 0 ? 404 : 200 });
  }) as typeof fetch), /release score mismatch/);
  assert.equal(first.manifest.generation, sha('release-1'), 'previously verified release remains intact after failures');

  // The actual already-open poller applies a release only after all assets
  // verify. Simulate a subsequent Pages edge serving a torn PDF.
  let current = first, stale = 0, requests = 0;
  const pollTransport = (async (requested: string) => {
    if (requested === url) {
      requests++;
      return new Response(JSON.stringify({ ...manifest, generation: sha(`release-${requests}`) }));
    }
    const i = assetUrls.indexOf(requested);
    return new Response(requests > 1 && i === 1 ? 'wrong PDF' : assets[i], { status: i < 0 ? 404 : 200 });
  }) as typeof fetch;
  const stop = watchDeployedRelease(url, release => { current = release; }, () => { stale++; }, manifest.engineIdentity, pollTransport);
  try {
    await new Promise(resolve => setTimeout(resolve, 5300));
    assert.ok(requests >= 2, 'already-open tab revalidates the manifest');
    assert.ok(stale > 0, 'PDF mismatch is reported stale');
    assert.equal(current.manifest.generation, sha('release-1'), 'failed newer release cannot replace last-good Play/Sheet/PDF bundle');
  } finally { stop(); }

  let wrongEngineApplied = false, wrongEngineStale = '';
  const incompatible = watchDeployedRelease(url, () => { wrongEngineApplied = true; },
    error => { wrongEngineStale = error.message; }, sha('older-bundle'), transport());
  try {
    await new Promise(resolve => setTimeout(resolve, 50));
    assert.equal(wrongEngineApplied, false, 'an already-open older JS engine must not project newer score data');
    assert.match(wrongEngineStale, /engine bundle changed/);
  } finally { incompatible(); }
});
