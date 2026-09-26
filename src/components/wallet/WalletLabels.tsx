'use client';
import { useEffect, useState } from 'react';
import { Card, Unavailable } from '@/components/Card';

export function WalletLabels({ address, enabled }: { address: string; enabled: boolean }) {
  const [labels, setLabels] = useState<string[] | null>(null), [error, setError] = useState('');
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    setLabels(null); setError('');
    fetch('/api/wallet/labels', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address, chain: 'all', premium: false, confirmCredits: 100 }) })
      .then(async (r) => { const data = await r.json(); if (!r.ok) throw new Error(data.error ?? 'Label lookup failed.'); if (live) setLabels(data.labels.map((l: { label: string }) => l.label)); })
      .catch((e) => { if (live) setError((e as Error).message); });
    return () => { live = false; };
  }, [address, enabled]);
  if (!enabled) return null;
  return (
    <Card id="wallet-labels" title="Nansen wallet labels">
      <div aria-live="polite">
        {error && <Unavailable text={error} />}
        {!labels && !error && <p className="text-[12.5px] text-ink-muted">Reading labels…</p>}
        {labels && (labels.length ? <ul className="flex flex-wrap gap-1.5">{labels.map((l, i) => <li key={i} className="rounded-[6px] border border-[var(--hair)] px-2.5 py-1 text-[12px] text-ink">{l}</li>)}</ul> : <p className="text-[12.5px] text-ink-muted">Nansen has no labels for this address.</p>)}
      </div>
    </Card>
  );
}
