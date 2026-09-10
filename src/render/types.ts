import { Hand } from '../model/types';

export type TimelineOrientation = 'horizontal' | 'vertical';
export type NotationStyle = 'wholetone-staff' | 'chromatic-grid';
export type NoteheadStyle = 'numerical';
export type ColorMode = 'wholetone-duality' | 'pitch-class-wheel' | 'voice-hand' | 'monochrome';

export interface RenderOptions {
  orientation: TimelineOrientation;
  notationStyle: NotationStyle;
  noteheadStyle: NoteheadStyle;
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
