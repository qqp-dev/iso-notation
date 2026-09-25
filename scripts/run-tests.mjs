#!/usr/bin/env node
/** One complete, bounded Node test run. Planning helpers are importable without running tests. */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const exclusive = [
  'test/brahms-engraving.test.ts',
  'test/janko-linter.test.ts',
  'test/janko-prepared-hmr.test.ts',
  'test/semantic-hand.test.ts',
];
const ordinaryConcurrency = 2;

export function discoverTestFiles(projectRoot = root) {
  const found = [];
  function visit(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile() && entry.name.endsWith('.test.ts')) {
        found.push(relative(projectRoot, path).split('\\').join('/'));
      }
    }
  }
  visit(join(projectRoot, 'test'));
  return found.sort();
}

export function partitionTestFiles(files) {
  const ordinary = files.filter(file => !exclusive.includes(file));
  return [
    { phase: 'ordinary', files: ordinary, concurrency: ordinaryConcurrency },
    ...exclusive.map(file => ({ phase: 'exclusive', files: [file], concurrency: 1 })),
  ];
}

export function validateTestPlan(files, batches) {
  const expected = new Set(files);
  if (expected.size !== files.length) throw new Error('duplicate files in discovered suite');
  const seen = new Set();
  for (const batch of batches) {
    if (!Number.isInteger(batch.concurrency) || batch.concurrency < 1 || batch.concurrency > ordinaryConcurrency)
      throw new Error(`invalid bounded concurrency in ${batch.phase}`);
    for (const file of batch.files) {
      if (!expected.has(file)) throw new Error(`unknown file not in suite: ${file}`);
      if (seen.has(file)) throw new Error(`duplicate scheduled file: ${file}`);
      seen.add(file);
    }
    if (batch.files.some(file => exclusive.includes(file)) && (batch.files.length !== 1 || batch.concurrency !== 1))
      throw new Error(`exclusive file must run alone: ${batch.files.join(', ')}`);
  }
  for (const file of files) if (!seen.has(file)) throw new Error(`missing scheduled file: ${file}`);
}

function excerpt(value) {
  const text = String(value ?? '');
  return text.length > 16000 ? `${text.slice(0, 4000)}\n… [truncated] …\n${text.slice(-12000)}` : text;
}

export function formatChildFailure({ phase, files, elapsedMs, result }) {
  return `[npm test: ${phase}] ${files.join(', ')} failed after ${elapsedMs}ms: ` +
    `status=${result.status} signal=${result.signal ?? 'none'} ` +
    `error=${result.error ? `${result.error.code ?? result.error.name}: ${result.error.message}` : 'none'}\n` +
    `stdout:\n${excerpt(result.stdout)}\nstderr:\n${excerpt(result.stderr)}`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const files = discoverTestFiles();
  const batches = partitionTestFiles(files);
  validateTestPlan(files, batches);
  console.log(`[npm test] ${files.length} files; ordinary concurrency=${ordinaryConcurrency}; exclusive=${exclusive.join(', ')}`);
  for (const batch of batches) {
    if (!batch.files.length) continue;
    console.log(`[npm test: ${batch.phase}] ${batch.files.length} file(s), concurrency=${batch.concurrency}: ${batch.files.join(', ')}`);
    const started = Date.now();
    const result = spawnSync(process.execPath, [
      '--import', 'tsx', '--test', `--test-concurrency=${batch.concurrency}`, ...batch.files,
    ], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.error || result.signal || result.status !== 0) {
      console.error(formatChildFailure({ ...batch, elapsedMs: Date.now() - started, result }));
      process.exitCode = 1;
      break;
    }
    console.log(`[npm test: ${batch.phase}] passed in ${Date.now() - started}ms`);
  }
}
