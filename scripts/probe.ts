// Live-verifies what the documented enums can't answer: the 11 chains
// where every documented endpoint enum is silent (Tier C by default), plus
// which chains actually appear in chain-rank's one undifferentiated
// response (it has no per-chain request parameter at all, so "does chain-
// rank cover chain X" can only be answered by calling it and looking).
//
// Cheap by design: search/general is free, and each Tier C chain gets at
// most one 1-credit token-screener call — under 15 credits total for the
// whole probe, run once and cached into the registry rather than repeated.
import fs from 'node:fs';
import path from 'node:path';
import { config } from 'dotenv';
config({ path: '.env.local' });

import { callNansen } from '../src/server/nansen/client';
import type { CapabilityRegistry, ProbeStatus } from '../src/config/capability-types';

const REGISTRY_PATH = path.resolve(process.cwd(), 'src/config/capabilities.json');

function loadRegistry(): CapabilityRegistry {
  return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
}

function saveRegistry(registry: CapabilityRegistry) {
  registry.source = 'docs+probe';
  registry.generatedAt = new Date().toISOString();
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2) + '\n');
}

async function probeChainRank(registry: CapabilityRegistry) {
  console.log('Probing chain-rank (1 credit, single call for every chain)...');
  try {
    const r = await callNansen<{ data?: Array<{ chain?: string }> }>(
      'chains/chain-rank',
      { time_frame: 7, chain_type: 'all' },
    );
    const rows = r.data.data ?? [];
    const seen = new Set(rows.map((row) => row.chain).filter((c): c is string => !!c));
    for (const chain of Object.keys(registry.chains)) {
      registry.chains[chain].chainRank = seen.has(chain);
    }
    console.log(`  chain-rank covers ${seen.size} chains.`);
  } catch (e) {
    console.error('  chain-rank probe failed:', (e as Error).message);
  }
}

/** A search query likely to surface something real if the chain has ANY
 *  tokens Nansen has indexed — "usdc" because some form of it exists on
 *  nearly every chain with real activity. */
async function probeSearch(chain: string): Promise<ProbeStatus> {
  try {
    const r = await callNansen<{ tokens?: unknown[]; total_results?: number }>(
      'search/general',
      { search_query: 'usdc', chain, result_type: 'token', limit: 5 },
    );
    return (r.data.total_results ?? 0) > 0 ? 'ok' : 'empty';
  } catch {
    return 'error';
  }
}

async function probeScreener(chain: string): Promise<ProbeStatus> {
  try {
    const r = await callNansen<{ data?: unknown[] }>(
      'token-screener',
      { chains: [chain], timeframe: '24h', pagination: { page: 1, per_page: 5 } },
    );
    return (r.data.data?.length ?? 0) > 0 ? 'ok' : 'empty';
  } catch {
    return 'error';
  }
}

async function probeUndocumentedChains(registry: CapabilityRegistry) {
  const targets = Object.values(registry.chains).filter((c) => c.tier === 'C');
  console.log(`Probing ${targets.length} Tier C (undocumented) chains live: search (free) + token-screener (1 credit each)...`);

  for (const capability of targets) {
    const [search, screener] = await Promise.all([
      probeSearch(capability.chain),
      probeScreener(capability.chain),
    ]);
    capability.probes = { search, tokenScreener: screener };

    // A chain that answers with real data on EITHER probe deserves Tier C
    // (search + screener basics genuinely work), not silence — but this
    // never promotes a chain to A/B, since those need the enums this
    // script can't check live cheaply (Smart Money, TGM holders/flows).
    // The registry marks the promotion as probe-derived either way, so the
    // UI can say "confirmed live" versus "documented by Nansen".
    const anyOk = search === 'ok' || screener === 'ok';
    capability.inferredFromProbe = true;
    if (anyOk) capability.screener = capability.screener || screener === 'ok';

    console.log(`  ${capability.chain}: search=${search} screener=${screener}`);
  }
}

async function main() {
  const registry = loadRegistry();
  await probeChainRank(registry);
  await probeUndocumentedChains(registry);
  saveRegistry(registry);

  const promoted = Object.values(registry.chains).filter((c) => c.tier === 'C' && c.screener);
  console.log(`\nDone. ${promoted.length} Tier C chain(s) confirmed live via search or screener: ${promoted.map((c) => c.chain).join(', ') || 'none'}.`);
  console.log('Registry updated:', REGISTRY_PATH);
}

main().catch((e) => { console.error(e); process.exit(1); });
