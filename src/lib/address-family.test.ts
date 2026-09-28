import { describe, it, expect } from 'vitest';
import { addressKey, detectAddress, plausibleTokenAddress } from './address-family';

describe('addressKey', () => {
  it('lowercases EVM hex and keeps case-sensitive encodings exactly', () => {
    expect(addressKey('0xAbCdEf0123456789aBcDeF0123456789AbCdEf01')).toBe('0xabcdef0123456789abcdef0123456789abcdef01');
    const sol = 'ASv4ktNwz8uBbUJ94ACNr7NJ1stTcYNeuzGwxKmsaKa7';
    expect(addressKey(sol)).toBe(sol);
    expect(addressKey('TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE')).toBe('TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE');
  });

  it('agrees with detection on what an address is', () => {
    expect(detectAddress('ASv4ktNwz8uBbUJ94ACNr7NJ1stTcYNeuzGwxKmsaKa7').length).toBeGreaterThan(0);
  });
});

describe('plausibleTokenAddress', () => {
  it('is strict where the format is unambiguous', () => {
    expect(plausibleTokenAddress('base', '0x0cbf291ba052174879d90bf781df1a5f2bc5bb07')).toBe(true);
    expect(plausibleTokenAddress('base', '0xnotreal')).toBe(false);
    expect(plausibleTokenAddress('solana', 'pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn')).toBe(true);
    expect(plausibleTokenAddress('solana', '0x0cbf291ba052174879d90bf781df1a5f2bc5bb07')).toBe(false);
  });
  it('stays permissive for chains with varied token ids', () => {
    expect(plausibleTokenAddress('sui', '0x2::sui::SUI')).toBe(true);
    expect(plausibleTokenAddress('near', 'wrap.near')).toBe(true);
    expect(plausibleTokenAddress('near', '<script>')).toBe(false);
  });
});
