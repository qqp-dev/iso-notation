import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { QuantizedGridScore, QuantizedNote, PitchCoordinate } from '../model/types';
import { RenderOptions } from '../render/types';
import { BENCHMARK_SCORES, BENCHMARK_METADATA } from '../scores';
import { getActiveNotesAtTick, tickToMeasureBeat } from '../model/grid';
import { parseMidiToScore } from '../model/midi';
import { synth } from '../audio/synth';
import { NotationCanvas } from './NotationCanvas';
import { JankoKeyboard } from './JankoKeyboard';
import { ControlsDrawer } from './ControlsDrawer';

export const App: React.FC = () => {
  const [selectedScoreId, setSelectedScoreId] = useState<string>('bach-goldberg-var1');
  const [score, setScore] = useState<QuantizedGridScore>(() => BENCHMARK_SCORES['bach-goldberg-var1']());

  const [currentTick, setCurrentTick] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [tempoMultiplier, setTempoMultiplier] = useState<number>(1.0);

  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Render options state
  const [renderOptions, setRenderOptions] = useState<RenderOptions>({
    orientation: 'horizontal',
    notationStyle: 'wholetone-staff',
    noteheadStyle: 'numerical',
    colorMode: 'wholetone-duality',
    zoom: 1.0,
    pixelsPerTick: 0.35,
    pixelsPerSemitone: 14,
    showHandCrossings: true,
    showBarlines: true,
    showGridLines: true,
    currentTick: 0,
  });

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
    setRenderOptions((prev) => ({ ...prev, ...newOpts }));
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

  // Sounding notes at current tick
  const activeNotes = useMemo(() => {
    return getActiveNotesAtTick(score, currentTick);
  }, [score, currentTick]);

  const activePitches = useMemo(() => {
    return activeNotes.map((n) => n.pitch);
  }, [activeNotes]);

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
    <div className="flex flex-col h-screen w-screen bg-black text-neutral-100 overflow-hidden font-sans select-none relative">
      {/* Drag & Drop Visual Indicator Overlay */}
      {isDraggingFile && (
        <div className="absolute inset-0 z-50 bg-black/90 border-2 border-dashed border-amber-400 flex flex-col items-center justify-center pointer-events-none">
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

      {/* Top Application Bar */}
      <header className="h-12 bg-black border-b border-neutral-800 px-3 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold tracking-tight text-white text-sm">
              iso-notation
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded bg-neutral-900 text-[10px] text-neutral-400 border border-neutral-800 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>100.102.70.49:5173</span>
          </div>
        </div>

        {/* Score Selector & Quick Controls */}
        <div className="flex items-center gap-2">
          <select
            value={selectedScoreId}
            onChange={(e) => handleSelectScore(e.target.value)}
            className="bg-neutral-900 border border-neutral-700 rounded px-2.5 py-1 text-xs text-neutral-200 focus:outline-none focus:border-amber-500 max-w-[160px] sm:max-w-xs truncate font-mono"
          >
            {selectedScoreId === 'custom' && (
              <option value="custom">MIDI: {score.title}</option>
            )}
            {BENCHMARK_METADATA.map((bm) => (
              <option key={bm.id} value={bm.id}>
                {bm.composer}: {bm.title}
              </option>
            ))}
          </select>

          {/* Load .mid file button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-2.5 py-1 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 rounded text-xs font-mono border border-neutral-700 transition flex items-center gap-1"
            title="Load user-supplied MIDI file"
          >
            <span>📂</span>
            <span className="hidden md:inline">Load .mid</span>
          </button>

          {/* Play/Pause Button */}
          <button
            onClick={handleTogglePlay}
            className={`px-3 py-1 rounded text-xs font-mono font-bold transition flex items-center gap-1 ${
              isPlaying
                ? 'bg-amber-500 hover:bg-amber-400 text-black'
                : 'bg-white hover:bg-neutral-200 text-black'
            }`}
          >
            <span>{isPlaying ? '⏸' : '▶'}</span>
            <span>{isPlaying ? 'Pause' : 'Play'}</span>
          </button>

          {/* Options Drawer Toggle */}
          <button
            onClick={() => setIsDrawerOpen(!isDrawerOpen)}
            className="p-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 rounded text-xs flex items-center gap-1 border border-neutral-700 font-mono"
            aria-label="Settings"
          >
            <span>⚙</span>
          </button>
        </div>
      </header>

      {/* Main Workbench Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        <main className="flex-1 flex flex-col overflow-hidden relative">
          {/* Timeline Scrub Header */}
          <div className="h-9 bg-black border-b border-neutral-800 px-3 flex items-center justify-between text-xs text-neutral-400 shrink-0">
            <div className="flex items-center gap-2 font-mono">
              <span className="text-amber-400 font-bold">M{measure}</span>
              <span className="text-neutral-700">:</span>
              <span>B{beat}</span>
              <span className="text-neutral-700">:</span>
              <span className="text-neutral-500">+{tickInBeat}t</span>
            </div>

            {/* Scrub Slider */}
            <div className="flex-1 max-w-md mx-3 flex items-center gap-2">
              <input
                type="range"
                min="0"
                max={score.totalTicks}
                value={currentTick}
                onChange={(e) => handleSeek(parseFloat(e.target.value))}
                className="w-full accent-amber-500 h-1 bg-neutral-800 rounded cursor-pointer"
              />
            </div>

            <div className="flex items-center gap-3 text-[11px] font-mono text-neutral-400">
              <span>{score.tempos[0]?.bpm} BPM</span>
              <span className="text-neutral-700">|</span>
              <span>{score.notes.length} notes</span>
            </div>
          </div>

          {/* Notation Canvas Viewport */}
          <NotationCanvas
            score={score}
            options={renderOptions}
            onTickSeek={handleSeek}
            onNoteSelect={(n) => {
              handleSeek(n.startTick);
              synth.playPitch(n.pitch, 0.5, n.velocity || 80);
            }}
          />

          {/* Strict 2-Row Jánko Keyboard Component */}
          <JankoKeyboard
            activePitches={activePitches}
            colorMode={renderOptions.colorMode}
            minOctave={1}
            maxOctave={7}
          />
        </main>

        {/* Controls Sidebar / Drawer */}
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
        />
      </div>
    </div>
  );
};
