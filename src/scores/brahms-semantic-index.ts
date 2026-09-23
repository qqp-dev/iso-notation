import { createHash } from 'node:crypto';
import type { QuantizedGridScore, QuantizedNote } from '../model/types';
import type { SemanticIdentityIndex, SourceStatement, VoiceComponent, PerformedOccurrence, SoundingIdentity } from '../model/semantic-identity';
import { BRAHMS_VOICE_HAND, type BrahmsProvenanceEvent, type BrahmsProvenanceSegment, type BrahmsSourceVoice } from './brahms-source-fidelity';
import pinned from './data/brahms-op118-no1-written-durations.provenance.json' with { type: 'json' };
import { buildBrahmsOp118No1Score } from './brahms-op118-no1';

const hash = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex');
const pitchTick = (p: { pitchClass: number; octave: number; startTick: number }) => `${p.pitchClass}|${p.octave}|${p.startTick}`;
const where = (s: BrahmsProvenanceSegment) => `${s.file}:${s.line}:${s.col} ${s.voice} bar ${s.bar} occurrence ${s.occurrence}`;
const scoreRevisionOf = (score: QuantizedGridScore) => hash(score.notes.map(n => [n.id,n.pitch,n.startTick,n.durationTicks,n.hand,n.editorialHand,n.sourceProvenance]));
const unique = (values: readonly string[]) => [...new Set(values)].sort();
const same = (left: readonly string[], right: readonly string[]) => JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
/** Verify the raw written contributors before assigning any engine projection. Staff is
 * printed destination, not a hand inference; track and editorial hands may differ. */
function eventWitness(event: BrahmsProvenanceEvent, key: string) {
  const citation = event.segments.map(where).join('; ') || `no segments at ${key}`;
  const voices = unique(event.segments.map(s => s.voice));
  const staves = unique(event.segments.map(s => s.staff));
  const hands = unique(voices.map(v => BRAHMS_VOICE_HAND[v as BrahmsSourceVoice]).filter((h): h is 'RH' | 'LH' => !!h));
  if (!event.segments.length || !voices.length || voices.length !== event.voices.length ||
    !same(voices, event.voices) || !staves.length || staves.length !== event.staves.length ||
    !same(staves, event.staves) || staves.some(s => s !== 'upper' && s !== 'lower') ||
    hands.length === 0 || voices.some(v => !BRAHMS_VOICE_HAND[v as BrahmsSourceVoice]) ||
    event.unison !== (voices.length > 1))
    throw new IdentityResolutionError('SOURCE_WITNESS', `event ${key} contributor voice/staff/hand mismatch: event voices ${JSON.stringify(event.voices)} staves ${JSON.stringify(event.staves)} unison ${event.unison}; segments ${citation}; derived hands ${JSON.stringify(hands)}`);
  return { voices, staves, hands, citation };
}
/** An authored pitch statement includes its voice, context, position and value. A source line alone is not identity. */
export function statementKey(s: BrahmsProvenanceSegment) {
  return JSON.stringify([s.file,s.line,s.col,s.voice,s.staff,s.midi,s.duration,s.tieForward,s.tieWait]);
}
export class IdentityResolutionError extends Error {
  constructor(public readonly code: 'SOURCE_WITNESS' | 'SOURCE_COLLISION' | 'SCORE_WITNESS' | 'AMBIGUOUS_HAND', detail: string) { super(`${code}: ${detail}`); }
}
export function buildBrahmsSemanticIndex(
  score: QuantizedGridScore = buildBrahmsOp118No1Score(),
  events: readonly BrahmsProvenanceEvent[] = pinned.events as unknown as BrahmsProvenanceEvent[],
  sourceRevision = hash(events)
): SemanticIdentityIndex {
  if (sourceRevision !== hash(events))
    throw new IdentityResolutionError('SOURCE_WITNESS', 'source revision does not match supplied provenance events');
  const scoreRevision = scoreRevisionOf(score);
  const statements = new Map<string, SourceStatement>();
  const occurrences = new Map<string, PerformedOccurrence[]>();
  const byNote = new Map<string, SoundingIdentity>();
  const byOccurrence = new Map<string, SoundingIdentity[]>();
  const sounds: SoundingIdentity[] = [];
  const noteGroups = new Map<string, QuantizedNote[]>();
  for (const note of score.notes) {
    const k = pitchTick({ ...note.pitch, startTick: note.startTick });
    noteGroups.set(k, [...(noteGroups.get(k) ?? []), note]);
  }
  const eventGroups = new Map<string, BrahmsProvenanceEvent[]>();
  for (const event of events) {
    const k = pitchTick(event);
    eventGroups.set(k, [...(eventGroups.get(k) ?? []), event]);
  }
  for (const [key, group] of eventGroups) {
    const notes = noteGroups.get(key) ?? [];
    for (const event of group) {
      const eventKey = JSON.stringify([key,event.hand]);
      const witness = eventWitness(event, eventKey);
      const components: VoiceComponent[] = [];
      for (const s of event.segments) {
        if (s.midi !== (event.octave + 1) * 12 + event.pitchClass || s.startTick < event.startTick || s.durationTicks <= 0)
          throw new IdentityResolutionError('SOURCE_WITNESS', `changed source segment does not state event ${eventKey}: ${where(s)} MIDI ${s.midi}`);
        const part = BRAHMS_VOICE_HAND[s.voice as BrahmsSourceVoice];
        if (!part) throw new IdentityResolutionError('SOURCE_WITNESS', `unknown voice ${where(s)}`);
        const sourceKey = statementKey(s);
        const statement = statements.get(sourceKey) ?? { key: sourceKey, revision: sourceRevision, file: s.file, line: s.line, col: s.col,
          voice: s.voice, staff: s.staff, pitch: s.midi, durationTicks: s.durationTicks, tieForward: s.tieForward,
          tieWait: s.tieWait, sourcePartHand: part };
        statements.set(sourceKey, statement);
        const occurrenceKey = JSON.stringify([sourceKey,s.occurrence,s.startTick]);
        const component: VoiceComponent = { key: occurrenceKey, statement, tick: s.startTick, occurrence: s.occurrence, bar: s.bar,
          role: 'unresolved', displayHead: 'unresolved' };
        const list = occurrences.get(sourceKey) ?? [];
        if (list.some(o => o.key === occurrenceKey)) throw new IdentityResolutionError('SOURCE_COLLISION', `duplicate ${where(s)}`);
        list.push({ key: occurrenceKey, tick: s.startTick, occurrence: s.occurrence, component });
        occurrences.set(sourceKey, list);
        components.push(component);
      }
      // Track hand is pinned by the performed event, not inferred from the
      // displayed/editorial hand: a candidate may flip a canonical correction.
      // Require the full voice witness so coincident sounds cannot be conflated.
      const candidates = notes.filter(n => n.durationTicks === event.durationTicks &&
        n.sourceProvenance?.voices.length === witness.voices.length &&
        same(n.sourceProvenance.voices, witness.voices));
      for (const candidate of candidates) {
        const proof = candidate.sourceProvenance!;
        if (!same(proof.staves, witness.staves) || !same(proof.hands, witness.hands) ||
          proof.staves.length !== witness.staves.length || proof.hands.length !== witness.hands.length ||
          proof.unison !== event.unison)
          throw new IdentityResolutionError('SCORE_WITNESS', `score ${candidate.id} source voice/staff/hand mismatch at ${eventKey}: score ${JSON.stringify(proof)}; source ${witness.citation}; derived hands ${JSON.stringify(witness.hands)}`);
      }
      const note = candidates.length === 1 ? candidates[0] : undefined;
      const sound: SoundingIdentity = { key: eventKey, pitchClass: event.pitchClass, octave: event.octave, tick: event.startTick,
        durationTicks: event.durationTicks, performedTrackHand: event.hand, displayedHand: note?.hand ?? event.hand,
        editorialHand: note?.editorialHand?.hand, components,
        ...(note ? { noteRef: { id: note.id, pitchClass: note.pitch.pitchClass, octave: note.pitch.octave, tick: note.startTick, hand: note.hand } } :
          { unresolved: `expected one engine note, found ${candidates.length}; ${event.segments.map(where).join('; ')}` }) };
      sounds.push(sound);
      if (note) {
        if (byNote.has(note.id)) throw new IdentityResolutionError('SCORE_WITNESS', `duplicate score projection ${note.id}: ${event.segments.map(where).join('; ')}`);
        byNote.set(note.id, sound);
      }
      for (const c of components) byOccurrence.set(c.key, [...(byOccurrence.get(c.key) ?? []), sound]);
    }
  }
  // All voice contributions survive, including coincident voices and tied continuations.
  // Continuation is established by authored topology, never by display id suffix or MIDI onset.
  for (const sound of sounds) {
    const voices = new Map<string, VoiceComponent[]>();
    for (const c of sound.components) voices.set(c.statement.voice, [...(voices.get(c.statement.voice) ?? []), c]);
    for (const parts of voices.values()) {
      parts.sort((a,b) => a.tick-b.tick || a.key.localeCompare(b.key));
      for (let i=0;i<parts.length;i++) {
        const c = parts[i], prior = parts[i-1];
        if (!prior) { c.role = 'attack'; c.displayHead = 'attack'; continue; }
        if (prior.statement.tieForward && (prior.tick + prior.statement.durationTicks === c.tick ||
          (prior.statement.tieWait && c.statement.tieWait && prior.tick + prior.statement.durationTicks < c.tick))) {
          c.role = 'continuation';
          c.displayHead = 'added';
        } else {
          c.reason = `tie topology unresolved: ${prior.statement.file}:${prior.statement.line}:${prior.statement.col} → ${c.statement.file}:${c.statement.line}:${c.statement.col}`;
        }
      }
    }
  }
  for (const sound of sounds) for (const c of sound.components) {
    if (c.role === 'continuation' && sounds.some(other => other !== sound && other.tick === c.tick &&
      other.pitchClass === sound.pitchClass && other.octave === sound.octave && other.components.some(part => part.tick === c.tick && part.role === 'attack')))
      c.displayHead = 'reused';
  }
  return { sourceRevision, scoreRevision, statements, occurrences, sounds,
    forStatement: key => occurrences.get(key) ?? [], forNote: id => byNote.get(id), forOccurrence: key => byOccurrence.get(key) ?? [] };
}
/** A hand is editable only when its voice/statement projection is unambiguous at this source location. */
export function editableBrahmsSound(index: SemanticIdentityIndex, sound: SoundingIdentity | undefined, id: string): SoundingIdentity {
  if (!sound?.noteRef || sound.components.length !== 1 || sound.components[0].role !== 'attack')
    throw new IdentityResolutionError('AMBIGUOUS_HAND', `ambiguous/missing source statement for ${id}: ${sound?.unresolved ?? sound?.components.map(c => c.key).join('; ') ?? 'no witness'}`);
  const c = sound.components[0];
  const atLocation = [...index.statements.values()].filter(s => s.file === c.statement.file && s.line === c.statement.line && s.col === c.statement.col && s.voice === c.statement.voice);
  if (atLocation.length !== 1) throw new IdentityResolutionError('SOURCE_COLLISION', `macro/source identity collision for ${id}: ${atLocation.map(s => s.key).join('; ')}`);
  const occurrences = index.forStatement(c.statement.key);
  if (!occurrences.some(o => o.key === c.key) || new Set(occurrences.map(o => o.occurrence)).size !== occurrences.length)
    throw new IdentityResolutionError('SOURCE_COLLISION', `ambiguous missing/duplicate occurrence for ${id}: ${occurrences.map(o => o.key).join('; ')}`);
  return sound;
}
/** Source-linked resolution demands one statement and one guarded sounding projection per occurrence. */
export function linkedBrahmsNotes(index: SemanticIdentityIndex, origin: SoundingIdentity, score: QuantizedGridScore): QuantizedNote[] {
  if (index.scoreRevision !== scoreRevisionOf(score))
    throw new IdentityResolutionError('SCORE_WITNESS', 'index/score revision mismatch; rebuild identity for the active candidate');
  if (origin.components.length !== 1 || origin.components[0].role !== 'attack' || !origin.noteRef)
    throw new IdentityResolutionError('AMBIGUOUS_HAND', `collapsed/tied origin ${origin.key}: ${origin.components.map(c => c.key).join('; ')}`);
  const source = origin.components[0].statement;
  const atLocation = [...index.statements.values()].filter(s => s.file === source.file && s.line === source.line && s.col === source.col && s.voice === source.voice);
  if (atLocation.length !== 1) throw new IdentityResolutionError('SOURCE_COLLISION', `macro/source identity collision at ${source.file}:${source.line}:${source.col} ${source.voice}: ${atLocation.map(s => s.key).join('; ')}`);
  const occurrences = index.forStatement(source.key);
  if (!occurrences.length || new Set(occurrences.map(o => o.occurrence)).size !== occurrences.length)
    throw new IdentityResolutionError('SOURCE_COLLISION', `ambiguous missing/duplicate occurrence ${source.key}: ${occurrences.map(o => o.key).join('; ')}`);
  return occurrences.map(o => {
    const matches = index.forOccurrence(o.key);
    const sound = matches.length === 1 ? matches[0] : undefined;
    if (!sound || sound.components.length !== 1 || !sound.noteRef || sound.components[0].role !== 'attack')
      throw new IdentityResolutionError('AMBIGUOUS_HAND', `ambiguous source-linked witness ${o.key}: ${matches.map(m => `${m.key} ${m.unresolved ?? m.components.map(c => c.key).join(',')}`).join('; ')}`);
    const n = score.notes.find(n => n.id === sound.noteRef!.id);
    if (!n || n.startTick !== sound.noteRef.tick || n.pitch.pitchClass !== sound.noteRef.pitchClass || n.pitch.octave !== sound.noteRef.octave)
      throw new IdentityResolutionError('SCORE_WITNESS', `source drift ${o.key} → ${sound.noteRef.id}`);
    return n;
  });
}
