// The capability registry's shape, section 3. Nothing in the UI decides
// "can chain X show panel Y" by checking a hardcoded chain list — every
// such decision reads this registry instead, built once (build-capabilities)
// from the documented per-endpoint chain enums, then corrected by live
// probing (probe.ts) for the chains the docs don't clearly cover.

/**
 * A: Smart Money + TGM + Profiler all present — the full weather-map
 *    experience (pressure, rotation fronts, wind rose, insider graph).
 * B: TGM + Profiler present but no Smart Money — no chain-pressure input
 *    and no rotation-front participation, but token/wallet pages work.
 * C: Search / chain-rank / profiler basics only — a token can be found and
 *    named, but most of TIDE's real analysis has nothing to read.
 * perp: Hyperliquid-only flag, independent of the A/B/C tier (Hyperliquid
 *    isn't a normal token chain — it's scored purely on its perp surface).
 */
export type Tier = 'A' | 'B' | 'C' | 'perp';

export type ProbeStatus = 'ok' | 'empty' | 'error' | 'unprobed';

export interface ChainCapability {
  chain: string;
  tier: Tier;
  smartMoney: boolean;
  tokenGodMode: boolean;
  profiler: boolean;
  screener: boolean;
  /** chain-rank has no per-chain request — this is whether the chain
   *  actually appears in the one chain-rank response, not a support flag
   *  looked up from an enum. */
  chainRank: boolean;
  perp: boolean;
  /** Present only for chains the documented enums didn't clearly cover —
   *  see UNDOCUMENTED_CHAINS. Live probe.ts results, one entry per
   *  endpoint family actually probed. */
  probes?: Record<string, ProbeStatus>;
  /** True when this chain's tier came from a live probe rather than being
   *  read off a documented enum — the UI shows this differently ("probed
   *  live, not documented" vs "documented by Nansen"). */
  inferredFromProbe: boolean;
}

export interface CapabilityRegistry {
  generatedAt: string;
  /** Which build produced this: 'docs' (build-capabilities.ts only) or
   *  'docs+probe' (probe.ts has also run and merged in live results). */
  source: 'docs' | 'docs+probe';
  chains: Record<string, ChainCapability>;
}
