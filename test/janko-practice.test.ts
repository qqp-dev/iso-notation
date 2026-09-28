import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderPracticeView, resolvePracticeScale } from '../src/render/janko/practice';
import { layoutJankoScore } from '../src/render/janko/engine';
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
    assert.equal((view.svg.match(/class="janko-beam-group"/g) ?? []).length, fixture.beamGroupSizes.length);
    assert.deepEqual(view.attacks.map(a => a.pitchLinear), entry.pitchesLinear);
    assert.equal(view.attacks.map(a => a.hands.RH.finger).join(''), entry.rightFingers);
    assert.equal(view.attacks.map(a => a.hands.LH.finger).join(''), entry.leftFingers);
    assert.equal(view.attacks.map(a => a.hands.RH.row).join(''), entry.physicalRows);
    assert.equal(view.attacks.map(a => a.hands.LH.row).join(''), entry.physicalRows);
  }
});

test('Practice major scale: exact data, both parity placements, provisional reverse and 1-span transposition', () => {
  for (const tonic of [48, 49]) {
    const { score, fingers } = resolvePracticeScale(tonic);
    assert.equal(score.notes.length, 15);
    assert.equal(score.totalTicks, 360);
    assert.deepEqual(score.notes.map(n => n.startTick), Array.from({length: 15}, (_, i) => i * 24));
    assert.ok(score.notes.every(n => n.durationTicks === 24));
    assert.deepEqual(score.notes.map(n => n.pitch.octave * 12 + n.pitch.pitchClass), contour.map(step => tonic + step));
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
    pageWidth: input.width, pageHeight: input.height, measuresPerSystem: 4, systemsPerPage: 1,
    pageMargin: 24, pageMarginLeft: 28, pageMarginRight: 24, pageMarginTop: 90, pageMarginBottom: 0,
    headerHeight: 0, footerHeight: 0, ticksPerMeasure: 96, ticksPerBeat: 48,
    beamGroupTicks: 96, rhythmStyle: 'beamed',
    showMeasureNumbers: false, showTimeSignature: false, showHandLabels: false,
    showOctaveLabels: false, showBeatGrid: false, showHonorHalo: false,
    systemStartStyle: 'none', inferBoundaryRests: false, lowPitchFolding: 'literal',
  }, { ticksPerMeasure: 96 });
  assert.equal(laid.length, 1);
  assert.deepEqual(laid[0].beams.map(b => b.notes.length), [4, 4, 4, 3]);
  for (const [i, beam] of laid[0].beams.entries()) {
    assert.ok(beam.notes.every(n => Math.floor(n.startTick / 96) === i));
    assert.deepEqual(beam.levels.map(l => l.level), [1], 'eighths have exactly one beam');
    assert.ok(beam.primary.x2 > beam.primary.x1);
  }
  for (const attack of a.attacks) {
    assert.equal(attack.x, laid[0].notes.find(n => n.note.id === `practice-${attack.index}`)?.x);
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
  assert.equal((a.svg.match(/class="janko-digit"/g) ?? []).length, 15);
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
});

test('studio two candidate cards use portable renderer and leave Reference unchanged', () => {
  const config = createStudioConfig();
  assert.deepEqual(CURRENT_CANDIDATES.map(c => c.practiceGuide), ['two-guides', 'none']);
  const html = renderCandidatesView(config);
  for (const candidate of CURRENT_CANDIDATES) {
    assert.ok(html.includes(`data-candidate="${candidate.id}"`));
    assert.ok(html.includes('data-window="practice:major:48:1-1"'));
    assert.ok(html.includes('data-window="practice:major:49:1-1"'));
    assert.ok(html.includes(renderPracticeView({ ...input, guide: candidate.practiceGuide }).svg.replace('<svg ', '<svg class="janko-svg" ')));
  }
  assert.equal(renderReferenceView(config), renderReferenceView(createStudioConfig({ candidates: [] })));
});
