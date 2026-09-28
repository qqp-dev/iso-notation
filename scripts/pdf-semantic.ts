import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';

const sha = (data: string) => createHash('sha256').update(data).digest('hex');
/** Independently inspect PDF semantics, ignoring volatile xref/trailer metadata. */
export function pdfFingerprint(path: string, title: string) {
  const info = execFileSync('pdfinfo', [path], { encoding: 'utf8' });
  const pages = Number(/Pages:\s+(\d+)/.exec(info)?.[1]);
  if (!Number.isInteger(pages) || pages < 1) throw new Error('PDF has no pages');
  const details = execFileSync('pdfinfo', ['-f', '1', '-l', String(pages), path], { encoding: 'utf8' });
  const pageSizes = [...details.matchAll(/Page\s+\d+ size:\s+([\d.]+ x [\d.]+) pts/g)].map(match => match[1]);
  const text = execFileSync('pdftotext', [path, '-'], { encoding: 'utf8' });
  const fonts = execFileSync('pdffonts', [path], { encoding: 'utf8' }).split('\n').slice(2).map(line => line.trim()).filter(Boolean).map(line => line.split(/\s+/)[0]).sort();
  const images = execFileSync('pdfimages', ['-list', path], { encoding: 'utf8' }).split('\n').slice(2).filter(line => line.trim()).length;
  const raw = readFileSync(path).toString('latin1');
  const bodies = new Map<string, string>();
  for (const match of raw.matchAll(/(\d+) (\d+) obj([\s\S]*?)endobj/g)) bodies.set(`${match[1]} ${match[2]}`, match[3]);
  const kids: string[] = [];
  for (const body of bodies.values()) {
    const list = /\/Type\s*\/Pages[\s\S]*?\/Kids\s*\[(.*?)\]/s.exec(body);
    if (list) { for (const ref of list[1].matchAll(/(\d+) (\d+) R/g)) kids.push(`${ref[1]} ${ref[2]}`); break; }
  }
  const pageKeys = kids.length ? kids : [...bodies].filter(([, body]) => /\/Type\s*\/Page[^s]/.test(body)).map(([key]) => key);
  if (pageKeys.length !== pages || pageSizes.length !== pages) throw new Error('PDF page tree or A4 size list is incomplete');
  const vectorHash: string[] = [], vectorNumbers: number[] = [], titleScales: number[] = [];
  for (const key of pageKeys) {
    const refs = /\/Contents\s*(\[.*?\]|\d+ \d+ R)/s.exec(bodies.get(key) ?? '')?.[1] ?? '';
    const stream = [...refs.matchAll(/(\d+) (\d+) R/g)].map(ref => {
      const body = bodies.get(`${ref[1]} ${ref[2]}`) ?? '';
      const marker = /stream\r?\n/.exec(body);
      if (!marker) throw new Error('PDF page content stream missing');
      const bytes = Buffer.from(body.slice(marker.index + marker[0].length, body.lastIndexOf('endstream')), 'latin1');
      return (/\/FlateDecode/.test(body) ? inflateSync(bytes) : bytes).toString('latin1');
    }).join('\n');
    for (const block of stream.match(/BT[\s\S]*?ET/g) ?? []) {
      const shown = [...block.matchAll(/\((?:[^\\()]|\\.)*\)/g)].map(lit => lit[0].slice(1, -1)).join('');
      if (!shown.includes(title)) continue;
      const tm = /([+-]?(?:\d+\.?\d*|\.\d+))\s+[+-]?(?:\d+\.?\d*|\.\d+)\s+[+-]?(?:\d+\.?\d*|\.\d+)\s+[+-]?(?:\d+\.?\d*|\.\d+)\s+[+-]?(?:\d+\.?\d*|\.\d+)\s+[+-]?(?:\d+\.?\d*|\.\d+)\s+Tm/.exec(block);
      if (!tm) throw new Error('PDF title has no scale');
      titleScales.push(Number(Number(tm[1]).toFixed(4)));
    }
    const vectors = stream.replace(/BT[\s\S]*?ET/g, '');
    const numbers = (vectors.match(/[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g) ?? []).map(n => Number(n).toFixed(3));
    vectorNumbers.push(numbers.length);
    vectorHash.push(sha(numbers.join(',')));
  }
  for (const size of pageSizes) {
    const dims = /([\d.]+) x ([\d.]+)/.exec(size);
    if (!dims || Math.abs(Number(dims[1]) - 595.28) >= 0.01 || Math.abs(Number(dims[2]) - 841.89) >= 0.01) throw new Error('PDF must be A4');
  }
  if (pages !== 2 || images !== 0 || !titleScales.length || Math.abs(Math.max(...titleScales) - 44 / 3) >= 0.01) throw new Error(`PDF page/vector/title invariants failed: pages=${pages} images=${images} titleScales=${JSON.stringify(titleScales)} title=${title}`);
  return { pages, pageSizes, textHash: sha(text.split('\n').map(line => line.replace(/\s+$/, '')).join('\n')),
    vectorHash, vectorNumbers, fonts, images, titleScales };
}
