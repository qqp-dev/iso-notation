/**
 * Jánko Decision Candidate Registry
 * =================================
 *
 * This is the **only** file that changes when the designer opens a new decision
 * round. The Live Studio (`public/janko.html` → `studio.ts`) renders whatever is
 * declared here — labels, option badges, SVG previews and lint status — with
 * zero template edits.
 *
 * Declaring a candidate costs five lines:
 *
 * ```ts
 * {
 *   id: 'corridor-hairline',
 *   label: 'Continuous Hairline',
 *   description: 'Solid spine reads as one uninterrupted Middle C axis.',
 *   options: { middleCSpine: 'continuous' },
 * }
 * ```
 *
 * Anything omitted falls back to the golden master
 * ({@link DEFAULT_JANKO_OPTIONS} / {@link DEFAULT_JANKO_TOKENS}), so a candidate
 * only ever states its *delta* to the current benchmark.
 */

import {
  DEFAULT_JANKO_OPTIONS,
  DEFAULT_JANKO_TOKENS,
  JankoLayoutOptions,
  JankoTokens,
  ResolvedJankoLayoutOptions,
  ResolvedJankoTokens,
  resolveJankoOptions,
  resolveJankoTokens,
  AbstractGeometryId,
  ABSTRACT_GEOMETRY_SPECS,
  ABSTRACT_SUBSET_1,
  ABSTRACT_SUBSET_2,
  ABSTRACT_BASE_SET,
  ABSTRACT_NEAR_NEIGHBOUR_SAMPLES,
  ABSTRACT_DENSITY_SAMPLES,
  ABSTRACT_LADDER_OCTAVE_PROBE_SAMPLES,
  formatDuodecimalDigit,
  formatPitchClassSet,
  computeTranspositionSet,
} from './types';

/** Metadata of the decision round currently on the table. */
export interface JankoCandidateRound {
  /** Consecutive round number (1 = first exploratory round). */
  round: number;
  /** Short round title, shown as the studio's view-1 headline. */
  title: string;
  /** One-paragraph design question the candidates are answering. */
  description: string;
  /**
   * The round's **open axes**: the option keys the candidates exist to decide.
   *
   * Every candidate states its value on an open axis as a badge, even when that
   * value happens to be the incumbent golden one — the axis itself is the
   * question on the table. Every other key keeps the strict *delta* rule, so a
   * locked decision (the flared bracket, the clasp paradigm, the rest dialect)
   * rides along as shared fixed context and never appears as a candidate badge.
   */
  openAxes?: string[];
  /** Closer-comparison strip (absent: no strip, cards only). */
  compareStrip?: JankoCompareStrip;
}

/**
 * The closer-comparison strip: one macro window engraved under every card's
 * options and laid side by side above the full-page cards, so the eye can
 * flick between schemes without scrolling.
 */
export interface JankoCompareStrip {
  /**
   * Studio score id the strip is engraved from. Defaults to the studio's
   * primary score (`'primary'` = the Bach Goldberg Var. 1 benchmark).
   */
  scoreId?: string;
  /** First measure of the strip window (1-based). */
  measureStart: number;
  /** Measures shown in the strip window. */
  measureCount: number;
  /** Short label shown above the strip. */
  title: string;
}

/** One engraving window demonstrated on a score benchmark. */
export interface JankoScoreCandidateWindow {
  kind?: 'score';
  /**
   * Studio score id the window is engraved from. Defaults to the studio's
   * primary score (`'primary'` = the Bach Goldberg Var. 1 benchmark).
   */
  scoreId?: string;
  /** First measure of the window (1-based). */
  measureStart: number;
  /** Measures shown in the window. */
  measureCount: number;
  /** Short label shown above the panel. */
  title: string;
  /** Optional caption. */
  caption?: string;
}

/** Abstract specimen role: enlarged key, common test batteries, or historical subsets. */
export type AbstractSpecimenType =
  | 'key'
  | 'transposition'
  | 'near-neighbours'
  | 'density'
  | 'octave-probe'
  | 'subset-1'
  | 'subset-2';

/** Single specimen item metadata within an abstract specimen window. */
export interface AbstractSpecimenSample {
  readonly id: string;
  readonly title: string;
  readonly caption?: string;
  readonly subset: readonly number[];
  readonly description?: string;
}

/** One engraving window demonstrated on an abstract twelve-site geometry specimen. */
export interface JankoAbstractCandidateWindow {
  kind: 'abstract';
  /** Geometry arrangement evaluated. */
  geometryId: AbstractGeometryId;
  /** Specimen role: enlarged key, common battery, or octave probe. */
  specimenType: AbstractSpecimenType;
  /** Subset site indices (for single-subset specimens). */
  subset?: readonly number[];
  /** Detailed samples list when window represents a battery. */
  samples?: readonly AbstractSpecimenSample[];
  /** Short label shown above the panel. */
  title: string;
  /** Short caption. */
  caption?: string;
}

/** Discriminated union of score-engraving windows and abstract-geometry windows. */
export type JankoCandidateWindow = JankoScoreCandidateWindow | JankoAbstractCandidateWindow;

/** True if candidate window is an abstract geometry specimen. */
export function isAbstractCandidateWindow(
  w: JankoCandidateWindow
): w is JankoAbstractCandidateWindow {
  return (w as { kind?: string }).kind === 'abstract';
}

/** Constructor for a 3× enlarged twelve-site key window. */
export function abstractKeyWindow(
  geometryId: AbstractGeometryId,
  title = 'Twelve-site key (3×)',
  caption?: string
): JankoAbstractCandidateWindow {
  return {
    kind: 'abstract',
    geometryId,
    specimenType: 'key',
    title,
    caption:
      caption ??
      `Full configuration (0–b) · ${ABSTRACT_GEOMETRY_SPECS[geometryId].boundsString} nominal ink bounds (enlarged 3×)`,
  };
}

/** Constructor for a 12-sample transposition battery window. */
export function abstractTranspositionWindow(
  geometryId: AbstractGeometryId,
  title = 'Transposition battery (T+0 .. T+b)',
  caption = 'All twelve transpositions of S={0,3,7,a} modulo 12 · Fixed origin and 1:1 scale'
): JankoAbstractCandidateWindow {
  const samples: AbstractSpecimenSample[] = Array.from({ length: 12 }, (_, t) => {
    const subset = computeTranspositionSet(ABSTRACT_BASE_SET, t);
    const duodT = formatDuodecimalDigit(t);
    const setStr = formatPitchClassSet(subset);
    return {
      id: `t-${duodT}`,
      title: `T+${duodT}`,
      caption: `t=${duodT} · ${setStr}`,
      subset,
    };
  });
  return {
    kind: 'abstract',
    geometryId,
    specimenType: 'transposition',
    title,
    caption,
    samples,
  };
}

/** Constructor for a 4-sample near-neighbours battery window. */
export function abstractNearNeighboursWindow(
  geometryId: AbstractGeometryId,
  title = 'Near neighbours',
  caption = 'Four close variants on base S={0,3,7,a} · 1-semitone vs 2-semitone changes'
): JankoAbstractCandidateWindow {
  return {
    kind: 'abstract',
    geometryId,
    specimenType: 'near-neighbours',
    title,
    caption,
    samples: ABSTRACT_NEAR_NEIGHBOUR_SAMPLES,
  };
}

/** Constructor for a 5-sample density battery window. */
export function abstractDensityWindow(
  geometryId: AbstractGeometryId,
  title = 'Density battery',
  caption = 'Sparse and adjacent occupancy (2, 3, 6, 9, 11 selected sites) · Fixed origin and 1:1 scale'
): JankoAbstractCandidateWindow {
  return {
    kind: 'abstract',
    geometryId,
    specimenType: 'density',
    title,
    caption,
    samples: ABSTRACT_DENSITY_SAMPLES,
  };
}

/** Constructor for the supplemental ladder octave-boundary probe window. */
export function abstractLadderOctaveProbeWindow(
  title = 'Supplemental octave-boundary probe (ladder only)',
  caption = 'Unfolded: translation + reflection; folded into twelve sites: shape breaks. Continuing pitch vertically costs height.'
): JankoAbstractCandidateWindow {
  return {
    kind: 'abstract',
    geometryId: 'ladder',
    specimenType: 'octave-probe',
    title,
    caption,
    samples: ABSTRACT_LADDER_OCTAVE_PROBE_SAMPLES,
  };
}

/** Constructor for a four-site subset sample window. */
export function abstractSubsetWindow(
  geometryId: AbstractGeometryId,
  specimenType: 'subset-1' | 'subset-2',
  title: string,
  caption?: string
): JankoAbstractCandidateWindow {
  const subset = specimenType === 'subset-1' ? ABSTRACT_SUBSET_1 : ABSTRACT_SUBSET_2;
  return {
    kind: 'abstract',
    geometryId,
    specimenType,
    subset,
    title,
    caption,
  };
}

/** One exploratory engraving candidate for the current decision round. */
export interface JankoCandidate {
  /** Stable slug (used as DOM id / data attribute in the studio). */
  id: string;
  /** Display label. */
  label: string;
  /** One-line designer rationale. */
  description?: string;
  /** Candidate kind: score candidate (default) or abstract geometry candidate. */
  kind?: 'score' | 'abstract';
  /** Abstract geometry arrangement (for abstract candidates). */
  abstractGeometry?: AbstractGeometryId;
  /**
   * The **open axis** this candidate exists to decide. Only this axis is ever
   * badged, even when the round has more than one open axis: per-candidate
   * purity means a spacing candidate never shows a rest-dialect badge and
   * vice versa.
   */
  axis?: string;
  /** Macro-layout delta against the golden master. */
  options?: Partial<JankoLayoutOptions>;
  /** Micro-typography delta against the golden master. */
  tokens?: Partial<JankoTokens>;
  /** First measure of the comparison window (1-based, default 1). */
  measureStart?: number;
  /** Measures shown in the comparison window (default 1). */
  measureCount?: number;
  /**
   * Every engraving window the candidate is demonstrated on (defaults to the
   * single `measureStart` / `measureCount` window on the primary score).
   */
  windows?: JankoCandidateWindow[];
  /** Free-form tags rendered as badges next to the label. */
  tags?: string[];
}

/** Score id of the studio's primary benchmark (Bach Goldberg Var. 1). */
export const DEFAULT_STUDIO_SCORE_ID = 'primary';

/** Score id of the Brahms Intermezzo benchmark, a first-class surface since Round 30. */
export const BRAHMS_STUDIO_SCORE_ID = 'brahms-op118-no1';

/**
 * Round 30: standing Brahms window support. Brahms (cut time, 192
 * ticks/measure, 48-tick upbeat) windows exactly like the primary score, by
 * measure. The Round-29 literal-first rule generalizes: every window shows
 * LITERAL corpus measures (a probe in the ticket's lineage records the
 * exact ticks and note ids framed); a synthetic specimen is admissible only
 * when no literal passage can demonstrate the question, and then the
 * caption says so. This constructor keeps Brahms windows honest by
 * construction.
 */
export function brahmsWindow(
  measureStart: number,
  measureCount: number,
  title: string,
  caption?: string
): JankoCandidateWindow {
  return {
    scoreId: BRAHMS_STUDIO_SCORE_ID,
    measureStart,
    measureCount,
    title,
    ...(caption ? { caption } : {}),
  };
}

/**
 * Score id of the curated multi-duration chord specimen (Round 9): five
 * three-voice chords, one per value of the duration taxonomy.
 */
export const SPECIMEN_STUDIO_SCORE_ID = 'chord-duration-specimen';

/**
 * Score id of the curated rest-duration specimen (Round 15): four measures,
 * one genuine silence per value (16th / 8th / quarter / half), each on a column
 * guaranteed free of the other hand's heads.
 */
export const REST_SPECIMEN_STUDIO_SCORE_ID = 'rest-duration-specimen';

/**
 * Score id of the curated duration working-set specimen (Round 21 §E): 32nd and
 * 64th runs, mixed levels, lone partial beams and solo flags.
 */
export const DURATION_SPECIMEN_STUDIO_SCORE_ID = 'duration-specimen';

/**
 * The round currently under review.
 *
 * Round 1 settled the rhythm dialect (Variant B — traditional beamed), round 2
 * the Klavarskribo beat grid, round 3 the Middle C corridor, round 4 the octave
 * framing, round 5 the external left clasp, round 6 the single-note subdivision
 * dialects with the per-hand clasp, round 7 the kinetic subdivision tabs with
 * gap-gated vertical chording, round 8 the symmetrical clasp with the
 * beam-harmonized tab, round 9 the midpoint duration taxonomy, round 10 the
 * scaled midpoint clasps with the retired accolade, round 11 the four System 1
 * start replacements with the light transverse cuts, round 12 the rest symbol
 * dialects on the continuous vertical grid, round 13 the voice-contour rests
 * under the flared 0.65pt bracket, round 14 the restored per-hand clasp on the
 * dense 16ths of mm. 27–28, round 15 the crowded column behind hard beat-cell
 * barriers with the four rest dialects, round 16 the cluster doctrine with the
 * judged horizontal spacing, round 17A the rectangular mask with the v2 spacing
 * solver and the hugging dots, round 17B the `tight` verdict with the
 * phrase-row rests, round 18 the rest-shape verdict, round 19 the
 * symmetric-tuck clusters with the RH anchor approved, round 20 the
 * verification of the optical seats / urtext re-cut / unison merge /
 * clasp-dot fix, round 21 the measured duration ink with the slab seats and
 * the whole→64th working set, round 22 the verbatim Bravura transcription,
 * round 23 the three pitch-contour paradigms, round 24 the continuous
 * pitch-mapping paradigms, round 25 the grand grid's octave-line schemes,
 * round 26 the 0-line decision, and round 27 the fixed cores 3-vs-4 decision
 * on Brahms with real Gould ottava brackets.
 *
 * **Round 27 is a CORE round: one open axis, two answers to one question.**
 * Window-following octave lines cannot look centered: each line count has
 * exactly one middle-C-centered grammar (3 ⟺ C-lines C3–C5; 4 ⟺ middles o2–o5),
 * plus per-bar need-based rows (core±1 max) and ottava beyond extensions.
 * Judged on Brahms Op. 118/1 (lin 9–78, 964 notes) with real Bravura ottava
 * glyphs and Gould dashed spanners.
 *
 * Can we drop to 3, or does 4's floor earn its ink? Control is fixed-4
 * (o2–o5 middles, 1 folded note in m. 69), contender is fixed-3 (C3–C5 C-lines,
 * 9 folded notes across mm. 5, 15, 23, 33, 43, 53, 67, 69).
 *
 * Round 28 opens the extension-junction round on Bach Goldberg Var 1: where an
 * extension-row terminal abuts a measure barline (m. 29/30), does clean design
 * favor contact (Card A — conjoin) or separation (Card B — wide gap)? No
 * control card in View 1: the Reference view carries the standing golden look.
 *
 * Round 29 lands the dot/extension/rest flips golden and renders
 * Reference-only. Round 30 previews the complete duration grammar on Brahms
 * (Brahms joins the Reference as a first-class surface): lone longs ring,
 * every dotted value dots, flags and beam levels derive from the notated
 * base. Two cards, one axis, no control — the Reference is the control.
 * Round 30 is judged WITHHELD and parked (see the historical consts in
 * `test/janko-round30.test.ts`); it returns for judgment post-cleanup.
 *
 * Round 31 previews the approved situational clasp-dot nudge — bracket dots
 * step lower-right by one uniform vector — on the two pinned white-ring dots
 * (Brahms m.1 tick 48 and its m.3 tick-432 twin). One card, one axis, no
 * control — the fixed-3 BRONZE Reference is the control. Round 31 is parked
 * (see the historical consts in `test/janko-round31.test.ts`).
 *
 * Round 32 is the settled-packing grid round on Brahms: first system pickup
 * + four full measures (five displayed slots), later systems four full
 * measures — the packing itself is settled, not a vote. Both cards carry the
 * opt-in page-top anacrusis width correction on the fixed-3 core at four
 * systems/page; the open axis is the interior grid only (existing
 * quarter-position pulses vs midpoint-only keeping the third quarter
 * position). The mm. 57–64 paired window exposes the known new
 * adjacent-system overlap under investigation. Candidate-only: no canonical
 * promotion, no Reference change. Round 32 is parked (see the historical
 * consts in `test/janko-round32.test.ts`); midpoint-only is REJECTED — the
 * full grid stays canonical until Round 33 is judged.
 *
 * Round 33 re-asked the grid question with every settled refinement SHARED by
 * both cards (lowest-inward cluster slots, m19-style 45° bracket dots, the E3
 * rest level, lighter ottava glyphs): full interior quarter-position grid vs
 * NO interior grid, on the six literal Brahms windows pickup+mm1–4, mm5–8,
 * mm17–20, mm33–36, mm53–56, mm57–64. DECIDED: the full grid is selected —
 * the settled packing, the page-top correction and every shared refinement
 * are canonical (see the Brahms score options), and no comparison remains.
 * The historical cards are parked as `ROUND_33_METADATA` / `ROUND_33_CANDIDATES`
 * in `test/janko-round33.test.ts`; nothing is lost.
 *
 * Round 34 opened the m.33 fold-coincident octave-pair comparison on Brahms:
 * literal fold vs shared transposition vs true octave. Parked by convention
 * as ROUND_34_METADATA / ROUND_34_CANDIDATES in test/janko-round34.test.ts.
 *
 * Round 35 opened the hand-cluster compression candidate comparison on Brahms:
 * write an absolute pitch shape once and represent its simultaneous occurrences
 * in other registers. Rejected by operator judgment. Parked by convention
 * as ROUND_35_METADATA / ROUND_35_CANDIDATES in test/janko-round35.test.ts.
 *
 * Round 36 opened the mirrored-handprint candidate comparison on Brahms:
 * a dense hand cluster has one recognizable musical form, readable whole-first
 * with exact internal detail recoverable. Rotated keyboard footprint supplies
 * glyph-local geometry with two symmetric variants for the alternating Jánko
 * row families. Tested against literal control on identical Brahms windows
 * mm. 7–9, 46–47, 60–61, 66–67. Parked by convention as ROUND_36_METADATA /
 * ROUND_36_CANDIDATES in test/janko-round36.test.ts.
 *
 * Round 37 opens the intrinsically indexed symmetric cluster candidate comparison on Brahms:
 * slender stroked paths (~0.5pt) rather than solid 1.6pt body; discrete 2-semitone
 * reference divisions with duodecimal 10-span (12-semitone) octave boundary markers;
 * sounding landmarks are paired outward articulations; duration vocabulary with explicit
 * visible ownership (connecting rails for runs, individual connectors for singletons);
 * full-score m.60 candidate eligibility retaining source-hand memberships and reusing
 * shared painted bass anchor; judged against literal control on identical Brahms windows
 * mm. 7–9, 46–47, 60–61, 66–67, m.71, plus a synthetic m.8 G3→A3 diagnostic.
 * Rejected visually by operator judgment (PR73, 266bd65e98f7). Parked by convention
 * as ROUND_37_METADATA / ROUND_37_CANDIDATES in test/janko-round37.test.ts.
 *
 * Round 38 opens the twelve-site spatial alphabet comparison:
 * Which compact twelve-site arrangement makes selected subsets distinguishable
 * and learnable with the least visual noise? No optimality or human-readability
 * claim. Evaluates Dial, Rosette, and Asymmetric constellation across identical
 * keys and {0,3,7,a} vs {0,5,7,a} subsets. Parked by convention as
 * ROUND_38_METADATA / ROUND_38_CANDIDATES in test/janko-round38.test.ts.
 *
 * Round 39 opens the twelve-site alphabets under strain comparison:
 * Exactly three active cards: Dial, Rosette, Staggered pitch ladder.
 * Identical common stress battery:
 * 1. Enlarged labelled key (3×)
 * 2. Transposition battery: 12 transpositions of S={0,3,7,a} modulo 12
 * 3. Near neighbours: four samples S, {0,4,7,a}, {0,5,7,a}, {0,3,7,b}
 * 4. Density battery: five samples (2, 3, 6, 9, 11 selected sites)
 * Supplemental octave-boundary probe (ladder only):
 * tests unfolded lattice vs modulo-12 folding.
 *
 * Round 40 opened the numbered two-column pitch placement comparison
 * (control / parity-scale-068 / parity-scale-080). Parked by convention as
 * ROUND_40_METADATA / ROUND_40_CANDIDATES in test/janko-round40.test.ts.
 *
 * Round 41 opens the exceptional-duration release-endpoint comparison:
 * exactly three active cards (stop bar, diamond, ring) sharing the 75 %
 * chord-member symbol scale, the tightened chord masks, one thin connector and
 * one white rule-replacing band — the terminal shape is the only open axis.
 * The canonical treatment (`durationEndpoint: 'none'`, `chordSymbolScale: 1`)
 * is unchanged and the Reference view stays the untouched control.
 *
 * Round 42 opens the shared-bracket duration-vocabulary comparison: exactly
 * four matched columns (current ordinary / current bracket / compact bracket /
 * compact horizontal exception) over one registered specimen, on four shared
 * windows (main band + augmentation + beam + stress strips). Round 41’s cards
 * are parked by convention as ROUND_41_METADATA / ROUND_41_CANDIDATES in
 * test/janko-round41.test.ts.
 */

/** Score id of the synthetic m.8 diagnostic specimen (Round 37, parked). */
export const SYNTHETIC_M8_DIAGNOSTIC_SCORE_ID = 'synthetic-m8-diagnostic';

/**
 * Score id of the Round 41 hold-endpoint specimen (registered real score):
 * the three exceptional-duration situations the corpus never states — a
 * three-duration chord whose longer exception sits on an octave-line rule, a
 * release with no attack at its tick, and a genuine system-boundary
 * continuation (`src/scores/hold-endpoint-specimen.ts`).
 */
export const HOLD_ENDPOINT_SPECIMEN_STUDIO_SCORE_ID = 'hold-endpoint-specimen';

/** Score id of the Phase-3 (Round 42) duration-vocabulary specimen. */
export const DURATION_VOCABULARY_SPECIMEN_STUDIO_SCORE_ID = 'duration-vocabulary-specimen';

/** Score id of the Round 43 pitch-parity specimen (1-span / 2-span / octave). */
export const PITCH_PARITY_SPECIMEN_STUDIO_SCORE_ID = 'pitch-parity-specimen';

/** Metadata of the Round 43 decision round (reusable pitch + symbolic-duration study). */
export const CURRENT_ROUND_METADATA: JankoCandidateRound = {
  round: 43,
  title: 'Reusable pitch + symbolic-duration study — Round 43',
  description:
    'One proposed **midpoint** design is judged on fixed, reusable cases that stay put across later tuning: two-column whole-tone **parity** pitch placement (even family left, odd family right), and one **unified diagonal-slash** duration family painted **identically** on the shared bracket and on the horizontal exception carrier. The cut is the midpoint of the golden 7.5pt/1.0pt cut and the compact 2.4pt/0.42pt cut (4.95pt at 0.71pt stroke, page-raked 0.22 rail-so-equal rise), the ring the midpoint of the golden R2.40/0.80pt and compact R0.80/0.38pt rings (R1.60pt at 0.59pt stroke). Counts are shared with the compact study (4/3/2/1 cuts; bare; 1/2/3 rings). Only genuinely admitted bracket members take the 75 % pitch-symbol size; a clean two-note column stays full size. Every spacing and the fixed carrier length are derived from the emitted endpoints and stroke, never copied from the rejected memo. The canonical Reference, goldens and PDF are untouched.',
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
      'The RH downbeat 2/4 · 5/4 · 9/3 · 9/4 · 11/3 (all 96-tick) is the densest onset: its members split across both parity columns by absolute pitch parity, the odd family stacked on the right and the lone even 2/4 on the left, under one shared 96-tick bracket (one ring).'
    ),
    brahmsWindow(
      8,
      1,
      'Brahms m. 8 · one-column 2-span pairs, 10-span repeats, second-onset exception',
      'The RH downbeat 5/3 · 5/4 · 7/3 · 7/4 · 11/3 is ALL odd, so every member shares one parity column: the 2-span neighbours (5/3→7/3, 5/4→7/4) sit 5.0pt apart and the 10-span repeats (5/3→5/4) 30.0pt apart. At the second onset the 11/3 states 48 against its bracket’s carried 96 — a genuine exception, whose own value is marked on the carrier, not by the carrier’s length.'
    ),
    brahmsWindow(
      9,
      1,
      'Brahms m. 9 · multiple exceptions on one column',
      'The RH downbeat 5/3 · 5/4 · 7/3 · 7/4 · 11/3 (all odd, one column) states 144 · 192 · 144 · 192 · 144: the two 192-tick members are exceptions against the carried 144, each stating its own value with the compact counts (2 rings) on its own carrier, so a single chord owns two exceptions without moving a pitch.'
    ),
    brahmsWindow(
      35,
      2,
      'Brahms mm. 35–36 · transposed related triads (source-verified)',
      'Literal source check: m. 35’s RH triad 7/4 · 7/5 · 0/5 is exactly m. 5’s 4/4 · 4/5 · 9/4 transposed up 3 semitones (same shape, both parity columns, one 96-tick value); m. 36 restates the SAME m. 5 shape one step off, its middle member raised a 1-span (4/4 · 10/4 · 4/5) — the same reading, re-spelled.'
    ),
    brahmsWindow(
      37,
      1,
      'Brahms m. 37 · exception ownership on one column',
      'The RH downbeat 0/4 · 0/5 · 6/4 (all even, one parity column) states 96 · 96 · 48: the 48-tick member is the exception against the bracket’s carried 96, and the carrier’s own marks — not its fixed length — state that value. Single-note ownership: the pitch symbol never moves.'
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
      'Stress · specimen mm. 33–34 — next-onset full-size neighbour, staff rule, two exceptions',
      'm. 33: an admitted bracket whose 192-tick top exception is re-taken a 16th later by a full-size, unbracketed 2-span same-column dyad — the true close neighbour under next-onset pressure; m. 34: two exceptions of different values (192 and 6) in one chord, the 192 sitting on the lin-60 octave-line rule. Shortfalls are published, never clipped.'
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
export const CURRENT_CANDIDATES: JankoCandidate[] = [
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

/** A fully resolved candidate, ready to engrave. */
export interface ResolvedJankoCandidate {
  candidate: JankoCandidate;
  options: ResolvedJankoLayoutOptions;
  tokens: ResolvedJankoTokens;
  measureStart: number;
  measureCount: number;
  /** Every window the candidate is demonstrated on (never empty). */
  windows: JankoCandidateWindow[];
}

/** Fill a candidate's deltas in against the golden master. */
export function resolveCandidate(candidate: JankoCandidate): ResolvedJankoCandidate {
  const isAbstract =
    candidate.kind === 'abstract' ||
    (candidate.windows && candidate.windows.some(isAbstractCandidateWindow));
  if (isAbstract && candidate.windows && candidate.windows.length > 0) {
    return {
      candidate,
      options: resolveJankoOptions(DEFAULT_JANKO_OPTIONS),
      tokens: resolveJankoTokens(DEFAULT_JANKO_TOKENS),
      measureStart: 1,
      measureCount: 1,
      windows: candidate.windows,
    };
  }

  const windows: JankoScoreCandidateWindow[] =
    candidate.windows && candidate.windows.length > 0
      ? candidate.windows.map((w) => ({
          kind: 'score' as const,
          scoreId: (w as JankoScoreCandidateWindow).scoreId ?? DEFAULT_STUDIO_SCORE_ID,
          measureStart: (w as JankoScoreCandidateWindow).measureStart ?? 1,
          measureCount: (w as JankoScoreCandidateWindow).measureCount ?? 1,
          title: w.title,
          caption: (w as JankoScoreCandidateWindow).caption,
        }))
      : [
          {
            kind: 'score' as const,
            scoreId: DEFAULT_STUDIO_SCORE_ID,
            measureStart: candidate.measureStart ?? 1,
            measureCount: candidate.measureCount ?? 1,
            title: '',
          },
        ];
  return {
    candidate,
    options: resolveJankoOptions({ ...DEFAULT_JANKO_OPTIONS, ...(candidate.options ?? {}) }),
    tokens: resolveJankoTokens({ ...DEFAULT_JANKO_TOKENS, ...(candidate.tokens ?? {}) }),
    measureStart: candidate.measureStart ?? (windows[0] ? windows[0].measureStart : 1),
    measureCount: candidate.measureCount ?? (windows[0] ? windows[0].measureCount : 1),
    windows,
  };
}

/** One human-readable option delta, rendered as a badge in the studio. */
export interface CandidateOptionBadge {
  key: string;
  value: string;
  /** The golden-master value this candidate departs from. */
  golden: string;
  /**
   * True when the key is one of the round's **open axes** (see
   * {@link JankoCandidateRound.openAxes}). An open-axis badge is always shown,
   * even when the candidate's value equals the golden master, because the axis
   * itself is the question on the table.
   */
  axis?: boolean;
}

/**
 * Option/token deltas of a candidate versus the golden master.
 *
 * A key is badged when the candidate's value **differs** from the golden
 * master, or when the key is one of the round's open axes — so every candidate
 * states its value on the round's question (including the incumbent one) while
 * a locked decision that rides along as shared context never shows up.
 */
export function candidateBadges(
  candidate: JankoCandidate,
  round: JankoCandidateRound = CURRENT_ROUND_METADATA
): CandidateOptionBadge[] {
  if (candidate.kind === 'abstract' || candidate.abstractGeometry) {
    const geomId = candidate.abstractGeometry!;
    const spec = ABSTRACT_GEOMETRY_SPECS[geomId];
    return [
      { key: 'arrangement', value: spec.name, golden: 'n/a', axis: true },
      { key: 'nominalBounds', value: spec.boundsString, golden: spec.boundsString },
      { key: 'minSeparation', value: '≥4.0pt', golden: '≥4.0pt' },
      { key: 'nodeRadius', value: '0.55pt', golden: '0.55pt' },
    ];
  }

  const badges: CandidateOptionBadge[] = [];
  const golden = resolveJankoOptions(DEFAULT_JANKO_OPTIONS);
  const goldenTokens = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
  const openAxes = new Set(round.openAxes ?? []);

  // A candidate badges the axis it declares (`candidate.axis`) — never any
  // other open axis — so per-candidate purity stays visible: a spacing
  // candidate shows only its spacing delta.
  const isOwnAxis = (key: string): boolean =>
    openAxes.has(key) && (candidate.axis === undefined || candidate.axis === key);
  for (const [key, value] of Object.entries(candidate.options ?? {})) {
    const gold = (golden as unknown as Record<string, unknown>)[key];
    const axis = isOwnAxis(key);
    if (gold !== value || axis) {
      badges.push({ key, value: String(value), golden: String(gold), ...(axis ? { axis } : {}) });
    }
  }
  for (const [key, value] of Object.entries(candidate.tokens ?? {})) {
    const gold = (goldenTokens as unknown as Record<string, unknown>)[key];
    const axis = isOwnAxis(key);
    if (gold !== value || axis) {
      badges.push({ key, value: String(value), golden: String(gold), ...(axis ? { axis } : {}) });
    }
  }
  if (badges.length === 0) {
    badges.push({ key: 'baseline', value: 'golden master', golden: 'golden master' });
  }
  return badges;
}

/** Look one candidate up by id. */
export function getCandidate(id: string): JankoCandidate | undefined {
  return CURRENT_CANDIDATES.find((c) => c.id === id);
}
