import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { candidateObservation, observeCandidateFrame } from '../src/render/janko/prepared/observation';

function harness() {
  const pending: Array<() => void> = [];
  const panel = { dataset: { view: 'candidates' }, classList: { contains: () => true } };
  const root = {
    isConnected: true,
    dataset: { preparedState: 'ready', preparedGeneration: 'g1', preparedCandidateRevision: 'r1', preparedCandidatesHash: 'h1', preparedApply: '1', preparedObservation: '' },
    querySelectorAll: () => [panel],
  };
  const doc = { visibilityState: 'visible' };
  const win = { requestAnimationFrame: (cb: () => void) => { pending.push(cb); return pending.length; } };
  const frames = () => { while (pending.length) pending.shift()!(); };
  const observed = () => JSON.parse(root.dataset.preparedObservation);
  return { root, doc, win, frames, observed, panel };
}

test('two frame opportunities acknowledge only the exact applied visible candidate, not server readiness', () => {
  const h = harness();
  const root = h.root as unknown as HTMLElement, doc = h.doc as unknown as Document, win = h.win as unknown as Window;
  observeCandidateFrame(root, doc, win);
  assert.equal(h.observed().state, 'unobserved');
  h.frames();
  assert.deepEqual([h.observed().state, h.observed().generation, h.observed().candidateRevision, h.observed().candidatesHash], ['frame-opportunity', 'g1', 'r1', 'h1']);
  assert.equal(typeof h.observed().observedAt, 'number');
  h.doc.visibilityState = 'hidden';
  assert.equal(candidateObservation(root, doc).state, 'unobserved');
  observeCandidateFrame(root, doc, win);
  assert.equal(h.observed().reason, 'hidden');
  h.doc.visibilityState = 'visible';
  h.panel.dataset.view = 'reference';
  observeCandidateFrame(root, doc, win);
  assert.equal(h.observed().reason, 'wrong-view');
  h.panel.dataset.view = 'candidates';
  h.root.isConnected = false;
  assert.equal(candidateObservation(root, doc).reason, 'disconnected');
});

test('frame evidence includes the active comparison variant, not just a shared state revision', () => {
  const h = harness();
  const data = h.root.dataset as Record<string, string>;
  data.preparedVariantId = 'gap-positive';
  const root = h.root as unknown as HTMLElement, doc = h.doc as unknown as Document, win = h.win as unknown as Window;
  observeCandidateFrame(root, doc, win);
  h.frames();
  assert.equal(h.observed().state, 'frame-opportunity');
  assert.ok(Object.entries(h.observed()).some(([key, value]) => /variant/i.test(key) && value === 'gap-positive'),
    'an observer must identify which active variant had a frame opportunity');
  observeCandidateFrame(root, doc, win);
  data.preparedVariantId = 'beside';
  h.frames();
  assert.notEqual(h.observed().state, 'frame-opportunity', 'a superseded variant must not inherit the earlier frame');
});

test('superseded frames, pending fetches and stale/error generations never acknowledge a candidate', () => {
  const h = harness();
  const root = h.root as unknown as HTMLElement, doc = h.doc as unknown as Document, win = h.win as unknown as Window;
  observeCandidateFrame(root, doc, win);
  h.root.dataset.preparedState = 'loading';
  h.frames();
  assert.equal(h.observed().state, 'unobserved');
  h.root.dataset.preparedState = 'ready';
  observeCandidateFrame(root, doc, win);
  h.root.dataset.preparedApply = '2';
  h.root.dataset.preparedGeneration = 'g2';
  h.frames();
  assert.equal(h.observed().state, 'unobserved');
  for (const state of ['stale', 'error', 'refreshing']) {
    h.root.dataset.preparedState = state;
    observeCandidateFrame(root, doc, win);
    assert.equal(h.observed().state, 'unobserved');
  }
  h.root.dataset.preparedState = 'ready';
  observeCandidateFrame(root, doc, win);
  observeCandidateFrame(root, doc, win); // earlier callback cannot clobber the newer observation
  h.frames();
  assert.equal(h.observed().state, 'frame-opportunity');
});
