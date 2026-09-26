'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChainLogo } from '@/components/Logo';
import { chainName } from '@/lib/viz/format';
import type { ChainTile } from '@/server/weather/bulletin';
import { Up, Down } from '@/components/ui/Icons';

/** Flow Index as a tile grid, strongest accumulation first: only chains with
 *  a reading (a chain Nansen can't measure has nothing to show here; the
 *  table view and chain pages say why). Tint deepens with distance from
 *  neutral 50, mint for accumulation and flare for distribution; the value,
 *  an arrow and the band word carry the same meaning without colour. */
export function ChainGrid({ chains, brief = 0 }: { chains: ChainTile[]; /** show only the n strongest and n weakest until expanded */ brief?: number }) {
  const [all, setAll] = useState(false);
  // Wide screens have room for every chain.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1920px)');
    const sync = () => setAll((a) => a || mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  const tiles = chains.filter((c) => c.cpi != null).sort((a, b) => b.cpi! - a.cpi! || a.chain.localeCompare(b.chain));
  const cut = brief > 0 && !all && tiles.length > brief * 2;
  const shown = cut ? [...tiles.slice(0, brief), ...tiles.slice(-brief)] : tiles;
  return (
    <>
      <ul className="stagger grid grid-cols-2 gap-2 min-[520px]:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 3xl:grid-cols-9 4xl:grid-cols-10" aria-label="Chains by Flow Index">
        {shown.map((c) => <li key={c.chain}><Tile c={c} /></li>)}
      </ul>
      {brief > 0 && tiles.length > brief * 2 && (
        <button type="button" onClick={() => setAll(!all)} aria-expanded={all} className="mt-3 text-[12.5px] font-bold text-brand">
          {all ? 'Show strongest and weakest only' : `Show all ${tiles.length} chains`}
        </button>
      )}
    </>
  );
}

function Tile({ c }: { c: ChainTile }) {
  const v = Math.round(c.cpi!), d = (v - 50) / 50;
  const color = d >= 0 ? 'var(--mint)' : 'var(--flare)';
  const band = v >= 65 ? 'Accumulation' : v <= 35 ? 'Distribution' : 'Neutral';
  // Colour is reserved for a signal: neutral tiles stay quiet.
  const tint = band === 'Neutral' ? 0 : Math.min(0.24, Math.abs(d) * 0.34);
  const t = c.trend6h;
  return (
    <Link href={`/chain/${c.chain}`} aria-label={`${chainName(c.chain)}: Flow Index ${v}, ${band.toLowerCase()}${t != null ? `, ${t >= 0 ? 'up' : 'down'} ${Math.abs(Math.round(t))} in 6 hours` : ''}`}
      className="group block rounded-[var(--r-inner)] border border-[var(--hair)] p-3.5 transition-[border-color,transform] duration-[var(--dur-fast)] ease-[var(--ease-out)] hover:-translate-y-px hover:border-[var(--hair-2)]"
      style={{ background: tint ? `linear-gradient(160deg, color-mix(in srgb, ${color} ${Math.round(tint * 100)}%, transparent), color-mix(in srgb, ${color} ${Math.round(tint * 30)}%, transparent))` : 'color-mix(in srgb, var(--ink-1) 3%, transparent)' }}>
      <div className="flex items-center gap-2">
        <ChainLogo chain={c.chain} size={18} />
        <span className="min-w-0 truncate text-[13px] font-bold text-ink">{chainName(c.chain)}</span>
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-2">
        <span className="num text-[24px] font-extrabold leading-none tracking-[-0.03em] text-ink">{v}</span>
        {t != null && Math.abs(t) >= 1 && (
          <span className="num text-[11.5px] font-bold" style={{ color: t >= 0 ? 'var(--mint)' : 'var(--flare)' }}>{t >= 0 ? <Up /> : <Down />}{Math.abs(Math.round(t))} · 6h</span>
        )}
      </div>
      <div className="relative mt-2.5 h-1 rounded-full bg-ink/10" aria-hidden>
        <span className="absolute inset-y-[-2px] left-1/2 w-px bg-[var(--hair-2)]" />
        <span className="absolute inset-y-0 rounded-full" style={{ ...(v >= 50 ? { left: '50%', width: `${v - 50}%` } : { right: '50%', width: `${50 - v}%` }), background: band === 'Neutral' ? 'var(--ink-muted)' : color }} />
      </div>
      <div className="mt-1.5 text-[11px] font-semibold" style={{ color: band === 'Neutral' ? 'var(--ink-muted)' : color }}>{band}</div>
    </Link>
  );
}
