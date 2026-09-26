import { PRESSURE_LEGEND, fillVar } from '@/lib/viz/scales';

export function PressureLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-ink-muted">
      <div className="flex items-center gap-2">
        <span>Outflow</span>
        <span className="flex overflow-hidden rounded-sm" aria-hidden>
          {PRESSURE_LEGEND.map((s) => (
            <span key={s.cls} className="h-2.5 w-7" style={{ background: fillVar(s.cls) }} title={`Flow Index ${s.label}`} />
          ))}
        </span>
        <span>Inflow</span>
        <span className="sr-only">
          Flow Index scale: {PRESSURE_LEGEND.map((s) => s.label).join(', ')}; below 35 is distribution, above 65 accumulation.
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
          <polygon points="7,1 12.2,4 12.2,10 7,13 1.8,10 1.8,4" fill="none" stroke="var(--axis)" strokeWidth="1.25" />
        </svg>
        <span>no reading, not neutral</span>
      </div>
      <div className="flex items-center gap-1.5">
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
          <polygon points="7,1 12.2,4 12.2,10 7,13 1.8,10 1.8,4" fill="none" stroke="var(--in-3)" strokeWidth="1" />
        </svg>
        <span>ring: flow up 5+ in 6h</span>
      </div>
      <span>A/B/C · data tier</span>
    </div>
  );
}
