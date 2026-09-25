// The perps board: every Hyperliquid coin the scanner snapshots, scored by
// the Perp Pressure Index from TIDE's own hourly history. Reading it makes
// no Nansen call; the scanner pays 2 credits an hour for the snapshots.
import { getDb } from '@/server/nansen/db';
import type { PressureView } from '@/server/weather/queries';
import { perpPressure, takerRatio, smSkew, venuePressure, annualFunding, crowdingDivergence, PUBLIC_WEIGHTS, PRIVATE_WEIGHTS, MIN_HISTORY, type PpiResult, type PpiPart } from '@/lib/models/ppi';
import type { Provenance } from '@/lib/provenance';
import { usd, pct, num } from '@/lib/viz/format';

export interface PerpRow {
  snapshot_at: number; source: 'all' | 'sm'; symbol: string;
  mark_price: number | null; previous_price: number | null; funding: number | null; open_interest: number | null;
  volume: number | null; buy_volume: number | null; sell_volume: number | null; trader_count: number | null;
  net_position_change: number | null; longs_usd: number | null; shorts_usd: number | null; longs_count: number | null; shorts_count: number | null;
}

export interface PerpCoin {
  symbol: string;
  markPrice: number | null;
  change24h: number | null;
  fundingApr: number | null;
  openInterest: number | null;
  volume: number | null;
  taker: number | null;
  traders: number | null;
  ppi: number | null;
  parts: PpiResult['parts'];
  usedCrossSectional: boolean;
  /** Smart money's book on this coin (private views only). */
  sm: { longsUsd: number; shortsUsd: number; skew: number | null; netChangeUsd: number | null; longs: number | null; shorts: number | null } | null;
  divergence: 'crowded-long' | 'crowded-short' | null;
}

export interface PerpBoard {
  at: number | null;
  coins: PerpCoin[];
  venue: { ppi: number | null; openInterest: number; fundingMedianApr: number | null; takerAll: number | null; smSkew: number | null } | null;
  scans: number;
  view: PressureView;
  provenance: Provenance | null;
  unavailable: string | null;
}

const HISTORY_MS = 7 * 86_400_000;
/** Coins below this open interest are too thin to score against the rest. */
const MIN_OI = 1_000_000;

const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };

function raw(all: PerpRow, sm: PerpRow | undefined, withSm: boolean): Partial<Record<PpiPart, number | null>> {
  const input = { volume: all.volume, buyVolume: all.buy_volume, sellVolume: all.sell_volume, funding: all.funding, smLongsUsd: sm?.longs_usd, smShortsUsd: sm?.shorts_usd };
  return { taker: takerRatio(input), funding: all.funding, ...(withSm ? { sm: smSkew(input) } : {}) };
}

/** The board as of the latest perp snapshot at or before `now`. */
export function perpBoard(view: PressureView, now = Date.now()): PerpBoard {
  const db = getDb();
  const at = (db.prepare("SELECT MAX(snapshot_at) AS t FROM perp_snapshots WHERE source = 'all' AND snapshot_at <= ?").get(now) as { t: number | null }).t;
  const scans = (db.prepare("SELECT COUNT(DISTINCT snapshot_at) AS n FROM perp_snapshots WHERE source = 'all' AND snapshot_at > ?").get(now - HISTORY_MS) as { n: number }).n;
  if (at == null) return { at: null, coins: [], venue: null, scans: 0, view, provenance: null, unavailable: 'The scanner has not snapshotted Hyperliquid perps yet; the first reading lands on its next hourly run.' };

  const withSm = view === 'private';
  const rows = db.prepare('SELECT * FROM perp_snapshots WHERE snapshot_at > ? AND snapshot_at <= ? ORDER BY snapshot_at').all(at - HISTORY_MS, at) as PerpRow[];
  const bySym = new Map<string, { all: PerpRow[]; sm: Map<number, PerpRow> }>();
  for (const r of rows) {
    if (r.source === 'sm' && !withSm) continue;
    const e = bySym.get(r.symbol) ?? { all: [] as PerpRow[], sm: new Map<number, PerpRow>() };
    if (r.source === 'all') e.all.push(r); else e.sm.set(r.snapshot_at, r);
    bySym.set(r.symbol, e);
  }

  const current = [...bySym.entries()].map(([symbol, e]) => ({ symbol, e, now: e.all.at(-1)! })).filter((c) => c.now && c.now.snapshot_at === at);
  const scored = current.filter((c) => (c.now.open_interest ?? 0) >= MIN_OI);
  // Peers: every scored coin's current raw values, for the cross-sectional fallback.
  const peers: Partial<Record<PpiPart, number[]>> = { taker: [], funding: [], sm: [] };
  const nowRaw = new Map<string, Partial<Record<PpiPart, number | null>>>();
  for (const c of scored) {
    const r = raw(c.now, c.e.sm.get(at), withSm);
    nowRaw.set(c.symbol, r);
    for (const k of ['taker', 'funding', 'sm'] as PpiPart[]) if (r[k] != null) peers[k]!.push(r[k]!);
  }

  const coins: PerpCoin[] = current.map(({ symbol, e, now: a }) => {
    const smNow = e.sm.get(at);
    const history: Partial<Record<PpiPart, number[]>> = { taker: [], funding: [], sm: [] };
    for (const h of e.all.slice(0, -1)) {
      const r = raw(h, e.sm.get(h.snapshot_at), withSm);
      for (const k of ['taker', 'funding', 'sm'] as PpiPart[]) if (r[k] != null) history[k]!.push(r[k]!);
    }
    const r = nowRaw.get(symbol) ?? raw(a, smNow, withSm);
    const useSm = withSm && r.sm != null;
    const res = (a.open_interest ?? 0) >= MIN_OI ? perpPressure(r, history, peers, useSm ? PRIVATE_WEIGHTS : PUBLIC_WEIGHTS) : null;
    const skew = withSm ? smSkew({ volume: null, buyVolume: null, sellVolume: null, funding: null, smLongsUsd: smNow?.longs_usd, smShortsUsd: smNow?.shorts_usd }) : null;
    return {
      symbol,
      markPrice: a.mark_price, change24h: a.mark_price && a.previous_price ? a.mark_price / a.previous_price - 1 : null,
      fundingApr: a.funding != null ? annualFunding(a.funding) : null, openInterest: a.open_interest, volume: a.volume,
      taker: r.taker ?? null, traders: a.trader_count,
      ppi: res?.ppi ?? null, parts: res?.parts ?? {}, usedCrossSectional: res?.usedCrossSectional ?? true,
      sm: withSm && smNow ? { longsUsd: Math.abs(smNow.longs_usd ?? 0), shortsUsd: Math.abs(smNow.shorts_usd ?? 0), skew, netChangeUsd: smNow.net_position_change, longs: smNow.longs_count, shorts: smNow.shorts_count } : null,
      divergence: crowdingDivergence(res?.parts.funding?.z, skew),
    };
  }).sort((x, y) => (y.openInterest ?? 0) - (x.openInterest ?? 0));

  const ppi = venuePressure(coins.filter((c) => c.ppi != null).map((c) => ({ ppi: c.ppi!, openInterest: c.openInterest })));
  const oi = coins.reduce((s, c) => s + (c.openInterest ?? 0), 0);
  const fundingMedianApr = median(coins.filter((c) => (c.openInterest ?? 0) >= MIN_OI && c.fundingApr != null).map((c) => c.fundingApr!));
  const buy = current.reduce((s, c) => s + (c.now.buy_volume ?? 0), 0), sell = current.reduce((s, c) => s + (c.now.sell_volume ?? 0), 0);
  const smL = coins.reduce((s, c) => s + (c.sm?.longsUsd ?? 0), 0), smS = coins.reduce((s, c) => s + (c.sm?.shortsUsd ?? 0), 0);
  const cross = coins.some((c) => c.ppi != null && c.usedCrossSectional);
  const lead = [...coins].filter((c) => c.ppi != null).sort((x, y) => Math.abs(y.ppi! - 50) - Math.abs(x.ppi! - 50))[0];

  return {
    at, coins, scans, view, unavailable: null,
    venue: { ppi, openInterest: oi, fundingMedianApr, takerAll: buy + sell > 0 ? (buy - sell) / (buy + sell) : null, smSkew: withSm && smL + smS > 0 ? (smL - smS) / (smL + smS) : null },
    provenance: {
      title: `Perp Flow Index, Hyperliquid (${withSm ? 'with smart money' : 'all traders'})`,
      formula: `per coin: taker = (buy − sell volume) ÷ max(volume, $50K); funding = hourly rate${withSm ? '; sm skew = (SM longs − SM shorts) ÷ (SM longs + SM shorts)' : ''}\neach a robust z against the coin's own hourly history (≥ ${MIN_HISTORY} snapshots), else against the other coins now\nPPI = 50 + 50·tanh(z̄/2), z̄ = ${withSm ? '0.4·taker + 0.2·funding + 0.4·sm (0.65/0.35 without a smart-money book)' : '0.65·taker + 0.35·funding'}\nvenue = open-interest-weighted mean of coin PPIs`,
      inputs: [
        { label: 'Coins scored (OI ≥ $1M)', value: String(coins.filter((c) => c.ppi != null).length) },
        { label: 'Open interest', value: usd(oi) },
        { label: 'Hourly snapshots in 7 days', value: String(scans) },
        { label: 'Most extreme', value: lead ? `${lead.symbol} ${num(lead.ppi, 0)}` : '—' },
        { label: 'Median funding (annualized)', value: fundingMedianApr != null ? pct(fundingMedianApr, 1) : '—' },
      ],
      calls: [{ endpoint: 'perp-screener', body: withSm ? '24h window, all traders + trader_type sm, 250 coins by open interest' : '24h window, all traders, 250 coins by open interest', credits: withSm ? 2 : 1, ref: 'scanner snapshots, hourly' }],
      notes: [
        ...(cross ? [`Scored against the other coins until each has ${MIN_HISTORY} hourly readings of its own (the scanner started snapshotting perps with M5).`] : []),
        'A reading of positioning, not a prediction; its track record comes with the M9 backtest.',
      ],
    },
  };
}

export function perpTitle(b: PerpBoard): string {
  if (!b.venue || b.venue.ppi == null) return 'Hyperliquid perps: no reading yet';
  const lead = [...b.coins].filter((c) => c.ppi != null && (c.openInterest ?? 0) >= 10_000_000).sort((x, y) => Math.abs(y.ppi! - 50) - Math.abs(x.ppi! - 50))[0];
  const p = b.venue.ppi;
  const mood = p > 65 ? 'long-biased' : p < 35 ? 'short-biased' : 'balanced';
  const name = (sym: string) => (sym.includes(':') ? `${sym.split(':')[1]} (${sym.split(':')[0]})` : sym);
  return `Hyperliquid perps ${mood} (Perp Flow ${num(p, 0)})${lead ? ` · ${name(lead.symbol)} most one-sided at ${num(lead.ppi, 0)}, ${lead.ppi! >= 50 ? 'long' : 'short'}` : ''}`;
}
