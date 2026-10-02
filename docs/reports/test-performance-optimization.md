# Equivalent calculation performance pass

The isolated `native/test-performance` worktree starts at `f458b8a214f57223a826e17b42be98bcb6b8a909`. This pass removes repeated calculation and narrows the measured numerical hotspot while preserving musical meaning, candidate selection, every existing test and the release gates. The independent No14 publication completed in run `37067058315` at 22:41:32 UTC on October 2; primary verified 57/57 actual public checks passing for that source. Primary has reviewed this calculation pass and the separately implemented No14 home-page entry. They share one reviewed release, with separate scoped commits, to avoid duplicate full CI/deployment runs. Publication of the calculation changes is pending the final mandatory CI and actual public verification.

## What changed

Each migration page loop now obtains one settled layout from its own engine and passes that exact score/options/tokens owner's result to page counting and every page painter. The original checkout still verifies its own authenticated history, builds its own score and renders its own complete SVGs; the destination engine is never substituted into that proof. The final page-count receipt uses the already verified canonical page inventory. An original engine without a settlement export keeps the original fallback path. Read-only inspection of historical git object `8fd1e4f3b071fec30496164754c1bce0ab4bfc06` confirms its own layout export and fifth `renderJankoPage` argument; its older three-argument page count is arithmetic-only and safely ignores the extra JavaScript argument.

The ribbon query still uses the same 129 outer and 129 inner samples, four ordered Sutherland–Hodgman clips, crossing interpolation arithmetic and `abs(twiceArea) > 1e-9` test. Its existing scalar-validated, contour-owned preparation now records whether the sampled x coordinates are monotone. Binary searches locate the two boundary runs that can survive each x clip. The first clip keeps the original adjacent vertices needed by the following right crossing and omits the middle vertices strictly outside that next clip. The remaining ordered vertices and crossing endpoints are unchanged. Non-monotone, reversed or non-finite x samples retain the original full scan. Degenerate and tiny-area inputs preserve the original query truth. No candidate family, count, order, cost, ranking, shape, taper or source admission changes.

The independent pre-optimization numerical oracle in `test/support/expression-query-reference.ts` stays untouched. New boundary coverage distinguishes box/ribbon containment from touching, zero-area and below-threshold contacts, and checks overextended controls, reversed/collapsed spans and large coordinates. Deliberate containment, area-threshold and non-monotone-fallback defects are rejected. The existing randomized every-scalar mutation test and exact optical candidate-pool hashes pass. A disposable prototype additionally compared 100,000 ordered clipped polygon arrays against the original loop; this supplements the production-kernel tests, rather than replacing them.

After the complete migration/collision suite finished, semantic-hand comparison received one additional argument: page counting now uses the exact layout already owned by its score/options/tokens and already supplied to its page and crop painters. Before and after scores still settle independently, and the separate after-score lint audit remains. The added solve-owner test covers literal Brahms and Bach assignments, exact resolved profiles, changed page/system identities and source preservation.

## Controlled local measurements

Sequential fresh-process workloads ran on Node `v26.7.0`, the same 16-logical-CPU host and the same source baseline. `/usr/bin/time -v` includes child CPU time for the migration test. No CPU profiler ran during these captures.

| Retained workload | Before | After | Measured reduction |
| --- | ---: | ---: | ---: |
| Existing disposable legacy migration test | 157.110 s | 65.316 s | 58.4% |
| Two complete independent fresh studio generations | 59.580 s | 40.799 s | 31.5% |
| Six-page Brahms original page helper | 7 solves / 7.132 s | one solve per compatible profile | exact solve reduction |
| Brahms saved-edit geometry comparison, final argument reuse | 5 solves / 5.847 s | 3 solves / 3.994 s | 31.7% |
| Bach saved-edit geometry comparison, unchanged arithmetic page count | 3 solves / 0.366 s | 3 solves / 0.358 s | no timing gain claimed |

The migration after measurement isolates the settlement change, before the collision edits; it also includes new fixture-only solve recording and assertions. Canonical plus four independently controlled profiles each solve once in the original and accepting destination engines. The refusing destination solves only its canonical profile before detecting changed ink. All eight-record/four-variant, full-page comparison, serialization-only acceptance, true added-ink refusal and original-byte preservation assertions remain.

The final semantic comparison pair isolates only the existing-owner argument, after the collision changes. Effects and independently rendered before/after inventories are exact: all six Brahms pages and eighteen crops, and both Bach pages and eight crops. Source/profile identities match, and the final owner sequence is `before, after, after` for each score. The complete disposable script also renders those direct inventories; its aggregate wall/CPU/RSS includes that extra work and is recorded separately in the JSON.

Fresh-generation process wall time falls from 60.66 s to 41.15 s; user/system CPU from 74.47/1.51 s to 54.36/1.26 s; peak RSS from 934,888 KiB to 888,672 KiB. All ten independent layout solves remain. Both generation artifacts and deterministic canonical lint facts are identical:

- Candidates: `7f8fd8b9584e6fdd09e00c6c23596181afed72f27c45f81e3f50a98c3a77df43`
- Reference: `bc7f5e1c50572fa2c9c51dc066dc386f24b6ff77b3b2d8ec12b9f98badb2ad75`
- Canonical diagnostic facts: zero violations, zero warnings, eight systems and 550 notes.

These are single before/after workload pairs, with ordinary host/JIT/OS variation. Their exact solve and output witnesses are stronger evidence than extrapolating timing to every test. Migration peak RSS increased from 454,436 to 519,784 KiB despite lower wall/CPU time. Hosted CI uses Node 22 and a different machine/load: the successful No14 run passed 1,390 tests with a 56m58s test step, including 39m10.847s ordinary and 13m45.852s saved-edit phases. Those are separate hosted observations, not controlled local denominators. No full-suite speedup is inferred from the local table or the hosted run.

## Validation and complete-suite measurement

The numerical, contour, phrase-routing and No14 GOLD focused contract run passed 34 tests, including all eleven prior Reference SVG witnesses, four final GOLD pages, accepted-origin pages, rigid system translation and temporary vector-PDF freshness. The final clipping refinement additionally passes the original-kernel, boundary and exact candidate-pool tests, and matches both complete fresh-generation artifacts. Configured TypeScript, strict engraving and production build pass again after the final semantic argument. The final build took 27.11 s wall / 37.58 s user / 6.37 s system CPU, peaking at 1,473,956 KiB RSS; it retained both exact prepared artifact hashes above. TypeScript took 1.15 s and strict engraving 11.66 s. Canonical Bach and No14 have zero violations; the six existing Brahms rest-inference notes and existing build chunk/plugin warnings remain. Validation timings overlap focused tests and are not controlled benchmark pairs.

The complete optimized migration/collision `npm test` run passed all **1,391 tests across 123 files**, with zero failures. Wall time was **25m40.06s**, user/system CPU 3,049.64/89.43 s, and peak RSS 1,415,052 KiB (the largest measured process/child peak, not summed concurrent memory). Ordinary concurrency 2 and the four exclusive phases remain unchanged. This full run precedes the final one-argument existing-owner page-count refinement; focused final saved-edit checks and mandatory later CI cover that boundary. It is not a controlled before/after whole-suite ratio.

On the final source, four focused semantic tests pass: exact independent solve ownership and changed page/system fingerprints, source-linked saved edit with undo and unchanged Reference, authoritative `NO_VISIBLE_EFFECT`, and stale source/engine history refusal with byte-preserving archival. They took 3m00.72s wall, 223.48/6.44 s user/system CPU and 1,002,848 KiB peak RSS. Test-created state is cleaned up. Configured final build/TypeScript/strict checks above follow the same final source identity.

| Phase | Tests passed | Wall time |
| --- | ---: | ---: |
| Ordinary 119 files | 1,272 | 1,023.634 s |
| Brahms exclusive | 17 | 7.706 s |
| Linter exclusive | 87 | 79.730 s |
| HMR exclusive | 7 | 27.551 s |
| Saved-edit exclusive | 8 | 401.304 s |

Independent two-cold-generation, direct/prepared parity, changed-source/options/tokens, HMR invalidation, saved-state refusal, full historical/No14 vectors and PDF freshness checks all pass. Every existing test case remains. The numerical boundary case adds one in the measured full run; the final semantic owner case adds one more, making the final expected inventory 1,392. No second local full suite is scheduled for the final argument reuse; mandatory delivery CI must cover the complete final head.

## Preservation and visual impact

**Visual impact: not affected.** Complete Reference/Candidates bytes, all prior/final GOLD witnesses and deterministic diagnostics remain exact; no pixels were newly judged and no new artistic acceptance is claimed. Source scores, model, data, all tracked public assets, PDFs, dependency manifests, runner and workflow are unchanged. GOLD PDF remains SHA-256 `81c9d35fedb350287b1606c5bb861762574b0687efbe1d72856df3dca0e48a30`; canonical Bach PDF remains `43e0078eae668385e94f40adf0654fe4683c570574d173310323d0e52f073c97`. Freshness checks create only disposable exports.

No operator saved payloads, browser storage, cancelled joint-study files or protected services are touched. Source identity and stale-state refusal remain governed by the existing guards. This pass introduces no page-result cache that could bypass cold-generation or direct/prepared comparisons. The existing investigation in `test-suite-latency-evidence.json` remains historical and unchanged.

Structured baseline/after values, identities, validation and limitations are in `test-performance-optimization.json`. Temporary raw benchmark outputs are outside the checkout at `/tmp/iso-test-performance-evidence-g9xqn7go`. Primary owns task4.2: reviewed PR/merge following the completed No14 public verification, then the unchanged mandatory CI and verification of the performance delivery. The shared release's home-page navigation has affected visual impact; this calculation pass retains the exact sheet/artifact evidence described above.
