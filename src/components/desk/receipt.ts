// A call's receipt as the ⓘ popover shows every other number in TIDE: the
// exact Nansen request, whether it was served live, from cache or from the
// recorded demo, its credit cost, and the excerpt the call relies on.
import type { Provenance } from '@/lib/provenance';

export interface ReceiptLike { endpoint: string; body: unknown; at: number; served: 'live' | 'cache' | 'recorded'; credits: number; excerpt: string }

export const receiptProvenance = (title: string, r: ReceiptLike, notes: string[] = []): Provenance => ({
  title, formula: r.excerpt,
  inputs: [{ label: 'Read at', value: new Date(r.at).toISOString().replace('T', ' ').slice(0, 19) + ' UTC' }, { label: 'Served', value: r.served }],
  calls: [{ endpoint: r.endpoint, body: r.body, credits: r.credits, ref: `${r.served} · ${new Date(r.at).toISOString()}` }],
  notes,
});

/** Prices from a few dollars down to fractions of a cent, at four significant digits. */
export const fmtPrice = (p: number | null) => (p == null ? '—' : p >= 1 ? p.toFixed(4).replace(/\.?0+$/, '') : Number(p.toPrecision(4)).toString());

export const GRADE_RULES = 'Graded from Nansen candle closes for exactly the call’s window. Bull or bear: won if the price moved at least the band your way (1% for 1h, 3% for 24h, 7% for 7d), lost if it moved that far against you, too early otherwise. Touching your invalidation first grades it invalidated. A pass is right if the move stayed inside the band.';
