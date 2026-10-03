/** Frozen historical data only; importing this module registers no tests. */
import { HOLD_ENDPOINT_SPECIMEN_STUDIO_SCORE_ID, brahmsWindow, type JankoCandidate, type JankoCandidateRound, type JankoCandidateWindow } from '../../src/render/janko/candidates.js';
/** Historical Round 41 metadata (parked). */

export const ROUND_41_METADATA: JankoCandidateRound = {
  round: 41,
  title: 'Exceptional-duration release endpoints — Round 41',
  description:
    'Exception members of a shared-duration bracket (a member whose own duration differs from the group’s carried value) give up their own duration ink for one thin 0.40pt hold-to-release connector that starts flush at the protected symbol edge, runs at the member’s true pitch y, replaces the local staff rule with a 0.90pt white band where it coincides with one, and ends at the exact resolved release time in one of three terminals: a 2.40pt stop bar (0.55pt stroke), a 1.60pt filled diamond, or a 2.20pt open ring (0.40pt stroke). Chord members are set at 75 % absolute-pitch-symbol size, standalone symbols stay canonical, and both spreads of the Reference view remain untouched.',
  openAxes: ['durationEndpoint'],
};

/**
 * Round 41: the four windows every candidate is engraved on — the three
 * authentic Brahms stress specimens the round names, plus the synthetic
 * fixture for the situations the corpus never states. All three cards share
 * them, so the only visible difference between cards is the terminal shape.
 */
function round41Windows(): JankoCandidateWindow[] {
  return [
    brahmsWindow(
      8,
      1,
      'Brahms Op. 118 No. 1 · m. 8 — early exception beside a full-size symbol',
      'B3 states 48 ticks against its group’s carried 96: the 0.40pt connector starts flush at the protected symbol edge and the terminal seats 3.00pt back from the C4 that occupies the release instant (measured, published, never a silent clip).'
    ),
    brahmsWindow(
      9,
      2,
      'Brahms Op. 118 No. 1 · mm. 9–10 — two late exceptions, boundary release, same-pitch reattack',
      'Two 192-tick exceptions against a carried 144 release on m. 9→10’s tick 1776 — the resolved column of m. 10’s downbeat, which the connector reaches across the barline (crossing reported): G4 lands exactly on the anchor beside its same-pitch reattack; F4 seats 2.03pt clear of the E4 sharing that column.'
    ),
    brahmsWindow(
      22,
      2,
      'Brahms Op. 118 No. 1 · mm. 22–23 — late exception over the coincident octave-line rule',
      'C6 states 120 ticks against a carried 96 on its true pitch row — which is the C6 octave-line rule itself: the 0.90pt white band replaces that rule segment locally (nothing else is erased) and the terminal lands exactly on the release anchor at tick 4200, where no attack exists.'
    ),
    {
      scoreId: HOLD_ENDPOINT_SPECIMEN_STUDIO_SCORE_ID,
      measureStart: 1,
      measureCount: 4,
      title: 'Hold Endpoint Specimen · mm. 1–4 — three-duration chord, off-beat release, line-crossing continuation',
      caption:
        'Six exceptions on clean material, two measures per system: one chord carries 48/96/120 (carried 48) so C5 and B5 are exceptions of different values, C5 on the octave-line rule and B5 releasing at tick 168 where no onset exists; the C6 exception releases at tick 408, past this system’s last tick (384), so its ink reaches the line edge and paints no terminal — a line break is not a release; the C5 exception releases at 144 beside its same-pitch reattack, and the closing exception releases on the final barline at 768, seated 1.08pt clear of it. Geometry is shared across cards; only the terminal shape differs.',
    },
  ];
}

/** Shared option delta of the three Round 41 cards (terminal shape aside). */
const ROUND_41_SHARED_OPTIONS = {
  pitchPlacement: 'parity-columns',
  chordSymbolScale: 0.75,
} as const;

/**
 * Shared token delta of the three Round 41 cards: the tightened chord masks
 * (0.10pt margin, 0.20pt air) measured against the actual 75 % glyph bounds.
 * Every other token — the connector (0.40pt), the white underlay (0.90pt tall),
 * the terminal air (0.20pt) and the three terminal dimensions — is the
 * project-wide token default, so the cards share them by construction.
 */
const ROUND_41_SHARED_TOKENS = { chordKnockoutMargin: 0.10, chordKnockoutAir: 0.20 } as const;

/**
 * Round 41: exceptional-duration hold lines and explicit release endpoints.
 *
 * Exactly three active score cards, identical in every option and token except
 * the terminal shape (`durationEndpoint`, the round's only open axis):
 *
 * 1. **stop bar** — vertical 2.40pt bar, 0.55pt stroke, centred on the release;
 * 2. **diamond** — filled diamond 1.60pt across, centred on the release;
 * 3. **ring** — open circle 2.20pt diameter, 0.40pt stroke, connector ending at
 *    its left perimeter.
 *
 * All three replace only **exception** members' own duration ink (a member
 * whose own duration differs from the group's carried value) with one thin
 * 0.40pt connector that starts flush at the member's protected symbol edge at
 * its true pitch y and ends at the exact resolved release time; the shared
 * bracket, baseline selection, slurs and ordinary rhythm are untouched.
 */
export const ROUND_41_CANDIDATES: JankoCandidate[] = [
  {
    id: 'hold-stop-bar',
    label: 'Stop bar endpoint',
    description:
      'Exception members’ own duration ink replaced by the shared 0.40pt connector (0.90pt white band where it coincides with a staff rule) ending in a vertical stop bar 2.40pt tall at 0.55pt stroke, centred on the release.',
    axis: 'durationEndpoint',
    options: { ...ROUND_41_SHARED_OPTIONS, durationEndpoint: 'stop-bar' },
    tokens: { ...ROUND_41_SHARED_TOKENS },
    windows: round41Windows(),
    tags: ['brahms', 'specimen', 'endpoint', 'stop-bar'],
  },
  {
    id: 'hold-diamond',
    label: 'Diamond endpoint',
    description:
      'The same connector (0.40pt) and the same 0.90pt rule-replacing white band, ending in a solid diamond 1.60pt across centred on the release.',
    axis: 'durationEndpoint',
    options: { ...ROUND_41_SHARED_OPTIONS, durationEndpoint: 'diamond' },
    tokens: { ...ROUND_41_SHARED_TOKENS },
    windows: round41Windows(),
    tags: ['brahms', 'specimen', 'endpoint', 'diamond'],
  },
  {
    id: 'hold-ring',
    label: 'Ring endpoint',
    description:
      'The same connector (0.40pt) and the same 0.90pt rule-replacing white band, ending in an open circle 2.20pt in diameter at 0.40pt stroke; the connector stops at the ring’s left perimeter.',
    axis: 'durationEndpoint',
    options: { ...ROUND_41_SHARED_OPTIONS, durationEndpoint: 'ring' },
    tokens: { ...ROUND_41_SHARED_TOKENS },
    windows: round41Windows(),
    tags: ['brahms', 'specimen', 'endpoint', 'ring'],
  },
];
