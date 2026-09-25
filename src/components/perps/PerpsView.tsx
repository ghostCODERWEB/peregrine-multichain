'use client';
import { FilterBox } from '@/components/FilterBox';
import Link from 'next/link';
import { TokenLogo } from '@/components/Logo';
import { useEffect, useMemo, useState } from 'react';
import { Card, WaveLoading, Unavailable } from '@/components/Card';
import { InfoPopover } from '@/components/InfoPopover';
import { ScoreRing } from '@/components/viz/ScoreRing';
import { LiquidationLadder, leverageTitle } from '@/components/token/Visuals';
import { pct, usd, num, walletName, ago } from '@/lib/viz/format';
import type { PerpBoard, PerpCoin } from '@/server/perps/board';
import type { CoinDetail, PerpLeaders } from '@/server/perps/detail';

type Load<T> = { state: 'idle' } | { state: 'loading' } | { state: 'error'; message: string } | { state: 'ok'; data: T };

async function post<T>(body: object): Promise<T> {
  const r = await fetch('/api/perps', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({ error: 'The server sent an unreadable answer.' }));
  if (!r.ok) throw new Error(j.error ?? `Request failed (${r.status}).`);
  return j as T;
}

/** "xyz:SP500" is a builder-deployed market on Hyperliquid (HIP-3). */
export function Sym({ s, className = '' }: { s: string; className?: string }) {
  const i = s.indexOf(':');
  // Builder markets ("xyz:TSLA") never borrow a crypto logo: TokenLogo shows a badge for them.
  if (i < 0)
    return (
      <span className={`inline-flex min-w-0 items-center gap-1.5 ${className}`}>
        <TokenLogo symbol={s} size={14} />
        {s}
      </span>
    );
  return (
    <span className={`inline-flex min-w-0 items-center gap-1.5 ${className}`}>
      <TokenLogo symbol={null} size={14} />
      {s.slice(i + 1)} <span className="text-[10.5px] font-normal text-ink/80">{s.slice(0, i)}</span>
    </span>
  );
}

const pressureColor = (p: number | null) => (p == null ? 'var(--surface-2)' : p >= 50 ? 'var(--in-2)' : 'var(--out-2)');
const pressureMix = (p: number | null) => {
  if (p == null) return 'var(--surface-1)';
  const k = Math.sqrt(Math.min(1, Math.abs(p - 50) / 50));
  return `color-mix(in oklab, ${pressureColor(p)} ${Math.round(8 + k * 62)}%, var(--surface-1))`;
};
const bandText = (p: number) => (p > 65 ? 'Long bias' : p < 35 ? 'Short bias' : 'Balanced');
const signedPct = (v: number | null, d = 1) => (v == null ? '—' : `${v >= 0 ? '+' : '−'}${pct(Math.abs(v), d)}`);

// ------------------------------------------------------------------ hero

function Hero({ b, title, mode }: { b: PerpBoard; title: string; mode: 'owner' | 'member' | 'public' }) {
  const v = b.venue;
  return (
    <section aria-labelledby="perps-title" className="material rise relative overflow-hidden p-5 sm:p-7">
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-[12px] text-ink-2">
            <span className="rounded border border-border px-2 py-0.5">Hyperliquid</span>
            <span className="rounded border border-border px-2 py-0.5">{mode === 'public' ? 'All traders' : 'With smart money'}</span>
            {b.at && (
              <span className="text-ink-muted" suppressHydrationWarning>
                snapshot {ago(b.at)} · {b.scans} hourly in 7 days
              </span>
            )}
          </div>
          <h1 id="perps-title" className="t-headline mt-1.5 text-ink">
            {title}
          </h1>
          {v && (
            <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ['Open interest', usd(v.openInterest)],
                ['Median funding, yearly', v.fundingMedianApr != null ? pct(v.fundingMedianApr, 1) : '—'],
                ['Taker flow, 24h', v.takerAll != null ? `${signedPct(v.takerAll)} net buy` : '—'],
                mode === 'public'
                  ? ['Coins scored', String(b.coins.filter((c) => c.ppi != null).length)]
                  : ['Smart money book', v.smSkew != null ? `${signedPct(v.smSkew, 0)} long skew` : '—'],
              ].map(([k, val]) => (
                <div key={k} className="inset-well min-w-0 rounded-[18px] px-4 py-3">
                  <dt className="text-[12.5px] font-medium text-ink-muted">{k}</dt>
                  <dd className="num mt-1 truncate text-[19px] font-extrabold tracking-[-0.02em] text-ink">{val}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-4 rounded-2xl border border-border/70 bg-raised/40 p-4 lg:w-[230px] lg:flex-col lg:text-center">
          {v?.ppi != null ? (
            <>
              <ScoreRing score={v.ppi} size={112} stroke={9} color={pressureColor(v.ppi)} label="Perp Flow Index" sublabel="0–100" />
              <div>
                <div className="text-[11px] uppercase tracking-wider text-ink-muted">Perp Flow Index</div>
                <div className="text-[15px] font-semibold text-ink">{bandText(v.ppi)}</div>
                <div className="text-[11.5px] text-ink-2">open-interest weighted</div>
              </div>
            </>
          ) : (
            <div className="py-6 text-[12.5px] text-ink-2">No venue reading yet.</div>
          )}
        </div>
      </div>
      <div className="relative mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/60 pt-3 text-[11.5px] text-ink-muted">
        {b.provenance && <InfoPopover p={b.provenance} />}
        <span>Built from Peregrine&apos;s hourly perp snapshots: this page makes no Nansen call until you open a coin.</span>
        <span className="ml-auto">Readings, not predictions · not financial advice</span>
      </div>
    </section>
  );
}

// ------------------------------------------------------------ pressure grid

function PressureGrid({ coins, onPick, picked }: { coins: PerpCoin[]; onPick: (c: PerpCoin) => void; picked: string | null }) {
  const tiles = coins.filter((c) => c.ppi != null).slice(0, 72);
  const peak = Math.max(1, ...tiles.map((c) => c.openInterest ?? 0));
  return (
    <div>
      <ul
        className="grid grid-cols-[repeat(auto-fill,minmax(76px,1fr))] gap-1.5 sm:grid-cols-[repeat(auto-fill,minmax(88px,1fr))]"
        aria-label={`${tiles.length} coins by Perp Flow Index, largest open interest first`}
      >
        {tiles.map((c) => (
          <li key={c.symbol}>
            <button
              onClick={() => onPick(c)}
              aria-pressed={picked === c.symbol}
              aria-label={`${c.symbol}: Perp Flow ${num(c.ppi, 0)}, funding ${c.fundingApr != null ? pct(c.fundingApr, 1) : 'unknown'} a year, ${usd(c.openInterest)} open interest`}
              className={`flex h-[62px] w-full flex-col justify-between overflow-hidden rounded-lg border px-2 py-1.5 text-left transition-transform hover:scale-[1.04] ${picked === c.symbol ? 'border-ink ring-1 ring-ink' : 'border-border/40'}`}
              style={{ background: pressureMix(c.ppi) }}
            >
              <Sym s={c.symbol} className="truncate text-[12px] font-semibold text-ink" />
              <span className="num flex items-baseline justify-between text-[11.5px] text-ink">
                <span>{num(c.ppi, 0)}</span>
                <span className="text-[10.5px] text-ink-2">{signedPct(c.change24h, 0)}</span>
              </span>
              <span aria-hidden className="h-[3px] w-full rounded-full bg-page/40">
                <span
                  className="block h-full rounded-full bg-ink/70"
                  style={{ width: `${Math.max(3, ((c.openInterest ?? 0) / peak) * 100)}%` }}
                />
              </span>
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-muted">
        <span className="inline-flex items-center gap-2">
          <span className="num">0</span>
          <span
            aria-hidden
            className="h-2 w-28 rounded-full"
            style={{ background: 'linear-gradient(90deg, var(--out-2), var(--surface-1) 50%, var(--in-2))' }}
          />
          <span className="num">100</span>
        </span>
        <span>red: short bias · green: long bias · number: Perp Flow Index · bar: open interest · select a coin</span>
      </div>
    </div>
  );
}

// ------------------------------------------------------------- crowding map

const CW = 760,
  CH = 380,
  CP = { l: 52, r: 18, t: 16, b: 40 };
const FMAX = 1,
  FK = 0.05;
const fsym = (f: number) => (Math.sign(f) * Math.log1p(Math.abs(Math.max(-FMAX, Math.min(FMAX, f))) / FK)) / Math.log1p(FMAX / FK);

function CrowdingMap({ coins, useSm, onPick }: { coins: PerpCoin[]; useSm: boolean; onPick: (c: PerpCoin) => void }) {
  const [hover, setHover] = useState<PerpCoin | null>(null);
  const yOf = (c: PerpCoin) => (useSm ? (c.sm?.skew ?? null) : c.taker);
  const pts = coins
    .filter((c) => c.ppi != null && c.fundingApr != null && yOf(c) != null && (c.openInterest ?? 0) >= 2_000_000)
    .slice(0, 120);
  const yMax = useSm ? 1 : Math.max(0.1, ...pts.map((c) => Math.abs(yOf(c)!)));
  const maxOi = Math.max(1, ...pts.map((c) => c.openInterest ?? 0));
  // Rounded: Node and the browser can differ in the last digit of log1p,
  // which would make the server-rendered SVG fail to hydrate.
  const q = (v: number) => Math.round(v * 100) / 100;
  const x = (f: number) => q(CP.l + ((fsym(f) + 1) / 2) * (CW - CP.l - CP.r));
  const y = (v: number) => q(CP.t + (1 - (v + yMax) / (2 * yMax)) * (CH - CP.t - CP.b));
  const r = (oi: number) => q(3 + Math.sqrt(oi / maxOi) * 18);
  // Direct labels for the largest coins and every divergence, skipped when
  // they would overlap one already placed.
  const labels = new Map<string, { x: number; y: number }>();
  {
    const placed: Array<{ x: number; y: number; w: number; h: number }> = [];
    const want = pts
      .filter((c) => c.divergence)
      .concat([...pts].sort((a, b) => (b.openInterest ?? 0) - (a.openInterest ?? 0)).slice(0, 10));
    for (const c of want) {
      if (labels.has(c.symbol)) continue;
      const name = c.symbol.replace(/^[^:]+:/, ''),
        w = name.length * 6.6 + 2;
      const cx = x(c.fundingApr!),
        cy = y(yOf(c)!),
        rr = r(c.openInterest ?? 0);
      const box = { x: cx + rr + 4, y: cy - 9, w, h: 13 };
      if (box.x + w > CW - CP.r || placed.some((o) => box.x < o.x + o.w && o.x < box.x + box.w && box.y < o.y + o.h && o.y < box.y + box.h))
        continue;
      placed.push(box);
      labels.set(c.symbol, { x: box.x, y: cy + 4 });
    }
  }
  if (!pts.length)
    return (
      <p className="text-sm text-ink-2">Not enough coins with funding and {useSm ? 'a smart-money book' : 'taker flow'} to plot yet.</p>
    );
  return (
    <div className="relative">
      <div tabIndex={0} role="region" aria-label="Perp coins" className="-mx-1 overflow-x-auto px-1">
        <svg
          viewBox={`0 0 ${CW} ${CH}`}
          className="h-auto w-full min-w-[600px]"
          role="img"
          aria-label={`Crowding map: ${pts.length} coins by yearly funding and ${useSm ? "smart money's long/short skew" : 'taker flow'}; ${pts.filter((c) => c.divergence).length} where the crowd and smart money disagree.`}
        >
          {[-0.5, 0, 0.5].map((t) => (
            <g key={t}>
              <line x1={CP.l} x2={CW - CP.r} y1={y(t * yMax)} y2={y(t * yMax)} stroke={t === 0 ? 'var(--axis)' : 'var(--grid)'} />
              <text x={CP.l - 8} y={y(t * yMax) + 4} textAnchor="end" className="fill-ink-muted text-[11px]">
                {t === 0 ? '0' : signedPct(t * yMax, 0)}
              </text>
            </g>
          ))}
          {[-0.5, -0.1, 0, 0.1, 0.5].map((t) => (
            <g key={t}>
              <line
                x1={x(t)}
                x2={x(t)}
                y1={CP.t}
                y2={CH - CP.b}
                stroke={t === 0 ? 'var(--axis)' : 'var(--grid)'}
                strokeDasharray={t === 0 ? undefined : '2 4'}
              />
              <text x={x(t)} y={CH - CP.b + 16} textAnchor="middle" className="fill-ink-muted text-[11px]">
                {t === 0 ? '0' : signedPct(t, 0)}
              </text>
            </g>
          ))}
          <text x={CW - CP.r} y={CH - 6} textAnchor="end" className="fill-ink-2 text-[11px]">
            longs pay more →
          </text>
          <text x={CP.l} y={CH - 6} className="fill-ink-2 text-[11px]">
            ← shorts pay
          </text>
          <text x={12} y={CP.t + 4} className="fill-ink-2 text-[11px]" transform={`rotate(-90 12 ${CP.t + 4})`} textAnchor="end">
            {useSm ? 'smart money net long ↑' : 'takers net buying ↑'}
          </text>
          {x(0.1095) > CP.l && (
            <text x={x(0.1095) + 4} y={CP.t + 10} className="fill-ink-muted text-[10px]">
              base rate 10.95%
            </text>
          )}
          {pts
            .sort((a, b) => (b.openInterest ?? 0) - (a.openInterest ?? 0))
            .map((c) => {
              const cx = x(c.fundingApr!),
                cy = y(yOf(c)!),
                rr = r(c.openInterest ?? 0);
              return (
                <g
                  key={c.symbol}
                  onPointerEnter={() => setHover(c)}
                  onPointerLeave={() => setHover(null)}
                  onClick={() => onPick(c)}
                  className="cursor-pointer"
                >
                  <circle
                    cx={cx}
                    cy={cy}
                    r={rr}
                    fill={pressureColor(c.ppi)}
                    fillOpacity={hover === c ? 0.95 : 0.6}
                    stroke="var(--surface-1)"
                    strokeWidth={1.5}
                  />
                  {c.divergence && (
                    <circle cx={cx} cy={cy} r={rr + 3} fill="none" stroke="var(--storm-2)" strokeWidth={1.5} strokeDasharray="3 2" />
                  )}
                  {labels.has(c.symbol) && (
                    <text
                      x={labels.get(c.symbol)!.x}
                      y={labels.get(c.symbol)!.y}
                      className="pointer-events-none fill-ink text-[11px] font-medium"
                    >
                      {c.symbol.replace(/^[^:]+:/, '')}
                    </text>
                  )}
                </g>
              );
            })}
        </svg>
      </div>
      {hover && (
        <div className="material-strong pointer-events-none absolute right-3 top-3 max-w-[240px] rounded-xl p-2.5 text-[12px]">
          <div className="font-medium text-ink">
            <Sym s={hover.symbol} /> · Perp flow {num(hover.ppi, 0)}
          </div>
          <div className="num text-ink-2">
            funding {pct(hover.fundingApr!, 1)} a year · OI {usd(hover.openInterest)}
          </div>
          <div className="num text-ink-2">
            {useSm ? `smart money ${signedPct(hover.sm?.skew ?? null, 0)} long skew` : `takers ${signedPct(hover.taker)} net buying`}
          </div>
          {hover.divergence && (
            <div className="text-ink">
              {hover.divergence === 'crowded-long'
                ? 'Crowd paying to be long; smart money net short'
                : 'Crowd paying to be short; smart money net long'}
            </div>
          )}
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-muted">
        <span>colour: Perp Flow Index (green long, red short) · size: open interest</span>
        {useSm && (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full border-[1.5px] border-dashed" style={{ borderColor: 'var(--storm-2)' }} />
            crowd and smart money disagree
          </span>
        )}
      </div>
    </div>
  );
}

// --------------------------------------------------------------- the view

export function PerpsView({ board, title, mode }: { board: PerpBoard; title: string; mode: 'owner' | 'member' | 'public' }) {
  const [picked, setPicked] = useState<string | null>(null);
  const [detail, setDetail] = useState<Load<CoinDetail>>({ state: 'idle' });
  const [leaders, setLeaders] = useState<Load<PerpLeaders>>({ state: mode === 'public' ? 'idle' : 'loading' });
  const priv = mode !== 'public';

  const pick = (c: PerpCoin) => {
    setPicked(c.symbol);
    setDetail({ state: 'loading' });
    post<CoinDetail>({ action: 'coin', symbol: c.symbol })
      .then((data) => setDetail({ state: 'ok', data }))
      .catch((e) => setDetail({ state: 'error', message: (e as Error).message }));
    requestAnimationFrame(() => document.getElementById('coin')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  useEffect(() => {
    if (!priv) return;
    post<PerpLeaders>({ action: 'leaders' })
      .then((data) => setLeaders({ state: 'ok', data }))
      .catch((e) => setLeaders({ state: 'error', message: (e as Error).message }));
  }, [priv]);

  // Deep link from the Overview: /perps?coin=BTC opens that coin's detail.
  useEffect(() => {
    const want = new URLSearchParams(window.location.search).get('coin');
    const coin = want ? board.coins.find((c) => c.symbol === want) : null;
    if (coin) {
      pick(coin);
      document.getElementById('coins')?.scrollIntoView({ block: 'start' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on arrival
  }, []);

  const pickedCoin = useMemo(() => board.coins.find((c) => c.symbol === picked) ?? null, [board.coins, picked]);
  const divergent = board.coins.filter((c) => c.divergence);
  const hot = [...board.coins].filter((c) => c.ppi != null && (c.openInterest ?? 0) >= 10_000_000).sort((a, b) => b.ppi! - a.ppi!);

  if (board.unavailable)
    return (
      <div className="space-y-4">
        <Hero b={board} title={title} mode={mode} />
        <Unavailable text={board.unavailable} />
      </div>
    );

  return (
    <div className="space-y-4">
      <Hero b={board} title={title} mode={mode} />

      <Card
        id="pressure"
        title={
          hot.length
            ? `Most long bias: ${hot
                .slice(0, 2)
                .map((c) => `${c.symbol.replace(/^[^:]+:/, '')} ${num(c.ppi, 0)}`)
                .join(', ')}; most short: ${hot
                .slice(-2)
                .reverse()
                .map((c) => `${c.symbol.replace(/^[^:]+:/, '')} ${num(c.ppi, 0)}`)
                .join(', ')}`
            : 'Perp flow by coin'
        }
        sub="Every Hyperliquid coin with $1M+ open interest, largest first, coloured by its Perp Flow Index."
        action={board.provenance ? <InfoPopover p={board.provenance} /> : undefined}
      >
        <PressureGrid coins={board.coins} onPick={pick} picked={picked} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card
          id="crowding"
          className="lg:col-span-2"
          title={
            priv
              ? divergent.length
                ? `${divergent.length} coin${divergent.length === 1 ? '' : 's'} where the crowd and smart money disagree: ${divergent
                    .slice(0, 3)
                    .map((c) => c.symbol.replace(/^[^:]+:/, ''))
                    .join(', ')}`
                : 'The crowd and smart money agree on every large coin'
              : 'Funding against taker flow'
          }
          sub={
            priv
              ? "Yearly funding (who pays to hold) against smart money's long/short skew. Dashed rings: funding in the top or bottom of its range while smart money leans the other way."
              : 'Yearly funding (who pays to hold) against 24h taker flow. Smart money’s book is shown to the key owner.'
          }
        >
          <CrowdingMap coins={board.coins} useSm={priv} onPick={pick} />
        </Card>
        <Card
          id="coins"
          title={`${board.coins.filter((c) => c.ppi != null).length} coins scored`}
          sub="Largest open interest first. Search, filter by bias, and select a row for its liquidation ladder and trades."
        >
          <FilterBox target="#perp-coins" label="Filter coins" placeholder="Search coins" groups={['Long bias', 'Neutral', 'Short bias']} />
          <div id="perp-coins" tabIndex={0} role="region" aria-label="Scrollable list" className="mt-3 max-h-[440px] overflow-auto">
            <table className="w-full text-left text-[12.5px]">
              <thead className="sticky top-0 bg-surface text-[11px] uppercase tracking-wider text-ink-muted">
                <tr>
                  <th className="py-2 font-normal">Coin</th>
                  <th className="font-normal">Perp flow</th>
                  <th className="font-normal">Funding</th>
                  <th className="text-right font-normal">OI</th>
                </tr>
              </thead>
              <tbody>
                {board.coins
                  .filter((c) => c.ppi != null)
                  .map((c) => (
                    <tr
                      key={c.symbol}
                      data-search={`${c.symbol} ${c.symbol.replace(/^[^:]+:/, '')}${c.divergence ? ' divergent' : ''}`}
                      data-group={c.ppi! >= 60 ? 'Long bias' : c.ppi! <= 40 ? 'Short bias' : 'Neutral'}
                      onClick={() => pick(c)}
                      className={`cursor-pointer border-t border-border hover:bg-raised/60 ${picked === c.symbol ? 'bg-raised' : ''}`}
                    >
                      <td className="py-1.5">
                        <Sym s={c.symbol} className="text-ink" />
                        {c.divergence && <span className="ml-1 text-[10px] text-ink-2">⚑</span>}
                      </td>
                      <td>
                        <span
                          className="num inline-block min-w-[2.2rem] rounded px-1 text-center text-ink"
                          style={{ background: pressureMix(c.ppi) }}
                        >
                          {num(c.ppi, 0)}
                        </span>
                      </td>
                      <td className="num text-ink-2">{c.fundingApr != null ? pct(c.fundingApr, 1) : '—'}</td>
                      <td className="num text-right text-ink">{usd(c.openInterest)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {pickedCoin && (
        <section id="coin" className="space-y-4" aria-label={`${pickedCoin.symbol} detail`}>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card
              id="coin-ladder"
              className="lg:col-span-2"
              title={
                detail.state === 'ok' && !('unavailable' in detail.data.ladder)
                  ? leverageTitle(detail.data.ladder)
                  : `${pickedCoin.symbol} liquidation ladder`
              }
              sub="Where the 100 largest open positions in this coin are forced out, by distance from the mark."
              action={
                detail.state === 'ok' && !('unavailable' in detail.data.ladder) ? (
                  <InfoPopover p={detail.data.ladder.provenance} />
                ) : undefined
              }
            >
              {detail.state === 'ok' ? (
                'unavailable' in detail.data.ladder ? (
                  <Unavailable text={detail.data.ladder.unavailable} />
                ) : (
                  <LiquidationLadder w={detail.data.ladder} />
                )
              ) : detail.state === 'error' ? (
                <Unavailable text={detail.message} />
              ) : (
                <WaveLoading what={`${pickedCoin.symbol} positions`} height={360} />
              )}
            </Card>
            <Card
              id="coin-read"
              title={`${pickedCoin.symbol.replace(/^[^:]+:/, '')}: ${bandText(pickedCoin.ppi ?? 50).toLowerCase()} (${num(pickedCoin.ppi, 0)})`}
              sub="What moved the index, as z-scores against this coin's own history or its peers."
            >
              <dl className="space-y-2 text-[12.5px]">
                {(
                  [
                    ['taker', 'Taker flow', pickedCoin.taker != null ? `${signedPct(pickedCoin.taker)} net buy` : '—'],
                    ['funding', 'Funding', pickedCoin.fundingApr != null ? `${pct(pickedCoin.fundingApr, 1)} a year` : '—'],
                    ['sm', 'Smart money skew', pickedCoin.sm?.skew != null ? `${signedPct(pickedCoin.sm.skew, 0)} long` : '—'],
                  ] as const
                ).map(([k, label, val]) => {
                  const part = pickedCoin.parts[k];
                  return (
                    <div key={k} className="grid grid-cols-[1fr_auto_auto] items-center gap-2">
                      <dt className="text-ink-2">{label}</dt>
                      <dd className="num text-ink">{val}</dd>
                      <dd className="num w-16 text-right text-ink-muted">
                        {part ? `z ${part.z >= 0 ? '+' : ''}${part.z.toFixed(1)}` : 'not used'}
                      </dd>
                    </div>
                  );
                })}
              </dl>
              <div className="mt-3 border-t border-border pt-2 text-[12px] text-ink-2">
                <div className="num">
                  Price {pickedCoin.markPrice != null ? usd(pickedCoin.markPrice) : '—'} · {signedPct(pickedCoin.change24h)} 24h
                </div>
                <div className="num">
                  Volume {usd(pickedCoin.volume)} · {pickedCoin.traders?.toLocaleString('en-US') ?? '—'} traders
                </div>
                {pickedCoin.sm && (
                  <div className="num">
                    Smart money {usd(pickedCoin.sm.longsUsd)} long · {usd(pickedCoin.sm.shortsUsd)} short
                  </div>
                )}
                <div className="mt-1 text-ink-muted">
                  {pickedCoin.usedCrossSectional
                    ? 'Compared with the other coins until it has 12 hourly readings.'
                    : "Compared with this coin's own last 7 days."}
                </div>
              </div>
            </Card>
          </div>
          <div className={`grid gap-4 ${priv ? 'lg:grid-cols-2' : ''}`}>
            <Card
              id="coin-tape"
              title={`${pickedCoin.symbol.replace(/^[^:]+:/, '')}: the day's largest perp trades`}
              sub="All traders, largest first."
              action={
                detail.state === 'ok' && !('unavailable' in detail.data.tape) ? <InfoPopover p={detail.data.tape.provenance} /> : undefined
              }
            >
              {detail.state === 'ok' ? (
                'unavailable' in detail.data.tape ? (
                  <Unavailable text={detail.data.tape.unavailable} />
                ) : (
                  <div tabIndex={0} role="region" aria-label="Scrollable list" className="max-h-[360px] overflow-auto">
                    <table className="w-full min-w-[440px] text-left text-[12.5px]">
                      <tbody>
                        {detail.data.tape.rows.map((t) => (
                          <tr key={t.tx + t.action + t.valueUsd} className="border-t border-border first:border-0">
                            <td className="num py-1.5 text-ink-muted">{ago(Date.parse(t.at))}</td>
                            <td className="max-w-[150px] truncate text-ink-2">{walletName(t.label, t.address)}</td>
                            <td className="text-ink">
                              <span
                                style={{ color: t.side === 'Long' ? 'var(--mint)' : t.side === 'Short' ? 'var(--flare)' : undefined }}
                                aria-hidden
                              >
                                ●
                              </span>{' '}
                              {t.action} {t.side?.toLowerCase()}
                            </td>
                            <td className="num text-right text-ink">{usd(t.valueUsd)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : detail.state === 'error' ? (
                <Unavailable text={detail.message} />
              ) : (
                <WaveLoading what="perp trades" height={240} />
              )}
            </Card>
            {priv && (
              <Card
                id="coin-pnl"
                title={`Who made money on ${pickedCoin.symbol.replace(/^[^:]+:/, '')} perps, 30 days`}
                sub="Nansen's perp PnL leaderboard for this coin."
                action={
                  detail.state === 'ok' && detail.data.pnl && !('unavailable' in detail.data.pnl) ? (
                    <InfoPopover p={detail.data.pnl.provenance} />
                  ) : undefined
                }
              >
                {detail.state === 'ok' ? (
                  !detail.data.pnl ? null : 'unavailable' in detail.data.pnl ? (
                    <Unavailable text={detail.data.pnl.unavailable} />
                  ) : (
                    <div tabIndex={0} role="region" aria-label="Scrollable list" className="max-h-[360px] overflow-auto">
                      <table className="w-full min-w-[440px] text-left text-[12.5px]">
                        <thead className="text-[11px] uppercase tracking-wider text-ink-muted">
                          <tr>
                            <th className="py-1.5 font-normal">Trader</th>
                            <th className="font-normal">PnL</th>
                            <th className="font-normal">ROI</th>
                            <th className="text-right font-normal">Position</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.data.pnl.rows.map((p) => (
                            <tr key={p.address} className="border-t border-border">
                              <td className="max-w-[160px] truncate py-1.5">
                                <Link href={`/wallet/${p.address}`} className="text-ink hover:underline">
                                  {walletName(p.label, p.address)}
                                </Link>
                              </td>
                              <td className="num text-ink">{usd(p.pnlUsd, { signed: true })}</td>
                              <td className="num text-ink-2">{p.roi != null ? pct(p.roi, 0) : '—'}</td>
                              <td className="num text-right text-ink-2">{usd(p.positionUsd)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                ) : detail.state === 'error' ? (
                  <Unavailable text={detail.message} />
                ) : (
                  <WaveLoading what="the coin's PnL leaders" height={240} />
                )}
              </Card>
            )}
          </div>
          {detail.state === 'ok' && (
            <p className="num text-[11.5px] text-ink-muted">
              This coin: {detail.data.tally.calls} Nansen calls, {detail.data.tally.credits} credits ({detail.data.tally.cached} from cache)
            </p>
          )}
        </section>
      )}

      <Card
        id="leaders"
        title={
          leaders.state === 'ok' && leaders.data.rows[0]
            ? `Top copy-trade candidate scores ${leaders.data.rows[0].score}: ${usd(leaders.data.rows[0].pnl30, { signed: true })} in 30 days`
            : 'Hyperliquid traders'
        }
        sub="Nansen's 100 most profitable Hyperliquid traders over 30 days, re-ranked by how copyable the record looks: return, consistency, banked profit, leverage and open losses. A candidate score, not a recommendation."
        action={leaders.state === 'ok' ? <InfoPopover p={leaders.data.provenance} /> : undefined}
      >
        {!priv ? (
          <Unavailable text="Shown to the API key owner or a signed-in member with their own key: Nansen does not allow its perp leaderboard in public views." />
        ) : leaders.state === 'ok' ? (
          <div tabIndex={0} role="region" aria-label="Scrollable list" className="max-h-[560px] overflow-auto">
            <table className="w-full min-w-[760px] text-left text-[12.5px]">
              <thead className="sticky top-0 bg-surface text-[11px] uppercase tracking-wider text-ink-muted">
                <tr>
                  <th className="py-2 font-normal">Score</th>
                  <th className="font-normal">Trader</th>
                  <th className="font-normal">PnL 30d</th>
                  <th className="font-normal">ROI</th>
                  <th className="font-normal">PnL 7d</th>
                  <th className="font-normal">Account</th>
                  <th className="font-normal">Open positions</th>
                  <th className="font-normal">Why</th>
                </tr>
              </thead>
              <tbody>
                {leaders.data.rows.slice(0, 50).map((l) => (
                  <tr key={l.address} className="border-t border-border align-middle">
                    <td className="py-1.5">
                      <ScoreRing
                        score={l.score}
                        size={34}
                        stroke={3.5}
                        color={l.score >= 65 ? 'var(--brand)' : l.score <= 35 ? 'var(--storm-2)' : 'var(--ink-2)'}
                        label="Copy-trade candidate score"
                      />
                    </td>
                    <td className="max-w-[160px] truncate">
                      <Link href={`/wallet/${l.address}`} className="text-ink hover:underline">
                        {walletName(l.label, l.address)}
                      </Link>
                    </td>
                    <td className="num text-ink">{usd(l.pnl30, { signed: true })}</td>
                    <td className="num text-ink-2">{l.roi30 != null ? pct(l.roi30, 0) : '—'}</td>
                    <td className="num text-ink-2">{l.pnl7 != null ? usd(l.pnl7, { signed: true }) : '—'}</td>
                    <td className="num text-ink-2">{usd(l.accountValue)}</td>
                    <td className="text-ink-2">
                      {l.positions
                        .slice(0, 3)
                        .map((p) => `${p.side === 'long' ? '▲' : '▼'} ${p.coin.replace(/^[^:]+:/, '')}`)
                        .join('  ') || '—'}
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {l.parts.slice(0, 3).map((p) => (
                          <span key={p.id} title={p.detail} className="rounded border border-border px-1.5 text-[10.5px] text-ink-2">
                            {p.points > 0 ? '+' : ''}
                            {p.points} {p.label}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : leaders.state === 'error' ? (
          <Unavailable text={leaders.message} />
        ) : (
          <WaveLoading what="the Hyperliquid leaderboard" height={320} />
        )}
      </Card>
      <p className="text-[11.5px] text-ink-muted">
        Perp flow and copy-trade scores are readings of positioning, not predictions, and have no track record until the M9 backtest.
        Peregrine never places or signs a trade. Not financial advice.
      </p>
    </div>
  );
}
