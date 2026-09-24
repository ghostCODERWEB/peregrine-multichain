import { describe, it, expect } from 'vitest';
import { directionGauge, confidenceGauge, coordinationGauge, falsifiers, informedNet, type Rings, type GaugeInputs } from './gauges';
import { WIND_SEGMENTS, WIND_TIMEFRAMES } from '@/lib/wind';

const rings = (net: Partial<Record<string, number>>, wallets = 10): Rings =>
  Object.fromEntries(WIND_TIMEFRAMES.map((tf) => [tf, Object.fromEntries(WIND_SEGMENTS.map((s) => [s, { netUsd: net[`${tf}:${s}`] ?? null, wallets: s === 'exchange' || s === 'fresh_wallets' ? null : wallets }]))])) as Rings;
const base = (o: Partial<GaugeInputs> = {}): GaugeInputs => ({
  rings: rings({ '1d:smart_trader': 30_000, '1d:whale': 20_000, '6h:smart_trader': 5_000, '1h:whale': 1_000, '7d:top_pnl': 90_000, '1d:exchange': -40_000 }),
  liquidityUsd: 1_000_000, volume24hUsd: 5_000_000, buyVolumeUsd: 2_000_000, sellVolumeUsd: 3_000_000,
  clusters: [{ share: 0.06, wallets: 3, includesDeployer: true }, { share: 0.2, wallets: 1, includesDeployer: false }], clusteredHolderCount: 3, comparedHolders: 25, ...o,
});

describe('three gauges, never one score', () => {
  it('direction: informed 1d net against 5% of liquidity, with the crowd shown apart', () => {
    const d = directionGauge(base());
    expect(informedNet(base().rings!, '1d')).toBe(50_000);
    expect(d.value).toBe(Math.round(100 * Math.tanh(50_000 / 50_000)));
    expect(d.label).toBe('informed buying');
    expect(d.reasons).toEqual(['Smart traders +$30K in 1d', 'Whales +$20K in 1d', 'All DEX traders: sells lead 20% of volume', 'Exchanges −$40K in 1d']);
    expect(directionGauge(base({ liquidityUsd: null })).parts[1].note).toMatch('volume');
    expect(directionGauge(base({ rings: null })).value).toBeNull();
  });
  it('confidence: four visible parts, missing ones count as zero', () => {
    const c = confidenceGauge(base());
    expect(c.parts.map((p) => p.label)).toEqual(['Sample', 'Agreement', 'Depth', 'Recency']);
    expect(c.parts[1].value).toBe(1); // 1h, 6h, 7d all on the 1d side
    expect(c.parts[2].value).toBeCloseTo(2 / 3, 6); // $1M on the $10K–$10M log scale
    const thin = confidenceGauge(base({ liquidityUsd: null, rings: rings({ '1d:whale': 10_000 }, 0) }));
    expect(thin.value).toBe(0);
    expect(thin.reasons[0]).toMatch('Missing: sample, agreement, depth, recency');
  });
  it('coordination: linked supply (20% = full) or linked holders, whichever is larger; single-wallet clusters ignored', () => {
    const g = coordinationGauge(base());
    expect(g.value).toBe(30); // 6% ÷ 20% = 0.30 > 3/25
    expect(g.reasons).toContain('A cluster includes the deployer');
    expect(coordinationGauge(base({ clusteredHolderCount: 15 })).value).toBe(60);
    expect(coordinationGauge(base({ clusters: null })).value).toBeNull();
  });
  it('falsifiers: written for the side the flows point to, from the data, at most three', () => {
    const i = base();
    const f = falsifiers(i, directionGauge(i), { mark: 1, below: { price: 0.9, usd: 2_000_000 }, above: { price: 1.3, usd: 1 } });
    expect(f.map((x) => x.source)).toEqual(['wind', 'leverage', 'forensics']);
    expect(f[0].text).toBe('Informed 6h flow turns negative (now +$5K).');
    expect(f[1].text).toBe('Price reaches $0.9000 (-10%), the densest band where $2.0M of longs would be forced to sell.');
    expect(f[2].text).toBe('Linked holders with 6.0% of supply start selling together.');
    const selling = base({ rings: rings({ '1d:whale': -80_000, '6h:whale': -4_000 }), clusters: [] });
    expect(falsifiers(selling, directionGauge(selling), null).map((x) => x.text)).toEqual(['Informed 6h flow turns positive (now −$4K).']);
    const turning = base({ rings: rings({ '1d:whale': -80_000, '6h:whale': 78_000 }), clusters: [] });
    expect(falsifiers(turning, directionGauge(turning), null)[0]).toEqual({ source: 'wind', active: true, text: 'Already happening: informed 6h flow is positive (+$78K) against the 1d selling.' });
    const flat = base({ rings: rings({ '1d:whale': 1_000 }), clusters: [] });
    expect(falsifiers(flat, directionGauge(flat), null)[0].text).toMatch('standing aside stops being right');
  });
  it('the crowd diverging from informed flow becomes a falsifier when there is room', () => {
    const i = base({ clusters: [] });
    const f = falsifiers(i, directionGauge(i), null);
    expect(f.map((x) => x.source)).toEqual(['wind', 'header']);
    expect(f[1].text).toBe('The crowd keeps selling against informed flow (20% sell-led today).');
  });
});
