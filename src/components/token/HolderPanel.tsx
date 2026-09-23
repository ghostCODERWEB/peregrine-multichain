'use client';
import { EChart } from '@/components/charts/EChart';
import { useThemeColors } from '@/components/charts/useThemeColors';
import { InfoPopover } from '@/components/InfoPopover';
import { num, pct } from '@/lib/viz/format';
import type { HoldersWave } from '@/server/token/waves';

export function holdersTitle(h: HoldersWave): string {
  const c = h.concentration;
  if (!c) return 'No non-custodial holders among the top 100';
  return `Top 10 real holders own ${pct(c.top10Share, 0)} of supply — concentration ${num(c.score, 0)}/100`;
}

/** "Token Millionaire [0xe61894]" → "Token Millionaire"; a bare "[0x…]"
 *  or nothing → "Unlabelled". Emoji prefixes Nansen adds are dropped. */
function labelGroup(label: string | null): string {
  const s = (label ?? '').replace(/\[0x[0-9a-f…]+\]/gi, '').replace(/[\p{Extended_Pictographic}️]/gu, '').trim();
  return s || 'Unlabelled';
}

function Lorenz({ h }: { h: HoldersWave }) {
  const W = 220, H = 180, P = 22;
  const x = (v: number) => P + v * (W - P - 6);
  const y = (v: number) => H - P - v * (H - P - 6);
  const pts = h.lorenz.map((p) => `${x(p.populationShare).toFixed(1)},${y(p.supplyShare).toFixed(1)}`).join(' ');
  const area = `M${x(0)},${y(0)} L${pts.split(' ').join(' L')} L${x(1)},${y(1)} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full max-w-[260px]" role="img" aria-label={`Lorenz curve of the top holders, Gini ${num(h.concentration?.giniCoefficient, 2)}`}>
      <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} stroke="var(--axis)" strokeDasharray="3 3" />
      <path d={area} fill="var(--ink-1)" opacity="0.08" />
      <polyline points={pts} fill="none" stroke="var(--ink-1)" strokeWidth="2" strokeLinejoin="round" />
      <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(0)} stroke="var(--axis)" />
      <line x1={x(0)} y1={y(0)} x2={x(0)} y2={y(1)} stroke="var(--axis)" />
      <text x={x(0.5)} y={H - 4} textAnchor="middle" className="fill-ink-muted text-[9px]">share of top holders, smallest first →</text>
      <text x={8} y={y(0.5)} textAnchor="middle" transform={`rotate(-90 8 ${y(0.5)})`} className="fill-ink-muted text-[9px]">share of their supply →</text>
      <text x={x(0.6)} y={y(0.5)} className="fill-ink-muted text-[9px]">equality</text>
    </svg>
  );
}

function HolderTreemap({ h }: { h: HoldersWave }) {
  const c = useThemeColors();
  const groups = new Map<string, { value: number; wallets: number; excluded: boolean }>();
  for (const x of h.holders) {
    const g = x.excluded ? `Excluded: ${x.excluded}` : labelGroup(x.label);
    const e = groups.get(g) ?? { value: 0, wallets: 0, excluded: !!x.excluded };
    e.value += x.share;
    e.wallets += 1;
    groups.set(g, e);
  }
  const data = [...groups.entries()]
    .map(([name, g]) => ({ name, value: g.value, wallets: g.wallets, itemStyle: { color: g.excluded ? c?.axis : c?.mid } }))
    .sort((a, b) => b.value - a.value);
  const option = c && {
    tooltip: {
      backgroundColor: c['surface-2'], borderColor: c.axis, textStyle: { color: c['ink-1'], fontSize: 12 },
      formatter: (raw: unknown) => {
        const p = raw as { data: { name: string; value: number; wallets: number } };
        return `<b>${pct(p.data.value, 1)}</b> of supply<br/>${p.data.name}<br/><span style="opacity:.7">${p.data.wallets} of the top 100 wallets</span>`;
      },
    },
    series: [{
      type: 'treemap' as const, data, roam: false, nodeClick: false as const, breadcrumb: { show: false },
      width: '100%', height: '100%', top: 0, left: 0,
      itemStyle: { borderColor: c['surface-1'], borderWidth: 2, gapWidth: 2 },
      label: {
        show: true, color: c['on-mid'], fontSize: 11,
        formatter: (raw: unknown) => {
          const p = raw as { data: { name: string; value: number; wallets: number } };
          return `${p.data.name}\n${pct(p.data.value, 1)} · ${p.data.wallets}`;
        },
      },
    }],
  };
  return option ? <EChart option={option} height={200} ariaLabel="Top 100 holders grouped by Nansen label, area = share of supply" /> : <div style={{ height: 200 }} />;
}

export function HolderPanel({ h }: { h: HoldersWave }) {
  const c = h.concentration;
  return (
    <div>
      <div className="flex justify-end"><InfoPopover p={h.provenance.holders} /></div>
      <div className="grid items-center gap-4 sm:grid-cols-[auto_1fr]">
        <Lorenz h={h} />
        <dl className="grid grid-cols-2 gap-2 text-center">
          {[
            ['Concentration C', c ? num(c.score, 0) : '—'],
            ['Gini (top 100)', c ? num(c.giniCoefficient, 2) : '—'],
            ['Top-10 share', c ? pct(c.top10Share, 0) : '—'],
            ['Nakamoto K', c ? (c.nakamoto > 20 ? '20+' : String(c.nakamoto)) : '—'],
            ['Excluded (custody, pools)', pct(h.excludedShare, 1)],
            ['Holders shown', String(h.holders.length)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-md bg-accent/50 px-2 py-1.5">
              <dt className="text-[10.5px] text-ink-muted">{k}</dt>
              <dd className="num text-sm text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="mt-4">
        <div className="mb-1 text-[12.5px] font-medium text-ink">Top 100 holders by Nansen label</div>
        <HolderTreemap h={h} />
      </div>
    </div>
  );
}
