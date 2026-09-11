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
  | 'chromatic-grid';

export type NoteheadMorphology =
  | 'classic-oval'
  | 'row-parity-shape'
  | 'phonetic'
  | 'numerical'
  | 'minimal-dot'
  // Testing & format aliases
  | 'row-parity-shapes'
  | 'phonetic-tokens'
  | 'numerical-digits'
  | 'minimal-dots';

// Legacy aliases for backward compatibility
export type NotationStyle = 'wholetone-staff' | 'chromatic-grid' | StaffStyle;
export type NoteheadStyle = 'numerical' | NoteheadMorphology;
export type ColorMode = 'wholetone-duality' | 'pitch-class-wheel' | 'voice-hand' | 'monochrome';

export interface RenderOptions {
  orientation: TimelineOrientation;
  staffStyle: StaffStyle;
  noteheadMorphology: NoteheadMorphology;
  notationStyle?: NotationStyle;
  noteheadStyle?: NoteheadStyle;
  colorMode: ColorMode;
  zoom: number; // 0.5 to 3.0
  pixelsPerTick: number; // calculated from zoom
  pixelsPerSemitone: number;
  showHandCrossings: boolean;
  showBarlines: boolean;
  showGridLines: boolean;
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
}

export const DESIGN_PRESETS: readonly DesignPreset[] = [
  {
    id: 'subitizable-3plus3-parity',
    name: 'Subitizable 3+3 + Parity Shapes',
    description: '3+3 partitioned staff with dual-coded discs on lines and diamonds in spaces',
    staffStyle: 'tritone-split',
    noteheadMorphology: 'row-parity-shape',
    colorMode: 'wholetone-duality',
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
    name: 'Numerical Digits (0..11)',
    description: 'Uniform whole-tone staff with pitch-class integer noteheads',
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
  if (style === 'tritone-split' || style === 'tritone-split-3plus3') {
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
): 'classic-oval' | 'row-parity-shape' | 'phonetic' | 'numerical' | 'minimal-dot' {
  if (!morph) return 'numerical';
  if (morph === 'classic-oval') return 'classic-oval';
  if (morph === 'row-parity-shape' || morph === 'row-parity-shapes') return 'row-parity-shape';
  if (morph === 'phonetic' || morph === 'phonetic-tokens') return 'phonetic';
  if (morph === 'numerical' || morph === 'numerical-digits') return 'numerical';
  if (morph === 'minimal-dot' || morph === 'minimal-dots') return 'minimal-dot';
  return 'numerical';
}

export interface StaffLineGeometry {
  isLine: boolean;
  isBold?: boolean;
  isDashed?: boolean;
  dashArray?: number[];
  isTritone?: boolean;
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
      color: isOctave ? 'rgba(96, 165, 250, 0.7)' : 'rgba(255, 255, 255, 0.1)',
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
        color: 'rgba(96, 165, 250, 0.85)',
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
    // 6 lines partitioned into two 3-line triplets:
    // PC 0: bold, PC 6: dashed/tritone, PC 2,4,8,10: hairlines.
    // Odd PCs: spaces.
    if (pc === 0) {
      return {
        isLine: true,
        isBold: true,
        isDashed: false,
        isTritone: false,
        isOctaveBoundary: true,
        lineWidth: 2.2,
        color: 'rgba(96, 165, 250, 0.9)',
      };
    }
    if (pc === 6) {
      return {
        isLine: true,
        isBold: false,
        isDashed: true,
        dashArray: [5, 4],
        isTritone: true,
        isOctaveBoundary: false,
        lineWidth: 1.2,
        color: 'rgba(244, 114, 182, 0.8)',
      };
    }
    if (pc === 2 || pc === 4 || pc === 8 || pc === 10) {
      return {
        isLine: true,
        isBold: false,
        isDashed: false,
        isTritone: false,
        isOctaveBoundary: false,
        lineWidth: 0.6,
        color: 'rgba(255, 255, 255, 0.16)',
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
    color: isOctave ? 'rgba(96, 165, 250, 0.7)' : 'rgba(255, 255, 255, 0.18)',
  };
}

export function getParityShape(pitchClass: number): 'disc' | 'diamond' {
  const pc = ((pitchClass % 12) + 12) % 12;
  return pc % 2 === 0 ? 'disc' : 'diamond';
}
