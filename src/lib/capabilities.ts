// Capability-tier classification (section 3) — pure logic, shared by
// scripts/build-capabilities.ts (which writes the registry file) and any
// runtime code that needs to re-derive or reason about a tier directly
// rather than just reading the pre-built JSON.
import { CHAIN_ENUMS } from '@/types/nansen/chain-enums';
import type { Tier } from '@/config/capability-types';

/**
 * Some endpoints' chain enums include the literal string "all" — a
 * REQUEST-TIME wildcard meaning "every chain this endpoint itself
 * supports" (per its own docs: "Use 'all' to include all available
 * chains"), not a signal that the endpoint accepts any chain in the
 * universe. Filtered out before membership is checked — including it
 * un-filtered was a real bug caught while building this: it silently
 * marked chains like sui, near and bitcoin as Smart Money-supported when
 * they don't appear in that endpoint's enum at all.
 */
export function endpointSupports(enumKey: keyof typeof CHAIN_ENUMS, chain: string): boolean {
  const list = (CHAIN_ENUMS[enumKey] as readonly string[]).filter((c) => c !== 'all');
  return list.includes(chain);
}

export interface ChainClassification {
  tier: Tier;
  smartMoney: boolean;
  tokenGodMode: boolean;
  profiler: boolean;
  screener: boolean;
  perp: boolean;
}

/**
 * Tier from the documented enums alone (no live probing here — that's
 * probe.ts's job, for the chains this can't resolve). A chain counts as
 * supporting a data family if ANY one of that family's load-bearing
 * endpoints documents it — TIDE only needs one working endpoint per family
 * to build something real, not every endpoint in the family.
 */
export function classifyChain(chain: string): ChainClassification {
  const smartMoney = endpointSupports('smartMoneyNetflows', chain) || endpointSupports('smartMoneyDexTrades', chain);
  const tokenGodMode = endpointSupports('tgmHolders', chain)
    || endpointSupports('tgmFlowIntelligence', chain)
    || endpointSupports('tgmDexTrades', chain);
  const profiler = endpointSupports('profilerCurrentBalance', chain) || endpointSupports('profilerTransactions', chain);
  const screener = endpointSupports('tokenScreener', chain);
  const perp = chain === 'hyperliquid';

  let tier: Tier;
  if (perp) tier = 'perp';
  else if (smartMoney && tokenGodMode && profiler) tier = 'A';
  else if (tokenGodMode && profiler) tier = 'B';
  else tier = 'C';

  return { tier, smartMoney, tokenGodMode, profiler, screener, perp };
}
