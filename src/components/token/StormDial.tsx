'use client';
import { EChart } from '@/components/charts/EChart';
import { useThemeColors } from '@/components/charts/useThemeColors';
import { InfoPopover } from '@/components/InfoPopover';
import { STORM_CLASS, STORM_LABEL } from '@/lib/viz/scales';
import { num, pct } from '@/lib/viz/format';
import { stormBand, type StormInput } from '@/lib/models/storm-score';
import type { StormWave } from '@/server/token/storm';
import type { Indicator } from '@/server/token/waves';

const INPUT_LABEL: Record<StormInput, [string, string]> = {
  concentration: ['C', 'Concentration'],
  insider: ['I', 'Insider clusters'],
  windShear: ['W', 'Cohort shear'],
  exitLiquidity: ['L', 'Exit liquidity'],
  sellPressure: ['P', 'Sell pressure'],
  nansenRisk: ['R', 'Nansen risk'],
};

export function stormTitle(symbol: string | null, s: StormWave): string {
  const r = s.result;
  const lead = (Object.entries(r.subScores) as Array<[StormInput, number | null]>)
    .filter(([, v]) => v != null)
    .sort((a, b) => (b[1] as number) - (a[1] as number))[0];
  const name = lead && (lead[0] === 'nansenRisk' ? 'Nansen risk' : INPUT_LABEL[lead[0]][1].toLowerCase());
  const storm = r.band === 'watch' || r.band === 'warning';
  const tail = !lead ? '' : storm ? `, driven by ${name} (${num(lead[1], 0)})` : `; highest input: ${name} (${num(lead[1], 0)})`;
  return `${symbol ?? 'This token'}: ${STORM_LABEL[r.band]} — Dump Risk ${num(r.score, 0)}${tail}`;
}

function Gauge({ score }: { score: number }) {
  const c = useThemeColors();
  const option = c && {
    series: [{
      type: 'gauge' as const, animation: false,
      min: 0, max: 100, startAngle: 210, endAngle: -30, radius: '95%', center: ['50%', '58%'],
      axisLine: { lineStyle: { width: 14, color: [[0.25, c.mid], [0.5, c['storm-1']], [0.75, c['storm-2']], [1, c['storm-3']]] as [number, string][] } },
      splitLine: { distance: -14, length: 14, lineStyle: { color: c['surface-1'], width: 3 } },
      splitNumber: 4,
      axisTick: { show: false },
      axisLabel: { distance: 20, color: c['ink-muted'], fontSize: 10 },
      pointer: { length: '62%', width: 4, itemStyle: { color: c['ink-1'] } },
      anchor: { show: true, size: 10, itemStyle: { color: c['ink-1'], borderColor: c['surface-1'], borderWidth: 2 } },
      title: { show: false },
      detail: { offsetCenter: [0, '42%'], fontSize: 30, fontWeight: 600, color: c['ink-1'], fontFamily: 'var(--font-geist-mono), monospace', formatter: (v: number) => v.toFixed(0) },
      data: [{ value: score }],
    }],
  };
  return option ? <EChart option={option} height={200} ariaLabel={`Dump Risk ${num(score, 0)} of 100`} /> : <div style={{ height: 200 }} />;
}

function Radar({ indicators }: { indicators: Indicator[] }) {
  const c = useThemeColors();
  const pts = indicators.filter((i) => i.percentile != null);
  if (pts.length < 3) {
    return pts.length ? (
      <ul className="space-y-1 text-[12px]">
        {pts.map((i) => <li key={i.type} className="flex justify-between"><span className="text-ink-2">{i.type}</span><span className="num text-ink">{num(i.percentile, 0)} pctile</span></li>)}
      </ul>
    ) : <p className="text-[12px] text-ink-muted">Nansen has not scored this token&apos;s indicators.</p>;
  }
  const option = c && {
    radar: {
      indicator: pts.map((i) => ({ name: i.type.replace(/-/g, ' '), max: 100 })),
      radius: '62%', splitNumber: 4,
      axisName: { color: c['ink-2'], fontSize: 10 },
      splitLine: { lineStyle: { color: c.grid } }, splitArea: { show: false }, axisLine: { lineStyle: { color: c.grid } },
    },
    tooltip: { backgroundColor: c['surface-2'], borderColor: c.axis, textStyle: { color: c['ink-1'], fontSize: 12 } },
    series: [{
      type: 'radar' as const,
      data: [{ value: pts.map((i) => Math.round(i.percentile!)), name: 'Nansen signal percentile' }],
      lineStyle: { color: c['ink-1'], width: 2 }, areaStyle: { color: c['ink-1'], opacity: 0.08 },
      symbolSize: 6, itemStyle: { color: c['ink-1'], borderColor: c['surface-1'], borderWidth: 2 },
    }],
  };
  return option ? <EChart option={option} height={210} ariaLabel="Nansen risk and reward indicators, signal percentile" /> : <div style={{ height: 210 }} />;
}

export function StormDial({ s, indicators }: { s: StormWave; indicators: Indicator[] }) {
  const r = s.result;
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded px-2.5 py-0.5 text-[12px] font-medium" style={{ background: `var(--${STORM_CLASS[r.band]})`, color: `var(--on-${STORM_CLASS[r.band]})` }}>
          {STORM_LABEL[r.band]}
        </span>
        <span className="flex items-center gap-1 text-[11.5px] text-ink-muted">
          confidence {pct(r.confidence, 0)}{!s.final && ' · provisional'}
          {s.provenance.composite && <InfoPopover p={s.provenance.composite} />}
        </span>
      </div>
      <Gauge score={r.score} />
      <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3" aria-label="Dump Risk inputs">
        {(Object.keys(INPUT_LABEL) as StormInput[]).map((k) => {
          const v = r.subScores[k];
          const cls = v == null ? null : STORM_CLASS[stormBand(v)];
          return (
            <li key={k} className="rounded-md border border-border px-2 py-1.5" title={v == null ? s.why[k] : undefined}>
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] text-ink-2"><b className="font-semibold text-ink">{INPUT_LABEL[k][0]}</b> {INPUT_LABEL[k][1]}</span>
                {s.provenance[k] && <InfoPopover p={s.provenance[k]!} />}
              </div>
              {v == null ? (
                <div className="mt-1 text-[11px] text-ink-muted">{s.final ? 'no Nansen data' : 'loading…'}</div>
              ) : (
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="num w-7 text-[13px] text-ink">{num(v, 0)}</span>
                  <span className="h-1.5 flex-1 rounded-full bg-accent">
                    <span className="block h-1.5 rounded-full" style={{ width: `${Math.max(3, v)}%`, background: `var(--${cls === 'mid' ? 'axis' : cls})` }} />
                  </span>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <div className="mt-4 border-t border-border pt-3">
        <div className="text-[12.5px] font-medium text-ink">Nansen&apos;s own indicators</div>
        <p className="text-[11.5px] text-ink-muted">Signal percentile vs all tokens Nansen scores (tgm/indicators).</p>
        <Radar indicators={indicators} />
      </div>
    </div>
  );
}
