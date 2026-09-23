import { describe, it, expect } from 'vitest';
import { stripLabels } from './redact';

describe('stripLabels', () => {
  it('removes Nansen labels at any depth, including in arrays', () => {
    const out = stripLabels({ holders: [{ address: '0xa', label: 'Binance 14', share: 0.1 }], funder: { funderName: 'Token Millionaire', funder: '0xb' } });
    expect(out.holders[0].label).toBeNull();
    expect(out.holders[0].address).toBe('0xa');
    expect(out.funder.funderName).toBeNull();
  });
  it('leaves provenance input labels (our own UI strings) intact', () => {
    const out = stripLabels({ provenance: { inputs: [{ label: 'Market cap', value: '$1M' }] }, label: 'Smart Trader' });
    expect(out.provenance.inputs[0].label).toBe('Market cap');
    expect(out.label).toBeNull();
  });
  it('strips raw API label fields too', () => {
    const out = stripLabels({ data: [{ trader_address_label: 'x', address_label: 'y', from_address_label: 'z' }] });
    expect(out.data[0]).toEqual({ trader_address_label: null, address_label: null, from_address_label: null });
  });
});
