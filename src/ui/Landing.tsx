import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { QuantizedGridScore } from '../model/types';
import { initialActiveData, resolveActiveScore, type ActiveData } from '../scores/active';
import prepared from 'virtual:janko-prepared-manifest';
import { watchDeployedRelease } from '../render/janko/prepared/deployed';
import { tickToMeasureBeat } from '../model/grid';
import { synth } from '../audio/synth';
import { JankoPages, useJankoPages } from './JankoPages';
import { PlayersGuide } from './PlayersGuide';
import { locateTick, tickAtPoint } from './playhead';

const BACH_ID = 'bach-goldberg-var1';

type View = 'play' | 'sheet' | 'guide';

const VIEW_LABELS = { play: 'Play', sheet: 'Sheet', guide: 'Guide' } as const;

export const Landing: React.FC = () => {
  const [view, setView] = useState<View>('play');
  const [activeData, setActiveData] = useState<ActiveData>(initialActiveData);
  const [score, setScore] = useState<QuantizedGridScore>(() => resolveActiveScore(BACH_ID).score);
  const [pdfUrl, setPdfUrl] = useState<string | null>(import.meta.env.PROD ? null : `${import.meta.env.BASE_URL}goldberg-variation-1.pdf`);
  const [releaseStatus, setReleaseStatus] = useState('Verifying deployed score and PDF…');
  useEffect(() => {
    if (!import.meta.env.PROD) return;
    return watchDeployedRelease(new URL(`${import.meta.env.BASE_URL}active-release.json`, window.location.href).href,
      release => {
        const parsed = JSON.parse(release.data) as ActiveData;
        const next = resolveActiveScore(BACH_ID, parsed);
        if (next.revision !== release.manifest.canonicalRevisions[BACH_ID]) throw new Error('root score revision mismatch');
        synth.stopAll();
        setIsPlaying(false);
        setActiveData(parsed);
        setScore(next.score);
        setPdfUrl(release.pdfUrl);
        setReleaseStatus(`Deployed · ${next.revision.slice(0, 12)}`);
      }, error => setReleaseStatus(`Stale · ${error.message}`), prepared.engineIdentity ?? 'unknown');
  }, []);
  const [currentTick, setCurrentTick] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [tempoMultiplier, setTempoMultiplier] = useState<number>(1.0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  const pages = useJankoPages(score, activeData);
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
      {/* Header */}
      <header className="landing-chrome sticky top-0 z-40 border-b border-neutral-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
          <div className="mr-auto leading-tight">
            <div className="font-serif text-lg font-bold tracking-tight">
              Iso-Notation
            </div>
            <div className="text-[11px] text-neutral-500">
              Jánko isomorphic engraving{import.meta.env.PROD ? ` · ${releaseStatus}` : ''}
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

        </div>
        <div className="mx-auto max-w-5xl px-4 pb-2">
          <div className="truncate text-sm">
            <span className="font-semibold">{score.title}</span>
            <span className="text-neutral-400"> · </span>
            <span className="text-neutral-500">{score.composer}</span>
          </div>
        </div>
      </header>

      <section className="landing-chrome shrink-0 border-b border-neutral-200 bg-neutral-50" aria-labelledby="no14-title">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
          <div className="mr-auto leading-snug">
            <h2 id="no14-title" className="font-serif text-lg font-semibold">No. 14 · Kleine Studie</h2>
            <p className="text-sm text-neutral-600">Robert Schumann · Album für die Jugend · Op. 68</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={`${import.meta.env.BASE_URL}janko.html?score=schumann-op68-no14-gold#reference`}
              className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-2">
              View score
            </a>
            <a href={`${import.meta.env.BASE_URL}schumann-op68-no14-gold.pdf`} download="schumann-op68-no14-gold.pdf"
              className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm text-neutral-700 transition hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2">
              Download PDF
            </a>
          </div>
        </div>
      </section>

      {import.meta.env.PROD && !pdfUrl && view !== 'guide' ? (
        <div className="landing-scroll min-h-0 flex-1 overflow-y-auto p-6" role="status">{releaseStatus}</div>
      ) : view === 'play' ? (
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
                <span aria-hidden="true">{isPlaying ? '❚❚' : '▶︎'}</span>
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
              {pdfUrl ? <a
                href={pdfUrl}
                download="goldberg-variation-1.pdf"
                className="rounded-full border border-neutral-300 px-4 py-1.5 text-sm text-neutral-700 transition hover:bg-neutral-100"
              >Download PDF</a> : <span role="status">Verifying matching PDF…</span>}
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
            <div className="landing-pages">
              <PlayersGuide onClose={() => setView('play')} />
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
