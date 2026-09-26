import Link from 'next/link';
import { getDb } from '@/server/nansen/db';
import { seenInSnapshots } from '@/server/perps/trader';
import { chainName, pct, usd } from '@/lib/viz/format';

/** Wallet fingerprint: measurable facts from stored Nansen reads, each with its calculation. Owner view. */
export function WalletQuickRead({ address }: { address: string }) {
  const db = getDb();
  const since = Date.now() - 7 * 86_400_000;
  const spot = db.prepare(`SELECT COUNT(*) AS n, SUM(usd_value) AS vol, SUM(CASE WHEN side='buy' THEN usd_value ELSE -usd_value END) AS net, COUNT(DISTINCT token_address) AS tokens, COUNT(DISTINCT chain) AS chains FROM smart_money_trades WHERE lower(wallet) = lower(?) AND traded_at >= ?`).get(address, since) as { n: number; vol: number | null; net: number | null; tokens: number; chains: number };
  const top = db.prepare(`SELECT chain, token_address AS t, MAX(token_symbol) AS s, SUM(usd_value) AS v FROM smart_money_trades WHERE lower(wallet) = lower(?) AND traded_at >= ? GROUP BY chain, token_address ORDER BY v DESC LIMIT 1`).get(address, since) as { chain: string; t: string; s: string | null; v: number } | undefined;
  const perps = seenInSnapshots(address);
  const perpUsd = perps.reduce((a, p) => a + p.valueUsd, 0);
  if (!spot.n && !perps.length) return null;
  const spotVol = spot.vol ?? 0;
  const lean = spotVol && perpUsd ? (perpUsd > spotVol * 3 ? 'Mostly perps' : spotVol > perpUsd * 3 ? 'Mostly spot' : 'Spot and perps') : perpUsd ? 'Perps' : 'Spot';
  const facts: Array<[string, React.ReactNode, string]> = [
    ['Activity', lean, 'Smart Money DEX volume (7d, scanner) against observed open perp value'],
    ['Spot, 7d', spot.n ? `${spot.n} trades · ${usd(spotVol)}` : 'none recorded', spot.n ? `net ${usd(spot.net, { signed: true })} across ${spot.tokens} tokens on ${spot.chains} chains` : 'only Smart Money wallets are recorded'],
    ['Most traded', top ? <Link key="t" href={`/token/${top.chain}/${encodeURIComponent(top.t)}`} className="hover:underline">{top.s ?? top.t.slice(0, 6)}</Link> : 'n/a', top ? `${usd(top.v)} · ${pct(top.v / Math.max(1, spotVol), 0)} of its 7d volume · ${chainName(top.chain)}` : ''],
    ['Perps (observed)', perps.length ? usd(perpUsd) : 'none', perps.length ? perps.slice(0, 3).map((p) => `${p.side} ${p.symbol} ${usd(p.valueUsd)}`).join(' · ') : 'not in Peregrine\'s position reads'],
  ];
  return (
    <section aria-label="Wallet quick read" className="material rise p-4 sm:p-5">
      <h2 className="mb-3 text-[13.5px] font-bold text-ink">Quick read</h2>
      <ul className="stagger grid grid-cols-2 gap-px overflow-hidden rounded-[var(--r-inner)] border border-[var(--hair)] bg-[var(--hair)] lg:grid-cols-4">
        {facts.map(([k, v, note]) => (
          <li key={k} className="min-w-0 bg-[var(--surface-1)] px-3.5 py-2.5" title={note}>
            <span className="block text-[11.5px] font-semibold text-ink-muted">{k}</span>
            <span className="num block truncate text-[16px] font-bold text-ink">{v}</span>
            <span className="block truncate text-[11.5px] text-ink-2">{note}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
