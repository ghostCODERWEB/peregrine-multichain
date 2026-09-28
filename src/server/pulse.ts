// Market Pulse: short, data-backed statements about the last 24 hours, derived
// from the scanner's stored Nansen reads (no Nansen call per view). Each item
// names its numbers, links to the records behind it and carries a small series.
import { isRiskListable } from '@/lib/models/trade-side';
import { smFlowSeries } from '@/server/graph/series';
import { properAddress } from '@/server/nansen/address-case';
import { getDb } from '@/server/nansen/db';
import type { DisplayMode } from '@/server/mode';
import { chainName, pct, usd } from '@/lib/viz/format';

export interface PulseItem {
  id: string;
  kind: string;
  tone: 'up' | 'down' | 'alert' | 'flat';
  text: string;
  detail: string;
  href: string;
  spark?: { type: 'bars' | 'line'; values: number[]; min?: number; max?: number; baseline?: number };
}

const H = 3_600_000, D = 86_400_000;
const signedPct = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(Math.abs(v) < 0.1 ? 1 : 0)}%`;

export function marketPulse(mode: DisplayMode, now = Date.now()): PulseItem[] {
  const db = getDb();
  const owner = mode === 'owner';
  const out: PulseItem[] = [];

  if (owner) {
    // 1. Smart Money DEX flow, 24h against the prior 24h, hourly.
    const hours = db.prepare(`SELECT (traded_at / ${H}) * ${H} AS h, SUM(CASE WHEN side='buy' THEN usd_value ELSE -usd_value END) AS net, COUNT(DISTINCT wallet) AS w
      FROM smart_money_trades WHERE traded_at >= ? GROUP BY h ORDER BY h`).all(now - 48 * H) as Array<{ h: number; net: number; w: number }>;
    // The hourly series the Overview's Smart Money tile shows, so both count the same hours.
    const cur = smFlowSeries(24, now).map((x) => ({ h: x.t, net: x.net, w: x.wallets })), prev = hours.filter((x) => x.h < now - 24 * H);
    // Exact 24h windows (the same query the Overview module, nav and ticker use), not whole-hour buckets.
    const win = (from: number, to: number) => (db.prepare(`SELECT COALESCE(SUM(CASE WHEN side='buy' THEN usd_value ELSE -usd_value END), 0) AS net FROM smart_money_trades WHERE traded_at >= ? AND traded_at < ?`).get(from, to) as { net: number }).net;
    const net = win(now - D, now + 1), before = win(now - 2 * D, now - D);
    const wallets = (db.prepare('SELECT COUNT(DISTINCT wallet) AS n FROM smart_money_trades WHERE traded_at >= ?').get(now - D) as { n: number }).n;
    if (cur.length) out.push({
      id: 'sm-flow', kind: 'Smart Money', tone: net >= 0 ? 'up' : 'down', href: '/smart-money',
      text: `Smart Money ${net >= 0 ? 'net bought' : 'net sold'} ${usd(Math.abs(net))} on DEXs across ${wallets} wallets`,
      detail: prev.length ? `${Math.sign(net) !== Math.sign(before) ? 'Reversing' : 'After'} ${usd(before, { signed: true })} the day before · ${cur.filter((x) => x.net > 0).length}/${cur.length} hours net buying` : `${cur.filter((x) => x.net > 0).length}/${cur.length} hours net buying`,
      spark: { type: 'bars', values: cur.map((x) => x.net) },
    });

    // 2. Unusual activity: a token's Smart Money wallet count against its 6-day daily average.
    const days = db.prepare(`SELECT chain, token_address AS t, MAX(token_symbol) AS s, (traded_at / ${D}) AS d, COUNT(DISTINCT wallet) AS w,
        SUM(CASE WHEN side='buy' THEN usd_value ELSE -usd_value END) AS net
      FROM smart_money_trades WHERE traded_at >= ? GROUP BY chain, token_address, d`).all(now - 7 * D) as Array<{ chain: string; t: string; s: string | null; d: number; w: number; net: number }>;
    const today = Math.floor(now / D);
    const byTok = new Map<string, typeof days>();
    for (const r of days) byTok.set(`${r.chain}:${r.t}`, [...(byTok.get(`${r.chain}:${r.t}`) ?? []), r]);
    let best: { key: string; ratio: number; w: number; avg: number; net: number; s: string | null; chain: string; t: string; series: number[] } | null = null;
    for (const [key, rows] of byTok) {
      const t = rows.find((r) => r.d === today);
      if (!t || t.w < 8) continue;
      const past = rows.filter((r) => r.d < today);
      const avg = past.reduce((a, r) => a + r.w, 0) / 6;
      const ratio = t.w / Math.max(1, avg);
      if (ratio >= 3 && (!best || ratio > best.ratio)) best = { key, ratio, w: t.w, avg, net: t.net, s: t.s, chain: t.chain, t: t.t, series: Array.from({ length: 7 }, (_, i) => rows.find((r) => r.d === today - 6 + i)?.w ?? 0) };
    }
    if (best) out.push({
      id: 'unusual', kind: 'Unusual activity', tone: 'alert', href: `/token/${best.chain}/${encodeURIComponent(best.t)}`,
      text: `${best.w} Smart Money wallets traded ${best.s ?? 'a token'} today, ${best.ratio.toFixed(1)}× its daily average`,
      detail: `${chainName(best.chain)} · net ${usd(best.net, { signed: true })} · 6-day average ${best.avg.toFixed(1)} wallets`,
      spark: { type: 'bars', values: best.series },
    });

    // 3. Concentration: how much of the top net-bought token's flow came from one wallet.
    const toks = db.prepare(`SELECT chain, token_address AS t, MAX(token_symbol) AS s, SUM(CASE WHEN side='buy' THEN usd_value ELSE -usd_value END) AS net, COUNT(DISTINCT CASE WHEN side='buy' THEN wallet END) AS w
      FROM smart_money_trades WHERE traded_at >= ? GROUP BY chain, token_address ORDER BY net DESC LIMIT 1`).get(now - D) as { chain: string; t: string; s: string | null; net: number; w: number } | undefined;
    if (toks && toks.net > 0) {
      const top = db.prepare(`SELECT wallet, SUM(CASE WHEN side='buy' THEN usd_value ELSE 0 END) AS buy, SUM(CASE WHEN side='buy' THEN usd_value ELSE -usd_value END) AS net FROM smart_money_trades
        WHERE traded_at >= ? AND chain = ? AND token_address = ? GROUP BY wallet ORDER BY buy DESC`).all(now - D, toks.chain, toks.t) as Array<{ buy: number; net: number }>;
      const gross = top.reduce((a, x) => a + x.buy, 0);
      const share = gross ? top[0].buy / gross : 0;
      out.push({
        id: 'top-buy', kind: 'Accumulation', tone: 'up', href: `/token/${toks.chain}/${encodeURIComponent(toks.t)}`,
        text: `${toks.s ?? 'Top token'} leads Smart Money buying at ${usd(toks.net, { signed: true })} from ${toks.w} buyer${toks.w === 1 ? '' : 's'}`,
        detail: `${chainName(toks.chain)} · ${share >= 0.5 ? 'concentrated' : 'broad'}: the largest buyer is ${pct(share, 0)} of buys`,
        spark: { type: 'bars', values: top.slice(0, 12).map((x) => x.net) },
      });
    }

    // 4. Largest single Smart Money trade.
    const big = db.prepare(`SELECT chain, token_address AS t, token_symbol AS s, wallet_label AS l, side, usd_value AS v, traded_at AS at FROM smart_money_trades WHERE traded_at >= ? ORDER BY usd_value DESC LIMIT 1`).get(now - D) as { chain: string; t: string; s: string | null; l: string | null; side: string; v: number; at: number } | undefined;
    if (big) out.push({
      id: 'big-trade', kind: 'Largest trade', tone: big.side === 'buy' ? 'up' : 'down', href: `/token/${big.chain}/${encodeURIComponent(big.t)}`,
      text: `${(big.l ?? 'A Smart Money wallet').replace(/\s*\[.*?\]$/, '').replace(/\p{Extended_Pictographic}|\uFE0F/gu, '').trim()} ${big.side === 'buy' ? 'bought' : 'sold'} ${usd(big.v)} of ${big.s ?? 'a token'}`,
      detail: `${chainName(big.chain)} · ${Math.max(1, Math.round((now - big.at) / H))}h ago`,
    });
  }

  // 5. Chain rotation: the largest Flow Index move in 24h.
  const source = owner ? 'smart-money' : 'market-flow';
  const cpiAt = (t: number) => new Map((db.prepare(`SELECT c.chain AS k, c.cpi AS v FROM chain_cpi c JOIN (SELECT chain, MAX(snapshot_at) s FROM chain_cpi WHERE source = ? AND snapshot_at <= ? GROUP BY chain) m
    ON m.chain = c.chain AND m.s = c.snapshot_at WHERE c.source = ?`).all(source, t, source) as Array<{ k: string; v: number }>).map((r) => [r.k, r.v]));
  const a = cpiAt(now), b = cpiAt(now - D);
  const moves = [...a].filter(([k]) => b.has(k)).map(([k, v]) => ({ chain: k, v, d: v - b.get(k)! })).sort((x, y) => Math.abs(y.d) - Math.abs(x.d));
  const up = moves.filter((m) => m.d > 0)[0], down = moves.filter((m) => m.d < 0)[0];
  const cpiLine = (chain: string) => (db.prepare('SELECT cpi FROM chain_cpi WHERE chain = ? AND source = ? AND snapshot_at >= ? ORDER BY snapshot_at').all(chain, source, now - D) as Array<{ cpi: number }>).map((r) => r.cpi);
  if (up && down) out.push({
    id: 'rotation', kind: 'Rotation', tone: 'flat', href: '/flows',
    text: `Flow Index rising fastest on ${chainName(up.chain)} (${Math.round(up.v)}, +${Math.round(up.d)}) and falling fastest on ${chainName(down.chain)} (${Math.round(down.v)}, −${Math.round(Math.abs(down.d))})`,
    detail: `Flow Index, 24h change · ${((n) => `${n} chain${n === 1 ? '' : 's'}`)([...a.values()].filter((v) => v >= 65).length)} accumulating, ${[...a.values()].filter((v) => v <= 35).length} distributing`,
    spark: { type: 'line', values: cpiLine(up.chain), min: 0, max: 100, baseline: 50 },
  });

  // 6. Perps: open-interest and funding across Hyperliquid.
  const lastT = (db.prepare("SELECT MAX(snapshot_at) AS t FROM perp_snapshots WHERE source = 'all' AND snapshot_at <= ?").get(now) as { t: number | null }).t;
  if (lastT) {
    const rows = db.prepare("SELECT symbol, open_interest AS oi, funding, mark_price AS px FROM perp_snapshots WHERE source = 'all' AND snapshot_at = ?").all(lastT) as Array<{ symbol: string; oi: number | null; funding: number | null; px: number | null }>;
    const prevT = (db.prepare("SELECT MAX(snapshot_at) AS t FROM perp_snapshots WHERE source = 'all' AND snapshot_at <= ?").get(lastT - D) as { t: number | null }).t;
    const prevRows = prevT ? new Map((db.prepare("SELECT symbol, open_interest AS oi FROM perp_snapshots WHERE source = 'all' AND snapshot_at = ?").all(prevT) as Array<{ symbol: string; oi: number | null }>).map((r) => [r.symbol, r.oi ?? 0])) : new Map<string, number>();
    const total = rows.reduce((s, r) => s + (r.oi ?? 0), 0), totalPrev = [...prevRows.values()].reduce((s, v) => s + v, 0);
    const series = (db.prepare(`SELECT snapshot_at AS t, SUM(open_interest) AS oi FROM perp_snapshots WHERE source = 'all' AND snapshot_at >= ? GROUP BY snapshot_at ORDER BY snapshot_at`).all(lastT - 3 * D) as Array<{ oi: number }>).map((r) => r.oi);
    const mover = rows.filter((r) => (r.oi ?? 0) > 50e6 && prevRows.get(r.symbol)).map((r) => ({ ...r, ch: (r.oi ?? 0) / prevRows.get(r.symbol)! - 1 })).sort((x, y) => Math.abs(y.ch) - Math.abs(x.ch))[0];
    if (total) out.push({
      id: 'perps-oi', kind: 'Perps', tone: totalPrev && total < totalPrev ? 'down' : 'up', href: mover ? `/perps/${mover.symbol}` : '/perps',
      text: `Hyperliquid open interest ${usd(total)}${totalPrev ? `, ${signedPct(total / totalPrev - 1)} in 24h` : ''}`,
      detail: mover ? `Biggest mover ${mover.symbol} ${signedPct(mover.ch)} OI · ${rows.filter((r) => (r.funding ?? 0) < 0).length} coins with negative funding` : `${rows.length} coins`,
      spark: series.length > 2 ? { type: 'line', values: series } : undefined,
    });
    const hot = rows.filter((r) => (r.oi ?? 0) > 20e6 && r.funding != null).sort((x, y) => Math.abs(y.funding!) - Math.abs(x.funding!))[0];
    if (hot && hot.funding) out.push({
      id: 'funding', kind: 'Funding', tone: hot.funding > 0 ? 'up' : 'down', href: `/perps/${hot.symbol}`,
      text: `${hot.symbol} funding ${(hot.funding * 100 * 24 * 365).toFixed(0)}% annualized: ${hot.funding > 0 ? 'longs paying shorts' : 'shorts paying longs'}`,
      detail: `Hourly ${(hot.funding * 100).toFixed(4)}% · OI ${usd(hot.oi)}`,
    });
  }

  // 7. BTC Smart Money perp book, from stored snapshots.
  if (owner) {
    const snaps = db.prepare("SELECT at, positions FROM perp_position_snapshots WHERE symbol = 'BTC' ORDER BY at DESC LIMIT 24").all() as Array<{ at: number; positions: string }>;
    const share = snaps.reverse().map((r) => {
      let l = 0, s = 0;
      for (const p of JSON.parse(r.positions) as Array<[string, string | null, number, number, ...unknown[]]>) if (String(p[9] ?? '').includes('smart_money')) { if (p[2]) l += p[3]; else s += p[3]; }
      return l + s ? l / (l + s) : null;
    }).filter((x): x is number => x != null);
    if (share.length) {
      const last = share.at(-1)!, first = share[0];
      out.push({
        id: 'btc-book', kind: 'Positioning', tone: last >= 0.5 ? 'up' : 'down', href: '/perps/BTC',
        text: `Smart Money is ${pct(last, 0)} long BTC on Hyperliquid`,
        // Same whole percent at both ends reads as unchanged, not "down from 13%" while at 13%.
        detail: share.length > 1 ? (pct(first, 0) === pct(last, 0) ? `Unchanged at ${pct(last, 0)} across ${share.length} snapshots` : `${last > first ? 'Up' : 'Down'} from ${pct(first, 0)} across ${share.length} snapshots`) : 'Latest snapshot',
        spark: share.length > 1 ? { type: 'line', values: share.map((x) => x * 100), min: 0, max: 100, baseline: 50 } : undefined,
      });
    }
  }

  // 8. Sectors: the strongest inflow and outflow, 24h.
  const secT = (db.prepare("SELECT MAX(snapshot_at) AS t FROM sector_snapshots WHERE window = '24h' AND source = ?").get(source) as { t: number | null }).t;
  if (secT) {
    const secs = db.prepare("SELECT sector, net_flow_usd AS net FROM sector_snapshots WHERE window = '24h' AND source = ? AND snapshot_at = ? ORDER BY net_flow_usd DESC").all(source, secT) as Array<{ sector: string; net: number }>;
    if (secs.length > 1) out.push({
      id: 'sectors', kind: 'Sectors', tone: 'flat', href: `/sectors/${encodeURIComponent(secs[0].sector)}`,
      text: `${secs[0].sector} leads sector inflows at ${usd(secs[0].net, { signed: true })}; ${secs.at(-1)!.sector} trails at ${usd(secs.at(-1)!.net, { signed: true })}`,
      detail: `${secs.filter((x) => x.net > 0).length} of ${secs.length} sectors net positive`,
      spark: { type: 'bars', values: secs.slice(0, 8).map((x) => x.net).concat(secs.slice(-4).map((x) => x.net)) },
    });
  }

  // 9. Dump risk: tokens at High or Critical in the last 48 hours.
  const risk = (db.prepare(`SELECT s.chain, s.token_address AS t, s.symbol, s.score, s.band FROM storm_scores s JOIN (SELECT chain, token_address, MAX(computed_at) m FROM storm_scores WHERE computed_at >= ? GROUP BY chain, token_address) x
    ON x.chain = s.chain AND x.token_address = s.token_address AND x.m = s.computed_at WHERE s.band IN ('watch', 'warning') ORDER BY s.score DESC`).all(now - 2 * D) as Array<{ chain: string; t: string; symbol: string | null; score: number; band: string }>).filter((r) => isRiskListable(r.symbol));
  if (risk.length) out.push({
    id: 'risk', kind: 'Risk', tone: 'alert', href: `/token/${risk[0].chain}/${encodeURIComponent(properAddress(risk[0].chain, risk[0].t))}`,
    text: `${risk.length} token${risk.length === 1 ? '' : 's'} at High or Critical dump risk; ${risk[0].symbol ?? 'top'} scores ${Math.round(risk[0].score)}`,
    detail: risk.slice(1, 4).map((r) => `${r.symbol ?? '?'} ${Math.round(r.score)}`).join(' · '),
  });

  return out;
}
