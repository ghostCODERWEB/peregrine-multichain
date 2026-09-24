import { describe, it, expect } from 'vitest';
import { gradeCall, invalidationProblem, traderDna, HORIZONS } from './calls';

const T0 = 1_800_000_000_000, H = 3_600_000;
const path = (...closes: number[]) => closes.map((c, i) => ({ t: T0 + (i + 1) * 5 * 60_000, c }));
const call = (o: Partial<Parameters<typeof gradeCall>[0]> = {}) => ({ stance: 'bull' as const, entry: 1, invalidation: null, createdAt: T0, dueAt: T0 + H, band: HORIZONS['1h'].band, ...o });

describe('call grading', () => {
  it('grades a bull call by the last close before the due time', () => {
    expect(gradeCall(call(), path(1.005, 1.02))).toMatchObject({ grade: 'won', exit: 1.02, candles: 2 });
    expect(gradeCall(call(), path(0.99, 0.98))).toMatchObject({ grade: 'lost' });
    expect(gradeCall(call(), path(1.02, 1.004))).toMatchObject({ grade: 'too-early', best: expect.closeTo(0.02, 6) });
  });
  it('mirrors a bear call', () => {
    expect(gradeCall(call({ stance: 'bear' }), path(0.98))).toMatchObject({ grade: 'won' });
    expect(gradeCall(call({ stance: 'bear' }), path(1.02))).toMatchObject({ grade: 'lost' });
  });
  it('invalidation takes precedence, even if the price recovers', () => {
    const r = gradeCall(call({ invalidation: 0.97 }), path(0.96, 1.05));
    expect(r).toMatchObject({ grade: 'invalidated', invalidatedAt: T0 + 5 * 60_000 });
    expect(gradeCall(call({ stance: 'bear', invalidation: 1.03 }), path(1.04, 0.9))?.grade).toBe('invalidated');
  });
  it('a pass is right when nothing decisive happened', () => {
    expect(gradeCall(call({ stance: 'pass' }), path(1.004))?.grade).toBe('won');
    expect(gradeCall(call({ stance: 'pass' }), path(0.95))?.grade).toBe('lost');
  });
  it('ignores candles before the call or at and after the due time; no candles means not gradable yet', () => {
    const cs = [{ t: T0 - 1, c: 5 }, ...path(1.02), { t: T0 + H, c: 0.5 }];
    expect(gradeCall(call(), cs)).toMatchObject({ grade: 'won', exit: 1.02 });
    expect(gradeCall(call(), [])).toBeNull();
    expect(gradeCall(call({ entry: 0 }), path(1))).toBeNull();
  });
  it('checks the invalidation side', () => {
    expect(invalidationProblem('bull', 1, 0.9)).toBeNull();
    expect(invalidationProblem('bull', 1, 1.1)).toMatch('below');
    expect(invalidationProblem('bear', 1, 0.9)).toMatch('above');
    expect(invalidationProblem('pass', 1, 0.9)).toMatch('no invalidation');
    expect(invalidationProblem('bull', 1, null)).toBeNull();
  });
  it('trader DNA: hit rate on decisive outcomes only, too-early kept apart', () => {
    const cs = [
      { setup: 'rotation', grade: 'won' as const, stance: 'bull' as const, ret: 0.05 },
      { setup: 'rotation', grade: 'lost' as const, stance: 'bear' as const, ret: 0.04 },
      { setup: 'rotation', grade: 'too-early' as const, stance: 'bull' as const, ret: 0.01 },
      { setup: 'other', grade: null, stance: 'bull' as const, ret: null },
    ];
    expect(traderDna(cs, (c) => c.setup)).toEqual([{ key: 'rotation', n: 3, won: 1, lost: 1, tooEarly: 1, invalidated: 0, hitRate: 0.5, avgMove: expect.closeTo((0.05 - 0.04 + 0.01) / 3, 6) }]);
  });
});
