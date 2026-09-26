import Link from 'next/link';
import { TimeAgo } from '@/components/TimeAgo';
import { usd, walletName } from '@/lib/viz/format';
import type { ChainPageData } from '@/server/weather/chain-page';

export function TradeTape({ tape }: { tape: ChainPageData['tape'] }) {
  if (!tape.length) {
    return <p className="text-sm text-ink-2">No smart-money DEX trades recorded on this chain yet (only chains with Nansen smart-money labels have them).</p>;
  }
  return (
    <div className="max-h-[360px] overflow-y-auto">
      <table className="w-full text-[12.5px]">
        <thead className="sticky top-0 bg-surface">
          <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-ink-muted">
            <th className="py-1.5 font-normal">When</th>
            <th className="py-1.5 font-normal">Side</th>
            <th className="py-1.5 font-normal">Token</th>
            <th className="py-1.5 text-right font-normal">USD</th>
            <th className="py-1.5 pl-3 font-normal">Wallet</th>
          </tr>
        </thead>
        <tbody>
          {tape.map((t, i) => (
            <tr key={i} className="border-b border-border/50">
              <td className="num py-1.5 text-ink-muted"><TimeAgo ts={t.at} /></td>
              <td className="py-1.5">
                <span className="inline-flex items-center gap-1 text-ink-2">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: t.side === 'buy' ? 'var(--in-3)' : 'var(--out-3)' }} aria-hidden />
                  {t.side === 'buy' ? 'Buy' : 'Sell'}
                </span>
              </td>
              <td className="py-1.5 text-ink">{t.symbol ?? 'n/a'}</td>
              <td className="num py-1.5 text-right text-ink">
                {usd(t.usd)}
                {t.count > 1 && <span className="ml-1 text-[11px] text-ink-muted" title={`${t.count} consecutive fills folded into one row`}>×{t.count}</span>}
              </td>
              <td className="py-1.5 pl-3">
                <Link href={`/wallet/${t.wallet}`} className="text-ink-2 hover:text-ink hover:underline">{walletName(t.label, t.wallet)}</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
