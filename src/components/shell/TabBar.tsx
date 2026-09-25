'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Radar, Shuffle, NotebookPen, MessageCircle, Search } from 'lucide-react';

export function TabBar() {
  const path = usePathname();
  return <nav aria-label="Quick navigation" className="material-strong phone-tabs fixed inset-x-0 bottom-0 z-40 flex h-[84px] items-start justify-around border-t border-border pt-3 lg:hidden">
    {[['/', 'Radar', Radar], ['/flows', 'Flows', Shuffle], ['/desk', 'Desk', NotebookPen], ['/agent', 'Ask', MessageCircle]].map(([href, label, Icon]) => <Link key={String(href)} href={String(href)} aria-current={path === href ? 'page' : undefined} className={`flex min-w-14 flex-col items-center gap-1 text-[10.5px] font-semibold ${path === href ? 'text-brand' : 'text-ink-muted'}`}><Icon size={24} aria-hidden />{String(label)}</Link>)}
    <button type="button" className="flex min-w-14 flex-col items-center gap-1 text-[10.5px] font-semibold text-ink-muted" onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}><Search size={24} aria-hidden />Search</button>
    <span aria-hidden className="absolute bottom-2 left-1/2 h-1 w-28 -translate-x-1/2 rounded-full bg-ink/60" />
  </nav>;
}
