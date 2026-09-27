'use client';
import Link from 'next/link';
import { InfoPopover } from '@/components/InfoPopover';
import { flowClass, fillVar } from '@/lib/viz/scales';
import { chainName, usd } from '@/lib/viz/format';
import type { FlowSection, TokenFlow } from '@/server/weather/chain-page';
import { Go, Back } from '@/components/ui/Icons';

export function flowsTitle(chain: string, f: FlowSection): string {
  const who = f.kind === 'market-flow' ? 'all-trader' : 'smart-money';
  const top = f.inflows[0], bottom = f.outflows[0];
  if (!top && !bottom) return `No ${who} token flows on ${chainName(chain)} in 24h`;
  const parts = [];
  if (top) parts.push(`${top.symbol} leads ${who} inflows on ${chainName(chain)}`);
  if (bottom) parts.push(`${bottom.symbol} leads outflows`);
  return parts.join('; ');
}

/** One diverging bar chart: inflows grow right from the centre baseline,
 *  outflows grow left, both on the same USD scale so lengths compare. */
export function FlowBars({ chain, f }: { chain: string; f: FlowSection }) {
  if (f.kind === 'unavailable') return <p className="text-sm text-ink-2">{f.unavailable}</p>;
  const rows: TokenFlow[] = [...f.inflows, ...[...f.outflows].reverse()];
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.netFlowUsd)));
  // Two tokens can share a symbol (bridged WBTC variants on Sui); the
  // address tail tells them apart.
  const seen = new Map<string, number>();
  for (const r of rows) seen.set(r.symbol, (seen.get(r.symbol) ?? 0) + 1);
  const label = (r: TokenFlow) => (seen.get(r.symbol)! > 1 ? `${r.symbol} ·${r.address.slice(-4)}` : r.symbol);
  return (
    <div>
      <div className="flex justify-end">{f.provenance && <InfoPopover p={f.provenance} />}</div>
      <ul className="space-y-1" aria-label="Token net flows, 24h">
        {rows.map((r) => {
          // Longest bar reaches 34% of the row from centre, leaving the
          // remaining 16% for its value label so nothing clips at the edge.
          const w = (Math.abs(r.netFlowUsd) / max) * 34;
          const pos = r.netFlowUsd > 0;
          return (
            <li key={`${r.address}-${pos}`} className="group grid grid-cols-[6.5rem_1fr] items-center gap-2 text-[12px]">
              <Link prefetch={false} href={`/token/${chain}/${r.address}`} className="truncate text-ink hover:underline" title={`${r.symbol} ${r.address}`}>
                {label(r)}
              </Link>
              <div className="relative h-5">
                <div className="absolute inset-y-0 left-1/2 w-px bg-axis" aria-hidden />
                <div
                  className="absolute top-1/2 h-3.5 -translate-y-1/2 transition-[filter] group-hover:brightness-110"
                  style={{
                    background: fillVar(flowClass(r.netFlowUsd, max)),
                    width: `${w}%`,
                    [pos ? 'left' : 'right']: '50%',
                    borderRadius: pos ? '0 4px 4px 0' : '4px 0 0 4px',
                  }}
                  aria-hidden
                />
                <span
                  className="num absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-[11px] text-ink-2"
                  style={pos ? { left: `calc(50% + ${w}% + 6px)` } : { right: `calc(50% + ${w}% + 6px)` }}
                >
                  {usd(r.netFlowUsd, { signed: true })}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-2 flex justify-between text-[11px] text-ink-muted">
        <span><Back /> outflow</span>
        <span>inflow <Go /></span>
      </div>
    </div>
  );
}
