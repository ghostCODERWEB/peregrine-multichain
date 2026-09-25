// The whole home-page payload in one place: the map, the fronts, and the
// forecast strip, each with its ⓘ provenance. The home page renders it
// server-side; /api/weather serves the same object as JSON for polling and
// for other agents.
import { weatherMap, rotationFronts, pressureForecast, scanStatus, stormTicker, type PressureView, type ChainWeather, type Front, type PressureForecast, type StormTick } from './queries';
import { getDb } from '@/server/nansen/db';
import { cpiProvenance, frontProvenance, forecastProvenance } from './provenance';
import type { Provenance } from '@/lib/provenance';
import { weatherLayers, type WeatherLayer } from './layers';
import { inferredWeather } from './inferred';

export interface ChainTile extends ChainWeather { provenance: Provenance | null }
export interface FrontWithProvenance extends Front { provenance: Provenance }
export interface ForecastWithProvenance extends PressureForecast { provenance: Provenance }

export interface WeatherBulletin {
  generatedAt: number;
  layers?: WeatherLayer[];
  inference?: ReturnType<typeof inferredWeather>;
  chains: ChainTile[];
  fronts: FrontWithProvenance[];
  forecasts: ForecastWithProvenance[];
  storms: StormTick[];
  /** Which view this bulletin was built for; public withholds fronts. */
  mode: PressureView;
  withheld: string[];
  scan: ReturnType<typeof scanStatus>;
}

/** Forecast strip: the ten chains with the most pressure (furthest from
 *  neutral 50, either direction) — that's where a forecast is news. */
const FORECAST_COUNT = 10;

export function buildBulletin(mode: PressureView = 'private', now = Date.now()): WeatherBulletin {
  const chains = weatherMap(now, mode).map((c) => ({ ...c, provenance: cpiProvenance(c) }));
  // Fronts are built from smart-money DEX trades, which Nansen prohibits in
  // public views; public pressure is all-trader flow instead.
  const fronts = mode === 'private' ? rotationFronts(24, now).map((f) => ({ ...f, provenance: frontProvenance(f) })) : [];
  const forecasts = chains
    .filter((c) => c.cpi != null)
    .sort((a, b) => Math.abs(b.cpi! - 50) - Math.abs(a.cpi! - 50))
    .slice(0, FORECAST_COUNT)
    .map((c) => {
      const f = pressureForecast(c.chain, 24, now, mode);
      return { ...f, provenance: forecastProvenance(f) };
    });
  return { generatedAt: now, inference: inferredWeather(mode, now), layers: weatherLayers(mode, now), chains, fronts, forecasts, storms: stormTicker(12, now), mode, withheld: mode === 'public' ? ['fronts'] : [], scan: scanStatus() };
}

/** Capital-flow windows the Radar offers. */
export const FLOW_WINDOWS = [24, 48, 168] as const;
export type FlowWindow = (typeof FLOW_WINDOWS)[number];

/**
 * Chain-to-chain capital rotations over a window, for the animated flow
 * map. Built from the scanner's smart-money DEX trades, so only the key
 * owner's (private) view gets them — every other view gets null, never a
 * partial or aggregated version (Nansen's redistribution rules).
 */
export function capitalFlows(mode: PressureView, hours: number, now = Date.now()): { hours: FlowWindow; fronts: FrontWithProvenance[] } | null {
  if (mode !== 'private') return null;
  const h = (FLOW_WINDOWS as readonly number[]).includes(hours) ? (hours as FlowWindow) : 24;
  return { hours: h, fronts: rotationFronts(h, now).map((f) => ({ ...f, provenance: frontProvenance(f, h) })) };
}

/** `recorded`: false for days before the scanner's first stored trade — unknown, not quiet. */
export interface FlowDay { day: string; start: number; netUsd: number; flows: number; recorded: boolean; top: { from: string; to: string; netUsd: number } | null }
export interface FlowChainRow { chain: string; inUsd: number; outUsd: number; net: number; flows: number }

/**
 * P4: the Flows page. Rotation history day by day (each UTC day's own
 * rotations, matched within that day) and a 7-day chain leaderboard of net
 * capital rotated in vs out. Owner view only, like every rotation read.
 */
export function flowHistory(mode: PressureView, days = 7, now = Date.now()): { days: FlowDay[]; chains: FlowChainRow[] } | null {
  if (mode !== 'private') return null;
  const DAY = 86_400_000;
  const todayStart = Math.floor(now / DAY) * DAY;
  const first = (getDb().prepare('SELECT MIN(traded_at) AS t FROM smart_money_trades').get() as { t: number | null }).t;
  const out: FlowDay[] = [];
  for (let k = days - 1; k >= 0; k--) {
    const start = todayStart - k * DAY, end = Math.min(now, start + DAY);
    const f = rotationFronts((end - start) / 3_600_000, end);
    out.push({ day: new Date(start).toISOString().slice(0, 10), start, netUsd: f.reduce((s, x) => s + x.netUsd, 0), flows: f.length, recorded: first != null && first < end, top: f[0] ? { from: f[0].from, to: f[0].to, netUsd: f[0].netUsd } : null });
  }
  const week = rotationFronts(days * 24, now);
  const chains = new Map<string, FlowChainRow>();
  const row = (c: string) => chains.get(c) ?? { chain: c, inUsd: 0, outUsd: 0, net: 0, flows: 0 };
  for (const f of week) {
    const a = row(f.from); a.outUsd += f.netUsd; a.flows++; chains.set(f.from, a);
    const b = row(f.to); b.inUsd += f.netUsd; b.flows++; chains.set(f.to, b);
  }
  const list = [...chains.values()].map((r) => ({ ...r, net: r.inUsd - r.outUsd })).sort((x, y) => y.net - x.net);
  return { days: out, chains: list };
}
