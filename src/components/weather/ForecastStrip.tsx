'use client';
import Link from 'next/link';
import { InfoPopover } from '@/components/InfoPopover';
import { ChainLogo } from '@/components/Logo';
import { chainName, num } from '@/lib/viz/format';
import type { ForecastWithProvenance } from '@/server/weather/bulletin';
import { Go } from '@/components/ui/Icons';

const W = 220;
const H = 84;
const PAD = { l: 2, r: 2, t: 6, b: 6 };

/** Every multiple shares the same 0-100 y-scale and each one's own time
 *  span on x, so heights compare across chains — small multiples only work
 *  when the reader can compare them without reading axes. */
export function ForecastMultiple({ f, color = 'var(--ink-1)' }: { f: ForecastWithProvenance; color?: string }) {
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
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${chainName(f.chain)} flow history${f.points.length ? ' and 24h projection' : ''}`}>
      {[35, 50, 65].map((v) => (
        <line key={v} x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="var(--grid)" strokeWidth="1" />
      ))}
      {fan && <path d={fan} fill={color} opacity="0.14" />}
      <polyline points={hist} fill="none" stroke="var(--ink-2)" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      {fc.length > 0 && (
        <polyline
          points={`${x(lastHist.t)},${y(lastHist.cpi)} ${fc.join(' ')}`}
          fill="none"
          stroke={color}
          strokeWidth="2.2"
          strokeDasharray="4 3"
          strokeLinecap="round"
        />
      )}
      <circle cx={x(lastHist.t)} cy={y(lastHist.cpi)} r="3.5" fill={color} stroke="var(--surface-1)" strokeWidth="2" />
    </svg>
  );
}

export function ForecastStrip({ forecasts }: { forecasts: ForecastWithProvenance[] }) {
  if (!forecasts.length) return <p className="text-sm text-ink-2">No chain has a flow reading yet.</p>;
  return (
    <ul className="stagger grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 xl:grid-cols-5">
      {forecasts.map((f) => {
        const now = f.history.at(-1)?.cpi ?? null;
        const end = f.points.at(-1)?.forecast ?? null;
        const up = now != null && end != null ? end >= now : null;
        const color = up == null ? 'var(--ink-2)' : up ? 'var(--mint)' : 'var(--flare)';
        return (
          <li key={f.chain} className="inset-well rounded-[14px] p-2.5 sm:rounded-[16px] sm:p-3">
            <div className="flex items-center justify-between gap-2">
              <Link prefetch={false} href={`/chain/${f.chain}`} className="flex min-w-0 items-center gap-1.5 truncate text-[12.5px] font-bold sm:gap-2 sm:text-[13.5px] text-ink hover:underline"><ChainLogo chain={f.chain} size={18} />{chainName(f.chain)}</Link>
              <InfoPopover p={f.provenance} />
            </div>
            <div className="num mt-1.5 flex items-baseline gap-1.5 text-[18px] font-extrabold tracking-[-0.02em]">
              <span className="text-ink">{now != null ? num(now, 0) : 'n/a'}</span>
              {end != null && <><span className="text-[13px] text-ink-muted"><Go /></span><span style={{ color }}>{num(end, 0)}</span></>}
            </div>
            <div className="mt-1.5 overflow-hidden [&_svg]:max-h-[64px] sm:[&_svg]:max-h-none"><ForecastMultiple f={f} color={color} /></div>
            <div className="num mt-1 text-[11px] text-ink-muted">
              {f.insufficient ? `Needs 12 readings · ${f.sampleSize} so far` : `Typical error ±${f.mape == null ? 'n/a' : num(f.mape, 0)}% · ${f.sampleSize} readings`}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
