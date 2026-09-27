'use client';
import { useState, type ReactNode } from 'react';
import { Segmented } from '@/components/ui/Segmented';

/** Spot / perp filter over the server-rendered timeline (rows and minute groups carry data-kind). */
export function TimelineFilter({ counts, summary, children }: { counts: { all: number; spot: number; perp: number }; summary?: ReactNode; children: ReactNode }) {
  const [kind, setKind] = useState<'all' | 'spot' | 'perp'>('all');
  return (
    <div data-filter={kind} className="space-y-2 [&[data-filter=perp]_[data-kind=spot]]:hidden [&[data-filter=spot]_[data-kind=perp]]:hidden">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Segmented className="segmented-inline" label="Event type" value={kind} onChange={setKind}
          options={[{ value: 'all', label: `All ${counts.all}` }, { value: 'spot', label: `Spot ${counts.spot}` }, { value: 'perp', label: `Perps ${counts.perp}` }]} />
        {summary}
      </div>
      {children}
    </div>
  );
}
