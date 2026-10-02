# Design

## Context

See proposal.md for the motivation and `docs/reports/test-suite-latency-evidence.json` for measured evidence. A disposable six-page Brahms diagnostic used seven full layout solves in the current page loop and one solve through existing settlement APIs, with all six SVG strings identical. One existing two-fresh-generation test spent 35.22% of sampled main-thread self time in polygon/box intersection and 8.47% in garbage collection; these are bounded observations, not whole-suite attribution. Source base is f458b8a214f57223a826e17b42be98bcb6b8a909.

## Goals / Non-Goals

**Goals:** Reduce necessary calculation at valid score/options/tokens/query scopes, make the existing complete suite measurably faster, and retain all independent correctness witnesses.

**Non-Goals:** Change musical sources, contour taste, candidate search/selection, accepted layouts, SVG hashes, PDF bytes, test inventory, full-suite release gates, system dependencies or runner concurrency. No whole-page cache is introduced to bypass fresh-generation coverage. Existing operator state and historical services are untouched.

## Decisions

1. Settle each migration source/profile once per independent engine and render every page from that layout. Old and new engines still render independently. The original authenticated history remains verified by its own original engine/verifier; retain compatibility with that engine's existing public APIs. Never import the new renderer into the old proof. Use disposable generated histories only during tests.
   The same dependency ownership applies to saved-edit `geometry()`: its page/crop fingerprints already use one exact layout, and page counting must consume that same layout instead of settling the same profile again. Before and after musical states still settle independently. Do not change its fingerprints, public behavior or source/history handling.
2. Optimize the measured contour intersection arithmetic/allocation without changing polygon truth, containment, epsilon conventions, source admission, candidate count/order, curve body/taper or numeric ranking. Prefer local prepared numeric data and exact cheap rejection over a global cache. A proposal that cannot retain identical output is rejected from this pass.
3. Preserve two independent cold generations for determinism, direct-versus-prepared parity, fresh changed-score/options/tokens settlement, HMR invalidation, every historical/No14 page witness, migration comment-only acceptance and real-ink rejection, and original bytes. Add meaningful intersection boundary/degeneracy and reuse-ownership checks where existing coverage leaves a gap; do not write tests that merely duplicate implementation.
4. Measure actual affected cold workloads at the same head/runtime and record repeat order, solve counts, SVG/diagnostic identities, wall/user/system time and memory. Keep the existing CI timing as a separate hosted baseline. One complete optimized suite is justified by the shared numeric path; do not repeat it without a new failure/change or unresolved concern.
   The migration/collision full suite was already running when the additional existing-owner page-count call was identified. Leave it running without source edits. After it completes, verify the one-argument page-count change with focused independent-ownership/saved-edit checks and affected configured checks, and label the full-suite timing honestly as preceding that final refinement. The unchanged mandatory CI then validates the complete final source head.
5. Use the isolated native/test-performance worktree. Primary monitors/verifies No14 deployment separately. Develop and review the performance result without merging into main or restarting existing services before No14's pending deployment is verified. Then deliver through the existing PR/merge and unchanged mandatory CI path.

## Risks / Trade-offs

- Stale or cross-profile settlement reuse → bind reuse to the exact immutable source/options/tokens owner; preserve meaningful fresh-change tests.
- Floating-point or degenerate-polygon drift → compare against an independent original implementation, including touching edges/corners, containment, reversed order and meaningful output witnesses; preserve existing tolerance behavior.
- Test timing distorted by parallel host work or instrumentation → use controlled local before/after workloads and disclose runtime/load/profiling caveats; report CI separately.
- Unsupported historical engine API → retain original engine ownership and compatibility; inspect original API before changing its capture loop.
- A local hotspot improvement fails to shorten the complete suite → report actual results and retained profile evidence, without claiming a suite speedup from a microbenchmark.

## Migration Plan

Implement and test only in the isolated worktree. Retain public assets byte-for-byte and verify complete Reference/selected PDF identities. Prepare a scoped PR after primary review; merge only after the current No14 deployment completes and public verification passes. Revert the scoped equivalent-calculation commit if a real regression appears; do not alter saved work, source data or service configuration.
