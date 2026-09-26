'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Sparkles, X } from 'lucide-react';
import { Line } from '@/components/perps/terminal/AnalystPanel';

/** "Explain this view": sends the module's own data to Nansen's agent (200 credits) and streams a data-backed explanation. */
export function ExplainView({ view, context, coins = [] }: { view: string; context: unknown; coins?: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [tools, setTools] = useState<string[]>([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const ran = useRef(false);
  const run = async () => {
    setOpen(true);
    if (ran.current) return;
    ran.current = true;
    setBusy(true);
    try {
      const r = await fetch('/api/explain', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ view, context }) });
      if (!r.ok || !r.body) { setErr((await r.json().catch(() => ({ error: 'Unavailable.' }))).error); ran.current = false; return; }
      const reader = r.body.getReader(); const dec = new TextDecoder(); let buf = '', acc = '';
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split('\n\n'); buf = parts.pop() ?? '';
        for (const ev of parts) {
          const d = ev.split('\n').find((l) => l.startsWith('data: '))?.slice(6); if (!d) continue;
          const e = JSON.parse(d);
          if (e.type === 'delta') { acc += e.text; setText(acc); } else if (e.type === 'tool') setTools((t) => [...t, e.name]); else if (e.type === 'error') setErr(e.message);
        }
      }
    } catch { setErr('The connection dropped. Try again.'); ran.current = false; } finally { setBusy(false); }
  };
  const coinSet = new Set(coins);
  return (
    <>
      <button type="button" onClick={run} className="inline-flex items-center gap-1 rounded-full border border-[var(--hair)] px-2.5 py-1 text-[12px] font-semibold text-ink-2 transition-colors hover:border-[var(--hair-2)] hover:text-ink" title="Nansen agent">
        <Sparkles className="h-3 w-3 text-brand" aria-hidden />Explain this view
      </button>
      {open && (
        <div role="dialog" aria-label="Explanation" className="spotlight material-strong fixed bottom-4 right-4 z-40 max-h-[70vh] w-[min(440px,calc(100vw-2rem))] overflow-y-auto rounded-[16px] p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="inline-block rounded-[5px] bg-[color-mix(in_srgb,var(--signal)_16%,transparent)] px-1.5 py-px text-[10.5px] font-bold text-[var(--signal)]">AI analysis · {view}</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="grid h-6 w-6 place-items-center rounded-full hover:bg-ink/10"><X className="h-3.5 w-3.5" aria-hidden /></button>
          </div>
          {tools.length > 0 && <p className="mb-1 flex flex-wrap gap-1">{tools.map((t, i) => <span key={i} className="rounded bg-ink/8 px-1.5 font-mono text-[10.5px] text-ink-2">{t}</span>)}</p>}
          <div className="text-[13px] leading-relaxed text-ink-2">
            {text.split('\n').filter(Boolean).map((l, i) => <p key={i} className={`mt-1 ${/^evidence:/i.test(l.trim()) ? 'border-t border-[var(--hair)] pt-1.5 text-[12px] text-ink-muted' : ''}`}><Line text={l} coins={coinSet} onRange={() => router.push('/perps/BTC')} /></p>)}
          </div>
          {busy && <p className="mt-2 flex items-center gap-1.5 text-[12px] text-ink-muted"><Loader2 className="h-3 w-3 animate-spin" aria-hidden />{text ? 'Writing' : 'Reading the view'}</p>}
          {err && <p role="alert" className="mt-2 text-[12.5px] text-[var(--flare)]">{err}</p>}
          {!busy && text && <p className="mt-2 text-[11px] text-ink-muted">Based on the data shown</p>}
        </div>
      )}
    </>
  );
}
