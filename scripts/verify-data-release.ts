#!/usr/bin/env node
/** Data-only Pages gate; every other path takes the selected software contracts and production build. */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildIdentity } from '../src/render/janko/prepared/seam';
import { prepareCanonicalChange, validateCanonicalTransition, type CanonicalIntent } from '../src/render/janko/active-transaction';
import { resolveActiveScore, type ActiveData } from '../src/scores/active';
import { countJankoPages, renderJankoPage } from '../src/render/janko/engine';
import { pdfFingerprint } from './pdf-semantic';
const dataPath = 'src/scores/data/active-scores.json';
const metaPath = 'data/active-release.json';
const pdfPath = 'public/goldberg-variation-1.pdf';
const allowed = [dataPath, metaPath, pdfPath];
const sha = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const fail = (message: string): never => { throw new Error(`data release refused: ${message}`); };
function main() {
  const parent = git('rev-parse', 'HEAD^');
  const changed = git('diff', '--name-only', parent, 'HEAD').split('\n').filter(Boolean);
  if (!changed.includes(dataPath) || changed.some(path => !allowed.includes(path))) {
    console.log('software lane: no eligible data-only commit; selected release contracts and production build remain required');
    return;
  }
  if (!changed.includes(metaPath)) fail('exact bundle must contain data and provenance metadata');
  const oldData = JSON.parse(git('show', `${parent}:${dataPath}`)) as ActiveData;
  const data = JSON.parse(readFileSync(dataPath, 'utf8')) as ActiveData;
  const metadata = JSON.parse(readFileSync(metaPath, 'utf8')) as { schema: number; score: string; parent: string; operation: 'change' | 'undo';
    revision: string; undoTargetRevision?: string; request: CanonicalIntent | { base: string; revision: string }; pdfSha256: string; engineIdentity: string; sourceHash: string }; 
  if (metadata.schema !== 1 || Object.keys(metadata).sort().join('|') !==
    ['schema','score','parent','revision','operation','request','pdfSha256','engineIdentity','sourceHash',
      ...(metadata.operation === 'undo' ? ['undoTargetRevision'] : [])].sort().join('|')) fail('invalid release provenance');
  const score = metadata.score;
  if (score !== 'bach-goldberg-var1' && score !== 'brahms-op118-no1') fail('unknown score');
  if (metadata.parent !== oldData.scores[score].revision || metadata.request.base !== metadata.parent ||
      metadata.revision !== data.scores[score].revision) fail('wrong parent or request');
  if (metadata.operation === 'change') {
    if (!('intent' in metadata.request) || metadata.request.score !== score) fail('wrong score in change request');
    const prepared = prepareCanonicalChange(oldData, metadata.request);
    if (prepared.replay || JSON.stringify(prepared.data) !== JSON.stringify(data)) fail('unauthorized semantic diff');
  } else if (metadata.operation === 'undo') {
    if ('intent' in metadata.request || metadata.request.revision !== metadata.parent) fail('wrong undo request');
    if (!metadata.undoTargetRevision) fail('missing undo target identity');
    // Only reverse the immediately preceding authenticated EDIT of this score.
    // An arbitrary ancestor with the requested revision is not undo provenance.
    const priorParent = git('rev-parse', `${parent}^`);
    const priorPaths = git('diff', '--name-only', priorParent, parent).split('\n').filter(Boolean);
    if (!priorPaths.includes(dataPath) || !priorPaths.includes(metaPath) || priorPaths.some(path => !allowed.includes(path)))
      fail('undo requires preceding approved edit');
    const prior = JSON.parse(git('show', `${parent}:${metaPath}`)) as typeof metadata;
    const earlier = JSON.parse(git('show', `${priorParent}:${dataPath}`)) as ActiveData;
    if (prior.schema !== 1 || prior.operation !== 'change' || prior.score !== score ||
      prior.parent !== earlier.scores[score].revision || prior.revision !== oldData.scores[score].revision ||
      prior.parent !== metadata.undoTargetRevision || !('intent' in prior.request) || prior.request.score !== score ||
      prior.request.base !== prior.parent || prior.engineIdentity !== metadata.engineIdentity ||
      prepareCanonicalChange(earlier, prior.request).replay ||
      JSON.stringify(prepareCanonicalChange(earlier, prior.request).data) !== JSON.stringify(oldData))
      fail('undo not authenticated preceding edit');
    validateCanonicalTransition(earlier, oldData, score);
    const priorBach = resolveActiveScore('bach-goldberg-var1', oldData);
    const priorSource = Array.from({ length: countJankoPages(priorBach.score, priorBach.options, priorBach.tokens) }, (_, page) =>
      renderJankoPage(priorBach.score, page, priorBach.options, priorBach.tokens)).join('\n');
    if (prior.sourceHash !== sha(priorSource) || prior.pdfSha256 !==
      sha(execFileSync('git', ['show', `${parent}:${pdfPath}`]))) fail('undo predecessor release provenance mismatch');
    if (JSON.stringify(earlier.scores[score].assignments) !== JSON.stringify(data.scores[score].assignments) ||
      JSON.stringify(earlier.scores[score].duration) !== JSON.stringify(data.scores[score].duration)) fail('undo not authenticated previous state');
  } else fail('unsupported operation');
  validateCanonicalTransition(oldData, data, score);
  if (metadata.engineIdentity !== buildIdentity(process.cwd())) fail('wrong engine/source/build identity');
  const bach = resolveActiveScore('bach-goldberg-var1', data);
  const source = Array.from({ length: countJankoPages(bach.score, bach.options, bach.tokens) }, (_, page) =>
    renderJankoPage(bach.score, page, bach.options, bach.tokens)).join('\n');
  if (sha(source) !== metadata.sourceHash) fail('PDF SVG source fingerprint mismatch');
  if (sha(readFileSync(pdfPath)) !== metadata.pdfSha256) fail('wrong committed PDF fingerprint');
  const dir = mkdtempSync(join(tmpdir(), 'janko-release-check-'));
  try {
    const out = join(dir, 'regenerated.pdf');
    execFileSync(process.execPath, ['--import', 'tsx', 'scripts/export-pdf.ts', '--out', out], { stdio: 'pipe' });
    if (JSON.stringify(pdfFingerprint(out, bach.options.title)) !== JSON.stringify(pdfFingerprint(pdfPath, bach.options.title)))
      fail('PDF semantic fingerprint does not match exact active revision');
  } finally { rmSync(dir, { recursive: true, force: true }); }
  console.log(`data-only release verified: ${score} ${metadata.revision}`);
}
try { main(); } catch (error) { console.error(String(error)); process.exitCode = 1; }
