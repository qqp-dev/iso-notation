# Taxonomy of Classical Musical Symbols & Isomorphic Counterparts

This catalog cross-references the standard symbols of traditional Western classical music notation with their exact equivalents and representations within the `iso-notation` system.

---

## 1. Pitch & Clef Systems

| Traditional Symbol | Traditional Function & Limitations | Isomorphic Equivalent (`iso-notation`) | Cognitive / Motor Advantage |
| :--- | :--- | :--- | :--- |
| **Treble Clef ($G$)** | Anchors $G_4$ on line 2; requires transposition rules. | **Absolute Octave Coordinate ($o \in 0 \dots 8$)** | Eliminates dual-clef cognitive burden; unified visual logic across all registers. |
| **Bass Clef ($F$)** | Anchors $F_3$ on line 4; completely different spatial offsets than treble clef. | **Continuous Multi-Octave Pitch Axis** | Bass and treble are identical in visual scale and spacing. |
| **Alto / Tenor Clefs ($C$)** | Moves Middle $C$ to lines 3 or 4; creates severe reading latency for non-violists/cellists. | **Absolute Linear Pitch Index ($\mathcal{L} = o \times 12 + p$)** | Universal representation across all instruments and registers. |
| **Sharp ($\sharp$) / Flat ($\flat$)** | Modifies diatonic pitch by $\pm 1$ semitone; clutters score with transient accidentals. | **Direct Spatial Elevation / Pitch Class ($p \in 0 \dots 11$)** | Semitones are visually inherent; zero accidental signs needed. |
| **Natural ($\natural$)** | Cancels previous accidental; historical artifact of diatonic bias. | **Inherent in Geometry** | Non-existent; each semitone position is self-sufficient. |
| **Double Sharp ($\times$) / Flat ($\flat\flat$)** | Enharmonic spelling adjustments for key signatures; visually confusing. | **Normalized 12-TET Coordinate** | Single canonical pitch coordinate per frequency. |
| **Enharmonic Ambiguity** ($C\sharp \text{ vs } D\flat$) | Two distinct visual entities for one identical acoustic frequency and piano key. | **Unified Pitch Class $p \in \{0 \dots 11\}$** | 100% 1:1 homomorphism with physical keyboard keys. |
| **Ledger Lines** | Irregular parallel lines extending above/below staves; difficult to count quickly. | **Continuous Whole-Tone Grid Lines** | Pitch position is immediately readable at any distance via octave bands. |

---

## 2. Rhythm, Duration & Time

| Traditional Symbol | Traditional Function | Isomorphic Equivalent (`iso-notation`) | Precision & Invariant |
| :--- | :--- | :--- | :--- |
| **Noteheads** (Whole, Half, Quarter, 8th, 16th) | Non-linear geometric shapes whose duration must be decoded via stems/flags. | **Proportional Duration Vector Span ($\Delta \text{ticks}$)** | Duration is strictly proportional to visual length on the timeline. |
| **Numerical Notehead Option** | None (solfege or ABC occasionally in pedagogical contexts). | **Pitch Class Digit ($0 \dots 11$) inscribed inside notehead** | Instantaneous recognition of harmonic pitch-class sets and chords. |
| **Stems, Flags & Beams** | Indicate duration and meter grouping; can obscure pitch placement. | **Quantized Duration Blocks with Onset Anchor Pins** | Clean horizontal/vertical spans; onset tick is exact integer coordinate. |
| **Augmentation Dot ($\cdot$)** | Increases duration by $50\%$; nested dots ($\cdot\cdot$) create mental arithmetic. | **Direct Integer Tick Length ($\text{durationTicks}$)** | Exact integer length on grid: $1.5 \times T_{\text{quarter}} \implies 72\text{ ticks}$. |
| **Tuplet Brackets** (3:2, 5:4, 7:4) | Indicate non-binary divisions of beat; often visually clumsy. | **Uniform Integer Grid Subdivision ($\Delta t = \gcd$)** | Exact mathematical placement on integer tick grid; zero rounding errors. |
| **Rests** | Distinct symbols for each duration ($𝄽, 𝄾, 𝄿$); negative space. | **Explicit Empty Grid Cells / Rest Interval Spans** | Rest duration is visibly obvious as negative space between notes. |

---

## 3. Meter & Measure Structure

| Traditional Symbol | Traditional Function | Isomorphic Equivalent (`iso-notation`) |
| :--- | :--- | :--- |
| **Time Signature** ($4/4, 3/4, 6/8, 7/8$) | Defines beats per measure and beat unit. | **`TimeSignatureOverlay` + Hierarchical Metric Grid Lines** (Primary beat, secondary subdivision, measure boundary). |
| **Single Barline** | Delimits measure boundary. | **Measure Divider Line + Measure Index Badge**. |
| **Double Barline / Section Break** | Signifies structural section change. | **Section Boundary Marker + Rehearsal Letter Overlay**. |
| **Repeat Signs** ($|:, :|$) | Encloses repeated musical sections. | **Repeat Range Bounds (`repeat-start`, `repeat-end`)** with iteration indicators. |
| **Fermata** ($\fermata$) | Indefinite hold of note or rest. | **Fermata Articulation Badge + Hold Multiplier Overlay**. |

---

## 4. Dynamics, Expression & Articulation

| Traditional Symbol | Traditional Function | Isomorphic Equivalent (`iso-notation`) |
| :--- | :--- | :--- |
| **Dynamic Badges** ($pp \dots ff$) | Subjective loudness indicators. | **Categorical Dynamic Overlay + Normalized Velocity Range ($v \in [0, 127]$)**. |
| **Hairpins** ($<, >$) | Crescendo and decrescendo spans. | **Continuous Linear/Exponential Velocity Envelope Ramp**. |
| **Staccato ($\cdot$)** | Shortened articulation ($50\%$ duration). | **Staccato Flag + Quantized Playback Duration Compression**. |
| **Tenuto (—)** | Full duration and slight emphasis. | **Tenuto Vector Cap** on note duration span. |
| **Accent ($>$) / Marcato ($\wedge$)** | Sharp dynamic emphasis. | **Accent Badge + Velocity Delta Spike ($\Delta v \ge +20$)**. |
| **Slurs & Legato Groupings** | Phrasing curve indicating seamless transition without re-attack. | **Bezier Voice Ribbon Overlay** connecting sequential noteheads in the same voice. |

---

## 5. Piano Pedaling & Hand Coordination

| Traditional Symbol | Traditional Function | Isomorphic Equivalent (`iso-notation`) |
| :--- | :--- | :--- |
| **Sustain Pedal** ($\text{Ped.} \dots *$) | Depresses damper pedal; sustains all vibrating strings. | **Dedicated Continuous Pedal Ribbon Lane** with `down`, `hold`, `change`, and `release` states. |
| **Half-Pedal** | Partial damping technique in Romantic/Impressionist music. | **Analog Pedal Depth Variable ($0.0 \dots 1.0$)**. |
| **Una Corda / Tre Corde** | Shifts keyboard action to hit fewer strings (softer tone). | **Timbral Modality Overlay (`una-corda`)**. |
| **Right Hand / Left Hand** ($\text{m.d.} / \text{m.s.}$) | Assigns passages to hands. | **Voice Hand Attribution (`RH` vs `LH`) + Dual-Color Encoding**. |
| **Hand Crossing Indicators** | Dotted lines or awkward clef shifts when hands cross. | **Vector Hand-Crossing Lane & Elevation Highlights** clearly showing LH physical path above/below RH. |

---

## 6. Symmetrical Chord & Hand-Shape Notation (Jánko Specific)

A distinctive feature of `iso-notation` with no equivalent in traditional notation:

| Isomorphic Symbol | Function & Definition |
| :--- | :--- |
| **Hand-Shape Polygon** | A convex vector polygon drawn between simultaneous chord tones, visually confirming that chords of identical quality (e.g., all Dominant 7th chords) maintain the exact same geometric shape regardless of root pitch. |
| **Row Parity Badges ($R_1 \dots R_4$)** | Indicates whether a note is played on Row 1 (WT-A front), Row 2 (WT-B mid), Row 3 (WT-A upper), or Row 4 (WT-B top) to optimize ergonomic finger flow. |
| **Whole-Tone Line Shading** | Alternate row background tinting (Set A vs Set B) providing instantaneous eye guidance to the corresponding Jánko keyboard row. |
