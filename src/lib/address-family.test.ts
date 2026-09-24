import { describe, it, expect } from 'vitest';
import { addressKey, detectAddress } from './address-family';

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
