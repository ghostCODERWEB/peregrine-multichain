'use client';
// "Make a call" on the token page (L1): stance, horizon, setup, optional
// invalidation and one line of thesis. Saved with the price Nansen reports
// now; graded after the horizon. No score tells you what to call.
import Link from 'next/link';
import { useState } from 'react';
import { InfoPopover } from '@/components/InfoPopover';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { SETUPS, setupLabel, type Horizon, type Setup, type Stance } from '@/lib/models/calls';
import { receiptProvenance, fmtPrice, GRADE_RULES, type ReceiptLike } from './receipt';
import { Go } from '@/components/ui/Icons';

interface Saved {
  id: number;
  stance: Stance;
  horizon: Horizon;
  entry: number;
  dueAt: number;
  entryReceipt: ReceiptLike;
  symbol: string | null;
}
const STANCES: Array<[Stance, string]> = [
  ['bull', 'Bull'],
  ['pass', 'Pass'],
  ['bear', 'Bear'],
];
const HORIZONS: Horizon[] = ['1h', '24h', '7d'];

export function CallForm({
  chain,
  token,
  symbol,
  price,
  gauges,
}: {
  chain: string;
  token: string;
  symbol: string | null;
  price: number | null;
  gauges?: { direction: number | null; confidence: number | null; coordination: number | null };
}) {
  const [stance, setStance] = useState<Stance | null>(null);
  const [horizon, setHorizon] = useState<Horizon>('24h');
  const [setup, setSetup] = useState<Setup>('other');
  const [invalidation, setInvalidation] = useState('');
  const [thesis, setThesis] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);

  async function save() {
    if (!stance) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch('/api/desk', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          chain,
          token,
          symbol,
          stance,
          horizon,
          setup,
          thesis: thesis.trim() || null,
          invalidation: stance !== 'pass' && Number(invalidation) > 0 ? Number(invalidation) : null,
          gauges: gauges ?? null,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'The call was not saved.');
      setSaved(j.call);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (saved) {
    return (
      <div className="space-y-2 text-[13px]" role="status">
        <p className="text-ink">
          Saved: <b>{saved.stance}</b> {saved.symbol ?? 'this token'} for {saved.horizon}, from{' '}
          <span className="num">{fmtPrice(saved.entry)}</span>{' '}
          <InfoPopover p={receiptProvenance('Entry price for this call', saved.entryReceipt)} />
        </p>
        <p className="text-ink-2">
          Graded after {new Date(saved.dueAt).toISOString().slice(0, 16).replace('T', ' ')} UTC. It can’t be edited.
        </p>
        <div className="flex gap-3">
          <Link prefetch={false} href="/desk" className="text-ink underline underline-offset-2">
            Open the Desk <Go />
          </Link>
          <button
            type="button"
            onClick={() => {
              setSaved(null);
              setStance(null);
              setThesis('');
              setInvalidation('');
            }}
            className="text-ink-muted hover:text-ink"
          >
            Make another call
          </button>
        </div>
      </div>
    );
  }
  const TONE: Record<Stance, string> = { bull: 'var(--mint)', pass: 'var(--ink-2)', bear: 'var(--flare)' };
  const field =
    'mt-1 block w-full rounded-[12px] border border-[var(--hair)] bg-ink/[0.04] px-3 py-2 text-[13px] text-ink outline-none focus:border-[var(--mint)]';
  return (
    <div className="space-y-4 text-[13px]">
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Stance">
        {STANCES.map(([k, label]) => {
          const on = stance === k,
            Icon = k === 'bull' ? ArrowUp : k === 'bear' ? ArrowDown : Minus;
          return (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={label}
              onClick={() => setStance(k)}
              className="flex min-h-[58px] flex-col items-center justify-center gap-0.5 rounded-[14px] border text-[14px] font-extrabold text-ink transition-colors"
              style={{
                borderColor: on ? TONE[k] : 'var(--hair)',
                background: on ? `color-mix(in srgb, ${TONE[k]} 14%, transparent)` : 'color-mix(in srgb, var(--ink-1) 4%, transparent)',
              }}
            >
              <Icon size={16} style={{ color: TONE[k] }} aria-hidden />
              {label}
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="font-semibold text-ink-2">Horizon</span>
        <div
          className="inline-flex gap-0.5 rounded-[12px] border border-[var(--hair)] bg-ink/5 p-[3px]"
          role="radiogroup"
          aria-label="Horizon"
        >
          {HORIZONS.map((h) => (
            <button
              key={h}
              type="button"
              role="radio"
              aria-checked={horizon === h}
              onClick={() => setHorizon(h)}
              className={`num min-h-[30px] rounded-[9px] px-3.5 text-[12.5px] font-bold ${horizon === h ? 'bg-ink/15 text-ink shadow-[inset_0_1px_0_var(--hair-2)]' : 'text-ink-muted hover:text-ink'}`}
            >
              {h}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[12px] font-semibold text-ink-muted">
          Setup
          <select aria-label="Setup" value={setup} onChange={(e) => setSetup(e.target.value as Setup)} className={field}>
            {SETUPS.map((s) => (
              <option key={s} value={s}>
                {setupLabel(s)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[12px] font-semibold text-ink-muted">
          Invalidation
          <input
            aria-label="Invalidation price"
            disabled={stance === 'pass'}
            value={invalidation}
            onChange={(e) => setInvalidation(e.target.value.replace(/[^\d.]/g, ''))}
            inputMode="decimal"
            placeholder={stance === 'pass' ? 'n/a for a pass' : 'price, optional'}
            className={`${field} num disabled:opacity-50`}
          />
        </label>
      </div>
      <textarea
        aria-label="Thesis"
        rows={2}
        value={thesis}
        onChange={(e) => setThesis(e.target.value.slice(0, 200))}
        placeholder="Thesis (optional): why, and what would prove you wrong"
        className={`${field} resize-none`}
      />
      <button
        type="button"
        disabled={!stance || busy}
        onClick={save}
        className="h-12 w-full rounded-[14px] bg-ink text-[15px] font-extrabold text-page disabled:opacity-45"
      >
        {busy ? 'Locking…' : 'Lock call'}
      </button>
      {err && <p className="text-ink">{err}</p>}
      <p className="text-center text-[11.5px] text-ink-muted">
        {price != null ? `Entry: Nansen’s latest close (about ${fmtPrice(price)}) when you lock. ` : ''}Can’t be edited. Not financial
        advice.
      </p>
      <details className="text-[11.5px] text-ink-muted">
        <summary className="cursor-pointer select-none font-semibold text-ink-2">How calls are graded</summary>
        <p className="mt-1">{GRADE_RULES}</p>
      </details>
      <Link prefetch={false}
        href={`/replay/${chain}/${encodeURIComponent(token)}`}
        className="inline-block text-[13px] font-semibold text-ink underline underline-offset-4"
      >
        Practice in the Time Machine <Go />
      </Link>
    </div>
  );
}
