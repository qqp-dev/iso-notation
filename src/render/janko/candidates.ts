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

/** Score id of the Brahms Intermezzo benchmark, used by the Round 5/6 windows. */
export const BRAHMS_STUDIO_SCORE_ID = 'brahms-op118-no1';

/**
 * The round currently under review.
 *
 * Round 1 settled the rhythm dialect (Variant B — traditional beamed), round 2
 * the Klavarskribo beat grid, round 3 the Middle C corridor, round 4 the octave
 * framing and round 5 the external left clasp. Round 6 refines the two pieces of
 * ink the operator still finds clumsy: the **isolated single-note flag** (five
 * competing subdivision dialects — two classical traditions and three modern
 * concepts) and the **clasp grouping unit**, now strictly one hand and strictly
 * for horizontally displaced (row-snapped) clusters.
 */
export const CURRENT_ROUND_METADATA: JankoCandidateRound = {
  round: 6,
  title: 'Single-Note Subdivisions & Refined Hand-Cluster Clasps',
  description:
    'Balancing 2 classical traditions (Sculpted Urtext Flag, Copperplate Pennant) with 3 creative modern concepts ' +
    '(Architectural Tab, Beveled Slash, Aerodynamic Winglet) on isolated notes, alongside refined per-hand clasps ' +
    'strictly for non-vertical clusters.',
};

/**
 * The two display windows every Round 6 candidate is engraved on: the Bach
 * opening (melodic flow and the isolated subdivision notes that carry the round)
 * and the dense Brahms chords of mm. 7–8, where the non-vertical (`2-5-9`)
 * clusters the refined per-hand clasp targets are at their densest.
 */
const ROUND_6_WINDOWS: JankoCandidateWindow[] = [
  {
    scoreId: DEFAULT_STUDIO_SCORE_ID,
    measureStart: 1,
    measureCount: 2,
    title: 'Bach Goldberg Var. 1 · mm. 1–2 — opening chord + 16th counterpoint',
  },
  {
    scoreId: BRAHMS_STUDIO_SCORE_ID,
    measureStart: 7,
    measureCount: 2,
    title: 'Brahms Op. 118 No. 1 · mm. 7–8 — dense block chords (macro crop)',
  },
];

/**
 * The active candidate set — the five Round 6 subdivision dialects. Order is
 * the display order in the Decision Candidates Matrix.
 */
export const CURRENT_CANDIDATES: JankoCandidate[] = [
  {
    id: 'classical-urtext',
    label: 'A · Sculpted Classical Urtext Flag',
    description:
      'The Henle / Bärenreiter lineage: a tapered calligraphic burin curve latched to the stem tip, drawn as a filled path with optical body weighting — thick where the stroke turns, tapering to a hairline at the tail. The classical control every modern concept must beat.',
    options: { chordGrouping: 'per-hand-clasp', subdivisionStyle: 'classical-urtext' },
    windows: ROUND_6_WINDOWS,
    tags: ['classical', 'urtext', 'tapered burin'],
  },
  {
    id: 'copperplate-pennant',
    label: 'B · Historic Copperplate Pennant',
    description:
      'Early European copperplate engraving: a straight-edged triangular wedge tapering off the stem tip, cut with three straight strokes and no calligraphic swell. Crisper and more geometric than the urtext hook, but visibly stiffer at small sizes.',
    options: { chordGrouping: 'per-hand-clasp', subdivisionStyle: 'copperplate-pennant' },
    windows: ROUND_6_WINDOWS,
    tags: ['classical', 'copperplate', 'straight wedge'],
  },
  {
    id: 'architectural-tab',
    label: 'C · Architectural Lateral Tab',
    description:
      'A modern architectural alternative: crisp horizontal rectangular tabs perpendicular to the stem (one tab for 8ths, two for 16ths), grid-aligned and drawn at a constant 1.1pt weight. It reads as duration data rather than calligraphy, and it never crosses its own notehead.',
    options: { chordGrouping: 'per-hand-clasp', subdivisionStyle: 'architectural-tab' },
    windows: ROUND_6_WINDOWS,
    tags: ['modern', 'grid-aligned tab', '1.1pt'],
  },
  {
    id: 'beveled-slash',
    label: 'D · Beveled Burin Slash',
    description:
      'Sharp 45° beveled cuts across the stem tip at the design system’s 1.20pt French Guillemet chevron weight, so the subdivision ink speaks the same handedness language as the exception chevrons. The boldest and most directional of the five dialects.',
    options: { chordGrouping: 'per-hand-clasp', subdivisionStyle: 'beveled-slash' },
    windows: ROUND_6_WINDOWS,
    tags: ['modern', '45° bevel', 'chevron weight'],
  },
  {
    id: 'aerodynamic-winglet',
    label: 'E · Modernist Aerodynamic Winglet',
    description:
      'A sleek modern fin: a straight vertical spine on the outer edge with a sharp diagonal cutback returning to the stem, giving the subdivision a swept, aerodynamic silhouette. The most sculptural of the modern concepts and the closest in mass to the classical hook.',
    options: { chordGrouping: 'per-hand-clasp', subdivisionStyle: 'aerodynamic-winglet' },
    windows: ROUND_6_WINDOWS,
    tags: ['modern', 'vertical spine', 'cutback'],
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
}

/** Option/token deltas of a candidate versus the golden master. */
export function candidateBadges(candidate: JankoCandidate): CandidateOptionBadge[] {
  const badges: CandidateOptionBadge[] = [];
  const golden = resolveJankoOptions(DEFAULT_JANKO_OPTIONS);
  const goldenTokens = resolveJankoTokens(DEFAULT_JANKO_TOKENS);

  for (const [key, value] of Object.entries(candidate.options ?? {})) {
    const gold = (golden as unknown as Record<string, unknown>)[key];
    if (gold !== value) {
      badges.push({ key, value: String(value), golden: String(gold) });
    }
  }
  for (const [key, value] of Object.entries(candidate.tokens ?? {})) {
    const gold = (goldenTokens as unknown as Record<string, unknown>)[key];
    if (gold !== value) {
      badges.push({ key, value: String(value), golden: String(gold) });
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
