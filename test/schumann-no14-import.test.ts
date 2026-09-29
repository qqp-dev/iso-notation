import { test } from 'node:test';
import assert from 'node:assert/strict';
import { importSchumann, importSchumannNo14 } from '../src/scores/schumann-no43';
import { buildSchumannNo14Draft, schumannNo14WrittenFacts, schumannNo14DeferredLedger } from '../src/scores/schumann-no14-draft';
import { linearIndex } from '../src/model/pitch';
import { CURRENT_CANDIDATES } from '../src/render/janko/candidates';
import { createStudioConfig } from '../src/render/janko/studio';
import { countJankoPages, renderJankoCrop } from '../src/render/janko/engine';
import { lintJankoScore } from '../src/render/janko/linter';

const id = { number: 14 as const, file: 'literal-fixture.ly', hash: 'fixture' };
const fixture = (body: string, upper = String.raw`s2. |`) => String.raw`\score { \new PianoStaff <<
  \new Staff = "upper" { \relative c'' { \time 6/8 ${upper} } }
  \new Staff = "lower" { \relative c' { \time 6/8 ${body} } }
>> }`;

test('opening six eighths have exact pitch, clock, written part and changing printed destination', () => {
  const source = fixture(String.raw`g8 b d \change Staff = "upper" b'8 g d |`);
  const a = importSchumann(source, id);
  assert.deepEqual(importSchumann(source, id), a);
  const lower = a.facts.events.filter(e => e.staff === 'lower');
  assert.deepEqual(lower.map(e => [e.pitches[0].absolutePitch, e.onset, e.duration, e.printedStaff]),
    [[43, '0', '1/8', 'lower'], [47, '1/8', '1/8', 'lower'], [50, '1/4', '1/8', 'lower'],
      [59, '3/8', '1/8', 'upper'], [55, '1/2', '1/8', 'upper'], [50, '5/8', '1/8', 'upper']]);
  assert.deepEqual(new Set(lower.map(e => e.voice)), new Set(['lower']));
  assert.ok(lower.every(e => e.handPolicy === 'provisional-lower'));
  assert.deepEqual(a.score.notes.map(n => [n.startTick, n.durationTicks, n.sourceProvenance?.staves[0], n.hand]),
    [[0, 24, 'lower', 'LH'], [24, 24, 'lower', 'LH'], [48, 24, 'lower', 'LH'],
      [72, 24, 'upper', 'LH'], [96, 24, 'upper', 'LH'], [120, 24, 'upper', 'LH']]);
  assert.equal(a.score.sourceSilences?.length, 1);
  assert.equal(a.score.sourceSilences?.[0].kind, 'skip');
});

test('mid-bar branches align at current parent clock, remain distinct and resume for second half', () => {
  const body = String.raw`g8 b d << { \change Staff = "upper" c8 e g }
    \context Voice = "1" { \change Staff = "lower" \set fontSize = #-5 c,,8 g' e' } >> e'8 c g |`;
  // A half-bar branch that fills the remaining half cannot take another three eighths
  // without producing a second (incomplete) bar, rejected against the other staff.
  assert.throws(() => importSchumann(fixture(body), id), /staff bar duration disagreement/);
  const half = fixture(String.raw`<< { \change Staff = "upper" c8 e g }
    \context Voice = "1" { \change Staff = "lower" \set fontSize = #-5 c,,8 g' e' } >> e'8 c g |`);
  const { facts, score, ledger } = importSchumann(half, id);
  assert.deepEqual(facts.bars.map(b => b.duration), ['3/4']);
  assert.deepEqual(facts.events.filter(e => e.kind === 'note').map(e => [e.voice, e.onset, e.printedStaff, e.pitches[0].absolutePitch]),
    [['lower.0', '0', 'upper', 48], ['lower.0', '1/8', 'upper', 52], ['lower.0', '1/4', 'upper', 55],
      ['lower."1"', '0', 'lower', 24], ['lower."1"', '1/8', 'lower', 31], ['lower."1"', '1/4', 'lower', 40],
      ['lower', '3/8', 'lower', 64], ['lower', '1/2', 'lower', 60], ['lower', '5/8', 'lower', 55]]);
  assert.equal(score.notes.length, 9);
  assert.ok(ledger.some(l => l.construct.includes('fontSize') && !l.blocking));
  assert.throws(() => importSchumann(fixture(String.raw`<< { c8 d e } \context Voice = "1" { c8 d4. } >> e8 f g |`), id), /Simultaneous voices disagree/);
  assert.throws(() => importSchumann(fixture(String.raw`<< { << { c8 d e } \\ { c8 d } >> } \\ { c8 d e } >> e8 f g |`), id), /Simultaneous voices disagree/);
});

test('three branches, dotted inherited duration, multiplied bars and no-ending volta graph', () => {
  const source = fixture(String.raw`<< { g4. a } \\ { g8 d c a' d, c } \\ { \change Staff = "lower" e,4. fis } >> |
    \repeat volta 2 { g8 b d b' g d | }`, String.raw`s2. | \repeat volta 2 { s2. | }`);
  const { facts, score } = importSchumann(source, id);
  assert.deepEqual(facts.bars.map(b => b.duration), ['3/4', '3/4']);
  assert.deepEqual(facts.repeats, [{ start: 1, end: 1, alternatives: [] }]);
  assert.deepEqual(facts.occurrences.map(o => [o.sourceBar, o.pass, o.onset]), [[0, 1, '0'], [1, 1, '3/4'], [1, 2, '3/2']]);
  assert.equal(score.totalTicks, 432);
  assert.deepEqual(facts.events.filter(e => e.bar === 0 && e.kind === 'note').map(e => [e.voice, e.duration, e.printedStaff]),
    [['lower.0', '3/8', 'lower'], ['lower.0', '3/8', 'lower'],
      ...Array.from({ length: 6 }, () => ['lower.1', '1/8', 'lower']),
      ['lower.2', '3/8', 'lower'], ['lower.2', '3/8', 'lower']]);
  assert.ok(score.notes.every(n => Number.isSafeInteger(n.startTick) && Number.isSafeInteger(n.durationTicks)));
});

test('approved record: 64 whole written bars, second half repeated twice, independent voices and deferred expression', () => {
  const facts = schumannNo14WrittenFacts;
  const score = buildSchumannNo14Draft();
  assert.equal(facts.sourceHash, '42aa471662af4d919f696b03e6b7b5b634a8e1f1310303aa6a92075c9b511533');
  assert.equal(facts.events.length, 460);
  assert.equal(facts.bars.length, 64);
  assert.ok(facts.bars.every(b => b.duration === '3/4'));
  assert.deepEqual(facts.repeats, [{ start: 32, end: 63, alternatives: [] }]);
  assert.deepEqual(facts.occurrences.map(o => o.sourceBar),
    [...Array.from({ length: 64 }, (_, i) => i), ...Array.from({ length: 32 }, (_, i) => i + 32)]);
  assert.equal(score.totalTicks, 96 * 144);
  assert.equal(score.notes.length, 592);
  assert.equal(facts.expressionSpacers?.length, 253);
  for (const channel of ['Dynamics_pf', 'pedal']) {
    const spacers = facts.expressionSpacers!.filter(s => s.channel === channel);
    assert.equal(spacers[0].onset, '0');
    assert.equal(spacers.at(-1)!.bar, 63);
    assert.equal(spacers.reduce((sum, s) => sum + Number(s.duration.split('/')[0]) /
      Number(s.duration.split('/')[1] ?? 1), 0), 48);
  }
  assert.ok(facts.expressionSpacers!.some(s => s.channel === 'Dynamics_pf' && s.line === 136 && s.bar === 32));
  assert.deepEqual(facts.events.filter(e => e.bar === 0 && e.kind === 'note').map(e => [e.pitches[0].absolutePitch, e.printedStaff]),
    [[43, 'lower'], [47, 'lower'], [50, 'lower'], [59, 'upper'], [55, 'upper'], [50, 'upper']]);
  const m41 = facts.events.filter(e => e.bar === 40 && e.kind === 'note');
  assert.deepEqual(m41.map(e => e.pitches[0].absolutePitch), [48, 52, 55, 24, 31, 40, 64, 60, 55]);
  assert.deepEqual(m41.map(e => e.onset), ['30', '241/8', '121/4', '30', '241/8', '121/4', '243/8', '61/2', '245/8']);
  const m48 = facts.events.filter(e => e.bar === 47 && e.kind === 'note');
  assert.deepEqual(m48.map(e => e.pitches[0].absolutePitch), [55, 57, 43, 38, 36, 45, 38, 36, 40, 42]);
  assert.equal(new Set(m48.map(e => e.voice)).size, 3);
  assert.deepEqual(facts.events.filter(e => e.bar === 62 && e.kind === 'note').map(e => e.pitches[0].absolutePitch),
    [55, 59, 62, 31, 38, 47, 79, 74, 71]);
  assert.equal(score.notes.filter(n => n.startTick === 40 * 144 && linearIndex(n.pitch) === 48).length, 1);
  assert.ok(schumannNo14DeferredLedger.some(l => l.construct.includes('PhrasingSlur')));
  assert.ok(schumannNo14DeferredLedger.some(l => l.construct.includes('parenpiano')));
  assert.ok(schumannNo14DeferredLedger.some(l => l.construct.includes('sustainOn')));
  assert.ok(schumannNo14DeferredLedger.every(l => !l.blocking && l.line > 0 && l.column > 0));
  assert.throws(() => importSchumannNo14('unapproved'), /Unapproved.*hash/);
});

test('unknown music fails closed in the wrapper and in the voice; inert Scheme cannot execute', () => {
  for (const body of [String.raw`\unknownMusic \relative c' { c4. c4. | }`,
    String.raw`\relative c' { c4. \unknownMusic c4. | }`]) {
    const source = String.raw`\score { \new Staff { ${body} } }`;
    assert.throws(() => importSchumann(source, id), /literal-fixture.ly:\d+:\d+ \[[^\]]+\].*unknownMusic/);
  }
  const source = fixture(String.raw`c4. d4. |`);
  const pitchesAndTicks = (text: string) => importSchumann(text, id).score.notes.map(n =>
    [n.startTick, n.durationTicks, linearIndex(n.pitch), n.hand]);
  assert.deepEqual(pitchesAndTicks('#(error "never run")\n' + source), pitchesAndTicks(source));
});

test('complete real-engine Candidates window uses actual pages, with diagnostic lint kept visible', () => {
  const config = createStudioConfig();
  const entry = config.scores['schumann-op68-no14'];
  assert.ok(entry);
  const card = CURRENT_CANDIDATES.find(c => c.id === 'schumann-no14-written-draft');
  assert.ok(card?.windows?.some(w => 'fullScore' in w && w.fullScore && w.measureStart === 1 && w.measureCount === 96));
  assert.ok(card?.windows?.some(w => 'measureStart' in w && w.measureStart === 48));
  assert.match(renderJankoCrop(entry.score, 1, 2, entry.options, entry.tokens), /<svg/);
  assert.equal(countJankoPages(entry.score, entry.options, entry.tokens), 12);
  const report = lintJankoScore(entry.score, entry.options, entry.tokens);
  console.log(`No. 14 candidate geometry: ${report.violations.length} violations, ${report.warnings.length} warnings; ${JSON.stringify(report.violations.reduce((a, v) => ({ ...a, [v.code]: (a[v.code] ?? 0) + 1 }), {} as Record<string, number>))}`);
  assert.ok(Array.isArray(report.violations) && Array.isArray(report.warnings));
  assert.equal(config.scores['schumann-op68-no43'].score.id, 'schumann-op68-no43');
});
