'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Card, WaveLoading, Unavailable } from '@/components/Card';
import { InfoPopover } from '@/components/InfoPopover';
import { chainName, pct, usd, walletName, shortAddress, ago } from '@/lib/viz/format';
import { ConvictionMap } from './ConvictionMap';
import { HoldingHistory } from './HoldingHistory';
import type { SmDesk, SmPerps, SmDcas, SmHistory, DeskHolding, FollowedMove } from '@/server/smart-money/desk';
import type { Provenance } from '@/lib/provenance';

type Load<T> = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ok'; data: T };
type Moves = { moves: FollowedMove[]; source: 'scanner' | 'live'; provenance: Provenance };

async function post<T>(body: object): Promise<T> {
  const r = await fetch('/api/smart-money', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({ error: 'The server sent an unreadable answer.' }));
  if (!r.ok) throw new Error(j.error ?? `Request failed (${r.status}).`);
  return j as T;
}

function useLoad<T>(body: object | null, dep: string): [Load<T>, () => void] {
  const [s, set] = useState<Load<T>>({ state: 'loading' });
  const [n, bump] = useState(0);
  useEffect(() => {
    if (!body) return;
    let live = true;
    set({ state: 'loading' });
    post<T>(body).then((data) => live && set({ state: 'ok', data })).catch((e) => live && set({ state: 'error', message: (e as Error).message }));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- body is rebuilt each render; dep is its identity
  }, [dep, n]);
  return [s, () => bump((x) => x + 1)];
}

const CHAINS = ['all', 'ethereum', 'solana', 'base', 'bnb', 'arbitrum', 'hyperevm', 'robinhood', 'monad', 'polygon', 'optimism', 'avalanche', 'linea', 'mantle', 'sonic', 'sei', 'plasma', 'arc', 'iotaevm'];
const HISTORY_CHAINS = new Set(['arc', 'base', 'bnb', 'ethereum', 'monad', 'robinhood', 'solana']);

function Conv({ v }: { v: number | null }) {
  if (v == null) return <span className="text-ink-muted">—</span>;
  const w = Math.min(100, Math.abs(v)) / 2;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="relative inline-block h-2 w-16 rounded-full bg-raised" aria-hidden>
        <span className="absolute inset-y-0 left-1/2 w-px bg-axis" />
        <span className="absolute inset-y-0 rounded-full" style={{ width: `${w}%`, [v >= 0 ? 'left' : 'right']: '50%', background: v >= 0 ? 'var(--in-2)' : 'var(--out-2)' }} />
      </span>
      <span className="num w-9 text-right text-ink">{v > 0 ? '+' : ''}{v}</span>
    </span>
  );
}

function deskTitle(d: SmDesk): string {
  const top = [...d.holdings].filter((h) => h.conviction != null && h.conviction > 0).sort((a, b) => b.conviction! - a.conviction!)[0];
  const exits = d.holdings.filter((h) => h.crowdedExit);
  const where = d.chain === 'all' ? '' : ` on ${chainName(d.chain)}`;
  if (!top) return `Smart money is trimming more than it adds${where}: ${d.totals.trimming} tokens cut, ${d.totals.adding} added in 24h`;
  const back = top.backers ? `, and ${top.backers} of the top-100 PnL wallets hold it` : '';
  const tail = exits.length ? `; ${exits.length} crowded exit${exits.length === 1 ? '' : 's'} (${exits.slice(0, 2).map((e) => e.symbol).join(', ')})` : '';
  return `Highest conviction${where}: ${top.symbol}, smart money added ${pct(top.change24h!, 1)} in 24h${back}${tail}`;
}

export function SmartMoneyDesk({ mode }: { mode: 'owner' | 'member' }) {
  const [chain, setChain] = useState('all');
  const [desk] = useLoad<SmDesk>({ action: 'desk', chain }, `desk:${chain}`);
  const [perps] = useLoad<SmPerps>({ action: 'perps' }, 'perps');
  const [dcas] = useLoad<SmDcas>({ action: 'dcas' }, 'dcas');
  const [follows, setFollows] = useState<string[]>([]);
  const [canFollow, setCanFollow] = useState(false);
  const [moves, reloadMoves] = useLoad<Moves>({ action: 'moves' }, 'moves');
  const [picked, setPicked] = useState<DeskHolding | null>(null);
  const [history, setHistory] = useState<Load<SmHistory> | null>(null);
  const [followErr, setFollowErr] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/smart-money').then((r) => r.json()).then((j) => { setFollows(j.follows ?? []); setCanFollow(!!j.canFollow); }).catch(() => {});
  }, []);

  const pick = useCallback((h: DeskHolding) => {
    setPicked(h);
    if (!HISTORY_CHAINS.has(h.chain)) { setHistory({ state: 'error', message: `Nansen's smart-money history covers Arc, Base, BNB Chain, Ethereum, Monad, Robinhood and Solana, not ${chainName(h.chain)}.` }); return; }
    setHistory({ state: 'loading' });
    post<SmHistory>({ action: 'history', chain: h.chain, token: h.tokenAddress }).then((data) => setHistory({ state: 'ok', data })).catch((e) => setHistory({ state: 'error', message: (e as Error).message }));
  }, []);

  const toggleFollow = async (address: string, on: boolean) => {
    setFollowErr(null);
    try {
      const j = await post<{ follows: string[] }>({ action: on ? 'follow' : 'unfollow', address });
      setFollows(j.follows);
      reloadMoves();
    } catch (e) { setFollowErr((e as Error).message); }
  };
  const isFollowed = (a: string) => follows.includes(a.startsWith('0x') ? a.toLowerCase() : a);

  const d = desk.state === 'ok' ? desk.data : null;
  const exits = d?.holdings.filter((h) => h.crowdedExit) ?? [];
  const ranked = d ? [...d.holdings].filter((h) => h.conviction != null).sort((a, b) => b.conviction! - a.conviction!) : [];

  return (
    <div className="space-y-4">
      <section aria-labelledby="sm-title" className="glass rise relative overflow-hidden rounded-2xl p-4 sm:p-6">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full opacity-30 blur-3xl" style={{ background: 'var(--brand-2)' }} />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2 text-[12px]">
            <span className="rounded-full bg-brand/12 px-2 py-0.5 text-ink">Private · {mode === 'owner' ? 'key owner' : 'your Nansen key'}</span>
            <span className="text-ink-muted">Smart-money desk</span>
          </div>
          <h1 id="sm-title" className="mt-2 text-lg font-semibold leading-snug text-ink sm:text-xl">
            {d ? deskTitle(d) : desk.state === 'error' ? 'The smart-money desk could not load' : 'Reading smart-money holdings and the PnL leaderboard from Nansen…'}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label htmlFor="sm-chain" className="text-[12.5px] text-ink-2">Chain</label>
            <select id="sm-chain" value={chain} onChange={(e) => { setChain(e.target.value); setPicked(null); setHistory(null); }}
              className="rounded-lg border border-border bg-raised px-2.5 py-1 text-[13px] text-ink">
              {CHAINS.map((c) => <option key={c} value={c}>{c === 'all' ? 'All chains' : chainName(c)}</option>)}
            </select>
            {d && <span className="num text-[11.5px] text-ink-muted">This view: {d.tally.calls} Nansen calls, {d.tally.credits} credits ({d.tally.cached} from cache)</span>}
          </div>
          {d && (
            <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
              {[
                ['Value tracked', usd(d.totals.valueUsd)], ['Tokens', String(d.totals.tokens)],
                ['Adding · trimming', `${d.totals.adding} · ${d.totals.trimming}`], ['Crowded exits', String(exits.length)],
                ['Top-PnL wallets read', String(d.leaders.length)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl border border-border/70 bg-raised/50 px-3 py-2">
                  <dt className="text-[10.5px] uppercase tracking-wider text-ink-muted">{k}</dt>
                  <dd className="num mt-0.5 text-[14px] text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          )}
          {desk.state === 'error' && <div className="mt-3"><Unavailable text={desk.message} /></div>}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card id="conviction-map" className="lg:col-span-2" title={d ? `${d.totals.adding} tokens being added to, ${d.totals.trimming} trimmed; ${exits.length ? `${exits.length} crowded exit${exits.length === 1 ? '' : 's'}` : 'no crowded exits'}` : 'Conviction map'}
          sub="Each token by smart money's 24h balance change (across) and how many smart-money wallets hold it (up)."
          action={d ? <InfoPopover p={d.provenance.conviction} /> : undefined}>
          {d ? <ConvictionMap holdings={d.holdings} crowdedAt={d.totals.crowdedAt} onPick={pick} /> : desk.state === 'loading' ? <WaveLoading what="smart-money holdings" height={420} /> : null}
        </Card>
        <Card id="conviction" title={ranked[0] && ranked[0].conviction! > 0 ? `${ranked[0].symbol} leads conviction at +${ranked[0].conviction}` : 'Conviction'}
          sub="Balance change, weighted up when top-PnL wallets hold the token. −100 to +100.">
          {d ? (
            <div className="space-y-3 text-[12.5px]">
              {[['Adding with backing', ranked.filter((h) => h.conviction! > 0).slice(0, 7)], ['Being cut', [...ranked].reverse().filter((h) => h.conviction! < 0).slice(0, 5)]].map(([label, list]) => (
                <div key={label as string}>
                  <div className="mb-1 text-[10.5px] uppercase tracking-wider text-ink-muted">{label as string}</div>
                  {(list as DeskHolding[]).length ? (
                    <ul className="space-y-1">
                      {(list as DeskHolding[]).map((h) => (
                        <li key={h.chain + h.tokenAddress}>
                          <button onClick={() => pick(h)} className="flex w-full items-center justify-between gap-2 rounded-md px-1 py-0.5 text-left hover:bg-raised">
                            <span className="min-w-0 truncate"><span className="text-ink">{h.symbol}</span> <span className="text-ink-muted">{chainName(h.chain)}{h.backers ? ` · ${h.backers} backer${h.backers === 1 ? '' : 's'}` : ''}</span></span>
                            <Conv v={h.conviction} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-ink-muted">None today.</p>}
                </div>
              ))}
            </div>
          ) : desk.state === 'loading' ? <WaveLoading what="conviction" height={360} /> : null}
        </Card>
      </div>

      {picked && (
        <Card id="history" title={history?.state === 'ok' ? `${picked.symbol}: smart-money value, 30 days` : `${picked.symbol} history`}
          sub={`Daily value held by Nansen smart money in ${picked.symbol} on ${chainName(picked.chain)}. 1 credit.`}
          action={history?.state === 'ok' ? <InfoPopover p={history.data.provenance} /> : undefined}>
          {history?.state === 'ok' ? <HoldingHistory h={history.data} /> : history?.state === 'error' ? <Unavailable text={history.message} /> : <WaveLoading what="30 days of smart-money balances" height={240} />}
          <div className="mt-2 flex gap-3 text-[12px]">
            <Link href={`/token/${picked.chain}/${picked.tokenAddress}`} className="text-ink-2 underline-offset-2 hover:text-ink hover:underline">Open {picked.symbol}&apos;s token page →</Link>
            <button onClick={() => { setPicked(null); setHistory(null); }} className="text-ink-muted hover:text-ink">Close</button>
          </div>
        </Card>
      )}

      <Card id="holdings" title={d ? `${d.totals.tokens} tokens held by smart money${d.chain === 'all' ? '' : ` on ${chainName(d.chain)}`}, largest first` : 'Smart-money holdings'}
        sub="Value held, 24h balance change, wallets holding, share of the cohort's holdings, and top-PnL backers. Select a row for its history."
        action={d ? <InfoPopover p={d.provenance.holdings} /> : undefined}>
        {d ? (
          <div className="max-h-[520px] overflow-auto">
            <table className="w-full min-w-[720px] text-left text-[12.5px]">
              <thead className="sticky top-0 bg-surface text-[11px] uppercase tracking-wider text-ink-muted">
                <tr><th className="py-2 font-normal">Token</th><th className="font-normal">Value</th><th className="font-normal">24h</th><th className="font-normal">Wallets</th><th className="font-normal">Share</th><th className="font-normal">Backers</th><th className="font-normal">Conviction</th></tr>
              </thead>
              <tbody>
                {d.holdings.slice(0, 120).map((h) => (
                  <tr key={h.chain + h.tokenAddress} onClick={() => pick(h)} className={`cursor-pointer border-t border-border hover:bg-raised/60 ${picked === h ? 'bg-raised' : ''}`}>
                    <td className="py-1.5"><span className="text-ink">{h.symbol}</span> <span className="text-ink-muted">{chainName(h.chain)}</span>{h.crowdedExit && <span className="ml-1.5 rounded-full border border-dashed px-1.5 text-[10.5px] text-ink-2" style={{ borderColor: 'var(--storm-2)' }}>crowded exit</span>}</td>
                    <td className="num text-ink">{usd(h.valueUsd)}</td>
                    <td className="num text-ink">{h.change24h == null ? '—' : `${h.change24h >= 0 ? '+' : '−'}${pct(Math.abs(h.change24h), 1)}`}</td>
                    <td className="num text-ink">{h.holders}</td>
                    <td className="num text-ink-2">{h.share != null ? pct(h.share, 1) : '—'}</td>
                    <td className="num text-ink-2">{h.backers ? `${h.backers} (best #${h.bestRank})` : '—'}</td>
                    <td><Conv v={h.conviction} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : desk.state === 'loading' ? <WaveLoading what="holdings" height={320} /> : null}
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card id="leaders" className="lg:col-span-2" title={d?.leaders[0] ? `Top smart-money wallet made ${usd(d.leaders[0].totalPnlUsd)} in 30 days` : 'Smart-money PnL leaderboard'}
          sub="The best smart-money wallets over 30 days, with their five largest balances. Follow a wallet to track its moves."
          action={d ? <InfoPopover p={d.provenance.leaders} /> : undefined}>
          {followErr && <p className="mb-2 text-[12px] text-ink-2">{followErr}</p>}
          {d ? (
            <div className="max-h-[520px] overflow-auto">
              <table className="w-full min-w-[680px] text-left text-[12.5px]">
                <thead className="sticky top-0 bg-surface text-[11px] uppercase tracking-wider text-ink-muted">
                  <tr><th className="py-2 font-normal">#</th><th className="font-normal">Wallet</th><th className="font-normal">PnL 30d</th><th className="font-normal">Win rate</th><th className="font-normal">Trades</th><th className="font-normal">Largest balances</th><th /></tr>
                </thead>
                <tbody>
                  {d.leaders.slice(0, 50).map((l) => (
                    <tr key={l.address} className="border-t border-border align-top">
                      <td className="num py-1.5 text-ink-muted">{l.rank}</td>
                      <td className="max-w-[180px] truncate"><Link href={`/wallet/${l.address}`} className="text-ink hover:underline">{walletName(l.label, l.address)}</Link></td>
                      <td className="num text-ink">{usd(l.totalPnlUsd, { signed: true })}</td>
                      <td className="num text-ink-2">{l.winRate != null ? pct(l.winRate, 0) : '—'}</td>
                      <td className="num text-ink-2">{l.trades.toLocaleString('en-US')}</td>
                      <td className="text-ink-2">{l.top5.slice(0, 3).map((t) => t.symbol).join(', ') || '—'}</td>
                      <td className="text-right">
                        {canFollow && (
                          <button onClick={() => toggleFollow(l.address, !isFollowed(l.address))} aria-pressed={isFollowed(l.address)}
                            className={`rounded-full px-2 py-0.5 text-[11.5px] ${isFollowed(l.address) ? 'bg-brand/15 text-ink ring-1 ring-brand/40' : 'border border-border text-ink-2 hover:text-ink'}`}>
                            {isFollowed(l.address) ? 'Following' : 'Follow'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : desk.state === 'loading' ? <WaveLoading what="the PnL leaderboard" height={320} /> : null}
        </Card>
        <Card id="follows" title={follows.length ? `Following ${follows.length} wallet${follows.length === 1 ? '' : 's'}` : 'Follow list'}
          sub={moves.state === 'ok' && moves.data.source === 'scanner' ? 'Their latest smart-money trades, as the scanner recorded them (free).' : 'Their latest smart-money trades, fetched with your key (5 credits).'}
          action={moves.state === 'ok' ? <InfoPopover p={moves.data.provenance} /> : undefined}>
          {!canFollow ? <Unavailable text="Sign in to keep a follow list." />
            : !follows.length ? <p className="text-[12.5px] text-ink-2">Follow wallets from the leaderboard to collect their trades here.</p>
            : moves.state === 'ok' ? (
              moves.data.moves.length ? (
                <ul className="max-h-[440px] space-y-1.5 overflow-auto text-[12.5px]">
                  {moves.data.moves.map((m, i) => (
                    <li key={i} className="flex items-start justify-between gap-2 border-t border-border pt-1.5 first:border-0 first:pt-0">
                      <span className="min-w-0">
                        <span className="block truncate text-ink">{walletName(m.label, m.address)}</span>
                        <span className="text-ink-muted">{m.side === 'swap' ? m.symbol : `${m.side === 'buy' ? 'bought' : 'sold'} ${m.symbol ?? shortAddress(m.tokenAddress)}`} · {chainName(m.chain)} · {ago(m.at)}</span>
                      </span>
                      <span className="num shrink-0 text-ink">{usd(m.usd)}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-[12.5px] text-ink-2">No recorded trades from the wallets you follow yet.</p>
            ) : moves.state === 'error' ? <Unavailable text={moves.message} /> : <WaveLoading what="followed wallets' trades" height={200} />}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card id="sm-perps" title={perps.state === 'ok' && perps.data.tilt[0] ? `Smart money's biggest new perp bet: ${perps.data.tilt[0].netUsd >= 0 ? 'long' : 'short'} ${perps.data.tilt[0].symbol}, ${usd(Math.abs(perps.data.tilt[0].netUsd))} net in 24h` : 'Smart-money perp positions'}
          sub="New Hyperliquid positions smart money opened in 24 hours: net exposure per coin (amber long, blue short), then the largest trades."
          action={perps.state === 'ok' ? <InfoPopover p={perps.data.provenance} /> : undefined}>
          {perps.state === 'ok' ? <PerpPanel p={perps.data} /> : perps.state === 'error' ? <Unavailable text={perps.message} /> : <WaveLoading what="smart-money perp trades" height={320} />}
        </Card>
        <Card id="sm-dcas" title={dcas.state === 'ok' ? `${dcas.data.orders.length} recent smart-money DCA order${dcas.data.orders.length === 1 ? '' : 's'} on Jupiter` : 'Smart-money DCAs'}
          sub="Dollar-cost-averaging orders smart money opened on Jupiter (Solana), newest first: what they are selling into what."
          action={dcas.state === 'ok' ? <InfoPopover p={dcas.data.provenance} /> : undefined}>
          {dcas.state === 'ok' ? (
            dcas.data.orders.length ? (
              <div className="max-h-[420px] overflow-auto">
                <table className="w-full min-w-[480px] text-left text-[12.5px]">
                  <thead className="sticky top-0 bg-surface text-[11px] uppercase tracking-wider text-ink-muted"><tr><th className="py-2 font-normal">Opened</th><th className="font-normal">Wallet</th><th className="font-normal">From → to</th><th className="font-normal">Deposit</th><th className="font-normal">Spent</th><th className="font-normal">Status</th></tr></thead>
                  <tbody>
                    {dcas.data.orders.map((o, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="num py-1.5 text-ink-muted">{ago(Date.parse(o.created))}</td>
                        <td className="max-w-[140px] truncate text-ink-2">{walletName(o.label, o.address)}</td>
                        <td className="text-ink">{o.from} → {o.to}</td>
                        <td className="num text-ink">{usd(o.depositUsd)}</td>
                        <td className="num text-ink-2">{o.spent != null ? pct(o.spent, 0) : '—'}</td>
                        <td className="text-ink-2">{o.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="text-[12.5px] text-ink-2">Nansen returned no smart-money DCA orders.</p>
          ) : dcas.state === 'error' ? <Unavailable text={dcas.message} /> : <WaveLoading what="smart-money DCAs" height={320} />}
        </Card>
      </div>
      <p className="text-[11.5px] text-ink-muted">Readings of positioning from Nansen smart-money data, not forecasts and not financial advice. Nothing on this page is shown to public visitors.</p>
    </div>
  );
}

function PerpPanel({ p }: { p: SmPerps }) {
  const tilt = p.tilt.slice(0, 8);
  const peak = Math.max(1, ...tilt.map((t) => Math.abs(t.netUsd)));
  return (
    <div className="space-y-3">
      {tilt.length ? (
        <ul className="space-y-1.5" aria-label="Net new perp exposure by coin, 24h">
          {tilt.map((t) => (
            <li key={t.symbol} className="grid grid-cols-[64px_1fr_84px] items-center gap-2 text-[12px]">
              <span className="truncate text-ink">{t.symbol}</span>
              <span className="relative h-[14px]">
                <span className="absolute inset-y-0 left-1/2 w-px bg-axis" />
                <span className="absolute inset-y-[2px]" style={{ width: `${Math.max(1, (Math.abs(t.netUsd) / peak) * 50)}%`, [t.netUsd >= 0 ? 'left' : 'right']: '50%', background: t.netUsd >= 0 ? 'var(--in-2)' : 'var(--out-2)', borderRadius: t.netUsd >= 0 ? '0 4px 4px 0' : '4px 0 0 4px' }} />
              </span>
              <span className="num text-right text-ink">{usd(t.netUsd, { signed: true })}</span>
            </li>
          ))}
        </ul>
      ) : <p className="text-[12.5px] text-ink-2">No new or added perp exposure from smart money in 24 hours.</p>}
      <div className="max-h-[220px] overflow-auto border-t border-border pt-2">
        <table className="w-full min-w-[420px] text-left text-[12px]">
          <tbody>
            {p.trades.slice(0, 40).map((t) => (
              <tr key={t.tx + t.action} className="border-t border-border first:border-0">
                <td className="num py-1 text-ink-muted">{ago(Date.parse(t.at))}</td>
                <td className="max-w-[130px] truncate text-ink-2">{walletName(t.label, t.address)}</td>
                <td className="text-ink">{t.symbol}</td>
                <td className="text-ink-2">{t.action}</td>
                <td className="num text-right text-ink">{usd(t.valueUsd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
