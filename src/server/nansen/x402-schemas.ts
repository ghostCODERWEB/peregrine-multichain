// Runtime checks for the x402 V2 wire shapes in src/lib/x402.ts. Server
// only: everything arriving from Nansen or from a browser is parsed here
// before it is trusted.
import { z } from 'zod';
import {
  decodeHeaderJson, type PaymentRequirement, type ResourceInfo, type PaymentRequired, type PaymentPayload, type SettleResponse,
} from '@/lib/x402';

export const S_PaymentRequirement: z.ZodType<PaymentRequirement> = z.looseObject({
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

export const S_ResourceInfo: z.ZodType<ResourceInfo> = z.looseObject({ url: z.string(), description: z.string().nullish(), mimeType: z.string().nullish() });

export const S_PaymentRequired: z.ZodType<PaymentRequired> = z.looseObject({
  x402Version: z.literal(2),
  error: z.string().nullish(),
  resource: S_ResourceInfo,
  accepts: z.array(S_PaymentRequirement),
});

const EVM = /^0x[0-9a-fA-F]{40}$/;
const UINT = /^\d+$/;

export const S_PaymentPayload: z.ZodType<PaymentPayload> = z.object({
  x402Version: z.literal(2),
  resource: S_ResourceInfo.optional(),
  accepted: S_PaymentRequirement,
  payload: z.object({
    signature: z.string().regex(/^0x[0-9a-fA-F]+$/),
    authorization: z.object({
      from: z.string().regex(EVM), to: z.string().regex(EVM), value: z.string().regex(UINT),
      validAfter: z.string().regex(UINT), validBefore: z.string().regex(UINT), nonce: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
    }),
  }),
  extensions: z.record(z.string(), z.unknown()).optional(),
});

export const S_SettleResponse: z.ZodType<SettleResponse> = z.looseObject({
  success: z.boolean(),
  transaction: z.string().nullish(),
  network: z.string().nullish(),
  payer: z.string().nullish(),
  amount: z.string().nullish(),
  errorReason: z.string().nullish(),
});

/** A base64-JSON x402 header, parsed and checked; null when unreadable. */
export function decodeHeader<T>(value: string, schema: z.ZodType<T>): T | null {
  const r = schema.safeParse(decodeHeaderJson(value));
  return r.success ? r.data : null;
}
