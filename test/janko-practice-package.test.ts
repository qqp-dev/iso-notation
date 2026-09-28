import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { renderPracticeView } from '../src/render/janko/practice';

const root = resolve(import.meta.dirname, '..');
const dir = join(root, 'build/practice-v1');
const sha = (data: Buffer | string) => createHash('sha256').update(data).digest('hex');
const fixture = JSON.parse(readFileSync(join(root, 'test/fixtures/practice-v1.json'), 'utf8'));
function packageBuild() {
  const result = spawnSync(process.execPath, ['scripts/build-practice.mjs'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
  for (const [file, digest] of Object.entries<string>(manifest.files)) {
    assert.equal(sha(readFileSync(join(dir, file))), digest, file);
  }
  for (const [file, digest] of Object.entries<string>(manifest.sources)) {
    assert.equal(sha(readFileSync(join(root, file))), digest, file);
  }
  assert.equal(manifest.buildId, `sha256:${sha(JSON.stringify({ entries: manifest.files, sources: manifest.sources }))}`);
  return manifest;
}

test('actual offline IIFE package: deterministic build, complete local materials and source-equivalent output', () => {
  assert.ok(!existsSync(join(root, 'dist/practice-v1')), 'personal bundle must not enter Pages dist');
  const first = packageBuild();
  const firstManifest = readFileSync(join(dir, 'manifest.json'));
  const second = packageBuild();
  assert.deepEqual(first, second);
  assert.deepEqual(readFileSync(join(dir, 'manifest.json')), firstManifest);
  assert.deepEqual(readdirSync(dir).sort(), ['contract.md', 'fixtures', 'fonts', 'handoff.md', 'iso-practice.js', 'manifest.json', 'notices'].sort());
  assert.deepEqual(Object.keys(second.files).sort(), [
    'contract.md', 'fixtures/practice-v1.json', 'fonts/URWGothic-Demi.otf', 'handoff.md',
    'iso-practice.js', 'notices/URW-COPYING', 'notices/URW-LICENSE', 'notices/URW-provenance.md',
  ].sort());
  assert.deepEqual(readFileSync(join(dir, 'fixtures/practice-v1.json')), readFileSync(join(root, 'test/fixtures/practice-v1.json')));
  assert.match(second.intendedUse, /personal\/offline/);
  assert.match(second.externalRedistribution, /not cleared/);
  assert.equal(second.contractVersion, fixture.contractVersion);
  assert.equal(second.isoVersion, fixture.isoVersion);
  assert.equal(second.files['fonts/URWGothic-Demi.otf'], '5b009410cf5231dcb1e45b155c1afedcfc63d82042fd8c414d0dd7705c9fbbae');
  const js = readFileSync(join(dir, second.entrypoint), 'utf8');
  assert.doesNotMatch(js, /\b(?:require\s*\(|import\s*\(|fetch\s*\()/);
  const context: Record<string, any> = {};
  runInNewContext(js, context, { timeout: 15000 });
  assert.deepEqual(Object.keys(context).sort(), [second.global]);
  const api = context[second.global];
  assert.equal(api.PRACTICE_CONTRACT_VERSION, fixture.contractVersion);
  assert.equal(api.ISO_PRACTICE_VERSION, fixture.isoVersion);
  for (const entry of fixture.cases) {
    const actual = api.renderPracticeView(entry.request);
    assert.deepEqual(JSON.parse(JSON.stringify(actual)), renderPracticeView(entry.request));
    assert.equal(actual.selectionId, entry.selectionId);
    assert.deepEqual(Array.from(actual.attacks, (attack: any) => attack.pitchLinear), entry.pitchesLinear);
    assert.equal(actual.attacks.map((a: any) => a.hands.RH.finger).join(''), entry.rightFingers);
    assert.equal(actual.attacks.map((a: any) => a.hands.LH.finger).join(''), entry.leftFingers);
    assert.equal(actual.attacks.map((a: any) => a.hands.RH.row).join(''), entry.physicalRows);
    assert.equal(actual.guide, entry.guide ?? entry.request.guide ?? 'two-guides');
    assert.equal(actual.systemCount, entry.systemCount);
    assert.match(actual.svg, /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
    assert.equal((actual.svg.match(/stroke="#384455" stroke-width="0.55"/g) ?? []).length, actual.guide === 'two-guides' ? 4 : 0);
    const font = actual.svg.match(/data:font\/otf;base64,([^)]*)\) format/);
    assert.ok(font);
    assert.equal(sha(Buffer.from(font[1], 'base64')), second.files['fonts/URWGothic-Demi.otf']);
  }
  for (const input of fixture.invalidRequests) {
    assert.throws(() => api.renderPracticeView(input), (error: any) => error.name === fixture.invalidError);
  }
});
