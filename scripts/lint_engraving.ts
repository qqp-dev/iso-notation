#!/usr/bin/env node
/**
 * `npm run lint:engraving` — Implementer Visual Linter CLI
 * =======================================================
 *
 * Runs the mathematical engraving linter over the canonical benchmark scores
 * (J.S. Bach, Goldberg Variations BWV 988, Variatio 1; and J. Brahms, Op. 118 No. 1)
 * and reports every violation in milliseconds — no rasterization, no browser, no eyes required.
 *
 * Flags
 * -----
 * - `--json`    machine-readable report (for agents and CI)
 * - `--strict`  exit non-zero on warnings as well as violations
 * - `--quiet`   one summary line only
 *
 * Exit codes: 0 = clean, 1 = violations (or warnings with `--strict`).
 */

import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1';
import { buildChordDurationSpecimenScore } from '../src/scores/chord-duration-specimen';
import {
  REST_DURATION_SPECIMEN_JANKO_OPTIONS,
  REST_DURATION_SPECIMEN_JANKO_TOKENS,
  buildRestDurationSpecimenScore,
} from '../src/scores/rest-duration-specimen';
import {
  DURATION_SPECIMEN_JANKO_OPTIONS,
  DURATION_SPECIMEN_JANKO_TOKENS,
  buildDurationSpecimenScore,
} from '../src/scores/duration-specimen';
import {
  BRAHMS_OP118_NO1_JANKO_OPTIONS,
  BRAHMS_OP118_NO1_JANKO_TOKENS,
  buildBrahmsOp118No1Score,
} from '../src/scores/brahms-op118-no1';
import { formatLintReport, lintJankoScore } from '../src/render/janko/linter';
import { DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS } from '../src/render/janko/types';

const args = new Set(process.argv.slice(2));
const asJson = args.has('--json');
const strict = args.has('--strict');
const quiet = args.has('--quiet');

const bachScore = buildBachGoldbergVar1Score();
const bachReport = lintJankoScore(bachScore, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);

const brahmsScore = buildBrahmsOp118No1Score();
const brahmsReport = lintJankoScore(
  brahmsScore,
  { ...BRAHMS_OP118_NO1_JANKO_OPTIONS, core: 'adaptive' },
  BRAHMS_OP118_NO1_JANKO_TOKENS
);

// Round 20: the two curated specimens are part of the golden gate — the rest
// specimen states every rest value (the whole bar included) and the chord
// specimen the whole duration taxonomy, so a seat or cut regression is caught
// on material that isolates it.
const chordSpecimenReport = lintJankoScore(
  buildChordDurationSpecimenScore(),
  { ...DEFAULT_JANKO_OPTIONS, core: 'adaptive', measuresPerSystem: 2 },
  DEFAULT_JANKO_TOKENS
);
const restSpecimenReport = lintJankoScore(
  buildRestDurationSpecimenScore(),
  REST_DURATION_SPECIMEN_JANKO_OPTIONS,
  REST_DURATION_SPECIMEN_JANKO_TOKENS
);
// Round 21 §E: the constructed working-set specimen — 32nd/64th runs, mixed
// beam levels, lone partial beams and solo flags. The corpus states none of
// this material, so the complete set is gated here.
const durationSpecimenReport = lintJankoScore(
  buildDurationSpecimenScore(),
  DURATION_SPECIMEN_JANKO_OPTIONS,
  DURATION_SPECIMEN_JANKO_TOKENS
);

const allReports = [
  { score: 'Bach Goldberg Var 1', report: bachReport },
  { score: 'Brahms Op. 118 No. 1', report: brahmsReport },
  { score: 'Chord Duration Specimen', report: chordSpecimenReport },
  { score: 'Rest Duration Specimen', report: restSpecimenReport },
  { score: 'Duration Working-Set Specimen', report: durationSpecimenReport },
];

const totalViolations = allReports.reduce((n, r) => n + r.report.violations.length, 0);
const totalWarnings = allReports.reduce((n, r) => n + r.report.warnings.length, 0);

if (asJson) {
  console.log(
    JSON.stringify(
      {
        bach: bachReport,
        brahms: brahmsReport,
        chordSpecimen: chordSpecimenReport,
        restSpecimen: restSpecimenReport,
        durationSpecimen: durationSpecimenReport,
      },
      null,
      2
    )
  );
} else if (quiet) {
  console.log(
    `${totalViolations === 0 ? 'clean' : 'violations'} violations=${totalViolations} warnings=${totalWarnings} ` +
      `systems=${allReports.reduce((n, r) => n + r.report.stats.systems, 0)} ` +
      `notes=${allReports.reduce((n, r) => n + r.report.stats.notes, 0)}`
  );
} else {
  for (const { score, report } of allReports) {
    console.log(`=== ${score} ===`);
    console.log(formatLintReport(report));
    console.log('');
  }
  if (totalWarnings > 0 && totalViolations === 0) {
    console.log(
      'Note: warnings are known, non-blocking engraving risks; run with --strict to fail on them.'
    );
  }
}

process.exit(totalViolations > 0 || (strict && totalWarnings > 0) ? 1 : 0);
