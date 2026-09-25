'use client';
import { Fragment, useEffect, useState } from 'react';
import { TimeAgo } from '@/components/TimeAgo';
import type { TideAlert } from '@/server/agents/alerts';

export function AlertsList() {
  const [alerts, setAlerts] = useState<TideAlert[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; name: string; timeWindow: string } | null>(null);

  const load = () =>
    fetch('/api/alerts')
      .then((r) => r.json())
      .then((d: { alerts?: TideAlert[]; error?: string; note?: string }) => {
        setNote(d.note ?? null);
        if (d.alerts) setAlerts(d.alerts);
        else setError(d.error ?? 'Could not load alerts.');
      })
      .catch(() => setError('Could not reach the alerts API.'));
  useEffect(() => {
    void load();
  }, []);

  async function act(id: string, method: 'PATCH' | 'DELETE', isEnabled?: boolean) {
    if (method === 'DELETE' && !window.confirm('Delete this alert from your Nansen account?')) return;
    setBusy(id);
    setError(null);
    const res = await fetch(method === 'DELETE' ? `/api/alerts?id=${encodeURIComponent(id)}` : '/api/alerts', {
      method,
      headers: { 'content-type': 'application/json' },
      body: method === 'PATCH' ? JSON.stringify({ id, isEnabled }) : undefined,
    });
    if (!res.ok) setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? 'Failed.');
    await load();
    setBusy(null);
  }

  async function save() {
    if (!editing) return;
    setBusy(editing.id);
    setError(null);
    const res = await fetch('/api/alerts?update=1', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: editing.id, name: editing.name, timeWindow: editing.timeWindow }),
    });
    if (!res.ok) setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? 'Failed.');
    setEditing(null);
    await load();
    setBusy(null);
  }

  if (error && !alerts) return <p className="text-sm text-ink-2">{error}</p>;
  if (!alerts) return <p className="animate-pulse text-sm text-ink-muted">Loading your Peregrine alerts from Nansen…</p>;
  if (note) return <p className="text-sm text-ink-2">{note}</p>;
  if (!alerts.length)
    return <p className="text-sm text-ink-2">No Peregrine alerts yet. Create one below, or use “Set risk alert” on a token page.</p>;
  return (
    <div tabIndex={0} role="region" aria-label="Alerts table" className="overflow-x-auto">
      {error && <p className="mb-2 text-sm text-ink-2">{error}</p>}
      <table className="w-full min-w-[640px] text-[12.5px]">
        <thead>
          <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-ink-muted">
            <th className="py-1.5 font-normal">Alert</th>
            <th className="py-1.5 font-normal">Window</th>
            <th className="py-1.5 font-normal">To</th>
            <th className="py-1.5 text-right font-normal">Fired</th>
            <th className="py-1.5 font-normal pl-3">Last</th>
            <th className="py-1.5 font-normal">On</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {alerts.map((a) => (
            <Fragment key={a.id}>
              <tr className="border-b border-border/50 align-top">
                <td className="py-1.5 pr-3">
                  <div className="text-ink">{a.name}</div>
                  <div className="text-[11.5px] text-ink-muted">{a.description}</div>
                  {a.error && <div className="text-[11.5px] text-ink-2">Nansen: {a.error}</div>}
                </td>
                <td className="py-1.5 text-ink-2">{a.timeWindow}</td>
                <td className="py-1.5 text-ink-2">{a.channels.join(', ')}</td>
                <td className="num py-1.5 text-right text-ink">{a.triggers}</td>
                <td className="num py-1.5 pl-3 text-ink-muted">{a.lastTriggered ? <TimeAgo ts={Date.parse(a.lastTriggered)} /> : '—'}</td>
                <td className="py-1.5">
                  <button
                    role="switch"
                    aria-checked={a.isEnabled}
                    disabled={busy === a.id}
                    onClick={() => act(a.id, 'PATCH', !a.isEnabled)}
                    className={`relative h-5 w-9 rounded-full transition-colors ${a.isEnabled ? 'bg-ink' : 'bg-accent'}`}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-surface transition-all ${a.isEnabled ? 'left-[18px]' : 'left-0.5'}`}
                    />
                    <span className="sr-only">{a.isEnabled ? 'On' : 'Off'}</span>
                  </button>
                </td>
                <td className="whitespace-nowrap py-1.5 text-right">
                  <button
                    disabled={busy === a.id}
                    onClick={() => setEditing(editing?.id === a.id ? null : { id: a.id, name: a.name, timeWindow: a.timeWindow })}
                    className="mr-3 text-[12px] text-ink-2 hover:text-ink hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    disabled={busy === a.id}
                    onClick={() => act(a.id, 'DELETE')}
                    className="text-[12px] text-ink-2 hover:text-ink hover:underline"
                  >
                    Delete
                  </button>
                </td>
              </tr>
              {editing?.id === a.id && (
                <tr className="border-b border-border/50">
                  <td colSpan={7} className="py-2">
                    <div className="flex flex-wrap items-end gap-2">
                      <label className="text-[12px] text-ink-2">
                        Name
                        <input
                          value={editing.name}
                          maxLength={80}
                          onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                          className="mt-1 block w-72 rounded-lg border border-border bg-raised px-2 py-1 text-[12.5px] text-ink"
                        />
                      </label>
                      <label className="text-[12px] text-ink-2">
                        Window
                        <select
                          value={editing.timeWindow}
                          onChange={(e) => setEditing({ ...editing, timeWindow: e.target.value })}
                          className="mt-1 block rounded-lg border border-border bg-raised px-2 py-1 text-[12.5px] text-ink"
                        >
                          {['realtime', '5m', '10m', '30m', '1h', '4h', '12h', '1d', '1w'].map((w) => (
                            <option key={w} value={w}>
                              {w}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        onClick={save}
                        disabled={busy === a.id}
                        className="rounded bg-brand/15 px-3 py-1 text-[12.5px] text-ink ring-1 ring-brand/40"
                      >
                        Save on Nansen
                      </button>
                      <button onClick={() => setEditing(null)} className="text-[12px] text-ink-muted hover:text-ink">
                        Cancel
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
