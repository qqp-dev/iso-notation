import React, { useMemo, useRef } from 'react';
import { PitchCoordinate } from '../model/types';
import { linearIndex, pitchClassLabel, pitchLabel } from '../model/pitch';
import { buildJankoLayout } from '../render/janko-model';
import { getJankoKeyColor } from '../render/colors';
import { ColorMode } from '../render/types';
import { synth } from '../audio/synth';

interface JankoKeyboardProps {
  activePitches: PitchCoordinate[];
  colorMode: ColorMode;
  minOctave?: number;
  maxOctave?: number;
  showHandShape?: boolean;
  onKeyClick?: (pitch: PitchCoordinate) => void;
}

export const JankoKeyboard: React.FC<JankoKeyboardProps> = ({
  activePitches,
  colorMode,
  minOctave = 2,
  maxOctave = 6,
  showHandShape = true,
  onKeyClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const layout = useMemo(() => {
    return buildJankoLayout(minOctave, maxOctave, 40, 46, 5);
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

  // Compute hand shape polygon points among active keys
  const polygonPoints = useMemo(() => {
    if (!showHandShape || activeLinearSet.size < 2) return null;

    const matchedKeys = layout.keys.filter(k => activeLinearSet.has(k.linearIndex));
    if (matchedKeys.length < 2) return null;

    // Sort keys by x coordinate
    matchedKeys.sort((a, b) => a.x - b.x);
    return matchedKeys.map(k => `${k.x + 19},${k.y + 22}`).join(' ');
  }, [layout, activeLinearSet, showHandShape]);

  const svgWidth = layout.totalColumns * layout.keyWidth + 50;
  const svgHeight = 4 * (layout.keyHeight + layout.rowGap) + 10;

  return (
    <div className="w-full bg-slate-900 border-t border-slate-800 p-2 select-none overflow-x-auto" ref={containerRef}>
      <div className="flex items-center justify-between mb-1 px-2 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-200">4-Row Jánko Isomorphic Keyboard</span>
          <span className="text-slate-500">|</span>
          <span>Octaves {minOctave}–{maxOctave}</span>
          <span className="text-slate-500">|</span>
          <span className="text-emerald-400 font-mono">{activeLinearSet.size} active sounding</span>
        </div>
        <div className="flex items-center gap-3 text-slate-400">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span>
            Row 1 & 3: WT-A (C, D, E, F#, G#, A#)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
            Row 2 & 4: WT-B (C#, D#, F, G, A, B)
          </span>
        </div>
      </div>

      <div className="relative min-w-max pb-1">
        <svg width={svgWidth} height={svgHeight} className="overflow-visible">
          {/* Hand-shape isomorphism polygon connecting sounding chord notes */}
          {polygonPoints && (
            <g className="transition-all duration-150">
              <polygon
                points={polygonPoints}
                fill="rgba(250, 204, 21, 0.18)"
                stroke="#FACC15"
                strokeWidth={2}
                strokeDasharray="4 2"
              />
            </g>
          )}

          {/* Keys */}
          {layout.keys.map((k, idx) => {
            const isActive = activeLinearSet.has(k.linearIndex);
            const colors = getJankoKeyColor(k.pitch, k.row, colorMode, isActive);
            const isOctaveC = k.pitch.pitchClass === 0;

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
                  rx={6}
                  fill={colors.fill}
                  stroke={isActive ? '#FACC15' : isOctaveC ? '#60A5FA' : colors.border}
                  strokeWidth={isActive ? 2.5 : isOctaveC ? 2 : 1}
                />
                {/* Note Label */}
                <text
                  x={(layout.keyWidth - 2) / 2}
                  y={layout.keyHeight / 2 - 3}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={colors.text}
                  fontSize={11}
                  fontWeight={isActive || isOctaveC ? 'bold' : 'normal'}
                  fontFamily="sans-serif"
                >
                  {pitchClassLabel(k.pitch.pitchClass, 'sharp')}
                </text>
                {/* Octave Subscript */}
                <text
                  x={(layout.keyWidth - 2) / 2}
                  y={layout.keyHeight / 2 + 10}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={isActive ? '#1E293B' : '#64748B'}
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
