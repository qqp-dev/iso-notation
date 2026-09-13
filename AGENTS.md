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
- **NEVER output `localhost` links or references**. The user accesses the environment remotely via **Tailscale** and the **Orca mobile app**.
- **ALWAYS use the Tailscale address or GitHub Pages**:
  - Live Studio & Web UI: `http://100.102.70.49:5175/janko.html` (or `http://100.102.70.49:5175/`)
  - Direct image URLs: `http://100.102.70.49:5175/<filename>.png`
  - GitHub Pages: `https://qqp-dev.github.io/iso-notation/`

---

## 2. Orca Mobile Remote App & File Format Invariants
- **Checkout Root Placement is MANDATORY**:
  - The user operates through the **Orca mobile remote app**, which only exposes a button to view files **directly in the checkout root**.
  - Any artifact the user is expected to inspect MUST be placed directly in `./` (e.g. `./janko_variants.png`, `./janko_m1_m2.png`) AND mirrored to `/home/qqp/projects/iso-notation/`.
  - Never place review files exclusively in `/tmp`, `docs/`, `public/`, or subdirectories; the user cannot navigate arbitrary filesystem paths on mobile.
- **Supported Formats**:
  - **ONLY PNG images and HTML web pages**.
  - **NEVER present raw SVG or PDF files** for review. The user cannot view them.
- **No-Zoom Viewing Limitation**:
  - The mobile viewer **cannot zoom into PNG images**.
  - Never expect the user to inspect fine typography, line weights, or note collisions on a shrunk full-page image.
  - When evaluating details, **always provide pre-enlarged 4× macro crops** (288 DPI, e.g. `janko_m1_m2.png`, `janko_m4.png`, `janko_m8.png`).
  - Recommend the web studio (`http://100.102.70.49:5175/janko.html`) as the primary medium since it includes in-browser zoom buttons (`+`, `−`, `Reset`, 50%–300%).

---

## 3. Canonical Benchmark: "The Prior Perfected Landscape Version"

Whenever the user refers to **"the previous design"**, **"the old layout"**, **"the landscape version"**, or **"the perfected benchmark"**, they are referring to the **12-Row Horizontal Landscape 3-System Engraving** (finalized in commit `f33d9e0` / PR #14).

This design is the standard of beauty for this repository. When taking inspiration or pulling ideas into new designs, reference these assets directly:

### Reference Files in Checkout Root
- `reference_landscape_page1.png` — Full Page 1 spread (Systems 1–3, mm. 1–12)
- `reference_m1_m2.png` — Accolade, title heading, Position of Honor halo, and Measure 1 start
- `reference_m4.png` — Handedness chevrons in action
- `reference_m6.png` — Continuous flush staff-line duration hold lines
- `reference_m30.png` — Rapid LH crossing run in treble register

### Reference Documentation & Implementation
- **Full Dossier**: `docs/reference/definitive_landscape_engraving.md`
- **Code Implementation**: `src/render/print-layout.ts` (functions `computeColumnarLayout`, `renderPageToSvg`, `getVerticalAccoladePath`)
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
- **Golden Master = `DEFAULT_JANKO_OPTIONS` + `DEFAULT_JANKO_TOKENS`**; the Reference view is always the canonical Bach Goldberg Var. 1 engraving under those options.

---

## 5. Implementer Verification: Visual Linter First (`npm run lint:engraving`)

Headless implementers must not render images to see a defect. Run the mathematical linter instead — it verifies the engraving in **~25 ms**:

- `lintJankoScore(score, options?, tokens?, lintOptions?)` in `src/render/janko/linter.ts` returns `LintReport { ok, violations, warnings, diagnostics, stats }`; `violations` are hard errors, `warnings` are known non-blocking risks (e.g. cross-hand chordal collisions).
- Checks: knockout protection (glyph fits the mask; nothing painted after a knockout may cut through it), notehead-disc clearance (2r), barline clearance, stem attachment and beam-stem connection, beam slope ≤ 0.25, measure-numeral and accolade clearances, Middle C corridor integrity.
- CLI: `npm run lint:engraving` (add `--json`, `--strict`, `--quiet`). Exit code 1 on violations; `--strict` also fails on warnings.
- The canonical Bach score with `DEFAULT_JANKO_OPTIONS` must report **zero violations**. Any new defect class gets a matching assertion in `test/janko-linter.test.ts`.
- `npm test` covers unit tests, engraving invariants, the visual linter and the studio architecture in **under 1 second**; run it before every hand-off. `npm run build` must stay clean.

---

## 6. Rapid Iteration Extras (PNG artifacts for the mobile app only)

- **Multi-Variant Contact Sheets**: still available through `renderJankoVariantComparison` when a *file* artifact is genuinely needed.
- **Fast Export Command**: `npm run janko:export` rasterizes the review set via `resvg` in ~380 ms and mirrors every PNG to the checkout root, `public/`, `docs/img/` and the main checkout — use it only to refresh the mobile-app artifacts, not as the review loop.
- `npm run janko:watch` keeps those artifacts synchronized in the background.
