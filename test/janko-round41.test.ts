import test from 'node:test';
import assert from 'node:assert/strict';

import {
  HOLD_ENDPOINT_SPECIMEN_STUDIO_SCORE_ID,
  brahmsWindow,
  candidateBadges,
  isAbstractCandidateWindow,
  resolveCandidate,
  type JankoCandidate,
  type JankoCandidateRound,
  type JankoCandidateWindow,
} from '../src/render/janko/candidates.js';
import {
  DEFAULT_JANKO_OPTIONS,
  DEFAULT_JANKO_TOKENS,
  JANKO_DURATION_ENDPOINTS,
  resolveJankoOptions,
  resolveJankoTokens,
} from '../src/render/janko/types.js';
import {
  claspMemberCarriedTicks,
  holdClearanceInk,
  knockoutHalfExtents,
  layoutJankoScore,
  renderJankoCrop,
  type JankoSystemLayout,
} from '../src/render/janko/engine.js';
import {
  JANKO_LINT_CHECKS,
  checkHoldIntegrity,
  lintJankoScore,
  type LintViolation,
} from '../src/render/janko/linter.js';
import {
  holdTerminalHalfHeight,
  holdTerminalReach,
  type JankoHoldGeometry,
} from '../src/render/janko/elements/holds.js';
import { digitHalfExtents, getKnockoutMetrics } from '../src/render/janko/elements/notehead.js';
import {
  BRAHMS_OP118_NO1_JANKO_OPTIONS,
  BRAHMS_OP118_NO1_JANKO_TOKENS,
  buildBrahmsOp118No1Score,
} from '../src/scores/brahms-op118-no1.js';
import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1.js';
import { wholeToneParity } from '../src/model/pitch.js';
import {
  HOLD_ENDPOINT_SPECIMEN_CASES,
  HOLD_ENDPOINT_SPECIMEN_JANKO_OPTIONS,
  HOLD_ENDPOINT_SPECIMEN_JANKO_TOKENS,
  buildHoldEndpointSpecimenScore,
} from '../src/scores/hold-endpoint-specimen.js';
import { createStudioConfig } from '../src/render/janko/studio.js';

const BRAHMS = buildBrahmsOp118No1Score();
const SPECIMEN = buildHoldEndpointSpecimenScore();
const BACH = buildBachGoldbergVar1Score();

// ---------------------------------------------------------------------------
// Historical Round 41 registry (parked)
//
// Round 42 opens the duration-vocabulary comparison; the Round 41 cards below
// are frozen verbatim so this round's proofs keep judging the release-endpoint
// treatment they were written for, independent of the live registry.
// ---------------------------------------------------------------------------
/** Historical Round 41 metadata (parked). */

export const ROUND_41_METADATA: JankoCandidateRound = {
  round: 41,
  title: 'Exceptional-duration release endpoints — Round 41',
  description:
    'Exception members of a shared-duration bracket (a member whose own duration differs from the group’s carried value) give up their own duration ink for one thin 0.40pt hold-to-release connector that starts flush at the protected symbol edge, runs at the member’s true pitch y, replaces the local staff rule with a 0.90pt white band where it coincides with one, and ends at the exact resolved release time in one of three terminals: a 2.40pt stop bar (0.55pt stroke), a 1.60pt filled diamond, or a 2.20pt open ring (0.40pt stroke). Chord members are set at 75 % absolute-pitch-symbol size, standalone symbols stay canonical, and both spreads of the Reference view remain untouched.',
  openAxes: ['durationEndpoint'],
};

/**
 * Round 41: the four windows every candidate is engraved on — the three
 * authentic Brahms stress specimens the round names, plus the synthetic
 * fixture for the situations the corpus never states. All three cards share
 * them, so the only visible difference between cards is the terminal shape.
 */
function round41Windows(): JankoCandidateWindow[] {
  return [
    brahmsWindow(
      8,
      1,
      'Brahms Op. 118 No. 1 · m. 8 — early exception beside a full-size symbol',
      'B3 states 48 ticks against its group’s carried 96: the 0.40pt connector starts flush at the protected symbol edge and the terminal seats 3.00pt back from the C4 that occupies the release instant (measured, published, never a silent clip).'
    ),
    brahmsWindow(
      9,
      2,
      'Brahms Op. 118 No. 1 · mm. 9–10 — two late exceptions, boundary release, same-pitch reattack',
      'Two 192-tick exceptions against a carried 144 release on m. 9→10’s tick 1776 — the resolved column of m. 10’s downbeat, which the connector reaches across the barline (crossing reported): G4 lands exactly on the anchor beside its same-pitch reattack; F4 seats 2.03pt clear of the E4 sharing that column.'
    ),
    brahmsWindow(
      22,
      2,
      'Brahms Op. 118 No. 1 · mm. 22–23 — late exception over the coincident octave-line rule',
      'C6 states 120 ticks against a carried 96 on its true pitch row — which is the C6 octave-line rule itself: the 0.90pt white band replaces that rule segment locally (nothing else is erased) and the terminal lands exactly on the release anchor at tick 4200, where no attack exists.'
    ),
    {
      scoreId: HOLD_ENDPOINT_SPECIMEN_STUDIO_SCORE_ID,
      measureStart: 1,
      measureCount: 4,
      title: 'Hold Endpoint Specimen · mm. 1–4 — three-duration chord, off-beat release, line-crossing continuation',
      caption:
        'Six exceptions on clean material, two measures per system: one chord carries 48/96/120 (carried 48) so C5 and B5 are exceptions of different values, C5 on the octave-line rule and B5 releasing at tick 168 where no onset exists; the C6 exception releases at tick 408, past this system’s last tick (384), so its ink reaches the line edge and paints no terminal — a line break is not a release; the C5 exception releases at 144 beside its same-pitch reattack, and the closing exception releases on the final barline at 768, seated 1.08pt clear of it. Geometry is shared across cards; only the terminal shape differs.',
    },
  ];
}

/** Shared option delta of the three Round 41 cards (terminal shape aside). */
const ROUND_41_SHARED_OPTIONS = {
  pitchPlacement: 'parity-columns',
  chordSymbolScale: 0.75,
} as const;

/**
 * Shared token delta of the three Round 41 cards: the tightened chord masks
 * (0.10pt margin, 0.20pt air) measured against the actual 75 % glyph bounds.
 * Every other token — the connector (0.40pt), the white underlay (0.90pt tall),
 * the terminal air (0.20pt) and the three terminal dimensions — is the
 * project-wide token default, so the cards share them by construction.
 */
const ROUND_41_SHARED_TOKENS = { chordKnockoutMargin: 0.10, chordKnockoutAir: 0.20 } as const;

/**
 * Round 41: exceptional-duration hold lines and explicit release endpoints.
 *
 * Exactly three active score cards, identical in every option and token except
 * the terminal shape (`durationEndpoint`, the round's only open axis):
 *
 * 1. **stop bar** — vertical 2.40pt bar, 0.55pt stroke, centred on the release;
 * 2. **diamond** — filled diamond 1.60pt across, centred on the release;
 * 3. **ring** — open circle 2.20pt diameter, 0.40pt stroke, connector ending at
 *    its left perimeter.
 *
 * All three replace only **exception** members' own duration ink (a member
 * whose own duration differs from the group's carried value) with one thin
 * 0.40pt connector that starts flush at the member's protected symbol edge at
 * its true pitch y and ends at the exact resolved release time; the shared
 * bracket, baseline selection, slurs and ordinary rhythm are untouched.
 */
export const ROUND_41_CANDIDATES: JankoCandidate[] = [
  {
    id: 'hold-stop-bar',
    label: 'Stop bar endpoint',
    description:
      'Exception members’ own duration ink replaced by the shared 0.40pt connector (0.90pt white band where it coincides with a staff rule) ending in a vertical stop bar 2.40pt tall at 0.55pt stroke, centred on the release.',
    axis: 'durationEndpoint',
    options: { ...ROUND_41_SHARED_OPTIONS, durationEndpoint: 'stop-bar' },
    tokens: { ...ROUND_41_SHARED_TOKENS },
    windows: round41Windows(),
    tags: ['brahms', 'specimen', 'endpoint', 'stop-bar'],
  },
  {
    id: 'hold-diamond',
    label: 'Diamond endpoint',
    description:
      'The same connector (0.40pt) and the same 0.90pt rule-replacing white band, ending in a solid diamond 1.60pt across centred on the release.',
    axis: 'durationEndpoint',
    options: { ...ROUND_41_SHARED_OPTIONS, durationEndpoint: 'diamond' },
    tokens: { ...ROUND_41_SHARED_TOKENS },
    windows: round41Windows(),
    tags: ['brahms', 'specimen', 'endpoint', 'diamond'],
  },
  {
    id: 'hold-ring',
    label: 'Ring endpoint',
    description:
      'The same connector (0.40pt) and the same 0.90pt rule-replacing white band, ending in an open circle 2.20pt in diameter at 0.40pt stroke; the connector stops at the ring’s left perimeter.',
    axis: 'durationEndpoint',
    options: { ...ROUND_41_SHARED_OPTIONS, durationEndpoint: 'ring' },
    tokens: { ...ROUND_41_SHARED_TOKENS },
    windows: round41Windows(),
    tags: ['brahms', 'specimen', 'endpoint', 'ring'],
  },
];

const CARD_IDS = ['hold-stop-bar', 'hold-diamond', 'hold-ring'];
const SHAPES = ['stop-bar', 'diamond', 'ring'] as const;

/** The band/tokens the studio engraves a card window with (entry + delta). */
function cardOptions(id: string) {
  const card = ROUND_41_CANDIDATES.find((c) => c.id === id)!;
  return {
    card,
    brahms: resolveJankoOptions({ ...BRAHMS_OP118_NO1_JANKO_OPTIONS, ...(card.options ?? {}) }),
    brahmsTokens: resolveJankoTokens({ ...BRAHMS_OP118_NO1_JANKO_TOKENS, ...(card.tokens ?? {}) }),
    specimen: resolveJankoOptions({
      ...HOLD_ENDPOINT_SPECIMEN_JANKO_OPTIONS,
      ...(card.options ?? {}),
    }),
    specimenTokens: resolveJankoTokens({
      ...HOLD_ENDPOINT_SPECIMEN_JANKO_TOKENS,
      ...(card.tokens ?? {}),
    }),
  };
}

const layoutCache = new Map<string, readonly JankoSystemLayout[]>();
function layoutsFor(id: string, score: 'brahms' | 'specimen'): readonly JankoSystemLayout[] {
  const key = `${id}:${score}`;
  const hit = layoutCache.get(key);
  if (hit) return hit;
  const entry = cardOptions(id);
  const layouts =
    score === 'brahms'
      ? layoutJankoScore(BRAHMS, entry.brahms, entry.brahmsTokens)
      : layoutJankoScore(SPECIMEN, entry.specimen, entry.specimenTokens);
  layoutCache.set(key, layouts);
  return layouts;
}

/** Every hold of one score under one card, in system order. */
const holdsOf = (id: string, score: 'brahms' | 'specimen'): JankoHoldGeometry[] =>
  layoutsFor(id, score).flatMap((l) => l.holds);

/**
 * The whole-score reports are computed once per card (and once for the
 * Round-40 parity baseline they are attributed against) and then shared, so the
 * suite pays for each engraving pass once.
 */
const reportCache = new Map<string, ReturnType<typeof lintJankoScore>>();
function reportOf(id: string, score: 'brahms' | 'specimen') {
  const key = `${id}:${score}`;
  const hit = reportCache.get(key);
  if (hit) return hit;
  const ctx = cardOptions(id);
  const report =
    score === 'brahms'
      ? lintJankoScore(BRAHMS, ctx.brahms, ctx.brahmsTokens)
      : lintJankoScore(SPECIMEN, ctx.specimen, ctx.specimenTokens);
  reportCache.set(key, report);
  return report;
}

/** The plain parity surface without this round's scale or endpoint (attribution). */
let parityBaselineCache: ReturnType<typeof lintJankoScore> | null = null;
function parityBaselineReport() {
  if (parityBaselineCache) return parityBaselineCache;
  const ctx = cardOptions('hold-stop-bar');
  parityBaselineCache = lintJankoScore(
    BRAHMS,
    resolveJankoOptions({ ...ctx.brahms, chordSymbolScale: 1, durationEndpoint: 'none' }),
    ctx.brahmsTokens
  );
  return parityBaselineCache;
}

// ---------------------------------------------------------------------------
// 1. Registry: exactly three endpoint cards, one open axis, four shared windows
// ---------------------------------------------------------------------------

test('Round 41 metadata: release-endpoint title, one durationEndpoint axis, no strip', () => {
  assert.equal(ROUND_41_METADATA.round, 41);
  assert.match(ROUND_41_METADATA.title, /Exceptional-duration release endpoints — Round 41/i);
  assert.deepEqual(ROUND_41_METADATA.openAxes, ['durationEndpoint'], 'the round judges one axis');
  assert.equal(ROUND_41_METADATA.compareStrip, undefined, 'no comparison strip declared');
});

test('Round 41 registry: exactly three cards — stop bar, diamond, ring — on four shared windows', () => {
  assert.equal(ROUND_41_CANDIDATES.length, 3, 'exactly three active cards');
  assert.deepEqual(
    ROUND_41_CANDIDATES.map((c) => c.id),
    CARD_IDS
  );
  for (const card of ROUND_41_CANDIDATES) {
    assert.equal(card.axis, 'durationEndpoint', `${card.id}: the round's only axis`);
    assert.notEqual(card.kind, 'abstract', `${card.id}: score candidate`);
    assert.equal(card.windows?.length, 4, `${card.id}: four declared windows`);
    for (const w of card.windows ?? []) {
      assert.ok(!isAbstractCandidateWindow(w), `${card.id}: window is a score window`);
    }
    const windows = (card.windows ?? []) as Array<{
      scoreId?: string;
      measureStart: number;
      measureCount: number;
      caption?: string;
    }>;
    assert.deepEqual(
      windows.map((w) => `${w.scoreId ?? 'primary'}:${w.measureStart}-${w.measureStart + w.measureCount - 1}`),
      ['brahms-op118-no1:8-8', 'brahms-op118-no1:9-10', 'brahms-op118-no1:22-23', `${HOLD_ENDPOINT_SPECIMEN_STUDIO_SCORE_ID}:1-4`],
      `${card.id}: the three authentic specimens plus the registered fixture`
    );
    for (const w of windows) {
      assert.ok(w.caption && w.caption.length > 40, `${card.id}: every window states what to inspect`);
    }
  }
});

test('Round 41 cards share every option/token except the terminal shape', () => {
  const [stopBar, diamond, ring] = ROUND_41_CANDIDATES;
  const shared = (card: (typeof ROUND_41_CANDIDATES)[number]) => {
    const { durationEndpoint, ...rest } = card.options ?? {};
    void durationEndpoint;
    return rest;
  };
  assert.deepEqual(shared(stopBar), shared(diamond));
  assert.deepEqual(shared(stopBar), shared(ring));
  assert.deepEqual(
    shared(stopBar),
    { pitchPlacement: 'parity-columns', chordSymbolScale: 0.75 },
    'parity columns at 75 % chord-member symbol size'
  );
  assert.deepEqual(stopBar.tokens, diamond.tokens);
  assert.deepEqual(stopBar.tokens, ring.tokens);
  assert.deepEqual(
    stopBar.tokens,
    { chordKnockoutMargin: 0.10, chordKnockoutAir: 0.20 },
    'the tightened chord masks ride along on every card'
  );
  assert.deepEqual(
    ROUND_41_CANDIDATES.map((c) => c.options?.durationEndpoint),
    SHAPES,
    'the terminal shape is the only per-card delta'
  );
});

test('Round 41 rationales state the chosen line and endpoint dimensions', () => {
  const text = ROUND_41_CANDIDATES.map((c) => `${c.label} ${c.description ?? ''}`).join(' ');
  for (const dim of ['0.40pt', '0.90pt', '2.40pt', '0.55pt', '1.60pt', '2.20pt']) {
    assert.ok(text.includes(dim), `the rationale names the ${dim} dimension`);
  }
  const badges = candidateBadges(ROUND_41_CANDIDATES[0], ROUND_41_METADATA);
  const axis = badges.find((b) => b.key === 'durationEndpoint');
  assert.ok(axis, 'the open axis is badged');
  assert.equal(axis!.axis, true, 'the badge is marked as the round axis');
  assert.equal(axis!.value, 'stop-bar');
});

// ---------------------------------------------------------------------------
// 2. Ownership: every and only admitted-clasp exception owns a hold
// ---------------------------------------------------------------------------

test('Brahms ownership: every and only exception member of an admitted clasp owns a hold', () => {
  const byId = new Map(BRAHMS.notes.map((n) => [n.id, n]));
  for (const id of CARD_IDS) {
    const layouts = layoutsFor(id, 'brahms');
    const beamed = new Set(layouts.flatMap((l) => l.beams.flatMap((b) => b.notes.map((n) => n.id))));
    const expected = new Set<string>();
    for (const system of layouts) {
      for (const clasp of system.clasps) {
        for (const member of clasp.notes) {
          const src = byId.get(member.id)!;
          if (src.durationTicks !== claspMemberCarriedTicks(clasp, member.id) && !beamed.has(member.id)) {
            expected.add(member.id);
          }
        }
      }
    }
    const owned = new Set(layouts.flatMap((l) => l.holdOwnedIds));
    assert.deepEqual([...owned].sort(), [...expected].sort(), `${id}: ownership is exactly the exception set`);
    assert.deepEqual(
      layouts.flatMap((l) => l.holdRefusals),
      [],
      `${id}: no exceptional member was silently dropped (no refusals)`
    );
    assert.equal(owned.size, 38, `${id}: the Brahms spread states 38 exceptional members`);
  }
});

test('Specimen ownership: six exceptions, the three-duration chord among them, no refusals', () => {
  for (const id of CARD_IDS) {
    const holds = holdsOf(id, 'specimen');
    assert.deepEqual(
      holds.map((h) => h.noteId).sort(),
      HOLD_ENDPOINT_SPECIMEN_CASES.map((c) => c.noteId).sort(),
      `${id}: exactly the specimen's six exceptions own holds`
    );
    for (const h of holds) {
      const declared = HOLD_ENDPOINT_SPECIMEN_CASES.find((c) => c.noteId === h.noteId)!;
      assert.equal(h.startTick, declared.startTick, `${h.noteId}: start tick`);
      assert.equal(h.releaseTick, declared.releaseTick, `${h.noteId}: release tick = start + own duration`);
    }
    assert.deepEqual(layoutsFor(id, 'specimen').flatMap((l) => l.holdRefusals), []);
  }
  // The three-duration chord: one carried value (48) and two exceptions of
  // different values, each owning its own release.
  const chord = SPECIMEN.notes.filter((n) => n.startTick === 48 && n.hand === 'RH');
  assert.deepEqual(
    chord.map((n) => n.durationTicks).sort((a, b) => a - b),
    [48, 48, 96, 120],
    'three distinct member durations in one group'
  );
  const chordHolds = holdsOf('hold-stop-bar', 'specimen').filter((h) => h.startTick === 48);
  assert.deepEqual(
    chordHolds.map((h) => h.releaseTick).sort((a, b) => a - b),
    [144, 168],
    'the carried 48 value states no hold; the 96 and the 120 members each own one'
  );
});

// ---------------------------------------------------------------------------
// 3. Shared treatment: identical geometry, three terminals
// ---------------------------------------------------------------------------

test('The three cards engrave identical hold geometry; only the terminal shape differs', () => {
  for (const score of ['brahms', 'specimen'] as const) {
    const perCard = CARD_IDS.map((id) => holdsOf(id, score));
    // Shape-independent core: the anchor, the flush start, the true pitch row,
    // the continuation flag and the replaced rule segments. The connector's
    // right end legitimately follows the terminal's own ink reach.
    const geometryOf = (holds: JankoHoldGeometry[]) =>
      holds
        .map((h) =>
          [
            h.noteId,
            h.startTick,
            h.releaseTick,
            h.releaseX.toFixed(3),
            h.x1.toFixed(3),
            h.y.toFixed(3),
            h.continuesAtSystemBreak ? 'continues' : 'terminal',
            h.underlays.map((u) => u.y.toFixed(3)).join('|'),
            h.underlays.length,
          ].join(',')
        )
        .sort();
    const endsOf = (holds: JankoHoldGeometry[]) =>
      holds.map((h) => `${h.noteId}:${h.x2.toFixed(3)}`).sort();
    assert.notDeepEqual(endsOf(perCard[1]), endsOf(perCard[0]), `${score}: the ink end follows the terminal`);
    assert.deepEqual(geometryOf(perCard[1]), geometryOf(perCard[0]), `${score}: diamond shares the layout core`);
    assert.deepEqual(geometryOf(perCard[2]), geometryOf(perCard[0]), `${score}: ring shares the layout core`);
    for (let i = 0; i < 3; i++) {
      for (const h of perCard[i]) {
        assert.equal(h.shape, SHAPES[i], `${h.noteId}: terminal shape follows the card`);
      }
    }
  }
});

test('Terminal ink follows the declared dimensions and never passes the release anchor', () => {
  const dims = {
    'stop-bar': { reach: DEFAULT_JANKO_TOKENS.holdStopBarStroke / 2, half: DEFAULT_JANKO_TOKENS.holdStopBarHeight / 2 },
    diamond: { reach: DEFAULT_JANKO_TOKENS.holdDiamondSize / 2, half: DEFAULT_JANKO_TOKENS.holdDiamondSize / 2 },
    ring: {
      reach: DEFAULT_JANKO_TOKENS.holdRingDiameter / 2 + DEFAULT_JANKO_TOKENS.holdRingStroke / 2,
      half: DEFAULT_JANKO_TOKENS.holdRingDiameter / 2 + DEFAULT_JANKO_TOKENS.holdRingStroke / 2,
    },
  } as const;
  for (const id of CARD_IDS) {
    const shape = id.replace('hold-', '') as (typeof SHAPES)[number];
    const ctx = cardOptions(id);
    assert.equal(holdTerminalReach(ctx.brahmsTokens, shape), dims[shape].reach, `${id}: x reach`);
    assert.equal(holdTerminalHalfHeight(ctx.brahmsTokens, shape), dims[shape].half, `${id}: half height`);
    for (const h of holdsOf(id, 'brahms')) {
      if (h.continuesAtSystemBreak) continue;
      assert.ok(
        h.terminalX <= h.releaseX + 1e-9,
        `${h.noteId}: the terminal centre never sits past the release anchor`
      );
      if (h.clearanceShortfall > 0) {
        assert.ok(
          h.terminalX + dims[shape].reach <= h.releaseX + 1e-9,
          `${h.noteId}: a seated-back terminal's ink stops short of the anchor`
        );
      }
      assert.ok(
        Math.abs(h.x2 - (h.terminalX - dims[shape].reach)) < 1e-9,
        `${h.noteId}: the connector ends at the terminal's leading perimeter`
      );
      assert.ok(h.terminalX >= h.x1, `${h.noteId}: the terminal stays right of the connector start`);
    }
  }
  assert.deepEqual(JANKO_DURATION_ENDPOINTS, ['stop-bar', 'diamond', 'ring'], 'documented shape order');
});

// ---------------------------------------------------------------------------
// 4. Exact-time anchors: onsets, no-onset releases, barlines, line breaks
// ---------------------------------------------------------------------------

test('m. 8: the release anchor is the resolved column of the full-size symbol at that instant', () => {
  const layouts = layoutsFor('hold-stop-bar', 'brahms');
  const system = layouts.find((l) => l.holds.some((h) => h.noteId === 'brahms-op118-no1-106'))!;
  const hold = system.holds.find((h) => h.noteId === 'brahms-op118-no1-106')!;
  const at1536 = system.notes.filter((p) => p.note.startTick === 1536);
  assert.ok(at1536.length >= 2, 'the release instant carries the following attack');
  assert.ok(
    at1536.some((p) => Math.abs(p.x - hold.releaseX) < 0.01),
    'the anchor is the laid-out time column, not a proportional estimate'
  );
  // The member's own statement is the B3 exception (48 against the carried 96).
  const src = BRAHMS.notes.find((n) => n.id === 'brahms-op118-no1-106')!;
  assert.equal(src.durationTicks, 48);
  assert.equal(hold.releaseTick, src.startTick + src.durationTicks);
  assert.ok(
    Math.abs(hold.clearanceShortfall - 3.0) < 0.02,
    'the terminal is seated 3.00pt back from the occupying symbol, published not hidden'
  );
  assert.equal(hold.seatReason, 'protected-ink');
  assert.ok(hold.terminalX < hold.releaseX, 'the mark never sits past the release');
});

test('Specimen: a release with no attack at its tick is anchored by the laid-out time map', () => {
  const hold = holdsOf('hold-stop-bar', 'specimen').find(
    (h) => h.noteId === 'hold-endpoint-specimen-rh-48-11_5'
  )!;
  assert.equal(hold.releaseTick, 168);
  assert.equal(
    SPECIMEN.notes.filter((n) => n.startTick === hold.releaseTick).length,
    0,
    'nothing attacks at the release tick'
  );
  const system = layoutsFor('hold-stop-bar', 'specimen')[0];
  assert.equal(system.index, 0, 'the m. 1–2 exception lives in the first system');
  const before = Math.max(...system.notes.filter((p) => p.note.startTick < hold.releaseTick).map((p) => p.x));
  const after = Math.min(...system.notes.filter((p) => p.note.startTick > hold.releaseTick).map((p) => p.x));
  assert.ok(before < hold.releaseX && hold.releaseX < after, 'the anchor lies between the neighbouring columns');
  assert.equal(hold.clearanceShortfall, 0, 'nothing occupies the anchor: the terminal lands exactly on it');
  assert.equal(hold.terminalX, hold.releaseX);
});

test('Specimen: the m. 2 exception continues past the line, and the m. 4 release seats on the final barline', () => {
  for (const id of CARD_IDS) {
    const continues = holdsOf(id, 'specimen').find(
      (h) => h.noteId === 'hold-endpoint-specimen-rh-288-0_6'
    )!;
    assert.equal(continues.releaseTick, 408, `${id}: the release lies past the system's last tick`);
    assert.equal(continues.continuesAtSystemBreak, true, `${id}: a line break is not a release`);
    const system = layoutsFor(id, 'specimen')[0];
    assert.equal(continues.x2, system.geometry.staffRight, `${id}: the connector runs to the line edge`);
    assert.equal(continues.clearanceShortfall, 0, `${id}: no terminal, no shortfall`);

    const finalBar = holdsOf(id, 'specimen').find(
      (h) => h.noteId === 'hold-endpoint-specimen-rh-672-7_5'
    )!;
    assert.equal(finalBar.releaseTick, 768, `${id}: the release is the score's final barline`);
    assert.equal(finalBar.continuesAtSystemBreak, false, `${id}: the final barline is a real release`);
    const last = layoutsFor(id, 'specimen')[1];
    assert.equal(finalBar.releaseX, last.geometry.staffRight, `${id}: the anchor clamps into the staff`);
    assert.ok(finalBar.terminalX < finalBar.releaseX, `${id}: the terminal seats inside the line`);
    assert.ok(finalBar.clearanceShortfall > 0, `${id}: the shortfall against the barline is published`);
  }
});

test('Shared bracket and baseline selection are untouched by the endpoint treatment', () => {
  for (const id of CARD_IDS) {
    const ctx = cardOptions(id);
    const baseline = layoutJankoScore(
      BRAHMS,
      resolveJankoOptions({ ...ctx.brahms, durationEndpoint: 'none' }),
      ctx.brahmsTokens
    );
    const treated = layoutsFor(id, 'brahms');
    assert.equal(treated.length, baseline.length, `${id}: no system was added`);
    for (let s = 0; s < baseline.length; s++) {
      const noteKey = (l: JankoSystemLayout) =>
        l.notes.map((p) => [
          p.note.id,
          p.x.toFixed(4),
          p.y.toFixed(4),
          p.note.durationTicks,
          p.rhythm.hand,
          p.coord.pitchClass,
          p.coord.octave,
        ].join(','));
      assert.deepEqual(noteKey(treated[s]), noteKey(baseline[s]), `${id}: system ${s} notes are unmoved`);
      const claspKey = (l: JankoSystemLayout) =>
        l.clasps.map((c) => `${c.tick}:${c.durationTicks}:${c.notes.map((n) => n.id).sort().join('+')}`);
      assert.deepEqual(claspKey(treated[s]), claspKey(baseline[s]), `${id}: system ${s} brackets unchanged`);
    }
  }
});

// ---------------------------------------------------------------------------
// 5. Per-note metrics agree across paint, layout and lint
// ---------------------------------------------------------------------------

test('Chord members paint at 0.75 absolute-pitch-symbol size; standalone symbols stay canonical', () => {
  const ctx = cardOptions('hold-stop-bar');
  const svg = renderJankoCrop(SPECIMEN, 1, 4, ctx.specimen, ctx.specimenTokens);
  const chordSize = DEFAULT_JANKO_TOKENS.digitFontSize * 0.75;
  assert.ok(svg.includes(`font-size="${Number(chordSize.toFixed(3))}pt"`), 'chord digits paint at 4.35pt');
  assert.ok(svg.includes(`font-size="${Number(DEFAULT_JANKO_TOKENS.digitFontSize.toFixed(3))}pt"`), 'standalone digits paint at 5.8pt');

  const system = layoutsFor('hold-stop-bar', 'specimen')[0];
  const chord = system.notes.filter((p) => p.note.startTick === 48 && p.rhythm.hand === 'RH');
  assert.equal(chord.length, 4);
  const halfWidth = digitHalfExtents(chordSize).halfWidth;
  const expectedWidth = 2 * (halfWidth + DEFAULT_JANKO_TOKENS.chordKnockoutMargin);
  const rects = (svg.match(/<rect class="janko-knockout"[^>]*width="([\d.]+)"[^>]*>/g) ?? []).map(
    (r) => Number(/width="([\d.]+)"/.exec(r)![1])
  );
  for (const p of chord) {
    assert.equal(p.symbolScale, 0.75, 'the head carries its symbol scale');
    assert.equal(p.symbolChord, true, 'the head is a chord member');
    const extents = knockoutHalfExtents(ctx.specimen, ctx.specimenTokens, p.note.startTick, p);
    assert.ok(
      Math.abs(extents.wx * 2 - expectedWidth) < 1e-9,
      'layout extents derive from the scaled glyph plus the chord margin'
    );
    assert.ok(
      rects.some((w) => Math.abs(w - extents.wx * 2) < 1e-9),
      'the painted mask is exactly the audited box (no metric drift between paint and lint)'
    );
  }
  // Standalone heads keep the untouched canonical preset mask (away from the
  // Position of Honor, where the halo ring legitimately grows every mask).
  const standalone = system.notes.find((p) => p.rhythm.hand === 'LH' && p.note.startTick === 96)!;
  assert.equal(standalone.symbolChord, undefined, 'the bass note is not a chord member');
  const preset = getKnockoutMetrics(ctx.specimen, ctx.specimenTokens);
  assert.ok(Math.abs(knockoutHalfExtents(ctx.specimen, ctx.specimenTokens, standalone.note.startTick, standalone).wx - preset.wx) < 1e-9);
  assert.ok(rects.some((w) => Math.abs(w - preset.wx * 2) < 0.001), 'standalone masks paint at the preset width');
});

test('Parity columns keep source pitch, true Y, 2-span 5.0pt and 10-span 30.0pt', () => {
  const system = layoutsFor('hold-stop-bar', 'brahms').find((l) =>
    l.notes.some((p) => p.note.startTick === 1392)
  )!;
  const rh = system.notes.filter((p) => p.note.startTick === 1392 && p.rhythm.hand === 'RH');
  assert.equal(rh.length, 5, 'all five source notes keep a head');
  for (const p of rh) {
    const src = BRAHMS.notes.find((n) => n.id === p.note.id)!;
    assert.equal(p.coord.pitchClass, src.pitch.pitchClass, `${p.note.id}: pitch identity preserved`);
    assert.equal(p.coord.octave, src.pitch.octave, `${p.note.id}: octave address preserved`);
    assert.equal(p.note.durationTicks, src.durationTicks, `${p.note.id}: source duration preserved`);
    assert.equal(wholeToneParity(src.pitch), 1, `${p.note.id}: odd whole-tone family`);
  }
  // One parity column: the exact same x for all five heads of the downbeat.
  const xs = new Set(rh.map((p) => p.x.toFixed(6)));
  assert.equal(xs.size, 1, 'the whole odd family shares one column');
  const y = (pc: number, oct: number) =>
    rh.find((p) => p.coord.pitchClass === pc && p.coord.octave === oct)!.y;
  assert.ok(Math.abs(Math.abs(y(5, 4) - y(7, 4)) - 5.0) < 1e-6, '2-span neighbour = 5.0pt');
  assert.ok(Math.abs(Math.abs(y(5, 3) - y(7, 3)) - 5.0) < 1e-6, '2-span neighbour = 5.0pt (lower pair)');
  assert.ok(Math.abs(Math.abs(y(5, 3) - y(5, 4)) - 30.0) < 1e-6, '10-span octave = 30.0pt');
  assert.ok(Math.abs(Math.abs(y(11, 3) - y(5, 4)) - 15.0) < 1e-6, 'a 6-span distance stays exact');
});

// ---------------------------------------------------------------------------
// 6. Paint: shapes, connector, white underlays — emitted, not just declared
// ---------------------------------------------------------------------------

test('All three endpoint shapes and the shared connector paint in the emitted SVG', () => {
  for (const id of CARD_IDS) {
    const ctx = cardOptions(id);
    const shape = id.replace('hold-', '');
    const svg = renderJankoCrop(BRAHMS, 8, 1, ctx.brahms, ctx.brahmsTokens);
    assert.ok(svg.includes('class="janko-hold-layer"'), `${id}: the hold layer paints`);
    assert.ok(svg.includes('class="janko-hold-connector"'), `${id}: the connector paints`);
    assert.ok(
      svg.includes(`stroke-width="${DEFAULT_JANKO_TOKENS.holdConnectorStroke.toFixed(2)}" stroke-linecap="butt"`),
      `${id}: the connector is the shared 0.40pt butt stroke`
    );
    assert.ok(svg.includes(`janko-hold-terminal-${shape}"`), `${id}: the declared terminal paints`);
    if (shape === 'stop-bar') {
      assert.ok(svg.includes(`stroke-width="${DEFAULT_JANKO_TOKENS.holdStopBarStroke.toFixed(2)}"`));
    } else if (shape === 'diamond') {
      assert.ok(/janko-hold-terminal-diamond"[^>]*fill="#111111"/.test(svg), 'the diamond is filled');
    } else {
      assert.ok(
        svg.includes(`r="${DEFAULT_JANKO_TOKENS.holdRingDiameter / 2}"`) ||
          svg.includes(`r="${Number(DEFAULT_JANKO_TOKENS.holdRingDiameter / 2).toFixed(2)}"`),
        'the ring paints its diameter'
      );
      assert.ok(svg.includes(`stroke-width="${DEFAULT_JANKO_TOKENS.holdRingStroke.toFixed(2)}"`), 'ring stroke');
    }
  }
});

test('The rule-coincident connector replaces exactly the local rule segment', () => {
  // Brahms m. 22: the C6 exception runs along the C6 octave-line rule (pitch 72).
  for (const id of CARD_IDS) {
    const ctx = cardOptions(id);
    const hold = holdsOf(id, 'brahms').find((h) => h.noteId === 'brahms-op118-no1-295')!;
    assert.equal(hold.underlays.length, 1, `${id}: one coincident rule segment is replaced`);
    const u = hold.underlays[0];
    assert.ok(Math.abs(u.y - hold.y) < 1e-9, `${id}: the band sits on the member's own row`);
    assert.ok(u.x1 >= hold.x1 - 1e-9 && u.x2 <= hold.x2 + 1e-9, `${id}: the band stays inside the connector`);
    const svg = renderJankoCrop(BRAHMS, 22, 2, ctx.brahms, ctx.brahmsTokens);
    assert.ok(svg.includes('class="janko-hold-underlay"'), `${id}: the white band paints`);
    assert.ok(
      svg.includes(`height="${Number(DEFAULT_JANKO_TOKENS.holdUnderlayWidth).toFixed(2)}"`),
      `${id}: the band is the declared 0.90pt tall`
    );
  }
  // Specimen m. 1: the C5 exception crosses a bracket, so its band is split
  // around the bracket instead of erasing it.
  for (const id of CARD_IDS) {
    const hold = holdsOf(id, 'specimen').find(
      (h) => h.noteId === 'hold-endpoint-specimen-rh-48-0_5'
    )!;
    assert.equal(hold.underlays.length, 2, `${id}: the band is split around the bracket it crosses`);
    const [a, b] = hold.underlays;
    assert.ok(a.x2 < b.x1, `${id}: the split leaves the protected ink untouched`);
  }
});

test('Continuation holds paint no terminal at a system break', () => {
  for (const id of CARD_IDS) {
    const ctx = cardOptions(id);
    const svg = renderJankoCrop(SPECIMEN, 1, 4, ctx.specimen, ctx.specimenTokens);
    const group = /<g class="janko-hold"[^>]*data-hold-note="hold-endpoint-specimen-rh-288-0_6"[^>]*>([\s\S]*?)<\/g>/.exec(svg);
    assert.ok(group, `${id}: the continuing hold paints its own group`);
    assert.ok(group![0].includes('data-hold-continues="true"'), `${id}: ownership of the line break is explicit`);
    assert.ok(!group![1].includes('janko-hold-terminal'), `${id}: no terminal marks a mere line break`);
    assert.ok(group![1].includes('janko-hold-connector'), `${id}: the connector carries the sound to the edge`);
  }
});

// ---------------------------------------------------------------------------
// 7. Lint honesty: exact findings, no suppression, hidden ink detectable
// ---------------------------------------------------------------------------

test('The hold audit is registered and reports the required windows exactly', () => {
  assert.ok(JANKO_LINT_CHECKS.includes('hold-integrity'), 'the hold audit is a registered check');

  for (const id of CARD_IDS) {
    const report = reportOf(id, 'brahms');
    const m8 = report.diagnostics.filter((d) => d.measure === 8);
    assert.deepEqual(
      m8.map((d) => `${d.severity}:${d.code}`),
      ['warning:hold-endpoint-clearance'],
      `${id}: m. 8 states exactly the measured 3.00pt seat`
    );
    assert.equal(
      report.violations.filter((v) => v.measure === 8).length,
      0,
      `${id}: m. 8 carries no violation`
    );
    const mm910 = report.diagnostics.filter((d) => d.measure === 9 || d.measure === 10);
    assert.deepEqual(
      mm910.map((d) => `${d.severity}:${d.code}`).sort(),
      [
        'warning:hold-connector-occluded',
        'warning:hold-connector-occluded',
        'warning:hold-endpoint-clearance',
        'warning:hold-endpoint-clearance',
      ],
      `${id}: mm. 9–10 state the boundary crossings, the 2.03pt seat and the m. 10 seat`
    );
    const m22 = report.diagnostics.filter((d) => d.measure === 22);
    assert.deepEqual(m22, [], `${id}: m. 22's rule-row release lands exactly on its anchor`);
  }
});

test('The whole-score chips stay truthful: nothing hidden, nothing suppressed', () => {
  for (const id of CARD_IDS) {
    const report = reportOf(id, 'brahms');
    for (const code of [
      'hold-endpoint-hidden',
      'hold-connector-hidden',
      'hold-timing-anchor',
      'hold-redundant-stem',
      'hold-underlay',
      'hold-unresolvable',
    ] as const) {
      const hit = report.diagnostics.filter((d) => d.code === code);
      assert.deepEqual(hit, [], `${id}: no ${code} anywhere in the spread`);
    }
    // Round 44's anchored parity placement resolved the m. 33 / m. 53
    // fold-pair findings this round inherited from the Round-40 parity
    // surface: that LH octave pair is a fold-coincident, never-admitted group,
    // so it keeps the established literal placement instead of a parity offset
    // and no stem is painted through a simultaneity tone. Zero hard findings
    // remain on the whole score (the endpoint treatment's own cleanliness was
    // already pinned above); the plain parity baseline that used to carry them
    // is no longer the card's attribution set.
    void parityBaselineReport();
    assert.equal(report.violations.length, 0, `${id}: no hard findings remain`);
    assert.deepEqual(
      report.warnings.filter((w) => w.code === 'chordal-overlap').map((w) => `m${w.measure}`),
      [],
      `${id}: and no chordal-overlap warning rides along`
    );
  }
});

test('The specimen engraves clean and states its four measured findings', () => {
  for (const id of CARD_IDS) {
    const report = reportOf(id, 'specimen');
    assert.equal(report.violations.length, 0, `${id}: the fixture carries no violation`);
    assert.deepEqual(
      report.diagnostics.map((d) => `${d.measure}:${d.severity}:${d.code}`).sort(),
      [
        '1:warning:hold-connector-occluded',
        '1:warning:hold-endpoint-clearance',
        '2:warning:hold-connector-occluded',
        '4:warning:hold-endpoint-clearance',
      ],
      `${id}: only the two measured seats and the two reported crossings`
    );
  }
});

test('Hidden ink is detected: a terminal pushed under a neighbour raises hold-endpoint-hidden', () => {
  const ctx = cardOptions('hold-stop-bar');
  const system = layoutsFor('hold-stop-bar', 'specimen')[0];
  const hold = system.holds.find((h) => h.noteId === 'hold-endpoint-specimen-rh-48-0_5')!;
  const half = holdTerminalHalfHeight(ctx.specimenTokens, 'stop-bar');
  const ink = holdClearanceInk(system.notes, system.rests, system.clasps, system.geometry, system.index, ctx.specimen, ctx.specimenTokens);
  const blocker = ink.seat.find(
    (b) =>
      b.x1 > hold.terminalX &&
      b.x0 < hold.releaseX &&
      b.y1 > hold.y - half &&
      b.y0 < hold.y + half
  );
  assert.ok(blocker, 'the release instant is occupied by protected ink');
  const doctored: JankoSystemLayout = {
    ...system,
    holds: [{ ...hold, terminalX: (blocker!.x0 + blocker!.x1) / 2, clearanceShortfall: 0 }],
  };
  const out: LintViolation[] = [];
  checkHoldIntegrity(doctored, ctx.specimen, ctx.specimenTokens, out);
  assert.ok(
    out.some((v) => v.code === 'hold-endpoint-hidden'),
    'a terminal that would disappear under a knockout is reported, never accepted'
  );
});

// ---------------------------------------------------------------------------
// 8. Golden masters and the Reference view are untouched
// ---------------------------------------------------------------------------

test('Canonical reference: Bach GOLD and Brahms BRONZE still lint 0/0 unchanged', () => {
  const bach = lintJankoScore(BACH, resolveJankoOptions(DEFAULT_JANKO_OPTIONS), resolveJankoTokens(DEFAULT_JANKO_TOKENS));
  assert.deepEqual(bach.violations, [], 'Bach Goldberg Var. 1: zero violations');
  assert.deepEqual(bach.warnings, [], 'Bach Goldberg Var. 1: zero warnings');
  const brahms = lintJankoScore(
    BRAHMS,
    resolveJankoOptions({ ...BRAHMS_OP118_NO1_JANKO_OPTIONS }),
    resolveJankoTokens(BRAHMS_OP118_NO1_JANKO_TOKENS)
  );
  assert.deepEqual(brahms.violations, [], 'Brahms Op. 118/1 golden: zero violations');
  assert.deepEqual(brahms.warnings, [], 'Brahms Op. 118/1 golden: zero warnings');
  assert.equal(DEFAULT_JANKO_OPTIONS.durationEndpoint, 'none', 'the canonical treatment is unchanged');
  assert.equal(DEFAULT_JANKO_OPTIONS.chordSymbolScale, 1, 'canonical symbols stay full size');
});

test('The Reference view stays the untouched control: no hold ink anywhere in it', () => {
  // The Reference view engraves the golden options (asserted in
  // test/janko-studio.test.ts); those options state no hold at all, and the
  // golden ink paints none.
  const golden = resolveJankoOptions(BRAHMS_OP118_NO1_JANKO_OPTIONS);
  const goldenTokens = resolveJankoTokens(BRAHMS_OP118_NO1_JANKO_TOKENS);
  assert.deepEqual(
    layoutJankoScore(BRAHMS, golden, goldenTokens).flatMap((l) => l.holds),
    [],
    'the golden Brahms spread states no hold-to-release run'
  );
  const goldenBach = renderJankoCrop(BACH, 1, 2, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
  assert.ok(!goldenBach.includes('janko-hold'), 'the golden Bach crop paints no hold layer');
  const goldenBrahms = renderJankoCrop(BRAHMS, 8, 2, golden, goldenTokens);
  assert.ok(!goldenBrahms.includes('janko-hold'), 'the golden Brahms crop paints no hold layer');
});

test('The Round 41 fixture stays registered in the studio score library', () => {
  const config = createStudioConfig();
  const specimen = config.scores[HOLD_ENDPOINT_SPECIMEN_STUDIO_SCORE_ID];
  assert.ok(specimen, 'the specimen is registered in the studio score library');
  assert.equal(specimen.id, HOLD_ENDPOINT_SPECIMEN_STUDIO_SCORE_ID);
  const windows = ROUND_41_CANDIDATES.flatMap((c) => resolveCandidate(c).windows);
  assert.equal(windows.length, 12, 'three cards × four windows');
  assert.ok(
    windows.every(
      (w) => isAbstractCandidateWindow(w) || w.scoreId === undefined || w.scoreId in config.scores
    ),
    'every declared score window names a registered score'
  );
});
