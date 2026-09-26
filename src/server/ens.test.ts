import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getEnsName: vi.fn(),
  getEnsAddress: vi.fn(),
  cache: new Map<string, { value: string; updatedAt: number }>(),
}));
vi.mock('viem', async (importOriginal) => ({
  ...await importOriginal<typeof import('viem')>(),
  createPublicClient: () => ({ getEnsName: mocks.getEnsName, getEnsAddress: mocks.getEnsAddress }),
}));
vi.mock('@/server/nansen/db', () => ({
  getKv: (key: string) => mocks.cache.get(key),
  setKv: (key: string, value: string) => mocks.cache.set(key, { value, updatedAt: Date.now() }),
}));
import { ensAddress, ensName } from './ens';

const wallet = '0x1111111111111111111111111111111111111111';

describe('ENS primary-name trust boundary', () => {
  beforeEach(() => {
    mocks.cache.clear();
    mocks.getEnsName.mockReset();
    mocks.getEnsAddress.mockReset();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Unexpected network request')));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('does not turn an arbitrary forward alias into a primary name', async () => {
    mocks.getEnsAddress.mockResolvedValue(wallet);
    mocks.getEnsName.mockResolvedValue('actual-primary.eth');
    expect(await ensAddress('untrusted-alias.eth')).toBe(wallet);
    expect(await ensName(wallet)).toBe('actual-primary.eth');
    expect(mocks.getEnsName).toHaveBeenCalledTimes(1);
    expect(mocks.cache.get(`ens3:name:${wallet}`)?.value).toBe('actual-primary.eth');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('bypasses legacy reverse-cache entries that forward resolution could seed', async () => {
    mocks.cache.set(`ens2:name:${wallet}`, { value: 'untrusted-alias.eth', updatedAt: Date.now() });
    mocks.getEnsName.mockResolvedValue(null);
    expect(await ensName(wallet)).toBeNull();
    expect(mocks.getEnsName).toHaveBeenCalledTimes(1);
  });

  it('does not promote a public API forward result either', async () => {
    mocks.getEnsAddress.mockResolvedValue(null);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ address: wallet }))));
    mocks.getEnsName.mockResolvedValue(null);
    expect(await ensAddress('another-alias.eth')).toBe(wallet);
    expect(await ensName(wallet)).toBeNull();
    expect(mocks.getEnsName).toHaveBeenCalledTimes(1);
  });

  it('still caches independently verified primary names', async () => {
    mocks.getEnsName.mockResolvedValue('actual-primary.eth');
    expect(await ensName(wallet)).toBe('actual-primary.eth');
    expect(await ensName(wallet)).toBe('actual-primary.eth');
    expect(mocks.getEnsName).toHaveBeenCalledTimes(1);
  });
});
