'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { InfoPopover } from '@/components/InfoPopover';
import { SETUPS, setupLabel, type Setup, type Stance } from '@/lib/models/calls';
import type { CandlePoint, ReplayAt } from '@/lib/models/replay';
import type { CallCard, Receipt } from '@/server/desk/calls';
import type { ReplayReading } from '@/server/desk/replay';
import { fmtPrice, receiptProvenance, GRADE_RULES } from './receipt';
import { Go } from '@/components/ui/Icons';

interface Preview {
  id: string;
  cut: number;
  due: number;
  entry: number;
  history: CandlePoint[];
  readings: ReplayReading[];
  receipt: Receipt;
  horizon: ReplayAt;
}
const utc = (t: number) => new Date(t).toISOString().slice(0, 16).replace('T', ' ') + ' UTC';

function PricePath({ points, label, tfMs }: { points: CandlePoint[]; label: string; tfMs: number }) {
  if (!points.length) return null;
  const values = points.map((p) => p.c),
    low = Math.min(...values),
    high = Math.max(...values),
    span = high - low || high * 0.01 || 1;
  const line = points
    .map((p, i) => `${(12 + (i / Math.max(1, points.length - 1)) * 576).toFixed(2)},${(132 - ((p.c - low) / span) * 110).toFixed(2)}`)
    .join(' ');
  return (
    <figure className="rounded-xl border border-border bg-surface p-3">
      <figcaption className="mb-2 text-sm text-ink-2">{label}</figcaption>
      <svg role="img" aria-label={label} viewBox="0 0 600 150" className="w-full">
        <path d="M12 132H588" stroke="var(--axis)" fill="none" />
        <polyline points={line} stroke="var(--brand)" strokeWidth="2.5" fill="none" />
      </svg>
      <div className="num flex flex-wrap justify-between gap-2 text-xs text-ink-muted">
        <span>{utc(points[0].t + tfMs)}</span>
        <span>{utc(points[points.length - 1].t + tfMs)}</span>
      </div>
      <p className="mt-2 text-xs text-ink-muted">
        Price in USD · low {fmtPrice(low)}, high {fmtPrice(high)} · independent vertical scale, not directly comparable to the other panel.
      </p>
      <details className="mt-2 text-xs text-ink-2">
        <summary>Inspect {points.length} complete candle closes</summary>
        <div className="mt-2 max-h-48 overflow-auto">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th>Closed at (UTC)</th>
                <th className="text-right">USD</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.t}>
                  <td className="py-1">{utc(p.t + tfMs)}</td>
                  <td className="num text-right">{fmtPrice(p.c)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

export function TimeMachine({ chain, token }: { chain: string; token: string }) {
  const [horizon, setHorizon] = useState<ReplayAt>('24h');
  // ⌘K "/replay TOKEN 7d" opens this page with ?at= (L5); read after mount to keep hydration stable.
  useEffect(() => {
    const a = new URLSearchParams(window.location.search).get('at');
    if (a === '1h' || a === '24h' || a === '7d') setHorizon(a);
  }, []);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [stance, setStance] = useState<Stance | null>(null);
  const [setup, setSetup] = useState<Setup>('other');
  const [thesis, setThesis] = useState('');
  const [result, setResult] = useState<{ call: CallCard; path: CandlePoint[] } | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function send(body: object) {
    const r = await fetch('/api/replay', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error ?? 'Replay unavailable.');
    return data;
  }
  async function prepare() {
    setBusy(true);
    setError('');
    setPreview(null);
    setResult(null);
    setStance(null);
    try {
      setPreview(await send({ action: 'prepare', chain, token, horizon, confirmCredits: 1 }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function lock() {
    if (!preview || !stance) return;
    setBusy(true);
    setError('');
    try {
      setResult(await send({ action: 'lock', id: preview.id, stance, setup, thesis }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-5">
      <div className="material p-5 sm:p-6">
        <h1 className="t-title">Time Machine</h1>
        <p className="mt-2 max-w-3xl text-sm text-ink-2">
          Read the evidence at a past cutoff, lock BUY, PASS or SHORT, then reveal what followed. A historical exercise, not a trade.
        </p>
        <p className="mt-2 break-all text-xs text-ink-muted">
          {chain} · {token}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="text-sm">
            Replay window{' '}
            <select
              aria-label="Replay window"
              value={horizon}
              onChange={(e) => setHorizon(e.target.value as ReplayAt)}
              disabled={busy}
              className="rounded-lg border border-border bg-raised p-2"
            >
              {(['1h', '24h', '7d'] as const).map((h) => (
                <option key={h} value={h}>
                  T−{h}
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={busy}
            onClick={prepare}
            className="rounded bg-brand/15 px-4 py-2 text-sm ring-1 ring-brand/40 disabled:opacity-40"
          >
            {busy ? 'Working…' : 'Load historical evidence'}
          </button>
        </div>
        <p className="mt-2 text-xs text-ink-muted">
          Recorded demo: zero credits. Live cutoffs align to complete candles ending at least 10 minutes ago. Missing history stays missing;
          expired or incomplete windows are not graded.
        </p>
      </div>
      {error && (
        <p role="alert" className="rounded-xl border border-border p-4 text-sm">
          {error}
        </p>
      )}
      {preview && (
        <section className="material space-y-4 p-5 sm:p-6" aria-labelledby="replay-cut">
          <h2 id="replay-cut" className="text-lg font-semibold">
            What was known by {utc(preview.cut)}
          </h2>
          <p className="text-sm">
            Entry {fmtPrice(preview.entry)} <InfoPopover p={receiptProvenance('Replay candle source', preview.receipt)} /> · Outcome window:{' '}
            {preview.horizon}.{' '}
            {preview.receipt.served === 'recorded'
              ? 'Real recorded Nansen candles, not live.'
              : 'Reconstructed from historical Nansen candles.'}
          </p>
          <PricePath
            points={preview.history}
            label="Before the cutoff · fully closed candles only"
            tfMs={preview.horizon === '1h' ? 300_000 : preview.horizon === '24h' ? 3_600_000 : 14_400_000}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {preview.readings.map((r) => (
              <div key={r.name} className="rounded-xl border border-border p-3">
                <div className="text-sm text-ink-2">{r.name}</div>
                <div className="num text-xl">
                  {r.name.includes('USD') ? '$' : ''}
                  {r.value.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                </div>
                <p className="mt-1 text-xs text-ink-muted">
                  {r.source} · {utc(r.at)}
                </p>
              </div>
            ))}
          </div>
          <p className="text-xs text-ink-muted">
            {preview.readings.length
              ? 'Only locally stored observations timestamped at or before the cutoff are shown; check their ages.'
              : 'No local model observations existed at this cutoff. Candle history is available; Risk Score and flow readings are unavailable, not zero.'}{' '}
            Current gauges are not substituted for historical ones.
          </p>
          {!result ? (
            <div className="space-y-3 border-t border-border pt-4">
              <div role="radiogroup" aria-label="Replay decision" className="flex flex-wrap gap-2">
                {(
                  [
                    ['bull', 'BUY'],
                    ['pass', 'PASS'],
                    ['bear', 'SHORT'],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    role="radio"
                    aria-checked={stance === k}
                    onClick={() => setStance(k)}
                    className={`rounded-lg border border-border px-5 py-2 ${stance === k ? 'bg-brand/15 ring-1 ring-brand/40' : ''}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label className="block text-sm">
                Setup{' '}
                <select
                  aria-label="Replay setup"
                  value={setup}
                  onChange={(e) => setSetup(e.target.value as Setup)}
                  className="rounded-lg border border-border bg-raised p-2"
                >
                  {SETUPS.map((s) => (
                    <option key={s} value={s}>
                      {setupLabel(s)}
                    </option>
                  ))}
                </select>
              </label>
              <input
                aria-label="Replay thesis"
                placeholder="Why this decision?"
                maxLength={200}
                value={thesis}
                onChange={(e) => setThesis(e.target.value)}
                className="w-full rounded-lg border border-border bg-raised p-2 text-sm"
              />
              <button
                disabled={!stance || busy}
                onClick={lock}
                className="rounded bg-brand/15 px-4 py-2 ring-1 ring-brand/40 disabled:opacity-40"
              >
                Lock decision & reveal
              </button>
              <p className="text-xs text-ink-muted">
                No edits after locking. Reveal uses the server-held outcome, costs no extra credits, and saves a replay call to your Desk.
                Prior knowledge of this token can still bias a replay.
              </p>
            </div>
          ) : (
            <div className="space-y-3 border-t border-border pt-4" role="status">
              <h3 className="text-xl font-semibold">Revealed: {result.call.grade?.replace('-', ' ')}</h3>
              <p className="text-sm">
                Locked {result.call.stance.toUpperCase()} · return {((result.call.ret ?? 0) * 100).toFixed(2)}% · exit{' '}
                {fmtPrice(result.call.exit)}{' '}
                {result.call.gradeReceipt && <InfoPopover p={receiptProvenance('Replay grade', result.call.gradeReceipt)} />}
              </p>
              <PricePath
                points={result.path}
                label="After the cutoff · revealed only after locking"
                tfMs={preview.horizon === '1h' ? 300_000 : preview.horizon === '24h' ? 3_600_000 : 14_400_000}
              />
              <Link prefetch={false} href="/desk" className="text-sm underline">
                View replay in the Desk <Go />
              </Link>
            </div>
          )}
          <details className="text-xs text-ink-muted">
            <summary>Fixed grading rules</summary>
            <p className="mt-2">{GRADE_RULES} Replays are separate from live calls in Trader DNA.</p>
          </details>
        </section>
      )}
    </div>
  );
}
