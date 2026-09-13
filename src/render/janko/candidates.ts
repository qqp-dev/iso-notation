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
 * gap-gated vertical chording, and round 8 the symmetrical clasp with the
 * beam-harmonized tab. Round 9 answers the operator's verdict on that round:
 * the clasp's duration ink moves to the **exact midpoint of the bracket spine**
 * and four midpoint paradigms are tested (Candidates A–D) across a curated
 * specimen that carries every duration — half, quarter, dotted quarter, 8th and
 * 16th — while the accolade slims to 4.8pt / 0.55pt and the augmentation dot to
 * 0.75pt.
 */
export const CURRENT_ROUND_METADATA: JankoCandidateRound = {
  round: 9,
  title: 'Midpoint Symmetrical Clasps, Chord Duration Taxonomy & Slender Accolade',
  description:
    'Comparing 4 variations of midpoint-anchored clasp duration, tested across half, quarter, dotted, 8th, and 16th chords with slender 4.8pt accolade and 0.75pt dots.',
};

/**
 * The three display windows every Round 9 candidate is engraved on: the Bach
 * opening (single-note 16ths/8ths that carry the beam-harmonized kinetic tabs),
 * the dense Brahms chords of mm. 7–8 (where the `B - 2 - 8` and `B - 4 - 7`
 * clasps live) and the **chord duration specimen**, whose five chords carry the
 * full duration taxonomy so every paradigm's midpoint marks are on screen.
 */
const ROUND_9_WINDOWS: JankoCandidateWindow[] = [
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
  {
    scoreId: SPECIMEN_STUDIO_SCORE_ID,
    measureStart: 1,
    measureCount: 2,
    title:
      'Chord Duration Specimen · half (ring) → quarter (plain) → dotted quarter (plain + 0.75pt dot) → 8th (1 mark) → 16th (2 marks)',
  },
];

/**
 * The active candidate set — the four Round 9 midpoint clasp-duration
 * paradigms. Order is the display order in the Decision Candidates Matrix. All
 * four share the settled beam-harmonized kinetic tab (`'kinetic-tab-beam'`), so
 * the round varies exactly one variable: the ink a subdivision value leaves at
 * the bracket spine's exact midpoint.
 */
export const CURRENT_CANDIDATES: JankoCandidate[] = [
  {
    id: 'center-kinetic-ticks',
    label: 'A · Center-Spine 12° Kinetic Ticks',
    description:
      'At the spine’s exact midpoint, 12° ticks raked at the score’s own beam slope project out of the bracket — one for an 8th, a mirrored pair for a 16th. The paradigm speaks the settled kinetic language of the subdivision tab, so a clasped chord and a flagged melody move at the same rake.',
    options: {
      chordGrouping: 'per-hand-clasp',
      claspDurationStyle: 'center-kinetic-ticks',
      subdivisionStyle: 'kinetic-tab-beam',
    },
    windows: ROUND_9_WINDOWS,
    tags: ['midpoint', '12° kinetic ticks', 'beam-harmonized'],
  },
  {
    id: 'center-chevron-notch',
    label: 'B · Center French Guillemet Chevron',
    description:
      'A calligraphic guillemet notch is cut into the spine’s midpoint: its apex rides the spine and its two burin arms open into the cup. A 16th nests a second, smaller chevron inside the first, so the value counts 1 / 2 without ever leaving the centre.',
    options: {
      chordGrouping: 'per-hand-clasp',
      claspDurationStyle: 'center-chevron-notch',
      subdivisionStyle: 'kinetic-tab-beam',
    },
    windows: ROUND_9_WINDOWS,
    tags: ['midpoint', 'guillemet chevron', 'calligraphic'],
  },
  {
    id: 'center-pip-rays',
    label: 'C · Center Circular Hub & Rays',
    description:
      'A compact circular hub (R = 1.6pt) sits on the spine’s midpoint and fires lateral rays into the margin — one ray for an 8th, a mirrored pair for a 16th. The most radial and instrument-like of the four: the value reads as a hub with spokes rather than as a tally.',
    options: {
      chordGrouping: 'per-hand-clasp',
      claspDurationStyle: 'center-pip-rays',
      subdivisionStyle: 'kinetic-tab-beam',
    },
    windows: ROUND_9_WINDOWS,
    tags: ['midpoint', 'hub & rays', 'R = 1.6pt'],
  },
  {
    id: 'center-sculpted-wedge',
    label: 'D · Center Sculpted Wedge',
    description:
      'A sculpted fin is carved into the midpoint: one sharp barb for an 8th, a mirrored pair of smaller barbs for a 16th. Solid, frontal and unambiguous — the only paradigm whose mark is a filled wedge rather than a stroke.',
    options: {
      chordGrouping: 'per-hand-clasp',
      claspDurationStyle: 'center-sculpted-wedge',
      subdivisionStyle: 'kinetic-tab-beam',
    },
    windows: ROUND_9_WINDOWS,
    tags: ['midpoint', 'sculpted wedge', 'solid barbs'],
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
