import { describe, it, expect } from 'vitest';
import { spotGrade, perpGrade, predictGrade, overallGrade } from './trader-grade';

describe('trader grades', () => {
  it('grades a profitable, frequent winner above a loser', () => {
    const good = spotGrade({ realizedUsd: 250_000, realizedPct: 0.4, winRate: 0.65, exits: 80 })!;
    const bad = spotGrade({ realizedUsd: -90_000, realizedPct: -0.3, winRate: 0.3, exits: 80 })!;
    expect(good.tone).toBe('good');
    expect(bad.tone).toBe('bad');
    expect(good.score).toBeGreaterThan(bad.score);
  });
  it('gives no grade on too few trades', () => {
    expect(spotGrade({ realizedUsd: 1e6, realizedPct: 5, winRate: 1, exits: 2 })).toBeNull();
    expect(perpGrade({ closedTrades: 1, winRate: 1, profitFactor: 9, realizedPnl: 1e5 })).toBeNull();
    expect(predictGrade(null)).toBeNull();
  });
  it('rewards a high profit factor on perps', () => {
    const a = perpGrade({ closedTrades: 40, winRate: 0.5, profitFactor: 3, realizedPnl: 50_000 })!.score;
    const b = perpGrade({ closedTrades: 40, winRate: 0.5, profitFactor: 0.5, realizedPnl: 50_000 })!.score;
    expect(a).toBeGreaterThan(b);
  });
  it('weights the overall grade by activity, within 0 to 100', () => {
    const big = { score: 80, verdict: '', tone: 'good' as const, basis: '' }, small = { score: 20, verdict: '', tone: 'bad' as const, basis: '' };
    expect(overallGrade([{ grade: big, weight: 9 }, { grade: small, weight: 1 }])!.score).toBe(74);
    expect(overallGrade([{ grade: null, weight: 5 }])).toBeNull();
  });
});
