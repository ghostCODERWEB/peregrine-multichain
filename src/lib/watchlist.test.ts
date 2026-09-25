import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isWatched, toggleWatch, watchlist } from './watchlist';

const KEY = 'peregrine-watchlist';
const evm = `0x${'aB'.repeat(20)}`;
const row = (address = evm, chain = 'base') => ({ chain, address, symbol: 'TEST', at: 123 });
let stored: Map<string, string>;
let dispatch: ReturnType<typeof vi.fn>;

beforeEach(() => {
  stored = new Map();
  dispatch = vi.fn();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value),
  });
  vi.stubGlobal('window', { dispatchEvent: dispatch });
});
afterEach(() => vi.unstubAllGlobals());

describe('browser watchlist', () => {
  it.each(['not JSON', '{}', 'null', '42'])('rejects malformed storage: %s', value => {
    stored.set(KEY, value);
    expect(watchlist()).toEqual([]);
    expect(isWatched('base', evm)).toBe(false);
  });

  it('filters invalid rows before using their addresses', () => {
    stored.set(KEY, JSON.stringify([null, {}, 2, { ...row(), address: 4 }, { ...row(), at: -1 }, row()]));
    expect(watchlist()).toEqual([row()]);
    expect(isWatched('base', evm)).toBe(true);
  });

  it('deduplicates EVM addresses without merging chains', () => {
    stored.set(KEY, JSON.stringify([row(), row(evm.toLowerCase()), row(evm, 'ethereum')]));
    expect(watchlist()).toHaveLength(2);
    expect(isWatched('base', evm.toUpperCase())).toBe(true);
    expect(isWatched('arbitrum', evm)).toBe(false);
  });

  it('keeps case-sensitive non-EVM token identities distinct', () => {
    const first = row('AbCdef123', 'solana'), second = row('abcDef123', 'solana');
    expect(toggleWatch(first)).toBe(true);
    expect(isWatched('solana', second.address)).toBe(false);
    expect(toggleWatch(second)).toBe(true);
    expect(watchlist()).toHaveLength(2);
    expect(toggleWatch(first)).toBe(false);
    expect(watchlist().map(w => w.address)).toEqual([second.address]);
  });

  it('adds newest first, enforces the 50-item cap, and emits one event', () => {
    stored.set(KEY, JSON.stringify(Array.from({ length: 55 }, (_, i) => row(`token-${i}`))));
    expect(watchlist()).toHaveLength(50);
    expect(toggleWatch(row('new-token'))).toBe(true);
    expect(watchlist()).toHaveLength(50);
    expect(watchlist()[0].address).toBe('new-token');
    expect(watchlist().at(-1)?.address).toBe('token-48');
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0][0].type).toBe('peregrine-watchlist');
  });

  it('removes an EVM token using a differently cased address', () => {
    stored.set(KEY, JSON.stringify([row()]));
    expect(toggleWatch(row(evm.toLowerCase()))).toBe(false);
    expect(watchlist()).toEqual([]);
  });

  it('tolerates blocked reads and writes without announcing a successful change', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('quota'); },
    });
    expect(watchlist()).toEqual([]);
    expect(toggleWatch(row())).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });
});
