'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { InfoPopover } from '@/components/InfoPopover';
import { pct, walletName, chainName } from '@/lib/viz/format';
import type { ForensicsWave } from '@/server/token/waves';

export function forensicsTitle(f: ForensicsWave): string {
  const multi = f.clusters.filter((c) => c.wallets.length >= 2);
  if (!multi.length) return `No linked wallets among the top ${f.nodes.length} holders`;
  const share = multi.reduce((s, c) => s + c.share, 0);
  const dep = multi.some((c) => c.includesDeployer);
  return `${multi.length} cluster${multi.length > 1 ? 's' : ''} of linked wallets hold ${pct(share, 1)} of supply${dep ? ', one tied to the deployer' : ''}`;
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Top holders grouped into insider clusters. Each cluster of linked wallets
 *  is its own labelled bubble: members packed inside (area = share of
 *  supply), the shared first funder at its centre with a line to each member
 *  it funded. Deployer-linked clusters are marked. Holders with no link sit
 *  in a quiet row below. Hover a cluster to isolate it; select a wallet to open it. */
export function InsiderGraph({ f }: { f: ForensicsWave }) {
  const router = useRouter();
  const [hover, setHover] = useState<number | null>(null);
  const L = useMemo(() => {
    const byCluster = new Map<number, ForensicsWave['nodes']>();
    for (const n of f.nodes) byCluster.set(n.cluster, [...(byCluster.get(n.cluster) ?? []), n]);
    const multi = f.clusters.filter((k) => k.wallets.length >= 2).sort((a, b) => b.share - a.share);
    const maxShare = Math.max(1e-9, ...f.nodes.map((n) => n.share));
    const rOf = (share: number) => 4 + 16 * Math.sqrt(share / maxShare);
    // Each cluster: members on a sunflower spiral around its centre, the bubble sized to fit.
    const packed = multi.map((k, i) => {
      const members = (byCluster.get(k.id) ?? []).sort((a, b) => b.share - a.share);
      let ring = 0;
      const pts = members.map((m, j) => {
        const r = rOf(m.share), d = j === 0 && members.length === 1 ? 0 : 14 + 11 * Math.sqrt(j + 0.5) + r * 0.4, a = j * 2.39996;
        ring = Math.max(ring, d + r);
        return { ...m, dx: d * Math.cos(a), dy: d * Math.sin(a), r };
      });
      const funders = [...new Set(members.map((m) => m.funder).filter(Boolean))] as string[];
      const funder = funders.length === 1 ? { address: funders[0], name: members.find((m) => m.funder === funders[0])?.funderName ?? null } : null;
      return { ...k, letter: LETTERS[i % 26], members: pts, R: ring + 8, funder };
    });
    // Lay the clusters out in rows, largest first, wrapping at a fixed width.
    const W = 760; let x = 0, y = 0, rowH = 0;
    const placed = packed.map((k) => {
      const d = 2 * k.R + 40;
      if (x + d > W && x > 0) { x = 0; y += rowH; rowH = 0; }
      const out = { ...k, cx: x + d / 2, cy: y + k.R + 28 };
      x += d; rowH = Math.max(rowH, 2 * k.R + 70);
      return out;
    });
    const loneY = y + rowH + (placed.length ? 16 : 10);
    const lone = f.nodes.filter((n) => !multi.some((k) => k.id === n.cluster)).sort((a, b) => b.share - a.share);
    const width = Math.max(420, placed.length ? Math.max(...placed.map((k) => k.cx + k.R + 20)) : 0);
    const perRow = Math.max(1, Math.floor(width / 34));
    const lonePts = lone.map((n, i) => ({ ...n, x: 17 + (i % perRow) * 34, y: loneY + 22 + Math.floor(i / perRow) * 34, r: Math.min(14, rOf(n.share)) }));
    const height = loneY + (lone.length ? 22 + Math.ceil(lone.length / perRow) * 34 : 0) + 8;
    return { placed, lonePts, width, height, loneY, deployer: f.deployer?.toLowerCase() ?? null };
  }, [f]);
  const tone = (k: { includesDeployer: boolean }) => (k.includesDeployer ? 'var(--storm-4)' : 'var(--storm-3)');
  const dim = (id: number) => (hover == null || hover === id ? 1 : 0.18);
  const tip = (n: ForensicsWave['nodes'][number]) => `${walletName(n.label, n.address)} · ${pct(n.share, 2)} of supply\n${n.funder ? `first funded by ${n.funderName ?? `${n.funder.slice(0, 10)}…`}${n.funderChain ? ` on ${chainName(n.funderChain)}` : ''}` : 'no first funder in Nansen'}\nSelect to open`;
  return (
    <div>
      <div className="flex justify-end"><InfoPopover p={f.provenance} /></div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_240px]">
        <svg viewBox={`-8 -4 ${L.width + 16} ${L.height + 8}`} className="h-auto max-h-[560px] w-full" role="img" aria-label={`Top holders: ${L.placed.length} clusters of linked wallets and ${L.lonePts.length} unlinked holders`} onMouseLeave={() => setHover(null)}>
          {L.placed.map((k) => (
            <g key={k.id} onMouseEnter={() => setHover(k.id)} style={{ opacity: dim(k.id), transition: 'opacity .15s' }}>
              <circle cx={k.cx} cy={k.cy} r={k.R} fill={`color-mix(in srgb, ${tone(k)} 9%, transparent)`} stroke={tone(k)} strokeOpacity={0.6} strokeDasharray={k.includesDeployer ? undefined : '3 3'} />
              <text x={k.cx} y={k.cy - k.R - 12} textAnchor="middle" className="fill-ink text-[11px] font-bold">Cluster {k.letter} · {pct(k.share, 1)}</text>
              <text x={k.cx} y={k.cy - k.R - 1} textAnchor="middle" className="fill-ink-muted text-[9px]">{k.members.length} wallets{k.includesDeployer ? ' · deployer-linked' : ''}{k.funder ? ` · funder ${k.funder.name ?? `${k.funder.address.slice(0, 6)}…`}` : ''}</text>
              {k.members.map((m) => {
                const x = k.cx + m.dx, y = k.cy + m.dy;
                return <line key={`l${m.address}`} x1={k.cx} y1={k.cy} x2={x} y2={y} stroke={tone(k)} strokeOpacity={0.45} strokeWidth={1} strokeDasharray={m.funder && k.funder && m.funder === k.funder.address ? undefined : '2 2'} />;
              })}
              <circle cx={k.cx} cy={k.cy} r={5} fill={tone(k)}><title>{k.funder ? `Shared first funder: ${k.funder.name ?? k.funder.address}` : 'Linked by related wallets'}</title></circle>
              {k.members.map((m) => (
                <circle key={m.address} cx={k.cx + m.dx} cy={k.cy + m.dy} r={m.r} fill={m.address.toLowerCase() === L.deployer ? 'var(--flare)' : tone(k)} fillOpacity={0.85} stroke="var(--surface-1)" strokeWidth={1.5} className="cursor-pointer" onClick={() => router.push(`/wallet/${m.address}`)}>
                  <title>{tip(m)}</title>
                </circle>
              ))}
            </g>
          ))}
          {L.lonePts.length > 0 && <text x={0} y={L.loneY + 4} className="fill-ink-muted text-[10px] font-semibold">No link found · {L.lonePts.length} holders</text>}
          {L.lonePts.map((n) => (
            <circle key={n.address} cx={n.x} cy={n.y} r={n.r} fill="var(--ink-muted)" fillOpacity={hover == null ? 0.55 : 0.15} className="cursor-pointer" onClick={() => router.push(`/wallet/${n.address}`)}><title>{tip(n)}</title></circle>
          ))}
        </svg>
        <div className="min-w-0">
          <h3 className="mb-1.5 text-[12px] font-semibold uppercase tracking-wider text-ink-muted">Clusters</h3>
          {L.placed.length ? (
            <ol className="divide-y divide-[var(--hair)]">
              {L.placed.map((k) => (
                <li key={k.id} onMouseEnter={() => setHover(k.id)} onMouseLeave={() => setHover(null)} className={`rounded-md px-1.5 py-2 text-[12.5px] ${hover === k.id ? 'bg-[var(--surface-2)]' : ''}`}>
                  <div className="flex items-baseline justify-between gap-2"><span className="font-semibold text-ink">Cluster {k.letter}</span><span className="num font-bold" style={{ color: tone(k) }}>{pct(k.share, 1)}</span></div>
                  <div className="text-[11.5px] text-ink-muted">{k.members.length} wallets{k.includesDeployer ? ' · linked to deployer' : ''}{k.funder ? ` · same first funder` : ' · related wallets'}</div>
                </li>
              ))}
            </ol>
          ) : <p className="text-[12.5px] text-ink-muted">No linked wallets among the top holders.</p>}
          <div className="mt-3 space-y-1 text-[11px] text-ink-muted">
            <p><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: 'var(--storm-3)' }} />linked cluster · <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: 'var(--storm-4)' }} />deployer-linked</p>
            <p>Bubble area = share of supply. Solid line: same first funder; dashed: related wallets.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
