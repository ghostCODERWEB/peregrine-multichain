// Natural-language terminal commands → explicit UI state. Deterministic and
// transparent: the applied changes are echoed back; anything that is not an
// imperative command goes to the Nansen agent instead. No credits spent.
import type { Cohort, Side } from './positions';

export interface ActionPatch {
  cohort?: Cohort | 'all';
  side?: Side | 'both';
  minLeverage?: number;
  minUsd?: number;
  range?: number;
  tab?: 'positions' | 'proximity' | 'changes' | 'cohorts' | 'leverage' | 'entries' | 'trades' | 'leaders' | 'consensus';
  win?: '15m' | '1h' | '4h' | '24h' | '7d';
}
export interface ParsedAction { patch: ActionPatch; navigate?: string; applied: string[] }

const IMPERATIVE = /^(show|only|switch|open|filter|focus|highlight|compare|go to|list|display)\b/i;
const snap = (v: number, options: number[]) => options.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));

export function parseAction(text: string, coins: string[]): ParsedAction | null {
  const t = text.trim();
  if (!IMPERATIVE.test(t)) return null;
  const low = t.toLowerCase();
  const patch: ActionPatch = {};
  const applied: string[] = [];
  const wallet = t.match(/0x[a-fA-F0-9]{40}/);
  if (/\bopen\b/i.test(t) && wallet) return { patch, navigate: `/wallet/${wallet[0]}`, applied: [`Open wallet ${wallet[0].slice(0, 8)}…`] };
  const coin = t.match(/\b(?:switch to|go to|open)\s+([A-Za-z0-9:]{2,12})\b/i)?.[1]?.toUpperCase();
  if (coin && coins.includes(coin)) return { patch, navigate: `/perps/${encodeURIComponent(coin)}`, applied: [`Switch to ${coin}`] };
  if (/smart money|\bsm\b/.test(low)) { patch.cohort = 'smart_money'; applied.push('Smart Money'); }
  else if (/whale/.test(low)) { patch.cohort = 'whale'; applied.push('Whales'); }
  else if (/public figure/.test(low)) { patch.cohort = 'public_figure'; applied.push('Public figures'); }
  else if (/\ball (traders|cohorts)\b|everyone/.test(low)) { patch.cohort = 'all'; applied.push('All traders'); }
  if (/\blongs?\b/.test(low) && !/\bshorts?\b/.test(low)) { patch.side = 'long'; applied.push('Longs'); }
  else if (/\bshorts?\b/.test(low) && !/\blongs?\b/.test(low)) { patch.side = 'short'; applied.push('Shorts'); }
  const lev = low.match(/(\d+(?:\.\d+)?)\s*x\b/);
  if (lev) { patch.minLeverage = snap(Number(lev[1]), [1, 5, 10, 20]); applied.push(`${patch.minLeverage}x+`); }
  const size = low.match(/(?:above|over|>|at least)\s*\$?\s*(\d+(?:\.\d+)?)\s*(k|m|b)?/);
  if (size) { const v = Number(size[1]) * ({ k: 1e3, m: 1e6, b: 1e9 }[size[2] as 'k' | 'm' | 'b'] ?? 1); patch.minUsd = snap(v, [0, 100_000, 1_000_000]); applied.push(patch.minUsd ? `$${patch.minUsd >= 1e6 ? '1M' : '100K'}+` : 'any size'); }
  const within = low.match(/within\s*(\d+(?:\.\d+)?)\s*%/);
  if (within) { patch.range = snap(Number(within[1]) / 100, [0.05, 0.1, 0.25]); applied.push(`±${patch.range * 100}% of price`); if (/liquidat/.test(low)) patch.tab = 'proximity'; }
  if (/what changed|changes?\b/.test(low)) { patch.tab = 'changes'; applied.push('What changed'); }
  else if (/closest to liquidation|near(est)? liquidation/.test(low)) { patch.tab = 'proximity'; applied.push('Nearest to liquidation'); }
  else if (/compare|vs|versus/.test(low)) { patch.tab = 'cohorts'; applied.push('Smart Money vs crowd'); }
  else if (/profitable|pnl|leaders?/.test(low)) { patch.tab = 'leaders'; applied.push('PnL leaders'); }
  else if (/leverage/.test(low) && !lev) { patch.tab = 'leverage'; applied.push('Leverage distribution'); }
  else if (/entr(y|ies)/.test(low)) { patch.tab = 'entries'; applied.push('Entry distribution'); }
  else if (/trades?\b/.test(low)) { patch.tab = 'trades'; applied.push('Trades'); }
  const win = low.match(/\b(15m|1h|4h|24h|7d)\b/)?.[1] as ActionPatch['win'];
  if (win) { patch.win = win; applied.push(`vs ${win}`); }
  return applied.length ? { patch, applied } : null;
}
