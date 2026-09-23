// x402 V2 pay-per-call, the parts both sides need: the wire shapes Nansen
// sends and accepts, which payment options TIDE can sign, the EIP-3009
// typed data a wallet signs, and the header encoding. Browser and server
// import the same code, so the payment the wallet signs is exactly the one
// the server checks before forwarding it to Nansen.
//
// Spec: x402 V2 (PAYMENT-REQUIRED / PAYMENT-SIGNATURE / PAYMENT-RESPONSE
// headers, base64 JSON). Nansen accepts V2 only; see
// https://docs.nansen.ai/getting-started/agentic-payments/x402-payments

// Wire types. The Zod schemas that check them live server-side
// (src/server/nansen/x402-schemas.ts) so zod stays out of the browser.
export interface PaymentRequirement {
  scheme: string;
  network: string;
  asset: string;
  /** Atomic units, decimal string. */
  amount: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra?: { name?: string; version?: string; assetTransferMethod?: string; [k: string]: unknown } | null;
}
export interface ResourceInfo { url: string; description?: string | null; mimeType?: string | null }
export interface PaymentRequired { x402Version: 2; error?: string | null; resource: ResourceInfo; accepts: PaymentRequirement[] }
export interface Authorization { from: string; to: string; value: string; validAfter: string; validBefore: string; nonce: string }
export interface PaymentPayload {
  x402Version: 2;
  resource?: ResourceInfo;
  accepted: PaymentRequirement;
  payload: { signature: string; authorization: Authorization };
  extensions?: Record<string, unknown>;
}
export interface SettleResponse {
  success: boolean; transaction?: string | null; network?: string | null; payer?: string | null; amount?: string | null; errorReason?: string | null;
}

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

/** The header's JSON, unchecked; validate before trusting it. */
export function decodeHeaderJson(value: string): unknown {
  try {
    return JSON.parse(fromB64(value));
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
