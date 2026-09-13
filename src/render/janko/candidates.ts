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
 * beam-harmonized tab, round 9 the midpoint duration taxonomy, round 10 the
 * scaled midpoint clasps with the retired accolade, and round 11 the four
 * System 1 start replacements with the light transverse cuts. Round 12 answers
 * the operator's verdict on that round: the notation gains a **rest** — four
 * rest dialects are compared on the Bach m. 4 silence that used to be an
 * invisible void — while the vertical grid becomes one **continuous** rule
 * across Middle C, its three writing policies are tested on dense sixteenths,
 * the System 1 start narrows to three architectural finalists, and the up-raked
 * 12.4° kinetic clasp is standardized as the golden duration paradigm.
 */
export const CURRENT_ROUND_METADATA: JankoCandidateRound = {
  round: 12,
  title:
    'Rest Symbol Dialects, Continuous Vertical Grid, Start Symbols & Grid Writing Policies',
  description:
    'Comparing 4 rest symbol dialects, testing the 3-way grid writing policy on mm. 27 & 29, with continuous barlines and beat lines across Middle C and refined architectural start symbols.',
};

/**
 * The four display windows every Round 12 candidate is engraved on: the Bach
 * opening (System 1 start symbol), the Bach Var. 1 m. 4 silence (the four rest
 * dialects at tick 552, resolving the RH syncopation), the Bach Var. 1
 * mm. 27–29 dense-sixteenth run (the 3-way grid writing policy under
 * continuous barlines and beat lines), and the **wide-span chord specimen**,
 * whose stemless chords carry the standardized up-raked 12.4° kinetic clasps.
 */
const ROUND_12_WINDOWS: JankoCandidateWindow[] = [
  {
    scoreId: DEFAULT_STUDIO_SCORE_ID,
    measureStart: 1,
    measureCount: 2,
    title:
      'Bach Goldberg Var. 1 · mm. 1–2 — System 1 start symbols: 0.65pt architectural bracket vs 0.50pt delicate bracket vs nib-free clef pillar',
  },
  {
    scoreId: DEFAULT_STUDIO_SCORE_ID,
    measureStart: 4,
    measureCount: 1,
    title:
      'Bach Goldberg Var. 1 · m. 4 — the 4 rest dialects at tick 552 (RH 16th rest on the Octave 4 equator at x ≈ 545pt), resolving the RH syncopation against the LH entry',
  },
  {
    scoreId: DEFAULT_STUDIO_SCORE_ID,
    measureStart: 27,
    measureCount: 3,
    title:
      'Bach Goldberg Var. 1 · mm. 27–29 — the 3-way grid writing policy on dense sixteenths: protected barlines / strict air-channelled grid / unified transparent grid, with continuous barlines and beat lines across Middle C',
  },
  {
    scoreId: SPECIMEN_STUDIO_SCORE_ID,
    measureStart: 1,
    measureCount: 2,
    title:
      'Wide-Span Chord Specimen · standardized up-raked 12.4° kinetic clasps (half: open white ring, quarter: plain bracket, dotted quarter: +0.75pt dot, 8th: 1 slash, 16th: 2 slashes) on clean stemless 1.5-octave chords',
  },
];

/**
 * The active candidate set — the four Round 12 rest dialects, each paired with
 * one System 1 start symbol and one grid writing policy. Order is the display
 * order in the Decision Candidates Matrix. All four share the settled
 * beam-harmonized kinetic tab (`'kinetic-tab-beam'`), the per-hand bracket
 * scope, the standardized up-raked 12.4° kinetic clasp and the continuous
 * vertical grid, so a candidate states exactly three deltas: the ink a silent
 * span leaves on the voice equator, the margin ink at the system start, and the
 * policy that decides who owns the grid overlap.
 */
export const CURRENT_CANDIDATES: JankoCandidate[] = [
  {
    id: 'kinetic-monoline-architectural-bracket',
    label: 'A · Kinetic Monoline Rests / Architectural Bracket (0.65pt)',
    description:
      'A slender 12pt rest stem anchored on the voice equator, carrying the score’s own beam-harmonized 12.4° kinetic tabs — two for a 16th, one for an 8th — a clean central horizontal notch for a quarter and a hollow 7 × 2.2pt bar for a half. The silence speaks the exact kinetic language of the subdivision tab and the clasp slash. The system opens on the 0.65pt architectural bracket with 3.0pt spurs, and the barlines keep their protected air while the beat pulses pass behind the noteheads.',
    options: {
      chordGrouping: 'per-hand-clasp',
      restStyle: 'kinetic-monoline',
      systemStartStyle: 'architectural-bracket',
      gridWritingPolicy: 'overlaid-beat-grid',
    },
    windows: ROUND_12_WINDOWS,
    tags: ['12.4° kinetic tabs', '0.65pt + 3.0pt spurs', 'protected barlines'],
  },
  {
    id: 'classical-urtext-delicate-bracket',
    label: 'B · Classical Urtext Rests / Delicate Bracket (0.50pt)',
    description:
      'The timeless calligraphic Urtext rest: a double hook for a 16th, a single hook for an 8th, the serpentine lightning glyph for a quarter and a solid 6 × 2.5pt block for a half — instantly recognizable to any reader. The system opens on the delicate 0.50pt bracket with 2.5pt spurs, and the grid is strict: barlines and beat pulses alike are painted through dedicated white air channels above the rhythm layer, so no stem or beam may ever overwrite a grid line.',
    options: {
      chordGrouping: 'per-hand-clasp',
      restStyle: 'classical-urtext',
      systemStartStyle: 'delicate-bracket',
      gridWritingPolicy: 'strict-protected-grid',
    },
    windows: ROUND_12_WINDOWS,
    tags: ['calligraphic 𝄿 𝄾 𝄽', '0.50pt + 2.5pt spurs', 'air-channelled grid'],
  },
  {
    id: 'geometric-node-clef-pillar',
    label: 'C · Geometric Node Rests / Nib-Free Clef Pillar',
    description:
      'Minimalist pause nodes: a hollow 4 × 4pt diamond with two lateral tick rays for a 16th, one ray for an 8th, a solid 5 × 5pt diamond for a quarter and an open capsule for a half — pure geometry, zero calligraphy. The system opens on the nib-free 0.50pt clef pillar that ticks the four octave equators only, and the grid turns fully transparent: the music uses the full measure width and every glyph mask knocks the grid out, barline and beat pulse alike, exactly as it knocks out a background coordinate.',
    options: {
      chordGrouping: 'per-hand-clasp',
      restStyle: 'geometric-node',
      systemStartStyle: 'clef-pillar',
      gridWritingPolicy: 'unified-transparent-grid',
    },
    windows: ROUND_12_WINDOWS,
    tags: ['geometric nodes', 'nib-free 0.50pt pillar', 'transparent grid'],
  },
  {
    id: 'bauhaus-slash-architectural-bracket',
    label: 'D · Bauhaus Hairline Rests / Architectural Bracket (0.65pt)',
    description:
      'Architectural 45° beveled slashes: a single slash with one parallel wing for an 8th, the slash with two wings for a 16th, a minimalist reversed-Z for a quarter and a thin hairline box for a half — the Bauhaus grammar of the modern score, at the monoline weight of every other element. The system opens on the 0.65pt architectural bracket with 3.0pt spurs, and the barlines keep their protected air while the beat pulses pass behind the noteheads.',
    options: {
      chordGrouping: 'per-hand-clasp',
      restStyle: 'bauhaus-slash',
      systemStartStyle: 'architectural-bracket',
      gridWritingPolicy: 'overlaid-beat-grid',
    },
    windows: ROUND_12_WINDOWS,
    tags: ['45° beveled slashes', '0.65pt + 3.0pt spurs', 'Bauhaus grammar'],
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
