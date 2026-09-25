import { getDb, getKv, setKv } from '@/server/nansen/db';
import { callNansen } from '@/server/nansen/client';
import { contextScope } from '@/server/context';
import { contractSupports } from '@/server/nansen/support';
import { ALL_CHAIN_IDS } from '@/lib/registry';
import { evmChain, inferRotations, type FundingLink, type WalletRef } from '@/lib/models/inferred-rotations';
import type { Trade } from '@/lib/models/rotation-fronts';
import type { PressureView } from './queries';
import type { FrontWithProvenance } from './bulletin';
import { frontConfidence } from '@/lib/models/rotation-fronts';

const KEY = 'weather:funding-evidence:v1';
export const INFERENCE_CAP = 12;
const TTL = 24 * 3_600_000;
interface Snapshot {
  at: number;
  checked: number;
  calls: number;
  credits: number;
  failures: number;
  links: FundingLink[];
}
type Row = Record<string, unknown>;
const rows = (raw: unknown): Row[] =>
  raw && typeof raw === 'object' && 'data' in raw && Array.isArray(raw.data)
    ? raw.data.filter((r): r is Row => !!r && typeof r === 'object')
    : [];
const service = (s: unknown) =>
  typeof s === 'string' &&
  /exchange|binance|coinbase|kraken|okx|bybit|bridge|router|pool|vault|contract|deployer|\u{1F3E6}|\u{1F916}/iu.test(s);

/** Only direct first-funding evidence; deployment and shared-funder similarity
 * are deliberately not treated as cross-chain identity evidence. */
export function fundingLinks(
  subject: WalletRef,
  endpoint: FundingLink['endpoint'],
  request: Record<string, unknown>,
  raw: unknown,
  now: number,
): FundingLink[] {
  return rows(raw).flatMap((r) => {
    if (endpoint.endsWith('related-wallets') && r.relation !== 'First Funder') return [];
    const address = endpoint.endsWith('first-funder') ? r.first_funder_address : r.address;
    if (
      endpoint.endsWith('first-funder') &&
      (typeof r.wallet_address !== 'string' || r.wallet_address.toLowerCase() !== subject.address.toLowerCase())
    )
      return [];
    const chain = r.chain === 'bsc' ? 'bnb' : r.chain;
    const label = r.first_funder_name ?? r.address_label;
    const at = typeof r.block_timestamp === 'string' ? Date.parse(r.block_timestamp) : NaN;
    if (
      typeof address !== 'string' ||
      !address ||
      address.length > 120 ||
      typeof chain !== 'string' ||
      !ALL_CHAIN_IDS.includes(chain) ||
      !Number.isFinite(at) ||
      at > now ||
      typeof r.transaction_hash !== 'string' ||
      !r.transaction_hash ||
      service(label)
    )
      return [];
    return [
      {
        child: { address: subject.address, chain: subject.chain },
        funder: { address, chain },
        at,
        transactionHash: r.transaction_hash,
        endpoint,
        request,
      },
    ];
  });
}

function recentTrades(now: number): Trade[] {
  return getDb()
    .prepare(
      'SELECT wallet, chain, side, usd_value AS usdValue, traded_at AS timestamp FROM smart_money_trades WHERE traded_at >= ? AND traded_at <= ? ORDER BY traded_at, id',
    )
    .all(now - 36 * 3_600_000, now) as Trade[];
}

export function inferredWeather(view: PressureView, now = Date.now()) {
  if (view !== 'private') return null; // Do not even read owner evidence in a public/member view.
  const stored = getKv(KEY);
  let snapshot: Snapshot | null = null;
  try {
    snapshot = stored ? (JSON.parse(stored.value) as Snapshot) : null;
  } catch {
    /* corrupt cache degrades to unavailable */
  }
  const fresh = snapshot && snapshot.at <= now && now - snapshot.at <= TTL;
  return {
    at: snapshot?.at ?? null,
    stale: !!snapshot && !fresh,
    checked: snapshot?.checked ?? 0,
    failures: snapshot?.failures ?? 0,
    links: fresh ? snapshot!.links.length : 0,
    fronts: (fresh ? inferRotations(recentTrades(now), snapshot!.links, now) : []).map(
      (f): FrontWithProvenance => ({
        from: f.from,
        to: f.to,
        netUsd: f.netUsd,
        grossForward: f.grossForward,
        grossBack: f.grossBack,
        walletCount: f.groups,
        confidence: frontConfidence(f.groups),
        inferred: true,
        wallets: [],
        evidence: f.matches,
        provenance: {
          title: `Inferred candidate ${f.from} → ${f.to}`,
          formula:
            'Direct first-funding link + sell followed by buy on a different chain within 12h. Each trade matched at most once. Notional = min(sold, bought); reverse candidates subtracted. At least two disjoint relationship groups in the net direction.',
          inputs: [
            { label: 'Independent evidence groups', value: String(f.groups) },
            { label: 'Net candidate notional (USD)', value: String(f.netUsd) },
          ],
          calls: f.matches.map((m) => ({
            endpoint: m.evidence.endpoint,
            body: m.evidence.request,
            credits: 1,
            ref: `funding transaction ${m.evidence.transactionHash}`,
          })),
          notes: [
            'Inferred, not observed ownership or a bridge transfer. Funding does not establish common control.',
            'Page-one relationships for up to six recent high-volume wallets; incomplete coverage.',
            'Wallets with observed same-address rotations are excluded. Connected relationships count as one group, not multiple independent wallets.',
          ],
        },
      }),
    ),
    maxCredits: INFERENCE_CAP,
  };
}

/** Explicit owner action, never a page-load/worker job. Six seed wallets and
 * at most two one-credit calls per seed; reserve an hour before awaiting IO. */
export async function refreshInferredWeather(now = Date.now()) {
  if (contextScope.getStore()?.mode !== 'owner') throw new Error('Only the instance owner can inspect scanner-derived relationships.');
  getDb()
    .transaction(() => {
      const last = getKv(`${KEY}:attempt`);
      if (last && now - last.updatedAt < 3_600_000) throw new Error('Relationship checks run at most once per hour for this instance.');
      setKv(`${KEY}:attempt`, String(now));
    })
    .immediate();
  const candidates = getDb()
    .prepare(
      'SELECT wallet AS address, chain, MAX(wallet_label) AS label, SUM(usd_value) AS volume FROM smart_money_trades WHERE traded_at >= ? AND traded_at <= ? GROUP BY wallet, chain ORDER BY volume DESC LIMIT 100',
    )
    .all(now - TTL, now) as Array<WalletRef & { label: string | null }>;
  const seeds = candidates
    .filter((c) => !service(c.label) && contractSupports('POST /api/v1/profiler/address/related-wallets', c.chain))
    .slice(0, 6);
  const snapshot: Snapshot = { at: now, checked: seeds.length, calls: 0, credits: 0, failures: 0, links: [] };
  for (const seed of seeds) {
    const requests: Array<{ endpoint: FundingLink['endpoint']; body: Record<string, unknown> }> = [
      {
        endpoint: 'profiler/address/related-wallets',
        body: { address: seed.address, chain: seed.chain, pagination: { page: 1, per_page: 100 } },
      },
    ];
    if (evmChain(seed.chain)) requests.push({ endpoint: 'profiler/address/first-funder', body: { address: seed.address, chain: 'all' } });
    for (const { endpoint, body } of requests) {
      if (snapshot.calls >= INFERENCE_CAP || snapshot.credits >= INFERENCE_CAP) break;
      snapshot.calls++;
      try {
        const result = await callNansen<unknown>(endpoint, body, { record: false });
        snapshot.credits += result.meta.cacheHit ? 0 : result.meta.creditsCost;
        snapshot.links.push(...fundingLinks(seed, endpoint, body, result.data, now));
      } catch {
        snapshot.failures++;
      }
    }
  }
  setKv(KEY, JSON.stringify(snapshot));
  return { ...inferredWeather('private', now), calls: snapshot.calls, credits: snapshot.credits };
}
