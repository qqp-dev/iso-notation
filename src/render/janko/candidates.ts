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
   * The **open axis** this candidate exists to decide (Round 15's two-axis
   * round). Only this axis is ever badged, even when the round has more than
   * one open axis: per-candidate purity means a column candidate never shows a
   * rest-dialect badge and vice versa.
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
 * music, on the dense 16ths of mm. 27–28.
 */
export const CURRENT_ROUND_METADATA: JankoCandidateRound = {
  round: 15,
  title: 'Crowded Columns + Rest Dialects: Two Independent Axes',
  description:
    'The operator directed both open questions at once. Axis 1 — the crowded column: how a colliding same-row pair is placed when the parity offset has to fan it out (the beat-x spine with flanking heads, the minimal asymmetric micro-offset behind hard beat-cell barriers, or the rejected Round 14 symmetric spread kept as control). Axis 2 — the rest dialect: the four Round 13 finalists compared on strictly clean material where no column can lie. The two axes are independent by construction: every dialect window renders byte-identical SVG under all three column systems, because it contains no same-column collision at all. The settled grid policy C, the flared bracket, the per-hand clasp, the off-row augmentation dot and the four-systems-per-page layout ride along as invisible fixed context.',
  openAxes: ['crowdedColumn', 'restStyle'],
};

/**
 * The Round 15 column-axis window set: the five crime scenes the operator named
 * (bars 8, 12, 13, 14, 15 — row collisions, a beat-boundary push, fused stems
 * and a time inversion) plus the §4 regression windows that prove the column
 * rework does not disturb the Round 14 m. 4 rest pocket or the specimen's
 * tick-180 8th rest. These are **not** clean windows: they exist to show the
 * column systems disagreeing.
 */
const ROUND_15_COLUMN_WINDOWS: JankoCandidateWindow[] = [
  {
    scoreId: DEFAULT_STUDIO_SCORE_ID,
    measureStart: 8,
    measureCount: 1,
    title: 'Bach Var. 1 · m. 8 — a same-row pair in a 16th-note run: does the column still mean time?',
  },
  {
    scoreId: DEFAULT_STUDIO_SCORE_ID,
    measureStart: 12,
    measureCount: 1,
    title: 'Bach Var. 1 · m. 12 — the pair on the beat-2 pulse: no head may cross into beat 1',
  },
  {
    scoreId: DEFAULT_STUDIO_SCORE_ID,
    measureStart: 13,
    measureCount: 1,
    title: 'Bach Var. 1 · m. 13 — opposing hands sharing one column: two voices or one fused rule?',
  },
  {
    scoreId: DEFAULT_STUDIO_SCORE_ID,
    measureStart: 14,
    measureCount: 1,
    title: 'Bach Var. 1 · m. 14 — the densest cross-hand column sharing of the variation',
  },
  {
    scoreId: DEFAULT_STUDIO_SCORE_ID,
    measureStart: 15,
    measureCount: 1,
    title: 'Bach Var. 1 · m. 15 — consecutive onsets: does the page still read in time order?',
  },
  {
    scoreId: DEFAULT_STUDIO_SCORE_ID,
    measureStart: 4,
    measureCount: 1,
    title: 'Bach Var. 1 · m. 4 — fixed context: the pocket-seated RH 16th rest and its beam break survive the column rework',
  },
  {
    scoreId: SPECIMEN_STUDIO_SCORE_ID,
    measureStart: 2,
    measureCount: 1,
    title: 'Chord specimen · m. 2 — fixed context: the genuine tick-180 8th rest in the default dialect',
  },
];

/**
 * The Round 15 dialect-axis window set: strictly clean material only. The
 * curated rest-duration specimen gives one genuine silence per value at macro
 * scale; Brahms m. 68 is the one real-world bar of the five the operator named
 * that carries a writable rest *and* no crowded column (mm. 7 and 17 carry
 * rests but crowd columns elsewhere, mm. 39 and 66 hold no standard-value
 * silence — a painted rest never lies); the chord specimen's m. 2 adds the
 * genuine 8th rest in a chord context.
 */
const ROUND_15_DIALECT_WINDOWS: JankoCandidateWindow[] = [
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
];

/**
 * The active candidate set — Round 15's **two independent axes**, in display
 * order: first the three crowded-column systems (A/B/C), then the four rest
 * dialects (A–D). Each candidate states only its own axis.
 */
export const CURRENT_CANDIDATES: JankoCandidate[] = [
  {
    id: 'stem-anchored-columns',
    label: 'A · Stem-Anchored Columns — the beat-x spine, flanking heads',
    axis: 'crowdedColumn',
    description:
      'The traditional answer. The colliding pair keeps a real rhythmic anchor: the RH head stays exactly on the nominal beat column whenever the row is mixed-hand, the displaced head takes the roomier side at the minimal 2r + 0.4pt flank — never the symmetric 11pt fan — and the crowded column itself never translates, so the neighbour columns yield the air instead. Opposing hands stagger their stems by ±1.2pt, so two voices can never fuse into one head-to-head rule, and every head stays inside its own beat cell: no head crosses a beat pulse or a barline.',
    options: { crowdedColumn: 'stem-anchored' },
    windows: ROUND_15_COLUMN_WINDOWS,
    tags: ['rhythmic anchor on beat-x', 'minimal 10.0pt asymmetric flank', 'neighbours yield', 'no grid crossing'],
  },
  {
    id: 'asymmetric-micro-columns',
    label: 'B · Minimal Asymmetric Micro-Offset — barrier-clamped',
    axis: 'crowdedColumn',
    description:
      'The smallest honest change that ends the lying. The colliding pair fans out asymmetrically — never symmetric by default — and the whole cluster slides up to a 1pt micro-bias toward the side with room before any neighbour is asked to move. The hard barrier clamps every head to its own beat cell (no crossing a beat pulse or a barline), the side is chosen by the air actually left to the neighbouring columns, and opposing stems that would fuse stagger by the fixed ±1.2pt.',
    options: { crowdedColumn: 'asymmetric-micro' },
    windows: ROUND_15_COLUMN_WINDOWS,
    tags: ['asymmetric by default', '1pt micro-bias', 'hard beat-cell + midpoint barriers', 'staggered opposing stems'],
  },
  {
    id: 'symmetric-spread-control',
    label: 'C · Symmetric Spread — the Round 14 control',
    axis: 'crowdedColumn',
    description:
      'The rejected Round 14 baseline, kept so the improvement is judged and not assumed: the colliding pair straddles its column at ∓5.5pt (the full 11pt chordal offset) and the whole column translates until it fits, with the Round 11 centerline stems. Its lint chip is expected to name the very defects this round removes — a head pushed across the beat pulse, a later onset left of an earlier one, and two opposing stems fused into one continuous rule.',
    options: { crowdedColumn: 'symmetric-spread' },
    windows: ROUND_15_COLUMN_WINDOWS,
    tags: ['control — expected violations', '∓5.5pt symmetric spread', 'centerline stems', 'Round 14 baseline'],
  },
  {
    id: 'rest-kinetic-monoline',
    label: 'A · Kinetic Monoline Rests — stem + 12.4° tabs',
    axis: 'restStyle',
    description:
      'The incumbent dialect: a vertical rest stem with the score own beam-harmonized 12.4° kinetic tabs (two for a 16th, one for an 8th), a central horizontal notch for the quarter and a hollow 7 × 2.2pt bar for the half. Monoline, architectural, and already the golden master choice.',
    options: { restStyle: 'kinetic-monoline' },
    windows: ROUND_15_DIALECT_WINDOWS,
    tags: ['incumbent dialect', '12.4° kinetic tabs', 'hollow half bar'],
  },
  {
    id: 'rest-classical-urtext',
    label: 'B · Classical Urtext Rest Glyphs — calligraphic hooks',
    axis: 'restStyle',
    description:
      'The engraved-urtext alternative: calligraphic hooks with solid teardrop bulbs for the 16th and 8th, the serpentine lightning stroke for the quarter and a solid 6 × 2.5pt block for the half. Organic, hand-cut, and the most traditional reading of a silence.',
    options: { restStyle: 'classical-urtext' },
    windows: ROUND_15_DIALECT_WINDOWS,
    tags: ['calligraphic hooks', 'serpentine quarter', 'solid half block'],
  },
  {
    id: 'rest-geometric-node',
    label: 'C · Geometric Pause Nodes — diamonds and rays',
    axis: 'restStyle',
    description:
      'A pure-geometry answer: a hollow diamond with two lateral rays for the 16th, one ray for the 8th, a solid 5 × 5pt diamond for the quarter and an open capsule for the half. Zero calligraphy — the silence reads as a plotted node on the lattice.',
    options: { restStyle: 'geometric-node' },
    windows: ROUND_15_DIALECT_WINDOWS,
    tags: ['hollow diamond + rays', 'solid quarter node', 'open capsule half'],
  },
  {
    id: 'rest-phantom-notehead',
    label: 'D · Phantom Notehead Rests — the unwritten head',
    axis: 'restStyle',
    description:
      'The Round 13 finalist that states a silence as the note that is not there: a dashed open notehead (R 3.0pt) with its bare stem, plus two downward-hooked flags for the 16th and one for the 8th, and a dashed head with a hollow bar for the half. The most semantically literal and the most unconventional of the four.',
    options: { restStyle: 'phantom-notehead' },
    windows: ROUND_15_DIALECT_WINDOWS,
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

  // Round 15 carries two open axes at once. A candidate badges the axis it
  // declares (`candidate.axis`) — never the other one — so per-candidate purity
  // stays visible: a column candidate shows only its column delta, a dialect
  // candidate only its dialect delta.
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
