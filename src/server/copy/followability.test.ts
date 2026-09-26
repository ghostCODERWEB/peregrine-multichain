import { describe, expect, it } from 'vitest';
import { followScore } from './followability';

describe('followScore', () => {
  it('rewards winning, profitable copies an hour late', () => {
    expect(followScore(0.8, 0.2, 10)).toBeGreaterThan(70);
  });
  it('punishes copies that lose when late', () => {
    expect(followScore(0.2, -0.15, 10)).toBeLessThan(30);
  });
  it('shrinks toward 50 with few tokens', () => {
    const few = followScore(0.9, 0.3, 3), many = followScore(0.9, 0.3, 30);
    expect(Math.abs(few - 50)).toBeLessThan(Math.abs(many - 50));
  });
});
