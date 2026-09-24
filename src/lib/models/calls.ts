// Call cards (L1): a saved decision on a token, graded later from Nansen's own
// price candles. Rules are fixed in advance and stated on every card, so a
// grade can't be argued after the fact.
export type Stance = 'bull' | 'bear' | 'pass';
export type Horizon = '1h' | '24h' | '7d';
export type Grade = 'won' | 'lost' | 'too-early' | 'invalidated';
export const SETUPS = ['smart-money flow', 'storm / risk', 'rotation', 'divergence', 'momentum', 'other'] as const;
export type Setup = (typeof SETUPS)[number];

/** Candle size for grading and the move that counts as decisive, per horizon.
 *  Nansen's 5m candles report high = low = close, so grading reads closes only. */
export const HORIZONS: Record<Horizon, { ms: number; timeframe: '5m' | '1h' | '4h'; band: number }> = {
  '1h': { ms: 3_600_000, timeframe: '5m', band: 0.01 },
  '24h': { ms: 86_400_000, timeframe: '1h', band: 0.03 },
  '7d': { ms: 7 * 86_400_000, timeframe: '4h', band: 0.07 },
};

export interface GradeInput { stance: Stance; entry: number; invalidation: number | null; createdAt: number; dueAt: number; band: number }
export interface GradeResult { grade: Grade; exit: number; exitAt: number; ret: number; best: number; worst: number; invalidatedAt: number | null; candles: number }

/** Why the call's invalidation is on the wrong side, or null when it's usable. */
export function invalidationProblem(stance: Stance, entry: number, invalidation: number | null): string | null {
  if (invalidation == null) return null;
  if (!(invalidation > 0) || !Number.isFinite(invalidation)) return 'The invalidation must be a positive price.';
  if (stance === 'pass') return 'A pass has no invalidation.';
  if (stance === 'bull' && invalidation >= entry) return 'A bull call is invalidated below the entry price.';
  if (stance === 'bear' && invalidation <= entry) return 'A bear call is invalidated above the entry price.';
  return null;
}

/** Grades against candle closes strictly after the call and up to its due time.
 *  Returns null when Nansen has no candle in the window yet. */
export function gradeCall(c: GradeInput, candles: Array<{ t: number; c: number }>): GradeResult | null {
  const path = candles.filter((x) => x.t >= c.createdAt && x.t < c.dueAt && Number.isFinite(x.c) && x.c > 0).sort((a, b) => a.t - b.t);
  if (!path.length || !(c.entry > 0)) return null;
  const dir = c.stance === 'bear' ? -1 : 1;
  const moves = path.map((x) => dir * (x.c / c.entry - 1));
  const hit = c.invalidation == null || c.stance === 'pass' ? undefined
    : path.find((x) => (c.stance === 'bull' ? x.c <= c.invalidation! : x.c >= c.invalidation!));
  const last = path[path.length - 1];
  const ret = last.c / c.entry - 1;
  let grade: Grade;
  if (hit) grade = 'invalidated';
  else if (c.stance === 'pass') grade = Math.abs(ret) < c.band ? 'won' : 'lost';
  else if (dir * ret >= c.band) grade = 'won';
  else if (dir * ret <= -c.band) grade = 'lost';
  else grade = 'too-early';
  return { grade, exit: last.c, exitAt: last.t, ret, best: Math.max(...moves), worst: Math.min(...moves), invalidatedAt: hit?.t ?? null, candles: path.length };
}

export interface DnaRow { key: string; n: number; won: number; lost: number; tooEarly: number; invalidated: number; hitRate: number | null; avgMove: number | null }

/** "Trader DNA": hit rate per setup (or horizon). Hit rate counts decisive
 *  outcomes only (won ÷ won + lost + invalidated); too-early is shown apart. */
export function traderDna<T extends { grade: Grade | null; stance: Stance; ret: number | null }>(calls: T[], keyOf: (c: T) => string): DnaRow[] {
  const groups = new Map<string, T[]>();
  for (const c of calls) if (c.grade) groups.set(keyOf(c), [...(groups.get(keyOf(c)) ?? []), c]);
  return [...groups].map(([key, cs]) => {
    const count = (g: Grade) => cs.filter((c) => c.grade === g).length;
    const won = count('won'), lost = count('lost'), invalidated = count('invalidated');
    const decisive = won + lost + invalidated;
    const directional = cs.filter((c) => c.stance !== 'pass' && c.ret != null);
    return {
      key, n: cs.length, won, lost, tooEarly: count('too-early'), invalidated,
      hitRate: decisive ? won / decisive : null,
      avgMove: directional.length ? directional.reduce((s, c) => s + (c.stance === 'bear' ? -1 : 1) * c.ret!, 0) / directional.length : null,
    };
  }).sort((a, b) => b.n - a.n || a.key.localeCompare(b.key));
}
