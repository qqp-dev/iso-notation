/** ISO Practice v1: display-only major scale, engraved by the score engine.
 * No studio, DOM, filesystem, or desktop dependency. */
import { fromLinearIndex, wholeToneParity } from '../../model/pitch';
import { QuantizedGridScore } from '../../model/types';
import { layoutJankoScore, renderSystem } from './engine';
import { renderJankoStyleDefs } from './elements/style';
import { DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS, resolveJankoOptions, resolveJankoTokens } from './types';
import { PRACTICE_GOTHIC_DATA } from './practice-font';

export const ISO_PRACTICE_VERSION = '0.1.0';
export const PRACTICE_CONTRACT_VERSION = 1;
export type PracticeGuide = 'two-guides' | 'none';
export interface PracticeRequest {
  rudiment: 'scale';
  scaleType: 'major';
  /** C4 = 48; one unit = one 1-span. Supported tonic interval: 36..60. */
  tonicLinear: number;
  /** Available viewport in CSS px; output uses these numbers as SVG user coordinates. */
  width: number;
  height: number;
  guide?: PracticeGuide;
}
export interface PracticeAttack {
  index: number;
  pitchLinear: number;
  tick: number;
  x: number;
  hands: { RH: { finger: number; row: number; y: number }; LH: { finger: number; row: number; y: number } };
}
export interface PracticeView {
  svg: string;
  selectionId: string;
  isoVersion: string;
  contractVersion: number;
  guide: PracticeGuide;
  attacks: PracticeAttack[];
  systemCount: number;
  /** Conservative gap from the lowest possible rail digit seat to the engine's staff top,
   * notehead boxes and quarter-stem tips (SVG user units); not a general linter certificate. */
  railClearance: number;
}

const STEPS = [0, 2, 4, 5, 7, 9, 11, 12] as const;
const RH = '23412312';
const LH = '43213214';
const EVEN_ROWS = '33324423';
const ODD_ROWS = '22213312';
const ROW_STEP = 8;
const fmt = (n: number) => n.toFixed(2);

/** Palette only on this isolated rendered fragment, AFTER engine composition.
 * White knockouts become black paint, rather than transparent holes: staff and
 * duration ink behind them is erased on the same layer as in the original engine. */
function nightInk(svg: string): string {
  const palette: Record<string, string> = {
    '#ffffff': '#000000', '#111111': '#F8FAFC', '#0f172a': '#E2E8F0',
    '#1e293b': '#B8C4D2', '#334155': '#8493A7', '#475569': '#A6B3C5',
    '#64748b': '#738297', '#94a3b8': '#465469', '#cbd5e1': '#384455',
    '#e2e8f0': '#384455', '#111827': '#F8FAFC', '#1a1a1a': '#F8FAFC',
    '#222222': '#E2E8F0', '#333333': '#D1D9E5', '#4b5563': '#A6B3C5',
    '#555555': '#A6B3C5', '#666666': '#94A3B8', '#6b7280': '#94A3B8',
    '#999999': '#738297', '#9ca3af': '#738297',
  };
  return svg.replace(/#[0-9a-fA-F]{6}\b/g, color => {
    const mapped = palette[color.toLowerCase()];
    if (!mapped) throw new Error(`Unmapped Practice engine ink: ${color}`);
    return mapped;
  });
}

function requestValid(input: PracticeRequest): void {
  if (input?.rudiment !== 'scale' || input.scaleType !== 'major') throw new RangeError('Practice v1 supports only scale / major');
  if (!Number.isInteger(input.tonicLinear) || input.tonicLinear < 36 || input.tonicLinear > 60)
    throw new RangeError('tonicLinear must be an integer from 36 to 60');
  if (!Number.isFinite(input.width) || input.width < 560 || input.width > 1600 ||
      !Number.isFinite(input.height) || input.height < 360 || input.height > 900)
    throw new RangeError('Practice viewport must be 560..1600 wide and 360..900 high');
  if (input.guide !== undefined && input.guide !== 'two-guides' && input.guide !== 'none')
    throw new RangeError('Unknown Practice guide treatment');
}

/** The same one-note score feeds both candidates. Descent omits a repeated apex;
 * the supplied fingers/rows for ascent indices 6..0 are reversed provisionally. */
export function resolvePracticeScale(tonicLinear: number): { score: QuantizedGridScore; fingers: { RH: number; LH: number; row: number }[] } {
  if (!Number.isInteger(tonicLinear) || tonicLinear < 36 || tonicLinear > 60) throw new RangeError('Unsupported tonic');
  const rows = wholeToneParity(tonicLinear) === 0 ? EVEN_ROWS : ODD_ROWS;
  const order = [...STEPS.keys(), ...[6, 5, 4, 3, 2, 1, 0]];
  const fingers = order.map(i => {
    const row = Number(rows[i]);
    const pitch = tonicLinear + STEPS[i];
    // Physical four-row keyboard: odd pitches occupy rows 2/4; evens 1/3.
    if (row < 1 || row > 4 || (row % 2 !== 1 - wholeToneParity(pitch)))
      throw new Error(`Illegal physical row ${row} at ${pitch}`);
    return { RH: Number(RH[i]), LH: Number(LH[i]), row };
  });
  const score: QuantizedGridScore = {
    id: `practice-major-${tonicLinear}`, title: '', composer: '', ticksPerBeat: 48,
    totalTicks: 15 * 48, timeSignatures: [], barlines: [], tempos: [], dynamics: [], pedals: [],
    notes: order.map((i, index) => ({
      id: `practice-${index}`, pitch: fromLinearIndex(tonicLinear + STEPS[i]),
      startTick: index * 48, durationTicks: 48, hand: 'RH' as const,
    })),
  };
  return { score, fingers };
}

/** Complete self-contained SVG. Both hand cues follow the same engine x columns. */
export function renderPracticeView(input: PracticeRequest): PracticeView {
  requestValid(input);
  const guide = input.guide ?? 'two-guides';
  const { score, fingers } = resolvePracticeScale(input.tonicLinear);
  const options = resolveJankoOptions({ ...DEFAULT_JANKO_OPTIONS,
    pageWidth: input.width, pageHeight: input.height, measuresPerSystem: 5, systemsPerPage: 1,
    pageMargin: 24, pageMarginLeft: 28, pageMarginRight: 24, pageMarginTop: 0, pageMarginBottom: 0,
    headerHeight: 0, footerHeight: 0, ticksPerMeasure: 144, ticksPerBeat: 48,
    showMeasureNumbers: false, showTimeSignature: false, showHandLabels: false,
    showOctaveLabels: false, showBeatGrid: false, showHonorHalo: false,
    systemStartStyle: 'none', inferBoundaryRests: false,
    // Literal full-scale pitch positions, no folding when transposed.
    lowPitchFolding: 'literal',
  });
  const tokens = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
  const layouts = layoutJankoScore(score, options, tokens);
  if (layouts.length !== 1 || layouts[0].notes.length !== 15) throw new Error('Practice scale does not fit one system');
  const layout = layouts[0];
  const bottomLH = layout.geometry.staffTopY - 42;
  const bottomRH = bottomLH - 47;
  const topRH = bottomRH - 3 * ROW_STEP;
  if (topRH - 7 < 0) throw new RangeError('Practice rails cannot fit above pitch staff');
  const positioned = new Map(layout.notes.map(n => [n.note.id, n]));
  const attacks: PracticeAttack[] = score.notes.map((note, index) => {
    const placed = positioned.get(note.id);
    if (!placed) throw new Error(`Missing engine note ${note.id}`);
    const { row, RH, LH } = fingers[index];
    const y = (bottom: number) => bottom - (row - 1) * ROW_STEP;
    return { index, pitchLinear: note.pitch.octave * 12 + note.pitch.pitchClass,
      tick: note.startTick, x: placed.x,
      hands: { RH: { finger: RH, row, y: y(bottomRH) }, LH: { finger: LH, row, y: y(bottomLH) } } };
  });
  // One-note-per-quarter RH score: upper stem ends y - stemLength; the
  // 1-unit pad bounds stroke and the head/line ink. This does not certify
  // arbitrary engine scores, flags, beams, ottavas or future overlays.
  const pitchInkTop = Math.min(layout.geometry.staffTopY - 1,
    ...layout.notes.map(n => Math.min(n.y - tokens.stemLength - 1, n.y - tokens.noteheadRadius - 1)));
  const railClearance = pitchInkTop - (bottomLH + 4);
  if (railClearance < 20) throw new RangeError('Practice rail/score clearance failed');
  const left = layout.geometry.staffLeft;
  const right = layout.geometry.staffRight;
  // Each rail has TWO faint boundaries, each midway between adjacent digit
  // seats. Nearest digit centre is 4 units away; the glyph's 3-unit half-height
  // leaves a full unit of air. No guide crosses a numbered finger.
  const guides = guide === 'two-guides'
    ? [bottomRH, bottomLH].flatMap(bottom => [bottom - ROW_STEP / 2, bottom - 2.5 * ROW_STEP]).map(y =>
      `<line x1="${fmt(left)}" x2="${fmt(right)}" y1="${fmt(y)}" y2="${fmt(y)}" stroke="#384455" stroke-width="0.55"/>`).join('') : '';
  const rail = (hand: 'RH' | 'LH', bottom: number) =>
    `<g class="practice-${hand}" data-hand="${hand}">` +
    `<text x="7" y="${fmt(bottom - 1.5 * ROW_STEP + 2)}" fill="#91A5BE" font-family="sans-serif" font-size="8pt" font-weight="bold">${hand}</text>` +
    attacks.map(attack => `<text data-attack="${attack.index}" data-row="${attack.hands[hand].row}" x="${fmt(attack.x)}" y="${fmt(attack.hands[hand].y + 2.4)}" text-anchor="middle" fill="#F4C88D" font-family="sans-serif" font-size="7pt" font-weight="600">${attack.hands[hand].finger}</text>`).join('') + '</g>';
  const engine = nightInk(renderSystem(score, layout.geometry, 0, options, tokens, layout));
  const styles = nightInk(renderJankoStyleDefs(tokens));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${input.width}px" height="${input.height}px" viewBox="0 0 ${input.width} ${input.height}" data-practice-version="${PRACTICE_CONTRACT_VERSION}" data-selection="scale:major:${input.tonicLinear}">` +
    `<defs><style>@font-face{font-family:"URW Gothic";src:url(data:font/otf;base64,${PRACTICE_GOTHIC_DATA}) format("opentype");font-weight:700}</style></defs>` +
    styles + `<rect width="100%" height="100%" fill="#000000"/>` + engine +
    `<g class="practice-rails">${guides}${rail('RH', bottomRH)}${rail('LH', bottomLH)}</g></svg>`;
  return { svg, selectionId: `scale:major:${input.tonicLinear}`, isoVersion: ISO_PRACTICE_VERSION,
    contractVersion: PRACTICE_CONTRACT_VERSION, guide, attacks, systemCount: 1, railClearance };
}
