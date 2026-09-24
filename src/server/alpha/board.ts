// The Alpha board: every token the scanner has seen recently, scored with
// src/lib/models/alpha.ts from token_pulse (the screener rows each scan
// already paid for) and TIDE's stored Storm Scores. No Nansen call at view
// time. Public views score on all-trader flow only; the key owner's view
// adds the smart-money component.
import { getDb } from '@/server/nansen/db';
import { alphaScore, type AlphaPart } from '@/lib/models/alpha';
import { isStablecoin, isMajorOrWrapped } from '@/lib/models/trade-side';
import type { PressureView } from '@/server/weather/queries';
import type { Provenance } from '@/lib/provenance';

export interface AlphaRow {
  chain: string;
  tokenAddress: string;
  symbol: string | null;
  score: number;
  parts: AlphaPart[];
  flowShare: number | null;
  /** 1h flow share per scan, oldest first — the sparkline. */
  hourly: number[];
  volume24hUsd: number | null;
  liquidityUsd: number | null;
  marketCapUsd: number | null;
  priceChange24h: number | null;
  priceUsd: number | null;
}

export interface AlphaBoard {
  rows: AlphaRow[];
  at: number | null;
  scans: number;
  chains: string[];
  view: PressureView;
  provenance: Provenance | null;
  unavailable: string | null;
}

interface PulseRow {
  snapshot_at: number; window: string; source: string; chain: string; token_address: string; symbol: string | null;
  netflow: number | null; volume: number | null; price_usd: number | null; price_change: number | null;
  liquidity: number | null; market_cap: number | null; age_days: number | null;
}

const HOURLY = 12;
const FRESH_24H_MS = 6 * 3_600_000;
const MIN_VOLUME_USD = 50_000;
const share = (net: number | null, vol: number | null) => (net == null || !vol || vol <= 0 ? null : net / vol);

export function alphaBoard(view: PressureView, now = Date.now(), limit = 60): AlphaBoard {
  const db = getDb();
  const since = now - 36 * 3_600_000;
  const pulse = db.prepare('SELECT * FROM token_pulse WHERE snapshot_at >= ? ORDER BY snapshot_at').all(since) as PulseRow[];
  const hourlyAt = [...new Set(pulse.filter((r) => r.window === '1h' && r.source === 'market-flow').map((r) => r.snapshot_at))].sort((a, b) => a - b);
  if (!hourlyAt.length) {
    return { rows: [], at: null, scans: 0, chains: [], view, provenance: null, unavailable: 'The Alpha board builds from the scanner’s token snapshots; they begin with its next run.' };
  }
  const latest = hourlyAt.at(-1)!;
  const recentScans = hourlyAt.slice(-HOURLY);
  const key = (r: { chain: string; token_address: string }) => `${r.chain}:${r.token_address}`;

  const hourly = new Map<string, Map<number, number>>();
  const last24 = new Map<string, PulseRow>();
  const smart24 = new Map<string, PulseRow>();
  const latest1h = new Map<string, PulseRow>();
  for (const r of pulse) {
    const k = key(r);
    if (r.window === '1h' && r.source === 'market-flow') {
      const s = share(r.netflow, r.volume);
      if (s != null) { if (!hourly.has(k)) hourly.set(k, new Map()); hourly.get(k)!.set(r.snapshot_at, s); }
      if (r.snapshot_at === latest) latest1h.set(k, r);
    } else if (r.window === '24h' && now - r.snapshot_at <= FRESH_24H_MS) {
      (r.source === 'market-flow' ? last24 : smart24).set(k, r);
    }
  }

  const storms = new Map((db.prepare(`
    SELECT chain, token_address, score FROM storm_scores WHERE id IN (SELECT MAX(id) FROM storm_scores WHERE computed_at >= ? GROUP BY chain, token_address)
  `).all(now - 7 * 86_400_000) as Array<{ chain: string; token_address: string; score: number }>).map((s) => [`${s.chain}:${s.token_address.toLowerCase()}`, s.score]));

  const rows: AlphaRow[] = [];
  const candidates = new Set([...latest1h.keys(), ...last24.keys()]);
  for (const k of candidates) {
    const d = last24.get(k), h = latest1h.get(k);
    const ref = d ?? h!;
    if (isStablecoin(ref.symbol) || isMajorOrWrapped(ref.symbol)) continue;
    const volume24h = d?.volume ?? (h?.volume != null ? h.volume * 24 : null);
    if (!volume24h || volume24h < MIN_VOLUME_USD) continue;
    const series = recentScans.map((t) => hourly.get(k)?.get(t)).filter((v): v is number => v != null);
    const sm = smart24.get(k);
    const smartShare = view === 'private' && sm && d ? share(sm.netflow, d.volume) : null;
    const flowShare = share(d?.netflow ?? null, d?.volume ?? null) ?? share(h?.netflow ?? null, h?.volume ?? null);
    const stormScore = storms.get(`${ref.chain}:${ref.token_address.toLowerCase()}`) ?? null;
    const { score, parts } = alphaScore({
      flowShare, flowWindow: d && d.volume ? '24h' : '1h', hourly: series, smartShare,
      liquidityUsd: ref.liquidity, priceChange24h: d?.price_change ?? null, stormScore,
      // Nansen returns days-since-epoch when a token has no deployment date.
      ageDays: ref.age_days != null && ref.age_days < 10_000 ? ref.age_days : null,
    });
    rows.push({
      chain: ref.chain, tokenAddress: ref.token_address, symbol: ref.symbol, score, parts, flowShare, hourly: series,
      volume24hUsd: volume24h, liquidityUsd: ref.liquidity, marketCapUsd: ref.market_cap, priceChange24h: d?.price_change ?? null, priceUsd: ref.price_usd,
    });
  }
  rows.sort((a, b) => b.score - a.score || (b.volume24hUsd ?? 0) - (a.volume24hUsd ?? 0));
  const top = rows.slice(0, limit);
  return {
    rows: top, at: latest, scans: hourlyAt.length, chains: [...new Set(rows.map((r) => r.chain))].sort(), view, unavailable: null,
    provenance: {
      title: 'Alpha score',
      formula: 'score = 50 + Σ components, clamped 0–100\nnet buying: 25·tanh(net flow ÷ volume ÷ 0.25), 24h (1h until the scanner has 24h)\npersistence: share of the last 12 scans with 1h net buying (±15)\nacceleration: latest 1h share − median of the run before × 80 (±10)\n' +
        (view === 'private' ? 'smart money: 20·tanh(24h smart-money net flow ÷ volume ÷ 0.1)\n' : '') +
        'Stablecoins, majors and their wrapped copies are left out.\n' + 'thin liquidity −8/−20 · already up 60%+ −10 · down 35%+ −6 · Storm ≥ 60 −15, ≤ 30 +4 · under 2 days old −6',
      inputs: [
        { label: 'Tokens scored', value: `${rows.length.toLocaleString('en-US')} (24h volume ≥ $50K)` },
        { label: 'Chains', value: String(new Set(rows.map((r) => r.chain)).size) },
        { label: 'Scans used', value: `${recentScans.length} hourly readings per token (last ${Math.round((latest - recentScans[0]) / 3_600_000) || 0}h)` },
      ],
      calls: [{ endpoint: 'token-screener', body: { note: 'the scanner’s own CPI rows: the busiest 25 tokens per chain, kept each scan' }, ref: 'every scan, no extra credits' }],
      notes: [
        'A shortlist of what to look at, not a forecast or advice. Its hit rate is measured in the Forecast Lab as history accumulates.',
        ...(view === 'public' ? ['Public view: scored on all-trader flow; the smart-money component is shown to the API key owner only.'] : []),
      ],
    },
  };
}
