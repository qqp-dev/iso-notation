import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { QuantizedGridScore, QuantizedNote, WrittenTieChain } from '../src/model/types';
import { deriveTieDisplayPlan } from '../src/render/janko/ties';
import { layoutJankoScore, renderJankoPage, renderJankoCrop, countJankoPages } from '../src/render/janko/engine';
import { lintJankoScore } from '../src/render/janko/linter';
import { buildSchumannNo30Draft, schumannNo30WrittenFacts } from '../src/scores/schumann-no30-draft';
import { createStudioConfig } from '../src/render/janko/studio';
import { digitBaselineOffset } from '../src/render/janko/elements/notehead';
import { f } from '../src/render/janko/elements/style';

const note = (id: string, startTick: number, durationTicks: number): QuantizedNote => ({
  id, startTick, durationTicks, pitch: { pitchClass: 8, octave: 4 }, hand: 'RH',
});
const chain = (noteId: string, starts: number[], values: number[]): WrittenTieChain => ({
  noteId, voice: 'upper.0', soundingTicks: values.reduce((a, b) => a + b, 0),
  components: starts.map((startTick, i) => ({
    startTick, durationTicks: values[i], tieForward: i < values.length - 1,
    tieWait: false, voice: 'upper.0',
  })),
});
const specimen = (notes: QuantizedNote[], tieChains: WrittenTieChain[]): QuantizedGridScore => ({
  id: 'tie-value-specimen', title: 'Tie value', composer: 'Test', ticksPerBeat: 48,
  totalTicks: 384, timeSignatures: [{ tick: 0, numerator: 4, denominator: 4 }],
  barlines: [], tempos: [], dynamics: [], pedals: [], notes, tieChains,
});

test('different-value independent attack keeps its head; explicit 96-tick continuation survives layout, tie arc and SVG', () => {
  const score = specimen([note('carry', 0, 192), note('attack', 96, 24)], [chain('carry', [0, 96], [96, 96])]);
  const plan = deriveTieDisplayPlan(score);
  assert.deepEqual(plan.chains[0].components.map(c => [c.headId, c.durationTicks]),
    [['carry', 96], ['carry~c1', 96]]);
  assert.equal(plan.heads[0].tieStart, true);
  assert.equal(plan.heads[0].sourceProvenance?.voices[0], 'upper.0');
  const layouts = layoutJankoScore(score, { writtenTies: 'source' });
  const laid = layouts.flatMap(l => l.notes);
  for (const [id, value] of [['carry~c1', 96], ['attack', 24]] as const) {
    assert.equal(laid.find(p => p.note.id === id)?.note.durationTicks, value);
  }
  assert.notEqual(laid.find(p => p.note.id === 'carry~c1')?.x, laid.find(p => p.note.id === 'attack')?.x);
  const arc = layouts.flatMap(l => l.tieArcs ?? []).find(a => a.noteId === 'carry');
  assert.equal(arc?.toHeadId, 'carry~c1');
  const svg = renderJankoPage(score, 0, { writtenTies: 'source' }, undefined, layouts);
  assert.match(svg, /data-tie-to="carry~c1"/);
  const continuation = laid.find(p => p.note.id === 'carry~c1')!;
  const attack = laid.find(p => p.note.id === 'attack')!;
  // The page carries two separate positioned note glyphs at the continuation
  // onset, not merely two entries in the abstract tie plan.
  for (const p of [continuation, attack]) {
    const baseline = p.y + digitBaselineOffset(5.8 * (p.symbolScale ?? 1));
    assert.ok(svg.includes(`<text class="janko-digit" x="${f(p.x)}" y="${f(baseline)}"`),
      `${p.note.id}: painted glyph at its own layout seat`);
  }
  assert.equal(lintJankoScore(score, { writtenTies: 'source' }).violations.filter(v =>
    ['tie-component-value', 'tie-missing-head', 'tie-arc-missing'].includes(v.code)).length, 0);
});

test('reuse selects compatible head beyond first bucket member, including chain-first engraved value in either order', () => {
  const notes = [note('carry', 0, 192), note('wrong-first', 96, 24), note('chain-anchor', 96, 192)];
  const ties = [chain('carry', [0, 96], [96, 96]), chain('chain-anchor', [96, 192], [96, 96])];
  for (const ordered of [ties, [...ties].reverse()]) {
    const score = specimen(notes, ordered);
    const plan = deriveTieDisplayPlan(score);
    assert.equal(plan.chains.find(c => c.noteId === 'carry')?.components[1].headId, 'chain-anchor');
    assert.equal(plan.heads.some(h => h.startTick === 96), false);
    assert.equal(layoutJankoScore(score, { writtenTies: 'source' }).flatMap(l => l.notes)
      .find(p => p.note.id === 'chain-anchor')?.note.durationTicks, 96);
  }
  const same = specimen([note('carry', 0, 192), note('compatible', 96, 96)], [ties[0]]);
  assert.equal(deriveTieDisplayPlan(same).chains[0].components[1].headId, 'compatible');
  assert.equal(deriveTieDisplayPlan(same).heads.length, 0);
});

test('No30 both repeat entries retain separate 96/24 statements across full-page rendering and lint', () => {
  const entry = createStudioConfig().scores['schumann-op68-no30'];
  const score = buildSchumannNo30Draft();
  const plan = deriveTieDisplayPlan(score);
  const source113 = schumannNo30WrittenFacts.events.find(e => e.line === 113 && e.voice === 'upper.0')!;
  const source156 = schumannNo30WrittenFacts.events.find(e => e.line === 156 && e.kind === 'note' && e.pitches.some(p => p.absolutePitch === 56))!;
  const layouts = layoutJankoScore(entry.score, entry.options, entry.tokens);
  const laid = layouts.flatMap(l => l.notes);
  const pages = Array.from({ length: countJankoPages(entry.score, entry.options, entry.tokens) }, (_, i) =>
    renderJankoPage(entry.score, i, entry.options, entry.tokens, layouts));
  // Adaptive packing determines the page count; certify the entire written
  // bar sequence is covered exactly once, then certify every planned system
  // is painted on its appointed page (not just that some pages exist).
  const barTicks = entry.score.sourceBarTicks;
  assert.ok(barTicks && barTicks.length > 1, 'imported written bar boundaries are retained');
  let nextBar = 0;
  for (const layout of layouts) {
    const geo = layout.geometry;
    assert.equal(geo.firstBar, nextBar, `system ${layout.index + 1}: contiguous first written bar`);
    assert.ok(geo.measuresPerSystem > 0, 'no empty system');
    assert.equal(geo.sourceBarTicks, barTicks, 'system uses the source bar clock');
    nextBar += geo.measuresPerSystem;
    assert.ok(nextBar < barTicks.length, 'no system extends beyond the source ending');
  }
  assert.equal(nextBar, barTicks.length - 1, 'every written bar, including repeated entries and ending, is packed once');
  assert.equal(pages.length, Math.ceil(layouts.length / entry.options.systemsPerPage),
    'page booking agrees with the adaptive system plan');
  assert.ok(layouts.length < barTicks.length - 1, 'ordinary passages share systems rather than one bar per system');
  const renderedSystems = pages.flatMap((svg, page) => {
    const ids = [...svg.matchAll(/<g id="system-(\d+)">/g)].map(m => Number(m[1]));
    assert.deepEqual(ids, layouts.slice(page * entry.options.systemsPerPage,
      (page + 1) * entry.options.systemsPerPage).map(l => l.index + 1),
      `page ${page + 1}: exactly its planned systems in order`);
    return ids;
  });
  assert.deepEqual(renderedSystems, layouts.map(l => l.index + 1),
    'full-page SVG paints each system exactly once, without gaps or duplicates');
  for (const [start, count] of [[17, 3], [32, 4]]) {
    assert.match(renderJankoCrop(entry.score, start, count, entry.options, entry.tokens), /class="janko-tie/);
  }
  for (const [measure, tick] of [[18, 3120], [34, 6192]] as const) {
    const tied = score.notes.find(n => n.startTick < tick && n.startTick + n.durationTicks > tick &&
      score.tieChains?.some(c => c.noteId === n.id && c.components.some(k => k.startTick === tick && k.durationTicks === 96)) &&
      n.pitch.pitchClass === 8 && n.pitch.octave === 4);
    const independent = score.notes.find(n => n.startTick === tick && n.id.includes(source156.id));
    assert.ok(tied && independent, `m${measure}: both source voices present`);
    assert.notEqual(independent.tieStart, true);
    assert.equal(independent.durationTicks, 24);
    const component = plan.chains.find(c => c.noteId === tied.id)?.components.find(c => c.startTick === tick);
    assert.ok(component, `m${measure}: written continuation`);
    assert.equal(component.durationTicks, 96);
    assert.ok(component.added);
    assert.equal(plan.heads.find(h => h.id === component.headId)?.tieStart, true);
    assert.equal(plan.heads.find(h => h.id === component.headId)?.sourceProvenance?.voices[0], source113.voice);
    assert.notEqual(component.headId, independent.id);
    const head96 = laid.find(p => p.note.id === component.headId);
    const head24 = laid.find(p => p.note.id === independent.id);
    assert.equal(head96?.note.durationTicks, 96);
    assert.equal(head24?.note.durationTicks, 24);
    assert.notEqual(head96?.x, head24?.x);
    for (const head of [head96!, head24!]) {
      const baseline = head.y + digitBaselineOffset(5.8 * (head.symbolScale ?? 1));
      assert.ok(pages.some(svg => svg.includes(`<text class="janko-digit" x="${f(head.x)}" y="${f(baseline)}"`)),
        `${head.note.id}: full page paints its own glyph`);
    }
    const arc = layouts.flatMap(l => l.tieArcs ?? []).find(a => a.noteId === tied.id && a.toHeadId === component.headId);
    assert.ok(arc?.path, `m${measure}: painted tie arc`);
    assert.ok(pages.some(svg => svg.includes(`data-tie-to="${component.headId}"`) && svg.includes(`d="${arc.path}"`)),
      `m${measure}: full page contains the tie path`);
    console.log(`No30 m${measure}: ${component.headId}=96, ${independent.id}=24`);
  }
  const lint = lintJankoScore(entry.score, entry.options, entry.tokens);
  const fundamental = ['tie-component-value', 'tie-missing-head', 'tie-arc-missing', 'tie-anchor-shortfall'];
  assert.deepEqual([...lint.violations, ...lint.warnings].filter(v => fundamental.includes(v.code)), []);
  console.log(`No30 pages=${pages.length}; remaining=${JSON.stringify(Object.entries(lint.violations.reduce((acc, v) => {
    acc[v.code] = (acc[v.code] ?? 0) + 1; return acc;
  }, {} as Record<string, number>)))}; locations=${JSON.stringify(lint.violations.map(v => [v.code, v.measure, v.noteIds]))}`);
});
