// Spot ↔ perp divergence: for coins traded both on DEXs (scanner token pulse)
// and on Hyperliquid (perp board), compare the spot net-flow share with perp
// positioning. Descriptive: an observation with its inputs, never a signal.

export interface SpotSide { symbol: string; netflowUsd: number; volumeUsd: number }
export interface PerpSide { symbol: string; ppi: number | null; openInterest: number | null; smSkew: number | null }

export interface Divergence {
  symbol: string;
  spotShare: number;
  spotNetUsd: number;
  spotVolumeUsd: number;
  ppi: number;
  smSkew: number | null;
  openInterest: number | null;
  kind: 'spot-buying-perps-short' | 'spot-selling-perps-long' | 'aligned-long' | 'aligned-short';
}

/** Spot share ±2% and perp index ±10 from neutral count as a lean; weaker readings are ignored. */
export function spotPerp(spot: SpotSide[], perps: PerpSide[], minVolume = 250_000): Divergence[] {
  const bySym = new Map<string, { net: number; vol: number }>();
  for (const s of spot) {
    const k = s.symbol.toUpperCase().replace(/^W(?=(ETH|BTC|SOL|HYPE)$)/, '');
    const cur = bySym.get(k) ?? { net: 0, vol: 0 };
    cur.net += s.netflowUsd; cur.vol += s.volumeUsd;
    bySym.set(k, cur);
  }
  const out: Divergence[] = [];
  for (const p of perps) {
    const s = bySym.get(p.symbol.toUpperCase());
    if (!s || s.vol < minVolume || p.ppi == null) continue;
    const share = s.net / s.vol;
    const spotLean = share >= 0.02 ? 1 : share <= -0.02 ? -1 : 0;
    const perpLean = p.ppi >= 60 ? 1 : p.ppi <= 40 ? -1 : 0;
    if (!spotLean || !perpLean) continue;
    const kind = spotLean > 0 && perpLean < 0 ? 'spot-buying-perps-short' : spotLean < 0 && perpLean > 0 ? 'spot-selling-perps-long' : spotLean > 0 ? 'aligned-long' : 'aligned-short';
    out.push({ symbol: p.symbol, spotShare: share, spotNetUsd: s.net, spotVolumeUsd: s.vol, ppi: p.ppi, smSkew: p.smSkew, openInterest: p.openInterest, kind });
  }
  return out.sort((a, b) => Number(b.kind.startsWith('spot')) - Number(a.kind.startsWith('spot')) || Math.abs(b.spotShare) * Math.abs(b.ppi - 50) - Math.abs(a.spotShare) * Math.abs(a.ppi - 50));
}

export const DIVERGENCE_TEXT: Record<Divergence['kind'], string> = {
  'spot-buying-perps-short': 'Spot net buying, perps lean short',
  'spot-selling-perps-long': 'Spot net selling, perps lean long',
  'aligned-long': 'Spot and perps both lean long',
  'aligned-short': 'Spot and perps both lean short',
};
