# Repository Operating Rules & Agent Guidelines

> **Audience**: All AI coding assistants, agents, and subagents operating in this repository.  
> **Status**: Mandatory Invariants (Must be strictly followed on every turn).

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

## 4. Rapid Iteration Workflow (Sub-Second Feedback)
- **Multi-Variant Contact Sheets**:
  - Never guess one parameter per conversational turn (which takes 15+ minutes per cycle).
  - When comparing design directions (rhythm, spacing, lattice), **always generate a multi-variant contact sheet** (e.g. `janko_variants.png`) showing candidates side-by-side on the exact same musical phrase.
- **Fast Export Command**:
  - Run `npm run janko:export` to generate all PNGs via `resvg` in ~380ms and mirror them across checkouts.
  - Or use `npm run janko:watch` for real-time background file synchronization.
