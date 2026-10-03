import React, { useMemo } from 'react';
import {
  DUODECIMAL_SOLFEGE,
} from '../model/phonetics';
import { DUODECIMAL_DIGITS } from '../render/types';
import { BENCHMARK_SCORES } from '../scores';
import {
  DEFAULT_JANKO_OPTIONS,
  DEFAULT_JANKO_TOKENS,
} from '../render/janko/types';
import { FIXED_3_ROW_DEFS } from '../render/janko/elements/staff';
import { REST_MARK_COUNT } from '../render/janko/elements/rests';
import { subdivisionMarkCount } from '../render/janko/elements/rhythm';
import { renderJankoCrop, renderJankoPage } from '../render/janko/engine';
import {
  GUIDE_REST_JANKO_OPTIONS,
  GUIDE_REST_JANKO_TOKENS,
  GUIDE_REST_TICKS_PER_MEASURE,
  GUIDE_TICKS_PER_MEASURE,
  buildGuideHandsSpecimen,
  buildGuidePitchSpecimen,
  buildGuideRestSpecimen,
  buildGuideRhythmSpecimen,
  handThread,
  threadDigitString,
  threadSyllableString,
} from './guide-specimens';

/** Chromatic note names for the twelve pitch classes (0 = C). */
const NOTE_NAMES = [
  'C',
  'C♯',
  'D',
  'D♯',
  'E',
  'F',
  'F♯',
  'G',
  'G♯',
  'A',
  'B♭',
  'B',
] as const;

interface PlayersGuideProps {
  onClose?: () => void;
}

/** One real-engine figure: engraved SVG plus a caption proven against it. */
const GuideFigure: React.FC<{
  svg: string;
  caption: React.ReactNode;
  label: string;
}> = ({ svg, caption, label }) => (
  <figure className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
    <div
      className="[&_svg]:block [&_svg]:h-auto [&_svg]:w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
      role="img"
      aria-label={label}
    />
    <figcaption className="border-t border-neutral-100 px-3 py-2 text-[13px] leading-snug text-neutral-500">
      {caption}
    </figcaption>
  </figure>
);

const Section: React.FC<{
  index: string;
  title: string;
  children: React.ReactNode;
}> = ({ index, title, children }) => (
  <section className="scroll-mt-4">
    <div className="flex items-baseline gap-3">
      <span className="font-mono text-xs font-bold text-neutral-400">
        {index}
      </span>
      <h2 className="font-serif text-xl font-bold tracking-tight text-neutral-900">
        {title}
      </h2>
    </div>
    <div className="mt-3 space-y-4 text-[15px] leading-relaxed text-neutral-700">
      {children}
    </div>
  </section>
);

export const PlayersGuide: React.FC<PlayersGuideProps> = ({ onClose }) => {
  const engraving = useMemo(() => {
    const bach = BENCHMARK_SCORES['bach-goldberg-var1']();
    const pitch = buildGuidePitchSpecimen();
    const rhythm = buildGuideRhythmSpecimen();
    const hands = buildGuideHandsSpecimen();
    const rests = buildGuideRestSpecimen();
    const m1RH = handThread(bach, 0, 'RH', GUIDE_TICKS_PER_MEASURE);
    const m1LH = handThread(bach, 0, 'LH', GUIDE_TICKS_PER_MEASURE);
    return {
      pitchSvg: renderJankoCrop(
        pitch,
        1,
        1,
        DEFAULT_JANKO_OPTIONS,
        DEFAULT_JANKO_TOKENS,
        'chromatic octave C4–B4'
      ),
      pitchDigits: threadDigitString(handThread(pitch, 0, 'RH')),
      rhythmSvg: renderJankoCrop(
        rhythm,
        1,
        1,
        DEFAULT_JANKO_OPTIONS,
        DEFAULT_JANKO_TOKENS,
        'beams, flags, dots, bare stems'
      ),
      restsSvg: renderJankoCrop(
        rests,
        1,
        5,
        GUIDE_REST_JANKO_OPTIONS,
        GUIDE_REST_JANKO_TOKENS,
        'one silence per value'
      ),
      handsSvg: renderJankoCrop(
        hands,
        1,
        1,
        DEFAULT_JANKO_OPTIONS,
        DEFAULT_JANKO_TOKENS,
        'stems, bracket, unison'
      ),
      pageSvg: renderJankoPage(
        bach,
        0,
        DEFAULT_JANKO_OPTIONS,
        DEFAULT_JANKO_TOKENS
      ),
      barSvg: renderJankoCrop(
        bach,
        1,
        1,
        DEFAULT_JANKO_OPTIONS,
        DEFAULT_JANKO_TOKENS,
        'right hand opens se si se …'
      ),
      m1RH,
      m1LH,
      m1RHDigits: threadDigitString(m1RH),
      m1RHSyllables: threadSyllableString(m1RH),
      m1LHDigits: threadDigitString(m1LH),
      m1LHSyllables: threadSyllableString(m1LH),

    };
  }, []);

  // The fixed three C-lines, named live from the staff grammar: lin 36/48/60
  // are the C's of octaves 3/4/5, and the lin-48 line is the anchor.
  const coreLines = useMemo(
    () =>
      FIXED_3_ROW_DEFS.filter((d) => d.fires([])).map((d) => ({
        name: `C${d.lin / 12}`,
        anchor: d.isAnchor,
      })),
    []
  );
  const anchorLine = coreLines.find((l) => l.anchor)?.name ?? 'C4';

  // Hook/lobe counts, derived live from the engine grammars: flags stack one
  // mark per subdivision (8th = 1 … 64th = 4), rests grow one lobe per mark.
  const flagCounts = useMemo(
    () =>
      [24, 12, 6, 3].map((ticks) => subdivisionMarkCount(ticks).toString()),
    []
  );
  const restLobes = useMemo(
    () =>
      (['eighth', 'sixteenth', 'thirty-second', 'sixty-fourth'] as const).map(
        (value) => REST_MARK_COUNT[value].toString()
      ),
    []
  );


  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <div className="space-y-12 pb-8">
        {/* Header */}
        <div className="flex flex-col gap-4 border-b border-neutral-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="font-mono text-xs font-bold tracking-wide text-neutral-500">
              PLAYER&rsquo;S GUIDE
            </div>
            <h1 className="mt-1 font-serif text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
              How to read this notation
            </h1>
            <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-neutral-600">
              You already read music. Height is pitch, time flows left to
              right, note values exist. What follows is only the transfer:
              what each familiar thing looks like here.
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="shrink-0 rounded-full border border-neutral-300 px-4 py-2 font-mono text-xs text-neutral-700 transition hover:bg-neutral-100"
            >
              ← Back to Score
            </button>
          )}
        </div>

        {/* 1 · Orientation */}
        <Section index="01" title="Thirty seconds, three ideas">
          <ol className="list-decimal space-y-3 pl-5 marker:font-semibold marker:text-neutral-900">
            <li>
              <strong className="text-neutral-900">
                Height is pitch, left to right is time.
              </strong>{' '}
              Every semitone stands on its own height — higher on the page is
              always higher in pitch. There are no clefs: three fixed C-lines
              say where you are.
            </li>
            <li>
              <strong className="text-neutral-900">
                The digit inside each note names the pitch.
              </strong>{' '}
              0–9, A, B count the twelve semitones up from C. Read the digit
              for the note name, the height for the octave.
            </li>
            <li>
              <strong className="text-neutral-900">
                Everything else is familiar.
              </strong>{' '}
              Beams, flags, dots and rests work as usual; both hands share one
              staff, and stem direction tells them apart.
            </li>
          </ol>
        </Section>

        {/* 2 · Pitch */}
        <Section index="02" title="Reading pitch">
          <p>
            Each notehead carries its duodecimal digit — the twelve pitch
            classes counted up from C, with A and B for the tenth and eleventh
            semitones:
          </p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {DUODECIMAL_DIGITS.map((digit, pc) => (
              <div
                key={pc}
                className="rounded-lg border border-neutral-200 bg-white px-2 py-2 text-center"
              >
                <div className="font-mono text-xl font-bold text-neutral-900">
                  {digit}
                </div>
                <div className="mt-0.5 text-xs font-semibold text-neutral-600">
                  {NOTE_NAMES[pc]}
                </div>
                <div className="font-mono text-[11px] text-neutral-400">
                  {DUODECIMAL_SOLFEGE[pc].syllable}
                </div>
              </div>
            ))}
          </div>
          <p>
            Height does the rest. Every semitone stands one equal step above
            its neighbour, so contour and transposition read by eye: an
            ascending line climbs, a transposed passage keeps its shape. The
            staff draws three fixed C-lines —{' '}
            {coreLines.map((l) => l.name).join(', ')} — and the middle one is
            always middle {anchorLine}: C4 heads sit exactly on it.
          </p>
          <GuideFigure
            svg={engraving.pitchSvg}
            label="Chromatic octave C4 to B4 in isomorphic notation"
            caption={
              <>
                A chromatic octave climbing C4–B4, engraved by the real
                engine. Twelve equal steps, twelve digits:{' '}
                <span className="font-mono">{engraving.pitchDigits}</span>.
                The middle line through the opening C is middle C.
              </>
            }
          />
          <p>
            Outer C-lines (C2 below, C6 above) print only in bars whose music
            reaches them — most bars show just the fixed three. The left hand
            marking C3 on each beat above sits exactly on the lowest one.
          </p>
        </Section>

        {/* 3 · Rhythm */}
        <Section index="03" title="Reading rhythm">
          <p>
            Short values beam together when they share a hand, a beat, and an
            unbroken run: one strip for 8ths, two for 16ths, and so on. A
            short note left alone carries hooks at its stem tip instead —{' '}
            {flagCounts[0]} for an 8th, {flagCounts[1]} for a 16th,{' '}
            {flagCounts[2]} for a 32nd, {flagCounts[3]} for a 64th. Quarters
            and longer values take bare stems. A bare stem means quarter or
            longer: a lone long note carries no mark of its own — a long value
            is only ever spelled out on a chord bracket, as an open ring for
            half and whole — so a single long reads exactly like a quarter.
          </p>
          <p>
            A dotted 8th pairs its hook with a dot. The dot sits right of its
            head like any augmentation dot; where a flag stands in the way it
            steps right first, then up — never left, never down — so the dot
            always stays on its note&rsquo;s height.
          </p>
          <GuideFigure
            svg={engraving.rhythmSvg}
            label="Beamed sixteenths, dotted eighth, and quarter in isomorphic notation"
            caption={
              <>
                One bar, three beats: four beamed 16ths, a flagged dotted 8th
                with its dot stepping clear, a bare-stem quarter.
              </>
            }
          />
          <p>
            Rests are the classical shapes. Hooked rests count their value in
            lobes — {restLobes[0]} for an 8th, {restLobes[1]} for a 16th,{' '}
            {restLobes[2]} for a 32nd, {restLobes[3]} for a 64th — the quarter
            rest is the serpentine slash, and the two slabs read by contact:
            the half rest sits on its line, the whole rest hangs from its
            line, centred in a fully silent bar.
          </p>
          <GuideFigure
            svg={engraving.restsSvg}
            label="Quarter, half, whole, eighth and sixteenth rests in isomorphic notation"
            caption={
              <>
                Five bars, one silence per value: quarter, half, whole-bar,
                8th, 16th. (Engraved in 4/4 — the whole-bar slab needs a full
                bar to hang in.)
              </>
            }
          />
        </Section>

        {/* 4 · Hands */}
        <Section index="04" title="Which hand">
          <p>
            Both hands share one staff — there are no separate staves — and
            the stem says who plays: <strong>up is right hand, down is left
            hand</strong>. Height never depends on the hand, so a low note
            with an up-stem is simply the right hand playing low.
          </p>
          <p>
            One hand&rsquo;s chord gets a single bracket instead of a forest
            of stems, carrying the chord&rsquo;s value where the stems would
            agree. And when both hands strike the same pitch at the same
            moment, you see a single digit: one onset plus one pitch is one
            sound.
          </p>
          <GuideFigure
            svg={engraving.handsSvg}
            label="Opposed stems, chord bracket, and merged unison in isomorphic notation"
            caption={
              <>
                One bar, three beats: opposed stems at opposite ends of the
                staff, a bracketed three-note chord, a single digit where both
                hands strike G4 together.
              </>
            }
          />
        </Section>

        {/* 5 · Navigation */}
        <Section index="05" title="Finding your place">
          <p>
            Systems hold {DEFAULT_JANKO_OPTIONS.measuresPerSystem} bars each;
            pages hold {DEFAULT_JANKO_OPTIONS.systemsPerPage} systems. Each
            system opens with its first bar number, tucked in the left margin
            just above the staff — those numerals are the only bar numbers on
            the page. Solid barlines bound each measure, dashed pulses mark
            the beats, and the final barline seals the last page.
          </p>
          <p>
            Page 1 carries the title block — {DEFAULT_JANKO_OPTIONS.title},{' '}
            {DEFAULT_JANKO_OPTIONS.subtitle}, {DEFAULT_JANKO_OPTIONS.composer}{' '}
            — while later pages carry a one-line running header instead.
          </p>
          <GuideFigure
            svg={engraving.pageSvg}
            label="First page of the Goldberg Variation 1 engraving"
            caption={
              <>
                Page 1 of the Goldberg Variations, Var. 1: title block, four
                numbered systems, beat pulses inside every bar.
              </>
            }
          />
        </Section>

        {/* 6 · First bar */}
        <Section index="06" title="Read your first bar">
          <p>
            Bach&rsquo;s opening bar, exactly as engraved. Both hands start on
            7 — the same digit at two heights, two octaves apart — and the
            right hand&rsquo;s thread runs{' '}
            <span className="font-mono font-semibold text-neutral-900">
              {engraving.m1RHDigits}
            </span>
            , the left&rsquo;s{' '}
            <span className="font-mono font-semibold text-neutral-900">
              {engraving.m1LHDigits}
            </span>
            :
          </p>
          <GuideFigure
            svg={engraving.barSvg}
            label="Bach Goldberg Variation 1 measure 1 in isomorphic notation"
            caption={
              <>
                Measure 1, both hands. Right hand:{' '}
                <span className="font-mono">{engraving.m1RHSyllables}</span>;
                left hand:{' '}
                <span className="font-mono">{engraving.m1LHSyllables}</span>.
              </>
            }
          />
          <ol className="list-decimal space-y-3 pl-5 marker:font-semibold marker:text-neutral-900">
            <li>
              <strong className="text-neutral-900">Beat 1.</strong> Right
              hand: two beamed 16ths (<span className="font-mono">se si</span>
              ), then a dotted 8th (<span className="font-mono">se</span>) with
              its flag and dot. Left hand: an 8th and two 16ths (
              <span className="font-mono">se bi na</span>) under one beam.
            </li>
            <li>
              <strong className="text-neutral-900">Beat 2.</strong> Right
              hand: three beamed 16ths (<span className="font-mono">tu fo
              si</span>). Left hand: two beamed 8ths (
              <span className="font-mono">bi se</span>).
            </li>
            <li>
              <strong className="text-neutral-900">Beat 3.</strong> Right
              hand: four beamed 16ths climbing (
              <span className="font-mono">se na bi wa</span>). Left hand: two
              beamed 8ths (<span className="font-mono">se se</span>).
            </li>
          </ol>
          <p>
            That is the whole system: digits for names, heights for octaves,
            beams for shorts, stems for hands. Everything after this bar is
            more of the same.
          </p>
        </Section>

      </div>
    </div>
  );
};
