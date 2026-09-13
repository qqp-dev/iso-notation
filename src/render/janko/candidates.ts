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
 * gap-gated vertical chording, round 8 the symmetrical clasp with the
 * beam-harmonized tab, and round 9 the midpoint duration taxonomy. Round 10
 * answers the operator's verdict on that round: the copperplate accolade is
 * retired for an open System 1 start with the Position of Honor halo, the final
 * barline unifies across the Middle C corridor, the brittle cross-register beam
 * break is gone (the Bach Var. 1 m. 4 run beams continuously into octave 3),
 * the page furniture lightens (running headers, unbolded numerals and footer)
 * and four **scaled** clasp-duration paradigms — marks that cut symmetrically
 * across the spine at 2–3× the Round 9 size — are tested on wide-span chords.
 */
export const CURRENT_ROUND_METADATA: JankoCandidateRound = {
  round: 10,
  title: 'Scaled Midpoint Clasps, Beaming Integrity, Accolade Retirement & Page Furniture Polish',
  description:
    'Comparing 4 scaled clasp-duration paradigms cutting across the spine on wide-span chords, with continuous run beaming, open System 1 start, unified final barline, and uncluttered multi-page headers.',
};

/**
 * The three display windows every Round 10 candidate is engraved on: the Bach
 * opening (open margin start, Position of Honor halo and the beam-harmonized
 * kinetic subdivision tabs), the Bach Var. 1 m. 4 RH run that now beams
 * continuously across Middle C into octave 3, and the **wide-span chord
 * specimen**, whose 1.5-octave brackets carry the full duration taxonomy so
 * every paradigm's scaled marks are on screen.
 */
const ROUND_10_WINDOWS: JankoCandidateWindow[] = [
  {
    scoreId: DEFAULT_STUDIO_SCORE_ID,
    measureStart: 1,
    measureCount: 2,
    title:
      'Bach Goldberg Var. 1 · mm. 1–2 — open margin start + Position of Honor halo + 12° kinetic tabs',
  },
  {
    scoreId: DEFAULT_STUDIO_SCORE_ID,
    measureStart: 4,
    measureCount: 1,
    title:
      'Bach Goldberg Var. 1 · m. 4 — continuous RH run beaming across Middle C into Octave 3 (no orphaned 9 · 7 · 6 flags)',
  },
  {
    scoreId: SPECIMEN_STUDIO_SCORE_ID,
    measureStart: 1,
    measureCount: 2,
    title:
      'Wide-Span Chord Specimen · half → quarter → dotted quarter (0.75pt dot) → 8th (1 mark) → 16th (2 marks) on 1.5-octave brackets',
  },
];

/**
 * The active candidate set — the four Round 10 scaled clasp-duration paradigms
 * that cut symmetrically across the spine. Order is the display order in the
 * Decision Candidates Matrix. All four share the settled beam-harmonized
 * kinetic tab (`'kinetic-tab-beam'`) and the golden open-halo start, continuous
 * beaming, unified final barline and running headers, so the round varies
 * exactly one variable: the scaled ink a duration leaves at the bracket spine's
 * midpoint.
 */
export const CURRENT_CANDIDATES: JankoCandidate[] = [
  {
    id: 'transverse-cross-bars',
    label: 'A · Transverse Cross-Bars',
    description:
      'Crisp 7.5pt bars cut straight across the spine at 1.2pt: a clean 4×7pt rectangular knockout gap for a half, a bare spine for a quarter, one bar for an 8th and two parallel bars for a 16th. The most architectural of the four — a value reads as a tally crossing the bracket, impossible to miss at 100% zoom.',
    options: {
      chordGrouping: 'per-hand-clasp',
      claspDurationStyle: 'transverse-cross-bars',
      subdivisionStyle: 'kinetic-tab-beam',
    },
    windows: ROUND_10_WINDOWS,
    tags: ['scaled 7.5pt', 'cross-bars', 'open gap half'],
  },
  {
    id: 'kinetic-cross-slashes',
    label: 'B · Kinetic 12.4° Cross-Slashes',
    description:
      'The same transverse bars raked at the score’s own beam-harmonized 12.4°: a hollow raked lozenge knocks the spine out for a half, one slash carries an 8th and a parallel pair carries a 16th. The paradigm speaks the settled kinetic language of the subdivision tab, so a clasped chord and a flagged melody rake at exactly the same angle.',
    options: {
      chordGrouping: 'per-hand-clasp',
      claspDurationStyle: 'kinetic-cross-slashes',
      subdivisionStyle: 'kinetic-tab-beam',
    },
    windows: ROUND_10_WINDOWS,
    tags: ['scaled 7.5pt', '12.4° raked', 'beam-harmonized'],
  },
  {
    id: 'interrupted-spine-node',
    label: 'C · Interrupted-Spine Node',
    description:
      'The spine stops flush into an emphatic node with a 100% white knockout interior: a bold open ring (R = 3.0pt, stroke 1.1pt) for a half, and solid circular beads (R = 2.8pt, or a stacked pair at 2.2pt) for the subdivisions. Zero quadrants, zero crosshairs — the most instrument-like of the four, a bead threaded on the bracket.',
    options: {
      chordGrouping: 'per-hand-clasp',
      claspDurationStyle: 'interrupted-spine-node',
      subdivisionStyle: 'kinetic-tab-beam',
    },
    windows: ROUND_10_WINDOWS,
    tags: ['scaled R = 3.0pt', 'white knockout', 'solid beads'],
  },
  {
    id: 'faceted-diamond-bands',
    label: 'D · Faceted Diamond Bands',
    description:
      'Sculpted 8.0 × 4.5pt diamond lozenges cut symmetrically across the spine: a hollow white diamond knocks the spine out for a half, one solid filled band carries an 8th and a stacked pair carries a 16th. Solid, frontal and unambiguous — the widest and loudest of the four paradigms.',
    options: {
      chordGrouping: 'per-hand-clasp',
      claspDurationStyle: 'faceted-diamond-bands',
      subdivisionStyle: 'kinetic-tab-beam',
    },
    windows: ROUND_10_WINDOWS,
    tags: ['scaled 8.0 × 4.5pt', 'diamond bands', 'hollow to solid'],
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
