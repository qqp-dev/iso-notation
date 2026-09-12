import React, { useRef } from 'react';
import {
  RenderOptions,
  TimelineOrientation,
  ColorMode,
} from '../render/types';
import { BENCHMARK_METADATA } from '../scores';
import { QuantizedGridScore } from '../model/types';
import { tickToMeasureBeat } from '../model/grid';

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
  currentTick?: number;
  score?: QuantizedGridScore;
  currentView?: 'score' | 'phonetics';
  onViewChange?: (view: 'score' | 'phonetics') => void;
  onOpenPrintModal?: () => void;
  onOpenCompressionModal?: () => void;
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
  onLoadMidiFile,
  currentTick,
  score,
  currentView = 'score',
  onViewChange,
  onOpenPrintModal,
  onOpenCompressionModal,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onLoadMidiFile(files[0]);
    }
  };

  const effectiveTick = currentTick ?? options.currentTick ?? 0;
  const { measure, beat, tickInBeat } = score
    ? tickToMeasureBeat(Math.floor(effectiveTick), score)
    : { measure: 1, beat: 1, tickInBeat: 0 };
  const bpm = score?.tempos[0]?.bpm || 100;

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 backdrop-blur-xs transition-opacity no-print"
          onClick={onClose}
        />
      )}

      {/* Drawer Container - Slide-out overlay on all viewports */}
      <aside
        className={`fixed inset-y-0 right-0 w-80 max-w-[85vw] bg-black border-l border-neutral-800 z-50 flex flex-col shadow-2xl transition-transform duration-300 ease-in-out no-print ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between p-3.5 border-b border-neutral-800 bg-black shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-neutral-100 uppercase tracking-wider font-mono">Parameters & Controls</span>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-200 text-base p-1 transition"
            aria-label="Close settings"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs text-neutral-300">
          {/* View Mode Toggle */}
          {onViewChange && (
            <div>
              <label className="text-neutral-400 font-semibold block mb-1.5 uppercase tracking-wider text-[10px]">
                View Mode
              </label>
              <div className="grid grid-cols-2 gap-1 bg-neutral-950 p-1 rounded border border-neutral-800 font-mono">
                <button
                  onClick={() => onViewChange('score')}
                  className={`py-1.5 rounded transition text-center ${
                    currentView === 'score'
                      ? 'bg-neutral-800 text-white font-bold'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  Score
                </button>
                <button
                  onClick={() => onViewChange('phonetics')}
                  className={`py-1.5 rounded transition text-center ${
                    currentView === 'phonetics'
                      ? 'bg-amber-500 text-black font-bold'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  Solfège Guide
                </button>
              </div>
            </div>
          )}

          {/* Playback Transport & Scrubbing */}
          <div className="bg-neutral-950 p-3 rounded-lg border border-neutral-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-neutral-400 font-semibold uppercase tracking-wider text-[10px]">
                Playback Transport
              </label>
              <div className="flex items-center gap-1 font-mono text-[11px] text-amber-400 font-bold">
                <span>M{measure}</span>
                <span className="text-neutral-600">:</span>
                <span>B{beat}</span>
                <span className="text-neutral-600">:</span>
                <span className="text-neutral-500 font-normal">+{tickInBeat}t</span>
              </div>
            </div>

            {/* Scrub Slider */}
            <div className="space-y-1">
              <input
                type="range"
                min="0"
                max={totalTicks}
                value={effectiveTick}
                onChange={(e) => onSeek(parseFloat(e.target.value))}
                className="w-full accent-amber-500 h-1.5 bg-neutral-800 rounded cursor-pointer"
                aria-label="Timeline scrubber"
              />
              <div className="flex items-center justify-between text-[10px] font-mono text-neutral-500">
                <span>Tick {Math.floor(effectiveTick)}</span>
                <span>{totalTicks}t ({score?.notes.length ?? 0} notes)</span>
              </div>
            </div>

            {/* Transport controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={onTogglePlay}
                className={`flex-1 py-2 rounded font-mono text-xs font-bold transition flex items-center justify-center gap-2 ${
                  isPlaying
                    ? 'bg-amber-500 hover:bg-amber-400 text-black'
                    : 'bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700'
                }`}
              >
                <span>{isPlaying ? '⏸' : '▶'}</span>
                <span>{isPlaying ? 'Pause' : 'Play'}</span>
              </button>

              <button
                onClick={() => onSeek(0)}
                className="px-3 py-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 rounded border border-neutral-800 font-mono text-xs"
                title="Rewind to start"
              >
                ⏮
              </button>
            </div>

            {/* Tempo multiplier pills */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-neutral-500 font-mono">Speed</span>
              <div className="flex items-center gap-1">
                {[0.5, 0.75, 1.0, 1.5].map((speed) => (
                  <button
                    key={speed}
                    onClick={() => onTempoMultiplierChange(speed)}
                    className={`px-1.5 py-0.5 rounded text-[10px] ${
                      tempoMultiplier === speed
                        ? 'bg-amber-500 text-black font-bold'
                        : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Definitive Design Architecture */}
          <div className="bg-neutral-950 p-3 rounded-lg border border-neutral-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-neutral-200 font-bold font-mono text-xs">Definitive Iso-Notation</span>
              <span className="text-[10px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40 px-1.5 py-0.5 rounded">DEFINITIVE</span>
            </div>
            <div className="space-y-1.5 text-[11px] text-neutral-400 font-sans">
              <div className="flex items-start gap-2">
                <span className="text-amber-400 font-mono text-xs">•</span>
                <span><strong className="text-neutral-200 font-mono">Duodecimal (0–9, a, b) in URW Gothic:</strong> Standalone geometric base-12 digits with circular line knockout. Exposes interval arithmetic and row parity directly.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-amber-400 font-mono text-xs">•</span>
                <span><strong className="text-neutral-200 font-mono">Duodecimal Solfège:</strong> <span className="font-mono text-amber-300">o, wa, tu, ti, fo, fa, si, se, e, na, a, bi</span>. Natural phonetic reduction of numbers with 100% row-parity alignment.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-amber-400 font-mono text-xs">•</span>
                <span><strong className="text-neutral-200 font-mono">2-Line Landmark Staff:</strong> Bold solid octave line (0 / C) and dashed demarcation line (4 / E). Line 8 dropped to lighten page.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-amber-400 font-mono text-xs">•</span>
                <span><strong className="text-neutral-200 font-mono">Sculpted French Guillemets:</strong> Symmetric curved concave flanks (« for LH in treble, » for RH in bass).</span>
              </div>
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

          {/* Out-of-Staff Octaves Handling */}
          <div>
            <label className="text-neutral-400 font-semibold block mb-1.5 uppercase tracking-wider text-[10px]">
              Out-of-Staff Octaves (4-Oct Core m1–m5)
            </label>
            <div className="grid grid-cols-2 gap-1.5 bg-neutral-950 p-1 rounded border border-neutral-800">
              <button
                onClick={() => onOptionsChange({ octaveExtensionMode: 'badge' })}
                className={`py-1.5 px-2 text-left rounded font-mono text-[10px] transition ${
                  options.octaveExtensionMode === 'badge'
                    ? 'bg-neutral-800 text-white font-bold border border-neutral-700'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <div className="font-bold">Option 4: Badges</div>
                <div className="text-[9px] text-neutral-500 font-sans">Fold with ↑8 / ↓8 pips</div>
              </button>
              <button
                onClick={() => onOptionsChange({ octaveExtensionMode: 'spillover' })}
                className={`py-1.5 px-2 text-left rounded font-mono text-[10px] transition ${
                  (options.octaveExtensionMode || 'spillover') === 'spillover'
                    ? 'bg-neutral-800 text-white font-bold border border-neutral-700'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <div className="font-bold">Option 2: Margins</div>
                <div className="text-[9px] text-neutral-500 font-sans">15pt Symmetrical Margins</div>
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
              <option value="duration-class">Duration Class (16th=Silver, 8th=Sky, 4th=Amber...)</option>
              <option value="ddr-subdivision">DDR Metric Subdivision (4th=Red, 8th=Blue...)</option>
              <option value="monochrome">Monochrome</option>
              <option value="wholetone-duality">Whole-Tone Parity (Row 0 / Row 1)</option>
              <option value="pitch-class-wheel">12-TET Pitch Class Wheel</option>
              <option value="voice-hand">Voice & Hand (RH / LH)</option>
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
                  pixelsPerTick: 2.0 * z,
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
              <span>Barlines & Measure Numbers</span>
              <input
                type="checkbox"
                checked={options.showBarlines}
                onChange={(e) => onOptionsChange({ showBarlines: e.target.checked })}
                className="accent-amber-500 w-4 h-4 rounded"
              />
            </label>

            <label className="flex items-center justify-between p-1.5 rounded hover:bg-neutral-900 cursor-pointer font-mono text-[11px]">
              <span>📏 Klavar Beat Grid</span>
              <input
                type="checkbox"
                checked={!!options.showBeatGrid}
                onChange={(e) => onOptionsChange({ showBeatGrid: e.target.checked })}
                className="accent-amber-500 w-4 h-4 rounded"
              />
            </label>
          </div>

          {/* Printable Sheet Music Section */}
          <div className="border-t border-neutral-800 pt-3">
            <label className="text-neutral-400 font-semibold block mb-1.5 uppercase tracking-wider text-[10px]">
              Sheet Music & Print
            </label>
            <button
              onClick={() => {
                onOpenPrintModal?.();
                onClose();
              }}
              className="w-full py-2.5 px-3 bg-neutral-900 hover:bg-neutral-800 text-amber-400 hover:text-amber-300 border border-neutral-700 hover:border-amber-500/50 rounded font-mono text-xs flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
              title="Open printable 3-page landscape system layout for A4 paper"
            >
              <span>🖨️</span>
              <span className="font-bold">Print Sheet Music (A4)</span>
            </button>

            {/* View Mode Segmented Control */}
            <div className="mt-3">
              <label className="text-neutral-400 font-semibold block mb-1.5 uppercase tracking-wider text-[10px]">
                Notation View vs Piano Roll
              </label>
              <div className="grid grid-cols-2 gap-1.5 bg-neutral-950 p-1 rounded border border-neutral-800">
                <button
                  type="button"
                  onClick={() => onOptionsChange({ viewMode: 'isomorphic' })}
                  className={`py-1.5 px-2 text-xs font-mono rounded flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    (options.viewMode || 'isomorphic') === 'isomorphic'
                      ? 'bg-amber-500 text-black font-bold shadow'
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
                  }`}
                  title="Isomorphic whole-tone staff with row parity noteheads"
                >
                  <span>🎼</span>
                  <span>Score View</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOptionsChange({ viewMode: 'pianoroll' })}
                  className={`py-1.5 px-2 text-xs font-mono rounded flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    options.viewMode === 'pianoroll'
                      ? 'bg-amber-500 text-black font-bold shadow'
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
                  }`}
                  title="Direct 1:1 geometric comparison with chromatic DAW Piano Roll"
                >
                  <span>🎹</span>
                  <span>Piano Roll</span>
                </button>
              </div>
            </div>
          </div>

          {/* Score Selector */}
          <div className="border-t border-neutral-800 pt-3">
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
        </div>

        {/* Playback Controls Footer */}
        <div className="p-3 border-t border-neutral-800 bg-black shrink-0">
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
        </div>
      </aside>
    </>
  );
};
