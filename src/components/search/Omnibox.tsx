'use client';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { detectAddress, FAMILY_NAMES } from '@/lib/address-family';
import { COMMANDS, parseCommand } from '@/lib/commands';
import type { SearchResponse, ResultKind } from '@/server/search/omnibox';
import type { CommandAnswer, CommandPreview } from '@/server/search/commands';

const KIND: Record<ResultKind, string> = { token: 'Token', wallet: 'Wallet', entity: 'Entity', chain: 'Chain', sector: 'Sector', note: 'Note' };
interface Item { key: string; kind: string; title: string; subtitle: string; badge?: string; disabled?: boolean; pick: () => void }

/**
 * ⌘K / Ctrl+K (or "/") search across tokens, entities, chains, sectors and
 * wallets, and commands (L5): "/" lists them; "/who-bought AERO 6h" or "who
 * bought $AERO last 6h" previews what it will do and what it costs, and runs
 * the one priced call only on Enter. Keyboard first: ↑/↓ move, Enter opens,
 * Esc closes.
 */
export function Omnibox() {
  const router = useRouter();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [res, setRes] = useState<SearchResponse | null>(null);
  const [preview, setPreview] = useState<CommandPreview | null>(null);
  const [answer, setAnswer] = useState<CommandAnswer | null>(null);
  const [cmdError, setCmdError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const query = q.trim();
  const commandMode = query.startsWith('/') || parseCommand(query) !== null;

  const close = useCallback(() => {
    setOpen(false);
    setQ(''); setRes(null); setPreview(null); setAnswer(null); setCmdError(null); setActive(0);
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

  // Typing never spends: search and command previews use Nansen's free search.
  useEffect(() => {
    setAnswer(null); setCmdError(null);
    if (!open || !query) { setRes(null); setPreview(null); return; }
    const ctl = new AbortController();
    const t = setTimeout(() => {
      setLoading(true);
      const url = commandMode ? `/api/command?${new URLSearchParams({ q: query, ctx: path ?? '/' })}` : `/api/search?q=${encodeURIComponent(query)}`;
      fetch(url, { signal: ctl.signal })
        .then((r) => r.json())
        .then((d) => { if (commandMode) setPreview((d as { preview: CommandPreview | null }).preview); else setRes(d as SearchResponse); setActive(0); })
        .catch(() => { /* aborted or offline: keep the last results */ })
        .finally(() => setLoading(false));
    }, 180);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [query, open, commandMode, path]);

  function nav(href: string) { close(); router.push(href); }
  async function run() {
    setLoading(true); setCmdError(null);
    try {
      const r = await fetch('/api/command', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ q: query, ctx: path ?? '/', confirmCredits: 1 }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'The command failed.');
      setAnswer(j.answer); setActive(1);
    } catch (e) { setCmdError((e as Error).message); } finally { setLoading(false); }
  }

  let items: Item[] = [];
  if (!commandMode) {
    const results = res?.query === query ? res.results : res?.results ?? [];
    items = results.map((r) => ({ key: `${r.kind}:${r.href ?? r.title}`, kind: KIND[r.kind], title: r.title, subtitle: r.subtitle, disabled: !r.href, pick: () => { if (r.href) nav(r.href); } }));
  } else if (!preview || preview.command.kind === 'help') {
    const typed = query.split(' ')[0].toLowerCase();
    items = COMMANDS.filter((c) => typed === '/' || c.usage.toLowerCase().startsWith(typed) || !typed.startsWith('/')).map((c) => ({
      key: c.usage, kind: 'Command', title: c.usage, subtitle: c.does, badge: c.cost, pick: () => { setQ(`${c.usage.split(' ')[0]} `); input.current?.focus(); },
    }));
  } else {
    const p = preview;
    items = [{
      key: 'preview', kind: p.cost ? 'Run' : 'Open', title: p.title,
      subtitle: p.problem ?? (answer ? `Answered below: ${answer.rows.length} wallet${answer.rows.length === 1 ? '' : 's'}. Enter runs it again.` : p.cost ? 'Enter runs it; the answer appears here.' : 'Enter opens it.'),
      badge: p.problem ? undefined : answer ? `spent ${answer.credits}` : p.cost ? `${p.cost} credit` : 'free', disabled: !!p.problem,
      pick: () => { if (p.problem) return; if (p.href) nav(p.href); else if (p.cost) void run(); },
    }];
    if (answer) items.push(...answer.rows.map((r) => ({ key: r.href, kind: 'Wallet', title: r.label ?? `${r.address.slice(0, 6)}…${r.address.slice(-4)}`, subtitle: r.label ? `${r.address.slice(0, 6)}…${r.address.slice(-4)} · ${r.detail}` : r.detail, pick: () => nav(r.href) })));
  }
  const families = !commandMode ? [...new Set(detectAddress(q).map((f) => FAMILY_NAMES[f.family]))] : [];

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, Math.max(0, items.length - 1))); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); (items[active] ?? items.find((i) => !i.disabled))?.pick(); }
  }

  return (
    <>
      <button ref={trigger} type="button" onClick={() => setOpen(true)} aria-label="Search tokens, wallets, entities, chains and sectors"
        className="flex h-8 items-center gap-2 rounded-md border border-border bg-raised px-2 text-[12px] text-ink-muted hover:border-axis hover:text-ink lg:h-9 lg:w-full lg:px-2.5">
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
        <span className="hidden lg:inline">Search token, wallet…</span>
        <kbd className="hidden rounded border border-border px-1 text-[10px] lg:ml-auto lg:inline">⌘K</kbd>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-page/80 px-4 pt-[12vh]" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div role="dialog" aria-modal="true" aria-label="Search" className="mx-auto w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl">
            <div className="flex items-center gap-2 border-b border-border px-3">
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className="shrink-0 text-ink-muted"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
              <input
                ref={input} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onInputKey}
                role="combobox" aria-expanded={items.length > 0} aria-controls={listId} aria-autocomplete="list"
                aria-activedescendant={items[active] ? `${listId}-${active}` : undefined}
                placeholder="Token, wallet, entity, chain, sector… or / for commands"
                className="h-12 w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-muted"
                spellCheck={false} autoComplete="off"
              />
              {loading && <span className="text-[11px] text-ink-muted" aria-live="polite">{answer || !commandMode ? 'searching…' : 'working…'}</span>}
            </div>
            {families.length > 0 && <p className="border-b border-border px-3 py-1.5 text-[11.5px] text-ink-2">Looks like {families.join(' or ')} address</p>}
            <ul id={listId} role="listbox" aria-label="Results" className="max-h-[50vh] overflow-y-auto py-1">
              {items.map((r, i) => (
                <li key={r.key} id={`${listId}-${i}`} role="option" aria-selected={i === active} aria-disabled={r.disabled}
                  onMouseEnter={() => setActive(i)} onMouseDown={(e) => { e.preventDefault(); r.pick(); }}
                  className={`flex cursor-pointer items-center gap-3 px-3 py-2 ${i === active ? 'bg-accent' : ''} ${r.disabled ? 'cursor-default opacity-80' : ''}`}>
                  <span className="w-14 shrink-0 text-[10.5px] uppercase tracking-wider text-ink-muted">{r.kind}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] text-ink">{r.title}</span>
                    <span className="block truncate text-[11.5px] text-ink-muted">{r.subtitle}</span>
                  </span>
                  {r.badge && <span className="num shrink-0 rounded border border-border px-2 py-0.5 text-[10.5px] text-ink-2">{r.badge}</span>}
                </li>
              ))}
              {!commandMode && query && !loading && res && !items.length && (
                <li className="px-3 py-3 text-[13px] text-ink-2">{res.error ?? 'Nansen’s search found nothing for that.'}</li>
              )}
              {cmdError && <li className="px-3 py-3 text-[13px] text-ink" role="alert">{cmdError}</li>}
              {answer && (
                <li className="border-t border-border px-3 py-2 text-[11px] text-ink-muted">
                  {answer.recordedNote ? `${answer.recordedNote} ` : ''}{answer.rows.length ? `${answer.rows.length} wallet${answer.rows.length === 1 ? '' : 's'}` : 'Nansen returned no wallets for this'} · {answer.call.endpoint} · {answer.credits} credit{answer.credits === 1 ? '' : 's'}{answer.call.ref === 'cache' ? ' (cached)' : ''}. Labels appear for the key owner and members.
                </li>
              )}
              {!query && (
                <li className="px-3 py-3 text-[12.5px] text-ink-muted">Try “aero”, “Wintermute”, “base”, “AI”, paste any address, or type <b>/</b> for commands like “who bought $AERO last 6h”.</li>
              )}
            </ul>
            <div className="flex justify-between border-t border-border px-3 py-1.5 text-[10.5px] text-ink-muted">
              <span>↑↓ move · Enter open · Esc close</span>
              <span>{commandMode ? 'Nothing is charged until Enter' : 'Search by Nansen API'}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
