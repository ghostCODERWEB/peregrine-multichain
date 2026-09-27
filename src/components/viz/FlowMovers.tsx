import Link from 'next/link';
import { ChainLogo } from '@/components/Logo';
import { chainName } from '@/lib/viz/format';
import type { ChainTile } from '@/server/weather/bulletin';

/** The Radar hero's visual in the public view, where same-wallet rotations
 *  are withheld: the chains furthest from neutral each way on the Flow
 *  Index, a bar growing from the neutral 50 toward 0 or 100. */
export function FlowMovers({ chains }: { chains: ChainTile[] }) {
  const scored = chains.filter((c) => c.cpi != null).sort((a, b) => b.cpi! - a.cpi!);
  if (scored.length < 2) return <p className="px-6 text-sm text-ink-muted">Flow Index readings are still being recorded.</p>;
  const up = scored.filter((c) => c.cpi! > 50).slice(0, 4);
  const down = scored.filter((c) => c.cpi! < 50).slice(-4).reverse();
  const row = (c: ChainTile, color: string) => {
    const v = Math.round(c.cpi!), off = Math.min(50, Math.abs(v - 50));
    return (
      <li key={c.chain}>
        <Link prefetch={false} href={`/chain/${c.chain}`} className="grid grid-cols-[26px_minmax(0,1fr)_minmax(0,110px)_34px] items-center gap-3 py-2 text-ink">
          <ChainLogo chain={c.chain} size={26} />
          <span className="truncate text-[14px] font-bold">{chainName(c.chain)}</span>
          <span className="relative h-1.5 rounded-full bg-ink/10" aria-hidden>
            <span className="absolute inset-y-[-3px] left-1/2 w-px bg-[var(--hair-2)]" />
            <span className="absolute inset-y-0 rounded-full" style={v >= 50
              ? { left: '50%', width: `${off}%`, background: color, boxShadow: `0 0 10px ${color}` }
              : { right: '50%', width: `${off}%`, background: color, boxShadow: `0 0 10px ${color}` }} />
          </span>
          <span className="num text-right text-[15px] font-extrabold">{v}</span>
        </Link>
      </li>
    );
  };
  return (
    <div className="relative z-10 rounded-[22px] border border-[var(--hair)] bg-ink/[0.03] p-5" aria-label="Chains furthest from neutral on the Flow Index">
      <div className="text-[12.5px] font-bold text-ink-muted">Flow Index · furthest from neutral</div>
      {up.length > 0 && <>
        <div className="mt-3 text-[12px] font-bold text-[var(--mint)]">Accumulating</div>
        <ul className="divide-y divide-[var(--hair)]">{up.map((c) => row(c, 'var(--mint)'))}</ul>
      </>}
      {down.length > 0 && <>
        <div className="mt-3 text-[12px] font-bold text-[var(--flare)]">Distributing</div>
        <ul className="divide-y divide-[var(--hair)]">{down.map((c) => row(c, 'var(--flare)'))}</ul>
      </>}
    </div>
  );
}
