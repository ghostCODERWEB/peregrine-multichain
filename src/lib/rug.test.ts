import { describe, it, expect } from 'vitest';
import { rugReport, RUG_CHAINS } from './rug';
import type { TokenHeader, HoldersWave, ForensicsWave } from '@/server/token/waves';
import type { StormWave } from '@/server/token/storm';
import { forMode } from '@/server/redact';

const NOW = Date.UTC(2026, 8, 25);
const header = (o: Partial<TokenHeader> = {}) => ({
  name: 'Test', symbol: 'TST', logo: null, marketCapUsd: 10_000_000, fdvUsd: null, liquidityUsd: 1_000_000, holders: 5000,
  volume24hUsd: null, buyVolumeUsd: null, sellVolumeUsd: null, uniqueBuyers: null, uniqueSellers: null,
  deployedAt: '2025-01-01T00:00:00Z', marketCapGroup: null, isStablecoin: false,
  risk: [{ type: 'liquidity-risk', score: null, signal: null, percentile: 30, lastTrigger: null }], reward: [], indicatorsUnavailable: null,
  provenance: {}, ...o,
}) as unknown as TokenHeader;
const holders = (top10Share: number) => ({ concentration: { score: 0, hhiN: 0, giniCoefficient: 0, top10Share, nakamoto: 5 } }) as unknown as HoldersWave;
const forensics = (clusters: Array<{ share: number; includesDeployer: boolean }>) => ({ clusters: clusters.map((c, i) => ({ id: i, wallets: [], ...c })) }) as unknown as ForensicsWave;
const storm = (score: number, band: StormWave['result']['band'], sellPressure: number | null = 20) =>
  ({ final: true, why: {}, provenance: {}, result: { score, band, confidence: 0.9, missing: [], subScores: { sellPressure } } }) as unknown as StormWave;

describe('rugReport', () => {
  it('a healthy token passes every check and keeps its Dump Risk band', () => {
    const r = rugReport({ header: header(), holders: holders(0.2), forensics: forensics([]), storm: storm(18, 'clear'), now: NOW });
    expect(r.checks.map((c) => c.status)).toEqual(['pass', 'pass', 'pass', 'pass', 'pass', 'pass']);
    expect(r).toMatchObject({ verdict: 'low', score: 18, fails: 0, final: true });
  });

  it('flags the classic rug shape and raises a low band to high on two or more fails', () => {
    const r = rugReport({
      header: header({ liquidityUsd: 10_000, deployedAt: '2026-09-24T00:00:00Z' }),
      holders: holders(0.72), forensics: forensics([{ share: 0.12, includesDeployer: true }]), storm: storm(22, 'clear', 81), now: NOW,
    });
    const s = Object.fromEntries(r.checks.map((c) => [c.id, c.status]));
    expect(s).toMatchObject({ liquidity: 'fail', concentration: 'fail', insiders: 'fail', age: 'fail', selling: 'fail' });
    expect(r.verdict).toBe('high');
    expect(r.checks.find((c) => c.id === 'insiders')!.value).toContain('linked to the deployer');
  });

  it('one failed check lifts a low band to moderate', () => {
    const r = rugReport({ header: header(), holders: holders(0.2), forensics: forensics([{ share: 0.46, includesDeployer: false }]), storm: storm(19, 'clear'), now: NOW });
    expect(r.fails).toBe(1);
    expect(r.verdict).toBe('moderate');
  });

  it('never downgrades a high band, and says critical for the warning band', () => {
    expect(rugReport({ header: header(), holders: holders(0.2), forensics: forensics([]), storm: storm(80, 'warning'), now: NOW }).verdict).toBe('critical');
  });

  it('marks missing data unknown with Nansen’s reason, and insiders as still checking before forensics lands', () => {
    const r = rugReport({ header: { unavailable: 'Token information: not available on X.' }, holders: null, forensics: undefined, storm: null, now: NOW });
    expect(r.checks.every((c) => c.status === 'unknown')).toBe(true);
    expect(r.checks[0].detail).toBe('Token information: not available on X.');
    expect(r.checks.find((c) => c.id === 'insiders')!.value).toBe('Checking…');
    expect(r.verdict).toBe('unknown');
  });

  it('does not grade stablecoins', () => {
    expect(rugReport({ header: header({ isStablecoin: true }), holders: holders(0.2), storm: storm(10, 'clear'), now: NOW }).verdict).toBe('stablecoin');
  });

  it('lists networks with both token information and holders', () => {
    expect(RUG_CHAINS).toEqual(expect.arrayContaining(['ethereum', 'base', 'solana']));
  });
  it('survives public-view redaction unchanged (no field is named like a Nansen label)', () => {
    const r = rugReport({ header: header(), holders: holders(0.2), forensics: forensics([{ share: 0.2, includesDeployer: false }]), storm: storm(30, 'cloudy'), now: NOW });
    expect(forMode('public', r)).toEqual(r);
  });
});
