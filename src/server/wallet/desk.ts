import { validated } from '@/server/portfolio/portfolio';
import { requestDay } from '@/server/nansen/demo';
import { contractUnavailable } from '@/server/nansen/support';
import { isEvm } from './wallet-page';
import { callNansenPoints, callNansenPointsPage, POINTS_PAGE_SIZE } from '@/server/nansen/client';
import { findStanding } from '@/lib/models/points-standing';
import { detectAddress } from '@/lib/address-family';
import {
  S_ProfilerAddressPnlResponse, S_ProfilerDexTradeResponse, S_PortfolioDefiHoldingsResponse,
  S_PerpPositionsResponse, S_PerpTradeResponse, S_PerpPnlSummaryResponse,
  S_AddressSummaryResponse, S_TradesByAddressResponse, S_PnlByAddressResponse, S_ProfilerAddressHistoricalBalancesResponse,
} from '@/types/nansen/api.gen';
import type { Provenance } from '@/lib/provenance';
import { usd, pct, chainName } from '@/lib/viz/format';

export type DeskSection = 'pnl' | 'dex' | 'defi' | 'perps' | 'prediction' | 'history' | 'points';
export interface DeskTable { title: string; columns: string[]; rows: Array<Array<string | number | null>> }
export interface DeskData { title: string; description: string; tables: DeskTable[]; provenance: Provenance }
const date = () => ({ from: requestDay(30), to: requestDay(0) });
const pagination = { page: 1, per_page: 50 };

export async function walletDesk(address: string, chain: string, section: DeskSection): Promise<DeskData> {
  const calls: Provenance['calls'] = [], notes: string[] = [];
  const result = (title: string, description: string, tables: DeskTable[]): DeskData => ({ title, description, tables, provenance: { title, formula: description, inputs: [{ label: 'Address', value: address }, { label: 'Chain', value: chainName(chain) }], calls, notes } });
  if (section === 'points') {
    if (!detectAddress(address).some((m) => m.family === 'evm' || m.family === 'solana')) throw new Error('Nansen Points supports EVM and Solana wallets.');
    const r = await callNansenPoints(address);
    calls.push({ endpoint: 'GET app.nansen.ai/api/points-leaderboard/{address}', body: { address }, credits: 0 });
    notes.push('Tier information is public and opt-in. The none tier can mean unlinked, ineligible or fewer than 1,000 points; it is not proof of no account. Cached for one day.');
    const tables: DeskTable[] = [{ title: 'Rewards', columns: ['Tier', 'Points'], rows: [[r.tier, r.points]] }];
    const standing = r.points != null && r.points > 0 ? await findStanding(r.points, POINTS_PAGE_SIZE, callNansenPointsPage).catch((e: Error) => { notes.push(`Leaderboard standing unavailable: ${e.message}`); return null; }) : null;
    if (standing) {
      const s = standing;
      calls.push({ endpoint: 'GET app.nansen.ai/api/points-leaderboard/api', body: { isEligible: 'all', recordsPerPage: POINTS_PAGE_SIZE, pagesRead: s.pagesRead }, credits: 0 });
      notes.push(`Rank found by bisection over the public leaderboard (${s.pagesRead} pages of ${POINTS_PAGE_SIZE.toLocaleString('en-US')}, cached 12 hours); equal totals share a rank. The leaderboard API cannot return its first ${POINTS_PAGE_SIZE.toLocaleString('en-US')} ranks, so a wallet above rank ${POINTS_PAGE_SIZE.toLocaleString('en-US')} shows as "top ${POINTS_PAGE_SIZE.toLocaleString('en-US')}".`);
      if (!s.exact && s.rank != null) notes.push('The leaderboard had no row with exactly this total (it can lag the tier lookup); the rank shown is where the total would sit.');
      tables.push({ title: 'Leaderboard standing', columns: ['Rank', 'Top', 'Wallets ranked', 'Eligible from'], rows: [[
        s.rank == null ? `top ${POINTS_PAGE_SIZE.toLocaleString('en-US')}` : `${s.exact ? '' : '≈'}#${s.rank.toLocaleString('en-US')}`,
        s.topPct == null ? `< ${((POINTS_PAGE_SIZE / s.total) * 100).toFixed(2)}%` : `${s.topPct.toFixed(s.topPct < 1 ? 2 : 1)}%`,
        s.total, s.eligibleFrom == null ? null : `${s.eligibleFrom.toLocaleString('en-US')} points`,
      ]] });
    }
    return result('Nansen Points', 'Public permissionless rewards lookup and leaderboard; no API key or credits required.', tables);
  }
  if (section === 'pnl') {
    const gap = contractUnavailable('POST /api/v1/profiler/address/pnl', chain, 'Token PnL');
    if (gap) throw new Error(gap);
    const r = await validated('profiler/address/pnl', { address, chain, date: date(), pagination, order_by: [{ field: 'pnl_usd_realised', direction: 'DESC' }] }, S_ProfilerAddressPnlResponse);
    calls.push(r.call);
    if (r.data.pagination.is_last_page === false) notes.push('First 50 tokens by realized PnL; this is not a portfolio-wide total.');
    return result('Token PnL · 30 days', 'Realized and unrealized PnL reported by Nansen for this chain. Missing values remain unknown.', [{ title: 'Token performance', columns: ['Token', 'Realized', 'Unrealized', 'Held', 'Buys', 'Sells'], rows: r.data.data.map((t) => [t.token_symbol, usd(t.pnl_usd_realised), usd(t.pnl_usd_unrealised), usd(t.holding_usd), t.nof_buys, t.nof_sells]) }]);
  }
  if (section === 'dex') {
    const gap = contractUnavailable('POST /api/v1/profiler/dex-trades', chain, 'DEX trades');
    if (gap) throw new Error(gap);
    const r = await validated('profiler/dex-trades', { address, chain, date: date(), pagination, order_by: [{ field: 'block_timestamp', direction: 'DESC' }] }, S_ProfilerDexTradeResponse);
    calls.push(r.call);
    notes.push('Latest 50 trades only. Absence on this chain does not imply inactivity on other chains.');
    return result('DEX activity · 30 days', 'A chronological record of what the wallet sold and bought on the selected chain.', [{ title: 'Recent swaps', columns: ['Time (UTC)', 'Sold', 'Bought', 'Trade value'], rows: r.data.data.map((t) => [t.block_timestamp, t.token_sold_symbol ?? t.token_sold_address, t.token_bought_symbol ?? t.token_bought_address, usd(t.trade_value_usd)]) }]);
  }
  if (section === 'defi') {
    const r = await validated('portfolio/defi-holdings', { wallet_address: address }, S_PortfolioDefiHoldingsResponse);
    calls.push(r.call);
    notes.push('DeFi values are shown separately from spot balances to avoid double-counting receipt tokens. Protocol coverage is determined by Nansen.');
    return result(`${usd(r.data.summary.total_value_usd)} in DeFi positions`, 'Assets, debt and rewards by protocol across Nansen-supported networks. Net value is reported by Nansen.', [{ title: 'Protocols', columns: ['Protocol', 'Chain', 'Net value', 'Assets', 'Debt', 'Rewards'], rows: r.data.protocols.map((p) => [p.protocol_name, chainName(p.chain), usd(p.total_value_usd), usd(p.total_assets_usd), usd(p.total_debts_usd), usd(p.total_rewards_usd)]) }]);
  }
  if (section === 'perps') {
    if (!isEvm(address)) throw new Error('Hyperliquid profiles require an EVM wallet address.');
    const [positions, trades, summary] = await Promise.allSettled([
      validated('profiler/perp-positions', { address }, S_PerpPositionsResponse),
      validated('profiler/perp-trades', { address, date: date(), pagination }, S_PerpTradeResponse),
      validated('profiler/perp-pnl-summary', { address, date: date() }, S_PerpPnlSummaryResponse),
    ]);
    const tables: DeskTable[] = [];
    const num = (v: string | number | null | undefined) => v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v);
    if (positions.status === 'fulfilled') {
      calls.push(positions.value.call);
      tables.push({ title: 'Open Hyperliquid positions', columns: ['Coin', 'Signed size', 'Notional', 'Leverage', 'Liquidation price', 'Unrealized PnL'], rows: (positions.value.data.data.assetPositions ?? []).flatMap((a) => a.position ? [[a.position.token_symbol ?? '—', a.position.size ?? '—', usd(num(a.position.position_value_usd)), a.position.leverage_value ?? null, usd(num(a.position.liquidation_price_usd)), usd(num(a.position.unrealized_pnl_usd))]] : []) });
    } else notes.push(`Positions unavailable: ${String(positions.reason).slice(0, 150)}`);
    if (summary.status === 'fulfilled') {
      calls.push(summary.value.call); const s = summary.value.data.data;
      tables.push({ title: 'Realized performance · 30 days', columns: ['Realized PnL', 'Fees', 'Win rate', 'Closed trades'], rows: [[usd(s.realized_pnl_usd), usd(s.fees_usd), pct(s.win_rate), s.closed_trade_count]] });
    } else notes.push(`PnL unavailable: ${String(summary.reason).slice(0, 150)}`);
    if (trades.status === 'fulfilled') {
      calls.push(trades.value.call);
      tables.push({ title: 'Recent fills · 30 days', columns: ['Time (UTC)', 'Coin', 'Action', 'Value', 'Closed PnL'], rows: trades.value.data.data.map((t) => [t.timestamp, t.token_symbol, t.action, usd(t.value_usd), usd(t.closed_pnl)]) });
    } else notes.push(`Fills unavailable: ${String(trades.reason).slice(0, 150)}`);
    return result('Hyperliquid exposure', 'Positions and activity on Hyperliquid, independent of the selected spot chain. Signed size indicates direction; collateral is not added to spot holdings.', tables);
  }
  if (section === 'prediction') {
    if (!isEvm(address)) throw new Error('Prediction-market profiles require an EVM wallet address.');
    const r = await validated('prediction-market/address-summary', { address }, S_AddressSummaryResponse);
    calls.push(r.call);
    const [t, pm] = await Promise.all([
      validated('prediction-market/trades-by-address', { address, date: date(), pagination }, S_TradesByAddressResponse),
      validated('prediction-market/pnl-by-address', { address, pagination: { page: 1, per_page: 25 }, order_by: [{ field: 'total_pnl_usd', direction: 'DESC' }] }, S_PnlByAddressResponse).catch(() => null),
    ]);
    calls.push(t.call);
    if (pm) calls.push(pm.call); else notes.push('Per-market PnL is unavailable for this address.');
    return result('Prediction-market activity', 'Account performance as reported by Nansen, its best and worst markets, and recent 30-day trades. Summary metrics are lifetime, not a 30-day forecast.', [
      { title: 'Account summary', columns: ['Realized PnL', 'Unrealized PnL', 'Markets traded', 'Win rate'], rows: r.data.data.map((s) => [usd(s.realized_pnl_usd), usd(s.unrealized_pnl_usd), s.markets_traded ?? null, s.win_rate == null ? '—' : pct(s.win_rate)]) },
      ...(pm ? [{ title: 'PnL by market (largest first)', columns: ['Market', 'Side held', 'Total PnL', 'Resolved'], rows: pm.data.data.map((x) => [x.question ?? x.market_id ?? '—', x.side_held ?? '—', usd(x.total_pnl_usd, { signed: true }), x.market_resolved ? 'yes' : 'no']) }] : []),
      { title: 'Recent market trades', columns: ['Market', 'Outcome', 'Taker action', 'Value'], rows: t.data.data.map((x) => [x.market_question ?? x.market_id ?? '—', x.side ?? '—', x.taker_action ?? '—', usd(x.usdc_value)]) },
    ]);
  }
  const gap = contractUnavailable('POST /api/v1/profiler/address/historical-balances', chain, 'Balance history');
  if (gap) throw new Error(gap);
  const days = new Map<string, number>();
  for (let page = 1; page <= 5; page++) {
    const r = await validated('profiler/address/historical-balances', { address, chain, date: date(), filters: { hide_spam_tokens: true }, pagination: { page, per_page: 1000 }, order_by: [{ field: 'block_timestamp', direction: 'ASC' }] }, S_ProfilerAddressHistoricalBalancesResponse);
    calls.push(r.call);
    for (const x of r.data.data) if (x.value_usd != null && Number.isFinite(x.value_usd)) { const d = x.block_timestamp.slice(0, 10); days.set(d, (days.get(d) ?? 0) + x.value_usd); }
    if (r.data.pagination.is_last_page === true) break;
    // Never draw a net-worth line from a partial token-day page.
    if (page === 5) throw new Error('Balance history exceeds the five-page budget. Daily totals are withheld because this history is incomplete.');
  }
  notes.push('End-of-day value includes deposits, withdrawals and price changes. This is not investment return. Unpriced assets, DeFi and perp collateral are excluded.');
  return result('Spot balance history · 30 days', `Daily value of all returned priced tokens on ${chainName(chain)}, including tokens no longer held today.`, [{ title: 'Daily balances', columns: ['Day (UTC)', 'Value USD'], rows: [...days].sort(([a], [b]) => a.localeCompare(b)) }]);
}
