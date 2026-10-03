/** Frozen historical data only; importing this module registers no tests. */
import { brahmsWindow, SYNTHETIC_M8_DIAGNOSTIC_SCORE_ID, type JankoCandidate, type JankoCandidateRound } from '../pre-clarity-candidates';
const ROUND_37_WINDOWS = [
  brahmsWindow(7, 3, 'mm.7–9 · Dense chord clusters, mixed release, odd anchor family'),
  brahmsWindow(46, 2, 'mm.46–47 · Dense chord cluster, vertical stacking clearance'),
  brahmsWindow(60, 2, 'mm.60–61 · Alternating anchor row family, shared bass anchor & unison voice'),
  brahmsWindow(66, 2, 'mm.66–67 · Dense chord cluster, compound span'),
  brahmsWindow(71, 1, 'm.71 · Dense chord cluster'),
  {
    scoreId: SYNTHETIC_M8_DIAGNOSTIC_SCORE_ID,
    measureStart: 1,
    measureCount: 1,
    title: 'Synthetic diagnostic · m.8 inner G3→A3 perturbation (same span/count/parities)',
  },
];

/** Historical Round 37 metadata (parked). */
export const ROUND_37_METADATA: JankoCandidateRound = {
  round: 37,
  title: 'Intrinsically indexed symmetric cluster candidate',
  description:
    'Round 37: intrinsically indexed symmetric cluster candidate (OPEN, candidate-only comparison; NOT canonical adoption). Features slender stroked pitch body paths (0.5pt, fill none) with discrete 2-semitone centered reference divisions, duodecimal 10-span (12-semitone) octave boundary markers, paired outward sounding articulations (landmarks), and explicit visible duration ownership (connecting rails for runs, individual connectors for singletons). Reuses shared painted bass anchor in m.60 cross-hand unisons while connecting RH form to lowest pitch. Judged against literal control on identical Brahms windows mm. 7–9, 46–47, 60–61, 66–67, m.71, plus synthetic m.8 G3→A3 diagnostic.',
  openAxes: ['clusterPresentation'],
};

/** Historical Round 37 candidates (parked). */
export const ROUND_37_CANDIDATES: JankoCandidate[] = [
  {
    id: 'indexed-symmetric-literal',
    label: 'Control · Literal baseline',
    description:
      'The golden baseline: every notehead rendered literally with duodecimal digits across all registers. Preserves standard reading overhead for dense clusters.',
    axis: 'clusterPresentation',
    options: { clusterPresentation: 'literal' },
    windows: ROUND_37_WINDOWS,
    tags: ['control', 'literal'],
  },
  {
    id: 'indexed-symmetric',
    label: 'A · Intrinsically indexed symmetric cluster',
    description:
      'Intrinsically indexed symmetric cluster candidate: slender stroked paths (0.5pt) with discrete 2-semitone centered divisions and duodecimal 10-span octave boundaries. Sounding landmarks are paired outward articulations (ticks); central crossings are unadorned and silent; primary path and reflection denote ONE note. Explicit visible duration ownership at sounding landmarks via connecting rails or individual connectors. Reuses shared painted bass anchor in m.60. Remaining readability risks: optical density at tight intervals, interpolation of odd semitone steps, potential visual confusion between octave divisions and staff lines.',
    axis: 'clusterPresentation',
    options: { clusterPresentation: 'indexed-symmetric' },
    windows: ROUND_37_WINDOWS,
    tags: ['indexed-symmetric', 'candidate'],
  },
];
