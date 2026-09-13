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
 *   `chordalOffset` (Approach 2, Row-Snapped Parity Offset). See
 *   {@link JankoTokens.chordalOffset} and
 *   `engine.resolveRowSnappedChordOffsets`.
 * - The **channel layout** ({@link JankoLayoutOptions.channelLayout}) selects
 *   how an octave is framed. Besides the incumbent `'single-equator'`, three
 *   comparative paradigms are engraved: `'on-the-line'` (Set A anchored on the
 *   rule, Set B statically one row above), `'single-line-3row'` (one rule per
 *   octave with Set B contour-resolved to `±rowHeight`) and
 *   `'bounded-channel'` (two boundary rules at `equator ± channelHalfWidth`
 *   with Set B contour-resolved to `±channelFlankOffset`). See
 *   {@link JankoChannelLayout} for the full table.
 * - The four equators o5 (−58pt), o4 (−28pt), o3 (+28pt) and o2 (+58pt) form
 *   the *grand staff*: one **absolute, hand-independent** coordinate lattice
 *   shared by both hands. Octaves step by exactly `octaveStep`
 *   (2 * rowHeight = 30pt) away from the corridor, whose negative breathing
 *   space is `interStaffGap` (56pt by default) between o4 and o3 — the
 *   *spacious corridor* holds the Middle C channel open without any artificial
 *   rule dividing the hands.
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
 * Midpoint clasp **duration** paradigms — the Round 10 question: how an
 * external per-hand bracket carries the cluster's duration at the exact
 * vertical midpoint of its own spine with marks that cut *across* the spine.
 *
 * Round 9 anchored the marks on `yMid = (topY + botY) / 2`, but the marks hung
 * off one side of the spine and were too small to read at 100% zoom. Round 10
 * retires the two rejected paradigms (`'center-chevron-notch'`,
 * `'center-pip-rays'`) and scales the remaining four so every mark is a
 * symmetrical transverse gesture across the spine, with hollow marks knocking
 * the spine cleanly out of their interior (see
 * `elements/rhythm.renderChordClasp`):
 *
 * | style                      | duration ink at the spine midpoint                            |
 * | -------------------------- | ------------------------------------------------------------- |
 * | `'transverse-cross-bars'`  | crisp horizontal cross-bars, W = 7.5pt, stroke 1.2pt          |
 * | `'kinetic-cross-slashes'`  | 12.4° beam-harmonized cross-slashes, W = 7.5pt, stroke 1.2pt  |
 * | `'interrupted-spine-node'` | an emphatic white-interior node: ring R = 3.0pt / beads       |
 * | `'faceted-diamond-bands'`  | sculpted transverse diamond bands, W = 8.0pt × H = 4.5pt      |
 *
 * Every paradigm shares the same plain quarter bracket (a continuous solid
 * spine), the same open half/whole knockout and the same 0.75pt dotted-quarter
 * dot, so the round varies exactly one variable: the ink a value leaves at the
 * midpoint.
 */
export type JankoClaspDurationStyle =
  | 'transverse-cross-bars'
  | 'kinetic-cross-slashes'
  | 'interrupted-spine-node'
  | 'faceted-diamond-bands';

/** Every clasp-duration paradigm, in the canonical exploration order (A–D). */
export const JANKO_CLASP_DURATION_STYLES: readonly JankoClaspDurationStyle[] = [
  'transverse-cross-bars',
  'kinetic-cross-slashes',
  'interrupted-spine-node',
  'faceted-diamond-bands',
];

/** Human-readable names of the four scaled midpoint clasp-duration paradigms. */
export const JANKO_CLASP_DURATION_STYLE_LABELS: Record<JankoClaspDurationStyle, string> = {
  'transverse-cross-bars': 'Transverse 7.5pt Cross-Bars',
  'kinetic-cross-slashes': 'Kinetic 12.4° Cross-Slashes',
  'interrupted-spine-node': 'Interrupted-Spine Node',
  'faceted-diamond-bands': 'Faceted Diamond Bands',
};

/**
 * How a system opens at its left margin — the Round 10 retirement of the
 * copperplate accolade.
 *
 * | style                   | margin ink at the system start                             |
 * | ----------------------- | ---------------------------------------------------------- |
 * | `'open-halo'`           | none: the staff lines emerge openly from the margin, and   |
 * |                         | the Position of Honor halo rings the opening tick-0 heads  |
 * | `'architectural-bracket'`| a straight 0.65pt rule with 3.0pt right-angled spurs       |
 * | `'clef-pillar'`         | the same straight 0.65pt rule, without spurs                |
 * | `'none'`                | no system-start ink at all                                 |
 *
 * The curlicue copperplate accolade no longer belongs to the modern design
 * language, so `'open-halo'` is the golden-master default. The Position of
 * Honor halo itself is a notehead decoration rather than system-start ink, so
 * it rings the opening tick-0 sounds under every style.
 */
export type JankoSystemStartStyle =
  | 'open-halo'
  | 'architectural-bracket'
  | 'clef-pillar'
  | 'none';

/** Every system-start style, in the canonical exploration order. */
export const JANKO_SYSTEM_START_STYLES: readonly JankoSystemStartStyle[] = [
  'open-halo',
  'architectural-bracket',
  'clef-pillar',
  'none',
];

/** Human-readable names of the system-start styles. */
export const JANKO_SYSTEM_START_STYLE_LABELS: Record<JankoSystemStartStyle, string> = {
  'open-halo': 'Open Margin with Position-of-Honor Halo',
  'architectural-bracket': 'Architectural Bracket (0.65pt rule + 3.0pt spurs)',
  'clef-pillar': 'Slender Clef Pillar (0.65pt rule)',
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
 * | `'per-hand-clasp'`   | one hand of one onset    | one bracket per hand (Round 6)         |
 *
 * The clasp is drawn **outside** the cluster (`claspX = minX − r − claspOffset`)
 * and carries the cluster's shortest duration at its tip: an open pip for
 * halves/wholes, a clean spire for quarters and flag hooks for 8ths/16ths.
 *
 * `'per-hand-clasp'` is the Round 6 refinement: the grouping unit is strictly
 * one hand (`RH` or `LH`), never the grand staff, and a bracket is drawn **only**
 * for a horizontally displaced (row-snapped) hand cluster — a clean vertical
 * column and a lone melodic note keep their stems.
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

/** Engraving token set: geometric and styling constants (all in pt). */
export interface JankoTokens {
  /** Vertical distance between the two whole-tone rows. */
  rowHeight: number;
  /** White-knockout circular notehead radius. */
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
  /**
   * Horizontal displacement (pt) between two **same-row chord tones** of one
   * onset (Approach 2 — Row-Snapped Parity Offset).
   *
   * A two-row whole-tone staff maps several chord tones onto one row of one
   * octave (C major `[0, 4, 7]` puts 0 and 4 on Row 0; G7 `[7, 11, 2, 5]` puts
   * 7 and 11 on Row 1 …). Those heads would land on one page point and the
   * later knockout would erase the earlier digit. The engine therefore keeps
   * every note's true row and spreads the colliding heads symmetrically around
   * the beat column by this distance.
   *
   * The canonical 11.0pt exceeds one notehead diameter (2 × 4.8 = 9.6pt) by
   * 1.4pt of air, so the discs never touch and the visual linter's
   * `2r` clearance rule is satisfied with room to spare. Values below
   * `2 * noteheadRadius + 1.2pt` are raised to that floor by the engine, so a
   * larger notehead can never silently re-open the collision.
   */
  chordalOffset?: number;

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
}

/** Fully resolved token set (every optional token filled in). */
export type ResolvedJankoTokens = Required<JankoTokens>;

/**
 * Canonical Jánko Two-Row engraving tokens.
 *
 * h = 15.0pt row grid; the octave equator step is 2h = 30.0pt. The
 * Position-of-Honor halo ring is R = 6.2pt around a 4.8pt white knockout, and
 * the duodecimal digit is set at 5.8pt so its ink box keeps ≈1.9pt of clean
 * white perimeter margin on every side of the mask.
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
  flagWidth: 4.0,
  flagHeight: 6.6,
  flagSpacing: 3.4,
  minStemClearance: 1.5,
  channelHalfWidth: 6.5,
  channelFlankOffset: 13.0,
  chordalOffset: 11.0,
  claspWidth: 2.2,
  claspStrokeWidth: 0.85,
  claspOffset: 2.8,
  claspMinBarlineAir: 4.0,
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
   * Round 6). `'none'` keeps the incumbent per-note stems; the clasp paradigms
   * draw an external left bracket per cluster (see {@link JankoChordGrouping}).
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
   * Midpoint clasp-duration paradigm (Round 10): how an external per-hand
   * bracket carries its cluster's duration at its spine midpoint. Defaults to
   * `'transverse-cross-bars'` (see {@link JankoClaspDurationStyle}).
   */
  claspDurationStyle?: JankoClaspDurationStyle;
  /**
   * System-start margin ink (Round 10): the copperplate accolade is retired in
   * favour of an open margin whose opening sounds are ringed by the Position of
   * Honor halo. Defaults to `'open-halo'` (see {@link JankoSystemStartStyle}).
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
  /** Header reservation in pt. */
  headerHeight?: number;
  /** Footer reservation in pt. */
  footerHeight?: number;
  /** Draw measure numbers above the first measure of every system. */
  showMeasureNumbers?: boolean;
  /** Draw octave labels at the left margin. */
  showOctaveLabels?: boolean;
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
  /** Page title (full-page renders only). */
  title?: string;
  /** Page subtitle (full-page renders only). */
  subtitle?: string;
  /** Page composer attribution (full-page renders only). */
  composer?: string;
}

/** Fully resolved layout options (every optional option filled in). */
export type ResolvedJankoLayoutOptions = Required<JankoLayoutOptions>;

/** Default macro-layout: 3 systems of 4 measures on A4 portrait. */
export const DEFAULT_JANKO_OPTIONS: ResolvedJankoLayoutOptions = {
  measuresPerSystem: 4,
  rhythmStyle: 'beamed',
  interStaffGap: 56.0,
  middleCSpine: 'none',
  channelLayout: 'single-equator',
  chordGrouping: 'none',
  subdivisionStyle: 'kinetic-tab-beam',
  claspDurationStyle: 'transverse-cross-bars',
  systemStartStyle: 'open-halo',
  finalBarlineStyle: 'unified',
  systemsPerPage: 3,
  ticksPerMeasure: 144,
  anacrusisTicks: 0,
  ticksPerBeat: 48,
  measureInset: 6.0,
  timeSignatureWidth: 0,
  pageWidth: 595.28,
  pageHeight: 841.89,
  pageMargin: 24.0,
  headerHeight: 48.0,
  footerHeight: 24.0,
  showMeasureNumbers: true,
  showOctaveLabels: false,
  showHandLabels: false,
  showTimeSignature: false,
  showBeatGrid: true,
  showRowGuidelines: false,
  title: 'J.S. Bach: Goldberg Variations, BWV 988',
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

/** Normalized description of one comparison-sheet variant. */
export interface JankoVariant {
  id: string;
  label: string;
  options: ResolvedJankoLayoutOptions;
}

/** Loose variant input accepted by the comparison sheet renderer. */
export interface JankoVariantDefinition {
  id?: string;
  name?: string;
  label?: string;
  title?: string;
  rhythmStyle?: JankoRhythmStyle;
  options?: Partial<JankoLayoutOptions>;
}

export type JankoVariantSpec =
  | JankoVariantDefinition
  | JankoRhythmStyle
  | Partial<JankoLayoutOptions>;

/** Human-readable names for the pluggable rhythm renderers. */
export const JANKO_RHYTHM_STYLE_LABELS: Record<JankoRhythmStyle, string> = {
  'angled-cuts': 'Angled Cuts',
  'horizontal-ticks': 'Unified Continuous Lattice',
  beamed: 'Traditional Beams',
};

/** Canonical A–C contact-sheet variants (Angled Cuts / Beams / Lattice). */
export const DEFAULT_JANKO_VARIANTS: JankoVariantSpec[] = [
  { id: 'angled-cuts', label: 'Variant A: Angled Cuts', rhythmStyle: 'angled-cuts' },
  { id: 'beamed', label: 'Variant B: Traditional Beams', rhythmStyle: 'beamed' },
  {
    id: 'horizontal-ticks',
    label: 'Variant C: Unified Continuous Lattice',
    rhythmStyle: 'horizontal-ticks',
  },
];

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
}

/** Absolute page geometry for a Jánko Two-Row page. */
export interface JankoPageGeometry {
  options: ResolvedJankoLayoutOptions;
  tokens: ResolvedJankoTokens;
  pageWidth: number;
  pageHeight: number;
  margin: number;
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
