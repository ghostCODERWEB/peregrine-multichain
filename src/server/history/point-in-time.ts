// Point-in-time reads from Nansen's v1beta1 historical family, for the token
// and wallet Time Machines, historical transaction lookups and Discover as of
// a date. Every result is a fixed moment in history, cached permanently
// (cache.ts: v1beta1 → FOREVER). Credits per call are Nansen's (5, or 25 for
// top holders and the PnL leaderboard); the UI states them before running.
import { traced, errText } from '@/server/nansen/traced';
import { callScope, type CallTally } from '@/server/nansen/client';

type Row = Record<string, unknown>;
const rows = (d: unknown): Row[] => (d && typeof d === 'object' && Array.isArray((d as { data?: unknown }).data) ? (d as { data: Row[] }).data : []);
const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
const s = (v: unknown) => (typeof v === 'string' && v ? v : null);

export const DAY = /^\d{4}-\d{2}-\d{2}$/;
export const TX_LOOKUP_CHAINS = ['base', 'bnb', 'ethereum'];
export const WALLET_ASOF_CHAINS = ['all', 'base', 'bnb', 'ethereum', 'mantra', 'solana'];
/** A single-day range ending on `date` (inclusive), in the shape the historical TGM endpoints take. */
const dayRange = (date: string, days = 1) => {
  const to = new Date(`${date}T00:00:00Z`);
  const from = new Date(to.getTime() - (days - 1) * 86_400_000);
  return { from: from.toISOString().slice(0, 10), to: date };
};

async function run<T>(fn: () => Promise<T>): Promise<{ data: T; tally: CallTally }> {
  const tally: CallTally = { calls: 0, credits: 0, cached: 0 };
  const data = await callScope.run(tally, fn);
  return { data, tally };
}

// ------------------------------------------------------------------ tokens

export type TokenPart = 'flows' | 'traders' | 'trades' | 'holders' | 'pnl';
export const TOKEN_PART_CREDITS: Record<TokenPart, number> = { flows: 5, traders: 5, trades: 5, holders: 25, pnl: 25 };

export interface CohortFlow { cohort: string; netUsd: number | null; avgUsd: number | null; wallets: number | null }

export async function tokenAsOf(part: TokenPart, chain: string, token: string, date: string, days = 1) {
  return run(async () => {
    const date_range = dayRange(date, days);
    switch (part) {
      case 'flows': {
        const r = await traced<unknown>('v1beta1/tgm/historical-token-flow-summary', { chain, token_address: token, date_range }, 5);
        const x = rows(r.data)[0] ?? {};
        const cohorts: Array<[string, string]> = [['Smart traders', 'smart_trader'], ['Top PnL', 'top_pnl'], ['Whales', 'whale'], ['Public figures', 'public_figure'], ['Exchanges', 'exchange'], ['Fresh wallets', 'fresh_wallets']];
        return { kind: 'flows' as const, symbol: s(x.token_symbol), flows: cohorts.map(([cohort, k]): CohortFlow => ({ cohort, netUsd: n(x[`${k}_net_flow_usd`]), avgUsd: n(x[`${k}_avg_flow_usd`]), wallets: n(x[`${k}_wallet_count`]) })) };
      }
      case 'traders': {
        const r = await traced<unknown>('v1beta1/tgm/historical-who-bought-sold', { chain, token_address: token, date_range, pagination: { page: 1, per_page: 50 }, order_by: [{ field: 'gross_volume_usd', direction: 'DESC' }] }, 5);
        return { kind: 'traders' as const, rows: rows(r.data).map((x) => ({ address: s(x.address) ?? '', label: s(x.address_label), smartMoney: !!x.is_smart_money, boughtUsd: n(x.bought_volume_usd), soldUsd: n(x.sold_volume_usd), grossUsd: n(x.gross_volume_usd) })) };
      }
      case 'trades': {
        const r = await traced<unknown>('v1beta1/tgm/historical-dex-trades', { chain, token_address: token, date_range, pagination: { page: 1, per_page: 50 }, order_by: [{ field: 'estimated_value_usd', direction: 'DESC' }] }, 5);
        return { kind: 'trades' as const, rows: rows(r.data).map((x) => ({ at: s(x.block_timestamp), tx: s(x.transaction_hash), address: s(x.trader_address) ?? '', label: s(x.trader_address_label), action: s(x.action), amount: n(x.token_amount), other: s(x.traded_token_name), valueUsd: n(x.estimated_value_usd), priceUsd: n(x.estimated_swap_price_usd) })) };
      }
      case 'holders': {
        const r = await traced<unknown>('v1beta1/tgm/historical-top-holders', { chain, token_address: token, as_of_date: date, label_type: 'all_holders', pagination: { page: 1, per_page: 50 } }, 25);
        return { kind: 'holders' as const, rows: rows(r.data).map((x) => ({ address: s(x.address) ?? '', label: s(x.address_label), amount: n(x.token_amount), valueUsd: n(x.value_usd), ownership: n(x.ownership_percentage), change7d: n(x.balance_change_7d), change30d: n(x.balance_change_30d) })) };
      }
      case 'pnl': {
        const r = await traced<unknown>('v1beta1/tgm/historical-pnl-leaderboard', { chain, token_address: token, date_range: dayRange(date, 30), pagination: { page: 1, per_page: 50 }, order_by: [{ field: 'pnl_usd_total', direction: 'DESC' }] }, 25);
        return { kind: 'pnl' as const, rows: rows(r.data).map((x) => ({ address: s(x.trader_address) ?? '', label: s(x.trader_address_label), pnlUsd: n(x.pnl_usd_total), realizedUsd: n(x.pnl_usd_realised), unrealizedUsd: n(x.pnl_usd_unrealised), holdingUsd: n(x.holding_usd), roi: n(x.roi_percent_total), trades: n(x.nof_trades), stillHolding: n(x.still_holding_balance_ratio) })) };
      }
    }
  });
}

// ------------------------------------------------------------------ wallets

export async function walletAsOf(address: string, chain: string, date: string) {
  return run(async () => {
    const errors: string[] = [];
    const balances = await traced<unknown>('v1beta1/profiler/address/historical-token-balances', { address, as_of_date: date, chain, pagination: { page: 1, per_page: 100 } }, 5)
      .then((r) => rows(r.data).map((x) => ({ chain: s(x.chain) ?? chain, token: s(x.token_address) ?? '', symbol: s(x.token_symbol), amount: n(x.token_amount), priceUsd: n(x.price_usd), valueUsd: n(x.value_usd) })).sort((a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0)))
      .catch((e) => { errors.push(`Balances: ${errText(e)}`); return []; });
    // Historical transactions need one chain (Nansen rejects "all"): use the chain that held the most value that day.
    const byChain = new Map<string, number>();
    for (const b of balances) byChain.set(b.chain, (byChain.get(b.chain) ?? 0) + (b.valueUsd ?? 0));
    const txChain = chain !== 'all' ? chain : [...byChain].sort((a, b) => b[1] - a[1])[0]?.[0] ?? (address.startsWith('0x') ? 'ethereum' : 'solana');
    const transactions = WALLET_ASOF_CHAINS.includes(txChain)
      ? await traced<unknown>('v1beta1/profiler/address/historical-transactions', { address, chain: txChain, as_of_date: date, hide_spam_token: true, pagination: { page: 1, per_page: 30 } }, 5)
          .then((r) => rows(r.data).map((x) => ({ at: s(x.block_timestamp), chain: s(x.chain) ?? txChain, hash: s(x.transaction_hash), method: s(x.method), volumeUsd: n(x.volume_usd), sent: Array.isArray(x.tokens_sent) ? x.tokens_sent.length : 0, received: Array.isArray(x.tokens_received) ? x.tokens_received.length : 0 })))
          .catch((e) => { errors.push(`Transactions: ${errText(e)}`); return []; })
      : [];
    return { date, chain, txChain, balances, totalUsd: balances.reduce((a, b) => a + (b.valueUsd ?? 0), 0), byChain: [...byChain].map(([c, v]) => ({ chain: c, valueUsd: v })).sort((a, b) => b.valueUsd - a.valueUsd), transactions, errors };
  });
}

// ------------------------------------------------------------- transactions

/** A transaction's values and labels as of its own time (or a chosen date): 5 credits. */
export async function transactionAsOf(chain: string, hash: string, blockTimestamp: string | null, asOf: string | null) {
  return run(async () => {
    // as_of_date is required and must be on or after the block: default to the transaction's own day.
    const day = asOf ?? (blockTimestamp ? blockTimestamp.slice(0, 10) : new Date(Date.now() - 86_400_000).toISOString().slice(0, 10));
    const body: Row = { chain, transaction_hash: hash, as_of_date: day };
    if (blockTimestamp) body.block_timestamp = blockTimestamp;
    const r = await traced<unknown>('v1beta1/profiler/historical-transaction-lookup', body, 5);
    const x = rows(r.data)[0] ?? (r.data && typeof r.data === 'object' && !Array.isArray(r.data) ? ((r.data as { data?: Row }).data ?? {}) : {});
    return {
      from: s(x.from_address), fromLabel: s(x.from_address_label), to: s(x.to_address), toLabel: s(x.to_address_label),
      nativeValue: n(x.native_value), valueUsdThen: n(x.dated_native_value_usd), priceThen: n(x.dated_native_price), valueUsdAsOf: n(x.as_of_date_native_value_usd), priceAsOf: n(x.as_of_date_native_price),
      status: s(x.receipt_status) ?? (x.receipt_status != null ? String(x.receipt_status) : null), at: s(x.block_timestamp), asOf: s(x.as_of_date), method: s(x.method),
      transfers: Array.isArray(x.token_transfer_array) ? (x.token_transfer_array as Row[]).slice(0, 20).map((t) => ({ symbol: s(t.token_symbol) ?? s(t.symbol), amount: n(t.token_amount) ?? n(t.amount), valueUsd: n(t.value_usd) ?? n(t.dated_value_usd), from: s(t.from_address), to: s(t.to_address) })) : [],
    };
  });
}

// ----------------------------------------------------------------- discover

/** Token Screener as of a past date (5 credits): the market map for that day. */
export async function screenerAsOf(date: string, chains: string[], timeframeDays = 1, smartMoney = false) {
  return run(async () => {
    const r = await traced<unknown>('v1beta1/token-screener/historical', {
      to_date: date, timeframe_days: timeframeDays, chains, only_smart_money: smartMoney,
      pagination: { page: 1, per_page: 150 }, order_by: [{ field: 'volume', direction: 'DESC' }],
    }, 5);
    return rows(r.data).map((x) => ({ chain: s(x.chain) ?? '', token: s(x.token_address) ?? '', symbol: s(x.token_symbol), priceUsd: n(x.price_usd), priceChange: n(x.price_change), volume: n(x.volume), buy: n(x.buy_volume), sell: n(x.sell_volume), netflow: n(x.netflow), liquidity: n(x.liquidity), marketCap: n(x.market_cap_usd), ageDays: n(x.token_age_days), sectors: Array.isArray(x.sectors) ? (x.sectors as string[]) : [] }));
  });
}
