'use client';
// The heavy Ask Nansen panel. Its lightweight trigger imports this module
// only after it is opened, keeping Sheet and the conversation UI out of the
// initial token/chain/wallet route JavaScript.
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import type { ExpertReport } from '@/server/agents/expert';
import type { AskContext, Subject } from '@/server/agents/ask';
import { Go } from '@/components/ui/Icons';

interface Turn {
  question: string;
  answer: string;
  tools: string[];
  error?: string;
  done: boolean;
  reportId?: number;
}
interface Info {
  reports: ExpertReport[];
  usedToday: number;
  cap: number;
  price: number;
  context: AskContext | null;
  starters: string[];
  demo: boolean;
}

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

export interface AskNansenPanelProps {
  subject: Subject;
  label: string;
  attachTo?: { callId: number; onAttached?: () => void };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** `attachTo`, if given (opened from a call card), offers to save the answer
 * as a note on that call; it never edits the call itself. */
export function AskNansenPanel({ subject, label, attachTo, open, onOpenChange }: AskNansenPanelProps) {
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attached, setAttached] = useState<Set<number>>(new Set());
  const bottom = useRef<HTMLDivElement>(null);
  const loaded = useRef(false);

  const qs =
    subject.kind === 'token'
      ? `kind=token&chain=${subject.chain}&address=${encodeURIComponent(subject.address)}`
      : subject.kind === 'wallet'
        ? `kind=wallet&address=${encodeURIComponent(subject.address)}${subject.chain ? `&chain=${subject.chain}` : ''}`
        : `kind=chain&chain=${subject.chain}`;
  function load() {
    setError(null);
    fetch(`/api/agent?${qs}`)
      .then(async (r) => {
        const j = await r.json();
        if (r.ok) setInfo(j);
        else setError(j.error ?? 'Unavailable.');
      })
      .catch(() => setError('Could not reach the agent API.'));
  }
  // Load context only once the panel is actually opened — never on page load.
  useEffect(() => {
    if (open && !loaded.current) {
      loaded.current = true;
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load is rebuilt each render; loaded.current guards it to once
  }, [open]);

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
        body: JSON.stringify({ question: q, acknowledgedCredits: info.price, conversationId, subject: conversationId ? null : subject }),
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        update((t) => ({ ...t, error: j.error ?? 'The request was refused.', done: true }));
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
            update((t) => ({ ...t, done: true, reportId: e.report!.id }));
          }
        }
        bottom.current?.scrollIntoView({ block: 'end' });
      }
      update((t) => ({ ...t, done: true }));
    } finally {
      setBusy(false);
      load();
    }
  }

  async function attach(reportId: number) {
    if (!attachTo) return;
    try {
      const r = await fetch('/api/desk', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'attach-note', callId: attachTo.callId, reportId }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Could not attach.');
      setAttached((s) => new Set(s).add(reportId));
      attachTo.onAttached?.();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const left = info ? Math.max(0, info.cap - info.usedToday) : 0;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-[min(100vw,480px)] flex-col overflow-y-auto sm:max-w-[480px]">
        <SheetHeader>
          <SheetTitle className="text-ink">Ask Nansen</SheetTitle>
          <SheetDescription>
            On {label}. Answers come from Nansen&apos;s own agent, in expert mode, on the asking account&apos;s Nansen key.
          </SheetDescription>
        </SheetHeader>
        <div className="min-w-0 flex-1 space-y-3 px-4 pb-6">
          {error && <p className="text-[12.5px] text-ink-2">{error}</p>}
          {!error && !info && <p className="animate-pulse text-[12.5px] text-ink-muted">Reading what Peregrine knows about this page…</p>}
          {info?.demo && (
            <p className="rounded-lg border border-dashed border-border p-2 text-[12px] text-ink-muted">
              Keyless demo: Ask Nansen costs 750 credits a question and does not run here. This shows the panel with no live answer.
            </p>
          )}
          {info?.context && (
            <details className="rounded-lg border border-border p-2.5 text-[12px] text-ink-2" open={!turns.length}>
              <summary className="cursor-pointer select-none text-ink">
                What Peregrine will send with your first question ({info.context.view})
              </summary>
              {info.context.lines.length ? (
                <ul className="mt-2 space-y-1">
                  {info.context.lines.map((l, i) => (
                    <li key={i}>
                      <span className="text-ink">{l.label}:</span> <span className="num">{l.value}</span>{' '}
                      <span className="text-ink-muted">
                       , {l.at ? new Date(l.at).toISOString().slice(0, 16).replace('T', ' ') + ' UTC' : 'no timestamp'}, {l.source}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-ink-muted">No stored readings for this page yet.</p>
              )}
              <p className="mt-2 text-ink-muted">
                Only these stored, timestamped lines are sent, never live prices fetched after your question, and never another
                account&apos;s data. Follow-ups in this conversation don&apos;t resend it.
              </p>
            </details>
          )}
          {turns.map((t, i) => (
            <article key={i} className="rounded-xl border border-border p-3">
              <div className="text-[11.5px] text-ink-muted">You asked</div>
              <div className="text-[13.5px] font-medium text-ink">{t.question}</div>
              {t.tools.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Nansen tools the agent called">
                  {t.tools.map((name) => (
                    <span key={name} className="num rounded border border-border px-2 py-0.5 text-[10.5px] text-ink-2">
                      {name}
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-2">
                {t.answer ? (
                  <Answer text={t.answer} />
                ) : (
                  !t.error && <p className="animate-pulse text-[12px] text-ink-muted">Nansen&apos;s agent is researching…</p>
                )}
              </div>
              {t.error && <p className="mt-2 text-[12px] text-ink-2">{t.error}</p>}
              {t.done &&
                t.reportId != null &&
                attachTo &&
                (attached.has(t.reportId) ? (
                  <p className="mt-2 text-[11.5px] text-ink-muted">Attached to your call as a note.</p>
                ) : (
                  <button
                    type="button"
                    onClick={() => attach(t.reportId!)}
                    className="mt-2 text-[11.5px] text-ink-2 underline underline-offset-2 hover:text-ink"
                  >
                    Attach this answer to my call (note only; the call itself is never changed)
                  </button>
                ))}
            </article>
          ))}
          <div ref={bottom} />
          <div className="rounded-xl border border-border p-3">
            <label htmlFor="ask-nansen-q" className="text-[12px] text-ink-2">
              {conversationId ? 'Follow up in this conversation' : `Ask about ${label}`}
            </label>
            <textarea
              id="ask-nansen-q"
              value={question}
              onChange={(e) => {
                setQuestion(e.target.value);
                setConfirming(false);
              }}
              rows={3}
              maxLength={2000}
              className="mt-1 block w-full rounded-lg border border-border bg-raised px-2.5 py-2 text-[13px] text-ink"
              placeholder="Edit the question, or ask your own…"
            />
            {!turns.length && info && info.starters.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {info.starters.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setQuestion(s);
                      setConfirming(false);
                    }}
                    className="rounded border border-border px-2 py-1 text-left text-[11.5px] text-ink-2 hover:text-ink"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {!confirming ? (
                <button
                  type="button"
                  disabled={busy || !question.trim() || !info || left === 0 || info.demo}
                  onClick={() => setConfirming(true)}
                  className="rounded bg-brand/15 px-3 py-1.5 text-[12.5px] text-ink ring-1 ring-brand/40 hover:bg-brand/25 disabled:opacity-45"
                >
                  Ask ({info?.price ?? 750} credits)
                </button>
              ) : (
                <div
                  role="alertdialog"
                  aria-label="Confirm the price"
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-raised/60 px-2.5 py-2 text-[12px]"
                >
                  <span className="text-ink">{info?.price} credits on your Nansen key.</span>
                  <button type="button" onClick={ask} className="rounded bg-brand/20 px-2.5 py-1 text-ink ring-1 ring-brand/50">
                    Confirm and ask
                  </button>
                  <button type="button" onClick={() => setConfirming(false)} className="text-ink-muted hover:text-ink">
                    Cancel
                  </button>
                </div>
              )}
              {conversationId && (
                <button
                  type="button"
                  onClick={() => {
                    setConversationId(null);
                    setTurns([]);
                  }}
                  className="text-[11.5px] text-ink-muted hover:text-ink"
                >
                  New conversation
                </button>
              )}
              <span className="num ml-auto text-[11px] text-ink-muted">{info ? `${left} of ${info.cap} left today` : ''}</span>
            </div>
          </div>
          {!turns.length && info && info.reports.length > 0 && (
            <div>
              <h3 className="text-[12px] font-semibold text-ink">Asked from this page before</h3>
              <ul className="mt-1.5 space-y-1.5 text-[12px]">
                {info.reports.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setTurns([{ question: r.question, answer: r.answer, tools: r.toolCalls, done: true, reportId: r.id }]);
                        setConversationId(r.conversationId);
                      }}
                      className="text-left text-ink-2 hover:text-ink"
                    >
                      <span className="line-clamp-2">{r.question}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-[11px] text-ink-muted">
            Free text from Nansen&apos;s agent: check it against the receipts elsewhere on the page. Saved to your account only, never
            published.{' '}
            <Link href="/agent" className="underline underline-offset-2">
              Open Ask Nansen <Go />
            </Link>
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
