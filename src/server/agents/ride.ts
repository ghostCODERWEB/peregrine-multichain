// "Follow the flow" (spec 6.3, optional): on a Base or Solana token whose
// chain is under high smart-money pressure and whose own Storm Score is
// low, show what a small USDC swap into it would cost right now, from
// Nansen's trade/quote. Quote only: TIDE never signs, prepares or executes
// anything, and the quote's ready-to-sign transaction payload is dropped
// on the server so it never reaches the browser.
import { callNansen } from '@/server/nansen/client';
import { getDb } from '@/server/nansen/db';
import { endpointSupports } from '@/lib/registry';
import { chainWeather, type PressureView } from '@/server/weather/queries';
import type { Provenance } from '@/lib/provenance';
import { num, usd } from '@/lib/viz/format';

/** USDC on the two chains trade/quote supports (one side must be USDC or
 *  native, per the docs). */
const USDC: Record<string, { address: string; decimals: number }> = {
  base: { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 },
  solana: { address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6 },
};
/** Quotes need a wallet to route from; a public burn address prices the
 *  route without tying the quote to anyone. */
const QUOTE_WALLET: Record<string, string> = {
  base: '0x000000000000000000000000000000000000dEaD',
  solana: '1nc1nerator11111111111111111111111111111111',
};

export const RIDE_MIN_CPI = 55;
export const RIDE_MAX_STORM = 50;

export interface RideEligibility { eligible: boolean; reason: string; cpi: number | null; storm: number | null }

export function rideEligibility(chain: string, token: string, view: PressureView = 'private'): RideEligibility {
  if (!endpointSupports('tradeQuote', chain) || !USDC[chain]) return { eligible: false, reason: 'Nansen trade quotes cover Base and Solana only.', cpi: null, storm: null };
  const cpi = chainWeather(chain, Date.now(), view).cpi;
  const s = getDb().prepare('SELECT score FROM storm_scores WHERE chain = ? AND token_address = ? ORDER BY id DESC LIMIT 1').get(chain, token.toLowerCase()) as { score: number } | undefined;
  const storm = s?.score ?? null;
  if (cpi == null || cpi <= RIDE_MIN_CPI) return { eligible: false, reason: `No flow to follow: chain flow is ${num(cpi, 0)} (needs above ${RIDE_MIN_CPI}).`, cpi, storm };
  if (storm == null) return { eligible: false, reason: 'Needs this token’s Dump Risk first.', cpi, storm };
  if (storm >= RIDE_MAX_STORM) return { eligible: false, reason: `Dump Risk ${num(storm, 0)} is too high to show a ride (needs below ${RIDE_MAX_STORM}).`, cpi, storm };
  return { eligible: true, reason: `Chain flow ${num(cpi, 0)} and Dump Risk ${num(storm, 0)}: rising flow on a low-risk token.`, cpi, storm };
}

export interface RideQuote {
  aggregator: string; inUsd: number; outUsd: number; priceImpactPct: number | null; tradingFeeUsd: number | null; networkFeeUsd: number | null;
}

interface RawQuote {
  aggregator?: string; inUsdValue?: string; outUsdValue?: string; priceImpactPct?: string; tradingFeeInUsd?: string; networkFeeInUsd?: string;
}

const n = (v: string | undefined) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

export async function rideQuote(chain: string, token: string, amountUsd: number, view: PressureView = 'private'): Promise<{ eligibility: RideEligibility; quotes: RideQuote[]; provenance: Provenance | null }> {
  const eligibility = rideEligibility(chain, token, view);
  if (!eligibility.eligible) return { eligibility, quotes: [], provenance: null };
  const usdc = USDC[chain];
  const amount = Math.round(Math.min(10_000, Math.max(5, amountUsd)) * 10 ** usdc.decimals).toString();
  const query = { chain, from_token: usdc.address, to_token: token, amount, wallet_address: QUOTE_WALLET[chain] };
  const r = await callNansen<{ quotes?: RawQuote[] }>('trade/quote', query, { method: 'GET', record: false });
  // Keep only pricing fields; the transaction, approval address and gas
  // fields stay on the server.
  const quotes = (r.data.quotes ?? []).map((q) => ({
    aggregator: q.aggregator ?? 'aggregator', inUsd: n(q.inUsdValue) ?? 0, outUsd: n(q.outUsdValue) ?? 0,
    priceImpactPct: n(q.priceImpactPct), tradingFeeUsd: n(q.tradingFeeInUsd), networkFeeUsd: n(q.networkFeeInUsd),
  })).filter((q) => q.outUsd > 0).sort((a, b) => b.outUsd - a.outUsd);
  return {
    eligibility, quotes,
    provenance: {
      title: 'Follow the flow, quote only',
      formula: `shown when chain Flow Index > ${RIDE_MIN_CPI} and Dump Risk < ${RIDE_MAX_STORM}\ncost of following = USDC in − value out (fees + price impact)`,
      inputs: [
        { label: 'Chain flow', value: num(eligibility.cpi, 0) },
        { label: 'Dump Risk', value: num(eligibility.storm, 0) },
        { label: 'Best route out', value: quotes[0] ? `${usd(quotes[0].outUsd)} via ${quotes[0].aggregator}` : 'n/a' },
      ],
      calls: [{ endpoint: 'trade/quote', body: { ...query, wallet_address: '<public burn address: quote only>' }, ref: 'GET, live' }],
      notes: ['Peregrine never signs, prepares or executes a trade. The quote is a price, not a recommendation.'],
    },
  };
}
