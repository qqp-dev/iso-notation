import { test } from 'node:test';
import assert from 'node:assert/strict';
import provenance from '../src/scores/data/brahms-op118-no1-written-durations.provenance.json' with { type: 'json' };
import { buildBrahmsOp118No1Score } from '../src/scores/brahms-op118-no1';
import { projectCandidate } from '../src/render/janko/semantic-hand';
import { buildBrahmsSemanticIndex, editableBrahmsSound, linkedBrahmsNotes, statementKey } from '../src/scores/brahms-semantic-index';
import type { BrahmsProvenanceEvent } from '../src/scores/brahms-source-fidelity';
const source = provenance.events as unknown as BrahmsProvenanceEvent[];
const score = buildBrahmsOp118No1Score();
const event = (tick: number, pc: number, octave: number, hand?: string) => {
  const matches = source.filter(e => e.startTick === tick && e.pitchClass === pc && e.octave === octave && (!hand || e.hand === hand));
  assert.equal(matches.length, 1, `independent pinned-source witness at ${tick}/${pc}/${octave}/${hand}`);
  return matches[0];
};

test('source inventory preserves every voice statement and engine witness without assuming one voice per sound', () => {
  const index = buildBrahmsSemanticIndex(score);
  assert.equal(source.length, 964);
  assert.equal(index.sounds.length, 964);
  assert.equal(index.sounds.filter(s => s.noteRef).length, 964);
  assert.equal(new Set(index.sounds.map(s => s.noteRef?.id)).size, 964);
  assert.equal(index.sounds.reduce((sum,s) => sum+s.components.length,0), source.reduce((sum,e) => sum+e.segments.length,0));
  assert.equal(source.filter(e => e.unison).length, 57);
  for (const e of source) {
    const sound = index.sounds.find(s => s.tick === e.startTick && s.pitchClass === e.pitchClass && s.octave === e.octave && s.performedTrackHand === e.hand);
    assert.ok(sound, `${e.startTick}/${e.pitchClass}/${e.octave}/${e.hand}`);
    assert.deepEqual(sound.components.map(c => [c.statement.voice,c.statement.staff,c.tick,c.occurrence]),
      e.segments.map(s => [s.voice,s.staff,s.startTick,s.occurrence]));
    assert.equal(sound.durationTicks, e.durationTicks);
  }
  const first = event(240,0,4);
  const origin = index.sounds.find(s => s.tick === 240 && s.pitchClass === 0 && s.octave === 4)!;
  assert.equal(index.forStatement(statementKey(first.segments[0])).length, 2);
  assert.deepEqual(linkedBrahmsNotes(index, origin, score).map(n => n.id), ['brahms-op118-no1-17','brahms-op118-no1-152']);
  const unison = index.sounds.find(s => s.components.length > 1 && new Set(s.components.map(c => c.statement.sourcePartHand)).size > 1);
  assert.ok(unison, 'mixed source hands of a collapsed unison survive');
  assert.equal(unison.components.length, source.find(e => e.startTick === unison.tick && e.pitchClass === unison.pitchClass && e.octave === unison.octave && e.hand === unison.performedTrackHand)!.segments.length);
  assert.throws(() => linkedBrahmsNotes(index, unison, score), /AMBIGUOUS_HAND/);
});

test('candidate index owns the active editorial/display projection without changing performed-track evidence', () => {
  const canonical = buildBrahmsSemanticIndex(score);
  const edited = projectCandidate(score, [
    { id: 'brahms-op118-no1-17', guard: { id: 'brahms-op118-no1-17', pitchClass: 0, octave: 4, tick: 240, expectedHand: 'RH' }, hand: 'LH', citation: 'test' },
    { id: 'brahms-op118-no1-315', guard: { id: 'brahms-op118-no1-315', pitchClass: 0, octave: 4, tick: 4392, expectedHand: 'RH' }, hand: 'LH', citation: 'test' },
  ]);
  const candidate = buildBrahmsSemanticIndex(edited);
  assert.notEqual(candidate.scoreRevision, canonical.scoreRevision);
  assert.equal(candidate.sourceRevision, canonical.sourceRevision);
  for (const id of ['brahms-op118-no1-17', 'brahms-op118-no1-315']) {
    const note = edited.notes.find(n => n.id === id)!;
    const sound = candidate.forNote(id)!;
    const original = canonical.forNote(id)!;
    assert.equal(sound.noteRef?.hand, note.hand);
    assert.equal(sound.displayedHand, 'LH');
    assert.equal(sound.editorialHand, 'LH');
    assert.equal(sound.performedTrackHand, original.performedTrackHand);
    assert.deepEqual(sound.components.map(c => c.key), original.components.map(c => c.key));
  }
  assert.equal(canonical.forNote('brahms-op118-no1-17')?.displayedHand, 'RH');
  assert.equal(candidate.forNote('brahms-op118-no1-17')?.performedTrackHand, 'RH');
  assert.equal(candidate.forNote('brahms-op118-no1-315')?.performedTrackHand, 'LH', 'canonical flip remains performed LH when its candidate display changes');
  const sound = candidate.forNote('brahms-op118-no1-17')!;
  assert.deepEqual(linkedBrahmsNotes(candidate, sound, edited).map(n => n.id), ['brahms-op118-no1-17','brahms-op118-no1-152']);
  assert.throws(() => linkedBrahmsNotes(canonical, canonical.forNote('brahms-op118-no1-17')!, edited), /SCORE_WITNESS.*revision mismatch/);
});

test('event segments prove voice, printed staff and derived source-part hands independently of track/display hands', () => {
  const first = event(240,0,4);
  const edited = projectCandidate(score, [{ id: 'brahms-op118-no1-17', guard: { id: 'brahms-op118-no1-17', pitchClass: 0, octave: 4, tick: 240, expectedHand: 'RH' }, hand: 'LH', citation: 'test' }]);
  const original = buildBrahmsSemanticIndex(edited, [first]);
  assert.throws(() => buildBrahmsSemanticIndex(edited, [first], 'stale-revision'), /SOURCE_WITNESS.*revision/);
  assert.equal(original.forNote('brahms-op118-no1-17')?.displayedHand, 'LH');
  assert.equal(original.forNote('brahms-op118-no1-17')?.performedTrackHand, 'RH');
  const segment = first.segments[0];
  const altered = (changes: Partial<typeof segment>, eventChanges: Partial<BrahmsProvenanceEvent> = {}) =>
    ({ ...first, ...eventChanges, segments: [{ ...segment, ...changes }] });
  for (const changed of [
    altered({ voice: 'rightHandUpper' }),
    altered({ staff: segment.staff === 'upper' ? 'lower' : 'upper' }),
    altered({ staff: 'unknown' }, { staves: ['unknown'] }),
    { ...first, segments: [] },
    { ...first, voices: [] },
    { ...first, staves: [] },
  ]) assert.throws(() => buildBrahmsSemanticIndex(edited, [changed]), /SOURCE_WITNESS.*voice\/staff\/hand mismatch/);
  const sourceMoved = altered({ voice: 'rightHandUpper' }, { voices: ['rightHandUpper'] });
  const sourceMovedIndex = buildBrahmsSemanticIndex(edited, [sourceMoved]);
  assert.equal(sourceMovedIndex.forNote('brahms-op118-no1-17'), undefined);
  assert.match(sourceMovedIndex.sounds[0].unresolved!, /rightHandUpper.*bar 2/);
  const printedElsewhere = altered({ staff: segment.staff === 'upper' ? 'lower' : 'upper' }, { staves: [segment.staff === 'upper' ? 'lower' : 'upper'] });
  assert.throws(() => buildBrahmsSemanticIndex(edited, [printedElsewhere]), /SCORE_WITNESS.*brahms-op118-no1-17.*source/);
  const handMismatch = { ...edited, notes: edited.notes.map(n => n.id === 'brahms-op118-no1-17' ?
    { ...n, sourceProvenance: { ...n.sourceProvenance!, hands: [n.sourceProvenance!.hands[0] === 'RH' ? 'LH' as const : 'RH' as const] } } : n) };
  assert.throws(() => buildBrahmsSemanticIndex(handMismatch, [first]), /SCORE_WITNESS.*brahms-op118-no1-17.*source/);
  // Missing provenance must never grant an edit despite an otherwise matching pitch.
  const missing = { ...edited, notes: edited.notes.map(n => n.id === 'brahms-op118-no1-17' ? { ...n, sourceProvenance: undefined } : n) };
  const missingIndex = buildBrahmsSemanticIndex(missing, [first]);
  assert.equal(missingIndex.forNote('brahms-op118-no1-17'), undefined);
  assert.match(missingIndex.sounds[0].unresolved!, /leftHandUpper.*bar 2/);
  assert.throws(() => editableBrahmsSound(missingIndex, missingIndex.forNote('brahms-op118-no1-17'), 'brahms-op118-no1-17'), /AMBIGUOUS_HAND/);
  assert.throws(() => linkedBrahmsNotes(original, original.forNote('brahms-op118-no1-17')!, missing), /SCORE_WITNESS.*revision mismatch/);
  const duplicate = { ...edited, notes: [...edited.notes, { ...edited.notes.find(n => n.id === 'brahms-op118-no1-17')!, id: 'duplicate-c4' }] };
  const ambiguous = buildBrahmsSemanticIndex(duplicate, [first]);
  assert.equal(ambiguous.forNote('brahms-op118-no1-17'), undefined);
  assert.match(ambiguous.sounds[0].unresolved!, /expected one engine note, found 2.*leftHandUpper/);
  assert.throws(() => editableBrahmsSound(ambiguous, ambiguous.forNote('brahms-op118-no1-17'), 'brahms-op118-no1-17'), /AMBIGUOUS_HAND/);
});

test('source topology distinguishes continuations, new attacks, and independent coincident voices', () => {
  const index = buildBrahmsSemanticIndex(score);
  for (const [tick,pc,octave,hand] of [[12432,9,2,'RH'],[12624,9,2,'RH'],[12552,9,2,'LH'],[12576,2,3,'LH']] as const) {
    const e = event(tick,pc,octave,hand);
    const sound = index.sounds.find(s => s.tick === tick && s.pitchClass === pc && s.octave === octave && s.performedTrackHand === hand)!;
    assert.deepEqual(sound.components.map(c => c.statement.voice), e.segments.map(s => s.voice));
    assert.equal(sound.components[0].role, 'attack');
  }
  const lower65 = index.sounds.find(s => s.tick === 12432 && s.pitchClass === 9 && s.octave === 2 && s.performedTrackHand === 'RH')!;
  assert.equal(lower65.components[1].role, 'continuation');
  assert.equal(lower65.components[1].displayHead, 'added');
  const lower66 = index.sounds.find(s => s.tick === 12552 && s.pitchClass === 9 && s.octave === 2 && s.performedTrackHand === 'LH')!;
  assert.equal(lower66.components[1].role, 'continuation');
  assert.equal(lower66.components[1].displayHead, 'reused');
  const upper66 = index.sounds.find(s => s.tick === 12624 && s.pitchClass === 9 && s.octave === 2 && s.performedTrackHand === 'RH')!;
  assert.notEqual(lower66.components[1].statement.voice, upper66.components[0].statement.voice);
});

test('missing, duplicate, changed and macro-expanded source witnesses fail before editing', () => {
  const first = event(240,0,4);
  const second = event(2160,0,4);
  const origin = (events: BrahmsProvenanceEvent[]) => {
    const index = buildBrahmsSemanticIndex(score, events);
    return { index, sound: index.sounds.find(s => s.tick === 240 && s.pitchClass === 0 && s.octave === 4)! };
  };
  const absent = origin([second]);
  assert.equal(absent.index.forNote('brahms-op118-no1-17'), undefined);
  assert.throws(() => editableBrahmsSound(absent.index, absent.index.forNote('brahms-op118-no1-17'), 'brahms-op118-no1-17'), /AMBIGUOUS_HAND/);
  const duplicate = { ...first, segments: [{ ...first.segments[0] }] };
  assert.throws(() => buildBrahmsSemanticIndex(score, [first,duplicate]), /SOURCE_COLLISION/);
  assert.throws(() => origin([first, { ...second, segments: [{ ...second.segments[0], midi: 61 }] }]), /SOURCE_WITNESS/);
  const changed = origin([first, { ...second, pitchClass: 1, segments: [{ ...second.segments[0], midi: 61 }] }]);
  assert.throws(() => linkedBrahmsNotes(changed.index, changed.sound, score), /SOURCE_COLLISION/);
  assert.throws(() => editableBrahmsSound(changed.index, changed.sound, 'brahms-op118-no1-17'), /SOURCE_COLLISION/);
  const repeated = origin([first, { ...second, segments: [{ ...second.segments[0], occurrence: 1 }] }]);
  assert.throws(() => linkedBrahmsNotes(repeated.index, repeated.sound, score), /SOURCE_COLLISION/);
  assert.notEqual(origin([first]).index.sourceRevision, origin([first,second]).index.sourceRevision);
});
