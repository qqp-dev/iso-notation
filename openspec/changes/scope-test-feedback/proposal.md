# Proposal

## Why

The latest publication passed 1,395 tests but spent 43m35s in the test step; every ordinary homepage correction currently repeats that exhaustive gate. The operator requests useful, bounded feedback first, with exhaustive testing reserved for broad behavioral risk rather than automatic deployment.

## What Changes

- **BREAKING:** Make the normal test command report bounded coverage rather than imply exhaustive coverage; retain the complete discovered suite under an explicit full command.
- Select release checks from actual changed areas and their dependencies, explaining coverage and refusing unaccounted changes instead of silently calling a small selection comprehensive.
- Stream child output and elapsed phase progress rather than buffering the whole ordinary phase.
- Extract shared historical fixture declarations, including their transitive fixture dependencies, from registering test modules and eliminate repeated same-owner layout work in tests without losing original cases or independent comparisons.
- Reconcile the deployment/test contracts and document when the complete sweep is useful: broad model/layout/import changes, widespread unexplained regressions or an explicitly chosen integration checkpoint.
- Verify this tooling correction with focused planner/runner/fixture checks and the configured build, not another full suite.

## Capabilities

### New Capabilities

- `validation-feedback`: bounded, explainable validation commands and deployment coverage, explicit exhaustive execution, live progress and truthful retained coverage.

### Modified Capabilities

None. Musical model, engraving, saved-state and vector PDF contracts remain unchanged.

## Impact

`scripts/run-tests.mjs`, test-selection helpers, `package.json`, `.github/workflows/deploy.yml`, the workflow assertions in `test/public-release.test.ts`, shared historical fixture consumers, affected page loops and testing documentation. No dependency installation, general concurrency increase, source/engine/style/PDF/homepage change or snapshot repinning. Existing stopped work, services and operator state remain preserved. This supersedes the previous calculation-only change's unchanged-gate constraint for this new authorized scope.
