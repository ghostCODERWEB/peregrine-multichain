import { describe, it, expect } from 'vitest';
import { identity, inferRotations, type FundingLink } from './inferred-rotations';
import type { Trade } from './rotation-fronts';

const now = 1_800_000_000_000;
const evm = (n: number) => `0x${n.toString(16).padStart(40, '0')}`;
const t = (wallet: string, chain: string, side: Trade['side'], usdValue = 100, timestamp = now - (side === 'sell' ? 2000 : 1000)): Trade => ({ wallet, chain, side, usdValue, timestamp });
const link = (n: number): FundingLink => ({ child: { address: `Solana${n}AbC`, chain: 'solana' }, funder: { address: evm(n), chain: 'base' }, at: now - 3000, transactionHash: `test-funding-${n}`, endpoint: 'profiler/address/related-wallets', request: { address: `Solana${n}AbC`, chain: 'solana' } });
const trades = [1, 2].flatMap((n) => [t(`Solana${n}AbC`, 'solana', 'sell', 100), t(evm(n), 'base', 'buy', 80)]);

describe('inferred rotation hypotheses (synthetic evidence, not live claims)', () => {
  it('requires two direct independent groups and reports matched notional', () => {
    expect(inferRotations(trades, [link(1)], now)).toEqual([]);
    const [f] = inferRotations(trades, [link(1), link(2)], now);
    expect(f).toMatchObject({ from: 'solana', to: 'base', netUsd: 160, groups: 2 });
    expect(f.matches[0]).toMatchObject({ soldUsd: 100, boughtUsd: 80, matchedUsd: 80 });
  });
  it('does not infer identity from similar trades, transitive links or shared funders', () => {
    expect(inferRotations(trades, [], now)).toEqual([]);
    const shared = [link(1), link(2)].map((e) => ({ ...e, funder: { address: evm(9), chain: 'base' } }));
    expect(inferRotations(trades, shared, now)).toEqual([]);
    const connected = [...[link(1), link(2)], { ...link(1), child: link(1).funder, funder: link(2).funder }];
    expect(inferRotations(trades, connected, now)).toEqual([]);
  });
  it('preserves base58 case and chain scope, normalizing only EVM identities', () => {
    expect(identity({ address: 'Abc', chain: 'solana' })).not.toBe(identity({ address: 'abc', chain: 'solana' }));
    expect(identity({ address: 'Abc', chain: 'solana' })).not.toBe(identity({ address: 'Abc', chain: 'ton' }));
    expect(identity({ address: evm(12).toUpperCase().replace('0X', '0x'), chain: 'base' })).toBe(identity({ address: evm(12), chain: 'ethereum' }));
  });
  it('rejects future, invalid, late-funded and out-of-window observations', () => {
    const links = [link(1), link(2)];
    for (const bad of [NaN, now + 1, now - 500]) expect(inferRotations(trades, links.map((e) => ({ ...e, at: bad })), now)).toEqual([]);
    expect(inferRotations(trades.map((x) => ({ ...x, timestamp: now + 1 })), links, now)).toEqual([]);
    expect(inferRotations(trades.map((x) => x.side === 'sell' ? { ...x, timestamp: now - 13 * 3_600_000 } : x), links.map((e) => ({ ...e, at: now - 14 * 3_600_000 })), now)).toEqual([]);
    expect(inferRotations(trades.map((x) => ({ ...x, usdValue: NaN })), links, now)).toEqual([]);
  });
  it('consumes each buy at most once and excludes observed rotation wallets', () => {
    const links = [link(1), link(2)];
    expect(inferRotations([...trades, t('Solana1AbC', 'solana', 'sell')], links, now)[0].netUsd).toBe(160);
    expect(inferRotations([...trades, t(evm(1), 'ethereum', 'sell', 20)], links, now)).toEqual([]);
  });
  it('nets reverse matches without merging opposite candidate direction', () => {
    const extra = [t(evm(1), 'base', 'sell', 10, now - 500), t('Solana1AbC', 'solana', 'buy', 10, now - 100)];
    expect(inferRotations([...trades, ...extra], [link(1), link(2)], now)[0]).toMatchObject({ netUsd: 150, grossForward: 160, grossBack: 10 });
  });
});
