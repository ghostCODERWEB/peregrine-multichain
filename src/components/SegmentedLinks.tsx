'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

/** A segmented control whose segments are links (a server-rendered filter). The glass thumb moves on
 *  the click itself, not when the next page arrives, so the control answers at once. `hidden` keeps the
 *  control's space in the layout while it doesn't apply, so the controls beside it never shift. */
export function SegmentedLinks({ label, items, selected, hidden }: { label: string; items: Array<{ key: string; name: string; href: string }>; selected: number; hidden?: boolean }) {
  const [shown, setShown] = useState(selected);
  useEffect(() => setShown(selected), [selected]);
  return (
    <nav aria-label={label} aria-hidden={hidden || undefined} inert={hidden || undefined} aria-busy={shown !== selected || undefined}
      className={`segmented ${hidden ? 'invisible' : ''}`} style={{ '--segments': items.length, '--selected': shown } as React.CSSProperties}>
      <span className="segmented-thumb" aria-hidden />
      {items.map((x, i) => (
        <Link prefetch={false} key={x.key} href={x.href} aria-current={i === selected ? 'page' : undefined} onClick={() => setShown(i)}
          className="relative z-[1] px-3 py-1 text-center text-[12px] font-bold">{x.name}</Link>
      ))}
    </nav>
  );
}
