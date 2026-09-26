// Token price candles at any range: each range picks the Nansen OHLCV
// resolution that gives a readable number of candles (1 credit a call, cached).
import { traced } from '@/server/nansen/traced';
import { requestDay } from '@/server/nansen/demo';
import { endpointUnavailable } from '@/lib/registry';
import type { TokenOHLCVResponse } from '@/types/nansen/token-god-mode';
import type { Candle } from '@/server/token/waves';

export const RANGES = {
  '1H': { timeframe: '1m', days: 1, keepMs: 3_600_000 },
  '4H': { timeframe: '5m', days: 1, keepMs: 4 * 3_600_000 },
  '1D': { timeframe: '15m', days: 1, keepMs: 86_400_000 },
  '1W': { timeframe: '1h', days: 7, keepMs: 7 * 86_400_000 },
  '1M': { timeframe: '4h', days: 30, keepMs: 30 * 86_400_000 },
  '3M': { timeframe: '1d', days: 90, keepMs: 90 * 86_400_000 },
  '1Y': { timeframe: '1d', days: 365, keepMs: 365 * 86_400_000 },
} as const;
export type Range = keyof typeof RANGES;

export async function tokenCandles(chain: string, token: string, range: Range): Promise<{ candles: Candle[]; timeframe: string } | { unavailable: string }> {
  const gap = endpointUnavailable('tgmTokenOhlcv', chain, 'Price candles');
  if (gap) return { unavailable: gap };
  const r = RANGES[range];
  // The request takes whole days; short ranges read today (and yesterday for the day's first hours) and trim.
  const body = { chain, token_address: token, timeframe: r.timeframe, date: { from: requestDay(Math.max(1, r.days)), to: requestDay(-1) } };
  const res = await traced<TokenOHLCVResponse>('tgm/token-ohlcv', body, 1);
  const all: Candle[] = res.data.data
    .filter((x) => x.open != null && x.high != null && x.low != null && x.close != null && x.close > 0)
    .map((x) => ({ t: Date.parse(x.interval_start), o: x.open!, h: x.high!, l: x.low!, c: x.close!, v: x.volume_usd ?? 0 }))
    .sort((a, b) => a.t - b.t);
  const end = all.at(-1)?.t ?? Date.now();
  const candles = all.filter((k) => k.t >= end - r.keepMs);
  return candles.length ? { candles, timeframe: r.timeframe } : { unavailable: `Nansen returned no ${r.timeframe} candles for this range.` };
}
