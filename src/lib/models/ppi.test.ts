import { describe, it, expect } from 'vitest';
import { takerRatio, smSkew, perpPressure, venuePressure, annualFunding, crowdingDivergence, PUBLIC_WEIGHTS, PRIVATE_WEIGHTS, MIN_HISTORY } from './ppi';

// Real BTC shape from the screener: $4.15B volume, $1.79B bought, $2.36B sold.
const btc = { volume: 4_148_798_929, buyVolume: 1_790_477_225, sellVolume: 2_358_321_703, funding: 0.0000053881 };

describe('perp pressure inputs', () => {
  it('taker ratio is net buying over volume, floored', () => {
    expect(takerRatio(btc)!).toBeCloseTo(-0.1369, 3);
    expect(takerRatio({ volume: 10, buyVolume: 10, sellVolume: 0, funding: 0 })).toBeCloseTo(10 / 50_000);
    expect(takerRatio({ volume: 1, buyVolume: null, sellVolume: 1, funding: 0 })).toBeNull();
  });

  it('smart-money skew reads shorts as a size, and needs a real book', () => {
    // Nansen returns shorts as a negative USD number.
    expect(smSkew({ ...btc, smLongsUsd: 86_670_052, smShortsUsd: -40_849_449 })!).toBeCloseTo(0.359, 3);
    expect(smSkew({ ...btc, smLongsUsd: 50_000, smShortsUsd: -10_000 })).toBeNull();
    expect(smSkew(btc)).toBeNull();
  });

  it('annualizes hourly funding the way Hyperliquid shows it', () => {
    expect(annualFunding(0.0000125)).toBeCloseTo(0.1095, 4);
  });
});

describe('perp pressure index', () => {
  const peers = { taker: [-0.1, -0.05, 0, 0.02, 0.05, 0.1], funding: [0.00001, 0.0000125, 0.0000125, 0.00002, 0.000005, 0] };

  it('is 50 when a coin sits at the middle of its peers, and says it compared against peers', () => {
    const r = perpPressure({ taker: 0.01, funding: 0.0000125 }, {}, peers, PUBLIC_WEIGHTS)!;
    expect(r.usedCrossSectional).toBe(true);
    expect(r.ppi).toBeGreaterThan(45);
    expect(r.ppi).toBeLessThan(60);
  });

  it('reads long pressure when buyers lead and longs pay up', () => {
    expect(perpPressure({ taker: 0.3, funding: 0.0001 }, {}, peers, PUBLIC_WEIGHTS)!.ppi).toBeGreaterThan(80);
    expect(perpPressure({ taker: -0.3, funding: -0.0001 }, {}, peers, PUBLIC_WEIGHTS)!.ppi).toBeLessThan(20);
  });

  it('switches to the coin\'s own history once every part has twelve readings', () => {
    const hist = { taker: Array.from({ length: MIN_HISTORY }, (_, i) => (i - 6) / 100), funding: Array.from({ length: MIN_HISTORY }, () => 0.0000125) };
    const r = perpPressure({ taker: 0.2, funding: 0.0000125 }, hist, peers, PUBLIC_WEIGHTS)!;
    expect(r.usedCrossSectional).toBe(false);
    expect(r.parts.taker!.z).toBeGreaterThan(3);
  });

  it('adds smart money in the private blend and drops parts that are missing', () => {
    const r = perpPressure({ taker: 0, funding: 0.0000125, sm: 0.9 }, {}, { ...peers, sm: [-0.5, 0, 0.1, 0.2, 0.3] }, PRIVATE_WEIGHTS)!;
    expect(r.parts.sm).toBeDefined();
    expect(r.ppi).toBeGreaterThan(55);
    const pub = perpPressure({ taker: 0, funding: null }, {}, peers, PUBLIC_WEIGHTS)!;
    expect(Object.keys(pub.parts)).toEqual(['taker']);
    expect(perpPressure({}, {}, peers, PUBLIC_WEIGHTS)).toBeNull();
  });
});

describe('venue pressure and crowding', () => {
  it('weights coins by open interest', () => {
    expect(venuePressure([{ ppi: 80, openInterest: 3e9 }, { ppi: 20, openInterest: 1e9 }, { ppi: 99, openInterest: null }])).toBe(65);
    expect(venuePressure([])).toBeNull();
  });

  it('flags the crowd paying to be long while smart money is short', () => {
    expect(crowdingDivergence(2, -0.4)).toBe('crowded-long');
    expect(crowdingDivergence(-2, 0.5)).toBe('crowded-short');
    expect(crowdingDivergence(2, 0.5)).toBeNull();
    expect(crowdingDivergence(undefined, -0.9)).toBeNull();
  });
});
