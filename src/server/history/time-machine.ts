// Time Machine: Smart Money token holdings THEN vs NOW from Nansen's
// point-in-time endpoint (v1beta1 smart-money/historical-token-balances,
// 25 credits a call, end-of-day UTC snapshots; today is not available).
import { traced } from '@/server/nansen/traced';
import { callScope, type CallTally } from '@/server/nansen/client';

export const TM_ENDPOINT = 'v1beta1/smart-money/historical-token-balances';
type Row = { chain: string; token_address: string; token_symbol: string | null; value_usd: number | null; holders_count: number | null; share_of_holdings_percent: number | null; token_sectors?: string[] | null };

export interface TmRow { /** In only one snapshot's top 200: the other value is unknown, not zero. */ edge: 'entered-top' | 'left-top' | null; chain: string; token: string; symbol: string | null; thenUsd: number; nowUsd: number; deltaUsd: number; deltaPct: number | null; thenHolders: number | null; nowHolders: number | null; sectors: string[] }
export interface TmResult { then: string; now: string; totalThen: number; totalNow: number; rows: TmRow[]; tally: CallTally; note: string | null }

async function at(date: string): Promise<Row[]> {
  const r = await traced<{ data: Row[] }>(TM_ENDPOINT, { as_of_date: date, chains: [], pagination: { page: 1, per_page: 200 } }, 25);
  return r.data.data ?? [];
}

export const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/** Compare two end-of-day snapshots by (chain, token). */
export function compareHoldings(a: Row[], b: Row[]): TmRow[] {
  const key = (r: Row) => `${r.chain}:${r.token_address.toLowerCase()}`;
  const A = new Map(a.map((r) => [key(r), r])), B = new Map(b.map((r) => [key(r), r]));
  return [...new Set([...A.keys(), ...B.keys()])].map((k) => {
    const x = A.get(k), y = B.get(k), r = (y ?? x)!;
    const thenUsd = x?.value_usd ?? 0, nowUsd = y?.value_usd ?? 0;
    return { edge: !x ? 'entered-top' as const : !y ? 'left-top' as const : null, chain: r.chain, token: r.token_address, symbol: r.token_symbol, thenUsd, nowUsd, deltaUsd: nowUsd - thenUsd, deltaPct: thenUsd ? nowUsd / thenUsd - 1 : null, thenHolders: x?.holders_count ?? null, nowHolders: y?.holders_count ?? null, sectors: r.token_sectors ?? [] };
  }).sort((p, q) => Number(!!p.edge) - Number(!!q.edge) || Math.abs(q.deltaUsd) - Math.abs(p.deltaUsd));
}

export async function timeMachine(then: string, now: string): Promise<TmResult> {
  const tally: CallTally = { calls: 0, credits: 0, cached: 0 };
  return callScope.run(tally, async () => {
    const [a, b] = await Promise.all([at(then), at(now)]);
    const note = !b.length ? `Nansen has no snapshot for ${now} yet (daily snapshots settle the next morning UTC).` : !a.length ? `Nansen returned no snapshot for ${then}.` : null;
    return { then, now, totalThen: a.reduce((s, r) => s + (r.value_usd ?? 0), 0), totalNow: b.reduce((s, r) => s + (r.value_usd ?? 0), 0), rows: compareHoldings(a, b).slice(0, 60), tally, note };
  });
}
