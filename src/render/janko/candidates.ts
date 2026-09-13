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
 * beam-harmonized tab, round 9 the midpoint duration taxonomy, and round 10 the
 * scaled midpoint clasps with the retired accolade. Round 11 answers the
 * operator's verdict on that round: four **System 1 start replacements** are
 * tested side by side while the staves become a 100% symmetrical 30pt octave
 * lattice (Middle C equalized), the specimen chords lose their zero-width
 * beams, the clasp durations fall to light transverse line cuts, and the page
 * furniture turns fully Urtext (running headers, margin measure numerals, a
 * continuous Octave 6 outlier rule).
 */
export const CURRENT_ROUND_METADATA: JankoCandidateRound = {
  round: 11,
  title:
    'Accolade Replacements, Symmetrical Octave Lattice, Clean Specimen Chords & Urtext Typography',
  description:
    'Comparing 4 System 1 start styles paired with 4 light transverse clasp-duration paradigms on a symmetrical 30pt octave lattice, with stemless specimen chords, margin measure numerals, a continuous Octave 6 outlier rule and Urtext running headers.',
};

/**
 * The four display windows every Round 11 candidate is engraved on: the Bach
 * opening (System 1 start style, Position of Honor halo, margin numeral), the
 * Bach Var. 1 m. 4 RH run (continuous beaming across Middle C), the Bach
 * Var. 1 mm. 29–30 Octave 6 climb (continuous outlier rule in the left margin's
 * numeral column), and the **wide-span chord specimen**, whose stemless chords
 * carry the full duration taxonomy so every light transverse cut is on screen.
 */
const ROUND_11_WINDOWS: JankoCandidateWindow[] = [
  {
    scoreId: DEFAULT_STUDIO_SCORE_ID,
    measureStart: 1,
    measureCount: 2,
    title:
      'Bach Goldberg Var. 1 · mm. 1–2 — System 1 start style + Position of Honor halo + margin measure numeral',
  },
  {
    scoreId: DEFAULT_STUDIO_SCORE_ID,
    measureStart: 4,
    measureCount: 1,
    title:
      'Bach Goldberg Var. 1 · m. 4 — continuous RH run beaming across Middle C into Octave 3 (no orphaned 9 · 7 · 6 flags)',
  },
  {
    scoreId: DEFAULT_STUDIO_SCORE_ID,
    measureStart: 29,
    measureCount: 2,
    title:
      'Bach Goldberg Var. 1 · mm. 29–30 — one continuous Octave 6 outlier rule (no choppy notehead dashes) with margin measure numbers',
  },
  {
    scoreId: SPECIMEN_STUDIO_SCORE_ID,
    measureStart: 1,
    measureCount: 2,
    title:
      'Wide-Span Chord Specimen · half (open white ring) → quarter (plain bracket) → dotted quarter (0.75pt dot) → 8th (1 cut) → 16th (2 cuts) on stemless 1.5-octave chords',
  },
];

/**
 * The active candidate set — the four Round 11 System 1 start replacements,
 * each paired with one light transverse clasp-duration paradigm. Order is the
 * display order in the Decision Candidates Matrix. All four share the settled
 * beam-harmonized kinetic tab (`'kinetic-tab-beam'`), the per-hand bracket
 * scope, continuous run beaming, the unified final barline, the symmetrical
 * 30pt lattice and the Urtext page furniture, so a candidate states exactly
 * two deltas: the margin ink at the system start and the ink a duration leaves
 * at the bracket spine's midpoint.
 */
export const CURRENT_CANDIDATES: JankoCandidate[] = [
  {
    id: 'open-halo-cross-rungs',
    label: 'A · Open Margin + Halo / Horizontal Cross-Rungs',
    description:
      'The settled open margin: horizontal staff rules emerge cleanly into white space while the tick-0 sounds carry the concentric Position-of-Honor halo (R = 6.2pt). Durations cut across the bracket spine as crisp 7.5pt horizontal rungs at 1.0pt — one for an 8th, a parallel pair for a 16th — and a half note knocks the spine out with a clean open white ring (R = 3.0pt). The quietest and most classical of the four.',
    options: {
      chordGrouping: 'per-hand-clasp',
      systemStartStyle: 'open-halo',
      claspDurationStyle: 'transverse-cross-bars',
      subdivisionStyle: 'kinetic-tab-beam',
    },
    windows: ROUND_11_WINDOWS,
    tags: ['open margin + halo', '7.5pt rungs', 'open white ring'],
  },
  {
    id: 'architectural-bracket-kinetic-slashes',
    label: 'B · Architectural Bracket / 12.4° Kinetic Slashes',
    description:
      'A slender 0.65pt vertical rule with crisp 3.0pt right-angled spurs clasping the Octave 5 and Octave 2 rules — structural, frontal, and perfectly aligned with the staff rules it bounds. Its subdivisions rake upward at the score’s own beam-harmonized 12.4°, so a clasped chord speaks the exact kinetic language of the settled subdivision tab.',
    options: {
      chordGrouping: 'per-hand-clasp',
      systemStartStyle: 'architectural-bracket',
      claspDurationStyle: 'kinetic-cross-slashes',
      subdivisionStyle: 'kinetic-tab-beam',
    },
    windows: ROUND_11_WINDOWS,
    tags: ['0.65pt + 3.0pt spurs', 'up-raked 12.4°', 'beam-harmonized'],
  },
  {
    id: 'clef-pillar-down-raked-slashes',
    label: 'C · Clef-Pillar Landmark / Down-Raked Slashes',
    description:
      'A slender 0.50pt vertical hairline connecting the octave equators, ticked at Middle C and at every octave line: a quiet registration landmark that teaches the symmetrical lattice at a glance. Its transverse cuts mirror Candidate B downward (−12.4°), a descending rake that answers the falling left-hand figures of the crossing runs.',
    options: {
      chordGrouping: 'per-hand-clasp',
      systemStartStyle: 'clef-pillar',
      claspDurationStyle: 'down-raked-slashes',
      subdivisionStyle: 'kinetic-tab-beam',
    },
    windows: ROUND_11_WINDOWS,
    tags: ['0.50pt lattice ticks', 'down-raked −12.4°', 'Middle C landmark'],
  },
  {
    id: 'double-hairline-cross-hatch-stitches',
    label: 'D · Double Hairline Frame / Cross-Hatch Stitches',
    description:
      'A modern double vertical bounding rule — 0.75pt outer, 0.35pt inner, 2.5pt apart — flush at the start of System 1: the firmest frame of the four, borrowed from contemporary Urtext engraving. Its subdivisions are symmetrical cross-stitches (×): one for an 8th and a stacked pair for a 16th, a stitched tally that reads at any zoom without a single heavy bead.',
    options: {
      chordGrouping: 'per-hand-clasp',
      systemStartStyle: 'double-hairline',
      claspDurationStyle: 'cross-hatch-stitches',
      subdivisionStyle: 'kinetic-tab-beam',
    },
    windows: ROUND_11_WINDOWS,
    tags: ['0.75pt / 0.35pt frame', 'cross-hatch ××', 'modern Urtext'],
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
