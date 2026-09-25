import Link from 'next/link';
import { ChainLogo } from '@/components/Logo';
import { chainName } from '@/lib/viz/format';
import type { ChainTile } from '@/server/weather/bulletin';

/** Flow Index as a tile grid, strongest accumulation first: only chains with
 *  a reading (a chain Nansen can't measure has nothing to show here; the
 *  table view and chain pages say why). Tint deepens with distance from
 *  neutral 50, mint for accumulation and flare for distribution; the value,
 *  an arrow and the band word carry the same meaning without colour. */
export function ChainGrid({ chains }: { chains: ChainTile[] }) {
  const tiles = chains.filter((c) => c.cpi != null).sort((a, b) => b.cpi! - a.cpi! || a.chain.localeCompare(b.chain));
  return (
    <ul className="grid grid-cols-2 gap-2 min-[520px]:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7" aria-label="Chains by Flow Index">
      {tiles.map((c) => <li key={c.chain}><Tile c={c} /></li>)}
    </ul>
  );
}

function Tile({ c }: { c: ChainTile }) {
  const v = Math.round(c.cpi!), d = (v - 50) / 50;
  const color = d >= 0 ? 'var(--mint)' : 'var(--flare)';
  const tint = Math.min(0.34, Math.abs(d) * 0.4);
  const band = v >= 65 ? 'Accumulation' : v <= 35 ? 'Distribution' : 'Neutral';
  const t = c.trend6h;
  return (
    <Link href={`/chain/${c.chain}`} aria-label={`${chainName(c.chain)}: Flow Index ${v}, ${band.toLowerCase()}${t != null ? `, ${t >= 0 ? 'up' : 'down'} ${Math.abs(Math.round(t))} in 6 hours` : ''}`}
      className="group block rounded-[14px] border border-[var(--hair)] p-3 transition-colors hover:border-[var(--hair-2)]"
      style={{ background: `linear-gradient(160deg, color-mix(in srgb, ${color} ${Math.round(tint * 100)}%, transparent), color-mix(in srgb, ${color} ${Math.round(tint * 40)}%, transparent))` }}>
      <div className="flex items-center gap-2">
        <ChainLogo chain={c.chain} size={18} />
        <span className="min-w-0 truncate text-[13px] font-bold text-ink">{chainName(c.chain)}</span>
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-2">
        <span className="num text-[24px] font-extrabold leading-none tracking-[-0.03em] text-ink">{v}</span>
        {t != null && Math.abs(t) >= 1 && (
          <span className="num text-[11.5px] font-bold" style={{ color: t >= 0 ? 'var(--mint)' : 'var(--flare)' }}>{t >= 0 ? '↑' : '↓'}{Math.abs(Math.round(t))} · 6h</span>
        )}
      </div>
      <div className="relative mt-2.5 h-1 rounded-full bg-ink/10" aria-hidden>
        <span className="absolute inset-y-[-2px] left-1/2 w-px bg-[var(--hair-2)]" />
        <span className="absolute inset-y-0 rounded-full" style={v >= 50 ? { left: '50%', width: `${(v - 50)}%`, background: color } : { right: '50%', width: `${(50 - v)}%`, background: color }} />
      </div>
      <div className="mt-1.5 text-[11px] font-semibold" style={{ color: band === 'Neutral' ? 'var(--ink-muted)' : color }}>{band}</div>
    </Link>
  );
}
