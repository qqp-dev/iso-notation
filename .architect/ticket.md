# Ticket: Round 21 — Measured Duration Ink (complete parts whole→64th) + Slabs Onto Lines + Lower-First

## Kind

bounded

## Scope of this delegation

Round 21 ONLY (§§A–F + testing plan). Explicitly OUT (operator-ruled):
spacing/justification tightening (Gould-governed; dedicated round —
see operator ruling on scope item 6); 128th-note glyphs/machinery and
beyond (past the working set); breve/longa (past the working set);
retired rest dialects (leave their shapes alone); clasp ring/slash
SHAPES (our own paradigm invention — no classical source exists to
measure them against; weights verified only, §B).

## Problem

R20's rest work was judged by the operator: nib fix good, everything
else rejected ("just as bad", "must be structural"). Verified causes:

1. **Nothing was measured.** R20's shapes were hand-drawn from verbal
   descriptions ("U+1D13B-class proportions") plus eyeballed PNGs of
   Noto Music. Zero font-outline extraction, zero source citations in
   code. The quarter is literally a monoline zigzag in code
   (`REST_URTEXT_LIGHTNING_*`, class `janko-rest-lightning`) — a
   lightning bolt next to Noto's calligraphic squiggle (contrast,
   hooks, crossing stroke). The 8th/16th read as ovals stuck on a
   stick, not hooks grown from a stem.
2. **Slabs seat to invisible rows.** Half/whole slabs (5.2×1.4pt) sit on
   phrase-row pitch positions while the drawn staff lines pass 4–5pt
   away, touching nothing. Classical slabs derive their MEANING from
   touching a line (half sits ON, whole hangs FROM). No shape polish
   can fix a slab that touches nothing — RestSpec m.4/m.5 read as
   floating bricks. (RestSpec m.1/m.2 16th/8th approved as-is; Bach
   m.4/m.6 seats measure dead-on (x ≤0.2pt, y on voice rows) — their
   strangeness is glyph quality, fixed by §B.)
3. **RH-anchor violates lower-first in 16 rows.** The shipped rule puts
   RH left regardless of pitch (R19 incumbent kept through a
   misread approval; R20 deleted the alternative). The operator's
   standing rule is lower-note-first. Disagreements: Bach 8
   (bar3:t408, bar5:t672, bar8:t1032, bar12:t1632, bar15:t2040,
   bar15:t2064, bar23:t3216, bar31:t4368 — LH always lower, always
   right) + Brahms 8 (bar7:t1296, bar17:t3216, bar26:t4848, bar28:t5400,
   bar29:t5592, bar46:t8688, bar48:t9240, bar49:t9432).
4. **Completeness = the working set, not the corpus (operator ruling).**
   This is a notation SYSTEM, not two pieces: the standard working
   set whole→64th must be complete whether or not Bach/Brahms
   exercise it. Census (context, NOT scope): the engine paints stems,
   primary beams, secondary (16th) beams (Bach 106; Brahms 0),
   solitary flags single (8th) + double (16th) (Bach 34+11, Brahms
   109+0), augmentation dots (Bach 19), clasp rings/slashes/dots
   (37/2/12), rest stems/hooks/slabs/serpentine; the corpus has no
   32nds or 64ths (min durs Bach 12 / Brahms 18) and no lone-16th
   groups. So §E CONSTRUCTS the missing specimens (RestSpec
   precedent) and builds: 32nd + 64th rests + triple/quad flags +
   tertiary/quaternary beam levels + lone-16th/lone-32nd/lone-64th
   stubs. One verify-item (exhibit, NOT a defect): sys0 secondary
   span 41.80–51.96 — prove which group owns it and that every
   secondary span covers 16th stems only.

## Change

### A. Measure first (step 0 — gates everything else)

- Fetch **Bravura OTF** (the SMuFL reference font, OFL —
  github.com/steinbergmedia/bravura, releases/redist) and **Noto
  Music** (Google Fonts, OFL — the repo's existing "original").
  Extract outlines (fontTools) for: restQuarter, rest8th, rest16th,
  restHalf, restWhole, flag8thUp/Down, flag16thUp/Down,
  augmentationDot (+ noteheadBlack for weight reference; + rest32nd,
  flag32ndUp/Down, rest64th, flag64thUp/Down for §E). Reuse
  /tmp/fontenv + already-downloaded font files if present (a prior
  run staged them).
- Record the MEASUREMENT TABLE in code comments + hand-off: font
  file versions, glyph names, units-per-em, bbox, height/width,
  max/min stroke, hook reach/drop/curvature extrema, stem lean,
  slab W/H.
- DEFINE the space→pt scale mapping explicitly (our lattice has no
  staff-space — the mapping is the crux; no silent scaling).
- STOP: if the fonts are unobtainable, STOP and report — do not fall
  back to eyeballing.

### B. Cut every part to the numbers

- Quarter: measured serpentine (contrast + hooks + crossing per the
  outlines); the lightning polyline is DELETED.
- 8th/16th rests: stem + grown hooks per outlines (kill the stuck-on
  oval joints); slabs: measured W/H.
- Flags (single + double): verify the R20 taper against the measured
  outlines; adjust IFF off (no churn for its own sake). Dots: verify
  r=0.75 against measured; adjust IFF off. Stems/beams weights:
  verify-only.
- Clasp rings/slashes: keep shapes (no source exists); verify weights
  sit in the family; adjust IFF off.
- NO freelancing: every constant traces to the measurement table.

### C. Slabs onto visible lines

- Half sits ON / whole hangs FROM the nearest DRAWN staff line
  (touching). Tie → toward middle C. Measure current slab-to-line
  gaps first; STOP if any slab must travel an absurd distance
  (implementer justifies the bound from the measured distribution in
  the hand-off).
- Linter violation: slab edge off its line (+ fixture). Whole centered
  in its measure per Gould (resolves R20's open point); half x stays
  on its beat column.
- Whole-centering implementation notes (measured R20 live, RestSpec
  m.5, 4/4, tpm=192): barlines 214.29/392.79, center 303.54; current
  slab centroid 220.29 (6.0pt after the opening barline — 83pt off).
  `isWholeBarSilence` ⇒ x = barline midpoint, EXEMPT from the
  beat-cell nudge (a centered whole sits outside its onset beat cell
  by design). Caution: the center column coincides with the LH C3
  onset column (tick 864 → x=303.54) — clears vertically by row
  separation; the linter must confirm, never shift the slab to dodge.
  Verified citation (LilyPond Notation Reference §§2.2.1/2.2.3,
  v2.19–v2.25): "Whole measure rests, centered in the middle of the
  measure" / "A full-measure rest is printed as either a whole or
  breve rest, centered in the measure, depending on the time
  signature."

### D. Lower-first THE rule

- Re-add the anchor with lower-first canonical; RH path REMOVED
  (mirror of R20's retirement — a rule, not an option). Unison
  survivor = the LOWER head's x (updates R20). Un-record the
  stack-yield death in the harness doc: yield lives ONLY if the STOP
  below trips.
- Bach: all 8 rows flip (proven safe — max one head per hand per
  onset corpus-wide, so swapping x within a row preserves the stem-x
  set; no stem can meet a new disc; no brackets/dots; beams re-fit
  under the linter).
- Brahms: all 8 flip via full sweep. STOP: the exact R19 stem
  signatures (0.00/2.73pt stem-through-simultaneity in golden
  paradigms) → STOP + report; never a silent hybrid.

### E. 32nd + 64th completeness (the system, not the specimen)

- 32nd rest (stem + three grown hooks per §A outlines) + 64th rest
  (stem + four hooks), 32nd solitary flags (triple hooks up/down) +
  64th flags (quad hooks), TERTIARY + QUATERNARY beam levels (build
  beam levels GENERICALLY: level = f(duration) — full spans +
  partial inner spans exactly like 16ths; 128th later = data, not
  architecture), lone-16th + lone-32nd + lone-64th beamlet stubs
  per Gould (backward stubs; cite the clause; direction rule
  tested).
- CONSTRUCTED SPECIMENS (RestSpec precedent — no unproven parts):
  extend the specimen suite with 32nd/64th runs, mixed groups,
  lone 16ths/32nds/64ths in coarser groups, solo 32nd/64th flags.
  Every §E part renders on a specimen window.

### F. Round 21 registry (verification, no open axis)

Windows on fixed golden (studio no-open-axis form): rest specimen
(all 5, new cuts + slab seats), Bach m.4/m.6 + Brahms rest bars,
all 16 anchor rows (before/after order pinned), the 9 mixed-level
beam groups (incl. the sys0 exhibit), 32nd/64th specimen windows
(runs, mixed groups, lone stubs, solo flags), m.3 nib guard,
Bach-final unison guard. Harness doc: measurements + Gould cites +
lower-first.

## Testing plan

- `npm test` — green. `npm run lint:engraving --strict` — clean on
  all scores incl. new specimens. `npm run build` — clean.
- Table-pinned proportions per part (bbox/weight/hook numbers from
  §A; curves judged live, no fake-precision curve assertions).
- Slab-touch + whole-centering pins (slab x == barline midpoint —
  R20 live RestSpec m.5: 220.29 → 303.54; half x unchanged on its beat
  column). Lower-first order pins (all 16
  rows) + stem tripwire (R19 signatures absent — the test FAILS if
  they occur). Violation fixtures (slab-off-line; same-pitch
  doubling stays green).
- 32nd/64th completeness: rest/flag/stub/tertiary/quaternary pins
  from the §A table; every new part renders on its specimen window;
  beam-level generality (level-3/4 spans mirror level-2 rules);
  lone-stub direction pin (Gould backward rule).
- No-move guards: noteheads/digits/stems/beams coordinates
  byte-identical except the prescribed moves (rest ink, slab seats,
  16 row swaps, flag/dot adjustments IFF measurements demand —
  each move listed in the hand-off).
- Full-score sweep (/tmp, never committed). `public/img/` + root
  untouched.
- Test-first on the behavior pins: observe each pin FAIL on the
  unmodified worktree (e.g. whole-centering sees 220.29) before
  implementing; run the focused test after the final relevant edit.

## Risks

- The space→pt scale mapping is the crux of the round — explicit,
  recorded, reviewed; a wrong scale repeats R20.
- Slab travel distribution unknown until measured (§C STOP covers).
- Tertiary/quaternary beam levels must generalize level-2 rules
  (spans, gaps, obstacle passes) — no forked beam-code paths.
- Downbeat-rest presence (Bach m.6) must be re-judged live; residual
  void = spacing follow-up (Gould-governed, operator-ruled),
  never a rest-slide in this ticket.
- Retired dialects untouched.

## Review

Post-land studio `http://100.102.70.49:5175/janko.html` — Round 21
verification windows. Operator verdicts: (1) quarter reads classical;
(2) slabs touch their lines; (3) hooks grown, not stuck on; (4)
lower-first in all 16 rows; (5) the complete parts walk whole→64th
(every mark traces to a measurement; stubs + tertiary/quaternary
beams on specimen windows).
