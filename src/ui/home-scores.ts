import type { JankoPageDoc } from './JankoPages';
import no14 from '../render/janko/no14-published-profile.json';

export const HOME_SCORES = [
  { id: 'bach-goldberg-var1', reference: 'primary', label: 'Bach · Goldberg Variation 1',
    title: 'Goldberg Variations, BWV 988 · Variation 1', composer: 'J. S. Bach', playable: true,
    pdf: 'goldberg-variation-1.pdf' },
  { id: 'brahms-op118-no1', reference: 'brahms-op118-no1', label: 'Brahms · Intermezzo, Op. 118 No. 1',
    title: '6 Klavierstücke · Op. 118 · No. 1 · Intermezzo in A minor', composer: 'Johannes Brahms', playable: false,
    pdf: undefined },
  { id: 'schumann-op68-no14-gold', reference: 'schumann-op68-no14-gold', label: 'Schumann · Kleine Studie, Op. 68 No. 14',
    title: 'Album für die Jugend · Op. 68 · No. 14 · Kleine Studie', composer: 'Robert Schumann', playable: false,
    pdf: 'schumann-op68-no14-gold.pdf' },
] as const;
export type HomeScoreId = typeof HOME_SCORES[number]['id'];
export const DEFAULT_HOME_SCORE: HomeScoreId = 'bach-goldberg-var1';
export function homeScoreFromSearch(search: string): HomeScoreId | undefined {
  const id = new URLSearchParams(search).get('score');
  return HOME_SCORES.find(score => score.id === id || score.reference === id)?.id;
}
export function homeScoreUrl(url: string, id: HomeScoreId): string {
  const next = new URL(url);
  next.searchParams.set('score', id);
  return next.href;
}
export interface HomeSheet { pages: JankoPageDoc[]; revision: string; pdfUrl?: string }
export type HomeSheets = Record<HomeScoreId, HomeSheet>;

/** Retain exact SVG strings from the authenticated engine artifact, including font definitions. */
export function readHomeSheets(reference: string, revisions: Record<string, string>): HomeSheets {
  const sheets = {} as HomeSheets;
  for (const score of HOME_SCORES) {
    const start = reference.indexOf(`<div class="reference-score" data-score="${score.reference}"`);
    if (start < 0) throw new Error(`Published score unavailable: ${score.label}`);
    const next = reference.indexOf('<div class="reference-score"', start + 1);
    const block = reference.slice(start, next < 0 ? undefined : next);
    const revision = block.match(/^<div[^>]*data-revision="([^"]+)"/)?.[1];
    const expected = score.id === no14.referenceId ? no14.profileSha256 : revisions[score.id];
    if (!expected || revision !== expected) throw new Error(`Published score revision mismatch: ${score.label}`);
    const pages = [...block.matchAll(/<figure class="page-card" data-page="(\d+)">[\s\S]*?(<svg\b[\s\S]*?<\/svg>)[\s\S]*?<\/figure>/g)].map((page, index) => {
      if (Number(page[1]) !== index + 1) throw new Error(`Published page order mismatch: ${score.label}`);
      const svg = page[2];
      const box = svg.match(/viewBox="([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+)"/);
      if (!box) throw new Error(`Published page viewBox unavailable: ${score.label}`);
      return { svg, vbX: Number(box[1]), vbY: Number(box[2]), vbW: Number(box[3]), vbH: Number(box[4]) };
    });
    if (!pages.length || (score.id === no14.referenceId && pages.length !== no14.pageSvgSha256.length))
      throw new Error(`Published pages unavailable: ${score.label}`);
    sheets[score.id] = { pages, revision };
  }
  return sheets;
}
export async function sha256(bytes: BufferSource): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('Release hash verification unavailable');
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2, '0')).join('');
}
interface No14PdfIdentity {
  sourceHash: string; modelSha256: string; profileSha256: string; pdfSha256: string;
  pages: number; acceptedOrigin?: { pageSvgSha256?: string[] };
}
/** PDF raw export SVGs differ from studio wrappers; compare acceptedOrigin's studio page pins. */
export function checkNo14PdfIdentity(identity: No14PdfIdentity): void {
  if (identity.sourceHash !== no14.sourceSha256 || identity.modelSha256 !== no14.modelSha256 ||
      identity.profileSha256 !== no14.profileSha256 || identity.pages !== no14.pageSvgSha256.length ||
      JSON.stringify(identity.acceptedOrigin?.pageSvgSha256) !== JSON.stringify(no14.pageSvgSha256) ||
      !/^[0-9a-f]{64}$/.test(identity.pdfSha256)) throw new Error('No. 14 PDF identity mismatch');
}
/** Prepare the matching download before exposing any new release to the home reader. */
export async function verifiedNo14Pdf(base: string, sheet: HomeSheet, request: typeof fetch = fetch): Promise<ArrayBuffer> {
  const pins = await Promise.all(sheet.pages.map(page => sha256(new TextEncoder().encode(page.svg))));
  if (JSON.stringify(pins) !== JSON.stringify(no14.pageSvgSha256)) throw new Error('No. 14 published page identity mismatch');
  const manifestResponse = await request(new URL(`${no14.pdf}.manifest.json`, base), { cache: 'no-store' });
  if (!manifestResponse.ok) throw new Error(`No. 14 PDF manifest ${manifestResponse.status}`);
  const identity = await manifestResponse.json() as No14PdfIdentity;
  checkNo14PdfIdentity(identity);
  const response = await request(new URL(no14.pdf, base), { cache: 'no-store' });
  if (!response.ok) throw new Error(`No. 14 PDF ${response.status}`);
  const bytes = await response.arrayBuffer();
  if (await sha256(bytes) !== identity.pdfSha256) throw new Error('No. 14 PDF hash mismatch');
  return bytes;
}
