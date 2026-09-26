// The token terminal (M2): the token page's second set of waves. Live DEX
// tape, the whale-transfer river with anomaly detection, the social pulse,
// Jupiter DCA ladders (Solana), and — for the key owner or a member — the
// Hyperliquid position tide gauge and the PnL leaderboard. Same rules as
// the first waves: each returns its ⓘ trace or the plain reason Nansen
// could not serve it.
import { traced, errText, type Wave } from '@/server/nansen/traced';
import { requestDay } from '@/server/nansen/demo';
import { contractUnavailable } from '@/server/nansen/support';
import {
  classifyCohort,
  judgeTransfers,
  socialHeat,
  dcaOverhang,
  positionGauge,
  ANOMALY_Z,
  MIN_COHORT,
  type Cohort,
  type SocialHeat,
  type DcaOverhang,
  type CohortPosition,
} from '@/lib/models/terminal';
import type { Provenance } from '@/lib/provenance';
import type {
  TGMDexTradesResponse,
  TGMTransfersResponse,
  TGMJupDcaResponse,
  TGMPositionIntelligenceResponse,
  TGMPnlLeaderboardResponse,
} from '@/types/nansen/api.gen';
import type { RaPostsResponse } from '@/types/nansen/extra';
import type { TGMPerpPositionsResponse } from '@/types/nansen/api.gen';
import { liquidationLadder, parseLeverage, type Ladder } from '@/lib/models/liquidation';
import { usd, num, pct, chainName } from '@/lib/viz/format';

// ------------------------------------------------------------- live tape

export interface TapeTrade {
  at: string;
  hash: string;
  trader: string;
  label: string | null;
  side: 'buy' | 'sell';
  amount: number;
  valueUsd: number | null;
  priceUsd: number | null;
  counter: string | null;
}

export interface TapeWave {
  trades: TapeTrade[];
  buyUsd: number;
  sellUsd: number;
  buyers: number;
  sellers: number;
  provenance: Provenance;
}

export async function tapeWave(chain: string, token: string): Promise<Wave<TapeWave>> {
  const gap = contractUnavailable('POST /api/v1/tgm/dex-trades', chain, 'Live DEX trades');
  if (gap) return { unavailable: gap };
  const body = {
    chain,
    token_address: token,
    date: { from: requestDay(1), to: requestDay(0) },
    pagination: { page: 1, per_page: 100 },
    order_by: [{ field: 'block_timestamp', direction: 'DESC' }],
  };
  try {
    const r = await traced<TGMDexTradesResponse>('tgm/dex-trades', body, 1);
    const trades: TapeTrade[] = r.data.data.map((t) => ({
      at: t.block_timestamp,
      hash: t.transaction_hash,
      trader: t.trader_address,
      label: t.trader_address_label ?? null,
      side: t.action === 'BUY' ? 'buy' : 'sell',
      amount: t.token_amount,
      valueUsd: Number.isFinite(t.estimated_value_usd) ? t.estimated_value_usd : null,
      priceUsd: Number.isFinite(t.estimated_swap_price_usd) ? t.estimated_swap_price_usd : null,
      counter: t.traded_token_name || null,
    }));
    if (!trades.length) return { unavailable: 'Nansen shows no DEX trades for this token in the last 24 hours.' };
    const buys = trades.filter((t) => t.side === 'buy'),
      sells = trades.filter((t) => t.side === 'sell');
    const sum = (xs: TapeTrade[]) => xs.reduce((s, t) => s + (t.valueUsd ?? 0), 0);
    const buyUsd = sum(buys),
      sellUsd = sum(sells);
    return {
      trades,
      buyUsd,
      sellUsd,
      buyers: new Set(buys.map((t) => t.trader)).size,
      sellers: new Set(sells.map((t) => t.trader)).size,
      provenance: {
        title: `Latest ${trades.length} DEX trades`,
        formula: 'as reported by Nansen, newest first\nbuy/sell = the trader bought/sold this token',
        inputs: [
          { label: 'Bought · sold', value: `${usd(buyUsd)} · ${usd(sellUsd)}` },
          { label: 'Buyers · sellers', value: `${new Set(buys.map((t) => t.trader)).size} · ${new Set(sells.map((t) => t.trader)).size}` },
          { label: 'Span', value: `${trades.at(-1)!.at.slice(11, 16)} to ${trades[0].at.slice(11, 16)} UTC` },
        ],
        calls: [r.call],
        notes: r.data.pagination?.is_last_page === false ? ['The latest 100 trades; older ones in the day are not shown.'] : [],
      },
    };
  } catch (e) {
    return { unavailable: errText(e) };
  }
}

// ------------------------------------------------------ transfer river

export interface RiverTransfer {
  at: string;
  hash: string;
  from: string;
  to: string;
  fromLabel: string | null;
  toLabel: string | null;
  valueUsd: number | null;
  amount: number | null;
  type: string | null;
  /** Sender's cohort; null in public views (it is derived from labels). */
  cohort: Cohort | null;
  anomalyZ: number | null;
}

export interface RiverWave {
  /** The day's largest non-DEX transfers, anomalies first. */
  largest: RiverTransfer[];
  anomalies: RiverTransfer[];
  /** Transfers in the baseline sample, and how far back it reaches. */
  baseline: number;
  baselineSince: string | null;
  byCohort: boolean;
  cohortSizes: Record<string, number>;
  provenance: Provenance;
}

const toRiver = (t: TGMTransfersResponse['data'][number], byCohort: boolean): RiverTransfer => ({
  at: t.block_timestamp,
  hash: t.transaction_hash,
  from: t.from_address,
  to: t.to_address,
  fromLabel: t.from_address_label ?? null,
  toLabel: t.to_address_label ?? null,
  valueUsd: t.transfer_value_usd != null && Number.isFinite(t.transfer_value_usd) ? t.transfer_value_usd : null,
  amount: t.transfer_amount ?? null,
  type: t.transaction_type ?? null,
  cohort: byCohort ? classifyCohort(t.from_address_label) : null,
  anomalyZ: null,
});

/**
 * Whale transfers, two calls (2 credits): the day's 500 largest transfers
 * that are not DEX trades, less pool/vault/router plumbing (the river, and
 * the candidates), and the newest 1,000 transfers of any kind (the
 * baseline of what each sender cohort usually moves). A candidate far
 * above its cohort's baseline is an anomaly. Cohorts come from Nansen
 * labels, so public views judge against all transfers (`byCohort` false).
 */
export async function riverWave(chain: string, token: string, byCohort: boolean): Promise<Wave<RiverWave>> {
  const gap = contractUnavailable('POST /api/v1/tgm/transfers', chain, 'Token transfers');
  if (gap) return { unavailable: gap };
  const date = { from: requestDay(1), to: requestDay(0) };
  const bigBody = {
    chain,
    token_address: token,
    date,
    filters: { include_dex: false },
    pagination: { page: 1, per_page: 500 },
    order_by: [{ field: 'transfer_value_usd', direction: 'DESC' }],
  };
  const baseBody = {
    chain,
    token_address: token,
    date,
    pagination: { page: 1, per_page: 1000 },
    order_by: [{ field: 'block_timestamp', direction: 'DESC' }],
  };
  try {
    const [big, base] = await Promise.all([
      traced<TGMTransfersResponse>('tgm/transfers', bigBody, 1),
      traced<TGMTransfersResponse>('tgm/transfers', baseBody, 1),
    ]);
    // Pool, vault and router plumbing (a liquidity pool rebalancing against
    // its vault can be most of a token's largest transfers) is left out in
    // every view. The labels decide it here on the server; public views
    // still never see them, and only private views are judged by cohort.
    const pool = (x: TGMTransfersResponse['data'][number]) =>
      classifyCohort(x.from_address_label) === 'contract' || classifyCohort(x.to_address_label) === 'contract';
    const plumbing = big.data.data.filter(pool).length;
    const candidates = big.data.data
      .filter((x) => !pool(x))
      .map((t) => toRiver(t, byCohort))
      .slice(0, 100);
    if (!candidates.length) return { unavailable: 'Nansen shows no transfers of this token outside DEX trades in the last 24 hours.' };
    const baseline = base.data.data.map((t) => toRiver(t, byCohort));
    const { z, cohortSizes } = judgeTransfers(
      baseline.map((t) => ({ valueUsd: t.valueUsd, cohort: t.cohort ?? 'unlabelled' })),
      candidates.map((t) => ({ valueUsd: t.valueUsd, cohort: t.cohort ?? 'unlabelled' })),
      byCohort,
    );
    candidates.forEach((t, i) => {
      t.anomalyZ = z[i] != null && (z[i] as number) >= ANOMALY_Z ? z[i] : null;
    });
    const anomalies = candidates.filter((t) => t.anomalyZ != null).sort((a, b) => (b.anomalyZ ?? 0) - (a.anomalyZ ?? 0));
    const largest = candidates.filter((t) => t.anomalyZ == null).slice(0, 12);
    const baselineSince = baseline.at(-1)?.at ?? null;
    return {
      largest,
      anomalies: anomalies.slice(0, 8),
      baseline: baseline.length,
      baselineSince,
      byCohort,
      cohortSizes,
      provenance: {
        title: 'Whale transfers and anomalies, 24 h',
        formula: `river = the day\u2019s largest transfers outside DEX trades, without pools, vaults and routers\nper transfer: z = robust z of log₁₀(USD) against the ${byCohort ? 'baseline transfers by its sender\u2019s cohort' : 'baseline transfers'}\nbaseline = the newest 1,000 transfers of any kind\nanomaly: z ≥ ${ANOMALY_Z} (cohorts with fewer than ${MIN_COHORT} baseline transfers are not judged)`,
        inputs: [
          { label: 'Largest', value: candidates[0]?.valueUsd != null ? usd(candidates[0].valueUsd) : 'n/a' },
          { label: 'Anomalies', value: String(anomalies.length) },
          { label: 'Pool and vault plumbing left out', value: `${plumbing} of the ${big.data.data.length} largest` },
          {
            label: 'Baseline',
            value: `${baseline.length.toLocaleString('en-US')} transfers since ${baselineSince ? baselineSince.slice(11, 16) + ' UTC' : 'n/a'}`,
          },
          ...(byCohort
            ? [
                {
                  label: 'Baseline by cohort',
                  value: Object.entries(cohortSizes)
                    .map(([k, n]) => `${k} ${n}`)
                    .join(' · '),
                },
              ]
            : []),
        ],
        calls: [big.call, base.call],
        notes: [
          byCohort
            ? 'Cohorts from Nansen labels: 🏦 exchanges, smart money, whales, other labelled, unlabelled.'
            : 'Public view: cohorts come from Nansen labels, which are withheld here, so each transfer is judged against all the baseline transfers.',
          'For a busy token the newest 1,000 transfers can cover only the last hour or so; that is the baseline\u2019s window.',
        ],
      },
    };
  } catch (e) {
    return { unavailable: errText(e) };
  }
}

// -------------------------------------------------------- social pulse

export interface SocialPost {
  username: string;
  at: string;
  text: string;
  likes: number | null;
  views: number | null;
  id: string | null;
}

export interface SocialWave {
  symbol: string;
  heat: SocialHeat;
  top: SocialPost[];
  provenance: Provenance;
}

/** Posts that mention the token's symbol over 7 days
 *  (ra-agent/posts-by-token), and the social-heat reading from them. */
export async function socialWave(symbol: string | null, now = Date.now()): Promise<Wave<SocialWave>> {
  if (!symbol) return { unavailable: 'Social posts are matched by symbol, and Nansen returned no symbol for this token.' };
  const body = { date: { from: requestDay(7), to: requestDay(0) }, token_symbol: symbol, pagination: { page: 1, per_page: 100 } };
  try {
    const r = await traced<RaPostsResponse>('ra-agent/posts-by-token', body, 5);
    const posts = r.data.data.map((p) => ({
      username: p.username,
      at: p.timestamp,
      text: p.text ?? '',
      likes: p.likes ?? null,
      views: p.views ?? null,
      id: p.tweet_id ?? null,
    }));
    if (!posts.length) return { unavailable: `Nansen found no posts mentioning ${symbol} in the last 7 days.` };
    const heat = socialHeat(
      posts.map((p) => ({ at: Date.parse(p.at), views: p.views, likes: p.likes })),
      now,
    );
    const top = [...posts].sort((a, b) => (b.views ?? 0) + 20 * (b.likes ?? 0) - ((a.views ?? 0) + 20 * (a.likes ?? 0))).slice(0, 6);
    return {
      symbol,
      heat,
      top,
      provenance: {
        title: `Social heat for ${symbol}, 7 days`,
        formula:
          'heat = 100·(½·volume + ½·acceleration)\nvolume = min(1, log₁₀(1 + views + 20·likes) ÷ 7)\nacceleration = ½ + ½·n÷(n+10)·tanh(log₂(rate last 48 h ÷ rate 5 days before))   (n = posts; few posts pull it to neutral)',
        inputs: [
          { label: 'Posts', value: String(heat.posts) },
          { label: 'Views · likes', value: `${heat.views.toLocaleString('en-US')} · ${heat.likes.toLocaleString('en-US')}` },
          { label: 'Acceleration', value: `${num(heat.acceleration, 2)}×` },
          { label: 'Heat', value: num(heat.score, 0) },
        ],
        calls: [r.call],
        notes: [
          `Posts are matched by the symbol "${symbol}", so posts about another token with the same ticker can be included.`,
          ...(r.data.pagination?.is_last_page === false ? ['The latest 100 posts.'] : []),
        ],
      },
    };
  } catch (e) {
    return { unavailable: errText(e) };
  }
}

// ------------------------------------------------------------ DCA ladders

export interface DcaOrder {
  trader: string;
  label: string | null;
  side: 'sell' | 'buy';
  other: string | null;
  depositUsd: number | null;
  spentShare: number | null;
  remainingUsd: number | null;
  since: string | null;
}

export interface DcaWave {
  orders: DcaOrder[];
  overhang: DcaOverhang | null;
  provenance: Provenance;
}

const cleanMint = (m: string | null | undefined) => (m ?? '').replace(/\u0000/g, '').trim();

/** Open Jupiter DCA orders buying or selling this token (Solana only), and
 *  the overhang they add up to against a day's volume. */
export async function dcaWave(chain: string, token: string, volume24hUsd: number | null): Promise<Wave<DcaWave>> {
  if (chain !== 'solana') return { unavailable: 'Jupiter DCA orders exist on Solana only.' };
  const body = { token_address: token, filters: { status: 'Active' }, pagination: { page: 1, per_page: 100 } };
  try {
    const r = await traced<TGMJupDcaResponse>('tgm/jup-dca', body, 1);
    const orders: DcaOrder[] = r.data.data
      .map((o) => {
        const side: 'sell' | 'buy' = cleanMint(o.input_mint_address) === token ? 'sell' : 'buy';
        const spent = o.deposit_amount && o.deposit_amount > 0 ? Math.min(1, (o.deposit_spent ?? 0) / o.deposit_amount) : null;
        return {
          trader: o.trader_address,
          label: o.trader_label ?? null,
          side,
          other: side === 'sell' ? (o.token_output ?? null) : (o.token_input ?? null),
          depositUsd: o.deposit_usd_value ?? null,
          spentShare: spent,
          remainingUsd: o.deposit_usd_value != null && spent != null ? o.deposit_usd_value * (1 - spent) : null,
          since: o.since_timestamp ?? null,
        };
      })
      .sort((a, b) => (b.remainingUsd ?? 0) - (a.remainingUsd ?? 0));
    if (!orders.length) return { unavailable: 'No open Jupiter DCA orders buy or sell this token right now.' };
    const overhang = dcaOverhang(
      r.data.data.map((o) => ({
        active: o.status === 'Active',
        side: cleanMint(o.input_mint_address) === token ? ('sell' as const) : ('buy' as const),
        depositUsd: o.deposit_usd_value ?? null,
        depositAmount: o.deposit_amount ?? null,
        depositSpent: o.deposit_spent ?? null,
      })),
      volume24hUsd,
    );
    return {
      orders: orders.slice(0, 20),
      overhang,
      provenance: {
        title: 'Jupiter DCA ladders (open orders)',
        formula:
          'remaining = deposit_usd × (1 − spent ÷ deposit)\noverhang = (Σ sell remaining − Σ buy remaining) ÷ 24h volume\nscore = 50 + 50·tanh(overhang ÷ 0.05)',
        inputs: [
          {
            label: 'Open sell · buy orders',
            value: overhang
              ? `${overhang.activeSell} · ${overhang.activeBuy}`
              : `${orders.filter((o) => o.side === 'sell').length} · ${orders.filter((o) => o.side === 'buy').length}`,
          },
          {
            label: 'Left to sell · to buy',
            value: overhang ? `${usd(overhang.sellRemainingUsd)} · ${usd(overhang.buyRemainingUsd)}` : 'n/a',
          },
          { label: 'Overhang', value: overhang ? `${pct(overhang.ratio, 1)} of a day’s volume` : 'needs 24h volume' },
        ],
        calls: [r.call],
        notes: [
          'USD at each order’s deposit value, not today’s price.',
          ...(r.data.pagination?.is_last_page === false ? ['The first 100 open orders.'] : []),
        ],
      },
    };
  } catch (e) {
    return { unavailable: errText(e) };
  }
}

// -------------------------------------- position tide gauge (private)

export interface PositionsWave {
  symbol: string;
  cohorts: CohortPosition[];
  totalUsd: number;
  provenance: Provenance;
}

/** Hyperliquid perp positions in the token's symbol by cohort (smart
 *  traders, whales, public figures): Nansen-label cohorts, so private only. */
export async function positionsWave(symbol: string | null): Promise<Wave<PositionsWave>> {
  if (!symbol) return { unavailable: 'Perp positions are looked up by symbol, and Nansen returned none for this token.' };
  const body = { token_address: symbol };
  try {
    const r = await traced<TGMPositionIntelligenceResponse>('tgm/position-intelligence', body, 1);
    const row = (r.data.data?.[0] ?? {}) as Record<string, number | null | undefined>;
    const cohorts = positionGauge(row);
    const totalUsd = cohorts.reduce((s, c) => s + c.longsUsd + c.shortsUsd, 0);
    if (!(totalUsd > 0)) return { unavailable: `No Hyperliquid perp positions in ${symbol} among Nansen’s tracked cohorts.` };
    return {
      symbol,
      cohorts,
      totalUsd,
      provenance: {
        title: `Perp positioning in ${symbol} by cohort (Hyperliquid)`,
        formula: 'long share = longs ÷ (longs + shorts), per cohort',
        inputs: cohorts.map((c) => ({
          label: c.cohort.replace('_', ' '),
          value: c.longShare == null ? 'no positions' : `${pct(c.longShare, 0)} long · ${usd(c.longsUsd + c.shortsUsd)}`,
        })),
        calls: [r.call],
        notes: ['Matched by symbol: the Hyperliquid perp that shares this token’s ticker.'],
      },
    };
  } catch (e) {
    return { unavailable: errText(e) };
  }
}

// -------------------------------------------- PnL leaderboard (private)

export interface PnlRow {
  trader: string;
  label: string | null;
  pnlUsd: number;
  realizedUsd: number;
  unrealizedUsd: number;
  holdingUsd: number;
  roi: number | null;
  trades: number | null;
  stillHolding: number | null;
}
export interface PnlBoardWave {
  rows: PnlRow[];
  provenance: Provenance;
}

/** Top traders of this token by 30-day PnL. Nansen prohibits showing this
 *  leaderboard publicly: the key owner's and members' views only. Never
 *  with premium_labels (150 credits a call). */
export async function pnlBoardWave(chain: string, token: string): Promise<Wave<PnlBoardWave>> {
  const gap = contractUnavailable('POST /api/v1/tgm/pnl-leaderboard', chain, 'PnL leaderboard');
  if (gap) return { unavailable: gap };
  const body = {
    chain,
    token_address: token,
    date: { from: requestDay(30), to: requestDay(0) },
    pagination: { page: 1, per_page: 15 },
    order_by: [{ field: 'pnl_usd_total', direction: 'DESC' }],
  };
  try {
    const r = await traced<TGMPnlLeaderboardResponse>('tgm/pnl-leaderboard', body, 5);
    const rows: PnlRow[] = r.data.data.map((x) => ({
      trader: x.trader_address,
      label: x.trader_address_label ?? null,
      pnlUsd: x.pnl_usd_total ?? 0,
      realizedUsd: x.pnl_usd_realised ?? 0,
      unrealizedUsd: x.pnl_usd_unrealised ?? 0,
      holdingUsd: x.holding_usd ?? 0,
      roi: x.roi_percent_total ?? null,
      trades: x.nof_trades ?? null,
      stillHolding: x.still_holding_balance_ratio ?? null,
    }));
    if (!rows.length) return { unavailable: `No trader PnL for this token on ${chainName(chain)} in the last 30 days.` };
    return {
      rows,
      provenance: {
        title: 'Top traders by PnL, 30 days',
        formula: 'as reported by Nansen: total = realized + unrealized',
        inputs: [{ label: 'Top trader', value: `${usd(rows[0].pnlUsd, { signed: true })} over ${rows[0].trades ?? '?'} trades` }],
        calls: [r.call],
        notes: ['Owner’s and members’ view only: Nansen does not allow this leaderboard in public views.'],
      },
    };
  } catch (e) {
    return { unavailable: errText(e) };
  }
}

// ------------------------------------------------ liquidation ladder (all)

export interface LeverageWave {
  symbol: string;
  ladder: Ladder;
  top: Array<{
    address: string;
    label: string | null;
    side: 'long' | 'short';
    valueUsd: number;
    leverage: number | null;
    entry: number | null;
    liquidation: number | null;
    upnlUsd: number | null;
  }>;
  provenance: Provenance;
}

/**
 * The Hyperliquid perp that shares the token's symbol: its 100 largest open
 * positions (all traders, no smart-money filter, so public-class data) and
 * where they are forced out. 5 credits, cached 10 minutes.
 */
export async function leverageWave(symbol: string | null): Promise<Wave<LeverageWave>> {
  if (!symbol) return { unavailable: 'Perp positions are looked up by symbol, and Nansen returned none for this token.' };
  const body = {
    token_symbol: symbol,
    label_type: 'all_traders',
    pagination: { page: 1, per_page: 100 },
    order_by: [{ field: 'position_value_usd', direction: 'DESC' }],
  };
  try {
    const r = await traced<TGMPerpPositionsResponse>('tgm/perp-positions', body, 5, { publicSafe: true });
    const rows = r.data.data.filter((x) => (x.position_value_usd ?? 0) > 0);
    if (!rows.length) return { unavailable: `No open Hyperliquid perp positions in ${symbol}.` };
    const marks = rows
      .map((x) => x.mark_price)
      .filter((m): m is number => m != null && m > 0)
      .sort((a, b) => a - b);
    const mark = marks[Math.floor(marks.length / 2)] ?? 0;
    const positions = rows.map((x) => ({
      side: (String(x.side ?? '')
        .toLowerCase()
        .startsWith('s')
        ? 'short'
        : 'long') as 'long' | 'short',
      valueUsd: x.position_value_usd ?? 0,
      liquidationPrice: x.liquidation_price ?? null,
      leverage: parseLeverage(x.leverage),
    }));
    const ladder = liquidationLadder(positions, mark);
    if (!ladder) return { unavailable: `Nansen returned no mark price for the ${symbol} perp.` };
    const d = ladder.densest;
    return {
      symbol,
      ladder,
      top: rows
        .slice(0, 12)
        .map((x, i) => ({
          address: x.address ?? '',
          label: x.address_label ?? null,
          side: positions[i].side,
          valueUsd: positions[i].valueUsd,
          leverage: positions[i].leverage,
          entry: x.entry_price ?? null,
          liquidation: x.liquidation_price ?? null,
          upnlUsd: x.upnl_usd ?? null,
        })),
      provenance: {
        title: `Liquidation ladder, ${symbol} perp (Hyperliquid)`,
        formula:
          'per open position: distance = liquidation price ÷ mark − 1\nlongs liquidate below the mark (forced sells), shorts above (forced buys)\nband notional = Σ position value liquidating inside the band',
        inputs: [
          { label: 'Mark', value: num(mark, mark < 1 ? 5 : 2) },
          { label: 'Open long · short (top 100)', value: `${usd(ladder.longUsd)} · ${usd(ladder.shortUsd)}` },
          { label: 'Within 10% of the mark', value: `${usd(ladder.near.longUsd)} long · ${usd(ladder.near.shortUsd)} short` },
          { label: 'Densest band', value: d && d.usd > 0 ? `${usd(d.usd)} of ${d.side}s at ${pct(d.outer, 0)}` : 'n/a' },
          { label: 'Average leverage', value: ladder.avgLeverage != null ? `${num(ladder.avgLeverage, 1)}×` : 'n/a' },
        ],
        calls: [r.call],
        notes: [
          'The 100 largest open positions, all traders (no smart-money filter). Smaller positions add to every band but are not counted here.',
          ...(ladder.unpriced
            ? [
                `${ladder.unpriced} positions have no liquidation price on the right side of the mark (fully collateralized, or already being unwound).`,
              ]
            : []),
        ],
      },
    };
  } catch (e) {
    return { unavailable: errText(e) };
  }
}
