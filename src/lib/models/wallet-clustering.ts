// Insider clusters (5.3 I): union-find over the top holders, joining two
// holders when Nansen links them — the same first funder (who sent the
// wallet its first gas, resolved across chains), or one appearing in the
// other's related-wallets. The deployer (related-wallets "Deployed by" on
// the token contract) marks any cluster it touches.
import type { HolderCluster } from './storm-score';

export interface ClusterHolder {
  address: string;
  /** Fraction of total supply, 0-1. */
  share: number;
}

export interface ClusterEvidence {
  /** holder -> its first funder address (lower-cased), when Nansen has one. */
  firstFunder: Map<string, string>;
  /** holder -> addresses Nansen lists as related to it. */
  related: Map<string, string[]>;
  deployer: string | null;
}

export interface ClusterLink {
  a: string;
  b: string;
  reason: 'first-funder' | 'related' | 'deployer';
  /** The shared funder, or the related address that joined them. */
  via: string;
}

export interface ClusteringResult {
  clusters: Array<HolderCluster & { id: number; links: ClusterLink[] }>;
  /** Holders that ended up in a cluster of two or more. */
  clusteredHolderCount: number;
}

class UnionFind {
  private parent = new Map<string, string>();
  find(x: string): string {
    if (!this.parent.has(x)) this.parent.set(x, x);
    let root = x;
    while (this.parent.get(root) !== root) root = this.parent.get(root)!;
    let cur = x;
    while (cur !== root) { const next = this.parent.get(cur)!; this.parent.set(cur, root); cur = next; }
    return root;
  }
  union(a: string, b: string): void {
    const ra = this.find(a), rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

const norm = (a: string) => a.toLowerCase();

export function clusterHolders(holders: ClusterHolder[], ev: ClusterEvidence): ClusteringResult {
  const uf = new UnionFind();
  const inSet = new Set(holders.map((h) => norm(h.address)));
  const links: ClusterLink[] = [];
  const deployer = ev.deployer ? norm(ev.deployer) : null;
  for (const h of holders) uf.find(norm(h.address));

  // Shared first funder. A funder that is itself a holder links directly.
  const byFunder = new Map<string, string[]>();
  for (const h of holders) {
    const f = ev.firstFunder.get(norm(h.address));
    if (!f) continue;
    const fn = norm(f);
    byFunder.set(fn, [...(byFunder.get(fn) ?? []), norm(h.address)]);
    if (inSet.has(fn) && fn !== norm(h.address)) {
      uf.union(norm(h.address), fn);
      links.push({ a: fn, b: norm(h.address), reason: 'first-funder', via: fn });
    }
  }
  for (const [funder, members] of byFunder) {
    for (let i = 1; i < members.length; i++) {
      uf.union(members[0], members[i]);
      links.push({ a: members[0], b: members[i], reason: 'first-funder', via: funder });
    }
  }

  // Related wallets: a holder directly related to another holder, or two
  // holders related to the same outside address.
  const byRelated = new Map<string, string[]>();
  for (const h of holders) {
    const self = norm(h.address);
    for (const r of ev.related.get(self) ?? []) {
      const rn = norm(r);
      if (rn === self) continue;
      if (inSet.has(rn)) {
        uf.union(self, rn);
        links.push({ a: self, b: rn, reason: 'related', via: rn });
      } else {
        byRelated.set(rn, [...(byRelated.get(rn) ?? []), self]);
      }
    }
  }
  for (const [via, members] of byRelated) {
    const uniq = [...new Set(members)];
    for (let i = 1; i < uniq.length; i++) {
      uf.union(uniq[0], uniq[i]);
      links.push({ a: uniq[0], b: uniq[i], reason: 'related', via });
    }
  }

  // Deployer: joins every holder it funded or is related to.
  const deployerTouches = new Set<string>();
  if (deployer) {
    for (const h of holders) {
      const self = norm(h.address);
      const funded = ev.firstFunder.get(self) && norm(ev.firstFunder.get(self)!) === deployer;
      const related = (ev.related.get(self) ?? []).some((r) => norm(r) === deployer);
      if (self === deployer || funded || related) deployerTouches.add(self);
    }
    const touched = [...deployerTouches];
    for (let i = 1; i < touched.length; i++) {
      uf.union(touched[0], touched[i]);
      links.push({ a: touched[0], b: touched[i], reason: 'deployer', via: deployer });
    }
  }

  const groups = new Map<string, ClusterHolder[]>();
  for (const h of holders) {
    const root = uf.find(norm(h.address));
    groups.set(root, [...(groups.get(root) ?? []), h]);
  }
  const clusters = [...groups.values()]
    .map((members) => {
      const addrs = new Set(members.map((m) => norm(m.address)));
      return {
        wallets: members.map((m) => m.address),
        share: members.reduce((s, m) => s + m.share, 0),
        includesDeployer: members.some((m) => deployerTouches.has(norm(m.address))),
        links: links.filter((l) => addrs.has(l.a) && addrs.has(l.b)),
      };
    })
    .sort((x, y) => y.share - x.share)
    .map((c, id) => ({ ...c, id }));

  return {
    clusters,
    clusteredHolderCount: clusters.filter((c) => c.wallets.length >= 2).reduce((s, c) => s + c.wallets.length, 0),
  };
}
