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
  /**
   * Round 44: render this window as the score's **genuine pages** — one
   * real page card per page of the score (the engine's A4 page spread — the
   * same one the Reference view uses), not one crop whose viewBox happens to
   * cover the whole score. A full-score window states `measureStart: 1` /
   * `measureCount: <measure count>` so its `data-window` label stays exact.
   */
  fullScore?: boolean;
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
 *
 * Round 43 opened the reusable pitch + symbolic-duration study on fixed cases
 * (two-column whole-tone parity placement plus the unified midpoint
 * diagonal-slash duration family on both mounts). Parked by convention as
 * ROUND_43_METADATA / ROUND_43_CANDIDATES in test/janko-round44.test.ts.
 *
 * Round 44 opened the anchored-cluster + compact shared-duration-ink round:
 * exactly one card (`anchored-45-ink`) judged on the **whole** Brahms score —
 * all 71 measures as genuine engine page spreads — plus the re-aimed focus
 * measures and the compact labelled duration key. Parity placement became an
 * **anchoring** rule gated by admission, the duration ink one 45-degree family
 * at the admitted cluster scale on both mounts, and the fixed carrier's fit was
 * decided before paint.
 *
 * Round 45 opens the larger-readable-clusters round on the **working** Brahms
 * Reference: three otherwise identical full-score cards at admitted cluster
 * scales 0.85 / 0.90 / 0.95 beside the 0.90 Reference, with declared centred
 * optical cluster spacing (0.20pt air, ≤2.5pt per glyph), the Round 45 duration
 * ratios on both mounts, no residual vertical shared-duration stem for an
 * eligible cluster, literal low pitches for m. 5/15/22/33/42/53/67/68/69, the
 * source-verified m. 66 RH → LH correction, and the studio's phone-safe review
 * session. Round 44's card is parked as ROUND_44_METADATA /
 * ROUND_44_CANDIDATES in test/janko-round44.test.ts. Bach GOLD stays frozen and
 * the six 120-tick composites (m. 22:295, m. 26:351, m. 33:448, m. 42:581,
 * m. 46:637, m. 53:734) remain published `carrier-duration-unsupported`
 * warnings — deferred to the tied-duration follow-up, never hidden.
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

/**
 * Metadata of the Round 45 decision round — larger, readable Brahms clusters
 * with declared centred optical spacing, one horizontal cluster-duration
 * grammar, literal low pitches, the m. 66 hand correction and the phone-safe
 * review session.
 *
 * Round 44's single `anchored-45-ink` card is parked by convention as
 * ROUND_44_METADATA / ROUND_44_CANDIDATES in test/janko-round44.test.ts.
 *
 * Round 45 keeps exactly two consistent surfaces: the **working Brahms
 * Reference** (the agreed 0.90 treatment, adopted by
 * `BRAHMS_OP118_NO1_JANKO_OPTIONS`) and the three candidate scales 0.85 /
 * 0.90 / 0.95, which are otherwise identical and engrave the whole score on
 * the real engine. The 0.90 candidate and the Reference must agree for the
 * same score/options. Bach GOLD stays frozen.
 */
export const ROUND_47_METADATA: JankoCandidateRound = {
  round: 47,
  title: 'Long-value symbols, the half-ring flat face and the tie-origin simplification — Round 47',
  description:
    'Round 47 compares **four real-engine readings of the accepted Brahms surface** — same score, same literal windows, same 95 % cluster scale, same 0.30pt optical air, same written ties, same literal pitches — differing only in how a **long value** is stated and in the one redundancy rule every card shares. **A. The shared rule (all four cards):** a note or written component of an admitted cluster whose own value the active family states with a long mark (96 / 192 / 384) and whose committed written-tie chain gives it an **outgoing** tie no longer paints that individual mark: the arc plus the next component state the hold. It reads the true source chain topology (a continuation in another system still counts), it is deliberately **not** restricted to values the bracket owns, it never touches the terminal component, the bracket\u2019s own carried value, pitches, onsets, sounding totals, tie chains, playback or continuation heads, and it is published: this round omits five marks — m. 33\u2019s 96-tick D6, m. 53\u2019s repeat, and the three non-terminal long components of the m. 61–63 E2 chain (192 · 192 · 96) — while the engine\u2019s duration-ink census and the linter\u2019s ownership check prove no mark is left orphaned. **The legend (all cards):** this notation counts 48 ticks to the quarter, so the three long values are the familiar note values \u2014 `96` = a **half note**, `192` = a **whole note** and `384` = a **breve (double whole)**. Every card states those three values with its own symbols, never with the internal tick counts. **B. Card 1 (mounted control):** the incumbent vocabulary on the incumbent mounts — 96 = one half-ring, 192 = one full ring, 384 = two full rings, the 192/384 exceptions on the fixed horizontal arm — with the half-ring\u2019s chord still closed by the unbroken bracket spine. **C. Card 2 (cutout):** byte-identical vocabulary and arm geometry with one deliberate change: the bracket spine (and, where a half-ring stands on the horizontal mount, that carrier line) is **interrupted across the half-ring\u2019s chord** and resumes 0.30pt clear of each chord end. The semicircle is never completed by a diameter stroke, nothing is masked and no unrelated ink is erased — the gap is cut out of the mount\u2019s own path. 53 bracket half-rings across the score carry the break. **D. Card 3 (detached ratio symbols):** the same ring vocabulary and bracket cutout, but a long-value exception statement is a **pure symbol run** seated directly beside its owning head (or its 2-span pair) at the nearest legal seat — no horizontal arm. The seat solve reuses the real collision/ownership machinery with the symbol\u2019s own ink bounds: 16 long statements are seated (14 beside a head, 2 above one), each with its exact dots, none refused, and the 48-tick exception members keep their historical arms because this round changes the long-value family alone. **E. Card 4 (detached open ovals):** an explicitly **experimental adaptation** of the conventional hollow-oval distinctions, not a claim to reproduce traditional notation: 96 = one compact oval tilted 30°, 192 = one distinguishably broader (1.10 : 0.62) horizontal oval, 384 = that oval with the breve\u2019s two short vertical flank strokes; the same three shapes are painted on the bracket mount and on every detached seat, the oval\u2019s white interior knocks the mount line out locally, and no three-ring stack exists in the family. Every card reports zero violations and zero warnings on the canonical Brahms lint, and the Reference engravings (Bach GOLD and the Round 46 Brahms baseline) stay byte-identical under every default.',
  openAxes: ['halfRingGap', 'exceptionCarrier', 'longDurationStyle'],
};

/**
 * Round 46 — **two real-engine variants of the whole Brahms score**, both at the
 * adopted 95 % admitted-cluster scale and both carrying every correctness,
 * grammar and tie fix of the round. They differ in exactly one axis, the one the
 * round exists to isolate:
 *
 * - **size** — 95 % for genuinely admitted bracket members only
 *   (`chordSymbolScale`); clean dyads and lone notes stay full size;
 * - **optical spacing** — declared, centred, capped extra clearance between the
 *   distinct pitch levels of an admitted cluster (`opticalSpacing: true`), at
 *   **0.30pt** of air on the working Reference and **0.20pt** on the spacing
 *   control;
 * - **pitch** — literal written positions (`lowPitchFolding: 'literal'`) with
 *   Round 45’s extra ledger/outlier ink suppressed, and two-column whole-tone
 *   parity for admitted clusters (`pitchPlacement: 'parity-columns'`);
 * - **duration** — the one 45-degree slash family (`bracketDurationGrammar:
 *   'midpoint'`) on the bracket and on the fixed horizontal carrier
 *   (`exceptionCarrier: 'horizontal'`), with the Round 46 long-value vocabulary
 *   (96 half-ring / 192 ring / 384 two rings), the bracket-only 20 % ring
 *   enlargement and the +0.20pt cut spacing;
 * - **ties** — the committed written tie chains rendered (`writtenTies:
 *   'source'`);
 * - **the report** — zero hard errors and zero warnings, the six former
 *   composite refusals stated exactly.
 */
/**
 * Round 46 — the **landed** family, kept as the shared base of the Round 47
 * cards: the Brahms Reference's own options (95 % admitted scale, 0.30pt air,
 * literal lows, the one 45-degree duration family and the written ties) are
 * these values, and the two Round 46 cards (95 % at 0.30pt air and at 0.20pt
 * air) are on record in `test/janko-round46.test.ts`.
 */
const ROUND_46_FAMILY: Partial<JankoLayoutOptions> = {
  pitchPlacement: 'parity-columns',
  bracketDurationGrammar: 'midpoint',
  exceptionCarrier: 'horizontal',
  opticalSpacing: true,
  lowPitchFolding: 'literal',
  writtenTies: 'source',
  chordSymbolScale: 0.95,
};

/** The Round 46 readability ratios, the bracket enlargement and the +0.20pt cut spacing. */
const ROUND_46_TOKENS: Partial<JankoTokens> = {
  midpointSlashLengthFactor: 1.1,
  midpointRingScale: 1.1,
  midpointBracketRingScale: 1.2,
  midpointSpacingFactor: 2.09658 / (Math.SQRT2 * (0.71 + 0.5) * 0.95),
  opticalClearanceAir: 0.3,
};

/**
 * Round 47 — the shared base of every card: the landed Round 46 family plus the
 * round's shared **outgoing-tie simplification** (`tieOriginIndicator:
 * 'omit-outgoing'`), which every card carries so the four duration questions
 * are compared on one and the same redundancy rule.
 */
const ROUND_47_BASE: Partial<JankoLayoutOptions> = {
  ...ROUND_46_FAMILY,
  tieOriginIndicator: 'omit-outgoing',
};

/** Round 47 — the Round 46 readability ratios, unchanged by this round. */
const ROUND_47_TOKENS: Partial<JankoTokens> = { ...ROUND_46_TOKENS };

/**
 * Round 47 — the accepted **flat-face air** (pt): the same 0.30pt the round
 * already declares as its vertical optical clearance, now owed by a half-ring's
 * chord to the mount line it stands on (`halfRingGap`).
 */
const ROUND_47_HALF_RING_GAP = 0.3;

/**
 * Round 47 — the common literal windows of all four cards: mm. 1–3 (the system
 * opening with its tuned 144 clusters and a 192-tick exception), mm. 7–9 (the
 * dense five-level clusters, four 96-tick half-note brackets and m. 9's
 * 144-tick dotted-half bracket, plus the shared 192-tick pair), m. 33 (a
 * 96-tick exception whose outgoing written tie now states the hold),
 * mm. 61–63 (the 504-tick E2 chain, component by component) and
 * mm. 64–66 (the m. 65 / m. 66 half-ring brackets, the written m. 66 ties and
 * the two voiced rests) — plus the single literal m. 67, added **only** because
 * the score's 384-tick values (m. 67's F4, m. 69's chord) lie outside the
 * requested range and 384 is the one long value the other five windows never
 * state. No window is invented and no card may drop one.
 */
function round47Windows(): JankoCandidateWindow[] {
  return [
    brahmsWindow(
      1,
      3,
      'Brahms mm. 1–3 · tuned 144 clusters, a 192-tick exception and the flat face on the bracket',
      'The opening system: each tuned cluster is held by one bracket carrying 144 ticks (a half-note value, 96, plus its augmentation dot) whose mark is one half-ring on the spine, and the two 192-tick exceptions (E5 at m. 1, C5 at m. 3) are the round\u2019s only long exception statements in the window. On the control card the spine runs unbroken through the half-ring\u2019s chord; on the cutout cards the spine is interrupted across that chord and resumes 0.30pt clear of each end. Nothing else differs: the same vocabulary, the same arm geometry, the same dots.'
    ),
    brahmsWindow(
      7,
      3,
      'Brahms mm. 7–9 · four 96-tick half-note brackets, m. 9\u2019s 144-tick dotted-half bracket, 48-tick exceptions and the shared 192-tick pair',
      'The densest passage: four 96-tick brackets (each stating a half note as one half-ring) plus m. 9\u2019s 144-tick bracket (a dotted half — a half note and its augmentation dot, one half-ring on the spine) stand beside 48-tick exception members that keep their historical arms — the round touches the long values only. m. 9\u2019s two 192-tick neighbours (F4/G4, one 2-span apart, same hand, same onset) are stated **once** by a shared mark centred on their column; under the round\u2019s shared outgoing-tie rule both members are untied, so the shared statement survives exactly as in Round 46.'
    ),
    brahmsWindow(
      33,
      1,
      'Brahms m. 33 · a 96-tick exception whose continuation the tie already states',
      'The D6 figure of m. 33: the member\u2019s own value is stated by the bracket\u2019s inheritance together with the written tie that continues it into the 24-tick component, so no individual long mark is painted for the member: the outgoing arc plus the continuation head already instruct the reader what is held. The window is where the operator sees exactly what the rule removes and what remains (the member\u2019s own stem, the arc, the continuing head). No fabricated 96/144 ownership is claimed anywhere: the bracket states its own carried value, the member\u2019s source value is untouched, and the sounding total is never restated by a vertical badge.'
    ),
    brahmsWindow(
      61,
      3,
      'Brahms mm. 61–63 · the 504-tick E2 chain, component by component',
      'The four written components (192 · 192 · 96 · 24) are stated by four heads joined by three tie arcs across the barlines. The three non-terminal long components have outgoing ties, so their individual long marks are redundant against the arc that continues them and are omitted; the terminal 24-tick component keeps its exact statement, because a terminal value has no continuation to lean on and is never omitted. The chain therefore reads as one sustained hold whose length is carried by the components and the arcs \u2014 not by a vertical badge restating a written component.'
    ),
    brahmsWindow(
      64,
      3,
      'Brahms mm. 64–66 · the m. 65 / m. 66 brackets, the written ties and the two voiced rests',
      'm. 65\u2019s bracket carries its valid first component (96 = one half-ring, 20 % larger on the bracket mount) with the remaining 24 ticks tied, and m. 66 (= printed bar 37, second ending) reads as two hands: one visible attack head per coincident attack/carry group before the A2/D3/F3 chord, an LH eighth rest for the genuine 24-tick lower-voice silence, an RH quarter rest for the upper voice\u2019s own silence, and the m. 66 ties drawn beneath the rhythm layer. The bracket-owned half-rings here are the mount question at its largest size.'
    ),
    brahmsWindow(
      67,
      1,
      'Brahms m. 67 (literal, added for 384) · the one long value the requested range never states',
      'Nothing outside mm. 1–3, 7–9, 33 and 61–66 is invented here: m. 67 is a literal measure added for the single reason that the score\u2019s breve (384-tick) values \u2014 this F4 and the m. 69 chord, whose written tie carries it on through m. 70 \u2014 lie beyond the requested range. It states 384 exactly \u2014 two full rings on the control/cutout/detached cards, one broad oval with the breve\u2019s two short flank strokes on the oval card \u2014 beside a 288-tick bracket (a 192-value ring plus its dot), so the whole long-value family can be compared in one window.'
    ),
  ];
}

/** One Round 47 card: the shared base, the card's own duration deltas and one declared axis. */
function round47Card(spec: {
  id: string;
  label: string;
  description: string;
  axis: string;
  options: Partial<JankoLayoutOptions>;
  tokens: Partial<JankoTokens>;
  tags: string[];
}): JankoCandidate {
  return {
    id: spec.id,
    label: spec.label,
    description: spec.description,
    axis: spec.axis,
    options: { ...ROUND_47_BASE, ...spec.options },
    tokens: { ...ROUND_47_TOKENS, ...spec.tokens },
    windows: round47Windows(),
    tags: spec.tags,
  };
}


export const ROUND_47_CANDIDATES: JankoCandidate[] = [
  round47Card({
    id: 'round47-mounted-control',
    label: 'Round 47 · 1 — Mounted control (half-ring closed by the spine)',
    description:
      'The measured control of the round: the landed Round 46 long-value vocabulary on both mounts — 96 = one half-ring, 192 = one full ring, 384 = two full rings, with the 192/384 exceptions stated on the fixed horizontal arm — plus the shared outgoing-tie simplification every card carries. The half-ring\u2019s chord is coincident with the unbroken bracket spine, which is exactly the treatment the operator asked to make deliberate (card 2 cuts it). This card is the round\u2019s mount/size baseline: the other three differ from it only in the keys their badges name, and none of them is promoted until the operator judges at normal size.',
    axis: 'halfRingGap',
    options: { exceptionCarrier: 'horizontal', longDurationStyle: 'midpoint' },
    // The axis value is stated explicitly (`0` = the incumbent unbroken mount),
    // so the control badges the number the cutout card changes.
    tokens: { halfRingGap: 0 },
    tags: ['brahms', 'duration', 'long-values', 'control', 'ties', 'experimental'],
  }),
  round47Card({
    id: 'round47-half-ring-cutout',
    label: 'Round 47 · 2 — Cutout (the flat face breaks the bracket)',
    description:
      'The same exact vocabulary, arm geometry, dots and mounts as card 1: the only difference is `halfRingGap: 0.30` — the mount line is interrupted across a half-ring\u2019s chord and resumes 0.30pt clear of each chord end (53 bracket half-rings across the score). Nothing is drawn to close the semicircle, so the flat face reads as a deliberate break rather than an accidental ring; the gap is a hole in the mount\u2019s own path, so it can never erase a notehead, stem, tie or neighbouring mark. 0.30pt is the round\u2019s already-declared optical air, and it is a judgement cue, not an accepted aesthetic.',
    axis: 'halfRingGap',
    options: { exceptionCarrier: 'horizontal', longDurationStyle: 'midpoint' },
    tokens: { halfRingGap: ROUND_47_HALF_RING_GAP },
    tags: ['brahms', 'duration', 'long-values', 'flat-face', 'ties', 'experimental'],
  }),
  round47Card({
    id: 'round47-detached-symbols',
    label: 'Round 47 · 3 — Detached ratio symbols (no horizontal arm)',
    description:
      'The ring vocabulary and the bracket cutout of card 2, with the **long** exception statements detached: 96 = one half-ring, 192 = one ring, 384 = two rings, seated as pure symbol ink directly beside their owning head (or beside the 2-span pair they share) at the nearest **legal** seat — the same collision/ownership machinery, but the symbol\u2019s own ink bounds instead of a fixed 11.46pt arm. A seat is legal only when it stays inside the staff, clear of every note knockout, every bracket ink box, every symbol already seated and every drawn staff rule (a half-ring\u2019s chord band additionally keeps the 0.30pt flat-face air), so a detached mark never erases anything and never stands on a line. The seat, its owner(s) and its distance are published; 16 statements are seated and none refused on the canonical score. The 48-tick exception members keep their historical arms — this round changes the long-value family alone.',
    axis: 'exceptionCarrier',
    options: { exceptionCarrier: 'symbol', longDurationStyle: 'midpoint' },
    tokens: { halfRingGap: ROUND_47_HALF_RING_GAP },
    tags: ['brahms', 'duration', 'long-values', 'detached', 'ties', 'experimental'],
  }),
  round47Card({
    id: 'round47-detached-ovals',
    label: 'Round 47 · 4 — Detached open ovals (half / whole / breve shapes)',
    description:
      'The experimental oval adaptation, detached like card 3 and **shared by both mounts**: 96 = one compact hollow oval tilted 30°, 192 = one distinguishably broader (1.10 : 0.62) horizontal hollow oval, 384 = that whole-value oval with the breve\u2019s two short vertical flank strokes. The three values differ by orientation, breadth and the breve flanks — never by size alone — and the same shapes are painted on the bracket spine, on any long exception statement and on every detached seat, so one vocabulary reads everywhere. On a mount the oval\u2019s white interior knocks the line out locally (the full ring\u2019s own behaviour); on a detached seat the oval is hollow and erases nothing. No three-mark stack exists in this family, the augmentation dots stay a separate modifier, the short cut values and the bracket grammar are untouched, and this is an **adaptation to this notation\u2019s ratio algebra** — it is not claimed to reproduce traditional notation, and no aesthetic acceptance is implied.',
    axis: 'longDurationStyle',
    options: { exceptionCarrier: 'symbol', longDurationStyle: 'open-oval' },
    tokens: {},
    tags: ['brahms', 'duration', 'long-values', 'open-ovals', 'breve', 'ties', 'experimental'],
  }),
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
          // Round 44: the genuine-page flag rides through the resolver, so the
          // studio still renders whole-score windows as real pages.
          fullScore: (w as JankoScoreCandidateWindow).fullScore === true,
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
/**
 * Round 48 — **two circle-size/spacing readings of the same corrected surface.**
 *
 * The round's operator-approved delivery is a *set of corrections*, not a new
 * vocabulary: every card carries all of them and the two cards differ in exactly
 * one declared axis, the detached closed circle's size and its air from the
 * owning pitch symbol. Nothing else — no measure-specific override, no
 * alternative grammar, no second tie family.
 *
 * **Shared by every card (the corrections):**
 *
 * - **rest provenance** (`sourceSilences` + `note.sourceProvenance` at the score
 *   builder, the engine's two sounding-ink maps): an inferred hand-rest is never
 *   painted when the **source's own hand** sounds through its span, is never
 *   painted inside the displayed hand's own sustaining ink from another system,
 *   and is classified `authored` when a source-written rest covers it. The m. 66
 *   `leftHandUpper` eighth and the m. 70 quarter are withheld (published as
 *   `rest-inference-withheld`), the m. 66 `r`-authored RH quarter stays;
 * - **no redundant member stem** in any carrier mode: a bracket-member whose own
 *   value *is* the bracket's carried value never keeps a shared stem, so the
 *   m. 7 first RH cluster paints none (the confirmed Round 47 `'symbol'`
 *   regression is gone);
 * - **one tie contour, faithfully traced**: the round's shared tie treatment is
 *   the two-cubic filled contour traced from LilyPond 2.26.0's own tie
 *   (`options.tieProfile: 'traced'`) — pointed tips, `tokens.tieApexThickness`
 *   (0.45pt) mid thickness, control points at the reference indent law's
 *   absolute indent (Round 49 §6)
 *   of the chord — with the engine's own span law kept as the recorded
 *   adaptation;
 * - **measured tie routing**: the side is chosen by measured ink (heads, stems,
 *   brackets, rests, holds), one side per written chain, the chord is clipped
 *   clear of any bracket between its heads. The m. 61–63 chain therefore routes
 *   **below** its E2 (the A2/A3 stems it used to cross live above it), the m. 33
 *   D6 tie sits **above** its note (the D5 head of its own measure stands under
 *   the conventional side), and no arc crosses a stem or a bracket;
 * - **detached long-value symbols always to the right**, on the head's own pitch
 *   line, with the local staff-rule knockout inside the hollow interior (a staff
 *   line is not an obstacle) and the m. 3 / m. 13 seats no longer displaced
 *   above the note; the half-ring keeps its shape and size;
 * - **the accepted flat face**: `halfRingGap: 0.30` — the bracket spine is
 *   interrupted across a half-ring's chord (0.30pt clear of each end), nothing
 *   drawn to close it, no ink masked;
 * - **the accepted inheritance rule**: `tieOriginIndicator: 'omit-outgoing'` —
 *   a long-value origin whose committed written tie continues states itself by
 *   the arc plus the next component, never by a redundant mark; the terminal
 *   component and the bracket's own carried value are never omitted.
 *
 * **The one axis:** card A states the detached closed circles at 0.90 of their
 * Round 47 size with 0.60pt of air to the owning head; card B at 0.88 with
 * 0.80pt. Both were measured against the pitch numerals (the closed ring's outer
 * diameter was 3.96pt against the `0` digit's 3.67pt advance, with only a 0.30pt
 * gap): the two cards are the modest, real-engine readings the operator asked to
 * judge. Neither is promoted by this round and the Reference keeps its Round 46
 * detached geometry (`detachedRingScale: 1`, `detachedSymbolAir: 0.30`).
 */
export const ROUND_48_METADATA: JankoCandidateRound = {
  round: 48,
  title: 'Rest provenance, the traced tie and the detached circle — Round 48',
  description:
    'Round 48 compares **two circle-size/spacing readings of one corrected Brahms surface** — the same literal windows, the same 95 % clusters, the same written ties, the same source pitches, and *all* of the round\u2019s corrections on both cards: **A. Rest provenance** \u2014 the score now carries the source\u2019s own voice\u2192hand mapping and its authored silences (written rests *and* spacers), and the engine checks the source\u2019s hand before it paints any inferred hand-rest: the m. 66 `leftHandUpper` eighth rest is **withheld** (the source\u2019s own LH sounds through 12528\u201312552) and the m. 70 LH quarter is withheld the same way, while the m. 66 RH quarter \u2014 which the source writes as an `r` \u2014 stays and is classified **authored**. Each withheld rest and each inferred (unauthored) rest is published as a `\u2019info\u2019` diagnostic: visible in the Reference record, gating nothing. **B. No redundant member stem** \u2014 a bracket member whose own value is the bracket\u2019s carried value never keeps a shared stem in *any* carrier mode, so the m. 7 first RH cluster paints none (Round 47\u2019s detached cards had painted 93 redundant shared members; the Reference\u2019s two independently justified pairs are untouched). **C. The traced tie** \u2014 both cards paint the tie as the **two-cubic filled contour measured from LilyPond 2.26.0\u2019s own tie** (the compiler of this score\u2019s pinned source): pointed tips where both boundaries meet, a constant 0.449pt mid thickness, control points at 21 % of the chord \u2014 a flat wide crown instead of the Round 46 single quadratic of uniform 0.70pt stroke with blunt butt ends. **D. Measured tie routing** \u2014 the side is chosen on real ink (heads, stems, brackets, rests, holds), one side per chain, and the chord is clipped clear of any bracket between its heads: the m. 61\u201363 E2 chain now runs **below** its note (the A2/A3 stems it used to cross stand above it), the m. 33 D6 tie sits **above** (the D5 head of its own measure stands below), the m. 65\u201366 residue is gone, and no arc crosses a stem or bracket. **E. Detached symbols always right** \u2014 every detached long-value statement stands on its head\u2019s own pitch line immediately to its right, with the staff line it stands on cleaned out of its hollow interior (m. 3 and m. 13 are no longer displaced above the note) and no other ink ever covered; **F. The accepted flat face** \u2014 the bracket spine is interrupted across a half-ring\u2019s chord at 0.30pt. **G. The accepted inheritance** \u2014 `omit-outgoing` states a long value by the arc plus its continuation, never by a redundant origin mark. **The one axis** is the detached closed circle: card A at 0.90 of its size with 0.60pt of air, card B at 0.88 with 0.80pt \u2014 both readings of the measured 0.30pt gap between the 3.96pt ring and the 3.67pt `0` glyph.',
  openAxes: ['detachedRingScale', 'detachedSymbolAir'],
};

/** Round 48 — the shared corrections both cards carry, verbatim. */
const ROUND_48_BASE: Partial<JankoLayoutOptions> = {
  ...ROUND_46_FAMILY,
  // The operator-approved corrections: the source-evidence rest rule needs no
  // option (it reads the committed provenance), the outgoing-tie inheritance
  // rule and the traced tie contour do.
  tieOriginIndicator: 'omit-outgoing',
  tieProfile: 'traced',
  // Round 47's accepted direction: the detached mount states the long-value
  // exceptions; both cards read it, so the axis below is the only difference.
  exceptionCarrier: 'symbol',
};

/**
 * Round 48 — the shared tokens both cards state: the Round 46 readability ratios
 * plus the Round 47 **accepted flat face** (`halfRingGap: 0.30`). Exported so the
 * registry test reads the same object the cards are built from.
 */
export const ROUND_48_SHARED_TOKENS: Partial<JankoTokens> = {
  ...ROUND_46_TOKENS,
  halfRingGap: ROUND_47_HALF_RING_GAP,
};

/** Round 48 — the literal windows both cards must render, never one fewer. */
function round48Windows(): JankoCandidateWindow[] {
  return [
    brahmsWindow(
      1,
      3,
      'Brahms mm. 1–3 · the attached circle and the staff line it stands on',
      'The opening clusters: the 192-tick exceptions (E5 at m. 1, C5 at m. 3) are detached closed rings seated to the **right** of their heads on the head\u2019s own pitch line. The m. 3 ring (tick 432) stands exactly on a drawn octave rule and cleans it out of its own hollow interior — before this round it was the one seat displaced *above* the note because that rule used to be treated as an obstacle. The m. 1 ring shows the increased air: the ring\u2019s ink starts 0.60pt (card A) / 0.80pt (card B) from the head\u2019s knockout edge.'
    ),
    brahmsWindow(
      7,
      4,
      'Brahms mm. 7–10 · no redundant member stem, and the half-ring beside B',
      'The m. 7–9 clusters are where the Round 47 detached cards had re-painted redundant vertical member stems: a member whose own value is the bracket\u2019s carried value keeps **none** now, in every carrier mode, while the genuinely independent 48-tick members keep their horizontal arms. m. 10 carries a half-ring (96) beside a B: the half-ring keeps its shape and size and receives the increased spacing only.'
    ),
    brahmsWindow(
      13,
      1,
      'Brahms m. 13 · the second staff-rule seat',
      'The m. 13 192-tick exception is the round\u2019s second rule-crossing seat: like m. 3 it stands to the right of its head on its own pitch line with the octave rule cleaned out of its interior, instead of being lifted above the note.'
    ),
    brahmsWindow(
      33,
      1,
      'Brahms m. 33 · a 96-tick exception whose continuation the tie already states, tied above',
      'The D6 figure of m. 33: the bracket carries 144, the member states 96, and its committed written tie continues into the 24-tick written component — so under the accepted inheritance rule the member paints **no** individual long mark: the arc plus the continuation head state the hold. The tie itself now sits **above** the D6 head (the D5 head of the same measure stands under the conventional side), where before this round it threaded between the two note rows.'
    ),
    brahmsWindow(
      61,
      6,
      'Brahms mm. 61–66 · the 504-tick chain routed below its note, and the two withheld rests',
      'The four written components of the E2 chain (192 · 192 · 96 · 24) are joined by three tie arcs, all three now **below** their note: the A2/A3 stems the first arc used to cross stand above it and the chain no longer alternates sides. mm. 64–66: the m. 65 A2/D3 ties keep clear of the D3 stem they crossed, and m. 66 reads as the source does — the `leftHandUpper` eighth rest the import implied is **withheld** (the source\u2019s own left hand sounds through 12528\u201312552) and is published as `rest-inference-withheld`, while the RH quarter rest the source writes as `r` stays and is classified **authored**.'
    ),
    brahmsWindow(
      70,
      1,
      'Brahms m. 70 · the second false hand-rest, withheld the same way',
      'The m. 70 tick-13440 LH quarter rest is withheld for exactly the m. 66 reason: the committed source provenance assigns the sounding notes there to `leftHandUpper`/`leftHandLower`, so the displayed LH gap is a staff/track label artefact. The rule is general — no bar-specific exclusion list — and the evidence (note ids and source voices) is published with the withheld rest.'
    ),
  ];
}

/** One Round 48 card: the shared corrections, one declared size/spacing delta. */
function round48Card(spec: {
  id: string;
  label: string;
  description: string;
  axis: string;
  tokens: Partial<JankoTokens>;
  tags: string[];
}): JankoCandidate {
  return {
    id: spec.id,
    label: spec.label,
    description: spec.description,
    axis: spec.axis,
    options: { ...ROUND_48_BASE },
    tokens: { ...ROUND_48_SHARED_TOKENS, ...spec.tokens },
    windows: round48Windows(),
    tags: spec.tags,
  };
}

export const ROUND_48_CANDIDATES: JankoCandidate[] = [
  round48Card({
    id: 'round48-circle-090-air-060',
    label: 'Round 48 · A — Circle 0.90 · air 0.60pt',
    description:
      'The first of the round\u2019s two detached-circle readings, on the corrected surface every card shares: the closed duration circle is engraved at **0.90** of its Round 47 size and stands **0.60pt** clear of its owning head\u2019s knockout edge (the incumbent air was 0.30pt, and the measured gap between the 3.96pt ring and the 3.67pt `0` digit was exactly that 0.30pt). The half-ring keeps its shape and size and receives the same spacing only, and neither the bracket mount nor the horizontal carrier is resized. Everything else — the traced tie, its measured routing, the rest provenance, the suppressed redundant stems, the 0.30pt flat face \u2014 is identical to card B and to the Reference.',
    axis: 'detachedRingScale',
    tokens: { detachedRingScale: 0.90, detachedSymbolAir: 0.60 },
    tags: ['brahms', 'duration', 'detached-symbols', 'ties', 'rests', 'experimental'],
  }),
  round48Card({
    id: 'round48-circle-088-air-080',
    label: 'Round 48 · B — Circle 0.88 · air 0.80pt',
    description:
      'The second reading: the closed circle at **0.88** of its Round 47 size with **0.80pt** of air from the owning head — the more generous end of the modest range the operator asked to judge, and the same corrected surface as card A (traced tie, measured routing, rest provenance, no redundant member stems, 0.30pt flat face, half-ring untouched in shape and size). The two cards are the whole comparison: the token pair is the only difference between them.',
    axis: 'detachedSymbolAir',
    tokens: { detachedRingScale: 0.88, detachedSymbolAir: 0.80 },
    tags: ['brahms', 'duration', 'detached-symbols', 'ties', 'rests', 'experimental'],
  }),
];

/**
 * Round 49 — source-faithful rhythm, the above-numeral mount, the family air
 * and the reference tie contour.
 *
 * The round's shared surface carries **every** authenticated written tie chain
 * (the in-grammar consolidation filter is gone: 29 written continuation heads
 * state their own components, the m. 61–63 E2 chain reads 192 · 192 · 96 · 24
 * component by component, and the m. 70 editorial hands are applied), the
 * operator-preferred **48B** detached-circle baseline (0.88 / 0.80pt) and the
 * **family-wide rightward air** (`horizontalMountAir` 0.80pt — every horizontal
 * duration mount, half-rings and short carriers included, keeps 0.80pt from
 * the ink it belongs to). The outgoing-tie omission is **scoped**: only a
 * member of an admitted hand-specific cluster may omit its redundant mark;
 * standalone tied origins state their own values again. On that surface the
 * three cards decide the round's three axes:
 *
 * - **A · the above-numeral mount** (`standaloneLongMount: 'above'`) — an
 *   ordinary standalone long value tries the vertical band above its owning
 *   head's numeral first, at the nearest legal lane a bounded actual-ink walk
 *   finds (own/foreign heads, stems, beams, rests, brackets, siblings, rules,
 *   boundaries); the m. 68 half-ring that the right seat refuses on its drawn
 *   staff line takes the above seat, and every other standalone long value
 *   states itself above its numeral. Shared pairs and short cues untouched.
 * - **B · the air bound** (`horizontalMountAir: 1.00`) — the family air one
 *   notch wider than the adopted 0.80pt, on the incumbent right mount, to
 *   bound the gap the operator preferred.
 * - **C · the contour control** (`tieProfile: 'uniform'`) — the adopted
 *   mount and air with the incumbent uniform contour, so the traced contour's
 *   contribution is judged against it on identical geometry.
 *
 * Every card paints the **reference tie contour** except the control: the
 * two-cubic filled sandwich with the round edging stroke, its height read by
 * the reference's own arctangent height law and its control indent by the
 * reference's rational indent law — both verified against LilyPond 2.26.0's
 * own computed control-points (five dumped spans, < 0.001 sp) and the four
 * recorded output specimens (< 0.006 pt), never against a fit of our own.
 */
export const ROUND_49_METADATA: JankoCandidateRound = {
  round: 49,
  title: 'Source-faithful rhythm, the above-numeral mount, the family air and the reference tie — Round 49',
  description:
    'Round 49 judges **three real-engine readings of one completed written-tie surface** — every authenticated chain rendered (29 written continuation heads state their own components; the E2 chain reads 192 · 192 · 96 · 24), the m. 70 editorial hands applied, the preferred 48B circle baseline (0.88 / 0.80pt) and the family-wide 0.80pt rightward air adopted, and the outgoing-tie omission scoped to admitted clusters so standalone tied origins state their own values again. **Card A** mounts every ordinary standalone long value **above its numeral** (the same circle/half-circle vocabulary, seated by a bounded actual-ink walk that measures heads, stems, beams, rests, brackets, siblings, rules and the staff boundary; the m. 68 half-ring that cannot take the right seat on its drawn line takes the above seat). **Card B** bounds the family air one notch wider (1.00pt) on the incumbent right mount. **Card C** is the contour control: the incumbent uniform tie on the adopted mount and air. The traced contour itself is the reference construction — the two-cubic filled sandwich with the round edging stroke, its height from the reference\'s own arctangent height law and its control indent from the reference\'s rational indent law (verified against LilyPond 2.26.0\'s own computed control-points and the recorded output specimens).',
  openAxes: ['standaloneLongMount', 'horizontalMountAir', 'tieProfile'],
};

/** Round 49 — the shared surface every card states: the completed written-tie
 * engraving at the adopted 48B baseline, the family air and the traced contour. */
const ROUND_49_BASE: Partial<JankoLayoutOptions> = {
  ...ROUND_48_BASE,
  // Every card carries the above-numeral mount: it is the seat that keeps the
  // m. 68 half-rings stated (their right seats are refused by the drawn staff
  // lines they stand on), so the air and contour axes are judged on the mount
  // that leaves the surface clean. The golden master keeps 'right'; the badge
  // on card A names the axis.
  standaloneLongMount: 'above',
};

/** Round 49 — the shared tokens: 48B plus the adopted family air. */
export const ROUND_49_SHARED_TOKENS: Partial<JankoTokens> = {
  ...ROUND_48_SHARED_TOKENS,
  detachedRingScale: 0.88,
  detachedSymbolAir: 0.8,
  horizontalMountAir: 0.8,
};

/** Round 49 — the literal windows every card renders, never one fewer. */
function round49Windows(): JankoCandidateWindow[] {
  return [
    brahmsWindow(
      1,
      3,
      'Brahms mm. 1–3 · the written chains begin, the detached circles and the family air',
      'The opening system now carries the first newly rendered written chains (the m. 2 E4 and the m. 4-boundary F3 state their components), the two 192-tick exceptions stand detached at the adopted 0.88 / 0.80pt baseline, and every horizontal duration mount in the window keeps the family-wide 0.80pt air. Card A seats the standalone long values above their numerals; cards B and C keep the right seat at the declared air.'
    ),
    brahmsWindow(
      7,
      4,
      'Brahms mm. 7–10 · half-rings, short carriers and the family air',
      'The dense clusters with their 96-tick half-note brackets, the 48-tick exceptions on their historical arms and m. 10\u2019s half-ring beside the B: every horizontal mount — half-ring, carrier arm, short carrier — keeps the declared family air from the ink it belongs to, and no time-column or augmentation-dot semantic moved.'
    ),
    brahmsWindow(
      13,
      1,
      'Brahms m. 13 · the second staff-rule seat',
      'The m. 13 192-tick exception on its own pitch line with the drawn rule cleaned out of the closed ring\u2019s hollow interior — at the adopted circle size and family air.'
    ),
    brahmsWindow(
      33,
      1,
      'Brahms m. 33 · the scoped omission on a bracket member',
      'The D6 figure: the member\u2019s own bracket context supplies the handedness, so the outgoing written tie still omits its individual long mark — the arc plus the continuation state the hold. Standalone origins elsewhere in the score keep their marks; this window shows the scoped rule where it applies.'
    ),
    brahmsWindow(
      61,
      6,
      'Brahms mm. 61–66 · the E2 chain\u2019s own components, the source continuation and the RH rest',
      'The four written components of the E2 chain (192 · 192 · 96 · 24) each state their own value again — the scoped omission no longer suppresses a standalone origin — joined by three tie arcs routed below their note. mm. 65–66: the nine-tick source continuation window and the authored RH quarter rest read as the source does, with every written continuation head seated clear of its neighbours.'
    ),
    brahmsWindow(
      68,
      1,
      'Brahms m. 68 · the half-ring that takes the above seat',
      'The 96-tick continuation whose right seat a drawn staff rule refuses (a half-ring\u2019s flat face is never crossed): card A seats it **above the numeral** in the clear vertical band; the right-mount cards publish the refusal honestly and the member keeps its ordinary duration ink.'
    ),
    brahmsWindow(
      70,
      1,
      'Brahms m. 70 · the editorial hands and the horizontal indicators',
      'The run\u2019s second half displayed RH (953/954), the low A1 bass LH (955), the confirmed RH pair (956/957), the truthful LH silence at 13392 published as withheld — and the horizontal duration mounts at the adopted family air around the regrouped beams.'
    ),
  ];
}

/** One Round 49 card: the shared surface, one declared axis delta. */
function round49Card(spec: {
  id: string;
  label: string;
  description: string;
  axis: string;
  options: Partial<JankoLayoutOptions>;
  tokens?: Partial<JankoTokens>;
  tags: string[];
}): JankoCandidate {
  return {
    id: spec.id,
    label: spec.label,
    description: spec.description,
    axis: spec.axis,
    options: { ...ROUND_49_BASE, ...spec.options },
    tokens: { ...ROUND_49_SHARED_TOKENS, ...spec.tokens },
    windows: round49Windows(),
    tags: spec.tags,
  };
}

export const ROUND_49_CANDIDATES: JankoCandidate[] = [
  round49Card({
    id: 'round49-above-080',
    label: 'Round 49 · A — Above-numeral mount · family air 0.80pt',
    description:
      'The above-numeral mount (the round\u2019s first axis, the value every card shares): every ordinary standalone long value tries the vertical band above its owning head\u2019s numeral first — centred, then one and two rail steps right, then left — seated by a bounded actual-ink walk that measures the owning head\u2019s own stem, every foreign stem, the beams, the rests, the heads, the brackets, the sibling symbols, the drawn rules and the staff boundary. A refused above seat falls back to the right seat (the value stays stated); the two m. 68 half-rings take the above seat their right seats can\u2019t. Shared 2-span pairs keep their pair channel and short cues are untouched. The tie is the reference contour: the two-cubic filled sandwich with the round edging stroke, the primary-source arctangent height law and the reference control indent — verified against LilyPond\'s own computed control-points.',
    axis: 'standaloneLongMount',
    options: {},
    tags: ['brahms', 'duration', 'detached-symbols', 'ties', 'rests', 'experimental'],
  }),
  round49Card({
    id: 'round49-air-100',
    label: 'Round 49 · B — Right mount · family air 1.00pt',
    description:
      'The air bound: the family-wide rightward air one notch wider than the adopted 0.80pt — every horizontal duration mount (detached circle, half-ring, carrier arm, short carrier) keeps **1.00pt** of clear air. Same written-tie surface, same above-numeral mount, same reference tie contour: the token is the only difference from the adopted baseline.',
    axis: 'horizontalMountAir',
    options: {},
    tokens: { horizontalMountAir: 1.0 },
    tags: ['brahms', 'duration', 'detached-symbols', 'ties', 'rests', 'experimental'],
  }),
  round49Card({
    id: 'round49-uniform-080',
    label: 'Round 49 · C — Uniform contour control · family air 0.80pt',
    description:
      'The contour control: the adopted surface geometry — 48B circle, family air 0.80pt, above-numeral mount, scoped omission — with the incumbent **uniform** tie profile (the Round 46 single quadratic of constant stroke). Reading it beside card A isolates what the reference contour construction contributes on identical geometry.',
    axis: 'tieProfile',
    options: { tieProfile: 'uniform' },
    tags: ['brahms', 'duration', 'detached-symbols', 'ties', 'rests', 'experimental'],
  }),
];

export const CURRENT_ROUND_METADATA: JankoCandidateRound = ROUND_49_METADATA;

export const CURRENT_CANDIDATES: JankoCandidate[] = ROUND_49_CANDIDATES;

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

/**
 * Look one candidate up by id — the live registry first, then the **parked**
 * Round 48 and Round 47 registries, so a historical card stays addressable
 * (and re-renderable) after the next round opens. Nothing else is registered.
 */
export function getCandidate(id: string): JankoCandidate | undefined {
  return (
    CURRENT_CANDIDATES.find((c) => c.id === id) ??
    ROUND_48_CANDIDATES.find((c) => c.id === id) ??
    ROUND_47_CANDIDATES.find((c) => c.id === id)
  );
}
