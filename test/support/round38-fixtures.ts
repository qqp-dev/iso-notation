/** Frozen historical data only; importing this module registers no tests. */
import { abstractKeyWindow, abstractSubsetWindow, type JankoCandidate, type JankoCandidateRound } from '../pre-clarity-candidates';
/** Historical Round 38 metadata (parked). */
export const ROUND_38_METADATA: JankoCandidateRound = {
  round: 38,
  title: 'Twelve-site spatial alphabet — three abstract candidates',
  description:
    'Which compact twelve-site arrangement makes selected subsets distinguishable and learnable with the least visual noise? No optimality or human-readability claim. Site labels are identities for this geometry study, not an adopted pitch/interval convention. Evaluates Dial, Rosette, and Asymmetric constellation across identical keys and {0,3,7,a} vs {0,5,7,a} subsets.',
  openAxes: ['arrangement'],
};

/** Historical Round 38 candidates (parked). */
export const ROUND_38_CANDIDATES: JankoCandidate[] = [
  {
    id: 'dial',
    label: 'Dial',
    description:
      'Regular 12-gon circular dial. R = 2 / sin(π/12) ≈ 7.7274pt, site 0 at top, clockwise order. Nominal full ink bounds 16.5548 × 16.5548pt, min separation 4.0pt.',
    kind: 'abstract',
    abstractGeometry: 'dial',
    axis: 'arrangement',
    windows: [
      abstractKeyWindow(
        'dial',
        'Twelve-site key (3×)',
        'Full configuration (0–b) · 16.5548 × 16.5548pt nominal ink bounds (enlarged 3×)'
      ),
      abstractSubsetWindow(
        'dial',
        'subset-1',
        'Subset {0,3,7,a}',
        'Four sites · changed site 3 · 16.5548 × 16.5548pt nominal footprint'
      ),
      abstractSubsetWindow(
        'dial',
        'subset-2',
        'Subset {0,5,7,a}',
        'Four sites · changed site 3 to 5 · 16.5548 × 16.5548pt nominal footprint'
      ),
    ],
    tags: ['abstract', 'dial'],
  },
  {
    id: 'rosette',
    label: 'Rosette',
    description:
      'Alternating rosette. Radii 4√3 ≈ 6.9282pt for even i, 4.0pt for odd i. Angular step π/6, site 0 at top. Nominal full ink bounds 13.1000 × 14.9564pt, min separation 4.0pt. Sites only, no star or polygon drawn.',
    kind: 'abstract',
    abstractGeometry: 'rosette',
    axis: 'arrangement',
    windows: [
      abstractKeyWindow(
        'rosette',
        'Twelve-site key (3×)',
        'Full configuration (0–b) · 13.1000 × 14.9564pt nominal ink bounds (enlarged 3×)'
      ),
      abstractSubsetWindow(
        'rosette',
        'subset-1',
        'Subset {0,3,7,a}',
        'Four sites · changed site 3 · 13.1000 × 14.9564pt nominal footprint'
      ),
      abstractSubsetWindow(
        'rosette',
        'subset-2',
        'Subset {0,5,7,a}',
        'Four sites · changed site 3 to 5 · 13.1000 × 14.9564pt nominal footprint'
      ),
    ],
    tags: ['abstract', 'rosette'],
  },
  {
    id: 'asymmetric',
    label: 'Asymmetric constellation',
    description:
      'Planar constellation on 4pt coordinate steps. Nominal full ink bounds 17.1000 × 17.1000pt, min separation 4.0pt. No grid drawn.',
    kind: 'abstract',
    abstractGeometry: 'asymmetric',
    axis: 'arrangement',
    windows: [
      abstractKeyWindow(
        'asymmetric',
        'Twelve-site key (3×)',
        'Full configuration (0–b) · 17.1000 × 17.1000pt nominal ink bounds (enlarged 3×)'
      ),
      abstractSubsetWindow(
        'asymmetric',
        'subset-1',
        'Subset {0,3,7,a}',
        'Four sites · changed site 3 · 17.1000 × 17.1000pt nominal footprint'
      ),
      abstractSubsetWindow(
        'asymmetric',
        'subset-2',
        'Subset {0,5,7,a}',
        'Four sites · changed site 3 to 5 · 17.1000 × 17.1000pt nominal footprint'
      ),
    ],
    tags: ['abstract', 'asymmetric'],
  },
];

// ---------------------------------------------------------------------------
// 1. Candidate Registry: Exactly Three Abstract Cards
