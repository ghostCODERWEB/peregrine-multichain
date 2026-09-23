// The smart-money trade tape, from whichever source a viewer may see: the
// scanner's recorded trades (key owner), a live call with the viewer's own
// key (member), or a call the viewer paid for per call (x402).
import { classifySwap } from '@/lib/models/trade-side';

export interface TapeTrade { at: number; wallet: string; label: string | null; side: 'buy' | 'sell'; symbol: string | null; usd: number }
/** `count` > 1 when consecutive fills were folded together (then `firstAt`
 *  is the oldest of them). */
export interface TapeRow extends TapeTrade { firstAt: number; count: number }

/**
 * Newest first, with back-to-back fills of one wallet on one token and side
 * folded into a single row (count + summed USD) — bots that DCA every
 * minute would otherwise fill the whole tape with one line repeated.
 */
export function foldTape(trades: TapeTrade[], max = 30): TapeRow[] {
  const out: TapeRow[] = [];
  for (const r of [...trades].sort((a, b) => b.at - a.at)) {
    const prev = out.at(-1);
    if (prev && prev.wallet === r.wallet && prev.symbol === r.symbol && prev.side === r.side) {
      prev.usd += r.usd;
      prev.count += 1;
      prev.firstAt = r.at;
    } else {
      if (out.length === max) break;
      out.push({ ...r, firstAt: r.at, count: 1 });
    }
  }
  return out;
}

const str = (v: unknown) => (typeof v === 'string' && v ? v : null);

/** smart-money/dex-trades response → tape trades, keeping only swaps that
 *  move capital into or out of the chain's risk assets (as the scanner
 *  does). Rows missing a time, wallet or USD value are skipped. */
export function tapeFromDexTrades(data: unknown): TapeTrade[] {
  const rows = (data as { data?: unknown } | null)?.data;
  if (!Array.isArray(rows)) return [];
  const out: TapeTrade[] = [];
  for (const r of rows as Array<Record<string, unknown>>) {
    const at = Date.parse(str(r.block_timestamp) ?? '');
    const wallet = str(r.trader_address);
    const usd = typeof r.trade_value_usd === 'number' && Number.isFinite(r.trade_value_usd) ? r.trade_value_usd : null;
    const side = classifySwap({
      token_bought_symbol: str(r.token_bought_symbol), token_sold_symbol: str(r.token_sold_symbol),
      token_bought_address: str(r.token_bought_address), token_sold_address: str(r.token_sold_address),
    });
    if (!Number.isFinite(at) || !wallet || usd == null || !side) continue;
    out.push({ at, wallet, label: str(r.trader_address_label), side: side.side, symbol: side.tokenSymbol, usd });
  }
  return out;
}

export const liveTapeRequest = (chain: string) => ({
  chains: [chain], pagination: { page: 1, per_page: 100 }, order_by: [{ field: 'block_timestamp', direction: 'DESC' }],
});
