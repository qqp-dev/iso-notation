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
  BRAHMS_OP118_NO1_JANKO_OPTIONS,
  BRAHMS_OP118_NO1_JANKO_TOKENS
);

const allReports = [
  { score: 'Bach Goldberg Var 1', report: bachReport },
  { score: 'Brahms Op. 118 No. 1', report: brahmsReport },
];

const totalViolations = bachReport.violations.length + brahmsReport.violations.length;
const totalWarnings = bachReport.warnings.length + brahmsReport.warnings.length;

if (asJson) {
  console.log(
    JSON.stringify(
      {
        bach: bachReport,
        brahms: brahmsReport,
      },
      null,
      2
    )
  );
} else if (quiet) {
  console.log(
    `${totalViolations === 0 ? 'clean' : 'violations'} violations=${totalViolations} warnings=${totalWarnings} ` +
      `systems=${bachReport.stats.systems + brahmsReport.stats.systems} notes=${bachReport.stats.notes + brahmsReport.stats.notes}`
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
