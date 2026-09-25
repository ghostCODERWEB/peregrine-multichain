'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { ChainLogo, TokenLogo } from '@/components/Logo';
import { chainName, shortAddress } from '@/lib/viz/format';
import { watchlist, toggleWatch, type Watched } from '@/lib/watchlist';

/** Tokens this visitor watches (saved in this browser from token pages). */
export function WatchlistCard() {
  const [list, setList] = useState<Watched[]>([]);
  useEffect(() => {
    const read = () => setList(watchlist());
    read();
    window.addEventListener('peregrine-watchlist', read);
    window.addEventListener('storage', read);
    return () => { window.removeEventListener('peregrine-watchlist', read); window.removeEventListener('storage', read); };
  }, []);
  if (!list.length) return null;
  return (
    <section aria-labelledby="watch-title" className="material p-5 sm:p-6">
      <h2 id="watch-title" className="t-section">Watching {list.length} token{list.length === 1 ? '' : 's'}</h2>
      <p className="mt-1 text-[13.5px] text-ink-muted">Saved in this browser from the token pages’ bookmark button.</p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {list.map((w) => (
          <li key={`${w.chain}:${w.address}`} className="inline-flex items-center gap-1 rounded-full border border-[var(--hair)] bg-ink/5 py-1 pl-1.5 pr-1">
            <Link href={`/token/${w.chain}/${encodeURIComponent(w.address)}`} className="inline-flex items-center gap-2 px-1 text-[13px] font-bold text-ink hover:underline">
              <TokenLogo symbol={w.symbol ?? '?'} size={20} /><span>{w.symbol ?? shortAddress(w.address)}</span><ChainLogo chain={w.chain} size={13} /><span className="sr-only">on {chainName(w.chain)}</span>
            </Link>
            <Link href={`/rug/${w.chain}/${encodeURIComponent(w.address)}`} className="rounded-full px-2 py-0.5 text-[11.5px] font-semibold text-ink-muted hover:text-ink">Rug check</Link>
            <button type="button" aria-label={`Stop watching ${w.symbol ?? w.address}`} onClick={() => toggleWatch(w)} className="grid h-6 w-6 place-items-center rounded-full text-ink-muted hover:bg-ink/10 hover:text-ink"><X size={13} aria-hidden /></button>
          </li>
        ))}
      </ul>
    </section>
  );
}
