// Forward checks (M9): TIDE's own readings, rebuilt for past moments from
// its stored snapshots (no look-ahead: each board only sees data up to its
// moment) and scored against what prices did next. Free: no Nansen call.
// The history starts when the scanner began storing each table, so these
// grow sharper every hour on their own.
import { getDb } from '@/server/nansen/db';
import { alphaBoard } from '@/server/alpha/board';
import { perpBoard } from '@/server/perps/board';
import type { PressureView } from '@/server/weather/queries';

export interface Pair {
  score: number;
  fwd: number;
}
export interface Band {
  label: string;
  n: number;
  hitRate: number | null;
  meanReturn: number | null;
  medianReturn: number | null;
}
export interface ForwardCheck {
  signal: string;
  horizonHours: number;
  moments: number;
  pairs: number;
  bands: Band[];
  baseline: Band;
  spearman: number | null;
  firstMoment: number | null;
  lastMoment: number | null;
  readyAt: number | null;
  note: string;
}

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
function band(label: string, xs: Pair[]): Band {
  const r = xs.map((p) => p.fwd);
  return {
    label,
    n: xs.length,
    hitRate: xs.length ? r.filter((x) => x > 0).length / xs.length : null,
    meanReturn: xs.length ? r.reduce((a, b) => a + b, 0) / xs.length : null,
    medianReturn: median(r),
  };
}

/** Rank correlation between a score and the forward return (ties averaged). */
export function spearman(pairs: Pair[]): number | null {
  if (pairs.length < 5) return null;
  const rank = (xs: number[]) => {
    const idx = xs.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0]);
    const r = new Array<number>(xs.length);
    for (let i = 0; i < idx.length; ) {
      let j = i;
      while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
      for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2 + 1;
      i = j + 1;
    }
    return r;
  };
  const a = rank(pairs.map((p) => p.score)),
    b = rank(pairs.map((p) => p.fwd));
  const ma = a.reduce((s, x) => s + x, 0) / a.length,
    mb = b.reduce((s, x) => s + x, 0) / b.length;
  let num = 0,
    da = 0,
    db = 0;
  for (let i = 0; i < a.length; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return da && db ? num / Math.sqrt(da * db) : null;
}

export function summarize(
  signal: string,
  horizonHours: number,
  pairs: Pair[],
  moments: number[],
  edges: Array<[string, (s: number) => boolean]>,
  note: string,
  readyAt: number | null,
): ForwardCheck {
  return {
    signal,
    horizonHours,
    moments: moments.length,
    pairs: pairs.length,
    bands: edges.map(([label, f]) =>
      band(
        label,
        pairs.filter((p) => f(p.score)),
      ),
    ),
    baseline: band('every token', pairs),
    spearman: spearman(pairs),
    firstMoment: moments[0] ?? null,
    lastMoment: moments.at(-1) ?? null,
    readyAt,
    note,
  };
}

/** The price a series shows at or just after `t` (within `slack`). */
function priceAt(series: Array<{ t: number; p: number }>, t: number, slack: number): number | null {
  const x = series.find((s) => s.t >= t && s.t - t <= slack);
  return x?.p ?? null;
}

/** Alpha scores against the next `horizonHours` of price, from the token snapshots. */
export function alphaForward(view: PressureView, horizonHours = 6, maxMoments = 24): ForwardCheck {
  const db = getDb();
  const h = horizonHours * 3_600_000,
    slack = 90 * 60_000;
  const times = (
    db
      .prepare("SELECT DISTINCT snapshot_at AS t FROM token_pulse WHERE window = '1h' AND source = 'market-flow' ORDER BY t")
      .all() as Array<{ t: number }>
  ).map((r) => r.t);
  const last = times.at(-1) ?? null;
  const moments = times.filter((t) => last != null && t + h <= last).slice(-maxMoments);
  const prices = new Map<string, Array<{ t: number; p: number }>>();
  for (const r of db
    .prepare(
      "SELECT chain, token_address, snapshot_at AS t, price_usd AS p FROM token_pulse WHERE window = '1h' AND source = 'market-flow' AND price_usd > 0 ORDER BY snapshot_at",
    )
    .all() as Array<{ chain: string; token_address: string; t: number; p: number }>) {
    const k = `${r.chain}:${r.token_address}`;
    (prices.get(k) ?? prices.set(k, []).get(k)!).push({ t: r.t, p: r.p });
  }
  const pairs: Pair[] = [];
  for (const t of moments) {
    for (const row of alphaBoard(view, t, 60).rows) {
      const series = prices.get(`${row.chain}:${row.tokenAddress}`) ?? [];
      const p0 = priceAt(series, t, slack),
        p1 = priceAt(series, t + h, slack);
      if (p0 && p1) pairs.push({ score: row.score, fwd: p1 / p0 - 1 });
    }
  }
  return summarize(
    `Alpha score (${view === 'public' ? 'all traders' : 'with smart money'})`,
    horizonHours,
    pairs,
    moments,
    [
      ['score 70+', (s) => s >= 70],
      ['55 to 69', (s) => s >= 55 && s < 70],
      ['under 55', (s) => s < 55],
    ],
    'Forward return = price at the next snapshot at least the horizon later ÷ price at the reading − 1. A token counts only while it stays among its chain’s 25 busiest, so the sample leans to active tokens.',
    times[0] != null && !moments.length ? times[0] + h : null,
  );
}

/** Coin Perp Pressure against the next `horizonHours` of mark price, from the perp snapshots. */
export function ppiForward(view: PressureView, horizonHours = 6, maxMoments = 48): ForwardCheck {
  const db = getDb();
  const h = horizonHours * 3_600_000,
    slack = 90 * 60_000;
  const times = (
    db.prepare("SELECT DISTINCT snapshot_at AS t FROM perp_snapshots WHERE source = 'all' ORDER BY t").all() as Array<{ t: number }>
  ).map((r) => r.t);
  const last = times.at(-1) ?? null;
  const moments = times.filter((t) => last != null && t + h <= last).slice(-maxMoments);
  const marks = new Map<string, Array<{ t: number; p: number }>>();
  for (const r of db
    .prepare(
      "SELECT symbol, snapshot_at AS t, mark_price AS p FROM perp_snapshots WHERE source = 'all' AND mark_price > 0 ORDER BY snapshot_at",
    )
    .all() as Array<{ symbol: string; t: number; p: number }>) {
    (marks.get(r.symbol) ?? marks.set(r.symbol, []).get(r.symbol)!).push({ t: r.t, p: r.p });
  }
  const pairs: Pair[] = [];
  for (const t of moments) {
    for (const c of perpBoard(view, t).coins) {
      if (c.ppi == null || (c.openInterest ?? 0) < 5_000_000) continue;
      const series = marks.get(c.symbol) ?? [];
      const p0 = priceAt(series, t, slack),
        p1 = priceAt(series, t + h, slack);
      if (p0 && p1) pairs.push({ score: c.ppi, fwd: p1 / p0 - 1 });
    }
  }
  return summarize(
    `Perp Flow Index (${view === 'public' ? 'all traders' : 'with smart money'})`,
    horizonHours,
    pairs,
    moments,
    [
      ['long bias (65+)', (s) => s > 65],
      ['balanced', (s) => s >= 35 && s <= 65],
      ['short bias (under 35)', (s) => s < 35],
    ],
    'Coins with $5M+ open interest. Forward return = mark price at the next hourly snapshot at least the horizon later ÷ mark at the reading − 1. Long bias "hits" when price rises.',
    times[0] != null && !moments.length ? times[0] + h : null,
  );
}

export interface RuleResult {
  rule: string;
  horizonHours: number;
  matched: ForwardCheck | null;
  note: string;
}

/** Strategy lab: a rule over alpha readings, and how its picks did next. */
export function alphaRule(
  view: PressureView,
  rule: { minScore: number; maxScore: number; chain?: string | null; horizonHours: number },
): RuleResult {
  const all = alphaForward(view, rule.horizonHours, 36);
  // Re-run with the rule's filter applied to each moment's rows.
  const db = getDb();
  const h = rule.horizonHours * 3_600_000,
    slack = 90 * 60_000;
  const times = (
    db
      .prepare("SELECT DISTINCT snapshot_at AS t FROM token_pulse WHERE window = '1h' AND source = 'market-flow' ORDER BY t")
      .all() as Array<{ t: number }>
  ).map((r) => r.t);
  const last = times.at(-1) ?? null;
  const moments = times.filter((t) => last != null && t + h <= last).slice(-36);
  const prices = new Map<string, Array<{ t: number; p: number }>>();
  for (const r of db
    .prepare(
      "SELECT chain, token_address, snapshot_at AS t, price_usd AS p FROM token_pulse WHERE window = '1h' AND source = 'market-flow' AND price_usd > 0 ORDER BY snapshot_at",
    )
    .all() as Array<{ chain: string; token_address: string; t: number; p: number }>) {
    const k = `${r.chain}:${r.token_address}`;
    (prices.get(k) ?? prices.set(k, []).get(k)!).push({ t: r.t, p: r.p });
  }
  const pairs: Pair[] = [];
  for (const t of moments) {
    for (const row of alphaBoard(view, t, 60).rows) {
      if (row.score < rule.minScore || row.score > rule.maxScore || (rule.chain && row.chain !== rule.chain)) continue;
      const series = prices.get(`${row.chain}:${row.tokenAddress}`) ?? [];
      const p0 = priceAt(series, t, slack),
        p1 = priceAt(series, t + h, slack);
      if (p0 && p1) pairs.push({ score: row.score, fwd: p1 / p0 - 1 });
    }
  }
  const label = `alpha ${rule.minScore} to ${rule.maxScore}${rule.chain ? ` on ${rule.chain}` : ''}`;
  return {
    rule: label,
    horizonHours: rule.horizonHours,
    matched: pairs.length ? summarize(label, rule.horizonHours, pairs, moments, [], '', null) : null,
    note: pairs.length
      ? `Against every token the board showed over the same moments: hit rate ${all.baseline.hitRate == null ? 'n/a' : `${Math.round(all.baseline.hitRate * 100)}%`}, mean ${all.baseline.meanReturn == null ? 'n/a' : `${(all.baseline.meanReturn * 100).toFixed(2)}%`}.`
      : 'No reading matched the rule in the stored history yet.',
  };
}
