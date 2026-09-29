/** Regenerate No. 13 from inert hash-guarded approved bytes (no LilyPond execution). */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { importSchumannNo13 } from '../src/scores/schumann-no43';

const path = process.argv[2];
if (!path) throw Error('Usage: node --import tsx scripts/import-schumann-no13.ts /path/to/13-Mai-cher-Mai.ly');
const result = importSchumannNo13(readFileSync(path, 'utf8'));
const target = resolve('src/scores/schumann-no13-derived.json');
writeFileSync(target, `${JSON.stringify(result, null, 2)}\n`);
console.log(`${result.facts.sourceHash}: ${result.facts.events.length} events, ${result.facts.bars.length} bars, ${result.facts.occurrences.length} occurrences, ${result.score.notes.length} attacks, ${result.score.graceGroups?.length} grace groups → ${target}`);
