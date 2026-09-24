// Chart titles state the insight, not the chart type: "Capital is rotating
// from Base into Robinhood", not "Rotation fronts". Generated from the same
// numbers the chart draws, so a title can never claim what the data doesn't.
import { chainName, usd } from '@/lib/viz/format';
import type { TrailStep } from '@/server/wallet/wallet-page';

interface ChainLike { chain: string; cpi: number | null; source: string | null }
interface FrontLike { from: string; to: string; netUsd: number; walletCount: number }

export function mapHeadline(chains: ChainLike[], fronts: FrontLike[]): string {
  // A smart-money claim when any chain has a smart-money reading; the public
  // view has only all-trader readings, and then says so in its wording.
  const sm = chains.filter((c) => c.cpi != null && c.source === 'smart-money');
  const scored = sm.length ? sm : chains.filter((c) => c.cpi != null && c.source === 'market-flow');
  if (!scored.length) return 'Waiting for the first scan of chain flow';
  const top = [...scored].sort((a, b) => b.cpi! - a.cpi!)[0];
  const bottom = [...scored].sort((a, b) => a.cpi! - b.cpi!)[0];
  const up = top.cpi! > 65, down = bottom.cpi! < 35;
  // Desk language: smart money accumulates and distributes; all-trader
  // readings only show where flows lead, so they claim no more than that.
  if (up || down) {
    if (sm.length) {
      const parts = [up && `accumulating ${chainName(top.chain)}`, down && `distributing ${chainName(bottom.chain)}`].filter(Boolean);
      return `Smart money ${parts.join('; ')}`;
    }
    const parts = [up && `Inflows lead on ${chainName(top.chain)}`, down && `${up ? 'outflows' : 'Outflows'} on ${chainName(bottom.chain)}`].filter(Boolean);
    return parts.join('; ');
  }
  // Neutral flows can still hide capital moving between chains: say so.
  const front = fronts[0];
  return front
    ? `Neutral flows; capital rotating ${chainName(front.from)} → ${chainName(front.to)}`
    : `Neutral flows across chains — no ${sm.length ? 'smart-money' : 'all-trader'} reading above 65 or below 35`;
}

export function frontsHeadline(fronts: FrontLike[]): string {
  if (!fronts.length) return 'No capital rotations in the last 24h';
  const f = fronts[0];
  return `Capital rotating ${chainName(f.from)} → ${chainName(f.to)}: ${usd(f.netUsd)} net, ${f.walletCount} wallets`;
}

/** Wallet page: where this wallet's smart-money trades went, in order. */
export function trailTitle(steps: TrailStep[], chains: string[]): string {
  if (!steps.length) return 'No smart-money trades recorded for this wallet in 7 days';
  if (chains.length === 1) return `Traded only on ${chainName(chains[0])} in the last 7 days (${steps.length} moves)`;
  const hops: string[] = [];
  for (const s of steps) if (hops.at(-1) !== s.chain) hops.push(s.chain);
  return `Moved across ${chains.length} chains in 7 days: ${hops.slice(0, 5).map(chainName).join(' → ')}${hops.length > 5 ? ' → …' : ''}`;
}
