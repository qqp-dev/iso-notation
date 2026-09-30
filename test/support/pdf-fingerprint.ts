/** Shared semantic PDF witness: content, not random document IDs. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import { inflateSync } from 'node:zlib';
import { DEFAULT_JANKO_OPTIONS } from '../../src/render/janko/types';

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

export function fingerprintPdf(pdfPath: string): PdfFingerprint {
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

