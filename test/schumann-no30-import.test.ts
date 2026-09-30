import { test } from 'node:test';
import assert from 'node:assert/strict';
import { importSchumann, importSchumannNo30 } from '../src/scores/schumann-no43';
import { buildSchumannNo30Draft, schumannNo30WrittenFacts, schumannNo30DeferredLedger } from '../src/scores/schumann-no30-draft';
import { CURRENT_CANDIDATES } from '../src/render/janko/candidates';
import { createStudioConfig } from '../src/render/janko/studio';
import { countJankoPages, renderJankoCrop } from '../src/render/janko/engine';
import { lintJankoScore } from '../src/render/janko/linter';

const identity = { number: 30 as const, file: 'literal-no30.ly', hash: 'fixture' };
const fixture = (upper: string, lower: string) => String.raw`\score { \new PianoStaff <<
  \new Staff = "Staff_pfUpper" { \relative c' { \time 4/4 ${upper} } }
  \new Staff = "Staff_pfLower" { \relative c { \time 4/4 ${lower} } }
>> }`;
const upper = String.raw`r2 <aes aes'>2\laissezVibrer ~ |
\repeat volta 2 { aes'2\repeatTie <aes, aes'>4 ~ <aes aes'>4 | }
\alternative { { r2 r4 <aes aes'>4\laissezVibrer | } { r2 r4 } }`;
const lower = String.raw`s1 | \repeat volta 2 { s1 | } \alternative { { s1 | } { s2. } }`;

test('preceding relative chord context fixes source octave: F4 → Bb3/E4 → A3/F4 → Ab3/Ab4 → Ab4', () => {
  // Independent literal passage witness, not a reset-anchor `<aes aes'>` snapshot.
  // In the project C4 = linear 48 and MIDI = linear + 12.
  const pre = String.raw`f4 <bes, bes'>4 <bes e>4 <a f'>4 | r2 <aes aes'>2\laissezVibrer ~ |
    \repeat volta 2 { aes'2\repeatTie r2 | }
    \alternative { { r2 r4 <aes, aes'>4\laissezVibrer | } { r2 r4 } }`;
  const bass = String.raw`s1 | s1 | \repeat volta 2 { s1 | } \alternative { { s1 | } { s2. } }`;
  const { facts } = importSchumann(fixture(pre, bass), identity);
  assert.deepEqual(facts.events.filter(e => e.voice === 'upper' && e.bar <= 1 && e.kind === 'note')
    .map(e => e.pitches.map(p => p.absolutePitch)), [[53], [46,58], [46,52], [45,53], [44,56]]);
  const entry = facts.events.find(e => e.voice === 'upper' && e.bar === 2 && e.kind === 'note')!;
  assert.deepEqual(entry.pitches.map(p => p.absolutePitch), [56]);
  assert.deepEqual(facts.occurrenceTies!.filter(t => t.toId === entry.id).map(t => [t.pitch, t.fromId.split(':')[1]]),
    [[56, facts.events.find(e => e.bar === 1 && e.pitches.length === 2)!.line.toString()],
      [56, facts.events.find(e => e.bar === 3 && e.pitches.length === 2)!.line.toString()]]);
});

test('literal official-rule incoming repeat tie connects both passes independently of an outgoing ending mark', () => {
  const { facts, score } = importSchumann(fixture(upper, lower), identity);
  assert.deepEqual(facts.bars.map(b => b.duration), ['1', '1', '1', '3/4']);
  assert.deepEqual(facts.occurrences.map(o => [o.sourceBar, o.pass]), [[0,1],[1,1],[2,1],[1,2],[3,2]]);
  const incoming = facts.occurrenceTies!.filter(e => e.toId.includes('aes') || e.toId === facts.events.find(e => e.bar === 1)?.id);
  const entry = facts.events.find(e => e.bar === 1 && e.pitches.length === 1)!;
  assert.deepEqual(facts.occurrenceTies!.filter(e => e.toId === entry.id).map(e => [e.pitch,e.fromId,e.toTick]),
    [[56, facts.events.find(e => e.bar === 0 && e.pitches.length === 2)!.id, 192],
      [56, facts.events.find(e => e.bar === 2 && e.pitches.length === 2)!.id, 576]]);
  assert.ok(incoming.length >= 2);
  assert.equal(facts.occurrenceTies!.filter(e => e.toId === entry.id && e.pitch === 44).length, 0);
  assert.equal(facts.occurrenceTies!.filter(e => e.fromId.includes('literal-no30.ly')).length, 6);
  assert.equal(facts.writtenMarks!.filter(m => m.mark === 'incoming-repeat-tie').length, 1);
  assert.equal(facts.writtenMarks!.filter(m => m.mark === 'laissez-vibrer').length, 2);
  assert.equal(score.tieChains?.filter(c => c.components.length > 1).length, 6);
  assert.equal(score.notes.filter(n => n.id.includes(facts.events.find(e => e.bar === 0 && e.pitches.length === 2)!.id) && n.durationTicks > 96).length, 1);
  assert.ok(score.notes.every(n => Number.isSafeInteger(n.startTick) && Number.isSafeInteger(n.durationTicks)));
});

test('dangling incoming tie, wrong voice/pitch, unknown music, and unguarded hidden carrier fail closed', () => {
  const base = fixture(upper, lower);
  assert.throws(() => importSchumann(base.replace('aes\'2\\repeatTie', 'bes2\\repeatTie'), identity), /Incoming repeat tie/);
  assert.throws(() => importSchumann(fixture(String.raw`aes1 | aes1 |`, String.raw`s1 | aes1\repeatTie |`), identity),
    /Incoming repeat tie has no adjacent same-voice pitch/);
  assert.throws(() => importSchumann(base.replace('aes\'2\\repeatTie', 'aes\'2\\repeatTie \\unknownMusic'), identity), /literal-no30.ly:\d+:\d+ \[upper\].*unknownMusic/);
  assert.throws(() => importSchumannNo30(base), /Unapproved.*hash/);
  const hiddenFixture = fixture(String.raw`s1 |`, String.raw`<< { \change Staff = "Staff_pfUpper" \hideNotes a2 \unHideNotes r2 | } \\ { s1 | } >>`);
  assert.throws(() => importSchumann(hiddenFixture, identity), /Unclassified hidden note/);
  assert.throws(() => importSchumann(String.raw`\score { \unknownScore { c4 } }`, identity), /literal-no30.ly:\d+:\d+ \[score\].*unknownScore/);
  assert.throws(() => importSchumann(String.raw`\score { \new Staff = "Staff_pfUpper" { \unknownStaff \relative c' { c1 | } } }`, identity),
    /literal-no30.ly:\d+:\d+ \[upper\].*unknownStaff/);
  assert.deepEqual(importSchumann('#(error "inert")\n' + base, identity).score.notes.map(n => [n.startTick,n.durationTicks,n.pitch]),
    importSchumann(base, identity).score.notes.map(n => [n.startTick,n.durationTicks,n.pitch]));
});

test('approved whole source: each repeat/ending, voice, hidden classification and generated facts are deterministic', () => {
  const facts = schumannNo30WrittenFacts;
  const score = buildSchumannNo30Draft();
  assert.equal(facts.events.length, 469);
  assert.equal(facts.bars.length, 34);
  assert.equal(facts.occurrences.length, 49);
  assert.deepEqual(facts.repeats, [{ start: 17, end: 31, alternatives: [[32], [33]] }]);
  assert.deepEqual(facts.bars.map(b => b.duration), ['1/4', ...Array(32).fill('1'), '3/4']);
  assert.equal(score.notes.length, 717);
  // Each of the four logical voices owns its own written bar clock, including
  // the phantom half's duration and the shortened second ending.
  const ticks = (s: string) => { const [n, d = '1'] = s.split('/'); const value = 192 * Number(n) / Number(d);
    assert.ok(Number.isSafeInteger(value)); return value; };
  for (const voice of new Set(facts.events.map(e => e.voice))) for (const bar of facts.bars) {
    const local = facts.events.filter(e => e.voice === voice && e.bar === bar.number);
    assert.ok(local.length, `${voice} missing written bar ${bar.number}`);
    assert.equal(local.reduce((total, e) => total + ticks(e.duration), 0), ticks(bar.duration),
      `${voice} source bar ${bar.number} clock`);
  }
  assert.equal(score.totalTicks, 9216);
  assert.equal(facts.expressionSpacers?.length, 58);
  assert.equal(facts.expressionSpacers?.at(-1)?.bar, 33);
  assert.equal(facts.expressionSpacers?.reduce((total, e) => total + ticks(e.duration), 0), 33 * 192);
  assert.equal(facts.occurrenceTies!.length, 28);
  assert.equal(score.tieChains?.length, 28);
  const entry = facts.events.find(e => e.line === 113 && e.voice === 'upper.0')!;
  const entryEdges = facts.occurrenceTies!.filter(t => t.toId === entry.id);
  assert.deepEqual(entryEdges.map(t => [t.pitch, Number(t.fromId.split(':')[1]), t.toTick]), [[56,110,3120],[56,131,6192]]);
  const preChord = facts.events.find(e => e.line === 110 && e.voice === 'upper.0')!;
  assert.deepEqual(preChord.pitches.map(p => [p.spelling,p.absolutePitch]), [['aes',44],["aes'",56]]);
  assert.deepEqual(score.notes.filter(n => n.id.includes(preChord.id)).map(n => n.durationTicks), [96,192]);
  const partial = facts.occurrenceTies!.filter(t => t.fromId.includes(':114:18:'));
  assert.deepEqual(partial.map(t => t.pitch), [56,56]);
  assert.deepEqual(facts.occurrenceTies!.filter(t => t.fromId.includes(':127:195:')).map(t => t.pitch), [50,62,50,62]);
  const hidden = facts.events.filter(e => e.hidden && e.kind === 'note');
  assert.equal(hidden.length, 1);
  assert.equal(hidden[0].line, 153);
  // Textual second child starts <c f> at C4/F4 (48/53) after the
  // principal child's exit. From its final <f g> anchor F4=53,
  // aes, at l.153 is Ab3=44; repeat entry aes stays 44, not Ab4=56.
  assert.deepEqual(hidden[0].pitches.map(p=>p.absolutePitch),[44]);
  const phantom = facts.events.find(e => e.kind === 'layout-note')!;
  assert.equal(phantom.line, 313);
  assert.equal(phantom.duration, '1/2');
  assert.equal(score.notes.some(n => n.id.includes(phantom.id)), false);
  assert.equal(score.notes.filter(n => n.id.includes(hidden[0].id)).length, 1); // pre-repeat, sounding despite invisibility
  const returningHidden = facts.events.find(e => e.line === 156 && e.pitches[0]?.absolutePitch === hidden[0].pitches[0].absolutePitch)!;
  assert.ok(returningHidden);
  assert.equal(facts.occurrenceTies!.some(e => e.fromId === hidden[0].id && e.toId === returningHidden.id), false);
  assert.equal(score.notes.filter(n => n.id.includes(returningHidden.id)).length, 2);
  assert.equal(score.notes.filter(n => n.startTick === 3024).length >= 2, true); // independent unison voices at the pre-repeat boundary
  const firstEnding = facts.events.filter(e => e.line === 317 && e.voice === 'lower.0');
  const secondEnding = facts.events.filter(e => e.line === 318 && e.voice === 'lower.0');
  assert.deepEqual(firstEnding.map(e => [e.kind, e.duration]), [['note','1/8'],['note','1/8'],['note','1/8'],['note','1/8'],['note','1/4'],['rest','1/4']]);
  assert.deepEqual(secondEnding.map(e => [e.kind, e.duration]), firstEnding.slice(0,5).map(e => [e.kind,e.duration]));
  assert.ok(schumannNo30DeferredLedger.some(d => d.construct === 'a2' && d.effect.includes('carrier')));
  assert.ok(schumannNo30DeferredLedger.every(d => !d.blocking));
  assert.ok(score.sourceSilences?.some(s => s.bar === 32 && s.kind === 'rest'));
});

test('complete Candidates card is real-engine full pages and retains geometric diagnostics', () => {
  const entry = createStudioConfig().scores['schumann-op68-no30'];
  const card = CURRENT_CANDIDATES.find(c => c.id === 'schumann-no30-written-draft');
  assert.ok(card?.windows?.some(w => 'fullScore' in w && w.fullScore && w.measureCount === 49));
  assert.match(renderJankoCrop(entry.score, 17, 2, entry.options, entry.tokens), /<svg/);
  const pages = countJankoPages(entry.score, entry.options, entry.tokens);
  const lint = lintJankoScore(entry.score, entry.options, entry.tokens);
  console.log(`No30 pages=${pages}; geometry violations=${lint.violations.length}, warnings=${lint.warnings.length}; classes=${JSON.stringify(lint.violations.reduce((m,v) => ({...m,[v.code]: (m[v.code] ?? 0) + 1}), {} as Record<string, number>))}`);
  console.log(`No30 geometry examples=${JSON.stringify([...new Map(lint.violations.map(v => [v.code, v.message])).entries()])}`);
  assert.ok(pages > 0);
  assert.ok(Array.isArray(lint.violations));
});
