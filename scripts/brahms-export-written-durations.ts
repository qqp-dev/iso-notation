#!/usr/bin/env node
/**
 * Brahms written-durations offline exporter (configured command only).
 *
 * Usage:
 *   npm run brahms:export-durations          # regenerate fixture + provenance
 *   npm run brahms:export-durations -- --check   # verify committed files match a fresh export
 *   LILYPOND_BIN=/path/to/lilypond npm run brahms:export-durations
 *
 * Verifies the pinned manifest, runs LilyPond's own parser (repeat unfolding
 * + pre-playback NoteEvent listener, page printing disabled) twice, requires
 * byte-identical raw evidence, normalizes via the pure helper and writes
 * versioned JSON. Never creates SVG/PDF/PNG; transient compiler text stays
 * in temp dirs. Ordinary tests/build never invoke this (no compiler needed).
 */

import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BrahmsRawSilence,
  normalizeSourceSilences,
  normalizeWrittenDurations,
} from '../src/scores/brahms-source-fidelity';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..');
const VENDORED_ROOT = path.join(REPO_ROOT, 'data', 'sources', 'brahms-op118-no1');
const MANIFEST_PATH = path.join(VENDORED_ROOT, 'manifest.json');
const LISTENER_PATH = path.join(REPO_ROOT, 'scripts', 'brahms-written-durations-listener.ly');
const PARTS_PATH = path.join(VENDORED_ROOT, 'includes', 'intermezzo-op118-no1-parts.ily');
const FIXTURE_PATH = path.join(REPO_ROOT, 'src', 'scores', 'data', 'brahms-op118-no1-written-durations.json');
const PROVENANCE_PATH = path.join(
  REPO_ROOT,
  'src',
  'scores',
  'data',
  'brahms-op118-no1-written-durations.provenance.json'
);
/** Round 48: the source's authored silences (rests versus spacers). */
const SILENCES_PATH = path.join(
  REPO_ROOT,
  'src',
  'scores',
  'data',
  'brahms-op118-no1-source-silences.json'
);

const args = new Set(process.argv.slice(2));
const CHECK = args.has('--check');
for (const a of args) {
  if (a !== '--check') {
    console.error(`Unknown flag ${a} (only --check is supported)`);
    process.exit(2);
  }
}

function sha256Hex(data: string | Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}
function md5Hex(data: Buffer): string {
  return crypto.createHash('md5').update(data).digest('hex');
}

interface ManifestSource {
  path: string;
  bytes: number;
  md5: string;
  sha256: string;
  gitBlob: string;
}
interface Manifest {
  schemaVersion: number;
  exporterVersion: number;
  upstream: { repo: string; commit: string; attribution: string; licenseFile: string };
  compiler: { testedVersion: string };
  sources: ManifestSource[];
}

function verifyManifest(): Manifest {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')) as Manifest;
  if (manifest.schemaVersion !== 1 || manifest.exporterVersion !== 1) {
    throw new Error(`Unsupported manifest versions (want schema 1 / exporter 1): ${MANIFEST_PATH}`);
  }
  for (const s of manifest.sources) {
    const full = path.join(VENDORED_ROOT, s.path);
    if (!fs.existsSync(full)) throw new Error(`Vendored source missing: ${s.path}`);
    const data = fs.readFileSync(full);
    if (data.length !== s.bytes) {
      throw new Error(`${s.path}: bytes ${data.length} != pinned ${s.bytes}`);
    }
    const md5 = md5Hex(data);
    if (md5 !== s.md5) throw new Error(`${s.path}: md5 ${md5} != pinned ${s.md5}`);
    const sha = sha256Hex(data);
    if (sha !== s.sha256) throw new Error(`${s.path}: sha256 mismatch`);
  }
  if (!fs.existsSync(LISTENER_PATH)) throw new Error(`Listener missing: ${LISTENER_PATH}`);
  return manifest;
}

function findCompiler(): { bin: string; version: string; guile: string } {
  const bin = process.env.LILYPOND_BIN || 'lilypond';
  let out: string;
  try {
    out = execFileSync(bin, ['--version'], { encoding: 'utf8', timeout: 60000 });
  } catch (err) {
    throw new Error(
      `Cannot run LilyPond compiler "${bin}" (--version failed). ` +
        `Install LilyPond 2.24+ or set LILYPOND_BIN. ${err instanceof Error ? err.message : String(err)}`
    );
  }
  const m = /GNU LilyPond (\d+\.\d+\.\d+)(?:\s*\(running Guile ([\d.]+)\))?/.exec(out);
  if (!m) throw new Error(`Unparseable lilypond --version output: ${out.slice(0, 200)}`);
  return { bin, version: m[1], guile: m[2] ?? 'unknown' };
}

function writeWrapper(outDir: string, compilerVersion: string): string {
  // Absolute paths here are transient (temp wrapper only); provenance records
  // logical relative paths via basename mapping. No machine-local paths leak.
  // 2.26 removed ly:arpeggio::brew-chord-bracket (layout-only override in the
  // pinned global-variables.ily, unused by No.1). Stub it on 2.26+; on 2.24
  // keep the real definition. Extraction never calls Arpeggio stencils.
  const m = /^(\d+)\.(\d+)/.exec(compilerVersion);
  const needsStub = m ? Number(m[1]) > 2 || (Number(m[1]) === 2 && Number(m[2]) >= 26) : false;
  const stub = needsStub
    ? '#(define ly:arpeggio::brew-chord-bracket (lambda (grob) (ly:make-stencil "" \'(0 . 0) \'(0 . 0))))\n'
    : '';
  const wrapper = `\\version "2.24.0"
\\language "english"
${stub}\\include "${PARTS_PATH.replace(/"/g, '\\"')}"
outDir = "${outDir.replace(/"/g, '\\"')}"
\\include "${LISTENER_PATH.replace(/"/g, '\\"')}"
\\score {
  \\unfoldRepeats \\new PianoStaff <<
    \\new Staff = "upper" <<
      \\global
      \\new Voice = "rightHandUpper" \\rightHandUpper
      \\new Voice = "rightHandLower" \\rightHandLower
    >>
    \\new Staff = "lower" <<
      \\global
      \\new Voice = "leftHandUpper" \\leftHandUpper
      \\new Voice = "leftHandLower" \\leftHandLower
    >>
  >>
  \\layout {
    \\context { \\Voice \\consists #brahms-durations-listener }
  }
}
`;
  const wrapperPath = path.join(outDir, 'wrapper.ly');
  fs.writeFileSync(wrapperPath, wrapper, 'utf8');
  return wrapperPath;
}

function runLilyPondOnce(bin: string, wrapperPath: string, outDir: string): void {
  try {
    execFileSync(bin, ['-dno-print-pages', '-o', path.join(outDir, 'out'), wrapperPath], {
      encoding: 'utf8',
      timeout: 300000,
      stdio: 'pipe',
    });
  } catch (err: unknown) {
    const e = err as { status?: number; stdout?: string; stderr?: string; message?: string };
    const log = `${e.stdout ?? ''}\n${e.stderr ?? ''}`.slice(-4000);
    throw new Error(`LilyPond export failed (exit ${e.status ?? '?'}). Tail:\n${log}`);
  }
}

function collectEvidence(outDir: string): {
  evidence: Parameters<typeof normalizeWrittenDurations>[0];
  silences: BrahmsRawSilence[];
  rawBytes: string;
} {
  const voices = ['rightHandUpper', 'rightHandLower', 'leftHandUpper', 'leftHandLower'];
  const evidence: Parameters<typeof normalizeWrittenDurations>[0] = [];
  const silences: BrahmsRawSilence[] = [];
  const chunks: string[] = [];
  for (const v of voices) {
    const file = path.join(outDir, `voice-${v}.jsonl`);
    if (!fs.existsSync(file)) throw new Error(`Exporter produced no file for voice ${v}: ${file}`);
    const text = fs.readFileSync(file, 'utf8');
    chunks.push(`## ${v}\n${text}`);
    const segments: never[] = [];
    const ties: never[] = [];
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      const o = JSON.parse(line) as Record<string, unknown>;
      if (o.type === 'tie') {
        (ties as unknown as { onsetNum: number; onsetDen: number }[]).push({
          onsetNum: o.onsetNum as number,
          onsetDen: o.onsetDen as number,
        });
      } else if (o.type === 'note') {
        // Map absolute origin to logical relative (basenames are unique).
        const absFile = String(o.file ?? '');
        const base = path.basename(absFile);
        const logical = `includes/${base}`;
        (segments as unknown as Record<string, unknown>[]).push({
          voice: v,
          staff: o.staff,
          onsetNum: o.onsetNum,
          onsetDen: o.onsetDen,
          durNum: o.durNum,
          durDen: o.durDen,
          semi: o.semi,
          hasTie: o.hasTie,
          file: logical,
          line: o.line,
          col: o.col,
          bar: o.bar,
          tieWait: o.tieWait,
        });
      } else {
        throw new Error(`Unknown evidence record type: ${line.slice(0, 80)}`);
      }
    }
    evidence.push({ voice: v, segments: segments as never, ties: ties as never });
    // Round 48 — the authored silences of this voice (written rests and
    // invisible spacers). They live in their own file so the committed note
    // evidence above stays byte-identical; their content is still part of the
    // determinism check (it is appended to the raw evidence digest).
    const silenceFile = path.join(outDir, `silences-${v}.jsonl`);
    if (!fs.existsSync(silenceFile)) throw new Error(`Exporter produced no silences for voice ${v}`);
    const silenceText = fs.readFileSync(silenceFile, 'utf8');
    chunks.push(`## silences ${v}\n${silenceText}`);
    for (const line of silenceText.split('\n')) {
      if (!line.trim()) continue;
      const o = JSON.parse(line) as Record<string, unknown>;
      const absFile = String(o.file ?? '');
      silences.push({
        type: String(o.type ?? ''),
        voice: v,
        onsetNum: o.onsetNum as number,
        onsetDen: o.onsetDen as number,
        durNum: o.durNum as number,
        durDen: o.durDen as number,
        file: `includes/${path.basename(absFile)}`,
        line: o.line as number,
        col: o.col as number,
        staff: String(o.staff ?? ''),
        bar: o.bar as number,
      });
    }
  }
  return { evidence, silences, rawBytes: chunks.join('\n') };
}

function canonicalJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function main(): void {
  const manifest = verifyManifest();
  const compiler = findCompiler();
  if (compiler.version !== manifest.compiler.testedVersion) {
    console.warn(
      `Note: compiler is ${compiler.version}, tested version is ${manifest.compiler.testedVersion} ` +
        `(witness declares 2.24). Actual version is recorded in provenance; proceeding.`
    );
  }

  // Two independent runs; raw evidence must be byte-identical (determinism).
  const tmpA = fs.mkdtempSync(path.join(os.tmpdir(), 'brahms-dur-A-'));
  const tmpB = fs.mkdtempSync(path.join(os.tmpdir(), 'brahms-dur-B-'));
  try {
    const wrapA = writeWrapper(tmpA, compiler.version);
    const wrapB = writeWrapper(tmpB, compiler.version);
    runLilyPondOnce(compiler.bin, wrapA, tmpA);
    runLilyPondOnce(compiler.bin, wrapB, tmpB);
    const a = collectEvidence(tmpA);
    const b = collectEvidence(tmpB);
    if (sha256Hex(a.rawBytes) !== sha256Hex(b.rawBytes)) {
      throw new Error('Exporter is not deterministic: two LilyPond runs disagree on raw evidence');
    }
    const { events, provenance } = normalizeWrittenDurations(a.evidence);
    const silences = normalizeSourceSilences(a.silences);
    if (events.length !== 964) {
      throw new Error(`Expected 964 normalized events, got ${events.length} — refusing to write fixture`);
    }
    const totalTicks = Math.max(...events.map((e) => e.startTick + e.durationTicks));
    const fixture = {
      version: 1,
      exporterVersion: manifest.exporterVersion,
      attribution: manifest.upstream.attribution,
      upstream: { repo: manifest.upstream.repo, commit: manifest.upstream.commit },
      compiler: { name: 'GNU LilyPond', version: compiler.version, guile: compiler.guile },
      sources: manifest.sources,
      totalTicks,
      count: events.length,
      durations: events,
    };
    const fixtureBytes = canonicalJson(fixture);
    const fixtureSha = sha256Hex(fixtureBytes);
    const provenanceDoc = {
      version: 1,
      fixtureSha256: fixtureSha,
      totalTicks,
      count: provenance.length,
      events: provenance,
    };
    const provenanceBytes = canonicalJson(provenanceDoc);
    const silencesDoc = {
      version: 1,
      fixtureSha256: fixtureSha,
      totalTicks,
      count: silences.length,
      rests: silences.filter((entry) => entry.kind === 'rest').length,
      skips: silences.filter((entry) => entry.kind === 'skip').length,
      silences,
    };
    const silencesBytes = canonicalJson(silencesDoc);

    if (CHECK) {
      const committedFixture = fs.existsSync(FIXTURE_PATH) ? fs.readFileSync(FIXTURE_PATH, 'utf8') : null;
      const committedProv = fs.existsSync(PROVENANCE_PATH) ? fs.readFileSync(PROVENANCE_PATH, 'utf8') : null;
      const committedSilences = fs.existsSync(SILENCES_PATH)
        ? fs.readFileSync(SILENCES_PATH, 'utf8')
        : null;
      // Compare semantically where the compiler version may legitimately
      // differ (provenance records actual); bytes must match when the same
      // compiler produced the committed files. Normalize the compiler block
      // for comparison, but require durations/provenance events identical.
      const norm = (s: string | null) => {
        if (!s) return s;
        const o = JSON.parse(s) as Record<string, unknown>;
        if (o && typeof o === 'object' && 'compiler' in o) {
          const c = { ...(o.compiler as Record<string, unknown>) };
          delete c.version;
          delete c.guile;
          o.compiler = c;
        }
        return JSON.stringify(o);
      };
      const freshFixtureNorm = norm(fixtureBytes);
      const committedFixtureNorm = norm(committedFixture);
      const freshProvEvents = JSON.stringify((JSON.parse(provenanceBytes) as { events: unknown }).events);
      const committedProvEvents = committedProv
        ? JSON.stringify((JSON.parse(committedProv) as { events: unknown }).events)
        : null;
      const freshSilences = JSON.stringify(
        (JSON.parse(silencesBytes) as { silences: unknown }).silences
      );
      const committedSilenceList = committedSilences
        ? JSON.stringify((JSON.parse(committedSilences) as { silences: unknown }).silences)
        : null;
      if (
        freshFixtureNorm !== committedFixtureNorm ||
        freshProvEvents !== committedProvEvents ||
        freshSilences !== committedSilenceList
      ) {
        console.error('Brahms written durations are STALE: fresh export disagrees with committed fixture.');
        console.error(`Run ${CHECK ? '' : ''}npm run brahms:export-durations and commit the result.`);
        process.exit(1);
      }
      console.log(
        `Brahms written durations check passed (${events.length} events, ` +
          `${silences.length} source silences, fixture sha ${fixtureSha.slice(0, 12)}…).`
      );
      return;
    }

    fs.mkdirSync(path.dirname(FIXTURE_PATH), { recursive: true });
    fs.writeFileSync(FIXTURE_PATH, fixtureBytes, 'utf8');
    fs.writeFileSync(PROVENANCE_PATH, provenanceBytes, 'utf8');
    fs.writeFileSync(SILENCES_PATH, silencesBytes, 'utf8');
    console.log(`Wrote ${path.relative(REPO_ROOT, FIXTURE_PATH)} (${events.length} events, total ${totalTicks} ticks)`);
    console.log(`Wrote ${path.relative(REPO_ROOT, PROVENANCE_PATH)} (fixture sha ${fixtureSha.slice(0, 12)}…)`);
    console.log(
      `Wrote ${path.relative(REPO_ROOT, SILENCES_PATH)} (${silencesDoc.rests} rests, ` +
        `${silencesDoc.skips} spacers)`
    );
  } finally {
    fs.rmSync(tmpA, { recursive: true, force: true });
    fs.rmSync(tmpB, { recursive: true, force: true });
  }
}

main();
