'use client';
import { PayPerCall } from './PayPerCall';
import { TradeTape } from '@/components/chain/TradeTape';
import { foldTape, tapeFromDexTrades, liveTapeRequest } from '@/lib/tape';

/** The chain page's smart-money tape for a keyless visitor: bought per
 *  call from Nansen by the visitor themselves, shown to them only. */
export function PaidTradeTape({ chain }: { chain: string }) {
  return (
    <PayPerCall endpoint="smart-money/dex-trades" body={liveTapeRequest(chain)} action="Load live smart-money trades">
      {(data) => <TradeTape tape={foldTape(tapeFromDexTrades(data))} />}
    </PayPerCall>
  );
}
