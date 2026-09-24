import { describe, it, expect } from 'vitest';
import { closedBy, entryAndPath } from './replay';

const H = 3_600_000, T = 1_800_000_000_000;
const series = [-3, -2, -1, 0, 1, 2].map((k) => ({ t: T + k * H, c: 100 + k }));

describe('Time Machine cut (no look-ahead)', () => {
  it('only candles that finished by T are visible; the candle containing T is not', () => {
    expect(closedBy(series, T, H).map((x) => x.c)).toEqual([97, 98, 99]);
    expect(closedBy(series, T + H / 2, H).map((x) => x.c)).toEqual([97, 98, 99]); // T+30m: the T candle is still open
  });
  it('entry is the last close known at T; the path starts at T and stops before the due time', () => {
    const r = entryAndPath(series, T, T + 2 * H, H)!;
    expect(r.entry).toEqual({ t: T - H, c: 99 });
    expect(r.path.map((x) => x.c)).toEqual([100, 101]);
  });
  it('no candle closed before T means no replay', () => {
    expect(entryAndPath(series, T - 3 * H, T, H)).toBeNull();
  });
  it('withholds the candle still forming at the outcome boundary and invalid values', () => {
    expect(entryAndPath(series, T, T + 1.5 * H, H)?.path.map((x) => x.c)).toEqual([100]);
    expect(closedBy([{ t: T - H, c: Infinity }, { t: NaN, c: 1 }], T, H)).toEqual([]);
  });
});
