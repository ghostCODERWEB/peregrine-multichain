// The key owner's live credit balance and plan, from GET /api/v1/account
// (0 credits). Cached for a minute; falls back to the last
// X-Nansen-Credits-Remaining header any process saw (kv) when the call
// fails or in DEMO_MODE.
import { callNansen } from './client';
import { fixtureMode } from './demo';
import { getKv, setKv } from './db';

export interface AccountStatus { plan: string | null; creditsRemaining: number | null; source: 'account' | 'header' | 'none'; at: number | null }

// Memoized per key: a member's balance is theirs, the owner's is the instance's.
const memo = new Map<string, { at: number; v: AccountStatus }>();

export async function accountStatus(keyId = 'instance'): Promise<AccountStatus> {
  const hit = memo.get(keyId);
  if (hit && Date.now() - hit.at < 60_000) return hit.v;
  let v: AccountStatus = { plan: null, creditsRemaining: null, source: 'none', at: null };
  if (fixtureMode() !== 'replay') {
    try {
      const r = await callNansen<{ plan?: string; credits_remaining?: number }>('account', {}, { method: 'GET', skipCache: true, record: false });
      if (typeof r.data.credits_remaining === 'number') {
        v = { plan: r.data.plan ?? null, creditsRemaining: r.data.credits_remaining, source: 'account', at: Date.now() };
        if (keyId === 'instance') {
          setKv('credits_remaining', String(r.data.credits_remaining));
          if (r.data.plan) setKv('plan', r.data.plan);
        }
      }
    } catch { /* fall back below */ }
  }
  if (v.source === 'none' && keyId === 'instance') {
    const kv = getKv('credits_remaining');
    if (kv) v = { plan: getKv('plan')?.value ?? null, creditsRemaining: Number(kv.value), source: 'header', at: kv.updatedAt };
  }
  memo.set(keyId, { at: Date.now(), v });
  return v;
}
