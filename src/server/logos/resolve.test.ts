import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const cache = vi.hoisted(() => new Map<string, { value: string; updatedAt: number }>());
vi.mock('@/server/nansen/db', () => ({
  getKv: (key: string) => cache.get(key),
  setKv: (key: string, value: string) => cache.set(key, { value, updatedAt: Date.now() }),
}));
import { tokenLogo } from './resolve';

const mint = 'AbcDEFGHJKLMNPQRSTUVWXYZ123456789abc';
const evm = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';
const response = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const pair = (address: string, imageUrl: unknown) => ({ baseToken: { address }, info: { imageUrl } });

describe('token logo identity and fallback', () => {
  beforeEach(() => {
    cache.clear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects case-folded Solana matches and selects the exact mint', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        response([pair(mint.toLowerCase(), 'https://images.test/wrong.png'), pair(mint, 'https://images.test/right.png')]),
      );
    vi.stubGlobal('fetch', fetch);
    expect(await tokenLogo('solana', mint)).toBe('https://images.test/right.png');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('falls back to Jupiter when only the wrong-case mint was returned', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response([pair(mint.toLowerCase(), 'https://images.test/wrong.png')]))
      .mockResolvedValueOnce(response([{ id: mint, icon: 'https://images.test/jupiter.png' }]));
    vi.stubGlobal('fetch', fetch);
    expect(await tokenLogo('solana', mint)).toBe('https://images.test/jupiter.png');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('shares EVM cache entries across casing but not chains', async () => {
    const fetch = vi.fn().mockImplementation(async () => response([pair(evm.toUpperCase(), 'https://images.test/evm.png')]));
    vi.stubGlobal('fetch', fetch);
    expect(await tokenLogo('base', evm)).toBe('https://images.test/evm.png');
    expect(await tokenLogo('base', evm.toUpperCase())).toBe('https://images.test/evm.png');
    await tokenLogo('ethereum', evm);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('keeps distinct base58 cache entries and ignores pre-fix cached images', async () => {
    cache.set(`logo:solana:${mint}`, { value: 'https://images.test/old-wrong.png', updatedAt: Date.now() });
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response([pair(mint, 'https://images.test/one.png')]))
      .mockResolvedValueOnce(response([pair(mint.toLowerCase(), 'https://images.test/two.png')]));
    vi.stubGlobal('fetch', fetch);
    expect(await tokenLogo('solana', mint)).toBe('https://images.test/one.png');
    expect(await tokenLogo('solana', mint.toLowerCase())).toBe('https://images.test/two.png');
  });

  it('skips malformed rows and unsafe image URLs without losing a valid fallback', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response([null, pair(mint, 42), pair(mint, 'http://images.test/unsafe.png')]))
      .mockResolvedValueOnce(response([null, { id: mint, icon: 42 }, { id: mint, icon: 'https://images.test/safe.png' }]));
    vi.stubGlobal('fetch', fetch);
    expect(await tokenLogo('solana', mint)).toBe('https://images.test/safe.png');
  });
});
