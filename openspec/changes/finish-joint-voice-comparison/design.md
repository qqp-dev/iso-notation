# Design

## Context

See proposal.md. Production currently forces engraving and disables Source. Development has a separate two-edition PDF/image viewer. Prepared artifacts already contain the actual candidate SVG. The cancelled Round59 work contains an unfinished pre-ink beam planner and tests; current main includes the later source-slur correction.

## Goals / Non-Goals

Use the existing studio, current source and truthful measure mapping. Preserve the development PDF workflow and its storage. Do not publish private PDFs, overwrite the old worktree or silently adopt candidate options into canonical defaults.

## Decisions

1. Extract the development source viewer behind a development-only dynamic import. A published comparison module uses public Henle metadata and clones the matching prepared candidate window, observing prepared updates. This keeps private PDF endpoints out of the production path and avoids another renderer.
2. Attach score/window metadata to existing prepared figures so comparison cannot accidentally substitute Brahms or unrelated windows. Re-key cloned SVG IDs and internal references when necessary to avoid duplicate document IDs.
3. Integrate only the old planner's scoped source changes into a new native branch. Choose overlap components, span-weighted slopes and outward corridor reservations before rebuilding physical ink. Test permutation/translation invariance, written obligations and painted bounds.
4. Publish two current readings: corrected-source compact control and joint compact reading. Preserve Round58 history. Check source-side slurs in the changed obstacle field; keep ordinary phrasing distinct from pitch ties.

## Risks / Trade-offs

- Public publisher image availability → visible error and direct original-page link; no private PDF fallback.
- Prepared refresh or refusal → replace/remove the ISO comparison from the current matching artifact, never retain mislabeled ink.
- Longer stems from independent corridor reservations → inspect the complete gesture and retain the control comparison; numerical checks do not constitute musician acceptance.

## Migration Plan

Focused tests, strict engraving audit, production build and browser interaction verification precede scoped commit/PR/merge. Verify the actual published page after Pages delivery. Rollback uses the normal release path; unrelated checkout state and live5175 remain intact.
