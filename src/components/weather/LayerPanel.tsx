import Link from 'next/link';
import { ScoreRing } from '@/components/viz/ScoreRing';
import { TimeAgo } from '@/components/TimeAgo';
import { InfoPopover } from '@/components/InfoPopover';
import { num, usd } from '@/lib/viz/format';
import type { WeatherLayer } from '@/server/weather/layers';
import { LoadCategories } from './LoadCategories';
import { Go } from '@/components/ui/Icons';

/** Every reading of one Overview view (Perps, Sectors, Predictions) as tiles
 *  or a table. The view's finding and description sit in its hero above. */
export function LayerPanel({ layer, table, onRefresh, brief = false }: { layer: WeatherLayer; table: boolean; onRefresh?: () => Promise<unknown>; brief?: boolean }) {
  const tone = (s: number) => (layer.id === 'predictions' ? 'var(--signal)' : Math.abs(s - 50) < 5 ? 'var(--ink-muted)' : s > 50 ? 'var(--mint)' : 'var(--flare)');
  return <div className="space-y-4" aria-label={layer.title}>
    {!brief && <div className="flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-ink-muted">
      <div className="flex items-center gap-2"><h3 className="text-[14px] font-bold text-ink">{layer.title}</h3>{layer.provenance && <InfoPopover p={layer.provenance} />}
        <span>· {layer.recorded ? 'recorded demo data' : layer.at ? <>updated <TimeAgo ts={layer.at} /></> : 'no reading yet'}</span></div>
      <Link className="font-semibold text-brand" href={layer.href}>Methodology <Go /></Link>
    </div>}
    {layer.unavailable && <div className="inset-well space-y-3 p-4"><p className="text-sm text-ink-2">{layer.unavailable}</p>
      {layer.id === 'predictions' && !layer.recorded && onRefresh && <LoadCategories onLoaded={onRefresh} />}</div>}
    {!layer.unavailable && !layer.readings.length && <p className="text-sm text-ink-2">No usable readings in this snapshot.</p>}
    {table ? <div tabIndex={0} role="region" aria-label="Readings table" className="overflow-x-auto"><table className="w-full text-left text-[13px]"><thead><tr className="border-b border-[var(--hair)] text-ink-muted"><th className="p-2 font-semibold">Name</th><th className="p-2 font-semibold">Index / 100</th><th className="p-2 text-right font-semibold">{layer.metric}</th></tr></thead><tbody>
      {layer.readings.map((r) => <tr key={r.name} className={`border-b border-[var(--hair)] ${r.wide ? 'hidden 3xl:table-row' : ''}`}><th className="p-2 font-semibold text-ink"><Link href={r.href ?? layer.href} className="hover:underline">{r.name}</Link></th><td className="num p-2">{num(r.score, 0)}</td><td className="num p-2 text-right">{usd(r.value, { signed: layer.id === 'sectors' })}</td></tr>)}
    </tbody></table></div> : <ul className="stagger grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-3 3xl:grid-cols-4 4xl:grid-cols-6">
      {layer.readings.map((r) => <li key={r.name} className={r.wide ? 'hidden 3xl:block' : undefined}><Link href={r.href ?? layer.href} className="inset-well flex min-w-0 items-center gap-3 rounded-[16px] p-3 hover:border-[var(--hair-2)]">
        {r.score == null ? <span className="num grid h-[52px] w-[52px] place-items-center text-ink-muted">n/a</span> : <ScoreRing score={r.score} size={52} stroke={5} color={tone(r.score)} label={r.name} />}
        <div className="min-w-0"><h4 className="truncate text-[13.5px] font-bold text-ink">{r.name}</h4><p className="mt-0.5 truncate text-[13px] text-ink-2"><span className="num">{usd(r.value, { signed: layer.id === 'sectors' })}</span> <span className="text-[11.5px] text-ink-muted">· {layer.metric}</span></p></div>
      </Link></li>)}
    </ul>}
    {!brief && <p className="text-[11.5px] text-ink-muted">Separate populations and units: indices don’t compare across views, and missing readings aren’t zero.</p>}
  </div>;
}
