/** Contract for the official full-suite launcher; deliberately never launches the broad suite here. */
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

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
};
const launcher = (): Promise<Launcher> => import(new URL('../scripts/run-tests.mjs', import.meta.url).href);
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

test('official npm test uses the bounded full-suite launcher', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.match(pkg.scripts.test, /(?:^|\s)scripts\/run-tests\.mjs(?:\s|$)/);
  assert.doesNotMatch(pkg.scripts.test, /--test-name-pattern|--test-skip-pattern/);
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
