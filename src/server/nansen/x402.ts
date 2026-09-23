// x402 pay-per-call, server side. Keyless visitors pay Nansen directly,
// per call, in USDC from their own wallet; TIDE never holds funds and never
// signs. Two steps, both through this server so the request body is
// schema-checked and the call is logged:
//
//   quote(endpoint, body, payer)  — the unpaid request; Nansen answers 402
//                                   with its price. Free.
//   paidCall(endpoint, body, sig) — the same request with the PAYMENT-
//                                   SIGNATURE the user's wallet produced
//                                   after seeing that price.
//
// The paid response belongs to the payer (they are the licensee), so it is
// returned to them only: never cached, never recorded as a fixture, never
// shown to anyone else.
import { z } from 'zod';
import { verifyTypedData } from 'viem';
import { ENDPOINTS, type EndpointKey } from '@/types/nansen/api.gen';
import {
  S_PaymentRequired, S_PaymentPayload, S_SettleResponse, decodeHeader, signable, priceUsd,
  X402_MAX_PRICE_USD, TRANSFER_WITH_AUTHORIZATION, type X402Quote, type SettleResponse, type PaymentRequired,
} from '@/lib/x402';
import { getDb } from './db';

const ORIGIN = 'https://api.nansen.ai';

export class X402Error extends Error {
  constructor(message: string, public readonly status = 400) { super(message); this.name = 'X402Error'; }
}

export const x402Enabled = () => process.env.DEMO_MODE !== '1' && process.env.X402_ENABLED !== '0';

// ---- discovery ------------------------------------------------------------

const S_Discovery = z.looseObject({ resources: z.array(z.string()), paymentProtocols: z.array(z.string()).optional() });
let discovered: { at: number; resources: Set<string> } | null = null;

/** Nansen's own list of pay-per-call resources ("POST /api/v1/…"), read
 *  from /.well-known/x402 and kept for an hour. */
export async function x402Resources(): Promise<Set<string>> {
  if (discovered && Date.now() - discovered.at < 3_600_000) return discovered.resources;
  const r = await fetch(`${ORIGIN}/.well-known/x402`, { cache: 'no-store' });
  if (!r.ok) throw new X402Error(`Nansen x402 discovery responded ${r.status}`, 502);
  const d = S_Discovery.safeParse(await r.json());
  if (!d.success) throw new X402Error('Nansen x402 discovery returned an unexpected shape', 502);
  discovered = { at: Date.now(), resources: new Set(d.data.resources) };
  return discovered.resources;
}

/** The generated contract entry for a client-form endpoint
 *  ("smart-money/dex-trades"), if Nansen sells it per call. */
export async function payableEndpoint(endpoint: string): Promise<EndpointKey> {
  const key = (Object.keys(ENDPOINTS) as EndpointKey[]).find((k) => ENDPOINTS[k].endpoint === endpoint && ENDPOINTS[k].method === 'POST');
  if (!key) throw new X402Error(`Unknown Nansen endpoint: ${endpoint}`, 404);
  const spec = ENDPOINTS[key];
  const security: readonly string[] = spec.security;
  const listed = (await x402Resources()).has(`POST ${spec.path}`);
  if (!security.includes('X402Payment') || !listed) throw new X402Error(`${endpoint} is not sold per call (x402); it needs a Nansen API key.`, 403);
  return key;
}

function checkBody(key: EndpointKey, body: unknown): void {
  const schema = ENDPOINTS[key].request;
  if (!schema) throw new X402Error(`${ENDPOINTS[key].endpoint} takes no request body.`, 422);
  const r = schema.safeParse(body);
  if (!r.success) throw new X402Error(`Request body does not match Nansen's schema for ${ENDPOINTS[key].endpoint}: ${r.error.issues[0]?.path.join('.') || '(root)'} ${r.error.issues[0]?.message ?? ''}`.trim(), 422);
}

const EVM = /^0x[0-9a-fA-F]{40}$/;

async function send(key: EndpointKey, body: unknown, headers: Record<string, string>): Promise<Response> {
  return fetch(`${ORIGIN}${ENDPOINTS[key].path}`, {
    method: 'POST', cache: 'no-store',
    headers: { 'content-type': 'application/json', accept: 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

async function paymentRequired(r: Response): Promise<PaymentRequired | null> {
  const h = r.headers.get('payment-required');
  const fromHeader = h ? decodeHeader(h, S_PaymentRequired) : null;
  if (fromHeader) return fromHeader;
  const body: unknown = await r.json().catch(() => null);
  const parsed = S_PaymentRequired.safeParse(body);
  return parsed.success ? parsed.data : null;
}

// ---- quote ------------------------------------------------------------------

/** Nansen's current price for this exact request. Sends X-Payer-Address
 *  when the wallet is known, so a first-100-calls discount shows up in the
 *  quote. Costs nothing. */
export async function quote(endpoint: string, body: unknown, payer: string | null): Promise<X402Quote> {
  if (!x402Enabled()) throw new X402Error('Pay-per-call is off on this instance.', 503);
  const key = await payableEndpoint(endpoint);
  checkBody(key, body);
  const r = await send(key, body, payer && EVM.test(payer) ? { 'x-payer-address': payer } : {});
  if (r.status !== 402) {
    const text = await r.text().catch(() => '');
    throw new X402Error(`Expected a price from Nansen, got ${r.status}: ${text.slice(0, 200)}`, 502);
  }
  const pr = await paymentRequired(r);
  if (!pr) throw new X402Error('Nansen answered 402 without readable payment requirements.', 502);
  const options = pr.accepts
    .map((requirement) => ({ requirement, s: signable(requirement), usd: priceUsd(requirement) }))
    .filter((o): o is typeof o & { s: NonNullable<typeof o.s>; usd: number } => !!o.s && o.usd != null)
    .map((o) => ({ requirement: o.requirement, network: o.s.name, chainId: o.s.chainId, priceUsd: o.usd }))
    .sort((a, b) => a.priceUsd - b.priceUsd);
  const unsupported = [...new Set(pr.accepts.filter((a) => !signable(a)).map((a) => a.network))];
  return { endpoint, resource: pr.resource, options, unsupported, payer: payer && EVM.test(payer) ? payer : null };
}

// ---- paid call ----------------------------------------------------------------

/** Checks a signed payment before it leaves this server: a V2 payload for
 *  an option TIDE offers, under the price ceiling, paying the requirement's
 *  own recipient the requirement's own amount, not expired, and signed by
 *  the wallet it claims. Nansen's facilitator checks all of this again;
 *  doing it here means a malformed or tampered payment never reaches it. */
export async function checkPayment(header: string, nowSec = Math.floor(Date.now() / 1000)) {
  const p = decodeHeader(header, S_PaymentPayload);
  if (!p) throw new X402Error('Unreadable payment: expected a base64 x402 V2 payload.');
  const req = p.accepted, auth = p.payload.authorization;
  const s = signable(req);
  if (!s) throw new X402Error(`TIDE does not offer ${req.network} payments.`);
  const usd = priceUsd(req)!;
  if (usd > X402_MAX_PRICE_USD) throw new X402Error(`Price ${usd} USD is above this instance's per-call ceiling of ${X402_MAX_PRICE_USD} USD.`);
  if (auth.to.toLowerCase() !== req.payTo.toLowerCase()) throw new X402Error('Payment recipient does not match the quote.');
  if (auth.value !== req.amount) throw new X402Error('Payment amount does not match the quote.');
  if (Number(auth.validBefore) <= nowSec) throw new X402Error('Payment authorization has expired; request a fresh price.');
  const ok = await verifyTypedData({
    address: auth.from as `0x${string}`,
    domain: { name: req.extra!.name!, version: req.extra!.version!, chainId: s.chainId, verifyingContract: req.asset as `0x${string}` },
    types: { TransferWithAuthorization: TRANSFER_WITH_AUTHORIZATION },
    primaryType: 'TransferWithAuthorization',
    message: {
      from: auth.from as `0x${string}`, to: auth.to as `0x${string}`, value: BigInt(auth.value),
      validAfter: BigInt(auth.validAfter), validBefore: BigInt(auth.validBefore), nonce: auth.nonce as `0x${string}`,
    },
    signature: p.payload.signature as `0x${string}`,
  }).catch(() => false);
  if (!ok) throw new X402Error('Payment signature does not match the paying wallet.');
  return { payload: p, usd, network: s.name };
}

function logPayment(row: { userId: number | null; payer: string; network: string; endpoint: string; amount: string; usd: number; status: string; tx?: string | null; error?: string | null }) {
  getDb().prepare('INSERT INTO payments (user_id, payer, network, endpoint, amount, amount_usd, status, tx, error, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(row.userId, row.payer, row.network, row.endpoint, row.amount, row.usd, row.status, row.tx ?? null, row.error?.slice(0, 300) ?? null, Date.now());
}

/** Nansen passes the facilitator's verdict through as text, often with a
 *  JSON body inside; say what it means in a sentence. */
export function explainRejection(raw: string, network: string): string {
  const text = raw.trim();
  let reason = '', detail = '';
  const json = text.match(/\{[\s\S]*\}/);
  if (json) {
    try {
      const j = JSON.parse(json[0]) as { invalidReason?: string; invalidMessage?: string; errorReason?: string };
      reason = j.invalidReason ?? j.errorReason ?? '';
      detail = j.invalidMessage ?? '';
    } catch { /* not JSON; fall through to the text */ }
  }
  const r = `${reason} ${detail} ${text}`.toLowerCase();
  if (r.includes('insufficient') || r.includes('execution reverted') || r.includes('transfer amount exceeds balance')) {
    return `the USDC transfer would not go through, most often because the wallet has too little USDC on ${network}`;
  }
  if (r.includes('signature')) return 'the signature was not accepted';
  if (r.includes('expired') || r.includes('valid_before')) return 'the authorization expired; get a fresh price and try again';
  if (r.includes('nonce')) return 'this authorization was already used';
  return (reason || text).replace(/\s+/g, ' ').slice(0, 160);
}

export interface PaidResult { data: unknown; settlement: SettleResponse | null; priceUsd: number; network: string; schemaOk: boolean }

export async function paidCall(endpoint: string, body: unknown, header: string, userId: number | null): Promise<PaidResult> {
  if (!x402Enabled()) throw new X402Error('Pay-per-call is off on this instance.', 503);
  const key = await payableEndpoint(endpoint);
  checkBody(key, body);
  const { payload, usd, network } = await checkPayment(header);
  const base = { userId, payer: payload.payload.authorization.from, network, endpoint, amount: payload.accepted.amount, usd };

  const r = await send(key, body, { 'payment-signature': header });
  const settleHeader = r.headers.get('payment-response');
  const settlement = settleHeader ? decodeHeader(settleHeader, S_SettleResponse) : null;

  if (r.status === 402) {
    const pr = await paymentRequired(r);
    const raw = pr?.error ?? 'payment not accepted';
    logPayment({ ...base, status: 'rejected', error: raw });
    throw new X402Error(`Nansen did not accept the payment: ${explainRejection(raw, network)}. Nothing was charged.`, 402);
  }
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    logPayment({ ...base, status: settlement?.success ? 'settled-error' : 'failed', tx: settlement?.transaction, error: `${r.status} ${text}` });
    throw new X402Error(`Nansen responded ${r.status}: ${text.slice(0, 200)}`, 502);
  }
  const data: unknown = await r.json();
  const schemaOk = ENDPOINTS[key].response.safeParse(data).success;
  logPayment({ ...base, status: 'settled', tx: settlement?.transaction });
  return { data, settlement, priceUsd: usd, network, schemaOk };
}

export function paymentStats(sinceMs: number) {
  return getDb().prepare(`
    SELECT endpoint, status, COUNT(*) AS n, COALESCE(SUM(amount_usd), 0) AS usd
    FROM payments WHERE at >= ? GROUP BY endpoint, status ORDER BY n DESC
  `).all(sinceMs) as Array<{ endpoint: string; status: string; n: number; usd: number }>;
}
