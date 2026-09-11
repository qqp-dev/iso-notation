# Ticket: Fix Measure Number Overlap with m1 and Faint Dotted Continuation for All Colored Holds with Line Replacement

## Kind

bounded

## Problem

1. **Measure Number Overlap with m1 Pitch Label**:
   In `src/render/print-layout.ts`, the measure number was rendered at `x = colStaffLeftPt, y = staffOriginY - 4`, which places it at `y = 82.35pt`, while the `m1` pitch header label sits at the exact same `x = colStaffLeftPt = 42.35pt` and `y = 80.35pt`. They render directly on top of each other! The measure number must be placed in the clean $14\text{pt}$ left margin to the left of the staff (`x = colStaffLeftPt - 4`, `text-anchor: end;`, `y = staffOriginY + 8`), completely clear of `m1`.
2. **Faint Dotted Continuation for All Colored Notes with Staff-Line Replacement**:
   Currently, dotted continuation trails were only drawn for notes with $d \ge \text{ticksPerBeat}$ that had concurrent onsets during their sustain (only 2 notes in Goldberg Var 1). We need faint dotted continuation trails for **all colored notes** (`durationTicks > tauRef`, i.e. 8th notes, dotted 8ths, quarters, dotted quarters, halves, and pedal holds: 165 notes in Var 1).
   - **Line Case**: When a sustained note falls directly on a staff line (octave boundaries $m1\dots m5$, Landmark 5 $E$, Landmark 9 $G\#$), the underlying staff line must be **replaced** by the faint dotted hold line during the sustain via a knockout underlay (`#FFFFFF` in SVG, `#000000` in Canvas) before stroking the colored dotted line (`stroke-dasharray="2,3"`).
   - **Space Case**: When a sustained note is in a whole-tone space (between staff lines), the faint dotted line simply runs through empty space and ends at the release tick.
   - **No Explicit Stop**: No perpendicular stop tick or crossbar at release: the dotted line simply ends, and for line-case notes, the normal staff line naturally continues.

## Testing Plan

1. **Measure Number Positioning & Zero Overlap with m1 (`test/print-layout.test.ts`)**:
   - In `test/print-layout.test.ts`:
     - Assert that `.measure-num` is rendered at `x = (colStaffLeftPt - 4)` with `text-anchor: end;` and `y = (staffOriginY + 8)`.
     - Assert that the measure number coordinate does not overlap with `m1` (which is at `x = colStaffLeftPt, y = colTopPt + 10`).
2. **All Colored Notes Receive Dotted Trails (`test/print-layout.test.ts`, `test/notation-variations.test.ts`)**:
   - In Bach Goldberg Variation 1, every note with `durationTicks > tauRef` (all 165 colored notes: 141 8ths, 19 dotted 8ths, 4 quarters, 1 half/sustain) renders a faint dotted continuation line (`stroke-dasharray="2,3"` in SVG, `setLineDash([2, 3])` in Canvas).
   - 16th notes ($d \le \tau_{\text{ref}} = 12\text{t}$, crisp white noteheads) render ZERO continuation trails.
3. **Staff Line Replacement on Columns (Line Case)**:
   - For notes where `getStaffLineGeometry(lPitch, normStaffStyle).isLine` is true (e.g. octave boundaries $C_2 \dots C_6$, Landmark 5 $E$, Landmark 9 $G\#$):
     - During the hold $[trailStartY, trailEndY]$, the underlying staff line is erased via a knockout underlay (pure white `#FFFFFF` in SVG, `#000000` in Canvas) before stroking the colored dotted trail.
     - Immediately after $trailEndY$, the normal staff line resumes.
4. **Clean Termination Without Explicit Stop Ticks**:
   - Neither line-case nor space-case notes render an explicit perpendicular stop tick or release bar; the dotted line simply ends at $trailEndY$.
5. **Regression & Full Suite**:
   - All tests pass (`npm test`).
   - Clean production build (`npm run build`).

## [bounded]

### Solution

1. **`src/render/print-layout.ts`**:
   - Update `.measure-num` CSS in defs:
     `.measure-num { font-family: ${URTEXT_SERIF}; font-style: italic; font-size: 8pt; fill: #444444; text-anchor: end; }`
   - In `renderPageToSvg`:
     - Update measure number placement (for `m === 0`):
       Place `<text x="${(colStaffLeftPt - 4).toFixed(2)}" y="${(staffOriginY + 8).toFixed(2)}" class="measure-num">${col.startMeasure}</text>`.
     - Update hold trail loop:
       ```ts
       for (const note of col.notes) {
         if (note.durationTicks > tauRef) {
           const { nx, ny } = noteCoordMap.get(note.id)!;
           const lPitch = displayPitchMap.get(note.id)!;
           const geom = getStaffLineGeometry(lPitch, normStaffStyle);
           const isOnStaffLine = geom.isLine;

           const isEven = wholeToneParity(lPitch) === 0;
           const noteHeight = morph === 'phonetic' ? 8.5 : (morph === 'rectangle-square' || morph === 'square-ellipse' || morph === 'square-triangle') ? 5.6 : (isEven ? 6.0 : 5.8);
           const trailStartY = ny + noteHeight / 2 + 2;
           const rawReleaseY = ny + note.durationTicks * ptPerTick;
           const trailEndY = Math.min(rawReleaseY, staffEndY);
           const noteColor = getPrintDurationColor(note.durationTicks, tauRef);

           if (trailEndY > trailStartY) {
             if (isOnStaffLine) {
               const knockoutWidth = geom.isBold ? 2.5 : 1.8;
               svgParts.push(`    <line x1="${nx.toFixed(2)}" y1="${trailStartY.toFixed(2)}" x2="${nx.toFixed(2)}" y2="${trailEndY.toFixed(2)}" stroke="#FFFFFF" stroke-width="${knockoutWidth}" stroke-linecap="butt"/>`);
             }
             svgParts.push(`    <line x1="${nx.toFixed(2)}" y1="${trailStartY.toFixed(2)}" x2="${nx.toFixed(2)}" y2="${trailEndY.toFixed(2)}" stroke="${noteColor}" stroke-width="0.8" stroke-dasharray="2,3" opacity="0.50"/>`);
           }
         }
       }
       ```
2. **`src/render/score-canvas.ts`**:
   - In `renderScoreToCanvas`:
     - In note loop:
       `const showDottedTrail = note.durationTicks > tauRef;`
       `const geom = getStaffLineGeometry(lPitch, normStaffStyle);`
       `const isOnStaffLine = geom.isLine;`
     - In vertical orientation:
       ```ts
       if (showDottedTrail) {
         const trailStartY = cy + noteHeight / 2 + 2;
         const trailEndY = cy + note.durationTicks * options.pixelsPerTick;
         if (trailEndY > trailStartY) {
           if (isOnStaffLine) {
             ctx.save();
             ctx.strokeStyle = '#000000';
             ctx.lineWidth = geom.isBold ? 3.0 : 2.0;
             ctx.beginPath();
             ctx.moveTo(cx, trailStartY);
             ctx.lineTo(cx, trailEndY);
             ctx.stroke();
             ctx.restore();
           }
           ctx.save();
           ctx.setLineDash([2, 3]);
           ctx.lineWidth = 0.8;
           ctx.globalAlpha = 0.50;
           ctx.strokeStyle = noteColor;
           ctx.beginPath();
           ctx.moveTo(cx, trailStartY);
           ctx.lineTo(cx, trailEndY);
           ctx.stroke();
           ctx.restore();
         }
       }
       ```
     - In horizontal orientation:
       Similarly knock out with `#000000` along `(trailStartX, cy) -> (trailEndX, cy)` if `isOnStaffLine`, then stroke dashed line.
3. **Update Tests**:
   - `test/print-layout.test.ts`:
     - Update measure number regex to `<text x="${(col0StaffLeftPt - 4).toFixed(2)}" y="${(staffOriginY + 8).toFixed(2)}" class="measure-num">${col0.startMeasure}</text>`.
     - Update dotted line tests to assert all colored notes render trails with line knockouts and zero explicit stop ticks.
   - `test/notation-variations.test.ts`:
     - Update dotted trail tests in canvas to assert all colored notes have trails and line knockouts.

---

## Verification Results

1. **Measure Number Repositioning & Zero Overlap with m1**:
   - In `src/render/print-layout.ts`, updated `.measure-num` style to `font-family: ${URTEXT_SERIF}; font-style: italic; font-size: 8pt; fill: #444444; text-anchor: end;`.
   - Repositioned the measure number on the first bar of each column to `x = (colStaffLeftPt - 4).toFixed(2)` and `y = (staffOriginY + 8).toFixed(2)`, placing it neatly inside the $14\text{pt}$ left margin completely clear of the $m1$ pitch label at `x = colStaffLeftPt, y = colTopPt + 10`.
   - Verified via unit test assertions that measure number coordinates are strictly shifted into the left margin and do not collide with $m1$.

2. **Faint Dotted Continuation Trails for All Colored Notes**:
   - In `src/render/print-layout.ts` (SVG) and `src/render/score-canvas.ts` (Canvas), updated the trail condition to `note.durationTicks > tauRef` (where $\tau_{\text{ref}} = 12\text{t}$), applying faint dotted continuation lines (`stroke-dasharray="2,3"`, `lineWidth: 0.8`, `opacity: 0.50`) across all 165 colored notes in Bach Goldberg Variation 1 (141 8ths, 19 dotted 8ths, 4 quarters, and 1 half/sustain).
   - 16th notes ($d \le 12\text{t}$, crisp white noteheads) render zero continuation trails.

3. **Staff-Line Knockout Replacement**:
   - For all sustained notes on staff lines (`geom.isLine` is true), rendered a knockout underlay (pure white `#FFFFFF` in SVG with width `2.5pt` for bold lines and `1.8pt` for other lines; `#000000` in Canvas with width `3.0px` / `2.0px`) along the sustain span $[trailStartY, trailEndY]$ before stroking the colored dotted trail.
   - Verified in Bach Goldberg Variation 1 that exactly 38 staff-line sustained notes receive knockouts, erasing the underlying staff line during the sustain while allowing the staff line to naturally continue immediately after note release.

4. **Clean Termination Without Explicit Stop Ticks**:
   - Verified that neither line-case nor space-case notes render perpendicular stop ticks or crossbars at release; dotted continuation lines terminate cleanly at the note release coordinate.

5. **Test Suite & Production Build**:
   - All 86 automated tests pass cleanly (`npm test`).
   - Production build succeeds without errors or warnings (`npm run build`).
