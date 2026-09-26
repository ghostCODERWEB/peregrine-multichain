'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Radar, Shuffle, MessageCircle, Search, Activity, Target } from 'lucide-react';
import { useSite } from '@/components/SiteContext';

/** Phones: a Liquid Glass tab bar. A capsule floating above content (inset from the edges), a glass lens under
 *  the current tab, and search as its own control at the trailing end. It shrinks to icons while scrolling down
 *  and expands on scrolling up or reaching the top. */
export function TabBar() {
  const path = usePathname();
  const { publicSite } = useSite();
  const [min, setMin] = useState(false);
  const last = useRef(0);
  // A public site has no Ask Nansen (paid agent runs).
  const tabs = publicSite
    ? [['/', 'Overview', Radar], ['/flows', 'Flows', Shuffle], ['/perps', 'Perps', Activity], ['/predict', 'Markets', Target]] as const
    : [['/', 'Overview', Radar], ['/flows', 'Flows', Shuffle], ['/perps', 'Perps', Activity], ['/agent', 'Ask', MessageCircle]] as const;
  const current = tabs.findIndex(([href]) => (href === '/' ? path === '/' : path.startsWith(String(href))));

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
        <div className="glass-bar glass-tabs" style={{ '--n': tabs.length, '--i': Math.max(0, current) } as React.CSSProperties}>
          {current >= 0 && <span aria-hidden className="glass-lens" />}
          {tabs.map(([href, label, Icon], i) => (
            <Link key={String(href)} href={String(href)} aria-current={i === current ? 'page' : undefined} className={`glass-tab ${i === current ? 'is-on' : ''}`}>
              <Icon size={22} strokeWidth={i === current ? 2.3 : 1.9} aria-hidden />
              <span className="glass-tab-label">{String(label)}</span>
            </Link>
          ))}
        </div>
        <button type="button" aria-label="Search" className="glass-bar glass-search" onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}>
          <Search size={22} strokeWidth={2} aria-hidden />
        </button>
      </nav>
    </>
  );
}
