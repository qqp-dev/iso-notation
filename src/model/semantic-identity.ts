import type { Hand } from './types';

/** Read-only evidence: engine ids are guarded projections, never source identities. */
export interface SourceStatement {
  key: string;
  revision: string;
  file: string; line: number; col: number; voice: string; staff: string;
  pitch: number; durationTicks: number; tieForward: boolean; tieWait: boolean;
  sourcePartHand: Hand;
}
export interface VoiceComponent {
  key: string;
  statement: SourceStatement;
  tick: number; occurrence: number; bar: number;
  role: 'attack' | 'continuation' | 'unresolved';
  /** A continuation at a later tick needs its own head unless another attack paints it. */
  displayHead: 'attack' | 'added' | 'reused' | 'unresolved';
  reason?: string;
}
export interface PerformedOccurrence { key: string; tick: number; occurrence: number; component: VoiceComponent }
export interface SoundingIdentity {
  key: string;
  pitchClass: number; octave: number; tick: number; durationTicks: number;
  performedTrackHand: Hand; displayedHand: Hand; editorialHand?: Hand;
  components: readonly VoiceComponent[];
  /** Valid only under this index's source and score revision. */
  noteRef?: { id: string; pitchClass: number; octave: number; tick: number; hand: Hand };
  unresolved?: string;
}
export interface SemanticIdentityIndex {
  sourceRevision: string;
  scoreRevision: string;
  statements: ReadonlyMap<string, SourceStatement>;
  occurrences: ReadonlyMap<string, readonly PerformedOccurrence[]>;
  sounds: readonly SoundingIdentity[];
  forStatement(key: string): readonly PerformedOccurrence[];
  forNote(id: string): SoundingIdentity | undefined;
  forOccurrence(key: string): readonly SoundingIdentity[];
}
