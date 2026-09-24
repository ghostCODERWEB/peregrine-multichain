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

export const tradingEnabled = () => process.env.FEATURE_TRADING === '1';
export const TRADE_CHAINS = ['base'] as const;
export const TOKENS = {
  base: {
    USDC: { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 },
    ETH: { address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', decimals: 18 },
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

export interface QuoteView { id: string; aggregator: string; inUsd: number | null; outUsd: number | null; outAmount: string | null; priceImpactPct: number | null; tradingFeeUsd: number | null; networkFeeUsd: number | null }

const quotes = new Map<string, { chain: string; wallet: string; quote: Row; at: number }>();
const QUOTE_TTL = 2 * 60_000;
function remember(chain: string, wallet: string, quote: Row): string {
  const now = Date.now();
  for (const [k, v] of quotes) if (now - v.at > QUOTE_TTL) quotes.delete(k);
  const id = crypto.randomBytes(9).toString('base64url');
  quotes.set(id, { chain, wallet: wallet.toLowerCase(), quote, at: now });
  return id;
}

export async function spotQuote(p: { chain: 'base'; side: 'buy' | 'sell'; base: 'USDC' | 'ETH'; token: string; amount: string; wallet: string }): Promise<QuoteView[]> {
  const b = TOKENS[p.chain][p.base];
  const [from, to] = p.side === 'buy' ? [b.address, p.token] : [p.token, b.address];
  const query = { chain: p.chain, from_token: from, to_token: to, amount: p.amount, wallet_address: p.wallet };
  const r = await callNansen<{ quotes?: Row[] }>('trade/quote', query, { method: 'GET', skipCache: true, record: false });
  return (r.data.quotes ?? []).map((q) => ({
    id: remember(p.chain, p.wallet, q), aggregator: s(q.aggregator) ?? '?', inUsd: n(q.inUsdValue), outUsd: n(q.outUsdValue), outAmount: s(q.outAmount),
    priceImpactPct: n(q.priceImpactPct), tradingFeeUsd: n(q.tradingFeeInUsd), networkFeeUsd: n(q.networkFeeInUsd),
  })).filter((q) => q.inUsd == null || q.inUsd <= MAX_TRADE_USD * 1.05);
}

export interface Prepared { chain: string; simulationPassed: boolean | null; needsApproval: boolean; approvalTx: Row | null; swapTx: Row | null; error: string | null }

/** Builds (and simulates) the unsigned transactions for a quote this wallet asked for. Broadcasts nothing. */
export async function spotPrepare(quoteId: string, wallet: string): Promise<Prepared> {
  const q = quotes.get(quoteId);
  if (!q || Date.now() - q.at > QUOTE_TTL) throw new Error('That quote expired; get a fresh one.');
  if (q.wallet !== wallet.toLowerCase()) throw new Error('That quote was made for another wallet.');
  const r = await callNansen<Row>('trade/prepare', { chain: q.chain, wallet_address: wallet, quote: q.quote }, { method: 'POST', skipCache: true, record: false });
  const d = r.data;
  return {
    chain: q.chain, simulationPassed: typeof d.simulationPassed === 'boolean' ? d.simulationPassed : null, needsApproval: d.needsApproval === true,
    approvalTx: (d.approvalTxData as Row | undefined) ?? null, swapTx: (d.swapTxData as Row | undefined) ?? null,
    error: s(d.simulationError ?? d.error),
  };
}

/** Broadcasts a transaction the user signed in their own wallet. */
export async function spotExecute(chain: 'base', signedTx: string): Promise<{ txHash: string | null; status: string | null }> {
  if (!/^0x[0-9a-fA-F]{100,}$/.test(signedTx)) throw new Error('Expected a signed EVM transaction (0x hex).');
  const r = await callNansen<Row>('trade/execute', { signed_transaction: signedTx, chain }, { method: 'POST', skipCache: true, record: false });
  return { txHash: s(r.data.txHash ?? r.data.signature), status: s(r.data.status) };
}

export async function bridgeStatus(txHash: string, fromChain: string, toChain: string, aggregator?: string) {
  const r = await callNansen<Row>('trade/bridge-status', { tx_hash: txHash, from_chain: fromChain, to_chain: toChain, ...(aggregator ? { aggregator } : {}) }, { method: 'GET', skipCache: true, record: false });
  return { status: s(r.data.status), substatus: s(r.data.substatus) };
}

/** What TIDE knows about the token before the user trades it (free: TIDE's own tables). */
export function tradeSignals(ctx: RequestContext, chain: string, token: string) {
  const storm = getDb().prepare('SELECT symbol, score, band, confidence, computed_at FROM storm_scores WHERE chain = ? AND lower(token_address) = lower(?) ORDER BY id DESC LIMIT 1').get(chain, token) as
    { symbol: string | null; score: number; band: string; confidence: number; computed_at: number } | undefined;
  const w = chainWeather(chain, Date.now(), viewOf(ctx.mode));
  return {
    symbol: storm?.symbol ?? null,
    storm: storm ? { score: Math.round(storm.score), band: storm.band, confidence: storm.confidence, at: storm.computed_at } : null,
    chainPressure: w.cpi != null ? { cpi: Math.round(w.cpi), band: w.band } : null,
    trackRecord: 'Storm and breakout odds carry their out-of-sample record on the token page; the Storm Score’s weights are expert priors until the M9 backtest fits them.',
  };
}
