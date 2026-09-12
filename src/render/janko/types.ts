/**
 * Jánko Two-Row Engraving Engine — Tokens & Layout Options
 *
 * The engine engraves a grand staff on the *Jánko Equator Principle*:
 *
 * - Every octave is represented by a single horizontal **octave equator** line.
 * - Whole-tone rank 0 (even pitch classes 0, 2, 4, 6, 8, a) sits **below** its
 *   octave equator; whole-tone rank 1 (odd pitch classes 1, 3, 5, 7, 9, b)
 *   sits **above** it. Every row-to-row step is exactly `rowHeight` (15pt).
 * - Every octave step inside one hand's lattice is exactly `octaveStep`
 *   (2 * rowHeight = 30pt); the two hands anchor their lattices on their own
 *   two home equators, separated by `interStaffGap`.
 *
 * Everything geometric or stylistic that a designer may want to tweak lives in
 * {@link JankoTokens} (micro-typography) and {@link JankoLayoutOptions}
 * (macro-layout), so that no coordinate math is hardcoded in a script.
 */

import { Hand } from '../../model/types';

/** Pluggable rhythm renderer styles (see `elements/rhythm.ts`). */
export type JankoRhythmStyle = 'angled-cuts' | 'horizontal-ticks' | 'beamed';

/** Middle C spine (the central channel between the two hands) styles. */
export type JankoMiddleCSpine = 'dashed' | 'double' | 'continuous';

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
}

/** Fully resolved token set (every optional token filled in). */
export type ResolvedJankoTokens = Required<JankoTokens>;

/**
 * Canonical Jánko Two-Row engraving tokens.
 *
 * h = 15.0pt row grid; the octave equator step is 2h = 30.0pt; the
 * Position-of-Honor halo ring is R = 5.4pt on a 4.2pt white knockout.
 */
export const DEFAULT_JANKO_TOKENS: ResolvedJankoTokens = {
  rowHeight: 15.0,
  noteheadRadius: 4.2,
  digitFontSize: 6.5,
  haloRadius: 5.4,
  octaveStep: 30.0,
  accoladeWidth: 7.0,
  accoladeThick: 0.85,
  fontFamily: '"URW Gothic", "Century Gothic", "ITC Avant Garde Gothic", "Avant Garde", sans-serif',
  stemLength: 16.0,
  slashDx: 2.8,
  slashDy: 1.6,
  measureInset: 6.0,
  ticksPerMeasure: 144,
  ticksPerBeat: 48,
  ledgerHalfWidth: 7.0,
  beamThickness: 1.8,
  maxBeamSlope: 0.22,
  accoladeGap: 7.0,
  augmentationDotRadius: 1.3,
};

/** Macro-layout options for a Jánko Two-Row page or crop. */
export interface JankoLayoutOptions {
  /** Measures engraved per horizontal system. */
  measuresPerSystem: number;
  /** Pluggable rhythm renderer style. */
  rhythmStyle: JankoRhythmStyle;
  /** Vertical gap between the RH inner equator (o4) and the LH inner equator (o3). */
  interStaffGap: number;
  /** Middle C spine rendering style. */
  middleCSpine: JankoMiddleCSpine;

  // --- Optional page/layout refinements (resolved from defaults) ---
  /** Horizontal systems stacked on one page. */
  systemsPerPage?: number;
  /** Ticks in one measure. */
  ticksPerMeasure?: number;
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
  interStaffGap: 45.0,
  middleCSpine: 'dashed',
  systemsPerPage: 3,
  ticksPerMeasure: 144,
  ticksPerBeat: 48,
  measureInset: 6.0,
  timeSignatureWidth: 0,
  pageWidth: 595.28,
  pageHeight: 841.89,
  pageMargin: 36.0,
  headerHeight: 48.0,
  footerHeight: 24.0,
  showMeasureNumbers: true,
  showOctaveLabels: false,
  showHandLabels: false,
  showTimeSignature: false,
  showBeatGrid: true,
  title: 'J.S. Bach: Goldberg Variations, BWV 988',
  subtitle: 'Variatio 1. a 1 Clav. — Jánko Two-Row Equator System',
  composer: 'Johann Sebastian Bach',
};

/** Fill in every optional token with its canonical default. */
export function resolveJankoTokens(tokens?: Partial<JankoTokens> | null): ResolvedJankoTokens {
  return { ...DEFAULT_JANKO_TOKENS, ...(tokens ?? {}) };
}

/**
 * Fill in every optional layout option with its canonical default.
 * `measuresPerSystem`, `rhythmStyle`, `interStaffGap` and `middleCSpine`
 * may be omitted as well, in which case the canonical values are used.
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
  /** Absolute y of the hand-local octave equator for `octave`. */
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

/** Inclusive home (in-staff) octave range of one hand: [minOctave, maxOctave]. */
export type JankoHomeOctaveRange = readonly [number, number];

/** Home (in-staff) octave range of each hand. */
export const JANKO_HOME_OCTAVES: Record<Hand, JankoHomeOctaveRange> = {
  RH: [4, 5],
  LH: [2, 3],
};
