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
}

/** One engraving window a candidate is demonstrated on. */
export interface JankoCandidateWindow {
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
}

/** One exploratory engraving candidate for the current decision round. */
export interface JankoCandidate {
  /** Stable slug (used as DOM id / data attribute in the studio). */
  id: string;
  /** Display label. */
  label: string;
  /** One-line designer rationale. */
  description?: string;
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

/** Score id of the Brahms Intermezzo benchmark, used by the Round 5–7 windows. */
export const BRAHMS_STUDIO_SCORE_ID = 'brahms-op118-no1';

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
 * solver and the hugging dots, round 17B the `tight` verdict with the phrase-row
 * rests, and round 18 the rest-shape verdict.
 *
 * Round 19 (mini) is the **cluster-shape + anchor round**. Four score-wide
 * behaviors go direct to golden as fixed context — the **symmetric tuck** (an
 * onset with uneven row counts re-centres every smaller row on the widest row's
 * middle; even clusters coincide), the **stem joinery** (no painted stem ever
 * crosses a same-onset chord tone: Brahms m. 46 and m. 17 are clean), the
 * **overlap-conditional unification** (interlocking hands share one bracket;
 * a gapped onset keeps Round 6's per-hand brackets) and the **beat grid that
 * follows the columns** (an occupied beat's dashed pulse stands on its note
 * column, an empty beat keeps the proportional line) — and the round judges
 * **one** axis: which head of a fanned mixed-hand row keeps the beat column.
 */
export const CURRENT_ROUND_METADATA: JankoCandidateRound = {
  round: 19,
  title: 'Symmetric-Tuck Clusters: RH Anchor vs Lower-First',
  description:
    'The cluster shape is fixed and goes direct to golden: the symmetric tuck (m. 46’s F5/D3 tuck onto the pair columns’ midpoint 53.88, F4/G♯4 hold 51.15, B4/D4 fan to 56.61 — mirror-symmetric about 53.88), the stem joinery that keeps every tucked cluster stem-clean, the overlap-conditional unification (one bracket spanning both hands where their spans interlock, Round 6’s per-hand brackets where a gap separates them), and the beat grid that follows the laid-out note columns (m. 3’s pulses land on 459.22 / 496.57 / 533.93, and the m. 3 pair’s bracket spine clears its pulse by 7.6pt instead of grazing it). The round judges only the anchor — which head of a fanned mixed-hand row keeps the beat column — on the case windows (Brahms m. 46 and m. 26), the Round 6 split guard (Brahms m. 3, where the axis is inert and both cards are identical) and the chord specimen’s triples. The `tight` preset, the flared bracket, the v2 solver, the hugging dots and the four-systems-per-page layout ride along as invisible fixed context; the mega-vs-split bracket evidence rides the served PNGs, not a candidate.',
  openAxes: ['clusterAnchor'],
};

/**
 * The Round 19 window set: the case (m. 46), the second instance (m. 26), the
 * Round 6 split guard (m. 3) and the chord specimen's triples — the same four
 * windows on both cards.
 */
const ROUND_19_WINDOWS: JankoCandidateWindow[] = [
  {
    scoreId: BRAHMS_STUDIO_SCORE_ID,
    measureStart: 46,
    measureCount: 1,
    title: 'Brahms Op. 118/1 · m. 46 — the six-head downbeat: the tuck, the unified bracket and the anchor',
  },
  {
    scoreId: BRAHMS_STUDIO_SCORE_ID,
    measureStart: 26,
    measureCount: 1,
    title: 'Brahms Op. 118/1 · m. 26 — the second interlocking-hands instance',
  },
  {
    scoreId: BRAHMS_STUDIO_SCORE_ID,
    measureStart: 3,
    measureCount: 1,
    title: 'Brahms Op. 118/1 · m. 3 — the Round 6 guard: the 90pt hand gap keeps its split (both cards identical)',
  },
  {
    scoreId: SPECIMEN_STUDIO_SCORE_ID,
    measureStart: 2,
    measureCount: 1,
    title: 'Chord specimen · m. 2 — triples and clusters under the symmetric tuck',
  },
];

/**
 * The active candidate set — Round 19's **single judged axis**, in display
 * order: the incumbent RH anchor (A) and the naive lower-first demonstrator (B)
 * on the shared windows, every card engraved under the fixed Round 19 context.
 */
export const CURRENT_CANDIDATES: JankoCandidate[] = [
  {
    id: 'cluster-anchor-rh',
    label: 'A · RH Anchor (incumbent)',
    axis: 'clusterAnchor',
    description:
      'The incumbent rule: on a row that carries both hands, the RH tone keeps the beat column and the LH tone fans aside (m. 46: G♯4 holds 51.15, D4 fans to 56.61); a single-hand row anchors its middle head. Every uneven cluster then tucks its smaller rows onto the widest row’s middle, so the onset reads as one mirror-symmetric shape and the two hands interlock without sharing a stem.',
    options: { clusterAnchor: 'rh' },
    windows: ROUND_19_WINDOWS,
    tags: ['incumbent', 'RH tone holds the column', 'm. 46: G♯4 left, D4 right'],
  },
  {
    id: 'cluster-anchor-lower-first',
    label: 'B · Lower-First (demonstrator)',
    axis: 'clusterAnchor',
    description:
      'The naive uniform variant: the lowest-pitched head of every row keeps the beat column, so the mixed row’s LH tone takes the column and the RH tone fans aside (m. 46: D4 holds 51.15, G♯4 fans to 56.61). Judge the head order itself: with the fixed Round 19 joinery the unified bracket owns the whole onset’s duration, so this card is lint-clean too — the anchor’s formerly colliding stem is now the bracket’s business, and a yield mechanism would only be specified if lower-first lives.',
    options: { clusterAnchor: 'lower-first' },
    windows: ROUND_19_WINDOWS,
    tags: ['demonstrator', 'lowest pitch holds the column', 'm. 46: D4 left, G♯4 right'],
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
  windows: Required<JankoCandidateWindow>[];
}

/** Fill a candidate's deltas in against the golden master. */
export function resolveCandidate(candidate: JankoCandidate): ResolvedJankoCandidate {
  const windows: Required<JankoCandidateWindow>[] =
    candidate.windows && candidate.windows.length > 0
      ? candidate.windows.map((w) => ({
          scoreId: w.scoreId ?? DEFAULT_STUDIO_SCORE_ID,
          measureStart: w.measureStart,
          measureCount: w.measureCount,
          title: w.title,
        }))
      : [
          {
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
    measureStart: candidate.measureStart ?? windows[0].measureStart,
    measureCount: candidate.measureCount ?? windows[0].measureCount,
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
