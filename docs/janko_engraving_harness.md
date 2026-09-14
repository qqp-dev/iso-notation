# Jánko Two-Row Engraving Ergonomics Harness

> First-class iteration loop for the **Jánko Two-Row Equator** grand staff:
> a modular engine, a **live two-view web studio**, a **mathematical visual
> linter** and targeted macro crops in sub-second time.

---

## 0. The review loop (read this first)

Design review happens **on the live website**, never by refreshing PNGs:

| Surface | URL | Purpose |
| --- | --- | --- |
| Candidates view | `http://100.102.70.49:5175/janko.html#candidates` | the 2–4 candidates of the *current decision round*, side by side |
| Reference view | `http://100.102.70.49:5175/janko.html#reference` | the golden master: full page spread + macro crops + lint diagnostics |

- `janko.html` is a **Vite entry** that imports `src/render/janko/studio.ts`;
  every SVG is rendered in the browser by the same TypeScript engine used by the
  CLI, so the page **cannot drift** from the engraving code.
- Vite HMR (`import.meta.hot`) re-renders both views in place on every edit
  under `src/render/janko/` — zero user action.
- Candidates are declared in `src/render/janko/candidates.ts`
  (`CURRENT_ROUND_METADATA` + `CURRENT_CANDIDATES`); the page template is never
  edited.
- Zoom: `+`/`−`/`Reset` buttons, `+`/`−`/`0` keys, `Ctrl/⌘ + wheel`, 50 %–300 %.
- `public/janko.html` is a byte-identical mirror of the root entry (the dev
  server serves the public copy verbatim; the production build processes the
  root entry), enforced by `test/janko-studio.test.ts`.

Implementers verify the same engraving **without rendering anything**:

```bash
npm run lint:engraving            # ~60 ms, JSON/strict/quiet flags available
npm test                          # 259 tests, < 4 s, includes the linter + candidate/studio suites
```

---

## 1. The iteration problem

Design rounds on the new Two-Row Equator notation used to cost 15+ minutes per
turn because:

1. **Procedural monolith** — coordinate math and inline SVG string templates
   were hardcoded in one script, so every layout tweak touched dozens of lines.
2. **Whole-page fatigue** — every micro-decision was judged on a full
   3-system A4 page (595 × 842 pt) instead of a targeted macro crop.
3. **Single-variant guessing** — one parameter choice was proposed per turn
   instead of side-by-side candidates in the studio.
4. **Mechanical overhead** — images had to be copied by hand between the
   checkout, `docs/`, `public/` and the main project root.

The harness replaces all four failure modes with the live studio plus the
headless linter:

```bash
npm run dev                 # live two-view studio with Vite HMR
npm run lint:engraving      # the same engraving, verified headlessly in ~60 ms
```

---

## 2. Modular engine (`src/render/janko/`)

```
src/render/janko/
├── types.ts              JankoTokens + JankoLayoutOptions + defaults
├── geometry.ts           pure pitch/tick math (no SVG, no I/O)
├── engine.ts             page / crop / variant composition + shared layout model
├── candidates.ts         declarative candidate registry for the current round
├── linter.ts             mathematical visual linter (knockouts, clearance, beams, corridor)
├── studio.ts             two-view live studio renderer (Vite HMR entry)
└── elements/
    ├── staff.ts          octave equators, opt-in spine/row guides, ledgers
    ├── notehead.ts       white knockout, URW Gothic digit, Position of Honor halo
    ├── rhythm.ts         centred stems · angled cuts · horizontal ticks · beams + flags
    ├── accolade.ts       slender copperplate brace (w = 7.0, thick = 0.85)
    ├── barlines.ts       internal barlines + system boundaries
    └── style.ts          shared typographic style block
```

### Geometry invariants

| Invariant | Value |
| --- | --- |
| Whole-tone rank | `pc mod 2` (0 = evens, 1 = odds) |
| Rank 0 (0, 2, 4, 6, 8, a) | `h/2` **below** its octave equator |
| Rank 1 (1, 3, 5, 7, 9, b) | `h/2` **above** its octave equator |
| Row-to-row step `h` | 15.0 pt |
| Octave equator step | `2h` = 30.0 pt (the o3→o4 step is the 56 pt corridor) |
| Grand staff span | **absolute, hand-independent**: o5 −58 / o4 −28 / o3 +28 / o2 +58 pt |
| Middle C corridor | **spacious spine-free**: 56 pt of negative space (o4 −28 / o3 +28), no dividing rule |
| Horizontal dotted lines | none — the vertical beat-grid pulses are the only dashed elements |
| Position of Honor halo | `R = 6.2 pt` at tick 0 of Measure 1 |
| Notehead knockout | `r = 4.8 pt` around a `5.8 pt` URW Gothic digit (≥ 1.2 pt of white on every side) |
| Digit optical centre | alphabetic baseline dropped half a cap height (`0.739 em × 4/3` per pt) below the head centre |
| Stem attachment | flush on the outer perimeter: `r + 0.2 pt` (regular), `haloR + 0.4 pt` (tick 0) |
| Stem column | `stemX === note.x` (centred on the notehead, both hands) |
| Flag hook reach / drop | `4.0 pt` right of the stem / `6.6 pt` from the tip |
| Minimum head-to-beam air | `noteheadRadius + minStemClearance` = 6.3 pt |
| Channel layouts (Round 4) | `'single-equator'` `+7.5/−7.5 pt` (4 lines) · `'on-the-line'` `0/−15 pt` (4) · `'single-line-3row'` `0/±15 pt` (4) · `'bounded-channel'` `0/±13 pt` with rules at `equator ± 6.5 pt` (8) |
| Channel boundary clearance | `6.5 − 4.8 = 1.7 pt` of clean air around every notehead disc |
| Channel contour | `Δpitch > 0 ⇒ Δy ≤ 0`, `Δpitch < 0 ⇒ Δy ≥ 0` — never inverted |
| Left clasp (Round 5) | `claspX = minX − r − 2.8`, `topY = minY − r`, `botY = maxY + r`, caps `2.2 × 0.85 pt` |
| Clasp duration tip | `≥ 96 t` open pip (whole = double pip) · `48–95 t` bare 8.5 pt spire · `24–38 t` spire + one hook · `≤ 14 t` spire + two hooks |
| Downbeat clasp air | `claspX − barlineX ≥ 4.0 pt`; the measure's left inset grows to `r + claspOffset + claspMinBarlineAir` = 11.6 pt out of its closing margin |

`getEquatorYForOctave` resolves **one** coordinate per octave, identical for both
hands: `octave >= 4` maps to `-halfGap - (octave - 4) * 30`, `octave <= 3` to
`+halfGap + (3 - octave) * 30`. Octaves 2–5 are the four continuous staff rules
and therefore **never** produce ledger lines, whichever hand plays them (the LH
octave-4 and RH octave-3 crossings of mm. 3–4 sit on the true rules instead of
growing phantom cuts inside the corridor). `isOutOfStaffOctave` is strictly
`octave < 2 || octave > 5`; only those out-of-staff pitches emit **dynamic
ledger equators** — one per intervening octave, nearest first. A beam whose
connector passes a foreign notehead of the shared staff is pushed uniformly
further away from its own heads until every such head keeps 6.3 pt of air.

### Channel layouts (Round 4 domain exploration)

`DEFAULT_JANKO_OPTIONS.channelLayout` is `'single-equator'`: the golden master is
untouched, and its engraving is byte-identical with the other framings in place.
`JankoChannelLayout` declares four comparative paradigms, all on the same
absolute octave lattice:

| Layout | Rules/octave | Set A (even pc) | Set B (odd pc) | Lines |
| --- | --- | --- | --- | --- |
| `'single-equator'` (golden) | 1, on the equator | `+h/2` = `+7.5 pt` below | `-h/2` = `-7.5 pt` above, static parity | 4 |
| `'on-the-line'` | 1, on the equator | `0 pt` — centred **on** the rule | `-h` = `-15 pt` above, static | 4 |
| `'single-line-3row'` | 1, on the equator | `0 pt` — centred **on** the rule | `∓h` = `∓15 pt`, contour-resolved | 4 |
| `'bounded-channel'` | 2, at `equator ± 6.5 pt` | `0 pt` — inside the channel | `∓13 pt`, contour-resolved | 8 |

- `getChannelLayoutSpec(options, tokens)` is the single source of truth for the
  table (`setAOffset`, `setBOffset`, `flankMagnitude`, `rulesPerEquator`,
  `staffRules`, `dynamicFlanks`, `setAOnRule`); the studio and the tests
  all read it, and `JANKO_CHANNEL_LAYOUTS` fixes the A–D order.
- `renderStaffLines` paints one rule per staff octave for the first three
  layouts (4 lines across the grand staff) and **two** boundary rules per octave
  for `'bounded-channel'` (8 lines). `renderLedgerEquator` applies the same
  pairing to dynamic ledger equators.
- `usesContourFlanks(layout)` marks the two dynamic framings;
  `resolveChannelFlanks(notes, options, tokens)` resolves the side of every
  whole-tone Set B note (odd pitch classes) **per voice** with a two-state
  dynamic program over the score in tick order: `'up'` = the row above
  (`-flankOffset`), `'down'` = the row below (`+flankOffset`), where the offset
  is `rowHeight` (15 pt) for `'single-line-3row'` and `channelFlankOffset`
  (13 pt) for `'bounded-channel'`. Among the assignments that minimise contour
  contradictions the solver prefers, in order, the flank the local melodic
  direction asks for, no zigzag on a repeated pitch, and finally the canonical
  upper (odd-rank) row.
- The two static framings anchor Set B on a single row, so the solver map is
  empty. `'on-the-line'` and `'single-line-3row'` put every Set A notehead
  **on** the rule, so its knockout cuts that rule — the visibility trade-off the
  round is studying. The linter reports the consequence honestly: on the
  canonical Bach score both anchored framings surface exactly two
  `measure-numeral-collision` violations (the outer Set B row reaches the
  numeral margin at mm. 9 and 29), while `'single-equator'` and
  `'bounded-channel'` stay violation-free.
- The solver is exact and pure, so the layout engine, the linter and the tests
  agree: on the canonical Bach score all dynamic-layout same-hand steps satisfy
  `Δpitch > 0 ⇒ Δy ≤ 0` and `Δpitch < 0 ⇒ Δy ≥ 0`, with hundreds of them
  absorbed as **flat** steps on the center row.

### Chord grouping (Round 5 — left clasp / bracket duration carrier)

A two-row whole-tone staff spreads a chord's tones over several rows, so a
multi-note onset used to be engraved as N independent stems that overlap into one
long vertical line — chopped into segments by every white knockout it passes.
`DEFAULT_JANKO_OPTIONS.chordGrouping` now selects how a vertical simultaneity is
grouped **and** how it carries its duration:

| Mode | Grouping unit | Ink |
| --- | --- | --- |
| `'none'` | — | per-note stems, RH up / LH down (paints a stem of one chord tone through the discs of the others) |
| `'left-clasp-spire'` | one chord / cluster | one external bracket per cluster |
| `'beamed-clasp-rail'` | one chord / cluster | + a measure-bounded rail joining the spire tips |
| `'bounding-phrase'` | one measure (the phrase) | one bracket bounding every note of the measure |
| `'per-hand-clasp'` (golden) | one hand of one onset | one external bracket per hand cluster (a row-snapped spread, or a vertical chord of 3+ heads) |

- **Geometry** — `computeClaspGeometry` draws the bracket outside the cluster:
  `claspX = minX − r − claspOffset`, `topY = minY − r`, `botY = maxY + r`, and the
  path `M (claspX + capW) topY L claspX topY L claspX botY L (claspX + capW) botY`.
  The caps stop `r + claspOffset − capW` = 0.6 pt short of the outermost disc, so
  a bracket can never touch a glyph it clasps.
- **Duration carrier** — the tip carries the cluster's **shortest** member value
  (`claspDurationClass`): an open circular pip for halves (two stacked pips for
  wholes), a clean 8.5 pt spire for quarters, one flag hook for 8ths and two for
  16ths (the `'bounding-phrase'` bracket carries its measure's opening value).
- **Stem replacement** — a clasp member that is **not** part of a beam loses its
  standalone stem; a member inside a beam keeps it, so a real 16th-note beam is
  never cut to pieces by a grouping bracket (no "feathers").
- **Fit rule** — an external bracket protrudes 7.6 pt to the left, which a
  continuous 16th-note grid (columns exactly one disc apart) cannot host. A clasp
  is engraved only where its ink stands clear of every foreign disc by
  `CLASP_NOTEHEAD_AIR` = 1.2 pt, of its opening barline by
  `claspMinBarlineAir` = 4.0 pt and of the left-margin furniture; everywhere else
  the cluster keeps its traditional stems. Only actual chords are clasped — a
  lone melodic note never is.
- **Barline clearance & the inset budget** — a measure whose downbeat carries a
  clasp reserves `r + claspOffset + CLASP_MARK_REACH + claspMinBarlineAir` =
  15.35 pt on the left (the widest Round 11 transverse cut reaches 3.75 pt left
  of the spine), and
  **takes it out of its closing margin**: `left + right` stays at
  `2 × measureInset`, so the note field keeps its canonical width and every
  downstream beat keeps its natural proportional spacing. A measure whose own
  content cannot absorb the shift (the admission loop, `measuresWithColumnCollisions`)
  is demoted back to the canonical margins and loses its bracket instead of
  colliding.
- **Rail (`'beamed-clasp-rail'`)** — `computeClaspRails` joins the spire tips of
  the contiguous clasps of one measure: the topmost tip sets the rail, every
  joined spire is extended up to it, flag hooks are dropped exactly as a
  traditional beam replaces them, and a second rail carries the 16th level when
  two or more 16th-class clasps are joined. A rail spans only its own measure's
  spire columns, so it always terminates inside the measure; a run whose extended
  spire or rail would touch a glyph is engraved unrailed.

### Tokens and options

`JankoTokens` (`rowHeight`, `noteheadRadius`, `haloRadius`, `octaveStep`,
`channelHalfWidth` = 6.5, `channelFlankOffset` = 13.0, `claspWidth` = 2.2,
`claspStrokeWidth` = 0.85, `claspOffset` = 2.8, `claspMinBarlineAir` = 4.0,
`accoladeWidth`, `accoladeThick`, `fontFamily`, plus rhythm/spacing refinements)
and `JankoLayoutOptions` (`measuresPerSystem`, `rhythmStyle`, `interStaffGap`,
`middleCSpine`, `channelLayout` = `'single-equator' | 'on-the-line' |
'single-line-3row' | 'bounded-channel'`, `chordGrouping` = `'none' |
'left-clasp-spire' | 'beamed-clasp-rail' | 'bounding-phrase' |
'per-hand-clasp'`,
`showRowGuidelines`, page/header/footer geometry) are the **only**
places layout constants live. Every renderer accepts partial overrides and
resolves them against `DEFAULT_JANKO_TOKENS` / `DEFAULT_JANKO_OPTIONS`.

```ts
import { renderJankoCrop } from './src/render/janko/engine';

const svg = renderJankoCrop(score, 4, 1, { rhythmStyle: 'beamed' }, { haloRadius: 6 });
```

### Public renderers

```ts
renderJankoPage(score, pageIndex, options?, tokens?): string
renderJankoCrop(score, measureStart, measureCount, options?, tokens?, caption?): string
layoutJankoScore(score, options?, tokens?): JankoSystemLayout[]   // shared geometry model
```

Crops are exact viewBox narrowings of the full page, so a macro crop is
pixel-identical to the corresponding page region — no parallel layout path.
`layoutJankoScore` is the single source of truth for positioned noteheads and
resolved beam geometry; the renderers, the linter and the studio all consume it.

### Visual linter

`lintJankoScore(score, options?, tokens?, lintOptions?)` returns
`{ ok, violations, warnings, diagnostics, stats }` after checking, in ~60 ms:

| Check | Invariant |
| --- | --- |
| Notehead clearance | elliptical masks never overlap (normalized `(dx/rx, dy/ry)` distance); same-row clusters fan at the preset `pairGap = 2rx + air` about an anchored head inside hard beat-cell barriers |
| Knockout coverage | the 5.8 pt digit's ink box stays fully inside the elliptical mask (`rx` per preset, `ry` = 4.8 pt) — pinned for all 12 glyphs |
| Knockout paint order | every digit owns a mask, every mask owns a digit, and nothing painted later may cut through it |
| Stem & beam validity | stems sit on the notehead centreline (`stemX === note.x`), attach **flush on the outside** of their glyph circle (`r + 0.2` / `haloR + 0.4`), land exactly on the beam centerline, slope ≤ 0.25 |
| Stem/digit clearance | no stem comes within 1.2 pt of its own digit glyph box |
| Halo clearance | no stem pierces the Position of Honor ring (outer stroke edge included) |
| Beam/notehead clearance | no beam connector (primary or 16th secondary) comes closer than `noteheadRadius + minStemClearance` to any notehead centre |
| Barline clearance | heads, stems and beams keep ≥ 1 pt from every barline |
| Clasp clearance | no clasp spine comes within `claspMinBarlineAir` = 4 pt of a barline or within 1 pt of a foreign disc, halo or the margin furniture; no rail reaches a barline |
| Clasp dot (Round 20) | every dotted clasp's 0.75 pt dot keeps the house hug (`augmentationDotGap` = 1.2 pt) from its own mark's ink (spine, ring, transverse cut) and from every member disc — a fused nib is `clasp-dot-fusion`, never a graze |
| Rest seat (Round 20) | every rest's **painted ink centroid** stands on its phrase row (the bar forms half a slab above / below it, as their seat declares) — an off-row seat is `rest-centroid-off-row` |
| Unison digit (Round 20) | one onset + one pitch sounds once and paints **one** digit; two painted heads on a merged unison are `unison-double-digit`, with no duration exception |
| Margin furniture | measure numeral and accolade stay on the page, clear of the staff and each other |
| Middle C corridor | no structural rule or beam crosses the corridor centre line; when a spine is opted in it never cuts a glyph |

`npm run lint:engraving [--json|--strict|--quiet]` is the CLI (`0` clean,
`1` violations, `--strict` also fails on warnings).

### Rhythm engraving invariants

- **Centred stems** — `getStemGeometry` engraves every stem on the notehead's
  vertical centreline, so duration indicators begin exactly on the note column
  instead of staggering around a round-notehead perimeter.
- **Standard flags (Round 20: one classical taper)** — solitary / unbeamed notes
  of the `beamed` dialect carry the classical flag hook (U+1D160-class): a
  filled crescent rooted on the stem at the style's root weight (1.1 pt kinetic
  family, 1.4 pt tapered demonstrator, 0.9 pt urtext control), sweeping with the
  stem's own direction and tapering to a point inside `flagWidth` × `flagHeight`
  (two for 16ths, one for 8ths, plus the augmentation dot for dotted values).
  The recorded Round 7–9 rake dialects survive as style keys (they tag their ink
  and pick their root weight) but no longer paint a straight tab. The
  `angled-cuts` and `horizontal-ticks` dialects keep their crossbar identity.
- **Elevated beams** — `computeBeamGroupGeometry` clamps the slope first, then
  raises (RH) or lowers (LH) the baseline until the extreme notehead in the stem
  direction keeps a full `stemLength`; every other stem in the group is longer.
  Ascending/descending runs therefore never see the beam cut through a head. The
  same uniform push clears every foreign notehead of the shared staff by
  `noteheadRadius + minStemClearance`, and — when the system's Middle C spine is
  handed to the solver — keeps the connector entirely out of the corridor
  (`BEAM_SPINE_CLEARANCE` = 2.0 pt, the linter's `corridorClearance`). The
  renderer draws the **resolved** geometry it is given, so the painted connector
  is exactly the one the solver and the linter reason about.
- **No straddling beams** — `partitionBeamGroups` splits a run when a longer
  value of the same hand sits between two beamable notes, so a connector never
  crosses a notehead that is not part of its own group.
- **Left clasps** — `computeClaspGeometry` / `renderChordClasp` /
  `renderClaspGroup` engrave the Round 5 bracket layer beneath the noteheads; the
  layout model carries `clasps`, `claspRails` and `claspedStems`, so the
  renderer, the linter and the studio reason about the very same brackets.

### Round 16 cluster doctrine

- **Shared stems** — one onset + one duration + one hand shares a single stem
  object, carried by the member nearest the nominal column (extremity/id
  tie-breaks); mixed-duration stacks coincide on one visible line with each
  voice's beam/flag at its own end. The stagger is deleted with
  `crowdedColumn`; the linter's `split-stack-stems` violation guards against
  its silent return. A clasped carrier keeps its stem — the one stem the
  bracket does not replace. Coincident beams need no dedupe pass:
  `partitionBeamGroups` excludes every same-hand simultaneity from all runs,
  so two beam groups can never share an identical span (pinned by test).
- **Anisotropic knockout + spacing presets** — the mask is an ellipse: tight
  `rx` per the `clusterSpacing` preset (compact 3.2 / balanced 3.6 / airy 4.0),
  generous `ry` = 4.8 fixed, digits 5.8 pt. Same-row clusters fan at
  `pairGap = 2rx + air` (7.2 / 8.2 golden / 9.2) about an anchored head (the RH
  head when mixed-hand, else the middle), inside beat-cell barriers that also
  keep the linter's barline floor; tick-0 clusters widen to the halo step.
  Clearance is axis-aware: same-row checks use `2rx + air`, stems still attach
  flush at `ry` on the centreline.
- **Dots** — always right of the head, always in the inter-row gap above (the
  canonical lane half a row up, nudged off painted rules), tight to the
  elliptical mask (`rx + gap`).
- **Rests** — ink scaled to 57.5 % linear (`REST_LINEAR_SCALE`), hung from the
  nearest staff rule with the glyph extending toward the Middle C corridor;
  collisions nudge along the rule inside the beat cell, else a named
  `rest-unwritable` diagnostic. Rest ink is identical across spacing presets
  (the spacing question cannot move rest shapes).

### Round 17A rect knockout + spacing solver v2 + dot hug

- **Rect knockout (replaces the ellipse; direct)** — the mask is a sharp
  rectangle: the 5.8 pt digit ink box (half-extents 1.93 × 2.86) grown by a
  uniform margin `m` on all four sides (`wx = 1.93 + m`, `hy = 2.86 + m`), no
  rounding fudge. The 4.8 vertical inheritance ends with the ellipse; stems
  attach flush on the centreline at `hy`; the halo ring is drawn ink,
  untouched. Rows sit 15 pt apart, so only the head's own row line ever
  crosses the hole. Linter: box-based clearance + paint audit (box-vs-box
  containment + margin).
- **Gap amounts (the judged axis)** — `clusterSpacing` is `snug | tight`:
  snug (golden) margin 0.8 / air 0.4 → G = 5.86; tight margin 0.6 / air 0.4 →
  G = 5.46. Gap identity G = 2(1.93 + m) + air, pinned per preset. Judged on
  the carried Round 16 cluster windows (Bach m8/m12/m15, Brahms m8/m9); snug
  passes every gate, tight is reported via its lint chip.
- **Spacing solver v2 (direct)** — (a) unit centring in free space between
  fixed neighbours, clamped to the beat cell (t1032); (b) pin-preserving
  shrink, pair gap = min(G, free room), pinned side holds (m12); (c) local
  spring-relaxation over a ~4-onset sliding window, cells as hard clamps,
  place-then-relax (m15); (d) multi-row interleave at the half-step G/2 with
  the widest row anchoring (Brahms t1392/t1584), shared-stem carrier rule
  unchanged — **superseded by the Round 19 symmetric tuck**; (e)
  clasp-shifted anchor-on-shifted-column, beat-cell + barline-floor barriers
  unchanged, still violations.
- **Dot hug (direct)** — the dot hugs its mask's corner (gap 1.2, lane 3.5
  above the head), always right, uniform sign (`dotY < head`); rule-graze
  stepping stays with high-lane fallback; `dot-collision` stays a
  violation, bar-6 t744 attachment stays.
- **Rest behaviour explicitly out (Round 17B)** — rests, beams, and the m4
  beam-break stay exactly Round 16; rest ink is identical under both gaps.

### Round 17B rest behavior + rest-shape verdict (round 18)

- **Gap verdict (direct)** — `tight` is the golden master (margin 0.6, air
  0.4, G = 5.46); `snug` remains implemented and clean. No head-spacing code
  changes — heads never move in this ticket.
- **Rest weight (direct)** — every rest stroke width returns to its Round 15
  pre-scale value (`REST_STROKE` = 0.90pt, exactly the note stem stroke; the
  bauhaus box 0.6pt, phantom strokes 0.8pt) while extents keep the 0.575
  scale. Size maxima recomputed per value × 4 dialects.
- **Phrase rows (direct; replaces the rule-hang; Round 20 re-seats the glyph by
  its ink centroid — see the Round 20 section)** — the rest reference is
  the phrase row (mean of the releasing/resuming rows, the single neighbour's
  row, or the hand default), snapped to the nearest whole-tone row of the
  phrase octave; the hang-toward-corridor mechanics stay (reference row in,
  rule out), x keeps the in-cell nudge, and a new adjacent-row vertical
  fallback precedes the named unwritten diagnostic. Row over corridor.
- **Beam bridging (direct, narrow; qualifies Round 13)** — a run continues
  across a rest iff it lasts ≤ a 16th, sits strictly inside one beat window
  shared with both flanking beamable notes, and the flank is otherwise
  contiguous (single rests only). The rest is still admitted and printed, and
  the beam solver clears its ink; the new `beam-rest-clearance` linter check
  is a violation. The Round 13 m4 beam break is retired with cause (bridging
  is the intended musical rule, not a regression): m. 4 beats [528, 540, 564]
  under one beam, and the only other qualifying span in either benchmark —
  m. 24 [3408, 3420, 3444] — bridges with it. 8th rests and cross-beat gaps
  still break runs; bar 5 beat 2 re-verifies green.
- **Round 18 verdict setup** — four candidates (the carried dialects) on the
  byte-identical R15 clean windows plus a Bach m4 fixed-context window per
  card; `openAxes: ['restStyle']`; every card engraves under `tight`.

### Round 19 symmetric tuck + overlap unification + grid-on-columns

- **Symmetric tuck (direct; replaces the multi-row interleave)** — one onset
  whose rows carry *different* head counts is re-centred: the widest row(s)
  keep the `1a` fan (roomier-side machinery untouched) and every smaller row
  shifts so its **own middle** (`(minOffset + maxOffset) / 2`) lands on the
  widest row's middle. The ticket's `(maxCount − rowCount) · (pairGap / 2) · d`
  is the special case of a widest row fanned from a head at its end — the
  m. 46 pairs; a middle-anchored triple is already symmetric, so its narrower
  row does not move at all (t1392). Rows of equal count never shift, so an even
  cluster (1+1, 2+2+2, 3+3) coincides exactly. A tuck that would leave the beat
  cell is skipped. m. 46: F5/D3 tuck to 53.88 (the pair columns' midpoint),
  F4/G♯4 hold 51.15, B4/D4 fan to 56.61 — mirror-symmetric about 53.88.
- **Stem joinery (direct)** — two edits make the tucked layouts stem-clean:
  the Round 16 shared-stem carrier ranks against the onset's **laid-out
  column** (`nominalX + shift`, the axis the whole unit was translated to),
  not the stale pre-solve proportional x, so a tucked interior head can no
  longer take the stem and pierce the anchor's disc (Brahms m. 17/t3120); and
  the overlap unification below removes the m. 46 stems altogether. The
  linter's `stem-through-simultaneity` defect these produced (m. 46 at 0.00pt,
  m. 17 at 2.73pt) is pinned as a negative test through `chordGrouping: 'none'`,
  the paradigm with no bracket to own the duration.
- **Overlap-conditional unification (direct)** — where **both** hands of one
  onset produce a Round 6 qualifying group and their spans (heads ± disc)
  overlap or touch, the onset is grouped as **one** bracket spanning every head
  (m. 46: 93.7–178.3; m. 26: 574.96–659.56), instead of two brackets painted
  over one another. Disjoint spans keep Round 6's per-hand brackets unchanged —
  the m. 3 downbeat guard, whose 90pt hand gap must stay split. A unified
  bracket paints **one duration group per hand** (`durationInk`): the open
  half/whole marks at the bracket's own midpoint (m. 46's ring at cy = 136),
  the transverse subdivision marks at their own hand's vertical centre. The
  bracket still carries the shortest member value.
- **The RH anchor (the Round 19 verdict, now the only rule)** — `'rh'` anchors
  the RH tone on a mixed-hand row, the middle head otherwise. The
  `'lower-first'` demonstrator and the `clusterAnchor` option are **retired**
  (Round 20, §F): the operator approved the RH anchor, so the option, its label
  table and the demonstrator card are gone and the behavior is the only path.
  The Round 19 **stack-yield mechanism is dead too — decided against by the R19
  approval, not deferred**: with the unified bracket owning the onset's
  duration, no head ever needs to yield its stem. m. 46 keeps G♯4 on the column
  and fans D4 to 56.61.
- **Beat grid follows the columns (direct; score-wide)** — the dashed pulse of
  a beat that carries an onset is painted through that onset's laid-out column
  (`nominalX + shift`), exposed as `JankoSystemLayout.columns`; an empty beat
  keeps the proportional line, and barlines are untouched. The renderer and the
  linter share one resolver (`resolveBeatPulseXs`), so an audited pulse is
  always the painted pulse. Brahms m. 3's dotted-quarter lines move from
  450.71 / 488.90 / 527.09 to 459.22 / 496.57 / 533.93 (the 8.51 / 7.67 /
  6.84pt left-drift is gone), and the m. 3 pair's bracket spine (526.33) now
  clears its pulse by ≈7.6pt instead of grazing it at 0.76pt.
- **Round 19 registry** — two candidates (A `cluster-anchor-rh`,
  B `cluster-anchor-lower-first`) on the shared case windows (Brahms m. 46,
  m. 26, the m. 3 guard, the chord specimen's triples); `openAxes:
  ['clusterAnchor']`; the mega-vs-split bracket evidence rides the served PNGs,
  never a candidate (grouping is not this round's axis).

### Round 20 optical rest seats + urtext re-cut + unison merge + nib

- **Optical rest seats (direct)** — a rest is no longer seated by the near edge
  of a geometric ink box: the glyph is drawn about its **ink centroid**, and the
  engine places that centroid on the seat point (the beat column and the phrase
  row). The centroid is *data derived from the glyph's own primitives*
  (`restInkCentroidOffset` weighs the very ink the renderer paints — strokes by
  sampled length × width, fills by area), and `restGlyphOrigin` applies it. The
  classical bar pair declares its own seat offset: the **half** slab sits atop
  its row, the **whole** slab hangs below its own (`restSeatOffsetY`), so the
  two silences can never read alike. The linter audits the seat as
  `rest-centroid-off-row` (violation).
- **The urtext re-cut (direct)** — every rest glyph and every flag hook is cut
  against the classical standard at the house 0.90 pt weight (U+1D13B–U+1D140
  proportions): the golden cut is a **slanted stem with oval-headed hooks** for
  the 8th/16th (sweeping left, as the classical rest does), the **true
  serpentine** quarter, and **wide solid slabs** for the half / whole bar; the
  flags are the U+1D160-class **classical taper** (above). Every other dialect
  keeps its shape language and gains the whole-bar form.
- **The whole bar (new value)** — `restValueForTicks` states `'whole'` for a
  192-tick silence, and the engine writes it only where the silence **covers
  exactly one measure** (`isWholeBarSilence`: it opens on a downbeat and lasts
  `ticksPerMeasure`). A wholly silent measure is the one case the "active
  measure" rule cannot demand (the hand has no onset in it), so the whole-bar
  silence is exempt from it; a 192-tick gap opening mid-measure stays unwritten,
  exactly like any other non-standard silence. The Round 15 specimen is now six
  4/4 measures (16th … whole bar + the resume measure), three per system, so the
  whole bar of m. 5 is judged on clean material — the corpus never stated one.
- **The unison merge (direct)** — one onset + one pitch = one sound event =
  **one digit**, on the anchor-winner's column (the RH head). The merged
  duplicates leave the painted head list before the column solve (so nothing
  fans, measures or knocks them out twice) and keep their **rhythm voice**: a
  mixed-duration unison keeps every voice's own stem/beam/flag — the existing
  mixed-duration machinery never assumed a single hand, so no doctrine fork was
  needed — while an exact duplicate (identical durations) carries one rhythm
  statement. Eight unisons merge across the corpus: the Goldberg's final 550/551
  (the two "7"s) and Brahms's seven (one 21/21 pair, six mixed: 84/24, 84/24,
  21/156, 21/132, 21/156, 21/132), all lint-clean with their beams whole. The
  linter's `unison-double-digit` makes the defect class unrepeatable.
- **The clasp nib (direct)** — a dotted clasp's 0.75 pt dot is now a clean
  **satellite** of its mark: `claspDotCenter` searches a deterministic fan
  (up-and-right first, the free lower channel as the last resort) for the point
  nearest the mark that keeps the house dot hug (`augmentationDotGap` = 1.2 pt)
  from the spine, the ring(s) and every transverse cut **and** from every member
  disc (which the bracket's fit rule exempts but the notehead knockout would
  erase). The resolved centre is stored on the geometry (`durationDots`), so the
  painter, `claspInkBox` and the linter measure one datum; the retired `yMid`
  wedge (~1.05 pt of fusion into the ring's stroke on every Brahms dotted half)
  is rejected as an infeasible channel. All 12 Brahms dotted clasps keep
  ≥ 1.20 pt from the mark and ≥ 1.24 pt from their nearest member disc; note
  dots never move (their own lane and coordinates are pinned).
- **Round 20 registry** — a **verification round**: `openAxes: []`, four cards
  on the fixed golden master (rest seats, urtext re-cut, unison merge, clasp
  nib) over the round's own windows (the rest specimen incl. the whole bar,
  Bach's 8th-flag and 16th-double measures, Brahms's seats, the final-bar and
  Brahms unison measures, and Brahms m. 3's nib case).

### Two-view studio

```ts
renderCandidatesView(config?): string   // View 1 · Decision Candidates Matrix
renderReferenceView(config?): string    // View 2 · Golden Reference Object
mountJankoStudio(config?, rootId?)      // DOM mount + tabs + zoom + HMR re-mount
```

---

## 3. Verification

```bash
npm test                          # 297 tests, < 8 s
npm run lint:engraving            # visual lint of the golden master
npm run build                     # tsc + vite (index.html + janko.html entries)
```

| Suite | Locks |
| --- | --- |
| `test/janko-engraving.test.ts` | geometry invariants (rank mapping, lane offsets, 15 pt rows, 30 pt octave steps, unified absolute equator lattice, zero in-staff ledger cuts, halo placement, tick spacing), the bounded center channel (option/token schema, two boundary rules per equator, Set A in the channel, direction-resolved Set B flanks, zero contour contradictions on the canonical score), rhythm invariants (centred stems in every dialect, right-sided flag hooks with no crossbar, full stem length under every beam, no straddling beam group), engine composition (page/crop equivalence, pluggable dialects) |
| `test/janko-linter.test.ts` | the report contract, the clean golden master, the clean bounded channel, every defect class (overlap, undersized/missing knockout, pass-through, beam slope, floating/off-centre stem, beam-notehead collision, barline/accolade/numeral collision, corridor intrusion) and the CLI exit code |
| `test/janko-studio.test.ts` | both views, registry-driven candidates (zero template edits), the Round-4 registry (incumbent vs bounded channel), the golden-master option badges, all-pages-engraved, page-shell navigation/zoom/HMR contract and the `public/` mirror identity |
| `test/janko-round19.test.ts` | the Round 19 cluster law (the RH anchor as the only rule, its option retired): the symmetric tuck's exact m. 46 positions and its score-wide mirror property, the even-cluster coincidence, the beat-cell guard, the overlap unification (m. 46 / m. 26) and the m. 3 split guard, the unified bracket's per-hand duration groups, the `stem-through-simultaneity` signature the joinery owns, and the beat grid's column-following pulses (m. 3, the anacrusis mapping, an empty beat, both scores score-wide) |
| `test/janko-round20.test.ts` | the Round 20 verdict: the **painted** ink centroid (recomputed from the SVG primitives) on the seat point for every value × dialect and every corpus rest, the corpus seat-on-lattice sweep, the bar pair's sit / hang, the specimen's one whole bar, the Bach final-bar single seven, all seven Brahms unisons (one digit, every mixed-duration voice intact), the `unison-double-digit` violation fixture, the 12-clasp nib sweep, the `clasp-dot-fusion` violation fixture on the retired fused geometry, and the note-dot no-move guard |

The same-row 16th cluster `0 2 4 6 2` is exercised as a synthetic engine test
(Bach Variation 1 m. 8 does not contain that literal figure); the m. 8 crop
is the real m. 8 of the canonical benchmark.
