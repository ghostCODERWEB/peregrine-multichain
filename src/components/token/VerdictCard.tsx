'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, ShieldAlert, ShieldX, Sparkles, CircleDot, TrendingUp, TrendingDown } from 'lucide-react';
import type { Verdict, VerdictReason } from '@/server/token/verdict';

const LOOK = {
  safe: { word: 'Low risk', color: 'var(--mint)', Icon: ShieldCheck },
  watch: { word: 'Watch', color: 'var(--amber)', Icon: ShieldAlert },
  danger: { word: 'Danger', color: 'var(--flare)', Icon: ShieldX },
} as const;
const reasonIcon = (t: VerdictReason['tone']) => (t === 'bad' ? <TrendingDown size={14} style={{ color: 'var(--flare)' }} aria-hidden /> : t === 'good' ? <TrendingUp size={14} style={{ color: 'var(--mint)' }} aria-hidden /> : <CircleDot size={13} className="text-ink-muted" aria-hidden />);

/** "Should I be worried about this token?": the verdict from the stored Token Score, its reasons, and one agent sentence. */
export function VerdictCard({ chain, address, ready }: { chain: string; address: string; ready: boolean }) {
  const [v, setV] = useState<Verdict | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    let live = true;
    const base = `/api/verdict?chain=${encodeURIComponent(chain)}&address=${encodeURIComponent(address)}`;
    (async () => {
      // A stored score shows at once; otherwise wait for the page to store its fresh one (ready), then retry briefly.
      for (let i = 0; i < (ready ? 6 : 1) && live; i++) {
        const r = await fetch(base).then((x) => x.json() as Promise<Verdict | { pending: true }>).catch(() => null);
        if (r && !r.pending) {
          if (!live) return;
          setV(r);
          if (!r.ai) {
            setAiLoading(true);
            const withAi = await fetch(`${base}&ai=1`).then((x) => x.json() as Promise<Verdict>).catch(() => null);
            if (live) { if (withAi && !withAi.pending) setV(withAi); setAiLoading(false); }
          }
          return;
        }
        await new Promise((res) => setTimeout(res, 2500));
      }
    })();
    return () => { live = false; };
  }, [chain, address, ready]);

  if (!v) return null;
  const look = LOOK[v.level];
  return (
    <section aria-label="Token verdict" className="material overflow-hidden p-4 sm:p-5" style={{ boxShadow: `inset 3px 0 0 ${look.color}` }}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl" style={{ background: `color-mix(in srgb, ${look.color} 16%, transparent)`, color: look.color }}><look.Icon size={24} aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">Verdict{v.symbol ? ` on ${v.symbol}` : ''}</p>
          <p className="text-[18px] font-extrabold leading-tight sm:text-[20px]" style={{ color: look.color }}>{look.word}<span className="ml-2 text-[14px] font-semibold text-ink-2">{v.headline.replace(/^(Danger|Watch): /, '')}</span></p>
        </div>
        <div className="text-right">
          <p className="num text-[26px] font-extrabold leading-none text-ink">{Math.round(v.score)}<span className="text-[13px] font-semibold text-ink-muted">/100</span></p>
          <p className="num mt-1 text-[11px] text-ink-muted">Nansen {v.nansen != null ? Math.round(v.nansen) : 'n/a'} · Peregrine {v.peregrine != null ? Math.round(v.peregrine) : 'n/a'}</p>
        </div>
      </div>
      <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {v.reasons.map((r, i) => <li key={i} className="flex items-start gap-2 text-[12.5px] leading-snug text-ink-2"><span className="mt-0.5 shrink-0">{reasonIcon(r.tone)}</span>{r.text}</li>)}
      </ul>
      <div className="mt-3 flex items-start gap-2 rounded-[var(--r-inner)] border border-[color-mix(in_srgb,var(--signal)_30%,var(--hair))] bg-[color-mix(in_srgb,var(--signal)_6%,transparent)] p-3 text-[12.5px] leading-relaxed text-ink">
        <Sparkles size={14} className="mt-0.5 shrink-0 text-[var(--signal)]" aria-hidden />
        {v.ai ? <span>{v.ai.text}</span> : aiLoading ? <span className="text-ink-muted">Nansen agent is reading the signals…</span> : <span className="text-ink-muted">agent note unavailable right now.</span>}
      </div>
      <p className="mt-2 text-[11px] text-ink-muted">Rule: 55+ Danger, 35+ Watch, else Low risk. <Link prefetch={false} href="/proof" className="font-semibold text-ink-2 hover:text-ink">How well the score works</Link></p>
    </section>
  );
}
