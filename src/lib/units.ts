/** Decimal string → integer base units, without floating point. Extra
 *  precision is cut, never rounded up. Shared by the browser and the server. */
export function toBaseUnits(amount: string, decimals: number): string | null {
  const m = /^(\d+)(?:\.(\d+))?$/.exec(amount.trim());
  if (!m) return null;
  const frac = (m[2] ?? '').slice(0, decimals).padEnd(decimals, '0');
  const v = BigInt(m[1] + frac);
  return v > BigInt(0) ? v.toString() : null;
}
