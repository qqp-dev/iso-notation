# Tasks

## 1. Bounded and explicit test commands

- [x] 1.1 Implement the inexpensive normal profile, validated focused requests and explicit complete discovery; retain full-plan isolation and coverage. Verify independent file discovery/accounting, unknown/duplicate/missing selection refusal and full-versus-focused labeling with bounded planner tests; document the actual supported commands and full-run risk criteria in docs/test-harness.md.
- [x] 1.2 Stream results and elapsed progress with honest exit/signal/error handling and bounded failure context. Verify live progress, failing children and isolation using disposable short runner cases, without launching the real full suite; document progress behavior and remove the unenforced 900-second assertion.

## 2. Proportional release validation

- [x] 2.1 Implement a pure changed-area release plan and integrate it into Pages using the actual pushed range, with explicit manual full validation. Verify homepage-only, tooling-only, source/model/engraving, mixed, renamed/deleted, unavailable-base and uncovered-path plans and incompatible/invalid requests; update old workflow assertions and testing docs to describe the bounded coverage truthfully.
- [x] 2.2 Run the actual normal and tooling/UI-focused commands once, record selected coverage and elapsed time, and verify the configured build plus unchanged source/public/PDF identities. Document measured results and limitations in a scoped report; no exhaustive local or CI rerun for this correction.

## 3. Remove demonstrated duplicate work

- [x] 3.1 Extract unchanged Round37/38/39/41 shared fixtures, including the Round39-to-Round38 transitive import, into registration-free support modules and switch all fixture consumers. Verify unchanged fixture fingerprints/original named-case declarations and absence of registering test-module imports; run representative affected owner/consumer checks once and document duplicate registrations removed separately from original coverage.
- [x] 3.2 Remove repeated same-owner complete layout from the confirmed unchanged-page test loops while retaining every page witness and independent cold/direct or changed-state comparisons. Verify relevant page hashes and solve ownership with focused checks and record the affected timing; do not repin snapshots or change engine/source/PDF bytes.

## 4. Review and activate

- [ ] 4.1 Primary review exact code/plans, focused receipts, retained case declarations and unchanged musical/public bytes; deliver through the established scoped PR path, verify the selected CI (no automatic full execution), and verify current published studio/source/PDF identity. Record merged/served distinctions and visual impact, preserving root dirt, other worktrees, saved state and all existing services.
