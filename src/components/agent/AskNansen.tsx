'use client';
// Lightweight Ask Nansen trigger. The contextual research panel, Sheet and
// conversation state are code-split and imported only after the first open.
// Opening still costs nothing; a billable question keeps its own explicit
// 750-credit confirmation inside the panel.
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import type { Subject } from '@/server/agents/ask';

const Panel = dynamic(() => import('./AskNansenPanel').then((m) => m.AskNansenPanel), {
  ssr: false,
  loading: () => <span role="status" className="text-[11px] text-ink-muted">Opening research panel…</span>,
});

export interface AskNansenProps {
  subject: Subject;
  label: string;
  attachTo?: { callId: number; onAttached?: () => void };
  autoOpen?: boolean;
  buttonClassName?: string;
  buttonLabel?: string;
}

/** The trigger is rendered here from primitive props, never passed in as a
 * render function, so Server Component callers remain serializable. */
export function AskNansen({ subject, label, attachTo, autoOpen, buttonClassName, buttonLabel = 'Ask Nansen' }: AskNansenProps) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  // `/ask TOKEN` lands here with ?ask=1. Defer until mount so hydration stays stable.
  useEffect(() => { if (autoOpen) { setMounted(true); setOpen(true); } }, [autoOpen]);
  const show = () => { setMounted(true); setOpen(true); };

  return (
    <>
      <button type="button" onClick={show} className={`owner-action ${buttonClassName ?? 'rounded border border-border px-3 py-1.5 text-[12.5px] text-ink-2 hover:text-ink hover:border-ink-muted'}`}>{buttonLabel}</button>
      {mounted && <Panel subject={subject} label={label} attachTo={attachTo} open={open} onOpenChange={setOpen} />}
    </>
  );
}
