// Bounded, read-only research inventory. Neither a crawler nor a source/rights validator.
import { createHash } from 'node:crypto';
import { lookup as dnsLookup } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import { pathToFileURL } from 'node:url';
import { Worker } from 'node:worker_threads';

const MAX_ITEMS = 5, MAX_HOPS = 3, MAX_BYTES = 8 * 1024 * 1024, MAX_LINKS = 40;
const MAX_PAGES = 200, MAX_ATTACHMENTS = 24, MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;
const PER_REQUEST_MS = 8000, TOTAL_MS = 60000, PDF_MS = 5000;
export type Reply = { status: number; headers: Record<string, string | undefined>; bytes: Uint8Array };
export type Transport = (url: URL, pinnedIPv4: string, timeoutMs: number, maxBytes: number, signal?: AbortSignal) => Promise<Reply>;
export type Resolver = (hostname: string) => Promise<string[]>;

// Explicit deny list for non-global IPv4, including documentation, benchmarking and multicast ranges.
function publicIPv4(ip: string): boolean {
  if (isIP(ip) !== 4) return false;
  const [a, b, c] = ip.split('.').map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 0 && (c === 0 || c === 2) || b === 88 && c === 99 || b === 168)) ||
    (a === 198 && (b === 18 || b === 19 || b === 51 && c === 100)) ||
    (a === 203 && b === 0 && c === 113));
}
function safeURL(input: string): URL {
  const url = new URL(input);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || isIP(url.hostname) ||
      (url.port && url.port !== (url.protocol === 'https:' ? '443' : '80')) || !url.hostname.includes('.')) {
    throw new Error('only unauthenticated public HTTP(S) DNS names on standard ports are allowed');
  }
  url.hash = '';
  return url;
}
export const resolvePublic: Resolver = async (host) => {
  const addresses = await dnsLookup(host, { all: true, verbatim: true });
  const ip = addresses.map((entry) => entry.address).find(publicIPv4);
  if (!ip) throw new Error('no public IPv4 destination (IPv6-only hosts unsupported)');
  return [ip];
};
export const pinnedRequest: Transport = (url, ip, timeout, cap, signal) => new Promise((resolve, reject) => {
  let received = 0;
  const countedError = (error: Error) => Object.assign(error, { receivedBytes: received });
  const request = (url.protocol === 'https:' ? httpsRequest : httpRequest)(url, {
    method: 'GET', agent: false, signal, headers: { Accept: 'text/html,application/pdf,image/*,*/*;q=0.5', 'Accept-Encoding': 'identity', 'User-Agent': 'iso-notation-source-inventory/1' },
    lookup: (_hostname, _options, callback) => callback(null, ip, 4),
  }, (response) => {
    const chunks: Buffer[] = []; let size = 0;
    response.on('data', (chunk: Buffer) => {
      size += chunk.length; received = size;
      if (size > cap) { request.destroy(countedError(new Error('response byte limit reached; identity incomplete'))); return; }
      chunks.push(chunk);
    });
    response.on('end', () => {
      if (!response.complete) { reject(countedError(new Error('incomplete response framing'))); return; }
      const length = response.headers['content-length'];
      if (length && Number(length) !== size) { reject(countedError(new Error('incomplete response length'))); return; }
      resolve({ status: response.statusCode ?? 0, headers: { location: response.headers.location, 'content-type': response.headers['content-type'], 'content-encoding': response.headers['content-encoding'] }, bytes: Buffer.concat(chunks) });
    });
    response.on('error', (error) => reject(countedError(error)));
    response.on('close', () => { if (!response.complete) reject(countedError(new Error('response closed before completion'))); });
  });
  request.setTimeout(timeout, () => request.destroy(countedError(new Error('request timeout'))));
  request.on('error', (error) => reject(countedError(error)));
  request.end();
});
function sha(bytes: Uint8Array): string { return createHash('sha256').update(bytes).digest('hex'); }
async function within<T>(work: Promise<T>, ms: number, label: string, onTimeout?: () => void): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([work, new Promise<never>((_, reject) => {
      timer = setTimeout(() => { onTimeout?.(); reject(new Error(`${label} time budget reached`)); }, ms);
    })]);
  } finally { if (timer) clearTimeout(timer); }
}
function typeFor(url: string): string | null {
  const p = new URL(url).pathname.toLowerCase();
  if (p.endsWith('.pdf')) return 'pdf';
  if (/\.(png|jpe?g|tiff?|webp|gif|jp2)$/.test(p)) return 'image';
  if (/\.(musicxml|mxl|xml|ly|ily|krn|mei|mid|midi)$/.test(p)) return 'encoding';
  return null;
}
export function linkedAssets(html: string, base: string): { url: string; type: string }[] {
  const out: { url: string; type: string }[] = [], seen = new Set<string>();
  // Tag attributes are leads only; never fetched automatically. Script/text literals are not links.
  const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>|<style\b[^>]*>[\s\S]*?<\/style\s*>|<!--[\s\S]*?-->/gi, '');
  for (const tag of markup.matchAll(/<(?:a|link|img|source|object|embed)\b[^>]*>/gi)) {
    const match = /\b(?:href|src|data)\s*=\s*(["'])(.*?)\1/i.exec(tag[0]);
    if (!match) continue;
    if (out.length >= MAX_LINKS) break;
    try {
      const url = safeURL(new URL(match[2].replaceAll('&amp;', '&'), base).href).href;
      const type = typeFor(url);
      if (type && !seen.has(url)) { out.push({ url, type }); seen.add(url); }
    } catch { /* nonpublic or malformed link: not a fetch candidate */ }
  }
  return out;
}
async function pdfFacts(bytes: Uint8Array): Promise<object> {
  const worker = new Worker(new URL('./source-pdf-facts-worker.mjs', import.meta.url), {
    execArgv: [], resourceLimits: { maxOldGenerationSizeMb: 128 },
  });
  try {
    return await new Promise<object>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('PDF parsing time budget reached')), PDF_MS);
      worker.once('message', (facts: object) => { clearTimeout(timer); resolve(facts); });
      worker.once('error', (error) => { clearTimeout(timer); reject(error); });
      worker.once('exit', (code) => { if (code !== 0) { clearTimeout(timer); reject(new Error(`PDF parser worker exited ${code}`)); } });
      const copy = new Uint8Array(bytes);
      worker.postMessage({ bytes: copy, maxPages: MAX_PAGES, maxAttachments: MAX_ATTACHMENTS, maxAttachmentBytes: MAX_ATTACHMENT_BYTES }, [copy.buffer]);
    });
  } finally { await worker.terminate(); }
}
export async function inventory(inputs: string[], deps: { transport?: Transport; resolve?: Resolver; now?: () => number } = {}) {
  if (!inputs.length || inputs.length > MAX_ITEMS) throw new Error(`provide 1–${MAX_ITEMS} explicit item/asset URLs`);
  const now = deps.now ?? Date.now, transport = deps.transport ?? pinnedRequest, resolve = deps.resolve ?? resolvePublic;
  const started = now(), results = [], totals = { attempted: 0, completed: 0, failed: 0, httpErrors: 0, redirects: 0, responseBytes: 0 }; 
  for (const input of inputs) {
    const item: { input: string; finalURL?: string; status?: number; contentType?: string; bytes?: number; sha256?: string; kind?: string; facts?: object; links?: object[]; error?: string; requests: number; humanCoverage: string } =
      { input, requests: 0, humanCoverage: 'unverified; inspect each requested-piece page independently' };
    results.push(item);
    try {
      let url = safeURL(input);
      for (let hop = 0; hop <= MAX_HOPS; hop++) {
        const remaining = TOTAL_MS - (now() - started);
        if (remaining <= 0) throw new Error('invocation time budget reached');
        const addresses = await within(resolve(url.hostname), Math.min(PER_REQUEST_MS, remaining), 'DNS');
        const ip = addresses.find(publicIPv4);
        if (!ip) throw new Error('destination DNS has no public IPv4 address');
        totals.attempted++; item.requests++;
        let reply: Reply;
        const controller = new AbortController();
        try {
          reply = await within(transport(url, ip, Math.min(PER_REQUEST_MS, remaining), MAX_BYTES, controller.signal), Math.min(PER_REQUEST_MS, remaining), 'request', () => controller.abort());
          if (reply.bytes.length > MAX_BYTES) throw new Error('response byte limit reached; identity incomplete');
          totals.completed++; totals.responseBytes += reply.bytes.length;
        } catch (error) {
          totals.failed++;
          if (error instanceof Error && 'receivedBytes' in error && typeof error.receivedBytes === 'number') totals.responseBytes += error.receivedBytes;
          throw error;
        }
        if ([301, 302, 303, 307, 308].includes(reply.status)) {
          totals.redirects++;
          if (!reply.headers.location) throw new Error('redirect without Location');
          if (hop === MAX_HOPS) throw new Error('redirect budget reached');
          url = safeURL(new URL(reply.headers.location, url).href);
          continue;
        }
        item.finalURL = url.href; item.status = reply.status; item.bytes = reply.bytes.length;
        item.contentType = reply.headers['content-type'];
        if (reply.status !== 200) { totals.httpErrors++; item.error = `HTTP ${reply.status}; access and coverage unverified`; break; }
        if (reply.headers['content-encoding'] && reply.headers['content-encoding'] !== 'identity') {
          item.error = 'compressed response unsupported; identity unverified'; break;
        }
        const bytes = reply.bytes, prefix = Buffer.from(bytes.subarray(0, 1024)).toString('latin1');
        if (prefix.startsWith('%PDF-')) {
          item.kind = 'pdf'; item.sha256 = sha(bytes);
          try { item.facts = await pdfFacts(bytes); } catch (error) { item.facts = { parserError: String(error) }; }
        } else if (/^\s*(?:<!doctype html|<html|<head|<body)/i.test(prefix) || (item.contentType ?? '').includes('text/html')) {
          item.kind = 'html'; item.links = linkedAssets(Buffer.from(bytes).toString('utf8'), url.href);
        } else if (/^(?:\x89PNG|GIF8|\xff\xd8\xff|II\x2a\x00|MM\x00\x2a)/.test(prefix)) {
          item.kind = 'image'; item.sha256 = sha(bytes);
        } else if (typeFor(url.href) === 'encoding') {
          item.kind = 'encoding candidate (extension only; format unverified)'; item.sha256 = sha(bytes);
        } else { item.kind = 'unrecognized'; item.error = 'format unverified (including JS-generated links or access-test pages)'; }
        break;
      }
    } catch (error) { item.error = String(error instanceof Error ? error.message : error); }
  }
  const ended = now();
  return { startedUTC: new Date(started).toISOString(), endedUTC: new Date(ended).toISOString(), elapsedMs: ended - started, limits: { maxItems: MAX_ITEMS, maxBytesPerResponse: MAX_BYTES, maxLinks: MAX_LINKS, maxRedirects: MAX_HOPS, perRequestMs: PER_REQUEST_MS, totalMs: TOTAL_MS, pdfMs: PDF_MS, maxPages: MAX_PAGES, maxAttachments: MAX_ATTACHMENTS }, requests: totals, results, disclaimer: 'Inventory only: no human page coverage, legibility, edition authority, notation fidelity, rights or studio readiness is established.' };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  inventory(process.argv.slice(2)).then((report) => console.log(JSON.stringify(report, null, 2)), (error) => { console.error(String(error)); process.exitCode = 1; });
}
