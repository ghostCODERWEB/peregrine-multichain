'use client';
import Link from 'next/link';
import { useState } from 'react';
import { InfoPopover } from '@/components/InfoPopover';
import { usd, num } from '@/lib/viz/format';
import type { Provenance } from '@/lib/provenance';

interface PlanSummary {
  symbol: string; storm: number; band: string; outflowThresholdUsd: number; insiderThresholdUsd: number | null;
  insiderWallets: number; alerts: number; provenance: Provenance;
}

/** "Set storm alert": preview the thresholds TIDE derives from the Storm
 *  Score, then create them as Nansen Smart Alerts on the user's channel.
 *  Nothing is created until the second, explicit click. */
export function StormAlertForm({ chain, address, clusterWallets }: { chain: string; address: string; clusterWallets: string[] }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<'telegram' | 'discord'>('telegram');
  const [target, setTarget] = useState('');
  const [plan, setPlan] = useState<PlanSummary | null>(null);
  const [state, setState] = useState<'idle' | 'busy' | 'created' | 'error'>('idle');
  const [msg, setMsg] = useState<string | null>(null);

  async function post(dryRun: boolean) {
    setState('busy'); setMsg(null);
    const channel = kind === 'telegram' ? { type: 'telegram', chatId: target } : { type: 'discord', webhookUrl: target };
    const res = await fetch('/api/alerts', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chain, address, clusterWallets, channel: dryRun && !target ? undefined : channel, dryRun }),
    });
    const d = (await res.json()) as { plan?: PlanSummary; created?: number; error?: string };
    if (!res.ok || !d.plan) { setState('error'); setMsg(d.error ?? 'Could not reach the alerts API.'); return; }
    setPlan(d.plan);
    if (dryRun) { setState('idle'); return; }
    setState('created');
    setMsg(`Created ${d.created} Nansen Smart Alert${d.created === 1 ? '' : 's'}. They run on Nansen's side, with this tab closed.`);
  }

  if (!open) {
    return (
      <button onClick={() => { setOpen(true); void post(true); }} className="rounded-md border border-border px-3 py-1.5 text-[12.5px] text-ink hover:bg-accent">
        Set storm alert
      </button>
    );
  }
  return (
    <div className="space-y-3 rounded-lg border border-border p-3 text-[12.5px]">
      {plan ? (
        <div className="flex items-start justify-between gap-2">
          <ul className="list-disc space-y-1 pl-4 text-ink-2">
            <li>Smart money sells more than <b className="num text-ink">{usd(plan.outflowThresholdUsd)}</b> of {plan.symbol} in a day (threshold set by Storm {num(plan.storm, 0)}).</li>
            {plan.insiderThresholdUsd != null
              ? <li>Any of the <b className="text-ink">{plan.insiderWallets}</b> clustered insider wallets sells or sends more than <b className="num text-ink">{usd(plan.insiderThresholdUsd)}</b>.</li>
              : <li className="text-ink-muted">No insider clusters found, so no insider-transfer alert.</li>}
          </ul>
          <InfoPopover p={plan.provenance} />
        </div>
      ) : state === 'error' ? null : <p className="text-ink-muted">Working out thresholds…</p>}
      <div className="flex flex-wrap items-center gap-2">
        <select value={kind} onChange={(e) => setKind(e.target.value as 'telegram' | 'discord')} className="rounded-md border border-border bg-surface px-2 py-1 text-ink" aria-label="Delivery channel">
          <option value="telegram">Telegram chat id</option>
          <option value="discord">Discord webhook</option>
        </select>
        <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder={kind === 'telegram' ? 'e.g. 123456789 or -100…' : 'https://discord.com/api/webhooks/…'}
          className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1 text-ink placeholder:text-ink-muted" aria-label={kind === 'telegram' ? 'Telegram chat id' : 'Discord webhook URL'} />
        <button onClick={() => post(false)} disabled={!target || state === 'busy' || state === 'created'}
          className="rounded-md bg-ink px-3 py-1 text-[12.5px] font-medium text-page disabled:opacity-50">
          {state === 'busy' ? 'Working…' : `Create ${plan?.alerts ?? ''} alert${plan?.alerts === 1 ? '' : 's'} in Nansen`}
        </button>
      </div>
      <p className="text-[11.5px] text-ink-muted">
        Telegram: message your Nansen alerts bot to get your chat id. Alerts are created on the Nansen account behind this Peregrine&apos;s API key.
        {msg && <span className={state === 'error' ? ' text-ink' : ' text-ink-2'}> {msg}</span>}
        {state === 'created' && <> <Link href="/alerts" className="underline underline-offset-2 hover:text-ink">Manage alerts →</Link></>}
      </p>
    </div>
  );
}
