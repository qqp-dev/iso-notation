import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ViteDevServer } from 'vite';
import { CANDIDATE_IDS, REFERENCE_IDS, SOURCE_DOCUMENTS, SOURCE_IMAGES, WORKS, SCHUMANN_NO13_ENDING_CITATION } from '../src/source-review/documents';
import { schumannNo13WrittenFacts, buildSchumannNo13Draft } from '../src/scores/schumann-no13-draft';
import { ROUND_60_CANDIDATES as CURRENT_CANDIDATES, ROUND_60_METADATA as CURRENT_ROUND_METADATA, ROUND_55_CANDIDATES } from '../src/render/janko/candidates';
import { currentChoice, initialChoices, restoreChoices, selectDocument, selectWork, setPage, setZoom, STORAGE_KEY } from '../src/source-review/session';
import { PDFJS_DECODER_PREFIX, SOURCE_PDF_PREFIX, sourcePdfPlugin, validatePdfBytes } from '../src/source-review/vite-plugin';

const scan = REFERENCE_IDS[0], alternate = REFERENCE_IDS[1];
const a = CANDIDATE_IDS[0], b = CANDIDATE_IDS[1];

test('No13 citation is locally verified printed35–36 with a split ending and return pickup, independent of Peters parentage', () => {
  const citation=SCHUMANN_NO13_ENDING_CITATION,score=buildSchumannNo13Draft();
  assert.match(citation.work,/Schumann Op\. 68 No\. 13.*Mai, lieber Mai/);
  assert.equal(citation.folio,15);
  assert.ok(SOURCE_IMAGES[citation.reference].pages.some(p=>p.folio===citation.folio));
  assert.match(citation.encodingParent,/Peters.*unspecified/);
  assert.match(SOURCE_DOCUMENTS['schumann-starter'].edition,/Peters parent unspecified/);
  for(const row of citation.segments) {
    const occurrence=schumannNo13WrittenFacts.occurrences[row.internal-1];
    assert.deepEqual([occurrence.sourceBar,occurrence.pass],[row.sourceBar,row.pass]);
    assert.deepEqual(score.sourceBarTicks!.slice(row.internal-1,row.internal+1),[row.startTick,row.endTick]);
  }
  assert.deepEqual(citation.segments.map(s=>s.printed),[35,36,36]);
  const cards=ROUND_55_CANDIDATES.filter(c=>['schumann-no13-written-draft','schumann-no13-before-clarity'].includes(c.id));
  assert.equal(cards.length,2);
  assert.deepEqual(cards[0].windows,cards[1].windows,'both current rule comparisons use the same corrected source window');
  for(const card of cards) {
    const window=card.windows!.find(w=>'measureStart' in w&&w.measureStart===38&&w.measureCount===3);
    assert.ok(window&&'scoreId' in window);
    assert.equal(window.scoreId,'schumann-op68-no13');
    assert.equal(window.caption,citation.caption);
    assert.match(card.description??'',/corrected source/);
    assert.match(card.description??'',/not original Round58 COMPACT B/);
  }
  assert.equal(CURRENT_ROUND_METADATA.round,60,'local phrasing and two shared-head variants follow retained joint alignment');
  assert.match(CURRENT_ROUND_METADATA.description,/corrected.*source slurs/);
  const current=CURRENT_CANDIDATES.map(c=>c.windows!.find(w=>'scoreId' in w&&w.scoreId==='schumann-op68-no13'));
  assert.equal(current.length,4);
  assert.ok(current.every(w=>w&&'measureStart' in w&&w.measureStart===38&&w.measureCount===3&&w.caption?.startsWith(citation.caption)));
  assert.deepEqual(current[0],current[1]);
});

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
  assert.equal(state.pages[scan].page, SOURCE_DOCUMENTS[scan as keyof typeof SOURCE_DOCUMENTS].pages);
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

test('Op. 15 proposed Henle pages and published starter keep independent per-work anchors', () => {
  const state = initialChoices();
  for (const [work, ref, folio, frame, anchor] of [
    ['kinderszenen-1', 'henle-op15-1', 2, 10, 3],
    ['kinderszenen-6', 'henle-op15-6', 7, 15, 8],
    ['kinderszenen-8', 'henle-op15-8', 9, 17, 10],
  ] as const) {
    selectWork(state, work);
    assert.equal(state.reference, ref);
    assert.equal(state.candidate, 'kinderszenen-v70');
    assert.equal(currentChoice(state, state.candidate).page, anchor);
    const image = SOURCE_IMAGES[ref];
    assert.deepEqual(image.pages.map(({ folio, frame }) => [folio, frame]), [[folio, frame]]);
    assert.match(image.pages[0].url, new RegExp(`0044_00${frame}-`));
    assert.equal(image.source, 'https://www.henle.de/Scenes-from-Childhood-op.-15/HN-44');
    assert.throws(() => selectDocument(state, 'reference', 'henle-13'), /role/);
    setPage(state, state.candidate, anchor + 1);
  }
  const pdf = SOURCE_DOCUMENTS['kinderszenen-v70'];
  assert.equal(pdf.pages, 16); assert.equal(pdf.bytes, 2496446);
  assert.equal(pdf.sha256, '30ded702114332842e87aecd63cc672d32ac32ea7a779a70939055fbff6013af');
  const restored = restoreChoices(JSON.stringify(state));
  for (const [work, anchor] of [['kinderszenen-1', 4], ['kinderszenen-6', 9], ['kinderszenen-8', 11]] as const) {
    selectWork(restored, work);
    assert.equal(currentChoice(restored, 'kinderszenen-v70').page, anchor);
  }
  selectWork(restored, 'scriabin'); assert.equal(restored.reference, scan);
  selectWork(restored, 'schumann-13'); assert.equal(currentChoice(restored, 'schumann-starter').page, 20);
});

test('Schumann work selection keeps separate starter anchors, image folios and role restrictions', () => {
  const state = initialChoices();
  for (const [work, expected, reference] of [
    ['schumann-13', 20, 'henle-13'], ['schumann-14', 22, 'schuberth-14'],
    ['schumann-30', 56, 'schuberth-30'], ['schumann-43', 86, 'henle-43'],
  ] as const) {
    selectWork(state, work);
    assert.equal(state.reference, reference);
    assert.equal(state.candidate, 'schumann-starter');
    assert.equal(currentChoice(state, 'schumann-starter').page, expected);
    assert.equal(SOURCE_IMAGES[reference].pages.length, work === 'schumann-43' ? 1 : 2);
    assert.throws(() => selectDocument(state, 'reference', 'imslp-936721'), /role/);
    setZoom(state, reference, 1.5);
    setPage(state, 'schumann-starter', expected + 1);
  }
  assert.equal(WORKS['schumann-14'].starterPage, 22);
  selectWork(state, 'scriabin');
  assert.equal(state.reference, scan);
  assert.equal(state.candidate, a);
  const restored = restoreChoices(JSON.stringify(state));
  selectWork(restored, 'schumann-14');
  assert.equal(currentChoice(restored, 'schumann-starter').page, 23);
  assert.equal(currentChoice(restored, 'schuberth-14').zoom, 1.5);
  selectWork(restored, 'schumann-30');
  assert.equal(currentChoice(restored, 'schumann-starter').page, 57);
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
async function request(handler: Middleware, url: string): Promise<{ status: number; body: string; bytes: Buffer; mime?: string; next: boolean }> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`PDF middleware did not finish: ${url}`)), 3000);
    const headers = new Map<string, string>();
    let statusCode = 200;
    const finish = (body: Uint8Array | string, next = false) => {
      clearTimeout(timeout);
      const bytes = Buffer.from(body);
      resolve({ status: statusCode, body: bytes.toString(), bytes, mime: headers.get('content-type'), next });
    };
    const res = { get statusCode() { return statusCode; }, set statusCode(v: number) { statusCode = v; },
      setHeader: (key: string, value: string) => { headers.set(key.toLowerCase(), value); },
      end: (body: Uint8Array | string = '') => finish(body) };
    handler({ url } as IncomingMessage, res as unknown as ServerResponse, () => finish('', true));
  });
}

test('dev decoder route serves only pinned local PDF.js assets with exact bytes and MIME', async () => {
  const base = await mkdtemp(join(tmpdir(), 'janko-decoder-test-'));
  try {
    const root = join(base, 'checkout'), cache = join(base, 'cache');
    await mkdir(root); await mkdir(cache);
    const handle = middleware(cache, root);
    for (const name of ['jbig2.wasm', 'jbig2_nowasm_fallback.js']) {
      const response = await request(handle, `${PDFJS_DECODER_PREFIX}${name}`);
      assert.equal(response.status, 200, name);
      assert.match(response.mime ?? '', name.endsWith('.wasm') ? /^application\/wasm/ : /^text\/javascript/);
      assert.deepEqual(response.bytes, await readFile(join('node_modules/pdfjs-dist/wasm', name)));
    }
    const imported = await request(handle, `${PDFJS_DECODER_PREFIX}jbig2_nowasm_fallback.js?import`);
    assert.equal(imported.status, 200, 'Vite fallback module request remains available');
    for (const suffix of ['../jbig2.wasm', '%2e%2e/jbig2.wasm', 'other.wasm', 'jbig2.wasm?path=/etc/passwd', 'jbig2_nowasm_fallback.js?url']) {
      assert.equal((await request(handle, `${PDFJS_DECODER_PREFIX}${suffix}`)).status, 404, suffix);
    }
  } finally { await rm(base, { recursive: true, force: true }); }
});

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
