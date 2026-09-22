// Builds src/config/capabilities.json from the documented per-endpoint chain
// enums — the "read the docs" half of the capability registry. probe.ts
// runs after this and merges in live-checked results for the chains the
// docs don't clearly cover, upgrading inferredFromProbe entries and
// correcting any doc/reality mismatch. Classification logic itself lives
// in src/lib/capabilities.ts (tested, and reusable at runtime) — this file
// is just the CLI that writes the JSON.
import fs from 'node:fs';
import path from 'node:path';
import { ALL_SUPPORTED_CHAINS } from '../src/types/nansen/chain-enums';
import { classifyChain } from '../src/lib/capabilities';
import type { ChainCapability, CapabilityRegistry } from '../src/config/capability-types';

const ALL_CHAINS = [...ALL_SUPPORTED_CHAINS.evm, ...ALL_SUPPORTED_CHAINS.nonEvm];

function build(): CapabilityRegistry {
  const chains: Record<string, ChainCapability> = {};
  for (const chain of ALL_CHAINS) {
    const c = classifyChain(chain);
    chains[chain] = {
      chain, tier: c.tier,
      smartMoney: c.smartMoney, tokenGodMode: c.tokenGodMode, profiler: c.profiler, screener: c.screener,
      perp: c.perp,
      chainRank: false, // chain-rank has no per-chain enum — filled in by a live call, not this script
      inferredFromProbe: false,
    };
  }
  return { generatedAt: new Date().toISOString(), source: 'docs', chains };
}

function main() {
  const registry = build();
  const outPath = path.resolve(process.cwd(), 'src/config/capabilities.json');
  fs.writeFileSync(outPath, JSON.stringify(registry, null, 2) + '\n');

  const byTier = { A: 0, B: 0, C: 0, perp: 0 };
  for (const c of Object.values(registry.chains)) byTier[c.tier]++;
  console.log(`Wrote ${outPath}`);
  console.log(`Tiers: A=${byTier.A} B=${byTier.B} C=${byTier.C} perp=${byTier.perp} (${Object.keys(registry.chains).length} chains total)`);
  console.log('Tier C chains (docs give them nothing beyond basics — probe.ts will check live):');
  for (const c of Object.values(registry.chains)) {
    if (c.tier === 'C') console.log(`  - ${c.chain}`);
  }
}

main();
