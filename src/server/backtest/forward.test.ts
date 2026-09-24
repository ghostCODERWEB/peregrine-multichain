import { describe, it, expect } from 'vitest';
import { spearman, summarize } from './forward';

describe('forward checks', () => {
  it('rank-correlates scores with forward returns', () => {
    const up = [1, 2, 3, 4, 5, 6].map((s) => ({ score: s, fwd: s / 100 }));
    expect(spearman(up)).toBeCloseTo(1);
    expect(spearman(up.map((p) => ({ ...p, fwd: -p.fwd })))).toBeCloseTo(-1);
    expect(spearman(up.slice(0, 3))).toBeNull();
  });

  it('bands pairs by score and reports hit rate and returns', () => {
    const pairs = [{ score: 80, fwd: 0.1 }, { score: 75, fwd: -0.02 }, { score: 60, fwd: 0.01 }, { score: 40, fwd: -0.05 }, { score: 30, fwd: -0.01 }];
    const r = summarize('x', 6, pairs, [1, 2], [['70+', (s) => s >= 70], ['under 70', (s) => s < 70]], '', null);
    expect(r.bands[0]).toMatchObject({ n: 2, hitRate: 0.5 });
    expect(r.bands[0].meanReturn).toBeCloseTo(0.04);
    expect(r.baseline.n).toBe(5);
    expect(r.baseline.medianReturn).toBeCloseTo(-0.01);
  });
});
