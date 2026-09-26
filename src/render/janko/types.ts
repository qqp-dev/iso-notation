/**
 * Jánko Two-Row Engraving Engine — Tokens & Layout Options
 *
 * The engine engraves a grand staff on the *Jánko Equator Principle*:
 *
 * - Every octave is represented by a single horizontal **octave equator** line.
 * - Whole-tone rank 0 (even pitch classes 0, 2, 4, 6, 8, a) sits **below** its
 *   octave equator; whole-tone rank 1 (odd pitch classes 1, 3, 5, 7, 9, b)
 *   sits **above** it. Every row-to-row step is exactly `rowHeight` (15pt).
 * - Because a row is shared by six pitch classes, a chord can put two of its
 *   tones on one row of one octave (`C` + `E`, `G` + `B`, `F` + `G` + `B` …).
 *   Those heads are **never merged and never re-rowed**: the row is the
 *   instrument's physical row, so the collision is resolved horizontally by
 *   the active {@link JankoClusterSpacing} preset (Approach 2, Row-Snapped
 *   Parity Offset). See {@link JANKO_CLUSTER_SPACING_PRESETS} and
 *   `engine.resolveRowSnappedChordOffsets`.
 * - The **channel layout** ({@link JankoLayoutOptions.channelLayout}) selects
 *   how an octave is framed. Besides the incumbent `'single-equator'`, three
 *   comparative paradigms are engraved: `'on-the-line'` (Set A anchored on the
 *   rule, Set B statically one row above), `'single-line-3row'` (one rule per
 *   octave with Set B contour-resolved to `±rowHeight`) and
 *   `'bounded-channel'` (two boundary rules at `equator ± channelHalfWidth`
 *   with Set B contour-resolved to `±channelFlankOffset`). See
 *   {@link JankoChannelLayout} for the full table.
 * - The four equators o5 (−45pt), o4 (−15pt), o3 (+15pt) and o2 (+45pt) form
 *   the *grand staff*: one **absolute, hand-independent** coordinate lattice
 *   shared by both hands. Every octave steps by exactly `octaveStep`
 *   (2 * rowHeight = 30pt) away from Middle C (`y = 0`), because Round 11
 *   equalizes `interStaffGap` to that same 30pt — the lattice is uniformly
 *   spaced everywhere, so octave equators are equidistant across the corridor
 *   and the hands are framed with true melodic symmetry.
 * - Only pitches **outside** the staff span (`octave < 2` or `octave > 5`)
 *   emit dynamic ledger equators; every note in octaves 2–5 already sits on a
 *   continuous staff line.
 *
 * Everything geometric or stylistic that a designer may want to tweak lives in
 * {@link JankoTokens} (micro-typography) and {@link JankoLayoutOptions}
 * (macro-layout), so that no coordinate math is hardcoded in a script.
 */

import { Hand } from '../../model/types';

/** Pluggable rhythm renderer styles (see `elements/rhythm.ts`). */
export type JankoRhythmStyle = 'angled-cuts' | 'horizontal-ticks' | 'beamed';

/**
 * Pluggable single-note **subdivision** styles — the Round 7 question: how an
 * isolated 8th/16th/32nd draws its duration at the stem tip (see
 * `elements/rhythm.renderSubdivisionMark`).
 *
 * Round 7 replaced Round 6's static perpendicular tab with **diagonal kinetic
 * direction** — the mark rakes away from the stem tip, leading the eye along the
 * stem's motion — and kept the classical flag as the balanced control. Round 8
 * answers the operator's verdict on that round: the 30°/45° rakes clashed with
 * the score's shallow beams, so the settled kinetic tab is **beam-harmonized**
 * at the score's own `maxBeamSlope` (0.22 ≈ 12.4°), while the classical control
 * becomes a slender open urtext hairline.
 *
 * | style                   | ink at the stem tip                                  |
 * | ----------------------- | ---------------------------------------------------- |
 * | `'kinetic-tab-30'`      | 30° diagonal tab, 1.1pt monoline                     |
 * | `'kinetic-tab-45'`      | 45° diagonal tab, 1.1pt monoline (chevron harmony)   |
 * | `'kinetic-tab-tapered'` | 30° diagonal tab, optical taper 1.4pt root → 0.8pt   |
 * | `'classical-urtext'`    | slender open 0.90pt urtext hairline                  |
 * | `'kinetic-tab-beam'`    | beam-harmonized tab: `maxBeamSlope` ≈ 12.4°, 1.1pt   |
 */
export type JankoSubdivisionStyle =
  | 'kinetic-tab-30'
  | 'kinetic-tab-45'
  | 'kinetic-tab-tapered'
  | 'classical-urtext'
  | 'kinetic-tab-beam';

/** Every subdivision style, in the canonical exploration order. */
export const JANKO_SUBDIVISION_STYLES: readonly JankoSubdivisionStyle[] = [
  'kinetic-tab-30',
  'kinetic-tab-45',
  'kinetic-tab-tapered',
  'classical-urtext',
  'kinetic-tab-beam',
];

/** Human-readable names of the subdivision styles. */
export const JANKO_SUBDIVISION_STYLE_LABELS: Record<JankoSubdivisionStyle, string> = {
  'kinetic-tab-30': '30° Kinetic Architectural Tab',
  'kinetic-tab-45': '45° Dynamic Chevron Tab',
  'kinetic-tab-tapered': 'Tapered Kinetic Wing Tab',
  'classical-urtext': 'Slender Open Urtext Flag',
  'kinetic-tab-beam': 'Beam-Harmonized Kinetic Tab (12.4°)',
};

/**
 * Measured digit half-extents (pt) at the canonical 5.8pt digit size — the
 * construction bases of the rectangular knockout (see
 * {@link JankoClusterSpacingPreset}). Rounded to two decimals for humans; the
 * exact optical box is `digitHalfExtents(5.8)` = 1.9333 × 2.8577.
 */
export const JANKO_DIGIT_HALF_WIDTH = 1.93;
export const JANKO_DIGIT_HALF_HEIGHT = 2.86;

/**
 * Horizontal **cluster spacing** — the Round 17 judged axis: how much room a
 * same-row cluster of one onset takes.
 *
 * The knockout is a **sharp rectangle**: the digit ink box grown by a uniform
 * margin `m` on all four sides (`wx = 1.93 + m`, `hy = 2.86 + m`). The
 * Round 16 ellipse and its corner budget are deleted with it: the rect erases
 * nothing extra while protecting exactly. The digit stays 5.8pt in every
 * preset, and rows sit 15pt apart, so nothing but the head's own row line ever
 * crosses the hole.
 *
 * | preset    | margin | air  | pair gap (`2wx + air`) | triple span |
 * | --------- | ------ | ---- | ---------------------- | ----------- |
 * | `'snug'`  | 0.8    | 0.4  | 5.86                   | 11.72       |
 * | `'tight'` | 0.6    | 0.4  | 5.46                   | 10.92       |
 *
 * `'tight'` is the golden master (the decided −35% vs the Round 16 8.2, Round
 * 17B verdict).
 * The cluster grammar itself is settled doctrine, not a candidate: one shared
 * stem per same-duration stack nearest the nominal column, coincident stems
 * for mixed stacks, flanked same-row seconds with two stems at head-x, the
 * v2 spacing solver (unit centering, pin-preserving shrink, local
 * redistribution, symmetric tuck — Round 19) behind the hard beat-cell
 * barriers.
 */
export type JankoClusterSpacing = 'snug' | 'tight';

/** Every cluster-spacing preset, in the canonical exploration order. */
export const JANKO_CLUSTER_SPACINGS: readonly JankoClusterSpacing[] = [
  'snug',
  'tight',
];

/** Human-readable names of the two cluster-spacing presets. */
export const JANKO_CLUSTER_SPACING_LABELS: Record<JankoClusterSpacing, string> = {
  snug: 'Snug Cluster Spacing (margin 0.8, air 0.4)',
  tight: 'Tight Cluster Spacing (margin 0.6, air 0.4)',
};

/** Resolved geometry of one {@link JankoClusterSpacing} preset (all in pt). */
export interface JankoClusterSpacingPreset {
  /**
   * Uniform white margin the rectangular mask leaves around the digit ink box
   * on all four sides: `wx = 1.93 + margin`, `hy = 2.86 + margin`.
   */
  margin: number;
  /** Breathing air between two neighbouring knockout masks of one row. */
  air: number;
  /** Centre-to-centre span of a same-row pair: `2wx + air`. */
  pairGap: number;
  /** Mask half-width: `1.93 + margin`. */
  wx: number;
  /** Mask half-height: `2.86 + margin`. */
  hy: number;
}

/** The two judged spacing amounts, exactly as the Round 17A ticket tables them. */
export const JANKO_CLUSTER_SPACING_PRESETS: Record<JankoClusterSpacing, JankoClusterSpacingPreset> = {
  snug: { margin: 0.8, air: 0.4, pairGap: 5.86, wx: 2.73, hy: 3.66 },
  tight: { margin: 0.6, air: 0.4, pairGap: 5.46, wx: 2.53, hy: 3.46 },
};

/** Resolve one spacing preset (defaults to the golden `'tight'`). */
export function getClusterSpacingPreset(
  spacing?: JankoClusterSpacing | null
): JankoClusterSpacingPreset {
  return JANKO_CLUSTER_SPACING_PRESETS[spacing ?? 'tight'];
}

/**
 * Pluggable **rest symbol dialects** — the Round 12 question: how a hand's
 * silent span inside an active measure is written (see
 * `elements/rests.renderRest`).
 *
 * | style               | 16th / 8th                                  | quarter                     | half / whole            |
 * | ------------------- | ------------------------------------------- | --------------------------- | ----------------------- |
 * | `'kinetic-monoline'`| vertical stem + 12.4° kinetic tabs (`//`,`/`)| central horizontal notch    | hollow bar (7 × 2.2pt)  |
 * | `'classical-urtext'`| calligraphic hooks with teardrop bulbs (`𝄿`, `𝄾`) | serpentine lightning (`𝄽`) | solid block (6 × 2.5pt) |
 * | `'geometric-node'`  | hollow diamond + 2 / 1 lateral rays          | solid diamond (5 × 5pt)     | open capsule / lozenge  |
 * | `'bauhaus-slash'`   | 45° beveled slash + 2 / 1 parallel wings     | minimalist reversed-Z       | thin hairline box       |
 * | `'phantom-notehead'`| dashed open head (R 3.0pt) + stem + 2 / 1 downward-hooked flags | dashed head + bare stem | dashed head + hollow bar |
 */
export type JankoRestStyle =
  | 'kinetic-monoline'
  | 'classical-urtext'
  | 'geometric-node'
  | 'bauhaus-slash'
  | 'phantom-notehead';

/** Every rest dialect, in the canonical exploration order (A–E). */
export const JANKO_REST_STYLES: readonly JankoRestStyle[] = [
  'kinetic-monoline',
  'classical-urtext',
  'geometric-node',
  'bauhaus-slash',
  'phantom-notehead',
];

/** Human-readable names of the five rest dialects. */
export const JANKO_REST_STYLE_LABELS: Record<JankoRestStyle, string> = {
  'kinetic-monoline': 'Kinetic Monoline Rests (12.4° tabs)',
  'classical-urtext': 'Classical Urtext Rest Glyphs',
  'geometric-node': 'Geometric Pause Nodes',
  'bauhaus-slash': 'Bauhaus Beveled Slashes',
  'phantom-notehead': 'Phantom Notehead Rests',
};

/**
 * How the **vertical grid** (measure barlines + dashed beat pulses) coexists
 * with the music — the Round 12 three-way question, evaluated on dense
 * sixteenth-note writing (Bach Var. 1 mm. 27 & 29).
 *
 * | policy                      | barline                                  | beat pulse                                        |
 * | --------------------------- | ---------------------------------------- | ------------------------------------------------- |
 * | `'overlaid-beat-grid'`      | protected: notes keep `COLUMN_BARLINE_AIR` | overlaid beneath the notes, knocked out by a disc |
 * | `'strict-protected-grid'`   | protected **and** painted through a dedicated white air channel above the rhythm layer | same channel treatment: the grid is never written over |
 * | `'unified-transparent-grid'`| transparent background coordinate: the note field uses the full measure width and a disc knocks the barline out exactly as it knocks out a beat pulse | transparent background coordinate |
 *
 * Round 12 makes the whole vertical grid **continuous across Middle C** under
 * every policy (see `elements/barlines`), so the three policies differ only in
 * who owns the overlap: the grid (policies 1–2) or the glyph mask (policy 3).
 */
export type JankoGridWritingPolicy =
  | 'overlaid-beat-grid'
  | 'strict-protected-grid'
  | 'unified-transparent-grid';

/** Every grid writing policy, in the canonical exploration order. */
export const JANKO_GRID_WRITING_POLICIES: readonly JankoGridWritingPolicy[] = [
  'overlaid-beat-grid',
  'strict-protected-grid',
  'unified-transparent-grid',
];

/** Human-readable names of the three grid writing policies. */
export const JANKO_GRID_WRITING_POLICY_LABELS: Record<JankoGridWritingPolicy, string> = {
  'overlaid-beat-grid': 'Protected Barlines / Overlaid Beat Grid',
  'strict-protected-grid': 'Strict Non-Overwritten Grid (air channels)',
  'unified-transparent-grid': 'Unified Transparent Background Grid',
};

/**
 * Does the active policy reserve air around the measure barlines? Every policy
 * but `'unified-transparent-grid'` does; the transparent grid lets the music
 * pass across the barline and be knocked out by the circular glyph mask.
 */
export function protectsBarlineInk(policy: JankoGridWritingPolicy): boolean {
  return policy !== 'unified-transparent-grid';
}

/**
 * Does the active policy paint the vertical grid through **dedicated white air
 * channels** above the rhythm layer (`'strict-protected-grid'`)? The grid is
 * then never written over: a stem or beam crossing it is cut by the channel,
 * while the circular notehead mask still erases the grid beneath it.
 */
export function channelsGridInk(policy: JankoGridWritingPolicy): boolean {
  return policy === 'strict-protected-grid';
}

/**
 * Canonical left/right inset (pt) of a measure's note field under the active
 * grid writing policy. The transparent grid withdraws the canonical
 * `measureInset`, so the music uses the full measure width and a downbeat
 * column sits exactly on the barline, where its knockout erases it.
 */
export function getGridNoteInset(
  o: ResolvedJankoLayoutOptions,
  t: ResolvedJankoTokens
): number {
  return protectsBarlineInk(o.gridWritingPolicy) ? t.measureInset : 0;
}

/**
 * Midpoint clasp **duration** paradigms — the Round 11 question: how an
 * external per-hand bracket carries the cluster's duration at the exact
 * vertical midpoint of its own spine with **light transverse line cuts**
 * across the spine.
 *
 * Round 10's heavy solid marks (beads, diamond blocks) are eliminated. All
 * four paradigms are now line-based and share one grammar (see
 * `elements/rhythm.renderChordClasp`):
 *
 * - an **open white circular ring** (`R = 3.0pt`, stroke `1.0pt`) for half
 *   notes, knocking the spine cleanly out (zero crosshairs);
 * - a continuous solid plain bracket `[` for quarter notes;
 * - the plain bracket plus the crisp 0.75pt dot for dotted quarters;
 * - light transverse cuts for subdivisions — 1 mark for an 8th, 2 parallel
 *   marks mirrored about the midpoint for a 16th.
 *
 * | style                     | subdivision ink at the spine midpoint                       |
 * | ------------------------- | ----------------------------------------------------------- |
 * | `'transverse-cross-bars'` | horizontal rungs, W = 7.5pt, stroke 1.0pt                   |
 * | `'kinetic-cross-slashes'` | up-raked 12.4° slashes, W = 7.5pt, stroke 1.0pt             |
 * | `'down-raked-slashes'`    | down-raked −12.4° slashes, W = 7.5pt, stroke 1.0pt          |
 * | `'cross-hatch-stitches'`  | symmetrical cross-stitches (`×`), stroke 1.0pt              |
 */
export type JankoClaspDurationStyle =
  | 'transverse-cross-bars'
  | 'kinetic-cross-slashes'
  | 'down-raked-slashes'
  | 'cross-hatch-stitches';

/** Every clasp-duration paradigm, in the canonical exploration order (A–D). */
export const JANKO_CLASP_DURATION_STYLES: readonly JankoClaspDurationStyle[] = [
  'transverse-cross-bars',
  'kinetic-cross-slashes',
  'down-raked-slashes',
  'cross-hatch-stitches',
];

/** Human-readable names of the four light transverse clasp-duration paradigms. */
export const JANKO_CLASP_DURATION_STYLE_LABELS: Record<JankoClaspDurationStyle, string> = {
  'transverse-cross-bars': 'Horizontal Cross-Rungs (7.5pt)',
  'kinetic-cross-slashes': 'Up-Raked 12.4° Kinetic Slashes',
  'down-raked-slashes': 'Down-Raked −12.4° Slashes',
  'cross-hatch-stitches': 'Symmetrical Cross-Hatch Stitches',
};

/**
 * How a system opens at its left margin — the Round 10 retirement of the
 * copperplate accolade, refined by Round 11 with a modern double frame.
 *
 * | style                    | margin ink at the system start                            |
 * | ------------------------ | --------------------------------------------------------- |
 * | `'open-halo'`            | none: the staff lines emerge openly from the margin, and  |
 * |                          | the Position of Honor halo rings the opening tick-0 heads |
 * | `'architectural-bracket'`| a straight 0.65pt rule with 3.0pt spurs that   |
 * |                          | clasp the Octave 5 and Octave 2 rules and flare  |
 * |                          | diagonally outward by 13° (Round 13)             |
 * | `'delicate-bracket'`     | the same bracket drawn lighter: a 0.50pt rule with 2.5pt  |
 * |                          | right-angled spurs (Round 12)                             |
 * | `'clef-pillar'`          | a slender 0.50pt pillar connecting the octave equators    |
 * |                          | with tick marks at the octave lines (Round 12 removes the |
 * |                          | Middle C nib)                                             |
 * | `'double-hairline'`      | a modern double vertical bounding rule (0.75pt outer,     |
 * |                          | 0.35pt inner, 2.5pt spacing) flush at the system start    |
 * | `'none'`                 | no system-start ink at all                                |
 *
 * The curlicue copperplate accolade no longer belongs to the modern design
 * language. Round 11/12 narrowed the field to the three architectural
 * finalists and Round 14 rules the flared
 * `'architectural-bracket'` canonical: the golden master opens System 1 with
 * the 0.65pt rule and its 13° spurs. `'open-halo'` keeps the geometry (and the
 * history) of the open margin that preceded it, but paints no margin ink. The
 * Position of Honor halo itself is a notehead decoration rather than
 * system-start ink, so it rings the opening tick-0 sounds under every style.
 */
export type JankoSystemStartStyle =
  | 'open-halo'
  | 'architectural-bracket'
  | 'delicate-bracket'
  | 'clef-pillar'
  | 'double-hairline'
  | 'none';

/** Every system-start style, in the canonical exploration order. */
export const JANKO_SYSTEM_START_STYLES: readonly JankoSystemStartStyle[] = [
  'open-halo',
  'architectural-bracket',
  'delicate-bracket',
  'clef-pillar',
  'double-hairline',
  'none',
];

/** Human-readable names of the system-start styles. */
export const JANKO_SYSTEM_START_STYLE_LABELS: Record<JankoSystemStartStyle, string> = {
  'open-halo': 'Open Margin with Position-of-Honor Halo',
  'architectural-bracket': 'Flared Architectural Bracket (0.65pt rule + 13° flared spurs)',
  'delicate-bracket': 'Delicate Architectural Bracket (0.50pt rule + 2.5pt spurs)',
  'clef-pillar': 'Nib-Free Clef Pillar (0.50pt lattice ticks)',
  'double-hairline': 'Double Hairline Frame (0.75pt / 0.35pt)',
  none: 'No System-Start Mark',
};

/**
 * How the **final** barline of the score closes the grand staff.
 *
 * `'unified'` draws one continuous double barline from `rhTop` straight down to
 * `lhBot`, sealing the Middle C corridor; `'split-corridor'` draws the two
 * hand segments separately and leaves the corridor open, exactly like every
 * internal measure boundary.
 */
export type JankoFinalBarlineStyle = 'unified' | 'split-corridor';

/** Every final-barline style, in the canonical exploration order. */
export const JANKO_FINAL_BARLINE_STYLES: readonly JankoFinalBarlineStyle[] = [
  'unified',
  'split-corridor',
];

/** Human-readable names of the final-barline styles. */
export const JANKO_FINAL_BARLINE_STYLE_LABELS: Record<JankoFinalBarlineStyle, string> = {
  unified: 'Unified Final Barline (seals the Middle C corridor)',
  'split-corridor': 'Split Final Barline (open corridor)',
};

/**
 * Middle C spine (the central channel between the two hands) styles.
 *
 * `'none'` is the canonical treatment: the corridor is defined purely by the
 * negative breathing space of `interStaffGap`, with no rule dividing the hands.
 */
export type JankoMiddleCSpine = 'none' | 'dashed' | 'double' | 'continuous';

/**
 * How an octave is framed horizontally — the four comparative paradigms of
 * Round 4.
 *
 * | layout              | rules/octave | Set A (even pc) | Set B (odd pc)          | lines |
 * | ------------------- | ------------ | --------------- | ----------------------- | ----- |
 * | `'single-equator'`  | 1, on the equator | `+rowHeight/2` (below) | `-rowHeight/2` (above), static | 4 |
 * | `'on-the-line'`     | 1, on the equator | `0` (on the rule)      | `-rowHeight` (above), static   | 4 |
 * | `'single-line-3row'`| 1, on the equator | `0` (on the rule)      | `±rowHeight`, contour-resolved | 4 |
 * | `'bounded-channel'` | 2, at `equator ± channelHalfWidth` | `0` (in the channel) | `±channelFlankOffset`, contour-resolved | 8 |
 *
 * The first three therefore paint **4** rules across the grand staff (one per
 * octave) and only `'bounded-channel'` doubles that to **8**. The dynamic
 * layouts resolve the side of every Set B note against the melodic contour (see
 * `geometry.resolveChannelFlanks`); the static ones anchor Set B on a single
 * row.
 */
export type JankoChannelLayout =
  | 'single-equator'
  | 'on-the-line'
  | 'single-line-3row'
  | 'bounded-channel';

/** Every channel layout, in the canonical exploration order (A, B, C, D). */
export const JANKO_CHANNEL_LAYOUTS: readonly JankoChannelLayout[] = [
  'single-equator',
  'on-the-line',
  'single-line-3row',
  'bounded-channel',
];

/**
 * How a **vertical chord / cluster** of one onset is grouped and how it carries
 * its duration — the Round 5 question, refined by Round 6 with
 * `'per-hand-clasp'`.
 *
 * A two-row whole-tone staff spreads a chord's tones over several rows, so a
 * multi-note onset used to be engraved as N independent stems that overlap into
 * one long vertical line, chopped into segments by every white knockout it
 * passes. The four paradigms under review:
 *
 * | mode                 | grouping unit            | ink                                   |
 * | -------------------- | ------------------------ | ------------------------------------- |
 * | `'none'`             | — (per-note stems)       | incumbent golden master                |
 * | `'left-clasp-spire'` | one chord / cluster      | one external bracket per cluster       |
 * | `'beamed-clasp-rail'`| one chord / cluster      | + a measure-bounded rail joining tips  |
 * | `'bounding-phrase'`  | one measure (the phrase) | one bracket bounding every note        |
 * | `'per-hand-clasp'`   | one hand of one onset    | one bracket per hand (Round 6), unified across the hands where their spans overlap (Round 19) |
 *
 * The clasp is drawn **outside** the cluster (`claspX = minX − r − claspOffset`)
 * and carries the cluster's shortest duration at its tip: an open pip for
 * halves/wholes, a clean spire for quarters and flag hooks for 8ths/16ths.
 *
 * `'per-hand-clasp'` is the Round 6 refinement: the grouping unit is one hand
 * (`RH` or `LH`), and a bracket is drawn **only** for a horizontally displaced
 * (row-snapped) hand cluster — a clean vertical column and a lone melodic note
 * keep their stems. Round 8 widened its scope to a vertical hand chord of three
 * or more heads. Round 14 makes it the golden-master default: a same-onset
 * cluster inside one hand is always either bracketed or unified by the
 * gap-gated stem grammar, so no stem of one chord tone can ever be painted
 * through the notehead disc of another (the defect the linter names
 * `stem-through-simultaneity`). Round 19 adds **overlap-conditional
 * unification**: where both hands of one onset produce a qualifying group and
 * their spans overlap or touch, one bracket spans every head of the onset and
 * carries one duration group per hand; a gapped onset (Brahms m. 3's 90pt hand
 * gap) keeps the two per-hand brackets.
 */
export type JankoChordGrouping =
  | 'none'
  | 'left-clasp-spire'
  | 'beamed-clasp-rail'
  | 'bounding-phrase'
  | 'per-hand-clasp';

/** Every chord-grouping paradigm, in the canonical exploration order (A–E). */
export const JANKO_CHORD_GROUPINGS: readonly JankoChordGrouping[] = [
  'none',
  'left-clasp-spire',
  'beamed-clasp-rail',
  'bounding-phrase',
  'per-hand-clasp',
];

/** Human-readable names of the five chord-grouping paradigms. */
export const JANKO_CHORD_GROUPING_LABELS: Record<JankoChordGrouping, string> = {
  none: 'Traditional Stems (no clasp)',
  'left-clasp-spire': 'Independent Left Clasp',
  'beamed-clasp-rail': 'Beamed Clasp Rail',
  'bounding-phrase': 'Bounding Phrase Clasp',
  'per-hand-clasp': 'Per-Hand Cluster Clasp (non-vertical only)',
};

/** Human-readable names of the four channel layouts. */
export const JANKO_CHANNEL_LAYOUT_LABELS: Record<JankoChannelLayout, string> = {
  'single-equator': 'Single Equator (floating rows)',
  'on-the-line': 'Base Row on the Line (static 2-row)',
  'single-line-3row': 'Single Line, 3 Rows (dynamic flanks)',
  'bounded-channel': 'Bounded Channel (dynamic flanks)',
};

/**
 * Pitch-contour thread (the contour round): a hairline melodic thread woven
 * beneath the noteheads at true pitch height, so stepwise motion reads as
 * motion even where the twin whole-tone rows draw it flat or backwards.
 * `'none'` paints no thread, `'rh'` threads the right hand's melody only,
 * `'both'` threads both hands.
 */
export type JankoContourThread = 'none' | 'rh' | 'both';

/** Every contour-thread voice, in the canonical exploration order. */
export const JANKO_CONTOUR_THREADS: readonly JankoContourThread[] = ['none', 'rh', 'both'];

/** Human-readable names of the contour-thread voices. */
export const JANKO_CONTOUR_THREAD_LABELS: Record<JankoContourThread, string> = {
  none: 'No Contour Thread',
  rh: 'Contour Thread (right hand)',
  both: 'Contour Thread (both hands)',
};

/**
 * Pitch-to-height mapping (the pitch-mapping round): how a pitch becomes a
 * vertical position.
 *
 * - `'twin-rows'` — the golden master: two whole-tone rows per octave on four
 *   equator rules. Exact, but melodic contour reads flat or backwards.
 * - `'continuous'` — true pitch height on a sparse grand grid: every semitone
 *   higher stands strictly higher on the page (`semitoneScale` pt per
 *   semitone, middle C the note exactly on the Middle C line), so contour
 *   and transpositional shape read by construction. Faint C-lines, a firm
 *   middle-C anchor, margin landmarks on request.
 * - `'chromatic-lanes'` — the same true heights on a dense Klavar-style grid:
 *   one lane per semitone, C-lanes strengthened, every head grounded on its
 *   own line.
 *
 * The mapping replaces the row framings: `channelLayout` is ignored unless
 * `'twin-rows'`. The window (which semitones get lanes) is the score's own
 * range, so every system of a score shares one absolute grid.
 */
export type JankoPitchMapping = 'twin-rows' | 'continuous' | 'chromatic-lanes';

/** Every pitch mapping, in the canonical exploration order. */
export const JANKO_PITCH_MAPPINGS: readonly JankoPitchMapping[] = [
  'twin-rows',
  'continuous',
  'chromatic-lanes',
];

/** Human-readable names of the pitch mappings. */
export const JANKO_PITCH_MAPPING_LABELS: Record<JankoPitchMapping, string> = {
  'twin-rows': 'Twin Rows (golden master)',
  continuous: 'Continuous Height (grand grid)',
  'chromatic-lanes': 'Chromatic Lanes (Klavar grid)',
};

/**
 * Octave-line scheme (the line-scheme round): which horizontal rules the
 * grand grid draws. Only meaningful under `pitchMapping: 'continuous'` —
 * the twin rows keep their equators and the lanes keep their full grid.
 *
 * - `'grand-divider'` — the shipped grid: the dark Middle C divider plus one
 *   faint C-line per octave.
 * - `'equal-centers'` — one golden-weight hairline per octave middle, no
 *   divider: the equator grammar reborn in chromatic space.
 * - `'equal-boundaries'` — one golden-weight hairline per C boundary, no
 *   divider: lines sit between octaves where fewer heads touch them.
 * - `'clef-marker'` — the faint C-lines of the divider grid, but the anchor
 *   is a short clef-like tick at each system start instead of a full-width
 *   rule: the minimal pair that asks whether the anchor must run full width.
 */
export type JankoOctaveLineScheme =
  | 'grand-divider'
  | 'equal-centers'
  | 'equal-boundaries'
  | 'clef-marker';

/** Every octave-line scheme, in the canonical exploration order. */
export const JANKO_OCTAVE_LINE_SCHEMES: readonly JankoOctaveLineScheme[] = [
  'grand-divider',
  'equal-centers',
  'equal-boundaries',
  'clef-marker',
];

/** Engraving token set: geometric and styling constants (all in pt). */
export interface JankoTokens {
  /** Vertical distance between the two whole-tone rows. */
  rowHeight: number;
  /**
   * Conservative circular glyph bound (4.8pt): the clearance radius the
   * clasp, rest, beam and barline grammars keep around a notehead. Round 17
   * paints a sharp rectangular mask instead (`wx`/`hy` from the active
   * {@link JankoClusterSpacing} preset, both well inside this circle), so every
   * circular audit stays a safe over-approximation of the true rect.
   */
  noteheadRadius: number;
  /** Duodecimal digit font size (pt) — must fit inside the knockout disc. */
  digitFontSize: number;
  /** Position of Honor concentric halo ring radius. */
  haloRadius: number;
  /** Octave equator step (2 * rowHeight). */
  octaveStep: number;
  /** Accolade horizontal reach. */
  accoladeWidth: number;
  /** Accolade stroke thickness. */
  accoladeThick: number;
  /** Duodecimal digit font stack (URW Gothic / Avant Garde). */
  fontFamily: string;

  // --- Optional rhythm / spacing refinements (resolved from defaults) ---
  /** Stem length from notehead centre. */
  stemLength?: number;
  /** Air (pt) between a regular mask edge and its stem start. */
  stemAttachmentAir?: number;
  /** Angled-cut horizontal half-width. */
  slashDx?: number;
  /** Angled-cut vertical half-height. */
  slashDy?: number;
  /** Horizontal inset of the first/last note of a measure. */
  measureInset?: number;
  /** Ticks in one measure (3/4 at 48 ticks/beat => 144). */
  ticksPerMeasure?: number;
  /** Upbeat duration in ticks (e.g. 48 for cut-time quarter note upbeat). */
  anacrusisTicks?: number;
  /** Ticks per beat (quarter note => 48). */
  ticksPerBeat?: number;
  /** Half-width of a ledger equator segment. */
  ledgerHalfWidth?: number;
  /** Primary beam thickness. */
  beamThickness?: number;
  /** Absolute clamp for a beam connector slope (rise over run). */
  maxBeamSlope?: number;
  /** Accolade-to-staff gap. */
  accoladeGap?: number;
  /** Radius of a dotted-rhythm augmentation dot. */
  augmentationDotRadius?: number;
  /**
   * Horizontal offset (pt) of an augmentation dot's centre from its mask's
   * right edge: `dotX = note.x + wx + augmentationDotGap`, for **both** hands,
   * where `wx` is the rectangular mask half-width of the active
   * {@link JankoClusterSpacing} preset (Round 17 hug fit). The dot is always
   * right of the head it belongs to, as in standard notation.
   */
  augmentationDotGap?: number;
  /**
   * Vertical lane (pt) of an augmentation dot's centre above its head row
   * (Round 17 hug fit): the dot hugs the mask's top-right corner instead of
   * floating in the inter-row gap. The high lane (`rowHeight / 2`) survives
   * only as the fallback when a same-row neighbour sits inside the mask band.
   */
  augmentationDotRowOffset?: number;
  /** Horizontal reach of a standard note flag, right of the stem. */
  flagWidth?: number;
  /** Vertical drop of a flag hook from its stem tip. */
  flagHeight?: number;
  /** Vertical spacing between stacked flags (16ths and shorter). */
  flagSpacing?: number;
  /**
   * Minimum air (pt) that must remain between a notehead disc and the nearest
   * beam edge. The beam solver raises/lowers the connector until every head in
   * the group keeps this clearance; the visual linter audits the same number.
   */
  minStemClearance?: number;
  /**
   * Half-height of the bounded center channel (pt): the two boundary rules of
   * an octave sit at `equator ± channelHalfWidth`. The canonical 6.5pt leaves
   * 1.7pt of clean air around the 4.8pt knockout disc of a Set A notehead.
   * Only consulted when `channelLayout === 'bounded-channel'`.
   */
  channelHalfWidth?: number;
  /**
   * Distance (pt) from the octave equator to a Set B flank row (the rows above
   * the upper rule and below the lower rule) under the bounded center channel.
   * The canonical 13.0pt is exactly twice `channelHalfWidth`, so a flanking
   * notehead clears the boundary rule by the same 1.7pt as a channel note.
   */
  channelFlankOffset?: number;
  // --- Optional chord-clasp refinements (Round 5, resolved from defaults) ---
  /**
   * Horizontal reach (pt) of a clasp's two caps — the short horizontal serifs
   * that turn the vertical spine into a bracket. The canonical 2.2pt leaves
   * ≈0.6pt of clean air between a cap's inner end and the knockout disc it
   * clasps (the spine already stands `claspOffset` clear of that disc).
   */
  claspWidth?: number;
  /** Stroke thickness (pt) of the clasp bracket and its spire. */
  claspStrokeWidth?: number;
  /**
   * Distance (pt) from the outermost notehead disc of a cluster to the clasp
   * spine: `claspX = minX − r − claspOffset`.
   */
  claspOffset?: number;
  /**
   * Minimum air (pt) a **downbeat** clasp keeps from the preceding barline.
   * The measure's left inset is widened until
   * `claspX >= measureLeft + claspMinBarlineAir`, so a downbeat bracket never
   * touches, let alone slices through, the barline it follows.
   */
  claspMinBarlineAir?: number;
  // --- Contour-round refinements (resolved from defaults) ---
  /** Vertical scale (pt per semitone) of the contour thread. */
  contourThreadScale?: number;
  /** Stroke thickness (pt) of the contour thread. */
  contourThreadStroke?: number;
  /** Stroke thickness (pt) of the contour departure ticks. */
  contourTickStroke?: number;
  /** Height (pt) of the contour strip below each system. */
  contourStripHeight?: number;
  /** Air (pt) between a system's lowest ink and its contour strip. */
  contourStripAir?: number;
  /** Vertical scale (pt per semitone) of the continuous pitch mappings. */
  semitoneScale?: number;
  /** Ottava bracket dashed-line segment length in pt. */
  ottavaDashLength?: number;
  /** Ottava bracket dashed-line gap in pt. */
  ottavaDashGap?: number;
  /** Ottava bracket end-hook length in pt (turns toward staff). */
  ottavaHookLength?: number;
  /** Minimum air (pt) between an ottava bracket and any notehead. */
  ottavaClearance?: number;
  /** Hairline stroke width for ottava dashed line and hook. */
  ottavaLineWidth?: number;
  /** Knockout margin override around digit ink box (pt, Round 40). */
  knockoutMargin?: number;
  /** Knockout breathing air between neighbouring masks (pt, Round 40). */
  knockoutAir?: number;
  // --- Round 41: per-note symbol metrics and hold-to-release endpoints ---
  /** Round 41: knockout margin around a **chord member** symbol's ink box (pt). */
  chordKnockoutMargin?: number;
  /** Round 41: breathing air around a chord member's mask (pt). */
  chordKnockoutAir?: number;
  /** Round 41: stroke width (pt) of the hold-to-release connector. */
  holdConnectorStroke?: number;
  /**
   * Round 41: height (pt) of the white underlay band that *replaces* the local
   * staff rule where a hold connector is coincident with it.
   */
  holdUnderlayWidth?: number;
  /** Round 41: air (pt) a release terminal keeps from foreign protected ink. */
  holdTerminalAir?: number;
  /** Round 41: stop-bar terminal height (pt). */
  holdStopBarHeight?: number;
  /** Round 41: stop-bar terminal stroke width (pt). */
  holdStopBarStroke?: number;
  /** Round 41: diamond terminal span across (pt, both axes). */
  holdDiamondSize?: number;
  /** Round 41: ring terminal diameter (pt). */
  holdRingDiameter?: number;
  /** Round 41: ring terminal stroke width (pt). */
  holdRingStroke?: number;
  // --- Round 46: written tie arcs ---
  /** Round 46: stroke width (pt) of one written tie arc. */
  tieStroke?: number;
  /** Round 46: air (pt) a tie's endpoint keeps from its own head's knockout box. */
  tieEndpointAir?: number;
  /** Round 46: bulge of the shallowest tie (pt). */
  tieMinDepth?: number;
  /** Round 46: bulge cap of the widest tie (pt). */
  tieMaxDepth?: number;
  /** Round 46: bulge as a fraction of the arc's chord length (before the caps). */
  tieDepthRatio?: number;
  /** Round 46: air (pt) a tie's ink keeps from a coincident staff rule. */
  tieRuleAir?: number;
  /**
   * Round 48: **apex thickness (pt) of the traced tie contour** — the mid
   * thickness of the filled two-cubic profile measured from LilyPond 2.26.0's
   * own tie (0.12 staff space = 0.598pt of control offset, i.e. 0.449pt of ink
   * at the apex; the boundary offset is this number divided by 0.75). Read only
   * under `options.tieProfile: 'traced'`.
   */
  tieApexThickness?: number;
  /**
   * Round 48: **crown flatness of the traced tie contour** — where the outer
   * and inner cubic control points stand along the chord (0.21 = 21% from each
   * tip, the median of the four LilyPond ties measured: 14.3%, 19.9%, 22.7%,
   * 25.3%). A larger fraction flattens the crown. Read only under
   * `options.tieProfile: 'traced'`.
   */
  tieControlFraction?: number;
  /**
   * Round 49 §6 (corrected) — the **reference tie laws** of the traced tie
   * (read only under `options.tieProfile: 'traced'`): the reference's own
   * functional forms, re-derived from their published mathematical statement
   * and expressed in staff-space units (see `ties.ts` for the citations and
   * the verification). The height saturates by the normalized arctangent
   * form `h(w) = h_inf · F(w · r_0 / h_inf)` with `F(x) = (2/π)·atan(π·x/2)`,
   * and the control indent follows the reference rational law
   * `G(w) = 2·h_inf − q²·m/(w + q)` with `q = 2·h_inf/m`. Converted to pt
   * through `tieRefStaffSpace`; verified against LilyPond 2.26.0's own
   * computed control-points (five spans, < 0.001 sp) and the four recorded
   * output specimens of the Round 48 dossier (< 0.006 pt). The contour keeps
   * its **round edging stroke** of `tieEdgeStroke` pt (round joins and caps)
   * — the reference stencil's softened tips.
   */
  /** LilyPond staff-space size (pt) of this notation's tie scale. */
  tieRefStaffSpace?: number;
  /** Reference height limit `h_inf` (staff spaces; LilyPond Tie `height-limit` default). */
  tieRefHeightLimit?: number;
  /** Reference small-span slope ratio (LilyPond Tie `ratio` default). */
  tieRefRatio?: number;
  /** Reference indent law's max fraction `m` (the `G'(0)` slope of the source law). */
  tieRefIndentMaxFraction?: number;
  tieEdgeStroke?: number;
  // --- Round 42 (Phase 3 study): compact bracket-duration vocabulary ---
  /** Compact cut: transverse length (pt) of one subdivision cut. */
  compactCutLength?: number;
  /** Compact cut / ring: shared stroke width (pt) of one compact mark. */
  compactMarkStroke?: number;
  /** Compact ring: centreline radius (pt) of one elongation ring. */
  compactRingRadius?: number;
  /** Compact ring: stroke width (pt) of one elongation ring. */
  compactRingStroke?: number;
  /**
   * Compact family: centre-to-centre spacing (pt) between adjacent stacked
   * marks (cuts on the bracket, marks along the horizontal carrier).
   */
  compactMarkSpacing?: number;
  /**
   * Round 42: fixed length (pt) of the horizontal exception carrier — a
   * typographic constant, **independent of the member's duration and release**.
   * Used by the `'compact'` family; the `'midpoint'` family derives its own
   * fixed carrier length from the mark ink (see `midpointMetrics`), scaled by
   * the admitted cluster's own symbol scale.
   */
  exceptionCarrierLength?: number;
  // --- Round 43/44 (midpoint study): the one 45-degree slash family ---
  /**
   * Midpoint slash: the pre-change run (pt) of the slash's centreline. Round 44
   * keeps this and {@link midpointSlashSlope} as the **source constants** of the
   * scale-free centreline length `L0 = hypot(midpointSlashLength,
   * midpointSlashLength · midpointSlashSlope)` (4.95 → `L0 = 5.0683745915pt`);
   * the painted 45-degree components are each `L0/√2 · s`.
   */
  midpointSlashLength?: number;
  /** Midpoint slash: stroke width (pt) at scale 1 — the painted width is `× s`. */
  midpointSlashStroke?: number;
  /**
   * Midpoint slash: the pre-change rise/run of the source slash (0.22), kept so
   * `L0` is derived from the original dimensions. The painted slash is always
   * the page-oriented **positive 45 degrees** — the orientation is not a token.
   */
  midpointSlashSlope?: number;
  /** Midpoint ring: centreline radius (pt) at scale 1 — painted `× s`. */
  midpointRingRadius?: number;
  /** Midpoint ring: stroke width (pt) at scale 1 — painted `× s`. */
  midpointRingStroke?: number;
  // --- Round 45: readability ratios and the optical clearance policy ---
  /**
   * Round 45: multiplier on the 45-degree slash's painted centreline length
   * (`L0`), preserving the 45-degree page orientation. `1` is the Round 43/44
   * family (default); the Round 45 candidates and the working Brahms Reference
   * paint `1.10`.
   */
  midpointSlashLengthFactor?: number;
  /**
   * Round 45: multiplier on the midpoint **ring**'s radius *and* stroke
   * (`R = 1.60·s·factor`, `stroke = 0.59·s·factor`) — the group value reads
   * more authoritatively beside larger numerals. `1` is the Round 43/44 ring
   * (default). Round 46 reads this as the **carrier mount's** factor and the
   * shared base of the bracket mount's (see
   * {@link JankoTokens.midpointBracketRingScale}): the horizontal long-value
   * marks keep exactly this size.
   */
  midpointRingScale?: number;
  /**
   * Round 46: the **bracket mount's** extra ring multiplier on top of
   * {@link JankoTokens.midpointRingScale} — the bracket's ring and half-ring
   * (radius *and* stroke) grow by this factor, so a spine-mounted long value
   * reads authoritatively at the numerals' left edge; the horizontal carrier's
   * rings/half-rings stay at the Round 45 size. Shared meaning does not require
   * identical physical size, and the *envelope* shrinks (two rings max plus a
   * half-ring) even as each mark grows. `1` (default) keeps both mounts equal.
   */
  midpointBracketRingScale?: number;
  /**
   * Round 45: multiplier on the **cut** centre-to-centre spacing, applied on
   * both mounts (bracket spine and horizontal carrier). `1` is the Round 43/44
   * family (default); the Round 45 candidates painted `7/6`, which made the
   * 90 % Reference's cut centre pitch exactly `1.40 ×` the Round 44 `.75`
   * baseline (`P45(s) = P44(.75)·1.40·(s/.90)`). Round 46 keeps the same
   * multiplicative mechanism and re-derives the factor so the **95 % working
   * scale gains another 0.20pt** of cut centre pitch (1.89658 → 2.09658pt) —
   * cut readability is addressed by spacing alone, never by re-angling or
   * lengthening the 45-degree slash.
   */
  midpointSpacingFactor?: number;
  /**
   * Round 45: **vertical optical clearance air** (pt) between two masks of one
   * admitted bracket cluster — an explicit new policy of this round, not the
   * (never enforced) `chordKnockoutAir` field. Read only under
   * `options.opticalSpacing`.
   */
  opticalClearanceAir?: number;
  // --- Round 47: the half-ring flat face and the experimental open-oval family ---
  /**
   * Round 47: **optical air at a half-ring's flat face** (pt). A half-ring's
   * chord is a straight line: wherever the mark stands *on a mount* (the
   * bracket spine, the horizontal exception carrier) that mount line would
   * close the semicircle and make the mark read as a full ring. With a
   * positive value the mount is **interrupted** across the chord and resumes
   * `halfRingGap` clear of each chord end — the flat face becomes a deliberate
   * break, nothing is drawn to close it, and no glyph ink is ever erased
   * (the gap is cut out of the mount's own path, never masked). Where a
   * **detached** long-value mark stands on no mount of its own
   * ({@link JankoLayoutOptions.exceptionCarrier} `'symbol'`), the same number
   * is the air its chord band keeps from any drawn staff rule, so the flat
   * face stays unambiguous there too. `0` (default) is the incumbent
   * engraving: the chord is coincident with the unbroken mount line,
   * byte-identical.
   */
  halfRingGap?: number;
  /**
   * Round 48: **detached closed-circle scale**. The long-value mark families
   * were measured against the pitch numerals: the closed carrier ring's outer
   * diameter is 3.96pt against the `0` digit's 3.67pt advance, so a detached
   * ring reads almost as wide as the absolute pitch symbol it stands beside and
   * the two compete. This multiplier is applied to the **detached, cluster,
   * closed-ring** geometry alone — radius, stroke and stack pitch of a full
   * ring on a detached seat (`exceptionCarrier: 'symbol'`) — never to a
   * half-ring (its shape and size are unchanged), never to the bracket mount,
   * never to a horizontal carrier and never to the canonical engraving.
   * `1` (default) is the Round 47 geometry, byte-identical.
   */
  detachedRingScale?: number;
  /**
   * Round 48: **air (pt) a detached long-value symbol keeps from its owning
   * head's knockout box**. Round 47 seated the mark at the cluster's own
   * optical air (0.30pt on the working Brahms surface), which measured as a
   * 0.30pt gap between the head's knockout edge and the symbol's ink — legible
   * at 300% zoom, ambiguous at 100%. This is the token the size/spacing
   * variants of the round differ in: the seat, the ink box, the rule-knockout
   * band and the linter all read it. The half-ring keeps its shape and size and
   * receives the same increased spacing only.
   */
  detachedSymbolAir?: number;
  /**
   * Round 49 §5: **family-wide rightward air (pt) of the horizontal duration
   * mounts that have no air token of their own** — the horizontal carrier arm
   * and every short carrier. The detached seats keep their own token
   * (`detachedSymbolAir`, which governs both the closed circle and the
   * half-ring), so each family's gap is governed by one declared number and
   * the two adopted values together widen every horizontal indicator family.
   * The effective air of a mount is the maximum of the cluster's own optical
   * air and its family token, so a declared air can only widen a gap, never
   * shrink one. No time-column, cluster-spacing or augmentation-dot semantic
   * is touched. `0` (default) is inert: every mount keeps its incumbent air.
   */
  horizontalMountAir?: number;
  /**
   * Round 48: **half-height (pt) of a detached ring's local staff-rule
   * knockout**. The band is the rule's own ink height plus this air on each
   * side (`rule ink + 2 × half`): the line is cleaned just inside the ring's
   * hollow interior, exactly as a notehead knockout cleans the line behind its
   * glyph, and nothing wider is ever erased. Default `0.12` clears the drawn
   * octave/extension rules (0.65pt) and the Middle-C spine (1.35pt) inside a
   * closed ring whose interior is at least 3.2pt across.
   */
  staffRuleKnockoutHalfHeight?: number;
  /**
   * Round 47 (`longDurationStyle: 'open-oval'`): tilt (degrees, clockwise) of
   * the **96-tick** open oval. `-30` lifts the compact oval's major axis to the
   * right, so 96 reads by *orientation* as well as by size.
   */
  openOvalTiltDegrees?: number;
  /**
   * Round 47 (`longDurationStyle: 'open-oval'`): the 96-tick oval's semi-major
   * axis, as a fraction of the mount's ring radius.
   */
  openOvalNarrowFactor?: number;
  /**
   * Round 47 (`longDurationStyle: 'open-oval'`): the 192- and 384-tick oval's
   * semi-major axis, as a fraction of the mount's ring radius — measurably
   * broader than {@link JankoTokens.openOvalNarrowFactor}, so the distinction
   * is never size alone.
   */
  openOvalBroadFactor?: number;
  /**
   * Round 47 (`longDurationStyle: 'open-oval'`): every open oval's semi-minor
   * axis, as a fraction of the mount's ring radius (one height for the whole
   * family, so the three values differ by orientation, breadth and the breve
   * flanks alone).
   */
  openOvalHeightFactor?: number;
  /**
   * Round 47 (`longDurationStyle: 'open-oval'`): clear air between an oval's
   * major vertex and the centreline of the 384-tick breve's flank stroke, as a
   * fraction of the mount's ring radius — the conventional breve's two short
   * vertical lines stand clear of the oval instead of touching it.
   */
  openOvalFlankGap?: number;
  /**
   * Round 47 (`longDurationStyle: 'open-oval'`): half-length of one breve flank
   * stroke, as a fraction of the oval's semi-minor axis.
   */
  openOvalFlankFactor?: number;
}

/** Fully resolved token set (every optional token filled in). */
export type ResolvedJankoTokens = Required<Omit<JankoTokens, 'knockoutMargin' | 'knockoutAir'>> & {
  knockoutMargin?: number;
  knockoutAir?: number;
};

/**
 * Canonical Jánko Two-Row engraving tokens.
 *
 * h = 15.0pt row grid; the octave equator step is 2h = 30.0pt. The
 * Position-of-Honor halo ring is R = 6.2pt around the rectangular white mask,
 * and the duodecimal digit is set at 5.8pt so its ink box keeps the preset
 * margin (0.8pt golden) of clean white on every side of the mask.
 */
export const DEFAULT_JANKO_TOKENS: ResolvedJankoTokens = {
  rowHeight: 15.0,
  noteheadRadius: 4.8,
  digitFontSize: 5.8,
  haloRadius: 6.2,
  octaveStep: 30.0,
  accoladeWidth: 4.8,
  accoladeThick: 0.55,
  fontFamily: '"URW Gothic", "Century Gothic", "ITC Avant Garde Gothic", "Avant Garde", sans-serif',
  stemLength: 16.0,
  stemAttachmentAir: 1.0,
  slashDx: 2.8,
  slashDy: 1.6,
  measureInset: 6.0,
  ticksPerMeasure: 144,
  anacrusisTicks: 0,
  ticksPerBeat: 48,
  ledgerHalfWidth: 7.0,
  beamThickness: 1.8,
  maxBeamSlope: 0.22,
  accoladeGap: 7.0,
  augmentationDotRadius: 0.75,
  augmentationDotGap: 1.2,
  augmentationDotRowOffset: 3.5,
  flagWidth: 4.0,
  flagHeight: 6.6,
  flagSpacing: 3.4,
  minStemClearance: 1.5,
  channelHalfWidth: 6.5,
  channelFlankOffset: 13.0,
  claspWidth: 2.2,
  claspStrokeWidth: 0.85,
  claspOffset: 2.8,
  claspMinBarlineAir: 4.0,
  contourThreadScale: 2.5,
  contourThreadStroke: 0.5,
  contourTickStroke: 0.7,
  contourStripHeight: 24,
  contourStripAir: 3,
  semitoneScale: 2.5,
  ottavaDashLength: 3.5,
  ottavaDashGap: 2.0,
  ottavaHookLength: 4.0,
  ottavaClearance: 6.0,
  ottavaLineWidth: 0.35,
  // Round 41 — provisional starting values (the ticket's dimensions; bounded
  // optical adjustment is recorded in the round's rationale, never hidden).
  chordKnockoutMargin: 0.10,
  chordKnockoutAir: 0.20,
  holdConnectorStroke: 0.40,
  holdUnderlayWidth: 0.90,
  holdTerminalAir: 0.20,
  holdStopBarHeight: 2.40,
  holdStopBarStroke: 0.55,
  holdDiamondSize: 1.60,
  holdRingDiameter: 2.20,
  holdRingStroke: 0.40,
  // Round 46: the written tie arc (see {@link JankoTokens.tieStroke}).
  tieStroke: 0.70,
  tieEndpointAir: 1.00,
  tieMinDepth: 1.20,
  tieMaxDepth: 3.00,
  tieDepthRatio: 0.10,
  tieRuleAir: 0.35,
  // Round 48 — the **traced** profile (`options.tieProfile: 'traced'`): the mid
  // thickness and crown flatness measured from LilyPond's own tie contour (see
  // `ties.tieTracedGeometry`). Inert unless the option selects the traced
  // profile, so the canonical surface paints the Round 46 arc unchanged.
  tieApexThickness: 0.45,
  tieControlFraction: 0.21,
  // Round 49 §6 (corrected) — the **reference tie laws** (see the token docs
  // above): the reference's own functional forms in staff-space units — the
  // measured 4.984pt staff space of the Round 48 specimen record, the Tie
  // grob defaults `height-limit = 1.0 sp` and `ratio = 0.333`
  // (`scm/define-grobs.scm`, v2.26.0), and the indent law's max fraction
  // `m = 1/3.1`. Verified against LilyPond's own computed control-points and
  // the recorded output specimens; see `ties.tieTracedDepth`.
  tieRefStaffSpace: 4.984,
  tieRefHeightLimit: 1.0,
  tieRefRatio: 0.333,
  tieRefIndentMaxFraction: 1 / 3.1,
  tieEdgeStroke: 0.25,
  // Round 42 (Phase 3 study) — compact family; the refinement's dimensioned
  // recommendation (cut 2.4/0.42, ring centreline Ø1.60/0.38 → outer Ø1.98,
  // mark spacing 2.40, fixed horizontal carrier 9.0). Experimental, not adopted.
  compactCutLength: 2.4,
  compactMarkStroke: 0.42,
  compactRingRadius: 0.8,
  compactRingStroke: 0.38,
  compactMarkSpacing: 2.4,
  exceptionCarrierLength: 9.0,
  // Round 43 (midpoint study) — the unified diagonal-slash family. The cut is
  // the midpoint between the golden 7.5pt/1.0pt cut and the compact 2.4pt/0.42pt
  // cut; the ring is the midpoint between the golden R2.4pt/0.8pt bracket ring
  // and the compact R0.8pt/0.38pt ring. Slope is the score's own beam rake.
  midpointSlashLength: 4.95,
  midpointSlashStroke: 0.71,
  midpointSlashSlope: 0.22,
  midpointRingRadius: 1.6,
  midpointRingStroke: 0.59,
  // Round 45 — no-ops by default: `1` keeps the Round 43/44 midpoint family
  // (and the canonical engraving) byte-identical; the working Brahms Reference
  // and the three Round 45 candidates opt into the readability ratios.
  midpointSlashLengthFactor: 1,
  midpointRingScale: 1,
  midpointBracketRingScale: 1,
  midpointSpacingFactor: 1,
  opticalClearanceAir: 0.20,
  // Round 47 — inert by default: `halfRingGap: 0` keeps the half-ring's chord
  // exactly on the unbroken mount line (the incumbent engraving), and the
  // open-oval geometry is read only under `longDurationStyle: 'open-oval'`.
  // The ratios are the experimental adaptation's declared geometry: 96 is a
  // compact oval tilted 30 degrees, 192 a 1.10:0.62 broad horizontal oval, and
  // 384 that oval with two short flank strokes 0.30 radii clear of its vertices.
  halfRingGap: 0,
  // Round 48 — inert by default: `detachedRingScale: 1` and
  // `detachedSymbolAir: 0.30` (the round's own optical air) reproduce the
  // Round 47 detached geometry exactly, so every canonical surface stays
  // byte-identical; the round's two candidates set them explicitly.
  detachedRingScale: 1,
  detachedSymbolAir: 0.30,
  // Round 49 §5 — inert by default: `horizontalMountAir: 0` keeps every
  // horizontal duration mount at its incumbent air, so every canonical
  // surface stays byte-identical; the family-wide gap is declared explicitly
  // where it is adopted.
  horizontalMountAir: 0,
  staffRuleKnockoutHalfHeight: 0.12,
  openOvalTiltDegrees: -30,
  openOvalNarrowFactor: 0.66,
  openOvalBroadFactor: 1.10,
  openOvalHeightFactor: 0.62,
  openOvalFlankGap: 0.30,
  openOvalFlankFactor: 0.95,
};

/**
 * Round 41: the release-endpoint shapes of the exceptional-duration
 * hold-to-release treatment. The connector is shared; this is the round's only
 * open axis.
 */
export type JankoDurationEndpoint = 'none' | 'stop-bar' | 'diamond' | 'ring';

/** The three judged endpoint shapes, in the round's canonical order. */
export const JANKO_DURATION_ENDPOINTS: readonly JankoDurationEndpoint[] = [
  'stop-bar',
  'diamond',
  'ring',
];

/** Macro-layout options for a Jánko Two-Row page or crop. */
/**
 * Round 45: how a source pitch below the core's drawn coverage is presented.
 *
 * - `'core'`: fold it up into the core and mark the octave with the ↓10/↓20
 *   ottava indicator (the historical behavior, default).
 * - `'literal'`: draw it at its literal written pitch with the established
 *   dynamic ledger equators of its out-of-staff octave(s) — exact pitch
 *   semantics, no displaced-note indicator.
 */
export type JankoLowPitchFolding = 'core' | 'literal';

/**
 * Round 46: how a score's committed written-tie chains are rendered
 * (see {@link JankoLayoutOptions.writtenTies}).
 */
export type JankoWrittenTies = 'none' | 'source';

/** Per-glyph optical displacement cap (pt): one 1-span, Round 45. */
export const OPTICAL_DISPLACEMENT_CAP = 2.5;

export interface JankoLayoutOptions {
  /** Measures engraved per horizontal system. */
  measuresPerSystem: number;
  /** Pluggable rhythm renderer style. */
  rhythmStyle: JankoRhythmStyle;
  /** Vertical gap between the two inner staff equators (o4 and o3) — the Middle C corridor. */
  interStaffGap: number;
  /** Middle C spine rendering style. */
  middleCSpine: JankoMiddleCSpine;
  /**
   * Octave framing: the incumbent floating single equator (golden master, 4
   * rules) or one of the three comparative paradigms — `'on-the-line'` and
   * `'single-line-3row'` (4 rules each) and `'bounded-channel'` (8 rules). See
   * {@link JankoChannelLayout}.
   */
  channelLayout: JankoChannelLayout;
  /**
   * Vertical chord/cluster grouping and duration carrier (Round 5, refined by
   * Round 6, standardized by Round 14). `'none'` keeps the incumbent per-note
   * stems; the clasp paradigms draw an external left bracket per cluster (see
   * {@link JankoChordGrouping}). Defaults to the settled `'per-hand-clasp'`.
   */
  chordGrouping: JankoChordGrouping;
  // --- Optional page/layout refinements (resolved from defaults) ---
  /**
   * Single-note subdivision style (Round 7, settled by Round 9): how an
   * isolated 8th/16th/32nd draws its duration at the stem tip. Defaults to the
   * settled `'kinetic-tab-beam'` tab (see {@link JankoSubdivisionStyle}).
   */
  subdivisionStyle?: JankoSubdivisionStyle;
  /**
   * Midpoint clasp-duration paradigm (Round 11, standardized by Round 12): how
   * an external per-hand bracket carries its cluster's duration at its spine
   * midpoint with a light transverse line cut. Defaults to the settled
   * `'kinetic-cross-slashes'` — up-raked 12.4° cuts that speak the score's own
   * beam-harmonized kinetic language (see {@link JankoClaspDurationStyle}).
   */
  claspDurationStyle?: JankoClaspDurationStyle;
  /**
   * Rest symbol dialect (Round 12, extended by Round 13): how a hand's silent
   * span inside an active measure is written. The rest hangs from the nearest
   * whole-tone row of its phrase octave and extends toward the Middle C
   * corridor (Round 17B phrase rows). Defaults to `'kinetic-monoline'` (see
   * {@link JankoRestStyle}).
   */
  restStyle?: JankoRestStyle;
  /**
   * Horizontal cluster spacing (Round 17): the rectangular mask margin and the
   * breathing air between same-row heads of one onset. Defaults to the golden
   * `'tight'` (see {@link JankoClusterSpacing}).
   */
  clusterSpacing?: JankoClusterSpacing;
  /**
   * Vertical grid writing policy (Round 12): how the continuous barlines and
   * dashed beat pulses coexist with the music. Defaults to
   * `'overlaid-beat-grid'` (see {@link JankoGridWritingPolicy}).
   */
  gridWritingPolicy?: JankoGridWritingPolicy;
  /**
   * System-start margin ink (Round 10, extended by Round 11, settled by
   * Round 14): the copperplate accolade is retired in favour of the flared
   * 0.65pt architectural bracket. Defaults to `'architectural-bracket'` (see
   * {@link JankoSystemStartStyle}).
   */
  systemStartStyle?: JankoSystemStartStyle;
  /**
   * Final barline of the score (Round 10): `'unified'` seals the Middle C
   * corridor with one continuous boundary, `'split-corridor'` leaves it open.
   * Defaults to `'unified'` (see {@link JankoFinalBarlineStyle}).
   */
  finalBarlineStyle?: JankoFinalBarlineStyle;
  /** Horizontal systems stacked on one page. */
  systemsPerPage?: number;
  /** Ticks in one measure. */
  ticksPerMeasure?: number;
  /** Upbeat duration in ticks. */
  anacrusisTicks?: number;
  /** Ticks per beat. */
  ticksPerBeat?: number;
  /** Horizontal inset of the first/last note of a measure. */
  measureInset?: number;
  /** Extra clearance reserved for the opening time signature. */
  timeSignatureWidth?: number;
  /** A4 portrait page width in pt. */
  pageWidth?: number;
  /** A4 portrait page height in pt. */
  pageHeight?: number;
  /** Page margin in pt. */
  pageMargin?: number;
  /** Left page margin in pt; null follows `pageMargin`. */
  pageMarginLeft?: number | null;
  /** Right page margin in pt; null follows `pageMargin`. */
  pageMarginRight?: number | null;
  /** Top page margin in pt; null follows `pageMargin`. */
  pageMarginTop?: number | null;
  /** Bottom page margin in pt; null follows `pageMargin`. */
  pageMarginBottom?: number | null;
  /** Header reservation in pt. */
  headerHeight?: number;
  /** Footer reservation in pt. */
  footerHeight?: number;
  /** Draw measure numbers above the first measure of every system. */
  showMeasureNumbers?: boolean;
  /** Draw the Position of Honor halo ring around the opening sound(s). */
  showHonorHalo?: boolean;
  /** Draw octave labels at the left margin. */
  showOctaveLabels?: boolean;
  /**
   * Draw pitch landmarks at the left margin of the continuous grids (C per C
   * under most schemes, the bare octave digit under `'equal-centers'`).
   * Defaults to `false`: the grids read by shape and position.
   */
  showPitchLabels?: boolean;
  /** Draw m.d./m.s. hand labels. */
  showHandLabels?: boolean;
  /** Draw stacked time signature numerals (e.g. 3/4) on opening measure. */
  showTimeSignature?: boolean;
  /** Draw subtle vertical dashed pulse lines on beats 2, 3, … (Klavarskribo beat grid). */
  showBeatGrid?: boolean;
  /**
   * Draw the faint dashed whole-tone row guidelines (`equator ± h/2`).
   * Off by default: the only dotted lines in the engraving are the vertical
   * beat-grid pulses, so the staff is never cluttered with horizontal dashes.
   */
  showRowGuidelines?: boolean;
  /**
   * Pitch-contour thread (the contour round): which hands' melodies carry the
   * true-pitch hairline. Defaults to `'none'` (see {@link JankoContourThread}).
   */
  contourThread?: JankoContourThread;
  /**
   * Pitch-contour departure ticks (the contour round): every melody notehead
   * carries a tiny slash on its outer side (odd rank above, even rank below)
   * showing where the line goes next (`/` up, `\` down, `–` same, `°`
   * breath). Defaults to `false`.
   */
  contourTicks?: boolean;
  /**
   * Pitch-contour strip (the contour round): a narrow absolute-pitch graph
   * below each system, x-aligned with the music (solid = RH, dashed = LH).
   * Defaults to `false`.
   */
  contourStrip?: boolean;
  /**
   * Pitch-to-height mapping (the pitch-mapping round): the twin whole-tone
   * rows, true continuous height, or true height on chromatic lanes.
   * Defaults to `'twin-rows'` (see {@link JankoPitchMapping}).
   */
  pitchMapping?: JankoPitchMapping;
  /**
   * Octave-line scheme (the line-scheme round): which rules the grand grid
   * draws. Ignored unless `pitchMapping` is `'continuous'`.
   * Defaults to `'grand-divider'` (see {@link JankoOctaveLineScheme}).
   */
  octaveLineScheme?: JankoOctaveLineScheme;
  /**
   * Fixed Middle-C-centered core octave line grammar (Round 27).
   * Defaults to `'fixed-3'`.
   */
  core?: JankoCore;
  /**
   * Extension row junction style at interior measure barlines (Round 28).
   * Defaults to `'default'` (short barlines + 6.0pt guest gaps).
   */
  extensionJunction?: ExtensionJunctionStyle;
  /**
   * Duration grammar (the Round 30 preview axis): which durations carry
   * written marks. Defaults to `'golden'` (see {@link JankoDurationGrammar}).
   */
  durationGrammar?: JankoDurationGrammar;
  /**
   * Situational clasp-dot translation (the Round 31 preview axis): a rigid
   * `[dx, dy]` shift in pt applied to BRACKET-attached augmentation dots
   * only — note dots are never touched. Defaults to `[0, 0]` (the judged
   * seats, byte-identical).
   */
  claspDotNudge?: JankoClaspDotNudge;
  /**
   * Beat-grid pulse filter (the Round 32/33 axis — judged: `'all'` is
   * canonical): which interior beat pulses are painted. `'all'` keeps every
   * existing interior quarter position; `'midpoint-only'` retains an existing
   * pulse iff its tick offset is exactly half `ticksPerMeasure`; `'none'`
   * paints no interior pulse at all (a filter over existing candidates — no
   * new subdivisions, no retiming, no barline change). Defaults to `'all'`.
   * Odd subdivisions with no existing midpoint retain no interior pulses
   * under the opt-ins; never reinterpreted as `'all'`.
   */
  gridPulseFilter?: JankoGridPulseFilter;
  /**
   * Compatibility-isolated page-top anacrusis width correction (Round 32
   * preview, canonical for Brahms since Round 33 was judged — not a
   * score-specific switch): later page-top systems use the normal
   * full-measure width instead of inheriting system 0's pickup-reduced
   * denominator. System 0 keeps its pickup geometry; no-pickup scores are
   * unchanged. Defaults to `false` (byte-identical for Goldberg).
   */
  correctPageTopAnacrusisMeasureWidth?: boolean;
  /**
   * Fold-coincident octave-pair presentation (the Round 34 m.33 axis):
   * how a same-onset same-hand octave pair that coincides only through
   * folding is drawn. `'literal-fold'` (default) folds the low note onto
   * the high note's row with its own ↓10; `'shared-ottava'` shifts both
   * notes up one octave under one shared ↓10; `'split-octave'` draws the
   * low note at its literal pitch (no fold, no bracket) as a true octave
   * stack. Sounding pitches are preserved in every mode; the bracket
   * alone transposes and never adds a note. Defaults to `'literal-fold'`
   * (byte-identical for Goldberg, which folds nothing).
   */
  foldPairPresentation?: JankoFoldPairPresentation;
  /**
   * Semantic hand-cluster compression (Round 35):
   * `'literal'` draws all notes with full heads across all registers;
   * `'spatial-echo'` draws origin heads + lightweight echo markers at copied registers;
   * `'compact-coupling'` draws origin heads + adjacent bounded additive structure (+10/+20).
   * Defaults to `'literal'`.
   */
  clusterCompression?: JankoClusterCompression;
  /**
   * Round 36 candidate: whole-form handprint cluster presentation.
   *
   * `'literal'` draws all constituent notes with standard noteheads.
   * `'mirrored-handprint'` draws dense 4/5-note hand clusters as a single calligraphic body
   * with base numeral integrated at origin and discrete landmark articulations.
   * Defaults to `'literal'`.
   */
  clusterPresentation?: JankoClusterPresentation;
  /**
   * Vertical page placement: `'slot'` centers staffs in fixed slots with
   * overflow-only correction; `'content-aware'` enforces facing ink
   * clearances (including ottava extent) then distributes residual page
   * space evenly within the page's slot block. Defaults to `'slot'`
   * (byte-identical for Goldberg).
   */
  verticalPlacement?: JankoVerticalPlacement;
  /**
   * Note placement scheme for chord / co-onset columns (Round 40).
   *
   * - `'standard'`: standard collision-assigned three-rail placement (default).
   * - `'parity-columns'`: two-column placement by whole-tone pitch parity.
   *   Even absolute pitch family on the left, odd family on the right.
   */
  pitchPlacement?: 'standard' | 'parity-columns';
  /**
   * Round 41: exceptional-duration **release endpoint** treatment.
   *
   * - `'none'`: canonical — an exceptional bracket member keeps its own exact
   *   duration statement (stem / flags / dot), the golden rule.
   * - `'stop-bar'` / `'diamond'` / `'ring'`: the member's own duration ink is
   *   replaced by a horizontal hold-to-release connector that starts flush at
   *   its protected right edge, runs at its true pitch y, and ends in the named
   *   terminal mark centred on the resolved release time.
   */
  durationEndpoint?: JankoDurationEndpoint;
  /**
   * Round 41: absolute pitch symbol scale for **same-hand chord members** — a
   * co-onset group of two or more source notes in one hand (`1` = canonical).
   * Standalone symbols always keep the canonical size and mask.
   */
  chordSymbolScale?: number;
  /**
   * Round 42 (Phase 3 study): the bracket's duration **mark family**.
   *
   * - `'golden'`: canonical — the incumbent transverse cuts / open rings
   *   (7.5pt cuts at 0.85/1.0pt, R=2.4pt rings), saturating at two marks.
   * - `'compact'`: the proposed compact family — short cuts
   *   ({@link JankoTokens.compactCutLength}pt / `compactMarkStroke`pt) and small
   *   elongation rings (`compactRingRadius`/`compactRingStroke`, outer Ø1.98pt)
   *   at `compactMarkSpacing`pt, counting 4/3/2/1 cuts then bare then 1/2/3
   *   rings so all eight plain values are distinct. Experimental candidate
   *   vocabulary, never promoted to canonical.
   * - `'midpoint'`: the Round 43/44 candidate — the shared counts of
   *   `'compact'` painted with **one page-oriented positive-45-degree slash**
   *   and one ring size, at the admitted cluster's own symbol scale, identical
   *   in every dimension and centre pitch on the bracket spine and on the
   *   horizontal exception carrier. Experimental candidate vocabulary, never
   *   promoted to canonical.
   */
  bracketDurationGrammar?: JankoBracketDurationGrammar;
  /**
   * Round 42 (Phase 3 study): the **exception member** treatment for an
   * admitted bracket member whose own duration differs from the group's
   * carried value.
   *
   * - `'none'`: canonical — the exception keeps its own exact statement.
   * - `'horizontal'`: the member's own stem/flag ink is replaced by a
   *   fixed-length ({@link JankoTokens.exceptionCarrierLength}pt) horizontal
   *   carrier at its true pitch y, carrying the member's own compact marks
   *   **along** the carrier. A typographic statement of the member's own
   *   duration — never a release-time length.
 * - `'symbol'` (Round 47): the **long-value** exception marks are detached
 *   symbols. A member whose own value the active family states with a long
 *   mark (96 = half-ring, 192 = ring, 384 = two rings / the breve) keeps that
 *   mark but **not** the horizontal arm: the pure symbol run is seated
 *   directly beside its owning head (or beside the pair it belongs to) at the
 *   nearest legal, collision-free seat, with its exact dots. Short-value
 *   exception members (the 1–4 cut values) keep the horizontal carrier
 *   unchanged, so the round only ever touches the long-value family.
   */
  exceptionCarrier?: JankoExceptionCarrier;
  /** Candidate-only, guarded complete-owner shared long-mark seat requests. Not a canonical default. */
  durationSeatPreferences?: Array<{ tick: number; ownerIds: string[]; family: 'ring' | 'half-ring'; seat: 'above' | 'beside' }>;
  /**
   * Round 49 §2: **where an ordinary standalone long value mounts**. `'right'`
   * (default) is the incumbent detached mount — the circle/half-circle run on
   * the head's own pitch line immediately to its right. `'above'` introduces
   * the above-numeral mount: the same vocabulary seated in the vertical band
   * above the owning head's numeral, at the nearest legal lane the bounded
   * actual-ink seat walk finds (own/foreign heads, knockouts, the head's own
   * stem, beams, rests, brackets, sibling symbols, drawn rules and the staff
   * boundary are all measured). Shared 2-span pair statements and short-value
   * cues are untouched — a shared pair keeps its pair channel, and a refused
   * above seat falls back to the incumbent right seat (never a silent
   * omission: the value stays stated, and a double refusal is published).
   */
  standaloneLongMount?: 'right' | 'above';
  /**
   * Round 45: **declared, centred optical cluster spacing**.
   *
   * When `true`, every *actually admitted* bracket cluster (the exact
   * `admittedBracketIds` ownership of the chord-column solve) may distribute a
   * minimum uniform extra vertical gap across its distinct true pitch levels so
   * the members' own masks keep `tokens.opticalClearanceAir` of clear air. The
   * offsets are **optical position metadata, never a musical transposition**:
   * sounding pitch, written pitch, source onset/duration and the staff lattice
   * are untouched, the offsets are centred on the member-weighted mean (the
   * cluster centroid never translates), a cluster that already clears needs
   * zero delta, and any per-glyph displacement is capped at
   * {@link OPTICAL_DISPLACEMENT_CAP} (one 1-span). Defaults to `false` — the
   * canonical (and Round 44) layout, byte-identical.
   */
  opticalSpacing?: boolean;
  /**
   * Round 45: **low-pitch presentation**.
   *
   * - `'core'` (default): the historical behavior — a source pitch below the
   *   core's coverage folds up by an octave (or two) under its ↓10/↓20 ottava
   *   indicator so it fits the drawn rows.
   * - `'literal'`: the note is drawn at its **literal written pitch** — no fold
   *   shift and no ottava indicator are emitted for it, so its register is the
   *   head's own position. Round 45 additionally stated that register with
   *   dynamic ledger equators; Round 46 removed that extra ink (the operator
   *   rejected the recurring outlier rules, ledger dashes and the bottom-row
   *   segments they earned) while keeping every literal position exactly as
   *   drawn. Nothing else moves: the system spacing and pagination are
   *   unchanged.
   */
  lowPitchFolding?: JankoLowPitchFolding;
  /**
   * Round 46: **written tie rendering** (the m66/composite repair).
   *
   * - `'none'` (default): the historical surface — a sounding event whose
   *   written value is a tie/composite paints one head carrying the *total*
   *   value, and a value the alphabet cannot state is published as an
   *   unrepresented composite. Every pre-Round-46 geometry is unchanged.
   * - `'source'`: the score's committed written-tie sidecar
   *   (`QuantizedGridScore.tieChains`) is rendered: each component gets an
   *   explicit statement (its own duration ink), consecutive components are
   *   joined by a conventional tie arc, a continuation that coincides with an
   *   existing same-pitch head reuses that head, and the *only* heads added are
   *   the written continuation components that no head already states.
   *   Coincident same-hand attack/carry groups merge to one visible attack head
   *   (the tie chain owns it), and non-grammar composites disappear because
   *   their components are now stated exactly. Sounding pitch, onset and total
   *   duration are never touched, and no new attack is ever introduced.
   */
  writtenTies?: JankoWrittenTies;
  /**
   * Round 47: **long-value symbol family** (the round's duration axis).
   *
   * - `'midpoint'` (default): the incumbent Round 43/44/46 vocabulary — the
   *   45-degree slash cuts and the ring family, whose long values read
   *   `96 → half-ring`, `192 → one full ring`, `384 → two full rings`; the
   *   golden / compact grammars are untouched.
   * - `'open-oval'` (Round 47 candidate): the same in-grammar values and the
   *   same short-value cuts and dots, but the **long** values are the
   *   conventional hollow-oval distinctions: `96 → one compact tilted oval`,
   *   `192 → one distinguishably broader horizontal oval`, `384 → that oval
   *   with the breve's two short vertical flank strokes`. The same shape
   *   vocabulary is painted on the bracket mount and on every detached seat;
   *   the mount line is knocked out under the oval's interior (never under a
   *   neighbour's ink) and no three-mark stack exists in this family. This is
   *   an **experimental adaptation** of the traditional shapes to this
   *   notation's ratio algebra, not a claim to reproduce traditional notation.
   */
  longDurationStyle?: JankoLongDurationStyle;
  /**
   * Round 47: **outgoing-tie originator simplification** (the round's
   * redundancy axis).
   *
   * - `'source'` (default): every component of a written tie chain states its
   *   own duration — the Round 46 behavior, byte-identical.
   * - `'omit-outgoing'` (Round 47 candidate): a note or written component of
   *   an admitted cluster whose own value the active family states with a
   *   **long** mark (96 / 192 / 384) **omits that individual mark** when the
   *   committed written-tie chain gives it an *outgoing* tie — the
   *   continuation is stated by the arc plus the next component, so the
   *   origin's own exception mark is redundant. The decision reads the **true
   *   source chain topology** (never a rendered system or a crop boundary), so
   *   a continuation in another system or outside a review window still
   *   counts. Never omitted: the terminal component (its value has no
   *   continuation to lean on), the bracket's own carried value (the bracket
   *   is the statement), pitches, onsets, sounding totals, tie chains,
   *   playback and continuation heads. A shared indicator is only withdrawn
   *   when it is redundant for **all** of its owners; otherwise it survives
   *   with the surviving owners named. Every omission is published on the
   *   system's `tieOriginSuppressions` and checked against the duration-ink
   *   census.
   */
  tieOriginIndicator?: JankoTieOriginIndicator;
  /**
   * Round 48: **the tie's own contour** (the round's shared tie treatment).
   *
   * - `'uniform'` (default): the Round 46 single quadratic path of constant
   *   `tokens.tieStroke` width with butt caps — the canonical surface,
   *   byte-identical.
   * - `'traced'`: the filled **two-cubic** contour traced from the tie LilyPond
   *   2.26.0 paints (the compiler of this score's pinned source): pointed tips
   *   where both boundaries meet, a constant `tokens.tieApexThickness` mid
   *   thickness tapering to zero, and control points at
   *   `tokens.tieControlFraction` of the chord — a flat, wide crown instead of
   *   a peaked arc. The span adaptation (the apex height) stays this engine's
   *   own declared law; the contour and the tips are the traced source's. Only
   *   the *shape* changes: endpoints, side, routing and the published stem
   *   crossings are shared with the uniform profile.
   */
  tieProfile?: JankoTieProfile;

  /** Page title (full-page renders only). */
  title?: string;
  /** Page subtitle (full-page renders only). */
  subtitle?: string;
  /** Page composer attribution (full-page renders only). */
  composer?: string;
}

/**
 * Extension row junction style at interior measure barlines (Round 28).
 *
 * - `'default'`: golden behavior — measure barlines keep short heights
 *   (lin 60–36 staff rules), extension rows stand off 6.0pt (`t.measureInset`).
 * - `'conjoin'`: Card A — measure barlines span the outer-row levels
 *   (fixed-3: lin 72–24; fixed-4: 77.5–17.5), and extension-row interior
 *   terminals run flush into abutting barlines (0pt gap, 90° T-junction).
 * - `'wide-gap'`: Card B — extension rows stand off 12.0pt (double the house
 *   inset) from abutting barlines; barlines keep short heights.
 */
export type ExtensionJunctionStyle = 'default' | 'conjoin' | 'wide-gap';

/**
 * Duration grammar (the Round 30 preview axis): which durations carry written
 * marks, all deriving from the NOTATED duration on the 48-grid by exact
 * arithmetic (see `elements/duration.analyzeNotatedDuration`).
 *
 * - `'golden'`: the incomplete incumbent — a dot iff `d ∈ (26, 38]`
 *   (dotted 8ths only), flags/beam levels by raw threshold, lone longs read
 *   exactly like quarters.
 * - `'complete'`: the preview — lone half/whole notes carry the bracket open
 *   rings stem-mounted (one = half, two stacked = whole), every dotted value
 *   shows its dot(s) (doubly dotted doubly, singles/beamed/brackets alike),
 *   and flags/beam levels derive from the notated base value. Durations with
 *   no exact plain/dotted/double-dotted reading (ties, tuplets, MIDI holds)
 *   keep their current rendering under both grammars.
 */
export type JankoDurationGrammar = 'golden' | 'complete';

/**
 * Bracket duration **mark family** (the Round 42 Phase-3 study axis): which
 * primitives a shared-duration bracket paints for each plain value.
 *
 * - `'golden'`: the incumbent transverse cuts / open rings (saturating at two).
 * - `'compact'`: the proposed compact cut/ring family (1–4 cuts, bare, 1–3
 *   rings) — candidates only, never canonical.
 * - `'midpoint'`: the Round 43/44 candidate — one **45-degree slash**
 *   primitive (the pre-change centreline length `L0 = 5.0683745915pt` split
 *   into equal x/y components and scaled by the admitted cluster scale)
 *   painted **identically** on the bracket spine and on the horizontal
 *   exception carrier, only the stacking direction differing. Counts match
 *   `'compact'` (1–4 cuts, bare, 1–3 rings); candidate only, never canonical.
 */
export type JankoBracketDurationGrammar = 'golden' | 'compact' | 'midpoint';

/**
 * Exception-member carrier (the Round 42 Phase-3 study axis): how an admitted
 * bracket member whose own duration differs from the carried value states that
 * value. `'none'` is canonical (the member keeps its own statement);
 * `'horizontal'` replaces it with the fixed-length horizontal carrier.
 */
export type JankoExceptionCarrier = 'none' | 'horizontal' | 'symbol';

/**
 * Round 47: the **long-value symbol family** of the bracket / carrier / seat
 * mounts. `'midpoint'` is the incumbent ring family; `'open-oval'` is the
 * round's experimental hollow-oval adaptation (see
 * {@link JankoLayoutOptions.longDurationStyle}). The short-value cut grammar
 * and every augmentation dot are shared by both families and are never
 * affected by this axis.
 */
export type JankoLongDurationStyle = 'midpoint' | 'open-oval';

/**
 * Round 47: whether an admitted cluster member or written tie component keeps
 * its own long-duration exception mark, or omits it when an outgoing written
 * tie already states the continuation (see
 * {@link JankoLayoutOptions.tieOriginIndicator}).
 */
export type JankoTieOriginIndicator = 'source' | 'omit-outgoing';

/**
 * Round 48: the tie's own contour — the Round 46 uniform stroke or the faithful
 * trace of LilyPond's filled two-cubic tie (see
 * {@link JankoLayoutOptions.tieProfile} and `ties.tieTracedGeometry`).
 */
export type JankoTieProfile = 'uniform' | 'traced';

/**
 * Situational clasp-dot translation (the Round 31 preview axis): a rigid
 * `[dx, dy]` shift in pt, uniform across every bracket-attached augmentation
 * dot (first and second alike, so a double-dot pair stays rigid). `[0, 0]`
 * is the judged golden seat.
 */
export type JankoClaspDotNudge = readonly [number, number];

/**
 * Beat-grid pulse filter (the Round 32/33 preview axis). Filters hide only
 * ink: temporal units, onset placement and space solving never consult this
 * filter (beat cell barriers stay identical), and measure barlines always
 * paint — so the grid rounds compare grid ink, never geometry.
 *
 * - `'all'`: every existing interior pulse (the incumbent).
 * - `'midpoint-only'`: only the existing pulse at exactly half
 *   `ticksPerMeasure` — a filter, never a generator.
 * - `'none'`: no interior pulse at all (Round 33: the sole open grid
 *   alternative to the full grid).
 */
export type JankoGridPulseFilter = 'all' | 'midpoint-only' | 'none';

/**
 * Fixed Middle-C-centered core octave line grammar (Round 27).
 *
 * - `'adaptive'`: historical window-following adaptive behavior.
 * - `'fixed-3'`: 3-core C-lines at lin 36 (C3), 48 (C4), 60 (C5) (default).
 * - `'fixed-4'`: 4-core octave middles at lin 29.5 (o2), 41.5 (o3), 53.5 (o4), 65.5 (o5).
 */
export type JankoCore = 'adaptive' | 'fixed-3' | 'fixed-4';

/**
 * Fold-coincident octave-pair presentation (Round 34 m.33 axis).
 *
 * - `'literal-fold'`: the low note folds onto the high note's row (own ↓10).
 * - `'shared-ottava'`: both notes shift up one octave under one shared ↓10.
 * - `'split-octave'`: the low note draws at literal pitch (true octave stack).
 */
export type JankoFoldPairPresentation = 'literal-fold' | 'shared-ottava' | 'split-octave';

/**
 * Semantic hand-cluster compression style (Round 35).
 * - `'literal'`: default golden behavior — all notes drawn literally with full
 *   numeral-bearing noteheads across all registers.
 * - `'spatial-echo'`: explicit numeral-bearing origin shape; lightweight group
 *   marker at copied registers carrying occurrence rhythm via standard duration cues,
 *   linked by local structural connector/enclosure.
 * - `'compact-coupling'`: explicit origin shape with adjacent bounded additive-occurrence
 *   structure (+10/+20 notation), binding distinct durations to occurrences.
 */
export type JankoClusterCompression = 'literal' | 'spatial-echo' | 'compact-coupling';

/**
 * Round 36: Whole-form handprint cluster presentation candidate.
 *
 * - `'literal'`: golden baseline (all constituent noteheads drawn with duodecimal digits).
 * - `'mirrored-handprint'`: rotated keyboard footprint with two symmetric variants for alternating Jánko row families.
 * - `'indexed-symmetric'`: intrinsically indexed symmetric cluster with discrete 2-semitone reference divisions, duodecimal 10-span boundaries, paired outward articulations, and explicit duration ownership.
 */
export type JankoClusterPresentation = 'literal' | 'mirrored-handprint' | 'indexed-symmetric';


/**
 * Vertical page placement.
 *
 * - `'slot'`: staffs center in fixed slots; overflow-only correction.
 * - `'content-aware'`: facing ink clearances enforced, residual page space
 *   distributed evenly within the page's slot block.
 */
export type JankoVerticalPlacement = 'slot' | 'content-aware';

/** Fully resolved layout options (every optional option filled in). */
export type ResolvedJankoLayoutOptions = Required<Omit<JankoLayoutOptions, 'durationSeatPreferences'>> & Pick<JankoLayoutOptions, 'durationSeatPreferences'>;

/** Default macro-layout: 4 systems of 4 measures on A4 portrait (Round 15). */
export const DEFAULT_JANKO_OPTIONS: ResolvedJankoLayoutOptions = {
  measuresPerSystem: 4,
  rhythmStyle: 'beamed',
  interStaffGap: 30.0,
  middleCSpine: 'none',
  channelLayout: 'single-equator',
  chordGrouping: 'per-hand-clasp',
  subdivisionStyle: 'classical-urtext',
  claspDurationStyle: 'kinetic-cross-slashes',
  restStyle: 'classical-urtext',
  clusterSpacing: 'tight',
  gridWritingPolicy: 'overlaid-beat-grid',
  systemStartStyle: 'architectural-bracket',
  finalBarlineStyle: 'unified',
  systemsPerPage: 4,
  ticksPerMeasure: 144,
  anacrusisTicks: 0,
  ticksPerBeat: 48,
  measureInset: 6.0,
  timeSignatureWidth: 0,
  pageWidth: 595.28,
  pageHeight: 841.89,
  pageMargin: 24.0,
  pageMarginLeft: 20,
  pageMarginRight: 20,
  pageMarginTop: 30,
  pageMarginBottom: 14,
  headerHeight: 48.0,
  footerHeight: 14.0,
  showMeasureNumbers: true,
  showHonorHalo: false,
  showOctaveLabels: false,
  showPitchLabels: false,
  showHandLabels: false,
  showTimeSignature: false,
  showBeatGrid: true,
  showRowGuidelines: false,
  contourThread: 'none',
  contourTicks: false,
  contourStrip: false,
  pitchMapping: 'twin-rows',
  octaveLineScheme: 'grand-divider',
  core: 'fixed-3',
  extensionJunction: 'default',
  durationGrammar: 'golden',
  claspDotNudge: [0, 0],
  gridPulseFilter: 'all',
  correctPageTopAnacrusisMeasureWidth: false,
  foldPairPresentation: 'literal-fold',
  clusterCompression: 'literal',
  clusterPresentation: 'literal',
  verticalPlacement: 'slot',
  pitchPlacement: 'standard',
  durationEndpoint: 'none',
  chordSymbolScale: 1,
  bracketDurationGrammar: 'golden',
  exceptionCarrier: 'none',
  // Round 49 §2 — the incumbent mount by default: the above-numeral seat is
  // opt-in, so the canonical engraving is untouched.
  standaloneLongMount: 'right',
  longDurationStyle: 'midpoint',
  tieOriginIndicator: 'source',
  tieProfile: 'uniform',
  opticalSpacing: false,
  lowPitchFolding: 'core',
  writtenTies: 'none',
  title: 'Goldberg-Variationen',
  subtitle: 'Variatio 1. a 1 Clav.',
  composer: 'Johann Sebastian Bach',
};

/**
 * Private identity registry of values these two resolvers have already fully
 * resolved.
 *
 * Resolving is called from every element engraver, so one studio render
 * re-resolves the same options/tokens several million times and nearly every
 * input is the output of an earlier resolve; spreading the defaults over such
 * an input again is pure waste. This registry recognises exactly the objects
 * produced by these functions. Every other input — caller-owned partials,
 * override literals, `null`/`undefined`, primitives — takes the full
 * fresh-spread path unchanged, so filled-in defaults, explicit `undefined`
 * overrides and override values keep their exact previous semantics, and no
 * arbitrary mutable input is ever cached.
 *
 * Ownership assumption (audited: no consumer writes to, deletes from, or
 * `Object.assign`s into a resolved value — resolved values are read-only by
 * contract): an already-resolved input may be returned as-is, because it is
 * value-identical to the fresh spread it replaces. Values are deliberately
 * left unfrozen (freezing would be a breaking change for callers), and the
 * canonical defaults are never handed out as an alias: `resolve(DEFAULT_*)`
 * still returns a private copy, so a caller mutating a resolved value cannot
 * poison the canonical defaults.
 */
const RESOLVED_TOKEN_OBJECTS = new WeakSet<object>();
const RESOLVED_OPTION_OBJECTS = new WeakSet<object>();

/**
 * True when `tokens` is already a value that {@link resolveJankoTokens} itself
 * produced (see the private identity registry below). Such an object is
 * read-only by contract, so a memo may key on its identity; caller-owned
 * partials always answer `false` and are never cached.
 */
export function isResolvedJankoTokens(tokens: unknown): tokens is ResolvedJankoTokens {
  return !!tokens && typeof tokens === 'object' && RESOLVED_TOKEN_OBJECTS.has(tokens);
}

/** Fill in every optional token with its canonical default. */
export function resolveJankoTokens(tokens?: Partial<JankoTokens> | null): ResolvedJankoTokens {
  if (tokens && typeof tokens === 'object' && RESOLVED_TOKEN_OBJECTS.has(tokens)) {
    return tokens as ResolvedJankoTokens;
  }
  const resolved = { ...DEFAULT_JANKO_TOKENS, ...(tokens ?? {}) };
  RESOLVED_TOKEN_OBJECTS.add(resolved);
  return resolved;
}

/**
 * Fill in every optional layout option with its canonical default.
 * `measuresPerSystem`, `rhythmStyle`, `interStaffGap`, `middleCSpine` and
 * `channelLayout` may be omitted as well, in which case the canonical values
 * are used.
 */
export function resolveJankoOptions(
  options?: Partial<JankoLayoutOptions> | null
): ResolvedJankoLayoutOptions {
  if (options && typeof options === 'object' && RESOLVED_OPTION_OBJECTS.has(options)) {
    return options as ResolvedJankoLayoutOptions;
  }
  const resolved = { ...DEFAULT_JANKO_OPTIONS, ...(options ?? {}) };
  RESOLVED_OPTION_OBJECTS.add(resolved);
  return resolved;
}

/** Human-readable names for the pluggable rhythm renderers. */
export const JANKO_RHYTHM_STYLE_LABELS: Record<JankoRhythmStyle, string> = {
  'angled-cuts': 'Angled Cuts',
  'horizontal-ticks': 'Unified Continuous Lattice',
  beamed: 'Traditional Beams',
};

/**
 * Absolute page geometry for one horizontal system, in page pt coordinates
 * (y grows downward, matching SVG).
 */
export interface JankoSystemGeometry {
  /** Zero-based system index on the page. */
  index: number;
  /** Measures engraved in this system. */
  measuresPerSystem: number;
  /** Top of the reserved system slot. */
  slotTopY: number;
  /** Top of the engraved system (o5 equator anchor). */
  systemTopY: number;
  /** Absolute y of the Middle C spine. */
  middleCY: number;
  /** Absolute y of the top rule of the accolade. */
  staffTopY: number;
  /** Absolute y of the bottom rule of the accolade. */
  staffBotY: number;
  /** Absolute x of the first staff column. */
  staffLeft: number;
  /** Absolute x of the last staff column. */
  staffRight: number;
  /** Width of one measure. */
  measureWidth: number;
  /** Absolute y of the global octave equator for `octave` (hand-independent). */
  equatorY(hand: Hand, octave: number): number;
  /**
   * Inclusive linear-pitch window (semitones) of the continuous mappings —
   * the score's own range, shared by every system. Absent under `'twin-rows'`.
   */
  pitchWindow?: { min: number; max: number };
  /** Fixed core octave lines (linear pitch) for this system. */
  coreLines?: readonly number[];
  /** Per-system octave extension lines (linear pitch). */
  extensionLines?: readonly number[];
  /** Full drawn staff line set (core + extensions, sorted linear pitch). */
  staffLines?: readonly number[];
  /** Need-based staff line segments for this system. */
  staffSegments?: readonly StaffLineSegment[];
}

/** One continuous segment of a need-based staff line over consecutive earning bars. */
export interface StaffLineSegment {
  /** Linear pitch of this line. */
  lin: number;
  /** Center-out row number: 1 center (0/4), 2 above (0/5), 3 below (0/3), 4 outer-above (0/6), 5 outer-below (0/2). */
  rowId?: number;
  /** Inclusive 0-based index of the first measure in this consecutive run. */
  mStart: number;
  /** Inclusive 0-based index of the last measure in this consecutive run. */
  mEnd: number;
  /** Absolute page x where the rule starts. */
  x1: number;
  /** Absolute page x where the rule ends. */
  x2: number;
}

/** Absolute page geometry for a Jánko Two-Row page. */
export interface JankoPageGeometry {
  options: ResolvedJankoLayoutOptions;
  tokens: ResolvedJankoTokens;
  pageWidth: number;
  pageHeight: number;
  margin: number;
  marginLeft: number;
  marginRight: number;
  marginTop: number;
  marginBottom: number;
  headerHeight: number;
  footerHeight: number;
  bodyHeight: number;
  slotHeight: number;
  systemsPerPage: number;
  measuresPerSystem: number;
  staffLeft: number;
  staffRight: number;
  staffWidth: number;
  measureWidth: number;
  systems: JankoSystemGeometry[];
  /**
   * Inclusive linear-pitch window (semitones) of the continuous mappings —
   * the score's own range, shared by every system. Absent under `'twin-rows'`.
   */
  pitchWindow?: { min: number; max: number };
}

/** Inclusive octave span of one staff region: [minOctave, maxOctave]. */
export type JankoStaffOctaveRange = readonly [number, number];

/** Backwards-compatible alias of {@link JankoStaffOctaveRange}. */
export type JankoHomeOctaveRange = JankoStaffOctaveRange;

/**
 * The grand staff spans octaves 2–5: four continuous equators (o5 −58pt,
 * o4 −28pt, o3 +28pt, o2 +58pt) that both hands share. The lattice is
 * **absolute**: a pitch's equator depends only on its octave, never on the
 * hand that plays it. Pitches inside this span therefore never produce ledger
 * lines; only `octave < 2` or `octave > 5` emits dynamic ledgers.
 */
export const JANKO_STAFF_OCTAVES: JankoStaffOctaveRange = [2, 5];

/**
 * In-staff octave range of each hand. Both hands read the same unified grand
 * staff, so both resolve to {@link JANKO_STAFF_OCTAVES}.
 */
export const JANKO_HOME_OCTAVES: Record<Hand, JankoStaffOctaveRange> = {
  RH: JANKO_STAFF_OCTAVES,
  LH: JANKO_STAFF_OCTAVES,
};

/**
 * Round 45: deepest written linear pitch the **literal low-pitch vocabulary**
 * states (`lowPitchFolding: 'literal'`).
 *
 * The literal register is written with the established dynamic ledger equators
 * of the note's own octave(s) ({@link getLedgerEquators}); the vocabulary runs
 * two octaves below the grand staff — the same two-octave reach the historical
 * fold family used — so a source pitch below this floor still has to fold.
 * Shared by the renderer's register statement and the linter's
 * `extension-beyond-core` allowance so the two can never disagree.
 */
export const JANKO_LITERAL_LOW_FLOOR_LIN = (JANKO_STAFF_OCTAVES[0] - 2) * 12;

/**
 * The four duodecimal octave sign kinds: arrow + dozenal span.
 * `up10` (↑10) sounds an octave above the written pitch; `down10` (↓10) an
 * octave below; `up20`/`down20` two octaves. Zero-based dozenal spans:
 * b = 11 semitones, 10 = 12, 14 = 16, 20 = 24.
 */
export type JankoOttavaKind = 'up10' | 'down10' | 'up20' | 'down20';

/** One rendered ottava bracket spanner (Round 27, dozenal labels). */
export interface JankoOttavaBracket {
  /** Bracket sign kind. */
  kind: JankoOttavaKind;
  /** Pitch shift applied to notes (semitones: -12 for up10, +12 for down10, -24 for up20, +24 for down20). */
  shift: number;
  /** Horizontal span of the entire bracket in page pt (including numeral and hook). */
  x0: number;
  x1: number;
  /** Vertical page y of the straight horizontal dashed line. */
  lineY: number;
  /** Horizontal start of the dashed line (after the numeral and gap). */
  dashX0: number;
  /** Horizontal end of the dashed line (hook location). */
  dashX1: number;
  /** Hook direction toward the staff (-1 = upward for down10/down20, 1 = downward for up10/up20). */
  hookDirection: 1 | -1;
  /** Hook length in pt. */
  hookLength: number;
  /** Note IDs covered by this bracket. */
  noteIds: string[];
}

// ---------------------------------------------------------------------------
// Abstract twelve-site geometry re-exports for declarative candidate registry
// ---------------------------------------------------------------------------

export type {
  AbstractGeometryId,
  AbstractGeometrySpec,
  Point2D,
  RectBounds,
  ViewportBox,
} from './elements/abstract-geometry';

export {
  ABSTRACT_NODE_RADIUS,
  ABSTRACT_MIN_SEPARATION,
  ABSTRACT_KEY_SCALE,
  ABSTRACT_SITE_LABELS,
  ABSTRACT_SUBSET_1,
  ABSTRACT_SUBSET_2,
  ABSTRACT_BASE_SET,
  ABSTRACT_CELL_WIDTH,
  ABSTRACT_CELL_HEIGHT,
  ABSTRACT_BATTERY_VIEWPORT_WIDTH,
  ABSTRACT_NEAR_NEIGHBOUR_SAMPLES,
  ABSTRACT_DENSITY_SAMPLES,
  ABSTRACT_LADDER_OCTAVE_PROBE_SAMPLES,
  ABSTRACT_SUBSET_VIEWPORT,
  ABSTRACT_KEY_VIEWPORT,
  ABSTRACT_GEOMETRY_SPECS,
  formatDuodecimalDigit,
  formatPitchClassSet,
  computeTranspositionSet,
  getDialSiteCoordinates,
  getRosetteSiteCoordinates,
  getLadderSiteCoordinates,
  getAsymmetricSiteCoordinates,
  getAbstractSiteCoordinates,
  computeInkBounds,
  computeMinimumSeparation,
  renderAbstractKeySvg,
  renderAbstractSubsetSvg,
  renderAbstractTranspositionBatterySvg,
  renderAbstractNearNeighboursBatterySvg,
  renderAbstractDensityBatterySvg,
  renderAbstractLadderOctaveProbeSvg,
  lintAbstractGeometry,
} from './elements/abstract-geometry';
