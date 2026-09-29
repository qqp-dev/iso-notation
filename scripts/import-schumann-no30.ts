/** Regenerate approved No. 30 facts from inert, hash-guarded source bytes. */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { importSchumannNo30 } from '../src/scores/schumann-no43';

const path = process.argv[2];
if (!path) throw Error('Usage: node --import tsx scripts/import-schumann-no30.ts /path/to/30-sans-titre.ly');
const result = importSchumannNo30(readFileSync(path, 'utf8'));
const target = resolve('src/scores/schumann-no30-derived.json');
writeFileSync(target, `${JSON.stringify(result, null, 2)}\n`);
console.log(`${result.facts.sourceHash}: ${result.facts.events.length} written events, ${result.facts.bars.length} bars, ${result.facts.occurrences.length} occurrences, ${result.score.notes.length} projected notes, ${result.ledger.length} deferred facts → ${target}`);
