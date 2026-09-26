// Known exchanges and protocols named in Nansen labels, mapped to DefiLlama's
// public icon CDN (keyless). Matching is on whole words at the label's start.
const SLUGS: Array<[RegExp, string]> = [
  [/^binance\b/i, 'binance-cex'], [/^coinbase\b/i, 'coinbase'], [/^okx\b/i, 'okx'], [/^kraken\b/i, 'kraken'],
  [/^bybit\b/i, 'bybit'], [/^bitget\b/i, 'bitget'], [/^kucoin\b/i, 'kucoin'], [/^htx\b|^huobi\b/i, 'htx'],
  [/^bitfinex\b/i, 'bitfinex'], [/^gemini\b/i, 'gemini'], [/^crypto\.com\b/i, 'crypto-com'], [/^mexc\b/i, 'mexc'],
  [/^uniswap\b/i, 'uniswap'], [/^aave\b/i, 'aave'], [/^hyperliquid\b/i, 'hyperliquid'], [/^jupiter\b/i, 'jupiter-aggregator'],
  [/^lido\b/i, 'lido'], [/^curve\b/i, 'curve-finance'], [/^compound\b/i, 'compound-finance'], [/^morpho\b/i, 'morpho'],
  [/^pendle\b/i, 'pendle'], [/^raydium\b/i, 'raydium'], [/^pancakeswap\b/i, 'pancakeswap'], [/^aerodrome\b/i, 'aerodrome'],
[/^ethena\b/i, 'ethena'], [/^maker\b|^sky\b/i, 'makerdao'], [/^1inch\b/i, '1inch-network'],
];

export function entityLogo(label: string | null | undefined): string | null {
  if (!label) return null;
  const hit = SLUGS.find(([re]) => re.test(label.trim()));
  return hit ? `https://icons.llamao.fi/icons/protocols/${hit[1]}?w=48&h=48` : null;
}
