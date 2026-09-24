// Time Machine (L3): cut a candle series at a past moment T without look-ahead.
// A candle starting at t covers [t, t + tf); its close is only known at t + tf,
// so the price "at T" is the close of the last candle that finished by T.
export type CandlePoint = { t: number; c: number };

/** Candles fully closed at or before T: what a trader could have seen then. */
export function closedBy(candles: CandlePoint[], T: number, tfMs: number): CandlePoint[] {
  return candles.filter((x) => Number.isFinite(x.t) && Number.isFinite(x.c) && x.t + tfMs <= T && x.c > 0).sort((a, b) => a.t - b.t);
}

/** Entry (last close known at T) and the path after T up to the due time. */
export function entryAndPath(candles: CandlePoint[], T: number, dueAt: number, tfMs: number): { entry: CandlePoint; path: CandlePoint[] } | null {
  const before = closedBy(candles, T, tfMs);
  const entry = before.at(-1);
  if (!entry) return null;
  return { entry, path: closedBy(candles, dueAt, tfMs).filter((x) => x.t >= T) };
}

export const REPLAYS = { '1h': 3_600_000, '24h': 86_400_000, '7d': 7 * 86_400_000 } as const;
export type ReplayAt = keyof typeof REPLAYS;
