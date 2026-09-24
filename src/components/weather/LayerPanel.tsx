import Link from 'next/link';
import { ScoreRing } from '@/components/viz/ScoreRing';
import { TimeAgo } from '@/components/TimeAgo';
import { InfoPopover } from '@/components/InfoPopover';
import { num, usd } from '@/lib/viz/format';
import type { WeatherLayer } from '@/server/weather/layers';

export function LayerPanel({ layer, table }: { layer: WeatherLayer; table: boolean }) {
  return <div className="space-y-4" aria-label={layer.title}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="max-w-3xl"><div className="flex items-center gap-2"><h2 className="text-lg font-semibold text-ink">{layer.title}</h2>{layer.provenance && <InfoPopover p={layer.provenance} />}</div>
        <p className="mt-1 text-sm text-ink-2">{layer.description}</p>
        <p className="mt-2 text-xs text-ink-muted">{layer.recorded ? 'Recorded demo observations; not live' : <>Observed <TimeAgo ts={layer.at} /></>} · Home layer switching uses no API credits.</p>
      </div>
      <Link className="text-sm text-ink underline underline-offset-4" href={layer.href}>Explore data & methodology →</Link>
    </div>
    {layer.unavailable && <p className="rounded-lg border border-dashed border-border p-4 text-sm text-ink-2">{layer.unavailable}</p>}
    {!layer.unavailable && !layer.readings.length && <p className="text-sm text-ink-2">No usable observations in this snapshot.</p>}
    {table ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-border"><th className="p-2">Entity</th><th className="p-2">Index / 100</th><th className="p-2">{layer.metric}</th></tr></thead><tbody>
      {layer.readings.map((r) => <tr key={r.name} className="border-b border-border"><th className="p-2 font-medium">{r.name}</th><td className="num p-2">{num(r.score, 0)}</td><td className="num p-2">{usd(r.value, { signed: layer.id === 'sectors' })}</td></tr>)}
    </tbody></table></div> : <div className="grid grid-cols-1 gap-3 min-[390px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
      {layer.readings.map((r) => <Link key={r.name} href={layer.href} className="flex min-w-0 items-center gap-3 rounded-xl border border-border bg-surface p-3 transition-colors hover:bg-accent">
        {r.score == null ? <span className="num p-4 text-ink-muted">—</span> : <ScoreRing score={r.score} size={54} color={layer.id === 'predictions' ? 'var(--ink-2)' : Math.abs(r.score - 50) < 5 ? 'var(--axis)' : r.score >= 50 ? 'var(--in-2)' : 'var(--out-2)'} label={`${r.name} index`} />}
        <div className="min-w-0"><h3 className="break-words text-sm font-medium text-ink">{r.name}</h3><p className="num mt-1 text-sm">{usd(r.value, { signed: layer.id === 'sectors' })}</p><p className="text-xs text-ink-muted">{layer.metric}</p></div>
      </Link>)}
    </div>}
    <p className="text-xs text-ink-muted">Separate populations and units: these indices are not directly comparable across layers. Missing readings are not zero.</p>
  </div>;
}
