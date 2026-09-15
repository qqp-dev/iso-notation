/**
 * Download-PDF freshness gate (durable pipeline — PR #50 follow-up).
 *
 * The studio's "Download PDF" (`public/goldberg-variation-1.pdf`) rotted
 * silently through 8 PRs because no script, doc, or test owned it. This test
 * is the ownership: it regenerates the PDF from the judged golden via the
 * committed `scripts/export-pdf.ts` recipe and compares a SEMANTIC
 * fingerprint against the committed file. Byte-equality is impossible
 * (regeneration differs in 2 xref bytes), so the fingerprint compares what
 * the reader sees: page count, page sizes, the text layer, the vector
 * geometry per page, the embedded subset fonts, the absence of raster
 * images, and the rsvg default-DPI text scale.
 *
 * `deploy.yml` runs `npm test` before publishing, so a stale PDF fails the
 * suite and blocks the Pages deploy automatically — no workflow changes.
 *
 * Remediation when red: run `npm run pdf` and commit the result.
 *
 * Toolchain (`rsvg-convert`, `pdfunite`, poppler-utils): when any tool is
 * missing the test SKIPS with a clear message — dev machines without the
 * toolchain stay green; CI installs it and enforces. Override the file under
 * test with `JANKO_PDF_UNDER_TEST=/path/to/file.pdf` (used for the
 * fail-before proof against pre-#50 bytes).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { DEFAULT_JANKO_OPTIONS } from '../src/render/janko/types';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..');
const EXPORT_SCRIPT = path.join(REPO_ROOT, 'scripts', 'export-pdf.ts');
const COMMITTED_PDF = path.join(REPO_ROOT, 'public', 'goldberg-variation-1.pdf');
const PDF_UNDER_TEST = process.env.JANKO_PDF_UNDER_TEST || COMMITTED_PDF;

// The golden is a 2-page A4 engraving; the title is 11pt SVG type rendered
// through rsvg-convert's default 96 dpi, i.e. x4/3 => Tm 44/3.
const EXPECTED_PAGES = 2;
const A4_WIDTH_PT = 595.28;
const A4_HEIGHT_PT = 841.89;
const TITLE_TM_SCALE = 44 / 3;

const REQUIRED_TOOLS = [
  'rsvg-convert',
  'pdfunite',
  'pdftotext',
  'pdfinfo',
  'pdffonts',
  'pdfimages',
] as const;

function findOnPath(cmd: string): boolean {
  for (const dir of (process.env.PATH ?? '').split(path.delimiter)) {
    if (!dir) continue;
    try {
      fs.accessSync(path.join(dir, cmd), fs.constants.X_OK);
      return true;
    } catch {
      // Not here; keep looking.
    }
  }
  return false;
}

const MISSING_TOOLS = REQUIRED_TOOLS.filter((tool) => !findOnPath(tool));
const SKIP_REASON =
  MISSING_TOOLS.length > 0
    ? `PDF toolchain absent (${MISSING_TOOLS.join(', ')}) — install librsvg2-bin + poppler-utils to enforce; CI enforces.`
    : false;

function sha256Hex(text: string): string {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

/** Page objects in document order, resolved through the /Pages /Kids array. */
function pageContentRefs(rawLatin1: string): string[][] {
  const bodies = new Map<string, string>();
  const objRe = /(\d+) (\d+) obj([\s\S]*?)endobj/g;
  let m: RegExpExecArray | null;
  while ((m = objRe.exec(rawLatin1)) !== null) bodies.set(`${m[1]} ${m[2]}`, m[3]);

  const kidsOrder: string[] = [];
  for (const body of bodies.values()) {
    const kids = /\/Type\s*\/Pages[\s\S]*?\/Kids\s*\[(.*?)\]/s.exec(body);
    if (kids) {
      for (const ref of kids[1].matchAll(/(\d+) (\d+) R/g)) kidsOrder.push(`${ref[1]} ${ref[2]}`);
      break;
    }
  }
  const pageKeys =
    kidsOrder.length > 0
      ? kidsOrder
      : [...bodies.entries()]
          .filter(([, body]) => /\/Type\s*\/Page[^s]/.test(body))
          .map(([key]) => key);
  return pageKeys.map((key) => {
    const body = bodies.get(key) ?? '';
    const contents = /\/Contents\s*(\[.*?\]|\d+ \d+ R)/s.exec(body)?.[1] ?? '';
    return [...contents.matchAll(/(\d+) (\d+) R/g)].map((ref) => `${ref[1]} ${ref[2]}`);
  });
}

function inflateStreamBody(body: string): string {
  const marker = /stream\r?\n/.exec(body);
  assert.ok(marker, 'PDF stream object has no stream marker');
  const start = marker.index + marker[0].length;
  const end = body.lastIndexOf('endstream');
  const bytes = Buffer.from(body.slice(start, end), 'latin1');
  const raw = /\/FlateDecode/.test(body) ? inflateSync(bytes) : bytes;
  return raw.toString('latin1');
}

function decompressedPageStreams(pdfPath: string): string[] {
  const raw = fs.readFileSync(pdfPath).toString('latin1');
  const bodies = new Map<string, string>();
  const objRe = /(\d+) (\d+) obj([\s\S]*?)endobj/g;
  let m: RegExpExecArray | null;
  while ((m = objRe.exec(raw)) !== null) bodies.set(`${m[1]} ${m[2]}`, m[3]);
  return pageContentRefs(raw).map((refs) =>
    refs.map((ref) => inflateStreamBody(bodies.get(ref) ?? '')).join('\n')
  );
}

/** Tm `a` scales of every text block showing the golden title. */
function titleTmScales(pageStreams: string[], title: string): number[] {
  const scales: number[] = [];
  for (const stream of pageStreams) {
    for (const block of stream.match(/BT[\s\S]*?ET/g) ?? []) {
      const shown = [...block.matchAll(/\((?:[^\\()]|\\.)*\)/g)]
        .map((lit) => lit[0].slice(1, -1))
        .join('');
      if (!shown.includes(title)) continue;
      const tm = /([+-]?(?:\d+\.?\d*|\.\d+))\s+[+-]?(?:\d+\.?\d*|\.\d+)\s+[+-]?(?:\d+\.?\d*|\.\d+)\s+[+-]?(?:\d+\.?\d*|\.\d+)\s+[+-]?(?:\d+\.?\d*|\.\d+)\s+[+-]?(?:\d+\.?\d*|\.\d+)\s+Tm/.exec(block);
      assert.ok(tm, `title text block has no Tm operator: ${block.slice(0, 120)}`);
      scales.push(Number(tm[1]));
    }
  }
  return scales;
}

function vectorCensus(pageStreams: string[]): { hash: string[]; numbers: number[] } {
  const hash: string[] = [];
  const numbers: number[] = [];
  // Text objects are covered by the text-layer hash + Tm pin; strip them so
  // the census compares pure engraving geometry (staff rules, noteheads,
  // stems, beams, holds) and stays immune to font-version positioning drift.
  const numberRe = /[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g;
  for (const stream of pageStreams) {
    const vectorsOnly = stream.replace(/BT[\s\S]*?ET/g, '');
    const rounded = (vectorsOnly.match(numberRe) ?? []).map((n) => Number(n).toFixed(3));
    numbers.push(rounded.length);
    hash.push(sha256Hex(rounded.join(',')));
  }
  return { hash, numbers };
}

interface PdfFingerprint {
  pages: number;
  pageSizes: string[];
  textHash: string;
  vectorHash: string[];
  vectorNumbers: number[];
  fonts: string[];
  images: number;
  titleScales: number[];
}

function fingerprintPdf(pdfPath: string): PdfFingerprint {
  const info = execFileSync('pdfinfo', [pdfPath], { encoding: 'utf8' });
  const pages = Number(/Pages:\s+(\d+)/.exec(info)?.[1]);
  assert.ok(Number.isInteger(pages) && pages > 0, `pdfinfo reports no page count for ${pdfPath}`);
  const sized = execFileSync('pdfinfo', ['-f', '1', '-l', String(pages), pdfPath], {
    encoding: 'utf8',
  });
  const pageSizes = [...sized.matchAll(/Page\s+\d+ size:\s+([\d.]+ x [\d.]+) pts/g)].map((s) => s[1]);

  const text = execFileSync('pdftotext', [pdfPath, '-'], { encoding: 'utf8' });
  const normalizedText = text
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''))
    .join('\n');
  const textHash = sha256Hex(normalizedText);

  const fontsOut = execFileSync('pdffonts', [pdfPath], { encoding: 'utf8' });
  const fonts = fontsOut
    .split('\n')
    .slice(2)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.split(/\s+/)[0])
    .sort();

  const imagesOut = execFileSync('pdfimages', ['-list', pdfPath], { encoding: 'utf8' });
  const images = imagesOut
    .split('\n')
    .slice(2)
    .filter((line) => line.trim().length > 0).length;

  const pageStreams = decompressedPageStreams(pdfPath);
  assert.equal(pageStreams.length, pages, `parsed ${pageStreams.length} content streams, pdfinfo says ${pages} pages`);
  const census = vectorCensus(pageStreams);
  const titleScales = titleTmScales(pageStreams, DEFAULT_JANKO_OPTIONS.title).map((s) =>
    Number(s.toFixed(4))
  );

  return { pages, pageSizes, textHash, vectorHash: census.hash, vectorNumbers: census.numbers, fonts, images, titleScales };
}

function regeneratePdf(outPath: string): void {
  execFileSync(process.execPath, ['--import', 'tsx', EXPORT_SCRIPT, '--out', outPath], {
    cwd: REPO_ROOT,
    stdio: 'pipe',
  });
}

test(
  'download PDF is fresh: committed file matches a regeneration of the judged golden',
  { skip: SKIP_REASON },
  () => {
    assert.ok(fs.existsSync(PDF_UNDER_TEST), `PDF under test is missing: ${PDF_UNDER_TEST}`);
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'janko-pdf-freshness-'));
    try {
      const regenA = path.join(tmpDir, 'regen-a.pdf');
      const regenB = path.join(tmpDir, 'regen-b.pdf');
      regeneratePdf(regenA);
      regeneratePdf(regenB);

      // Re-run determinism at the semantic level: two exports must agree.
      const fpA = fingerprintPdf(regenA);
      assert.deepStrictEqual(
        fingerprintPdf(regenB),
        fpA,
        'PDF export is not deterministic: two runs of scripts/export-pdf.ts disagree'
      );

      // The gate: the committed file must match a fresh export, or the PDF
      // rotted again (run `npm run pdf` and commit the result).
      const fpCommitted = fingerprintPdf(PDF_UNDER_TEST);
      try {
        assert.deepStrictEqual(fpA, fpCommitted);
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        throw new Error(
          `Download PDF is STALE: ${PDF_UNDER_TEST} does not match a fresh export of the golden.\n` +
            `After any golden change, run \`npm run pdf\` and commit the result.\n${detail}`
        );
      }

      // Explicit pins with targeted failure messages.
      assert.equal(fpA.pages, EXPECTED_PAGES, `golden PDF must have ${EXPECTED_PAGES} pages`);
      assert.equal(fpA.pageSizes.length, EXPECTED_PAGES);
      for (const size of fpA.pageSizes) {
        const dims = /([\d.]+) x ([\d.]+)/.exec(size);
        assert.ok(dims, `unparseable page size: ${size}`);
        assert.ok(
          Math.abs(Number(dims[1]) - A4_WIDTH_PT) < 0.01 &&
            Math.abs(Number(dims[2]) - A4_HEIGHT_PT) < 0.01,
          `golden PDF page must be A4 (${A4_WIDTH_PT} x ${A4_HEIGHT_PT} pts), got ${size}`
        );
      }
      assert.equal(fpA.images, 0, 'golden PDF must be pure vector (zero raster images)');
      assert.ok(fpA.titleScales.length > 0, 'title text not found in PDF content streams');
      const titleScale = Math.max(...fpA.titleScales);
      assert.ok(
        Math.abs(titleScale - TITLE_TM_SCALE) < 0.01,
        `DPI-QUIRK PIN: title Tm scale is ${titleScale}, expected ${TITLE_TM_SCALE.toFixed(4)} ` +
          `(11pt title x4/3 at rsvg-convert default 96 dpi). ` +
          `Never pass -d 72 -p 72 to rsvg-convert: it silently shrinks all PDF text.`
      );
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }
);
