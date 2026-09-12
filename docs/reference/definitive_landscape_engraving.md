# Definitive Landscape 3-System Engraving Reference

> **Status**: Master Engraving Benchmark (Canonical Reference)  
> **Source Code**: `src/render/print-layout.ts` (functions `computeColumnarLayout`, `renderPageToSvg`, `getVerticalAccoladePath`)  
> **Target Score**: J.S. Bach, *Goldberg Variations* BWV 988, Variatio 1. a 1 Clav.  
> **Direct Checkout Images**:  
> - `reference_landscape_page1.png` (Full Page 1 Spread)  
> - `reference_m1_m2.png` (Accolade + Position of Honor + Title)  
> - `reference_m4.png` (Handedness Chevrons in Action)  
> - `reference_m6.png` (Flush Continuous Staff-Line Hold Line)  
> - `reference_m30.png` (LH Crossing Treble Eighth-Note Run)  

---

## 1. Executive Summary & Design Vision

This layout represents the **climax of the horizontal 12-row isomorphic notation system**. It was painstakingly refined across dozens of engraving cycles to achieve true Henle/Bärenreiter *Urtext* quality.

Whenever the user refers to **"the previous design"**, **"the old perfected layout"**, or **"the landscape benchmark"**, this document describes the exact rules, aesthetics, and geometric invariants they mean.

---

## 2. Core Engraving Invariants

### 1. Title & Header Block
- **Urtext Century Schoolbook Typography**:
  - Title: `J.S. Bach: Goldberg Variations, BWV 988` (`11pt`, 600 weight, fill `#111111`, letter-spacing `0.3px`, centered).
  - Subtitle: `Variatio 1. a 1 Clav.` (`8.5pt`, italic, fill `#333333`, centered).
  - Composer: `Johann Sebastian Bach` (`8pt`, italic, fill `#222222`, right-aligned).
- **Zero Horizontal Rules**:
  - NO `#CCCCCC` header divider lines, NO `#E5E7EB` footer divider lines.
  - Generous pure white breathing room above System 1.

### 2. Accolade (Curly Brace) & Staff Start
- **Copperplate Slender Geometry**:
  - Generated via `getVerticalAccoladePath(x, yTop, yBot, w = 7.0, thick = 0.85)`.
  - Slender copperplate proportions: horizontal width `7.0pt`, central spine swell `0.85pt`.
  - Accolade gap: `7.0pt` from accolade cusp to staff opening.
- **Zero Starting System Barline**:
  - NO heavy vertical opening barline (`stroke-width="1.2"`).
  - Staff lines emerge **openly and cleanly** from the left margin, clasped by the copperplate accolade.

### 3. Staff Topography & Middle C Spine
- **Lightened 2-Line Landmark Staff**:
  - Range: `STAFF_MIN_PITCH = 24` (C2, o1) to `STAFF_MAX_PITCH = 72` (C6, o5).
  - Semitone step: `2.60pt` per semitone (124.8pt total staff height).
- **Stroke Hierarchy**:
  - Middle C (pitch 48 / o3): **Authoritative `1.35pt` dark spine** (`#0F172A`).
  - Octave lines (24, 36, 60, 72): Subtle `0.65pt` solid lines (`#1E293B`).
  - Dropped Line 8: Avoids visual clutter, letting digits float cleanly in pitch space.

### 4. Noteheads & Position of Honor
- **URW Gothic Noteheads**:
  - Base-12 duodecimal digits (`0..9`, `A`, `B` or `a`, `b`) set in URW Gothic (`700` weight for odd rows, `800` for even rows, `6.5pt` font size).
  - Circular white knockout: `NOTEHEAD_KNOCKOUT_RADIUS_PT = 4.8pt`, completely obscuring staff lines behind digits.
- **Position of Honor (Opening Sound Halo)**:
  - Noble concentric halo ring (`OPENING_HALO_RADIUS_PT = 5.8pt`, stroke `0.75pt`) around tick 0 notes in Measure 1.

### 5. Flush Duration Hold Lines & Subsequent Note Clipping
- **Start Radius**:
  - Tick 0 notes: `holdStartX = nx + 5.8pt` (clears halo).
  - Regular notes: `holdStartX = nx + 4.8pt` (clears knockout).
- **Cap Style & Stroke**:
  - On staff lines: `stroke-linecap="butt"` matching staff line width (`1.35pt` for Middle C, `0.65pt` for octaves).
  - In open space: `stroke-linecap="round"`, `stroke-width="0.80pt"`, start offset `+0.4pt` so the round cap never encroaches onto the circular knockout.
- **Subsequent Note Obstacle Clipping**:
  - If another note on the same system and pitch occurs at a future tick, the hold line strictly clips at:
    `maxHoldX = nextNx - NOTEHEAD_KNOCKOUT_RADIUS_PT - 1.0pt`.
  - Hold lines NEVER run through or intersect subsequent noteheads.

### 6. Authoritative Handedness Chevrons
- **Sculpted French Guillemets / Calligraphic Burin**:
  - Dimensions: Width `4.2pt`, Height `2.8pt`, stroke `1.20pt` (or `0.80pt` matching digits).
  - Clearance: `2.2pt` offset clear of the circular notehead knockout.
  - Upward chevron (`^`): Placed above notehead for Right Hand notes playing below Middle C (e.g. Measure 4).
  - Downward chevron (`v`): Placed below notehead for Left Hand notes playing above Middle C (e.g. Measure 30).

### 7. Measure Numerals & Barlines
- **System-Start Only Measure Numerals**:
  - Rendered ONLY above the first measure of each system (m. 1, m. 5, m. 9, etc.).
  - Font: Century Schoolbook italic, `8.5pt`, `#444444`.
  - Zero measure numerals above internal barlines.
- **Internal Measure Barlines**:
  - Crisp, thin vertical rules (`0.85pt` or `1.0pt`) spanning strictly within the staff bounds.
