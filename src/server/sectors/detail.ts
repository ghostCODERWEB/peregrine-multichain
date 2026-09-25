// One sector in depth, from tables the scanner already fills: no Nansen
// calls. Latest reading per window, the 24h window's 7-day history, the
// tokens that moved it in each window, and where its members live.
import { getDb } from '@/server/nansen/db';
import type { SectorMover } from '@/lib/models/sector-flows';
import type { PressureView } from '@/server/weather/queries';
import { sectorWeather, type SectorReading } from './weather';

export const SECTOR_WINDOWS = ['1h', '24h', '7d'] as const;
export type SectorWindow = (typeof SECTOR_WINDOWS)[number];

export interface SectorWindowReading {
  window: SectorWindow;
  at: number;
  netFlowUsd: number;
  volumeUsd: number;
  tokens: number;
  inflows: SectorMover[];
  outflows: SectorMover[];
}

export interface SectorDetail {
  reading: SectorReading;
  source: 'smart-money' | 'market-flow';
  windows: SectorWindowReading[];
  /** 24h-window snapshots over the last 7 days, oldest first. */
  history: Array<{ t: number; netFlowUsd: number; volumeUsd: number }>;
  membersByChain: Array<{ chain: string; tokens: number }>;
  rank: number;
  of: number;
}

type SnapRow = { snapshot_at: number; window: string; net_flow_usd: number; volume_usd: number; tokens: number; top: string | null };

function movers(top: string | null): { inflows: SectorMover[]; outflows: SectorMover[] } {
  try {
    const t = JSON.parse(top ?? '{}') as { inflows?: SectorMover[]; outflows?: SectorMover[] };
    return { inflows: t.inflows ?? [], outflows: t.outflows ?? [] };
  } catch {
    return { inflows: [], outflows: [] };
  }
}

export function sectorDetail(name: string, view: PressureView, now = Date.now()): SectorDetail | null {
  const w = sectorWeather(view, now);
  const i = w.sectors.findIndex((s) => s.sector === name);
  if (i < 0) return null;
  const db = getDb();
  const latest = db.prepare(`
    SELECT snapshot_at, window, net_flow_usd, volume_usd, tokens, top FROM sector_snapshots
    WHERE sector = ? AND source = ? AND window = ? ORDER BY snapshot_at DESC LIMIT 1
  `);
  const windows = SECTOR_WINDOWS.flatMap((win) => {
    const r = latest.get(name, w.source, win) as SnapRow | undefined;
    return r ? [{ window: win, at: r.snapshot_at, netFlowUsd: r.net_flow_usd, volumeUsd: r.volume_usd, tokens: r.tokens, ...movers(r.top) }] : [];
  });
  const history = (db.prepare(`
    SELECT snapshot_at, net_flow_usd, volume_usd FROM sector_snapshots
    WHERE sector = ? AND source = ? AND window = '24h' AND snapshot_at >= ? ORDER BY snapshot_at
  `).all(name, w.source, now - 7 * 86_400_000) as Array<{ snapshot_at: number; net_flow_usd: number; volume_usd: number }>)
    .map((r) => ({ t: r.snapshot_at, netFlowUsd: r.net_flow_usd, volumeUsd: r.volume_usd }));
  const membersByChain = (db.prepare('SELECT chain, COUNT(*) AS n FROM sector_members WHERE sector = ? GROUP BY chain ORDER BY n DESC')
    .all(name) as Array<{ chain: string; n: number }>).map((r) => ({ chain: r.chain, tokens: r.n }));
  return { reading: w.sectors[i], source: w.source, windows, history, membersByChain, rank: i + 1, of: w.sectors.length };
}

/** URL segment for a sector name ("DeFi Lending (Money Markets)" → encoded as-is). */
export const sectorHref = (name: string) => `/sectors/${encodeURIComponent(name)}`;
