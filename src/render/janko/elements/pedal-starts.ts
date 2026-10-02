import {PEDAL_START_GLYPHS} from './pedal-paths';
import {PEDAL_TEXT_GLYPH} from './dynamic-family-paths';
import {PAIRED_PEDAL_TEXT,type PedalTextFamily} from './paired-typography-paths';
import {vectorGlyphInk} from './vector-glyph';
export type PedalStartStyle='ornate-p'|'pictogram'|'plain-text'|'downward-entry';
export interface PedalStartInk {
 style:PedalStartStyle;tick:number;intervalId:string;x:number;y:number;height:number;
 x0:number;x1:number;y0:number;y1:number;
 svg:string;polygons:number[][][];
 /** A slanted entry joins the ordinary hold at its actual path endpoint. */
 holdX?:number;
 family?:PedalTextFamily;
}
const f=(v:number)=>Number(v.toFixed(3));
/** Faithful uniform vector scale, 7.2 pt high. The ordinary hold line is at
 * the glyph's middle height; the pictogram's own top stroke is not extended. */
export function pedalStartInk(style:PedalStartStyle,tick:number,intervalId:string,x:number,y:number,height=7.2,family?:PedalTextFamily):PedalStartInk{
 if(style==='plain-text'){
  const glyph=family?PAIRED_PEDAL_TEXT[family]:PEDAL_TEXT_GLYPH,scale=glyph.scale,[loX,loY,hiX,hiY]=glyph.bounds;
  // Ordinary lettering begins at the true press clock. The line follows near
  // its lower body, with a modest gap; this is a review convention, not a
  // composer's extra pedal event or a final typography choice.
  const ink=vectorGlyphInk(glyph.path,glyph.bounds,x-loX*scale,y+1,scale);
  return {style,tick,intervalId,x,y,...(family?{family}:{}),height:(hiY-loY)*scale,x0:ink.x0,x1:ink.x1,y0:ink.y0,y1:ink.y1,polygons:ink.polygons,
   svg:`<path class="janko-pedal-start" data-pedal-start="${style}"${family?` data-pedal-family="${family}"`:''} data-press-tick="${tick}" data-pedal-interval="${intervalId}" aria-label="Ped." d="${glyph.path}" transform="translate(${ink.tx} ${ink.ty}) scale(${scale} ${-scale})" fill="#111111"/>`};
 }
 if(style==='downward-entry'){
  const a=[f(x),f(y-4)],b=[f(x+4),f(y)],width=.65,half=width/2,len=Math.hypot(b[0]-a[0],b[1]-a[1]),nx=-(b[1]-a[1])/len*half,ny=(b[0]-a[0])/len*half;
  const poly=[[a[0]+nx,a[1]+ny],[b[0]+nx,b[1]+ny],[b[0]-nx,b[1]-ny],[a[0]-nx,a[1]-ny]];
  return {style,tick,intervalId,x,y,height:4,x0:Math.min(...poly.map(p=>p[0])),x1:Math.max(...poly.map(p=>p[0])),y0:Math.min(...poly.map(p=>p[1])),y1:Math.max(...poly.map(p=>p[1])),polygons:[poly],holdX:b[0],
   svg:`<path class="janko-pedal-start" data-pedal-start="${style}" data-press-tick="${tick}" data-pedal-interval="${intervalId}" d="M${a.join(' ')}L${b.join(' ')}" fill="none" stroke="#111111" stroke-width="${width}"/>`};
 }
 const glyph=PEDAL_START_GLYPHS[style],[loX,loY,hiX,hiY]=glyph.bounds,scale=height/(hiY-loY),tx=x-(loX+hiX)*scale/2,ty=y+(loY+hiY)*scale/2;
 const point=(p:readonly number[])=>[f(tx+p[0]*scale),f(ty-p[1]*scale)];
 const contours=glyph.contours.map(c=>({start:point(c.start),segments:c.segments.map(s=>s.map(point))}));
 const d=contours.map(c=>'M'+c.start.join(' ')+c.segments.map(s=>'C'+s.map(p=>p.join(' ')).join(' ')).join('')+'Z').join('');
 const polygons=contours.map(c=>{const poly=[c.start];let from=c.start;
  for(const [a,b,z] of c.segments){for(let i=1;i<=16;i++){const u=i/16,v=1-u;poly.push([0,1].map(k=>v*v*v*from[k]+3*v*v*u*a[k]+3*v*u*u*b[k]+u*u*u*z[k]));}from=z;}return poly;});
 return {style,tick,intervalId,x,y,height,x0:tx+loX*scale,x1:tx+hiX*scale,y0:y-height/2,y1:y+height/2,polygons,
 svg:`<path class="janko-pedal-start" data-pedal-start="${style}" data-press-tick="${tick}" data-pedal-interval="${intervalId}" data-smufl="${glyph.codepoint}" d="${d}" fill="#111111"/>`};
}
