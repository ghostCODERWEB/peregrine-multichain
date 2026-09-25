'use client';
import { useState } from 'react';
import { Card, Unavailable, WaveLoading } from '@/components/Card';
import { InfoPopover } from '@/components/InfoPopover';
import type { DeskData, DeskSection } from '@/server/wallet/desk';
import { chainName, usd } from '@/lib/viz/format';

const SECTIONS: Array<{ id: DeskSection; label: string; credits: string }> = [
  { id: 'pnl', label: 'Token PnL', credits: '1' },
  { id: 'dex', label: 'DEX trades', credits: '1' },
  { id: 'history', label: 'Balance history', credits: 'up to 5' },
  { id: 'defi', label: 'DeFi', credits: '1' },
  { id: 'perps', label: 'Hyperliquid', credits: 'up to 7' },
  { id: 'prediction', label: 'Prediction markets', credits: '2' },
  { id: 'points', label: 'Points & rank', credits: '0' },
];
type Result = DeskData & { tally: { credits: number; calls: number; cached: number } };

export function WalletDesk({ address, initialChain, chains }: { address: string; initialChain: string; chains: readonly string[] }) {
  const [chain, setChain] = useState(initialChain),
    [section, setSection] = useState<DeskSection>('pnl');
  const [result, setResult] = useState<Result | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const selected = SECTIONS.find((s) => s.id === section)!;
  async function load() {
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const r = await fetch('/api/wallet/desk', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ address, chain, section }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'This section could not be loaded.');
      setResult(d);
      if (d.weather) window.dispatchEvent(new CustomEvent('tide:wallet-weather', { detail: d.weather }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card
      id="wallet-desk"
      title="Follow the wallet beyond its balance"
      sub="Explore trading, protocol positions and account history. Each section loads only when requested."
    >
      <div className="flex flex-wrap gap-2">
        <label className="text-xs text-ink-2">
          Spot chain
          <select
            aria-label="Wallet desk chain"
            className="ml-2 rounded-md border border-border bg-surface px-2 py-2"
            disabled={busy}
            value={chain}
            onChange={(e) => {
              setChain(e.target.value);
              setResult(null);
              setError('');
            }}
          >
            {chains.map((c) => (
              <option key={c} value={c}>
                {chainName(c)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-ink-2">
          Explore
          <select
            aria-label="Wallet desk section"
            className="ml-2 rounded-md border border-border bg-surface px-2 py-2"
            disabled={busy}
            value={section}
            onChange={(e) => {
              setSection(e.target.value as DeskSection);
              setResult(null);
              setError('');
            }}
          >
            {SECTIONS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={load}
          disabled={busy}
          className="rounded-md border border-border bg-accent px-3 py-2 text-xs text-ink disabled:opacity-50"
        >
          {busy ? 'Loading…' : `Load ${selected.label} · ${selected.credits} credits if uncached`}
        </button>
      </div>
      <div aria-live="polite" className="mt-4">
        {busy && <WaveLoading what={selected.label} height={140} />}
        {error && <Unavailable text={error} />}
        {result && (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold">{result.title}</h3>
                <p className="mt-1 text-xs text-ink-2">{result.description}</p>
              </div>
              <InfoPopover p={result.provenance} />
            </div>
            {section === 'history' && result.tables[0]?.rows.length > 1 && <HistoryLine rows={result.tables[0].rows} />}
            {result.tables.map((t) => (
              <div key={t.title}>
                <h4 className="mb-2 text-sm text-ink-2">{t.title}</h4>
                {t.rows.length ? (
                  <div className="max-h-96 overflow-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr>
                          {t.columns.map((c) => (
                            <th key={c} className="whitespace-nowrap border-b border-border p-2 font-normal text-ink-muted">
                              {c}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {t.rows.map((row, i) => (
                          <tr key={i}>
                            {row.map((v, j) => (
                              <td key={j} className="max-w-64 break-words border-b border-border/50 p-2">
                                {v == null ? '—' : typeof v === 'number' && t.columns[j] === 'Value USD' ? usd(v) : v}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Unavailable text="Nansen returned no records for this section." />
                )}
              </div>
            ))}
            {result.provenance.notes?.map((n) => (
              <p key={n} className="text-xs text-ink-muted">
                {n}
              </p>
            ))}
            <p className="num text-xs text-ink-muted">
              {result.tally.calls} Nansen calls · {result.tally.credits} credits · {result.tally.cached} cached
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}

function HistoryLine({ rows }: { rows: Array<Array<string | number | null>> }) {
  const values = rows.map((r) => Number(r[1])),
    max = Math.max(...values, 1),
    min = Math.min(...values, 0);
  const points = values
    .map((v, i) => `${20 + (i / Math.max(1, values.length - 1)) * 920},${160 - ((v - min) / (max - min)) * 130}`)
    .join(' ');
  return (
    <div className="rounded-lg bg-accent/30 p-3">
      <svg viewBox="0 0 960 190" role="img" aria-label="Daily spot balance history; exact values in the table below" className="w-full">
        <path d="M20 160H940" stroke="var(--axis)" />
        <polyline points={points} fill="none" stroke="var(--in-3)" strokeWidth="3" />
        <text x="20" y="185" fill="var(--ink-muted)" fontSize="13">
          {String(rows[0][0])}
        </text>
        <text x="940" y="185" textAnchor="end" fill="var(--ink-muted)" fontSize="13">
          {String(rows.at(-1)?.[0])}
        </text>
      </svg>
    </div>
  );
}
