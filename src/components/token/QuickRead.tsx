import Link from 'next/link';
import { AddressLink } from '@/components/entity/AddressLink';
import { getDb } from '@/server/nansen/db';
import type { DisplayMode } from '@/server/mode';
import { pct, usd } from '@/lib/viz/format';

type Pulse = { netflow: number | null; volume: number | null; buy_volume: number | null; sell_volume: number | null; price_change: number | null; snapshot_at: number };

/** Quick Read: the token's situation in one row, every fact from a stored
 *  Nansen read (scanner pulse, smart-money DEX trades, perp position reads). */
export function QuickRead({ chain, address, mode }: { chain: string; address: string; mode: DisplayMode }) {
  const db = getDb();
  const owner = mode === 'owner';
  const src = owner ? 'smart-money' : 'market-flow';
  const pulse = db.prepare(`SELECT netflow, volume, buy_volume, sell_volume, price_change, snapshot_at FROM token_pulse WHERE chain = ? AND lower(token_address) = lower(?) AND window = '24h' AND source = ? ORDER BY snapshot_at DESC LIMIT 1`).get(chain, address, src) as Pulse | undefined;
  const since = Date.now() - 86_400_000;
  const trades = owner ? (db.prepare(`SELECT wallet, MAX(wallet_label) AS label, SUM(CASE WHEN side='buy' THEN usd_value ELSE -usd_value END) AS net FROM smart_money_trades WHERE chain = ? AND lower(token_address) = lower(?) AND traded_at >= ? GROUP BY wallet ORDER BY net DESC`).all(chain, address, since) as Array<{ wallet: string; label: string | null; net: number }>) : [];
  const symbol = (db.prepare(`SELECT symbol FROM token_pulse WHERE chain = ? AND lower(token_address) = lower(?) AND symbol IS NOT NULL LIMIT 1`).get(chain, address) as { symbol: string } | undefined)?.symbol;
  const perp = owner && symbol ? (db.prepare(`SELECT positions, at FROM perp_position_snapshots WHERE symbol = ? ORDER BY at DESC LIMIT 1`).get(symbol.toUpperCase()) as { positions: string; at: number } | undefined) : undefined;
  let smLong = 0, smShort = 0, perpTotal = 0;
  if (perp) for (const p of JSON.parse(perp.positions) as Array<[string, string | null, number, number, ...unknown[]]>) {
    perpTotal += p[3];
    if (String(p[9] ?? '').includes('smart_money')) { if (p[2]) smLong += p[3]; else smShort += p[3]; }
  }
  if (!pulse && !trades.length && !perp) return null;

  const net = trades.reduce((a, t) => a + t.net, 0);
  const gross = trades.reduce((a, t) => a + Math.abs(t.net), 0);
  const top = trades.length ? [...trades].sort((a, b) => Math.abs(b.net) - Math.abs(a.net))[0] : null;
  const topShare = top && gross ? Math.abs(top.net) / gross : null;
  const buyer = trades.find((t) => t.net > 0) ?? null;
  const seller = [...trades].reverse().find((t) => t.net < 0) ?? null;
  const facts: Array<[string, React.ReactNode, React.ReactNode?]> = [];
  if (pulse) {
    facts.push([`${owner ? 'Smart Money' : 'All-trader'} net flow, 24h`, <span key="n" style={{ color: (pulse.netflow ?? 0) >= 0 ? 'var(--mint)' : 'var(--flare)' }}>{usd(pulse.netflow, { signed: true })}</span>, pulse.volume ? `${pct((pulse.netflow ?? 0) / pulse.volume, 1)} of ${usd(pulse.volume)} ${owner ? 'Smart Money ' : ''}volume` : null]);
    if (pulse.buy_volume != null && pulse.sell_volume != null) facts.push([owner ? 'Smart Money buys vs sells' : 'Buy vs sell volume', `${usd(pulse.buy_volume)} / ${usd(pulse.sell_volume)}`, pulse.price_change != null ? `price ${pulse.price_change > 0 ? "+" : ""}${pct(pulse.price_change, 1)} in 24h` : null]);
  }
  if (owner && trades.length) {
    // Recorded trade by trade from Nansen's DEX feed; it can differ from the screener's net flow above.
    facts.push(['Smart Money trades recorded, 24h', `${trades.length} wallet${trades.length === 1 ? '' : 's'} · ${usd(net, { signed: true })}`, topShare != null ? (topShare >= 0.5 ? `concentrated: one wallet is ${pct(topShare, 0)} of the flow` : `broad: largest wallet ${pct(topShare, 0)} of the flow`) : null]);
  }
  if (perp && perpTotal) facts.push([`${symbol} perps (observed)`, <Link prefetch={false} key="p" href={`/perps/${symbol!.toUpperCase()}`} className="hover:underline">{usd(perpTotal)}</Link>, smLong + smShort ? `Smart Money ${pct(smLong / (smLong + smShort), 0)} long` : 'no Smart Money positions']);
  const activity = pulse && perp ? 'Spot and perps' : perp ? 'Perps' : 'Spot';

  return (
    <section aria-label="Quick read" className="material rise p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[13.5px] font-bold text-ink">Quick read</h2>
        <span className="text-[11.5px] text-ink-muted">{activity} activity{pulse ? ` · scanner read ${new Date(pulse.snapshot_at).toISOString().slice(11, 16)} UTC` : ''}</span>
      </div>
      <ul className="stagger grid grid-cols-2 gap-px overflow-hidden rounded-[var(--r-inner)] border border-[var(--hair)] bg-[var(--hair)] lg:grid-cols-4">
        {facts.map(([k, v, note]) => (
          <li key={k} className="min-w-0 bg-[var(--surface-1)] px-3.5 py-2.5">
            <span className="block text-[11.5px] font-semibold text-ink-muted">{k}</span>
            <span className="num block truncate text-[16px] font-bold text-ink">{v}</span>
            {note && <span className="block truncate text-[11.5px] text-ink-2">{note}</span>}
          </li>
        ))}
      </ul>
      {owner && (buyer || seller) && (
        <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-ink-2">
          {buyer && <span className="flex items-center gap-1.5">Largest buyer <AddressLink address={buyer.wallet} label={buyer.label} /> <span className="num font-semibold text-[var(--mint)]">{usd(buyer.net, { signed: true })}</span></span>}
          {seller && <span className="flex items-center gap-1.5">Largest seller <AddressLink address={seller.wallet} label={seller.label} /> <span className="num font-semibold text-[var(--flare)]">{usd(seller.net, { signed: true })}</span></span>}
        </p>
      )}
    </section>
  );
}
