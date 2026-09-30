/** Explicit pre-clarity rules for archived decision-round mechanism fixtures.
 * These are NOT current repertoire freezes. The current engine/defaults are
 * exercised without these overrides by janko-clarity*, source-expression,
 * source/import, production, PDF and current linter acceptance tests.
 * Keep historical assertions intact: they describe the old candidate geometry,
 * not authority to retain an error in current shared notation. */
export * from '../src/render/janko/types';
import { DEFAULT_JANKO_OPTIONS as currentOptions, DEFAULT_JANKO_TOKENS as currentTokens,
  resolveJankoOptions as currentResolveOptions, resolveJankoTokens as currentResolveTokens,
  type JankoLayoutOptions, type JankoTokens, type ResolvedJankoLayoutOptions, type ResolvedJankoTokens } from '../src/render/janko/types';
export const DEFAULT_JANKO_OPTIONS: ResolvedJankoLayoutOptions = { ...currentOptions, clarityPass:false, tieProfile:'uniform' as const };
export const DEFAULT_JANKO_TOKENS: ResolvedJankoTokens = { ...currentTokens, graceScale:.68, dynamicScale:.018,
  claspSlashLength:7.5,claspSlashStroke:1,claspSlashSlope:.22,upperExtensionThreshold:73 };
export const resolveJankoOptions = (o?: Partial<JankoLayoutOptions>|null) =>
  currentResolveOptions({ ...DEFAULT_JANKO_OPTIONS,...o,clarityPass:false });
export const resolveJankoTokens = (t?: Partial<JankoTokens>|null) =>
  currentResolveTokens({ ...DEFAULT_JANKO_TOKENS,...t,graceScale:.68,dynamicScale:.018,
    claspSlashLength:7.5,claspSlashStroke:1,claspSlashSlope:.22,upperExtensionThreshold:73 });
