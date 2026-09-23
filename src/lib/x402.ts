// x402 V2 pay-per-call, the parts both sides need: the wire shapes Nansen
// sends and accepts, which payment options TIDE can sign, the EIP-3009
// typed data a wallet signs, and the header encoding. Browser and server
// import the same code, so the payment the wallet signs is exactly the one
// the server checks before forwarding it to Nansen.
//
// Spec: x402 V2 (PAYMENT-REQUIRED / PAYMENT-SIGNATURE / PAYMENT-RESPONSE
// headers, base64 JSON). Nansen accepts V2 only; see
// https://docs.nansen.ai/getting-started/agentic-payments/x402-payments
import { z } from 'zod';

export const S_PaymentRequirement = z.looseObject({
  scheme: z.string(),
  network: z.string(),
  asset: z.string(),
  amount: z.string().regex(/^\d+$/),
  payTo: z.string(),
  maxTimeoutSeconds: z.number().int().positive(),
  extra: z.looseObject({
    name: z.string().optional(),
    version: z.string().optional(),
    assetTransferMethod: z.string().optional(),
  }).nullish(),
});
export type PaymentRequirement = z.infer<typeof S_PaymentRequirement>;

export const S_ResourceInfo = z.looseObject({ url: z.string(), description: z.string().nullish(), mimeType: z.string().nullish() });
export type ResourceInfo = z.infer<typeof S_ResourceInfo>;

export const S_PaymentRequired = z.looseObject({
  x402Version: z.literal(2),
  error: z.string().nullish(),
  resource: S_ResourceInfo,
  accepts: z.array(S_PaymentRequirement),
});
export type PaymentRequired = z.infer<typeof S_PaymentRequired>;

export const S_Authorization = z.object({
  from: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  to: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  value: z.string().regex(/^\d+$/),
  validAfter: z.string().regex(/^\d+$/),
  validBefore: z.string().regex(/^\d+$/),
  nonce: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
});
export type Authorization = z.infer<typeof S_Authorization>;

export const S_PaymentPayload = z.object({
  x402Version: z.literal(2),
  resource: S_ResourceInfo.optional(),
  accepted: S_PaymentRequirement,
  payload: z.object({ signature: z.string().regex(/^0x[0-9a-fA-F]+$/), authorization: S_Authorization }),
  extensions: z.record(z.string(), z.unknown()).optional(),
});
export type PaymentPayload = z.infer<typeof S_PaymentPayload>;

export const S_SettleResponse = z.looseObject({
  success: z.boolean(),
  transaction: z.string().nullish(),
  network: z.string().nullish(),
  payer: z.string().nullish(),
  amount: z.string().nullish(),
  errorReason: z.string().nullish(),
});
export type SettleResponse = z.infer<typeof S_SettleResponse>;

/** The payment options TIDE can sign: USDC with EIP-3009
 *  transferWithAuthorization on EVM networks a browser wallet can switch to.
 *  Nansen also offers Solana USDC (needs a partially signed transaction
 *  built on a recent blockhash, i.e. a Solana RPC, which would be a second
 *  data source) and permit2 stables on BNB Chain; those are listed but not
 *  offered here. */
export const SIGNABLE: ReadonlyArray<{ network: string; asset: string; chainId: number; name: string; decimals: number }> = [
  { network: 'eip155:8453', asset: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', chainId: 8453, name: 'Base', decimals: 6 },
  { network: 'eip155:143', asset: '0x754704bc059f8c67012fed69bc8a327a5aafb603', chainId: 143, name: 'Monad', decimals: 6 },
];

export function signable(req: PaymentRequirement) {
  if (req.scheme !== 'exact') return null;
  const method = req.extra?.assetTransferMethod;
  if (method && method !== 'eip3009') return null;
  if (!req.extra?.name || !req.extra?.version) return null; // EIP-712 domain needs both
  return SIGNABLE.find((s) => s.network === req.network && s.asset === req.asset.toLowerCase()) ?? null;
}

/** USD value of a requirement's amount, for the price on the button.
 *  Only defined for options TIDE can sign (USDC, 6 decimals). */
export function priceUsd(req: PaymentRequirement): number | null {
  const s = signable(req);
  return s ? Number(req.amount) / 10 ** s.decimals : null;
}

export function formatPrice(usd: number): string {
  return usd < 0.01 ? `$${usd.toFixed(4).replace(/0+$/, '')}` : `$${usd.toFixed(2)}`;
}

/** Hard ceiling on a single pay-per-call price, checked in the browser
 *  before asking the wallet and again on the server before forwarding. */
export const X402_MAX_PRICE_USD = 1;

export const TRANSFER_WITH_AUTHORIZATION = [
  { name: 'from', type: 'address' },
  { name: 'to', type: 'address' },
  { name: 'value', type: 'uint256' },
  { name: 'validAfter', type: 'uint256' },
  { name: 'validBefore', type: 'uint256' },
  { name: 'nonce', type: 'bytes32' },
] as const;

export function buildAuthorization(req: PaymentRequirement, from: string, nowSec: number, nonce: string): Authorization {
  return {
    from, to: req.payTo, value: req.amount,
    // A little slack for clock skew, as the reference client does.
    validAfter: String(nowSec - 600),
    validBefore: String(nowSec + req.maxTimeoutSeconds),
    nonce,
  };
}

/** EIP-712 typed data for eth_signTypedData_v4 (and viem's
 *  signTypedData / verifyTypedData, which take the same fields). */
export function typedDataFor(req: PaymentRequirement, auth: Authorization) {
  const s = signable(req);
  if (!s) throw new Error(`TIDE cannot sign a ${req.network} payment`);
  return {
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
      ],
      TransferWithAuthorization: TRANSFER_WITH_AUTHORIZATION,
    },
    primaryType: 'TransferWithAuthorization' as const,
    domain: { name: req.extra!.name!, version: req.extra!.version!, chainId: s.chainId, verifyingContract: req.asset },
    message: auth,
  };
}

// UTF-8-safe base64 in both the browser and Node (token names such as
// "USD₮0" are not Latin-1, so plain btoa would throw).
function toB64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
function fromB64(s: string): string {
  const bin = atob(s.trim());
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export function encodeHeader(v: unknown): string {
  return toB64(JSON.stringify(v));
}

export function decodeHeader<T>(value: string, schema: z.ZodType<T>): T | null {
  try {
    const r = schema.safeParse(JSON.parse(fromB64(value)));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

export function paymentPayload(resource: ResourceInfo, req: PaymentRequirement, auth: Authorization, signature: string): PaymentPayload {
  return { x402Version: 2, resource, accepted: req, payload: { signature, authorization: auth }, extensions: {} };
}

/** What the quote route returns to the browser: the signable options with
 *  their prices, the cheapest first, and the ones TIDE cannot sign named so
 *  the user knows they exist. */
export interface X402Quote {
  endpoint: string;
  resource: ResourceInfo;
  options: Array<{ requirement: PaymentRequirement; network: string; chainId: number; priceUsd: number }>;
  unsupported: string[];
  payer: string | null;
}
