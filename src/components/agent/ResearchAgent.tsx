'use client';
import { useEffect, useRef, useState } from 'react';
import type { ExpertReport } from '@/server/agents/expert';

interface Turn {
  question: string;
  answer: string;
  tools: string[];
  error?: string;
  done: boolean;
}

/** Paragraphs and simple bullet lines, as text; nothing from the answer is rendered as HTML. */
function Answer({ text }: { text: string }) {
  return (
    <div className="space-y-2 text-[13.5px] leading-relaxed text-ink">
      {text.split(/\n{2,}/).map((para, i) => (
        <p key={i} className="whitespace-pre-wrap">
          {para.replace(/\*\*(.+?)\*\*/g, '$1')}
        </p>
      ))}
    </div>
  );
}

export function ResearchAgent({ suggestions }: { suggestions: string[] }) {
  const [info, setInfo] = useState<{ reports: ExpertReport[]; usedToday: number; cap: number; price: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  const load = () =>
    fetch('/api/agent')
      .then(async (r) => {
        const j = await r.json();
        if (r.ok) setInfo(j);
        else setError(j.error ?? 'Unavailable.');
      })
      .catch(() => setError('Could not reach the agent API.'));
  useEffect(() => {
    void load();
    setQuestion(new URLSearchParams(window.location.search).get('q') ?? '');
  }, []);

  async function ask() {
    const q = question.trim();
    if (!q || !info) return;
    setConfirming(false);
    setBusy(true);
    setQuestion('');
    setTurns((t) => [...t, { question: q, answer: '', tools: [], done: false }]);
    const update = (fn: (t: Turn) => Turn) => setTurns((all) => all.map((t, i) => (i === all.length - 1 ? fn(t) : t)));
    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: q, acknowledgedCredits: info.price, conversationId }),
      });
      if (!res.ok || !res.body) {
        update((t) => ({ ...t, error: 'The request was refused.', done: true }));
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const chunk = buf.slice(0, i);
          buf = buf.slice(i + 2);
          const ev = /^event: (.+)$/m.exec(chunk)?.[1];
          const data = /^data: (.+)$/m.exec(chunk)?.[1];
          if (!ev || !data) continue;
          const e = JSON.parse(data) as { type: string; text?: string; name?: string; message?: string; report?: ExpertReport };
          if (e.type === 'delta') update((t) => ({ ...t, answer: t.answer + (e.text ?? '') }));
          else if (e.type === 'tool' && e.name)
            update((t) => ({ ...t, tools: t.tools.includes(e.name!) ? t.tools : [...t.tools, e.name!] }));
          else if (e.type === 'error') update((t) => ({ ...t, error: e.message }));
          else if (e.type === 'done' && e.report) {
            setConversationId(e.report.conversationId);
            update((t) => ({ ...t, done: true }));
          }
        }
        bottom.current?.scrollIntoView({ block: 'end' });
      }
      update((t) => ({ ...t, done: true }));
    } finally {
      setBusy(false);
      void load();
    }
  }

  const open = (r: ExpertReport) => {
    setTurns([{ question: r.question, answer: r.answer, tools: r.toolCalls, done: true }]);
    setConversationId(r.conversationId);
  };

  if (error) return <p className="text-sm text-ink-2">{error}</p>;
  const left = info ? Math.max(0, info.cap - info.usedToday) : 0;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <div className="min-w-0 space-y-3">
        {turns.map((t, i) => (
          <article key={i} className="material p-5 sm:p-6">
            <div className="text-[12px] text-ink-muted">You asked</div>
            <div className="text-[14px] font-medium text-ink">{t.question}</div>
            {t.tools.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Nansen tools the agent called">
                {t.tools.map((name) => (
                  <span key={name} className="num rounded border border-border px-2 py-0.5 text-[11px] text-ink-2">
                    {name}
                  </span>
                ))}
              </div>
            )}
            <div className="mt-3">
              {t.answer ? (
                <Answer text={t.answer} />
              ) : (
                !t.error && <p className="animate-pulse text-[12.5px] text-ink-muted">Nansen&apos;s agent is researching…</p>
              )}
            </div>
            {t.error && <p className="mt-2 text-[12.5px] text-ink-2">{t.error}</p>}
          </article>
        ))}
        <div ref={bottom} />
        <div className="material p-5 sm:p-6">
          <label htmlFor="agent-q" className="text-[12.5px] text-ink-2">
            {conversationId ? 'Follow up in this conversation' : 'Ask Nansen'}
          </label>
          <textarea
            id="agent-q"
            value={question}
            onChange={(e) => {
              setQuestion(e.target.value);
              setConfirming(false);
            }}
            rows={3}
            maxLength={2000}
            className="mt-1 block w-full rounded-lg border border-border bg-raised px-3 py-2 text-[13.5px] text-ink"
            placeholder="e.g. Which tokens are smart money accumulating on Base this week, and who is selling them?"
          />
          {!turns.length && suggestions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setQuestion(s);
                    setConfirming(false);
                  }}
                  className="rounded border border-border px-2.5 py-1 text-left text-[12px] text-ink-2 hover:text-ink"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {!confirming ? (
              <button
                disabled={busy || !question.trim() || !info || left === 0}
                onClick={ask}
                className="rounded bg-brand/15 px-3.5 py-1.5 text-[13px] text-ink ring-1 ring-brand/40 hover:bg-brand/25 disabled:opacity-45"
              >
                Ask
              </button>
            ) : (
              <div
                role="alertdialog"
                aria-label="Confirm the price"
                className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-raised/60 px-3 py-2 text-[12.5px]"
              >
                <span className="text-ink">This question costs {info?.price} credits on your Nansen key.</span>
                <button onClick={ask} className="rounded bg-brand/20 px-3 py-1 text-ink ring-1 ring-brand/50">
                  Confirm and ask
                </button>
                <button onClick={() => setConfirming(false)} className="text-ink-muted hover:text-ink">
                  Cancel
                </button>
              </div>
            )}
            {conversationId && (
              <button
                onClick={() => {
                  setConversationId(null);
                  setTurns([]);
                }}
                className="text-[12px] text-ink-muted hover:text-ink"
              >
                New conversation
              </button>
            )}
            <span className="num ml-auto text-[11.5px] text-ink-muted">{info ? `${left} of ${info.cap} questions left today` : ''}</span>
          </div>
        </div>
      </div>
      <aside className="material h-fit p-5">
        <h2 className="text-[13px] font-semibold text-ink">Saved answers</h2>
        {info?.reports.length ? (
          <ul className="mt-2 space-y-2 text-[12.5px]">
            {info.reports.map((r) => (
              <li key={r.id}>
                <button onClick={() => open(r)} className="text-left text-ink-2 hover:text-ink">
                  <span className="line-clamp-2">{r.question}</span>
                  <span className="num block text-[11px] text-ink-muted">
                    {new Date(r.createdAt).toISOString().slice(0, 16).replace('T', ' ')} UTC
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[12.5px] text-ink-2">None yet.</p>
        )}
      </aside>
    </div>
  );
}
