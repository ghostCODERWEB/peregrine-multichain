// /coverage: the whole Nansen API surface TIDE uses, chain by chain, and
// what this instance has actually called. Support comes from each
// endpoint's documented chain enum, overridden by live probes where the
// docs were silent; the counters come from the credit ledger.
import { getDb, getKv } from '@/server/nansen/db';
import { ledgerSummary } from '@/server/nansen/ledger';
import { lastKnownCreditsRemaining } from '@/server/nansen/client';
import { registry, ALL_CHAIN_IDS } from '@/lib/registry';
import { CHAIN_ENUMS, type ChainEnumKey } from '@/types/nansen/chain-enums';
import type { Tier } from '@/config/capability-types';

export const ENDPOINT_GROUPS: Array<{ group: string; endpoints: Array<{ key: ChainEnumKey; path: string; label: string; usedFor: string }> }> = [
  { group: 'Smart Money', endpoints: [
    { key: 'smartMoneyNetflows', path: 'smart-money/netflow', label: 'netflow', usedFor: 'chain page token flows, sectors' },
    { key: 'smartMoneyDexTrades', path: 'smart-money/dex-trades', label: 'dex-trades', usedFor: 'rotation fronts, trade tape, migration trails' },
    { key: 'smartMoneyHoldings', path: 'smart-money/holdings', label: 'holdings', usedFor: '—' },
  ] },
  { group: 'Token God Mode', endpoints: [
    { key: 'tokenScreener', path: 'token-screener', label: 'screener', usedFor: 'Chain Pressure Index, storm sweep, 7-day odds' },
    { key: 'tgmTokenInformation', path: 'tgm/token-information', label: 'token info', usedFor: 'token header, exit liquidity' },
    { key: 'tgmIndicators', path: 'tgm/indicators', label: 'indicators', usedFor: 'Nansen risk input, radar' },
    { key: 'tgmTokenOhlcv', path: 'tgm/token-ohlcv', label: 'ohlcv', usedFor: 'candles, volatility cone, backtest labels' },
    { key: 'tgmFlowIntelligence', path: 'tgm/flow-intelligence', label: 'flow intel', usedFor: 'wind rose, wind shear' },
    { key: 'tgmFlows', path: 'tgm/flows', label: 'flows', usedFor: 'segment flow bars' },
    { key: 'tgmHolders', path: 'tgm/holders', label: 'holders', usedFor: 'concentration, Lorenz, insider graph' },
    { key: 'tgmWhoBoughtSold', path: 'tgm/who-bought-sold', label: 'who bought/sold', usedFor: 'sell pressure, buyers vs sellers' },
    { key: 'tgmPnlLeaderboard', path: 'tgm/pnl-leaderboard', label: 'pnl board', usedFor: '—' },
  ] },
  { group: 'Profiler', endpoints: [
    { key: 'profilerCurrentBalance', path: 'profiler/address/current-balance', label: 'balances', usedFor: 'wallet donut' },
    { key: 'profilerPnlSummary', path: 'profiler/address/pnl-summary', label: 'pnl', usedFor: 'wallet PnL' },
    { key: 'profilerTransactions', path: 'profiler/address/transactions', label: 'transactions', usedFor: 'wallet transactions' },
    { key: 'profilerCounterparties', path: 'profiler/address/counterparties', label: 'counterparties', usedFor: 'wallet counterparties' },
    { key: 'profilerRelatedWallets', path: 'profiler/address/related-wallets', label: 'related', usedFor: 'insider clusters, deployer' },
  ] },
  { group: 'Trade', endpoints: [
    { key: 'tradeQuote', path: 'trade/quote', label: 'quote', usedFor: 'ride the tide (quote only)' },
  ] },
  { group: 'Backtesting (beta)', endpoints: [
    { key: 'histTokenScreener', path: 'v1beta1/token-screener/historical', label: 'hist screener', usedFor: 'Forecast Lab features' },
    { key: 'histTgmTokenOhlcv', path: 'v1beta1/tgm/historical-token-ohlcv', label: 'hist ohlcv', usedFor: '—' },
    { key: 'histTgmTokenFlowSummary', path: 'v1beta1/tgm/historical-token-flow-summary', label: 'hist flows', usedFor: '—' },
  ] },
];

export type CellStatus = 'documented' | 'probed-ok' | 'probed-fail' | 'none';

export interface CoverageRow { chain: string; tier: Tier; inferred: boolean; cells: CellStatus[]; supported: number }

const TIER_ORDER: Record<string, number> = { A: 0, B: 1, perp: 2, C: 3 };

export function coverageMatrix(): { rows: CoverageRow[]; columns: Array<{ group: string; label: string; path: string; usedFor: string; chains: number }> } {
  const cols = ENDPOINT_GROUPS.flatMap((g) => g.endpoints.map((e) => ({ ...e, group: g.group })));
  const rows = ALL_CHAIN_IDS.map((chain) => {
    const cap = registry.chains[chain];
    const cells: CellStatus[] = cols.map((c) => {
      const probe = c.key === 'tokenScreener' ? cap?.probes?.tokenScreener : undefined;
      if (probe === 'ok') return 'probed-ok';
      if (probe === 'error') return 'probed-fail';
      return (CHAIN_ENUMS[c.key] as readonly string[]).includes(chain) ? 'documented' : 'none';
    });
    return { chain, tier: cap?.tier ?? 'C', inferred: !!cap?.inferredFromProbe, cells, supported: cells.filter((s) => s === 'documented' || s === 'probed-ok').length };
  }).sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier] || b.supported - a.supported || a.chain.localeCompare(b.chain));
  return {
    rows,
    columns: cols.map((c, j) => ({ group: c.group, label: c.label, path: c.path, usedFor: c.usedFor, chains: rows.filter((r) => r.cells[j] === 'documented' || r.cells[j] === 'probed-ok').length })),
  };
}

export function usage() {
  const db = getDb();
  const s = ledgerSummary();
  const daily = db.prepare(`
    SELECT date(called_at / 1000, 'unixepoch') AS day, SUM(cache_hit = 0) AS live, SUM(cache_hit = 1) AS cached, SUM(credits) AS credits
    FROM credit_ledger GROUP BY day ORDER BY day
  `).all() as Array<{ day: string; live: number; cached: number; credits: number }>;
  const scans = db.prepare('SELECT COUNT(*) AS runs, COALESCE(SUM(credits), 0) AS credits, MAX(finished_at) AS last FROM scan_runs').get() as { runs: number; credits: number; last: number | null };
  const first = db.prepare('SELECT MIN(called_at) AS t FROM credit_ledger').get() as { t: number | null };
  const byEndpoint = db.prepare(`
    SELECT endpoint, SUM(cache_hit = 0) AS live, SUM(cache_hit = 1) AS cached, SUM(credits) AS credits
    FROM credit_ledger GROUP BY endpoint ORDER BY live DESC
  `).all() as Array<{ endpoint: string; live: number; cached: number; credits: number }>;
  return {
    totalCalls: s.totalCalls, liveCalls: s.realCalls, cacheHits: s.cacheHits, credits: s.totalCredits,
    creditsRemaining: lastKnownCreditsRemaining() ?? (getKv('credits_remaining') ? Number(getKv('credits_remaining')!.value) : null),
    creditsRemainingAt: getKv('credits_remaining')?.updatedAt ?? null, since: first.t, daily, scans,
    // Group endpoints with ids in the path (smart-alert/<id>) together.
    byEndpoint: byEndpoint.map((e) => ({ ...e, endpoint: e.endpoint.replace(/^smart-alert\/[0-9a-f-]{20,}$/, 'smart-alert/{id}') })),
  };
}
