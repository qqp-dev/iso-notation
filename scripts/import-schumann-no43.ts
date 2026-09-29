/** Regenerate the reviewed-source-derived No. 43 facts and draft; input is data, never executed. */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { importSchumannNo43 } from '../src/scores/schumann-no43';

const path = process.argv[2];
if (!path) throw Error('Usage: node --import tsx scripts/import-schumann-no43.ts /path/to/43-Chant-du-Nouvel-An.ly');
const result = importSchumannNo43(readFileSync(path, 'utf8'));
const approvedHash = '150e13d9723743fea780168fd9776525a856a99506522072185b619d3815797f';
if (result.facts.sourceHash !== approvedHash) throw Error(`Unapproved source hash ${result.facts.sourceHash}; expected ${approvedHash}`);
const target = resolve('src/scores/schumann-no43-derived.json');
writeFileSync(target, `${JSON.stringify(result, null, 2)}\n`);
console.log(`Approved ${result.facts.sourceHash}; ${result.facts.events.length} written events, ${result.facts.bars.length} written bars, ${result.facts.occurrences.length} unfolded bars, ${result.score.notes.length} sounding notes, ${result.ledger.length} deferred records → ${target}`);
