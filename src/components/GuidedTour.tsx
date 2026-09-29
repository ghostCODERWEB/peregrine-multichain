'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowRight, X } from 'lucide-react';

type Step = { title: string; body: string; href: string; cta: string };
const STEPS: Step[] = [
  { title: 'Every token gets a risk score', body: 'Risk Score runs from 0 (safest) to 100 (riskiest): half Nansen’s own risk indicators, half Peregrine’s model of holders, insiders, liquidity and sell pressure.', href: '/token', cta: 'Open Token Checker' },
  { title: 'Smart Money buying into danger', body: 'When Smart Money wallets buy tokens that score High or Critical, Peregrine flags it. That is the signal to look at first.', href: '/token#sm-risk', cta: 'See who is buying risk' },
  { title: 'Can you actually copy them?', body: 'Copy Lab replays every Smart Money buy against Nansen price candles: what you would make entering 15 minutes, 1 hour or 6 hours late. Only a few wallets stay profitable to follow.', href: '/copy', cta: 'Open Copy Lab' },
  { title: 'The wallet behind the move', body: 'Open any wallet on one page: holdings, realized PnL, counterparties, who funded it, and its ENS name.', href: '/wallet', cta: 'Open the Profiler' },
  { title: 'Measured, not claimed', body: '7,903 Nansen API calls across 82 endpoints, and a risk score tested on weeks it never saw.', href: '/proof', cta: 'See the proof' },
];
const KEY = 'pg-tour-v1';

/** A five-step guided tour for first-time visitors (and judges): the product's one story, each step one tap away. */
export function GuidedTour() {
  const router = useRouter();
  const path = usePathname();
  const [step, setStep] = useState<number | null>(null);

  useEffect(() => {
    const force = new URLSearchParams(location.search).get('tour') === '1';
    try {
      const saved = localStorage.getItem(KEY);
      if (force) { localStorage.setItem(KEY, '0'); setStep(0); return; }
      if (saved === null) { localStorage.setItem(KEY, '0'); setStep(0); return; }
      if (saved !== 'done') setStep(Number(saved) || 0);
    } catch { if (force) setStep(0); }
  }, [path]);

  const save = (v: number | 'done') => { try { localStorage.setItem(KEY, String(v)); } catch { /* storage blocked */ } };
  if (step == null || step >= STEPS.length) return null;
  const s = STEPS[step];
  const close = () => { save('done'); setStep(null); };
  const go = () => {
    const next = step + 1;
    if (next >= STEPS.length) save('done'); else save(next);
    setStep(next >= STEPS.length ? null : next);
    router.push(s.href);
  };

  return (
    <aside role="dialog" aria-label="Guided tour" className="tour-card glass-bar">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5">
          {STEPS.map((_, i) => <span key={i} className="h-1.5 rounded-full transition-all" style={{ width: i === step ? 18 : 6, background: i <= step ? 'var(--mint)' : 'var(--hair-2)' }} />)}
          <span className="num ml-1 text-[11px] text-ink-muted">{step + 1} of {STEPS.length}</span>
        </span>
        <button type="button" onClick={close} aria-label="Close tour" className="grid h-7 w-7 place-items-center rounded-full text-ink-muted hover:text-ink"><X size={15} /></button>
      </div>
      <p className="mt-2 text-[15px] font-bold leading-snug text-ink">{s.title}</p>
      <p className="mt-1 text-[12.5px] leading-relaxed text-ink-2">{s.body}</p>
      <div className="mt-3 flex items-center gap-2">
        <button type="button" onClick={go} className="get-nansen inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[12.5px] font-extrabold">{s.cta}<ArrowRight size={14} /></button>
        <button type="button" onClick={close} className="h-9 rounded-full px-3 text-[12.5px] font-semibold text-ink-muted hover:text-ink">Skip</button>
      </div>
    </aside>
  );
}
