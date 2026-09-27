/** Trims number precision in data sent to the browser. Stored and computed
 *  values are full doubles (3135036961.32576, 0.10950000000000001), and
 *  pages hand them to client components by the thousand. Every fractional
 *  number keeps 6 significant digits and never fewer than 2 decimals, so
 *  cents survive on large amounts and nothing the UI prints changes.
 *  Integers, strings and non-plain objects pass through untouched. */
export function compact<T>(v: T): T {
  if (typeof v === 'number') return (Number.isInteger(v) || !Number.isFinite(v) ? v : round(v)) as T;
  if (Array.isArray(v)) return v.map(compact) as T;
  if (v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) out[k] = compact(x);
    return out as T;
  }
  return v;
}

const round = (x: number) => (Math.abs(x) >= 1e4 ? Math.round(x * 100) / 100 : Number(x.toPrecision(6)));
