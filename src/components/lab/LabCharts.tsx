'use client';
import { useState } from 'react';
import { num, pct } from '@/lib/viz/format';
import type { CalibrationBin, RocPoint } from '@/lib/models/metrics';

const W = 300, H = 260, P = { l: 40, r: 12, t: 10, b: 34 };
const sx = (v: number) => P.l + v * (W - P.l - P.r);
const sy = (v: number) => H - P.b - v * (H - P.t - P.b);

function Frame({ xLabel, yLabel, ticks = [0, 0.25, 0.5, 0.75, 1], fmt = (v: number) => num(v, 2), max = 1 }: { xLabel: string; yLabel: string; ticks?: number[]; fmt?: (v: number) => string; max?: number }) {
  return (
    <g>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={sx(0)} x2={sx(1)} y1={sy(t / max)} y2={sy(t / max)} stroke="var(--grid)" />
          <text x={P.l - 6} y={sy(t / max) + 3} textAnchor="end" className="num fill-ink-muted text-[9px]">{fmt(t)}</text>
          <text x={sx(t / max)} y={H - P.b + 13} textAnchor="middle" className="num fill-ink-muted text-[9px]">{fmt(t)}</text>
        </g>
      ))}
      <line x1={sx(0)} y1={sy(0)} x2={sx(1)} y2={sy(1)} stroke="var(--axis)" strokeDasharray="3 3" />
      <text x={sx(0.5)} y={H - 4} textAnchor="middle" className="fill-ink-muted text-[10px]">{xLabel}</text>
      <text x={10} y={sy(0.5)} textAnchor="middle" transform={`rotate(-90 10 ${sy(0.5)})`} className="fill-ink-muted text-[10px]">{yLabel}</text>
    </g>
  );
}

/** Predicted vs observed rate per decile of predicted probability. Axis
 *  max adapts to the largest value so rare events aren't squashed into a
 *  corner; the diagonal is perfect calibration. */
export function CalibrationPlot({ bins }: { bins: CalibrationBin[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const top = Math.max(0.1, ...bins.map((b) => Math.max(b.meanPredicted, b.observedRate)));
  const max = Math.min(1, Math.ceil(top * 10) / 10);
  const ticks = [0, max / 2, max];
  const maxN = Math.max(...bins.map((b) => b.n));
  const h = hover != null ? bins[hover] : null;
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Calibration: predicted probability vs observed rate by decile">
        <Frame xLabel="predicted probability" yLabel="observed rate" ticks={ticks} fmt={(v) => pct(v, 0)} max={max} />
        <polyline points={bins.map((b) => `${sx(b.meanPredicted / max)},${sy(b.observedRate / max)}`).join(' ')} fill="none" stroke="var(--ink-2)" strokeWidth="1.5" />
        {bins.map((b, i) => (
          <circle key={i} cx={sx(b.meanPredicted / max)} cy={sy(b.observedRate / max)} r={3 + 5 * Math.sqrt(b.n / maxN)}
            fill="var(--ink-1)" stroke="var(--surface-1)" strokeWidth="2" onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} />
        ))}
      </svg>
      {h && (
        <div className="pointer-events-none absolute right-2 top-2 material-strong rounded-[12px] px-2.5 py-1.5 text-[11.5px] shadow">
          <div className="num text-ink">predicted {pct(h.meanPredicted, 1)} · observed {pct(h.observedRate, 1)}</div>
          <div className="text-ink-muted">{h.n} tokens in this decile</div>
        </div>
      )}
    </div>
  );
}

/** ROC: the fitted model (ink) against the expert-prior baseline (dashed). */
export function RocChart({ fitted, expert, fittedAuc, expertAuc }: { fitted: RocPoint[]; expert: RocPoint[]; fittedAuc: number | null; expertAuc: number | null }) {
  const path = (pts: RocPoint[]) => pts.map((p) => `${sx(p.fpr)},${sy(p.tpr)}`).join(' ');
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`ROC curve: fitted AUC ${num(fittedAuc, 2)}, expert AUC ${num(expertAuc, 2)}`}>
        <Frame xLabel="false positive rate" yLabel="true positive rate" />
        {expert.length > 0 && <polyline points={path(expert)} fill="none" stroke="var(--ink-muted)" strokeWidth="2" strokeDasharray="5 4" />}
        {fitted.length > 0 && <polyline points={path(fitted)} fill="none" stroke="var(--ink-1)" strokeWidth="2" />}
      </svg>
      <div className="flex justify-center gap-4 text-[11px] text-ink-2">
        <span><span className="mr-1 inline-block h-0.5 w-4 align-middle" style={{ background: 'var(--ink-1)' }} />fitted · AUC {num(fittedAuc, 2)}</span>
        <span><span className="mr-1 inline-block w-4 border-t-2 border-dashed align-middle" style={{ borderColor: 'var(--ink-muted)' }} />expert prior · AUC {num(expertAuc, 2)}</span>
      </div>
    </div>
  );
}

/** Standardized coefficients as diverging bars: right raises the odds. */
export function WeightBars({ weights, labels }: { weights: Array<{ feature: string; weight: number }>; labels: Record<string, string> }) {
  const sorted = [...weights].sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
  const max = Math.max(0.01, ...sorted.map((w) => Math.abs(w.weight)));
  return (
    <ul className="space-y-1" aria-label="Fitted coefficients, standardized">
      {sorted.map((w) => {
        const width = (Math.abs(w.weight) / max) * 40;
        const pos = w.weight >= 0;
        return (
          <li key={w.feature} className="grid grid-cols-[8.5rem_1fr] items-center gap-2 text-[12px]">
            <span className="truncate text-ink-2" title={w.feature}>{labels[w.feature] ?? w.feature}</span>
            <div className="relative h-4">
              <div className="absolute inset-y-0 left-1/2 w-px bg-axis" />
              <div className="absolute top-1/2 h-3 -translate-y-1/2" style={{ width: `${width}%`, [pos ? 'left' : 'right']: '50%', background: pos ? 'var(--storm-2)' : 'var(--out-2)', borderRadius: pos ? '0 3px 3px 0' : '3px 0 0 3px' }} />
              <span className="num absolute top-1/2 -translate-y-1/2 text-[10.5px] text-ink-muted" style={pos ? { left: `calc(50% + ${width}% + 4px)` } : { right: `calc(50% + ${width}% + 4px)` }}>{w.weight >= 0 ? '+' : ''}{num(w.weight, 2)}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
