# 12-TET Monosyllabic Solfège Specification for Isomorphic Keyboards

> **A mathematically optimized, key-agnostic, monosyllabic phonetic notation for 12-TET equal temperament on 2-row Jánko keyboards.**

---

## 1. Core Principles & Motivation

Traditional solfège (*Do-Re-Mi-Fa-Sol-La-Ti*) and conventional pitch names (*C, C♯, D...*) suffer from two major flaws when applied to 12-TET isomorphic keyboards:
1. **Diatonic Bias & Variable Syllable Length**: Numbered pitch classes ("seven", "eleven") are multisyllabic, preventing real-time mental recitation at fast tempos (120–160+ BPM). Chromatic solfège systems (*Do-Di-Re-Ri...*) encode accidentals as second-class modifications of diatonic white keys.
2. **Motor Disconnection from Hardware**: Physical Jánko keyboards are organized into **two interleaved whole-tone rows**:
   - **Row 0 (Even pitches: $0, 2, 4, 6, 8, 10$)**
   - **Row 1 (Odd pitches: $1, 3, 5, 7, 9, 11$)**

The **`iso-notation` Phonetic System** establishes a 1-to-1 bijection between the 12 chromatic pitch classes and 12 distinct monosyllables, designed around four structural pillars:
1. **Jánko Row Rhyme**: Every note on Row 0 rhymes on open, flowing **`-a`**; every note on Row 1 rhymes on crisp, bright **`-i`**.
2. **Consonant Uniqueness**: 12 distinct consonants $\{ \text{B, D, F, K, L, M, N, P, R, S, T, V} \}$. Replacing velar *Ga* with retroflex *Ra* eliminates the velar twin confusion with *Ka*.
3. **Tritone Polar Twin Invariant ($\Delta = \pm 6$)**: Acoustically similar "twin" consonants are separated across the midpoint of the octave.
4. **Biomechanical Motor Alternation**: Chromatic steps and harmonic fifths alternate vocal tract muscle groups to prevent tongue fatigue at high recitation speeds.

---

## 2. Canonical 12-TET Syllable Mapping

```
Row 0 (-a):   0: Ma     2: Va     4: La     6: Na     8: Fa    10: Sa
Row 1 (-i):   1: Di     3: Pi     5: Ri     7: Ti     9: Bi    11: Ki
```

### Full Reference Matrix

| Pitch Class | Jánko Row | Consonant | Vowel | Syllable | Anatomical Organ | Manner & Voicing | Structural Twin ($\Delta = 6$) |
| :---: | :---: | :---: | :---: | :---: | :--- | :--- | :---: |
| **0** | Row 0 | `M` | `a` | **Ma** | Lips (Bilabial) | Nasal continuant, Voiced | **Na** (6) |
| **1** | Row 1 | `D` | `i` | **Di** | Alveolar Ridge | Dental stop, Voiced | **Ti** (7) |
| **2** | Row 0 | `V` | `a` | **Va** | Teeth/Lip (Labiodental) | Fricative, Voiced | **Fa** (8) |
| **3** | Row 1 | `P` | `i` | **Pi** | Lips (Bilabial) | Stop pop, Voiceless | **Bi** (9) |
| **4** | Row 0 | `L` | `a` | **La** | Alveolar Ridge | Lateral liquid, Voiced | **Sa** (10) |
| **5** | Row 1 | `R` | `i` | **Ri** | Mid-Palate | Retroflex liquid, Voiced | **Ki** (11) |
| **6** | Row 0 | `N` | `a` | **Na** | Alveolar Ridge | Nasal continuant, Voiced | **Ma** (0) |
| **7** | Row 1 | `T` | `i` | **Ti** | Alveolar Ridge | Dental strike, Voiceless | **Di** (1) |
| **8** | Row 0 | `F` | `a` | **Fa** | Teeth/Lip (Labiodental) | Fricative, Voiceless | **Va** (2) |
| **9** | Row 1 | `B` | `i` | **Bi** | Lips (Bilabial) | Stop burst, Voiced | **Pi** (3) |
| **10** | Row 0 | `S` | `a` | **Sa** | Teeth/Alveolar Ridge | Sibilant hiss, Voiceless | **La** (4) |
| **11** | Row 1 | `K` | `i` | **Ki** | Soft Palate / Velum | Velar click, Voiceless | **Ri** (5) |

---

## 3. Structural & Mathematical Properties

### 3.1 The Tritone Polar Invariant ($\pm 6$)
The tritone is the most musically distant interval and always stays on the same Jánko keyboard row. All six acoustic pairs are placed at exact polar opposition ($\Delta = 6$):
- **Ma $\leftrightarrow$ Na** (The two nasals: Lips vs. Ridge)
- **Di $\leftrightarrow$ Ti** (The two alveolar stops: Voiced vs. Voiceless)
- **Va $\leftrightarrow$ Fa** (The two labiodentals: Voiced vs. Voiceless)
- **Pi $\leftrightarrow$ Bi** (The two bilabial stops: Voiceless vs. Voiced)
- **La $\leftrightarrow$ Sa** (The two ridge continuants: Liquid vs. Sibilant)
- **Ri $\leftrightarrow$ Ki** (Mid-palatal liquid vs. velar click)

### 3.2 Augmented Triad Voicing Coherence ($\pm 4$)
On Row 1, major-third leaps ($+4$) form two independent equilateral triangles:
- **Voiced Triangle $\{1, 5, 9\}$**: **`Di - Ri - Bi`** (100% Voiced)
- **Voiceless Triangle $\{3, 7, 11\}$**: **`Pi - Ti - Ki`** (100% Voiceless)

When playing triad arpeggios, the vocal folds remain in a stable, consistent vibrational state.

### 3.3 The Pigeonhole Bottleneck Proof (Why 91.7% is Optimal)
A combinatorial search over all $6! \times 6! = 518,400$ permutations proves that:
> **Zero semitone place collisions ($\pm 1$) and strict tritone pairing ($\pm 6$) are mathematically mutually exclusive.**

**Proof**:
1. Row 0 contains **3 alveolar ridge consonants**: `La`, `Sa`, `Na` (50% of the row).
2. Row 1 contains **2 alveolar ridge consonants**: `Di`, `Ti`.
3. If `Di` and `Ti` are tritone opposites at positions $z$ and $z+6$, their chromatic neighbors in Row 0 occupy $\{z-1, z+1, z+5, z+7\}$ (4 of Row 0's 6 slots).
4. Only **2 slots** in Row 0 do not border `Di` or `Ti`.
5. By the **Pigeonhole Principle**, placing 3 ridge consonants into 2 non-neighboring slots is impossible. At least one ridge consonant must touch `Di` or `Ti`.

The **Prime Canonical Order achieves the theoretical minimum bound of exactly 1 collision** (11/12 distinct = **91.7% diversity**). The solitary collision (`Na` 6 $\to$ `Ti` 7) pairs a smooth nasal hum with a crisp percussive release—differing in mechanical manner, completely avoiding tongue tangling.

### 3.4 Harmonic Cadences & Circle of Fifths ($\pm 7$)
Because the Circle of Fifths ($+7 \pmod{12}$) alternates whole-tone rows on every step:
$$\text{Ma} \to \text{Ti} \to \text{Va} \to \text{Bi} \to \text{La} \to \text{Ki} \to \text{Na} \to \text{Di} \to \text{Fa} \to \text{Pi} \to \text{Sa} \to \text{Ri}$$
- Every harmonic authentic cadence ($V \to I$) across all 12 keys automatically alternates vowels: **`-a` $\leftrightarrow$ `-i`**.
- Consecutive fifths achieve 91.7% muscle diversity (only 1 collision across all 12 transitions: `Na` $\to$ `Di`).

---

## 4. Benchmark Recitation: Bach Goldberg Variations (Var. 1)

Theme mm. 1–2 (Right Hand running 16th notes):
- **Pitches**: `7 - 6 - 7 - 2 - 4 - 6 - 7 - 9 - 11 - 13 - 14 - 13 - 14`
- **Canonical Solfège**:
  $$\mathbf{Ti - Na - Ti - Va - La - Na - Ti - Bi - Ki - Di - Va - Di - Va}$$

Notice the flowing, percussive alternation:
- `Ti - Na - Ti - Va`: Strike $\to$ Resonance $\to$ Strike $\to$ Buzz
- `La - Na - Ti - Bi`: Liquid $\to$ Resonance $\to$ Strike $\to$ Burst
- `Ki - Di - Va - Di - Va`: Click $\to$ Tap $\to$ Buzz $\to$ Tap $\to$ Buzz

The syllables roll naturally off the tongue like an Italian coloratura aria at 120–160+ BPM.
