// A Hyperliquid trader in depth, for the Profiler: open positions, account
// margin, 30-day realized performance, recent fills (Nansen profiler/perp-*),
// plus where Peregrine's own position snapshots saw this wallet, with the
// Nansen label and cohorts those reads carried (no extra call).
import { traced, errText } from '@/server/nansen/traced';
import { callScope, type CallTally } from '@/server/nansen/client';
import { getDb } from '@/server/nansen/db';
import { requestDay } from '@/server/nansen/demo';
import { S_PerpPnlSummaryResponse, S_PerpPositionsResponse, S_PerpTradeResponse, type PerpPnlSummaryData } from '@/types/nansen/api.gen';
import type { Cohort } from '@/lib/perps/positions';

const n = (v: unknown) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

export interface TraderPosition {
  coin: string;
  side: 'long' | 'short';
  size: number | null;
  valueUsd: number | null;
  entry: number | null;
  liq: number | null;
  leverage: number | null;
  leverageType: string | null;
  marginUsd: number | null;
  roe: number | null;
  upnlUsd: number | null;
  fundingSinceOpenUsd: number | null;
  fundingAllTimeUsd: number | null;
}

export interface TraderFill {
  at: string; coin: string; side: string; action: string; price: number; size: number; valueUsd: number; closedPnl: number; feeUsd: number; tx: string; crossed: boolean;
}

export interface SeenIn { symbol: string; at: number; label: string | null; cohorts: Cohort[]; side: 'long' | 'short'; valueUsd: number }

export interface TraderPerps {
  address: string;
  label: string | null;
  cohorts: Cohort[];
  seenIn: SeenIn[];
  account: { valueUsd: number | null; marginUsedUsd: number | null; withdrawableUsd: number | null } | null;
  positions: TraderPosition[] | { unavailable: string };
  pnl30: PerpPnlSummaryData | { unavailable: string };
  fills: TraderFill[] | { unavailable: string };
  tally: CallTally;
}

/** Where stored terminal snapshots saw this address (latest snapshot per coin). */
export function seenInSnapshots(address: string): SeenIn[] {
  const a = address.toLowerCase();
  const rows = getDb().prepare(`
    SELECT s.symbol, s.at, s.positions FROM perp_position_snapshots s
    JOIN (SELECT symbol, MAX(at) AS at FROM perp_position_snapshots GROUP BY symbol) m ON m.symbol = s.symbol AND m.at = s.at
    WHERE instr(lower(s.positions), ?) > 0
  `).all(a) as Array<{ symbol: string; at: number; positions: string }>;
  return rows.flatMap((r) => (JSON.parse(r.positions) as Array<[string, string | null, number, number, ...unknown[]]>)
    .filter((p) => p[0].toLowerCase() === a)
    .map((p) => ({ symbol: r.symbol, at: r.at, label: p[1], side: p[2] ? 'long' as const : 'short' as const, valueUsd: p[3], cohorts: (String(p[9] ?? '') ? String(p[9]).split(',') : []) as Cohort[] })))
    .sort((x, y) => y.valueUsd - x.valueUsd);
}

export async function traderPerps(address: string): Promise<TraderPerps> {
  const tally: CallTally = { calls: 0, credits: 0, cached: 0 };
  return callScope.run(tally, async () => {
    const date = { from: requestDay(30), to: requestDay(0) };
    const [positions, summary, trades] = await Promise.allSettled([
      traced<unknown>('profiler/perp-positions', { address }, 1, { schema: S_PerpPositionsResponse }),
      traced<unknown>('profiler/perp-pnl-summary', { address, date }, 1, { schema: S_PerpPnlSummaryResponse }),
      traced<unknown>('profiler/perp-trades', { address, date, pagination: { page: 1, per_page: 100 } }, 1, { schema: S_PerpTradeResponse }),
    ]);
    const seenIn = seenInSnapshots(address);
    const label = seenIn.find((s) => s.label)?.label ?? null;
    const cohorts = [...new Set(seenIn.flatMap((s) => s.cohorts))];
    let account: TraderPerps['account'] = null;
    let pos: TraderPerps['positions'] = { unavailable: 'Positions unavailable.' };
    if (positions.status === 'fulfilled') {
      const d = (positions.value.data as { data: Record<string, unknown> & { assetPositions?: Array<{ position?: Record<string, unknown> | null }> } }).data;
      account = { valueUsd: n(d.margin_summary_account_value_usd), marginUsedUsd: n(d.margin_summary_total_margin_used_usd), withdrawableUsd: n(d.withdrawable) };
      pos = (d.assetPositions ?? []).flatMap((a) => {
        const p = a.position;
        if (!p) return [];
        const size = n(p.size);
        return [{
          coin: String(p.token_symbol ?? 'n/a'), side: (size ?? 0) < 0 ? 'short' as const : 'long' as const, size: size == null ? null : Math.abs(size),
          valueUsd: n(p.position_value_usd), entry: n(p.entry_price_usd), liq: n(p.liquidation_price_usd), leverage: n(p.leverage_value),
          leverageType: typeof p.leverage_type === 'string' ? p.leverage_type : null, marginUsd: n(p.margin_used_usd), roe: n(p.return_on_equity),
          upnlUsd: n(p.unrealized_pnl_usd), fundingSinceOpenUsd: n(p.cumulative_funding_since_open_usd), fundingAllTimeUsd: n(p.cumulative_funding_all_time_usd),
        }];
      }).sort((x, y) => (y.valueUsd ?? 0) - (x.valueUsd ?? 0));
    } else pos = { unavailable: errText(positions.reason) };
    const pnl30 = summary.status === 'fulfilled' ? (summary.value.data as { data: PerpPnlSummaryData }).data : { unavailable: errText(summary.reason) };
    const fills = trades.status === 'fulfilled'
      ? ((trades.value.data as { data: Array<Record<string, unknown>> }).data ?? []).map((t) => ({
          at: String(t.timestamp ?? ''), coin: String(t.token_symbol ?? ''), side: String(t.side ?? ''), action: String(t.action ?? ''), price: Number(t.price ?? 0),
          size: Number(t.size ?? 0), valueUsd: Number(t.value_usd ?? 0), closedPnl: Number(t.closed_pnl ?? 0), feeUsd: Number(t.fee_usd ?? 0), tx: String(t.transaction_hash ?? ''), crossed: !!t.crossed,
        }))
      : { unavailable: errText(trades.reason) };
    return { address, label, cohorts, seenIn, account, positions: pos, pnl30, fills, tally };
  });
}
