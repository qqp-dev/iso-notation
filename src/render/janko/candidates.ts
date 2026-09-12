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
  /** Free-form tags rendered as badges next to the label. */
  tags?: string[];
}

/**
 * The round currently under review.
 *
 * Round 1 settled the rhythm dialect (Variant B — traditional beamed), round 2
 * settled the Klavarskribo beat grid; this round interrogates the Middle C
 * corridor itself, the one place where both hands' lattices meet.
 */
export const CURRENT_ROUND_METADATA: JankoCandidateRound = {
  round: 3,
  title: 'Middle C Corridor Treatment',
  description:
    'Both hand lattices meet on the 45pt Middle C corridor. Candidates vary how the spine ' +
    'asserts that boundary (dashed whisper, continuous hairline, double rule) and how much air ' +
    'the corridor is given. Judge them on the shared m. 1–2 window, where the spine, the ' +
    'Position of Honor halo and the first crossing stems all appear at once.',
};

/**
 * The active candidate set — 2–4 exploratory variants for the current round.
 * Order is the display order in the Decision Candidates Matrix.
 */
export const CURRENT_CANDIDATES: JankoCandidate[] = [
  {
    id: 'corridor-dashed',
    label: 'A · Dashed Whisper (Golden)',
    description:
      'The accumulated golden master: a faint 4,4-dashed spine that marks the corridor without competing with the music.',
    options: { middleCSpine: 'dashed', interStaffGap: 45.0 },
    measureStart: 1,
    measureCount: 2,
    tags: ['incumbent'],
  },
  {
    id: 'corridor-continuous',
    label: 'B · Continuous Hairline',
    description:
      'One uninterrupted hairline: reads as a true axis of symmetry, at the cost of a little extra ink between the hands.',
    options: { middleCSpine: 'continuous', interStaffGap: 45.0 },
    measureStart: 1,
    measureCount: 2,
  },
  {
    id: 'corridor-double',
    label: 'C · Double Rule',
    description:
      'Two 1.1pt-separated rules bracket the corridor and give the hands an unmistakable shared boundary.',
    options: { middleCSpine: 'double', interStaffGap: 45.0 },
    measureStart: 1,
    measureCount: 2,
  },
  {
    id: 'corridor-spacious',
    label: 'D · Spacious Corridor',
    description:
      'Keeps the golden dashed spine but opens the inter-staff gap from 45pt to 54pt, buying 4.5pt of extra air above and below the corridor.',
    options: { middleCSpine: 'dashed', interStaffGap: 54.0 },
    measureStart: 1,
    measureCount: 2,
  },
];

/** A fully resolved candidate, ready to engrave. */
export interface ResolvedJankoCandidate {
  candidate: JankoCandidate;
  options: ResolvedJankoLayoutOptions;
  tokens: ResolvedJankoTokens;
  measureStart: number;
  measureCount: number;
}

/** Fill a candidate's deltas in against the golden master. */
export function resolveCandidate(candidate: JankoCandidate): ResolvedJankoCandidate {
  return {
    candidate,
    options: resolveJankoOptions({ ...DEFAULT_JANKO_OPTIONS, ...(candidate.options ?? {}) }),
    tokens: resolveJankoTokens({ ...DEFAULT_JANKO_TOKENS, ...(candidate.tokens ?? {}) }),
    measureStart: candidate.measureStart ?? 1,
    measureCount: candidate.measureCount ?? 1,
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
