# Cognitive Foundations of Isomorphic Music Notation & the 4-Row Jánko Keyboard

## 1. The Perceptual & Motor Problem of Traditional Music Reading

Traditional Western music notation and the conventional piano keyboard evolved concurrently from medieval vocal chant and liturgical organ design. While historically expedient for the 7-note diatonic modes (Ionian, Dorian, etc.), this historical baggage creates massive cognitive friction when applied to chromatic, polyphonic classical, and jazz literature:

### 1.1 Diatonic Asymmetry ("Diatonic Friction")
- **Non-Isometric Pitch Encoding**: In traditional 5-line notation, the spatial distance between a line and an adjacent space represents either a **minor second** (1 semitone, e.g., $E \to F$, $B \to C$) or a **major second** (2 semitones, e.g., $C \to D$, $F \to G$).
- **Visual Homomorphism of Asymmetric Intervals**: A major third (4 semitones) and a minor third (3 semitones) appear identically as line-to-line or space-to-space skips. The reader cannot determine the physical interval from spatial geometry alone; they must consult the key signature, recall historical accidentals within the measure, and mentally compute the semitone delta.
- **Accidental Clutter & Enharmonic Redundancy**: The 12 equal-tempered pitch classes are forced into a 7-letter nomenclature ($A \dots G$). Consequently, the 5 non-diatonic tones are treated as perturbations requiring sharps ($\sharp$), flats ($\flat$), naturals ($\natural$), double sharps ($\times$), and double flats ($\flat\flat$). The same physical acoustic pitch can be spelled in up to three different ways (e.g., $C\sharp \equiv D\flat \equiv B\times$), increasing visual entropy.
- **Arbitrary Clef Transpositions**: Treble ($G$), Bass ($F$), Alto ($C$), and Tenor ($C$) clefs place identical pitches at different vertical positions on the staff. Reading piano music requires running two disparate spatial decoding algorithms simultaneously in parallel.

### 1.2 Motor Asymmetry on the Conventional Keyboard
- **The 7+5 Keyboard Topography**: The conventional piano layout features 7 wide white keys in front and 5 narrow black keys recessed above. Because of this irregularity, a simple musical gesture (e.g., a major triad or a major scale) requires **12 completely distinct physical fingerings and hand postures** depending on the starting pitch.
- **Cognitive Bottleneck in Classical Literature**: When performing intricate counterpoint such as J.S. Bach's *Goldberg Variations* or rapid syncopated chromaticism like Nikolai Kapustin's *Concert Études*, the pianist's working memory is consumed by key-signature cross-referencing and arbitrary motor patterns rather than structural voice leading, balance, and artistic expression.

---

## 2. The 4-Row Jánko Isomorphic Keyboard

Invented in 1882 by Hungarian mathematician and musician **Paul von Jánko**, the Jánko keyboard resolves keyboard motor asymmetry through a 6-6 whole-tone geometry:

```
[Row 4]  (C#)    (D#)    (F)     (G)     (A)     (B)     (C#)  <-- Duplicate of Row 2
[Row 3]      (C)     (D)     (E)    (F#)    (G#)    (A#)       <-- Duplicate of Row 1
[Row 2]  (C#)    (D#)    (F)     (G)     (A)     (B)     (C#)  <-- Whole-Tone Scale B
[Row 1]      (C)     (D)     (E)    (F#)    (G#)    (A#)       <-- Whole-Tone Scale A
```

### 2.1 Geometric & Mechanical Principles
1. **Two Interleaved Whole-Tone Scales**:
   - Each row consists of keys spaced by a whole tone (2 semitones).
   - Rows 1 and 3 contain Whole-Tone Set $A$ ($\{0, 2, 4, 6, 8, 10\}$: $C, D, E, F\sharp, G\sharp, A\sharp$).
   - Rows 2 and 4 contain Whole-Tone Set $B$ ($\{1, 3, 5, 7, 9, 11\}$: $C\sharp, D\sharp, F, G, A, B$).
2. **Coupled Upper Rows**:
   - Rows 3 and 4 are physically or electronically coupled duplicates of Rows 1 and 2, positioned vertically higher and slightly recessed.
   - Touching Row 3 activates the same pitch as Row 1; Row 4 activates the same pitch as Row 2.
3. **Rigid Hand-Shape Invariance (Physical Isomorphism)**:
   - On a 4-row Jánko keyboard, **any chord, scale, or arpeggio retains an identical physical hand shape and fingering across all 12 keys**.
   - Transposition is reduced to a pure rigid horizontal shift along the keyboard.
   - For example, a major triad is formed by:
     - Root on Row 1: Root (Row 1), Major 3rd (+4 semitones, 2 keys right on Row 1), Perfect 5th (+7 semitones, 3.5 keys right on Row 2 or Row 4).
     - Root on Row 2: Root (Row 2), Major 3rd (+4 semitones, 2 keys right on Row 2), Perfect 5th (+7 semitones, 3.5 keys right on Row 3).
     - Because Row 3 duplicates Row 1, the physical triangular geometry between the fingers is mathematically congruent in both cases!
4. **Ergonomic Span Advantage**:
   - The octave span on a Jánko keyboard is approximately $10\text{ cm}$ (compared to $16.5\text{ cm}$ on a standard keyboard).
   - An average adult hand can effortlessly span a tenth, twelfth, or thirteenth, unlocking previously unplayable polyphonic voicings.

---

## 3. The Isomorphic Notation System

An isomorphic keyboard requires an isomorphic notation system. Reading traditional diatonic notation while playing an isomorphic keyboard forces the musician to mentally translate irregular diatonic notation into symmetric chromatic space, reintroducing the cognitive bottleneck.

`iso-notation` establishes a direct, 1:1 homomorphism between visual score space, mathematical pitch space, and physical keyboard space:

### 3.1 Core Tenets
1. **Zero Diatonic Bias**: All 12 pitch classes have equal visual and cognitive status. There are no "natural" notes privileged over "accidental" notes.
2. **Geometric Proportionality**:
   - Spatial vertical distance on the page is directly proportional to pitch height (semitone delta).
   - Two intervals of the same size (e.g., two minor thirds) always have the exact same vertical distance, regardless of the key or harmonic context.
3. **Whole-Tone Staff / 6-6 Alternation**:
   - Staff lines correspond to Whole-Tone Scale $A$ (Row 1 / Row 3).
   - Intervening spaces correspond to Whole-Tone Scale $B$ (Row 2 / Row 4).
   - A note on a line is played on Row 1/3; a note in a space is played on Row 2/4.
   - The visual topography of the score directly mirrors the physical key choices of the Jánko keyboard!
4. **Lossless Quantized Time Grid ("Fence")**:
   - Time is represented along an axis where duration is proportional to length or cell count.
   - The grid resolution $\Delta t$ is the greatest common divisor (GCD) of all note durations and onset intervals, ensuring exact lossless representation of any polyphonic rhythm.
5. **Deterministic Vector Visualization**:
   - Pure mathematical SVG/Canvas rendering with zero non-deterministic or generative artifacts.
   - High visual contrast, scalable vector graphics, and immediate responsiveness across mobile and desktop displays.

---

## 4. Application to Classical & Jazz Performance

### 4.1 J.S. Bach: Goldberg Variations, BWV 988 (Variation 1)
- **Problem in Traditional Notation**: The two hands cross continuously. In traditional notation, clefs must be swapped back and forth, or lines cross confusingly on the grand staff with ledger lines cluttering the space between staves.
- **Solution in Isomorphic Notation**: Voice paths are rendered in continuous physical pitch space. The hand crossing is visually unmistakable: the right-hand vector path clearly plunges below the left-hand vector path, while the left-hand leaps high above. The physical collisions and hand-clearance requirements on the Jánko keyboard can be anticipated directly from the score.

### 4.2 Nikolai Kapustin: Eight Concert Études, Op. 40, No. 7 ("Intermezzo")
- **Problem in Traditional Notation**: Highly dense jazz harmony with rapid alterations ($D\flat\text{maj9}$, $E\flat9$, $A\flat13$, chromatic passing chords) generates thick forests of double flats, sharps, and naturals, obscuring the underlying voice leading and symmetrical jazz chord shapes.
- **Solution in Isomorphic Notation**: Extended chords appear as clean, recognizable geometric shapes. The symmetrical voice-leading motions (such as tritone substitutions and parallel chromatic shifts) translate to simple parallel visual vectors and identical physical hand shapes on the Jánko keyboard.
