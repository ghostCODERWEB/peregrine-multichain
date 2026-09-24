'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usd, pct, shortAddress } from '@/lib/viz/format';

type Eth = { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> };
const eth = (): Eth | null => (typeof window !== 'undefined' ? ((window as unknown as { ethereum?: Eth }).ethereum ?? null) : null);
const BASE_CHAIN = '0x2105';
const DECIMALS = { USDC: 6, ETH: 18 } as const;

interface Quote { id: string; aggregator: string; inUsd: number | null; outUsd: number | null; outAmount: string | null; priceImpactPct: number | null; tradingFeeUsd: number | null; networkFeeUsd: number | null }
interface Prepared { simulationPassed: boolean | null; needsApproval: boolean; approvalTx: Record<string, unknown> | null; swapTx: Record<string, unknown> | null; error: string | null }
interface Signals { symbol: string | null; storm: { score: number; band: string } | null; chainPressure: { cpi: number; band: string | null } | null; trackRecord: string }

async function post<T>(body: object): Promise<T> {
  const r = await fetch('/api/trade', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? `Request failed (${r.status}).`);
  return j as T;
}

/** Decimal string → integer base units, without floating point. */
export function toBaseUnits(amount: string, decimals: number): string | null {
  const m = /^(\d+)(?:\.(\d+))?$/.exec(amount.trim());
  if (!m) return null;
  const frac = (m[2] ?? '').slice(0, decimals).padEnd(decimals, '0');
  const v = BigInt(m[1] + frac);
  return v > BigInt(0) ? v.toString() : null;
}

const hex = (v: unknown) => (v == null ? undefined : typeof v === 'string' && v.startsWith('0x') ? v : `0x${BigInt(String(v)).toString(16)}`);
// chainId pins Base: a wallet on another chain refuses instead of sending there. Nonce and fees are left to the wallet.
const txParams = (from: string, t: Record<string, unknown>) => ({ from, chainId: BASE_CHAIN, to: t.to as string, data: (t.data as string) ?? '0x', value: hex(t.value ?? 0), ...(t.gas ?? t.gasLimit ? { gas: hex(t.gas ?? t.gasLimit) } : {}) });
const walletMsg = (e: unknown) => { const m = (e as { message?: string; code?: number })?.message ?? String(e); return /reject|denied|4001/i.test(m) ? 'You declined in your wallet.' : m.slice(0, 200); };

async function waitReceipt(w: Eth, hash: string, onTick: (s: string) => void): Promise<boolean> {
  for (let i = 0; i < 90; i++) {
    const r = (await w.request({ method: 'eth_getTransactionReceipt', params: [hash] }).catch(() => null)) as { status?: string } | null;
    if (r?.status) return r.status === '0x1';
    onTick(`Waiting for confirmation (${i * 2}s)…`);
    await new Promise((res) => setTimeout(res, 2000));
  }
  return false;
}

export function SpotTrade({ initialToken }: { initialToken: string }) {
  const [wallet, setWallet] = useState<string | null>(null);
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [base, setBase] = useState<'USDC' | 'ETH'>('USDC');
  const [token, setToken] = useState(initialToken);
  const [amount, setAmount] = useState('');
  const [signals, setSignals] = useState<Signals | null>(null);
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const [picked, setPicked] = useState<Quote | null>(null);
  const [prep, setPrep] = useState<Prepared | null>(null);
  const [approved, setApproved] = useState(false);
  const [confirmSwap, setConfirmSwap] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ hash: string; ok: boolean | null; via: 'nansen' | 'wallet' } | null>(null);
  const validToken = /^0x[0-9a-fA-F]{40}$/.test(token.trim());

  useEffect(() => {
    setSignals(null);
    if (validToken) post<Signals>({ action: 'signals', chain: 'base', token: token.trim() }).then(setSignals).catch(() => {});
  }, [token, validToken]);
  // Any change invalidates quotes and preparation.
  useEffect(() => { setQuotes(null); setPicked(null); setPrep(null); setApproved(false); setConfirmSwap(false); setDone(null); }, [side, base, token, amount, wallet]);

  async function connect() {
    setErr(null);
    const w = eth();
    if (!w) { setErr('No Ethereum wallet found in this browser.'); return; }
    try {
      const [a] = (await w.request({ method: 'eth_requestAccounts' })) as string[];
      await w.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BASE_CHAIN }] });
      setWallet(a);
    } catch (e) { setErr(walletMsg(e)); }
  }

  async function sellDecimals(): Promise<number> {
    // Read through the wallet's own connection: TIDE's server talks only to Nansen.
    const r = (await eth()!.request({ method: 'eth_call', params: [{ to: token.trim(), data: '0x313ce567' }, 'latest'] })) as string;
    const d = Number(BigInt(r));
    if (!Number.isFinite(d) || d > 36) throw new Error('Could not read the token’s decimals.');
    return d;
  }

  async function getQuotes() {
    setErr(null); setStatus('Asking Nansen for routes…');
    try {
      const decimals = side === 'buy' ? DECIMALS[base] : await sellDecimals();
      const units = toBaseUnits(amount, decimals);
      if (!units) throw new Error('Enter an amount.');
      const r = await post<{ quotes: Quote[] }>({ action: 'quote', chain: 'base', side, base, token: token.trim(), amount: units, wallet });
      setQuotes(r.quotes);
      if (!r.quotes.length) setErr('Nansen found no route for this pair and size.');
    } catch (e) { setErr((e as Error).message); } finally { setStatus(null); }
  }

  async function prepare(q: Quote) {
    setPicked(q); setPrep(null); setErr(null); setStatus('Building and simulating the transaction (nothing is sent)…');
    try { setPrep(await post<Prepared>({ action: 'prepare', quoteId: q.id, wallet })); } catch (e) { setErr((e as Error).message); } finally { setStatus(null); }
  }

  async function approve() {
    if (!prep?.approvalTx || !wallet) return;
    setErr(null);
    try {
      setStatus('Confirm the approval in your wallet…');
      const hash = (await eth()!.request({ method: 'eth_sendTransaction', params: [txParams(wallet, prep.approvalTx)] })) as string;
      const ok = await waitReceipt(eth()!, hash, setStatus);
      if (!ok) throw new Error('The approval did not confirm.');
      setApproved(true);
    } catch (e) { setErr(walletMsg(e)); } finally { setStatus(null); }
  }

  async function swap() {
    if (!prep?.swapTx || !wallet) return;
    setConfirmSwap(false); setErr(null);
    const w = eth()!;
    const params = txParams(wallet, prep.swapTx);
    try {
      setStatus('Sign the swap in your wallet…');
      let signed: string | null = null;
      try { signed = (await w.request({ method: 'eth_signTransaction', params: [params] })) as string; } catch (e) {
        if (/reject|denied|4001/i.test(String((e as Error).message))) throw e;
        signed = null; // This wallet only signs-and-sends.
      }
      if (signed) {
        setStatus('Broadcasting through Nansen…');
        const r = await post<{ txHash: string | null }>({ action: 'execute', chain: 'base', signedTx: signed, confirm: true });
        if (!r.txHash) throw new Error('Nansen did not return a transaction hash.');
        setDone({ hash: r.txHash, ok: null, via: 'nansen' });
        setDone({ hash: r.txHash, ok: await waitReceipt(w, r.txHash, setStatus), via: 'nansen' });
      } else {
        setStatus('Confirm the swap in your wallet; it sends it itself…');
        const hash = (await w.request({ method: 'eth_sendTransaction', params: [params] })) as string;
        setDone({ hash, ok: null, via: 'wallet' });
        setDone({ hash, ok: await waitReceipt(w, hash, setStatus), via: 'wallet' });
      }
    } catch (e) { setErr(walletMsg(e)); } finally { setStatus(null); }
  }

  const readyToSwap = prep && prep.swapTx && prep.simulationPassed !== false && (!prep.needsApproval || approved);
  const card = 'glass rounded-2xl p-4';
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <div className="min-w-0 space-y-4">
        <section className={card}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[15px] font-semibold text-ink">1 · Wallet and trade</h2>
            {wallet ? <span className="num text-[12.5px] text-ink-2">{shortAddress(wallet)} · Base</span> : <button onClick={connect} className="rounded-full bg-brand/15 px-3 py-1 text-[13px] text-ink ring-1 ring-brand/40">Connect wallet</button>}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="flex gap-1" role="radiogroup" aria-label="Side">
              {(['buy', 'sell'] as const).map((x) => <button key={x} role="radio" aria-checked={side === x} onClick={() => setSide(x)} className={`flex-1 rounded-lg px-3 py-1.5 text-[13px] ${side === x ? 'bg-brand/15 text-ink ring-1 ring-brand/40' : 'border border-border text-ink-2'}`}>{x === 'buy' ? 'Buy token' : 'Sell token'}</button>)}
            </div>
            <label className="text-[12.5px] text-ink-2">{side === 'buy' ? 'Pay with' : 'Receive'}
              <select value={base} onChange={(e) => setBase(e.target.value as 'USDC' | 'ETH')} className="mt-1 block w-full rounded-lg border border-border bg-raised px-2.5 py-1.5 text-[13px] text-ink"><option>USDC</option><option>ETH</option></select>
            </label>
            <label className="text-[12.5px] text-ink-2 sm:col-span-2">Token on Base
              <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="0x…" className="num mt-1 block w-full rounded-lg border border-border bg-raised px-2.5 py-1.5 text-[13px] text-ink" />
            </label>
            <label className="text-[12.5px] text-ink-2">Amount of {side === 'buy' ? base : signals?.symbol ?? 'the token'}
              <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" placeholder="e.g. 5" className="num mt-1 block w-full rounded-lg border border-border bg-raised px-2.5 py-1.5 text-[13px] text-ink" />
            </label>
            <div className="flex items-end"><button onClick={getQuotes} disabled={!wallet || !validToken || !amount} className="w-full rounded-lg border border-border px-3 py-1.5 text-[13px] text-ink hover:bg-raised disabled:opacity-45">Get quotes</button></div>
          </div>
        </section>

        {quotes && quotes.length > 0 && (
          <section className={card}>
            <h2 className="text-[15px] font-semibold text-ink">2 · Pick a route</h2>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-[12.5px]">
                <thead className="text-[11px] uppercase tracking-wider text-ink-muted"><tr><th className="py-1.5 font-normal">Route</th><th className="font-normal">You pay</th><th className="font-normal">You get</th><th className="font-normal">Impact</th><th className="font-normal">Fees</th><th /></tr></thead>
                <tbody>{quotes.map((q) => (
                  <tr key={q.id} className={`border-t border-border ${picked?.id === q.id ? 'bg-raised' : ''}`}>
                    <td className="py-1.5 text-ink">{q.aggregator}</td><td className="num text-ink">{usd(q.inUsd)}</td><td className="num text-ink">{usd(q.outUsd)}</td>
                    <td className="num" style={{ color: (q.priceImpactPct ?? 0) > 2 ? 'var(--storm-2)' : undefined }}>{q.priceImpactPct != null ? pct(q.priceImpactPct / 100, 2) : '—'}</td>
                    <td className="num text-ink-2">{usd((q.tradingFeeUsd ?? 0) + (q.networkFeeUsd ?? 0))}</td>
                    <td className="text-right"><button onClick={() => prepare(q)} className="rounded-full border border-border px-2.5 py-0.5 text-[12px] text-ink hover:bg-raised">Prepare</button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </section>
        )}

        {prep && picked && (
          <section className={card}>
            <h2 className="text-[15px] font-semibold text-ink">3 · Sign in your wallet</h2>
            <p className="mt-1 text-[12.5px] text-ink-2">Simulation: {prep.simulationPassed === true ? 'passed — the swap should go through as quoted.' : prep.simulationPassed === false ? `failed${prep.error ? `: ${prep.error}` : ''}. Don’t sign this one.` : 'not run.'}</p>
            {prep.needsApproval && (
              <div className="mt-3 flex items-center gap-2">
                <button onClick={approve} disabled={approved} className="rounded-full border border-border px-3 py-1 text-[13px] text-ink hover:bg-raised disabled:opacity-45">{approved ? 'Approved' : `Approve ${side === 'buy' ? base : 'the token'} (wallet)`}</button>
                <span className="text-[11.5px] text-ink-muted">One-time permission for the route to spend this token.</span>
              </div>
            )}
            <div className="mt-3">
              {!confirmSwap ? (
                <button onClick={() => setConfirmSwap(true)} disabled={!readyToSwap} className="rounded-full bg-brand/15 px-3.5 py-1.5 text-[13px] text-ink ring-1 ring-brand/40 hover:bg-brand/25 disabled:opacity-45">Review the swap</button>
              ) : (
                <div role="alertdialog" aria-label="Confirm the swap" className="space-y-2 rounded-xl border border-border bg-raised/60 p-3 text-[12.5px]">
                  <div className="text-ink">You pay about {usd(picked.inUsd)} and get about {usd(picked.outUsd)} via {picked.aggregator}; price impact {picked.priceImpactPct != null ? pct(picked.priceImpactPct / 100, 2) : 'unknown'}, fees {usd((picked.tradingFeeUsd ?? 0) + (picked.networkFeeUsd ?? 0))}.</div>
                  <div className="text-ink-muted">This is a real trade with your funds. Your wallet shows the final details; nothing happens unless you approve there. Not financial advice.</div>
                  <div className="flex gap-2"><button onClick={swap} className="rounded-full bg-brand/20 px-3 py-1 text-ink ring-1 ring-brand/50">Sign the swap in my wallet</button><button onClick={() => setConfirmSwap(false)} className="text-ink-muted hover:text-ink">Cancel</button></div>
                </div>
              )}
            </div>
          </section>
        )}
        {status && <p className="text-[12.5px] text-ink-2">{status}</p>}
        {err && <p className="text-[12.5px] text-ink">{err}</p>}
        {done && (
          <section className={card}>
            <h2 className="text-[15px] font-semibold text-ink">{done.ok === true ? 'Swap confirmed' : done.ok === false ? 'Swap did not confirm' : 'Swap sent'}</h2>
            <p className="num mt-1 break-all text-[12.5px] text-ink-2">{done.hash} · {done.via === 'nansen' ? 'broadcast through Nansen' : 'sent by your wallet'}</p>
          </section>
        )}
      </div>

      <aside className={`${card} h-fit space-y-2 text-[12.5px]`}>
        <h2 className="text-[13px] font-semibold text-ink">What TIDE sees</h2>
        {!validToken ? <p className="text-ink-2">Enter a Base token address.</p> : !signals ? <p className="animate-pulse text-ink-muted">Reading TIDE&apos;s signals…</p> : (
          <>
            <div className="flex justify-between"><span className="text-ink-2">Storm Score</span><span className="num text-ink">{signals.storm ? `${signals.storm.score} · ${signals.storm.band}` : 'not computed'}</span></div>
            <div className="flex justify-between"><span className="text-ink-2">Base pressure</span><span className="num text-ink">{signals.chainPressure ? `${signals.chainPressure.cpi} · ${signals.chainPressure.band ?? ''}` : '—'}</span></div>
            <p className="text-[11.5px] text-ink-muted">{signals.trackRecord}</p>
            <Link href={`/token/base/${token.trim()}`} className="text-ink-2 underline-offset-2 hover:text-ink hover:underline">Open the token page →</Link>
          </>
        )}
        <p className="border-t border-border pt-2 text-[11.5px] text-ink-muted">TIDE never signs or sends a transaction: your wallet does, after your confirmation. Readings, not advice.</p>
      </aside>
    </div>
  );
}
