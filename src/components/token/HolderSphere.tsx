'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { layout3d, project, type Node3 } from '@/lib/viz/sphere3d';
import { pct, usd, walletName } from '@/lib/viz/format';
import type { HolderRow, ForensicsWave } from '@/server/token/waves';
import type { RiverWave } from '@/server/token/terminal';

interface SNode extends Node3 { holder: HolderRow; cluster: boolean; deployer: boolean }
interface SEdge { a: string; b: string; kind: 'funder' | 'related' | 'deployer' | 'transfer'; w: number }

const W = 600, H = 480;
const EDGE_COLOR: Record<SEdge['kind'], string> = { funder: 'var(--storm-3)', deployer: 'var(--storm-4)', related: 'var(--brand-2)', transfer: 'var(--in-3)' };

/**
 * Holder constellation: the top holders on a sphere, sized by share,
 * linked where Nansen shows a connection — a shared first funder or a
 * related-wallets tie (insider clusters) and transfers between holders
 * today. Drag to rotate; hover a wallet to isolate its links. Isolated
 * wallets stay isolated: nothing is drawn that Nansen did not return.
 */
export function HolderSphere({ holders, forensics, river }: { holders: HolderRow[]; forensics: ForensicsWave | null; river: RiverWave | null }) {
  const [yaw, setYaw] = useState(0.4), [pitch, setPitch] = useState(-0.25);
  const [hover, setHover] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(true);
  const drag = useRef<{ x: number; y: number; yaw: number; pitch: number } | null>(null);
  const svg = useRef<SVGSVGElement>(null);

  const { nodes, edges } = useMemo(() => {
    const top = holders.slice(0, 90);
    const ids = new Set(top.map((h) => h.address.toLowerCase()));
    const clustered = new Set((forensics?.clusters ?? []).filter((c) => c.wallets.length >= 2).flatMap((c) => c.wallets.map((w) => w.toLowerCase())));
    const deployer = forensics?.deployer?.toLowerCase() ?? null;
    const peak = Math.max(1e-9, ...top.map((h) => h.share));
    const ns: SNode[] = top.map((h) => ({
      id: h.address.toLowerCase(), x: 0, y: 0, z: 0,
      r: Math.max(3.2, Math.min(22, 3.2 + Math.pow(h.share / peak, 0.45) * 19)),
      holder: h, cluster: clustered.has(h.address.toLowerCase()), deployer: h.address.toLowerCase() === deployer,
    }));
    const es: SEdge[] = [];
    const seen = new Set<string>();
    const add = (a: string, b: string, kind: SEdge['kind'], w: number) => {
      a = a.toLowerCase(); b = b.toLowerCase();
      if (a === b || !ids.has(a) || !ids.has(b)) return;
      const k = a < b ? `${a}|${b}|${kind}` : `${b}|${a}|${kind}`;
      if (seen.has(k)) return;
      seen.add(k); es.push({ a, b, kind, w });
    };
    for (const l of forensics?.links ?? []) add(l.a, l.b, l.reason === 'first-funder' ? 'funder' : l.reason === 'deployer' ? 'deployer' : 'related', 2);
    for (const t of [...(river?.largest ?? []), ...(river?.anomalies ?? [])]) add(t.from, t.to, 'transfer', 1);
    layout3d(ns, es.map((e) => ({ a: e.a, b: e.b, w: e.w })));
    return { nodes: ns, edges: es };
  }, [holders, forensics, river]);

  // Idle spin, stopped by a drag, a hover, reduced motion, or leaving view.
  useEffect(() => {
    if (!spinning || hover || drag.current) return;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0, visible = true;
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
    if (svg.current) io.observe(svg.current);
    const tick = () => { if (visible && !document.hidden) setYaw((y) => y + 0.0035); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); io.disconnect(); };
  }, [spinning, hover]);

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const proj = new Map(nodes.map((n) => [n.id, project(n, yaw, pitch, W / 2, H / 2)]));
  const order = [...nodes].sort((a, b) => proj.get(a.id)!.depth - proj.get(b.id)!.depth);
  const linked = new Set(edges.flatMap((e) => [e.a, e.b]));
  const hovered = hover ? byId.get(hover) : null;
  const hoverLinks = hover ? new Set(edges.filter((e) => e.a === hover || e.b === hover).flatMap((e) => [e.a, e.b])) : null;

  const onDown = (e: React.PointerEvent) => { (e.target as Element).setPointerCapture?.(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, yaw, pitch }; setSpinning(false); };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    setYaw(d.yaw + (e.clientX - d.x) * 0.008);
    setPitch(Math.max(-1.2, Math.min(1.2, d.pitch + (e.clientY - d.y) * 0.008)));
  };
  const onUp = () => { drag.current = null; };

  if (!nodes.length) return <p className="text-sm text-ink-2">No holders to draw.</p>;
  return (
    <div className="relative">
      <svg ref={svg} viewBox={`0 0 ${W} ${H}`} className="h-auto w-full cursor-grab touch-none select-none active:cursor-grabbing" role="img"
        aria-label={`Holder constellation: ${nodes.length} top holders, ${edges.length} measured links, ${nodes.filter((n) => n.cluster).length} in insider clusters. Drag to rotate.`}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}>
        <circle cx={W / 2} cy={H / 2} r={168} fill="none" stroke="var(--axis)" strokeOpacity={0.35} strokeDasharray="2 5" />
        {edges.map((e, i) => {
          const a = proj.get(e.a)!, b = proj.get(e.b)!;
          const on = !hover || e.a === hover || e.b === hover;
          return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={EDGE_COLOR[e.kind]} strokeWidth={e.kind === 'transfer' ? 1 : 1.6}
            strokeOpacity={on ? 0.25 + 0.55 * Math.min(a.depth, b.depth) : 0.05} strokeDasharray={e.kind === 'transfer' ? '3 3' : undefined} />;
        })}
        {order.map((n) => {
          const p = proj.get(n.id)!;
          const dim = hoverLinks ? !hoverLinks.has(n.id) : false;
          const fill = n.deployer ? 'var(--storm-4)' : n.cluster ? 'var(--storm-2)' : n.holder.excluded ? 'var(--axis)' : linked.has(n.id) ? 'var(--brand)' : 'var(--ink-2)';
          return (
            <circle key={n.id} cx={p.x} cy={p.y} r={n.r * p.scale} fill={fill}
              fillOpacity={dim ? 0.12 : 0.35 + 0.6 * p.depth} stroke="var(--surface-page)" strokeOpacity={0.6} strokeWidth={1}
              onPointerEnter={() => setHover(n.id)} onPointerLeave={() => setHover(null)} />
          );
        })}
      </svg>
      {hovered && (
        <div className="material-strong pointer-events-none absolute left-3 top-3 max-w-[260px] rounded-xl p-2.5 text-[12px]">
          <div className="font-medium text-ink">{walletName(hovered.holder.label, hovered.holder.address)}</div>
          <div className="num text-ink-2">{pct(hovered.holder.share, 2)} of supply{hovered.holder.valueUsd != null ? ` · ${usd(hovered.holder.valueUsd)}` : ''}</div>
          <div className="text-ink-muted">
            {hovered.deployer ? 'Deployer · ' : ''}{hovered.cluster ? 'In an insider cluster · ' : ''}{hovered.holder.excluded ? `${hovered.holder.excluded} (not counted as a holder)` : `${edges.filter((e) => e.a === hovered.id || e.b === hovered.id).length} measured links`}
          </div>
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-muted">
        {[['var(--storm-2)', 'insider cluster'], ['var(--storm-4)', 'deployer'], ['var(--brand)', 'linked holder'], ['var(--ink-2)', 'no measured link'], ['var(--axis)', 'exchange / contract']].map(([c, l]) => (
          <span key={l} className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: c }} />{l}</span>
        ))}
        <span className="inline-flex items-center gap-1.5"><span className="inline-block h-0.5 w-4" style={{ background: 'var(--storm-3)' }} />shared funder</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block h-0.5 w-4" style={{ background: 'var(--brand-2)' }} />related wallets</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block w-4 border-t border-dashed" style={{ borderColor: 'var(--in-3)' }} />transfer today</span>
        <span className="ml-auto">Drag to rotate · hover a wallet</span>
      </div>
      {holders[0] && (
        <p className="sr-only">
          Largest holders: {holders.slice(0, 5).map((h) => `${walletName(h.label, h.address)} ${pct(h.share, 1)}`).join('; ')}.
        </p>
      )}
      <Link href="#holders" className="sr-only">Skip to the holder table</Link>
    </div>
  );
}
