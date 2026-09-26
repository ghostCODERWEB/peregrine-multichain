'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlphaView } from '@/components/alpha/AlphaView';
import type { AlphaBoard, AlphaRow } from '@/server/alpha/board';
import { chainName, num, pct, usd } from '@/lib/viz/format';
import { DIVERGENCE_TEXT, type Divergence } from '@/lib/models/spot-perp';

type Preset = { id: string; label: string; rule: string; test: (r: AlphaRow, ctx: { volTop: number }) => boolean };

const f = (r: AlphaRow) => r.flowShare ?? 0;
const p = (r: AlphaRow) => r.priceChange24h ?? 0;
const vol = (r: AlphaRow) => r.volume24hUsd ?? 0;

/** Each preset is a stated condition on the board's own fields: nothing hidden. */
const PRESETS: Preset[] = [
  { id: 'accumulation', label: 'Accumulation', rule: 'net flow ≥ 5% of volume, volume ≥ $100K', test: (r) => f(r) >= 0.05 && vol(r) >= 1e5 },
  { id: 'distribution', label: 'Distribution', rule: 'net flow ≤ −5% of volume, volume ≥ $100K', test: (r) => f(r) <= -0.05 && vol(r) >= 1e5 },
  { id: 'dip-buying', label: 'Bought while falling', rule: 'net flow > 2% of volume and price down over 24h', test: (r) => f(r) > 0.02 && p(r) < 0 },
  { id: 'selling-strength', label: 'Sold while rising', rule: 'net flow < −2% of volume and price up over 24h', test: (r) => f(r) < -0.02 && p(r) > 0 },
  { id: 'activity', label: 'Highest activity', rule: 'top 10 by 24h volume', test: (r, c) => vol(r) >= c.volTop },
  { id: 'liquid', label: 'Deep liquidity', rule: 'liquidity ≥ $1M', test: (r) => (r.liquidityUsd ?? 0) >= 1e6 },
];

const W = 900, H = 360, PAD = 44;
const clamp = (v: number, m: number) => Math.max(-m, Math.min(m, v));

function MarketMap({ rows, match, onPick }: { rows: AlphaRow[]; match: (r: AlphaRow) => boolean; onPick: (r: AlphaRow) => void }) {
  const [hover, setHover] = useState<AlphaRow | null>(null);
  // Axes span the 90th percentile, so one outlier cannot flatten the rest (outliers sit on the edge).
  const p90 = (xs: number[]) => { const s = xs.map(Math.abs).sort((a, b) => a - b); return s[Math.floor(s.length * 0.9)] ?? 0; };
  const fx = Math.max(0.05, p90(rows.map(f)) * 1.1);
  const fy = Math.max(0.05, p90(rows.map(p)) * 1.1);
  const maxV = Math.max(1, ...rows.map(vol));
  const x = (v: number) => PAD + ((clamp(v, fx) + fx) / (2 * fx)) * (W - 2 * PAD);
  const y = (v: number) => H - PAD - ((clamp(v, fy) + fy) / (2 * fy)) * (H - 2 * PAD);
  const q = (t: string, tx: number, ty: number, anchor: 'start' | 'end') => <text x={tx} y={ty} textAnchor={anchor} className="fill-ink-muted text-[11px] font-semibold">{t}</text>;
  return (
    <figure className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="group" aria-label={`Market map: ${rows.length} tokens by net flow share and 24h price change`}>
        <line x1={x(0)} x2={x(0)} y1={PAD / 2} y2={H - PAD} stroke="var(--hair-2)" />
        <line x1={PAD} x2={W - PAD / 2} y1={y(0)} y2={y(0)} stroke="var(--hair-2)" />
        {q('Bought and rising', W - PAD / 2, PAD / 2 + 10, 'end')}
        {q('Sold while rising', PAD, PAD / 2 + 10, 'start')}
        {q('Bought while falling', W - PAD / 2, H - PAD - 6, 'end')}
        {q('Sold and falling', PAD, H - PAD - 6, 'start')}
        <text x={W / 2} y={H - 10} textAnchor="middle" className="fill-ink-muted text-[11px]">net flow as a share of 24h volume</text>
        <text x={12} y={H / 2} transform={`rotate(-90 12 ${H / 2})`} textAnchor="middle" className="fill-ink-muted text-[11px]">24h price change</text>
        {[...rows].sort((a, b) => vol(b) - vol(a)).map((r) => {
          const on = match(r);
          const rad = 4 + 18 * Math.sqrt(vol(r) / maxV);
          const color = r.score >= 65 ? 'var(--mint)' : r.score <= 35 ? 'var(--flare)' : 'var(--ink-2)';
          return (
            <a key={`${r.chain}:${r.tokenAddress}`} href={`/token/${r.chain}/${encodeURIComponent(r.tokenAddress)}`}
              onClick={(e) => { e.preventDefault(); onPick(r); }} onMouseEnter={() => setHover(r)} onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(r)} onBlur={() => setHover(null)}
              aria-label={`${r.symbol ?? 'Token'} on ${chainName(r.chain)}: net flow ${pct(r.flowShare, 1)} of volume, price ${pct(r.priceChange24h, 1)}, volume ${usd(r.volume24hUsd)}, alpha ${r.score}`}>
              <circle cx={x(f(r))} cy={y(p(r))} r={rad} fill={color} fillOpacity={on ? 0.32 : 0.06} stroke={color} strokeOpacity={on ? 0.9 : 0.2} strokeWidth={hover === r ? 2.5 : 1.2} className="cursor-pointer" />
              {on && rad > 13 && <text x={x(f(r))} y={y(p(r)) + 3.5} textAnchor="middle" className="pointer-events-none fill-ink text-[10px] font-bold">{(r.symbol ?? '').slice(0, 6)}</text>}
            </a>
          );
        })}
      </svg>
      {hover && (
        <figcaption className="pointer-events-none absolute right-2 top-2 rounded-[10px] border border-[var(--hair-2)] bg-[var(--surface-1)] px-3 py-2 text-[12px] shadow-lg">
          <p className="font-bold text-ink">{hover.symbol ?? 'Token'} <span className="font-normal text-ink-muted">{chainName(hover.chain)}</span></p>
          <p className="num text-ink-2">Flow {pct(hover.flowShare, 1)} of vol · price {pct(hover.priceChange24h, 1)}</p>
          <p className="num text-ink-2">Vol {usd(hover.volume24hUsd)} · liq {usd(hover.liquidityUsd)} · alpha {hover.score}</p>
        </figcaption>
      )}
    </figure>
  );
}

export function Discover({ board, universe, source, divergence = [] }: { board: AlphaBoard; universe: AlphaRow[]; source: string; divergence?: Divergence[] }) {
  const router = useRouter();
  const [preset, setPreset] = useState<string | null>(null);
  // Map, summary and presets use the whole traded universe; the ranked list below is the alpha board.
  const rows = universe.length ? universe : board.rows;
  const volTop = useMemo(() => [...rows].map(vol).sort((a, b) => b - a)[9] ?? Infinity, [rows]);
  const active = PRESETS.find((x) => x.id === preset) ?? null;
  const match = (r: AlphaRow) => !active || active.test(r, { volTop });
  const counts = useMemo(() => Object.fromEntries(PRESETS.map((x) => [x.id, rows.filter((r) => x.test(r, { volTop })).length])), [rows, volTop]);
  const liquid = rows.filter((r) => vol(r) >= 1e5);
  const topIn = [...liquid].sort((a, b) => f(b) - f(a))[0];
  const topOut = [...liquid].sort((a, b) => f(a) - f(b))[0];
  const busiest = [...rows].sort((a, b) => vol(b) - vol(a))[0];
  const tokenHref = (r: AlphaRow) => `/token/${r.chain}/${encodeURIComponent(r.tokenAddress)}`;
  const filtered = useMemo(() => ({ ...board, rows: board.rows.filter(match) }), [board, preset, volTop]); // eslint-disable-line react-hooks/exhaustive-deps

  const stat = (label: string, r: AlphaRow | undefined, value: (r: AlphaRow) => string, tone?: 'in' | 'out') => (
    <li className="min-w-0 bg-[var(--surface-1)]">
      {r ? (
        <Link href={tokenHref(r)} className="block px-3.5 py-2.5 hover:bg-[var(--surface-2)]">
          <span className="block text-[11.5px] font-semibold text-ink-muted">{label}</span>
          <span className="num block truncate text-[17px] font-bold" style={tone ? { color: tone === 'in' ? 'var(--mint)' : 'var(--flare)' } : undefined}>{r.symbol ?? 'Token'} {value(r)}</span>
          <span className="block truncate text-[11.5px] text-ink-2">{chainName(r.chain)} · vol {usd(r.volume24hUsd)}</span>
        </Link>
      ) : <span className="block px-3.5 py-2.5 text-[12px] text-ink-muted">{label}: n/a</span>}
    </li>
  );

  return (
    <div className="space-y-4">
      <ul className="stagger grid grid-cols-2 gap-px overflow-hidden rounded-[var(--r-inner)] border border-[var(--hair)] bg-[var(--hair)] lg:grid-cols-4">
        {stat('Strongest accumulation', topIn && f(topIn) > 0 ? topIn : undefined, (r) => `+${pct(r.flowShare, 1)}`, 'in')}
        {stat('Strongest distribution', topOut && f(topOut) < 0 ? topOut : undefined, (r) => pct(r.flowShare, 1), 'out')}
        {stat('Most traded', busiest, (r) => usd(r.volume24hUsd))}
        <li className="min-w-0 bg-[var(--surface-1)] px-3.5 py-2.5">
          <span className="block text-[11.5px] font-semibold text-ink-muted">Flow against price</span>
          <span className="num block text-[17px] font-bold text-ink">{counts['dip-buying'] + counts['selling-strength']} tokens</span>
          <span className="block truncate text-[11.5px] text-ink-2">{counts['dip-buying']} bought while falling · {counts['selling-strength']} sold while rising</span>
        </li>
      </ul>

      <section aria-label="Presets" className="flex flex-wrap items-center gap-1.5">
        {PRESETS.map((x) => (
          <button key={x.id} type="button" aria-pressed={preset === x.id} onClick={() => setPreset(preset === x.id ? null : x.id)} title={x.rule}
            className={`rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${preset === x.id ? 'border-transparent bg-ink/15 text-ink' : 'border-[var(--hair)] text-ink-2 hover:border-[var(--hair-2)] hover:text-ink'}`}>
            {x.label} <span className="num text-ink-muted">{counts[x.id]}</span>
          </button>
        ))}
        {active && <span className="text-[12px] text-ink-muted">Applied: {active.rule}</span>}
      </section>

      <section aria-labelledby="map-title" className="material p-4 sm:p-5">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="map-title" className="t-section">Market map</h2>
          <p className="text-[12px] text-ink-muted">{rows.length} tokens · {source} · bubble = 24h volume · colour = alpha score · select a bubble for its token page</p>
        </div>
        <MarketMap rows={rows} match={match} onPick={(r) => router.push(tokenHref(r))} />
      </section>

      {divergence.length > 0 && (
        <section aria-labelledby="sp-title" className="material p-4 sm:p-5">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="sp-title" className="t-section">Spot vs perps</h2>
            <p className="text-[12px] text-ink-muted">DEX net flow share (24h, {source}) against Hyperliquid Perp Flow Index · a lean needs ±2% of volume and ±10 from 50 · descriptive, not a signal</p>
          </div>
          <table className="w-full text-[13px]">
            <thead className="text-[11.5px] text-ink-muted"><tr><th className="py-1.5 text-left font-semibold">Coin</th><th className="text-left font-semibold">Observation</th><th className="text-right font-semibold">Spot net / volume</th><th className="text-right font-semibold">Perp Flow Index</th><th className="text-right font-semibold">Open interest</th></tr></thead>
            <tbody>
              {divergence.map((d) => (
                <tr key={d.symbol} className="border-t border-[var(--hair)]">
                  <td className="py-1.5"><Link href={`/perps/${encodeURIComponent(d.symbol)}`} className="font-semibold text-ink hover:underline">{d.symbol}</Link></td>
                  <td className={d.kind.startsWith('spot') ? 'font-semibold text-ink' : 'text-ink-2'}>{DIVERGENCE_TEXT[d.kind]}</td>
                  <td className="num text-right" style={{ color: d.spotShare >= 0 ? 'var(--mint)' : 'var(--flare)' }}>{usd(d.spotNetUsd, { signed: true })} · {pct(d.spotShare, 1)}</td>
                  <td className="num text-right" style={{ color: d.ppi >= 50 ? 'var(--mint)' : 'var(--flare)' }}>{num(d.ppi, 0)}</td>
                  <td className="num text-right text-ink-2">{usd(d.openInterest)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <AlphaView board={filtered} />
    </div>
  );
}
