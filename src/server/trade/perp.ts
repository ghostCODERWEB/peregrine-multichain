// Hyperliquid perp trading (M8), behind FEATURE_TRADING. Nansen prepares an
// unsigned action with its EIP-712 payload; the user signs it in their own
// wallet; TIDE submits exactly the prepared action, nonce and the user's
// signature. The prepared action never leaves the server (the browser only
// signs the typed data), so it reaches Nansen byte-for-byte as returned.
// Prepared actions expire after 45 seconds: their nonce is a timestamp.
import crypto from 'node:crypto';
import { callNansen } from '@/server/nansen/client';

type Row = Record<string, unknown>;
const PREPARED_TTL = 45_000;
const prepared = new Map<string, { kind: string; wallet: string; action: unknown; nonce: unknown; vault: unknown; at: number }>();

export type PerpKind = 'approve-builder-fee' | 'order' | 'close' | 'cancel' | 'leverage' | 'transfer';
/** Account actions carry no order: Nansen echoes size and price as null. */
export interface PerpAccountInput { coin?: string; orderId?: number; leverage?: number; isCross?: boolean; amount?: number; toPerp?: boolean }

export async function perpReads(wallet: string) {
  const q = { wallet_address: wallet };
  const get = (ep: string) => callNansen<Row>(ep, q, { method: 'GET', skipCache: true, record: false }).then((r) => r.data).catch((e) => ({ error: (e as Error).message.slice(0, 200) }));
  const [fee, account, positions, orders] = await Promise.all([get('perp/builder-fee'), get('perp/account'), get('perp/positions'), get('perp/orders')]);
  return { fee, account, positions, orders };
}

export async function perpMeta() {
  const r = await callNansen<Row>('perp/meta', {}, { method: 'GET', record: false });
  return r.data;
}

export interface PerpOrderInput { coin: string; isBuy: boolean; size: number; price: number; slippage?: number }

/** Prepares an action (no state change) and returns what the wallet must sign. */
export async function perpPrepare(kind: PerpKind, wallet: string, o?: PerpOrderInput, a: PerpAccountInput = {}) {
  const body: Row = { wallet_address: wallet };
  if (kind === 'order') Object.assign(body, { coin: o!.coin, is_buy: o!.isBuy, size: o!.size, price: o!.price, order_type: 'market', slippage: o!.slippage ?? 0.02 });
  if (kind === 'close') Object.assign(body, { coin: o!.coin, is_buy: o!.isBuy, size: o!.size, price: o!.price });
  // Shapes probed live 2026-09-24 (free 422s name the required fields).
  if (kind === 'cancel') Object.assign(body, { coin: a.coin, order_id: a.orderId });
  if (kind === 'leverage') Object.assign(body, { coin: a.coin, leverage: a.leverage, is_cross: a.isCross ?? true });
  if (kind === 'transfer') Object.assign(body, { amount: a.amount, to_perp: a.toPerp });
  const r = await callNansen<Row>(`perp/${kind}`, body, { method: 'POST', skipCache: true, record: false });
  const d = r.data;
  if (!d.action || d.nonce == null || !d.eip712) throw new Error('Nansen did not return a signable action.');
  const now = Date.now();
  for (const [k, v] of prepared) if (now - v.at > PREPARED_TTL) prepared.delete(k);
  const id = crypto.randomBytes(9).toString('base64url');
  prepared.set(id, { kind, wallet: wallet.toLowerCase(), action: d.action, nonce: d.nonce, vault: d.vault_address ?? null, at: now });
  return { id, eip712: d.eip712 as Row, size: d.size ?? null, price: d.price ?? null, expiresInMs: PREPARED_TTL };
}

/** Submits a prepared action with the user's signature. This is the only step that changes anything. */
export async function perpExecute(id: string, wallet: string, signatureHex: string) {
  const p = prepared.get(id);
  if (!p || Date.now() - p.at > PREPARED_TTL) throw new Error('That prepared action expired (its nonce is a timestamp); prepare it again.');
  if (p.wallet !== wallet.toLowerCase()) throw new Error('That action was prepared for another wallet.');
  const signature = splitSignature(signatureHex);
  prepared.delete(id);
  const r = await callNansen<Row>('perp/execute', { action: p.action, nonce: p.nonce, signature, ...(p.vault ? { vault_address: p.vault } : {}) }, { method: 'POST', skipCache: true, record: false });
  return { kind: p.kind, result: r.data };
}

/** A 65-byte 0x signature → {r, s, v} with v as 27/28. */
export function splitSignature(hex: string): { r: string; s: string; v: number } {
  const m = /^0x([0-9a-fA-F]{64})([0-9a-fA-F]{64})([0-9a-fA-F]{2})$/.exec(hex);
  if (!m) throw new Error('Expected a 65-byte signature.');
  const v = parseInt(m[3], 16);
  return { r: `0x${m[1]}`, s: `0x${m[2]}`, v: v < 27 ? v + 27 : v };
}

/** EIP-712 as eth_signTypedData_v4 wants it: the domain type spelled out. */
export function typedDataForWallet(eip712: Row): Row {
  const domain = (eip712.domain ?? {}) as Row;
  const types = { ...((eip712.types ?? {}) as Row) };
  if (!types.EIP712Domain) {
    const order: Array<[string, string]> = [['name', 'string'], ['version', 'string'], ['chainId', 'uint256'], ['verifyingContract', 'address'], ['salt', 'bytes32']];
    types.EIP712Domain = order.filter(([k]) => k in domain).map(([name, type]) => ({ name, type }));
  }
  return { ...eip712, types };
}
