// A Nansen call plus the ⓘ reference for it: the request as sent, its
// credit cost, and the response-cache key it is stored under, so every
// number on screen names the exact cached response behind it.
import { callNansen, type CallOptions } from './client';
import { cacheKey } from './cache';
import type { NansenCallRef } from '@/lib/provenance';

export type Unavailable = { unavailable: string };
export type Wave<T> = T | Unavailable;
export const isUnavailable = <T,>(w: Wave<T> | undefined): w is Unavailable => !!w && typeof w === 'object' && 'unavailable' in w;

export async function traced<T>(endpoint: string, body: unknown, credits: number, options: CallOptions = {}): Promise<{ data: T; call: NansenCallRef }> {
  const r = await callNansen<T>(endpoint, body, options);
  const key = cacheKey(endpoint, body);
  return { data: r.data, call: { endpoint, body, credits, ref: `${r.meta.cacheHit ? 'cache' : 'live'} · ${key.slice(0, endpoint.length + 9)}` } };
}

export const errText = (e: unknown) => `Nansen call failed: ${(e as Error).message.slice(0, 160)}`;
