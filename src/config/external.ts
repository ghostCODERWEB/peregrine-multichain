// Links out to the real venues and to Nansen's own app, in the URL forms they use.
export const nansenToken = (chain: string, address: string) => `https://app.nansen.ai/token-god-mode?tokenAddress=${encodeURIComponent(address)}&chain=${encodeURIComponent(chain)}`;
export const nansenWallet = (address: string) => `https://app.nansen.ai/profiler?address=${encodeURIComponent(address)}`;
export const polymarketMarket = (slug: string) => `https://polymarket.com/market/${encodeURIComponent(slug)}`;
export const hyperliquidTrade = (coin: string) => `https://app.hyperliquid.xyz/trade/${encodeURIComponent(coin)}`;
