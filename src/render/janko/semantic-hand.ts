/** Guarded, candidate-only semantic hand editing. No canonical score or source writes. */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, renameSync, openSync, closeSync, unlinkSync, existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildBrahmsOp118No1Score, BRAHMS_OP118_NO1_JANKO_OPTIONS, BRAHMS_OP118_NO1_JANKO_TOKENS } from '../../scores/brahms-op118-no1';
import provenance from '../../scores/data/brahms-op118-no1-written-durations.provenance.json' with { type: 'json' };
import { detectHandCrossings } from '../../model/grid';
import type { Hand, QuantizedGridScore, QuantizedNote } from '../../model/types';
import { layoutJankoScore, renderJankoPage, renderJankoCrop, countJankoPages } from './engine';
import { lintJankoScore } from './linter';
import { resolveJankoOptions, resolveJankoTokens } from './types';

export const SEMANTIC_STATE = '.semantic-candidate.local';
export const SEMANTIC_SCORE = 'brahms-op118-no1';
const digest = (value: unknown) => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex');
const engineFiles = ['src/scores/brahms-op118-no1.ts', 'src/scores/brahms-hand-corrections.ts', 'src/model/grid.ts'];
function renderingFiles(root: string) {
  return ['src/render/janko', 'src/render/janko/elements'].flatMap(dir =>
    readdirSync(resolve(root, dir)).filter(name => name.endsWith('.ts')).map(name => `${dir}/${name}`));
}
export function identityParts(root = process.cwd()) {
  const source = { source: digest(readFileSync(resolve(root, 'src/scores/data/brahms-op118-no1-written-durations.provenance.json'))),
    fixture: digest(readFileSync(resolve(root, 'src/scores/data/brahms-op118-no1-written-durations.json'))),
    pinnedSource: digest(readFileSync(resolve(root, 'data/sources/brahms-op118-no1/includes/intermezzo-op118-no1-parts.ily'))),
    midi: digest(readFileSync(resolve(root, 'public/midi/brahms-op118-no1.mid'))),
    silences: digest(readFileSync(resolve(root, 'src/scores/data/brahms-op118-no1-source-silences.json'))),
    expressions: digest(readFileSync(resolve(root, 'src/scores/data/brahms-op118-no1-expressions.json'))) };
  const engine = [...engineFiles, ...renderingFiles(root)].map(file => [file, digest(readFileSync(resolve(root, file)))]);
  return { source: digest(source), engine: digest(engine) };
}
// Retain the original fingerprint representation so existing saved histories remain readable.
export function modelIdentity(root = process.cwd()) {
  const files = { source: digest(readFileSync(resolve(root, 'src/scores/data/brahms-op118-no1-written-durations.provenance.json'))),
    fixture: digest(readFileSync(resolve(root, 'src/scores/data/brahms-op118-no1-written-durations.json'))),
    pinnedSource: digest(readFileSync(resolve(root, 'data/sources/brahms-op118-no1/includes/intermezzo-op118-no1-parts.ily'))),
    midi: digest(readFileSync(resolve(root, 'public/midi/brahms-op118-no1.mid'))),
    silences: digest(readFileSync(resolve(root, 'src/scores/data/brahms-op118-no1-source-silences.json'))),
    expressions: digest(readFileSync(resolve(root, 'src/scores/data/brahms-op118-no1-expressions.json'))),
    engine: [...engineFiles, ...renderingFiles(root)].map(file => [file, digest(readFileSync(resolve(root, file)))]) };
  return digest(files);
}
export interface Guard { id: string; pitchClass: number; octave: number; tick: number; expectedHand: Hand }
export interface HandIntent { schema: 1; score: typeof SEMANTIC_SCORE; base: string; intent: 'assign-hand'; target: Hand; scope: 'this' | 'set' | 'source-linked'; selected: Guard[]; reason?: string }
export interface Assignment { id: string; guard: Guard; hand: Hand; citation: string }
export interface CandidateRecord { revision: string; parent: string; operation: 'change' | 'undo'; assignments: Assignment[]; effects: Effects; reason?: string }
export interface CandidateState { schema: 1; identity: string; identityParts?: { source: string; engine: string }; records: CandidateRecord[] }
export interface CandidateHealth { state: 'current' | 'stale'; revision?: string; diagnostic?: string; recovery: string }
/** Read status without ever replaying a stale or corrupted saved candidate. */
export function candidateHealth(root = process.cwd(), path = SEMANTIC_STATE): CandidateHealth {
  const file = resolve(root, path);
  if (!existsSync(file)) return { state: 'current', revision: baseline(root), recovery: 'No saved candidate; use change with this revision.' };
  try {
    const state = readCandidate(root, path);
    return { state: 'current', revision: head(state, root), recovery: 'Use change or guarded undo.' };
  } catch (error) {
    let detail = 'saved candidate cannot be parsed or verified';
    try {
      const saved = JSON.parse(readFileSync(file, 'utf8')) as CandidateState;
      const current = identityParts(root);
      const differences = (['source','engine'] as const).filter(key => saved.identityParts?.[key] !== current[key]);
      detail = `saved identity ${saved.identity ?? 'missing'}; current identity ${modelIdentity(root)}; ` +
        (saved.identityParts ? `${differences.join(' and ') || 'history/base'} mismatch` : 'source/base/engine mismatch (legacy state has no component fingerprints)');
    } catch { /* keep parse error */ }
    return { state: 'stale', diagnostic: `${detail}; ${String(error)}`, recovery: 'Archive and create a new candidate with recover --json <guarded-request.json> (base from status); old history is retained verbatim.' };
  }
}
export interface ReviewWindow { measureStart: number; measureCount: number; changed: boolean }
export interface Effects { selected: Assignment[]; reviewWindows: ReviewWindow[]; crossings: [number, number]; rests: [number, number]; beams: [number, number]; brackets: [number, number]; tieOwners: [number, number]; durationOwners: [number, number]; tieOwnerChanges: { added: string[]; removed: string[] }; durationOwnerChanges: { added: string[]; removed: string[] }; changedPages: number[]; unchangedPages: number[]; changedSystems: number[]; unchangedSystems: number[]; changedCrops: string[]; unchangedCrops: string[]; visible: 'CHANGED' | 'NO_VISIBLE_EFFECT'; lint: { violations: number; warnings: number } }
const sourceEvents = provenance.events;
const options = resolveJankoOptions(BRAHMS_OP118_NO1_JANKO_OPTIONS);
const tokens = resolveJankoTokens(BRAHMS_OP118_NO1_JANKO_TOKENS);
const keyOf = (n: { pitchClass: number; octave: number; startTick: number }) => `${n.pitchClass}|${n.octave}|${n.startTick}`;
const noteKey = (n: QuantizedNote) => keyOf({ ...n.pitch, startTick: n.startTick });
function evidence(note: QuantizedNote) {
  const matches = sourceEvents.filter(e => keyOf(e) === noteKey(note));
  if (matches.length !== 1 || matches[0].unison || matches[0].segments.length !== 1 || matches[0].voices.length !== 1)
    throw new Error(`ambiguous/missing source statement for ${note.id} (${matches.length} matches); no edit applied`);
  return matches[0];
}
function sourceKey(event: typeof sourceEvents[number]) {
  const s = event.segments[0];
  // Pinned source/fixture identity plus authored statement, never a pitch-pattern search.
  return `${s.file}|${s.line}|${s.col}|${s.voice}|${s.midi}|${s.duration}|${s.tieForward}|${s.tieWait}`;
}
function citation(event: typeof sourceEvents[number]) {
  const s = event.segments[0];
  return `${s.file}:${s.line}:${s.col} ${s.voice}, bar ${s.bar}, occurrence ${s.occurrence}`;
}
export function projectCandidate(score: QuantizedGridScore, assignments: readonly Assignment[]): QuantizedGridScore {
  const byId = new Map(assignments.map(a => [a.id, a]));
  if (byId.size !== assignments.length) throw new Error('duplicate assignment');
  const seen = new Set<string>();
  const notes = score.notes.map(n => {
    const a = byId.get(n.id);
    if (!a) return n;
    seen.add(n.id);
    if (n.pitch.pitchClass !== a.guard.pitchClass || n.pitch.octave !== a.guard.octave || n.startTick !== a.guard.tick)
      throw new Error(`candidate source drift: ${n.id}`);
    return { ...n, hand: a.hand, editorialHand: { hand: a.hand, kind: (n.hand === a.hand ? 'confirm' : 'flip') as 'confirm' | 'flip', authorityId: `semantic:${n.id}` } };
  });
  if (seen.size !== byId.size) throw new Error('candidate target missing');
  const next = { ...score, notes };
  next.handCrossings = detectHandCrossings(next);
  return next;
}
export function baseline(root = process.cwd()) { return digest({ identity: modelIdentity(root), score: SEMANTIC_SCORE, schema: 1 }); }
export function readCandidate(root = process.cwd(), path = SEMANTIC_STATE): CandidateState {
  const identity = modelIdentity(root);
  if (!existsSync(resolve(root, path))) return { schema: 1, identity, identityParts: identityParts(root), records: [] };
  const state = JSON.parse(readFileSync(resolve(root, path), 'utf8')) as CandidateState;
  if (state.schema !== 1 || state.identity !== identity || !Array.isArray(state.records) ||
    (state.identityParts && JSON.stringify(state.identityParts) !== JSON.stringify(identityParts(root))))
    throw new Error('candidate source/model/engine revision drift; refusing stale state');
  let parent = baseline(root);
  for (const record of state.records) {
    if (record.parent !== parent || record.revision !== digest({ identity, parent, operation: record.operation, assignments: record.assignments, effects: record.effects, reason: record.reason }))
      throw new Error('candidate history fingerprint mismatch');
    parent = record.revision;
  }
  return state;
}
export const head = (state: CandidateState, root = process.cwd()) => state.records.at(-1)?.revision ?? baseline(root);
export const activeAssignments = (state: CandidateState) => state.records.at(-1)?.assignments ?? [];
export function candidateScore(state: CandidateState) { return projectCandidate(buildBrahmsOp118No1Score(), activeAssignments(state)); }
export function resolveLinkedOccurrences(
  origin: typeof sourceEvents[number], score: QuantizedGridScore,
  events: readonly (typeof sourceEvents[number])[] = sourceEvents
): QuantizedNote[] {
  const s = origin.segments[0];
  const sameLocation = events.filter(e => e.segments.some(p => p.file === s.file && p.line === s.line && p.col === s.col && p.voice === s.voice));
  if (sameLocation.some(e => e.unison || e.segments.length !== 1 || e.voices.length !== 1 || sourceKey(e) !== sourceKey(origin)))
    throw new Error('macro/source identity collision at selected statement; no edit applied');
  if (!sameLocation.length || new Set(sameLocation.map(e => e.segments[0].occurrence)).size !== sameLocation.length)
    throw new Error('ambiguous source-linked occurrences');
  return sameLocation.map(e => {
    const matches = score.notes.filter(n => noteKey(n) === keyOf(e));
    if (matches.length !== 1 || (events === sourceEvents && evidence(matches[0]) !== e))
      throw new Error(`ambiguous source-linked match at tick ${e.startTick}`);
    return matches[0];
  });
}
function resolveIntent(intent: HandIntent, score: QuantizedGridScore, current: readonly Assignment[]): Assignment[] {
  if (intent.schema !== 1 || intent.score !== SEMANTIC_SCORE || intent.intent !== 'assign-hand' || !['RH', 'LH'].includes(intent.target) || !['this','set','source-linked'].includes(intent.scope) || !Array.isArray(intent.selected) || intent.selected.length < 1 || (intent.scope !== 'set' && intent.selected.length !== 1)) throw new Error('invalid/unsupported hand intent or selection');
  const currentMap = new Map(current.map(a => [a.id, a]));
  const byId = new Map(score.notes.map(n => [n.id, n]));
  const selected = intent.selected.map(g => {
    const n = byId.get(g.id);
    if (!n || n.pitch.pitchClass !== g.pitchClass || n.pitch.octave !== g.octave || n.startTick !== g.tick || n.hand !== g.expectedHand)
      throw new Error(`guard mismatch for ${g.id}: expected ${g.expectedHand} pc ${g.pitchClass} octave ${g.octave} tick ${g.tick}`);
    return n;
  });
  if (new Set(selected.map(n => n.id)).size !== selected.length) throw new Error('duplicate selection');
  let targets = selected;
  if (intent.scope === 'source-linked') {
    const origin = evidence(selected[0]);
    targets = resolveLinkedOccurrences(origin, score);
    if (targets.some(n => n.hand !== selected[0].hand)) throw new Error('source-linked hand mismatch');
  }
  return targets.map(n => {
    const e = evidence(n);
    const previous = currentMap.get(n.id);
    return { id: n.id, guard: previous?.guard ?? { id: n.id, pitchClass: n.pitch.pitchClass, octave: n.pitch.octave, tick: n.startTick, expectedHand: n.hand }, hand: intent.target, citation: citation(e) };
  });
}
function geometry(score: QuantizedGridScore) {
  const layouts = layoutJankoScore(score, options, tokens);
  const pages = Array.from({ length: countJankoPages(score, options, tokens) }, (_, i) => digest(renderJankoPage(score, i, options, tokens, layouts)));
  const systems = layouts.map((_, i) => digest(renderJankoCrop(score, i * options.measuresPerSystem + 1, options.measuresPerSystem, options, tokens, undefined, layouts)));
  const count = (name: 'rests' | 'beams') => layouts.reduce((sum, l) => sum + l[name].length, 0);
  const tieOwners = layouts.flatMap(l => l.tieOriginSuppressions.map(t => `${t.noteId}:${t.component}:${t.toHeadId}`));
  const durationOwners = layouts.flatMap(l => l.durationInkOwners.map(d => `${d.mount}:${d.run}:${d.tick}:${d.ownerIds.join(',')}`));
  return { pages, systems, layouts, rests: count('rests'), beams: count('beams'), brackets: layouts.reduce((sum,l) => sum + l.clasps.length, 0), crossings: score.handCrossings?.length ?? 0,
    tieOwners, durationOwners };
}
export function compareCandidate(before: QuantizedGridScore, after: QuantizedGridScore, selected: Assignment[], active: readonly Assignment[] = selected): Effects {
  const a = geometry(before), b = geometry(after);
  const changedPages = b.pages.flatMap((h,i) => h !== a.pages[i] ? [i+1] : []);
  const changedSystems = b.systems.flatMap((h,i) => h !== a.systems[i] ? [i+1] : []);
  // A crop must contain the actual affected ink, not merely a hand-picked sample.
  // Show whole changed systems; also show every selected system even when the
  // edit is visually inert. The same exact windows are compared and rendered.
  const anacrusis = tokens.anacrusisTicks ?? 0;
  const selectedSystems = [...selected, ...active].map(({ guard }) =>
    Math.floor(Math.max(0, guard.tick - anacrusis) / (tokens.ticksPerMeasure * options.measuresPerSystem)) + 1);
  const systemNumbers = [...new Set([...changedSystems, ...selectedSystems])].sort((x,y) => x-y);
  const measureTotal = Math.ceil(after.totalTicks / tokens.ticksPerMeasure);
  const reviewWindows: ReviewWindow[] = systemNumbers.map(system => {
    if (system < 1 || system > b.layouts.length) throw new Error(`selected system ${system} is outside candidate score`);
    const measureStart = (system-1) * options.measuresPerSystem + 1;
    const measureCount = Math.min(options.measuresPerSystem, measureTotal - measureStart + 1);
    if (measureCount < 1) throw new Error(`empty candidate window at system ${system}`);
    return { measureStart, measureCount, changed: changedSystems.includes(system) };
  });
  const cropLabel = ({ measureStart, measureCount }: ReviewWindow) => `mm.${measureStart}–${measureStart + measureCount - 1}`;
  const cropChanged = (window: ReviewWindow) => digest(renderJankoCrop(before, window.measureStart, window.measureCount, options, tokens, undefined, a.layouts)) !==
    digest(renderJankoCrop(after, window.measureStart, window.measureCount, options, tokens, undefined, b.layouts));
  const changedCrops = reviewWindows.filter(cropChanged).map(cropLabel);
  const unchangedCrops = reviewWindows.filter(w => !changedCrops.includes(cropLabel(w))).map(cropLabel);
  const ownerDiff = (old: string[], next: string[]) => ({
    added: next.filter(id => !old.includes(id)), removed: old.filter(id => !next.includes(id)),
  });
  const lint = lintJankoScore(after, options, tokens);
  if (lint.violations.length) throw new Error(`candidate engraving validation failed: ${lint.violations.map(v => v.message).slice(0,3).join('; ')}`);
  return { selected, reviewWindows, crossings: [a.crossings,b.crossings], rests: [a.rests,b.rests], beams: [a.beams,b.beams], brackets: [a.brackets,b.brackets], tieOwners: [a.tieOwners.length,b.tieOwners.length], durationOwners: [a.durationOwners.length,b.durationOwners.length], tieOwnerChanges: ownerDiff(a.tieOwners, b.tieOwners), durationOwnerChanges: ownerDiff(a.durationOwners, b.durationOwners), changedPages, unchangedPages: b.pages.flatMap((_,i) => changedPages.includes(i+1) ? [] : [i+1]), changedSystems, unchangedSystems: b.systems.flatMap((_,i) => changedSystems.includes(i+1) ? [] : [i+1]), changedCrops, unchangedCrops, visible: changedPages.length ? 'CHANGED' : 'NO_VISIBLE_EFFECT', lint: { violations: lint.violations.length, warnings: lint.warnings.length } };
}
function persist(root: string, path: string, state: CandidateState, operation: CandidateRecord['operation'], assignments: Assignment[], effects: Effects, reason?: string) {
  const parent = head(state, root);
  const revision = digest({ identity: state.identity, parent, operation, assignments, effects, reason });
  const next = { ...state, records: [...state.records, { parent, revision, operation, assignments, effects, ...(reason ? { reason } : {}) }] };
  const dest = resolve(root, path), temp = `${dest}.${process.pid}.tmp`;
  try { writeFileSync(temp, JSON.stringify(next, null, 2) + '\n', { flag: 'wx', mode: 0o600 }); renameSync(temp, dest); }
  finally { if (existsSync(temp)) unlinkSync(temp); }
  return { revision, effects };
}
function prepareChange(state: CandidateState, request: HandIntent, root: string):
  { replay: true; revision: string; effects: Effects } | { replay: false; assignments: Assignment[]; effects: Effects } {
  const old = candidateScore(state);
  if (request.base !== head(state, root)) throw new Error('stale candidate base');
  const incoming = resolveIntent(request, old, activeAssignments(state));
  const byId = new Map(activeAssignments(state).map(a => [a.id, a]));
  for (const a of incoming) byId.set(a.id, a);
  const assignments = [...byId.values()].sort((a,b) => a.id.localeCompare(b.id));
  if (JSON.stringify(assignments) === JSON.stringify(activeAssignments(state)))
    return { replay: true, revision: head(state, root), effects: compareCandidate(old, old, incoming, assignments) };
  const effects = compareCandidate(old, projectCandidate(buildBrahmsOp118No1Score(), assignments), incoming, assignments);
  return { replay: false, assignments, effects };
}
/** Explicit stale-history rollover. Preflight the guarded change before moving any bytes. */
export function recoverHandCandidate(request: HandIntent, root = process.cwd(), path = SEMANTIC_STATE) {
  const lock = resolve(root, `${path}.lock`);
  let fd: number;
  try { fd = openSync(lock, 'wx', 0o600); } catch { throw new Error('candidate writer busy; retry'); }
  try {
    const file = resolve(root, path);
    if (!existsSync(file) || candidateHealth(root, path).state !== 'stale')
      throw new Error('recover requires a stale saved candidate; no history moved');
    const original = readFileSync(file);
    const state: CandidateState = { schema: 1, identity: modelIdentity(root), identityParts: identityParts(root), records: [] };
    const prepared = prepareChange(state, request, root);
    if (prepared.replay) throw new Error('recover requires a new candidate with changed assignments');
    const archive = `${file}.archive-${Date.now()}-${digest(original).slice(0, 16)}`;
    if (existsSync(archive)) throw new Error('archive already exists; retry');
    // Rename preserves every original byte; never remove or rewrite the archive.
    renameSync(file, archive);
    try {
      const result = persist(root, path, state, 'change', prepared.assignments, prepared.effects, request.reason);
      return { ...result, replay: false, archive, archiveSha256: digest(original) };
    } catch (error) {
      // Restore the old default path if publication fails; its history remains intact.
      if (existsSync(file)) unlinkSync(file);
      renameSync(archive, file);
      throw error;
    }
  } finally { closeSync(fd); unlinkSync(lock); }
}
export function executeHandCommand(command: { action: 'change'; request: HandIntent } | { action: 'undo'; base: string; revision: string }, root = process.cwd(), path = SEMANTIC_STATE) {
  const lock = resolve(root, `${path}.lock`);
  let fd: number;
  try { fd = openSync(lock, 'wx', 0o600); } catch { throw new Error('candidate writer busy; retry'); }
  try {
    const state = readCandidate(root, path), old = candidateScore(state);
    if (command.action === 'change') {
      const result = prepareChange(state, command.request, root);
      if (result.replay) return result;
      return { ...persist(root, path, state, 'change', result.assignments, result.effects, command.request.reason), replay: false };
    }
    if (command.base !== head(state, root) || state.records.at(-1)?.revision !== command.revision) throw new Error('stale/unknown undo revision');
    const previous = state.records.length > 1 ? state.records.at(-2)!.assignments : [];
    const effects = compareCandidate(old, projectCandidate(buildBrahmsOp118No1Score(), previous), activeAssignments(state), previous);
    return { ...persist(root, path, state, 'undo', previous, effects), replay: false };
  } finally { closeSync(fd); unlinkSync(lock); }
}
