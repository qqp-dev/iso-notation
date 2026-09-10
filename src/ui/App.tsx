import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { QuantizedGridScore, QuantizedNote, PitchCoordinate } from '../model/types';
import { RenderOptions } from '../render/types';
import { BENCHMARK_SCORES, BENCHMARK_METADATA } from '../scores';
import { getActiveNotesAtTick, tickToMeasureBeat } from '../model/grid';
import { synth } from '../audio/synth';
import { NotationCanvas } from './NotationCanvas';
import { JankoKeyboard } from './JankoKeyboard';
import { ControlsDrawer } from './ControlsDrawer';
import { HandShapeIsomorphism } from './HandShapeIsomorphism';
import { GridInspector } from './GridInspector';

export const App: React.FC = () => {
  const [selectedScoreId, setSelectedScoreId] = useState<string>('bach-goldberg-var1');
  const [score, setScore] = useState<QuantizedGridScore>(() => BENCHMARK_SCORES['bach-goldberg-var1']());

  const [currentTick, setCurrentTick] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [tempoMultiplier, setTempoMultiplier] = useState<number>(1.0);

  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [showHandShapeModal, setShowHandShapeModal] = useState<boolean>(false);
  const [showInspectorModal, setShowInspectorModal] = useState<boolean>(false);

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
    showDynamics: true,
    showPedals: true,
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

    // Trigger immediate sound preview for notes starting at this tick
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
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans select-none">
      {/* Top Application Bar */}
      <header className="h-13 bg-slate-900 border-b border-slate-800 px-3 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎹</span>
            <span className="font-extrabold tracking-tight text-white text-sm md:text-base">
              iso-notation
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-800 text-[11px] text-slate-300 border border-slate-700">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Tailscale: 100.102.70.49:5173</span>
          </div>
        </div>

        {/* Score Selector & Quick Controls */}
        <div className="flex items-center gap-2">
          <select
            value={selectedScoreId}
            onChange={(e) => handleSelectScore(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500 max-w-[150px] sm:max-w-xs truncate"
          >
            {BENCHMARK_METADATA.map((bm) => (
              <option key={bm.id} value={bm.id}>
                {bm.composer}: {bm.title}
              </option>
            ))}
          </select>

          {/* Quick Play/Pause Button */}
          <button
            onClick={handleTogglePlay}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow ${
              isPlaying
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            <span>{isPlaying ? '⏸' : '▶'}</span>
            <span className="hidden md:inline">{isPlaying ? 'Pause' : 'Play'}</span>
          </button>

          {/* Open Drawer / Settings Toggle */}
          <button
            onClick={() => setIsDrawerOpen(!isDrawerOpen)}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs flex items-center gap-1 border border-slate-700"
            aria-label="Settings"
          >
            <span>⚙️</span>
            <span className="hidden md:inline text-[11px]">Options</span>
          </button>
        </div>
      </header>

      {/* Main Workbench Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left/Center Notation & Keyboard Area */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          {/* Timeline Scrub Header */}
          <div className="h-9 bg-slate-900/90 border-b border-slate-800/80 px-3 flex items-center justify-between text-xs text-slate-400 shrink-0">
            <div className="flex items-center gap-2 font-mono">
              <span className="text-amber-400 font-bold">M{measure}</span>
              <span className="text-slate-600">:</span>
              <span>Beat {beat}</span>
              <span className="text-slate-600">:</span>
              <span className="text-slate-400">+{tickInBeat}t</span>
            </div>

            {/* Scrub Slider */}
            <div className="flex-1 max-w-md mx-3 flex items-center gap-2">
              <input
                type="range"
                min="0"
                max={score.totalTicks}
                value={currentTick}
                onChange={(e) => handleSeek(parseFloat(e.target.value))}
                className="w-full accent-amber-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
              />
            </div>

            <div className="flex items-center gap-2 text-[11px]">
              <span className="hidden sm:inline font-mono">{score.tempos[0]?.bpm} BPM</span>
              <button
                onClick={() => setShowHandShapeModal(true)}
                className="px-2 py-0.5 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 rounded border border-amber-500/40 text-[10px] font-semibold"
              >
                📐 Isomorphism
              </button>
              <button
                onClick={() => setShowInspectorModal(true)}
                className="px-2 py-0.5 bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 rounded border border-sky-500/40 text-[10px] font-semibold"
              >
                🔬 Inspector
              </button>
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

          {/* Synchronized 4-Row Jánko Keyboard Component */}
          <JankoKeyboard
            activePitches={activePitches}
            colorMode={renderOptions.colorMode}
            minOctave={1}
            maxOctave={7}
            showHandShape={true}
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
          onOpenHandShapeModal={() => setShowHandShapeModal(true)}
          onOpenInspectorModal={() => setShowInspectorModal(true)}
        />
      </div>

      {/* Modal: Hand-Shape Isomorphism Engine */}
      {showHandShapeModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-xl">
            <button
              onClick={() => setShowHandShapeModal(false)}
              className="absolute -top-3 -right-3 w-7 h-7 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-full flex items-center justify-center shadow-lg border border-slate-600 text-sm z-10"
            >
              ✕
            </button>
            <HandShapeIsomorphism />
          </div>
        </div>
      )}

      {/* Modal: Quantized Grid Inspector */}
      {showInspectorModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-xl">
            <button
              onClick={() => setShowInspectorModal(false)}
              className="absolute -top-3 -right-3 w-7 h-7 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-full flex items-center justify-center shadow-lg border border-slate-600 text-sm z-10"
            >
              ✕
            </button>
            <GridInspector score={score} currentTick={Math.floor(currentTick)} />
          </div>
        </div>
      )}
    </div>
  );
};
