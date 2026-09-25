import Link from 'next/link';
import { LockKeyhole } from 'lucide-react';
import type { ReactNode, ButtonHTMLAttributes } from 'react';

export function PillButton({ className = '', variant = 'primary', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'trade' }) {
  return <button {...props} className={`pill-button pill-${variant} ${className}`} />;
}
export function StatTile({ label, children }: { label: string; children: ReactNode }) {
  return <div className="inset-well rounded-[18px] p-4"><div className="text-[12.5px] text-ink-muted">{label}</div><div className="num mt-1 text-[22px] font-extrabold">{children}</div></div>;
}
export function BandBadge({ children, color = 'var(--mint)' }: { children: ReactNode; color?: string }) {
  return <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold" style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}><span className="h-1.5 w-1.5 rounded-full bg-current" />{children}</span>;
}
export function EmptyValue({ reason }: { reason: string }) {
  return <span className="text-ink-muted">— <span className="text-xs font-normal">{reason}</span></span>;
}
/** The one withheld-data state. `compact` is a single row, for sections
 *  under a page that already shows the full panel. */
const WHY = 'Nansen’s redistribution rules keep smart-money evidence in its key owner’s view.';
/** `reason` replaces the generic sentence when the caller knows exactly why
 *  this section is withheld (missing data always says why). */
export function LockedPanel({ heading = 'Owner view only', compact = false, reason = WHY }: { heading?: string; compact?: boolean; reason?: string }) {
  if (compact) return <div className="inset-well flex flex-wrap items-center gap-3 px-4 py-3"><LockKeyhole size={16} className="shrink-0 text-ink-2" aria-hidden /><p className="min-w-0 flex-1 text-[13px] text-ink-2"><span className="font-bold text-ink">{heading}.</span> {reason}</p><Link href="/account" className="pill-button pill-secondary !min-h-[34px] !py-1.5">Use my Nansen key</Link></div>;
  return <div className="flex flex-col items-center justify-center gap-4 px-4 py-8 text-center"><div className="inset-well grid h-12 w-12 place-items-center"><LockKeyhole size={22} className="text-ink-2" /></div><h3 className="text-lg font-bold">{heading}</h3><p className="max-w-sm text-[13px] leading-relaxed text-ink-muted">{reason}</p><Link href="/account" className="pill-button pill-primary">Use my Nansen key</Link></div>;
}
