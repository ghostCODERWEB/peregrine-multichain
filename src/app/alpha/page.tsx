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
        <p className="text-[12.5px] font-bold text-brand">Alpha · what to look at</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          {lead ? <>Money is leaning into <span className="brand-text">{lead.symbol ?? 'a token'}</span> on {chainName(lead.chain)}</> : 'What to look at, across every chain'}
        </h1>
        <p className="mt-1 max-w-3xl text-[13px] text-ink-2">
          Tokens from recent scans, scored on net buying, persistence, acceleration, exit depth, prior run-up and Dump Risk.{' '}
          {mode === 'public' ? 'Public view: all-trader flows.' : 'Includes Nansen smart-money flow.'} Not advice.
        </p>
      </div>
      <AlphaView board={board} />
    </div>
  );
}
