'use client';
import Link from 'next/link';
import { InfoPopover } from '@/components/InfoPopover';
import { usd, walletName } from '@/lib/viz/format';
import type { HoldersWave, Trader } from '@/server/token/waves';
import { Go, Back } from '@/components/ui/Icons';

export function tradersTitle(h: HoldersWave): string {
  const b = h.buyers.reduce((s, x) => s + x.boughtUsd, 0);
  const s = h.sellers.reduce((a, x) => a + x.soldUsd, 0);
  if (!b && !s) return 'No large buyers or sellers this week';
  if (b >= s) return `Top buyers outweigh top sellers ${b && s ? `${(b / s).toFixed(1)}×` : ''} this week (${usd(b)} vs ${usd(s)})`;
  return `Top sellers outweigh top buyers ${b ? `${(s / b).toFixed(1)}×` : ''} this week (${usd(s)} vs ${usd(b)})`;
}

/** Top ten buyers grow right, top ten sellers grow left, one shared USD
 *  scale. Bars in cluster-member wallets would be marked once forensics
 *  lands (the P sub-score reads the same set). */
export function BuyersSellers({ h, clustered }: { h: HoldersWave; clustered: Set<string> }) {
  const rows: Array<Trader & { side: 'buy' | 'sell'; v: number }> = [
    ...h.buyers.slice(0, 10).map((x) => ({ ...x, side: 'buy' as const, v: x.boughtUsd })),
    ...h.sellers.slice(0, 10).map((x) => ({ ...x, side: 'sell' as const, v: -x.soldUsd })),
  ];
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.v)));
  return (
    <div>
      <div className="flex justify-end">{h.provenance.traders && <InfoPopover p={h.provenance.traders} />}</div>
      <ul className="space-y-1" aria-label="Top buyers and sellers, 7 days">
        {rows.map((r) => {
          const w = (Math.abs(r.v) / max) * 34;
          const pos = r.side === 'buy';
          const insider = clustered.has(r.address.toLowerCase());
          return (
            <li key={`${r.address}-${r.side}`} className="grid grid-cols-[7.5rem_1fr] items-center gap-2 text-[12px]">
              <Link href={`/wallet/${r.address}`} className="block truncate text-ink-2 hover:text-ink hover:underline" title={r.label ?? r.address}>
                {insider && <span className="mr-1 inline-block h-2 w-2 rounded-full align-middle" style={{ background: 'var(--storm-3)' }} title="In an insider cluster" />}
                {walletName(r.label, r.address)}
              </Link>
              <div className="relative h-5">
                <div className="absolute inset-y-0 left-1/2 w-px bg-axis" aria-hidden />
                <div
                  className="absolute top-1/2 h-3.5 -translate-y-1/2"
                  style={{ background: pos ? 'var(--in-3)' : 'var(--out-3)', width: `${w}%`, [pos ? 'left' : 'right']: '50%', borderRadius: pos ? '0 4px 4px 0' : '4px 0 0 4px' }}
                  aria-hidden
                />
                <span className="num absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-[11px] text-ink-2" style={pos ? { left: `calc(50% + ${w}% + 6px)` } : { right: `calc(50% + ${w}% + 6px)` }}>
                  {usd(r.v, { signed: true })}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-2 flex justify-between text-[11px] text-ink-muted">
        <span><Back /> sold</span>
        {clustered.size > 0 && <span><span className="mr-1 inline-block h-2 w-2 rounded-full align-middle" style={{ background: 'var(--storm-3)' }} />insider cluster member</span>}
        <span>bought <Go /></span>
      </div>
    </div>
  );
}
