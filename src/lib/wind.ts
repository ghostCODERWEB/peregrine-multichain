// Wallet segments and windows of tgm/flow-intelligence, shared by the
// server (which fetches them) and the wind rose (which draws them).
export const WIND_SEGMENTS = ['smart_trader', 'whale', 'top_pnl', 'public_figure', 'fresh_wallets', 'exchange'] as const;
export type WindSegment = (typeof WIND_SEGMENTS)[number];
export const WIND_TIMEFRAMES = ['1h', '6h', '1d', '7d'] as const;
export type WindTimeframe = (typeof WIND_TIMEFRAMES)[number];
