'use client';
import Link from 'next/link';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { InfoPopover } from '@/components/InfoPopover';
import { chainName, num, shortAddress, usd, walletName } from '@/lib/viz/format';
import type { FrontWithProvenance } from '@/server/weather/bulletin';

export const frontKey = (f: { from: string; to: string }) => `${f.from}>${f.to}`;

export function FrontsList({
  fronts,
  onSelect,
}: {
  fronts: FrontWithProvenance[];
  onSelect: (key: string) => void;
}) {
  if (!fronts.length) {
    return (
      <p className="text-sm text-ink-2">
        No two smart-money wallets have sold on one chain and bought on another within 12 hours in the last day. Fronts need
        at least two wallets moving the same way — one wallet is an anecdote.
      </p>
    );
  }
  return (
    <ol className="divide-y divide-border">
      {fronts.map((f) => (
        <li key={frontKey(f)} className="flex items-center gap-3 py-2.5">
          <button
            type="button"
            onClick={() => onSelect(frontKey(f))}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="min-w-0 flex-1 truncate text-sm text-ink">
              {chainName(f.from)} <span className="text-ink-muted">→</span> {chainName(f.to)}
            </span>
            <span className="num text-sm text-ink">{usd(f.netUsd)}</span>
            <span className="num w-16 shrink-0 text-right text-xs text-ink-muted sm:w-20">{f.walletCount} wallets</span>
            <span className="hidden sm:flex">
              <ConfidenceMeter value={f.confidence} />
            </span>
          </button>
          <InfoPopover p={f.provenance} />
        </li>
      ))}
    </ol>
  );
}

/** Confidence as a small meter: the fill carries the value, the track is a
 *  lighter step of the same ink so the scale reads across the whole bar. */
function ConfidenceMeter({ value }: { value: number }) {
  return (
    <span className="flex w-20 items-center gap-1.5" title={`Confidence ${num(value, 2)} = 1 − exp(−wallets/3)`}>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/15">
        <span className="block h-full rounded-full bg-ink/80" style={{ width: `${value * 100}%` }} />
      </span>
      <span className="num text-[11px] text-ink-muted">{num(value, 2)}</span>
    </span>
  );
}

export function FrontSheet({ front, onClose }: { front: FrontWithProvenance | null; onClose: () => void }) {
  return (
    <Sheet open={!!front} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-[min(100vw,480px)] overflow-y-auto sm:max-w-[480px]">
        {front && (
          <>
            <SheetHeader>
              <SheetTitle className="text-ink">
                {chainName(front.from)} → {chainName(front.to)}
              </SheetTitle>
              <SheetDescription>
                {usd(front.netUsd)} net rotated by {front.walletCount} smart-money wallets in 24h
                {front.grossBack > 0 ? ` (${usd(front.grossBack)} went the other way)` : ''}. Each wallet below sold risk on{' '}
                {chainName(front.from)} and bought risk on {chainName(front.to)} within 12 hours.
              </SheetDescription>
            </SheetHeader>
            <div className="px-4 pb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-ink-muted">
                    <th className="py-2 font-normal">Wallet</th>
                    <th className="py-2 text-right font-normal">Sold on {chainName(front.from)}</th>
                    <th className="py-2 text-right font-normal">Bought on {chainName(front.to)}</th>
                  </tr>
                </thead>
                <tbody>
                  {front.wallets.map((w) => (
                    <tr key={w.wallet} className="border-b border-border/60 align-top">
                      <td className="py-2 pr-2">
                        <Link href={`/wallet/${w.wallet}`} className="text-ink underline-offset-2 hover:underline">
                          {walletName(w.label, w.wallet)}
                        </Link>
                        {walletName(w.label, w.wallet) !== shortAddress(w.wallet) && (
                          <div className="num text-[11px] text-ink-muted">{shortAddress(w.wallet)}</div>
                        )}
                      </td>
                      <td className="py-2 text-right">
                        <div className="num text-ink">{usd(w.soldUsd)}</div>
                        <div className="text-[11px] text-ink-muted">{w.soldTokens.join(', ') || '—'}</div>
                      </td>
                      <td className="py-2 text-right">
                        <div className="num text-ink">{usd(w.boughtUsd)}</div>
                        <div className="text-[11px] text-ink-muted">{w.boughtTokens.join(', ') || '—'}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-xs text-ink-muted">
                Totals are each wallet&apos;s full sell and buy activity on those chains in the window; the front counts only the
                matched part, min(sold, bought) per pair.
              </p>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
