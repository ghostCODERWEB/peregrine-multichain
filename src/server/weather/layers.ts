// Home layers read existing observations only: polling never bills Nansen.
import { perpBoard } from '@/server/perps/board';
import { sectorWeather } from '@/server/sectors/weather';
import { readCache, cacheKey } from '@/server/nansen/cache';
import { fixtureMode, replayFixture } from '@/server/nansen/demo';
import { categoryHeat } from '@/lib/models/predict';
import type { PressureView } from './queries';
import type { Provenance } from '@/lib/provenance';

export interface LayerReading {
  name: string;
  score: number | null;
  value: number | null;
  /** Where this reading's own detail lives. */
  href?: string;
  /** Overview only: shown on very wide screens. */
  wide?: boolean;
}
export interface WeatherLayer {
  id: 'perps' | 'sectors' | 'predictions';
  title: string;
  metric: string;
  description: string;
  href: string;
  at: number | null;
  recorded: boolean;
  readings: LayerReading[];
  unavailable: string | null;
  provenance: Provenance | null;
}
const finite = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function predictionReadings(raw: unknown): LayerReading[] {
  const data = raw && typeof raw === 'object' && 'data' in raw ? raw.data : null;
  if (!Array.isArray(data)) return [];
  return data
    .flatMap((r) => {
      if (!r || typeof r !== 'object' || typeof r.category !== 'string') return [];
      const volume24h = finite(r.total_volume_24hr);
      const volume1w = finite(r.total_volume_1wk);
      if (volume24h == null || volume24h < 0 || volume1w == null || volume1w <= 0) return [];
      return [
        {
          name: r.category,
          score: categoryHeat({ volume24h, volume1w, openInterest: finite(r.total_open_interest) }).weather,
          value: volume24h,
          href: `/predict?q=${encodeURIComponent(r.category)}`,
        },
      ];
    })
    .sort((a, b) => b.value - a.value);
}

export function weatherLayers(view: PressureView, now = Date.now()): WeatherLayer[] {
  const perps = perpBoard(view, now);
  const sectors = sectorWeather(view, now);
  const recorded = fixtureMode() === 'replay';
  const body = { pagination: { page: 1, per_page: 60 } };
  // Only this attributed, non-wallet endpoint uses the shared operator cache.
  // Never inspect or merge member cache partitions.
  let prediction = readCache<unknown>('prediction-market/categories', body);
  if (recorded) {
    try {
      prediction = { value: replayFixture('prediction-market/categories', body), fetchedAt: 0 };
    } catch {
      prediction = null;
    }
  }
  return [
    {
      id: 'perps',
      title: 'Perp flow',
      metric: 'Open interest',
      href: '/perps',
      at: perps.at,
      recorded,
      provenance: perps.provenance,
      description:
        'The 24 largest Hyperliquid markets by open interest, scored from taker flow and funding. Above 50, buyers are paying up to hold longs; below, shorts are. Positioning, not a price forecast.',
      readings: [...perps.coins]
        .sort((a, b) => (b.openInterest ?? 0) - (a.openInterest ?? 0))
        .slice(0, 24)
        .map((c) => ({ name: c.symbol, score: c.ppi, value: c.openInterest, href: `/perps/${encodeURIComponent(c.symbol)}` })),
      unavailable: perps.unavailable,
    },
    {
      id: 'sectors',
      title: 'Sector flow',
      metric: '24h net flow',
      href: '/sectors',
      at: sectors.at,
      recorded,
      provenance: sectors.provenance,
      description: `24-hour ${sectors.source === 'smart-money' ? 'smart-money' : 'all-trader'} net flow into each Nansen sector, scored against its own week (against other sectors until it has enough history). A token can sit in more than one sector.`,
      readings: [...sectors.sectors]
        .sort((a, b) => Math.abs(b.pressure - 50) - Math.abs(a.pressure - 50))
        .map((s) => ({ name: s.sector, score: s.pressure, value: s.netFlow24hUsd, href: `/sectors/${encodeURIComponent(s.sector)}` })),
      unavailable: sectors.unavailable,
    },
    {
      id: 'predictions',
      title: 'Prediction activity',
      metric: '24h volume',
      href: '/predict',
      at: prediction?.fetchedAt || null,
      recorded,
      provenance: {
        title: 'Prediction category activity',
        formula: 'heat = 24h volume / (1-week volume / 7); index = 50 + 50*tanh(ln heat)',
        inputs: [{ label: 'Population', value: 'First 60 categories, usable volume observations only' }],
        calls: [
          {
            endpoint: 'prediction-market/categories',
            body,
            credits: 1,
            ref: recorded ? 'fixtures/prediction-market-categories.json' : cacheKey('prediction-market/categories', body),
          },
        ],
        notes: [
          'Reading this cached layer costs zero credits. Categories overlap; do not sum them.',
          'Activity is not directional capital flow or implied probability.',
        ],
      },
      description:
        'Trading activity per Polymarket category: today\'s volume against its average day this week. 50 is a normal day; it says nothing about which outcome is favoured.',
      readings: predictionReadings(prediction?.value),
      unavailable: prediction
        ? null
        : 'No fresh shared category observation: the 15-minute cache is empty or expired. Load it here, or open Predictions. Member-key responses stay isolated.',
    },
  ];
}
