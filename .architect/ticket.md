# Ticket: Full-Screen Immersive Score: Drop Jánko Overlay & Floating Sidebar

## Kind

bounded — UI layout decluttering, full-viewport score canvas, and floating controls sidebar.

## Problem

The workbench interface currently has three stacked top bars (header, scrub bar, preset toolbar) taking up ~100px of vertical height, and the Jánko keyboard component taking up bottom height. The operator has directed:
1. Drop the Jánko keyboard overlay entirely.
2. Replace the static top banners with a floating tap/click widget ("floaty thing to tap/click") that opens the controls sidebar, dedicating 100% of the screen estate to the pure isomorphic score canvas.

## Testing plan

1. **Full-Viewport Score Canvas Invariant**:
   - The Jánko keyboard component is completely removed from the main viewport.
   - The canvas container spans the full viewport (`fixed inset-0 h-[100dvh] w-screen`) with zero static top or bottom chrome pushing the canvas down.
2. **Floating Action Trigger ("Floaty Thing") Invariant**:
   - A compact, semi-translucent floating pill / trigger button is positioned unobtrusively over the canvas (e.g., top-right or top-center).
   - Shows quick status (e.g., Play/Pause toggle and measure badge) and an options trigger (`⚙` / `≡`).
   - Tapping/clicking it smoothly opens the sidebar drawer (`ControlsDrawer`).
3. **Complete Sidebar Controls**:
   - `ControlsDrawer` contains all necessary workbench controls:
     - Playback transport (Play/Pause, scrub slider, measure/beat counter, BPM tempo multiplier).
     - Curated design presets.
     - Staff Topography selector.
     - Notehead Morphology selector.
     - Color Mode selector.
     - Timeline orientation toggle.
4. **Verification**:
   - `npm test` passes.
   - `npm run build` succeeds cleanly.
   - Live workbench at `http://100.102.70.49:5173`.

## [bounded]

### Budget

1 quick iteration.

### Solution

1. In `src/ui/App.tsx`:
   - Remove `<JankoKeyboard />` from the JSX tree.
   - Remove the static `<header>` and the static scrubber/toolbar divs from the document flow.
   - Add a sleek floating pill (`fixed top-3 right-3 z-40 flex items-center gap-2 bg-black/80 backdrop-blur border border-neutral-800 ...`) with:
     - Quick Play/Pause button.
     - Measure indicator (`M1:B1`).
     - Sidebar toggle button (`⚙` / `≡`).
2. In `src/ui/ControlsDrawer.tsx`:
   - Ensure the scrub slider, measure indicator, presets, and all display options are cleanly organized inside the slide-out drawer.
3. Update tests in `test/notation-variations.test.ts` to verify full viewport layout and drawer integration.

