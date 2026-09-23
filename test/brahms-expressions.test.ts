import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import { BRAHMS_CURRENT_PAGES } from './support/brahms-current';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBrahmsOp118No1Score, getBrahmsMidiData, BRAHMS_OP118_NO1_JANKO_OPTIONS, BRAHMS_OP118_NO1_JANKO_TOKENS } from '../src/scores/brahms-op118-no1';
import { normalizeBrahmsExpressions, scorePedalsFromExpressions, validateBrahmsExpressions, type ExpressionSidecar, type ExpressionWitness } from '../src/scores/brahms-expressions';
import { renderJankoPage } from '../src/render/janko/engine';
import prov from '../src/scores/data/brahms-op118-no1-written-durations.provenance.json';
import fixture from '../src/scores/data/brahms-op118-no1-expressions.json';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const score = buildBrahmsOp118No1Score();
const sidecar = fixture as ExpressionSidecar;
const hash = (v: string | Uint8Array) => crypto.createHash('sha256').update(v).digest('hex');

test('source expression inventory, provenance, ordering and fail-closed score population', () => {
  assert.equal(validateBrahmsExpressions(sidecar, 13632), sidecar);
  assert.equal(sidecar.dynamics.length, 89);
  assert.equal(sidecar.boundaries.length, 2);
  assert.equal(sidecar.pedals.length, 116);
  assert.deepEqual(score.dynamics, sidecar.dynamics);
  assert.equal(score.pedals.length, 109);
  assert.equal(score.pedals.filter(e => e.type === 'sustain-change').length, 7);
  assert.deepEqual(score.pedals.filter(e => e.type === 'sustain-change').map(e => e.changeOrigins?.map(o => o.order)),
    sidecar.pedals.flatMap((e, i) => i > 0 && e.type === 'sustain-down' &&
      sidecar.pedals[i - 1].type === 'sustain-up' && sidecar.pedals[i - 1].tick === e.tick
      ? [[sidecar.pedals[i - 1].order, e.order]] : []));
  assert.deepEqual(sidecar.dynamics.reduce((a, e) => (a[e.kind] = (a[e.kind] || 0) + 1, a), {} as Record<string, number>),
    { mark: 28, hairpin: 59, 'text-cresc': 2 });
  assert.ok(sidecar.dynamics.some(e => e.mark === 'sf' && e.origin.context === 'rightHandUpper' && e.tick === 1392));
  assert.ok(sidecar.dynamics.some(e => e.kind === 'hairpin' && e.tick === 0 && e.durationTicks === 36));
  assert.ok(sidecar.dynamics.some(e => e.kind === 'text-cresc' && e.origin.line === 371));
  const redundant = sidecar.boundaries;
  assert.deepEqual(redundant.map(e => [e.origin.line, e.origin.col]), [[383, 10], [383, 10]]);
  assert.ok(score.dynamics.every(e => e.kind !== ('stop' as typeof e.kind)), 'redundant stops are diagnostics only');
  assert.ok(score.notes.every(n => n.dynamicMark === undefined));
  assert.equal(sidecar.pedals[0].tick, 0);
  assert.equal(sidecar.pedals[0].type, 'sustain-down');
  // The layout-tag down at line 458 stays a down, even though MIDI uses a change.
  assert.ok(sidecar.pedals.some(e => e.origin.line === 458 && e.type === 'sustain-down'));
  const changes = sidecar.pedals.filter((e, i) => i && e.tick === sidecar.pedals[i-1].tick &&
    e.type === 'sustain-down' && sidecar.pedals[i-1].type === 'sustain-up');
  assert.ok(changes.length > 0, 'literal \\sud emits ordered same-tick off/on');
  assert.equal(changes.length, 7);
  assert.ok(changes.every(e => e.origin.file.endsWith('global-variables.ily')));
  assert.ok(score.pedals.some(e => e.type === 'sustain-change' && e.tick === 432));
  assert.ok(!score.pedals.some(e => e.type === 'sustain-change' && e.origin?.line === 458));
  assert.ok(sidecar.pedals.every(e => e.origin.time && e.origin.occurrence >= 1));
  assert.deepEqual(sidecar.pedals.filter(e => e.origin.line === 457).map(e => e.origin.occurrence), [1, 2]);
  assert.throws(() => validateBrahmsExpressions({ ...sidecar, version: 2 as 1 }, 13632), /version/);
  assert.throws(() => validateBrahmsExpressions({ ...sidecar, pedals: sidecar.pedals.slice(1) }, 13632), /unmatched sustain-up.*|inventory/);
  assert.throws(() => validateBrahmsExpressions({ ...sidecar, boundaries: [] }, 13632), /redundant-stop/);
  assert.throws(() => validateBrahmsExpressions({ ...sidecar, pedals: [{...sidecar.pedals[0], tick: -1}] }, 13632), /origin or tick/);
  assert.throws(() => validateBrahmsExpressions({ ...sidecar, dynamics: [{...sidecar.dynamics[0], mark: 'nonsense' as 'f'}] }, 13632), /invalid dynamic/);
  assert.throws(() => validateBrahmsExpressions({ ...sidecar, pedals: [
    { ...sidecar.pedals[0], type: 'sustain-up' }, ...sidecar.pedals.slice(1),
  ] }, 13632), /intermezzo-op118-no1-parts\.ily:457:17.*unmatched sustain-up/);
  assert.throws(() => validateBrahmsExpressions({ ...sidecar, pedals: [
    ...sidecar.pedals.slice(0, 3), { ...sidecar.pedals[3], type: 'sustain-up' }, ...sidecar.pedals.slice(4),
  ] }, 13632), /global-variables\.ily:126:17.*unmatched sustain-up/);
});

test('orphan sustain-ups fail with performed origin, including at a repeated occurrence', () => {
  const up: ExpressionWitness = { kind: 'sustain', text: '()', direction: '1', span: '()',
    num: 0, den: 1, file: 'includes/intermezzo-op118-no1-parts.ily', line: 457,
    col: 17, bar: 1, context: 'pedal' };
  assert.throws(() => normalizeBrahmsExpressions([up], 13632),
    /includes\/intermezzo-op118-no1-parts\.ily:457:17 \(pedal, 0\/1, bar 1, occurrence 1\): unmatched sustain-up/);
  // Reusing the same source location after a completed down/up cycle does not
  // excuse a second up: it is still an orphan in the unfolded performance.
  const down: ExpressionWitness = { ...up, direction: '-1' };
  assert.throws(() => normalizeBrahmsExpressions([down, up, { ...up, num: 1, den: 4 }], 13632),
    /includes\/intermezzo-op118-no1-parts\.ily:457:17 \(pedal, 1\/4, bar 1, occurrence 2\): unmatched sustain-up/);
  assert.deepEqual(normalizeBrahmsExpressions([down, down, up], 13632).pedals.map(e => e.type),
    ['sustain-down', 'sustain-down', 'sustain-up'], 'literal repeated downs remain uncollapsed');
});

test('only the compiler-confirmed parts line 383 redundant stop becomes diagnostic evidence', () => {
  const start: ExpressionWitness = { kind: 'crescendo', text: '()', direction: '-1', span: '()',
    num: 279, den: 8, file: 'includes/intermezzo-op118-no1-parts.ily', line: 382,
    col: 42, bar: 35, context: 'dynamics' };
  const close: ExpressionWitness = { ...start, num: 281, col: 69, direction: '1' };
  const redundant: ExpressionWitness = { ...close, num: 283, line: 383, col: 10, bar: 36 };
  const result = normalizeBrahmsExpressions([start, close, redundant], 13632);
  assert.equal(result.dynamics[0].durationTicks, 48);
  assert.deepEqual(result.boundaries.map(e => [e.tick, e.origin.line, e.origin.col]), [[6792, 383, 10]]);
  assert.throws(() => normalizeBrahmsExpressions([redundant], 13632), /383:10.*unmatched span stop/);
  assert.throws(() => normalizeBrahmsExpressions([start, close, { ...redundant, col: 11 }], 13632), /383:11.*unmatched span stop/);
});

test('all five Brahms pages remain byte-identical to pre-overlay real-engine SVG', () => {
  const expected = BRAHMS_CURRENT_PAGES;
  for (let p = 0; p < 5; p++)
    assert.equal(hash(renderJankoPage(score, p, BRAHMS_OP118_NO1_JANKO_OPTIONS, BRAHMS_OP118_NO1_JANKO_TOKENS)), expected[p], `page ${p+1}`);
});

test('pinned written fixture, source silences, provenance, MIDI remain untouched', () => {
  for (const [file, expected] of Object.entries({
    'src/scores/data/brahms-op118-no1-written-durations.json': 'f95571a7b4f739562b6afe8cef42caec4e5626f2e7a59d45e494ad505a7225ce',
    'src/scores/data/brahms-op118-no1-written-durations.provenance.json': '35c1ffbfe77185c51ffd54c6ebc898f9e9072d3f8a2e92f93ecde6ae4c77e949',
    'src/scores/data/brahms-op118-no1-source-silences.json': '924a177d871a03318379d80e5b00721e2cf0c8a82df6b878aa9d189af19aeef8',
    'public/midi/brahms-op118-no1.mid': '94dec49323ab126d37a0fc38e5dc41ded5b0e1ac4b743a946d1fe282e4766a55',
  })) assert.equal(hash(fs.readFileSync(path.join(root, file))), expected, file);
  assert.equal(hash(getBrahmsMidiData()), hash(fs.readFileSync(path.join(root, 'public/midi/brahms-op118-no1.mid'))));
});

test('m65/66 source tie truth distinguishes continued lower notes from new upper attacks and restrikes', () => {
  const events = prov.events;
  const by = (tick: number, pc: number, oct: number, voice: string) => events.find(e => e.startTick === tick && e.pitchClass === pc && e.octave === oct && e.voices.includes(voice));
  for (const [at, lower] of [[12432, [[9,2,12360], [2,3,12384], [6,3,12408]]],
    [12624, [[9,2,12552], [2,3,12576], [5,3,12600]]]] as const) {
    for (const [pc, oct, onset] of lower) {
      const e = by(onset, pc, oct, pc === 5 || pc === 6 ? 'leftHandUpper' : 'leftHandLower');
      assert.ok(e, `source lower pitch ${pc}/${oct} @${onset}`);
      assert.ok(e.startTick < at && e.startTick + e.durationTicks > at, 'continued through boundary');
      assert.ok(e.segments.some(s => s.startTick === at) || onset < at, 'source components retained');
    }
  }
  assert.ok(by(12432, 9, 3, 'rightHandUpper'));
  assert.ok(by(12624, 2, 4, 'rightHandUpper'));
  assert.ok(by(12624, 2, 5, 'rightHandUpper'));
  assert.ok(by(12552, 9, 2, 'leftHandLower'));
  assert.ok(by(12576, 2, 3, 'leftHandLower'));
  assert.ok(by(12432, 9, 2, 'leftHandUpper') && by(12624, 9, 2, 'leftHandUpper'), 'independent written upper voice stays visible in source evidence');
});

const compiler = process.env.LILYPOND_BIN || 'lilypond';
test('real compiler microfixture: layout tags, pickup, alternatives, delayed stop, sf, note/spacer and ordered pedal change', () => {
  // Compiler availability is mandatory here (no optional skip).
  const version = execFileSync(compiler, ['--version'], { encoding: 'utf8' });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'brahms-expression-micro-'));
  try {
    const stub = /GNU LilyPond 2\.2[6-9]/.test(version) ? "#(define ly:arpeggio::brew-chord-bracket (lambda (grob) (ly:make-stencil \"\" '(0 . 0) '(0 . 0))))" : '';
    const wrapper = `\\version "2.24.0"\n\\language "english"\n${stub}\n\\include "${path.join(root, 'test/fixtures/brahms-expression-micro.ily')}"\noutDir = "${dir}"\n\\include "${path.join(root, 'scripts/brahms-expression-listener.ly')}"\n\\score { \\keepWithTag layout \\unfoldRepeats \\new PianoStaff <<\n \\new Staff = "upper" << \\new Voice = "rightHandUpper" \\mxUpper >>\n \\new Dynamics = "dynamics" \\mxDynamics\n \\new Dynamics = "redundant" \\mxRedundant\n \\new Staff = "lower" << \\new Voice = "leftHandLower" \\mxLower >>\n \\new Dynamics = "pedal" \\mxPedal\n >> \\layout { \\context { \\Voice \\consists #brahms-expression-listener } \\context { \\Dynamics \\consists #brahms-expression-listener } } }`;
    fs.writeFileSync(path.join(dir, 'wrapper.ly'), wrapper);
    try {
      execFileSync(compiler, ['-dno-print-pages', '-o', path.join(dir, 'out'), path.join(dir, 'wrapper.ly')], { stdio: 'pipe', timeout: 120000 });
    } catch (err) {
      throw new Error(`Microfixture compiler failed: ${String((err as { stderr?: Buffer }).stderr)}`);
    }
    const redundant = fs.readFileSync(path.join(dir, 'expression-redundant.jsonl'), 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line) as ExpressionWitness);
    assert.deepEqual(redundant.map(e => [e.kind, e.direction, e.num, e.den, e.line]), [
      ['crescendo', '-1', 1, 4, 7], ['crescendo', '1', 3, 8, 7], ['crescendo', '1', 1, 2, 7],
    ], 'real compiler emits both explicit stop events, with distinct delayed moments and source origins');
    const rows: ExpressionWitness[] = [];
    for (const context of ['rightHandUpper', 'leftHandLower', 'dynamics', 'pedal'])
      for (const line of fs.readFileSync(path.join(dir, `expression-${context}.jsonl`), 'utf8').split('\n').filter(Boolean))
        rows.push({ ...JSON.parse(line), file: `includes/${path.basename(JSON.parse(line).file)}`, context });
    assert.ok(rows.some(e => e.context === 'rightHandUpper' && e.kind === 'dynamic' && e.text === 'sf' && e.num === 0));
    assert.ok(rows.some(e => e.context === 'rightHandUpper' && e.kind === 'crescendo' && e.direction === '1' && e.num === 3 && e.den === 8), 'after eighth is relative to the preceding quarter: stop at 3/8, not onset');
    assert.ok(rows.some(e => e.context === 'dynamics' && e.kind === 'dynamic' && e.text === 'p' && e.num === 0));
    assert.ok(rows.some(e => e.context === 'pedal' && e.num === 1 && e.den === 4 && e.direction === '-1'), 'layout tag is down, not MIDI change');
    const pair = rows.filter(e => e.context === 'pedal' && e.num === 3 && e.den === 4);
    assert.deepEqual(pair.map(e => e.direction), ['1', '-1']);
    const result = normalizeBrahmsExpressions(rows, 864);
    assert.ok(result.dynamics.some(e => e.origin.context === 'rightHandUpper' && e.durationTicks === 72));
    assert.ok(result.dynamics.some(e => e.origin.context === 'dynamics' && e.mark === 'sf' && e.origin.occurrence === 2));
    assert.ok(result.pedals.some(e => e.origin.occurrence === 2));
    assert.equal(result.boundaries.length, 0);
    assert.ok(scorePedalsFromExpressions(result).some(e => e.type === 'sustain-change' &&
      e.changeOrigins?.[0].order! < e.changeOrigins?.[1].order!));
    assert.ok(scorePedalsFromExpressions(result).some(e => e.type === 'sustain-down' && e.tick === 48),
      'layout-only tagged down remains a down');
    assert.ok(result.dynamics.some(e => e.mark === 'p' && e.origin.line === 5));
    assert.ok(result.dynamics.some(e => e.mark === 'f' && e.origin.line === 5));
    assert.throws(() => normalizeBrahmsExpressions([{...rows[0], text: 'rf', kind: 'dynamic'}], 864), /unsupported dynamic.*brahms-expression-micro.ily|brahms-expression-micro.ily.*unsupported dynamic/);
    assert.throws(() => normalizeBrahmsExpressions([{...rows[0], kind: 'crescendo', text: '()', direction: '1'}], 864), /unmatched span stop/);
    assert.throws(() => normalizeBrahmsExpressions([{...rows[0], num: 1, den: 7}], 864), /fractional grid tick/);
    assert.throws(() => normalizeBrahmsExpressions([{...rows[0], num: 6, den: 1}], 864), /outside score/);
    assert.throws(() => normalizeBrahmsExpressions([{...rows[0], kind: 'crescendo', text: '()', direction: '-1'}], 864), /unmatched span start/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('compiler regeneration of the committed expression sidecar is mandatory', () => {
  execFileSync(process.execPath, ['--import', 'tsx', 'scripts/brahms-export-expressions.ts', '--check'], { cwd: root, stdio: 'pipe', timeout: 300000 });
});
