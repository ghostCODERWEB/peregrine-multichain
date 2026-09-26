'use client';
// The token terminal's sections (M2). Each takes its wave's data; the
// TokenView decides loading and unavailable states.
import Link from 'next/link';
import { useState } from 'react';
import { TimeAgo } from '@/components/TimeAgo';
import { TxDrawer, type TxRef } from './TxDrawer';
import { COHORT_NAMES } from '@/lib/models/terminal';
import type { TapeWave, RiverWave, SocialWave, DcaWave, PositionsWave, PnlBoardWave } from '@/server/token/terminal';
import type { NewsItem } from '@/server/token/ondemand';
import type { AuthorWeek } from '@/lib/models/author-week';
import { usd, pct, num, amount, walletName } from '@/lib/viz/format';
import { Go } from '@/components/ui/Icons';

const dot = (side: 'buy' | 'sell') => (
  <span
    className="inline-block h-2 w-2 shrink-0 rounded-full"
    style={{ background: side === 'buy' ? 'var(--in-3)' : 'var(--out-3)' }}
    aria-hidden
  />
);

// ------------------------------------------------------------ live tape

export const tapeTitle = (t: TapeWave) => {
  const net = t.buyUsd - t.sellUsd;
  return `${t.buyers} buyers vs ${t.sellers} sellers in the latest ${t.trades.length} trades: net ${usd(net, { signed: true })}`;
};

export function LiveTape({ t, chain }: { t: TapeWave; chain: string }) {
  const [open, setOpen] = useState<TxRef | null>(null);
  return (
    <>
      <div className="max-h-[380px] overflow-auto">
        <table className="w-full min-w-[520px] text-[12.5px]">
          <caption className="sr-only">Latest DEX trades; select a row for the transaction</caption>
          <thead className="sticky top-0 bg-surface">
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-ink-muted">
              <th className="py-1.5 font-normal">When</th>
              <th className="py-1.5 font-normal">Side</th>
              <th className="py-1.5 text-right font-normal">Amount</th>
              <th className="py-1.5 text-right font-normal">USD</th>
              <th className="py-1.5 pl-3 font-normal">Trader</th>
            </tr>
          </thead>
          <tbody>
            {t.trades.map((x, i) => (
              <tr
                key={`${x.hash}:${i}`}
                tabIndex={0}
                onClick={() => setOpen({ chain, hash: x.hash, at: x.at })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setOpen({ chain, hash: x.hash, at: x.at });
                }}
                className="cursor-pointer border-b border-border/50 hover:bg-accent/60 focus:bg-accent/60 focus:outline-none"
                aria-label={`${x.side} ${usd(x.valueUsd)}: open transaction`}
              >
                <td className="num py-1.5 text-ink-muted">
                  <TimeAgo ts={Date.parse(x.at)} />
                </td>
                <td className="py-1.5">
                  <span className="inline-flex items-center gap-1 text-ink-2">
                    {dot(x.side)}
                    {x.side === 'buy' ? 'Buy' : 'Sell'}
                  </span>
                </td>
                <td className="num py-1.5 text-right text-ink">
                  {amount(x.amount)}
                  {x.counter && <span className="text-ink-muted"> for {x.counter}</span>}
                </td>
                <td className="num py-1.5 text-right text-ink">{usd(x.valueUsd)}</td>
                <td className="py-1.5 pl-3">
                  <Link
                    href={`/wallet/${x.trader}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-ink-2 hover:text-ink hover:underline"
                  >
                    {walletName(x.label, x.trader)}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && <TxDrawer tx={open} onClose={() => setOpen(null)} />}
    </>
  );
}

// -------------------------------------------------------- transfer river

export const riverTitle = (r: RiverWave) =>
  r.anomalies.length
    ? `${r.anomalies.length} transfer${r.anomalies.length === 1 ? '' : 's'} today far larger than ${r.byCohort ? 'the sender’s cohort' : 'this token’s'} usual; the biggest ${usd(r.anomalies[0].valueUsd)}`
    : r.largest[0]
      ? `Largest transfer outside DEX trades today: ${usd(r.largest[0].valueUsd)}, none unusual ${r.byCohort ? 'for its sender' : 'for this token'}`
      : 'Whale transfers';

export function TransferRiver({ r, chain }: { r: RiverWave; chain: string }) {
  const [open, setOpen] = useState<TxRef | null>(null);
  // One scale for anomalies and the rest: anomalies can dwarf every other row.
  const max = Math.max(1, ...[...r.anomalies, ...r.largest].map((x) => x.valueUsd ?? 0));
  const row = (x: RiverWave['largest'][number], i: number) => (
    <li key={`${x.hash}:${i}`}>
      <button
        type="button"
        onClick={() => setOpen({ chain, hash: x.hash, at: x.at })}
        className="w-full rounded px-1 py-1 text-left hover:bg-accent/60 focus:bg-accent/60 focus:outline-none"
      >
        <span className="flex items-baseline justify-between gap-2 text-[12px]">
          <span className="min-w-0 truncate text-ink-2">
            {walletName(x.fromLabel, x.from)} <Go /> {walletName(x.toLabel, x.to)}
          </span>
          <span className="num shrink-0 text-ink">{usd(x.valueUsd)}</span>
        </span>
        <span className="mt-0.5 block h-1.5 rounded-full bg-accent" aria-hidden>
          <span
            className="block h-1.5 rounded-full"
            style={{
              width: `${Math.min(100, Math.max(2, Math.sqrt((x.valueUsd ?? 0) / max) * 100))}%`,
              background: x.anomalyZ != null ? 'var(--storm-3, var(--out-3))' : 'var(--ink-2)',
            }}
          />
        </span>
        {x.anomalyZ != null && (
          <span className="mt-0.5 block text-[11px] text-ink-muted">
            z {x.anomalyZ > 10 ? '> 10' : num(x.anomalyZ, 1)} · unusual{' '}
            {x.cohort ? `for ${COHORT_NAMES[x.cohort].toLowerCase()}` : 'for this token today'}
          </span>
        )}
      </button>
    </li>
  );
  return (
    <>
      {r.anomalies.length > 0 && (
        <>
          <div className="text-[11px] uppercase tracking-wider text-ink-muted">Anomalies</div>
          <ul className="mb-2 space-y-0.5">{r.anomalies.slice(0, 4).map(row)}</ul>
        </>
      )}
      <div className="text-[11px] uppercase tracking-wider text-ink-muted">
        {r.anomalies.length ? 'Other large transfers' : 'Largest today'}{' '}
        <span className="normal-case tracking-normal">(bar length ∝ √USD)</span>
      </div>
      <ul className="max-h-[300px] space-y-0.5 overflow-y-auto">{r.largest.map(row)}</ul>
      {open && <TxDrawer tx={open} onClose={() => setOpen(null)} />}
    </>
  );
}

// ---------------------------------------------------------- social pulse

export const socialTitle = (s: SocialWave) =>
  `Social heat ${num(s.heat.score, 0)}: ${s.heat.posts} posts about ${s.symbol} in 7 days, ${s.heat.acceleration >= 1.5 ? 'accelerating' : s.heat.acceleration <= 0.67 ? 'cooling' : 'steady'} (${num(s.heat.acceleration, 1)}×)`;

export function SocialPulse({ s }: { s: SocialWave }) {
  const maxDay = Math.max(1, ...s.heat.byDay.map((d) => d.posts));
  return (
    <div>
      <div
        className="flex h-12 items-end gap-1"
        role="img"
        aria-label={`Posts per day: ${s.heat.byDay.map((d) => `${d.day} ${d.posts}`).join(', ')}`}
      >
        {s.heat.byDay.map((d) => (
          <div
            key={d.day}
            className="flex-1 rounded-t bg-ink-2/70"
            style={{ height: `${Math.max(6, (d.posts / maxDay) * 100)}%` }}
            title={`${d.day}: ${d.posts} posts, ${d.views.toLocaleString('en-US')} views`}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10.5px] text-ink-muted">
        <span>{s.heat.byDay[0]?.day.slice(5)}</span>
        <span>posts per day</span>
        <span>{s.heat.byDay.at(-1)?.day.slice(5)}</span>
      </div>
      <ul className="mt-3 space-y-2">
        {s.top.map((p, i) => (
          <li key={`${p.username}:${p.at}`} className="text-[12px]">
            <div className="flex justify-between gap-2 text-ink-muted">
              <span className="truncate">
                @{p.username} · <TimeAgo ts={Date.parse(p.at)} />
              </span>
              <span className="num shrink-0">
                {(p.views ?? 0).toLocaleString('en-US')} views · {p.likes ?? 0} likes
              </span>
            </div>
            <p className="line-clamp-2 text-ink-2">{p.text}</p>
            <div className="flex flex-wrap gap-x-3">
              {p.id && (
                <a
                  href={`https://x.com/${encodeURIComponent(p.username)}/status/${encodeURIComponent(p.id)}`}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="text-[11px] text-ink-muted hover:text-ink hover:underline"
                >
                  open post ↗
                </a>
              )}
              {s.top.findIndex((q) => q.username === p.username) === i && <AuthorWeekButton username={p.username} symbol={s.symbol} />}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

type AuthorState = { k: 'idle' } | { k: 'loading' } | { k: 'ok'; w: AuthorWeek } | { k: 'error'; text: string };

/** On demand: the account's week from Nansen (5 credits, cached an hour). */
function AuthorWeekButton({ username, symbol }: { username: string; symbol: string }) {
  const [st, setSt] = useState<AuthorState>({ k: 'idle' });
  async function load() {
    setSt({ k: 'loading' });
    const d = (await fetch(`/api/token/author?${new URLSearchParams({ username, symbol })}`)
      .then((r) => r.json())
      .catch(() => ({ unavailable: 'Network error.' }))) as Partial<AuthorWeek> & { unavailable?: string; error?: string };
    setSt(d.posts != null ? { k: 'ok', w: d as AuthorWeek } : { k: 'error', text: d.unavailable ?? d.error ?? 'No posts.' });
  }
  if (st.k === 'idle')
    return (
      <button type="button" onClick={load} className="text-[11px] text-ink-muted hover:text-ink hover:underline">
        @{username}&apos;s week · 5 credits
      </button>
    );
  if (st.k === 'loading') return <span className="animate-pulse text-[11px] text-ink-muted">Reading @{username}…</span>;
  if (st.k === 'error') return <span className="text-[11px] text-ink-2">{st.text}</span>;
  const w = st.w;
  return (
    <div className="mt-1 w-full rounded-md bg-accent/40 px-2 py-1.5 text-[11.5px] text-ink-2">
      <p className="text-ink">
        @{w.username}: {w.posts} posts in 7 days · {w.views.toLocaleString('en-US')} views · {w.likes.toLocaleString('en-US')} likes
      </p>
      <p>
        {w.mentionShare == null ? '' : `${Math.round(w.mentionShare * 100)}% mention ${symbol}. `}
        {w.distinctTags
          ? `${w.distinctTags} different cashtags this week${w.distinctTags >= 10 ? ', which reads like a promoter account' : ''}:`
          : 'No cashtags this week.'}
      </p>
      {w.tags.length > 0 && (
        <p className="num break-words text-ink-muted">{w.tags.map((t) => `$${t.tag}${t.posts > 1 ? ` ×${t.posts}` : ''}`).join('  ')}</p>
      )}
    </div>
  );
}

// ------------------------------------------------------------ DCA ladder

export const dcaTitle = (d: DcaWave) =>
  d.overhang
    ? d.overhang.ratio > 0.005
      ? `Open DCA orders still have to sell ${usd(d.overhang.sellRemainingUsd - d.overhang.buyRemainingUsd)} net: ${pct(d.overhang.ratio, 1)} of a day's volume`
      : d.overhang.ratio < -0.005
        ? `Open DCA orders still have to buy ${usd(d.overhang.buyRemainingUsd - d.overhang.sellRemainingUsd)} net: support of ${pct(-d.overhang.ratio, 1)} of a day's volume`
        : 'Open DCA buy and sell ladders roughly balance'
    : `${d.orders.length} open DCA orders`;

export function DcaLadder({ d }: { d: DcaWave }) {
  const max = Math.max(1, ...d.orders.map((o) => o.remainingUsd ?? 0));
  return (
    <ul className="max-h-[340px] space-y-1 overflow-y-auto">
      {d.orders.map((o, i) => (
        <li key={`${o.trader}:${i}`} className="grid grid-cols-[5.5rem_1fr_4.5rem] items-center gap-2 text-[12px]">
          <Link href={`/wallet/${o.trader}`} className="truncate text-ink-2 hover:text-ink hover:underline">
            {walletName(o.label, o.trader)}
          </Link>
          <span
            className="relative h-3 rounded bg-accent"
            title={`${o.side === 'sell' ? 'selling for' : 'buying with'} ${o.other ?? '?'} · ${o.spentShare != null ? pct(o.spentShare, 0) : '?'} executed`}
          >
            <span
              className="absolute inset-y-0 left-0 rounded"
              style={{ width: `${((o.remainingUsd ?? 0) / max) * 100}%`, background: o.side === 'sell' ? 'var(--out-3)' : 'var(--in-3)' }}
            />
          </span>
          <span className="num text-right text-ink">{usd(o.remainingUsd)}</span>
        </li>
      ))}
      <li className="pt-1 text-[11px] text-ink-muted">
        Bar: USD still to execute ({dot('sell')} selling this token, {dot('buy')} buying it).
      </li>
    </ul>
  );
}

// -------------------------------------------------- position tide gauge

const COHORT_LABEL: Record<PositionsWave['cohorts'][number]['cohort'], string> = {
  smart_trader: 'Smart traders',
  whale: 'Whales',
  public_figure: 'Public figures',
};

export const positionsTitle = (p: PositionsWave) => {
  const st = p.cohorts.find((c) => c.cohort === 'smart_trader');
  const wh = p.cohorts.find((c) => c.cohort === 'whale');
  const side = (s: number | null | undefined) => (s == null ? 'flat' : s >= 0.55 ? 'long' : s <= 0.45 ? 'short' : 'split');
  return `Perps on ${p.symbol}: smart traders lean ${side(st?.longShare)}, whales ${side(wh?.longShare)}`;
};

/** A tide gauge per cohort: the waterline is the long share (above 50% =
 *  net long), with the USD on each side. */
export function TideGauge({ p }: { p: PositionsWave }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {p.cohorts.map((c) => {
        const share = c.longShare;
        return (
          <figure key={c.cohort} className="text-center">
            <div
              className="relative mx-auto h-36 w-12 overflow-hidden rounded-md border border-border bg-accent/40"
              role="img"
              aria-label={`${COHORT_LABEL[c.cohort]}: ${share == null ? 'no positions' : `${Math.round(share * 100)}% long`}`}
            >
              {share != null && (
                <div
                  className="absolute inset-x-0 bottom-0"
                  style={{ height: `${share * 100}%`, background: share >= 0.5 ? 'var(--in-2)' : 'var(--out-2)', opacity: 0.85 }}
                />
              )}
              <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-ink-muted" aria-hidden />
            </div>
            <figcaption className="mt-1.5 text-[11.5px]">
              <span className="block text-ink">{COHORT_LABEL[c.cohort]}</span>
              <span className="num block text-ink-2">{share == null ? 'n/a' : `${Math.round(share * 100)}% long`}</span>
              <span className="num block text-[10.5px] text-ink-muted">
                {usd(c.longsUsd)} L · {usd(c.shortsUsd)} S
              </span>
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------ PnL leaderboard

export function PnlBoard({ b }: { b: PnlBoardWave }) {
  return (
    <div className="max-h-[360px] overflow-auto">
      <table className="w-full min-w-[480px] text-[12.5px]">
        <thead className="sticky top-0 bg-surface">
          <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-ink-muted">
            <th className="py-1.5 font-normal">Trader</th>
            <th className="py-1.5 text-right font-normal">PnL</th>
            <th className="py-1.5 text-right font-normal">ROI</th>
            <th className="py-1.5 text-right font-normal">Holding</th>
            <th className="py-1.5 text-right font-normal">Trades</th>
          </tr>
        </thead>
        <tbody>
          {b.rows.map((r) => (
            <tr key={r.trader} className="border-b border-border/50">
              <td className="py-1.5">
                <Link href={`/wallet/${r.trader}`} className="text-ink-2 hover:text-ink hover:underline">
                  {walletName(r.label, r.trader)}
                </Link>
              </td>
              <td className="num py-1.5 text-right text-ink">{usd(r.pnlUsd, { signed: true })}</td>
              <td className="num py-1.5 text-right text-ink-2">{r.roi != null ? pct(r.roi, 0) : 'n/a'}</td>
              <td className="num py-1.5 text-right text-ink-2">{usd(r.holdingUsd)}</td>
              <td className="num py-1.5 text-right text-ink-muted">{r.trades ?? 'n/a'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ------------------------------------------------------------------ news

type NewsState = { k: 'idle' } | { k: 'loading' } | { k: 'ok'; items: NewsItem[]; query: string } | { k: 'error'; text: string };

/** On demand: Nansen's hosted web search (5 credits, cached six hours),
 *  and, for the key owner or a member, a Nansen summary of one article
 *  (20 credits, cached a day). */
export function NewsCards({ name, symbol, canSummarize }: { name: string | null; symbol: string | null; canSummarize: boolean }) {
  const [s, setS] = useState<NewsState>({ k: 'idle' });
  const [summaries, setSummaries] = useState<Record<string, string>>({});

  async function load() {
    setS({ k: 'loading' });
    const qs = new URLSearchParams({ ...(name ? { name } : {}), ...(symbol ? { symbol } : {}) });
    const d = (await fetch(`/api/token/news?${qs}`)
      .then((r) => r.json())
      .catch(() => ({ unavailable: 'Network error.' }))) as { items?: NewsItem[]; query?: string; unavailable?: string; error?: string };
    setS(d.items ? { k: 'ok', items: d.items, query: d.query ?? '' } : { k: 'error', text: d.unavailable ?? d.error ?? 'No results.' });
  }

  async function summarize(url: string) {
    setSummaries((m) => ({ ...m, [url]: '…' }));
    const d = (await fetch('/api/token/news/summary', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url, symbol }),
    })
      .then((r) => r.json())
      .catch(() => ({ unavailable: 'Network error.' }))) as { analysis?: string; unavailable?: string; error?: string };
    setSummaries((m) => ({ ...m, [url]: d.analysis ?? d.unavailable ?? d.error ?? 'No summary.' }));
  }

  if (s.k === 'idle') {
    return (
      <div className="space-y-1">
        <button
          type="button"
          onClick={load}
          className="rounded border border-border bg-surface-2 px-3 py-1.5 text-sm text-ink hover:border-ink-muted"
        >
          Search the web for {symbol ?? name ?? 'this token'}
        </button>
        <p className="text-[11px] text-ink-muted">Nansen&apos;s hosted web search, 5 credits, reused for six hours. Only when you ask.</p>
      </div>
    );
  }
  if (s.k === 'loading') return <p className="animate-pulse text-sm text-ink-muted">Searching…</p>;
  if (s.k === 'error') return <p className="text-sm text-ink-2">{s.text}</p>;
  return (
    <ul className="space-y-2.5">
      {s.items.map((n) => (
        <li key={n.url} className="text-[12.5px]">
          <a href={n.url} target="_blank" rel="noopener noreferrer nofollow" className="font-medium text-ink hover:underline">
            {n.title}
          </a>
          <div className="text-[11px] text-ink-muted">
            {n.host}
            {n.date ? ` · ${n.date}` : ''}
          </div>
          {n.snippet && <p className="line-clamp-2 text-ink-2">{n.snippet}</p>}
          {canSummarize &&
            (summaries[n.url] ? (
              <p className="mt-1 rounded-md bg-accent/50 px-2 py-1 text-[12px] text-ink">{summaries[n.url]}</p>
            ) : (
              <button
                type="button"
                onClick={() => summarize(n.url)}
                className="mt-0.5 text-[11px] text-ink-muted hover:text-ink hover:underline"
              >
                Summarize with Nansen (20 credits)
              </button>
            ))}
        </li>
      ))}
      <li className="text-[11px] text-ink-muted">Search: “{s.query}”. Links open the original sites; nothing here is investment advice.</li>
    </ul>
  );
}
