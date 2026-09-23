'use client';
import Link from 'next/link';
import { InfoPopover } from '@/components/InfoPopover';
import { chainName, num } from '@/lib/viz/format';
import type { ForecastWithProvenance } from '@/server/weather/bulletin';

const W = 220;
const H = 84;
const PAD = { l: 2, r: 2, t: 6, b: 6 };

/** Every multiple shares the same 0-100 y-scale and each one's own time
 *  span on x, so heights compare across chains — small multiples only work
 *  when the reader can compare them without reading axes. */
function Multiple({ f }: { f: ForecastWithProvenance }) {
  const pts = [...f.history.map((p) => ({ t: p.t, v: p.cpi })), ...f.points.map((p) => ({ t: p.t, v: p.forecast }))];
  if (!pts.length) return null;
  const t0 = pts[0].t;
  const t1 = pts.at(-1)!.t === t0 ? t0 + 1 : pts.at(-1)!.t;
  const x = (t: number) => PAD.l + ((t - t0) / (t1 - t0)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - v / 100) * (H - PAD.t - PAD.b);

  const hist = f.history.map((p) => `${x(p.t).toFixed(1)},${y(p.cpi).toFixed(1)}`).join(' ');
  const lastHist = f.history.at(-1)!;
  const fc = f.points.map((p) => `${x(p.t).toFixed(1)},${y(p.forecast).toFixed(1)}`);
  const fan = f.points.length
    ? `M${x(lastHist.t)},${y(lastHist.cpi)} ` +
      f.points.map((p) => `L${x(p.t).toFixed(1)},${y(p.high80).toFixed(1)}`).join(' ') + ' ' +
      [...f.points].reverse().map((p) => `L${x(p.t).toFixed(1)},${y(p.low80).toFixed(1)}`).join(' ') + ' Z'
    : null;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${chainName(f.chain)} pressure history${f.points.length ? ' and 24h forecast' : ''}`}>
      {[35, 50, 65].map((v) => (
        <line key={v} x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="var(--grid)" strokeWidth="1" />
      ))}
      {fan && <path d={fan} fill="var(--ink-1)" opacity="0.1" />}
      <polyline points={hist} fill="none" stroke="var(--ink-1)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {fc.length > 0 && (
        <polyline
          points={`${x(lastHist.t)},${y(lastHist.cpi)} ${fc.join(' ')}`}
          fill="none"
          stroke="var(--ink-2)"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.8"
        />
      )}
      <circle cx={x(lastHist.t)} cy={y(lastHist.cpi)} r="4" fill="var(--ink-1)" stroke="var(--surface-1)" strokeWidth="2" />
    </svg>
  );
}

export function ForecastStrip({ forecasts }: { forecasts: ForecastWithProvenance[] }) {
  if (!forecasts.length) return <p className="text-sm text-ink-2">No chain has a pressure reading yet.</p>;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {forecasts.map((f) => {
        const now = f.history.at(-1)?.cpi ?? null;
        const end = f.points.at(-1)?.forecast ?? null;
        return (
          <div key={f.chain} className="rounded-lg border border-border bg-surface p-2.5">
            <div className="mb-1 flex items-start justify-between gap-1">
              <Link href={`/chain/${f.chain}`} className="text-[12.5px] font-medium text-ink hover:underline">
                {chainName(f.chain)}
              </Link>
              <InfoPopover p={f.provenance} />
            </div>
            <div className="num mb-1 text-[11.5px] text-ink-2">
              {now != null ? num(now, 0) : '—'}
              {end != null ? ` → ${num(end, 0)} in 24h` : ` · ${f.sampleSize}/12 snapshots`}
            </div>
            <Multiple f={f} />
            <div className="num mt-1 text-[10.5px] text-ink-muted">
              {f.insufficient ? 'forecast unlocks at 12 snapshots' : `MAPE ${f.mape == null ? '—' : `${num(f.mape)}%`} · n=${f.sampleSize}`}
            </div>
          </div>
        );
      })}
    </div>
  );
}
