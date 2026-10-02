# No14 rendering performance — exact-output implementation

Measured 2026-10-02 in `/tmp/iso-no14-practice-20261001`, preserving its existing unlanded work on `native/no14-practice-sheet`. This implements only OpenSpec tasks5.1–5.3. Source meaning, candidate family/order/costs, sampling, clearance, selected routes, defaults and visible output are unchanged. The original cancelled managed study remains stopped.

The optimization is the shared normal calculation path, with no special performance profile, score override or reduced-quality mode. It remains unlanded code, distinct from adopting any notation style or changing a default.

The complete existing four-card written64 generation now takes **52.879s instead of712.435s:13.47× faster,92.58% less elapsed time**. It invokes the actual existing `generatePreparedStudio`, not a page cache or reduced specimen. All52candidate SVGs and11Reference SVGs are byte-identical, as are both complete HTML artifacts. Model/profile/page/lint facts, canonical revisions, exact written-to-performed reconstruction and generation identity are unchanged. This is one normal final generation, without inspector/coverage/allocation sampling or parallel child QA.

Primary independent verification passed on the retained generation: all SVG bytes, diagnostic HTML, all four profile badges/page/lint states, canonical revisions and status excluding elapsed lint time. [Independent evidence](/tmp/iso-no14-performance-bm1lo1y4/final-independent-verification.json). The old No43 source-expression fixture retains its five known diagnostics (two dots/three ties); those are not introduced or suppressed by this pass. Canonical Bach remains zero violations/warnings.

## Measurement and identities

| Measurement | Recorded baseline | Optimized result |
|---|---:|---:|
| Complete four-card prepared generation |712.435s|52.879s|
| Candidate phase |Not separately used for the speed claim|48.390s|
| Configuration / Reference / primary-status lint |Not separately used for the speed claim|1.635s /2.696s /0.127s|
| Representative M complete solves |3|1|
| Final four-card No14 complete solves |Baseline M establishes3 per card; no baseline full-call trace claimed|4, one per card|
| First-four-bar estimated temporary allocations |5,779.41MiB|690.66MiB,88.05% less|

The earlier fresh representative-M run took19.307s versus the recorded156.540s and retained all13SVGs exactly, but overlapped tests and preceded the final retained-buffer change. It is preliminary timing evidence. In the final uncontended generation, the complete M card phase spans14.607s between its solve entry and the following card's solve entry; it is warm within the four-card run, rather than an independent cold benchmark. The complete four-card result is the primary speed evidence.

Normal full-generation user CPU62.421s and system CPU0.862s include runtime work; CPU time can exceed wall time. Peak process RSS is693.14MiB. No same-scope baseline full-generation RSS was recorded, so no peak-memory improvement is claimed. Allocation quantities are separate32KiB sampling estimates of cumulative temporary churn on one actual four-bar system, not simultaneous RAM use or a whole-score allocation total.

Frozen baseline: `/tmp/iso-no14-written-curves-pedals-20261002-qjqap98m/`. Final evidence: `/tmp/iso-no14-performance-opt-20261002-mpm3lk5e/`, including [complete generation](/tmp/iso-no14-performance-opt-20261002-mpm3lk5e/generation.json), [normal benchmark and profile/model/page results](/tmp/iso-no14-performance-opt-20261002-mpm3lk5e/full-generation-result.json), `benchmark-four.mts`, `full-generation.log`, `representative-m-result.json`, preserved original numeric kernels, differential results, final CPU/allocation samples and test/build logs. No new service or PDF was created.

Generation remains`8653f22b9be646ba39e32a0a4cafc847439b589fe0ec04a4a5e79cb24f98336a`. Candidates HTML remains`4b88b08b496e1c13cea6fa4c9cf084c9897a513fdcfa9f8af51e2c4bfa146de6`; Reference HTML remains`d8f74335fe0eccf9a3d97cd6c7d3df2c5993a0cc9f64d03531933acf46045343`. Engine code identity changes from`d88b591dc2e3b04bf34afded5c8f2f6f0d0dd956fccfb432010149c7df1f2eaa` to`564d8c1d6d3da07138694641e5fdf28b8c77cf90490463334439686413481464`. Every written model retains`960bf3aa0e86a851f70842f056955c274567b994758338db5ca5ebbebbde4022`, and all four profile hashes remain pinned to their earlier counterparts.

## Equivalent computation changes

`elements/expressions.ts` retains the exact32-step cubic inversion and129samples per ribbon edge. It prepares one exact flat polygon per contour instead of reconstructing258two-number point objects per obstacle. A WeakMap entry checks all14sampling scalars against a copied snapshot before reuse, including optional controls, taper and chord alignment. Scalar mutation invalidates the polygon even at the same object identity. Independent contours keep independent data.

The four original Sutherland–Hodgman clipping passes retain their vertex order, arithmetic and positive-area threshold`1e-9`. Two private flat buffers reuse backing capacity with explicit occupied lengths; unused old tails do not participate. Stroke/pedal-glyph polygon queries retain their existing path. No query is replaced with an enclosure or coarser sampling.

`optical-phrases.ts` caches only exact inversion results whose x controls/queryx are identical, locally within one candidate factory. All original side/x/axis/shoulder/bias/crown loops, obstacle order and five samples per obstacle remain. Complete bounds/query geometry is constructed before rejection, but final path strings are created only for surviving candidates. Four literal first-system candidate pools retain all24ordered results with identical costs, contours and SVG hashes.

`engine.ts`, `linter.ts` and `studio.ts` let candidate lint and page count consume the settled layout already used for pages/crops. New reuse validates exact source-object/model content, resolved options/tokens, array completeness and system identities; array length alone is not treated as freshness proof. Source/profile/token mutations or foreign/copied arrays fail the binding. Deliberate geometry mutations remain visible to the entire linter rather than silently triggering a fresh solve that hides them. Lint does not mutate the subsequently painted layout. The window-scoped prepared comparison branch retains its separate audit and makes no whole-score solve. Canonical Reference machinery remains unchanged apart from the equivalent common query kernel.

## Focused verification and remaining cost

Final independent numeric/boundary/mutation and literal-pool tests passed2checks in2.67s. The preserved-kernel differential run covers21,888rectangle queries and4,128slices; maintained tests additionally interleave independent contours, scalar reset and cloned objects. The complete-layout source/profile/token/array freshness, equal diagnostics/pages and intentional escaped-tip test passed77.92s during the initial contended test run. Its runtime behavior remains covered by the final independent numeric mutation checks and byte-identical full-generation diagnostics. The initial scoped-studio counting assertion accidentally included configuration-time layout; moving configuration outside the observer corrected the test, with the final studio check passing18.24s. It proves one full solve for the genuine-page candidate and zero for its containing-system counterpart.

Canonical Bach/optical/repeat mutation checks passed3tests in2.31s. Existing coupled source-expression coverage passed8tests in22.73s, including source-side constraints, No14 source/voice/return clocks, pedal continuations/gaps/notches, page/crop admission and the retained No43 findings. Build passed after correcting an over-narrowing TypeScript predicate signature; Vite12.07s plus compiler/practice packaging. Existing chunk/externalization/plugin-timing warnings remain. No automatic full suite or PDF regeneration was run.

A separate final first-system CPU sample at1ms took0.586s (1,327samples). Optical candidate construction remains72.6% inclusive; exact polygon clipping32.5% self; garbage collection9.4% self. These are short, cold, nested sampling estimates—not additive shares or a full-score CPU attribution. Remaining allocation is principally temporary slice-result arrays, candidate-loop objects/iterators and prepared polygon/buffer storage. Painting after settled geometry is still inexpensive. No candidate search reduction, parallel/GPU work or pagination-translation shortcut was attempted.

**Visual impact: not affected by this performance pass**, proven by exact complete-artifact/SVG equality, not artistic acceptance. Existing5175/5182/5183/5184 services and earlier PDFs stay intact;5184 continues serving the original frozen review, not newly activated engine code. Both pedal glyphs and the current repeat treatment are rejected/unselected design evidence; above/below slur choice, repeat presentation/room and expression/page hierarchy remain for joint design. The selected written64 PDF remains task3.6, not produced here. All implementation edits remain uncommitted/unlanded. Cached start/end Git checks use no remote refresh; no upstream is configured and remote freshness remains unknown.
