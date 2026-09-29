/** Approved-source-derived No. 30 draft; browser uses inert derived facts, never LilyPond. */
import derived from './schumann-no30-derived.json';
import type { QuantizedGridScore } from '../model/types';

export const SCHUMANN_NO30_APPROVED_SHA256 = '2dbde2fc08b9204df98a6b2f93a4c67a87b9fe8ca74bcab39a6cec0e42b518d0';
export const SCHUMANN_NO30_DRAFT_ID = 'schumann-op68-no30';
export const schumannNo30WrittenFacts = derived.facts;
export const schumannNo30DeferredLedger = derived.ledger;

export function buildSchumannNo30Draft(): QuantizedGridScore {
  if (derived.facts.sourceHash !== SCHUMANN_NO30_APPROVED_SHA256 || derived.score.id !== SCHUMANN_NO30_DRAFT_ID ||
      derived.facts.bars.length !== 34 || derived.facts.occurrences.length !== 49 ||
      derived.facts.occurrenceTies.length !== 28)
    throw Error('Schumann No. 30 derived record does not match the approved complete source identity');
  return structuredClone(derived.score) as QuantizedGridScore;
}
