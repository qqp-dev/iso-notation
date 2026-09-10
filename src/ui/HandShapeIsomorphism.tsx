import React, { useState } from 'react';
import { CHORD_DEFINITIONS, computeChordShapeVerification } from '../render/janko-model';
import { pitchClassLabel } from '../model/pitch';
import { synth } from '../audio/synth';
import { PitchCoordinate } from '../model/types';

export const HandShapeIsomorphism: React.FC = () => {
  const [selectedChord, setSelectedChord] = useState<string>('Major Triad');
  const [rootPc, setRootPc] = useState<number>(0); // 0 = C

  const verification = computeChordShapeVerification(selectedChord, rootPc, 4);

  const handlePlayChord = () => {
    verification.points.forEach((pt, i) => {
      setTimeout(() => {
        synth.playPitch(pt.key.pitch, 0.8, 85);
      }, i * 20); // slightly rolled chord for acoustic clarity
    });
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-slate-200 shadow-xl max-w-xl">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
        <div>
          <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
            <span>📐</span> Physical Hand-Shape Isomorphism Engine
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Verification of identical finger posture across all 12 transpositions
          </p>
        </div>
        <button
          onClick={handlePlayChord}
          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold rounded-lg shadow transition"
        >
          ▶ Play Chord
        </button>
      </div>

      {/* Chord & Root Selectors */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="text-xs text-slate-400 block mb-1">Chord Structure</label>
          <select
            value={selectedChord}
            onChange={(e) => setSelectedChord(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
          >
            {Object.keys(CHORD_DEFINITIONS).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-slate-400 block mb-1">Root Pitch Class (0..11)</label>
          <div className="flex flex-wrap gap-1">
            {Array.from({ length: 12 }, (_, i) => (
              <button
                key={i}
                onClick={() => setRootPc(i)}
                className={`px-2 py-0.5 text-xs rounded transition ${
                  rootPc === i
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
              >
                {pitchClassLabel(i, 'sharp')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Visual Vector Signature Diagram */}
      <div className="bg-slate-950 rounded-lg p-3 border border-slate-800 mb-3">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="font-semibold text-slate-300">
            {pitchClassLabel(rootPc, 'sharp')} {selectedChord}
          </span>
          <span className="text-slate-500 font-mono text-[11px]">
            Intervals: [{verification.intervals.join(', ')}] semitones
          </span>
        </div>

        {/* Mini 4-Row SVG Key Diagram */}
        <div className="overflow-x-auto py-2">
          <svg width={360} height={130} className="mx-auto block">
            {/* Draw 4 row guidelines */}
            {[1, 2, 3, 4].map((r) => (
              <line
                key={r}
                x1={10}
                y1={(4 - r) * 30 + 15}
                x2={350}
                y2={(4 - r) * 30 + 15}
                stroke="rgba(71, 85, 105, 0.25)"
                strokeDasharray="2 2"
              />
            ))}

            {/* Hand Shape Polygon connecting the keys */}
            <polygon
              points={verification.points
                .map((p) => `${p.x * 24 - (rootPc > 6 ? 160 : 60)},${(4 - p.y) * 30 + 15}`)
                .join(' ')}
              fill="rgba(250, 204, 21, 0.2)"
              stroke="#FACC15"
              strokeWidth={2}
            />

            {/* Individual Keys */}
            {verification.points.map((p, idx) => {
              const svgX = p.x * 24 - (rootPc > 6 ? 160 : 60);
              const svgY = (4 - p.y) * 30 + 15;
              const isRoot = idx === 0;

              return (
                <g key={idx}>
                  <circle
                    cx={svgX}
                    cy={svgY}
                    r={12}
                    fill={isRoot ? '#F59E0B' : '#38BDF8'}
                    stroke="#0F172A"
                    strokeWidth={2}
                  />
                  <text
                    x={svgX}
                    y={svgY}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#0F172A"
                    fontSize={10}
                    fontWeight="bold"
                  >
                    {pitchClassLabel(p.key.pitch.pitchClass, 'sharp')}
                  </text>
                  <text
                    x={svgX}
                    y={svgY + 18}
                    textAnchor="middle"
                    fill="#94A3B8"
                    fontSize={8}
                    fontFamily="monospace"
                  >
                    R{p.y}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Vector Signature Proof */}
        <div className="mt-2 text-[11px] bg-slate-900/80 rounded p-2 border border-slate-800/80 flex items-center justify-between">
          <span className="text-slate-400">Normalized Relative Finger Vectors ($\Delta x, \Delta y$):</span>
          <span className="font-mono text-emerald-400">
            {verification.normalizedVectorSignature.map((v) => `(${v[0]}, ${v[1]})`).join(' → ')}
          </span>
        </div>
      </div>

      <p className="text-[11px] text-slate-400 leading-relaxed">
        <strong>Mathematical Invariance:</strong> Notice how transposing the chord by any number of semitones preserves the exact relative finger displacement vectors and hand geometry. The hand simply translates horizontally along the 4-row keyboard!
      </p>
    </div>
  );
};
