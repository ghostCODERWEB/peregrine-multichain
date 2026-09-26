import { describe, expect, it } from 'vitest';
import { classify, reconstruct } from './hyperliquid';

const f = (time: number, side: 'A' | 'B', sz: number, start: number, px: number, pnl = 0) => ({ coin: 'BTC', px: String(px), sz: String(sz), side, time, startPosition: String(start), dir: '', closedPnl: String(pnl), hash: `h${time}`, fee: '1' });

describe('Hyperliquid fill classification', () => {
  it('labels open, add, reduce and close from the position before each fill', () => {
    const e = classify([f(1, 'B', 1, 0, 100), f(2, 'B', 2, 1, 110), f(3, 'A', 1, 3, 120, 20), f(4, 'A', 2, 2, 130, 40)]);
    expect(e.map((x) => x.kind)).toEqual(['open', 'add', 'reduce', 'close']);
    expect(e.every((x) => x.side === 'long')).toBe(true);
    expect(e[1].sizeAfter).toBe(3);
  });
  it('treats a sign change as a flip and a short open as short', () => {
    const e = classify([f(1, 'A', 2, 0, 100), f(2, 'B', 3, -2, 90)]);
    expect(e.map((x) => [x.kind, x.side])).toEqual([['open', 'short'], ['flip', 'long']]);
  });
  it('rebuilds a closed position with weighted entry, exit and realized PnL', () => {
    const [p] = reconstruct(classify([f(1, 'B', 1, 0, 100), f(2, 'B', 1, 1, 120), f(3, 'A', 2, 2, 130, 40)]));
    expect(p.avgEntry).toBe(110);
    expect(p.avgExit).toBe(130);
    expect(p.realizedPnl).toBe(40);
    expect(p.maxSize).toBe(2);
    expect(p.fees).toBe(3);
  });
  it('ignores reductions of positions opened before the history starts', () => {
    expect(reconstruct(classify([f(1, 'A', 1, 5, 100, 10)]))).toEqual([]);
  });
});
