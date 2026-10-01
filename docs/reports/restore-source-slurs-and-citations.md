# Shared source slurs and citations — implementation evidence

## Scope and output state

This section records the initial unlanded implementation checkpoint. The subsequent operator-authorized delivery on current main is recorded at the end of this report; release status is confirmed separately by the PR, Pages workflow and native handoff.

The operator authorized shared/default source-expression correction and truthful No13 citations. This root is distinct from accepted history and currently served Round58. Cancelled Round59 joint-geometry edits, tests and checkpoints remain unlanded in their original worktree; no planner is adopted here. Live5175 is not switched or restarted. Source changes in this report are not automatically served or musically accepted.

## Source support boundary

Use the existing hash-guarded, inert approved bytes for No13/14/30/43; all four inputs are present and match their existing approved hashes. No acquisition, LilyPond execution or Scheme evaluation is involved.

Ordinary note/chord-attached parentheses and explicit above/below attachments are the musical-slur support boundary. Pairing follows independent logical voices and source occurrences, distinct from escaped phrasing slurs and pitch ties. Grace endpoints, intentionally hidden synchronization curves and unsupported compound slur layout remain located omissions. Unsupported source/repeat routes must not be paired with unrelated later markers or given inferred closures.

The pre-change ledgers contain ordinary-parenthesis token entries: No13 220, No14 4, No30 226, No43 54. These are not counts of certified musical curves. No13 contains grace-to-host attachments and a doubled synchronization-layout construct; No30 includes a slur closing only in the first alternative; No43 contains meaningful hidden musical notes separately from its already guarded layout-only carriers. Classify constructs rather than treating every parenthesis or every hidden note alike.

## Baseline mathematical and ink evidence

The canonical strict engraving gate passed with zero violations/warnings across 32 systems / 1679 notes. Its first sandbox invocation was blocked by the tsx IPC pipe; the approved rerun succeeded.

An independent existing-engine audit captured source/musical identities, linter findings and full-page SVG hashes in `/tmp/iso-source-slurs.olGvf3/before.json` (30.21s). SVG hashes are structural evidence, not pixel inspection.

| Score | Pages / systems | Projected phrases | Violations / warnings | Expression violations |
| --- | --- | --- | --- | --- |
| Bach Goldberg Var1 | 2 / 8 | 0 | 0 / 0 | 0 |
| Brahms Op118No1 | 6 / 18 | 0 | 0 / 0 | 0 |
| Schumann No13 | 5 / 19 | 12 | 0 / 0 | 0 |
| Schumann No14 | 6 / 24 | 92 | 0 / 0 | 0 |
| Schumann No30 | 5 / 17 | 4 | 0 / 0 | 0 |
| Schumann No43 | 3 / 11 | 0 | 5 / 0 | 0 |

No43's five pre-existing non-expression violations are baseline findings, not new-source acceptance. No13 already has six written/twelve projected escaped phrasing curves; its facts are not globally phrase-empty.

## Confirmed acceptance passage

Robert Schumann, Album für die Jugend Op68No13, “Mai, lieber Mai, bald bist du wieder da!”. Henle HN45 folio15 is the approved comparison edition; the encoding's unspecified Peters parent is retained separately.

| Internal segment | Source occurrence | Tick interval | Printed citation |
| --- | --- | --- | --- |
| 38 | sourceBar26/pass1 | 3288–3384 | Henle35 |
| 39 | sourceBar27/pass1 | 3384–3456 | first three eighths of Henle36 |
| 40 | sourceBar11/pass2 | 3456–3480 | final eighth of Henle36, fp return pickup |

The source line241 contains independent lower.0 B3 eighth–F-sharp4 eighth–E4 eighth above and lower.1 B3 quarter–E4 eighth below. The final E may remain a shared head; both source paths must survive. RH-up/LH-down and existing hand authority remain fixed.

## Completion evidence

### Import and side provenance

The shared parser now pairs ordinary note/chord-attached parentheses and directed `^(`/`_(` attachments independently from escaped phrasing. Optional `sourceSide` and `sourceSideOrigin` preserve the direction and its own source position through repeat projection; absence of direction remains unspecified. Source sides do not determine hands or stems.

Eight focused literal source tests cover explicit/absent side, concurrent quarter/eighth paths, escaped versus ordinary spans, repeats/alternatives, deferred grace endpoints, hidden/doubled layout constructs, a first-ending-only closure and malformed supported syntax. The new source test file passed. All four approved inputs also imported successfully to temporary audit records; comparison with the baseline showed no changes outside phrases in either musical facts or projected score data.

Grace-to-host spans and doubled synchronization layout remain located omissions instead of pairing their endpoints into unrelated normal slurs. No30's lower first-ending-only closure is projected only where reachable; its second occurrence is explicitly deferred. No43's layout-only endpoint and an unsupported source Slur override remain deferred. These are source-coverage limits, not geometry exceptions.

All four derived records were regenerated by their existing import scripts from the approved inert inputs. The written/projected inventories are:

| Score | Written ordinary / escaped phrasing | Projected ordinary / escaped phrasing | Attacks / ticks |
| --- | --- | --- | --- |
| No13 | 107 / 6 | 214 / 12 | 784 / 4992 |
| No14 | 2 / 62 | 4 / 92 | 574 / 13824 |
| No30 | 113 / 2 | 164 / 4 | 717 / 9216 |
| No43 | 25 / 0 | 34 / 0 | 784 / 5784 |

Comparing all derived fields against the captured baseline shows only `phrases` changed in both facts and projected scores, including No14's optional branch. Pitches, written values, clocks, ties, grace, voices, hands and other expression facts remain identical. The No13 line241 witness test checks both repeat occurrences and separate quarter/eighth source endpoints, retaining six written/twelve projected escaped phrasing curves.

Remaining located source limits include No13 grace-related slurs at lines87/90/96/108 and hidden/doubled synchronization at 225–226; No30 unsupported chord-duration trailing phrasing attachments at 137–150/163–164 and the unreachable second-pass first-ending closure at 356:69; No43's layout-only endpoint at 130:66 and unsupported Slur override at 245–246. These are explicitly deferred source constructs. The importer does not certify arbitrary LilyPond slur controls.

### Renderer, ownership and physical checks

Directed source curves constrain above/below placement in both existing presentation modes. Undirected curves retain their hand preference and permitted-side policy; undirected pre-pass curves retain the historical system-air path. The shared local search can earn further endpoint clearance on its allowed side. It checks filled ribbons and prior-curve crossings as well as sampled centerlines, preventing narrow stems from falling between samples. Reusing occupied intervals at fixed sampled x coordinates limits the cost of restoring many curves.

The initial renderer audit exposed twelve expression collisions in No13 and two in No30, plus two No13 facing-gap failures. The shared legal lift/contour search resolved these without changing a source side, musical event, hand/stem rule, beam planner or passage-specific offset. No musical ink masks or measure exceptions were added; the existing grid-only knockout remains the local expression path's policy.

Real-engine coverage verifies the literal line241 pair above/below through the shared E at ticks3432 and4968. Initial B values stay separate at 24/48 ticks, the shared final E retains its owners, and the quarter receives no eighth beam. A directed ordinary slur also resolves its written tie-continuation head. Linter defect fixtures detect reversed source sides, copied/foreign painted paths, duplicated owners, missing paths and endpoint/continuation mismatch. Continuation, contour occupancy, complete page and crop coverage pass the coupled renderer tests.

The final existing-engine audit took 34.65s (`/tmp/iso-source-slurs.olGvf3/after-lift.json`):

| Score | Pages / systems | Violations / warnings | Expression violations | Full-page SVG change |
| --- | --- | --- | --- | --- |
| Bach | 2 / 8 | 0 / 0 | 0 | unchanged |
| Brahms | 6 / 18 | 0 / 0 | 0 | unchanged |
| No13 | 5 / 19 | 0 / 0 | 0 | affected |
| No14 | 6 / 24 | 0 / 0 | 0 | affected |
| No30 | 5 / 17 | 0 / 0 | 0 | affected |
| No43 | 3 / 11 | 5 / 0 | 0 | affected |

All six musical identity hashes excluding phrases match baseline. No43 retains its baseline two dot collisions and three tie-endpoint-clearance failures; this change neither fixes nor accepts them. Zero mathematical expression violations do not establish visual or musical acceptance.

### Citation and identity

The shared citation record and both No13 studio cards identify Schumann Op68No13, Henle HN45 folio15, printed35–36/internal38–40 with the verified ending/return-pickup relationship. A focused source-review test checks those three occurrence indices and tick boundaries against the actual facts, preserves Peters parentage separately, and ensures both current comparison cards use identical corrected-source windows. No whole-score printed numbering map is inferred.

Current corrected-source controls are explicitly distinguished from original Round58 COMPACT B and its original pins. No historical source/options/engine record or cancelled Round59 card was changed or adopted.

An isolated identity test changes only a No13 source-side fact and confirms prepared snapshot, static-cache and reviewed build identities change. No13 is not an editable semantic-hand saved score in the current UI. Existing Bach/Brahms saved candidates guard the shared painter's identity; an isolated saved Bach fixture becomes stale after painter drift, refuses replay and remains byte-for-byte preserved. No real saved candidate, browser storage or cache was manually changed.

### Validation and delivery state

- Shared import regressions: six test files passed in 30.22s, covering the new source-slur fixtures, No14/30/43 imports, repeat edges and source-relative expressions. The focused No13 source witness also passed.
- Coupled renderer coverage: five files passed in 58.86s: No13, source expressions, clarity geometry, ink scene and studio session. The updated directed written-continuation case passed separately in 4.64s.
- New linter defect cases passed in 4.18s; isolated source/cache/build identity cases passed in 1.39s; source-review tests passed in 2.70s.
- Final strict engraving gate passed in 6.17s: zero violations/warnings, 32 systems/1679 notes, including canonical Bach.
- The build initially caught a narrowing error in the new citation test; the fixture was corrected. The corrected full build passed in 46.14s. It reported Vite's config-loader import-extension advisory, browser externalization of existing Node fs/path imports, large chunks and prepared-plugin timing; these are disclosed without unrelated configuration changes.
- The actual studio artifact test passed in 34.76s, verifying every declared card/window renders. The final physical ownership check also verifies source-side placement against each resolved head envelope, rather than accepting direction metadata alone. Its damaged-layout cases passed in 4.15s and repertoire/source-side coverage passed in 36.20s; the citation fixture passed again in 1.80s.
- After that final diagnostic change, strict engraving passed again with zero violations/warnings across 32 systems/1679 notes, and the complete build passed in 40.01s with the same disclosed advisories. No renderer ink changed in this diagnostic-only step. Final direct comparisons again confirmed unchanged non-phrase musical fields and canonical Bach PDF bytes.

No automatic full-suite rerun was needed: changed import behavior, shared expression rendering, identity, studio/session and strict canonical engraving were covered directly. No43's unchanged baseline defects remain disclosed.

Bach and Brahms full-page SVG hashes are unchanged, and the canonical Bach PDF bytes match the baseline. No golden ink changed, so no PDF regeneration was performed. The Bach download is not a Schumann export.

**Visual impact: affected.** All four Schumann scores gain source-expression ink; page/system counts are unchanged. Evidence is real-engine vector layout, painted contour queries, lint and complete-page/crop coverage. Pixel inspection of this unlanded change is unavailable: the existing [inline SVG studio](http://100.102.70.49:5175/janko.html#candidates) still serves Round58 from its existing checkout. It was not restarted or switched, and no substitute viewer, screenshot or generated review image was used.

Review cues are Candidates → Schumann Op68No13 → complete score and the printed35–36/internal38–40 window, with neighboring onsets and the return pickup. The corresponding root cards compare shared clarity with pre-pass options using corrected source on both sides; these updated cards are not currently served at live5175. Live output remains Round58; root edits are unlanded/uncommitted, neither merged nor operator-accepted. The old cancelled joint-study worktree, unrelated root edits, saved candidates and historical records were left intact. No Git delivery, deployment or worker action was performed.

## Delivery follow-up on accepted main

The operator subsequently requested bringing the checkout current and explicitly selected “Update, land and publish the slur change.” The source correction was reconciled onto accepted main `62b8132` in an isolated native checkout. The sole merge conflict was the linter test import list; both accepted checks and the new expression check remain. Accepted Round58 geometry, field-scoped expression inclusion and archived controls remain present. Cancelled Round59 work was not imported.

The active Round58 comparison now states that all three cards use corrected source slurs. Its No13 containing-system window and focus strip identify Henle printed35–36/internal38–40; original historical source/options/engine pins remain untouched. The former Round55 cards stay retained for their own rendering options. The built existing-studio artifact contains both independent line241 ordinary paths and the corrected citation.

Current-main pre-landing evidence:

- 80 focused tests passed in 63.88s across the shared importer, No13/source expressions, relative/repeat edges, source review, clarity, accepted depth profiles and economical crossings.
- The damaged-expression fixture passed; source/cache/build identity coverage passed (two tests, 2.09s).
- Both current studio registry/artifact tests passed in 8.34s.
- Strict canonical engraving passed with zero violations/warnings (32 systems/1679 notes, 5.46s).
- Production build passed in 16.89s with the previously disclosed Vite advisories.
- A fresh six-score real-engine audit passed the same expression checks in 33.54s. Bach/Brahms full-page SVG hashes and canonical Bach PDF bytes remain identical; Schumann inventories/page counts and No43's five baseline defects match the initial implementation evidence.

Only source-slur implementation, its tests, change artifacts and this report enter the delivery. Existing instruction/OpenSpec setup edits, retired workflow-file deletions, images and other local work remain preserved separately. Root fast-forward uses the reviewed target content and ordinary Git merge while preserving unrelated files; no reset, clean or stash is involved. The existing live5175 process is unchanged. Publication uses the repository's configured GitHub Pages workflow, including its full test gate; the local 33-minute suite is not redundantly scheduled. Pixel inspection and operator musical acceptance remain distinct from deployment and engineering gates.
