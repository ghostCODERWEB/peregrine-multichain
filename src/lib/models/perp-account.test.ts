import { describe, it, expect } from 'vitest';
import { perpAccountView, perpPositionView } from './perp-account';

// Shaped like live perp/account and perp/positions responses (2026-09-24);
// the numbers are synthetic.
describe('Hyperliquid account reading', () => {
  it('reads account value from marginSummary, not withdrawable', () => {
    const live = { marginSummary: { accountValue: '375.5', totalNtlPos: '1201.1', totalRawUsd: '1525.8', totalMarginUsed: '145.9' }, crossMarginSummary: {}, withdrawable: '127.3', assetPositions: [], time: 1, spotUsdc: '117.2' };
    expect(perpAccountView(live)).toEqual({ accountValue: 375.5, withdrawable: 127.3, marginUsed: 145.9, notional: 1201.1, spotUsdc: 117.2 });
  });
  it('keeps the flat fallbacks and leaves missing values null', () => {
    expect(perpAccountView({ account_value: 120, spotUsdc: 40 })).toMatchObject({ accountValue: 120, spotUsdc: 40, withdrawable: null });
    expect(perpAccountView(null)).toEqual({ accountValue: null, withdrawable: null, marginUsed: null, notional: null, spotUsdc: null });
  });
  it('reads a live position with leverage and liquidation price; skips empty ones', () => {
    const live = { coin: 'BTC', szi: '-0.5', leverage: { type: 'cross', value: 20 }, entryPx: '83583.4', unrealizedPnl: '-64.7', liquidationPx: '99338.7' };
    expect(perpPositionView(live)).toEqual({ coin: 'BTC', size: -0.5, entry: 83583.4, uPnl: -64.7, leverage: '20× cross', liquidation: 99338.7 });
    expect(perpPositionView({ coin: 'ETH', szi: '0' })).toBeNull();
    expect(perpPositionView({ coin: 'ETH', size: 2, leverage: { type: 'isolated', value: 5 } })).toMatchObject({ size: 2, leverage: '5× isolated', entry: null });
  });
});
