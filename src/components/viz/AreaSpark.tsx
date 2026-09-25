'use client';
import { useId } from 'react';
/** Catmull–Rom interpolation; geometry uses timestamps, never sample indices. */
export function smoothPath(points: Array<[number, number]>) {
  if (!points.length) return '';
  return points.slice(1).reduce((d, p, i) => {
    const a = points[Math.max(0, i - 1)], b = points[i], c = p, e = points[Math.min(points.length - 1, i + 2)];
    return `${d} C${b[0] + (c[0] - a[0]) / 6},${b[1] + (c[1] - a[1]) / 6} ${c[0] - (e[0] - b[0]) / 6},${c[1] - (e[1] - b[1]) / 6} ${c[0]},${c[1]}`;
  }, `M${points[0][0]},${points[0][1]}`);
}
export function AreaSpark({ values, color = 'var(--mint)', label, height = 86 }: { values: Array<{ t: number; value: number }>; color?: string; label: string; height?: number }) {
  const id = useId().replace(/:/g, '');
  if (values.length < 2) return <p className="py-6 text-xs text-ink-muted">Trend unavailable: fewer than two stored readings.</p>;
  const start = values[0].t, span = values.at(-1)!.t - start || 1;
  const min = Math.min(...values.map(v => v.value)), max = Math.max(...values.map(v => v.value));
  const points: Array<[number, number]> = values.map(v => [6 + (v.t - start) / span * 288, 8 + (1 - (v.value - min) / (max - min || 1)) * (height - 20)]);
  const path = smoothPath(points), end = points.at(-1)!;
  return <svg viewBox={`0 0 300 ${height}`} className="w-full" role="img" aria-label={`${label}. ${values.map(v => `${new Date(v.t).toISOString().slice(0,10)}: ${v.value.toFixed(1)}`).join('; ')}`}><defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop stopColor={color} stopOpacity=".38" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs><path d={`${path} L${end[0]},${height} L6,${height} Z`} fill={`url(#${id})`} /><path d={path} stroke={color} strokeWidth="2.2" fill="none" /><circle cx={end[0]} cy={end[1]} r="6" fill={color} opacity=".15" /><circle cx={end[0]} cy={end[1]} r="3" fill={color} stroke="var(--surface-page)" strokeWidth="2" /></svg>;
}
