import { test } from 'node:test';
import assert from 'node:assert/strict';
import { importSchumann } from '../src/scores/schumann-no43';
import { schumannNo43WrittenFacts } from '../src/scores/schumann-no43-draft';
const identity = { number: 14 as const, file: 'unfamiliar.ly', hash: 'fixture' };
const parse = (body: string) => importSchumann(String.raw`\score { \new Staff { \relative c' { \time 6/8 ${body} } } }`, identity);
for (const separator of [String.raw`\\`, String.raw`\context Voice = "other"`]) {
  test(`relative traversal is textual but simultaneous clocks remain parallel: ${separator}`, () => {
    // c' = C4=48. First child ends G4=55; c,, from G4 is C3=36,
    // ending E4=52. Parent e' therefore E5=64, not branch-zero E6.
    const result = parse(String.raw`<< { c8 e g } ${separator} { c,,8 g' e' } >> e'8 c g |`);
    assert.deepEqual(result.facts.events.map(e => e.pitches[0].absolutePitch), [48,52,55,36,43,52,64,60,55]);
    assert.deepEqual(result.score.notes.map(n => n.startTick), [0,24,48,0,24,48,72,96,120]);
  });
}
test('approved No43 named voices retain independently calculated source pitches', () => {
  const notes = schumannNo43WrittenFacts.events.filter(e => e.kind === 'note');
  // Upper principal ends <cis e a>, first-member anchor C#4=49.
  // Textual Voice 1 begins fis8. e16 (54,52); its clocks still start
  // at written bar 2. Lower principal ends <a e'>, anchor A2=33;
  // Voice 1's first a'8 e a, therefore A3/E3/A2 (45,40,33).
  assert.deepEqual(notes.filter(e => e.voice === 'upper."1"').slice(0,2).map(e => e.pitches[0].absolutePitch), [54,52]);
  assert.deepEqual(notes.filter(e => e.voice === 'lower."1"').slice(0,3).map(e => e.pitches[0].absolutePitch), [45,40,33]);
});

test('nested relative scope is isolated from its containing relative traversal', () => {
  const result = parse(String.raw`c8 \relative c'' { g8 a } d8 e f |`);
  assert.deepEqual(result.facts.events.map(e => e.pitches[0].absolutePitch), [48,55,57,50,52,53]);
  assert.deepEqual(result.score.notes.map(n => n.startTick), [0,24,48,72,96,120]);
});
