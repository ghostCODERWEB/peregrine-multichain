import { beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '@/server/nansen/db';
import { rememberToken, tokenLogos, logoOf } from './meta';

const AERO = '0x940181a94a35a4569e4529a3cdfb74e38fd98631';
describe('token logos remembered from Nansen (P4)', () => {
  beforeEach(() => { getDb().exec('DELETE FROM token_meta;'); });
  it('keeps https logos per chain and address (EVM case-insensitive), and keeps a known logo when a later response has none', () => {
    rememberToken('base', AERO.toUpperCase().replace('0X', '0x'), 'AERO', 'https://img.example.invalid/aero.png');
    rememberToken('base', AERO, 'AERO', null);
    const m = tokenLogos([{ chain: 'base', address: AERO }, { chain: 'solana', address: 'So11111111111111111111111111111111111111112' }]);
    expect(logoOf(m, 'base', AERO)).toBe('https://img.example.invalid/aero.png');
    expect(logoOf(m, 'solana', 'So11111111111111111111111111111111111111112')).toBeNull();
  });
  it('never stores a non-https URL', () => {
    rememberToken('base', AERO, 'AERO', 'javascript:alert(1)');
    expect(logoOf(tokenLogos([{ chain: 'base', address: AERO }]), 'base', AERO)).toBeNull();
  });
});
