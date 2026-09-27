// The top-bar ticker: live readings across the app, from the scanner's stored
// Nansen reads (no call per view), each linking to its page.
import { isRiskListable } from '@/lib/models/trade-side';
import { getDb } from '@/server/nansen/db';
import { navStatus } from '@/server/nav-status';
import { perpBoard } from '@/server/perps/board';
import { viewOf, type DisplayMode } from '@/server/mode';
import { properAddress } from '@/server/nansen/address-case';
import { price, usd } from '@/lib/viz/format';
import { liveMemo } from '@/server/live-memo';

export interface TickerItem { key: string; label: string; value: string; href: string; tone?: 'in' | 'out'; logo?: { symbol: string; coin?: string; chain?: string; address?: string } }

const NAMES: Array<[string, string]> = [['/smart-money', 'Smart Money'], ['/flows', 'Chain flows'], ['/perps', 'Perps'], ['/predict', 'Predictions'], ['/sectors', 'Sectors'], ['/', 'Chains'], ['/alpha', 'Alpha']];
const chg = (v: number) => `${v >= 0 ? '▲' : '▼'} ${Math.abs(v * 100).toFixed(2)}%`;

/** Rendered on every page, so memoized for a minute like the nav status it reads. */
export function tickerItems(mode: DisplayMode, now = Date.now()): TickerItem[] {
  return liveMemo(`ticker:${mode}`, now, 60_000, () => buildTicker(mode, now));
}

function buildTicker(mode: DisplayMode, now: number): TickerItem[] {
  const out: TickerItem[] = [];
  const st = navStatus(mode, now);
  const db = getDb();
  try {
    const coins = perpBoard(viewOf(mode), now).coins;
    for (const sym of ['BTC', 'ETH', 'SOL', 'HYPE']) {
      const c = coins.find((x) => x.symbol === sym);
      if (c?.markPrice) out.push({ key: `px-${sym}`, label: sym, value: `${price(c.markPrice)} ${c.change24h != null ? chg(c.change24h) : ''}`, href: `/perps/${sym}`, tone: (c.change24h ?? 0) >= 0 ? 'in' : 'out', logo: { symbol: sym, coin: sym } });
    }
    const big = coins.filter((c) => (c.openInterest ?? 0) >= 5e6 && c.change24h != null);
    const up = [...big].sort((a, b) => b.change24h! - a.change24h!)[0], dn = [...big].sort((a, b) => a.change24h! - b.change24h!)[0];
    if (up) out.push({ key: 'gain', label: 'Top perp gainer', value: `${up.symbol} ${chg(up.change24h!)}`, href: `/perps/${encodeURIComponent(up.symbol)}`, tone: 'in', logo: { symbol: up.symbol, coin: up.symbol } });
    if (dn) out.push({ key: 'loss', label: 'Top perp loser', value: `${dn.symbol} ${chg(dn.change24h!)}`, href: `/perps/${encodeURIComponent(dn.symbol)}`, tone: 'out', logo: { symbol: dn.symbol, coin: dn.symbol } });
    const f = [...big].filter((c) => c.fundingApr != null).sort((a, b) => Math.abs(b.fundingApr!) - Math.abs(a.fundingApr!))[0];
    if (f) out.push({ key: 'fund', label: 'Funding extreme', value: `${f.symbol} ${(f.fundingApr! * 100).toFixed(0)}% a year`, href: `/perps/${encodeURIComponent(f.symbol)}`, tone: f.fundingApr! >= 0 ? 'in' : 'out', logo: { symbol: f.symbol, coin: f.symbol } });
  } catch { /* no perp snapshot yet */ }
  for (const [href, label] of NAMES) if (st[href]) out.push({ key: href, label, value: st[href].text, href, tone: st[href].tone });
  if (mode === 'owner') {
    try {
      const sell = db.prepare(`SELECT chain, token_address AS t, MAX(token_symbol) AS s, SUM(CASE WHEN side='buy' THEN usd_value ELSE -usd_value END) AS net FROM smart_money_trades WHERE traded_at >= ? AND token_symbol IS NOT NULL GROUP BY chain, token_address ORDER BY net ASC LIMIT 1`).get(now - 86_400_000) as { chain: string; t: string; s: string; net: number } | undefined;
      if (sell && sell.net < 0) out.push({ key: 'smsell', label: 'Top SM sell', value: `${sell.s} ${usd(sell.net, { signed: true })}`, href: `/token/${sell.chain}/${encodeURIComponent(properAddress(sell.chain, sell.t))}`, tone: 'out', logo: { symbol: sell.s, chain: sell.chain, address: properAddress(sell.chain, sell.t) } });
      const big = db.prepare(`SELECT chain, token_address AS t, token_symbol AS s, side, usd_value AS v FROM smart_money_trades WHERE traded_at >= ? ORDER BY usd_value DESC LIMIT 1`).get(now - 86_400_000) as { chain: string; t: string; s: string | null; side: string; v: number } | undefined;
      if (big) out.push({ key: 'smbig', label: 'Largest SM trade', value: `${big.side === 'buy' ? 'Bought' : 'Sold'} ${usd(big.v)} ${big.s ?? ''}`, href: `/token/${big.chain}/${encodeURIComponent(properAddress(big.chain, big.t))}`, tone: big.side === 'buy' ? 'in' : 'out', logo: big.s ? { symbol: big.s, chain: big.chain, address: properAddress(big.chain, big.t) } : undefined });
    } catch { /* no trades yet */ }
  }
  try {
    // Each token's latest score (an older, higher reading would disagree with every other list), highest first.
    const r = (db.prepare(`SELECT s.chain, s.token_address AS t, s.symbol, s.score FROM storm_scores s
      JOIN (SELECT MAX(id) AS id FROM storm_scores WHERE computed_at >= ? GROUP BY chain, token_address) m ON m.id = s.id
      WHERE COALESCE(s.symbol, '') <> '' AND s.sub_scores LIKE '%"v":2%' ORDER BY s.score DESC LIMIT 20`).all(now - 2 * 86_400_000) as Array<{ chain: string; t: string; symbol: string; score: number }>)
      .find((x) => isRiskListable(x.symbol));
    if (r) out.push({ key: 'risk', label: 'Highest Token Score', value: `${r.symbol} ${Math.round(r.score)}`, href: `/token/${r.chain}/${encodeURIComponent(properAddress(r.chain, r.t))}`, tone: 'out', logo: { symbol: r.symbol, chain: r.chain, address: properAddress(r.chain, r.t) } });
  } catch { /* no scores */ }
  return out;
}
