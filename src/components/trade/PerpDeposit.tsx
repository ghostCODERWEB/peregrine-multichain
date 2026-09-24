'use client';
// Fund Hyperliquid perps from an EVM chain (D1c). Nansen quotes; the server
// checks the quote; the user's wallet sends each transaction; Nansen reports
// the bridge status. TIDE never signs or sends.
import { useState } from 'react';

type Eth = { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> };
const eth = (): Eth | null => (typeof window !== 'undefined' ? ((window as unknown as { ethereum?: Eth }).ethereum ?? null) : null);
const CHAINS = [['base', 'Base'], ['arbitrum', 'Arbitrum'], ['ethereum', 'Ethereum'], ['polygon', 'Polygon']] as const;
type Tx = { from: string; to: string; data: string; value: string; chainId: number; gas?: string };
interface Quote { id: string; chain: string; send: string; receive: string; receiveName: string; feeUsdc: string | null; impactPct: number | null; seconds: number | null; steps: Array<{ id: string; description: string }>; requestId: string }

async function post<T>(body: object): Promise<T> {
  const r = await fetch('/api/trade', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? `Request failed (${r.status}).`);
  return j as T;
}
const hex = (n: string | number) => `0x${BigInt(n).toString(16)}`;
const walletMsg = (e: unknown) => { const m = (e as { message?: string })?.message ?? String(e); return /reject|denied|4001/i.test(m) ? 'You declined in your wallet.' : m.slice(0, 200); };

async function mined(w: Eth, hash: string): Promise<boolean> {
  for (let i = 0; i < 90; i++) {
    const r = (await w.request({ method: 'eth_getTransactionReceipt', params: [hash] }).catch(() => null)) as { status?: string } | null;
    if (r?.status) return r.status === '0x1';
    await new Promise((res) => setTimeout(res, 2000));
  }
  return false;
}

export function PerpDeposit({ wallet, onFunded }: { wallet: string; onFunded: () => void }) {
  const [chain, setChain] = useState<string>('base');
  const [amount, setAmount] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const chainName = CHAINS.find(([id]) => id === chain)?.[1] ?? chain;

  async function getQuote() {
    setErr(null); setQuote(null); setConfirming(false); setStatus('Quoting (nothing is sent)…');
    try { setQuote(await post<Quote>({ action: 'perp-deposit-quote', wallet, chain, amount })); } catch (e) { setErr((e as Error).message); } finally { setStatus(null); }
  }

  async function send() {
    const w = eth();
    if (!quote || !w) return;
    setConfirming(false); setErr(null);
    try {
      const { chainId, txs } = await post<{ chainId: number; txs: Array<{ step: string; description: string; tx: Tx }> }>({ action: 'perp-deposit-steps', id: quote.id, wallet, confirm: true });
      const want = hex(chainId);
      if (((await w.request({ method: 'eth_chainId' })) as string)?.toLowerCase() !== want) await w.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: want }] });
      for (const [i, { step, tx }] of txs.entries()) {
        setStatus(`Step ${i + 1} of ${txs.length} (${step}): confirm in your wallet…`);
        const hash = (await w.request({ method: 'eth_sendTransaction', params: [{ from: wallet, to: tx.to, data: tx.data, value: hex(tx.value), chainId: want, ...(tx.gas ? { gas: hex(tx.gas) } : {}) }] })) as string;
        setStatus(`Step ${i + 1} of ${txs.length} (${step}): waiting for ${chainName} to confirm…`);
        if (!(await mined(w, hash))) throw new Error(`The ${step} transaction did not confirm (${hash.slice(0, 10)}…). Check it in your wallet before trying again.`);
      }
      for (let i = 0; i < 36; i++) {
        const s = await post<{ status: string; raw: string | null }>({ action: 'perp-bridge-status', requestId: quote.requestId });
        setStatus(`Bridge: ${s.status}${s.raw && s.raw !== s.status ? ` (${s.raw})` : ''}`);
        if (['success', 'refund', 'failure', 'failed'].includes(s.status)) {
          if (s.status === 'success') { setStatus(`Deposited: ${quote.receive} ${quote.receiveName} arrived on Hyperliquid.`); onFunded(); }
          else setStatus(s.status === 'refund' ? 'The bridge refunded the USDC on the origin chain.' : 'The bridge reports a failure; check your wallet on the origin chain.');
          setQuote(null);
          return;
        }
        await new Promise((res) => setTimeout(res, 5000));
      }
      setStatus('Still bridging after three minutes; the status keeps updating on Nansen’s side. Refresh the account later.');
    } catch (e) { setErr(walletMsg(e)); setStatus(null); }
  }

  return (
    <div className="mt-3 space-y-2 border-t border-border pt-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-[12.5px] text-ink-2">Fund from<select aria-label="Deposit from chain" value={chain} onChange={(e) => { setChain(e.target.value); setQuote(null); }} className="mt-1 block rounded-lg border border-border bg-raised px-2.5 py-1.5 text-[13px] text-ink">{CHAINS.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
        <label className="text-[12.5px] text-ink-2">USDC<input aria-label="USDC to deposit" value={amount} onChange={(e) => { setAmount(e.target.value.replace(/[^\d.]/g, '')); setQuote(null); }} inputMode="decimal" placeholder="amount" className="num mt-1 block w-28 rounded-lg border border-border bg-raised px-2.5 py-1.5 text-[13px] text-ink" /></label>
        <button disabled={!(Number(amount) > 0)} onClick={getQuote} className="rounded-full border border-border px-3 py-1 text-[13px] text-ink hover:bg-raised disabled:opacity-45">Quote deposit</button>
      </div>
      {quote && (
        <div className="space-y-1 rounded-xl border border-border bg-raised/50 p-3 text-[12.5px]">
          <p className="text-ink">You send <span className="num">{quote.send}</span> USDC on {chainName}; you receive about <span className="num">{quote.receive}</span> {quote.receiveName} on Hyperliquid.</p>
          <p className="text-ink-2">{quote.feeUsdc ? `Relayer fee ${quote.feeUsdc} USDC` : 'Fee not stated'}{quote.impactPct != null ? ` · total impact ${quote.impactPct}%` : ''}{quote.seconds != null ? ` · about ${quote.seconds}s once sent` : ''} · {quote.steps.length} wallet transaction{quote.steps.length === 1 ? '' : 's'}: {quote.steps.map((s) => s.id).join(', ')}. Checked: exact amount and approval, your wallet, {chainName}, lands in perps.</p>
          {!confirming ? <button onClick={() => setConfirming(true)} className="rounded-full bg-brand/15 px-3 py-1 text-ink ring-1 ring-brand/40">Send from my wallet</button> : (
            <div role="alertdialog" aria-label="Confirm deposit" className="space-y-2 pt-1">
              <p className="text-ink-muted">Real funds. Your wallet sends each transaction on {chainName}; TIDE never signs or sends. The quote expires two minutes after it was made. Not financial advice.</p>
              <div className="flex gap-2"><button onClick={send} className="rounded-full bg-brand/20 px-3 py-1 text-ink ring-1 ring-brand/50">Confirm and open my wallet</button><button onClick={() => setConfirming(false)} className="text-ink-muted hover:text-ink">Cancel</button></div>
            </div>
          )}
        </div>
      )}
      {status && <p role="status" className="text-[12.5px] text-ink-2">{status}</p>}
      {err && <p className="text-[12.5px] text-ink">{err}</p>}
      <p className="text-[11px] text-ink-muted">Deposits come in as USDC from Base, Arbitrum, Ethereum or Polygon. Withdrawals aren&apos;t offered here: do them on Hyperliquid.</p>
    </div>
  );
}
