'use client';
import Link from 'next/link';
import { useState } from 'react';
import { usd, pct, shortAddress, num } from '@/lib/viz/format';
import { PerpDeposit } from './PerpDeposit';
import { perpAccountView, perpPositionView, type PerpPositionView } from '@/lib/models/perp-account';

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
  const [state, setState] = useState<{ fee: Row; account: Row; positions: Row; orders?: Row } | null>(null);
  const [lev, setLev] = useState('3');
  const [isCross, setIsCross] = useState(true);
  const [moveAmt, setMoveAmt] = useState('');
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
    setStatus('Reading your Hyperliquid account (up to 4 credits)…');
    try { setState(await post({ action: 'perp-state', wallet: a })); } catch (e) { setErr((e as Error).message); } finally { setStatus(null); }
  }

  type Kind = 'approve-builder-fee' | 'order' | 'close' | 'cancel' | 'leverage' | 'transfer';
  type Params = { cancel?: { coin: string; orderId: number }; leverage?: { coin: string; leverage: number; isCross: boolean }; transfer?: { amount: number; toPerp: boolean } };
  async function prepare(kind: Kind, order?: { coin: string; isBuy: boolean; size: number; price: number }, params: Params = {}, what?: string) {
    if (!wallet) return;
    setErr(null); setResult(null); setConfirming(false); setStatus('Preparing (nothing changes yet)…');
    try {
      const p = await post<Prepared>({ action: 'perp-prepare', kind, wallet, order, ...params });
      const summary = kind === 'approve-builder-fee' ? 'Approve Nansen’s builder fee for this wallet (once).'
        : what ?? `${kind === 'close' ? 'Close' : isBuy ? 'Long' : 'Short'} ${String(p.size ?? order?.size)} ${order?.coin} at up to ${String(p.price ?? order?.price)} (market, immediate-or-cancel).`;
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
      const done: Record<string, string> = { 'approve-builder-fee': 'Builder fee approved', cancel: 'Order cancelled', leverage: 'Leverage set', transfer: 'Transfer accepted' };
      setResult(`${done[r.kind] ?? 'Accepted by the exchange'}: ${JSON.stringify(r.result).slice(0, 160)}`);
      setPrep(null);
      await refresh();
    } catch (e) { setErr(walletMsg(e)); } finally { setStatus(null); }
  }

  const fee = state?.fee as { approved?: boolean; required_fee?: number; error?: string } | undefined;
  const acct = state?.account as { error?: string } | undefined;
  const av = perpAccountView(state?.account);
  const positions = ((Array.isArray(state?.positions) ? state!.positions : ((state?.positions as Row | undefined)?.positions ?? [])) as Row[]).map(perpPositionView).filter((p): p is PerpPositionView => p != null);
  const orders = (Array.isArray(state?.orders) ? state!.orders : ((state?.orders as Row | undefined)?.orders ?? [])) as Row[];
  const ordersError = (state?.orders as { error?: string } | undefined)?.error;
  const card = 'glass rounded-2xl p-4';
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <div className="min-w-0 space-y-4">
        <section className={card}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[15px] font-semibold text-ink">Hyperliquid account</h2>
            {wallet ? <button onClick={() => refresh()} className="num text-[12.5px] text-ink-2 hover:text-ink">{shortAddress(wallet)} · refresh</button> : <button onClick={connect} className="rounded bg-brand/15 px-3 py-1 text-[13px] text-ink ring-1 ring-brand/40">Connect wallet</button>}
          </div>
          {state && (
            <dl className="mt-3 grid grid-cols-2 gap-2 text-[12.5px] sm:grid-cols-3">
              <div className="rounded-xl border border-border/70 bg-raised/50 px-3 py-2"><dt className="text-[10.5px] uppercase tracking-wider text-ink-muted">Builder fee</dt><dd className="text-ink">{fee?.error ? '—' : fee?.approved ? 'approved' : `not approved (${num((fee?.required_fee ?? 0) / 10, 1)} bps)`}</dd></div>
              <div className="rounded-xl border border-border/70 bg-raised/50 px-3 py-2"><dt className="text-[10.5px] uppercase tracking-wider text-ink-muted">Perps account value</dt><dd className="num text-ink">{acct?.error || av.accountValue == null ? '—' : usd(av.accountValue)}</dd>{av.marginUsed != null && av.marginUsed > 0 && <dd className="num text-[11px] text-ink-muted">{usd(av.marginUsed)} margin in use</dd>}</div>
              <div className="rounded-xl border border-border/70 bg-raised/50 px-3 py-2"><dt className="text-[10.5px] uppercase tracking-wider text-ink-muted">Withdrawable</dt><dd className="num text-ink">{acct?.error || av.withdrawable == null ? '—' : usd(av.withdrawable)}</dd></div>
              <div className="rounded-xl border border-border/70 bg-raised/50 px-3 py-2"><dt className="text-[10.5px] uppercase tracking-wider text-ink-muted">Spot USDC</dt><dd className="num text-ink">{acct?.error || av.spotUsdc == null ? '—' : usd(av.spotUsdc)}</dd></div>
            </dl>
          )}
          {state && (av.spotUsdc ?? 0) > 0 && <p className="mt-2 text-[11.5px] text-ink-muted">Only the perps balance is margin: USDC in spot can&apos;t back an order until it is moved to perps.</p>}
          {state && !fee?.approved && !fee?.error && <button onClick={() => prepare('approve-builder-fee')} className="mt-3 rounded border border-border px-3 py-1 text-[13px] text-ink hover:bg-raised">Approve the builder fee (sign once)</button>}
          {state && !acct?.error && (
            <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-border pt-3">
              <label className="text-[12.5px] text-ink-2">Move USDC<input aria-label="USDC to move" value={moveAmt} onChange={(e) => setMoveAmt(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" placeholder="amount" className="num mt-1 block w-28 rounded-lg border border-border bg-raised px-2.5 py-1.5 text-[13px] text-ink" /></label>
              {[true, false].map((toPerp) => <button key={String(toPerp)} disabled={!(Number(moveAmt) > 0)} onClick={() => prepare('transfer', undefined, { transfer: { amount: Number(moveAmt), toPerp } }, `Move ${moveAmt} USDC from ${toPerp ? 'spot to perps (usable as margin)' : 'perps to spot'}. Signed by your wallet’s own key.`)} className="rounded border border-border px-3 py-1 text-[13px] text-ink hover:bg-raised disabled:opacity-45">{toPerp ? 'Spot → perps' : 'Perps → spot'}</button>)}
            </div>
          )}
          {wallet && state && <PerpDeposit wallet={wallet} onFunded={() => refresh()} />}
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
          <p className="num mt-2 text-[12px] text-ink-2">{m?.mark ? `Mark ${usd(m.mark)} · about ${usd(m.mark * (Number(size) || 0))} notional · 2% slippage limit` : 'No mark price for this coin in Peregrine’s latest snapshot.'}</p>
          <button disabled={!wallet || !m?.mark || !(Number(size) > 0) || !fee?.approved} onClick={() => prepare('order', { coin, isBuy, size: Number(size), price: m!.mark! })} className="mt-3 rounded border border-border px-3 py-1 text-[13px] text-ink hover:bg-raised disabled:opacity-45">Prepare the order</button>
          {wallet && state && !fee?.approved && <span className="ml-2 text-[11.5px] text-ink-muted">Approve the builder fee first.</span>}
          <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-border pt-3">
            <label className="text-[12.5px] text-ink-2">Leverage on {coin || '…'}<input aria-label="Leverage" value={lev} onChange={(e) => setLev(e.target.value.replace(/[^\d]/g, '').slice(0, 3))} inputMode="numeric" className="num mt-1 block w-20 rounded-lg border border-border bg-raised px-2.5 py-1.5 text-[13px] text-ink" /></label>
            <div className="flex gap-1" role="radiogroup" aria-label="Margin mode">
              {[true, false].map((c) => <button key={String(c)} role="radio" aria-checked={isCross === c} onClick={() => setIsCross(c)} className={`rounded-lg px-3 py-1.5 text-[13px] ${isCross === c ? 'bg-brand/15 text-ink ring-1 ring-brand/40' : 'border border-border text-ink-2'}`}>{c ? 'Cross' : 'Isolated'}</button>)}
            </div>
            <button disabled={!wallet || !coin || !(Number(lev) >= 1 && Number(lev) <= 200)} onClick={() => prepare('leverage', undefined, { leverage: { coin, leverage: Number(lev), isCross } }, `Set ${coin} leverage to ${lev}× (${isCross ? 'cross' : 'isolated'} margin). It applies to positions opened afterwards, not ones you hold.`)} className="rounded border border-border px-3 py-1 text-[13px] text-ink hover:bg-raised disabled:opacity-45">Prepare leverage</button>
          </div>
        </section>

        {confirming && prep && (
          <div role="alertdialog" aria-label="Confirm" className="space-y-2 rounded-xl border border-border bg-raised/60 p-3 text-[12.5px]">
            <div className="text-ink">{prep.summary}</div>
            <div className="text-ink-muted">Real funds on Hyperliquid. Your wallet shows the typed data it signs; this expires in 45 seconds. Not financial advice.</div>
            <div className="flex gap-2"><button onClick={signAndSend} className="rounded bg-brand/20 px-3 py-1 text-ink ring-1 ring-brand/50">Sign in my wallet and submit</button><button onClick={() => { setConfirming(false); setPrep(null); }} className="text-ink-muted hover:text-ink">Cancel</button></div>
          </div>
        )}
        {status && <p className="text-[12.5px] text-ink-2">{status}</p>}
        {err && <p className="text-[12.5px] text-ink">{err}</p>}
        {result && <p className="text-[12.5px] text-ink">{result}</p>}

        {state && (orders.length > 0 || ordersError) && (
          <section className={card}>
            <h2 className="text-[15px] font-semibold text-ink">Resting orders</h2>
            {ordersError ? <p className="mt-2 text-[12.5px] text-ink-2">Orders unavailable: {ordersError}</p> : (
              <div className="overflow-x-auto"><table className="mt-2 w-full text-left text-[12.5px]">
                <thead><tr className="text-[10.5px] uppercase tracking-wider text-ink-muted"><th className="py-1 font-normal">Coin</th><th className="font-normal">Side</th><th className="font-normal">Size</th><th className="font-normal">Price</th><th className="font-normal">Type</th><th /></tr></thead>
                <tbody>{orders.map((o) => {
                  const c = String(o.coin ?? '?'); const oid = Number(o.oid); const spot = c.startsWith('@');
                  const side = o.side === 'B' ? 'buy' : o.side === 'A' ? 'sell' : String(o.side ?? '?');
                  const type = [o.orderType, o.tif, o.reduceOnly ? 'reduce-only' : null, o.isTrigger ? `trigger ${String(o.triggerPx)}` : null].filter(Boolean).join(' · ');
                  return (
                    <tr key={String(o.oid)} className="border-t border-border">
                      <td className="py-1.5 text-ink">{c}</td><td className="text-ink-2">{side}</td><td className="num text-ink-2">{String(o.sz ?? '—')}</td><td className="num text-ink-2">{String(o.limitPx ?? '—')}</td><td className="text-ink-muted">{type}</td>
                      <td className="text-right">{spot ? <span className="text-[11.5px] text-ink-muted" title="Spot orders share this list; manage them on Hyperliquid">spot</span>
                        : <button disabled={!Number.isSafeInteger(oid)} onClick={() => prepare('cancel', undefined, { cancel: { coin: c, orderId: oid } }, `Cancel your resting ${c} ${side} order #${oid} (${String(o.sz)} at ${String(o.limitPx)}).`)} className="rounded border border-border px-2.5 py-0.5 text-[12px] text-ink hover:bg-raised">Cancel</button>}</td>
                    </tr>
                  );
                })}</tbody>
              </table></div>
            )}
          </section>
        )}

        {positions.length > 0 && (
          <section className={card}>
            <h2 className="text-[15px] font-semibold text-ink">Open positions</h2>
            <table className="mt-2 w-full text-left text-[12.5px]">
              <tbody>{positions.map((p) => {
                const mk = marks.find((x) => x.symbol === p.coin)?.mark ?? p.entry ?? 0;
                return (
                  <tr key={p.coin} className="border-t border-border first:border-0">
                    <td className="py-1.5 text-ink">{p.coin}</td><td className="num text-ink-2">{p.size > 0 ? 'long' : 'short'} {Math.abs(p.size)}{p.leverage ? ` · ${p.leverage}` : ''}</td>
                    <td className="num text-ink-2">uPnL {p.uPnl == null ? '—' : usd(p.uPnl, { signed: true })}{p.liquidation != null ? ` · liq ${usd(p.liquidation)}` : ''}</td>
                    <td className="text-right"><button disabled={!mk} onClick={() => prepare('close', { coin: p.coin, isBuy: p.size < 0, size: Math.abs(p.size), price: mk })} className="rounded border border-border px-2.5 py-0.5 text-[12px] text-ink hover:bg-raised">Close</button></td>
                  </tr>
                );
              })}</tbody>
            </table>
          </section>
        )}
      </div>
      <aside className={`${card} h-fit space-y-2 text-[12.5px]`}>
        <h2 className="text-[13px] font-semibold text-ink">What Peregrine sees on {coin || '…'}</h2>
        {m ? (
          <>
            <div className="flex justify-between"><span className="text-ink-2">Perp Flow</span><span className="num text-ink">{m.ppi != null ? num(m.ppi, 0) : '—'}</span></div>
            <div className="flex justify-between"><span className="text-ink-2">Funding, yearly</span><span className="num text-ink">{m.fundingApr != null ? pct(m.fundingApr, 1) : '—'}</span></div>
            <Link href="/perps" className="text-ink-2 underline-offset-2 hover:text-ink hover:underline">Open the liquidation ladder on /perps →</Link>
          </>
        ) : <p className="text-ink-2">Not in Peregrine&apos;s latest perp snapshot.</p>}
        <p className="border-t border-border pt-2 text-[11.5px] text-ink-muted">Peregrine never signs. Every action is prepared by Nansen, signed in your wallet and submitted only after your click. Perp flow&apos;s forward check against later prices is in the <Link href="/lab" className="underline-offset-2 hover:underline">Backtest Lab</Link>.</p>
      </aside>
    </div>
  );
}
