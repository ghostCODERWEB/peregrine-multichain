'use client';
import { useEffect, useState, type ReactNode } from 'react';
import {
  buildAuthorization, typedDataFor, paymentPayload, encodeHeader, formatPrice, X402_MAX_PRICE_USD, type X402Quote,
} from '@/lib/x402';

type Option = X402Quote['options'][number];
type Stage =
  | { k: 'quoting' }
  | { k: 'price'; quote: X402Quote }
  | { k: 'off'; reason: string }
  | { k: 'connecting' }
  | { k: 'confirm'; quote: X402Quote; payer: string; option: Option }
  | { k: 'signing'; option: Option }
  | { k: 'done'; data: unknown; paid: { usd: number; network: string; tx: string | null } }
  | { k: 'error'; message: string; quote: X402Quote | null };

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const d = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) throw new Error(d.error ?? `Request failed (${r.status})`);
  return d;
}

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

function randomNonce(): string {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return `0x${Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')}`;
}

function walletError(e: unknown): string {
  const code = (e as { code?: number }).code;
  if (code === 4001) return 'You declined in your wallet. Nothing was paid.';
  if (code === 4902) return 'Your wallet does not have this network yet. Add it in the wallet, then try again.';
  return (e as Error).message ?? 'Wallet error';
}

/**
 * A Nansen call a keyless visitor can pay for per call (x402), from their
 * own wallet, in USDC. The price is on the button before anything happens;
 * clicking connects the wallet and shows exactly what will be signed; only
 * a second, explicit click asks the wallet for the signature. Nothing is
 * ever signed automatically, and the data comes back to this visitor only.
 */
export function PayPerCall({ endpoint, body, action, children }: {
  endpoint: string;
  body: unknown;
  /** What the button does, e.g. "Load live smart-money trades". */
  action: string;
  children: (data: unknown) => ReactNode;
}) {
  const [stage, setStage] = useState<Stage>({ k: 'quoting' });
  const bodyKey = JSON.stringify(body);

  useEffect(() => {
    let live = true;
    postJson<X402Quote>('/api/x402/quote', { endpoint, body: JSON.parse(bodyKey) })
      .then((quote) => live && setStage(quote.options.length ? { k: 'price', quote } : { k: 'off', reason: 'Nansen offers no payment option this app can sign for this call.' }))
      .catch((e: Error) => live && setStage({ k: 'off', reason: e.message }));
    return () => { live = false; };
  }, [endpoint, bodyKey]);

  async function connect(prev: X402Quote) {
    setStage({ k: 'connecting' });
    try {
      if (!window.ethereum) throw new Error('No Ethereum wallet found in this browser.');
      const [payer] = (await window.ethereum.request({ method: 'eth_requestAccounts' })) as string[];
      // Re-quote for this wallet: a first-calls discount shows up here.
      const quote = await postJson<X402Quote>('/api/x402/quote', { endpoint, body, payer });
      const option = quote.options[0];
      if (!option) throw new Error('Nansen offers no payment option this app can sign for this call.');
      setStage({ k: 'confirm', quote, payer, option });
    } catch (e) {
      setStage({ k: 'error', message: walletError(e), quote: prev });
    }
  }

  async function pay(quote: X402Quote, payer: string, option: Option) {
    if (option.priceUsd > X402_MAX_PRICE_USD) {
      setStage({ k: 'error', message: `Price ${formatPrice(option.priceUsd)} is above the ${formatPrice(X402_MAX_PRICE_USD)} per-call ceiling.`, quote });
      return;
    }
    setStage({ k: 'signing', option });
    try {
      const eth = window.ethereum!;
      await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: `0x${option.chainId.toString(16)}` }] });
      const auth = buildAuthorization(option.requirement, payer, Math.floor(Date.now() / 1000), randomNonce());
      const signature = (await eth.request({ method: 'eth_signTypedData_v4', params: [payer, JSON.stringify(typedDataFor(option.requirement, auth))] })) as string;
      const payment = encodeHeader(paymentPayload(quote.resource, option.requirement, auth, signature));
      const r = await postJson<{ data: unknown; priceUsd: number; network: string; settlement: { transaction?: string | null } | null }>(
        '/api/x402/call', { endpoint, body, payment },
      );
      setStage({ k: 'done', data: r.data, paid: { usd: r.priceUsd, network: r.network, tx: r.settlement?.transaction || null } });
    } catch (e) {
      setStage({ k: 'error', message: walletError(e), quote });
    }
  }

  const btn = 'rounded border border-border bg-surface-2 px-3 py-1.5 text-sm text-ink hover:border-ink-muted disabled:opacity-50';

  switch (stage.k) {
    case 'quoting':
      return <button className={btn} disabled>{action} · checking price…</button>;
    case 'off':
      return <p className="text-xs text-ink-muted">Pay-per-call unavailable: {stage.reason}</p>;
    case 'price': {
      const p = stage.quote.options[0].priceUsd;
      return (
        <div className="space-y-1">
          <button className={btn} onClick={() => connect(stage.quote)}>{action} · {formatPrice(p)}</button>
          <p className="text-xs text-ink-muted">Pay Nansen per call in USDC from your own wallet (x402). No key, no account. You confirm before anything is signed.</p>
        </div>
      );
    }
    case 'connecting':
      return <button className={btn} disabled>Connecting wallet…</button>;
    case 'confirm': {
      const { quote, payer, option } = stage;
      return (
        <div className="space-y-2 rounded border border-border p-3 text-sm">
          <p className="text-ink">
            Pay <strong>{formatPrice(option.priceUsd)} USDC on {option.network}</strong> from {short(payer)} to Nansen ({short(option.requirement.payTo)}) for one <code className="text-xs">{endpoint}</code> call?
          </p>
          <p className="text-xs text-ink-muted">
            Your wallet will ask you to sign a USDC transfer authorization for exactly this amount (no gas). It expires in {Math.round(option.requirement.maxTimeoutSeconds / 60)} minutes.
            {quote.options.length > 1 && ' Other networks: '}
            {quote.options.slice(1).map((o) => (
              <button key={o.network} className="ml-1 underline" onClick={() => setStage({ ...stage, option: o })}>{o.network} {formatPrice(o.priceUsd)}</button>
            ))}
            {quote.unsupported.length > 0 && ` Also accepted by Nansen but not offered here: ${quote.unsupported.join(', ')}.`}
          </p>
          <div className="flex gap-2">
            <button className={btn} onClick={() => pay(quote, payer, option)}>Sign and load</button>
            <button className="px-2 text-sm text-ink-2 hover:text-ink" onClick={() => setStage({ k: 'price', quote })}>Cancel</button>
          </div>
        </div>
      );
    }
    case 'signing':
      return <button className={btn} disabled>Waiting for your wallet ({formatPrice(stage.option.priceUsd)} on {stage.option.network})…</button>;
    case 'done':
      return (
        <div className="space-y-2">
          <p className="text-xs text-ink-muted">
            Paid {formatPrice(stage.paid.usd)} on {stage.paid.network}{stage.paid.tx ? ` · settlement ${short(stage.paid.tx)}` : ''}. This data was bought by you and is shown to you only.
          </p>
          {children(stage.data)}
        </div>
      );
    case 'error':
      return (
        <div className="space-y-1">
          <p className="text-sm text-ink-2">{stage.message}</p>
          {stage.quote && <button className={btn} onClick={() => setStage({ k: 'price', quote: stage.quote! })}>Back</button>}
        </div>
      );
  }
}
