# Round 58 / PR140 — served musical comparison

## Where and what to compare

**PR140 is merged and now served at `36ede842dc851cd85aeacd8113158bc7cb265d2c`.** Open **<http://100.102.70.49:5175/janko.html#candidates>**, then **Engraving**. A fresh development-studio session initially shows Source despite the Candidates hash; the existing Engraving button exposes the prepared study without changing operator storage. Round 58's title and No. 13 m39 comparison strip then appear near the top (desktop strip top 207px in the disposable browser). Context/options and saved-draft recovery remain expandable, not pre-score alerts.

Compare these three current cards:

- **Control · served bevel / original onset seats** — original No. 13 grouping, including the accidental doubled slot. Its broken original Brahms projection is explicitly refused, not rendered.
- **Refinement A · stable seats / existing bevel** — repaired onset grouping, separating that correction from the shape choice.
- **Refinement B · stable seats / compact bevel** — the same corrected attacks, with shorter, shallower crossing faces and less missing rear contour.

Start with **No. 13 unfolded 38–40, focus 39**: at tick3384 the upper **4** head and stem are at **254.22pt**, rather than control **259.68pt**; tick3360 is corrected too. The three simultaneous pairs now retain one **5.46pt** clearance slot rather than making the first pair appear extra late. This is still modest within-onset spread, not perfect horizontal coincidence. The accepted source evidence retains fourteen written events/72ticks and independent LH24/48 branches; coordinates do not establish perceptual acceptance.

Then inspect **ONE Brahms passage: unfolded64–67 / written35–38, second ending**, with **detail65–66 / written36–37**. The context contains complete systems **61–64 and65–68**; context and detail are two presentations of that passage, not extra examples:

- At12336, held RH dotted-quarter **3a** / owner899 contrasts with moving **37→29** eighths897→900.
- At12576, LH **32** quarter48 tied onward96 / owner911 contrasts with **32→35** eighths910→912 and their different continuations. Unequal obligations stay separate.
- Equal-value shared **29** heads retain the tie-chain owners901 and909. Actual served tie metadata includes901→905,909→913 and911→914; established compatible-unison ±1.30pt stem attachments remain, rather than forcing every stem to a common x.

Brahms has only level1 crossing ports; No. 13 has levels1/2. It is a held/moving contrast, not a dense crossing forest. No weak No. 13 padding or visible Bach crossing card is offered. Bach remains an internal guard; its known default spacing defect is **not fixed** by this activation.

**Remaining reading costs:** rails still have interruptions, repeated faces can compete with whole-gesture scanning, reduced air can weaken depth segregation, and within-onset spread remains. Compactness is a proposal, not proof of a compelling musical reading.

**Visual impact: Candidates affected; Reference unchanged.** No default adoption occurred. This is merged and served, **not operator accepted**. Inspection was real-browser DOM/network and actual inline-SVG geometry, **not pixels**. No screenshots, generated review images, SVG asset dumps, mock renderer or new viewer were made. The earlier [implementation handoff](round58-economical-crossings.md) predates landing; this report supersedes its delivery-status statements only.

## Served evidence and protection

Durable bounded receipts: [round58-activation.json](round58-activation.json).

Fresh inspection identified the deploy at PR138 `d675b81…`, with clean tracked files, existing `.zvec-grep` and ignored `.semantic-candidate.local`. The owned service was active: npm MainPID299986, VitePID300004, cwd `/home/qqp/projects/iso-notation-deploy`, port5175. A local exact-object `git fetch --no-tags <assigned-worktree> 36ede842…` and `git merge --ff-only 36ede842…` advanced only this deploy. Running Vite regenerated through its existing watcher/HMR path; **neither process restarted**. No reset, clean, stash, dependency installation, configuration changes or broad kill occurred.

Post-operation fingerprints matched all **116** saved-state/index-cache/Vite-cache/service-file contents, with no added private cache files. Saved candidate SHA-256 remains `f5624597843926a0b4d8cb97224e19c84adaf3a0a78bcd6a3b9b3849298ea884`. It is still refused for source/model/engine drift, with no candidate SVG; expanding **Saved draft & recovery → Diagnostics & recovery** exposes the genuine refusal. It was not migrated, deleted or activated. The sole error-class card is this saved-state refusal, not a failed Round58 engraving.

No commands touched or synchronized the dirty default root, preserved worktrees/quarantines, authentication/providers/workflow configuration or operator browser storage. Browser actions used a newly owned disposable Chromium profile, removed afterwards. Deploy tracked/index bytes exactly match PR140. This managed worktree's existing ticket modification is retained.

Remote HTTP responses and SHA-256 verification establish:

- Coherent ready/nonstale generation `1200a6cb4722beeb18bd2cd64311036553c102dc1a304736f2d55c05bdac5248`, no generation error; published diagnostics0violations/0warnings.
- Served manifest engine identity `c19a3d7f668392abe9c4f6444c30e47bee6b4052ea550d7c50375ca4cf948586` matches `buildIdentity()` of exact clean PR140 deploy.
- Candidates hash `cb923aded72956aca3aba9305af1f4ee71566ff72486d6d54d1c4ab23bee1967`. This includes preserved stale-state diagnostics, hence differs from the state-free build handoff hash.
- **Entire Reference artifact is byte-identical to pre-activation**, hash `e35f9cadd197d50d1f2d3249b2cb128d5f265e8b39582ac2fc784489dfb0d4ae`, including its2Bach/6Brahms inline page SVGs. Local and remotely downloaded canonical PDF both remain `43e0078eae668385e94f40adf0654fe4683c570574d173310323d0e52f073c97`. No PDF export occurred.
- Three offered cards, seven contextual/detail windows plus three comparison-strip macros: **10 candidate SVGs**. Control offers No. 13 only; A/B each offer No. 13, Brahms context and Brahms detail. Actual compact polygons are closed black owning-rail contours, not labels alone: representative No. 13 and both Brahms contacts measure **2.00pt aperture,0.55pt air per side around0.90pt stems,1.20pt shoulders,1.08pt neck (60%)**. A measures2.70pt/0.90pt/1.60pt/approximately0.76pt. Source/owner/depth guarantees reuse the accepted implementation evidence.
- Final disposable-browser check completed **43 assertions**, including actual paper visibility after Engraving, contextual bounds/systems, seats/tie metadata/depth levels, refusals, Reference navigation/Brahms picker, single-step zoom, keyboard reset, mobile390×844 fit and reload. No JS exception or failed studio request; existing `/favicon.ico`404 remains. No browser engraving/linter/score module was fetched. These checks are not pixel/artistic acceptance.

## Commands and elapsed evidence

**No source changes were needed. No tests, suites, strict lint, build or PDF regeneration were rerun.** Reused approved verification: final `npm test`1296passed/2030s; strict4.65s; build18.19s; focused23/23 and studio/linter137/137; independent exact-base six-score/Round57/PDF identity46.76s. These are earlier accepted results, not newly executed gates.

| Activation/readiness check | Result | Elapsed |
|---|---|---:|
|Local fetch + deploy `merge --ff-only`|exact PR140 activated, no restart|0.179s|
|Last watched change → coherent publication (server timestamps)|ready/nonstale|15.552s|
|`node --import tsx /tmp/iso-pr140-activation/identity.mts` (cwd deploy)|served engine/artifact/PDF/commit identity passed|0.781s wall /0.178s probe|
|`node /tmp/iso-pr140-activation/browser.mjs` (final)|43/43 passed; desktop/mobile, actual inline SVG|4.671s wall /4.369s probe|
|`python3 /tmp/iso-pr140-activation/geometry-check.py`|six actual serialized port comparisons passed|0.034s|
|Post-operation preservation fingerprint|116 unchanged; same owned service/PIDs|0.206s|

Earlier browser-probe attempts are not passed verification: one syntax error before launch (0.073s); overly strict coincident-unison-stem expectation (6.277s); collapsed-text/ancestor-details assertions (5.603/5.604s); and a cold module-loading race invalidating early visibility checks (5.281s). The final probe waits for document completion, uses established unison attachments, and expands existing nested recovery details. No production edit or test loop was needed.

Only new durable report files in the assigned worktree are `docs/reports/round58-activation.md` and `.json`, left **uncommitted**. Live deploy stays at exact merged PR140 without these added handoff files.
