#!/usr/bin/env node
/** Explicit bounded/full Node test plans. Planning helpers are importable without running tests. */
import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FAST_FILES, changedPaths, packageCoverage, parseRequest, releasePlan, reviewedPatterns, testDependencies, validateSelectedFiles } from './test-selection.mjs';

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
    ...exclusive.filter(file => files.includes(file)).map(file => ({ phase: 'exclusive', files: [file], concurrency: 1 })),
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


export function buildTestPlan(request, projectRoot = root) {
  const discovered = discoverTestFiles(projectRoot);
  let selected;
  if (request.mode === 'full') selected = { scope: 'full discovered suite', files: discovered, coverage: [] };
  else if (request.mode === 'fast') selected = { scope: 'focused fast contracts', files: validateSelectedFiles(FAST_FILES, discovered), coverage: [] };
  else if (request.mode === 'files') selected = { scope: 'focused explicit files', files: validateSelectedFiles(request.files, discovered), coverage: [] };
  else if (request.mode === 'release') {
    const paths = changedPaths(projectRoot, request.base, request.head);
    selected = releasePlan(paths, discovered, testDependencies(projectRoot),
      reviewedPatterns(projectRoot, request.base, request.head), packageCoverage(projectRoot, request.base, request.head, paths));
  }
  else throw new Error('unknown test profile: ' + request.mode);
  const batches = partitionTestFiles(selected.files).flatMap(batch => {
    const filtered = batch.files.filter(file => selected.patterns?.[file]);
    return [{ ...batch, files: batch.files.filter(file => !selected.patterns?.[file]) },
      ...filtered.map(file => ({ ...batch, files: [file], pattern: selected.patterns[file] }))].filter(batch => batch.files.length);
  });
  validateTestPlan(selected.files, batches);
  return { ...selected, ...(request.mode === 'release' ? { base: request.base, head: request.head } : {}), discoveredFiles: discovered.length, batches, pattern: request.pattern };
}

function capture() {
  let first = '', last = '', length = 0;
  return {
    add(value) { const s = String(value); length += s.length; first = (first + s).slice(0, 4000); last = (last + s).slice(-12000); },
    text() { return length <= 12000 ? last : length <= 16000 ? first + last.slice(-(length - first.length)) : first + '\n… [truncated] …\n' + last; },
  };
}

/** Live streams plus bounded receipts; Node remains the test executor. */
export async function runTestBatches(batches, {
  projectRoot = root, pattern, output = process.stdout, errors = process.stderr,
  progressMs = 15000,
} = {}) {
  for (const batch of batches) {
    if (!batch.files.length) continue;
    output.write('[npm test: ' + batch.phase + '] ' + batch.files.length + ' file(s), concurrency=' + batch.concurrency + ': ' + batch.files.join(', ') + '\n');
    const selectedPattern = batch.pattern ?? pattern;
    if (selectedPattern !== undefined) output.write('[npm test] representative case filter: ' + selectedPattern + '\n');
    const started = Date.now(), stdout = capture(), stderr = capture();
    const result = await new Promise(resolveResult => {
      let child, error;
      // A launcher contract can itself run under node:test. The owned child
      // is a new executor, not a test worker participating in that parent.
      const env = { ...process.env };
      delete env.NODE_TEST_CONTEXT;
      const args = ['--import', import.meta.resolve('tsx'), '--test', '--test-reporter=tap', '--test-concurrency=' + batch.concurrency,
        ...(selectedPattern === undefined ? [] : ['--test-name-pattern=' + selectedPattern]), ...batch.files];
      try { child = spawn(process.execPath, args, { cwd: projectRoot, env, stdio: ['ignore', 'pipe', 'pipe'] }); }
      catch (caught) { resolveResult({ status: null, signal: null, error: caught, stdout: '', stderr: '' }); return; }
      child.stdout.on('data', value => { stdout.add(value); output.write(value); });
      child.stderr.on('data', value => { stderr.add(value); errors.write(value); });
      child.on('error', caught => { error = caught; });
      const int = () => child.kill('SIGINT'), term = () => child.kill('SIGTERM');
      process.once('SIGINT', int); process.once('SIGTERM', term);
      const timer = setInterval(() => output.write('[npm test: ' + batch.phase + '] running ' + (Date.now() - started) + 'ms; awaiting child completion\n'), progressMs);
      child.once('close', (status, signal) => {
        clearInterval(timer); process.removeListener('SIGINT', int); process.removeListener('SIGTERM', term);
        resolveResult({ status, signal, error, stdout: stdout.text(), stderr: stderr.text() });
      });
    });
    if (selectedPattern !== undefined) {
      const plain = result.stdout.replace(/\u001b\[[0-9;]*m/g, '');
      // Node 26 reports an empty file as one passing file-level subtest;
      // that is not evidence that a requested named case was exercised.
      const names = [...plain.matchAll(/^# Subtest: (.+)$/gm)].map(match => match[1]);
      const named = names.some(name => !batch.files.some(file => name === file || name === resolve(projectRoot, file)));
      if (/(?:#|ℹ)\s+pass 0\b/.test(plain) || !named)
        result.error = new Error('explicit name pattern selected no passing cases');
    }
    if (result.error || result.signal || result.status !== 0) {
      errors.write(formatChildFailure({ ...batch, elapsedMs: Date.now() - started, result }) + '\n');
      return { ok: false, failedPhase: batch.phase, result };
    }
    output.write('[npm test: ' + batch.phase + '] passed in ' + (Date.now() - started) + 'ms\n');
  }
  return { ok: true };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const request = parseRequest(process.argv.slice(2)), plan = buildTestPlan(request);
    if (request.list) console.log(JSON.stringify(plan, null, 2));
    else {
    console.log('[npm test] ' + plan.scope + ': ' + plan.files.length + '/' + plan.discoveredFiles + ' discovered files selected; ordinary concurrency=' + ordinaryConcurrency);
    if (plan.scope !== 'full discovered suite') console.log('[npm test] Focused coverage; complete sweep is available only through npm run test:full.');
      for (const coverage of plan.coverage) console.log('[coverage] ' + coverage.path + ' -> ' + coverage.area + ': ' + (coverage.checks.join(', ') || 'documentation; no runtime change'));
      const result = await runTestBatches(plan.batches, { pattern: plan.pattern });
      if (!result.ok) process.exitCode = 1;
    }
  } catch (error) { console.error('[npm test] ' + error.message); process.exitCode = 1; }
}
