/**
 * Production nested-base check: the prepared artifacts load through the
 * manifest's relative `new URL(…, import.meta.url)` expression under a nested
 * base path (GitHub Pages style), and both views carry inline SVG.
 * Usage: node scripts/verify-prepared-nested.mjs <pageUrl>
 */
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PAGE_URL = process.argv[2] ?? 'http://127.0.0.1:8901/base/nested/janko.html';
const CHROME = `${process.env.HOME}/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome`;
const CDP_PORT = 9334;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chrome = spawn(CHROME, [
  '--headless=new', '--no-sandbox', '--disable-gpu',
  `--remote-debugging-port=${CDP_PORT}`,
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'cdp-nested-'))}`,
  'about:blank',
], { stdio: 'ignore' });
await sleep(2500);

const page = (await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json()).find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let seq = 0;
const pending = new Map();
const failed = [];
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  else if (msg.method === 'Network.responseReceived') {
    const s = msg.params.response;
    if (s.status >= 400 && !s.url.includes('favicon')) failed.push(`${s.status} ${s.url}`);
  }
});
const send = (method, params = {}) => new Promise((res) => {
  const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  return r.result?.result?.value;
};
await send('Network.enable');
await send('Page.enable');
const t0 = Date.now();
await send('Page.navigate', { url: PAGE_URL });
let state = null;
for (let i = 0; i < 300; i++) {
  await sleep(100);
  state = await evaluate(`(() => {
    const root = document.getElementById('janko-studio');
    return {
      state: root?.dataset.preparedState ?? null,
      cand: document.getElementById('view-candidates')?.querySelectorAll('svg').length ?? -1,
      ref: document.getElementById('view-reference')?.querySelectorAll('svg').length ?? -1,
    };
  })()`).catch(() => null);
  if (state && state.state === 'ready' && state.cand > 0 && state.ref > 0) break;
}
console.log('NESTED-READY ms=' + (Date.now() - t0), JSON.stringify(state));
console.log('FAILED-REQUESTS=' + failed.length + (failed.length ? ' [' + failed.join(', ') + ']' : ''));
console.log('VERDICT', state && state.state === 'ready' && state.cand > 0 && state.ref > 0 && failed.length === 0 ? 'PASS' : 'FAIL');
chrome.kill('SIGKILL');
process.exit(0);
