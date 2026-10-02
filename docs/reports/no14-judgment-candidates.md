# No. 14: paired typography and slur silhouette candidates

Section 9 of the root `prepare-schumann-no14-practice-sheet` change is implemented in `/tmp/iso-no14-practice-20261001`. Three packages share one refined automatic route. No typography or whole-sheet route is selected, no defaults or sources change, and no candidate PDF is produced. Task 3.6 remains pending operator selection. The accepted single-rule repeat, long left duration branches and head-adjacent dots remain the controls.

Frozen review: `/tmp/iso-no14-judgment-20261002-rn0g1lis/`. Primary owns activation and browser verification; this implementation never starts or switches services. Existing 5175–5186 outputs, prior PDFs, unrelated edits and the cancelled managed study remain preserved.

## Three complete packages

| Package / exact candidate ID | Dynamics | Pedal text |
| --- | --- | --- |
| A / `no14-judgment-bodoni-auto` | Libre Bodoni Regular Italic, weight 400 | Libre Bodoni Regular, weight 400 |
| B / `no14-judgment-source-serif-auto` | Source Serif 4 Medium Italic, weight 500, optical size 20 | Source Serif 4 Regular |
| C / `no14-judgment-legacy-auto` | Finale Legacy musical dynamics | Finale Maestro Text Regular |

The first two use freely usable text outlines from families curated as companions to the commercial MTF Beethoven/Cadence music families. They do not contain paid MTF music glyphs. C is our deliberate music/text pairing from the free MakeMusic collection, not a claim that Maestro Text was specifically designed as Legacy's companion. All are OFL assets with scoped notices and font versions, hashes, locations and extraction provenance in `licenses/no14-paired-typography.json`. Primary's tentative preference for B is not operator selection.

Each intact dynamic family has one uniform scale giving the actual p ink 6.656 pt total height. Each upright Ped. has 5.805 pt total ink height, with its own spacing and measured outline bounds. Parent-supplied nonzero-fill p area/height² screens are A .2406, B .2519 and C .3016. These screen weight, not visual quality. No erosion, synthetic weight, opacity change, font installation or paid asset acquisition is used.

The full 11-mark alphabet is retained. Genuine text ligatures such as `f_f` and `f_f_f` remain intact. Musical combined glyph mappings use pp E52B, ppp E52A, mp E52C, mf E52D, ff E52F, fff E530, fp E534, sf E536 and sfz E539. The previous opt-in Leland combined-mark map is corrected from the same cached font cmap; its p and f paths and canonical Bravura paths are unchanged. Earlier frozen studios retain their historical bytes. Both source piano marks, parenthesized p and text diminuendo remain distinct source events. Ped. changes only the true press appearance; hold/release, retake, gap and continued-hold semantics remain exact.

## Shared shape rule and actual choices

The new explicit `optical-silhouette` option retains the complete family, full both-side fitting, source endpoint neighborhoods, independent painter/linter admission and bounded search. Body and tip values remain .85 / .22 pt **vertical ribbon widths**; physical normal width depends on inclination. No apex target, measure exception, categorical side preference or forced distribution is added.

The source-steepness allowance is `1 - smoothstep(.36, .55, abs(source pitch rise) / span)`. The trial comfortable weaker outer-tangent magnitude is `(29 - 10 × min(sourceSlope, .36)) × allowance` degrees. Its soft shortfall cost has coefficient .12. A second shared inclination cost is `.06 × (optical rise / span)² × allowance`. The latter is necessary: stronger shoulders alone still retained the opening's early-apex long-tail silhouettes. Actual rounded painted controls provide the tangent check. Steep source geometry earns the allowance; selecting an artificially steeper optical axis cannot evade it.

Existing 1.5 pt physical admission, whole-bow extra air target `clamp(3, span × .05, 6)` pt, four factors 0 / .5 / 1 / 1.5, weak balance deadband .08/coefficient .025, proximity .01 and conditional existing expression-floor maximum .06 remain. Both sides retain representatives within 24 candidates, and combination search stays at 20,000 visits. No extra Cartesian family or page cache is introduced. Exact score-local dependency-checked numerical reuse and cloned returned ink remain the normal calculation path.

All three final profiles choose 17 above / 47 below. That is an observed result, not a target or artistic acceptance. Every chosen curve has zero weak-shoulder surcharge. The opening keeps lower bows but selects the already admitted half-pitch diagonal:

| Source bar | Old S rise → new rise (pt) | Old → new horizontal apex fraction | New start / end outer tangent |
| --- | --- | --- | --- |
| 1 | −17.50 → −8.75 | .3224 → .4072 | +30.29° / −37.47° |
| 2 | −22.50 → −11.25 | .2799 → .3818 | +29.30° / −38.50° |
| 3 | −35.00 → −17.50 | .1944 → .3224 | +26.90° / −41.08° |

Bar 3 still has an early apex, approximately the formerly borderline bar-1 silhouette. Passing this cost is not proof that the operator's swoosh concern is fully solved. The compact opening and full-system context expose that remaining judgment directly.

Upper 14 halves its diagonal to −8.75 pt. Bar 15 changes from lower diagonal to level upper. Liked steep upper 16 retains −50 pt rise, .8729 apex fraction and −53.39° / +16.96° tangents. Bar 58's lower shape remains; 59 becomes level upper. Bar 62 halves its lower diagonal to −12.50 pt. The source phrase 63–64 remains one level upper relationship with clocks 8928–9072 and exact endpoint IDs. The two independent bar-48 shapes retain their directions and contour: RH level upper, LH −5 pt lower. Repeated 80 source ownership remains covered through the performed source.

Ten source bars change lower to upper: 15, 31–35, 38–40 and 60. No contextual interconnection is made a rule. Typography can change packing/absolute page y and hundredth-point rounded controls, so exact cross-font full-page path bytes are not claimed. Four-measure density, expression-placement policy, .65 pt hairpins/holds/releases, notes/stems and source clocks remain fixed. Metadata records every actual page bow, source bar/owners/clocks, outer controls, apex, tangent, old-S comparison and separate health costs; saved literal pool evidence separately labels prepared-context coordinates.

## Native review and checks

Round 66 uses the existing real-engine inline SVG studio. Three identically framed literal bar-1 comparisons come first, followed by one full first-system 1–4 context from B. Additional B-only 1–3, 14–16, 48, 58–59 and 62–64 contexts avoid triplicated geometry review. Complete genuine four-page scores remain accessible in initially closed native details controls. Old T is preserved only on the earlier frozen service; there is no duplicate upper profile or upper comparison strip. Each offered candidate retains exact complete options/model/profile identity for later selected-profile export.

Primary's first browser pass identified a shell issue: a single shared-context panel occupied one grid column. The scoped `.compare-strip-readable > .strip-panel:only-of-type` rule now spans the native grid. `janko.html` and its public mirror remain byte-identical. This changes the shell, not vector geometry; no expensive regeneration is required.

Focused evidence passed:

- Eight new silhouette/typography/UI checks, 4.727 s; five final silhouette/UI checks after test typing fixes, 4.742 s.
- Three existing-linter checks including the new source-tip/foreign-owner/paired-family mutations, canonical Bach zero and retained breathing 48/80/63–64 ownership, 6.376 s.
- Eleven coupled breathing/font/head-dot/written reconstruction/repeat tests, 24.833 s.
- Two independent ribbon-query boundary/scalar-mutation and exact old optical-pool controls, 2.648 s.
- Four existing shell/registry mirror checks, 9.453 s.
- Configured `npm run build` passed, Vite 13.27 s plus compiler/package. Initial compiler errors were confined to new tests and fixed; existing Vite extension/externalization/chunk-size warnings remain. No automatic full suite or candidate PDF export ran.

One uncontended normal `generatePreparedStudio` call took 33.788 s: config 1.607, candidates 29.237, Reference 2.782 and lint .131 s. It made three complete No14 solves; lint/page count/crops reused each settled layout. CPU user/system: 41.590 / .848 s. Earlier 58.668 s nine-card and 52.879 s four-card jobs differ in profiles and contexts; this is not an identical-job speedup claim. No profiling or QA overlapped this normal generation.

Every final profile has four ordered pages, 64 actual source curves, four augmentation dots, 53 true Ped. starts and zero mathematical violations/warnings. Accepted repeat boundaries remain 4608 / 9216 with one .90 pt full-height stroke and two .90 pt-radius dots. Written source is 383 notes / 64 bars / 4 dots; exact performed reconstruction remains 574 / 96 / 8. All 11 Reference SVGs and the complete Reference HTML match the previous frozen output byte for byte.

## Identity and delivery

Generation: `4833dab3e15ff6339fa004ae79a7d637bf5df373cec2dd8aafd75ebd92c722e2`.
Candidate HTML: `da41be4ff28b5f6e79d4537955f01ea19fe44760ac244d082ba8f90549b44684`.
Reference HTML: `d8f74335fe0eccf9a3d97cd6c7d3df2c5993a0cc9f64d03531933acf46045343`.
Final software/shell identity: `6818b687f41aee891a5e9ddc8d2f8a377bd62eb7e72b2164ceea123dabbb5553`.
Computation-time identity before the shell-only full-width correction: `3f0e1ea373ff0eaf162c882c249f0f8b877202704bf7dc6eb650a9d2f52990e0`.
Written model: `960bf3aa0e86a851f70842f056955c274567b994758338db5ca5ebbebbde4022`.
Performed model: `cf0f72017ab3d1eb1c5544186ef6582894d01a0c07916f0719875f8e04db395a`.
Approved source: `42aa471662af4d919f696b03e6b7b5b634a8e1f1310303aa6a92075c9b511533`.

Frozen files include `generate.mts`, `generation.log`, `generation.json`, `metadata.json` and content-addressed HTML. A numeric/string side-label mistake in human metadata was normalized before delivery; actual artifact bytes and source geometry never changed. The shell-only final identity is recorded separately from computation identity and bound into the frozen envelope. Primary service/browser files remain independently owned.

This round changes `optical-phrases.ts`, `types.ts`, `expressions.ts`, `engine.ts`, `linter.ts`, `no14-practice.ts`, `candidates.ts`, `studio.ts`, paired/dynamic/pedal vector elements, mirrored shell CSS, scoped typography notices, three new tests and focused linter mutation coverage. Prior unlanded duration/repeat/PDF/performance changes remain preserved, not newly accepted. Checkout remains uncommitted on `native/no14-practice-sheet`, base `ae47018d243fb0b4ca081c78b9693defe941abb7`; cached Git checks cannot establish remote freshness.

Visual impact: **affected** in the isolated No14 comparison. Mathematical gates and literal/full-page vector evidence establish source/physical consistency, not pixel or artistic acceptance. Primary final browser verification and operator selection are distinct. No default, published output, source reading, printer, Git delivery or old-study activation changes occur.


Primary-served review: [No. 14 paired typography and refined bows](http://100.102.70.49:5187/janko.html#candidates), select Engraving. Detached primary-owned PID 382629 serves the final software/shell envelope. Actual fresh-browser verification passes 219 DOM/vector/HTTP checks with zero JavaScript exceptions. Typography-strip p is 12.44 CSS px and Ped. 10.85; the full-width shared first-system p is 18.28 and Ped. 15.94. Three initially collapsed complete scores contain four ordered genuine pages each, intact font paths, 64 source curves, four augmentation dots and 53 real press starts. Source first-issue 16→17→16 and starter 22/92, zoom/reset and native details controls work. Independent 14-check verification confirms artifact bytes, exact Reference/source identity and protected 5175–5186 generations. Evidence: `browser-result.json`, `primary-verification.json` and `service.json` in the frozen directory. Inspection remains DOM/vector/HTTP, not pixels or artistic acceptance.

Final cached Git-status check passed: branch `native/no14-practice-sheet`, all edits unstaged/uncommitted, no upstream and no ahead/behind information. Remote freshness remains unknown. Existing unlanded files are preserved; no Git delivery occurred. Child implementation turn is complete.
