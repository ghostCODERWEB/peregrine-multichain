'use client';
// The token page's top bar (the design's breadcrumb and action buttons):
// Radar › chain › symbol on the left; Watch and Share for everyone, and the
// owner's Alert and Trade (public sites leave those out: they need an
// account or a wallet).
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSite } from '@/components/SiteContext';
import { nansenToken } from '@/config/external';
import { NansenButton } from '@/components/shell/GetNansen';
import { Bookmark, Share2, Bell, ArrowLeftRight, ChevronRight, Check } from 'lucide-react';
import { ChainLogo } from '@/components/Logo';
import { chainName } from '@/lib/viz/format';
import { isWatched, toggleWatch } from '@/lib/watchlist';

export function TokenActions({ chain, address, symbol, owner }: { chain: string; address: string; symbol: string | null; owner: boolean }) {
  const { accounts } = useSite();
  const [watching, setWatching] = useState(false);
  const [shared, setShared] = useState<string | null>(null);
  useEffect(() => { setWatching(isWatched(chain, address)); }, [chain, address]);

  async function share() {
    const url = window.location.href.split('#')[0];
    try {
      if (navigator.share) { await navigator.share({ title: `${symbol ?? 'Token'} on Peregrine`, url }); return; }
      await navigator.clipboard.writeText(url);
      setShared('Link copied');
    } catch { setShared(null); return; }
    setTimeout(() => setShared(null), 2000);
  }

  const icon = 'grid h-10 w-10 place-items-center rounded-[12px] border border-[var(--hair)] bg-ink/5 text-ink-2 hover:text-ink';
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-[13px] font-semibold text-ink-muted">
        <Link prefetch={false} href="/" className="hover:text-ink">Overview</Link>
        <ChevronRight size={13} aria-hidden />
        <Link prefetch={false} href={`/chain/${chain}`} className="flex items-center gap-1.5 hover:text-ink"><ChainLogo chain={chain} size={15} />{chainName(chain)}</Link>
        <ChevronRight size={13} aria-hidden />
        <span className="truncate text-ink" aria-current="page">{symbol ?? 'Token'}</span>
      </nav>
      <div className="flex items-center gap-2">
        {shared && <span role="status" className="text-[12px] font-semibold text-[var(--mint)]">{shared}</span>}
        <button type="button" onClick={() => setWatching(toggleWatch({ chain, address, symbol }))} aria-pressed={watching}
          aria-label={watching ? 'Remove from watchlist' : 'Add to watchlist'} title={watching ? 'Watching: listed on your Desk' : 'Watch: list it on your Desk'} className={icon}>
          {watching ? <Check size={17} className="text-[var(--mint)]" aria-hidden /> : <Bookmark size={17} aria-hidden />}
        </button>
        <button type="button" onClick={share} aria-label="Share this token" className={icon}><Share2 size={17} aria-hidden /></button>
        <NansenButton href={nansenToken(chain, address)} label="Open in Nansen" size="sm" logo={false} />
        {owner && accounts && <a href="#alerts-tools" aria-label="Set a risk alert" className={icon}><Bell size={17} aria-hidden /></a>}
        {owner && accounts && <Link prefetch={false} href={`/trade?chain=${chain}&token=${encodeURIComponent(address)}`} className="inline-flex h-10 items-center gap-2 rounded-[12px] px-4 text-[14px] font-extrabold text-[#040507]" style={{ background: 'var(--mint)' }}><ArrowLeftRight size={16} aria-hidden />Trade</Link>}
      </div>
    </div>
  );
}
