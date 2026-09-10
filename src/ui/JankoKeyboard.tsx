import React, { useMemo, useRef } from 'react';
import { PitchCoordinate } from '../model/types';
import { linearIndex } from '../model/pitch';
import { buildJankoLayout } from '../render/janko-model';
import { getJankoKeyColor } from '../render/colors';
import { ColorMode } from '../render/types';
import { synth } from '../audio/synth';

interface JankoKeyboardProps {
  activePitches: PitchCoordinate[];
  colorMode: ColorMode;
  minOctave?: number;
  maxOctave?: number;
  onKeyClick?: (pitch: PitchCoordinate) => void;
}

export const JankoKeyboard: React.FC<JankoKeyboardProps> = ({
  activePitches,
  colorMode,
  minOctave = 1,
  maxOctave = 7,
  onKeyClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const layout = useMemo(() => {
    return buildJankoLayout(minOctave, maxOctave, 38, 44, 4);
  }, [minOctave, maxOctave]);

  const activeLinearSet = useMemo(() => {
    return new Set(activePitches.map(p => linearIndex(p)));
  }, [activePitches]);

  const handleKeyClick = (pitch: PitchCoordinate) => {
    synth.playPitch(pitch, 0.4, 85);
    if (onKeyClick) {
      onKeyClick(pitch);
    }
  };

  const svgWidth = (layout.totalColumns + 1) * layout.keyWidth + 24;
  const svgHeight = 2 * (layout.keyHeight + layout.rowGap) + 8;

  return (
    <div className="w-full bg-black border-t border-neutral-800 p-2 select-none overflow-x-auto" ref={containerRef}>
      <div className="flex items-center justify-between mb-1.5 px-2 text-[11px] font-mono text-neutral-400">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-neutral-200">2-Row Jánko Keyboard</span>
          <span className="text-neutral-700">|</span>
          <span>Octaves {minOctave}–{maxOctave}</span>
          <span className="text-neutral-700">|</span>
          <span className="text-amber-400">{activeLinearSet.size} active</span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-neutral-400">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-sky-500 inline-block"></span>
            <span>Row 0: Even (0, 2, 4, 6, 8, 10)</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
            <span>Row 1: Odd (1, 3, 5, 7, 9, 11)</span>
          </span>
        </div>
      </div>

      <div className="relative min-w-max pb-1">
        <svg width={svgWidth} height={svgHeight} className="overflow-visible">
          {layout.keys.map((k, idx) => {
            const isActive = activeLinearSet.has(k.linearIndex);
            const colors = getJankoKeyColor(k.pitch, k.row, colorMode, isActive);
            const isOctave0 = k.pitch.pitchClass === 0;

            return (
              <g
                key={`${k.row}-${k.column}-${idx}`}
                transform={`translate(${k.x}, ${k.y})`}
                className="cursor-pointer transition-transform active:scale-95"
                onClick={() => handleKeyClick(k.pitch)}
              >
                <rect
                  width={layout.keyWidth - 2}
                  height={layout.keyHeight}
                  rx={4}
                  fill={colors.fill}
                  stroke={isActive ? '#FACC15' : isOctave0 ? '#38BDF8' : colors.border}
                  strokeWidth={isActive ? 2 : isOctave0 ? 1.5 : 1}
                />
                {/* Strictly numerical pitch class (0..11) */}
                <text
                  x={(layout.keyWidth - 2) / 2}
                  y={layout.keyHeight / 2 - 4}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={colors.text}
                  fontSize={11}
                  fontWeight={isActive || isOctave0 ? 'bold' : 'normal'}
                  fontFamily="monospace"
                >
                  {k.pitch.pitchClass}
                </text>
                {/* Octave subscript */}
                <text
                  x={(layout.keyWidth - 2) / 2}
                  y={layout.keyHeight / 2 + 10}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={isActive ? '#000000' : '#777777'}
                  fontSize={9}
                  fontFamily="monospace"
                >
                  {k.pitch.octave}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
