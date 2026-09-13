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
  round: 14,
  title: 'Grid Writing Policy: On the Lines, Between the Lines, Barline-Only',
  description:
    'The three ways the continuous vertical grid can meet the music, compared all else equal on the dense 16th-note run of mm. 27–28 in one full-width system: start the columns ON the barline and the beat pulses and let the glyph masks knock the grid out (unified transparent), keep every column BETWEEN the lines and paint the grid through dedicated white air channels that no stem may overwrite (strict protected), or clear the barlines but write the pulses over the beat columns (overlaid). The flared 0.65pt System 1 bracket, the per-hand clasp and the pocket-seated m. 4 rest are settled engineering, identical in every candidate.',
  openAxes: ['gridWritingPolicy'],
};

/**
 * The one display window every Round 14 candidate is engraved on: Bach
 * Goldberg Var. 1 mm. 27–28, the dense sixteenth-note run, in **one** system at
 * its true measure width. The grid-writing question is only legible where the
 * grid and the music actually meet on every 16th, so the locked decisions
 * (bracket, clasp, rest placement) deliberately get no showcase slot here.
 */
const ROUND_14_WINDOWS: JankoCandidateWindow[] = [
  {
    scoreId: DEFAULT_STUDIO_SCORE_ID,
    measureStart: 27,
    measureCount: 2,
    title:
      'Bach Goldberg Var. 1 · mm. 27–28 — the dense sixteenths in one full-width system: who owns the overlap where the continuous barline + beat-pulse grid meets the note columns',
  },
];

/**
 * The active candidate set — the three grid writing policies, all else equal.
 * Order is the display order in the Decision Candidates Matrix.
 *
 * Each candidate states the round's **open axis** (`gridWritingPolicy`) and
 * nothing else: the flared 0.65pt bracket and the per-hand clasp are declared
 * as the shared fixed context they now are (both equal the golden master, so
 * neither ever shows as a delta badge).
 */
export const CURRENT_CANDIDATES: JankoCandidate[] = [
  {
    id: 'unified-transparent-grid',
    label: 'A · Unified Transparent Grid — columns ON the lines',
    description:
      'The vertical grid becomes a pure background coordinate: the note field withdraws the measure inset, so a downbeat column starts exactly ON the barline and every beat pulse runs straight through the beat columns. The glyph masks then own the overlap — a circular knockout erases the barline exactly as it erases a beat pulse, and no stem or beam is ever asked to step aside. The music reads as one uninterrupted line of sixteenths; the grid survives only in the air between the notes.',
    options: {
      gridWritingPolicy: 'unified-transparent-grid',
      chordGrouping: 'per-hand-clasp',
    },
    windows: ROUND_14_WINDOWS,
    tags: ['columns ON barline + pulses', 'glyph masks own the overlap', 'full measure width'],
  },
  {
    id: 'strict-protected-grid',
    label: 'B · Strict Protected Grid — columns BETWEEN the lines',
    description:
      'The grid is never overwritten. Every barline and every beat pulse is painted above the rhythm layer through its own dedicated white air channel, so a stem or beam that would cross a grid line is cut by the channel instead — the line stays unbroken from the Octave 5 rule to the Octave 2 rule. The columns keep the canonical measure inset and stay clear of the barlines. Nothing in the engraving may touch the grid; the cost is the air the channels take out of the stems.',
    options: {
      gridWritingPolicy: 'strict-protected-grid',
      chordGrouping: 'per-hand-clasp',
    },
    windows: ROUND_14_WINDOWS,
    tags: ['white air channels', 'grid never overwritten', 'protected measure inset'],
  },
  {
    id: 'overlaid-beat-grid',
    label: 'C · Overlaid Beat Grid — clear of the barline, over the pulses',
    description:
      'The incumbent balance: the barlines are protected — every column keeps a real inset and no glyph may approach them — while the dashed beat pulses are painted first, beneath the rhythm layer, and are simply written over by the notes. The barline reads as a hard structural boundary and the beat pulses as a soft background pulse that the music owns wherever the two meet. This is the policy the golden master has carried since Round 12.',
    options: {
      gridWritingPolicy: 'overlaid-beat-grid',
      chordGrouping: 'per-hand-clasp',
    },
    windows: ROUND_14_WINDOWS,
    tags: ['protected barlines', 'pulses overlaid beneath the notes', 'incumbent policy'],
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

  for (const [key, value] of Object.entries(candidate.options ?? {})) {
    const gold = (golden as unknown as Record<string, unknown>)[key];
    const axis = openAxes.has(key);
    if (gold !== value || axis) {
      badges.push({ key, value: String(value), golden: String(gold), ...(axis ? { axis } : {}) });
    }
  }
  for (const [key, value] of Object.entries(candidate.tokens ?? {})) {
    const gold = (goldenTokens as unknown as Record<string, unknown>)[key];
    const axis = openAxes.has(key);
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
