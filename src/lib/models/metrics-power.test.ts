import { describe, it, expect } from 'vitest';
import { requiredObservations, aucInterval } from './metrics';

describe('required observations', () => {
  it('finds the smallest sample whose AUC lower bound clears the floor', () => {
    const r = requiredObservations(0.7, 0.6, 0.042)!;
    const pos = Math.round(r.n * 0.042);
    expect(aucInterval(0.7, pos, r.n - pos)![0]).toBeGreaterThanOrEqual(0.6);
    const pos2 = Math.round((r.n - 20) * 0.042);
    expect(aucInterval(0.7, pos2, r.n - 20 - pos2)![0]).toBeLessThan(0.6);
    expect(r.events).toBeGreaterThan(30);
  });

  it('needs fewer observations for a commoner event', () => {
    expect(requiredObservations(0.7, 0.6, 0.15)!.n).toBeLessThan(requiredObservations(0.7, 0.6, 0.042)!.n);
  });

  it('refuses nonsense', () => {
    expect(requiredObservations(0.6, 0.6, 0.1)).toBeNull();
    expect(requiredObservations(0.7, 0.6, 0)).toBeNull();
  });
});
