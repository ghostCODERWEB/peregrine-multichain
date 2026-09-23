// Everything /chain/[chain] shows. Pressure, forecast, tide and trade tape
// come from TIDE's own history (free); token flows, sectors and peer growth
// are live Nansen calls, cached (netflow 10 min, screener 5 min, chain-rank
// 30 min) so repeat views don't re-spend.
import { callNansen } from '@/server/nansen/client';
import { getDb } from '@/server/nansen/db';
import { chainWeather, pressureForecast, type ChainWeather, type PressureForecast } from './queries';
import { cpiProvenance, forecastProvenance } from './provenance';
import { chainCapability, unavailableReason } from '@/lib/registry';
import { holtForecast } from '@/lib/models/holt-forecast';
import { isStablecoin } from '@/lib/models/trade-side';
import type { Provenance } from '@/lib/provenance';
import type { SmartMoneyNetflow } from '@/types/nansen/smart-money';
import { usd, pct, num } from '@/lib/viz/format';

export interface TokenFlow {
  address: string;
  symbol: string;
  netFlowUsd: number;
  sectors: string[];
  traders: number | null;
  marketCapUsd: number | null;
}

export interface FlowSection {
  kind: 'smart-money' | 'market-flow' | 'unavailable';
  inflows: TokenFlow[];
  outflows: TokenFlow[];
  sectors: Array<{ sector: string; netFlowUsd: number; grossUsd: number; tokens: number }>;
  provenance: Provenance | null;
  unavailable: string | null;
}

export interface PeerRow {
  chain: string;
  dexVolumeUsd: number;
  dexVolumeChange: number | null;
  activeAddresses: number;
  activeAddressesChange: number | null;
  txCount: number;
  txChange: number | null;
}

export interface TidePoint { t: number; flowUsd: number; cumulativeUsd: number }

export interface ChainPageData {
  chain: string;
  weather: ChainWeather;
  cpiProvenance: Provenance | null;
  forecast: PressureForecast;
  forecastProvenance: Provenance;
  tide: { points: TidePoint[]; forecast: Array<{ t: number; forecast: number; low80: number; high80: number }>; provenance: Provenance };
  flows: FlowSection;
  peers: { rows: PeerRow[]; self: PeerRow | null; growthPercentile: number | null; provenance: Provenance } | { rows: []; self: null; growthPercentile: null; provenance: null; error: string };
  /** Newest first; `count` > 1 when consecutive fills were folded together
   *  (then `firstAt` is the oldest of them). */
  tape: Array<{ at: number; firstAt: number; count: number; wallet: string; label: string | null; side: 'buy' | 'sell'; symbol: string | null; usd: number }>;
}

const TOP_N = 10;

async function smartMoneyFlows(chain: string): Promise<FlowSection> {
  const body = {
    chains: [chain],
    pagination: { page: 1, per_page: 1000 },
    order_by: [{ field: 'net_flow_24h_usd', direction: 'DESC' }],
  };
  const r = await callNansen<{ data: SmartMoneyNetflow[]; pagination: { is_last_page: boolean } }>('smart-money/netflow', body);
  let rows = r.data.data ?? [];
  const calls = [{ endpoint: 'smart-money/netflow', body, credits: 5, ref: r.meta.cacheHit ? 'served from cache (10 min TTL)' : 'live' }];

  // Heavy chains (Solana, Robinhood) have more than one page of tokens; the
  // largest outflows then sit past page 1, so ask for them directly.
  if (r.data.pagination?.is_last_page === false) {
    const ascBody = { ...body, pagination: { page: 1, per_page: TOP_N * 5 }, order_by: [{ field: 'net_flow_24h_usd', direction: 'ASC' }] };
    const asc = await callNansen<{ data: SmartMoneyNetflow[] }>('smart-money/netflow', ascBody);
    const seen = new Set(rows.map((x) => x.token_address));
    rows = rows.concat((asc.data.data ?? []).filter((x) => !seen.has(x.token_address)));
    calls.push({ endpoint: 'smart-money/netflow', body: ascBody, credits: 5, ref: 'outflow tail (page 1 did not reach it)' });
  }

  const toFlow = (x: SmartMoneyNetflow): TokenFlow => ({
    address: x.token_address, symbol: x.token_symbol, netFlowUsd: x.net_flow_24h_usd,
    sectors: x.token_sectors ?? [], traders: x.trader_count ?? null, marketCapUsd: x.market_cap_usd ?? null,
  });
  const flows = rows.map(toFlow).filter((f) => Number.isFinite(f.netFlowUsd) && !isStablecoin(f.symbol));
  const inflows = flows.filter((f) => f.netFlowUsd > 0).sort((a, b) => b.netFlowUsd - a.netFlowUsd).slice(0, TOP_N);
  const outflows = flows.filter((f) => f.netFlowUsd < 0).sort((a, b) => a.netFlowUsd - b.netFlowUsd).slice(0, TOP_N);

  // A token with several sectors counts toward each; its flow is split
  // evenly so the sector totals still sum to the token total.
  const bySector = new Map<string, { netFlowUsd: number; grossUsd: number; tokens: number }>();
  for (const f of flows) {
    const sectors = f.sectors.length ? f.sectors : ['Unclassified'];
    for (const s of sectors) {
      const e = bySector.get(s) ?? { netFlowUsd: 0, grossUsd: 0, tokens: 0 };
      e.netFlowUsd += f.netFlowUsd / sectors.length;
      e.grossUsd += Math.abs(f.netFlowUsd) / sectors.length;
      e.tokens += 1;
      bySector.set(s, e);
    }
  }
  const sectors = [...bySector.entries()].map(([sector, v]) => ({ sector, ...v })).sort((a, b) => b.grossUsd - a.grossUsd);

  return {
    kind: 'smart-money', inflows, outflows, sectors, unavailable: null,
    provenance: {
      title: `Smart-money token flows on ${chain}, 24h`,
      formula: 'per token: net_flow_24h_usd (Nansen smart-money labels)\nsector total = Σ token flow ÷ that token\'s sector count',
      inputs: [
        { label: 'Tokens with smart-money flow', value: String(flows.length) },
        { label: 'Largest inflow', value: inflows[0] ? `${inflows[0].symbol} ${usd(inflows[0].netFlowUsd, { signed: true })}` : '—' },
        { label: 'Largest outflow', value: outflows[0] ? `${outflows[0].symbol} ${usd(outflows[0].netFlowUsd, { signed: true })}` : '—' },
      ],
      calls,
      notes: ['Stablecoins and native tokens are excluded (the endpoint\'s defaults), matching the pressure index.'],
    },
  };
}

interface ScreenerFlowRow { token_address: string; token_symbol: string; netflow?: number | null; volume?: number | null; market_cap_usd?: number | null }

async function marketFlows(chain: string): Promise<FlowSection> {
  const body = {
    chains: [chain], timeframe: '24h', pagination: { page: 1, per_page: 200 },
    order_by: [{ field: 'volume', direction: 'DESC' }],
    filters: { include_stablecoins: false, include_native_tokens: false },
  };
  const r = await callNansen<{ data: ScreenerFlowRow[] }>('token-screener', body);
  const flows: TokenFlow[] = (r.data.data ?? [])
    .filter((x) => x.netflow != null && Number.isFinite(x.netflow) && !isStablecoin(x.token_symbol))
    .map((x) => ({ address: x.token_address, symbol: x.token_symbol, netFlowUsd: x.netflow!, sectors: [], traders: null, marketCapUsd: x.market_cap_usd ?? null }));
  return {
    kind: 'market-flow',
    inflows: flows.filter((f) => f.netFlowUsd > 0).sort((a, b) => b.netFlowUsd - a.netFlowUsd).slice(0, TOP_N),
    outflows: flows.filter((f) => f.netFlowUsd < 0).sort((a, b) => a.netFlowUsd - b.netFlowUsd).slice(0, TOP_N),
    sectors: [],
    unavailable: null,
    provenance: {
      title: `Token flows on ${chain}, 24h (all traders)`,
      formula: 'per token: screener netflow = buy volume − sell volume, all traders',
      inputs: [{ label: 'Tokens read', value: String(flows.length) }],
      calls: [{ endpoint: 'token-screener', body, credits: 1, ref: r.meta.cacheHit ? 'served from cache (5 min TTL)' : 'live' }],
      notes: [
        `Nansen has no smart-money labels on ${chain} (checked live), so these are all-trader flows. Sector breakdown needs smart-money/netflow, which doesn't cover ${chain}.`,
        'Stablecoins that pass Nansen\'s include_stablecoins:false filter (e.g. SBUSDT, USDSUI) are dropped by symbol, the same list the pressure index uses.',
      ],
    },
  };
}

async function tokenFlows(chain: string): Promise<FlowSection> {
  const cap = chainCapability(chain);
  try {
    if (cap?.smartMoney) return await smartMoneyFlows(chain);
    if (cap?.screener) return await marketFlows(chain);
  } catch (e) {
    return { kind: 'unavailable', inflows: [], outflows: [], sectors: [], provenance: null, unavailable: `Nansen call failed: ${(e as Error).message.slice(0, 140)}` };
  }
  return { kind: 'unavailable', inflows: [], outflows: [], sectors: [], provenance: null, unavailable: unavailableReason(chain, 'tokenGodMode') ?? `Not available on ${chain} in Nansen API.` };
}

interface RankRow {
  chain: string;
  total_dex_volume_usd: number; total_dex_volume_usd_percent_change: number | null;
  active_address_count_txs: number; active_address_count_txs_percent_change: number | null;
  transaction_count: number; transaction_count_percent_change: number | null;
}

async function peers(chain: string): Promise<ChainPageData['peers']> {
  const body = { time_frame: 7, chain_type: 'all' };
  try {
    const r = await callNansen<{ data: RankRow[] }>('chains/chain-rank', body);
    const rows: PeerRow[] = (r.data.data ?? []).map((x) => ({
      chain: x.chain,
      dexVolumeUsd: x.total_dex_volume_usd, dexVolumeChange: x.total_dex_volume_usd_percent_change,
      activeAddresses: x.active_address_count_txs, activeAddressesChange: x.active_address_count_txs_percent_change,
      txCount: x.transaction_count, txChange: x.transaction_count_percent_change,
    }));
    const self = rows.find((x) => x.chain === chain) ?? null;
    const withGrowth = rows.filter((x) => x.dexVolumeChange != null);
    const growthPercentile = self?.dexVolumeChange != null && withGrowth.length > 1
      ? withGrowth.filter((x) => x.dexVolumeChange! < self.dexVolumeChange!).length / (withGrowth.length - 1)
      : null;
    return {
      rows, self, growthPercentile,
      provenance: {
        title: `${chain} growth vs every chain, 7 days`,
        formula: 'index = 100 at the prior 7 days; now = 100 × (1 + % change)\npercentile = share of chains this chain out-grew',
        inputs: self ? [
          { label: 'DEX volume, 7d', value: usd(self.dexVolumeUsd) },
          { label: 'Change vs prior 7d', value: pct(self.dexVolumeChange) },
          { label: 'Growth percentile', value: growthPercentile == null ? '—' : `${num(growthPercentile * 100, 0)}th` },
        ] : [],
        calls: [{ endpoint: 'chains/chain-rank', body, credits: 1, ref: r.meta.cacheHit ? 'served from cache (30 min TTL)' : 'live' }],
        notes: ['Context only — chain-rank growth is shown beside the pressure index, never blended into it.'],
      },
    };
  } catch (e) {
    return { rows: [], self: null, growthPercentile: null, provenance: null, error: (e as Error).message.slice(0, 140) };
  }
}

/**
 * The tide: smart-money net flow accumulated over TIDE's own snapshots.
 * Each 1h-window snapshot is a flow RATE (net USD in the trailing hour);
 * multiplied by the time since the previous snapshot it's the flow over
 * that gap, so the running sum doesn't double-count overlapping hours when
 * the scanner runs more often than hourly.
 */
function tide(chain: string, now: number): ChainPageData['tide'] {
  const rows = getDb().prepare(`
    SELECT snapshot_at AS t, net_flow_usd AS nf FROM chain_pressure_snapshots
    WHERE chain = ? AND window = '1h' AND snapshot_at >= ? ORDER BY snapshot_at
  `).all(chain, now - 7 * 24 * 60 * 60_000) as Array<{ t: number; nf: number }>;
  const points: TidePoint[] = [];
  let cum = 0;
  rows.forEach((row, i) => {
    const gapH = i === 0 ? 1 : Math.min(1, (row.t - rows[i - 1].t) / 3_600_000);
    const flow = row.nf * gapH;
    cum += flow;
    points.push({ t: row.t, flowUsd: flow, cumulativeUsd: cum });
  });

  let forecast: ChainPageData['tide']['forecast'] = [];
  if (points.length >= 12) {
    const gaps = points.slice(1).map((p, i) => p.t - points[i].t).sort((a, b) => a - b);
    const step = gaps[Math.floor(gaps.length / 2)];
    const steps = Math.max(1, Math.round(24 * 3_600_000 / step));
    const { points: fc } = holtForecast(points.map((p) => p.cumulativeUsd), steps);
    forecast = fc.map((p) => ({ t: points.at(-1)!.t + p.step * step, forecast: p.forecast, low80: p.low80, high80: p.high80 }));
  }
  return {
    points, forecast,
    provenance: {
      title: `Tide — cumulative smart-money flow on ${chain}`,
      formula: 'flow_i = net_flow_1h_i × min(1h, t_i − t_{i−1})\ntide = Σ flow_i    (Holt fan once 12+ snapshots)',
      inputs: [
        { label: 'Snapshots', value: String(points.length) },
        { label: 'Tide now', value: usd(points.at(-1)?.cumulativeUsd, { signed: true }) },
      ],
      calls: [{ endpoint: 'token-screener', body: '1h window, trader_type sm (see the pressure ⓘ for the exact body)', ref: 'scanner snapshots, one per scan' }],
      notes: points.length < 12 ? ['The forecast fan appears once 12 snapshots exist.'] : [],
    },
  };
}

/**
 * Latest trades, with back-to-back fills of one wallet on one token and
 * side folded into a single row (count + summed USD) — bots that DCA every
 * minute would otherwise fill the whole tape with one line repeated.
 */
function tape(chain: string): ChainPageData['tape'] {
  const rows = getDb().prepare(`
    SELECT traded_at AS at, wallet, wallet_label AS label, side, token_symbol AS symbol, usd_value AS usd
    FROM smart_money_trades WHERE chain = ? ORDER BY traded_at DESC LIMIT 400
  `).all(chain) as Array<{ at: number; wallet: string; label: string | null; side: 'buy' | 'sell'; symbol: string | null; usd: number }>;
  const out: ChainPageData['tape'] = [];
  for (const r of rows) {
    const prev = out.at(-1);
    if (prev && prev.wallet === r.wallet && prev.symbol === r.symbol && prev.side === r.side) {
      prev.usd += r.usd;
      prev.count += 1;
      prev.firstAt = r.at;
    } else {
      if (out.length === 30) break;
      out.push({ ...r, firstAt: r.at, count: 1 });
    }
  }
  return out;
}

export async function chainPage(chain: string, now = Date.now()): Promise<ChainPageData> {
  const weather = chainWeather(chain, now);
  const forecast = pressureForecast(chain, 24, now);
  const [flows, peerData] = await Promise.all([tokenFlows(chain), peers(chain)]);
  return {
    chain,
    weather,
    cpiProvenance: cpiProvenance(weather),
    forecast,
    forecastProvenance: forecastProvenance(forecast),
    tide: tide(chain, now),
    flows,
    peers: peerData,
    tape: tape(chain),
  };
}
