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
  /** Closer-comparison strip (absent: no strip, cards only). */
  compareStrip?: JankoCompareStrip;
}

/**
 * The closer-comparison strip: one macro window engraved under every card's
 * options and laid side by side above the full-page cards, so the eye can
 * flick between schemes without scrolling.
 */
export interface JankoCompareStrip {
  /**
   * Studio score id the strip is engraved from. Defaults to the studio's
   * primary score (`'primary'` = the Bach Goldberg Var. 1 benchmark).
   */
  scoreId?: string;
  /** First measure of the strip window (1-based). */
  measureStart: number;
  /** Measures shown in the strip window. */
  measureCount: number;
  /** Short label shown above the strip. */
  title: string;
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
 * Score id of the curated duration working-set specimen (Round 21 §E): 32nd and
 * 64th runs, mixed levels, lone partial beams and solo flags.
 */
export const DURATION_SPECIMEN_STUDIO_SCORE_ID = 'duration-specimen';

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
 * dialects on the continuous vertical grid, round 13 the voice-contour rests
 * under the flared 0.65pt bracket, round 14 the restored per-hand clasp on the
 * dense 16ths of mm. 27–28, round 15 the crowded column behind hard beat-cell
 * barriers with the four rest dialects, round 16 the cluster doctrine with the
 * judged horizontal spacing, round 17A the rectangular mask with the v2 spacing
 * solver and the hugging dots, round 17B the `tight` verdict with the
 * phrase-row rests, round 18 the rest-shape verdict, round 19 the
 * symmetric-tuck clusters with the RH anchor approved, round 20 the
 * verification of the optical seats / urtext re-cut / unison merge /
 * clasp-dot fix, round 21 the measured duration ink with the slab seats and
 * the whole→64th working set, round 22 the verbatim Bravura transcription,
 * round 23 the three pitch-contour paradigms, round 24 the continuous
 * pitch-mapping paradigms, round 25 the grand grid's octave-line schemes,
 * and round 26 the 0-line decision.
 *
 * **Round 26 is an ANCHOR round: one open axis, four answers to one question.**
 * Either the 0-line is the gravitational center everything reads against, or
 * it gets little if any emphasis: the firm 0.65 anchor on middle C as the
 * control, golden-weight hairlines at the octave middles (the minimal
 * modification to the golden master), golden-weight hairlines at the C
 * boundaries, or the anchor reduced to a clef-like tick at each system
 * start. Margin labels are gone on every card; rests seat on drawn lines.
 *
 * Every card shows the same two windows: the whole of page 1 (mm. 1–16, all
 * four systems) for total visual weight, and mm. 1–2 for the octave reading
 * up close — plus the closer-comparison strip above the cards, the same
 * ascent under all four schemes side by side. The verdict is read off the
 * strip: anchor, tick, or nothing.
 */
export const CURRENT_ROUND_METADATA: JankoCandidateRound = {
  round: 26,
  title: 'The 0-Line — Anchor, Tick, or Nothing',
  description:
    'The mapping is settled and the anchor moved onto middle C, so the question sharpens: either 0 is the gravitational center or it gets little if any emphasis. Four answers — the firm 0.65 anchor, the minimal equal centers, the calm equal boundaries, the clef tick — no margin labels anywhere. Judge total visual weight on page 1, flick the strip for mm. 1\u20132, and pick the middle.',
  openAxes: ['octaveLineScheme'],
  compareStrip: {
    scoreId: DEFAULT_STUDIO_SCORE_ID,
    measureStart: 1,
    measureCount: 2,
    title: 'mm. 1–2 · the same ascent four ways',
  },
};

/**
 * The Round 26 windows, shared by every card: the whole of page 1 for total
 * visual weight, and the opening ascent for the octave reading up close.
 */
const ROUND_26_WINDOWS: JankoCandidateWindow[] = [
  {
    scoreId: DEFAULT_STUDIO_SCORE_ID,
    measureStart: 1,
    measureCount: 16,
    title: 'Bach Var. 1 · Page 1 (mm. 1–16) — the full visual weight',
  },
  {
    scoreId: DEFAULT_STUDIO_SCORE_ID,
    measureStart: 1,
    measureCount: 2,
    title: 'Bach Var. 1 · mm. 1–2 — the opening ascent up close',
  },
];

/** The round’s cards: the firm anchor as control plus one answer each, in display order. */
export const CURRENT_CANDIDATES: JankoCandidate[] = [
  {
    id: 'scheme-control',
    label: '0 · Control — the 0-line at 2x',
    description:
      'True chromatic height with the firm 0.65 anchor through middle C and faint C-lines — the corrected grid, no margin labels, rests seated on drawn lines. The gravitational center every other answer is weighed against.',
    options: { pitchMapping: 'continuous' },
    windows: ROUND_26_WINDOWS,
    tags: ['control', 'anchor'],
  },
  {
    id: 'scheme-centers',
    label: '1 · Equal Centers — the minimal modification',
    description:
      'Golden-weight hairlines at the octave middles, no anchor at all: the closest the grand grid comes to the golden master — same four lines, same ink, only the heads and the line positions move. The middle falls in open space.',
    axis: 'octaveLineScheme',
    options: { pitchMapping: 'continuous', octaveLineScheme: 'equal-centers' },
    windows: ROUND_26_WINDOWS,
    tags: ['line-scheme', 'minimal', 'no-anchor'],
  },
  {
    id: 'scheme-boundaries',
    label: '2 · Equal Boundaries — C-lines, no anchor',
    description:
      'Golden-weight hairlines at the C boundaries, no anchor at all: lines sit between octaves where fewer heads touch them. The C4 line stands on middle C — the landmark without the wall.',
    axis: 'octaveLineScheme',
    options: { pitchMapping: 'continuous', octaveLineScheme: 'equal-boundaries' },
    windows: ROUND_26_WINDOWS,
    tags: ['line-scheme', 'equal-boundaries', 'no-anchor'],
  },
  {
    id: 'scheme-clef',
    label: '3 · Clef Marker — the anchor as a tick',
    description:
      'The control’s faint C-lines with the anchor reduced to a short tick at each system start: the minimal pair that asks whether the anchor must run full width. Little emphasis, same landmarks.',
    axis: 'octaveLineScheme',
    options: { pitchMapping: 'continuous', octaveLineScheme: 'clef-marker' },
    windows: ROUND_26_WINDOWS,
    tags: ['line-scheme', 'clef-marker', 'tick'],
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
