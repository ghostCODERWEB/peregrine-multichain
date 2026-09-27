'use client';
import { createPortal } from 'react-dom';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, CornerDownLeft, Loader2, Search, X } from 'lucide-react';
import { ChainLogo, TokenLogo } from '@/components/Logo';
import { readRecent, type RecentItem } from '@/components/shell/recent';
import { usePathname, useRouter } from 'next/navigation';
import { detectAddress, FAMILY_NAMES } from '@/lib/address-family';
import { COMMANDS, parseCommand } from '@/lib/commands';
import type { SearchResponse, ResultKind } from '@/server/search/omnibox';
import type { CommandAnswer, CommandPreview } from '@/server/search/commands';

const KIND: Record<ResultKind, string> = {
  token: 'Token',
  wallet: 'Wallet',
  entity: 'Entity',
  chain: 'Chain',
  sector: 'Sector',
  note: 'Note',
};
interface Item {
  key: string;
  kind: string;
  chain?: string;
  symbol?: string;
  title: string;
  subtitle: string;
  badge?: string;
  disabled?: boolean;
  pick: () => void;
}

/**
 * ⌘K / Ctrl+K (or "/") search across tokens, entities, chains, sectors and
 * wallets, and commands (L5): "/" lists them; "/who-bought AERO 6h" or "who
 * bought $AERO last 6h" previews what it will do and what it costs, and runs
 * the one priced call only on Enter. Keyboard first: ↑/↓ move, Enter opens,
 * Esc closes.
 */
const SUGGESTIONS = ['aero', 'Wintermute', 'base', 'PUMP', '/who bought $AERO last 6h'];

export function Omnibox() {
  const router = useRouter();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [recent, setRecent] = useState<RecentItem[]>([]);
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
    setQ('');
    setRes(null);
    setPreview(null);
    setAnswer(null);
    setCmdError(null);
    setActive(0);
    trigger.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing =
        e.target instanceof HTMLElement && (e.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName));
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === '/' && !typing && !open) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (open) setRecent(readRecent());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const trap = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        input.current?.focus();
      }
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', trap);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', trap);
    };
  }, [open, close]);

  // Typing never spends: search and command previews use Nansen's free search.
  useEffect(() => {
    setAnswer(null);
    setCmdError(null);
    if (!open || !query) {
      setRes(null);
      setPreview(null);
      return;
    }
    const ctl = new AbortController();
    const t = setTimeout(() => {
      setLoading(true);
      const url = commandMode
        ? `/api/command?${new URLSearchParams({ q: query, ctx: path ?? '/' })}`
        : `/api/search?q=${encodeURIComponent(query)}`;
      fetch(url, { signal: ctl.signal })
        .then((r) => r.json())
        .then((d) => {
          if (commandMode) setPreview((d as { preview: CommandPreview | null }).preview);
          else setRes(d as SearchResponse);
          setActive(0);
        })
        .catch(() => {
          /* aborted or offline: keep the last results */
        })
        .finally(() => setLoading(false));
    }, 180);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [query, open, commandMode, path]);

  function nav(href: string) {
    close();
    router.push(href);
  }
  async function run() {
    setLoading(true);
    setCmdError(null);
    try {
      const r = await fetch('/api/command', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ q: query, ctx: path ?? '/', confirmCredits: 1 }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'The command failed.');
      setAnswer(j.answer);
      setActive(1);
    } catch (e) {
      setCmdError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  let items: Item[] = [];
  if (!commandMode) {
    const results = res?.query === query ? res.results : (res?.results ?? []);
    items = results.map((r) => ({
      key: `${r.kind}:${r.href ?? r.title}`,
      kind: KIND[r.kind],
      chain: r.chain,
      symbol: r.symbol,
      title: r.title,
      subtitle: r.subtitle,
      disabled: !r.href,
      pick: () => {
        if (r.href) nav(r.href);
      },
    }));
  } else if (!preview || preview.command.kind === 'help') {
    const typed = query.split(' ')[0].toLowerCase();
    items = COMMANDS.filter((c) => typed === '/' || c.usage.toLowerCase().startsWith(typed) || !typed.startsWith('/')).map((c) => ({
      key: c.usage,
      kind: 'Command',
      title: c.usage,
      subtitle: c.does,
      badge: c.cost,
      pick: () => {
        setQ(`${c.usage.split(' ')[0]} `);
        input.current?.focus();
      },
    }));
  } else {
    const p = preview;
    items = [
      {
        key: 'preview',
        kind: p.cost ? 'Run' : 'Open',
        title: p.title,
        subtitle:
          p.problem ??
          (answer
            ? `Answered below: ${answer.rows.length} wallet${answer.rows.length === 1 ? '' : 's'}. Enter runs it again.`
            : p.cost
              ? 'Enter runs it; the answer appears here.'
              : 'Enter opens it.'),
        badge: p.problem ? undefined : answer ? `spent ${answer.credits}` : p.cost ? `${p.cost} credit` : 'free',
        disabled: !!p.problem,
        pick: () => {
          if (p.problem) return;
          if (p.href) nav(p.href);
          else if (p.cost) void run();
        },
      },
    ];
    if (answer)
      items.push(
        ...answer.rows.map((r) => ({
          key: r.href,
          kind: 'Wallet',
          title: r.label ?? `${r.address.slice(0, 6)}…${r.address.slice(-4)}`,
          subtitle: r.label ? `${r.address.slice(0, 6)}…${r.address.slice(-4)} · ${r.detail}` : r.detail,
          pick: () => nav(r.href),
        })),
      );
  }
  const families = !commandMode ? [...new Set(detectAddress(q).map((f) => FAMILY_NAMES[f.family]))] : [];

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, Math.max(0, items.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      (items[active] ?? items.find((i) => !i.disabled))?.pick();
    }
  }

  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search tokens, wallets, entities, chains and sectors"
        className="liquid-chip liquid-control hidden h-8 items-center gap-2 rounded-xl px-2 text-[12px] text-ink-muted hover:text-ink lg:flex lg:h-9 lg:w-full lg:px-2.5"
      >
        <Search className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden />
        <span className="hidden lg:inline">Search</span>
        <kbd className="kbd !hidden lg:ml-auto lg:!inline-flex">⌘K</kbd>
      </button>

      {open &&
        createPortal(
          <div
            className="spotlight-backdrop fixed inset-0 z-50 bg-black/45 px-3 pt-[10vh] backdrop-blur-md sm:px-4 sm:pt-[14vh]"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) close();
            }}
          >
            <div role="dialog" aria-modal="true" aria-label="Search" className="spotlight material-strong relative mx-auto w-full max-w-[680px] overflow-hidden rounded-[22px]">
              <div className="flex h-[62px] items-center gap-3 px-5">
                <Search className="h-5 w-5 shrink-0 text-ink-muted" strokeWidth={2} aria-hidden />
                <input
                  ref={input}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={onInputKey}
                  role="combobox"
                  aria-expanded={items.length > 0}
                  aria-controls={listId}
                  aria-autocomplete="list"
                  aria-activedescendant={items[active] ? `${listId}-${active}` : undefined}
                  aria-label="Search Peregrine"
                  placeholder="Search tokens, wallets, chains, sectors"
                  className="h-full min-w-0 flex-1 bg-transparent text-[19px] font-medium tracking-[-0.015em] text-ink placeholder:text-ink-muted focus-visible:shadow-none focus-visible:outline-none"
                  spellCheck={false}
                  autoComplete="off"
                />
                {loading ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-ink-muted" aria-label={answer || !commandMode ? 'Searching' : 'Working'} />
                ) : (
                  q && (
                    <button type="button" onClick={() => { setQ(''); input.current?.focus(); }} aria-label="Clear search" className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink/10 text-ink-2 transition-colors hover:bg-ink/20 hover:text-ink">
                      <X className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden />
                    </button>
                  )
                )}
              </div>
              <div className="h-px bg-[var(--hair)]" />
              {families.length > 0 && <p className="px-5 pt-3 text-[12.5px] text-ink-2">Looks like {families.join(' or ')} address</p>}
              <ul id={listId} role="listbox" aria-label="Results" className="max-h-[min(56vh,480px)] overflow-y-auto p-2">
                {items.map((r, i) => (
                  <li
                    key={r.key}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={i === active}
                    aria-disabled={r.disabled}
                    onMouseEnter={() => setActive(i)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      r.pick();
                    }}
                    className={`flex min-h-[52px] cursor-pointer items-center gap-3 rounded-[12px] px-3 py-2 transition-colors duration-[var(--dur-fast)] ${i === active ? 'bg-[color-mix(in_srgb,var(--ink-1)_8%,transparent)]' : ''} ${r.disabled ? 'cursor-default opacity-70' : ''}`}
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-[color-mix(in_srgb,var(--ink-1)_6%,transparent)]">
                      {r.symbol ? <TokenLogo symbol={r.symbol} size={20} /> : r.chain ? <ChainLogo chain={r.chain} size={18} /> : <Search className="h-3.5 w-3.5 text-ink-muted" aria-hidden />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14.5px] font-semibold text-ink">{r.title}</span>
                      <span className="block truncate text-[12.5px] text-ink-muted">{r.subtitle}</span>
                    </span>
                    {r.badge && <span className="num shrink-0 text-[12px] text-ink-2">{r.badge}</span>}
                    <span className="shrink-0 text-[11.5px] font-medium capitalize text-ink-muted">{r.kind}</span>
                    <CornerDownLeft className={`h-3.5 w-3.5 shrink-0 text-ink-muted transition-opacity ${i === active ? 'opacity-100' : 'opacity-0'}`} aria-hidden />
                  </li>
                ))}
                {!commandMode && query && !loading && res && !items.length && (
                  <li className="px-3 py-6 text-center text-[13.5px] text-ink-2">{res.error ?? 'No matches in Nansen’s search.'}</li>
                )}
                {cmdError && (
                  <li className="px-3 py-3 text-[13.5px] text-ink" role="alert">
                    {cmdError}
                  </li>
                )}
                {answer && (
                  <li className="mt-1 border-t border-[var(--hair)] px-3 pt-2.5 text-[12px] text-ink-muted">
                    {answer.recordedNote ? `${answer.recordedNote} ` : ''}
                    {answer.rows.length ? `${answer.rows.length} wallet${answer.rows.length === 1 ? '' : 's'}` : 'Nansen returned no wallets for this'} · {answer.call.endpoint} ·{' '}
                    {answer.credits} credit{answer.credits === 1 ? '' : 's'}
                    {answer.call.ref === 'cache' ? ' (cached)' : ''}. Labels appear for the key owner and members.
                  </li>
                )}
                {!query && recent.length > 0 && (
                  <li className="px-1 pb-2">
                    <p className="px-2 pb-1 pt-1 text-[12px] font-semibold text-ink-muted">Recent</p>
                    {recent.slice(0, 5).map((r) => (
                      <button key={r.href} type="button" onClick={() => { close(); router.push(r.href); }}
                        className="flex min-h-[40px] w-full items-center justify-between gap-3 rounded-[10px] px-3 text-left text-[13.5px] transition-colors hover:bg-[color-mix(in_srgb,var(--ink-1)_8%,transparent)]">
                        <span className="min-w-0 truncate font-semibold text-ink">{r.title}</span>
                        <span className="shrink-0 text-[11.5px] text-ink-muted">{r.kind}</span>
                      </button>
                    ))}
                  </li>
                )}
                {!query && (
                  <li className="px-1 pb-1">
                    <p className="px-2 pb-1.5 pt-1 text-[12px] font-semibold text-ink-muted">Try</p>
                    <div className="flex flex-wrap gap-1.5 px-1">
                      {SUGGESTIONS.map((t) => (
                        <button key={t} type="button" onClick={() => { setQ(t); input.current?.focus(); }}
                          className="min-h-[32px] rounded-full border border-[var(--hair)] px-3 text-[13px] text-ink-2 transition-colors duration-[var(--dur-fast)] hover:border-[var(--hair-2)] hover:text-ink">
                          {t}
                        </button>
                      ))}
                    </div>
                    <p className="px-2 pt-3 text-[12px] text-ink-muted">Paste any address, or start with <kbd className="kbd">/</kbd> for a command.</p>
                  </li>
                )}
              </ul>
              <div className="flex items-center justify-between gap-3 border-t border-[var(--hair)] px-5 py-2.5 text-[12px] text-ink-muted">
                <span className="hidden items-center gap-3 sm:flex">
                  <span className="flex items-center gap-1.5"><kbd className="kbd"><ArrowUp className="h-3 w-3" aria-hidden /></kbd><kbd className="kbd"><ArrowDown className="h-3 w-3" aria-hidden /></kbd>Navigate</span>
                  <span className="flex items-center gap-1.5"><kbd className="kbd"><CornerDownLeft className="h-3 w-3" aria-hidden /></kbd>Open</span>
                  <span className="flex items-center gap-1.5"><kbd className="kbd">esc</kbd>Close</span>
                </span>
                <span className="ml-auto">{commandMode ? 'Nothing is charged until you press Enter' : 'Search by Nansen'}</span>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
