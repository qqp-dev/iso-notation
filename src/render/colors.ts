import { PitchCoordinate, Hand } from '../model/types';
import { wholeToneParity } from '../model/pitch';
import { ColorMode } from './types';

// 12-TET Circular Color Spectrum
const PITCH_CLASS_COLORS = [
  '#EF4444', // 0
  '#F97316', // 1
  '#F59E0B', // 2
  '#EAB308', // 3
  '#84CC16', // 4
  '#10B981', // 5
  '#06B6D4', // 6
  '#3B82F6', // 7
  '#6366F1', // 8
  '#8B5CF6', // 9
  '#A855F7', // 10
  '#EC4899', // 11
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
      // Row 0 (Even): Cyan-Blue / Row 1 (Odd): Coral Orange
      return wholeToneParity(pitch) === 0 ? '#38BDF8' : '#FB923C';

    case 'voice-hand':
      // RH: Cyan-Blue / LH: Amber-Orange
      return hand === 'RH' ? '#60A5FA' : '#FBBF24';

    case 'monochrome':
    default:
      return '#FFFFFF';
  }
}

export function getJankoKeyColor(
  pitch: PitchCoordinate,
  _row: number,
  mode: ColorMode,
  isActive: boolean = false
): { fill: string; border: string; text: string } {
  const isEven = wholeToneParity(pitch) === 0;

  if (isActive) {
    return {
      fill: '#FACC15',
      border: '#EAB308',
      text: '#000000',
    };
  }

  switch (mode) {
    case 'pitch-class-wheel': {
      const base = PITCH_CLASS_COLORS[pitch.pitchClass];
      return {
        fill: `${base}22`,
        border: base,
        text: base,
      };
    }

    case 'wholetone-duality': {
      const base = isEven ? '#38BDF8' : '#FB923C';
      return {
        fill: isEven ? '#082f49' : '#451a03',
        border: base,
        text: base,
      };
    }

    case 'voice-hand':
    case 'monochrome':
    default: {
      if (isEven) {
        return {
          fill: '#141414',
          border: '#333333',
          text: '#FFFFFF',
        };
      } else {
        return {
          fill: '#080808',
          border: '#222222',
          text: '#888888',
        };
      }
    }
  }
}
