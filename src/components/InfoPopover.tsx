'use client';
import dynamic from 'next/dynamic';
import type { Provenance } from '@/lib/provenance';

/** How a number is computed. Hidden for now at the owner's request: the ⓘ icons are off everywhere (Analyze with Nansen explains any element instead). */
const SHOW_RECEIPTS = false;

// The popover (and the floating-UI library under it) loads only when receipts are shown, instead of riding
// along in every page that places an ⓘ.
const Panel = dynamic(() => import('./InfoPopoverPanel').then((m) => m.InfoPopoverPanel), { ssr: false });

export function InfoPopover({ p, className = '' }: { p: Provenance; className?: string }) {
  if (!SHOW_RECEIPTS) return null;
  return <Panel p={p} className={className} />;
}
