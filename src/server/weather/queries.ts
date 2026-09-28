// Read side of the scanner: turns stored snapshots and trades into what the
// pages show. No Nansen calls here — everything is derived from TIDE's own
// history, which is why the map loads instantly and costs nothing to view.
import { isRiskListable } from '@/lib/models/trade-side';
import { properAddress } from '@/server/nansen/address-case';
import { getDb } from '@/server/nansen/db';
import { tokenLogos, logoOf } from '@/server/token/meta';
import { pressureBand, type Window } from '@/lib/models/cpi';
import { matchWalletRotations, buildDirectedFronts, netFronts, type Trade, type RotationMatch } from '@/lib/models/rotation-fronts';
import { holtForecast, mape } from '@/lib/models/holt-forecast';
import { registry, ALL_CHAIN_IDS, pressureSource, unavailableReason, type PressureSource } from '@/lib/registry';
import type { Tier } from '@/config/capability-types';

export interface WindowReading {
  window: Window;
  netFlowUsd: number;
  volumeUsd: number;
  ratio: number;
  z: number;
  cpi: number;
  usedCrossSection: boolean;
  tokenCount: number;
  snapshotAt: number;
}

export interface ChainWeather {
  chain: string;
  tier: Tier;
  source: PressureSource | null;
  cpi: number | null;
  band: 'high' | 'neutral' | 'low' | null;
  /** CPI change over the trailing ~6h — the "rising flow" isobar cue. */
  trend6h: number | null;
  anyCrossSection: boolean;
  windows: WindowReading[];
  /** Blended CPI over the trailing 7 days, oldest first. */
  series: Array<{ t: number; cpi: number }>;
  updatedAt: number | null;
  unavailable: string | null;
}

const DAY = 24 * 60 * 60_000;

/**
 * Which pressure series a viewer may see. Private (the key owner) reads a
 * Tier A chain's smart-money flow; public reads every chain's
 * all-trader market-flow pressure — smart-money inflows are "restricted"
 * under Nansen's redistribution rules, all-trader screener flow is not.
 */
export type PressureView = 'private' | 'public';

/** Hyperliquid is a perp venue: its reading is the Perp Pressure Index,
 *  written into the same series by the scanner's hourly perp step. */
export const PERP_VENUE = 'hyperliquid';

export function sourceFor(chain: string, view: PressureView): PressureSource | null {
  if (chain === PERP_VENUE) return view === 'public' ? 'market-flow' : 'smart-money';
  const native = pressureSource(chain);
  if (!native) return null;
  return view === 'public' ? 'market-flow' : native;
}

function latestWindows(chain: string, source: PressureSource): WindowReading[] {
  const rows = getDb().prepare(`
    SELECT s.* FROM chain_pressure_snapshots s
    JOIN (SELECT window, MAX(id) AS id FROM chain_pressure_snapshots WHERE chain = ? AND nf_source = ? GROUP BY window) m ON m.id = s.id
    ORDER BY CASE s.window WHEN '1h' THEN 0 WHEN '24h' THEN 1 ELSE 2 END
  `).all(chain, source) as Array<{
    window: Window; net_flow_usd: number; volume_usd: number; ratio: number; z: number; cpi: number;
    used_cross_section: number; token_count: number; snapshot_at: number;
  }>;
  return rows.map((r) => ({
    window: r.window, netFlowUsd: r.net_flow_usd, volumeUsd: r.volume_usd, ratio: r.ratio, z: r.z, cpi: r.cpi,
    usedCrossSection: r.used_cross_section === 1, tokenCount: r.token_count, snapshotAt: r.snapshot_at,
  }));
}

function cpiSeries(chain: string, source: PressureSource, since: number): Array<{ t: number; cpi: number }> {
  return (getDb()
    .prepare('SELECT snapshot_at AS t, cpi FROM chain_cpi WHERE chain = ? AND source = ? AND snapshot_at >= ? ORDER BY snapshot_at')
    .all(chain, source, since) as Array<{ t: number; cpi: number }>);
}

export function chainWeather(chain: string, now = Date.now(), view: PressureView = 'private'): ChainWeather {
  const cap = registry.chains[chain];
  const source = sourceFor(chain, view);
  const series = source ? cpiSeries(chain, source, now - 7 * DAY) : [];
  const last = series.at(-1) ?? null;
  const latestRow = source
    ? (getDb().prepare('SELECT any_cross_section FROM chain_cpi WHERE chain = ? AND source = ? ORDER BY id DESC LIMIT 1').get(chain, source) as { any_cross_section: number } | undefined)
    : undefined;
  // Only a real 6h-old reading counts: falling back to the oldest snapshot
  // would print "+0.0 over 6h" on a chain with fifteen minutes of history.
  const sixHoursAgo = series.filter((p) => p.t <= now - 6 * 60 * 60_000).at(-1);
  return {
    chain,
    tier: cap?.tier ?? 'C',
    source,
    cpi: last?.cpi ?? null,
    band: last ? pressureBand(last.cpi) : null,
    trend6h: last && sixHoursAgo && sixHoursAgo !== last ? last.cpi - sixHoursAgo.cpi : null,
    anyCrossSection: latestRow?.any_cross_section === 1,
    windows: source ? latestWindows(chain, source) : [],
    series,
    updatedAt: last?.t ?? null,
    unavailable: source ? (last ? null : 'The scanner has not produced a reading for this chain yet.') : unavailableReason(chain, 'pressure'),
  };
}

export function weatherMap(now = Date.now(), view: PressureView = 'private'): ChainWeather[] {
  return ALL_CHAIN_IDS.map((c) => chainWeather(c, now, view));
}

// ---------------------------------------------------------------------------
// Rotation fronts
// ---------------------------------------------------------------------------

export interface FrontWallet {
  wallet: string;
  label: string | null;
  soldUsd: number;
  boughtUsd: number;
  soldTokens: string[];
  boughtTokens: string[];
}

/** A token a rotation sold or bought, resolved to its address on that chain. */
export interface TokenRef { symbol: string; chain: string; address: string }

export interface Front {
  evidence?: import('@/lib/models/inferred-rotations').InferredMatch[];
  from: string;
  to: string;
  netUsd: number;
  grossForward: number;
  grossBack: number;
  confidence: number;
  walletCount: number;
  inferred: boolean;
  wallets: FrontWallet[];
  /** Tokens sold on `from` and bought on `to`, with addresses, for linking (P4). */
  tokenRefs?: TokenRef[];
}

interface TradeRow {
  chain: string; wallet: string; wallet_label: string | null; side: 'buy' | 'sell';
  token_symbol: string | null; token_address: string | null; usd_value: number; traded_at: number;
}

/**
 * Fronts over the trailing `hours`, measured from stored trades: each
 * wallet's sells on one chain matched to its later buys on another within
 * 12h (rotation-fronts.ts), grouped into directed fronts (>= 2 wallets),
 * then netted per chain pair. The trade query reaches 12h further back
 * than the display window so a sell just before the window can still
 * pair with a buy inside it.
 */
export function rotationFronts(hours = 24, now = Date.now()): Front[] {
  const since = now - hours * 60 * 60_000;
  const rows = getDb().prepare(`
    SELECT chain, wallet, wallet_label, side, token_symbol, token_address, usd_value, traded_at
    FROM smart_money_trades WHERE traded_at >= ? AND traded_at <= ? ORDER BY traded_at
  `).all(since - 12 * 60 * 60_000, now) as TradeRow[];

  const byWallet = new Map<string, TradeRow[]>();
  for (const r of rows) byWallet.set(r.wallet, [...(byWallet.get(r.wallet) ?? []), r]);

  const matches: RotationMatch[] = [];
  for (const [wallet, trades] of byWallet) {
    if (new Set(trades.map((t) => t.chain)).size < 2) continue; // one chain can't rotate
    const asTrades: Trade[] = trades.map((t) => ({ wallet, chain: t.chain, side: t.side, usdValue: t.usd_value, timestamp: t.traded_at }));
    for (const m of matchWalletRotations(asTrades)) if (m.buyAt >= since) matches.push(m);
  }

  const directed = buildDirectedFronts(matches);
  const labels = new Map(rows.filter((r) => r.wallet_label).map((r) => [r.wallet, r.wallet_label]));

  return netFronts(directed)
    .filter((f) => f.netUsd !== 0)
    .map((f) => {
      const { from, to } = f.direction;
      const pairMatches = matches.filter((m) => m.fromChain === from && m.toChain === to);
      const walletIds = [...new Set(pairMatches.map((m) => m.wallet))];
      const wallets: FrontWallet[] = walletIds.map((w) => {
        const trades = byWallet.get(w) ?? [];
        const sells = trades.filter((t) => t.chain === from && t.side === 'sell' && t.traded_at >= since - 12 * 60 * 60_000);
        const buys = trades.filter((t) => t.chain === to && t.side === 'buy' && t.traded_at >= since);
        return {
          wallet: w,
          label: labels.get(w) ?? null,
          soldUsd: sells.reduce((s, t) => s + t.usd_value, 0),
          boughtUsd: buys.reduce((s, t) => s + t.usd_value, 0),
          soldTokens: [...new Set(sells.map((t) => t.token_symbol).filter((s): s is string => !!s))].slice(0, 5),
          boughtTokens: [...new Set(buys.map((t) => t.token_symbol).filter((s): s is string => !!s))].slice(0, 5),
        };
      }).sort((a, b) => b.boughtUsd - a.boughtUsd);
      // Symbols → addresses on the chain they traded on; the biggest trade wins a tie.
      const refs = new Map<string, TokenRef & { usd: number }>();
      for (const w of walletIds) for (const t of byWallet.get(w) ?? []) {
        const relevant = (t.chain === from && t.side === 'sell') || (t.chain === to && t.side === 'buy');
        if (!relevant || !t.token_symbol || !t.token_address) continue;
        const k = `${t.chain}:${t.token_symbol}`, cur = refs.get(k);
        if (!cur || t.usd_value > cur.usd) refs.set(k, { symbol: t.token_symbol, chain: t.chain, address: t.token_address, usd: t.usd_value });
      }
      const tokenRefs = [...refs.values()].map(({ symbol, chain, address }) => ({ symbol, chain, address }));
      return {
        from, to,
        netUsd: Math.abs(f.netUsd),
        grossForward: from === f.chainA ? f.grossAtoB : f.grossBtoA,
        grossBack: from === f.chainA ? f.grossBtoA : f.grossAtoB,
        confidence: f.confidence,
        walletCount: wallets.length,
        inferred: f.inferred,
        wallets,
        tokenRefs,
      };
    })
    .filter((f) => f.walletCount >= 2)
    .sort((a, b) => b.netUsd - a.netUsd);
}

// ---------------------------------------------------------------------------
// Forecast
// ---------------------------------------------------------------------------

export interface PressureForecast {
  chain: string;
  horizonHours: number;
  stepMinutes: number;
  history: Array<{ t: number; cpi: number }>;
  points: Array<{ t: number; forecast: number; low80: number; high80: number }>;
  alpha: number;
  beta: number;
  /** In-sample one-step MAPE — the forecast's own track record, shown next
   *  to it. null when there isn't enough history to have one. */
  mape: number | null;
  sampleSize: number;
  /** Too little history to forecast honestly — the UI shows this instead
   *  of a fan built on three points. */
  insufficient: boolean;
}

/** Fewer snapshots than this and a fitted trend is noise, not a forecast. */
const MIN_FORECAST_HISTORY = 12;

/**
 * 24h Holt forecast of blended CPI. Steps are the scanner cadence (the
 * median gap between snapshots), so the horizon in steps is 24h / cadence.
 * Forecast values are clamped to CPI's own 0-100 range — a linear trend
 * extrapolated past 100 is an artifact of the model, not a reading.
 */
export function pressureForecast(chain: string, horizonHours = 24, now = Date.now(), view: PressureView = 'private'): PressureForecast {
  const source = sourceFor(chain, view);
  const history = source ? cpiSeries(chain, source, now - 7 * DAY) : [];
  const gaps = history.slice(1).map((p, i) => p.t - history[i].t).sort((a, b) => a - b);
  const stepMs = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 30 * 60_000;
  const base = {
    chain, horizonHours, stepMinutes: Math.round(stepMs / 60_000), history,
    sampleSize: history.length,
  };
  if (history.length < MIN_FORECAST_HISTORY) {
    return { ...base, points: [], alpha: 0, beta: 0, mape: null, insufficient: true };
  }
  const values = history.map((p) => p.cpi);
  const steps = Math.max(1, Math.round((horizonHours * 60 * 60_000) / stepMs));
  const { fit, points } = holtForecast(values, steps);
  const clamp = (v: number) => Math.min(100, Math.max(0, v));
  const lastT = history.at(-1)!.t;
  return {
    ...base,
    points: points.map((p) => ({
      t: lastT + p.step * stepMs, forecast: clamp(p.forecast), low80: clamp(p.low80), high80: clamp(p.high80),
    })),
    alpha: fit.alpha,
    beta: fit.beta,
    mape: mape(values, fit.fitted),
    insufficient: false,
  };
}

// ---------------------------------------------------------------------------
// Scan status
// ---------------------------------------------------------------------------

export function scanStatus() {
  const db = getDb();
  const last = db.prepare('SELECT * FROM scan_runs WHERE finished_at IS NOT NULL ORDER BY id DESC LIMIT 1').get() as
    | { started_at: number; finished_at: number; chains_scored: number; trades_added: number; credits: number; error: string | null }
    | undefined;
  const runs = (db.prepare('SELECT COUNT(*) AS n FROM scan_runs WHERE finished_at IS NOT NULL').get() as { n: number }).n;
  const trades = (db.prepare('SELECT COUNT(*) AS n FROM smart_money_trades').get() as { n: number }).n;
  return { runs, trades, last: last ?? null };
}

export interface StormTick {
  chain: string;
  tokenAddress: string;
  symbol: string | null;
  score: number;
  band: 'clear' | 'cloudy' | 'watch' | 'warning';
  confidence: number;
  missing: string[];
  source: 'page' | 'sweep';
  computedAt: number;
  /** Nansen's logo URL, remembered from the token's page (P4); null if never seen. */
  logo: string | null;
}

/** The home ticker: the latest Storm Score of every token scored in the
 *  last 48h (token page views and the scanner's sweep), highest first. */
export function stormTicker(limit = 12, now = Date.now()): StormTick[] {
  const rows = (getDb().prepare(`
    SELECT s.chain, s.token_address, s.symbol, s.score, s.band, s.confidence, s.missing, s.source, s.computed_at
    FROM storm_scores s
    JOIN (SELECT MAX(id) AS id FROM storm_scores WHERE computed_at >= ? GROUP BY chain, token_address) m ON m.id = s.id
    ORDER BY s.score DESC LIMIT ?
  `).all(now - 48 * 3_600_000, limit * 3) as Array<{ chain: string; token_address: string; symbol: string | null; score: number; band: StormTick['band']; confidence: number; missing: string; source: StormTick['source']; computed_at: number }>)
    .filter((r) => isRiskListable(r.symbol)).slice(0, limit);
  const logos = tokenLogos(rows.map((r) => ({ chain: r.chain, address: r.token_address })));
  return rows.map((r) => ({
    chain: r.chain, tokenAddress: properAddress(r.chain, r.token_address), symbol: r.symbol, score: r.score, band: r.band,
    confidence: r.confidence, missing: JSON.parse(r.missing) as string[], source: r.source, computedAt: r.computed_at,
    logo: logoOf(logos, r.chain, r.token_address),
  }));
}

export interface WalletRotation { from: string; to: string; soldUsd: number; boughtUsd: number; soldTokens: string[]; boughtTokens: string[]; flowNetUsd: number; flowWallets: number }

/**
 * P4: the capital rotations one wallet took part in over the window —
 * its own sells and buys inside each chain-to-chain flow it helped form.
 * Built from the owner's stored smart-money trades (owner view only).
 */
export function walletRotations(address: string, hours = 168, now = Date.now()): WalletRotation[] {
  const a = address.toLowerCase();
  return rotationFronts(hours, now).flatMap((f) => {
    const w = f.wallets.find((x) => x.wallet.toLowerCase() === a);
    return w ? [{ from: f.from, to: f.to, soldUsd: w.soldUsd, boughtUsd: w.boughtUsd, soldTokens: w.soldTokens, boughtTokens: w.boughtTokens, flowNetUsd: f.netUsd, flowWallets: f.walletCount }] : [];
  });
}
