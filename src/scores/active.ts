import { detectHandCrossings } from '../model/grid';
import type { Hand, QuantizedGridScore } from '../model/types';
import { buildBachGoldbergVar1Score } from './bach-goldberg-var1';
import { buildBrahmsOp118No1Score, BRAHMS_OP118_NO1_JANKO_OPTIONS, BRAHMS_OP118_NO1_JANKO_TOKENS } from './brahms-op118-no1';
import { DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS, resolveJankoOptions, resolveJankoTokens } from '../render/janko/types';
import type { JankoLayoutOptions, JankoTokens } from '../render/janko/types';
import type { DurationTarget } from '../render/janko/duration-rig';
import active from './data/active-scores.json' with { type: 'json' };

export const ACTIVE_SCORES = ['bach-goldberg-var1', 'brahms-op118-no1'] as const;
export type ActiveScoreId = typeof ACTIVE_SCORES[number];
export interface ActiveAssignment { id: string; tick: number; pitchClass: number; octave: number; expectedHand: Hand; hand: Hand }
export interface ActiveDuration { options: Pick<JankoLayoutOptions, 'exceptionCarrier'>; tokens: Pick<JankoTokens, 'halfRingGap' | 'detachedSymbolAir' | 'horizontalMountAir'>;
  placements: Array<{ target: DurationTarget; preference: 'above' | 'beside' }> }
export interface ActiveRevision { revision: string; parent: string | null; assignments: ActiveAssignment[]; duration: ActiveDuration }
export interface ActiveData { schema: 1; scores: Record<ActiveScoreId, ActiveRevision> }

export function activeScoreId(id: string): ActiveScoreId {
  if (id !== 'bach-goldberg-var1' && id !== 'brahms-op118-no1') throw new Error(`unknown canonical score: ${id}`);
  return id;
}
export const initialActiveData: ActiveData = active as ActiveData;
const only = (value: unknown, names: readonly string[]) => {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !names.includes(key)))
    throw new Error('unsupported canonical data field');
};
export function resolveActiveScore(id: string, data: ActiveData = initialActiveData) {
  const scoreId = activeScoreId(id);
  if (data.schema !== 1 || !data.scores || Object.keys(data.scores).sort().join('|') !== [...ACTIVE_SCORES].sort().join('|'))
    throw new Error('invalid canonical score registry');
  only(data, ['schema','scores']);
  const revision = data.scores[scoreId];
  only(revision, ['revision','parent','assignments','duration']);
  if (!revision || typeof revision.revision !== 'string' || !revision.revision || !Array.isArray(revision.assignments))
    throw new Error('invalid canonical revision');
  const base = scoreId === 'bach-goldberg-var1' ? buildBachGoldbergVar1Score() : buildBrahmsOp118No1Score();
  const assignments = new Map<string, ActiveAssignment>();
  for (const assignment of revision.assignments) {
    only(assignment, ['id','tick','pitchClass','octave','expectedHand','hand']);
    if (assignments.has(assignment.id) || !['LH', 'RH'].includes(assignment.hand) || !['LH', 'RH'].includes(assignment.expectedHand)) throw new Error('invalid/duplicate canonical hand assignment');
    assignments.set(assignment.id, assignment);
  }
  const notes = base.notes.map(note => {
    const change = assignments.get(note.id);
    if (!change) return note;
    if (note.startTick !== change.tick || note.pitch.pitchClass !== change.pitchClass || note.pitch.octave !== change.octave || note.hand !== change.expectedHand)
      throw new Error(`canonical hand guard mismatch: ${note.id}`);
    assignments.delete(note.id);
    return { ...note, hand: change.hand };
  });
  if (assignments.size) throw new Error(`unknown canonical note: ${[...assignments.keys()][0]}`);
  const score: QuantizedGridScore = { ...base, notes };
  score.handCrossings = detectHandCrossings(score);
  const duration = revision.duration;
  only(duration, ['options','tokens','placements']);
  if (!duration || !duration.options || !duration.tokens || !Array.isArray(duration.placements)) throw new Error('invalid canonical duration controls');
  only(duration.options, ['exceptionCarrier']);
  only(duration.tokens, ['halfRingGap','detachedSymbolAir','horizontalMountAir']);
  if (duration.options.exceptionCarrier !== undefined && !['horizontal','symbol'].includes(duration.options.exceptionCarrier)) throw new Error('invalid duration carrier');
  for (const [key, value] of Object.entries(duration.tokens))
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > (key === 'halfRingGap' ? 2 : 3)) throw new Error('invalid duration token');
  if (duration.placements.length > 8) throw new Error('too many duration placements');
  for (const { target, preference } of duration.placements) {
    if (!target || target.score !== scoreId || !['above','beside'].includes(preference) || !['ring','half-ring'].includes(target.family) ||
      !Array.isArray(target.ownerIds) || target.ownerIds.length < 2) throw new Error('invalid duration owner');
  }
  const rawOptions = scoreId === 'bach-goldberg-var1' ? DEFAULT_JANKO_OPTIONS : BRAHMS_OP118_NO1_JANKO_OPTIONS;
  const rawTokens = scoreId === 'bach-goldberg-var1' ? DEFAULT_JANKO_TOKENS : BRAHMS_OP118_NO1_JANKO_TOKENS;
  const options = resolveJankoOptions({ ...rawOptions, ...duration.options,
    ...(duration.placements.length ? { durationSeatPreferences: duration.placements.map(p => ({ tick: p.target.tick, family: p.target.family, ownerIds: p.target.ownerIds, seat: p.preference })) } : {}) });
  const tokens = resolveJankoTokens({ ...rawTokens, ...duration.tokens });
  return { score, options, tokens, revision: revision.revision };
}
