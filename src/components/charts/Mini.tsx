// Small server-rendered SVG charts for summary cards: no JavaScript, and they
// draw in with the shared .draw entrance (globals.css).

const W = 240;

/** Signed bars around a zero line (e.g. hourly net flow): up in mint, down in flare. */
export function MiniBars({ values, height = 44, label, title }: { values: number[]; height?: number; label: string; title?: (i: number) => string }) {
  if (values.length < 2) return null;
  const max = Math.max(1e-9, ...values.map(Math.abs));
  const mid = height / 2, bw = W / values.length;
  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="draw block w-full" style={{ height }} role="img" aria-label={label} data-series={JSON.stringify(values.map((v) => Math.round(v)))} preserveAspectRatio="none">
      <line x1={0} x2={W} y1={mid} y2={mid} stroke="var(--hair-2)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      {values.map((v, i) => {
        const h = Math.max(1, (Math.abs(v) / max) * (mid - 2));
        return (
          <rect key={i} className={v >= 0 ? 'bar-up' : 'bar-down'} style={{ '--i': i } as React.CSSProperties}
            x={i * bw + bw * 0.15} width={bw * 0.7} y={v >= 0 ? mid - h : mid} height={h} rx={1}
            fill={v >= 0 ? 'var(--mint)' : 'var(--flare)'}>
            {title && <title>{title(i)}</title>}
          </rect>
        );
      })}
    </svg>
  );
}

type Series = { values: Array<number | null>; color: string; dashed?: boolean; area?: boolean };

/** One or more lines on a shared scale (optionally fixed min/max and a reference line). */
export function MiniLines({ series, height = 40, label, min, max, baseline }: { series: Series[]; height?: number; label: string; min?: number; max?: number; baseline?: number }) {
  const all = series.flatMap((s) => s.values.filter((v): v is number => v != null));
  if (all.length < 2) return null;
  const lo = min ?? Math.min(...all), hi = max ?? Math.max(...all), span = hi - lo || 1;
  const y = (v: number) => height - 2 - ((v - lo) / span) * (height - 4);
  const path = (vals: Array<number | null>) => {
    const step = W / Math.max(1, vals.length - 1);
    let d = '', pen = false;
    vals.forEach((v, i) => { if (v == null) { pen = false; return; } d += `${pen ? 'L' : 'M'}${(i * step).toFixed(1)},${y(v).toFixed(1)}`; pen = true; });
    return d;
  };
  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="draw block w-full overflow-visible" style={{ height }} role="img" aria-label={label} data-series={JSON.stringify(series.map((x) => x.values.map((v) => (v == null ? null : Math.round(v * 100) / 100))))} preserveAspectRatio="none">
      {baseline != null && baseline >= lo && baseline <= hi && <line x1={0} x2={W} y1={y(baseline)} y2={y(baseline)} stroke="var(--hair-2)" strokeDasharray="3 3" strokeWidth={1} />}
      {series.map((s, i) => (
        <g key={i}>
          {s.area && <path className="area-fade" d={`${path(s.values)}L${W},${height}L0,${height}Z`} fill={s.color} fillOpacity={0.12} />}
          <path className={s.dashed ? undefined : 'line-draw'} pathLength={1} d={path(s.values)} fill="none" stroke={s.color} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={s.dashed ? '3 3' : undefined} vectorEffect="non-scaling-stroke" />
        </g>
      ))}
    </svg>
  );
}

/** A proportional bar behind a row value (share of the largest in its list). */
export function RowBar({ value, max }: { value: number; max: number }) {
  const w = max > 0 ? Math.min(100, (Math.abs(value) / max) * 100) : 0;
  return <span aria-hidden className="mt-0.5 block h-[3px] overflow-hidden rounded-full bg-[var(--hair)]"><span className="block h-full rounded-full" style={{ width: `${w}%`, background: value >= 0 ? 'var(--mint)' : 'var(--flare)' }} /></span>;
}
