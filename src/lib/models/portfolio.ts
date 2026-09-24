import { detectAddress } from '@/lib/address-family';
import { coneCoverage, ewmaVolatility, logReturns, volatilityCone } from './volatility-cone';

export interface Position {
  chain: string; tokenAddress: string; symbol: string; valueUsd: number; wallets: string[];
}

/** Only EVM addresses are case-insensitive. Base58 is case-sensitive. */
export const addressKey = (address: string) => /^0x[\da-f]{40}$/i.test(address) ? address.toLowerCase() : address;
export const positionKey = (p: Pick<Position, 'chain' | 'tokenAddress'>) => `${p.chain}:${addressKey(p.tokenAddress)}`;

export function walletAddresses(input: string[]): string[] {
  const addresses = [...new Set(input.map((a) => addressKey(a.trim())).filter(Boolean))];
  if (addresses.length > 5) throw new Error('A portfolio can contain up to five wallets.');
  if (addresses.some((a) => !detectAddress(a).some((m) => m.profiled && !m.tokenOnly))) {
    throw new Error('Use wallet addresses supported by Nansen (EVM, Solana, Bitcoin, Sui, TON, NEAR and other supported families).');
  }
  return addresses;
}

export function combinePositions(rows: Position[]): Position[] {
  const map = new Map<string, Position>();
  for (const row of rows) {
    if (!Number.isFinite(row.valueUsd) || row.valueUsd <= 0) continue;
    const key = positionKey(row), prev = map.get(key);
    if (prev) { prev.valueUsd += row.valueUsd; prev.wallets = [...new Set([...prev.wallets, ...row.wallets])]; }
    else map.set(key, { ...row, wallets: [...new Set(row.wallets)] });
  }
  return [...map.values()].sort((a, b) => b.valueUsd - a.valueUsd);
}

export function exposure(positions: Position[]) {
  const total = positions.reduce((s, p) => s + p.valueUsd, 0);
  const chains = new Map<string, number>();
  for (const p of positions) chains.set(p.chain, (chains.get(p.chain) ?? 0) + p.valueUsd);
  return {
    total, largestShare: total ? Math.max(0, ...positions.map((p) => p.valueUsd)) / total : null,
    effectivePositions: total ? 1 / positions.reduce((s, p) => s + (p.valueUsd / total) ** 2, 0) : null,
    byChain: [...chains].map(([chain, valueUsd]) => ({ chain, valueUsd })).sort((a, b) => b.valueUsd - a.valueUsd),
  };
}

export interface StressRow extends Position {
  low: number; high: number; sigma: number; hitRate: number; tests: number;
}

/** A sensitivity scenario, not a joint probability interval: individual
 * token cones are moved together. Missing tokens are never treated as safe. */
export function tokenStress(position: Position, candles: Array<{ day: string; close: number }>): StressRow | null {
  const days = [...new Map(candles.filter((c) => Number.isFinite(c.close) && c.close > 0).map((c) => [c.day, c.close])).entries()]
    .sort(([a], [b]) => a.localeCompare(b));
  // A gap is not a one-day return. Use only the latest uninterrupted run.
  let start = 0;
  for (let i = 1; i < days.length; i++) if (Date.parse(days[i][0]) - Date.parse(days[i - 1][0]) !== 86_400_000) start = i;
  const closes = days.slice(start).map(([, close]) => close);
  const track = coneCoverage(closes, 7);
  if (closes.length < 30 || !track || track.n < 10) return null;
  const sigma = ewmaVolatility(logReturns(closes));
  const [cone] = volatilityCone(position.valueUsd, sigma, [7]);
  return { ...position, low: cone.low, high: cone.high, sigma, hitRate: track.hitRate, tests: track.n };
}

export function stressSummary(positions: Position[], rows: StressRow[]) {
  const total = exposure(positions).total;
  const covered = rows.reduce((s, r) => s + r.valueUsd, 0);
  return {
    total, covered, coverage: total > 0 ? covered / total : null, unmodeled: Math.max(0, total - covered),
    low: rows.length ? rows.reduce((s, r) => s + r.low, 0) : null,
    high: rows.length ? rows.reduce((s, r) => s + r.high, 0) : null,
  };
}
