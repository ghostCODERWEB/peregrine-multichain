'use client';
import Link from 'next/link';
import { useState } from 'react';
import { AddressLink } from '@/components/entity/AddressLink';
import { CohortBadges } from '@/components/entity/CohortBadges';
import { Segmented } from '@/components/ui/Segmented';
import { chainName, pct, price, usd } from '@/lib/viz/format';

const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
const tone = (v: number | null | undefined) => ({ color: v == null ? undefined : v >= 0 ? 'var(--mint)' : 'var(--flare)' });
type Tally = { calls: number; credits: number; cached: number };
type Loaded<T> = { data: T; tally: Tally } | { error: string };

async function get<T>(q: string): Promise<Loaded<T>> {
  try {
    const r = await fetch(`/api/history?${q}`);
    const j = await r.json();
    return r.ok ? (j as { data: T; tally: Tally }) : { error: j.error ?? 'Unavailable.' };
  } catch {
    return { error: 'Could not reach the server.' };
  }
}

function DatePick({ date, setDate }: { date: string; setDate: (d: string) => void }) {
  const preset = [7, 30, 90].find((d) => ago(d) === date) ?? 0;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Segmented label="How far back" value={preset} options={[{ value: 7, label: '7d ago' }, { value: 30, label: '30d ago' }, { value: 90, label: '90d ago' }, { value: 0, label: 'Date' }]} onChange={(v) => v && setDate(ago(v))} />
      <input type="date" value={date} max={ago(1)} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Date" className="inset-well h-8 rounded-[8px] px-2 text-[12.5px] text-ink" />
    </div>
  );
}

const Foot = ({ t }: { t?: Tally }) => (t ? <p className="mt-1 text-[11px] text-ink-muted">Nansen point-in-time: {t.calls} call{t.calls === 1 ? '' : 's'}, {t.credits} credits ({t.cached} cached). Cached permanently.</p> : null);

// -------------------------------------------------------------- tokens

type Flow = { cohort: string; netUsd: number | null; avgUsd: number | null; wallets: number | null };
type Trader = { address: string; label: string | null; smartMoney: boolean; boughtUsd: number | null; soldUsd: number | null; grossUsd: number | null };
type Trade = { at: string | null; tx: string | null; address: string; label: string | null; action: string | null; amount: number | null; other: string | null; valueUsd: number | null; priceUsd: number | null };
type Holder = { address: string; label: string | null; amount: number | null; valueUsd: number | null; ownership: number | null; change7d: number | null; change30d: number | null };
type Leader = { address: string; label: string | null; pnlUsd: number | null; realizedUsd: number | null; unrealizedUsd: number | null; holdingUsd: number | null; roi: number | null; trades: number | null };

/** Token Time Machine: who moved this token on a past day, from Nansen's point-in-time endpoints. */
export function TokenTimeMachine({ chain, address, owner }: { chain: string; address: string; owner: boolean }) {
  const [date, setDate] = useState(ago(30));
  const [busy, setBusy] = useState<string | null>(null);
  const [flows, setFlows] = useState<Loaded<{ flows: Flow[] }> | null>(null);
  const [traders, setTraders] = useState<Loaded<{ rows: Trader[] }> | null>(null);
  const [trades, setTrades] = useState<Loaded<{ rows: Trade[] }> | null>(null);
  const [holders, setHolders] = useState<Loaded<{ rows: Holder[] }> | null>(null);
  const [pnl, setPnl] = useState<Loaded<{ rows: Leader[] }> | null>(null);
  const base = `kind=token&chain=${chain}&address=${encodeURIComponent(address)}&date=${date}`;
  const loadCore = async () => {
    setBusy('core');
    const [f, t, x] = await Promise.all([get<{ flows: Flow[] }>(`${base}&part=flows`), get<{ rows: Trader[] }>(`${base}&part=traders`), get<{ rows: Trade[] }>(`${base}&part=trades`)]);
    setFlows(f); setTraders(t); setTrades(x); setBusy(null);
  };
  const loadOne = async (part: 'holders' | 'pnl') => {
    setBusy(part);
    if (part === 'holders') setHolders(await get(`${base}&part=holders`)); else setPnl(await get(`${base}&part=pnl`));
    setBusy(null);
  };
  const changeDate = (d: string) => { setDate(d); setFlows(null); setTraders(null); setTrades(null); setHolders(null); setPnl(null); };
  const err = (x: { error: string }) => <p role="alert" className="text-[12.5px] text-[var(--flare)]">{x.error}</p>;

  return (
    <section aria-labelledby="tok-tm" className="material space-y-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="tok-tm" className="t-section">Token Time Machine</h2>
          <p className="text-[12px] text-ink-muted">What happened to this token on a past day, as Nansen recorded it then (labels and prices as of that date)</p>
        </div>
        <DatePick date={date} setDate={changeDate} />
      </div>
      {!flows && <button type="button" onClick={loadCore} disabled={!!busy} className="pill-button pill-primary min-h-9 px-4 py-1.5 text-[12.5px]">{busy === 'core' ? 'Reading history…' : `Read ${date}: cohort flows, buyers and sellers, trades (15 credits)`}</button>}
      {flows && ('error' in flows ? err(flows) : (
        <div>
          <h3 className="mb-1.5 text-[12.5px] font-semibold text-ink-muted">Net flow by Nansen cohort on {date}</h3>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--r-inner)] border border-[var(--hair)] bg-[var(--hair)] md:grid-cols-3 xl:grid-cols-6">
            {flows.data.flows.map((c) => (
              <div key={c.cohort} className="bg-[var(--surface-1)] px-3 py-2">
                <span className="block text-[11.5px] font-semibold text-ink-muted">{c.cohort}</span>
                <span className="num block text-[15px] font-bold" style={tone(c.netUsd)}>{usd(c.netUsd, { signed: true })}</span>
                <span className="block text-[11px] text-ink-2">{c.wallets ?? 0} wallets · avg {usd(c.avgUsd)}</span>
              </div>
            ))}
          </div>
          <Foot t={flows.tally} />
        </div>
      ))}
      {traders && ('error' in traders ? err(traders) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {(['buy', 'sell'] as const).map((side) => {
            const list = [...traders.data.rows].map((r) => ({ ...r, net: (r.boughtUsd ?? 0) - (r.soldUsd ?? 0) })).filter((r) => (side === 'buy' ? r.net > 0 : r.net < 0)).sort((a, b) => (side === 'buy' ? b.net - a.net : a.net - b.net)).slice(0, 8);
            return (
              <div key={side}>
                <h3 className="mb-1 text-[12.5px] font-semibold text-ink-muted">{side === 'buy' ? 'Largest net buyers' : 'Largest net sellers'} that day</h3>
                <ol className="divide-y divide-[var(--hair)]">
                  {list.map((r) => <li key={r.address} className="flex items-center gap-2 py-1.5 text-[12.5px]"><span className="flex min-w-0 flex-1 items-center gap-1.5"><AddressLink address={r.address} label={r.label} />{r.smartMoney && <CohortBadges cohorts={['smart_money']} />}</span><span className="num text-ink-muted">gross {usd(r.grossUsd)}</span><span className="num w-20 text-right font-semibold" style={tone(r.net)}>{usd(r.net, { signed: true })}</span></li>)}
                  {!list.length && <li className="py-2 text-[12.5px] text-ink-muted">None that day.</li>}
                </ol>
              </div>
            );
          })}
        </div>
      ))}
      {trades && ('error' in trades ? err(trades) : trades.data.rows.length > 0 && (
        <details>
          <summary className="text-[13px] font-bold text-ink">Largest DEX trades that day <span className="font-normal text-ink-muted">· {trades.data.rows.length}</span></summary>
          <ol className="mt-2 max-h-[300px] divide-y divide-[var(--hair)] overflow-auto" tabIndex={0} aria-label="Historical trades">
            {trades.data.rows.map((t, i) => (
              <li key={`${t.tx}:${i}`} className="flex items-center gap-2 py-1.5 text-[12.5px]">
                <span className="num w-[52px] shrink-0 text-ink-muted">{t.at?.slice(11, 16)}</span>
                <span className="w-10 shrink-0 font-semibold" style={{ color: /buy/i.test(t.action ?? '') ? 'var(--mint)' : 'var(--flare)' }}>{t.action}</span>
                <span className="min-w-0 flex-1"><AddressLink address={t.address} label={t.label} compact /></span>
                <span className="num text-ink-2">{t.other ? `for ${t.other}` : ''} at {price(t.priceUsd)}</span>
                <span className="num w-20 text-right font-semibold text-ink">{usd(t.valueUsd)}</span>
                {t.tx && chain !== 'solana' && <TxAsOf chain={chain} hash={t.tx} at={t.at} compact />}
              </li>
            ))}
          </ol>
        </details>
      ))}
      {flows && !('error' in flows) && (
        <div className="flex flex-wrap gap-2">
          {!holders && <button type="button" onClick={() => loadOne('holders')} disabled={!!busy} className="pill-button pill-secondary min-h-8 px-3.5 py-1 text-[12.5px]">{busy === 'holders' ? 'Reading…' : `Top holders on ${date} (25 credits)`}</button>}
          {!pnl && owner && <button type="button" onClick={() => loadOne('pnl')} disabled={!!busy} className="pill-button pill-secondary min-h-8 px-3.5 py-1 text-[12.5px]">{busy === 'pnl' ? 'Reading…' : `PnL leaders, 30 days to ${date} (25 credits)`}</button>}
        </div>
      )}
      {holders && ('error' in holders ? err(holders) : (
        <div>
          <h3 className="mb-1 text-[12.5px] font-semibold text-ink-muted">Top holders on {date}</h3>
          <ol className="max-h-[320px] divide-y divide-[var(--hair)] overflow-auto" tabIndex={0} aria-label="Historical holders">
            {holders.data.rows.map((h) => <li key={h.address} className="flex items-center gap-2 py-1.5 text-[12.5px]"><span className="min-w-0 flex-1"><AddressLink address={h.address} label={h.label} /></span><span className="num text-ink-2">{h.ownership != null ? pct(h.ownership > 1 ? h.ownership / 100 : h.ownership, 2) : 'n/a'}</span><span className="num w-20 text-right text-ink">{usd(h.valueUsd)}</span><span className="num w-24 text-right" style={tone(h.change30d)}>30d {h.change30d != null ? `${h.change30d >= 0 ? '+' : ''}${Math.round(h.change30d).toLocaleString('en-US')}` : 'n/a'}</span></li>)}
          </ol>
          <Foot t={holders.tally} />
        </div>
      ))}
      {pnl && ('error' in pnl ? err(pnl) : (
        <div>
          <h3 className="mb-1 text-[12.5px] font-semibold text-ink-muted">PnL leaders, 30 days to {date}</h3>
          <ol className="max-h-[320px] divide-y divide-[var(--hair)] overflow-auto" tabIndex={0} aria-label="Historical PnL leaders">
            {pnl.data.rows.map((l) => <li key={l.address} className="flex items-center gap-2 py-1.5 text-[12.5px]"><span className="min-w-0 flex-1"><AddressLink address={l.address} label={l.label} /></span><span className="num text-ink-2">{l.trades ?? 'n/a'} trades · ROI {l.roi != null ? `${Math.round(l.roi)}%` : 'n/a'}</span><span className="num w-24 text-right font-semibold" style={tone(l.pnlUsd)}>{usd(l.pnlUsd, { signed: true })}</span></li>)}
          </ol>
          <Foot t={pnl.tally} />
        </div>
      ))}
    </section>
  );
}

// -------------------------------------------------------------- wallets

type WalletThen = { date: string; txChain: string; totalUsd: number; balances: Array<{ chain: string; token: string; symbol: string | null; valueUsd: number | null; amount: number | null }>; byChain: Array<{ chain: string; valueUsd: number }>; transactions: Array<{ at: string | null; chain: string; hash: string | null; method: string | null; volumeUsd: number | null; sent: number; received: number }>; errors: string[] };
type Current = { totalUsd: number; positions: Array<{ chain: string; symbol: string | null; tokenAddress: string; valueUsd: number }> } | null;

/** Wallet Time Machine: holdings and activity on a past day against today's balances (THEN / NOW / CHANGE). */
export function WalletTimeMachine({ address, current }: { address: string; current: Current }) {
  const [date, setDate] = useState(ago(30));
  const [chain, setChain] = useState('all');
  const [res, setRes] = useState<Loaded<WalletThen> | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async () => { setBusy(true); setRes(await get<WalletThen>(`kind=wallet&address=${encodeURIComponent(address)}&chain=${chain}&date=${date}`)); setBusy(false); };
  const now = new Map((current?.positions ?? []).map((p) => [`${p.chain}:${p.tokenAddress.toLowerCase()}`, p]));
  return (
    <section aria-labelledby="wal-tm" className="material space-y-3 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="wal-tm" className="t-section">Wallet Time Machine</h2>
          <p className="text-[12px] text-ink-muted">Holdings and transactions on a past day (Nansen point-in-time), against today&apos;s balances</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DatePick date={date} setDate={(d) => { setDate(d); setRes(null); }} />
          <select value={chain} onChange={(e) => { setChain(e.target.value); setRes(null); }} aria-label="Chain" className="inset-well h-8 rounded-[8px] px-2 text-[12.5px] text-ink">
            {['all', 'ethereum', 'base', 'bnb', 'solana', 'mantra'].map((c) => <option key={c} value={c}>{c === 'all' ? 'All supported chains' : chainName(c)}</option>)}
          </select>
          <button type="button" onClick={run} disabled={busy} className="pill-button pill-primary min-h-8 px-3.5 py-1 text-[12.5px]">{busy ? 'Reading…' : 'Read (10 credits)'}</button>
        </div>
      </div>
      {res && 'error' in res && <p role="alert" className="text-[12.5px] text-[var(--flare)]">{res.error}</p>}
      {res && !('error' in res) && (
        <>
          <div className="grid grid-cols-3 gap-px overflow-hidden rounded-[var(--r-inner)] border border-[var(--hair)] bg-[var(--hair)]">
            {[['Then', res.data.date, usd(res.data.totalUsd)], ['Now', 'today', current ? usd(current.totalUsd) : 'n/a'], ['Change', current && res.data.totalUsd ? pct(current.totalUsd / res.data.totalUsd - 1, 0) : '', current ? usd(current.totalUsd - res.data.totalUsd, { signed: true }) : 'n/a']].map(([k, sub, v], i) => (
              <div key={k} className="bg-[var(--surface-1)] px-3.5 py-2.5"><span className="block text-[11.5px] font-semibold text-ink-muted">{k} · {sub}</span><span className="num block text-[18px] font-bold" style={i === 2 && current ? tone(current.totalUsd - res.data.totalUsd) : undefined}>{v}</span></div>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <h3 className="mb-1 text-[12.5px] font-semibold text-ink-muted">Largest holdings then, and now</h3>
              <ol className="max-h-[300px] divide-y divide-[var(--hair)] overflow-auto" tabIndex={0} aria-label="Holdings then and now">
                {res.data.balances.filter((b) => (b.valueUsd ?? 0) >= 1).slice(0, 30).map((b) => {
                  const n = now.get(`${b.chain}:${b.token.toLowerCase()}`);
                  return (
                    <li key={`${b.chain}:${b.token}`} className="flex items-center gap-2 py-1.5 text-[12.5px]">
                      <Link href={`/token/${b.chain}/${encodeURIComponent(b.token)}`} className="min-w-0 flex-1 truncate font-semibold text-ink hover:underline">{b.symbol ?? b.token.slice(0, 8)} <span className="font-normal text-ink-muted">{chainName(b.chain)}</span></Link>
                      <span className="num w-20 text-right text-ink-2">{usd(b.valueUsd)}</span>
                      <span className="num w-24 text-right text-ink">{n ? usd(n.valueUsd) : current ? 'none now' : 'n/a'}</span>
                    </li>
                  );
                })}
                {!res.data.balances.length && <li className="py-3 text-[12.5px] text-ink-muted">Nansen shows no priced balances on {res.data.date} for this chain selection.</li>}
              </ol>
            </div>
            <div>
              <h3 className="mb-1 text-[12.5px] font-semibold text-ink-muted">Transactions up to {res.data.date} on {chainName(res.data.txChain)}</h3>
              <ol className="max-h-[300px] divide-y divide-[var(--hair)] overflow-auto" tabIndex={0} aria-label="Historical transactions">
                {res.data.transactions.map((t, i) => (
                  <li key={`${t.hash}:${i}`} className="flex items-center gap-2 py-1.5 text-[12.5px]">
                    <span className="num w-[86px] shrink-0 text-ink-muted">{t.at?.slice(5, 16).replace('T', ' ')}</span>
                    <span className="min-w-0 flex-1 truncate text-ink">{t.method ?? 'transfer'} <span className="text-ink-muted">· {t.sent} out, {t.received} in</span></span>
                    <span className="num text-ink-2">{usd(t.volumeUsd)}</span>
                    {t.hash && <TxAsOf chain={t.chain} hash={t.hash} at={t.at} compact />}
                  </li>
                ))}
                {!res.data.transactions.length && <li className="py-3 text-[12.5px] text-ink-muted">No transactions returned up to that date.</li>}
              </ol>
            </div>
          </div>
          {res.data.errors.length > 0 && <p className="text-[11.5px] text-ink-muted">Partial: {res.data.errors.join(' · ')}</p>}
          <Foot t={res.tally} />
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------- transactions

type TxThen = { from: string | null; fromLabel: string | null; to: string | null; toLabel: string | null; nativeValue: number | null; valueUsdThen: number | null; priceThen: number | null; valueUsdAsOf: number | null; status: string | null; at: string | null; method: string | null; transfers: Array<{ symbol: string | null; amount: number | null; valueUsd: number | null; from: string | null; to: string | null }> };

/** A transaction as it looked at the time: labels resolved then, value at the day's price (5 credits; base, bnb, ethereum). */
export function TxAsOf({ chain, hash, at, compact = false }: { chain: string; hash: string; at: string | null; compact?: boolean }) {
  const [res, setRes] = useState<Loaded<TxThen> | null>(null);
  const [open, setOpen] = useState(false);
  if (!['base', 'bnb', 'ethereum'].includes(chain)) return null;
  const run = async () => { setOpen(true); if (!res) setRes(await get<TxThen>(`kind=tx&chain=${chain}&hash=${hash}${at ? `&at=${encodeURIComponent(at)}` : ''}`)); };
  return (
    <span className="relative">
      <button type="button" onClick={run} title="Labels and value at the time of the transaction (5 credits)" className={`rounded px-1.5 text-[11px] font-semibold text-brand hover:bg-ink/8 ${compact ? '' : 'py-0.5'}`}>At the time</button>
      {open && (
        <span role="dialog" aria-label="Transaction at the time" className="spotlight material-strong absolute right-0 top-6 z-30 block w-[340px] rounded-[12px] p-3 text-[12px] text-ink-2">
          <span className="mb-1 flex justify-between"><span className="font-bold text-ink">Transaction at the time</span><button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-ink-muted hover:text-ink">✕</button></span>
          {!res && 'Reading…'}
          {res && 'error' in res && <span className="text-[var(--flare)]">{res.error}</span>}
          {res && !('error' in res) && (
            <span className="block space-y-1">
              <span className="block">{res.data.at?.replace('T', ' ').slice(0, 16)} UTC · {res.data.method ?? 'transfer'} · {res.data.status ?? ''}</span>
              <span className="flex items-center gap-1">From {res.data.from && <AddressLink address={res.data.from} label={res.data.fromLabel} compact />}</span>
              <span className="flex items-center gap-1">To {res.data.to && <AddressLink address={res.data.to} label={res.data.toLabel} compact />}</span>
              {res.data.nativeValue ? <span className="block num">{res.data.nativeValue} native · {usd(res.data.valueUsdThen)} then at {price(res.data.priceThen)}</span> : null}
              {res.data.transfers.slice(0, 5).map((t, i) => <span key={i} className="block num">{t.amount?.toLocaleString('en-US', { maximumFractionDigits: 4 })} {t.symbol} · {usd(t.valueUsd)}</span>)}
              <span className="block text-[11px] text-ink-muted">Labels resolved as of that day (Nansen). {res.tally.credits} credits.</span>
            </span>
          )}
        </span>
      )}
    </span>
  );
}
