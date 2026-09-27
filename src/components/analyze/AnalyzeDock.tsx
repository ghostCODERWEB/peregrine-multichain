'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Crosshair, FileSearch, Loader2, Send, Sparkles, X } from 'lucide-react';
import { Line } from '@/components/perps/terminal/AnalystPanel';
import { useSite } from '@/components/SiteContext';
import { extract, PICKABLE, type Selection } from './extract';
import { pageContexts } from './store';

type Turn = { q: string; sels: string[]; text: string; tools: string[]; error?: string; busy: boolean };

const KIND_NAME: Record<string, string> = { chart: 'Chart', token: 'Token', wallet: 'Wallet', market: 'Market', perp: 'Perp', sector: 'Sector', chain: 'Chain', row: 'Row', card: 'Card', item: 'Item' };

function prompts(path: string, hasSel: boolean): string[] {
  if (hasSel) return ['Explain what this shows', 'What stands out here, and why?', 'How does this compare with the rest of the page?'];
  if (path === '/') return ['What matters most right now?', 'Where is Smart Money rotating, and into what?', 'What is the biggest risk on the board today?'];
  if (path.startsWith('/perps')) return ['Which coins are most crowded, and on which side?', 'Where do liquidations cluster?', 'Where does Smart Money disagree with the crowd?'];
  if (path.startsWith('/predict')) return ['Which markets repriced most, and on what volume?', 'Where is activity unusually high?', 'Which markets have the deepest liquidity?'];
  if (path.startsWith('/sectors')) return ['Which sectors are gaining flow, and which tokens drive it?', 'Where is flow concentrated in one token?', 'What rotated between sectors today?'];
  if (path.startsWith('/token/')) return ['Who is buying this, and is it concentrated?', 'What does the risk profile say?', 'Summarize this token in three points'];
  if (path.startsWith('/wallet')) return ['Profile this wallet’s behaviour', 'What has it been buying and selling?', 'Is it positioned in perps?'];
  if (path.startsWith('/smart-money')) return ['What is Smart Money accumulating?', 'Which wallets are most active?', 'Where are crowded exits?'];
  if (path.startsWith('/flows')) return ['Which chains are gaining flow?', 'Which rotations are largest?', 'What changed in the last 24 hours?'];
  return ['Summarize this page', 'What stands out here?', 'What should I look at next?'];
}

/** The persistent "Analyze with Nansen" dock: ask about the page, or pick any chart, row, token, wallet, market or card on it. */
export function AnalyzeDock() {
  const { publicSite } = useSite();
  const path = usePathname() ?? '/';
  const [open, setOpenRaw] = useState(false);
  const [closing, setClosing] = useState(false);
  // Tell the tab bar's Ask button whether the panel is showing, so it can light up.
  useEffect(() => { window.dispatchEvent(new CustomEvent('peregrine:analyze-state', { detail: open && !closing })); }, [open, closing]);
  // Closing plays the genie in reverse (back into the Ask button) before unmounting.
  const setOpen = (v: boolean | ((o: boolean) => boolean)) => setOpenRaw((o) => {
    const next = typeof v === 'function' ? v(o) : v;
    if (o && !next) { setClosing(true); setTimeout(() => { setClosing(false); setOpenRaw(false); }, 360); return o; }
    return next;
  });
  const [picking, setPicking] = useState(false);
  const [sels, setSels] = useState<Selection[]>([]);
  const [q, setQ] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [hover, setHover] = useState<{ r: DOMRect; label: string } | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const add = useCallback(async (el: HTMLElement) => {
    const s = await extract(el);
    el.setAttribute('data-analyze-selected', '');
    setSels((cur) => (cur.some((x) => x.el === el) ? cur : [...cur.slice(-3), s]));
    setOpen(true);
  }, []);
  const remove = (s: Selection) => { s.el.removeAttribute('data-analyze-selected'); setSels((cur) => cur.filter((x) => x.id !== s.id)); };
  const clearAll = useCallback(() => { setSels((cur) => { cur.forEach((s) => s.el.removeAttribute('data-analyze-selected')); return []; }); }, []);

  // A new page: its elements are gone.
  useEffect(() => { clearAll(); setPicking(false); }, [path, clearAll]);
  // openAnalyze() from anywhere; ⌘J toggles.
  useEffect(() => {
    const onOpen = (e: Event) => { const el = (e as CustomEvent<Element | null>).detail; setOpen(true); if (el instanceof HTMLElement) void add(el); };
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') { e.preventDefault(); setOpen((o) => !o); }
      if (e.key === 'Escape') setPicking(false);
    };
    const onToggle = () => setOpen((o) => !o);
    window.addEventListener('peregrine:analyze', onOpen);
    window.addEventListener('peregrine:analyze-toggle', onToggle);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('peregrine:analyze', onOpen); window.removeEventListener('peregrine:analyze-toggle', onToggle); window.removeEventListener('keydown', onKey); };
  }, [add]);

  // Picking: highlight what is under the cursor, take it on click.
  useEffect(() => {
    if (!picking) { setHover(null); return; }
    const target = (e: Event) => {
      const t = e.target as HTMLElement | null;
      if (!t || t.closest('[data-analyze-dock]')) return null;
      const el = t.closest<HTMLElement>(PICKABLE);
      return el && el !== document.body && el.closest('main') ? el : null;
    };
    const move = (e: MouseEvent) => {
      const el = target(e);
      if (!el) { setHover(null); return; }
      const kind = el.getAttribute('data-analyze') ? 'card' : el.matches('tr') ? 'row' : el.matches('[role="img"]') ? 'chart' : el.matches('a[href^="/token/"]') ? 'token' : el.matches('a[href^="/wallet/"]') ? 'wallet' : el.matches('a[href^="/predict/"]') ? 'market' : el.matches('a[href^="/perps/"]') ? 'perp' : el.matches('a[href^="/sectors/"]') ? 'sector' : el.matches('li') ? 'item' : 'card';
      setHover({ r: el.getBoundingClientRect(), label: KIND_NAME[kind] });
    };
    const click = (e: MouseEvent) => {
      const el = target(e);
      if (!el) return;
      e.preventDefault(); e.stopPropagation();
      setPicking(false);
      void add(el);
    };
    document.addEventListener('mousemove', move, true);
    document.addEventListener('click', click, true);
    document.body.style.cursor = 'crosshair';
    return () => { document.removeEventListener('mousemove', move, true); document.removeEventListener('click', click, true); document.body.style.cursor = ''; };
  }, [picking, add]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [turns]);

  const ask = async (question: string, wholePage = false) => {
    const chosen = wholePage ? [] : sels;
    const turn: Turn = { q: question || (chosen.length ? 'Explain what this shows' : 'Summarize this page'), sels: chosen.map((s) => `${KIND_NAME[s.kind]}: ${s.label}`), text: '', tools: [], busy: true };
    setTurns((t) => [...t, turn]);
    setQ('');
    const idx = turns.length;
    const patch = (p: Partial<Turn>) => setTurns((t) => t.map((x, i) => (i === idx ? { ...x, ...p } : x)));
    const main = document.querySelector('main') as HTMLElement | null;
    const registered = pageContexts();
    const context = {
      page: { route: path, title: document.title.replace(/ · Peregrine$/, '') },
      pageData: Object.keys(registered).length ? registered : undefined,
      // The page's own numbers when it registered none: what is on screen, as text.
      onScreen: !Object.keys(registered).length || wholePage ? main?.innerText.replace(/\n{2,}/g, '\n').slice(0, 9000) : undefined,
    };
    const selections = chosen.map((s) => ({
      kind: s.chain && s.address ? 'token' : s.address ? 'wallet' : s.kind === 'perp' ? 'perp' : s.kind,
      element: s.kind, label: s.label, chain: s.chain, address: s.address, symbol: s.symbol, id: s.marketId, data: s.data,
    }));
    try {
      const r = await fetch('/api/explain', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ view: `${context.page.title} (${path})`, context, question: turn.q, selections }) });
      if (!r.ok || !r.body) { patch({ busy: false, error: (await r.json().catch(() => ({ error: 'Unavailable.' }))).error }); return; }
      const reader = r.body.getReader(); const dec = new TextDecoder(); let buf = '', acc = '';
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split('\n\n'); buf = parts.pop() ?? '';
        for (const ev of parts) {
          const d = ev.split('\n').find((l) => l.startsWith('data: '))?.slice(6); if (!d) continue;
          const e = JSON.parse(d) as { type: string; text?: string; name?: string; message?: string };
          if (e.type === 'delta') { acc += e.text ?? ''; patch({ text: acc }); }
          else if (e.type === 'tool') setTurns((t) => t.map((x, i) => (i === idx ? { ...x, tools: [...x.tools, e.name ?? ''] } : x)));
          else if (e.type === 'error') patch({ error: e.message });
        }
      }
      patch({ busy: false });
    } catch { patch({ busy: false, error: 'The connection dropped. Try again.' }); }
  };

  if (publicSite) return null;
  const busy = turns.some((t) => t.busy);
  return (
    <>
      {picking && hover && (
        <div aria-hidden className="pointer-events-none fixed z-[60] rounded-[8px] border-2 border-[var(--signal)] bg-[color-mix(in_srgb,var(--signal)_8%,transparent)] transition-all duration-75"
          style={{ left: hover.r.left - 3, top: hover.r.top - 3, width: hover.r.width + 6, height: hover.r.height + 6 }}>
          <span className="absolute -top-6 left-0 rounded-[5px] bg-[var(--signal)] px-1.5 py-0.5 text-[10.5px] font-bold text-black">{hover.label}</span>
        </div>
      )}
      {picking && (
        <div data-analyze-dock className="fixed left-1/2 top-3 z-[61] flex -translate-x-1/2 items-center gap-3 rounded-full border border-[var(--hair-2)] bg-[var(--surface-2)] px-4 py-2 text-[12.5px] text-ink shadow-lg">
          <Crosshair className="h-4 w-4 text-[var(--signal)]" aria-hidden />Click a chart, row, token, wallet, market or card
          <button type="button" onClick={() => setPicking(false)} className="text-ink-muted hover:text-ink">Esc</button>
        </div>
      )}

      {!open && (
        <button type="button" data-analyze-dock onClick={() => setOpen(true)} aria-label="Analyze with Nansen (⌘J)"
          className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+84px)] right-3 z-50 inline-flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,#1fe0a3_45%,var(--hair))] bg-[var(--surface-2)] p-3 text-[13px] sm:px-4 sm:py-2.5 font-bold text-ink shadow-[0_10px_40px_-10px_rgba(31,224,163,.6)] transition-transform hover:-translate-y-0.5 lg:bottom-6 lg:right-6">
          <Sparkles className="h-4 w-4 text-[#1fe0a3]" aria-hidden /><span className="hidden sm:inline">Analyze with Nansen</span>
          <span className="kbd !hidden lg:!inline">⌘J</span>
        </button>
      )}

      {open && (
        <div ref={panel} data-analyze-dock role="dialog" aria-label="Analyze with Nansen"
          className={`analyze-genie ${closing ? 'is-closing' : ''} fixed inset-x-2 bottom-2 z-50 flex max-h-[82vh] flex-col overflow-hidden rounded-[16px] border border-[var(--hair-2)] bg-[var(--surface-1)] shadow-2xl transition-opacity lg:inset-x-auto lg:bottom-4 lg:right-4 lg:top-4 lg:max-h-none lg:w-[420px] ${picking ? 'pointer-events-none opacity-40' : ''}`}>
          <div className="flex items-center justify-between border-b border-[var(--hair)] px-4 py-3">
            <span className="flex items-center gap-2 text-[14px] font-bold text-ink"><Sparkles className="h-4 w-4 text-[#1fe0a3]" aria-hidden />Analyze with Nansen</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="grid h-7 w-7 place-items-center rounded-full hover:bg-ink/10"><X className="h-4 w-4" aria-hidden /></button>
          </div>

          <div className="space-y-2.5 border-b border-[var(--hair)] px-4 py-3">
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setPicking(true)} className="inline-flex items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--signal)_45%,var(--hair))] px-3 py-1.5 text-[12.5px] font-semibold text-ink hover:bg-[color-mix(in_srgb,var(--signal)_10%,transparent)]">
                <Crosshair className="h-3.5 w-3.5 text-[var(--signal)]" aria-hidden />Select from page
              </button>
              <button type="button" disabled={busy} onClick={() => ask('Summarize this page: what matters most and why', true)} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hair)] px-3 py-1.5 text-[12.5px] font-semibold text-ink-2 hover:text-ink disabled:opacity-50">
                <FileSearch className="h-3.5 w-3.5" aria-hidden />Analyze this page
              </button>
            </div>
            {sels.length > 0 && (
              <ul className="flex flex-wrap gap-1.5" aria-label="Selected elements">
                {sels.map((s) => (
                  <li key={s.id} onMouseEnter={() => s.el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })}
                    className="inline-flex max-w-full items-center gap-1.5 rounded-[7px] border border-[var(--signal)] bg-[color-mix(in_srgb,var(--signal)_12%,transparent)] py-0.5 pl-2 pr-1 text-[12px] text-ink">
                    <span className="font-bold text-[var(--signal)]">{KIND_NAME[s.kind]}</span><span className="truncate">{s.label}</span>
                    <button type="button" onClick={() => remove(s)} aria-label={`Remove ${s.label}`} className="grid h-4 w-4 place-items-center rounded hover:bg-ink/15"><X className="h-3 w-3" aria-hidden /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="min-h-[120px] flex-1 space-y-4 overflow-y-auto px-4 py-3">
            {!turns.length && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold uppercase tracking-[0.07em] text-ink-muted">{sels.length ? 'About your selection' : 'Suggested'}</p>
                {prompts(path, sels.length > 0).map((p) => (
                  <button key={p} type="button" onClick={() => ask(p)} className="block w-full rounded-[9px] border border-[var(--hair)] px-3 py-2 text-left text-[12.5px] text-ink-2 hover:border-[var(--hair-2)] hover:text-ink">{p}</button>
                ))}
              </div>
            )}
            {turns.map((t, i) => (
              <div key={i} className="space-y-1.5">
                <p className="text-[12.5px] font-semibold text-ink">{t.q}</p>
                {t.sels.length > 0 && <p className="flex flex-wrap gap-1">{t.sels.map((s) => <span key={s} className="rounded bg-[color-mix(in_srgb,var(--signal)_14%,transparent)] px-1.5 text-[10.5px] font-semibold text-[var(--signal)]">{s}</span>)}</p>}
                {t.tools.length > 0 && <p className="flex flex-wrap gap-1">{t.tools.map((x, j) => <span key={j} className="rounded bg-ink/8 px-1.5 font-mono text-[10.5px] text-ink-2">{x}</span>)}</p>}
                <div className="text-[13px] leading-relaxed text-ink-2">
                  {t.text.split('\n').filter(Boolean).map((l, j) => <p key={j} className={`mt-1 ${/^evidence:/i.test(l.trim()) ? 'border-t border-[var(--hair)] pt-1.5 text-[11.5px] text-ink-muted' : ''}`}><Line text={l} coins={new Set()} onRange={() => {}} /></p>)}
                </div>
                {t.busy && <p className="flex items-center gap-1.5 text-[12px] text-ink-muted"><Loader2 className="h-3 w-3 animate-spin" aria-hidden />{t.text ? 'Writing' : 'Reading the data'}</p>}
                {t.error && <p role="alert" className="text-[12.5px] text-[var(--flare)]">{t.error}</p>}
              </div>
            ))}
            <div ref={endRef} />
          </div>

          <form onSubmit={(e) => { e.preventDefault(); if (q.trim() && !busy) void ask(q.trim()); }} className="flex items-end gap-2 border-t border-[var(--hair)] p-3">
            <textarea value={q} onChange={(e) => setQ(e.target.value)} rows={2} placeholder={sels.length ? 'Ask about the selection…' : 'Ask about this page…'}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (q.trim() && !busy) void ask(q.trim()); } }}
              className="inset-well min-h-[44px] flex-1 resize-none rounded-[10px] px-3 py-2 text-[13px] text-ink placeholder:text-ink-muted" />
            <button type="submit" disabled={!q.trim() || busy} aria-label="Send" className="grid h-10 w-10 place-items-center rounded-full bg-ink text-[var(--surface-page)] disabled:opacity-40"><Send className="h-4 w-4" aria-hidden /></button>
          </form>
        </div>
      )}
    </>
  );
}
