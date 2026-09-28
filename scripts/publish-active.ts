#!/usr/bin/env node
/** Trusted persistent-checkout publisher: one guarded score/data/PDF commit. */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, existsSync, mkdtempSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { buildIdentity } from '../src/render/janko/prepared/seam';
import { resolveActiveScore, type ActiveData } from '../src/scores/active';
import { countJankoPages, renderJankoPage } from '../src/render/janko/engine';
import type { CanonicalHistory } from '../src/render/janko/active-transaction';
const root = process.cwd(), dataPath = 'src/scores/data/active-scores.json', pdfPath = 'public/goldberg-variation-1.pdf';
const metaPath = 'data/active-release.json', statusPath = '.canonical-publication.local';
const sha = (v: Uint8Array | string) => createHash('sha256').update(v).digest('hex');
const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const saveStatus = (state: string, revision: string, score: string, detail?: string) => {
  const file = resolve(root, statusPath), temp = `${file}.${process.pid}.tmp`;
  const previous = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) as { scores?: Record<string, unknown> } : {};
  try { writeFileSync(temp, JSON.stringify({ scores: { ...previous.scores,
    [score]: { state, revision, detail, updatedAt: new Date().toISOString() } } }) + '\n', { flag: 'wx', mode: 0o600 }); renameSync(temp, file); }
  finally { if (existsSync(temp)) rmSync(temp); }
};
function proveDeployment(score: string, revision: string, pdfHash: string) {
  return async () => {
    const url = 'https://qqp-dev.github.io/iso-notation/active-release.json';
    const end = Date.now() + 10 * 60_000;
    for (; Date.now() < end; ) {
      try {
        const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
        if (response.ok) {
          const manifest = await response.json() as { canonicalRevisions: Record<string,string>; pdf: { url: string; sha256: string } };
          if (manifest.canonicalRevisions[score] === revision && manifest.pdf.sha256 === pdfHash) {
            const pdfUrl = new URL(manifest.pdf.url, url);
            if (pdfUrl.origin !== new URL(url).origin) throw new Error('foreign deployed PDF URL');
            const pdf = await fetch(pdfUrl, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
            if (pdf.ok && sha(new Uint8Array(await pdf.arrayBuffer())) === pdfHash) return;
          }
        }
      } catch { /* asynchronous Pages propagation: retry, never announce deployment yet */ }
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    throw new Error('Pages manifest/PDF not yet verified; last deployed release remains public');
  };
}
async function publish() {
  const home = process.env.JANKO_DEPLOY_CHECKOUT;
  if (!home || resolve(home) !== resolve(root) || root.includes('/.qq-worktrees/') || git('branch', '--show-current') !== 'main')
    throw new Error('publishing requires the designated clean persistent main checkout');
  const lock = resolve(root, '.canonical-publisher.local.lock');
  let fd: number;
  try { fd = openSync(lock, 'wx', 0o600); } catch { throw new Error('publisher busy; retry'); }
  let revision = 'unknown', releaseScore = 'unknown';
  try {
    const data = JSON.parse(readFileSync(dataPath, 'utf8')) as ActiveData;
    const history = JSON.parse(readFileSync('.canonical-history.local', 'utf8')) as CanonicalHistory;
    const record = history.records.at(-1);
    if (!record || record.revision !== data.scores[record.score].revision)
      throw new Error('missing exact guarded active revision');
    revision = record.revision;
    releaseScore = record.score;
    const pending = existsSync(statusPath) ? (JSON.parse(readFileSync(statusPath, 'utf8')) as { scores?: Record<string, { state?: string; revision?: string }> }).scores?.[record.score] : undefined;
    if (pending?.state === 'deployed' && pending.revision === revision) return { state: 'deployed', revision, replay: true };
    // A prior push can succeed while Pages is still propagating (or a poll
    // times out). Never make another release commit for the same revision.
    if (pending?.revision === revision && existsSync(metaPath) &&
        (JSON.parse(readFileSync(metaPath, 'utf8')) as { revision?: string }).revision === revision &&
        !git('status', '--porcelain', '--untracked-files=no') &&
        git('ls-remote', 'origin', 'refs/heads/main').split(/\s+/)[0] === git('rev-parse', 'HEAD')) {
      const pdfHash = (JSON.parse(readFileSync(metaPath, 'utf8')) as { pdfSha256: string }).pdfSha256;
      await proveDeployment(releaseScore, revision, pdfHash)();
      saveStatus('deployed', revision, releaseScore, 'matching Pages manifest and PDF verified after retry');
      return { state: 'deployed', revision, replay: true };
    }
    const changed = git('status', '--porcelain', '--untracked-files=no').split('\n').filter(Boolean);
    if (changed.some(line => ![dataPath, pdfPath, metaPath].includes(line.slice(3)))) throw new Error('unreviewed checkout changes; refuse data-only publisher');
    if (git('diff', '--cached', '--name-only')) throw new Error('index not empty; refuse publication');
    const head = git('rev-parse', 'HEAD');
    const remote = git('ls-remote', 'origin', 'refs/heads/main').split(/\s+/)[0];
    if (head !== remote) throw new Error('remote main moved; refuse implicit rebase');
    const bach = resolveActiveScore('bach-goldberg-var1', data);
    const svgSource = Array.from({ length: countJankoPages(bach.score, bach.options, bach.tokens) }, (_, i) =>
      renderJankoPage(bach.score, i, bach.options, bach.tokens)).join('\n');
    saveStatus('pending', revision, releaseScore, 'approved locally; PDF/release bundle under preparation');
    const dir = mkdtempSync(join(tmpdir(), 'janko-publish-'));
    try {
      const pdf = join(dir, 'matching.pdf');
      execFileSync('npm', ['run', 'pdf', '--', '--out', pdf], { cwd: root, stdio: 'pipe', timeout: 120000 });
      const bytes = readFileSync(pdf);
      const pdfHash = sha(bytes);
      const dest = resolve(root, pdfPath), temp = `${dest}.${process.pid}.tmp`;
      try { writeFileSync(temp, bytes, { flag: 'wx' }); renameSync(temp, dest); }
      finally { if (existsSync(temp)) rmSync(temp); }
      const request = record.request;
      if (sha(JSON.stringify(request)) !== record.requestHash) throw new Error('request provenance mismatch');
      const previous = history.records.filter(entry => entry.score === record.score).at(-2);
      const metadata = { schema: 1, score: record.score, parent: record.parent, revision, operation: record.operation, request,
        ...(record.operation === 'undo' ? { undoTargetRevision: previous?.before.revision } : {}),
        pdfSha256: pdfHash, engineIdentity: buildIdentity(root), sourceHash: sha(svgSource) };
      if (record.operation === 'undo' && !previous) throw new Error('undo provenance missing');
      writeFileSync(metaPath, JSON.stringify(metadata, null, 2) + '\n');
      git('add', '--', dataPath, pdfPath, metaPath);
      const staged = git('diff', '--cached', '--name-only').split('\n').filter(Boolean);
      if (!staged.includes(dataPath) || !staged.includes(metaPath) || staged.some(file => ![dataPath, pdfPath, metaPath].includes(file)))
        throw new Error('release bundle incomplete');
      git('commit', '-m', `data: active ${record.score} ${revision.slice(0, 12)}`);
      const commit = git('rev-parse', 'HEAD');
      if (git('ls-remote', 'origin', 'refs/heads/main').split(/\s+/)[0] !== head) throw new Error('remote head changed before push');
      git('push', 'origin', 'HEAD:main');
      saveStatus('pending', revision, releaseScore, `commit ${commit} submitted; waiting on Pages`);
      await proveDeployment(releaseScore, revision, pdfHash)();
      saveStatus('deployed', revision, releaseScore, `commit ${commit}; manifest and PDF verified`);
      return { state: 'deployed', revision, commit };
    } finally { rmSync(dir, { recursive: true, force: true }); }
  } catch (error) {
    saveStatus('failed', revision, releaseScore, String(error));
    throw error;
  } finally { closeSync(fd); rmSync(lock); }
}
publish().then(result => console.log(JSON.stringify(result))).catch(error => { console.error(String(error)); process.exitCode = 1; });
