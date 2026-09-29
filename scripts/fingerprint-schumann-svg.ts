/** Compare unmodified-score SVG/plan fingerprints across the base and opt-in grace branch. */
import { createHash } from 'node:crypto';
import { createStudioConfig } from '../src/render/janko/studio';
import { countJankoPages, layoutJankoScore, renderJankoPage } from '../src/render/janko/engine';

const scores = createStudioConfig().scores;
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
for (const id of ['bach-goldberg-var1', 'brahms-op118-no1', 'schumann-op68-no43','schumann-op68-no14','schumann-op68-no30']) {
  const entry = scores[id];
  if (!entry) throw Error(`Missing score ${id}`);
  const layouts = layoutJankoScore(entry.score,entry.options,entry.tokens);
  const pages = Array.from({length:countJankoPages(entry.score,entry.options,entry.tokens)},(_,page)=>
    renderJankoPage(entry.score,page,entry.options,entry.tokens,layouts));
  const plan = layouts.map(l=>({ index:l.index, notes:l.notes.map(n=>[n.note.id,n.x,n.y,n.rhythm.durationTicks]),
    beams:l.beams.length, rests:l.rests.length, clasps:l.clasps.length }));
  console.log(`${id} pages=${pages.length} svg=${hash(pages.join(''))} plan=${hash(JSON.stringify(plan))}`);
}
