import Link from 'next/link';
import type { Metadata } from 'next';
import { BrandMark } from '@/components/shell/BrandMark';

export const metadata: Metadata = { title: 'Off the radar · Peregrine' };

const LINKS: Array<[string, string, string]> = [
  ['/', 'Overview', 'The market at a glance'],
  ['/perps', 'Perps', 'Leverage, funding and liquidations'],
  ['/predict', 'Predictions', 'Polymarket odds and movers'],
  ['/smart-money', 'Smart Money', 'What the best wallets do'],
];

/** 404: the page flew off the radar. */
export default function NotFound() {
  return (
    <div className="nf relative flex min-h-[78vh] flex-col items-center justify-center overflow-hidden px-4 py-12 text-center">
      <div className="nf-radar relative" aria-hidden>
        <span className="nf-ring" style={{ '--r': '100%' } as React.CSSProperties} />
        <span className="nf-ring" style={{ '--r': '70%' } as React.CSSProperties} />
        <span className="nf-ring" style={{ '--r': '40%' } as React.CSSProperties} />
        <span className="nf-cross" />
        <span className="nf-sweep" />
        <span className="nf-blip" style={{ '--x': '22%', '--y': '30%', '--d': '0s' } as React.CSSProperties} />
        <span className="nf-blip" style={{ '--x': '74%', '--y': '24%', '--d': '1.1s' } as React.CSSProperties} />
        <span className="nf-blip" style={{ '--x': '66%', '--y': '72%', '--d': '2.2s' } as React.CSSProperties} />
        <span className="nf-blip nf-blip-lost" style={{ '--x': '30%', '--y': '76%', '--d': '0.6s' } as React.CSSProperties} />
        <span className="nf-falcon"><BrandMark size={44} /></span>
      </div>
      <h1 className="nf-code mt-8 text-[88px] font-black leading-none tracking-[-0.05em] sm:text-[120px]">404</h1>
      <p className="mt-2 text-[20px] font-bold text-ink">This page flew off the radar</p>
      <p className="mt-1 max-w-[44ch] text-[14px] text-ink-2">The address does not match any market, wallet, token or page Peregrine tracks. Pick up the trail from one of these:</p>
      <ul className="mt-6 grid w-full max-w-[680px] gap-2 sm:grid-cols-2">
        {LINKS.map(([href, name, sub], i) => (
          <li key={href} className="nf-link" style={{ '--i': i } as React.CSSProperties}>
            <Link href={href} className="group flex items-center justify-between gap-3 rounded-[14px] border border-[var(--hair)] bg-[var(--surface-1)] px-4 py-3 text-left transition-colors hover:border-[color-mix(in_srgb,#1fe0a3_45%,var(--hair))]">
              <span><span className="block text-[14px] font-bold text-ink">{name}</span><span className="block text-[12px] text-ink-muted">{sub}</span></span>
              <span aria-hidden className="text-[18px] text-ink-muted transition-transform group-hover:translate-x-1 group-hover:text-[#1fe0a3]">›</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-5 text-[12.5px] text-ink-muted">Or press <span className="kbd">⌘K</span> to search any token, wallet or market.</p>
    </div>
  );
}
