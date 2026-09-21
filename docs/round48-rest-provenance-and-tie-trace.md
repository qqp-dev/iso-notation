# Round 48 — rest provenance, the traced tie, its measured routing and the detached circle

> Two real-engine cards on **one fully corrected Brahms surface**. The round is a
> set of corrections, not a new vocabulary: both cards carry every one of them and
> differ in exactly one declared axis — the detached closed circle's size and its
> air from the owning pitch symbol. The Reference keeps every landed decision; the
> candidate-scoped keys are named below and nothing is promoted.

---

## 1. Rest provenance — the source's own hand decides

**Committed evidence.** `npm run brahms:export-durations` now reads the pinned
LilyPond source twice (determinism enforced) and writes the authored silences of
all four voices to a new sidecar, `src/scores/data/brahms-op118-no1-source-silences.json`
(145 entries: **44 written rests**, **101 spacers**), while the validated 964-note
duration fixture and its provenance stay byte-identical (the sidecar is separate
on purpose). The listener records `rest-event` (*a written rest*) and `skip-event`
(*an invisible spacer*) as different facts:

| evidence | tick | voice | kind | source |
| --- | --- | --- | --- | --- |
| the m. 66 LH gap the engine used to invent a rest in | 12528 · 24 ticks | `leftHandLower` | `skip` | `:321` (`s8 a4.*1/3~ …`) |
| the m. 66 RH quarter the source really writes | 12576 · 48 ticks | `rightHandUpper` | `rest` | `:99` (`a4 r <d d'>2`) |

**Source hand mapping.** `BRAHMS_VOICE_HAND` in `src/scores/brahms-source-fidelity.ts`
authors the mapping from the source's own part grouping (`rightHand` owns
`rightHandUpper`/`rightHandLower`; `leftHand` owns `leftHandUpper`/`leftHandLower`)
and cites it there. The **staff is never used as hand evidence** — a repeat can
unfold to a different performed staff than the printed one, and the source's hand
identity survives that while the staff destination does not.

**On the model.** Every sounding event carries `NoteSourceProvenance`
(`voices`, `staves`, `hands`, `unison`) — attached at the score builder before the
bounded hand corrections, so the corrected notes keep their source fact. A
cross-voice unison may legitimately state both hands (the m. 61 E2 is
`leftHandLower` **and** `rightHandUpper`), and then both hands really sound.

**The engine rule** (permanent, not an m. 66 patch): an inferred hand-rest is
withheld when the **source's own hand sounds through its span**, and when the
displayed hand's own ink (from any system — a written tie continuation, a long
value) still sounds under it. Nothing is painted for a withheld silence and the
displayed hand assignments are left exactly as the committed corrections state
them; the withheld record names the sounding notes and voices. A painted rest is
classified **authored** when a source-written rest of the same hand covers its
span, and **inferred** otherwise.

**Measured outcome** (whole score): 22 silences painted (was 24), **2 withheld** —
m. 66's tick-12528 LH eighth (`leftHandUpper` sounds through 12528–12552) and
m. 70's tick-13440 LH quarter (`leftHandUpper`/`leftHandLower` sound there) — and
the m. 66 tick-12576 RH quarter stays, classified authored with origin
`:99`. Both facts are published as `'info'` diagnostics
(`rest-inference-withheld`, `rest-inferred`) in the Reference record and in the
CLI, listed but never gating: `'info'` is a new severity, so `--strict` still
gates only defects.

## 2. No redundant member stem — in any carrier mode

Round 45's rule ("a bracket member whose own value *is* the bracket's carried
value keeps no shared stem") was gated on `exceptionCarrier: 'horizontal'`, so
Round 47's `'symbol'` cards re-enabled the old Round 16 shared stems: 40 groups /
93 suppressed members against the Reference's two. The gate now reads
`exceptionCarrier !== 'none'` (the canonical `'none'` reserve is the documented
historical surface), and the confirmation is measured: `'symbol'`, `'horizontal'`,
both cards and the Reference all publish **the same two shared stems** — the two
independently justified 192-value pairs whose own value the bracket's carried 144
does not state. The m. 7 first RH cluster (all five members 96) paints no member
stem; the second cluster's genuine 48-tick difference is unchanged.

## 3. The detached symbol — one right seat, the staff line cleaned locally

* Every detached long-value statement takes the **right** seat: on the owning
  head's own pitch line, its ink box starting exactly `tokens.detachedSymbolAir`
  from the head's knockout edge (a shared 2-span pair stands right of the pair's
  own right edge at the pair's mid pitch). The former left/above/below/channel
  candidates existed for one measured reason — the right seat used to be rejected
  where it crossed a drawn staff rule — and that reason is gone.
* A drawn rule is **not** an obstacle: it may cross a **closed ring** only through
  its hollow interior, with the whole rule ink band inside that interior, and then
  the rule is cleaned out locally (`ruleKnockouts`) exactly as a notehead knockout
  cleans the line behind its glyph. The eraser is one white band per recorded
  rule, clipped to the interior's inscribed circle, painted **before** the tie
  arcs and before every carrier mark, so it can never touch a tie, hold, head,
  stem, bracket or sibling symbol. Measured seats: m. 3 (tick 432) and m. 13 —
  the two seats Round 47 displaced *above* the note — now stand right on their own
  pitch line with the rule band cleaned inside the ring. A half-ring may never be
  crossed (its flat face must stay legible), and the two m. 66 bracket-edge cases
  are handled by the tie's own chord clip (§4), not by moving the symbol.
* **The one axis** (both candidates, nothing else differs):

| card | `detachedRingScale` | `detachedSymbolAir` | closed-circle outer Ø at the 95 % scale |
| --- | --- | --- | --- |
| A · `round48-circle-090-air-060` | 0.90 | 0.60pt | 3.96pt → 3.56pt |
| B · `round48-circle-088-air-080` | 0.88 | 0.80pt | 3.96pt → 3.48pt |

  The scope is the detached **closed ring** only: the half-ring keeps its shape
  and size (it receives the increased spacing alone — measured identical box size
  on both cards), and neither the bracket mount nor the horizontal carrier is
  resized. The measured motivation: the ring's 3.96pt outer diameter against the
  `0` digit's 3.67pt advance left a 0.30pt visible gap — the operator's "0.30pt"
  observation is exact. The canonical tokens stay inert
  (`detachedRingScale: 1`, `detachedSymbolAir: 0.30`), so the Round 47 geometry and
  Bach GOLD are byte-identical.

## 4. The tie — traced, then routed on measured ink

### 4.1 The traced contour (source and provenance)

The project's tracing precedent measures an authoritative source outline and
records it exactly (Round 21 §A traced every rest constant to a fontTools outline
extraction of Bravura, corroborated against Noto Music; Round 22 transplanted the
contours verbatim). No tie glyph exists in the locally available reference fonts,
and both committed Brahms editions (`docs/reference/*.pdf`) are page scans rather
than vectors, so the round traces the strongest available vector exemplar: **the
tie LilyPond 2.26.0 paints** — the compiler that produced this score's pinned
source — extracted from its own SVG output in the engine's local grob units
(×4.984pt per staff space; `lilypond -dbackend=svg` on `c'8~c'8`, `c'4~c'4`,
`c'2~c'2`, `c'1~c'1` and `c'1~|c'1`):

```
M1.1810 3.7500 C2.2921 4.6560 7.8199 4.6560 8.9310 3.7500
  L8.9310 3.7500 C7.8199 4.5360 2.2921 4.5360 1.1810 3.7500 z    (7.75 sp)
M0.8521 3.7500 C1.2833 4.2735 2.1251 4.2735 2.5563 3.7500
  L2.5563 3.7500 C2.1251 4.1535 1.2833 4.1535 0.8521 3.7500 z    (1.70 sp)
```

* **contour** — *two* cubic boundaries (never one stroked curve), closed with `z`,
  control points at 14.3 % / 19.9 % / 22.7 % / 25.3 % of the chord in the four
  measured specimens: a wide flat crown, not a peaked midpoint-control arc;
* **tips** — *pointed*: both boundaries share both endpoints, because the inner
  control offset is the outer one minus the mid thickness. No butt end exists in
  the family;
* **profile** — the boundaries differ by **0.12 staff space** (0.598pt at the
  4.984pt space) at *every* measured span, identical for an eighth-note tie and
  for a two-bar tie; with the shared cubic construction that is a mid thickness of
  `0.75 × 0.598 = 0.449pt`, tapering to zero at both tips;
* **span adaptation** — LilyPond declares `details.ratio 0.333` with
  `height-limit 1.0` staff space, and its measured apexes (3.39pt at a 38.6pt
  chord, saturating; 2.87pt at 19.3pt; 2.45pt at 13.0pt; 1.96pt at 8.5pt) come
  from a *penalty optimizer*, not a closed form. This engine therefore keeps its
  own deterministic span law (`tieArcDepth`, a 0.10 chord fraction clamped to
  `tieMinDepth..tieMaxDepth`) and scales the traced profile to that apex — the
  **shape** is the measured one, the **span** adaptation is this notation's own
  declared rule, recorded here rather than passed off as traced.

Implemented as `tokens.tieApexThickness` (0.45pt) and
`tokens.tieControlFraction` (0.21 = the median of the four measured fractions)
behind `options.tieProfile: 'traced'`; the canonical `'uniform'` profile (the
Round 46 single quadratic of constant 0.70pt stroke, butt caps) is unchanged, so
the Reference keeps its own contour while receiving the routing below.

### 4.2 Measured routing (shared by every surface)

The side decision now reads **real ink**, not a route label: every painted stem,
every bracket's ink box, every rest glyph and every hold connector of the system
is an obstacle, and the side is chosen by (collisions, then outside-texture
clearance, then detour, with the conventional side winning ties). One side is
chosen **per written chain**, so consecutive arcs of one tie never alternate above
and below their pitch, and a bracket standing between the two heads clips the
chord so the arc stops clear of it (the measured `clasp:12432` / `clasp:12624`
cases of mm. 65–66; the clip keeps the longer surviving chord and never leaves a
stub).

Measured outcome (identical on the Reference and on both cards):

| case | before | after |
| --- | --- | --- |
| m. 33 D6 tie | below, threading between the D6 and D5 note rows | **above** its note, clearing the D5 head |
| m. 61–63 E2 chain (3 arcs) | above, crossing the A2/A3 stems (2 published crossings) | **below** its note, one side for all three arcs, **no** crossing |
| m. 65 A2/D3 ties | A2 above, crossing the D3 stem (3.03pt) | both below, no crossing |
| m. 66 residue | D3/F3 ties grazing a stem and the cluster bracket | clear: bracket-clipped chord, no stem crossing |
| whole score | 1–5 published stem crossings | **0** stem crossings; no arc enters a foreign head or bracket |

`tieBlockedArcs` and `tieAnchorShortfalls` are empty on every surface, and the
linter's new `symbol-tie-conflict` / `symbol-seat-*` checks read the same
predicates the seat solver and the painter do.

## 5. What is accepted, what is a question, and what is out of scope

* **Accepted before this round (unchanged):** 95 % admitted-cluster scale, 0.30pt
  optical air, the one 45-degree duration grammar, literal low pitches, the
  committed written ties, the Source/state of the Reference surfaces.
* **Shared corrections landing on every surface:** the rest-provenance rule and
  its published classification, the redundant-stem suppression in every carrier
  mode, and the measured tie routing (a collision fix, so the Reference receives
  it; its bytes were regenerated accordingly).
* **Candidate-scoped (not promoted):** the traced tie contour, the detached
  `'symbol'` mount, the `omit-outgoing` inheritance rule, the 0.30pt flat face and
  the two circle readings. The working Reference keeps the horizontal carrier, the
  uniform contour, every origin stated and the unbroken half-ring chord.
* **Open questions (operator judgement at normal size):** does the traced tie
  read as the established form; is the 0.90/0.60pt circle the better of the two
  readings; does the m. 3 / m. 13 rule knockout read as a clean interior; and does
  the withheld-rest record answer the "is this rest invented?" question on the
  real page.
* **Out of scope:** any change to Bach GOLD; a new visible voice-rest grammar;
  score-wide hand relabelling; promote-and-land of any candidate aesthetic; a
  Brahms PDF export; and any generated review image.

## 6. How to verify

```
npm test                            # 1008 tests, incl. test/janko-round48.test.ts
npm run lint:engraving -- --strict  # 0 violations, 0 warnings (6 info notes published)
npm run build                       # tsc + vite build
npm run brahms:export-durations -- --check   # the sidecar is reproducible
```

Strict forwarding is verified, not assumed: npm 11 parses a bare flag after the
script name itself as npm configuration, so `npm run lint:engraving --strict`
runs **non-strict** — the `--` separator is what hands `--strict` to
`tsx scripts/lint_engraving.ts`.

Visual impact: **affected** (Brahms Op. 118 No. 1 only; Bach GOLD byte-identical).
The served site is `http://100.102.70.49:5175/janko.html#candidates` — two cards,
twelve literal windows (mm. 1–3, 7–10, 13, 33, 61–66, 70) — with the Reference at
`http://100.102.70.49:5175/janko.html#reference`. Operator visual acceptance is
separate from these measurements and is not claimed here.
