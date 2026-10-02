import no14Selection from '../render/janko/no14-gold-profile.json';

/** Only the verified applied GOLD Reference is a published No14 counterpart.
 * A partial/stale release or another profile must never supply substitute ink. */
export function no14GoldComparisonPages(prepared: HTMLElement): {page:number;label:string;svg:SVGSVGElement}[] {
  if(prepared.dataset.preparedState!=='ready')return [];
  const score=prepared.querySelector<HTMLElement>('.reference-score[data-score="schumann-op68-no14-gold"]');
  if(score?.dataset.revision!==no14Selection.gold.profileSha256)return [];
  const figures=Array.from(score.querySelectorAll<HTMLElement>('.page-card[data-page]'));
  if(figures.length!==no14Selection.accepted.pageSvgSha256.length)return [];
  const pages=figures.flatMap((figure,i)=>{
    const svg=figure.querySelector<SVGSVGElement>('svg');
    return svg&&figure.dataset.page===String(i+1)?[{page:i+1,label:figure.querySelector('figcaption')?.textContent?.trim()??`Page ${i+1}`,svg}]:[];
  });
  return pages.length===figures.length?pages:[];
}

/** Reuse only the exact current real-engine passage, never another score's ink. */
export function comparisonReadings(prepared: HTMLElement): { id: string; label: string; svg: SVGSVGElement }[] {
  if (prepared.dataset.preparedState !== 'ready') return [];
  return Array.from(prepared.querySelectorAll<HTMLElement>('.candidate-card[data-candidate]')).flatMap(card => {
    if (card.dataset.lint === 'rejected' || card.dataset.lint === 'error') return [];
    const figure = card.querySelector<HTMLElement>('.candidate-window[data-score="schumann-op68-no13"][data-measure-start="38"][data-measure-count="3"]');
    const svg = figure?.querySelector<SVGSVGElement>('svg');
    const id = card.dataset.candidate;
    return svg && id ? [{ id, label: card.querySelector('h3')?.textContent ?? id, svg }] : [];
  });
}

/** A comparison clone must not steal gradient/clip/text references from its original. */
export function cloneComparisonSvg(original: SVGSVGElement, prefix: string): SVGSVGElement {
  const svg = original.cloneNode(true) as SVGSVGElement;
  const nodes = [svg, ...Array.from(svg.querySelectorAll<SVGElement>('*'))];
  const ids = new Map<string, string>();
  for (const node of nodes) if (node.id) ids.set(node.id, `${prefix}-${node.id}`);
  for (const node of nodes) {
    for (const attribute of Array.from(node.attributes)) {
      let value = attribute.value;
      if (attribute.name === 'id') value = ids.get(value)!;
      else if (attribute.name === 'href' || attribute.name === 'xlink:href') {
        if (value.startsWith('#') && ids.has(value.slice(1))) value = `#${ids.get(value.slice(1))}`;
      } else if (attribute.name === 'aria-labelledby' || attribute.name === 'aria-describedby') {
        value = value.split(/\s+/).map(id => ids.get(id) ?? id).join(' ');
      } else value = value.replace(/url\(#([^)]+)\)/g, (match, id: string) => ids.has(id) ? `url(#${ids.get(id)})` : match);
      if (value !== attribute.value) node.setAttribute(attribute.name, value);
    }
  }
  return svg;
}
