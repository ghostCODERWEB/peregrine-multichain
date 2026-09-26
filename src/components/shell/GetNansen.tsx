'use client';
import { useState } from 'react';
import { NANSEN_REF_URL } from '@/config/referral';

// Nansen's own icon, served from the host nansen.ai uses for it (its apple-touch-icon).
const NANSEN_ICON = 'https://framerusercontent.com/images/NKwtRwJIxYWpzW6NWnqma6yeJ0.png';

/** The Get Nansen call to action with Nansen's logo, opening the referral link in a new tab. */
export function GetNansen({ className = '' }: { className?: string }) {
  const [iconOk, setIconOk] = useState(true);
  return (
    <a href={NANSEN_REF_URL} target="_blank" rel="noopener noreferrer" className={`get-nansen group relative flex items-center gap-2.5 overflow-hidden rounded-[14px] py-2 pl-2 pr-3 text-[13.5px] font-extrabold tracking-[-0.01em] ${className}`}>
      <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-[9px] bg-[#0b1a17] shadow-[inset_0_0_0_1px_rgba(255,255,255,.12)]">
        {iconOk ? (
          // eslint-disable-next-line @next/next/no-img-element -- Nansen's own hosted icon; no optimizer proxy
          <img src={NANSEN_ICON} alt="" width={32} height={32} referrerPolicy="no-referrer" onError={() => setIconOk(false)} className="h-full w-full object-cover" />
        ) : <span className="text-[15px] font-black text-[#5ff5c8]">N</span>}
      </span>
      <span className="min-w-0 flex-1 leading-tight">Get Nansen<span className="block text-[10.5px] font-semibold opacity-70">Onchain AI analytics</span></span>
      <span aria-hidden className="text-[18px] leading-none transition-transform group-hover:translate-x-0.5">›</span>
    </a>
  );
}
