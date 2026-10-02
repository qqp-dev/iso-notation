/** Intact outlined-font ink. Translation is rounded exactly as the SVG;
 * flattened contours use sixteen samples per curve, as pedal glyphs do. */
export interface VectorGlyphInk {
 path:string;bounds:readonly number[];tx:number;ty:number;scale:number;
 x0:number;x1:number;y0:number;y1:number;polygons:number[][][];
}
export function vectorGlyphInk(path:string,bounds:readonly number[],tx:number,ty:number,scale:number):VectorGlyphInk{
 tx=Number(tx.toFixed(3));ty=Number(ty.toFixed(3));
 const tokens=path.match(/[MLHVQCZ]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g)??[];
 let at=0,command='',x=0,y=0,first=[0,0],polygon:number[][]=[];const polygons:number[][][]=[];
 const point=(a:number,b:number)=>[tx+a*scale,ty-b*scale],number=()=>{const n=Number(tokens[at++]);if(!Number.isFinite(n))throw Error('Invalid vector glyph coordinate');return n;};
 while(at<tokens.length){
  if(/^[A-Z]$/.test(tokens[at]))command=tokens[at++];
  if(command==='Z'){if(polygon.length){polygon.push(point(first[0],first[1]));polygons.push(polygon);polygon=[];}x=first[0];y=first[1];command='';continue;}
  if(command==='M'){x=number();y=number();if(polygon.length)throw Error('Unclosed vector glyph contour');first=[x,y];polygon=[point(x,y)];command='L';continue;}
  if(command==='L'){x=number();y=number();polygon.push(point(x,y));continue;}
  if(command==='H'){x=number();polygon.push(point(x,y));continue;}
  if(command==='V'){y=number();polygon.push(point(x,y));continue;}
  if(command==='Q'){
   const ax=number(),ay=number(),bx=number(),by=number();
   for(let i=1;i<=16;i++){const u=i/16,v=1-u;polygon.push(point(v*v*x+2*v*u*ax+u*u*bx,v*v*y+2*v*u*ay+u*u*by));}x=bx;y=by;continue;
  }
  if(command==='C'){
   const ax=number(),ay=number(),bx=number(),by=number(),cx=number(),cy=number();
   for(let i=1;i<=16;i++){const u=i/16,v=1-u;polygon.push(point(v*v*v*x+3*v*v*u*ax+3*v*u*u*bx+u*u*u*cx,v*v*v*y+3*v*v*u*ay+3*v*u*u*by+u*u*u*cy));}x=cx;y=cy;continue;
  }
  throw Error('Unsupported vector glyph path command');
 }
 if(polygon.length)throw Error('Unclosed vector glyph contour');
 const [loX,loY,hiX,hiY]=bounds;
 return {path,bounds,tx,ty,scale,x0:tx+loX*scale,x1:tx+hiX*scale,y0:ty-hiY*scale,y1:ty-loY*scale,polygons};
}
