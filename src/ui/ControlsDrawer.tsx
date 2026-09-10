import React, { useRef } from 'react';
import { RenderOptions, TimelineOrientation, NotationStyle, ColorMode } from '../render/types';
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
  onLoadMidiFile: (file: File) => void;
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
  onLoadMidiFile,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onLoadMidiFile(files[0]);
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/80 z-40 md:hidden backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Drawer Container */}
      <aside
        className={`fixed md:static inset-y-0 right-0 w-80 max-w-[85vw] bg-black border-l border-neutral-800 z-50 flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'
        }`}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between p-3.5 border-b border-neutral-800 bg-black">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-neutral-100 uppercase tracking-wider">Parameters</span>
          </div>
          <button
            onClick={onClose}
            className="md:hidden text-neutral-400 hover:text-neutral-200 text-lg p-1"
            aria-label="Close settings"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs text-neutral-300">
          {/* Score Selector */}
          <div>
            <label className="text-neutral-400 font-semibold block mb-1.5 uppercase tracking-wider text-[10px]">
              Active Score
            </label>
            <div className="space-y-1.5">
              {BENCHMARK_METADATA.map((bm) => (
                <button
                  key={bm.id}
                  onClick={() => onSelectScore(bm.id)}
                  className={`w-full text-left p-2.5 rounded border transition ${
                    selectedScoreId === bm.id
                      ? 'bg-neutral-900 border-amber-500 text-white shadow'
                      : 'bg-black border-neutral-800 text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200'
                  }`}
                >
                  <div className="font-semibold text-xs text-neutral-100">{bm.title}</div>
                  <div className="text-[11px] text-neutral-400 mt-0.5">{bm.composer}</div>
                </button>
              ))}
            </div>

            {/* Custom MIDI file upload */}
            <div className="mt-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".mid,.midi"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2 px-3 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-700 rounded text-center font-mono text-[11px] flex items-center justify-center gap-1.5 transition"
              >
                <span>📂</span>
                <span>Load Custom .mid File</span>
              </button>
            </div>
          </div>

          {/* Timeline Orientation */}
          <div>
            <label className="text-neutral-400 font-semibold block mb-1.5 uppercase tracking-wider text-[10px]">
              Timeline Orientation
            </label>
            <div className="grid grid-cols-2 gap-1.5 bg-neutral-950 p-1 rounded border border-neutral-800">
              {(['horizontal', 'vertical'] as TimelineOrientation[]).map((ori) => (
                <button
                  key={ori}
                  onClick={() => onOptionsChange({ orientation: ori })}
                  className={`py-1.5 text-center rounded font-mono text-[11px] transition ${
                    options.orientation === ori
                      ? 'bg-neutral-800 text-white font-bold'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {ori === 'horizontal' ? '↔ Horizontal' : '↕ Vertical'}
                </button>
              ))}
            </div>
          </div>

          {/* Notation Pipeline */}
          <div>
            <label className="text-neutral-400 font-semibold block mb-1.5 uppercase tracking-wider text-[10px]">
              Notation Pipeline
            </label>
            <div className="grid grid-cols-2 gap-1.5 bg-neutral-950 p-1 rounded border border-neutral-800">
              <button
                onClick={() => onOptionsChange({ notationStyle: 'wholetone-staff' })}
                className={`py-1.5 text-center rounded font-mono text-[11px] transition ${
                  options.notationStyle === 'wholetone-staff'
                    ? 'bg-neutral-800 text-white font-bold'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                6-6 Whole-Tone Staff
              </button>
              <button
                onClick={() => onOptionsChange({ notationStyle: 'chromatic-grid' })}
                className={`py-1.5 text-center rounded font-mono text-[11px] transition ${
                  options.notationStyle === 'chromatic-grid'
                    ? 'bg-neutral-800 text-white font-bold'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Chromatic Grid
              </button>
            </div>
          </div>

          {/* Color Spectrum */}
          <div>
            <label className="text-neutral-400 font-semibold block mb-1.5 uppercase tracking-wider text-[10px]">
              Color Spectrum
            </label>
            <select
              value={options.colorMode}
              onChange={(e) => onOptionsChange({ colorMode: e.target.value as ColorMode })}
              className="w-full bg-neutral-950 border border-neutral-800 rounded p-2 text-neutral-200 focus:outline-none focus:border-amber-500 font-mono text-[11px]"
            >
              <option value="wholetone-duality">Whole-Tone Parity (Row 0 / Row 1)</option>
              <option value="pitch-class-wheel">12-TET Pitch Class Wheel</option>
              <option value="voice-hand">Voice & Hand (RH / LH)</option>
              <option value="monochrome">Monochrome</option>
            </select>
          </div>

          {/* Zoom & Dimensions */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-neutral-400 font-semibold uppercase tracking-wider text-[10px]">
                Visual Scale
              </label>
              <span className="font-mono text-amber-400">{options.zoom.toFixed(1)}x</span>
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
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>

          {/* Overlays Toggles */}
          <div className="space-y-2 border-t border-neutral-800 pt-3">
            <label className="text-neutral-400 font-semibold block uppercase tracking-wider text-[10px]">
              Overlays
            </label>

            <label className="flex items-center justify-between p-1.5 rounded hover:bg-neutral-900 cursor-pointer font-mono text-[11px]">
              <span>⚡ Hand Crossing Highlighting</span>
              <input
                type="checkbox"
                checked={options.showHandCrossings}
                onChange={(e) => onOptionsChange({ showHandCrossings: e.target.checked })}
                className="accent-pink-500 w-4 h-4 rounded"
              />
            </label>

            <label className="flex items-center justify-between p-1.5 rounded hover:bg-neutral-900 cursor-pointer font-mono text-[11px]">
              <span>Barlines & Measure Numbers</span>
              <input
                type="checkbox"
                checked={options.showBarlines}
                onChange={(e) => onOptionsChange({ showBarlines: e.target.checked })}
                className="accent-amber-500 w-4 h-4 rounded"
              />
            </label>
          </div>
        </div>

        {/* Playback Controls Footer */}
        <div className="p-3 border-t border-neutral-800 bg-black space-y-2">
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={onTogglePlay}
              className={`flex-1 py-2 font-bold rounded text-xs font-mono transition flex items-center justify-center gap-1.5 ${
                isPlaying
                  ? 'bg-amber-500 hover:bg-amber-400 text-black'
                  : 'bg-white hover:bg-neutral-200 text-black'
              }`}
            >
              <span>{isPlaying ? '⏸ Pause' : '▶ Play'}</span>
            </button>

            <button
              onClick={() => onSeek(0)}
              className="p-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 rounded text-xs border border-neutral-700"
              title="Rewind to start"
            >
              ⏮
            </button>
          </div>

          {/* Tempo Multiplier */}
          <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400 px-1">
            <span>Tempo:</span>
            <div className="flex gap-1">
              {[0.5, 0.75, 1.0, 1.5].map((speed) => (
                <button
                  key={speed}
                  onClick={() => onTempoMultiplierChange(speed)}
                  className={`px-1.5 py-0.5 rounded text-[10px] ${
                    tempoMultiplier === speed
                      ? 'bg-amber-500 text-black font-bold'
                      : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-400'
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
