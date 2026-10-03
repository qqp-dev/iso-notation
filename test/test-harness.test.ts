/** Bounded launcher contracts; these never launch the real broad suite. */
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createHash } from 'node:crypto';

// The tiny launcher should expose pure planning/reporting functions as well as
// its executable entry point. All paths in a plan are repo-relative POSIX paths.
// This contract tests observable coverage and diagnostics, not the subprocess
// scheduling implementation or the full suite itself.
type Batch = { phase: string; files: string[]; concurrency: number };
type Launcher = {
  discoverTestFiles: (root: string) => string[];
  partitionTestFiles: (files: string[]) => Batch[];
  validateTestPlan: (files: string[], batches: Batch[]) => void;
  formatChildFailure: (context: {
    phase: string; files: string[]; elapsedMs: number;
    result: { status: number | null; signal: string | null; error?: Error; stdout: string; stderr: string };
  }) => string;
  buildTestPlan: (request: { mode: string; files?: string[] }) => { scope: string; files: string[]; batches: Batch[] };
  runTestBatches: (batches: Batch[], options: {
    projectRoot: string; pattern?: string; progressMs?: number;
    output: { write: (value: string | Buffer) => unknown }; errors: { write: (value: string | Buffer) => unknown };
  }) => Promise<{ ok: boolean; failedPhase?: string; result?: { signal: string | null; status: number | null; error?: Error } }>;
};
const launcher = (): Promise<Launcher> => import(new URL('../scripts/run-tests.mjs', import.meta.url).href);
const selection = () => import(new URL('../scripts/test-selection.mjs', import.meta.url).href);
const critical = [
  'test/brahms-engraving.test.ts',
  'test/janko-linter.test.ts',
  'test/janko-prepared-hmr.test.ts',
  'test/semantic-hand.test.ts',
];

// Independent filesystem oracle: do not ask the launcher what the complete
// suite is and then compare its plan only to its own discovery result.
function expectedSuite(root: string): string[] {
  const files: string[] = [];
  function visit(dir: string, relative: string): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const name = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) visit(join(dir, entry.name), name);
      else if (entry.isFile() && name.endsWith('.test.ts')) files.push(`test/${name}`);
    }
  }
  visit(join(root, 'test'), '');
  return files.sort();
}

test('official npm test declares bounded contracts and complete discovery requires test:full', async () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.match(pkg.scripts.test, /(?:^|\s)scripts\/run-tests\.mjs(?:\s|$)/);
  assert.doesNotMatch(pkg.scripts.test, /--test-name-pattern|--test-skip-pattern/);
  assert.match(pkg.scripts['test:full'], /run-tests\.mjs --full$/);
  assert.match(pkg.scripts['test:focused'], /run-tests\.mjs --files$/);
  const { buildTestPlan } = await launcher();
  const fast = buildTestPlan({ mode: 'fast' }), full = buildTestPlan({ mode: 'full' });
  assert.match(fast.scope, /focused/);
  assert.match(full.scope, /full discovered/);
  assert.deepEqual(full.files, expectedSuite(new URL('..', import.meta.url).pathname));
  assert.ok(fast.files.length < full.files.length);
  assert.ok(critical.every(file => !fast.files.includes(file)), 'normal feedback does not start isolated expensive history');
  assert.throws(() => buildTestPlan({ mode: 'misspelled' }), /unknown/);
});

test('test discovery is recursive, deterministic and includes exactly the committed test glob', async () => {
  const { discoverTestFiles } = await launcher();
  const root = mkdtempSync(join(tmpdir(), 'suite-discovery-'));
  try {
    for (const file of [
      'test/z.test.ts', 'test/deep/a.test.ts', 'test/a.test.ts',
      'test/deep/a.spec.ts', 'test/a.ts', 'other/hidden.test.ts',
    ]) {
      mkdirSync(join(root, file, '..'), { recursive: true });
      writeFileSync(join(root, file), '');
    }
    const expected = ['test/a.test.ts', 'test/deep/a.test.ts', 'test/z.test.ts'];
    assert.deepEqual(discoverTestFiles(root), expected);
    assert.deepEqual(discoverTestFiles(root), expected, 'a second discovery is identical');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
  const repo = new URL('..', import.meta.url).pathname;
  const discovered = discoverTestFiles(repo);
  assert.ok(discovered.includes('test/test-harness.test.ts'), 'the harness test is itself covered');
  assert.deepEqual(discovered, expectedSuite(repo), 'discovery matches an independent walk of every real test file');
  assert.deepEqual(discovered, [...new Set(discovered)]);
});

test('partition accounts for every file once and isolates the expensive files', async () => {
  const { discoverTestFiles, partitionTestFiles, validateTestPlan } = await launcher();
  const root = new URL('..', import.meta.url).pathname;
  const files = expectedSuite(root);
  assert.deepEqual(discoverTestFiles(root), files, 'the real suite is the independent coverage oracle');
  const batches = partitionTestFiles(files);
  assert.ok(Array.isArray(batches) && batches.length >= 2);
  validateTestPlan(files, batches);
  const scheduled = batches.flatMap((b: { files: string[] }) => b.files);
  assert.deepEqual(scheduled.slice().sort(), files, 'each real suite file is scheduled exactly once');
  for (const file of critical) {
    assert.ok(files.includes(file), `${file} must remain included`);
    const phase = batches.find((b: { files: string[] }) => b.files.includes(file));
    assert.deepEqual(phase?.files, [file], `${file} runs in its own nonoverlapping phase`);
    assert.equal(phase?.concurrency, 1);
  }
  for (const batch of batches) {
    assert.ok(Number.isInteger(batch.concurrency) && batch.concurrency > 0 && batch.concurrency < files.length,
      'each phase has explicit bounded file concurrency');
  }
  const first = batches.find((b: { files: string[] }) => b.files.length > 1);
  assert.ok(first, 'ordinary files share a bounded batch');
  assert.throws(() => validateTestPlan(files, [
    ...batches, { ...first, files: [first.files[0]] },
  ]), /duplicate|twice|more than once/i, 'cross-batch duplication must be detected');
  assert.throws(() => validateTestPlan(files, batches.map((b: Batch) =>
    b === first ? { ...b, files: [...b.files, b.files[0]] } : b,
  )), /duplicate|twice|more than once/i, 'intra-batch duplication must be detected');
  for (const lost of [first.files[0], critical[0]]) {
    assert.throws(() => validateTestPlan(files, batches.map((b: Batch) => ({
      ...b, files: b.files.filter((f) => f !== lost),
    }))), /missing|uncovered|not scheduled/i, `lost real file ${lost} must be detected`);
  }
  assert.throws(() => validateTestPlan(files, batches.map((b: Batch) => {
    if (b === first) return { ...b, files: b.files.filter(f => f !== first.files[0]) };
    if (b.files.includes(critical[0])) return { ...b, files: [critical[0], first.files[0]] };
    return b;
  })), /exclusive|isolat|alone|single/i, 'critical file cannot share a phase even when coverage remains intact');
  assert.throws(() => validateTestPlan(files, [
    ...batches, { ...first, files: ['test/not-in-suite.test.ts'] },
  ]), /unknown|unexpected|not.*suite|extra/i, 'invented files cannot inflate suite coverage');
});

test('failure reporting preserves phase/file and bounded child exit, signal, timeout, errors and streams', async () => {
  const { formatChildFailure } = await launcher();
  const context = { phase: 'exclusive', files: [critical[0]], elapsedMs: 1234 };
  const nonzero = formatChildFailure({ ...context,
    result: { status: 7, signal: null, error: undefined, stdout: 'stdout marker', stderr: 'stderr marker' },
  });
  for (const bit of ['exclusive', critical[0], '7', '1234', 'stdout marker', 'stderr marker']) {
    assert.ok(nonzero.includes(bit), `missing failure context: ${bit}`);
  }
  const signal = formatChildFailure({ ...context,
    result: { status: null, signal: 'SIGTERM', error: undefined, stdout: '', stderr: '' },
  });
  assert.match(signal, /SIGTERM/);
  const timeout = formatChildFailure({ ...context,
    result: { status: null, signal: 'SIGTERM', error: Object.assign(new Error('expired'), { code: 'ETIMEDOUT' }), stdout: '', stderr: '' },
  });
  assert.match(timeout, /ETIMEDOUT/);
  const overflow = formatChildFailure({ ...context,
    result: { status: null, signal: null, error: Object.assign(new Error('full'), { code: 'ENOBUFS' }), stdout: '', stderr: '' },
  });
  assert.match(overflow, /ENOBUFS/);
  const bounded = formatChildFailure({ ...context,
    result: { status: 1, signal: null, stdout: 'x'.repeat(200_000), stderr: 'y'.repeat(200_000) },
  });
  assert.ok(bounded.length < 100_000, 'diagnostics must bound large child output');
});

test('explicit requests reject missing, duplicate, unknown and incompatible selections', async () => {
  const { parseRequest, validateSelectedFiles } = await selection();
  for (const args of [['--full', '--fast'], ['--files'], ['--release'], ['--fast', '--base', 'main'],
    ['--unknown'], ['--full', '--name-pattern', 'x'], ['--files', 'test/a.test.ts', '--name-pattern', '['],
    ['--list', '--list'], ['--release', '--base', 'a', '--base', 'b', '--head', 'c']])
    assert.throws(() => parseRequest(args), JSON.stringify(args));
  assert.deepEqual(parseRequest(['--files', 'test/a.test.ts', '--name-pattern', 'owner']).files, ['test/a.test.ts']);
  for (const files of [[], ['test/missing.test.ts'], ['test/a.test.ts', 'test/a.test.ts']])
    assert.throws(() => validateSelectedFiles(files, ['test/a.test.ts']));
});

test('release coverage explains related UI, tooling, dependencies, compiler and actual score contracts', async () => {
  const { releasePlan, testDependencies, packageArea } = await selection();
  const root = new URL('..', import.meta.url).pathname, files = expectedSuite(root), graph = testDependencies(root);
  const ui = releasePlan(['src/ui/Landing.tsx'], files, graph);
  assert.equal(ui.needsScoreTools, false);
  assert.equal(ui.needsEngravingLint, false);
  assert.ok(ui.files.includes('test/janko-reference-reader.test.ts'));
  assert.ok(!ui.files.includes('test/janko-prepared-studio.test.ts'));
  const tooling = releasePlan(['scripts/run-tests.mjs'], files, graph);
  assert.ok(!tooling.files.includes('test/janko-render-performance.test.ts'));
  for (const path of ['package-lock.json', 'package.json'])
    assert.ok(releasePlan([path], files, graph).files.includes('test/janko-render-performance.test.ts'), path);
  for (const path of ['tsconfig.json', 'vite.config.ts'])
    assert.ok(releasePlan([path], files, graph).files.includes('test/janko-practice-package.test.ts'), path);
  const original = JSON.stringify({ scripts: { test: 'old', build: 'original' }, dependencies: { runtime: '1' } });
  const testOnly = JSON.stringify({ scripts: { test: 'new', 'test:full': 'explicit', build: 'original' }, dependencies: { runtime: '1' } });
  assert.equal(packageArea(original, testOnly), 'tooling');
  assert.ok(!releasePlan(['package.json'], files, graph, {}, packageArea(original, testOnly)).files.includes('test/janko-render-performance.test.ts'));
  assert.equal(packageArea(original, original.replace('"runtime":"1"', '"runtime":"2"')), 'runtime');
  assert.equal(packageArea(original, original.replace('"build":"original"', '"build":"changed"')), 'compiler');
  assert.throws(() => packageArea(original, '{bad'), /invalid/);
  for (const n of [14, 30, 43]) {
    const plan = releasePlan([`src/scores/schumann-op68-no${n}.ts`], files, graph);
    assert.ok(plan.files.includes(`test/schumann-no${n}-import.test.ts`), `No${n} import is covered`);
    if (n === 43) assert.ok(plan.files.includes('test/schumann-no43-repeat-edge.test.ts'));
    assert.ok(plan.needsScoreTools && plan.needsEngravingLint);
  }
  const mixed = releasePlan(['src/ui/Landing.tsx', 'src/model/score.ts', 'src/render/janko/engine.ts'], files, graph);
  for (const file of ['test/janko-prepared-viewer.test.ts', 'test/scores.test.ts', 'test/janko-linter.test.ts'])
    assert.ok(mixed.files.includes(file), file);
  assert.equal(mixed.coverage.length, 3);
  for (const paths of [['src/new-unmapped.ts'], ['../escape.ts'], ['test/deleted-no-consumers.test.ts']])
    assert.throws(() => releasePlan(paths, files, graph), /unmapped|invalid/);
  const docs = releasePlan(['docs/test-harness.md'], files, graph);
  assert.deepEqual(docs.coverage[0].checks, []);
});

test('new reading, projection and publication seams select their actual source and ink contracts', async () => {
  const { releasePlan } = await selection();
  const files = expectedSuite(new URL('..', import.meta.url).pathname);
  const contracts = [
    ['src/render/janko/anchor-solver.ts', 'anchors', ['test/janko-anchor-solver.test.ts']],
    ['src/render/janko/no14-relative.ts', 'reading', ['test/janko-no14-absolute.test.ts']],
    ['src/render/janko/no14-gesture-relative.ts', 'reading', ['test/janko-no14-absolute.test.ts']],
    ['src/render/janko/reading-reference.ts', 'reading', ['test/janko-no14-absolute.test.ts']],
    ['src/render/janko/no14-written.ts', 'written', ['test/schumann-no14-import.test.ts', 'test/janko-no14-written.test.ts', 'test/janko-no14-absolute.test.ts']],
    ['src/render/janko/no14-published.ts', 'publication', ['test/janko-no14-absolute.test.ts', 'test/janko-no14-gold.test.ts', 'test/janko-published-source.test.ts']],
    ['src/render/janko/no14-published-profile.json', 'publication', ['test/janko-no14-absolute.test.ts', 'test/janko-no14-gold.test.ts', 'test/janko-published-source.test.ts']],
    ['src/render/janko/no14-absolute-condensed.ts', 'publication', ['test/janko-no14-absolute.test.ts', 'test/janko-no14-gold.test.ts', 'test/janko-published-source.test.ts']],
    ['src/source-review/prepared-comparison.ts', 'comparison', ['test/janko-published-source.test.ts']],
    ['src/source-review/published-state.ts', 'comparison', ['test/janko-published-source.test.ts']],
  ] as const;
  for (const [path, area, checks] of contracts) {
    const plan = releasePlan([path], files);
    assert.equal(plan.coverage[0].area, area, path);
    for (const check of checks) assert.ok(plan.files.includes(check), `${path}: ${check}`);
    assert.ok(!plan.files.includes('test/janko-round37.test.ts'), 'new reading does not drag unrelated historical cluster rounds');
    assert.equal(plan.needsScoreTools, area === 'publication', path);
    assert.equal(plan.needsEngravingLint, !['anchors', 'comparison'].includes(area), path);
  }
});

test('release range retains renamed/deleted endpoints and refuses an unavailable or invented base', async () => {
  const { changedPaths, releasePlan } = await selection();
  const calls: string[][] = [];
  const git = (args: string[]) => {
    calls.push(args);
    if (args[0] === 'rev-parse') return 'actual-commit';
    return 'src/ui/Old.tsx\0src/ui/New.tsx\0src/scores/schumann-op68-no43.ts\0';
  };
  const paths = changedPaths('/unused', 'actual-before', 'actual-head', git);
  assert.deepEqual(paths, ['src/scores/schumann-op68-no43.ts', 'src/ui/New.tsx', 'src/ui/Old.tsx']);
  assert.deepEqual(calls[2], ['diff', '--name-only', '--no-renames', '-z', 'actual-before', 'actual-head', '--']);
  const plan = releasePlan(paths, expectedSuite(new URL('..', import.meta.url).pathname));
  assert.equal(plan.coverage.length, 3, 'deleted/renamed source paths are accounted for even when absent now');
  assert.throws(() => changedPaths('/unused', '00000', 'head', git), /requires/);
  assert.throws(() => changedPaths('/unused', 'missing', 'head', () => { throw new Error('missing'); }), /unavailable/);
  assert.throws(() => changedPaths('/unused', '-bad', 'head', git), /invalid/);
});

test('retired No14 experiment tests select their current source/ink replacement without accepting unknown deletions', async () => {
  const { releasePlan, testDependencies } = await selection();
  const root = new URL('..', import.meta.url).pathname;
  const files = expectedSuite(root);
  const retired = ['brackets', 'centered-reading', 'condensed-reading', 'gesture-relative',
    'open-reading', 'optical-reading', 'refined-reading', 'relative-baseline', 'relative']
    .map(name => `test/janko-no14-${name}.test.ts`);
  assert.ok(retired.every(path => !files.includes(path)));
  const plan = releasePlan(retired, files, testDependencies(root));
  assert.equal(plan.coverage.length, retired.length);
  assert.ok(plan.files.includes('test/janko-no14-absolute.test.ts'));
  for (const row of plan.coverage) assert.deepEqual(row.checks, ['test/janko-no14-absolute.test.ts']);
  assert.throws(() => releasePlan(['test/unknown-deleted-contract.test.ts'], files), /unmapped changed paths/);
});

test('literal helper dependencies select all transitive consumers without registering fixture-owner cases', async () => {
  const { releasePlan, testDependencies } = await selection();
  const root = new URL('..', import.meta.url).pathname, graph = testDependencies(root), files = expectedSuite(root);
  const plan = releasePlan(['test/support/round38-fixtures.ts'], files, graph);
  for (const file of ['test/janko-round38.test.ts', 'test/janko-round39.test.ts']) assert.ok(plan.files.includes(file));
  for (const dependencies of graph.values() as Iterable<string[]>)
    assert.ok(dependencies.every(path => !/janko-round(?:37|38|39|41)\.test(?:\.ts|\.js)?$/.test(path)), 'fixtures do not import registering .test modules');
  const temp = mkdtempSync(join(tmpdir(), 'fixture-dependencies-'));
  try {
    mkdirSync(join(temp, 'test/support'), { recursive: true });
    writeFileSync(join(temp, 'test/a.test.ts'), "import './support/a.js';");
    writeFileSync(join(temp, 'test/support/a.ts'), "export { value } from './b';");
    writeFileSync(join(temp, 'test/support/b.ts'), 'export const value=1;');
    assert.ok(releasePlan(['test/support/b.ts'], [...files, 'test/a.test.ts'], testDependencies(temp)).files.includes('test/a.test.ts'));
  } finally { rmSync(temp, { recursive: true, force: true }); }
});

test('reviewed one-time scope loses filtering after any later historical body, fixture or runtime change', async () => {
  const { reviewedPatterns, releasePlan } = await selection();
  const sha = (text: string) => createHash('sha256').update(text).digest('hex');
  const blobs: Record<string, string> = {
    'base:test/janko-round38.test.ts': 'original body with every case',
    'head:test/janko-round38.test.ts': 'same every case; support import',
    'head:test/support/round38-fixtures.ts': 'unchanged fixture bytes',
  };
  const fixturePaths = [37, 38, 39, 41].map(n => `test/support/round${n}-fixtures.ts`);
  const ownerPaths = [37, 38, 39, 41, 46].map(n => `test/janko-round${n}.test.ts`)
    .concat(['test/janko-layout-reuse.test.ts', 'test/janko-studio.test.ts']);
  const manifest = { schema: 1, files: [...ownerPaths, ...fixturePaths].map(path => {
    if (ownerPaths.includes(path)) blobs['base:' + path] ??= 'original cases: ' + path;
    blobs['head:' + path] ??= 'reviewed body/fixture: ' + path;
    return { path, before: ownerPaths.includes(path) ? sha(blobs['base:' + path]) : null, after: sha(blobs['head:' + path]) };
  }) };
  const git = (args: string[]) => {
    if (args[1] === 'head:scripts/test-feedback-scope.json') return JSON.stringify(manifest);
    if (!(args[1] in blobs)) throw new Error('absent');
    return blobs[args[1]];
  };
  const reviewed = reviewedPatterns('/unused', 'base', 'head', git);
  assert.ok(reviewed['test/janko-round38.test.ts']);
  const files = expectedSuite(new URL('..', import.meta.url).pathname);
  assert.ok(releasePlan(['test/janko-round38.test.ts'], files, new Map(), reviewed).patterns['test/janko-round38.test.ts']);
  for (const path of ['head:test/janko-round38.test.ts', 'head:test/support/round38-fixtures.ts']) {
    const original = blobs[path]; blobs[path] += '\nfuture change to an unselected case/fixture';
    assert.deepEqual(reviewedPatterns('/unused', 'base', 'head', git), {}, path);
    const plan = releasePlan(['test/janko-round38.test.ts'], files, new Map(), reviewedPatterns('/unused', 'base', 'head', git));
    assert.ok(plan.files.includes('test/janko-round38.test.ts'));
    assert.deepEqual(plan.patterns, {}, 'affected full file replaces one-time filter');
    blobs[path] = original;
  }
  const mixed = releasePlan(['test/janko-layout-reuse.test.ts', 'src/render/janko/engine.ts'], files, new Map(), reviewed);
  assert.ok(mixed.files.includes('test/janko-layout-reuse.test.ts'));
  assert.equal(mixed.patterns['test/janko-layout-reuse.test.ts'], undefined, 'runtime cohort wins over reviewed filter');
  const unrelatedSource = releasePlan(['test/janko-round38.test.ts', 'src/scores/schumann-no43.ts'], files, new Map(), reviewed);
  assert.equal(unrelatedSource.patterns['test/janko-round38.test.ts'], undefined, 'any product/source change disables one-time test-only scope');
  assert.ok(unrelatedSource.files.includes('test/schumann-no43-import.test.ts'));
});

test('live child output and elapsed progress arrive before completion; exclusive phases follow completion', async () => {
  const { runTestBatches } = await launcher();
  const root = mkdtempSync(join(tmpdir(), 'suite-live-'));
  let text = '', errors = '', finished = false, sawLive = false;
  try {
    mkdirSync(join(root, 'test'));
    writeFileSync(join(root, 'test/first.test.ts'), "import {test} from 'node:test'; test('first', async()=>{console.log('LIVE-FIRST');await new Promise(r=>setTimeout(r,80));});");
    writeFileSync(join(root, 'test/second.test.ts'), "import {test} from 'node:test'; test('second',()=>console.log('LIVE-SECOND'));");
    const result = await runTestBatches([
      { phase: 'ordinary', files: ['test/first.test.ts'], concurrency: 2 },
      { phase: 'exclusive', files: ['test/second.test.ts'], concurrency: 1 },
    ], { projectRoot: root, progressMs: 20,
      output: { write: value => { text += String(value); if (String(value).includes('LIVE-FIRST')) sawLive = !finished; } },
      errors: { write: value => { errors += String(value); } },
    });
    finished = true;
    assert.ok(result.ok, errors);
    assert.ok(sawLive, 'native child output is observable while the promise is pending');
    assert.match(text, /running \d+ms; awaiting child completion/);
    assert.ok(text.indexOf('ordinary] passed') < text.indexOf('LIVE-SECOND'));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('native failing/interrupted/spawn-error children fail the command and stop later phases', async () => {
  const { runTestBatches } = await launcher();
  const root = mkdtempSync(join(tmpdir(), 'suite-fail-'));
  try {
    mkdirSync(join(root, 'test'));
    writeFileSync(join(root, 'test/fail.test.ts'), "import {test} from 'node:test'; test('bad',()=>{throw new Error('REAL-FAILURE');});");
    writeFileSync(join(root, 'test/signal.test.ts'), "process.kill(process.pid,'SIGTERM');");
    writeFileSync(join(root, 'test/later.test.ts'), "throw new Error('SHOULD-NOT-RUN');");
    for (const file of ['fail', 'signal']) {
      let diagnostics = '';
      const sink = { write: (value: string | Buffer) => { diagnostics += String(value); } };
      const result = await runTestBatches([
        { phase: 'first', files: [`test/${file}.test.ts`], concurrency: 1 },
        { phase: 'later', files: ['test/later.test.ts'], concurrency: 1 },
      ], { projectRoot: root, output: sink, errors: sink });
      assert.equal(result.ok, false);
      assert.equal(result.failedPhase, 'first');
      assert.doesNotMatch(diagnostics, /SHOULD-NOT-RUN/);
      assert.match(diagnostics, file === 'fail' ? /REAL-FAILURE/ : /SIGTERM/);
      assert.match(diagnostics, /status=/);
    }
    const sink = { write: (_value: string | Buffer) => {} };
    const missing = await runTestBatches([{ phase: 'missing', files: ['test/a.test.ts'], concurrency: 1 }],
      { projectRoot: join(root, 'absent'), output: sink, errors: sink });
    assert.equal(missing.ok, false);
    assert.match(missing.result?.error?.message ?? '', /ENOENT/);
    const noMatch = await runTestBatches([{ phase: 'empty-filter', files: ['test/fail.test.ts'], concurrency: 1 }],
      { projectRoot: root, pattern: '^no-existing-case$', output: sink, errors: sink });
    assert.equal(noMatch.ok, false);
    assert.match(noMatch.result?.error?.message ?? '', /no passing cases/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
