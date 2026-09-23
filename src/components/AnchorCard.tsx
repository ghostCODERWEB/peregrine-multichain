'use client';
import { useEffect, useRef, useState } from 'react';
import { TimeAgo } from '@/components/TimeAgo';
import type { AnchorReport } from '@/server/agents/anchor';

type Status = 'idle' | 'loading' | 'streaming' | 'done' | 'error';

/**
 * The AI anchor: text from Nansen's own agent (agent/fast), streamed in as
 * it arrives with a typewriter reveal, the Nansen tools it used as chips.
 * Never generates on its own — a report costs 200 credits, so it only runs
 * on a click, and a report under an hour old is replayed instead.
 */
export function AnchorCard({ query, initial, label }: { query: string; initial?: AnchorReport | null; label: string }) {
  const [report, setReport] = useState<AnchorReport | null>(initial ?? null);
  const [text, setText] = useState(initial?.text ?? '');
  const [shown, setShown] = useState(initial?.text.length ?? 0);
  const [tools, setTools] = useState<string[]>(initial?.toolCalls ?? []);
  const [status, setStatus] = useState<Status>(initial ? 'done' : 'idle');
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    fetch(`/api/anchor?${query}`).then((r) => r.json()).then((d: { report: AnchorReport | null; callsLeftThisHour: number }) => {
      setLeft(d.callsLeftThisHour);
      if (d.report && !initial) { setReport(d.report); setText(d.report.text); setShown(d.report.text.length); setTools(d.report.toolCalls); setStatus('done'); }
    }).catch(() => {});
  }, [query, initial]);

  // Typewriter: reveal the received text a few characters per frame.
  useEffect(() => {
    if (shown >= text.length) return;
    if (reduced.current) { setShown(text.length); return; }
    const id = requestAnimationFrame(() => setShown((s) => Math.min(text.length, s + 3)));
    return () => cancelAnimationFrame(id);
  }, [shown, text]);

  async function run() {
    setStatus('loading'); setError(null); setText(''); setShown(0); setTools([]);
    try {
      const res = await fetch(`/api/anchor?${query}`, { method: 'POST' });
      if (!res.body) throw new Error('no stream');
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i: number;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const chunk = buf.slice(0, i).replace(/^data: /, '');
          buf = buf.slice(i + 2);
          const e = JSON.parse(chunk) as { type: string; text?: string; name?: string; report?: AnchorReport; cached?: boolean; message?: string };
          if (e.type === 'delta') { setStatus('streaming'); setText((t) => t + e.text); }
          else if (e.type === 'tool') setTools((t) => (t.includes(e.name!) ? t : [...t, e.name!]));
          else if (e.type === 'done') { setReport(e.report!); setText(e.report!.text); setStatus('done'); if (e.cached) setShown(e.report!.text.length); }
          else if (e.type === 'error') { setError(e.message!); setStatus((s) => (s === 'streaming' ? 'done' : 'error')); }
        }
      }
      fetch(`/api/anchor?${query}`).then((r) => r.json()).then((d: { callsLeftThisHour: number }) => setLeft(d.callsLeftThisHour)).catch(() => {});
    } catch (e) {
      setError((e as Error).message); setStatus('error');
    }
  }

  const stale = report && Date.now() - report.createdAt >= 60 * 60_000;
  return (
    <div>
      {tools.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5" aria-label="Nansen tools the agent used">
          {tools.map((t) => <li key={t} className="rounded-full border border-border px-2 py-0.5 text-[11px] text-ink-2">Nansen agent checked {t.replace(/[_-]/g, ' ')}</li>)}
        </ul>
      )}
      {text ? (
        <p className="text-[15px] leading-relaxed text-ink" aria-live="polite">
          {text.slice(0, shown)}
          {status === 'streaming' || shown < text.length ? <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-ink-2 align-middle" aria-hidden /> : null}
        </p>
      ) : status === 'loading' ? (
        <p className="animate-pulse text-sm text-ink-muted">Asking Nansen&apos;s agent to read TIDE&apos;s numbers…</p>
      ) : (
        <p className="text-sm text-ink-2">No report yet. {label}</p>
      )}
      {error && <p className="mt-2 text-[12.5px] text-ink-2">{error}</p>}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-ink-muted">
        <span>
          {report ? <>Nansen agent/fast · <TimeAgo ts={report.createdAt} />{stale ? ' · over an hour old' : ' · reused for an hour'}</> : 'Nansen agent/fast · 200 credits per report'}
          {left != null && ` · ${left} fresh report${left === 1 ? '' : 's'} left this hour`}
        </span>
        {(!report || stale) && status !== 'loading' && status !== 'streaming' && (
          <button onClick={run} disabled={left === 0}
            className="rounded-md border border-border px-2.5 py-1 text-[12px] text-ink hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50">
            {report ? 'Refresh report (200 credits)' : 'Generate report (200 credits)'}
          </button>
        )}
      </div>
    </div>
  );
}
