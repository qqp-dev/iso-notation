import type { PedalOverlay } from './types';

/** Only literal adjacent same-time off/on is a re-pedalling change.
 * Keep both origins; do not absorb a real gap or a mark from another channel. */
export function normalizePedalEvents(events: readonly PedalOverlay[]): PedalOverlay[] {
  const result: PedalOverlay[] = [];
  for (let i=0;i<events.length;i++) {
    const off=events[i],on=events[i+1];
    if(off.type==='sustain-up'&&on?.type==='sustain-down'&&off.tick===on.tick&&
      off.origin?.context===on.origin?.context&&
      (off.order===undefined||on.order===off.order+1)) {
      result.push({...off,type:'sustain-change',...(off.origin&&on.origin?{changeOrigins:[off.origin,on.origin] as PedalOverlay['changeOrigins']}:{})});i++;
    }else result.push(off);
  }
  return result;
}
