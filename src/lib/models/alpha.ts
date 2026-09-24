// Alpha: "what to look at", scored token by token from numbers already on
// the page. A shortlist, not a forecast: every point comes from a named
// component shown next to the score, nothing is weighted by an invisible
// coefficient, and no component scores something the board doesn't print.
// Its track record is measured by the Forecast Lab once history allows.

export interface AlphaPart { id: string; label: string; points: number; detail: string }

export interface AlphaInput {
  /** Net flow ÷ volume over `flowWindow`. */
  flowShare: number | null;
  /** Which window flowShare covers (24h when the scanner has it, else 1h). */
  flowWindow?: '24h' | '1h';
  /** 1h net flow ÷ volume per scan, oldest first (up to 12). */
  hourly: number[];
  /** Smart-money net flow ÷ all-trader volume, 24h; null in public views. */
  smartShare: number | null;
  liquidityUsd: number | null;
  priceChange24h: number | null;
  stormScore: number | null;
  ageDays: number | null;
}

const clamp = (n: number, lo: number, hi: number) => Math.round(Math.max(lo, Math.min(hi, n)));
const pct = (n: number) => `${n >= 0 ? '+' : ''}${(n * 100).toFixed(1)}%`;
const usdShort = (n: number) => (n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${n.toFixed(0)}`);

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** 50 is "nothing to see"; points push it up (worth a look) or down. */
export function alphaScore(x: AlphaInput): { score: number; parts: AlphaPart[] } {
  const parts: AlphaPart[] = [];

  // 1. Where the money is going, against how much trades. A smooth curve
  //    that saturates late, so a 90% share still outranks a 70% one (an
  //    hourly window often shows shares that high) instead of tying at a cap.
  if (x.flowShare != null) {
    parts.push({ id: 'flow', label: 'Net buying', points: clamp(25 * Math.tanh(x.flowShare / 0.5), -25, 25), detail: `${pct(x.flowShare)} of volume, ${x.flowWindow ?? '24h'}` });
  }

  // 2. Whether it keeps going that way, hour after hour.
  if (x.hourly.length >= 4) {
    const up = x.hourly.filter((h) => h > 0).length / x.hourly.length;
    parts.push({ id: 'persistence', label: 'Persistence', points: clamp((up - 0.5) * 30, -15, 15), detail: `net buying in ${Math.round(up * x.hourly.length)} of the last ${x.hourly.length} scans` });
  }

  // 3. Whether the latest hour is stronger than its own recent run.
  if (x.hourly.length >= 4) {
    const last = x.hourly.at(-1)!, base = median(x.hourly.slice(0, -1));
    parts.push({ id: 'acceleration', label: 'Acceleration', points: clamp((last - base) * 80, -10, 10), detail: `latest hour ${pct(last)} vs ${pct(base)} median` });
  }

  // 4. What Nansen-labelled smart money is doing (key owner's view only).
  if (x.smartShare != null) {
    parts.push({ id: 'smart', label: 'Smart money', points: clamp(20 * Math.tanh(x.smartShare / 0.1), -20, 20), detail: `${pct(x.smartShare)} of volume, 24h` });
  }

  // 5. Whether there is depth to get out through.
  if (x.liquidityUsd != null) {
    const pts = x.liquidityUsd < 50_000 ? -20 : x.liquidityUsd < 250_000 ? -8 : 0;
    if (pts) parts.push({ id: 'liquidity', label: 'Thin liquidity', points: pts, detail: `${usdShort(x.liquidityUsd)} in pools` });
  }

  // 6. Whether the move is already done.
  if (x.priceChange24h != null) {
    if (x.priceChange24h > 0.6) parts.push({ id: 'extended', label: 'Already extended', points: -10, detail: `${pct(x.priceChange24h)} in 24h` });
    else if (x.priceChange24h < -0.35) parts.push({ id: 'falling', label: 'Falling hard', points: -6, detail: `${pct(x.priceChange24h)} in 24h` });
  }

  // 7. TIDE's own dump-risk reading, when the token has one.
  if (x.stormScore != null) {
    if (x.stormScore >= 60) parts.push({ id: 'storm', label: 'Storm warning', points: -15, detail: `Storm Score ${x.stormScore.toFixed(0)}` });
    else if (x.stormScore <= 30) parts.push({ id: 'calm', label: 'Calm Storm reading', points: 4, detail: `Storm Score ${x.stormScore.toFixed(0)}` });
  }

  // 8. Whether it has any history at all.
  if (x.ageDays != null && x.ageDays >= 0 && x.ageDays < 2) {
    parts.push({ id: 'new', label: 'Brand new', points: -6, detail: `${(x.ageDays * 24).toFixed(0)}h old` });
  }

  const score = clamp(50 + parts.reduce((s, p) => s + p.points, 0), 0, 100);
  return { score, parts: parts.sort((a, b) => Math.abs(b.points) - Math.abs(a.points)) };
}
