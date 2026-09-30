# Operating brief: the source and the pianist

This brief applies to all agents working in this repository. Priorities, in order:

1. **Composer/source fidelity and honest uncertainty.**
2. **Immediate actionability and legibility for the pianist.**
3. **Coherent musical-gesture geometry and page hierarchy.**
4. **Engineering checks, collaboration and release workflow that support those outcomes.**

The reader needs to know what to play quickly, without squinting, decoding edge cases or solving our layout puzzles. Source correctness and readable presentation are both necessary; neither excuses a failure of the other. Agents own design and routine readability checks. The operator is not the required QA system.

## 1. Preserve the music; state what is known

Preserve source pitch, rational time, register, written rhythm and tie components, independent voices, grace hosts and values, repeats, alternatives and provenance. Do not simplify or delete content to quiet checks. Keep source evidence traceable and distinguish source facts from editorial inference.

Printed destination, logical voice and performing hand are different. Do not infer one automatically from another. Label uncertain performing-hand attribution with its evidence and uncertainty; do not invent composer fingering. A shared visible head is valid only when it retains all musical identities and genuinely compatible rhythmic obligations, including independent continuations.

Use **absolute pitch symbols** or **solf** for written/sounding pitch identities (duodecimal digits `0`–`b`). Use **zero-based duodecimal spans** for relative intervals and vertical distances; the examples and casing are in the appendix.

## 2. Make the pianist's actions legible

The pianist must readily recognize absolute pitch and register, simultaneous versus successive actions, each hand's material, independent rhythmic voices, durations and continuations, phrasing and expression. Assess these tasks in context, not just one isolated glyph or collision box.

Musical relationships determine visual connectivity. Matching digits, proximity and convenient collision boxes do not establish a musical relationship. Plan complete gestures and routes before placing their fragments; inspect neighboring onsets and the whole-page hierarchy. Reject even a collision-free layout if it strengthens the wrong association, scatters a coherent gesture, creates excessive space or hides a route conflict with tiny broken stems.

Prefer coherent shared rules over score/measure whitelists, fake masks or incidental offset patches. Significant scoped refactoring is appropriate when it serves the approved outcome. Numerical lint, owner IDs and hash pins are useful evidence, not proof of musical readability. Do not claim pixels were judged when only geometry was inspected. If visual inspection is unavailable, report that limitation rather than transferring routine defect discovery to the operator.

## 3. Work within the agreed intent; protect existing work

Agree on intent and consequential choices before implementation or delegation. Once authorized, honor delegated routine judgment: do not reopen settled source selection, require repeated questionnaires or seek redundant approval for the approved task. Source approval does not automatically authorize an unrelated redesign. Escalate necessary scope changes or genuine blockers with a concrete recommendation.

BOUNDED is the current approved normal execution path, including retained-test and manifest maintenance within scope. Do not recreate historical OPEN-role bureaucracy. Use targeted independent critique when useful; another agent's lint run is not visual acceptance.

Protect user work in the dirty default checkout, preserved worktrees, deploy-local saved candidates, caches and configuration, and browser storage. Work in the assigned managed worktree and preserve unrelated changes. Do not reset, clean, stash or forcibly synchronize this state, mutate authentication, provider or workflow configuration, or execute acquired LilyPond/Scheme. Preserve saved stale candidates and explicitly refuse their activation; do not silently migrate, overwrite or delete them.

Shared correctness fixes may change both Bach and Brahms within the approved scope. Inspect and report those changes; do not preserve errors through exemptions or make operator visual judgment a prerequisite for routine correctness fixes. The studio's GOLD/BRONZE badges are legacy reference designations, not guarantees of perfection, permissions for regressions or mandates to preserve defects.

## 4. Use the real studio, with honest comparisons

Review uses only the existing real-engine inline SVG studio:

- Live studio: `http://100.102.70.49:5175/janko.html` (web entry also at `http://100.102.70.49:5175/`).
- Published site: `https://qqp-dev.github.io/iso-notation/`.

Use these remotely accessible links, not local-only addresses. No toy renderers, fake engraving elements, new viewers, ad-hoc HTML pages, screenshots or generated review images. Do not place assets or temporary review files at checkout root. Committed source/reference assets in `docs/img/` and `public/img/` are distinct from generated review outputs; do not use those directories as render-output dumps.

Keep two consistent surfaces:

- **Reference (`#reference`, View 2):** the canonical state, with full spreads, inline SVG macro focus crops and lint diagnostics for both Bach Goldberg Var. 1 and Brahms Op. 118 No. 1 (`brahms-op118-no1`).
- **Candidates (`#candidates`, View 1):** proposed changes engraved by the same engine, with accurate option deltas, rationale and diagnostics. Use comparisons when a consequential choice needs them, not a mandatory 2–4-candidate questionnaire for every task.

Fixed-3 is current project-wide canonical practice: studio, production commands and acceptance tests should agree. Bach uses `DEFAULT_JANKO_OPTIONS` + `DEFAULT_JANKO_TOKENS`; Brahms uses `BRAHMS_OP118_NO1_JANKO_OPTIONS` + `BRAHMS_OP118_NO1_JANKO_TOKENS`. Neither reference designation freezes shared correctness work. Report findings honestly rather than hiding or exempting them to keep a badge or chip clean.

Define decision rounds in `src/render/janko/candidates.ts`: `CURRENT_ROUND_METADATA` holds the question and `CURRENT_CANDIDATES` the option deltas against the defaults. Keep the existing studio template; do not invent a separate review surface. Use literal corpus passages first, including Brahms windows via `brahmsWindow()`. Use synthetic material only when a literal passage cannot demonstrate the question, and caption it as synthetic. Caption historical controls accurately: historical option deltas run by today's engine are not exact old revisions.

The Vite entry `janko.html` is mirrored byte-for-byte to `public/janko.html`; the engine is `src/render/janko/`. HMR re-renders the views. Existing zoom controls (`+` / `−` / `Reset`, keys `+`/`−`/`0`, or Ctrl/⌘ + wheel) cover 50%–300%; 100% fits the card width. These facilities support inspection, not a claim that unlanded work is already served or accepted.

Every implementer/reviewer handoff includes **Visual impact: affected / not affected / uncertain**, with an evidence-based explanation. For affected work, supply the real studio URL, score/view and verified representative measures or windows; the architect relays these cues without waiting to be asked. Distinguish unlanded, merged, currently served and operator-accepted output. If locations or impact are uncertain, obtain bounded real-engine/linter evidence and state what remains uninspected. For nonvisual changes, say so; no artificial visual artifacts are needed.

## 5. Verify and release without mistaking gates for judgment

Use the mathematical engraving linter first for geometry diagnostics; headless agents must not generate review images. `lintJankoScore(score, options?, tokens?, lintOptions?)` in `src/render/janko/linter.ts` returns `LintReport { ok, violations, warnings, diagnostics, stats }`. Violations are hard errors; warnings are reported risks, not permission to disregard readability. Checks include knockout protection, notehead-disc and barline clearance, stem attachment, beam-stem connection, beam slope ≤ 0.25, measure-numeral/accolade clearance and Middle C corridor integrity. Canonical Bach under `DEFAULT_JANKO_OPTIONS` must have zero violations. Add a matching assertion in `test/janko-linter.test.ts` for a new defect class.

For source changes (including test code), run the final canonical pre-landing gates once the work is ready:

- `npm test`
- `npm run lint:engraving -- --strict`
- `npm run build`

During development, use approved workflow-managed selected-file `node --import tsx --test <validated test/*.test.ts>` under the committed `.architect/test-runner.json` profile. The workflow validates the selected file; an agent-supplied substitute is not a release gate. The engraving CLI supports `--json` and `--quiet`; strict lint fails on warnings as well as violations.

Do not run unconfigured compiler/linter flags, rerun all gates after every small edit or chase unrelated unused parameters, dead code or cleanup. Set timeouts from observed runtimes and report commands, outcomes and elapsed time; do not promise universal runtimes. Passing gates are engineering evidence, not operator musical or visual acceptance.

After golden ink changes, regenerate the download with `npm run pdf` and include the updated `public/goldberg-variation-1.pdf` in the release change. No regeneration is needed for instructions-only changes that leave engraving output unchanged. Implementers leave changes uncommitted for the authorized landing workflow.

`scripts/export-pdf.ts` exports engine pages through `rsvg-convert -f pdf` and joins them with `pdfunite`. `test/janko-pdf.test.ts` compares a semantic fingerprint (page count/size, text layer, vector geometry, subset fonts, zero raster images and ×4/3 title text scale), not random byte IDs. A stale PDF fails `npm test` and blocks Pages deployment through `deploy.yml`. Preserve default 96 DPI; do not pass `-d 72 -p 72`. The documented ×4/3 text scale (11pt title → Tm 14.667) is intentional and pinned by the test.

## Appendix: terminology and historical inspiration

### Zero-based duodecimal spans

- `1-span` = 1 semitone (2.5pt vertical)
- `2-span` = 2 semitones / whole-tone neighbour (5.0pt vertical)
- `a-span` or `A-span` = decimal 10 semitones (25.0pt vertical)
- `b-span` or `B-span` = decimal 11 semitones (27.5pt vertical)
- `10-span` = decimal 12 semitones / octave (30.0pt vertical; duodecimal 10 = decimal 12)
- `20-span` = decimal 24 semitones / two octaves (60.0pt vertical; duodecimal 20 = decimal 24)

Do not invent novel pronunciations or change existing numeral casing in code/tokens. Use these terms in docs, captions, tests and comments.

### The prior perfected landscape version

“The previous design”, “the old layout”, “the landscape version” and “the perfected benchmark” refer to the **12-Row Horizontal Landscape 3-System Engraving**, commit `f33d9e0` / PR #14. It is historical design inspiration, not a claim about today's active renderer or a reason to preserve a defect.

Precise committed references:

- `docs/img/definitive_m1_m2.png` — accolade, title, Position of Honor halo and m. 1 opening.
- `docs/img/definitive_m4.png` — historical handedness chevrons.
- `docs/img/definitive_m6.png` — flush staff-line duration holds.
- `docs/img/definitive_m30.png` — rapid LH crossing run in treble register.
- `public/img/page1_4.25.png` — full page 1, systems 1–3, mm. 1–12.
- `docs/reference/definitive_landscape_engraving.md` — full dossier.
- `docs/definitive_duodecimal_lightened_staff.md`, `docs/duodecimal_font_typography.md`, `docs/chevron_tuning.md` — historical details.
- `src/render/janko/elements/accolade.ts`, `getVerticalAccoladePath` — accolade implementation; consult `f33d9e0` for the historical landscape engine.

Historical qualities worth studying: slender copperplate accolade (7.0pt wide, 0.85pt thick); open left staff margin without an opening barline; Middle C spine at pitch 48 (1.35pt, `#0F172A`) against 0.65pt octave lines; opening halo (R = 5.8pt, stroke 0.75pt); holds flush to the circle perimeter, butt-capped on staff lines and clipped 1.0pt before subsequent same-pitch notes; Century Schoolbook italic, measure numerals at system starts and no corporate divider lines. The historical burin chevrons (4.2pt × 2.8pt, stroke 1.20pt or 0.80pt, 2.2pt circle clearance) belong to that reference, not an assertion that chevrons are active today.
