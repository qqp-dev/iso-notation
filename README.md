# `iso-notation`

> **Presentation-Agnostic Lossless 12-TET Music Notation System & Deterministic Vector Visualization Workbench for 4-Row Jánko Isomorphic Keyboards.**

[![Orca Registered](https://img.shields.io/badge/Orca-Registered-blue)](file:///home/qqp/projects/iso-notation)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue)](file:///home/qqp/projects/iso-notation/tsconfig.json)
[![Vite HMR](https://img.shields.io/badge/Vite-HMR-646CFF)](file:///home/qqp/projects/iso-notation/vite.config.ts)

---

## 1. Overview & Philosophy

Traditional 5-line musical notation was invented in the medieval era for 7-note diatonic vocal chant on white keys. When applied to polyphonic and chromatic piano literature, it imposes severe **diatonic friction**:
- **Non-isometric pitch spacing**: The visual distance between a line and space can be either 1 or 2 semitones. Minor and major thirds look identical.
- **Accidental clutter**: 5 out of 12 equal-tempered pitches are burdened with sharps, flats, and naturals.
- **Clef schizophrenia**: Reading treble and bass clefs simultaneously requires running two completely different spatial decoders.
- **Motor asymmetry on standard pianos**: Standard 7+5 keyboards force performers to memorize **12 unique physical fingerings** for identical musical structures (e.g. scales, triads, arpeggios).

**`iso-notation`** resolves this systemic asymmetry by pairing a **pure mathematical 12-TET data core** with the **4-row Jánko isomorphic piano keyboard**:

```
[Row 4]  (C#)    (D#)    (F)     (G)     (A)     (B)     (C#)  <-- WT-B duplicate
[Row 3]      (C)     (D)     (E)    (F#)    (G#)    (A#)       <-- WT-A duplicate
[Row 2]  (C#)    (D#)    (F)     (G)     (A)     (B)     (C#)  <-- Whole-Tone Set B
[Row 1]      (C)     (D)     (E)    (F#)    (G#)    (A#)       <-- Whole-Tone Set A
```

On a 4-row Jánko keyboard:
- Any chord or scale has the **exact same physical hand shape across all 12 keys**. Transposition is a pure horizontal translation.
- The keyboard span is compact (~10 cm per octave vs. 16.5 cm on standard piano), allowing average hands to span tenths and thirteenths effortlessly.
- Isomorphic notation mirrors this geometry directly: lines represent Whole-Tone Set A (Row 1/3), spaces represent Whole-Tone Set B (Row 2/4). Note spacing is strictly isometric with frequency.

---

## 2. Core Architecture

1. **Lossless Quantized Data Core ("The Fence")**:
   - Zero-based pitch coordinates: `(pitchClass: 0..11, octave: 0..N)` where Octave 0 is the lowest octave on an 88-key piano ($A_0, B\flat_0, B_0$), with linear index $\mathcal{L} = \text{octave} \times 12 + \text{pitchClass}$.
   - Exact integer time quantization where grid resolution $\Delta t$ is the minimal interval (GCD) required to losslessly map every onset and duration.
   - Hierarchical overlays for meter, barlines, dynamics, articulations, pedaling, and hand crossing.
2. **Deterministic Vector Visualization Workbench (Zero Generative AI)**:
   - Pure mathematical SVG/Canvas rendering with sub-pixel precision (no diffusion or LLM hallucination).
   - Pluggable notation renderers:
     - **6-6 Whole-Tone Staff Lines vs. Continuous Chromatic Grid**
     - **Numerical Noteheads ($0 \dots 11$) vs. Classic Shapes**
     - **Color Spectrums (Chromatic 12-hue wheel, Whole-Tone duality, Voice/Hand separation)**
     - **Horizontal vs. Vertical Timelines** (Vertical timeline aligns directly with horizontal Jánko keys!)
   - **Synchronized 4-Row Jánko Keyboard Component**: Real-time vector visualization of active keys and hand-shape polygons verifying physical hand-shape isomorphism across transpositions.
   - **Polyphonic Web Audio Synthesizer**: Audition pitches and hear score playback in real time.
3. **Canonical Benchmark Excerpt**:
   - **J.S. Bach**: *Goldberg Variations*, BWV 988 — **Variation 1** (dynamic two-part hand-crossing counterpoint, wide register leaps, motoric 16th notes).
4. **Tailscale-Accessible Mobile Workbench**:
   - Touch-friendly interface with pinch-to-zoom, panning, and collapsible controls drawer for mobile devices.
   - Configured for Tailscale access at `http://100.102.70.49:5173`.

---

## 3. Quickstart

### Prerequisites
- Node.js (v22+)
- npm (v10+)

### Setup & Run
```bash
# Install dependencies
npm install

# Run dev server accessible over local network & Tailscale
npm run dev

# Run test suite
npm test

# Production build
npm run build
```

When running, the workbench is available locally at `http://localhost:5173` and across your Tailscale mesh at `http://100.102.70.49:5173`.

---

## 4. Documentation & Design Studies

### Active Design Specifications & Typographic Studies
- [**Duodecimal Notehead Numeral Typographic Specimen & Engraving Study**](docs/duodecimal_font_typography.md)
  *Classical Urtext serif (Century Schoolbook), Calligraphic Roman (Palatino), Engineered Monospace (JetBrains Mono), and Geometric Modernism; Lining Caps A/B analysis and score context benchmark.*
- [**Handedness Indicator Typographic & Calligraphic Tuning**](docs/chevron_tuning.md)
  *Tuning study for hand-crossing indicators (`<` and `>`): French guillemets, broad-nib burin engraving, luxury letterpress diamond pips, and Roman accolades across mm. 4 & 30.*
- [**Definitive Lightened 2-Line Staff Topography**](docs/definitive_duodecimal_lightened_staff.md)
  *Elimination of staff line 8 for maximum visual breathing room; 2 landmark lines (bold octave 0 and dashed fifth 4) paired with duodecimal noteheads.*

### Foundational Architecture & Specifications
- [Cognitive Foundations & Isomorphic Philosophy](docs/philosophy.md)
- [12-TET Monosyllabic Solfège Specification](docs/phonetics.md)
- [Quantized Grid ("Fence") Model Specification](docs/grid-model-spec.md)
- [Classical Symbol Taxonomy & Isomorphic Catalog](docs/symbol-taxonomy.md)


---

## 5. Project Roadmap

- [x] **Phase 1: Foundations & Core Model** (Ticket `f229e347`)
  - Pure 12-TET lossless quantized grid score core
  - 2-row Jánko keyboard vector model and hand-shape isomorphism engine
  - Canonical Bach Goldberg Variations benchmark
  - Interactive mobile workbench with multi-perspective vector renderers
- [ ] **Phase 2: MIDI & MusicXML Lossless Ingestion Pipeline**
  - High-precision GCD quantizer for standard MIDI and MusicXML files
  - Automatic voice and hand-crossing partitioning heuristics
- [ ] **Phase 3: Hardware Jánko MIDI Controller Integration**
  - Web MIDI API bidirectional input/output
  - Real-time performance recording, sight-reading trainer, and tempo tracking
- [ ] **Phase 4: Multi-Movement Classical Library & Export Engine**
  - Complete Bach *Goldberg Variations* and *Well-Tempered Clavier*
  - Vector PDF / SVG export for physical high-resolution sheet music printing
