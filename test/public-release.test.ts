import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (name: string) => readFileSync(name, 'utf8');

test('public Landing exposes Bach Play, Sheet and Guide without either MIDI import route', () => {
  const landing = read('src/ui/Landing.tsx');
  const html = read('index.html');
  for (const label of ['Play', 'Sheet', 'Guide', 'goldberg-variation-1.pdf']) assert.ok(landing.includes(label), label);
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

test('root Play/Sheet and PDF consume one verified active release; Pages keeps full software gates', () => {
  const root = read('src/ui/Landing.tsx');
  const sheet = read('src/ui/JankoPages.tsx');
  const viewer = read('src/render/janko/prepared/viewer.ts');
  const workflow = read('.github/workflows/deploy.yml');
  assert.match(root, /watchDeployedRelease\(/);
  assert.match(root, /resolveActiveScore\(BACH_ID, parsed\)/);
  assert.match(root, /setScore\(next\.score\)/);
  assert.match(root, /setActiveData\(parsed\)/);
  assert.match(root, /setPdfUrl\(release\.pdfUrl\)/);
  assert.match(root, /useJankoPages\(score, activeData\)/);
  assert.match(sheet, /resolveActiveScore\(/);
  assert.match(viewer, /watchDeployedRelease\(/);
  assert.match(workflow, /npm test/);
  assert.match(workflow, /npm run build/);
  assert.match(workflow, /verify-data-release/);
});

test('Pages provisions the actual LilyPond compiler before mandatory expression tests', () => {
  const workflow = read('.github/workflows/deploy.yml');
  const install = workflow.indexOf('Install system dependencies');
  const testStep = workflow.indexOf('Run tests');
  assert.ok(install >= 0 && testStep > install, 'compiler setup precedes tests');
  assert.match(workflow.slice(install, testStep), /\blilypond\b/i, 'real LilyPond installed or provisioned before tests');
  assert.match(workflow.slice(testStep), /npm test/, 'normal suite runs, not a filtered replacement');
  const expressions = read('test/brahms-expressions.test.ts');
  assert.match(expressions, /LILYPOND_BIN\s*\|\|\s*'lilypond'/);
  assert.match(expressions, /execFileSync\(compiler,\s*\['--version'\]/);
});
