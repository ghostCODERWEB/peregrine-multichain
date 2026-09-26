// On-demand perp reads: one coin's liquidation ladder, trade tape and PnL
// leaders, and the Hyperliquid trader leaderboard with copy-trade candidate
// scores. The ladder and tape are public-class (all traders, labels
// stripped in public views); the PnL leaders and the trader leaderboard are
// "prohibited" and exist only for the key owner and members.
import { traced, errText } from '@/server/nansen/traced';
import { requestDay } from '@/server/nansen/demo';
import { callScope, type CallTally } from '@/server/nansen/client';
import { leverageWave, type LeverageWave } from '@/server/token/terminal';
import type { Wave } from '@/server/token/waves';
import { copyScore, type TraderWindow, type CopyPart } from '@/lib/models/copy-score';
import type { Provenance } from '@/lib/provenance';
import { usd } from '@/lib/viz/format';

export const SYMBOL_RE = /^[A-Za-z0-9:._-]{1,32}$/;

export interface PerpTape {
  rows: Array<{ at: string; address: string; label: string | null; side: string | null; action: string; valueUsd: number | null; priceUsd: number | null; type: string | null; tx: string }>;
  provenance: Provenance;
}

export interface CoinPnl {
  rows: Array<{ address: string; label: string | null; pnlUsd: number | null; realizedUsd: number | null; unrealizedUsd: number | null; positionUsd: number | null; roi: number | null; trades: number | null }>;
  provenance: Provenance;
}

export interface CoinDetail {
  symbol: string;
  ladder: Wave<LeverageWave>;
  tape: PerpTape | { unavailable: string };
  pnl: CoinPnl | { unavailable: string } | null;
  tally: CallTally;
}

type Row = Record<string, unknown>;
const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const s = (v: unknown) => (typeof v === 'string' && v ? v : null);

export async function coinDetail(symbol: string, priv: boolean): Promise<CoinDetail> {
  const tally: CallTally = { calls: 0, credits: 0, cached: 0 };
  return callScope.run(tally, async () => {
    const tapeBody = { token_symbol: symbol, date: { from: requestDay(1), to: requestDay(0) }, pagination: { page: 1, per_page: 50 }, order_by: [{ field: 'value_usd', direction: 'DESC' }] };
    const pnlBody = { token_symbol: symbol, date: { from: requestDay(30), to: requestDay(0) }, pagination: { page: 1, per_page: 20 }, order_by: [{ field: 'pnl_usd_total', direction: 'DESC' }] };
    const [ladder, tape, pnl] = await Promise.all([
      leverageWave(symbol),
      // No generated schema here on purpose: this feed spells type "MARKET"
      // where the shared enum expects "Market", and a strict parse would
      // throw the whole tape away over a casing difference.
      traced<{ data: Row[] }>('tgm/perp-trades', tapeBody, 1).then((r): PerpTape => ({
        rows: (r.data.data ?? []).map((t) => ({
          at: s(t.block_timestamp) ?? '', address: s(t.trader_address) ?? '', label: s(t.trader_address_label), side: s(t.side), action: s(t.action) ?? '',
          valueUsd: n(t.value_usd), priceUsd: n(t.price_usd), type: s(t.type), tx: s(t.transaction_hash) ?? '',
        })),
        provenance: { title: `${symbol} perp trades, 24h, largest first`, formula: 'the 50 largest Hyperliquid trades in this coin over the last day, all traders', inputs: [], calls: [r.call], notes: [] },
      })).catch((e) => ({ unavailable: errText(e) })),
      priv
        ? traced<{ data: Row[] }>('tgm/perp-pnl-leaderboard', pnlBody, 5).then((r): CoinPnl => ({
          rows: (r.data.data ?? []).map((t) => ({
            address: s(t.trader_address) ?? '', label: s(t.trader_address_label), pnlUsd: n(t.pnl_usd_total), realizedUsd: n(t.pnl_usd_realised),
            unrealizedUsd: n(t.pnl_usd_unrealised), positionUsd: n(t.position_value_usd), roi: n(t.roi_percent_total), trades: n(t.nof_trades),
          })),
          provenance: { title: `Who made money on ${symbol} perps, 30 days`, formula: 'Nansen\'s perp PnL leaderboard for this coin (realized + unrealized)', inputs: [], calls: [r.call], notes: ['premium_labels stays off (it would cost 150 credits).'] },
        })).catch((e) => ({ unavailable: errText(e) }))
        : Promise.resolve(null),
    ]);
    return { symbol, ladder, tape, pnl, tally };
  });
}

// --------------------------------------------------------- trader leaders

export interface PerpLeader {
  address: string; label: string | null;
  pnl30: number | null; roi30: number | null; pnl7: number | null; accountValue: number | null; volume30: number | null; trades30: number | null;
  positions: TraderWindow['topPositions'];
  score: number; parts: CopyPart[];
}

export interface PerpLeaders { rows: PerpLeader[]; provenance: Provenance; tally: CallTally }

function toWindow(r: Row): TraderWindow {
  const tops = Array.isArray(r.top_positions) ? (r.top_positions as Row[]) : [];
  return {
    totalPnl: n(r.total_pnl), realizedPnl: n(r.realized_pnl_usd), unrealizedPnl: n(r.unrealized_pnl_usd), roi: n(r.roi), accountValue: n(r.account_value),
    topPositions: tops.map((p) => ({ coin: s(p.coin) ?? '?', side: s(p.side) ?? '?', valueUsd: n(p.position_value_usd) ?? 0, unrealizedUsd: n(p.unrealized_pnl_usd) ?? 0 })),
  };
}

/** Nansen's Hyperliquid leaderboard over 30 and 7 days (10 credits), with a copy-trade candidate score. */
export async function perpLeaders(): Promise<PerpLeaders> {
  const tally: CallTally = { calls: 0, credits: 0, cached: 0 };
  return callScope.run(tally, async () => {
    const body = (days: number) => ({ date: { from: requestDay(days), to: requestDay(0) }, pagination: { page: 1, per_page: 100 }, order_by: [{ field: 'total_pnl', direction: 'DESC' }] });
    const [m, w] = await Promise.all([traced<{ data: Row[] }>('perp-leaderboard', body(30), 5), traced<{ data: Row[] }>('perp-leaderboard', body(7), 5)]);
    const week = new Map((w.data.data ?? []).map((r) => [String(r.trader_address).toLowerCase(), toWindow(r)]));
    const rows: PerpLeader[] = (m.data.data ?? []).map((r) => {
      const d30 = toWindow(r), d7 = week.get(String(r.trader_address).toLowerCase()) ?? null;
      const c = copyScore(d30, d7);
      return {
        address: String(r.trader_address), label: s(r.trader_address_label), pnl30: d30.totalPnl, roi30: d30.roi, pnl7: d7?.totalPnl ?? null,
        accountValue: d30.accountValue, volume30: n(r.volume_usd), trades30: n(r.total_trades), positions: d30.topPositions, score: c.score, parts: c.parts,
      };
    }).sort((a, b) => b.score - a.score || (b.pnl30 ?? 0) - (a.pnl30 ?? 0));
    const top = rows[0];
    return {
      rows, tally,
      provenance: {
        title: 'Hyperliquid traders: copy-trade candidate score',
        formula: 'return = 25·tanh(ROI₃₀ ÷ 0.5)\nconsistency = +15 profitable over 7 and 30 days, −5 if the 7-day window lost\nbanked = 10·(realized share of 30-day PnL − 0.5), within ±5\nleverage = −15 × (open positions ÷ account − 3) ÷ 7, from 3× to 10×\nopen loss = −10 × losing open positions ÷ 20% of the account; small book (< $100K) −10; empty account −15\nscore = 50 + Σ, 0 to 100',
        inputs: [{ label: 'Traders scored', value: String(rows.length) }, { label: 'Top candidate', value: top ? `${top.score} · ${usd(top.pnl30, { signed: true })} over 30 days` : 'n/a' }],
        calls: [m.call, w.call],
        notes: ['The 100 most profitable traders of the last 30 days, re-ranked by the score; a 7-day result is known only for those also in the 7-day top 100.', 'A candidate score, not a recommendation: it has no track record until the M9 backtest.'],
      },
    };
  });
}
