// GET /api/public/forecast?chain=base — a chain's Chain Pressure Index and
// its 24h Holt forecast with track record; without ?chain, every chain.
// Read from TIDE's own scanner history: no Nansen credits per request.
import { ALL_CHAIN_IDS } from '@/lib/registry';
import { chainWeather, pressureForecast } from '@/server/weather/queries';

export const dynamic = 'force-dynamic';

function one(chain: string) {
  // Public API: all-trader pressure only (smart-money inflows are restricted).
  const w = chainWeather(chain, Date.now(), 'public');
  const f = pressureForecast(chain, 24, Date.now(), 'public');
  return {
    chain, cpi: w.cpi, band: w.band, measured_from: w.source, trend_6h: w.trend6h, updated_at: w.updatedAt,
    unavailable: w.unavailable,
    forecast_24h: f.insufficient ? null : f.points.map((p) => ({ t: p.t, cpi: p.forecast, low80: p.low80, high80: p.high80 })),
    track_record: { mape_pct: f.mape, snapshots: f.sampleSize, note: f.insufficient ? 'forecast unlocks at 12 snapshots' : 'in-sample one-step MAPE' },
  };
}

export async function GET(req: Request) {
  const chain = new URL(req.url).searchParams.get('chain');
  if (chain && !ALL_CHAIN_IDS.includes(chain)) return Response.json({ error: `Unknown chain "${chain}"` }, { status: 404 });
  return Response.json(chain ? one(chain) : { chains: ALL_CHAIN_IDS.map(one) }, { headers: { 'Access-Control-Allow-Origin': '*' } });
}
