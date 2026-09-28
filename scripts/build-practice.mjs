#!/usr/bin/env node
/** Offline Practice-only consumer package. No studio config or public/ copying. */
import { build } from 'vite';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const out = join(root, 'build/practice-v1');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const files = {
  'contract.md': 'docs/reference/practice-view-v1.md',
  'handoff.md': 'docs/reference/practice-package-handoff.md',
  'fixtures/practice-v1.json': 'test/fixtures/practice-v1.json',
  'fonts/URWGothic-Demi.otf': 'public/fonts/URWGothic-Demi.otf',
  'notices/URW-LICENSE': 'licenses/URW-base35-LICENSE',
  'notices/URW-COPYING': 'licenses/URW-base35-COPYING',
  'notices/URW-provenance.md': 'licenses/URW-base35-provenance.md',
};
await build({ configFile: false, publicDir: false, logLevel: 'error',
  build: { outDir: out, emptyOutDir: true, minify: false, sourcemap: false,
    lib: { entry: join(root, 'src/render/janko/practice.ts'), name: 'IsoPractice',
      formats: ['iife'], fileName: () => 'iso-practice.js' } } });
for (const [dest, src] of Object.entries(files)) {
  await mkdir(resolve(out, dest, '..'), { recursive: true });
  await copyFile(join(root, src), join(out, dest));
}
const paths = ['iso-practice.js', ...Object.keys(files)].sort();
const entries = Object.fromEntries(await Promise.all(paths.map(async p => [p, hash(await readFile(join(out, p)))])));
const sources = Object.fromEntries(await Promise.all([
  'src/render/janko/practice.ts', 'src/render/janko/practice-font.ts',
  'public/fonts/URWGothic-Demi.otf', 'test/fixtures/practice-v1.json',
].map(async p => [p, hash(await readFile(join(root, p)))])));
const fixture = JSON.parse(await readFile(join(out, 'fixtures/practice-v1.json'), 'utf8'));
const buildId = hash(Buffer.from(JSON.stringify({ entries, sources })));
const manifest = { package: 'iso-practice', contractVersion: fixture.contractVersion,
  isoVersion: fixture.isoVersion, buildId: `sha256:${buildId}`,
  entrypoint: 'iso-practice.js', global: 'IsoPractice', files: entries, sources };
await writeFile(join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
const actual = (await readdir(out)).sort();
if (actual.join(',') !== ['contract.md', 'fixtures', 'fonts', 'handoff.md', 'iso-practice.js', 'manifest.json', 'notices'].sort().join(','))
  throw new Error(`Unexpected Practice output: ${actual}`);
console.log(`Practice package ${out} ${manifest.buildId}`);
