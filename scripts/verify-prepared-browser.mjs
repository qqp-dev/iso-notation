/**
 * The prepared-studio browser verification (Round 49 correction checks).
 * Drives a real Chromium over CDP against the real dev server:
 *   - cold readiness: the prepared states transition to ready with inline SVG
 *     in BOTH panels, and the browser fetches NO engine/linter/score module;
 *   - tab switch: clicking a tab shows exactly the requested surface (real
 *     panel visibility — the historic stale-node defect left the tab chrome
 *     switching while the panel never appeared);
 *   - zoom: exactly one step per click (a duplicated/stale handler would jump);
 *   - HMR: change / add / delete of a non-config-graph watched input each
 *     re-applies BOTH matched surfaces in place — NON-VACUOUSLY: the cycle is
 *     observed through the viewer's `data-prepared-apply` marker advancing
 *     past its pre-trigger value and returning to `ready`, never a condition
 *     satisfiable before the regeneration lands — with the no-reload
 *     sentinel, selected tab, zoom and scroll preserved and no blank studio
 *     under a ready label;
 *   - the viewer never presents itself as a live engraving run.
 *
 * Run hygiene: a PRIVATE random CDP port whose browser is verified to be the
 * freshly spawned one (a leftover verification browser on a shared port owns
 * stale tabs and sessionStorage and silently corrupts every measurement —
 * this happened and is why the port is random + ownership-checked). The
 * checkout's engraving sources and MIDI are never edited: the HMR input
 * changes live on a transient probe file created and removed here.
 *
 * Usage: node scripts/verify-prepared-browser.mjs <devUrl>
 * Exits non-zero on any failed assertion.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const DEV_URL = process.argv[2] ?? 'http://127.0.0.1:5177/janko.html';
const CHROME = `${process.env.HOME}/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome`;
const CDP_PORT = 9300 + Math.floor(Math.random() * 500);
const PROBE = 'data/verify-prepared-probe.json';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const wait = async (ms) => sleep(ms);

const failures = [];
const check = (ok, label, detail) => {
  if (!ok) failures.push(`${label}: ${detail}`);
  console.log((ok ? '  ✓ ' : '  ✗ ') + label + (detail ? ` — ${detail}` : ''));
};

const chrome = spawn(CHROME, [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  `--remote-debugging-port=${CDP_PORT}`,
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'cdp-profile-'))}`,
  'about:blank',
], { stdio: 'ignore' });

try {
  // Wait for CDP and verify the browser on the port is OUR fresh one: it must
  // own exactly one page and it must be the untouched about:blank bootstrap.
  let targets = null;
  for (let i = 0; i < 50 && !targets; i++) {
    await wait(200);
    targets = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`).then((r) => r.json()).catch(() => null);
  }
  if (!targets) throw new Error(`no CDP browser came up on private port ${CDP_PORT}`);
  const pages = targets.filter((t) => t.type === 'page');
  if (pages.length !== 1 || pages[0].url !== 'about:blank') {
    throw new Error(
      `CDP port ${CDP_PORT} is owned by a different browser (pages: ${pages.map((p) => p.url).join(', ')}); ` +
        'stale tabs/sessionStorage would corrupt every measurement — refusing to run'
    );
  }
  const page = pages[0];
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  let seq = 0;
  const pending = new Map();
  const requests = [];
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    } else if (msg.method === 'Network.requestWillBeSent') {
      requests.push(msg.params.request.url);
    }
  });
  const send = (method, params = {}) =>
    new Promise((res) => {
      const id = ++seq;
      pending.set(id, res);
      ws.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails));
    return r.result?.result?.value;
  };

  await send('Network.enable');
  await send('Page.enable');
  await send('Runtime.enable');
  // Per-document boot id: any reload replaces it, so every measured action can
  // prove it spanned ONE document (a reload silently invalidates a scenario).
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `window.__jankoBootId = Math.random().toString(36).slice(2) + Date.now().toString(36);`,
  });

  /** One honest state read: panels (visibility AND activity), session, marker, sentinel. */
  const readState = () => evaluate(`(() => {
    const root = document.getElementById('janko-studio');
    const panel = (id) => {
      const el = document.getElementById(id);
      return el ? getComputedStyle(el).display !== 'none' : null;
    };
    const panels = Array.from(document.querySelectorAll('.view-panel'));
    return {
      state: root?.dataset.preparedState ?? null,
      apply: Number(root?.dataset.preparedApply ?? '0'),
      bootId: window.__jankoBootId ?? null,
      candVisible: panel('view-candidates'),
      refVisible: panel('view-reference'),
      activePanels: panels.filter((p) => p.classList.contains('is-active')).map((p) => p.dataset.view),
      candSvg: document.getElementById('view-candidates')?.querySelectorAll('svg').length ?? -1,
      refSvg: document.getElementById('view-reference')?.querySelectorAll('svg').length ?? -1,
      view: document.querySelector('[data-view-target].is-active')?.dataset.viewTarget ?? null,
      zoom: root?.dataset.zoom ?? null,
      scroll: Math.round(window.scrollY),
      docHeight: Math.max(document.documentElement?.scrollHeight ?? 0, document.body?.scrollHeight ?? 0),
      viewport: window.innerHeight,
      sentinel: window.__jankoNoReloadSentinel ?? null,
      status: document.getElementById('janko-status')?.textContent ?? '',
    };
  })()`);

  // Environment warm-up (unmeasured): this machine's fresh headless Chrome
  // blocks its first network requests for its first ~25 s of process life
  // (measured: a request at process t+3 s completes at t+25 s; the same
  // request after a 30 s idle completes in 164 ms). A throwaway navigation
  // absorbs that environmental stall so the measured pass reports the
  // studio's own readiness, not the browser's process-startup window.
  const warmT0 = Date.now();
  await send('Page.navigate', { url: DEV_URL });
  for (let i = 0; i < 600; i++) {
    await wait(100);
    const done = await evaluate(`document.readyState`).catch(() => null);
    if (done === 'complete') break;
  }
  console.log('WARMUP-NAVIGATION ms=' + (Date.now() - warmT0) + ' (environmental browser startup absorbed; unmeasured)');

  const t0 = Date.now();
  await send('Page.navigate', { url: DEV_URL });

  // Poll until both panels carry inline SVG (the prepared artifact is applied).
  let ready = null;
  let preparingSeen = false;
  for (let i = 0; i < 300; i++) {
    await wait(100);
    const state = await readState().catch(() => null);
    if (state?.state === 'preparing') preparingSeen = true;
    if (state && state.state === 'ready' && state.candSvg > 0 && state.refSvg > 0) {
      ready = { ms: Date.now() - t0, ...state };
      break;
    }
  }
  if (!ready) throw new Error('the prepared studio never reached ready with both surfaces');
  console.log('COLD-READY ms=' + ready.ms, 'candidates-svg=' + ready.candSvg, 'reference-svg=' + ready.refSvg,
    'preparing-observed=' + (preparingSeen ? 'yes' : 'no (faster than the first poll)'));
  check(ready.activePanels.length === 1 && ready.activePanels[0] === 'candidates',
    'cold: exactly the default surface is visible (fresh tab, no hash, no stored session)',
    JSON.stringify(ready.activePanels));

  // The no-reload sentinel: any full reload wipes it, so its survival across
  // the HMR cycles below proves the updates landed in place.
  await evaluate(`window.__jankoNoReloadSentinel = 'alive'`);

  const engineFetches = requests.filter((u) =>
    /janko\/engine|janko\/linter|janko\/studio\.ts|janko\/candidates\.ts|scores\//.test(u)
  );
  console.log('ENGINE-MODULE-FETCHES=' + engineFetches.length + (engineFetches.length ? ' [' + engineFetches.join(',') + ']' : ''));
  check(engineFetches.length === 0, 'no engraving module is fetched at viewer load', '');

  const liveMarkers = await evaluate(`document.body.innerHTML.includes('data-live="true"')`);
  console.log('LIVE-MARKERS=' + (liveMarkers ? 'PRESENT(BAD)' : 'absent(good)'));
  check(!liveMarkers, 'the viewer never claims a live engraving run', '');

  // Set the session state: reference tab, zoom 1.75, scroll 600. The tab
  // click must actually swap the visible PANEL (the stale-node defect only
  // changed the tab chrome).
  await evaluate(`document.querySelector('[data-view-target="reference"]').click()`);
  await wait(150);
  const afterTab = await readState();
  console.log('AFTER-TAB-CLICK', JSON.stringify({
    cand: afterTab.candVisible, ref: afterTab.refVisible,
    activePanels: afterTab.activePanels, tabActive: afterTab.view, sameBoot: afterTab.bootId === ready.bootId,
  }));
  if (afterTab.bootId !== ready.bootId) {
    check(false, 'tab switch shows exactly the reference surface (live panels)',
      'the environment reloaded the document mid-action (boot id changed) — scenario invalidated');
  } else {
    check(
      afterTab.candVisible === false && afterTab.refVisible === true &&
        afterTab.activePanels.length === 1 && afterTab.activePanels[0] === 'reference',
      'tab switch shows exactly the reference surface (live panels)',
      `cand=${afterTab.candVisible} ref=${afterTab.refVisible} active=${JSON.stringify(afterTab.activePanels)}`
    );
  }

  for (let i = 0; i < 3; i++) await evaluate(`document.getElementById('janko-zoom-in').click()`);
  const afterZoom = await readState();
  check(afterZoom.zoom === '1.75',
    'zoom advances exactly one step per click (no stale/duplicated handler)', `zoom=${afterZoom.zoom}`);
  await evaluate(`window.scrollTo(0, 600)`);
  await wait(400);
  const before = await readState();
  console.log('BEFORE-HMR', JSON.stringify({ view: before.view, zoom: before.zoom, scroll: before.scroll, apply: before.apply }));

  /**
   * One full HMR cycle, asserted NON-VACUOUSLY: the trigger must advance the
   * viewer's apply marker past the pre-trigger value and return to ready — a
   * condition no pre-regeneration state satisfies — then the session and both
   * matched surfaces must have survived the in-place re-apply.
   */
  const expectHmrCycle = async (name, trigger) => {
    const pre = await readState();
    trigger();
    let landed = null;
    for (let i = 0; i < 900; i++) {
      await wait(100);
      const now = await readState().catch(() => null);
      if (now && now.apply > pre.apply && now.state === 'ready') {
        landed = now;
        break;
      }
    }
    console.log(`AFTER-HMR(${name})`, JSON.stringify(landed ?? { timedOut: true }),
      'cycled=' + (landed !== null && landed.apply > pre.apply));
    if (!landed) {
      check(false, `HMR ${name}: a new generation was applied in place`, 'timed out before the regeneration landed');
      return;
    }
    check(landed.apply > pre.apply, `HMR ${name}: a new generation was applied in place`,
      `apply marker ${pre.apply} → ${landed.apply}`);
    check(landed.bootId === pre.bootId,
      `HMR ${name}: the cycle spanned one document (no reload raced the measurement)`, `boot=${landed.bootId}`);
    check(landed.sentinel === 'alive', `HMR ${name}: no manual refresh / no reload (sentinel survived)`, String(landed.sentinel));
    check(landed.activePanels.length === 1 && landed.activePanels[0] === before.view,
      `HMR ${name}: the selected surface (${before.view}) is visible after the swap — never blank`,
      `active=${JSON.stringify(landed.activePanels)} cand=${landed.candVisible} ref=${landed.refVisible}`);
    check(landed.candSvg > 0 && landed.refSvg > 0,
      `HMR ${name}: both matched surfaces re-applied with inline SVG`,
      `candidates-svg=${landed.candSvg} reference-svg=${landed.refSvg}`);
    check(landed.view === before.view && landed.zoom === before.zoom,
      `HMR ${name}: tab and zoom preserved`, `view=${landed.view} zoom=${landed.zoom}`);
    check(Math.abs(landed.scroll - before.scroll) <= 2,
      `HMR ${name}: scroll place preserved`, `${before.scroll} → ${landed.scroll}`);
    check(landed.docHeight > landed.viewport,
      `HMR ${name}: the studio is not collapsed (blank) under a ready label`,
      `doc=${landed.docHeight} viewport=${landed.viewport}`);
    check(landed.status.includes('prepared'), `HMR ${name}: the status line stays prepared-labelled`, landed.status.slice(0, 60));
  };

  // Add / change / delete of NON-CONFIG-GRAPH watched inputs — real content
  // events on a transient probe file under data/ (the checkout's engraving
  // sources and MIDI are never edited; a mtime-only `touch` is not a reliable
  // change event for the dev watcher and is deliberately not used).
  await expectHmrCycle('add', () => writeFileSync(PROBE, JSON.stringify({ probe: 1 })));
  await expectHmrCycle('change', () => writeFileSync(PROBE, JSON.stringify({ probe: 2 })));
  await expectHmrCycle('delete', () => { if (existsSync(PROBE)) unlinkSync(PROBE); });

  console.log('VERDICT', failures.length === 0 ? 'PASS' : `FAIL (${failures.length} assertion(s))`);
  for (const failure of failures) console.log('  - ' + failure);
  process.exitCode = failures.length === 0 ? 0 : 1;
  ws.close();
} finally {
  rmSync(PROBE, { force: true });
  chrome.kill('SIGKILL');
}
