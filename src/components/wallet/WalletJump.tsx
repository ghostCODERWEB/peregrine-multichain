'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** Paste an address, open its profile. */
export function WalletJump() {
  const [v, setV] = useState('');
  const router = useRouter();
  const ok = /^(0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})$/.test(v.trim());
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (ok) router.push(`/wallet/${v.trim()}`); }} className="flex w-full items-center gap-2 sm:w-auto">
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder="Wallet address" aria-label="Wallet address"
        className="inset-well h-9 min-w-0 flex-1 rounded-[10px] px-3 font-mono text-[12.5px] text-ink placeholder:font-sans placeholder:text-ink-muted sm:w-80" />
      <button type="submit" disabled={!ok} className="pill-button pill-primary min-h-9 px-4 py-1.5 text-[12.5px]">Open</button>
    </form>
  );
}
