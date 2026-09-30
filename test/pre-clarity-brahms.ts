/** Previous Brahms configuration for archived mechanism fixtures, not the
 * current Reference. Current repertoire consequences are measured separately. */
export * from '../src/scores/brahms-op118-no1';
import type { JankoLayoutOptions,JankoTokens } from '../src/render/janko/types';
import { BRAHMS_OP118_NO1_JANKO_OPTIONS as options, BRAHMS_OP118_NO1_JANKO_TOKENS as tokens } from '../src/scores/brahms-op118-no1';
export const BRAHMS_OP118_NO1_JANKO_OPTIONS: Partial<JankoLayoutOptions> = { ...options, clarityPass:false,tieProfile:'uniform' as const };
export const BRAHMS_OP118_NO1_JANKO_TOKENS: Partial<JankoTokens> = { ...tokens,graceScale:.68,dynamicScale:.018,
  claspSlashLength:7.5,claspSlashStroke:1,claspSlashSlope:.22,upperExtensionThreshold:73 };
