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

/** Score id of the Brahms Intermezzo benchmark, used by the Round 5–7 windows. */
export const BRAHMS_STUDIO_SCORE_ID = 'brahms-op118-no1';

/**
 * The round currently under review.
 *
 * Round 1 settled the rhythm dialect (Variant B — traditional beamed), round 2
 * the Klavarskribo beat grid, round 3 the Middle C corridor, round 4 the octave
 * framing, round 5 the external left clasp and round 6 the single-note
 * subdivision dialects with the per-hand clasp. Round 7 answers the operator's
 * verdict on that round: the subdivision mark must carry **diagonal kinetic
 * direction** instead of a static perpendicular tab (tested across 8th/16th/32nd
 * tiers), a hand's clean vertical chord is unified by gap-gated Option 3
 * chording, the horizontally spread `B - 2 - 8` cluster keeps its clasp through
 * the column solver, and the whole staff hierarchy is lightened.
 */
export const CURRENT_ROUND_METADATA: JankoCandidateRound = {
  round: 7,
  title: 'Kinetic Subdivision Tabs, Gap-Gated Chords & Staff Hierarchy',
  description:
    'Angled kinetic tabs tested across 8th/16th/32nd subdivisions, with Option 3 gap-gated chording and lightened staff hierarchy.',
};

/**
 * The two display windows every Round 7 candidate is engraved on: the Bach
 * opening (single-note 16ths/8ths that carry the kinetic tabs at every
 * subdivision tier) and the dense Brahms chords of mm. 7–8, where the `B - 2 - 8`
 * clasp and the `B - 4 - 7` gap-gated vertical chord live.
 */
const ROUND_7_WINDOWS: JankoCandidateWindow[] = [
  {
    scoreId: DEFAULT_STUDIO_SCORE_ID,
    measureStart: 1,
    measureCount: 2,
    title: 'Bach Goldberg Var. 1 · mm. 1–2 — opening counterpoint + single-note 16ths/8ths',
  },
  {
    scoreId: BRAHMS_STUDIO_SCORE_ID,
    measureStart: 7,
    measureCount: 2,
    title:
      'Brahms Op. 118 No. 1 · mm. 7–8 — B - 2 - 8 clasp + B - 4 - 7 Option 3 chording (macro crop)',
  },
];

/**
 * The active candidate set — the four Round 7 subdivision dialects. Order is
 * the display order in the Decision Candidates Matrix.
 */
export const CURRENT_CANDIDATES: JankoCandidate[] = [
  {
    id: 'kinetic-tab-30',
    label: 'A · 30° Kinetic Architectural Tab',
    description:
      'The Round 6 perpendicular tab raked 30° off horizontal so it leads the eye along the stem’s own motion. Drawn as a 1.1pt monoline of exactly `flagWidth` reach: the calmest of the three kinetic concepts, and the one that stacks most cleanly at 2 and 3 marks.',
    options: { chordGrouping: 'per-hand-clasp', subdivisionStyle: 'kinetic-tab-30' },
    windows: ROUND_7_WINDOWS,
    tags: ['kinetic', '30° rake', '1.1pt monoline'],
  },
  {
    id: 'kinetic-tab-45',
    label: 'B · 45° Dynamic Chevron Tab',
    description:
      'The same tab raked to the design system’s 45° French Guillemet angle, so the subdivision ink speaks the same directional language as the handedness chevrons. The boldest kinetic concept: maximum diagonal drive at the stem tip.',
    options: { chordGrouping: 'per-hand-clasp', subdivisionStyle: 'kinetic-tab-45' },
    windows: ROUND_7_WINDOWS,
    tags: ['kinetic', '45° chevron', '1.1pt monoline'],
  },
  {
    id: 'kinetic-tab-tapered',
    label: 'C · Tapered Kinetic Wing Tab',
    description:
      'The 30° rake drawn as a filled quad with an optical taper perpendicular to its own axis — a 1.4pt root at the stem narrowing to a 0.8pt tip. The kinetic direction of A with the calligraphic body weighting of the urtext flag.',
    options: { chordGrouping: 'per-hand-clasp', subdivisionStyle: 'kinetic-tab-tapered' },
    windows: ROUND_7_WINDOWS,
    tags: ['kinetic', '30° rake', '1.4pt → 0.8pt taper'],
  },
  {
    id: 'classical-urtext',
    label: 'D · Balanced Numeral-Urtext Flag',
    description:
      'The refined classical control: a tapered burin hook whose sweep mirrors exactly when it flips onto a lower stem, so the flag keeps its numeral-balanced mass in either hand. The traditional Henle / Bärenreiter answer every kinetic tab must beat.',
    options: { chordGrouping: 'per-hand-clasp', subdivisionStyle: 'classical-urtext' },
    windows: ROUND_7_WINDOWS,
    tags: ['classical', 'urtext', 'balanced flip'],
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
