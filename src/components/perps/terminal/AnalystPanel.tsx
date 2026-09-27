'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Loader2, Sparkles, Square } from 'lucide-react';
import { AddressLink } from '@/components/entity/AddressLink';
import { parseAction, type ParsedAction } from '@/lib/perps/actions';
import { Segmented } from '@/components/ui/Segmented';

type Turn = { command?: boolean; q: string; text: string; tools: string[]; error?: string; credits?: number; depth: 'quick' | 'deep'; at?: number };

const ADDR = /0x[a-fA-F0-9]{40}/;
const RANGE = /\$([\d,]+(?:\.\d+)?)\s+to\s+\$([\d,]+(?:\.\d+)?)/;
const TICKER = /\b[A-Z]{2,6}\b/;

/** An answer with its entities made actionable: wallets open the Profiler,
 *  price ranges select the band on the radar, known coins open their terminal. */
export function Linked({ text, coins, onRange }: { text: string; coins: Set<string>; onRange: (lo: number, hi: number) => void }) {
  const parts: React.ReactNode[] = [];
  let rest = text;
  let key = 0;
  while (rest) {
    const m = [ADDR.exec(rest), RANGE.exec(rest), TICKER.exec(rest)].filter((x): x is RegExpExecArray => !!x && (x[0].startsWith('0x') || x[0].startsWith('$') || coins.has(x[0]))).sort((a, b) => a.index - b.index)[0];
    if (!m) { parts.push(rest); break; }
    parts.push(rest.slice(0, m.index));
    const t = m[0];
    if (t.startsWith('0x')) parts.push(<AddressLink key={key++} address={t} />);
    else if (t.startsWith('$')) {
      const lo = Number(m[1].replace(/,/g, '')), hi = Number(m[2].replace(/,/g, ''));
      parts.push(<button key={key++} type="button" onClick={() => onRange(Math.min(lo, hi), Math.max(lo, hi))} className="num rounded-[4px] font-semibold text-brand underline decoration-dotted underline-offset-2 hover:decoration-solid" title="Select this range on the radar">{t}</button>);
    } else parts.push(<Link key={key++} href={`/perps/${encodeURIComponent(t)}`} className="font-semibold text-ink underline decoration-dotted underline-offset-2">{t}</Link>);
    rest = rest.slice(m.index + t.length);
  }
  return <>{parts}</>;
}

/** The agent writes light Markdown: **bold** and [text](url). Links to
 *  Nansen pages keep only their text (the entity inside it is linked to the
 *  matching page here); bold stays bold. */
export function Line({ text, coins, onRange }: { text: string; coins: Set<string>; onRange: (lo: number, hi: number) => void }) {
  const plain = text.replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '$1').replace(/^#+\s*/, '').replace(/^[-*]\s+/, '· ');
  return <>{plain.split('**').map((seg, i) => (i % 2 ? <strong key={i} className="font-semibold text-ink"><Linked text={seg} coins={coins} onRange={onRange} /></strong> : <Linked key={i} text={seg} coins={coins} onRange={onRange} />))}</>;
}

export function AnalystPanel({ symbol, available, suggestions, buildContext, coins, onRange, onAction }: {
  symbol: string; available: boolean; suggestions: string[]; buildContext: () => unknown; coins: string[]; onRange: (lo: number, hi: number) => void; onAction?: (a: ParsedAction) => void;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState('');
  const [depth, setDepth] = useState<'quick' | 'deep'>('quick');
  const [busy, setBusy] = useState(false);
  const conversation = useRef<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const coinSet = new Set(coins);

  // Saved answers for this coin: a paid answer survives a reload.
  useEffect(() => {
    if (!available) return;
    fetch(`/api/perps/ask?symbol=${encodeURIComponent(symbol)}`).then((r) => r.json()).then((d: { answers?: Array<{ question: string; text: string; tools: string[]; credits: number; depth: 'quick' | 'deep'; createdAt: number }> }) => {
      setTurns((t) => (t.length ? t : (d.answers ?? []).reverse().map((a) => ({ q: a.question, text: a.text, tools: a.tools, credits: a.credits, depth: a.depth, at: a.createdAt }))));
    }).catch(() => {});
  }, [symbol, available]);

  const ask = async (question: string) => {
    if (!question.trim() || busy) return;
    // Imperative commands change the view directly: explicit, free, no agent call.
    const action = onAction ? parseAction(question, coins) : null;
    if (action) {
      onAction!(action);
      setTurns((t) => [...t, { command: true, q: question.trim(), text: `Applied: ${action.applied.join(' · ')}`, tools: [], depth: 'quick' }]);
      setQ('');
      return;
    }
    const turn: Turn = { q: question.trim(), text: '', tools: [], depth };
    setTurns((t) => [...t, turn]);
    setQ('');
    setBusy(true);
    const ac = new AbortController();
    abort.current = ac;
    const update = (patch: Partial<Turn>) => setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, ...patch } : x)));
    try {
      const res = await fetch('/api/perps/ask', {
        method: 'POST', headers: { 'content-type': 'application/json' }, signal: ac.signal,
        body: JSON.stringify({ symbol, question: turn.q, context: buildContext(), depth, conversationId: conversation.current, acknowledgedCredits: depth === 'deep' ? 750 : undefined }),
      });
      if (!res.ok || !res.body) { update({ error: (await res.json().catch(() => ({ error: 'The analyst is unavailable.' }))).error }); return; }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '', text = '';
      const tools: string[] = [];
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const events = buf.split('\n\n');
        buf = events.pop() ?? '';
        for (const ev of events) {
          const data = ev.split('\n').find((l) => l.startsWith('data: '))?.slice(6);
          if (!data) continue;
          const e = JSON.parse(data);
          if (e.type === 'delta') { text += e.text; update({ text }); }
          else if (e.type === 'tool') { tools.push(e.name); update({ tools: [...tools] }); }
          else if (e.type === 'error') update({ error: e.message });
          else if (e.type === 'done') { conversation.current = e.conversationId; update({ credits: e.credits }); }
        }
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') update({ error: 'The connection to the analyst dropped. Ask again to retry.' });
    } finally {
      setBusy(false);
      abort.current = null;
    }
  };

  if (!available) {
    return <p className="text-[12.5px] text-ink-muted">The analyst reads wallet labels and Smart Money cohorts, which Nansen allows only in the key owner&apos;s view.</p>;
  }
  return (
    <section aria-label="Nansen analyst" className="flex min-h-0 flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-[13.5px] font-bold text-ink"><Sparkles className="h-3.5 w-3.5 text-brand" aria-hidden />Nansen analyst</h3>
        <div className="flex items-center gap-2">
          {turns.length > 0 && <button type="button" onClick={() => { setTurns([]); conversation.current = null; }} className="text-[11.5px] font-semibold text-ink-muted hover:text-ink">New</button>}
          <Segmented label="Analysis depth" value={depth} options={[{ value: 'quick', label: 'Quick' }, { value: 'deep', label: 'Deep' }]} onChange={setDepth} />
        </div>
      </div>
      <ol className="max-h-[420px] min-h-0 space-y-3 overflow-y-auto" aria-live="polite">
        {turns.map((t, i) => (
          <li key={i} className="space-y-1.5">
            <p className="text-[12.5px] font-semibold text-ink">{t.q}</p>
            {t.tools.length > 0 && (
              <p className="flex flex-wrap gap-1">{t.tools.map((n) => <span key={n} className="rounded-[5px] bg-ink/8 px-1.5 py-px font-mono text-[10.5px] text-ink-2" title="A Nansen tool the agent called">{n}</span>)}</p>
            )}
            {t.text && (
              <div className="rounded-[10px] border border-[var(--hair)] bg-[color-mix(in_srgb,var(--ink-1)_3%,transparent)] p-3 text-[13px] leading-relaxed text-ink-2">
                {t.command ? <span className="mb-1.5 inline-block rounded-[5px] bg-ink/10 px-1.5 py-px text-[10.5px] font-bold text-ink-2">Command</span> : <span className="mb-1.5 inline-block rounded-[5px] bg-[color-mix(in_srgb,var(--signal)_16%,transparent)] px-1.5 py-px text-[10.5px] font-bold text-[var(--signal)]">Nansen analysis</span>}
                {t.text.split('\n').filter(Boolean).map((line, j) => (
                  <p key={j} className={`mt-1 whitespace-pre-wrap ${/^evidence:/i.test(line.trim()) ? 'border-t border-[var(--hair)] pt-1.5 text-[12px] text-ink-muted' : ''}`}>
                    <Line text={line} coins={coinSet} onRange={onRange} />
                  </p>
                ))}
              </div>
            )}
            {busy && i === turns.length - 1 && !t.error && (
              <p className="flex items-center gap-1.5 text-[12px] text-ink-muted"><Loader2 className="h-3 w-3 animate-spin" aria-hidden />{t.text ? 'Writing' : t.tools.length ? 'Reading Nansen data' : 'Starting'}</p>
            )}
            {t.error && <p role="alert" className="text-[12.5px] text-[var(--flare)]">{t.error}</p>}
            {t.credits != null && <p className="text-[11px] text-ink-muted">{t.depth === 'deep' ? 'Deep investigation' : 'Quick analysis'} · {t.credits} credits{t.at ? ` · ${new Date(t.at).toISOString().slice(5, 16).replace('T', ' ')} UTC` : ''}</p>}
          </li>
        ))}
      </ol>
      {!turns.length && (
        <ul className="flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <li key={s}><button type="button" onClick={() => ask(s)} className="rounded-full border border-[var(--hair)] px-3 py-1.5 text-left text-[12.5px] text-ink-2 hover:border-[var(--hair-2)] hover:text-ink">{s}</button></li>
          ))}
        </ul>
      )}
      <form onSubmit={(e) => { e.preventDefault(); ask(q); }} className="space-y-2">
        <div className="flex items-center gap-2 rounded-[12px] border border-[var(--hair-2)] bg-[var(--surface-1)] px-3 focus-within:border-[var(--mint)]">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={turns.length ? 'Ask a follow-up' : `Ask about ${symbol} on this screen`} aria-label="Ask the analyst"
            className="h-10 min-w-0 flex-1 bg-transparent text-[13.5px] text-ink placeholder:text-ink-muted focus-visible:shadow-none focus-visible:outline-none" />
          {busy ? (
            <button type="button" onClick={() => abort.current?.abort()} aria-label="Stop" className="grid h-7 w-7 place-items-center rounded-full bg-ink/10 text-ink"><Square className="h-3 w-3" aria-hidden /></button>
          ) : (
            <button type="submit" disabled={!q.trim()} className="pill-button pill-primary min-h-0 px-3 py-1 text-[12px]">Ask</button>
          )}
        </div>
        <p className="text-[11px] text-ink-muted">
          {depth === 'quick' ? 'Quick: reads what is on screen.' : 'Deep: multi-step research with Nansen’s tools.'}
        </p>
      </form>
    </section>
  );
}
