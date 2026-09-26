'use client';
// Terminal state lives in the URL, so Back and Forward restore the exact
// view (cohort, side, selected liquidation band, tab, window) and every view
// can be shared. Filter changes replace the entry; opening another object is
// a normal navigation, so returning lands on this same state.
import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { Cohort, Side } from '@/lib/perps/positions';

export type Tab = 'consensus' | 'leaders' | 'positions' | 'proximity' | 'leverage' | 'entries' | 'trades' | 'changes' | 'cohorts';
export const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'positions', label: 'Positions' },
  { key: 'proximity', label: 'Near liquidation' },
  { key: 'consensus', label: 'Trader map' },
  { key: 'changes', label: 'What changed' },
  { key: 'cohorts', label: 'Smart Money vs crowd' },
  { key: 'leverage', label: 'Leverage' },
  { key: 'entries', label: 'Entries' },
  { key: 'trades', label: 'Trades' },
  { key: 'leaders', label: 'PnL leaders' },
];
export type WindowKey = '15m' | '1h' | '4h' | '24h' | '7d';
export const WINDOWS: WindowKey[] = ['15m', '1h', '4h', '24h', '7d'];

export interface TerminalState {
  cohort: Cohort | 'all';
  side: Side | 'both';
  bandPct: number;
  /** Radar range: ± fraction of the mark. */
  range: number;
  minLeverage: number;
  minUsd: number;
  band: { lo: number; hi: number } | null;
  entry: { lo: number; hi: number } | null;
  tab: Tab;
  win: WindowKey;
  /** Position Replay: a stored snapshot time (ms), or null for live. */
  at: number | null;
}

const range = (v: string | null) => {
  if (!v) return null;
  const [lo, hi] = v.split('_').map(Number);
  return Number.isFinite(lo) && Number.isFinite(hi) && hi > lo ? { lo, hi } : null;
};

export function useTerminalState() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const state: TerminalState = useMemo(() => ({
    cohort: (['smart_money', 'whale', 'public_figure'].includes(params.get('cohort') ?? '') ? params.get('cohort') : 'all') as TerminalState['cohort'],
    side: (params.get('side') === 'long' || params.get('side') === 'short' ? params.get('side') : 'both') as TerminalState['side'],
    bandPct: [0.0025, 0.005, 0.01].includes(Number(params.get('bw'))) ? Number(params.get('bw')) : 0.005,
    range: [0.05, 0.1, 0.25].includes(Number(params.get('range'))) ? Number(params.get('range')) : 0.1,
    minLeverage: Number(params.get('lev')) || 1,
    minUsd: Number(params.get('min')) || 0,
    band: range(params.get('band')),
    entry: range(params.get('entry')),
    tab: (TABS.some((t) => t.key === params.get('tab')) ? params.get('tab') : 'positions') as Tab,
    win: (WINDOWS.includes(params.get('win') as WindowKey) ? params.get('win') : '1h') as WindowKey,
    at: Number(params.get('at')) > 0 ? Number(params.get('at')) : null,
  }), [params]);

  const set = useCallback((patch: Partial<Record<keyof TerminalState, string | number | { lo: number; hi: number } | null>>, push = false) => {
    const next = new URLSearchParams(params.toString());
    const key: Record<string, string> = { at: 'at', range: 'range', cohort: 'cohort', side: 'side', bandPct: 'bw', minLeverage: 'lev', minUsd: 'min', band: 'band', entry: 'entry', tab: 'tab', win: 'win' };
    const defaults: Record<string, string> = { range: '0.1', cohort: 'all', side: 'both', bw: '0.005', lev: '1', min: '0', tab: 'positions', win: '1h' };
    for (const [k, v] of Object.entries(patch)) {
      const name = key[k];
      const str = v == null ? '' : typeof v === 'object' ? `${v.lo}_${v.hi}` : String(v);
      if (!str || defaults[name] === str) next.delete(name); else next.set(name, str);
    }
    const q = next.toString();
    const url = q ? `${pathname}?${q}` : pathname;
    if (push) router.push(url, { scroll: false }); else router.replace(url, { scroll: false });
  }, [params, pathname, router]);

  return { state, set };
}
