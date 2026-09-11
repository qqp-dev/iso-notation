# Handedness Indicator Typographic & Calligraphic Tuning

> **Artifact Type**: Calligraphic & Typographic Semiotic Study  
> **Status**: Candidate Evaluation  
> **Context**: Handedness chevrons for crossing notes (`<` for LH in treble register, `>` for RH in bass register) alongside standalone duodecimal digits on the lightened 2-line staff.  
> **Primary Specimen**: [`docs/img/chevron_refined_study.png`](img/chevron_refined_study.png)  
> **Score Context Benchmarks**:  
> - Measure 30 (LH Rapid Eighth-Note Crossing Run): [`docs/img/m30_all_6_variants.png`](img/m30_all_6_variants.png)  
> - Measure 4 (RH Treble Crossing Notes): [`docs/img/m4_all_6_variants.png`](img/m4_all_6_variants.png)

---

## 1. Executive Summary & Design Rationale

When notes cross hands (e.g. Bach *Goldberg Variations* BWV 988, where hands continuously cross registers), the notation must convey which hand plays each note without cluttering the mathematical purity of the pitch numbers.

Early versions used crude vector lines or heavy background badges that obscured the staff. In this study, we elevate the chevron from a primitive computer graphics arrow into a **refined piece of typographic craftsmanship**—drawing inspiration from:
- **Copperplate Music Engraving (Urtext Burin)**: Chiseled stroke modulation with natural thick-and-thin pen angles.
- **French Literary Typography (Guillemets `«` and `»`)**: Graceful flared arms with organic waist swelling (Didot / Bodoni traditions).
- **Fine Stationery & Luxury Letterpress**: Diamond pips and sculpted seals with crisp concave facets.
- **Classical Roman Accolades**: Bracketed serifs that harmonize directly with Urtext roman numerals.

---

## 2. Macro Typographic Specimen

The 6 design directions evaluated side-by-side with standalone duodecimal noteheads (`2` on pitch line 0, `9` in space, and score context `4` and `6`):

![Handedness Indicator Typographic & Calligraphic Tuning](img/chevron_refined_study.png)

---

## 3. The Six Typographic Variants

### Variant 1: Baseline Wire Chevron
- **Geometry**: Uniform $0.7\text{pt}$ stroke, $100^\circ$ roof pitch ($h=2.4\text{pt}, w=1.5\text{pt}$, clearance $1.0\text{pt}$).
- **Character**: Pure functional vector geometry. Neutral and clean, but lacks calligraphic soul or stroke modulation.

### Variant 2: Sculpted French Guillemet (`«`, `»`)
- **Geometry**: Organic concave flared arms with subtle optical waist swelling ($0.9\text{pt}$) tapering to needle endpoints ($0.45\text{pt}$).
- **Character**: Literary French punch-cutting heritage (Didot/Grandjean). Graceful curved flanks that frame the duodecimal digits without competing for visual dominance.

### Variant 3: Broad-Nib Calligraphy (Urtext Burin)
- **Geometry**: $35^\circ$ italic pen angle producing an authoritative $1.15\text{pt}$ downstroke and a delicate $0.50\text{pt}$ hairline upstroke.
- **Character**: Authentic 18th-century copperplate music engraving. Natural weight hierarchy that immediately feels at home next to classical Urtext scores.

### Variant 4: Chiseled Diamond Pip (Luxury Letterpress)
- **Geometry**: Solid sculpted micro-jewel ($h=2.2\text{pt}, w=1.6\text{pt}$) with subtle concave facets and a razor-sharp apex.
- **Character**: High-end business card engraving / playing-card pip. Exceptional distance recognition; the solid punch ensures zero optical blur even at micro scale.

### Variant 5: Calligraphic Guillemet (Curved + Modulated Bow)
- **Geometry**: Harmonious fusion of Variant 2's organic concave curve and Variant 3's pen-angle stroke contrast.
- **Character**: The pinnacle of fluid calligraphic refinement. Softens the digital grid into human calligraphy.

### Variant 6: Roman Serifed Accolade
- **Geometry**: Classical architectural accolade terminating in delicate perpendicular micro-serifs.
- **Character**: Direct typographic harmony with Century Schoolbook / Palatino bracketed serifs. Resonates perfectly with the notehead typography.

---

## 4. Score Context Comparisons

### Measure 30: Rapid Left-Hand Crossing Arpeggio (BWV 988)
In Measure 30, the left hand crosses above the right hand to execute a continuous eighth-note arpeggio ($0 \to 2 \to 4 \to 5 \to 2 \dots$). All six variants rendered in direct succession:

![Measure 30 All 6 Variants](img/m30_all_6_variants.png)

### Measure 4: Right-Hand Crossing Notes
In Measure 4, the right hand crosses downward into the bass register with the `>` indicator:

![Measure 4 All 6 Variants](img/m4_all_6_variants.png)

---

## 5. Summary Matrix & Recommendations

| # | Variant | Primary Character | Distance Legibility | Calligraphic Warmth | Urtext Coherence |
|---|---|---|---|---|---|
| **V1** | **Baseline Wire** | Technical Minimalist | Moderate | Low | Neutral |
| **V2** | **French Guillemet** | Literary Elegant | High | High | Very High |
| **V3** | **Broad-Nib Burin** | Classical Copperplate | Very High | Maximum | Masterpiece |
| **V4** | **Diamond Pip** | Luxury Stationery | Maximum | Moderate | High |
| **V5** | **Curved Bow** | Fluid Calligraphic | High | Very High | High |
| **V6** | **Serifed Accolade** | Architectural Roman | High | High | Perfect Match with Century Serif |

- **Top Calligraphic Pick**: **Variant 3 (Broad-Nib Burin)** for timeless Urtext engraving authenticity.
- **Top Micro-Legibility Pick**: **Variant 4 (Chiseled Diamond Pip)** for unshakeable punch clarity at reading distance.
- **Top Typographic Harmony Pick**: **Variant 6 (Serifed Accolade)** if pairing with **Century Schoolbook** notehead numerals.

---

## 6. Definitive Adoption: Variant 2 (Sculpted French Guillemet)

Following visual evaluation in full score context, **Variant 2: Sculpted French Guillemet (`«`, `»`)** was selected as the **definitive handedness indicator** for `iso-notation`:
1. **Flawless Symmetry**: Unlike the asymmetrical stroke modulation of the broad-nib burin, the French guillemet possesses perfect top-bottom symmetry across the horizontal pitch axis, preserving spatial equilibrium next to notehead digits.
2. **Literary Bookwork Refinement**: The subtle concave sweep and optical waist swelling ($0.65\text{pt}$) frame the URW Gothic numerals with the quiet elegance of fine French punch-cutting (Didot/Grandjean).
3. **Zero Visual Noise**: It provides an unmistakable directional cue without calling unnecessary attention to itself, keeping the performer's focus firmly on the mathematical pitch numbers and the lightened 2-line staff.

