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
}

/** Fully resolved token set (every optional token filled in). */
export type ResolvedJankoTokens = Required<JankoTokens>;

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
};

/** Macro-layout options for a Jánko Two-Row page or crop. */
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
 * Situational clasp-dot translation (the Round 31 preview axis): a rigid
 * `[dx, dy]` shift in pt, uniform across every bracket-attached augmentation
 * dot (first and second alike, so a double-dot pair stays rigid). `[0, 0]`
 * is the judged golden seat.
 */
export type JankoClaspDotNudge = readonly [number, number];

/**
 * Fixed Middle-C-centered core octave line grammar (Round 27).
 *
 * - `'adaptive'`: historical window-following adaptive behavior.
 * - `'fixed-3'`: 3-core C-lines at lin 36 (C3), 48 (C4), 60 (C5) (default).
 * - `'fixed-4'`: 4-core octave middles at lin 29.5 (o2), 41.5 (o3), 53.5 (o4), 65.5 (o5).
 */
export type JankoCore = 'adaptive' | 'fixed-3' | 'fixed-4';

/** Fully resolved layout options (every optional option filled in). */
export type ResolvedJankoLayoutOptions = Required<JankoLayoutOptions>;

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
  title: 'Goldberg-Variationen',
  subtitle: 'Variatio 1. a 1 Clav.',
  composer: 'Johann Sebastian Bach',
};

/** Fill in every optional token with its canonical default. */
export function resolveJankoTokens(tokens?: Partial<JankoTokens> | null): ResolvedJankoTokens {
  return { ...DEFAULT_JANKO_TOKENS, ...(tokens ?? {}) };
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
  return { ...DEFAULT_JANKO_OPTIONS, ...(options ?? {}) };
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

/** The four SMuFL octave sign kinds (Round 27). */
export type JankoOttavaKind = '8va' | '8vb' | '15ma' | '15mb';

/** One rendered ottava bracket spanner (Round 27). */
export interface JankoOttavaBracket {
  /** Bracket sign kind. */
  kind: JankoOttavaKind;
  /** Pitch shift applied to notes (semitones: -12 for 8va, +12 for 8vb, -24 for 15ma, +24 for 15mb). */
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
  /** Hook direction toward the staff (-1 = upward for 8vb/15mb, 1 = downward for 8va/15ma). */
  hookDirection: 1 | -1;
  /** Hook length in pt. */
  hookLength: number;
  /** Note IDs covered by this bracket. */
  noteIds: string[];
}
