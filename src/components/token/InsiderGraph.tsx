'use client';
import { useRouter } from 'next/navigation';
import { EChart } from '@/components/charts/EChart';
import { useThemeColors } from '@/components/charts/useThemeColors';
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

/** Bubble graph of the top holders: bubble area = share of supply,
 *  magenta = in a cluster (deepest step when the deployer is linked), gray
 *  = no link found. Edges are the evidence: a shared first funder (solid)
 *  or a related-wallets link (dashed). */
export function InsiderGraph({ f }: { f: ForensicsWave }) {
  const c = useThemeColors();
  const router = useRouter();
  const size = new Map(f.clusters.map((k) => [k.id, k.wallets.length]));
  const deployerCluster = new Set(f.clusters.filter((k) => k.includesDeployer).map((k) => k.id));
  const maxShare = Math.max(...f.nodes.map((n) => n.share), 1e-9);
  const option = c && {
    tooltip: {
      backgroundColor: c['surface-2'],
      borderColor: c.axis,
      textStyle: { color: c['ink-1'], fontSize: 12 },
      formatter: (raw: unknown) => {
        const p = raw as {
          dataType: string;
          data: {
            address?: string;
            walletLabel?: string | null;
            share?: number;
            funderName?: string | null;
            funder?: string | null;
            funderChain?: string | null;
            reason?: string;
            via?: string;
          };
        };
        if (p.dataType === 'edge')
          return `${p.data.reason === 'first-funder' ? 'Same first funder' : p.data.reason === 'deployer' ? 'Linked to deployer' : 'Related wallets'}<br/><span style="opacity:.7">via ${p.data.via?.slice(0, 10)}…</span>`;
        const d = p.data;
        return (
          `<b>${pct(d.share ?? 0, 2)}</b> of supply<br/>${walletName(d.walletLabel, d.address ?? '')}` +
          (d.funder
            ? `<br/><span style="opacity:.7">first funded by ${d.funderName ?? `${d.funder.slice(0, 10)}…`}${d.funderChain ? ` on ${chainName(d.funderChain)}` : ''}</span>`
            : '<br/><span style="opacity:.7">no first funder in Nansen</span>')
        );
      },
    },
    series: [
      {
        type: 'graph' as const,
        layout: 'force' as const,
        roam: false,
        draggable: true,
        force: { repulsion: 70, edgeLength: [20, 60], gravity: 0.12 },
        data: f.nodes.map((n) => {
          const clustered = (size.get(n.cluster) ?? 1) >= 2;
          const color = !clustered ? c.mid : deployerCluster.has(n.cluster) ? c['storm-4'] : c['storm-3'];
          return {
            id: n.address.toLowerCase(),
            name: n.address,
            address: n.address,
            walletLabel: n.label,
            share: n.share,
            funder: n.funder,
            funderName: n.funderName,
            funderChain: n.funderChain,
            symbolSize: 8 + 34 * Math.sqrt(n.share / maxShare),
            itemStyle: { color, borderColor: c['surface-1'], borderWidth: 2 },
          };
        }),
        links: f.links.map((l) => ({
          source: l.a,
          target: l.b,
          reason: l.reason,
          via: l.via,
          lineStyle: {
            color: l.reason === 'deployer' ? c['storm-4'] : c['ink-2'],
            width: 1.5,
            type: l.reason === 'related' ? ('dashed' as const) : ('solid' as const),
            opacity: 0.8,
          },
        })),
        emphasis: { focus: 'adjacency' as const, lineStyle: { width: 2.5 } },
        label: { show: false },
      },
    ],
  };
  const events = {
    click: (p: { dataType?: string; data?: { address?: string } }) => {
      if (p.dataType === 'node' && p.data?.address) router.push(`/wallet/${p.data.address}`);
    },
  };
  return (
    <div>
      <div className="flex justify-end">
        <InfoPopover p={f.provenance} />
      </div>
      {option ? (
        <EChart
          option={option}
          height={320}
          ariaLabel="Top holders as bubbles, linked when Nansen shows a shared first funder or related wallets"
          onEvents={events}
        />
      ) : (
        <div style={{ height: 320 }} />
      )}
      <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[11px] text-ink-muted">
        <span>
          <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: 'var(--storm-3)' }} />
          in a cluster
        </span>
        <span>
          <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: 'var(--storm-4)' }} />
          cluster linked to deployer
        </span>
        <span>
          <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: 'var(--mid)' }} />
          no link found
        </span>
        <span>solid line: same funder · dashed line: related · select a bubble for the wallet</span>
      </div>
    </div>
  );
}
