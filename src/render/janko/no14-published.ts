/** Current operator-selected publication. Historical absolute GOLD APIs remain
 * independent because the approved gesture profiles build from that history. */
import selected from './no14-published-profile.json';
import {no14GestureOpenProfile} from './no14-gesture-relative';
export const NO14_PUBLISHED_IDENTITY=selected;
export function no14PublishedProfile(){return no14GestureOpenProfile();}
export {no14GoldStudioSvg as no14PublishedStudioSvg} from './no14-gold';
