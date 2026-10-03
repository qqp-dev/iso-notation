/** Current condensed absolute publication. Relative experiments are retired. */
import selected from './no14-published-profile.json';
import {no14AbsoluteCondensedProfile} from './no14-absolute-condensed';
export const NO14_PUBLISHED_IDENTITY=selected;
export function no14PublishedProfile(){return no14AbsoluteCondensedProfile();}
export {no14GoldStudioSvg as no14PublishedStudioSvg} from './no14-gold';
