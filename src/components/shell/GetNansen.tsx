import { NANSEN_REF_URL } from '@/config/referral';

/** The Get Nansen call to action, in Nansen's mint green, opening the referral link in a new tab. */
export function GetNansen({ className = '' }: { className?: string }) {
  return (
    <a href={NANSEN_REF_URL} target="_blank" rel="noopener noreferrer" className={`get-nansen group relative inline-flex shrink-0 items-center gap-2 overflow-hidden rounded-full px-4 py-1.5 text-[13px] font-extrabold tracking-[-0.01em] ${className}`}>
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden><path fill="currentColor" d="M4 20V4h3.2l9.6 10.6V4H20v16h-3.2L7.2 9.4V20z" /></svg>
      Get Nansen
      <span aria-hidden className="text-[15px] leading-none transition-transform group-hover:translate-x-0.5">›</span>
    </a>
  );
}
