/** Measured outlined reset labels. The shared band clears complete settled ink. */
import type { QuantizedGridScore } from '../../model/types';
import type { JankoSystemLayout } from './engine';
import { GOTHIC_DEMI_GLYPHS } from './gothic-glyphs';
import { f } from './elements/style';
export const READING_REFERENCE_AIR = 5;
export const READING_REFERENCE_BAND_HEIGHT = 6;
export interface ReadingReferenceMark {
  bar:number; label:string; x0:number;x1:number;y0:number;y1:number;svg:string;
}
export function signedDuodecimalSpan(n:number):string {
  return n===0 ? '=' : `${n<0?'−':'+'}${Math.abs(n).toString(12).toUpperCase()}`;
}
function outlinedLabel(label:string,left:number,bottom:number):Omit<ReadingReferenceMark,'bar'|'label'> {
  const scale=.007,paths:string[]=[];const points:number[][]=[];let x=left;
  const rect=(x0:number,y0:number,x1:number,y1:number) => {
    points.push([x0,y0],[x1,y1]);paths.push(`M ${f(x0)} ${f(y0)} H ${f(x1)} V ${f(y1)} H ${f(x0)} Z`);
  };
  for (const character of label) {
    if (character==='=' || character==='+' || character==='−') {
      const mid=bottom-2.6;
      if(character==='=') {rect(x,mid-1,x+3.5,mid-.5);rect(x,mid+.5,x+3.5,mid+1);}
      else {rect(x,mid-.25,x+3.5,mid+.25);if(character==='+')rect(x+1.5,mid-1.75,x+2,mid+1.75);}
      x+=4.5;continue;
    }
    if (character==='/') {
      const path=[[x,bottom],[x+.5,bottom],[x+2.5,bottom-5.2],[x+2,bottom-5.2]];
      points.push(...path);paths.push(path.map(([a,b],i)=>`${i?'L':'M'} ${f(a)} ${f(b)}`).join(' ')+' Z');x+=3.2;continue;
    }
    const glyph=GOTHIC_DEMI_GLYPHS[character];if(!glyph)throw Error(`Unsupported reference glyph${character}`);
    for(const contour of glyph.contours){
      const transformed=contour.map(([a,b])=>[Number((x+a*scale).toFixed(2)),Number((bottom-b*scale).toFixed(2))]);
      points.push(...transformed);paths.push(transformed.map(([a,b],i)=>`${i?'L':'M'} ${f(a)} ${f(b)}`).join(' ')+' Z');
    }
    x+=glyph.advance*scale;
  }
  const box={x0:Math.min(...points.map(p=>p[0])),x1:Math.max(...points.map(p=>p[0])),y0:Math.min(...points.map(p=>p[1])),y1:Math.max(...points.map(p=>p[1]))};
  return {...box,svg:`<path d="${paths.join(' ')}" fill="#555555"/>`};
}
export function placeReadingReferences(score:QuantizedGridScore,layout:JankoSystemLayout,inkTop:number,mode:'movement'|'absolute'='movement'):ReadingReferenceMark[] {
  const relative=score.relativePresentation;if(!relative)return [];
  const g=layout.geometry,first=g.firstBar??layout.index*g.measuresPerSystem;
  // Round to exactly the painted coordinates. A glyph's tiny descender ends
  // .10pt below its baseline; the extra .12 retains the declared5pt air.
  const bottom=Number((inkTop-READING_REFERENCE_AIR-.12).toFixed(2));
  return relative.anchors.filter(a=>a.bar>first&&a.bar<=first+g.measuresPerSystem&&a.bar<=relative.visibleBars).map(a=>{
    const local=a.bar-first-1,left=g.measureEdges?.[local]??g.staffLeft+local*g.measureWidth;
    const absolute=a.bar===1||mode==='absolute';
    const label=absolute?`${(a.pitch%12).toString(12).toUpperCase()}/${Math.floor(a.pitch/12)}`:signedDuodecimalSpan(a.movement);
    const ink=outlinedLabel(label,Number((left+6).toFixed(2)),bottom);
    return {bar:a.bar,label,...ink,svg:`<g class="janko-reading-reference" data-bar="${a.bar}" data-reference="${label}" data-anchor="${a.pitch}" data-reference-mode="${absolute?'absolute':'movement'}" aria-label="${absolute?'Absolute pitch and octave reference':'Anchor movement in base twelve'} ${label}">${ink.svg}</g>`};
  });
}
export function readingReferencesSvg(marks:readonly ReadingReferenceMark[]):string {
  return marks.map(m=>m.svg).join('\n');
}
