'use client';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { detectAddress, FAMILY_NAMES } from '@/lib/address-family';
import type { SearchResponse, SearchResult, ResultKind } from '@/server/search/omnibox';

const KIND: Record<ResultKind, string> = { token: 'Token', wallet: 'Wallet', entity: 'Entity', chain: 'Chain', sector: 'Sector', note: 'Note' };

/**
 * ⌘K / Ctrl+K (or "/") search across tokens, entities, chains, sectors and
 * wallets. Keyboard first: ↑/↓ move, Enter opens, Esc closes. The address
 * family is recognized instantly in the browser; Nansen's search fills in
 * the rest.
 */
export function Omnibox() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [res, setRes] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const listId = useId();

  const close = useCallback(() => {
    setOpen(false);
    setQ(''); setRes(null); setActive(0);
    trigger.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName));
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen((o) => !o); }
      else if (e.key === '/' && !typing && !open) { e.preventDefault(); setOpen(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => { if (open) input.current?.focus(); }, [open]);

  useEffect(() => {
    const query = q.trim();
    if (!open || !query) { setRes(null); return; }
    const ctl = new AbortController();
    const t = setTimeout(() => {
      setLoading(true);
      fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: ctl.signal })
        .then((r) => r.json() as Promise<SearchResponse>)
        .then((d) => { setRes(d); setActive(0); })
        .catch(() => { /* aborted or offline: keep the last results */ })
        .finally(() => setLoading(false));
    }, 180);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q, open]);

  const results: SearchResult[] = res?.query === q.trim() ? res.results : res?.results ?? [];
  const families = [...new Set(detectAddress(q).map((f) => FAMILY_NAMES[f.family]))];

  function go(r: SearchResult | undefined) {
    if (!r?.href) return;
    close();
    router.push(r.href);
  }

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, Math.max(0, results.length - 1))); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); go(results[active] ?? results.find((r) => r.href)); }
  }

  return (
    <>
      <button ref={trigger} type="button" onClick={() => setOpen(true)} aria-label="Search tokens, wallets, entities, chains and sectors"
        className="flex items-center gap-2 rounded-md border border-border px-2 py-1 text-[12px] text-ink-muted hover:bg-accent hover:text-ink lg:w-full lg:rounded-lg lg:bg-background/40 lg:px-2.5 lg:py-2">
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
        <span className="hidden lg:inline">Search tokens, wallets…</span>
        <kbd className="hidden rounded border border-border px-1 text-[10px] lg:ml-auto lg:inline">⌘K</kbd>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-background/70 px-4 pt-[12vh] backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div role="dialog" aria-modal="true" aria-label="Search" className="glass mx-auto w-full max-w-xl overflow-hidden rounded-2xl shadow-2xl">
            <div className="flex items-center gap-2 border-b border-border px-3">
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className="shrink-0 text-ink-muted"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
              <input
                ref={input} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onInputKey}
                role="combobox" aria-expanded={results.length > 0} aria-controls={listId} aria-autocomplete="list"
                aria-activedescendant={results[active] ? `${listId}-${active}` : undefined}
                placeholder="Token, wallet or contract address, entity, chain, sector…"
                className="h-12 w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-muted"
                spellCheck={false} autoComplete="off"
              />
              {loading && <span className="text-[11px] text-ink-muted" aria-live="polite">searching…</span>}
            </div>
            {families.length > 0 && <p className="border-b border-border px-3 py-1.5 text-[11.5px] text-ink-2">Looks like {families.join(' or ')} address</p>}
            <ul id={listId} role="listbox" aria-label="Results" className="max-h-[50vh] overflow-y-auto py-1">
              {results.map((r, i) => (
                <li key={`${r.kind}:${r.href ?? r.title}`} id={`${listId}-${i}`} role="option" aria-selected={i === active} aria-disabled={!r.href}
                  onMouseEnter={() => setActive(i)} onMouseDown={(e) => { e.preventDefault(); go(r); }}
                  className={`flex cursor-pointer items-center gap-3 px-3 py-2 ${i === active ? 'bg-accent' : ''} ${r.href ? '' : 'cursor-default opacity-80'}`}>
                  <span className="w-14 shrink-0 text-[10.5px] uppercase tracking-wider text-ink-muted">{KIND[r.kind]}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] text-ink">{r.title}</span>
                    <span className="block truncate text-[11.5px] text-ink-muted">{r.subtitle}</span>
                  </span>
                </li>
              ))}
              {q.trim() && !loading && res && !results.length && (
                <li className="px-3 py-3 text-[13px] text-ink-2">{res.error ?? 'Nansen’s search found nothing for that.'}</li>
              )}
              {!q.trim() && (
                <li className="px-3 py-3 text-[12.5px] text-ink-muted">Try “aero”, “Wintermute”, “base”, “AI”, or paste any address (EVM, Solana, Bitcoin, Sui, TON, Tron, NEAR…).</li>
              )}
            </ul>
            <div className="flex justify-between border-t border-border px-3 py-1.5 text-[10.5px] text-ink-muted">
              <span>↑↓ move · Enter open · Esc close</span>
              <span>Search by Nansen API</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
