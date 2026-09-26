'use client';
// Ask Nansen on a token page (the design's chat card): recent answers as
// bubbles, suggested questions, and a follow-up box. Each new question runs
// Nansen's fast agent on the operator's key (server/agents/quick.ts);
// repeats within an hour and past answers are free.
import { useEffect, useRef, useState } from 'react';
import { ArrowUp, MessageCircle } from 'lucide-react';

type Answer = { question: string; text: string; createdAt: number; cached?: boolean };
type Meta = { answers: Answer[]; price: number; left: number | null; cap: number | null };

export function TokenAskChat({
  chain,
  address,
  symbol,
  band,
}: {
  chain: string;
  address: string;
  symbol: string | null;
  band: string | null;
}) {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [q, setQ] = useState('');
  const [pending, setPending] = useState<{ question: string; text: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const sym = symbol ?? 'this token';

  useEffect(() => {
    let live = true;
    fetch(`/api/ask/token?chain=${chain}&address=${encodeURIComponent(address)}`)
      .then((r) => r.json())
      .then((d: Meta) => {
        if (live) {
          setMeta(d);
          setAnswers(d.answers ?? []);
        }
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [chain, address]);
  // Keep the newest message in view inside the chat box only: scrolling an
  // element into view would move the whole page when answers load.
  useEffect(() => {
    const el = list.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [answers.length, pending?.text]);

  async function ask(question: string) {
    const text = question.trim();
    if (text.length < 3 || pending) return;
    setErr(null);
    setQ('');
    setPending({ question: text, text: '' });
    try {
      const r = await fetch('/api/ask/token', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chain, address, question: text }),
      });
      if (!r.ok || !r.body) throw new Error((await r.json().catch(() => ({}))).error ?? 'Ask Nansen is unavailable right now.');
      const reader = r.body.getReader(),
        dec = new TextDecoder();
      let buf = '',
        got = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i: number;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const line = buf.slice(0, i).replace(/^data: /, '');
          buf = buf.slice(i + 2);
          const e = JSON.parse(line) as { type: string; text?: string; message?: string; answer?: Answer };
          if (e.type === 'delta') {
            got += e.text;
            setPending({ question: text, text: got });
          } else if (e.type === 'error') setErr(e.message ?? 'Ask Nansen failed.');
          else if (e.type === 'done' && e.answer) {
            setAnswers((a) => [...a, e.answer!]);
            if (!e.answer.cached) setMeta((m) => (m && m.left != null ? { ...m, left: Math.max(0, m.left - 1) } : m));
          }
        }
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setPending(null);
    }
  }

  const suggestions = [
    `Who is buying ${sym} this week?`,
    `Is there enough liquidity to exit ${sym}?`,
    band ? `Why is the Token Score ${band.toLowerCase()}?` : `What are the main risks for ${sym}?`,
  ];
  const out = meta?.left === 0;
  return (
    <section aria-labelledby="ask" className="material flex min-h-[320px] flex-col p-5 sm:p-6">
      <div className="flex items-center gap-2.5">
        <span
          className="grid h-8 w-8 place-items-center rounded-[10px]"
          style={{ background: 'linear-gradient(135deg, var(--violet), var(--signal))' }}
        >
          <MessageCircle size={17} className="text-white" aria-hidden />
        </span>
        <h2 id="ask" className="t-section">
          Ask Nansen about {sym}
        </h2>
        <span className="ml-auto text-[12px] text-ink-muted">
          {meta?.left != null ? `${meta.left} of ${meta.cap} questions left today` : 'Nansen fast agent'}
        </span>
      </div>

      <div ref={list} className="mt-4 flex max-h-[360px] flex-1 flex-col gap-3 overflow-y-auto pr-1" aria-live="polite">
        {answers.map((a, i) => (
          <div key={i} className="flex flex-col gap-2">
            <div
              className="max-w-[80%] self-end rounded-[18px] rounded-br-[5px] px-4 py-2.5 text-[14px] text-white"
              style={{ background: 'var(--signal)' }}
            >
              {a.question}
            </div>
            <div className="max-w-[88%] rounded-[18px] rounded-bl-[5px] border border-[var(--hair)] bg-ink/[0.05] px-4 py-3 text-[14px] leading-relaxed text-ink-2">
              {a.text}
            </div>
          </div>
        ))}
        {pending && (
          <div className="flex flex-col gap-2">
            <div
              className="max-w-[80%] self-end rounded-[18px] rounded-br-[5px] px-4 py-2.5 text-[14px] text-white"
              style={{ background: 'var(--signal)' }}
            >
              {pending.question}
            </div>
            <div className="max-w-[88%] rounded-[18px] rounded-bl-[5px] border border-[var(--hair)] bg-ink/[0.05] px-4 py-3 text-[14px] leading-relaxed text-ink-2">
              {pending.text || <span className="animate-pulse text-ink-muted">Nansen is reading {sym}’s scores…</span>}
            </div>
          </div>
        )}
        {!answers.length && !pending && (
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                disabled={out}
                onClick={() => ask(s)}
                className="rounded-full border border-[var(--hair-2)] px-3 py-1.5 text-[13px] text-ink hover:bg-ink/5 disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {err && <p className="mt-3 text-[13px] text-ink-2">{err}</p>}
      <form
        className="mt-4"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(q);
        }}
      >
        <label className="inset-well flex items-center gap-2 py-1.5 pl-4 pr-1.5">
          <span className="sr-only">Ask Nansen a question about {sym}</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value.slice(0, 300))}
            disabled={!!pending || out}
            placeholder={
              out ? 'Today’s questions are used · new ones at 00:00 UTC' : answers.length ? 'Ask a follow-up' : `Ask anything about ${sym}`
            }
            className="min-w-0 flex-1 bg-transparent py-1.5 text-[14px] text-ink outline-none placeholder:text-ink-muted"
          />
          <button
            type="submit"
            aria-label="Send"
            disabled={!!pending || out || q.trim().length < 3}
            className="grid h-9 w-9 place-items-center rounded-[10px] bg-ink text-page disabled:opacity-40"
          >
            <ArrowUp size={17} aria-hidden />
          </button>
        </label>
      </form>
    </section>
  );
}
