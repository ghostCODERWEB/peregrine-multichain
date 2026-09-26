'use client';
import { useState } from 'react';
import { Segmented } from '@/components/ui/Segmented';
import { EChart } from '@/components/charts/EChart';
import { useThemeColors } from '@/components/charts/useThemeColors';
import { InfoPopover } from '@/components/InfoPopover';
import { pct, usd } from '@/lib/viz/format';
import type { MarketWave } from '@/server/token/waves';

const price = (v: number) => (v >= 1 ? `$${v.toFixed(2)}` : `$${v.toPrecision(3)}`);

export function marketTitle(symbol: string | null, m: MarketWave): string {
  const first = m.candles[0],
    last = m.candles.at(-1)!;
  const ch = last.c / first.o - 1;
  const flow = m.segmentFlow.reduce((s, r) => s + r.netUsd, 0);
  const who = m.segment ?? 'labelled holders';
  const flowPart = m.segment ? `; ${who} ${flow >= 0 ? 'added' : 'cut'} ${usd(Math.abs(flow))}` : '';
  return `${symbol ?? 'Price'} ${ch >= 0 ? 'up' : 'down'} ${pct(Math.abs(ch), 0)} in 14 days${flowPart}`;
}

/** Two stacked panels on one time axis — price candles with the cone
 *  ahead, and the holder segment's daily net flow below. Separate panels,
 *  each with its own single y-axis: never two scales on one plot. */
/** `days` set: the range is chosen outside (the token hero's picker) and this
 *  chart shows no range control of its own. */
export function CandleChart({ m, days: daysProp }: { m: MarketWave; days?: number }) {
  const c = useThemeColors();
  const [daysState, setDays] = useState(14);
  const days = daysProp ?? daysState;
  const [style, setStyle] = useState('line');
  const cone = m.cone;
  const coneLow = cone ? [[cone.lastT, cone.lastClose], ...cone.bands.map((b) => [b.t, b.low])] : [];
  const coneBand = cone ? [[cone.lastT, 0], ...cone.bands.map((b) => [b.t, b.high - b.low])] : [];
  // Both panels share one explicit x range (first candle → end of the
  // cone), or the flow panel would stop at today while prices run a week
  // further and the days would no longer line up.
  const xMin = Math.max(m.candles[0].t, m.candles.at(-1)!.t - days * 86400000);
  const xMax = style === 'candles' && cone ? cone.bands.at(-1)!.t : m.candles.at(-1)!.t;
  // Line mode fits a linear axis to the candles in view (the move is the
  // story); candles keep the log axis the volatility cone needs.
  const inView = m.candles.filter((k) => k.t >= xMin).map((k) => k.c);
  const up = inView.length < 2 || inView.at(-1)! >= inView[0];
  const lo = Math.min(...inView),
    hi = Math.max(...inView),
    padY = (hi - lo) * 0.08 || hi * 0.02;
  const priceAxis =
    style === 'line'
      ? {
          type: 'value' as const,
          gridIndex: 0,
          min: lo - padY,
          max: hi + padY,
          axisLabel: { color: c?.['ink-muted'], fontSize: 10, formatter: (v: number) => price(v) },
          splitLine: { lineStyle: { color: c?.grid } },
          splitNumber: 4,
        }
      : null;
  // No segment flow on this token: price takes the whole plot.
  const flowPanel = m.segmentFlow.length > 0;
  const option = c && {
    animation: false,
    axisPointer: { link: [{ xAxisIndex: 'all' as const }] },
    grid: [
      flowPanel ? { left: 58, right: 16, top: 12, height: '58%' } : { left: 58, right: 16, top: 12, bottom: 26 },
      flowPanel ? { left: 58, right: 16, top: '76%', bottom: 26 } : { left: 58, right: 16, top: '98%', height: 0, show: false },
    ],
    xAxis: [
      {
        type: 'time' as const,
        gridIndex: 0,
        min: xMin,
        max: xMax,
        axisLabel: { show: !flowPanel, color: c['ink-muted'], fontSize: 10 },
        axisLine: { lineStyle: { color: c.axis } },
        splitLine: { show: false },
      },
      {
        type: 'time' as const,
        gridIndex: 1,
        min: xMin,
        max: xMax,
        show: flowPanel,
        axisLabel: { color: c['ink-muted'], fontSize: 10 },
        axisLine: { lineStyle: { color: c.axis } },
        splitLine: { show: false },
      },
    ],
    yAxis: [
      // Log price axis: the cone is symmetric in log space, and on a token
      // that spiked a linear axis squashed every candle into one line.
      priceAxis ?? {
        type: 'log' as const,
        gridIndex: 0,
        logBase: 10,
        axisLabel: { color: c['ink-muted'], fontSize: 10, formatter: (v: number) => price(v) },
        splitLine: { lineStyle: { color: c.grid } },
      },
      {
        type: 'value' as const,
        gridIndex: 1,
        show: flowPanel,
        axisLabel: { color: c['ink-muted'], fontSize: 10, formatter: (v: number) => usd(v) },
        splitLine: { lineStyle: { color: c.grid } },
        splitNumber: 2,
      },
    ],
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: c['surface-2'],
      borderColor: c.axis,
      textStyle: { color: c['ink-1'], fontSize: 12 },
      axisPointer: { type: 'line' as const, lineStyle: { color: c['ink-muted'] } },
      formatter: (raw: unknown) => {
        const ps = (Array.isArray(raw) ? raw : [raw]) as Array<{ seriesName: string; value: number[]; axisValue: number }>;
        const lines: string[] = [];
        const k = ps.find((p) => p.seriesName === 'Price');
        if (k && style === 'line') lines.push(`<b>${price(k.value[1])}</b> close`);
        if (k && style === 'candles')
          lines.push(`<b>${price(k.value[2])}</b> close<br/>O ${price(k.value[1])} · H ${price(k.value[4])} · L ${price(k.value[3])}`);
        const f = ps.find((p) => p.seriesName === 'Flow');
        if (f) lines.push(`<b>${usd(f.value[1], { signed: true })}</b> ${m.segment} net flow that day`);
        const t = ps[0]?.axisValue;
        if (t) lines.push(`<span style="opacity:.7">${new Date(t).toUTCString().slice(5, 22)} UTC</span>`);
        return lines.join('<br/>');
      },
    },
    series: [
      ...(style === 'line'
        ? [
            {
              name: 'Price',
              type: 'line' as const,
              xAxisIndex: 0,
              yAxisIndex: 0,
              data: m.candles.filter((k) => k.t >= xMin).map((k) => [k.t, k.c]),
              smooth: 0.25,
              showSymbol: false,
              lineStyle: { color: up ? c['in-4'] : c['out-3'], width: 2.2 },
              areaStyle: {
                color: {
                  type: 'linear' as const,
                  x: 0,
                  y: 0,
                  x2: 0,
                  y2: 1,
                  colorStops: [
                    { offset: 0, color: up ? c['in-3'] : c['out-3'] },
                    { offset: 1, color: 'transparent' },
                  ],
                },
                opacity: 0.38,
              },
            },
          ]
        : [
            {
              name: 'Price',
              type: 'candlestick' as const,
              xAxisIndex: 0,
              yAxisIndex: 0,
              data: m.candles.map((k) => [k.t, k.o, k.c, k.l, k.h]),
              itemStyle: { color: c['in-3'], color0: c['out-3'], borderColor: c['in-3'], borderColor0: c['out-3'] },
            },
          ]),
      ...(cone && style === 'candles'
        ? [
            {
              name: 'cone-low',
              type: 'line' as const,
              xAxisIndex: 0,
              yAxisIndex: 0,
              data: coneLow,
              stack: 'cone',
              smooth: true,
              symbol: 'none',
              lineStyle: { opacity: 0 },
              silent: true,
              tooltip: { show: false },
            },
            {
              name: 'cone',
              type: 'line' as const,
              xAxisIndex: 0,
              yAxisIndex: 0,
              data: coneBand,
              stack: 'cone',
              smooth: true,
              symbol: 'none',
              silent: true,
              lineStyle: { opacity: 0 },
              areaStyle: { color: c['ink-1'], opacity: 0.1 },
            },
          ]
        : []),
      {
        name: 'Flow',
        type: 'bar' as const,
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: m.segmentFlow.map((r) => ({
          value: [r.t + 12 * 3_600_000, r.netUsd],
          itemStyle: { color: r.netUsd >= 0 ? c['in-3'] : c['out-3'], borderRadius: r.netUsd >= 0 ? [3, 3, 0, 0] : [0, 0, 3, 3] },
        })),
        barMaxWidth: 14,
      },
    ],
  };
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 [&>*:only-child]:ml-auto">
        {daysProp == null && (
          <Segmented
            label="Price range"
            value={days}
            options={[
              { value: 1, label: '1D' },
              { value: 7, label: '7D' },
              { value: 14, label: '14D' },
              { value: 30, label: '30D' },
            ]}
            onChange={setDays}
          />
        )}
        <Segmented
          label="Price style"
          value={style}
          options={[
            { value: 'line', label: 'Line' },
            { value: 'candles', label: 'Candles' },
          ]}
          onChange={setStyle}
        />
      </div>
      {days > 14 && (
        <p className="mb-2 text-xs text-ink-muted">
          Only the available 14-day candle history is shown; no older observations have been fetched.
        </p>
      )}
      <div className="flex items-center justify-end gap-1">
        <span className="text-[11px] text-ink-muted">candles</span>
        <InfoPopover p={m.provenance.candles} />
        {m.provenance.cone && (
          <>
            <span className="ml-2 text-[11px] text-ink-muted">cone</span>
            <InfoPopover p={m.provenance.cone} />
          </>
        )}
      </div>
      {option ? (
        <EChart
          option={option}
          height={flowPanel ? 390 : 350}
          ariaLabel="4-hour price candles with volatility cone, and daily holder-segment net flow"
        />
      ) : (
        <div style={{ height: 340 }} />
      )}
      <div className="mt-1 flex flex-wrap justify-between gap-x-4 gap-y-1 text-[11px] text-ink-muted">
        <span>{m.segment ? `Lower panel: ${m.segment} daily net flow` : m.segmentUnavailable}</span>
        {cone && (
          <span className="num">
            7-day range {price(cone.bands[2].low)} to {price(cone.bands[2].high)} (80%)
            {cone.coverage ? ` · held ${pct(cone.coverage.hitRate, 0)} of the time` : ''}
          </span>
        )}
      </div>
    </div>
  );
}
