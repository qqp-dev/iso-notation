# Ticket: Authentic Hand Attribution (BWV 988 mm. 4 & 24) and A4 Page Layout Optimization (+8.7% Staff Scale)

## Kind

bounded

## Problem

1. **Unplayable Hand Attribution in Measures 4 & 24 of Goldberg Var 1**:
   In `src/scores/bach-goldberg-var1.ts`, in Measure 4 (ticks 504–588) and Measure 24 (ticks 3384–3444), both the leaping bass octaves ($D_3 \to D_2 \to D_3$ and $E_3 \to E_2 \to E_3$) and the rapid descending 16th-note counterpoint were mistakenly assigned to `'LH'`, leaving `'RH'` completely idle. This forced one hand to span up to 16 semitones (e.g. $D_2$ and $F\#_3$) simultaneously at 16th-note speed. In standard keyboard performance editions (Bischoff, Busoni, Henle Urtext, Kirkpatrick), the Right Hand descends to play the 16th-note run while the Left Hand plays the leaping bass.
2. **A4 Page Layout Sub-optimal Horizontal Scaling**:
   Currently, the staff occupies only $211.95\text{pt}$ per column ($4.416\text{pt}$/semitone), while $171.4\text{pt}$ (29% of the A4 page width) is consumed by excessive margins, a $16\text{pt}$ left gutter reserved for beat counter numbers (`1`, `2`, `3`), and symmetrical $15\text{pt}$ buffers. The beat counter numbers are redundant because horizontal dashed pulse lines already clearly indicate beats 2 and 3. By dropping the beat counter numbers, moving the measure number above $m1$, and adopting asymmetric margins ($14\text{pt}$ left clearance before $m1$, $22\text{pt}$ right buffer after $m5$), the staff expands to **$230.4\text{pt}$** (+8.7% width, $4.80\text{pt}$/semitone, ~10% larger noteheads) while still preserving $\ge 8.8\text{pt}$ breathing room for worst-case Landmark 5 outlier notes with outward-pointing stems.

## Testing Plan

1. **Authentic Hand Attribution Invariants (`test/scores.test.ts`)**:
   - In Measure 4:
     - Ticks 504, 516, 528, 540, 564, 576, 588 (the 7 sixteenth notes: $A_3, G_3, F\#_3, A_3, C_3, B_2, A_2$) must have `hand === 'RH'`.
     - Ticks 504 ($D_3$), 528 ($D_2$), 552 ($D_3$), and 600 ($B_2$) must have `hand === 'LH'`.
   - In Measure 24:
     - Ticks 3384, 3396, 3408, 3420, 3444 (the 5 sixteenth notes: $B_3, A_3, G_3, B_3, D_3$) must have `hand === 'RH'`.
     - Ticks 3384 ($E_3$), 3408 ($E_2$), 3432 ($E_3$) must have `hand === 'LH'`.
   - Across all 32 measures of the score, no single hand plays simultaneous onsets spanning $> 12$ semitones.
   - `verifyLosslessGrid(score)` passes.
2. **A4 Columnar Layout & Geometry Invariants (`test/print-layout.test.ts`)**:
   - `colMarginLeftPt` is $14\text{pt}$ and `rightBufferMarginPt` is $22\text{pt}$.
   - Default A4 2-column layout produces `usablePitchWidthPt = 230.4pt` and `ptPerSemitone = 4.80pt`.
   - `colStaffLeftPt` is `colLeftPt + 14`.
   - Right staff bound is `colStaffLeftPt + 48 * ptPerSemitone = colStaffLeftPt + 230.4pt`.
   - SVG does NOT contain `<text class="beat-counter">` elements.
   - SVG DOES contain horizontal dashed pulse lines for beat subdivisions (`stroke-dasharray="2,3"`).
   - Measure number `<text class="measure-num">` is rendered at the top of each column above $m1$ / start of staff.
   - D6 / Landmark 5 outlier tests updated to use the new $14\text{pt}$ left margin and $4.80\text{pt}$ semitone scale.
3. **Regression & Full Suite**:
   - Update `test/notation-variations.test.ts` to reflect the removal of `.beat-counter` text tags while asserting dashed beat pulse lines.
   - All tests pass (`npm test`).
   - Clean production build (`npm run build`).

## [bounded]

### Solution

1. **`src/scores/bach-goldberg-var1.ts`**:
   - Reassign sixteenth notes in Measure 4 (ticks 504, 516, 528, 540, 564, 576, 588) from `'LH'` to `'RH'`.
   - Reassign sixteenth notes in Measure 24 (ticks 3384, 3396, 3408, 3420, 3444) from `'LH'` to `'RH'`.
   - Keep leaping bass notes as `'LH'`.
2. **`src/render/print-layout.ts`**:
   - In `computeColumnarLayout`:
     - Replace `columnMarginLeftPt = 16` and `bufferMarginPt = 15` with:
       ```ts
       const colMarginLeftPt = 14; // Left clearance before m1 (5mm)
       const rightBufferMarginPt = 22; // Right buffer after m5 (7.8mm)
       const usablePitchWidthPt = Math.max(50, columnWidthPt - colMarginLeftPt - rightBufferMarginPt);
       ```
     - `ptPerSemitone = usablePitchWidthPt / pitchSpan` (evaluates to $4.80\text{pt}$ on standard A4 portrait 2-col).
   - In `renderPageToSvg`:
     - Set `colStaffLeftPt = colLeftPt + 14;` (left boundary of m1).
     - Move measure number rendering (for `m === 0`):
       Place `<text x="${colStaffLeftPt.toFixed(2)}" y="${(staffOriginY - 4).toFixed(2)}" class="measure-num" text-anchor="start">${col.startMeasure}</text>`.
       Update CSS `.measure-num` style to `font-family: ${URTEXT_SERIF}; font-style: italic; font-size: 8pt; fill: #333333; text-anchor: start;`.
     - Remove the `<text class="beat-counter">` nodes from `showBeatGrid`. Keep the dashed pulse lines `<line ... stroke-dasharray="2,3" ... />` intact. Remove `.beat-counter` from the style defs or keep it neutral.
3. **Update Tests**:
   - `test/scores.test.ts`: Add test asserting correct hand separation and playable interval spans in mm. 4 & 24.
   - `test/print-layout.test.ts`: Update coordinate formulas to `colLeftPt + 14` and check measure number position.
   - `test/notation-variations.test.ts`: Update beat counter assertions to check pulse lines and verify removal of `.beat-counter` text.
