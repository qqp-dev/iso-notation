#!/usr/bin/env node
/** Offline, layout-tagged expression extraction. --check requires a compiler. */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeBrahmsExpressions, type ExpressionWitness } from '../src/scores/brahms-expressions';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.join(root, 'data/sources/brahms-op118-no1');
const output = path.join(root, 'src/scores/data/brahms-op118-no1-expressions.json');
const manifest = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'manifest.json'), 'utf8')) as {
  sources: { path: string; bytes: number; sha256: string }[];
};
const check = process.argv.slice(2).join(' ') === '--check';
if (process.argv.length > 2 && !check) throw new Error('Only --check is supported');
for (const s of manifest.sources) {
  const bytes = fs.readFileSync(path.join(sourceRoot, s.path));
  if (bytes.length !== s.bytes || createHash('sha256').update(bytes).digest('hex') !== s.sha256)
    throw new Error(`Pinned source changed: ${s.path}`);
}
const bin = process.env.LILYPOND_BIN || 'lilypond';
const version = execFileSync(bin, ['--version'], { encoding: 'utf8' });
const modern = /GNU LilyPond (?:2\.(?:2[6-9]|[3-9]\d)|[3-9]\.)/.test(version);
const contexts = ['rightHandUpper', 'rightHandLower', 'leftHandUpper', 'leftHandLower', 'dynamics', 'pedal'];
function run() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'brahms-expression-'));
  try {
    const stub = modern ? "#(define ly:arpeggio::brew-chord-bracket (lambda (grob) (ly:make-stencil \"\" '(0 . 0) '(0 . 0))))" : '';
    const wrapper = `\\version "2.24.0"
\\language "english"
${stub}
\\include "${path.join(sourceRoot, 'includes/intermezzo-op118-no1-parts.ily')}"
outDir = "${dir}"
\\include "${path.join(root, 'scripts/brahms-expression-listener.ly')}"
\\score {
  \\keepWithTag layout \\unfoldRepeats \\new PianoStaff <<
    \\new Staff = "upper" << \\global \\new Voice = "rightHandUpper" \\rightHandUpper \\new Voice = "rightHandLower" \\rightHandLower >>
    \\new Dynamics = "dynamics" \\dynamics
    \\new Staff = "lower" << \\global \\new Voice = "leftHandUpper" \\leftHandUpper \\new Voice = "leftHandLower" \\leftHandLower >>
    \\new Dynamics = "pedal" \\pedal
  >>
  \\layout {
    \\context { \\Voice \\consists #brahms-expression-listener }
    \\context { \\Dynamics \\consists #brahms-expression-listener }
  }
}
`;
    const file = path.join(dir, 'wrapper.ly');
    fs.writeFileSync(file, wrapper);
    execFileSync(bin, ['-dno-print-pages', '-o', path.join(dir, 'out'), file], { stdio: 'pipe', timeout: 300000 });
    const rows: ExpressionWitness[] = [];
    const raw: string[] = [];
    for (const context of contexts) {
      const text = fs.readFileSync(path.join(dir, `expression-${context}.jsonl`), 'utf8');
      raw.push(`${context}\n${text}`);
      for (const line of text.split('\n').filter(Boolean)) {
        const o = JSON.parse(line) as ExpressionWitness;
        rows.push({ ...o, file: `includes/${path.basename(o.file)}`, context });
      }
    }
    return { raw: raw.join('\n'), rows };
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
const a = run();
const b = run();
// Temp paths only occur in wrapper; listener records vendored source origins.
if (a.raw !== b.raw) throw new Error('Nondeterministic compiler expression evidence');
const sidecar = normalizeBrahmsExpressions(a.rows, 13632);
const bytes = `${JSON.stringify(sidecar, null, 2)}\n`;
if (check) {
  if (!fs.existsSync(output) || fs.readFileSync(output, 'utf8') !== bytes)
    throw new Error('Brahms expression sidecar stale; regenerate using npm run brahms:export-expressions');
  console.log(`Brahms expression sidecar verified (${sidecar.dynamics.length} dynamics, ${sidecar.pedals.length} pedal events)`);
} else {
  fs.writeFileSync(output, bytes);
  console.log(`Wrote ${path.relative(root, output)} (${sidecar.dynamics.length} dynamics, ${sidecar.pedals.length} pedal events)`);
}
