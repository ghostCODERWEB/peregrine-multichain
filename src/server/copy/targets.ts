// Copy Lab's "All" view: one list of the traders worth following, whatever
// they trade. Each market keeps its own copy score (0 to 100, from 50 up or
// down), so the list interleaves them by score rather than comparing PnL
// across markets that are not alike.
import type { Leaders, Timeframe, TraderKind } from './leaders';
import type { PmLeaders } from './predict-leaders';
import type { PerpLeaders } from '@/server/perps/detail';
import { usd } from '@/lib/viz/format';

export type CopyMarket = 'spot' | 'perps' | 'predict';
export interface CopyTarget {
  market: CopyMarket; address: string; label: string | null; kind: TraderKind | null;
  score: number; pnl: number | null; pnlLabel: string; record: string; now: string | null;
}

const pc = (x: number | null | undefined) => (x == null ? 'n/a' : `${Math.round(x * 100)}%`);

export function copyTargets(src: { spot: Leaders | null; perps: PerpLeaders | null; predict: PmLeaders | null }, tf: Timeframe): CopyTarget[] {
  const out: CopyTarget[] = [];
  for (const l of src.spot?.leaders ?? []) {
    const w = l.windows[tf]!;
    const last = l.recent[0];
    out.push({
      market: 'spot', address: l.address, label: l.label, kind: l.kind, score: l.score, pnl: w.pnl, pnlLabel: `${tf}D`,
      record: `win ${pc(w.winRate)} · ${w.tokens} tokens · ${w.trades.toLocaleString('en-US')} trades`,
      now: last ? `bought ${last.symbol ?? last.token.slice(0, 6)} ${usd(last.usd)}` : l.holdings.length ? `holds ${l.holdings.slice(0, 3).map((h) => h.symbol ?? '?').join(', ')}` : null,
    });
  }
  for (const r of src.perps?.rows ?? []) {
    out.push({
      market: 'perps', address: r.address, label: r.label, kind: null, score: r.score, pnl: r.pnl30, pnlLabel: '30D',
      record: `ROI ${r.roi30 == null ? 'n/a' : `${r.roi30 >= 0 ? '+' : ''}${Math.round(r.roi30 * 100)}%`} · 7D ${usd(r.pnl7, { signed: true })} · account ${usd(r.accountValue)}`,
      now: r.positions.length ? r.positions.slice(0, 3).map((p) => `${p.coin} ${/short/i.test(p.side) ? 'short' : 'long'}`).join(', ') : null,
    });
  }
  for (const l of src.predict?.leaders ?? []) {
    out.push({
      market: 'predict', address: l.address, label: null, kind: null, score: l.score, pnl: l.totalPnl, pnlLabel: 'lifetime',
      record: `win ${pc(l.winRate)} · ${l.marketsTraded ?? 'n/a'} markets`,
      now: l.wins[0] ? `${l.wins[0].side ? `${l.wins[0].side} on ` : ''}${l.wins[0].question}` : null,
    });
  }
  return out.sort((a, b) => b.score - a.score || (b.pnl ?? 0) - (a.pnl ?? 0));
}
