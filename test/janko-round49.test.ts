/**
 * Round 49 — the review's three acceptance pins.
 * ==============================================
 *
 * The review of the seven-part round verified the runtime behaviour and
 * required three regression pins this suite was missing:
 *
 * - **A** the linter's new `symbol-stem-conflict` defect class gets its
 *   matching mutation assertion, and the *positive* seat acceptance — an
 *   above-mounted symbol passes `symbol-seat-inconsistent` under
 *   `standaloneLongMount: 'above'` — is pinned (the pre-existing negative
 *   default-mount mutation lives in `test/janko-linter.test.ts`);
 * - **B** the tie laws are pinned against an **independent oracle**: the four
 *   recorded LilyPond 2.26.0 specimens of
 *   `docs/round48-rest-provenance-and-tie-trace.md` §4.1 (external
 *   measurements, not this engine's output) plus representative spans checked
 *   against the documented law re-derived inline from its recorded constants —
 *   never `tieTracedDepth` compared with itself;
 * - **C** every Round 49 candidate card lints clean on the **whole** Brahms
 *   score (the Round 47 suite's whole-card analog, carried forward to the live
 *   trio).
 *
 * Everything is measured on the real engine and the real linter; nothing here
 * claims operator aesthetic acceptance.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  BRAHMS_OP118_NO1_JANKO_OPTIONS,
  BRAHMS_OP118_NO1_JANKO_TOKENS,
  buildBrahmsOp118No1Score,
} from '../src/scores/brahms-op118-no1';
import { getCandidate } from '../src/render/janko/candidates';
import { resolveJankoOptions, resolveJankoTokens } from '../src/render/janko/types';
import { layoutJankoScore, type JankoSystemLayout } from '../src/render/janko/engine';
import { checkDurationInkOwnership, lintJankoScore, type LintViolation } from '../src/render/janko/linter';
import { detachedSymbolInkBox } from '../src/render/janko/elements/rhythm';
import { tieTracedDepth, tieTracedIndent } from '../src/render/janko/ties';

const BRAHMS = buildBrahmsOp118No1Score();

function cardRun(id: string): {
  options: ReturnType<typeof resolveJankoOptions>;
  tokens: ReturnType<typeof resolveJankoTokens>;
  layouts: JankoSystemLayout[];
} {
  const candidate = getCandidate(id);
  assert.ok(candidate, `card ${id} is registered`);
  const options = resolveJankoOptions({
    ...BRAHMS_OP118_NO1_JANKO_OPTIONS,
    ...(candidate.options ?? {}),
  });
  const tokens = resolveJankoTokens({ ...BRAHMS_OP118_NO1_JANKO_TOKENS, ...(candidate.tokens ?? {}) });
  return { options, tokens, layouts: layoutJankoScore(BRAHMS, options, tokens) };
}

// ---------------------------------------------------------------------------
// A. The above seat: positive acceptance and the symbol-stem-conflict oracle
// ---------------------------------------------------------------------------

test('A. The above seat passes the seat contract under its option and never covers stem or beam ink', () => {
  const run = cardRun('round49-above-080');
  const symbols = run.layouts.flatMap((l) => l.detachedSymbols);
  assert.equal(symbols.length, 29, 'the written-tie surface seats 29 statements');
  const above = symbols.filter((s) => s.seat === 'above');
  assert.deepEqual(
    above.map((s) => s.noteId).sort(),
    ['brahms-op118-no1-918~c1', 'brahms-op118-no1-920~c1'],
    'the two m. 68 half-rings are the above-seated statements (their right seats are refused by drawn rules)'
  );
  assert.equal(
    symbols.filter((s) => s.seat === 'right').length,
    27,
    'every other statement keeps the right seat (fallback or ordinary mount)'
  );

  // The positive acceptance: judged by the card's own options, every seat
  // verdict passes — no `symbol-seat-inconsistent` anywhere, and the clean
  // seats cover no painted stem or beam (`symbol-stem-conflict`).
  for (const layout of run.layouts) {
    const out: LintViolation[] = [];
    checkDurationInkOwnership(layout, run.options, run.tokens, out);
    assert.deepEqual(
      out.filter((v) => v.code === 'symbol-seat-inconsistent'),
      [],
      `system ${layout.index}: the above seats are legal under standaloneLongMount 'above'`
    );
    assert.deepEqual(
      out.filter((v) => v.code === 'symbol-stem-conflict'),
      [],
      `system ${layout.index}: the seated symbols cover no stem or beam ink`
    );
  }

  // The contrast that names the option as the gate: the identical layouts
  // judged under the incumbent right mount report exactly the two above seats
  // as the placement regression — and nothing else.
  const candidate = getCandidate('round49-above-080')!;
  const rightMount = resolveJankoOptions({
    ...BRAHMS_OP118_NO1_JANKO_OPTIONS,
    ...candidate.options,
    standaloneLongMount: 'right',
  });
  assert.equal(rightMount.standaloneLongMount, 'right', 'the contrast flips only the mount axis');
  const flagged: string[] = [];
  for (const layout of run.layouts) {
    const out: LintViolation[] = [];
    checkDurationInkOwnership(layout, rightMount, run.tokens, out);
    for (const v of out) {
      if (v.code === 'symbol-seat-inconsistent') flagged.push(...(v.noteIds ?? []));
      else assert.fail(`system ${layout.index}: unexpected ${v.code} under the contrast mount`);
    }
  }
  assert.deepEqual(
    flagged.sort(),
    ['brahms-op118-no1-918~c1', 'brahms-op118-no1-920~c1'],
    'under the default mount the same seats are the regression the option legalizes'
  );

  // The new defect class, by mutation: an above seat moved onto painted stem
  // ink is a `symbol-stem-conflict`. Fixture: the m. 68 system (it carries the
  // above seats), its first beam group's first stem.
  const system = run.layouts.find((l) =>
    l.detachedSymbols.some((s) => s.noteId === 'brahms-op118-no1-918~c1')
  )!;
  assert.ok(system, 'the m. 68 system is laid out');
  const symbol = system.detachedSymbols.find((s) => s.noteId === 'brahms-op118-no1-918~c1')!;
  const box = detachedSymbolInkBox(symbol, run.tokens);
  const beam = system.beams[0];
  const stem = beam.stems[0];
  const stemMidY = (Math.min(stem.stemStartY, stem.stemEndY) + Math.max(stem.stemStartY, stem.stemEndY)) / 2;
  const ontoStem: JankoSystemLayout = {
    ...system,
    detachedSymbols: system.detachedSymbols.map((s) =>
      s.noteId === symbol.noteId
        ? { ...s, x: stem.stemX - (box.x1 - box.x0) / 2, y: stemMidY - (box.y1 - box.y0) / 2 }
        : s
    ),
  };
  const stemOut: LintViolation[] = [];
  checkDurationInkOwnership(ontoStem, run.options, run.tokens, stemOut);
  const stemHits = stemOut.filter((v) => v.code === 'symbol-stem-conflict');
  assert.equal(stemHits.length, 1, 'one moved symbol over one stem band is one defect');
  assert.match(stemHits[0]!.message, /shares ink with the stem/);
  assert.match(stemHits[0]!.message, /never covers a painted stem/);

  // And onto the beam strip itself, between the stems (clear of the stem
  // bands): the same defect class names the beam.
  const connector = beam.levels[0].connector;
  const beamMidX = (connector.x1 + connector.x2) / 2;
  const beamMidY = (connector.y1 + connector.y2) / 2;
  const ontoBeam: JankoSystemLayout = {
    ...system,
    detachedSymbols: system.detachedSymbols.map((s) =>
      s.noteId === symbol.noteId
        ? { ...s, x: beamMidX - (box.x1 - box.x0) / 2, y: beamMidY - (box.y1 - box.y0) / 2 }
        : s
    ),
  };
  const beamOut: LintViolation[] = [];
  checkDurationInkOwnership(ontoBeam, run.options, run.tokens, beamOut);
  const beamHits = beamOut.filter((v) => v.code === 'symbol-stem-conflict');
  assert.ok(beamHits.length >= 1, 'a symbol over the beam strip is caught');
  assert.match(beamHits[0]!.message, /shares ink with a beam strip/);
});

// ---------------------------------------------------------------------------
// B. The tie laws against an independent oracle
// ---------------------------------------------------------------------------

test('B. The tie laws reproduce LilyPond 2.26.0\'s own computed control-points (the independent oracle)', () => {
  // Independent oracle: LilyPond 2.26.0 (`lilypond -dbackend=null`, this
  // machine) with an `after-line-breaking` Scheme hook dumping each Tie\'s
  // own computed `control-points` in staff-space units, at five spans
  // (c16/c8/c4/c2/c1 ties). These are the reference compiler\'s own numbers —
  // not this engine\'s output, and not a fit of ours to them.
  const dumped: Array<{ w: number; h: number; indent: number }> = [
    { w: 1.5563, h: 0.4349746927660165, indent: 0.4012995887214253 },
    { w: 3.0405327338155637, h: 0.642665374398023, indent: 0.6580860262934395 },
    { w: 3.6621274152157285, h: 0.693707918445391, indent: 0.742664794528139 },
    { w: 4.509420577761375, h: 0.744727330285408, indent: 0.8421409066939419 },
    { w: 6.281073346264347, h: 0.811903528319551, indent: 1.0064957030549496 },
  ];
  const tokens = resolveJankoTokens(BRAHMS_OP118_NO1_JANKO_TOKENS);
  // The reference constants, pinned: LilyPond\'s Tie grob defaults
  // (`scm/define-grobs.scm`, v2.26.0) and the dossier\'s measured staff space.
  assert.equal(tokens.tieRefStaffSpace, 4.984, 'the measured staff space of the specimen record');
  assert.equal(tokens.tieRefHeightLimit, 1.0, 'the reference height-limit (LilyPond Tie default)');
  assert.equal(tokens.tieRefRatio, 0.333, 'the reference ratio (LilyPond Tie default)');
  assert.ok(Math.abs(tokens.tieRefIndentMaxFraction - 1 / 3.1) < 1e-12, 'the reference max fraction');
  // Tolerance: five decimal places of the dump survive rounding of the
  // attachment x to 4 decimals; 0.005 sp is far looser than that and far
  // tighter than any fitted approximation could promise.
  const TOL = 0.005;
  for (const { w, h, indent } of dumped) {
    const widthPt = w * tokens.tieRefStaffSpace;
    // Our depth is the printed outer-boundary apex: 0.75 of the outer control
    // offset, which itself sits half the body thickness above the reference
    // centre curve — subtract it to compare with the bare control-point law.
    const gotHSp = (tieTracedDepth(widthPt, tokens) / 0.75 - tokens.tieApexThickness / 1.5) / tokens.tieRefStaffSpace;
    assert.ok(
      Math.abs(gotHSp - h) <= TOL,
      `span ${w}sp: the height law reads ${gotHSp.toFixed(5)}sp against LilyPond\'s ${h}sp`
    );
    const gotIndentSp = tieTracedIndent(widthPt, tokens) / tokens.tieRefStaffSpace;
    assert.ok(
      Math.abs(gotIndentSp - indent) <= TOL,
      `span ${w}sp: the indent law reads ${gotIndentSp.toFixed(5)}sp against LilyPond\'s ${indent}sp`
    );
  }
});

test('B. The laws reproduce the four recorded output apexes of the Round 48 dossier', () => {
  // `docs/round48-rest-provenance-and-tie-trace.md` §4.1: real
  // `lilypond -dbackend=svg` ties at staff space 4.984pt — the printed outer
  // boundary apexes. The reference laws plus the sandwich offset reproduce
  // them within 0.006pt (the earlier fitted approximation managed 0.03pt).
  const recorded: Array<{ chord: number; apex: number }> = [
    { chord: 38.56, apex: 3.39 },
    { chord: 19.34, apex: 2.87 },
    { chord: 12.96, apex: 2.45 },
    { chord: 8.47, apex: 1.96 },
  ];
  const tokens = resolveJankoTokens(BRAHMS_OP118_NO1_JANKO_TOKENS);
  for (const { chord, apex } of recorded) {
    const depth = tieTracedDepth(chord, tokens);
    assert.ok(
      Math.abs(depth - apex) <= 0.006,
      `chord ${chord}pt: the height law reads ${depth.toFixed(4)}pt against the recorded apex ${apex}pt`
    );
  }
});

test('B. The laws hold across representative spans and saturate the way the record shows', () => {
  const tokens = resolveJankoTokens(BRAHMS_OP118_NO1_JANKO_TOKENS);
  // The reference laws, re-derived here inline from their published statement
  // (the normalized arctangent saturation and the rational indent) so the
  // expectation never calls the implementation under test.
  const hInf = tokens.tieRefHeightLimit;
  const r0 = tokens.tieRefRatio;
  const ss = tokens.tieRefStaffSpace;
  const m = tokens.tieRefIndentMaxFraction;
  const lawDepth = (wPt: number): number => {
    const wSp = wPt / ss;
    const hSp = hInf * ((2 / Math.PI) * Math.atan(((Math.PI / 2) * wSp * r0) / hInf));
    return 0.75 * hSp * ss + 0.5 * tokens.tieApexThickness;
  };
  const lawIndent = (wPt: number): number => {
    const wSp = wPt / ss;
    const q = (2 * hInf) / m;
    return (2 * hInf - (q * q * m) / (wSp + q)) * ss;
  };
  // Nine representative spans: below the smallest specimen, through the
  // corpus range, into the far-saturation regime.
  const spans = [4.98, 6, 12.96, 19.34, 25, 38.56, 50.96, 77.12, 100];
  for (const d of spans) {
    assert.ok(
      Math.abs(tieTracedDepth(d, tokens) - lawDepth(d)) <= 1e-12,
      `span ${d}pt: the implementation is the reference height law`
    );
    assert.ok(
      Math.abs(tieTracedIndent(d, tokens) - lawIndent(d)) <= 1e-12,
      `span ${d}pt: the implementation is the reference indent law`
    );
  }
  // Monotone in the span, bounded by the reference ceiling, asymptotic to it.
  const ceiling = 0.75 * hInf * ss + 0.5 * tokens.tieApexThickness;
  const sorted = [...spans].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) {
    assert.ok(
      tieTracedDepth(sorted[i]!, tokens) > tieTracedDepth(sorted[i - 1]!, tokens),
      `${sorted[i - 1]} → ${sorted[i]}: the crown grows with the span`
    );
    assert.ok(tieTracedDepth(sorted[i]!, tokens) < ceiling, `${sorted[i]}pt: never reaches the ceiling`);
  }
  assert.ok(
    Math.abs(tieTracedDepth(1e6, tokens) - ceiling) < 1e-3,
    'a span far beyond the corpus saturates at the reference ceiling'
  );
  // The record's own saturation observation: a two-bar tie is barely taller
  // than a one-bar tie.
  assert.ok(
    tieTracedDepth(77.12, tokens) - tieTracedDepth(38.56, tokens) < 0.5,
    'the two-bar crown adds under half a point over the one-bar crown'
  );
  // The indent law: the absolute indent stays under a third of the span at
  // every width (the law's own bound — no clamp needed), is zero at zero,
  // and its fraction of the span strictly decreases as the span grows.
  assert.equal(tieTracedIndent(0, tokens), 0, 'a zero span states zero indent');
  for (const d of spans) {
    const indent = tieTracedIndent(d, tokens);
    assert.ok(indent <= d / 3.1 + 1e-9, `${d}pt: the indent never reaches a third of the span`);
    assert.ok(indent > 0, `${d}pt: a real span states a real indent`);
  }
  for (let i = 1; i < sorted.length; i++) {
    const fPrev = tieTracedIndent(sorted[i - 1]!, tokens) / sorted[i - 1]!;
    const fNext = tieTracedIndent(sorted[i]!, tokens) / sorted[i]!;
    assert.ok(fPrev > fNext, `${sorted[i - 1]} → ${sorted[i]}: the indent fraction falls as the crown flattens`);
  }
  // And the whole painted surface follows the independently re-derived law:
  // every card-A arc's depth is the law's at its own span, except the one
  // documented rule-clearance clamp (bounded below by the shallow rescue).
  const run = cardRun('round49-above-080');
  const arcs = run.layouts.flatMap((l) => l.tieArcs ?? []);
  assert.equal(arcs.length, 35, 'the full written-tie surface states 35 arcs');
  let exact = 0;
  for (const arc of arcs) {
    const expected = lawDepth(Math.abs(arc.x2 - arc.x1));
    if (Math.abs(arc.depth - expected) <= 1e-9) {
      exact++;
      continue;
    }
    assert.ok(
      arc.depth <= expected + 1e-9 && arc.depth >= tokens.tieMinDepth - 1e-9,
      `${arc.noteId} c${arc.index}: the only departures are the documented rule-clearance clamps`
    );
  }
  assert.ok(exact >= 30, `${exact} of 35 arcs read the law exactly (the rest are the documented clamps)`);
});

// ---------------------------------------------------------------------------
// C. The whole-score lint pin for the live trio
// ---------------------------------------------------------------------------

test('C. Every Round 49 card lints clean on the whole Brahms score', () => {
  for (const id of ['round49-above-080', 'round49-air-100', 'round49-uniform-080']) {
    const run = cardRun(id);
    const report = lintJankoScore(BRAHMS, run.options, run.tokens);
    assert.equal(report.ok, true, `${id}: the surface is ok`);
    assert.deepEqual(report.violations, [], `${id}: zero violations`);
    assert.deepEqual(report.warnings, [], `${id}: zero warnings — no refused seat, nothing hidden`);
    // The published rest facts only, and the honest known findings stay
    // visible: the m. 66 withheld inference (conservative — no editorial
    // authority there, so the source's own LH part still sounds through the
    // gap), and five inferred rests including the truthful m. 70 LH quarter
    // the §4 editorial authority unblocked.
    const info = report.diagnostics.filter((d) => d.severity === 'info');
    assert.deepEqual(
      info.map((d) => d.code).sort(),
      [
        'rest-inference-withheld',
        'rest-inferred',
        'rest-inferred',
        'rest-inferred',
        'rest-inferred',
        'rest-inferred',
      ],
      `${id}: the diagnostics are exactly the published rest facts`
    );
    assert.deepEqual(
      info
        .filter((d) => d.code === 'rest-inference-withheld')
        .map((d) => d.measure)
        .sort((a, b) => (a ?? 0) - (b ?? 0)),
      [66],
      `${id}: the withheld finding remains the one documented measure`
    );
  }
});
