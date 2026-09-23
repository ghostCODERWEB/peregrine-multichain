// Sector flows from token-screener rows. A sector's pressure input is the
// same ratio the Chain Pressure Index uses, r = net flow ÷ volume, summed
// over the sector's own tokens: a token tagged with several sectors counts
// fully toward each (each sector's ratio is about its own tokens, not a
// share of a total). Stablecoins are skipped as in the CPI.
import { isStablecoin } from './trade-side';

export interface ScreenerLikeRow {
  chain: string;
  token_address?: string | null;
  token_symbol?: string | null;
  volume?: number | null;
  netflow?: number | null;
}

export interface SectorMover { chain: string; address: string; symbol: string | null; netFlowUsd: number }

export interface SectorAggregate {
  sector: string;
  netFlowUsd: number;
  volumeUsd: number;
  /** Distinct tokens that contributed net flow. */
  tokens: number;
  /** Largest inflows first, then largest outflows (up to 3 each). */
  top: { inflows: SectorMover[]; outflows: SectorMover[] };
}

export interface SectorAggregation {
  sectors: SectorAggregate[];
  /** Flow rows matched to at least one sector / not matched. */
  classified: number;
  unclassified: number;
}

const finite = (v: number | null | undefined): v is number => v != null && Number.isFinite(v);

/**
 * @param flowRows    rows whose `netflow` is the numerator (all-trader or
 *                    smart-money screener rows)
 * @param volumeRows  all-trader rows whose `volume` is the denominator
 *                    (the same rows as flowRows for market flow)
 * @param membership  tokenKey → sectors
 * @param keyOf       how a row maps to a membership key
 */
export function aggregateSectors(
  flowRows: ScreenerLikeRow[],
  volumeRows: ScreenerLikeRow[],
  membership: Map<string, string[]>,
  keyOf: (chain: string, address: string) => string,
): SectorAggregation {
  const chains = new Set(flowRows.map((r) => r.chain));
  const acc = new Map<string, { net: number; vol: number; tokens: Set<string>; movers: SectorMover[] }>();
  const get = (s: string) => {
    let a = acc.get(s);
    if (!a) { a = { net: 0, vol: 0, tokens: new Set(), movers: [] }; acc.set(s, a); }
    return a;
  };

  let classified = 0, unclassified = 0;
  for (const r of flowRows) {
    if (!r.token_address || !finite(r.netflow) || isStablecoin(r.token_symbol)) continue;
    const k = keyOf(r.chain, r.token_address);
    const sectors = membership.get(k);
    if (!sectors?.length) { unclassified++; continue; }
    classified++;
    for (const s of sectors) {
      const a = get(s);
      a.net += r.netflow;
      if (!a.tokens.has(k)) {
        a.tokens.add(k);
        a.movers.push({ chain: r.chain, address: r.token_address, symbol: r.token_symbol ?? null, netFlowUsd: r.netflow });
      }
    }
  }
  // Denominator: the sector's all-trader volume on the same chains the
  // numerator covered, so the ratio divides like by like.
  const seenVol = new Set<string>();
  for (const r of volumeRows) {
    if (!r.token_address || !finite(r.volume) || !chains.has(r.chain) || isStablecoin(r.token_symbol)) continue;
    const k = keyOf(r.chain, r.token_address);
    if (seenVol.has(k)) continue;
    seenVol.add(k);
    for (const s of membership.get(k) ?? []) get(s).vol += r.volume;
  }

  const sectors = [...acc.entries()].map(([sector, a]) => {
    const byFlow = [...a.movers].sort((x, y) => y.netFlowUsd - x.netFlowUsd);
    return {
      sector, netFlowUsd: a.net, volumeUsd: a.vol, tokens: a.tokens.size,
      top: {
        inflows: byFlow.filter((m) => m.netFlowUsd > 0).slice(0, 3),
        outflows: byFlow.filter((m) => m.netFlowUsd < 0).reverse().slice(0, 3),
      },
    };
  }).sort((x, y) => y.volumeUsd - x.volumeUsd);
  return { sectors, classified, unclassified };
}
