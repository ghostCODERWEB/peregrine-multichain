// The ⌘K omnibox: one box that takes a token name or symbol, an entity, a
// chain, a sector, or an address of any family Nansen knows, and returns
// the pages it can open. Text goes to Nansen's search/general (free);
// addresses are recognized locally (src/lib/address-family.ts) and also
// looked up, since a contract address resolves to its token.
import { ensAddress, ensName, ENS_NAME_RE } from '@/server/ens';
import { callNansen } from '@/server/nansen/client';
import { errText } from '@/server/nansen/traced';
import { detectAddress, FAMILY_NAMES } from '@/lib/address-family';
import { ALL_CHAIN_IDS, chainCapability } from '@/lib/registry';
import { chainName, shortAddress, usd } from '@/lib/viz/format';
import { sectorList } from '@/server/sectors/membership';
import type { GeneralSearchResponse } from '@/types/nansen/api.gen';

export type ResultKind = 'token' | 'wallet' | 'entity' | 'chain' | 'sector' | 'note';

export interface SearchResult {
  kind: ResultKind;
  title: string;
  subtitle: string;
  /** null for a note that explains why an input opens nothing. */
  href: string | null;
  /** For the row's logo: the chain, and the token's symbol. */
  chain?: string;
  symbol?: string;
}

export interface SearchResponse {
  query: string;
  /** Address families the input matched, e.g. ["EVM"]. */
  families: string[];
  results: SearchResult[];
  /** Set when Nansen's search failed; local matches are still returned. */
  error: string | null;
}

const MAX_QUERY = 200;

/** Tokens TIDE has a page for: Hyperliquid perps are markets, not tokens
 *  with a contract, and get their own pages in the perps module. */
const tokenPageChain = (chain: string) => chain !== 'hyperliquid' && ALL_CHAIN_IDS.includes(chain);

function norm(s: string) {
  return s.toLowerCase().replace(/[\s_-]+/g, ' ').trim();
}

export function matchChains(q: string): SearchResult[] {
  const n = norm(q);
  if (n.length < 2) return [];
  return ALL_CHAIN_IDS
    .map((id) => ({ id, name: chainName(id) }))
    .filter(({ id, name }) => norm(id) === n || norm(name) === n || (n.length >= 3 && (norm(name).startsWith(n) || norm(id).startsWith(n))))
    .sort((a, b) => Number(norm(b.name) === n || b.id === n) - Number(norm(a.name) === n || a.id === n))
    .slice(0, 3)
    .map(({ id, name }) => ({ kind: 'chain', chain: id, title: name, subtitle: `Chain · Tier ${chainCapability(id)?.tier ?? 'C'} · Flow Index, top flows, peers`, href: `/chain/${id}` }));
}

export function matchSectors(q: string, sectors: string[]): SearchResult[] {
  const n = norm(q);
  if (n.length < 2) return [];
  return sectors
    .filter((s) => norm(s) === n || (n.length >= 3 && norm(s).includes(n)))
    .sort((a, b) => Number(norm(b).startsWith(n)) - Number(norm(a).startsWith(n)) || a.length - b.length)
    .slice(0, 3)
    .map((s) => ({ kind: 'sector', title: s, subtitle: 'Sector · where its flows are heading', href: `/sectors#${encodeURIComponent(s)}` }));
}

export function tokenResults(r: GeneralSearchResponse | null): SearchResult[] {
  return (r?.tokens ?? [])
    .filter((t) => tokenPageChain(t.chain))
    .sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9))
    .map((t) => ({
      kind: 'token' as const,
      chain: t.chain,
      symbol: t.symbol,
      title: `${t.symbol} · ${t.name}`,
      subtitle: `Token on ${chainName(t.chain)}${t.market_cap ? ` · mcap ${usd(t.market_cap)}` : ''}`,
      href: `/token/${t.chain}/${t.address}`,
    }));
}

export function entityResults(r: GeneralSearchResponse | null): SearchResult[] {
  return (r?.entities ?? []).map((e) => ({
    kind: 'entity' as const,
    title: e.name,
    subtitle: `Entity${e.tags?.length ? ` · ${e.tags.slice(0, 3).join(', ')}` : ''}`,
    href: `/entity/${encodeURIComponent(e.name)}`,
  }));
}

/** Wallet links for an address, or a note when no family it matches is one
 *  Nansen's profiler serves. */
export function addressResults(q: string): SearchResult[] {
  const fams = detectAddress(q);
  if (!fams.length) return [];
  const wallets = fams.filter((f) => f.profiled && !f.tokenOnly);
  if (wallets.length) {
    const names = [...new Set(wallets.map((f) => FAMILY_NAMES[f.family]))].join(' or ');
    return [{ kind: 'wallet', title: `Wallet ${shortAddress(q)}`, subtitle: `${names} address · balances, PnL, counterparties across every chain`, href: `/wallet/${encodeURIComponent(q)}` }];
  }
  if (fams.every((f) => f.tokenOnly)) return [];
  const names = [...new Set(fams.map((f) => FAMILY_NAMES[f.family]))].join(' / ');
  return [{ kind: 'note', title: `${names} address`, subtitle: `Nansen's API does not profile ${names} addresses, so there is no page for it.`, href: null }];
}

export async function omnibox(raw: string): Promise<SearchResponse> {
  const query = raw.trim().slice(0, MAX_QUERY);
  const families = [...new Set(detectAddress(query).map((f) => FAMILY_NAMES[f.family]))];
  if (!query) return { query, families, results: [], error: null };
  // An ENS name opens the wallet it points to.
  if (ENS_NAME_RE.test(query)) {
    const addr = await ensAddress(query).catch(() => null);
    return {
      query, families: ['Ethereum name'], error: null,
      results: addr
        ? [{ kind: 'wallet', title: query.toLowerCase(), subtitle: `${shortAddress(addr)} · ENS name · balances, PnL, counterparties across every chain`, href: `/wallet/${addr}` }]
        : [{ kind: 'note', title: query.toLowerCase(), subtitle: 'This ENS name does not point to an address.', href: null }],
    };
  }

  const isAddress = families.length > 0;
  const [search, sectors] = await Promise.all([
    callNansen<GeneralSearchResponse>('search/general', { search_query: query, result_type: isAddress ? 'token' : 'any', limit: 8 })
      .then((r) => ({ found: r.data, error: null }), (e: unknown) => ({ found: null, error: errText(e) })),
    isAddress ? Promise.resolve([] as string[]) : sectorList().catch(() => [] as string[]),
  ]);
  const found = search.found;

  // An EVM address shows its ENS name when it has one.
  const ens = /^0x[0-9a-fA-F]{40}$/.test(query) ? await Promise.race([ensName(query), new Promise<null>((r) => setTimeout(() => r(null), 2000))]) : null;
  const results: SearchResult[] = isAddress
    ? [...tokenResults(found), ...addressResults(query).map((r) => (ens && r.kind === 'wallet' ? { ...r, title: `${ens} · ${shortAddress(query)}` } : r))]
    : [...matchChains(query), ...tokenResults(found), ...entityResults(found), ...matchSectors(query, sectors)];

  return { query, families, results: results.slice(0, 12), error: search.error };
}
