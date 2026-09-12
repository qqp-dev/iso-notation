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
 *   6. janko_domain_exploration.png  — Round 4 four-paradigm contact sheet (3×)
 *   7. janko_domain_a.png            — Candidate A · floating single equator (4×)
 *   8. janko_domain_b.png            — Candidate B · base row on the line (4×)
 *   9. janko_domain_c.png            — Candidate C · single line, three rows (4×)
 *  10. janko_domain_d.png            — Candidate D · bounded center channel (4×)
 *
 * Outputs are written to the current checkout root, `public/`, `docs/img/`
 * and mirrored to the main project checkout root (root, `public/`, `docs/img/`).
 */

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1';
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
): void {
  if (rasterizer.kind === 'resvg') {
    execFileSync(rasterizer.bin, ['--zoom', String(zoom), svgPath, pngPath], { stdio: 'ignore' });
  } else {
    execFileSync(rasterizer.bin, ['-z', String(zoom), '-f', 'png', '-o', pngPath, svgPath], {
      stdio: 'ignore',
    });
  }
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

function main(): void {
  const startedAt = Date.now();
  fs.mkdirSync(DOCS_IMG, { recursive: true });
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });

  const score = buildBachGoldbergVar1Score();
  const rasterizer = findRasterizer();

  // Round 4 domain exploration: every candidate of the live registry, engraved
  // from its own option delta — the artifacts can never drift from the studio.
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
        'Unified domain exploration mm. 1–2 at 3×: A floating equator vs B anchored base row vs C three-row single line vs D bounded channel — line density against interval proportionality',
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
  ];

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'janko-export-'));
  const rows: string[] = [];
  let totalBytes = 0;

  try {
    for (const job of jobs) {
      const base = job.name.replace(/\.png$/, '');
      const svgPath = path.join(tmpDir, `${base}.svg`);
      const pngPath = path.join(DOCS_IMG, job.name);
      fs.writeFileSync(svgPath, job.svg, 'utf-8');
      rasterize(rasterizer, svgPath, pngPath, job.zoom);
      mirrorSvg(`${base}.svg`, job.svg);
      const targets = copyEverywhere(job.name, pngPath);
      const bytes = fs.statSync(pngPath).size;
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

main();
