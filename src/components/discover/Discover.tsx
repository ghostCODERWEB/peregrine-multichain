'use client';
import { TokenLogo } from '@/components/Logo';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlphaView } from '@/components/alpha/AlphaView';
import type { AlphaBoard, AlphaRow } from '@/server/alpha/board';
import { chainName, num, pct, usd } from '@/lib/viz/format';
import { DIVERGENCE_TEXT, type Divergence } from '@/lib/models/spot-perp';
import { ExplainView } from '@/components/ExplainView';

// Browsers keep a style percentage to 4 decimals; a full-precision value rendered on the server then no longer
// matches the client's and React reports a hydration mismatch for every bubble. 3 decimals is far below a pixel.
const pctPos = (v: number, of: number) => Math.round((v / of) * 100_000) / 1000;

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

const W = 1000, H = 440, PAD = 40;
// asinh spreads the crowded middle and keeps outliers on the plot.
const sx = (v: number, k: number) => Math.asinh(v / k);

function MarketMap({ rows, match, onPick }: { rows: AlphaRow[]; match: (r: AlphaRow) => boolean; onPick: (r: AlphaRow) => void }) {
  const [hover, setHover] = useState<AlphaRow | null>(null);
  // Phones: smaller bubbles on a taller map, so tokens stay apart and readable.
  const [k, setK] = useState(1);
  useEffect(() => { const fit = () => setK(window.innerWidth < 640 ? 0.58 : 1); fit(); addEventListener('resize', fit); return () => removeEventListener('resize', fit); }, []);
  const pts = useMemo(() => {
    const kx = 0.04, ky = 0.03;
    const xs = rows.map((r) => sx(f(r), kx)), ys = rows.map((r) => sx(p(r), ky));
    const mx = Math.max(0.5, ...xs.map(Math.abs)) * 1.08, my = Math.max(0.5, ...ys.map(Math.abs)) * 1.12;
    const maxV = Math.max(1, ...rows.map(vol));
    const out = rows.map((r, i) => ({ r, x: W / 2 + (xs[i] / mx) * (W / 2 - PAD), y: H / 2 - (ys[i] / my) * (H / 2 - PAD), rad: 13 + 17 * Math.sqrt(vol(r) / maxV) }));
    // Nudge overlapping bubbles apart (a few relaxation passes), staying inside the plot.
    for (let it = 0; it < 60; it++) {
      for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) {
        const a = out[i], b = out[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.01, min = a.rad + b.rad + 3;
        if (d < min) { const push = (min - d) / 2, ux = dx / d, uy = dy / d; a.x -= ux * push; a.y -= uy * push; b.x += ux * push; b.y += uy * push; }
      }
      for (const o of out) { o.x = Math.max(PAD / 2 + o.rad, Math.min(W - PAD / 2 - o.rad, o.x)); o.y = Math.max(PAD / 2 + o.rad, Math.min(H - PAD - o.rad, o.y)); }
    }
    return out;
  }, [rows]);
  const quad = (t: string, cls: string) => <span className={`pointer-events-none absolute text-[9.5px] sm:text-[11.5px] font-semibold uppercase tracking-[0.08em] ${cls}`}>{t}</span>;
  return (
    <figure className="relative w-full select-none" style={{ aspectRatio: k < 1 ? `${W} / ${Math.round(H * 1.7)}` : `${W} / ${H}` }} aria-label={`Market map: ${rows.length} tokens by net flow share and 24h price change`}>
      <div aria-hidden className="absolute inset-0 grid grid-cols-2 grid-rows-2 overflow-hidden rounded-[12px]">
        <span className="bg-[color-mix(in_srgb,var(--amber)_5%,transparent)]" /><span className="bg-[color-mix(in_srgb,var(--mint)_7%,transparent)]" />
        <span className="bg-[color-mix(in_srgb,var(--flare)_6%,transparent)]" /><span className="bg-[color-mix(in_srgb,var(--signal)_5%,transparent)]" />
      </div>
      <span aria-hidden className="absolute bottom-[9%] top-[4%] w-px bg-[var(--hair-2)]" style={{ left: '50%' }} />
      <span aria-hidden className="absolute left-[2%] right-[2%] h-px bg-[var(--hair-2)]" style={{ top: '50%' }} />
      {quad('Bought and rising', 'right-3 top-2 text-[var(--mint)]')}{quad('Sold while rising', 'left-3 top-2 text-[var(--amber)]')}
      {quad('Bought while falling', 'bottom-9 right-3 text-[var(--signal)]')}{quad('Sold and falling', 'bottom-9 left-3 text-[var(--flare)]')}
      <span className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 text-[11px] text-ink-muted">net flow as a share of 24h volume →</span>
      {pts.map(({ r, x, y, rad }) => {
        const on = match(r);
        const ring = r.score >= 65 ? 'var(--mint)' : r.score <= 35 ? 'var(--flare)' : 'var(--hair-2)';
        const size = rad * 2 * k;
        return (
          <a key={`${r.chain}:${r.tokenAddress}`} href={`/token/${r.chain}/${encodeURIComponent(r.tokenAddress)}`}
            onClick={(e) => { e.preventDefault(); onPick(r); }} onMouseEnter={() => setHover(r)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(r)} onBlur={() => setHover(null)}
            aria-label={`${r.symbol ?? 'Token'} on ${chainName(r.chain)}: net flow ${pct(r.flowShare, 1)} of volume, price ${pct(r.priceChange24h, 1)}, volume ${usd(r.volume24hUsd)}, alpha ${r.score}`}
            className="map-bubble absolute flex flex-col items-center" style={{ left: `${pctPos(x, W)}%`, top: `${pctPos(y, H)}%`, transform: 'translate(-50%, -50%)', opacity: on ? 1 : 0.25, zIndex: hover === r ? 5 : Math.round(rad) }}>
            <span className="grid place-items-center rounded-full bg-[var(--surface-1)] transition-transform" style={{ padding: 2, boxShadow: `0 0 0 2px ${ring}` }}>
              <TokenLogo symbol={r.symbol} logo={r.logo} chain={r.chain} address={r.tokenAddress} size={Math.round(size * 0.9)} />
            </span>
            {(k === 1 || rad >= 20) && <span className="mt-0.5 whitespace-nowrap rounded bg-[color-mix(in_srgb,var(--surface-1)_80%,transparent)] px-1 text-[9.5px] font-bold leading-tight text-ink sm:text-[10px]">{(r.symbol ?? '').replace(/^[^A-Za-z0-9$]+/, '').slice(0, 8)}</span>}
          </a>
        );
      })}
      {hover && (
        <figcaption className="pointer-events-none absolute right-2 top-8 z-10 rounded-[10px] border border-[var(--hair-2)] bg-[var(--surface-1)] px-3 py-2 text-[12px] shadow-lg">
          <p className="flex items-center gap-1.5 font-bold text-ink"><TokenLogo symbol={hover.symbol} logo={hover.logo} chain={hover.chain} address={hover.tokenAddress} size={16} />{hover.symbol ?? 'Token'} <span className="font-normal text-ink-muted">{chainName(hover.chain)}</span></p>
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
  // Discover as of a past date: Nansen's historical Token Screener replaces the live universe.
  const [asOf, setAsOf] = useState('');
  const [past, setPast] = useState<{ date: string; rows: AlphaRow[]; credits: number } | { error: string } | null>(null);
  const [loadingPast, setLoadingPast] = useState(false);
  const loadPast = async (date: string) => {
    setAsOf(date);
    if (!date) { setPast(null); return; }
    setLoadingPast(true);
    try {
      const chains = (board.chains.length ? board.chains : ['ethereum', 'solana', 'base', 'bnb']).slice(0, 8).join(',');
      const r = await fetch(`/api/history?kind=screener&date=${date}&chains=${chains}&days=1`);
      const j = await r.json();
      if (!r.ok) { setPast({ error: j.error ?? 'Unavailable.' }); return; }
      const rows: AlphaRow[] = (j.data as Array<{ chain: string; token: string; symbol: string | null; priceUsd: number | null; priceChange: number | null; volume: number | null; netflow: number | null; liquidity: number | null; marketCap: number | null }>)
        .filter((x) => (x.volume ?? 0) > 0 && x.netflow != null)
        .map((x) => ({ chain: x.chain, tokenAddress: x.token, symbol: x.symbol, logo: null, score: 50, parts: [], hourly: [], flowShare: x.netflow! / x.volume!, volume24hUsd: x.volume, liquidityUsd: x.liquidity, marketCapUsd: x.marketCap, priceChange24h: x.priceChange, priceUsd: x.priceUsd }));
      setPast({ date, rows, credits: j.tally.credits });
    } catch { setPast({ error: 'Could not reach the server.' }); } finally { setLoadingPast(false); }
  };
  // Map, summary and presets use the whole traded universe; the ranked list below is the alpha board.
  const rows = past && !('error' in past) ? past.rows : universe.length ? universe : board.rows;
  const volTop = useMemo(() => [...rows].map(vol).sort((a, b) => b - a)[9] ?? Infinity, [rows]);
  const active = PRESETS.find((x) => x.id === preset) ?? null;
  const match = (r: AlphaRow) => !active || active.test(r, { volTop });
  const counts = useMemo(() => Object.fromEntries(PRESETS.map((x) => [x.id, rows.filter((r) => x.test(r, { volTop })).length])), [rows, volTop]);
  // Headline tiles need real volume: a 100% one-way flow on a thin token is not the strongest accumulation.
  const deep = rows.filter((r) => vol(r) >= 5e5);
  const liquid = deep.length >= 5 ? deep : rows.filter((r) => vol(r) >= 1e5);
  const topIn = [...liquid].sort((a, b) => f(b) - f(a))[0];
  const topOut = [...liquid].sort((a, b) => f(a) - f(b))[0];
  const busiest = [...rows].sort((a, b) => vol(b) - vol(a))[0];
  const tokenHref = (r: AlphaRow) => `/token/${r.chain}/${encodeURIComponent(r.tokenAddress)}`;
  const filtered = useMemo(() => ({ ...board, rows: board.rows.filter(match) }), [board, preset, volTop]); // eslint-disable-line react-hooks/exhaustive-deps

  const stat = (label: string, r: AlphaRow | undefined, value: (r: AlphaRow) => string, tone?: 'in' | 'out') => (
    <li className="min-w-0 bg-[var(--surface-1)]">
      {r ? (
        <Link prefetch={false} href={tokenHref(r)} className="block px-3.5 py-2.5 hover:bg-[var(--surface-2)]">
          <span className="block text-[11.5px] font-semibold text-ink-muted">{label}</span>
          <span className="num block truncate text-[17px] font-bold" style={tone ? { color: tone === 'in' ? 'var(--mint)' : 'var(--flare)' } : undefined}><span className="flex min-w-0 items-center gap-1.5"><TokenLogo symbol={r.symbol} chain={r.chain} address={r.tokenAddress} size={18} /><span className="truncate">{r.symbol ?? 'Token'} {value(r)}</span></span></span>
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

      <div className={`flex flex-wrap items-center gap-2 rounded-[var(--r-inner)] border px-3.5 py-2 text-[12.5px] ${past && !('error' in past) ? 'border-[color-mix(in_srgb,var(--signal)_45%,transparent)] bg-[color-mix(in_srgb,var(--signal)_8%,transparent)]' : 'border-[var(--hair)]'}`}>
        <span className="font-semibold text-ink">As of</span>
        <input type="date" value={asOf} max={new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)} onChange={(e) => loadPast(e.target.value)} aria-label="Discover as of a past date" className="inset-well h-8 rounded-[8px] px-2 text-ink" />
        <span className="text-ink-2">
          {loadingPast ? 'Reading Nansen Token Screener history…' : past && 'error' in past ? past.error : past ? `Showing the market on ${past.date} (Nansen historical screener, all traders). Alpha list below stays live.` : 'Live. Pick a past date to see the market as it was.'}
        </span>
        {past && <button type="button" onClick={() => loadPast('')} className="font-semibold text-brand">Back to now</button>}
      </div>

      <section aria-label="Presets" className="chip-row flex flex-wrap items-center gap-1.5">
        <ExplainView view="discover" context={{ source, tokens: rows.length, presetCounts: counts, strongestAccumulation: topIn && { symbol: topIn.symbol, chain: topIn.chain, flowShare: topIn.flowShare, volumeUsd: topIn.volume24hUsd }, strongestDistribution: topOut && { symbol: topOut.symbol, chain: topOut.chain, flowShare: topOut.flowShare, volumeUsd: topOut.volume24hUsd }, spotVsPerps: divergence.map((d) => ({ symbol: d.symbol, observation: DIVERGENCE_TEXT[d.kind], spotNetUsd: Math.round(d.spotNetUsd), spotShare: d.spotShare, perpFlowIndex: d.ppi })) }} coins={divergence.map((d) => d.symbol)} />
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
          <table data-sortable className="w-full text-[13px]">
            <thead className="text-[11.5px] text-ink-muted"><tr><th className="py-1.5 text-left font-semibold">Coin</th><th className="text-left font-semibold">Observation</th><th className="text-right font-semibold">Spot net / volume</th><th className="text-right font-semibold">Perp Flow Index</th><th className="text-right font-semibold">Open interest</th></tr></thead>
            <tbody>
              {divergence.map((d) => (
                <tr key={d.symbol} className="border-t border-[var(--hair)]">
                  <td className="py-1.5"><Link prefetch={false} href={`/perps/${encodeURIComponent(d.symbol)}`} className="inline-flex items-center gap-1.5 font-semibold text-ink hover:underline"><TokenLogo symbol={d.symbol} coin={d.symbol} size={16} />{d.symbol}</Link></td>
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
