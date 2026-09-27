// Copy Lab: can you actually copy a Smart Money wallet? For every stored Smart Money DEX buy (Nansen
// smart-money/dex-trades), read Nansen's 15-minute price candles (tgm/token-ohlcv) and measure the 24-hour
// return of entering at the same moment, 15 minutes, 1 hour and 6 hours late. A wallet whose edge survives
// the delay is followable; one whose edge vanishes in the first hour is not, however good its PnL looks.
import { getDb, getKv, setKv } from '@/server/nansen/db';
import { traced } from '@/server/nansen/traced';
import { requestDay } from '@/server/nansen/demo';
import { endpointUnavailable } from '@/lib/registry';
import type { TokenOHLCVResponse } from '@/types/nansen/token-god-mode';

export const LAGS = [0, 15, 60, 360] as const; // minutes late
const HOLD = 24 * 3_600_000;
const M = 60_000;
const KEY = 'copylab:v1';

export interface WalletFollow {
  wallet: string; label: string | null; buys: number; tokens: number;
  mean: number[]; median: number[]; win: number[]; // per lag
  kept: number | null; score: number;
  recent: Array<{ chain: string; token: string; symbol: string | null; usd: number; at: number }>;
}
export interface CopyLab {
  at: number; window: { from: number; to: number };
  buysMeasured: number; walletsScored: number; tokensPriced: number; calls: number;
  decay: { mean: number[]; median: number[]; win: number[] };
  wallets: WalletFollow[];
}

type Candle = { t: number; o: number; c: number };
const median = (xs: number[]) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

async function candles(chain: string, token: string): Promise<Candle[] | null> {
  if (endpointUnavailable('tgmTokenOhlcv', chain, 'Price candles')) return null;
  try {
    const res = await traced<TokenOHLCVResponse>('tgm/token-ohlcv', { chain, token_address: token, timeframe: '15m', date: { from: requestDay(7), to: requestDay(-1) } }, 1);
    return res.data.data
      .filter((x) => x.open != null && x.close != null && x.close > 0)
      .map((x) => ({ t: Date.parse(x.interval_start), o: x.open!, c: x.close! }))
      .sort((a, b) => a.t - b.t);
  } catch { return null; }
}

/** Price at time t: the open of the first 15-minute candle starting at or after t (what a follower could get). */
function priceAt(cs: Candle[], t: number): number | null {
  let lo = 0, hi = cs.length - 1, ans = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (cs[mid].t >= t) { ans = mid; hi = mid - 1; } else lo = mid + 1; }
  if (ans < 0 || cs[ans].t - t > 45 * M) return null; // no candle close enough: gap in data
  return cs[ans].o;
}

/** Followability 0-100: win rate and median return when one hour late, shrunk toward 50 for few trades. */
export function followScore(win1h: number, median1h: number, n: number): number {
  const raw = 1 / (1 + Math.exp(-(median1h * 12 + (win1h - 0.5) * 5)));
  const w = n / (n + 6);
  return Math.round(100 * (w * raw + (1 - w) * 0.5));
}

export async function computeCopyLab(opts: { maxTokens?: number; minUsd?: number; now?: number } = {}): Promise<CopyLab> {
  const now = opts.now ?? Date.now();
  const db = getDb();
  const buys = db.prepare(`SELECT chain, token_address AS token, token_symbol AS symbol, wallet, MAX(wallet_label) AS label, usd_value AS usd, traded_at AS at
    FROM smart_money_trades WHERE side = 'buy' AND usd_value >= ? AND traded_at >= ? GROUP BY tx_hash, wallet, token_address ORDER BY traded_at`)
    .all(opts.minUsd ?? 1000, now - 7 * 86_400_000) as Array<{ chain: string; token: string; symbol: string | null; wallet: string; label: string | null; usd: number; at: number }>;

  // Price the tokens that the most buys need, within the call budget.
  const need = new Map<string, number>();
  for (const b of buys) if (b.at + HOLD <= now) need.set(`${b.chain}|${b.token}`, (need.get(`${b.chain}|${b.token}`) ?? 0) + 1);
  const pick = [...need.entries()].sort((a, b) => b[1] - a[1]).slice(0, opts.maxTokens ?? 220).map(([k]) => k);
  const series = new Map<string, Candle[]>();
  let calls = 0;
  for (let i = 0; i < pick.length; i += 6) {
    await Promise.all(pick.slice(i, i + 6).map(async (k) => {
      const [chain, token] = k.split('|');
      const cs = await candles(chain, token); calls++;
      if (cs?.length) series.set(k, cs);
    }));
  }

  // Per wallet, per token: a wallet that buys one token twenty times should count that token once.
  const perWallet = new Map<string, { label: string | null; byToken: Map<string, number[][]> }>();
  const all: number[][] = LAGS.map(() => []);
  let measured = 0;
  for (const b of buys) {
    if (b.at + HOLD > now) continue;
    const cs = series.get(`${b.chain}|${b.token}`);
    if (!cs) continue;
    const exit = priceAt(cs, b.at + HOLD);
    if (exit == null) continue;
    const rs = LAGS.map((lag) => { const e = priceAt(cs, b.at + lag * M); return e ? Math.max(-0.95, Math.min(5, exit / e - 1)) : null; });
    if (rs.some((r) => r == null)) continue;
    measured++;
    const w = perWallet.get(b.wallet) ?? { label: b.label, byToken: new Map<string, number[][]>() };
    const tk = `${b.chain}|${b.token}`;
    const cell = w.byToken.get(tk) ?? LAGS.map(() => [] as number[]);
    rs.forEach((r, i) => { cell[i].push(r!); all[i].push(r!); });
    w.byToken.set(tk, cell);
    if (!w.label && b.label) w.label = b.label;
    perWallet.set(b.wallet, w);
  }

  const recentBy = new Map<string, WalletFollow['recent']>();
  for (const b of [...buys].reverse()) {
    const list = recentBy.get(b.wallet) ?? [];
    // One entry per token: the latest buy, with repeat buys summed.
    const same = list.find((x) => x.chain === b.chain && x.token === b.token);
    if (same) same.usd += b.usd;
    else if (list.length < 3) list.push({ chain: b.chain, token: b.token, symbol: b.symbol?.replace(/\p{Extended_Pictographic}|\uFE0F/gu, '').trim() || null, usd: b.usd, at: b.at });
    recentBy.set(b.wallet, list);
  }

  const wallets: WalletFollow[] = [...perWallet.entries()].filter(([, w]) => w.byToken.size >= 3).map(([wallet, w]) => {
    // One return per token (its buys averaged), then statistics across tokens.
    const cells = [...w.byToken.values()];
    const rets = LAGS.map((_, i) => cells.map((c) => mean(c[i])));
    const m = rets.map(mean), md = rets.map(median), win = rets.map((xs) => xs.filter((x) => x > 0).length / xs.length);
    return {
      wallet, label: w.label, buys: cells.reduce((a, c) => a + c[0].length, 0), tokens: cells.length,
      mean: m, median: md, win,
      kept: m[0] > 0.005 ? m[2] / m[0] : null,
      score: followScore(win[2], md[2], cells.length),
      recent: recentBy.get(wallet) ?? [],
    };
  }).sort((a, b) => b.score - a.score || b.buys - a.buys);

  const times = buys.map((b) => b.at);
  const lab: CopyLab = {
    at: now, window: { from: times.length ? Math.min(...times) : now, to: times.length ? Math.max(...times) : now },
    buysMeasured: measured, walletsScored: wallets.length, tokensPriced: series.size, calls,
    decay: { mean: all.map(mean), median: all.map(median), win: all.map((xs) => (xs.length ? xs.filter((x) => x > 0).length / xs.length : 0)) },
    wallets,
  };
  setKv(KEY, JSON.stringify(lab));
  return lab;
}

export function cachedCopyLab(): CopyLab | null {
  const v = getKv(KEY);
  try { return v ? (JSON.parse(v.value) as CopyLab) : null; } catch { return null; }
}

/** One wallet's followability, if it was scored. */
export function walletFollow(address: string): WalletFollow | null {
  return cachedCopyLab()?.wallets.find((w) => w.wallet.toLowerCase() === address.toLowerCase()) ?? null;
}

let running: Promise<CopyLab> | null = null;
/** How long a study stays fresh: 6 hours, but only 30 minutes when it measured
 *  nothing (the tape was too young), so it fills in as soon as buys age 24h. */
export const studyTtl = (lab: Pick<CopyLab, 'buysMeasured'>) => (lab.buysMeasured > 0 ? 6 * 3_600_000 : 30 * 60_000);

/** Recompute when stale, in the background; callers read the cached result. */
export function refreshCopyLab(force = false): Promise<CopyLab> | null {
  const c = cachedCopyLab();
  if (!force && c && Date.now() - c.at < studyTtl(c)) return null;
  if (!running) running = computeCopyLab().finally(() => { running = null; });
  return running;
}
