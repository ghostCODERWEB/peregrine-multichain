'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));

async function post(path: string, body?: unknown, method = 'POST') {
  const r = await fetch(path, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((d as { error?: string }).error ?? `Request failed (${r.status})`);
  return d;
}

/**
 * Sign in with a wallet (a free signature, no transaction), then add your
 * own Nansen API key. The key goes to the server once, is checked with
 * Nansen, and is stored encrypted; it never comes back to the browser.
 */
export function AccountPanel({ user, keyInfo, vault, mode }: {
  user: { family: string; address: string } | null;
  keyInfo: { last4: string; plan: string | null } | null;
  vault: boolean;
  mode: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');

  async function run(fn: () => Promise<void>) {
    setBusy(true); setMsg(null);
    try { await fn(); router.refresh(); } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  }

  const signInEvm = () => run(async () => {
    if (!window.ethereum) throw new Error('No Ethereum wallet found in this browser.');
    const [address] = (await window.ethereum.request({ method: 'eth_requestAccounts' })) as string[];
    const { message } = (await post('/api/auth/challenge', { family: 'evm', address })) as { message: string };
    const signature = (await window.ethereum.request({ method: 'personal_sign', params: [message, address] })) as string;
    await post('/api/auth/verify', { family: 'evm', message, signature });
  });

  const signInSol = () => run(async () => {
    const sol = window.phantom?.solana ?? window.solana;
    if (!sol) throw new Error('No Solana wallet (e.g. Phantom) found in this browser.');
    const { publicKey } = await sol.connect();
    const address = publicKey.toString();
    const { message } = (await post('/api/auth/challenge', { family: 'solana', address })) as { message: string };
    const { signature } = await sol.signMessage(new TextEncoder().encode(message), 'utf8');
    await post('/api/auth/verify', { family: 'solana', message, signature: b64(signature) });
  });

  if (!user) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-ink-2">Sign in with a wallet. It is a free signature that proves you control the address; nothing is sent onchain.</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={signInEvm} disabled={busy} className="rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-page disabled:opacity-50">Ethereum wallet</button>
          <button onClick={signInSol} disabled={busy} className="rounded-md border border-border px-3 py-1.5 text-sm text-ink hover:bg-accent disabled:opacity-50">Solana wallet</button>
        </div>
        {msg && <p className="text-sm text-ink-2">{msg}</p>}
      </div>
    );
  }
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-2">Signed in as <span className="num text-ink">{user.address}</span> ({user.family === 'evm' ? 'Ethereum' : 'Solana'}).</p>
        <button onClick={() => run(async () => { await post('/api/auth/logout'); })} disabled={busy} className="text-sm text-ink-2 underline-offset-2 hover:text-ink hover:underline">Sign out</button>
      </div>
      <section className="space-y-2">
        <h2 className="text-[15px] font-semibold text-ink">Your Nansen API key</h2>
        {keyInfo ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
            <span className="text-ink-2">Key <span className="num text-ink">…{keyInfo.last4}</span>{keyInfo.plan ? ` · ${keyInfo.plan} plan` : ''} · your calls use it and you see what it returns (view: {mode}).</span>
            <button onClick={() => run(async () => { await post('/api/keys', undefined, 'DELETE'); })} disabled={busy} className="text-ink-2 underline-offset-2 hover:text-ink hover:underline">Remove key</button>
          </div>
        ) : vault ? (
          <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); void run(async () => { await post('/api/keys', { apiKey }); setApiKey(''); }); }}>
            <input type="password" autoComplete="off" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Paste your key from app.nansen.ai"
              className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-ink placeholder:text-ink-muted" aria-label="Nansen API key" />
            <button disabled={busy || !apiKey} className="rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-page disabled:opacity-50">Check and save</button>
          </form>
        ) : (
          <p className="text-sm text-ink-2">This TIDE instance has no TIDE_KMS_KEY set, so it cannot store API keys safely.</p>
        )}
        <p className="text-[12px] text-ink-muted">
          The key is checked with Nansen (free), stored encrypted on this server, and never sent back to your browser. With it, every Nansen call you trigger
          uses your credits and what it returns is yours to see — including smart-money data and labels, which Nansen allows only for the key owner.
        </p>
        {msg && <p className="text-sm text-ink-2">{msg}</p>}
      </section>
    </div>
  );
}
