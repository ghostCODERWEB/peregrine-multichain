'use client';
import dynamic from 'next/dynamic';
import { SHOW_RECEIPTS, type Provenance } from '@/lib/provenance';

// The popover (and the floating-UI library under it) loads only when receipts are shown, instead of riding
// along in every page that places an ⓘ.
const Panel = dynamic(() => import('./InfoPopoverPanel').then((m) => m.InfoPopoverPanel), { ssr: false });

/** How a number is computed (shown only when SHOW_RECEIPTS is on). */
export function InfoPopover({ p, className = '' }: { p: Provenance; className?: string }) {
  if (!SHOW_RECEIPTS) return null;
  return <Panel p={p} className={className} />;
}
