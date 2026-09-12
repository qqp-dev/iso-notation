#!/usr/bin/env node
/**
 * `npm run lint:engraving` — Implementer Visual Linter CLI
 * =======================================================
 *
 * Runs the mathematical engraving linter over the canonical benchmark score
 * (J.S. Bach, Goldberg Variations BWV 988, Variatio 1) and reports every
 * violation in milliseconds — no rasterization, no browser, no eyes required.
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
import { formatLintReport, lintJankoScore } from '../src/render/janko/linter';
import { DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS } from '../src/render/janko/types';

const args = new Set(process.argv.slice(2));
const asJson = args.has('--json');
const strict = args.has('--strict');
const quiet = args.has('--quiet');

const score = buildBachGoldbergVar1Score();
const report = lintJankoScore(score, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else if (quiet) {
  console.log(
    `${report.ok ? 'clean' : 'violations'} violations=${report.stats.violations} warnings=${report.stats.warnings} ` +
      `systems=${report.stats.systems} notes=${report.stats.notes} ms=${report.stats.durationMs}`
  );
} else {
  console.log(formatLintReport(report));
  if (report.warnings.length > 0 && report.ok) {
    console.log(
      '\n  Note: warnings are known, non-blocking engraving risks; run with --strict to fail on them.'
    );
  }
}

process.exit(report.violations.length > 0 || (strict && report.warnings.length > 0) ? 1 : 0);
