import React, { useRef } from 'react';
import {
  RenderOptions,
  TimelineOrientation,
  StaffStyle,
  NoteheadMorphology,
  ColorMode,
  DESIGN_PRESETS,
  normalizeStaffStyle,
  normalizeNoteheadMorphology,
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
                  Phonetics Lab
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

            {/* Transport Buttons */}
            <div className="flex items-center gap-2">
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
            <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400 pt-1 border-t border-neutral-900">
              <span>Tempo: {bpm} BPM</span>
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

          {/* Curated Design Presets */}
          <div>
            <label className="text-neutral-400 font-semibold block mb-1.5 uppercase tracking-wider text-[10px]">
              Curated Design Presets
            </label>
            <div className="space-y-1">
              {DESIGN_PRESETS.map((preset) => {
                const isSelected =
                  normalizeStaffStyle(options.staffStyle) === normalizeStaffStyle(preset.staffStyle) &&
                  normalizeNoteheadMorphology(options.noteheadMorphology) ===
                    normalizeNoteheadMorphology(preset.noteheadMorphology) &&
                  options.colorMode === preset.colorMode &&
                  (!preset.orientation || options.orientation === preset.orientation);
                return (
                  <button
                    key={preset.id}
                    onClick={() =>
                      onOptionsChange({
                        staffStyle: preset.staffStyle,
                        noteheadMorphology: preset.noteheadMorphology,
                        colorMode: preset.colorMode,
                        ...(preset.orientation ? { orientation: preset.orientation } : {}),
                      })
                    }
                    className={`w-full text-left p-2 rounded border transition ${
                      isSelected
                        ? 'bg-neutral-900 border-amber-500 text-white shadow'
                        : 'bg-black border-neutral-800 text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200'
                    }`}
                  >
                    <div className="font-semibold text-xs text-neutral-100 flex items-center justify-between">
                      <span>{preset.name}</span>
                      {isSelected && <span className="text-[10px] text-amber-400 font-mono">ACTIVE</span>}
                    </div>
                    <div className="text-[10px] text-neutral-400 mt-0.5">{preset.description}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Staff Topography */}
          <div>
            <label className="text-neutral-400 font-semibold block mb-1.5 uppercase tracking-wider text-[10px]">
              Staff Topography
            </label>
            <div className="space-y-1 bg-neutral-950 p-1.5 rounded border border-neutral-800">
              {[
                { id: 'tritone-split' as StaffStyle, label: 'Tritone Split (3+3)', desc: 'PC 0 bold, PC 6 dashed landmark' },
                { id: 'wholetone-uniform' as StaffStyle, label: '6-6 Whole-Tone Uniform', desc: '6 lines on even PCs (0,2,4,6,8,10)' },
                { id: 'augmented-3line' as StaffStyle, label: 'Augmented Triad (3-Line)', desc: '3 major-third lines (0, 4, 8)' },
                { id: 'octave-ribbons' as StaffStyle, label: 'Octave Ribbons', desc: 'Alternating register luminance ribbons' },
                { id: 'chromatic-grid' as StaffStyle, label: 'Chromatic Grid', desc: '12 semitone bars per octave' },
              ].map((st) => {
                const isSelected = normalizeStaffStyle(options.staffStyle) === normalizeStaffStyle(st.id);
                return (
                  <button
                    key={st.id}
                    onClick={() => onOptionsChange({ staffStyle: st.id })}
                    className={`w-full text-left px-2.5 py-1.5 rounded font-mono text-[11px] transition ${
                      isSelected
                        ? 'bg-neutral-800 text-white font-bold border border-neutral-700'
                        : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{st.label}</span>
                      {isSelected && <span className="text-amber-400 text-[10px]">✓</span>}
                    </div>
                    <div className="text-[9px] text-neutral-500 font-sans">{st.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notehead Morphology */}
          <div>
            <label className="text-neutral-400 font-semibold block mb-1.5 uppercase tracking-wider text-[10px]">
              Notehead Morphology
            </label>
            <div className="space-y-1 bg-neutral-950 p-1.5 rounded border border-neutral-800">
              {[
                { id: 'row-parity-shape' as NoteheadMorphology, label: 'Row Parity Shapes', desc: 'Discs on lines (Row 0), Diamonds in spaces (Row 1)' },
                { id: 'classic-oval' as NoteheadMorphology, label: 'Classic Oval', desc: 'Tilted elliptical notehead with line knockout' },
                { id: 'phonetic' as NoteheadMorphology, label: '12-TET Phonetics', desc: 'Monosyllabic tokens (ma, di, va, pi, la, ri...)' },
                { id: 'numerical' as NoteheadMorphology, label: 'Numerical Digits', desc: 'Pitch-class integers 0..11' },
                { id: 'minimal-dot' as NoteheadMorphology, label: 'Minimal Dots', desc: 'Uncluttered circular dots with line knockout' },
              ].map((nh) => {
                const isSelected =
                  normalizeNoteheadMorphology(options.noteheadMorphology) ===
                  normalizeNoteheadMorphology(nh.id);
                return (
                  <button
                    key={nh.id}
                    onClick={() => onOptionsChange({ noteheadMorphology: nh.id })}
                    className={`w-full text-left px-2.5 py-1.5 rounded font-mono text-[11px] transition ${
                      isSelected
                        ? 'bg-neutral-800 text-white font-bold border border-neutral-700'
                        : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{nh.label}</span>
                      {isSelected && <span className="text-amber-400 text-[10px]">✓</span>}
                    </div>
                    <div className="text-[9px] text-neutral-500 font-sans">{nh.desc}</div>
                  </button>
                );
              })}
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
              title="Open printable 2-page columnar score layout for A4/A3 paper"
            >
              <span>🖨️</span>
              <span className="font-bold">Print Sheet Music (A4)</span>
            </button>
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
