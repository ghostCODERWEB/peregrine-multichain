'use client';
// Capital Flows (P3): chain-to-chain rotations as an animated flow map.
// Every arc is a measured rotation from the owner's smart-money trade tape
// (the same wallets selling on one chain and buying on another within 12h);
// width is net USD, particles scale with the wallets behind it, colour runs
// from sell-side red to buy-side green. Public views get a locked panel,
// never a mock: the data may not be redistributed.
import Link from 'next/link';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Lock } from 'lucide-react';
import { InfoPopover } from '@/components/InfoPopover';
import { ChainLogo, TokenLogo, chainLogoSrc } from '@/components/Logo';
import { FrontSheet, frontKey } from './FrontsPanel';
import { flowLayout, particleCount } from '@/lib/viz/flow-layout';
import { frontsHeadline } from '@/lib/insights';
import { pressureClass, fillVar } from '@/lib/viz/scales';
import { chainName, num, shortAddress, usd, walletName } from '@/lib/viz/format';
import type { FrontWithProvenance, ChainTile } from '@/server/weather/bulletin';

const WINDOWS = [{ h: 24, label: '24h' }, { h: 48, label: '48h' }, { h: 168, label: '7d' }] as const;
// Wide screens: a 900×520 stage with side labels. Phones: a 420×460 stage
// (text stays near its real size) with labels under each chain.
const WIDE = { W: 900, H: 520, ring: 0.4 }, NARROW = { W: 420, H: 460, ring: 0.33 };

/** Tokens that appear most across a rotation's wallets, most frequent first. */
function topTokens(lists: string[][], n = 5): string[] {
  const c = new Map<string, number>();
  for (const l of lists) for (const s of l) c.set(s, (c.get(s) ?? 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n).map(([s]) => s);
}

function useReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const m = matchMedia('(prefers-reduced-motion: reduce)');
    setReduce(m.matches);
    const on = () => setReduce(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return reduce;
}

/** `chain`: show only the flows into and out of that chain (chain pages). */
export function CapitalFlows({ initial, chains, withheld, chain }: { initial: FrontWithProvenance[]; chains: Pick<ChainTile, 'chain' | 'cpi'>[]; withheld: boolean; chain?: string }) {
  const [hours, setHours] = useState(24);
  const [fronts, setFronts] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [sheet, setSheet] = useState<string | null>(null);
  const reduce = useReducedMotion();
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
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');

  useEffect(() => { if (hours === 24) setFronts(initial); }, [initial, hours]);
  async function pick(h: number) {
    setHours(h); setSelected(null); setError(null);
    if (h === 24) { setFronts(initial); return; }
    setLoading(true);
    try {
      const r = await fetch(`/api/weather/flows?hours=${h}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
      setFronts(chain ? (d.fronts as FrontWithProvenance[]).filter((f) => f.from === chain || f.to === chain) : d.fronts);
    } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }

  const observed = useMemo(() => fronts.filter((f) => !f.inferred), [fronts]);
  const layout = useMemo(() => flowLayout(observed.map((f) => ({ from: f.from, to: f.to, netUsd: f.netUsd, walletCount: f.walletCount, confidence: f.confidence })), W, H, ring), [observed, W, H, ring]);
  const cpi = useMemo(() => new Map(chains.map((c) => [c.chain, c.cpi])), [chains]);
  const active = selected ?? layout.arcs[0]?.key ?? null;
  const focus = hovered ?? active;
  const front = observed.find((f) => frontKey(f) === active) ?? null;
  const total = observed.reduce((s, f) => s + f.netUsd, 0);
  const window = WINDOWS.find((w) => w.h === hours)!.label;
  const inUsd = chain ? observed.filter((f) => f.to === chain).reduce((s, f) => s + f.netUsd, 0) : 0;
  const outUsd = chain ? observed.filter((f) => f.from === chain).reduce((s, f) => s + f.netUsd, 0) : 0;
  const title = withheld ? 'Capital flows: key-owner view only'
    : chain ? (observed.length ? `${chainName(chain)}: ${usd(inUsd)} rotated in, ${usd(outUsd)} out (${window})` : `No capital rotations touched ${chainName(chain)} in the last ${window}`)
    : frontsHeadline(observed);

  return (
    <section aria-labelledby="fronts-title" className="glass rounded-2xl p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="fronts-title" className="text-base font-semibold text-ink">
            {title}
          </h2>
          <p className="mt-0.5 text-[12.5px] text-ink-muted">
            Chain-to-chain rotations: the same smart-money wallets selling on one chain and buying on another within 12h.
          </p>
        </div>
        {!withheld && (
          <div className="flex items-center gap-2">
            <span className="num text-[12px] text-ink-muted">{observed.length} flows · {usd(total)} net</span>
            <div role="group" aria-label="Flow window" className="flex rounded-md border border-border p-0.5">
              {WINDOWS.map((w) => (
                <button key={w.h} type="button" aria-pressed={hours === w.h} onClick={() => pick(w.h)}
                  className={`num rounded px-2.5 py-1 text-[12px] ${hours === w.h ? 'bg-accent text-ink' : 'text-ink-2 hover:text-ink'}`}>{w.label}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {withheld ? (
        <div className="mt-3 flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-4 py-10 text-center">
          <Lock className="h-5 w-5 text-ink-muted" aria-hidden />
          <p className="max-w-lg text-[13px] text-ink-2">Built from Nansen smart-money DEX trades, which Nansen&apos;s rules keep out of public views. Connect your own Nansen key to see where smart money is rotating, live.</p>
          <Link href="/account" className="rounded-md bg-brand/15 px-3 py-1.5 text-[13px] text-ink ring-1 ring-brand/40 hover:bg-brand/25">Use my Nansen key</Link>
        </div>
      ) : error ? (
        <p className="mt-3 rounded-lg border border-dashed border-border px-3 py-6 text-[13px] text-ink-2">{error}</p>
      ) : !observed.length ? (
        <p className="mt-3 rounded-lg border border-dashed border-border px-3 py-6 text-[13px] text-ink-2">
          No capital rotations in the last {window}: fewer than two wallets moved between the same pair of chains.
        </p>
      ) : (
        <div className={`mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] ${loading ? 'opacity-60' : ''}`}>
          <div ref={wrap} className="min-w-0">
            <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img"
              aria-label={`Capital flows over ${window}: ${observed.slice(0, 5).map((f) => `${chainName(f.from)} to ${chainName(f.to)} ${usd(f.netUsd)}`).join('; ')}`}>
              <defs>
                <filter id={`glow-${uid}`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.4" /></filter>
                <marker id={`head-${uid}`} viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" style={{ fill: 'var(--in-3)' }} />
                </marker>
                {layout.arcs.map((a, i) => (
                  <linearGradient key={a.key} id={`g-${uid}-${i}`} gradientUnits="userSpaceOnUse" x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2}>
                    <stop offset="0" style={{ stopColor: 'var(--out-3)' }} />
                    <stop offset="1" style={{ stopColor: 'var(--in-3)' }} />
                  </linearGradient>
                ))}
              </defs>

              {/* Orbit guide */}
              <circle cx={W / 2} cy={H / 2} r={Math.min(W, H) * ring} fill="none" stroke="var(--axis)" strokeOpacity={0.5} strokeDasharray="2 6" />

              {/* Arcs: soft underlay, gradient stroke, then particles. */}
              {layout.arcs.map((a, i) => {
                const on = focus === a.key, dim = focus != null && !on;
                const k = particleCount(a.edge.walletCount);
                const dur = 1.6 + a.length / 260;
                return (
                  <g key={a.key} className="cursor-pointer" opacity={dim ? 0.22 : 1}
                    onMouseEnter={() => setHovered(a.key)} onMouseLeave={() => setHovered(null)} onClick={() => setSelected(a.key)}>
                    <title>{`${chainName(a.from)} → ${chainName(a.to)}: ${usd(a.edge.netUsd)} net, ${a.edge.walletCount} wallets`}</title>
                    <path id={`p-${uid}-${i}`} d={a.d} fill="none" stroke={`url(#g-${uid}-${i})`} strokeWidth={a.width + 6} strokeOpacity={0.12} strokeLinecap="round" />
                    <path d={a.d} fill="none" stroke={`url(#g-${uid}-${i})`} strokeWidth={a.width} strokeOpacity={on ? 0.95 : 0.6} strokeLinecap="round"
                      markerEnd={reduce ? `url(#head-${uid})` : undefined} />
                    {!reduce && Array.from({ length: k }, (_, j) => (
                      <g key={j}>
                        <circle r={2 + a.width / 5} style={{ fill: 'var(--in-4)' }} filter={`url(#glow-${uid})`} opacity={0.9}>
                          <animateMotion dur={`${dur}s`} begin={`${(j * dur) / k}s`} repeatCount="indefinite" rotate="auto"><mpath href={`#p-${uid}-${i}`} /></animateMotion>
                        </circle>
                        <circle r={1.2 + a.width / 9} style={{ fill: 'var(--ink-1)' }}>
                          <animateMotion dur={`${dur}s`} begin={`${(j * dur) / k}s`} repeatCount="indefinite"><mpath href={`#p-${uid}-${i}`} /></animateMotion>
                        </circle>
                      </g>
                    ))}
                    {/* Fat invisible hit target. */}
                    <path d={a.d} fill="none" stroke="transparent" strokeWidth={Math.max(18, a.width + 12)} />
                  </g>
                );
              })}

              {/* Chains */}
              {layout.nodes.map((n) => {
                const c = cpi.get(n.chain);
                const ring = c != null ? fillVar(pressureClass(c)) : 'var(--axis)';
                const logo = chainLogoSrc(n.chain);
                const involved = focus != null && (focus.startsWith(`${n.chain}>`) || focus.endsWith(`>${n.chain}`));
                const lx = narrow ? n.x : n.side === 'left' ? n.x - 34 : n.x + 34;
                const anchor = narrow ? 'middle' : n.side === 'left' ? 'end' : 'start';
                const ly = narrow ? n.y + 40 : n.y - 3;
                return (
                  <g key={n.chain}>
                    <circle cx={n.x} cy={n.y} r={24} style={{ fill: 'var(--surface-2)' }} stroke={ring} strokeWidth={involved ? 3.5 : 2} />
                    {logo
                      ? <image href={logo} x={n.x - 11} y={n.y - 11} width={22} height={22} />
                      : <text x={n.x} y={n.y + 4} textAnchor="middle" className="fill-ink text-[11px] font-semibold">{chainName(n.chain).slice(0, 2).toUpperCase()}</text>}
                    <text x={lx} y={ly} textAnchor={anchor} className="fill-ink text-[13px] font-medium">{chainName(n.chain)}</text>
                    <text x={lx} y={ly + 16} textAnchor={anchor} className="num text-[11.5px]"
                      style={{ fill: n.net >= 0 ? 'var(--in-3)' : 'var(--out-3)' }}>
                      {n.net >= 0 ? '▲ +' : '▼ −'}{usd(Math.abs(n.net))}{c != null && !narrow ? ` · Flow ${num(c, 0)}` : ''}
                    </text>
                  </g>
                );
              })}
              <text x={W / 2 - (narrow ? 120 : 250)} y={H - 6} textAnchor="middle" className="fill-ink-muted text-[10.5px] uppercase tracking-[0.14em]">Net sellers</text>
              <text x={W / 2 + (narrow ? 120 : 250)} y={H - 6} textAnchor="middle" className="fill-ink-muted text-[10.5px] uppercase tracking-[0.14em]">Net buyers</text>
            </svg>
            <p className="mt-1 text-[11px] text-ink-muted">Width = net USD · particles = wallets behind the flow · red → green = sell side to buy side · ring = the chain&apos;s Flow Index</p>
          </div>

          {/* Detail of the selected flow, then every flow as a keyboard-reachable list. */}
          <div className="min-w-0 space-y-3">
            {front && <FlowDetail front={front} onWallets={() => setSheet(frontKey(front))} />}
            <ul className="divide-y divide-border rounded-xl border border-border" aria-label="All flows">
              {observed.map((f) => {
                const key = frontKey(f), on = key === active;
                return (
                  <li key={key}>
                    <button type="button" aria-pressed={on} onClick={() => setSelected(key)} onMouseEnter={() => setHovered(key)} onMouseLeave={() => setHovered(null)}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] hover:bg-raised ${on ? 'bg-raised' : ''}`}>
                      <ChainLogo chain={f.from} size={14} /><span className="text-ink-2">→</span><ChainLogo chain={f.to} size={14} />
                      <span className="min-w-0 flex-1 truncate text-ink">{chainName(f.from)} → {chainName(f.to)}</span>
                      <span className="num text-ink">{usd(f.netUsd)}</span>
                      <span className="num w-8 text-right text-ink-muted">{f.walletCount}w</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
      <FrontSheet front={observed.find((f) => frontKey(f) === sheet) ?? null} onClose={() => setSheet(null)} />
    </section>
  );
}

function FlowDetail({ front: f, onWallets }: { front: FrontWithProvenance; onWallets: () => void }) {
  const sold = topTokens(f.wallets.map((w) => w.soldTokens));
  const bought = topTokens(f.wallets.map((w) => w.boughtTokens));
  return (
    <div className="rounded-xl border border-border bg-raised/40 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-[14px] font-semibold text-ink">
          <ChainLogo chain={f.from} size={18} />{chainName(f.from)}<span className="text-ink-muted">→</span><ChainLogo chain={f.to} size={18} />{chainName(f.to)}
        </div>
        <InfoPopover p={f.provenance} />
      </div>
      <div className="num mt-2 text-[24px] font-semibold leading-none" style={{ color: 'var(--in-3)' }}>{usd(f.netUsd)}</div>
      <div className="mt-0.5 text-[11.5px] text-ink-muted">net rotated · {usd(f.grossForward)} forward, {usd(f.grossBack)} back</div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
        <div><dt className="label">Wallets</dt><dd className="num text-ink">{f.walletCount}</dd></div>
        <div>
          <dt className="label">Confidence</dt>
          <dd className="flex items-center gap-2"><span className="num text-ink">{num(f.confidence, 2)}</span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-accent" aria-hidden><span className="block h-full rounded-full bg-brand" style={{ width: `${f.confidence * 100}%` }} /></span></dd>
        </div>
      </dl>
      {(sold.length > 0 || bought.length > 0) && (
        <div className="mt-3 space-y-1.5 text-[12px]">
          {sold.length > 0 && <TokenRow label={`Sold on ${chainName(f.from)}`} tokens={sold} />}
          {bought.length > 0 && <TokenRow label={`Bought on ${chainName(f.to)}`} tokens={bought} />}
        </div>
      )}
      <ul className="mt-3 space-y-1 text-[12px]">
        {f.wallets.slice(0, 3).map((w) => (
          <li key={w.wallet} className="flex items-center justify-between gap-2">
            <Link href={`/wallet/${w.wallet}`} className="truncate text-ink-2 hover:text-ink hover:underline">{w.label ? walletName(w.label, w.wallet) : shortAddress(w.wallet)}</Link>
            <span className="num shrink-0 text-ink-muted">{usd(w.boughtUsd)}</span>
          </li>
        ))}
      </ul>
      <button type="button" onClick={onWallets} className="mt-2 text-[12px] text-brand hover:underline">All {f.walletCount} wallets and their trades →</button>
    </div>
  );
}

function TokenRow({ label, tokens }: { label: string; tokens: string[] }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {tokens.map((t) => <span key={t} className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-ink"><TokenLogo symbol={t} size={12} badge={false} />{t}</span>)}
      </div>
    </div>
  );
}
