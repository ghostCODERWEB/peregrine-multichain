'use client';
import { Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { Provenance } from '@/lib/provenance';

export function InfoPopover({ p, className = '' }: { p: Provenance; className?: string }) {
  return (
    <Popover>
      <PopoverTrigger
        className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-accent hover:text-ink focus-visible:ring-2 focus-visible:ring-ring ${className}`}
        aria-label={`How this is computed: ${p.title}`}
      >
        <Info className="h-3.5 w-3.5" />
      </PopoverTrigger>
      <PopoverContent className="w-[min(92vw,420px)] gap-3 p-3.5" align="start">
        <div className="text-sm font-medium text-ink">{p.title}</div>
        <code className="block whitespace-pre-wrap rounded-md bg-accent px-2.5 py-2 text-[12px] leading-relaxed text-ink num">
          {p.formula}
        </code>
        {p.inputs.length > 0 && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[12px]">
            {p.inputs.map((i) => (
              <div key={i.label} className="contents">
                <dt className="text-ink-muted">{i.label}</dt>
                <dd className="text-right text-ink num">{i.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {p.calls.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[11px] uppercase tracking-wider text-ink-muted">Nansen call{p.calls.length > 1 ? 's' : ''}</div>
            {p.calls.map((c, i) => (
              <div key={i} className="rounded-md border border-border px-2.5 py-2 text-[11.5px]">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="num text-ink">POST /api/v1/{c.endpoint}</span>
                  {c.credits != null && <span className="text-ink-muted num">{c.credits} cr</span>}
                </div>
                {c.body !== undefined && (
                  <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-all text-[11px] text-ink-2 num">
                    {JSON.stringify(c.body)}
                  </pre>
                )}
                {c.ref && <div className="mt-1 text-ink-muted num">{c.ref}</div>}
              </div>
            ))}
          </div>
        )}
        {p.notes?.map((n) => (
          <p key={n} className="text-[12px] leading-snug text-ink-2">{n}</p>
        ))}
      </PopoverContent>
    </Popover>
  );
}
