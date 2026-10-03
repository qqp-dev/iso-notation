/** Frozen historical data only; importing this module registers no tests. */
import { abstractDensityWindow, abstractKeyWindow, abstractLadderOctaveProbeWindow, abstractNearNeighboursWindow, abstractTranspositionWindow, type JankoCandidate, type JankoCandidateRound } from '../../src/render/janko/candidates.js';
/** Historical Round 39 metadata (parked). */
export const ROUND_39_METADATA: JankoCandidateRound = {
  round: 39,
  title: 'Twelve-site alphabets under strain — Round 39',
  description:
    'Identical common stress battery evaluating Dial, Rosette, and Staggered pitch ladder under twelve modulo-12 transpositions, near neighbours, and density extremes, with an explicit ladder octave-boundary probe. Fixed coordinate origin and scale across candidates; no auto-rotation or subset recentering.',
  openAxes: ['arrangement'],
};

/** Historical Round 39 candidates (parked). */
export const ROUND_39_CANDIDATES: JankoCandidate[] = [
  {
    id: 'dial',
    label: 'Dial',
    description:
      'Regular 12-gon circular dial. R = 2 / sin(π/12) ≈ 7.7274pt, site 0 at top, clockwise order. Modulo-12 transposition is rigid rotation. Nominal full ink bounds 16.5548 × 16.5548pt, min separation 4.0pt.',
    kind: 'abstract',
    abstractGeometry: 'dial',
    axis: 'arrangement',
    windows: [
      abstractKeyWindow(
        'dial',
        'Twelve-site key (3×)',
        'Full configuration (0–b) · 16.5548 × 16.5548pt nominal ink bounds (enlarged 3×)'
      ),
      abstractTranspositionWindow('dial'),
      abstractNearNeighboursWindow('dial'),
      abstractDensityWindow('dial'),
    ],
    tags: ['abstract', 'dial'],
  },
  {
    id: 'rosette',
    label: 'Rosette',
    description:
      'Alternating rosette. Radii 4√3 ≈ 6.9282pt for even i, 4.0pt for odd i. Angular step π/6, site 0 at top. Even transpositions rotate rigidly; odd transpositions exchange inner/outer tiers and deform configuration. Nominal full ink bounds 13.1000 × 14.9564pt, min separation 4.0pt. Sites only, no star or polygon drawn.',
    kind: 'abstract',
    abstractGeometry: 'rosette',
    axis: 'arrangement',
    windows: [
      abstractKeyWindow(
        'rosette',
        'Twelve-site key (3×)',
        'Full configuration (0–b) · 13.1000 × 14.9564pt nominal ink bounds (enlarged 3×)'
      ),
      abstractTranspositionWindow('rosette'),
      abstractNearNeighboursWindow('rosette'),
      abstractDensityWindow('rosette'),
    ],
    tags: ['abstract', 'rosette'],
  },
  {
    id: 'ladder',
    label: 'Staggered pitch ladder',
    description:
      'Staggered pitch ladder. Two staggered columns with upward pitch: x = ±√3pt (even/odd), y = 11 - 2p pt (SVG downward y). Unfolded shifts translate/reflect; modulo-12 folding breaks shape at octave boundary. Nominal full ink bounds 4.5641 × 23.1000pt, min separation 4.0pt. Sites only, no rails or connector lines drawn.',
    kind: 'abstract',
    abstractGeometry: 'ladder',
    axis: 'arrangement',
    windows: [
      abstractKeyWindow(
        'ladder',
        'Twelve-site key (3×)',
        'Full configuration (0–b) · 4.5641 × 23.1000pt nominal ink bounds (enlarged 3×)'
      ),
      abstractTranspositionWindow('ladder'),
      abstractNearNeighboursWindow('ladder'),
      abstractDensityWindow('ladder'),
      abstractLadderOctaveProbeWindow(),
    ],
    tags: ['abstract', 'ladder'],
  },
];

// ---------------------------------------------------------------------------
// 1. Geometry truth (Ladder, Dial, Rosette)
