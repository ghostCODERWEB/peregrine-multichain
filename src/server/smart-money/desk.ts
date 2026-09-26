// The smart-money desk (M4): what Nansen's smart-money cohort holds, who its
// best traders are, and where the two agree. Every endpoint here is in
// Nansen's "prohibited" redistribution class, so the desk exists only for
// the key owner and signed-in members, is never recorded into fixtures and
// is never cached for anyone else (the cache is partitioned per key).
import { validated } from '@/server/portfolio/portfolio';
import { requestDay } from '@/server/nansen/demo';
import { getDb, audit } from '@/server/nansen/db';
import { callScope, type CallTally } from '@/server/nansen/client';
import type { RequestContext } from '@/server/context';
import {
  S_SmartMoneyHoldingsResponse,
  S_SmartMoneyPnlLeaderboardResponse,
  S_SmartMoneyPerpTradesResponse,
  S_SmartMoneyDcasResponse,
  S_SmartMoneyHistoricalHoldingsResponse,
  S_SmartMoneyDexTradesResponse,
  S_SmartMoneyChain,
  S_SmartMoneyHistoricalHoldingsChain,
} from '@/types/nansen/api.gen';
import {
  conviction,
  topTraderBacking,
  tokenKey,
  holderQuantile,
  crowdedExit,
  perpTilt,
  FUND_COHORT_CHANGE,
  FULL_BACKING,
  ADDING_SCALE,
} from '@/lib/models/conviction';
import { detectAddress, addressKey } from '@/lib/address-family';
import type { Provenance } from '@/lib/provenance';
import { usd, pct, chainName, num } from '@/lib/viz/format';

export const SM_CHAINS = S_SmartMoneyChain.options;
export const SM_HISTORY_CHAINS: readonly string[] = S_SmartMoneyHistoricalHoldingsChain.options;
export type SmChain = (typeof SM_CHAINS)[number];

const TOP_LEADERS = 100;

export interface DeskHolding {
  chain: string;
  tokenAddress: string;
  symbol: string;
  sectors: string[];
  valueUsd: number;
  change24h: number | null;
  holders: number;
  share: number | null;
  ageDays: number;
  marketCapUsd: number | null;
  conviction: number | null;
  backers: number;
  bestRank: number | null;
  crowdedExit: boolean;
}

export interface DeskLeader {
  rank: number;
  address: string;
  label: string | null;
  totalPnlUsd: number;
  realizedUsd: number;
  unrealizedUsd: number;
  winRate: number | null;
  avgRoi: number | null;
  trades: number;
  tokens: number;
  held: number;
  top5: Array<{ symbol: string; chain: string; tokenAddress: string; usd: number }>;
}

export interface SmDesk {
  chain: string;
  holdings: DeskHolding[];
  leaders: DeskLeader[];
  totals: { valueUsd: number; tokens: number; adding: number; trimming: number; crowdedAt: number; holdingsLimited: boolean };
  provenance: { holdings: Provenance; leaders: Provenance; conviction: Provenance };
  tally: CallTally;
}

const num0 = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const str = (v: unknown) => (typeof v === 'string' ? v : '');

export function parseChain(input: unknown): SmChain {
  return (SM_CHAINS as readonly string[]).includes(String(input)) ? (input as SmChain) : 'all';
}

/** Holdings and the PnL leaderboard for one chain (or all), joined. 10 credits uncached. */
export async function smDesk(chain: SmChain): Promise<SmDesk> {
  const tally: CallTally = { calls: 0, credits: 0, cached: 0 };
  return callScope.run(tally, async () => {
    // No Fund filter: Nansen deprecated it for this endpoint on 23 Sep 2026.
    const hBody = {
      chains: [chain],
      filters: { include_stablecoins: false, include_native_tokens: false },
      pagination: { page: 1, per_page: 200 },
      order_by: [{ field: 'value_usd', direction: 'DESC' }],
    };
    const lBody = {
      chains: [chain],
      timeframe: 30,
      pagination: { page: 1, per_page: TOP_LEADERS },
      order_by: [{ field: 'total_pnl_usd', direction: 'DESC' }],
    };
    const [h, l] = await Promise.all([
      validated('smart-money/holdings', hBody, S_SmartMoneyHoldingsResponse),
      validated('smart-money/pnl-leaderboard', lBody, S_SmartMoneyPnlLeaderboardResponse),
    ]);

    const leaders: DeskLeader[] = l.data.data.map((x, i) => ({
      rank: i + 1,
      address: x.address,
      label: x.address_label ?? null,
      totalPnlUsd: x.total_pnl_usd,
      realizedUsd: x.realized_pnl_usd,
      unrealizedUsd: x.unrealized_pnl_usd,
      winRate: x.win_rate ?? null,
      avgRoi: x.avg_trade_roi ?? null,
      trades: x.n_trades,
      tokens: x.n_tokens,
      held: x.held_tokens_count,
      // Items carry a logo URL too; TIDE never loads it (Nansen is the only host it talks to).
      top5: (x.top_5_balance_tokens_info ?? [])
        .map((t) => ({ symbol: str(t.symbol), chain: str(t.chain), tokenAddress: str(t.token_address), usd: num0(t.usd_value) }))
        .filter((t) => t.chain && t.tokenAddress),
    }));
    const backing = topTraderBacking(leaders);

    const base = h.data.data
      .filter((x) => (x.value_usd ?? 0) > 0)
      .map((x) => ({
        chain: x.chain,
        tokenAddress: x.token_address,
        symbol: x.token_symbol,
        sectors: x.token_sectors ?? [],
        valueUsd: x.value_usd ?? 0,
        change24h: x.balance_24h_percent_change ?? null,
        holders: x.holders_count,
        share: x.share_of_holdings_percent ?? null,
        ageDays: x.token_age_days,
        marketCapUsd: x.market_cap_usd ?? null,
      }));
    const crowdedAt = holderQuantile(base, 0.8);
    const holdings: DeskHolding[] = base.map((x) => {
      const b = backing.get(tokenKey(x.chain, x.tokenAddress));
      return {
        ...x,
        conviction: conviction(x.change24h, b?.backers ?? 0),
        backers: b?.backers ?? 0,
        bestRank: b?.bestRank ?? null,
        crowdedExit: crowdedExit(x, crowdedAt),
      };
    });

    const valueUsd = holdings.reduce((s, x) => s + x.valueUsd, 0);
    const adding = holdings.filter((x) => (x.change24h ?? 0) > 0.005).length;
    const trimming = holdings.filter((x) => (x.change24h ?? 0) < -0.005).length;
    const top = [...holdings].filter((x) => x.conviction != null).sort((a, b) => b.conviction! - a.conviction!)[0];
    const where = chain === 'all' ? 'all chains' : chainName(chain);

    return {
      chain,
      holdings,
      leaders,
      tally,
      totals: { valueUsd, tokens: holdings.length, adding, trimming, crowdedAt, holdingsLimited: h.data.pagination.is_last_page === false },
      provenance: {
        holdings: {
          title: `Smart-money holdings, ${where}`,
          formula:
            'per token: aggregate balance of Nansen smart-money wallets (value, 24h balance change, wallets holding)\nstablecoins and native tokens excluded',
          inputs: [
            { label: 'Tokens', value: String(holdings.length) },
            { label: 'Value tracked', value: usd(valueUsd) },
            { label: 'Adding · trimming (±0.5%)', value: `${adding} · ${trimming}` },
          ],
          calls: [h.call],
          notes: [
            'Nansen reports share_of_holdings_percent and balance_24h_percent_change as fractions (0.12 = 12%).',
            `Fund wallets left this cohort on ${FUND_COHORT_CHANGE}; totals before that date are not comparable.`,
            ...(h.data.pagination.is_last_page === false ? ['The 200 largest holdings by value; smaller ones are not shown.'] : []),
          ],
        },
        leaders: {
          title: `Smart-money PnL leaderboard, 30 days, ${where}`,
          formula: 'wallets ranked by total PnL (realized + unrealized) over 30 days, as reported by Nansen',
          inputs: [
            { label: 'Wallets', value: String(leaders.length) },
            { label: 'Top wallet PnL', value: leaders[0] ? usd(leaders[0].totalPnlUsd, { signed: true }) : 'n/a' },
          ],
          calls: [l.call],
          notes: ["Each wallet's five largest balances come from the same response (top_5_balance_tokens_info)."],
        },
        conviction: {
          title: 'Conviction and crowding',
          formula: `adding = tanh(24h balance change ÷ ${ADDING_SCALE})\nbacking = min(1, backers ÷ ${FULL_BACKING}), backers = top-${TOP_LEADERS} PnL wallets holding it among their five largest balances\nconviction = 100 × adding × (0.35 + 0.65 × backing)\ncrowded exit = wallets holding ≥ top fifth of the list (≥ ${crowdedAt}) and 24h change ≤ −2%`,
          inputs: [
            {
              label: 'Highest conviction',
              value: top ? `${top.symbol} ${top.conviction! > 0 ? '+' : ''}${top.conviction} (${top.backers} backers)` : 'n/a',
            },
            { label: 'Crowded exits', value: String(holdings.filter((x) => x.crowdedExit).length) },
          ],
          calls: [h.call, l.call],
          notes: ['A reading of positioning, not a prediction: conviction has no out-of-sample track record yet (M9 backtests it).'],
        },
      },
    };
  });
}

// ------------------------------------------------------------ perp trades

export interface SmPerps {
  trades: Array<{
    at: string;
    address: string;
    label: string | null;
    symbol: string;
    action: string;
    side: string | null;
    valueUsd: number | null;
    priceUsd: number | null;
    type: string;
    tx: string;
  }>;
  tilt: ReturnType<typeof perpTilt>;
  provenance: Provenance;
}

export async function smPerpTrades(): Promise<SmPerps> {
  // New positions, largest first: without the flag, one wallet trimming a
  // short in many small fills can take all 100 rows. The flag narrows the
  // list but still lets some reductions and closes through (live, 24 Sep).
  const body = {
    lookback_hours: 24,
    only_new_positions: true,
    pagination: { page: 1, per_page: 100 },
    order_by: [{ field: 'value_usd', direction: 'DESC' }],
  };
  const r = await validated('smart-money/perp-trades', body, S_SmartMoneyPerpTradesResponse);
  const trades = r.data.data.map((t) => ({
    at: t.block_timestamp,
    address: t.trader_address,
    label: t.trader_address_label || null,
    symbol: t.token_symbol,
    action: t.action,
    side: t.side ?? null,
    valueUsd: t.value_usd ?? null,
    priceUsd: t.price_usd ?? null,
    type: t.type,
    tx: t.transaction_hash,
  }));
  const tilt = perpTilt(trades.map((t) => ({ symbol: t.symbol, action: t.action, side: t.side, valueUsd: t.valueUsd })));
  return {
    trades,
    tilt,
    provenance: {
      title: 'Smart-money new perp positions, Hyperliquid, 24h',
      formula: 'tilt per coin = Σ USD opening or adding to longs − Σ USD opening or adding to shorts\n(reductions and closes left out)',
      inputs: [
        { label: 'Trades read', value: String(trades.length) },
        { label: 'Most tilted', value: tilt[0] ? `${tilt[0].symbol} ${usd(tilt[0].netUsd, { signed: true })}` : 'n/a' },
      ],
      calls: [r.call],
      notes: [
        'Requested with only_new_positions, yet Nansen still returns some reductions and closes; they are left out of the tilt. The verb is in action (Open, Add, Reduce, Close) and the direction in side.',
        ...(r.data.pagination.is_last_page === false ? ['The 100 largest new positions in the window; smaller ones are not counted.'] : []),
      ],
    },
  };
}

// ------------------------------------------------------------------- DCAs

export interface SmDcas {
  orders: Array<{
    created: string;
    address: string;
    label: string | null;
    from: string;
    to: string;
    depositUsd: number | null;
    spent: number | null;
    status: string;
  }>;
  provenance: Provenance;
}

export async function smDcas(): Promise<SmDcas> {
  const body = { pagination: { page: 1, per_page: 50 }, order_by: [{ field: 'dca_created_at', direction: 'DESC' }] };
  const r = await validated('smart-money/dcas', body, S_SmartMoneyDcasResponse);
  // Jupiter mints can carry a trailing NUL (see the contract's quirks).
  const clean = (s: string) => s.replace(/\u0000+$/, '');
  const orders = r.data.data.map((d) => ({
    created: d.dca_created_at,
    address: d.trader_address,
    label: d.trader_address_label || null,
    from: clean(d.input_token_symbol),
    to: clean(d.output_token_symbol),
    depositUsd: d.deposit_value_usd ?? null,
    spent: d.deposit_token_amount && d.token_spent_amount != null ? d.token_spent_amount / d.deposit_token_amount : null,
    status: d.dca_status,
  }));
  return {
    orders,
    provenance: {
      title: 'Smart-money Jupiter DCA orders (Solana)',
      formula: 'the latest DCA orders opened by smart-money wallets; spent = token spent ÷ tokens deposited',
      inputs: [
        { label: 'Orders', value: String(orders.length) },
        { label: 'Deposited (with a USD value)', value: usd(orders.reduce((s, o) => s + (o.depositUsd ?? 0), 0)) },
      ],
      calls: [r.call],
      notes: [],
    },
  };
}

// --------------------------------------------------------- holding history

export interface SmHistory {
  chain: string;
  tokenAddress: string;
  symbol: string | null;
  points: Array<{ date: string; valueUsd: number | null; balance: number | null; holders: number }>;
  cohortChange: string | null;
  provenance: Provenance;
}

/** One token's smart-money balance, daily, 30 days. 1 credit. */
export async function smHistory(chain: string, tokenAddress: string): Promise<SmHistory> {
  if (!SM_HISTORY_CHAINS.includes(chain))
    throw new Error(`Nansen's smart-money history covers ${SM_HISTORY_CHAINS.map(chainName).join(', ')}; not ${chainName(chain)}.`);
  const body = {
    date_range: { from: requestDay(30), to: requestDay(0) },
    chains: [chain],
    filters: { token_address: tokenAddress },
    pagination: { page: 1, per_page: 100 },
    order_by: [{ field: 'date', direction: 'ASC' }],
  };
  const r = await validated('smart-money/historical-holdings', body, S_SmartMoneyHistoricalHoldingsResponse);
  const points = r.data.data.map((x) => ({
    date: x.date.slice(0, 10),
    valueUsd: x.value_usd ?? null,
    balance: x.balance ?? null,
    holders: x.holders_count,
  }));
  const first = points[0],
    last = points.at(-1);
  const cohortChange = points.some((p) => p.date === FUND_COHORT_CHANGE) ? FUND_COHORT_CHANGE : null;
  return {
    chain,
    tokenAddress,
    symbol: r.data.data[0]?.token_symbol ?? null,
    points,
    cohortChange,
    provenance: {
      title: `Smart-money balance history, ${r.data.data[0]?.token_symbol ?? 'token'} on ${chainName(chain)}`,
      formula: 'daily aggregate balance and value held by Nansen smart-money wallets',
      inputs: [
        { label: 'Days', value: String(points.length) },
        { label: 'Balance change over the window', value: first?.balance && last?.balance ? pct(last.balance / first.balance - 1) : 'n/a' },
        { label: 'Wallets, first → last day', value: first && last ? `${num(first.holders, 0)} → ${num(last.holders, 0)}` : 'n/a' },
      ],
      calls: [r.call],
      notes: [
        'The historical cohort counts more label types than the live holdings list, so its wallet counts are higher and not comparable with it.',
        ...(cohortChange
          ? [
              `Fund wallets left Nansen's smart-money holdings cohort on ${cohortChange}; a step on that day can be the cohort change, not selling.`,
            ]
          : []),
      ],
    },
  };
}

// ------------------------------------------------------------- follow list

export function followScope(ctx: RequestContext): string | null {
  return ctx.user ? `user:${ctx.user.id}` : ctx.mode === 'owner' ? 'owner' : null;
}

export function readFollows(scope: string): string[] {
  return (
    getDb().prepare('SELECT address FROM sm_follows WHERE scope = ? ORDER BY created_at').all(scope) as Array<{ address: string }>
  ).map((r) => r.address);
}

export const MAX_FOLLOWS = 50;

export function setFollow(scope: string, address: string, on: boolean, userId: number | null): string[] {
  const a = address.trim();
  if (!detectAddress(a).length) throw new Error('That is not a wallet address.');
  const key = addressKey(a);
  const db = getDb();
  if (on) {
    const n = (db.prepare('SELECT COUNT(*) AS n FROM sm_follows WHERE scope = ?').get(scope) as { n: number }).n;
    if (n >= MAX_FOLLOWS) throw new Error(`The follow list holds up to ${MAX_FOLLOWS} wallets.`);
    db.prepare('INSERT OR IGNORE INTO sm_follows (scope, address, created_at) VALUES (?, ?, ?)').run(scope, key, Date.now());
  } else {
    db.prepare('DELETE FROM sm_follows WHERE scope = ? AND address = ?').run(scope, key);
  }
  audit(userId, on ? 'sm.follow' : 'sm.unfollow', key);
  return readFollows(scope);
}

export interface FollowedMove {
  at: number;
  chain: string;
  address: string;
  label: string | null;
  side: 'buy' | 'sell' | 'swap';
  symbol: string | null;
  tokenAddress: string;
  usd: number;
}

/**
 * What followed wallets did lately. The owner reads the scanner's recorded
 * smart-money trades (free); a member's key fetches them live (5 credits),
 * because the scanner's history was bought with the owner's key.
 */
export async function followedMoves(
  ctx: RequestContext,
  follows: string[],
): Promise<{ moves: FollowedMove[]; source: 'scanner' | 'live'; provenance: Provenance }> {
  if (!follows.length)
    return {
      moves: [],
      source: ctx.mode === 'owner' ? 'scanner' : 'live',
      provenance: { title: 'Followed wallets', formula: 'no wallets followed yet', inputs: [], calls: [], notes: [] },
    };
  if (ctx.mode === 'owner') {
    const q = `SELECT traded_at AS at, chain, wallet AS address, wallet_label AS label, side, token_symbol AS symbol, token_address AS tokenAddress, usd_value AS usd
      FROM smart_money_trades WHERE (CASE WHEN wallet LIKE '0x%' THEN lower(wallet) ELSE wallet END) IN (${follows.map(() => '?').join(',')}) ORDER BY traded_at DESC LIMIT 60`;
    const moves = getDb()
      .prepare(q)
      .all(...follows) as FollowedMove[];
    return {
      moves,
      source: 'scanner',
      provenance: {
        title: 'Followed wallets: recent smart-money trades',
        formula: 'trades recorded by the scanner (smart-money/dex-trades, every 30 min) for the wallets you follow',
        inputs: [
          { label: 'Wallets followed', value: String(follows.length) },
          { label: 'Trades found', value: String(moves.length) },
        ],
        calls: [],
        notes: ['Only risk-token entries and exits are recorded; risk-to-risk swaps are not.'],
      },
    };
  }
  const body = {
    chains: ['all'],
    filters: { trader_address: follows },
    pagination: { page: 1, per_page: 60 },
    order_by: [{ field: 'block_timestamp', direction: 'DESC' }],
  };
  const r = await validated('smart-money/dex-trades', body, S_SmartMoneyDexTradesResponse);
  const moves: FollowedMove[] = r.data.data.map((t) => ({
    at: Date.parse(t.block_timestamp),
    chain: t.chain,
    address: t.trader_address,
    label: t.trader_address_label || null,
    side: 'swap',
    symbol: `${t.token_sold_symbol} → ${t.token_bought_symbol}`,
    tokenAddress: t.token_bought_address,
    usd: t.trade_value_usd ?? 0,
  }));
  return {
    moves,
    source: 'live',
    provenance: {
      title: 'Followed wallets: recent smart-money trades',
      formula: 'smart-money/dex-trades filtered to the wallets you follow',
      inputs: [{ label: 'Wallets followed', value: String(follows.length) }],
      calls: [r.call],
      notes: ['Shows swaps as sold → bought.'],
    },
  };
}
