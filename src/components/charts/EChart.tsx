'use client';
import dynamic from 'next/dynamic';
import type { EChartsOption } from 'echarts';

// ECharts touches `window` at import; load it client-side only.
const ReactECharts = dynamic(() => import('echarts-for-react'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse rounded-md bg-accent/40" />,
});

export function EChart({ option, height, ariaLabel }: { option: EChartsOption; height: number; ariaLabel: string }) {
  return (
    <div role="img" aria-label={ariaLabel} style={{ height }}>
      <ReactECharts option={option} style={{ height, width: '100%' }} notMerge lazyUpdate opts={{ renderer: 'svg' }} />
    </div>
  );
}
