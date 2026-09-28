/** ISO Practice v1: display-only major scale, engraved by the score engine.
 * No studio, DOM, filesystem, or desktop dependency. */
import { fromLinearIndex, wholeToneParity } from '../../model/pitch';
import { QuantizedGridScore } from '../../model/types';
import { layoutJankoScore, renderSystem } from './engine';
import { renderJankoStyleDefs } from './elements/style';
import { DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS, resolveJankoOptions, resolveJankoTokens } from './types';
import { PRACTICE_GOTHIC_DATA } from './practice-font';

export const ISO_PRACTICE_VERSION = '0.1.2';
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
  /** RH pitch retained for contract-1 consumers. */
  pitchLinear: number;
  tick: number;
  x: number;
  hands: { RH: { finger: number; row: number; y: number; pitchLinear: number }; LH: { finger: number; row: number; y: number; pitchLinear: number } };
}
export interface PracticeView {
  svg: string;
  selectionId: string;
  isoVersion: string;
  contractVersion: number;
  guide: PracticeGuide;
  attacks: PracticeAttack[];
  systemCount: number;
  /** Conservative gap from the lowest possible rail digit ink to the engine's
   * staff, notehead, stem and beam envelope (SVG user units). */
  railClearance: number;
}

const STEPS = [0, 2, 4, 5, 7, 9, 11, 12] as const;
const RH = '23412312';
const LH = '43213214';
const EVEN_ROWS = '33324423';
const ODD_ROWS = '22213312';
// The 7pt sans-serif fingers occupy ~9.33 SVG px; seat and guide intervals
// need to be measured against CSS px, not mistaken for 7 viewBox units.
const ROW_STEP = 15;
const FINGER_ASCENT = 7;
const FINGER_DESCENT = 6;
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

/** The same two-hand score feeds both candidates. Descent omits a repeated apex;
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
    totalTicks: 15 * 12, timeSignatures: [], barlines: [], tempos: [], dynamics: [], pedals: [],
    notes: order.flatMap((i, index) => (['RH', 'LH'] as const).map(hand => ({
      id: `practice-${hand}-${index}`, pitch: fromLinearIndex(tonicLinear + STEPS[i] - (hand === 'LH' ? 12 : 0)),
      startTick: index * 12, durationTicks: 12, hand,
    }))),
  };
  return { score, fingers };
}

/** Complete self-contained SVG. Both hand cues follow the same engine x columns. */
export function renderPracticeView(input: PracticeRequest): PracticeView {
  requestValid(input);
  const guide = input.guide ?? 'two-guides';
  const { score, fingers } = resolvePracticeScale(input.tonicLinear);
  const options = resolveJankoOptions({ ...DEFAULT_JANKO_OPTIONS,
    pageWidth: input.width, pageHeight: input.height, measuresPerSystem: 2, systemsPerPage: 1,
    pageMargin: 24, pageMarginLeft: 28, pageMarginRight: 24, pageMarginTop: 90, pageMarginBottom: 0,
    headerHeight: 0, footerHeight: 0, ticksPerMeasure: 96, ticksPerBeat: 48,
    beamGroupTicks: 48, rhythmStyle: 'beamed',
    showMeasureNumbers: false, showTimeSignature: false, showHandLabels: false,
    showOctaveLabels: false, showBeatGrid: false, showHonorHalo: false,
    systemStartStyle: 'none', inferBoundaryRests: false,
    // Literal full-scale pitch positions, no folding when transposed.
    lowPitchFolding: 'literal',
  });
  const tokens = resolveJankoTokens({ ...DEFAULT_JANKO_TOKENS, ticksPerMeasure: 96 });
  const layouts = layoutJankoScore(score, options, tokens);
  if (layouts.length !== 1 || layouts[0].notes.length !== 30) throw new Error('Practice scale does not fit one system');
  const layout = layouts[0];
  const bottomLH = layout.geometry.staffTopY - 50;
  const bottomRH = bottomLH - 54;
  const topRH = bottomRH - 3 * ROW_STEP;
  if (topRH - FINGER_ASCENT < 0) throw new RangeError('Practice rails cannot fit above pitch staff');
  if (layout.beams.length !== 8 || layout.beams.some(b =>
    b.notes.length !== (b.notes[0].startTick === 144 ? 3 : 4) || b.levels.length !== 2 ||
    b.levels[0].level !== 1 || b.levels[1].level !== 2 || b.levels[1].stub))
    throw new Error(`Practice sixteenths must form two-level four-note engine beams (last group: three): ${layout.beams.map(b => b.notes.map(n => n.startTick).join(',')).join(';')}`);
  const positioned = new Map(layout.notes.map(n => [n.note.id, n]));
  const attacks: PracticeAttack[] = fingers.map(({ row, RH, LH }, index) => {
    const rh = positioned.get(`practice-RH-${index}`);
    const lh = positioned.get(`practice-LH-${index}`);
    if (!rh || !lh || Math.abs(rh.x - lh.x) > 1e-6) throw new Error(`Unaligned engine hand notes ${index}`);
    const pitchLinear = input.tonicLinear + STEPS[index <= 7 ? index : 14 - index];
    const y = (bottom: number) => bottom - (row - 1) * ROW_STEP;
    return { index, pitchLinear, tick: index * 12, x: rh.x,
      hands: { RH: { finger: RH, row, y: y(bottomRH), pitchLinear },
        LH: { finger: LH, row, y: y(bottomLH), pitchLinear: pitchLinear - 12 } } };
  });
  // Bound actual painted beams and solved stems, not a quarter-note estimate.
  // This fixture has no ottavas or flags; both hands' beams are included.
  const pitchInkTop = Math.min(layout.geometry.staffTopY - 1,
    ...layout.notes.map(n => n.y - tokens.noteheadRadius - 1),
    ...layout.beams.flatMap(b => [
      ...b.stems.map(s => Math.min(s.stemStartY, s.stemEndY) - 1),
      ...[b.primary, ...b.levels.map(l => l.connector)].map(c => Math.min(c.y1, c.y2) - b.thickness / 2 - 1),
    ]));
  const railClearance = pitchInkTop - (bottomLH + FINGER_DESCENT);
  if (railClearance < 20) throw new RangeError('Practice rail/score clearance failed');
  const left = layout.geometry.staffLeft;
  const right = layout.geometry.staffRight;
  // Each rail has TWO faint boundaries, each midway between adjacent digit
  // seats. Each is 7.5 units from its neighbouring row centres, leaving
  // breathing room for 7pt (~9.33 CSS px) sans-serif ink. No guide crosses a digit.
  const guides = guide === 'two-guides'
    ? [bottomRH, bottomLH].flatMap(bottom => [bottom - ROW_STEP / 2, bottom - 2.5 * ROW_STEP]).map(y =>
      `<line x1="${fmt(left)}" x2="${fmt(right)}" y1="${fmt(y)}" y2="${fmt(y)}" stroke="#384455" stroke-width="0.55"/>`).join('') : '';
  const rail = (hand: 'RH' | 'LH', bottom: number) =>
    `<g class="practice-${hand}" data-hand="${hand}">` +
    `<text x="7" y="${fmt(bottom - 1.5 * ROW_STEP + 2)}" fill="#91A5BE" font-family="sans-serif" font-size="8pt" font-weight="bold">${hand}</text>` +
    attacks.map(attack => `<text data-attack="${attack.index}" data-row="${attack.hands[hand].row}" x="${fmt(attack.x)}" y="${fmt(attack.hands[hand].y + 3)}" text-anchor="middle" fill="#F4C88D" font-family="sans-serif" font-size="7pt" font-weight="600">${attack.hands[hand].finger}</text>`).join('') + '</g>';
  const engine = nightInk(renderSystem(score, layout.geometry, 0, options, tokens, layout));
  const styles = nightInk(renderJankoStyleDefs(tokens));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${input.width}px" height="${input.height}px" viewBox="0 0 ${input.width} ${input.height}" data-practice-version="${PRACTICE_CONTRACT_VERSION}" data-selection="scale:major:${input.tonicLinear}">` +
    `<defs><style>@font-face{font-family:"URW Gothic";src:url(data:font/otf;base64,${PRACTICE_GOTHIC_DATA}) format("opentype");font-weight:700}</style></defs>` +
    styles + `<rect width="100%" height="100%" fill="#000000"/>` + engine +
    `<g class="practice-rails">${guides}${rail('RH', bottomRH)}${rail('LH', bottomLH)}</g></svg>`;
  return { svg, selectionId: `scale:major:${input.tonicLinear}`, isoVersion: ISO_PRACTICE_VERSION,
    contractVersion: PRACTICE_CONTRACT_VERSION, guide, attacks, systemCount: 1, railClearance };
}
