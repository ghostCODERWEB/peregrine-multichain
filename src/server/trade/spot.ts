// Spot trading (M8), behind FEATURE_TRADING. TIDE quotes and prepares; the
// user signs in their own wallet; nothing is ever signed or sent by the
// server. Quotes stay on the server for two minutes and the browser only
// gets their pricing and an id, so the quote Prepare receives is exactly
// the one Nansen returned. Trading endpoints spend no Nansen credits, but
// they run on a Nansen key, so only the key owner or a member (with their
// own key) can trade: a public instance never trades on the operator's key.
import crypto from 'node:crypto';
import { callNansen } from '@/server/nansen/client';
import { getDb } from '@/server/nansen/db';
import type { RequestContext } from '@/server/context';
import { chainWeather } from '@/server/weather/queries';
import { viewOf } from '@/server/mode';

// Never on a public site: quotes and prepared transactions spend the
// operator's key, and trading needs visitors to connect a wallet.
export const tradingEnabled = () => process.env.FEATURE_TRADING === '1' && process.env.TIDE_PUBLIC_SITE !== '1';
export const TRADE_CHAINS = ['base', 'solana'] as const;
export type TradeChain = (typeof TRADE_CHAINS)[number];
export const TOKENS = {
  base: {
    USDC: { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 },
    ETH: { address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', decimals: 18 },
  },
  solana: {
    USDC: { address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6 },
    SOL: { address: 'So11111111111111111111111111111111111111112', decimals: 9 },
  },
} as const;
export const MAX_TRADE_USD = 10_000;

export function tradeRefusal(ctx: RequestContext): string | null {
  if (!tradingEnabled()) return 'Trading is off on this instance (FEATURE_TRADING).';
  if (ctx.mode === 'public') return 'Trading runs on a Nansen key: the instance owner’s, or yours once you sign in with it.';
  return null;
}

type Row = Record<string, unknown>;
const s = (v: unknown) => (typeof v === 'string' ? v : v == null ? null : String(v));
const n = (v: unknown) => { const x = Number(v); return v == null || v === '' || !Number.isFinite(x) ? null : x; };
const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function validTradeAddress(chain: TradeChain, address: string): boolean {
  return chain === 'base' ? EVM_ADDRESS.test(address) : SOLANA_ADDRESS.test(address);
}

/** EVM addresses are case-insensitive; Solana public keys are not. */
export function tradeAddressKey(chain: TradeChain, address: string): string {
  return chain === 'base' ? address.toLowerCase() : address;
}

export function validSignedTransaction(chain: TradeChain, value: string): boolean {
  if (chain === 'base') return /^0x[0-9a-fA-F]{100,}$/.test(value);
  if (value.length < 80 || value.length > 200_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return false;
  try {
    const bytes = Buffer.from(value, 'base64');
    return bytes.length >= 64 && bytes.length <= 150_000 && bytes.toString('base64').replace(/=+$/, '') === value.replace(/=+$/, '');
  } catch { return false; }
}

export interface QuoteView { id: string; aggregator: string; inUsd: number | null; outUsd: number | null; outAmount: string | null; priceImpactPct: number | null; tradingFeeUsd: number | null; networkFeeUsd: number | null }

const quotes = new Map<string, { chain: TradeChain; wallet: string; quote: Row; at: number }>();
const QUOTE_TTL = 2 * 60_000;
function remember(chain: TradeChain, wallet: string, quote: Row): string {
  const now = Date.now();
  for (const [k, v] of quotes) if (now - v.at > QUOTE_TTL) quotes.delete(k);
  const id = crypto.randomBytes(9).toString('base64url');
  quotes.set(id, { chain, wallet: tradeAddressKey(chain, wallet), quote, at: now });
  return id;
}

export type SpotQuoteInput =
  | { chain: 'base'; side: 'buy' | 'sell'; base: 'USDC' | 'ETH'; token: string; amount: string; wallet: string }
  | { chain: 'solana'; side: 'buy' | 'sell'; base: 'USDC' | 'SOL'; token: string; amount: string; wallet: string };

export async function spotQuote(p: SpotQuoteInput): Promise<QuoteView[]> {
  if (!validTradeAddress(p.chain, p.token) || !validTradeAddress(p.chain, p.wallet)) throw new Error(`Expected valid ${p.chain === 'base' ? 'Base' : 'Solana'} addresses.`);
  const b = (TOKENS[p.chain] as Record<string, { address: string; decimals: number }>)[p.base];
  if (!b) throw new Error('That settlement asset does not belong to the selected chain.');
  const [from, to] = p.side === 'buy' ? [b.address, p.token] : [p.token, b.address];
  const query = { chain: p.chain, from_token: from, to_token: to, amount: p.amount, wallet_address: p.wallet };
  const r = await callNansen<{ quotes?: Row[] }>('trade/quote', query, { method: 'GET', skipCache: true, record: false });
  return (r.data.quotes ?? []).map((q) => ({
    id: remember(p.chain, p.wallet, q), aggregator: s(q.aggregator) ?? '?', inUsd: n(q.inUsdValue), outUsd: n(q.outUsdValue), outAmount: s(q.outAmount),
    priceImpactPct: n(q.priceImpactPct), tradingFeeUsd: n(q.tradingFeeInUsd), networkFeeUsd: n(q.networkFeeInUsd),
  })).filter((q) => q.inUsd == null || q.inUsd <= MAX_TRADE_USD * 1.05);
}

export interface Prepared { chain: TradeChain; simulationPassed: boolean | null; needsApproval: boolean; approvalTx: Row | null; swapTx: Row | null; transaction: string | null; error: string | null }

/** Builds (and simulates) the unsigned transactions for a quote this wallet asked for. Broadcasts nothing. */
export async function spotPrepare(quoteId: string, wallet: string): Promise<Prepared> {
  const q = quotes.get(quoteId);
  if (!q || Date.now() - q.at > QUOTE_TTL) throw new Error('That quote expired; get a fresh one.');
  if (!validTradeAddress(q.chain, wallet) || q.wallet !== tradeAddressKey(q.chain, wallet)) throw new Error('That quote was made for another wallet.');
  const r = await callNansen<Row>('trade/prepare', { chain: q.chain, wallet_address: wallet, quote: q.quote }, { method: 'POST', skipCache: true, record: false });
  const d = r.data;
  return {
    chain: q.chain, simulationPassed: typeof d.simulationPassed === 'boolean' ? d.simulationPassed : null, needsApproval: d.needsApproval === true,
    approvalTx: (d.approvalTxData as Row | undefined) ?? null, swapTx: (d.swapTxData as Row | undefined) ?? null,
    transaction: s(d.transaction),
    error: s(d.simulationError ?? d.error),
  };
}

/** Broadcasts a transaction the user signed in their own wallet. */
export async function spotExecute(chain: TradeChain, signedTx: string): Promise<{ txHash: string | null; status: string | null }> {
  if (!validSignedTransaction(chain, signedTx)) throw new Error(chain === 'base' ? 'Expected a signed EVM transaction (0x hex).' : 'Expected a signed Solana transaction (base64).');
  const r = await callNansen<Row>('trade/execute', { signed_transaction: signedTx, chain }, { method: 'POST', skipCache: true, record: false });
  return { txHash: s(r.data.txHash ?? r.data.signature), status: s(r.data.status) };
}

export async function bridgeStatus(txHash: string, fromChain: string, toChain: string, aggregator?: string) {
  const r = await callNansen<Row>('trade/bridge-status', { tx_hash: txHash, from_chain: fromChain, to_chain: toChain, ...(aggregator ? { aggregator } : {}) }, { method: 'GET', skipCache: true, record: false });
  return { status: s(r.data.status), substatus: s(r.data.substatus) };
}

/** What TIDE knows about the token before the user trades it (free: TIDE's own tables). */
export function tradeSignals(ctx: RequestContext, chain: string, token: string) {
  const match = chain === 'solana' ? 'token_address = ?' : 'lower(token_address) = lower(?)';
  const storm = getDb().prepare(`SELECT symbol, score, band, confidence, computed_at FROM storm_scores WHERE chain = ? AND ${match} ORDER BY id DESC LIMIT 1`).get(chain, token) as
    { symbol: string | null; score: number; band: string; confidence: number; computed_at: number } | undefined;
  const w = chainWeather(chain, Date.now(), viewOf(ctx.mode));
  return {
    symbol: storm?.symbol ?? null,
    storm: storm ? { score: Math.round(storm.score), band: storm.band, confidence: storm.confidence, at: storm.computed_at } : null,
    chainPressure: w.cpi != null ? { cpi: Math.round(w.cpi), band: w.band } : null,
    trackRecord: 'Dump and breakout odds carry their out-of-sample record on the token page; the Dump Risk’s weights are expert priors until the M9 backtest fits them.',
  };
}
