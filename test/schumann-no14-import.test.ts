import { test } from 'node:test';
import assert from 'node:assert/strict';
import { importSchumann, importSchumannNo14 } from '../src/scores/schumann-no43';
import { buildSchumannNo14Draft, schumannNo14WrittenFacts, schumannNo14DeferredLedger } from '../src/scores/schumann-no14-draft';
import { linearIndex } from '../src/model/pitch';
import { CURRENT_CANDIDATES } from '../src/render/janko/candidates';
import { createStudioConfig } from '../src/render/janko/studio';
import { countJankoPages, renderJankoCrop, renderJankoPage } from '../src/render/janko/engine';
import { lintJankoScore } from '../src/render/janko/linter';
import { DEFAULT_JANKO_OPTIONS, protectsBarlineInk } from '../src/render/janko/types';

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
  assert.deepEqual(a.score.notes.map(n => [n.startTick, n.durationTicks, n.sourceProvenance?.voices[0], n.sourceProvenance?.staves[0], n.hand]),
    [[0, 24, 'lower', 'lower', 'LH'], [24, 24, 'lower', 'lower', 'LH'], [48, 24, 'lower', 'lower', 'LH'],
      [72, 24, 'lower', 'upper', 'RH'], [96, 24, 'lower', 'upper', 'RH'], [120, 24, 'lower', 'upper', 'RH']],
    'printed destination and provisional performance hand differ from logical part; all three retain provenance');
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
      ['lower."1"', '0', 'lower', 36], ['lower."1"', '1/8', 'lower', 43], ['lower."1"', '1/4', 'lower', 52],
      ['lower', '3/8', 'lower', 64], ['lower', '1/2', 'lower', 60], ['lower', '5/8', 'lower', 55]]);
  assert.ok(score.notes.length >= 6, 'both written branches remain attributable even if the projection classifies an optional route');
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
  const score = buildSchumannNo14Draft('principal');
  assert.equal(facts.sourceHash, '42aa471662af4d919f696b03e6b7b5b634a8e1f1310303aa6a92075c9b511533');
  assert.equal(facts.events.length, 460);
  assert.equal(facts.bars.length, 64);
  assert.ok(facts.bars.every(b => b.duration === '3/4'));
  assert.deepEqual(facts.repeats, [{ start: 32, end: 63, alternatives: [] }]);
  assert.deepEqual(facts.occurrences.map(o => o.sourceBar),
    [...Array.from({ length: 64 }, (_, i) => i), ...Array.from({ length: 32 }, (_, i) => i + 32)]);
  assert.equal(score.totalTicks, 96 * 144);
  assert.ok(score.notes.length > 0, 'the full principal reading is projected');
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
  assert.deepEqual(m41.map(e => e.pitches[0].absolutePitch), [48, 52, 55, 36, 43, 52, 64, 60, 55]);
  assert.deepEqual(m41.map(e => e.onset), ['30', '241/8', '121/4', '30', '241/8', '121/4', '243/8', '61/2', '245/8']);
  const m48 = facts.events.filter(e => e.bar === 47 && e.kind === 'note');
  assert.deepEqual(m48.map(e => e.pitches[0].absolutePitch), [55, 57, 55, 50, 48, 57, 50, 48, 40, 42]);
  assert.equal(new Set(m48.map(e => e.voice)).size, 3);
  assert.deepEqual(facts.events.filter(e => e.bar === 62 && e.kind === 'note').map(e => e.pitches[0].absolutePitch),
    [43, 47, 50, 31, 38, 47, 55, 50, 47]);
  assert.equal(score.notes.filter(n => n.startTick === 40 * 144 && linearIndex(n.pitch) === 48).length, 1);
  for (const [sourceBar, repeated] of [[40,72],[42,74],[62,94]]) {
    const written = facts.events.filter(e => e.bar === sourceBar && e.kind === 'note');
    assert.ok(written.length >= 9, `written alternatives in bar ${sourceBar + 1} remain in source facts`);
    for (const occurrence of [sourceBar, repeated]) {
      const attacks = score.notes.filter(n => n.startTick >= occurrence * 144 && n.startTick < (occurrence + 1) * 144);
      assert.ok(attacks.length > 0, `principal occurrence ${occurrence + 1} retains sounding attacks`);
      assert.ok(attacks.length < written.length, `optional notes are not additive in occurrence ${occurrence + 1}`);
    }
  }
  assert.ok(schumannNo14DeferredLedger.some(l => l.construct.includes('PhrasingSlur')));
  assert.ok(facts.expressions.some(l => l.token === '\\parenpiano'));
  assert.equal(facts.expressions.filter(l => l.token === '\\sustainOn').length, 53);
  assert.equal(facts.expressions.filter(l => l.token === '\\sustainOff').length, 53);
  assert.ok(schumannNo14DeferredLedger.every(l => !l.blocking && l.line > 0 && l.column > 0));
  assert.throws(() => importSchumannNo14('unapproved'), /Unapproved.*hash/);
});

test('admitted optional routes replace rather than double principal attacks, without changing unrelated music or clocks', () => {
  const facts = schumannNo14WrittenFacts;
  const groups = facts.alternativeGroups!;
  assert.deepEqual(groups.map(g => g.bar), [40, 42, 62]);
  const principal = buildSchumannNo14Draft('principal');
  const optional = buildSchumannNo14Draft('optional');
  assert.deepEqual(optional.sourceBarTicks, principal.sourceBarTicks);
  assert.equal(optional.totalTicks, principal.totalTicks);
  assert.equal(optional.notes.length, principal.notes.length,
    'each alternative replaces three attacks on both occurrences, never adds a layer');
  for (const group of groups) {
    assert.equal(group.principal.length, 3);
    assert.equal(group.optional.length, 3);
    assert.match(group.evidence, /simultaneous|source lines/i);
    const routes = [group.principal, group.optional];
    for (const [i, score] of [principal, optional].entries()) {
      for (const occurrence of [group.bar, group.bar + 32]) {
        const notes = score.notes.filter(n => n.startTick >= occurrence * 144 && n.startTick < (occurrence + 1) * 144);
        for (const eventId of routes[i]) {
          const source = facts.events.find(e => e.id === eventId)!;
          const projected = notes.filter(n => n.id.startsWith(`${eventId}:`));
          assert.equal(projected.length, source.pitches.length, `${eventId} on occurrence ${occurrence + 1}`);
          assert.ok(projected.every(n => n.sourceProvenance?.voices.includes(source.voice) &&
            n.sourceProvenance?.staves.includes(source.printedStaff ?? source.staff)));
        }
        for (const eventId of routes[1 - i]) assert.ok(!notes.some(n => n.id.startsWith(`${eventId}:`)),
          `inactive route ${eventId} must not sound on occurrence ${occurrence + 1}`);
      }
    }
  }
  const switched = new Set(groups.flatMap(g => [...g.principal, ...g.optional]));
  const untouched = (notes: typeof principal.notes) => notes.filter(n =>
    ![...switched].some(id => n.id.startsWith(`${id}:`)));
  assert.deepEqual(untouched(optional.notes), untouched(principal.notes),
    'projection choice leaves all non-alternative attacks and their provenance untouched');
});

test('font size alone never silently classifies a synthetic cue as an optional performance route', () => {
  const source = fixture(String.raw`<< { c8 d e } \\ { \set fontSize = #-5 g8 a b } >> c8 d e |`);
  const principal = importSchumann(source, id, 'principal');
  const optional = importSchumann(source, id, 'optional');
  assert.deepEqual(principal.score.notes, optional.score.notes);
  assert.equal(principal.facts.alternativeGroups?.length ?? 0, 0);
  assert.equal(principal.score.notes.length, 9);
});

test('whole-upper paired gestures keep contextual hands without changing their printed staff or logical voice', () => {
  const score = buildSchumannNo14Draft();
  for (const bar of [5, 6, 7, 21, 22, 23, 41, 43, 53, 54]) {
    const notes = score.notes.filter(n => n.startTick >= bar * 144 && n.startTick < (bar + 1) * 144);
    assert.ok(notes.length >= 6, `written m.${bar + 1} has its paired gesture`);
    assert.ok(notes.some(n => n.hand === 'LH') && notes.some(n => n.hand === 'RH'),
      `m.${bar + 1} is not made all-RH merely because both gestures print upstairs`);
    assert.ok(notes.every(n => n.sourceProvenance?.staves.includes('upper')),
      `m.${bar + 1} retains its printed upper destination`);
  }
  const polyphony = score.notes.filter(n => n.startTick >= 47 * 144 && n.startTick < 48 * 144);
  assert.ok(polyphony.some(n => n.hand === 'LH') && polyphony.some(n => n.hand === 'RH'),
    'm.48 sustains separate performance roles without changing pitch or timing');
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

test('source identity is rendered as work, piece and author rather than inherited Bach defaults', () => {
  const config = createStudioConfig();
  const entry = config.scores['schumann-op68-no14'];
  const page = renderJankoPage(entry.score, 0, entry.options, entry.tokens);
  assert.match(page, /class="janko-title"[^>]*>Album für die Jugend · Op\. 68<\/text>/);
  assert.match(page, /class="janko-subtitle"[^>]*>Nr\. 14 · Kleine Studie<\/text>/);
  assert.match(page, /class="janko-meta"[^>]*>Robert Schumann<\/text>/);
  assert.doesNotMatch(page, /Petite Etude|Draft|unfolded|Johann Sebastian Bach/);
  for (const id of ['schumann-op68-no13', 'schumann-op68-no30', 'schumann-op68-no43']) {
    const other = config.scores[id];
    const header = renderJankoPage(other.score, 0, other.options, other.tokens).match(/<g id="page-header">[\s\S]*?<\/g>/)?.[0] ?? '';
    assert.match(header, /Robert Schumann/);
    assert.match(header, /Album für die Jugend/);
    assert.doesNotMatch(header, /Johann Sebastian Bach|Goldberg|Draft|unfolded/i);
  }
  const unknown = { ...entry.score, id: 'anonymous-import', title: '', composer: '' };
  const anonymousPage = renderJankoPage(unknown, 0, DEFAULT_JANKO_OPTIONS, entry.tokens);
  assert.doesNotMatch(anonymousPage, /Johann Sebastian Bach|Goldberg|Robert Schumann|Kleine Studie/,
    'missing metadata must not silently borrow another work identity');
});

test('complete real-engine Candidates window uses actual pages, with diagnostic lint kept visible', () => {
  const config = createStudioConfig();
  const entry = config.scores['schumann-op68-no14'];
  assert.ok(entry);
  const card = CURRENT_CANDIDATES.find(c => c.id === 'schumann-no14-written-draft');
  assert.ok(card?.windows?.some(w => 'fullScore' in w && w.fullScore && w.measureStart === 1 && w.measureCount === 96));
  assert.ok(card?.windows?.some(w => 'measureStart' in w && w.measureStart === 48));
  const principal = config.scores['schumann-op68-no14-principal'];
  assert.ok(principal, 'other source branch is explicitly available');
  assert.notDeepEqual(principal.score.notes, entry.score.notes);
  assert.deepEqual(principal.score.sourceBarTicks, entry.score.sourceBarTicks);
  const comparison = CURRENT_CANDIDATES.find(c => c.id === 'schumann-no14-principal-route');
  for (const measure of [41,43,63]) assert.ok(comparison?.windows?.some(w =>
    'scoreId' in w && w.scoreId === 'schumann-op68-no14-principal' && w.measureStart === measure));
  assert.ok(!CURRENT_CANDIDATES.some(c => c.id === 'schumann-no14-ottava-seat'), 'phantom ottava decision retired');
  assert.match(renderJankoCrop(entry.score, 1, 2, entry.options, entry.tokens), /<svg/);
  assert.ok(countJankoPages(entry.score, entry.options, entry.tokens) < 12,
    'ordinary No.14 passages must not retain the old uniform two-bar pagination');
  for (const name of ['schumann-op68-no13', 'schumann-op68-no14', 'schumann-op68-no30', 'schumann-op68-no43']) {
    assert.ok(protectsBarlineInk(config.scores[name].options.gridWritingPolicy),
      `${name} production barlines must participate in geometry clearance lint`);
  }
  const report = lintJankoScore(entry.score, entry.options, entry.tokens);
  console.log(`No. 14 candidate geometry: ${report.violations.length} violations, ${report.warnings.length} warnings; ${JSON.stringify(report.violations.reduce((a, v) => ({ ...a, [v.code]: (a[v.code] ?? 0) + 1 }), {} as Record<string, number>))}`);
  assert.ok(Array.isArray(report.violations) && Array.isArray(report.warnings));
  assert.equal(config.scores['schumann-op68-no43'].score.id, 'schumann-op68-no43');
});
