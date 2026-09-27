'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { TokenLogo } from '@/components/Logo';
import type { MapNode, Evidence, ReplayEpisode } from '@/server/cascade/cascades';
import type { Edge } from '@/lib/models/cascade';

const W = 900, H = 420, PX = 56, PY = 30;
const roleColor = (r: MapNode['role'] | null) => (r === 'leader' ? 'var(--mint)' : r === 'follower' ? 'var(--flare)' : 'var(--ink-muted)');
const fmtMin = (m: number) => (Math.abs(m) >= 1440 ? `${(m / 1440).toFixed(1)}d` : Math.abs(m) >= 60 ? `${(m / 60).toFixed(1)}h` : `${Math.round(m)}m`);

/** The Leadership map (x = how early a wallet enters, y = evidence), its precedence arrows, the evidence panel, and the cascade replay. */
export function CascadeExplorer({ nodes, edges, evidence, replay }: { nodes: MapNode[]; edges: Edge[]; evidence: Record<string, Evidence[]>; replay: ReplayEpisode[] }) {
  const lead = nodes.filter((n) => n.q)[0] ?? nodes[0];
  const [sel, setSel] = useState<string | null>(lead?.wallet ?? null);
  const [hover, setHover] = useState<string | null>(null);
  const [ep, setEp] = useState(0);
  const byId = useMemo(() => new Map(nodes.map((n) => [n.wallet, n])), [nodes]);
  const maxEp = Math.max(...nodes.map((n) => n.episodes));
  const x = (r: number) => PX + r * (W - 2 * PX);
  // Deterministic jitter from the address so wallets with equal episode counts spread into a band instead of a line.
  const jit = (w: string) => { let h = 0; for (let i = 0; i < w.length; i++) h = (h * 31 + w.charCodeAt(i)) | 0; return ((h >>> 0) % 1000) / 1000 - 0.5; };
  const y = (n: MapNode) => H - PY - 14 - (Math.log(n.episodes) / Math.log(maxEp)) * (H - 2 * PY - 24) * 0.9 + jit(n.wallet) * 30;
  const pos = (w: string) => { const n = byId.get(w)!; return [x(n.meanR), y(n)] as const; };
  const s = sel ? byId.get(sel) : null;
  const ev = sel ? [...(evidence[sel] ?? [])].sort((a, b) => b.at - a.at) : [];
  const focus = hover ?? sel;
  const e = replay[ep];
  const span = e ? Math.max(1, e.entries.at(-1)!.at - e.start) : 1;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12 [&>*]:min-w-0">
      <section className="material hidden p-4 sm:block sm:p-5 xl:col-span-8" aria-labelledby="map">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="map" className="t-section">Leadership map</h2>
          <span className="text-[12px] text-ink-muted">Each dot is a Smart Money wallet · left enters first, right enters late · arrows: A enters before B more often than chance</span>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Smart Money wallets by average entry rank, with significant precedence arrows">
          <defs>
            <marker id="cas-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--mint)" /></marker>
            <linearGradient id="cas-bg" x1="0" x2="1"><stop stopColor="var(--mint)" stopOpacity=".09" /><stop offset=".5" stopColor="var(--mint)" stopOpacity="0" /><stop offset="1" stopColor="var(--flare)" stopOpacity=".08" /></linearGradient>
          </defs>
          <rect x={PX} y={PY - 10} width={W - 2 * PX} height={H - 2 * PY + 10} rx="14" fill="url(#cas-bg)" />
          <line x1={x(0.5)} x2={x(0.5)} y1={PY - 10} y2={H - PY} stroke="var(--hair-2)" strokeDasharray="3 6" />
          <text x={x(0)} y={H - 8} className="fill-[var(--mint)] text-[11px] font-bold">ENTERS FIRST</text>
          <text x={x(0.5)} y={H - 8} textAnchor="middle" className="fill-ink-muted text-[11px]">random order</text>
          <text x={x(1)} y={H - 8} textAnchor="end" className="fill-[var(--flare)] text-[11px] font-bold">ENTERS LATE</text>
          <text x={14} y={PY + 4} className="fill-ink-muted text-[10.5px]">more tokens</text>
          {edges.map((g) => {
            if (!byId.has(g.from) || !byId.has(g.to)) return null;
            const [x1, y1] = pos(g.from), [x2, y2] = pos(g.to);
            const on = focus === g.from || focus === g.to;
            const mx = (x1 + x2) / 2, my = Math.min(y1, y2) - 30 - Math.abs(x2 - x1) * 0.12;
            return <path key={`${g.from}>${g.to}`} d={`M${x1},${y1} Q${mx},${my} ${x2},${y2}`} fill="none" stroke="var(--mint)" strokeWidth={on ? 2.2 : 1.2} strokeOpacity={focus ? (on ? 0.95 : 0.12) : 0.45} markerEnd="url(#cas-arrow)" />;
          })}
          {nodes.map((n) => {
            const r = 3 + Math.sqrt(n.episodes) * 1.6, on = n.wallet === focus, dim = focus && !on && !edges.some((g) => (g.from === focus && g.to === n.wallet) || (g.to === focus && g.from === n.wallet));
            return (
              <g key={n.wallet} onMouseEnter={() => setHover(n.wallet)} onMouseLeave={() => setHover(null)} onClick={() => setSel(n.wallet)} className="cursor-pointer">
                {n.q && <circle cx={x(n.meanR)} cy={y(n)} r={r + 5} fill="none" stroke="var(--mint)" strokeOpacity=".7" />}
                <circle cx={x(n.meanR)} cy={y(n)} r={r} fill={roleColor(n.role)} fillOpacity={dim ? 0.12 : n.role === 'mixed' ? 0.35 : 0.85} stroke={on ? 'var(--ink-1)' : 'none'} strokeWidth={2} />
                {(on || n.q) && <text x={x(n.meanR) + r + 7} y={y(n) + 4} className="fill-ink text-[11.5px] font-semibold">{n.name.slice(0, 28)}</text>}
              </g>
            );
          })}
        </svg>
        <div className="mt-3 grid gap-x-6 gap-y-2 border-t border-[var(--hair)] pt-3 text-[12.5px] sm:grid-cols-2">
          <p className="flex items-start gap-2 text-ink-2"><span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--mint)]" /><span><b className="text-ink">Leaders</b> buy before most other Smart Money wallets, more often than random order would explain.</span></p>
          <p className="flex items-start gap-2 text-ink-2"><span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--flare)]" /><span><b className="text-ink">Followers</b> usually buy after the others: by the time they enter, the move is often underway.</span></p>
          <p className="flex items-start gap-2 text-ink-2"><span className="mt-0.5 grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full border border-[var(--mint)]"><span className="h-1.5 w-1.5 rounded-full bg-[var(--mint)]" /></span><span><b className="text-ink">Ringed</b> leaders stay significant even after checking every wallet at once: the strongest evidence.</span></p>
          <p className="flex items-start gap-2 text-ink-2"><span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--ink-muted)] opacity-50" /><span><b className="text-ink">Grey</b> wallets show no consistent order. Higher dots appear in more tokens; arrows mean one wallet reliably buys before another.</span></p>
        </div>
      </section>

      <section className="material flex flex-col p-4 sm:p-5 xl:col-span-4" aria-labelledby="evidence">
        <h2 id="evidence" className="t-section">Evidence</h2>
        <div className="chip-row -mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1 sm:hidden">
          {nodes.filter((n) => n.role !== 'mixed').sort((a, b) => b.z - a.z).slice(0, 12).map((n) => (
            <button key={n.wallet} type="button" onClick={() => setSel(n.wallet)} className={`shrink-0 rounded-full border px-2.5 py-1 text-[12px] font-semibold ${sel === n.wallet ? 'border-[var(--mint)] text-ink' : 'border-[var(--hair)] text-ink-2'}`} style={{ color: sel === n.wallet ? undefined : roleColor(n.role) }}>{n.name.slice(0, 18)}</button>
          ))}
        </div>
        {s ? (
          <>
            <p className="mt-1 text-[14px] font-bold" style={{ color: roleColor(s.role) }}>{s.role === 'leader' ? 'Enters before other Smart Money' : s.role === 'follower' ? 'Enters after other Smart Money' : 'No consistent order'}</p>
            <Link prefetch={false} href={`/wallet/${s.wallet}`} className="mt-0.5 block truncate text-[13px] font-semibold text-ink hover:underline">{s.name}</Link>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-[12px]">
              <div className="inset-well rounded-[12px] p-2"><dt className="text-ink-muted">Episodes</dt><dd className="num text-[15px] font-bold text-ink">{s.episodes}</dd></div>
              <div className="inset-well rounded-[12px] p-2"><dt className="text-ink-muted">First in</dt><dd className="num text-[15px] font-bold text-ink">{s.firsts}</dd></div>
              <div className="inset-well rounded-[12px] p-2"><dt className="text-ink-muted">Typical lead</dt><dd className="num text-[15px] font-bold text-ink">{s.leadMin != null ? fmtMin(s.leadMin) : 'n/a'}</dd></div>
            </dl>
            <p className="num mt-2 text-[11.5px] text-ink-muted">mean entry rank {s.meanR.toFixed(2)} (0 = first, 0.5 = chance) · z {s.z.toFixed(2)} · p {s.p < 0.001 ? s.p.toExponential(1) : s.p.toFixed(3)}{s.q ? ' · survives FDR' : ''}</p>
            <ol className="mt-3 max-h-[260px] flex-1 divide-y divide-[var(--hair)] overflow-y-auto text-[12px]">
              {ev.map((x) => (
                <li key={`${x.token}:${x.at}`} className="flex items-center gap-2 py-1.5">
                  <TokenLogo symbol={x.symbol} chain={x.chain} address={x.token} size={16} />
                  <Link prefetch={false} href={`/token/${x.chain}/${encodeURIComponent(x.token)}`} className="min-w-0 flex-1 truncate font-semibold text-ink hover:underline">{x.symbol ?? x.token.slice(0, 6)}</Link>
                  <span className="num text-ink-2">#{x.rank} of {x.k}</span>
                  <span className="num w-14 text-right" style={{ color: x.aheadMin >= 0 ? 'var(--mint)' : 'var(--flare)' }}>{x.aheadMin >= 0 ? '−' : '+'}{fmtMin(Math.abs(x.aheadMin))}</span>
                </li>
              ))}
            </ol>
            <p className="mt-2 text-[11px] text-ink-muted">Right column: entry time against the episode&apos;s median Smart Money entrant (− earlier, + later).</p>
          </>
        ) : <p className="mt-2 text-[12.5px] text-ink-muted">Select a wallet on the map.</p>}
      </section>

      {e && (
        <section className="material p-4 sm:p-5 xl:col-span-12" aria-labelledby="replay">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 id="replay" className="t-section flex items-center gap-2">Cascade replay<span className="text-[13px] font-normal text-ink-muted">· who entered {e.symbol ?? 'the token'} first</span></h2>
            <div className="chip-row flex gap-1.5 overflow-x-auto">
              {replay.slice(0, 12).map((r, i) => (
                <button key={`${r.token}:${r.start}`} type="button" onClick={() => setEp(i)} className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-semibold ${i === ep ? 'border-[var(--mint)] text-ink' : 'border-[var(--hair)] text-ink-2 hover:text-ink'}`}>
                  <TokenLogo symbol={r.symbol} chain={r.chain} address={r.token} size={14} />{r.symbol ?? r.token.slice(0, 5)}<span className="num text-ink-muted">{r.entries.length}</span>
                </button>
              ))}
            </div>
          </div>
          <div key={ep} className="relative hidden h-[150px] sm:block" role="img" aria-label={`Order in which ${e.entries.length} Smart Money wallets first bought ${e.symbol}`}>
            <div className="absolute inset-x-0 top-[72px] h-px bg-[var(--hair-2)]" />
            {e.entries.map((x, i) => {
              const f = Math.sqrt((x.at - e.start) / span); // sqrt time: early entrants spread out, late ones compress
              const up = i % 2 === 0;
              return (
                <button key={x.wallet} type="button" onClick={() => setSel(byId.has(x.wallet) ? x.wallet : sel)} className="cascade-dot absolute -translate-x-1/2" style={{ left: `${3 + f * 94}%`, top: up ? 10 : 80, animationDelay: `${i * 90}ms` }} title={`${x.name} · +${fmtMin((x.at - e.start) / 60_000)} · $${Math.round(x.usd).toLocaleString('en-US')}`}>
                  <span className="flex flex-col items-center gap-1">
                    {!up && <span className="h-3 w-px bg-[var(--hair-2)]" />}
                    <span className="grid h-6 w-6 place-items-center rounded-full text-[10px] font-extrabold text-[#04120c]" style={{ background: roleColor(x.role), opacity: x.role ? 1 : 0.55 }}>{i + 1}</span>
                    {(i < 3 || x.role === 'leader') && <span className="max-w-[96px] truncate text-[10.5px] font-semibold text-ink-2">{x.name}</span>}
                    {up && <span className="h-3 w-px bg-[var(--hair-2)]" />}
                  </span>
                </button>
              );
            })}
          </div>
          {/* Phones: the same order as a readable list. */}
          <ol className="divide-y divide-[var(--hair)] sm:hidden">
            {e.entries.slice(0, 12).map((x, i) => (
              <li key={x.wallet}>
                <button type="button" onClick={() => setSel(byId.has(x.wallet) ? x.wallet : sel)} className="flex w-full items-center gap-3 py-2 text-left">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-extrabold text-[#04120c]" style={{ background: roleColor(x.role), opacity: x.role ? 1 : 0.5 }}>{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink">{x.name}</span>
                  <span className="num text-[12px] text-ink-muted">{i === 0 ? 'first' : `+${fmtMin((x.at - e.start) / 60_000)}`}</span>
                </button>
              </li>
            ))}
          </ol>
          <p className="num mt-1 hidden justify-between sm:flex text-[11px] text-ink-muted"><span>first Smart Money buy · {new Date(e.start).toISOString().slice(0, 16).replace('T', ' ')} UTC</span><span>+{fmtMin(span / 60_000)} (square-root time scale)</span></p>
        </section>
      )}
    </div>
  );
}
