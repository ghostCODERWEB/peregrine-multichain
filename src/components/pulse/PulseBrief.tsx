'use client';
import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import type { PulseBrief as Brief } from '@/server/pulse-brief';

/** Nansen's agent summarizing the pulse; the shared brief arrives from /api/pulse. */
export function PulseBrief({ initial, briefKey = 'pulse' }: { initial: Brief | null; briefKey?: string }) {
  const [brief, setBrief] = useState<Brief | null>(initial);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (initial && Date.now() - initial.at < 3_600_000) return;
    let live = true;
    fetch(`/api/pulse?key=${briefKey}`).then((r) => r.json()).then((d: { brief: Brief | null }) => { if (live) { if (d.brief) setBrief(d.brief); else if (!initial) setFailed(true); } }).catch(() => live && !initial && setFailed(true));
    return () => { live = false; };
  }, [initial, briefKey]);
  if (failed) return null;
  return (
    <div className="flex w-full min-w-0 flex-col gap-2 rounded-[var(--r-inner)] border border-[color-mix(in_srgb,var(--signal)_30%,var(--hair))] bg-[color-mix(in_srgb,var(--signal)_6%,transparent)] p-3.5">
      <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--signal)]"><Sparkles className="h-3.5 w-3.5" aria-hidden />Nansen AI</span>
      {brief ? (
        <p className="line-clamp-6 text-[13px] leading-[1.5] text-ink sm:line-clamp-none sm:text-[13.5px] sm:leading-[1.55]">{brief.text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')}</p>
      ) : (
        <div className="space-y-2" aria-label="Writing the brief">
          <span className="block h-3 w-full animate-pulse rounded bg-ink/10" /><span className="block h-3 w-11/12 animate-pulse rounded bg-ink/10" /><span className="block h-3 w-3/4 animate-pulse rounded bg-ink/10" />
        </div>
      )}
      {brief && <span className="num mt-auto text-[10.5px] text-ink-muted">agent/fast · {new Date(brief.at).toISOString().slice(11, 16)} UTC</span>}
    </div>
  );
}
