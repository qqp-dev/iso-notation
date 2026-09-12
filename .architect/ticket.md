# Ticket: Horizontal System Layout on Portrait Pages (2-Page Zero-Turn Spread), Classical Vertical Accolade, and Up/Down Handedness Chevrons

## Kind

bounded

## Problem

1. **Vertical Timeline Page Turn Inefficiency**:
   - The vertical timeline layout (descending columns) took 4 full pages for Bach Goldberg Var 1, requiring 3 mid-piece page turns during a 2-minute performance.
   - The user requested switching to **horizontal orientation** (pitch vertical from o1 bottom to o5 top, time flowing left-to-right) laid out on **portrait pages** (A4/Letter).
2. **Portrait 2-Page Zero-Turn Spread**:
   - In Portrait mode, each page comfortably stacks 4 horizontal systems without shrinking the music.
   - With 4 measures per system, each page holds 16 measures:
     - Page 1: Measures 1–16 (Systems 1–4).
     - Page 2: Measures 17–32 (Systems 5–8).
   - The entire 32-measure movement is **precisely 2 pages**, forming a complete zero-page-turn spread on a piano music desk.
3. **Classical Vertical Accolade (Curly Brace)**:
   - In horizontal orientation, the accolade sits in its natural, authentic position: vertically on the **left margin** of each system, clasping the 4-octave staff ($o1$ to $o5$) with its central cusp pointing directly into the bold Middle C line ($o3$).
   - It possesses authentic classical copperplate proportions (~1:10 aspect ratio, height ~125pt, width ~10pt, swelling to ~1.35pt thickness).
4. **Intuitive Up/Down Handedness Chevrons**:
   - Handedness corresponds directly to vertical register:
     - **Right Hand**: Upper register (above Middle C). If RH plays below Middle C, an upward-pointing chevron ($\wedge$) sits above the notehead (*"Right Hand playing down here!"*).
     - **Left Hand**: Lower register (below Middle C). If LH plays above Middle C, a downward-pointing chevron ($\vee$) sits below the notehead (*"Left Hand playing up here!"*).
5. **Staff Topography & Middle C Spine**:
   - Horizontal staff lines:
     - Middle C ($p = 48$, $o3$): bold center spine ($1.35\text{pt}$, `#000000`).
     - Octaves ($p = 24, 36, 60, 72$): solid lines ($0.65\text{pt}$, `#000000`).
     - Landmark 4 ($p = 28, 40, 52, 64$): small dashed lines ($0.6\text{pt}$, `#444444`, `[5, 2.5]`).
     - Local dashed outlier lines (e.g. pitch 76 in mm. 29–30 for high notes).
6. **Horizontal Hold Lines**:
   - Duration trails extend horizontally to the right in the note's duration color (Royal Blue for 8th, Amber for quarter, etc.).
   - On staff lines (especially Middle C): continuous color matching staff line width ($1.35\text{pt}$ for Middle C, $0.65\text{pt}$ for octaves) with `stroke-linecap="butt"`.
   - In open space: $0.8\text{pt}$ lines with `stroke-linecap="round"`.
7. **Opening Sound Position of Honor**:
   - Concentric noble halo ring ($r = 5.8\text{pt}$) around opening notes at tick 0 in Measure 1.
8. **Clean Measure Numbering & Beat Grid**:
   - Measure numbers above each measure's start line in Urtext italic serif.
   - Vertical barlines ($0.75\text{pt}$) at measure boundaries.
   - Vertical dashed pulse lines for beats 2 and 3 (`#D1D5DB`, `stroke-width="0.5"`, `stroke-dasharray="2,3"`).
   - Initial vertical barline at system start ($1.2\text{pt}$) after the accolade.
   - Eliminate confusing margin numeral stacks (like `34`) and column-top octave badges (`o1/o3/o5`).

## Testing Plan

1. **Page Count & System Partitioning Invariants (`test/print-layout.test.ts`)**:
   - `renderAllPagesToSvg` produces exactly 2 pages for Bach Goldberg Var 1 (32 measures).
   - Page 1 contains Measures 1–16 across 4 systems (`sysStartMeasure: [1, 5, 9, 13]`).
   - Page 2 contains Measures 17–32 across 4 systems (`sysStartMeasure: [17, 21, 25, 29]`).
2. **Classical Vertical Accolade Invariant**:
   - Every system renders a vertical accolade `<path d="... Z">` on the left margin spanning vertically from $y_{\text{top}}$ to $y_{\text{bot}}$ with cusp pointing to Middle C at $y(48)$.
3. **Horizontal Staff Topography Invariants**:
   - Middle C is horizontal with `stroke-width="1.35"`.
   - Octave lines are horizontal with `stroke-width="0.65"`.
   - Landmark 4 dashed lines are horizontal with `stroke-dasharray="5,2.5"`.
   - Barlines are vertical across the staff (`y1 = staffTopY`, `y2 = staffBotY`).
   - Beat grid pulse lines are vertical dashed lines (`stroke-dasharray="2,3"`).
4. **Intuitive Up/Down Handedness Chevrons Invariant**:
   - Notes with RH exception (e.g. Measure 4 notes on pitches 45, 43, 42, 36) render upward-pointing chevrons ($\wedge$) above the notehead.
   - Notes with LH exception (e.g. Measure 30 notes on pitches 52, 54, 56, 57, 55) render downward-pointing chevrons ($\vee$) below the notehead.
5. **Horizontal Hold Lines & Middle C Continuity Invariant**:
   - Duration trails extend horizontally to the right (`y1 === y2`, `x2 > x1`).
   - In Bar 6, Middle C note 97 renders continuous Royal Blue hold line (`stroke="#1D4ED8"` `stroke-width="1.35"` `stroke-linecap="butt"`).
6. **Opening Sound Position of Honor**:
   - Opening notes at tick 0 in Measure 1 render concentric noble halo ring (`r="5.80"`).
7. **Regression Suite**:
   - All tests pass (`npm test`).
   - Production build succeeds (`npm run build`).

## [bounded]

### Solution

1. **Refactor `src/render/print-layout.ts` for Horizontal Systems on Portrait Pages**:
   - Update `computeColumnarLayout` / system layout:
     - 4 systems per page, 4 measures per system.
     - Total pages: ceil(32 / 16) = 2.
     - System height: pitch span (48) * ptPerSemitone (2.60) = 124.8pt.
     - Slot height: usable page height / 4 ≈ 178pt (providing ~53pt vertical breathing room between systems).
     - Horizontal measure width: (W_staff / 4) ≈ 130pt per measure.
   - Implement `getVerticalAccoladePath(x, yTop, yBot, w, thick)`:
     - Sculptural vertical copperplate brace on left edge of each system clasping o1 to o5 with cusp pointing to Middle C.
   - Render horizontal staff lines (o1..o5, Middle C spine, landmark 4 dashes, local outlier line at pitch 76 for mm. 29–30).
   - Render vertical barlines and vertical beat grid lines.
   - Render horizontal duration hold lines with continuous staff-line coloring.
   - Render noteheads in URW Gothic with circular knockouts and opening sound noble halo rings.
   - Render Up (^) / Down (v) handedness chevrons.
   - Render clean measure numbers above measure starts in Urtext serif italic.
2. **Update Unit Tests in `test/print-layout.test.ts`**:
   - Update tests to assert 2-page horizontal layout, vertical accolades, horizontal staff lines, vertical barlines, horizontal hold lines, and Up/Down chevrons.
3. **Regenerate Documentation Crops**:
   - Regenerate `docs/img/definitive_m1_m2.png`, `docs/img/definitive_m4.png`, `docs/img/definitive_m6.png`, and `docs/img/definitive_m30.png`.
   - Add `docs/img/horizontal_portrait_page1.png`.
4. **Verification**:
   - Verify `npm test` and `npm run build`.
