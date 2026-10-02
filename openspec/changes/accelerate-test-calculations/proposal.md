# Proposal

## Why

The previous successful mandatory suite spent 24m40s in tests, and the first No14 publication attempt spent 38m21s in its ordinary phase alone. Measured evidence demonstrates repeated complete-score settlement inside page loops and a collision-calculation hotspot; these costs can be reduced while retaining the musical, saved-work and release checks.

## What Changes

- Remove repeated complete-score layout work from legacy migration page loops, using the existing explicit settled-layout APIs with dependency-scoped ownership.
- Pass the already owned settled layout into saved-edit geometry page counting, retaining independent before/after source profiles and identical page/crop fingerprints.
- Optimize the measured numerical collision work only where exact outputs and independent correctness checks remain equivalent.
- Preserve independent fresh-generation comparisons, all existing test cases, full-page SVG parity, stale-state refusal and original-byte preservation.
- Measure representative affected tests and then the complete suite, reporting wall time, CPU/memory context and unchanged coverage rather than promising a universal speedup.
- Develop on a separate branch/worktree while the already merged No14 commit completes its unchanged deployment.

## Capabilities

### New Capabilities

None. This is an equivalent-calculation and tooling refinement; `skip_specs: true` applies.

### Modified Capabilities

None. Existing engraving ownership, studio/saved-state preservation, PDF and release behavior remain the contract.

## Impact

The measured entry points are `scripts/migrate-legacy-candidates.ts`, the `contourPolygonIntersectsBox`/optical-phrase collision path, the already settled `semantic-hand.ts` geometry page count, and their regression tests. The committed investigation is `docs/reports/test-suite-latency-evidence.json`. No source-score repair, typography/geometry redesign, test removal, snapshot repinning, broad concurrency increase, dependency installation or workflow/gate change is included. Existing No14 publication run37067058315 remains on f458b8a; the performance branch is delivered separately after actual verification.
