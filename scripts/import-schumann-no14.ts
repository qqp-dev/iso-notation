/** Regenerate approved No. 14 facts; source bytes are inert and hash guarded. */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { importSchumannNo14 } from '../src/scores/schumann-no43';

const path = process.argv[2];
if (!path) throw Error('Usage: node --import tsx scripts/import-schumann-no14.ts /path/to/14-Petite-etude.ly');
const result = importSchumannNo14(readFileSync(path, 'utf8'));
const target = resolve('src/scores/schumann-no14-derived.json');
writeFileSync(target, `${JSON.stringify(result, null, 2)}\n`);
console.log(`Approved ${result.facts.sourceHash}; ${result.facts.events.length} written events, ${result.facts.bars.length} written bars, ${result.facts.occurrences.length} unfolded bars, ${result.score.notes.length} projected notes, ${result.ledger.length} deferred records → ${target}`);
