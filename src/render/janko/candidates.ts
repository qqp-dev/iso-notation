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
 * settled the Klavarskribo beat grid and round 3 the Middle C corridor. Round 4
 * opened the octave framing question with the bounded center channel; this
 * expansion interrogates the two variables the operator isolated in Candidate
 * B — **line density** and **interval proportionality** — by engraving the four
 * comparative paradigms of the channel domain side by side.
 */
export const CURRENT_ROUND_METADATA: JankoCandidateRound = {
  round: 4,
  title: 'Domain Exploration — Line Density vs Interval Proportionality',
  description:
    'Candidate B doubled the staff rules (8 lines across the grand staff) and its dynamic 3-row flanks ' +
    'turned a descending 4th into a 43pt canyon followed by a 26pt whole step. Four paradigms now isolate ' +
    'the two variables: A keeps the pristine 4-line floating equator (+7.5/−7.5pt, static parity), B anchors ' +
    'Set A directly ON the 4-line rule with Set B statically one row above, C keeps the single 4-line rule but ' +
    'lets Set B swing to the upper or lower ±15pt flank by contour, and D keeps the 8-line bounded channel with ' +
    'Set B at ±13pt. Compare mm. 1–2: the opening ascent and the m. 2 neighbour 2–1–2 turn expose exactly how ' +
    'much interval truth each paradigm can preserve per unit of ink.',
};

/**
 * The active candidate set — 2–4 exploratory variants for the current round.
 * Order is the display order in the Decision Candidates Matrix.
 */
export const CURRENT_CANDIDATES: JankoCandidate[] = [
  {
    id: 'equator-floating',
    label: 'A · Single Equator (Golden)',
    description:
      'The accumulated golden master: one rule per octave through the gap between the rows, whole-tone Set A floating 7.5pt below it and Set B 7.5pt above it. Every row-to-row step is an identical 15pt, every notehead keeps 2.7pt of clear air to the rule, and not one glyph cuts the line — the 4-line control.',
    options: { channelLayout: 'single-equator' },
    measureStart: 1,
    measureCount: 2,
    tags: ['incumbent', '4 lines', 'static'],
  },
  {
    id: 'equator-anchored',
    label: 'B · Base Row On the Line',
    description:
      'One rule per octave, and whole-tone Set A is centred directly ON it (y = 0), with Set B anchored one whole-tone row above (y = −15pt) and no lower row at all. The contour is stable by construction — but every Set A glyph now knocks a hole in the rule it sits on, all Set B pitches of an octave collapse onto one row, and the raised outer row grazes the measure-numeral margin (2 lint violations on the canonical score).',
    options: { channelLayout: 'on-the-line' },
    measureStart: 1,
    measureCount: 2,
    tags: ['4 lines', 'static', 'anchored'],
  },
  {
    id: 'single-line-3row',
    label: 'C · Single Line, Three Rows',
    description:
      'Half the ink of the bounded channel: one rule per octave (4 lines total) with Set A on the line and Set B contour-resolved to the upper (−15pt) or lower (+15pt) flank, so a rising step never moves down the page. Measures whether a single rule removes the visual noise without re-opening the 2-to-9 canyon; its raised outer row also grazes the measure-numeral margin (2 lint violations).',
    options: { channelLayout: 'single-line-3row' },
    measureStart: 1,
    measureCount: 2,
    tags: ['4 lines', 'dynamic', 'contour'],
  },
  {
    id: 'channel-bounded',
    label: 'D · Bounded Center Channel',
    description:
      'Two boundary rules at ±6.5pt frame an open 13pt channel: whole-tone Set A rides the negative space with zero line knockouts, and every Set B note takes the upper or lower ±13pt flank the melodic contour asks for. The 8-line datum that provoked this round — maximal line separation at twice the ink.',
    options: { channelLayout: 'bounded-channel' },
    measureStart: 1,
    measureCount: 2,
    tags: ['8 lines', 'dynamic', 'contour'],
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
