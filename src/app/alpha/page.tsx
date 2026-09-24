import type { Metadata } from 'next';
import { AlphaView } from '@/components/alpha/AlphaView';
import { alphaBoard } from '@/server/alpha/board';
import { displayMode, viewOf } from '@/server/mode';
import { chainName } from '@/lib/viz/format';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Alpha — Peregrine' };

export default async function AlphaPage() {
  const mode = await displayMode();
  const board = alphaBoard(viewOf(mode));
  const lead = board.rows[0];
  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-brand">Alpha · what to look at</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          {lead ? <>Money is leaning into <span className="brand-text">{lead.symbol ?? 'a token'}</span> on {chainName(lead.chain)}</> : 'What to look at, across every chain'}
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-2">
          Every token the scanner saw trading in the last scans, scored from what the flows say: net buying, whether it persists and accelerates,
          depth to exit through, how far the price already ran, and Peregrine&apos;s Storm reading.{' '}
          {mode === 'public' ? 'Public view: all-trader flows; smart-money flow is added in the key owner’s view.' : 'Your view adds Nansen smart-money flow.'}{' '}
          A shortlist, not advice.
        </p>
      </div>
      <AlphaView board={board} />
    </div>
  );
}
