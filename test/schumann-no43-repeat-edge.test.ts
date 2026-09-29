import { test } from 'node:test';
import assert from 'node:assert/strict';
import { importSchumannNo43 } from '../src/scores/schumann-no43';
import { linearIndex } from '../src/model/pitch';
import { buildSchumannNo43Draft, schumannNo43WrittenFacts } from '../src/scores/schumann-no43-draft';

// Independent authored expectation: the tie at the first ending's *textual*
// close points to the repeat body's first note on pass two, not to ending two.
test('first-ending tie continues into the second pass without a duplicate attack', () => {
  const source = String.raw`\score { \new Staff { \relative c' {
    \time 4/4 c1 | \repeat volta 2 { e1 | }
    \alternative { { e1 ~ | } { f1 | } }
  } } }`;
  const { facts, score } = importSchumannNo43(source, 'repeat-edge.ly');
  assert.deepEqual(facts.occurrences.map(o => o.sourceBar), [0, 1, 2, 1, 3]);
  assert.deepEqual(facts.ties.map(t => [t.fromPitch, t.toPitch]), [[52, 52]]);
  assert.deepEqual(score.notes.map(n => [n.startTick, n.durationTicks, linearIndex(n.pitch)]),
    [[0, 192, 48], [192, 192, 52], [384, 384, 52], [768, 192, 53]]);
  assert.deepEqual((score.tieChains ?? []).map(c => c.components.map(p => [p.startTick, p.durationTicks])),
    [[[384, 192], [576, 192]]]);
});

test('approved source keeps the audible hidden G, not the two source-guarded shape-only heads', () => {
  const facts = schumannNo43WrittenFacts.events;
  assert.deepEqual(facts.filter(e => e.kind === 'layout-note').map(e => [e.line, e.column, e.pitches[0].absolutePitch]),
    [[132, 47, 45], [143, 171, 52]]);
  const audibleHidden = facts.filter(e => e.hidden && e.kind === 'note');
  assert.deepEqual(audibleHidden.map(e => [e.line, e.pitches[0].absolutePitch]), [[130, 43]]);
  const score = buildSchumannNo43Draft();
  for (const layout of facts.filter(e => e.kind === 'layout-note'))
    assert.ok(!score.notes.some(n => n.id.startsWith(`${layout.id}:`)));
  assert.ok(score.notes.some(n => n.id.startsWith(`${audibleHidden[0].id}:`)));
});
