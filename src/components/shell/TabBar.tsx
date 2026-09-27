'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Radar, Shuffle, Search, Activity, Target, ShieldCheck, CopyCheck, Wallet, Sparkles } from 'lucide-react';
import { useSite } from '@/components/SiteContext';

/** Phones: a Liquid Glass tab bar. A capsule floating above content (inset from the edges), a glass lens under
 *  the current tab, and search as its own control at the trailing end. It shrinks to icons while scrolling down
 *  and expands on scrolling up or reaching the top. */
export function TabBar() {
  const path = usePathname();
  const { publicSite } = useSite();
  const [min, setMin] = useState(false);
  const [asking, setAsking] = useState(false);
  useEffect(() => { const on = (e: Event) => setAsking(!!(e as CustomEvent<boolean>).detail); addEventListener('peregrine:analyze-state', on); return () => removeEventListener('peregrine:analyze-state', on); }, []);
  const last = useRef(0);
  // A public site has no Ask Nansen (paid agent runs).
  // The product's story as top-level tabs: today's read, token risk, who to copy, wallets. The rest lives in Today's Explore grid.
  const tabs = publicSite
    ? [['/', 'Today', Radar], ['/token', 'Tokens', ShieldCheck], ['/flows', 'Flows', Shuffle], ['/perps', 'Perps', Activity], ['/predict', 'Markets', Target]] as const
    : [['/', 'Today', Radar], ['/token', 'Tokens', ShieldCheck], ['/copy', 'Copy', CopyCheck], ['/wallet', 'Wallets', Wallet]] as const;
  const current = tabs.findIndex(([href]) => (href === '/' ? path === '/' : path.startsWith(String(href))));
  // The lens moves on the tap itself, not when the next page arrives from the server.
  const [tapped, setTapped] = useState<number | null>(null);
  useEffect(() => setTapped(null), [path]);
  const shown = tapped ?? current;
  // Liquid: the lens stretches along its path and settles back into shape as it lands.
  const lens = useRef<HTMLSpanElement>(null);
  const was = useRef(shown);
  useEffect(() => {
    if (was.current === shown) return;
    const far = Math.min(3, Math.abs(shown - was.current));
    was.current = shown;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    lens.current?.animate(
      [{ scale: '1 1' }, { scale: `${1 + 0.16 * far} ${1 - 0.06 * far}`, offset: 0.35 }, { scale: '0.96 1.04', offset: 0.7 }, { scale: '1 1' }],
      { duration: 460, easing: 'cubic-bezier(.3,.7,.4,1)' },
    );
  }, [shown]);

  useEffect(() => {
    const onScroll = () => {
      const y = scrollY, d = y - last.current;
      if (y < 80) setMin(false);
      else if (d > 6) setMin(true);
      else if (d < -10) setMin(false);
      last.current = y;
    };
    addEventListener('scroll', onScroll, { passive: true });
    return () => removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => setMin(false), [path]);

  return (
    <>
      <div aria-hidden className="glass-edge lg:hidden" />
      <nav aria-label="Quick navigation" className={`glass-dock lg:hidden ${min ? 'is-min' : ''}`}>
        <div className="glass-bar glass-tabs" style={{ '--n': tabs.length, '--i': Math.max(0, shown) } as React.CSSProperties}>
          {shown >= 0 && <span ref={lens} aria-hidden className="glass-lens" />}
          {tabs.map(([href, label, Icon], i) => (
            <Link prefetch={false} key={String(href)} href={String(href)} onClick={() => i !== current && setTapped(i)} aria-current={i === current ? 'page' : undefined} className={`glass-tab ${i === shown ? 'is-on' : ''}`}>
              <Icon size={22} strokeWidth={i === shown ? 2.3 : 1.9} aria-hidden />
              <span className="glass-tab-label">{String(label)}</span>
            </Link>
          ))}
        </div>
        <div className="glass-bar glass-actions">
          {!publicSite && (
            <button type="button" aria-label="Ask about this screen" aria-pressed={asking} className={`glass-action ${asking ? 'is-on' : ''}`} onClick={() => window.dispatchEvent(new CustomEvent('peregrine:analyze-toggle'))}>
              <Sparkles size={21} strokeWidth={2} aria-hidden />
            </button>
          )}
          <button type="button" aria-label="Search" className="glass-action" onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}>
            <Search size={21} strokeWidth={2} aria-hidden />
          </button>
        </div>
      </nav>
    </>
  );
}
