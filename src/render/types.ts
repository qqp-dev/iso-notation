import { Hand } from '../model/types';

export type TimelineOrientation = 'horizontal' | 'vertical';

export type StaffStyle =
  | 'wholetone-uniform'
  | 'tritone-split'
  | 'augmented-3line'
  | 'octave-ribbons'
  // Testing & format aliases
  | 'wholetone-uniform-6'
  | 'tritone-split-3plus3'
  | 'augmented-triad-3line'
  | 'chromatic-grid'
  | '5-7-split'
  | 'five-seven-split';

export type NoteheadMorphology =
  | 'classic-oval'
  | 'row-parity-shape'
  | 'phonetic'
  | 'numerical'
  | 'minimal-dot'
  | 'rectangle-square'
  | 'square-ellipse'
  | 'square-triangle'
  // Testing & format aliases
  | 'row-parity-shapes'
  | 'phonetic-tokens'
  | 'numerical-digits'
  | 'minimal-dots'
  | 'rectangles'
  | 'rectangle-squares'
  | 'square-ellipses'
  | 'square-triangles';

// Legacy aliases for backward compatibility
export type NotationStyle = 'wholetone-staff' | 'chromatic-grid' | StaffStyle;
export type NoteheadStyle = 'numerical' | NoteheadMorphology;
export type ColorMode =
  | 'duration-class'
  | 'wholetone-duality'
  | 'pitch-class-wheel'
  | 'voice-hand'
  | 'monochrome'
  | 'ddr-subdivision';

export type ViewMode = 'isomorphic' | 'pianoroll';

export interface RenderOptions {
  viewMode?: ViewMode;
  orientation: TimelineOrientation;
  staffStyle: StaffStyle;
  noteheadMorphology: NoteheadMorphology;
  notationStyle?: NotationStyle;
  noteheadStyle?: NoteheadStyle;
  colorMode: ColorMode;
  zoom: number; // 0.5 to 3.0
  pixelsPerTick: number; // calculated from zoom
  pixelsPerSemitone: number;
  octaveExtensionMode?: 'badge' | 'spillover' | 'auto';
  showHandCrossings?: boolean;
  showBarlines: boolean;
  showGridLines: boolean;
  showBeamGrouping?: boolean;
  showBeatGrid?: boolean;
  showGutterBrackets?: boolean;
  currentTick: number;
  selectedNoteId?: string;
  handHighlight?: Hand | 'all';
}

export interface ViewportTransform {
  scrollX: number;
  scrollY: number;
  width: number;
  height: number;
}

export interface DesignPreset {
  id: string;
  name: string;
  description: string;
  staffStyle: StaffStyle;
  noteheadMorphology: NoteheadMorphology;
  colorMode: ColorMode;
  orientation?: TimelineOrientation;
}

export const DESIGN_PRESETS: readonly DesignPreset[] = [
  {
    id: 'unified-duration-lattice',
    name: 'Unified Duration Lattice + Parity Shapes',
    description: 'Vertical timeline with pure noteheads, faint dotted long-note trails, and logarithmic duration palette',
    staffStyle: 'tritone-split',
    noteheadMorphology: 'row-parity-shape',
    colorMode: 'duration-class',
    orientation: 'vertical',
  },
  {
    id: 'symmetric-159-rectangle-square',
    name: '1-5-9 Symmetric Lines + Full/Empty Squares',
    description: 'Compressed staff with 3 lines per octave (1=bold octave, 5=small dashes, 9=thin straight), Full Squares (Row 0) and Empty Squares (Row 1)',
    staffStyle: 'tritone-split',
    noteheadMorphology: 'rectangle-square',
    colorMode: 'duration-class',
    orientation: 'vertical',
  },
  {
    id: 'vertical-duration-parity',
    name: 'Vertical Duration Classes + Parity Shapes',
    description: 'Vertical timeline with note value duration classes and 3+3 parity shapes',
    staffStyle: 'tritone-split',
    noteheadMorphology: 'row-parity-shape',
    colorMode: 'duration-class',
    orientation: 'vertical',
  },
  {
    id: 'vertical-ddr-parity',
    name: 'Vertical DDR + Parity Shapes',
    description: 'Vertical timeline with DDR metric subdivision colors and 3+3 parity shapes',
    staffStyle: 'tritone-split',
    noteheadMorphology: 'row-parity-shape',
    colorMode: 'ddr-subdivision',
    orientation: 'vertical',
  },
  {
    id: 'subitizable-3plus3-parity',
    name: 'Subitizable 3+3 + Parity Shapes',
    description: '3+3 partitioned staff with dual-coded ovals on lines and crisp bricks in spaces',
    staffStyle: 'tritone-split',
    noteheadMorphology: 'row-parity-shape',
    colorMode: 'monochrome',
    orientation: 'horizontal',
  },
  {
    id: 'clean-minimalist-oval',
    name: 'Clean Minimalist Oval',
    description: '6-6 whole-tone staff with tilted classic oval noteheads and line knockout',
    staffStyle: 'wholetone-uniform',
    noteheadMorphology: 'classic-oval',
    colorMode: 'monochrome',
  },
  {
    id: 'analytical-phonetic',
    name: 'Analytical Phonetic',
    description: 'Whole-tone staff with 12-TET monosyllabic tokens (Ma..Ki)',
    staffStyle: 'wholetone-uniform',
    noteheadMorphology: 'phonetic',
    colorMode: 'pitch-class-wheel',
  },
  {
    id: 'numerical-digits-preset',
    name: 'Numerical Digits (1..12)',
    description: 'Uniform whole-tone staff with 1-based pitch-class integer noteheads',
    staffStyle: 'wholetone-uniform',
    noteheadMorphology: 'numerical',
    colorMode: 'wholetone-duality',
  },
  {
    id: 'octave-ribbons-dots-preset',
    name: 'Octave Ribbons + Minimal Dots',
    description: 'Alternating octave register luminance ribbons with clean circular dots',
    staffStyle: 'octave-ribbons',
    noteheadMorphology: 'minimal-dot',
    colorMode: 'pitch-class-wheel',
  },
  {
    id: 'augmented-triad-preset',
    name: 'Augmented Triad (3-Line)',
    description: 'Major-third lines (0, 4, 8) with wide spaces and row parity shapes',
    staffStyle: 'augmented-3line',
    noteheadMorphology: 'row-parity-shape',
    colorMode: 'wholetone-duality',
  },
] as const;

export function normalizeStaffStyle(
  style?: StaffStyle | string
): 'wholetone-uniform' | 'tritone-split' | 'augmented-3line' | 'octave-ribbons' | 'chromatic-grid' {
  if (!style) return 'wholetone-uniform';
  if (style === 'wholetone-uniform' || style === 'wholetone-uniform-6' || style === 'wholetone-staff') {
    return 'wholetone-uniform';
  }
  if (
    style === 'tritone-split' ||
    style === 'tritone-split-3plus3' ||
    style === '5-7-split' ||
    style === 'five-seven-split'
  ) {
    return 'tritone-split';
  }
  if (style === 'augmented-3line' || style === 'augmented-triad-3line') {
    return 'augmented-3line';
  }
  if (style === 'octave-ribbons') {
    return 'octave-ribbons';
  }
  if (style === 'chromatic-grid') {
    return 'chromatic-grid';
  }
  return 'wholetone-uniform';
}

export function normalizeNoteheadMorphology(
  morph?: NoteheadMorphology | string
): 'classic-oval' | 'row-parity-shape' | 'phonetic' | 'numerical' | 'minimal-dot' | 'rectangle-square' | 'square-ellipse' | 'square-triangle' {
  if (!morph) return 'rectangle-square';
  if (morph === 'classic-oval') return 'classic-oval';
  if (morph === 'row-parity-shape' || morph === 'row-parity-shapes') return 'row-parity-shape';
  if (morph === 'phonetic' || morph === 'phonetic-tokens') return 'phonetic';
  if (morph === 'numerical' || morph === 'numerical-digits') return 'numerical';
  if (morph === 'minimal-dot' || morph === 'minimal-dots') return 'minimal-dot';
  if (
    morph === 'rectangle-square' ||
    morph === 'rectangle-squares' ||
    morph === 'rectangles' ||
    morph === 'square-ellipse' ||
    morph === 'square-ellipses' ||
    morph === 'square-triangle' ||
    morph === 'square-triangles' ||
    morph === 'full-empty-square' ||
    morph === 'solid-hollow-square' ||
    morph === 'square-parity' ||
    morph === 'squares'
  ) {
    return 'rectangle-square';
  }
  return 'rectangle-square';
}

export interface StaffLineGeometry {
  isLine: boolean;
  isBold?: boolean;
  isDashed?: boolean;
  dashArray?: number[];
  isTritone?: boolean;
  isDemarcation?: boolean;
  isOctaveBoundary?: boolean;
  lineWidth: number;
  color: string;
}

export function getStaffLineGeometry(pitchClass: number, style: StaffStyle): StaffLineGeometry {
  const pc = ((pitchClass % 12) + 12) % 12;
  const normStyle = normalizeStaffStyle(style);

  if (normStyle === 'chromatic-grid') {
    const isOctave = pc === 0;
    return {
      isLine: true,
      isBold: isOctave,
      isOctaveBoundary: isOctave,
      lineWidth: isOctave ? 1.5 : 0.6,
      color: isOctave ? 'rgba(255, 255, 255, 0.85)' : 'rgba(255, 255, 255, 0.1)',
    };
  }

  if (normStyle === 'augmented-3line') {
    // 3 major-third lines per octave: 0, 4, 8
    if (pc === 0) {
      return {
        isLine: true,
        isBold: true,
        isDashed: false,
        isTritone: false,
        isOctaveBoundary: true,
        lineWidth: 1.8,
        color: 'rgba(255, 255, 255, 0.9)',
      };
    }
    if (pc === 4 || pc === 8) {
      return {
        isLine: true,
        isBold: false,
        isDashed: false,
        isTritone: false,
        isOctaveBoundary: false,
        lineWidth: 1.0,
        color: 'rgba(255, 255, 255, 0.35)',
      };
    }
    return {
      isLine: false,
      isBold: false,
      isDashed: false,
      isTritone: false,
      isOctaveBoundary: false,
      lineWidth: 0,
      color: 'transparent',
    };
  }

  if (normStyle === 'tritone-split') {
    // 1-5-9 Symmetric 3-Line Staff Topography:
    // 3 landmark lines per octave (symmetrical 4-semitone / major-third spacing):
    // - PC 0 (Note 1): bold octave boundary line ('m', 1.2px)
    // - PC 4 (Note 5): dashed line ('5', 0.6px, small dashes [5, 2.5])
    // - PC 8 (Note 9): thin straight solid line ('9', 0.6px, thinner than octave)
    // Line 3 (PC 2) is dropped for symmetry.
    // Row 0 notes (1, 3, 5, 7, 9, 11) are Full Squares; Row 1 notes (2, 4, 6, 8, 10, 12) are Empty Squares.
    if (pc === 0) {
      return {
        isLine: true,
        isBold: true,
        isDashed: false,
        isTritone: false,
        isOctaveBoundary: true,
        lineWidth: 1.2,
        color: 'rgba(255, 255, 255, 0.9)',
      };
    }
    if (pc === 4) {
      return {
        isLine: true,
        isBold: false,
        isDashed: true,
        dashArray: [5, 2.5],
        isTritone: false,
        isDemarcation: true,
        isOctaveBoundary: false,
        lineWidth: 0.6,
        color: 'rgba(255, 255, 255, 0.55)',
      };
    }
    if (pc === 8) {
      return {
        isLine: true,
        isBold: false,
        isDashed: false,
        isTritone: false,
        isDemarcation: true,
        isOctaveBoundary: false,
        lineWidth: 0.6,
        color: 'rgba(255, 255, 255, 0.45)',
      };
    }
    return {
      isLine: false,
      isBold: false,
      isDashed: false,
      isTritone: false,
      isOctaveBoundary: false,
      lineWidth: 0,
      color: 'transparent',
    };
  }

  // wholetone-uniform & octave-ribbons
  // Lines on even pitch classes (0, 2, 4, 6, 8, 10), spaces on odd
  const isEven = pc % 2 === 0;
  if (!isEven) {
    return {
      isLine: false,
      isBold: false,
      isDashed: false,
      isTritone: false,
      isOctaveBoundary: false,
      lineWidth: 0,
      color: 'transparent',
    };
  }
  const isOctave = pc === 0;
  return {
    isLine: true,
    isBold: isOctave,
    isDashed: false,
    isTritone: false,
    isOctaveBoundary: isOctave,
    lineWidth: isOctave ? 1.5 : 0.8,
    color: isOctave ? 'rgba(255, 255, 255, 0.85)' : 'rgba(255, 255, 255, 0.18)',
  };
}

export function getParityShape(pitchClass: number): 'disc' | 'brick' {
  const pc = ((pitchClass % 12) + 12) % 12;
  return pc % 2 === 0 ? 'disc' : 'brick';
}

export { getSubdivisionColor, getDurationClassColor, getLogarithmicDurationColor, getPrintDurationColor } from './colors';
