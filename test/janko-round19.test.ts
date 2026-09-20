/**
 * Round 19 — Symmetric-Tuck Clusters + Anchor Verdict + Beat Grid.
 *
 * The round changes three score-wide behaviours:
 *
 *  1. **Symmetric tuck** replaces the multi-row interleave. One onset whose
 *     rows carry different head counts is re-centred: the widest row(s) keep
 *     the fan, every smaller row shifts so its own middle lands on the widest
 *     row's middle, and an even cluster (1+1, 2+2+2, 3+3) does not move at all.
 *     A tuck that would leave the beat cell is skipped.
 *  2. **Overlap-conditional unification**: when both hands of one onset produce
 *     a qualifying clasp group and their spans overlap or touch, one bracket
 *     spans every head of the onset (with one duration group per hand); a gapped
 *     onset keeps Round 6's per-hand brackets.
 *  3. **The beat grid follows the columns**: a beat that carries an onset paints
 *     its dashed pulse through the onset's laid-out column; an empty beat keeps
 *     the proportional line.
 *
 * Round 20 retires the round's axis: the RH anchor is the only rule, so the
 * `'rh'` behavior below is the golden behavior. The tests pin the tuck, the
 * unification and the grid; the anchor demonstrator is gone.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { QuantizedGridScore, QuantizedNote, Hand } from '../src/model/types';
import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1';
import { buildBrahmsOp118No1Score } from '../src/scores/brahms-op118-no1';
import {
  BRAHMS_ROUND44_RESERVE_OPTIONS,
  BRAHMS_ROUND44_RESERVE_TOKENS,
} from './brahms-round44-reserve';

import {
  DEFAULT_JANKO_OPTIONS,
  DEFAULT_JANKO_TOKENS,
  getClusterSpacingPreset,
  getGridNoteInset,
  resolveJankoOptions,
  resolveJankoTokens,
} from '../src/render/janko/types';
import {
  claspMemberCarriedTicks,
  layoutJankoScore,
  renderSystem,
} from '../src/render/janko/engine';
import { lintJankoScore } from '../src/render/janko/linter';
import { pointToSegmentDistance } from '../src/render/janko/geometry';

const BACH = buildBachGoldbergVar1Score();
const BRAHMS = buildBrahmsOp118No1Score();
const BACH_OPTIONS = { ...DEFAULT_JANKO_OPTIONS, core: 'adaptive' as const };
const BRAHMS_OPTIONS = { ...BRAHMS_ROUND44_RESERVE_OPTIONS, core: 'adaptive' as const };
const T = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
const BRAHMS_T = resolveJankoTokens(BRAHMS_ROUND44_RESERVE_TOKENS);
const PAIR_GAP = getClusterSpacingPreset(DEFAULT_JANKO_OPTIONS.clusterSpacing).pairGap;

/** Brahms m. 46 downbeat: the ticket's six-head cluster (tick 8688). */
const M46 = 8688;
/** Brahms m. 26 downbeat: the second interlocking-hands instance (tick 4848). */
const M26 = 4848;
/** Brahms m. 3 downbeat: the Round 6 split guard (tick 432). */
const M3 = 432;

function makeNote(
  id: string,
  pitchClass: number,
  octave: number,
  startTick: number,
  durationTicks: number,
  hand: Hand = 'RH'
): QuantizedNote {
  return { id, pitch: { pitchClass, octave }, startTick, durationTicks, hand };
}

function makeScore(notes: QuantizedNote[], totalTicks = 144): QuantizedGridScore {
  return {
    id: 'synthetic-round19',
    title: 'Synthetic Round 19',
    composer: 'test',
    ticksPerBeat: 48,
    totalTicks,
    timeSignatures: [{ tick: 0, numerator: 3, denominator: 4 }],
    barlines: [],
    tempos: [],
    dynamics: [],
    pedals: [],
    notes,
  };
}

/** Every note of one tick, keyed by note id. */
function onset(layouts: ReturnType<typeof layoutJankoScore>, tick: number) {
  const notes = layouts.flatMap((l) => l.notes).filter((p) => p.note.startTick === tick);
  return new Map(notes.map((p) => [p.note.id, p]));
}

/** Every onset of a score bucketed by tick (id -> positioned note). */
function onsetsByTick(layouts: ReturnType<typeof layoutJankoScore>) {
  const byTick = new Map<number, ReturnType<typeof onset>>();
  for (const p of layouts.flatMap((l) => l.notes)) {
    const bucket = byTick.get(p.note.startTick) ?? new Map();
    bucket.set(p.note.id, p);
    byTick.set(p.note.startTick, bucket);
  }
  return byTick;
}

// ---------------------------------------------------------------------------
// 1. The RH anchor (the only rule since the Round 19 verdict)
// ---------------------------------------------------------------------------

test('The RH anchor is the only anchor rule: the option is retired', () => {
  assert.ok(
    !('clusterAnchor' in DEFAULT_JANKO_OPTIONS),
    'the retired cluster-anchor option is gone from the golden master'
  );
  assert.ok(
    !('clusterAnchor' in resolveJankoOptions({})),
    'and from every resolved option set'
  );
});

// ---------------------------------------------------------------------------
// 2. The symmetric tuck
// ---------------------------------------------------------------------------

test('m. 46 slots compactly: bracketed pairs go {0, +G}, mixed rows {0, +G}', () => {
  const layout = layoutJankoScore(BRAHMS, BRAHMS_OPTIONS, BRAHMS_ROUND44_RESERVE_TOKENS);
  const n = onset(layout, M46);
  const x = (id: string): number => n.get(id)!.x;
  // The retired Round 19 symmetric tuck is deleted: F5 / D3 (the single-head
  // rows) stand on the solved column, not on the pair columns' midpoint.
  // The column is 187.53: m.46's downbeat inset is the plain 14.40 (spine
  // 7.6 + ring 2.8 + barline air 4.0) — compact seating leaves the LEFT
  // rail unoccupied, so no LEFT-rail air is reserved.
  assert.equal(x('brahms-op118-no1-637').toFixed(2), '187.53', 'F5 stands on the column');
  assert.equal(x('brahms-op118-no1-632').toFixed(2), '187.53', 'D3 stands on the column');
  // Compact seating: the same-hand bracketed row (F4/B4) is an ordinary
  // conflicting pair — lower CENTER, higher RIGHT — since the bracket hugs
  // the leftmost OCCUPIED rail and no qualification gate remains.
  assert.equal(x('brahms-op118-no1-634').toFixed(2), '187.53', 'F4 sits CENTER');
  assert.equal(x('brahms-op118-no1-636').toFixed(2), '192.99', 'B4 sits RIGHT');
  // The mixed-hand row (D4/G#4): the unbracketed D4 holds the column and the
  // bracketed G#4 staggers right off it. Lowest-pitch-first order holds.
  assert.equal(x('brahms-op118-no1-633').toFixed(2), '187.53', 'D4 holds the column');
  assert.equal(x('brahms-op118-no1-635').toFixed(2), '192.99', 'G#4 staggers one slot right');
  // The singletons share the column with the mixed row's lower head; the two
  // RIGHT-rail heads (B4, G#4) coincide exactly.
  assert.equal(x('brahms-op118-no1-637'), x('brahms-op118-no1-633'), 'F5 shares the column');
  assert.equal(x('brahms-op118-no1-632'), x('brahms-op118-no1-633'), 'D3 shares the column');
  assert.equal(x('brahms-op118-no1-636'), x('brahms-op118-no1-635'), 'B4 and G#4 share RIGHT');
});

test('Slots are score-wide: three-rail seats on every solved column', () => {
  // Compact seating model (adaptive core runs the same solver): every head
  // stands on exactly one of the three rails (col−G, col, col+G); no two
  // heads of one folded row share a rail. Ordinary same-clasp common pairs
  // seat ADJACENT (lower CENTER / higher RIGHT, or lower LEFT / higher
  // CENTER when RIGHT is taken); same-clasp common triples (true cliques)
  // seat LEFT/CENTER/RIGHT; unbracketed pairs keep the legacy joint rule
  // {0, +G}; mixed rows hold the unbracketed head on the column.
  // Exception rows assert rails + separation (duration-ink precedence is
  // covered by the solver unit tests and the fixed-3 literals); the linter
  // backstops every exception stem globally.
  for (const [name, score, options, tokens] of [
    ['Bach', BACH, BACH_OPTIONS, T],
    ['Brahms', BRAHMS, BRAHMS_OPTIONS, BRAHMS_T],
  ] as const) {
    const layouts = layoutJankoScore(score, options, tokens);
    let slotted = 0;
    let singletons = 0;
    let offColumnSingletons = 0;
    const kinds = { ordinaryPair: 0, cliqueTriple: 0, jointPair: 0, mixed: 0, exception: 0 };
    for (const layout of layouts) {
      const byTick = new Map<number, typeof layout.notes>();
      for (const p of layout.notes) {
        const bucket = byTick.get(p.note.startTick) ?? [];
        bucket.push(p);
        byTick.set(p.note.startTick, bucket);
      }
      for (const [tick, heads] of byTick) {
        const col = layout.columns.get(tick)!;
        const claspOf = (id: string): (typeof layout.clasps)[number] | undefined =>
          layout.clasps.find((c) => c.tick === tick && c.notes.some((n) => n.id === id));
        const rows = new Map<number, typeof heads>();
        for (const p of heads) {
          const key = Math.round(p.y * 1000);
          rows.set(key, [...(rows.get(key) ?? []), p]);
        }
        for (const row of rows.values()) {
          const linOf = (p: (typeof heads)[number]): number =>
            p.note.pitch.octave * 12 + p.note.pitch.pitchClass;
          const byLin = [...row].sort(
            (a, b) => linOf(a) - linOf(b) || (a.note.id < b.note.id ? -1 : 1)
          );
          // Universal: every head on a rail.
          for (const p of byLin) {
            const dx = p.x - col;
            assert.ok(
              Math.abs(dx) < 1e-9 || Math.abs(Math.abs(dx) - PAIR_GAP) < 1e-9,
              `${name} t${tick}: ${p.note.id} stands on a rail (dx=${dx.toFixed(3)})`
            );
          }
          if (byLin.length === 1) {
            singletons++;
            // A clear head holds the column; the only off-column singletons
            // are bracketed exceptions displaced onto a side rail.
            if (Math.abs(byLin[0].x - col) < 1e-9) continue;
            offColumnSingletons++;
            const clasp = claspOf(byLin[0].note.id);
            assert.ok(clasp, `${name} t${tick}: off-column singleton is bracketed`);
            assert.notEqual(
              byLin[0].note.durationTicks,
              claspMemberCarriedTicks(clasp!, byLin[0].note.id),
              `${name} t${tick}: off-column singleton is an exception`
            );
            continue;
          }
          slotted++;
          // Universal: no two heads of one row share a rail.
          const rails = byLin.map((p) => Math.round((p.x - col) / PAIR_GAP));
          assert.equal(
            new Set(rails).size,
            rails.length,
            `${name} t${tick}: one rail per head (no shared seat)`
          );
          const member = byLin.map((p) => {
            const clasp = claspOf(p.note.id);
            return {
              p,
              clasp,
              common: clasp
                ? p.note.durationTicks === claspMemberCarriedTicks(clasp, p.note.id)
                : false,
            };
          });
          const allBracketed = member.every((m) => m.clasp !== undefined);
          const noneBracketed = member.every((m) => m.clasp === undefined);
          const anyException = member.some((m) => m.clasp && !m.common);
          if (noneBracketed) {
            // Legacy joint rule, untouched by §1: lowest ON, stagger right.
            kinds.jointPair++;
            assert.equal(byLin.length, 2, `${name} t${tick}: joint rows are pairs`);
            assert.ok(Math.abs(byLin[0].x - col) < 1e-9, `${name} t${tick}: joint lower ON`);
            assert.ok(
              Math.abs(byLin[1].x - (col + PAIR_GAP)) < 1e-9,
              `${name} t${tick}: joint higher +G`
            );
          } else if (allBracketed && !anyException) {
            // One clasp only: a cross-clasp common row would need its own rule.
            const clasps = new Set(member.map((m) => m.clasp));
            assert.equal(clasps.size, 1, `${name} t${tick}: common rows share one clasp`);
            if (byLin.length === 2) {
              kinds.ordinaryPair++;
              const dx0 = byLin[0].x - col;
              const dx1 = byLin[1].x - col;
              assert.ok(
                Math.abs(dx1 - dx0 - PAIR_GAP) < 1e-9,
                `${name} t${tick}: ordinary pair spans one gap (compact adjacent)`
              );
              assert.ok(
                Math.abs(dx0) < 1e-9 || Math.abs(dx0 + PAIR_GAP) < 1e-9,
                `${name} t${tick}: ordinary lower CENTER or LEFT`
              );
            } else {
              // True clique: the only feasible three-rail pattern.
              kinds.cliqueTriple++;
              assert.equal(byLin.length, 3, `${name} t${tick}: common rows are pairs or triples`);
              for (const [i, dx] of [-PAIR_GAP, 0, PAIR_GAP].entries()) {
                assert.ok(
                  Math.abs(byLin[i].x - (col + dx)) < 1e-9,
                  `${name} t${tick}: clique member ${i} on its rail`
                );
              }
            }
          } else if (!allBracketed && !noneBracketed && !anyException) {
            // Mixed row: the unbracketed head holds the column (it seats
            // first); the bracketed member staggers off it — same-row masks
            // can never share the column.
            kinds.mixed++;
            for (const m of member) {
              if (!m.clasp) {
                assert.ok(
                  Math.abs(m.p.x - col) < 1e-9,
                  `${name} t${tick}: mixed-row unbracketed head ON`
                );
              } else {
                assert.ok(
                  Math.abs(m.p.x - col) > 1e-9,
                  `${name} t${tick}: mixed-row member staggers off the column`
                );
              }
            }
          } else {
            // Exception row: rails + separation (asserted above); precedence
            // correctness lives in the solver unit tests and literals.
            kinds.exception++;
          }
        }
      }
    }
    assert.ok(singletons > 100, `${name} carries clear heads (${singletons})`);
    if (name === 'Brahms') {
      // Round 45: the m. 66 RH→LH correction makes the t12552/t12576 A2 and
      // D3 reattacks same-hand pairs, so two more rows seat as exceptions
      // (was 50 rows / 12 exceptions on the landed Round 44 source).
      assert.equal(slotted, 52, `Brahms carries its fifty-two slotted rows (${slotted})`);
      assert.deepEqual(
        kinds,
        { ordinaryPair: 22, cliqueTriple: 4, jointPair: 8, mixed: 4, exception: 14 },
        'the fifty-two rows split 22/4/8/4/14 by seating kind'
      );
      assert.equal(
        offColumnSingletons,
        12,
        `twelve exception singletons take a side rail (${offColumnSingletons})`
      );
    } else {
      assert.equal(slotted, 8, `Bach carries its eight cross-hand pairs (${slotted})`);
      assert.deepEqual(
        kinds,
        { ordinaryPair: 0, cliqueTriple: 0, jointPair: 8, mixed: 0, exception: 0 },
        'all eight Bach rows are unbracketed joint pairs'
      );
      assert.equal(offColumnSingletons, 0, 'no Bach singleton leaves the column');
    }
  }
});

test('An even cluster coincides: equal-count rows share their middle exactly', () => {
  const byTick = onsetsByTick(layoutJankoScore(BACH, BACH_OPTIONS, T));
  let evenPairs = 0;
  for (const [tick, heads] of byTick) {
    const rows = new Map<number, number[]>();
    for (const p of heads.values()) {
      const key = Math.round(p.y * 1000);
      rows.set(key, [...(rows.get(key) ?? []), p.x]);
    }
    if (rows.size < 2) continue;
    const middles = [...rows.values()].map((xs) => (Math.min(...xs) + Math.max(...xs)) / 2);
    assert.ok(
      middles.every((m) => Math.abs(m - middles[0]) < 1e-6),
      `t${tick}: even rows stay aligned`
    );
    evenPairs++;
  }
  assert.ok(evenPairs > 0, 'Bach has multi-row onsets to check');
});

test('Slots report their cells: demands diagnosed, legitimate shifts fit, no crossings', () => {
  for (const [label, score, options, tokens] of [
    ['Bach', BACH, BACH_OPTIONS, T],
    ['Brahms', BRAHMS, BRAHMS_OPTIONS, BRAHMS_T],
  ] as const) {
    const layouts = layoutJankoScore(score, options, tokens);
    const report = lintJankoScore(score, options, tokens);
    // Coherence: the solver's space-demand report names every onset whose
    // desired slots leave the beat cell; legitimate rigid shifts then fit
    // them — nothing crosses silently, and nothing is shrunk, mirrored or
    // tucked to hide the demand.
    const diags = layouts.flatMap((l) => l.clusterDiagnostics ?? []);
    const diagTicks = new Set(diags.map((d) => d.tick));
    const crossings = report.violations.filter((v) => v.code === 'grid-crossing-offset');
    assert.equal(crossings.length, 0, `${label}: legitimate shifts fit every slot, zero crossings`);
    for (const v of crossings) {
      const tick = layouts
        .flatMap((l) => l.notes)
        .find((p) => p.note.id === v.noteIds![0])!.note.startTick;
      assert.ok(diagTicks.has(tick), `${label}: the t${tick} crossing was diagnosed by the solve`);
    }
    if (label === 'Bach') {
      // The five downbeat joint pairs used to desire one slot inward of
      // their cell edge (the old fake inward demand); with the lowest head
      // ON the column every Bach pair desires inside its cell — zero
      // diagnostics is the honest report, clean ink on the page.
      assert.equal(diags.length, 0, 'Bach adaptive: no demand anywhere');
    }
    // The absolute baselines (Bach GOLD 0/0, Brahms adaptive residual-2)
    // live in test/janko-goldberg-frozen.test.ts and the ergonomics lint
    // record.
  }
});

// ---------------------------------------------------------------------------
// 3. Overlap-conditional unification
// ---------------------------------------------------------------------------

test('Per-hand brackets at interlocking onsets: m. 46 and m. 26 bracket the qualifying RH only', () => {
  const layouts = layoutJankoScore(BRAHMS, BRAHMS_OPTIONS, BRAHMS_ROUND44_RESERVE_TOKENS);
  // The retired 3-up frames, for the relative-invariance proof below.
  const layouts3 = layoutJankoScore(
    BRAHMS,
    { ...BRAHMS_OPTIONS, systemsPerPage: 3 },
    BRAHMS_ROUND44_RESERVE_TOKENS
  );
  // Unification needs two INDEPENDENTLY qualifying hands (§2 line 19). Each
  // onset's LH pair is a clean 2-note column (no spread, under 3 heads) that
  // never qualifies on its own — its old spread was a joint-bucket artifact
  // of the retired any-qualified inward rule (the RH joint partner dragged
  // it inward). The RH hand brackets alone; the LH pair takes the gap-gated
  // vertical grammar (wide leap + bridge), never a bracket.
  for (const [tick, top, bot, mid, lhCarrier, lhSuppressed] of [
    // m. 46 (sys 11, slot 3): RH bracket top keeps the old unified top
    // (the RH topmost was the onset topmost); the bottom is the RH reach.
    [M46, 651.62, 706.22, 678.92, 'brahms-op118-no1-632', 'brahms-op118-no1-633'],
    // m. 26 (sys 6, slot 2): same per-hand shape in its frame.
    [M26, 467.64, 522.24, 494.94, 'brahms-op118-no1-346', 'brahms-op118-no1-347'],
  ] as const) {
    const system = layouts.find((l) => l.notes.some((p) => p.note.startTick === tick))!;
    const clasps = system.clasps.filter((c) => c.tick === tick);
    assert.equal(clasps.length, 1, `t${tick}: exactly one bracket`);
    const clasp = clasps[0];
    assert.equal(clasp.notes.length, 4, `t${tick}: the four RH heads are members`);
    assert.deepEqual(
      [...new Set(clasp.notes.map((n) => n.hand))],
      ['RH'],
      `t${tick}: strictly the qualifying hand`
    );
    assert.equal(Number(clasp.topY.toFixed(2)), top, `t${tick}: the RH bracket top`);
    assert.equal(Number(clasp.botY.toFixed(2)), bot, `t${tick}: the RH bracket bottom`);
    // The 96-mode pip ring sits at the RH bracket's own midpoint.
    const open = clasp.durationInk.filter((ink) => ink.pips > 0);
    assert.equal(open.length, 1, `t${tick}: one open duration group`);
    assert.equal(Number(open[0].centerY.toFixed(2)), mid, `t${tick}: the ring sits at the RH midpoint`);
    // The bracket carries the mode (96); the 120 member is the exception.
    assert.equal(clasp.durationTicks, 96, `t${tick}: the carried mode`);
    const exception = clasp.notes.find((n) => n.durationTicks === 120)!;
    assert.ok(exception, `t${tick}: the 120 exception is a member`);
    assert.ok(
      !system.claspedStems.includes(exception.id),
      `t${tick}: the exception keeps its exact stem`
    );
    // The clean LH pair is never bracketed — the gap-gated grammar unifies
    // it instead (down-stem carrier at the bottom, one wide-leap bridge).
    const lh = system.verticalChords.find((c) => c.carrier.startTick === tick);
    assert.ok(lh, `t${tick}: the LH pair takes the gap-gated grammar`);
    assert.equal(lh!.carrier.id, lhCarrier, `t${tick}: the bottommost LH head carries`);
    assert.deepEqual(lh!.suppressedIds, [lhSuppressed], `t${tick}: the upper LH head joins it`);
    assert.equal(lh!.bridges.length, 1, `t${tick}: the 30pt leap earns its bridge`);
    // Proof the flip moved only the frame: the bracket's seat relative to
    // its own system middle is identical at 3-up and 4-up (float dust only).
    const system3 = layouts3.find((l) => l.notes.some((p) => p.note.startTick === tick))!;
    const clasp3 = system3.clasps.filter((c) => c.tick === tick)[0];
    assert.ok(
      Math.abs(
        clasp.topY - system.geometry.middleCY - (clasp3.topY - system3.geometry.middleCY)
      ) < 1e-9,
      `t${tick}: bracket top is frame-relative identical`
    );
    assert.ok(
      Math.abs(
        clasp.botY - system.geometry.middleCY - (clasp3.botY - system3.geometry.middleCY)
      ) < 1e-9,
      `t${tick}: bracket bottom is frame-relative identical`
    );
  }
});

test('A gapped onset keeps Round 6 per-hand brackets: the m. 3 guard', () => {
  const layouts = layoutJankoScore(BRAHMS, BRAHMS_OPTIONS, BRAHMS_ROUND44_RESERVE_TOKENS);
  const system = layouts.find((l) => l.notes.some((p) => p.note.startTick === M3))!;
  const clasps = system.clasps.filter((c) => c.tick === M3);
  assert.equal(clasps.length, 1, 'the 90pt hand gap stays split');
  assert.deepEqual(
    [...new Set(clasps[0].notes.map((n) => n.hand))],
    ['RH'],
    'only the three-note RH chord is bracketed'
  );
  assert.equal(clasps[0].notes.length, 3);
  // The 90pt hand gap keeps the brackets split: the m.3 bracket stands alone,
  // never one unified span (the retired anchor axis was inert on this
  // window). System 0 carries the m.3 bracket plus the m.1 tick-48 bracket —
  // the true-ink pre-step (§2) makes the barline room the packing-only audit
  // could not see, so 48 is admitted instead of silently dropped.
  assert.deepEqual(
    layouts[0].clasps.map((c) => c.tick),
    [48, M3],
    'sys0 carries the m.3 and the admitted m.1 brackets'
  );
  const m3Svg = renderSystem(BRAHMS, layouts[0].geometry, 0, resolveJankoOptions(BRAHMS_OPTIONS), BRAHMS_T, layouts[0]);
  assert.equal((m3Svg.match(/class="janko-clasp"/g) ?? []).length, 2, 'both sys0 brackets paint');
});

test('A unified bracket paints one duration group per hand', () => {
  // RH pair on one row, LH pair on the adjacent row, overlapping spans, both
  // 8th notes: one bracket, two transverse duration groups — one per hand's
  // own vertical centre.
  const score = makeScore([
    makeNote('rh-0', 0, 4, 0, 24, 'RH'),
    makeNote('rh-4', 4, 4, 0, 24, 'RH'),
    makeNote('lh-2', 2, 4, 0, 24, 'LH'),
    makeNote('lh-6', 6, 4, 0, 24, 'LH'),
  ]);
  const layout = layoutJankoScore(score, BACH_OPTIONS, T)[0];
  assert.equal(layout.clasps.length, 1, 'one unified bracket');
  const clasp = layout.clasps[0];
  assert.equal(clasp.notes.length, 4);
  assert.equal(clasp.durationInk.length, 2, 'one duration group per hand');
  assert.deepEqual(
    clasp.durationInk.map((i) => i.flags),
    [1, 1],
    'both hands carry their 8th-note subdivision mark'
  );
  const rhY = layout.notes.filter((p) => p.rhythm.hand === 'RH').map((p) => p.y);
  const lhY = layout.notes.filter((p) => p.rhythm.hand === 'LH').map((p) => p.y);
  const centres = clasp.durationInk.map((i) => i.centerY).sort((a, b) => a - b);
  assert.equal(centres[0], (Math.min(...rhY) + Math.max(...rhY)) / 2, 'RH mark at the RH centre');
  assert.equal(centres[1], (Math.min(...lhY) + Math.max(...lhY)) / 2, 'LH mark at the LH centre');
  assert.equal(clasp.durationTicks, 24, 'the carried value is the shortest member');
});

// ---------------------------------------------------------------------------
// 4. The anchor axis
// ---------------------------------------------------------------------------

test('The mixed row resolves {0, +G} against the same-hand {0, +G}', () => {
  const rh = onset(layoutJankoScore(BRAHMS, BRAHMS_OPTIONS, BRAHMS_ROUND44_RESERVE_TOKENS), M46);
  // Compact seating: the mixed-hand row's unbracketed lower head — D4 (LH)
  // — holds the column and the bracketed G#4 (RH) staggers right off it,
  // while the same-hand bracketed pair (F4/B4) seats lower CENTER / higher
  // RIGHT. Same lowest-first order; the heads meet on the shared rails.
  assert.equal(rh.get('brahms-op118-no1-633')!.x.toFixed(2), '187.53');
  assert.equal(rh.get('brahms-op118-no1-635')!.x.toFixed(2), '192.99');
  assert.equal(rh.get('brahms-op118-no1-635')!.x, rh.get('brahms-op118-no1-636')!.x);
  assert.equal(
    (rh.get('brahms-op118-no1-636')!.x - rh.get('brahms-op118-no1-633')!.x).toFixed(2),
    '5.46'
  );
  // No tuck: F5/D3 stand on the column with the mixed row's lower head.
  assert.equal(rh.get('brahms-op118-no1-637')!.x.toFixed(2), '187.53');
  assert.equal(rh.get('brahms-op118-no1-632')!.x.toFixed(2), '187.53');
});

test('Per-hand brackets own their member stems: no stem-through at m. 46/m. 26', () => {
  // The RH bracket replaces its carried members' stems (the 120 exception
  // keeps a stem that clears upward, away from the column), and the LH pair
  // takes the gap-gated grammar (one carrier stem, one suppressed head) — so
  // no stem can pierce a fellow onset member at m. 46 or m. 26.
  const report = lintJankoScore(BRAHMS, BRAHMS_OPTIONS, BRAHMS_ROUND44_RESERVE_TOKENS);
  const layouts = layoutJankoScore(BRAHMS, BRAHMS_OPTIONS, BRAHMS_ROUND44_RESERVE_TOKENS);
  const members = new Set(
    layouts
      .flatMap((l) => l.clasps)
      .filter((c) => c.tick === M46 || c.tick === M26)
      .flatMap((c) => c.notes.map((n) => n.id))
  );
  assert.ok(members.size === 8, 'both per-hand brackets span their four RH heads');
  // The whole onsets (bracket members plus the gap-gated LH pairs) stay
  // stem-clean.
  const onsetIds = new Set(
    layouts
      .flatMap((l) => l.notes)
      .filter((p) => p.note.startTick === M46 || p.note.startTick === M26)
      .map((p) => p.note.id)
  );
  const piercing = report.violations.filter(
    (v) =>
      v.code === 'stem-through-simultaneity' && (v.noteIds ?? []).some((id) => onsetIds.has(id))
  );
  assert.deepEqual(
    piercing.map((v) => v.noteIds),
    [],
    'no stem pierces an m.46/m.26 onset member'
  );
});

// ---------------------------------------------------------------------------
// 4. The beat grid follows the columns
// ---------------------------------------------------------------------------

/** Rendered x of every dashed beat pulse of one system, in painting order. */
function pulsesOf(score: QuantizedGridScore, layouts: ReturnType<typeof layoutJankoScore>, index: number, options: typeof DEFAULT_JANKO_OPTIONS, tokens: typeof T) {
  const system = layouts[index];
  const svg = renderSystem(score, system.geometry, index, options, tokens, system);
  return [...svg.matchAll(/class="janko-beat-line" x1="([\d.]+)"/g)].map((m) => Number(m[1]));
}

test('m. 3’s pulses move onto their own note columns', () => {
  const options = resolveJankoOptions(BRAHMS_ROUND44_RESERVE_OPTIONS);
  const layouts = layoutJankoScore(BRAHMS, BRAHMS_ROUND44_RESERVE_OPTIONS, BRAHMS_ROUND44_RESERVE_TOKENS);
  const pulses = pulsesOf(BRAHMS, layouts, 0, options, BRAHMS_T);
  // Brahms is cut time: 4 pulses per measure, 3 dashed lines each. System 0 is
  // the anacrusis + mm. 1–4, so m. 3's pulses are indices 6–8.
  const m3 = pulses.slice(6, 9).map((x) => Number(x.toFixed(2)));
  assert.deepEqual(m3, [362.29, 390.66, 419.03], 'the dotted quarter lines follow the columns');
  // The pre-Round-19 grid drew m. 3's pulses proportionally inside the
  // anacrusis system's third cell (after the 48-tick upbeat), 7.80 / 7.20 /
  // 6.60pt left of their own note columns (was 8.52 / 7.68 / 6.84 — §2's
  // shrunk downbeat insets redistribute the system width leftwards).
  const g = layouts[0].geometry;
  const inset = getGridNoteInset(options, BRAHMS_T);
  const upbeat = (BRAHMS_T.anacrusisTicks! / BRAHMS_T.ticksPerMeasure) * g.measureWidth;
  const proportional = [1, 2, 3].map(
    (b) => g.staffLeft + upbeat + 2 * g.measureWidth + inset + (b / 4) * (g.measureWidth - 2 * inset)
  );
  assert.deepEqual(
    m3.map((x, i) => Number((x - proportional[i]).toFixed(2))),
    [7.8, 7.2, 6.6],
    'the ticket’s measured left-drift is gone'
  );
  // The m. 3 pair's bracket spine (claspX = leftmost head − r − claspOffset)
  // now clears its own pulse by the whole disc + bracket air (~7.6pt), instead
  // of landing 0.76pt left of it.
  const lastBeat = layouts[0].notes.filter((p) => p.note.startTick === 576);
  const spine =
    Math.min(...lastBeat.map((p) => p.x)) - BRAHMS_T.noteheadRadius - BRAHMS_T.claspOffset;
  assert.ok(m3[2] - spine > 7, `the spine clears its pulse by ${(m3[2] - spine).toFixed(2)}pt`);
});

test('The anacrusis system maps its pulses to the right measures', () => {
  const options = resolveJankoOptions(BRAHMS_ROUND44_RESERVE_OPTIONS);
  const layouts = layoutJankoScore(BRAHMS, BRAHMS_ROUND44_RESERVE_OPTIONS, BRAHMS_ROUND44_RESERVE_TOKENS);
  const system = layouts[0];
  const pulses = pulsesOf(BRAHMS, layouts, 0, options, BRAHMS_T);
  // System 0 opens on the 48-tick upbeat, so its first cell is m. 1 (tick 48):
  // beats 2–4 of m. 1 stand at ticks 96 / 144 / 192.
  for (const [i, tick] of [96, 144, 192].entries()) {
    const column = system.columns.get(tick);
    assert.ok(column !== undefined, `tick ${tick} carries an onset`);
    assert.equal(Number(pulses[i].toFixed(2)), Number(column!.toFixed(2)), `pulse ${i} = t${tick}`);
  }
});

test('An empty beat keeps the proportional line', () => {
  const options = resolveJankoOptions(BRAHMS_ROUND44_RESERVE_OPTIONS);
  const layouts = layoutJankoScore(BRAHMS, BRAHMS_ROUND44_RESERVE_OPTIONS, BRAHMS_ROUND44_RESERVE_TOKENS);
  // System 15 (Brahms mm. 61–64) has no onset on its first beat's pulse (tick 11616).
  const system = layouts[15];
  assert.equal(system.columns.has(11616), false, 'tick 11616 is empty');
  const pulses = pulsesOf(BRAHMS, layouts, 15, options, BRAHMS_T);
  const inset = getGridNoteInset(options, BRAHMS_T);
  const proportional =
    system.geometry.staffLeft + inset + (1 / 4) * (system.geometry.measureWidth - 2 * inset);
  assert.equal(Number(pulses[0].toFixed(2)), Number(proportional.toFixed(2)), 'proportional line');
});

test('Pulses never borrow a neighbour: each stands 10pt+ from every wrong column', () => {
  // The strong negative behind the pulse pins: a pulse shifted onto the
  // wrong head's column would have to jump a full beat cell (~28pt on
  // Brahms system 0). Every rendered pulse's nearest occupied column is its
  // own beat's (exact), and the next-nearest is over 10pt away — a mix-up
  // cannot hide in float dust.
  const options = resolveJankoOptions(BRAHMS_ROUND44_RESERVE_OPTIONS);
  const layouts = layoutJankoScore(BRAHMS, BRAHMS_ROUND44_RESERVE_OPTIONS, BRAHMS_T);
  const system = layouts[0];
  const pulses = pulsesOf(BRAHMS, layouts, 0, options, BRAHMS_T);
  const columns = [...system.columns.values()];
  assert.ok(pulses.length > 0 && columns.length > 0);
  // Occupied pulses only (empty beats stand proportionally by design).
  const occupied = pulses.filter((pulse) => columns.some((c) => Math.abs(c - pulse) < 0.01));
  assert.ok(occupied.length > 0, 'system 0 carries occupied pulses');
  for (const pulse of occupied) {
    const gaps = columns.map((c) => Math.abs(c - pulse)).sort((a, b) => a - b);
    assert.ok(gaps[0] < 0.01, `pulse ${pulse.toFixed(2)} stands on its own column`);
    assert.ok(
      gaps[1] > 10,
      `pulse ${pulse.toFixed(2)} is ${gaps[1].toFixed(2)}pt from any wrong column`
    );
  }
});

test('Score-wide: every occupied pulse stands on its column, every empty one proportionally', () => {
  for (const [score, options, tokens] of [
    [BACH, DEFAULT_JANKO_OPTIONS, T],
    [BRAHMS, BRAHMS_ROUND44_RESERVE_OPTIONS, BRAHMS_T],
  ] as const) {
    const o = resolveJankoOptions(options);
    const t = resolveJankoTokens(tokens);
    const layouts = layoutJankoScore(score, options, tokens);
    const beats = Math.max(1, Math.round(t.ticksPerMeasure / t.ticksPerBeat));
    const anacrusis = t.anacrusisTicks ?? 0;
    const inset = getGridNoteInset(o, t);
    for (const [index, system] of layouts.entries()) {
      const pulses = pulsesOf(score, layouts, index, o, t);
      const expected: number[] = [];
      for (let m = 0; m < o.measuresPerSystem; m++) {
        const sys0Anacrusis = index === 0 && anacrusis > 0;
        const measureStart = sys0Anacrusis
          ? anacrusis + m * t.ticksPerMeasure
          : anacrusis + (index * o.measuresPerSystem + m) * t.ticksPerMeasure;
        for (let b = 1; b < beats; b++) {
          const tick = measureStart + b * t.ticksPerBeat;
          const proportional =
            system.geometry.staffLeft +
            m * system.geometry.measureWidth +
            inset +
            (b / beats) * (system.geometry.measureWidth - 2 * inset);
          expected.push(system.columns.get(tick) ?? proportional);
        }
      }
      assert.deepEqual(
        pulses.map((x) => Number(x.toFixed(2))),
        expected.map((x) => Number(x.toFixed(2))),
        `${score.id} system ${index}: every pulse on its beat's column`
      );
    }
  }
});
