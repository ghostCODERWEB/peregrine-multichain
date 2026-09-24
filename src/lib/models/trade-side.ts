// Classifies a DEX swap as capital entering or leaving a chain's risk
// assets. Every swap is simultaneously a buy (of token_bought) and a sell
// (of token_sold) on the SAME chain, so "which side is this trade" has no
// answer from the row alone — what matters for rotation is direction
// relative to base assets:
//
//   risk token -> stablecoin/native   = 'sell' (exiting risk on this chain)
//   stablecoin/native -> risk token   = 'buy'  (entering risk on this chain)
//   risk -> risk, base -> base        = null   (rotating within the chain's
//                                              risk book, or just moving
//                                              between cash equivalents —
//                                              neither is capital crossing
//                                              a chain boundary)
//
// A wallet that 'sell's on chain A and then 'buy's on chain B within the
// front window has de-risked on A and re-risked on B — the rotation the
// front is meant to show. Classification is by symbol, which is what the
// smart-money/dex-trades row gives us; wrapped/bridged variants are listed
// explicitly rather than pattern-matched so an unrelated token that merely
// contains "USD" in its name isn't silently treated as cash.

const STABLECOINS = new Set([
  'USDC', 'USDT', 'DAI', 'USDE', 'SUSDE', 'FDUSD', 'PYUSD', 'TUSD', 'USDS', 'SUSDS', 'GHO', 'FRAX', 'FRXUSD',
  'LUSD', 'CRVUSD', 'USD0', 'USDB', 'USDBC', 'USDC.E', 'USDT.E', 'USDT0', 'USDM', 'RLUSD', 'AUSD', 'USD1', 'USDG',
  'EURC', 'EURS', 'EURE',
  // Stables Nansen's include_stablecoins:false lets through on non-EVM
  // chains (seen live on Sui and Tron screener results).
  'SBUSDT', 'USDSUI', 'BUCK', 'WUSDC', 'WUSDT', 'USDD',
]);

const NATIVE_AND_WRAPPED = new Set([
  'ETH', 'WETH', 'SOL', 'WSOL', 'BNB', 'WBNB', 'AVAX', 'WAVAX', 'POL', 'WPOL', 'MATIC', 'WMATIC',
  'MON', 'WMON', 'S', 'WS', 'SEI', 'WSEI', 'HYPE', 'WHYPE', 'MNT', 'WMNT', 'IOTA', 'WIOTA', 'XPL', 'WXPL',
]);

/** Tether's ₮ (e.g. "USD₮0") reads as T. */
const norm = (symbol: string) => symbol.trim().toUpperCase().replace(/₮/g, 'T');

export function isStablecoin(symbol: string | null | undefined): boolean {
  return !!symbol && STABLECOINS.has(norm(symbol));
}

/** Majors and their wrapped or bridged copies (WBTC, cbBTC, UBTC, UETH,
 *  WSOL…): base assets rather than tokens anyone would call alpha. */
export function isMajorOrWrapped(symbol: string | null | undefined): boolean {
  if (!symbol) return false;
  const s = norm(symbol);
  return isBaseAsset(s) || /^(W|CB|U|K|T|S|M|R|ST|WST|R|B|SOL)?(BTC|ETH|SOL|BNB|AVAX|POL|HYPE)(\.E|B|0)?$/.test(s);
}

export function isBaseAsset(symbol: string | null | undefined): boolean {
  if (!symbol) return false;
  const s = norm(symbol);
  return STABLECOINS.has(s) || NATIVE_AND_WRAPPED.has(s);
}

export interface SwapLike {
  token_bought_symbol?: string | null;
  token_sold_symbol?: string | null;
  token_bought_address?: string | null;
  token_sold_address?: string | null;
}

export interface ClassifiedSide {
  side: 'buy' | 'sell';
  /** The risk token entered (buy) or exited (sell) — the one the front
   *  drill-down names, since "sold USDC" says nothing about what moved. */
  tokenAddress: string;
  tokenSymbol: string | null;
}

export function classifySwap(swap: SwapLike): ClassifiedSide | null {
  const boughtBase = isBaseAsset(swap.token_bought_symbol);
  const soldBase = isBaseAsset(swap.token_sold_symbol);
  if (boughtBase === soldBase) return null; // risk<->risk or base<->base

  if (soldBase) {
    if (!swap.token_bought_address) return null;
    return { side: 'buy', tokenAddress: swap.token_bought_address, tokenSymbol: swap.token_bought_symbol ?? null };
  }
  if (!swap.token_sold_address) return null;
  return { side: 'sell', tokenAddress: swap.token_sold_address, tokenSymbol: swap.token_sold_symbol ?? null };
}
