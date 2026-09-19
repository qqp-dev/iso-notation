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

/** One engraving window demonstrated on an abstract twelve-site geometry specimen. */
export interface JankoAbstractCandidateWindow {
  kind: 'abstract';
  /** Geometry arrangement evaluated. */
  geometryId: AbstractGeometryId;
  /** Specimen role: enlarged key (3×) or one of the two four-site subsets. */
  specimenType: 'key' | 'subset-1' | 'subset-2';
  /** Subset site indices (for subset specimens). */
  subset?: readonly number[];
  /** Short label shown above the panel. */
  title: string;
  /** Short caption (e.g. identifying changed site or nominal dimensions). */
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
  title: string
): JankoCandidateWindow {
  return {
    scoreId: BRAHMS_STUDIO_SCORE_ID,
    measureStart,
    measureCount,
    title,
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
 * keys and {0,3,7,a} vs {0,5,7,a} subsets.
 */

/** Score id of the synthetic m.8 diagnostic specimen (Round 37, parked). */
export const SYNTHETIC_M8_DIAGNOSTIC_SCORE_ID = 'synthetic-m8-diagnostic';

export const CURRENT_ROUND_METADATA: JankoCandidateRound = {
  round: 38,
  title: 'Twelve-site spatial alphabet — three abstract candidates',
  description:
    'Which compact twelve-site arrangement makes selected subsets distinguishable and learnable with the least visual noise? No optimality or human-readability claim. Site labels are identities for this geometry study, not an adopted pitch/interval convention. Evaluates Dial, Rosette, and Asymmetric constellation across identical keys and {0,3,7,a} vs {0,5,7,a} subsets.',
  openAxes: ['arrangement'],
};

/**
 * Round 38: exactly three abstract candidates:
 * Dial, Rosette, and Asymmetric constellation.
 */
export const CURRENT_CANDIDATES: JankoCandidate[] = [
  {
    id: 'dial',
    label: 'Dial',
    description:
      'Regular 12-gon circular dial. R = 2 / sin(π/12) ≈ 7.7274pt, site 0 at top, clockwise order. Nominal full ink bounds 16.5548 × 16.5548pt, min separation 4.0pt.',
    kind: 'abstract',
    abstractGeometry: 'dial',
    axis: 'arrangement',
    windows: [
      abstractKeyWindow(
        'dial',
        'Twelve-site key (3×)',
        'Full configuration (0–b) · 16.5548 × 16.5548pt nominal ink bounds (enlarged 3×)'
      ),
      abstractSubsetWindow(
        'dial',
        'subset-1',
        'Subset {0,3,7,a}',
        'Four sites · changed site 3 · 16.5548 × 16.5548pt nominal footprint'
      ),
      abstractSubsetWindow(
        'dial',
        'subset-2',
        'Subset {0,5,7,a}',
        'Four sites · changed site 3 to 5 · 16.5548 × 16.5548pt nominal footprint'
      ),
    ],
    tags: ['abstract', 'dial'],
  },
  {
    id: 'rosette',
    label: 'Rosette',
    description:
      'Alternating rosette. Radii 4√3 ≈ 6.9282pt for even i, 4.0pt for odd i. Angular step π/6, site 0 at top. Nominal full ink bounds 13.1000 × 14.9564pt, min separation 4.0pt. Sites only, no star or polygon drawn.',
    kind: 'abstract',
    abstractGeometry: 'rosette',
    axis: 'arrangement',
    windows: [
      abstractKeyWindow(
        'rosette',
        'Twelve-site key (3×)',
        'Full configuration (0–b) · 13.1000 × 14.9564pt nominal ink bounds (enlarged 3×)'
      ),
      abstractSubsetWindow(
        'rosette',
        'subset-1',
        'Subset {0,3,7,a}',
        'Four sites · changed site 3 · 13.1000 × 14.9564pt nominal footprint'
      ),
      abstractSubsetWindow(
        'rosette',
        'subset-2',
        'Subset {0,5,7,a}',
        'Four sites · changed site 3 to 5 · 13.1000 × 14.9564pt nominal footprint'
      ),
    ],
    tags: ['abstract', 'rosette'],
  },
  {
    id: 'asymmetric',
    label: 'Asymmetric constellation',
    description:
      'Planar constellation on 4pt coordinate steps. Nominal full ink bounds 17.1000 × 17.1000pt, min separation 4.0pt. No grid drawn.',
    kind: 'abstract',
    abstractGeometry: 'asymmetric',
    axis: 'arrangement',
    windows: [
      abstractKeyWindow(
        'asymmetric',
        'Twelve-site key (3×)',
        'Full configuration (0–b) · 17.1000 × 17.1000pt nominal ink bounds (enlarged 3×)'
      ),
      abstractSubsetWindow(
        'asymmetric',
        'subset-1',
        'Subset {0,3,7,a}',
        'Four sites · changed site 3 · 17.1000 × 17.1000pt nominal footprint'
      ),
      abstractSubsetWindow(
        'asymmetric',
        'subset-2',
        'Subset {0,5,7,a}',
        'Four sites · changed site 3 to 5 · 17.1000 × 17.1000pt nominal footprint'
      ),
    ],
    tags: ['abstract', 'asymmetric'],
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
