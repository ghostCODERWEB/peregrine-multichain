'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Card, WaveLoading, Unavailable } from '@/components/Card';
import { InfoPopover } from '@/components/InfoPopover';
import { ScoreRing } from '@/components/viz/ScoreRing';
import { usd, num, ago, shortAddress } from '@/lib/viz/format';
import { heatLabel, impliedPct, categoryHeat, isMover } from '@/lib/models/predict';
import type { PredictBoard, PmMarket, PmDetail, PmRecords } from '@/server/predict/board';

type Load<T> = { state: 'idle' } | { state: 'loading' } | { state: 'error'; message: string } | { state: 'ok'; data: T };

async function post<T>(body: object): Promise<T> {
  const r = await fetch('/api/predict', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({ error: 'The server sent an unreadable answer.' }));
  if (!r.ok) throw new Error(j.error ?? `Request failed (${r.status}).`);
  return j as T;
}

const heatColor = (w: number | null) => (w == null ? 'var(--surface-2)' : w >= 50 ? 'var(--in-2)' : 'var(--out-2)');
const heatMix = (w: number | null) => (w == null ? 'var(--surface-1)' : `color-mix(in oklab, ${heatColor(w)} ${Math.round(8 + Math.sqrt(Math.min(1, Math.abs(w - 50) / 50)) * 60)}%, var(--surface-1))`);
const pts = (v: number | null) => (v == null ? '—' : `${v >= 0 ? '+' : '−'}${Math.round(Math.abs(v) * 100)} pts`);
const ends = (d: string | null) => {
  if (!d) return '—';
  const days = Math.round((Date.parse(d.endsWith('Z') ? d : `${d}Z`) - Date.now()) / 86_400_000);
  return days < 0 ? 'ended' : days === 0 ? 'today' : `${days}d`;
};

// ---------------------------------------------------------------- charts

function ProbLine({ d }: { d: PmDetail }) {
  const c = d.candles;
  if (c.length < 2) return <p className="text-[12.5px] text-ink-2">Nansen has fewer than two hourly YES candles for this market in the last 7 days.</p>;
  const W = 640, H = 200, P = { l: 40, r: 10, t: 10, b: 24 };
  const x = (i: number) => P.l + (i / (c.length - 1)) * (W - P.l - P.r);
  const y = (p: number) => P.t + (1 - p) * (H - P.t - P.b);
  const line = c.map((k, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(k.close).toFixed(1)}`).join('');
  const maxV = Math.max(1, ...c.map((k) => k.volume));
  const last = c.at(-1)!;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`YES implied probability over ${c.length} hours: from ${impliedPct(c[0].close)} to ${impliedPct(last.close)}`}>
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <g key={t}>
          <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke="var(--grid)" />
          <text x={P.l - 6} y={y(t) + 4} textAnchor="end" className="fill-ink-muted text-[10.5px]">{t * 100}%</text>
        </g>
      ))}
      {c.map((k, i) => <rect key={i} x={x(i) - 1} width={2} y={H - P.b - (k.volume / maxV) * 30} height={(k.volume / maxV) * 30} fill="var(--axis)" />)}
      <path d={`${line}L${x(c.length - 1)},${y(0)}L${x(0)},${y(0)}Z`} fill="var(--brand)" opacity={0.08} />
      <path d={line} fill="none" stroke="var(--brand)" strokeWidth={2} strokeLinejoin="round" />
      <circle cx={x(c.length - 1)} cy={y(last.close)} r={3.5} fill="var(--brand)" />
      <text x={W - P.r} y={H - 6} textAnchor="end" className="fill-ink-muted text-[10.5px]">last 7 days · bars: hourly volume</text>
    </svg>
  );
}

function Depth({ book }: { book: NonNullable<PmDetail['book']> }) {
  const W = 640, H = 170, P = { l: 40, r: 10, t: 10, b: 24 };
  const cum = (xs: Array<{ price: number; size: number }>) => { let s = 0; return xs.map((l) => ({ price: l.price, c: (s += l.size * l.price) })); };
  const bids = cum(book.bids), asks = cum(book.asks);
  const maxC = Math.max(1, bids.at(-1)?.c ?? 0, asks.at(-1)?.c ?? 0);
  const x = (p: number) => P.l + p * (W - P.l - P.r);
  const y = (c: number) => H - P.b - (c / maxC) * (H - P.t - P.b);
  const step = (xs: Array<{ price: number; c: number }>) => xs.map((l, i) => `${i ? 'L' : 'M'}${x(l.price).toFixed(1)},${y(l.c).toFixed(1)}`).join('');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Order book for YES: ${usd(bids.at(-1)?.c ?? 0)} of bids, ${usd(asks.at(-1)?.c ?? 0)} of asks`}>
      {[0, 0.25, 0.5, 0.75, 1].map((t) => <text key={t} x={x(t)} y={H - 6} textAnchor="middle" className="fill-ink-muted text-[10.5px]">{t * 100}%</text>)}
      <line x1={P.l} x2={W - P.r} y1={y(0)} y2={y(0)} stroke="var(--axis)" />
      {bids.length > 0 && <path d={step(bids)} fill="none" stroke="var(--in-2)" strokeWidth={2} />}
      {asks.length > 0 && <path d={step(asks)} fill="none" stroke="var(--out-2)" strokeWidth={2} />}
      <text x={P.l} y={P.t + 10} className="fill-ink-muted text-[10.5px]">cumulative USD · amber bids · blue asks</text>
    </svg>
  );
}

// ----------------------------------------------------------------- view

export function PredictView({ board, title }: { board: PredictBoard; title: string }) {
  const [picked, setPicked] = useState<PmMarket | null>(null);
  const [detail, setDetail] = useState<Load<PmDetail>>({ state: 'idle' });
  const [records, setRecords] = useState<Load<PmRecords>>({ state: 'idle' });
  const pick = (m: PmMarket) => {
    setPicked(m); setRecords({ state: 'idle' }); setDetail({ state: 'loading' });
    post<PmDetail>({ action: 'market', id: m.id }).then((data) => setDetail({ state: 'ok', data })).catch((e) => setDetail({ state: 'error', message: (e as Error).message }));
    requestAnimationFrame(() => document.getElementById('market')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  const checkRecords = () => {
    if (!picked) return;
    setRecords({ state: 'loading' });
    post<PmRecords>({ action: 'records', id: picked.id, price: picked.price }).then((data) => setRecords({ state: 'ok', data })).catch((e) => setRecords({ state: 'error', message: (e as Error).message }));
  };

  if (board.unavailable) return <Unavailable text={board.unavailable} />;
  const t = board.totals;
  const overall = categoryHeat({ volume24h: t.volume24h, volume1w: board.categories.reduce((a, c) => a + (c.volume1w ?? 0), 0), openInterest: t.openInterest });
  const movers = board.markets.filter((m) => isMover(m, board.asOf)).sort((a, z) => Math.abs(z.change1d!) - Math.abs(a.change1d!)).slice(0, 12);
  const peakMove = Math.max(0.01, ...movers.map((m) => Math.abs(m.change1d!)));
  const cats = board.categories.filter((c) => (c.volume24h ?? 0) >= 10_000).slice(0, 24);

  return (
    <div className="space-y-4">
      <section aria-labelledby="pm-title" className="glass rise relative overflow-hidden rounded-2xl p-4 sm:p-6">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full opacity-30 blur-3xl" style={{ background: 'var(--brand-2)' }} />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-[12px] text-ink-2">
              <span className="rounded-full border border-border px-2 py-0.5">Polymarket via Nansen</span>
              <span className="num text-ink-muted">This view: {board.tally.calls} Nansen calls, {board.tally.credits} credits ({board.tally.cached} from cache)</span>
            </div>
            <h1 id="pm-title" className="mt-1.5 text-lg font-semibold leading-snug text-ink sm:text-xl">{title}</h1>
            <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[['Open interest', usd(t.openInterest)], ['24h volume', usd(t.volume24h)], ['Active markets', t.activeMarkets.toLocaleString('en-US')], ['Traders, 24h', t.traders24h.toLocaleString('en-US')]].map(([k, v]) => (
                <div key={k} className="rounded-xl border border-border/70 bg-raised/50 px-3 py-2">
                  <dt className="text-[10.5px] uppercase tracking-wider text-ink-muted">{k}</dt>
                  <dd className="num mt-0.5 text-[14px] text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="flex shrink-0 items-center gap-4 rounded-2xl border border-border/70 bg-raised/40 p-4 lg:w-[230px] lg:flex-col lg:text-center">
            {overall.weather != null ? (
              <>
                <ScoreRing score={overall.weather} size={112} stroke={9} color={heatColor(overall.weather)} label="Prediction weather" sublabel="heat" />
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-ink-muted">Prediction weather</div>
                  <div className="text-[15px] font-semibold text-ink">{heatLabel(overall.weather)}</div>
                  <div className="num text-[11.5px] text-ink-2">{num(overall.heat, 2)}× the week&apos;s daily pace (categories summed)</div>
                </div>
              </>
            ) : <div className="py-6 text-[12.5px] text-ink-2">No weekly volume to compare with.</div>}
          </div>
        </div>
        <div className="relative mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/60 pt-3 text-[11.5px] text-ink-muted">
          <InfoPopover p={board.provenance} />
          <span>Prices are implied probabilities, not forecasts from TIDE · not financial advice</span>
        </div>
      </section>

      <Card id="weather" title={cats[0] ? `${cats.filter((c) => (c.weather ?? 0) >= 70).length} categories running hot, ${cats.filter((c) => c.weather != null && c.weather <= 30).length} quiet` : 'Category weather'}
        sub="Each category's 24h volume against its daily pace over the last week: amber is busier than usual, blue quieter. Hover for its busiest market.">
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2" aria-label="Prediction categories by heat">
          {cats.map((c) => (
            <li key={c.category} title={c.topQuestion ?? undefined} className="rounded-xl border border-border/40 p-2.5" style={{ background: heatMix(c.weather) }}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[13px] font-semibold text-ink">{c.category}</span>
                <span className="num text-[12px] text-ink">{c.heat != null ? `${num(c.heat, 1)}×` : '—'}</span>
              </div>
              <div className="num mt-1 text-[11.5px] text-ink-2">{usd(c.volume24h)} today · OI {usd(c.openInterest)}</div>
              <div className="mt-0.5 text-[11px] text-ink-muted">{c.weather != null ? heatLabel(c.weather) : '—'} · {(c.traders24h ?? 0).toLocaleString('en-US')} traders</div>
            </li>
          ))}
        </ul>
      </Card>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card id="repricing" className="lg:col-span-3" title={movers[0] ? `Biggest repricing today: ${movers[0].question.slice(0, 60)}${movers[0].question.length > 60 ? '…' : ''} ${pts(movers[0].change1d)}` : 'Repricing'}
          sub="Open questions whose YES price moved most in a day, in probability points: $50K+ traded today, priced between 3% and 97%, two or more days left (a settling market jumps because the outcome is known). Select one for its detail.">
          {movers.length ? (
            <ul className="space-y-1.5" aria-label="Markets by 1-day change in implied probability">
              {movers.map((m) => (
                <li key={m.id}>
                  <button onClick={() => pick(m)} className="grid w-full grid-cols-[1fr_120px_58px] items-center gap-2 rounded-md px-1 py-0.5 text-left text-[12.5px] hover:bg-raised">
                    <span className="truncate text-ink">{m.question}</span>
                    <span className="relative h-[14px]">
                      <span className="absolute inset-y-0 left-1/2 w-px bg-axis" />
                      <span className="absolute inset-y-[2px]" style={{ width: `${Math.max(2, (Math.abs(m.change1d!) / peakMove) * 50)}%`, [m.change1d! >= 0 ? 'left' : 'right']: '50%', background: m.change1d! >= 0 ? 'var(--in-2)' : 'var(--out-2)', borderRadius: m.change1d! >= 0 ? '0 4px 4px 0' : '4px 0 0 4px' }} />
                    </span>
                    <span className="num text-right text-ink">{impliedPct(m.price)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="text-[12.5px] text-ink-2">No market with $50K+ volume moved today.</p>}
          <p className="mt-2 text-[11px] text-ink-muted">Bar: 1-day change in YES price (amber up, blue down) · right: implied probability now</p>
        </Card>
        <Card id="events" className="lg:col-span-2" title={board.events[0] ? `Busiest event: ${board.events[0].title}` : 'Events'} sub="Events (groups of related markets) by 24h volume.">
          <ul className="space-y-1.5 text-[12.5px]">
            {board.events.slice(0, 10).map((e) => (
              <li key={e.id} className="flex items-baseline justify-between gap-2 border-t border-border pt-1.5 first:border-0 first:pt-0">
                <span className="min-w-0"><span className="block truncate text-ink">{e.title}</span><span className="text-ink-muted">{e.markets ?? '—'} markets · {(e.traders24h ?? 0).toLocaleString('en-US')} traders</span></span>
                <span className="num shrink-0 text-ink">{usd(e.volume24h)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {picked && (
        <section id="market" aria-label="Market detail" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card id="pm-price" className="lg:col-span-2" title={`${picked.question}: ${impliedPct(picked.price)} (${pts(picked.change1d)} today)`}
              sub={`${picked.eventTitle ?? ''}${picked.endDate ? ` · ends in ${ends(picked.endDate)}` : ''}. YES implied probability, hourly.`}
              action={detail.state === 'ok' ? <InfoPopover p={detail.data.provenance} /> : undefined}>
              {detail.state === 'ok' ? <ProbLine d={detail.data} /> : detail.state === 'error' ? <Unavailable text={detail.message} /> : <WaveLoading what="price history" height={200} />}
              {detail.state === 'ok' && detail.data.book && (detail.data.book.bids.length + detail.data.book.asks.length) > 0 && (
                <div className="mt-3 border-t border-border pt-2"><div className="mb-1 text-[12px] font-medium text-ink">Order book, YES</div><Depth book={detail.data.book} /></div>
              )}
            </Card>
            <Card id="pm-holders" title={detail.state === 'ok' && detail.data.balance.yesShare != null ? `The largest holders put ${impliedPct(detail.data.balance.yesShare)} of their value on YES; the market says ${impliedPct(picked.price)}` : 'Who holds each side'}
              sub="The 50 largest positions, valued at today's price, and how much of each side is in profit.">
              {detail.state === 'ok' ? (
                <div className="space-y-3 text-[12.5px]">
                  {detail.data.balance.yesShare != null ? (
                    <>
                      <div className="flex h-3 overflow-hidden rounded-full" role="img" aria-label={`YES ${usd(detail.data.balance.yesUsd)}, NO ${usd(detail.data.balance.noUsd)}`}>
                        <div style={{ width: `${detail.data.balance.yesShare * 100}%`, background: 'var(--in-2)' }} />
                        <div className="w-[2px] bg-page" />
                        <div className="flex-1" style={{ background: 'var(--out-2)' }} />
                      </div>
                      <div className="num flex justify-between text-ink-2"><span>YES {usd(detail.data.balance.yesUsd)}{detail.data.balance.yesInProfit != null ? ` · ${Math.round(detail.data.balance.yesInProfit * 100)}% in profit` : ''}</span><span>NO {usd(detail.data.balance.noUsd)}{detail.data.balance.noInProfit != null ? ` · ${Math.round(detail.data.balance.noInProfit * 100)}% in profit` : ''}</span></div>
                    </>
                  ) : <p className="text-ink-2">Nansen returned no holders for this market.</p>}
                  <div className="rounded-xl border border-border/70 bg-raised/50 p-3">
                    {records.state === 'ok' ? (
                      <>
                        <div className="flex items-center justify-between gap-2"><span className="text-[10.5px] uppercase tracking-wider text-ink-muted">Skilled money vs the price</span><InfoPopover p={records.data.provenance} /></div>
                        {records.data.divergence != null ? (
                          <div className="mt-1">
                            <div className="num text-lg font-semibold text-ink">{records.data.divergence >= 0 ? '+' : '−'}{Math.round(Math.abs(records.data.divergence) * 100)} pts</div>
                            <div className="text-ink-2">{records.data.skilled} holders with a winning record put {impliedPct(records.data.skilledYesShare)} on YES; the market says {impliedPct(picked.price)}.</div>
                          </div>
                        ) : <div className="mt-1 text-ink-2">{records.data.skilled} of the {records.data.records.length} largest holders have a winning record: too few to read a lean.</div>}
                        <div className="num mt-1 text-[11px] text-ink-muted">{records.data.tally.calls} calls, {records.data.tally.credits} credits · no track record yet</div>
                      </>
                    ) : records.state === 'loading' ? <WaveLoading what="holders' track records" height={80} />
                      : records.state === 'error' ? <Unavailable text={records.message} /> : (
                        <button onClick={checkRecords} className="w-full rounded-lg bg-brand/15 px-3 py-2 text-left text-[12.5px] text-ink ring-1 ring-brand/40 hover:bg-brand/25">
                          Check the 10 largest holders&apos; prediction records <span className="num text-ink-muted">(≈15 credits)</span>
                        </button>
                      )}
                  </div>
                </div>
              ) : detail.state === 'error' ? <Unavailable text={detail.message} /> : <WaveLoading what="holders" height={220} />}
            </Card>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card id="pm-trades" title="The day's largest trades" sub="The largest of the latest 100 trades: taker side, outcome, price and USDC value.">
              {detail.state === 'ok' ? (detail.data.trades.length ? (
                <div className="max-h-[320px] overflow-auto">
                  <table className="w-full min-w-[420px] text-left text-[12.5px]">
                    <tbody>{detail.data.trades.slice(0, 30).map((tr, i) => (
                      <tr key={i} className="border-t border-border first:border-0">
                        <td className="num py-1.5 text-ink-muted">{tr.at ? ago(Date.parse(tr.at.endsWith('Z') ? tr.at : `${tr.at}Z`)) : '—'}</td>
                        <td className="text-ink">{tr.action ?? '—'} <span style={{ color: /yes/i.test(tr.side ?? '') ? 'var(--in-2)' : 'var(--out-2)' }}>{tr.side}</span></td>
                        <td className="num text-ink-2">{impliedPct(tr.price)}</td>
                        <td className="num text-right text-ink">{usd(tr.usd)}</td>
                        <td className="text-right">{tr.buyer && <Link href={`/wallet/${tr.buyer}`} className="text-ink-muted hover:text-ink">{shortAddress(tr.buyer)}</Link>}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              ) : detail.data.errors.find((e) => e.startsWith('Trades')) ? <Unavailable text={detail.data.errors.find((e) => e.startsWith('Trades'))!} />
                : <p className="text-[12.5px] text-ink-2">No trades in this market in the last day.</p>) : detail.state === 'loading' ? <WaveLoading what="trades" height={200} /> : null}
            </Card>
            <Card id="pm-records" title={records.state === 'ok' ? `${records.data.skilled} of the largest holders have a winning record` : 'The largest holders’ records'} sub="Each large holder's own prediction-market record, and who is winning in this market.">
              {records.state === 'ok' ? (
                <div className="max-h-[320px] overflow-auto">
                  <table className="w-full min-w-[460px] text-left text-[12.5px]">
                    <thead className="text-[11px] uppercase tracking-wider text-ink-muted"><tr><th className="py-1.5 font-normal">Holder</th><th className="font-normal">Side</th><th className="font-normal">Value</th><th className="font-normal">Markets</th><th className="font-normal">Won</th><th className="text-right font-normal">PnL</th></tr></thead>
                    <tbody>{records.data.records.map((r) => (
                      <tr key={r.address} className="border-t border-border">
                        <td className="py-1.5"><Link href={`/wallet/${r.address}`} className="text-ink hover:underline">{shortAddress(r.address)}</Link>{r.skilled && <span className="ml-1.5 rounded-full bg-brand/15 px-1.5 text-[10.5px] text-ink">skilled</span>}</td>
                        <td style={{ color: /yes/i.test(r.side) ? 'var(--in-2)' : 'var(--out-2)' }}>{r.side}</td>
                        <td className="num text-ink">{usd(r.valueUsd)}</td>
                        <td className="num text-ink-2">{r.marketsTraded ?? '—'}</td>
                        <td className="num text-ink-2">{r.winRate != null ? `${Math.round(r.winRate * 100)}%` : '—'}</td>
                        <td className="num text-right text-ink">{usd(r.totalPnlUsd, { signed: true })}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              ) : <p className="text-[12.5px] text-ink-2">Run the records check above to see each large holder&apos;s record.</p>}
            </Card>
          </div>
        </section>
      )}

      <Card id="markets" title={`${board.markets.length} most-traded active markets`} sub="Implied probability (YES price), today's change, and depth. Select a market for its price, order book and holders.">
        <div className="max-h-[560px] overflow-auto">
          <table className="w-full min-w-[760px] text-left text-[12.5px]">
            <thead className="sticky top-0 bg-surface text-[11px] uppercase tracking-wider text-ink-muted">
              <tr><th className="py-2 font-normal">Market</th><th className="font-normal">Implied</th><th className="font-normal">Today</th><th className="font-normal">24h volume</th><th className="font-normal">Open interest</th><th className="font-normal">Traders</th><th className="text-right font-normal">Ends</th></tr>
            </thead>
            <tbody>{board.markets.slice(0, 100).map((m) => (
              <tr key={m.id} onClick={() => pick(m)} className={`cursor-pointer border-t border-border hover:bg-raised/60 ${picked?.id === m.id ? 'bg-raised' : ''}`}>
                <td className="max-w-[360px] truncate py-1.5 text-ink" title={m.question}>{m.question}</td>
                <td className="num text-ink">{impliedPct(m.price)}</td>
                <td className="num" style={{ color: m.change1d ? (m.change1d > 0 ? 'var(--in-2)' : 'var(--out-2)') : undefined }}>{pts(m.change1d)}</td>
                <td className="num text-ink">{usd(m.volume24h)}</td>
                <td className="num text-ink-2">{usd(m.openInterest)}</td>
                <td className="num text-ink-2">{m.traders24h ?? '—'}</td>
                <td className="num text-right text-ink-2" suppressHydrationWarning>{ends(m.endDate)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Card>
      <p className="text-[11.5px] text-ink-muted">Market prices are the crowd&apos;s implied probabilities. TIDE&apos;s readings on top of them (heat, skilled money vs price) have no track record until the M9 backtest. Not financial advice.</p>
    </div>
  );
}
