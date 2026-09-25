'use client';
import { CandleChart } from './CandleChart';
import { useState } from 'react';
import { ScoreRing } from '@/components/viz/ScoreRing';
import { InfoPopover } from '@/components/InfoPopover';
import { STORM_LABEL } from '@/lib/viz/scales';
import { TokenLogo, ChainLogo } from '@/components/Logo';
import { chainName, num, pct, shortAddress, usd, walletName } from '@/lib/viz/format';
import { WIND_SEGMENTS, WIND_TIMEFRAMES, type WindTimeframe } from '@/lib/wind';
import { SEGMENT_LABEL } from './WindRose';
import type { TokenHeader, MarketWave, WindWave } from '@/server/token/waves';
import type { StormWave } from '@/server/token/storm';
import type { LeverageWave } from '@/server/token/terminal';
import type { LadderBand } from '@/lib/models/liquidation';

export const STORM_RING: Record<StormWave['result']['band'], string> = {
  clear: 'var(--brand)', cloudy: 'var(--storm-1)', watch: 'var(--storm-2)', warning: 'var(--storm-3)',
};

// ------------------------------------------------------------------ hero

/** Price change over the last `hours`, from 4-hour candles. */
function change(m: MarketWave | null, hours: number): number | null {
  const c = m?.candles ?? [];
  const back = Math.round(hours / 4);
  if (c.length <= back) return null;
  const from = c[c.length - 1 - back].c, to = c[c.length - 1].c;
  return from > 0 ? to / from - 1 : null;
}

function Delta({ v, label }: { v: number | null; label: string }) {
  if (v == null) return null;
  const up = v >= 0;
  return (
    <span className={`num inline-flex items-center gap-1 rounded px-2 py-0.5 text-[12px] font-medium text-ink ${up ? 'bg-in-2/15' : 'bg-out-2/15'}`}>
      <span style={{ color: up ? 'var(--in-2)' : 'var(--out-2)' }} aria-hidden>{up ? '▲' : '▼'}</span>
      <span className="sr-only">{up ? 'up' : 'down'}</span>{pct(Math.abs(v), 1)} <span className="font-normal text-ink-muted">{label}</span>
    </span>
  );
}

/**
 * The token's headline: name, price and its trend, the market facts, the
 * buy/sell split of the day, and the Storm Score as a ring. Every number is
 * from Nansen; anything it did not return reads "—".
 */
export function TokenHero({ chain, address, tier, h, m, storm, done, title, children }: {
  chain: string; address: string; tier: string; title: string;
  h: TokenHeader | null; m: MarketWave | null; storm: StormWave | null;
  done?: { calls: number; credits: number; cached: number };
  children?: React.ReactNode;
}) {
  const price = m?.candles.at(-1)?.c ?? null;
  const buy = h?.buyVolumeUsd ?? null, sell = h?.sellVolumeUsd ?? null;
  const buyShare = buy != null && sell != null && buy + sell > 0 ? buy / (buy + sell) : null;
  const age = h?.deployedAt ? Math.max(0, Math.floor((Date.now() - Date.parse(h.deployedAt)) / 86_400_000)) : null;
  const initials = (h?.symbol ?? '?').replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase() || '?';
  return (
    <section aria-labelledby="token-title" className="rise relative">
      <div className="relative grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="material min-w-0 p-5 sm:p-7">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <TokenLogo symbol={h?.symbol ?? initials} logo={h?.logo} size={64} />
              <span className="absolute -bottom-1 -right-1 rounded-md bg-surface p-0.5 ring-1 ring-border"><ChainLogo chain={chain} size={16} /></span>
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-[12px] text-ink-2">
                <span className="rounded border border-border px-2 py-0.5">{chainName(chain)}</span>
                <span className="rounded border border-border px-2 py-0.5">Tier {tier}</span>
                {h?.marketCapGroup && <span className="rounded border border-border px-2 py-0.5">{h.marketCapGroup.replace(/_/g, ' ')}</span>}
                <span className="num text-ink-muted">{shortAddress(address)}</span>
              </div>
              <h1 id="token-title" className="mt-1 text-[30px] font-extrabold leading-snug text-ink" title={title}>{h?.name ?? h?.symbol ?? title}</h1>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-end gap-x-5 gap-y-3">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-ink-muted">{h?.symbol ?? 'Token'} price</div>
              <div className="num text-[48px] leading-tight tracking-[-.05em] font-extrabold text-ink sm:text-[72px]">{price != null ? (price < 1 ? `$${num(price, price < 0.01 ? 6 : 4)}` : usd(price)) : '—'}</div>
            </div>
            <div className="flex flex-wrap gap-1.5 pb-1.5"><Delta v={change(m, 24)} label="24h" /><Delta v={change(m, 24 * 7)} label="7d" /></div>
            
          </div>
          {m && <div className="mt-6"><CandleChart m={m}/></div>}

        </div>
        <div className="min-w-0 space-y-4">
          {children ?? (storm ? (
            <>
              <ScoreRing score={storm.result.score} size={112} stroke={9} color={STORM_RING[storm.result.band]} label="Dump Risk" sublabel="of 100" />
              <div>
                <div className="text-[11px] uppercase tracking-wider text-ink-muted">Dump Risk{storm.final ? '' : ' · provisional'}</div>
                <div className="text-[15px] font-semibold text-ink">{STORM_LABEL[storm.result.band]}</div>
                <div className="text-[11.5px] text-ink-2">{pct(storm.result.confidence, 0)} of the model&apos;s inputs present</div>
              </div>
            </>
          ) : (
            <div className="py-6 text-[12.5px] text-ink-2">Dump Risk lands once holders, flows and liquidity are in.</div>
          ))}
          <div className="material p-5"><h2 className="text-[19px] font-bold">DEX activity · 24h</h2><p className="mt-1 text-xs text-ink-muted">All traders, not only smart money.</p>          {buyShare != null && (
            <div className="mt-3">
              <div className="flex justify-between text-[11.5px] text-ink-2">
                <span>Bought {usd(buy)}{h?.uniqueBuyers != null ? ` · ${h.uniqueBuyers.toLocaleString('en-US')} buyers` : ''}</span>
                <span>Sold {usd(sell)}{h?.uniqueSellers != null ? ` · ${h.uniqueSellers.toLocaleString('en-US')} sellers` : ''}</span>
              </div>
              <div className="mt-3 flex h-3.5 overflow-hidden rounded-full" role="img" aria-label={`24h DEX volume: ${pct(buyShare, 0)} buys, ${pct(1 - buyShare, 0)} sells`}>
                <div style={{ width: `${buyShare * 100}%`, background: 'var(--in-2)' }} />
                <div className="w-[2px] bg-page" />
                <div className="flex-1" style={{ background: 'var(--out-2)' }} />
              </div>
            </div>
          )}
          {buyShare == null && <p className="mt-3 text-xs text-ink-muted">Buy/sell volume unavailable from Nansen.</p>}
          </div>
        </div>
      </div>
          <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
            {[
              ['Market cap', usd(h?.marketCapUsd)], ['FDV', usd(h?.fdvUsd)], ['Liquidity', usd(h?.liquidityUsd)],
              ['24h volume', usd(h?.volume24hUsd)], ['Holders', h?.holders?.toLocaleString('en-US') ?? '—'], ['Age', age != null ? `${age.toLocaleString('en-US')} days` : '—'],
            ].map(([k, v]) => (
              <div key={k} className="inset-well px-4 py-3">
                <dt className="text-[12.5px] text-ink-muted">{k}</dt>
                <dd className="num mt-0.5 text-[22px] font-extrabold text-ink">{v}</dd>
              </div>
            ))}
          </dl>
      <div className="relative mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/60 pt-3 text-[11.5px] text-ink-muted">
        {h?.deployedAt && <span>Deployed {h.deployedAt.slice(0, 10)}</span>}
        {done && <span className="num">This page: {done.calls} Nansen calls, {done.credits} credits ({done.cached} from cache)</span>}
        {h && <InfoPopover p={h.provenance} />}
        <span className="ml-auto">Probabilities, not predictions · not financial advice</span>
      </div>
    </section>
  );
}

// ----------------------------------------------------- liquidation ladder

const fmtPrice = (p: number) => (p < 1 ? `$${num(p, p < 0.01 ? 6 : 4)}` : usd(p));

export function leverageTitle(w: LeverageWave): string {
  const l = w.ladder, d = l.densest;
  if (!d || d.usd <= 0) return `${w.symbol} perp: ${usd(l.longUsd + l.shortUsd)} open in the top 100, none within 100% of the mark`;
  const side = d.side === 'long' ? 'longs' : 'shorts';
  // The band runs from its inner edge to its outer edge: name the price
  // where liquidations start (the inner edge), and the band's width.
  const start = l.mark * (1 + d.inner);
  const span = `${d.inner === 0 ? '0' : `${d.inner > 0 ? '+' : ''}${pct(d.inner, 0)}`} to ${d.outer > 0 ? '+' : ''}${pct(d.outer, 0)}`;
  return `${w.symbol.replace(/^[^:]+:/, '')} perp: ${usd(d.usd)} of ${side} liquidate ${d.side === 'long' ? 'below' : 'above'} ${fmtPrice(start)} (${span} from the mark)`;
}

/**
 * Where Hyperliquid positions in this symbol are forced out. Shorts
 * liquidate above the mark (forced buys, amber), longs below (forced
 * sells, blue); one USD scale for both, the densest band outlined.
 */
export function LiquidationLadder({ w }: { w: LeverageWave }) {
  const l = w.ladder;
  const shorts = l.bands.filter((b) => b.side === 'short').reverse();
  const longs = l.bands.filter((b) => b.side === 'long');
  const peak = Math.max(1, ...l.bands.map((b) => b.usd));
  const [hover, setHover] = useState<LadderBand | null>(null);
  const row = (b: LadderBand) => {
    const dense = l.densest === b && b.usd > 0;
    const col = b.side === 'long' ? 'var(--out-2)' : 'var(--in-2)';
    return (
      <li key={`${b.side}${b.outer}`} className={`grid grid-cols-[64px_1fr_76px] items-center gap-2 rounded-md px-1 py-[3px] ${dense ? 'ring-1 ring-ink-2/50' : ''} ${hover === b ? 'bg-raised' : ''}`}
        onPointerEnter={() => setHover(b)} onPointerLeave={() => setHover(null)}>
        <span className="num text-right text-[11.5px] text-ink-2">{b.outer > 0 ? '+' : ''}{pct(b.outer, 0)}</span>
        <span className="relative h-[20px] rounded bg-raised">
          <span className="absolute inset-y-0 left-0 rounded-[6px]" style={{ width: `${b.usd > 0 ? Math.max(1.5, (b.usd / peak) * 100) : 0}%`, background: `linear-gradient(90deg, color-mix(in srgb, ${col} 20%, transparent), ${col})`, opacity: dense ? 1 : 0.8 }} />
        </span>
        <span className="num text-right text-[11.5px] text-ink">{b.usd > 0 ? usd(b.usd) : <span className="text-ink-muted">—</span>}</span>
      </li>
    );
  };
  return (
    <div>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ['Open longs', usd(l.longUsd), 'var(--out-2)'], ['Open shorts', usd(l.shortUsd), 'var(--in-2)'],
          ['Within 10%', `${usd(l.near.longUsd)} · ${usd(l.near.shortUsd)}`, null], ['Avg leverage', l.avgLeverage != null ? `${num(l.avgLeverage, 1)}×` : '—', null],
        ].map(([k, v, c]) => (
          <div key={k} className="inset-well min-w-0 rounded-[18px] px-4 py-3">
            <dt className="flex items-center gap-1.5 text-[12.5px] font-medium text-ink-muted">{c && <span className="inline-block h-2 w-2 rounded-full" style={{ background: c }} />}{k}</dt>
            <dd className="num mt-1 truncate text-[19px] font-extrabold tracking-[-0.02em] text-ink">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_240px]">
        <div role="img" aria-label={`Liquidation ladder for ${w.symbol}: ${l.bands.filter((b) => b.usd > 0).map((b) => `${usd(b.usd)} of ${b.side}s at ${pct(b.outer, 0)}`).join('; ') || 'no liquidations within 100% of the mark'}`}>
          <div className="mb-1 flex justify-between text-[10.5px] uppercase tracking-wider text-ink-muted"><span>Shorts liquidate · forced buys</span><span>price ↑</span></div>
          <ul>{shorts.map(row)}</ul>
          <div className="my-1.5 flex items-center gap-2">
            <span className="h-px flex-1 bg-ink-2/60" />
            <span className="num rounded-full border border-brand/40 bg-brand/10 px-3 py-1 text-[12px] font-bold text-brand" style={{boxShadow:"0 0 14px color-mix(in srgb,var(--mint) 18%,transparent)"}}>Mark {fmtPrice(l.mark)}</span>
            <span className="h-px flex-1 bg-ink-2/60" />
          </div>
          <ul>{longs.map(row)}</ul>
          <div className="mt-1 flex justify-between text-[10.5px] uppercase tracking-wider text-ink-muted"><span>Longs liquidate · forced sells</span><span>price ↓</span></div>
        </div>
        <div className="space-y-2">
          <div className="rounded-xl border border-border/70 bg-raised/50 p-3 text-[12.5px]">
            {hover ? (
              <>
                <div className="text-[10.5px] uppercase tracking-wider text-ink-muted">{hover.side === 'long' ? 'Longs' : 'Shorts'} between {pct(hover.inner, 0)} and {pct(hover.outer, 0)}</div>
                <div className="num mt-1 text-lg font-semibold text-ink">{usd(hover.usd)}</div>
                <div className="text-ink-2">{hover.positions} position{hover.positions === 1 ? '' : 's'}; forced {hover.side === 'long' ? 'sells' : 'buys'} by {fmtPrice(hover.price)}</div>
              </>
            ) : l.densest && l.densest.usd > 0 ? (
              <>
                <div className="text-[10.5px] uppercase tracking-wider text-ink-muted">Densest band</div>
                <div className="num mt-1 text-lg font-semibold text-ink">{usd(l.densest.usd)}</div>
                <div className="text-ink-2">of {l.densest.side}s liquidate between {pct(l.densest.inner, 0)} and {pct(l.densest.outer, 0)} from the mark: a move there would force {l.densest.side === 'long' ? 'selling' : 'buying'}.</div>
              </>
            ) : <div className="text-ink-2">No liquidation prices within 100% of the mark among the top 100 positions.</div>}
          </div>
          <div className="rounded-xl border border-border/70 bg-raised/50 p-3">
            <div className="text-[10.5px] uppercase tracking-wider text-ink-muted">Largest positions</div>
            <ul className="mt-1 space-y-1 text-[12px]">
              {w.top.slice(0, 6).map((p) => (
                <li key={p.address + p.side} className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5"><span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: p.side === 'long' ? 'var(--out-2)' : 'var(--in-2)' }} /><span className="truncate text-ink-2">{walletName(p.label, p.address)}</span></span>
                  <span className="num shrink-0 text-ink">{usd(p.valueUsd)}{p.leverage != null ? <span className="text-ink-muted"> {num(p.leverage, 0)}×</span> : null}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------ cohort bars

/**
 * Net flow by wallet segment as diverging bars around zero, one window at
 * a time: amber is net buying, blue net selling. An exchange inflow means
 * tokens deposited to exchanges, which usually precedes selling.
 */
export function CohortBars({ w }: { w: WindWave }) {
  const [tf, setTf] = useState<WindTimeframe>('1d');
  const ring = w.rings[tf];
  const rows = WIND_SEGMENTS.map((s) => ({ s, v: ring[s].netUsd, n: ring[s].wallets }));
  const peak = Math.max(1, ...rows.map((r) => Math.abs(r.v ?? 0)));
  return (
    <div>
      <div className="flex gap-1" role="tablist" aria-label="Window">
        {WIND_TIMEFRAMES.map((t) => (
          <button key={t} role="tab" aria-selected={tf === t} onClick={() => setTf(t)}
            className={`num rounded px-2.5 py-0.5 text-[12px] ${tf === t ? 'bg-brand/15 text-ink ring-1 ring-brand/40' : 'text-ink-2 hover:text-ink'}`}>{t}</button>
        ))}
      </div>
      <ul className="mt-3 space-y-1.5" aria-label={`Net flow by segment, ${tf}`}>
        {rows.map(({ s, v, n }) => (
          <li key={s} className="grid grid-cols-[104px_1fr_78px] items-center gap-2 text-[12px]">
            <span className="truncate text-ink-2">{SEGMENT_LABEL[s]}</span>
            <span className="relative h-[16px]">
              <span className="absolute inset-y-0 left-1/2 w-px bg-axis" />
              {v != null && v !== 0 && (
                <span className="absolute inset-y-[2px]" style={{
                  width: `${Math.max(1, (Math.abs(v) / peak) * 50)}%`,
                  [v > 0 ? 'left' : 'right']: '50%',
                  background: v > 0 ? 'var(--in-2)' : 'var(--out-2)',
                  borderRadius: v > 0 ? '0 4px 4px 0' : '4px 0 0 4px',
                }} />
              )}
            </span>
            <span className="num text-right text-ink" title={n != null ? `${n} wallets` : undefined}>{v == null ? <span className="text-ink-muted">n/a</span> : usd(v, { signed: true })}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-ink-muted">Green: net buying · red: net selling. For exchanges, an inflow is tokens deposited, which often comes before selling.</p>
    </div>
  );
}
