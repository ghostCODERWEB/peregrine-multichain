// Token-terminal models (M2). Plain numbers in, plain numbers out — no
// Nansen-shaped types — so each is unit-tested without a network.
import { robustZScore } from './cpi';

// ---------------------------------------------------------------- cohorts

export type Cohort = 'exchange' | 'contract' | 'smart' | 'whale' | 'labelled' | 'unlabelled';

export const COHORT_NAMES: Record<Cohort, string> = {
  exchange: 'Exchanges', contract: 'Contracts & pools', smart: 'Smart money', whale: 'Whales', labelled: 'Other labelled', unlabelled: 'Unlabelled',
};

/**
 * A wallet's cohort from its Nansen label. Nansen marks exchanges with 🏦
 * and bots and contracts with 🤖 — and many exchange hot wallets carry
 * both — so pools, vaults and routers are recognized by name first, then
 * 🏦 means an exchange, then 🤖 a contract. Runs on the server in every
 * view (to leave pool plumbing out); cohort names reach private views only.
 */
export function classifyCohort(label: string | null | undefined): Cohort {
  if (!label) return 'unlabelled';
  if (/liquidity|\bpool\b|\bvault\b|\brouter\b|\blp\b/i.test(label)) return 'contract';
  if (label.includes('🏦')) return 'exchange';
  if (label.includes('🤖')) return 'contract';
  if (/smart (trader|money)|\bfund\b|🤓/i.test(label)) return 'smart';
  if (/whale|millionaire|high balance/i.test(label)) return 'whale';
  return 'labelled';
}

// ---------------------------------------------------- transfer anomalies

export interface TransferLike { valueUsd: number | null; cohort: Cohort }

/** Modified z above this flags an outlier (Iglewicz & Hoaglin's 3.5). */
export const ANOMALY_Z = 3.5;
/** Fewer baseline transfers than this in a cohort: too few to judge. */
export const MIN_COHORT = 8;

/**
 * Whale-transfer anomalies. `baseline` is an unbiased sample of the
 * token's transfers (the newest ones, whatever their size); `candidates`
 * are the transfers to judge (the day's largest). Each candidate's size,
 * on a log scale, is a robust z-score against the baseline transfers of
 * its own cohort (or all of them when `byCohort` is false): a $2M
 * exchange shuffle is routine, a $2M move by a wallet whose cohort usually
 * moves $20K is not. Returns one z per candidate, or null when its cohort
 * has too few baseline transfers to say.
 */
export function judgeTransfers(baseline: TransferLike[], candidates: TransferLike[], byCohort: boolean): { z: Array<number | null>; cohortSizes: Record<string, number> } {
  const logs = new Map<string, number[]>();
  for (const t of baseline) {
    if (t.valueUsd == null || !(t.valueUsd > 0)) continue;
    const k = byCohort ? t.cohort : 'all';
    const l = logs.get(k);
    if (l) l.push(Math.log10(t.valueUsd)); else logs.set(k, [Math.log10(t.valueUsd)]);
  }
  const cohortSizes = Object.fromEntries([...logs.entries()].map(([k, v]) => [k, v.length]));
  const z = candidates.map((c) => {
    if (c.valueUsd == null || !(c.valueUsd > 0)) return null;
    const sample = logs.get(byCohort ? c.cohort : 'all');
    return sample && sample.length >= MIN_COHORT ? robustZScore(Math.log10(c.valueUsd), sample) : null;
  });
  return { z, cohortSizes };
}

// ------------------------------------------------------------ social heat

export interface PostLike { at: number; views: number | null; likes: number | null }

export interface SocialHeat {
  score: number;
  posts: number;
  views: number;
  likes: number;
  /** Engagement rate over the last 48 h ÷ the rate over the 5 days before. */
  acceleration: number;
  byDay: Array<{ day: string; posts: number; views: number }>;
}

/**
 * Social heat, 0–100, from a week of posts about the token: half volume
 * (views on a log scale, 10M views saturating), half acceleration (the
 * last 48 h against the 5 days before, 0.5·(1 + tanh(log₂ accel)), so a
 * doubling scores ~0.88 and a halving ~0.12). Engagement is views plus 20×
 * likes, since many posts come back with views of 0. With few posts the
 * ratio is noise (one viral post is a 6× "acceleration"), so the
 * acceleration term is shrunk toward neutral by n ÷ (n + 10).
 */
export function socialHeat(posts: PostLike[], now: number): SocialHeat {
  const DAY = 86_400_000;
  const eng = (p: PostLike) => Math.max(0, p.views ?? 0) + 20 * Math.max(0, p.likes ?? 0) + 1; // +1: a post is a signal on its own
  const recent = posts.filter((p) => now - p.at <= 2 * DAY);
  const before = posts.filter((p) => now - p.at > 2 * DAY && now - p.at <= 7 * DAY);
  const rateRecent = recent.reduce((s, p) => s + eng(p), 0) / 2;
  const rateBefore = before.reduce((s, p) => s + eng(p), 0) / 5;
  const acceleration = (rateRecent + 1) / (rateBefore + 1);
  const views = posts.reduce((s, p) => s + Math.max(0, p.views ?? 0), 0);
  const likes = posts.reduce((s, p) => s + Math.max(0, p.likes ?? 0), 0);
  const volume = Math.min(1, Math.log10(1 + views + 20 * likes) / 7);
  const shrink = posts.length / (posts.length + 10);
  const accel = 0.5 + shrink * 0.5 * Math.tanh(Math.log2(acceleration));
  const byDayMap = new Map<string, { posts: number; views: number }>();
  for (const p of posts) {
    const day = new Date(p.at).toISOString().slice(0, 10);
    const d = byDayMap.get(day) ?? { posts: 0, views: 0 };
    d.posts++; d.views += Math.max(0, p.views ?? 0);
    byDayMap.set(day, d);
  }
  return {
    score: posts.length ? 100 * (0.5 * volume + 0.5 * accel) : 0,
    posts: posts.length, views, likes, acceleration,
    byDay: [...byDayMap.entries()].map(([day, v]) => ({ day, ...v })).sort((a, b) => a.day.localeCompare(b.day)),
  };
}

// ----------------------------------------------------------- DCA overhang

export interface DcaOrderLike {
  active: boolean;
  /** This token is what the order sells (input) or buys (output). */
  side: 'sell' | 'buy';
  depositUsd: number | null;
  depositAmount: number | null;
  depositSpent: number | null;
}

export interface DcaOverhang {
  score: number;
  sellRemainingUsd: number;
  buyRemainingUsd: number;
  activeSell: number;
  activeBuy: number;
  /** (sell − buy remaining) ÷ 24h volume. */
  ratio: number;
}

/**
 * DCA overhang: what open Jupiter DCA orders still have to sell (or buy)
 * of this token, against its daily volume. Remaining = deposit × (1 −
 * spent ÷ deposit), in USD at deposit value. Score = 50 + 50·tanh(ratio ÷
 * 0.05): 50 when buy and sell ladders balance, ~88 when net sell orders
 * waiting to execute equal 5% of a day's volume.
 */
export function dcaOverhang(orders: DcaOrderLike[], volume24hUsd: number | null): DcaOverhang | null {
  if (!volume24hUsd || volume24hUsd <= 0) return null;
  let sell = 0, buy = 0, activeSell = 0, activeBuy = 0;
  for (const o of orders) {
    if (!o.active || !o.depositUsd || !o.depositAmount || o.depositAmount <= 0) continue;
    const left = Math.max(0, Math.min(1, 1 - (o.depositSpent ?? 0) / o.depositAmount));
    if (o.side === 'sell') { sell += o.depositUsd * left; activeSell++; } else { buy += o.depositUsd * left; activeBuy++; }
  }
  const ratio = (sell - buy) / volume24hUsd;
  return { score: 50 + 50 * Math.tanh(ratio / 0.05), sellRemainingUsd: sell, buyRemainingUsd: buy, activeSell, activeBuy, ratio };
}

// -------------------------------------------------- position tide gauge

export interface CohortPosition { cohort: 'smart_trader' | 'whale' | 'public_figure'; longsUsd: number; shortsUsd: number; longShare: number | null }

/** Hyperliquid positions by cohort → long share (longs ÷ (longs + shorts)). */
export function positionGauge(row: Record<string, number | null | undefined>): CohortPosition[] {
  return (['smart_trader', 'whale', 'public_figure'] as const).map((cohort) => {
    const longsUsd = Math.max(0, row[`${cohort}_longs_usd`] ?? 0);
    const shortsUsd = Math.max(0, row[`${cohort}_shorts_usd`] ?? 0);
    const total = longsUsd + shortsUsd;
    return { cohort, longsUsd, shortsUsd, longShare: total > 0 ? longsUsd / total : null };
  });
}
