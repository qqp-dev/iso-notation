import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { inventory, linkedAssets, pinnedRequest, type Reply, type Transport } from '../scripts/inventory-source-routes';

function pdfWithAttachment(): Uint8Array {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R /Names << /EmbeddedFiles << /Names [(score.ly) 5 0 R] >> >> >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Resources << >> >>',
    '<< /Type /EmbeddedFile /Length 4 >>\nstream\nTEST\nendstream',
    '<< /Type /Filespec /F (score.ly) /EF << /F 4 0 R >> >>',
  ];
  let text = '%PDF-1.4\n', offsets = [0];
  for (let i = 0; i < objects.length; i++) { offsets.push(Buffer.byteLength(text)); text += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`; }
  const xref = Buffer.byteLength(text);
  text += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Root 1 0 R /Size 6 >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(text);
}
const reply = (bytes: Uint8Array, status = 200, headers: Reply['headers'] = {}): Reply => ({ bytes, status, headers });
const resolver = async () => ['93.184.215.14'];

test('inventory identifies complete PDF and EmbeddedFiles, but never infers human coverage', async () => {
  const bytes = pdfWithAttachment();
  const result = await inventory(['https://example.org/volume.pdf'], { resolve: resolver, transport: async () => reply(bytes) });
  const item = result.results[0];
  assert.equal(item.kind, 'pdf');
  assert.equal(item.sha256, createHash('sha256').update(bytes).digest('hex'));
  assert.deepEqual((item.facts as { pages: number; attachments: object[] }).attachments, [{ name: 'score.ly', filename: 'score.ly', bytes: 4, sha256: createHash('sha256').update('TEST').digest('hex') }]);
  assert.equal((item.facts as { pages: number }).pages, 1);
  assert.match(item.humanCoverage, /unverified/);
  assert.deepEqual(result.requests, { attempted: 1, completed: 1, failed: 0, httpErrors: 0, redirects: 0, responseBytes: bytes.length });
});

test('link leads classified without fetching them; JS and HTML access pages do not become PDFs', async () => {
  const html = `<html><a href="/scan.pdf">PDF</a><a href="/frame.jpg">scan</a><a href="/score.musicxml">encoding</a><a href="javascript:alert(1)">bad</a><script>let href='/hidden.pdf'</script><!-- <a href='/ghost.pdf'> --></html>`;
  assert.deepEqual(linkedAssets(html, 'https://example.org/item'), [
    { url: 'https://example.org/scan.pdf', type: 'pdf' }, { url: 'https://example.org/frame.jpg', type: 'image' }, { url: 'https://example.org/score.musicxml', type: 'encoding' },
  ]);
  const result = await inventory(['https://example.org/scan.pdf'], { resolve: resolver, transport: async () => reply(Buffer.from(html), 200, { 'content-type': 'application/pdf' }) });
  assert.equal(result.results[0].kind, 'html');
  assert.equal(result.results[0].sha256, undefined);
  assert.match(result.results[0].humanCoverage, /unverified/);
});

test('redirects vet destination anew; private DNS and IP literals never reach transport', async () => {
  let calls = 0;
  const transport: Transport = async () => { calls++; return reply(Buffer.from(''), 302, { location: 'http://127.0.0.1/secret' }); };
  const result = await inventory(['https://example.org/a', 'http://127.0.0.1/a', 'https://private.example/a'], {
    transport, resolve: async (host) => host === 'private.example' ? ['10.1.2.3'] : ['93.184.215.14'],
  });
  assert.equal(calls, 1);
  assert.equal(result.requests.redirects, 1);
  assert.equal(result.requests.attempted, 1);
  for (const item of result.results) assert.equal(item.sha256, undefined);
  assert.match(result.results[2].error ?? '', /public IPv4/);
  const dnsRedirect = await inventory(['https://example.org/a'], {
    transport: async () => { calls++; return reply(Buffer.from(''), 302, { location: 'https://private.example/file.pdf' }); },
    resolve: async (host) => host === 'private.example' ? ['127.0.0.1'] : ['93.184.215.14'],
  });
  assert.equal(calls, 2); // initial public request only, never the private redirect
  assert.equal(dnsRedirect.requests.attempted, 1);
});

test('failed, oversized, timed-out and incomplete responses cannot produce identity', async () => {
  let index = 0;
  const result = await inventory(Array(4).fill(0).map((_, i) => `https://example.org/${i}.pdf`), {
    resolve: resolver, transport: async (_url, _ip, timeout, cap) => {
      assert.ok(timeout <= 8000); assert.equal(cap, 8 * 1024 * 1024);
      switch (index++) {
        case 0: throw new Error('request timeout');
        case 1: return reply(new Uint8Array(cap + 1));
        case 2: throw new Error('incomplete response length');
        default: return reply(Buffer.from('%PDF-1.4\nnot a valid PDF'));
      }
    },
  });
  for (const item of result.results.slice(0, 3)) { assert.equal(item.sha256, undefined); assert.equal(item.facts, undefined); }
  assert.match(result.results[3].facts ? JSON.stringify(result.results[3].facts) : '', /parserError/);
  assert.equal(result.requests.failed, 3);
});

test('Node default socket family selection accepts pinned lookup without disabling protection', async () => {
  const server = createServer((_req, res) => res.end('pinned transport'));
  server.listen(0, '127.0.0.1');
  try {
    await once(server, 'listening');
    const port = (server.address() as { port: number }).port;
    // Direct transport test only: inventory itself still rejects IP literals/private DNS.
    const result = await pinnedRequest(new URL(`http://example.org:${port}/`), '127.0.0.1', 1000, 1024);
    assert.equal(Buffer.from(result.bytes).toString(), 'pinned transport');
    assert.equal(result.status, 200);
  } finally { server.close(); await once(server, 'close'); }
});

test('MuseScore extensions remain unparsed leads and bounded HTML links report truncation', async () => {
  const html = `<html>${Array.from({ length: 41 }, (_, i) => `<a href="/score${i}.mscx">score</a>`).join('')}</html>`;
  const report = await inventory(['https://example.org/item', 'https://example.org/score.mscz'], {
    resolve: resolver, transport: async (url) => reply(Buffer.from(url.pathname === '/item' ? html : 'unparsed archive')),
  });
  assert.equal(report.results[0].links?.length, 40);
  assert.equal(report.results[0].linksTruncated, true);
  assert.equal(report.results[1].kind, 'encoding candidate (extension only; format unverified)');
  assert.equal((await inventory(['https://example.org/short'], { resolve: resolver, transport: async () => reply(Buffer.from('<html><a href="/one.mscz">x</a></html>')) })).results[0].linksTruncated, false);
});

test('non-success is accounted separately, encoding links are candidates not verified scores', async () => {
  const report = await inventory(['https://example.org/missing.pdf', 'https://example.org/starter.ly'], {
    resolve: resolver,
    transport: async (url) => url.pathname.endsWith('.pdf') ? reply(Buffer.from('denied'), 403) : reply(Buffer.from('notes here')),
  });
  assert.equal(report.requests.httpErrors, 1);
  assert.equal(report.results[0].sha256, undefined);
  assert.match(report.results[0].error ?? '', /HTTP 403/);
  assert.match(report.results[1].kind ?? '', /extension only/);
  assert.match(report.results[1].humanCoverage, /unverified/);
});
