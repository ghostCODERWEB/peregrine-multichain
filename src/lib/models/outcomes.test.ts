import { describe, it, expect } from 'vitest';
import { outcomeBoard } from './outcomes';

const m = (id: string, price: number | null, change1d: number | null, negRisk = true) => ({ id, question: id, price, change1d, volume24h: 1, openInterest: 1, negRisk });

describe('event outcomes', () => {
  it('orders outcomes, normalises shares and reports the round gap for exclusive events', () => {
    const b = outcomeBoard([m('a', 0.3, 0.05), m('b', 0.62, -0.12), m('c', 0.12, 0.01)]);
    expect(b.outcomes.map((o) => o.id)).toEqual(['b', 'a', 'c']);
    expect(b.sumYes).toBeCloseTo(1.04);
    expect(b.roundGap).toBeCloseTo(0.04);
    expect(b.outcomes[0].share).toBeCloseTo(0.62 / 1.04);
    expect(b.biggestMove?.id).toBe('b');
    expect(b.leader?.id).toBe('b');
  });
  it('does not claim a round gap for independent markets', () => {
    expect(outcomeBoard([m('a', 0.3, null, false), m('b', 0.9, null, false)]).roundGap).toBeNull();
    expect(outcomeBoard([m('a', 0.5, null)]).roundGap).toBeNull();
  });
});
