// Typed read access to the capability registry. Every "can chain X do Y"
// question in the app goes through here rather than a hardcoded list.
import raw from '@/config/capabilities.json';
import type { CapabilityRegistry, ChainCapability } from '@/config/capability-types';
import { ALL_SUPPORTED_CHAINS, CHAIN_ENUMS, type ChainEnumKey } from '@/types/nansen/chain-enums';
import { chainName } from '@/lib/viz/format';

export const registry = raw as CapabilityRegistry;

export const ALL_CHAIN_IDS: readonly string[] = [...ALL_SUPPORTED_CHAINS.evm, ...ALL_SUPPORTED_CHAINS.nonEvm];

export function chainCapability(chain: string): ChainCapability | null {
  return registry.chains[chain] ?? null;
}

export function chainsInTier(...tiers: ChainCapability['tier'][]): string[] {
  return Object.values(registry.chains).filter((c) => tiers.includes(c.tier)).map((c) => c.chain);
}

/**
 * What a chain's Chain Pressure Index measures, or null if it can't have
 * one.
 *
 * 'smart-money': Tier A. Net flow from token-screener filtered to
 *   trader_type=sm, divided by the same screener's all-trader volume.
 * 'market-flow': screener-covered chains without Smart Money. Checked
 *   live: trader_type=sm AND trader_type=whale both return zero rows on
 *   every Tier B chain — Nansen has no trader labels there at all — so the
 *   only real flow signal is the screener's all-trader netflow. Shown with
 *   that label and lower confidence, never presented as smart money.
 *
 * Why not smart-money/netflow for Tier A, as first designed: it returns
 * 3,000+ token rows across Tier A chains (Robinhood's tokenized stocks and
 * Solana alone are ~2,000), in an order that isn't by magnitude, so any
 * page cap dropped whole chains (bnb, monad, optimism got zero rows in the
 * first 3,000). The screener orders by volume, so a cap drops the smallest
 * tokens instead, and it shares the volume denominator's endpoint and
 * filters, so every chain's ratio divides like by like. smart-money/netflow
 * is used per chain instead, where it's the right tool: the chain page's
 * top inflow/outflow tokens and sector breakdown.
 */
export type PressureSource = 'smart-money' | 'market-flow';

export function pressureSource(chain: string): PressureSource | null {
  const c = chainCapability(chain);
  if (!c) return null;
  if (c.tier === 'A') return 'smart-money';
  if (c.screener) return 'market-flow';
  return null;
}

export const pressureChains = (): string[] => ALL_CHAIN_IDS.filter((c) => pressureSource(c) !== null);

/** Human-readable reason a chain can't show a module, for the "Not
 *  available on {chain} in Nansen API" state — never a silent blank. */
export function unavailableReason(chain: string, module: 'pressure' | 'smartMoney' | 'tokenGodMode' | 'profiler' | 'perp'): string | null {
  const c = chainCapability(chain);
  if (!c) return `${chain} is not a chain the Nansen API lists.`;
  const ok = {
    pressure: pressureSource(chain) !== null,
    smartMoney: c.smartMoney,
    tokenGodMode: c.tokenGodMode,
    profiler: c.profiler,
    perp: c.perp,
  }[module];
  if (ok) return null;
  const how = c.inferredFromProbe ? 'checked live' : 'per Nansen’s docs';
  return `Not available on ${chainName(chain)} in Nansen API (${how}).`;
}

/** Whether one specific endpoint accepts this chain, read from that
 *  endpoint's documented chain enum. Finer than the tier: token-ohlcv
 *  covers 33 chains while tgm/holders covers 26, so a Tier C token still
 *  gets candles. */
export function endpointSupports(endpoint: ChainEnumKey, chain: string): boolean {
  const e = CHAIN_ENUMS[endpoint] as readonly string[];
  return e.includes(chain) || e.includes('all');
}

export function endpointUnavailable(endpoint: ChainEnumKey, chain: string, what: string): string | null {
  return endpointSupports(endpoint, chain) ? null : `${what}: not available on ${chainName(chain)} in Nansen API.`;
}
