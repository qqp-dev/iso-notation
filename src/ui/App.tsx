import React, { useState, useEffect, useRef, useCallback } from 'react';
import { QuantizedGridScore } from '../model/types';
import { RenderOptions } from '../render/types';
import { BENCHMARK_SCORES } from '../scores';
import { tickToMeasureBeat } from '../model/grid';
import { parseMidiToScore } from '../model/midi';
import { synth } from '../audio/synth';
import { NotationCanvas } from './NotationCanvas';
import { ControlsDrawer } from './ControlsDrawer';
import { PhoneticSandbox } from './PhoneticSandbox';
import { PrintModal } from './PrintModal';
import { CompressionModal } from './CompressionModal';

const STORAGE_KEY = 'iso-notation-render-options-v2';

const DEFINITIVE_RENDER_OPTIONS: RenderOptions = {
  orientation: 'vertical',
  staffStyle: 'tritone-split',
  noteheadMorphology: 'duodecimal',
  notationStyle: 'tritone-split',
  noteheadStyle: 'duodecimal',
  colorMode: 'duration-class',
  zoom: 1.0,
  pixelsPerTick: 2.0,
  pixelsPerSemitone: 11,
  showHandCrossings: false,
  showBarlines: true,
  showGridLines: true,
  showBeatGrid: true,
  showGutterBrackets: false,
  octaveExtensionMode: 'spillover',
  currentTick: 0,
};

function getInitialRenderOptions(): RenderOptions {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...DEFINITIVE_RENDER_OPTIONS,
        ...parsed,
        staffStyle: 'tritone-split',
        noteheadMorphology: 'duodecimal',
        notationStyle: 'tritone-split',
        noteheadStyle: 'duodecimal',
        currentTick: 0,
      };
    }
  } catch (e) {
    // Ignore storage parse errors
  }
  return DEFINITIVE_RENDER_OPTIONS;
}

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<'score' | 'phonetics'>('score');
  const [selectedScoreId, setSelectedScoreId] = useState<string>('bach-goldberg-var1');
  const [score, setScore] = useState<QuantizedGridScore>(() => BENCHMARK_SCORES['bach-goldberg-var1']());

  const [currentTick, setCurrentTick] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [tempoMultiplier, setTempoMultiplier] = useState<number>(1.0);

  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [isCompressionModalOpen, setIsCompressionModalOpen] = useState<boolean>(false);
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Render options state: always default to Definitive Duodecimal Iso-Notation
  const [renderOptions, setRenderOptions] = useState<RenderOptions>(getInitialRenderOptions);

  // Keep renderOptions.currentTick in sync
  useEffect(() => {
    setRenderOptions((prev) => ({ ...prev, currentTick }));
  }, [currentTick]);

  // Switch score
  const handleSelectScore = (id: string) => {
    if (BENCHMARK_SCORES[id]) {
      setIsPlaying(false);
      setSelectedScoreId(id);
      const newScore = BENCHMARK_SCORES[id]();
      setScore(newScore);
      setCurrentTick(0);
      synth.stopAll();
    }
  };

  const handleUpdateOptions = (newOpts: Partial<RenderOptions>) => {
    setRenderOptions((prev) => {
      const updated = {
        ...prev,
        ...newOpts,
        staffStyle: 'tritone-split' as const,
        noteheadMorphology: 'duodecimal' as const,
        notationStyle: 'tritone-split' as const,
        noteheadStyle: 'duodecimal' as const,
      };
      try {
        const { currentTick: _, ...toSave } = updated;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
      } catch (e) {
        // Ignore
      }
      return updated;
    });
  };

  // MIDI File Ingestion
  const processMidiFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      if (buffer) {
        try {
          setIsPlaying(false);
          synth.stopAll();
          const cleanName = file.name.replace(/\.[^/.]+$/, '');
          const newScore = parseMidiToScore(buffer, {
            id: `custom-${Date.now()}`,
            title: cleanName,
            composer: 'Imported MIDI',
          });
          setSelectedScoreId('custom');
          setScore(newScore);
          setCurrentTick(0);
        } catch (err) {
          console.error('Failed to parse MIDI file:', err);
          alert('Failed to parse MIDI file. Ensure valid standard MIDI format.');
        }
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  // Drag & drop file ingestion on window
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      setIsDraggingFile(true);
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      setIsDraggingFile(false);
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      setIsDraggingFile(false);
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (file.name.endsWith('.mid') || file.name.endsWith('.midi')) {
          processMidiFile(file);
        }
      }
    };

    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, [processMidiFile]);

  // Audio Playback Engine
  const lastTimeRef = useRef<number | null>(null);
  const lastPlayedTickRef = useRef<number>(-1);

  const handleTogglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
      synth.stopAll();
    } else {
      setIsPlaying(true);
      lastTimeRef.current = performance.now();
      lastPlayedTickRef.current = currentTick - 1;
    }
  };

  const handleSeek = (targetTick: number) => {
    const bounded = Math.max(0, Math.min(score.totalTicks, targetTick));
    setCurrentTick(bounded);
    lastPlayedTickRef.current = bounded - 1;

    // Trigger immediate sound preview for notes starting near this tick
    const notesToAudition = score.notes.filter(
      (n) => bounded >= n.startTick && bounded < n.startTick + Math.min(24, n.durationTicks)
    );
    notesToAudition.forEach((n) => {
      synth.playPitch(n.pitch, 0.4, n.velocity || 80);
    });
  };

  useEffect(() => {
    if (!isPlaying) return;

    let animId: number;

    const loop = (now: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = now;
      const dtSec = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      const bpm = (score.tempos[0]?.bpm || 100) * tempoMultiplier;
      const ticksPerSec = (bpm / 60) * score.ticksPerBeat;
      const advanceTicks = dtSec * ticksPerSec;

      setCurrentTick((prev) => {
        const nextTick = prev + advanceTicks;
        if (nextTick >= score.totalTicks) {
          setIsPlaying(false);
          synth.stopAll();
          return 0;
        }

        // Trigger notes on onset
        const intPrev = Math.floor(prev);
        const intNext = Math.floor(nextTick);

        if (intNext > lastPlayedTickRef.current) {
          const newlyTriggeredNotes = score.notes.filter(
            (n) => n.startTick > lastPlayedTickRef.current && n.startTick <= intNext
          );
          newlyTriggeredNotes.forEach((note) => {
            const durSec = (note.durationTicks / score.ticksPerBeat) * (60 / bpm);
            synth.playPitch(note.pitch, durSec, note.velocity || 80);
          });
          lastPlayedTickRef.current = intNext;
        }

        return nextTick;
      });

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, score, tempoMultiplier]);

  const { measure, beat, tickInBeat } = tickToMeasureBeat(Math.floor(currentTick), score);

  return (
    <div className="fixed inset-0 h-[100dvh] w-screen flex flex-col bg-black text-neutral-100 overflow-hidden font-sans select-none">
      {/* Drag & Drop Visual Indicator Overlay */}
      {isDraggingFile && (
        <div className="absolute inset-0 z-50 bg-black/90 border-2 border-dashed border-amber-400 flex flex-col items-center justify-center pointer-events-none no-print">
          <span className="text-4xl mb-3">📥</span>
          <span className="font-mono text-base text-amber-300 font-bold">
            Drop .mid file to ingest into quantized fence
          </span>
        </div>
      )}

      {/* Hidden File Input for Loading MIDI */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".mid,.midi"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            processMidiFile(e.target.files[0]);
          }
        }}
      />

      {currentView === 'phonetics' ? (
        <div className="relative w-full h-full flex flex-col no-print">
          {/* Floating Return Button */}
          <div className="fixed top-3 right-3 z-50">
            <button
              onClick={() => {
                synth.stopAll();
                setCurrentView('score');
              }}
              className="px-3 py-1.5 rounded-full bg-neutral-900/90 hover:bg-neutral-800 text-white text-xs font-mono border border-neutral-700 shadow-xl flex items-center gap-1.5 transition"
            >
              <span>←</span>
              <span>Back to Score</span>
            </button>
          </div>
          <PhoneticSandbox />
        </div>
      ) : (
        <div className="fixed inset-0 h-[100dvh] w-screen flex flex-col overflow-hidden bg-black no-print">
          {/* Full-Viewport Score Canvas */}
          <NotationCanvas
            score={score}
            options={renderOptions}
            onTickSeek={handleSeek}
            onNoteSelect={(n) => {
              handleSeek(n.startTick);
              synth.playPitch(n.pitch, 0.5, n.velocity || 80);
            }}
          />

          {/* Floating Action Trigger ("Floaty Thing") */}
          <div className="fixed top-3 right-3 z-40 flex items-center gap-2 bg-black/80 backdrop-blur border border-neutral-800 rounded-full px-3 py-1.5 shadow-2xl text-xs font-mono select-none">
            {/* Quick Play/Pause Button */}
            <button
              onClick={handleTogglePlay}
              className={`px-2.5 py-1 rounded-full font-bold flex items-center gap-1.5 transition ${
                isPlaying
                  ? 'bg-amber-500 hover:bg-amber-400 text-black'
                  : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-100 border border-neutral-700'
              }`}
              title={isPlaying ? 'Pause playback' : 'Start playback'}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              <span>{isPlaying ? '⏸' : '▶'}</span>
              <span className="hidden sm:inline">{isPlaying ? 'Pause' : 'Play'}</span>
            </button>

            {/* Measure Indicator Badge */}
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-neutral-900/90 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 text-[11px] cursor-pointer transition"
              title="Current Measure and Beat (click to open controls)"
              aria-label={`Measure ${measure} Beat ${beat}`}
            >
              <span className="text-amber-400 font-bold">M{measure}</span>
              <span className="text-neutral-600">:</span>
              <span>B{beat}</span>
            </button>

            {/* View Mode Toggle: Isomorphic Score vs Piano Roll */}
            <button
              onClick={() => {
                setRenderOptions((prev) => ({
                  ...prev,
                  viewMode: prev.viewMode === 'pianoroll' ? 'isomorphic' : 'pianoroll',
                }));
              }}
              className={`px-2.5 py-1 rounded-full border text-[11px] cursor-pointer transition flex items-center gap-1.5 ${
                renderOptions.viewMode === 'pianoroll'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 hover:bg-amber-500/30 font-semibold shadow-sm'
                  : 'bg-neutral-900/90 hover:bg-neutral-800 text-neutral-300 hover:text-white border-neutral-800'
              }`}
              title={
                renderOptions.viewMode === 'pianoroll'
                  ? 'Switch to Isomorphic Score View'
                  : 'Switch to Piano Roll Comparison View (preserving exact geometry)'
              }
              aria-label={renderOptions.viewMode === 'pianoroll' ? 'Show Score View' : 'Show Piano Roll'}
            >
              <span>{renderOptions.viewMode === 'pianoroll' ? '🎹' : '🎼'}</span>
              <span>{renderOptions.viewMode === 'pianoroll' ? 'Piano Roll' : 'Score View'}</span>
            </button>

            {/* Quick Print Button */}
            <button
              onClick={() => setIsPrintModalOpen(true)}
              className="px-2.5 py-1 rounded-full bg-neutral-900/90 hover:bg-neutral-800 text-amber-400 hover:text-amber-300 border border-neutral-800 text-[11px] cursor-pointer transition flex items-center gap-1.5"
              title="Print Sheet Music (A4 Columnar Engraving)"
            >
              <span>🖨️</span>
              <span className="hidden sm:inline">Print</span>
            </button>

            {/* Sidebar Toggle Button */}
            <button
              onClick={() => setIsDrawerOpen((prev) => !prev)}
              className="p-1.5 px-2.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 hover:text-white rounded-full border border-neutral-700 flex items-center gap-1.5 transition"
              aria-label="Open controls"
              title="Open parameters sidebar"
            >
              <span>⚙</span>
              <span className="text-[11px] hidden sm:inline">Controls</span>
            </button>
          </div>

          {/* Slide-out Controls Drawer */}
          <ControlsDrawer
            isOpen={isDrawerOpen}
            onClose={() => setIsDrawerOpen(false)}
            selectedScoreId={selectedScoreId}
            onSelectScore={handleSelectScore}
            options={renderOptions}
            onOptionsChange={handleUpdateOptions}
            isPlaying={isPlaying}
            onTogglePlay={handleTogglePlay}
            onSeek={handleSeek}
            tempoMultiplier={tempoMultiplier}
            onTempoMultiplierChange={setTempoMultiplier}
            totalTicks={score.totalTicks}
            onLoadMidiFile={processMidiFile}
            currentTick={currentTick}
            score={score}
            currentView={currentView}
            onViewChange={(view) => {
              if (view !== currentView) {
                setIsPlaying(false);
                synth.stopAll();
                setCurrentView(view);
                setIsDrawerOpen(false);
              }
            }}
            onOpenPrintModal={() => setIsPrintModalOpen(true)}
            onOpenCompressionModal={() => setIsCompressionModalOpen(true)}
          />
        </div>
      )}

      {/* Printable Sheet Music Engine & Modal */}
      <PrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        score={score}
        renderOptions={renderOptions}
      />

      {/* 6-Lane vs 12-Lane Compression Modal */}
      <CompressionModal
        isOpen={isCompressionModalOpen}
        onClose={() => setIsCompressionModalOpen(false)}
      />
    </div>
  );
};
