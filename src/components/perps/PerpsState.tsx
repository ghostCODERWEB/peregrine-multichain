import { StatStrip, type Stat } from '@/components/StatStrip';
import { getDb } from '@/server/nansen/db';
import { perpBoard } from '@/server/perps/board';
import { perpChanges } from '@/server/perps/terminal';
import { spotPerpBoard } from '@/server/spot-perp';
import type { DisplayMode } from '@/server/mode';
import { pct, usd } from '@/lib/viz/format';

/** Perps quick view: funding extremes, Smart Money book and its largest change, divergences. Stored data only. */
export function PerpsState({ mode }: { mode: DisplayMode }) {
  const owner = mode === 'owner';
  const b = perpBoard(owner ? 'private' : 'public');
  const funded = b.coins.filter((c) => c.fundingApr != null && (c.openInterest ?? 0) >= 5e6);
  const hot = [...funded].sort((a, c) => c.fundingApr! - a.fundingApr!)[0], cold = [...funded].sort((a, c) => a.fundingApr! - c.fundingApr!)[0];
  const stats: Stat[] = [];
  if (hot) stats.push({ label: 'Highest funding', value: `${hot.symbol} ${pct(hot.fundingApr, 0)}`, note: `yearly · OI ${usd(hot.openInterest)} · longs pay`, href: `/perps/${encodeURIComponent(hot.symbol)}`, tone: 'out' });
  if (cold) stats.push({ label: 'Lowest funding', value: `${cold.symbol} ${pct(cold.fundingApr, 0)}`, note: `yearly · OI ${usd(cold.openInterest)} · shorts pay`, href: `/perps/${encodeURIComponent(cold.symbol)}`, tone: 'in' });
  if (owner) {
    const row = getDb().prepare(`SELECT positions FROM perp_position_snapshots WHERE symbol='BTC' ORDER BY at DESC LIMIT 1`).get() as { positions: string } | undefined;
    if (row) {
      let l = 0, s = 0;
      for (const p of JSON.parse(row.positions) as Array<[string, string | null, number, number, ...unknown[]]>) if (String(p[9] ?? '').includes('smart_money')) { if (p[2]) l += p[3]; else s += p[3]; }
      if (l + s) stats.push({ label: 'BTC Smart Money book', value: `${pct(l / (l + s), 0)} long`, note: `${usd(l)} long · ${usd(s)} short (observed)`, href: '/perps/BTC?cohort=smart_money', tone: l >= s ? 'in' : 'out' });
    }
    const big = (['BTC', 'ETH'] as const).flatMap((sym) => { const c = perpChanges(sym, 4 * 3_600_000); return 'unavailable' in c ? [] : c.changes.filter((x) => x.cohorts.includes('smart_money') && x.kind !== 'left-set').map((x) => ({ sym, x })); })
      .sort((a, z) => Math.abs(z.x.deltaUsd) - Math.abs(a.x.deltaUsd))[0];
    if (big) stats.push({ label: 'Largest SM position change, 4h', value: `${usd(big.x.deltaUsd, { signed: true })}`, note: `${(big.x.label ?? big.x.address.slice(0, 10)).replace(/\s*\[[^\]]*\]$/, '')} ${big.x.kind} ${big.x.side} ${big.sym}`, href: `/wallet/${big.x.address}`, tone: (big.x.deltaUsd >= 0) === (big.x.side === 'long') ? 'in' : 'out' });
  }
  const div = spotPerpBoard(owner ? 'private' : 'public').filter((d) => d.kind.startsWith('spot'));
  stats.push({ label: 'Spot vs perps divergence', value: `${div.length} coin${div.length === 1 ? '' : 's'}`, note: div.length ? div.slice(0, 3).map((d) => d.symbol).join(', ') : 'spot and perps agree where both lean', href: '/alpha' });
  return stats.length ? <StatStrip className="rise" stats={stats} /> : null;
}
