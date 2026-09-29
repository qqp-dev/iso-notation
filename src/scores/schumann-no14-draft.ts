/** Approved-source-derived No. 14 draft; no filesystem or LilyPond in the browser. */
import derived from './schumann-no14-derived.json';
import type { QuantizedGridScore } from '../model/types';

export const SCHUMANN_NO14_APPROVED_SHA256 = '42aa471662af4d919f696b03e6b7b5b634a8e1f1310303aa6a92075c9b511533';
export const SCHUMANN_NO14_DRAFT_ID = 'schumann-op68-no14';
export const schumannNo14WrittenFacts = derived.facts;
export const schumannNo14DeferredLedger = derived.ledger;

export function buildSchumannNo14Draft(): QuantizedGridScore {
  if (derived.facts.sourceHash !== SCHUMANN_NO14_APPROVED_SHA256 || derived.score.id !== SCHUMANN_NO14_DRAFT_ID ||
      derived.facts.bars.length !== 64 || derived.facts.occurrences.length !== 96)
    throw Error('Schumann No. 14 derived record does not match the approved complete source identity');
  return structuredClone(derived.score) as QuantizedGridScore;
}
