/** Per-scan flow share (net ÷ volume) as bars around zero: amber above
 *  (net buying), blue below (net selling). Plain SVG, one per table row. */
export function FlowSpark({ values, width = 84, height = 22, label }: { values: number[]; width?: number; height?: number; label: string }) {
  if (!values.length) return <span className="text-[11px] text-ink-muted">n/a</span>;
  const max = Math.max(0.02, ...values.map((v) => Math.abs(v)));
  const bw = width / values.length;
  const mid = height / 2;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="draw" role="img" aria-label={`${label}: ${values.map((v) => `${(v * 100).toFixed(0)}%`).join(', ')}`}>
      <line x1={0} x2={width} y1={mid} y2={mid} stroke="var(--axis)" strokeWidth={1} />
      {values.map((v, i) => {
        const h = Math.max(1, (Math.abs(v) / max) * (mid - 1));
        return <rect key={i} x={i * bw + 1} width={Math.max(1, bw - 2)} y={v >= 0 ? mid - h : mid} height={h} rx={1} fill={v >= 0 ? 'var(--in-3)' : 'var(--out-3)'} className={v >= 0 ? 'bar-up' : 'bar-down'} style={{ '--i': i } as React.CSSProperties} />;
      })}
    </svg>
  );
}
