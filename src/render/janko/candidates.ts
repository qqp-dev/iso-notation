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
  round: 20,
  title: 'Verification — Rest Seats · Urtext Re-cut · Unison Merge · Nib',
  description:
    'The settled golden master on the round’s own evidence. Rest seats: the rest specimen’s five values — 16th, 8th, quarter, half and the new 192-tick whole bar — read with the ink centroid on the phrase row, the half slab atop its row and the whole slab hanging below it, beside the three genuine Brahms seats (mm. 7, 17, 68) and the canonical Bach m. 4. Urtext re-cut: every rest glyph and every flag hook is the classical cut at the house 0.90pt weight, judged on Bach’s 8th-flag window (m. 1) and its 16th-double window (m. 22). Unison merge: the Goldberg’s final bar and the three Brahms measures that double a pitch (mm. 60, 65, 66) paint one digit per sound, with every beam and flag of the mixed-duration voices intact. Nib: Brahms m. 3’s dotted clasp — the tick-432 ring the operator caught, now a clean satellite of its mark — plus the specimen’s whole-bar measure. No axis is open: every card is the golden master itself, and the live linter stands in for the implementer’s eye.',
  openAxes: [],
};

/**
 * The Round 20 verification windows: the rest specimen (all five values,
 * including the whole bar), Bach’s single- and double-flag measures, Brahms’s
 * genuine rest seats, the merged unisons on both scores, and the nib case.
 */
const ROUND_20_WINDOWS: JankoCandidateWindow[] = [
  {
    scoreId: REST_SPECIMEN_STUDIO_SCORE_ID,
    measureStart: 1,
    measureCount: 3,
    title: 'Rest specimen · mm. 1–3 — 16th, 8th and quarter: ink centroid on the phrase row',
  },
  {
    scoreId: REST_SPECIMEN_STUDIO_SCORE_ID,
    measureStart: 4,
    measureCount: 3,
    title: 'Rest specimen · mm. 4–6 — the half sits atop its row, the whole bar hangs below it',
  },
  {
    scoreId: DEFAULT_STUDIO_SCORE_ID,
    measureStart: 1,
    measureCount: 1,
    title: 'Bach Var. 1 · m. 1 — the classical 8th-flag hook, single',
  },
  {
    scoreId: DEFAULT_STUDIO_SCORE_ID,
    measureStart: 22,
    measureCount: 1,
    title: 'Bach Var. 1 · m. 22 — the 16th doubles, stacked by flagSpacing',
  },
  {
    scoreId: BRAHMS_STUDIO_SCORE_ID,
    measureStart: 7,
    measureCount: 1,
    title: 'Brahms Op. 118/1 · m. 7 — a genuine 16th seat beside the other hand’s entry',
  },
  {
    scoreId: BRAHMS_STUDIO_SCORE_ID,
    measureStart: 17,
    measureCount: 1,
    title: 'Brahms Op. 118/1 · m. 17 — the second seat, 109 flags in the same window',
  },
  {
    scoreId: BRAHMS_STUDIO_SCORE_ID,
    measureStart: 68,
    measureCount: 1,
    title: 'Brahms Op. 118/1 · m. 68 — the closing seat',
  },
  {
    scoreId: DEFAULT_STUDIO_SCORE_ID,
    measureStart: 32,
    measureCount: 1,
    title: 'Bach Var. 1 · m. 32 — the final bar: one digit where two “7”s stood',
  },
  {
    scoreId: BRAHMS_STUDIO_SCORE_ID,
    measureStart: 60,
    measureCount: 1,
    title: 'Brahms Op. 118/1 · m. 60 — merged unison 84/24: one head, both rhythm voices',
  },
  {
    scoreId: BRAHMS_STUDIO_SCORE_ID,
    measureStart: 65,
    measureCount: 1,
    title: 'Brahms Op. 118/1 · m. 65 — three merged unisons in one measure, beams whole',
  },
  {
    scoreId: BRAHMS_STUDIO_SCORE_ID,
    measureStart: 66,
    measureCount: 1,
    title: 'Brahms Op. 118/1 · m. 66 — unison 21/132 and the same-duration pair 21/21',
  },
  {
    scoreId: BRAHMS_STUDIO_SCORE_ID,
    measureStart: 3,
    measureCount: 1,
    title: 'Brahms Op. 118/1 · m. 3 — the tick-432 dotted clasp: the dot now a clean satellite',
  },
];

/** The round’s verification cards, one per settled change, in display order. */
export const CURRENT_CANDIDATES: JankoCandidate[] = [
  {
    id: 'verify-rest-seats',
    label: '1 · Optical Rest Seats — the ink centroid on the phrase row',
    description:
      'Rests are no longer seated by the near edge of a geometric box: the glyph is placed so its **ink centroid** stands on the phrase row (both axes), so the row the eye reads is the row the engine chose. Every value is here — the specimen’s 16th/8th/quarter, its half slab sitting atop its row, its new whole slab hanging below it — beside the three genuine Brahms seats and the canonical Bach m. 4 16th. The linter audits the seat as a violation, never a warning.',
    windows: ROUND_20_WINDOWS.filter((w) => w.scoreId === REST_SPECIMEN_STUDIO_SCORE_ID).concat(
      ROUND_20_WINDOWS.filter((w) => w.scoreId === BRAHMS_STUDIO_SCORE_ID && [7, 17, 68].includes(w.measureStart))
    ),
    tags: ['seats', 'centroid-on-row', 'rest-centroid-off-row'],
  },
  {
    id: 'verify-urtext-recut',
    label: '2 · Urtext Re-cut — classical rests and the classical flag hook',
    description:
      'Every rest glyph and every flag hook is cut against the classical standard at the house 0.90pt weight: slanted stems with oval heads for the 8th/16th, the true serpentine quarter, wide solid slabs for the half and whole bar — and the classical tapered hook (U+1D160-class) for every flag, single or double. Bach’s 8th-flag window and its 16th-double window judge the hooks; the specimen judges the rests.',
    windows: ROUND_20_WINDOWS.filter(
      (w) => w.scoreId === DEFAULT_STUDIO_SCORE_ID && [1, 22].includes(w.measureStart)
    ),
    tags: ['re-cut', 'classical taper', 'whole bar'],
  },
  {
    id: 'verify-unison-merge',
    label: '3 · Unison Merge — one sound, one digit',
    description:
      'One onset + one pitch = one sound event = **one digit**, on the anchor-winner’s column (the RH head), with no duration veto. The Goldberg’s final bar paints a single “7”; the seven Brahms unisons paint one digit each, and the six mixed-duration ones keep both rhythm voices — each voice’s stem, beam and flag at its own end, so no beam group loses a member. The linter makes a double digit a violation.',
    windows: ROUND_20_WINDOWS.filter(
      (w) =>
        (w.scoreId === DEFAULT_STUDIO_SCORE_ID && w.measureStart === 32) ||
        (w.scoreId === BRAHMS_STUDIO_SCORE_ID && [60, 65, 66].includes(w.measureStart))
    ),
    tags: ['unison', 'one digit', 'unison-double-digit'],
  },
  {
    id: 'verify-clasp-nib',
    label: '4 · Clasp Nib Fix — the dot as a clean satellite',
    description:
      'A dotted clasp’s 0.75pt dot is placed up-and-right of its mark, tracking the mark’s edge, so it keeps the house dot hug against the spine, the open ring and every transverse cut — and against every neighbouring ink box, the cluster’s own member discs included. Brahms m. 3’s tick-432 ring (the ~1.05pt fusion the operator caught) is the case window; the linter reports any future fusion.',
    windows: ROUND_20_WINDOWS.filter(
      (w) => w.scoreId === BRAHMS_STUDIO_SCORE_ID && w.measureStart === 3
    ),
    tags: ['nib', 'clasp dot', 'clasp-dot-fusion'],
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
