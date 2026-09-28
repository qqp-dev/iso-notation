#!/usr/bin/env node
/** Preservation-first PR111 candidate migration; never writes the legacy checkout. */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { readCandidate, head, executeHandCommand, activeDurationVariants, candidateScore } from '../src/render/janko/semantic-hand';
import { resolveActiveScore } from '../src/scores/active';
import { renderJankoPage, countJankoPages } from '../src/render/janko/engine';
const sha = (s: string | Uint8Array) => createHash('sha256').update(s).digest('hex');
const args = process.argv.slice(2);
const option = (name: string) => { const i = args.indexOf(`--${name}`); return i < 0 ? undefined : args[i + 1]; };
const oldRoot = option('old-root') && resolve(option('old-root')!);
const newRoot = process.cwd();
if (!oldRoot || oldRoot === newRoot || !process.env.JANKO_DEPLOY_CHECKOUT ||
    resolve(process.env.JANKO_DEPLOY_CHECKOUT) !== newRoot || newRoot.includes('/.qq-worktrees/'))
  throw new Error('migration requires separate protected old root and designated persistent clean checkout');
const original = join(oldRoot, '.semantic-candidate.local');
const saved = readFileSync(original);
const rawSha256 = sha(saved);
const capture = `
import { readCandidate, candidateScore, activeDurationVariants } from './src/render/janko/semantic-hand.ts';
import { buildBrahmsOp118No1Score, BRAHMS_OP118_NO1_JANKO_OPTIONS, BRAHMS_OP118_NO1_JANKO_TOKENS } from './src/scores/brahms-op118-no1.ts';
import { countJankoPages, renderJankoPage } from './src/render/janko/engine.ts';
const state = readCandidate(process.cwd());
const score = candidateScore(state), base = buildBrahmsOp118No1Score();
const pages = (s, o, t) => Array.from({length:countJankoPages(s,o,t)},(_,i)=>renderJankoPage(s,i,o,t));
console.log(JSON.stringify({identity:state.identity, records:state.records.length, assignments:state.records.at(-1)?.assignments ?? [],
  notes:base.notes, options:BRAHMS_OP118_NO1_JANKO_OPTIONS, tokens:BRAHMS_OP118_NO1_JANKO_TOKENS,
  canonical:pages(base,BRAHMS_OP118_NO1_JANKO_OPTIONS,BRAHMS_OP118_NO1_JANKO_TOKENS),
  variants:activeDurationVariants(state).map(v=>({controls:v, pages:pages(score,{...BRAHMS_OP118_NO1_JANKO_OPTIONS,...v.options,
    durationSeatPreferences:v.placements.map(p=>({tick:p.target.tick,family:p.target.family,ownerIds:p.target.ownerIds,seat:p.preference}))},
    {...BRAHMS_OP118_NO1_JANKO_TOKENS,...v.tokens})}))}));
`;
// The *original engine and original verifier* must accept the old record chain
// before any projection or migration. This subprocess is strictly read-only.
const originalOutput = execFileSync(process.execPath, ['--import', 'tsx', '-e', capture],
  { cwd: oldRoot, encoding: 'utf8', timeout: 120000, maxBuffer: 80 * 1024 * 1024 });
const proof = JSON.parse(originalOutput) as { identity: string; records: number; assignments: unknown[]; notes: unknown[];
  options: Record<string, unknown>; tokens: Record<string, unknown>; canonical: string[];
  variants: Array<{ controls: ReturnType<typeof activeDurationVariants>[number]; pages: string[] }> };
if (proof.records !== 8 || proof.variants.length !== 4 || proof.assignments.length || proof.canonical.length !== 5 ||
    proof.variants.some(v => v.pages.length !== 5)) throw new Error('unexpected protected legacy history/geometry; stop activation');
const active = resolveActiveScore('brahms-op118-no1');
if (JSON.stringify(proof.notes) !== JSON.stringify(active.score.notes)) throw new Error('Brahms musical event difference; stop activation');
const pages = (options: typeof active.options, tokens: typeof active.tokens) => Array.from({ length: countJankoPages(active.score, options, tokens) },
  (_, page) => renderJankoPage(active.score, page, options, tokens));
// The legacy renderer may have emitted nonpainting comments between SVG tags.
// Discard only those standalone comments; keep every element, attribute, text
// node and whitespace byte-for-byte. In particular, never normalize paths or
// silently accept a changed painted element as an identity change.
const paintedSvg = (svg: string) => svg.replace(/(?<=>)(\s*)<!--[\s\S]*?-->(\s*)(?=<)/g,
  (_comment, before: string, after: string) => before || after);
const compare = (label: string, oldPages: string[], nextPages: string[]) => {
  if (oldPages.length !== nextPages.length || oldPages.some((svg, page) => paintedSvg(svg) !== paintedSvg(nextPages[page])))
    throw new Error(`${label}: real full-SVG geometry differs; stop activation and inspect actual diff before service switch`);
};
// Save original bytes and every full real SVG in a private durable archive
// *before* attempting a write to a new candidate path.
const archive = resolve(newRoot, 'archive', `legacy-pr111-${rawSha256.slice(0, 16)}`);
if (existsSync(archive)) throw new Error('archive exists; inspect instead of overwriting');
mkdirSync(archive, { recursive: true, mode: 0o700 });
writeFileSync(join(archive, 'original-history.json'), saved, { flag: 'wx', mode: 0o600 });
writeFileSync(join(archive, 'original-full-svg.json.gz'), gzipSync(originalOutput), { flag: 'wx', mode: 0o600 });
writeFileSync(join(archive, 'provenance.json'), JSON.stringify({ oldRoot, rawSha256, oldIdentity: proof.identity,
  recordCount: proof.records, variants: proof.variants.map(v => v.controls.id), originalTip: execFileSync('git', ['rev-parse','HEAD'], { cwd: oldRoot, encoding: 'utf8' }).trim() }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
if (sha(readFileSync(join(archive, 'original-history.json'))) !== rawSha256) throw new Error('archive checksum mismatch');
compare('canonical Brahms', proof.canonical, pages(active.options, active.tokens));
for (const { controls, pages: oldPages } of proof.variants) {
  const options = { ...active.options, ...controls.options, durationSeatPreferences: controls.placements.map(p =>
    ({ tick: p.target.tick, family: p.target.family, ownerIds: p.target.ownerIds, seat: p.preference })) };
  compare(`variant ${controls.id}`, oldPages, pages(options, { ...active.tokens, ...controls.tokens }));
}
const destination = resolve(newRoot, '.semantic-candidate.local'), temporary = resolve(newRoot, '.semantic-candidate-migration.local');
if (existsSync(destination) || existsSync(temporary)) throw new Error('new history already exists; no overwrite');
const lock = `${temporary}.migration.lock`;
const fd = openSync(lock, 'wx', 0o600);
try {
  let revision = head(readCandidate(newRoot, temporary), newRoot);
  for (const { controls } of proof.variants) {
    const result = executeHandCommand({ action: 'change', request: { schema: 1, intent: 'engrave-duration', score: 'brahms-op118-no1',
      base: revision, variantId: controls.id, options: controls.options, tokens: controls.tokens,
      placements: controls.placements, windows: controls.windows, reason: `Authorized legacy migration: ${rawSha256}` } },
      newRoot, temporary, undefined, 'brahms-op118-no1');
    revision = result.revision;
  }
  const next = readCandidate(newRoot, temporary);
  if (activeDurationVariants(next).length !== 4 || next.records.length !== 4 ||
      activeDurationVariants(next).map(v => v.id).join('|') !== proof.variants.map(v => v.controls.id).join('|'))
    throw new Error('new guarded variants incomplete; stop activation');
  renameSync(temporary, destination);
  console.log(JSON.stringify({ archive, rawSha256, legacyRecords: proof.records, migratedRecords: next.records.length,
    revision, pagesPerScore: 5, variants: activeDurationVariants(next).map(v => v.id), geometryParity: true }));
} finally { closeSync(fd); rmSync(lock); }
