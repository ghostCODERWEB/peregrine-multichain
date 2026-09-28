'use client';
import { TokenLogo } from '@/components/Logo';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Segmented } from '@/components/ui/Segmented';
import { chainName, pct, usd } from '@/lib/viz/format';
import type { TmResult } from '@/server/history/time-machine';
import { friendlyError } from '@/lib/friendly-error';

const day = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10);

/** THEN / NOW / CHANGE for Smart Money holdings, from Nansen's point-in-time snapshots. */
export function TimeMachine() {
  const [back, setBack] = useState<7 | 30 | 90>(30);
  const [custom, setCustom] = useState('');
  const [res, setRes] = useState<TmResult | { error: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const now = day(1), then = custom || day(back + 1);
  const run = async () => {
    setBusy(true);
    try {
      const r = await fetch(`/api/time-machine?then=${then}&now=${now}`);
      const d = await r.json();
      setRes(r.ok ? d : { error: d.error ?? 'Unavailable.' });
    } catch { setRes({ error: 'Could not reach the server.' }); } finally { setBusy(false); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- compare whenever the date changes
  useEffect(() => { void run(); }, [then]);
  const tone = (v: number) => ({ color: v >= 0 ? 'var(--mint)' : 'var(--flare)' });
  return (
    <section aria-labelledby="tm-title" className="material p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="tm-title" className="t-section">Time Machine: Smart Money holdings</h2>
          <p className="text-[12px] text-ink-muted">Nansen point-in-time snapshots (end of day UTC; the latest is yesterday)</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented label="Compare with" value={back} options={[{ value: 7, label: '7d ago' }, { value: 30, label: '30d ago' }, { value: 90, label: '90d ago' }]} onChange={(v) => { setBack(v); setCustom(''); }} />
          <input type="date" value={custom} max={day(2)} onChange={(e) => setCustom(e.target.value)} aria-label="Custom past date" className="inset-well h-8 rounded-[8px] px-2 text-[12.5px] text-ink" />
          <span className="num text-[12px] text-ink-muted">{busy ? 'Comparing…' : `${then} vs ${now}`}</span>
        </div>
      </div>
      {!res && <p className="text-[13px] text-ink-muted">Reading snapshots…</p>}
      {res && 'error' in res && <p role="alert" className="text-[13px] text-[var(--flare)]">{friendlyError(res.error)}</p>}
      {res && !('error' in res) && (
        <div className="space-y-3">
          {res.note && <p className="text-[12.5px] text-ink-2">{res.note}</p>}
          {!res.incomplete && <>
          <div className="grid grid-cols-3 gap-px overflow-hidden rounded-[var(--r-inner)] border border-[var(--hair)] bg-[var(--hair)]">
            {[['Then', res.then, usd(res.totalThen)], ['Now', res.now, usd(res.totalNow)], ['Change', pct(res.totalThen ? res.totalNow / res.totalThen - 1 : null, 1), usd(res.totalNow - res.totalThen, { signed: true })]].map(([k, sub, v], i) => (
              <div key={k} className="bg-[var(--surface-1)] px-3.5 py-2.5">
                <span className="block text-[11.5px] font-semibold text-ink-muted">{k} · {sub}</span>
                <span className="num block text-[18px] font-bold" style={i === 2 ? tone(res.totalNow - res.totalThen) : undefined}>{v}</span>
                {i < 2 && <span className="block text-[11.5px] text-ink-2">Smart Money holdings (top 200 tokens)</span>}
              </div>
            ))}
          </div>
          <div tabIndex={0} role="region" aria-label="Holdings change by token" className="max-h-[480px] overflow-auto rounded-[10px] border border-[var(--hair)]">
            <table data-sortable className="w-full min-w-[640px] text-[12.5px]">
              <thead className="sticky top-0 bg-[var(--surface-1)] text-[11.5px] text-ink-muted"><tr><th className="px-3 py-2 text-left font-semibold">Token</th><th className="w-[14%] px-3 text-right font-semibold">Then</th><th className="w-[14%] px-3 text-right font-semibold">Now</th><th className="w-[22%] px-3 text-right font-semibold">Change</th><th className="w-[16%] px-3 text-right font-semibold">Holders, then to now</th></tr></thead>
              <tbody>
                {res.rows.map((r) => (
                  <tr key={`${r.chain}:${r.token}`} className="border-t border-[var(--hair)]">
                    <td className="px-3 py-2"><Link prefetch={false} href={`/token/${r.chain}/${encodeURIComponent(r.token)}`} className="flex items-center gap-2 hover:underline"><TokenLogo symbol={r.symbol} chain={r.chain} address={r.token} size={20} /><span className="font-semibold text-ink">{r.symbol ?? r.token.slice(0, 8)}</span><span className="text-[11.5px] text-ink-muted">{chainName(r.chain)}</span></Link></td>
                    <td className="num px-3 text-right text-ink-2">{r.edge === 'entered-top' ? 'outside top 200' : usd(r.thenUsd)}</td>
                    <td className="num px-3 text-right text-ink">{r.edge === 'left-top' ? 'outside top 200' : usd(r.nowUsd)}</td>
                    <td className="num px-3 text-right font-semibold" style={r.edge ? undefined : tone(r.deltaUsd)}>{r.edge === 'left-top' ? <span className="text-ink-muted">left the top 200</span> : r.edge === 'entered-top' ? <span className="text-ink-muted">entered the top 200</span> : <>{usd(r.deltaUsd, { signed: true })}{r.deltaPct != null ? (r.thenUsd < 50_000 && r.deltaPct > 10 ? ' · new position' : ` · ${r.deltaPct >= 0 ? '+' : ''}${pct(r.deltaPct, 0)}`) : ''}</>}</td>
                    <td className="num px-3 text-right text-ink-2">{r.thenHolders ?? 'n/a'} to {r.nowHolders ?? 'n/a'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>}
          <p className="text-[11px] text-ink-muted">Nansen point-in-time balances.</p>
        </div>
      )}
    </section>
  );
}
