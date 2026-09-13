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

/** Score id of the Brahms Intermezzo benchmark, used by the Round 5 windows. */
export const BRAHMS_STUDIO_SCORE_ID = 'brahms-op118-no1';

/**
 * The round currently under review.
 *
 * Round 1 settled the rhythm dialect (Variant B — traditional beamed), round 2
 * the Klavarskribo beat grid, round 3 the Middle C corridor and round 4 the
 * octave framing. Round 5 interrogates the one piece of ink the operator still
 * finds noisy: the **long vertical stems that run through multi-note chords and
 * cluster sonorities**. Four paradigms now test the external left clasp — the
 * bracket that groups a vertical cluster and carries its duration — against the
 * incumbent per-note stems.
 */
export const CURRENT_ROUND_METADATA: JankoCandidateRound = {
  round: 5,
  title: 'Chord & Cluster Duration — Left Clasp with Barline Clearance',
  description:
    'Testing external left-side clasps as simultaneous grouping brackets and duration carriers. Downbeat clasps maintain ' +
    'clear air from the preceding barline, eliminating through-stems without visual collision.',
};

/**
 * The two display windows every Round 5 candidate is engraved on: the Bach
 * opening (the tick-0 chord plus continuous 16th-note counterpoint, where the
 * clasp must prove it never breaks a real beam) and the dense Brahms chords of
 * mm. 7–8, where the through-stems it replaces are at their worst.
 */
const ROUND_5_WINDOWS: JankoCandidateWindow[] = [
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
 * The active candidate set — 2–4 exploratory variants for the current round.
 * Order is the display order in the Decision Candidates Matrix.
 */
export const CURRENT_CANDIDATES: JankoCandidate[] = [
  {
    id: 'traditional-stems',
    label: 'A · Traditional Stems (Golden Master)',
    description:
      'The accumulated golden master: every note owns its own stem, RH up and LH down, and a five-note Brahms chord therefore paints one long vertical line chopped into segments by each knockout it passes. The control the clasp paradigms must beat.',
    options: { chordGrouping: 'none' },
    windows: ROUND_5_WINDOWS,
    tags: ['incumbent', 'per-note stems'],
  },
  {
    id: 'independent-left-clasp',
    label: 'B · Independent Left Clasp',
    description:
      'One external bracket per vertical simultaneity, drawn clear of the outermost disc (claspX = minX − r − 2.8pt), bounding the whole cluster from minY − r to maxY + r and carrying its duration at the tip: an open pip for halves and wholes, a clean 8.5pt spire for quarters, single and double flag hooks for 8ths and 16ths. It replaces the standalone stems of a block chord, keeps every beamed 16th intact, and is engraved only where the bracket stands clear of its barline, its neighbours and the margin furniture — the opening Bach chord is clasped, the running counterpoint is not.',
    options: { chordGrouping: 'left-clasp-spire' },
    windows: ROUND_5_WINDOWS,
    tags: ['per chord', 'duration carrier', 'barline air 4pt'],
  },
  {
    id: 'beamed-clasp-rail',
    label: 'C · Beamed Clasp Rail',
    description:
      'Every clasp of B, plus a measure-bounded rail that joins the spire tips of the contiguous clasps inside one measure: the topmost tip sets the rail, every joined spire is extended up to it and the flag hooks are dropped exactly as a traditional beam replaces them (a second rail carries the 16th level). The rail spans only its own measure’s spire columns, so it terminates inside the measure and never reaches a barline; a run whose extended spire or rail would touch a glyph is engraved unrailed instead.',
    options: { chordGrouping: 'beamed-clasp-rail' },
    windows: ROUND_5_WINDOWS,
    tags: ['chord sequence', 'measure-bounded rail'],
  },
  {
    id: 'bounding-phrase-clasp',
    label: 'D · Bounding Phrase Clasp',
    description:
      'One bracket per measure: the phrase itself is the grouping unit. The clasp bounds every note of the measure — minY − r to maxY + r over the whole phrase, drawn at the measure’s opening edge — and carries the phrase’s opening duration at its tip, while the beats inside keep their traditional stems and beams. It groups the harmony of a bar at a single stroke instead of decorating each simultaneity, at the cost of one tall bracket in front of every chord-bearing measure.',
    options: { chordGrouping: 'bounding-phrase' },
    windows: ROUND_5_WINDOWS,
    tags: ['per measure', 'phrase bracket'],
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
