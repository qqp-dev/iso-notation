import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ViteDevServer } from 'vite';
import { CANDIDATE_IDS, REFERENCE_IDS, SOURCE_DOCUMENTS } from '../src/source-review/documents';
import { initialChoices, restoreChoices, selectDocument, setPage, setZoom, STORAGE_KEY } from '../src/source-review/session';
import { SOURCE_PDF_PREFIX, sourcePdfPlugin, validatePdfBytes } from '../src/source-review/vite-plugin';

const scan = REFERENCE_IDS[0], alternate = REFERENCE_IDS[1];
const a = CANDIDATE_IDS[0], b = CANDIDATE_IDS[1];

test('source review keeps independent document pages and zooms through A/B and reference switches', () => {
  const state = initialChoices();
  assert.equal(state.reference, scan);
  assert.equal(state.candidate, a);
  assert.match(STORAGE_KEY, /source-review/);
  setPage(state, scan, 18); setZoom(state, scan, 1.75);
  setPage(state, a, 2); setZoom(state, a, 2.25);
  selectDocument(state, 'candidate', b);
  assert.deepEqual(state.pages[scan], { page: 18, zoom: 1.75 });
  assert.deepEqual(state.pages[b], { page: 1, zoom: 1 });
  setPage(state, b, 10); setZoom(state, b, 0.75);
  assert.equal(state.pages[b].page, 1, 'one-page candidate never gains a phantom second page');
  selectDocument(state, 'candidate', a);
  assert.deepEqual(state.pages[a], { page: 2, zoom: 2.25 });
  selectDocument(state, 'reference', alternate);
  setPage(state, alternate, 40);
  assert.deepEqual(state.pages[scan], { page: 18, zoom: 1.75 }, 'manual scan switch preserves the earlier scan');
  selectDocument(state, 'reference', scan);
  assert.deepEqual(restoreChoices(JSON.stringify(state)), state, 'ordinary same-session reload restores selections and per-document choices');
  assert.throws(() => selectDocument(state, 'reference', a), /role/);
  assert.throws(() => selectDocument(state, 'candidate', scan), /role/);
});

test('source review clamps page and zoom independently and rejects corrupt or foreign stored choices', () => {
  const state = initialChoices();
  setPage(state, a, -20); setPage(state, scan, 1000); setZoom(state, a, 100); setZoom(state, scan, -2);
  assert.equal(state.pages[a].page, 1);
  assert.equal(state.pages[scan].page, SOURCE_DOCUMENTS[scan].pages);
  assert.equal(state.pages[a].zoom, 3);
  assert.equal(state.pages[scan].zoom, 0.5);
  setZoom(state, a, NaN);
  assert.equal(state.pages[a].zoom, 3);
  assert.deepEqual(restoreChoices('{'), initialChoices());
  const restored = restoreChoices(JSON.stringify({
    reference: a, candidate: scan, mobilePane: 'alien',
    pages: {
      [scan]: { page: 38, zoom: null },
      [a]: { page: 2, zoom: 2 },
      [b]: { page: 2, zoom: '100' },
      injected: { page: 999, zoom: 999 },
    },
  }));
  assert.equal(restored.reference, scan);
  assert.equal(restored.candidate, a);
  assert.equal(restored.mobilePane, 'reference');
  assert.deepEqual(restored.pages[scan], { page: 1, zoom: 1 });
  assert.deepEqual(restored.pages[a], { page: 2, zoom: 2 });
  assert.deepEqual(restored.pages[b], { page: 1, zoom: 1 });
  assert.equal(Object.hasOwn(restored.pages, 'injected'), false);
});

// A self-contained PDF fixture: no download, approved cache, or source asset is needed to
// test byte identity and page-count validation. The actual four documents are browser-probed separately.
function fixturePdf(): Uint8Array {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << >> /Contents 4 0 R >>',
    '<< /Length 0 >>\nstream\n\nendstream',
  ];
  let body = '%PDF-1.4\n';
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(body));
    body += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(body);
  body += `xref\n0 5\n0000000000 65535 f \n${offsets.slice(1).map((n) => `${String(n).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body);
}

test('PDF validation rejects wrong bytes, non-PDF masquerades, and a wrong declared page count', async () => {
  const pdf = fixturePdf();
  const identity = { bytes: pdf.length, sha256: createHash('sha256').update(pdf).digest('hex'), pages: 1 };
  await validatePdfBytes(pdf, identity);
  await assert.rejects(validatePdfBytes(pdf, { ...identity, pages: 2 }), /page count/);
  await assert.rejects(validatePdfBytes(pdf, { ...identity, sha256: '0'.repeat(64) }), /identity|hash/);
  const fake = Buffer.from('not a PDF'.padEnd(pdf.length));
  await assert.rejects(validatePdfBytes(fake, { ...identity, sha256: createHash('sha256').update(fake).digest('hex') }), /identity|hash/);
});

type Middleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => void;
function middleware(cache: string, root: string): Middleware {
  let handler: Middleware | undefined;
  const server = { middlewares: { use: (callback: Middleware) => { handler = callback; } } };
  const configure = sourcePdfPlugin({ cache, root }).configureServer;
  assert.equal(typeof configure, 'function');
  (configure as (server: ViteDevServer) => void)(server as unknown as ViteDevServer);
  assert.ok(handler, 'development server installs the PDF endpoint');
  return handler;
}
async function request(handler: Middleware, url: string): Promise<{ status: number; body: string; mime?: string; next: boolean }> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`PDF middleware did not finish: ${url}`)), 3000);
    const headers = new Map<string, string>();
    let statusCode = 200;
    const finish = (body: Uint8Array | string, next = false) => {
      clearTimeout(timeout);
      resolve({ status: statusCode, body: Buffer.from(body).toString(), mime: headers.get('content-type'), next });
    };
    const res = { get statusCode() { return statusCode; }, set statusCode(v: number) { statusCode = v; },
      setHeader: (key: string, value: string) => { headers.set(key.toLowerCase(), value); },
      end: (body: Uint8Array | string = '') => finish(body) };
    handler({ url } as IncomingMessage, res as unknown as ServerResponse, () => finish('', true));
  });
}

test('dev endpoint accepts only pinned IDs: no URL/path/traversal proxy; missing and altered cache files fail closed', async () => {
  const base = await mkdtemp(join(tmpdir(), 'janko-source-test-'));
  try {
    const root = join(base, 'checkout'), cache = join(base, 'cache');
    await mkdir(root); await mkdir(cache);
    const handle = middleware(cache, root);
    assert.equal((await request(handle, '/other-route')).next, true);
    for (const url of [
      `${SOURCE_PDF_PREFIX}unknown`, `${SOURCE_PDF_PREFIX}../${scan}`,
      `${SOURCE_PDF_PREFIX}%2e%2e%2f${scan}`, `${SOURCE_PDF_PREFIX}${scan}?path=/etc/passwd`,
      `${SOURCE_PDF_PREFIX}https://example.org/score.pdf`,
    ]) assert.equal((await request(handle, url)).status, 404, url);
    const missing = await request(handle, `${SOURCE_PDF_PREFIX}${scan}`);
    assert.equal(missing.status, 404);
    assert.match(missing.body, new RegExp(scan));
    await writeFile(join(cache, `${scan}.pdf`), fixturePdf());
    const altered = await request(handle, `${SOURCE_PDF_PREFIX}${scan}`);
    assert.equal(altered.status, 422);
    assert.match(altered.body, /identity|hash/);
    assert.match(altered.body, new RegExp(scan));
    assert.notEqual(altered.mime, 'application/pdf');
    // A symlink from a whitelisted filename outside the cache is not an authorization.
    await rm(join(cache, `${scan}.pdf`));
    const outside = join(base, 'outside.pdf');
    await writeFile(outside, fixturePdf());
    await symlink(outside, join(cache, `${scan}.pdf`));
    const escaped = await request(handle, `${SOURCE_PDF_PREFIX}${scan}`);
    assert.equal(escaped.status, 422);
    assert.match(escaped.body, /escapes cache/);
    assert.notEqual(escaped.mime, 'application/pdf');
    // A cache symlink into the checkout cannot bypass the project exclusion.
    const inCheckout = join(root, 'cache');
    await mkdir(inCheckout);
    const linked = join(base, 'linked-cache');
    await symlink(inCheckout, linked);
    const refused = await request(middleware(linked, root), `${SOURCE_PDF_PREFIX}${scan}`);
    assert.equal(refused.status, 422);
    assert.match(refused.body, /outside checkout/);
  } finally { await rm(base, { recursive: true, force: true }); }
});

