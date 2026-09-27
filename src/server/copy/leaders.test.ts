import { describe, it, expect } from 'vitest';
import { copyScore, mergeBoards, traderKind, consensusOf, toTokens } from './leaders';
import { pmScore } from './predict-leaders';
import { cohortBoards } from './cohorts';
import { copyTargets } from './targets';

const row = (address: string, pnl: number, extra: Record<string, unknown> = {}) => ({
  address, address_label: null, total_pnl_usd: pnl, realized_pnl_usd: pnl * 0.8, unrealized_pnl_usd: pnl * 0.2,
  win_rate: 0.6, avg_trade_roi: 0.2, n_trades: 120, n_tokens: 12, open_trades: 3, held_tokens_count: 4, ...extra,
});

describe('copyScore (spot)', () => {
  const w = (pnl: number, o: Partial<{ trades: number; tokens: number; winRate: number }> = {}) =>
    ({ pnl, realized: pnl * 0.8, unrealized: pnl * 0.2, winRate: o.winRate ?? 0.6, avgRoi: 0.2, trades: o.trades ?? 120, tokens: o.tokens ?? 12, held: 3 });
  it('rewards profit that repeats across windows', () => {
    const steady = copyScore({ 7: w(1e5), 30: w(5e5), 90: w(1e6) }, 30).score;
    const flip = copyScore({ 7: w(-1e5), 30: w(5e5), 90: w(-2e5) }, 30).score;
    expect(steady).toBeGreaterThan(flip);
    expect(steady).toBeGreaterThanOrEqual(65);
  });
  it('marks down one-token luck and bots', () => {
    const base = copyScore({ 30: w(5e5) }, 30).score;
    expect(copyScore({ 30: w(5e5, { tokens: 1 }) }, 30).score).toBeLessThan(base);
    expect(copyScore({ 30: w(5e5, { trades: 30 * 200 }) }, 30).score).toBeLessThan(base);
  });
  it('stays within 0 to 100', () => {
    const s = copyScore({ 7: w(1e9), 30: w(1e9), 90: w(1e9) }, 30).score;
    expect(s).toBeLessThanOrEqual(100);
    expect(copyScore({ 30: w(-1e9, { winRate: 0, tokens: 1, trades: 1e6 }) }, 30).score).toBeGreaterThanOrEqual(0);
  });
});

describe('mergeBoards', () => {
  it('joins windows per wallet, case-insensitively for EVM, and ranks by score', () => {
    const ls = mergeBoards({ 30: [row('0xAbC', 5e5), row('0xdef', 2e4, { n_tokens: 1 })], 7: [row('0xabc', 1e5)], 90: [row('0xABC', 9e5)] }, 30);
    expect(ls.map((l) => l.address.toLowerCase())).toEqual(['0xabc', '0xdef']);
    expect(Object.keys(ls[0].windows).sort()).toEqual(['30', '7', '90']);
  });
  it('drops wallets missing from the focus window', () => {
    expect(mergeBoards({ 7: [row('0xabc', 1e5)] }, 30)).toEqual([]);
  });
});

describe('traderKind', () => {
  it('tells KOLs and funds from traders by label', () => {
    expect(traderKind('Public Figure: Ansem')).toBe('kol');
    expect(traderKind('@cobie')).toBe('kol');
    expect(traderKind('Wintermute Capital')).toBe('fund');
    expect(traderKind('🤓 Smart Trader [0x12ab]')).toBe('trader');
    expect(traderKind(null)).toBe('trader');
  });
});

describe('toTokens and consensusOf', () => {
  it('reads loosely shaped token info and finds tokens shared by two leaders', () => {
    const ls = mergeBoards({ 30: [
      row('0xa', 5e5, { top_5_balance_tokens_info: [{ token_symbol: 'PEPE', token_address: '0xP', chain: 'ethereum', value_usd: 1000 }, { token_symbol: 'USDC' }] }),
      row('0xb', 4e5, { top_5_balance_tokens_info: [{ symbol: 'PEPE', address: '0xp', chain: 'ethereum', balance_usd: 500 }] }),
    ] }, 30);
    expect(toTokens([{ token_symbol: 'X' }, null, 5])).toHaveLength(1);
    const c = consensusOf(ls);
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ symbol: 'PEPE', wallets: 2, usd: 1500, source: 'holding' });
  });
});

describe('pmScore', () => {
  it('prefers a long winning record over one lucky market', () => {
    const record = pmScore({ totalPnl: 3e5, marketsTraded: 80, winRate: 0.64, wins: [{ id: 'a', question: 'q', side: 'Yes', pnlUsd: 5e4, resolved: true }] }).score;
    const lucky = pmScore({ totalPnl: 3e5, marketsTraded: 3, winRate: 0.67, wins: [{ id: 'a', question: 'q', side: 'Yes', pnlUsd: 2.9e5, resolved: true }] }).score;
    expect(record).toBeGreaterThan(lucky);
  });
});

describe('cohortBoards', () => {
  it('ranks each cohort’s net buying and selling', () => {
    const b = cohortBoards({ at: 0, calls: [], notes: [], tokens: [
      { chain: 'base', token: 'a', symbol: 'A', volume: 1, cells: { public_figure: { netUsd: 500, wallets: 3 }, whale: { netUsd: -900, wallets: 1 } } },
      { chain: 'base', token: 'b', symbol: 'B', volume: 1, cells: { public_figure: { netUsd: 1500, wallets: 2 } } },
    ] });
    expect(b.public_figure.buying.map((x) => x.symbol)).toEqual(['B', 'A']);
    expect(b.whale.selling.map((x) => x.symbol)).toEqual(['A']);
    expect(b.top_pnl.buying).toEqual([]);
  });
});

describe('copyTargets', () => {
  it('interleaves every market by its own copy score', () => {
    const spot = { at: 0, timeframe: 30 as const, leaders: mergeBoards({ 30: [row('0xa', 5e5)] }, 30), buying: [], consensus: [], calls: [], notes: [] };
    const t = copyTargets({ spot, perps: null, predict: { at: 0, marketsRead: 1, calls: [], notes: [], leaders: [{ address: '0xp', totalPnl: 1e6, realized: null, unrealized: null, marketsTraded: 90, winRate: 0.7, wins: [], score: 99, parts: {} }] } }, 30);
    expect(t.map((x) => x.market)).toEqual(['predict', 'spot']);
  });
});
