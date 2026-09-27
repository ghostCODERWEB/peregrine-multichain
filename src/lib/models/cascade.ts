// Smart Money Cascades: the order in which labeled Smart Money wallets enter the same token, and whether
// any wallet enters earlier (or later) than chance across many tokens. Pure functions, no I/O.
//
// Episode: one token's first buys by distinct Smart Money wallets within WINDOW of an episode start; a new
// episode starts at the first Smart Money buy after the previous window closed. Within an episode each wallet gets a normalised entry rank r = (rank-1)/(k-1):
// 0 = first in, 1 = last in. Under the null hypothesis (entry order is random), r is uniform on
// {0, 1/(k-1), ..., 1} with mean 1/2 and variance (k+1)/(12(k-1)).

import { addressKey } from './portfolio';

export interface Buy { wallet: string; label: string | null; token: string; chain: string; symbol: string | null; at: number; usd: number }
export interface EpisodeEntry { wallet: string; label: string | null; at: number; usd: number; rank: number; r: number }
export interface Episode { chain: string; token: string; symbol: string | null; start: number; entries: EpisodeEntry[] }
export interface WalletStat {
  wallet: string; label: string | null;
  episodes: number; meanR: number; z: number; p: number; firsts: number;
  role: 'leader' | 'follower' | 'mixed';
  medianLeadMin: number | null; // median minutes ahead of the episode's median entrant (positive = earlier)
}
export interface Edge { from: string; to: string; wins: number; n: number; p: number; medianGapMin: number; tokens: string[] }

export const WINDOW_MS = 72 * 3_600_000;
const TIE_MS = 60_000;

/** Group buys into episodes: per token, each wallet's first buy within WINDOW of the token's first Smart Money buy. */
export function buildEpisodes(buys: Buy[], minWallets = 3): Episode[] {
  const byToken = new Map<string, Buy[]>();
  for (const b of buys) { const k = `${b.chain}|${addressKey(b.token)}`; (byToken.get(k) ?? byToken.set(k, []).get(k)!).push(b); }
  const out: Episode[] = [];
  for (const list of byToken.values()) {
    list.sort((a, b) => a.at - b.at);
    // Rolling episodes: each starts at the first Smart Money buy after the previous window closed.
    let i = 0;
    while (i < list.length) {
      const start = list[i].at;
      const first = new Map<string, Buy>();
      while (i < list.length && list[i].at - start <= WINDOW_MS) {
        const b = list[i++];
        const cur = first.get(b.wallet);
        if (!cur) first.set(b.wallet, { ...b }); else cur.usd += b.usd;
      }
      if (first.size < minWallets) continue;
      const ordered = [...first.values()].sort((x, y) => x.at - y.at);
      const k = ordered.length;
      out.push({
        chain: ordered[0].chain, token: ordered[0].token, symbol: ordered.find((x) => x.symbol)?.symbol ?? null, start,
        entries: ordered.map((x, j) => ({ wallet: x.wallet, label: x.label, at: x.at, usd: x.usd, rank: j + 1, r: j / (k - 1) })),
      });
    }
  }
  return out.sort((a, b) => b.entries.length - a.entries.length);
}

/** Standard normal CDF (Abramowitz-Stegun 7.1.26). */
export function phi(z: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return z >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}

/** Two-sided binomial test p-value for `wins` of `n` at p = 1/2 (exact). */
export function binomTwoSided(wins: number, n: number): number {
  if (n === 0) return 1;
  const lg = (x: number) => { let s = 0; for (let i = 2; i <= x; i++) s += Math.log(i); return s; };
  const pmf = (k: number) => Math.exp(lg(n) - lg(k) - lg(n - k) - n * Math.LN2);
  const obs = pmf(wins);
  let p = 0;
  for (let k = 0; k <= n; k++) { const q = pmf(k); if (q <= obs + 1e-12) p += q; }
  return Math.min(1, p);
}

const median = (xs: number[]) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/** Per-wallet leadership: is its mean entry rank earlier than random ordering would give? */
export function walletStats(episodes: Episode[], minEpisodes = 3): WalletStat[] {
  const acc = new Map<string, { label: string | null; rs: number[]; vars: number[]; firsts: number; leads: number[] }>();
  for (const e of episodes) {
    const k = e.entries.length, v = (k + 1) / (12 * (k - 1));
    const medAt = median(e.entries.map((x) => x.at));
    for (const x of e.entries) {
      const a = acc.get(x.wallet) ?? { label: x.label, rs: [], vars: [], firsts: 0, leads: [] };
      a.rs.push(x.r); a.vars.push(v); if (x.rank === 1) a.firsts++; a.leads.push((medAt - x.at) / 60_000);
      if (!a.label && x.label) a.label = x.label;
      acc.set(x.wallet, a);
    }
  }
  return [...acc.entries()].filter(([, a]) => a.rs.length >= minEpisodes).map(([wallet, a]) => {
    const n = a.rs.length, meanR = a.rs.reduce((s, r) => s + r, 0) / n;
    const se = Math.sqrt(a.vars.reduce((s, v) => s + v, 0)) / n;
    const z = (0.5 - meanR) / se; // positive = earlier than chance
    const p = 2 * (1 - phi(Math.abs(z)));
    return { wallet, label: a.label, episodes: n, meanR, z, p, firsts: a.firsts, role: z >= 1.96 ? 'leader' : z <= -1.96 ? 'follower' : 'mixed', medianLeadMin: median(a.leads) } as WalletStat;
  }).sort((a, b) => b.z - a.z);
}

/** Directed precedence between wallet pairs that co-entered at least `minN` tokens: A→B when A entered first more often than chance. */
export function precedenceEdges(episodes: Episode[], minN = 3, alpha = 0.1): Edge[] {
  const pairs = new Map<string, { wins: number; n: number; gaps: number[]; tokens: string[] }>();
  for (const e of episodes) {
    for (let i = 0; i < e.entries.length; i++) for (let j = i + 1; j < e.entries.length; j++) {
      const a = e.entries[i], b = e.entries[j];
      if (b.at - a.at < TIE_MS) continue; // near-simultaneous: no evidence of order
      const [x, y] = a.wallet < b.wallet ? [a.wallet, b.wallet] : [b.wallet, a.wallet];
      const key = `${x}|${y}`;
      const s = pairs.get(key) ?? { wins: 0, n: 0, gaps: [], tokens: [] };
      s.n++; if (a.wallet === x) s.wins++;
      s.gaps.push((b.at - a.at) / 60_000 * (a.wallet === x ? 1 : -1));
      s.tokens.push(e.symbol ?? e.token.slice(0, 6));
      pairs.set(key, s);
    }
  }
  const out: Edge[] = [];
  for (const [key, s] of pairs) {
    if (s.n < minN) continue;
    const p = binomTwoSided(s.wins, s.n);
    if (p > alpha) continue;
    const [x, y] = key.split('|');
    const xLeads = s.wins * 2 > s.n;
    out.push({ from: xLeads ? x : y, to: xLeads ? y : x, wins: xLeads ? s.wins : s.n - s.wins, n: s.n, p, medianGapMin: Math.abs(median(s.gaps.map((g) => (xLeads ? g : -g)))), tokens: [...new Set(s.tokens)] });
  }
  return out.sort((a, b) => a.p - b.p || b.n - a.n);
}

/** Benjamini-Hochberg: how many leader calls survive a false-discovery rate of q across all wallets tested. */
export function fdrSurvivors(ps: number[], q = 0.1): number {
  const s = [...ps].sort((a, b) => a - b);
  let k = 0;
  s.forEach((p, i) => { if (p <= ((i + 1) / s.length) * q) k = i + 1; });
  return k;
}
