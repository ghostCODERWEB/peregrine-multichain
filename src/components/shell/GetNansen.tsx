'use client';
import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { NANSEN_REF_URL } from '@/config/referral';

// Nansen's own icon, served from the host nansen.ai uses for it (its apple-touch-icon).
const NANSEN_ICON = 'https://framerusercontent.com/images/NKwtRwJIxYWpzW6NWnqma6yeJ0.png';

/** One Nansen button style for every link to Nansen: logo tile, label, chevron. */
export function NansenButton({ href, label, size = 'md', logo = true, className = '' }: { href: string; label: string; size?: 'sm' | 'md'; logo?: boolean; className?: string }) {
  const [iconOk, setIconOk] = useState(true);
  const sm = size === 'sm';
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={`get-nansen group items-center font-extrabold tracking-[-0.01em] ${sm ? `inline-flex h-10 gap-2 rounded-[12px] ${logo ? 'pl-1.5' : 'pl-3.5'} pr-2.5 text-[13px]` : 'flex gap-2.5 rounded-[14px] py-2 pl-2 pr-3 text-[13.5px]'} ${className}`}>
      {logo && <span className={`grid shrink-0 place-items-center overflow-hidden bg-[#0b1a17] shadow-[inset_0_0_0_1px_rgba(255,255,255,.12)] ${sm ? 'h-7 w-7 rounded-[8px]' : 'h-8 w-8 rounded-[9px]'}`}>
        {iconOk ? (
          // eslint-disable-next-line @next/next/no-img-element -- Nansen's own hosted icon; no optimizer proxy
          <img src={NANSEN_ICON} alt="" width={32} height={32} referrerPolicy="no-referrer" onError={() => setIconOk(false)} className="h-full w-full object-cover" />
        ) : <span className="text-[15px] font-black text-[#5ff5c8]">N</span>}
      </span>}
      <span className="min-w-0 flex-1 whitespace-nowrap leading-tight">{label}</span>
      <ChevronRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" strokeWidth={2.75} aria-hidden />
    </a>
  );
}

/** The Get Nansen call to action (referral link). */
export function GetNansen({ className = '' }: { className?: string }) {
  return <NansenButton href={NANSEN_REF_URL} label="Get Nansen" className={className} />;
}
