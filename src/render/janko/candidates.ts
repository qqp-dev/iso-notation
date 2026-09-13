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
 * scaled midpoint clasps with the retired accolade, round 11 the four System 1
 * start replacements with the light transverse cuts, and round 12 the rest
 * symbol dialects on the continuous vertical grid. Round 13 answers the
 * operator's verdict on that round: the rest **moves onto the voice contour**
 * of its own hand (no more sky-floating Octave 4 equator), the System 1 start
 * is standardized to the **flared 0.65pt architectural bracket**, a beam may no
 * longer bridge the rest that interrupts it, and the four high-fidelity rest
 * finalists — authentic Urtext, phantom notehead, geometric node and the
 * corrected downward-hooked kinetic monoline — are compared side by side.
 */
export const CURRENT_ROUND_METADATA: JankoCandidateRound = {
  round: 13,
  title: 'Voice Contour Rests, Flared 0.65pt Bracket & Beam Discontinuity',
  description:
    'Comparing 4 high-fidelity rest dialects anchored on the melodic voice contour, under the standardized flared 0.65pt architectural bracket, with beams that break across rests and multi-system crops that no longer collapse to an empty white page.',
};

/**
 * The four display windows every Round 13 candidate is engraved on: the Bach
 * opening (the standardized flared 0.65pt architectural bracket), the Bach
 * Var. 1 m. 4 silence (the four rest dialects at tick 552, resolving the RH
 * syncopation on the Octave 3 voice contour, plus the `528 540 | 564` beam
 * break), the Bach Var. 1 mm. 27–28 dense-sixteenth run (**one** system, full
 * measure width — the Round 12 window straddled Systems 6 and 7 and collapsed
 * to a 1pt white strip), and the **wide-span chord specimen**, whose dense
 * four-voice chords carry the contour-anchored silence of their m. 2 measure.
 */
const ROUND_13_WINDOWS: JankoCandidateWindow[] = [
  {
    scoreId: DEFAULT_STUDIO_SCORE_ID,
    measureStart: 1,
    measureCount: 2,
    title:
      'Bach Goldberg Var. 1 · mm. 1–2 — the standardized System 1 start: one 0.65pt architectural rule clasping Octaves 5 … 2, its 3.0pt spurs flaring 13° diagonally outward',
  },
  {
    scoreId: DEFAULT_STUDIO_SCORE_ID,
    measureStart: 4,
    measureCount: 1,
    title:
      'Bach Goldberg Var. 1 · m. 4 — the 4 rest dialects at tick 552, anchored on the RH voice contour (target y = 166pt, the midpoint of digit 9 at 158.5pt and digit 0 at 173.5pt, fitted to the nearest legal position beside the LH D3 head), with the beam breaking at the rest: 528 + 540 beamed, 564 an independent flagged 16th',
  },
  {
    scoreId: DEFAULT_STUDIO_SCORE_ID,
    measureStart: 27,
    measureCount: 2,
    title:
      'Bach Goldberg Var. 1 · mm. 27–28 — one system at full width: the dense sixteenths under the continuous barline + beat-pulse grid across Middle C (the Round 12 cross-system window collapsed to an empty white page)',
  },
  {
    scoreId: SPECIMEN_STUDIO_SCORE_ID,
    measureStart: 1,
    measureCount: 2,
    title:
      'Wide-Span Chord Specimen · the m. 2 voice-contour 8th rest anchored on the mean register of the four-voice chords that surround it (y = 121pt) — the written silence inside a dense chordal texture',
  },
];

/**
 * The active candidate set — the four Round 13 rest finalists, all engraved
 * under the **standardized** flared 0.65pt architectural bracket and the golden
 * chord grouping. Order is the display order in the Decision Candidates Matrix.
 * A candidate therefore varies the round's **single** question — the ink a
 * silent span leaves on its hand's voice contour: authentic calligraphic
 * Urtext, phantom notehead, geometric pause node, or the corrected
 * downward-hooked kinetic monoline.
 */
export const CURRENT_CANDIDATES: JankoCandidate[] = [
  {
    id: 'classical-urtext-flared-bracket',
    label: 'A · Authentic Classical Urtext Rest / Flared Bracket',
    description:
      'The timeless calligraphic Urtext rest, redrawn with true SMuFL vector grammar: a slightly slanted calligraphic stem whose single hook (8th) or double hook (16th) sweeps left into a solid teardrop bulb, the serpentine 𝄽 lightning for a quarter and a solid 6 × 2.5pt block sitting on the contour for a half. Instantly recognizable to any reader, and anchored exactly where the missing note would have been. The system opens on the standardized flared 0.65pt architectural bracket.',
    options: {
      restStyle: 'classical-urtext',
      systemStartStyle: 'architectural-bracket',
    },
    windows: ROUND_13_WINDOWS,
    tags: ['calligraphic 𝄿 𝄾 𝄽', 'teardrop bulbs', 'flared 0.65pt bracket'],
  },
  {
    id: 'phantom-notehead-flared-bracket',
    label: 'B · Phantom Notehead Rest / Flared Bracket',
    description:
      'An open dashed notehead (R = 3.0pt) standing exactly where the unvoiced note would have been, carrying the score’s own duration grammar: a monoline stem with one downward-hooked flag for an 8th, two for a 16th, the bare stem for a quarter and a calm hollow dashed bar for a half. The silence keeps the melodic contour of the line it interrupts — the eye reads the missing note, not an abstract pause. The system opens on the standardized flared 0.65pt architectural bracket.',
    options: {
      restStyle: 'phantom-notehead',
      systemStartStyle: 'architectural-bracket',
    },
    windows: ROUND_13_WINDOWS,
    tags: ['dashed phantom head R 3.0pt', 'downward-hooked flags', 'voice-contour anchor'],
  },
  {
    id: 'geometric-node-flared-bracket',
    label: 'C · Geometric Pause Node / Flared Bracket',
    description:
      'Minimalist pause nodes centred on the voice contour: a hollow 4 × 4pt diamond with two lateral tick rays for a 16th, one ray for an 8th, a solid 5 × 5pt diamond for a quarter and an open capsule for a half — pure geometry, zero calligraphy, the smallest footprint of the four so it nestles deepest into the contour. The system opens on the standardized flared 0.65pt architectural bracket.',
    options: {
      restStyle: 'geometric-node',
      systemStartStyle: 'architectural-bracket',
    },
    windows: ROUND_13_WINDOWS,
    tags: ['geometric nodes', 'smallest footprint', 'flared 0.65pt bracket'],
  },
  {
    id: 'kinetic-monoline-flared-bracket',
    label: 'D · Corrected Kinetic Monoline Rest / Flared Bracket',
    description:
      'The golden rest dialect with its kinetic tabs corrected: a slender 12pt monoline stem on the voice contour whose 12.4° tabs now hook **downward** to the right, exactly like the score’s own beam-harmonized flags — two for a 16th, one for an 8th — a central horizontal notch for a quarter and a hollow 7 × 2.2pt bar for a half. The silence speaks the kinetic language of the subdivision tab and the clasp slash. The system opens on the standardized flared 0.65pt architectural bracket.',
    options: {
      restStyle: 'kinetic-monoline',
      systemStartStyle: 'architectural-bracket',
    },
    windows: ROUND_13_WINDOWS,
    tags: ['downward 12.4° kinetic tabs', 'voice-contour anchor', 'flared 0.65pt bracket'],
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
