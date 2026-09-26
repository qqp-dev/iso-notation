import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBrahmsOp118No1Score, BRAHMS_OP118_NO1_JANKO_OPTIONS, BRAHMS_OP118_NO1_JANKO_TOKENS } from '../src/scores/brahms-op118-no1';
import { layoutJankoScore } from '../src/render/janko/engine';

// Literal ownership fixtures for guarded inspection/target resolution. Coordinates and
// transient layout IDs deliberately do not participate in a persistent target.
test('literal Brahms long marks retain their complete owner sets and distinct duration grammar', () => {
  const score = buildBrahmsOp118No1Score();
  const layouts = layoutJankoScore(score, BRAHMS_OP118_NO1_JANKO_OPTIONS, BRAHMS_OP118_NO1_JANKO_TOKENS);
  const marks = layouts.flatMap(layout => layout.durationInkOwners);
  const ids = (...numbers: number[]) => numbers.map(n => `brahms-op118-no1-${n}`).sort();
  const at = (tick: number, owners: string[]) => marks.filter(mark => mark.tick === tick &&
    mark.ownerIds.length === owners.length && owners.every(id => mark.ownerIds.includes(id)));
  const bracket1 = at(48, ids(4, 6));
  assert.equal(bracket1.length, 1, 'm. 1: a shared bracket states #4 and #6, not neighbouring #5');
  assert.equal(bracket1[0].mount, 'bracket');
  assert.equal(bracket1[0].run, 'half-ring');
  assert.ok(!bracket1[0].ownerIds.includes(ids(5)[0]));
  const held15 = score.notes.find(note => note.id === ids(15)[0]);
  assert.ok(held15, 'm. 2 tied note #15 remains in the literal score');
  const continuation = layouts.flatMap(layout => layout.notes).find(placed => placed.note.id === 'brahms-op118-no1-15~c1');
  assert.equal(continuation?.note.startTick, 240);
  assert.equal(continuation?.note.durationTicks, 144, 'the tied continuation is written as a dotted half');
  assert.equal(continuation?.note.pitch.pitchClass, 9, 'm. 2 pitch 9 continues on its written tie');
  assert.ok(marks.some(mark => mark.tick === 240 && mark.mount === 'carrier' &&
    mark.run === 'half-ring' && mark.ownerIds.includes(continuation!.note.id)),
    'm. 2 dotted 144 statement uses a horizontal half carrier, not a full circle');
  assert.ok(!marks.some(mark => mark.tick === 240 && mark.mount === 'bracket' && mark.ownerIds.includes(continuation!.note.id)),
    'm. 2: the exceptional continuation is not a bracket');
  const bracket5 = at(816, ids(48, 49, 50));
  assert.equal(bracket5.length, 1, 'm. 5: all three owners share the half bracket');
  assert.equal(bracket5[0].mount, 'bracket');
  assert.equal(bracket5[0].run, 'half-ring');
  const shared9 = at(1584, ids(117, 118));
  assert.equal(shared9.length, 1, 'm. 9: a single full ring states both owners');
  assert.equal(shared9[0].run, 'ring');
  assert.equal(shared9[0].shared, true);
  for (const n of [117, 118]) assert.equal(score.notes.find(note => note.id === ids(n)[0])?.durationTicks, 192);
});
