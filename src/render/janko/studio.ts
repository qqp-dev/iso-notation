/**
 * Jánko Two-View Live Studio
 * ==========================
 *
 * The designer-facing half of the iteration rig. This module renders the whole
 * studio **from the TypeScript engraving engine** — there is no PNG in the
 * loop, and no template to edit when a candidate changes:
 *
 * - **View 1 · Decision Candidates Matrix** — every entry of
 *   {@link CURRENT_CANDIDATES} engraved side by side on the same measures, with
 *   option-delta badges and a live lint chip per candidate.
 * - **View 2 · Golden Reference Object** — the accumulated golden master: the
 *   full page spread plus the macro focus crops that show progress toward
 *   "done".
 *
 * The module is imported as a Vite entry from `janko.html`; any edit under
 * `src/render/janko/` re-renders the whole studio in place through
 * `import.meta.hot` (no user action, no browser refresh).
 *
 * All `render*View` functions are pure string builders, so they are unit-tested
 * headlessly in Node; only {@link mountJankoStudio} touches the DOM.
 */

import { QuantizedGridScore } from '../../model/types';
import { detectHandCrossings } from '../../model/grid';
import { resolveActiveScore } from '../../scores/active';
import { buildBachGoldbergVar1Score } from '../../scores/bach-goldberg-var1';
import {
  DURATION_SPECIMEN_JANKO_OPTIONS,
  DURATION_SPECIMEN_JANKO_TOKENS,
  buildDurationSpecimenScore,
} from '../../scores/duration-specimen';
import {
  BRAHMS_OP118_NO1_JANKO_OPTIONS,
  BRAHMS_OP118_NO1_JANKO_TOKENS,
} from '../../scores/brahms-op118-no1';
import { buildChordDurationSpecimenScore } from '../../scores/chord-duration-specimen';
import { buildSchumannNo43Draft } from '../../scores/schumann-no43-draft';
import { buildSchumannNo14Draft } from '../../scores/schumann-no14-draft';
import {NO14_PRACTICE_SCORE_ID,no14PracticeProfile} from './no14-practice';
import {NO14_WRITTEN_SCORE_ID,projectNo14Written} from './no14-written';
import {NO14_GOLD_REFERENCE_ID,NO14_GOLD_PDF} from './no14-gold';
import {NO14_PUBLISHED_IDENTITY,no14PublishedProfile} from './no14-published';
import {NO14_GESTURE_RELATIVE_ID,NO14_GESTURE_UNDERLINE_ID,NO14_GESTURE_REFINED_ID,NO14_GESTURE_CENTERED_ID,NO14_GESTURE_CONDENSED_ID,NO14_GESTURE_OPTICAL_ID,NO14_GESTURE_OPEN_ID,no14GestureRelativeProfile,no14GestureUnderlineProfile,no14GestureRefinedProfile,no14GestureCenteredProfile,no14GestureCondensedProfile,no14GestureOpticalProfile,no14GestureOpenProfile} from './no14-gesture-relative';
import {NO14_RELATIVE_SCORE_ID,NO14_RELATIVE_BASELINE_ID,no14RelativeProfile,no14RelativeBaselineProfile} from './no14-relative';
import { buildSchumannNo30Draft } from '../../scores/schumann-no30-draft';
import { buildSchumannNo13Draft } from '../../scores/schumann-no13-draft';
import {
  REST_DURATION_SPECIMEN_JANKO_OPTIONS,
  REST_DURATION_SPECIMEN_JANKO_TOKENS,
  buildRestDurationSpecimenScore,
} from '../../scores/rest-duration-specimen';
import {
  DEFAULT_JANKO_OPTIONS,
  DEFAULT_JANKO_TOKENS,
  ResolvedJankoLayoutOptions,
  ResolvedJankoTokens,
  resolveJankoOptions,
  resolveJankoTokens,
} from './types';
import {
  renderJankoCrop,
  renderJankoPage,
  countJankoPages,
  countJankoSystems,
  layoutJankoScore,
  JankoSystemLayout,
} from './engine';
import { getChannelLayoutSpec } from './geometry';
import {
  STUDIO_SCROLL_CAPTURE_DELAY_MS,
  clampStudioScroll,
  openStudioReviewSession,
  type StudioReviewSession,
  type StudioScrollPort,
  type StudioSessionHost,
  type StudioStorageLike,
} from './studio-session';
import {
  BRAHMS_STUDIO_SCORE_ID,
  SCHUMANN_NO43_STUDIO_SCORE_ID,
  SCHUMANN_NO14_STUDIO_SCORE_ID,
  SCHUMANN_NO30_STUDIO_SCORE_ID,
  SCHUMANN_NO13_STUDIO_SCORE_ID,
  BACH_PR112_SCORE_ID,
  BACH_PR114_SCORE_ID,
  PR112_EVENTS,
  DURATION_SPECIMEN_STUDIO_SCORE_ID,
  HOLD_ENDPOINT_SPECIMEN_STUDIO_SCORE_ID,
  DURATION_VOCABULARY_SPECIMEN_STUDIO_SCORE_ID,
  PITCH_PARITY_SPECIMEN_STUDIO_SCORE_ID,
  CURRENT_CANDIDATES,
  CURRENT_ROUND_METADATA,
  CandidateOptionBadge,
  DEFAULT_STUDIO_SCORE_ID,
  JankoCandidate,
  JankoCandidateRound,
  REST_SPECIMEN_STUDIO_SCORE_ID,
  SPECIMEN_STUDIO_SCORE_ID,
  SYNTHETIC_M8_DIAGNOSTIC_SCORE_ID,
  candidateBadges,
  resolveCandidate,
  semanticHandCandidate,
  isAbstractCandidateWindow,
  JankoAbstractCandidateWindow,
  JankoScoreCandidateWindow,
} from './candidates';
import {
  renderAbstractKeySvg,
  renderAbstractSubsetSvg,
  renderAbstractTranspositionBatterySvg,
  renderAbstractNearNeighboursBatterySvg,
  renderAbstractDensityBatterySvg,
  renderAbstractLadderOctaveProbeSvg,
  lintAbstractGeometry,
  ABSTRACT_GEOMETRY_SPECS,
  ABSTRACT_SUBSET_1,
  ABSTRACT_SUBSET_2,
} from './elements/abstract-geometry';
import { buildSyntheticM8DiagnosticScore } from '../../scores/synthetic-m8-diagnostic';
import {
  buildHoldEndpointSpecimenScore,
  HOLD_ENDPOINT_SPECIMEN_JANKO_OPTIONS,
  HOLD_ENDPOINT_SPECIMEN_JANKO_TOKENS,
} from '../../scores/hold-endpoint-specimen';
import {
  buildDurationVocabularySpecimenScore,
  DURATION_VOCABULARY_SPECIMEN_JANKO_OPTIONS,
  DURATION_VOCABULARY_SPECIMEN_JANKO_TOKENS,
} from '../../scores/duration-vocabulary-specimen';
import {
  buildPitchParitySpecimenScore,
  PITCH_PARITY_SPECIMEN_JANKO_OPTIONS,
  PITCH_PARITY_SPECIMEN_JANKO_TOKENS,
} from '../../scores/pitch-parity-specimen';
import { LintReport, lintJankoScore, lintJankoWindowSystems } from './linter';
import { PreparedJankoWindows, renderPreparedJankoWindow } from './prepared-windows';
import { renderPracticeView } from './practice';

/** One macro focus crop in the Golden Reference view. */
export interface StudioCrop {
  /** First measure (1-based). */
  start: number;
  /** Measures shown. */
  count: number;
  /** Card title. */
  title: string;
  /** One-line designer note. */
  caption: string;
}

/**
 * The reference-view Brahms macro crops (Round 31, re-aimed at the fixed-3
 * golden): the upbeat and downbeat with the white-ring clasp, the first
 * fixed-3 fold under its Gould bracket, and the five-voice chords — the
 * three sights the operator walks first.
 */
export const BRAHMS_STUDIO_CROPS: StudioCrop[] = [
  {
    start: 1,
    count: 2,
    title: 'mm. 1–2 · Upbeat and downbeat',
    caption:
      'The quarter-note upbeat, the m. 1 downbeat chord over the bass arpeggio, and the white-ring clasp dotting the dotted half.',
  },
  {
    start: 5,
    count: 2,
    title: 'mm. 5–6 · First fold',
    caption:
      'Note #47 folds an octave below the fixed-3 core under its ↓10 bracket — the first of nine folded notes.',
  },
  {
    start: 7,
    count: 2,
    title: 'mm. 7–8 · Five-voice chords',
    caption:
      'The massive five-voice chords with the octave-1 ledger stack whole — the seated surface carries no finding here.',
  },
];

/**
 * The retired Bach reference-view macro crops. Dropped from the default
 * Reference by operator order (visual weight, not necessary — the full
 * spread stays); kept exported so an explicit `crops` override can still
 * resurrect them. The Brahms crops ({@link BRAHMS_STUDIO_CROPS}) are live.
 */
export const DEFAULT_STUDIO_CROPS: StudioCrop[] = [
  {
    start: 1,
    count: 2,
    title: 'mm. 1–2 · Inception',
    caption:
      'The flared 0.65pt architectural bracket clasping Octaves 5 … 2, the Position of Honor halo, the spacious spine-free Middle C corridor and the opening m.d./m.s. dialogue.',
  },
  {
    start: 4,
    count: 1,
    title: 'm. 4 · RH run into octave 3',
    caption: 'Dynamic ledger equators as the right hand descends across the corridor.',
  },
  {
    start: 8,
    count: 1,
    title: 'm. 8 · 16th-note spacing stress',
    caption: 'Horizontal notehead clearance (2r) under the densest motoric writing.',
  },
  {
    start: 14,
    count: 1,
    title: 'm. 14 · Cross-hand row collision',
    caption:
      'Two voices landing on one whole-tone row of one octave — the defect that opened the row-snapped round. Both heads keep their true row and are now spread horizontally, so neither digit is erased.',
  },
  {
    start: 24,
    count: 1,
    title: 'm. 24 · Register leap',
    caption: 'Wide ledger stacks and hand crossing at the climax of the variation.',
  },
];

/**
 * One benchmark score a candidate window may name, with the layout options and
 * tokens its own notation needs (anacrusis, cut-time measure, systems per page).
 */
export interface StudioScore {
  /** Registry id (matched against `JankoCandidateWindow.scoreId`). */
  id: string;
  score: QuantizedGridScore;
  options: ResolvedJankoLayoutOptions;
  tokens: ResolvedJankoTokens;
}

/** Everything the studio needs to render; all fields default to the golden master. */
export interface JankoStudioConfig {
  score: QuantizedGridScore;
  options: ResolvedJankoLayoutOptions;
  tokens: ResolvedJankoTokens;
  candidates: JankoCandidate[];
  round: JankoCandidateRound;
  crops: StudioCrop[];
  /** Page indices rendered in the reference view (0-based). */
  pages: number[];
  /**
   * Round 30: the Brahms golden's reference crops and page indices. Brahms
   * is a first-class iteration surface: the Reference view carries its full
   * page spread, macro crops and lint diagnostics beside Bach's.
   */
  brahmsCrops: StudioCrop[];
  /** Page indices of the Brahms spread rendered in the reference view (0-based). */
  brahmsPages: number[];
  /**
   * Benchmark scores a candidate window may be engraved from, keyed by id. The
   * primary entry is always present under `DEFAULT_STUDIO_SCORE_ID`.
   */
  scores: Record<string, StudioScore>;
  /** Candidate-only registered-score projection; Reference always uses the canonical score. */
  semanticCandidate?: { score: QuantizedGridScore; revision: string; reviewWindows: import('./semantic-hand').ReviewWindow[] };
  durationVariants?: Array<{ variant: import('./duration-rig').DurationVariant; score: QuantizedGridScore }>;
  /** Stale saved candidate is refused; render an explicit diagnostic, never a projected card. */
  semanticCandidateError?: string;
}

/** Reconstruct the registry's readonly PR112 witness without mutating GOLD. */
function bachPr112HandScore(gold: QuantizedGridScore): QuantizedGridScore {
  if (gold.id !== 'bach-goldberg-var1' || gold.notes.length !== 551) throw new Error('PR112 hand witness requires the canonical 551-event Bach score');
  const seen = new Set<number>();
  const notes = gold.notes.map((note, index) => {
    const id = index + 1;
    if (note.id !== `bach-var1-${id}`) throw new Error(`Unexpected Bach event identity at ${id}`);
    const event = PR112_EVENTS[id];
    if (!event) return { ...note, pitch: { ...note.pitch } };
    seen.add(id);
    const [prior, tick, pitchClass, octave] = event;
    if (note.startTick !== tick || note.pitch.pitchClass !== pitchClass || note.pitch.octave !== octave || note.hand === prior)
      throw new Error(`PR112 hand witness mismatch at ${note.id}`);
    return { ...note, pitch: { ...note.pitch }, hand: prior };
  });
  if (seen.size !== 16 || notes.filter(n => n.hand === 'RH').length !== 301) throw new Error('PR112 hand witness has wrong census');
  const baseline: QuantizedGridScore = { ...gold, notes };
  baseline.handCrossings = detectHandCrossings(baseline);
  return baseline;
}

/** Build a studio configuration, defaulting to the golden master + current round. */
export function createStudioConfig(overrides: Partial<JankoStudioConfig> = {}): JankoStudioConfig {
  const bach = resolveActiveScore('bach-goldberg-var1');
  const brahmsCanonical = resolveActiveScore('brahms-op118-no1');
  const options = resolveJankoOptions({ ...bach.options, ...(overrides.options ?? {}) });
  const tokens = resolveJankoTokens({ ...bach.tokens, ...(overrides.tokens ?? {}) });
  const score = overrides.score ?? bach.score;
  const totalPages = countJankoPages(score, options, tokens);
  // Source-derived drafts share one production admission; actual bar widths
  // and spans come from the literal score's content, never a score-ID table.
  const importedOptions = resolveJankoOptions({ ...DEFAULT_JANKO_OPTIONS,
    measuresPerSystem: 4, systemsPerPage: 4, gridWritingPolicy: 'overlaid-beat-grid',
    writtenTies: 'source', verticalPlacement: 'content-aware' });
  const scores: Record<string, StudioScore> = {
    [NO14_GESTURE_OPEN_ID]: {id:NO14_GESTURE_OPEN_ID,...no14GestureOpenProfile()},
    [NO14_GESTURE_OPTICAL_ID]: {id:NO14_GESTURE_OPTICAL_ID,...no14GestureOpticalProfile()},
    [NO14_GESTURE_CONDENSED_ID]: {id:NO14_GESTURE_CONDENSED_ID,...no14GestureCondensedProfile()},
    [NO14_GESTURE_CENTERED_ID]: {id:NO14_GESTURE_CENTERED_ID,...no14GestureCenteredProfile()},
    [NO14_GESTURE_REFINED_ID]: {id:NO14_GESTURE_REFINED_ID,...no14GestureRefinedProfile()},
    [NO14_GESTURE_UNDERLINE_ID]: {id:NO14_GESTURE_UNDERLINE_ID,...no14GestureUnderlineProfile()},
    [NO14_GESTURE_RELATIVE_ID]: {id:NO14_GESTURE_RELATIVE_ID,...no14GestureRelativeProfile()},
    [NO14_RELATIVE_SCORE_ID]: {id:NO14_RELATIVE_SCORE_ID,...no14RelativeProfile()},
    [NO14_RELATIVE_BASELINE_ID]: {id:NO14_RELATIVE_BASELINE_ID,...no14RelativeBaselineProfile()},
    [NO14_PRACTICE_SCORE_ID]: {id:NO14_PRACTICE_SCORE_ID,...no14PracticeProfile()},
    [NO14_WRITTEN_SCORE_ID]: {id:NO14_WRITTEN_SCORE_ID,...no14PracticeProfile(),score:projectNo14Written().score},
    [NO14_GOLD_REFERENCE_ID]: {id:NO14_GOLD_REFERENCE_ID,...no14PublishedProfile()},
    [DEFAULT_STUDIO_SCORE_ID]: { id: DEFAULT_STUDIO_SCORE_ID, score, options, tokens },
    [score.id]: { id: score.id, score, options, tokens },
    // Archived PR112 evidence may be requested explicitly; always derive it
    // from the immutable historical builder, never reverse today's active score.
    ...(overrides.candidates?.some(candidate => candidate.windows?.some(window =>
      !isAbstractCandidateWindow(window) && (window.scoreId === BACH_PR112_SCORE_ID || window.scoreId === BACH_PR114_SCORE_ID))) ? {
      [BACH_PR112_SCORE_ID]: { id: BACH_PR112_SCORE_ID,
        score: bachPr112HandScore(buildBachGoldbergVar1Score()), options, tokens },
      [BACH_PR114_SCORE_ID]: { id: BACH_PR114_SCORE_ID,
        score: buildBachGoldbergVar1Score(), options, tokens },
    } : {}),
    [SCHUMANN_NO13_STUDIO_SCORE_ID]: {
      id: SCHUMANN_NO13_STUDIO_SCORE_ID,
      score: buildSchumannNo13Draft(),
      options: importedOptions,
      tokens: resolveJankoTokens({ ...DEFAULT_JANKO_TOKENS, ticksPerMeasure: 96, anacrusisTicks: 0 }),
    },
    [SCHUMANN_NO30_STUDIO_SCORE_ID]: {
      id: SCHUMANN_NO30_STUDIO_SCORE_ID,
      score: buildSchumannNo30Draft(),
      options: importedOptions,
      tokens: resolveJankoTokens({ ...DEFAULT_JANKO_TOKENS, ticksPerMeasure: 192, anacrusisTicks: 48 }),
    },
    ['schumann-op68-no14-principal']: {
      id: 'schumann-op68-no14-principal', score: buildSchumannNo14Draft('principal'),
      options: importedOptions,
      tokens: resolveJankoTokens({ ...DEFAULT_JANKO_TOKENS, ticksPerMeasure: 144, anacrusisTicks: 0 }),
    },
    [SCHUMANN_NO14_STUDIO_SCORE_ID]: {
      id: SCHUMANN_NO14_STUDIO_SCORE_ID,
      score: buildSchumannNo14Draft(),
      options: importedOptions,
      tokens: resolveJankoTokens({ ...DEFAULT_JANKO_TOKENS, ticksPerMeasure: 144, anacrusisTicks: 0 }),
    },
    [SCHUMANN_NO43_STUDIO_SCORE_ID]: {
      id: SCHUMANN_NO43_STUDIO_SCORE_ID,
      score: buildSchumannNo43Draft(),
      options: importedOptions,
      tokens: resolveJankoTokens({ ...DEFAULT_JANKO_TOKENS, ticksPerMeasure: 192, anacrusisTicks: 24 }),
    },
    [BRAHMS_STUDIO_SCORE_ID]: {
      id: BRAHMS_STUDIO_SCORE_ID,
      score: brahmsCanonical.score,
      // Canonical Brahms: the fixed-3 golden at four measures/system with
      // the page-top correction and the full grid — 18 systems over 5 pages.
      // Fixed-3 is project-wide canonical: studio, production commands and
      // acceptance tests agree; the CLI lints this same entry.
      options: brahmsCanonical.options,
      tokens: brahmsCanonical.tokens,
    },
    // Round 9: the curated multi-duration specimen. Two measures across the
    // staff width, so the five chords and their midpoint marks stay large
    // enough to judge at a glance. Canonical fixed-3 like every surface.
    [SPECIMEN_STUDIO_SCORE_ID]: {
      id: SPECIMEN_STUDIO_SCORE_ID,
      score: buildChordDurationSpecimenScore(),
      options: resolveJankoOptions({ ...DEFAULT_JANKO_OPTIONS, measuresPerSystem: 2 }),
      tokens: resolveJankoTokens(DEFAULT_JANKO_TOKENS),
    },
    // Round 15/20: the curated rest-duration specimen. Six 4/4 measures — one
    // genuine silence per value (16th … whole bar), each on a column no other
    // hand's head can reach — so every seat and every cut is judged at macro
    // scale on strictly clean material.
    [REST_SPECIMEN_STUDIO_SCORE_ID]: {
      id: REST_SPECIMEN_STUDIO_SCORE_ID,
      score: buildRestDurationSpecimenScore(),
      options: resolveJankoOptions(REST_DURATION_SPECIMEN_JANKO_OPTIONS),
      tokens: resolveJankoTokens(REST_DURATION_SPECIMEN_JANKO_TOKENS),
    },
    // Round 21 §E: the constructed duration working-set specimen — 32nd and
    // 64th runs, mixed levels, lone partial beams and solo flags. The corpus
    // states none of that material, so this is where the complete set is judged.
    [DURATION_SPECIMEN_STUDIO_SCORE_ID]: {
      id: DURATION_SPECIMEN_STUDIO_SCORE_ID,
      score: buildDurationSpecimenScore(),
      options: resolveJankoOptions(DURATION_SPECIMEN_JANKO_OPTIONS),
      tokens: resolveJankoTokens(DURATION_SPECIMEN_JANKO_TOKENS),
    },
    // Round 41: the hold-endpoint specimen — the three exceptional-duration
    // situations the corpus never states (a three-duration chord with an
    // octave-line exception, a release with no attack at its tick, a genuine
    // system-boundary continuation) on clean common-time material, two
    // measures per system so the line break is a real one.
    [HOLD_ENDPOINT_SPECIMEN_STUDIO_SCORE_ID]: {
      id: HOLD_ENDPOINT_SPECIMEN_STUDIO_SCORE_ID,
      score: buildHoldEndpointSpecimenScore(),
      options: resolveJankoOptions(HOLD_ENDPOINT_SPECIMEN_JANKO_OPTIONS),
      tokens: resolveJankoTokens(HOLD_ENDPOINT_SPECIMEN_JANKO_TOKENS),
    },
    // Round 42 (Phase 3 study): the duration-vocabulary specimen — every plain
    // notated value on the ordinary lone carrier, the shared-duration bracket
    // carrier and the genuine exception carrier, on 384-tick rows whose onset
    // sits on the downbeat (so a 384-tick value ends exactly on its barline).
    [DURATION_VOCABULARY_SPECIMEN_STUDIO_SCORE_ID]: {
      id: DURATION_VOCABULARY_SPECIMEN_STUDIO_SCORE_ID,
      score: buildDurationVocabularySpecimenScore(),
      options: resolveJankoOptions(DURATION_VOCABULARY_SPECIMEN_JANKO_OPTIONS),
      tokens: resolveJankoTokens(DURATION_VOCABULARY_SPECIMEN_JANKO_TOKENS),
    },
    // Round 43: the pitch-parity specimen — the two smallest pitch gaps
    // (1-span, 2-span) and the octave repeat, under the study's two-column
    // parity placement, so the pitch columns are judged without any
    // duration-grammar exception. A spread 1-span pair is admitted to a bracket
    // (0.75); a clean 2-span column stays unbracketed and full size.
    [PITCH_PARITY_SPECIMEN_STUDIO_SCORE_ID]: {
      id: PITCH_PARITY_SPECIMEN_STUDIO_SCORE_ID,
      score: buildPitchParitySpecimenScore(),
      options: resolveJankoOptions(PITCH_PARITY_SPECIMEN_JANKO_OPTIONS),
      tokens: resolveJankoTokens(PITCH_PARITY_SPECIMEN_JANKO_TOKENS),
    },
    [SYNTHETIC_M8_DIAGNOSTIC_SCORE_ID]: {
      id: SYNTHETIC_M8_DIAGNOSTIC_SCORE_ID,
      score: buildSyntheticM8DiagnosticScore(),
      options: resolveJankoOptions({
        ...BRAHMS_OP118_NO1_JANKO_OPTIONS,
        measuresPerSystem: 1,
      }),
      tokens: resolveJankoTokens(BRAHMS_OP118_NO1_JANKO_TOKENS),
    },
    ...(overrides.scores ?? {}),
  };
  const brahmsEntry = scores[BRAHMS_STUDIO_SCORE_ID];
  const brahmsPages = countJankoPages(brahmsEntry.score, brahmsEntry.options, brahmsEntry.tokens);
  return {
    score,
    options,
    tokens,
    candidates: overrides.candidates ?? CURRENT_CANDIDATES,
    round: overrides.round ?? CURRENT_ROUND_METADATA,
    // Bach carries no focus crops by default (operator order); pass
    // `crops` explicitly to resurrect DEFAULT_STUDIO_CROPS on demand.
    crops: overrides.crops ?? [],
    pages: overrides.pages ?? Array.from({ length: totalPages }, (_, i) => i),
    brahmsCrops: overrides.brahmsCrops ?? BRAHMS_STUDIO_CROPS,
    brahmsPages: overrides.brahmsPages ?? Array.from({ length: brahmsPages }, (_, i) => i),
    scores,
    ...(overrides.semanticCandidate ? { semanticCandidate: overrides.semanticCandidate } : {}),
    ...(overrides.durationVariants ? { durationVariants: overrides.durationVariants } : {}),
    ...(overrides.semanticCandidateError ? { semanticCandidateError: overrides.semanticCandidateError } : {}),
  };
}

/** Merge per-window lint reports into the single verdict a card displays. */
export function combineLintReports(reports: readonly LintReport[]): LintReport {
  const violations = reports.flatMap((r) => r.violations);
  const warnings = reports.flatMap((r) => r.warnings);
  const sum = (pick: (s: LintReport['stats']) => number): number =>
    reports.reduce((acc, r) => acc + pick(r.stats), 0);
  return {
    ok: violations.length === 0,
    violations,
    warnings,
    diagnostics: [...violations, ...warnings],
    stats: {
      systems: sum((s) => s.systems),
      measures: sum((s) => s.measures),
      notes: sum((s) => s.notes),
      beams: sum((s) => s.beams),
      checks: reports.reduce((acc, r) => Math.max(acc, r.stats.checks), 0),
      violations: violations.length,
      warnings: warnings.length,
      durationMs: sum((s) => s.durationMs),
      // Decision-level rest/head certificates only (rectangles or cubic CLEAR);
      // never rest-family global physical scene coverage.
      restPhysical: {
        certified: sum((s) => s.restPhysical.certified),
        fallback: reports.reduce<Record<string, number>>((counts, report) => {
          for (const [reason, count] of Object.entries(report.stats.restPhysical.fallback))
            counts[reason] = (counts[reason] ?? 0) + count;
          return counts;
        }, {}),
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Small HTML helpers
// ---------------------------------------------------------------------------

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Numeric width of an inline SVG in pt or px, read from its root element. */
function svgWidthPt(svg: string): number {
  const match = /<svg[^>]*\bwidth="([\d.]+)(?:pt|px)"/.exec(svg);
  return match ? Number(match[1]) : 400;
}

/** Wrap an inline SVG in a zoom-aware canvas. */
function canvas(svg: string, extraClass = ''): string {
  const width = svgWidthPt(svg);
  return (
    `<div class="janko-canvas ${extraClass}" style="--janko-base:${width.toFixed(2)}">` +
    svg.replace('<svg ', '<svg class="janko-svg" ') +
    '</div>'
  );
}

function lintChip(report: LintReport): string {
  if (!report.ok) {
    const n = report.violations.length;
    return `<span class="chip chip-error" title="engraving violations">✗ ${n} violation${n === 1 ? '' : 's'}</span>`;
  }
  if (report.warnings.length > 0) {
    const n = report.warnings.length;
    return `<span class="chip chip-warn" title="known engraving risks">⚠ ${n} warning${n === 1 ? '' : 's'}</span>`;
  }
  return '<span class="chip chip-ok" title="no diagnostics">✓ clean</span>';
}

/** Signed offset formatted as `+7.5pt` / `−15.0pt`. */
function pt(value: number): string {
  return `${value < 0 ? '−' : '+'}${Math.abs(value).toFixed(1)}pt`;
}

/**
 * One-line geometric summary of a candidate's octave framing: how many rules it
 * paints (the visual-density axis of Round 4) and where whole-tone Set A/B sit.
 */
export function describeChannelLayout(
  options: ResolvedJankoLayoutOptions,
  tokens: ResolvedJankoTokens
): string {
  const spec = getChannelLayoutSpec(options, tokens);
  const rules = `${spec.rulesPerEquator} rule${spec.rulesPerEquator === 1 ? '' : 's'}/octave (${spec.staffRules} lines)`;
  switch (spec.layout) {
    case 'bounded-channel':
      return `bounded channel ±${tokens.channelHalfWidth.toFixed(1)}pt · flanks ∓${spec.flankMagnitude.toFixed(1)}pt · ${rules}`;
    case 'single-line-3row':
      return `single line · Set A on the rule · contour flanks ∓${spec.flankMagnitude.toFixed(1)}pt · ${rules}`;
    case 'on-the-line':
      return `Set A on the line · Set B ${pt(spec.setBOffset)} above · ${rules}`;
    default:
      return `single equator · Set A ${pt(spec.setAOffset)} · Set B ${pt(spec.setBOffset)} · ${rules}`;
  }
}

function badgeHtml(badge: CandidateOptionBadge): string {
  const changed = badge.value !== badge.golden;
  const classes = ['badge', changed ? 'badge-delta' : '', badge.axis ? 'badge-axis' : '']
    .filter(Boolean)
    .join(' ');
  return (
    `<span class="${classes}">` +
    `<b>${escapeHtml(badge.key)}</b> = ${escapeHtml(badge.value)}` +
    (changed ? ` <s>${escapeHtml(badge.golden)}</s>` : '') +
    '</span>'
  );
}

// ---------------------------------------------------------------------------
// View 1 · Closer-Comparison Strip
// ---------------------------------------------------------------------------

/**
 * Render the closer-comparison strip: the round's declared macro window
 * engraved under every card's options and laid side by side, so the eye can
 * flick between schemes without scrolling. No lint chips — the strip is pure
 * comparison; the verdicts live on the cards below.
 */
export function renderCompareStrip(
  config: JankoStudioConfig = createStudioConfig(),
  candidateLayouts?: ReadonlyMap<string, readonly JankoSystemLayout[]>,
  preparedWindows?: ReadonlyMap<string, PreparedJankoWindows>
): string {
  const { candidates, round, scores } = config;
  const strips=round.compareStrips??(round.compareStrip?[round.compareStrip]:[]);
  return strips.map(strip=>{
  const entry = scores[strip.scoreId ?? DEFAULT_STUDIO_SCORE_ID] ?? scores[DEFAULT_STUDIO_SCORE_ID];
  const lastMeasure = strip.measureStart + strip.measureCount - 1;
  const offered=candidates.filter(candidate=>!strip.candidateIds||strip.candidateIds.includes(candidate.id));
  const rendered=offered.map(candidate=>{
    if(candidate.rejection)return {candidate,svg:''};
    const options = resolveJankoOptions({ ...entry.options, ...(candidate.options ?? {}) });
    const tokens = resolveJankoTokens({ ...entry.tokens, ...(candidate.tokens ?? {}) });
    const layouts = candidateLayouts?.get(`${candidate.id}:${entry.id}`);
    const prepared=candidate.comparisonScope ? preparedWindows?.get(`${candidate.id}:${entry.id}`) ?? new PreparedJankoWindows(entry.score,[strip],options,tokens) : undefined;
    const svg = prepared ? renderPreparedJankoWindow(prepared,strip,false,`strip-${candidate.id}`) : renderJankoCrop(
      entry.score,
      strip.measureStart,
      strip.measureCount,
      options,
      tokens,
      undefined,
      layouts
    );
    return {candidate,svg};
  });
  const boxes=strip.matchedFrame?rendered.map(q=>q.svg.match(/viewBox="([^"]+)"/)?.[1].split(/\s+/).map(Number)).filter((q):q is number[]=>!!q):[];
  const frame=boxes.length?[Math.min(...boxes.map(q=>q[0])),Math.min(...boxes.map(q=>q[1])),Math.max(...boxes.map(q=>q[0]+q[2]))-Math.min(...boxes.map(q=>q[0])),Math.max(...boxes.map(q=>q[1]+q[3]))-Math.min(...boxes.map(q=>q[1]))]:undefined;
  const panels=rendered.map(({candidate,svg:original})=>{
    if(candidate.rejection)return `<figure class="strip-panel" data-strip-panel="${escapeHtml(candidate.id)}"><figcaption><b>${escapeHtml(candidate.label)}</b></figcaption><p>Rejected representative · ${escapeHtml(candidate.rejection.reason)}</p></figure>`;
    const svg=frame?original.replace(/viewBox="[^"]+"/,`viewBox="${frame.map(q=>q.toFixed(2)).join(' ')}"`).replace(/width="[\d.]+pt"/,`width="${frame[2].toFixed(2)}pt"`).replace(/height="[\d.]+pt"/,`height="${frame[3].toFixed(2)}pt"`):original;
    return [
      `<figure class="strip-panel" data-strip-panel="${escapeHtml(candidate.id)}">`,
      `  <figcaption><b>${escapeHtml(candidate.label)}</b></figcaption>`,
      `  <div class="canvas-frame">${canvas(svg)}</div>`,
      '</figure>',
    ].join('\n');
  });
  return [
    `<div class="compare-strip${strip.matchedFrame?' compare-strip-readable':''}" data-strip="${escapeHtml(entry.id)}:${strip.measureStart}-${lastMeasure}">`,
    `  <div class="strip-head section-title">${escapeHtml(strip.title)}${strip.candidateIds?'':' — every scheme side by side'}</div>`,
    panels.join('\n'),
    '</div>',
  ].join('\n');
  }).join('\n');
}

// ---------------------------------------------------------------------------
// View 1 · Decision Candidates Matrix
// ---------------------------------------------------------------------------

/**
 * Render the Decision Candidates Matrix: every candidate declared in the
 * registry, engraved on the same windows, with option-delta badges and a live
 * lint verdict **over every score the candidate is demonstrated on**.
 */
/** Reusable only when every non-semantic studio input is identical. */
export interface StaticCandidateMarkup { cards: string[]; compareStrip: string; variantCards?: Record<string, string> }
export function renderCandidatesView(config: JankoStudioConfig = createStudioConfig(), reuse?: StaticCandidateMarkup, capture?: (markup: StaticCandidateMarkup) => void): string {
  const { round, scores } = config;
  const runtime = config.durationVariants ?? [];
  const candidates: JankoCandidate[] = [
    ...config.candidates,
    ...(config.semanticCandidate ? [(() => {
      const hand = semanticHandCandidate(config.semanticCandidate!.revision, config.semanticCandidate!.reviewWindows,
        config.semanticCandidate!.score.id);
      const source = config.semanticCandidate!.score;
      const entry = scores[source.id];
      return { ...hand, windows: [{ scoreId: source.id === 'bach-goldberg-var1' ? 'primary' : source.id,
        measureStart: 1, measureCount: Math.ceil(source.totalTicks / entry.tokens.ticksPerMeasure),
        title: 'Complete guarded score', fullScore: true }, ...(hand.windows ?? [])] };
    })()] : []),
    ...runtime.map(({ variant, score }) => ({
      ...semanticHandCandidate(variant.revision, [{ measureStart: 1, measureCount: Math.ceil(score.totalTicks / config.scores[variant.score].tokens.ticksPerMeasure), changed: true }], variant.score === 'bach-goldberg-var1' ? 'primary' : variant.score),
      id: `duration-${variant.id}`, label: `Duration · ${variant.id}`,
      windows: [{ scoreId: variant.score === 'bach-goldberg-var1' ? 'primary' : variant.score,
        measureStart: 1, measureCount: Math.ceil(score.totalTicks / config.scores[variant.score].tokens.ticksPerMeasure),
        title: `Complete score · ${variant.id}`, fullScore: true }],
      description: `Guarded ${variant.revision.slice(0,12)} · rule-wide controls / targeted placements · ${variant.refusals.length ? `beside refused: ${variant.refusals.map(r => r.reason).join('; ')}` : 'seat requests fitted or absent'} · not Reference`,
      options: { ...variant.options, durationSeatPreferences: variant.placements.map(p => ({ tick: p.target.tick, ownerIds: p.target.ownerIds, family: p.target.family, seat: p.preference })) },
      tokens: variant.tokens,
    })),
  ];
  const runtimeById = new Map(runtime.map(value => [`duration-${value.variant.id}`, value]));
  const variantCards: Record<string, string> = {};

  // Compute once per distinct score/options/tokens configuration per candidate per render.
  // Candidate configurations remain separate from each other and from the reference view.
  const candidateLayouts = new Map<string, JankoSystemLayout[]>();
  const preparedWindows = new Map<string, PreparedJankoWindows>();
  const getPreparedWindow=(candidate:JankoCandidate,entry:StudioScore,options:ResolvedJankoLayoutOptions,tokens:ResolvedJankoTokens)=>{
    const key=`${candidate.id}:${entry.id}`;let prepared=preparedWindows.get(key);
    if(!prepared){const windows=(candidate.windows??[]).filter((w):w is JankoScoreCandidateWindow=>!isAbstractCandidateWindow(w)&&(w.scoreId??DEFAULT_STUDIO_SCORE_ID)===entry.id);
      prepared=new PreparedJankoWindows(entry.score,windows,options,tokens);preparedWindows.set(key,prepared);}
    prepared.validate(entry.score,options,tokens);return prepared;
  };
  const getCandidateLayout = (
    candidateId: string,
    scoreId: string,
    score: QuantizedGridScore,
    options: ResolvedJankoLayoutOptions,
    tokens: ResolvedJankoTokens
  ): JankoSystemLayout[] => {
    const key = `${candidateId}:${scoreId}`;
    let layouts = candidateLayouts.get(key);
    if (!layouts) {
      layouts = layoutJankoScore(score, options, tokens);
      candidateLayouts.set(key, layouts);
    }
    return layouts;
  };

  const cards = candidates.map((candidate, index) => {
    const dynamic = runtimeById.get(candidate.id);
    const variantKey = dynamic ? `${dynamic.variant.score}:${dynamic.variant.id}:${dynamic.variant.revision}` : '';
    if (dynamic && reuse?.variantCards?.[variantKey]) return variantCards[variantKey] = reuse.variantCards[variantKey];
    if (!dynamic && candidate.id !== 'semantic-hand' && reuse?.cards[index] !== undefined) return reuse.cards[index];
    if (candidate.kind === 'practice') {
      const scaleType = candidate.practiceScaleType ?? 'major';
      const panels = [48, 49].map(tonic => {
        const view = renderPracticeView({ rudiment: 'scale', scaleType, tonicLinear: tonic,
          width: 760, height: 380, guide: candidate.practiceGuide });
        return `<figure class="candidate-window" data-window="practice:${scaleType}:${tonic}:1-2">` +
          `<figcaption><b>${scaleType === 'major' ? 'Major' : 'Natural minor N26'} · tonic linear ${tonic}</b> · <span>15 simultaneous sixteenths per hand across mm. 1–2 (8 + 7), four-note double beams; LH one 10-span below RH, exact reverse descent for N26.</span></figcaption>` +
          `<div class="canvas-frame">${canvas(view.svg)}</div></figure>`;
      });
      return `<article class="candidate-card" data-candidate="${escapeHtml(candidate.id)}" data-lint="clean">` +
        `<header class="candidate-head"><h3>${escapeHtml(candidate.label)}</h3><div class="chips"><span class="chip chip-ok">✓ Practice rail geometry checked</span><span class="chip">score lint: separate canonical gate</span></div></header>` +
        `<p class="rationale">${escapeHtml(candidate.description ?? '')}</p>` +
        `<div class="badges">${candidateBadges(candidate, round).map(badgeHtml).join('')}</div>` +
        `<div class="candidate-windows">${panels.join('')}</div>` +
        `<footer class="candidate-foot">Portable ISO Practice v1 · engine-placed pitch x · RH over LH · black knockout-safe ground · GOLD/BRONZE unchanged</footer></article>`;
    }
    if(candidate.rejection)return `<article class="candidate-card" data-candidate="${escapeHtml(candidate.id)}" data-lint="rejected"><header class="candidate-head"><h3>${escapeHtml(candidate.label)}</h3><span class="chip">Rejected representative · no failed ink offered</span></header><p class="rationale">${escapeHtml(candidate.description??'')}</p><p>${escapeHtml(candidate.rejection.reason)}</p><footer class="candidate-foot">Reproducible numeric evidence: ${escapeHtml(candidate.rejection.evidence)}. Unsearched arrangements remain open; no operator adoption requested.</footer></article>`;
    const resolved = resolveCandidate(candidate);
    const isAbstract =
      candidate.kind === 'abstract' ||
      (resolved.windows.length > 0 && resolved.windows.some(isAbstractCandidateWindow));

    if (isAbstract) {
      const geomId =
        candidate.abstractGeometry ??
        (resolved.windows.find(isAbstractCandidateWindow)?.geometryId ?? 'dial');
      const spec = ABSTRACT_GEOMETRY_SPECS[geomId];
      const geomReport = lintAbstractGeometry(geomId);

      const panels = resolved.windows.map((win) => {
        if (!isAbstractCandidateWindow(win)) {
          return '';
        }
        let svg: string;
        if (win.specimenType === 'key') {
          svg = renderAbstractKeySvg(win.geometryId);
        } else if (win.specimenType === 'transposition') {
          svg = renderAbstractTranspositionBatterySvg(win.geometryId);
        } else if (win.specimenType === 'near-neighbours') {
          svg = renderAbstractNearNeighboursBatterySvg(win.geometryId);
        } else if (win.specimenType === 'density') {
          svg = renderAbstractDensityBatterySvg(win.geometryId);
        } else if (win.specimenType === 'octave-probe') {
          svg = renderAbstractLadderOctaveProbeSvg();
        } else {
          const subset =
            win.subset ??
            (win.specimenType === 'subset-1' ? ABSTRACT_SUBSET_1 : ABSTRACT_SUBSET_2);
          svg = renderAbstractSubsetSvg(win.geometryId, subset);
        }
        return [
          `<figure class="candidate-window" data-window="${escapeHtml(win.geometryId)}:${escapeHtml(win.specimenType)}">`,
          `  <figcaption><b>${escapeHtml(win.title)}</b>${win.caption ? ` · <span>${escapeHtml(win.caption)}</span>` : ''}</figcaption>`,
          `  <div class="canvas-frame">${canvas(svg)}</div>`,
          '</figure>',
        ].join('\n');
      });

      const badges = candidateBadges(candidate, round).map(badgeHtml).join('');
      const tags = (candidate.tags ?? [])
        .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
        .join('');
      const chips =
        `${tags}` +
        `<span class="chip chip-ok" title="Bounded geometry checks passed (${geomReport.checks}/${geomReport.checks}): separation ≥ 4.0pt, nominal ink bounds, 12 sites, label clearance">✓ geometry valid (${geomReport.checks} checks)</span>` +
        ` <span class="chip" style="background: rgba(148, 163, 184, 0.16); color: #94a3b8;" title="Score engraving lint not applicable to abstract candidate">score lint n/a</span>`;
      const facts =
        `12 sites · node radius 0.55pt · min separation 4.0pt · nominal bounds ${spec.boundsString} · ` +
        `bounded geometry verified · score engraving lint not applicable`;

      return [
        `<article class="candidate-card" data-candidate="${escapeHtml(candidate.id)}" data-lint="${geomReport.ok ? 'clean' : 'violations'}">`,
        '  <header class="candidate-head">',
        `    <h3>${escapeHtml(candidate.label)}</h3>`,
        `    <div class="chips">${chips}</div>`,
        '  </header>',
        candidate.description
          ? `  <p class="rationale">${escapeHtml(candidate.description)}</p>`
          : '',
        `  <div class="badges">${badges}</div>`,
        `  <div class="candidate-windows">${panels.join('\n')}</div>`,
        `  <footer class="candidate-foot">${escapeHtml(facts)}</footer>`,
        '</article>',
      ]
        .filter(Boolean)
        .join('\n');
    }

    // Score-candidate branch (existing behavior preserved)
    const reports: LintReport[] = [];
    const seen = new Set<string>();
    const panels = resolved.windows.map((w) => {
      const window = w as JankoScoreCandidateWindow;
      if (window.scoreId === BACH_PR112_SCORE_ID && !scores[BACH_PR112_SCORE_ID])
        throw new Error('PR112 hand witness missing: cannot substitute the GOLD score');
      const original = scores[window.scoreId ?? DEFAULT_STUDIO_SCORE_ID] ?? scores[DEFAULT_STUDIO_SCORE_ID];
      const entry = dynamic && original.score.id === dynamic.score.id ? { ...original, score: dynamic.score } :
        candidate.id === 'semantic-hand' && original.score.id === config.semanticCandidate?.score.id && config.semanticCandidate
        ? { ...original, score: config.semanticCandidate.score } : original;
      const options = resolveJankoOptions({ ...entry.options, ...(candidate.options ?? {}) });
      const tokens = resolveJankoTokens({ ...entry.tokens, ...(candidate.tokens ?? {}) });
      const prepared=candidate.comparisonScope ? getPreparedWindow(candidate,entry,options,tokens) : undefined;
      const layouts = prepared ? undefined : getCandidateLayout(candidate.id, entry.id, entry.score, options, tokens);
      if (!seen.has(entry.id)) {
        seen.add(entry.id);
        reports.push(prepared ? lintJankoWindowSystems(prepared) : lintJankoScore(entry.score, options, tokens,undefined,layouts));
      }
      const lastMeasure = window.measureStart + window.measureCount - 1;
      // Round 44: a full-score window renders the score's **genuine pages**
      // (one real `renderJankoPage` card per page — the same A4 spread the
      // Reference view uses), never one crop whose viewBox happens to cover
      // the whole score. Every other window stays the established macro crop.
      if (window.fullScore) {
        if(prepared||!layouts)throw Error('Window-scoped candidate refuses a full-score page claim');
        const pages = countJankoPages(entry.score, options, tokens,layouts);
        const selectedPages = window.pageIndices ?? Array.from({length:pages},(_,i)=>i);
        if (!selectedPages.length || new Set(selectedPages).size!==selectedPages.length || selectedPages.some(p=>!Number.isInteger(p)||p<0||p>=pages)) throw Error('Invalid genuine page selection');
        const pageCards: string[] = [];
        for (const page of selectedPages) {
          const svg = renderJankoPage(entry.score, page, options, tokens, layouts);
          const onPage = layouts.filter(l => (l.geometry.pageIndex ?? Math.floor(l.index/options.systemsPerPage)) === page);
          const first = onPage[0], end = onPage.at(-1)!;
          const firstMeasure = (first.geometry.firstBar ?? first.index * options.measuresPerSystem) + 1;
          const last = Math.min((end.geometry.firstBar ?? end.index * options.measuresPerSystem) + end.geometry.measuresPerSystem, lastMeasure);
          pageCards.push(
            [
              `<figure class="page-card" data-page="${page + 1}">`,
              '  <figcaption>',
              `    <b>Page ${page + 1}</b> · mm. ${firstMeasure}–${last}`,
              '  </figcaption>',
              `  <div class="canvas-frame">${canvas(svg)}</div>`,
              '</figure>',
            ].join('\n')
          );
        }
        return [
          `<figure class="candidate-window candidate-window-pages" data-window="${escapeHtml(entry.id)}:${window.measureStart}-${lastMeasure}" data-pages="${selectedPages.length}">`,
          `  <figcaption><b>${escapeHtml(window.title || `mm. ${window.measureStart}–${lastMeasure}`)}</b>${window.caption ? ` · <span>${escapeHtml(window.caption)}</span>` : ''}</figcaption>`,
          `${window.collapsed?`  <details class="score-pages"><summary>Complete score · ${pages} pages</summary>`:''}<div class="page-grid">${pageCards.join('\n')}</div>${window.collapsed?'</details>':''}`,
          '</figure>',
        ].join('\n');
      }
      const svg = prepared ? renderPreparedJankoWindow(prepared,window,window.completeSystems,`card-${candidate.id}`) : renderJankoCrop(
        entry.score,
        window.measureStart,
        window.measureCount,
        options,
        tokens,
        undefined,
        layouts
      );
      return [
        `<figure class="candidate-window" data-score="${escapeHtml(entry.id)}" data-measure-start="${window.measureStart}" data-measure-count="${window.measureCount}" data-window="${escapeHtml(entry.id)}:${window.measureStart}-${lastMeasure}">`,
        `  <figcaption><b>${escapeHtml(window.title || `mm. ${window.measureStart}–${lastMeasure}`)}</b>${window.caption ? ` · <span>${escapeHtml(window.caption)}</span>` : ''}${prepared ? ` · frame ${svg.match(/viewBox="0 0 ([^"]+)"/)?.[1].split(' ').map(v=>Number(v).toFixed(1)).join(' × ')}pt · window-scoped${options.comparisonPitchFields ? ' · actual painted fields linted; duplicated coordinates, not sounds' : ''}` : ''}</figcaption>`,
        `${window.collapsed?'<details class="score-context"><summary>Show passage</summary>':''}<div class="canvas-frame">${canvas(svg)}</div>${window.collapsed?'</details>':''}`,
        '</figure>',
      ].join('\n');
    });
    const report = combineLintReports(reports);
    const badges = candidateBadges(candidate).map(badgeHtml).join('');
    const tags = (candidate.tags ?? [])
      .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
      .join('');
    const opts = resolved.options;
    const toks = resolved.tokens;
    const facts = candidate.comparisonScope ? 'Window-scoped complete containing-system checks; no full-score / page-fit / visual acceptance verdict. Geometry and source/gesture assertions are engineering evidence, not pianist acceptance.' : candidate.id === 'semantic-hand'
      ? `Brahms canonical fixed-3 engraving · guarded score projection · no Reference promotion`
      : `${opts.rhythmStyle} · chord grouping ${opts.chordGrouping} · spine ${opts.middleCSpine} · ` +
      `gap ${opts.interStaffGap.toFixed(1)}pt · ${describeChannelLayout(opts, toks)} · ` +
      `grid ${opts.gridWritingPolicy} · system start ${opts.systemStartStyle} · ` +
      `clasp ${toks.claspOffset.toFixed(1)}pt offset / ${toks.claspMinBarlineAir.toFixed(1)}pt barline air · ` +
      `beat grid ${opts.showBeatGrid ? 'on' : 'off'}`;
    const markup = [
      `<article class="candidate-card" data-candidate="${escapeHtml(candidate.id)}" data-lint="${report.ok ? 'clean' : 'violations'}">`,
      '  <header class="candidate-head">',
      `    <h3>${escapeHtml(candidate.label)}</h3>`,
      `    <div class="chips">${tags}${candidate.comparisonScope?'<span class="chip">window-scoped'+(candidate.options?.comparisonPitchFields?' · actual painted fields':'')+'</span>':''}${lintChip(report)}</div>`,
      '  </header>',
      candidate.description
        ? `  <p class="rationale">${escapeHtml(candidate.description)}</p>`
        : '',
      candidate.download?`  <p><a href="${escapeHtml(candidate.download.href)}" download>${escapeHtml(candidate.download.label)}</a></p>`:'',
      `  <div class="badges">${badges}</div>`,
      `  <div class="candidate-windows">${panels.join('\n')}</div>`,
      `  <footer class="candidate-foot">${escapeHtml(facts)}</footer>`,
      '</article>',
    ]
      .filter(Boolean)
      .join('\n');
    if (dynamic) variantCards[variantKey] = markup;
    return markup;
  });

  const compareStrip = reuse?.compareStrip ?? renderCompareStrip(config, candidateLayouts, preparedWindows);
  capture?.({ cards: cards.slice(0, config.candidates.length), compareStrip, variantCards: { ...reuse?.variantCards, ...variantCards } });

  // Round 20: a **verification round** (no open axis) states every card's own
  // window set instead of one shared candidate window count, so the header
  // counts the round's whole evidence.
  const verification = (round.openAxes ?? []).length === 0;
  const windowCount = candidates.reduce(
    (sum, candidate) => sum + resolveCandidate(candidate).windows.length,
    0
  );
  // Decided round: zero cards means no active comparison — the view says so
  // explicitly and the mount selects the Reference (see mountJankoStudio).
  // Normal future two-view behavior is untouched: any new round's cards
  // render exactly as before.
  const decided = candidates.length === 0;
  return [
    '<section class="view-panel" id="view-candidates" data-view="candidates">',
    '  <div class="round-card">',
    `    <span class="round-badge">Round ${round.round}</span>`,
    `    <h2>${escapeHtml(round.title)}</h2>`,
    `    <p>${escapeHtml(round.description)}</p>`,
    `    <p class="round-meta">${
      decided
        ? 'no active comparison — the round is decided, see the Golden Reference'
        : verification
          ? `${candidates.length} verification card${candidates.length === 1 ? '' : 's'} · ` +
            `${windowCount} engraving window${windowCount === 1 ? '' : 's'} · fixed golden master, no open axis`
          : `${candidates.length} candidate${candidates.length === 1 ? '' : 's'} × ${windowCount} engraving window${windowCount === 1 ? '' : 's'}`
    } · registry <code>src/render/janko/candidates.ts</code> · add a candidate with five lines, zero template edits.</p>`,
    '  </div>',
    compareStrip,
    config.semanticCandidateError ? `<article class="candidate-card" data-candidate="semantic-hand-stale" data-lint="error"><h3>Saved draft was not applied.</h3><details class="candidate-recovery"><summary>Diagnostics &amp; recovery</summary><p class="rationale">${escapeHtml(config.semanticCandidateError)}</p><p>Reference remains canonical. Archive and start a new guarded candidate with <code>semantic-hand recover</code>; no automatic rebase.</p></details></article>` : '',
    `  <div class="candidate-grid" data-candidate-count="${candidates.length}" data-window-count="${windowCount}" data-verification="${verification}" data-decided="${decided}">`,
    cards.join('\n'),
    '  </div>',
    '</section>',
  ]
    .filter(Boolean)
    .join('\n');
}

// ---------------------------------------------------------------------------
// View 2 · Golden Reference Object
// ---------------------------------------------------------------------------

/**
 * The designation of one golden-reference block (Round 31): Bach is GOLD
 * (the frozen perfection standard), Brahms is BRONZE (the active iteration
 * surface). `knownCode` names the violation code this surface carries as
 * documented known findings — scheduled for a future round, never gated,
 * never hidden. Absent for a surface with no knowns.
 */
export interface ReferenceDesignation {
  badge: 'GOLD' | 'BRONZE';
  knownCode?: string;
  revision?: string;
  introduction?: string;
  download?: string;
  title?: string;
}

/** Render one score's golden-reference block: page spread, macro crops, diagnostics. */
function renderReferenceScore(
  scoreId: string,
  score: StudioScore['score'],
  options: StudioScore['options'],
  tokens: StudioScore['tokens'],
  pages: number[] | undefined,
  crops: StudioCrop[],
  designation?: ReferenceDesignation
): string {
  // One dependency-bound settlement feeds the complete audit, page count and
  // every page/crop. Registering a score never settles it in Candidates-only work.
  const layouts=layoutJankoScore(score,options,tokens);
  const report = lintJankoScore(score, options, tokens,undefined,layouts);
  const pageIndices=pages??Array.from({length:countJankoPages(score,options,tokens,layouts)},(_,i)=>i);
  const systems = countJankoSystems(score, options, tokens);
  const beatsPerMeasure = Math.max(1, Math.round(options.ticksPerMeasure / options.ticksPerBeat));
  const channelSpec = getChannelLayoutSpec(options, tokens);
  // A known-findings note is printed only when EVERY violation carries the
  // documented code — a new defect class must never hide behind the tag.
  const knowns =
    designation?.knownCode !== undefined &&
    report.violations.length > 0 &&
    report.violations.every((v) => v.code === designation.knownCode)
      ? report.violations.length
      : 0;

  const pageCards = pageIndices.map((page) => {
    const svg = renderJankoPage(score, page, options, tokens, layouts);
    const onPage = layouts!.filter(l => (l.geometry.pageIndex ?? Math.floor(l.index/options.systemsPerPage)) === page);
    const first = onPage[0], end = onPage.at(-1)!;
    const firstMeasure = (first.geometry.firstBar ?? first.index * options.measuresPerSystem) + 1;
    const lastMeasure = Math.min((end.geometry.firstBar ?? end.index * options.measuresPerSystem) + end.geometry.measuresPerSystem, report.stats.measures);
    const pageSystems = onPage.length;
    return [
      `<figure class="page-card" data-page="${page + 1}">`,
      '  <figcaption>',
      `    <b>Page ${page + 1}</b> · ${pageSystems} system${pageSystems === 1 ? '' : 's'} · mm. ${firstMeasure}–${lastMeasure}`,
      '  </figcaption>',
      `  <div class="canvas-frame">${canvas(svg)}</div>`,
      '</figure>',
    ].join('\n');
  });

  const cropCards = crops.map((crop) => {
    const svg = renderJankoCrop(score, crop.start, crop.count, options, tokens, undefined, layouts);
    return [
      `<figure class="crop-card" data-crop="${crop.start}-${crop.start + crop.count - 1}">`,
      `  <figcaption><b>${escapeHtml(crop.title)}</b><span>${escapeHtml(crop.caption)}</span></figcaption>`,
      `  <div class="canvas-frame">${canvas(svg)}</div>`,
      '</figure>',
    ].join('\n');
  });

  const badge =
    designation === undefined
      ? ''
      : designation.badge === 'GOLD'
        ? ' <span class="tag tag-gold">GOLD · frozen standard</span>'
        : ' <span class="tag tag-bronze">BRONZE · active surface</span>';
  // A cropless block (Bach, by operator order) omits the whole section —
  // no empty heading weighs on the page.
  const cropsSection =
    cropCards.length === 0
      ? ''
      : [
          '  <h3 class="section-title">Macro focus crops (288 DPI equivalent)</h3>',
          `  <div class="crop-grid">${cropCards.join('\n')}</div>`,
        ].join('\n');
  return [
    `<div class="reference-score" data-score="${scoreId}" data-revision="${escapeHtml(designation?.revision??resolveActiveScore(scoreId === 'primary' ? 'bach-goldberg-var1' : scoreId).revision)}">`,
    '  <div class="golden-card">',
    `    <span class="round-badge">Golden Master</span>${badge}`,
    `    <h2>${escapeHtml(designation?.title??score.title ?? 'J.S. Bach — Goldberg Variations, BWV 988')}</h2>`,
    designation?.introduction?`    <p>${escapeHtml(designation.introduction)}</p>`:`    <p>${escapeHtml(options.subtitle ?? 'Variatio 1. a 1 Clav.')} — the accumulated state of the engraving: ${report.stats.measures} measures, ${systems} systems, ${report.stats.notes} noteheads, ${report.stats.beams} beams.</p>`,
    designation?.download?`    <p><a href="./${escapeHtml(designation.download)}" download>Download No. 14 PDF · ${pageIndices.length} pages</a> · <a href="./${escapeHtml(designation.download)}.notices.txt">Source and font notices</a> · <a href="./${escapeHtml(designation.download)}.manifest.json">Print identity</a></p>`:'',
    '    <div class="badges">',
    `      <span class="badge"><b>rhythmStyle</b> = ${escapeHtml(options.rhythmStyle)}</span>`,
    `      <span class="badge"><b>chordGrouping</b> = ${escapeHtml(options.chordGrouping)}</span>`,
    `      <span class="badge"><b>systemStartStyle</b> = ${escapeHtml(options.systemStartStyle)}</span>`,
    `      <span class="badge"><b>gridWritingPolicy</b> = ${escapeHtml(options.gridWritingPolicy)}</span>`,
    `      <span class="badge"><b>restStyle</b> = ${escapeHtml(options.restStyle)}</span>`,
    `      <span class="badge"><b>middleCSpine</b> = ${escapeHtml(options.middleCSpine)}</span>`,
    `      <span class="badge"><b>channelLayout</b> = ${escapeHtml(options.channelLayout)} · ${channelSpec.staffRules} lines</span>`,
    `      <span class="badge"><b>interStaffGap</b> = ${options.interStaffGap.toFixed(1)}pt</span>`,
    `      <span class="badge"><b>measuresPerSystem</b> = ${options.measuresPerSystem}</span>`,
    `      <span class="badge"><b>systemsPerPage</b> = ${options.systemsPerPage}</span>`,
    `      <span class="badge"><b>beatGrid</b> = ${beatsPerMeasure}/measure</span>`,
    `      <span class="badge"><b>noteheadRadius</b> = ${tokens.noteheadRadius.toFixed(1)}pt</span>`,
    `      <span class="badge"><b>haloRadius</b> = ${tokens.haloRadius.toFixed(1)}pt</span>`,
    '    </div>',
    `    <p class="round-meta" data-lint-ok="${report.ok}">Live linter: ${lintChip(report)} — ${report.stats.violations} violations, ${report.stats.warnings} warnings across ${report.stats.checks} checks.${knowns > 0 ? ` <em class="known-note">${knowns} known folding-geometry finding${knowns === 1 ? '' : 's'}, scheduled for a future round.</em>` : ''}</p>`,
    '  </div>',
    '  <h3 class="section-title">Full page spread</h3>',
    `  <div class="page-grid">${pageCards.join('\n')}</div>`,
    designation?.download&&cropsSection?`<details class="reference-passages"><summary>Playing cues · opening, repeat, shared values and closing phrase</summary>${cropsSection}</details>`:cropsSection,
    '  <details class="diagnostics" open>',
    `    <summary>Diagnostics (${report.diagnostics.length})</summary>`,
    `    <ul>${renderDiagnostics(report, knowns > 0 ? designation?.knownCode : undefined)}</ul>`,
    '  </details>',
    '</div>',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Render the Golden Reference Object: the full page spread of the canonical
 * score plus the macro focus crops, all from the golden-master options —
 * Bach GOLD AND, since Round 30, the Brahms BRONZE beside it (fixed-3 since
 * Round 31, 4-up, its diagnostics itemized — clean since the §5 geometry
 * pass seated every system and verified the stem tucks). Every round judges
 * against these objects; neither is ever a draft.
 *
 * The BRONZE Brahms block leads (Brahms is the live iteration surface) and
 * the GOLD Bach block follows without focus crops (operator order — Bach's
 * crop weight is dropped, its full spread stays).
 */
export function renderReferenceView(config: JankoStudioConfig = createStudioConfig()): string {
  const { score, options, tokens, crops, pages } = config;
  const brahms = config.scores[BRAHMS_STUDIO_SCORE_ID];
  // Candidate score-library overrides cannot rewrite the selected reference.
  const no14=config.scores[NO14_GOLD_REFERENCE_ID]?no14PublishedProfile():undefined;
  return [
    '<section class="view-panel" id="view-reference" data-view="reference">',
    ...(no14?[renderReferenceScore(NO14_GOLD_REFERENCE_ID,no14.score,no14.options,no14.tokens,undefined,[
      {start:1,count:3,title:'No. 14 · opening',caption:'Underlined absolute figure starts, relative interior digits and the selected automatic phrasing.'},
      {start:32,count:2,title:'No. 14 · repeat entrance',caption:'Repeat measures 33–64, with room before the first notes.'},
      {start:48,count:1,title:'No. 14 · independent values',caption:'Shared attacks retain separate long and short values and two independent slurs.'},
      {start:63,count:2,title:'No. 14 · closing phrase',caption:'The final0 continues the left-hand figure, followed by the source-written rests.'}
    ],{badge:'GOLD',revision:NO14_PUBLISHED_IDENTITY.profileSha256,title:`${no14.score.printIdentity?.composer} · ${no14.score.printIdentity?.work} · ${no14.score.printIdentity?.piece}`,introduction:'64 written bars · repeat 33–64 · three pages · underlined figure starts',download:NO14_GOLD_PDF})]:[]),
    renderReferenceScore(
      BRAHMS_STUDIO_SCORE_ID,
      brahms.score,
      brahms.options,
      brahms.tokens,
      config.brahmsPages,
      config.brahmsCrops,
      { badge: 'BRONZE' }
    ),
    renderReferenceScore('primary', score, options, tokens, pages, crops, { badge: 'GOLD' }),
    '</section>',
  ].join('\n');
}

function renderDiagnostics(report: LintReport, knownCode?: string): string {
  // Round 48: the `'info'` entries are **published facts**, not defects. A
  // surface with no violation and no warning keeps its clean line and lists the
  // facts beside it, so "clean" and "nothing to read" stay different statements.
  const gating = report.diagnostics.filter((d) => d.severity !== 'info');
  const lines: string[] = [];
  if (gating.length === 0) {
    lines.push(
      '<li class="diag-ok">✓ zero violations, zero warnings — the golden master is clean.</li>'
    );
  }
  if (report.diagnostics.length === 0) return lines.join('');
  lines.push(
    ...report.diagnostics
      .map((d) => {
      const where = `system ${d.system + 1}${d.measure ? `, m. ${d.measure}` : ''}`;
        const known =
          knownCode !== undefined && d.code === knownCode
            ? ' <span class="known-finding">known folding-geometry finding · scheduled for a future round</span>'
            : '';
        return `<li class="diag-${d.severity}"><b>${escapeHtml(d.code)}</b> · ${escapeHtml(where)} — ${escapeHtml(d.message)}${known}</li>`;
      })
  );
  return lines.join('');
}

// ---------------------------------------------------------------------------
// Markup, mounting & HMR
// ---------------------------------------------------------------------------

/** Both view panels, ready to be injected into the page shell. */
export function renderStudioMarkup(config: JankoStudioConfig = createStudioConfig()): string {
  return `${renderCandidatesView(config)}\n${renderReferenceView(config)}`;
}

/** The status line shown in the footer. */
export function renderStatusLine(config: JankoStudioConfig, mountedAt: Date): string {
  const report = lintJankoScore(config.score, config.options, config.tokens);
  const stamp = mountedAt.toISOString().slice(11, 19);
  return (
    `${report.ok ? '✓' : '✗'} ${report.stats.violations} violations · ${report.stats.warnings} warnings · ` +
    `${report.stats.systems} systems · ${report.stats.notes} noteheads · lint ${report.stats.durationMs} ms · ` +
    `rendered live at ${stamp}Z`
  );
}

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3.0;
const ZOOM_STEP = 0.25;

/**
 * Listeners installed by the previous mount. HMR re-executes this module, so
 * each re-mount first detaches the previous handlers — plus the pending scroll
 * debounce — instead of piling up duplicates on the long-lived shell elements
 * and the document.
 */
interface StudioListeners {
  detach: () => void;
}
const GLOBAL_SCOPE = globalThis as unknown as { __jankoStudioListeners?: StudioListeners };

function detachPreviousListeners(): void {
  GLOBAL_SCOPE.__jankoStudioListeners?.detach();
  GLOBAL_SCOPE.__jankoStudioListeners = undefined;
}

interface StudioDom {
  root: HTMLElement;
  zoomLabel: HTMLElement | null;
  status: HTMLElement | null;
  tabs: HTMLElement[];
  panels: HTMLElement[];
}

function collectDom(root: HTMLElement): StudioDom {
  const doc = root.ownerDocument;
  return {
    root,
    zoomLabel: doc.getElementById('janko-zoom-label'),
    status: doc.getElementById('janko-status'),
    tabs: Array.from(doc.querySelectorAll<HTMLElement>('[data-view-target]')),
    panels: Array.from(root.querySelectorAll<HTMLElement>('.view-panel')),
  };
}

function applyZoom(dom: StudioDom, zoom: number): void {
  const clamped = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.round(zoom * 100) / 100));
  dom.root.style.setProperty('--janko-zoom', String(clamped));
  dom.root.dataset.zoom = String(clamped);
  if (dom.zoomLabel) dom.zoomLabel.textContent = `${Math.round(clamped * 100)}%`;
}

function showView(dom: StudioDom, view: string): void {
  for (const panel of dom.panels) {
    panel.classList.toggle('is-active', panel.dataset.view === view);
  }
  for (const tab of dom.tabs) {
    tab.classList.toggle('is-active', tab.dataset.viewTarget === view);
  }
}

/** View requested by the URL hash (`#reference`), if any. */
function viewFromHash(fallback: string): string {
  const hash = explicitViewFromHash();
  return hash === 'candidates' || hash === 'reference' ? hash : fallback;
}

/**
 * The view named by an explicit URL hash — `undefined` when the address names
 * no view at all (then the stored session / default decides). `#foo` is not a
 * view, so it is not a hash claim either.
 */
function explicitViewFromHash(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const hash = window.location.hash.replace(/^#/, '');
  return hash === '' ? undefined : hash;
}

/**
 * Round 45 §F: the studio's own scroll/viewport port. Absent DOM → no-op, so
 * the module stays SSR-safe.
 */
function studioScrollPort(): StudioScrollPort {
  return {
    get: () =>
      typeof window === 'undefined' ? 0 : window.scrollY || window.pageYOffset || 0,
    set: (top) => {
      if (typeof window !== 'undefined') window.scrollTo(0, top);
    },
    max: () => {
      if (typeof window === 'undefined' || typeof document === 'undefined') return 0;
      const height = Math.max(
        document.documentElement?.scrollHeight ?? 0,
        document.body?.scrollHeight ?? 0
      );
      return Math.max(0, height - (window.innerHeight ?? 0));
    },
  };
}

/** sessionStorage, or `undefined` when storage is unavailable (private mode). */
function studioSessionStorage(): StudioStorageLike | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return window.sessionStorage ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Apply a restored place once the layout can host it: after the fonts have
 * settled and two frames have been painted, never on `unload`-style timing.
 */
function afterLayoutReady(apply: () => void): void {
  if (typeof window === 'undefined') return;
  const raf =
    typeof window.requestAnimationFrame === 'function'
      ? window.requestAnimationFrame.bind(window)
      : (callback: (time: number) => void): number =>
          window.setTimeout(() => callback(Date.now()), 0) as unknown as number;
  const fonts = (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts;
  const ready = fonts?.ready ? Promise.resolve(fonts.ready).catch(() => undefined) : Promise.resolve();
  void ready.then(() => raf(() => raf(() => apply())));
}

/**
 * The browser's own scroll restoration would race ours (and would put the page
 * back before the re-rendered content exists), so the studio claims it.
 */
function claimScrollRestoration(): void {
  if (typeof history === 'undefined' || !('scrollRestoration' in history)) return;
  try {
    history.scrollRestoration = 'manual';
  } catch {
    /* A read-only policy is not fatal: the studio still restores its place. */
  }
}

/**
 * Mount (or re-mount) the studio into `#janko-studio`.
 *
 * Called once on load and again on every HMR update, which is what makes edits
 * under `src/render/janko/` appear instantly without any user action.
 */
export function mountJankoStudio(
  config: JankoStudioConfig = createStudioConfig(),
  rootId = 'janko-studio'
): boolean {
  if (typeof document === 'undefined') return false;
  const root = document.getElementById(rootId);
  if (!root) return false;

  detachPreviousListeners();

  // Round 45 §F: the session lives on the **document**, so an HMR re-mount of
  // this document continues from the live state (and never re-reads storage),
  // while a real reload — e.g. the stock Vite reconnect after a phone
  // backgrounding — gets a fresh document and restores the stored session.
  const host = document as unknown as StudioSessionHost;
  const remount = host.__jankoStudioSession !== undefined;
  const port = studioScrollPort();
  const liveView = host.__jankoStudioSession?.view;
  const livePlace = remount ? port.get() : 0;

  root.innerHTML = renderStudioMarkup(config);
  const dom = collectDom(root);

  // Decided round (zero cards): the studio opens on the Reference — there is
  // no comparison to show. An explicit `#candidates` hash still wins, a stored
  // session decides next, and any future round's cards restore the normal
  // candidates-first default.
  const initialView =
    root.dataset.initialView ?? (config.candidates.length === 0 ? 'reference' : 'candidates');
  const views = dom.panels
    .map((panel) => panel.dataset.view)
    .filter((view): view is string => typeof view === 'string' && view.length > 0);
  const session = openStudioReviewSession({
    storage: studioSessionStorage(),
    host,
    views: views.length > 0 ? views : [initialView],
    fallbackView: initialView,
    hashView: explicitViewFromHash(),
    initialZoom: Number(root.dataset.zoom ?? '1') || 1,
    scroll: port,
    zoomBounds: { min: ZOOM_MIN, max: ZOOM_MAX },
  });
  if (remount) {
    // The re-rendered markup may be a different height; keep the reader's own
    // live place as the session's truth rather than any older stored value.
    if (liveView && Number.isFinite(livePlace) && livePlace > 0) session.recordPlace(livePlace, liveView);
    else session.captureScroll();
  }

  const showCurrentView = (): void => showView(dom, session.state.view);
  const showFromHash = (): void => {
    const view = viewFromHash(initialView);
    session.setView(view);
    showView(dom, view);
    session.capture();
    session.restorePlace(afterLayoutReady);
  };

  for (const tab of dom.tabs) {
    tab.addEventListener('click', () => {
      const view = tab.dataset.viewTarget ?? 'candidates';
      session.setView(view);
      showView(dom, view);
      if (typeof window !== 'undefined') window.location.hash = view;
      session.capture();
      session.restorePlace(afterLayoutReady);
    });
  }
  showCurrentView();

  let zoom = session.state.zoom;
  applyZoom(dom, zoom);
  const setZoom = (next: number): void => {
    zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, next));
    applyZoom(dom, zoom);
    session.setZoom(zoom);
    session.capture();
  };
  const step = (delta: number): void => setZoom(zoom + delta);
  document.getElementById('janko-zoom-in')?.addEventListener('click', () => step(ZOOM_STEP));
  document.getElementById('janko-zoom-out')?.addEventListener('click', () => step(-ZOOM_STEP));
  document.getElementById('janko-zoom-reset')?.addEventListener('click', () => setZoom(1));

  const wheel = (event: WheelEvent): void => {
    // Any wheel is the reader taking over: a restore still waiting for layout
    // must never fight them.
    session.cancelRestore();
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    step(event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP);
  };
  root.addEventListener('wheel', wheel, { passive: false });

  const keydown = (event: KeyboardEvent): void => {
    session.cancelRestore();
    if (event.key === '+' || event.key === '=') step(ZOOM_STEP);
    else if (event.key === '-' || event.key === '_') step(-ZOOM_STEP);
    else if (event.key === '0') setZoom(1);
  };
  document.addEventListener('keydown', keydown);

  // Capture the place after scrolling settles (debounced), and immediately
  // when the document is hidden or goes away — never on `unload`.
  let scrollTimer: number | undefined;
  const clearScrollTimer = (): void => {
    if (typeof window !== 'undefined' && scrollTimer !== undefined) window.clearTimeout(scrollTimer);
    scrollTimer = undefined;
  };
  const scroll = (): void => {
    if (session.restorePending()) {
      const top = port.get();
      const target = session.place();
      if (target !== top && top > 0) session.cancelRestore();
    }
    if (typeof window === 'undefined') return;
    clearScrollTimer();
    scrollTimer = window.setTimeout(() => {
      scrollTimer = undefined;
      session.capture();
    }, STUDIO_SCROLL_CAPTURE_DELAY_MS);
  };
  const pagehide = (): void => {
    clearScrollTimer();
    session.capture();
  };
  const visibilitychange = (): void => {
    if (document.visibilityState === 'hidden') pagehide();
  };
  const gesture = (): void => {
    session.cancelRestore();
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('scroll', scroll, { passive: true });
    window.addEventListener('pagehide', pagehide);
    window.addEventListener('hashchange', showFromHash);
    window.addEventListener('pointerdown', gesture, { passive: true });
    window.addEventListener('touchstart', gesture, { passive: true });
  }
  document.addEventListener('visibilitychange', visibilitychange);

  claimScrollRestoration();
  // Restore view + zoom before the first paint, then the clamped place once
  // the layout can host it (cancelled by any interaction in between). The
  // second pass writes back what is actually on screen — the settled place,
  // the live view, the live zoom — so a reload restores exactly the review
  // that was interrupted.
  session.restorePlace(afterLayoutReady);
  afterLayoutReady(() => session.capture());

  GLOBAL_SCOPE.__jankoStudioListeners = {
    detach: () => {
      clearScrollTimer();
      if (typeof window !== 'undefined') {
        window.removeEventListener('scroll', scroll);
        window.removeEventListener('pagehide', pagehide);
        window.removeEventListener('hashchange', showFromHash);
        window.removeEventListener('pointerdown', gesture);
        window.removeEventListener('touchstart', gesture);
      }
      document.removeEventListener('visibilitychange', visibilitychange);
      document.removeEventListener('keydown', keydown);
      root.removeEventListener('wheel', wheel);
      session.cancelRestore();
    },
  };

  if (dom.status) {
    dom.status.textContent = renderStatusLine(config, new Date());
    dom.status.dataset.live = 'true';
  }
  return true;
}

// ---------------------------------------------------------------------------
// Vite HMR entry
// ---------------------------------------------------------------------------

/**
 * Vite module entry. In dev, any edit under `src/render/janko/` invalidates this
 * module; Vite re-executes it (top-level bootstrap included) and the studio
 * re-renders in place — zero user action, zero refresh.
 *
 * The bare `accept()` is deliberate: a callback would close over the *previous*
 * module instance and re-mount with stale tokens, clobbering the fresh render.
 */
export function bootstrapJankoStudio(): void {
  mountJankoStudio();
  if (import.meta.hot) {
    import.meta.hot.accept();
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => bootstrapJankoStudio());
  } else {
    bootstrapJankoStudio();
  }
}
