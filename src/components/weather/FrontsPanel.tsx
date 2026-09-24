'use client';
import Link from 'next/link';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { InfoPopover } from '@/components/InfoPopover';
import { chainName, num, shortAddress, usd, walletName } from '@/lib/viz/format';
import type { FrontWithProvenance } from '@/server/weather/bulletin';

export const frontKey = (f: { from: string; to: string; inferred?: boolean }) => `${f.inferred ? 'inferred:' : ''}${f.from}>${f.to}`;
/** Evidence timestamps: UTC to the second, so sell/buy/funding order stays checkable. */
const Utc = ({ ms }: { ms: number }) => { const iso = new Date(ms).toISOString(); return <time dateTime={iso}>{iso.slice(0, 19).replace('T', ' ')} UTC</time>; };

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
        No two smart-money wallets have sold on one chain and bought on another within 12 hours in the last day. Rotations need
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
              {f.inferred && <span className="ml-2 text-xs text-ink-muted">Inferred</span>}
            </span>
            <span className="num text-sm text-ink">{usd(f.netUsd)}</span>
            <span className="num w-16 shrink-0 text-right text-xs text-ink-muted sm:w-20">{f.walletCount} {f.inferred ? 'groups' : 'wallets'}</span>
            <span className={f.inferred ? 'hidden' : 'hidden sm:flex'}>
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
                {front.inferred ? 'Inferred: ' : ''}{chainName(front.from)} → {chainName(front.to)}
              </SheetTitle>
              <SheetDescription>
                {front.inferred ? `${usd(front.netUsd)} net candidate notional across ${front.walletCount} independent relationship groups. Funding and timing are evidence of a possible rotation, not proof of common ownership or capital bridging.` : <>{usd(front.netUsd)} net rotated by {front.walletCount} smart-money wallets in 24h
                {front.grossBack > 0 ? ` (${usd(front.grossBack)} went the other way)` : ''}. Each wallet below sold risk on{' '}
                {chainName(front.from)} and bought risk on {chainName(front.to)} within 12 hours.</>}
              </SheetDescription>
            </SheetHeader>
            <div className="px-4 pb-6">
              {front.inferred ? <div className="space-y-4">
                <InfoPopover p={front.provenance} />
                {front.evidence?.map((m, i) => <article key={i} className="space-y-2 rounded-xl border border-dashed border-border p-3 text-sm">
                  <p className="font-medium">{chainName(m.seller.chain)} → {chainName(m.buyer.chain)} · {usd(m.matchedUsd)} candidate</p>
                  <p>Sold {usd(m.soldUsd)} · <Utc ms={m.sellAt} /></p>
                  <Link className="block break-all underline" href={`/wallet/${encodeURIComponent(m.seller.address)}?chain=${encodeURIComponent(m.seller.chain)}`}>{m.seller.address}</Link>
                  <p>Bought {usd(m.boughtUsd)} · <Utc ms={m.buyAt} /></p>
                  <Link className="block break-all underline" href={`/wallet/${encodeURIComponent(m.buyer.address)}?chain=${encodeURIComponent(m.buyer.chain)}`}>{m.buyer.address}</Link>
                  <p className="text-ink-2">Direct first-funding record on {chainName(m.evidence.funder.chain)}, dated <Utc ms={m.evidence.at} />.</p>
                  <p className="break-all text-xs text-ink-muted">Funding transaction: {m.evidence.transactionHash}</p>
                  <p className="break-all text-xs text-ink-muted">Evidence group: {m.group}</p>
                </article>)}
                <p className="text-xs text-ink-muted">Candidate notional is min(sold, bought); reverse-direction candidates are subtracted. It is not a measured bridge transfer. Shared-funder similarity alone is never matched.</p>
              </div> : <>
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
                Totals are each wallet&apos;s full sell and buy activity on those chains in the window; the rotation counts only the
                matched part, min(sold, bought) per pair.
              </p>
              </>}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
