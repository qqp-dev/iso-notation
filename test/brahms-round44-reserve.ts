/**
 * The **Round 44 reserve** — the historical Brahms surface.
 * ========================================================
 *
 * Round 45 adopted the agreed 0.90 treatment as the *working* Brahms Reference
 * (`BRAHMS_OP118_NO1_JANKO_OPTIONS` / `BRAHMS_OP118_NO1_JANKO_TOKENS`): larger
 * admitted-cluster symbols, declared centred optical spacing, the Round 45
 * duration ratios on both mounts and literal low pitches. The Round 44 geometry
 * itself is byte-identical to the landed PR81 sha `081e5cdf0459` when the six
 * Round 45 keys are driven back to their no-op defaults — verified by
 * re-running the landed round on this engine (option-set diff: only the
 * intentional m. 66 hand correction moves any head).
 *
 * Every historical fixture (the Round 17A/19/20 row-fan and rail mechanisms,
 * the shared-stem/unison accounting, the packing and slot geometry, the rest
 * dialects) therefore pins **this** surface instead of the moving working
 * Reference: the mechanism under test is unchanged, and the numbers stay the
 * ones the ruled round measured. Tests that are about the *working* Reference
 * read `BRAHMS_OP118_NO1_JANKO_OPTIONS` directly.
 */

import {
  BRAHMS_OP118_NO1_JANKO_OPTIONS,
  BRAHMS_OP118_NO1_JANKO_TOKENS,
} from '../src/scores/brahms-op118-no1';
import { JankoLayoutOptions, JankoTokens } from '../src/render/janko/types';

/**
 * The Round 44 Brahms options: the working options with every Round 45 key at
 * its no-op default (`standard` placement, full-size 1, the golden bracket
 * grammar, no exception carrier, no optical spacing, core folding).
 */
export const BRAHMS_ROUND44_RESERVE_OPTIONS: Partial<JankoLayoutOptions> = {
  ...BRAHMS_OP118_NO1_JANKO_OPTIONS,
  pitchPlacement: 'standard',
  chordSymbolScale: 1,
  bracketDurationGrammar: 'golden',
  exceptionCarrier: 'none',
  opticalSpacing: false,
  lowPitchFolding: 'core',
};

/**
 * The Round 44 Brahms tokens: the working token set with the Round 45
 * readability ratios at 1 (the `0.75`-era 45-degree family), so the historical
 * slash/ring/cut metrics are exactly the landed ones.
 */
export const BRAHMS_ROUND44_RESERVE_TOKENS: Partial<JankoTokens> = {
  ...BRAHMS_OP118_NO1_JANKO_TOKENS,
  midpointSlashLengthFactor: 1,
  midpointRingScale: 1,
  midpointSpacingFactor: 1,
};
