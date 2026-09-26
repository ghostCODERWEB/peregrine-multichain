// ENS: primary names for EVM addresses and addresses for .eth names, read from Ethereum mainnet
// through free public RPCs (no key). Answers are cached in the kv table: names for a day,
// "no name" for thirty minutes, so a page full of wallets costs one lookup per address per day.
import { createPublicClient, fallback, http, isAddress, getAddress } from 'viem';
import { mainnet } from 'viem/chains';
import { normalize } from 'viem/ens';
import { getKv, setKv } from '@/server/nansen/db';

const client = createPublicClient({
  chain: mainnet,
  transport: fallback([
    // Only endpoints verified to run ENS's universal resolver; others silently answer "no name".
    http('https://ethereum-rpc.publicnode.com', { timeout: 6_000 }),
    http('https://1rpc.io/eth', { timeout: 6_000 }),
    http('https://eth.merkle.io', { timeout: 6_000 }),
  ]),
  batch: { multicall: true },
});

const DAY = 86_400_000, NEG = 30 * 60_000;
export const ENS_NAME_RE = /^[a-z0-9-]+(\.[a-z0-9-]+)*\.eth$/i;
const inflight = new Map<string, Promise<string | null>>();

/** The address's primary ENS name (reverse record, forward-verified by viem), or null. */
export async function ensName(address: string): Promise<string | null> {
  if (!isAddress(address)) return null;
  const key = `ens2:name:${address.toLowerCase()}`;
  const hit = getKv(key);
  if (hit && Date.now() - hit.updatedAt < (hit.value ? DAY : NEG)) return hit.value || null;
  const running = inflight.get(key);
  if (running) return running;
  const p = client.getEnsName({ address: getAddress(address) })
    .then((name) => { setKv(key, name ?? ''); return name ?? null; })
    .catch(() => (hit ? hit.value || null : null))
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

/** Many addresses at once (viem batches them into multicalls). */
export async function ensNames(addresses: string[]): Promise<Record<string, string | null>> {
  const uniq = [...new Set(addresses.filter((a) => isAddress(a)).map((a) => a.toLowerCase()))].slice(0, 60);
  const out = await Promise.all(uniq.map(async (a) => [a, await ensName(a)] as const));
  return Object.fromEntries(out);
}

/** A .eth name's address, or null. */
export async function ensAddress(name: string): Promise<string | null> {
  if (!ENS_NAME_RE.test(name)) return null;
  let norm: string;
  try { norm = normalize(name); } catch { return null; }
  const key = `ens2:addr:${norm}`;
  const hit = getKv(key);
  if (hit && Date.now() - hit.updatedAt < (hit.value ? DAY : NEG)) return hit.value || null;
  try {
    const a = await client.getEnsAddress({ name: norm });
    setKv(key, a ?? '');
    if (a) setKv(`ens2:name:${a.toLowerCase()}`, norm);
    return a ?? null;
  } catch {
    return hit ? hit.value || null : null;
  }
}
