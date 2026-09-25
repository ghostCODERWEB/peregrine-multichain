'use client';
import type { CSSProperties } from 'react';
export function Segmented<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: readonly { value: T; label: string }[]; onChange: (value: T) => void }) {
  const index = Math.max(0, options.findIndex(o => o.value === value));
  return <div role="group" aria-label={label} className="segmented" style={{ '--segments': options.length, '--selected': index } as CSSProperties}><span className="segmented-thumb" aria-hidden />{options.map(o => <button type="button" key={o.value} aria-pressed={value === o.value} onClick={() => onChange(o.value)}>{o.label}</button>)}</div>;
}
