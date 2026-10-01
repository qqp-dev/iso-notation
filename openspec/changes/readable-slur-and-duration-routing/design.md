# Design

## Context

See proposal.md. Current source slurs use a tapered two-cubic ribbon with symmetric bend/indent, a shared endpoint lift search and greedy source-array placement. The No13 lower.0 slur escapes69.46pt above its owning heads. A bounded geometric search finds local asymmetric fits against music alone but none with all neighboring slurs frozen. Placed rhythm routes and audits account for foreground straight stems, omitting their flags. The shared B's solo quarter terminal and moving eighth terminal currently end at the same height.

## Goals / Non-Goals

Solve all three presentations together using musical owners and settled physical geometry. Keep the accepted direction of travel in the joint alignment, not necessarily every faulty terminal coordinate. No new source facts, hand assignments, head-sharing grammar, musical classifiers or score-specific coordinate exceptions. The cancelled managed worktree stays untouched.

## Decisions

1. Extend the common tapered-span representation with independent control bends and indents, retaining exact legacy serialization when those fields are absent. Filled-ribbon queries, bounds and source-path audits consume the same controls. An asymmetric shape can follow a changing corridor without detaching both endpoints.
2. Generate a bounded set of local, source-constrained candidates for each phrase and choose nonconflicting combinations within interval-overlap components. Stable physical/source ordering and bounded backtracking replace source-array greediness. Endpoint cost measures displacement from the owning head/stem envelope, and shape cost limits avoidable bow/deviation. Plan short and long neighboring slurs together rather than freezing small curves and lifting the long curve past unrelated voices.
3. Fit complete classical flags against actual foreign rail polygons and head/rest envelopes before expression placement. Move the owning tip and regenerate its whole glyph; never cut a flag, paint a fake mask or widen a stem-only port until it erases an unrelated duration level. Retain all written flag counts.
4. Compare shorter and longer bare solo terminals relative to the independent grouped branch using token-derived separation and legal minimum stem visibility. Both variants retain the shared head and all durations; a repaired-phrasing baseline retains the original terminal. Endpoint envelopes use the source branch's actual rhythm geometry, even where its visible head is shared with another source owner. Terminal separation is a design hypothesis to review, not acceptance of either variant.
5. Add ownership-aware defects for complete flag/foreign-rail intersection, lost local phrase attachment and ambiguous unequal-value terminals. Preserve truthful diagnostics for routes that cannot meet constraints. Literal No13 is the primary acceptance passage, with full score semantics and Brahms held/moving cases as guards.
6. Retain Round59 IDs and publish four next-round readings on the existing inline SVG studio: retained aligned control, repaired-phrasing/original B, shorter bare B branch and longer bare B branch. The new routing and terminal rules are explicit candidate options for this review. Canonical defaults and joint alignment adoption remain unchanged pending judgment; retained controls state which routing they retain and do not claim byte-exact old ink.

## Risks / Trade-offs

- Coupled route search grows with overlapping phrases → bounded candidate sets/components, stable pruning and measured full-score runtime; no mandatory full-suite rerun during each edit.
- Clearance can produce an unattractive but legal shape → assess source affiliation, full gestures and SVG geometry separately from linter success; report unavailable pixel inspection and do not claim musician acceptance.
- Generic terminal rules can affect other shared heads → real-score semantic guards, translation/permutation checks and complete bounds/paint agreement; no named-measure exemptions.
- Shared/default changes can affect canonical ink → strict Bach/Brahms audit, golden-ink comparison and PDF regeneration when necessary.

## Migration Plan

Implement and exercise focused changed-behavior tests, then strict canonical audit and production build. Inspect actual inline SVG and Source behavior on an owned preview without switching live5175. Deliver a scoped commit, PR, normal merge and Pages deployment; verify the published artifacts and interactions. Rollback uses the ordinary release path. Preserve unrelated root state and all previous candidate IDs.
