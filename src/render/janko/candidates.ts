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
export const CURRENT_ROUND_METADATA: JankoCandidateRound = {
  round: 45,
  title: 'Larger readable Brahms clusters + phone review continuity — Round 45',
  description:
    'Three otherwise identical full-score Brahms candidates at chord-symbol scale 0.85 / 0.90 / 0.95, plus the working Brahms Reference at 0.90 — the operator asked for larger notes with subtle distributed cluster spacing instead of shrinking every cluster for rare close pairs, and explicitly deferred tied/composite duration grammar to a separate follow-up ticket. **Size:** only the genuinely admitted bracket clusters (never a lone note, a clean column or an unbracketed group) take the scale with duration ink scaled to match — slash centreline length ×1.10, ring radius and stroke ×1.10, cut centre spacing ×7/6, nominal ink gap 0.50·s unchanged, all at 45 degrees on both mounts. The 90 % Reference’s cut centre pitch is therefore exactly 1.40 × the Round 44 `.75` baseline (P45(s) = P44(.75)·1.40·(s/.90) = 1.7967583311pt at s = .90); .85 and .95 follow the same formula. **Optical spacing** is opt-in and admitted-cluster-only: distinct true pitch levels keep their horizontal layout and take one uniform extra gap delta = the maximum relevant nonnegative pair-clearance deficit ÷ that pair’s distinct-level index distance; required clearance = the two masks’ actual vertical half-extents + 0.20pt of air (an explicit new vertical optical-clearance policy, not the old `chordKnockoutAir`); offsets are centred on the member-weighted mean (no cluster-centroid translation), a cluster that already clears gets zero delta, and any per-glyph displacement is capped at 2.5pt = one 1-span. Measured on the diagnosed five-level [5,15,10,5]pt cluster: delta = 0.25769 / 0.54344 / 0.82919pt, span growth = 1.0308 / 2.1738 / 3.3167pt, maximum optical displacement = 0.5154 / 1.0869 / 1.6584pt — all uncapped. Sounding pitch, written pitch, source onset/duration and the staff lattice are never mutated: the offset is declared placement metadata, and masks, digit ink, duration attachments, grouping, crossings and the linter all agree on the painted position. **Cluster duration:** the grouping bracket carries the group’s shared value and horizontal carriers carry the remaining independent durations, so an eligible admitted cluster keeps no residual vertical shared-duration stem (the Round 16 shared-stem routing is suppressed only when the bracket already states that member’s value — genuine beams and the bracket stay, nothing is lost or duplicated). **Pitch:** the low LH notes in m. 5, 15, 22, 33, 42, 53, 67, 68 and 69 are drawn at their literal written pitch with the established ledger/extension vocabulary instead of an unnecessary ↓10 displacement — within the existing system spacing and pagination (no gap increase, no repacking, no added page). **Hand:** m. 66 (printed bar 37, second ending) is corrected RH → LH from the vendored parts.ily evidence: the left hand keeps its sustained A2/D3 statements while A2 (t12552), D3 (t12576), F3 (t12600, a 120-tick tie into this onset), A2 and D3 (both t12624) join it; D4/D5 stay right hand, and no source event is invented or deleted. **Honest whole-score report, nothing filtered:** zero hard errors, and exactly six published `carrier-duration-unsupported` warnings for the 120-tick tie composites — m. 22 (brahms-op118-no1-295), m. 26 (351), m. 33 (448), m. 42 (581), m. 46 (637), m. 53 (734) — which have no exact reading in this alphabet; no carrier is painted for them and each member keeps its own ordinary ink, which does NOT state the composite exactly. Those six are the deferred follow-up, not a claim of duration completeness, and `npm run lint:engraving -- --strict` still exits 1 on them (the non-strict gate stays green). Phone review continuity is **studio** behavior (per-tab zoom / view / scroll in versioned sessionStorage), never an engraving axis.',
  openAxes: [
    'chordSymbolScale',
    'opticalSpacing',
    'lowPitchFolding',
    'bracketDurationGrammar',
    'exceptionCarrier',
  ],
};

/** Round 45 window spans on the duration-vocabulary specimen (the compact key band). */
const ROUND_45_SPECIMEN = {
  key: { measureStart: 17, measureCount: 8 },
} as const;

/** A Round 45 window on the duration-vocabulary specimen (the compact key). */
function round45Specimen(
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
 * Round 45 — the review set: the whole Brahms score as genuine engine pages
 * first, then the bounded focus windows the operator named (m. 5 for the
 * literal low LH statement, mm. 7–9 and 17–19 for the close clusters and the
 * distributed optical spacing, mm. 66–71 for the corrected hands, the literal
 * bass and the duration carriers), then the compact labelled key for the short
 * values the corpus never states. No rejected stress row is carried forward and
 * no synthetic surface replaces a real passage.
 */
function round45Windows(): JankoCandidateWindow[] {
  return [
    {
      kind: 'score',
      scoreId: BRAHMS_STUDIO_SCORE_ID,
      measureStart: 1,
      measureCount: 71,
      fullScore: true,
      title: 'Brahms Op. 118 No. 1 · all 71 measures as genuine score pages',
      caption:
        'The complete candidate engraving, one real page card per page (the engine’s A4 page spread — the same one the Reference view uses), so the review walks the actual pages instead of a single crop. The chip above is this engraving’s own report: zero hard errors and exactly six published composite-duration refusals (m. 22, 26, 33, 42, 46, 53), which the operator deferred to the tied-duration follow-up.',
    },
    brahmsWindow(
      5,
      1,
      'Brahms m. 5 · literal low LH statement and the RH triad',
      'The LH symbol 5 is an ordinary lone note: it sits ON the solved onset column, never pushed right by parity alone, and keeps its full-size symbol. Its low octave is drawn at the literal written pitch under the established ledger vocabulary — no ↓10 displacement, no indicator. The RH downbeat triad 4/4 · 4/5 · 9/4 (all 96-tick) is an admitted cluster: 4/4 and its 10-span repeat 4/5 are both even and share the left column, the odd 9/4 takes the right column at the cluster’s own extent pitch, and one bracket states one value.'
    ),
    brahmsWindow(
      7,
      3,
      'Brahms mm. 7–9 · the dense clusters and the distributed optical spacing',
      'm. 7 carries the densest onset in the score (2/4 · 5/4 · 9/3 · 9/4 · b/3): the five distinct true pitch levels keep their horizontal layout and take one uniform extra gap each, centred on the member-weighted mean, so the numerals read apart without any cluster translation. m. 8 states the B/0 relationships and the first horizontal carrier; m. 9 the exception members’ own values as marks on their carriers. Compare the marks’ size and the cut spacing at each scale against the Reference.'
    ),
    brahmsWindow(
      17,
      3,
      'Brahms mm. 17–19 · close clusters at each scale',
      'The second dense passage, where the raw 1.00 cluster scale previously refused its fits: with the notes enlarged and the cluster spread distributed, check that every head still sits on its solved onset column, that no head leaves its beat cell, and that the carriers clear the surrounding ink at 0.85, 0.90 and 0.95. Nothing outside an admitted bracket cluster is displaced.'
    ),
    brahmsWindow(
      66,
      6,
      'Brahms mm. 66–71 · corrected hands, literal bass and the duration carriers',
      'm. 66 (printed bar 37, second ending) must read as two hands: the left hand holds its sustained A2/D3 while the reattacked A2, D3, the tied-in 120-tick F3 and the t12624 A2/D3 join it, with D4/D5 staying in the right hand. mm. 67–71 carry the literal low pitches (m. 67, 68, 69), the three-ring value on m. 67’s bracket, and the closing system — check the ledger extensions against the staff edge and that no system gap, packing or page count changed to make room.'
    ),
    round45Specimen(
      ROUND_45_SPECIMEN.key,
      'Duration key · mm. 17–24 — the short values the corpus never states',
      'A compact labelled key for the missing short values only: 4/3/2/1 slash cuts, a bare quarter, then 1/2/3 rings, with supported augmentation, at the same ratio family as the candidates. Four marks must be individually countable; the key is synthetic and labelled as such, and the review medium is the real Brahms pages above.'
    ),
  ];
}

/**
 * Round 45 — three otherwise identical full-score candidates, differing only in
 * the admitted cluster’s chord-symbol scale (the round’s judged axis), beside
 * the working 0.90 Brahms Reference.
 *
 * All three declare the same coherent family, because the scale is only
 * readable together with it:
 *
 * - **size** — 0.85 / 0.90 / 0.95 for genuinely admitted bracket members only
 *   (`chordSymbolScale`); clean dyads and lone notes stay full size;
 * - **optical spacing** — declared, centred and capped extra clearance between
 *   the distinct pitch levels of an admitted cluster (`opticalSpacing: true`);
 * - **pitch** — two-column whole-tone parity for admitted clusters only
 *   (`pitchPlacement: 'parity-columns'`), everything else literal;
 * - **duration** — the one 45-degree slash family (`bracketDurationGrammar:
 *   'midpoint'`) on the bracket and on the fixed horizontal carrier
 *   (`exceptionCarrier: 'horizontal'`), at the Round 45 readability ratios;
 * - **low pitches** — literal written pitch with ledger extensions
 *   (`lowPitchFolding: 'literal'`).
 */
const ROUND_45_FAMILY: Partial<JankoLayoutOptions> = {
  pitchPlacement: 'parity-columns',
  bracketDurationGrammar: 'midpoint',
  exceptionCarrier: 'horizontal',
  opticalSpacing: true,
  lowPitchFolding: 'literal',
};

/** The Round 45 readability ratios + the explicit 0.20pt optical air. */
const ROUND_45_TOKENS: Partial<JankoTokens> = {
  midpointSlashLengthFactor: 1.1,
  midpointRingScale: 1.1,
  midpointSpacingFactor: 7 / 6,
  opticalClearanceAir: 0.2,
};

/** One Round 45 scale card: the shared family at one admitted cluster scale. */
function round45Card(
  scale: 0.85 | 0.9 | 0.95,
  id: string,
  label: string,
  description: string
): JankoCandidate {
  return {
    id,
    label,
    description,
    axis: 'chordSymbolScale',
    options: { ...ROUND_45_FAMILY, chordSymbolScale: scale },
    tokens: { ...ROUND_45_TOKENS },
    windows: round45Windows(),
    tags: ['brahms', 'full-score', 'scale', 'optical-spacing', 'duration', 'literal-lows'],
  };
}

export const CURRENT_CANDIDATES: JankoCandidate[] = [
  round45Card(
    0.85,
    'brahms-scale-85',
    'Brahms 85 % — larger readable clusters (tightest of the three)',
    'The conservative end of the size experiment: admitted clusters at 85 % of the golden symbol size — 13.3 % larger than the Round 44 75 % treatment — with the Round 45 duration ratios (slash centreline ×1.10, ring ×1.10, cut spacing ×7/6) and the declared centred optical spacing. The smallest displacement of the three (measured δ = 0.25769pt, span growth 1.0308pt, maximum optical displacement 0.5154pt on the diagnosed five-level cluster). Everything else is identical to the 0.90 and 0.95 cards.'
  ),
  round45Card(
    0.9,
    'brahms-scale-90',
    'Brahms 90 % — larger readable clusters (the working Reference scale)',
    'The operator’s chosen working scale, and the card the Brahms Reference must agree with: admitted clusters at 90 % of the golden symbol size — 20 % larger than the Round 44 75 % treatment — with duration ink scaled to match, so the cut centre pitch is exactly 1.40 × the Round 44 baseline (1.7967583311pt). Measured δ = 0.54344pt, span growth 2.1738pt, maximum optical displacement 1.0869pt on the diagnosed five-level cluster. Everything else is identical to the 0.85 and 0.95 cards.'
  ),
  round45Card(
    0.95,
    'brahms-scale-95',
    'Brahms 95 % — larger readable clusters (the boldest size)',
    'The largest of the three: admitted clusters at 95 % of the golden symbol size — 26.7 % larger than the Round 44 75 % treatment — with the same duration ratios and optical-spacing rule. The largest displacement of the three (measured δ = 0.82919pt, span growth 3.3167pt, maximum optical displacement 1.6584pt, still well inside the 2.5pt per-glyph cap). Everything else is identical to the 0.85 and 0.90 cards.'
  ),
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
