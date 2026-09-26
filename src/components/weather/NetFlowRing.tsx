'use client';
// Capital Flows in the public view: the ring from the owner's rotation map,
// drawn from each chain's measured market-wide net flow (src/lib/viz/
// net-flow-map.ts). Nodes and their numbers are measured; arcs are a modeled
// allocation and are labelled that way everywhere they appear.
import Link from 'next/link';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChainBadge, ChainLogo, chainLogoSrc, SvgChainLogo } from '@/components/Logo';
import { flowLayout } from '@/lib/viz/flow-layout';
import { netFlowMap, chainNets } from '@/lib/viz/net-flow-map';
import { chainName, num, usd } from '@/lib/viz/format';
import { Go } from '@/components/ui/Icons';

export interface NetFlowChain {
  chain: string;
  cpi: number | null;
  windows: Array<{ window: string; netFlowUsd: number }>;
}

const WIDE = { W: 820, H: 540, ring: 0.39 },
  NARROW = { W: 420, H: 470, ring: 0.33 };
const r1 = (n: number) => Math.round(n * 10) / 10;

export function NetFlowRing({ chains }: { chains: NetFlowChain[] }) {
  const uid = useId().replace(/:/g, '');
  const wrap = useRef<HTMLDivElement>(null);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setNarrow(e.contentRect.width < 560));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const { W, H, ring } = narrow ? NARROW : WIDE;
  const nets = useMemo(() => chainNets(chains), [chains]);
  // Phones: three chains each way keep the ring's nodes and labels apart.
  const map = useMemo(() => netFlowMap(nets, narrow ? { sellers: 3, buyers: 3, pairs: 6 } : {}), [nets, narrow]);
  const layout = useMemo(() => flowLayout(map.edges, W, H, ring, narrow ? 3 : 4), [map.edges, W, H, ring, narrow]);
  const cpi = useMemo(() => new Map(chains.map((c) => [c.chain, c.cpi])), [chains]);
  const measured = useMemo(() => new Map(nets.map((n) => [n.chain, n.net])), [nets]);
  const [sel, setSel] = useState<string | null>(null);
  const selected = layout.arcs.find((a) => a.key === sel) ?? layout.arcs[0] ?? null;

  if (!map.edges.length) {
    return (
      <section aria-labelledby="netflow-title" className="material p-6">
        <h2 id="netflow-title" className="text-[19px] font-bold">
          Market-wide net flow
        </h2>
        <p className="mt-2 text-sm text-ink-muted">
          Not enough measured net flow on both sides yet: the map needs chains gaining and chains losing net flow in the last 24 hours.
        </p>
      </section>
    );
  }
  const cx = W / 2,
    cy = H / 2,
    R = Math.min(W, H) * ring;

  return (
    <section aria-labelledby="netflow-title" className="material p-4 sm:p-5">
      <h2 id="netflow-title" className="sr-only">
        Market-wide net flow between chains, 24 hours
      </h2>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div ref={wrap} className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-7 gap-y-3 px-2 pt-2">
            <Stat label="Net outflow · 24h" value={usd(map.totalOut)} />
            <span className="hidden h-10 w-px bg-[var(--hair-2)] sm:block" aria-hidden />
            <Stat label="Net inflow · 24h" value={usd(map.totalIn)} />
            <span className="hidden h-10 w-px bg-[var(--hair-2)] sm:block" aria-hidden />
            <Stat label="Chains measured" value={String(nets.length)} />
            <span className="ml-auto inline-flex items-center gap-2 rounded-full bg-ink/5 px-3 py-1 text-[12px] font-semibold text-ink-muted">
              <span className="live-dot" aria-hidden />
              All traders · nodes measured, arcs modeled
            </span>
          </div>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="mt-2 h-auto w-full"
            role="img"
            aria-label={`Market-wide net flow, 24 hours. Losing: ${map.sellers.map((s) => `${chainName(s.chain)} ${usd(s.net)}`).join(', ')}. Gaining: ${map.buyers.map((b) => `${chainName(b.chain)} +${usd(b.net)}`).join(', ')}. Arcs are a modeled allocation.`}
          >
            <defs>
              <radialGradient id={`${uid}-glow`}>
                <stop stopColor="var(--mint)" stopOpacity=".11" />
                <stop offset=".7" stopColor="var(--signal)" stopOpacity=".04" />
                <stop offset="1" stopColor="var(--signal)" stopOpacity="0" />
              </radialGradient>
              <filter id={`${uid}-blur`} x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="5" />
              </filter>
              {layout.arcs.map((a, i) => (
                <linearGradient
                  key={a.key}
                  id={`${uid}-g${i}`}
                  gradientUnits="userSpaceOnUse"
                  x1={r1(a.x1)}
                  y1={r1(a.y1)}
                  x2={r1(a.x2)}
                  y2={r1(a.y2)}
                >
                  <stop stopColor="var(--flare)" />
                  <stop offset="1" stopColor="var(--mint)" />
                </linearGradient>
              ))}
            </defs>
            <circle cx={cx} cy={cy} r={r1(R + 70)} fill={`url(#${uid}-glow)`} />
            <circle cx={cx} cy={cy} r={r1(R)} fill="none" stroke="var(--hair-2)" />
            <circle cx={cx} cy={cy} r={r1(R * 0.66)} fill="none" stroke="var(--hair)" strokeDasharray="2 7" />
            <circle cx={cx} cy={cy} r={r1(R * 0.33)} fill="none" stroke="var(--hair)" strokeDasharray="2 7" />
            {Array.from({ length: 60 }, (_, i) => {
              const a = (i * Math.PI) / 30,
                major = i % 5 === 0,
                r0 = R + 12,
                r2 = R + (major ? 20 : 16);
              return (
                <line
                  key={i}
                  x1={r1(cx + r0 * Math.cos(a))}
                  y1={r1(cy + r0 * Math.sin(a))}
                  x2={r1(cx + r2 * Math.cos(a))}
                  y2={r1(cy + r2 * Math.sin(a))}
                  stroke="var(--ink-1)"
                  strokeOpacity={major ? 0.22 : 0.08}
                />
              );
            })}
            <text
              x={r1(cx - R * 0.9)}
              y={24}
              textAnchor="middle"
              className="fill-[var(--flare)] text-[12px] font-extrabold tracking-[0.08em]"
            >
              NET OUTFLOW
            </text>
            <text
              x={r1(cx + R * 0.9)}
              y={24}
              textAnchor="middle"
              className="fill-[var(--mint)] text-[12px] font-extrabold tracking-[0.08em]"
            >
              NET INFLOW
            </text>

            {layout.arcs.map((a, i) => {
              const on = selected?.key === a.key,
                k = a.width / 14,
                n = 2 + Math.round(4 * k),
                dur = 3.4;
              return (
                <g key={a.key} className="cursor-pointer" onClick={() => setSel(a.key)} onMouseEnter={() => setSel(a.key)}>
                  {on && (
                    <path
                      d={a.d}
                      fill="none"
                      stroke={`url(#${uid}-g${i})`}
                      strokeWidth={r1(a.width + 10)}
                      strokeOpacity={0.35}
                      filter={`url(#${uid}-blur)`}
                    />
                  )}
                  <path
                    id={`${uid}-p${i}`}
                    d={a.d}
                    fill="none"
                    stroke={`url(#${uid}-g${i})`}
                    strokeWidth={r1(a.width)}
                    strokeLinecap="round"
                    strokeOpacity={on ? 0.95 : 0.42}
                  />
                  {Array.from({ length: n }, (_, j) => (
                    <circle key={j} r={on ? 2.8 : 2.2} fill="#EFFFF8" fillOpacity={on ? 1 : 0.7} className="flow-particle">
                      <animateMotion dur={`${dur}s`} begin={`${(-(j / n) * dur).toFixed(2)}s`} repeatCount="indefinite">
                        <mpath href={`#${uid}-p${i}`} />
                      </animateMotion>
                    </circle>
                  ))}
                  <path d={a.d} fill="none" stroke="transparent" strokeWidth={Math.max(18, r1(a.width + 12))} />
                </g>
              );
            })}

            {layout.nodes.map((nd) => {
              const net = measured.get(nd.chain) ?? nd.net,
                col = net >= 0 ? 'var(--mint)' : 'var(--flare)',
                src = chainLogoSrc(nd.chain),
                c = cpi.get(nd.chain);
              const lx = narrow ? nd.x : nd.side === 'left' ? nd.x - 46 : nd.x + 46,
                anchor = narrow ? 'middle' : nd.side === 'left' ? 'end' : 'start',
                ly = narrow ? nd.y + 46 : nd.y - 3;
              return (
                <g key={nd.chain}>
                  <circle cx={nd.x} cy={nd.y} r={36} fill="none" stroke={col} strokeOpacity={0.35} strokeWidth={1.5} />
                  <circle cx={nd.x} cy={nd.y} r={28} fill="var(--surface-1)" stroke="var(--hair-2)" />
                  {src ? (
                    <SvgChainLogo chain={nd.chain} x={r1(nd.x - 16)} y={r1(nd.y - 16)} size={32} />
                  ) : (
                    <text x={nd.x} y={r1(nd.y + 4)} textAnchor="middle" className="fill-ink text-[12px] font-bold">
                      {chainName(nd.chain).slice(0, 2)}
                    </text>
                  )}
                  <text x={r1(lx)} y={r1(ly)} textAnchor={anchor} className="fill-ink text-[15px] font-extrabold">
                    {chainName(nd.chain)}
                  </text>
                  <text x={r1(lx)} y={r1(ly + 17)} textAnchor={anchor} className="num text-[12.5px] font-bold" style={{ fill: col }}>
                    {net >= 0 ? '+' : '−'}
                    {usd(Math.abs(net))}
                    {c != null && !narrow ? <tspan className="fill-ink-muted font-semibold">{`  ·  Flow ${num(c, 0)}`}</tspan> : null}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {selected && (
          <aside className="material-strong flex flex-col gap-4 rounded-[22px] p-5" aria-label="Selected flow">
            <div className="flex items-center gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[18px] font-extrabold tracking-[-0.02em]">
                  <span className="inline-flex items-center gap-2"><ChainBadge chain={selected.from} size={30} />{chainName(selected.from)}</span>
                  <span className="text-ink-muted"><Go /></span>
                  <span className="inline-flex items-center gap-2"><ChainBadge chain={selected.to} size={30} />{chainName(selected.to)}</span>
                </div>
                <div className="text-[12.5px] text-ink-muted">modeled share · last 24 hours</div>
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="num text-[44px] font-extrabold leading-none tracking-[-0.04em]">{usd(selected.edge.netUsd)}</span>
              <span className="text-[13px] font-bold text-[var(--mint)]">modeled</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[selected.from, selected.to].map((ch) => {
                const v = measured.get(ch) ?? 0,
                  c = cpi.get(ch);
                return (
                  <Link key={ch} href={`/chain/${ch}`} className="inset-well block p-3 hover:border-[var(--hair-2)]">
                    <div className="flex items-center gap-1.5 text-[12px] text-ink-muted">
                      <ChainLogo chain={ch} size={14} />
                      {chainName(ch)} · 24h
                    </div>
                    <div className="num mt-1 text-[19px] font-extrabold" style={{ color: v >= 0 ? 'var(--mint)' : 'var(--flare)' }}>
                      {v >= 0 ? '+' : '−'}
                      {usd(Math.abs(v))}
                    </div>
                    <div className="text-[12px] text-ink-muted">Flow Index {c != null ? num(c, 0) : 'n/a'}</div>
                  </Link>
                );
              })}
            </div>
            <p className="text-[12.5px] leading-relaxed text-ink-2">
              {chainName(selected.from)}&apos;s measured net outflow × {chainName(selected.to)}&apos;s share of the measured inflow. It
              shows where net flow left and arrived across the market, not tracked wallets. Same-wallet rotations are shown only to Nansen
              API key owners, per Nansen&apos;s rules.
            </p>
            <ul className="divide-y divide-[var(--hair)]" aria-label="All modeled flows">
              {layout.arcs.map((a) => (
                <li key={a.key}>
                  <button
                    type="button"
                    onClick={() => setSel(a.key)}
                    aria-pressed={selected.key === a.key}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[13px] ${selected.key === a.key ? 'bg-ink/8 text-ink' : 'text-ink-2 hover:text-ink'}`}
                  >
                    <ChainLogo chain={a.from} size={16} />
                    <span className="text-ink-muted"><Go /></span>
                    <ChainLogo chain={a.to} size={16} />
                    <span className="truncate">
                      {chainName(a.from)} <Go /> {chainName(a.to)}
                    </span>
                    <span className="num ml-auto font-bold">{usd(a.edge.netUsd)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[12.5px] font-bold text-ink-muted">{label}</div>
      <div className="num text-[30px] font-extrabold leading-tight tracking-[-0.035em]">{value}</div>
    </div>
  );
}

/** Every measured chain by 24h net flow: a diverging bar around zero. */
export function NetFlowBoard({ chains }: { chains: NetFlowChain[] }) {
  const nets = chainNets(chains)
    .filter((n) => n.net !== 0)
    .sort((a, b) => b.net - a.net);
  const rows = [...nets.slice(0, 6), ...nets.slice(6).slice(-6)].filter((r, i, all) => all.findIndex((x) => x.chain === r.chain) === i);
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.net)));
  return (
    <section aria-labelledby="netflow-board" className="material p-5 sm:p-6">
      <h2 id="netflow-board" className="t-section">
        {rows[0] ? `${chainName(rows[0].chain)} drew the most net flow in 24 hours` : 'Chains by net flow'}
      </h2>
      <p className="mt-1 text-[13.5px] text-ink-muted">Market-wide net flow, all traders, measured per chain. The largest six each way.</p>
      <ul className="mt-3 divide-y divide-[var(--hair)]" aria-label="Chains by 24h net flow">
        {rows.map((r, i) => (
          <li key={r.chain} className="grid h-12 grid-cols-[18px_minmax(0,140px)_minmax(0,1fr)_90px] items-center gap-3 text-[14px]">
            <span className="num text-[12.5px] font-bold text-ink-muted">{i + 1}</span>
            <Link href={`/chain/${r.chain}`} className="flex min-w-0 items-center gap-2.5 truncate font-bold hover:underline">
              <ChainLogo chain={r.chain} size={24} />
              {chainName(r.chain)}
            </Link>
            <span className="relative h-2.5 rounded bg-raised" aria-hidden>
              <span className="absolute inset-y-[-4px] left-1/2 w-px bg-axis" />
              <span
                className="absolute inset-y-0 rounded"
                style={
                  r.net >= 0
                    ? { left: '50%', width: `${(r.net / max) * 50}%`, background: 'var(--mint)' }
                    : { right: '50%', width: `${(-r.net / max) * 50}%`, background: 'var(--flare)' }
                }
              />
            </span>
            <span className="num text-right font-extrabold" style={{ color: r.net >= 0 ? 'var(--in-3)' : 'var(--out-3)' }}>
              {r.net >= 0 ? '+' : '−'}
              {usd(Math.abs(r.net))}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
