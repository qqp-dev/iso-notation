/* Explicitly reviewed sources only; never accept user-supplied URLs. PDFs are pinned
 * in the private dev cache; original JPEGs are linked directly to their hosts. */
export const SOURCE_DOCUMENTS = {
  'imslp-936721': {
    role: 'reference', title: 'Scriabin · Op. 11 No. 1 (within complete Op. 11)',
    edition: 'M. P. Belaieff, Leipzig, 1897 · plates 1383–87',
    version: 'IMSLP #936721 · historical scan',
    url: 'https://vmirror.imslp.org/files/imglnks/usimg/e/e3/IMSLP936721-PMLP9363-Op.11.pdf',
    rights: 'IMSLP public-domain catalogue claim is jurisdiction-specific; not redistribution clearance.',
    differences: 'Composer-proofread first edition; Henle apparatus notes some readings require correction against autograph.',
    pages: 37, bytes: 3645826, sha256: '57567499e4d1c417e90f84c13d305d6e3fad246dbae1cc9105b701644ffc95d4',
  },
  'imslp-10496': {
    role: 'reference', title: 'Scriabin · Op. 11 No. 1 (within complete Op. 11)',
    edition: 'Publisher unidentified · MIT archive provenance',
    version: 'IMSLP #10496 · historical scan',
    url: 'https://vmirror.imslp.org/files/imglnks/usimg/6/62/IMSLP10496-Scriabin_-_Op.11.pdf',
    rights: 'IMSLP catalogue access/PD claim is jurisdiction-specific; edition and redistribution rights unverified.',
    differences: 'Edition identity unresolved; not presumed equivalent to the 1897 first edition.',
    pages: 40, bytes: 1947226, sha256: 'ac0f2ad9ef82cf06c862bfb1b3fb47554cbaf26754086e5977600b53ece6e9d3',
  },
  'snortum-v0.4-no01': {
    role: 'candidate', title: 'Scriabin · Op. 11 No. 1',
    edition: 'Kevin Snortum transcription · LilyPond 2.24.2 · letter',
    version: 'Published v0.4 PDF · tag commit 1a12f0513ecabc843b990f8180eaadee709e38a1',
    url: 'https://github.com/ksnortum/scriabin-opus-11/releases/download/v0.4/prelude-op11-no01-individual.pdf',
    rights: 'Repository claims CC BY-SA 4.0 for transcription; underlying-edition rights separate.',
    differences: 'Header cites IMSLP #10496 and #03773, not Henle. Published PDF — not independently rebuilt.',
    pages: 2, bytes: 110919, sha256: 'ccf50b7878ba0dd231a5f43a3c60a5e4a33c187a4fec5849983d635c8eb6440e',
  },
  'kinderszenen-v70': {
    role: 'candidate', title: 'Schumann · Kinderszenen Op. 15 · Nos. 1/6/8 (within complete Op. 15)',
    edition: 'Madrisan open-scores · published transcription · Breitkopf & Härtel 1880, plate R.S. 53 source parent',
    version: 'Published v70 PDF · commit 1add902dee06d3a94ebedf6cc6405dfedf4a11f4',
    url: 'https://github.com/madrisan/open-scores/releases/download/v70/Robert-Schumann-Kinderscenen-op.15.pdf',
    rights: 'Repository claims CC BY-NC-SA 4.0; underlying edition and reuse rights not independently cleared.',
    differences: 'Not certified against Henle HN 44 or adopted as a canonical score. PDF page anchors are independently checked as text boundaries; inspect actual rendered pages.',
    pages: 16, bytes: 2496446, sha256: '30ded702114332842e87aecd63cc672d32ac32ea7a779a70939055fbff6013af',
  },
  'schumann-starter': {
    role: 'candidate', title: 'Schumann · Album für die Jugend Op. 68',
    edition: 'Published transcription · starter (Peters parent unspecified)',
    version: 'Schumann Album pour la Jeunesse Sans Doigtés · published PDF',
    url: 'http://superbonus.project.free.fr/IMG/pdf/Schumann-Album-pour-la-Jeunesse-Sans-Doigtes.pdf',
    rights: '2012 announcement states Free Art License; underlying Peters edition and identity of contributors not independently established.',
    differences: 'Not certified faithful to Henle HN 45 or Schuberth first issue; No. 13 Mutopia relative changes to repeats are documented.',
    pages: 92, bytes: 1316287, sha256: '8c0ac7ce7d8e70dfa2c60d52deb09db068db9c0160b770837f66b0dded9a1302',
  },
  'mutopia-1779-no01': {
    role: 'candidate', title: 'Scriabin · Op. 11 No. 1',
    edition: 'Keith OHara · Mutopia 1779 · LilyPond 2.12.3 · A4',
    version: 'Published Mutopia PDF',
    url: 'https://www.mutopiaproject.org/ftp/ScriabinA/O11/Scriabin_prelude_op11no1/Scriabin_prelude_op11no1-a4.pdf',
    rights: 'Mutopia claims PD typesetting; underlying edition/source identity and local rights remain to check.',
    differences: 'Source cites #03773 but calls parent Belaieff 1895 vs IMSLP’s 1973 identification; source records editorial pitch change at m. 19. Published PDF — not independently rebuilt.',
    pages: 1, bytes: 74043, sha256: 'eab6b655e27609fefbdd4c45e88e6ae252dfae04d4e78b39e63217a6ac69aec4',
  },
} as const;
// Page numbers in image records are printed folio numbers, not PDF indexes.
const henle = 'https://www.henle.de/en/Album-for-the-Young-op.-68/HN-45';
const hn44 = 'https://www.henle.de/Scenes-from-Childhood-op.-15/HN-44';
const institute = 'https://brahmsinstitut.de/Archiv/web/bihl_digital/schumann_drucke_units/schum_op_068.html';
const archive = 'https://brahmsinstitut.de/Archiv/web/bihl_digital/schumann_drucke/';
export const SOURCE_IMAGES = {
  'henle-op15-1': { role: 'reference', title: 'Schumann Op. 15 No. 1 · Von fremden Ländern und Menschen', edition: 'Henle HN 44 · Ernst Herttrich · proposed comparison · original public preview', source: hn44,
    pages: [{ folio: 2, frame: 10, url: 'https://www.henle.de/media/8e/b8/e2/1740990328/0044_0010-1740990328-sync.jpg' }] },
  'henle-op15-6': { role: 'reference', title: 'Schumann Op. 15 No. 6 · Wichtige Begebenheit', edition: 'Henle HN 44 · Ernst Herttrich · proposed comparison · original public preview', source: hn44,
    pages: [{ folio: 7, frame: 15, url: 'https://www.henle.de/media/e2/02/d2/1740990328/0044_0015-1740990328-sync.jpg' }] },
  'henle-op15-8': { role: 'reference', title: 'Schumann Op. 15 No. 8 · Am Camin', edition: 'Henle HN 44 · Ernst Herttrich · proposed comparison · original public preview', source: hn44,
    pages: [{ folio: 9, frame: 17, url: 'https://www.henle.de/media/80/79/29/1740990327/0044_0017-1740990327-sync.jpg' }] },
  'henle-13': { role: 'reference', title: 'Schumann Op. 68 No. 13', edition: 'Henle HN 45 · Ernst Herttrich · original public preview', source: henle,
    pages: [{ folio: 14, url: 'https://www.henle.de/media/1c/1b/ab/1692635407/0045_0028-1692635407-sync.jpg' },
      { folio: 15, url: 'https://www.henle.de/media/76/45/42/1692635391/0045_0029-1692635391-sync.jpg' }] },
  'schuberth-14': { role: 'reference', title: 'Schumann Op. 68 No. 14', edition: 'Schuberth & Co · December 1848 first issue, plate 1232 · Brahms-Institut ABH 5.2.187 (Henle fallback)', source: institute,
    pages: [{ folio: 16, url: `${archive}abh_005_002_187_s_016.jpg` }, { folio: 17, url: `${archive}abh_005_002_187_s_017.jpg` }] },
  'schuberth-30': { role: 'reference', title: 'Schumann Op. 68 No. 30', edition: 'Schuberth & Co · December 1848 first issue, plate 1232 · Brahms-Institut ABH 5.2.187 (Henle fallback)', source: institute,
    pages: [{ folio: 38, url: `${archive}abh_005_002_187_s_038.jpg` }, { folio: 39, url: `${archive}abh_005_002_187_s_039.jpg` }] },
  'henle-43': { role: 'reference', title: 'Schumann Op. 68 No. 43', edition: 'Henle HN 45 · Ernst Herttrich · original public preview', source: henle,
    pages: [{ folio: 59, url: 'https://www.henle.de/media/c1/e2/16/1692635402/0045_0073-1692635402-sync.jpg' }] },
} as const;
export type SourceDocumentId = keyof typeof SOURCE_DOCUMENTS | keyof typeof SOURCE_IMAGES;
export type PdfId = keyof typeof SOURCE_DOCUMENTS;
export const isImage = (id: SourceDocumentId): id is keyof typeof SOURCE_IMAGES => Object.hasOwn(SOURCE_IMAGES, id);
export const pageCount = (id: SourceDocumentId): number => isImage(id) ? SOURCE_IMAGES[id].pages.length : SOURCE_DOCUMENTS[id].pages;
export const REFERENCE_IDS: SourceDocumentId[] = ['imslp-936721', 'imslp-10496', 'henle-13', 'schuberth-14', 'schuberth-30', 'henle-43', 'henle-op15-1', 'henle-op15-6', 'henle-op15-8'];
export const CANDIDATE_IDS: SourceDocumentId[] = ['snortum-v0.4-no01', 'mutopia-1779-no01', 'schumann-starter', 'kinderszenen-v70'];
export const WORKS = {
  scriabin: { label: 'Scriabin · Op. 11 No. 1', reference: ['imslp-936721', 'imslp-10496'], candidate: ['snortum-v0.4-no01', 'mutopia-1779-no01'], starterPage: 1 },
  'schumann-13': { label: 'Schumann · Op. 68 No. 13', reference: ['henle-13'], candidate: ['schumann-starter'], starterPage: 20 },
  'schumann-14': { label: 'Schumann · Op. 68 No. 14', reference: ['schuberth-14'], candidate: ['schumann-starter'], starterPage: 22 },
  'schumann-30': { label: 'Schumann · Op. 68 No. 30', reference: ['schuberth-30'], candidate: ['schumann-starter'], starterPage: 56 },
  'schumann-43': { label: 'Schumann · Op. 68 No. 43', reference: ['henle-43'], candidate: ['schumann-starter'], starterPage: 86 },
  'kinderszenen-1': { label: 'Schumann · Op. 15 No. 1', reference: ['henle-op15-1'], candidate: ['kinderszenen-v70'], starterPage: 3 },
  'kinderszenen-6': { label: 'Schumann · Op. 15 No. 6', reference: ['henle-op15-6'], candidate: ['kinderszenen-v70'], starterPage: 8 },
  'kinderszenen-8': { label: 'Schumann · Op. 15 No. 8', reference: ['henle-op15-8'], candidate: ['kinderszenen-v70'], starterPage: 10 },
} as const satisfies Record<string, { label: string; reference: readonly SourceDocumentId[]; candidate: readonly SourceDocumentId[]; starterPage: number }>;
export type WorkId = keyof typeof WORKS;
