import React from 'react';
import { RenderOptions, TimelineOrientation, NotationStyle, NoteheadStyle, ColorMode } from '../render/types';
import { BENCHMARK_METADATA } from '../scores';

interface ControlsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedScoreId: string;
  onSelectScore: (id: string) => void;
  options: RenderOptions;
  onOptionsChange: (newOptions: Partial<RenderOptions>) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onSeek: (tick: number) => void;
  tempoMultiplier: number;
  onTempoMultiplierChange: (mult: number) => void;
  totalTicks: number;
  onOpenHandShapeModal: () => void;
  onOpenInspectorModal: () => void;
}

export const ControlsDrawer: React.FC<ControlsDrawerProps> = ({
  isOpen,
  onClose,
  selectedScoreId,
  onSelectScore,
  options,
  onOptionsChange,
  isPlaying,
  onTogglePlay,
  onSeek,
  tempoMultiplier,
  onTempoMultiplierChange,
  totalTicks,
  onOpenHandShapeModal,
  onOpenInspectorModal,
}) => {
  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Drawer Container */}
      <aside
        className={`fixed md:static inset-y-0 right-0 w-80 max-w-[85vw] bg-slate-900 border-l border-slate-800 z-50 flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'
        }`}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between p-3.5 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚙️</span>
            <h2 className="text-sm font-bold text-slate-100">Workbench Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="md:hidden text-slate-400 hover:text-slate-200 text-lg p-1"
            aria-label="Close settings"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs text-slate-300">
          {/* Canonical Benchmark Scores */}
          <div>
            <label className="text-slate-400 font-semibold block mb-1.5 uppercase tracking-wider text-[10px]">
              Canonical Benchmark
            </label>
            <div className="space-y-1.5">
              {BENCHMARK_METADATA.map((bm) => (
                <button
                  key={bm.id}
                  onClick={() => onSelectScore(bm.id)}
                  className={`w-full text-left p-2.5 rounded-lg border transition ${
                    selectedScoreId === bm.id
                      ? 'bg-blue-950/60 border-blue-500 text-white shadow'
                      : 'bg-slate-850 border-slate-800 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="font-semibold text-xs text-blue-300">{bm.title}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{bm.composer} • {bm.period}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Timeline Orientation */}
          <div>
            <label className="text-slate-400 font-semibold block mb-1.5 uppercase tracking-wider text-[10px]">
              Timeline Orientation
            </label>
            <div className="grid grid-cols-2 gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
              {(['horizontal', 'vertical'] as TimelineOrientation[]).map((ori) => (
                <button
                  key={ori}
                  onClick={() => onOptionsChange({ orientation: ori })}
                  className={`py-1.5 text-center rounded capitalize font-medium transition ${
                    options.orientation === ori
                      ? 'bg-blue-600 text-white font-bold shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {ori === 'horizontal' ? '↔ Horizontal' : '↕ Vertical (Jánko)'}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              {options.orientation === 'horizontal'
                ? 'Time flows Left-to-Right; pitch is vertical.'
                : 'Time flows Top-to-Bottom, horizontally aligning pitch with Jánko keyboard keys.'}
            </p>
          </div>

          {/* Notation Pipeline */}
          <div>
            <label className="text-slate-400 font-semibold block mb-1.5 uppercase tracking-wider text-[10px]">
              Notation Pipeline
            </label>
            <div className="grid grid-cols-2 gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => onOptionsChange({ notationStyle: 'wholetone-staff' })}
                className={`py-1.5 text-center rounded font-medium transition text-[11px] ${
                  options.notationStyle === 'wholetone-staff'
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                6-6 Whole-Tone Staff
              </button>
              <button
                onClick={() => onOptionsChange({ notationStyle: 'chromatic-grid' })}
                className={`py-1.5 text-center rounded font-medium transition text-[11px] ${
                  options.notationStyle === 'chromatic-grid'
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Chromatic Grid
              </button>
            </div>
          </div>

          {/* Notehead Style */}
          <div>
            <label className="text-slate-400 font-semibold block mb-1.5 uppercase tracking-wider text-[10px]">
              Notehead Style
            </label>
            <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-[11px]">
              {(['numerical', 'classic', 'both'] as NoteheadStyle[]).map((style) => (
                <button
                  key={style}
                  onClick={() => onOptionsChange({ noteheadStyle: style })}
                  className={`py-1 text-center rounded capitalize font-medium transition ${
                    options.noteheadStyle === style
                      ? 'bg-blue-600 text-white font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {style === 'numerical' ? '0..11' : style}
                </button>
              ))}
            </div>
          </div>

          {/* Color Spectrum */}
          <div>
            <label className="text-slate-400 font-semibold block mb-1.5 uppercase tracking-wider text-[10px]">
              Color Spectrum
            </label>
            <select
              value={options.colorMode}
              onChange={(e) => onOptionsChange({ colorMode: e.target.value as ColorMode })}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="pitch-class-wheel">12-TET Pitch Class Wheel</option>
              <option value="wholetone-duality">Whole-Tone Parity Duality (WT-A vs WT-B)</option>
              <option value="voice-hand">Voice & Hand (RH Blue / LH Amber)</option>
              <option value="monochrome">Monochrome / High Contrast</option>
            </select>
          </div>

          {/* Zoom & Dimensions */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                Visual Zoom & Scale
              </label>
              <span className="font-mono text-blue-400">{options.zoom.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2.5"
              step="0.1"
              value={options.zoom}
              onChange={(e) => {
                const z = parseFloat(e.target.value);
                onOptionsChange({
                  zoom: z,
                  pixelsPerTick: 0.35 * z,
                  pixelsPerSemitone: 14 * z,
                });
              }}
              className="w-full accent-blue-500 cursor-pointer"
            />
          </div>

          {/* Overlays Toggles */}
          <div className="space-y-2 border-t border-slate-800 pt-3">
            <label className="text-slate-400 font-semibold block uppercase tracking-wider text-[10px]">
              Hierarchical Overlays
            </label>

            <label className="flex items-center justify-between p-1.5 rounded hover:bg-slate-800/60 cursor-pointer">
              <span>⚡ Hand Crossing Highlighting</span>
              <input
                type="checkbox"
                checked={options.showHandCrossings}
                onChange={(e) => onOptionsChange({ showHandCrossings: e.target.checked })}
                className="accent-pink-500 w-4 h-4 rounded"
              />
            </label>

            <label className="flex items-center justify-between p-1.5 rounded hover:bg-slate-800/60 cursor-pointer">
              <span>Barlines & Measure Numbers</span>
              <input
                type="checkbox"
                checked={options.showBarlines}
                onChange={(e) => onOptionsChange({ showBarlines: e.target.checked })}
                className="accent-blue-500 w-4 h-4 rounded"
              />
            </label>

            <label className="flex items-center justify-between p-1.5 rounded hover:bg-slate-800/60 cursor-pointer">
              <span>Dynamics & Expression</span>
              <input
                type="checkbox"
                checked={options.showDynamics}
                onChange={(e) => onOptionsChange({ showDynamics: e.target.checked })}
                className="accent-blue-500 w-4 h-4 rounded"
              />
            </label>
          </div>

          {/* Interactive Modals Launchers */}
          <div className="space-y-2 border-t border-slate-800 pt-3">
            <button
              onClick={onOpenHandShapeModal}
              className="w-full py-2 px-3 bg-amber-500/20 border border-amber-500/50 hover:bg-amber-500/30 text-amber-300 font-semibold rounded-lg text-left flex items-center justify-between transition"
            >
              <span>📐 Hand-Shape Isomorphism</span>
              <span>→</span>
            </button>

            <button
              onClick={onOpenInspectorModal}
              className="w-full py-2 px-3 bg-sky-500/20 border border-sky-500/50 hover:bg-sky-500/30 text-sky-300 font-semibold rounded-lg text-left flex items-center justify-between transition"
            >
              <span>🔬 Quantized Grid Inspector</span>
              <span>→</span>
            </button>
          </div>
        </div>

        {/* Playback Controls Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={onTogglePlay}
              className={`flex-1 py-2 font-bold rounded-lg text-xs transition shadow flex items-center justify-center gap-1.5 ${
                isPlaying
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              <span>{isPlaying ? '⏸ Pause' : '▶ Play Score'}</span>
            </button>

            <button
              onClick={() => onSeek(0)}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
              title="Rewind to start"
            >
              ⏮
            </button>
          </div>

          {/* Tempo Multiplier */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
            <span>Tempo Speed:</span>
            <div className="flex gap-1">
              {[0.5, 0.75, 1.0, 1.5].map((speed) => (
                <button
                  key={speed}
                  onClick={() => onTempoMultiplierChange(speed)}
                  className={`px-1.5 py-0.5 rounded text-[10px] ${
                    tempoMultiplier === speed
                      ? 'bg-blue-600 text-white font-bold'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-400'
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
