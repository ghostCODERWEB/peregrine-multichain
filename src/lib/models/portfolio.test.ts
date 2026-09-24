import { describe, expect, it } from 'vitest';
import { addressKey, combinePositions, exposure, stressSummary, tokenStress, walletAddresses, type Position } from './portfolio';

const a = '0x1111111111111111111111111111111111111111';
const position: Position = { chain: 'base', tokenAddress: a, symbol: 'TEST', valueUsd: 100, wallets: [a] };
const candles = Array.from({ length: 60 }, (_, i) => ({ day: new Date(Date.UTC(2026, 0, i + 1)).toISOString().slice(0, 10), close: 100 * Math.exp(Math.sin(i) * .05) }));

describe('portfolio calculations', () => {
  it('deduplicates EVM case but preserves base58 identity', () => {
    const mixed = `0x${'AbCd'.repeat(10)}`;
    expect(addressKey(mixed)).toBe(mixed.toLowerCase());
    expect(addressKey('AbCd')).toBe('AbCd');
    expect(walletAddresses([a, a])).toEqual([a]);
    expect(walletAddresses(['alice.near'])).toEqual(['alice.near']);
    expect(() => walletAddresses(['not-a-wallet'])).toThrow();
    expect(() => walletAddresses(Array.from({ length: 6 }, (_, i) => `0x${String(i).repeat(40)}`))).toThrow(/five/);
  });
  it('combines a token across wallets, never across chains or same-symbol contracts', () => {
    const rows = combinePositions([position, { ...position, valueUsd: 50, wallets: ['wallet2'] }, { ...position, chain: 'ethereum' }, { ...position, tokenAddress: 'another' }]);
    expect(rows).toHaveLength(3);
    expect(rows[0].valueUsd).toBe(150);
    expect(rows[0].wallets).toHaveLength(2);
    expect(exposure(rows).total).toBe(350);
  });
  it('reports concentration by chain-qualified position and no fake zero for an empty set', () => {
    expect(exposure([position]).effectivePositions).toBe(1);
    expect(exposure([]).largestShare).toBeNull();
    expect(exposure([position, { ...position, valueUsd: 100 }]).effectivePositions).toBe(2);
  });
  it('requires history and a walk-forward track record, rejecting gaps at the end', () => {
    expect(tokenStress(position, candles.slice(0, 15))).toBeNull();
    expect(tokenStress(position, [...candles.slice(0, 40), ...candles.slice(45)])).toBeNull();
    const row = tokenStress(position, candles)!;
    expect(row.low).toBeLessThan(100);
    expect(row.high).toBeGreaterThan(100);
    expect(row.tests).toBeGreaterThanOrEqual(10);
  });
  it('keeps unmodeled value separate from modeled scenarios', () => {
    const row = tokenStress(position, candles)!;
    const s = stressSummary([position, { ...position, valueUsd: 300 }], [row]);
    expect(s.coverage).toBe(.25);
    expect(s.unmodeled).toBe(300);
    expect(s.low).toBe(row.low);
    expect(stressSummary([position], []).low).toBeNull();
  });
});
