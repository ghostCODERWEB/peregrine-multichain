import { describe, it, expect } from 'vitest';
import { publishableFixture } from './fixture-policy';

describe('publishableFixture', () => {
  it('never records prohibited or restricted endpoints', () => {
    expect(publishableFixture('smart-money/dex-trades', {}, { data: [] })).toBeNull();
    expect(publishableFixture('smart-money/netflow', {}, { data: [] })).toBeNull();
    expect(publishableFixture('profiler/address/labels', {}, {})).toBeNull();
  });
  it('never records smart-money-filtered requests to otherwise-allowed endpoints', () => {
    expect(publishableFixture('token-screener', { chains: ['base'], filters: { trader_type: 'sm' } }, { data: [] })).toBeNull();
    expect(publishableFixture('tgm/holders', { label_type: 'smart_money' }, { data: [] })).toBeNull();
  });
  it('records allowed data with labels stripped', () => {
    const out = publishableFixture('tgm/holders', { label_type: 'all_holders' }, { data: [{ address: '0xa', address_label: 'Binance 14' }] }) as { data: Array<Record<string, unknown>> };
    expect(out.data[0]).toEqual({ address: '0xa', address_label: null });
  });
  it('keeps the owner’s account out of fixtures', () => {
    expect(publishableFixture('smart-alert/list', {}, [])).toBeNull();
    expect(publishableFixture('account', {}, {})).toBeNull();
  });
  it('lets a caller vouch for public-view agent output, still stripping labels', () => {
    expect(publishableFixture('agent/fast', { text: 'x' }, [{ type: 'delta', text: 'hi' }], true)).toEqual([{ type: 'delta', text: 'hi' }]);
    expect(publishableFixture('agent/fast', { text: 'x' }, [])).toBeNull();
  });
});
