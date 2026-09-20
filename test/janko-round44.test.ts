/**
 * Round 44 — anchored clusters + compact shared duration ink across Brahms.
 * =========================================================================
 *
 * One proposed design, judged on the **whole** Brahms score (all 71 measures as
 * genuine page spreads) plus the re-aimed focus measures (candidate only; the
 * Reference, the goldens and the PDF stay frozen):
 *
 *   - **pitch** — two-column whole-tone **parity** placement as an **anchoring**
 *     rule: only genuinely admitted bracket clusters take the two columns (even
 *     absolute-pitch family on the onset anchor, odd family one extent-derived
 *     pair pitch to its right — one family keeps every head on the anchor); a
 *     lone note, a clean column and every unbracketed group keep the
 *     established full-size lower-on-snap / upper-right fan. Admission gates
 *     placement, so a group qualification rejects never leaves a stale parity
 *     offset behind.
 *   - **duration** — **one 45-degree slash family** at the admitted cluster
 *     scale `s`: the pre-change centreline length `L0 = hypot(4.95, 1.089) =
 *     5.0683745915pt` split into equal x/y components, slash stroke `.71·s`,
 *     ring `R1.60·s` at `.59·s` stroke, minimum ink gap `g = .50·s`. The same
 *     ink (and the same centre pitch) on the vertical bracket and on the
 *     horizontal exception carrier, whose fixed length is
 *     `max(four-cut run, three-ring run) + 2g = 10.0275pt` at `s = 0.75`.
 *   - **fit** — the carrier's exact ink box (line stroke, marks, dots) is
 *     measured **before** paint: a carrier that cannot clear its protected
 *     neighbours is withheld and published (`carrier-fit-refused`), never
 *     painted-and-refused.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import { wholeToneParity } from '../src/model/pitch';
import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1';
import {
  BRAHMS_OP118_NO1_JANKO_OPTIONS,
  BRAHMS_OP118_NO1_JANKO_TOKENS,
  buildBrahmsOp118No1Score,
} from '../src/scores/brahms-op118-no1';
import {
  BRAHMS_ROUND44_RESERVE_OPTIONS,
  BRAHMS_ROUND44_RESERVE_TOKENS,
} from './brahms-round44-reserve';
import {
  DURATION_VOCABULARY_BANDS,
  DURATION_VOCABULARY_NOTES,
  DURATION_VOCABULARY_PLAIN_VALUES,
  DURATION_VOCABULARY_SPECIMEN_JANKO_OPTIONS,
  DURATION_VOCABULARY_SPECIMEN_JANKO_TOKENS,
  buildDurationVocabularySpecimenScore,
} from '../src/scores/duration-vocabulary-specimen';
import {
  PITCH_PARITY_SPECIMEN_JANKO_OPTIONS,
  PITCH_PARITY_SPECIMEN_JANKO_TOKENS,
  buildPitchParitySpecimenScore,
} from '../src/scores/pitch-parity-specimen';
import {
  DEFAULT_JANKO_OPTIONS,
  DEFAULT_JANKO_TOKENS,
  getClusterSpacingPreset,
  resolveJankoOptions,
  resolveJankoTokens,
} from '../src/render/janko/types';
import {
  countJankoPages,
  fitParityColumns,
  knockoutHalfExtents,
  layoutJankoScore,
  renderJankoCrop,
  renderJankoPage,
  suppressedStemIds,
  type JankoClusterFitMember,
  type JankoSystemLayout,
} from '../src/render/janko/engine';
import { lintJankoScore } from '../src/render/janko/linter';
import {
  CLASP_MARK_STACK_GAP,
  compactDurationMarks,
  effectiveExceptionCarrierLength,
  exceptionCarrierInkBox,
  exceptionCarrierMarkBoxes,
  midpointMetrics,
} from '../src/render/janko/elements/rhythm';
import { createStudioConfig, renderCandidatesView, renderStudioMarkup } from '../src/render/janko/studio';
import {
  BRAHMS_STUDIO_SCORE_ID,
  CURRENT_CANDIDATES,
  CURRENT_ROUND_METADATA,
  DURATION_VOCABULARY_SPECIMEN_STUDIO_SCORE_ID,
  PITCH_PARITY_SPECIMEN_STUDIO_SCORE_ID,
  brahmsWindow,
  resolveCandidate,
  type JankoCandidate,
  type JankoCandidateRound,
  type JankoCandidateWindow,
  type JankoScoreCandidateWindow,
} from '../src/render/janko/candidates';

const BACH = buildBachGoldbergVar1Score();
const BRAHMS = buildBrahmsOp118No1Score();
const PPS = buildPitchParitySpecimenScore();
const DVS = buildDurationVocabularySpecimenScore();


// ---------------------------------------------------------------------------
// Historical Round 43 registry (parked)
//
// Round 44 re-aims the reusable pitch + symbolic-duration study at the whole
// Brahms score: the parity placement is now anchored by admission and the
// duration ink is the same 45-degree family at the admitted cluster scale.
// The Round 43 cards below are frozen verbatim so the record of what was on
// the table stays intact, independent of the live registry.
// ---------------------------------------------------------------------------

export const ROUND_43_METADATA: JankoCandidateRound = {
  round: 43,
  title: 'Reusable pitch + symbolic-duration study — Round 43',
  description:
    'One proposed **midpoint** design is judged on fixed, reusable cases that stay put across later tuning: two-column whole-tone **parity** pitch placement (even family left, odd family right), and one **unified diagonal-slash** duration family painted **identically** on the shared bracket and on the horizontal exception carrier. The cut is the midpoint of the golden 7.5pt/1.0pt cut and the compact 2.4pt/0.42pt cut (4.95pt at 0.71pt stroke, page-raked 0.22 rail-so-equal rise), the ring the midpoint of the golden R2.40/0.80pt and compact R0.80/0.38pt rings (R1.60pt at 0.59pt stroke). Counts are shared with the compact study (4/3/2/1 cuts; bare; 1/2/3 rings). Only genuinely admitted bracket members take the 75 % pitch-symbol size; a clean two-note column stays full size. Every spacing and the fixed carrier length are derived from the emitted endpoints and stroke, never copied from the rejected memo. The canonical Reference, goldens and PDF are untouched. Honest whole-score candidate reports, nothing filtered: applied to the whole Brahms score this single card reports exactly two stem-through-simultaneity errors and two chordal-overlap warnings — m. 33 (brahms-op118-no1-445/444) and m. 53 (brahms-op118-no1-731/730) — the pre-existing LH fold-coincident octave-pair folding findings scheduled for a future round, both OFF this round’s displayed windows and NOT Round-43 regressions; plus six carrier-duration-unsupported refusals for the 120-tick tie-composite exceptions (brahms-op118-no1-295 m. 22, 351 m. 26, 448 m. 33, 581 m. 42, 637 m. 46, 734 m. 53). The composites 120 = 96 + 24, 504 = 192 + 192 + 96 + 24 and 108 = 96 + 12 have no exact reading in this alphabet: no carrier is painted for them (a mark-less carrier would read as a bare quarter) and each member keeps its own ordinary duration ink, which does NOT state the composite exactly — a published limitation, not a solution. Applied to the duration-vocabulary specimen the same card reports the deliberately tight m. 33 stress row as a LABELLED failed-fit / capacity counterexample: the published grid-crossing-offset (head dvs-stress-12300-9_5 pushed past its beat cell) and the new carrier-mark-occlusion findings (the next-onset dyad’s erasure mask destroys the whole-value rings of dvs-stress-12288-9_5, the first ring almost entirely). The pitch-parity specimen is clean. Every whole-score report is listed in full and none is suppressed; no candidate card is claimed clean.',
  openAxes: ['pitchPlacement', 'bracketDurationGrammar', 'exceptionCarrier'],
};

/** Round 43 window spans on the duration-vocabulary specimen (the duration key + exceptions + stress). */
const ROUND_43_SPECIMEN = {
  bracketKey: { measureStart: 17, measureCount: 8 },
  exception: { measureStart: 25, measureCount: 8 },
  stress: { measureStart: 33, measureCount: 2 },
} as const;

/** A Round 43 window on the duration-vocabulary specimen. */
function round43Specimen(
  span: { measureStart: number; measureCount: number },
  title: string,
  caption: string
): JankoScoreCandidateWindow {
  return {
    kind: 'score',
    scoreId: DURATION_VOCABULARY_SPECIMEN_STUDIO_SCORE_ID,
    measureStart: span.measureStart,
    measureCount: span.measureCount,
    title,
    caption,
  };
}

/**
 * Round 43 — the fixed, reusable case set: seven authentic Brahms windows for
 * the pitch columns and the duration vocabulary, the duration-vocabulary
 * specimen's key / exception / stress bands, and the pitch-parity specimen's
 * 1-span / 2-span / octave / next-onset rows. Every window states one reading
 * question with its labels (ordinary duration names and duodecimal pitch/spans)
 * directly associated.
 */
function round43Windows(): JankoCandidateWindow[] {
  return [
    brahmsWindow(
      5,
      1,
      'Brahms m. 5 · uniform triad — both parity columns',
      'The RH downbeat triad 4/4 · 4/5 · 9/4 (all 96-tick): 4/4 and its 10-span repeat 4/5 are both even, so they share the left parity column 30.0pt apart, while the odd 9/4 takes the right column — one bracket, one value (one ring), both columns read at a glance.'
    ),
    brahmsWindow(
      7,
      1,
      'Brahms m. 7 · dense five-note column — both columns',
      'The RH downbeat 2/4 · 5/4 · 9/3 · 9/4 · b/3 (all 96-tick) is the densest onset: its members split across both parity columns by absolute pitch parity, the odd family stacked on the right and the lone even 2/4 on the left, under one shared 96-tick bracket (one ring).'
    ),
    brahmsWindow(
      8,
      1,
      'Brahms m. 8 · one-column 2-span pairs, 10-span repeats, second-onset exception',
      'The RH downbeat 5/3 · 5/4 · 7/3 · 7/4 · b/3 is ALL odd, so every member shares one parity column: the 2-span neighbours (5/3→7/3, 5/4→7/4) sit 5.0pt apart and the 10-span repeats (5/3→5/4) 30.0pt apart. At the second onset the b/3 states 48 (a quarter) against its bracket’s carried 96 — a genuine exception, and a quarter’s carrier is deliberately bare (it paints no mark at all). Because it is bare it loses no value ink: the fixed run reaches about 1.4pt into the next onset’s erasure mask (20.49pt of 21.91pt free before it), a tail occlusion of a mark-less carrier — a published shortfall, not an unreadable row.'
    ),
    brahmsWindow(
      9,
      1,
      'Brahms m. 9 · multiple exceptions on one column',
      'The RH downbeat 5/3 · 5/4 · 7/3 · 7/4 · b/3 (all odd, one column) states 144 · 192 · 144 · 192 · 144: the two 192-tick members are exceptions against the carried 144, each stating its own value with the compact counts (2 rings) on its own carrier, so a single chord owns two exceptions without moving a pitch.'
    ),
    brahmsWindow(
      35,
      2,
      'Brahms mm. 35–36 · transposed related triads (source-verified)',
      'Literal source check: m. 35’s RH triad 7/4 · 7/5 · 0/5 is exactly m. 5’s 4/4 · 4/5 · 9/4 transposed up 3 semitones (same shape, both parity columns, one 96-tick value); m. 36 restates the SAME m. 5 shape one step off, its middle member raised a 1-span (4/4 · a/4 · 4/5) — the same reading, re-spelled.'
    ),
    brahmsWindow(
      37,
      1,
      'Brahms m. 37 · exception ownership on one column',
      'The RH downbeat 0/4 · 0/5 · 6/4 (all even, one parity column) states 96 · 96 · 48: the 48-tick 6/4 is the exception against the bracket’s carried 96, and the carrier’s own marks — not its fixed length — state that value. The second onset restates the reading (b/3 · 2/4 · 8/4 · b/4), its own 48-tick 2/4 the second quarter exception against the carried 96 — so m. 37 owns TWO quarter exceptions, one bare carrier each, on their own columns. Single-note ownership: the pitch symbol never moves.'
    ),
    brahmsWindow(
      67,
      1,
      'Brahms m. 67 · long-value exception, 3 rings',
      'The RH downbeat 0/4 · 0/5 · 5/4 splits across both parity columns (even 0/4, 0/5; odd 5/4) and states 288 · 288 · 384: the 384-tick member is the exception against the carried 288 (dotted whole) and reads as three elongation rings in the compact counts.'
    ),
    round43Specimen(
      ROUND_43_SPECIMEN.bracketKey,
      'Duration key · specimen mm. 17–24 — all eight plain values on the bracket',
      'Read left to right 3 · 6 · 12 · 24 · 48 · 96 · 192 · 384 (64th · 32nd · 16th · 8th · quarter · half · whole · double-whole) as the direct value-to-ink key: 4/3/2/1 cuts, a bare quarter, then 1/2/3 rings — every plain value distinct on one bracket, cut 4.95pt × 0.71pt, ring R1.60pt × 0.59pt.'
    ),
    round43Specimen(
      ROUND_43_SPECIMEN.exception,
      'Exception carriers · specimen mm. 25–32 — every plain value as an exception',
      'Each row’s top member states a different value from its bracket’s carried one, so all eight 3 · 6 · 12 · 24 · 48 · 96 · 192 · 384 appear as genuine exceptions. Each carrier is the SAME diagonal slash and ring as the bracket, stacked along a fixed 21.91pt carrier whose length never states the value or a release — the marks do.'
    ),
    round43Specimen(
      ROUND_43_SPECIMEN.stress,
      'FAILED-FIT · stress · specimen mm. 33–34 — fixed-carrier capacity ceiling, not a readable engraving',
      'FAILED-FIT / capacity counterexample — kept to mark the fixed carrier’s limit, NOT shown as a readable engraving and NOT proposed as notation. m. 33: the 192-tick top exception’s fixed 21.91pt carrier runs into the next onset only a 16th later, and that later dyad’s white erasure mask knocks out the carrier’s marks: the first of the two whole-value rings is almost entirely wiped out (only its left rim survives — about 86% of the ring’s box, ≈93% of its diameter) and the second ring is eaten into, so the whole-note 192 the rings state is destroyed on the page. The same next-onset pressure fans the dyad’s upper 16th head (pitch 9/5) past its beat cell’s right grid line — head at x = 55.18 against the cell edge x = 53.28 — crossing out of its 16th-note cell into the next one (the published grid-crossing-offset). m. 34 is clean: two exceptions of different values (192 and 6) in one chord, the 192 sitting on the lin-60 octave-line rule. Both m. 33 findings are published, never hidden; this row is the capacity ceiling of a fixed-length carrier, not a readable value.'
    ),
    {
      kind: 'score',
      scoreId: PITCH_PARITY_SPECIMEN_STUDIO_SCORE_ID,
      measureStart: 1,
      measureCount: 4,
      title: 'Pitch parity specimen · mm. 1–4 — 1-span, 2-span, octave repeat, next onset',
      caption:
        'm. 1: the 1-span pair 4/4 · 5/4 is one even + one odd, so the two notes take OPPOSITE parity columns — genuinely spread, so it is admitted to a bracket and its two heads take 0.75. m. 2: the 2-span pair 4/4 · 6/4 is both even, so it takes ONE column 5.0pt apart — a clean two-note column, NOT admitted, so both heads stay full size with the established fan. m. 3: the 10-span repeat 4/5 re-takes 4/4’s own column 30.0pt away. m. 4: a 1-span dyad (opposite columns → admitted, 0.75) with a lone note on the very next onset (full size).'
    },
  ];
}

/**
 * Round 43 — one proposed **midpoint** design (no obligatory current control;
 * the Reference already supplies the incumbent).
 *
 * The single card states the round's whole design as one coherent family:
 *
 * - **pitch** — two-column whole-tone parity (`pitchPlacement: 'parity-columns'`);
 * - **duration** — the unified diagonal-slash family (`bracketDurationGrammar:
 *   'midpoint'`) at midpoint dimensions, painted identically on the bracket and
 *   on the fixed-length horizontal exception carrier (`exceptionCarrier:
 *   'horizontal'`);
 * - **size** — 0.75 for genuinely admitted bracket members only
 *   (`chordSymbolScale: 0.75`); clean dyads and lone notes stay full size.
 */
export const ROUND_43_CANDIDATES: JankoCandidate[] = [
  {
    id: 'midpoint-parity',
    label: 'Midpoint design — two-column pitch + unified diagonal-slash duration',
    description:
      'Two-column whole-tone parity pitch placement with the unified midpoint diagonal-slash duration family: 4/3/2/1 cuts (4.95pt × 0.71pt, page-raked 0.22), a bare quarter, then 1/2/3 rings (R1.60pt × 0.59pt), identical on the bracket and on the fixed 21.91pt horizontal exception carrier. Only genuinely admitted bracket members take 0.75 (a spread 1-span pair qualifies; a clean 2-span column stays full size).',
    options: {
      pitchPlacement: 'parity-columns',
      chordSymbolScale: 0.75,
      bracketDurationGrammar: 'midpoint',
      exceptionCarrier: 'horizontal',
    },
    windows: round43Windows(),
    tags: ['brahms', 'specimen', 'pitch', 'duration', 'midpoint'],
  },
];

// ---------------------------------------------------------------------------
// Historical Round 44 registry (parked)
//
// Round 45 opens the larger-readable-clusters round on the working Brahms
// Reference: three full-score cards at 0.85 / 0.90 / 0.95 beside the adopted
// 0.90 Reference, with declared centred optical spacing, the Round 45 duration
// ratios, horizontal cluster carriers, literal low pitches and the m. 66 hand
// correction. The Round 44 card below is frozen verbatim so the record of what
// was on the table stays intact, independent of the live registry, and the
// historical fixtures in this file read the Round 44 reserve surface
// (`test/brahms-round44-reserve.ts`) rather than the moving Reference.
// ---------------------------------------------------------------------------
export const ROUND_44_METADATA: JankoCandidateRound = {
  round: 44,
  title: 'Anchored clusters + compact shared duration ink — Round 44',
  description:
    'One proposed design, judged on the whole Brahms score plus the re-aimed focus measures. **Pitch:** the two-column whole-tone **parity** placement is now an **anchoring** rule — only genuinely admitted bracket clusters take the two columns (even absolute pitch family left, odd right, pair pitch from the cluster’s own admitted symbol extents); a ONE-family cluster occupies its anchor column and reserves no invisible empty column, and every ordinary/lone/unbracketed group keeps the established full-size lower-on-snap / upper-right collision fan. **Duration:** one **45-degree** slash family (the pre-change centreline length L0 = hypot(4.95, 1.089) = 5.0683745915pt split into equal x/y components, then scaled by the admitted cluster scale s), slash stroke 0.71·s, ring R1.60·s at 0.59·s, minimum ink gap g = 0.50·s — identical ink and identical centre pitch on the vertical bracket and on the horizontal exception carrier, whose fixed length is max(four-cut run, three-ring run) + 2g (10.0275pt at s = 0.75). Every duration mark is engraved at the admitted cluster’s own 0.75, so the marks shrink with the numerals. The carrier fit is decided **before** painting from the exact ink box (line stroke, marks, dots): a carrier that cannot clear its neighbours is withheld and published (`carrier-fit-refused`), never painted-and-refused. **Whole-score review:** all 71 Brahms measures are shown as genuine separate score pages. Honest whole-score report, nothing filtered: **zero hard errors** (the two former m. 33 / m. 53 stem-through-simultaneity findings are gone because their fold-coincident LH octave pair — an unadmitted group — now takes the established literal fan instead of stale parity offsets); **six** `carrier-duration-unsupported` warnings for the 120-tick tie composites (brahms-op118-no1-295 m. 22, 351 m. 26, 448 m. 33, 581 m. 42, 637 m. 46, 734 m. 53), which have no exact reading in this alphabet: no carrier is painted for them (a mark-less carrier would read as a bare quarter) and each member keeps its own ordinary duration ink, which does NOT state the composite exactly — a published limitation, not a solution. **Zero** carrier fit refusals remain on the score (all seven former 21.91pt fit refusals now fit at 10.03pt); **zero** carrier-mark occlusions. The composites 120 = 96 + 24, 504 = 192 + 192 + 96 + 24 and 108 = 96 + 12 stay explicit blockers to golden adoption. The canonical Reference, goldens and PDF are untouched; the synthetic windows survive only as the compact labelled key for the short values the corpus never states.',
  openAxes: ['pitchPlacement', 'bracketDurationGrammar', 'exceptionCarrier'],
};


/** Round 44 window spans on the duration-vocabulary specimen (the compact key band). */
const ROUND_44_SPECIMEN = {
  key: { measureStart: 17, measureCount: 8 },
} as const;

/** A Round 44 window on the duration-vocabulary specimen (the compact key). */
function round44Specimen(
  span: { measureStart: number; measureCount: number },
  title: string,
  caption: string
): JankoScoreCandidateWindow {
  return {
    kind: 'score',
    scoreId: DURATION_VOCABULARY_SPECIMEN_STUDIO_SCORE_ID,
    measureStart: span.measureStart,
    measureCount: span.measureCount,
    title,
    caption,
  };
}

/**
 * Round 44 — the review set: the whole Brahms score as genuine pages, then the
 * fixed focus measures the operator named (m. 5 for the LH symbol‑5 seat, mm.
 * 7–9 for the B/0 relationships and the first carrier marks, mm. 35–37 for the
 * transposition and measure-start alignment, m. 67 for the three-ring value),
 * then one compact labelled key for the short values the corpus never states.
 * No rejected stress row is carried forward.
 */
function round44Windows(): JankoCandidateWindow[] {
  return [
    {
      kind: 'score',
      scoreId: BRAHMS_STUDIO_SCORE_ID,
      measureStart: 1,
      measureCount: 71,
      fullScore: true,
      title: 'Brahms Op. 118 No. 1 · all 71 measures as genuine score pages',
      caption:
        'The complete candidate engraving, one real page card per page (the engine’s A4 page spread, the same one the Reference view uses) — every source event, every anchor and every duration mark on the whole score, so the review walks the actual pages instead of a single crop. The full-score lint chip above is this engraving’s own report: zero hard errors, six published composite-duration refusals (m. 22, 26, 33, 42, 46, 53).',
    },
    brahmsWindow(
      5,
      1,
      'Brahms m. 5 · LH symbol 5 and the RH triad',
      'The RH downbeat triad 4/4 · 4/5 · 9/4 (all 96-tick) is an admitted cluster: 4/4 and its 10-span repeat 4/5 are both even and share the left column, while the odd 9/4 takes the right column at the cluster’s own extent pitch — one bracket, one value (one ring). The LH symbol 5 on the same onset is an ordinary lone note: it sits ON the solved onset column, never pushed right by parity alone, and keeps its full-size symbol.'
    ),
    brahmsWindow(
      7,
      1,
      'Brahms m. 7 · dense five-note column',
      'The RH downbeat 2/4 · 5/4 · 9/3 · 9/4 · b/3 is the densest onset in the score. The one-family members keep the anchor column and the established full-size fan; the admitted cluster’s marks sit at its own scale. Read the columns against the ordinary notes around them — nothing that is not an admitted bracket member is displaced by parity alone.'
    ),
    brahmsWindow(
      8,
      1,
      'Brahms m. 8 · B/0 relationships and the first horizontal carrier',
      'The RH three-note half-duration cluster (carried 96) carries one carrier at its own reduced mark scale; the LH B/0 pair reads against it at the true source positions. Every head here is anchored to the solved onset: the LH pair’s lower head keeps its snap and the upper head steps right by the established extent gap — the literal fan, not a parity offset, and never a per-note nudge.'
    ),
    brahmsWindow(
      9,
      1,
      'Brahms m. 9 · horizontal carrier marks',
      'Two exception members state their own values on horizontal carriers at their true pitch y: the marks (slash counts and rings) alone state each value, the fixed carrier length never encodes it, and the carrier ink is fitted before it is painted. The second value’s carrier is the reason m. 9 stays in the review set.'
    ),
    brahmsWindow(
      35,
      2,
      'Brahms mm. 35–36 · transposition and measure-start alignment',
      'The transposed passage: check that a transposed cluster anchors exactly like its origin — leftmost occupied column on the solved onset, both hands sharing the rhythmic origin, every measure-start onset aligned under its own beat column. No head is recentred by the scale change alone.'
    ),
    brahmsWindow(
      37,
      1,
      'Brahms m. 37 · horizontal carrier marks (second reading)',
      'The second horizontal-carrier measure: the exception member’s own value reads as marks along the fixed carrier at the admitted scale, clear of the surrounding glyphs and the staff edge — a bare quarter carrier is judged by its own line like every other mark.'
    ),
    brahmsWindow(
      67,
      1,
      'Brahms m. 67 · the three-ring value',
      'The three-ring value (a long exception duration) on the bracket: three rings at the admitted scale, centred on the fixed carrier’s own midpoint — the longest supported run, and the case that sets the fixed carrier length.'
    ),
    round44Specimen(
      ROUND_44_SPECIMEN.key,
      'Duration key · mm. 17–24 — the short values the corpus never states',
      'A compact labelled key for the missing short values only: 4/3/2/1 slash cuts, a bare quarter, then 1/2/3 rings, with supported augmentation. The key is synthetic and labelled as such; the review medium is the real Brahms pages above.'
    ),
  ];
}

/**
 * Round 44 — one proposed design (no obligatory current control; the Reference
 * already supplies the incumbent).
 *
 * The single card states the round’s whole design as one coherent family:
 *
 * - **pitch** — two-column whole-tone parity for admitted bracket clusters only
 *   (`pitchPlacement: 'parity-columns'`), everything else on the established
 *   literal placement;
 * - **duration** — the one 45-degree slash family (`bracketDurationGrammar:
 *   'midpoint'`) at the admitted cluster scale, painted identically on the
 *   bracket and on the fixed-length horizontal exception carrier
 *   (`exceptionCarrier: 'horizontal'`);
 * - **size** — 0.75 for genuinely admitted bracket members only
 *   (`chordSymbolScale: 0.75`); clean dyads and lone notes stay full size.
 */
export const ROUND_44_CANDIDATES: JankoCandidate[] = [
  {
    id: 'anchored-45-ink',
    label: 'Anchored clusters + one compact 45-degree duration ink',
    description:
      'Admitted bracket clusters take the two parity columns at their own admitted extent pitch; every ordinary, lone and unbracketed group keeps the established full-size lower-on-snap / upper-right fan. One 45-degree slash family (L0 = 5.0683745915pt split into equal components, ×s) with ring R1.60·s / stroke 0.59·s and gap 0.50·s, identical on the bracket and on the fixed horizontal carrier (10.0275pt at s = 0.75), with the carrier fit decided before painting. All 71 Brahms measures render as genuine score pages beside the focus measures m. 5, 7–9, 35–37 and 67.',
    options: {
      pitchPlacement: 'parity-columns',
      chordSymbolScale: 0.75,
      bracketDurationGrammar: 'midpoint',
      exceptionCarrier: 'horizontal',
    },
    windows: round44Windows(),
    tags: ['brahms', 'full-score', 'pitch', 'duration', '45-degree'],
  },
];

/** Resolve one card's options/tokens for one studio score entry. */
function optsFor(
  entry: { options: Parameters<typeof resolveJankoOptions>[0] },
  card: JankoCandidate = ROUND_44_CANDIDATES[0]
) {
  return resolveJankoOptions({ ...entry.options, ...(card.options ?? {}) });
}
function toksFor(
  entry: { tokens: Parameters<typeof resolveJankoTokens>[0] },
  card: JankoCandidate = ROUND_44_CANDIDATES[0]
) {
  return resolveJankoTokens({ ...entry.tokens, ...(card.tokens ?? {}) });
}

const R44 = ROUND_44_CANDIDATES[0];
const BRAHMS_OPTS = optsFor({ options: BRAHMS_ROUND44_RESERVE_OPTIONS });
const BRAHMS_TOKS = toksFor({ tokens: BRAHMS_ROUND44_RESERVE_TOKENS });
const PPS_OPTS = optsFor({ options: PITCH_PARITY_SPECIMEN_JANKO_OPTIONS });
const PPS_TOKS = toksFor({ tokens: PITCH_PARITY_SPECIMEN_JANKO_TOKENS });
const DVS_OPTS = optsFor({ options: DURATION_VOCABULARY_SPECIMEN_JANKO_OPTIONS });
const DVS_TOKS = toksFor({ tokens: DURATION_VOCABULARY_SPECIMEN_JANKO_TOKENS });
const PPS_OPTS_OWN = resolveJankoOptions(PITCH_PARITY_SPECIMEN_JANKO_OPTIONS);
const PAIR_GAP = getClusterSpacingPreset(DEFAULT_JANKO_OPTIONS.clusterSpacing).pairGap;

const F = (n: number): number => Number(n);

/** Every `<line>` of one class, as `{ x1, y1, x2, y2, stroke }`. */
function linesOf(
  svg: string,
  cls: string
): { x1: number; y1: number; x2: number; y2: number; stroke: number }[] {
  const re = new RegExp(
    `<line class="${cls}" x1="([\\d.-]+)" y1="([\\d.-]+)" x2="([\\d.-]+)" y2="([\\d.-]+)" stroke="#111111" stroke-width="([\\d.]+)"`,
    'g'
  );
  return [...svg.matchAll(re)].map((m) => ({
    x1: F(+m[1]),
    y1: F(+m[2]),
    x2: F(+m[3]),
    y2: F(+m[4]),
    stroke: F(+m[5]),
  }));
}

/** Every `<circle>` of one class, as `{ cx, cy, r, stroke }`. */
function circlesOf(
  svg: string,
  cls: string
): { cx: number; cy: number; r: number; stroke: number }[] {
  const re = new RegExp(
    `<circle class="${cls}" cx="([\\d.-]+)" cy="([\\d.-]+)" r="([\\d.]+)" fill="#FFFFFF" stroke="#111111" stroke-width="([\\d.]+)"`,
    'g'
  );
  return [...svg.matchAll(re)].map((m) => ({
    cx: F(+m[1]),
    cy: F(+m[2]),
    r: F(+m[3]),
    stroke: F(+m[4]),
  }));
}

/** Painted `janko-exception-carrier` groups of one rendered crop. */
interface CarrierInk {
  noteId: string;
  ticks: number;
  cuts: number;
  rings: number;
  dots: number;
  length: number;
  stroke: number;
  paintedCuts: number;
  paintedRings: number;
}
function carrierInks(svg: string): CarrierInk[] {
  const chunks = svg.split('<g class="janko-exception-carrier"').slice(1);
  return chunks.map((chunk) => {
    const head = chunk.slice(0, chunk.indexOf('>'));
    const attr = (name: string): string => new RegExp(`${name}="([^"]*)"`).exec(head)![1];
    const line = /<line class="janko-exception-carrier-line" x1="([\d.-]+)" y1="([\d.-]+)" x2="([\d.-]+)" y2="([\d.-]+)" stroke="#111111" stroke-width="([\d.]+)"/.exec(chunk)!;
    return {
      noteId: attr('data-exception-note'),
      ticks: Number(attr('data-exception-ticks')),
      cuts: Number(attr('data-exception-cuts')),
      rings: Number(attr('data-exception-rings')),
      dots: Number(attr('data-exception-dots')),
      length: Number(line[3]) - Number(line[1]),
      stroke: Number(line[5]),
      paintedCuts: (chunk.match(/class="janko-exception-cut"/g) ?? []).length,
      paintedRings: (chunk.match(/class="janko-exception-ring"/g) ?? []).length,
    };
  });
}

const approx = (a: number, b: number, eps = 1e-9): boolean => Math.abs(a - b) < eps;

/** The candidate layouts of one score, computed once per suite. */
const layoutCache = new Map<string, readonly JankoSystemLayout[]>();
function layoutsOf(scoreId: string): readonly JankoSystemLayout[] {
  const hit = layoutCache.get(scoreId);
  if (hit) return hit;
  const entry =
    scoreId === BRAHMS_STUDIO_SCORE_ID
      ? { score: BRAHMS, o: BRAHMS_OPTS, t: BRAHMS_TOKS }
      : scoreId === PITCH_PARITY_SPECIMEN_STUDIO_SCORE_ID
        ? { score: PPS, o: PPS_OPTS, t: PPS_TOKS }
        : { score: DVS, o: DVS_OPTS, t: DVS_TOKS };
  const layouts = layoutJankoScore(entry.score, entry.o, entry.t);
  layoutCache.set(scoreId, layouts);
  return layouts;
}

// ---------------------------------------------------------------------------
// 1. Registry: one anchored 45-degree design on the whole score + focus windows
// ---------------------------------------------------------------------------

test('Parked Round 44 registry: one anchored 45-degree design on the full score plus eight focus windows', () => {
  assert.equal(ROUND_44_METADATA.round, 44, 'the parked round');
  assert.match(ROUND_44_METADATA.title, /anchored clusters \+ compact shared duration ink/i);
  assert.deepEqual(
    ROUND_44_METADATA.openAxes,
    ['pitchPlacement', 'bracketDurationGrammar', 'exceptionCarrier'],
    'pitch placement, the bracket marks and the carrier were the round axes'
  );
  assert.equal(ROUND_44_METADATA.compareStrip, undefined, 'no shared compare strip');

  assert.equal(ROUND_44_CANDIDATES.length, 1, 'one proposed design, no obligatory control');
  const card = ROUND_44_CANDIDATES[0];
  assert.equal(card.id, 'anchored-45-ink');
  assert.equal(card.axis, undefined, 'the coherent design claims no single axis');
  assert.deepEqual(card.options, {
    pitchPlacement: 'parity-columns',
    chordSymbolScale: 0.75,
    bracketDurationGrammar: 'midpoint',
    exceptionCarrier: 'horizontal',
  });

  const windows = resolveCandidate(card).windows;
  assert.equal(windows.length, 9, 'the whole-score spread plus the eight focus windows');
  const full = windows[0] as JankoScoreCandidateWindow;
  assert.equal(full.fullScore, true, 'the first window is the genuine full-score spread');
  assert.equal(full.scoreId, BRAHMS_STUDIO_SCORE_ID, 'the whole Brahms score');
  assert.deepEqual([full.measureStart, full.measureCount], [1, 71], 'all 71 measures');
  const spans = (scoreId: string): string[] =>
    windows
      .filter(
        (w) => 'scoreId' in w && w.scoreId === scoreId && !(w as JankoScoreCandidateWindow).fullScore
      )
      .map(
        (w) =>
          `${(w as JankoScoreCandidateWindow).measureStart}-${(w as JankoScoreCandidateWindow).measureStart + (w as JankoScoreCandidateWindow).measureCount - 1}`
      );
  assert.deepEqual(
    spans(BRAHMS_STUDIO_SCORE_ID),
    ['5-5', '7-7', '8-8', '9-9', '35-36', '37-37', '67-67'],
    'the seven re-aimed Brahms focus windows'
  );
  assert.deepEqual(
    spans(DURATION_VOCABULARY_SPECIMEN_STUDIO_SCORE_ID),
    ['17-24'],
    'the compact labelled key for the short values the corpus never states'
  );
  assert.deepEqual(
    spans(PITCH_PARITY_SPECIMEN_STUDIO_SCORE_ID),
    [],
    'the synthetic pitch specimen is no longer a review medium'
  );

  // The parked Round 43 record survives intact (one midpoint card, 11 windows).
  assert.equal(ROUND_43_METADATA.round, 43);
  assert.match(ROUND_43_METADATA.title, /reusable pitch \+ symbolic-duration study/i);
  assert.deepEqual(ROUND_43_CANDIDATES.map((c) => c.id), ['midpoint-parity'], 'the parked card');
  assert.equal(
    (ROUND_43_CANDIDATES[0].windows ?? []).length,
    11,
    'the parked round keeps its eleven windows'
  );

  // Round 45 is the live round now: three scale cards beside the adopted 0.90
  // Reference. The full Round 45 contract is pinned in
  // test/janko-candidates.test.ts; here the history only has to point at it.
  assert.equal(CURRENT_ROUND_METADATA.round, 45, 'the open round');
  assert.deepEqual(
    CURRENT_CANDIDATES.map((c) => c.id),
    ['brahms-scale-85', 'brahms-scale-90', 'brahms-scale-95'],
    'the three Round 45 scale cards'
  );
  // The 0.90 card and the working Brahms Reference must agree for the same
  // score/options: this is the round's declared coherence rule.
  assert.deepEqual(
    { ...CURRENT_CANDIDATES[1].options },
    {
      pitchPlacement: 'parity-columns',
      bracketDurationGrammar: 'midpoint',
      exceptionCarrier: 'horizontal',
      opticalSpacing: true,
      lowPitchFolding: 'literal',
      chordSymbolScale: 0.9,
    },
    'the 0.90 card states the adopted Reference treatment'
  );
});

// ---------------------------------------------------------------------------
// 2. The one 45-degree ink metric (paint · layout · fit · lint)
// ---------------------------------------------------------------------------

test('45-degree metric: preserved centreline length, equal components, one pitch per mark family', () => {
  const m = midpointMetrics(DEFAULT_JANKO_TOKENS, 1);
  // The contract's physical constant, not a copied memo.
  const L0 = Math.hypot(4.95, 1.089);
  assert.ok(approx(L0, 5.0683745915, 1e-9), 'L0 = hypot(4.95, 1.089)');
  assert.ok(approx(m.slashCenterline, L0), 'the pre-change centreline length is preserved');
  assert.ok(approx(m.slashDx, L0 / Math.SQRT2), 'each axis component is L0/√2 at s = 1');
  assert.ok(approx(m.slashDy, m.slashDx), 'the slash is a positive 45-degree page diagonal');
  assert.equal(m.slashSlope, 1, 'rise/run is exactly 1');
  assert.ok(approx(m.slashStroke, 0.71), 'slash stroke 0.71pt at s = 1');
  assert.ok(approx(m.ringRadius, 1.6), 'ring centreline radius 1.60pt at s = 1');
  assert.ok(approx(m.ringStroke, 0.59), 'ring stroke 0.59pt at s = 1');

  // Every number is derived from the emitted geometry.
  const component = (L0 / Math.SQRT2) * 1;
  assert.ok(
    approx(m.slashHalfX, (component + m.slashStroke / Math.SQRT2) / 2),
    'the butt-ended slash ink half-extent is (component + stroke/√2)/2'
  );
  assert.ok(approx(m.slashHalfY, m.slashHalfX), 'the ink box is square on both axes');
  assert.ok(approx(m.ringHalf, m.ringRadius + m.ringStroke / 2), 'ring outer half-extent');
  assert.ok(approx(m.gap, CLASP_MARK_STACK_GAP), 'the minimum clear ink gap is the source constant');

  // The two mounts share one pitch per family: the perpendicular clearance
  // between parallel 45-degree cut centrelines is stroke + gap.
  assert.ok(approx(m.cutSpacing, Math.SQRT2 * (m.slashStroke + m.gap)), 'cut pitch √2·(stroke + g)');
  assert.ok(approx(m.cutSpacing / Math.SQRT2, m.slashStroke + m.gap), 'true stroke clearance between cuts');
  assert.ok(approx(m.ringSpacing, 2 * m.ringHalf + m.gap), 'ring pitch = outer diameter + g');
  assert.equal(m.bracketCutSpacing, m.carrierCutSpacing, 'one cut pitch on both mounts');
  assert.equal(m.bracketRingSpacing, m.carrierRingSpacing, 'one ring pitch on both mounts');

  // The fixed carrier is the largest supported run plus one gap at each end.
  assert.ok(approx(m.cutsRun, 3 * m.cutSpacing + 2 * m.slashHalfX), 'the four-cut run');
  assert.ok(approx(m.ringsRun, 2 * m.ringSpacing + 2 * m.ringHalf), 'the three-ring run');
  assert.ok(approx(m.carrierLength, Math.max(m.cutsRun, m.ringsRun) + 2 * m.gap), 'fixed length = max run + 2g');
  assert.ok(approx(m.carrierLength, 13.37), 's = 1 fixed length');
  assert.ok(approx(effectiveExceptionCarrierLength('midpoint', DEFAULT_JANKO_TOKENS), m.carrierLength), 'one metric for paint and layout');
});

test('At the admitted 0.75: the contract’s literal targets and the 10.0275pt carrier', () => {
  const m = midpointMetrics(DEFAULT_JANKO_TOKENS, 0.75);
  assert.equal(m.scale, 0.75, 'the admitted scale is stated on the metric');
  assert.ok(approx(m.slashDx, 2.6879115324, 1e-9) && approx(m.slashDy, 2.6879115324, 1e-9), 'components 2.6879115324pt');
  assert.ok(approx(m.slashStroke, 0.5325, 1e-12), 'slash stroke 0.5325');
  assert.ok(approx(m.ringRadius, 1.2, 1e-12), 'ring radius 1.2');
  assert.ok(approx(m.ringStroke, 0.4425, 1e-12), 'ring stroke 0.4425');
  assert.ok(approx(m.gap, 0.375, 1e-12), 'clear gap 0.375');
  assert.ok(approx(m.cutSpacing, 1.2833988079, 1e-9), 'cut pitch 1.2833988079');
  assert.ok(approx(m.cutsRun, 6.914642317, 1e-9), 'four-cut run 6.914642317');
  assert.ok(approx(m.ringSpacing, 3.2175, 1e-12), 'ring pitch 3.2175');
  assert.ok(approx(m.ringsRun, 9.2775, 1e-12), 'three-ring run 9.2775');
  assert.ok(approx(m.carrierLength, 10.0275, 1e-12), 'fixed carrier length 10.0275');
  assert.ok(
    approx(effectiveExceptionCarrierLength('midpoint', DEFAULT_JANKO_TOKENS, 0.75), 10.0275, 1e-12),
    'the layout reads the admitted-scale length'
  );
  // Coherent scaling: every mark and the stroke shrink with the cluster.
  assert.ok(approx(m.slashStroke, 0.71 * 0.75, 1e-12), 'stroke scales with s');
  assert.ok(approx(m.cutSpacing, Math.SQRT2 * (m.slashStroke + m.gap), 1e-12), 'the pitch stays true stroke clearance');
});

test('Counts 4/3/2/1 cuts, a bare quarter, then 1/2/3 rings — every plain value distinct', () => {
  const EXPECTED: Record<number, { cuts: number; rings: number; dots: 0 | 1 | 2 }> = {
    3: { cuts: 4, rings: 0, dots: 0 },
    6: { cuts: 3, rings: 0, dots: 0 },
    12: { cuts: 2, rings: 0, dots: 0 },
    24: { cuts: 1, rings: 0, dots: 0 },
    48: { cuts: 0, rings: 0, dots: 0 },
    96: { cuts: 0, rings: 1, dots: 0 },
    192: { cuts: 0, rings: 2, dots: 0 },
    384: { cuts: 0, rings: 3, dots: 0 },
  };
  const readings = new Set<string>();
  for (const value of DURATION_VOCABULARY_PLAIN_VALUES) {
    const got = compactDurationMarks(value);
    assert.equal(got.inGrammar, true, `${value}: reads in the compact grammar`);
    assert.deepEqual({ cuts: got.cuts, rings: got.rings, dots: got.dots }, EXPECTED[value], `${value}: its own count`);
    readings.add(`${got.cuts}/${got.rings}/${got.dots}`);
  }
  assert.equal(readings.size, DURATION_VOCABULARY_PLAIN_VALUES.length, 'every plain value is distinct');
  // Supported augmentation is preserved.
  for (const [value, dots] of [[36, 1], [72, 1], [144, 1], [288, 1], [42, 2], [84, 2]] as const) {
    const got = compactDurationMarks(value);
    assert.equal(got.dots, dots, `${value}: ${dots} dot(s)`);
  }
  // Out-of-grammar composites are refused, never faked into a neighbouring glyph.
  for (const value of [108, 120, 504]) {
    const got = compactDurationMarks(value);
    assert.equal(got.inGrammar, false, `${value}: refused, not rounded into a plain value`);
    assert.deepEqual([got.cuts, got.rings, got.dots], [0, 0, 0], `${value}: no invented composite glyph`);
  }
});

// ---------------------------------------------------------------------------
// 3. Identical 45-degree ink on both mounts; the stack direction is the only
//    difference; the rendered marks match the metric
// ---------------------------------------------------------------------------

test('Identical 45-degree ink and identical centre pitch on both mounts', () => {
  const m = midpointMetrics(DVS_TOKS, 0.75);
  const bracketSvg = renderJankoCrop(DVS, DURATION_VOCABULARY_BANDS.bracket.first, 8, DVS_OPTS, DVS_TOKS);
  const exceptionSvg = renderJankoCrop(DVS, DURATION_VOCABULARY_BANDS.exception.first, 8, DVS_OPTS, DVS_TOKS);

  const bracketCuts = linesOf(bracketSvg, 'janko-clasp-cut');
  const exceptionCuts = linesOf(exceptionSvg, 'janko-exception-cut');
  assert.ok(bracketCuts.length > 0 && exceptionCuts.length > 0, 'both mounts paint cuts');

  // Every slash — on either mount — is the same page-raked diagonal: the same
  // x length, the same rise, rising left→right (y decreases). The emitted SVG
  // rounds to 2 dp, so compare within half a hundredth.
  const SVG_EPS = 0.011;
  for (const slash of [...bracketCuts, ...exceptionCuts]) {
    assert.ok(approx(slash.x2 - slash.x1, m.slashDx, SVG_EPS), 'the transverse x length is identical');
    assert.ok(approx(slash.y2 - slash.y1, -m.slashDy, SVG_EPS), 'the same up-raked 45-degree rise');
    assert.ok(approx(slash.stroke, m.slashStroke, SVG_EPS), 'the same slash stroke at the admitted scale');
  }

  // The bracket stacks its cuts VERTICALLY (one x, ordered y); the carrier
  // stacks them HORIZONTALLY (one y, ordered x) — the same centre pitch.
  const bracketRuns = bracketCuts.slice(0, 4);
  assert.equal(new Set(bracketRuns.map((c) => c.x1)).size, 1, 'the bracket cuts share one x');
  assert.ok(
    bracketRuns.every((c, i) => i === 0 || approx(c.y1 - bracketRuns[i - 1].y1, m.cutSpacing, SVG_EPS)),
    'the bracket cuts stack at the metric pitch'
  );
  const carrierRuns = exceptionCuts.slice(0, 4);
  assert.equal(new Set(carrierRuns.map((c) => c.y1)).size, 1, 'the carrier cuts share one y');
  assert.ok(
    carrierRuns.every((c, i) => i === 0 || approx(c.x1 - carrierRuns[i - 1].x1, m.cutSpacing, SVG_EPS)),
    'the carrier cuts stack at the same metric pitch'
  );

  // The ring is identical on both mounts too.
  for (const ring of [
    ...circlesOf(bracketSvg, 'janko-clasp-compact-ring'),
    ...circlesOf(exceptionSvg, 'janko-exception-ring'),
  ]) {
    assert.ok(approx(ring.r, m.ringRadius, SVG_EPS), 'the same ring radius');
    assert.ok(approx(ring.stroke, m.ringStroke, SVG_EPS), 'the same ring stroke');
  }

  // The painted exception carriers state their own scale and the fixed length.
  const carriers = carrierInks(exceptionSvg);
  assert.ok(carriers.length > 0, 'the exception band paints carriers');
  for (const c of carriers) {
    assert.ok(approx(c.length, 10.0275, 0.011), `${c.noteId}: the fixed 10.0275pt admitted-scale carrier`);
    assert.ok(
      approx(c.stroke, DVS_TOKS.claspStrokeWidth * 0.75, 0.011),
      `${c.noteId}: the carrier line scales with s`
    );
    assert.equal(c.paintedCuts, c.cuts, `${c.noteId}: painted cuts match the declared marks`);
    assert.equal(c.paintedRings, c.rings, `${c.noteId}: painted rings match the declared marks`);
  }

  // The rendered mark boxes are the same metric the fit and the linter read.
  const layout = layoutsOf(DURATION_VOCABULARY_SPECIMEN_STUDIO_SCORE_ID).flatMap((l) => l.exceptionCarriers);
  for (const g of layout) {
    const boxes = exceptionCarrierMarkBoxes(g, DVS_TOKS);
    for (const b of boxes.filter((x) => x.kind === 'cut')) {
      assert.ok(approx((b.x1 - b.x0) / 2, m.slashHalfX, 1e-9), 'cut box half-width is the metric extent');
      assert.ok(approx((b.y1 - b.y0) / 2, m.slashHalfY, 1e-9), 'cut box half-height is the metric extent');
    }
    for (const b of boxes.filter((x) => x.kind === 'ring')) {
      assert.ok(approx((b.x1 - b.x0) / 2, m.ringHalf, 1e-9), 'ring box half-width is the metric extent');
    }
  }
});

// ---------------------------------------------------------------------------
// 4. Anchoring: lone notes and one-family clusters keep the solved onset
//    column; admitted both-family clusters take the two parity columns
// ---------------------------------------------------------------------------

type Head = JankoSystemLayout['notes'][number];

/** Every positioned head of one score's candidate layout, by note id. */
function headsOf(layouts: readonly JankoSystemLayout[]): Map<string, Head> {
  const heads = new Map<string, Head>();
  for (const layout of layouts) for (const p of layout.notes) heads.set(p.note.id, p);
  return heads;
}

/** Every head of one onset of the candidate Brahms layout. */
function onsetOf(layouts: readonly JankoSystemLayout[], tick: number): Head[] {
  return layouts.flatMap((l) => l.notes).filter((p) => p.note.startTick === tick);
}

/** Offset from the solved onset column (the fit's own resolved displacement). */
const offsetOf = (p: Head): number => p.x - (p.nominalX ?? p.x);

/** The full-size parity-fit member shape of one head (the pure-fit input). */
function memberOf(p: Head): JankoClusterFitMember {
  return {
    id: p.note.id,
    lower: p.y - 2.53,
    upper: p.y + 2.53,
    wx: 2.53,
    lin: p.note.pitch.octave * 12 + p.note.pitch.pitchClass,
  };
}

test('A lone note and a one-family cluster sit ON the solved onset column — no invisible empty column', () => {
  const heads = headsOf(layoutsOf(PITCH_PARITY_SPECIMEN_STUDIO_SCORE_ID));
  for (const id of ['pps-0-0_4', 'pps-624-7_4']) {
    const p = heads.get(id)!;
    assert.ok(approx(p.x, p.nominalX!, 1e-9), `${id}: the lone note sits on the solved onset column`);
    assert.equal(p.symbolScale, undefined, `${id}: and is never admitted to the cluster scale`);
  }
  // m. 3’s 10-span repeat (4/4 · 4/5, both even) is ONE family: both heads share
  // the anchor column, 30.0pt apart — exactly as the canonical placement.
  const repeat = ['pps-384-4_4', 'pps-384-4_5'].map((id) => heads.get(id)!);
  assert.equal(new Set(repeat.map((p) => p.x.toFixed(9))).size, 1, 'a one-family pair shares one column');
  assert.ok(approx(Math.abs(repeat[0].y - repeat[1].y), 30.0, 1e-6), 'and stays a 10-span apart');
  assert.ok(approx(offsetOf(repeat[0]), 0, 1e-9), 'the shared column IS the onset anchor');

  // Brahms m. 8’s all-odd downbeat: five RH heads, one family, one anchor
  // column, shared with the LH note of the same onset (B/0 relationship).
  const m8 = onsetOf(layoutsOf(BRAHMS_STUDIO_SCORE_ID), 1392);
  assert.equal(m8.length, 6, 'five RH + one LH head at the m. 8 downbeat');
  for (const p of m8.filter((p) => p.rhythm.hand === 'RH')) {
    assert.equal(wholeToneParity(p.note.pitch), 1, 'the RH downbeat is one (odd) family');
  }
  assert.equal(new Set(m8.map((p) => p.x.toFixed(9))).size, 1, 'the whole onset shares the anchor column');
  assert.ok(approx(offsetOf(m8[0]), 0, 1e-9), 'and that column is the solved onset column');

  // Brahms m. 5: the lone LH absolute pitch symbol 5 sits on the anchor, never
  // pushed right by parity alone.
  const m5 = onsetOf(layoutsOf(BRAHMS_STUDIO_SCORE_ID), 48 + 4 * 192);
  const m5LH = m5.filter((p) => p.rhythm.hand === 'LH');
  assert.equal(m5LH.length, 1, 'one LH head');
  assert.equal(m5LH[0].note.pitch.pitchClass, 5, 'the LH absolute pitch symbol 5');
  assert.ok(approx(offsetOf(m5LH[0]), 0, 1e-9), 'the lone LH symbol 5 is anchored, never pushed right');
});

test('Both-family clusters preserve even-left / odd-right at the extent-derived pair pitch', () => {
  const heads = headsOf(layoutsOf(PITCH_PARITY_SPECIMEN_STUDIO_SCORE_ID));
  const even = heads.get('pps-96-4_4')!;
  const odd = heads.get('pps-96-5_4')!;
  assert.equal(even.symbolChord, true, 'the spread 1-span pair is admitted');
  assert.equal(even.symbolScale, 0.75, 'and takes the admitted scale');
  assert.equal(wholeToneParity(even.note.pitch), 0, 'even family');
  assert.equal(wholeToneParity(odd.note.pitch), 1, 'odd family');
  assert.ok(approx(offsetOf(even), 0, 1e-9), 'the even family sits on the onset anchor');
  assert.ok(approx(odd.x - even.x, PAIR_GAP, 1e-9), 'the odd family sits one pair pitch to its right');

  // Brahms m. 5’s RH triad: 4/4 · 4/5 (both even) on the anchor, 9/4 (odd) one
  // pair pitch right — the same rule on the real corpus.
  const m5 = onsetOf(layoutsOf(BRAHMS_STUDIO_SCORE_ID), 48 + 4 * 192).filter(
    (p) => p.rhythm.hand === 'RH'
  );
  const x = new Map(m5.map((p) => [p.note.pitch.pitchClass, p.x]));
  assert.equal(m5.length, 3, 'the RH triad');
  assert.ok(approx(x.get(4)! - m5[0].nominalX!, 0, 1e-9), 'the even family on the anchor');
  assert.ok(approx(x.get(9)! - x.get(4)!, PAIR_GAP, 1e-9), 'the odd family one pair pitch right');

  // The pair pitch is a geometric constant, never duration-driven: the pure
  // fit seats the same two families identically regardless of value.
  const fit = fitParityColumns([memberOf(even), memberOf(odd)], 0.4, PAIR_GAP);
  assert.ok(approx(fit.offsets.get(even.note.id)!, 0, 1e-9), 'even on the anchor');
  assert.ok(approx(fit.offsets.get(odd.note.id)!, PAIR_GAP, 1e-9), 'odd at the same pitch');

  // ONE family reserves no empty column: the pure fit seats both heads on the
  // anchor when their masks do not collide.
  const oneFamily = fitParityColumns(
    [
      { id: 'one-a', lin: 48, lower: 98, upper: 103, wx: 2.53 },
      { id: 'one-b', lin: 50, lower: 78, upper: 83, wx: 2.53 },
    ],
    0.4,
    PAIR_GAP
  );
  assert.deepEqual([...oneFamily.offsets.values()], [0, 0], 'a one-family pair stays on the anchor');
});

test('Anchoring applies to both hands and to transposed passages (mm. 35–36)', () => {
  const heads = headsOf(layoutsOf(BRAHMS_STUDIO_SCORE_ID));
  const m35 = onsetOf(layoutsOf(BRAHMS_STUDIO_SCORE_ID), 48 + 34 * 192);
  const m36 = onsetOf(layoutsOf(BRAHMS_STUDIO_SCORE_ID), 48 + 35 * 192);
  assert.ok(m35.length >= 4 && m36.length >= 4, 'both onsets carry both hands');
  for (const [label, onset] of [['m. 35', m35], ['m. 36', m36]] as const) {
    // The transposed cluster anchors exactly like its origin: the leftmost
    // occupied column of the onset is the solved onset column.
    const min = Math.min(...onset.map(offsetOf));
    assert.ok(approx(min, 0, 1e-9), `${label}: the leftmost occupied column is the onset anchor`);
    // The odd family of an admitted both-family cluster takes the pair pitch.
    const admitted = onset.filter((p) => p.symbolChord === true);
    if (admitted.length > 0) {
      const rails = new Set(admitted.map((p) => Number((offsetOf(p) - min).toFixed(9))));
      for (const rail of rails) {
        assert.ok(
          approx(rail, 0, 1e-9) || approx(rail, PAIR_GAP, 1e-9),
          `${label}: admitted members occupy only the anchor and the pair pitch (got ${rail})`
        );
      }
    }
    // Same-hand alignment: every head of the hand that carries the cluster
    // keeps the hand's own rhythmic origin (no per-note nudging inside a row).
    for (const hand of ['RH', 'LH'] as const) {
      const rows = new Map<string, number[]>();
      for (const p of onset.filter((q) => q.rhythm.hand === hand)) {
        const key = p.y.toFixed(3);
        rows.set(key, [...(rows.get(key) ?? []), offsetOf(p)]);
      }
      for (const [key, offsets] of rows) {
        assert.equal(
          new Set(offsets.map((o) => o.toFixed(9))).size,
          1,
          `${label}: one drawn row (y=${key}) of one hand shares one offset`
        );
      }
    }
    assert.ok(heads.size > 0, 'the layout really carries heads');
  }
  // The measure-start onsets of the two transposed measures align under their
  // own beat column: both are exactly their own nominal column plus the same
  // anchored geometry (the anchor invariant above), and the grid is clean (see
  // the whole-score grid test).
  const start35 = m35.filter((p) => p.note.startTick === 48 + 34 * 192);
  const start36 = m36.filter((p) => p.note.startTick === 48 + 35 * 192);
  for (const [label, onset] of [['m. 35', start35], ['m. 36', start36]] as const) {
    assert.ok(
      onset.every((p) => Math.abs(offsetOf(p) - Math.min(...onset.map(offsetOf))) < PAIR_GAP + 1e-9),
      `${label}: no head strays further than the cluster's own pair pitch`
    );
  }
});

// ---------------------------------------------------------------------------
// 5. Admission/fallback: only genuinely admitted members move; every rejected
//    or unadmitted onset keeps the incumbent literal placement — no stale
//    parity offset survives a qualification rejection
// ---------------------------------------------------------------------------

/** The round-44 card's own option deltas, stated once for layout comparisons. */
const CARD_OPTIONS = {
  pitchPlacement: 'parity-columns',
  chordSymbolScale: 0.75,
  bracketDurationGrammar: 'midpoint',
  exceptionCarrier: 'horizontal',
} as const;

/**
 * The incumbent literal placement under the same non-pitch knobs (the
 * admission-gated fallback the round promises), computed once.
 */
const BRAHMS_LITERAL_LAYOUTS = layoutJankoScore(
  BRAHMS,
  resolveJankoOptions({
    ...BRAHMS_ROUND44_RESERVE_OPTIONS,
    ...CARD_OPTIONS,
    pitchPlacement: 'standard',
  }),
  BRAHMS_TOKS
);

/** Group one score's candidate heads by onset tick. */
function onsetsOf(layouts: readonly JankoSystemLayout[]): Map<number, Head[]> {
  const onsets = new Map<number, Head[]>();
  for (const layout of layouts) {
    for (const p of layout.notes) {
      const list = onsets.get(p.note.startTick);
      if (list) list.push(p);
      else onsets.set(p.note.startTick, [p]);
    }
  }
  return onsets;
}

test('Admission gates placement: a rejected onset keeps the incumbent literal offsets', () => {
  const heads = headsOf(layoutsOf(BRAHMS_STUDIO_SCORE_ID));
  const literal = headsOf(BRAHMS_LITERAL_LAYOUTS);
  const onsets = onsetsOf(layoutsOf(BRAHMS_STUDIO_SCORE_ID));

  let fallbackOnsets = 0;
  // Round 45 — the authorized m. 66 RH → LH correction moves the low A2/D3
  // reattacks into the left hand, where each is an exact **same-hand unison**
  // with the preserved sustained tie-wait voice at the same onset and pitch
  // (ticks 12552 A2, 12576 D3). The parity path's nominal-rail qualification
  // (Round 43: a one-family rail pair is never promoted into a bracket) leaves
  // both members unadmitted, and the established fan separates the two
  // identical-pitch heads by the extent pair pitch — the parity path and the
  // literal control place the SAME offset multiset, differing only in which of
  // two identical heads keeps the column. That identity is asserted below; for
  // every other unadmitted onset the incumbent literal offset holds per head.
  const unisonTicks = new Set([12552, 12576]);
  for (const [tick, arr] of onsets) {
    if (arr.some((p) => p.symbolChord === true)) continue;
    fallbackOnsets += 1;
    if (unisonTicks.has(tick)) {
      const controlRow = [...literal.values()].filter((q) => q.note.startTick === tick);
      assert.equal(controlRow.length, arr.length, `${tick}: same head count as the literal control`);
      assert.equal(arr.length, 2, `${tick}: the unison pair`);
      assert.equal(
        new Set(arr.map((p) => p.note.pitch.pitchClass)).size,
        1,
        `${tick}: one absolute pitch symbol`
      );
      assert.equal(new Set(arr.map((p) => p.rhythm.hand)).size, 1, `${tick}: one hand`);
      // The establishment's own fan: one member on the solved column, the
      // other exactly one extent pair pitch to the right. (The legacy literal
      // control admits a bracket here — its qualification reads live offsets —
      // and the bracket's air shifts the unit; the parity path's Round 43
      // nominal-rail doctrine leaves the pair unadmitted, so its seats sit on
      // the column and its own demand never translates the onset.)
      const seats = arr.map(offsetOf).sort((a, b) => a - b);
      assert.ok(approx(seats[0], 0, 1e-9), `${tick}: one head on the solved onset column`);
      assert.ok(approx(seats[1] - seats[0], PAIR_GAP, 1e-9), `${tick}: one pair pitch apart`);
      assert.equal(
        new Set(arr.map((p) => p.symbolChord === true)).size,
        1,
        `${tick}: neither member is an admitted bracket member`
      );
      continue;
    }
    for (const p of arr) {
      const control = literal.get(p.note.id)!;
      assert.ok(
        approx(offsetOf(p), offsetOf(control), 1e-9),
        `${p.note.id}@${tick}: an unadmitted onset keeps the incumbent literal offset`
      );
    }
  }
  assert.ok(
    fallbackOnsets > 400,
    `the literal path is the rule (${fallbackOnsets} onsets), not the exception`
  );

  // The m. 66.5 onset (tick 12624) is the corrected two-handed "9222" column:
  // the left hand's A2/D3 pair is the one admitted bracket cluster (a 96-tick
  // carry), the right hand's D4/D5 stay unbracketed on the unit's own demand —
  // and the whole onset stays inside one pair pitch of its anchor, so no head
  // strays beyond the cluster's own fan (the Round 45 m. 66 hand correction;
  // the legacy literal control placed the column differently).
  const m665 = onsets.get(12624)!;
  assert.equal(m665.length, 4, 'four heads on the m. 66.5 onset');
  assert.deepEqual(
    m665.filter((p) => p.symbolChord === true).map((p) => p.note.id).sort(),
    ['brahms-op118-no1-913', 'brahms-op118-no1-914'],
    'the LH A2/D3 pair is the admitted bracket cluster'
  );
  assert.deepEqual(
    [...new Set(m665.map((p) => p.rhythm.hand))].sort(),
    ['LH', 'RH'],
    'the column reads two-handed'
  );
  const m665Offsets = m665.map(offsetOf);
  assert.ok(
    approx(Math.max(...m665Offsets) - Math.min(...m665Offsets), PAIR_GAP, 1e-9),
    'the whole onset stays within one pair pitch of its own anchor'
  );

  // Scale and admission agree to the head: exactly the admitted members take
  // the reduced symbols and the parity columns.
  for (const p of heads.values()) {
    assert.equal(p.symbolScale === 0.75, p.symbolChord === true, `${p.note.id}: scale iff admitted`);
  }
  const patterns = new Map<string, number>();
  for (const arr of onsets.values()) {
    const admitted = arr.filter((p) => p.symbolChord === true);
    if (admitted.length === 0) continue;
    const min = Math.min(...arr.map(offsetOf));
    for (const p of admitted) {
      const rail = offsetOf(p) - min;
      assert.ok(
        approx(rail, 0, 1e-9) || approx(rail, PAIR_GAP, 1e-9),
        `${p.note.id}: an admitted member sits on the anchor or the pair pitch (got ${rail.toFixed(3)})`
      );
    }
    const key = [...new Set(admitted.map((p) => Number((offsetOf(p) - min).toFixed(6))))]
      .sort((a, b) => a - b)
      .join(',');
    patterns.set(`{${key}}`, (patterns.get(`{${key}}`) ?? 0) + 1);
  }
  assert.deepEqual(
    [...patterns.entries()].map(([k, v]) => `${k}:${v}`).sort(),
    ['{0}:21', '{0,5.46}:50'].sort(),
    'admitted clusters occupy exactly the anchor and the extent-derived pair pitch'
  );
  // 50 two-rail clusters (was 49): the Round 45 m. 66 hand correction makes
  // the tick-12624 LH A2/D3 pair an admitted two-rail cluster — the
  // two-handed "9222" column — so exactly one more onset takes both rails.
  // A revision of this count must name its cause: it is the admission census,
  // not a tolerance.
});

test('No stale parity offset survives: the only unadmitted pair pitch is the literal fold fan', () => {
  const heads = headsOf(layoutsOf(BRAHMS_STUDIO_SCORE_ID));
  const literal = headsOf(BRAHMS_LITERAL_LAYOUTS);
  const leaks: string[] = [];
  for (const [tick, arr] of onsetsOf(layoutsOf(BRAHMS_STUDIO_SCORE_ID))) {
    const min = Math.min(...arr.map(offsetOf));
    for (const p of arr) {
      if (p.symbolChord === true) continue;
      const d = offsetOf(p) - min;
      if (d > 1e-6 && approx(d / PAIR_GAP, Math.round(d / PAIR_GAP), 1e-6)) {
        leaks.push(`${p.note.id}@${tick}`);
      }
    }
  }
  assert.deepEqual(
    leaks,
    [
      'brahms-op118-no1-445@6192',
      'brahms-op118-no1-731@10032',
      'brahms-op118-no1-909@12552',
      'brahms-op118-no1-911@12576',
    ],
    'the fold-coincident octave pairs and the m. 66 same-hand unison pairs sit at the pair pitch without admission'
  );
  // Round 45 — the m. 66 pairs: the authorized RH → LH correction makes the
  // low A2 (t12552) / D3 (t12576) reattacks same-hand unisons with the
  // preserved sustained tie-wait voices. Neither is an admitted bracket
  // cluster (a one-family rail pair never qualifies, Round 43), so each pair
  // is the ESTABLISHED fan: two identical-pitch heads one pair pitch apart —
  // the same offset multiset the literal control places, head assignment
  // aside.
  for (const [tick, flagged] of [[12552, 'brahms-op118-no1-909'], [12576, 'brahms-op118-no1-911']] as const) {
    const parityPair = [...heads.values()].filter((q) => q.note.startTick === tick);
    const literalPair = [...literal.values()].filter((q) => q.note.startTick === tick);
    assert.equal(parityPair.length, 2, `tick ${tick}: exactly the unison pair`);
    assert.equal(new Set(parityPair.map((q) => q.note.pitch.pitchClass)).size, 1, 'one absolute pitch symbol');
    assert.equal(new Set(parityPair.map((q) => q.rhythm.hand)).size, 1, 'one hand');
    const seats = parityPair.map(offsetOf).sort((a, b) => a - b);
    assert.ok(approx(seats[0], 0, 1e-9) && approx(seats[1], PAIR_GAP, 1e-9), `${tick}: column + one pair pitch`);
    assert.ok(
      approx(offsetOf(literalPair[0]), offsetOf(literalPair[1]) - PAIR_GAP, 1e-9) ||
        approx(offsetOf(literalPair[1]), offsetOf(literalPair[0]) - PAIR_GAP, 1e-9),
      `tick ${tick}: the literal control's fan is the same one pair pitch apart`
    );
    assert.equal(heads.get(flagged)!.note.durationTicks > 96, true, `${flagged}: the sustained tie-wait voice`);
  }
  // Each fold-coincident pair is the literal fan's own upper member (the
  // incumbent placement gives it the same offset), and the pair is two
  // octave-folded heads on ONE drawn row — a folding geometry finding, never a
  // parity offset.
  for (const id of ['brahms-op118-no1-445', 'brahms-op118-no1-731']) {
    const p = heads.get(id)!;
    assert.ok(
      approx(offsetOf(p), offsetOf(literal.get(id)!), 1e-9),
      `${id}: the literal fan offset, not a parity rail`
    );
    const lower = heads.get(id.replace(/-(\d+)$/, (_, n: string) => `-${Number(n) - 1}`))!;
    assert.ok(approx(p.y, lower.y, 1e-9), `${id}: folded onto the same drawn row`);
    assert.equal(p.note.pitch.pitchClass, lower.note.pitch.pitchClass, 'one absolute pitch symbol, two octaves');
    assert.ok(approx(p.x - lower.x, PAIR_GAP, 1e-9), 'the fan step is the extent pair pitch');
  }
});

// ---------------------------------------------------------------------------
// 6. Whole-onset spacing/grid consistency: the solved onset column is the
//    anchor, the cluster keeps its own beat cell, no per-note nudging
// ---------------------------------------------------------------------------

test('Whole-onset consistency: no head leaves its beat cell, one offset per drawn row', () => {
  const layouts = layoutsOf(BRAHMS_STUDIO_SCORE_ID);
  const report = lintJankoScore(BRAHMS, BRAHMS_OPTS, BRAHMS_TOKS);
  assert.deepEqual(
    report.diagnostics.filter((d) => d.code === 'grid-crossing-offset'),
    [],
    'no head crosses its beat cell anywhere in the score'
  );
  assert.deepEqual(
    layouts.flatMap((l) => l.clusterDiagnostics ?? []),
    [],
    'the engine cell fit reports no demand it could not meet'
  );

  // The whole onset keeps its own cell: no onset spans further than the
  // cluster's own pair pitch, so nothing is nudged per note.
  let onsets = 0;
  let widest = 0;
  const rowOffenders: string[] = [];
  for (const layout of layouts) {
    const byTick = new Map<number, Head[]>();
    for (const p of layout.notes) {
      byTick.set(p.note.startTick, [...(byTick.get(p.note.startTick) ?? []), p]);
    }
    for (const [tick, arr] of byTick) {
      onsets += 1;
      widest = Math.max(widest, Math.max(...arr.map(offsetOf)) - Math.min(...arr.map(offsetOf)));
      assert.ok(
        Math.max(...arr.map(offsetOf)) - Math.min(...arr.map(offsetOf)) <= PAIR_GAP + 1e-9,
        `onset @${tick}: the whole onset stays within one pair-pitch cell`
      );
      for (const hand of ['RH', 'LH'] as const) {
        const rows = new Map<string, Head[]>();
        for (const p of arr.filter((q) => q.rhythm.hand === hand)) {
          rows.set(p.y.toFixed(3), [...(rows.get(p.y.toFixed(3)) ?? []), p]);
        }
        for (const [y, row] of rows) {
          if (new Set(row.map(offsetOf)).size > 1) rowOffenders.push(`${hand}@${tick}/y${y}`);
        }
      }
    }
  }
  assert.ok(onsets > 500, `${onsets} onsets walked across all 71 measures`);
  assert.ok(approx(widest, PAIR_GAP, 1e-9), `the widest onset is exactly one pair-pitch fan (${widest.toFixed(3)}pt)`);
  assert.deepEqual(
    rowOffenders,
    ['LH@6192/y228.574', 'LH@10032/y420.116', 'LH@12552/y184.548', 'LH@12576/y172.048'],
    'the fold-coincident octave pairs and the m. 66 unison pairs fan within one drawn row'
  );
  // Round 45 — the two m. 66 rows are the authorized RH → LH correction's
  // same-hand unison pairs (A2 t12552, D3 t12576): one head on the onset
  // column plus its pair-pitch mate, exactly the literal fan's own multiset.
  for (const tick of [12552, 12576]) {
    const parityRow = layouts.flatMap((l) => l.notes).filter((q) => q.note.startTick === tick);
    const literalRow = BRAHMS_LITERAL_LAYOUTS.flatMap((l) => l.notes).filter(
      (q) => q.note.startTick === tick
    );
    assert.equal(parityRow.length, 2, `tick ${tick}: the same-hand unison pair`);
    assert.equal(
      new Set(parityRow.map((q) => q.note.pitch.pitchClass)).size,
      1,
      `tick ${tick}: one absolute pitch symbol`
    );
    const seats = parityRow.map(offsetOf).sort((a, b) => a - b);
    assert.ok(
      approx(seats[0], 0, 1e-9) && approx(seats[1], PAIR_GAP, 1e-9),
      `tick ${tick}: the established fan on the solved column, never a parity rail`
    );
    assert.equal(
      literalRow.length,
      2,
      `tick ${tick}: the legacy literal control also paints both voices`
    );
  }
});

// ---------------------------------------------------------------------------
// 7. The fixed carrier: length by the stack, never by the duration; exact ink
//    decided before paint, and a refusal is withheld, published and unpainted
// ---------------------------------------------------------------------------

test('The carrier length is fixed by the stack, never by the elapsed duration', () => {
  const layouts = layoutsOf(BRAHMS_STUDIO_SCORE_ID);
  const m = midpointMetrics(BRAHMS_TOKS, 0.75);
  const carriers = layouts.flatMap((l) => l.exceptionCarriers);
  assert.equal(carriers.length, 32, 'every supported exception member paints its own carrier');
  assert.equal(
    new Set(carriers.map((c) => (c.x1 - c.x0).toFixed(6))).size,
    1,
    'one fixed length for every value'
  );
  for (const c of carriers) {
    assert.ok(approx(c.x1 - c.x0, m.carrierLength, 1e-9), `${c.noteId}: the metric length`);
    assert.equal(c.grammar, 'midpoint', `${c.noteId}: one 45-degree mark family`);
    assert.ok(approx(c.scale, 0.75, 1e-12), `${c.noteId}: the admitted cluster scale`);
    assert.ok(approx(c.stroke, 0.6375, 1e-12), `${c.noteId}: the carrier stroke scales with the cluster`);
    assert.equal(c.inGrammar, true, `${c.noteId}: only an in-grammar value paints a carrier`);
  }
  assert.ok(
    new Set(carriers.map((c) => c.durationTicks)).size >= 5,
    'five distinct values share the one length — the marks alone state the value'
  );

  // The three-ring m. 67 value: three rings, centred on the fixed carrier.
  const m67 = carriers.find((c) => c.noteId === 'brahms-op118-no1-919')!;
  assert.equal(m67.durationTicks, 384, 'the longest supported value');
  assert.deepEqual([m67.cuts, m67.rings, m67.dots], [0, 3, 0], 'three rings, no cuts, no dots');
  const markBoxes = exceptionCarrierMarkBoxes(m67, BRAHMS_TOKS);
  assert.equal(markBoxes.length, 3, 'three painted rings');
  const lo = Math.min(...markBoxes.map((b) => b.x0));
  const hi = Math.max(...markBoxes.map((b) => b.x1));
  assert.ok(
    approx((lo + hi) / 2, (m67.x0 + m67.x1) / 2, 1e-9),
    'the mark stack is centred on the fixed carrier'
  );

  // The exact ink (carrier stroke AND every mark) clears every foreign
  // knockout in its system — the invariant the fit is decided by, measured on
  // the painted geometry itself rather than asserted from nominal numbers.
  let worst = Number.POSITIVE_INFINITY;
  for (const layout of layouts) {
    for (const c of layout.exceptionCarriers) {
      const boxes = [exceptionCarrierInkBox(c, BRAHMS_TOKS), ...exceptionCarrierMarkBoxes(c, BRAHMS_TOKS)];
      for (const p of layout.notes) {
        if (p.note.id === c.noteId) continue;
        const { wx, hy } = knockoutHalfExtents(BRAHMS_OPTS, BRAHMS_TOKS, p.note.startTick, p);
        for (const b of boxes) {
          if (b.y0 < p.y + hy && p.y - hy < b.y1) {
            worst = Math.min(worst, Math.max(p.x - wx - b.x1, b.x0 - (p.x + wx)));
          }
        }
      }
    }
  }
  assert.ok(worst >= 0, `carrier ink clears every foreign knockout (worst gap ${worst.toFixed(3)}pt)`);

  // The corpus focus carriers the ticket names: m. 9's two horizontal
  // carriers state the 192-tick half (two rings each, at their true pitch y),
  // and m. 37's two state the 48-tick quarter with the bare carrier line only
  // — the counts alone state the value, never the fixed length.
  const m9 = carriers.filter((c) => c.tick === 1584);
  assert.deepEqual(
    m9.map((c) => [c.noteId, c.durationTicks, c.cuts, c.rings, c.dots]).sort(),
    [
      ['brahms-op118-no1-117', 192, 0, 2, 0],
      ['brahms-op118-no1-118', 192, 0, 2, 0],
    ].sort(),
    'm. 9: two horizontal carriers, two rings each'
  );
  const m37 = carriers.filter((c) => c.tick === 6960 || c.tick === 7056);
  assert.deepEqual(
    m37.map((c) => [c.noteId, c.durationTicks, c.cuts, c.rings, c.dots]).sort(),
    [
      ['brahms-op118-no1-507', 48, 0, 0, 0],
      ['brahms-op118-no1-515', 48, 0, 0, 0],
    ].sort(),
    'm. 37: two bare-quarter carriers'
  );

  // The seven former 21.91pt fit refusals now all paint: nothing on the
  // candidate score is withheld or clipped.
  for (const id of [
    'brahms-op118-no1-106',
    'brahms-op118-no1-241',
    'brahms-op118-no1-531',
    'brahms-op118-no1-817',
    'brahms-op118-no1-833',
    'brahms-op118-no1-842',
    'brahms-op118-no1-851',
  ]) {
    assert.ok(carriers.some((c) => c.noteId === id), `${id}: the former refusal now fits`);
  }
  assert.deepEqual(layouts.flatMap((l) => l.exceptionCarrierRefusals), [], 'no carrier is withheld');
  assert.deepEqual(layouts.flatMap((l) => l.exceptionCarrierOcclusions), [], 'no mark is occluded');
});

test('Fit before paint: a refused carrier is withheld, published and unpainted', () => {
  const layouts = layoutsOf(DURATION_VOCABULARY_SPECIMEN_STUDIO_SCORE_ID);
  const refusals = layouts.flatMap((l) => l.exceptionCarrierRefusals);
  assert.equal(refusals.length, 1, 'exactly the tight stress onset is withheld');
  const refusal = refusals[0];
  assert.equal(refusal.noteId, 'dvs-stress-12288-9_5');
  assert.equal(refusal.durationTicks, 192);
  assert.ok(approx(refusal.required, 10.0275, 1e-9), 'the fixed 10.0275pt length is required');
  assert.ok(approx(refusal.available, 5.06, 1e-9), 'only the clear span is available');
  assert.ok(refusal.available < refusal.required, 'the shortfall is real, not a rounding artifact');
  assert.ok(
    !layouts.flatMap((l) => l.exceptionCarriers).some((c) => c.noteId === refusal.noteId),
    'no carrier geometry is laid out for it'
  );

  // Published: the linter reports the refusal by identity, with no occlusion.
  const report = lintJankoScore(DVS, DVS_OPTS, DVS_TOKS);
  assert.deepEqual(report.violations, [], 'the withheld carrier is a published warning, not a silent error');
  assert.deepEqual(
    report.warnings.map((w) => [w.code, w.noteIds?.[0] ?? null, w.measure]),
    [['carrier-fit-refused', 'dvs-stress-12288-9_5', 33]]
  );
  assert.deepEqual(
    report.diagnostics.filter((d) => d.code === 'carrier-mark-occlusion'),
    [],
    'no mark is destroyed anywhere in the specimen'
  );

  // Painted/refused exclusivity in the rendered stress band: every painted
  // carrier is a laid-out carrier, and the refused member paints none.
  const svg = renderJankoCrop(
    DVS,
    DURATION_VOCABULARY_BANDS.stress.first,
    DURATION_VOCABULARY_BANDS.stress.last - DURATION_VOCABULARY_BANDS.stress.first + 1,
    DVS_OPTS,
    DVS_TOKS,
    undefined,
    layouts
  );
  assert.ok(!svg.includes(`data-exception-note="${refusal.noteId}"`), 'never painted-and-refused');
  const painted = [...svg.matchAll(/data-exception-note="([^"]+)"/g)]
    .map((match) => match[1])
    .sort();
  // The specimen's measures are 384 ticks each (its own grid), so the band's
  // measure range maps directly onto its tick range.
  const band = new Set(
    layouts
      .flatMap((l) => l.exceptionCarriers)
      .filter((c) => c.tick >= (DURATION_VOCABULARY_BANDS.stress.first - 1) * 384)
      .filter((c) => c.tick < DURATION_VOCABULARY_BANDS.stress.last * 384)
      .map((c) => c.noteId)
  );
  assert.deepEqual(painted, [...band].sort(), 'painted carriers and laid-out carriers agree exactly');
  assert.ok(painted.length > 0, 'the stress band really carries painted carriers');

  // The corpus never states a three-tick value; the compact key does, and its
  // four-cut run is the one that sets the fixed length — so the run is checked
  // on painted geometry: four cuts whose stack spans exactly the 6.9146pt run.
  const m = midpointMetrics(DVS_TOKS, 0.75);
  const fourCuts = layouts
    .flatMap((l) => l.exceptionCarriers)
    .find((c) => c.noteId === 'dvs-exception-9216-7_5')!;
  assert.equal(fourCuts.durationTicks, 3, 'the three-tick value');
  assert.equal(fourCuts.cuts, 4, 'painted as four cuts');
  const cutBoxes = exceptionCarrierMarkBoxes(fourCuts, DVS_TOKS).filter((b) => b.kind === 'cut');
  assert.equal(cutBoxes.length, 4, 'four painted cuts');
  const runSpan = Math.max(...cutBoxes.map((b) => b.x1)) - Math.min(...cutBoxes.map((b) => b.x0));
  assert.ok(
    approx(runSpan, m.cutsRun, 1e-9),
    `the four-cut run sets the fixed length (${runSpan.toFixed(6)}pt)`
  );

  // The refused member keeps its own ink: still an admitted cluster member
  // with its reduced symbol, and never suppressed (the withheld carrier never
  // strips the ordinary duration statement it could not replace exactly).
  const member = layouts.flatMap((l) => l.notes).find((p) => p.note.id === refusal.noteId)!;
  assert.equal(member.symbolChord, true, 'the refused member is still an admitted cluster member');
  assert.equal(member.symbolScale, 0.75, 'and keeps its admitted symbol');
  for (const layout of layouts) {
    assert.ok(!suppressedStemIds(layout).has(refusal.noteId), 'its own duration ink is not suppressed');
  }
});

// ---------------------------------------------------------------------------
// 8. The whole-score report, pinned by identity: the two former fold findings
//    are gone, the six composites stay explicitly visible
// ---------------------------------------------------------------------------

test('Whole-score candidate report: exactly the six composite refusals, nothing hidden', () => {
  const layouts = layoutsOf(BRAHMS_STUDIO_SCORE_ID);
  const report = lintJankoScore(BRAHMS, BRAHMS_OPTS, BRAHMS_TOKS);
  assert.equal(report.ok, true, 'the candidate report is free of hard errors');
  assert.deepEqual(report.violations, [], 'zero violations — by identity, not by a count allowance');
  assert.deepEqual(
    report.warnings.map((w) => [w.code, w.noteIds?.[0], w.measure]),
    [
      ['carrier-duration-unsupported', 'brahms-op118-no1-295', 22],
      ['carrier-duration-unsupported', 'brahms-op118-no1-351', 26],
      ['carrier-duration-unsupported', 'brahms-op118-no1-448', 33],
      ['carrier-duration-unsupported', 'brahms-op118-no1-581', 42],
      ['carrier-duration-unsupported', 'brahms-op118-no1-637', 46],
      ['carrier-duration-unsupported', 'brahms-op118-no1-734', 53],
    ],
    'the six 120-tick tie composites stay explicitly visible until resolved'
  );
  assert.deepEqual(
    layouts.flatMap((l) => l.exceptionCarrierUnsupported).map((u) => [u.noteId, u.durationTicks]),
    [
      ['brahms-op118-no1-295', 120],
      ['brahms-op118-no1-351', 120],
      ['brahms-op118-no1-448', 120],
      ['brahms-op118-no1-581', 120],
      ['brahms-op118-no1-637', 120],
      ['brahms-op118-no1-734', 120],
    ],
    'the composites are refused as exact values (no invented glyph, no merge)'
  );
  // The two former m. 33 / m. 53 fold findings are gone by code and identity.
  for (const code of ['stem-through-simultaneity', 'chordal-overlap']) {
    assert.equal(report.diagnostics.some((d) => d.code === code), false, `${code} is absent`);
  }
  // Census: every source head, every clasp, every carrier. Round 45 — the
  // authorized m. 66 RH → LH correction makes the low A2 (t12552) / D3
  // (t12576) reattacks same-hand unisons with the preserved sustained
  // tie-wait voices, so the two former cross-hand unison merges no longer
  // merge: +2 painted heads (959). Both m. 66 pairs are one-family (same
  // pitch) rails, so neither is promoted into an admitted bracket under the
  // Round 43 nominal-rail doctrine — the 72-bracket census is unchanged on
  // this card's own parity surface.
  assert.equal(layouts.flatMap((l) => l.notes).length, 959, 'every laid-out head of the score');
  assert.equal(layouts.flatMap((l) => l.clasps).length, 72, 'the clasp furniture is complete');
  assert.equal(layouts.flatMap((l) => l.exceptionCarriers).length, 32, '32 painted carriers');
  assert.equal(layouts.length, 18, '18 systems of music');
  assert.equal(report.stats.notes, 959, 'the report walks the same notes');
  assert.equal(report.stats.systems, 18, 'and the same systems');
});

// ---------------------------------------------------------------------------
// 9. Served view + frozen canonicals
// ---------------------------------------------------------------------------

test('The parked Round 44 card still carries the whole score as five genuine page cards', () => {
  const layouts = layoutsOf(BRAHMS_STUDIO_SCORE_ID);
  const heads = layouts.flatMap((l) => l.notes);
  assert.equal(countJankoPages(BRAHMS, BRAHMS_OPTS, BRAHMS_TOKS), 5, 'the candidate spread is five A4 pages');

  // The parked registry verbatim: the historical card renders on its own nine
  // declared windows (the live registry is Round 45; the served page is pinned
  // in test/janko-studio.test.ts and test/janko-candidates.test.ts).
  const html = renderCandidatesView(
    createStudioConfig({ candidates: ROUND_44_CANDIDATES, round: ROUND_44_METADATA })
  );
  assert.match(html, /data-window-count="9"/, 'the grid states its nine declared windows');
  assert.deepEqual(
    [...html.matchAll(/data-window="([^"]+)"/g)].map((m) => m[1]),
    [
      'brahms-op118-no1:1-71',
      'brahms-op118-no1:5-5',
      'brahms-op118-no1:7-7',
      'brahms-op118-no1:8-8',
      'brahms-op118-no1:9-9',
      'brahms-op118-no1:35-36',
      'brahms-op118-no1:37-37',
      'brahms-op118-no1:67-67',
      'duration-vocabulary-specimen:17-24',
    ],
    'one window per declared review surface'
  );

  // Every focus window carries its own label (the review cues the hand-off
  // names, not anonymous crops).
  for (const label of [
    'Brahms m. 5 ',
    'Brahms m. 7 ',
    'Brahms m. 8 ',
    'Brahms m. 9 ',
    'Brahms mm. 35–36 ',
    'Brahms m. 37 ',
    'Brahms m. 67 ',
    'Duration key ',
  ]) {
    assert.ok(html.includes(`<b>${label}`), `the window label "${label}" is served`);
  }

  // The full-score window is genuine page cards, never one whole-score crop.
  const start = html.indexOf('candidate-window-pages');
  const full = html.slice(start, html.indexOf('data-window="brahms-op118-no1:5-5"'));
  assert.match(full, /data-window="brahms-op118-no1:1-71"/, 'labelled with its exact span');
  assert.match(full, /data-pages="5"/, 'and its page count');
  const pageCards = [...full.matchAll(/<figure class="page-card" data-page="(\d+)">/g)].map((m) => Number(m[1]));
  assert.deepEqual(pageCards, [1, 2, 3, 4, 5], 'one real page card per engine page');
  for (const n of pageCards) {
    assert.ok(full.includes(`<b>Page ${n}</b> · mm. `), `page ${n} carries its real measure range`);
  }

  // Every page is the engine's own A4 spread: the page viewBox, every painted
  // coordinate inside it, and one knockout per painted digit.
  const svgs = [...full.matchAll(/<svg class="janko-svg"[\s\S]*?<\/svg>/g)].map((m) => m[0]);
  assert.equal(svgs.length, 5, 'five page SVGs');
  const perPage: number[] = [];
  for (const [i, svg] of svgs.entries()) {
    assert.match(svg, /viewBox="0\.00 0\.00 595\.28 841\.89"/, `page ${i + 1}: the A4 page viewBox`);
    for (const attr of svg.matchAll(/\s(x|y|cx|cy|x1|y1|x2|y2)="(-?[\d.]+)"/g)) {
      const horizontal = attr[1][0] === 'x' || attr[1].startsWith('cx');
      const bound = horizontal ? 595.28 : 841.89;
      const value = Number(attr[2]);
      assert.ok(
        value >= -0.01 && value <= bound + 0.01,
        `page ${i + 1}: ${attr[1]}="${attr[2]}" stays inside the page viewBox`
      );
    }
    const digits = (svg.match(/class="janko-digit"/g) ?? []).length;
    const knockouts = (svg.match(/class="janko-knockout"/g) ?? []).length;
    assert.equal(digits, knockouts, `page ${i + 1}: every painted digit has its knockout`);
    assert.ok(digits > 0, `page ${i + 1}: the page carries music`);
    perPage.push(digits);
  }
  // Round 45 — the card rides the working Brahms entry (the adopted 0.90
  // treatment), and the m. 66 correction paints the two same-hand unison pairs
  // the cross-hand merge used to fold away: the closing page carries 65
  // painted digits, and the spread totals 959 heads.
  assert.deepEqual(perPage, [211, 232, 232, 219, 65], 'the engine page census');
  assert.equal(
    perPage.reduce((sum, n) => sum + n, 0),
    heads.length,
    'every laid-out source head paints exactly one digit across the five pages'
  );
  assert.equal(heads.length, 959, 'the whole Brahms candidate spread');
  assert.ok(!/<image|data:image|\.png|\.jpe?g/i.test(html), 'no raster artifact anywhere in the served view');
});

test('Frozen canonicals: Bach GOLD is byte-identical, the Brahms Reference is the adopted Round 45 treatment', () => {
  // The golden knobs the candidate deltas ride on top of.
  assert.equal(DEFAULT_JANKO_OPTIONS.pitchPlacement, 'standard');
  assert.equal(DEFAULT_JANKO_OPTIONS.bracketDurationGrammar, 'golden');
  assert.equal(DEFAULT_JANKO_OPTIONS.exceptionCarrier, 'none');
  assert.equal(DEFAULT_JANKO_OPTIONS.chordSymbolScale, 1);
  assert.equal(DEFAULT_JANKO_OPTIONS.opticalSpacing, false, 'the optical spacing is opt-in');
  assert.equal(DEFAULT_JANKO_OPTIONS.lowPitchFolding, 'core', 'the core folding stays the default');
  assert.equal(DEFAULT_JANKO_TOKENS.midpointSlashLength, 4.95, 'the midpoint family stays a study token');
  // Round 45 adopted the agreed 0.90 treatment for the working Brahms
  // Reference (the operator-chosen working golden experiment): the same one
  // coherent family the three candidate cards declare, at 0.90.
  const referenceOptions = resolveJankoOptions(BRAHMS_OP118_NO1_JANKO_OPTIONS);
  assert.equal(referenceOptions.pitchPlacement, 'parity-columns', 'the adopted parity placement');
  assert.equal(referenceOptions.chordSymbolScale, 0.9, 'at the operator-chosen 90 %');
  assert.equal(referenceOptions.bracketDurationGrammar, 'midpoint', 'the one 45-degree family');
  assert.equal(referenceOptions.exceptionCarrier, 'horizontal', 'horizontal remaining-value carriers');
  assert.equal(referenceOptions.opticalSpacing, true, 'declared, centred optical spacing');
  assert.equal(referenceOptions.lowPitchFolding, 'literal', 'literal low pitches');
  const referenceTokens = resolveJankoTokens(BRAHMS_OP118_NO1_JANKO_TOKENS);
  assert.equal(referenceTokens.midpointSlashLengthFactor, 1.1, 'the Round 45 slash ratio');
  assert.equal(referenceTokens.midpointRingScale, 1.1, 'the Round 45 ring ratio');
  assert.equal(referenceTokens.midpointSpacingFactor, 7 / 6, 'the 40 % total cut-spacing increase');
  assert.equal(referenceTokens.opticalClearanceAir, 0.2, 'the explicit 0.20pt optical air');

  const bach = lintJankoScore(BACH, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
  assert.deepEqual(bach.diagnostics, [], 'Bach GOLD: zero violations, zero warnings');
  // The Brahms Reference is honest, not clean: zero hard errors and exactly
  // the six published 120-tick composite refusals (the deferred follow-up).
  const reference = lintJankoScore(BRAHMS, BRAHMS_OP118_NO1_JANKO_OPTIONS, BRAHMS_OP118_NO1_JANKO_TOKENS);
  assert.equal(reference.violations.length, 0, 'Brahms Reference: zero hard errors');
  assert.deepEqual(
    reference.warnings.map((w) => [w.code, w.noteIds?.[0]]),
    [
      ['carrier-duration-unsupported', 'brahms-op118-no1-295'],
      ['carrier-duration-unsupported', 'brahms-op118-no1-351'],
      ['carrier-duration-unsupported', 'brahms-op118-no1-448'],
      ['carrier-duration-unsupported', 'brahms-op118-no1-581'],
      ['carrier-duration-unsupported', 'brahms-op118-no1-637'],
      ['carrier-duration-unsupported', 'brahms-op118-no1-734'],
    ],
    'the six 120-tick composites are published by exact identity, nothing filtered'
  );

  // Full-page byte pins (SHA-256). Bach GOLD is pinned to the pristine
  // pre-Round-44 worktree (PR #80 / d796043): untouched, byte for byte, by any
  // candidate-only or Brahms treatment work. The Brahms Reference pages are
  // re-pinned to the adopted Round 45 treatment — the operator-chosen change,
  // regenerated through the required `npm run pdf` release step.
  const sha = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');
  const bachPages = [
    '2a5c2abe6365250e9e9e5acd46f4effdc5f8b380cb0fc7cf689764dd239a534f',
    'dbfb83dcf008782d34e5260548c706d0cb980689eac58b24c7d0e7ae1e828757',
  ];
  for (let page = 0; page < bachPages.length; page++) {
    assert.equal(
      sha(renderJankoPage(BACH, page, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS)),
      bachPages[page],
      `Bach GOLD page ${page} is byte-identical`
    );
  }
  const brahmsPages = [
    '55d606e5b1b50bed15ddb16a4ad53a17c21eef401bfbd1e013377fd09a9f83b9',
    'f7f2fef428b52aa78d2e827f711967bb0984bb5b6bb53113a7d16bb6f3167098',
    'f33bf7c762f3f96f2b354e90b2c51a3a270adf1f9506f46e9a1213afdb851765',
    '705936c03d9002cdd7b443920aa0fa24ba9ffeff6af4d6f01643df9c9c2240b8',
    '8f128a67eac371d154a0d55bda7c4e4cf33d585d296d9fb18987ee389e73d6a1',
  ];
  for (let page = 0; page < brahmsPages.length; page++) {
    assert.equal(
      sha(renderJankoPage(BRAHMS, page, BRAHMS_OP118_NO1_JANKO_OPTIONS, BRAHMS_OP118_NO1_JANKO_TOKENS)),
      brahmsPages[page],
      `Brahms Reference page ${page} is the adopted Round 45 engraving`
    );
  }
  assert.equal(
    sha(renderJankoCrop(BRAHMS, 1, 71, BRAHMS_OP118_NO1_JANKO_OPTIONS, BRAHMS_OP118_NO1_JANKO_TOKENS)),
    '5ed2c9c79285266f03ac9ca4398669d836f624253006f98f5b666401c23ef543',
    'the Brahms Reference 1–71 crop is the adopted Round 45 engraving'
  );
});
