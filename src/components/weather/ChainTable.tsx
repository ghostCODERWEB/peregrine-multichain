'use client';
import Link from 'next/link';
import { ChainLogo } from '@/components/Logo';
import { InfoPopover } from '@/components/InfoPopover';
import { pressureClass, fillVar } from '@/lib/viz/scales';
import { chainName, num, signed, usd } from '@/lib/viz/format';
import type { ChainTile } from '@/server/weather/bulletin';

/** The map's table twin: every value the map draws, reachable without
 *  hovering or seeing color. */
export function ChainTable({ chains }: { chains: ChainTile[] }) {
  const rows = [...chains].sort((a, b) => (b.cpi ?? -1) - (a.cpi ?? -1));
  const win = (c: ChainTile, w: string) => c.windows.find((x) => x.window === w);
  return (
    <div tabIndex={0} role="region" aria-label="Chains table" className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-ink-muted">
            <th className="py-2 font-normal">Chain</th>
            <th className="py-2 font-normal">Tier</th>
            <th className="py-2 text-right font-normal">Flow</th>
            <th className="py-2 text-right font-normal">6h Δ</th>
            <th className="py-2 text-right font-normal">1h · 24h · 7d</th>
            <th className="py-2 text-right font-normal">Net flow 24h</th>
            <th className="py-2 text-right font-normal">Volume 24h</th>
            <th className="py-2 font-normal">Source</th>
            <th className="w-6" />
          </tr>
        </thead>
        <tbody className="num">
          {rows.map((c) => {
            const d24 = win(c, '24h');
            return (
              <tr key={c.chain} className="border-b border-border/60">
                <td className="py-1.5 font-sans">
                  <span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: c.cpi != null ? fillVar(pressureClass(c.cpi)) : 'transparent', outline: c.cpi == null ? '1px solid var(--axis)' : undefined }} aria-hidden />
                  <Link href={`/chain/${c.chain}`} className="inline-flex items-center gap-2 text-ink hover:underline"><ChainLogo chain={c.chain} size={16} />{chainName(c.chain)}</Link>
                </td>
                <td className="text-ink-2">{c.tier}</td>
                <td className="text-right text-ink">{c.cpi != null ? num(c.cpi) : 'n/a'}</td>
                <td className="text-right text-ink-2">{c.trend6h != null ? signed(c.trend6h) : 'n/a'}</td>
                <td className="text-right text-ink-2">
                  {['1h', '24h', '7d'].map((w) => { const x = win(c, w); return x ? num(x.cpi, 0) : 'n/a'; }).join(' · ')}
                </td>
                <td className="text-right text-ink">{d24 ? usd(d24.netFlowUsd, { signed: true }) : 'n/a'}</td>
                <td className="text-right text-ink-2">{d24 ? usd(d24.volumeUsd) : 'n/a'}</td>
                <td className="font-sans text-[12px] text-ink-muted">
                  {c.source === 'smart-money' ? 'smart money' : c.source === 'market-flow' ? 'market flow' : c.unavailable}
                </td>
                <td>{c.provenance && <InfoPopover p={c.provenance} />}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
