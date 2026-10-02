import type {JankoPageGeometry} from './types';
/** Current7pt running text is painted at default96DPI. These bounds book a
 * conservative full em above and .35em below its10pt baseline, with4pt air.
 * They do not pretend to be a font-specific outline or change font resolution. */
export const RUNNING_HEAD_BASELINE=10;
export const RUNNING_HEAD_PT=7;
export const RUNNING_HEAD_EM=RUNNING_HEAD_PT*4/3;
export const RUNNING_HEAD_AIR=4;
export function runningHeaderBand(page:JankoPageGeometry){
 return {top:page.marginTop+RUNNING_HEAD_BASELINE-RUNNING_HEAD_EM,
  bottom:page.marginTop+RUNNING_HEAD_BASELINE+.35*RUNNING_HEAD_EM};
}
/** One page-aware admission/placement/audit reservation. Canonical omitted
 * options retain the original exact body arithmetic and output. */
export function pageBodyBounds(page:JankoPageGeometry,pageIndex:number){
 const headerHeight=pageIndex>0?(page.options.runningHeaderHeight??page.headerHeight):page.headerHeight;
 if(!Number.isFinite(headerHeight)||headerHeight<0)throw Error('Invalid page header reservation');
 const top=page.marginTop+headerHeight,bottom=page.pageHeight-page.marginBottom-page.footerHeight;
 const height=headerHeight===page.headerHeight?page.bodyHeight:page.bodyHeight+(page.headerHeight-headerHeight);
 return {headerHeight,top,bottom,height};
}
