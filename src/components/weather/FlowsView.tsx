'use client';
import { useQuery } from '@tanstack/react-query';
import { CapitalFlows } from './CapitalFlows';
import { NetFlowRing, NetFlowBoard, type NetFlowChain } from './NetFlowRing';
import type { ChainTile, FrontWithProvenance } from '@/server/weather/bulletin';
type FlowSnapshot = { fronts: FrontWithProvenance[]; chains: Pick<ChainTile,'chain'|'cpi'>[]; withheld: string[] };
/** Refresh uses the same server-redacted bulletin as Radar. Client flags never grant access.
 *  Owner view: wallet-level rotations. Public view: the measured net-flow map. */
export function FlowsView({ initial, netChains }: { initial: FlowSnapshot; netChains: NetFlowChain[] }) {
 const { data } = useQuery({queryKey:['weather'],initialData:initial,queryFn:async ():Promise<FlowSnapshot>=>{const r=await fetch('/api/weather',{cache:'no-store'});if(!r.ok)throw new Error('Flow refresh unavailable');return r.json();},refetchInterval:60_000});
 if (data.withheld.includes('fronts')) return <><NetFlowRing chains={netChains} /><NetFlowBoard chains={netChains} /></>;
 return <CapitalFlows initial={data.fronts} chains={data.chains} withheld={false}/>;
}
