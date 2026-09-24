// Three gauges (L2): direction, confidence and coordination risk, computed
// from what the token page already streamed and never combined into one
// score. Conflict between them is the point: strong direction on thin
// evidence, or buying by wallets that are linked to each other.
import type { WindSegment, WindTimeframe } from '@/lib/wind';

export type Cell = { netUsd: number | null; wallets: number | null };
export type Rings = Record<WindTimeframe, Record<WindSegment, Cell>>;
export const INFORMED: WindSegment[] = ['smart_trader', 'top_pnl', 'whale', 'public_figure'];
const SEG_NAME: Record<WindSegment, string> = { smart_trader: 'Smart traders', top_pnl: 'Top-PnL wallets', whale: 'Whales', public_figure: 'Public figures', fresh_wallets: 'Fresh wallets', exchange: 'Exchanges' };

export interface Part { label: string; value: number | null; note: string }
export interface Gauge { value: number | null; label: string; parts: Part[]; reasons: string[] }
export interface GaugeInputs {
  rings: Rings | null;
  liquidityUsd: number | null; volume24hUsd: number | null;
  buyVolumeUsd: number | null; sellVolumeUsd: number | null;
  clusters: Array<{ share: number; wallets: number; includesDeployer: boolean }> | null;
  clusteredHolderCount: number | null; comparedHolders: number | null;
}

const fin = (x: number | null | undefined): x is number => x != null && Number.isFinite(x);
const clamp = (x: number) => Math.max(0, Math.min(1, x));
const usdS = (x: number) => `${x < 0 ? '−' : '+'}$${fmt(Math.abs(x))}`;
function fmt(x: number) { return x >= 1e9 ? `${(x / 1e9).toFixed(1)}B` : x >= 1e6 ? `${(x / 1e6).toFixed(1)}M` : x >= 1e3 ? `${(x / 1e3).toFixed(0)}K` : x.toFixed(0); }

/** Informed net flow (smart traders, top-PnL, whales, public figures) in one window. */
export function informedNet(rings: Rings, tf: WindTimeframe): number | null {
  const vals = INFORMED.map((s) => rings[tf]?.[s]?.netUsd).filter(fin);
  return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
}

/** Direction, −100…+100: informed 1d net flow against liquidity.
 *  100·tanh(net ÷ (5% of liquidity)); volume stands in when liquidity is missing. */
export function directionGauge(i: GaugeInputs): Gauge {
  if (!i.rings) return { value: null, label: 'waiting for flows', parts: [], reasons: [] };
  const net = informedNet(i.rings, '1d');
  const scale = fin(i.liquidityUsd) && i.liquidityUsd > 0 ? i.liquidityUsd : fin(i.volume24hUsd) && i.volume24hUsd > 0 ? i.volume24hUsd : null;
  const value = net == null || scale == null ? null : Math.round(100 * Math.tanh(net / (0.05 * scale)));
  const top = INFORMED.map((s) => ({ s, v: i.rings!['1d'][s]?.netUsd })).filter((x): x is { s: WindSegment; v: number } => fin(x.v) && x.v !== 0)
    .sort((a, b) => Math.abs(b.v) - Math.abs(a.v)).slice(0, 3);
  const crowd = fin(i.buyVolumeUsd) && fin(i.sellVolumeUsd) && i.buyVolumeUsd + i.sellVolumeUsd > 0 ? (i.buyVolumeUsd - i.sellVolumeUsd) / (i.buyVolumeUsd + i.sellVolumeUsd) : null;
  const reasons = top.map((x) => `${SEG_NAME[x.s]} ${usdS(x.v)} in 1d`);
  if (crowd != null) reasons.push(`All DEX traders: ${crowd >= 0 ? 'buys' : 'sells'} lead ${Math.abs(Math.round(crowd * 100))}% of volume`);
  const ex = i.rings['1d'].exchange?.netUsd;
  if (fin(ex) && ex !== 0) reasons.push(`Exchanges ${usdS(ex)} in 1d`);
  return {
    value, label: value == null ? 'no reading' : value >= 20 ? 'informed buying' : value <= -20 ? 'informed selling' : 'no clear side',
    parts: [
      { label: 'Informed net, 1d', value: net, note: 'smart traders + top-PnL + whales + public figures' },
      { label: 'Scale', value: scale, note: fin(i.liquidityUsd) && i.liquidityUsd > 0 ? 'liquidity' : 'volume (no liquidity reported)' },
      { label: 'All-trader split', value: crowd, note: '(buy − sell) ÷ (buy + sell), 24h DEX volume' },
    ],
    reasons,
  };
}

/** Confidence, 0–100: how much evidence stands behind the direction reading.
 *  Mean of four parts; a missing part counts as zero and is listed. */
export function confidenceGauge(i: GaugeInputs): Gauge {
  if (!i.rings) return { value: null, label: 'waiting for flows', parts: [], reasons: [] };
  const wallets = INFORMED.map((s) => i.rings!['1d'][s]?.wallets).filter(fin).reduce((a, b) => a + b, 0);
  const d1 = informedNet(i.rings, '1d');
  const signs = (['1h', '6h', '7d'] as WindTimeframe[]).map((tf) => informedNet(i.rings!, tf)).filter(fin).filter((v) => v !== 0);
  const agree = d1 == null || d1 === 0 || !signs.length ? null : signs.filter((v) => Math.sign(v) === Math.sign(d1)).length / signs.length;
  const h1 = informedNet(i.rings, '1h');
  const parts: Part[] = [
    { label: 'Sample', value: wallets ? clamp(Math.log10(1 + wallets) / Math.log10(51)) : null, note: `${wallets} informed wallets in 1d (50+ = full)` },
    { label: 'Agreement', value: agree, note: 'share of 1h, 6h and 7d windows on the same side as 1d' },
    { label: 'Depth', value: fin(i.liquidityUsd) && i.liquidityUsd > 0 ? clamp((Math.log10(i.liquidityUsd) - 4) / 3) : null, note: 'liquidity on a log scale, $10K = 0 to $10M = full' },
    { label: 'Recency', value: h1 == null ? null : h1 !== 0 ? 1 : 0, note: 'informed flow in the last hour' },
  ];
  const present = parts.filter((p) => p.value != null);
  const value = Math.round((100 * present.reduce((a, p) => a + p.value!, 0)) / parts.length);
  const missing = parts.filter((p) => p.value == null).map((p) => p.label.toLowerCase());
  return { value, label: value >= 65 ? 'well supported' : value >= 35 ? 'partial evidence' : 'thin evidence', parts, reasons: missing.length ? [`Missing: ${missing.join(', ')} (counted as zero)`] : [] };
}

/** Coordination risk, 0–100: the larger of the supply held by linked top
 *  holders (20% = full) and the share of top holders that are linked. */
export function coordinationGauge(i: GaugeInputs): Gauge {
  if (!i.clusters || i.comparedHolders == null) return { value: null, label: 'waiting for holder links', parts: [], reasons: [] };
  const share = i.clusters.filter((c) => c.wallets >= 2).reduce((a, c) => a + c.share, 0);
  const linked = i.comparedHolders ? (i.clusteredHolderCount ?? 0) / i.comparedHolders : 0;
  const deployer = i.clusters.some((c) => c.includesDeployer && c.wallets >= 2);
  const value = Math.round(100 * Math.max(clamp(share / 0.2), clamp(linked)));
  const reasons = [`${(share * 100).toFixed(1)}% of supply held by linked top holders`, `${i.clusteredHolderCount ?? 0} of ${i.comparedHolders} top holders linked by funder or relation`];
  if (deployer) reasons.push('A cluster includes the deployer');
  return {
    value, label: value >= 50 ? 'high' : value >= 20 ? 'some' : 'low',
    parts: [
      { label: 'Linked supply', value: share, note: 'share of supply in clusters of 2+ top holders' },
      { label: 'Linked holders', value: linked, note: 'clustered ÷ compared top holders' },
    ],
    reasons,
  };
}

export interface Falsifier { text: string; source: 'wind' | 'leverage' | 'forensics' | 'header'; /** Already true in the data. */ active?: boolean }

/** "What would break this?": up to three conditions written from the data,
 *  for the side the flows point to (or for standing aside). */
export function falsifiers(i: GaugeInputs, dir: Gauge, ladder: { mark: number; below: { price: number; usd: number } | null; above: { price: number; usd: number } | null } | null): Falsifier[] {
  const out: Falsifier[] = [];
  const v = dir.value;
  const net6 = i.rings ? informedNet(i.rings, '6h') : null;
  const net1d = i.rings ? informedNet(i.rings, '1d') : null;
  const band = fin(i.liquidityUsd) && i.liquidityUsd > 0 ? 0.01 * i.liquidityUsd : null;
  // If the last 6h already run against the 1d side, say so: it is happening, not hypothetical.
  if (v != null && v >= 20 && net6 != null) out.push(net6 < 0
    ? { source: 'wind', active: true, text: `Already happening: informed 6h flow is negative (${usdS(net6)}) against the 1d buying.` }
    : { source: 'wind', text: `Informed 6h flow turns negative (now ${usdS(net6)}).` });
  else if (v != null && v <= -20 && net6 != null) out.push(net6 > 0
    ? { source: 'wind', active: true, text: `Already happening: informed 6h flow is positive (${usdS(net6)}) against the 1d selling.` }
    : { source: 'wind', text: `Informed 6h flow turns positive (now ${usdS(net6)}).` });
  else if (v != null && band != null && net1d != null) out.push({ source: 'wind', text: `Informed 1d flow leaves ±$${fmt(band)} (1% of liquidity; now ${usdS(net1d)}): standing aside stops being right.` });
  if (ladder && ladder.mark > 0) {
    const b = v != null && v <= -20 ? ladder.above : ladder.below;
    if (b && Math.abs(b.price / ladder.mark - 1) <= 0.25) {
      const pct = Math.round((b.price / ladder.mark - 1) * 100);
      out.push({ source: 'leverage', text: `Price reaches $${b.price.toPrecision(4)} (${pct > 0 ? '+' : ''}${pct}%), the densest band where $${fmt(b.usd)} of ${b === ladder.below ? 'longs would be forced to sell' : 'shorts would be forced to buy'}.` });
    }
  }
  const share = i.clusters ? i.clusters.filter((c) => c.wallets >= 2).reduce((a, c) => a + c.share, 0) : 0;
  if (share >= 0.05) out.push({ source: 'forensics', text: `Linked holders with ${(share * 100).toFixed(1)}% of supply start selling together.` });
  const crowd = fin(i.buyVolumeUsd) && fin(i.sellVolumeUsd) && i.buyVolumeUsd + i.sellVolumeUsd > 0 ? (i.buyVolumeUsd - i.sellVolumeUsd) / (i.buyVolumeUsd + i.sellVolumeUsd) : null;
  if (out.length < 3 && crowd != null && v != null && Math.abs(v) >= 20 && Math.sign(crowd) !== Math.sign(v) && Math.abs(crowd) >= 0.1) {
    out.push({ source: 'header', text: `The crowd keeps ${crowd > 0 ? 'buying' : 'selling'} against informed flow (${Math.abs(Math.round(crowd * 100))}% ${crowd > 0 ? 'buy' : 'sell'}-led today).` });
  }
  return out.slice(0, 3);
}
