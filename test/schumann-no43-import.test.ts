import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

// Behavioral seam for the first written-source import. The implementation may
// rename/reorganize its internal parser and rational types; only this adapter
// and the assertions' field access should be reconciled with that public seam.
// The literal inputs/expected musical facts below are independent of the importer.
import { importSchumannNo43, type DeferredFact } from '../src/scores/schumann-no43';
import { schumannNo43DeferredLedger } from '../src/scores/schumann-no43-draft';
import { linearIndex } from '../src/model/pitch';
import { CURRENT_CANDIDATES } from '../src/render/janko/candidates';
import { createStudioConfig } from '../src/render/janko/studio';
import { renderJankoCrop } from '../src/render/janko/engine';

const file = 'hand-authored-no43-fixture.ly';
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

// Each printed fingering must remain attributable to its chord member, even
// when the engine cannot draw it. A source span covering the finger numeral
// distinguishes it from the next chord member or an unrelated attachment.
function assertDeferredFinger(ledger: DeferredFact[], line: number, digitColumn: number, finger: number) {
  assert.ok(ledger.some((fact) => fact.line === line && fact.column <= digitColumn &&
    fact.endLine === line && fact.endColumn > digitColumn &&
    fact.construct.includes(String(finger)) && /finger/i.test(`${fact.reason} ${fact.effect}`) &&
    fact.blocking === false && fact.voice && fact.file && fact.reason && fact.effect),
  `fingering ${finger} at ${line}:${digitColumn} must have its own source-linked deferred fact`);
}

// Written pickup + relative chord spelling + only two tied chord members.
// At 48 quarter-ticks: pickup [0,24), first full bar [24,216).
const CHORD_SOURCE = String.raw`\score {
  \new PianoStaff <<
    \new Staff { \relative c' {
      \time 4/4 \partial 8 e8 |
      <e gis cis'>4 ~ <e a cis'>4 <e a cis'>4 r4 |
    } }
  >>
}`;

// Two logical voices share a written onset and the same pitch; the spacer in
// voice 2 is not an authored rest. One hidden note is MUSIC, whereas a once
// NoteColumn override is layout, not a second attack. Input Scheme is data.
const VOICES_SOURCE = String.raw`\score {
  \new PianoStaff <<
    \new Staff { \relative c' {
      \time 4/4
      << { \voiceOne c4 d4 e4 f4 | }
         \context Voice = "1" { \voiceTwo c4 s4 \once \override NoteColumn #'force-hshift = #-0.7 \hideNotes e4 \unHideNotes r4 | } >>
    } }
  >>
}`;

// One volta body, two distinct written endings; the final second ending is
// genuinely shorter than the 4/4 bar and must not acquire a fabricated rest.
const REPEAT_SOURCE = String.raw`\score {
  \new PianoStaff <<
    \new Staff { \relative c' {
      \time 4/4 \partial 8 e8 |
      c1 | \repeat volta 2 { d1 | }
      \alternative { { e1 | } { f2. | } }
      \bar "|."
    } }
  >>
}`;

test('source identity, rational onset, relative chord spelling and partial ties survive projection', () => {
  const first = importSchumannNo43(CHORD_SOURCE, file);
  assert.deepEqual(importSchumannNo43(CHORD_SOURCE, file), first, 'identical bytes/config produce identical facts and draft');
  assert.equal(first.facts.sourceHash, sha256(CHORD_SOURCE));
  assert.equal(first.facts.pickup, '1/8');
  const attacks = first.facts.events.filter((e) => e.kind === 'note');
  assert.deepEqual(
    attacks.map((e) => [e.onset, e.duration, e.pitches.map((p) => [p.spelling, p.absolutePitch])]),
    [
      ['0', '1/8', [['e', 52]]],
      ['1/8', '1/4', [['e', 52], ['gis', 56], ["cis'", 61]]],
      ['3/8', '1/4', [['e', 52], ['a', 57], ["cis'", 61]]],
      ['5/8', '1/4', [['e', 52], ['a', 57], ["cis'", 61]]],
    ],
    'explicit expected pitch identities, not a parser-produced snapshot'
  );
  assert.deepEqual(
    first.facts.ties.map((t) => [t.fromPitch, t.toPitch]),
    [[52, 52], [61, 61]],
    'G sharp releases and A reattacks; only E and C sharp continue'
  );
  assert.deepEqual(first.facts.events.filter((e) => e.kind === 'rest').map((e) => [e.onset, e.duration]), [['7/8', '1/4']]);
  assert.equal(first.score.ticksPerBeat > 0 && Number.isInteger(first.score.ticksPerBeat), true);
  const quarter = first.score.ticksPerBeat;
  assert.deepEqual(
    first.score.notes.map((n) => [n.startTick, n.durationTicks, linearIndex(n.pitch)]).sort((a, b) => a[0] - b[0] || a[2] - b[2]),
    [
      [0, quarter / 2, 52],
      [quarter / 2, quarter * 2, 52], [quarter / 2, quarter, 56], [quarter / 2, quarter * 2, 61],
      [quarter * 1.5, quarter, 57],
      [quarter * 2.5, quarter, 52], [quarter * 2.5, quarter, 57], [quarter * 2.5, quarter, 61],
    ],
    'tied members sustain instead of creating new attacks at their continuation'
  );
  assert.equal(first.score.totalTicks, quarter * 4.5);
  for (const n of first.score.notes) {
    assert.ok(Number.isSafeInteger(n.startTick) && Number.isSafeInteger(n.durationTicks), n.id);
    assert.ok(n.durationTicks > 0, n.id);
  }
  assert.ok(attacks.every((e) => Number.isInteger(e.line) && Number.isInteger(e.column)), 'source locations on each written event');
  assert.equal(new Set(attacks.map((e) => e.id)).size, attacks.length, 'source-linked IDs distinguish written onsets');
});

test('simultaneous unison voices, authored silence, spacer, hidden music and inert layout stay distinguishable', () => {
  const { facts, score } = importSchumannNo43(VOICES_SOURCE, file);
  const atStart = facts.events.filter((e) => e.kind === 'note' && e.onset === '0');
  assert.equal(atStart.length, 2);
  assert.notEqual(atStart[0].voice, atStart[1].voice);
  assert.notEqual(atStart[0].id, atStart[1].id);
  assert.deepEqual(atStart.map((e) => e.pitches[0].absolutePitch), [48, 48]);
  const projectedUnison = score.notes.filter((n) => n.startTick === 0 && linearIndex(n.pitch) === 48);
  assert.equal(projectedUnison.length, 2);
  assert.equal(new Set(projectedUnison.map((n) => n.voice)).size, 2, 'independent source voices stay independent in the grid score');
  assert.deepEqual(new Set(projectedUnison.flatMap((n) => n.sourceProvenance?.voices ?? [])), new Set(atStart.map((e) => e.voice)));
  assert.deepEqual(facts.events.filter((e) => e.kind === 'spacer').map((e) => [e.onset, e.duration]), [['1/4', '1/4']]);
  assert.deepEqual(facts.events.filter((e) => e.kind === 'rest').map((e) => [e.onset, e.duration]), [['3/4', '1/4']]);
  assert.deepEqual(score.sourceSilences?.map((s) => [s.kind, s.startTick, s.durationTicks]),
    [['skip', score.ticksPerBeat, score.ticksPerBeat], ['rest', score.ticksPerBeat * 3, score.ticksPerBeat]],
    'authored silence and spacer retain their different meanings and exact timing');
  const hidden = facts.events.filter((e) => e.kind === 'note' && e.hidden);
  assert.deepEqual(hidden.map((e) => [e.onset, e.pitches[0].absolutePitch]), [['1/2', 52]]);
  assert.ok(score.notes.some((n) => n.startTick === score.ticksPerBeat * 2 && linearIndex(n.pitch) === 52), 'hidden musical note is not discarded');
});

test('written volta graph and unfolded occurrences retain source bar identity, shortened ending and exact integer ticks', () => {
  const { facts, score } = importSchumannNo43(REPEAT_SOURCE, file);
  assert.deepEqual(facts.bars.map((b) => [b.number, b.duration]), [[0, '1/8'], [1, '1'], [2, '1'], [3, '1'], [4, '3/4']]);
  assert.deepEqual(facts.occurrences.map((o) => o.sourceBar), [0, 1, 2, 3, 2, 4]);
  assert.deepEqual(facts.occurrences.map((o) => o.pass), [1, 1, 1, 1, 2, 2]);
  assert.deepEqual(facts.occurrences.map((o) => o.onset), ['0', '1/8', '9/8', '17/8', '25/8', '33/8']);
  assert.equal(score.totalTicks, score.ticksPerBeat * (0.5 + 4 * 4 + 3), 'unfolded duration, with no padded final bar');
  assert.deepEqual(score.notes.map((n) => linearIndex(n.pitch)), [52, 48, 50, 52, 50, 53]);
  assert.equal(new Set(score.notes.map((n) => n.id)).size, score.notes.length, 'repeat occurrences cannot share projected note IDs');
  for (const note of score.notes) {
    assert.ok(Number.isSafeInteger(note.startTick) && Number.isSafeInteger(note.durationTicks));
  }
});

test('actual No.43 draft is registered only in Candidates and engraves with the real engine', () => {
  const config = createStudioConfig();
  const entries = Object.values(config.scores).filter((entry) => /schumann|no.?43/i.test(entry.id));
  assert.equal(entries.length, 1, 'a registered No.43 score, not an isolated importer skeleton');
  const { id, score, options, tokens } = entries[0];
  assert.ok(score.notes.length > 0);
  const windows = CURRENT_CANDIDATES.flatMap((candidate) => candidate.windows ?? []).filter((window) => 'scoreId' in window && window.scoreId === id);
  assert.ok(windows.some((w) => 'measureStart' in w && w.measureStart === 1), 'opening inspectable in Candidates');
  assert.ok(windows.some((w) => 'measureStart' in w && w.measureStart > 1), 'later passage/ending inspectable in Candidates');
  assert.match(CURRENT_CANDIDATES.filter((c) => (c.windows ?? []).some((w) => 'scoreId' in w && w.scoreId === id)).map((c) => [c.label, c.description, ...(c.windows ?? []).map((w) => w.caption)].join(' ')).join(' '), /draft[\s\S]*unfolded repeats/i);
  assert.match(renderJankoCrop(score, 1, 1, options, tokens), /<svg/);
  assert.equal(config.scores['brahms-op118-no1'].score.id, 'brahms-op118-no1');
});

test('unsupported expression is retained as a located, nonblocking display omission, not musical loss', () => {
  const source = String.raw`\score { \new Staff { \relative c' { \time 4/4 c4^\fermata d4 e4 f4 | } } }`;
  const { facts, ledger, score } = importSchumannNo43(source, file);
  assert.ok(facts.events.some((e) => e.kind === 'note' && e.onset === '0' && e.pitches[0].absolutePitch === 48));
  assert.equal(score.notes.length, 4, 'the unsupported display mark does not drop its note');
  assert.ok(ledger.some((entry) => /fermata/i.test(entry.construct) && entry.blocking === false && entry.line > 0 && entry.column > 0 && entry.reason && entry.effect), 'fermata remains source-linked and its omission is explained');
});

test('chord-member fingerings stay attached to their source sites, including in the approved derived ledger', () => {
  const source = String.raw`\score { \new Staff { \relative c' {
    \time 4/4 <e^4 g_2 c'>4 d4 e4 f4 |
  } } }`;
  const { facts, ledger, score } = importSchumannNo43(source, file);
  assert.deepEqual(facts.events.filter(e => e.kind === 'note')[0].pitches.map(p => p.absolutePitch), [52, 55, 60]);
  assert.equal(score.notes.length, 6, 'deferred member fingering must not remove chord pitches');
  const chordLine = source.split('\n')[1];
  assertDeferredFinger(ledger, 2, chordLine.indexOf('^4') + 2, 4);
  assertDeferredFinger(ledger, 2, chordLine.indexOf('_2') + 2, 2);
  // These are independent fixed sites in the operator-approved source, not
  // expected values generated from the importer's output.
  assertDeferredFinger(schumannNo43DeferredLedger, 92, 50, 4); // <fis a cis^4>
  assertDeferredFinger(schumannNo43DeferredLedger, 104, 73, 5); // <a e' fis^5>
});

test('source Scheme is inert data and cannot change written music', () => {
  const inputWithScheme = `#(error "must not be evaluated")\n${CHORD_SOURCE}`;
  const plain = importSchumannNo43(CHORD_SOURCE, file);
  const withScheme = importSchumannNo43(inputWithScheme, file);
  assert.notEqual(withScheme.facts.sourceHash, plain.facts.sourceHash, 'the added source bytes still affect identity');
  assert.deepEqual(withScheme.facts.events.map((e) => [e.kind, e.onset, e.duration, e.pitches]),
    plain.facts.events.map((e) => [e.kind, e.onset, e.duration, e.pitches]));
  assert.deepEqual(withScheme.score.notes.map((n) => [n.startTick, n.durationTicks, linearIndex(n.pitch)]),
    plain.score.notes.map((n) => [n.startTick, n.durationTicks, linearIndex(n.pitch)]));
});

test('unknown musical constructs fail closed in music, staff wrapper and score traversal', () => {
  const sources = [
    String.raw`\score { \new Staff { \relative c' { \time 4/4 c4 \unknownMusic d4 e4 f4 | } } }`,
    String.raw`\score { \new Staff { \unknownMusic \relative c' { \time 4/4 c1 | } } }`,
    String.raw`\score { \unknownMusic \new Staff { \relative c' { \time 4/4 c1 | } } }`,
  ];
  for (const source of sources) assert.throws(
    () => importSchumannNo43(source, file),
    (error: unknown) => {
      const message = String(error);
      assert.match(message, /unknownMusic/);
      assert.match(message, /hand-authored-no43-fixture\.ly:\d+:\d+/);
      assert.match(message, /\[[^\]]+\]/, 'diagnostic identifies the parsing context');
      return true;
    }
  );
});
