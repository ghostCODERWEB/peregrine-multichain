import { describe, expect, it } from 'vitest';
import { binomTwoSided, buildEpisodes, fdrSurvivors, phi, precedenceEdges, walletStats, type Buy } from './cascade';

const M = 60_000;
const buy = (wallet: string, token: string, at: number, usd = 1000): Buy => ({ wallet, label: null, token, chain: 'solana', symbol: token, at, usd });

describe('cascade model', () => {
  it('orders first buys per token and ranks them 0..1', () => {
    const eps = buildEpisodes([buy('A', 't1', 0), buy('B', 't1', 10 * M), buy('C', 't1', 20 * M), buy('A', 't1', 30 * M, 500)]);
    expect(eps).toHaveLength(1);
    expect(eps[0].entries.map((e) => [e.wallet, e.r])).toEqual([['A', 0], ['B', 0.5], ['C', 1]]);
    expect(eps[0].entries[0].usd).toBe(1500); // repeat buys add to the first entry
  });

  it('drops tokens with too few wallets and buys outside the window', () => {
    expect(buildEpisodes([buy('A', 't', 0), buy('B', 't', 1 * M)])).toHaveLength(0);
    expect(buildEpisodes([buy('A', 't', 0), buy('B', 't', 1 * M), buy('C', 't', 100 * 3_600_000)])).toHaveLength(0);
  });

  it('flags a wallet that is first in every episode as a leader', () => {
    const buys: Buy[] = [];
    for (let t = 0; t < 8; t++) ['L', 'x' + t, 'y' + t, 'z' + t].forEach((w, i) => buys.push(buy(w, 'tok' + t, i * 10 * M)));
    const s = walletStats(buildEpisodes(buys));
    const L = s.find((w) => w.wallet === 'L')!;
    expect(L.role).toBe('leader');
    expect(L.firsts).toBe(8);
    expect(L.p).toBeLessThan(0.01);
  });

  it('finds a significant A→B precedence edge', () => {
    const buys: Buy[] = [];
    for (let t = 0; t < 8; t++) { buys.push(buy('A', 'k' + t, 0), buy('B', 'k' + t, 30 * M), buy('C' + t, 'k' + t, 60 * M)); }
    const e = precedenceEdges(buildEpisodes(buys));
    expect(e[0]).toMatchObject({ from: 'A', to: 'B', wins: 8, n: 8 });
    expect(e[0].medianGapMin).toBe(30);
  });

  it('statistics behave', () => {
    expect(phi(0)).toBeCloseTo(0.5, 5);
    expect(phi(1.96)).toBeCloseTo(0.975, 3);
    expect(binomTwoSided(8, 8)).toBeCloseTo(2 / 256, 6);
    expect(binomTwoSided(4, 8)).toBe(1);
    expect(fdrSurvivors([0.001, 0.01, 0.5, 0.9], 0.1)).toBe(2);
  });
});
