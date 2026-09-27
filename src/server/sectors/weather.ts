// Sector weather: a pressure reading per Nansen sector, built exactly like
// the Chain Pressure Index (src/lib/models/cpi.ts): r = net flow ÷ volume
// per window, robust-z against the sector's own last 7 days once it has
// enough snapshots (against the other sectors right now until then),
// squashed to 0–100 and blended 1h/24h/7d. Public views read all-trader
// (market-flow) sector flows; the owner's view reads smart-money flows.
import { getDb } from '@/server/nansen/db';
import { chainPressureWindow, blendChainPressure, pressureBand, type Window, type CpiWindowResult, type PressureBand } from '@/lib/models/cpi';
import { aggregateSectors, type ScreenerLikeRow, type SectorMover } from '@/lib/models/sector-flows';
import { loadMembership, tokenKey, membershipAge, membershipChains } from './membership';
import type { PressureView } from '@/server/weather/queries';
import type { Provenance } from '@/lib/provenance';
import { num, pct, usd } from '@/lib/viz/format';
import { clearLiveMemo, liveMemo } from '@/server/live-memo';

type Source = 'market-flow' | 'smart-money';
const WINDOWS: Window[] = ['1h', '24h', '7d'];
/** Own-history snapshots a sector needs before it is scored against itself. */
export const MIN_HISTORY = 12;
const HISTORY_MS = 7 * 86_400_000;

/** Called by the scanner once per window with the rows it already has. */
export function storeSectorSnapshots(snapshotAt: number, window: Window, marketRows: ScreenerLikeRow[], smRows: ScreenerLikeRow[] | null): number {
  const membership = loadMembership();
  if (!membership.size) return 0;
  const db = getDb();
  const ins = db.prepare('INSERT INTO sector_snapshots (snapshot_at, window, source, sector, net_flow_usd, volume_usd, tokens, top) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  let n = 0;
  db.transaction(() => {
    for (const [source, flowRows] of [['market-flow', marketRows], ['smart-money', smRows]] as const) {
      if (!flowRows) continue;
      const agg = aggregateSectors(flowRows, marketRows, membership, tokenKey);
      for (const s of agg.sectors) {
        if (s.volumeUsd <= 0) continue;
        ins.run(snapshotAt, window, source, s.sector, s.netFlowUsd, s.volumeUsd, s.tokens, JSON.stringify(s.top));
        n++;
      }
    }
  })();
  clearLiveMemo('sectors:');
  return n;
}

export interface SectorReading {
  sector: string;
  pressure: number;
  band: PressureBand;
  netFlow24hUsd: number | null;
  volume24hUsd: number | null;
  tokens: number | null;
  byWindow: Partial<Record<Window, CpiWindowResult>>;
  crossSectional: boolean;
  historyPoints: number;
  /** 24h-window ratio over the last 7 days, oldest first. */
  spark: Array<{ t: number; ratio: number }>;
  top: { inflows: SectorMover[]; outflows: SectorMover[] };
}

export interface SectorWeather {
  source: Source;
  at: number | null;
  sectors: SectorReading[];
  membership: { ageMs: number | null; tokens: number; chains: string[] };
  provenance: Provenance | null;
  unavailable: string | null;
}

interface SnapRow { snapshot_at: number; window: Window; sector: string; net_flow_usd: number; volume_usd: number; tokens: number; top: string | null }

/** Live reads are memoized for 30s (see live-memo). */
export function sectorWeather(view: PressureView, now = Date.now()): SectorWeather {
  return liveMemo(`sectors:${view}`, now, 30_000, () => computeSectorWeather(view, now));
}

function computeSectorWeather(view: PressureView, now: number): SectorWeather {
  const source: Source = view === 'private' ? 'smart-money' : 'market-flow';
  const db = getDb();
  const members = (db.prepare('SELECT COUNT(DISTINCT chain || token_address) AS n FROM sector_members').get() as { n: number }).n;
  const membership = { ageMs: membershipAge(now), tokens: members, chains: membershipChains() };
  const rows = db.prepare(`
    SELECT snapshot_at, window, sector, net_flow_usd, volume_usd, tokens, top FROM sector_snapshots
    WHERE source = ? AND snapshot_at >= ? ORDER BY snapshot_at
  `).all(source, now - HISTORY_MS - 3_600_000) as SnapRow[];
  if (!rows.length) {
    return {
      source, at: null, sectors: [], membership, provenance: null,
      unavailable: members
        ? 'No sector snapshots yet: the scanner writes them on its next run.'
        : 'Sector membership has not been built yet: the worker refreshes it once a day (one screener call per sector).',
    };
  }

  // Latest snapshot per window; its rows are "now", earlier ones history.
  const latestAt = new Map<Window, number>();
  for (const r of rows) latestAt.set(r.window, Math.max(latestAt.get(r.window) ?? 0, r.snapshot_at));
  const current = new Map<string, Map<Window, SnapRow>>();
  const history = new Map<string, Map<Window, number[]>>();
  for (const r of rows) {
    const ratioRow = r.net_flow_usd / Math.max(r.volume_usd, 10_000);
    if (r.snapshot_at === latestAt.get(r.window)) {
      if (!current.has(r.sector)) current.set(r.sector, new Map());
      current.get(r.sector)!.set(r.window, r);
    } else {
      if (!history.has(r.sector)) history.set(r.sector, new Map());
      const h = history.get(r.sector)!;
      h.set(r.window, [...(h.get(r.window) ?? []), ratioRow]);
    }
  }
  // Cross-sectional sample per window: every sector's current ratio.
  const cross = new Map<Window, number[]>(WINDOWS.map((w) => [w, [...current.values()].flatMap((m) => {
    const r = m.get(w);
    return r ? [r.net_flow_usd / Math.max(r.volume_usd, 10_000)] : [];
  })]));

  const sectors: SectorReading[] = [];
  for (const [sector, byW] of current) {
    const results: Partial<Record<Window, CpiWindowResult>> = {};
    let points = 0;
    for (const w of WINDOWS) {
      const r = byW.get(w);
      if (!r) continue;
      const own = history.get(sector)?.get(w) ?? [];
      points = Math.max(points, own.length);
      results[w] = chainPressureWindow({ netFlowUsd: r.net_flow_usd, volumeUsd: r.volume_usd }, w, own.length >= MIN_HISTORY ? own : [], cross.get(w) ?? []);
    }
    if (!Object.keys(results).length) continue;
    const blend = blendChainPressure(results);
    const d = byW.get('24h');
    let top: SectorReading['top'] = { inflows: [], outflows: [] };
    try { if (d?.top) top = JSON.parse(d.top) as SectorReading['top']; } catch { /* keep empty */ }
    sectors.push({
      sector, pressure: blend.cpi, band: pressureBand(blend.cpi),
      netFlow24hUsd: d?.net_flow_usd ?? null, volume24hUsd: d?.volume_usd ?? null, tokens: d?.tokens ?? null,
      byWindow: results, crossSectional: blend.anyCrossSectional, historyPoints: points,
      spark: rows.filter((x) => x.sector === sector && x.window === '24h').map((x) => ({ t: x.snapshot_at, ratio: x.net_flow_usd / Math.max(x.volume_usd, 10_000) })),
      top,
    });
  }
  sectors.sort((a, b) => b.pressure - a.pressure);
  const at = Math.max(...latestAt.values());
  const lead = sectors[0], lag = sectors.at(-1);
  return {
    source, at, sectors, membership, unavailable: null,
    provenance: {
      title: `Sector flow (${source === 'smart-money' ? 'smart money' : 'all traders'})`,
      formula: 'per sector, per window: r = Σ net flow ÷ Σ volume over the sector’s tokens\nz = robust z of r against the sector’s last 7 days (≥ 12 snapshots), else against every sector now\npressure = 50 + 50·tanh(z/2), blended 0.2·1h + 0.5·24h + 0.3·7d',
      inputs: [
        { label: 'Sectors scored', value: String(sectors.length) },
        { label: 'Highest', value: lead ? `${lead.sector} ${num(lead.pressure, 0)}` : 'n/a' },
        { label: 'Lowest', value: lag ? `${lag.sector} ${num(lag.pressure, 0)}` : 'n/a' },
        { label: 'Tokens with a sector', value: `${members.toLocaleString('en-US')} on ${membership.chains.join(', ')}` },
        { label: 'Largest 24h net flow', value: lead?.netFlow24hUsd != null ? `${usd(lead.netFlow24hUsd, { signed: true })} (${pct((lead.netFlow24hUsd ?? 0) / Math.max(lead.volume24hUsd ?? 1, 1), 1)} of volume)` : 'n/a' },
      ],
      calls: [
        { endpoint: 'search/token-sectors', body: {}, ref: 'GET, daily' },
        { endpoint: 'token-screener', body: { filters: { sectors: ['<sector>'] }, chains: membership.chains, timeframe: '24h' }, ref: 'membership, one call per sector, daily' },
        { endpoint: 'token-screener', body: { note: 'the scanner’s own flow rows, sorted into sectors' }, ref: 'every scan, no extra credits' },
      ],
      notes: [
        'A token tagged with several sectors counts fully toward each.',
        'Tokens outside the daily membership (smaller chains, the long tail) are not in any sector.',
        ...(source === 'market-flow' ? ['Public view: all-trader flows. Smart-money sector flows are shown to the API key owner only.'] : []),
      ],
    },
  };
}
