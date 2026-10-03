import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HOME_SCORES, DEFAULT_HOME_SCORE, homeScoreFromSearch, homeScoreUrl, readHomeSheets, checkNo14PdfIdentity, verifiedNo14Pdf } from '../src/ui/home-scores';
import no14 from '../src/render/janko/no14-published-profile.json';
import { no14PublishedProfile } from '../src/render/janko/no14-published';
import { layoutJankoScore, renderJankoPage } from '../src/render/janko/engine';

const box = '<svg viewBox="0 0 595.28 841.89"><text>literal</text></svg>';
const revisions: Record<string, string> = { 'bach-goldberg-var1': 'PR114/8fd1e4', 'brahms-op118-no1': 'brahms-accepted' };
function reference(no14Pages = [box, box, box]) {
  return '<section data-view="reference">' + HOME_SCORES.map(score => {
    const pages = score.id === no14.referenceId ? no14Pages : [box];
    const revision = score.id === no14.referenceId ? no14.profileSha256 : revisions[score.id];
    return `<div class="reference-score" data-score="${score.reference}" data-revision="${revision}">` +
      pages.map((svg, i) => `<figure class="page-card" data-page="${i + 1}"><figcaption>Page ${i + 1}</figcaption>${svg}</figure>`).join('') +
      '<figure class="crop-card">' + box + '</figure></div>';
  }).join('') + '</section>';
}

test('home URL choices are allowlisted, preserve other URL state and require no studio storage', () => {
  assert.equal(DEFAULT_HOME_SCORE, 'bach-goldberg-var1');
  assert.deepEqual(HOME_SCORES.map(score => score.id), ['bach-goldberg-var1', 'schumann-op68-no14-gold']);
  for (const score of HOME_SCORES) {
    assert.equal(homeScoreFromSearch('?score=' + score.id), score.id);
    assert.equal(homeScoreFromSearch('?score=' + score.reference), score.id);
    const url = new URL(homeScoreUrl('https://example.test/iso-notation/?keep=1#sheet', score.id));
    assert.equal(url.searchParams.get('score'), score.id);
    assert.equal(url.searchParams.get('keep'), '1');
    assert.equal(url.hash, '#sheet');
  }
  for (const search of ['', '?score=unknown', '?score=brahms-op118-no1', '?score=schumann-op68-no14-gesture-open', '?score=../../payload'])
    assert.equal(homeScoreFromSearch(search), undefined);
  assert.equal(HOME_SCORES.filter(score => score.playable).map(score => score.id).join(), 'bach-goldberg-var1');
});

test('home extracts full prepared pages byte-for-byte, excludes crops and rejects incoherent releases', () => {
  const html = reference();
  const sheets = readHomeSheets(html, revisions);
  assert.equal(sheets['schumann-op68-no14-gold'].pages.length, 3);
  for (const score of HOME_SCORES) for (const page of sheets[score.id].pages) assert.equal(page.svg, box);
  assert.equal(sheets['bach-goldberg-var1'].revision, revisions['bach-goldberg-var1']);
  const retainedStudioBrahms = '<div class="reference-score" data-score="brahms-op118-no1" data-revision="historical"><figure class="page-card" data-page="1">not a publishable home page</figure></div>';
  assert.deepEqual(readHomeSheets(html.replace('</section>', retainedStudioBrahms + '</section>'), revisions), sheets,
    'retained studio-only Brahms does not activate or invalidate eligible home sheets');
  assert.throws(() => readHomeSheets(html.replace('data-page="2"', 'data-page="4"'), revisions), /page order mismatch/);
  assert.throws(() => readHomeSheets(reference([box]), revisions), /pages unavailable/);
  assert.throws(() => readHomeSheets(html.replace(no14.profileSha256, 'old-profile'), revisions), /revision mismatch/);
  assert.throws(() => readHomeSheets(html, { ...revisions, 'bach-goldberg-var1': 'later' }), /revision mismatch/);
  assert.throws(() => readHomeSheets(html.replace('data-score="primary"', 'data-score="absent"'), revisions), /score unavailable/);
});

test('No14 existing PDF identity rejects a stale profile, source, model, page count and studio pins', () => {
  const identity = JSON.parse(readFileSync('public/schumann-op68-no14-gold.pdf.manifest.json', 'utf8'));
  checkNo14PdfIdentity(identity);
  for (const mutation of [
    { profileSha256: 'old' }, { sourceHash: 'old' }, { modelSha256: 'old' },
    { pages: 4 }, { acceptedOrigin: { pageSvgSha256: [...no14.pageSvgSha256].reverse() } }, { pdfSha256: 'bad' },
  ]) assert.throws(() => checkNo14PdfIdentity({ ...identity, ...mutation }), /PDF identity mismatch/);
});

test('home verifies actual accepted No14 pages and PDF bytes before offering the matching download', async () => {
  const profile = no14PublishedProfile();
  const layouts = layoutJankoScore(profile.score, profile.options, profile.tokens);
  const pages = [0, 1, 2].map(page => renderJankoPage(profile.score, page, profile.options, profile.tokens, layouts).replace('<svg ', '<svg class="janko-svg" '));
  const sheet = readHomeSheets(reference(pages), revisions)['schumann-op68-no14-gold'];
  const pdf = readFileSync('public/schumann-op68-no14-gold.pdf');
  const identity = readFileSync('public/schumann-op68-no14-gold.pdf.manifest.json', 'utf8');
  const requests: string[] = [];
  const request = (async (url: string | URL | Request) => {
    requests.push(String(url));
    return new Response(String(url).endsWith('.json') ? identity : new Uint8Array(pdf));
  }) as typeof fetch;
  assert.deepEqual(Buffer.from(await verifiedNo14Pdf('https://example.test/iso-notation/', sheet, request)), pdf);
  assert.deepEqual(requests, ['https://example.test/iso-notation/schumann-op68-no14-gold.pdf.manifest.json', 'https://example.test/iso-notation/schumann-op68-no14-gold.pdf']);
  await assert.rejects(verifiedNo14Pdf('https://example.test/', { ...sheet, pages: [...sheet.pages].reverse() }, request), /page identity mismatch/);
  const badPdf = (async (url: string | URL | Request) => new Response(String(url).endsWith('.json') ? identity : 'wrong-pdf')) as typeof fetch;
  await assert.rejects(verifiedNo14Pdf('https://example.test/', sheet, badPdf), /PDF hash mismatch/);
});
