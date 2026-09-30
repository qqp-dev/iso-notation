/** Archived candidate deltas evaluated against their explicit previous rules.
 * The live studio still resolves the production registry against current defaults. */
export * from '../src/render/janko/candidates';
import { resolveCandidate as current, type JankoCandidate } from '../src/render/janko/candidates';
import { resolveJankoOptions,resolveJankoTokens } from './pre-clarity-rules';
export const resolveCandidate=(c:JankoCandidate)=>({ ...current(c),
  options:resolveJankoOptions(c.options),tokens:resolveJankoTokens(c.tokens) });
