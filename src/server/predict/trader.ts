// A wallet as a Polymarket trader (via Nansen): lifetime summary, PnL by
// market (best and worst), and 30-day trades. Three calls, cached.
import { traced, errText } from '@/server/nansen/traced';
import { callScope, type CallTally } from '@/server/nansen/client';
import { requestDay } from '@/server/nansen/demo';

type Row = Record<string, unknown>;
const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const s = (v: unknown) => (typeof v === 'string' && v ? v : null);
const rows = (d: unknown): Row[] => (d && typeof d === 'object' && Array.isArray((d as { data?: unknown }).data) ? (d as { data: Row[] }).data : []);

export interface PmTrader {
  summary: { realizedUsd: number | null; unrealizedUsd: number | null; marketsTraded: number | null; winRate: number | null } | null;
  markets: Array<{ id: string | null; question: string; side: string | null; pnlUsd: number | null; resolved: boolean }>;
  trades: Array<{ at: string | null; id: string | null; question: string; side: string | null; action: string | null; usd: number | null; price: number | null }>;
  errors: string[];
  tally: CallTally;
}

export async function pmTrader(address: string): Promise<PmTrader> {
  const tally: CallTally = { calls: 0, credits: 0, cached: 0 };
  return callScope.run(tally, async () => {
    const errors: string[] = [];
    const [sum, pnl, tr] = await Promise.allSettled([
      traced<unknown>('prediction-market/address-summary', { address }, 1),
      traced<unknown>('prediction-market/pnl-by-address', { address, pagination: { page: 1, per_page: 100 }, order_by: [{ field: 'total_pnl_usd', direction: 'DESC' }] }, 1),
      traced<unknown>('prediction-market/trades-by-address', { address, date: { from: requestDay(30), to: requestDay(0) }, pagination: { page: 1, per_page: 100 } }, 1),
    ]);
    const first = sum.status === 'fulfilled' ? rows(sum.value.data)[0] : null;
    if (sum.status === 'rejected') errors.push(`Summary: ${errText(sum.reason)}`);
    const summary = first ? { realizedUsd: n(first.realized_pnl_usd), unrealizedUsd: n(first.unrealized_pnl_usd), marketsTraded: n(first.markets_traded), winRate: n(first.win_rate) } : null;
    const markets = pnl.status === 'fulfilled' ? rows(pnl.value.data).map((x) => ({ id: s(x.market_id), question: s(x.question) ?? s(x.market_id) ?? 'Market', side: s(x.side_held), pnlUsd: n(x.total_pnl_usd), resolved: !!x.market_resolved })) : [];
    if (pnl.status === 'rejected') errors.push(`PnL by market: ${errText(pnl.reason)}`);
    const trades = tr.status === 'fulfilled' ? rows(tr.value.data).map((x) => ({ at: s(x.block_timestamp) ?? s(x.timestamp), id: s(x.market_id), question: s(x.market_question) ?? s(x.market_id) ?? 'Market', side: s(x.side), action: s(x.taker_action), usd: n(x.usdc_value), price: n(x.price) })) : [];
    if (tr.status === 'rejected') errors.push(`Trades: ${errText(tr.reason)}`);
    return { summary, markets, trades, errors, tally };
  });
}
