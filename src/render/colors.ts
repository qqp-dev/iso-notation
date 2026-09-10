import { PitchCoordinate, Hand } from '../model/types';
import { wholeToneParity } from '../model/pitch';
import { ColorMode } from './types';

// 12-TET Circular Color Wheel (C=Red, D=Orange, E=Yellow, F#=Cyan, A=Indigo, B=Magenta)
const PITCH_CLASS_COLORS = [
  '#EF4444', // 0: C  (Red)
  '#F97316', // 1: C# (Orange-Red)
  '#F59E0B', // 2: D  (Amber)
  '#EAB308', // 3: D# (Yellow)
  '#84CC16', // 4: E  (Lime)
  '#10B981', // 5: F  (Emerald)
  '#06B6D4', // 6: F# (Cyan)
  '#3B82F6', // 7: G  (Blue)
  '#6366F1', // 8: G# (Indigo)
  '#8B5CF6', // 9: A  (Violet)
  '#A855F7', // 10: A# (Purple)
  '#EC4899', // 11: B  (Pink)
];

export function getNoteColor(
  pitch: PitchCoordinate,
  hand: Hand,
  mode: ColorMode,
  isActive: boolean = false
): string {
  if (isActive) {
    return '#FDE047'; // Bright active gold highlight
  }

  switch (mode) {
    case 'pitch-class-wheel':
      return PITCH_CLASS_COLORS[pitch.pitchClass];

    case 'wholetone-duality':
      // WT-A (Even): Blue / WT-B (Odd): Coral Orange
      return wholeToneParity(pitch) === 0 ? '#38BDF8' : '#FB923C';

    case 'voice-hand':
      // RH: Cyan-Blue / LH: Amber-Orange
      return hand === 'RH' ? '#60A5FA' : '#FBBF24';

    case 'monochrome':
    default:
      return '#E2E8F0';
  }
}

export function getJankoKeyColor(
  pitch: PitchCoordinate,
  row: number,
  mode: ColorMode,
  isActive: boolean = false
): { fill: string; border: string; text: string } {
  const isEven = wholeToneParity(pitch) === 0;

  if (isActive) {
    return {
      fill: '#FACC15',
      border: '#EAB308',
      text: '#1E293B',
    };
  }

  switch (mode) {
    case 'pitch-class-wheel': {
      const base = PITCH_CLASS_COLORS[pitch.pitchClass];
      return {
        fill: `${base}33`,
        border: base,
        text: base,
      };
    }

    case 'wholetone-duality': {
      const base = isEven ? '#38BDF8' : '#FB923C';
      return {
        fill: isEven ? '#0C4A6E' : '#7C2D12',
        border: base,
        text: base,
      };
    }

    case 'voice-hand':
    case 'monochrome':
    default: {
      // Row 1 & 3: White keys style (dark theme) / Row 2 & 4: Subtly tinted
      if (isEven) {
        return {
          fill: '#1E293B',
          border: '#475569',
          text: '#F1F5F9',
        };
      } else {
        return {
          fill: '#0F172A',
          border: '#334155',
          text: '#94A3B8',
        };
      }
    }
  }
}
