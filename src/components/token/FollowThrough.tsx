'use client';
// "Did anyone follow smart money?" (L4). Owner only: the events are the
// instance's restricted smart-money tape. Shows what's stored for free, runs
// the priced study only on click, and lists every event with its receipts.
import { useEffect, useState } from 'react';
import { InfoPopover } from '@/components/InfoPopover';
import type { FollowReport } from '@/server/smart-money/follow';
import type { Verdict } from '@/lib/models/follow';
import { Go } from '@/components/ui/Icons';

const utc = (ms: number) => `${new Date(ms).toISOString().slice(5, 16).replace('T', ' ')} UTC`;
const usdK = (x: number) => (x >= 1e6 ? `$${(x / 1e6).toFixed(1)}M` : x >= 1e3 ? `$${(x / 1e3).toFixed(1)}K` : `$${Math.round(x)}`);
const pctS = (x: number | null) => (x == null ? 'n/a' : `${x >= 0 ? '+' : '−'}${Math.abs(x * 100).toFixed(1)}%`);
const rate = (x: number | null) => (x == null ? 'n/a' : x.toFixed(2));
const DOT: Record<Verdict, string> = {
  followed: 'var(--in-2)',
  ignored: 'var(--out-2)',
  'no change': 'var(--axis)',
  'too little tape': 'var(--axis)',
};

export function followTitle(r: FollowReport | null): string {
  if (!r) return 'Did anyone follow smart money?';
  const s = r.summary;
  return `Followed ${s.followed} of ${s.events} smart-money buy${s.events === 1 ? '' : 's'} within 10 minutes`;
}

export function FollowThrough({
  chain,
  token,
  mode,
  onReport,
}: {
  chain: string;
  token: string;
  mode: 'owner' | 'member' | 'public';
  onReport?: (r: FollowReport | null) => void;
}) {
  const [state, setState] = useState<{
    candidates: { events: number; buys: number };
    report: FollowReport | null;
    maxCredits: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (mode !== 'owner') return;
    fetch(`/api/follow?${new URLSearchParams({ chain, token })}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.candidates) {
          setState(d);
          onReport?.(d.report);
        } else setErr(d.error ?? null);
      })
      .catch(() => setErr('Network error.'));
  }, [chain, token, mode, onReport]);

  if (mode !== 'owner') {
    return (
      <p className="text-[13px] text-ink-2">
        This study starts from smart-money buys in this instance&apos;s own tape. Nansen&apos;s rules keep smart-money trades private, so it
        runs only for the instance owner. It checks whether other wallets bought faster in the 10 minutes after each buy than in the 10
        before, and where the price was 24 hours later.
      </p>
    );
  }
  async function run() {
    if (!state) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch('/api/follow', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chain, token, confirmCredits: state.maxCredits }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'The study failed.');
      setState({ ...state, report: j.report });
      onReport?.(j.report);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!state)
    return err ? (
      <p className="text-[13px] text-ink-2">{err}</p>
    ) : (
      <p className="animate-pulse text-[13px] text-ink-muted">Reading the stored smart-money tape…</p>
    );
  const r = state.report;
  return (
    <div className="space-y-3 text-[13px]">
      {!r && (
        <p className="text-ink-2">
          {state.candidates.events
            ? `${state.candidates.buys} smart-money buys of this token (≥ $250) in the last 7 days, grouped into ${state.candidates.events} event${state.candidates.events === 1 ? '' : 's'} (the largest five).`
            : 'No smart-money buys of this token (≥ $250) in the stored tape for the last 7 days.'}
        </p>
      )}
      {state.candidates.events > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={run}
            className="rounded border border-border px-3 py-1 text-ink hover:bg-raised disabled:opacity-45"
          >
            {busy ? 'Reading the tape around each buy…' : `${r ? 'Run again' : 'Check follow-through'} · up to ${state.maxCredits} credits`}
          </button>
          <span className="text-[11.5px] text-ink-muted">
            Two 10-minute windows of the DEX tape per event (at most two pages each) and hourly candles. Cached an hour.
          </span>
        </div>
      )}
      {err && <p className="text-ink">{err}</p>}
      {r && (
        <>
          <div tabIndex={0} role="region" aria-label="Follow-through table" className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-[12.5px]">
              <thead>
                <tr className="border-b border-border text-[10.5px] uppercase tracking-wider text-ink-muted">
                  <th className="py-1.5 font-normal">Smart-money buy</th>
                  <th className="font-normal">Buyers / min before <Go /> after</th>
                  <th className="font-normal">Verdict</th>
                  <th className="font-normal">24h later</th>
                </tr>
              </thead>
              <tbody>
                {r.results.map((x) => (
                  <tr key={x.event.t} className="num border-b border-border/60 align-top text-ink-2">
                    <td className="py-1.5">
                      <div className="text-ink">{utc(x.event.t)}</div>
                      <div className="text-[11px] text-ink-muted">
                        {usdK(x.event.usd)} · {x.event.wallets.length} wallet{x.event.wallets.length === 1 ? '' : 's'}
                        {x.labels.length ? ` · ${x.labels.slice(0, 2).join(', ')}` : ''}
                      </div>
                    </td>
                    <td>
                      {rate(x.before.perMin)} <Go /> {rate(x.after.perMin)}
                      <div className="text-[11px] text-ink-muted">
                        {x.before.buyers} <Go /> {x.after.buyers} buyers{x.after.truncated || x.before.truncated ? ' · tape cut' : ''}
                      </div>
                    </td>
                    <td>
                      <span className="inline-flex items-center gap-1.5 text-ink">
                        <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: DOT[x.verdict] }} />
                        {x.verdict}
                      </span>
                      {x.ratio != null && <div className="text-[11px] text-ink-muted">×{x.ratio.toFixed(1)}</div>}
                    </td>
                    <td>{x.outcome ? pctS(x.outcome.ret) : x.outcomePending ? 'pending' : 'n/a'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-ink-2">
            Median 24h after followed buys {pctS(r.summary.medianAfterFollowed)}, after the rest {pctS(r.summary.medianAfterOthers)}.{' '}
            {r.summary.events} events is an anecdote, not a pattern.{' '}
            <InfoPopover
              p={{
                title: 'Follow-through',
                formula:
                  'followers = distinct non-smart-money buyers per covered minute, 10 min after vs 10 min before\nfollowed: ratio ≥ 1.5 with 3+ buyers after · ignored: ratio ≤ 0.8 · ratio = (after + 0.1) ÷ (before + 0.1)\n24h: the close known at the buy vs the close that finished 24h later (1h candles)',
                inputs: [
                  { label: 'Events', value: String(r.summary.events) },
                  { label: 'Credits spent', value: String(r.credits) },
                  { label: 'Run at', value: `${new Date(r.at).toISOString().slice(0, 16).replace('T', ' ')} UTC` },
                ],
                calls: r.calls,
                notes: [...r.notes, 'Smart-money events are this instance’s own tape; the follower tape is all traders.'],
              }}
            />
          </p>
        </>
      )}
      <p className="text-[11px] text-ink-muted">Who bought after smart money, not whether they were right to.</p>
    </div>
  );
}
