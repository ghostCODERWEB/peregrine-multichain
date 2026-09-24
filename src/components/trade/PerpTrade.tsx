'use client';
import Link from 'next/link';
import { useState } from 'react';
import { usd, pct, shortAddress, num } from '@/lib/viz/format';

type Eth = { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> };
const eth = (): Eth | null => (typeof window !== 'undefined' ? ((window as unknown as { ethereum?: Eth }).ethereum ?? null) : null);
type Row = Record<string, unknown>;
export interface PerpMark { symbol: string; mark: number | null; ppi: number | null; fundingApr: number | null }

async function post<T>(body: object): Promise<T> {
  const r = await fetch('/api/trade', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? `Request failed (${r.status}).`);
  return j as T;
}
const walletMsg = (e: unknown) => {
  const m = (e as { message?: string })?.message ?? String(e);
  if (/reject|denied|4001/i.test(m)) return 'You declined in your wallet.';
  if (/chainid|chain id|1337/i.test(m)) return 'Your wallet won’t sign Hyperliquid’s trading payload (it is bound to chain 1337, not your wallet’s network). Wallets that allow it work; otherwise approve an API wallet and trade through Nansen’s own trading tools.';
  return m.slice(0, 220);
};

/** Signs Nansen's EIP-712 payload, switching the wallet to the payload's chain when it is a real one. */
async function signTyped(wallet: string, typed: Row): Promise<string> {
  const w = eth()!;
  const cid = Number((typed.domain as Row | undefined)?.chainId ?? 0);
  if (cid && cid !== 1337) {
    const want = `0x${cid.toString(16)}`;
    const cur = (await w.request({ method: 'eth_chainId' })) as string;
    if (cur?.toLowerCase() !== want) await w.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: want }] });
  }
  return (await w.request({ method: 'eth_signTypedData_v4', params: [wallet, JSON.stringify(typed)] })) as string;
}

interface Prepared { id: string; typedData: Row; size: unknown; price: unknown; kind: string; summary: string }

export function PerpTrade({ marks, initialCoin }: { marks: PerpMark[]; initialCoin: string }) {
  const [wallet, setWallet] = useState<string | null>(null);
  const [state, setState] = useState<{ fee: Row; account: Row; positions: Row } | null>(null);
  const [coin, setCoin] = useState(initialCoin || 'BTC');
  const [isBuy, setIsBuy] = useState(true);
  const [size, setSize] = useState('');
  const [prep, setPrep] = useState<Prepared | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const m = marks.find((x) => x.symbol.toUpperCase() === coin.toUpperCase()) ?? null;

  async function connect() {
    setErr(null);
    const w = eth();
    if (!w) { setErr('No Ethereum wallet found in this browser.'); return; }
    try { const [a] = (await w.request({ method: 'eth_requestAccounts' })) as string[]; setWallet(a); await refresh(a); } catch (e) { setErr(walletMsg(e)); }
  }
  async function refresh(a = wallet) {
    if (!a) return;
    setStatus('Reading your Hyperliquid account (3 credits)…');
    try { setState(await post({ action: 'perp-state', wallet: a })); } catch (e) { setErr((e as Error).message); } finally { setStatus(null); }
  }

  async function prepare(kind: 'approve-builder-fee' | 'order' | 'close', order?: { coin: string; isBuy: boolean; size: number; price: number }) {
    if (!wallet) return;
    setErr(null); setResult(null); setConfirming(false); setStatus('Preparing (nothing changes yet)…');
    try {
      const p = await post<Prepared>({ action: 'perp-prepare', kind, wallet, order });
      const summary = kind === 'approve-builder-fee' ? 'Approve Nansen’s builder fee for this wallet (once).'
        : `${kind === 'close' ? 'Close' : isBuy ? 'Long' : 'Short'} ${String(p.size ?? order?.size)} ${order?.coin} at up to ${String(p.price ?? order?.price)} (market, immediate-or-cancel).`;
      setPrep({ ...p, kind, summary });
      setConfirming(true);
    } catch (e) { setErr((e as Error).message); } finally { setStatus(null); }
  }

  async function signAndSend() {
    if (!prep || !wallet) return;
    setConfirming(false); setErr(null);
    try {
      setStatus('Sign in your wallet…');
      const signature = await signTyped(wallet, prep.typedData);
      setStatus('Submitting to Hyperliquid through Nansen…');
      const r = await post<{ kind: string; result: Row }>({ action: 'perp-execute', id: prep.id, wallet, signature, confirm: true });
      setResult(`${r.kind === 'approve-builder-fee' ? 'Builder fee approved' : 'Accepted by the exchange'}: ${JSON.stringify(r.result).slice(0, 160)}`);
      setPrep(null);
      await refresh();
    } catch (e) { setErr(walletMsg(e)); } finally { setStatus(null); }
  }

  const fee = state?.fee as { approved?: boolean; required_fee?: number; error?: string } | undefined;
  const acct = state?.account as { error?: string; spotUsdc?: unknown; withdrawable?: unknown; account_value?: unknown; accountValue?: unknown } | undefined;
  const positions = (Array.isArray(state?.positions) ? state!.positions : ((state?.positions as Row | undefined)?.positions ?? [])) as Row[];
  const card = 'glass rounded-2xl p-4';
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <div className="min-w-0 space-y-4">
        <section className={card}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[15px] font-semibold text-ink">Hyperliquid account</h2>
            {wallet ? <button onClick={() => refresh()} className="num text-[12.5px] text-ink-2 hover:text-ink">{shortAddress(wallet)} · refresh</button> : <button onClick={connect} className="rounded-full bg-brand/15 px-3 py-1 text-[13px] text-ink ring-1 ring-brand/40">Connect wallet</button>}
          </div>
          {state && (
            <dl className="mt-3 grid grid-cols-2 gap-2 text-[12.5px] sm:grid-cols-3">
              <div className="rounded-xl border border-border/70 bg-raised/50 px-3 py-2"><dt className="text-[10.5px] uppercase tracking-wider text-ink-muted">Builder fee</dt><dd className="text-ink">{fee?.error ? '—' : fee?.approved ? 'approved' : `not approved (${num((fee?.required_fee ?? 0) / 10, 1)} bps)`}</dd></div>
              <div className="rounded-xl border border-border/70 bg-raised/50 px-3 py-2"><dt className="text-[10.5px] uppercase tracking-wider text-ink-muted">Perps margin</dt><dd className="num text-ink">{acct?.error ? '—' : usd(Number(acct?.account_value ?? acct?.accountValue ?? acct?.withdrawable ?? 0))}</dd></div>
              <div className="rounded-xl border border-border/70 bg-raised/50 px-3 py-2"><dt className="text-[10.5px] uppercase tracking-wider text-ink-muted">Spot USDC</dt><dd className="num text-ink">{acct?.error ? '—' : usd(Number(acct?.spotUsdc ?? 0))}</dd></div>
            </dl>
          )}
          {state && Number(acct?.spotUsdc ?? 0) > 0 && <p className="mt-2 text-[11.5px] text-ink-muted">Only the perps balance is margin: USDC in spot can&apos;t back an order until it is moved to perps.</p>}
          {state && !fee?.approved && !fee?.error && <button onClick={() => prepare('approve-builder-fee')} className="mt-3 rounded-full border border-border px-3 py-1 text-[13px] text-ink hover:bg-raised">Approve the builder fee (sign once)</button>}
        </section>

        <section className={card}>
          <h2 className="text-[15px] font-semibold text-ink">Market order</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="text-[12.5px] text-ink-2">Coin<input value={coin} onChange={(e) => setCoin(e.target.value.toUpperCase().replace(/[^A-Z0-9:]/g, ''))} className="num mt-1 block w-full rounded-lg border border-border bg-raised px-2.5 py-1.5 text-[13px] text-ink" /></label>
            <div className="flex items-end gap-1" role="radiogroup" aria-label="Side">
              {[true, false].map((b) => <button key={String(b)} role="radio" aria-checked={isBuy === b} onClick={() => setIsBuy(b)} className={`flex-1 rounded-lg px-3 py-1.5 text-[13px] ${isBuy === b ? 'bg-brand/15 text-ink ring-1 ring-brand/40' : 'border border-border text-ink-2'}`}>{b ? 'Long' : 'Short'}</button>)}
            </div>
            <label className="text-[12.5px] text-ink-2">Size ({coin || 'coin'} units)<input value={size} onChange={(e) => setSize(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" className="num mt-1 block w-full rounded-lg border border-border bg-raised px-2.5 py-1.5 text-[13px] text-ink" /></label>
          </div>
          <p className="num mt-2 text-[12px] text-ink-2">{m?.mark ? `Mark ${usd(m.mark)} · about ${usd(m.mark * (Number(size) || 0))} notional · 2% slippage limit` : 'No mark price for this coin in TIDE’s latest snapshot.'}</p>
          <button disabled={!wallet || !m?.mark || !(Number(size) > 0) || !fee?.approved} onClick={() => prepare('order', { coin, isBuy, size: Number(size), price: m!.mark! })} className="mt-3 rounded-full border border-border px-3 py-1 text-[13px] text-ink hover:bg-raised disabled:opacity-45">Prepare the order</button>
          {wallet && state && !fee?.approved && <span className="ml-2 text-[11.5px] text-ink-muted">Approve the builder fee first.</span>}
        </section>

        {confirming && prep && (
          <div role="alertdialog" aria-label="Confirm" className="space-y-2 rounded-xl border border-border bg-raised/60 p-3 text-[12.5px]">
            <div className="text-ink">{prep.summary}</div>
            <div className="text-ink-muted">Real funds on Hyperliquid. Your wallet shows the typed data it signs; this expires in 45 seconds. Not financial advice.</div>
            <div className="flex gap-2"><button onClick={signAndSend} className="rounded-full bg-brand/20 px-3 py-1 text-ink ring-1 ring-brand/50">Sign in my wallet and submit</button><button onClick={() => { setConfirming(false); setPrep(null); }} className="text-ink-muted hover:text-ink">Cancel</button></div>
          </div>
        )}
        {status && <p className="text-[12.5px] text-ink-2">{status}</p>}
        {err && <p className="text-[12.5px] text-ink">{err}</p>}
        {result && <p className="text-[12.5px] text-ink">{result}</p>}

        {positions.length > 0 && (
          <section className={card}>
            <h2 className="text-[15px] font-semibold text-ink">Open positions</h2>
            <table className="mt-2 w-full text-left text-[12.5px]">
              <tbody>{positions.map((p, i) => {
                const c = String(p.coin ?? p.token_symbol ?? '?'); const sz = Number(p.size ?? p.szi ?? 0); const mk = marks.find((x) => x.symbol === c)?.mark ?? Number(p.entry_price ?? p.entryPx ?? 0);
                return (
                  <tr key={i} className="border-t border-border first:border-0">
                    <td className="py-1.5 text-ink">{c}</td><td className="num text-ink-2">{sz > 0 ? 'long' : 'short'} {Math.abs(sz)}</td><td className="num text-ink-2">uPnL {usd(Number(p.unrealized_pnl ?? p.unrealizedPnl ?? 0), { signed: true })}</td>
                    <td className="text-right"><button disabled={!mk} onClick={() => prepare('close', { coin: c, isBuy: sz < 0, size: Math.abs(sz), price: mk })} className="rounded-full border border-border px-2.5 py-0.5 text-[12px] text-ink hover:bg-raised">Close</button></td>
                  </tr>
                );
              })}</tbody>
            </table>
          </section>
        )}
      </div>
      <aside className={`${card} h-fit space-y-2 text-[12.5px]`}>
        <h2 className="text-[13px] font-semibold text-ink">What TIDE sees on {coin || '…'}</h2>
        {m ? (
          <>
            <div className="flex justify-between"><span className="text-ink-2">Perp Pressure</span><span className="num text-ink">{m.ppi != null ? num(m.ppi, 0) : '—'}</span></div>
            <div className="flex justify-between"><span className="text-ink-2">Funding, yearly</span><span className="num text-ink">{m.fundingApr != null ? pct(m.fundingApr, 1) : '—'}</span></div>
            <Link href="/perps" className="text-ink-2 underline-offset-2 hover:text-ink hover:underline">Open the liquidation ladder on /perps →</Link>
          </>
        ) : <p className="text-ink-2">Not in TIDE&apos;s latest perp snapshot.</p>}
        <p className="border-t border-border pt-2 text-[11.5px] text-ink-muted">TIDE never signs. Every action is prepared by Nansen, signed in your wallet and submitted only after your click. Perp pressure has no track record until the M9 backtest.</p>
      </aside>
    </div>
  );
}
