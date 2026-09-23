import { describe, it, expect } from 'vitest';
import { clusterHolders } from './wallet-clustering';
import { insiderScore } from './storm-score';

const H = (address: string, share: number) => ({ address, share });

describe('clusterHolders', () => {
  it('leaves unlinked holders as singletons with nothing clustered', () => {
    const r = clusterHolders([H('0xA', 0.1), H('0xB', 0.05)], { firstFunder: new Map(), related: new Map(), deployer: null });
    expect(r.clusters).toHaveLength(2);
    expect(r.clusteredHolderCount).toBe(0);
  });

  it('joins holders that share a first funder, case-insensitively', () => {
    const r = clusterHolders([H('0xA', 0.1), H('0xB', 0.05), H('0xC', 0.02)], {
      firstFunder: new Map([['0xa', '0xF'], ['0xb', '0xf']]),
      related: new Map(),
      deployer: null,
    });
    expect(r.clusters[0].wallets.sort()).toEqual(['0xA', '0xB']);
    expect(r.clusters[0].share).toBeCloseTo(0.15);
    expect(r.clusters[0].links[0]).toMatchObject({ reason: 'first-funder', via: '0xf' });
    expect(r.clusteredHolderCount).toBe(2);
  });

  it('joins through related wallets, directly or via a shared outside address', () => {
    const r = clusterHolders([H('0xA', 0.1), H('0xB', 0.05), H('0xC', 0.02), H('0xD', 0.01)], {
      firstFunder: new Map(),
      related: new Map([['0xa', ['0xb']], ['0xc', ['0xZ']], ['0xd', ['0xz']]]),
      deployer: null,
    });
    const sets = r.clusters.map((c) => c.wallets.slice().sort().join(','));
    expect(sets).toContain('0xA,0xB');
    expect(sets).toContain('0xC,0xD');
    expect(r.clusteredHolderCount).toBe(4);
  });

  it('is transitive: A~B by funder and B~C by relation puts all three together', () => {
    const r = clusterHolders([H('0xA', 0.1), H('0xB', 0.05), H('0xC', 0.02)], {
      firstFunder: new Map([['0xa', '0xf'], ['0xb', '0xf']]),
      related: new Map([['0xb', ['0xc']]]),
      deployer: null,
    });
    expect(r.clusters[0].wallets).toHaveLength(3);
  });

  it('marks a cluster the deployer funded and joins every holder it touched', () => {
    const r = clusterHolders([H('0xA', 0.1), H('0xB', 0.05), H('0xC', 0.02)], {
      firstFunder: new Map([['0xa', '0xDEP']]),
      related: new Map([['0xb', ['0xdep']]]),
      deployer: '0xdep',
    });
    expect(r.clusters[0].wallets.sort()).toEqual(['0xA', '0xB']);
    expect(r.clusters[0].includesDeployer).toBe(true);
    expect(r.clusters[1].includesDeployer).toBe(false);
  });

  it('feeds insiderScore: clustered supply raises I, singletons do not', () => {
    const r = clusterHolders([H('0xA', 0.2), H('0xB', 0.1), H('0xC', 0.3)], {
      firstFunder: new Map([['0xa', '0xf'], ['0xb', '0xf']]),
      related: new Map(),
      deployer: null,
    });
    const multi = r.clusters.filter((c) => c.wallets.length >= 2);
    const I = insiderScore({ clusters: multi, clusteredHolderCount: r.clusteredHolderCount });
    expect(I.maxClusterShare).toBeCloseTo(0.3); // the A+B cluster, not the 0.3 singleton C
    expect(I.score).toBeCloseTo(100 * (1.6 * 0.3 + 0.02 * 2));
  });
});
