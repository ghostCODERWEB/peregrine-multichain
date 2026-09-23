// Chart titles state the insight, not the chart type: "Capital is rotating
// from Base into Robinhood", not "Rotation fronts". Generated from the same
// numbers the chart draws, so a title can never claim what the data doesn't.
import { chainName, usd } from '@/lib/viz/format';

interface ChainLike { chain: string; cpi: number | null; source: string | null }
interface FrontLike { from: string; to: string; netUsd: number; walletCount: number }

export function mapHeadline(chains: ChainLike[], fronts: FrontLike[]): string {
  const scored = chains.filter((c) => c.cpi != null && c.source === 'smart-money');
  if (!scored.length) return 'Waiting for the first scan of smart-money pressure';

  const top = [...scored].sort((a, b) => b.cpi! - a.cpi!)[0];
  const bottom = [...scored].sort((a, b) => a.cpi! - b.cpi!)[0];
  const parts: string[] = [];
  if (top.cpi! > 65) parts.push(`Smart money is piling into ${chainName(top.chain)}`);
  if (bottom.cpi! < 35) parts.push(`${chainName(bottom.chain)} is draining`);
  if (!parts.length) return 'Calm across chains — no smart-money pressure system above 65 or below 35';
  return parts.join('; ');
}

export function frontsHeadline(fronts: FrontLike[]): string {
  if (!fronts.length) return 'No rotation fronts yet — no two wallets have moved between the same pair of chains in the last 24h';
  const f = fronts[0];
  return `Capital is rotating from ${chainName(f.from)} into ${chainName(f.to)} — ${usd(f.netUsd)} net across ${f.walletCount} wallets`;
}
