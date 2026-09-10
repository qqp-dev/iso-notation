import React from 'react';
import { QuantizedGridScore, QuantizedNote } from '../model/types';
import { getActiveNotesAtTick, tickToMeasureBeat, computeOptimalGridResolution, verifyLosslessGrid } from '../model/grid';
import { linearIndex, toMidi, toFrequency, pitchClassLabel, pitchLabel } from '../model/pitch';

interface GridInspectorProps {
  score: QuantizedGridScore;
  currentTick: number;
}

export const GridInspector: React.FC<GridInspectorProps> = ({ score, currentTick }) => {
  const activeNotes = getActiveNotesAtTick(score, currentTick);
  const { measure, beat, tickInBeat } = tickToMeasureBeat(currentTick, score);
  const gridGcd = computeOptimalGridResolution(score.notes);
  const verification = verifyLosslessGrid(score);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-slate-200 shadow-xl max-w-xl text-xs">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-3">
        <div>
          <h3 className="text-sm font-bold text-sky-400 flex items-center gap-1.5">
            <span>🔬</span> Quantized Grid ("Fence") Inspector
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Lossless 12-TET data model & current temporal slice
          </p>
        </div>
        <span
          className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
            verification.lossless ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-rose-950 text-rose-300'
          }`}
        >
          {verification.lossless ? '✓ Lossless Invariant Verified' : '⚠ Validation Error'}
        </span>
      </div>

      {/* Grid Specs */}
      <div className="grid grid-cols-4 gap-2 mb-3 bg-slate-950 p-2.5 rounded-lg border border-slate-800/70 font-mono text-[11px]">
        <div>
          <span className="text-slate-500 block text-[10px]">Ticks/Beat:</span>
          <span className="text-slate-200 font-bold">{score.ticksPerBeat}</span>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px]">Minimal GCD Δt:</span>
          <span className="text-sky-400 font-bold">{gridGcd} ticks</span>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px]">Total Ticks:</span>
          <span className="text-slate-200">{score.totalTicks}</span>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px]">Total Notes:</span>
          <span className="text-emerald-400 font-bold">{score.notes.length}</span>
        </div>
      </div>

      {/* Current Playhead State */}
      <div className="bg-slate-800/60 p-2 rounded-lg border border-slate-700/60 mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <span className="text-slate-400 text-[10px] block">Current Tick:</span>
            <span className="font-mono font-bold text-amber-400">{currentTick}</span>
          </div>
          <div className="border-l border-slate-700 pl-3">
            <span className="text-slate-400 text-[10px] block">Position:</span>
            <span className="font-semibold text-slate-200">
              Measure {measure}, Beat {beat} +{tickInBeat}t
            </span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-slate-400 text-[10px] block">Sounding Polyphony:</span>
          <span className="font-bold text-slate-100">{activeNotes.length} voices</span>
        </div>
      </div>

      {/* Active Sounding Notes Table */}
      <div>
        <h4 className="font-semibold text-slate-300 mb-1 text-[11px]">Active Notes at Tick {currentTick}</h4>
        {activeNotes.length === 0 ? (
          <div className="p-3 text-center bg-slate-950 rounded border border-slate-800 text-slate-500">
            No notes sounding at this instant (musical rest)
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-[11px] border border-slate-800 bg-slate-950 rounded overflow-hidden">
              <thead className="bg-slate-900 text-slate-400 text-[10px]">
                <tr>
                  <th className="p-1.5">Pitch</th>
                  <th className="p-1.5">Coords (p, o)</th>
                  <th className="p-1.5">Linear (L)</th>
                  <th className="p-1.5">MIDI</th>
                  <th className="p-1.5">Frequency</th>
                  <th className="p-1.5">Hand</th>
                  <th className="p-1.5">Velocity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {activeNotes.map((n) => {
                  const lIdx = linearIndex(n.pitch);
                  const midi = toMidi(n.pitch);
                  const freq = toFrequency(n.pitch);
                  return (
                    <tr key={n.id} className="hover:bg-slate-900/60">
                      <td className="p-1.5 font-bold text-amber-300">
                        {pitchLabel(n.pitch, 'sharp')}
                      </td>
                      <td className="p-1.5 text-slate-400">
                        ({n.pitch.pitchClass}, {n.pitch.octave})
                      </td>
                      <td className="p-1.5 text-sky-300">{lIdx}</td>
                      <td className="p-1.5 text-slate-300">{midi}</td>
                      <td className="p-1.5 text-emerald-400">{freq.toFixed(1)} Hz</td>
                      <td className="p-1.5">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            n.hand === 'RH' ? 'bg-blue-900 text-blue-300' : 'bg-orange-900 text-orange-300'
                          }`}
                        >
                          {n.hand}
                        </span>
                      </td>
                      <td className="p-1.5 text-slate-400">{n.velocity || 80}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
