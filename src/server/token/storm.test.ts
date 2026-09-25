import { describe, expect, it, vi } from 'vitest';
import { computeStorm, saveStorm, stormCandidates, type StormWave } from './storm';
import { concentrationScore } from '@/lib/models/storm-score';
import { WIND_SEGMENTS, WIND_TIMEFRAMES } from '@/lib/wind';
import { getDb } from '@/server/nansen/db';
import type { Provenance } from '@/lib/provenance';
import type { TokenHeader, WindWave, HoldersWave, ForensicsWave, Wave } from './waves';

const provenance: Provenance = {
  title: 'Synthetic test input', formula: 'Fixture, not live evidence', inputs: [],
  calls: [{ endpoint: 'tgm/indicators', body: {}, credits: 0 }],
};
const unavailable = { unavailable: 'No test observation' };
const header = (patch: Partial<TokenHeader> = {}): TokenHeader => ({
  name: 'Test', symbol: 'TEST', logo: null, marketCapUsd: 1_000_000, fdvUsd: null,
  liquidityUsd: 100_000, holders: 30, volume24hUsd: null, buyVolumeUsd: null,
  sellVolumeUsd: null, uniqueBuyers: null, uniqueSellers: null, deployedAt: null,
  marketCapGroup: null, isStablecoin: false, risk: [], reward: [],
  indicatorsUnavailable: null, provenance, ...patch,
});
const wind = (net: number | null = 0): WindWave => ({
  rings: Object.fromEntries(WIND_TIMEFRAMES.map(time => [time,
    Object.fromEntries(WIND_SEGMENTS.map(segment => [segment, { netUsd: net, wallets: net === null ? null : 1 }])),
  ])) as WindWave['rings'], warnings: [], provenance,
});
const holders = (patch: Partial<HoldersWave> = {}): HoldersWave => ({
  holders: [], realShares: [.4, .3, .2, .1], concentration: concentrationScore({ shares: [.4, .3, .2, .1] }),
  lorenz: [], excludedShare: 0, buyers: [{ address: '0xaaa', label: null, boughtUsd: 100, soldUsd: 0 }],
  sellers: [{ address: '0xbbb', label: null, boughtUsd: 0, soldUsd: 100 }],
  tradersUnavailable: null, provenance: { holders: provenance, traders: provenance }, ...patch,
});
const forensics: ForensicsWave = {
  nodes: [], links: [], clusters: [{ id: 0, wallets: ['0xAAA', '0xBBB'], share: .4, includesDeployer: true }],
  clusteredHolderCount: 2, deployer: '0xAAA', missingFunders: 0, provenance,
};
function score(value: Wave<StormWave>): StormWave {
  if ('unavailable' in value) throw new Error(value.unavailable);
  return value;
}

describe('Dump Risk wave assembly (no network)', () => {
  it('returns a reason, not a zero score, when every input is absent', () => {
    expect(computeStorm(unavailable, unavailable, unavailable, undefined, true)).toEqual({
      unavailable: 'Nansen returned none of the inputs the Dump Risk needs for this token.',
    });
  });

  it('keeps provisional missing-input reasons and confidence explicit', () => {
    const s = score(computeStorm(header(), wind(), holders(), undefined, false));
    expect(s.final).toBe(false);
    expect(s.why.insider).toBe('Forensics wave still loading.');
    expect(s.result.subScores.insider).toBeNull();
    expect(s.result.confidence).toBeLessThan(1);
    expect(s.provenance.exitLiquidity?.notes).toContain('Cluster term uses 0 until the insider graph loads.');
    expect(s.provenance.composite?.notes?.[0]).toContain('expert priors');
  });

  it('excludes liquidity risk from the general risk mean and keeps all receipts', () => {
    const risk = [90, 20, 40].map((percentile, i) => ({
      type: i === 0 ? 'liquidity-risk' : `risk-${i}`, percentile, signal: null, score: null, lastTrigger: null,
    }));
    const s = score(computeStorm(header({ risk }), wind(), holders(), forensics, true));
    expect(s.result.subScores.nansenRisk).toBe(30);
    expect(s.result.confidence).toBe(1);
    expect(s.result.subScores.sellPressure).toBe(75); // half sells, all sales from the cluster
    expect(s.result.score).toBeGreaterThanOrEqual(0);
    expect(s.result.score).toBeLessThanOrEqual(100);
    expect(Object.values(s.provenance).every(Boolean)).toBe(true);
  });

  it('does not turn missing cohort flow into measured zero flow', () => {
    const missing = score(computeStorm(header(), wind(null), holders(), unavailable, true));
    const measured = score(computeStorm(header(), wind(0), holders(), unavailable, true));
    expect(missing.result.subScores.windShear).toBeNull();
    expect(missing.why.windShear).toContain('No fresh-wallet');
    expect(measured.result.subScores.windShear).toBe(50);
  });

  it('drops market-cap-dependent inputs instead of dividing by zero', () => {
    const s = score(computeStorm(header({ marketCapUsd: 0 }), wind(), holders(), unavailable, true));
    expect(s.result.subScores.windShear).toBeNull();
    expect(s.result.subScores.exitLiquidity).toBeNull();
    expect(Number.isFinite(s.result.score)).toBe(true);
  });

  it('preserves holder and trader-specific unavailable reasons independently', () => {
    const s = score(computeStorm(header({ indicatorsUnavailable: 'Indicators not recorded' }), wind(),
      holders({ concentration: null, tradersUnavailable: 'Trader evidence withheld' }), unavailable, true));
    expect(s.why.concentration).toContain('No non-custodial');
    expect(s.why.sellPressure).toBe('Trader evidence withheld');
    expect(s.why.nansenRisk).toBe('Indicators not recorded');
    expect(s.why.insider).toBe(unavailable.unavailable);
  });

  it('stores score, confidence and missing-input metadata in the isolated test database', () => {
    const s = score(computeStorm(header(), wind(), holders(), forensics, true));
    const now = vi.spyOn(Date, 'now').mockReturnValue(123456789);
    try {
      saveStorm('base', '0xABC', 'TEST', s, 1_000_000, .5, 'page');
      const row = getDb().prepare('SELECT * FROM storm_scores WHERE token_address = ?').get('0xabc') as Record<string, unknown>;
      expect(row.score).toBe(s.result.score);
      expect(row.computed_at).toBe(123456789);
      expect(JSON.parse(String(row.missing))).toEqual(s.result.missing);
      expect(JSON.parse(String(row.sub_scores))).toEqual(s.result.subScores);
    } finally { now.mockRestore(); }
  });

  it('keeps candidate signals separate and explains absent DCA volume', () => {
    const result = stormCandidates(unavailable, { orders: [], overhang: null, provenance });
    expect(result[0]).toMatchObject({ key: 'socialHeat', score: null, why: unavailable.unavailable });
    expect(result[1]).toMatchObject({ key: 'dcaOverhang', score: null, provenance });
    expect(result[1].why).toContain('24h volume');
    expect(stormCandidates(unavailable, unavailable)[1].why).toBe(unavailable.unavailable);
  });
});
