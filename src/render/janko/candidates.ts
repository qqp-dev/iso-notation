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
  round: 46,
  title: 'Literal-pitch clean-up, readable 95 % clusters, long-value grammar and written ties — Round 46',
  description:
    'The operator settled Round 46 as a **correctness and readability** round, and this registry declares its decision surface as **two real-engine variants of the whole Brahms score** — both at the adopted 95 % cluster scale and both carrying every Round 46 fix, differing only in the one spacing axis the round exists to isolate. **A. The unwanted literal-mode ink is gone.** Round 45 stated the register of an unadmitted low pitch with the dynamic ledger vocabulary; the operator rejected the recurring continuous outlier rules, the 42 per-note ledger dashes and the bottom-row segments they earned (including the mm. 69–71 region). The literal *positions* are untouched — no ↓10 fold is restored — and the core staff, the legitimate Round 44 row extensions, the beams, the carriers and every other element are exactly as before: zero `janko-outlier-rule`, zero ledger dashes, back to the Round 44 row census. **B. 95 % with real breathing room.** The working Reference is the 95 % admitted-cluster scale with 0.30pt of vertical optical air on the five-level clusters of mm. 7/8/9/17/18/19 (the Round 45 0.20pt plus 0.10pt), centred on the member-weighted mean and capped at 2.5pt as before; the second card keeps 0.20pt as the *spacing control* so the extra breathing room can be judged on the same engraving. Two same-hand, same-onset, exactly-equal-duration 2-span neighbours of one bracket may now share **one** horizontal indicator centred on their painted columns instead of painting two parallel carriers for one value (mm. 9 and 19’s 192-tick pairs) — never where the bracket already owns that value, never across independent tie chains. **C. The long-value vocabulary.** On both mounts, 96 ticks is a **half-ring** (left semicircle on the bracket, upper semicircle on the carrier — the intentional mount rotation), 192 one full ring and 384 two full rings; 48 stays bare, the diagonal cuts and the augmentation dots keep their meanings, and no three-ring glyph exists in this family any more. The bracket mount’s ring and half-ring grow 20 % (r 1.672 → 2.0064pt, stroke 0.61655 → 0.73986pt, ring centre pitch 5.22766pt) while the horizontal mount keeps the existing 95 % size, the fixed carrier length is recomputed from the family’s real maximum run, and the cut centre spacing gains a further 0.20pt (1.89658 → 2.09658pt) — spacing only, with the 45-degree angle, slash length and stroke untouched. **D. Written ties.** The committed provenance’s written components are rendered: each chain head states its first component, consecutive components are joined by conventional tie arcs, the six hidden `tieWaitForNote` carries land on heads that already exist, 13 written continuation heads are added where no head stated the component, and the coincident same-hand attack/carry groups of m. 66 merge to **one** visible attack head per group (9, 2, 5 before the chord) with unequal simultaneous voices keeping their own stems. m. 65’s bare 120-tick bracket becomes its valid first component 96 with the remaining 24 tied, and the six former `carrier-duration-unsupported` refusals are gone because their composites are now stated exactly — nothing is suppressed: `npm run lint:engraving -- --strict` is green on the canonical Brahms for the first time. Sounding pitch, onset and total duration are never touched, Bach GOLD stays frozen byte-for-byte, and the two variants differ only in `opticalClearanceAir` (0.30pt working Reference / 0.20pt spacing control).',
  openAxes: ['opticalClearanceAir', 'chordSymbolScale', 'writtenTies'],
};

/** Round 46 window spans on the duration-vocabulary specimen (the short-value key). */
const ROUND_46_SPECIMEN = {
  key: { measureStart: 17, measureCount: 8 },
} as const;

/** A Round 46 window on the duration-vocabulary specimen (the short-value key). */
function round46Specimen(
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
 * Round 46 — the review set: the whole Brahms score as genuine engine pages
 * first, then the bounded focus windows the operator named (mm. 1–3 for the
 * suppressed outlier rules, mm. 7–9 and 17–19 for the clusters and the shared
 * 192-tick indicators, mm. 33 and 53 for the six former 120-tick refusals,
 * m. 61 for the 504-tick E2 chain, mm. 65–71 for the corrected hands, the
 * written ties, the carriers and the long values), then the short-value key the
 * corpus never states.
 */
function round46Windows(): JankoCandidateWindow[] {
  return [
    {
      kind: 'score',
      scoreId: BRAHMS_STUDIO_SCORE_ID,
      measureStart: 1,
      measureCount: 71,
      fullScore: true,
      title: 'Brahms Op. 118 No. 1 · all 71 measures as genuine score pages',
      caption:
        'The complete engraving, one real page card per page (the engine’s A4 page spread — the same one the Reference view uses), so the review walks the actual pages instead of a single crop. The chip above is this engraving’s own report: zero hard errors and **zero warnings** — the six 120-tick composites that were published refusals through Round 45 are now stated exactly by their written components and ties.',
    },
    brahmsWindow(
      1,
      3,
      'Brahms mm. 1–3 · the unwanted literal-mode rules are gone',
      'The system opening that used to float a continuous rule across mm. 1–3 and stud the literal-low bars with ledger dashes now carries the core staff and the legitimate Round 44 row extensions only: no `janko-outlier-rule`, no ledger dash, and the octave-6 notes that never needed unfolding keep their plain heads. Compare this opening against the Round 45 candidate: the pitches are identical, the extra ink is not.'
    ),
    brahmsWindow(
      7,
      3,
      'Brahms mm. 7–9 · 95 % clusters, 0.30pt breathing room and the shared 192-tick indicator',
      'm. 7 carries the densest onset in the score (2/4 · 5/4 · 9/3 · 9/4 · b/3): the five distinct true pitch levels keep their horizontal layout and take one uniform extra gap each, centred on the member-weighted mean, with 0.30pt of declared air on the binding pair (δ = 0.9292pt, span growth 3.7167pt, maximum displacement 1.8584pt). m. 9’s two 192-tick exception members state **one** shared indicator centred between their painted heads instead of two parallel carriers; the 144-tick pair is already owned by their bracket and paints no second mark. Compare the extra 0.10pt against the 0.20pt card at the same scale.'
    ),
    brahmsWindow(
      17,
      3,
      'Brahms mm. 17–19 · the second dense passage and m. 19’s shared pair',
      'The same six-cluster family, where the raw 1.00 cluster scale previously refused its fits: with the notes enlarged and the cluster spread distributed, every head still sits on its solved onset column and no head leaves its beat cell. m. 19 repeats m. 9’s 192-tick pair and its shared indicator.'
    ),
    brahmsWindow(
      33,
      1,
      'Brahms m. 33 · a former 120-tick refusal, stated exactly',
      'The D6 figure that used to publish `carrier-duration-unsupported`: the head now states its first component (96 = one half-ring) and a tie arc leads to the written 24-tick continuation head. Half-ring + tie + eighth = 120 ticks exactly, with no invented attack.'
    ),
    brahmsWindow(
      53,
      1,
      'Brahms m. 53 · the second former refusal, and the tie past a neighbour’s stem',
      'The same D6 figure in the repeat, plus the measured tie corridor: the arc is routed on the side opposite its own stem and passes a neighbouring stem without erasing it (ties paint beneath the rhythm layer, so the stem stays unbroken).'
    ),
    brahmsWindow(
      61,
      3,
      'Brahms mm. 61–63 · the 504-tick E2 chain, component by component',
      'The four written components of the E2 chain (192 · 192 · 96 · 24) each get their own statement: the attack head carries a full ring, the m. 62 and m. 63 continuations carry a ring and a half-ring, and the closing eighth joins the eighth run — three tie arcs state the continuous hold across the barlines that separate them.'
    ),
    brahmsWindow(
      65,
      7,
      'Brahms mm. 65–71 · corrected hands, the written m. 66 ties, the repaired bracket and the long values',
      'm. 65’s bracket now carries its valid first component (96 = one half-ring, 20 % larger on the bracket mount) with the remaining 24 ticks tied into the m. 66 chord; m. 66 (printed bar 37, second ending) reads as two hands with **one visible attack head per coincident attack/carry group** — 9, 2, 5 before the A2/D3/F3 chord — while the unequal simultaneous voice keeps its own stem; the F3’s 24 + 96 is stated by its own flag and tie. mm. 67–71 carry the literal low pitches with no extra rules or dashes, 384 ticks read as **two** full rings (never three), and the closing system keeps the established ledger extensions.'
    ),
    round46Specimen(
      ROUND_46_SPECIMEN.key,
      'Duration key · mm. 17–24 — the short values the corpus never states',
      'A compact labelled key for the short values only: 4/3/2/1 diagonal cuts, a bare quarter, then the half-ring / one ring / two rings with their supported augmentation, at the same ratio family as the candidates. Four marks must be individually countable and the cut centre pitch is the round’s +0.20pt spacing; the key is synthetic and labelled as such, and the review medium is the real Brahms pages above.'
    ),
  ];
}

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

/** One Round 46 spacing card: the shared family at one optical-air value. */
function round46Card(
  air: 0.2 | 0.3,
  id: string,
  label: string,
  description: string
): JankoCandidate {
  return {
    id,
    label,
    description,
    axis: 'opticalClearanceAir',
    options: { ...ROUND_46_FAMILY },
    tokens: { ...ROUND_46_TOKENS, opticalClearanceAir: air },
    windows: round46Windows(),
    tags: ['brahms', 'full-score', 'scale', 'optical-spacing', 'duration', 'ties', 'literal-lows'],
  };
}

export const CURRENT_CANDIDATES: JankoCandidate[] = [
  round46Card(
    0.3,
    'brahms-scale-95-air30',
    'Brahms 95 % · 0.30pt air — the Round 46 working Reference',
    'The round’s working Reference, and the card the Brahms Reference must agree with byte for byte: admitted clusters at 95 % of the golden symbol size with **0.30pt** of declared vertical optical air between the successive distinct pitch levels. On the six five-level clusters this measures δ = 0.92919pt, span growth 3.71675pt and a maximum per-glyph displacement of 1.85837pt — the Round 45 0.20pt result plus exactly 0.10pt of centred extra breathing room, still far inside the 2.5pt cap. Every other Round 46 decision (the literal-ink clean-up, the long-value vocabulary with the bracket-only 20 % ring enlargement, the +0.20pt cut spacing, the shared 2-span indicator and the written ties) is identical on both cards.'
  ),
  round46Card(
    0.2,
    'brahms-scale-95-air20',
    'Brahms 95 % · 0.20pt air — the spacing control',
    'The spacing control for the same engraving: byte-identical to the working Reference except that `opticalClearanceAir` stays at the Round 45 0.20pt, so the operator can judge the extra 0.10pt of breathing room on two otherwise identical real-engine pages. Measured on the same six clusters: δ = 0.82919pt, span growth 3.31675pt, maximum displacement 1.65837pt. Nothing else differs — this card exists to isolate one declared number, not to propose a second design.'
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
