/* Approved, retrieved public PDFs only. Adding a source requires a new pinned file,
 * provenance/rights review and explicit operator access; this is not a URL chooser. */
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
export type SourceDocumentId = keyof typeof SOURCE_DOCUMENTS;
export const REFERENCE_IDS: SourceDocumentId[] = ['imslp-936721', 'imslp-10496'];
export const CANDIDATE_IDS: SourceDocumentId[] = ['snortum-v0.4-no01', 'mutopia-1779-no01'];
