# Round 47 — long-value symbols, the half-ring flat face and the tie-origin simplification

> **Round 48 correction (authoritative).** The operator rejected two explanations
> this document used: (1) that a long-value member "must explicitly state 96" and
> (2) that the m. 33 D6 carries 144 "while the member states 96". The settled rule
> is: a member's indicator may be **absent** where the bracket's inheritance
> together with the following written tie/destination instruction makes the value
> clear, and a misleading indicator is never added merely to label a written
> component. The source durations, the bracket's own carried value and the
> sounding totals are all untouched — see `docs/round48-rest-provenance-and-tie-trace.md`
> §2 and the Round 48 card captions for the corrected wording.


Status: **implemented, review-repaired, not judged.** Everything below is measured on the real
engine (`layoutJankoScore` / `renderSystem` / `renderJankoCrop`) and on the visual linter's own
report. Aesthetic acceptance is the operator's, at normal size, on the live studio; this
document records the contract, the citations and the bounded audits — it makes no claim
that the operator accepted anything. The independent review verified the engine/layout/golden
contract and failed three operator-facing statements plus one evidence claim; the repair pass
(round 47d) corrected the mm. 1–3 caption's pitches and the m. 67 cue
(`brahmsWindow()` in `src/render/janko/candidates.ts`), §2's breve wording here and §7's
canonical strict invocation; `test/janko-round47.test.ts` §F now pins those claims against
the score itself.

Live review surface: `http://100.102.70.49:5175/janko.html#candidates` (Round 47).
The Reference view (`…#reference`) is the Round 46 approved spacing baseline and Bach GOLD,
both byte-frozen by this round.

---

## 1. What the round changes, and what it must not touch

Accepted fixed context (unchanged by every card): 95 % admitted-cluster scale, 0.30pt
optical air, `parity-columns` literal pitch placement, source written ties, the one
45-degree cut grammar, four systems per page, and the pagination of the Round 46
Reference.

New, candidate-gated, **inert by default**:

| key | default | what it does |
| --- | --- | --- |
| `tokens.halfRingGap` | `0` | optical air a half-ring's flat face keeps from the line it stands on. Positive: the mount line is **interrupted** across the chord (bracket spine and/or horizontal carrier line) and resumes `gap` clear of each end. |
| `options.exceptionCarrier: 'symbol'` | `'none'` | the **long-value** exception statements detach: pure symbol ink seated beside the owning head (or pair), no horizontal arm. Short-value (1–4 cut) exceptions keep their existing arms. |
| `options.longDurationStyle: 'open-oval'` | `'midpoint'` | the experimental hollow-oval family for the long values on **every** mount. Inert unless `bracketDurationGrammar === 'midpoint'`. |
| `options.tieOriginIndicator: 'omit-outgoing'` | `'source'` | a long-value origin whose committed written chain declares an outgoing tie omits its own individual long mark. |

Defaults are provably inert: `DEFAULT_JANKO_OPTIONS`/`DEFAULT_JANKO_TOKENS` keep their
previous values, Bach GOLD hashes to `ccfcaecca058aa1ed7d37291d765a8ef58ed79e428c732f338f298fb5b7a104f`,
and the Brahms Reference reproduces page 0 (`205db94a…`) and its whole-score crop
(`43f95a22…`) byte for byte — the committed Round 46 hashes. Declaring the new defaults
*explicitly* on the Reference changes nothing (same two hashes).

## 2. The four cards (registry `src/render/janko/candidates.ts`)

All four share one family, one window set and one omission rule; they differ only in the
keys their badges name.

| card | `halfRingGap` | `exceptionCarrier` | `longDurationStyle` | declaration |
| --- | --- | --- | --- | --- |
| 1 `round47-mounted-control` | 0 | `horizontal` | `midpoint` | the incumbent vocabulary on the incumbent mounts |
| 2 `round47-half-ring-cutout` | 0.30 | `horizontal` | `midpoint` | same ink, the flat face now breaks the mount |
| 3 `round47-detached-symbols` | 0.30 | `symbol` | `midpoint` | 96 half-ring / 192 ring / 384 two rings, **arm-free** |
| 4 `round47-detached-ovals` | 0 (unused) | `symbol` | `open-oval` | 96 tilted oval / 192 broad oval / 384 breve, on every mount |

Shared premise (every card, axis **not** counted as a difference): `tieOriginIndicator:
'omit-outgoing'`.

Windows (identical on all four cards, `brahmsWindow()`): mm. 1–3, 7–9, 33, 61–63, 64–66 and
the single literal **m. 67** — added only because the score's breve values (the m. 67 F4 and
the m. 69 chord, whose written tie carries it on through m. 70; 384 ticks) lie outside the
requested range, and 384 is the one long value the other five windows never state. No page
spread, key band or synthetic specimen is carried into this round.

Legend shown to the operator: 48 ticks to the quarter, so **96 = half note, 192 = whole
note, 384 = breve (double whole)**.

## 3. Measured behaviour on the canonical Brahms score

Census of the painted long-duration marks (`durationInkOwners`) and of the omissions
(`tieOriginSuppressions`), whole score, per card:

| card | bracket marks | carrier / symbol marks | spine gaps | omissions | refusals | lint |
| --- | --- | --- | --- | --- | --- | --- |
| 1 control | 56 (53 half-ring, 2 ring, 1 two-ring) | 16 arms (8 ring, 7 half-ring, 1 two-ring) | 0 | 5 | 0 | 0/0 |
| 2 cutout | 56 | 16 arms | 53 | 5 | 0 | 0/0 |
| 3 detached | 56 | 16 symbols (14 seated right, 2 above) | 53 | 5 | 0 | 0/0 |
| 4 ovals | 56 (53 narrow, 2 broad, 1 breve) | 16 symbols | 0 | 5 | 0 | 0/0 |

The five omissions (m. 33 `448` = 96 ticks, m. 53 `734` = 96, and the m. 61–63 chain's three
non-terminal long components `858` = 192, `858~c1` = 192, `858~c2` = 96) are published on
each system with the head that continues them. The terminal component, the bracket's own
carried value, every pitch, onset, sounding total, tie arc and solved column are untouched
(the layout's head positions and every arc are identical to the Reference's).

Ink geometry, measured at the 95 % admitted scale:

* the bracket's half-ring: r = 2.0064pt, stroke 0.73986pt, chord 4.0128pt tall; with
  `halfRingGap: 0.30` the spine stops 0.30pt clear of each chord end and the two spine
  subpaths are the only difference between cards 1 and 2 (no diameter stroke, no mask, no
  erasure: the gap is a hole in the bracket's own path).
* the horizontal half-ring: r = 1.672pt; the carrier line is cut the same way.
* detached seats: symbol ink (marks + breve flanks + dots) seated at the nearest legal
  position. The published 2.34–3.21pt is the seat solver's `distance`: the shortest distance
  from the owning head's centre **point** to the symbol's axis-aligned ink box
  (`detachedSymbolInkBox`), computed as
  `hypot(max(box.x0 − p.x, 0, p.x − box.x1), max(box.y0 − p.y, 0, p.y − box.y1))` in
  `seatDetachedSymbol`. An adjacent seat is constructed at the head’s knockout half-extent
  plus the 0.30pt air (`{ seat: 'right', x: p.x + e.wx + air − origin.x0, … }`), so the
  number is a centre-point-to-ink-box metric — not a centre-to-centre separation (m. 9:
  owning head centre x = 45.90 vs symbol x = 50.22) and not the visible notehead ink to
  symbol ink clearance. It is never an 11.46pt arm.
* open ovals (carrier mount): 96 → 1.10 × 1.04pt tilted −30°, 192 → 1.84 × 1.04pt
  horizontal, 384 → the same oval plus two 0.99pt flanks 2.34pt from the centre (bracket
  mount ×1.20 on the ring radius, per the landed Round 46 mount policy).

## 4. The symbol constraints (and where they come from)

The round's geometric/provenance rules, as enforced by the engine and linter (aesthetic readability is *not* machine-enforced):

1. **Every painted long mark names its owners.** `JankoDurationInkOwner` records mount, run
   name, owner ids and seat centre; `checkDurationInkOwnership` reports
   `duration-mark-orphan` (no owner), `duration-mark-suppressed-owner` (every owner continued
   by a written tie) and `duration-mark-unknown-owner` (an owner id that is not laid out).
2. **No mark is ever erased and none erases.** The cutout removes ink from the mount's own
   path; detached symbols are `fill="none"` and are seated clear of every note knockout,
   every bracket ink box, every symbol already seated and every drawn staff rule
   (`symbol-seat-rule-conflict` catches a regression). The oval family closes its shape only
   on a mount, where the white interior knocks out the line it stands on — the full ring's
   own long-standing behaviour.
3. **The family paints no notehead, stem or beam.** Long marks are single closed shapes or a
   half-ring; the augmentation dot stays a separate satellite (`data-symbol-dots`,
   `janko-detached-dot`) and the cut values keep the 45-degree slash. These are geometric
   facts about the ink, checked by the engine/tests — they do **not** guarantee that no mark
   reads as a pitch, a note or a tie. That readability call is an operator-reviewed criterion
   on the live cards, not a property the engine or the linter enforces.
4. **One value, one statement.** A value the bracket carries is never re-stated by a member;
   a shared statement names both owners and is only withdrawn when redundant for **all** of
   them; a value with no exact reading is refused and published, never rounded.
5. **The flat face is placed by rule, not by accident.** `halfRingGap: 0` documents the
   incumbent treatment (chord coincident with an unbroken mount); a positive value documents
   the cutout. A detached half-ring never sits on a drawn rule.

### Cited prior practice (retrieved for this round)

Retrieved 2026-09-20 (HTTP 200, verbatim):

* **SMuFL 1.4, Noteheads table** (`https://w3c.github.io/smufl/latest/tables/noteheads.html`):
  `U+E0A0 noteheadDoubleWhole` — *“Double whole (breve) notehead”*; `U+E0A1
  noteheadDoubleWholeSquare` — *“Double whole (breve) notehead (square)”*; `U+E0A2
  noteheadWhole` — *“Whole (semibreve) notehead”*; `U+E0A3 noteheadHalf` — *“Half (minim)
  notehead”*. This is the direct shape evidence that the three values are three distinct
  open shapes, and that the breve's family includes a flanks/strokes variant.
* **LilyPond 2.24, Notation Reference — Writing rhythms**
  (`https://lilypond.org/doc/v2.24/Documentation/notation/writing-rhythms`): *“The durations
  of notes are entered using numbers and dots. The number entered is based on the reciprocal
  value of the length of the note. … For notes longer than a whole use the `\longa` – double
  breve – and `\breve` commands.”* and, in the *Alternative breve notes* snippet: *“Breve
  notes are also available with two vertical lines on each side of the notehead instead of
  one line and in baroque style.”* — the citation behind card 4's *breve = whole-value oval
  plus two short vertical flank strokes*.
* **LilyPond 2.24, Notation Reference — Writing rests**
  (`https://lilypond.org/doc/v2.24/Documentation/notation/writing-rests`): *“A full-measure
  rest is printed as either a whole or breve rest, centered in the measure, depending on the
  time signature.”* — the value/centring principle the Round 21 rest seats already follow
  (unchanged here).

**Newly retrieved facts vs the experimental adaptation.** The SMuFL glyph names and the
LilyPond sentences above are newly retrieved quotations. The round's *ratios* — a 0.66-wide
oval tilted 30°, a 1.10 : 0.62 broad oval, flanks 0.30 radii clear of the vertices — are this
notation's own algebra fitted to the existing ring metrics; they are an **adaptation**, not a
measurement of any engraving font, and no glyph outlines were copied. The orientation/breadth
principle has traditional precedent — an ordinary half-notehead is already oblique and
narrower than the whole-notehead — but this family's experimental tilt angle (−30°) and its
0.66/1.10/0.62 ratios are this notation’s own algebra, not measured from any engraving font’s
outlines; the tilt exists so 96 differs from 192 by orientation as well as by breadth.

Earlier in-scope citations (not re-retrieved this round, already used by the landed
surfaces): Gould, *Behind Bars* (the repository's binding reference) and the pinned LilyPond
compiled MIDI/LilyPond source behind the Brahms provenance sidecar.

## 5. Bounded source audit — the five operator passages

All numbers/ids below are read from the round's own engraving (control card unless stated);
the Reference is identical except for the five omissions. They are **engine-emitted artifacts**
(what the runtime engraving does); they are not by themselves evidence of what the written
source says or of what a rest/note *means* musically. §§5.2–5.3 mark where that bites.

### 5.1 m. 9 (tick 1584), source “57B57”

* five RH heads on one column (x = 45.90): `114` pc5 o3 144, `115` pc7 o3 144, `116` pc11 o3
  144, `117` pc5 o4 192, `118` pc7 o4 192 → the literal 5/7/B/5/7 the operator named.
* the bracket carries **144** (`spineX = 38.30`, mark at y = 539.57): one half-ring
  (r = 2.0064pt) plus one augmentation dot.
* the two 192-tick members are the semantic exception, not spurious: the bracket's carried
  value (144) is literally the first voice's move-on, and 192 is a real written value in the
  source. They are **one** same-hand/same-onset/exact-duration 2-span pair, so Round 46's
  rule gives them **one** statement, owned by both ids:
  `owner 118 + 117, x 40.17…51.63, y 516.60, base 192, rings 1`.
* ownership clarity: the shared statement is centred on the pair's column, 3.62pt above the
  upper member, and 7.0pt clear of the nearest drawn rule (509.6). Both members are untied,
  so the shared mark survives the round's omission rule. In cards 3/4 the same statement is
  a detached symbol at the solver's published 2.34pt centre-point-to-ink-box distance
  (card 3: x = 50.22, y = 520.22; see §3).

### 5.2 m. 66 (12528–12720), the “suspect rest”

**Engine facts (verified).** The emitted LH eighth rest sits at **tick 12528** (x = 182.57,
y = 184.97); at that onset the runtime LH hand assignment has no note (its next assigned LH
note is `909` at 12552), while the tied A2/D3 continuations `905~c1` / `906~c1` are assigned to
RH heads at x = 173.67. `restClearsLayout` keeps the emitted rest clear of those heads. The
second rest, an RH quarter at **12576** (x = 204.64, y = 197.47), fills a 48-tick hole in the
runtime-assigned upper hand beside `911` (LH) and the unequal voice `910`. These ticks/ids/
hands/x are engine outputs, not source readings.

**Not source-proven.** The pinned LilyPond source (`data/sources/brahms-op118-no1/includes/
intermezzo-op118-no1-parts.ily`, sha256 `d8783f90…` = the provenance sidecar) writes the m. 66
lower-voice onset as the spacer `s8` (line 321) — an *invisible* rest, not a printed `r8` —
while other source voices do carry material at tick 12528 (provenance segments in
`leftHandUpper`/`rightHandUpper`). The emitted rest therefore represents a runtime
assigned-hand gap in the engraving. That the original score prints a rest at this position,
and that a rest is musically warranted, are **not** established by the pinned source or by the
engine output; nothing is deleted.

### 5.3 m. 70 (13296–13488), the “fourth-beat rest”

**Engine facts (verified).** Meter 2/2 (192 ticks); the emitted rest is an **LH quarter at tick
13440** (x = 266.57, y = 375.96), on the fourth quarter’s own beat column (the measure’s
column sequence is 173.67 · 189.15 · 204.64 · 220.12 · 235.61 · 251.09 · **266.57** · 282.06).
The LH-assigned six-eighth arpeggio (`949`…`954`) ends at 13440; the only notes the runtime
assigns at 13440 are the **RH** `955` (pc9 o1, 48) and `956` (pc1 o4, 24).

**Not source-proven.** The same pinned `.ily` moves the lower voice’s final eighths to the
upper staff at that point (`\voiceUp`, line 327; `global-variables.ily:115` defines it as
`\change Staff = "upper"` + `\voiceFour`), and the runtime hand corrections likewise assign
the 13440 note to RH. The emitted LH rest is therefore a consequence of the staff/hand
assignment in the runtime engraving — not evidence of a source-written LH rest and not proof
that a printed rest (or an independent lower-voice silence) is musically warranted. How the
source engraving notates this beat, and which hand should carry it, remains unresolved.

### 5.4 The apparent m. 72

* source: 71 measures, `totalTicks = 13632`, last system index 17 (`isFinalSystem`).
* slot grid (verified): `measuresPerSystem = 4`, `measureWidth = 135.87pt`,
  `staffLeft = 31.80`, `staffRight = 575.28`; slot start ticks **13104, 13296, 13488, 13680**
  with **11, 9, 7, 0** notes respectively.
* cause: the final system fills all four slots and paints an interior barline at each of its
  135.87pt boundaries (measured x = 167.67, 303.54, 439.41) with the final barline at
  `staffRight` = 575.28 — i.e. the closing 144-tick measure sits at the left of its slot and
  is followed by a completely empty nominal slot (m. 72) closed by the score's final barline.
  Nothing is painted inside it; it is pagination, not music, and no note is renumbered.
* bounded future fix (explicitly **not** attempted here, to keep the Reference layout
  byte-identical in a symbol round): clip the final system's slot grid to the score's last
  measure and place the final barline at the closing measure's true end.

### 5.5 Ties mm. 61–63 and m. 65 — side, obstacle and end shape

Measured arcs (identical on all four cards — the omission removes marks, never ties):

| chain | components | side | axis y | chord x | depth | barline | published stem crossings |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `858` (m. 61–63, E2 504 ticks) | 11568→11760 | −1 (above the pitch) | 786.47 | 40.33→171.14 | 3.00 | yes | `860`@130.7, `859`@115.2 |
| | 11760→11952 | −1 | 786.47 | 176.20→307.01 | 3.00 | yes | none |
| | 11952→12048 | −1 | 786.47 | 312.07→368.95 | 3.00 | no | none |
| `901` (m. 65) | 12360→12432 | −1 | 193.01 | 55.81→106.83 | 2.33 | no | `903`@68.8 |
| `903` (m. 65) | 12384→12432 | +1 | 190.68 | 71.30→101.37 | 3.00 | no | none |
| `905` (m. 65→66) | 12432→12528 | +1 | 201.93 | 110.71→171.14 | 3.00 | yes | none |
| `906` (m. 65→66) | 12432→12528 | −1 | 180.51 | 105.25→171.14 | 3.00 | yes | none |

* Confirmed: every arc keeps its endpoints outside both heads' knockout boxes by
  `tieEndpointAir`, every arc is a uniform-stroke quadratic path with **butt** caps
  (`renderJankoTieArcs` passes no `stroke-linecap`), so its ends are blunt by construction —
  the “fixed-stroke butt-ended geometry” the operator saw is real and is *the whole family's*
  shape, not a defect of these passages.
* Confirmed collisions: two measured stem crossings on the m. 61–63 chain (`860` at x = 130.7
  and `859` at x = 115.2, both fully inside their stems) and one in m. 65 (`903` at x = 68.8,
  overlap 3.03pt) — all published on the arc (`data-tie-stem-crossings`), none hidden. Ties
  paint beneath the rhythm layer, so the stems stay unbroken.
* Operator concerns **not** reproduced as defects here: no blocked arc and no missing anchor
  exists in these passages (`tieAnchorShortfalls`/`tieBlockedArcs` are empty), and no arc is
  clipped. Taper/routing redesign (side control, tapered ends, corridor routing) is the next
  scoped work — this round explicitly does not touch tie shape.
* m. 27's 7/A proximity remains accepted (unchanged by this round).

## 6. What is accepted, what is a question, and what is explicitly out of scope

* **Accepted before this round (unchanged):** 95 % cluster scale, 0.30pt optical air, the
  one 45-degree cut grammar, the written ties, literal pitches, the Round 46 long-value
  vocabulary on the Reference, the Bach GOLD and Brahms Reference bytes.
* **Open questions (operator judgement at normal size):** does the cutout flat face read as
  deliberate at 0.30pt; do the detached symbols hug their owners legibly; does the open-oval
  family distinguish 96/192/384 without counting; and does the omission rule remove ink the
  operator considers redundant without losing the value statement? The four cards are the
  surface for that judgement; nothing here is promoted.
* **Out of scope, by the ticket:** three-ring families, lossy value equivalence, stem-per-note
  symbols, tie-curve/end-shape redesign, the final-system pagination fix, source-rest edits,
  golden option/token edits, Bach GOLD, template/HTML work, and any generated image.

## 7. How to verify

```
npm test                            # 990 tests, incl. test/janko-round47.test.ts
npm run lint:engraving -- --strict  # 0 violations, 0 warnings on all five canonical surfaces
npm run build                       # tsc + vite build
```

Strict forwarding is verified, not assumed: npm 11 parses a bare flag that follows the script
name itself, so `npm run lint:engraving --strict` prints `npm warn Unknown cli config
"--strict"` and runs **non-strict** (measured on npm 11.19.0); the `--` separator is what hands
`--strict` to `tsx scripts/lint_engraving.ts`. `test/janko-linter.test.ts` pins the canonical
invocation — npm's own echo shows the executed line
`tsx scripts/lint_engraving.ts --quiet --strict`, the gate exits 0 and prints
`clean violations=0 warnings=0` — and the direct `npx tsx scripts/lint_engraving.ts --strict`
gate exits 0 as well.

`test/janko-round47.test.ts` pins: the inert defaults and the two byte-frozen Reference
hashes; the exact source-chain omissions, the terminal component and the untied shared
partner (both synthetic fixtures and the real m. 61–63 chain); the crop/system-boundary
behaviour; the cutout spine geometry (gap ends, two subpaths, no diameter stroke); the
arm-free detached seats with independently recomputed clearances; the oval family's three
shapes and the absence of any three-mark stack; the ownership census on every card; a
clean lint plus a real render of all six windows on all four cards; and the operator-facing
claims themselves — the mm. 1–3 caption names the window's own 192-tick exceptions (E5 at
m. 1, C5 at m. 3), the m. 67 cue names its breve F4 and places the score's other breve values
in m. 69 (never m. 70), and this recipe teaches the forward-safe strict invocation.
`test/janko-linter.test.ts` adds the round's defect class: orphaned, suppressed-only and
stale-owner duration marks, and a detached seat crossing a drawn rule — plus the CLI contract
that `npm run lint:engraving -- --strict` really forwards the flag (npm's own echo shows
`tsx scripts/lint_engraving.ts --quiet --strict`).
