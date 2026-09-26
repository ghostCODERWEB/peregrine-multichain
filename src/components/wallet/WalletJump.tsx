'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** Paste an address or an ENS name, open its profile. */
export function WalletJump() {
  const [v, setV] = useState('');
  const router = useRouter();
  // An address, or an ENS name (the wallet route resolves it).
  const ok = /^(0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44}|[a-z0-9-]+(\.[a-z0-9-]+)*\.eth)$/i.test(v.trim());
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (ok) router.push(`/wallet/${v.trim()}`); }} className="flex w-full items-center gap-2 sm:w-auto">
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder="Address or name.eth" aria-label="Wallet address or ENS name"
        className="inset-well h-9 min-w-0 flex-1 rounded-[10px] px-3 font-mono text-[12.5px] text-ink placeholder:font-sans placeholder:text-ink-muted sm:w-80" />
      <button type="submit" disabled={!ok} className="pill-button pill-primary min-h-9 px-4 py-1.5 text-[12.5px]">Open</button>
    </form>
  );
}
