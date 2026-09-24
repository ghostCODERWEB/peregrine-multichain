import { describe, it, expect } from 'vitest';
import { splitSignature, typedDataForWallet } from './perp';
import { toBaseUnits } from '@/components/trade/SpotTrade';

describe('trade helpers', () => {
  it('turns a decimal amount into base units without floating point', () => {
    expect(toBaseUnits('5', 6)).toBe('5000000');
    expect(toBaseUnits('0.1', 18)).toBe('100000000000000000');
    expect(toBaseUnits('1.1234567', 6)).toBe('1123456'); // extra precision is cut, never rounded up
    expect(toBaseUnits('0', 6)).toBeNull();
    expect(toBaseUnits('1e5', 6)).toBeNull();
  });

  it('splits a signature into r, s and v as 27/28', () => {
    const r = 'a'.repeat(64), s = 'b'.repeat(64);
    expect(splitSignature(`0x${r}${s}1b`)).toEqual({ r: `0x${r}`, s: `0x${s}`, v: 27 });
    expect(splitSignature(`0x${r}${s}01`).v).toBe(28);
    expect(() => splitSignature('0x1234')).toThrow();
  });

  it('spells out the EIP-712 domain type from the domain that was returned', () => {
    const t = typedDataForWallet({ domain: { name: 'Exchange', version: '1', chainId: 1337, verifyingContract: '0x0000000000000000000000000000000000000000' }, types: { Agent: [] }, primaryType: 'Agent', message: {} });
    expect((t.types as Record<string, unknown>).EIP712Domain).toEqual([{ name: 'name', type: 'string' }, { name: 'version', type: 'string' }, { name: 'chainId', type: 'uint256' }, { name: 'verifyingContract', type: 'address' }]);
    const given = typedDataForWallet({ domain: { name: 'X' }, types: { EIP712Domain: [{ name: 'name', type: 'string' }] }, primaryType: 'X', message: {} });
    expect((given.types as Record<string, unknown>).EIP712Domain).toEqual([{ name: 'name', type: 'string' }]);
  });
});
