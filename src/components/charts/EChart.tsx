'use client';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import type { EChartsOption } from 'echarts';
import { afterHydration } from '@/lib/hydration';

// ECharts touches `window` at import; load it client-side only, and only the parts Peregrine registers
// (./echarts-core) instead of the full library that echarts-for-react's default entry pulls in.
const ReactECharts = dynamic(async () => {
  const [{ default: Core }, { echarts }] = await Promise.all([import('echarts-for-react/lib/core'), import('./echarts-core')]);
  return function ReactEChartsCore(props: Omit<React.ComponentProps<typeof Core>, 'echarts'>) { return <Core echarts={echarts} {...props} />; };
}, {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse rounded-md bg-accent/40" />,
});

/** Handlers take whatever ECharts passes for that event; `never` lets each
 *  handler declare the shape it reads without an `any`. */
type Events = Record<string, (params: never) => void>;

/** `option` may be null while a chart waits for its theme colours or data: the placeholder holds the chart's height, so the page never jumps. */
export function EChart({ option, height, ariaLabel, onEvents }: { option: EChartsOption | null; height: number; ariaLabel: string; onEvents?: Events }) {
  // Charts start as they come near the screen (300px ahead), in the same-sized placeholder: a page's
  // below-the-fold charts no longer load and lay out ECharts during the first paint. Hidden tabs start when shown.
  const box = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (near || !el) return;
    if (typeof IntersectionObserver === 'undefined') { setNear(true); return; }
    // On screen: now. Just below it: once the page has loaded (or sooner if scrolled to), so a chart nobody
    // sees yet does not start ECharts, a large module, inside the first load.
    let stop = () => {};
    const show = () => setNear(true);
    const seen = new IntersectionObserver(([e]) => { if (e.isIntersecting) show(); });
    const ahead = new IntersectionObserver(([e]) => { if (e.isIntersecting) { ahead.disconnect(); stop = afterHydration(show); } }, { rootMargin: '300px 0px' });
    seen.observe(el);
    ahead.observe(el);
    return () => { seen.disconnect(); ahead.disconnect(); stop(); };
  }, [near]);
  return (
    <div ref={box} role="img" aria-label={ariaLabel} style={{ height }}>
      {near && option ? <ReactECharts option={option} style={{ height, width: '100%' }} notMerge lazyUpdate opts={{ renderer: 'svg' }} onEvents={onEvents} />
        : <div className="h-full w-full animate-pulse rounded-md bg-accent/40" />}
    </div>
  );
}
