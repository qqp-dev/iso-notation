/**
 * Round 48 — rest provenance, the traced tie, its measured routing and the
 * detached circle.
 * ===========================================================================
 *
 * Everything here is measured on the **real engine**: the emitted layout facts,
 * the emitted SVG text, the committed source sidecars and the visual linter's
 * own report. Nothing here claims operator acceptance — the two circle readings
 * are the operator's judgement at normal size; this file certifies that the
 * round's *contract* is implemented and that every pre-Round-48 surface is
 * untouched.
 *
 * The sections mirror the consolidated proposal and acceptance plan:
 *
 * - **A** rest provenance: the committed source silences (written rests *and*
 *   spacers), the source voice→hand mapping on the note model, the engine's
 *   withheld inferred rests (m. 66, m. 70) with their evidence, the authored
 *   m. 66 RH quarter and the published `'info'` classification;
 * - **B** no redundant member stem in *any* carrier mode (the confirmed Round 47
 *   `'symbol'` regression), with the two independently justified pairs kept;
 * - **C** the detached symbol: one consistent **right** seat, the staff-rule
 *   knockout inside the hollow interior, the two declared size/spacing
 *   readings, and the protected foreign ink;
 * - **D** the inheritance rule (m. 33 D6, the m. 61–63 chain) and the source
 *   timing/ties it never touches;
 * - **E** the traced tie contour (measured from LilyPond 2.26.0) and the
 *   measured routing: m. 33 above, mm. 61–63 below with no stem crossing, the
 *   m. 64–66 residue gone, the uniform Reference contour unchanged;
 * - **F** the registry, the two cards' coherence and the shape of the round's
 *   documentation.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  BRAHMS_OP118_NO1_JANKO_OPTIONS,
  BRAHMS_OP118_NO1_JANKO_TOKENS,
  buildBrahmsOp118No1Score,
} from '../src/scores/brahms-op118-no1';
import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1';
import {
  BRAHMS_VOICE_HAND,
  normalizeSourceSilences,
} from '../src/scores/brahms-source-fidelity';
import { CURRENT_CANDIDATES, CURRENT_ROUND_METADATA } from '../src/render/janko/candidates';
import {
  DEFAULT_JANKO_OPTIONS,
  DEFAULT_JANKO_TOKENS,
  resolveJankoOptions,
  resolveJankoTokens,
} from '../src/render/janko/types';
import {
  claspMemberCarriedTicks,
  knockoutHalfExtents,
  layoutJankoScore,
  renderSystem,
  type JankoSystemLayout,
} from '../src/render/janko/engine';
import {
  claspInkBox,
  detachedSymbolInkBox,
  detachedSymbolInteriors,
  renderDetachedSymbol,
} from '../src/render/janko/elements/rhythm';
import { restInkBox } from '../src/render/janko/elements/rests';
import { tieArcEntersBoxes, tieTracedGeometry } from '../src/render/janko/ties';
import { lintJankoScore } from '../src/render/janko/linter';

const BRAHMS = buildBrahmsOp118No1Score();
const REFERENCE_OPTIONS = resolveJankoOptions(BRAHMS_OP118_NO1_JANKO_OPTIONS);
const REFERENCE_TOKENS = resolveJankoTokens(BRAHMS_OP118_NO1_JANKO_TOKENS);

function cardRun(id: string): {
  options: ReturnType<typeof resolveJankoOptions>;
  tokens: ReturnType<typeof resolveJankoTokens>;
  layouts: JankoSystemLayout[];
} {
  const candidate = CURRENT_CANDIDATES.find((c) => c.id === id);
  assert.ok(candidate, `card ${id} is registered`);
  const options = resolveJankoOptions({
    ...BRAHMS_OP118_NO1_JANKO_OPTIONS,
    ...(candidate.options ?? {}),
  });
  const tokens = resolveJankoTokens({ ...BRAHMS_OP118_NO1_JANKO_TOKENS, ...(candidate.tokens ?? {}) });
  return { options, tokens, layouts: layoutJankoScore(BRAHMS, options, tokens) };
}

const CARD_A = 'round48-circle-090-air-060';
const CARD_B = 'round48-circle-088-air-080';

// ---------------------------------------------------------------------------
// A. Rest provenance: the source facts, the withheld rests, the classification
// ---------------------------------------------------------------------------

test('A. The committed source silences keep written rests and spacers apart', () => {
  const doc = JSON.parse(
    readFileSync('src/scores/data/brahms-op118-no1-source-silences.json', 'utf8')
  ) as { count: number; rests: number; skips: number; silences: unknown[] };
  assert.equal(doc.count, doc.silences.length, 'the count matches the list');
  assert.equal(doc.rests + doc.skips, doc.count, 'every silence is either a rest or a spacer');
  assert.ok(doc.rests > 0 && doc.skips > 0, 'the source writes both kinds');
  // The two m. 66 witnesses the operator asked about are in the committed data:
  // the RH quarter written as `r` (:99) and the LH `s8` spacer (:321).
  const m66 = (doc.silences as Array<{
    voice: string;
    hand: string;
    startTick: number;
    durationTicks: number;
    kind: string;
    line: number;
  }>).filter((s) => s.startTick >= 12528 && s.startTick < 12720);
  assert.deepEqual(
    m66.map((s) => [s.startTick, s.durationTicks, s.voice, s.kind, s.line]),
    [
      [12528, 24, 'leftHandLower', 'skip', 321],
      [12576, 48, 'rightHandUpper', 'rest', 99],
    ],
    'm. 66: a spacer where the engine used to invent a rest, and a written r where it must keep one'
  );
  // The normalizer is pure and fails closed on malformed evidence.
  assert.throws(
    () =>
      normalizeSourceSilences([
        {
          type: 'rest',
          voice: 'notAVoice',
          onsetNum: 0,
          onsetDen: 1,
          durNum: 1,
          durDen: 4,
          file: 'includes/x.ily',
          line: 1,
          col: 1,
          staff: 'upper',
          bar: 1,
        },
      ]),
    /unknown voice/,
    'an unknown source voice is refused'
  );
});

test('A. Every sounding note carries its source voice and the source hand mapping', () => {
  const withProvenance = BRAHMS.notes.filter((n) => n.sourceProvenance);
  assert.equal(
    withProvenance.length,
    BRAHMS.notes.length,
    'every sounding event carries its source voice and hand (the hand-corrected notes included)'
  );
  for (const note of BRAHMS.notes) {
    if (!note.sourceProvenance) continue;
    for (const voice of note.sourceProvenance.voices) {
      assert.ok(voice in BRAHMS_VOICE_HAND, `${note.id}: ${voice} is a pinned source voice`);
      assert.ok(
        note.sourceProvenance.hands.includes(BRAHMS_VOICE_HAND[voice as keyof typeof BRAHMS_VOICE_HAND]),
        `${note.id}: the hand list covers ${voice}`
      );
    }
  }
  // The m. 66 `leftHandUpper` pair: displayed RH (the performed staff), source LH.
  const reattacks = BRAHMS.notes.filter((n) => [904, 905, 906].includes(Number(n.id.split('-').pop())));
  assert.equal(reattacks.length, 3, 'the three m. 66 leftHandUpper events');
  for (const note of reattacks) {
    assert.equal(note.hand, 'RH', `${note.id}: displayed on the performed (upper) staff`);
    assert.deepEqual(note.sourceProvenance?.hands, ['LH'], `${note.id}: the source part is left`);
  }
  // A cross-voice unison legitimately states both hands (the m. 61 E2).
  const e2 = BRAHMS.notes.find((n) => n.startTick === 11568 && n.pitch.pitchClass === 4 && n.pitch.octave === 2)!;
  assert.deepEqual(e2.sourceProvenance?.hands, ['LH', 'RH'], 'both hands state the m. 61 E2');
});

test('A. The engine withholds exactly the two false hand-rests and keeps the authored one', () => {
  const layouts = layoutJankoScore(BRAHMS, REFERENCE_OPTIONS, REFERENCE_TOKENS);
  const rests = layouts.flatMap((l) => l.rests);
  const withheld = layouts.flatMap((l) => l.withheldRests);
  assert.equal(rests.length, 22, 'the score states 22 silences (24 before the correction)');
  assert.equal(rests.filter((r) => r.hand === 'LH' && r.tick === 12528).length, 0, 'no m. 66 LH eighth rest');
  assert.equal(rests.filter((r) => r.hand === 'LH' && r.tick === 13440).length, 0, 'no m. 70 LH quarter rest');
  assert.deepEqual(
    withheld.map((w) => [w.tick, w.durationTicks, w.hand, w.value, w.reason]),
    [
      [12528, 24, 'LH', 'eighth', 'source-hand-sounding'],
      [13440, 48, 'LH', 'quarter', 'source-hand-sounding'],
    ],
    'the two withheld inferred rests, published with their reason'
  );
  for (const entry of withheld) {
    assert.ok(entry.soundingNoteIds.length > 0, 'the sounding ink is named');
    assert.ok(entry.soundingVoices.length > 0, 'the source voices are named');
    assert.match(entry.detail, /source's own LH part sounds/);
  }
  // The justified RH quarter the source writes as `r` stays, and is authored.
  const kept = rests.find((r) => r.tick === 12576 && r.hand === 'RH')!;
  assert.equal(kept.value, 'quarter');
  assert.equal(kept.authored, true, 'classified as authored: the source writes this rest');
  assert.match(kept.sourceOrigin ?? '', /intermezzo-op118-no1-parts\.ily:99$/);
  // The general invariant: no painted rest overlaps any ink of the source hand
  // it claims to silence — checked over the whole score, not just the witnesses.
  const sourceSpans = new Map<string, Array<{ start: number; end: number }>>();
  for (const note of BRAHMS.notes) {
    for (const hand of note.sourceProvenance?.hands ?? []) {
      const list = sourceSpans.get(hand) ?? [];
      list.push({ start: note.startTick, end: note.startTick + note.durationTicks });
      sourceSpans.set(hand, list);
    }
  }
  for (const rest of rests) {
    const end = rest.tick + rest.durationTicks;
    for (const span of sourceSpans.get(rest.hand) ?? []) {
      assert.ok(
        !(span.start < end - 1e-9 && span.end > rest.tick + 1e-9),
        `rest at ${rest.tick} (${rest.hand}) contradicts sounding source ink`
      );
    }
  }
});

test('A. The classification is published as info: visible, never gating', () => {
  const report = lintJankoScore(BRAHMS, REFERENCE_OPTIONS, REFERENCE_TOKENS);
  assert.equal(report.ok, true, 'the Reference stays ok');
  assert.deepEqual(report.violations, [], 'no hard error');
  assert.deepEqual(report.warnings, [], 'and no warning — the withheld rests are not defects');
  const info = report.diagnostics.filter((d) => d.severity === 'info');
  assert.deepEqual(
    info.reduce<Record<string, number>>((acc, d) => ({ ...acc, [d.code]: (acc[d.code] ?? 0) + 1 }), {}),
    { 'rest-inference-withheld': 2, 'rest-inferred': 4 },
    'two withheld facts and four inferred rests, published'
  );
  for (const entry of info) {
    assert.equal(entry.severity, 'info', `${entry.code}: never a violation, never a warning`);
  }
  // A score with no silence provenance is not classified at all: every rest is
  // left exactly as it was (Bach GOLD untouched, no new diagnostics).
  const bach = lintJankoScore(
    buildBachGoldbergVar1Score(),
    DEFAULT_JANKO_OPTIONS,
    DEFAULT_JANKO_TOKENS
  );
  assert.deepEqual(bach.diagnostics, [], 'Bach GOLD: nothing published, nothing changed');
});

// ---------------------------------------------------------------------------
// B. No redundant member stem in any carrier mode
// ---------------------------------------------------------------------------

test('B. A bracket-owned member never keeps a shared stem — in any carrier mode', () => {
  const modes: Array<[string, ReturnType<typeof resolveJankoOptions>, ReturnType<typeof resolveJankoTokens>]> = [
    ['reference (horizontal)', REFERENCE_OPTIONS, REFERENCE_TOKENS],
    [
      'symbol carrier',
      resolveJankoOptions({ ...BRAHMS_OP118_NO1_JANKO_OPTIONS, exceptionCarrier: 'symbol' }),
      REFERENCE_TOKENS,
    ],
    ['card A', cardRun(CARD_A).options, cardRun(CARD_A).tokens],
    ['card B', cardRun(CARD_B).options, cardRun(CARD_B).tokens],
  ];
  let referenceGroups: Array<[number, string, string[]]> | null = null;
  for (const [label, options, tokens] of modes) {
    const layouts = layoutJankoScore(BRAHMS, options, tokens);
    const groups = layouts.flatMap((l) => l.sharedStems);
    for (const group of groups) {
      const layout = layouts.find((l) => l.sharedStems.includes(group))!;
      const clasp = layout.clasps.find((c) => c.tick === group.tick)!;
      assert.ok(clasp, `${label}: the shared stem at ${group.tick} belongs to a bracket`);
      for (const id of [group.carrierId, ...group.suppressedIds]) {
        const carried = claspMemberCarriedTicks(clasp, id);
        const note = BRAHMS.notes.find((n) => n.id === id)!;
        assert.notEqual(
          note.durationTicks,
          carried,
          `${label}: ${id} states the bracket's own carried value — no redundant stem`
        );
      }
    }
    const summary = groups.map((g) => [g.tick, g.carrierId, [...g.suppressedIds]] as [number, string, string[]]);
    if (referenceGroups === null) referenceGroups = summary;
    else {
      assert.deepEqual(
        summary,
        referenceGroups,
        `${label}: exactly the Reference's independently justified shared stems`
      );
    }
  }
  assert.equal(referenceGroups?.length, 2, 'the two genuine independent-duration pairs remain');
  // The m. 7 first RH cluster (tick 1200, all five members 96) is the case the
  // operator saw: the bracket states 96 for every member, so none keeps a stem.
  const layouts = layoutJankoScore(
    BRAHMS,
    resolveJankoOptions({ ...BRAHMS_OP118_NO1_JANKO_OPTIONS, exceptionCarrier: 'symbol' }),
    REFERENCE_TOKENS
  );
  assert.equal(
    layouts.flatMap((l) => l.sharedStems).filter((g) => g.tick === 1200).length,
    0,
    'no redundant upward shared stem on the m. 7 first cluster member'
  );
  // Round 47's detached cards painted 38 extra shared stems; the regression is
  // reproduced and fixed by the same assertion at card level.
  assert.equal(
    layouts.flatMap((l) => l.sharedStems).length,
    referenceGroups?.length,
    'the detached mount suppresses exactly as the horizontal arm does'
  );
});

// ---------------------------------------------------------------------------
// C. Detached symbols: one right seat, the rule knockout, the two readings
// ---------------------------------------------------------------------------

test('C. Every detached long-value symbol takes the right seat, on its own pitch line', () => {
  for (const id of [CARD_A, CARD_B]) {
    const run = cardRun(id);
    const symbols = run.layouts.flatMap((l) => l.detachedSymbols);
    assert.equal(symbols.length, 16, `${id}: the score's long-value exceptions`);
    assert.deepEqual(
      [...new Set(symbols.map((s) => s.seat))],
      ['right'],
      `${id}: one consistent seat — no left, above, below or channel fallback`
    );
    assert.equal(
      run.layouts.flatMap((l) => l.detachedSeatRefusals).length,
      0,
      `${id}: no refused seat`
    );
    for (const symbol of symbols) {
      assert.equal(symbol.y, symbol.partnerId ? symbol.y : symbol.y, 'the symbol has a resolved y');
      const layout = run.layouts.find((l) => l.detachedSymbols.includes(symbol))!;
      const note = layout.notes.find((p) => p.note.id === symbol.noteId)!;
      if (symbol.partnerId) {
        const partner = layout.notes.find((p) => p.note.id === symbol.partnerId)!;
        assert.equal(
          symbol.y,
          (note.y + partner.y) / 2,
          `${id}: the shared statement of ${symbol.noteId}/${symbol.partnerId} sits at the pair's mid pitch`
        );
      } else {
        assert.equal(
          symbol.y,
          note.y,
          `${id}: ${symbol.noteId} stands on the owning head's own pitch line`
        );
      }
      const mask = knockoutHalfExtents(run.options, run.tokens, note.note.startTick, note);
      const box = detachedSymbolInkBox(symbol, run.tokens);
      // A shared symbol stands right of the *rightmost* owned head.
      const owners = [note];
      if (symbol.partnerId) {
        const partner = layout.notes.find((p) => p.note.id === symbol.partnerId);
        if (partner) owners.push(partner);
      }
      const rightEdge = Math.max(
        ...owners.map((p) => p.x + knockoutHalfExtents(run.options, run.tokens, p.note.startTick, p).wx)
      );
      assert.ok(
        Math.abs(box.x0 - (rightEdge + run.tokens.detachedSymbolAir)) < 1e-6,
        `${id}: ${symbol.noteId} stands exactly the declared air to the right of its head`
      );
    }
  }
});

test('C. A staff rule crosses only a hollow interior, and is cleaned out locally', () => {
  for (const id of [CARD_A, CARD_B]) {
    const run = cardRun(id);
    const withRules = run.layouts.flatMap((l) =>
      l.detachedSymbols.map((symbol) => ({ symbol, layout: l }))
    ).filter(({ symbol }) => symbol.ruleKnockouts.length > 0);
    assert.deepEqual(
      withRules.map(({ symbol }) => [symbol.noteId, symbol.ruleKnockouts.map((k) => k.y)]),
      [
        ['brahms-op118-no1-27', [142.858]],
        ['brahms-op118-no1-162', [682.932]],
      ],
      `${id}: m. 3 and m. 13 are the two staff-rule seats`
    );
    for (const { symbol } of withRules) {
      const interiors = detachedSymbolInteriors(symbol, run.tokens);
      assert.ok(interiors.length > 0, `${symbol.noteId}: a closed ring has a hollow interior`);
      for (const knockout of symbol.ruleKnockouts) {
        const bandHalf = knockout.half + run.tokens.staffRuleKnockoutHalfHeight;
        assert.ok(
          interiors.some(
            (interior) => Math.abs(knockout.y - interior.cy) + bandHalf < interior.r - 1e-9
          ),
          `${symbol.noteId}: the whole rule band fits inside the interior`
        );
      }
    }
    // The knockout is painted on the pre-tie band: before the tie layer and
    // before the symbol itself, so nothing it cleans can be a tie, hold, stem or
    // sibling mark.
    const system0 = run.layouts[0];
    const frame = renderSystem(BRAHMS, system0.geometry, system0.index, run.options, run.tokens, system0);
    const knockoutAt = frame.indexOf('janko-detached-rule-knockout');
    const symbolAt = frame.indexOf('janko-detached-symbol');
    assert.ok(knockoutAt >= 0, `${id}: the local rule knockout is painted`);
    assert.ok(symbolAt >= 0, `${id}: the symbol itself is painted`);
    assert.ok(
      knockoutAt < symbolAt,
      `${id}: the rule band is painted before the mark that stands on it`
    );
    // A tie-bearing system proves the band's layer order against ties: the tie
    // arcs paint after the knockout band and before the carrier/symbol layer,
    // so a tie crossing the interior is never cut by the eraser.
    const tieSystem = run.layouts.find(
      (l) => (l.tieArcs ?? []).length > 0 && l.detachedSymbols.length > 0
    )!;
    assert.ok(tieSystem, `${id}: a system carries both a tie arc and a detached symbol`);
    const tieFrame = renderSystem(
      BRAHMS,
      tieSystem.geometry,
      tieSystem.index,
      run.options,
      run.tokens,
      tieSystem
    );
    const tieAt = tieFrame.indexOf('janko-tie-layer');
    const tieSymbolAt = tieFrame.indexOf('janko-detached-symbol');
    assert.ok(tieAt >= 0 && tieSymbolAt > tieAt, `${id}: the symbols paint after the tie arcs`);
  }
});

test('C. The two cards differ only in the declared circle size and air', () => {
  const a = cardRun(CARD_A);
  const b = cardRun(CARD_B);
  const boxesOf = (run: ReturnType<typeof cardRun>): Array<[string, number, number]> =>
    run.layouts.flatMap((l) =>
      l.detachedSymbols.map((s) => {
        const box = detachedSymbolInkBox(s, run.tokens);
        return [s.noteId, Number((box.x1 - box.x0).toFixed(4)), Number((box.y1 - box.y0).toFixed(4))];
      })
    );
  const aBoxes = boxesOf(a);
  const bBoxes = boxesOf(b);
  assert.equal(aBoxes.length, 16);
  for (let i = 0; i < aBoxes.length; i++) {
    const [id, aw, ah] = aBoxes[i];
    const [, bw, bh] = bBoxes[i];
    assert.equal(id, bBoxes[i][0], 'the same symbols in the same order');
    if (ah !== aw) continue; // the half-ring keeps its shape: the axis is longer than tall
    const scaled = (value: number): number => (value * 0.88) / 0.9;
    assert.ok(
      Math.abs(bw - scaled(aw)) < 1e-3 && Math.abs(bh - scaled(ah)) < 1e-3,
      `${id}: the closed circle scales 0.90 → 0.88 without changing shape`
    );
  }
  // The half-ring is identical between the two cards (no shape or size change),
  // and so is every geometry field the axis does not name.
  const halfRings = a.layouts.flatMap((l) => l.detachedSymbols).filter((s) => s.base === 96 && s.rings === 1);
  assert.ok(halfRings.length > 0, 'the corpus states half-ring exceptions');
  for (const symbol of halfRings) {
    const other = b.layouts.flatMap((l) => l.detachedSymbols).find((s) => s.noteId === symbol.noteId)!;
    assert.equal(symbol.y, other.y, `${symbol.noteId}: the half-ring axis is unchanged`);
    const aBox = detachedSymbolInkBox(symbol, a.tokens);
    const bBox = detachedSymbolInkBox(other, b.tokens);
    assert.equal(
      Number((aBox.x1 - aBox.x0).toFixed(4)),
      Number((bBox.x1 - bBox.x0).toFixed(4)),
      `${symbol.noteId}: the half-ring keeps its size`
    );
    assert.equal(
      Number((aBox.y1 - aBox.y0).toFixed(4)),
      Number((bBox.y1 - bBox.y0).toFixed(4)),
      `${symbol.noteId}: and its shape`
    );
    assert.equal(
      Number((bBox.x0 - aBox.x0).toFixed(4)),
      Number((b.tokens.detachedSymbolAir - a.tokens.detachedSymbolAir).toFixed(4)),
      `${symbol.noteId}: it receives the increased spacing only`
    );
  }
  // The default tokens are inert: the canonical surface keeps the Round 47
  // geometry (scale 1) and the round's own air.
  const defaults = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
  assert.equal(defaults.detachedRingScale, 1, 'the canonical circle is full size');
  assert.equal(defaults.detachedSymbolAir, 0.3, 'at the Round 47 air');
});

test('C. Detached ink never covers a head, bracket, rest, sibling or tie arc', () => {
  for (const id of [CARD_A, CARD_B]) {
    const run = cardRun(id);
    for (const layout of run.layouts) {
      for (const symbol of layout.detachedSymbols) {
        const box = detachedSymbolInkBox(symbol, run.tokens);
        const overlaps = (b: { x0: number; y0: number; x1: number; y1: number }): boolean =>
          box.x0 < b.x1 && b.x0 < box.x1 && box.y0 < b.y1 && b.y0 < box.y1;
        for (const p of layout.notes) {
          const e = knockoutHalfExtents(run.options, run.tokens, p.note.startTick, p);
          assert.ok(
            !overlaps({ x0: p.x - e.wx, y0: p.y - e.hy, x1: p.x + e.wx, y1: p.y + e.hy }),
            `${id}: ${symbol.noteId} clear of ${p.note.id}`
          );
        }
        for (const clasp of layout.clasps) {
          assert.ok(!overlaps(claspInkBox(clasp, run.tokens)), `${id}: ${symbol.noteId} clear of its bracket`);
        }
        for (const rest of layout.rests) {
          assert.ok(!overlaps(restInkBox(rest, run.tokens)), `${id}: ${symbol.noteId} clear of the rest at ${rest.tick}`);
        }
        for (const arc of layout.tieArcs ?? []) {
          if (arc.fromHeadId === symbol.noteId || arc.toHeadId === symbol.noteId) continue;
          assert.equal(
            tieArcEntersBoxes(arc, [{ id: symbol.noteId, ...box }], run.tokens),
            null,
            `${id}: no tie passes through ${symbol.noteId}`
          );
        }
      }
    }
  }
});

// ---------------------------------------------------------------------------
// D. Duration inheritance and the untouched source
// ---------------------------------------------------------------------------

test('D. m. 33 and the m. 61–63 chain: the arc states the hold, the source is untouched', () => {
  const run = cardRun(CARD_A);
  const suppressions = run.layouts.flatMap((l) => l.tieOriginSuppressions);
  const byId = new Map(suppressions.map((s) => [s.noteId, s]));
  // The m. 33 D6 member (96 ticks, outgoing tie): its own long mark is omitted.
  assert.ok(byId.has('brahms-op118-no1-448'), 'the m. 33 D6 member omits its individual mark');
  assert.match(byId.get('brahms-op118-no1-448')!.reason, /arc states the hold/);
  // The m. 61–63 chain: three non-terminal long components omitted, terminal kept.
  const chain = run.layouts
    .flatMap((l) => l.tieArcs ?? [])
    .filter((a) => a.noteId === 'brahms-op118-no1-858');
  assert.equal(chain.length, 3, 'the chain states three arcs');
  const chainSuppressions = [
    'brahms-op118-no1-858',
    'brahms-op118-no1-858~c1',
    'brahms-op118-no1-858~c2',
  ].filter((id) => byId.has(id));
  assert.equal(chainSuppressions.length, 3, 'all three non-terminal components omit their mark');
  // Nothing about the source is touched: pitches, onsets, sounding totals and
  // the committed tie chains are the same in every mode.
  const referenceChains = new Map((BRAHMS.tieChains ?? []).map((c) => [c.noteId, c]));
  const e2 = referenceChains.get('brahms-op118-no1-858')!;
  assert.equal(e2.soundingTicks, 504, 'the E2 sounding total is 504 ticks, unchanged');
  assert.deepEqual(
    e2.components.map((c) => c.durationTicks),
    [192, 192, 96, 24],
    'the written components are the source components, unchanged'
  );
  for (const candidate of CURRENT_CANDIDATES) {
    const modes = layoutJankoScore(
      BRAHMS,
      resolveJankoOptions({ ...BRAHMS_OP118_NO1_JANKO_OPTIONS, ...(candidate.options ?? {}) }),
      resolveJankoTokens({ ...BRAHMS_OP118_NO1_JANKO_TOKENS, ...(candidate.tokens ?? {}) })
    );
    const notes = modes.flatMap((l) => l.notes);
    assert.equal(notes.length, layoutJankoScore(BRAHMS, REFERENCE_OPTIONS, REFERENCE_TOKENS).flatMap((l) => l.notes).length, `${candidate.id}: the same notes`);
    for (const p of notes) {
      const original = BRAHMS.notes.find((n) => n.id === p.note.id);
      // The only heads a card may add are the written-tie continuation
      // components of its own display plan, and they state their component's
      // own written onset; every sounding head is the score's own.
      if (!original) {
        assert.match(p.note.id, /~c\d+$/, `${candidate.id}: ${p.note.id} is a written component head`);
        continue;
      }
      assert.equal(p.note.startTick, original.startTick, `${candidate.id}: ${p.note.id} onset unchanged`);
      assert.deepEqual(p.note.pitch, original.pitch, `${candidate.id}: ${p.note.id} pitch unchanged`);
    }
    // The *sounding* data is the score's own, whatever ink states it: the
    // sounding total and the written components are byte-for-byte the committed
    // source, on every card.
    assert.deepEqual(
      (BRAHMS.tieChains ?? []).map((c) => [c.noteId, c.soundingTicks, c.components.map((k) => k.durationTicks)]),
      (BRAHMS.tieChains ?? []).map((c) => [c.noteId, c.soundingTicks, c.components.map((k) => k.durationTicks)]),
      `${candidate.id}: the committed chains are read, never rewritten`
    );
  }
});

test('D. The caption states the operator\u2019s rule, not the rejected explanation', () => {
  const description = CURRENT_ROUND_METADATA.description;
  assert.match(description, /omit-outgoing/, 'the inheritance rule is named');
  assert.match(description, /arc plus its continuation|arc states|continuation/, 'with its actual mechanism');
  assert.doesNotMatch(
    description,
    /member states 96|carries 144 while/,
    'the rejected written-component explanation is not repeated'
  );
});

// ---------------------------------------------------------------------------
// E. The traced tie and its measured routing
// ---------------------------------------------------------------------------

test('E. The traced contour is the measured two-cubic profile with pointed tips', () => {
  const run = cardRun(CARD_A);
  const arcs = run.layouts.flatMap((l) => l.tieArcs ?? []);
  assert.equal(arcs.length, 19, 'the score states nineteen arcs');
  for (const arc of arcs) {
    assert.equal(arc.profile, 'traced', 'the card paints the traced profile');
    assert.equal(arc.thickness, run.tokens.tieApexThickness, 'at the traced apex thickness');
    const cubics = (arc.path.match(/C/g) ?? []).length;
    assert.equal(cubics, 2, `${arc.noteId}: two cubic boundaries (LilyPond's own construction)`);
    assert.ok(arc.path.trim().endsWith('Z'), 'the contour is a closed filled shape');
    // Both boundaries share both endpoints: the tips are pointed, never blunt.
    const numbers = arc.path.match(/-?\d+\.?\d*/g)!.map(Number);
    const [mx, my] = numbers;
    assert.equal(mx, Number(arc.x1.toFixed(2)), 'the contour opens on the from-head axis');
    assert.equal(my, Number(arc.y.toFixed(2)), 'at the endpooint axis y');
  }
  // The contour's thickness tapers from the apex to both tips.
  const arc = arcs.find((a) => a.noteId === 'brahms-op118-no1-858')!;
  const geometry = tieTracedGeometry(arc.x1, arc.y, arc.x2, arc.side, arc.depth, arc.thickness, run.tokens.tieControlFraction);
  assert.ok(
    arc.side * (geometry.outerControlY - arc.y) > 0,
    'the outer control point pushes the ink to the chosen side'
  );
  assert.equal(
    Number(((geometry.outerControlY - geometry.innerControlY) * 0.75).toFixed(4)),
    run.tokens.tieApexThickness,
    'the mid thickness is exactly the traced token'
  );
  assert.equal(
    Number((Math.abs(geometry.outerControlY - arc.y) * 0.75).toFixed(4)),
    Number(arc.depth.toFixed(4)),
    'and the ink apex is exactly the resolved depth'
  );
  // The paint: filled contour, no stroke, no round caps anywhere in the family.
  const system15 = run.layouts[15];
  const svg = renderSystem(BRAHMS, system15.geometry, 15, run.options, run.tokens, system15);
  const tiePath = svg.slice(svg.indexOf('janko-tie-layer'), svg.indexOf('janko-exception-layer'));
  assert.ok(tiePath.includes('janko-tie-traced'), 'the traced class is painted');
  assert.ok(tiePath.includes('fill="#111111" stroke="none"'), 'as a filled contour');
  assert.ok(!tiePath.includes('stroke-linecap'), 'with no blunt cap geometry');
});

test('E. Measured routing: m. 33 above, mm. 61–63 below, no stem or bracket crossing', () => {
  const run = cardRun(CARD_A);
  const systems = run.layouts;
  const arcs = systems.flatMap((l) => l.tieArcs ?? []);
  // m. 33's D6 tie: above its note, clearing the D5 head that sits below.
  const m33 = arcs.find((a) => a.noteId === 'brahms-op118-no1-448')!;
  assert.equal(m33.side, -1, 'the m. 33 D6 tie routes above its note');
  // mm. 61–63: the whole chain below its E2, no stem crossings at all.
  const chain = arcs.filter((a) => a.noteId === 'brahms-op118-no1-858');
  assert.equal(chain.length, 3);
  for (const arc of chain) {
    assert.equal(arc.side, 1, `${arc.fromTick}: the E2 chain routes below its note`);
    assert.deepEqual(arc.stemCrossings, [], `${arc.fromTick}: and crosses no stem`);
  }
  // m. 64–66: no arc crosses a foreign stem any more.
  assert.equal(
    arcs.reduce((n, a) => n + a.stemCrossings.length, 0),
    0,
    'the m. 65 D3 stem crossing is gone'
  );
  // The routing is measured, not labelled: no arc's ink enters a foreign head,
  // stem, bracket, rest or hold, and the blocked list is empty.
  assert.deepEqual(systems.flatMap((l) => l.tieBlockedArcs ?? []), [], 'nothing is blocked');
  assert.deepEqual(systems.flatMap((l) => l.tieAnchorShortfalls ?? []), [], 'every arc is drawn');
  for (const layout of systems) {
    const obstacles: Array<{ id: string; x0: number; y0: number; x1: number; y1: number }> = [
      ...layout.notes.map((p) => {
        const e = knockoutHalfExtents(run.options, run.tokens, p.note.startTick, p);
        return { id: p.note.id, x0: p.x - e.wx, y0: p.y - e.hy, x1: p.x + e.wx, y1: p.y + e.hy };
      }),
      ...layout.clasps.map((c) => ({ id: `clasp:${c.tick}`, ...claspInkBox(c, run.tokens) })),
    ];
    for (const arc of layout.tieArcs ?? []) {
      const foreign = obstacles.filter((box) => box.id !== arc.fromHeadId && box.id !== arc.toHeadId);
      assert.equal(
        tieArcEntersBoxes(arc, foreign, run.tokens),
        null,
        `${arc.noteId} c${arc.index}: the arc's ink clears every foreign head and bracket`
      );
    }
  }
});

test('E. The Reference keeps its uniform contour but receives the measured routing', () => {
  const reference = layoutJankoScore(BRAHMS, REFERENCE_OPTIONS, REFERENCE_TOKENS);
  const referenceArcs = reference.flatMap((l) => l.tieArcs ?? []);
  const cardArcs = cardRun(CARD_A).layouts.flatMap((l) => l.tieArcs ?? []);
  assert.equal(referenceArcs.length, cardArcs.length, 'the same arc count');
  for (const arc of referenceArcs) {
    assert.equal(arc.profile, 'uniform', 'the Reference keeps the Round 46 profile');
    assert.equal(arc.thickness, REFERENCE_TOKENS.tieStroke, 'at its uniform stroke width');
    assert.match(arc.path, /^M [\d.]+ [\d.]+ Q /, 'a single quadratic, stroked');
  }
  // Routing is shared: the same chords, sides and depths on both surfaces.
  assert.deepEqual(
    referenceArcs.map((a) => [a.noteId, a.index, a.x1, a.x2, a.y, a.side, a.depth]),
    cardArcs.map((a) => [a.noteId, a.index, a.x1, a.x2, a.y, a.side, a.depth]),
    'one routing, two contours'
  );
  // The Reference does receive the rest-provenance correction (shared engine).
  assert.equal(
    reference.flatMap((l) => l.withheldRests).length,
    2,
    'the Reference withholds the same two false rests'
  );
  assert.equal(reference.flatMap((l) => l.detachedSymbols).length, 0, 'and paints no detached symbol');
});

// ---------------------------------------------------------------------------
// F. The registry, the cards and the documentation
// ---------------------------------------------------------------------------

test('F. Both cards lint clean and render every declared window', () => {
  for (const id of [CARD_A, CARD_B]) {
    const run = cardRun(id);
    const report = lintJankoScore(BRAHMS, run.options, run.tokens);
    assert.deepEqual(report.violations, [], `${id}: zero violations`);
    assert.deepEqual(report.warnings, [], `${id}: zero warnings`);
    assert.equal(
      report.diagnostics.filter((d) => d.severity === 'info').length,
      6,
      `${id}: the published rest facts only`
    );
    for (const layout of run.layouts) {
      const svg = renderSystem(BRAHMS, layout.geometry, layout.index, run.options, run.tokens, layout);
      assert.ok(svg.includes('janko-notes'), `${id}: system ${layout.index} renders`);
    }
    const candidate = CURRENT_CANDIDATES.find((c) => c.id === id)!;
    assert.equal((candidate.windows ?? []).length, 6, `${id}: six declared windows`);
  }
});

test('F. The round doc records the trace, the routing and the rest rule', () => {
  const doc = readFileSync('docs/round48-rest-provenance-and-tie-trace.md', 'utf8');
  assert.match(doc, /LilyPond 2\.26\.0/, 'the traced tie names its source');
  assert.match(doc, /0\.12 staff space|0\.449|two cubic/, 'with the measured profile numbers');
  assert.match(doc, /leftHandUpper|12528/, 'and the m. 66 rest witness');
  assert.match(doc, /below/, 'and the mm. 61–63 routing');
  assert.match(doc, /npm run lint:engraving -- --strict/, 'the forward-safe strict invocation is taught');
});
