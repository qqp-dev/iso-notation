import assert from 'node:assert/strict';
import test from 'node:test';
import { importSchumann } from '../src/scores/schumann-no43';

const identity = { file: 'literal-slurs.ly', hash: '', number: 13 as const };
const source = (body: string, staff = 'upper') => String.raw`\score { \new PianoStaff << ${staff === 'lower' ? String.raw`\new Staff = "upper" { \relative c' { \time 2/4 s2 | } }` : ''} \new Staff = "${staff}" { \relative c' { \time 2/4 ${body} } } >> }`;
const parse = (body: string, staff?: string) => importSchumann(source(body, staff), identity);

test('ordinary slurs retain explicit above/below source attachments and absent direction', () => {
  for (const [attachment, side] of [['^(', 'above'], ['_(', 'below'], ['(', undefined]] as const) {
    const text = source(`c4${attachment} d4) |`);
    const result = importSchumann(text, identity);
    const written = result.facts.phrases[0], projected = result.score.phrases![0];
    assert.equal(written.kind, 'slur');
    assert.equal(written.sourceSide, side);
    assert.equal(projected.sourceSide, side);
    assert.deepEqual([projected.startTick, projected.endTick], [0, 48]);
    if (side) {
      assert.equal(written.sourceSideOrigin!.column, text.indexOf(attachment) + 1);
      assert.equal(projected.sourceSideOrigin!.col, text.indexOf(attachment) + 1);
      assert.equal(projected.sourceSideOrigin!.context, projected.voice);
    } else assert.equal(projected.sourceSideOrigin, undefined);
    const musical = (n: (typeof result.score.notes)[number]) =>
      [n.pitch, n.startTick, n.durationTicks, n.hand, n.voice, n.sourceProvenance];
    assert.deepEqual(result.score.notes.map(musical), parse('c4 d4 |').score.notes.map(musical));
  }
});

test('literal concurrent quarter/eighth slurs retain two same-hand paths and source values', () => {
  const { facts, score } = parse(String.raw`<< { b8^( fis'8 e8) s8 | } \\ { b4_( e8) s8 | } >> |`, 'lower');
  assert.deepEqual(facts.phrases.map(p => [p.start.context, p.sourceSide]), [['lower.0', 'above'], ['lower.1', 'below']]);
  assert.deepEqual(score.phrases!.map(p => [p.voice, p.startTick, p.endTick, p.sourceSide]),
    [['lower.0', 0, 48, 'above'], ['lower.1', 0, 48, 'below']]);
  assert.notEqual(score.phrases![0].fromNoteIds[0], score.phrases![1].fromNoteIds[0]);
  assert.notEqual(score.phrases![0].toNoteIds[0], score.phrases![1].toNoteIds[0]);
  assert.ok(score.notes.every(n => n.hand === 'LH'));
  assert.deepEqual(score.notes.map(n => [n.pitch.octave * 12 + n.pitch.pitchClass, n.startTick, n.durationTicks]),
    [[47, 0, 24], [54, 24, 24], [52, 48, 24], [47, 0, 48], [52, 48, 24]]);
});

test('ordinary slurs and escaped phrasing spans remain distinct at overlapping source notes', () => {
  const { score } = parse(String.raw`c8^( d8\( e8) f8\) |`);
  assert.deepEqual(score.phrases!.map(p => [p.kind, p.startTick, p.endTick, p.sourceSide]),
    [['slur', 0, 48, 'above'], ['phrasing', 24, 72, undefined]]);
});

test('ordinary slur occurrences follow paired repeat-body and alternative source spans', () => {
  const { score } = parse(String.raw`\repeat volta 2 { c4^( d4) | } \alternative { { e4( f4) | } { g4_( a4) | } }`);
  assert.deepEqual(score.phrases!.map(p => [p.startTick, p.endTick, p.origin.occurrence, p.sourceSide]),
    [[0, 48, 1, 'above'], [192, 240, 2, 'above'], [96, 144, 1, undefined], [288, 336, 1, 'below']]);
  assert.equal(new Set(score.phrases!.map(p => p.id)).size, 4);
});

test('grace source endpoints remain deferred without stealing a later ordinary slur', () => {
  const result = parse(String.raw`\grace { b16^( } c4)_( d4) |`);
  assert.equal(result.score.phrases!.length, 1);
  assert.equal(result.score.phrases![0].sourceSide, 'below');
  assert.deepEqual([result.score.phrases![0].startTick, result.score.phrases![0].endTick], [0, 48]);
  assert.ok(result.ledger.some(f => /Grace slur endpoint deferred/.test(f.effect) && f.construct.includes('c4)')));
  assert.deepEqual(result.score.notes.map(n => n.startTick), [0, 48]);
});

test('hidden stencil and double-slur layouts remain precise source omissions', () => {
  for (const body of [String.raw`\once \override Slur #'stencil = ##f c4( d4) |`,
    String.raw`\set doubleSlurs = ##t c4( \unset doubleSlurs d4) |`]) {
    const result = parse(body);
    assert.equal(result.score.phrases!.length, 0);
    assert.equal(result.score.notes.length, 2);
    assert.ok(result.ledger.some(f => /Hidden source slur|Double-slur/.test(f.effect) && f.construct.includes('d4)')));
  }
});

test('a first-ending-only closure is not fabricated on the second repeat route', () => {
  const result = parse(String.raw`\repeat volta 2 { c4 d4( | } \alternative { { e2) | } { f2 | } }`);
  assert.equal(result.facts.phrases.length, 1);
  assert.equal(result.score.phrases!.length, 1);
  assert.deepEqual([result.score.phrases![0].startTick, result.score.phrases![0].endTick], [48, 96]);
  assert.ok(result.ledger.some(f => /closure unresolved.*occurrence 2/.test(f.effect)));
});

test('malformed supported slurs fail with source context instead of changing voices', () => {
  for (const [body, error] of [['c4 d4) |', /Unopened phrase/], ['c4( d4 |', /Unclosed phrase/],
    ['( c4 d4 |', /Phrase endpoint has no note/], ['c4( d4( |', /Nested phrase/]] as const) {
    assert.throws(() => parse(body), new RegExp(`literal-slurs\\.ly:.*\\[upper\\].*${error.source}`));
  }
  assert.throws(() => parse(String.raw`<< { c4( d4 | } \\ { c4 d4) | } >> |`), /\[upper\.1\].*Unopened phrase/);
});
