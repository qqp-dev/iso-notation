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
