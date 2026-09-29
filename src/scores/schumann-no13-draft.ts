/** Approved-source-derived No. 13 draft; ornaments remain nonmetrical written facts. */
import derived from './schumann-no13-derived.json';
import type { QuantizedGridScore } from '../model/types';

export const SCHUMANN_NO13_APPROVED_SHA256 = 'c9345d758fb6bb2bd88425d810e1578e4db497e7393f23bbda6504644fc3e15e';
export const SCHUMANN_NO13_DRAFT_ID = 'schumann-op68-no13';
export const schumannNo13WrittenFacts = derived.facts;
export const schumannNo13DeferredLedger = derived.ledger;

export function buildSchumannNo13Draft(): QuantizedGridScore {
  if (derived.facts.sourceHash !== SCHUMANN_NO13_APPROVED_SHA256 || derived.score.id !== SCHUMANN_NO13_DRAFT_ID ||
      derived.facts.bars.length !== 28 || derived.facts.occurrences.length !== 56 ||
      derived.score.graceGroups.length !== 20 || derived.score.graceGroups.filter(g => g.staff === 'upper').length !== 8)
    throw Error('Schumann No. 13 derived record does not match the approved complete source identity');
  return structuredClone(derived.score) as QuantizedGridScore;
}
