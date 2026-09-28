import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderPracticeView, resolvePracticeScale, SUPPORTED_PRACTICE_SCALES } from '../src/render/janko/practice';
import { lintJankoScore } from '../src/render/janko/linter';
import { layoutJankoScore } from '../src/render/janko/engine';
import { placedBeamGroup } from '../src/render/janko/beam-scene';
import { DEFAULT_JANKO_TOKENS } from '../src/render/janko/types';
import { CURRENT_CANDIDATES } from '../src/render/janko/candidates';
import { createStudioConfig, renderCandidatesView, renderReferenceView } from '../src/render/janko/studio';

const input = { rudiment: 'scale' as const, scaleType: 'major' as const, tonicLinear: 48, width: 760, height: 380 };
const contour = [0, 2, 4, 5, 7, 9, 11, 12, 11, 9, 7, 5, 4, 2, 0];

test('versioned consumer fixtures match rendered data and stable selection identities', () => {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/practice-v1.json', import.meta.url), 'utf8'));
  for (const entry of fixture.cases) {
    const view = renderPracticeView(entry.request);
    assert.equal(view.contractVersion, fixture.contractVersion);
    assert.equal(view.isoVersion, fixture.isoVersion);
    assert.equal(view.selectionId, entry.selectionId);
    assert.equal(view.systemCount, entry.systemCount);
    assert.deepEqual(view.attacks.map(a => a.tick), fixture.onsetTicks);
    assert.equal((view.svg.match(/class="janko-beam-group"/g) ?? []).length, 2 * fixture.beamGroupSizes.length);
    assert.deepEqual(view.attacks.map(a => a.pitchLinear), entry.pitchesLinear);
    assert.deepEqual(view.attacks.map(a => a.hands.RH.pitchLinear), entry.pitchesLinear);
    assert.deepEqual(view.attacks.map(a => a.hands.LH.pitchLinear), entry.pitchesLinear.map((p: number) => p - 12));
    assert.deepEqual([view.attacks.filter(a => a.tick < 96).length, view.attacks.filter(a => a.tick >= 96).length], fixture.measureAttackCounts);
    assert.equal(view.attacks.map(a => a.hands.RH.finger).join(''), entry.rightFingers);
    assert.equal(view.attacks.map(a => a.hands.LH.finger).join(''), entry.leftFingers);
    assert.equal(view.attacks.map(a => a.hands.RH.row).join(''), entry.physicalRows);
    assert.equal(view.attacks.map(a => a.hands.LH.row).join(''), entry.physicalRows);
  }
});

test('Practice major scale: exact data, both parity placements, provisional reverse and 1-span transposition', () => {
  assert.deepEqual(resolvePracticeScale(48), resolvePracticeScale(48, 'major'), 'default-major caller remains compatible');
  for (const tonic of [48, 49]) {
    const { score, fingers } = resolvePracticeScale(tonic);
    assert.equal(score.notes.length, 30);
    assert.equal(score.totalTicks, 180);
    for (const hand of ['RH', 'LH']) {
      const notes = score.notes.filter(n => n.hand === hand);
      assert.deepEqual(notes.map(n => n.startTick), Array.from({length: 15}, (_, i) => i * 12));
      assert.ok(notes.every(n => n.durationTicks === 12));
      assert.deepEqual(notes.map(n => n.pitch.octave * 12 + n.pitch.pitchClass),
        contour.map(step => tonic + step - (hand === 'LH' ? 12 : 0)));
      assert.deepEqual([notes.filter(n => n.startTick < 96).length, notes.filter(n => n.startTick >= 96).length], [8, 7]);
    }
    assert.deepEqual(score.barlines, [], 'no fabricated terminal bar or rest');
    assert.deepEqual(fingers.map(f => f.RH).join(''), '234123121321432');
    assert.deepEqual(fingers.map(f => f.LH).join(''), '432132141231234');
    assert.equal(fingers.map(f => f.row).join(''), tonic === 48 ? '333244232442333' : '222133121331222');
    for (let i = 0; i < fingers.length; i++) {
      const parity = (tonic + contour[i]) % 2;
      assert.ok([1, 2, 3, 4].includes(fingers[i].row));
      assert.equal(fingers[i].row % 2, 1 - parity);
    }
  }
});

test('N26 exact ascending source data, reverse descent, parity rows and both-hand real-engine layout', () => {
  assert.deepEqual(SUPPORTED_PRACTICE_SCALES, [
    { id: 'major', label: 'Major' }, { id: 'natural-minor', label: 'Natural minor (N26)' },
  ]);
  const offsets = [0, 2, 3, 5, 7, 8, 10, 12];
  assert.deepEqual(offsets.slice(1).map((n, i) => n - offsets[i]), [2, 1, 2, 2, 1, 2, 2]);
  const relative = [2, 0, 1, 1, 1, 0, 2, 2];
  for (const tonic of [36, 48, 49, 60]) {
    const { score, fingers } = resolvePracticeScale(tonic, 'natural-minor');
    assert.equal(score.id, `practice-natural-minor-${tonic}`);
    assert.equal(score.notes.length, 30);
    assert.equal(score.totalTicks, 180);
    assert.deepEqual(fingers.slice(0, 8).map(f => f.RH), [3, 1, 2, 3, 4, 1, 2, 3]);
    assert.deepEqual(fingers.slice(0, 8).map(f => f.LH), [2, 1, 4, 3, 2, 1, 3, 2]);
    assert.deepEqual(fingers.slice(0, 8).map(f => f.row), relative.map(n => n + (tonic % 2 ? 2 : 1)));
    assert.equal(fingers.slice(0, 8).map(f => f.row).join(''), tonic % 2 ? '42333244' : '31222133');
    assert.deepEqual(fingers.slice(8), fingers.slice(0, 7).reverse(), 'descending path exactly reverses');
    assert.deepEqual([1, 5].map(i => fingers[i].RH), [1, 1]);
    assert.deepEqual([1, 5].map(i => fingers[i].LH), [1, 1]);
    assert.deepEqual([1, 5].map(i => fingers[i].row - (tonic % 2 ? 2 : 1)), [0, 0]);
    for (const hand of ['RH', 'LH'] as const) {
      const notes = score.notes.filter(n => n.hand === hand);
      assert.deepEqual(notes.map(n => n.startTick), Array.from({ length: 15 }, (_, i) => 12 * i));
      assert.ok(notes.every(n => n.durationTicks === 12));
      assert.deepEqual(notes.map(n => n.pitch.octave * 12 + n.pitch.pitchClass),
        [...offsets, ...offsets.slice(0, 7).reverse()].map(n => tonic + n - (hand === 'LH' ? 12 : 0)));
      for (const [i, n] of notes.entries()) assert.equal(fingers[i].row % 2, 1 - (n.pitch.pitchClass % 2));
    }
  }
  for (const tonic of [48, 49]) {
    const request = { ...input, scaleType: 'natural-minor' as const, tonicLinear: tonic };
    const view = renderPracticeView(request);
    const { score } = resolvePracticeScale(tonic, 'natural-minor');
    assert.equal(view.selectionId, `scale:natural-minor:${tonic}`);
    assert.ok(view.svg.includes(`data-selection="scale:natural-minor:${tonic}"`));
    assert.equal(view.systemCount, 1);
    assert.equal(view.attacks.length, 15);
    assert.ok(view.railClearance >= 20);
    assert.equal((view.svg.match(/class="janko-digit"/g) ?? []).length, 30);
    assert.equal((view.svg.match(/stroke="#384455" stroke-width="0.55"/g) ?? []).length, 4);
    const laid = layoutJankoScore(score, practiceLayoutOptions(request), { ticksPerMeasure: 96 });
    assert.equal(laid.length, 1);
    assert.equal(laid[0].notes.length, 30);
    for (const hand of ['RH', 'LH'] as const) {
      const beams = laid[0].beams.filter(b => b.notes[0].hand === hand);
      assert.deepEqual(beams.map(b => b.notes.length), [4, 4, 4, 3]);
      assert.ok(beams.every(b => b.levels.map(l => l.level).join(',') === '1,2' && b.levels.every(l => !l.stub)));
    }
    for (const attack of view.attacks) {
      const rh = laid[0].notes.find(n => n.note.id === `practice-RH-${attack.index}`)!;
      const lh = laid[0].notes.find(n => n.note.id === `practice-LH-${attack.index}`)!;
      assert.equal(attack.x, rh.x, `RH tonic ${tonic} attack ${attack.index}`);
      assert.equal(attack.x, lh.x, `LH tonic ${tonic} attack ${attack.index}`);
      assert.equal(lh.y - rh.y, 30);
      assert.equal(attack.hands.RH.pitchLinear, rh.note.pitch.octave * 12 + rh.note.pitch.pitchClass);
      assert.equal(attack.hands.LH.pitchLinear, lh.note.pitch.octave * 12 + lh.note.pitch.pitchClass);
      assert.ok(attack.hands.RH.y < attack.hands.LH.y);
    }
    const report = lintJankoScore(score, practiceLayoutOptions(request), { ticksPerMeasure: 96 });
    assert.equal(report.violations.length, 0, JSON.stringify(report.violations.slice(0, 3)));
  }
});

function practiceLayoutOptions(request: { width: number; height: number }) {
  return {
    pageWidth: request.width, pageHeight: request.height, measuresPerSystem: 2, systemsPerPage: 1,
    pageMargin: 24, pageMarginLeft: 28, pageMarginRight: 24, pageMarginTop: 90, pageMarginBottom: 0,
    headerHeight: 0, footerHeight: 0, ticksPerMeasure: 96, ticksPerBeat: 48,
    beamGroupTicks: 48, rhythmStyle: 'beamed' as const,
    showMeasureNumbers: false, showTimeSignature: false, showHandLabels: false,
    showOctaveLabels: false, showBeatGrid: false, showHonorHalo: false,
    systemStartStyle: 'none' as const, inferBoundaryRests: false, lowPitchFolding: 'literal' as const,
  };
}

test('portable complete SVG has real engine note columns, independent aligned rails and measured clearance', () => {
  const a = renderPracticeView(input);
  const b = renderPracticeView({ ...input, guide: 'none' });
  const transposed = renderPracticeView({ ...input, tonicLinear: 49 });
  assert.equal(a.selectionId, 'scale:major:48');
  assert.equal(transposed.selectionId, 'scale:major:49');
  assert.equal(a.contractVersion, 1);
  assert.match(a.isoVersion, /^\d+\.\d+\.\d+$/);
  assert.equal(a.systemCount, 1);
  assert.equal(a.attacks.length, 15);
  assert.ok(a.railClearance >= 20);
  assert.match(a.svg, /<svg[^>]*width="760px" height="380px" viewBox="0 0 760 380"/);
  assert.deepEqual(a.attacks, b.attacks, 'only guides differ');
  const laid = layoutJankoScore(resolvePracticeScale(48).score, {
    pageWidth: input.width, pageHeight: input.height, measuresPerSystem: 2, systemsPerPage: 1,
    pageMargin: 24, pageMarginLeft: 28, pageMarginRight: 24, pageMarginTop: 90, pageMarginBottom: 0,
    headerHeight: 0, footerHeight: 0, ticksPerMeasure: 96, ticksPerBeat: 48,
    beamGroupTicks: 48, rhythmStyle: 'beamed',
    showMeasureNumbers: false, showTimeSignature: false, showHandLabels: false,
    showOctaveLabels: false, showBeatGrid: false, showHonorHalo: false,
    systemStartStyle: 'none', inferBoundaryRests: false, lowPitchFolding: 'literal',
  }, { ticksPerMeasure: 96 });
  assert.equal(laid.length, 1);
  assert.equal(laid[0].notes.length, 30);
  for (const hand of ['RH', 'LH']) {
    const beams = laid[0].beams.filter(b => b.notes[0].hand === hand);
    assert.deepEqual(beams.map(b => b.notes.length), [4, 4, 4, 3]);
    for (const [i, beam] of beams.entries()) {
      assert.ok(beam.notes.every(n => n.hand === hand && Math.floor(n.startTick / 48) === i));
      assert.deepEqual(beam.notes.map(n => n.startTick),
        Array.from({length: i === 3 ? 3 : 4}, (_, k) => i * 48 + k * 12));
      assert.deepEqual(beam.levels.map(l => l.level), [1, 2], 'sixteenths have two full beams');
      assert.ok(beam.levels.every(l => !l.stub && l.connector.x2 > l.connector.x1));
      const painted = placedBeamGroup(beam, DEFAULT_JANKO_TOKENS, 'golden', 0, 0);
      assert.equal(painted.filter(p => p.cls === 'janko-beam-secondary').length, 1);
      for (const stem of beam.stems) {
        const ink = painted.find(p => p.cls === 'janko-stem' && p.shape.kind === 'stem' && p.shape.x === Math.round(stem.stemX * 100) / 100);
        assert.ok(ink?.shape.kind === 'stem' && Math.abs(beam.beamY(stem.stemX) - ink.shape.y2) <= 0.011,
          'painted stem joins primary beam');
        assert.ok(beam.levels.every(l => stem.stemX >= l.connector.x1 - 1e-6 && stem.stemX <= l.connector.x2 + 1e-6),
          'both beam strips span each stem');
      }
    }
  }
  for (const attack of a.attacks) {
    for (const hand of ['RH', 'LH'] as const) {
      const note = laid[0].notes.find(n => n.note.id === `practice-${hand}-${attack.index}`);
      assert.equal(attack.x, note?.x);
      assert.equal(attack.hands[hand].pitchLinear, note!.note.pitch.octave * 12 + note!.note.pitch.pitchClass);
    }
    const rh = laid[0].notes.find(n => n.note.id === `practice-RH-${attack.index}`)!;
    const lh = laid[0].notes.find(n => n.note.id === `practice-LH-${attack.index}`)!;
    assert.equal(lh.y - rh.y, 30, 'literal one 10-span LH drop, no octave folding');
    assert.ok(rh.y > 0 && lh.y < input.height, 'both hands fit within viewport');
    assert.equal(attack.hands.RH.pitchLinear - attack.hands.LH.pitchLinear, 12);
    assert.ok(attack.hands.RH.y < attack.hands.LH.y);
    assert.ok(attack.hands.LH.y + 4 < laid[0].geometry.staffTopY - 20);
    const closestInk = Math.min(laid[0].geometry.staffTopY - 1,
      ...laid[0].notes.map(n => n.y - 4.8 - 1),
      ...laid[0].beams.flatMap(b => [...b.stems.map(s => Math.min(s.stemStartY, s.stemEndY) - 1),
        b.primary.y1 - b.thickness / 2 - 1, b.primary.y2 - b.thickness / 2 - 1]));
    assert.ok(a.railClearance <= closestInk - (Math.max(...a.attacks.map(n => n.hands.LH.y)) + 4),
      'conservative bound includes an unoccupied row-1 seat and real beam ink');
    assert.equal((a.svg.match(new RegExp(`data-attack="${attack.index}"`, 'g')) ?? []).length, 2);
  }
  assert.equal((a.svg.match(/<g id="system-/g) ?? []).length, 1);
  assert.equal((a.svg.match(/class="janko-digit"/g) ?? []).length, 30);
  assert.equal((a.svg.match(/class="practice-RH"/g) ?? []).length, 1);
  assert.equal((a.svg.match(/class="practice-LH"/g) ?? []).length, 1);
  assert.equal((a.svg.match(/stroke="#384455" stroke-width="0.55"/g) ?? []).length, 4);
  // Every hand's two guides stay strictly between numbered row centres.
  const guideYs = [...a.svg.matchAll(/<line x1="[^"]+" x2="[^"]+" y1="([^"]+)" y2="[^"]+" stroke="#384455" stroke-width="0.55"\/>/g)].map(m => Number(m[1]));
  for (const y of guideYs) {
    const hand = y < Math.min(...a.attacks.map(n => n.hands.LH.y)) - 4 ? 'RH' : 'LH';
    assert.ok(a.attacks.every(n => Math.abs(n.hands[hand].y - y) >= 7.5));
  }
  assert.equal((b.svg.match(/stroke="#384455" stroke-width="0.55"/g) ?? []).length, 0);
  assert.ok(a.svg.includes('fill="#000000"'), 'black ground / true opaque knockout');
  assert.ok(!a.svg.includes('fill="#FFFFFF"'));
  assert.ok(a.svg.includes('data:font/otf;base64,'), 'font travels with SVG');
  assert.ok(!a.svg.includes('url(/fonts/') && !a.svg.includes('href="http'), 'no studio-dependent asset path');
  assert.equal(a.svg, renderPracticeView(input).svg, 'byte-deterministic');
});

test('invalid and unsupported requests are refused instead of silently clipped', () => {
  for (const patch of [
    { tonicLinear: 35 }, { tonicLinear: 61 }, { tonicLinear: 48.5 },
    { width: 559 }, { height: 359 }, { width: Infinity }, { height: NaN },
    { rudiment: 'chord' }, { scaleType: 'minor' }, { guide: 'unknown' },
  ]) assert.throws(() => renderPracticeView({ ...input, ...patch } as typeof input));
  assert.equal(renderPracticeView({ ...input, width: 560, height: 360 }).systemCount, 1);
  assert.throws(() => resolvePracticeScale(48, 'harmonic-minor' as 'major'), RangeError);
  for (const scaleType of ['major', 'natural-minor'] as const)
    for (const tonicLinear of [36, 49, 60])
      assert.equal(renderPracticeView({ ...input, scaleType, tonicLinear, width: 1600, height: 900 }).systemCount, 1);
});

test('studio major and N26 cards use portable renderer and leave Reference unchanged', () => {
  const config = createStudioConfig();
  assert.deepEqual(CURRENT_CANDIDATES.map(c => c.practiceScaleType), ['major', 'natural-minor']);
  assert.deepEqual(CURRENT_CANDIDATES.map(c => c.practiceGuide), ['two-guides', 'two-guides']);
  const html = renderCandidatesView(config);
  for (const candidate of CURRENT_CANDIDATES) {
    assert.ok(html.includes(`data-candidate="${candidate.id}"`));
    for (const tonic of [48, 49]) assert.ok(html.includes(`data-window="practice:${candidate.practiceScaleType}:${tonic}:1-2"`));
    assert.ok(html.includes(renderPracticeView({ ...input, scaleType: candidate.practiceScaleType!, guide: candidate.practiceGuide }).svg.replace('<svg ', '<svg class="janko-svg" ')));
  }
  assert.equal(renderReferenceView(config), renderReferenceView(createStudioConfig({ candidates: [] })));
});
