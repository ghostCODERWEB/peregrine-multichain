'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { ChainLogo } from '@/components/Logo';
import { chainName } from '@/lib/viz/format';
import { Go } from '@/components/ui/Icons';

type Hit = { chain: string; title: string; subtitle: string; address: string };
// EVM, Solana/base58, Sui/Aptos type paths, TON and other long ids.
const looksLikeAddress = (s: string) => /^0x[0-9a-fA-F]{40}$/.test(s) || /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s) || /^[A-Za-z0-9:._-]{40,160}$/.test(s);

/** One box across every network: results appear as you type; the network is only asked for an address search can't place. */
export function RugSearch({ chains, autoFocus = true, placeholder }: { chains: readonly string[]; autoFocus?: boolean; placeholder?: string }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const v = q.trim();
  const isAddr = looksLikeAddress(v);

  useEffect(() => {
    if (v.length < 2) { setHits(null); setErr(null); return; }
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      setBusy(true); setErr(null);
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(v)}`, { signal: ctl.signal });
        const d = await r.json() as { results?: Array<{ kind: string; title: string; subtitle: string; href: string }>; error?: string };
        const found = (d.results ?? []).flatMap((x) => {
          const m = x.kind === 'token' ? /^\/token\/([^/]+)\/(.+)$/.exec(x.href) : null;
          return m && chains.includes(m[1]) ? [{ chain: m[1], title: x.title, subtitle: x.subtitle, address: decodeURIComponent(m[2]) }] : [];
        });
        setHits(found);
        if (!found.length && !looksLikeAddress(v)) setErr(d.error ?? `No token called “${v}” on a supported network. Paste its contract address instead.`);
      } catch (e) { if ((e as Error).name !== 'AbortError') setErr('Search is unavailable right now. Paste the token’s contract address instead.'); }
      finally { if (!ctl.signal.aborted) setBusy(false); }
    }, 350);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [v, chains]);

  // An unmatched address: EVM addresses exist on many chains, so the viewer picks; others are Solana-style.
  const addrChains = isAddr && hits && !hits.length && !busy ? (v.startsWith('0x') ? chains.filter((c) => c !== 'solana' && c !== 'ton' && c !== 'tron' && c !== 'sui' && c !== 'near' && c !== 'starknet') : chains.filter((c) => c === 'solana')) : [];

  return (
    <div className="space-y-4">
      <form onSubmit={(e) => { e.preventDefault(); const h = hits?.[0]; if (h) router.push(`/token/${h.chain}/${encodeURIComponent(h.address)}`); else if (addrChains.length === 1) router.push(`/token/${addrChains[0]}/${encodeURIComponent(v)}`); }}>
        <label className="inset-well flex h-12 items-center gap-3 rounded-full px-4 transition-shadow focus-within:shadow-[0_0_0_2px_rgba(31,224,163,.5),0_0_24px_-6px_rgba(31,224,163,.45)]">
          {busy ? <Loader2 size={18} className="shrink-0 animate-spin text-[var(--mint)]" aria-hidden /> : <Search size={18} className="shrink-0 text-ink-muted" aria-hidden />}
          <span className="sr-only">Token name, symbol or address</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder ?? `Token name, symbol or address · ${chains.length} networks`} autoFocus={autoFocus}
            className="bare-input min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-muted" autoComplete="off" spellCheck={false} />
        </label>
      </form>
      {err && <p className="text-[13px] text-ink-2">{err}</p>}
      {addrChains.length > 0 && (
        <div>
          <div className="mb-2 text-[12.5px] font-bold text-ink-muted">Which network is this address on?</div>
          <div className="flex flex-wrap gap-2">
            {addrChains.map((c) => (
              <Link key={c} href={`/token/${c}/${encodeURIComponent(v)}`} className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--hair)] px-3 text-[13px] font-semibold text-ink-2 hover:border-[var(--mint)] hover:text-ink">
                <ChainLogo chain={c} size={16} />{chainName(c)}
              </Link>
            ))}
          </div>
        </div>
      )}
      {hits && hits.length > 0 && (
        <ul className="divide-y divide-[var(--hair)] rounded-[18px] border border-[var(--hair)]" aria-label="Matching tokens">
          {hits.slice(0, 8).map((h) => (
            <li key={`${h.chain}:${h.address}`}>
              <Link href={`/token/${h.chain}/${encodeURIComponent(h.address)}`} className="flex items-center gap-3 px-4 py-3 hover:bg-ink/5">
                <ChainLogo chain={h.chain} size={22} />
                <span className="min-w-0"><span className="block truncate text-[14px] font-bold text-ink">{h.title}</span><span className="block truncate text-[12.5px] text-ink-muted">{h.subtitle}</span></span>
                <span className="ml-auto shrink-0 text-[13px] font-bold text-[var(--mint)]">Open <Go /></span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
