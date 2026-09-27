'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ShieldCheck, Wallet, Waypoints, Globe2, Check, Loader2, X, Sparkles, ArrowRight, Search } from 'lucide-react';
import type { EvidenceItem, Mode, Report } from '@/server/research/desk';

type StepState = { id: string; label: string; status: 'running' | 'done' | 'failed'; count?: number; note?: string };
const MODES: Array<{ id: Mode; title: string; blurb: string; placeholder: string; Icon: typeof ShieldCheck; examples: string[] }> = [
  { id: 'token', title: 'Token due diligence', blurb: 'Risk score, Smart Money flow, who entered first, followable holders, liquidity', placeholder: 'Symbol or contract address', Icon: ShieldCheck, examples: ['GP', 'PUMP', 'JUP'] },
  { id: 'wallet', title: 'Wallet investigation', blurb: 'What it trades, where it sits in entry order, whether copying it pays', placeholder: 'Address or name.eth', Icon: Wallet, examples: ['vitalik.eth'] },
  { id: 'leaders', title: 'Who is leading this token?', blurb: 'Did proven early wallets get in, or is late money buying?', placeholder: 'Symbol or contract address', Icon: Waypoints, examples: ['STONK', 'PUMP'] },
  { id: 'market', title: 'Market brief', blurb: 'Today’s signals and what proven leaders bought in 48 hours', placeholder: '', Icon: Globe2, examples: [] },
];
const toneColor = (t?: EvidenceItem['tone']) => (t === 'bad' ? 'var(--flare)' : t === 'good' ? 'var(--mint)' : 'var(--ink-2)');

/** Render the report: section headings, bullets, and [E#] citations as chips that highlight their evidence. */
function Answer({ text, onCite }: { text: string; onCite: (id: string) => void }) {
  return (
    <div className="space-y-1.5 text-[14px] leading-relaxed text-ink">
      {text.split('\n').filter((l) => l.trim()).map((line, i) => {
        const head = /^(Verdict|Why|Watch):\s*(.*)$/i.exec(line.trim());
        const body = (s: string) => s.split(/(\[E\d+\])/g).map((part, j) => {
          const m = /^\[(E\d+)\]$/.exec(part);
          return m ? <button key={j} type="button" onClick={() => onCite(m[1])} className="mx-0.5 inline-flex h-5 items-center rounded-full bg-[color-mix(in_srgb,var(--signal)_18%,transparent)] px-1.5 align-middle text-[10.5px] font-bold text-[var(--signal)] hover:bg-[color-mix(in_srgb,var(--signal)_30%,transparent)]">{m[1]}</button> : <span key={j}>{part}</span>;
        });
        if (head) return <p key={i} className={head[1].toLowerCase() === 'verdict' ? 'text-[16px] font-semibold' : 'pt-2'}><span className="mr-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">{head[1]}</span>{body(head[2])}</p>;
        return <p key={i} className={line.trim().startsWith('-') ? 'pl-3 text-ink-2' : ''}>{body(line.trim().replace(/^-\s*/, '• '))}</p>;
      })}
    </div>
  );
}

/** Research Desk: pick a research mode, name a target, watch evidence being gathered from Peregrine's analytics, get a cited report. */
export function ResearchDesk({ initialReports }: { initialReports: Report[] }) {
  const [mode, setMode] = useState<Mode>('token');
  const [target, setTarget] = useState('');
  const [question, setQuestion] = useState('');
  const [steps, setSteps] = useState<StepState[]>([]);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [answer, setAnswer] = useState('');
  const [label, setLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lit, setLit] = useState<string | null>(null);
  const [reports, setReports] = useState<Report[]>(initialReports);
  const evRefs = useRef(new Map<string, HTMLElement>());
  const m = MODES.find((x) => x.id === mode)!;

  useEffect(() => { const q = new URLSearchParams(location.search); const t = q.get('target'), md = q.get('mode') as Mode | null; if (md && MODES.some((x) => x.id === md)) setMode(md); if (t) setTarget(t); }, []);

  async function run(t = target, md = mode) {
    if (busy || (md !== 'market' && !t.trim())) return;
    setBusy(true); setSteps([]); setEvidence([]); setAnswer(''); setError(null); setLabel(null); setLit(null);
    try {
      const res = await fetch('/api/research', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: md, target: t, question }) });
      if (!res.ok || !res.body) { setError((await res.json().catch(() => ({}))).error ?? 'The research run was refused.'); return; }
      const reader = res.body.getReader(), dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
          const ev = /^event: (.+)$/m.exec(chunk)?.[1], raw = /^data: (.+)$/m.exec(chunk)?.[1];
          if (!ev || !raw) continue;
          const data = JSON.parse(raw);
          if (ev === 'step') setSteps((s) => { const j = s.findIndex((x) => x.id === data.id); if (j < 0) return [...s, data]; const n = [...s]; n[j] = data; return n; });
          else if (ev === 'target') setLabel(data.label);
          else if (ev === 'evidence') setEvidence((e) => [...e, ...data]);
          else if (ev === 'delta') setAnswer((a) => a + data.text);
          else if (ev === 'done') setReports((r) => [data, ...r.filter((x) => x.id !== data.id)]);
          else if (ev === 'error') setError(data.message);
        }
      }
    } catch { setError('The research run stopped. Try again.'); }
    finally { setBusy(false); }
  }

  const cite = (id: string) => { setLit(id); evRefs.current.get(id)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); setTimeout(() => setLit((x) => (x === id ? null : x)), 2400); };
  const open = (r: Report) => { setLabel(r.target); setMode(r.mode); setEvidence(r.evidence); setAnswer(r.answer); setSteps([]); setError(null); };
  const started = busy || evidence.length > 0 || !!answer || !!error;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12 [&>*]:min-w-0">
      <div className="space-y-4 xl:col-span-9">
        <section className="material p-4 sm:p-5" aria-label="New research">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {MODES.map((x) => (
              <button key={x.id} type="button" onClick={() => setMode(x.id)} aria-pressed={mode === x.id}
                className={`flex flex-col items-start gap-2 rounded-[16px] border p-3 text-left transition-colors ${mode === x.id ? 'border-[var(--mint)] bg-[color-mix(in_srgb,var(--mint)_8%,transparent)]' : 'border-[var(--hair)] hover:border-[var(--hair-2)]'}`}>
                <x.Icon size={18} className={mode === x.id ? 'text-[var(--mint)]' : 'text-ink-muted'} aria-hidden />
                <span className="text-[13.5px] font-bold text-ink">{x.title}</span>
                <span className="hidden text-[11.5px] leading-snug text-ink-muted sm:block">{x.blurb}</span>
              </button>
            ))}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); void run(); }} className="mt-3 flex flex-col gap-2 sm:flex-row">
            {mode !== 'market' && (
              <label className="inset-well flex h-11 shrink-0 items-center gap-2 rounded-full px-4 sm:flex-1">
                <Search size={16} className="shrink-0 text-ink-muted" aria-hidden />
                <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder={m.placeholder} aria-label="Research target" className="bare-input min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-muted" autoComplete="off" spellCheck={false} />
              </label>
            )}
            {mode !== 'leaders' && (
              <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Optional: a specific question" aria-label="Question" className="inset-well h-11 shrink-0 rounded-full px-4 sm:flex-1 text-[14px] text-ink placeholder:text-ink-muted" />
            )}
            <button type="submit" disabled={busy || (mode !== 'market' && !target.trim())} className="get-nansen inline-flex h-11 items-center justify-center gap-2 rounded-full px-6 text-[14px] font-extrabold disabled:opacity-50">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}{busy ? 'Researching' : 'Research'}
            </button>
          </form>
          {m.examples.length > 0 && !started && (
            <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px] text-ink-muted">Try:
              {m.examples.map((ex) => <button key={ex} type="button" onClick={() => { setTarget(ex); void run(ex, mode); }} className="rounded-full border border-[var(--hair)] px-2.5 py-0.5 font-semibold text-ink-2 hover:text-ink">{ex}</button>)}
            </p>
          )}
        </section>

        {started && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
            <section className="material h-fit p-4" aria-label="Research steps">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">Research plan</p>
              {label && <p className="mt-1 truncate text-[14px] font-bold text-ink">{label}</p>}
              <ol className="mt-3 space-y-2.5">
                {steps.map((s) => (
                  <li key={s.id} className="flex items-start gap-2.5 text-[12.5px]">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full" style={{ background: s.status === 'done' ? 'color-mix(in srgb, var(--mint) 18%, transparent)' : s.status === 'failed' ? 'color-mix(in srgb, var(--flare) 18%, transparent)' : 'transparent' }}>
                      {s.status === 'done' ? <Check size={12} className="text-[var(--mint)]" /> : s.status === 'failed' ? <X size={12} className="text-[var(--flare)]" /> : <Loader2 size={13} className="animate-spin text-ink-muted" />}
                    </span>
                    <span className="min-w-0"><span className={s.status === 'running' ? 'text-ink' : 'text-ink-2'}>{s.label}</span>{s.count != null && <span className="ml-1 text-ink-muted">· {s.count}</span>}{s.note && <span className="block text-[11px] text-[var(--flare)]">{s.note}</span>}</span>
                  </li>
                ))}
                {!steps.length && evidence.length > 0 && <li className="text-[12px] text-ink-muted">Saved report</li>}
              </ol>
            </section>

            <div className="min-w-0 space-y-4">
              <section className="material p-4 sm:p-5" aria-label="Report">
                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--signal)]"><Sparkles size={13} />Report</p>
                {answer ? <Answer text={answer} onCite={cite} /> : error ? <p className="text-[13px] text-[var(--flare)]">{error}</p> : <div className="space-y-2" aria-label="Writing"><span className="block h-3 w-3/4 animate-pulse rounded bg-ink/10" /><span className="block h-3 w-full animate-pulse rounded bg-ink/10" /><span className="block h-3 w-5/6 animate-pulse rounded bg-ink/10" /></div>}
                {answer && !busy && <p className="mt-3 text-[11px] text-ink-muted">Written by Nansen&apos;s agent from the evidence below only. Tap a citation to see its source.</p>}
              </section>

              {evidence.length > 0 && (
                <section aria-label="Evidence" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {evidence.map((e) => (
                    <article key={e.id} ref={(el) => { if (el) evRefs.current.set(e.id, el); }} className={`material research-ev p-3 transition-shadow ${lit === e.id ? 'is-lit' : ''}`}>
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[11px] font-bold text-[var(--signal)]">{e.id}</span>
                        <span className="text-right text-[10.5px] text-ink-muted">{e.source}</span>
                      </div>
                      <p className="mt-1 text-[12px] text-ink-muted">{e.title}</p>
                      <p className="text-[15px] font-bold leading-snug" style={{ color: toneColor(e.tone) }}>{e.value}</p>
                      <p className="mt-0.5 text-[12px] leading-snug text-ink-2">{e.detail}</p>
                      {e.href && <Link prefetch={false} href={e.href} className="mt-1.5 inline-flex items-center gap-1 text-[11.5px] font-semibold text-ink-muted hover:text-ink">Open <ArrowRight size={12} /></Link>}
                    </article>
                  ))}
                </section>
              )}
            </div>
          </div>
        )}
      </div>

      <aside className="material h-fit p-4 xl:col-span-3" aria-label="Saved reports">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">Saved reports</p>
        {reports.length ? (
          <ol className="mt-2 divide-y divide-[var(--hair)]">
            {reports.slice(0, 12).map((r) => (
              <li key={r.id}><button type="button" onClick={() => open(r)} className="w-full py-2 text-left hover:text-ink">
                <span className="block truncate text-[13px] font-semibold text-ink">{r.target}</span>
                <span className="block truncate text-[11.5px] text-ink-muted">{MODES.find((x) => x.id === r.mode)?.title} · {new Date(r.at).toISOString().slice(5, 16).replace('T', ' ')} · {r.evidence.length} evidence</span>
              </button></li>
            ))}
          </ol>
        ) : <p className="mt-2 text-[12.5px] text-ink-muted">Reports you run are kept here.</p>}
      </aside>
    </div>
  );
}
