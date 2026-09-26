import Link from 'next/link';
import { CopyCheck } from 'lucide-react';
import { walletFollow } from '@/server/copy/followability';

const LAG = ['Same moment', '15 min late', '1 hour late', '6 hours late'];
const p = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(x * 100).toFixed(1)}%`;

/** On a wallet page: can you copy this wallet? Its Copy Lab result, if it was scored. */
export function FollowabilityCard({ address }: { address: string }) {
  const w = walletFollow(address);
  if (!w) return null;
  const color = w.score >= 65 ? 'var(--mint)' : w.score >= 50 ? 'var(--amber)' : 'var(--flare)';
  const verdict = w.score >= 65 ? 'Followable: its edge survives an hour of delay' : w.score >= 50 ? 'Borderline: some edge survives the delay' : 'Hard to copy: the edge is gone by the time you see it';
  return (
    <section aria-labelledby="follow" className="material p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-2xl" style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}><CopyCheck size={20} aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <h2 id="follow" className="t-section">Can you copy this wallet?</h2>
          <p className="text-[12.5px]" style={{ color }}>{verdict}</p>
        </div>
        <span className="text-right"><span className="num block text-[26px] font-extrabold leading-none" style={{ color }}>{w.score}</span><span className="text-[11px] text-ink-muted">Followability</span></span>
      </div>
      <ol className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {w.median.map((x, i) => (
          <li key={i} className="inset-well rounded-[12px] p-2.5">
            <span className="block text-[11px] text-ink-muted">{LAG[i]}</span>
            <span className="num block text-[16px] font-bold" style={{ color: x >= 0 ? 'var(--mint)' : 'var(--flare)' }}>{p(x)}</span>
            <span className="num block text-[11px] text-ink-muted">win {Math.round(w.win[i] * 100)}%</span>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-[11.5px] text-ink-muted">Median 24h return of copying its buys, over {w.tokens} tokens ({w.buys} buys), priced with Nansen 15-minute candles. <Link href="/copy" className="font-semibold text-ink-2 hover:text-ink">Copy Lab</Link></p>
    </section>
  );
}
