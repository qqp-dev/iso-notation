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
    <div className="w-full shrink-0 bg-black border-t border-neutral-900 px-2 py-1 select-none overflow-x-auto" ref={containerRef}>
      <div className="relative min-w-max">
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
