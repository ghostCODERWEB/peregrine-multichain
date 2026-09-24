// Everything /wallet/[address] shows. One function per section so the page
// can stream them independently (each is its own Suspense boundary); each
// returns its ⓘ trace or the plain reason Nansen couldn't serve it. No
// profiler/address/labels call (100 credits): the wallet's name comes from
// labels Nansen already returned with its trades and transfers.
import { getDb } from '@/server/nansen/db';
import { requestDay } from '@/server/nansen/demo';
import { traced, errText, type Wave } from '@/server/nansen/traced';
import { endpointSupports } from '@/lib/registry';
import type { Provenance } from '@/lib/provenance';
import type { ProfilerAddressHistoricalBalancesResponse } from '@/types/nansen/api.gen';
import type {
  ProfilerAddressBalancesResponse, ProfilerAddressPnlSummaryResponse, ProfilerAddressFirstFunderResponse,
  ProfilerAddressRelatedWalletsResponse, ProfilerAddressCounterpartiesResponse, ProfilerAddressTransactionsResponse,
} from '@/types/nansen/profiler';
import { usd, pct, chainName, amount } from '@/lib/viz/format';

export const isEvm = (a: string) => /^0x[0-9a-fA-F]{40}$/.test(a);

/** Who a profiler section is about: one address, or a Nansen entity (all
 *  the addresses Nansen attributes to it, aggregated by Nansen). */
export type Subject = string | { entity: string };
export const subjectBody = (s: Subject) => (typeof s === 'string' ? { address: s } : { entity_name: s.entity });
const whose = (s: Subject) => (typeof s === 'string' ? 'this wallet' : s.entity);

// ------------------------------------------------------------- balances

export interface Balances {
  totalUsd: number;
  byChain: Array<{ chain: string; valueUsd: number; tokens: number }>;
  /** Every positive priced position returned by the one balance call. */
  positions: Array<{ chain: string; symbol: string; tokenAddress: string; valueUsd: number; amount: number | null }>;
  top: Array<{ chain: string; symbol: string; tokenAddress: string; valueUsd: number; amount: number | null }>;
  provenance: Provenance;
}

export async function balances(subject: Subject): Promise<Wave<Balances>> {
  const body = { ...subjectBody(subject), chain: 'all', hide_spam_token: true, pagination: { page: 1, per_page: 200 }, order_by: [{ field: 'value_usd', direction: 'DESC' }] };
  try {
    const r = await traced<ProfilerAddressBalancesResponse>('profiler/address/current-balance', body, 1);
    const rows = r.data.data.filter((x) => (x.value_usd ?? 0) > 0);
    if (!rows.length) return { unavailable: `Nansen shows no token balances with a USD value for ${whose(subject)}.` };
    const m = new Map<string, { valueUsd: number; tokens: number }>();
    for (const x of rows) {
      const e = m.get(x.chain) ?? { valueUsd: 0, tokens: 0 };
      e.valueUsd += x.value_usd!;
      e.tokens += 1;
      m.set(x.chain, e);
    }
    const byChain = [...m.entries()].map(([chain, v]) => ({ chain, ...v })).sort((a, b) => b.valueUsd - a.valueUsd);
    const totalUsd = byChain.reduce((s, c) => s + c.valueUsd, 0);
    const positions = rows.map((x) => ({ chain: x.chain, symbol: x.token_symbol, tokenAddress: x.token_address, valueUsd: x.value_usd!, amount: x.token_amount ?? null }));
    return {
      totalUsd, byChain,
      positions,
      top: positions.slice(0, 12),
      provenance: {
        title: 'Balances across every chain',
        formula: 'per chain: Σ value_usd of the tokens Nansen prices (spam hidden)',
        inputs: [
          { label: 'Total', value: usd(totalUsd) },
          { label: 'Chains', value: String(byChain.length) },
          { label: 'Largest', value: `${chainName(byChain[0].chain)} ${pct(byChain[0].valueUsd / totalUsd, 0)}` },
        ],
        calls: [r.call],
        notes: r.data.pagination?.is_last_page === false ? ['Only the 200 largest positions are counted.'] : [],
      },
    };
  } catch (e) {
    return { unavailable: errText(e) };
  }
}

// ------------------------------------------------------------- pnl

export interface PnlSummary {
  realizedUsd: number;
  realizedPct: number;
  winRate: number;
  tokens: number;
  exits: number;
  top: Array<{ symbol: string; chain: string; tokenAddress: string; pnlUsd: number | null; roi: number | null }>;
  provenance: Provenance;
}

export async function pnl(subject: Subject): Promise<Wave<PnlSummary>> {
  const body = { ...subjectBody(subject), chain: 'all', date: { from: requestDay(30), to: requestDay(-1) } };
  try {
    const r = await traced<ProfilerAddressPnlSummaryResponse>('profiler/address/pnl-summary', body, 1);
    const d = r.data;
    return {
      realizedUsd: d.realized_pnl_usd, realizedPct: d.realized_pnl_percent, winRate: d.win_rate, tokens: d.traded_token_count, exits: d.traded_times,
      top: d.top5_tokens.map((t) => ({ symbol: t.token_symbol, chain: t.chain, tokenAddress: t.token_address, pnlUsd: t.realized_pnl, roi: t.realized_roi })),
      provenance: {
        title: 'Realized PnL, 30 days',
        formula: 'as reported by Nansen (realized only; open positions not marked)',
        inputs: [
          { label: 'Realized PnL', value: usd(d.realized_pnl_usd, { signed: true }) },
          { label: 'Realized return', value: pct(d.realized_pnl_percent) },
          { label: 'Win rate', value: pct(d.win_rate, 0) },
          { label: 'Tokens · exits', value: `${d.traded_token_count} · ${d.traded_times}` },
        ],
        calls: [r.call],
      },
    };
  } catch (e) {
    return { unavailable: errText(e) };
  }
}

// ------------------------------------------------------------- origins

export interface Origins {
  /** funderName is a Nansen label: stripped in public views. */
  firstFunder: { address: string; funderName: string | null; chain: string; at: string } | null;
  firstFunderNote: string | null;
  relatedChain: string | null;
  related: Array<{ address: string; label: string | null; relation: string; chain: string; at: string }>;
  provenance: Provenance;
}

export async function origins(address: string, mainChain: string | null): Promise<Wave<Origins>> {
  const calls: Provenance['calls'] = [];
  let firstFunder: Origins['firstFunder'] = null;
  let firstFunderNote: string | null = null;
  try {
    if (isEvm(address)) {
      const r = await traced<ProfilerAddressFirstFunderResponse>('profiler/address/first-funder', { address, chain: 'all' }, 1);
      calls.push(r.call);
      const f = r.data.data[0];
      if (f) firstFunder = { address: f.first_funder_address, funderName: f.first_funder_name ?? null, chain: f.chain, at: f.block_timestamp };
      else firstFunderNote = 'Nansen has no first funder for this address.';
    } else firstFunderNote = 'First-funder lookups take EVM addresses only.';

    const chain = mainChain && endpointSupports('profilerRelatedWallets', mainChain) ? mainChain : isEvm(address) ? 'ethereum' : null;
    let related: Origins['related'] = [];
    if (chain) {
      const body = { address, chain, pagination: { page: 1, per_page: 25 } };
      const r = await traced<ProfilerAddressRelatedWalletsResponse>('profiler/address/related-wallets', body, 1);
      calls.push(r.call);
      related = r.data.data.map((x) => ({ address: x.address, label: x.address_label ?? null, relation: x.relation, chain: x.chain, at: x.block_timestamp }));
    }
    return {
      firstFunder, firstFunderNote, relatedChain: chain, related,
      provenance: {
        title: 'Where this wallet came from',
        formula: 'first funder: earliest address to send it gas, any chain\nrelated wallets: Nansen relations (funder, deployer, …) on its main chain',
        inputs: [
          // Provenance quotes addresses, never labels: it is not redacted.
          { label: 'First funder', value: firstFunder ? `${firstFunder.address.slice(0, 10)}… on ${chainName(firstFunder.chain)}` : '—' },
          { label: 'Related wallets', value: `${related.length}${chain ? ` on ${chainName(chain)}` : ''}` },
        ],
        calls,
      },
    };
  } catch (e) {
    return { unavailable: errText(e) };
  }
}

// ------------------------------------------------------------- counterparties

export interface Counterparties {
  chain: string;
  rows: Array<{ address: string; label: string | null; interactions: number; inUsd: number; outUsd: number; totalUsd: number }>;
  provenance: Provenance;
}

export async function counterparties(subject: Subject, mainChain: string | null): Promise<Wave<Counterparties>> {
  const chain = mainChain && endpointSupports('profilerCounterparties', mainChain) ? mainChain : null;
  if (!chain) return { unavailable: `Counterparties need ${whose(subject)}’s main chain, and Nansen shows no balances to find it from.` };
  // An entity's counterparties are grouped by entity; a wallet's by wallet.
  const body = { ...subjectBody(subject), chain, date: { from: requestDay(30), to: requestDay(-1) }, group_by: typeof subject === 'string' ? 'wallet' : 'entity', pagination: { page: 1, per_page: typeof subject === 'string' ? 10 : 11 }, order_by: [{ field: 'total_volume_usd', direction: 'DESC' }] };
  try {
    const r = await traced<ProfilerAddressCounterpartiesResponse>('profiler/address/counterparties', body, 5);
    const all = r.data.data.map((x) => ({
      address: x.counterparty_address, label: x.counterparty_address_label?.[0] ?? null, interactions: x.interaction_count,
      inUsd: x.volume_in_usd ?? 0, outUsd: x.volume_out_usd ?? 0, totalUsd: x.total_volume_usd ?? 0,
    }));
    // Grouped by entity, an entity's transfers between its own addresses
    // come back as the entity being its own counterparty; leave those out.
    const self = typeof subject === 'string' ? null : subject.entity.trim().toLowerCase();
    const rows = all.filter((x) => !self || x.label?.trim().toLowerCase() !== self).slice(0, 10);
    const internal = all.length - rows.length > 0 && self != null && all.some((x) => x.label?.trim().toLowerCase() === self);
    if (!rows.length) return { unavailable: `No counterparties on ${chainName(chain)} in the last 30 days${internal ? ' besides transfers between its own addresses' : ''}.` };
    return {
      chain, rows,
      provenance: {
        title: `Top counterparties on ${chainName(chain)}, 30 days`,
        formula: `as reported by Nansen, ranked by total volume\nin = sent to ${whose(subject)}, out = sent by it`,
        inputs: [{ label: 'Largest', value: `${rows[0].address.slice(0, 10)}… · ${usd(rows[0].totalUsd)}` }],
        calls: [r.call],
        notes: internal ? ['Transfers between the entity’s own addresses are left out.'] : [],
      },
    };
  } catch (e) {
    return { unavailable: errText(e) };
  }
}

// ------------------------------------------------------------- transactions

export interface Tx {
  at: string; chain: string; hash: string; method: string; volumeUsd: number | null;
  sent: string[]; received: string[];
}

export async function transactions(address: string): Promise<Wave<{ rows: Tx[]; selfLabel: string | null; provenance: Provenance }>> {
  const body = { address, chain: 'all', date: { from: requestDay(7), to: requestDay(-1) }, hide_spam_token: true, pagination: { page: 1, per_page: 25 }, order_by: [{ field: 'block_timestamp', direction: 'DESC' }] };
  try {
    const r = await traced<ProfilerAddressTransactionsResponse>('profiler/address/transactions', body, 1);
    const lower = address.toLowerCase();
    let selfLabel: string | null = null;
    const fmt = (t: { token_symbol: string; token_amount: number; value_usd?: number | null }) => `${t.value_usd != null ? usd(Math.abs(t.value_usd)) : amount(t.token_amount)} ${t.token_symbol}`;
    const rows: Tx[] = r.data.data.map((x) => {
      for (const t of [...(x.tokens_sent ?? []), ...(x.tokens_received ?? [])]) {
        if (!selfLabel && t.from_address.toLowerCase() === lower && t.from_address_label) selfLabel = t.from_address_label;
        if (!selfLabel && t.to_address.toLowerCase() === lower && t.to_address_label) selfLabel = t.to_address_label;
      }
      return {
        at: x.block_timestamp, chain: x.chain, hash: x.transaction_hash, method: x.method, volumeUsd: x.volume_usd ?? null,
        sent: (x.tokens_sent ?? []).map(fmt), received: (x.tokens_received ?? []).map(fmt),
      };
    });
    if (!rows.length) return { unavailable: 'No transactions in the last 7 days in Nansen.' };
    return {
      rows, selfLabel,
      provenance: { title: 'Recent transactions, 7 days', formula: 'as reported by Nansen, newest first (spam tokens hidden)', inputs: [{ label: 'Shown', value: String(rows.length) }], calls: [r.call] },
    };
  } catch (e) {
    return { unavailable: errText(e) };
  }
}

// ------------------------------------------------------------- migration trail

export interface TrailStep { at: number; chain: string; side: 'buy' | 'sell'; symbol: string | null; tokenAddress: string; usd: number; count: number }

/**
 * The wallet's smart-money DEX trades across chains from TIDE's own
 * scanner record (free — no Nansen call at view time), consecutive fills on
 * the same chain, token and side folded together, oldest first.
 */
export function migrationTrail(address: string, days = 7): { steps: TrailStep[]; label: string | null; chains: string[]; provenance: Provenance } {
  const rows = getDb().prepare(`
    SELECT traded_at AS at, chain, side, token_symbol AS symbol, token_address AS tokenAddress, usd_value AS usd, wallet_label AS label
    FROM smart_money_trades WHERE lower(wallet) = lower(?) AND traded_at >= ? ORDER BY traded_at
  `).all(address, Date.now() - days * 86_400_000) as Array<Omit<TrailStep, 'count'> & { label: string | null }>;
  const steps: TrailStep[] = [];
  for (const r of rows) {
    const prev = steps.at(-1);
    if (prev && prev.chain === r.chain && prev.side === r.side && prev.tokenAddress === r.tokenAddress) {
      prev.usd += r.usd; prev.count += 1;
    } else steps.push({ at: r.at, chain: r.chain, side: r.side, symbol: r.symbol, tokenAddress: r.tokenAddress, usd: r.usd, count: 1 });
  }
  const chains = [...new Set(steps.map((s) => s.chain))];
  return {
    steps, chains, label: rows.find((r) => r.label)?.label ?? null,
    provenance: {
      title: 'Migration trail — smart-money trades across chains',
      formula: 'every smart-money DEX trade by this wallet the scanner recorded, oldest first\nbuy = stable/native in, risk token out; sell = the reverse',
      inputs: [{ label: 'Trades', value: String(rows.length) }, { label: 'Chains', value: chains.map(chainName).join(' → ') || '—' }],
      calls: [{ endpoint: 'smart-money/dex-trades', body: '{"chains":["all"], …} (scanner, every scan)', credits: 5, ref: 'Peregrine scanner history, not a call at view time' }],
      notes: ['Only trades by Nansen smart-money wallets are recorded, and only since the scanner started.'],
    },
  };
}

// ------------------------------------------------------------- holdings trend

export interface HoldingsTrend {
  chain: string;
  symbols: string[];
  /** One point per day, oldest first: Σ value of the tracked tokens. */
  days: Array<{ day: string; valueUsd: number; bySymbol: Record<string, number> }>;
  provenance: Provenance;
}

/**
 * How the value of today's largest holdings on the main chain moved over
 * 30 days (profiler/address/historical-balances, filtered to those tokens:
 * one call). Tracks the current top five, so a token sold off before today
 * is not in it — the title says so.
 */
export async function holdingsTrend(subject: Subject, top: Balances['top']): Promise<Wave<HoldingsTrend>> {
  const chain = top[0]?.chain;
  // historical-balances takes the same chain enum as current-balance.
  if (!chain || !endpointSupports('profilerCurrentBalance', chain)) {
    return { unavailable: chain ? `Nansen does not serve historical balances on ${chainName(chain)}.` : 'No current balances to track.' };
  }
  const tokens = top.filter((t) => t.chain === chain).slice(0, 5);
  const body = {
    ...subjectBody(subject), chain, date: { from: requestDay(30), to: requestDay(-1) },
    filters: { token_address: tokens.map((t) => t.tokenAddress), hide_spam_tokens: true },
    pagination: { page: 1, per_page: 1000 }, order_by: [{ field: 'block_timestamp', direction: 'ASC' }],
  };
  try {
    const r = await traced<ProfilerAddressHistoricalBalancesResponse>('profiler/address/historical-balances', body, 1);
    const byDay = new Map<string, { valueUsd: number; bySymbol: Record<string, number> }>();
    for (const x of r.data.data) {
      if (x.value_usd == null || !Number.isFinite(x.value_usd)) continue;
      const day = x.block_timestamp.slice(0, 10);
      const d = byDay.get(day) ?? { valueUsd: 0, bySymbol: {} };
      d.valueUsd += x.value_usd;
      d.bySymbol[x.token_symbol] = (d.bySymbol[x.token_symbol] ?? 0) + x.value_usd;
      byDay.set(day, d);
    }
    const days = [...byDay.entries()].map(([day, v]) => ({ day, ...v })).sort((a, b) => a.day.localeCompare(b.day));
    if (days.length < 2) return { unavailable: `Nansen has fewer than two days of balance history for these tokens on ${chainName(chain)}.` };
    const first = days[0].valueUsd, last = days.at(-1)!.valueUsd;
    return {
      chain, symbols: tokens.map((t) => t.symbol), days,
      provenance: {
        title: `Today's top ${tokens.length} holdings on ${chainName(chain)}, 30 days`,
        formula: 'per day: Σ value_usd of the tracked tokens (Nansen’s end-of-day balances × price)',
        inputs: [
          { label: 'Tracked', value: tokens.map((t) => t.symbol).join(', ') },
          { label: 'Start → end', value: `${usd(first)} → ${usd(last)}` },
          { label: 'Change', value: first > 0 ? pct(last / first - 1) : '—' },
        ],
        calls: [r.call],
        notes: [
          'Tracks the tokens held today; positions closed during the window are not in this line.',
          ...(r.data.pagination?.is_last_page === false ? ['Nansen returned more than 1,000 rows; the latest days may be incomplete.'] : []),
        ],
      },
    };
  } catch (e) {
    return { unavailable: errText(e) };
  }
}
