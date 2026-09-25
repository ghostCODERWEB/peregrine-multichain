import { z } from 'zod';
import { callNansen, callScope } from '@/server/nansen/client';
import { requestDay } from '@/server/nansen/demo';
import { cacheKey } from '@/server/nansen/cache';
import { S_ProfilerAddressBalancesResponse, S_TokenOHLCVResponse } from '@/types/nansen/api.gen';
import { contractSupports } from '@/server/nansen/support';
import {
  combinePositions,
  exposure,
  stressSummary,
  tokenStress,
  walletAddresses,
  type Position,
  type StressRow,
} from '@/lib/models/portfolio';
import type { Provenance } from '@/lib/provenance';
import { getDb } from '@/server/nansen/db';
import { addressKey } from '@/lib/models/portfolio';

// Use the published contract for every new data boundary. A changed shape
// becomes an unavailable section; the Nansen client also records drift.
export async function validated<T>(
  endpoint: string,
  body: unknown,
  schema: z.ZodType<T>,
): Promise<{ data: T; call: Provenance['calls'][number] }> {
  const r = await callNansen<unknown>(endpoint, body);
  const parsed = schema.safeParse(r.data);
  if (!parsed.success)
    throw new Error(`Nansen changed the ${endpoint} response. This section is unavailable while its schema is reviewed.`);
  return {
    data: parsed.data,
    call: { endpoint, body, credits: r.meta.creditsCost, ref: `${r.meta.cacheHit ? 'cache' : 'live'} · ${cacheKey(endpoint, body)}` },
  };
}

export async function portfolio(addresses: string[]) {
  const wallets = walletAddresses(addresses);
  if (!wallets.length) throw new Error('Add at least one wallet.');
  const tally = { calls: 0, credits: 0, cached: 0 };
  return callScope.run(tally, async () => {
    const calls: Provenance['calls'] = [];
    const sources = await Promise.all(
      wallets.map(async (address) => {
        try {
          const r = await validated(
            'profiler/address/current-balance',
            {
              address,
              chain: 'all',
              hide_spam_token: true,
              pagination: { page: 1, per_page: 200 },
              order_by: [{ field: 'value_usd', direction: 'DESC' }],
            },
            S_ProfilerAddressBalancesResponse,
          );
          calls.push(r.call);
          const positions: Position[] = r.data.data
            .filter((p) => p.value_usd != null && p.value_usd > 0)
            .map((p) => ({
              chain: p.chain,
              tokenAddress: p.token_address,
              symbol: p.token_symbol,
              valueUsd: p.value_usd!,
              wallets: [address],
            }));
          return { address, positions, limited: r.data.pagination.is_last_page === false, error: null as string | null };
        } catch (e) {
          return { address, positions: [] as Position[], limited: false, error: (e as Error).message.slice(0, 200) };
        }
      }),
    );
    const positions = combinePositions(sources.flatMap((s) => s.positions));
    const recentStorm = getDb().prepare(
      'SELECT score, confidence, computed_at AS at FROM storm_scores WHERE chain = ? AND token_address = ? AND computed_at >= ? ORDER BY computed_at DESC LIMIT 1',
    );
    const stormRows = positions.flatMap((position) => {
      const s = recentStorm.get(position.chain, addressKey(position.tokenAddress), Date.now() - 86_400_000) as
        | { score: number; confidence: number; at: number }
        | undefined;
      return s && Number.isFinite(s.score) && s.confidence >= 0.5 ? [{ ...position, ...s }] : [];
    });
    const stormValue = stormRows.reduce((s, r) => s + r.valueUsd, 0);
    return {
      positions,
      exposure: exposure(positions),
      wallets: sources.map(({ positions: p, ...s }) => ({ ...s, totalUsd: s.error ? null : exposure(p).total })),
      storm: {
        rows: stormRows,
        coveredUsd: stormValue,
        score: stormValue ? stormRows.reduce((s, r) => s + r.valueUsd * r.score, 0) / stormValue : null,
      },
      tally,
      provenance: {
        title: 'Portfolio allocation',
        formula:
          'Sum positive priced token balances across unique wallets, grouped by chain + token address. Effective positions = 1 / Σ(value / total)².',
        inputs: [
          { label: 'Wallets requested', value: String(wallets.length) },
          { label: 'Wallets available', value: String(sources.filter((s) => !s.error).length) },
        ],
        calls,
        notes: [
          'Up to 200 positions per wallet. Unpriced tokens, NFTs, DeFi positions and perp collateral are not included in the spot total. A missing wallet is not valued at zero. Identical symbols on different chains or contracts stay separate.',
          'Risk exposure uses local Peregrine scores from the last 24 hours with at least 50% input confidence, value-weighted over covered positions only. It is a heuristic, not a prediction probability; unscored tokens remain unknown.',
        ],
      } satisfies Provenance,
    };
  });
}

export type Portfolio = Awaited<ReturnType<typeof portfolio>>;

/** Max five balance requests + eight candle requests, at 1 credit each. */
export async function portfolioStress(addresses: string[]) {
  const p = await portfolio(addresses);
  const tally = { calls: 0, credits: 0, cached: 0 };
  return callScope.run(tally, async () => {
    const calls: Provenance['calls'] = [...p.provenance.calls];
    const outcomes = await Promise.all(
      p.positions.slice(0, 8).map(async (position) => {
        if (!contractSupports('POST /api/v1/tgm/token-ohlcv', position.chain))
          return { row: null, reason: `${position.symbol}: candles unavailable on ${position.chain}.` };
        try {
          const r = await validated(
            'tgm/token-ohlcv',
            {
              chain: position.chain,
              token_address: position.tokenAddress,
              timeframe: '1d',
              date_range: { start: requestDay(90), end: requestDay(0) },
            },
            S_TokenOHLCVResponse,
          );
          calls.push(r.call);
          const row = tokenStress(
            position,
            r.data.data.map((c) => ({ day: c.interval_start.slice(0, 10), close: c.close ?? NaN })),
          );
          return {
            row,
            reason: row ? null : `${position.symbol}: fewer than 30 continuous daily closes or insufficient walk-forward tests.`,
          };
        } catch (e) {
          return { row: null, reason: `${position.symbol}: ${(e as Error).message.slice(0, 160)}` };
        }
      }),
    );
    const rows = outcomes.map((x) => x.row).filter((r): r is StressRow => r != null);
    return {
      rows,
      summary: stressSummary(p.positions, rows),
      missing: outcomes.map((x) => x.reason).filter((s): s is string => !!s),
      failedWallets: p.wallets.filter((w) => w.error).map((w) => w.address),
      tally: { calls: tally.calls + p.tally.calls, credits: tally.credits + p.tally.credits, cached: tally.cached + p.tally.cached },
      provenance: {
        title: 'Seven-day portfolio sensitivity',
        formula:
          'Daily EWMA σ (λ = 0.94); each token value × exp(±1.28 × σ × √7). Add the token scenarios. Tokens without a track record remain unmodeled.',
        inputs: [
          { label: 'Token limit', value: '8 largest positions' },
          { label: 'Horizon', value: '7 days' },
        ],
        calls,
        notes: [
          'This is a simultaneous price-shock scenario, not an 80% probability interval for the portfolio. It does not estimate correlations, liquidation, fees, liquidity or a maximum loss.',
          'Each token includes its own walk-forward seven-day cone hit rate. Overlapping windows are not independent observations. Unmodeled balances are shown separately and are not assumed safe.',
        ],
      } satisfies Provenance,
    };
  });
}

export type PortfolioStress = Awaited<ReturnType<typeof portfolioStress>>;
