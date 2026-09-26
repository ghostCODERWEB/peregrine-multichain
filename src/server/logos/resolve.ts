// Token logo lookup from free, keyless public sources, for tokens Nansen
// returned no logo for. Images only (no market data): DexScreener's token
// API, then Jupiter's token list for Solana mints. Perp coins use Hyperliquid's
// public coin icons. Results (and misses) are cached in kv, so each token is
// looked up at most once a week.
import { getKv, setKv } from '@/server/nansen/db';

const HIT_TTL = 7 * 86_400_000, MISS_TTL = 86_400_000;
const DS_CHAIN: Record<string, string> = { bnb: 'bsc', avalanche: 'avalanche', hyperevm: 'hyperevm', zksync: 'zksync' };
const inflight = new Map<string, Promise<string | null>>();

export const ADDRESS_RE = /^(0x[0-9a-fA-F]{40}|[1-9A-HJ-NP-Za-km-z]{32,44}|[0-9a-zA-Z:_-]{3,90})$/;
export const COIN_RE = /^[A-Za-z0-9:]{1,24}$/;

export const perpIcon = (coin: string) => `https://app.hyperliquid.xyz/coins/${encodeURIComponent(coin)}.svg`;

async function json(url: string): Promise<unknown> {
  const r = await fetch(url, { signal: AbortSignal.timeout(6000), headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

async function dexscreener(chain: string, address: string): Promise<string | null> {
  const pairs = (await json(`https://api.dexscreener.com/tokens/v1/${DS_CHAIN[chain] ?? chain}/${address}`)) as Array<{ baseToken?: { address?: string }; info?: { imageUrl?: string } }>;
  if (!Array.isArray(pairs)) return null;
  const own = pairs.find((p) => p.baseToken?.address?.toLowerCase() === address.toLowerCase() && p.info?.imageUrl);
  return own?.info?.imageUrl ?? null;
}

async function jupiter(address: string): Promise<string | null> {
  const list = (await json(`https://lite-api.jup.ag/tokens/v2/search?query=${address}`)) as Array<{ id?: string; icon?: string }>;
  return Array.isArray(list) ? list.find((t) => t.id === address && t.icon?.startsWith('https://'))?.icon ?? null : null;
}

/** An https image URL for the token, or null when no free source has one. */
export async function tokenLogo(chain: string, address: string): Promise<string | null> {
  const key = `logo:${chain}:${chain === 'solana' ? address : address.toLowerCase()}`;
  const hit = getKv(key);
  if (hit && Date.now() - hit.updatedAt < (hit.value ? HIT_TTL : MISS_TTL)) return hit.value || null;
  const running = inflight.get(key);
  if (running) return running;
  const job = (async () => {
    let url: string | null = null;
    for (const f of [() => dexscreener(chain, address), ...(chain === 'solana' ? [() => jupiter(address)] : [])]) {
      url = await f().catch(() => null);
      if (url) break;
    }
    if (url && !url.startsWith('https://')) url = null;
    setKv(key, url ?? '');
    return url;
  })().finally(() => inflight.delete(key));
  inflight.set(key, job);
  return job;
}

/** A URL that answers 200 with an image, checked once and cached in kv like token logos. */
async function imageOk(url: string, key: string): Promise<string | null> {
  const hit = getKv(key);
  if (hit && Date.now() - hit.updatedAt < (hit.value ? HIT_TTL : MISS_TTL)) return hit.value || null;
  let good: string | null = null;
  try { const r = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) }); if (r.ok && (r.headers.get('content-type') ?? '').startsWith('image/')) good = url; } catch { /* treat as a miss */ }
  setKv(key, good ?? '');
  return good;
}

/** Perp coins: CoinCap's icon by symbol (bright on dark), then Hyperliquid's own. */
export async function coinLogo(coin: string): Promise<string> {
  const sym = coin.replace(/^[a-z]+:/, '').replace(/^k(?=[A-Z])/, '').toLowerCase();
  return (await imageOk(`https://assets.coincap.io/assets/icons/${encodeURIComponent(sym)}@2x.png`, `logo:coincap:${sym}`)) ?? perpIcon(coin);
}

/** Tokenized stocks on Robinhood chain: the company logo by ticker. */
export async function stockLogo(symbol: string): Promise<string | null> {
  const t = symbol.toUpperCase().replace(/[^A-Z.]/g, '');
  return t ? imageOk(`https://financialmodelingprep.com/image-stock/${encodeURIComponent(t)}.png`, `logo:stock:${t}`) : null;
}
