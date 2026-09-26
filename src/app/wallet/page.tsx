import Link from 'next/link';
import { ProfilerTabs } from '@/components/research/ProfilerTabs';
import type { Metadata } from 'next';
import { PageTitle } from '@/components/PageTitle';
import { StatStrip } from '@/components/StatStrip';
import { AddressLink } from '@/components/entity/AddressLink';
import { CohortBadges } from '@/components/entity/CohortBadges';
import { WalletJump } from '@/components/wallet/WalletJump';
import { getDb } from '@/server/nansen/db';
import { displayMode } from '@/server/mode';
import { usd } from '@/lib/viz/format';
import type { Cohort } from '@/lib/perps/positions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Profiler · Peregrine' };

type Active = { wallet: string; label: string | null; trades: number; net: number; bought: number; sold: number; top: string | null };

/** Profiler home: wallets worth opening right now, from data already stored. */
export default async function ProfilerHome() {
  const mode = await displayMode();
  const owner = mode === 'owner';
  const db = getDb();
  const since = Date.now() - 86_400_000;
  const active: Active[] = owner ? (db.prepare(`
    SELECT wallet, MAX(wallet_label) AS label, COUNT(*) AS trades,
      SUM(CASE WHEN side='buy' THEN usd_value ELSE -usd_value END) AS net,
      SUM(CASE WHEN side='buy' THEN usd_value ELSE 0 END) AS bought, SUM(CASE WHEN side='sell' THEN usd_value ELSE 0 END) AS sold,
      (SELECT token_symbol FROM smart_money_trades t2 WHERE t2.wallet = t.wallet AND t2.traded_at >= ? GROUP BY token_symbol ORDER BY SUM(usd_value) DESC LIMIT 1) AS top
    FROM smart_money_trades t WHERE traded_at >= ? GROUP BY wallet ORDER BY bought + sold DESC LIMIT 60`).all(since, since) as Active[]) : [];
  const perp: Array<{ symbol: string; address: string; label: string | null; side: string; value: number; cohorts: Cohort[] }> = [];
  if (owner) {
    const snaps = db.prepare(`SELECT s.symbol, s.positions FROM perp_position_snapshots s JOIN (SELECT symbol, MAX(at) t FROM perp_position_snapshots GROUP BY symbol) m ON m.symbol = s.symbol AND m.t = s.at`).all() as Array<{ symbol: string; positions: string }>;
    for (const s of snaps) for (const p of JSON.parse(s.positions) as Array<[string, string | null, number, number, ...unknown[]]>) {
      const cohorts = (String(p[9] ?? '') ? String(p[9]).split(',') : []) as Cohort[];
      if (cohorts.includes('smart_money')) perp.push({ symbol: s.symbol, address: p[0], label: p[1], side: p[2] ? 'Long' : 'Short', value: p[3], cohorts });
    }
    perp.sort((a, b) => b.value - a.value);
  }
  const buyers = [...active].filter((a) => a.net > 0).sort((a, b) => b.net - a.net).slice(0, 8);
  const sellers = [...active].filter((a) => a.net < 0).sort((a, b) => a.net - b.net).slice(0, 8);
  const totals = owner ? (db.prepare(`SELECT COUNT(DISTINCT wallet) AS n, SUM(CASE WHEN side='buy' THEN usd_value ELSE -usd_value END) AS net FROM smart_money_trades WHERE traded_at >= ?`).get(since) as { n: number; net: number | null }) : { n: 0, net: 0 };
  const net = totals.net ?? 0;
  const clean = (l: string | null | undefined, w?: string) => (l ?? '').replace(/\s*\[[^\]]*\]\s*$/, '').trim() || (w ? `${w.slice(0, 6)}…${w.slice(-4)}` : undefined);

  const list = (rows: Active[], tone: 'in' | 'out') => (
    <ol className="divide-y divide-[var(--hair)]">
      {rows.map((r) => (
        <li key={r.wallet} className="flex items-center gap-3 py-2 text-[13px]">
          <span className="min-w-0 flex-1"><AddressLink address={r.wallet} label={r.label} /><span className="block text-[11.5px] text-ink-muted">{r.trades} trades · mostly {r.top ?? 'n/a'}</span></span>
          <span className="num font-semibold" style={{ color: tone === 'in' ? 'var(--mint)' : 'var(--flare)' }}>{usd(r.net, { signed: true })}</span>
        </li>
      ))}
      {!rows.length && <li className="py-4 text-[12.5px] text-ink-muted">No Smart Money DEX trades recorded in 24 hours; the scanner fills this.</li>}
    </ol>
  );

  return (
    <div className="space-y-5">
      <PageTitle title="Profiler" pill="Wallets, portfolios and Hyperliquid traders" action={<WalletJump />} />
      <ProfilerTabs />
      {owner ? (
        <>
          <StatStrip className="rise" stats={[
            { label: 'Smart Money DEX net, 24h', value: usd(net, { signed: true }), tone: net >= 0 ? 'in' : 'out', note: `${totals.n} active wallets` },
            { label: 'Largest net buyer', value: buyers[0] ? usd(buyers[0].net, { signed: true }) : 'n/a', note: buyers[0] && clean(buyers[0].label, buyers[0].wallet), href: buyers[0] && `/wallet/${buyers[0].wallet}`, tone: 'in' },
            { label: 'Largest net seller', value: sellers[0] ? usd(sellers[0].net, { signed: true }) : 'n/a', note: sellers[0] && clean(sellers[0].label, sellers[0].wallet), href: sellers[0] && `/wallet/${sellers[0].wallet}`, tone: 'out' },
            { label: 'Largest SM perp position', value: perp[0] ? usd(perp[0].value) : 'n/a', note: perp[0] ? `${perp[0].side} ${perp[0].symbol}` : undefined, href: perp[0] && `/wallet/${perp[0].address}` },
          ]} />
          <div className="grid gap-4 xl:grid-cols-3">
            <section className="material min-w-0 p-4 sm:p-5"><h2 className="t-section mb-2">Top Smart Money buyers, 24h</h2>{list(buyers, 'in')}</section>
            <section className="material min-w-0 p-4 sm:p-5"><h2 className="t-section mb-2">Top Smart Money sellers, 24h</h2>{list(sellers, 'out')}</section>
            <section className="material min-w-0 p-4 sm:p-5">
              <h2 className="t-section mb-2">Largest Smart Money perp positions</h2>
              <ol className="divide-y divide-[var(--hair)]">
                {perp.slice(0, 8).map((p) => (
                  <li key={`${p.symbol}:${p.address}`} className="flex items-center gap-3 py-2 text-[13px]">
                    <span className="min-w-0 flex-1"><span className="flex items-center gap-1.5"><AddressLink address={p.address} label={p.label} /><CohortBadges cohorts={p.cohorts} /></span>
                      <span className="block text-[11.5px]" style={{ color: p.side === 'Long' ? 'var(--mint)' : 'var(--flare)' }}>{p.side} <Link href={`/perps/${p.symbol}`} className="font-semibold text-ink hover:underline">{p.symbol}</Link></span></span>
                    <span className="num font-semibold text-ink">{usd(p.value)}</span>
                  </li>
                ))}
                {!perp.length && <li className="py-4 text-[12.5px] text-ink-muted">Open a perp terminal (for example <Link href="/perps/BTC" className="font-semibold text-brand">BTC</Link>) to record position reads.</li>}
              </ol>
            </section>
          </div>
        </>
      ) : (
        <p className="material p-5 text-[13.5px] text-ink-2">Paste any wallet address above, or open one from a token, sector or perp page. Smart Money wallet lists are shown in the key owner&apos;s view.</p>
      )}
    </div>
  );
}
