'use client';
// "Make a call" on the token page (L1): stance, horizon, setup, optional
// invalidation and one line of thesis. Saved with the price Nansen reports
// now; graded after the horizon. No score tells you what to call.
import Link from 'next/link';
import { useState } from 'react';
import { InfoPopover } from '@/components/InfoPopover';
import { SETUPS, setupLabel, type Horizon, type Setup, type Stance } from '@/lib/models/calls';
import { receiptProvenance, fmtPrice, GRADE_RULES, type ReceiptLike } from './receipt';

interface Saved { id: number; stance: Stance; horizon: Horizon; entry: number; dueAt: number; entryReceipt: ReceiptLike; symbol: string | null }
const STANCES: Array<[Stance, string]> = [['bull', 'Bull'], ['pass', 'Pass'], ['bear', 'Bear']];
const HORIZONS: Horizon[] = ['1h', '24h', '7d'];

export function CallForm({ chain, token, symbol, price, gauges }: { chain: string; token: string; symbol: string | null; price: number | null; gauges?: { direction: number | null; confidence: number | null; coordination: number | null } }) {
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
    setBusy(true); setErr(null);
    try {
      const r = await fetch('/api/desk', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
        action: 'create', chain, token, symbol, stance, horizon, setup, thesis: thesis.trim() || null,
        invalidation: stance !== 'pass' && Number(invalidation) > 0 ? Number(invalidation) : null, gauges: gauges ?? null,
      }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'The call was not saved.');
      setSaved(j.call);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  if (saved) {
    return (
      <div className="space-y-2 text-[13px]" role="status">
        <p className="text-ink">Saved: <b>{saved.stance}</b> {saved.symbol ?? 'this token'} for {saved.horizon}, from <span className="num">{fmtPrice(saved.entry)}</span> <InfoPopover p={receiptProvenance('Entry price for this call', saved.entryReceipt)} /></p>
        <p className="text-ink-2">Graded after {new Date(saved.dueAt).toISOString().slice(0, 16).replace('T', ' ')} UTC. It can’t be edited.</p>
        <div className="flex gap-3"><Link href="/desk" className="text-ink underline underline-offset-2">Open the Desk →</Link><button type="button" onClick={() => { setSaved(null); setStance(null); setThesis(''); setInvalidation(''); }} className="text-ink-muted hover:text-ink">Make another call</button></div>
      </div>
    );
  }
  const seg = (on: boolean) => `rounded-lg px-3 py-1.5 text-[13px] ${on ? 'bg-brand/15 text-ink ring-1 ring-brand/40' : 'border border-border text-ink-2 hover:text-ink'}`;
  return (
    <div className="space-y-3 text-[13px]">
      <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Stance">
        {STANCES.map(([k, label]) => <button key={k} type="button" role="radio" aria-checked={stance === k} onClick={() => setStance(k)} className={`${seg(stance === k)} min-h-14 flex-1 font-bold`}>{label}</button>)}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex gap-1" role="radiogroup" aria-label="Horizon">
          {HORIZONS.map((h) => <button key={h} type="button" role="radio" aria-checked={horizon === h} onClick={() => setHorizon(h)} className={seg(horizon === h)}>{h}</button>)}
        </div>
        <label className="text-ink-2">Setup<select aria-label="Setup" value={setup} onChange={(e) => setSetup(e.target.value as Setup)} className="mt-1 block rounded-lg border border-border bg-raised px-2 py-1.5 text-ink">{SETUPS.map((s) => <option key={s} value={s}>{setupLabel(s)}</option>)}</select></label>
        <label className="text-ink-2">Invalidation<input aria-label="Invalidation price" disabled={stance === 'pass'} value={invalidation} onChange={(e) => setInvalidation(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" placeholder={stance === 'bear' ? 'above entry' : 'below entry'} className="num mt-1 block w-28 rounded-lg border border-border bg-raised px-2 py-1.5 text-ink disabled:opacity-40" /></label>
      </div>
      <input aria-label="Thesis" value={thesis} onChange={(e) => setThesis(e.target.value.slice(0, 200))} placeholder="One line: why, and what would prove you wrong" className="block w-full rounded-lg border border-border bg-raised px-2.5 py-1.5 text-ink" />
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={!stance || busy} onClick={save} className="pill-button pill-primary w-full disabled:opacity-45">{busy ? 'Saving…' : 'Save the call'}</button>
        <span className="text-[11.5px] text-ink-muted">{price != null ? `Entry is Nansen’s latest close (about ${fmtPrice(price)}) at the moment you save.` : 'Entry is Nansen’s latest close at the moment you save.'}</span>
      </div>
      {err && <p className="text-ink">{err}</p>}
      <p className="text-[11.5px] text-ink-muted">{GRADE_RULES} Not financial advice.</p>
      <Link href={`/replay/${chain}/${encodeURIComponent(token)}`} className="inline-block text-sm text-ink underline underline-offset-4">Practice in the Time Machine →</Link>
    </div>
  );
}
