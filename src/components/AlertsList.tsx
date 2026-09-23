'use client';
import { useEffect, useState } from 'react';
import { TimeAgo } from '@/components/TimeAgo';
import type { TideAlert } from '@/server/agents/alerts';

export function AlertsList() {
  const [alerts, setAlerts] = useState<TideAlert[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = () => fetch('/api/alerts').then((r) => r.json()).then((d: { alerts?: TideAlert[]; error?: string; note?: string }) => {
    setNote(d.note ?? null);
    if (d.alerts) setAlerts(d.alerts); else setError(d.error ?? 'Could not load alerts.');
  }).catch(() => setError('Could not reach the alerts API.'));
  useEffect(() => { void load(); }, []);

  async function act(id: string, method: 'PATCH' | 'DELETE', isEnabled?: boolean) {
    if (method === 'DELETE' && !window.confirm('Delete this alert from your Nansen account?')) return;
    setBusy(id); setError(null);
    const res = await fetch(method === 'DELETE' ? `/api/alerts?id=${encodeURIComponent(id)}` : '/api/alerts', {
      method, headers: { 'content-type': 'application/json' }, body: method === 'PATCH' ? JSON.stringify({ id, isEnabled }) : undefined,
    });
    if (!res.ok) setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? 'Failed.');
    await load();
    setBusy(null);
  }

  if (error && !alerts) return <p className="text-sm text-ink-2">{error}</p>;
  if (!alerts) return <p className="animate-pulse text-sm text-ink-muted">Loading your TIDE alerts from Nansen…</p>;
  if (note) return <p className="text-sm text-ink-2">{note}</p>;
  if (!alerts.length) return <p className="text-sm text-ink-2">No TIDE storm alerts yet. Open a token page and use “Set storm alert”.</p>;
  return (
    <div className="overflow-x-auto">
      {error && <p className="mb-2 text-sm text-ink-2">{error}</p>}
      <table className="w-full min-w-[640px] text-[12.5px]">
        <thead><tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-ink-muted">
          <th className="py-1.5 font-normal">Alert</th><th className="py-1.5 font-normal">Window</th><th className="py-1.5 font-normal">To</th>
          <th className="py-1.5 text-right font-normal">Fired</th><th className="py-1.5 font-normal pl-3">Last</th><th className="py-1.5 font-normal">On</th><th />
        </tr></thead>
        <tbody>
          {alerts.map((a) => (
            <tr key={a.id} className="border-b border-border/50 align-top">
              <td className="py-1.5 pr-3"><div className="text-ink">{a.name}</div><div className="text-[11.5px] text-ink-muted">{a.description}</div>{a.error && <div className="text-[11.5px] text-ink-2">Nansen: {a.error}</div>}</td>
              <td className="py-1.5 text-ink-2">{a.timeWindow}</td>
              <td className="py-1.5 text-ink-2">{a.channels.join(', ')}</td>
              <td className="num py-1.5 text-right text-ink">{a.triggers}</td>
              <td className="num py-1.5 pl-3 text-ink-muted">{a.lastTriggered ? <TimeAgo ts={Date.parse(a.lastTriggered)} /> : '—'}</td>
              <td className="py-1.5">
                <button role="switch" aria-checked={a.isEnabled} disabled={busy === a.id} onClick={() => act(a.id, 'PATCH', !a.isEnabled)}
                  className={`relative h-5 w-9 rounded-full transition-colors ${a.isEnabled ? 'bg-ink' : 'bg-accent'}`}>
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-surface transition-all ${a.isEnabled ? 'left-[18px]' : 'left-0.5'}`} />
                  <span className="sr-only">{a.isEnabled ? 'On' : 'Off'}</span>
                </button>
              </td>
              <td className="py-1.5 text-right"><button disabled={busy === a.id} onClick={() => act(a.id, 'DELETE')} className="text-[12px] text-ink-2 hover:text-ink hover:underline">Delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
