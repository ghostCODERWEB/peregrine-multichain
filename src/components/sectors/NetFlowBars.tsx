import { usd } from '@/lib/viz/format';

/** Net flow per snapshot as bars around zero (up = net buying). Each bar
 *  carries its time and value as a native tooltip. */
export function NetFlowBars({ points, label, height = 160 }: { points: Array<{ t: number; netFlowUsd: number }>; label: string; height?: number }) {
  if (points.length < 2) return <p className="text-[13px] text-ink-muted">History builds with each scan; check back in a few hours.</p>;
  const W = 800, H = height, gap = 1.5;
  const bw = Math.max(1.5, W / points.length - gap);
  const max = Math.max(1, ...points.map((p) => Math.abs(p.netFlowUsd)));
  const mid = H / 2;
  const fmt = new Intl.DateTimeFormat('en-US', { weekday: 'short', hour: 'numeric' });
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="draw w-full" style={{ height }} role="img" aria-label={`${label}: ${points.length} readings, latest ${usd(points.at(-1)!.netFlowUsd, { signed: true })}`}>
        <line x1={0} x2={W} y1={mid} y2={mid} stroke="var(--axis)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        {points.map((p, i) => {
          const h = Math.max(1, (Math.abs(p.netFlowUsd) / max) * (mid - 4));
          const up = p.netFlowUsd >= 0;
          return (
            <rect key={p.t} x={i * (bw + gap)} y={up ? mid - h : mid} width={bw} height={h} rx={Math.min(2, bw / 2)} fill={up ? 'var(--mint)' : 'var(--flare)'} fillOpacity={i === points.length - 1 ? 1 : 0.7} className={up ? 'bar-up' : 'bar-down'} style={{ '--i': i } as React.CSSProperties}>
              <title>{`${fmt.format(p.t)}: ${usd(p.netFlowUsd, { signed: true })}`}</title>
            </rect>
          );
        })}
      </svg>
      <figcaption className="mt-2 flex justify-between text-[11.5px] text-ink-muted">
        <span>{fmt.format(points[0].t)}</span><span>peak {usd(max)}</span><span>{fmt.format(points.at(-1)!.t)}</span>
      </figcaption>
    </figure>
  );
}
