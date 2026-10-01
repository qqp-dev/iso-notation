# Tasks

## 1. Establish bounded source and geometry evidence

- [x] 1.1 Record the supported ordinary-slur syntax boundary and classify existing No13/14/30/43 ledger markers, especially hidden synchronization, grace and compound layout cases, in `docs/reports/restore-source-slurs-and-citations.md`; verify each category against existing importer branches and approved derived facts without counting deferred tokens as musical slur spans.
- [x] 1.2 Capture the current musical identity and default expression/ink evidence, using the mathematical engraving linter first for geometry diagnosis; verify the report distinguishes current root output, historical Round58 and unverified cancelled Round59, and records baseline violations/warnings without changing any of those states.

## 2. Preserve ordinary source slurs and sides

- [x] 2.1 Add optional explicit source side and directional provenance to written/projected phrase records; verify importer tests cover above, below and absent direction while existing undirected records remain compatible, and document the supported attachment syntax in the source-evidence report.
- [x] 2.2 Extend voice-local ordinary-slur pairing and occurrence projection through the shared importer; verify literal tests in `test/schumann-no43-import.test.ts` or `test/janko-schumann-no13.test.ts` cover simultaneous voices, repeats/alternatives, ordinary versus escaped phrasing slurs, and located errors for malformed supported pairs without changing pitches, written values, clocks or hands.
- [x] 2.3 Preserve classification of unsupported grace, hidden synchronization and compound layout constructs; verify focused fixtures show no invented visible slurs and no pairing across unrelated voices or unsupported spans, with remaining omissions recorded precisely in the ledger and report.
- [x] 2.4 Regenerate No13 and other affected derived records only from existing approved hash-guarded inert inputs; verify the required line241 lower.0/lower.1 slurs, endpoints, opposed source sides and repeat occurrences in `test/janko-schumann-no13.test.ts`, retain No13's 784 attacks/4992 ticks and unchanged grace/tie/hand facts, and record per-score expression additions and any input-availability limits. Retain the existing six written/twelve projected escaped phrasing curves as a distinct inventory.
- [x] 2.5 Run focused shared-import regression coverage in the relevant No14/30/43 import and source-relative-expression tests; verify musical identity remains intact and update the report with actual supported changes and deferred coverage rather than certifying all source syntax.

## 3. Render independent source-directed curves

- [x] 3.1 Constrain directed expression placement to the explicit source side in both current presentation modes while retaining existing undirected placement; verify `test/janko-source-expression.test.ts` covers explicit above/below direction against opposite hand preference and collision pressure, with no silent reversal.
- [x] 3.2 Retain separate slur contours through merged-head and written-continuation endpoint resolution; verify the literal No13 tick3384–3432 passage has two source-owned curves at the shared E, unchanged rhythmic obligations and no fabricated quarter beam or extra attack, using real-engine coverage in the No13/source-expression/clarity-geometry tests.
- [x] 3.3 Extend physical expression checks for source-side mismatch and loss of an independently required path; verify damaged-geometry cases in `test/janko-linter.test.ts` detect the new defect classes and clean literal passages retain their actual contour/endpoint ownership.
- [x] 3.4 Verify continuation fragments, complete page/crop bounds and painted contour queries in the relevant source-expression and ink-scene tests; document actual collisions, page changes or inspection limits in the report without masks, measure-specific offsets or aesthetic acceptance inferred from lint.

## 4. Correct citations and retain honest comparison identity

- [x] 4.1 Update existing No13 studio captions/source metadata to identify Schumann Op68No13, Henle HN45 folio15 and printed35–36/internal38–40 with the ending/return-pickup mapping; verify focused studio/source-review tests distinguish internal navigation indices, printed measures and encoding parentage, and do not extrapolate an unverified whole-score map.
- [x] 4.2 Describe corrected-source output distinctly from original Round58 COMPACT B in current comparison metadata and the report; verify historical source/options/engine pins remain preserved and any future comparison uses the same corrected source-expression input on both sides, without importing the cancelled joint planner or activating its cards.
- [x] 4.3 Verify source/prepared/saved identity changes when directed expression facts change, extending focused semantic-cache/studio-session tests if needed; verify stale saves remain retained and activation refuses instead of migrating or deleting them. Document the identity consequence without changing browser storage or caches manually.

## 5. Complete coupled validation and handoff

- [x] 5.1 Run focused changed-behavior and shared-renderer coverage, `npm run lint:engraving -- --strict`, and `npm run build`; verify Bach remains at zero violations, account for Bach/Brahms and affected Schumann default-ink changes, and report warnings, failures and elapsed times. Use `npm test` only for a concrete uncovered coupling or unresolved failure, recording that reason rather than automatically rerunning the historical full suite.
- [x] 5.2 If golden ink changes, run `npm run pdf` and verify `test/janko-pdf.test.ts` semantic/vector contracts, then include the updated Bach download; otherwise verify and record why the canonical PDF remains unchanged. Do not imply that the existing Bach exporter delivers a Schumann PDF.
- [x] 5.3 Inspect the complete No13 gesture, neighboring onsets and affected repertoire through the existing real-engine inline SVG studio when the implemented checkout is legitimately available there; deliver the studio link, score/view and representative printed35–36/internal38–40 cues, distinguish unlanded/merged/served/operator-accepted states, and state unavailable pixel inspection honestly. Do not restart or switch live5175 under this change.
- [x] 5.4 Finish the report with `Visual impact: affected / not affected / uncertain`, actual coverage and remaining source omissions; verify all scoped edits remain uncommitted and unrelated root changes, saved candidates, historical records and cancelled worktree contents remain preserved. No Git delivery, landing or deployment is included.
