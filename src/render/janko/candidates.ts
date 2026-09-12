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
 * settled the Klavarskribo beat grid and round 3 the Middle C corridor. This
 * round interrogates the octave row itself: whether the single equator should
 * open into a **bounded center channel** that holds whole-tone Set A in its
 * negative space and sends Set B to a contour-resolved flank.
 */
export const CURRENT_ROUND_METADATA: JankoCandidateRound = {
  round: 4,
  title: 'Bounded Center Channel & Non-Inverting Contour',
  description:
    'The unified equator lattice now asks its last structural question: should the center row sit on a line, ' +
    'or inside an open channel? Candidate A keeps the incumbent single equator (even rank below it, odd rank ' +
    'above it, every step 15pt). Candidate B draws two boundary rules at ±6.5pt around every equator, holds ' +
    'whole-tone Set A in the channel with zero line knockouts, and places each Set B note on the upper or lower ' +
    'flank so that no rising step ever moves down the page. Judge them on mm. 1–2, where the opening 7–9–11 ' +
    'ascent and the m. 2 neighbour 2–1–2 turn the contour around.',
};

/**
 * The active candidate set — 2–4 exploratory variants for the current round.
 * Order is the display order in the Decision Candidates Matrix.
 */
export const CURRENT_CANDIDATES: JankoCandidate[] = [
  {
    id: 'equator-single',
    label: 'A · Single Equator (Golden)',
    description:
      'The accumulated golden master: one rule per octave, whole-tone rank 0 a half-row below it and rank 1 a half-row above it — every row-to-row step an identical 15pt.',
    options: { channelLayout: 'single-equator' },
    measureStart: 1,
    measureCount: 2,
    tags: ['incumbent'],
  },
  {
    id: 'channel-bounded',
    label: 'B · Bounded Center Channel',
    description:
      'Two boundary rules at ±6.5pt frame an open 13pt channel: whole-tone Set A rides the negative space with zero line knockouts, and every Set B note takes the upper or lower flank the melodic contour asks for — a rising step is flat or up, never down.',
    options: { channelLayout: 'bounded-channel' },
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
