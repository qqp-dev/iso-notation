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
 * framing, round 5 the external left clasp, round 6 the single-note subdivision
 * dialects with the per-hand clasp, and round 7 the kinetic subdivision tabs
 * with gap-gated vertical chording. Round 8 answers the operator's verdict on
 * that round: the clasp's lopsided upward spire is removed and four **mirror
 * symmetrical** duration paradigms are tested (Candidates A–D), the kinetic
 * subdivision tab is harmonized with the score's own beam slope (~12.4°), the
 * staff hierarchy is uniformized, the accolade lightened to 0.65pt and the page
 * margin widened to 24pt.
 */
export const CURRENT_ROUND_METADATA: JankoCandidateRound = {
  round: 8,
  title: 'Symmetrical Clasps, Beam-Harmonized Tabs & Uniform Staff Hierarchy',
  description:
    'Resolving clasp symmetry across 4 balanced duration paradigms, with 12° beam-harmonized kinetic tabs, 0.65pt accolade, and 24pt margins.',
};

/**
 * The two display windows every Round 8 candidate is engraved on: the Bach
 * opening (single-note 16ths/8ths that carry the beam-harmonized kinetic tabs)
 * and the dense Brahms chords of mm. 7–8, where the symmetrical `B - 2 - 8`
 * clasp and the `B - 4 - 7` 3-note bracket live.
 */
const ROUND_8_WINDOWS: JankoCandidateWindow[] = [
  {
    scoreId: DEFAULT_STUDIO_SCORE_ID,
    measureStart: 1,
    measureCount: 2,
    title: 'Bach Goldberg Var. 1 · mm. 1–2 — opening counterpoint + 12° beam-harmonized kinetic tabs',
  },
  {
    scoreId: BRAHMS_STUDIO_SCORE_ID,
    measureStart: 7,
    measureCount: 2,
    title:
      'Brahms Op. 118 No. 1 · mm. 7–8 — symmetrical B - 2 - 8 clasp + B - 4 - 7 3-note bracket (macro crop)',
  },
];

/**
 * The active candidate set — the four Round 8 symmetrical clasp-duration
 * paradigms. Order is the display order in the Decision Candidates Matrix. All
 * four share the settled beam-harmonized kinetic tab (`'kinetic-tab-beam'`), so
 * the round varies exactly one variable: how the bracket carries its duration.
 */
export const CURRENT_CANDIDATES: JankoCandidate[] = [
  {
    id: 'center-ticks',
    label: 'A · Balanced Center-Spine Ticks',
    description:
      'The bracket stays a pure mirror-symmetrical `[` and carries its duration at the spine’s exact vertical midpoint: one notch for an 8th, two for a 16th, an open pip for a half. The calmest reading — the cluster’s value sits in the middle of its own span, exactly where the eye already rests.',
    options: {
      chordGrouping: 'per-hand-clasp',
      claspDurationStyle: 'center-ticks',
      subdivisionStyle: 'kinetic-tab-beam',
    },
    windows: ROUND_8_WINDOWS,
    tags: ['symmetrical', 'center ticks', 'pips'],
  },
  {
    id: 'cap-cuts',
    label: 'B · Stacked Horizontal Cap Cuts',
    description:
      'Duration is tallied by parallel horizontal bars stacked inward from both caps — 1 bar for a quarter, 2 for an 8th (═), 3 for a 16th (≡) — so the value reads as a symmetric ladder growing inward from either end of the bracket. The most architectural of the four concepts.',
    options: {
      chordGrouping: 'per-hand-clasp',
      claspDurationStyle: 'cap-cuts',
      subdivisionStyle: 'kinetic-tab-beam',
    },
    windows: ROUND_8_WINDOWS,
    tags: ['symmetrical', 'cap cuts', '═ / ≡'],
  },
  {
    id: 'framing-only',
    label: 'C · Pure Symmetrical Framing Bracket',
    description:
      'The bracket is reduced to its pure function — framing the cluster — with zero duration ink of its own. Duration stays on the outermost notehead’s own stem mark or hold line, so the sonority is grouped without a second duration statement. The most austere, least redundant answer.',
    options: {
      chordGrouping: 'per-hand-clasp',
      claspDurationStyle: 'framing-only',
      subdivisionStyle: 'kinetic-tab-beam',
    },
    windows: ROUND_8_WINDOWS,
    tags: ['symmetrical', 'zero duration ink', 'austere'],
  },
  {
    id: 'bilateral-fins',
    label: 'D · Bilateral Cap Fins',
    description:
      'Each cap grows a kinetic fin raked at the score’s own 12.4° beam slope, mirrored top and bottom: one fin per duration level (1 = quarter, 2 = 8th, 3 = 16th). The only paradigm that speaks the beam-harmonized kinetic language of the settled subdivision tab.',
    options: {
      chordGrouping: 'per-hand-clasp',
      claspDurationStyle: 'bilateral-fins',
      subdivisionStyle: 'kinetic-tab-beam',
    },
    windows: ROUND_8_WINDOWS,
    tags: ['symmetrical', '12.4° fins', 'kinetic'],
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
