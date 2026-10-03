# Design

## Context

See proposal.md for motivation. The runner currently discovers 123 files, executes 119 at concurrency two, then serially executes four isolated files. It captures a complete phase with spawnSync. Every push to main runs the same exhaustive workflow. The latest actual CI passed 1,395 cases in 43m35s; primary public checks also passed. No full-suite CPU/heap critical-path or safe higher concurrency has been established.

Four direct fixture imports of three registering test modules duplicate approximately 79 case registrations. Round39 also imports registering Round38 fixtures, duplicating another 13 cases per additional Round39 consumer plus its standalone import. The confirmed six-page Brahms loop calls the complete layout fallback seven times (count plus six renders). These are established redundant operations, not reasons to discard the individual musical checks.

## Goals / Non-Goals

**Goals:** Make ordinary feedback proportional to changed behavior; retain explicit complete discovery, independent correctness evidence and truthful progress; eliminate demonstrated duplicate work; permit the coming homepage picker correction to publish without an exhaustive sweep.

**Non-Goals:** Alter musical/engraving/PDF output, add dependencies, raise general concurrency without evidence, clear operator state or change the homepage itself. Scheduled background sweeps and a repository-wide test redesign are deferred.

## Decisions

1. Retain the complete discovery and isolated full plan behind an explicit `npm run test:full`. Normal `npm test` uses an inexpensive declared contract profile and reports its bounded scope. Provide explicit validated focused-file/profile execution. No implicit switch from a missing profile or unknown argument into exhaustive execution.
2. Add a pure, inspectable release planner whose input is the complete changed-path set over the actual pushed range, not merely the last merge commit. The planner declares behavior groups and their checks, unions applicable groups and explicitly accounts for documentation-only changes. Test renames/deletions, mixed changes, missing bases, invalid requests and unmapped paths. Broader shared model/layout/source changes receive their pertinent regression groups; full execution remains a deliberate choice when targeted evidence is insufficient. Do not substitute a pathname count or a blanket engine filename trigger for risk assessment.
3. Ordinary Pages uses the selected release plan plus configured build; retain provenance/PDF checks where their source coupling applies. The actual source/PDF hashes remain unchanged for validation-only/UI-only changes. Provision tools required by the selected checks. Provide deliberate manual full validation independent of routine publishing. Update old workflow string assertions to test the new bounded selection and explicit full behavior, rather than leave incompatible policies in place.
The one-time representative validation for this fixture extraction/page-helper correction is byte-guarded by a small manifest of original/final test and fixture identities. All entries must match the actual before/head range; any later body/fixture change selects affected files unfiltered, and runtime/source coverage overrides representative filters. This is reviewed transformation evidence, not a permanent filename-based reduction.

4. Stream the existing Node child output and report elapsed phase progress without increasing concurrency. Keep nonzero exit, signals, bounded diagnostics and isolation observable. Do not create a new orchestration service or another custom worker runtime.
5. Extract exactly the shared Round37/38/39/41 data declarations into registration-free support modules; consumers use those modules and all original test bodies remain. Round38 is included because Round39 currently imports its registering module transitively. Guard against fixture imports that register test modules. Reuse one owned complete layout for same-profile page loops, while retaining independent source states, cold-generation tests, fresh-options checks and explicit standalone-versus-reuse assertions.
6. Verify selection/runner semantics through cheap disposable cases; exercise representative affected fixture and page checks once, compare declaration/output inventories and measure normal/UI/tooling plans. Use existing full-suite results as historical evidence, not a claim that this new head passed every case. No new local or CI full sweep is authorized for this correction. Primary reviews, then delivers through the existing PR/merge path and verifies selected CI/public output.

## Risks / Trade-offs

- An incomplete changed range conceals coupling → use the pushed before/head range and refuse an unavailable base rather than guessing from HEAD^.
- Profile classification misses an affected behavior → explicit coverage explanations, negative/mixed-path tests and refusal for unmapped implementation paths; the configured build still validates composition.
- Dropped test registrations appear as a performance gain → retain original named-case declarations and compare inventories; document removed duplicate copies separately.
- Reuse hides stale geometry → preserve distinct source/options/tokens and cold-versus-precomputed checks; never reuse across mutation scenarios.
- Output streaming loses failure detail → preserve exit/signal/error context and bounded rolling output while exposing live progress.

## Migration Plan

Implement in the isolated native/test-feedback checkout at 75889ec4. Run focused changed-behavior checks and build, review the exact source and retained test inventory, then merge through a scoped PR. Validate that the new release plan completes without full execution and that current Reference/PDF output remains intact. A scoped revert restores the previous runner/workflow if selection or execution proves faulty; preserve source data and all user state. The homepage picker remains pending until this validation work is usable.

## Delivery reconciliation

The original uncommitted 75889ec4 patch is preserved outside the checkout before delivery. Apply it in an isolated branch from a2d7e0a (accepted No14 Round81), retaining every No14 source/public byte and the latest publication tests. Recompute the one-time transformation’s before/after hashes against this actual range; stale, incomplete or mixed runtime evidence must still disable representative filtering. Declare the newer anchor/relative/written/publication/Source seams explicitly without pulling unrelated historical rounds into them. Review and run the actual selected release plan, verify one configured build and unchanged published vectors/PDF, then obtain primary PR review before merge. The existing No14 deployment remains independent and must not be cancelled. Hosted CI/public delivery remains a separate pending receipt until actually complete.
