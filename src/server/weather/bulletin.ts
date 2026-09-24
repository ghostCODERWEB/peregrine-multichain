// The whole home-page payload in one place: the map, the fronts, and the
// forecast strip, each with its ⓘ provenance. The home page renders it
// server-side; /api/weather serves the same object as JSON for polling and
// for other agents.
import { weatherMap, rotationFronts, pressureForecast, scanStatus, stormTicker, type PressureView, type ChainWeather, type Front, type PressureForecast, type StormTick } from './queries';
import { cpiProvenance, frontProvenance, forecastProvenance } from './provenance';
import type { Provenance } from '@/lib/provenance';
import { weatherLayers, type WeatherLayer } from './layers';

export interface ChainTile extends ChainWeather { provenance: Provenance | null }
export interface FrontWithProvenance extends Front { provenance: Provenance }
export interface ForecastWithProvenance extends PressureForecast { provenance: Provenance }

export interface WeatherBulletin {
  generatedAt: number;
  layers?: WeatherLayer[];
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
  return { generatedAt: now, layers: weatherLayers(mode, now), chains, fronts, forecasts, storms: stormTicker(12, now), mode, withheld: mode === 'public' ? ['fronts'] : [], scan: scanStatus() };
}
