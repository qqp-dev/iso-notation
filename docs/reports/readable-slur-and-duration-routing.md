# Round60: local phrasing and two shared B treatments

The operator requested a joint design comparison: repair the current No13 phrasing, then try shorter and longer bare quarter stems at the shared B. Neither B variant is selected or musician-accepted by this implementation. The accepted direction of the current joint alignment remains the common baseline.

Review: https://qqp-dev.github.io/iso-notation/janko.html#candidates . Round60 exposes four readings; the Source tab's ISO reading selector reuses their actual prepared inline SVG beside the Henle witness. Schumann Op68 No13, Henle HN45 folio15, printed35–36 maps to internal38–40, including the split ending and fp return pickup. The shared B is at the start of internal39 / printed36; final4 reunites the two LH voices.

| Reading | Phrasing | Quarter B terminal y | Main RH4 flag top y |
| --- | --- | --- | --- |
| Current alignment (`joint-compact`) | Retained Round59 router |190.49|115.85|
| Local phrasing (`local-phrasing`) | Coupled source-local curves |190.49|107.85|
| Shorter bare B (`shared-b-short`) | Coupled source-local curves |185.86|107.85|
| Longer bare B (`shared-b-long`) | Coupled source-local curves |196.26|107.85|

Both B candidates keep one visible head, the independent eighth B–6–4 and quarter B–4 statements, and the compatible shared final4. The shorter branch reduces parallel stem ink but leaves more air to its lower slur where the moving beam occupies the intervening space. The longer branch adds stem ink and lowers the held gesture's slur envelope. These are tradeoffs to judge together.

## Geometry and ownership

All12 source curves remain in the reviewed system, with unchanged source sides, endpoint IDs and clocks. The moving B–6–4 curve's start changes from y105.03 to170.23, close to its shared head at174.49. Its asymmetric controls pass through the changing corridor while neighboring curves are planned together. The three carried pitch ties remain unchanged; these source slurs are not pitch ties.

The router uses bounded candidate pools and stable backtracking within overlapping physical components. It admits against narrow enclosures of actual settled rail polygons, not the empty corners of a whole sloping-rail AABB. An unavailable local combination carries a hard diagnostic. Endpoint envelopes resolve the actual source rhythm branch, including eligible beam levels; shared head ownership does not falsely make the quarter stem own the eighth branch.

Complete standalone classical flags fit before dependent expressions against actual rail polygons and conservative head/rest/glyph envelopes. The whole glyph is regenerated from its owning tip, with no cut flag, decorative connector, mask or enlarged stem port. The literal final RH4 extends8pt to clear both foreign rails. The two-flag hypothetical at that literal pose also clears. New linter defects cover failed local attachment, complete flag/rail admission and the requested shorter/longer terminal distinction.

## Evidence and limits

- 139 focused painter, source, prepared-studio, joint-layout and candidate tests passed in107.49s. A separate35-test source/viewer/route run passed in21.37s; these overlap and are not an additive total.
- Three targeted mathematical-linter defect tests passed in13.87s, including intentional regressions to the historically undetected defects.
- Translation and reversed-source-order guards pass on the literal full containing system. Heads, onsets, notes, beam courses, hands and source durations are preserved. Brahms held/moving and quiet Bach windows pass under both terminal rules.
- Strict canonical engraving audit passed: Bach zero violations/warnings; Brahms retains six existing informational rest notes, with no violations/warnings. Final production build passed (Vite14.08s), retaining existing configuration/chunk warnings.
- Actual Chromium inline-SVG/DOM inspection passed on desktop and mobile: physical Source/Reference/Engraving controls, all four readings, matching prepared/Source paths, independent zoom, loaded Henle image, one final4 flag, stale/wrong-score refusal and preserved development choices. Point-in-fill sampling at .1pt found287 flag/rail overlap samples in the retained reading and zero in each repaired reading. Conservative geometric admission also passes. No screenshots or generated review images were used; human pixel/aesthetic judgment is not claimed.
- The reviewed containing system has zero violations/warnings and zero route refusals in all three repaired readings. Its preparation measured roughly2.7–3.0s in bounded probes. A broader opt-in shorter-B No13 preparation took31.69s for19 systems /228 curve fragments and produced53 violations, zero warnings, including18 local-route refusals elsewhere. This is a bounded passage review, not whole-score routing certification or default readiness. No measure exception hides those failures.

**Visual impact: affected** in Round60 Candidates and the matching Source comparison. Canonical Reference/default/PDF ink remains unchanged: Reference artifact sha256 `d8f74335fe0eccf9a3d97cd6c7d3df2c5993a0cc9f64d03531933acf46045343`, data `a8ff33a8b62dd4f2ae98bc9d120a201b386ac32309c0662625deb08752025948`, PDF `43e0078eae668385e94f40adf0654fe4683c570574d173310323d0e52f073c97`. No PDF regeneration was needed. Candidate artifact sha256 `f8bc0e6ce87ea618f8e1919c44019c196017ce978b9946bad38a9be4ce3a654b`.

## Delivery boundary

This report captures local readiness and owned-preview inspection before Git delivery. The normal scoped PR/merge/Pages path remains required; the native handoff records the actual merge/run, downloaded artifact hashes and published-browser outcome after deployment. Merged code, currently served output and operator acceptance must remain distinct. Neither candidate is accepted by publication. Historical candidate IDs, saved choices, unrelated root edits, the cancelled managed worktree and live5175 are preserved. The local untracked OpenSpec schema configuration is not included in this source change.
