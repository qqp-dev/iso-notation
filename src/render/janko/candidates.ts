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
 * phrase-row rests, round 18 the rest-shape verdict, and round 19 the
 * symmetric-tuck clusters with the RH anchor approved.
 *
 * **Round 20 is a VERIFICATION round: no open axis.** Every card below is the
 * fixed golden master — {@link DEFAULT_JANKO_OPTIONS} /
 * {@link DEFAULT_JANKO_TOKENS}, no option delta at all — engraved on one
 * verification window of the round's four settled changes:
 *
 * 1. **Optical rest seats** — every rest glyph is placed so its **ink
 *    centroid** stands on its phrase row (the half slab atop it, the whole slab
 *    hanging below), and the linter audits the seat
 *    (`rest-centroid-off-row`);
 * 2. **The urtext re-cut** — every rest glyph and every flag hook is cut
 *    against the classical standard at the house 0.90pt weight, and the
 *    **whole-bar** form (192 ticks, one complete measure) exists;
 * 3. **The unison merge** — one onset + one pitch = one sound event = **one
 *    digit**, on the anchor-winner's column, with every mixed-duration rhythm
 *    voice intact (`unison-double-digit`);
 * 4. **The clasp-dot fix** — a dotted clasp's dot is a clean satellite of its
 *    mark, with hug air against the mark and every neighbour
 *    (`clasp-dot-fusion`).
 *
 * The operator's verdict is read off the windows, not off a candidate axis:
 * rests sit where the notes are, the cuts read classical, the unisons are
 * single digits with their beams whole, and no nib fuses with its ring.
 */
export const CURRENT_ROUND_METADATA: JankoCandidateRound = {
  round: 21,
  title: 'Measured Duration Ink · Slabs on Lines · Lower-First',
  description:
    'The round that stops drawing and starts measuring. Every rest constant now traces to a fontTools outline extraction of **Bravura** (SMuFL reference, v1.482) corroborated by **Noto Music** (v2.003), through one explicit scale: 1 staff space = 18.4pt / 4.732sp, because the working set’s tallest glyph (the 64th rest, 4.732 spaces) exactly fills the lattice’s measured inter-row headroom. The half slab now sits **on** a drawn staff rule and the whole slab hangs **from** one — touching, zero gap — with the whole bar centred in its measure; the anchor rule is **lower-first** on all sixteen corpus rows and the unison survivor is the lower voice; and the working set walks `whole → 64th` complete, on constructed specimen windows for every new part. No axis is open: every card is the golden master itself.',
  openAxes: [],
};

/**
 * The Round 21 verification windows: the five rest cuts + slab seats, the two
 * corpus rest windows, the sixteen lower-first rows, the mixed-level beam
 * groups, the constructed 32nd/64th windows, the nib guard and the final-bar
 * unison guard.
 */
const ROUND_21_WINDOWS: JankoCandidateWindow[] = [
  {
    scoreId: REST_SPECIMEN_STUDIO_SCORE_ID,
    measureStart: 1,
    measureCount: 3,
    title: 'Rest specimen · mm. 1–3 — the measured cuts: 16th, 8th, quarter',
  },
  {
    scoreId: REST_SPECIMEN_STUDIO_SCORE_ID,
    measureStart: 4,
    measureCount: 3,
    title: 'Rest specimen · mm. 4–6 — the half slab sits ON a drawn rule, the whole bar hangs FROM one and is centred',
  },
  {
    scoreId: REST_SPECIMEN_STUDIO_SCORE_ID,
    measureStart: 7,
    measureCount: 2,
    title: 'Rest specimen · mm. 7–8 — the two new values: 32nd and 64th silences',
  },
  {
    scoreId: DEFAULT_STUDIO_SCORE_ID,
    measureStart: 4,
    measureCount: 3,
    title: 'Bach Var. 1 · mm. 4–6 — the canonical 16th seat, re-cut',
  },
  {
    scoreId: BRAHMS_STUDIO_SCORE_ID,
    measureStart: 7,
    measureCount: 1,
    title: 'Brahms Op. 118/1 · m. 7 — a measured 16th seat beside the lower-first row',
  },
  {
    scoreId: DEFAULT_STUDIO_SCORE_ID,
    measureStart: 3,
    measureCount: 1,
    title: 'Bach Var. 1 · m. 3 — lower-first: the LH C♯4 holds the column, the RH A4 fans',
  },
  {
    scoreId: BRAHMS_STUDIO_SCORE_ID,
    measureStart: 46,
    measureCount: 1,
    title: 'Brahms Op. 118/1 · m. 46 — lower-first on the dense pair rows (D4 holds, G♯4 fans)',
  },
  {
    scoreId: DURATION_SPECIMEN_STUDIO_SCORE_ID,
    measureStart: 1,
    measureCount: 2,
    title: 'Duration specimen · mm. 1–2 — the tertiary 32nd run and the quaternary 64th run',
  },
  {
    scoreId: DURATION_SPECIMEN_STUDIO_SCORE_ID,
    measureStart: 3,
    measureCount: 2,
    title: 'Duration specimen · mm. 3–4 — mixed levels in one beat, and the lone-16th partial beams',
  },
  {
    scoreId: DURATION_SPECIMEN_STUDIO_SCORE_ID,
    measureStart: 5,
    measureCount: 1,
    title: 'Duration specimen · m. 5 — solo 32nd and 64th flags (triple and quad)',
  },
  {
    scoreId: BRAHMS_STUDIO_SCORE_ID,
    measureStart: 3,
    measureCount: 1,
    title: 'Brahms Op. 118/1 · m. 3 — the nib guard: the dot still a clean satellite',
  },
  {
    scoreId: DEFAULT_STUDIO_SCORE_ID,
    measureStart: 32,
    measureCount: 1,
    title: 'Bach Var. 1 · m. 32 — the final-bar unison guard: one digit, now the lower voice’s',
  },
];

/** The round’s verification cards, one per settled change, in display order. */
export const CURRENT_CANDIDATES: JankoCandidate[] = [
  {
    id: 'verify-measured-cuts',
    label: '1 · Measured Cuts — every part traced to the outlines',
    description:
      'Nothing is hand-drawn any more. The quarter is the **traced measured contour** of Bravura `restQuarter` (44 arc-length samples: three crossings, a hairline neck, a 165u belly, two tapered hooks) painted as one filled calligraphic path. The 8th … 64th are the measured **wedge stem + lobe** construction — lobe radius 65u, pitch 249u, stem 65u → 46u → a point — with each lobe’s contour starting and ending on the stem’s own spine, so the hook is *grown from* the stem. The slab pair is the measured 282 × 144u.',
    windows: ROUND_21_WINDOWS.filter(
      (w) =>
        w.scoreId === REST_SPECIMEN_STUDIO_SCORE_ID ||
        (w.scoreId === DEFAULT_STUDIO_SCORE_ID && w.measureStart === 4)
    ),
    tags: ['measured', 'Bravura 1.482', 'serpentine', 'grown lobes'],
  },
  {
    id: 'verify-slab-lines',
    label: '2 · Slabs on Lines — half sits ON, whole hangs FROM, whole centred',
    description:
      'A bar rest derives its meaning from touching a line. The half slab’s bottom edge and the whole slab’s top edge now stand **exactly on a drawn staff rule** (zero gap, measured — the seat no longer snaps to an invisible phrase row), and the whole bar is **centred in its measure** on the barline midpoint (Gould; LilyPond NR §§2.2.1/2.2.3), exempt from the beat-cell nudge and cleared vertically by row separation. The linter names a slab that touches nothing: `rest-slab-off-line`.',
    windows: ROUND_21_WINDOWS.filter(
      (w) =>
        (w.scoreId === REST_SPECIMEN_STUDIO_SCORE_ID && w.measureStart >= 4) ||
        (w.scoreId === BRAHMS_STUDIO_SCORE_ID && w.measureStart === 3)
    ),
    tags: ['slab-on-line', 'whole centred', 'rest-slab-off-line', 'nib guard'],
  },
  {
    id: 'verify-lower-first',
    label: '3 · Lower-First — the lowest head holds the column',
    description:
      'The anchor rule is **lower-first**, and it is a rule, not an option: on a mixed-hand row the lowest-pitched head keeps the column and the other fans; on a single-hand row the middle head does, exactly as before. All **sixteen** corpus rows flip — Bach’s eight (bar3:t408 … bar31:t4368) and Brahms’s eight (bar7:t1296 … bar49:t9432) — with the stem-x set inside each row preserved by the pure swap. A cross-hand unison ties on pitch, so the **lower voice** (LH) keeps the digit.',
    windows: ROUND_21_WINDOWS.filter(
      (w) =>
        (w.scoreId === DEFAULT_STUDIO_SCORE_ID && [3, 32].includes(w.measureStart)) ||
        w.scoreId === BRAHMS_STUDIO_SCORE_ID
    ),
    tags: ['lower-first', 'anchor', 'unison survivor'],
  },
  {
    id: 'verify-working-set',
    label: '4 · The Working Set — whole → 64th, complete, on constructed windows',
    description:
      'This is a notation **system**, not two pieces: the standard set `whole → 64th` is stated whether or not Bach or Brahms happens to use it. The corpus has no 32nds or 64ths at all, so §E **constructs** the specimens — the rest specimen’s new 32nd and 64th silences, and the duration specimen’s tertiary 32nd run, quaternary 64th run, mixed levels in one beat, lone-16th partial beams and solo triple/quad flags. `beamLevel = f(duration)` builds the levels generically: a 128th would be data, not architecture.',
    windows: ROUND_21_WINDOWS.filter(
      (w) => w.scoreId === DURATION_SPECIMEN_STUDIO_SCORE_ID
    ),
    tags: ['32nd', '64th', 'stubs', 'beam levels'],
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
