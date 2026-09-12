# Ticket: Landscape 3-System Horizontal Engraving, Refined Classical Accolade, Zero Initial Barline, Flush Hold Lines, and Authoritative Chevrons

## Kind

bounded

## Problem

Following user feedback on port 5175, several critical engraving refinements are required to bring the horizontal layout to definitive Urtext perfection:

1. **Landscape Orientation & 3 Systems Per Page**:
   - The user explicitly requested **landscape orientation** over portrait: *"landscape would be preferred over portrait."*
   - Also requested **3 systems per page** rather than 4: *"I actually changed it to three, I'm not so enamoured with four... landscape would also be three pages?"*
   - In A4 Landscape ($841.89\text{pt} \times 595.28\text{pt}$), each page holds 3 horizontal systems with 4 measures per system.
   - For the 32-measure Bach Goldberg Var 1:
     - 8 systems total.
     - Page 1: Measures 1–12 (Systems 1–3: mm 1–4, mm 5–8, mm 9–12).
     - Page 2: Measures 13–24 (Systems 4–6: mm 13–16, mm 17–20, mm 21–24).
     - Page 3: Measures 25–32 (Systems 7–8: mm 25–28, mm 29–32).
     - Generous horizontal width ($\sim 192\text{pt}$ per measure) and vertical breathing room between systems ($\sim 38\text{pt}$).

2. **Curly Brace (Accolade) Refinement**:
   - *"curly brace much too thick, not very elegant, too thick relative to everything else on the page."*
   - Previously rendered with width $10\text{pt}$ and stroke thickness $1.25\text{pt}$ with bloated control points.
   - Refine `getVerticalAccoladePath(x, yTop, yBot, w = 7.0, thick = 0.85)`:
     - Slender copperplate proportions: width $7.0\text{pt}$, swell thickness $0.85\text{pt}$.
     - Delicate tapering tips at $yTop$ and $yBot$.
     - Sharp horizontal cusp pointing directly into Middle C at $yMid$.

3. **Abandon Starting Vertical Staff-Bounding Barline**:
   - *"also the previous design made so many small tasteful decisions such as ABANDONING a starting horizontal line"*
   - Remove the heavy $1.2\text{pt}$ opening barline `<line x1="${staffLeft}" ... stroke-width="1.2"/>`.
   - The horizontal staff lines must emerge cleanly and openly from the left, clasped by the curly brace without a boxy staff-bounding barline.

4. **Tasteful Duration Tails (Flush Connection to Circular Knockout / Halo)**:
   - *"and tastefully connecting the duration tail to the circle (now they intersect...)"*
   - Previously hold lines intersected through the circular knockout and halo ring because:
     - Opening sounds at tick 0 have halo radius $R_{halo} = 5.80\text{pt}$, but hold lines started at $4.80\text{pt}$, cutting into the halo ring.
     - Hold lines used `stroke-linecap="round"` which bulged $0.4\text{pt}$ backwards into the white circular knockout.
     - Hold lines ran directly into subsequent notes on the same pitch (`0-b-0` arithmetic look in m. 6).
   - Solution:
     - Effective start radius: $R_{start} = (note.startTick === 0) ? OPENING\_HALO\_RADIUS\_PT : NOTEHEAD\_KNOCKOUT\_RADIUS\_PT$.
     - Start X: $holdStartX = nx + R_{start}$.
     - End X: If another note on the same system and pitch occurs at $nextTick > note.startTick$, clip $holdEndX$ to $nextNx - NOTEHEAD\_KNOCKOUT\_RADIUS\_PT - 1.0$.
     - On staff lines ($pc12 === 0$), use `stroke-linecap="butt"` matching the staff line width ($1.35\text{pt}$ for Middle C, $0.65\text{pt}$ for octaves).
     - In open spaces, use `stroke-width="0.80"` with $holdStartX = nx + R_{start} + 0.4$ so the round cap never encroaches onto the circle boundary.

5. **Authoritative Handedness Chevrons**:
   - *"the chevrons are too small or thin to be useful"*
   - Previously rendered with $w = 3.2\text{pt}, h = 1.8\text{pt}$, stroke $0.80\text{pt}$—tiny and faint.
   - Upgrade to substantial, prominent chevrons:
     - Width: $4.2\text{pt}$, Height: $2.8\text{pt}$, `stroke-width="1.20"`.
     - `stroke-linecap="round" stroke-linejoin="round"`.
     - Clearance: $2.2\text{pt}$ from the circular knockout.
     - Upward chevron ($\wedge$) above the notehead for RH below Middle C.
     - Downward chevron ($\vee$) below the notehead for LH above Middle C.

6. **Measure Numbers at System Starts ONLY**:
   - *"we don't need a measure counter EVERY measure"*
   - Render the measure number ONLY above the first measure of each system (m. 1, m. 5, m. 9, m. 13, m. 17, m. 21, m. 25, m. 29).
   - Do NOT render measure numbers for internal measures.

7. **Clean Urtext Header & Footer (No Tacky Horizontal Rules)**:
   - *"many changes around the head/foot were probably for the worse"*
   - Remove the corporate `#CCCCCC` header rule and `#E5E7EB` footer rule.
   - Header: Centered title & subtitle, right-aligned composer, pure white breathing room.
   - Footer: Subtle Urtext page numbering without horizontal rules.

8. **Live Port 5175 Invariant**:
   - Port 5175 is the single authoritative live preview port.

## Testing Plan

1. **Landscape 3-System Layout & Pagination Invariants (`test/print-layout.test.ts`)**:
   - Default `orientation` is `'landscape'`. Default `systemsPerPage` is 3. Default `measuresPerSystem` is 4.
   - Page dimensions: width $841.89\text{pt}$, height $595.28\text{pt}$ (A4 Landscape).
   - Bach Goldberg Var 1 (32 measures) produces exactly 3 pages:
     - Page 1: Systems 1–3 (start measures: `[1, 5, 9]`).
     - Page 2: Systems 4–6 (start measures: `[13, 17, 21]`).
     - Page 3: Systems 7–8 (start measures: `[25, 29]`).
2. **Refined Slender Vertical Accolade Invariant**:
   - Accolade rendered on left margin with width $7.0\text{pt}$ and thickness $0.85\text{pt}$ (`getVerticalAccoladePath(..., 7.0, 0.85)`).
3. **Zero Starting System Barline Invariant**:
   - Page SVG must NOT contain `<line x1="${staffLeft}" ... stroke-width="1.2"/>`.
4. **Flush Duration Hold Lines & Subsequent Note Clipping Invariant**:
   - Hold lines start flush at $nx + effectiveRadius$ (with $R_{halo} = 5.80\text{pt}$ for tick 0 notes, $R_{knockout} = 4.80\text{pt}$ for regular notes).
   - Hold lines on staff lines use `stroke-linecap="butt"`.
   - In Measure 6, notes on pitch 48 do not overlap or collide with subsequent notes.
5. **Authoritative Handedness Chevrons Invariant**:
   - Chevrons rendered with `stroke-width="1.20"`, width $4.2\text{pt}$, height $2.8\text{pt}$.
6. **System-Start Only Measure Numbers Invariant**:
   - System 1 renders measure number 1, but does NOT render measure numbers 2, 3, 4.
   - System 2 renders measure number 5, but does NOT render 6, 7, 8.
7. **Clean Header & Footer Invariant**:
   - Page SVGs do NOT contain `<line ... stroke="#CCCCCC"` or `<line ... stroke="#E5E7EB"`.
8. **Regression & Build Verification**:
   - All unit tests pass (`npm test`).
   - Production build succeeds (`npm run build`).

## [bounded]

### Solution

1. **Update `src/render/print-layout.ts`**:
   - In `DEFAULT_OPTIONS`: set `orientation: 'landscape'`, `systemsPerPage: 3`, `measuresPerSystem: 4`.
   - Update `ACCOLADE_WIDTH_PT = 7.0`, `ACCOLADE_GAP_PT = 7.0`.
   - Refine `getVerticalAccoladePath` to use `w = 7.0, thick = 0.85` with slender tapering copperplate geometry.
   - In `renderPageToSvg`:
     - Delete the starting barline `<line x1="${staffLeft}" y1="${staffTop}" ... stroke-width="1.2"/>`.
     - Remove the header divider `<line stroke="#CCCCCC"` and footer divider `<line stroke="#E5E7EB"`.
     - In measure loop: only emit `<text ... class="measure-num">` when `m === 0` (first measure of the system).
     - In hold lines: calculate $R_{start} = (note.startTick === 0) ? OPENING\_HALO\_RADIUS\_PT : NOTEHEAD\_KNOCKOUT\_RADIUS\_PT$. Set $holdStartX = nx + R_{start}$.
     - Clip $holdEndX$ if a subsequent note exists on the same pitch within the system: $maxHoldX = nextNx - NOTEHEAD\_KNOCKOUT\_RADIUS\_PT - 1.0$.
     - On staff lines, use `stroke-linecap="butt"`. In open space, use `stroke-linecap="round"` with $holdStartX = nx + R_{start} + 0.4$.
     - In chevrons: set $chW = 4.2, chH = 2.8, stroke-width = 1.20$, clearance $2.2\text{pt}$.
2. **Update `test/print-layout.test.ts` & `test/notation-variations.test.ts`**:
   - Align all tests to the Landscape 3-page, 3-system layout, slender accolade, zero starting barline, flush hold lines, authoritative chevrons, and system-start measure numbers.
3. **Regenerate Documentation Crops**:
   - Run `npx tsx scripts/render-docs-crops.ts`.
4. **Verification**:
   - Verify `npm test` and `npm run build`.
