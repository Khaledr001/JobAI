/**
 * Whole months between two dates, always >= 0 regardless of argument order.
 * Used both for recency decay (months since a work entry) and for
 * monthsActive on a technology's projection row.
 */
export function monthsBetween(from: Date, to: Date): number {
  const [earlier, later] = from.getTime() <= to.getTime() ? [from, to] : [to, from];
  const years = later.getUTCFullYear() - earlier.getUTCFullYear();
  const months = later.getUTCMonth() - earlier.getUTCMonth();
  const dayAdjustment = later.getUTCDate() < earlier.getUTCDate() ? -1 : 0;
  return Math.max(0, years * 12 + months + dayAdjustment);
}
