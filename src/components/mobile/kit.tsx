'use client';
import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

/** iOS large title: a big leading title that hands over to a small centered title in a glass bar once scrolled past. */
export function LargeTitle({ title, caption, trailing }: { title: string; caption?: ReactNode; trailing?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [inline, setInline] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInline(!e.isIntersecting), { rootMargin: '-64px 0px 0px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <>
      <div className={`m-inline-title ${inline ? 'is-on' : ''}`} aria-hidden={!inline}>{title}</div>
      <header className="m-large-title">
        {caption && <p className="m-caption">{caption}</p>}
        <div className="flex items-end justify-between gap-3">
          <h1 ref={ref} className="m-title">{title}</h1>
          {trailing}
        </div>
      </header>
    </>
  );
}

/** A titled group: small uppercase header on the leading side, optional "See all" on the trailing side. */
export function Group({ title, href, action = 'See all', children, footer }: { title?: string; href?: string; action?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <section className="m-group">
      {title && (
        <div className="m-group-head">
          <h2>{title}</h2>
          {href && <Link prefetch={false} href={href} className="m-see-all">{action}</Link>}
        </div>
      )}
      {children}
      {footer && <p className="m-group-foot">{footer}</p>}
    </section>
  );
}

/** Inset grouped list (iOS Settings style): rounded container, hairline separators inset past the leading icon. */
export function List({ children, page }: { children: ReactNode; page?: number | boolean }) {
  // `page` splits a long list into numbered pages (TablePager); a number sets rows per page.
  return <ul className="m-list" data-page={page === true ? '' : page || undefined}>{children}</ul>;
}

export function Row({ href, leading, title, subtitle, trailing, trailingSub, tone }: {
  href?: string; leading?: ReactNode; title: ReactNode; subtitle?: ReactNode; trailing?: ReactNode; trailingSub?: ReactNode; tone?: 'in' | 'out';
}) {
  const body = (
    <>
      {leading && <span className="m-row-lead">{leading}</span>}
      <span className="m-row-main"><span className="m-row-title">{title}</span>{subtitle && <span className="m-row-sub">{subtitle}</span>}</span>
      {(trailing || trailingSub) && (
        <span className="m-row-trail">
          {trailing && <span className="num m-row-value" style={tone ? { color: tone === 'in' ? 'var(--mint)' : 'var(--flare)' } : undefined}>{trailing}</span>}
          {trailingSub && <span className="m-row-sub">{trailingSub}</span>}
        </span>
      )}
      {href && <ChevronRight className="m-row-chev" size={16} aria-hidden />}
    </>
  );
  return <li>{href ? <Link prefetch={false} href={href} className="m-row">{body}</Link> : <div className="m-row">{body}</div>}</li>;
}

/** Horizontal snap-scrolling rail of cards (App Store style), bleeding to the screen edges. */
export function Rail({ children, label }: { children: ReactNode; label: string }) {
  return <div className="m-rail" role="list" aria-label={label}>{children}</div>;
}
