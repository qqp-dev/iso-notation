import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (name: string) => readFileSync(name, 'utf8');

test('public Landing exposes Bach Play, Sheet and Guide without either MIDI import route', () => {
  const landing = read('src/ui/Landing.tsx');
  const html = read('index.html');
  for (const label of ['Play', 'Sheet', 'Guide', 'goldberg-variation-1.pdf', 'home-score-picker']) assert.ok(landing.includes(label), label);
  assert.doesNotMatch(landing, /Upload MIDI|type="file"|accept="\.mid|parseMidiToScore|FileReader|processMidiFile|isDraggingFile|Drop a \.mid file|addEventListener\(['"](?:dragover|dragleave|drop)['"]|onDrop=|onDragOver=/);
  assert.doesNotMatch(html, /\bupload(?:ing)?\b|drag.{0,30}drop.{0,30}midi/i);
});

test('public Guide removes only the dark section 07; Reading pitch cards and other guide sections remain', () => {
  const guide = read('src/ui/PlayersGuide.tsx');
  assert.doesNotMatch(guide, /07\s*·\s*REFERENCE|<Section index="07"|title="Syllables"/);
  assert.match(guide, /<Section index="02" title="Reading pitch">/);
  assert.match(guide, /DUODECIMAL_SOLFEGE\[pc\]\.syllable/);
  assert.match(guide, /<Section index="03" title="Reading rhythm">/);
});

test('root Play/Sheet and PDF consume one verified active release; Pages declares selected software gates', () => {
  const root = read('src/ui/Landing.tsx');
  const sheet = read('src/ui/JankoPages.tsx');
  const viewer = read('src/render/janko/prepared/viewer.ts');
  const workflow = read('.github/workflows/deploy.yml');
  assert.match(root, /watchDeployedRelease\(/);
  assert.match(root, /resolveActiveScore\(BACH_ID, parsed\)/);
  assert.match(root, /readHomeSheets\(release\.reference, release\.manifest\.canonicalRevisions\)/);
  assert.match(root, /verifiedNo14Pdf\(base, next\['schumann-op68-no14-gold'\]\)/);
  assert.match(root, /setActiveData\(parsed\)/);
  assert.match(root, /next\[BACH_ID\]\.pdfUrl = release\.pdfUrl/);
  assert.match(root, /setSheets\(next\)/);
  assert.doesNotMatch(root, /useJankoPages\(/);
  assert.match(sheet, /resolveActiveScore\(/);
  assert.match(viewer, /watchDeployedRelease\(/);
  assert.match(workflow, /npm run test:release/);
  assert.match(workflow, /TEST_BASE: \$\{\{ github\.event\.before \|\| inputs\.base \}\}/);
  assert.match(workflow, /TEST_HEAD: \$\{\{ github\.sha \}\}/);
  assert.doesNotMatch(workflow, /run: npm test\b/);
  assert.match(workflow, /npm run build/);
  assert.match(workflow, /verify-data-release/);
});

test('Pages provisions the actual LilyPond compiler when selected source checks require it', () => {
  const workflow = read('.github/workflows/deploy.yml');
  const install = workflow.indexOf('Install system dependencies');
  const testStep = workflow.indexOf('Run selected release checks');
  assert.ok(install >= 0 && testStep > install, 'compiler setup precedes tests');
  assert.match(workflow.slice(install, testStep), /\blilypond\b/i, 'real LilyPond installed or provisioned before tests');
  assert.match(workflow.slice(install, testStep), /if: steps\.checks\.outputs\.score-tools == 'true'/);
  assert.match(workflow.slice(testStep), /npm run test:release/, 'the declared changed-behavior plan runs');
  const expressions = read('test/brahms-expressions.test.ts');
  assert.match(expressions, /LILYPOND_BIN\s*\|\|\s*'lilypond'/);
  assert.match(expressions, /execFileSync\(compiler,\s*\['--version'\]/);
});

test('manual full validation is explicit, retains complete coverage and never deploys Pages', () => {
  const workflow = read('.github/workflows/deploy.yml');
  assert.match(workflow, /options: \[focused, full\]/);
  assert.match(workflow, /build-and-deploy:\s+if: github\.event_name != 'workflow_dispatch' \|\| inputs\.suite != 'full'/);
  const validation = workflow.slice(workflow.indexOf('\n  full-validation:'));
  assert.match(validation, /if: github\.event_name == 'workflow_dispatch' && inputs\.suite == 'full'/);
  assert.match(validation, /npm run test:full/);
  assert.match(validation, /npm run build/);
  assert.doesNotMatch(validation, /deploy-pages|upload-pages-artifact|github-pages/);
});
