import Link from 'next/link';
import { Waypoints } from 'lucide-react';
import { cascades } from '@/server/cascade/cascades';

const fmtMin = (m: number) => (Math.abs(m) >= 1440 ? `${(m / 1440).toFixed(1)} days` : Math.abs(m) >= 60 ? `${(m / 60).toFixed(1)} h` : `${Math.round(m)} min`);

/** On a wallet page: where this wallet usually sits in Smart Money entry order (from Cascades). */
export function CascadeRole({ address }: { address: string }) {
  const c = cascades();
  const s = c.stats.find((x) => x.wallet.toLowerCase() === address.toLowerCase());
  if (!s) return null;
  const leads = c.edges.filter((e) => e.from.toLowerCase() === address.toLowerCase()).length;
  const follows = c.edges.filter((e) => e.to.toLowerCase() === address.toLowerCase()).length;
  const color = s.role === 'leader' ? 'var(--mint)' : s.role === 'follower' ? 'var(--flare)' : 'var(--ink-2)';
  const text = s.role === 'leader' ? 'Enters before other Smart Money' : s.role === 'follower' ? 'Enters after other Smart Money' : 'No consistent place in Smart Money entry order';
  return (
    <section aria-labelledby="cascade-role" className="material flex flex-wrap items-center gap-3 p-4 sm:p-5">
      <span className="grid h-10 w-10 place-items-center rounded-2xl" style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}><Waypoints size={20} aria-hidden /></span>
      <div className="min-w-0 flex-1">
        <h2 id="cascade-role" className="t-section" style={{ color }}>{text}</h2>
        <p className="num text-[12.5px] text-ink-2">{s.episodes} episodes · first in {s.firsts} · typically {s.medianLeadMin != null ? `${fmtMin(Math.abs(s.medianLeadMin))} ${s.medianLeadMin >= 0 ? 'ahead of' : 'behind'}` : 'level with'} the median Smart Money entrant · p {s.p < 0.001 ? s.p.toExponential(1) : s.p.toFixed(3)}{leads || follows ? ` · leads ${leads}, follows ${follows} wallets` : ''}</p>
      </div>
      <Link prefetch={false} href="/cascade" className="text-[12.5px] font-semibold text-[var(--mint)] hover:underline">Cascades</Link>
    </section>
  );
}
