# Repository Operating Rules & Agent Guidelines

> **Audience**: All AI coding assistants, agents, and subagents operating in this repository.  
> **Status**: Mandatory Invariants (Must be strictly followed on every turn).

## 0. Mandatory Pre-Delegation User Alignment & Two-Surface Invariant (Architect Invariant)
> **Note**: This invariant specifically governs the lead Architect agent responsible for shaping requirements, planning, and delegating. The implementer subagent focuses solely on executing verified tickets.

- **ALWAYS check in with the user first**: Before delegating any work, launching implementer/subagent tasks, or embarking on implementation cycles, the architect agent MUST explicitly check in with the user to articulate and verify mutual understanding of the user's intent, requirements, and design direction.
- **NEVER assume and execute blindly**: If a user request has architectural, aesthetic, or requirements implications, summarize the understanding, propose the concrete approach, and confirm with the user before delegating or executing code changes.
- **Epistemic Coherence & The Two Consistent Surfaces**:
  - We operate with exactly **two consistent surfaces**:
    1. **Surface 1 · The Canonical State**: The design as it currently stands, incorporating all settled improvements and golden-master rules (View 2 on the web page).
    2. **Surface 2 · The Decision Candidates**: The next round of design ideas, rendered side-by-side with **complete accuracy** using the *real engraving engine* (View 1 on the web page).
  - **NEVER create throwaway sketch renderers or toy mockup scripts**: Bypassing the real engine or faking elements (like replacing beams with individual flagged notes) destroys epistemic coherence. The user must be evaluating the real change on real score snippets with 100% engine accuracy, never a vague, broken sketch.

---

## 1. Network & Link Invariants
- **NEVER output `localhost` links or references**. The user accesses the environment remotely via **Tailscale**.
- **ALWAYS use the Tailscale address or GitHub Pages**:
  - Live Studio & Web UI: `http://100.102.70.49:5175/janko.html` (or `http://100.102.70.49:5175/`)
  - GitHub Pages: `https://qqp-dev.github.io/iso-notation/`

---

## 2. Zero Images at Root & Clean Asset Organization Invariants
- **Root Cleanliness Invariant**:
  - **NEVER place generated images, PNGs, SVGs, or temporary review files in the checkout root (`./`)**. The root directory must remain clean and uncluttered, containing only project source, configuration, and documentation files.
  - No generated review images exist, period: review is pixels on the live website only. `docs/img/` and `public/img/` hold committed reference documentation (the §3 benchmark assets), never render outputs.
- **Primary Design Review Medium**:
  - Review happens exclusively in the **live web studio** (`http://100.102.70.49:5175/janko.html`), which renders SVG directly in the browser with full zoom controls (50%–300%) and instant Vite HMR.

---

## 3. Canonical Benchmark: "The Prior Perfected Landscape Version"

Whenever the user refers to **"the previous design"**, **"the old layout"**, **"the landscape version"**, or **"the perfected benchmark"**, they are referring to the **12-Row Horizontal Landscape 3-System Engraving** (finalized in commit `f33d9e0` / PR #14).

This design is the standard of beauty for this repository. When taking inspiration or pulling ideas into new designs, reference these assets directly:

### Reference Benchmark Files
- Full landscape golden master assets are located in `docs/img/` and `public/img/`:
  - `docs/img/definitive_m1_m2.png` — Accolade, title heading, Position of Honor halo, and Measure 1 start
  - `docs/img/definitive_m4.png` — Handedness chevrons in action
  - `docs/img/definitive_m6.png` — Continuous flush staff-line duration hold lines
  - `docs/img/definitive_m30.png` — Rapid LH crossing run in treble register
  - `public/img/page1_4.25.png` — Full Page 1 spread (Systems 1–3, mm. 1–12)

### Reference Documentation & Implementation
- **Full Dossier**: `docs/reference/definitive_landscape_engraving.md`
- **Code Implementation**: `src/render/janko/elements/accolade.ts` (function `getVerticalAccoladePath`), historical landscape engraving in commit `f33d9e0` (PR #14)
- **Key Historic Docs**: `docs/definitive_duodecimal_lightened_staff.md`, `docs/duodecimal_font_typography.md`, `docs/chevron_tuning.md`

### Core Aesthetics of the Reference Design:
1. **Accolade**: Slender copperplate accolade (`w = 7.0pt`, `thick = 0.85pt`).
2. **Zero Opening Barline**: Horizontal staff lines emerge openly from the left margin; no heavy vertical bounding barline.
3. **Middle C Hierarchy**: Authoritative `1.35pt` dark spine at pitch 48 (`#0F172A`); `0.65pt` octave lines.
4. **Position of Honor**: Concentric halo ring (`R = 5.8pt`, stroke `0.75pt`) around opening sound(s) at tick 0 of Measure 1.
5. **Flush Duration Holds**: Hold lines start flush at the circle perimeter without intersecting; on staff lines they use `stroke-linecap="butt"` matching line stroke; they clip `1.0pt` before subsequent notes on the same pitch.
6. **Authoritative Chevrons**: Sculpted French Guillemet / calligraphic burin chevrons (`w = 4.2pt`, `h = 2.8pt`, stroke `1.20pt` or `0.80pt`), offset `2.2pt` clear of circle.
7. **Clean Urtext Typography**: Century Schoolbook italic, measure numerals ONLY at system starts, zero corporate horizontal divider lines.

---

## 4. Primary Design Review Loop: The Two-View Live Studio (No PNG Round-Trips, No Goose Chases)

Design review happens **exclusively on the live website** — never by sending the user on goose chases looking for files, PNGs, or ad-hoc HTML pages:

- **Live Studio (primary medium)**: `http://100.102.70.49:5175/janko.html`
  - The page is a **Vite entry** (`janko.html`, mirrored byte-for-byte to `public/janko.html`) that renders inline SVG straight from the TypeScript engine in `src/render/janko/`. There is no PNG in the review loop, and no standalone temporary HTML files.
  - **Vite HMR**: any edit under `src/render/janko/` re-renders both views in place (`import.meta.hot`), with **zero user action** and no browser refresh.
  - **View 1 · Decision Candidates Matrix**: the 2–4 exploratory candidates for the *current decision round*, engraved side by side on the same measures with option-delta badges, rationale and a live lint chip per candidate (`#candidates`, or `janko.html#candidates`).
  - **View 2 · Golden Reference Object**: the accumulated golden master — full page spread (all pages) plus 288-DPI-equivalent macro focus crops and the live lint diagnostics list (`janko.html#reference`).
  - **In-browser zoom**: `+` / `−` / `Reset` buttons, `+`/`−`/`0` keys, or `Ctrl/⌘ + wheel`, 50%–300%. Mobile-safe: 100% fits the card width.
- **Declarative Candidate Registry**: `src/render/janko/candidates.ts` is the *only* file to touch when opening a round. `CURRENT_ROUND_METADATA` holds the round number/title/question, `CURRENT_CANDIDATES` holds the variants as 5-line option deltas against `DEFAULT_JANKO_OPTIONS`. The studio template never changes. Never invent separate HTML viewers or script files for candidate reviews.
- **Golden Master = `DEFAULT_JANKO_OPTIONS` + `DEFAULT_JANKO_TOKENS`** for the primary Bach Goldberg Var. 1 engraving, plus the Brahms Op. 118 No. 1 golden (`BRAHMS_OP118_NO1_JANKO_OPTIONS` + `BRAHMS_OP118_NO1_JANKO_TOKENS`). Fixed-3 is project-wide canonical notation: studio, production commands and acceptance tests agree; exploration uses the real-engine candidate surface. The Reference view always carries both spreads: Bach first, Brahms (`brahms-op118-no1`) beside it with its own pages, macro crops and lint diagnostics.
- **Brahms is a first-class iteration surface**: rounds window it by measure via `brahmsWindow()` in the candidate registry, literal corpus measures first (synthetic only when no literal passage can demonstrate the question, caption says so).
- **Visual hand-off field (mandatory)**: every implementer/reviewer hand-off supplies `Visual impact: affected / not affected / uncertain` with a brief evidence-based explanation.
  - When affected, give the existing real-studio URL, affected score/view, and verified representative measures/windows or other inspection cues (e.g. `http://100.102.70.49:5175/janko.html#reference`, BRONZE Brahms reference). Use Tailscale or GitHub Pages; never invent a viewer/URL.
  - The architect relays the link and cues to the operator without waiting to be asked.
  - Distinguish landed/currently served output from unlanded or unverified deployment; never imply operator visual acceptance.
  - If impact/locations are not cheaply known, surface the uncertainty and obtain bounded real-engine/linter evidence rather than guessing or making mockups/images.
  - For nonvisual changes say so explicitly; no artificial need for generated visuals.

---

## 5. Implementer Verification: Visual Linter First (`npm run lint:engraving`)

Headless implementers must not render images to see a defect. Run the mathematical linter instead — it verifies the engraving in **~25 ms**:

- `lintJankoScore(score, options?, tokens?, lintOptions?)` in `src/render/janko/linter.ts` returns `LintReport { ok, violations, warnings, diagnostics, stats }`; `violations` are hard errors, `warnings` are known non-blocking risks (e.g. cross-hand chordal collisions).
- Checks: knockout protection (glyph fits the mask; nothing painted after a knockout may cut through it), notehead-disc clearance (2r), barline clearance, stem attachment and beam-stem connection, beam slope ≤ 0.25, measure-numeral and accolade clearances, Middle C corridor integrity.
- CLI: `npm run lint:engraving` (add `--json`, `--strict`, `--quiet`). Exit code 1 on violations; `--strict` also fails on warnings.
- The canonical Bach score with `DEFAULT_JANKO_OPTIONS` must report **zero violations**. Any new defect class gets a matching assertion in `test/janko-linter.test.ts`.
- `npm test` covers unit tests, engraving invariants, the visual linter and the studio architecture in **under 1 second**. `npm run build` must stay clean. Full regression, genuine strict engraving lint and build are mandatory pre-landing engineering gates, not requirements after every candidate engraving edit.
- **Canonical Validation Commands ONLY (No Unconfigured Linters / No Scope Creep)**:
  - Implementers MUST validate code using ONLY these commands:
    - `npm test` (full pre-landing regression)
    - `npm run lint:engraving -- --strict` (full pre-landing strict lint)
    - `npm run build` (full pre-landing build)
    - Workflow-managed selected-file `node --import tsx --test <validated test/*.test.ts>` under the committed `.architect/test-runner.json` profile (focused development only; the workflow validates the file, not an agent-supplied command or a substitute for pre-landing gates)
  - **NEVER** run ad-hoc or unconfigured compiler flags (e.g. `tsc --noEmit --noUnusedLocals --noUnusedParameters`) that are not enabled in `tsconfig.json` or `package.json`.
  - **NEVER** embark on rabbit holes attempting to fix pre-existing unused parameters, dead code, or refactor functions outside the ticket's explicit scope. Keep diffs strictly minimal and bounded to the ticket requirements.

---

## 6. Download-PDF Release Rule (`npm run pdf`)

- The studio's "Download PDF" is `public/goldberg-variation-1.pdf`, exported from the judged golden by `npm run pdf` (`scripts/export-pdf.ts`: engine pages → `rsvg-convert -f pdf` at default DPI → `pdfunite` join).
- **After ANY golden change, run `npm run pdf` and commit the result.** `test/janko-pdf.test.ts` regenerates the PDF and compares a semantic fingerprint (page count/size, text layer, vector geometry, subset fonts, zero raster images, ×4/3 title text scale) against the committed file; a stale PDF fails `npm test` and `deploy.yml` blocks the Pages publish.
- Never pass `-d 72 -p 72` to rsvg-convert: its default 96 DPI renders text at ×4/3 by design (11pt title → Tm 14.667), pinned by the test.

---

## 7. Golden-Master Designations: GOLD (Frozen) vs BRONZE (Active) (Round 31)

- **Bach Goldberg Var. 1 is GOLD = the frozen perfection standard.** Its engraving under `DEFAULT_JANKO_OPTIONS` is judged done: zero violations, and no open questions. Any future change to it requires a decision round plus operator judgment — never a drive-by.
- **Brahms Op. 118/1 is BRONZE = the active iteration surface.** It renders under the fixed-3 golden config (the current practice), carries the whole spread so the operator can walk it producing suggestions, and lists its pre-existing findings honestly — each tagged in the Reference diagnostics as a known folding-geometry finding scheduled for a future round (never gated, never hidden).
- The two Reference blocks carry visible `GOLD` / `BRONZE` badges (`ReferenceDesignation` in `src/render/janko/studio.ts`); the CLI keeps its own adaptive Brahms entry so deploy stays green.

---

## 8. Pitch & Interval Terminology: Symbols vs Duodecimal Spans (Round 40)

- **Absolute pitch**: refer to as **absolute pitch symbols** or **solf** (e.g. duodecimal digits `0`–`b`, written/sounding pitch identities).
- **Relative intervals / vertical distances**: refer to using **zero-based duodecimal spans**:
  - `1-span` = 1 semitone (2.5pt vertical)
  - `2-span` = 2 semitones / whole-tone neighbour (5.0pt vertical)
  - `a-span` or `A-span` = decimal 10 semitones (25.0pt vertical)
  - `b-span` or `B-span` = decimal 11 semitones (27.5pt vertical)
  - `10-span` = decimal 12 semitones / octave (30.0pt vertical; duodecimal 10 = decimal 12)
  - `20-span` = decimal 24 semitones / two octaves (60.0pt vertical; duodecimal 20 = decimal 24)
- Do not invent novel pronunciations or modify existing numeral casing in code/tokens. Use this terminology consistently in design docs, captions, tests, and comments.
