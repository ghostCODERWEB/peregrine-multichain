'use client';
import { polymarketMarket } from '@/config/external';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AddressLink } from '@/components/entity/AddressLink';
import { DepthChart, ProbabilityChart } from '@/components/charts/IntelCharts';
import { ExplainView } from '@/components/ExplainView';
import { StatStrip } from '@/components/StatStrip';
import { Go } from '@/components/ui/Icons';
import { pct, usd } from '@/lib/viz/format';
import type { OutcomeBoard } from '@/lib/models/outcomes';
import type { PmDetail, PmMarket, PmRecords } from '@/server/predict/board';
import type { PmPosition } from '@/server/predict/trader';

const pts = (v: number | null | undefined) => (v == null ? 'n/a' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(Math.round(v * 100))} pts`);
const prob = (v: number | null | undefined) => (v == null ? 'n/a' : `${(v * 100).toFixed(v < 0.1 ? 1 : 0)}%`);

export function PredictMarketView({ market, detail, outcomes, owner, analytics }: { market: PmMarket | null; detail: PmDetail; outcomes: OutcomeBoard; owner: boolean; analytics?: React.ReactNode }) {
  const [rec, setRec] = useState<PmRecords | { error: string } | null>(null);
  const [, setBusy] = useState(false);
  const [pos, setPos] = useState<{ positions: PmPosition[]; tally: { credits: number } } | { error: string } | null>(null);
  const loadPositions = async () => {
    setPos({ positions: [], tally: { credits: 0 } });
    try {
      const r = await fetch('/api/predict', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'positions', id: detail.id }) });
      const d = await r.json(); setPos(r.ok ? d : { error: d.error });
    } catch { setPos({ error: 'Could not reach the server.' }); }
  };
  const last = detail.candles.at(-1)?.close ?? market?.price ?? null;
  const bal = detail.balance;
  const bestBid = detail.book?.bids[0]?.price ?? market?.bid ?? null, bestAsk = detail.book?.asks[0]?.price ?? market?.ask ?? null;
  const spread = bestBid != null && bestAsk != null ? bestAsk - bestBid : null;
  const depth = (xs: Array<{ price: number; size: number }>) => xs.slice(0, 12).reduce((a, x) => a + x.price * x.size, 0);
  const runRecords = async () => {
    setBusy(true);
    try {
      const r = await fetch('/api/predict', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'records', id: detail.id, price: last }) });
      const d = await r.json(); setRec(r.ok ? d : { error: d.error });
    } catch { setRec({ error: 'Could not reach the server.' }); } finally { setBusy(false); }
  };
  // Holder records and every position load with the page.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- once per market
  useEffect(() => { void runRecords(); void loadPositions(); }, [detail.id]);
  return (
    <div className="space-y-4">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[12.5px] text-ink-muted"><Link href="/predict" className="hover:text-ink">Predictions</Link><Go /><span className="truncate text-ink-2">{market?.eventTitle ?? 'Market'}</span></nav>
      <header className="hero-seq flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 max-w-[80ch]">
          <p className="text-[12px] text-ink-muted">Polymarket via Nansen{market?.endDate ? ` · ends ${market.endDate.slice(0, 10)}` : ''}{market?.tags.length ? ` · ${market.tags.slice(0, 3).join(', ')}` : ''}</p>
          <h1 className="t-headline mt-1 text-ink">{market?.question ?? `Market ${detail.id}`}</h1>
          {(market?.volumeTotal != null || market?.createdAt) && <p className="num mt-1 text-[12px] text-ink-muted">{market?.volumeTotal != null ? `${usd(market.volumeTotal)} traded all time` : ''}{market?.createdAt ? ` · opened ${market.createdAt.slice(0, 10)}` : ''}{market?.volumeChangePct != null ? ` · volume ${market.volumeChangePct >= 0 ? '+' : '−'}${Math.abs(Math.round(market.volumeChangePct))}% vs the prior period` : ''}</p>}
        </div>
        {market?.slug && (
          <a href={polymarketMarket(market.slug)} target="_blank" rel="noopener noreferrer" className="pill-button pill-primary shrink-0 text-[13px]">Trade on Polymarket <span aria-hidden>↗</span></a>
        )}
        <ExplainView view="prediction-market" context={{ question: market?.question, event: market?.eventTitle, impliedProbability: last, change24h: market?.change1d, volume24h: market?.volume24h, openInterest: market?.openInterest, holders: { yesUsd: bal.yesUsd, noUsd: bal.noUsd, yesInProfit: bal.yesInProfit, noInProfit: bal.noInProfit }, outcomes: outcomes.outcomes.slice(0, 10).map((o) => ({ outcome: o.question, probability: o.price, change24h: o.change1d })), skilledCheck: rec && !('error' in rec) ? { skilledHolders: rec.skilled, skilledYesShare: rec.skilledYesShare, divergence: rec.divergence } : null }} />
      </header>
      <StatStrip className="rise" stats={[
        { label: 'Implied probability', value: prob(last), note: market?.change1d != null ? `${pts(market.change1d)} in 24h` : undefined, tone: (market?.change1d ?? 0) >= 0 ? 'in' : 'out' },
        { label: 'Volume, 24h', value: usd(market?.volume24h), note: market?.volume1w != null ? `${usd(market.volume1w)} this week` : undefined },
        { label: 'Open interest', value: usd(market?.openInterest), note: market?.liquidity != null ? `liquidity ${usd(market.liquidity)}` : undefined },
        { label: 'Bid / ask', value: bestBid != null && bestAsk != null ? `${prob(bestBid)} / ${prob(bestAsk)}` : 'n/a', note: spread != null ? `spread ${pts(spread)}` : undefined },
        { label: 'Traders, 24h', value: market?.traders24h?.toLocaleString('en-US') ?? 'n/a' },
      ]} />
      {analytics}

      {outcomes.outcomes.length > 1 && (
        <section aria-labelledby="outcomes" className="material p-4 sm:p-5">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="outcomes" className="t-section">Outcomes in this event</h2>
            <p className="text-[12px] text-ink-muted">
              {outcomes.priced} priced outcomes among the most-traded markets
              {outcomes.roundGap != null ? ` · YES prices sum to ${prob(outcomes.sumYes)} (${outcomes.roundGap >= 0 ? '+' : '−'}${Math.abs(outcomes.roundGap * 100).toFixed(1)} pts from 100%)` : ''}
            </p>
          </div>
          <ol className="space-y-1">
            {outcomes.outcomes.map((o) => (
              <li key={o.id}>
                <Link href={`/predict/${encodeURIComponent(o.id)}`} aria-current={o.id === detail.id ? 'page' : undefined}
                  className={`grid grid-cols-[minmax(0,1fr)_minmax(120px,30%)_64px_72px_88px] items-center gap-3 rounded-[8px] px-2 py-1.5 text-[13px] hover:bg-ink/5 ${o.id === detail.id ? 'bg-ink/8' : ''}`}>
                  <span className="truncate text-ink">{o.question}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-ink/8"><span className="block h-full rounded-full bg-[var(--signal)]" style={{ width: `${Math.round((o.price ?? 0) * 100)}%` }} /></span>
                  <span className="num text-right font-semibold text-ink">{prob(o.price)}</span>
                  <span className="num text-right" style={{ color: (o.change1d ?? 0) >= 0 ? 'var(--mint)' : 'var(--flare)' }}>{pts(o.change1d)}</span>
                  <span className="num text-right text-ink-2">{usd(o.volume24h)}</span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        <section aria-labelledby="price" className="material min-w-0 p-4 sm:p-5 xl:col-span-2">
          <h2 id="price" className="t-section mb-2">Implied probability</h2>
          <ProbabilityChart candles={detail.candles} />
          <p className="mt-1 text-[11.5px] text-ink-muted">YES price and hourly volume · {detail.candles.length} hours · scroll or drag to zoom</p>
        </section>
        <section aria-labelledby="book" className="material min-w-0 p-4 sm:p-5">
          <h2 id="book" className="t-section mb-2">Order book</h2>
          {detail.book && <DepthChart bids={detail.book.bids} asks={detail.book.asks} />}
          {detail.book ? (
            <div className="grid grid-cols-2 gap-3 text-[12.5px]">
              {(['bids', 'asks'] as const).map((k) => (
                <div key={k}>
                  <p className="mb-1 text-[11.5px] font-semibold text-ink-muted">{k === 'bids' ? 'Bids (buy YES)' : 'Asks (sell YES)'} · {usd(depth(detail.book![k]))}</p>
                  <ol className="space-y-px">{detail.book![k].slice(0, 12).map((x, i) => (
                    <li key={i} className="num flex justify-between"><span style={{ color: k === 'bids' ? 'var(--mint)' : 'var(--flare)' }}>{prob(x.price)}</span><span className="text-ink-2">{usd(x.price * x.size)}</span></li>
                  ))}</ol>
                </div>
              ))}
            </div>
          ) : <p className="text-[13px] text-ink-muted">No order book returned.</p>}
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section aria-labelledby="holders" className="material min-w-0 p-4 sm:p-5">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="holders" className="t-section">Who holds each side</h2>
            <span className="text-[12px] text-ink-muted">largest holders Nansen returns</span>
          </div>
          {bal.yesShare != null && (
            <>
              <div className="flex h-3 overflow-hidden rounded-full"><span style={{ width: `${bal.yesShare * 100}%`, background: 'var(--mint)' }} /><span className="flex-1" style={{ background: 'var(--flare)' }} /></div>
              <p className="num mt-1.5 text-[12.5px] text-ink-2">YES {usd(bal.yesUsd)} ({pct(bal.yesShare, 0)}) · {pct(bal.yesInProfit, 0)} in profit · NO {usd(bal.noUsd)} · {pct(bal.noInProfit, 0)} in profit</p>
            </>
          )}
          <ol className="mt-3 max-h-[320px] divide-y divide-[var(--hair)] overflow-auto" tabIndex={0} aria-label="Top holders">
            {detail.holders.slice(0, 30).map((h, i) => (
              <li key={`${h.address}:${i}`} className="flex items-center gap-2 py-1.5 text-[12.5px]">
                <span className="w-9 font-semibold" style={{ color: /^yes$/i.test(h.side) || h.outcomeIndex === 1 ? 'var(--mint)' : 'var(--flare)' }}>{h.side}</span>
                <span className="min-w-0 flex-1"><AddressLink address={h.address} /></span>
                <span className="num text-ink-2">entry {prob(h.avgEntry)}</span>
                <span className="num w-20 text-right font-semibold text-ink">{usd(h.size * (h.currentPrice ?? 0))}</span>
                <span className="num w-20 text-right" style={{ color: (h.unrealizedUsd ?? 0) >= 0 ? 'var(--mint)' : 'var(--flare)' }}>{usd(h.unrealizedUsd, { signed: true })}</span>
              </li>
            ))}
          </ol>
        </section>
        <section aria-labelledby="skilled" className="material min-w-0 p-4 sm:p-5">
          <h2 id="skilled" className="t-section mb-1">Skilled holders vs the price</h2>
          <p className="text-[12.5px] text-ink-2">Reads the prediction-market record of the largest holders (Nansen address-summary). Skilled = 10+ markets traded, positive total PnL, 55%+ won. Compares where skilled value sits with the market price.</p>
          {!rec && <p className="mt-3 text-[12.5px] text-ink-muted">Reading the holders’ records…</p>}
          {rec && 'error' in rec && <p role="alert" className="mt-2 text-[12.5px] text-[var(--flare)]">{rec.error}</p>}
          {rec && !('error' in rec) && (
            <div className="mt-3 space-y-2 text-[12.5px]">
              <p className="text-ink">
                {rec.skilled} of {rec.records.length} largest holders have a winning record.
                {rec.skilledYesShare != null && <> Skilled value is <span className="font-semibold">{pct(rec.skilledYesShare, 0)} on YES</span> against a {prob(rec.price)} price{rec.divergence != null ? <> ({rec.divergence >= 0 ? '+' : '−'}{Math.abs(Math.round(rec.divergence * 100))} pts)</> : null}.</>}
              </p>
              <ol className="divide-y divide-[var(--hair)]">
                {rec.records.map((r, i) => (
                  <li key={`${r.address}:${r.side}:${i}`} className="flex items-center gap-2 py-1.5">
                    <span className="w-9 font-semibold" style={{ color: /^yes$/i.test(r.side) ? 'var(--mint)' : 'var(--flare)' }}>{r.side}</span>
                    <span className="min-w-0 flex-1"><AddressLink address={r.address} /></span>
                    {r.skilled && <span className="rounded bg-[color-mix(in_srgb,var(--signal)_16%,transparent)] px-1.5 text-[10.5px] font-bold text-[var(--signal)]">skilled</span>}
                    <span className="num text-ink-2">{r.marketsTraded ?? 'n/a'} mkts · {pct(r.winRate, 0)} won</span>
                    <span className="num w-20 text-right" style={{ color: (r.totalPnlUsd ?? 0) >= 0 ? 'var(--mint)' : 'var(--flare)' }}>{usd(r.totalPnlUsd, { signed: true })}</span>
                  </li>
                ))}
              </ol>
              <p className="text-[11px] text-ink-muted">Descriptive: a holder&apos;s past record does not decide this market.</p>
            </div>
          )}
        </section>
      </div>

      <section aria-labelledby="positions" className="material p-4 sm:p-5">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="positions" className="t-section">Positions with cost basis</h2>
        </div>
        {!pos && <p className="text-[12.5px] text-ink-2">Each holder&apos;s buy cost, sale proceeds, average entry, current value and PnL in this market (Nansen position-detail).</p>}
        {pos && 'error' in pos && <p role="alert" className="text-[12.5px] text-[var(--flare)]">{pos.error}</p>}
        {pos && !('error' in pos) && (pos.positions.length === 0 ? <p className="text-[12.5px] text-ink-muted">Reading…</p> : (
          <div tabIndex={0} role="region" aria-label="Positions" className="max-h-[420px] overflow-auto rounded-[10px] border border-[var(--hair)]">
            <table data-sortable className="w-full min-w-[760px] text-[12.5px]">
              <thead className="sticky top-0 bg-[var(--surface-1)] text-[11.5px] text-ink-muted"><tr>{['Holder', 'Outcome', 'Avg entry', 'Buy cost', 'Sold for', 'Value now', 'PnL'].map((h, i) => <th key={h} className={`px-3 py-2 font-semibold ${i > 1 ? 'text-right' : 'text-left'}`}>{h}</th>)}</tr></thead>
              <tbody>
                {pos.positions.map((p, i) => (
                  <tr key={`${p.owner}:${p.outcome}:${i}`} className="border-t border-[var(--hair)]">
                    <td className="px-3 py-1.5"><AddressLink address={p.owner} /></td>
                    <td className="px-3 font-semibold" style={{ color: /^yes$/i.test(p.outcome ?? '') ? 'var(--mint)' : 'var(--flare)' }}>{p.outcome ?? 'n/a'}</td>
                    <td className="num px-3 text-right text-ink-2">{prob(p.avgEntry)}</td>
                    <td className="num px-3 text-right text-ink-2">{usd(p.buyCostUsd)}</td>
                    <td className="num px-3 text-right text-ink-2">{usd(p.sellProceedsUsd)}</td>
                    <td className="num px-3 text-right text-ink">{usd(p.unrealizedUsd)}</td>
                    <td className="num px-3 text-right font-semibold" style={{ color: (p.pnlUsd ?? 0) >= 0 ? 'var(--mint)' : 'var(--flare)' }}>{usd(p.pnlUsd, { signed: true })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </section>

      <section aria-labelledby="trades" className="material p-4 sm:p-5">
        <h2 id="trades" className="t-section mb-2">Recent trades</h2>
        <ol className="max-h-[320px] divide-y divide-[var(--hair)] overflow-auto" tabIndex={0} aria-label="Recent trades">
          {detail.trades.slice(0, 60).map((t, i) => (
            <li key={i} className="flex items-center gap-3 py-1.5 text-[12.5px]">
              <span className="num w-[86px] shrink-0 text-ink-muted">{t.at.slice(5, 16).replace('T', ' ')}</span>
              <span className="w-24 shrink-0 font-semibold text-ink">{[t.action, t.side].filter(Boolean).join(' ')}</span>
              <span className="min-w-0 flex-1 truncate">{t.buyer && <AddressLink address={t.buyer} compact />}</span>
              <span className="num text-ink-2">{prob(t.price)}</span>
              <span className="num w-20 text-right font-semibold text-ink">{usd(t.usd)}</span>
            </li>
          ))}
          {!detail.trades.length && <li className="py-4 text-[13px] text-ink-muted">Nansen returned no recent trades for this market.</li>}
        </ol>
      </section>
      {detail.errors.length > 0 && <p className="text-[11.5px] text-ink-muted">Partial data: {detail.errors.join(' · ')}</p>}
      <p className="text-[11.5px] text-ink-muted">Prices are the crowd&apos;s implied probabilities.{owner ? '' : ' Holder labels are shown in the key owner’s view.'}</p>
    </div>
  );
}
