'use client';
import { useState } from 'react';
import { Segmented } from '@/components/ui/Segmented';

/** Spot / perp filter over the server-rendered timeline (rows carry data-kind). */
export function TimelineFilter({ children }: { children: React.ReactNode }) {
  const [kind, setKind] = useState<'all' | 'spot' | 'perp'>('all');
  return (
    <div data-filter={kind} className="space-y-2 [&[data-filter=perp]_li[data-kind=spot]]:hidden [&[data-filter=spot]_li[data-kind=perp]]:hidden">
      <Segmented label="Event type" value={kind} options={[{ value: 'all', label: 'All' }, { value: 'spot', label: 'Spot' }, { value: 'perp', label: 'Perps' }]} onChange={setKind} />
      {children}
    </div>
  );
}
