import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from 'react';
import { QuantizedGridScore } from '../model/types';
import { BENCHMARK_SCORES } from '../scores';
import { tickToMeasureBeat } from '../model/grid';
import { parseMidiToScore } from '../model/midi';
import { synth } from '../audio/synth';
import { JankoPages, useJankoPages } from './JankoPages';
import { SolfegeGuide } from './SolfegeGuide';
import { checkMidiReadiness, locateTick, tickAtPoint } from './playhead';

const BACH_ID = 'bach-goldberg-var1';
const PDF_URL = `${import.meta.env.BASE_URL}goldberg-variation-1.pdf`;

type View = 'play' | 'sheet' | 'guide';

const VIEW_LABELS = { play: 'Play', sheet: 'Sheet', guide: 'Guide' } as const;

export const Landing: React.FC = () => {
  const [view, setView] = useState<View>('play');
  const [scoreId, setScoreId] = useState<string>(BACH_ID);
  const [score, setScore] = useState<QuantizedGridScore>(
    () => BENCHMARK_SCORES[BACH_ID]()
  );
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [currentTick, setCurrentTick] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [tempoMultiplier, setTempoMultiplier] = useState<number>(1.0);
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  const pages = useJankoPages(score);
  const playhead = useMemo(
    () => locateTick(score, currentTick),
    [score, currentTick]
  );

  useEffect(() => {
    pageRefs.current = [];
  }, [score]);

  useEffect(() => {
    return () => synth.stopAll();
  }, []);

  // MIDI upload -----------------------------------------------------------
  const processMidiFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      if (!buffer) return;
      try {
        const imported = parseMidiToScore(buffer, {
          id: `custom-${Date.now()}`,
          title: file.name.replace(/\.[^/.]+$/, ''),
          composer: 'Imported MIDI',
        });
        const verdict = checkMidiReadiness(imported);
        if (!verdict.ok) {
          setUploadError(
            `That MIDI won't engrave cleanly in v1: ${verdict.reasons.join(' · ')}.`
          );
          return;
        }
        setIsPlaying(false);
        synth.stopAll();
        setScoreId('custom');
        setScore(imported);
        setCurrentTick(0);
        setUploadError(null);
        setView('play');
      } catch (err) {
        console.error('MIDI ingest failed:', err);
        setUploadError('Could not read that file as standard MIDI.');
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  useEffect(() => {
    const over = (e: DragEvent) => {
      e.preventDefault();
      setIsDraggingFile(true);
    };
    const leave = (e: DragEvent) => {
      e.preventDefault();
      setIsDraggingFile(false);
    };
    const drop = (e: DragEvent) => {
      e.preventDefault();
      setIsDraggingFile(false);
      const file = e.dataTransfer?.files?.[0];
      if (file && (file.name.endsWith('.mid') || file.name.endsWith('.midi'))) {
        processMidiFile(file);
      }
    };
    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
    };
  }, [processMidiFile]);

  const handleSelectBach = () => {
    setIsPlaying(false);
    synth.stopAll();
    setScoreId(BACH_ID);
    setScore(BENCHMARK_SCORES[BACH_ID]());
    setCurrentTick(0);
    setUploadError(null);
  };

  // Playback engine --------------------------------------------------------
  const lastTimeRef = useRef<number | null>(null);
  const lastPlayedTickRef = useRef<number>(-1);

  const handleTogglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
      synth.stopAll();
    } else {
      if (currentTick >= score.totalTicks - 1) setCurrentTick(0);
      setIsPlaying(true);
      lastTimeRef.current = performance.now();
      lastPlayedTickRef.current = currentTick - 1;
    }
  };

  const handleSeek = (targetTick: number) => {
    const bounded = Math.max(0, Math.min(score.totalTicks - 1, targetTick));
    setCurrentTick(bounded);
    lastPlayedTickRef.current = bounded - 1;
    const near = score.notes.filter(
      (n) =>
        bounded >= n.startTick &&
        bounded < n.startTick + Math.min(24, n.durationTicks)
    );
    near.forEach((n) => synth.playPitch(n.pitch, 0.4, n.velocity || 80));
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
      setCurrentTick((prev) => {
        const nextTick = prev + dtSec * ticksPerSec;
        if (nextTick >= score.totalTicks) {
          setIsPlaying(false);
          synth.stopAll();
          return 0;
        }
        const intNext = Math.floor(nextTick);
        if (intNext > lastPlayedTickRef.current) {
          score.notes
            .filter(
              (n) =>
                n.startTick > lastPlayedTickRef.current &&
                n.startTick <= intNext
            )
            .forEach((note) => {
              const durSec =
                (note.durationTicks / score.ticksPerBeat) * (60 / bpm);
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

  // Playhead autoscroll -----------------------------------------------------
  useEffect(() => {
    if (view !== 'play') return;
    const scroller = scrollRef.current;
    const pageEl = pageRefs.current[playhead.page];
    const doc = pages[playhead.page];
    if (!scroller || !pageEl || !doc) return;
    const frac = (playhead.topY - doc.vbY) / doc.vbH;
    const y = pageEl.offsetTop + frac * pageEl.clientHeight;
    const margin = scroller.clientHeight * 0.25;
    if (
      y < scroller.scrollTop + margin ||
      y > scroller.scrollTop + scroller.clientHeight - margin
    ) {
      scroller.scrollTo({ top: Math.max(0, y - scroller.clientHeight * 0.35) });
    }
  }, [currentTick, view, playhead, pages]);

  const { measure, beat } = tickToMeasureBeat(Math.floor(currentTick), score);

  const handlePageClick = (page: number, ptX: number, ptY: number) => {
    handleSeek(tickAtPoint(score, page, ptX, ptY));
  };

  return (
    <div className="landing-root fixed inset-0 flex h-[100dvh] w-screen flex-col overflow-hidden bg-white font-sans text-neutral-900 antialiased">
      {/* Drag & drop overlay */}
      {isDraggingFile && (
        <div className="no-print pointer-events-none fixed inset-0 z-50 flex flex-col items-center justify-center border-2 border-dashed border-neutral-400 bg-white/95">
          <span className="font-serif text-xl font-bold">
            Drop a .mid file to engrave and play it
          </span>
          <span className="mt-1 text-sm text-neutral-500">
            v1 engraves the 144-tick grid (3/4 at 48 ticks/beat)
          </span>
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept=".mid,.midi"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) processMidiFile(file);
          e.target.value = '';
        }}
      />

      {/* Header */}
      <header className="landing-chrome sticky top-0 z-40 border-b border-neutral-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
          <div className="mr-auto leading-tight">
            <div className="font-serif text-lg font-bold tracking-tight">
              Iso-Notation
            </div>
            <div className="text-[11px] text-neutral-500">
              Jánko isomorphic engraving
            </div>
          </div>

          <div className="flex overflow-hidden rounded-full border border-neutral-300 text-sm">
            {(['play', 'sheet', 'guide'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-4 py-1.5 transition ${
                  view === v
                    ? 'bg-neutral-900 font-semibold text-white'
                    : 'bg-white text-neutral-600 hover:bg-neutral-100'
                }`}
                aria-pressed={view === v}
              >
                {VIEW_LABELS[v]}
              </button>
            ))}
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="rounded-full border border-neutral-300 px-4 py-1.5 text-sm text-neutral-700 transition hover:bg-neutral-100"
          >
            Upload MIDI
          </button>
        </div>
        <div className="mx-auto max-w-5xl px-4 pb-2">
          <div className="truncate text-sm">
            <span className="font-semibold">{score.title}</span>
            <span className="text-neutral-400"> · </span>
            <span className="text-neutral-500">{score.composer}</span>
            {scoreId === 'custom' && (
              <button
                onClick={handleSelectBach}
                className="ml-3 text-neutral-400 underline-offset-4 hover:text-neutral-700 hover:underline"
              >
                Back to Bach
              </button>
            )}
          </div>
        </div>
      </header>

      {uploadError && (
        <div className="landing-chrome border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          <div className="mx-auto flex max-w-5xl items-start gap-3">
            <span className="flex-1">{uploadError}</span>
            <button
              onClick={() => setUploadError(null)}
              className="font-bold hover:text-red-950"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {view === 'play' ? (
        <>
          {/* Transport */}
          <div className="landing-chrome border-b border-neutral-200 bg-neutral-50">
            <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5">
              <button
                onClick={handleTogglePlay}
                className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-bold transition ${
                  isPlaying
                    ? 'bg-red-700 text-white hover:bg-red-600'
                    : 'bg-neutral-900 text-white hover:bg-neutral-700'
                }`}
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                <span aria-hidden="true">{isPlaying ? '❚❚' : '▶'}</span>
                <span>{isPlaying ? 'Pause' : 'Play'}</span>
              </button>
              <span className="font-mono text-sm text-neutral-600">
                M{measure} : B{beat}
              </span>
              <label className="ml-auto flex items-center gap-2 text-sm text-neutral-500">
                Tempo
                <select
                  value={tempoMultiplier}
                  onChange={(e) => setTempoMultiplier(Number(e.target.value))}
                  className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-800"
                >
                  {[0.5, 0.75, 1, 1.25, 1.5].map((m) => (
                    <option key={m} value={m}>
                      {m}×
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {/* Score with playhead */}
          <div ref={scrollRef} className="landing-scroll min-h-0 flex-1 overflow-y-auto">
            <div className="landing-pages relative mx-auto max-w-3xl px-4 py-6">
              <div className="flex flex-col gap-8">
                <JankoPages
                  pages={pages}
                  pageRefs={pageRefs}
                  pageClassName="janko-page cursor-pointer bg-white shadow-[0_1px_4px_rgba(0,0,0,0.14)] ring-1 ring-neutral-200"
                  onPageClick={handlePageClick}
                  overlay={(pageIndex) =>
                    pageIndex === playhead.page ? (
                      <g>
                        <line
                          x1={playhead.x}
                          y1={playhead.topY}
                          x2={playhead.x}
                          y2={playhead.botY}
                          stroke="#B91C1C"
                          strokeWidth="1.4"
                        />
                        <circle
                          cx={playhead.x}
                          cy={playhead.topY}
                          r="3.2"
                          fill="#B91C1C"
                        />
                      </g>
                    ) : null
                  }
                />
              </div>
            </div>
          </div>
        </>
      ) : view === 'sheet' ? (
        <>
          {/* Sheet toolbar */}
          <div className="landing-chrome border-b border-neutral-200 bg-neutral-50">
            <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-2.5">
              <button
                onClick={() => window.print()}
                className="rounded-full bg-neutral-900 px-5 py-1.5 text-sm font-bold text-white transition hover:bg-neutral-700"
              >
                Print
              </button>
              {scoreId === BACH_ID ? (
                <a
                  href={PDF_URL}
                  download="goldberg-variation-1.pdf"
                  className="rounded-full border border-neutral-300 px-4 py-1.5 text-sm text-neutral-700 transition hover:bg-neutral-100"
                >
                  Download PDF
                </a>
              ) : (
                <span className="text-sm text-neutral-500">
                  Print, or choose “Save as PDF” in the print dialog.
                </span>
              )}
              <span className="ml-auto hidden text-sm text-neutral-400 sm:inline">
                {pages.length} {pages.length === 1 ? 'page' : 'pages'} · A4
              </span>
            </div>
          </div>

          {/* Printable pages */}
          <div className="landing-scroll min-h-0 flex-1 overflow-y-auto bg-neutral-100">
            <div className="landing-pages mx-auto max-w-3xl px-4 py-6">
              <div className="flex flex-col gap-8">
                <JankoPages
                  pages={pages}
                  pageClassName="janko-page bg-white shadow-[0_1px_4px_rgba(0,0,0,0.14)] ring-1 ring-neutral-200"
                />
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Guide */}
          <div className="landing-scroll min-h-0 flex-1 overflow-y-auto">
            <div className="landing-pages mx-auto max-w-3xl px-4 py-6">
              <h2 className="font-serif text-2xl font-bold tracking-tight">
                How to read the sheet
              </h2>
              <p className="mt-1 text-sm text-neutral-500">
                Five facts; everything else reads like standard notation.
              </p>
              <ol className="mt-4 list-decimal space-y-3 pl-5 text-[15px] leading-relaxed marker:font-semibold">
                <li>
                  <strong>Digits are pitch names.</strong> 0–9, A, B count the
                  twelve semitones up from C — 0 is C, 7 is G, A is B♭, B is B.
                </li>
                <li>
                  <strong>Rows are octaves.</strong> Pitch climbs upward across
                  octave rows, 2–5 on the staff, with ledger rows beyond.
                </li>
                <li>
                  <strong>Even and odd live on twin rows.</strong> Each octave
                  spans two whole-tone rows — even digits on one, odd digits
                  on the other.
                </li>
                <li>
                  <strong>Both hands share the rows.</strong> There are no
                  separate staves — a stem up means right hand, down means
                  left.
                </li>
                <li>
                  <strong>Rhythm reads as usual.</strong> Beams group 8ths and
                  16ths, single shorts carry flags, engraved rests mark the
                  silences; solid barlines bound each measure, dashed lines
                  mark the beats, and numerals open each system.
                </li>
              </ol>
              <p className="mt-4 text-sm text-neutral-500">
                In Play view, the red line follows the music — click any
                measure to jump to it.
              </p>

              <p className="mb-3 mt-10 text-sm text-neutral-500">
                Sing the digits — every pitch class has a one-syllable name.
                Click to audition.
              </p>
              <div className="overflow-hidden rounded-2xl">
                <SolfegeGuide onClose={() => setView('play')} />
              </div>
            </div>
          </div>
        </>
      )}

      <footer className="landing-chrome border-t border-neutral-200 py-3 text-center text-xs text-neutral-400">
        Engraved live by the Jánko engine
      </footer>
    </div>
  );
};
