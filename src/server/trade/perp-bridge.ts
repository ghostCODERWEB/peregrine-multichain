// Funding Hyperliquid perps from an EVM chain (D1c). Nansen quotes a Relay
// route (perp/bridge/quote); TIDE checks it against what the user asked for;
// the user's own wallet sends the approval and the deposit on the origin chain;
// perp/bridge/status tracks it. TIDE never signs or sends. Withdrawals are not
// offered: see the ledger's reason for perp/bridge/execute.
import crypto from 'node:crypto';
import { callNansen } from '@/server/nansen/client';
import { toBaseUnits } from '@/lib/units';
import { checkDepositQuote, type DepositTx, type DepositView } from '@/lib/models/deposit-check';

type Row = Record<string, unknown>;
/** Native USDC (6 decimals) on the chains Nansen deposits from. BNB Chain's
 *  USDC has 18 decimals and is left out rather than special-cased. */
export const DEPOSIT_CHAINS = {
  base: { chainId: 8453, usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
  arbitrum: { chainId: 42161, usdc: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' },
  ethereum: { chainId: 1, usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
  polygon: { chainId: 137, usdc: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' },
} as const;
export type DepositChain = keyof typeof DEPOSIT_CHAINS;
const USDC_DECIMALS = 6;
const QUOTE_TTL = 120_000;
const quotes = new Map<string, { wallet: string; chain: DepositChain; txs: DepositTx[]; at: number }>();

export async function perpDepositQuote(wallet: string, chain: DepositChain, amount: string): Promise<DepositView & { id: string; chain: DepositChain; expiresInMs: number }> {
  const c = DEPOSIT_CHAINS[chain];
  const amountBase = toBaseUnits(amount, USDC_DECIMALS);
  if (!amountBase) throw new Error('Enter a USDC amount above zero.');
  const r = await callNansen<unknown>('perp/bridge/quote', { wallet_address: wallet, origin_chain: chain, destination_chain: 'hyperliquid', origin_token: c.usdc, destination_token: 'perps', amount: amountBase }, { method: 'POST', skipCache: true, record: false });
  const checked = checkDepositQuote(r.data, { wallet, chainId: c.chainId, usdc: c.usdc, amountBase, decimals: USDC_DECIMALS });
  if ('error' in checked) throw new Error(checked.error);
  const now = Date.now();
  for (const [k, v] of quotes) if (now - v.at > QUOTE_TTL) quotes.delete(k);
  const id = crypto.randomBytes(9).toString('base64url');
  quotes.set(id, { wallet: wallet.toLowerCase(), chain, txs: checked.txs, at: now });
  return { ...checked.view, id, chain, expiresInMs: QUOTE_TTL };
}

/** The checked transactions, released once and only after the user confirms. */
export function perpDepositSteps(id: string, wallet: string): { chainId: number; txs: DepositTx[] } {
  const q = quotes.get(id);
  if (!q || Date.now() - q.at > QUOTE_TTL) throw new Error('That deposit quote expired; quote it again.');
  if (q.wallet !== wallet.toLowerCase()) throw new Error('That quote was made for another wallet.');
  quotes.delete(id);
  return { chainId: DEPOSIT_CHAINS[q.chain].chainId, txs: q.txs };
}

const HASH = /^0x[0-9a-fA-F]{64}$/;
export async function perpBridgeStatus(ref: { requestId?: string; txHash?: string }) {
  const q = ref.requestId && HASH.test(ref.requestId) ? { request_id: ref.requestId } : ref.txHash && HASH.test(ref.txHash) ? { tx_hash: ref.txHash } : null;
  if (!q) throw new Error('A bridge status needs the quote’s request id or the deposit’s transaction hash.');
  const r = await callNansen<Row>('perp/bridge/status', q, { method: 'GET', skipCache: true, record: false });
  const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && HASH.test(x)) : []);
  return { status: typeof r.data.status === 'string' ? r.data.status : 'unknown', raw: typeof r.data.raw_status === 'string' ? r.data.raw_status : null, source: list(r.data.source_tx_hashes), destination: list(r.data.destination_tx_hashes) };
}
