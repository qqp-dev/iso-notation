import {DYNAMIC_FAMILIES as RESEARCH_DYNAMIC_FAMILIES} from './dynamic-family-paths';
import {PAIRED_DYNAMIC_FAMILIES} from './paired-typography-paths';
import {vectorGlyphInk,type VectorGlyphInk} from './vector-glyph';
export const DYNAMIC_FAMILIES={...RESEARCH_DYNAMIC_FAMILIES,...PAIRED_DYNAMIC_FAMILIES};
export type DynamicFamily=keyof typeof DYNAMIC_FAMILIES;
export interface DynamicFamilyInk extends VectorGlyphInk {family:DynamicFamily;mark:string;}
export function dynamicFamilyInk(family:DynamicFamily,mark:string,tx:number,ty:number,scale:number):DynamicFamilyInk{
 const glyph=(DYNAMIC_FAMILIES[family].marks as Record<string,{path:string;bounds:readonly number[]}>)[mark];
 if(!glyph)throw Error(`Unsupported ${family} dynamic ${mark}`);
 return {...vectorGlyphInk(glyph.path,glyph.bounds,tx,ty,scale),family,mark};
}
