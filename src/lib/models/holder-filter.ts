// Spec 5.3: "s_i = holder share after excluding exchange, bridge and
// contract labels". Nansen's free-tier holder labels are free text
// ("Coinbase: Hot Wallet", "vAMM-USDC/NOCK", "Token Millionaire"), so the
// exclusion reads the label Nansen already returned with the holder — no
// extra profiler/labels call (100 credits) per address.
//
// Kept deliberately narrow: a wallet is dropped only when its label says
// it is custody or plumbing, never because it's merely large. Team,
// treasury and multisig wallets stay in — they can sell, which is the risk
// being measured.

export type NonHolderKind = 'exchange' | 'bridge' | 'pool' | 'contract' | 'burn';

const RULES: Array<{ kind: NonHolderKind; re: RegExp }> = [
  { kind: 'burn', re: /\b(burn|dead|null address|0x0+dead)\b/i },
  { kind: 'bridge', re: /\bbridge\b|wormhole|layerzero|stargate|portal\b/i },
  {
    kind: 'exchange',
    re: /\b(exchange|cex|hot wallet|cold wallet|deposit|binance|coinbase|okx|bybit|kraken|kucoin|gate\.io|mexc|bitget|htx|huobi|crypto\.com|upbit|bithumb|bitfinex|gemini|bitstamp|robinhood custody)\b/i,
  },
  // AMM pairs are labelled with the pair itself ("vAMM-USDC/NOCK",
  // "Uniswap V3: WETH-USDC 0.05%"): a slash between two symbols, or a
  // known pool/AMM word.
  { kind: 'pool', re: /\b(pool|pair|lp|amm|vamm|samm|cl\d*)\b|[A-Za-z0-9.]+\/[A-Za-z0-9.]+|uniswap|pancakeswap|aerodrome|velodrome|sushiswap|curve|balancer|raydium|orca|meteora|pump\.fun amm/i },
  { kind: 'contract', re: /\b(contract|router|vault|locker|lock|vesting|staking|escrow|aggregator|proxy|distributor|airdrop)\b|team finance|unicrypt|pinklock|sablier/i },
];

/** Why this holder isn't a "real" holder for concentration purposes, or
 *  null when it is one. */
export function nonHolderKind(label: string | null | undefined): NonHolderKind | null {
  if (!label) return null;
  for (const r of RULES) if (r.re.test(label)) return r.kind;
  return null;
}
