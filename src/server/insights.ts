// Derived insights and chart data for the main pages (Chain flows, Perps,
// Sectors, Predictions), from the scanner's stored Nansen reads. Each insight
// names its numbers and links to the records behind it.
import { getDb } from '@/server/nansen/db';
import type { DisplayMode } from '@/server/mode';
import { viewOf } from '@/server/mode';
import { marketPulse, type PulseItem } from '@/server/pulse';
import { perpBoard } from '@/server/perps/board';
import { sectorWeather } from '@/server/sectors/weather';
import { weatherMap } from '@/server/weather/queries';
import { capitalFlows } from '@/server/weather/bulletin';
import { predictBoard } from '@/server/predict/board';
import { predictOverview } from '@/server/predict/overview';
import { chainName, pct, usd } from '@/lib/viz/format';

export type InsightKey = 'pulse' | 'perps' | 'sectors' | 'predict' | 'flows';
export const BRIEF_SUBJECT: Record<InsightKey, string> = {
  pulse: 'the crypto market', perps: 'Hyperliquid perpetuals', sectors: 'sector rotation', predict: 'Polymarket prediction markets', flows: 'cross-chain capital flows',
};

const D = 86_400_000;
const signedPct = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(Math.abs(v) < 0.1 ? 1 : 0)}%`;

// ------------------------------------------------------------------ perps

export interface RankRow { label: string; value: number; href: string; sub?: string }
export interface PerpsAnalytics {
  insights: PulseItem[];
  oiMovers: RankRow[];
  priceMovers: RankRow[];
  funding: RankRow[];
  oiHistory: Array<[number, number]>;
  smBook: Array<{ symbol: string; long: number; short: number }>;
}

export function perpsAnalytics(mode: DisplayMode, now = Date.now()): PerpsAnalytics {
  const db = getDb();
  const board = perpBoard(viewOf(mode), now);
  const coins = board.coins.filter((c) => (c.openInterest ?? 0) >= 5e6);
  const lastT = (db.prepare("SELECT MAX(snapshot_at) AS t FROM perp_snapshots WHERE source = 'all' AND snapshot_at <= ?").get(now) as { t: number | null }).t;
  const prevT = lastT ? (db.prepare("SELECT MAX(snapshot_at) AS t FROM perp_snapshots WHERE source = 'all' AND snapshot_at <= ?").get(lastT - D) as { t: number | null }).t : null;
  const prevOi = prevT ? new Map((db.prepare("SELECT symbol, open_interest AS oi FROM perp_snapshots WHERE source = 'all' AND snapshot_at = ?").all(prevT) as Array<{ symbol: string; oi: number | null }>).map((r) => [r.symbol, r.oi ?? 0])) : new Map<string, number>();
  const oiCh = coins.filter((c) => prevOi.get(c.symbol)).map((c) => ({ c, ch: (c.openInterest ?? 0) / prevOi.get(c.symbol)! - 1 }));
  const href = (s: string) => `/perps/${encodeURIComponent(s)}`;
  const oiMovers = [...oiCh].sort((a, b) => Math.abs(b.ch) - Math.abs(a.ch)).slice(0, 14).map(({ c, ch }) => ({ label: c.symbol, value: ch * 100, href: href(c.symbol), sub: usd(c.openInterest) }));
  const priceMovers = coins.filter((c) => c.change24h != null).sort((a, b) => Math.abs(b.change24h!) - Math.abs(a.change24h!)).slice(0, 14).map((c) => ({ label: c.symbol, value: c.change24h! * 100, href: href(c.symbol), sub: usd(c.openInterest) }));
  const funding = coins.filter((c) => c.fundingApr != null && (c.openInterest ?? 0) >= 20e6).sort((a, b) => Math.abs(b.fundingApr!) - Math.abs(a.fundingApr!)).slice(0, 14).map((c) => ({ label: c.symbol, value: c.fundingApr! * 100, href: href(c.symbol), sub: usd(c.openInterest) }));
  const oiHistory = (db.prepare("SELECT snapshot_at AS t, SUM(open_interest) AS oi FROM perp_snapshots WHERE source = 'all' AND snapshot_at >= ? GROUP BY snapshot_at ORDER BY snapshot_at").all(now - 7 * D) as Array<{ t: number; oi: number }>).map((r) => [r.t, r.oi] as [number, number]);
  const smBook = mode === 'owner' ? board.coins.filter((c) => c.sm && c.sm.longsUsd + c.sm.shortsUsd > 0).sort((a, b) => (b.sm!.longsUsd + b.sm!.shortsUsd) - (a.sm!.longsUsd + a.sm!.shortsUsd)).slice(0, 12).map((c) => ({ symbol: c.symbol, long: c.sm!.longsUsd, short: c.sm!.shortsUsd })) : [];

  const insights: PulseItem[] = [];
  const total = coins.reduce((a, c) => a + (c.openInterest ?? 0), 0), prevTotal = [...prevOi.values()].reduce((a, v) => a + v, 0);
  if (total) insights.push({ id: 'p-oi', kind: 'Open interest', tone: prevTotal && total < prevTotal ? 'down' : 'up', href: '/perps', text: `Hyperliquid open interest ${usd(board.venue?.openInterest ?? total)}${prevTotal ? `, ${signedPct(total / prevTotal - 1)} in 24h` : ''}`, detail: `${coins.length} coins over $5M OI · Perp Flow Index ${board.venue?.ppi != null ? Math.round(board.venue.ppi) : 'n/a'}`, spark: oiHistory.length > 2 ? { type: 'line', values: oiHistory.map((x) => x[1]) } : undefined });
  const up = [...oiCh].sort((a, b) => b.ch - a.ch)[0], dn = [...oiCh].sort((a, b) => a.ch - b.ch)[0];
  if (up && up.ch > 0) insights.push({ id: 'p-oiup', kind: 'Leverage building', tone: 'alert', href: href(up.c.symbol), text: `${up.c.symbol} open interest ${signedPct(up.ch)} in 24h to ${usd(up.c.openInterest)}`, detail: `Price ${up.c.change24h != null ? signedPct(up.c.change24h) : 'n/a'} · funding ${up.c.fundingApr != null ? pct(up.c.fundingApr, 0) : 'n/a'} a year` });
  if (dn && dn.ch < 0) insights.push({ id: 'p-oidn', kind: 'Deleveraging', tone: 'down', href: href(dn.c.symbol), text: `${dn.c.symbol} open interest ${signedPct(dn.ch)} in 24h`, detail: `Now ${usd(dn.c.openInterest)} · price ${dn.c.change24h != null ? signedPct(dn.c.change24h) : 'n/a'}` });
  const hi = funding[0];
  if (hi) insights.push({ id: 'p-fund', kind: 'Funding extreme', tone: hi.value > 0 ? 'up' : 'down', href: hi.href, text: `${hi.label} pays ${hi.value.toFixed(0)}% a year in funding: ${hi.value > 0 ? 'longs pay shorts' : 'shorts pay longs'}`, detail: `OI ${hi.sub} · ${coins.filter((c) => (c.fundingApr ?? 0) < 0).length} coins with negative funding` });
  const lead = [...coins].filter((c) => c.ppi != null).sort((a, b) => Math.abs(b.ppi! - 50) - Math.abs(a.ppi! - 50))[0];
  if (lead) insights.push({ id: 'p-side', kind: 'Most one-sided', tone: lead.ppi! >= 50 ? 'up' : 'down', href: href(lead.symbol), text: `${lead.symbol} is the most one-sided market: Perp Flow Index ${Math.round(lead.ppi!)} (${lead.ppi! >= 50 ? 'long' : 'short'} bias)`, detail: `OI ${usd(lead.openInterest)} · taker flow ${lead.taker != null ? signedPct(lead.taker) : 'n/a'}` });
  const div = coins.filter((c) => c.divergence);
  if (div.length) insights.push({ id: 'p-div', kind: 'Crowd vs Smart Money', tone: 'alert', href: href(div[0].symbol), text: `${div.length} coins where funding and Smart Money lean opposite ways: ${div.slice(0, 4).map((c) => c.symbol).join(', ')}`, detail: `${div.filter((c) => c.divergence === 'crowded-long').length} crowded long, ${div.filter((c) => c.divergence === 'crowded-short').length} crowded short` });
  if (smBook.length) {
    const L = smBook.reduce((a, x) => a + x.long, 0), S = smBook.reduce((a, x) => a + x.short, 0);
    insights.push({ id: 'p-sm', kind: 'Smart Money book', tone: L >= S ? 'up' : 'down', href: '/perps/BTC', text: `Smart Money holds ${usd(L)} long against ${usd(S)} short across its top ${smBook.length} coins`, detail: `${pct(L / (L + S), 0)} long · largest book ${smBook[0].symbol}` });
  }
  const pm = priceMovers[0];
  if (pm) insights.push({ id: 'p-px', kind: 'Price mover', tone: pm.value >= 0 ? 'up' : 'down', href: pm.href, text: `${pm.label} ${pm.value >= 0 ? '+' : '−'}${Math.abs(pm.value).toFixed(1)}% in 24h, the largest move over $5M OI`, detail: `OI ${pm.sub}` });
  return { insights, oiMovers, priceMovers, funding, oiHistory, smBook };
}

// ---------------------------------------------------------------- sectors

export interface SectorsAnalytics {
  insights: PulseItem[];
  ranking: RankRow[];
  change: RankRow[];
  history: Array<{ name: string; points: Array<[number, number]> }>;
  tokens: Array<{ symbol: string; chain: string; address: string; net: number; sector: string }>;
}

export function sectorsAnalytics(mode: DisplayMode, now = Date.now()): SectorsAnalytics {
  const w = sectorWeather(viewOf(mode), now);
  const source = mode === 'owner' ? 'smart-money' : 'market-flow';
  const db = getDb();
  const href = (s: string) => `/sectors/${encodeURIComponent(s)}`;
  const withFlow = w.sectors.filter((s) => s.netFlow24hUsd != null && Math.abs(s.netFlow24hUsd) >= 1);
  const ranking = [...withFlow].sort((a, b) => b.netFlow24hUsd! - a.netFlow24hUsd!).map((s) => ({ label: s.sector, value: s.netFlow24hUsd!, href: href(s.sector), sub: `${s.tokens ?? 0} tokens · index ${Math.round(s.pressure)}` }));
  // Net flow now against the reading a day earlier.
  const at = (t: number) => new Map((db.prepare(`SELECT s.sector AS k, s.net_flow_usd AS v FROM sector_snapshots s JOIN (SELECT sector, MAX(snapshot_at) x FROM sector_snapshots WHERE window='24h' AND source=? AND snapshot_at <= ? GROUP BY sector) m
    ON m.sector = s.sector AND m.x = s.snapshot_at WHERE s.window='24h' AND s.source=?`).all(source, t, source) as Array<{ k: string; v: number }>).map((r) => [r.k, r.v]));
  const nowMap = at(now), then = at(now - D);
  const change = [...nowMap].filter(([k]) => then.has(k)).map(([k, v]) => ({ label: k, value: v - then.get(k)!, href: href(k), sub: `${usd(then.get(k), { signed: true })} → ${usd(v, { signed: true })}` })).sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 12);
  const lead = [...withFlow].sort((a, b) => Math.abs(b.netFlow24hUsd!) - Math.abs(a.netFlow24hUsd!)).slice(0, 6).map((s) => s.sector);
  const hist = db.prepare(`SELECT sector, snapshot_at AS t, net_flow_usd AS v FROM sector_snapshots WHERE window='24h' AND source=? AND snapshot_at >= ? AND sector IN (${lead.map(() => '?').join(',') || "''"}) ORDER BY snapshot_at`).all(source, now - 7 * D, ...lead) as Array<{ sector: string; t: number; v: number }>;
  const history = lead.map((name) => ({ name, points: hist.filter((r) => r.sector === name).map((r) => [r.t, r.v] as [number, number]) })).filter((h) => h.points.length > 2);
  const seen = new Set<string>();
  const tokens = w.sectors.flatMap((s) => [...s.top.inflows, ...s.top.outflows].map((t) => ({ symbol: t.symbol ?? t.address.slice(0, 6), chain: t.chain, address: t.address, net: t.netFlowUsd, sector: s.sector })))
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net)).filter((t) => { const k = `${t.chain}:${t.address}`; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 16);

  const insights: PulseItem[] = [];
  const top = ranking[0], bottom = ranking.at(-1);
  if (top && bottom && top !== bottom) insights.push({ id: 's-lead', kind: 'Leadership', tone: 'up', href: top.href, text: `${top.label} leads at ${usd(top.value, { signed: true })}; ${bottom.label} trails at ${usd(bottom.value, { signed: true })}`, detail: `${ranking.filter((r) => r.value > 0).length} of ${ranking.length} sectors net positive in 24h`, spark: { type: 'bars', values: ranking.map((r) => r.value) } });
  const rot = change[0];
  if (rot) insights.push({ id: 's-rot', kind: 'Biggest swing', tone: rot.value >= 0 ? 'up' : 'down', href: rot.href, text: `${rot.label} flow swung ${usd(rot.value, { signed: true })} against a day ago`, detail: rot.sub ?? '' });
  const acc = w.sectors.filter((s) => s.pressure >= 65), dist = w.sectors.filter((s) => s.pressure <= 35);
  if (w.sectors.length) insights.push({ id: 's-breadth', kind: 'Breadth', tone: acc.length >= dist.length ? 'up' : 'down', href: '/sectors', text: `${acc.length} sectors accumulating and ${dist.length} distributing against their own week`, detail: acc.length ? `Strongest: ${[...acc].sort((a, b) => b.pressure - a.pressure).slice(0, 3).map((s) => `${s.sector} ${Math.round(s.pressure)}`).join(', ')}` : 'None above 65' });
  const tok = tokens[0];
  if (tok) {
    const sec = w.sectors.find((s) => s.sector === tok.sector);
    const share = sec?.netFlow24hUsd ? Math.abs(tok.net / sec.netFlow24hUsd) : null;
    insights.push({ id: 's-tok', kind: 'Driver', tone: tok.net >= 0 ? 'up' : 'down', href: `/token/${tok.chain}/${encodeURIComponent(tok.address)}`, text: `${tok.symbol} is the largest single flow at ${usd(tok.net, { signed: true })} (${tok.sector})`, detail: share != null ? `${share > 1 ? 'More than' : pct(share, 0) + ' of'} its sector's net · ${chainName(tok.chain)}` : chainName(tok.chain) });
  }
  const vol = [...w.sectors].filter((s) => s.volume24hUsd).sort((a, b) => b.volume24hUsd! - a.volume24hUsd!)[0];
  if (vol) insights.push({ id: 's-vol', kind: 'Most traded', tone: 'flat', href: href(vol.sector), text: `${vol.sector} traded ${usd(vol.volume24hUsd)} in 24h`, detail: `Net ${usd(vol.netFlow24hUsd, { signed: true })} · ${vol.volume24hUsd ? pct(Math.abs((vol.netFlow24hUsd ?? 0) / vol.volume24hUsd), 1) : 'n/a'} of volume one-way` });
  return { insights, ranking, change, history, tokens };
}

// ------------------------------------------------------------ chain flows

export interface FlowsAnalytics { insights: PulseItem[]; net: RankRow[]; index: RankRow[] }

export function flowsAnalytics(mode: DisplayMode, now = Date.now()): FlowsAnalytics {
  const map = weatherMap(now, viewOf(mode));
  const href = (c: string) => `/chain/${c}`;
  const w24 = (c: (typeof map)[number]) => c.windows.find((x) => x.window === '24h');
  const net = map.filter((c) => w24(c) && Math.abs(w24(c)!.netFlowUsd) >= 1).map((c) => ({ label: chainName(c.chain), value: w24(c)!.netFlowUsd, href: href(c.chain), sub: `${w24(c)!.tokenCount} tokens · ${usd(w24(c)!.volumeUsd)} volume` })).sort((a, b) => b.value - a.value);
  const index = map.filter((c) => c.cpi != null && c.trend6h != null).map((c) => ({ label: chainName(c.chain), value: c.trend6h!, href: href(c.chain), sub: `Flow Index ${Math.round(c.cpi!)}` })).sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 12);
  const insights: PulseItem[] = [];
  const inn = net[0], out = net.at(-1);
  if (inn && out && inn !== out) insights.push({ id: 'f-net', kind: 'Net flow', tone: 'flat', href: inn.href, text: `${inn.label} took the most net flow (${usd(inn.value, { signed: true })}); ${out.label} lost the most (${usd(out.value, { signed: true })})`, detail: `${net.filter((x) => x.value > 0).length} of ${net.length} chains net positive in 24h`, spark: { type: 'bars', values: net.map((x) => x.value) } });
  const fast = index[0];
  if (fast) insights.push({ id: 'f-fast', kind: 'Fastest change', tone: fast.value >= 0 ? 'up' : 'down', href: fast.href, text: `${fast.label}'s Flow Index moved ${fast.value >= 0 ? '+' : '−'}${Math.abs(Math.round(fast.value))} in 6 hours`, detail: fast.sub ?? '' });
  const acc = map.filter((c) => (c.cpi ?? 50) >= 65).length, dist = map.filter((c) => (c.cpi ?? 50) <= 35).length;
  insights.push({ id: 'f-breadth', kind: 'Breadth', tone: acc >= dist ? 'up' : 'down', href: '/', text: `${acc} chains accumulating, ${dist} distributing`, detail: `${map.filter((c) => c.cpi != null).length} chains measured against their own history` });
  const fronts = capitalFlows(viewOf(mode), 24, now)?.fronts ?? [];
  const f = [...fronts].sort((a, b) => b.netUsd - a.netUsd)[0];
  if (f) insights.push({ id: 'f-rot', kind: 'Rotation', tone: 'up', href: '/flows', text: `Largest wallet rotation: ${chainName(f.from)} to ${chainName(f.to)}, ${usd(f.netUsd)} by ${f.walletCount} wallets`, detail: `${fronts.length} rotations between chains in 24h` });
  return { insights, net, index };
}

// ------------------------------------------------------------------ keyed

export async function insightsFor(key: InsightKey, mode: DisplayMode): Promise<PulseItem[]> {
  if (key === 'pulse') return marketPulse(mode);
  if (key === 'perps') return perpsAnalytics(mode).insights;
  if (key === 'sectors') return sectorsAnalytics(mode).insights;
  if (key === 'flows') return flowsAnalytics(mode).insights;
  return (await predictOverview(await predictBoard())).insights;
}
