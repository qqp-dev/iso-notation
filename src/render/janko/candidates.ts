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
 * dialects on the continuous vertical grid, and round 13 the voice-contour
 * rests under the flared 0.65pt bracket. Round 14 answers the operator's
 * verdict on those three: the flared bracket is **canonical** (no longer a
 * candidate), the **per-hand clasp is restored** so a wide-span chord can never
 * stack per-note stems through its own heads, the m. 4 rest keeps its beam
 * break and gains a **guaranteed-clear pocket** — and the whole round is one
 * question again: how the continuous vertical grid is written against the
 * music, on the dense 16ths of mm. 27–28. Round 15 settled the crowded column
 * (stem-anchored flanks behind hard beat-cell barriers) and compared the four
 * rest dialects on strictly clean material. Round 16 engraved the cluster
 * doctrine direct and judged the horizontal spacing amount (compact / balanced
 * / airy) on real two- and three-note clusters. Round 17A goes rectangular and
 * much tighter: the sharp fitted mask, the v2 spacing solver (unit centering,
 * pin-preserving shrink, local redistribution, multi-row interleave) and the
 * hugging dots go direct to golden, and the round judges only the gap amount —
 * snug (−30%) or tight (−35%). Rest behaviour is untouched (Round 17B).
 * Round 17B then sets the verdict — `tight` is the golden master — restores
 * the 0.90pt rest strokes, seats every rest on its phrase row and bridges the
 * m4 16th rest under one beam; round 18 judges the rest-shape verdict on that
 * fixed behavior.
 */
export const CURRENT_ROUND_METADATA: JankoCandidateRound = {
  round: 18,
  title: 'Rest-Shape Verdict: Four Dialects on Fixed Behavior',
  description:
    'The rest behavior is fixed and goes direct to golden: the decided tight gap (margin 0.6, air 0.4, pairs 5.46pt), rest strokes at the full 0.90pt note-stem weight, every rest hung from its phrase row toward Middle C, and the m4 beat-3 run bridged across its printed 16th rest under one beam. The round judges only the shape — kinetic-monoline, classical-urtext, geometric-node or phantom-notehead — on the Round 15 clean windows (byte-identical fourth carry, so the verdict compares against everything the operator already saw) plus a Bach m4 fixed-context window on every card proving the bridging, the weight and the phrase rows. The settled grid policy C, the flared bracket, the per-hand clasp, the v2 spacing solver, the hugging dots and the four-systems-per-page layout ride along as invisible fixed context.',
  openAxes: ['restStyle'],
};

/**
 * The Round 18 verdict window set: the Round 15 clean windows, byte-identical
 * (fourth carry — the verdict compares against everything the operator already
 * saw), plus the Bach m. 4 fixed-context window proving the Round 17B behavior
 * — the bridged beat-3 beam, the 0.90pt weight and the phrase-row seat — on
 * every card.
 */
const ROUND_18_VERDICT_WINDOWS: JankoCandidateWindow[] = [
  {
    scoreId: REST_SPECIMEN_STUDIO_SCORE_ID,
    measureStart: 1,
    measureCount: 1,
    title: 'Rest specimen · m. 1 — the genuine 16th silence in a stepwise contour, free column',
  },
  {
    scoreId: REST_SPECIMEN_STUDIO_SCORE_ID,
    measureStart: 2,
    measureCount: 1,
    title: 'Rest specimen · m. 2 — the genuine 8th silence',
  },
  {
    scoreId: REST_SPECIMEN_STUDIO_SCORE_ID,
    measureStart: 3,
    measureCount: 1,
    title: 'Rest specimen · m. 3 — the genuine quarter silence',
  },
  {
    scoreId: REST_SPECIMEN_STUDIO_SCORE_ID,
    measureStart: 4,
    measureCount: 1,
    title: 'Rest specimen · m. 4 — the genuine half silence',
  },
  {
    scoreId: BRAHMS_STUDIO_SCORE_ID,
    measureStart: 68,
    measureCount: 1,
    title: 'Brahms Op. 118/1 · m. 68 — the one real-world bar with a writable rest and no crowded column',
  },
  {
    scoreId: SPECIMEN_STUDIO_SCORE_ID,
    measureStart: 2,
    measureCount: 1,
    title: 'Chord specimen · m. 2 — the genuine tick-180 8th rest among the clasped chords',
  },
  {
    scoreId: DEFAULT_STUDIO_SCORE_ID,
    measureStart: 4,
    measureCount: 1,
    title: 'Bach Var. 1 · m. 4 — fixed context: the bridged beat-3 beam over the printed 16th rest',
  },
];

/**
 * The active candidate set — Round 18's **single judged axis**, in display
 * order: the four carried rest dialects (A–D) on the verdict windows, every
 * card engraved under the decided `tight` golden. Each candidate states only
 * the rest-shape axis.
 */
export const CURRENT_CANDIDATES: JankoCandidate[] = [
  {
    id: 'rest-kinetic-monoline',
    label: 'A · Kinetic Monoline Rests — stem + 12.4° tabs',
    axis: 'restStyle',
    description:
      'The incumbent dialect: a vertical rest stem with the score’s own beam-harmonized 12.4° kinetic tabs (two for a 16th, one for an 8th), a central horizontal notch for the quarter and a hollow bar for the half. Monoline, architectural, and still the golden master choice — the verdict judges whether it keeps the crown.',
    options: { restStyle: 'kinetic-monoline' },
    windows: ROUND_18_VERDICT_WINDOWS,
    tags: ['incumbent dialect', '12.4° kinetic tabs', 'hollow half bar'],
  },
  {
    id: 'rest-classical-urtext',
    label: 'B · Classical Urtext Rest Glyphs — calligraphic hooks',
    axis: 'restStyle',
    description:
      'The engraved-urtext alternative: calligraphic hooks with solid teardrop bulbs for the 16th and 8th, the serpentine lightning stroke for the quarter and a solid block for the half. Organic, hand-cut, and the most traditional reading of a silence.',
    options: { restStyle: 'classical-urtext' },
    windows: ROUND_18_VERDICT_WINDOWS,
    tags: ['calligraphic hooks', 'serpentine quarter', 'solid half block'],
  },
  {
    id: 'rest-geometric-node',
    label: 'C · Geometric Pause Nodes — diamonds and rays',
    axis: 'restStyle',
    description:
      'A pure-geometry answer: a hollow diamond with two lateral rays for the 16th, one ray for the 8th, a solid diamond for the quarter and an open capsule for the half. Zero calligraphy — the silence reads as a plotted node on the lattice.',
    options: { restStyle: 'geometric-node' },
    windows: ROUND_18_VERDICT_WINDOWS,
    tags: ['hollow diamond + rays', 'solid quarter node', 'open capsule half'],
  },
  {
    id: 'rest-phantom-notehead',
    label: 'D · Phantom Notehead Rests — the unwritten head',
    axis: 'restStyle',
    description:
      'The finalist that states a silence as the note that is not there: a dashed open notehead with its bare stem, plus two downward-hooked flags for the 16th and one for the 8th, and a dashed head with a hollow bar for the half. The most semantically literal and the most unconventional of the four.',
    options: { restStyle: 'phantom-notehead' },
    windows: ROUND_18_VERDICT_WINDOWS,
    tags: ['dashed open head', 'hooked phantom flags', 'semantic silence'],
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
