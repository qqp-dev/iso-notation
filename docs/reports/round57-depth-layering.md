# Round 57 — candidate-only depth layering handoff

## Status and visual scope

Implementation is uncommitted in the assigned managed worktree. It is **not merged, not served, and not operator accepted**. The PR137 deploy was not changed; no manual development studio server was started. The existing prepared-HMR test alone used and stopped its disposable test server. Activation remains the authorized landing workflow’s responsibility after the authorized composed verification and landing. No single clean `npm test` invocation is claimed.

**Visual impact: affected Candidates; Reference unchanged.** Future studio cue: <http://100.102.70.49:5175/janko.html#candidates>, Round 57, Engraving, compare **Control · flat G apertures**, **Refinement · beveled recession ports**, and **Refinement · profiled dive and return**. Reference cue: <http://100.102.70.49:5175/janko.html#reference>. These URLs currently serve the existing deployment, not this unlanded study.

No browser pixels were available to this tool session. Real-engine inline SVG strings, containing-system geometry, source identities, mathematical lint, physical queries and production studio markup were inspected/tested. No screenshots, generated review SVG/image files, mock renderer or new viewer were made. Consequently this is not a claim that the examples are perceptually compelling or musically/visually accepted. The operator is not being assigned routine defect discovery: the routine geometric/semantic critique below is the implementer’s, with the pixel limitation explicit.

## Small curated study

The same immutable No. 13 source and the same provisional performing-hand assignments are used throughout; no composer fingering is invented. Every candidate retains direct RH-up / LH-down stems, source voices, pitch/register, onset columns and independent values.

1. **38–40, with unfolded 39 comparison macro:** the production containing system is exactly 38–40 (system index 12). Eight owning rail records / twelve level-specific ports include entry, crossing-order reversal, final eighth and following phrase/fp. Upper.0 stems are foreground at 3288/3312, upper.1 at 3360, upper.0 again at 3384/3408. At 39, all fourteen written events occupy 3384–3456, exactly 72 ticks. One LH **3b** attack retains distinct eighth/quarter 24/48-tick branches; final LH **44** retains both source owners. No duplicated sounding event or omitted voice/value.
2. **26–28, focus 27:** production containing system exactly 26–28 (index 8). Two rail records / two level-specific ports: upper.0 held-stream stem at 2304 passes in front of both foreign levels. Approach and exit remain visible in context.
3. **9–11, focus 10:** validated complete-system reuse shows containing systems **7–9 and 10–13** (indices 2/3), rather than truncating the approach or next gesture. The second system has two records / two level-specific ports, upper.1 moving stream in front at 864. This contrasts the foreground relationship at 27.
4. **Bach 13–14:** temporal guard for LH 6926 / RH 26. There are no depth ports; the grouped beam pieces are byte-identical to flat G, including unchanged geometry and ownership. No full-stem-envelope spreading or changed onset/head seats. This is not a claim that the incumbent apparent-association defect was perceptually repaired.

## Actual construction and costs

- **Flat control:** existing G’s 4.4pt polygon apertures, unchanged. It is a historical option control through today’s engine, not an exact older revision. Full stems stay in front; visible rail scanning is interrupted.
- **Beveled ports:** actual foreground stroke silhouette plus 0.90pt air per side. In these passages, 0.90pt stems yield **2.70pt** apertures. Paired **1.60pt** shoulders taper the owning rail to 42% thickness (1.80pt → approximately 0.76pt). They are integrated polygon faces, not detached caps/flags/cuts or shadows.
- **Dive/return:** same 2.70pt apertures, paired **3.40pt** shoulders, actual route-plane displacement **0.85pt away from the owning heads**, with 75% recession thickness (approximately 1.35pt). Entry, hidden continuation and return derive from one route. This is a local profile added to the existing affine beam, not a claim that all face slopes are traditional straight-beam slopes; the source beam’s slope constraint remains unchanged. No arbitrary camera distortion of heads or values.
- Both profiles are black-only (`#111111`); no grayscale is needed to communicate their silhouette. Hidden polygons are retained but **never painted**, with explicit actual foreground stem ID/owners/geometry. Painted polygons alone drive SVG, physical point/box queries, inventory and complete bounds.
- No horizontal widening or head/onset reseating relative to G. Admitted production staff width is **543.48pt** for the cited No. 13 systems. Ordinary page/system admission is reused, not a new pagination claim. Visible scanning still has interruptions, and dive adds directional bends: neither candidate is labelled continuous visible ink or a canonical winner.
- The geometry probe found 38–40 and 26–28 complete vertical bounds unchanged from control. The 9–11 containing-system frame can differ slightly (the bevel probe’s system-10 top was 2.67pt higher); no head/time reseating was detected. The caption/presentation preserves whole containing systems rather than making cropped ink look like pages.

Stems have primitive priority over foreign rails, **not a permanent whole-voice depth plane**. There is no whole-voice ordering graph or universal 3D planner. Profile construction refuses unsupported shared-carrier/bent-contour combinations, overlapping ports, loss of own joins and unusably short remnants/faces. Those are genuine generation errors, not silent fallbacks or operator trade-offs.

## Engineering and source fidelity

`src/render/janko/depth-profile.ts` constructs owning route/port records and actual affine-profile polygons. `beam-scene.ts` uses its existing serializer and physical polygon queries. `ink-scene.ts` retains the hidden records and actual stem partners. `engine.ts` includes profiled rails in complete ink bounds even without the optional gesture evidence switch. `linter.ts` adds candidate-gated route integrity/clearance checks (original owners/levels, matched visible/hidden continuation, whole actual foreground, air, own attachments, head enclosure protection, missing/orphan faces and short remnants). `types.ts` adds only optional candidate `depthProfile`; defaults are untouched.

`candidates.ts` parks **ROUND_56_METADATA / ROUND_56_CANDIDATES**, preserving all seven implemented alternatives, control and rejected representative evidence. Historical trade-off tests explicitly import that registry. The current registry contains only flat/beveled/dive with complete-system windows. No template/UI redesign; `janko.html` and `public/janko.html` remain byte-identical and unchanged. Saved stale candidates were not migrated, overwritten, deleted or activated; existing refusal paths remain exercised by retained tests.

No score builder, source data, canonical options/tokens or public PDF changed. Source/tie protections and No. 30 incoming 96/24 obligations, No. 14 lower/wider branches/expression and displayed/folded ≥78 upper-extension rule remain covered by retained suites, without exemptions or pin changes. Exact independently imported PR137/current canonical source/options/tokens and every Bach **2-page** / Brahms **6-page** SVG are identical: [identity receipt](round57-pr137-identity.json). The public PDF is byte-identical to the separate PR137 archive; the existing semantic-freshness test also passed in the ordinary suite. No `npm run pdf` or public PDF regeneration was performed.

## Verification receipts

All selected files used committed `.architect/test-runner.json`’s `node-tsx-test` profile: `node --import tsx --test <test/*.test.ts>`. Outer timeouts were chosen from observed runtimes. Missing worktree dependencies initially prevented a 0.13s test attempt; a worktree-local ignored symlink to existing dependencies was created without modifying them.

| Command / evidence | Outcome | Elapsed |
|---|---|---:|
| Selected `janko-depth-profiles.test.ts` + `janko-studio.test.ts` | 57/57 pass; full current studio markup/real SVG paths | 123.06s |
| Selected `janko-handedness-tradeoffs.test.ts` | 12/12 pass; historical seven-alternative/source/tie evidence retained | 9.30s |
| Selected `janko-linter.test.ts` | 71/71 pass, including deliberately corrupted depth routes | 41.45s |
| Selected `janko-round35.test.ts` | 14/14 pass after retaining named checks and historical registry floor, not freezing live length | 11.30s |
| Independent PR137/current identity probe | exact source/options/tokens/all pages/PDF identity | 15.67s wall / 15.19s probe |
| Initial final build | type narrowing defect found, fixed before full tests | 2.25s |
| `npm run build` after fix | pass; standard >500kB chunk and plugin timing notices | 17.51s |
| `npm run lint:engraving -- --strict` | pass; zero violations/warnings, six existing Brahms informational rest-provenance notes | 4.59s |
| `npm test`, attempt 1 | ordinary 1186/1187; obsolete Round35 live catalog length 39 vs 40 failed; no exclusive suites reached | 1248.25s |
| `npm test`, attempt 2 | ordinary 1186/1187; migration child hit existing 180s cap; no exclusive suites reached | 1417.72s |
| Selected `active-score-release.test.ts`, 180s cap | reproduces timeout; all other assertions passed | 278.45s |
| Selected `active-score-release.test.ts`, authorized 300s cap | 6/6 pass; real migration parity/refusal test 342.40s total | 374.82s |
| `npm test`, attempt 3 | ordinary **1187/1187 pass**; first exclusive Brahms file 16/17, existing CPU <3000ms guard measured 3670ms; later exclusives not reached | 1556.62s |
| Passive canonical CPU comparison | PR137 4772/4052ms vs current 4554/4141ms CPU; all 0 violations/warnings | baseline also exceeds 3000ms |
| Selected `brahms-engraving.test.ts`, authorized 6000ms CPU budget | **17/17 pass**, unchanged CPU measurement and musical assertions | 16.20s |
| Selected `janko-linter.test.ts`, delivered source | **71/71 pass**, including depth defects | 54.32s |
| Selected `janko-prepared-hmr.test.ts` | **7/7 pass**, real disposable Vite/protocol; existing notices only | 22.94s |
| Selected `semantic-hand.test.ts` | **8/8 pass**, real guarded edits/stale-history refusal; unchanged 120s caps | 425.13s |
| `npm test`, attempt 4 (already active before revision 6 arrived) | **interrupted/nonzero** ordinary phase: 307 pass, 0 assertion failures, 69 cancelled; no exclusives reached | 598.75s |
| Final delivered-state `npm run build` | **pass**, TypeScript + real prepared studio + practice; existing large-chunk/plugin timing notices | **20.73s** |

**Final verification: complete by assignment revision 6’s authorized evidence composition, not by a single clean `npm test`.** The complete ordinary receipt is **96 files / 1187 passed tests**, 1540.115s, from attempt 3 on the delivered production/ordinary-test state. The four complete current exclusive selections add **103 passed tests** (17 + 71 + 7 + 8), covering **all 100 discovered files / 1290 tests** with no remaining file/assertion coverage gap. Only the exclusive Brahms benchmark test budget/comment changed after that ordinary receipt; no production or ordinary-test dependency changed. The linter was reselected after its last production change. Documentation added afterwards is not an engraving/test dependency. Strict/source/PDF identity receipts remain valid because production state is unchanged; the final build covers the delivered test state too.

Revision 6 expressly superseded further whole-suite retries with this composition. The already-launched attempt 4 ended nonzero/cancelled; no owned test invocation remained at the bounded process check. It is **not counted as passed** and is not substituted for the complete ordinary receipt. All prior failed receipts are preserved above; transient raw logs under `/tmp/iso-depth-*.log` are not the durable handoff authority. No runner/profile/workflow change or test deletion was used to obtain coverage.

The authorized migration calibration changes only `test/active-score-release.test.ts`’s existing child cap 180,000→300,000ms and a measured-host comment. Original history/variant/parity/refusal/no-install/bytes assertions, other 120s caps, runner/concurrency, workflow/config and operator processes remain untouched. Revision 5 additionally authorized only `test/brahms-engraving.test.ts`’s CPU guard 3000→6000ms, documenting untouched PR137/current measurements and retaining the guard. No suite-speedup or renderer optimization project was undertaken.

## Existing-studio readiness and handoff limits

Passive HTTP checks returned **200** for the real live studio and published site. The live candidates module still declares **Round 56**: unlanded Round 57 was not silently activated. The final standard build’s verified prepared Candidates/Reference artifacts are respectively `763dad3cd4444c8514170ffe064affd06dccaf31359d6163577f0b539fe339cd` and `e35f9cadd197d50d1f2d3249b2cb128d5f265e8b39582ac2fc784489dfb0d4ae`; standard active-release status is 0 violations / 0 warnings and its PDF digest matches the PR137 receipt. These are existing studio build outputs, not a new review surface or live-served acceptance.

No browser-pixel or operator acceptance claim is added by HTTP availability, production markup, physical lint or hashes. Black-only ordinary-scale scanning remains perceptually uninspected in this headless session. The substantive source/geometry checks are complete; no “all layers solved”, fixed whole-voice depth or canonical-adoption claim is made. Preserve the dirty default checkout and saved stale candidates during authorized landing/activation; the latter must remain refused, not silently migrated. Changes are left uncommitted for BOUNDED delivery.
