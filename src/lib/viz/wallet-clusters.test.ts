import { describe, it, expect } from 'vitest';
import { clusterGraph } from './wallet-clusters';
import type { GraphLink, GraphNode } from '@/server/graph/series';

const w = (i: number): GraphNode => ({ id: `w:${i}`, name: `w${i}`, kind: 'wallet', value: 100 - i, href: '/' });
const m = (s: string): GraphNode => ({ id: `p:${s}`, name: `${s} perp`, kind: 'perp', value: 1000, href: '/' });
const l = (i: number, s: string, side: string, value = 10): GraphLink => ({ source: `w:${i}`, target: `p:${s}`, side, value });

describe('clusterGraph', () => {
  const nodes = [m('BTC'), m('ETH'), ...Array.from({ length: 6 }, (_, i) => w(i))];
  const links = [0, 1, 2].flatMap((i) => [l(i, 'BTC', 'long'), l(i, 'ETH', 'long')]).concat([3, 4].flatMap((i) => [l(i, 'BTC', 'long'), l(i, 'ETH', 'short')]), [l(5, 'BTC', 'short'), l(5, 'ETH', 'short')]);
  const g = clusterGraph(nodes, links);
  it('groups wallets by the same position pattern', () => {
    expect(g.clusters.map((c) => c.wallets.length).sort()).toEqual([1, 2, 3]);
    expect(g.clusters[0].label).toBe('Long BTC perp + ETH perp');
    expect(g.clusters.find((c) => c.wallets.length === 2)!.label).toBe('Long BTC perp · Short ETH perp');
  });
  it('places every wallet inside its cluster and keeps clusters apart', () => {
    for (const x of g.wallets) { const c = g.clusters.find((k) => k.id === x.cluster)!; expect(Math.hypot(x.x - c.x, x.y - c.y)).toBeLessThanOrEqual(c.r); }
    for (const a of g.clusters) for (const b of g.clusters) if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(a.r + b.r);
  });
});
