'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { chainName, shortAddress, usd, amount, walletName } from '@/lib/viz/format';
import type { TxDetail } from '@/server/token/ondemand';

export interface TxRef { chain: string; hash: string; at: string | null }

type State = { k: 'loading' } | { k: 'ok'; tx: TxDetail } | { k: 'error'; text: string };

/** One transaction's token transfers, looked up on click (1 credit,
 *  cached a week). A dialog: Esc or the backdrop closes it. */
export function TxDrawer({ tx, onClose }: { tx: TxRef; onClose: () => void }) {
  const [s, setS] = useState<State>({ k: 'loading' });
  const closeBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const ctl = new AbortController();
    const qs = new URLSearchParams({ chain: tx.chain, hash: tx.hash, ...(tx.at ? { ts: tx.at } : {}) });
    fetch(`/api/tx?${qs}`, { signal: ctl.signal })
      .then((r) => r.json() as Promise<TxDetail | { unavailable: string } | { error: string }>)
      .then((d) => setS('unavailable' in d ? { k: 'error', text: d.unavailable } : 'error' in d ? { k: 'error', text: d.error } : { k: 'ok', tx: d }))
      .catch(() => { /* aborted */ });
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { ctl.abort(); window.removeEventListener('keydown', onKey); };
  }, [tx, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-background/70 px-4 pt-[10vh] backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label="Transaction" className="w-full max-w-2xl rounded-xl border border-border bg-surface p-4 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-ink">Transaction on {chainName(tx.chain)}</h2>
            <p className="num break-all text-[11.5px] text-ink-muted">{tx.hash}</p>
          </div>
          <button ref={closeBtn} onClick={onClose} className="rounded px-2 py-1 text-sm text-ink-2 hover:bg-accent hover:text-ink" aria-label="Close">✕</button>
        </div>
        {s.k === 'loading' && <p className="mt-3 animate-pulse text-sm text-ink-muted">Looking the transaction up in Nansen…</p>}
        {s.k === 'error' && <p className="mt-3 text-sm text-ink-2">{s.text}</p>}
        {s.k === 'ok' && (
          <div className="mt-3 space-y-3 text-[12.5px]">
            <p className="text-ink-2">
              {s.tx.ok ? 'Succeeded' : 'Failed'} · {s.tx.at.replace('T', ' ').slice(0, 19)} UTC · from{' '}
              <Link href={`/wallet/${s.tx.from}`} className="text-ink hover:underline">{walletName(s.tx.fromLabel, s.tx.from)}</Link> to{' '}
              <Link href={`/wallet/${s.tx.to}`} className="text-ink hover:underline">{walletName(s.tx.toLabel, s.tx.to)}</Link>
              {s.tx.nativeValue > 0 && <> · {amount(s.tx.nativeValue)} native{s.tx.nativeUsd != null ? ` (${usd(s.tx.nativeUsd)})` : ''}</>}
            </p>
            <div className="max-h-[50vh] overflow-auto">
              <table className="w-full text-[12px]">
                <thead className="sticky top-0 bg-surface">
                  <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-ink-muted">
                    <th className="py-1.5 font-normal">Token</th><th className="py-1.5 font-normal">From</th><th className="py-1.5 font-normal">To</th><th className="py-1.5 text-right font-normal">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {s.tx.transfers.map((t, i) => (
                    <tr key={i} className="border-b border-border/50 align-top">
                      <td className="py-1.5 text-ink">{t.symbol}</td>
                      <td className="py-1.5"><Link href={`/wallet/${t.from}`} className="text-ink-2 hover:text-ink hover:underline">{walletName(t.fromLabel, t.from)}</Link></td>
                      <td className="py-1.5"><Link href={`/wallet/${t.to}`} className="text-ink-2 hover:text-ink hover:underline">{walletName(t.toLabel, t.to)}</Link></td>
                      <td className="num py-1.5 text-right text-ink">{amount(t.amount)}{t.valueUsd != null && <span className="text-ink-muted"> · {usd(t.valueUsd)}</span>}</td>
                    </tr>
                  ))}
                  {!s.tx.transfers.length && <tr><td colSpan={4} className="py-2 text-ink-muted">No token transfers in this transaction.</td></tr>}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-ink-muted">From Nansen&apos;s transaction lookup; {shortAddress(s.tx.hash)}.</p>
          </div>
        )}
      </div>
    </div>
  );
}
