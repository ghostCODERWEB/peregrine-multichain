// The token page's data, in the waves the page streams them in (spec 7):
// header, then market + wind + holders, then forensics, with the Storm
// Score recomputed as inputs land. Each wave is one function that makes
// its Nansen calls, computes what the charts show, and returns the ⓘ
// trace next to every number. A wave that Nansen can't serve for this
// chain or token returns `unavailable` with the reason, never a guess.
import { callNansen } from '@/server/nansen/client';
import { traced, errText, isUnavailable, type Wave } from '@/server/nansen/traced';
import { requestDay } from '@/server/nansen/demo';
import { endpointUnavailable } from '@/lib/registry';
import { nonHolderKind, type NonHolderKind } from '@/lib/models/holder-filter';
import { concentrationScore, type ConcentrationResult } from '@/lib/models/storm-score';
import { lorenzCurve, type LorenzPoint } from '@/lib/models/holder-stats';
import { logReturns, ewmaVolatility, volatilityCone, coneCoverage, type ConeCoverage } from '@/lib/models/volatility-cone';
import { clusterHolders, type ClusterLink } from '@/lib/models/wallet-clustering';
import type { NansenCallRef, Provenance } from '@/lib/provenance';
import type {
  TGMTokenInformationResponse, TGMIndicatorsResponse, TokenOHLCVResponse, TGMFlowsResponse,
  TGMFlowIntelligenceResponse, TGMHoldersResponse, TGMWhoBoughtSoldResponse,
} from '@/types/nansen/token-god-mode';
import type { ProfilerAddressFirstFunderResponse, ProfilerAddressRelatedWalletsResponse } from '@/types/nansen/profiler';
import { usd, num, pct } from '@/lib/viz/format';

export { isUnavailable, type Wave };

// ---------------------------------------------------------------- header

export interface Indicator { type: string; score: string | null; signal: number | null; percentile: number | null; lastTrigger: string | null }

export interface TokenHeader {
  name: string | null;
  symbol: string | null;
  /** Nansen's logo URL for the token (https only); the viewer's browser loads it. */
  logo: string | null;
  marketCapUsd: number | null;
  fdvUsd: number | null;
  liquidityUsd: number | null;
  holders: number | null;
  volume24hUsd: number | null;
  buyVolumeUsd: number | null;
  sellVolumeUsd: number | null;
  uniqueBuyers: number | null;
  uniqueSellers: number | null;
  deployedAt: string | null;
  marketCapGroup: string | null;
  isStablecoin: boolean | null;
  risk: Indicator[];
  reward: Indicator[];
  indicatorsUnavailable: string | null;
  provenance: Provenance;
}

export async function headerWave(chain: string, token: string): Promise<Wave<TokenHeader>> {
  const gap = endpointUnavailable('tgmTokenInformation', chain, 'Token information');
  if (gap) return { unavailable: gap };
  try {
    const infoBody = { chain, token_address: token, timeframe: '1d' };
    const indBody = { chain, token_address: token };
    const [info, ind] = await Promise.all([
      traced<TGMTokenInformationResponse>('tgm/token-information', infoBody, 1),
      traced<TGMIndicatorsResponse>('tgm/indicators', indBody, 5).catch((e) => ({ error: errText(e) })),
    ]);
    const d = info.data.data;
    const m = d.spot_metrics ?? {};
    const t = d.token_details ?? {};
    const mapInd = (x: TGMIndicatorsResponse['risk_indicators'][number]): Indicator => ({
      type: x.indicator_type, score: x.score ?? null, signal: x.signal ?? null, percentile: x.signal_percentile ?? null, lastTrigger: x.last_trigger_on ?? null,
    });
    const indOk = 'data' in ind ? ind : null;
    if (!d.symbol && !d.name && t.market_cap_usd == null && m.volume_total_usd == null) {
      return { unavailable: `Nansen has no token information for ${token} on ${chain}.` };
    }
    const header: Omit<TokenHeader, 'provenance'> = {
      name: d.name ?? null,
      symbol: d.symbol ?? null,
      logo: d.logo && /^https:\/\//.test(d.logo) ? d.logo : null,
      marketCapUsd: t.market_cap_usd ?? indOk?.data.token_info.market_cap_usd ?? null,
      fdvUsd: t.fdv_usd ?? null,
      liquidityUsd: m.liquidity_usd ?? null,
      holders: m.total_holders ?? null,
      volume24hUsd: m.volume_total_usd ?? null,
      buyVolumeUsd: m.buy_volume_usd ?? null,
      sellVolumeUsd: m.sell_volume_usd ?? null,
      uniqueBuyers: m.unique_buyers ?? null,
      uniqueSellers: m.unique_sellers ?? null,
      deployedAt: t.token_deployment_date ?? null,
      marketCapGroup: indOk?.data.token_info.market_cap_group ?? null,
      isStablecoin: indOk?.data.token_info.is_stablecoin ?? null,
      risk: indOk?.data.risk_indicators.map(mapInd) ?? [],
      reward: indOk?.data.reward_indicators.map(mapInd) ?? [],
      indicatorsUnavailable: indOk ? null : ('error' in ind ? ind.error : null),
    };
    return {
      ...header,
      provenance: {
        title: `${header.symbol ?? token} — token facts, 24h`,
        formula: 'as reported by Nansen (no transformation)',
        inputs: [
          { label: 'Market cap', value: usd(header.marketCapUsd) },
          { label: 'Liquidity', value: usd(header.liquidityUsd) },
          { label: '24h volume (buy / sell)', value: `${usd(header.buyVolumeUsd)} / ${usd(header.sellVolumeUsd)}` },
          { label: 'Holders', value: header.holders?.toLocaleString('en-US') ?? '—' },
        ],
        calls: [info.call, ...(indOk ? [indOk.call] : [])],
      },
    };
  } catch (e) {
    return { unavailable: errText(e) };
  }
}

// ---------------------------------------------------------------- market

export interface Candle { t: number; o: number; h: number; l: number; c: number; v: number }

export interface MarketWave {
  candles: Candle[];
  /** Daily net flow of the segment's holdings, USD (Δ tokens × price). */
  segmentFlow: Array<{ t: number; netUsd: number }>;
  segment: 'smart money' | 'whales' | null;
  segmentUnavailable: string | null;
  cone: {
    sigma4h: number;
    sigmaDaily: number;
    /** One band per horizon (1, 3, 7 days) ahead of the last candle. */
    bands: Array<{ days: number; t: number; low: number; high: number }>;
    lastClose: number;
    lastT: number;
    coverage: ConeCoverage | null;
  } | null;
  provenance: { candles: Provenance; cone: Provenance | null };
}

const STEPS_PER_DAY = 6; // 4h candles

export async function marketWave(chain: string, token: string, smartMoneyChain: boolean): Promise<Wave<MarketWave>> {
  const gap = endpointUnavailable('tgmTokenOhlcv', chain, 'Price candles');
  if (gap) return { unavailable: gap };
  try {
    const date = { from: requestDay(14), to: requestDay(-1) };
    const ohlcvBody = { chain, token_address: token, timeframe: '4h', date };
    const ohlcv = await traced<TokenOHLCVResponse>('tgm/token-ohlcv', ohlcvBody, 1);
    const candles: Candle[] = ohlcv.data.data
      .filter((x) => x.open != null && x.high != null && x.low != null && x.close != null && x.close > 0)
      .map((x) => ({ t: Date.parse(x.interval_start), o: x.open!, h: x.high!, l: x.low!, c: x.close!, v: x.volume_usd ?? 0 }))
      .sort((a, b) => a.t - b.t);
    if (!candles.length) return { unavailable: `Nansen returned no price candles for this token on ${chain} in the last 14 days.` };

    // Holdings flow of the most informative segment Nansen labels on this
    // chain: smart money where it exists, whales otherwise.
    let segmentFlow: MarketWave['segmentFlow'] = [];
    let segment: MarketWave['segment'] = null;
    let segmentUnavailable: string | null = endpointUnavailable('tgmFlows', chain, 'Holder-segment flows');
    const flowCalls: NansenCallRef[] = [];
    if (!segmentUnavailable) {
      for (const [label, name] of (smartMoneyChain ? [['smart_money', 'smart money'], ['whale', 'whales']] : [['whale', 'whales']]) as Array<[string, MarketWave['segment']]>) {
        const body = { chain, token_address: token, label, date, pagination: { page: 1, per_page: 100 } };
        try {
          const f = await traced<TGMFlowsResponse>('tgm/flows', body, 1);
          flowCalls.push(f.call);
          const rows = f.data.data
            .filter((x) => (x.price_usd ?? 0) > 0 && Date.parse(x.date) <= Date.now())
            .map((x) => ({ t: Date.parse(x.date), netUsd: ((x.total_inflows_count ?? 0) + (x.total_outflows_count ?? 0)) * (x.price_usd ?? 0) }))
            .sort((a, b) => a.t - b.t);
          if (rows.some((r) => r.netUsd !== 0)) { segmentFlow = rows; segment = name; break; }
        } catch (e) {
          segmentUnavailable = errText(e);
          break;
        }
      }
      if (!segment && !segmentUnavailable) segmentUnavailable = 'Nansen shows no smart-money or whale holdings movement in this token over 14 days.';
    }

    const closes = candles.map((c) => c.c);
    let cone: MarketWave['cone'] = null;
    let coneProv: Provenance | null = null;
    if (closes.length >= 13) {
      const sigma4h = ewmaVolatility(logReturns(closes));
      const last = candles.at(-1)!;
      const bands = volatilityCone(last.c, sigma4h, [1, 3, 7].map((d) => d * STEPS_PER_DAY))
        .map((b, i) => ({ days: [1, 3, 7][i], t: last.t + [1, 3, 7][i] * 86_400_000, low: b.low, high: b.high }));
      const coverage = coneCoverage(closes, STEPS_PER_DAY);
      cone = { sigma4h, sigmaDaily: sigma4h * Math.sqrt(STEPS_PER_DAY), bands, lastClose: last.c, lastT: last.t, coverage };
      coneProv = {
        title: 'Volatility cone — 80% range ahead',
        formula: 'σ²_t = 0.94·σ²_{t−1} + 0.06·r_t²   (r = 4h log return)\nband_h = P·exp(±1.28·σ·√h),  h = 6, 18, 42 steps (1d, 3d, 7d)\ntrack record: walk-forward, σ fit on data known at the time',
        inputs: [
          { label: 'σ per 4h · per day', value: `${pct(sigma4h)} · ${pct(cone.sigmaDaily)}` },
          { label: 'Last close', value: `$${last.c.toPrecision(4)}` },
          { label: '1d band', value: `$${bands[0].low.toPrecision(3)} – $${bands[0].high.toPrecision(3)}` },
          { label: '1d moves inside band (track record)', value: coverage ? `${pct(coverage.hitRate, 0)} of ${coverage.n}` : '—' },
        ],
        calls: [ohlcv.call],
        notes: ['A random-walk range, not a price target. A calibrated 80% cone holds ~80% of moves; the track record says how this one has done on this token.'],
      };
    }
    return {
      candles, segmentFlow, segment, segmentUnavailable, cone,
      provenance: {
        candles: {
          title: 'Price and holder-segment flow, 14 days',
          formula: 'candles: 4h OHLC as reported\nsegment flow_day = (tokens in − tokens out) × price_day',
          inputs: [
            { label: 'Candles', value: String(candles.length) },
            { label: 'Segment', value: segment ?? '—' },
            { label: 'Segment net flow, 14d', value: usd(segmentFlow.reduce((s, r) => s + r.netUsd, 0), { signed: true }) },
          ],
          calls: [ohlcv.call, ...flowCalls],
        },
        cone: coneProv,
      },
    };
  } catch (e) {
    return { unavailable: errText(e) };
  }
}

// ---------------------------------------------------------------- wind

import { WIND_SEGMENTS, WIND_TIMEFRAMES, type WindSegment, type WindTimeframe } from '@/lib/wind';
export { WIND_SEGMENTS, WIND_TIMEFRAMES, type WindSegment, type WindTimeframe };

export interface WindCell { netUsd: number | null; wallets: number | null }

export interface WindWave {
  /** rings[timeframe][segment] */
  rings: Record<WindTimeframe, Record<WindSegment, WindCell>>;
  warnings: string[];
  provenance: Provenance;
}

export async function windWave(chain: string, token: string): Promise<Wave<WindWave>> {
  const gap = endpointUnavailable('tgmFlowIntelligence', chain, 'Cohort flows');
  if (gap) return { unavailable: gap };
  try {
    const results = await Promise.all(WIND_TIMEFRAMES.map((tf) =>
      traced<TGMFlowIntelligenceResponse>('tgm/flow-intelligence', { chain, token_address: token, timeframe: tf }, 1)));
    const rings = {} as WindWave['rings'];
    const warnings = new Set<string>();
    WIND_TIMEFRAMES.forEach((tf, i) => {
      const row = results[i].data.data[0] ?? {};
      for (const w of results[i].data.warnings ?? []) warnings.add(w);
      const get = (k: string): number | null => {
        const v = (row as Record<string, number | null | undefined>)[k];
        return v == null || !Number.isFinite(v) ? null : v;
      };
      rings[tf] = Object.fromEntries(WIND_SEGMENTS.map((s) => [s, {
        netUsd: get(`${s}_net_flow_usd`),
        // Nansen documents both of these counts as always 0 (untracked):
        // show them as unknown, not as zero wallets.
        wallets: s === 'exchange' || s === 'fresh_wallets' ? null : get(`${s}_wallet_count`),
      }])) as Record<WindSegment, WindCell>;
    });
    const d1 = rings['1d'];
    if (WIND_TIMEFRAMES.every((tf) => WIND_SEGMENTS.every((s) => !rings[tf][s].netUsd))) {
      return { unavailable: 'Nansen reports no labelled-segment flow for this token in any window (1h–7d).' };
    }
    return {
      rings, warnings: [...warnings],
      provenance: {
        title: 'Cohort flows — who is moving this token',
        formula: 'net flow per segment per window, as reported by tgm/flow-intelligence\n(one ring per window: 1h inner → 7d outer)',
        inputs: WIND_SEGMENTS.map((s) => ({ label: `${s.replace('_', ' ')} · 1d`, value: usd(d1[s].netUsd, { signed: true }) })),
        calls: results.map((r) => r.call),
        notes: ['Fresh-wallet flow exists only for the 1d and 7d windows (Nansen). Exchange and fresh-wallet wallet counts are not tracked by Nansen.'],
      },
    };
  } catch (e) {
    return { unavailable: errText(e) };
  }
}

// ---------------------------------------------------------------- holders

export interface HolderRow {
  address: string;
  label: string | null;
  share: number;
  valueUsd: number | null;
  change24h: number | null;
  excluded: NonHolderKind | null;
}

export interface Trader { address: string; label: string | null; boughtUsd: number; soldUsd: number }

export interface HoldersWave {
  holders: HolderRow[];
  realShares: number[];
  concentration: ConcentrationResult | null;
  lorenz: LorenzPoint[];
  excludedShare: number;
  buyers: Trader[];
  sellers: Trader[];
  tradersUnavailable: string | null;
  provenance: { holders: Provenance; traders: Provenance | null };
}

export async function holdersWave(chain: string, token: string): Promise<Wave<HoldersWave>> {
  const gap = endpointUnavailable('tgmHolders', chain, 'Holders');
  if (gap) return { unavailable: gap };
  try {
    // premium_labels stays off: it raises this call from 5 to 150 credits.
    const hBody = { chain, token_address: token, label_type: 'all_holders', pagination: { page: 1, per_page: 100 }, order_by: [{ field: 'ownership_percentage', direction: 'DESC' }] };
    const h = await traced<TGMHoldersResponse>('tgm/holders', hBody, 5);
    const holders: HolderRow[] = h.data.data
      .filter((x) => x.address && x.ownership_percentage != null)
      .map((x) => ({
        address: x.address!, label: x.address_label ?? null, share: x.ownership_percentage!, valueUsd: x.value_usd ?? null,
        change24h: x.balance_change_24h ?? null, excluded: nonHolderKind(x.address_label),
      }));
    if (!holders.length) return { unavailable: `Nansen returned no holders for this token on ${chain}.` };
    const real = holders.filter((x) => !x.excluded);
    const realShares = real.map((x) => x.share);
    const concentration = realShares.length ? concentrationScore({ shares: realShares }) : null;
    const excludedShare = holders.filter((x) => x.excluded).reduce((s, x) => s + x.share, 0);

    // Top buyers and sellers, 7 days.
    let buyers: Trader[] = [], sellers: Trader[] = [];
    let tradersUnavailable: string | null = endpointUnavailable('tgmWhoBoughtSold', chain, 'Buyers and sellers');
    let tradersProv: Provenance | null = null;
    if (!tradersUnavailable) {
      const date = { from: requestDay(7), to: requestDay(-1) };
      const bBody = { chain, token_address: token, buy_or_sell: 'BUY', date, pagination: { page: 1, per_page: 20 }, order_by: [{ field: 'bought_volume_usd', direction: 'DESC' }] };
      const sBody = { ...bBody, buy_or_sell: 'SELL', order_by: [{ field: 'sold_volume_usd', direction: 'DESC' }] };
      try {
        const [b, s] = await Promise.all([traced<TGMWhoBoughtSoldResponse>('tgm/who-bought-sold', bBody, 1), traced<TGMWhoBoughtSoldResponse>('tgm/who-bought-sold', sBody, 1)]);
        const map = (x: TGMWhoBoughtSoldResponse['data'][number]): Trader => ({ address: x.address, label: x.address_label ?? null, boughtUsd: x.bought_volume_usd ?? 0, soldUsd: x.sold_volume_usd ?? 0 });
        buyers = b.data.data.map(map).filter((x) => x.boughtUsd > 0);
        sellers = s.data.data.map(map).filter((x) => x.soldUsd > 0);
        const bSum = buyers.reduce((a, x) => a + x.boughtUsd, 0), sSum = sellers.reduce((a, x) => a + x.soldUsd, 0);
        tradersProv = {
          title: 'Top 20 buyers vs top 20 sellers, 7 days',
          formula: 'sell skew = Σ sold (top 20 sellers) ÷ (Σ bought (top 20 buyers) + Σ sold (top 20 sellers))',
          inputs: [
            { label: 'Top 20 bought', value: usd(bSum) },
            { label: 'Top 20 sold', value: usd(sSum) },
            { label: 'Sell skew', value: bSum + sSum > 0 ? pct(sSum / (bSum + sSum), 0) : '—' },
          ],
          calls: [b.call, s.call],
        };
        if (!buyers.length && !sellers.length) tradersUnavailable = 'Nansen shows no buyers or sellers for this token in the last 7 days.';
      } catch (e) {
        tradersUnavailable = errText(e);
      }
    }

    return {
      holders, realShares, concentration, lorenz: lorenzCurve(realShares), excludedShare, buyers, sellers, tradersUnavailable,
      provenance: {
        holders: {
          title: 'Concentration (C) — top 100 holders',
          formula: 'C = 100·(0.35·HHI_n + 0.25·Gini + 0.25·T10 + 0.15·(1 − min(K,20)/20))\nshares s_i exclude exchange, bridge, pool, contract and burn labels',
          inputs: concentration ? [
            { label: 'Real holders in top 100', value: String(real.length) },
            { label: 'Excluded (custody, pools, contracts)', value: pct(excludedShare) },
            { label: 'HHI_n · Gini', value: `${num(concentration.hhiN, 3)} · ${num(concentration.giniCoefficient, 2)}` },
            { label: 'Top-10 share · Nakamoto K', value: `${pct(concentration.top10Share)} · ${concentration.nakamoto}` },
            { label: 'C', value: num(concentration.score) },
          ] : [],
          calls: [h.call],
          notes: ['Computed over the top 100 holders Nansen returns, not every holder: Gini here measures inequality among the largest wallets.'],
        },
        traders: tradersProv,
      },
    };
  } catch (e) {
    return { unavailable: errText(e) };
  }
}

// ---------------------------------------------------------------- forensics

export interface GraphNode { address: string; label: string | null; share: number; cluster: number; funder: string | null; funderName: string | null; funderChain: string | null }

export interface ForensicsWave {
  nodes: GraphNode[];
  links: ClusterLink[];
  clusters: Array<{ id: number; wallets: string[]; share: number; includesDeployer: boolean }>;
  clusteredHolderCount: number;
  deployer: string | null;
  missingFunders: number;
  provenance: Provenance;
}

const FORENSIC_TOP = 25;
/** profiler/address/first-funder takes an EVM address (docs). Sui/Aptos
 *  addresses are also 0x-hex but 64 digits, so length decides. */
const isEvmAddress = (a: string) => /^0x[0-9a-fA-F]{40}$/.test(a);

export async function forensicsWave(chain: string, token: string, holders: HolderRow[]): Promise<Wave<ForensicsWave>> {
  const gap = endpointUnavailable('profilerRelatedWallets', chain, 'Insider clusters (related wallets)');
  if (gap) return { unavailable: gap };
  const top = holders.filter((h) => !h.excluded).slice(0, FORENSIC_TOP);
  if (top.length < 2) return { unavailable: 'Fewer than two non-custodial holders to compare.' };
  try {
    const calls: NansenCallRef[] = [];
    const rwTokenBody = { address: token, chain, pagination: { page: 1, per_page: 20 } };
    const deployerP = traced<ProfilerAddressRelatedWalletsResponse>('profiler/address/related-wallets', rwTokenBody, 1)
      .then((r) => { calls.push({ ...r.call, ref: `${r.call.ref} · deployer lookup` }); return r.data.data.find((x) => /deploy/i.test(x.relation))?.address ?? null; })
      .catch(() => null);

    const firstFunder = new Map<string, string>();
    const funderMeta = new Map<string, { name: string | null; chain: string | null }>();
    const related = new Map<string, string[]>();
    let missingFunders = 0;
    let ffCalls = 0, rwCalls = 0;
    await Promise.all(top.map(async (h) => {
      const self = h.address.toLowerCase();
      const [ff, rw] = await Promise.all([
        isEvmAddress(h.address)
          ? callNansen<ProfilerAddressFirstFunderResponse>('profiler/address/first-funder', { address: h.address, chain: 'all' }).then((r) => { ffCalls++; return r; }).catch(() => null)
          : Promise.resolve(null),
        callNansen<ProfilerAddressRelatedWalletsResponse>('profiler/address/related-wallets', { address: h.address, chain, pagination: { page: 1, per_page: 50 } }).catch(() => null),
      ]);
      rwCalls++;
      const f = ff?.data.data[0];
      if (f?.first_funder_address) {
        firstFunder.set(self, f.first_funder_address.toLowerCase());
        funderMeta.set(self, { name: f.first_funder_name ?? null, chain: f.chain ?? null });
      } else missingFunders++;
      if (rw) related.set(self, rw.data.data.map((x) => x.address.toLowerCase()));
    }));
    const deployer = await deployerP;
    const evm = top.some((h) => isEvmAddress(h.address));
    calls.push(
      ...(evm ? [{ endpoint: 'profiler/address/first-funder', body: { address: '<each of the top holders>', chain: 'all' }, credits: 1, ref: `${ffCalls} calls · cached 7 days` }] : []),
      { endpoint: 'profiler/address/related-wallets', body: { address: '<each of the top holders>', chain, pagination: { page: 1, per_page: 50 } }, credits: 1, ref: `${rwCalls} calls · cached 7 days` },
    );

    const res = clusterHolders(top.map((h) => ({ address: h.address, share: h.share })), { firstFunder, related, deployer });
    const clusterOf = new Map<string, number>();
    for (const c of res.clusters) for (const w of c.wallets) clusterOf.set(w.toLowerCase(), c.id);
    const nodes: GraphNode[] = top.map((h) => {
      const self = h.address.toLowerCase();
      return {
        address: h.address, label: h.label, share: h.share, cluster: clusterOf.get(self) ?? -1,
        funder: firstFunder.get(self) ?? null, funderName: funderMeta.get(self)?.name ?? null, funderChain: funderMeta.get(self)?.chain ?? null,
      };
    });
    const multi = res.clusters.filter((c) => c.wallets.length >= 2);
    const biggest = multi[0];
    return {
      nodes,
      links: res.clusters.flatMap((c) => c.links),
      clusters: res.clusters.map(({ id, wallets, share, includesDeployer }) => ({ id, wallets, share, includesDeployer })),
      clusteredHolderCount: res.clusteredHolderCount,
      deployer,
      missingFunders,
      provenance: {
        title: 'Insider clusters (I) — top 25 holders',
        formula: 'union-find: join holders with the same first funder, or linked by related-wallets\nI = 100·min(1, 1.6·max_cluster_share + 0.02·n_clustered + 0.15·deployer_linked)',
        inputs: [
          { label: 'Holders examined', value: String(top.length) },
          { label: 'Clusters of 2+', value: String(multi.length) },
          { label: 'Largest cluster', value: biggest ? `${biggest.wallets.length} wallets · ${pct(biggest.share)}` : '—' },
          { label: 'Holders clustered', value: String(res.clusteredHolderCount) },
          { label: 'Deployer', value: deployer ? `${deployer.slice(0, 8)}…${multi.some((c) => c.includesDeployer) ? ' (linked)' : ''}` : 'not found' },
        ],
        calls,
        notes: [
          'First funder = who sent the wallet its first gas, resolved across chains by Nansen. A shared funder is evidence of common control, not proof.',
          ...(!evm ? ['First-funder lookups take EVM addresses only, so clusters on this chain come from related-wallets alone.']
            : missingFunders ? [`${missingFunders} holder(s) had no first funder in Nansen.`] : []),
        ],
      },
    };
  } catch (e) {
    return { unavailable: errText(e) };
  }
}
