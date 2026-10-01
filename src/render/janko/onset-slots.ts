/** Candidate clearance quantization. Subtracting translated coordinates can
 * put an exact slot a few ulps above its integer. Snap only within the error
 * budget of that subtraction, never a fixed fraction of a musical slot. */
export function onsetSlotShift(right: number, left: number, air: number, slot: number): number {
  if (![right, left, air, slot].every(Number.isFinite) || slot <= 0 || air < 0)
    throw new Error('Onset slots require finite coordinates and positive clearance units');
  const demand = Math.max(0, right + air - left);
  const nearest = Math.round(demand / slot);
  const error = 8 * Number.EPSILON * Math.max(1, Math.abs(right), Math.abs(left), air, demand, slot);
  return (Math.abs(demand - nearest * slot) <= error ? nearest : Math.ceil(demand / slot)) * slot;
}
