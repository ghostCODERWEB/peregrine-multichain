import { StatStrip } from '@/components/StatStrip';
import { getDb } from '@/server/nansen/db';
import type { DisplayMode } from '@/server/mode';
import { chainName, pct, usd } from '@/lib/viz/format';

type Row = { chain: string; token_address: string; symbol: string | null; volume: number; buy_volume: number | null; sell_volume: number | null };

/** Spot state: tracked DEX activity from the scanner's latest 24h token read, plus Smart Money DEX trades (owner view). */
export function SpotState({ mode }: { mode: DisplayMode }) {
  const db = getDb();
  const now = Date.now();
  const latest = (at: number) => db.prepare(`
    SELECT p.chain, p.token_address, p.symbol, p.volume, p.buy_volume, p.sell_volume FROM token_pulse p
    JOIN (SELECT chain, token_address, MAX(snapshot_at) t FROM token_pulse WHERE window='24h' AND source='market-flow' AND snapshot_at <= ? AND snapshot_at >= ? GROUP BY chain, token_address) m
      ON m.chain = p.chain AND m.token_address = p.token_address AND m.t = p.snapshot_at
    WHERE p.window='24h' AND p.source='market-flow' AND p.volume > 0`).all(at, at - 36 * 3_600_000) as Row[];
  const cur = latest(now), prev = new Map(latest(now - 86_400_000).map((r) => [`${r.chain}:${r.token_address}`, r.volume]));
  if (!cur.length) return null;
  const vol = cur.reduce((a, r) => a + r.volume, 0);
  const buy = cur.reduce((a, r) => a + (r.buy_volume ?? 0), 0), sell = cur.reduce((a, r) => a + (r.sell_volume ?? 0), 0);
  const accel = cur.filter((r) => r.volume >= 250_000 && (prev.get(`${r.chain}:${r.token_address}`) ?? 0) > 0)
    .map((r) => ({ r, x: r.volume / prev.get(`${r.chain}:${r.token_address}`)! })).sort((a, b) => b.x - a.x)[0];
  const sm = mode === 'owner' ? db.prepare(`SELECT chain, token_address AS t, MAX(token_symbol) AS s, SUM(CASE WHEN side='buy' THEN usd_value ELSE -usd_value END) AS net, COUNT(DISTINCT wallet) AS w FROM smart_money_trades WHERE traded_at >= ? GROUP BY chain, token_address`).all(now - 86_400_000) as Array<{ chain: string; t: string; s: string | null; net: number; w: number }> : [];
  const smNet = sm.reduce((a, x) => a + x.net, 0);
  const bought = [...sm].sort((a, b) => b.net - a.net)[0], sold = [...sm].sort((a, b) => a.net - b.net)[0];
  const href = (c: string, t: string) => `/token/${c}/${encodeURIComponent(t)}`;
  return (
    <StatStrip className="rise" stats={[
      { label: 'Tracked DEX volume, 24h', value: usd(vol), note: `${cur.length.toLocaleString('en-US')} tokens in the latest scan` },
      { label: 'Buy / sell imbalance', value: buy + sell ? pct(buy / (buy + sell), 0) : 'n/a', note: `buys ${usd(buy)} · sells ${usd(sell)}`, tone: buy >= sell ? 'in' : 'out' },
      ...(mode === 'owner' ? [
        { label: 'Smart Money DEX net', value: usd(smNet, { signed: true }), tone: (smNet >= 0 ? 'in' : 'out') as 'in' | 'out', note: `${sm.length} tokens traded` },
        { label: 'Most bought by SM', value: bought && bought.net > 0 ? `${bought.s ?? '?'} ${usd(bought.net, { signed: true })}` : 'n/a', note: bought ? `${bought.w} wallets · ${chainName(bought.chain)}` : undefined, href: bought && href(bought.chain, bought.t), tone: 'in' as const, logo: bought && bought.net > 0 ? { symbol: bought.s, chain: bought.chain, address: bought.t } : undefined },
        { label: 'Most sold by SM', value: sold && sold.net < 0 ? `${sold.s ?? '?'} ${usd(sold.net, { signed: true })}` : 'n/a', note: sold ? `${sold.w} wallets · ${chainName(sold.chain)}` : undefined, href: sold && href(sold.chain, sold.t), tone: 'out' as const, logo: sold && sold.net < 0 ? { symbol: sold.s, chain: sold.chain, address: sold.t } : undefined },
      ] : []),
      { label: 'Fastest volume growth', value: accel ? `${accel.r.symbol ?? '?'} ${accel.x.toFixed(1)}x` : 'n/a', note: accel ? `${usd(accel.r.volume)} vs ${usd(accel.r.volume / accel.x)} a day earlier` : 'needs a day of scans', href: accel && href(accel.r.chain, accel.r.token_address), logo: accel ? { symbol: accel.r.symbol, chain: accel.r.chain, address: accel.r.token_address } : undefined },
    ]} />
  );
}
