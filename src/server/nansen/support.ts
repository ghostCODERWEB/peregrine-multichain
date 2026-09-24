// Chain support straight from the generated contract (Nansen's published
// OpenAPI enums, src/types/nansen/api.gen.ts), for endpoints the older
// hand-kept registry (chain-enums.ts) does not list.
import { ENDPOINTS, type EndpointKey } from '@/types/nansen/api.gen';
import { chainName } from '@/lib/viz/format';

export function contractSupports(key: EndpointKey, chain: string): boolean {
  const chains: readonly string[] | null = ENDPOINTS[key].chains;
  return !chains || chains.includes(chain);
}

/** The plain "not available" sentence, or null when the chain is served. */
export function contractUnavailable(key: EndpointKey, chain: string, what: string): string | null {
  return contractSupports(key, chain) ? null : `${what}: not available on ${chainName(chain)} in Nansen API.`;
}
