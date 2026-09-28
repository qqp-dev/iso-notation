/** Trusted local active-score transaction. No browser write API. */
import { createHash } from 'node:crypto';
import { buildIdentity } from './prepared/seam';
import { readFileSync, writeFileSync, existsSync, openSync, closeSync, renameSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Hand } from '../../model/types';
import { activeScoreId, resolveActiveScore, type ActiveData, type ActiveRevision, type ActiveScoreId, type ActiveAssignment } from '../../scores/active';
import { buildBachGoldbergVar1Score } from '../../scores/bach-goldberg-var1';
import { buildBrahmsOp118No1Score } from '../../scores/brahms-op118-no1';
import { buildBrahmsSemanticIndex, editableBrahmsSound, linkedBrahmsNotes } from '../../scores/brahms-semantic-index';
import { verifyBrahmsWitness } from './semantic-hand';
import { lintJankoScore } from './linter';
import { validateDurationIntent, evaluateDurationVariant, type DurationIntent } from './duration-rig';
import { countJankoPages, renderJankoPage } from './engine';
import { DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS, resolveJankoOptions, resolveJankoTokens } from './types';
import { BRAHMS_OP118_NO1_JANKO_OPTIONS, BRAHMS_OP118_NO1_JANKO_TOKENS } from '../../scores/brahms-op118-no1';

const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const keys = (value: unknown, allowed: string[]) => {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !allowed.includes(k)))
    throw new Error('unsupported canonical data field');
};
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
export type CanonicalHandIntent = { schema: 1; intent: 'assign-hand'; score: ActiveScoreId; base: string;
  target: Hand; scope: 'this' | 'set' | 'source-linked'; selected: Array<{ id: string; tick: number; pitchClass: number; octave: number; expectedHand: Hand }>;
  reason?: string };
export type CanonicalDurationIntent = Omit<DurationIntent, 'variantId'> & { variantId?: never };
export type CanonicalIntent = CanonicalHandIntent | CanonicalDurationIntent;
export type CanonicalHistoryRecord = { parent: string; revision: string; operation: 'change' | 'undo'; score: ActiveScoreId;
  requestHash: string; engineIdentity: string; request: CanonicalIntent | { base: string; revision: string }; before: ActiveRevision; after: ActiveRevision; effects: { changedPages: number[]; lint: { violations: number; warnings: number } } };
export type CanonicalHistory = { schema: 1; records: CanonicalHistoryRecord[] };

/** Exact path/shape/parent/semantic allowlist. Neither a client-provided revision nor an extra key is trusted. */
export function validateCanonicalTransition(oldData: ActiveData, nextData: ActiveData, score: ActiveScoreId): void {
  keys(nextData, ['schema', 'scores']);
  if (nextData.schema !== 1) throw new Error('unsupported active schema');
  keys(nextData.scores, ['bach-goldberg-var1', 'brahms-op118-no1']);
  if (Object.keys(nextData.scores).length !== 2) throw new Error('missing canonical score');
  for (const id of ['bach-goldberg-var1', 'brahms-op118-no1'] as const) {
    const next = nextData.scores[id];
    if (id !== score) {
      if (JSON.stringify(next) !== JSON.stringify(oldData.scores[id])) throw new Error('unrelated score changed');
      continue;
    }
    keys(next, ['revision', 'parent', 'assignments', 'duration']);
    if (next.parent !== oldData.scores[id].revision || !/^[a-f0-9]{64}$/.test(next.revision)) throw new Error('invalid canonical parent/revision');
    const { revision, ...payload } = next;
    if (revision !== digest({ score: id, ...payload })) throw new Error('canonical revision fingerprint mismatch');
    if (!Array.isArray(next.assignments)) throw new Error('invalid canonical assignments');
    for (const assignment of next.assignments) keys(assignment, ['id','tick','pitchClass','octave','expectedHand','hand']);
    keys(next.duration, ['options', 'tokens', 'placements']);
    // The resolver independently checks every identity/guard against the immutable builder.
    const projected = resolveActiveScore(id, nextData);
    if (projected.score.notes.length !== (id === 'bach-goldberg-var1' ? 551 : buildBrahmsOp118No1Score().notes.length)) throw new Error('event count changed');
  }
}
function effects(oldData: ActiveData, nextData: ActiveData, score: ActiveScoreId) {
  const before = resolveActiveScore(score, oldData), after = resolveActiveScore(score, nextData);
  const duration = nextData.scores[score].duration;
  if (duration.placements.length) {
    // A hand edit can change a shared mark's exact owner set. Recheck saved
    // preferences against the newly projected score, not the old carrier.
    const baseOptions = score === 'bach-goldberg-var1' ? DEFAULT_JANKO_OPTIONS : BRAHMS_OP118_NO1_JANKO_OPTIONS;
    const baseTokens = score === 'bach-goldberg-var1' ? DEFAULT_JANKO_TOKENS : BRAHMS_OP118_NO1_JANKO_TOKENS;
    validateDurationIntent({ schema: 1, intent: 'engrave-duration', score, base: '', variantId: 'canonical',
      options: duration.options, tokens: duration.tokens, placements: duration.placements,
      windows: [{ measureStart: 1, measureCount: 2 }] }, after.score, resolveJankoOptions(baseOptions), resolveJankoTokens(baseTokens));
  }
  const a = lintJankoScore(before.score, before.options, before.tokens);
  const b = lintJankoScore(after.score, after.options, after.tokens);
  const signature = (v: typeof b.violations[number]) => `${v.code}:${v.system}:${v.measure}:${v.message}`;
  const existing = new Map<string, number>();
  for (const violation of a.violations) existing.set(signature(violation), (existing.get(signature(violation)) ?? 0) + 1);
  const added = b.violations.filter(violation => { const key = signature(violation), count = existing.get(key) ?? 0;
    if (!count) return true; existing.set(key, count - 1); return false; });
  if (added.length || (score === 'bach-goldberg-var1' && (b.violations.length || b.warnings.length)))
    throw new Error(`new canonical engraving violations: ${added.map(v => v.message).slice(0, 3).join('; ') || 'GOLD strict lint failed'}`);
  const changedPages: number[] = [];
  const pageCount = countJankoPages(after.score, after.options, after.tokens);
  if (countJankoPages(before.score, before.options, before.tokens) !== pageCount) throw new Error('canonical page count changed; requires software review');
  for (let page = 0; page < pageCount; page++) {
    if (renderJankoPage(before.score, page, before.options, before.tokens) !== renderJankoPage(after.score, page, after.options, after.tokens)) changedPages.push(page + 1);
  }
  return { changedPages, lint: { violations: b.violations.length, warnings: b.warnings.length } };
}

export function prepareCanonicalChange(oldData: ActiveData, intent: CanonicalIntent, sourceRoot = process.cwd()): { data: ActiveData; effects?: ReturnType<typeof effects>; replay: boolean } {
  const score = activeScoreId(intent.score);
  const old = oldData.scores[score];
  if (intent.base !== old.revision) throw new Error('stale canonical parent');
  if (score === 'brahms-op118-no1') verifyBrahmsWitness(sourceRoot);
  const next = clone(oldData);
  const revision = next.scores[score];
  if (intent.intent === 'assign-hand') {
    keys(intent, ['schema','intent','score','base','target','scope','selected','reason']);
    if (intent.schema !== 1 || !['LH', 'RH'].includes(intent.target) || !['this', 'set', 'source-linked'].includes(intent.scope) ||
      !Array.isArray(intent.selected) || !intent.selected.length || (intent.scope !== 'set' && intent.selected.length !== 1)) throw new Error('unsupported hand intent');
    if (score === 'bach-goldberg-var1' && intent.scope === 'source-linked') throw new Error('unsupported Bach source-linked scope');
    const projected = resolveActiveScore(score, oldData).score;
    const current = new Map(projected.notes.map(n => [n.id, n]));
    const builder = score === 'bach-goldberg-var1' ? buildBachGoldbergVar1Score() : buildBrahmsOp118No1Score();
    const baseline = new Map(builder.notes.map(n => [n.id, n]));
    const assigned = new Map(revision.assignments.map(a => [a.id, a]));
    const seen = new Set<string>();
    const selected = intent.selected.map(guard => {
      keys(guard, ['id','tick','pitchClass','octave','expectedHand']);
      const note = current.get(guard.id);
      if (seen.has(guard.id) || !note || note.startTick !== guard.tick || note.pitch.pitchClass !== guard.pitchClass ||
        note.pitch.octave !== guard.octave || note.hand !== guard.expectedHand) throw new Error(`canonical guard mismatch: ${guard.id}`);
      seen.add(guard.id);
      return note;
    });
    const targets = intent.scope === 'source-linked' ? (() => {
      const index = buildBrahmsSemanticIndex(projected);
      const origin = selected[0];
      const linked = linkedBrahmsNotes(index, editableBrahmsSound(index, index.forNote(origin.id), origin.id), projected);
      if (linked.some(note => note.hand !== origin.hand)) throw new Error('source-linked hand mismatch');
      return linked;
    })() : selected;
    for (const note of targets) {
      const source = baseline.get(note.id);
      if (!source) throw new Error(`canonical source note missing: ${note.id}`);
      const value: ActiveAssignment = { id: note.id, tick: note.startTick, pitchClass: note.pitch.pitchClass, octave: note.pitch.octave,
        expectedHand: source.hand, hand: intent.target };
      if (value.hand === source.hand) assigned.delete(note.id); else assigned.set(note.id, value);
    }
    revision.assignments = [...assigned.values()].sort((a, b) => a.id.localeCompare(b.id));
  } else {
    keys(intent, ['schema','intent','score','base','options','tokens','placements','windows','reason']);
    const current = resolveActiveScore(score, oldData);
    const controls = validateDurationIntent({ ...intent, variantId: 'canonical',
      windows: intent.windows ?? [{ measureStart: 1, measureCount: 2 }] }, current.score, current.options, current.tokens);
    evaluateDurationVariant(current.score, current.options, current.tokens, controls);
    revision.duration = { options: controls.options, tokens: controls.tokens, placements: controls.placements };
  }
  if (JSON.stringify({ assignments: old.assignments, duration: old.duration }) === JSON.stringify({ assignments: revision.assignments, duration: revision.duration }))
    return { data: oldData, replay: true };
  revision.parent = old.revision;
  revision.revision = digest({ score, parent: revision.parent, assignments: revision.assignments, duration: revision.duration });
  validateCanonicalTransition(oldData, next, score);
  return { data: next, effects: effects(oldData, next, score), replay: false };
}

const readData = (path: string): ActiveData => JSON.parse(readFileSync(path, 'utf8')) as ActiveData;
const readHistory = (path: string): CanonicalHistory => existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) as CanonicalHistory : { schema: 1, records: [] };
function atomic(path: string, value: unknown) {
  const temp = `${path}.${process.pid}.tmp`;
  try { writeFileSync(temp, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 }); renameSync(temp, path); }
  finally { if (existsSync(temp)) unlinkSync(temp); }
}
/** Only a trusted local caller may mutate the active revision. The publisher separately owns release/deployment. */
export function executeCanonicalCommand(action: 'status' | 'change' | 'undo', scoreInput: string, request?: CanonicalIntent | { base: string; revision: string },
  root = process.cwd(), dataFile = 'src/scores/data/active-scores.json', historyFile = '.canonical-history.local') {
  const score = activeScoreId(scoreInput);
  const file = resolve(root, dataFile), archive = resolve(root, historyFile), lock = `${file}.lock`;
  if (action === 'status') { const data = readData(file);
    const publicationFile = resolve(root, '.canonical-publication.local');
    const published = existsSync(publicationFile) ? (JSON.parse(readFileSync(publicationFile, 'utf8')) as {
      scores?: Record<string, { state: string; revision: string; detail?: string }>
    }).scores?.[score] : undefined;
    return { score, revision: data.scores[score].revision,
      records: readHistory(archive).records.filter(r => r.score === score).length,
      publication: published?.revision === data.scores[score].revision ? published.state : 'pending',
      detail: published?.revision === data.scores[score].revision ? published.detail : undefined }; }
  let fd: number;
  try { fd = openSync(lock, 'wx', 0o600); } catch { throw new Error('canonical writer busy; retry'); }
  try {
    const data = readData(file), history = readHistory(archive);
    if (history.schema !== 1 || !Array.isArray(history.records)) throw new Error('invalid canonical history');
    let prepared: ReturnType<typeof prepareCanonicalChange>;
    const requestHash = digest(request);
    const last = history.records.filter(r => r.score === score).at(-1);
    const engineIdentity = buildIdentity(root);
    if (last && (last.revision !== data.scores[score].revision || last.engineIdentity !== engineIdentity))
      throw new Error('canonical history/active/engine identity mismatch; archive and migrate explicitly');
    const unsubmitted = () => {
      if (dataFile !== 'src/scores/data/active-scores.json' || !process.env.JANKO_DEPLOY_CHECKOUT) return false;
      const publication = resolve(root, '.canonical-publication.local');
      const statuses = existsSync(publication) ? (JSON.parse(readFileSync(publication, 'utf8')) as {
        scores?: Record<string, { revision?: string; state?: string }>
      }).scores : undefined;
      return (['bach-goldberg-var1','brahms-op118-no1'] as const).some(id => {
        const saved = history.records.filter(record => record.score === id).at(-1);
        return saved?.revision === data.scores[id].revision &&
          (statuses?.[id]?.revision !== saved.revision || statuses?.[id]?.state !== 'deployed');
      });
    };
    if (action === 'change') {
      if (!request || !('intent' in request) || request.score !== score) throw new Error('cross-score canonical request');
      if (last?.requestHash === requestHash && last.revision === data.scores[score].revision)
        return { score, revision: last.revision, replay: true, effects: last.effects, publication: 'pending' as const };
      if (unsubmitted()) throw new Error('prior active release pending/failed; retry publisher before another edit');
      prepared = prepareCanonicalChange(data, request, root);
    } else {
      if (last?.operation === 'undo' && last.requestHash === requestHash &&
          request && 'revision' in request && request.revision === last.parent)
        return { score, revision: last.revision, replay: true, effects: last.effects, publication: 'pending' as const };
      if (!request || !('revision' in request) || request.base !== data.scores[score].revision ||
          request.revision !== last?.revision || last.operation !== 'change')
        throw new Error('stale/unknown canonical undo: only the preceding edit can be reversed');
      if (unsubmitted()) throw new Error('prior active release pending/failed; retry publisher before undo');
      const next = clone(data), previous = last.before;
      next.scores[score] = { ...clone(previous), parent: data.scores[score].revision, revision: '' };
      const entry = next.scores[score];
      entry.revision = digest({ score, parent: entry.parent, assignments: entry.assignments, duration: entry.duration });
      validateCanonicalTransition(data, next, score);
      prepared = { data: next, effects: effects(data, next, score), replay: false };
    }
    if (prepared.replay) return { score, revision: data.scores[score].revision, replay: true, publication: 'pending' as const };
    const nextRevision = prepared.data.scores[score].revision;
    const record: CanonicalHistoryRecord = { score, parent: data.scores[score].revision, revision: nextRevision, operation: action,
      requestHash, engineIdentity, request: clone(request!), before: clone(data.scores[score]), after: clone(prepared.data.scores[score]), effects: prepared.effects! };
    // A crash between two renames is detectable: history head disagrees with active head.
    // Refuse a subsequent writer until an operator recovers both files together.
    if (last && last.revision !== data.scores[score].revision) throw new Error('canonical history/active head mismatch');
    atomic(archive, { schema: 1, records: [...history.records, record] });
    atomic(file, prepared.data);
    return { score, revision: nextRevision, replay: false, effects: prepared.effects, publication: 'pending' as const };
  } finally { closeSync(fd); unlinkSync(lock); }
}
