import { PRESSURE_LEGEND, fillVar } from '@/lib/viz/scales';

export function PressureLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-ink-muted">
      <div className="flex items-center gap-2">
        <span>Outflow</span>
        <span className="flex overflow-hidden rounded-sm" aria-hidden>
          {PRESSURE_LEGEND.map((s) => (
            <span key={s.cls} className="h-2.5 w-7" style={{ background: fillVar(s.cls) }} title={`CPI ${s.label}`} />
          ))}
        </span>
        <span>Inflow</span>
        <span className="sr-only">
          Chain Pressure Index scale: {PRESSURE_LEGEND.map((s) => s.label).join(', ')}; below 35 is low pressure, above 65 high.
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
          <polygon points="7,1 12.2,4 12.2,10 7,13 1.8,10 1.8,4" fill="none" stroke="var(--axis)" strokeWidth="1.25" />
        </svg>
        <span>no reading — not neutral</span>
      </div>
      <div className="flex items-center gap-1.5">
        <svg width="26" height="10" viewBox="0 0 26 10" aria-hidden>
          <path d="M1,5 L22,5" stroke="var(--ink-1)" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M19,2 L25,5 L19,8 z" fill="var(--ink-1)" />
        </svg>
        <span>rotation front · width = USD · opacity = confidence</span>
      </div>
      <div className="flex items-center gap-1.5">
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
          <polygon points="7,1 12.2,4 12.2,10 7,13 1.8,10 1.8,4" fill="none" stroke="var(--in-3)" strokeWidth="1" />
        </svg>
        <span>isobar: pressure up 5+ in 6h</span>
      </div>
      <span>A/B/C · data tier</span>
    </div>
  );
}
