'use client';
import { useEffect, useMemo, useState } from 'react';
import { InfoPopover } from '@/components/InfoPopover';
import { chainName, usd } from '@/lib/viz/format';
import type { Provenance } from '@/lib/provenance';
import { Go } from '@/components/ui/Icons';

type Template = 'follow' | 'front' | 'chain-inflow' | 'deployer' | 'token-flows' | 'wallets';
interface Builder {
  fronts: Array<{ from: string; to: string; netUsd: number; wallets: number }>;
  follows: number;
  chains: string[];
}
interface Draft {
  name: string;
  type: string;
  timeWindow: string;
  summary: string;
  provenance: Provenance;
}

const TEMPLATES: Array<{ id: Template; title: string; blurb: string; kind: string }> = [
  { id: 'follow', title: 'My follow list', blurb: 'Any wallet you follow on the smart-money desk trades.', kind: 'token transfer' },
  {
    id: 'front',
    title: 'Capital rotation',
    blurb: 'The wallets moving capital between two chains buy on the destination.',
    kind: 'token transfer',
  },
  {
    id: 'chain-inflow',
    title: 'Chain inflow surge',
    blurb: 'Smart money piles into a single token on a chain within an hour.',
    kind: 'smart-money flows',
  },
  { id: 'token-flows', title: 'Token buying', blurb: 'Smart money buys a token past a daily threshold.', kind: 'smart-money flows' },
  { id: 'deployer', title: 'Deployer moves', blurb: 'A token’s deployer calls any contract again.', kind: 'contract call' },
  { id: 'wallets', title: 'Any wallets', blurb: 'Wallets you name move more than a threshold.', kind: 'token transfer' },
];

type ChannelType = 'telegram' | 'discord' | 'slack' | 'webhook';

export function AlertBuilder() {
  const [builder, setBuilder] = useState<Builder | null>(null);
  const [template, setTemplate] = useState<Template>('chain-inflow');
  const [chain, setChain] = useState('base');
  const [token, setToken] = useState('');
  const [front, setFront] = useState(0);
  const [minUsd, setMinUsd] = useState('');
  const [addrs, setAddrs] = useState('');
  const [channelType, setChannelType] = useState<ChannelType>('telegram');
  const [channelValue, setChannelValue] = useState('');
  const [secret, setSecret] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [state, setState] = useState<{ busy?: boolean; error?: string; done?: string }>({});

  useEffect(() => {
    fetch('/api/alerts')
      .then((r) => r.json())
      .then((d: { builder?: Builder }) => {
        if (d.builder) setBuilder(d.builder);
      })
      .catch(() => {});
    // Prefill from a link such as /alerts?template=deployer&chain=base&address=0x…
    const q = new URLSearchParams(window.location.search);
    const t = q.get('template') as Template | null;
    if (t && TEMPLATES.some((x) => x.id === t)) setTemplate(t);
    if (q.get('chain')) setChain(q.get('chain')!);
    if (q.get('token')) setToken(q.get('token')!);
    if (q.get('address')) setAddrs(q.get('address')!);
  }, []);

  const input = useMemo(
    () => ({
      chain,
      token: token.trim() || undefined,
      front,
      minUsd: Number(minUsd) > 0 ? Number(minUsd) : undefined,
      addresses: addrs
        .split(/[\s,]+/)
        .map((a) => a.trim())
        .filter(Boolean),
    }),
    [chain, token, front, minUsd, addrs],
  );
  const channel = channelValue.trim()
    ? channelType === 'telegram'
      ? { type: channelType, chatId: channelValue.trim() }
      : { type: channelType, webhookUrl: channelValue.trim(), ...(channelType === 'webhook' && secret ? { secret } : {}) }
    : undefined;

  async function send(dryRun: boolean) {
    setState({ busy: true });
    const r = await fetch('/api/alerts', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ template, input, channel, dryRun }),
    });
    const j = (await r.json().catch(() => ({}))) as { draft?: Draft; created?: boolean; error?: string };
    if (!r.ok) {
      setState({ error: j.error ?? 'Failed.' });
      return;
    }
    setDraft(j.draft ?? null);
    setState(j.created ? { done: 'Created on your Nansen account. It now appears in the list above.' } : {});
  }
  // A new choice invalidates the preview.
  useEffect(() => {
    setDraft(null);
    setState({});
  }, [template, chain, token, front, minUsd, addrs]);

  const t = TEMPLATES.find((x) => x.id === template)!;
  const disabled = (id: Template) => (id === 'front' && !builder?.fronts.length) || (id === 'follow' && !builder?.follows);
  const chains = builder?.chains ?? ['ethereum', 'base', 'solana'];

  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label="Alert template" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {TEMPLATES.map((x) => (
          <button
            key={x.id}
            role="radio"
            aria-checked={template === x.id}
            disabled={disabled(x.id)}
            onClick={() => setTemplate(x.id)}
            className={`rounded-xl border p-3 text-left transition-colors disabled:opacity-45 ${template === x.id ? 'border-brand/60 bg-brand/10' : 'border-border hover:bg-raised/60'}`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[13px] font-semibold text-ink">{x.title}</span>
              <span className="text-[10.5px] text-ink-muted">{x.kind}</span>
            </div>
            <div className="mt-0.5 text-[12px] text-ink-2">{x.blurb}</div>
            {x.id === 'follow' && (
              <div className="mt-1 text-[11px] text-ink-muted">
                {builder?.follows ? `${builder.follows} wallets followed` : 'Follow wallets on the smart-money desk first'}
              </div>
            )}
            {x.id === 'front' && (
              <div className="mt-1 text-[11px] text-ink-muted">
                {builder?.fronts.length ? `${builder.fronts.length} rotations in 24h` : 'Key owner only; none in 24h'}
              </div>
            )}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {(template === 'chain-inflow' || template === 'deployer' || template === 'token-flows' || template === 'wallets') && (
          <label className="text-[12.5px] text-ink-2">
            Chain
            <select
              value={chain}
              onChange={(e) => setChain(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-border bg-raised px-2.5 py-1.5 text-[13px] text-ink"
            >
              {chains.map((c) => (
                <option key={c} value={c}>
                  {chainName(c)}
                </option>
              ))}
            </select>
          </label>
        )}
        {template === 'front' && builder?.fronts.length ? (
          <label className="text-[12.5px] text-ink-2">
            Rotation
            <select
              value={front}
              onChange={(e) => setFront(Number(e.target.value))}
              className="mt-1 block w-full rounded-lg border border-border bg-raised px-2.5 py-1.5 text-[13px] text-ink"
            >
              {builder.fronts.map((f, i) => (
                <option key={i} value={i}>
                  {chainName(f.from)} <Go /> {chainName(f.to)} · {usd(f.netUsd)} · {f.wallets} wallets
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {template === 'token-flows' && (
          <label className="text-[12.5px] text-ink-2">
            Token address
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="0x… or mint"
              className="num mt-1 block w-full rounded-lg border border-border bg-raised px-2.5 py-1.5 text-[13px] text-ink"
            />
          </label>
        )}
        {(template === 'deployer' || template === 'wallets') && (
          <label className="text-[12.5px] text-ink-2 sm:col-span-2">
            {template === 'deployer' ? 'Deployer address' : 'Wallet addresses (up to 20, one per line)'}
            <textarea
              value={addrs}
              onChange={(e) => setAddrs(e.target.value)}
              rows={template === 'deployer' ? 1 : 3}
              className="num mt-1 block w-full rounded-lg border border-border bg-raised px-2.5 py-1.5 text-[13px] text-ink"
            />
          </label>
        )}
        {template !== 'deployer' && (
          <label className="text-[12.5px] text-ink-2">
            Threshold, USD <span className="text-ink-muted">(blank: Peregrine&apos;s default)</span>
            <input
              value={minUsd}
              onChange={(e) => setMinUsd(e.target.value.replace(/[^\d.]/g, ''))}
              inputMode="decimal"
              placeholder="default"
              className="num mt-1 block w-full rounded-lg border border-border bg-raised px-2.5 py-1.5 text-[13px] text-ink"
            />
          </label>
        )}
      </div>

      <fieldset className="grid gap-3 rounded-xl border border-border p-3 sm:grid-cols-[160px_1fr]">
        <legend className="px-1 text-[12px] text-ink-muted">Deliver to (Nansen sends it; Peregrine never contacts this address)</legend>
        <select
          aria-label="Channel type"
          value={channelType}
          onChange={(e) => {
            setChannelType(e.target.value as ChannelType);
            setChannelValue('');
          }}
          className="rounded-lg border border-border bg-raised px-2.5 py-1.5 text-[13px] text-ink"
        >
          <option value="telegram">Telegram</option>
          <option value="discord">Discord</option>
          <option value="slack">Slack</option>
          <option value="webhook">Webhook</option>
        </select>
        <input
          aria-label={channelType === 'telegram' ? 'Telegram chat id' : 'Webhook URL'}
          value={channelValue}
          onChange={(e) => setChannelValue(e.target.value)}
          placeholder={
            channelType === 'telegram'
              ? 'Chat id, e.g. 123456789 (groups start with -)'
              : channelType === 'discord'
                ? 'https://discord.com/api/webhooks/…'
                : channelType === 'slack'
                  ? 'https://hooks.slack.com/…'
                  : 'https://your-endpoint…'
          }
          className="num rounded-lg border border-border bg-raised px-2.5 py-1.5 text-[13px] text-ink"
        />
        {channelType === 'webhook' && (
          <input
            aria-label="Signing secret"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="Optional signing secret (16+ characters)"
            className="num rounded-lg border border-border bg-raised px-2.5 py-1.5 text-[13px] text-ink sm:col-start-2"
          />
        )}
      </fieldset>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => send(true)}
          disabled={state.busy}
          className="rounded border border-border px-3.5 py-1.5 text-[13px] text-ink hover:bg-raised"
        >
          Preview the alert
        </button>
        <button
          onClick={() => send(false)}
          disabled={state.busy || !draft || !channel}
          className="rounded bg-brand/15 px-3.5 py-1.5 text-[13px] text-ink ring-1 ring-brand/40 hover:bg-brand/25 disabled:opacity-45"
        >
          Create on my Nansen account
        </button>
        <span className="text-[11.5px] text-ink-muted">
          {!draft ? 'Preview first.' : !channel ? 'Add where to deliver it.' : `${t.title}: ready.`}
        </span>
      </div>
      {state.error && <p className="text-[12.5px] text-ink-2">{state.error}</p>}
      {state.done && <p className="text-[12.5px] text-ink">{state.done}</p>}
      {draft && (
        <div className="rounded-xl border border-border/70 bg-raised/50 p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-[13px] font-semibold text-ink">{draft.name}</div>
              <div className="text-[12.5px] text-ink-2">{draft.summary}</div>
            </div>
            <InfoPopover p={draft.provenance} />
          </div>
          <div className="mt-1 text-[11.5px] text-ink-muted">
            Nansen alert type {draft.type} · window {draft.timeWindow}. Nansen has no test-delivery call; the first real match is the test.
          </div>
          <details className="mt-2 text-[12px]">
            <summary className="cursor-pointer text-ink-2">The exact request</summary>
            <pre className="num mt-1 max-h-64 overflow-auto rounded-lg bg-page/60 p-2 text-[11px] text-ink-2">
              {JSON.stringify(draft.provenance.calls[0]?.body, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
