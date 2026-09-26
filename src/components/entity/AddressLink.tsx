'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { shortAddress } from '@/lib/viz/format';

/** A wallet, shown by its Nansen label when it has one, always with the
 *  address beneath or beside it. Opens the Profiler; the copy action copies
 *  the full address. Never invents a label: none means the address alone. */
export function AddressLink({ address, label, compact = false, className = '' }: { address: string; label?: string | null; compact?: boolean; className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try { await navigator.clipboard.writeText(address); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch { /* clipboard blocked */ }
  };
  const clean = label && !/^\[.*\]$/.test(label.trim()) ? label.trim() : null;
  return (
    <span className={`group/addr inline-flex min-w-0 max-w-full items-center gap-1 ${className}`}>
      <Link href={`/wallet/${encodeURIComponent(address)}`} title={`${clean ? `${clean}\n` : ''}${address}\nOpen in Profiler`} onClick={(e) => e.stopPropagation()}
        className="min-w-0 truncate rounded-[4px] hover:text-ink hover:underline hover:underline-offset-2">
        {clean ? (
          <>
            <span className="font-semibold text-ink">{clean}</span>
            {!compact && <span className="ml-1.5 font-mono text-[11px] text-ink-muted">{shortAddress(address)}</span>}
          </>
        ) : (
          <span className="font-mono text-[12px] text-ink-2">{shortAddress(address)}</span>
        )}
      </Link>
      <button type="button" onClick={copy} aria-label={`Copy address ${address}`}
        className="grid h-5 w-5 shrink-0 place-items-center rounded text-ink-muted opacity-0 transition-opacity hover:text-ink focus-visible:opacity-100 group-hover/addr:opacity-100">
        {copied ? <Check className="h-3 w-3" aria-hidden /> : <Copy className="h-3 w-3" aria-hidden />}
      </button>
    </span>
  );
}
