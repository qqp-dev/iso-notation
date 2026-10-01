# PR138 / Round 57 — live activation outcome

## Outcome

PR138 is **merged and now served**, at exact revision **`d675b81efaa738ebc3f1cf1b3166010005e15a38`**, through the existing studio:

**<http://100.102.70.49:5175/janko.html#candidates>** → Engraving → Round 57.

Compare **Control · flat G apertures**, **Refinement · beveled recession ports**, and **Refinement · profiled dive and return**. All three current cards and their three unfolded-39 comparison macros are present. Each card has real inline-SVG No. 13 windows **38–40 (especially 39)**, **26–28 (27)**, **9–11 (10)** and the quiet **Bach 13–14** guard. The 9–11 presentation retains containing systems 7–9 and 10–13; these are contextual windows, not whole-score pages.

**Visual impact: Candidates affected; Reference engraving unchanged.** No candidate became canonical. Performing hands remain provisional; pitch/time/voice/value selection and Reference defaults remain settled. Neither perceptual acceptance nor operator acceptance is claimed. Headless browser checks inspected DOM, network and geometry, **not pixels**; no screenshots or generated review images/viewers were made. Local depth remains primitive stem-front priority, not permanent whole-voice planes; visible scanning remains interrupted.

The older [implementation handoff](round57-depth-layering.md) records its then-unlanded state. This activation report supersedes only that delivery-status statement, not its source/geometry limitations or accepted verification evidence.

## Preservation-first operation

Fresh inspection found `/home/qqp/projects/iso-notation-deploy` at PR137 `643b2366a0d77e00069e2f2e50d9cf39589853be`, clean tracked files, existing untracked `.zvec-grep`, and ignored `.semantic-candidate.local`. The running owned `iso-notation-studio.service` was fingerprinted: npm MainPID **299986**, Vite PID **300004**, actual process cwd the deploy directory, port 5175, persistent-checkout drop-in unchanged.

Before operation, private state was archived outside the checkout at `/tmp/iso-pr138-activation/preserved-private-state.tar`, with pre-operation hashes/status in the same private directory. A local `git fetch --no-tags <assigned-managed-worktree> d675b81…` supplied the missing object; `git merge --ff-only d675b81…` advanced only this clean deploy. No reset, clean, stash, dependency install, service restart, configuration change or broad kill was used. Existing running Vite regenerated through its watcher/HMR path; both PIDs remained in place.

Post-operation verification proved tracked deploy bytes exactly match the target, the index remains clean, and `.semantic-candidate.local`, all `.zvec-grep` file contents, `.vite` cache contents and service configuration are unchanged. Saved-state SHA-256 is `f5624597843926a0b4d8cb97224e19c84adaf3a0a78bcd6a3b9b3849298ea884`. The saved candidate remains explicitly **refused for source/model/engine drift**, not migrated or activated. The sole error-class card is this preserved refusal, not failed Round 57 generation.

No commands modified or synchronized the dirty default checkout `/home/qqp/projects/iso-notation`, other worktrees/quarantines, authentication/providers/workflow configuration or operator browser storage. Browser interactions used a new disposable headless context. This managed worktree's pre-existing `.architect/ticket.md` modification was retained.

## Readiness and identity evidence

Durable machine-readable evidence: [round57-activation.json](round57-activation.json). Temporary probes remain under `/tmp/iso-pr138-activation/`; their outputs relevant to acceptance are included in the durable receipt, not dependent on temporary logs.

- Remote studio HTTP **200**; prepared generation **`4a44e3093f61a6cea8802820967e096f1b52286f053a7ed9a5ebc0a19456d74b`**, ready/nonstale, no generation error. Published real-engine status: **0 violations / 0 warnings**.
- Served manifest engine identity **`362ede709f9c3febef029ef03f319ca6742c7ed64baf31075943372a80933c59`** equals `buildIdentity()` of the exact deploy. Both fetched content-addressed artifacts match their SHA-256 names.
- Candidates hash **`32335a07b418882177fc76bf3c9f847dd945dc8814b1184ca562ce4ce81e7cb8`** includes preserved stale-state diagnostics, so it intentionally differs from the state-free build handoff's Candidates hash.
- Reference hash **`e35f9cadd197d50d1f2d3249b2cb128d5f265e8b39582ac2fc784489dfb0d4ae`** exactly matches the approved build handoff. Compared with the pre-activation live Reference artifact, **only the two diagnostic check-count labels change 39→40**, because PR138 registers the candidate-only depth check. Replacing those two labels with 39 reproduces the entire old artifact hash `154cbf3d05b4ebbf18e9f73560bebef57831cf0bdc1240af57360c326c4b9580`. No Reference SVG changed.
- A bounded deploy identity probe independently hashed Bach/Brahms source/options/tokens and all **2 / 6** real-engine canonical pages; every hash matches the unchanged [PR137 identity receipt](round57-pr137-identity.json). Both local and remotely downloaded PDF bytes match **`43e0078eae668385e94f40adf0654fe4683c570574d173310323d0e52f073c97`**. Nothing was exported/regenerated.
- Browser DOM: all three cards report clean, each has four contextual inline SVGs, and comparison strip has three SVG macros. Beveled and dive each have **20 / 4 / 4** closed black depth polygons in the three No. 13 windows, and zero in Bach 13–14. Flat has zero profiled paths. No SVG raster images or filters are present in these cards.
- Desktop and **390×844** mobile checks exercised Candidates/Reference navigation, Brahms picker, zoom button, keyboard `0`/`−`, reset and reload. Correct active panels, per-view zoom and ready state persisted; document width remained inside the viewport. Reference retains 2 Bach and 6 Brahms page SVGs. No JavaScript exceptions, failed studio requests, generation errors or artifact errors occurred. The only console error was the existing absent **`/favicon.ico` 404**, explicitly diagnosed rather than hidden or repaired outside scope.

## Commands, outcomes and elapsed time

No source changes were needed: exact already-merged production files were activated. **No `npm test`, broad/exclusive test suite, strict lint, build or PDF command was rerun.** The approved composed 100-file / 1290-test, strict-lint/build/source/PDF evidence is reused as authorized; no single clean `npm test` invocation is newly claimed.

| Operational check | Outcome | Elapsed |
| --- | --- | ---: |
| Pre-operation private-state/cache/service/status fingerprint | pass | 0.28s |
| Local exact-revision fetch + deploy `merge --ff-only` | pass, no restart | 0.20s |
| Last watched change → coherent HMR publication, server timestamps | ready/nonstale | 17.05s |
| `node --import tsx /tmp/iso-pr138-activation/identity.mts`, cwd deploy | source/options/tokens/pages/PDF/served-hash identity pass | 8.62s wall / 7.99s probe |
| `node /tmp/iso-pr138-activation/browser.cjs` | desktop/mobile/controls/SVG/error checks pass | 4.28s wall / 3.46s probe |
| Post-operation preservation and exact tracked/index check | pass | 0.13s |

Two diagnostic attempts are not represented as passed: the first hash-probe launch from the assigned worktree lacked resolvable `tsx` (0.06s); using the deploy's existing dependencies fixed the command location without installing anything. The first browser probe classified the favicon console 404 as failure (6.88s); the focused repeat identified the exact favicon URL and retained that limitation. No production defect or scope expansion was necessary.

## Delivered changes

Only new durable documentation in the assigned worktree:

- `docs/reports/round57-activation.md`
- `docs/reports/round57-activation.json`

These report files are left **uncommitted**. The live deploy remains the exact merged PR138 revision, without these additional handoff documents. PR138 is merged and served; it is **not operator accepted**, and default adoption was not authorized or performed.
