import { describe, it, expect } from 'vitest';
import { filterGraph, isMajor } from './IntelCharts';
import type { GraphLink, GraphNode } from '@/server/graph/series';

const m = (id: string, name: string, kind: 'perp' | 'token' = 'perp'): GraphNode => ({ id, name, kind, value: 0, href: '/' });
const w = (i: number): GraphNode => ({ id: `w:${i}`, name: `w${i}`, kind: 'wallet', value: 1, href: '/' });

describe('wallet graph market filter', () => {
  it('treats BTC, ETH, SOL and wrapped forms as majors, not small caps', () => {
    expect([m('p:BTC', 'BTC perp'), m('p:ETH', 'ETH perp'), m('t:1', 'WETH', 'token'), m('t:2', 'cbBTC', 'token')].every(isMajor)).toBe(true);
    expect(isMajor(m('p:FARTCOIN', 'FARTCOIN perp'))).toBe(false);
    expect(isMajor(w(1))).toBe(false);
  });
  it('keeps only ties to the chosen markets and drops wallets left with none', () => {
    const nodes = [m('p:BTC', 'BTC perp'), m('p:PEPE', 'PEPE perp'), w(1), w(2)];
    const links: GraphLink[] = [
      { source: 'w:1', target: 'p:BTC', value: 10, side: 'long' },
      { source: 'w:1', target: 'p:PEPE', value: 5, side: 'short' },
      { source: 'w:2', target: 'p:PEPE', value: 7, side: 'long' },
    ];
    const g = filterGraph(nodes, links, new Set(['p:BTC']));
    expect(g.links).toHaveLength(1);
    expect(g.nodes.map((n) => n.id).sort()).toEqual(['p:BTC', 'w:1']);
    expect(g.nodes.find((n) => n.id === 'p:BTC')!.value).toBe(10);
  });
});
