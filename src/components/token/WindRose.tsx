'use client';
import { useState } from 'react';
import { InfoPopover } from '@/components/InfoPopover';
import { flowClass, fillVar } from '@/lib/viz/scales';
import { usd } from '@/lib/viz/format';
import { WIND_SEGMENTS, WIND_TIMEFRAMES, type WindSegment, type WindTimeframe } from '@/lib/wind';
import type { WindWave } from '@/server/token/waves';

export const SEGMENT_LABEL: Record<WindSegment, string> = {
  smart_trader: 'Smart traders',
  top_pnl: 'Top PnL',
  public_figure: 'Public figures',
  whale: 'Whales',
  exchange: 'Exchanges',
  fresh_wallets: 'Fresh wallets',
};
// Around the compass: informed money on one side, retail/custody on the other.
const ORDER: WindSegment[] = ['smart_trader', 'top_pnl', 'public_figure', 'whale', 'exchange', 'fresh_wallets'];

export function windTitle(w: WindWave): string {
  const d = w.rings['1d'];
  const cells = WIND_SEGMENTS.map((s) => ({ s, v: d[s].netUsd })).filter((x) => x.v != null && x.v !== 0) as Array<{ s: WindSegment; v: number }>;
  if (!cells.length) return 'No labelled-segment flow in the last day';
  const buyer = [...cells].sort((a, b) => b.v - a.v)[0];
  const seller = [...cells].sort((a, b) => a.v - b.v)[0];
  if (buyer.v > 0 && seller.v < 0) return `${SEGMENT_LABEL[buyer.s]} buy ${usd(buyer.v)} while ${SEGMENT_LABEL[seller.s].toLowerCase()} sell ${usd(-seller.v)} (24h)`;
  const lead = buyer.v > 0 ? buyer : seller;
  const verb = lead.v > 0 ? 'buying' : 'selling';
  if (cells.length === 1) return `Only ${SEGMENT_LABEL[lead.s].toLowerCase()} moved in the last day: ${usd(lead.v, { signed: true })}`;
  return `Every segment with flow is net ${verb} — led by ${SEGMENT_LABEL[lead.s].toLowerCase()} (${usd(lead.v, { signed: true })}, 24h)`;
}

const W = 440, H = 340, CX = W / 2, CY = H / 2, R0 = 30, RING = 26, GAP = 2;

function arc(r1: number, r2: number, a1: number, a2: number): string {
  const p = (r: number, a: number) => `${(CX + r * Math.sin(a)).toFixed(2)},${(CY - r * Math.cos(a)).toFixed(2)}`;
  const large = a2 - a1 > Math.PI ? 1 : 0;
  return `M${p(r2, a1)} A${r2},${r2} 0 ${large} 1 ${p(r2, a2)} L${p(r1, a2)} A${r1},${r1} 0 ${large} 0 ${p(r1, a1)} Z`;
}

/**
 * The wind rose: one sector per wallet segment, one ring per window (1h
 * inside to 7d outside). Color is net flow on the diverging scale — amber
 * in, blue out — scaled within each ring, since a 7d total dwarfs a 1h one
 * and would wash the inner rings out. Exact USD on hover and in the table.
 */
export function WindRose({ w }: { w: WindWave }) {
  const [hover, setHover] = useState<{ s: WindSegment; tf: WindTimeframe } | null>(null);
  const [table, setTable] = useState(false);
  const step = (2 * Math.PI) / ORDER.length;
  const ringMax = Object.fromEntries(WIND_TIMEFRAMES.map((tf) => [tf, Math.max(0, ...ORDER.map((s) => Math.abs(w.rings[tf][s].netUsd ?? 0)))])) as Record<WindTimeframe, number>;
  const h = hover && w.rings[hover.tf][hover.s];

  return (
    <div>
      <div className="flex items-center justify-end gap-2">
        <button onClick={() => setTable((t) => !t)} className="text-[11.5px] text-ink-2 underline-offset-2 hover:text-ink hover:underline">{table ? 'Show rose' : 'Show numbers'}</button>
        <InfoPopover p={w.provenance} />
      </div>
      {table ? (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead><tr className="border-b border-border text-left text-[11px] text-ink-muted"><th className="py-1 font-normal">Segment</th>{WIND_TIMEFRAMES.map((tf) => <th key={tf} className="py-1 text-right font-normal">{tf}</th>)}</tr></thead>
            <tbody>
              {ORDER.map((s) => (
                <tr key={s} className="border-b border-border/50">
                  <td className="py-1 text-ink-2">{SEGMENT_LABEL[s]}</td>
                  {WIND_TIMEFRAMES.map((tf) => <td key={tf} className="num py-1 text-right text-ink">{w.rings[tf][s].netUsd == null ? '—' : usd(w.rings[tf][s].netUsd, { signed: true })}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative mx-auto max-w-[440px]">
          <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Wind rose: net flow by wallet segment and time window">
            {ORDER.map((s, i) => WIND_TIMEFRAMES.map((tf, j) => {
              const cell = w.rings[tf][s];
              const r1 = R0 + j * RING + GAP / 2, r2 = R0 + (j + 1) * RING - GAP / 2;
              const a1 = i * step - step / 2 + 0.02, a2 = (i + 1) * step - step / 2 - 0.02;
              const missing = cell.netUsd == null;
              const active = hover?.s === s && hover?.tf === tf;
              return (
                <path
                  key={`${s}-${tf}`}
                  d={arc(r1, r2, a1, a2)}
                  fill={missing ? 'none' : fillVar(flowClass(cell.netUsd!, ringMax[tf]))}
                  stroke={active ? 'var(--ink-1)' : missing ? 'var(--axis)' : 'none'}
                  strokeWidth={active ? 2 : 1}
                  strokeDasharray={missing && !active ? '3 3' : undefined}
                  onPointerEnter={() => setHover({ s, tf })}
                  onPointerLeave={() => setHover(null)}
                  className="cursor-default"
                />
              );
            }))}
            {ORDER.map((s, i) => {
              const a = i * step, r = R0 + WIND_TIMEFRAMES.length * RING + 14;
              const x = CX + r * Math.sin(a), y = CY - r * Math.cos(a);
              return <text key={s} x={x} y={y + 4} textAnchor={Math.abs(Math.sin(a)) < 0.2 ? 'middle' : Math.sin(a) > 0 ? 'start' : 'end'} className="fill-ink-2 text-[11px]">{SEGMENT_LABEL[s]}</text>;
            })}
            {WIND_TIMEFRAMES.map((tf, j) => (
              <text key={tf} x={CX + 3} y={CY - (R0 + j * RING + RING / 2) + 3} className="num pointer-events-none fill-ink-muted text-[8.5px]" style={{ paintOrder: 'stroke', stroke: 'var(--surface-1)', strokeWidth: 2.5 }}>{tf}</text>
            ))}
          </svg>
          {h && hover && (
            <div className="pointer-events-none absolute left-1/2 top-1/2 w-44 -translate-x-1/2 -translate-y-1/2 rounded-md border border-border bg-raised px-2.5 py-1.5 text-center text-[12px] shadow-md">
              <div className="num font-semibold text-ink">{h.netUsd == null ? 'no data' : usd(h.netUsd, { signed: true })}</div>
              <div className="text-ink-2">{SEGMENT_LABEL[hover.s]} · {hover.tf}</div>
              {h.wallets != null && <div className="text-[11px] text-ink-muted">{h.wallets} wallets</div>}
            </div>
          )}
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-ink-muted">
        <span><span className="mr-1 inline-block h-2 w-2 rounded-sm align-middle" style={{ background: 'var(--in-4)' }} />net buying</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-sm align-middle" style={{ background: 'var(--out-4)' }} />net selling</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-sm border border-dashed border-axis align-middle" />no data for that window</span>
        <span>rings: 1h (inner) → 7d (outer); shade is relative within each ring</span>
      </div>
    </div>
  );
}
