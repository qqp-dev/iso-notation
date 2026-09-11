import React, { useState } from 'react';
import { DUODECIMAL_SOLFEGE, DuodecimalSolfegeDefinition } from '../model/phonetics';
import { synth } from '../audio/synth';

interface SolfegeGuideProps {
  onClose?: () => void;
}

export const SolfegeGuide: React.FC<SolfegeGuideProps> = ({ onClose }) => {
  const [activePc, setActivePc] = useState<number | null>(null);

  const playPitch = (pc: number) => {
    setActivePc(pc);
    synth.playPitch({ pitchClass: pc, octave: 4 }, 0.6, 85);
    setTimeout(() => setActivePc(null), 600);
  };

  const playSequence = async (pcs: number[], intervalMs = 350) => {
    for (const pc of pcs) {
      setActivePc(pc);
      synth.playPitch({ pitchClass: pc, octave: 4 }, 0.4, 85);
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    setActivePc(null);
  };

  return (
    <div className="flex-1 w-full h-full overflow-y-auto bg-black text-neutral-100 p-4 sm:p-8 flex flex-col items-center">
      <div className="w-full max-w-4xl space-y-8 pb-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-neutral-800 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40 px-2 py-0.5 rounded">
                DEFINITIVE PHONETICS
              </span>
              <span className="text-xs font-mono text-neutral-500">12-TET Iso-Notation</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-1">
              Duodecimal Solfège System
            </h1>
            <p className="text-sm text-neutral-400 mt-1">
              The intuitive monosyllabic solfège derived directly from base-12 digits.
            </p>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 hover:text-white rounded-lg border border-neutral-700 font-mono text-xs flex items-center gap-2 transition"
            >
              <span>←</span>
              <span>Back to Score</span>
            </button>
          )}
        </div>

        {/* 12-TET Duodecimal Matrix */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400 font-mono">
              The 12 Chromatic Pitch Classes &amp; Syllables
            </h2>
            <span className="text-xs text-neutral-500 font-mono">Click to audition</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {DUODECIMAL_SOLFEGE.map((entry: DuodecimalSolfegeDefinition) => {
              const isEven = entry.row === 0;
              const isSelected = activePc === entry.pitchClass;

              return (
                <button
                  key={entry.pitchClass}
                  onClick={() => playPitch(entry.pitchClass)}
                  className={`relative p-3.5 rounded-xl border text-left transition flex flex-col justify-between h-32 select-none cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500/20 border-amber-400 ring-2 ring-amber-400/50 scale-[1.03]'
                      : isEven
                      ? 'bg-neutral-950 hover:bg-neutral-900 border-neutral-800 hover:border-neutral-700'
                      : 'bg-neutral-950/60 hover:bg-neutral-900/80 border-neutral-800/80 hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="text-2xl font-bold leading-none"
                      style={{
                        fontFamily: "'URW Gothic', 'Century Gothic', 'ITC Avant Garde Gothic', sans-serif",
                        color: isSelected ? '#FACC15' : isEven ? '#F8FAFC' : '#94A3B8',
                      }}
                    >
                      {entry.digit}
                    </span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
                        isEven
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                      }`}
                    >
                      Row {entry.row}
                    </span>
                  </div>

                  <div>
                    <div
                      className="text-xl font-mono font-bold tracking-tight"
                      style={{ color: isSelected ? '#FACC15' : '#38BDF8' }}
                    >
                      {entry.syllable}
                    </div>
                    <div className="text-[11px] text-neutral-400 font-mono mt-0.5">
                      {entry.derivation}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Structural Breakthroughs & Invariants */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 space-y-2">
            <h3 className="text-sm font-bold text-neutral-200 font-mono flex items-center gap-2">
              <span className="text-amber-400">⚡</span>
              Zero Memorization Overhead
            </h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Traditional solfège imposes an arbitrary 7- or 12-syllable code with accidental modifications.
              In duodecimal solfège, every syllable is a direct, natural phoneme simplification of the spoken
              numeral: <span className="font-mono text-neutral-200">oh → o</span>,{' '}
              <span className="font-mono text-neutral-200">one → wa</span>,{' '}
              <span className="font-mono text-neutral-200">two → tu</span>,{' '}
              <span className="font-mono text-neutral-200">four → fo</span>,{' '}
              <span className="font-mono text-neutral-200">five → fa</span>,{' '}
              <span className="font-mono text-neutral-200">six → si</span>,{' '}
              <span className="font-mono text-neutral-200">seven → se</span>,{' '}
              <span className="font-mono text-neutral-200">eight → e</span>,{' '}
              <span className="font-mono text-neutral-200">nine → na</span>.
              Musicians read numbers and pronounce notes without a translation layer.
            </p>
          </div>

          <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 space-y-2">
            <h3 className="text-sm font-bold text-neutral-200 font-mono flex items-center gap-2">
              <span className="text-blue-400">🎹</span>
              Jánko Whole-Tone Row Parity
            </h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Even numbers belong strictly to <strong className="text-neutral-200">Row 0</strong> (
              <span className="font-mono text-blue-400">o, tu, fo, si, e, a</span>). Odd numbers belong strictly
              to <strong className="text-neutral-200">Row 1</strong> (
              <span className="font-mono text-purple-400">wa, ti, fa, se, na, bi</span>).
              Every semitone step strictly alternates rows (<span className="font-mono text-neutral-200">Even ↔ Odd</span>).
              Every whole-tone step preserves row parity (<span className="font-mono text-neutral-200">Even → Even</span> or{' '}
              <span className="font-mono text-neutral-200">Odd → Odd</span>).
            </p>
          </div>
        </div>

        {/* Interactive Interval Auditioning */}
        <div className="bg-neutral-950 p-5 rounded-xl border border-neutral-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-neutral-200 font-mono uppercase tracking-wider">
              Audition Phrases &amp; Harmonies in Duodecimal Solfège
            </h3>
            <span className="text-[11px] text-neutral-500 font-mono">Click phrase to hear &amp; follow</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <button
              onClick={() => playSequence([0, 4, 7])}
              className="p-3 bg-neutral-900/90 hover:bg-neutral-800/90 border border-neutral-700/60 rounded-lg text-left transition group"
            >
              <div className="text-xs font-bold text-neutral-200 font-mono group-hover:text-amber-400">
                Major Triad (Root - 3rd - 5th)
              </div>
              <div className="text-sm font-mono text-amber-400 font-bold mt-1">
                o → fo → se
              </div>
              <div className="text-[10px] text-neutral-500 font-mono mt-0.5">
                Digits: 0 - 4 - 7 (4st + 3st)
              </div>
            </button>

            <button
              onClick={() => playSequence([0, 7])}
              className="p-3 bg-neutral-900/90 hover:bg-neutral-800/90 border border-neutral-700/60 rounded-lg text-left transition group"
            >
              <div className="text-xs font-bold text-neutral-200 font-mono group-hover:text-amber-400">
                Perfect 5th Landmark
              </div>
              <div className="text-sm font-mono text-amber-400 font-bold mt-1">
                o → se
              </div>
              <div className="text-[10px] text-neutral-500 font-mono mt-0.5">
                Digits: 0 - 7 (7st)
              </div>
            </button>

            <button
              onClick={() => playSequence([0, 6])}
              className="p-3 bg-neutral-900/90 hover:bg-neutral-800/90 border border-neutral-700/60 rounded-lg text-left transition group"
            >
              <div className="text-xs font-bold text-neutral-200 font-mono group-hover:text-amber-400">
                Tritone Axis
              </div>
              <div className="text-sm font-mono text-amber-400 font-bold mt-1">
                o → si
              </div>
              <div className="text-[10px] text-neutral-500 font-mono mt-0.5">
                Digits: 0 - 6 (Row 0 preservation)
              </div>
            </button>

            <button
              onClick={() => playSequence([7, 6, 7, 2, 4, 6, 7, 9, 11, 13, 14, 13, 14])}
              className="p-3 bg-neutral-900/90 hover:bg-neutral-800/90 border border-neutral-700/60 rounded-lg text-left transition group sm:col-span-2 lg:col-span-3"
            >
              <div className="text-xs font-bold text-neutral-200 font-mono group-hover:text-amber-400">
                Bach Goldberg Variation 1 (Opening Theme, mm. 1–2)
              </div>
              <div className="text-sm font-mono text-amber-400 font-bold mt-1">
                se → si → se → tu → fo → si → se → na → bi → wa → tu → wa → tu
              </div>
              <div className="text-[10px] text-neutral-500 font-mono mt-0.5">
                Digits: 7 → 6 → 7 → 2 → 4 → 6 → 7 → 9 → b → 1 → 2 → 1 → 2
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
