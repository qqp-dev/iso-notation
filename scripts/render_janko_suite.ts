#!/usr/bin/env node
/**
 * Jánko Engraving Ergonomics Harness — Unified Export Suite
 * =========================================================
 *
 * One command (`npm run janko:export`) renders the full engraving review set in
 * sub-second time and mirrors every PNG to all delivery locations:
 *
 *   1. janko_portrait_page1.png      — full page 1, systems 1–3, mm. 1–12 (2×)
 *   2. janko_m1_m2.png               — macro crop mm. 1–2 (4× = 288 DPI)
 *   3. janko_m4.png                  — macro crop m. 4 (4× = 288 DPI)
 *   4. janko_m8.png                  — macro crop m. 8 (4× = 288 DPI)
 *   5. janko_variants.png            — rhythm-dialect contact sheet, mm. 1–4 (2×)
 *   6. janko_domain_exploration.png  — Round 5 four-paradigm clasp contact sheet (3×)
 *   7. janko_domain_a.png            — Candidate A · traditional stems (golden) (4×)
 *   8. janko_domain_b.png            — Candidate B · independent left clasp (4×)
 *   9. janko_domain_c.png            — Candidate C · beamed clasp rail (4×)
 *  10. janko_domain_d.png            — Candidate D · bounding phrase clasp (4×)
 *  11. janko_brahms_page1.png        — Brahms Op. 118 No. 1, mm. 1–9, 3 systems (2×)
 *  12. janko_brahms_m7_m8.png        — the two five-voice chords, mm. 7–8 (4×)
 *
 * The rasterizations run in parallel across the machine's cores (the sheets are
 * the expensive part: the SVG generation itself is ~60 ms for the whole set),
 * which keeps the suite inside its sub-second budget on a normal laptop.
 *
 * Outputs are written to the current checkout root, `public/`, `docs/img/`
 * and mirrored to the main project checkout root (root, `public/`, `docs/img/`).
 */

import { execFile, execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1';
import {
  BRAHMS_OP118_NO1_JANKO_OPTIONS,
  BRAHMS_OP118_NO1_JANKO_TOKENS,
  buildBrahmsOp118No1Score,
} from '../src/scores/brahms-op118-no1';
import {
  renderJankoCrop,
  renderJankoPage,
  renderJankoVariantComparison,
} from '../src/render/janko/engine';
import { DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS } from '../src/render/janko/types';
import { CURRENT_CANDIDATES, resolveCandidate } from '../src/render/janko/candidates';
import type { JankoLayoutOptions, JankoTokens } from '../src/render/janko/types';

const CHECKOUT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAIN_CHECKOUT = '/home/qqp/projects/iso-notation';
const DOCS_IMG = path.join(CHECKOUT_ROOT, 'docs', 'img');
const PUBLIC_DIR = path.join(CHECKOUT_ROOT, 'public');

const RESVG_BIN = '/home/linuxbrew/.linuxbrew/bin/resvg';
const RSVG_CONVERT_BIN = 'rsvg-convert';

const OPTIONS: Partial<JankoLayoutOptions> = { ...DEFAULT_JANKO_OPTIONS };
const TOKENS: Partial<JankoTokens> = { ...DEFAULT_JANKO_TOKENS };

/** Letters A–D for the four domain-exploration candidates. */
const CANDIDATE_LETTERS = 'abcd';

interface ExportJob {
  /** PNG file name. */
  name: string;
  /** Rendered SVG document. */
  svg: string;
  /** Raster zoom: 2× = 144 DPI, 4× = 288 DPI. */
  zoom: number;
  /** Short human description printed in the summary table. */
  description: string;
}

/** Locate a usable SVG rasterizer (resvg preferred, rsvg-convert fallback). */
function findRasterizer(): { bin: string; kind: 'resvg' | 'rsvg-convert' } {
  if (fs.existsSync(RESVG_BIN)) return { bin: RESVG_BIN, kind: 'resvg' };
  try {
    execFileSync('which', ['resvg'], { stdio: 'ignore' });
    return { bin: 'resvg', kind: 'resvg' };
  } catch {
    return { bin: RSVG_CONVERT_BIN, kind: 'rsvg-convert' };
  }
}

function rasterize(
  rasterizer: { bin: string; kind: 'resvg' | 'rsvg-convert' },
  svgPath: string,
  pngPath: string,
  zoom: number
): Promise<void> {
  const args =
    rasterizer.kind === 'resvg'
      ? ['--zoom', String(zoom), svgPath, pngPath]
      : ['-z', String(zoom), '-f', 'png', '-o', pngPath, svgPath];
  return new Promise((resolve, reject) => {
    execFile(rasterizer.bin, args, { stdio: 'ignore' }, (error) =>
      error ? reject(error) : resolve()
    );
  });
}

/**
 * Run `worker` over `items` with a bounded number of parallel jobs. The export
 * is dominated by rasterization (the largest sheet takes ~400 ms on one core),
 * so spreading the ten documents over the machine's cores is what keeps the
 * whole suite inside its budget.
 */
async function inParallel<T>(
  items: readonly T[],
  worker: (item: T) => Promise<void>,
  limit = Math.max(1, Math.min(4, os.cpus().length))
): Promise<void> {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = cursor++;
      if (index >= items.length) return;
      await worker(items[index]);
    }
  });
  await Promise.all(runners);
}

/** Copy one artifact to every delivery location (checkout + main checkout). */
function copyEverywhere(name: string, source: string): string[] {
  const checkoutReal = fs.realpathSync(CHECKOUT_ROOT);
  const targets = [
    path.join(CHECKOUT_ROOT, name),
    path.join(PUBLIC_DIR, name),
    path.join(DOCS_IMG, name),
  ];
  if (fs.existsSync(MAIN_CHECKOUT)) {
    const mainReal = fs.realpathSync(MAIN_CHECKOUT);
    if (mainReal !== checkoutReal) {
      targets.push(
        path.join(MAIN_CHECKOUT, name),
        path.join(MAIN_CHECKOUT, 'public', name),
        path.join(MAIN_CHECKOUT, 'docs', 'img', name)
      );
    }
  }
  const written: string[] = [];
  for (const target of targets) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
    written.push(target);
  }
  return written;
}

/** Mirror a source SVG for designer inspection. */
function mirrorSvg(name: string, svg: string): void {
  fs.writeFileSync(path.join(DOCS_IMG, name), svg, 'utf-8');
  if (fs.existsSync(MAIN_CHECKOUT)) {
    const target = path.join(MAIN_CHECKOUT, 'docs', 'img', name);
    if (fs.realpathSync(path.dirname(target)) !== fs.realpathSync(DOCS_IMG)) {
      fs.writeFileSync(target, svg, 'utf-8');
    }
  }
}

async function main(): Promise<void> {
  const startedAt = Date.now();
  fs.mkdirSync(DOCS_IMG, { recursive: true });
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });

  const score = buildBachGoldbergVar1Score();
  const brahms = buildBrahmsOp118No1Score();
  const BRAHMS_OPTIONS = BRAHMS_OP118_NO1_JANKO_OPTIONS;
  const BRAHMS_TOKENS = BRAHMS_OP118_NO1_JANKO_TOKENS;
  const rasterizer = findRasterizer();

  // Round 5 chord-duration exploration: every candidate of the live registry,
  // engraved from its own option delta — the artifacts can never drift from the
  // studio.
  const candidates = CURRENT_CANDIDATES.map((candidate) => resolveCandidate(candidate));

  const jobs: ExportJob[] = [
    {
      name: 'janko_portrait_page1.png',
      svg: renderJankoPage(score, 0, OPTIONS, TOKENS),
      zoom: 2,
      description: 'Full Page 1: Systems 1–3, mm. 1–12',
    },
    {
      name: 'janko_m1_m2.png',
      svg: renderJankoCrop(
        score,
        1,
        2,
        OPTIONS,
        TOKENS,
        'accolade · halo · spacious spine-free corridor'
      ),
      zoom: 4,
      description:
        'Macro crop mm. 1–2: accolade, halo, spacious spine-free corridor, opening theme (288 DPI)',
    },
    {
      name: 'janko_m4.png',
      svg: renderJankoCrop(
        score,
        4,
        1,
        OPTIONS,
        TOKENS,
        'RH run → shared octave-3 staff rule'
      ),
      zoom: 4,
      description:
        'Macro crop m. 4: RH run descending onto the shared o3 staff rule, zero phantom ledgers (288 DPI)',
    },
    {
      name: 'janko_m8.png',
      svg: renderJankoCrop(
        score,
        8,
        1,
        OPTIONS,
        TOKENS,
        '16th spacing stress test'
      ),
      zoom: 4,
      description: 'Macro crop m. 8: 16th-cluster horizontal spacing stress test (288 DPI)',
    },
    {
      name: 'janko_variants.png',
      svg: renderJankoVariantComparison(score, undefined, 1, 4, OPTIONS, TOKENS),
      zoom: 2,
      description:
        'Contact sheet mm. 1–4: A Angled Cuts vs B Traditional Beams vs C Unified Continuous Lattice',
    },
    {
      name: 'janko_domain_exploration.png',
      svg: renderJankoVariantComparison(
        score,
        candidates.map((c) => ({
          id: c.candidate.id,
          label: c.candidate.label,
          options: c.options,
        })),
        1,
        2,
        OPTIONS,
        TOKENS
      ),
      zoom: 3,
      description:
        'Unified chord-duration exploration mm. 1–2 at 3×: A traditional stems vs B independent left clasp vs C beamed clasp rail vs D bounding phrase clasp — grouping bracket against through-stem',
    },
    ...candidates.map((c, i) => ({
      name: `janko_domain_${CANDIDATE_LETTERS[i] ?? String(i + 1)}.png`,
      svg: renderJankoCrop(
        score,
        1,
        2,
        c.options,
        c.tokens,
        c.candidate.description ?? c.candidate.label
      ),
      zoom: 4,
      description: `${c.candidate.label} — ${c.candidate.id} (288 DPI)`,
    })),
    // Brahms Op. 118 No. 1: the harmonic pressure benchmark (four-octave
    // arpeggios + the two five-voice chords that force the row-snapped offset).
    {
      name: 'janko_brahms_page1.png',
      svg: renderJankoPage(brahms, 0, BRAHMS_OPTIONS, BRAHMS_TOKENS),
      zoom: 2,
      description: 'Brahms Op. 118 No. 1, mm. 1–9: three systems on A4 portrait',
    },
    {
      name: 'janko_brahms_m7_m8.png',
      svg: renderJankoCrop(
        brahms,
        7,
        2,
        BRAHMS_OPTIONS,
        BRAHMS_TOKENS,
        'the two five-voice chords — row-snapped parity offset'
      ),
      zoom: 4,
      description:
        'Macro crop mm. 7–8: ⟨A3,B3,D4,F4,A4⟩ and ⟨F3,G3,B3,F4,G4⟩, every colliding row spread (288 DPI)',
    },
  ];

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'janko-export-'));
  const rows: string[] = [];
  let totalBytes = 0;

  const results = new Map<string, { targets: string[]; bytes: number }>();
  try {
    // SVG generation is synchronous and cheap; rasterization is the slow part
    // and is spread across the machine's cores.
    const prepared = jobs.map((job) => {
      const base = job.name.replace(/\.png$/, '');
      const svgPath = path.join(tmpDir, `${base}.svg`);
      fs.writeFileSync(svgPath, job.svg, 'utf-8');
      return { job, base, svgPath, pngPath: path.join(DOCS_IMG, job.name) };
    });
    await inParallel(prepared, async ({ job, svgPath, pngPath }) => {
      await rasterize(rasterizer, svgPath, pngPath, job.zoom);
    });
    for (const { job, base, pngPath } of prepared) {
      mirrorSvg(`${base}.svg`, job.svg);
      const targets = copyEverywhere(job.name, pngPath);
      results.set(job.name, { targets, bytes: fs.statSync(pngPath).size });
    }
    for (const job of jobs) {
      const { targets, bytes } = results.get(job.name)!;
      totalBytes += bytes;
      rows.push(
        `  ✓ ${job.name.padEnd(28)} ${String(job.zoom) + '×'}  ${(bytes / 1024).toFixed(1).padStart(7)} KB  → ${targets.length} locations  (${job.description})`
      );
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  const elapsed = Date.now() - startedAt;
  console.log('Jánko Engraving Ergonomics Harness — export suite');
  console.log(`  rasterizer: ${rasterizer.bin}`);
  console.log(rows.join('\n'));
  console.log(
    `\n  ${jobs.length} PNGs (${(totalBytes / 1024).toFixed(1)} KB) exported in ${elapsed} ms\n`
  );
  if (elapsed > 2000) {
    console.warn(`  ⚠ export suite exceeded the 2s budget (${elapsed} ms)`);
  }
}

await main();
