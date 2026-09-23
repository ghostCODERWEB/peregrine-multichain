// A sector's 24h net flow ÷ volume over the last week, as a small inline
// SVG line around a zero baseline (above = net buying). Plain SVG, not a
// chart library: a dozen tiles on one page, each a few dozen points.
export function SectorSpark({ points, label }: { points: Array<{ t: number; ratio: number }>; label: string }) {
  if (points.length < 2) {
    return <p className="mt-2 h-8 text-[11px] leading-8 text-ink-muted">History builds with each scan.</p>;
  }
  const W = 200, H = 32, pad = 2;
  const t0 = points[0].t, t1 = points.at(-1)!.t;
  const maxAbs = Math.max(1e-9, ...points.map((p) => Math.abs(p.ratio)));
  const x = (t: number) => pad + ((t - t0) / Math.max(1, t1 - t0)) * (W - 2 * pad);
  const y = (r: number) => H / 2 - (r / maxAbs) * (H / 2 - pad);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.ratio).toFixed(1)}`).join(' ');
  const last = points.at(-1)!;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-8 w-full" role="img" aria-label={`${label}; latest ${(last.ratio * 100).toFixed(1)}%`} preserveAspectRatio="none">
      <line x1={0} x2={W} y1={H / 2} y2={H / 2} stroke="var(--axis)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      <path d={d} fill="none" stroke="var(--ink-2)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      <circle cx={x(last.t)} cy={y(last.ratio)} r={2.5} fill={last.ratio >= 0 ? 'var(--in-3)' : 'var(--out-3)'} />
    </svg>
  );
}
