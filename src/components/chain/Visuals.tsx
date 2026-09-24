'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ScoreRing } from '@/components/viz/ScoreRing';
import { InfoPopover } from '@/components/InfoPopover';
import { chainName, num, pct, usd } from '@/lib/viz/format';
import type { ChainPageData, GridTile, PeerRow } from '@/server/weather/chain-page';

const BAND_RING: Record<'high' | 'neutral' | 'low', string> = { high: 'var(--in-2)', neutral: 'var(--brand)', low: 'var(--out-2)' };
const BAND_TEXT: Record<'high' | 'neutral' | 'low', string> = { high: 'High pressure · net buying', neutral: 'Calm', low: 'Low pressure · net selling' };

type Metric = 'dexVolumeUsd' | 'activeAddresses' | 'txCount';
const METRICS: Array<[Metric, string, keyof PeerRow]> = [
  ['dexVolumeUsd', 'DEX volume', 'dexVolumeChange'],
  ['activeAddresses', 'Active addresses', 'activeAddressesChange'],
  ['txCount', 'Transactions', 'txChange'],
];
const IN_TEXT: Record<Metric, string> = { dexVolumeUsd: 'DEX volume', activeAddresses: 'active addresses', txCount: 'transactions' };

/** 1-based place of this chain on one metric; 0 when absent. */
function rankOf(rows: PeerRow[], m: Metric, chain: string): number {
  const i = [...rows].filter((r) => r[m] > 0).sort((a, b) => b[m] - a[m]).findIndex((r) => r.chain === chain);
  return i < 0 ? 0 : i + 1;
}

const compact = (v: number) => Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(v);
const fmt = (m: Metric, v: number) => (m === 'dexVolumeUsd' ? usd(v) : compact(v));

function Change({ v }: { v: number | null }) {
  if (v == null) return <span className="text-ink-muted">—</span>;
  return (
    <span className="num inline-flex items-center gap-0.5 text-ink">
      <span aria-hidden style={{ color: v >= 0 ? 'var(--in-2)' : 'var(--out-2)' }}>{v >= 0 ? '▲' : '▼'}</span>
      <span className="sr-only">{v >= 0 ? 'up' : 'down'}</span>{pct(Math.abs(v), 0)}
    </span>
  );
}

// ------------------------------------------------------------------ hero

/**
 * The chain's headline: pressure as a ring, where it ranks among every
 * chain Nansen ranks, and how its market moved today. All from the
 * scanner's history, one screener read and one chain-rank read.
 */
export function ChainHero({ d, tier, title, note }: { d: ChainPageData; tier: string; title: string; note: React.ReactNode }) {
  const w = d.weather;
  const self = d.peers.self;
  const rows = d.peers.rows as PeerRow[];
  const tiles = d.grid.tiles;
  const up = tiles.filter((t) => t.priceChange > 0).length;
  const median = tiles.length ? [...tiles].sort((a, b) => a.priceChange - b.priceChange)[Math.floor(tiles.length / 2)].priceChange : null;
  const initials = chainName(d.chain).replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase();
  return (
    <section aria-labelledby="chain-title" className="glass rise relative overflow-hidden rounded-2xl p-4 sm:p-6">
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[14px] font-bold text-on-brand" style={{ background: 'linear-gradient(135deg, var(--brand), var(--brand-2))' }}>{initials}</div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-[12px] text-ink-2">
                <span className="rounded border border-border px-2 py-0.5">Tier {tier}</span>
                {w.source && <span className="rounded border border-border px-2 py-0.5">{w.source === 'smart-money' ? 'Smart-money pressure' : 'All-trader pressure'}</span>}
                {METRICS.map(([m]) => {
                  const r = rankOf(rows, m, d.chain);
                  return r ? <span key={m} className="rounded bg-brand/12 px-2 py-0.5 text-ink">#{r} of {rows.filter((x) => x[m] > 0).length} by {IN_TEXT[m]}</span> : null;
                })}
              </div>
              <h1 id="chain-title" className="mt-1 text-lg font-semibold leading-snug text-ink sm:text-xl">{title}</h1>
            </div>
          </div>
          <p className="mt-2 text-[13px] text-ink-2">{note}</p>
          <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
            {[
              ['DEX volume, 7d', self ? usd(self.dexVolumeUsd) : '—', self?.dexVolumeChange ?? null],
              ['Active addresses, 7d', self ? compact(self.activeAddresses) : '—', self?.activeAddressesChange ?? null],
              ['Transactions, 7d', self ? compact(self.txCount) : '—', self?.txChange ?? null],
              ['Tokens up · down, 24h', tiles.length ? `${up} · ${tiles.length - up}` : '—', null],
              ['Median token, 24h', median != null ? `${median >= 0 ? '+' : ''}${pct(median, 1)}` : '—', null],
            ].map(([k, v, c]) => (
              <div key={k as string} className="rounded-xl border border-border/70 bg-raised/50 px-3 py-2">
                <dt className="text-[10.5px] uppercase tracking-wider text-ink-muted">{k}</dt>
                <dd className="mt-0.5 flex items-baseline justify-between gap-2 text-[14px]"><span className="num text-ink">{v}</span>{c != null && <span className="text-[11.5px]"><Change v={c as number} /></span>}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="flex shrink-0 items-center gap-4 rounded-2xl border border-border/70 bg-raised/40 p-4 lg:w-[230px] lg:flex-col lg:text-center">
          {w.cpi != null && w.band ? (
            <>
              <ScoreRing score={w.cpi} size={112} stroke={9} color={BAND_RING[w.band]} label="Chain Pressure Index" sublabel="CPI" />
              <div>
                <div className="text-[11px] uppercase tracking-wider text-ink-muted">Chain Pressure Index</div>
                <div className="text-[15px] font-semibold text-ink">{BAND_TEXT[w.band]}</div>
                {w.trend6h != null && <div className="num text-[11.5px] text-ink-2">{w.trend6h >= 0 ? '+' : ''}{num(w.trend6h, 1)} over 6 hours</div>}
              </div>
            </>
          ) : <div className="py-6 text-[12.5px] text-ink-2">No pressure reading for this chain yet.</div>}
        </div>
      </div>
      <div className="relative mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/60 pt-3 text-[11.5px] text-ink-muted">
        {w.updatedAt && <span>Pressure updated {new Date(w.updatedAt).toISOString().slice(11, 16)} UTC</span>}
        {d.peers.provenance && <InfoPopover p={d.peers.provenance} />}
        <span className="ml-auto">Probabilities, not predictions · not financial advice</span>
      </div>
    </section>
  );
}

// ------------------------------------------------------------ market grid

type ColorBy = 'change' | 'flow';
const PHONE_TILES = 36;

export function gridTitle(chain: string, tiles: GridTile[]): string {
  if (!tiles.length) return `${chainName(chain)} market`;
  const up = tiles.filter((t) => t.priceChange > 0).length;
  const best = tiles.reduce((a, b) => (b.priceChange > a.priceChange ? b : a));
  const share = up / tiles.length;
  const mood = share >= 0.6 ? 'mostly up' : share <= 0.4 ? 'mostly down' : 'split';
  const lead = best.priceChange > 0 ? `${best.symbol} leads at +${pct(best.priceChange, 0)}` : `even the best, ${best.symbol}, is ${pct(best.priceChange, 1)}`;
  return `${chainName(chain)} today is ${mood}: ${up} of ${tiles.length} most-traded tokens up; ${lead}`;
}

/**
 * The chain's market on one screen: every most-traded token is a tile, the
 * tile's colour is its 24h move (amber up, blue down) anchored to the
 * largest move on screen with a square-root ramp so the middle of the range
 * is still visible, and the bar under it is volume. Every tile is the same
 * size, so a large cap cannot hide the small ones.
 */
export function MarketGrid({ chain, tiles }: { chain: string; tiles: GridTile[] }) {
  const [by, setBy] = useState<ColorBy>('change');
  const [hover, setHover] = useState<GridTile | null>(null);
  // Phones show the 36 most-traded first; the rest on request.
  const [all, setAll] = useState(false);
  const value = (t: GridTile) => (by === 'change' ? t.priceChange : t.netFlowUsd != null && t.volumeUsd > 0 ? t.netFlowUsd / t.volumeUsd : null);
  // The ramp anchor: the largest move on screen, floored so a flat market
  // does not paint a small drift as a crash.
  const anchor = Math.max(by === 'change' ? 0.02 : 0.05, ...tiles.map((t) => Math.abs(value(t) ?? 0)));
  const peak = Math.max(1, ...tiles.map((t) => t.volumeUsd));
  const shown = hover ?? tiles[0];
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1" role="tablist" aria-label="Colour tiles by">
          {([['change', '24h price change'], ['flow', 'Net flow ÷ volume']] as const).map(([k, label]) => (
            <button key={k} role="tab" aria-selected={by === k} onClick={() => setBy(k)}
              className={`rounded px-2.5 py-0.5 text-[12px] ${by === k ? 'bg-brand/15 text-ink ring-1 ring-brand/40' : 'text-ink-2 hover:text-ink'}`}>{label}</button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2 text-[11px] text-ink-muted">
          <span className="num">−{pct(anchor, 0)}</span>
          <span aria-hidden className="h-2 w-28 rounded-full" style={{ background: 'linear-gradient(90deg, var(--out-2), var(--surface-1) 50%, var(--in-2))' }} />
          <span className="num">+{pct(anchor, 0)}</span>
        </div>
      </div>
      <ul className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(76px,1fr))] gap-1.5 sm:grid-cols-[repeat(auto-fill,minmax(86px,1fr))]" aria-label={`${tiles.length} ${chainName(chain)} tokens, most traded first`}>
        {tiles.map((t, i) => {
          const v = value(t);
          const k = v == null ? 0 : Math.min(1, Math.sqrt(Math.abs(v) / anchor));
          const col = v == null ? 'var(--surface-2)' : v >= 0 ? 'var(--in-2)' : 'var(--out-2)';
          return (
            <li key={t.address} className={i >= PHONE_TILES && !all ? 'hidden sm:block' : undefined}>
              <Link href={`/token/${chain}/${t.address}`} onPointerEnter={() => setHover(t)} onFocus={() => setHover(t)}
                className="group flex h-[60px] flex-col justify-between overflow-hidden rounded-lg border border-border/40 px-2 py-1.5 transition-transform hover:scale-[1.04] hover:border-ink-2/60 focus-visible:scale-[1.04]"
                style={{ background: `color-mix(in oklab, ${col} ${Math.round(8 + k * 62)}%, var(--surface-1))` }}
                aria-label={`${t.symbol}: ${t.priceChange >= 0 ? 'up' : 'down'} ${pct(Math.abs(t.priceChange), 1)} in 24h, ${usd(t.volumeUsd)} volume`}>
                <span className="flex items-baseline justify-between gap-1">
                  <span className="truncate text-[12px] font-semibold text-ink">{t.symbol}</span>
                </span>
                <span className="num text-[11.5px] text-ink">{v == null ? 'n/a' : `${v >= 0 ? '+' : '−'}${pct(Math.abs(v), Math.abs(v) < 0.1 ? 1 : 0)}`}</span>
                <span aria-hidden className="h-[3px] w-full rounded-full bg-page/40"><span className="block h-full rounded-full bg-ink/70" style={{ width: `${Math.max(3, (t.volumeUsd / peak) * 100)}%` }} /></span>
              </Link>
            </li>
          );
        })}
      </ul>
      {tiles.length > PHONE_TILES && !all && (
        <button onClick={() => setAll(true)} className="mt-2 w-full rounded-lg border border-border py-1.5 text-[12.5px] text-ink-2 hover:text-ink sm:hidden">Show all {tiles.length} tokens</button>
      )}
      {shown && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-border/70 bg-raised/50 px-3 py-2 text-[12px]">
          <span className="font-semibold text-ink">{shown.symbol}</span>
          <span className="text-ink-2">24h <span className="num text-ink">{shown.priceChange >= 0 ? '+' : '−'}{pct(Math.abs(shown.priceChange), 1)}</span></span>
          <span className="text-ink-2">volume <span className="num text-ink">{usd(shown.volumeUsd)}</span></span>
          <span className="text-ink-2">net flow <span className="num text-ink">{usd(shown.netFlowUsd, { signed: true })}</span></span>
          <span className="text-ink-2">liquidity <span className="num text-ink">{usd(shown.liquidityUsd)}</span></span>
          <span className="text-ink-2">market cap <span className="num text-ink">{usd(shown.marketCapUsd)}</span></span>
          <span className="ml-auto text-ink-muted">Bar: volume against {usd(peak)} · select a tile for the token</span>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------- chain rank

export function rankTitle(chain: string, rows: PeerRow[]): string {
  const ranks = METRICS.map(([m]) => ({ label: IN_TEXT[m], r: rankOf(rows, m, chain), n: rows.filter((x) => x[m] > 0).length })).filter((x) => x.r > 0);
  if (!ranks.length) return `${chainName(chain)} isn't in Nansen's chain rankings`;
  const best = ranks.sort((a, b) => a.r - b.r)[0];
  return `${chainName(chain)} ranks #${best.r} of ${best.n} chains by ${best.label} this week`;
}

/**
 * Where the chain stands against every chain Nansen ranks, one metric at a
 * time. Tabs are ordered by this chain's best placing (rank shown on
 * each); inside a metric the ranking is strictly by size.
 */
export function ChainRank({ chain, rows }: { chain: string; rows: PeerRow[] }) {
  const ordered = useMemo(() => METRICS.map(([m, label, ch]) => ({ m, label, ch, r: rankOf(rows, m, chain) })).sort((a, b) => (a.r || 99) - (b.r || 99)), [rows, chain]);
  const [metric, setMetric] = useState<Metric>(ordered[0]?.m ?? 'dexVolumeUsd');
  const def = METRICS.find(([m]) => m === metric)!;
  const ranked = [...rows].filter((r) => r[metric] > 0).sort((a, b) => b[metric] - a[metric]);
  const at = ranked.findIndex((r) => r.chain === chain);
  const top = ranked.slice(0, 12);
  const list = at >= 12 ? [...top, ranked[at]] : top;
  const peak = ranked[0]?.[metric] ?? 1;
  if (!rows.length) return <p className="text-sm text-ink-2">Nansen returned no chain rankings.</p>;
  return (
    <div>
      <div className="flex flex-wrap gap-1" role="tablist" aria-label="Rank by">
        {ordered.map(({ m, label, r }) => (
          <button key={m} role="tab" aria-selected={metric === m} onClick={() => setMetric(m)}
            className={`rounded px-2.5 py-0.5 text-[12px] ${metric === m ? 'bg-brand/15 text-ink ring-1 ring-brand/40' : 'text-ink-2 hover:text-ink'}`}>
            {label}{r > 0 && <span className="num ml-1 text-ink-muted">#{r}</span>}
          </button>
        ))}
      </div>
      <ol className="mt-3 space-y-1" aria-label={`Chains by ${def[1].toLowerCase()}, 7 days`}>
        {list.map((r, i) => {
          const me = r.chain === chain;
          const place = i < 12 ? i + 1 : at + 1;
          return (
            <li key={r.chain} className={`grid grid-cols-[26px_92px_1fr_70px_48px] items-center gap-2 rounded-md px-1 py-[3px] text-[12px] ${me ? 'bg-brand/12 ring-1 ring-brand/40' : ''} ${i === 12 ? 'mt-2 border-t border-dashed border-border pt-2' : ''}`}>
              <span className="num text-right text-ink-muted">{place}</span>
              <Link href={`/chain/${r.chain}`} className={`truncate ${me ? 'font-semibold text-ink' : 'text-ink-2 hover:text-ink'}`}>{chainName(r.chain)}</Link>
              <span className="relative h-[12px]">
                <span className="absolute inset-y-0 left-0 rounded-r-[4px]" style={{ width: `${Math.max(0.8, (r[metric] / peak) * 100)}%`, background: me ? 'var(--brand)' : 'var(--axis)' }} />
              </span>
              <span className="num text-right text-ink">{fmt(metric, r[metric])}</span>
              <span className="text-right text-[11px]"><Change v={r[def[2]] as number | null} /></span>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-[11px] text-ink-muted">Last 7 days against the 7 before, from Nansen chain rankings. Select a chain for its page.</p>
    </div>
  );
}
