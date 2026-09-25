'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Search } from 'lucide-react';
import { ChainLogo } from '@/components/Logo';
import { chainName } from '@/lib/viz/format';

type Hit = { chain: string; title: string; subtitle: string; address: string };
// EVM, Solana/base58, Sui/Aptos type paths, TON and other long ids.
const looksLikeAddress = (s: string) => /^0x[0-9a-fA-F]{40}$/.test(s) || /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s) || /^[A-Za-z0-9:._-]{40,160}$/.test(s);

/** Pick a network, then paste a token address or search by name or symbol. */
export function RugSearch({ chains }: { chains: readonly string[] }) {
  const router = useRouter();
  const [chain, setChain] = useState(chains.includes('base') ? 'base' : chains[0]);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = q.trim();
    if (!v) return;
    if (looksLikeAddress(v)) { router.push(`/rug/${chain}/${encodeURIComponent(v)}`); return; }
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`/api/search?q=${encodeURIComponent(v)}`);
      const d = await r.json() as { results?: Array<{ kind: string; chain?: string; title: string; subtitle: string; href: string }>; error?: string };
      const found = (d.results ?? []).flatMap((x) => {
        const m = x.kind === 'token' ? /^\/token\/([^/]+)\/(.+)$/.exec(x.href) : null;
        return m && chains.includes(m[1]) ? [{ chain: m[1], title: x.title, subtitle: x.subtitle, address: decodeURIComponent(m[2]) }] : [];
      });
      // The chosen network's matches first.
      found.sort((a, b) => Number(b.chain === chain) - Number(a.chain === chain));
      setHits(found);
      if (!found.length) setErr(d.error ?? `No token called “${v}” on a supported network. Paste its contract address instead.`);
    } catch { setErr('Search is unavailable right now. Paste the token’s contract address instead.'); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 text-[12.5px] font-bold text-ink-muted">Network</div>
        <div role="radiogroup" aria-label="Network" className="flex flex-wrap gap-2">
          {chains.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={chain === c} onClick={() => setChain(c)}
              className={`inline-flex h-9 items-center gap-2 rounded-full border px-3 text-[13px] font-semibold transition-colors ${chain === c ? 'border-[var(--mint)] bg-[color-mix(in_srgb,var(--mint)_14%,transparent)] text-ink' : 'border-[var(--hair)] text-ink-2 hover:text-ink'}`}>
              <ChainLogo chain={c} size={16} />{chainName(c)}
            </button>
          ))}
        </div>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
        <label className="inset-well flex h-12 flex-1 items-center gap-3 px-4">
          <Search size={18} className="shrink-0 text-ink-muted" aria-hidden />
          <span className="sr-only">Token address or symbol</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Paste a ${chainName(chain)} token address, or type a symbol`}
            className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-muted" autoComplete="off" spellCheck={false} />
        </label>
        <button type="submit" disabled={busy || !q.trim()} className="pill-button pill-primary h-12 disabled:opacity-50">{busy ? 'Searching…' : 'Check token'}</button>
      </form>
      {err && <p className="text-[13px] text-ink-2">{err}</p>}
      {hits && hits.length > 0 && (
        <ul className="divide-y divide-[var(--hair)] rounded-[18px] border border-[var(--hair)]" aria-label="Matching tokens">
          {hits.slice(0, 8).map((h) => (
            <li key={`${h.chain}:${h.address}`}>
              <Link href={`/rug/${h.chain}/${encodeURIComponent(h.address)}`} className="flex items-center gap-3 px-4 py-3 hover:bg-ink/5">
                <ChainLogo chain={h.chain} size={22} />
                <span className="min-w-0"><span className="block truncate text-[14px] font-bold text-ink">{h.title}</span><span className="block truncate text-[12.5px] text-ink-muted">{h.subtitle}</span></span>
                <span className="ml-auto shrink-0 text-[13px] font-bold text-[var(--mint)]">Check →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
